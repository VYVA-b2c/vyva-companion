import { useEffect, useMemo, useState, type ReactNode } from "react";

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

const ADMIN_KEY_STORAGE = "vyva_admin_lifecycle_key";

const entryPoints = ["", "form", "phone", "whatsapp", "admin"];
const userTypes = ["", "elder", "family", "admin"];
const statuses = ["", "created", "link_sent", "consent_pending", "active", "dropped"];
const tiers = ["trial", "unlimited", "custom"];
const languageOptions = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
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

export default function LifecycleAdminPage() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? "dev-admin-key");
  const [activeTab, setActiveTab] = useState("users");
  const [filters, setFilters] = useState({ entry_point: "", user_type: "", status: "", tier: "" });
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [users, setUsers] = useState<Intake[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [consentAttempts, setConsentAttempts] = useState<ConsentAttempt[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [message, setMessage] = useState("");
  const [newIntake, setNewIntake] = useState(emptyIntakeForm);
  const [newOrg, setNewOrg] = useState({ name: "", default_tier: "trial" });

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
    setMessage(`Intake creado para ${data.intake.name}.`);
    setNewIntake(emptyIntakeForm);
    await refresh();
  }

  async function sendLink(intake: Intake) {
    const data = await api(`/intakes/${intake.id}/send-link`, { method: "POST" });
    await navigator.clipboard?.writeText(data.url).catch(() => undefined);
    setMessage(`Enlace preparado y copiado: ${data.url}`);
    await refresh();
  }

  async function triggerConsent(intake: Intake) {
    await api(`/consent/${intake.id}/trigger`, { method: "POST" });
    setMessage("Consentimiento puesto en cola.");
    await refresh();
  }

  async function markConsent(attempt: ConsentAttempt, status: string) {
    await api(`/consent/${attempt.id}/result`, {
      method: "POST",
      body: JSON.stringify({ status, result_payload: { source: "admin_panel" } }),
    });
    setMessage(`Consentimiento marcado como ${status}.`);
    await refresh();
  }

  async function createOrg() {
    const data = await api("/organizations", {
      method: "POST",
      body: JSON.stringify(newOrg),
    });
    setMessage(`Organización creada: ${data.organization.name}.`);
    setNewOrg({ name: "", default_tier: "trial" });
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
    setMessage(`Tier ${tier} guardado.`);
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-[#eadfd5]">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-purple-700">VYVA Admin</p>
          <h1 className="mt-2 font-serif text-4xl">Signup, Access and Lifecycle</h1>
          <p className="mt-2 text-[#7d6b65]">
            One operating layer for form, phone, WhatsApp and admin-created users.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <input
              className="min-w-[260px] rounded-2xl border border-[#e4d8ce] px-4 py-3"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Admin key"
            />
            <button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => refresh().catch((err) => setMessage(err.message))}>
              Refresh
            </button>
            {message && <span className="rounded-2xl bg-purple-50 px-4 py-3 text-purple-800">{message}</span>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Total", summary?.total ?? 0],
            ["Active", summary?.active ?? 0],
            ["Consent", summary?.pendingConsent ?? 0],
            ["Dropped", summary?.dropped ?? 0],
            ["Links sent", summary?.byStatus?.link_sent ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl bg-white p-5 border border-[#eadfd5]">
              <p className="text-sm text-[#8b7a73]">{label}</p>
              <p className="mt-1 text-3xl font-black">{String(value)}</p>
            </div>
          ))}
        </div>

        <nav className="mt-5 flex flex-wrap gap-2">
          {["users", "invites", "consent", "organizations", "tiers", "communications", "analytics"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-5 py-3 font-bold ${activeTab === tab ? "bg-purple-700 text-white" : "bg-white text-purple-700 border border-purple-100"}`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {activeTab === "users" && (
          <section className="mt-5 rounded-[2rem] bg-white p-5 border border-[#eadfd5]">
            <div className="grid gap-3 md:grid-cols-4">
              {[
                ["entry_point", entryPoints],
                ["user_type", userTypes],
                ["status", statuses],
                ["tier", ["", ...tiers]],
              ].map(([key, values]) => (
                <select
                  key={key as string}
                  className="rounded-2xl border border-[#e4d8ce] px-4 py-3"
                  value={(filters as any)[key as string]}
                  onChange={(e) => setFilters((prev) => ({ ...prev, [key as string]: e.target.value }))}
                >
                  {(values as string[]).map((value) => <option key={value} value={value}>{value || key}</option>)}
                </select>
              ))}
            </div>
            <IntakeTable users={users} onSendLink={sendLink} onTriggerConsent={triggerConsent} />
          </section>
        )}

        {activeTab === "invites" && (
          <section className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
            <div className="rounded-[2rem] bg-white p-5 border border-[#eadfd5]">
              <h2 className="font-serif text-3xl">Create intake</h2>
              <p className="mt-2 text-sm text-[#7d6b65]">Basic profile details, matching the user settings form.</p>
              <div className="mt-4 grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Nombre" required>
                    <input className="w-full rounded-2xl border px-4 py-3" value={newIntake.first_name} onChange={(e) => setNewIntake({ ...newIntake, first_name: e.target.value })} />
                  </Field>
                  <Field label="Apellidos" required>
                    <input className="w-full rounded-2xl border px-4 py-3" value={newIntake.last_name} onChange={(e) => setNewIntake({ ...newIntake, last_name: e.target.value })} />
                  </Field>
                </div>
                <Field label="Nombre preferido (como le llama VYVA)" optional>
                  <input className="w-full rounded-2xl border px-4 py-3" value={newIntake.preferred_name} onChange={(e) => setNewIntake({ ...newIntake, preferred_name: e.target.value })} />
                </Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Fecha de nacimiento" optional>
                    <input className="w-full rounded-2xl border px-4 py-3" type="date" value={newIntake.date_of_birth} onChange={(e) => setNewIntake({ ...newIntake, date_of_birth: e.target.value })} />
                  </Field>
                  <Field label="Género" optional>
                    <select className="w-full rounded-2xl border px-4 py-3" value={newIntake.gender} onChange={(e) => setNewIntake({ ...newIntake, gender: e.target.value })}>
                      <option value="prefer_not_to_say">Prefiero no decirlo</option>
                      <option value="female">Femenino</option>
                      <option value="male">Masculino</option>
                      <option value="non_binary">No binario</option>
                    </select>
                  </Field>
                </div>
                <Field label="Número de teléfono" required>
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <select className="rounded-2xl border px-3 py-3" value={newIntake.country_code} onChange={(e) => setNewIntake({ ...newIntake, country_code: e.target.value })}>
                      {countryCodeOptions.map((value) => <option key={value}>{value}</option>)}
                    </select>
                    <input className="rounded-2xl border px-4 py-3" placeholder="612 345 678" value={newIntake.phone} onChange={(e) => setNewIntake({ ...newIntake, phone: e.target.value })} />
                  </div>
                </Field>
                <Field label="WhatsApp (si es diferente)" optional>
                  <input className="w-full rounded-2xl border px-4 py-3" placeholder="Dejar en blanco si es el mismo" value={newIntake.whatsapp} onChange={(e) => setNewIntake({ ...newIntake, whatsapp: e.target.value })} />
                </Field>
                <Field label="Correo electrónico" optional>
                  <input className="w-full rounded-2xl border px-4 py-3" placeholder="tu@correo.com" value={newIntake.email} onChange={(e) => setNewIntake({ ...newIntake, email: e.target.value })} />
                </Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Idioma" optional>
                    <select className="w-full rounded-2xl border px-4 py-3" value={newIntake.language} onChange={(e) => setNewIntake({ ...newIntake, language: e.target.value })}>
                      {languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Zona horaria" optional>
                    <select className="w-full rounded-2xl border px-4 py-3" value={newIntake.timezone} onChange={(e) => setNewIntake({ ...newIntake, timezone: e.target.value })}>
                      {timezoneOptions.map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </Field>
                </div>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.user_type} onChange={(e) => setNewIntake({ ...newIntake, user_type: e.target.value })}>
                  {userTypes.filter(Boolean).map((v) => <option key={v}>{v}</option>)}
                </select>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.entry_point} onChange={(e) => setNewIntake({ ...newIntake, entry_point: e.target.value })}>
                  {entryPoints.filter(Boolean).map((v) => <option key={v}>{v}</option>)}
                </select>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.tier} onChange={(e) => setNewIntake({ ...newIntake, tier: e.target.value })}>
                  {tiers.map((v) => <option key={v}>{v}</option>)}
                </select>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.organization_id} onChange={(e) => setNewIntake({ ...newIntake, organization_id: e.target.value })}>
                  <option value="">No organization</option>
                  {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={!newIntake.first_name.trim() || !newIntake.last_name.trim() || !newIntake.phone.trim()} onClick={createIntake}>Create</button>
              </div>
            </div>
            <div className="rounded-[2rem] bg-white p-5 border border-[#eadfd5]">
              <h2 className="font-serif text-3xl">Recent lifecycle users</h2>
              <IntakeTable users={users.slice(0, 8)} onSendLink={sendLink} onTriggerConsent={triggerConsent} compact />
            </div>
          </section>
        )}

        {activeTab === "consent" && (
          <section className="mt-5 rounded-[2rem] bg-white p-5 border border-[#eadfd5]">
            <h2 className="font-serif text-3xl">Consent queue</h2>
            <div className="mt-4 grid gap-3">
              {consentAttempts.map((attempt) => (
                <div key={attempt.id} className="rounded-3xl border border-[#eadfd5] p-4">
                  <p className="font-bold">{attempt.intake?.name ?? "Unknown intake"} · attempt {attempt.attempt_number}</p>
                  <p className="text-sm text-[#7d6b65]">{attempt.status} · {attempt.channel} · {new Date(attempt.created_at).toLocaleString()}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["approved", "rejected", "no_answer"].map((status) => (
                      <button key={status} className="rounded-full border px-4 py-2 font-bold" onClick={() => markConsent(attempt, status)}>
                        Mark {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "organizations" && (
          <section className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
            <div className="rounded-[2rem] bg-white p-5 border border-[#eadfd5]">
              <h2 className="font-serif text-3xl">New organization</h2>
              <input className="mt-4 w-full rounded-2xl border px-4 py-3" placeholder="Organization name" value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} />
              <select className="mt-3 w-full rounded-2xl border px-4 py-3" value={newOrg.default_tier} onChange={(e) => setNewOrg({ ...newOrg, default_tier: e.target.value })}>
                {tiers.map((v) => <option key={v}>{v}</option>)}
              </select>
              <button className="mt-3 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={createOrg}>Create organization</button>
            </div>
            <div className="rounded-[2rem] bg-white p-5 border border-[#eadfd5]">
              {organizations.map((org) => (
                <div key={org.id} className="mb-3 rounded-3xl border p-4">
                  <p className="font-bold">{org.name}</p>
                  <p className="text-sm text-[#7d6b65]">{org.slug} · default tier: {org.default_tier}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "tiers" && (
          <section className="mt-5 rounded-[2rem] bg-white p-5 border border-[#eadfd5]">
            <h2 className="font-serif text-3xl">Tier bundles</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {tiers.map((tier) => (
                <div key={tier} className="rounded-3xl border p-4">
                  <p className="text-xl font-black capitalize">{tier}</p>
                  <p className="mt-2 text-sm text-[#7d6b65]">Controls voice, health, concierge and caregiver entitlements.</p>
                  <button className="mt-4 rounded-full bg-purple-50 px-4 py-2 font-bold text-purple-700" onClick={() => saveTier(tier)}>Save default bundle</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "communications" && (
          <section className="mt-5 rounded-[2rem] bg-white p-5 border border-[#eadfd5]">
            <h2 className="font-serif text-3xl">Communication log</h2>
            <div className="mt-4 grid gap-3">
              {communications.map((item) => (
                <div key={item.id} className="rounded-3xl border p-4">
                  <p className="font-bold">{item.purpose} · {item.channel}</p>
                  <p className="text-sm text-[#7d6b65]">{item.recipient} · {item.status} · {new Date(item.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "analytics" && (
          <section className="mt-5 rounded-[2rem] bg-white p-5 border border-[#eadfd5]">
            <h2 className="font-serif text-3xl">Analytics snapshot</h2>
            <pre className="mt-4 overflow-auto rounded-3xl bg-[#2f2135] p-5 text-sm text-white">{JSON.stringify(summary, null, 2)}</pre>
          </section>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  required,
  optional,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
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

function IntakeTable({
  users,
  onSendLink,
  onTriggerConsent,
  compact = false,
}: {
  users: Intake[];
  onSendLink: (intake: Intake) => void;
  onTriggerConsent: (intake: Intake) => void;
  compact?: boolean;
}) {
  return (
    <div className="mt-5 overflow-auto">
      <table className="w-full min-w-[900px] border-separate border-spacing-y-2">
        <thead>
          <tr className="text-left text-sm uppercase tracking-wide text-[#8b7a73]">
            <th>Name</th>
            {!compact && <th>Phone</th>}
            <th>Type</th>
            <th>Entry</th>
            <th>Tier</th>
            <th>Status</th>
            <th>Consent</th>
            <th>Org</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="rounded-2xl bg-[#fbf8f5]">
              <td className="rounded-l-2xl px-3 py-3 font-bold">{user.name}</td>
              {!compact && <td className="px-3 py-3">{user.phone}</td>}
              <td className="px-3 py-3">{user.user_type}</td>
              <td className="px-3 py-3">{user.entry_point}</td>
              <td className="px-3 py-3">{user.tier}</td>
              <td className="px-3 py-3">{user.status}</td>
              <td className="px-3 py-3">{user.consent_status}</td>
              <td className="px-3 py-3">{user.organization_name ?? "-"}</td>
              <td className="rounded-r-2xl px-3 py-3">
                <div className="flex gap-2">
                  <button className="rounded-full bg-purple-700 px-3 py-2 text-sm font-bold text-white" onClick={() => onSendLink(user)}>
                    Send link
                  </button>
                  {user.user_type === "family" && (
                    <button className="rounded-full border px-3 py-2 text-sm font-bold" onClick={() => onTriggerConsent(user)}>
                      Consent
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
