import { useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Check,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import {
  trustedHelpCoverageOptions,
  type ProviderCoverage,
  type TrustedHelpPartner,
  type TrustedHelpServiceId,
  useTrustedHelpPartners,
} from "@/data/trustedHelpPartners";

const serviceChoices: Array<{ id: TrustedHelpServiceId; label: string; detail: string }> = [
  { id: "groceries", label: "Groceries", detail: "Food, water, household, meals" },
  { id: "home-care", label: "Home Care", detail: "Repairs, cleaning, safety fixes" },
  { id: "transport", label: "Transport", detail: "Taxi and assisted rides" },
  { id: "wellness", label: "Wellness", detail: "Hair, nails, foot care, massage" },
  { id: "other", label: "Other", detail: "Special concierge partner" },
];

const brandStyles = [
  { bg: "#E0F2FE", fg: "#0369A1", border: "#BAE6FD" },
  { bg: "#ECFDF5", fg: "#047857", border: "#BBF7D0" },
  { bg: "#F5F3FF", fg: "#6B21A8", border: "#DDD6FE" },
  { bg: "#FFF7ED", fg: "#B45309", border: "#FED7AA" },
  { bg: "#FDF2F8", fg: "#BE185D", border: "#FBCFE8" },
];

function serviceLabel(serviceId: TrustedHelpServiceId) {
  return serviceChoices.find((service) => service.id === serviceId)?.label ?? serviceId;
}

function partnerDraft(partner?: TrustedHelpPartner): TrustedHelpPartner {
  if (partner) return JSON.parse(JSON.stringify(partner)) as TrustedHelpPartner;

  const style = brandStyles[0];
  return {
    id: `partner-${Date.now()}`,
    name: "",
    service: "groceries",
    label: "",
    method: "",
    payment: "Ask before payment",
    coverage: ["Food"],
    enabled: true,
    logo: {
      text: "",
      bg: style.bg,
      fg: style.fg,
      border: style.border,
    },
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-black text-[#4f4352]">{label}</span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <input
      className="min-h-11 rounded-[12px] border border-[#eadfd5] bg-white px-3 text-sm font-semibold text-[#2f2135] outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      data-testid={testId}
    />
  );
}

function SelectInput({
  value,
  onChange,
  children,
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <select
      className="min-h-11 rounded-[12px] border border-[#eadfd5] bg-white px-3 text-sm font-semibold text-[#2f2135] outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      data-testid={testId}
    >
      {children}
    </select>
  );
}

function PartnerLogo({ partner }: { partner: TrustedHelpPartner }) {
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border text-sm font-black"
      style={{ background: partner.logo.bg, borderColor: partner.logo.border, color: partner.logo.fg }}
      data-testid={`admin-partner-logo-${partner.id}`}
    >
      {partner.logo.imageUrl ? <img src={partner.logo.imageUrl} alt="" className="h-full w-full object-contain p-1.5" /> : partner.logo.text}
    </span>
  );
}

function normalizeDraft(draft: TrustedHelpPartner): TrustedHelpPartner {
  const name = draft.name.trim();
  const logoText = draft.logo.text.trim() || name.slice(0, 5);
  return {
    ...draft,
    name,
    label: draft.label.trim(),
    method: draft.method.trim(),
    payment: draft.payment.trim(),
    coverage: draft.service === "groceries" ? draft.coverage ?? [] : undefined,
    logo: {
      ...draft.logo,
      text: logoText,
      imageUrl: draft.logo.imageUrl?.trim() || undefined,
    },
  };
}

export default function TrustedHelpPartnersAdminPage() {
  const [partners, partnerActions] = useTrustedHelpPartners({ admin: true });
  const [serviceFilter, setServiceFilter] = useState<TrustedHelpServiceId | "all">("all");
  const [draft, setDraft] = useState<TrustedHelpPartner | null>(null);
  const [message, setMessage] = useState("");

  const filteredPartners = useMemo(() => (
    serviceFilter === "all" ? partners : partners.filter((partner) => partner.service === serviceFilter)
  ), [partners, serviceFilter]);

  const partnerCounts = useMemo(() => serviceChoices.map((service) => ({
    ...service,
    count: partners.filter((partner) => partner.service === service.id && partner.enabled).length,
  })), [partners]);

  const updateDraft = (updates: Partial<TrustedHelpPartner>) => {
    setDraft((current) => (current ? { ...current, ...updates } : current));
  };

  const saveDraft = async () => {
    if (!draft?.name.trim()) {
      setMessage("Add a partner name first.");
      return;
    }

    const nextDraft = normalizeDraft(draft);
    try {
      const saved = await partnerActions.savePartner(nextDraft);
      setDraft(null);
      setMessage(`${saved.name} saved.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save partner.");
    }
  };

  const togglePartner = async (partnerId: string) => {
    const partner = partners.find((item) => item.id === partnerId);
    if (!partner) return;

    try {
      const saved = await partnerActions.savePartner({ ...partner, enabled: !partner.enabled });
      setMessage(`${saved.name} ${saved.enabled ? "shown" : "hidden"}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update partner.");
    }
  };

  const deletePartner = async (partnerId: string) => {
    try {
      await partnerActions.deletePartner(partnerId);
      if (draft?.id === partnerId) setDraft(null);
      setMessage("Partner removed.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not remove partner.");
    }
  };

  const toggleCoverage = (coverage: ProviderCoverage) => {
    setDraft((current) => {
      if (!current) return current;
      const currentCoverage = current.coverage ?? [];
      const nextCoverage = currentCoverage.includes(coverage)
        ? currentCoverage.filter((item) => item !== coverage)
        : [...currentCoverage, coverage];
      return { ...current, coverage: nextCoverage };
    });
  };

  return (
    <main className="min-h-screen bg-[#f9f4ee] px-4 py-5 text-[#2f2135] sm:px-6 lg:px-8" data-testid="trusted-help-partners-admin">
      <div className="mx-auto grid max-w-6xl gap-4">
        <AdminPageHeader
          title="Trusted Help Partners"
          subtitle="Add, edit, disable, or remove the VYVA partners that appear in the Concierge trusted-help setup."
        >
          <button
            type="button"
            onClick={async () => {
              try {
                await partnerActions.resetPartners();
                setDraft(null);
                setMessage("Default partners restored.");
              } catch (err) {
                setMessage(err instanceof Error ? err.message : "Could not restore defaults.");
              }
            }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-bold text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700"
            data-testid="button-admin-partners-reset"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Reset defaults
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(partnerDraft());
              setMessage("");
            }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] bg-[#6d28d9] px-3 text-sm font-bold text-white transition hover:bg-[#5b21b6]"
            data-testid="button-admin-partner-add"
          >
            <Plus size={16} aria-hidden="true" />
            Add partner
          </button>
        </AdminPageHeader>
        <AdminMenu />

        <section className="grid gap-3 rounded-[16px] border border-[#eadfd5] bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
          {partnerCounts.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => setServiceFilter(service.id)}
              aria-pressed={serviceFilter === service.id}
              className={`min-h-[90px] rounded-[14px] border p-3 text-left transition ${
                serviceFilter === service.id ? "border-purple-300 bg-purple-50" : "border-[#eadfd5] bg-[#fffaf4]"
              }`}
              data-testid={`button-admin-partners-filter-${service.id}`}
            >
              <span className="text-2xl font-black text-[#2f2135]">{service.count}</span>
              <span className="mt-2 block text-sm font-black">{service.label}</span>
              <span className="sr-only">{service.detail}</span>
            </button>
          ))}
        </section>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <section className="rounded-[16px] border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black">Partner catalog</h2>
                <p className="text-sm font-semibold text-[#7d6b65]">
                  Only enabled partners appear to users, and only for their matching service.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setServiceFilter("all")}
                className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-bold text-[#5b4a46]"
                data-testid="button-admin-partners-filter-all"
              >
                Show all
              </button>
            </div>

            {message ? (
              <p className="mt-3 rounded-[12px] bg-[#ecfdf5] px-3 py-2 text-sm font-bold text-[#047857]" data-testid="admin-partners-message">
                {message}
              </p>
            ) : null}
            {partnerActions.error ? (
              <p className="mt-3 rounded-[12px] bg-[#fff7ed] px-3 py-2 text-sm font-bold text-[#b45309]" data-testid="admin-partners-source">
                Using local fallback. Backend says: {partnerActions.error}
              </p>
            ) : (
              <p className="mt-3 rounded-[12px] bg-[#eff6ff] px-3 py-2 text-sm font-bold text-[#1d4ed8]" data-testid="admin-partners-source">
                Source: {partnerActions.source === "api" ? "backend database" : "local fallback"}
              </p>
            )}

            <div className="mt-4 grid gap-3" data-testid="admin-partners-list">
              {filteredPartners.length > 0 ? filteredPartners.map((partner) => (
                <article
                  key={partner.id}
                  className={`rounded-[14px] border p-3 ${partner.enabled ? "border-[#eadfd5] bg-[#fffaf4]" : "border-[#e5e7eb] bg-[#f8fafc] opacity-75"}`}
                  data-testid={`card-admin-partner-${partner.id}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <PartnerLogo partner={partner} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black leading-tight">{partner.name}</h3>
                          <span className={`rounded-full px-2 py-1 text-xs font-black ${partner.enabled ? "bg-[#ecfdf5] text-[#047857]" : "bg-[#fee2e2] text-[#b91c1c]"}`}>
                            {partner.enabled ? "Enabled" : "Hidden"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                          {serviceLabel(partner.service)} · {partner.label} · {partner.method}
                        </p>
                        {partner.coverage?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5" data-testid={`coverage-admin-partner-${partner.id}`}>
                            {partner.coverage.map((item) => (
                              <span key={item} className="rounded-full bg-[#ecfdf5] px-2.5 py-1 text-xs font-black text-[#047857]">
                                {item}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:w-[240px]">
                      <button
                        type="button"
                        onClick={() => togglePartner(partner.id)}
                        className="inline-flex min-h-10 items-center justify-center gap-1 rounded-[10px] border border-[#eadfd5] bg-white px-2 text-xs font-black"
                        data-testid={`button-admin-partner-toggle-${partner.id}`}
                      >
                        <BadgeCheck size={15} aria-hidden="true" />
                        {partner.enabled ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(partnerDraft(partner));
                          setMessage("");
                        }}
                        className="inline-flex min-h-10 items-center justify-center gap-1 rounded-[10px] border border-[#eadfd5] bg-white px-2 text-xs font-black"
                        data-testid={`button-admin-partner-edit-${partner.id}`}
                      >
                        <Pencil size={15} aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePartner(partner.id)}
                        className="inline-flex min-h-10 items-center justify-center gap-1 rounded-[10px] border border-red-100 bg-red-50 px-2 text-xs font-black text-red-700"
                        data-testid={`button-admin-partner-delete-${partner.id}`}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              )) : (
                <p className="rounded-[14px] border border-dashed border-[#d6c9c1] bg-[#fffaf4] p-4 text-sm font-bold text-[#7d6b65]">
                  No partners for this filter.
                </p>
              )}
            </div>
          </section>

          <aside className="rounded-[16px] border border-[#eadfd5] bg-white p-4 shadow-sm">
            {draft ? (
              <div className="grid gap-4" data-testid="form-admin-partner">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-700">Partner details</p>
                  <h2 className="mt-1 text-xl font-black">{draft.name.trim() ? draft.name : "New partner"}</h2>
                </div>

                <Field label="Name">
                  <TextInput
                    value={draft.name}
                    onChange={(value) => updateDraft({ name: value, logo: { ...draft.logo, text: draft.logo.text || value.slice(0, 5) } })}
                    placeholder="Mercadona"
                    testId="input-admin-partner-name"
                  />
                </Field>

                <Field label="Service">
                  <SelectInput
                    value={draft.service}
                    onChange={(value) => updateDraft({
                      service: value as TrustedHelpServiceId,
                      coverage: value === "groceries" ? draft.coverage ?? ["Food"] : undefined,
                    })}
                    testId="select-admin-partner-service"
                  >
                    {serviceChoices.map((service) => (
                      <option key={service.id} value={service.id}>{service.label}</option>
                    ))}
                  </SelectInput>
                </Field>

                <Field label="What they do">
                  <TextInput
                    value={draft.label}
                    onChange={(value) => updateDraft({ label: value })}
                    placeholder="Groceries"
                    testId="input-admin-partner-label"
                  />
                </Field>

                <Field label="Contact or booking method">
                  <TextInput
                    value={draft.method}
                    onChange={(value) => updateDraft({ method: value })}
                    placeholder="Online delivery"
                    testId="input-admin-partner-method"
                  />
                </Field>

                <Field label="Payment rule">
                  <TextInput
                    value={draft.payment}
                    onChange={(value) => updateDraft({ payment: value })}
                    placeholder="Ask before payment"
                    testId="input-admin-partner-payment"
                  />
                </Field>

                {draft.service === "groceries" ? (
                  <div>
                    <p className="mb-2 text-sm font-black text-[#4f4352]">Coverage</p>
                    <div className="grid grid-cols-2 gap-2" data-testid="admin-partner-coverage">
                      {trustedHelpCoverageOptions.map((coverage) => {
                        const active = draft.coverage?.includes(coverage) ?? false;
                        return (
                          <button
                            key={coverage}
                            type="button"
                            onClick={() => toggleCoverage(coverage)}
                            aria-pressed={active}
                            className={`min-h-10 rounded-[10px] border px-3 text-sm font-black ${
                              active ? "border-[#10b981] bg-[#ecfdf5] text-[#047857]" : "border-[#eadfd5] bg-white text-[#7d6b65]"
                            }`}
                            data-testid={`button-admin-partner-coverage-${coverage.toLowerCase()}`}
                          >
                            {coverage}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 rounded-[14px] bg-[#fffaf4] p-3">
                  <Field label="Logo text">
                    <TextInput
                      value={draft.logo.text}
                      onChange={(value) => updateDraft({ logo: { ...draft.logo, text: value } })}
                      placeholder="M"
                      testId="input-admin-partner-logo-text"
                    />
                  </Field>
                  <Field label="Logo image URL">
                    <TextInput
                      value={draft.logo.imageUrl ?? ""}
                      onChange={(value) => updateDraft({ logo: { ...draft.logo, imageUrl: value } })}
                      placeholder="https://..."
                      testId="input-admin-partner-logo-url"
                    />
                  </Field>
                </div>

                <label className="flex min-h-12 items-center gap-3 rounded-[12px] border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-black">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) => updateDraft({ enabled: event.target.checked })}
                    data-testid="checkbox-admin-partner-enabled"
                  />
                  Show this partner to users
                </label>

                <button
                  type="button"
                  onClick={saveDraft}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-[#0f766e] px-4 text-sm font-black text-white transition hover:bg-[#115e59]"
                  data-testid="button-admin-partner-save"
                >
                  <Save size={17} aria-hidden="true" />
                  Save partner
                </button>
              </div>
            ) : (
              <div className="grid gap-4 rounded-[14px] bg-[#fffaf4] p-4" data-testid="empty-admin-partner-form">
                <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-purple-50 text-purple-700">
                  <BadgeCheck size={24} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-xl font-black">Manage from here</h2>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-[#7d6b65]">
                    Add a partner, or edit an existing one. The Trusted Help setup reads this catalog and hides the partner option when a service has none.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft(partnerDraft())}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-[#6d28d9] px-4 text-sm font-black text-white transition hover:bg-[#5b21b6]"
                  data-testid="button-admin-partner-empty-add"
                >
                  <Plus size={17} aria-hidden="true" />
                  Add partner
                </button>
              </div>
            )}
          </aside>
        </div>

        <section className="rounded-[16px] border border-[#d6f5ea] bg-[#ecfdf5] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#047857]">
              <Check size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-black">User-facing rule</h2>
              <p className="mt-1 text-sm font-bold leading-relaxed text-[#35665b]">
                VYVA Partner appears only when the selected service has at least one enabled partner in this catalog.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
