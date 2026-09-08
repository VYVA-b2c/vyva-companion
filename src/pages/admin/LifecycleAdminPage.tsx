import { AlertTriangle, CheckCircle2, Copy, History, Send, Upload, UserRound, UsersRound, XCircle } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";
import {
  AnalyticsSection,
  CommunicationsSection,
  Field,
  HomeCardsSection,
  IntakeTable,
  TierSection,
  UserDetailModal,
} from "./lifecycle/components";
import {
  type BulkPreviewResponse,
  type CareTeamInvitation,
  type CaregiverInviteDraft,
  type Communication,
  type CommunicationProviderStatus,
  type ConsentAttempt,
  type HomePlanCardAdmin,
  type Intake,
  type JsonRecord,
  type LoginMapping,
  type Organization,
  type ScheduledEvent,
  type ScheduledSupport,
  type SubscriptionPlanAdmin,
  type UserDetail,
  caregiverInviteWithProfileDefaults,
  cleanLabel,
  consentStatusLabel,
  contactNumberValue,
  countryCodeOptions,
  csvToRows,
  defaultCaregiverInviteDraft,
  emailAddressValue,
  emptyIntakeForm,
  emptyScheduledEvent,
  entryPointLabel,
  entryPoints,
  isVisibleLifecycleUser,
  lifecycleStatusLabel,
  languageOptions,
  looksLikeContactEmail,
  profileNameValue,
  statuses,
  stringValue,
  tierLabel,
  tiers,
  timezoneOptions,
  userTypeLabel,
  userTypes,
} from "./lifecycle/shared";

type SignupShareResult = {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  error?: string;
};

type SignupInviteType = "elder" | "caregiver";

type SignupShareNotice = {
  tone: "success" | "warning" | "error";
  title: string;
  details: string[];
};

type AdminActionNotice = {
  tone: "success" | "warning" | "error";
  label: string;
  title: string;
  details: string[];
  secondaryAction?: {
    label: string;
    busyLabel?: string;
    busyKey?: string;
    onClick: () => void;
  };
};

type AdminActionLogEntry = Omit<AdminActionNotice, "secondaryAction"> & {
  id: string;
  createdAt: string;
};

type BulkUserAction = "disable" | "delete_hide" | "restore" | "assign_org" | "change_tier" | "resend_invite";

type SchemaHealth = {
  ok: boolean;
  status: "healthy" | "warning" | "error";
  checked_at?: string;
  required_count?: number;
  missing_count?: number;
  missing?: Array<{
    table: string;
    column: string;
    label?: string;
  }>;
  error?: string;
};

type SignupShareRecipient = {
  name?: string;
  recipient: string;
};

type SupportScheduleDraft = {
  frequency_type: string;
  days_of_week: string[];
  times_of_day: string[];
  timezone: string;
  preferred_language: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
};

type LifecycleTabId =
  | "users"
  | "quality"
  | "share"
  | "forms"
  | "organizations"
  | "consent"
  | "tiers"
  | "communications"
  | "analytics";

const adminTabs: Array<{ id: LifecycleTabId; label: string }> = [
  { id: "users", label: "Users" },
  { id: "quality", label: "Data Quality" },
  { id: "share", label: "Share Invite" },
  { id: "forms", label: "Forms" },
  { id: "organizations", label: "Organizations" },
  { id: "consent", label: "Consent" },
  { id: "tiers", label: "Tiers" },
  { id: "communications", label: "Communications" },
  { id: "analytics", label: "Analytics" },
];

function lifecycleContactDigits(user: Intake) {
  const contact = contactNumberValue(user.login_phone) || contactNumberValue(user.profile_phone) || contactNumberValue(user.phone);
  const digits = contact?.replace(/\D/g, "") ?? "";
  return digits.length >= 6 ? digits : "";
}

function lifecycleHasEmailIdentityLeak(user: Intake) {
  return looksLikeContactEmail(user.name)
    || looksLikeContactEmail(user.phone)
    || looksLikeContactEmail(user.profile_name);
}

function lifecycleHasTierMismatch(user: Intake) {
  return Boolean(
    user.intake_tier && user.tier && user.intake_tier !== user.tier,
  );
}

function duplicatePhoneGroups(users: Intake[]) {
  const groups = new Map<string, Intake[]>();
  users.forEach((user) => {
    const digits = lifecycleContactDigits(user);
    if (!digits) return;
    groups.set(digits, [...(groups.get(digits) ?? []), user]);
  });
  return Array.from(groups.entries())
    .map(([digits, groupUsers]) => ({ digits, users: groupUsers }))
    .filter((group) => group.users.length > 1);
}

function normalizeOrganizationLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function slugifyOrganizationLabel(value: string) {
  return normalizeOrganizationLabel(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function normalizedContactEmail(value: unknown) {
  return typeof value === "string" && value.includes("@") ? value.trim().toLowerCase() : "";
}

function normalizedContactPhone(value: unknown) {
  return typeof value === "string" ? value.replace(/[^\d+]/g, "") : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function recordValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function profileGenderValue(consent: unknown) {
  const identity = recordValue(recordValue(consent).identity);
  return stringValue(identity.gender) ?? "prefer_not";
}

function userDetailDraft(detailProfile: JsonRecord, detailIntake: Intake, fallbackIntake: Intake, primaryMapping?: LoginMapping): JsonRecord {
  const profileTier = stringValue(detailProfile.subscription_tier);
  return {
    full_name: profileNameValue(detailProfile.full_name, detailProfile.preferred_name, detailIntake.name, fallbackIntake.name),
    preferred_name: profileNameValue(detailProfile.preferred_name),
    date_of_birth: stringValue(detailProfile.date_of_birth) ?? "",
    email: emailAddressValue(detailProfile.email, detailIntake.email, fallbackIntake.email, primaryMapping?.login_email, fallbackIntake.login_email, detailIntake.phone, fallbackIntake.phone),
    phone_number: contactNumberValue(detailProfile.phone_number, detailIntake.profile_phone, fallbackIntake.profile_phone, primaryMapping?.login_phone, fallbackIntake.login_phone, detailIntake.phone, fallbackIntake.phone),
    whatsapp_number: contactNumberValue(detailProfile.whatsapp_number),
    country_code: stringValue(detailProfile.country_code) ?? "ES",
    gender: profileGenderValue(detailProfile.data_sharing_consent),
    language: stringValue(detailProfile.language) ?? "es",
    timezone: stringValue(detailProfile.timezone) ?? "Europe/Madrid",
    caregiver_name: stringValue(detailProfile.caregiver_name) ?? "",
    caregiver_contact: stringValue(detailProfile.caregiver_contact) ?? "",
    tier: profileTier ?? fallbackIntake.tier,
    organization_id: detailIntake.organization_id ?? fallbackIntake.organization_id ?? "",
  };
}

function numberValue(value: unknown, fallback: unknown = 0) {
  const number = typeof value === "number" ? value : Number(value);
  const fallbackNumber = typeof fallback === "number" ? fallback : Number(fallback);
  return Number.isFinite(number) ? number : Number.isFinite(fallbackNumber) ? fallbackNumber : 0;
}

function shouldKeepAfterDelete(user: Intake, deletedIntake: Intake, result: JsonRecord) {
  const scope = result.identity_scope && typeof result.identity_scope === "object" ? result.identity_scope as JsonRecord : {};
  const deletedIntakeIds = new Set([
    deletedIntake.id,
    typeof result.intake_id === "string" ? result.intake_id : "",
    ...stringArray(result.hidden_intake_ids),
    ...stringArray(scope.intake_ids),
  ].filter(Boolean));
  if (deletedIntakeIds.has(user.id)) return false;

  const deletedIds = new Set([
    typeof result.user_id === "string" ? result.user_id : "",
    deletedIntake.user_id ?? "",
    deletedIntake.elder_user_id ?? "",
    deletedIntake.family_user_id ?? "",
    ...stringArray(scope.profile_or_login_ids),
  ].filter(Boolean));
  if ([user.user_id, user.elder_user_id, user.family_user_id].some((id) => id && deletedIds.has(id))) return false;

  const deletedEmails = new Set([
    normalizedContactEmail(deletedIntake.email),
    normalizedContactEmail(deletedIntake.login_email),
    normalizedContactEmail(deletedIntake.profile_email),
    ...stringArray(scope.emails).map(normalizedContactEmail),
  ].filter(Boolean));
  if ([user.email, user.login_email, user.profile_email, user.phone, user.login_phone, user.profile_phone]
    .some((value) => deletedEmails.has(normalizedContactEmail(value)))) return false;

  const deletedPhones = new Set([
    normalizedContactPhone(deletedIntake.phone),
    normalizedContactPhone(deletedIntake.login_phone),
    normalizedContactPhone(deletedIntake.profile_phone),
    ...stringArray(scope.phones).map(normalizedContactPhone),
  ].filter(Boolean));
  if ([user.phone, user.login_phone, user.profile_phone]
    .some((value) => deletedPhones.has(normalizedContactPhone(value)))) return false;

  return true;
}

function deleteNoticeFor(intake: Intake, result: JsonRecord): AdminActionNotice {
  const cleanupErrors = stringArray(result.cleanup_errors);
  if (cleanupErrors.length > 0) {
    return {
      tone: "warning",
      label: "Removed",
      title: `${intake.name} was removed from Users.`,
      details: [
        "The user is hidden from the Users table and protected from backfill.",
        "App access was not changed. Use Disable app access separately if needed.",
      ],
    };
  }

  return {
    tone: "success",
    label: "Removed",
    title: `${intake.name} was removed from Users.`,
    details: [
      "The lifecycle row is hidden and protected from backfill.",
      "App access was not changed. Use Disable app access separately if needed.",
    ],
  };
}

function loginAccountDeleteNoticeFor(intake: Intake, result: JsonRecord): AdminActionNotice {
  const releasedContacts = stringArray(result.released_contacts);
  const disabledProfileIds = stringArray(result.disabled_profile_ids);
  const revokedMembershipCount = numberValue(result.revoked_profile_membership_count);
  const resetInviteCount = numberValue(result.reset_care_team_invite_count);
  const revokedInviteCount = numberValue(result.revoked_senior_invite_count);

  return {
    tone: "warning",
    label: "Deleted",
    title: `${intake.name}'s login account was deleted.`,
    details: [
      releasedContacts.length ? `Released: ${releasedContacts.join(", ")}.` : "Released the login contact.",
      disabledProfileIds.length ? `Closed ${disabledProfileIds.length} owned profile${disabledProfileIds.length === 1 ? "" : "s"}.` : "No owned app profile needed closing.",
      `${revokedMembershipCount} care-team membership${revokedMembershipCount === 1 ? "" : "s"} revoked; ${resetInviteCount + revokedInviteCount} invitation${resetInviteCount + revokedInviteCount === 1 ? "" : "s"} updated.`,
    ],
  };
}

function restoreNoticeFor(intake: Intake, result: JsonRecord): AdminActionNotice {
  const scopeErrors = stringArray(result.scope_errors);
  return {
    tone: scopeErrors.length > 0 ? "warning" : "success",
    label: "Restored",
    title: `${intake.name} was restored to Users.`,
    details: [
      "The lifecycle row is visible again.",
      "App access was not changed.",
      ...(scopeErrors.length ? ["Some identity cleanup checks used a fallback, but the selected row was restored."] : []),
    ],
  };
}

function SchemaHealthBanner({ health }: { health: SchemaHealth | null }) {
  if (!health || health.ok) return null;
  const missing = Array.isArray(health.missing) ? health.missing : [];
  const visibleMissing = missing.slice(0, 6);
  const missingRemainder = Math.max(0, missing.length - visibleMissing.length);
  const title = health.status === "error" ? "Schema check unavailable" : "Database schema needs attention";
  const description = health.status === "error"
    ? health.error ?? "The admin panel could not verify the database shape."
    : `${health.missing_count ?? missing.length} expected field${(health.missing_count ?? missing.length) === 1 ? " is" : "s are"} missing. Some admin actions will use fallbacks until migrations are applied.`;

  return (
    <section className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.08em] text-amber-700">{title}</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed">{description}</p>
        </div>
        {visibleMissing.length > 0 && (
          <div className="flex max-w-2xl flex-wrap gap-2">
            {visibleMissing.map((item) => (
              <span key={`${item.table}.${item.column}`} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800 shadow-sm">
                {item.label ?? item.table}: {item.column}
              </span>
            ))}
            {missingRemainder > 0 && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800 shadow-sm">+{missingRemainder} more</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function adminMessageTone(message: string): AdminActionNotice["tone"] {
  const normalized = message.toLowerCase();
  if (normalized.includes("could not") || normalized.includes("failed") || normalized.includes("error")) return "error";
  if (normalized.includes("no new") || normalized.includes("required") || normalized.includes("supported")) return "warning";
  return "success";
}

function actionToneClasses(tone: AdminActionNotice["tone"]) {
  if (tone === "success") return {
    panel: "border-emerald-100 bg-emerald-50 text-emerald-950",
    badge: "bg-emerald-100 text-emerald-800",
    icon: "text-emerald-700",
  };
  if (tone === "warning") return {
    panel: "border-amber-200 bg-amber-50 text-amber-950",
    badge: "bg-amber-100 text-amber-800",
    icon: "text-amber-700",
  };
  return {
    panel: "border-red-200 bg-red-50 text-red-950",
    badge: "bg-red-100 text-red-700",
    icon: "text-red-700",
  };
}

function ActionToneIcon({ tone, className = "" }: { tone: AdminActionNotice["tone"]; className?: string }) {
  if (tone === "success") return <CheckCircle2 className={className} aria-hidden="true" />;
  if (tone === "warning") return <AlertTriangle className={className} aria-hidden="true" />;
  return <XCircle className={className} aria-hidden="true" />;
}

function AdminActionCenter({
  message,
  notices,
  onDismissMessage,
  onOpenNotice,
  onClearHistory,
}: {
  message: string;
  notices: AdminActionLogEntry[];
  onDismissMessage: () => void;
  onOpenNotice: (notice: AdminActionLogEntry) => void;
  onClearHistory: () => void;
}) {
  if (!message && notices.length === 0) return null;
  const messageTone = message ? adminMessageTone(message) : "success";
  const messageClasses = actionToneClasses(messageTone);

  return (
    <section className="mt-3 rounded-2xl border border-[#eadfd5] bg-white p-3 shadow-sm" aria-label="Admin action feedback">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          {message && (
            <div className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${messageClasses.panel}`} role={messageTone === "error" ? "alert" : "status"} aria-live="polite">
              <ActionToneIcon tone={messageTone} className={`mt-0.5 h-4 w-4 shrink-0 ${messageClasses.icon}`} />
              <p className="min-w-0 flex-1 text-sm font-bold leading-relaxed">{message}</p>
              <button type="button" className="text-xs font-black uppercase tracking-[0.06em] opacity-70 hover:opacity-100" onClick={onDismissMessage}>
                Clear
              </button>
            </div>
          )}
          {notices.length > 0 && (
            <div className="grid gap-2 xl:grid-cols-3">
              {notices.slice(0, 3).map((notice) => {
                const classes = actionToneClasses(notice.tone);
                const time = new Date(notice.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <button
                    key={notice.id}
                    type="button"
                    className={`min-w-0 rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${classes.panel}`}
                    onClick={() => onOpenNotice(notice)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.08em] ${classes.badge}`}>{notice.label}</span>
                      <span className="text-xs font-bold opacity-70">{time}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-black">{notice.title}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {notices.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 rounded-xl bg-[#fbf8f5] px-3 py-2 text-[#5f514b]">
            <History className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-[0.08em]">{notices.length} recent</span>
            <button type="button" className="text-xs font-black text-purple-700 hover:text-purple-900" onClick={onClearHistory}>
              Clear
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

const lifecycleRequestFailedMessage = "Lifecycle request failed. Please refresh and try again.";

function isHtmlErrorResponse(text: string) {
  const normalized = text.trim().toLowerCase();
  return normalized.startsWith("<!doctype html")
    || normalized.startsWith("<html")
    || normalized.includes("<pre>internal server error</pre>");
}

async function readAdminResponse(res: Response, fallback: string) {
  const text = await res.text();
  let data: JsonRecord = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.trim() };
    }
  }

  if (res.ok) return data;

  if (isHtmlErrorResponse(text)) {
    console.error(`[VYVA Admin] ${fallback}`, {
      status: res.status,
      statusText: res.statusText,
      url: res.url,
      body: text,
    });
    throw new Error(fallback);
  }

  const errorMessage = typeof data.error === "string" && data.error
    ? data.error
    : typeof data.message === "string" && data.message
      ? data.message
      : text.trim() || `${fallback} (${res.status})`;
  throw new Error(errorMessage);
}

export default function LifecycleAdminPage() {
  const [activeTab, setActiveTab] = useState<LifecycleTabId>("users");
  const [filters, setFilters] = useState({ entry_point: "", user_type: "", status: "", tier: "" });
  const [peopleSearchInput, setPeopleSearchInput] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [showRemovedUsers, setShowRemovedUsers] = useState(false);
  const [showContactGapsOnly, setShowContactGapsOnly] = useState(false);
  const [summary, setSummary] = useState<JsonRecord | null>(null);
  const [schemaHealth, setSchemaHealth] = useState<SchemaHealth | null>(null);
  const [users, setUsers] = useState<Intake[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlanAdmin[]>([]);
  const [orgFilter, setOrgFilter] = useState<"active" | "archived" | "all">("active");
  const [consentAttempts, setConsentAttempts] = useState<ConsentAttempt[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [communicationProviderStatus, setCommunicationProviderStatus] = useState<CommunicationProviderStatus[]>([]);
  const [message, setMessage] = useState("");
  const [usersLoadError, setUsersLoadError] = useState("");
  const [newIntake, setNewIntake] = useState(emptyIntakeForm);
  const [signupShare, setSignupShare] = useState({
    emails: "",
    whatsapp: "",
    message: "",
    language: "en",
    inviteType: "elder" as SignupInviteType,
  });
  const [sharingSignup, setSharingSignup] = useState(false);
  const [signupShareNotice, setSignupShareNotice] = useState<SignupShareNotice | null>(null);
  const [adminActionNotice, setAdminActionNotice] = useState<AdminActionNotice | null>(null);
  const [adminActionHistory, setAdminActionHistory] = useState<AdminActionLogEntry[]>([]);
  const [copiedSignupLink, setCopiedSignupLink] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: "", default_tier: "free" });
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [orgDraft, setOrgDraft] = useState({ name: "", default_tier: "free" });
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<JsonRecord>({});
  const [caregiverInviteDraft, setCaregiverInviteDraft] = useState<CaregiverInviteDraft>({
    ...defaultCaregiverInviteDraft,
    permissions: { ...defaultCaregiverInviteDraft.permissions },
  });
  const [userDetailMessage, setUserDetailMessage] = useState("");
  const [savingUserDetail, setSavingUserDetail] = useState(false);
  const [sendingCaregiverInvite, setSendingCaregiverInvite] = useState(false);
  const [newEvent, setNewEvent] = useState(emptyScheduledEvent);
  const [bulkOrg, setBulkOrg] = useState<Organization | null>(null);
  const [bulkRows, setBulkRows] = useState<Record<string, string>[]>([]);
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewResponse | null>(null);
  const [sendBulkLinks, setSendBulkLinks] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkUserAction, setBulkUserAction] = useState<BulkUserAction>("disable");
  const [bulkUserTier, setBulkUserTier] = useState("free");
  const [bulkUserOrganizationId, setBulkUserOrganizationId] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/lifecycle${path}`, options);
    return readAdminResponse(res, lifecycleRequestFailedMessage);
  }

  async function rootApi(path: string, options: RequestInit = {}) {
    const res = await apiFetch(path, options);
    return readAdminResponse(res, lifecycleRequestFailedMessage);
  }

  function showActionReceipt(notice: AdminActionNotice) {
    setMessage("");
    setAdminActionNotice(notice);
    const createdAt = new Date().toISOString();
    setAdminActionHistory((current) => [
      {
        tone: notice.tone,
        label: notice.label,
        title: notice.title,
        details: notice.details,
        id: `${Date.now()}-${notice.label}`,
        createdAt,
      },
      ...current,
    ].slice(0, 5));
  }

  function viewCommunicationsAction() {
    return {
      label: "View communications",
      onClick: () => {
        setAdminActionNotice(null);
        setActiveTab("communications");
      },
    };
  }

  async function refresh() {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    if (peopleSearch.trim()) params.set("query", peopleSearch.trim());
    if (showRemovedUsers) params.set("include_removed", "true");
    const requests = [
      { key: "schema-health", label: "schema health", optional: true, load: () => api("/schema-health"), apply: (data: JsonRecord) => setSchemaHealth(data as SchemaHealth) },
      { key: "summary", label: "summary", load: () => api("/summary"), apply: (data: JsonRecord) => setSummary(data) },
      { key: "users", label: "users", load: () => api(`/users?${params.toString()}`), apply: (data: JsonRecord) => {
        const nextUsers = showRemovedUsers ? (data.users ?? []) : (data.users ?? []).filter(isVisibleLifecycleUser);
        const nextUserIds = new Set(nextUsers.map((user: Intake) => user.id));
        setUsers(nextUsers);
        setSelectedUserIds((current) => current.filter((id) => nextUserIds.has(id)));
        setUsersLoadError("");
      } },
      { key: "organizations", label: "organizations", load: () => api("/organizations"), apply: (data: JsonRecord) => setOrganizations(data.organizations ?? []) },
      { key: "consent", label: "consent", load: () => api("/consent"), apply: (data: JsonRecord) => setConsentAttempts(data.attempts ?? []) },
      { key: "communications", label: "communications", load: () => api("/communications"), apply: (data: JsonRecord) => {
        setCommunications(data.communications ?? []);
        setCommunicationProviderStatus(data.provider_status ?? []);
      } },
      { key: "plans", label: "plans", load: () => api("/plans"), apply: (data: JsonRecord) => setPlans(data.plans ?? []) },
    ];
    const results = await Promise.allSettled(requests.map((request) => request.load()));
    const failed: string[] = [];

    results.forEach((result, index) => {
      const request = requests[index];
      if (result.status === "fulfilled") {
        request.apply(result.value);
        return;
      }
      if ("optional" in request && request.optional) {
        if (request.key === "schema-health") {
          setSchemaHealth({
            ok: false,
            status: "error",
            missing: [],
            error: "The admin panel could not verify database schema health.",
          });
        }
        console.error(`[VYVA Admin] Could not load lifecycle ${request.key}`, result.reason);
        return;
      }
      failed.push(request.label);
      if (request.key === "users") {
        setUsersLoadError("Users could not be loaded. The admin API or database is not available.");
      }
      console.error(`[VYVA Admin] Could not load lifecycle ${request.key}`, result.reason);
    });

    if (failed.length) {
      setMessage(`Could not load ${failed.join(", ")}. Other lifecycle data is still shown.`);
      return;
    }

    setMessage((current) => current.startsWith("Could not load ") || current === lifecycleRequestFailedMessage ? "" : current);
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, peopleSearch, showRemovedUsers]);

  useEffect(() => {
    const nextSearch = peopleSearchInput.trim();
    const handle = window.setTimeout(() => {
      setPeopleSearch((current) => current === nextSearch ? current : nextSearch);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [peopleSearchInput]);

  async function createIntake() {
    setMessage("");
    const fullName = `${newIntake.first_name.trim()} ${newIntake.last_name.trim()}`.trim();
    const [callingCode, countryCode = "ES"] = newIntake.country_code.split(" ");
    const phone = `${callingCode} ${newIntake.phone.trim()}`.trim();
    const elderName = `${newIntake.elder_first_name.trim()} ${newIntake.elder_last_name.trim()}`.trim();
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
        elder: newIntake.user_type === "family"
          ? {
            name: elderName,
            phone: newIntake.elder_phone.trim(),
            email: newIntake.elder_email.trim(),
          }
          : undefined,
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
    const createdIntake = data.intake as Intake;
    showActionReceipt({
      tone: "success",
      label: "Created",
      title: `${createdIntake.name} was added to Users.`,
      details: [
        `${entryPointLabel(createdIntake.entry_point ?? newIntake.entry_point)} intake created.`,
        `Tier set to ${tierLabel(createdIntake.tier ?? newIntake.tier)}.`,
        "Send the invite so they can access their account.",
      ],
      secondaryAction: {
        label: "Send invite",
        busyLabel: "Sending...",
        busyKey: `send-invite:${createdIntake.id}`,
        onClick: () => { void sendIntakeInvite(createdIntake); },
      },
    });
    setNewIntake(emptyIntakeForm);
    await refresh();
  }

  async function sendIntakeInvite(intake: Intake) {
    const busyKey = `send-invite:${intake.id}`;
    setBusyAction(busyKey);
    setMessage("");
    try {
      const data = await api(`/intakes/${intake.id}/send-link`, { method: "POST" });
      const communication = recordValue(data.communication);
      const delivery = recordValue(data.delivery);
      const deliveryStatus = stringValue(delivery.status);
      const channel = cleanLabel(stringValue(delivery.channel) ?? stringValue(communication.channel) ?? "invite");
      const recipient = stringValue(delivery.recipient) ?? stringValue(communication.recipient);

      if (deliveryStatus === "failed") {
        showActionReceipt({
          tone: "error",
          label: "Failed",
          title: `Invite failed for ${intake.name}.`,
          details: [
            stringValue(delivery.error) ?? "The invite link was created, but delivery failed.",
          ],
          secondaryAction: viewCommunicationsAction(),
        });
        await refresh();
        return;
      }

      showActionReceipt({
        tone: "success",
        label: "Invite sent",
        title: `Invite sent to ${intake.name}.`,
        details: [
          recipient ? `Secure access link sent by ${channel} to ${recipient}.` : "Secure access link sent.",
        ],
        secondaryAction: viewCommunicationsAction(),
      });
      await refresh();
    } catch (err) {
      showActionReceipt({
        tone: "error",
        label: "Failed",
        title: `Invite failed for ${intake.name}.`,
        details: [err instanceof Error ? err.message : "Could not send the invite link."],
        secondaryAction: viewCommunicationsAction(),
      });
    } finally {
      setBusyAction((current) => current === busyKey ? null : current);
    }
  }

  function compactRecipientName(value: string) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (looksLikeEmailRecipient(normalized) || looksLikePhoneRecipient(normalized)) return undefined;
    return normalized || undefined;
  }

  function looksLikeEmailRecipient(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function looksLikePhoneRecipient(value: string) {
    return value.replace(/\D/g, "").length >= 3;
  }

  function parseInviteRecipients(value: string, looksLikeRecipient: (value: string) => boolean): SignupShareRecipient[] {
    const recipients: SignupShareRecipient[] = [];
    let pendingName: string | undefined;

    function addRecipient(recipient: string, name = pendingName) {
      const trimmedRecipient = recipient.trim();
      if (!trimmedRecipient) return;
      recipients.push({ ...(name ? { name } : {}), recipient: trimmedRecipient });
    }

    value.split(/\n+/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const angleMatch = trimmed.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
      if (angleMatch) {
        const name = compactRecipientName(angleMatch[1]) ?? pendingName;
        addRecipient(angleMatch[2], name);
        return;
      }

      const parts = trimmed.split(/[;,]+/).map((item) => item.trim()).filter(Boolean);
      if (parts.length > 1) {
        if (!looksLikeRecipient(parts[0])) {
          const name = compactRecipientName(parts[0]) ?? pendingName;
          parts.slice(1).forEach((recipient) => addRecipient(recipient, name));
          pendingName = name;
          return;
        }
        parts.forEach((recipient) => addRecipient(recipient, undefined));
        return;
      }

      if (looksLikeRecipient(trimmed)) {
        addRecipient(trimmed);
        return;
      }

      pendingName = compactRecipientName(trimmed.replace(/[;,]+$/g, ""));
    });

    return recipients;
  }

  function emailFromText(value: string) {
    return value.match(/[^\s<,;"]+@[^\s>,;"]+\.[^\s>,;"]+/)?.[0] ?? "";
  }

  function phoneFromText(value: string) {
    return value.match(/(?:\+\d[\d\s().-]{4,}\d|\d[\d\s().-]{4,}\d)/)?.[0].replace(/\s+/g, " ").trim() ?? "";
  }

  function uploadRowsWithHeaders(text: string, headers: string[]) {
    const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/).find((line) => line.trim()) ?? "";
    const firstHeaders = firstLine.split(",").map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"));
    if (!firstHeaders.some((header) => headers.includes(header))) return [];
    return csvToRows(text);
  }

  function emailUploadLines(text: string) {
    const rows = uploadRowsWithHeaders(text, ["email", "email_address", "email_recipient", "recipient", "contact_email"]);
    const fromRows = rows
      .map((row) => {
        const email = [
          row.email,
          row.email_address,
          row.email_recipient,
          row.recipient,
          row.contact_email,
          ...Object.values(row),
        ].map((value) => emailFromText(value)).find(looksLikeEmailRecipient);
        if (!email) return "";

        const name = compactRecipientName(
          row.name
            || row.full_name
            || row.recipient_name
            || [row.first_name, row.last_name].filter(Boolean).join(" ")
        );
        return name ? `${name}, ${email}` : email;
      })
      .filter(Boolean);

    if (fromRows.length) return fromRows;

    return text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .flatMap((line) => parseInviteRecipients(line, looksLikeEmailRecipient))
      .filter((item) => looksLikeEmailRecipient(item.recipient))
      .map((item) => item.name ? `${item.name}, ${item.recipient}` : item.recipient);
  }

  function whatsappUploadLines(text: string) {
    const rows = uploadRowsWithHeaders(text, [
      "whatsapp",
      "whatsapp_number",
      "whats_app",
      "phone",
      "phone_number",
      "mobile",
      "mobile_phone",
      "recipient",
      "contact_phone",
    ]);
    const fromRows = rows
      .map((row) => [
        row.whatsapp,
        row.whatsapp_number,
        row.whats_app,
        row.phone,
        row.phone_number,
        row.mobile,
        row.mobile_phone,
        row.recipient,
        row.contact_phone,
        ...Object.values(row),
      ].map((value) => phoneFromText(value)).find(looksLikePhoneRecipient) ?? "")
      .filter(Boolean);

    if (fromRows.length) return fromRows;

    return text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .flatMap((line) => parseInviteRecipients(line, looksLikePhoneRecipient))
      .map((item) => phoneFromText(item.recipient) || item.recipient)
      .filter(looksLikePhoneRecipient);
  }

  function normalizeWhatsappRecipientText(value: string) {
    return parseInviteRecipients(value, looksLikePhoneRecipient)
      .map((item) => phoneFromText(item.recipient) || item.recipient)
      .filter(looksLikePhoneRecipient)
      .join("\n");
  }

  async function uploadEmailRecipients(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const lines = emailUploadLines(await file.text());
      const existing = parseInviteRecipients(signupShare.emails, looksLikeEmailRecipient);
      const seen = new Set(existing.map((item) => item.recipient.toLowerCase()));
      const uniqueLines = lines.filter((line) => {
        const email = parseInviteRecipients(line, looksLikeEmailRecipient)[0]?.recipient ?? emailFromText(line);
        const normalized = email.toLowerCase();
        if (!looksLikeEmailRecipient(email) || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });

      if (!uniqueLines.length) {
        setMessage("No new email recipients found in that file.");
        return;
      }

      setSignupShare((current) => ({
        ...current,
        emails: [current.emails.trim(), ...uniqueLines].filter(Boolean).join("\n"),
      }));
      setMessage(`${uniqueLines.length} email recipient${uniqueLines.length === 1 ? "" : "s"} added from ${file.name}.`);
    } catch {
      setMessage("Could not read that email upload. Use a CSV or TXT file.");
    } finally {
      event.target.value = "";
    }
  }

  async function uploadWhatsappRecipients(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const lines = whatsappUploadLines(await file.text());
      const existing = parseInviteRecipients(signupShare.whatsapp, looksLikePhoneRecipient);
      const seen = new Set(existing.map((item) => item.recipient.replace(/\D/g, "")));
      const uniqueLines = lines.filter((line) => {
        const phone = phoneFromText(line) || line;
        const normalized = phone.replace(/\D/g, "");
        if (!looksLikePhoneRecipient(phone) || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });

      if (!uniqueLines.length) {
        setMessage("No new phone numbers found in that file.");
        return;
      }

      setSignupShare((current) => ({
        ...current,
        whatsapp: [current.whatsapp.trim(), ...uniqueLines].filter(Boolean).join("\n"),
      }));
      setMessage(`${uniqueLines.length} phone number${uniqueLines.length === 1 ? "" : "s"} added from ${file.name}.`);
    } catch {
      setMessage("Could not read that phone upload. Use a CSV or TXT file.");
    } finally {
      event.target.value = "";
    }
  }

  function signupShareResults(value: unknown): SignupShareResult[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is JsonRecord => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      .map((item) => ({
        id: stringValue(item.id),
        channel: stringValue(item.channel),
        recipient: stringValue(item.recipient),
        status: stringValue(item.status),
        error: stringValue(item.error) || undefined,
      }));
  }

  async function shareSignupForm() {
    if (sharingSignup) return;
    setSharingSignup(true);
    setSignupShareNotice(null);
    setMessage("");
    try {
      const emailRecipients = parseInviteRecipients(signupShare.emails, looksLikeEmailRecipient);
      const whatsappRecipients = parseInviteRecipients(signupShare.whatsapp, looksLikePhoneRecipient);
      const data = await api("/signup-share", {
        method: "POST",
        body: JSON.stringify({
          email_recipients: emailRecipients,
          whatsapp_recipients: whatsappRecipients,
          invite_type: signupShare.inviteType,
          message: signupShare.message.trim() || undefined,
          language: signupShare.language,
        }),
      });
      const queued = Number(data.queued ?? 0);
      const sent = Number(data.sent ?? 0);
      const failed = Number(data.failed ?? 0);
      const results = signupShareResults(data.results);
      const failedDetails = results
        .filter((item) => item.status === "failed")
        .map((item) => `${item.channel} to ${item.recipient}: ${item.error ?? "Delivery failed."}`);
      const sentDetails = results
        .filter((item) => item.status === "sent")
        .map((item) => `${item.channel} to ${item.recipient}: sent`);
      const tone = failed === 0 ? "success" : sent > 0 ? "warning" : "error";
      const inviteLabel = signupShare.inviteType === "caregiver" ? "Caregiver invite" : "Signup link";
      const title = failed === 0
        ? `${inviteLabel} sent to ${sent} recipient${sent === 1 ? "" : "s"}.`
        : sent > 0
          ? `${inviteLabel} partially sent: ${sent} sent, ${failed} failed.`
          : `${inviteLabel} failed for ${failed || queued} recipient${(failed || queued) === 1 ? "" : "s"}.`;
      setSignupShareNotice({
        tone,
        title,
        details: [...failedDetails, ...(failedDetails.length ? sentDetails : sentDetails.slice(0, 3))],
      });
      if (sent > 0) setSignupShare({ emails: "", whatsapp: "", message: signupShare.message, language: signupShare.language, inviteType: signupShare.inviteType });
      await refresh();
    } catch (err) {
      setSignupShareNotice({
        tone: "error",
        title: "Signup link was not sent.",
        details: [err instanceof Error ? err.message : "Could not share the signup link."],
      });
    } finally {
      setSharingSignup(false);
    }
  }

  async function copySignupLink() {
    try {
      await navigator.clipboard.writeText("https://v2.vyva.life/invite");
      setCopiedSignupLink(true);
      window.setTimeout(() => setCopiedSignupLink(false), 1800);
    } catch {
      setMessage("Could not copy the signup link.");
    }
  }

  async function triggerConsent(intake: Intake) {
    setBusyAction(`consent:${intake.id}`);
    setMessage("");
    try {
      await api(`/consent/${intake.id}/trigger`, { method: "POST" });
      showActionReceipt({
        tone: "success",
        label: "Queued",
        title: `Consent call queued for ${intake.name}.`,
        details: ["The elder consent flow will continue through the configured voice provider."],
      });
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not queue consent call.");
    } finally {
      setBusyAction(null);
    }
  }

  async function markConsent(attempt: ConsentAttempt, status: string) {
    await api(`/consent/${attempt.id}/result`, {
      method: "POST",
      body: JSON.stringify({ status, result_payload: { source: "admin_panel" } }),
    });
    showActionReceipt({
      tone: status === "approved" ? "success" : status === "rejected" ? "error" : "warning",
      label: "Consent",
      title: `Consent marked ${consentStatusLabel(status)}.`,
      details: ["The lifecycle record and consent audit have been updated."],
    });
    await refresh();
  }

  function findDuplicateOrg(name: string, excludeId?: string) {
    const normalizedName = normalizeOrganizationLabel(name);
    const slug = slugifyOrganizationLabel(name);
    if (!normalizedName) return null;
    return organizations.find((org) => (
      org.id !== excludeId
        && (normalizeOrganizationLabel(org.name) === normalizedName || org.slug === slug)
    )) ?? null;
  }

  async function createOrg() {
    const duplicate = findDuplicateOrg(newOrg.name);
    if (duplicate) {
      setMessage(`${duplicate.name} already exists and is ${duplicate.is_active ? "active" : "archived"}. Use that organization or restore it instead.`);
      return;
    }

    try {
      const data = await api("/organizations", {
        method: "POST",
        body: JSON.stringify(newOrg),
      });
      showActionReceipt({
        tone: "success",
        label: "Created",
        title: `${data.organization.name} was created.`,
        details: [`Default tier: ${tierLabel(data.organization.default_tier ?? newOrg.default_tier)}.`],
      });
      setNewOrg({ name: "", default_tier: "free" });
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not create organization.");
    }
  }

  function startEditOrg(org: Organization) {
    setEditingOrgId(org.id);
    setOrgDraft({ name: org.name, default_tier: org.default_tier });
  }

  function cancelEditOrg() {
    setEditingOrgId(null);
    setOrgDraft({ name: "", default_tier: "free" });
  }

  async function saveOrg(org: Organization) {
    const duplicate = findDuplicateOrg(orgDraft.name, org.id);
    if (duplicate) {
      setMessage(`${duplicate.name} already exists and is ${duplicate.is_active ? "active" : "archived"}. Choose a different organization name.`);
      return;
    }

    try {
      const data = await api(`/organizations/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: orgDraft.name,
          default_tier: orgDraft.default_tier,
        }),
      });
      showActionReceipt({
        tone: "success",
        label: "Saved",
        title: `${data.organization.name} was updated.`,
        details: [`Default tier now applies as ${tierLabel(data.organization.default_tier ?? orgDraft.default_tier)} for new org users.`],
      });
      cancelEditOrg();
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update organization.");
    }
  }

  async function archiveOrg(org: Organization) {
    await api(`/organizations/${org.id}`, { method: "DELETE" });
    showActionReceipt({
      tone: "warning",
      label: "Archived",
      title: `${org.name} was archived.`,
      details: ["Existing users remain visible. New intake assignment to this organization is paused."],
    });
    await refresh();
  }

  async function restoreOrg(org: Organization) {
    try {
      await api(`/organizations/${org.id}/restore`, { method: "POST" });
      showActionReceipt({
        tone: "success",
        label: "Restored",
        title: `${org.name} was restored.`,
        details: ["The organization is active again and can receive new users."],
      });
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not restore organization.");
    }
  }

  async function savePlan(plan: SubscriptionPlanAdmin) {
    const entitlement = plan.entitlement ?? {
      tier: plan.plan_id,
      display_name: plan.name,
      description: plan.description ?? "",
      voice_assistant: false,
      medication_tracking: false,
      symptom_check: false,
      concierge: false,
      caregiver_dashboard: false,
      is_active: plan.is_active,
      custom_features: {},
    };

    await api("/plans", {
      method: "POST",
      body: JSON.stringify({
        ...plan,
        features: plan.features ?? [],
        entitlement: {
          display_name: entitlement.display_name ?? plan.name,
          description: entitlement.description ?? plan.description ?? "",
          voice_assistant: Boolean(entitlement.voice_assistant),
          medication_tracking: Boolean(entitlement.medication_tracking),
          symptom_check: Boolean(entitlement.symptom_check),
          concierge: Boolean(entitlement.concierge),
          caregiver_dashboard: Boolean(entitlement.caregiver_dashboard),
          custom_features: entitlement.custom_features ?? {},
          is_active: plan.is_active,
        },
      }),
    });
    showActionReceipt({
      tone: "success",
      label: "Saved",
      title: `${plan.name} access was saved.`,
      details: ["Tier entitlements are updated for future access checks."],
    });
    await refresh();
  }

  async function openUserDetail(intake: Intake, action: "view" | "tier" = "view") {
    setBusyAction(`${action}:${intake.id}`);
    setMessage("");
    setUserDetailMessage("");
    try {
      const data = await api(`/users/${intake.id}/details`);
      const detailIntake = (data.intake && typeof data.intake === "object" ? data.intake : intake) as Intake;
      const detailProfile = recordValue(data.profile);
      const primaryMapping = Array.isArray(data.account_mappings) ? data.account_mappings[0] as LoginMapping | undefined : undefined;
      setSelectedUser(data);
      setSelectedDraft(userDetailDraft(detailProfile, detailIntake, intake, primaryMapping));
      const caregiverName = profileNameValue(detailProfile.caregiver_name);
      const caregiverContact = stringValue(detailProfile.caregiver_contact) ?? "";
      const caregiverContactIsEmail = caregiverContact.includes("@");
      setCaregiverInviteDraft({
        ...defaultCaregiverInviteDraft,
        permissions: { ...defaultCaregiverInviteDraft.permissions },
        name: caregiverName,
        email: caregiverContactIsEmail ? caregiverContact : "",
        phone: caregiverContact && !caregiverContactIsEmail ? caregiverContact : "",
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not open this user.");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveUserDetail() {
    if (!selectedUser) return;
    setSavingUserDetail(true);
    setUserDetailMessage("");
    try {
      const profilePayload: JsonRecord = {
        ...selectedDraft,
        sync_profile_ids: (selectedUser.account_mappings ?? [])
          .map((mapping) => mapping.effective_profile_id)
          .filter(Boolean),
        organization_id: selectedDraft.organization_id || null,
      };
      if (typeof profilePayload.full_name === "string" && !profilePayload.full_name.trim()) {
        delete profilePayload.full_name;
      }
      const data = await api(`/users/${selectedUser.intake.id}/profile`, {
        method: "PATCH",
        body: JSON.stringify(profilePayload),
      });
      const nextIntake = (data.intake && typeof data.intake === "object" ? data.intake : selectedUser.intake) as Intake;
      const nextProfile = recordValue(data.profile);
      const nextMappings = Array.isArray(data.account_mappings) ? data.account_mappings as LoginMapping[] : selectedUser.account_mappings;
      const nextPrimaryMapping = nextMappings?.[0];
      const syncedCount = Array.isArray(data.synced_profile_ids) ? data.synced_profile_ids.length : 1;
      const confirmation = `Changes saved${syncedCount > 1 ? ` across ${syncedCount} linked profiles` : ""}.`;
      setMessage("");
      setUserDetailMessage(confirmation);
      showActionReceipt({
        tone: "success",
        label: "Saved",
        title: `Changes saved for ${selectedUser.intake.name}.`,
        details: [
          syncedCount > 1 ? `Updated ${syncedCount} linked app profiles.` : "Updated the linked app profile.",
          "The Users table will refresh with the latest status and tier.",
        ],
      });
      setSelectedDraft(userDetailDraft(nextProfile, nextIntake, selectedUser.intake, nextPrimaryMapping));
      setSelectedUser({
        ...selectedUser,
        intake: nextIntake,
        profile: data.profile ?? selectedUser.profile,
        account_mappings: nextMappings,
        account_mapping_warnings: data.account_mapping_warnings ?? selectedUser.account_mapping_warnings,
        account_match_field: data.account_match_field ?? selectedUser.account_match_field,
        synced_profile_ids: data.synced_profile_ids ?? selectedUser.synced_profile_ids,
      });
      await refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not save user details.";
      setMessage(errorMessage);
      setUserDetailMessage(errorMessage);
    } finally {
      setSavingUserDetail(false);
    }
  }

  async function sendCaregiverInvite() {
    if (!selectedUser) return;
    const caregiverInvitePayload = caregiverInviteWithProfileDefaults(caregiverInviteDraft, selectedDraft);
    setSendingCaregiverInvite(true);
    setUserDetailMessage("");
    try {
      const data = await api(`/users/${selectedUser.intake.id}/caregiver-invite`, {
        method: "POST",
        body: JSON.stringify(caregiverInvitePayload),
      });
      const delivery = data.delivery && typeof data.delivery === "object" && !Array.isArray(data.delivery)
        ? data.delivery as JsonRecord
        : {};
      const queued = Number(delivery.queued ?? 0);
      const sent = Number(delivery.sent ?? 0);
      const failed = Number(delivery.failed ?? 0);
      const inviteeName = caregiverInvitePayload.name.trim() || "Caregiver";
      const confirmation = failed > 0
        ? `${inviteeName}'s invite was created, but ${failed} delivery attempt${failed === 1 ? "" : "s"} failed.`
        : sent > 0
          ? `${inviteeName}'s caregiver invite was sent.`
          : `${inviteeName}'s caregiver invite was queued.`;
      const invitation = data.invitation && typeof data.invitation === "object" && !Array.isArray(data.invitation)
        ? data.invitation as CareTeamInvitation
        : null;
      const communications = Array.isArray(data.communications) ? data.communications as Communication[] : [];
      setSelectedUser((current) => {
        if (!current || current.intake.id !== selectedUser.intake.id) return current;
        return {
          ...current,
          care_team_invitations: invitation
            ? [invitation, ...(current.care_team_invitations ?? [])]
            : current.care_team_invitations,
          communications: communications.length ? [...communications, ...current.communications] : current.communications,
        };
      });
      setCaregiverInviteDraft({
        ...defaultCaregiverInviteDraft,
        permissions: { ...defaultCaregiverInviteDraft.permissions },
      });
      setMessage("");
      setUserDetailMessage(confirmation);
      showActionReceipt({
        tone: failed > 0 ? "warning" : "success",
        label: failed > 0 ? "Check delivery" : "Invite sent",
        title: confirmation,
        details: [
          `Created a care-team invitation tied to ${selectedUser.intake.name}'s app profile.`,
          queued > 0 ? `${queued} message${queued === 1 ? "" : "s"} queued for delivery.` : "No delivery messages were queued.",
        ],
      });
      await refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not send caregiver invite.";
      setMessage(errorMessage);
      setUserDetailMessage(errorMessage);
    } finally {
      setSendingCaregiverInvite(false);
    }
  }

  async function toggleUser(intake: Intake, forceEnable?: boolean) {
    setBusyAction(`toggle:${intake.id}`);
    const shouldEnable = forceEnable ?? intake.account_status === "disabled";
    try {
      const data = await api(`/users/${intake.id}/${shouldEnable ? "enable" : "disable"}`, {
        method: "POST",
        body: JSON.stringify({ reason: shouldEnable ? "" : "Disabled by admin" }),
      });
      const profileCount = Array.isArray(data.profiles) ? data.profiles.length : data.profile ? 1 : 0;
      const confirmation = shouldEnable ? "App access enabled." : "App access disabled.";
      setMessage("");
      setUserDetailMessage(`${confirmation} ${profileCount ? `${profileCount} linked profile${profileCount === 1 ? "" : "s"} updated.` : "No linked app profile was found."}`);
      showActionReceipt({
        tone: profileCount ? "success" : "warning",
        label: shouldEnable ? "Enabled" : "Disabled",
        title: `${intake.name} ${shouldEnable ? "can use the app again" : "cannot use the app now"}.`,
        details: [
          profileCount ? `${profileCount} linked app profile${profileCount === 1 ? "" : "s"} updated.` : "No linked app profile was found for this lifecycle user.",
          shouldEnable ? "App access was enabled where matching records were found." : "App access was disabled where matching records were found.",
        ],
      });
      if (selectedUser?.intake.id === intake.id) await openUserDetail(intake);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update this user.");
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteUser(intake: Intake) {
    const confirmed = window.confirm(`Remove ${intake.name} from Users? This hides the admin lifecycle row and prevents it from returning on refresh. App access will not be changed.`);
    if (!confirmed) return;
    setBusyAction(`delete:${intake.id}`);
    setUserDetailMessage("");
    setAdminActionNotice(null);
    try {
      const result = await api(`/users/${intake.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: "REMOVE_FROM_USERS" }),
      });
      setUsers((current) => current.filter((user) => shouldKeepAfterDelete(user, intake, result)));
      if (selectedUser?.intake.id === intake.id) setSelectedUser(null);
      setMessage("");
      showActionReceipt(deleteNoticeFor(intake, result));
      await refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not remove this user from Users.";
      setMessage(errorMessage);
      setUserDetailMessage(errorMessage);
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteLoginAccount(mapping: LoginMapping) {
    if (!selectedUser) return;
    if (mapping.source !== "legacy") {
      setUserDetailMessage("Delete this external auth account in the auth provider, then refresh VYVA.");
      return;
    }

    const loginLabel = mapping.login_email || mapping.login_phone || mapping.login_uid;
    const confirmation = window.prompt(`Delete login account ${loginLabel}? This frees its email/mobile for a new signup and revokes this login's access. Type DELETE LOGIN to continue.`);
    if (confirmation !== "DELETE LOGIN") return;

    setBusyAction(`delete-login:${mapping.login_uid}`);
    setUserDetailMessage("");
    setAdminActionNotice(null);
    try {
      const result = await api(`/users/${selectedUser.intake.id}/delete-login-account`, {
        method: "POST",
        body: JSON.stringify({
          confirm: "DELETE_LOGIN_ACCOUNT",
          source: mapping.source,
          login_uid: mapping.login_uid,
        }),
      });
      setUsers((current) => current.filter((user) => shouldKeepAfterDelete(user, selectedUser.intake, result)));
      setSelectedUser(null);
      setMessage("");
      showActionReceipt(loginAccountDeleteNoticeFor(selectedUser.intake, result));
      await refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not delete this login account.";
      setMessage(errorMessage);
      setUserDetailMessage(errorMessage);
    } finally {
      setBusyAction(null);
    }
  }

  async function restoreUser(intake: Intake) {
    const confirmed = window.confirm(`Restore ${intake.name} to Users? This makes the lifecycle row visible again. App access will not be changed.`);
    if (!confirmed) return;
    setBusyAction(`restore:${intake.id}`);
    setUserDetailMessage("");
    setAdminActionNotice(null);
    try {
      const result = await api(`/users/${intake.id}/restore`, { method: "POST" });
      setMessage("");
      setUserDetailMessage("Restored to Users. App access was unchanged.");
      showActionReceipt(restoreNoticeFor(intake, result));
      await refresh();
      if (selectedUser?.intake.id === intake.id) await openUserDetail(intake);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not restore this user to Users.";
      setMessage(errorMessage);
      setUserDetailMessage(errorMessage);
    } finally {
      setBusyAction(null);
    }
  }

  function canSelectUserForBulk(user: Intake) {
    return bulkUserAction === "restore" ? !isVisibleLifecycleUser(user) : isVisibleLifecycleUser(user);
  }

  function setUserSelected(intakeId: string, selected: boolean) {
    setSelectedUserIds((current) => {
      if (selected) return current.includes(intakeId) ? current : [...current, intakeId];
      return current.filter((id) => id !== intakeId);
    });
  }

  function setAllVisibleUsersSelected(selected: boolean) {
    const visibleIds = users.filter((user) => canSelectUserForBulk(user)).map((user) => user.id);
    setSelectedUserIds((current) => {
      if (!selected) return current.filter((id) => !visibleIds.includes(id));
      const next = new Set(current);
      visibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }

  function bulkActionLabel(action: BulkUserAction) {
    if (action === "disable") return "App access disabled";
    if (action === "delete_hide") return "Removed from Users";
    if (action === "restore") return "Restored to Users";
    if (action === "assign_org") return "Assigned";
    if (action === "change_tier") return "Tier changed";
    return "Invite sent";
  }

  async function runBulkUserAction() {
    if (selectedUserIds.length === 0 || busyAction === "bulk-users") return;
    if (bulkUserAction === "delete_hide") {
      const confirmed = window.confirm(`Remove ${selectedUserIds.length} selected user${selectedUserIds.length === 1 ? "" : "s"} from Users? They should stay hidden after refresh. App access will not be changed.`);
      if (!confirmed) return;
    }
    if (bulkUserAction === "restore") {
      const confirmed = window.confirm(`Restore ${selectedUserIds.length} selected removed user${selectedUserIds.length === 1 ? "" : "s"} to Users? App access will not be changed.`);
      if (!confirmed) return;
    }

    setBusyAction("bulk-users");
    setMessage("");
    setAdminActionNotice(null);
    try {
      const data = await api("/users/bulk", {
        method: "POST",
        body: JSON.stringify({
          ids: selectedUserIds,
          action: bulkUserAction,
          ...(bulkUserAction === "assign_org" ? { organization_id: bulkUserOrganizationId || null } : {}),
          ...(bulkUserAction === "change_tier" ? { tier: bulkUserTier } : {}),
        }),
      });
      const results = Array.isArray(data.results) ? data.results as JsonRecord[] : [];
      const succeeded = Number(data.succeeded ?? results.filter((item) => item.status === "success").length);
      const failed = Number(data.failed ?? results.filter((item) => item.status === "failed").length);
      const failedDetails = results
        .filter((item) => item.status === "failed")
        .slice(0, 4)
        .map((item) => `${stringValue(item.name) ?? stringValue(item.id) ?? "User"}: ${stringValue(item.message) ?? "Could not update."}`);
      const successDetails = results
        .filter((item) => item.status === "success")
        .slice(0, 3)
        .map((item) => `${stringValue(item.name) ?? stringValue(item.id) ?? "User"}: ${stringValue(item.message) ?? "Updated."}`);
      const actionLabel = bulkActionLabel(bulkUserAction);
      showActionReceipt({
        tone: failed > 0 ? (succeeded > 0 ? "warning" : "error") : "success",
        label: failed > 0 && succeeded > 0 ? "Partial" : actionLabel,
        title: failed > 0
          ? `${actionLabel}: ${succeeded} succeeded, ${failed} failed.`
          : `${actionLabel} ${succeeded} user${succeeded === 1 ? "" : "s"}.`,
        details: [
          ...(failedDetails.length ? failedDetails : successDetails),
          ...(failed > failedDetails.length ? [`${failed - failedDetails.length} more failure${failed - failedDetails.length === 1 ? "" : "s"} not shown.`] : []),
        ],
      });
      if (bulkUserAction === "delete_hide") {
        const hiddenIds = new Set(results.flatMap((item) => Array.isArray(item.hidden_intake_ids) ? item.hidden_intake_ids.filter((id): id is string => typeof id === "string") : [stringValue(item.id)].filter(Boolean) as string[]));
        setUsers((current) => current.filter((user) => !hiddenIds.has(user.id)));
      }
      setSelectedUserIds([]);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Bulk action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function createScheduledEventForUser() {
    if (!selectedUser) return;
    if (!newEvent.title.trim()) {
      setUserDetailMessage("Add a title before creating the event.");
      return;
    }
    if (!newEvent.scheduled_for) {
      setUserDetailMessage("Select both date and time before creating the event.");
      return;
    }
    const { scheduled_date, scheduled_time, ...eventPayload } = newEvent;
    setUserDetailMessage("");
    try {
      await api(`/users/${selectedUser.intake.id}/scheduled-events`, {
        method: "POST",
        body: JSON.stringify(eventPayload),
      });
      setNewEvent(emptyScheduledEvent);
      await openUserDetail(selectedUser.intake);
      setUserDetailMessage("Scheduled event added.");
      showActionReceipt({
        tone: "success",
        label: "Scheduled",
        title: "Scheduled event added.",
        details: [`${eventPayload.title} is now on this user's schedule.`],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not add the scheduled event.";
      setUserDetailMessage(errorMessage);
      setMessage(errorMessage);
    }
  }

  async function setEventStatus(event: ScheduledEvent, action: "pause" | "resume" | "cancel") {
    if (event.read_only) return;
    setUserDetailMessage("");
    try {
      await api(`/scheduled-events/${event.id}/${action}`, { method: "POST" });
      if (selectedUser) await openUserDetail(selectedUser.intake);
      const confirmation = `Scheduled event ${action === "cancel" ? "cancelled" : action === "pause" ? "paused" : "resumed"}.`;
      setUserDetailMessage(confirmation);
      showActionReceipt({
        tone: action === "cancel" ? "warning" : "success",
        label: action === "cancel" ? "Cancelled" : action === "pause" ? "Paused" : "Resumed",
        title: confirmation,
        details: [`${event.title} was updated.`],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not update the scheduled event.";
      setUserDetailMessage(errorMessage);
      setMessage(errorMessage);
    }
  }

  async function updateEventTime(event: ScheduledEvent, scheduledFor: string) {
    if (!selectedUser || event.read_only || !scheduledFor) return;
    setUserDetailMessage("");
    try {
      await api(`/scheduled-events/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify({ scheduled_for: new Date(scheduledFor).toISOString() }),
      });
      await openUserDetail(selectedUser.intake);
      setUserDetailMessage("Scheduled event time updated.");
      showActionReceipt({
        tone: "success",
        label: "Saved",
        title: "Scheduled event time updated.",
        details: [`${event.title} now uses the selected date and time.`],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not update the scheduled event time.";
      setUserDetailMessage(errorMessage);
      setMessage(errorMessage);
    }
  }

  async function saveSupportSchedule(schedule: ScheduledSupport, draft: SupportScheduleDraft) {
    if (!selectedUser) return;
    if (!schedule.admin_edit_allowed) {
      setUserDetailMessage("User has not allowed admin edits for support schedules.");
      return;
    }
    setBusyAction(`support:${schedule.id}`);
    setUserDetailMessage("");
    try {
      await rootApi(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          frequency_type: draft.frequency_type,
          days_of_week: draft.days_of_week,
          times_of_day: draft.times_of_day,
          timezone: draft.timezone,
          preferred_language: draft.preferred_language,
          quiet_hours_start: draft.quiet_hours_start,
          quiet_hours_end: draft.quiet_hours_end,
        }),
      });
      await openUserDetail(selectedUser.intake);
      setUserDetailMessage("Recurring support schedule updated.");
      showActionReceipt({
        tone: "success",
        label: "Saved",
        title: "Recurring support schedule updated.",
        details: ["The user will see the updated recurring support schedule after refresh."],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not update the support schedule.";
      setUserDetailMessage(errorMessage);
      setMessage(errorMessage);
    } finally {
      setBusyAction(null);
    }
  }

  async function setSupportStatus(schedule: ScheduledSupport, action: "pause" | "resume") {
    if (!selectedUser) return;
    if (!schedule.admin_edit_allowed) {
      setUserDetailMessage("User has not allowed admin edits for support schedules.");
      return;
    }
    setBusyAction(`support-status:${schedule.id}`);
    setUserDetailMessage("");
    try {
      await rootApi(`/api/schedules/${schedule.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await openUserDetail(selectedUser.intake);
      const confirmation = `Recurring support schedule ${action === "pause" ? "paused" : "resumed"}.`;
      setUserDetailMessage(confirmation);
      showActionReceipt({
        tone: action === "pause" ? "warning" : "success",
        label: action === "pause" ? "Paused" : "Resumed",
        title: confirmation,
        details: ["The support schedule status was saved."],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not update the support schedule.";
      setUserDetailMessage(errorMessage);
      setMessage(errorMessage);
    } finally {
      setBusyAction(null);
    }
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
    showActionReceipt({
      tone: Number(data.summary.skipped ?? 0) > 0 ? "warning" : "success",
      label: "Imported",
      title: `Imported ${data.summary.imported} users.`,
      details: [
        `${data.summary.skipped} row${Number(data.summary.skipped ?? 0) === 1 ? "" : "s"} skipped.`,
        sendBulkLinks ? "Invite links were queued for imported users." : "Invite links were not sent.",
      ],
    });
    setBulkOrg(null);
    setBulkRows([]);
    setBulkPreview(null);
    setSendBulkLinks(false);
    await refresh();
  }

  const visibleOrganizations = organizations.filter((org) => (
    orgFilter === "all" ? true : orgFilter === "active" ? org.is_active : !org.is_active
  ));
  const duplicateOrg = findDuplicateOrg(newOrg.name);
  const emailShareCount = parseInviteRecipients(signupShare.emails, looksLikeEmailRecipient).length;
  const whatsappShareCount = parseInviteRecipients(signupShare.whatsapp, looksLikePhoneRecipient).length;
  const totalShareRecipients = emailShareCount + whatsappShareCount;
  const userHasContactNumber = (user: Intake) => Boolean(
    contactNumberValue(user.login_phone) || contactNumberValue(user.profile_phone) || contactNumberValue(user.phone),
  );
  const visibleUsers = users.filter(isVisibleLifecycleUser);
  const displayedUsers = showContactGapsOnly
    ? visibleUsers.filter((user) => !userHasContactNumber(user))
    : users;
  const selectedUsers = users.filter((user) => selectedUserIds.includes(user.id));
  const selectedSelectableUserCount = selectedUsers.filter(canSelectUserForBulk).length;
  const selectedUserCount = selectedUserIds.length;
  const hasInvalidBulkSelection = selectedUserCount > 0 && selectedSelectableUserCount !== selectedUserCount;
  const visibleUserCount = visibleUsers.length;
  const removedUserCount = users.length - visibleUserCount;
  const contactGapUsers = visibleUsers.filter((user) => !userHasContactNumber(user));
  const contactGapCount = contactGapUsers.length;
  const usersNeedingInviteCount = visibleUsers.filter((user) => user.status === "created").length;
  const usersLinkSentCount = visibleUsers.filter((user) => user.status === "link_sent").length;
  const usersConsentWaitingCount = visibleUsers.filter((user) => user.status === "consent_pending").length;
  const duplicatePhoneIssueGroups = duplicatePhoneGroups(visibleUsers);
  const duplicatePhoneUserCount = duplicatePhoneIssueGroups.reduce((total, group) => total + group.users.length, 0);
  const emailIdentityUsers = visibleUsers.filter(lifecycleHasEmailIdentityLeak);
  const disabledVisibleUsers = visibleUsers.filter((user) => user.account_status === "disabled");
  const tierMismatchUsers = visibleUsers.filter(lifecycleHasTierMismatch);
  const removedUsers = users.filter((user) => !isVisibleLifecycleUser(user));
  const usersResultLabel = usersLoadError
    ? "Users unavailable"
    : showContactGapsOnly
      ? `${displayedUsers.length} phone gap${displayedUsers.length === 1 ? "" : "s"}`
      : `${users.length} result${users.length === 1 ? "" : "s"}${showRemovedUsers && removedUserCount > 0 ? `, ${removedUserCount} removed` : ""}`;
  const searchIsUpdating = peopleSearchInput.trim() !== peopleSearch.trim();
  const planOptions = plans.length
    ? plans.map((plan) => ({ value: plan.plan_id, label: plan.name }))
    : tiers.map((tier) => ({ value: tier, label: tierLabel(tier) }));
  const canRunBulkUserAction = selectedUserCount > 0
    && busyAction !== "bulk-users"
    && !hasInvalidBulkSelection
    && (bulkUserAction !== "assign_org" || Boolean(bulkUserOrganizationId))
    && (bulkUserAction !== "change_tier" || Boolean(bulkUserTier));
  const bulkUserActionImpact = bulkUserAction === "disable"
    ? "Disables linked app access. Users stay visible and login contacts remain reserved."
    : bulkUserAction === "delete_hide"
      ? "Removes rows from Users only. Login accounts, app access, email, and mobile are unchanged."
      : bulkUserAction === "restore"
        ? "Shows removed lifecycle rows again. App access is unchanged."
        : bulkUserAction === "assign_org"
          ? "Assigns the selected organization to visible lifecycle users."
          : bulkUserAction === "change_tier"
            ? "Changes the lifecycle tier and syncs linked app entitlement where possible."
            : "Resends signup invites to users with available contact details.";
  const bulkApplyBlockedReason = busyAction === "bulk-users"
    ? "Bulk action is already running."
    : selectedUserCount === 0
      ? "Select at least one user."
      : hasInvalidBulkSelection
        ? bulkUserAction === "restore"
          ? "Restore only works on removed users. Turn on removed users or clear the current selection."
          : "This action only works on visible users. Clear removed users from the selection."
        : bulkUserAction === "assign_org" && !bulkUserOrganizationId
          ? "Choose an organization."
          : bulkUserAction === "change_tier" && !bulkUserTier
            ? "Choose a tier."
            : "";
  const creatingFamilyIntake = newIntake.user_type === "family";
  const canCreateIntake = Boolean(
    newIntake.first_name.trim()
      && newIntake.last_name.trim()
      && newIntake.phone.trim()
      && (!creatingFamilyIntake || (
        newIntake.elder_first_name.trim()
        && newIntake.elder_last_name.trim()
        && newIntake.elder_phone.trim()
      ))
  );
  const adminSecondaryActionBusy = Boolean(
    adminActionNotice?.secondaryAction?.busyKey
      && busyAction === adminActionNotice.secondaryAction.busyKey
  );
  const operationalSummary = recordValue(summary?.operational);
  const operationalCount = (key: string, fallback?: unknown) => (
    summary ? numberValue(operationalSummary[key], fallback === undefined ? 0 : fallback) : "-"
  );
  const inviteFailureCount = summary ? numberValue(operationalSummary.invite_failures) : 0;
  const phoneFollowUpCount = summary ? numberValue(operationalSummary.phone_follow_up) : 0;
  const consentPendingCount = summary ? numberValue(operationalSummary.consent_pending, summary.pendingConsent) : 0;
  const deletedCount = summary ? numberValue(operationalSummary.deleted_count) : 0;
  const disabledCount = summary ? numberValue(operationalSummary.disabled_count) : 0;
  const operationalCards = [
    {
      label: "New users today",
      value: operationalCount("new_users_today"),
      detail: "Created since midnight",
      tone: "neutral",
    },
    {
      label: "Invite failures",
      value: operationalCount("invite_failures"),
      detail: "Failed email or WhatsApp sends",
      tone: inviteFailureCount > 0 ? "danger" : "success",
    },
    {
      label: "Phone follow-up",
      value: operationalCount("phone_follow_up"),
      detail: "Inbound callers not complete",
      tone: phoneFollowUpCount > 0 ? "warning" : "success",
    },
    {
      label: "Consent pending",
      value: operationalCount("consent_pending", summary?.pendingConsent),
      detail: "Family flows waiting",
      tone: consentPendingCount > 0 ? "warning" : "neutral",
    },
    {
      label: "Removed / disabled",
      value: operationalCount("deleted_disabled_count"),
      detail: summary ? `${deletedCount} removed, ${disabledCount} disabled` : "Hidden or paused users",
      tone: deletedCount + disabledCount > 0 ? "muted" : "neutral",
    },
  ];
  const userWorkQueues = [
    {
      label: "Needs invite",
      value: usersNeedingInviteCount,
      detail: "Created, not active",
      active: filters.status === "created" && !showContactGapsOnly,
      onClick: () => {
        setShowContactGapsOnly(false);
        setShowRemovedUsers(false);
        setFilters((prev) => ({ ...prev, status: "created" }));
        setSelectedUserIds([]);
      },
    },
    {
      label: "Link sent",
      value: usersLinkSentCount,
      detail: "Waiting on signup",
      active: filters.status === "link_sent" && !showContactGapsOnly,
      onClick: () => {
        setShowContactGapsOnly(false);
        setShowRemovedUsers(false);
        setFilters((prev) => ({ ...prev, status: "link_sent" }));
        setSelectedUserIds([]);
      },
    },
    {
      label: "Consent waiting",
      value: usersConsentWaitingCount,
      detail: "Family flows",
      active: filters.status === "consent_pending" && !showContactGapsOnly,
      onClick: () => {
        setShowContactGapsOnly(false);
        setShowRemovedUsers(false);
        setFilters((prev) => ({ ...prev, status: "consent_pending" }));
        setSelectedUserIds([]);
      },
    },
    {
      label: "No mobile",
      value: contactGapCount,
      detail: "Visible users",
      active: showContactGapsOnly,
      onClick: () => {
        setShowContactGapsOnly((current) => !current);
        setShowRemovedUsers(false);
        setSelectedUserIds([]);
      },
    },
    {
      label: "Removed",
      value: removedUserCount,
      detail: "Hidden users",
      active: showRemovedUsers,
      onClick: () => {
        setShowContactGapsOnly(false);
        setShowRemovedUsers((current) => !current);
        setSelectedUserIds([]);
      },
    },
  ];
  const resetUsersView = () => {
    setActiveTab("users");
    setPeopleSearchInput("");
    setPeopleSearch("");
    setShowRemovedUsers(false);
    setShowContactGapsOnly(false);
    setSelectedUserIds([]);
  };
  const qualityCards = [
    {
      label: "Duplicate phones",
      value: duplicatePhoneIssueGroups.length,
      detail: duplicatePhoneUserCount > 0 ? `${duplicatePhoneUserCount} users share numbers` : "No duplicate mobile numbers found",
      tone: duplicatePhoneIssueGroups.length > 0 ? "danger" : "success",
      actionLabel: "Search first duplicate",
      disabled: duplicatePhoneIssueGroups.length === 0,
      onClick: () => {
        const first = duplicatePhoneIssueGroups[0];
        if (!first) return;
        setActiveTab("users");
        setPeopleSearchInput(first.digits);
        setPeopleSearch(first.digits);
        setShowRemovedUsers(false);
        setShowContactGapsOnly(false);
        setSelectedUserIds([]);
      },
    },
    {
      label: "Missing mobile",
      value: contactGapUsers.length,
      detail: "Visible users without a phone number",
      tone: contactGapUsers.length > 0 ? "warning" : "success",
      actionLabel: "Show phone gaps",
      disabled: contactGapUsers.length === 0,
      onClick: () => {
        resetUsersView();
        setShowContactGapsOnly(true);
      },
    },
    {
      label: "Email in identity",
      value: emailIdentityUsers.length,
      detail: "Email appears in name or phone fields",
      tone: emailIdentityUsers.length > 0 ? "warning" : "success",
      actionLabel: "Review first",
      disabled: emailIdentityUsers.length === 0,
      onClick: () => {
        const first = emailIdentityUsers[0];
        if (first) void openUserDetail(first, "view");
      },
    },
    {
      label: "Disabled users",
      value: disabledVisibleUsers.length,
      detail: "Visible users with app access disabled",
      tone: disabledVisibleUsers.length > 0 ? "muted" : "success",
      actionLabel: "Review first",
      disabled: disabledVisibleUsers.length === 0,
      onClick: () => {
        const first = disabledVisibleUsers[0];
        if (first) void openUserDetail(first, "view");
      },
    },
    {
      label: "Tier mismatch",
      value: tierMismatchUsers.length,
      detail: "Intake tier differs from current tier",
      tone: tierMismatchUsers.length > 0 ? "warning" : "success",
      actionLabel: "Review first",
      disabled: tierMismatchUsers.length === 0,
      onClick: () => {
        const first = tierMismatchUsers[0];
        if (first) void openUserDetail(first, "tier");
      },
    },
    {
      label: "Removed users",
      value: removedUsers.length,
      detail: "Hidden from the normal Users table",
      tone: removedUsers.length > 0 ? "muted" : "success",
      actionLabel: "Show removed",
      disabled: removedUsers.length === 0,
      onClick: () => {
        resetUsersView();
        setShowRemovedUsers(true);
      },
    },
  ];
  const visibleQualityRows = [
    ...duplicatePhoneIssueGroups.flatMap((group) => group.users.map((user) => ({
      id: `duplicate-${group.digits}-${user.id}`,
      type: "Duplicate phone",
      severity: "High",
      user,
      detail: `Shares ${group.digits} with ${group.users.length - 1} other user${group.users.length === 2 ? "" : "s"}`,
      action: () => {
        setActiveTab("users");
        setPeopleSearchInput(group.digits);
        setPeopleSearch(group.digits);
        setShowRemovedUsers(false);
        setShowContactGapsOnly(false);
        setSelectedUserIds([]);
      },
    }))),
    ...contactGapUsers.map((user) => ({
      id: `missing-mobile-${user.id}`,
      type: "Missing mobile",
      severity: "Medium",
      user,
      detail: "No login, profile, or intake phone number.",
      action: () => void openUserDetail(user, "view"),
    })),
    ...emailIdentityUsers.map((user) => ({
      id: `email-identity-${user.id}`,
      type: "Email in identity",
      severity: "Medium",
      user,
      detail: "Email appears in name, phone, or profile name.",
      action: () => void openUserDetail(user, "view"),
    })),
    ...disabledVisibleUsers.map((user) => ({
      id: `disabled-visible-${user.id}`,
      type: "Disabled visible user",
      severity: "Low",
      user,
      detail: "User is visible but app access is disabled.",
      action: () => void openUserDetail(user, "view"),
    })),
    ...tierMismatchUsers.map((user) => ({
      id: `tier-mismatch-${user.id}`,
      type: "Tier mismatch",
      severity: "Medium",
      user,
      detail: `${tierLabel(user.intake_tier)} intake tier, ${tierLabel(user.tier)} current tier.`,
      action: () => void openUserDetail(user, "tier"),
    })),
  ].slice(0, 24);

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-4 text-[#2f2135] sm:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Lifecycle"
          subtitle="Users, forms, access."
        >
          <button className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-bold text-white" onClick={() => refresh().catch((err) => setMessage(err.message))}>Refresh</button>
        </AdminPageHeader>

        <AdminMenu />

        <SchemaHealthBanner health={schemaHealth} />

        <AdminActionCenter
          message={message}
          notices={adminActionHistory}
          onDismissMessage={() => setMessage("")}
          onOpenNotice={(notice) => setAdminActionNotice(notice)}
          onClearHistory={() => setAdminActionHistory([])}
        />

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {operationalCards.map((card) => {
            const toneClass = card.tone === "danger"
              ? "border-red-200 bg-red-50"
              : card.tone === "warning"
                ? "border-amber-200 bg-amber-50"
                : card.tone === "success"
                  ? "border-emerald-100 bg-emerald-50"
                  : card.tone === "muted"
                    ? "border-[#eadfd5] bg-[#fbf8f5]"
                    : "border-[#eadfd5] bg-white";
            const valueClass = card.tone === "danger"
              ? "text-red-700"
              : card.tone === "warning"
                ? "text-amber-800"
                : card.tone === "success"
                  ? "text-emerald-700"
                  : "text-[#2f2135]";

            return (
              <div key={card.label} className={`rounded-2xl border px-4 py-3 shadow-sm ${toneClass}`}>
                <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#8b7a73]">{card.label}</p>
                <p className={`mt-1 text-3xl font-black leading-none ${valueClass}`}>{String(card.value)}</p>
                <p className="mt-2 text-xs font-semibold leading-snug text-[#7d6b65]">{card.detail}</p>
              </div>
            );
          })}
        </div>

        <nav className="mt-3 flex flex-wrap gap-2">
          {adminTabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-xl px-4 py-2 text-sm font-bold shadow-sm ${activeTab === tab.id ? "bg-purple-700 text-white" : "border border-purple-100 bg-white text-purple-700 hover:bg-purple-50"}`}>
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "quality" && (
          <section className="mt-3 rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">Data Quality</h2>
                <p className="mt-1 max-w-3xl text-sm text-[#7d6b65]">
                  Cleanup signals from the loaded lifecycle users. Use this before bulk actions, invites, or production data changes.
                </p>
              </div>
              <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                {visibleQualityRows.length} issues shown
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {qualityCards.map((card) => {
                const toneClass = card.tone === "danger"
                  ? "border-red-200 bg-red-50"
                  : card.tone === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : card.tone === "success"
                      ? "border-emerald-100 bg-emerald-50"
                      : "border-[#eadfd5] bg-[#fbf8f5]";
                const valueClass = card.tone === "danger"
                  ? "text-red-700"
                  : card.tone === "warning"
                    ? "text-amber-800"
                    : card.tone === "success"
                      ? "text-emerald-700"
                      : "text-[#2f2135]";
                return (
                  <article key={card.label} className={`rounded-2xl border p-4 ${toneClass}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">{card.label}</p>
                        <p className={`mt-2 text-3xl font-black leading-none ${valueClass}`}>{card.value}</p>
                      </div>
                      <button
                        type="button"
                        className="rounded-[10px] bg-white px-3 py-2 text-xs font-black text-purple-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={card.disabled}
                        onClick={card.onClick}
                      >
                        {card.actionLabel}
                      </button>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#7d6b65]">{card.detail}</p>
                  </article>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-[#eadfd5]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eadfd5] px-4 py-3">
                <div>
                  <h3 className="font-black text-[#2f2135]">Review queue</h3>
                  <p className="mt-1 text-sm text-[#7d6b65]">First 24 loaded cleanup signals, ordered by operational risk.</p>
                </div>
                <button
                  type="button"
                  className="rounded-[10px] border border-purple-100 bg-white px-3 py-2 text-sm font-bold text-purple-700"
                  onClick={() => {
                    resetUsersView();
                    setFilters({ entry_point: "", user_type: "", status: "", tier: "" });
                  }}
                >
                  Clear filters
                </button>
              </div>
              {visibleQualityRows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm font-bold text-[#7d6b65]">
                  No cleanup issues found in the currently loaded users.
                </p>
              ) : (
                <div className="divide-y divide-[#eadfd5]">
                  {visibleQualityRows.map((row) => (
                    <div key={row.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[170px_minmax(0,1fr)_auto] lg:items-center">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">{row.type}</p>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                          row.severity === "High"
                            ? "bg-red-50 text-red-700"
                            : row.severity === "Medium"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-[#fbf8f5] text-[#6f625d]"
                        }`}>
                          {row.severity}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="break-words font-black text-[#2f2135]">{row.user.name}</p>
                        <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{row.detail}</p>
                        <p className="mt-1 text-xs font-semibold text-[#8b7a73]">
                          {userTypeLabel(row.user.user_type)} - {lifecycleStatusLabel(row.user.status)} - {tierLabel(row.user.tier)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-[10px] bg-[#2f2135] px-4 py-2 text-sm font-bold text-white"
                        onClick={row.action}
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "share" && (
          <div className="mt-3 grid gap-4">
            <section className="rounded-2xl border border-[#eadfd5] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-3xl leading-tight">Share signup invite</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#7d6b65]">Send the public VYVA invite by email, SMS, or WhatsApp. Add one email or phone number per line.</p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-purple-50 p-1 pl-4 text-sm font-bold text-purple-700">
                  <span>v2.vyva.life/invite</span>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-3 text-xs font-black text-purple-700 shadow-sm"
                    onClick={copySignupLink}
                  >
                    <Copy size={14} />
                    {copiedSignupLink ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {(["elder", "caregiver"] as SignupInviteType[]).map((inviteType) => {
                  const active = signupShare.inviteType === inviteType;
                  const Icon = inviteType === "elder" ? UserRound : UsersRound;
                  return (
                    <button
                      key={inviteType}
                      type="button"
                      onClick={() => setSignupShare((current) => ({ ...current, inviteType }))}
                      className={`flex min-h-[92px] items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition ${
                        active
                          ? "border-purple-300 bg-purple-50 shadow-[0_12px_28px_rgba(126,34,206,0.12)]"
                          : "border-[#eadfd5] bg-white hover:border-purple-200 hover:bg-purple-50/50"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-purple-700 text-white" : "bg-[#f7efff] text-purple-700"}`}>
                        <Icon size={21} />
                      </span>
                      <span>
                        <span className="block text-sm font-black text-[#2f2135]">
                          {inviteType === "elder" ? "Elder self-signup" : "Caregiver / family setup"}
                        </span>
                        <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#7d6b65]">
                          {inviteType === "elder"
                            ? "Recipient creates their own VYVA profile and app access."
                            : "Recipient starts proxy setup for someone they care for, with elder consent next."}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-[#eadfd5] bg-[#fffaf5] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-[#4d4351]">Email recipients</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-purple-700">{emailShareCount}</span>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-black text-purple-700 shadow-sm hover:bg-purple-50">
                          <Upload size={13} />
                          Upload
                          <input
                            type="file"
                            accept=".csv,.txt,text/csv,text/plain"
                            className="hidden"
                            onChange={uploadEmailRecipients}
                          />
                        </label>
                      </div>
                    </div>
                    <textarea
                      className="min-h-36 w-full resize-y rounded-2xl border border-[#e7dbd0] bg-white px-4 py-3 text-sm leading-relaxed outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                      placeholder="user@example.com&#10;second@example.com"
                      value={signupShare.emails}
                      onChange={(e) => setSignupShare({ ...signupShare, emails: e.target.value })}
                    />
                  </div>

                  <div className="rounded-[24px] border border-[#eadfd5] bg-[#fffaf5] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-[#4d4351]">Phone numbers</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-purple-700">{whatsappShareCount}</span>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-black text-purple-700 shadow-sm hover:bg-purple-50">
                          <Upload size={13} />
                          Upload
                          <input
                            type="file"
                            accept=".csv,.txt,text/csv,text/plain"
                            className="hidden"
                            onChange={uploadWhatsappRecipients}
                          />
                        </label>
                      </div>
                    </div>
                    <textarea
                      className="min-h-36 w-full resize-y rounded-2xl border border-[#e7dbd0] bg-white px-4 py-3 text-sm leading-relaxed outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                      placeholder="+34 612 345 678&#10;+44 7700 900123"
                      value={signupShare.whatsapp}
                      onChange={(e) => setSignupShare({ ...signupShare, whatsapp: e.target.value })}
                      onBlur={(e) => {
                        const normalized = normalizeWhatsappRecipientText(e.target.value);
                        if (normalized !== e.target.value.trim()) {
                          setSignupShare((current) => ({ ...current, whatsapp: normalized }));
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_220px] xl:grid-cols-1">
                  <div className="rounded-[24px] border border-[#eadfd5] bg-white p-4">
                    <Field label="Message override">
                      <textarea
                        className="min-h-28 w-full rounded-2xl border border-[#e7dbd0] px-4 py-3 text-sm leading-relaxed outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                        placeholder="Leave blank to use the selected language's default invite text."
                        value={signupShare.message}
                        onChange={(e) => setSignupShare({ ...signupShare, message: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="rounded-[24px] bg-[#f7efff] p-4">
                    <Field label="Invite language">
                      <select className="w-full rounded-2xl border border-[#e4d8ce] bg-white px-4 py-3 text-sm font-black text-[#2f2135]" value={signupShare.language} onChange={(e) => setSignupShare({ ...signupShare, language: e.target.value })}>
                        {languageOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </Field>
                    <button
                      type="button"
                      className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={sharingSignup || totalShareRecipients === 0}
                      onClick={shareSignupForm}
                    >
                      <Send size={16} />
                      {sharingSignup ? "Sending..." : totalShareRecipients > 0 ? `Send to ${totalShareRecipients}` : "Add recipients"}
                    </button>
                    <p className="mt-3 text-xs leading-relaxed text-[#7d6b65]">Delivery is attempted immediately and logged in Communications.</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "users" && (
          <section className="mt-3 rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">Users</h2>
                <p className="mt-1 text-sm text-[#7d6b65]">Signup, onboarding, consent, status, and organization visibility.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {searchIsUpdating && (
                  <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800">
                    Updating...
                  </span>
                )}
                <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                  {usersResultLabel}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {userWorkQueues.map((queue) => (
                <button
                  key={queue.label}
                  type="button"
                  onClick={queue.onClick}
                  className={`rounded-[14px] border px-3 py-3 text-left transition ${
                    queue.active
                      ? "border-purple-300 bg-purple-50 shadow-sm"
                      : "border-[#eadfd5] bg-[#fbf8f5] hover:border-purple-200 hover:bg-purple-50/60"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">{queue.label}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${queue.active ? "bg-purple-700 text-white" : "bg-white text-purple-700"}`}>
                      {queue.value}
                    </span>
                  </span>
                  <span className="sr-only">{queue.detail}</span>
                </button>
              ))}
            </div>

            <form
              className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                setPeopleSearch(peopleSearchInput.trim());
              }}
            >
              <input
                className="rounded-xl border border-[#e4d8ce] px-3 py-2.5 text-sm font-semibold"
                value={peopleSearchInput}
                onChange={(event) => setPeopleSearchInput(event.target.value)}
                placeholder="Search by name, phone, profile email, or login email"
              />
              <label className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold ${showRemovedUsers ? "border-amber-200 bg-amber-50 text-amber-900" : "border-purple-100 bg-white text-purple-700"}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-purple-700"
                    checked={showRemovedUsers}
                    onChange={(event) => {
                      setShowRemovedUsers(event.target.checked);
                      setShowContactGapsOnly(false);
                      setSelectedUserIds([]);
                      if (!event.target.checked && bulkUserAction === "restore") setBulkUserAction("disable");
                    }}
                  />
                  Show removed users
              </label>
              <button
                type="button"
                className="rounded-xl border border-purple-100 bg-white px-4 py-2.5 text-sm font-bold text-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!peopleSearch && !peopleSearchInput && !showRemovedUsers && !showContactGapsOnly}
                onClick={() => {
                  setPeopleSearchInput("");
                  setPeopleSearch("");
                  setShowRemovedUsers(false);
                  setShowContactGapsOnly(false);
                }}
              >
                Clear
              </button>
            </form>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {[
                ["entry_point", entryPoints],
                ["user_type", userTypes],
                ["status", statuses],
                ["tier", ["", ...planOptions.map((plan) => plan.value)]],
              ].map(([key, values]) => (
                <select key={key as keyof typeof filters} className="rounded-xl border border-[#e4d8ce] px-3 py-2.5 text-sm font-semibold" value={filters[key as keyof typeof filters]} onChange={(e) => setFilters((prev) => ({ ...prev, [key as keyof typeof filters]: e.target.value }))}>
                  {(values as string[]).map((value) => (
                    <option key={value} value={value}>
                      {!value
                        ? cleanLabel(String(key))
                        : key === "entry_point"
                          ? entryPointLabel(value)
                          : key === "user_type"
                            ? userTypeLabel(value)
                            : key === "status"
                              ? lifecycleStatusLabel(value)
                              : tierLabel(value)}
                    </option>
                  ))}
                </select>
              ))}
            </div>
            <div className={`mt-4 rounded-2xl border p-3 ${selectedUserCount > 0 ? "border-purple-100 bg-purple-50" : "border-[#eadfd5] bg-[#fbf8f5]"}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-black text-[#2f2135]">
                    {selectedUserCount > 0
                      ? `${selectedUserCount} selected${hasInvalidBulkSelection ? " (change action or clear selection)" : ""}`
                      : "Select users for bulk actions"}
                  </p>
                  <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-[#7d6b65]">{bulkUserActionImpact}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
                  <select
                    className="rounded-xl border border-[#e4d8ce] bg-white px-3 py-2.5 text-sm font-bold"
                    value={bulkUserAction}
                    onChange={(event) => {
                      setBulkUserAction(event.target.value as BulkUserAction);
                      setSelectedUserIds([]);
                    }}
                  >
                    <option value="disable">Disable app access</option>
                    <option value="delete_hide">Remove from Users</option>
                    {showRemovedUsers && <option value="restore">Restore to Users</option>}
                    <option value="assign_org">Assign organization</option>
                    <option value="change_tier">Change tier</option>
                    <option value="resend_invite">Resend invite</option>
                  </select>
                  {bulkUserAction === "assign_org" && (
                    <select
                      className="rounded-xl border border-[#e4d8ce] bg-white px-3 py-2.5 text-sm font-bold"
                      value={bulkUserOrganizationId}
                      onChange={(event) => setBulkUserOrganizationId(event.target.value)}
                    >
                      <option value="">Choose organization</option>
                      {organizations.filter((org) => org.is_active).map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                    </select>
                  )}
                  {bulkUserAction === "change_tier" && (
                    <select
                      className="rounded-xl border border-[#e4d8ce] bg-white px-3 py-2.5 text-sm font-bold"
                      value={bulkUserTier}
                      onChange={(event) => setBulkUserTier(event.target.value)}
                    >
                      {planOptions.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}
                    </select>
                  )}
                  <button
                    type="button"
                    className="rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canRunBulkUserAction}
                    title={bulkApplyBlockedReason || undefined}
                    onClick={runBulkUserAction}
                  >
                    {busyAction === "bulk-users" ? "Working..." : "Apply"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-purple-100 bg-white px-4 py-2.5 text-sm font-bold text-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={selectedUserCount === 0 || busyAction === "bulk-users"}
                    onClick={() => setSelectedUserIds([])}
                  >
                    Clear selected
                  </button>
                  {!canRunBulkUserAction && bulkApplyBlockedReason && (
                    <p className="sm:col-span-2 lg:basis-full lg:text-right text-xs font-black text-[#8b7a73]">{bulkApplyBlockedReason}</p>
                  )}
                </div>
              </div>
            </div>
            <IntakeTable
              users={displayedUsers}
              emptyMessage={usersLoadError || (showContactGapsOnly ? "All visible users have a mobile number." : "No users match the current filters yet.")}
              onView={(intake) => openUserDetail(intake, "view")}
              onTriggerConsent={triggerConsent}
              onToggleEnabled={toggleUser}
              onDelete={deleteUser}
              onRestore={restoreUser}
              busyAction={busyAction}
              selectedIds={selectedUserIds}
              canSelectUser={canSelectUserForBulk}
              onSelectionChange={setUserSelected}
              onSelectAllVisible={setAllVisibleUsersSelected}
            />
          </section>
        )}

        {activeTab === "forms" && (
          <section className="mt-5 max-w-2xl">
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-5">
              <h2 className="font-serif text-3xl">Create intake</h2>
              <p className="mt-2 text-sm text-[#7d6b65]">{creatingFamilyIntake ? "Family contact first, then the elder who needs consent." : "Basic profile details, matching the user settings form."}</p>
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
                <select className="rounded-2xl border px-4 py-3" value={newIntake.user_type} onChange={(e) => setNewIntake({ ...newIntake, user_type: e.target.value })}>{userTypes.filter(Boolean).map((v) => <option key={v} value={v}>{userTypeLabel(v)}</option>)}</select>
                {creatingFamilyIntake && (
                  <div className="rounded-3xl border border-purple-100 bg-purple-50 p-4">
                    <p className="font-bold text-purple-900">Elder details for consent</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Field label="Elder first name" required><input className="w-full rounded-2xl border px-4 py-3" value={newIntake.elder_first_name} onChange={(e) => setNewIntake({ ...newIntake, elder_first_name: e.target.value })} /></Field>
                      <Field label="Elder last name" required><input className="w-full rounded-2xl border px-4 py-3" value={newIntake.elder_last_name} onChange={(e) => setNewIntake({ ...newIntake, elder_last_name: e.target.value })} /></Field>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Field label="Elder phone" required><input className="w-full rounded-2xl border px-4 py-3" placeholder="+34 612 345 678" value={newIntake.elder_phone} onChange={(e) => setNewIntake({ ...newIntake, elder_phone: e.target.value })} /></Field>
                      <Field label="Elder email" optional><input className="w-full rounded-2xl border px-4 py-3" placeholder="elder@example.com" value={newIntake.elder_email} onChange={(e) => setNewIntake({ ...newIntake, elder_email: e.target.value })} /></Field>
                    </div>
                  </div>
                )}
                <Field label="How did they come in?">
                  <select className="w-full rounded-2xl border px-4 py-3" value={newIntake.entry_point} onChange={(e) => setNewIntake({ ...newIntake, entry_point: e.target.value })}>
                    {entryPoints.filter(Boolean).map((value) => (
                      <option key={value} value={value}>{entryPointLabel(value)}</option>
                    ))}
                  </select>
                </Field>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.tier} onChange={(e) => setNewIntake({ ...newIntake, tier: e.target.value })}>{planOptions.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.organization_id} onChange={(e) => setNewIntake({ ...newIntake, organization_id: e.target.value })}>
                  <option value="">No organization</option>
                  {organizations.filter((org) => org.is_active).map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={!canCreateIntake} onClick={createIntake}>Create intake</button>
              </div>
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
                  <p className="text-sm text-[#7d6b65]">{consentStatusLabel(attempt.status)} - {cleanLabel(attempt.channel)} - {new Date(attempt.created_at).toLocaleString()}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{["approved", "rejected", "no_answer"].map((status) => <button key={status} className="rounded-full border px-4 py-2 font-bold" onClick={() => markConsent(attempt, status)}>Mark {consentStatusLabel(status)}</button>)}</div>
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
              <Field label="Default tier for new org users">
                <select className="w-full rounded-2xl border px-4 py-3" value={newOrg.default_tier} onChange={(e) => setNewOrg({ ...newOrg, default_tier: e.target.value })}>{planOptions.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select>
              </Field>
              {duplicateOrg && (
                <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                  {duplicateOrg.name} already exists and is {duplicateOrg.is_active ? "active" : "archived"}. Use that organization or restore it instead of creating another copy.
                </p>
              )}
              <button
                className="mt-3 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!newOrg.name.trim() || Boolean(duplicateOrg)}
                onClick={createOrg}
              >
                Create organization
              </button>
              <p className="mt-4 text-sm text-[#7d6b65]">Bulk upload requires CSV. Columns: first_name, last_name, phone. Optional: preferred_name, date_of_birth, gender, whatsapp, email, language, timezone, user_type, tier.</p>
            </div>
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-5">
              <div className="mb-4 flex gap-2">
                {(["active", "archived", "all"] as const).map((value) => <button key={value} onClick={() => setOrgFilter(value)} className={`rounded-full px-4 py-2 font-bold ${orgFilter === value ? "bg-purple-700 text-white" : "border text-purple-700"}`}>{value}</button>)}
              </div>
              {visibleOrganizations.map((org) => {
                const isEditing = editingOrgId === org.id;
                const duplicateEditOrg = isEditing ? findDuplicateOrg(orgDraft.name, org.id) : null;
                const canSaveOrg = Boolean(orgDraft.name.trim()) && !duplicateEditOrg;

                return (
                  <div key={org.id} className="mb-3 rounded-3xl border p-4">
                    {isEditing ? (
                      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                        <Field label="Organization name">
                          <input className="w-full rounded-2xl border px-4 py-3" value={orgDraft.name} onChange={(e) => setOrgDraft({ ...orgDraft, name: e.target.value })} />
                        </Field>
                        <Field label="Default tier for new users">
                          <select className="w-full rounded-2xl border px-4 py-3" value={orgDraft.default_tier} onChange={(e) => setOrgDraft({ ...orgDraft, default_tier: e.target.value })}>{planOptions.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select>
                        </Field>
                        {duplicateEditOrg && (
                          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 md:col-span-2">
                            {duplicateEditOrg.name} already exists and is {duplicateEditOrg.is_active ? "active" : "archived"}. Choose a different name.
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="font-bold">{org.name}</p>
                        <p className="text-sm text-[#7d6b65]">{org.slug} - default tier: {tierLabel(org.default_tier)} - {org.is_active ? "Active" : "Archived"}</p>
                      </>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button className="rounded-full bg-purple-700 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canSaveOrg} onClick={() => saveOrg(org)}>Save changes</button>
                          <button className="rounded-full border px-4 py-2 font-bold" onClick={cancelEditOrg}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="rounded-full border px-4 py-2 font-bold" onClick={() => startEditOrg(org)}>Edit organization</button>
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
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
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

        {activeTab === "tiers" && <TierSection plans={plans} setPlans={setPlans} onSave={savePlan} />}
        {activeTab === "communications" && <CommunicationsSection communications={communications} providerStatus={communicationProviderStatus} />}
        {activeTab === "analytics" && <AnalyticsSection summary={summary} />}
      </section>

      {selectedUser && (
        <UserDetailModal
          detail={selectedUser}
          draft={selectedDraft}
          setDraft={setSelectedDraft}
          organizations={organizations}
          planOptions={planOptions}
          statusMessage={userDetailMessage}
          saving={savingUserDetail}
          caregiverInviteDraft={caregiverInviteDraft}
          setCaregiverInviteDraft={setCaregiverInviteDraft}
          caregiverInviteBusy={sendingCaregiverInvite}
          scheduleBusyAction={busyAction}
          deleting={busyAction === `delete:${selectedUser.intake.id}`}
          restoring={busyAction === `restore:${selectedUser.intake.id}`}
          deletingLoginUid={busyAction?.startsWith("delete-login:") ? busyAction.slice("delete-login:".length) : null}
          onClose={() => setSelectedUser(null)}
          onSave={saveUserDetail}
          onSendCaregiverInvite={sendCaregiverInvite}
          onToggle={(enable) => toggleUser(selectedUser.intake, enable)}
          onDelete={() => deleteUser(selectedUser.intake)}
          onRestore={() => restoreUser(selectedUser.intake)}
          onDeleteLoginAccount={deleteLoginAccount}
          newEvent={newEvent}
          setNewEvent={setNewEvent}
          onCreateEvent={createScheduledEventForUser}
          onEventStatus={setEventStatus}
          onEventTime={updateEventTime}
          onSupportSave={saveSupportSchedule}
          onSupportStatus={setSupportStatus}
        />
      )}
      {signupShareNotice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2f2135]/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="signup-share-result-title">
          <div className="w-full max-w-lg rounded-[2rem] border border-[#eadfd5] bg-white p-6 text-[#2f2135] shadow-[0_24px_80px_rgba(47,33,53,0.28)]">
            <p className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em] ${
              signupShareNotice.tone === "success"
                ? "bg-emerald-50 text-emerald-800"
                : signupShareNotice.tone === "warning"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-red-50 text-red-700"
            }`}>
              {signupShareNotice.tone === "success" ? "Sent" : signupShareNotice.tone === "warning" ? "Partially sent" : "Failed"}
            </p>
            <h2 id="signup-share-result-title" className="mt-3 font-serif text-3xl leading-tight">{signupShareNotice.title}</h2>
            {signupShareNotice.details.length > 0 && (
              <ul className="mt-4 max-h-56 space-y-2 overflow-auto rounded-2xl bg-[#fbf8f5] p-3 text-sm font-semibold text-[#5f514b]">
                {signupShareNotice.details.map((detail, index) => (
                  <li key={`${detail}-${index}`}>{detail}</li>
                ))}
              </ul>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-2xl border border-[#eadfd5] bg-white px-5 py-3 text-sm font-bold text-[#2f2135] hover:border-purple-200 hover:text-purple-700"
                onClick={() => {
                  setSignupShareNotice(null);
                  setActiveTab("communications");
                }}
              >
                View communications
              </button>
              <button
                type="button"
                className="rounded-2xl bg-purple-700 px-5 py-3 text-sm font-bold text-white hover:bg-purple-800"
                onClick={() => setSignupShareNotice(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {adminActionNotice && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#2f2135]/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="admin-action-result-title">
          <div className="w-full max-w-lg rounded-[2rem] border border-[#eadfd5] bg-white p-6 text-[#2f2135] shadow-[0_24px_80px_rgba(47,33,53,0.28)]">
            <p className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em] ${
              adminActionNotice.tone === "success"
                ? "bg-emerald-50 text-emerald-800"
                : adminActionNotice.tone === "warning"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-red-50 text-red-700"
            }`}>
              {adminActionNotice.label}
            </p>
            <h2 id="admin-action-result-title" className="mt-3 font-serif text-3xl leading-tight">{adminActionNotice.title}</h2>
            {adminActionNotice.details.length > 0 && (
              <div className="mt-4 space-y-2 rounded-2xl bg-[#fbf8f5] p-4 text-sm font-semibold leading-relaxed text-[#5f514b]">
                {adminActionNotice.details.map((detail, index) => (
                  <p key={`${detail}-${index}`}>{detail}</p>
                ))}
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {adminActionNotice.secondaryAction && (
                <button
                  type="button"
                  className="rounded-2xl border border-[#eadfd5] bg-white px-5 py-3 text-sm font-bold text-[#2f2135] hover:border-purple-200 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={adminSecondaryActionBusy}
                  onClick={adminActionNotice.secondaryAction.onClick}
                >
                  {adminSecondaryActionBusy
                    ? adminActionNotice.secondaryAction.busyLabel ?? "Working..."
                    : adminActionNotice.secondaryAction.label}
                </button>
              )}
              <button
                type="button"
                className="rounded-2xl bg-purple-700 px-5 py-3 text-sm font-bold text-white hover:bg-purple-800"
                onClick={() => setAdminActionNotice(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
