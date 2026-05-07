// src/pages/onboarding/sections/CareTeamFlow.tsx
// Roster view + 4-step add flow: Who → Details → Consent → Invite → Done
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ToggleRow } from "@/components/onboarding/ToggleRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Role = "family" | "carer" | "doctor";
type InviteChannel = "whatsapp" | "sms";
type Step = 1 | 2 | 3 | 4 | 5;
type Mode = "roster" | "adding";

interface PersonForm {
  name: string;
  relationship: string;
  phone: string;
  whatsapp: string;
  email: string;
}

interface ConsentState {
  daily_summary: boolean;
  mood_updates: boolean;
  appointments: boolean;
  medication_alerts: boolean;
  health_reports: boolean;
  vital_signs: boolean;
  cognitive_results: boolean;
  emergency_alerts: boolean;
  inactivity_alerts: boolean;
  dashboard_access: boolean;
}

interface TeamMember {
  id: string;
  invitee_name: string;
  invitee_phone: string | null;
  invitee_email: string | null;
  role: string;
  relationship: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

const defaultConsent = (role: Role): ConsentState => ({
  daily_summary:       true,
  mood_updates:        role !== "doctor",
  appointments:        true,
  medication_alerts:   role === "carer",
  health_reports:      role === "doctor",
  vital_signs:         role === "carer" || role === "doctor",
  cognitive_results:   false,
  emergency_alerts:    true,
  inactivity_alerts:   role !== "doctor",
  dashboard_access:    false,
});

const ROLE_LABEL_KEYS: Record<string, string> = {
  family_member: "onboarding.careTeam.roles.familyMember",
  caregiver:     "onboarding.careTeam.roles.caregiver",
  doctor:        "onboarding.careTeam.roles.doctor",
  family:        "onboarding.careTeam.roles.familyMember",
  carer:         "onboarding.careTeam.roles.caregiver",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-600",
  expired:  "bg-gray-100 text-gray-500",
  revoked:  "bg-red-100 text-red-600",
};

const STATUS_KEY_MAP: Record<string, string> = {
  pending:  "onboarding.careTeam.status.pending",
  accepted: "onboarding.careTeam.status.accepted",
  declined: "onboarding.careTeam.status.declined",
  expired:  "onboarding.careTeam.status.expired",
  revoked:  "onboarding.careTeam.status.revoked",
};

const ROLE_OPTIONS: Array<{ id: Role; emoji: string; titleKey: string; subKey: string; bg: string }> = [
  { id: "family", emoji: "👨‍👩‍👧", titleKey: "onboarding.careTeam.roleOptions.family.title", subKey: "onboarding.careTeam.roleOptions.family.sub", bg: "#ede9fe" },
  { id: "carer",  emoji: "👩‍⚕️", titleKey: "onboarding.careTeam.roleOptions.carer.title",  subKey: "onboarding.careTeam.roleOptions.carer.sub",  bg: "#e1f5ee" },
  { id: "doctor", emoji: "👨‍⚕️", titleKey: "onboarding.careTeam.roleOptions.doctor.title", subKey: "onboarding.careTeam.roleOptions.doctor.sub", bg: "#faeeda" },
];

const CARE_TEAM_RELATIONSHIP_KEYS = [
  { value: "son",               labelKey: "onboarding.careTeam.relationships.son" },
  { value: "daughter",          labelKey: "onboarding.careTeam.relationships.daughter" },
  { value: "spouse_partner",    labelKey: "onboarding.careTeam.relationships.spousePartner" },
  { value: "sibling",           labelKey: "onboarding.careTeam.relationships.sibling" },
  { value: "friend",            labelKey: "onboarding.careTeam.relationships.friend" },
  { value: "neighbour",         labelKey: "onboarding.careTeam.relationships.neighbour" },
  { value: "professional_carer",labelKey: "onboarding.careTeam.relationships.professionalCarer" },
  { value: "gp",                labelKey: "onboarding.careTeam.relationships.gp" },
  { value: "specialist_doctor", labelKey: "onboarding.careTeam.relationships.specialistDoctor" },
  { value: "other",             labelKey: "onboarding.careTeam.relationships.other" },
];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
}

const StepDots = ({ current }: { current: number }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 mb-4">
      {[1,2,3,4].map((n) => (
        <div key={n} className={cn(
          "h-2 rounded-full transition-all",
          n < current ? "w-2 bg-[#c9890a]" :
          n === current ? "w-5 bg-[#6b21a8]" : "w-2 bg-purple-100"
        )} />
      ))}
      <span className="text-[10px] text-gray-400 ml-1">{t("onboarding.careTeam.stepDots", { current })}</span>
    </div>
  );
};

export default function CareTeamFlow() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const getRoleLabel = (role: string) => {
    const key = ROLE_LABEL_KEYS[role];
    return key ? t(key) : role;
  };

  const getRelationshipLabel = (relationship: string) => {
    const entry = CARE_TEAM_RELATIONSHIP_KEYS.find((r) => r.value === relationship);
    return entry ? t(entry.labelKey) : relationship;
  };

  const getStatusLabel = (status: string) => {
    const key = STATUS_KEY_MAP[status];
    return key ? t(key) : status;
  };

  const getStatusClass = (status: string) => {
    return STATUS_BADGE_CLASSES[status] ?? STATUS_BADGE_CLASSES.pending;
  };

  // 'roster' = show existing team list view
  // 'adding' = show the 4-step add-person flow
  const [mode, setMode] = useState<Mode>("roster");
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<Role>("family");
  const [person, setPerson] = useState<PersonForm>({ name:"", relationship:"", phone:"", whatsapp:"", email:"" });
  const [consent, setConsent] = useState<ConsentState>(defaultConsent("family"));
  const [inviteChannel, setInviteChannel] = useState<InviteChannel>("whatsapp");
  const [saving, setSaving] = useState(false);
  // ID of the member card currently showing inline revoke confirmation
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(null);
  // ID of the member currently being acted on (revoke or resend in flight)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const setP = (f: keyof PersonForm, v: string) => setPerson((p) => ({ ...p, [f]: v }));
  const setC = (f: keyof ConsentState, v: boolean) => setConsent((p) => ({ ...p, [f]: v }));

  const selectRole = (r: Role) => {
    setRole(r);
    setConsent(defaultConsent(r));
  };

  const { data: rosterData, isLoading: rosterLoading, isError: rosterError } = useQuery<{ members: TeamMember[] }>({
    queryKey: ["/api/onboarding/careteam"],
  });

  const members = rosterData?.members ?? [];

  const startAddFlow = () => {
    setPerson({ name:"", relationship:"", phone:"", whatsapp:"", email:"" });
    setRole("family");
    setConsent(defaultConsent("family"));
    setStep(1);
    setMode("adding");
  };

  const backToRoster = () => {
    setStep(1);
    setMode("roster");
  };

  const revokeInvitation = async (id: string) => {
    setConfirmingRevokeId(null);
    setActionLoadingId(id);
    let res: Response | undefined;
    try {
      res = await apiFetch(`/api/onboarding/careteam/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/careteam"] });
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: t("onboarding.careTeam.toastRemoveError"), description: msg, variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const resendInvitation = async (id: string) => {
    setActionLoadingId(id);
    let res: Response | undefined;
    try {
      res = await apiFetch(`/api/onboarding/careteam/${id}/resend`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/careteam"] });
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: t("onboarding.careTeam.toastResendError"), description: msg, variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendInvite = async () => {
    if (saving) return;
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/careteam", {
        method: "POST",
        body: JSON.stringify({ role, person, consent, invite_channel: inviteChannel }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/careteam"] });
      setStep(5);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: t("onboarding.careTeam.toastInviteError"), description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ═══════════════════════════════════════════════════
     ROSTER MODE
     Effective mode: if loading is done and no members exist,
     we treat the mode as 'adding' automatically (skip roster).
  ═══════════════════════════════════════════════════ */
  const effectiveMode: Mode = mode === "roster" && !rosterLoading && !rosterError && members.length === 0
    ? "adding"
    : mode;

  if (effectiveMode === "roster") {
    if (rosterLoading) {
      return (
        <PhoneFrame subtitle={t("onboarding.careTeam.frame.roster")} showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
          <div className="flex items-center justify-center py-20">
            <div className="text-sm text-gray-400">{t("onboarding.careTeam.loading")}</div>
          </div>
        </PhoneFrame>
      );
    }

    if (rosterError) {
      return (
        <PhoneFrame subtitle={t("onboarding.careTeam.frame.roster")} showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
          <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
            <div className="text-3xl">⚠️</div>
            <div>
              <p className="text-sm font-bold text-gray-900">{t("onboarding.careTeam.errorTitle")}</p>
              <p className="text-xs text-gray-500 mt-1">{t("onboarding.careTeam.errorMessage")}</p>
            </div>
            <Button
              data-testid="button-careteam-retry"
              variant="outline"
              onClick={() => queryClient.refetchQueries({ queryKey: ["/api/onboarding/careteam"] })}
              className="border-purple-200 text-purple-700"
            >
              {t("onboarding.careTeam.retry")}
            </Button>
          </div>
        </PhoneFrame>
      );
    }

    // Show the roster
    return (
      <PhoneFrame subtitle={t("onboarding.careTeam.frame.roster")} showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div>
            <p className="text-xs text-gray-500 leading-relaxed">
              {t("onboarding.careTeam.rosterSubtitle")}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {members.map((m) => {
              const badgeClass = getStatusClass(m.status);
              const badgeLabel = getStatusLabel(m.status);
              const isLoading = actionLoadingId === m.id;
              const isConfirming = confirmingRevokeId === m.id;
              const canRevoke = m.status === "pending" || m.status === "accepted";
              const canResend = m.status === "expired";

              return (
                <div
                  key={m.id}
                  data-testid={`card-careteam-member-${m.id}`}
                  className="flex flex-col border border-purple-100 rounded-xl bg-white overflow-hidden"
                >
                  {/* Main row */}
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-10 h-10 rounded-full bg-[#6b21a8] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {initials(m.invitee_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{m.invitee_name}</p>
                      <p className="text-[10px] text-purple-600 font-semibold">
                        {getRoleLabel(m.role)}
                        {m.relationship ? ` · ${getRelationshipLabel(m.relationship)}` : ""}
                      </p>
                      {m.invitee_phone && (
                        <p className="text-[10px] text-gray-400 truncate">{m.invitee_phone}</p>
                      )}
                    </div>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0", badgeClass)}>
                      {badgeLabel}
                    </span>
                  </div>

                  {/* Action buttons — shown for actionable statuses */}
                  {(canRevoke || canResend) && !isConfirming && (
                    <div className="border-t border-purple-50 px-3 py-2 flex justify-end">
                      {canResend && (
                        <button
                          type="button"
                          data-testid={`button-careteam-resend-${m.id}`}
                          disabled={isLoading}
                          onClick={() => resendInvitation(m.id)}
                          className="text-[11px] font-bold text-purple-700 hover:text-purple-900 disabled:opacity-40 px-2 py-1"
                        >
                          {isLoading ? t("onboarding.careTeam.resending") : t("onboarding.careTeam.resendInvite")}
                        </button>
                      )}
                      {canRevoke && (
                        <button
                          type="button"
                          data-testid={`button-careteam-revoke-${m.id}`}
                          disabled={isLoading}
                          onClick={() => setConfirmingRevokeId(m.id)}
                          className="text-[11px] font-bold text-red-500 hover:text-red-700 disabled:opacity-40 px-2 py-1"
                        >
                          {m.status === "accepted" ? t("onboarding.careTeam.removeAccess") : t("onboarding.careTeam.cancelInvite")}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Inline revoke confirmation */}
                  {isConfirming && (
                    <div className="border-t border-red-100 bg-red-50 px-3 py-2.5">
                      <p className="text-[11px] text-red-700 font-semibold mb-2">
                        {m.status === "accepted"
                          ? t("onboarding.careTeam.confirmRemoveAccess", { name: m.invitee_name })
                          : t("onboarding.careTeam.confirmCancelInvite", { name: m.invitee_name })}
                      </p>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          data-testid={`button-careteam-revoke-cancel-${m.id}`}
                          onClick={() => setConfirmingRevokeId(null)}
                          className="text-[11px] font-bold text-gray-500 hover:text-gray-700 px-2 py-1"
                        >
                          {t("onboarding.careTeam.keep")}
                        </button>
                        <button
                          type="button"
                          data-testid={`button-careteam-revoke-confirm-${m.id}`}
                          disabled={isLoading}
                          onClick={() => revokeInvitation(m.id)}
                          className="text-[11px] font-bold text-red-600 hover:text-red-800 disabled:opacity-40 px-2 py-1"
                        >
                          {isLoading ? t("onboarding.careTeam.removing") : m.status === "accepted" ? t("onboarding.careTeam.yesRemove") : t("onboarding.careTeam.yesCancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-purple-50 border-l-2 border-[#6b21a8] rounded-lg px-3 py-2 text-xs text-purple-700">
            {t("onboarding.careTeam.rosterInfoBanner")}
          </div>

          <Button
            data-testid="button-careteam-add-another"
            onClick={startAddFlow}
            className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]"
          >
            {t("onboarding.careTeam.addAnother")}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/onboarding/profile")}
            className="w-full h-11 border-purple-200 text-purple-700"
          >
            {t("onboarding.careTeam.doneBack")}
          </Button>
        </div>
      </PhoneFrame>
    );
  }

  /* ═══════════════════════════════════════════════════
     ADDING MODE — STEP 1: Who to add
  ═══════════════════════════════════════════════════ */
  if (step === 1) return (
    <PhoneFrame
      subtitle={t("onboarding.careTeam.frame.step1")}
      showBack
      onBack={() => members.length > 0 ? backToRoster() : navigate("/onboarding/profile")}
      showAllSections
      onAllSections={() => navigate("/onboarding/profile")}
    >
      <div className="flex flex-col gap-4 px-4 py-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t("onboarding.careTeam.step1.heading")}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {t("onboarding.careTeam.step1.subtitle")}
          </p>
        </div>

        <div className="bg-purple-50 border-l-2 border-[#6b21a8] rounded-lg px-3 py-2 text-xs text-purple-700">
          {t("onboarding.careTeam.step1.infoBanner")}
        </div>

        <div className="flex flex-col gap-3">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => selectRole(opt.id)}
              data-testid={`button-careteam-role-${opt.id}`}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                role === opt.id ? "border-[#6b21a8] bg-purple-50" : "border-purple-100 bg-white hover:border-purple-200"
              )}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: opt.bg }}
              >{opt.emoji}</div>
              <div>
                <p className="text-sm font-bold text-gray-900">{t(opt.titleKey)}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t(opt.subKey)}</p>
              </div>
            </button>
          ))}
        </div>

        <Button
          data-testid="button-careteam-step1-continue"
          onClick={() => setStep(2)}
          className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]"
        >
          {t("onboarding.careTeam.step1.continue")}
        </Button>
      </div>
    </PhoneFrame>
  );

  /* ═══════════════════════════════════════════════════
     ADDING MODE — STEP 2: Their details
  ═══════════════════════════════════════════════════ */
  if (step === 2) return (
    <PhoneFrame subtitle={t("onboarding.careTeam.frame.step2")} showBack onBack={() => setStep(1)}>
      <div className="flex flex-col gap-4 px-4 py-5">
        <StepDots current={2} />
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t("onboarding.careTeam.step2.heading")}</h2>
          <p className="text-xs text-gray-500 mt-1">{t("onboarding.careTeam.step2.subtitle")}</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-600">{t("onboarding.careTeam.step2.labelName")}</Label>
          <Input
            data-testid="input-careteam-name"
            placeholder={t("onboarding.careTeam.step2.placeholderName")}
            value={person.name}
            onChange={(e) => setP("name", e.target.value)}
            className="h-11 border-purple-200"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-600">{t("onboarding.careTeam.step2.labelRelationship")}</Label>
          <Select onValueChange={(v) => setP("relationship", v)}>
            <SelectTrigger className="h-11 border-purple-200">
              <SelectValue placeholder={t("onboarding.careTeam.step2.labelRelationship")} />
            </SelectTrigger>
            <SelectContent>
              {CARE_TEAM_RELATIONSHIP_KEYS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{t(r.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-600">{t("onboarding.careTeam.step2.labelPhone")}</Label>
          <Input
            data-testid="input-careteam-phone"
            type="tel"
            placeholder={t("onboarding.careTeam.step2.placeholderPhone")}
            value={person.phone}
            onChange={(e) => setP("phone", e.target.value)}
            className="h-11 border-purple-200"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-600">{t("onboarding.careTeam.step2.labelWhatsapp")}</Label>
          <Input
            type="tel"
            placeholder={t("onboarding.careTeam.step2.placeholderWhatsapp")}
            value={person.whatsapp}
            onChange={(e) => setP("whatsapp", e.target.value)}
            className="h-11 border-purple-200"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-600">{t("onboarding.careTeam.step2.labelEmail")}</Label>
          <Input
            type="email"
            placeholder={t("onboarding.careTeam.step2.placeholderEmail")}
            value={person.email}
            onChange={(e) => setP("email", e.target.value)}
            className="h-11 border-purple-200"
          />
        </div>

        <Button
          onClick={() => setStep(3)}
          disabled={!person.name.trim() || !person.phone.trim()}
          className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f] disabled:opacity-40"
        >
          {t("onboarding.careTeam.step2.continue")}
        </Button>
      </div>
    </PhoneFrame>
  );

  /* ═══════════════════════════════════════════════════
     ADDING MODE — STEP 3: Consent
  ═══════════════════════════════════════════════════ */
  if (step === 3) return (
    <PhoneFrame subtitle={t("onboarding.careTeam.frame.step3")} showBack onBack={() => setStep(2)}>
      <div className="flex flex-col gap-4 px-4 py-5">
        <StepDots current={3} />
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t("onboarding.careTeam.step3.heading", { name: person.name || t("onboarding.careTeam.nameFallbackSubject") })}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {t("onboarding.careTeam.step3.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3 border-2 border-[#6b21a8] rounded-xl p-3 bg-purple-50">
          <div className="w-10 h-10 rounded-full bg-[#6b21a8] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initials(person.name)}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{person.name || "—"}</p>
            <p className="text-[10px] text-purple-600 font-semibold capitalize">
              {getRoleLabel(role)}
            </p>
            <p className="text-[10px] text-gray-500">{getRelationshipLabel(person.relationship)} · {person.phone}</p>
          </div>
        </div>

        <div className="border border-purple-100 rounded-xl overflow-hidden">
          <div className="bg-purple-50 px-3 py-2 text-[10px] font-bold text-purple-700 uppercase tracking-wide">{t("onboarding.careTeam.step3.sectionUpdates")}</div>
          <div className="px-3 divide-y divide-purple-50">
            <ToggleRow title={t("onboarding.careTeam.step3.toggleDailySummaryTitle")} description={t("onboarding.careTeam.step3.toggleDailySummaryDesc")} checked={consent.daily_summary} onChange={(v) => setC("daily_summary", v)} />
            <ToggleRow title={t("onboarding.careTeam.step3.toggleMoodTitle")} description={t("onboarding.careTeam.step3.toggleMoodDesc")} checked={consent.mood_updates} onChange={(v) => setC("mood_updates", v)} />
            <ToggleRow title={t("onboarding.careTeam.step3.toggleAppointmentsTitle")} description={t("onboarding.careTeam.step3.toggleAppointmentsDesc")} checked={consent.appointments} onChange={(v) => setC("appointments", v)} />
          </div>
        </div>

        <div className="border border-purple-100 rounded-xl overflow-hidden">
          <div className="bg-purple-50 px-3 py-2 text-[10px] font-bold text-purple-700 uppercase tracking-wide">{t("onboarding.careTeam.step3.sectionHealth")}</div>
          <div className="px-3 divide-y divide-purple-50">
            <ToggleRow title={t("onboarding.careTeam.step3.toggleMedicationTitle")} description={t("onboarding.careTeam.step3.toggleMedicationDesc")} checked={consent.medication_alerts} onChange={(v) => setC("medication_alerts", v)} />
            <ToggleRow title={t("onboarding.careTeam.step3.toggleHealthReportsTitle")} description={t("onboarding.careTeam.step3.toggleHealthReportsDesc")} checked={consent.health_reports} onChange={(v) => setC("health_reports", v)} />
            <ToggleRow title={t("onboarding.careTeam.step3.toggleVitalSignsTitle")} description={t("onboarding.careTeam.step3.toggleVitalSignsDesc")} checked={consent.vital_signs} onChange={(v) => setC("vital_signs", v)} />
            <ToggleRow title={t("onboarding.careTeam.step3.toggleCognitiveTitle")} description={t("onboarding.careTeam.step3.toggleCognitiveDesc")} checked={consent.cognitive_results} onChange={(v) => setC("cognitive_results", v)} />
          </div>
        </div>

        <div className="border border-purple-100 rounded-xl overflow-hidden">
          <div className="bg-purple-50 px-3 py-2 text-[10px] font-bold text-purple-700 uppercase tracking-wide">{t("onboarding.careTeam.step3.sectionSafety")}</div>
          <div className="px-3 divide-y divide-purple-50">
            <ToggleRow title={t("onboarding.careTeam.step3.toggleEmergencyTitle")} description={t("onboarding.careTeam.step3.toggleEmergencyDesc")} checked={consent.emergency_alerts} onChange={(v) => setC("emergency_alerts", v)} variant="amber" />
            <ToggleRow title={t("onboarding.careTeam.step3.toggleInactivityTitle")} description={t("onboarding.careTeam.step3.toggleInactivityDesc")} checked={consent.inactivity_alerts} onChange={(v) => setC("inactivity_alerts", v)} />
          </div>
        </div>

        <div className="border border-purple-100 rounded-xl overflow-hidden">
          <div className="bg-purple-50 px-3 py-2 text-[10px] font-bold text-purple-700 uppercase tracking-wide">{t("onboarding.careTeam.step3.sectionDashboard")}</div>
          <div className="px-3">
            <ToggleRow
              title={t("onboarding.careTeam.step3.toggleDashboardTitle")}
              description={t("onboarding.careTeam.step3.toggleDashboardDesc", { name: person.name || t("onboarding.careTeam.nameFallbackSubject") })}
              checked={consent.dashboard_access}
              onChange={(v) => setC("dashboard_access", v)}
            />
          </div>
        </div>

        <p className="text-[10px] text-gray-400 text-center">
          {t("onboarding.careTeam.step3.footerNote")}
        </p>

        <Button
          onClick={() => setStep(4)}
          className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]"
        >
          {t("onboarding.careTeam.step3.confirm")}
        </Button>
      </div>
    </PhoneFrame>
  );

  /* ═══════════════════════════════════════════════════
     ADDING MODE — STEP 4: Send invite
  ═══════════════════════════════════════════════════ */
  if (step === 4) return (
    <PhoneFrame subtitle={t("onboarding.careTeam.frame.step4")} showBack onBack={() => setStep(3)}>
      <div className="flex flex-col gap-4 px-4 py-5">
        <StepDots current={4} />
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t("onboarding.careTeam.step4.heading", { name: person.name || t("onboarding.careTeam.nameFallbackObject") })}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {t("onboarding.careTeam.step4.subtitle", { name: person.name || t("onboarding.careTeam.nameFallbackObject") })}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {([
            { id: "whatsapp" as InviteChannel, emoji: "💬", titleKey: "onboarding.careTeam.step4.channelWhatsapp", contact: person.whatsapp || person.phone, bg: "#e1f5ee" },
            { id: "sms"      as InviteChannel, emoji: "📱", titleKey: "onboarding.careTeam.step4.channelSms",      contact: person.phone,                   bg: "#e6f1fb" },
          ]).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setInviteChannel(opt.id)}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                inviteChannel === opt.id ? "border-[#6b21a8] bg-purple-50" : "border-purple-100 bg-white hover:border-purple-200"
              )}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xl flex-shrink-0" style={{ background: opt.bg }}>{opt.emoji}</div>
              <div>
                <p className="text-sm font-bold text-gray-900">{t(opt.titleKey)}</p>
                <p className="text-xs text-gray-500">{t("onboarding.careTeam.step4.channelTo", { contact: opt.contact })}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-[9px] font-bold text-green-700 uppercase tracking-wider mb-2">{t("onboarding.careTeam.step4.messagePreviewLabel")}</p>
          <p className="text-xs text-green-800 leading-relaxed">
            {t("onboarding.careTeam.step4.messagePreview", { name: person.name || t("onboarding.careTeam.nameFallbackGreeting") })}
            <br /><br />
            <span className="text-teal-700 font-semibold">vyva.ai/join/abc123 →</span>
          </p>
        </div>

        <Button
          onClick={handleSendInvite}
          disabled={saving}
          className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]"
        >
          {saving ? t("onboarding.careTeam.step4.sending") : t("onboarding.careTeam.step4.sendInvitation")}
        </Button>
      </div>
    </PhoneFrame>
  );

  /* ═══════════════════════════════════════════════════
     ADDING MODE — STEP 5: Done
  ═══════════════════════════════════════════════════ */
  return (
    <PhoneFrame subtitle={t("onboarding.careTeam.frame.roster")}>
      <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
        <div className="w-14 h-14 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center text-3xl">✅</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{t("onboarding.careTeam.step5.heading", { name: person.name })}</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            {t("onboarding.careTeam.step5.subtitle", { name: person.name })}
          </p>
        </div>

        <div className="w-full flex items-center gap-3 border-2 border-[#6b21a8] rounded-xl p-3 bg-purple-50">
          <div className="w-10 h-10 rounded-full bg-[#6b21a8] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initials(person.name)}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-gray-900">{person.name}</p>
            <p className="text-[10px] text-purple-600 font-semibold">{getRelationshipLabel(person.relationship)}</p>
            <p className="text-[10px] text-gray-500">{t("onboarding.careTeam.step5.invitationSent")}</p>
          </div>
          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">{t("onboarding.careTeam.status.pending")}</span>
        </div>

        <div className="w-full bg-purple-50 border-l-2 border-[#6b21a8] rounded-lg px-3 py-2 text-xs text-purple-700 text-left">
          {t("onboarding.careTeam.step5.infoBanner", { name: person.name })}
        </div>

        <div className="w-full flex flex-col gap-3">
          <Button
            data-testid="button-careteam-add-another-done"
            onClick={startAddFlow}
            className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]"
          >
            {t("onboarding.careTeam.step5.addAnother")}
          </Button>
          <Button
            variant="outline"
            onClick={backToRoster}
            className="w-full h-12 font-bold border-[#6b21a8] text-[#6b21a8]"
          >
            {t("onboarding.careTeam.step5.done")}
          </Button>
        </div>
      </div>
    </PhoneFrame>
  );
}
