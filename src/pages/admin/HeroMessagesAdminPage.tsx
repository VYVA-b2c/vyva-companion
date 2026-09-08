import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, Plus, RefreshCw, Save, Search, SlidersHorizontal } from "lucide-react";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";
import {
  HERO_LIMITS,
  HERO_MESSAGES,
  getHeroPeriod,
  mergeHeroMessages,
  selectHeroMessageFromCatalog,
  type HeroCopy,
  type HeroApprovedActionId,
  type HeroLanguage,
  type HeroMessageDefinition,
  type HeroMessageEventType,
  type HeroMessageSource,
  type HeroPeriod,
  type HeroReason,
  type HeroSafetyLevel,
  type HeroSurface,
  validateHeroMessageResult,
} from "@/lib/heroMessages";
import {
  HOME_CONTEXT_DECISION_LABELS,
  decideHomeContextMessage,
  type HomeContextMessage,
} from "@/lib/homeContextMessages";

type AdminSource = "built_in" | "database";

type HeroMessageAdmin = HeroMessageDefinition & {
  message_id: string;
  is_enabled: boolean;
  admin_notes?: string | null;
  updated_at?: string;
  source: AdminSource;
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

type HeroMetricRow = {
  surface: HeroSurface;
  message_id: string;
  language: HeroLanguage;
  source: HeroMessageSource;
  event_type: HeroMessageEventType;
  count: number;
};

type OverviewFilter = "all" | "needs_attention" | "managed" | "fallback";

const LANGUAGES: HeroLanguage[] = ["es", "en", "de", "fr", "it", "pt"];
const LANGUAGE_LABELS: Record<HeroLanguage, string> = {
  es: "Spanish",
  en: "English",
  de: "German",
  fr: "French",
  it: "Italian",
  pt: "Portuguese",
};
const EMPTY_NEW_MESSAGE_COPY: HeroCopy = {
  sourceText: "VYVA",
  headline: "",
  headlineWithName: "",
  subtitle: "",
  ctaLabel: "",
  contextHint: "",
};
const CONTROL_CLASS = "min-h-12 w-full rounded-lg border-2 border-[#d8c9bc] bg-white px-3 py-2.5 text-base font-semibold text-[#2f2135] shadow-sm outline-none transition placeholder:text-[#9b8c85] focus:border-purple-600 focus:ring-4 focus:ring-purple-100";
const SURFACES: HeroSurface[] = ["home", "home_voice", "health", "doctor", "vitals", "meds", "concierge", "brain", "activity", "companions", "social"];
const HOME_ACTIONS: Array<{ id: HeroApprovedActionId; label: string }> = [
  { id: "none", label: "No action" },
  { id: "health", label: "Open My Health" },
  { id: "medication", label: "Open Medication" },
  { id: "mind", label: "Open My Mind" },
  { id: "community", label: "Open My Community" },
  { id: "concierge", label: "Open My Concierge" },
  { id: "prevention", label: "Open Prevention" },
];
const REASONS: HeroReason[] = ["safety", "scheduled_event", "continuation", "time_of_day", "evergreen"];
const PERIODS: HeroPeriod[] = ["morning", "afternoon", "evening", "night"];
const SAFETY_LEVELS: HeroSafetyLevel[] = ["normal", "medical", "urgent"];
const EVENT_TYPES = ["", "appointment", "medication", "social", "concierge"] as const;
const ACTIVITY_TYPES = ["", "health_check", "meds", "social", "concierge"] as const;
const OVERVIEW_FILTERS: Array<{ id: OverviewFilter; label: string; description: string }> = [
  { id: "all", label: "All surfaces", description: "Everything live" },
  { id: "needs_attention", label: "Needs attention", description: "Warnings or fallback" },
  { id: "managed", label: "Managed", description: "Admin overrides" },
  { id: "fallback", label: "Fallback", description: "No usable managed copy" },
];
const SURFACE_LABELS: Record<HeroSurface, string> = {
  home: "Home",
  home_voice: "Voice home",
  health: "My Health",
  doctor: "Doctor",
  vitals: "Vital signs",
  meds: "Medication",
  concierge: "Concierge",
  brain: "My Mind",
  activity: "Activities",
  companions: "Companions",
  social: "Community",
};
const PILLAR_SURFACE_GROUPS: Array<{ label: string; surfaces: HeroSurface[] }> = [
  { label: "General", surfaces: ["home", "home_voice"] },
  { label: "Health", surfaces: ["health", "doctor", "vitals"] },
  { label: "Medication", surfaces: ["meds"] },
  { label: "Mind & activities", surfaces: ["brain", "activity"] },
  { label: "Companionship", surfaces: ["companions", "social"] },
  { label: "Support", surfaces: ["concierge"] },
];
const REASON_LABELS: Record<HeroReason, string> = {
  safety: "When safety needs attention",
  scheduled_event: "Before a scheduled event",
  continuation: "To continue an unfinished task",
  time_of_day: "At a specific time of day",
  evergreen: "General message",
};
const PERIOD_LABELS: Record<HeroPeriod, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};
const SAFETY_LABELS: Record<HeroSafetyLevel, string> = {
  normal: "Normal",
  medical: "Medical attention",
  urgent: "Urgent",
};
const EVENT_LABELS: Record<Exclude<(typeof EVENT_TYPES)[number], "">, string> = {
  appointment: "Appointment",
  medication: "Medication",
  social: "Social activity",
  concierge: "Concierge request",
};
const ACTIVITY_LABELS: Record<Exclude<(typeof ACTIVITY_TYPES)[number], "">, string> = {
  health_check: "Health check",
  meds: "Medication",
  social: "Social activity",
  concierge: "Concierge",
};

function words(value?: string) {
  return (value ?? "").trim().split(/\s+/).filter(Boolean).length;
}

function formatDate(value?: string) {
  if (!value) return "Built-in catalog";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function sourceLabel(source: HeroMessageSource | AdminSource) {
  if (source === "database" || source === "managed") return "Managed";
  if (source === "built_in") return "Built-in";
  return "Fallback";
}

function sourceClass(source: HeroMessageSource | AdminSource) {
  if (source === "database" || source === "managed") return "bg-emerald-50 text-emerald-700";
  if (source === "built_in") return "bg-purple-50 text-purple-700";
  return "bg-amber-50 text-amber-800";
}

function diagnosticDate(period: HeroPeriod) {
  const date = new Date();
  const hourByPeriod: Record<HeroPeriod, number> = { morning: 9, afternoon: 14, evening: 18, night: 22 };
  date.setHours(hourByPeriod[period], 0, 0, 0);
  return date;
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
  const builtIn = HERO_MESSAGES.find((message) => message.id === row.message_id);
  return {
    ...builtIn,
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

function adminToDefinition(message: HeroMessageAdmin): HeroMessageDefinition {
  return {
    id: message.message_id,
    surface: message.surface,
    reason: message.reason,
    messageType: message.messageType,
    welcomeAudience: message.welcomeAudience,
    welcomeMomentType: message.welcomeMomentType,
    welcomeProfileAction: message.welcomeProfileAction,
    actionRoute: message.actionRoute,
    priority: Number(message.priority),
    cooldownHours: Number(message.cooldownHours),
    periods: message.periods,
    safetyLevels: message.safetyLevels,
    eventTypes: message.eventTypes,
    activityTypes: message.activityTypes,
    copy: message.copy,
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

function MultiChoice<T extends string>({
  label,
  options,
  selected,
  labels,
  onChange,
}: {
  label: string;
  options: readonly T[];
  selected?: T[];
  labels: Record<T, string>;
  onChange: (values: T[]) => void;
}) {
  const values = selected ?? [];
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-[#4d4351]">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = values.includes(option);
          return (
            <label
              key={option}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                active
                  ? "border-purple-600 bg-purple-50 text-purple-800"
                  : "border-[#d8c9bc] bg-white text-[#5f5058] hover:border-purple-300"
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-purple-700"
                checked={active}
                onChange={() => onChange(active ? values.filter((value) => value !== option) : [...values, option])}
              />
              {labels[option]}
            </label>
          );
        })}
      </div>
    </fieldset>
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

function copyWarnings(message: HeroMessageAdmin, language: HeroLanguage) {
  const warnings: string[] = [];
  const selectedCopy = message.copy[language];
  const copy = selectedCopy ?? message.copy.es;

  if (!selectedCopy) warnings.push(`Missing ${language.toUpperCase()} copy`);
  if (!copy?.headline?.trim()) warnings.push("Headline is required");
  if (copy?.headline?.trim().toLowerCase() === "vyva") warnings.push("Headline is too generic");
  if (copy?.headline && (words(copy.headline) > HERO_LIMITS.headlineWords || copy.headline.length > HERO_LIMITS.headlineChars)) warnings.push("Headline too long");
  if (copy?.sourceText && (words(copy.sourceText) > HERO_LIMITS.sourceWords || copy.sourceText.length > HERO_LIMITS.sourceChars)) warnings.push("Source text too long");
  if (copy?.subtitle && (words(copy.subtitle) > HERO_LIMITS.subtitleWords || copy.subtitle.length > HERO_LIMITS.subtitleChars)) warnings.push("Subtitle too long");
  if (copy?.ctaLabel && (words(copy.ctaLabel) > HERO_LIMITS.ctaWords || copy.ctaLabel.length > HERO_LIMITS.ctaChars)) warnings.push("CTA too long");
  if (message.source === "database" && message.is_enabled && copy && !validateHeroMessageResult(copy)) warnings.push("Managed message will be skipped");

  return warnings;
}

function warningPills(warnings: string[]) {
  if (!warnings.length) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
        <CheckCircle2 size={13} /> Valid
      </span>
    );
  }

  return warnings.slice(0, 3).map((warning) => (
    <span key={warning} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">
      <AlertTriangle size={13} /> {warning}
    </span>
  ));
}

function metricCount(metrics: HeroMetricRow[], surface: HeroSurface, messageId: string, language: HeroLanguage, eventType: HeroMessageEventType) {
  return metrics
    .filter((metric) => metric.surface === surface && metric.message_id === messageId && metric.language === language && metric.event_type === eventType)
    .reduce((sum, metric) => sum + Number(metric.count ?? 0), 0);
}

function lifecycleMetricCount(
  metrics: HeroMetricRow[],
  surface: HeroSurface,
  messageId: string,
  language: HeroLanguage,
  eventTypes: HeroMessageEventType[],
) {
  return eventTypes.reduce(
    (sum, eventType) => sum + metricCount(metrics, surface, messageId, language, eventType),
    0,
  );
}

function HeroPreview({ copy, source, surface }: { copy: HeroCopy; source: HeroMessageSource | AdminSource; surface: HeroSurface }) {
  if (surface === "home_voice") {
    return (
      <div className="overflow-hidden rounded-2xl bg-[#241441] p-6 text-center text-white shadow-sm" data-testid="hero-live-preview">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-200">Home voice</p>
        <p className="mt-2 text-xs font-bold text-white/65">
          {HOME_CONTEXT_DECISION_LABELS.admin_campaign}: shown after urgent, active-flow, and personal messages.
        </p>
        <div className="mx-auto mt-6 h-24 w-24 rounded-full border border-purple-300/30 bg-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.45)]" />
        <h3 className="mt-6 text-3xl font-black leading-tight" data-testid="hero-preview-headline">{copy.headline || "Untitled message"}</h3>
        <p className="mx-auto mt-3 max-w-sm text-base font-bold text-white/75">{copy.subtitle || "No supporting message"}</p>
        {copy.actionId && copy.actionId !== "none" && (
          <p className="mt-5 text-sm font-black text-emerald-200">{copy.ctaLabel || "Open"}</p>
        )}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#5b16a5] to-[#8f35d0] p-5 text-white shadow-sm" data-testid="hero-live-preview">
      <div className="flex items-center justify-between gap-3">
        <p className="font-serif text-3xl leading-none">VYVA</p>
        <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-black">{sourceLabel(source)}</span>
      </div>
      <div className="mt-6 rounded-full border border-white/20 bg-white/15 px-4 py-3">
        <p className="truncate text-sm font-black uppercase tracking-[0.16em] text-emerald-200">{copy.sourceText || "Hero"}</p>
        <h3 className="mt-1 min-h-9 text-2xl font-black leading-tight" data-testid="hero-preview-headline">{copy.headline || "Untitled hero"}</h3>
      </div>
      <p className="mt-4 min-h-6 text-sm font-bold text-white/80">{copy.subtitle || "No subtitle"}</p>
      <button type="button" className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 font-black text-purple-800">
        {copy.ctaLabel || "Talk"}
      </button>
    </div>
  );
}

export default function HeroMessagesAdminPage() {
  const [databaseMessages, setDatabaseMessages] = useState<HeroMessageAdmin[]>([]);
  const [drafts, setDrafts] = useState<Record<string, HeroMessageAdmin>>({});
  const [metrics, setMetrics] = useState<HeroMetricRow[]>([]);
  const [surfaceFilter, setSurfaceFilter] = useState<HeroSurface | "all">("all");
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>("all");
  const [messageSearch, setMessageSearch] = useState("");
  const [language, setLanguage] = useState<HeroLanguage>("es");
  const [metricsDays, setMetricsDays] = useState(7);
  const [selectedMessageId, setSelectedMessageId] = useState<string>("");
  const [editorView, setEditorView] = useState<"catalog" | "editor">("catalog");
  const [workspaceView, setWorkspaceView] = useState<"messages" | "routing" | "simulation">("messages");
  const [showNewMessageSetup, setShowNewMessageSetup] = useState(false);
  const [newMessageLanguages, setNewMessageLanguages] = useState<HeroLanguage[]>(["es"]);
  const [newMessageBaseLanguage, setNewMessageBaseLanguage] = useState<HeroLanguage>("es");
  const [newMessageCopy, setNewMessageCopy] = useState<HeroCopy>({ ...EMPTY_NEW_MESSAGE_COPY });
  const [newMessageTranslating, setNewMessageTranslating] = useState(false);
  const [newMessageError, setNewMessageError] = useState("");
  const [diagnosticSurface, setDiagnosticSurface] = useState<HeroSurface>("health");
  const [diagnosticLanguage, setDiagnosticLanguage] = useState<HeroLanguage>("es");
  const [diagnosticPeriod, setDiagnosticPeriod] = useState<HeroPeriod>(getHeroPeriod());
  const [diagnosticSafety, setDiagnosticSafety] = useState<HeroSafetyLevel>("normal");
  const [diagnosticEventType, setDiagnosticEventType] = useState<(typeof EVENT_TYPES)[number]>("");
  const [diagnosticActivity, setDiagnosticActivity] = useState<(typeof ACTIVITY_TYPES)[number]>("");
  const [message, setMessage] = useState("");

  const allMessages = useMemo(() => {
    const merged = new Map<string, HeroMessageAdmin>();
    for (const item of HERO_MESSAGES.map(builtInToAdmin)) merged.set(item.message_id, item);
    for (const item of databaseMessages) merged.set(item.message_id, item);
    for (const [id, draft] of Object.entries(drafts)) merged.set(id, draft);
    return Array.from(merged.values()).sort((a, b) => b.priority - a.priority || a.message_id.localeCompare(b.message_id));
  }, [databaseMessages, drafts]);

  const filteredMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    return allMessages.filter((item) => {
      const surfaceMatches = surfaceFilter === "all" || item.surface === surfaceFilter;
      if (!surfaceMatches) return false;
      if (!query) return true;
      const copy = item.copy[language] ?? item.copy.es;
      return [
        item.message_id,
        item.surface,
        item.reason,
        sourceLabel(item.source),
        copy?.headline,
        copy?.subtitle,
        copy?.sourceText,
      ].some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [allMessages, language, messageSearch, surfaceFilter]);

  const selectionCatalog = useMemo(() => {
    const managed = allMessages.filter((item) => item.is_enabled && (item.source === "database" || Boolean(drafts[item.message_id])));
    return mergeHeroMessages(managed.map(adminToDefinition));
  }, [allMessages, drafts]);

  const defaultSelectedMessage = useMemo(
    () => filteredMessages.find((item) => item.source === "database" || Boolean(drafts[item.message_id])) ?? filteredMessages[0],
    [drafts, filteredMessages],
  );
  const selectedMessage = useMemo(
    () => allMessages.find((item) => item.message_id === selectedMessageId) ?? defaultSelectedMessage,
    [allMessages, defaultSelectedMessage, selectedMessageId],
  );

  const selectedCopy = selectedMessage?.copy[language] ?? selectedMessage?.copy.es ?? { headline: "" };
  const selectedWarnings = selectedMessage ? copyWarnings(selectedMessage, language) : [];
  const canSaveSelected = Boolean(selectedMessage && selectedCopy.headline?.trim() && validateHeroMessageResult(selectedCopy));

  const overview = useMemo(() => SURFACES.map((surface) => {
    const result = selectHeroMessageFromCatalog(surface, { language, date: new Date(), safetyLevel: "normal" }, selectionCatalog);
    const active = allMessages.find((item) => item.message_id === result.messageId);
    const activeWarnings = active ? copyWarnings(active, language) : [];
    if (result.source === "fallback") activeWarnings.push(result.fallbackReason === "invalid_selected_message" ? "Invalid managed copy caused fallback" : "No usable surface copy");
    if (result.headline.trim().toLowerCase() === "vyva") activeWarnings.push("Generic fallback headline");
    const shown = lifecycleMetricCount(metrics, surface, result.messageId, language, ["impression", "shown"]);
    const opened = lifecycleMetricCount(metrics, surface, result.messageId, language, ["cta_click", "opened"]);
    const deferred = metricCount(metrics, surface, result.messageId, language, "deferred");
    const dismissed = lifecycleMetricCount(metrics, surface, result.messageId, language, ["dismiss", "dismissed"]);
    const completed = metricCount(metrics, surface, result.messageId, language, "completed");
    const voiceEngaged = metricCount(metrics, surface, result.messageId, language, "voice_engaged");
    return {
      surface,
      result,
      priority: active?.priority ?? 0,
      lastEdited: result.source === "managed" ? formatDate(active?.updated_at) : sourceLabel(result.source),
      warnings: activeWarnings,
      shown,
      opened,
      deferred,
      dismissed,
      completed,
      voiceEngaged,
      ctr: shown ? `${((opened / shown) * 100).toFixed(1)}%` : "0.0%",
    };
  }), [allMessages, language, metrics, selectionCatalog]);
  const overviewCounts = useMemo<Record<OverviewFilter, number>>(() => ({
    all: overview.length,
    needs_attention: overview.filter((item) => item.warnings.length > 0).length,
    managed: overview.filter((item) => item.result.source === "managed").length,
    fallback: overview.filter((item) => item.result.source === "fallback").length,
  }), [overview]);
  const filteredOverview = useMemo(() => {
    if (overviewFilter === "needs_attention") return overview.filter((item) => item.warnings.length > 0);
    if (overviewFilter === "managed") return overview.filter((item) => item.result.source === "managed");
    if (overviewFilter === "fallback") return overview.filter((item) => item.result.source === "fallback");
    return overview;
  }, [overview, overviewFilter]);

  const diagnosticResult = useMemo(() => selectHeroMessageFromCatalog(diagnosticSurface, {
    language: diagnosticLanguage,
    date: diagnosticDate(diagnosticPeriod),
    safetyLevel: diagnosticSafety,
    upcomingEventType: diagnosticEventType || null,
    recentActivity: diagnosticActivity || null,
  }, selectionCatalog), [diagnosticActivity, diagnosticEventType, diagnosticLanguage, diagnosticPeriod, diagnosticSafety, diagnosticSurface, selectionCatalog]);
  const homeDecisionPreview = useMemo(() => {
    const now = diagnosticDate(diagnosticPeriod).getTime();
    const fallback: HomeContextMessage = {
      id: "preview:fallback",
      kind: "default",
      title: "Calm greeting",
      priority: 0,
      category: "general",
      source: "fallback",
    };
    const managed: HomeContextMessage = {
      id: `admin:${diagnosticResult.messageId}`,
      kind: "feature",
      title: diagnosticResult.headline,
      supportingText: diagnosticResult.subtitle,
      actionLabel: diagnosticResult.ctaLabel,
      actionRoute: diagnosticResult.ctaRoute,
      priority: allMessages.find((item) => item.message_id === diagnosticResult.messageId)?.priority ?? 50,
      nonUrgent: true,
      source: diagnosticResult.source === "managed" ? "managed" : "built_in",
    };
    const contextual: HomeContextMessage[] = [];
    if (diagnosticSafety === "urgent") {
      contextual.push({
        id: "preview:urgent",
        kind: "urgent",
        title: "Urgent support",
        priority: 100,
        category: "health",
        intentTags: ["health"],
        source: "built_in",
      });
    }
    if (diagnosticEventType === "medication" || diagnosticEventType === "appointment") {
      contextual.push({
        id: `preview:${diagnosticEventType}`,
        kind: "reminder",
        title: diagnosticEventType === "medication" ? "Medication reminder" : "Appointment reminder",
        priority: 60,
        category: diagnosticEventType,
        dueAt: now + 20 * 60_000,
        intentTags: [diagnosticEventType === "medication" ? "health" : "doctor"],
        source: "built_in",
      });
    }
    if (diagnosticActivity) {
      contextual.push({
        id: `preview:flow:${diagnosticActivity}`,
        kind: "flow",
        title: `Continue ${diagnosticActivity.replaceAll("_", " ")}`,
        priority: 70,
        category: diagnosticActivity === "social"
          ? "community"
          : diagnosticActivity === "concierge"
            ? "concierge"
            : "health",
        intentTags: [diagnosticActivity],
        source: "built_in",
      });
    }
    return decideHomeContextMessage(
      [managed, ...contextual, fallback],
      {},
      now,
      { activeIntent: diagnosticActivity || diagnosticEventType || null },
    );
  }, [
    allMessages,
    diagnosticActivity,
    diagnosticEventType,
    diagnosticPeriod,
    diagnosticResult,
    diagnosticSafety,
  ]);

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/lifecycle${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Admin request failed");
    return data;
  }

  async function refreshMessages() {
    const data = await api("/hero-messages");
    setDatabaseMessages((data.messages ?? []).map(rowToAdmin));
    setDrafts({});
  }

  async function refreshMetrics(days = metricsDays) {
    const data = await api(`/hero-messages/metrics?days=${days}`);
    setMetrics((data.metrics ?? []) as HeroMetricRow[]);
    if (data.warning) setMessage(data.warning);
  }

  async function refreshAll(days = metricsDays) {
    setMessage("");
    await Promise.all([refreshMessages(), refreshMetrics(days)]);
  }

  function updateMessage(messageId: string, patch: Partial<HeroMessageAdmin>) {
    const current = allMessages.find((item) => item.message_id === messageId) ?? builtInToAdmin(HERO_MESSAGES[0]);
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
    const current = allMessages.find((item) => item.message_id === messageId);
    if (!current) return;
    const currentCopy = current.copy[language] ?? current.copy.es ?? { headline: "" };
    updateMessage(messageId, {
      copy: {
        ...current.copy,
        [language]: { ...currentCopy, ...copyPatch },
      },
    });
  }

  async function createManagedDraft() {
    if (!newMessageCopy.headline.trim()) {
      setNewMessageError("Write the headline before creating translations.");
      return;
    }
    const surface = surfaceFilter === "all" ? "home" : surfaceFilter;
    const id = `${surface}-managed-${Date.now()}`;
    const selectedLanguages = newMessageLanguages.length > 0 ? newMessageLanguages : [language];
    const primaryLanguage = selectedLanguages.includes(newMessageBaseLanguage)
      ? newMessageBaseLanguage
      : selectedLanguages[0];
    const targets = selectedLanguages.filter((item) => item !== newMessageBaseLanguage);
    setNewMessageTranslating(true);
    setNewMessageError("");

    let translations: Partial<Record<HeroLanguage, HeroCopy>> = {};
    try {
      if (targets.length) {
        const result = await api("/hero-messages/translate", {
          method: "POST",
          body: JSON.stringify({
            sourceLanguage: newMessageBaseLanguage,
            targetLanguages: targets,
            copy: newMessageCopy,
          }),
        });
        translations = result.translations ?? {};
      }
    } catch (error) {
      setNewMessageError(error instanceof Error ? error.message : "The message could not be translated.");
      setNewMessageTranslating(false);
      return;
    }

    const copy = {
      [newMessageBaseLanguage]: { ...newMessageCopy },
      ...translations,
    } as Record<HeroLanguage, HeroCopy>;
    const draft: HeroMessageAdmin = {
      id,
      message_id: id,
      surface,
      reason: "evergreen",
      priority: 30,
      cooldownHours: 8,
      periods: [],
      safetyLevels: [],
      eventTypes: [],
      activityTypes: [],
      copy,
      is_enabled: true,
      admin_notes: "",
      source: "database",
    };
    setDrafts((existing) => ({ ...existing, [id]: draft }));
    setSelectedMessageId(id);
    setLanguage(primaryLanguage);
    setShowNewMessageSetup(false);
    setEditorView("editor");
    setNewMessageTranslating(false);
  }

  function openNewMessageSetup() {
    setNewMessageLanguages([language]);
    setNewMessageBaseLanguage(language);
    setNewMessageCopy({ ...EMPTY_NEW_MESSAGE_COPY });
    setNewMessageError("");
    setShowNewMessageSetup(true);
  }

  function toggleNewMessageLanguage(item: HeroLanguage) {
    setNewMessageLanguages((current) => (
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item]
    ));
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
    await refreshAll();
    setSelectedMessageId(item.message_id);
  }

  useEffect(() => {
    refreshAll().catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedMessageId && !filteredMessages.some((item) => item.message_id === selectedMessageId)) {
      setSelectedMessageId(filteredMessages[0]?.message_id ?? "");
    }
  }, [filteredMessages, selectedMessageId]);

  useEffect(() => {
    refreshMetrics(metricsDays).catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricsDays]);

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Hero messages"
          subtitle="Choose where a message appears, edit its copy, and preview it before saving."
        >
          <button className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-3 font-bold text-white" onClick={() => refreshAll().catch((err) => setMessage(err.message))}>
            <RefreshCw size={16} /> Refresh
          </button>
          {message && <span className="rounded-xl bg-purple-50 px-4 py-3 text-sm font-bold text-purple-800">{message}</span>}
        </AdminPageHeader>

        <nav className="mt-5 flex gap-2 rounded-lg border border-[#eadfd5] bg-white p-2 shadow-sm" aria-label="Hero message workspace">
          <button
            type="button"
            className={`rounded-lg px-4 py-2.5 text-sm font-black ${workspaceView === "messages" ? "bg-purple-700 text-white" : "text-[#5f5058] hover:bg-purple-50"}`}
            onClick={() => setWorkspaceView("messages")}
            data-testid="tab-hero-messages"
          >
            Messages
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2.5 text-sm font-black ${workspaceView === "routing" ? "bg-purple-700 text-white" : "text-[#5f5058] hover:bg-purple-50"}`}
            onClick={() => setWorkspaceView("routing")}
            data-testid="tab-hero-routing"
          >
            Routing overview
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2.5 text-sm font-black ${workspaceView === "simulation" ? "bg-purple-700 text-white" : "text-[#5f5058] hover:bg-purple-50"}`}
            onClick={() => setWorkspaceView("simulation")}
            data-testid="tab-hero-simulation"
          >
            Simulated winner
          </button>
        </nav>

        {workspaceView === "messages" && <section className="mt-4" data-testid="panel-hero-messages">
          {editorView === "catalog" && <aside className="rounded-lg border border-[#eadfd5] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Messages</h2>
                <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{filteredMessages.length} shown</p>
              </div>
              <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-purple-300 px-3 py-2 text-sm font-black text-purple-700" onClick={openNewMessageSetup}>
                <Plus size={16} /> New
              </button>
            </div>

            {showNewMessageSetup && (
              <section className="mt-4 rounded-lg border border-purple-200 bg-purple-50/60 p-4" aria-labelledby="new-hero-message-title">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 id="new-hero-message-title" className="text-lg font-black">Create a message</h3>
                    <p className="mt-1 text-sm font-semibold text-[#7d6b65]">Write one version, then choose the draft translations you need.</p>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-black text-[#695b62] hover:text-purple-700"
                    onClick={() => setShowNewMessageSetup(false)}
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-4 grid gap-3 rounded-lg border border-[#dfd2c8] bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                    <Field label="Base language">
                      <select
                        className="w-full rounded-xl border border-[#eadfd5] px-3 py-2.5"
                        value={newMessageBaseLanguage}
                        onChange={(event) => {
                          const nextLanguage = event.target.value as HeroLanguage;
                          setNewMessageBaseLanguage(nextLanguage);
                          setNewMessageLanguages((current) => current.includes(nextLanguage) ? current : [nextLanguage, ...current]);
                        }}
                        aria-label="Base language"
                      >
                        {LANGUAGES.map((item) => <option key={item} value={item}>{LANGUAGE_LABELS[item]}</option>)}
                      </select>
                    </Field>
                    <Field label="Headline">
                      <input
                        className="w-full rounded-xl border border-[#eadfd5] px-3 py-2.5"
                        value={newMessageCopy.headline}
                        onChange={(event) => setNewMessageCopy((current) => ({ ...current, headline: event.target.value }))}
                        placeholder="What should the user see?"
                        aria-label="New message headline"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Supporting text (optional)">
                      <input
                        className="w-full rounded-xl border border-[#eadfd5] px-3 py-2.5"
                        value={newMessageCopy.subtitle ?? ""}
                        onChange={(event) => setNewMessageCopy((current) => ({ ...current, subtitle: event.target.value }))}
                        placeholder="A short helpful explanation"
                        aria-label="New message supporting text"
                      />
                    </Field>
                    <Field label="Button label (optional)">
                      <input
                        className="w-full rounded-xl border border-[#eadfd5] px-3 py-2.5"
                        value={newMessageCopy.ctaLabel ?? ""}
                        onChange={(event) => setNewMessageCopy((current) => ({ ...current, ctaLabel: event.target.value }))}
                        placeholder="For example: Talk"
                        aria-label="New message button label"
                      />
                    </Field>
                  </div>
                </div>

                <fieldset className="mt-4">
                  <legend className="text-sm font-black text-[#4d4351]">Create draft translations</legend>
                  <p className="mt-1 text-xs font-semibold text-[#7d6b65]">The base language is included automatically. Other versions are generated for review.</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {LANGUAGES.map((item) => {
                      const checked = newMessageLanguages.includes(item);
                      return (
                        <label
                          key={item}
                          className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm font-black transition ${
                            checked
                              ? "border-purple-500 bg-white text-purple-800 shadow-sm"
                              : "border-[#dfd2c8] bg-white/70 text-[#5f5058] hover:border-purple-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-5 w-5 accent-purple-700"
                            checked={checked}
                            disabled={item === newMessageBaseLanguage || newMessageTranslating}
                            onChange={() => toggleNewMessageLanguage(item)}
                            aria-label={LANGUAGE_LABELS[item]}
                          />
                          <span>{LANGUAGE_LABELS[item]}</span>
                          <span className="ml-auto text-xs uppercase text-[#8b7a73]">{item}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#7d6b65]">
                      {newMessageLanguages.length === 1
                        ? "Base language only"
                        : `${newMessageLanguages.length - 1} translation drafts selected`}
                    </p>
                    {newMessageError ? <p className="mt-1 text-sm font-bold text-red-700" role="alert">{newMessageError}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-purple-700 px-5 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                    disabled={newMessageLanguages.length === 0 || !newMessageCopy.headline.trim() || newMessageTranslating}
                    onClick={() => void createManagedDraft()}
                  >
                    <Plus size={17} /> {newMessageTranslating ? "Translating..." : newMessageLanguages.length > 1 ? "Create translations" : "Create message"}
                  </button>
                </div>
              </section>
            )}

            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-[#4d4351]">Search</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b7a73]" aria-hidden="true" />
                  <input
                    className={`${CONTROL_CLASS} pl-9`}
                    value={messageSearch}
                    onChange={(event) => setMessageSearch(event.target.value)}
                    placeholder="Search messages"
                  />
                </span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Field label="Pillar / app area">
                  <select className={CONTROL_CLASS} value={surfaceFilter} onChange={(event) => setSurfaceFilter(event.target.value as HeroSurface | "all")}>
                    <option value="all">All pillars and app areas</option>
                    {PILLAR_SURFACE_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.surfaces.map((surface) => <option key={surface} value={surface}>{SURFACE_LABELS[surface]}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <Field label="Language">
                  <select className={CONTROL_CLASS} value={language} onChange={(event) => setLanguage(event.target.value as HeroLanguage)}>
                    {LANGUAGES.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            <div className="mt-5 grid min-h-[280px] gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredMessages.length === 0 ? (
                <p className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-4 text-sm font-bold text-[#7d6b65]">No messages match this filter.</p>
              ) : filteredMessages.map((item) => {
                const warnings = copyWarnings(item, language);
                const active = selectedMessage?.message_id === item.message_id;
                return (
                  <button
                    key={item.message_id}
                    type="button"
                    data-testid={`hero-catalog-message-${item.message_id}`}
                    onClick={() => {
                      setSelectedMessageId(item.message_id);
                      setEditorView("editor");
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      active
                        ? "border-purple-400 bg-purple-50 shadow-sm"
                        : "border-[#eadfd5] bg-[#fffaf4] hover:border-purple-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black">{item.copy[language]?.headline ?? item.copy.es?.headline ?? item.message_id}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-[#7d6b65]">{SURFACE_LABELS[item.surface]} · {REASON_LABELS[item.reason]}</p>
                      </div>
                    </div>
                    {warnings.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{warningPills(warnings)}</div>}
                  </button>
                );
              })}
            </div>
          </aside>}

          {editorView === "editor" && <section className="rounded-lg border border-[#eadfd5] bg-white p-5 shadow-sm">
            {selectedMessage ? (
              <div className="grid gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0e7df] pb-4">
                  <div className="min-w-0">
                    <button type="button" className="mb-3 inline-flex items-center gap-2 text-sm font-black text-purple-700 hover:underline" onClick={() => setEditorView("catalog")}>
                      <ArrowLeft size={16} /> Back to messages
                    </button>
                    <p className="text-sm font-bold text-purple-700">{SURFACE_LABELS[selectedMessage.surface]}</p>
                    <h2 className="mt-1 break-words text-2xl font-black">{selectedCopy.headline || "Untitled message"}</h2>
                    {selectedWarnings.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{warningPills(selectedWarnings)}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-[#f7f2eb] px-3 text-sm font-black text-[#4d4351]">
                      <input className="h-4 w-4 accent-purple-700" type="checkbox" checked={selectedMessage.is_enabled} onChange={(event) => updateMessage(selectedMessage.message_id, { is_enabled: event.target.checked })} />
                      Active
                    </label>
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-purple-700 px-5 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                      disabled={!canSaveSelected}
                      onClick={() => saveMessage(selectedMessage).catch((err) => setMessage(err.message))}
                    >
                      <Save size={18} /> Save message
                    </button>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                  <div className="lg:sticky lg:top-4 lg:self-start">
                    <HeroPreview copy={selectedCopy} source={selectedMessage.source} surface={selectedMessage.surface} />
                  </div>

                  <div className="grid gap-4">
                    <section className="rounded-lg border border-[#eadfd5] p-4">
                      <h3 className="text-lg font-black">Where this message appears</h3>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Pillar / app area">
                          <select className={CONTROL_CLASS} value={selectedMessage.surface} onChange={(event) => updateMessage(selectedMessage.message_id, { surface: event.target.value as HeroSurface })}>
                            {PILLAR_SURFACE_GROUPS.map((group) => (
                              <optgroup key={group.label} label={group.label}>
                                {group.surfaces.map((surface) => <option key={surface} value={surface}>{SURFACE_LABELS[surface]}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        </Field>
                        <Field label="When to show it">
                          <select className={CONTROL_CLASS} value={selectedMessage.reason} onChange={(event) => updateMessage(selectedMessage.message_id, { reason: event.target.value as HeroReason })}>
                            {REASONS.map((reason) => <option key={reason} value={reason}>{REASON_LABELS[reason]}</option>)}
                          </select>
                        </Field>
                      </div>

                      <details className="mt-4 rounded-lg border border-[#eadfd5] bg-[#fffaf4] p-3">
                        <summary className="flex cursor-pointer list-none items-center gap-2 font-black text-purple-700">
                          <SlidersHorizontal size={16} /> Advanced targeting
                        </summary>
                        <div className="mt-4 grid gap-5">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Display priority">
                              <input className={CONTROL_CLASS} type="number" value={selectedMessage.priority} onChange={(event) => updateMessage(selectedMessage.message_id, { priority: Number(event.target.value) })} />
                            </Field>
                            <Field label="Hours before showing again">
                              <input className={CONTROL_CLASS} type="number" min="0" value={selectedMessage.cooldownHours} onChange={(event) => updateMessage(selectedMessage.message_id, { cooldownHours: Number(event.target.value) })} />
                            </Field>
                          </div>
                          <MultiChoice label="Time of day" options={PERIODS} selected={selectedMessage.periods} labels={PERIOD_LABELS} onChange={(periods) => updateMessage(selectedMessage.message_id, { periods })} />
                          <MultiChoice label="Safety state" options={SAFETY_LEVELS} selected={selectedMessage.safetyLevels} labels={SAFETY_LABELS} onChange={(safetyLevels) => updateMessage(selectedMessage.message_id, { safetyLevels })} />
                          <MultiChoice label="Upcoming event" options={EVENT_TYPES.filter((value) => value !== "")} selected={(selectedMessage.eventTypes ?? []).filter(Boolean) as Exclude<(typeof EVENT_TYPES)[number], "">[]} labels={EVENT_LABELS} onChange={(eventTypes) => updateMessage(selectedMessage.message_id, { eventTypes })} />
                          <MultiChoice label="Recent activity" options={ACTIVITY_TYPES.filter((value) => value !== "")} selected={(selectedMessage.activityTypes ?? []).filter(Boolean) as Exclude<(typeof ACTIVITY_TYPES)[number], "">[]} labels={ACTIVITY_LABELS} onChange={(activityTypes) => updateMessage(selectedMessage.message_id, { activityTypes })} />
                        </div>
                      </details>
                    </section>

                    <section className="rounded-lg border border-[#eadfd5] p-4">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black">Message copy</h3>
                          <p className="mt-1 text-sm font-semibold text-[#7d6b65]">This is what the user will see.</p>
                        </div>
                        <Field label="Language">
                          <select className={`${CONTROL_CLASS} min-w-28`} value={language} onChange={(event) => setLanguage(event.target.value as HeroLanguage)}>
                            {LANGUAGES.map((item) => (
                              <option key={item} value={item}>
                                {LANGUAGE_LABELS[item]}{selectedMessage.copy[item] ? "" : " (add)"}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label={`Headline (${language.toUpperCase()})`}>
                          <input aria-label={`Headline (${language.toUpperCase()})`} className={CONTROL_CLASS} value={selectedCopy.headline ?? ""} onChange={(event) => updateCopy(selectedMessage.message_id, { headline: event.target.value })} />
                          <LimitNote label="Headline" value={selectedCopy.headline} wordsLimit={HERO_LIMITS.headlineWords} charsLimit={HERO_LIMITS.headlineChars} />
                        </Field>
                        <Field label="Personalised headline" optional>
                          <input className={CONTROL_CLASS} value={selectedCopy.headlineWithName ?? ""} onChange={(event) => updateCopy(selectedMessage.message_id, { headlineWithName: event.target.value })} placeholder="Good morning, {name}" />
                        </Field>
                        <Field label="Short label" optional>
                          <input className={CONTROL_CLASS} value={selectedCopy.sourceText ?? ""} onChange={(event) => updateCopy(selectedMessage.message_id, { sourceText: event.target.value })} placeholder="Example: Health" />
                          <LimitNote label="Source" value={selectedCopy.sourceText} wordsLimit={HERO_LIMITS.sourceWords} charsLimit={HERO_LIMITS.sourceChars} />
                        </Field>
                        <Field label="Button label" optional>
                          <input className={CONTROL_CLASS} value={selectedCopy.ctaLabel ?? ""} onChange={(event) => updateCopy(selectedMessage.message_id, { ctaLabel: event.target.value })} placeholder="Example: Talk" />
                          <LimitNote label="CTA" value={selectedCopy.ctaLabel} wordsLimit={HERO_LIMITS.ctaWords} charsLimit={HERO_LIMITS.ctaChars} />
                        </Field>
                        {selectedMessage.surface === "home_voice" && (
                          <Field label="Button destination" optional>
                            <select
                              className={CONTROL_CLASS}
                              value={selectedCopy.actionId ?? "none"}
                              onChange={(event) => updateCopy(selectedMessage.message_id, { actionId: event.target.value as HeroApprovedActionId })}
                              data-testid="select-home-hero-action"
                            >
                              {HOME_ACTIONS.map((action) => <option key={action.id} value={action.id}>{action.label}</option>)}
                            </select>
                          </Field>
                        )}
                        <Field label="Supporting text" optional>
                          <textarea className={`${CONTROL_CLASS} min-h-24 resize-y`} value={selectedCopy.subtitle ?? ""} onChange={(event) => updateCopy(selectedMessage.message_id, { subtitle: event.target.value })} />
                          <LimitNote label="Subtitle" value={selectedCopy.subtitle} wordsLimit={HERO_LIMITS.subtitleWords} charsLimit={HERO_LIMITS.subtitleChars} />
                        </Field>
                      </div>
                    </section>

                    <details className="rounded-lg border border-[#eadfd5] bg-[#fffaf4] p-3">
                      <summary className="cursor-pointer font-black text-purple-700">Internal notes</summary>
                      <div className="mt-4 grid gap-4">
                        <Field label="Context hint" optional>
                          <input className={CONTROL_CLASS} value={selectedCopy.contextHint ?? ""} onChange={(event) => updateCopy(selectedMessage.message_id, { contextHint: event.target.value })} />
                        </Field>
                        <Field label="Admin notes" optional>
                          <textarea className={`${CONTROL_CLASS} min-h-24 resize-y`} value={selectedMessage.admin_notes ?? ""} onChange={(event) => updateMessage(selectedMessage.message_id, { admin_notes: event.target.value })} />
                        </Field>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-[#fffaf4] p-4 font-bold text-[#7d6b65]">No messages match this filter.</p>
            )}
          </section>}
        </section>}

        {workspaceView === "routing" && <section className="mt-5" data-testid="panel-hero-routing">
          <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-purple-700"><BarChart3 size={16} /> Routing overview</p>
                <h2 className="mt-1 text-xl font-black">Live surface status</h2>
              </div>
              <Field label="Metrics window">
                <select className="w-36 rounded-xl border border-[#eadfd5] px-3 py-2" value={metricsDays} onChange={(event) => setMetricsDays(Number(event.target.value))}>
                  {[7, 14, 30, 90].map((days) => <option key={days} value={days}>{days} days</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-testid="hero-overview-filters">
              {OVERVIEW_FILTERS.map((item) => {
                const active = overviewFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOverviewFilter(item.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-purple-600 bg-purple-700 text-white shadow-sm"
                        : "border-[#eadfd5] bg-[#fffaf4] text-[#2f2135] hover:border-purple-200"
                    }`}
                    data-testid={`button-hero-overview-filter-${item.id}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black">{item.label}</span>
                      <span className="text-xl font-black leading-none">{overviewCounts[item.id]}</span>
                    </span>
                    <span className="sr-only">{item.description}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-sm font-bold text-[#7d6b65]" data-testid="hero-overview-filter-count">
              Showing {filteredOverview.length} of {overview.length} surfaces.
            </p>

            <div className="mt-3 overflow-hidden rounded-xl border border-[#eadfd5]">
              <div className="hidden grid-cols-[0.9fr_0.45fr_1.25fr_0.55fr_0.8fr] gap-3 border-b border-[#eadfd5] bg-[#fbf8f5] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65] lg:grid">
                <span>Surface and active copy</span>
                <span>Source</span>
                <span>Message lifecycle</span>
                <span>Open rate</span>
                <span>Status</span>
              </div>
              <div className="max-h-[460px] overflow-auto">
                {filteredOverview.length === 0 ? (
                  <div className="p-6 text-center text-sm font-bold text-[#7d6b65]">No hero surfaces match this filter.</div>
                ) : filteredOverview.map((item) => (
                  <article
                    key={item.surface}
                    className="grid gap-3 border-b border-[#f0e7df] px-4 py-3 last:border-b-0 lg:grid-cols-[0.9fr_0.45fr_1.25fr_0.55fr_0.8fr] lg:items-center"
                    data-testid={`card-hero-overview-${item.surface}`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7d6b65]">{item.surface}</p>
                      <h3 className="mt-1 truncate text-base font-black" data-testid={`hero-active-${item.surface}`}>{item.result.headline}</h3>
                      <p className="mt-1 truncate text-sm text-[#7d6b65]">{item.result.messageId} / {item.result.reason} / priority {item.priority}</p>
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${sourceClass(item.result.source)}`}>{sourceLabel(item.result.source)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs" data-testid={`hero-lifecycle-${item.surface}`}>
                      {[
                        ["Shown", item.shown],
                        ["Opened", item.opened],
                        ["Deferred", item.deferred],
                        ["Dismissed", item.dismissed],
                        ["Completed", item.completed],
                        ["Voice", item.voiceEngaged],
                      ].map(([label, count]) => (
                        <div key={label}>
                          <p className="font-black text-[#2f2135]">{count}</p>
                          <p className="font-bold text-[#8b7a73]">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="text-sm font-black">{item.ctr} open rate</div>
                    <div className="flex flex-wrap gap-1.5">{warningPills(item.warnings)}</div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </section>}

        {workspaceView === "simulation" && <section className="mt-5" data-testid="panel-hero-simulation">
          <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">Selection diagnostics</p>
                <h2 className="mt-1 text-xl font-black">Simulated winner</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-black ${sourceClass(diagnosticResult.source)}`}>{sourceLabel(diagnosticResult.source)}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Surface">
                <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={diagnosticSurface} onChange={(event) => setDiagnosticSurface(event.target.value as HeroSurface)}>
                  {SURFACES.map((surface) => <option key={surface} value={surface}>{surface}</option>)}
                </select>
              </Field>
              <Field label="Language">
                <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={diagnosticLanguage} onChange={(event) => setDiagnosticLanguage(event.target.value as HeroLanguage)}>
                  {LANGUAGES.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
                </select>
              </Field>
              <Field label="Period">
                <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={diagnosticPeriod} onChange={(event) => setDiagnosticPeriod(event.target.value as HeroPeriod)}>
                  {PERIODS.map((period) => <option key={period} value={period}>{period}</option>)}
                </select>
              </Field>
              <Field label="Safety">
                <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={diagnosticSafety} onChange={(event) => setDiagnosticSafety(event.target.value as HeroSafetyLevel)}>
                  {SAFETY_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </Field>
              <Field label="Event">
                <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={diagnosticEventType} onChange={(event) => setDiagnosticEventType(event.target.value as (typeof EVENT_TYPES)[number])}>
                  {EVENT_TYPES.map((eventType) => <option key={eventType || "none"} value={eventType}>{eventType || "none"}</option>)}
                </select>
              </Field>
              <Field label="Recent activity">
                <select className="w-full rounded-xl border border-[#eadfd5] px-3 py-2" value={diagnosticActivity} onChange={(event) => setDiagnosticActivity(event.target.value as (typeof ACTIVITY_TYPES)[number])}>
                  {ACTIVITY_TYPES.map((activity) => <option key={activity || "none"} value={activity}>{activity || "none"}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-4 grid gap-3 rounded-xl bg-[#fffaf4] p-4" data-testid="hero-diagnostics-winner">
              <div>
                <p className="text-sm text-[#8b7a73]">Active copy</p>
                <p className="text-xl font-black">{diagnosticResult.headline}</p>
                <p className="mt-1 text-sm text-[#7d6b65]">{diagnosticResult.messageId}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-[#8b7a73]">Reason</p><p className="font-black">{diagnosticResult.reason}</p></div>
                <div><p className="text-[#8b7a73]">Language</p><p className="font-black">{diagnosticResult.language.toUpperCase()}</p></div>
                <div><p className="text-[#8b7a73]">Fallback</p><p className="font-black">{diagnosticResult.fallbackReason ?? "No"}</p></div>
              </div>
            </div>
            {homeDecisionPreview ? (
              <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4" data-testid="home-message-decision-preview">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">
                  Why this user sees this message now
                </p>
                <p className="mt-2 text-lg font-black">{homeDecisionPreview.message.title}</p>
                <p className="mt-1 text-sm font-bold text-[#6f5f78]">{homeDecisionPreview.explanation}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {homeDecisionPreview.factors.map((factor) => (
                    <div key={`${factor.key}:${factor.label}`} className="rounded-lg bg-white p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black">{factor.label}</span>
                        <span className={factor.points >= 0 ? "font-black text-emerald-700" : "font-black text-amber-700"}>
                          {factor.points > 0 ? "+" : ""}{factor.points}
                        </span>
                      </div>
                      <p className="mt-1 text-[#7d6b65]">{factor.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </section>}
      </section>
    </main>
  );
}
