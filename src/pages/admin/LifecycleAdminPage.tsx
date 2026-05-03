import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import AdminMenu from "./AdminMenu";

type Intake = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  user_type: "elder" | "family" | "admin";
  entry_point: "form" | "phone" | "whatsapp" | "admin";
  status: "created" | "link_sent" | "consent_pending" | "active" | "dropped";
  journey_step: string;
  consent_status: string;
  tier: string;
  organization_id?: string | null;
  organization_name?: string | null;
  account_status?: "enabled" | "disabled";
  created_at: string;
  link_sent_at?: string | null;
  last_activity_at?: string | null;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  default_tier: string;
  is_active: boolean;
};

type BulkPreviewRow = {
  row_number: number;
  valid: boolean;
  errors: string[];
  values: Record<string, string>;
};

type BulkPreviewResponse = {
  organization: Organization;
  rows: BulkPreviewRow[];
  summary: { total: number; valid: number; invalid: number };
};

type ConsentAttempt = {
  id: string;
  status: string;
  attempt_number: number;
  channel: string;
  created_at: string;
  intake?: Intake | null;
};

type Communication = {
  id: string;
  channel: string;
  recipient: string;
  purpose: string;
  status: string;
  created_at: string;
};

type ScheduledEvent = {
  id: string;
  event_type: string;
  title: string;
  description?: string | null;
  channel: string;
  agent_slug?: string | null;
  room_slug?: string | null;
  scheduled_for?: string | null;
  display_time?: string | null;
  timezone: string;
  recurrence: string;
  status: string;
  source: string;
  read_only?: boolean;
};

type UserDetail = {
  intake: Intake;
  profile: Record<string, any> | null;
  communications: Communication[];
  lifecycle_events: Array<Record<string, any>>;
  consent_attempts: ConsentAttempt[];
  scheduled_events: ScheduledEvent[];
};

type HomePlanCardAdmin = {
  id: string;
  card_id: string;
  is_enabled: boolean;
  emoji: string;
  bg: string;
  badge_bg: string;
  badge_text: string;
  route: string;
  base_priority: number;
  condition_keywords: string[];
  hobby_keywords: string[];
  avoid_condition_keywords: string[];
  admin_notes?: string | null;
  updated_at?: string;
};

const ADMIN_KEY_STORAGE = "vyva_admin_lifecycle_key";
const entryPoints = ["", "form", "phone", "whatsapp", "admin"];
const userTypes = ["", "elder", "family", "admin"];
const statuses = ["", "created", "link_sent", "consent_pending", "active", "dropped"];
const tiers = ["trial", "unlimited", "custom"];
const languageOptions = [
  { value: "es", label: "Spanish" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
];
const timezoneOptions = ["Europe/Madrid", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Lisbon"];
const countryCodeOptions = ["+34 ES", "+44 UK", "+33 FR", "+49 DE", "+39 IT", "+351 PT", "+1 US"];

const emptyIntakeForm = {
  first_name: "",
  last_name: "",
  preferred_name: "",
  date_of_birth: "",
  gender: "prefer_not_to_say",
  country_code: "+34 ES",
  phone: "",
  whatsapp: "",
  email: "",
  language: "es",
  timezone: "Europe/Madrid",
  user_type: "elder",
  entry_point: "form",
  tier: "trial",
  organization_id: "",
};

const emptyScheduledEvent = {
  event_type: "vyva_chat",
  title: "",
  description: "",
  channel: "app",
  agent_slug: "",
  room_slug: "",
  scheduled_for: "",
  timezone: "Europe/Madrid",
  recurrence: "none",
  status: "upcoming",
};

function csvToRows(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const parseLine = (line: string) => {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };
  const headers = parseLine(lines[0]).map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString();
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function keywordsToText(values?: string[]) {
  return (values ?? []).join(", ");
}

function textToKeywords(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function LifecycleAdminPage() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? "dev-admin-key");
  const [activeTab, setActiveTab] = useState("users");
  const [filters, setFilters] = useState({ entry_point: "", user_type: "", status: "", tier: "" });
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [users, setUsers] = useState<Intake[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgFilter, setOrgFilter] = useState<"active" | "archived" | "all">("active");
  const [consentAttempts, setConsentAttempts] = useState<ConsentAttempt[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [message, setMessage] = useState("");
  const [newIntake, setNewIntake] = useState(emptyIntakeForm);
  const [newOrg, setNewOrg] = useState({ name: "", default_tier: "trial" });
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<Record<string, any>>({});
  const [newEvent, setNewEvent] = useState(emptyScheduledEvent);
  const [bulkOrg, setBulkOrg] = useState<Organization | null>(null);
  const [bulkRows, setBulkRows] = useState<Record<string, string>[]>([]);
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewResponse | null>(null);
  const [sendBulkLinks, setSendBulkLinks] = useState(false);

  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-admin-key": adminKey }), [adminKey]);

  async function api(path: string, options: RequestInit = {}) {
    const res = await fetch(`/api/admin/lifecycle${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers ?? {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Admin request failed");
    return data;
  }

  async function refresh() {
    sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    const [summaryData, userData, orgData, consentData, commsData] = await Promise.all([
      api("/summary"),
      api(`/users?${params.toString()}`),
      api("/organizations"),
      api("/consent"),
      api("/communications"),
    ]);
    setSummary(summaryData);
    setUsers(userData.users ?? []);
    setOrganizations(orgData.organizations ?? []);
    setConsentAttempts(consentData.attempts ?? []);
    setCommunications(commsData.communications ?? []);
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function createIntake() {
    setMessage("");
    const fullName = `${newIntake.first_name.trim()} ${newIntake.last_name.trim()}`.trim();
    const [callingCode, countryCode = "ES"] = newIntake.country_code.split(" ");
    const phone = `${callingCode} ${newIntake.phone.trim()}`.trim();
    const data = await api("/intakes", {
      method: "POST",
      body: JSON.stringify({
        name: fullName,
        phone,
        organization_id: newIntake.organization_id || null,
        email: newIntake.email || undefined,
        user_type: newIntake.user_type,
        entry_point: newIntake.entry_point,
        tier: newIntake.tier,
        metadata: {
          first_name: newIntake.first_name.trim(),
          last_name: newIntake.last_name.trim(),
          preferred_name: newIntake.preferred_name.trim(),
          date_of_birth: newIntake.date_of_birth,
          gender: newIntake.gender,
          calling_code: callingCode,
          country_code: countryCode,
          phone_number: phone,
          whatsapp_number: newIntake.whatsapp.trim() || phone,
          email: newIntake.email.trim(),
          language: newIntake.language,
          timezone: newIntake.timezone,
        },
      }),
    });
    setMessage(`Intake created for ${data.intake.name}.`);
    setNewIntake(emptyIntakeForm);
    await refresh();
  }

  async function sendLink(intake: Intake) {
    const data = await api(`/intakes/${intake.id}/send-link`, { method: "POST" });
    await navigator.clipboard?.writeText(data.url).catch(() => undefined);
    setMessage(`Access link prepared and copied: ${data.url}`);
    await refresh();
  }

  async function triggerConsent(intake: Intake) {
    await api(`/consent/${intake.id}/trigger`, { method: "POST" });
    setMessage("Consent call queued.");
    await refresh();
  }

  async function markConsent(attempt: ConsentAttempt, status: string) {
    await api(`/consent/${attempt.id}/result`, {
      method: "POST",
      body: JSON.stringify({ status, result_payload: { source: "admin_panel" } }),
    });
    setMessage(`Consent marked as ${status}.`);
    await refresh();
  }

  async function createOrg() {
    const data = await api("/organizations", {
      method: "POST",
      body: JSON.stringify(newOrg),
    });
    setMessage(`Organization created: ${data.organization.name}.`);
    setNewOrg({ name: "", default_tier: "trial" });
    await refresh();
  }

  async function archiveOrg(org: Organization) {
    await api(`/organizations/${org.id}`, { method: "DELETE" });
    setMessage(`${org.name} archived.`);
    await refresh();
  }

  async function restoreOrg(org: Organization) {
    await api(`/organizations/${org.id}/restore`, { method: "POST" });
    setMessage(`${org.name} restored.`);
    await refresh();
  }

  async function saveTier(tier: string) {
    await api("/tiers", {
      method: "POST",
      body: JSON.stringify({
        tier,
        display_name: tier[0].toUpperCase() + tier.slice(1),
        description: `${tier} entitlement bundle`,
        voice_assistant: tier !== "custom",
        medication_tracking: tier !== "custom",
        symptom_check: tier !== "custom",
        concierge: tier !== "custom",
        caregiver_dashboard: tier === "unlimited",
      }),
    });
    setMessage(`Tier ${tier} saved.`);
  }

  async function openUserDetail(intake: Intake) {
    const data = await api(`/users/${intake.id}/details`);
    setSelectedUser(data);
    setSelectedDraft({
      full_name: data.profile?.full_name ?? intake.name,
      preferred_name: data.profile?.preferred_name ?? "",
      date_of_birth: data.profile?.date_of_birth ?? "",
      email: data.profile?.email ?? intake.email ?? "",
      phone_number: data.profile?.phone_number ?? intake.phone,
      whatsapp_number: data.profile?.whatsapp_number ?? "",
      language: data.profile?.language ?? "es",
      timezone: data.profile?.timezone ?? "Europe/Madrid",
      caregiver_name: data.profile?.caregiver_name ?? "",
      caregiver_contact: data.profile?.caregiver_contact ?? "",
      tier: intake.tier,
      organization_id: intake.organization_id ?? "",
    });
  }

  async function saveUserDetail() {
    if (!selectedUser) return;
    const data = await api(`/users/${selectedUser.intake.id}/profile`, {
      method: "PATCH",
      body: JSON.stringify({
        ...selectedDraft,
        organization_id: selectedDraft.organization_id || null,
      }),
    });
    setMessage("User details saved.");
    setSelectedUser({ ...selectedUser, intake: data.intake, profile: data.profile });
    await refresh();
  }

  async function toggleUser(intake: Intake) {
    const disabled = intake.account_status === "disabled";
    await api(`/users/${intake.id}/${disabled ? "enable" : "disable"}`, {
      method: "POST",
      body: JSON.stringify({ reason: disabled ? "" : "Disabled by admin" }),
    });
    setMessage(disabled ? "User enabled." : "User disabled.");
    if (selectedUser?.intake.id === intake.id) await openUserDetail(intake);
    await refresh();
  }

  async function createScheduledEventForUser() {
    if (!selectedUser || !newEvent.title.trim() || !newEvent.scheduled_for) return;
    await api(`/users/${selectedUser.intake.id}/scheduled-events`, {
      method: "POST",
      body: JSON.stringify(newEvent),
    });
    setNewEvent(emptyScheduledEvent);
    await openUserDetail(selectedUser.intake);
    setMessage("Scheduled event added.");
  }

  async function setEventStatus(event: ScheduledEvent, action: "pause" | "resume" | "cancel") {
    if (event.read_only) return;
    await api(`/scheduled-events/${event.id}/${action}`, { method: "POST" });
    if (selectedUser) await openUserDetail(selectedUser.intake);
  }

  async function updateEventTime(event: ScheduledEvent, scheduledFor: string) {
    if (!selectedUser || event.read_only || !scheduledFor) return;
    await api(`/scheduled-events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ scheduled_for: new Date(scheduledFor).toISOString() }),
    });
    await openUserDetail(selectedUser.intake);
    setMessage("Scheduled event time updated.");
  }

  async function handleBulkFile(e: ChangeEvent<HTMLInputElement>, org: Organization) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("CSV is supported in v1. Excel support can be added next.");
      return;
    }
    const rows = csvToRows(await file.text());
    setBulkOrg(org);
    setBulkRows(rows);
    setBulkPreview(null);
    setMessage(`${rows.length} rows loaded. Preview before importing.`);
  }

  async function previewBulk() {
    if (!bulkOrg) return;
    const data = await api(`/organizations/${bulkOrg.id}/bulk-intakes/preview`, {
      method: "POST",
      body: JSON.stringify({ rows: bulkRows }),
    });
    setBulkPreview(data);
  }

  async function importBulk() {
    if (!bulkOrg) return;
    const data = await api(`/organizations/${bulkOrg.id}/bulk-intakes/import`, {
      method: "POST",
      body: JSON.stringify({ rows: bulkRows, send_links: sendBulkLinks }),
    });
    setMessage(`Imported ${data.summary.imported} users. Skipped ${data.summary.skipped}.`);
    setBulkOrg(null);
    setBulkRows([]);
    setBulkPreview(null);
    setSendBulkLinks(false);
    await refresh();
  }

  const visibleOrganizations = organizations.filter((org) => (
    orgFilter === "all" ? true : orgFilter === "active" ? org.is_active : !org.is_active
  ));

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-purple-700">VYVA Admin</p>
          <h1 className="mt-2 font-serif text-4xl">Signup, Access and Lifecycle</h1>
          <p className="mt-2 text-[#7d6b65]">One operating layer for form, phone, WhatsApp and admin-created users.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <input className="min-w-[260px] rounded-2xl border border-[#e4d8ce] px-4 py-3" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Admin key" />
            <button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => refresh().catch((err) => setMessage(err.message))}>Refresh</button>
            {message && <span className="rounded-2xl bg-purple-50 px-4 py-3 text-purple-800">{message}</span>}
          </div>
        </div>

        <AdminMenu />

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Total", summary?.total ?? 0],
            ["Active", summary?.active ?? 0],
            ["Consent", summary?.pendingConsent ?? 0],
            ["Dropped", summary?.dropped ?? 0],
            ["Links sent", summary?.byStatus?.link_sent ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-[#eadfd5] bg-white p-5">
              <p className="text-sm text-[#8b7a73]">{label}</p>
              <p className="mt-1 text-3xl font-black">{String(value)}</p>
            </div>
          ))}
        </div>

        <nav className="mt-5 flex flex-wrap gap-2">
          {["users", "invites", "consent", "organizations", "tiers", "communications", "analytics"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-full px-5 py-3 font-bold ${activeTab === tab ? "bg-purple-700 text-white" : "border border-purple-100 bg-white text-purple-700"}`}>
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        {activeTab === "users" && (
          <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
            <div className="grid gap-3 md:grid-cols-4">
              {[
                ["entry_point", entryPoints],
                ["user_type", userTypes],
                ["status", statuses],
                ["tier", ["", ...tiers]],
              ].map(([key, values]) => (
                <select key={key as string} className="rounded-2xl border border-[#e4d8ce] px-4 py-3" value={(filters as any)[key as string]} onChange={(e) => setFilters((prev) => ({ ...prev, [key as string]: e.target.value }))}>
                  {(values as string[]).map((value) => <option key={value} value={value}>{value || String(key).replace("_", " ")}</option>)}
                </select>
              ))}
            </div>
            <IntakeTable users={users} onView={openUserDetail} onSendLink={sendLink} onTriggerConsent={triggerConsent} onToggleEnabled={toggleUser} />
          </section>
        )}

        {activeTab === "invites" && (
          <section className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-5">
              <h2 className="font-serif text-3xl">Create intake</h2>
              <p className="mt-2 text-sm text-[#7d6b65]">Basic profile details, matching the user settings form.</p>
              <div className="mt-4 grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="First name" required><input className="w-full rounded-2xl border px-4 py-3" value={newIntake.first_name} onChange={(e) => setNewIntake({ ...newIntake, first_name: e.target.value })} /></Field>
                  <Field label="Last name" required><input className="w-full rounded-2xl border px-4 py-3" value={newIntake.last_name} onChange={(e) => setNewIntake({ ...newIntake, last_name: e.target.value })} /></Field>
                </div>
                <Field label="Preferred name" optional><input className="w-full rounded-2xl border px-4 py-3" value={newIntake.preferred_name} onChange={(e) => setNewIntake({ ...newIntake, preferred_name: e.target.value })} /></Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Date of birth" optional><input className="w-full rounded-2xl border px-4 py-3" type="date" value={newIntake.date_of_birth} onChange={(e) => setNewIntake({ ...newIntake, date_of_birth: e.target.value })} /></Field>
                  <Field label="Gender" optional>
                    <select className="w-full rounded-2xl border px-4 py-3" value={newIntake.gender} onChange={(e) => setNewIntake({ ...newIntake, gender: e.target.value })}>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="non_binary">Non-binary</option>
                    </select>
                  </Field>
                </div>
                <Field label="Phone number" required>
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <select className="rounded-2xl border px-3 py-3" value={newIntake.country_code} onChange={(e) => setNewIntake({ ...newIntake, country_code: e.target.value })}>{countryCodeOptions.map((value) => <option key={value}>{value}</option>)}</select>
                    <input className="rounded-2xl border px-4 py-3" placeholder="612 345 678" value={newIntake.phone} onChange={(e) => setNewIntake({ ...newIntake, phone: e.target.value })} />
                  </div>
                </Field>
                <Field label="WhatsApp, if different" optional><input className="w-full rounded-2xl border px-4 py-3" placeholder="Leave blank if same as phone" value={newIntake.whatsapp} onChange={(e) => setNewIntake({ ...newIntake, whatsapp: e.target.value })} /></Field>
                <Field label="Email" optional><input className="w-full rounded-2xl border px-4 py-3" placeholder="name@example.com" value={newIntake.email} onChange={(e) => setNewIntake({ ...newIntake, email: e.target.value })} /></Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Language" optional><select className="w-full rounded-2xl border px-4 py-3" value={newIntake.language} onChange={(e) => setNewIntake({ ...newIntake, language: e.target.value })}>{languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                  <Field label="Timezone" optional><select className="w-full rounded-2xl border px-4 py-3" value={newIntake.timezone} onChange={(e) => setNewIntake({ ...newIntake, timezone: e.target.value })}>{timezoneOptions.map((value) => <option key={value}>{value}</option>)}</select></Field>
                </div>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.user_type} onChange={(e) => setNewIntake({ ...newIntake, user_type: e.target.value })}>{userTypes.filter(Boolean).map((v) => <option key={v}>{v}</option>)}</select>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.entry_point} onChange={(e) => setNewIntake({ ...newIntake, entry_point: e.target.value })}>{entryPoints.filter(Boolean).map((v) => <option key={v}>{v}</option>)}</select>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.tier} onChange={(e) => setNewIntake({ ...newIntake, tier: e.target.value })}>{tiers.map((v) => <option key={v}>{v}</option>)}</select>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.organization_id} onChange={(e) => setNewIntake({ ...newIntake, organization_id: e.target.value })}>
                  <option value="">No organization</option>
                  {organizations.filter((org) => org.is_active).map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={!newIntake.first_name.trim() || !newIntake.last_name.trim() || !newIntake.phone.trim()} onClick={createIntake}>Create intake</button>
              </div>
            </div>
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-5">
              <h2 className="font-serif text-3xl">Recent lifecycle users</h2>
              <IntakeTable users={users.slice(0, 8)} onView={openUserDetail} onSendLink={sendLink} onTriggerConsent={triggerConsent} onToggleEnabled={toggleUser} compact />
            </div>
          </section>
        )}

        {activeTab === "consent" && (
          <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
            <h2 className="font-serif text-3xl">Consent queue</h2>
            <div className="mt-4 grid gap-3">
              {consentAttempts.map((attempt) => (
                <div key={attempt.id} className="rounded-3xl border border-[#eadfd5] p-4">
                  <p className="font-bold">{attempt.intake?.name ?? "Unknown intake"} - attempt {attempt.attempt_number}</p>
                  <p className="text-sm text-[#7d6b65]">{attempt.status} - {attempt.channel} - {new Date(attempt.created_at).toLocaleString()}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{["approved", "rejected", "no_answer"].map((status) => <button key={status} className="rounded-full border px-4 py-2 font-bold" onClick={() => markConsent(attempt, status)}>Mark {status}</button>)}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "organizations" && (
          <section className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-5">
              <h2 className="font-serif text-3xl">New organization</h2>
              <input className="mt-4 w-full rounded-2xl border px-4 py-3" placeholder="Organization name" value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} />
              <select className="mt-3 w-full rounded-2xl border px-4 py-3" value={newOrg.default_tier} onChange={(e) => setNewOrg({ ...newOrg, default_tier: e.target.value })}>{tiers.map((v) => <option key={v}>{v}</option>)}</select>
              <button className="mt-3 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={createOrg}>Create organization</button>
              <p className="mt-4 text-sm text-[#7d6b65]">Bulk upload requires CSV. Columns: first_name, last_name, phone. Optional: preferred_name, date_of_birth, gender, whatsapp, email, language, timezone, user_type, tier.</p>
            </div>
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-5">
              <div className="mb-4 flex gap-2">
                {(["active", "archived", "all"] as const).map((value) => <button key={value} onClick={() => setOrgFilter(value)} className={`rounded-full px-4 py-2 font-bold ${orgFilter === value ? "bg-purple-700 text-white" : "border text-purple-700"}`}>{value}</button>)}
              </div>
              {visibleOrganizations.map((org) => (
                <div key={org.id} className="mb-3 rounded-3xl border p-4">
                  <p className="font-bold">{org.name}</p>
                  <p className="text-sm text-[#7d6b65]">{org.slug} - default tier: {org.default_tier} - {org.is_active ? "Active" : "Archived"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {org.is_active ? (
                      <>
                        <label className="cursor-pointer rounded-full bg-purple-50 px-4 py-2 font-bold text-purple-700">
                          Upload users
                          <input type="file" accept=".csv" className="hidden" onChange={(e) => handleBulkFile(e, org)} />
                        </label>
                        <button className="rounded-full border px-4 py-2 font-bold" onClick={() => archiveOrg(org)}>Archive organization</button>
                      </>
                    ) : (
                      <button className="rounded-full border px-4 py-2 font-bold" onClick={() => restoreOrg(org)}>Restore organization</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {bulkOrg && (
          <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
            <h2 className="font-serif text-3xl">Bulk onboarding for {bulkOrg.name}</h2>
            <p className="mt-1 text-sm text-[#7d6b65]">{bulkRows.length} CSV rows loaded. Preview before importing.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 rounded-full border px-4 py-2 font-bold"><input type="checkbox" checked={sendBulkLinks} onChange={(e) => setSendBulkLinks(e.target.checked)} /> Send app links after import</label>
              <button className="rounded-full bg-purple-700 px-4 py-2 font-bold text-white" onClick={previewBulk}>Preview rows</button>
              <button className="rounded-full border px-4 py-2 font-bold" onClick={() => setBulkOrg(null)}>Close</button>
            </div>
            {bulkPreview && (
              <>
                <p className="mt-4 font-bold">{bulkPreview.summary.valid} valid, {bulkPreview.summary.invalid} need attention.</p>
                <div className="mt-3 max-h-[360px] overflow-auto">
                  <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                    <thead><tr className="text-left uppercase text-[#8b7a73]"><th>Row</th><th>Name</th><th>Phone</th><th>Status</th><th>Errors</th></tr></thead>
                    <tbody>{bulkPreview.rows.map((row) => <tr key={row.row_number} className="bg-[#fbf8f5]"><td className="rounded-l-2xl p-3">{row.row_number}</td><td>{row.values.name}</td><td>{row.values.phone}</td><td>{row.valid ? "Valid" : "Fix needed"}</td><td className="rounded-r-2xl p-3 text-red-700">{row.errors.join(", ")}</td></tr>)}</tbody>
                  </table>
                </div>
                <button className="mt-4 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={bulkPreview.summary.valid === 0} onClick={importBulk}>Import valid rows</button>
              </>
            )}
          </section>
        )}

        {activeTab === "tiers" && <TierSection onSave={saveTier} />}
        {activeTab === "communications" && <CommunicationsSection communications={communications} />}
        {activeTab === "analytics" && <AnalyticsSection summary={summary} />}
      </section>

      {selectedUser && (
        <UserDetailModal
          detail={selectedUser}
          draft={selectedDraft}
          setDraft={setSelectedDraft}
          organizations={organizations}
          onClose={() => setSelectedUser(null)}
          onSave={saveUserDetail}
          onToggle={() => toggleUser(selectedUser.intake)}
          newEvent={newEvent}
          setNewEvent={setNewEvent}
          onCreateEvent={createScheduledEventForUser}
          onEventStatus={setEventStatus}
          onEventTime={updateEventTime}
        />
      )}
    </main>
  );
}

function Field({ label, required, optional, children }: { label: string; required?: boolean; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm font-bold text-[#4d4351]">
        <span>{label}{required ? " *" : ""}</span>
        {optional && <span className="font-normal text-purple-700">Optional</span>}
      </span>
      {children}
    </label>
  );
}

function IntakeTable({ users, onView, onSendLink, onTriggerConsent, onToggleEnabled, compact = false }: {
  users: Intake[];
  onView: (intake: Intake) => void;
  onSendLink: (intake: Intake) => void;
  onTriggerConsent: (intake: Intake) => void;
  onToggleEnabled: (intake: Intake) => void;
  compact?: boolean;
}) {
  return (
    <div className="mt-5 overflow-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-y-2">
        <thead><tr className="text-left text-sm uppercase tracking-wide text-[#8b7a73]"><th>Name</th>{!compact && <th>Phone</th>}<th>Type</th><th>Entry</th><th>Tier</th><th>Status</th><th>Account</th><th>Consent</th><th>Org</th><th>Action</th></tr></thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={compact ? 9 : 10} className="rounded-2xl bg-[#fbf8f5] px-4 py-6 text-center font-bold text-[#7d6b65]">
                No users match the current filters yet.
              </td>
            </tr>
          )}
          {users.map((user) => (
            <tr key={user.id} className="rounded-2xl bg-[#fbf8f5]">
              <td className="rounded-l-2xl px-3 py-3 font-bold">{user.name}</td>
              {!compact && <td className="px-3 py-3">{user.phone}</td>}
              <td className="px-3 py-3">{user.user_type}</td>
              <td className="px-3 py-3">{user.entry_point}</td>
              <td className="px-3 py-3">{user.tier}</td>
              <td className="px-3 py-3">{user.status}</td>
              <td className="px-3 py-3">{user.account_status ?? "enabled"}</td>
              <td className="px-3 py-3">{user.consent_status}</td>
              <td className="px-3 py-3">{user.organization_name ?? "-"}</td>
              <td className="rounded-r-2xl px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-full bg-[#2f2135] px-3 py-2 text-sm font-bold text-white" onClick={() => onView(user)}>View</button>
                  <button className="rounded-full bg-purple-700 px-3 py-2 text-sm font-bold text-white" onClick={() => onSendLink(user)}>Send link</button>
                  <button className="rounded-full border px-3 py-2 text-sm font-bold" onClick={() => onToggleEnabled(user)}>{user.account_status === "disabled" ? "Enable" : "Disable"}</button>
                  {user.user_type === "family" && <button className="rounded-full border px-3 py-2 text-sm font-bold" onClick={() => onTriggerConsent(user)}>Consent</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserDetailModal({ detail, draft, setDraft, organizations, onClose, onSave, onToggle, newEvent, setNewEvent, onCreateEvent, onEventStatus, onEventTime }: {
  detail: UserDetail;
  draft: Record<string, any>;
  setDraft: (next: Record<string, any>) => void;
  organizations: Organization[];
  onClose: () => void;
  onSave: () => void;
  onToggle: () => void;
  newEvent: typeof emptyScheduledEvent;
  setNewEvent: (next: typeof emptyScheduledEvent) => void;
  onCreateEvent: () => void;
  onEventStatus: (event: ScheduledEvent, action: "pause" | "resume" | "cancel") => void;
  onEventTime: (event: ScheduledEvent, scheduledFor: string) => void;
}) {
  const disabled = detail.profile?.account_status === "disabled" || detail.intake.account_status === "disabled";
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/30 p-4">
      <div className="mx-auto max-w-5xl rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-sm font-bold uppercase tracking-[0.22em] text-purple-700">User details</p><h2 className="font-serif text-4xl">{detail.intake.name}</h2><p className="text-[#7d6b65]">{detail.intake.user_type} - {detail.intake.status} - {disabled ? "Disabled" : "Enabled"}</p></div>
          <button className="rounded-full border px-4 py-2 font-bold" onClick={onClose}>Close</button>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border p-4">
            <h3 className="text-xl font-black">Profile and access</h3>
            <div className="mt-3 grid gap-3">
              <Field label="Full name"><input className="w-full rounded-2xl border px-4 py-3" value={draft.full_name ?? ""} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} /></Field>
              <Field label="Preferred name"><input className="w-full rounded-2xl border px-4 py-3" value={draft.preferred_name ?? ""} onChange={(e) => setDraft({ ...draft, preferred_name: e.target.value })} /></Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Phone"><input className="w-full rounded-2xl border px-4 py-3" value={draft.phone_number ?? ""} onChange={(e) => setDraft({ ...draft, phone_number: e.target.value })} /></Field>
                <Field label="WhatsApp"><input className="w-full rounded-2xl border px-4 py-3" value={draft.whatsapp_number ?? ""} onChange={(e) => setDraft({ ...draft, whatsapp_number: e.target.value })} /></Field>
              </div>
              <Field label="Email"><input className="w-full rounded-2xl border px-4 py-3" value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Caregiver name"><input className="w-full rounded-2xl border px-4 py-3" value={draft.caregiver_name ?? ""} onChange={(e) => setDraft({ ...draft, caregiver_name: e.target.value })} /></Field>
                <Field label="Caregiver contact"><input className="w-full rounded-2xl border px-4 py-3" value={draft.caregiver_contact ?? ""} onChange={(e) => setDraft({ ...draft, caregiver_contact: e.target.value })} /></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Tier"><select className="w-full rounded-2xl border px-4 py-3" value={draft.tier ?? "trial"} onChange={(e) => setDraft({ ...draft, tier: e.target.value })}>{tiers.map((tier) => <option key={tier}>{tier}</option>)}</select></Field>
                <Field label="Language"><select className="w-full rounded-2xl border px-4 py-3" value={draft.language ?? "es"} onChange={(e) => setDraft({ ...draft, language: e.target.value })}>{languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                <Field label="Organization"><select className="w-full rounded-2xl border px-4 py-3" value={draft.organization_id ?? ""} onChange={(e) => setDraft({ ...draft, organization_id: e.target.value })}><option value="">None</option>{organizations.filter((org) => org.is_active).map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></Field>
              </div>
              <div className="flex flex-wrap gap-2"><button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={onSave}>Save changes</button><button className="rounded-2xl border px-5 py-3 font-bold" onClick={onToggle}>{disabled ? "Enable user" : "Disable user"}</button></div>
            </div>
          </section>

          <section className="rounded-3xl border p-4">
            <h3 className="text-xl font-black">Scheduled events</h3>
            <div className="mt-3 grid gap-2">
              {detail.scheduled_events.length === 0 && <p className="text-[#7d6b65]">No scheduled events yet.</p>}
              {detail.scheduled_events.map((event) => (
                <div key={event.id} className="rounded-2xl bg-[#fbf8f5] p-3">
                  <p className="font-bold">{event.title}</p>
                  <p className="text-sm text-[#7d6b65]">{event.event_type} - {event.status} - {event.display_time ?? formatDate(event.scheduled_for)}</p>
                  {event.description && <p className="text-sm">{event.description}</p>}
                  {!event.read_only && (
                    <>
                      <form
                        className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const scheduledFor = new FormData(e.currentTarget).get("scheduled_for")?.toString() ?? "";
                          onEventTime(event, scheduledFor);
                        }}
                      >
                        <input
                          className="rounded-xl border px-3 py-2"
                          name="scheduled_for"
                          type="datetime-local"
                          defaultValue={toDatetimeLocal(event.scheduled_for)}
                        />
                        <button className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-bold text-white" type="submit">
                          Save time
                        </button>
                      </form>
                      <div className="mt-2 flex gap-2">
                        <button className="rounded-full border px-3 py-1 text-sm font-bold" onClick={() => onEventStatus(event, event.status === "paused" ? "resume" : "pause")}>{event.status === "paused" ? "Resume" : "Pause"}</button>
                        <button className="rounded-full border px-3 py-1 text-sm font-bold" onClick={() => onEventStatus(event, "cancel")}>Cancel</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-purple-50 p-3">
              <p className="font-bold">Add event</p>
              <div className="mt-2 grid gap-2">
                <input className="rounded-xl border px-3 py-2" placeholder="Title" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} />
                <input className="rounded-xl border px-3 py-2" type="datetime-local" value={newEvent.scheduled_for} onChange={(e) => setNewEvent({ ...newEvent, scheduled_for: e.target.value })} />
                <div className="grid gap-2 md:grid-cols-3">
                  <select className="rounded-xl border px-3 py-2" value={newEvent.event_type} onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}><option value="check_in_call">Check-in call</option><option value="medication_reminder">Medication reminder</option><option value="brain_coach">Brain coach</option><option value="vyva_chat">VYVA chat</option><option value="social_room_session">Social room session</option><option value="concierge_call">Concierge call</option><option value="custom">Custom</option></select>
                  <select className="rounded-xl border px-3 py-2" value={newEvent.recurrence} onChange={(e) => setNewEvent({ ...newEvent, recurrence: e.target.value })}><option value="none">No repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
                  <select className="rounded-xl border px-3 py-2" value={newEvent.channel} onChange={(e) => setNewEvent({ ...newEvent, channel: e.target.value })}><option value="app">App</option><option value="voice">Voice</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></select>
                </div>
                <button className="rounded-xl bg-purple-700 px-4 py-2 font-bold text-white" onClick={onCreateEvent}>Add scheduled event</button>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          <LogPanel title="Communications" rows={detail.communications} />
          <LogPanel title="Consent attempts" rows={detail.consent_attempts} />
          <LogPanel title="Lifecycle history" rows={detail.lifecycle_events} />
        </section>
      </div>
    </div>
  );
}

function LogPanel({ title, rows }: { title: string; rows: Array<Record<string, any>> }) {
  return (
    <div className="rounded-3xl border p-4">
      <h3 className="font-black">{title}</h3>
      <div className="mt-3 max-h-72 overflow-auto text-sm">
        {rows.length === 0 ? <p className="text-[#7d6b65]">No records yet.</p> : rows.map((row) => (
          <div key={row.id} className="mb-2 rounded-2xl bg-[#fbf8f5] p-3">
            <p className="font-bold">{row.purpose ?? row.event_type ?? row.status ?? row.action ?? "Record"}</p>
            <p className="text-[#7d6b65]">{row.channel ? `${row.channel} - ` : ""}{row.created_at ? new Date(row.created_at).toLocaleString() : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeCardsSection({ cards, onChange, onSave }: {
  cards: HomePlanCardAdmin[];
  onChange: (cardId: string, patch: Partial<HomePlanCardAdmin>) => void;
  onSave: (card: HomePlanCardAdmin) => void;
}) {
  return (
    <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl">Home suggestions</h2>
          <p className="mt-2 max-w-3xl text-sm text-[#7d6b65]">
            This is the curated card pool behind “Today for you”. VYVA still chooses which cards each user sees based on profile signals.
          </p>
        </div>
        <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">{cards.length} cards</span>
      </div>

      {cards.length === 0 ? (
        <div className="mt-5 rounded-3xl bg-[#fbf8f5] p-5">
          <p className="font-bold">Home cards are not active yet.</p>
          <p className="mt-1 text-sm text-[#7d6b65]">Run the migration: schema/home_plan_cards.sql.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {cards.map((card) => (
            <article key={card.card_id} className="rounded-3xl border border-[#eadfd5] bg-[#fbf8f5] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-xl font-black">{card.card_id}</p>
                  <p className="text-sm text-[#7d6b65]">{card.route}</p>
                </div>
                <label className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-bold text-purple-700">
                  <input type="checkbox" checked={card.is_enabled} onChange={(e) => onChange(card.card_id, { is_enabled: e.target.checked })} />
                  Enabled
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Field label="Emoji"><input className="w-full rounded-2xl border px-4 py-3" value={card.emoji} onChange={(e) => onChange(card.card_id, { emoji: e.target.value })} /></Field>
                <Field label="Priority"><input className="w-full rounded-2xl border px-4 py-3" type="number" value={card.base_priority} onChange={(e) => onChange(card.card_id, { base_priority: Number(e.target.value) })} /></Field>
                <Field label="Route"><input className="w-full rounded-2xl border px-4 py-3" value={card.route} onChange={(e) => onChange(card.card_id, { route: e.target.value })} /></Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Background"><input className="w-full rounded-2xl border px-4 py-3" value={card.bg} onChange={(e) => onChange(card.card_id, { bg: e.target.value })} /></Field>
                <Field label="Badge background"><input className="w-full rounded-2xl border px-4 py-3" value={card.badge_bg} onChange={(e) => onChange(card.card_id, { badge_bg: e.target.value })} /></Field>
                <Field label="Badge text"><input className="w-full rounded-2xl border px-4 py-3" value={card.badge_text} onChange={(e) => onChange(card.card_id, { badge_text: e.target.value })} /></Field>
              </div>

              <div className="mt-3 grid gap-3">
                <Field label="Condition keywords">
                  <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(card.condition_keywords)} onChange={(e) => onChange(card.card_id, { condition_keywords: textToKeywords(e.target.value) })} />
                </Field>
                <Field label="Hobby keywords">
                  <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(card.hobby_keywords)} onChange={(e) => onChange(card.card_id, { hobby_keywords: textToKeywords(e.target.value) })} />
                </Field>
                <Field label="Avoid if user has">
                  <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(card.avoid_condition_keywords)} onChange={(e) => onChange(card.card_id, { avoid_condition_keywords: textToKeywords(e.target.value) })} />
                </Field>
                <Field label="Admin notes" optional>
                  <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={card.admin_notes ?? ""} onChange={(e) => onChange(card.card_id, { admin_notes: e.target.value })} />
                </Field>
              </div>

              <button className="mt-4 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => onSave(card)}>
                Save card
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TierSection({ onSave }: { onSave: (tier: string) => void }) {
  return (
    <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
      <h2 className="font-serif text-3xl">Tier bundles</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">{tiers.map((tier) => <div key={tier} className="rounded-3xl border p-4"><p className="text-xl font-black capitalize">{tier}</p><p className="mt-2 text-sm text-[#7d6b65]">Controls voice, health, concierge and caregiver entitlements.</p><button className="mt-4 rounded-full bg-purple-50 px-4 py-2 font-bold text-purple-700" onClick={() => onSave(tier)}>Save default bundle</button></div>)}</div>
    </section>
  );
}

function CommunicationsSection({ communications }: { communications: Communication[] }) {
  return (
    <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
      <h2 className="font-serif text-3xl">Communication log</h2>
      <div className="mt-4 grid gap-3">{communications.map((item) => <div key={item.id} className="rounded-3xl border p-4"><p className="font-bold">{item.purpose} - {item.channel}</p><p className="text-sm text-[#7d6b65]">{item.recipient} - {item.status} - {new Date(item.created_at).toLocaleString()}</p></div>)}</div>
    </section>
  );
}

function AnalyticsSection({ summary }: { summary: Record<string, any> | null }) {
  const groups = [
    ["Entry points", summary?.byEntryPoint],
    ["User types", summary?.byUserType],
    ["Statuses", summary?.byStatus],
    ["Tiers", summary?.byTier],
    ["Consent", summary?.byConsent],
  ];
  return (
    <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
      <h2 className="font-serif text-3xl">Analytics snapshot</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{groups.map(([label, values]) => <div key={label as string} className="rounded-3xl bg-[#fbf8f5] p-4"><p className="font-black">{label as string}</p>{Object.entries((values as Record<string, number>) ?? {}).map(([key, value]) => <p key={key} className="mt-2 flex justify-between"><span>{key}</span><strong>{value}</strong></p>)}</div>)}</div>
    </section>
  );
}
