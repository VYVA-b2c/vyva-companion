import { useEffect, useMemo, useState, type ReactNode } from "react";
import AdminMenu from "./AdminMenu";
import {
  HERO_LIMITS,
  HERO_MESSAGES,
  type HeroCopy,
  type HeroLanguage,
  type HeroMessageDefinition,
  type HeroReason,
  type HeroSurface,
  validateHeroMessageResult,
} from "@/lib/heroMessages";

type HeroMessageAdmin = HeroMessageDefinition & {
  message_id: string;
  is_enabled: boolean;
  admin_notes?: string | null;
  updated_at?: string;
  source: "built_in" | "database";
};

type HeroMessageRow = {
  message_id: string;
  surface: HeroSurface;
  reason: HeroReason;
  priority: number;
  cooldown_hours: number;
  periods?: string[];
  safety_levels?: string[];
  event_types?: string[];
  activity_types?: string[];
  copy?: Record<HeroLanguage, HeroCopy>;
  is_enabled: boolean;
  admin_notes?: string | null;
  updated_at?: string;
};

const ADMIN_KEY_STORAGE = "vyva_admin_lifecycle_key";
const LANGUAGES: HeroLanguage[] = ["es", "en", "de", "fr", "it", "pt"];
const SURFACES: HeroSurface[] = ["home", "health", "doctor", "vitals", "meds", "concierge", "brain", "activity", "companions", "social"];
const REASONS: HeroReason[] = ["safety", "scheduled_event", "continuation", "time_of_day", "evergreen"];

function words(value?: string) {
  return (value ?? "").trim().split(/\s+/).filter(Boolean).length;
}

function textToList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(values?: string[]) {
  return (values ?? []).join(", ");
}

function builtInToAdmin(message: HeroMessageDefinition): HeroMessageAdmin {
  return {
    ...message,
    message_id: message.id,
    is_enabled: true,
    admin_notes: "",
    source: "built_in",
  };
}

function rowToAdmin(row: HeroMessageRow): HeroMessageAdmin {
  return {
    id: row.message_id,
    message_id: row.message_id,
    surface: row.surface,
    reason: row.reason,
    priority: row.priority,
    cooldownHours: row.cooldown_hours,
    periods: (row.periods ?? []) as HeroMessageAdmin["periods"],
    safetyLevels: (row.safety_levels ?? []) as HeroMessageAdmin["safetyLevels"],
    eventTypes: row.event_types as HeroMessageAdmin["eventTypes"],
    activityTypes: row.activity_types as HeroMessageAdmin["activityTypes"],
    copy: (row.copy ?? {}) as Record<HeroLanguage, HeroCopy>,
    is_enabled: row.is_enabled,
    admin_notes: row.admin_notes,
    updated_at: row.updated_at,
    source: "database",
  };
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm font-bold text-[#4d4351]">
        <span>{label}</span>
        {optional && <span className="font-normal text-purple-700">Optional</span>}
      </span>
      {children}
    </label>
  );
}

function LimitNote({ label, value, wordsLimit, charsLimit }: { label: string; value?: string; wordsLimit: number; charsLimit: number }) {
  const wordCount = words(value);
  const charCount = (value ?? "").length;
  const ok = wordCount <= wordsLimit && charCount <= charsLimit;
  return (
    <span className={`text-xs font-bold ${ok ? "text-emerald-700" : "text-red-700"}`}>
      {label}: {wordCount}/{wordsLimit} words, {charCount}/{charsLimit} chars
    </span>
  );
}

export default function HeroMessagesAdminPage() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? "dev-admin-key");
  const [databaseMessages, setDatabaseMessages] = useState<HeroMessageAdmin[]>([]);
  const [drafts, setDrafts] = useState<Record<string, HeroMessageAdmin>>({});
  const [surfaceFilter, setSurfaceFilter] = useState<HeroSurface | "all">("all");
  const [language, setLanguage] = useState<HeroLanguage>("es");
  const [message, setMessage] = useState("");

  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-admin-key": adminKey }), [adminKey]);

  const messages = useMemo(() => {
    const merged = new Map<string, HeroMessageAdmin>();
    for (const item of HERO_MESSAGES.map(builtInToAdmin)) merged.set(item.message_id, item);
    for (const item of databaseMessages) merged.set(item.message_id, item);
    for (const [id, draft] of Object.entries(drafts)) merged.set(id, draft);
    return Array.from(merged.values())
      .filter((item) => surfaceFilter === "all" || item.surface === surfaceFilter)
      .sort((a, b) => b.priority - a.priority || a.message_id.localeCompare(b.message_id));
  }, [databaseMessages, drafts, surfaceFilter]);

  async function api(path: string, options: RequestInit = {}) {
    const res = await fetch(`/api/admin/lifecycle${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers ?? {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Admin request failed");
    return data;
  }

  async function refresh() {
    sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
    setMessage("");
    const data = await api("/hero-messages");
    setDatabaseMessages((data.messages ?? []).map(rowToAdmin));
    setDrafts({});
  }

  function updateMessage(messageId: string, patch: Partial<HeroMessageAdmin>) {
    const current = messages.find((item) => item.message_id === messageId) ?? builtInToAdmin(HERO_MESSAGES[0]);
    setDrafts((existing) => ({
      ...existing,
      [messageId]: {
        ...current,
        ...existing[messageId],
        ...patch,
        source: existing[messageId]?.source ?? current.source,
      },
    }));
  }

  function updateCopy(messageId: string, copyPatch: Partial<HeroCopy>) {
    const current = messages.find((item) => item.message_id === messageId);
    if (!current) return;
    const currentCopy = current.copy[language] ?? current.copy.es ?? { headline: "" };
    updateMessage(messageId, {
      copy: {
        ...current.copy,
        [language]: { ...currentCopy, ...copyPatch },
      },
    });
  }

  async function saveMessage(item: HeroMessageAdmin) {
    const copy = item.copy[language] ?? item.copy.es;
    if (!copy?.headline?.trim()) {
      setMessage("Headline is required for the selected language.");
      return;
    }
    if (!validateHeroMessageResult(copy)) {
      setMessage("This copy is too long. Shorten the selected language before saving.");
      return;
    }

    await api("/hero-messages", {
      method: "POST",
      body: JSON.stringify({
        message_id: item.message_id,
        surface: item.surface,
        reason: item.reason,
        priority: Number(item.priority),
        cooldown_hours: Number(item.cooldownHours),
        periods: item.periods ?? [],
        safety_levels: item.safetyLevels ?? [],
        event_types: item.eventTypes ?? [],
        activity_types: item.activityTypes ?? [],
        copy: item.copy,
        is_enabled: item.is_enabled,
        admin_notes: item.admin_notes ?? "",
      }),
    });
    setMessage(`${item.message_id} saved.`);
    await refresh();
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-purple-700">VYVA Admin</p>
          <h1 className="mt-2 font-serif text-4xl">Hero messages</h1>
          <p className="mt-2 max-w-3xl text-[#7d6b65]">
            Manage approved banner copy used across the app. Built-in messages remain as fallbacks, while saved messages override them.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <input className="min-w-[260px] rounded-2xl border border-[#e4d8ce] px-4 py-3" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Admin key" />
            <button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => refresh().catch((err) => setMessage(err.message))}>Refresh</button>
            {message && <span className="rounded-2xl bg-purple-50 px-4 py-3 text-purple-800">{message}</span>}
          </div>
        </div>

        <AdminMenu />

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Surface">
              <select className="w-full rounded-2xl border px-4 py-3" value={surfaceFilter} onChange={(e) => setSurfaceFilter(e.target.value as HeroSurface | "all")}>
                <option value="all">All surfaces</option>
                {SURFACES.map((surface) => <option key={surface} value={surface}>{surface}</option>)}
              </select>
            </Field>
            <Field label="Editing language">
              <select className="w-full rounded-2xl border px-4 py-3" value={language} onChange={(e) => setLanguage(e.target.value as HeroLanguage)}>
                {LANGUAGES.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
              </select>
            </Field>
            <div className="rounded-3xl bg-[#f7f2eb] p-4 text-sm text-[#7d6b65]">
              Headline: max {HERO_LIMITS.headlineWords} words and {HERO_LIMITS.headlineChars} characters. No truncation is allowed.
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4">
          {messages.map((item) => {
            const copy = item.copy[language] ?? item.copy.es ?? { headline: "" };
            const isManaged = item.source === "database";
            return (
              <article key={item.message_id} className="rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-black">{item.message_id}</p>
                    <p className="mt-1 text-sm text-[#7d6b65]">{item.surface} · {item.reason}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-4 py-2 text-sm font-bold ${isManaged ? "bg-emerald-50 text-emerald-700" : "bg-[#f7f2eb] text-[#7d6b65]"}`}>
                      {isManaged ? "Managed" : "Built-in"}
                    </span>
                    <label className="flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 font-bold text-purple-700">
                      <input type="checkbox" checked={item.is_enabled} onChange={(e) => updateMessage(item.message_id, { is_enabled: e.target.checked })} />
                      Enabled
                    </label>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <Field label="Surface">
                    <select className="w-full rounded-2xl border px-4 py-3" value={item.surface} onChange={(e) => updateMessage(item.message_id, { surface: e.target.value as HeroSurface })}>
                      {SURFACES.map((surface) => <option key={surface} value={surface}>{surface}</option>)}
                    </select>
                  </Field>
                  <Field label="Reason">
                    <select className="w-full rounded-2xl border px-4 py-3" value={item.reason} onChange={(e) => updateMessage(item.message_id, { reason: e.target.value as HeroReason })}>
                      {REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                    </select>
                  </Field>
                  <Field label="Priority">
                    <input className="w-full rounded-2xl border px-4 py-3" type="number" value={item.priority} onChange={(e) => updateMessage(item.message_id, { priority: Number(e.target.value) })} />
                  </Field>
                  <Field label="Cooldown hours">
                    <input className="w-full rounded-2xl border px-4 py-3" type="number" value={item.cooldownHours} onChange={(e) => updateMessage(item.message_id, { cooldownHours: Number(e.target.value) })} />
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <Field label="Periods" optional>
                    <input className="w-full rounded-2xl border px-4 py-3" value={listToText(item.periods)} onChange={(e) => updateMessage(item.message_id, { periods: textToList(e.target.value) as HeroMessageAdmin["periods"] })} placeholder="morning, evening" />
                  </Field>
                  <Field label="Safety levels" optional>
                    <input className="w-full rounded-2xl border px-4 py-3" value={listToText(item.safetyLevels)} onChange={(e) => updateMessage(item.message_id, { safetyLevels: textToList(e.target.value) as HeroMessageAdmin["safetyLevels"] })} placeholder="urgent" />
                  </Field>
                  <Field label="Event types" optional>
                    <input className="w-full rounded-2xl border px-4 py-3" value={listToText(item.eventTypes)} onChange={(e) => updateMessage(item.message_id, { eventTypes: textToList(e.target.value) as HeroMessageAdmin["eventTypes"] })} placeholder="appointment" />
                  </Field>
                  <Field label="Activity types" optional>
                    <input className="w-full rounded-2xl border px-4 py-3" value={listToText(item.activityTypes)} onChange={(e) => updateMessage(item.message_id, { activityTypes: textToList(e.target.value) as HeroMessageAdmin["activityTypes"] })} placeholder="social" />
                  </Field>
                </div>

                <div className="mt-4 rounded-[1.5rem] bg-[#fbf8f4] p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label={`Headline (${language.toUpperCase()})`}>
                      <input className="w-full rounded-2xl border px-4 py-3" value={copy.headline ?? ""} onChange={(e) => updateCopy(item.message_id, { headline: e.target.value })} />
                      <LimitNote label="Headline" value={copy.headline} wordsLimit={HERO_LIMITS.headlineWords} charsLimit={HERO_LIMITS.headlineChars} />
                    </Field>
                    <Field label="Headline with name" optional>
                      <input className="w-full rounded-2xl border px-4 py-3" value={copy.headlineWithName ?? ""} onChange={(e) => updateCopy(item.message_id, { headlineWithName: e.target.value })} placeholder="Good morning, {name}" />
                    </Field>
                    <Field label="Source text" optional>
                      <input className="w-full rounded-2xl border px-4 py-3" value={copy.sourceText ?? ""} onChange={(e) => updateCopy(item.message_id, { sourceText: e.target.value })} />
                      <LimitNote label="Source" value={copy.sourceText} wordsLimit={HERO_LIMITS.sourceWords} charsLimit={HERO_LIMITS.sourceChars} />
                    </Field>
                    <Field label="CTA label" optional>
                      <input className="w-full rounded-2xl border px-4 py-3" value={copy.ctaLabel ?? ""} onChange={(e) => updateCopy(item.message_id, { ctaLabel: e.target.value })} />
                      <LimitNote label="CTA" value={copy.ctaLabel} wordsLimit={HERO_LIMITS.ctaWords} charsLimit={HERO_LIMITS.ctaChars} />
                    </Field>
                    <Field label="Subtitle" optional>
                      <input className="w-full rounded-2xl border px-4 py-3" value={copy.subtitle ?? ""} onChange={(e) => updateCopy(item.message_id, { subtitle: e.target.value })} />
                      <LimitNote label="Subtitle" value={copy.subtitle} wordsLimit={HERO_LIMITS.subtitleWords} charsLimit={HERO_LIMITS.subtitleChars} />
                    </Field>
                    <Field label="Context hint" optional>
                      <input className="w-full rounded-2xl border px-4 py-3" value={copy.contextHint ?? ""} onChange={(e) => updateCopy(item.message_id, { contextHint: e.target.value })} />
                    </Field>
                  </div>
                </div>

                <div className="mt-3">
                  <Field label="Admin notes" optional>
                    <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={item.admin_notes ?? ""} onChange={(e) => updateMessage(item.message_id, { admin_notes: e.target.value })} />
                  </Field>
                </div>

                <button className="mt-4 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => saveMessage(item).catch((err) => setMessage(err.message))}>
                  Save hero message
                </button>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
