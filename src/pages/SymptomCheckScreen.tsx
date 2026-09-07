import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, Brain, Calendar, Car, ChevronLeft, Share2, CheckCircle, AlertTriangle, ArrowRight, Droplets, Eye, ClipboardList, FileText, Gauge, Heart, HeartPulse, Home, Keyboard, Loader2, Mail, Mic, PhoneCall, Pill, RefreshCw, Send, ShieldCheck, ShoppingBasket, Square, Stethoscope, Users, Wind, type LucideIcon } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import TriageChat, { stepBackTriageDraft, type TriageChatDraft } from "@/components/TriageChat";
import { useProfile } from "@/contexts/ProfileContext";
import {
  HealthWizardCard,
  HealthWizardHero,
} from "@/components/health/HealthWizard";
import { SymptomAssessmentPresentation } from "@/components/health/SymptomAssessmentPresentation";
import {
  isNumericSeverityScaleChoices,
  SeverityScaleControl,
} from "@/components/health/SeverityScaleControl";
import { SymptomSafetyChoiceCard } from "@/components/health/SymptomSafetyChoiceCard";
import { SymptomChoiceCard } from "@/components/health/SymptomChoiceCard";
import { VitalsAcquisitionPanel, type TriageVitalValues } from "@/components/VitalsAcquisitionPanel";
import { VyvaIcon, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { PrototypeSymptomAssessmentShell } from "@/pages/HomeNavPrototypeScreens";
import { useToast } from "@/hooks/use-toast";
import { useHomeFastHelpOutcome } from "@/hooks/useHomeFastHelpOutcome";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useLanguage } from "@/i18n";
import {
  localizeTriageAnswerLabel,
  localizeTriageQuestion,
} from "../../shared/triageDisplayLocalization";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { compactReportRecommendations, uniqueReportLines } from "@/lib/reportRecommendations";
import { getSymptomRecommendationActionKinds, type SymptomRecommendationActionKind } from "@/lib/symptomReportActions";
import { emitVoiceSpecialistTransfer, VOICE_SPECIALIST_AGENT_SLUGS } from "@/lib/voiceNavigation";
import {
  clearVoiceSessionId,
  acknowledgeDrAiScreenSync,
  emitVoiceTriageTouchAnswer,
  readVoiceSessionId,
  VYVA_DR_AI_SCREEN_SYNC_REQUEST_EVENT,
  VYVA_DR_AI_VITALS_OPEN_EVENT,
  VYVA_VOICE_SESSION_CHANGED_EVENT,
  type DrAiScreenSyncRequestDetail,
} from "@/lib/voiceSessionBridge";
import type { TriagePersonalizedSuggestion } from "@/triage";
import type { ShoppingSupportPackageId } from "../../shared/shopping";
import type { TriageScanResult } from "../../shared/triageScans";
import {
  resolveSymptomAssessmentPresentation,
  SYMPTOM_ASSESSMENT_STAGE_IDS,
  type SymptomAssessmentStageId,
} from "@/design/screenPresentation";
import type { HomeInteractionMode } from "@/lib/homeModeControl";

type Step = "intro" | "chat" | "report";

export function symptomCheckHealthReturnPath(pathname: string) {
  return pathname.startsWith("/dev/home-master")
    ? "/dev/home-master/health"
    : "/health";
}

export function symptomAssessmentStageForRuntime(
  runtimeStage: string | null | undefined,
  urgent = false,
): SymptomAssessmentStageId {
  if (urgent) return "urgent_escalation";
  switch (runtimeStage) {
    case "checking": return "checking";
    case "red_flag": return "safety_check";
    case "symptom": return "symptom_selection";
    case "location": return "symptom_selection";
    case "severity": return "severity";
    case "duration": return "onset";
    case "trend": return "related_details";
    case "support": return "review";
    case "complete": return "safest_next_step";
    default: return "describe";
  }
}

type SymptomCheckLocationState = {
  initialClue?: string;
  autoStartVoice?: boolean;
} | null;

interface TriageSummary {
  chiefComplaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  aiSummary?: string;
  nextStepLabel?: string;
  nextStepLevel?: "emergency" | "doctor_today" | "doctor_24_48" | "monitor";
  triageReasons?: string[];
  watchSigns?: string[];
  profileConsiderations?: string[];
  vitalsNotes?: string[];
  scanResults?: TriageScanResult[];
  scanNotes?: string[];
  interpretation?: string;
  possiblePatterns?: Array<{
    id: string;
    label: string;
    explanation: string;
    supportingAnswers: string[];
    clarifyingSigns: string[];
  }>;
  uncertainty?: string[];
  reassessmentWindow?: string;
  changePlanTriggers?: string[];
  clinicalHandoff?: {
    summary: string;
    keyPoints: string[];
    questions: string[];
  };
  evidenceSummary?: string;
  evidenceSources?: Array<{ title?: string; url?: string; year?: string; journal?: string }>;
  contextConfidence?: {
    score: number;
    label: string;
    reasons: string[];
    missing: string[];
  };
  contextSignals?: Array<{
    id: string;
    label: string;
    status: "available" | "missing" | "not_needed";
  }>;
  contextBrief?: string;
  refinementContext?: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    quickAnswers: Array<{ id: string; label: string; value: string; kind: string }>;
    scanResults?: TriageScanResult[];
    entryMode: "with_vitals" | "without_vitals";
    initialClue: string;
  };
}

type RefinementVitalKey = "glucose" | "bloodPressure" | "oxygen" | "respiratoryRate" | "temperature" | "pulse" | "pain" | "energy";

type RefinementVitalConfig = {
  key: RefinementVitalKey;
  title: string;
  unit: string;
  placeholder: string;
  helper: string;
  signalType: string;
  invalidMessage?: string;
  parse: (raw: string) => { value: number; extraValue?: number; display: string; vitals: Record<string, number> } | null;
};

type RefinementStatus = {
  state: "idle" | "saving" | "refining" | "done" | "error";
  message?: string;
};

type ReportSaveState = "idle" | "saving" | "saved" | "error";

type LatestVitalReading = {
  signal_type: string;
  context_tag?: string | null;
  value: string | number;
  recorded_at?: string | null;
  source?: string | null;
  source_confidence?: "low" | "medium" | "high" | null;
  source_display_label?: string | null;
  source_context_label?: string | null;
};

type LatestVitalsResponse = {
  recent_readings?: LatestVitalReading[];
};

type LatestVitalCandidate = {
  value: string;
  display: string;
  source?: string | null;
};

type TriageHealthMemory = {
  healthContext?: string;
  careContext?: string;
  checkinContext?: string;
  conditions?: string;
  allergies?: string;
  medications?: string;
  devices?: string;
  latestVitals?: string;
  vitalsTrend?: string;
  latestSymptomReport?: string;
  recentSymptomReports?: string;
  medicationAdherence?: string;
  medicationInteraction?: string;
  recentHealthEvents?: string;
  latestMedicalVisit?: string;
  upcomingMedicalAppointment?: string;
  countryCode?: string;
};

type EmergencyContact = {
  label: string;
  telHref?: string;
};

type TriageContextResponse = {
  memory: TriageHealthMemory;
  usedItems: string[];
  countryCode?: string;
  emergencyContact?: EmergencyContact;
  personalizedSuggestions?: TriagePersonalizedSuggestion[];
  activeConditions?: string[];
};

type VoiceTriageChoice = {
  id: string;
  spoken_label: string;
  value?: string;
  kind?: string;
};

type VoiceTriageVitalsPrompt = {
  title: string;
  body: string;
  actions: Array<{
    id: string;
    label: string;
    value: string;
  }>;
  camera_action?: { id: string; label: string; route: string };
  manual_action?: { id: string; label: string };
  skip_action?: { id: string; label: string };
};

type VoiceTriageActionOption = {
  id: string;
  kind: string;
  label: string;
  route?: string;
  tel_href?: string | null;
  disabled?: boolean;
};

type VoiceTriageLatestResponse = {
  ok?: boolean;
  status?: "active" | "emergency" | "complete" | "failed";
  spoken_text?: string;
  safety_level?: string;
  vitals_prompt?: VoiceTriageVitalsPrompt | null;
  question?: {
    stage?: string;
    text?: string;
    reason?: string | null;
    profile_context_used?: boolean;
    choices?: VoiceTriageChoice[];
  };
  report?: {
    triage_report_id?: string | null;
    next_step_level?: string | null;
    chief_complaint?: string;
    watch_signs?: string[];
  };
  emergencyContact?: EmergencyContact | null;
  staff_review_requested?: boolean;
  action_options?: VoiceTriageActionOption[];
  review_answers?: Array<{
    id: string;
    label: string;
    value: string;
    kind?: string;
  }>;
  guidancePlan?: {
    confidence?: TriageSummary["contextConfidence"];
    usefulSignals?: TriageSummary["contextSignals"];
    protocolLabel?: string;
    nextQuestionFocus?: string;
  } | null;
  summary?: TriageSummary | null;
};

type VoiceTriageSessionResponse = {
  conversation_id: string;
  status: "active" | "emergency" | "complete" | "abandoned" | "failed";
  latest_response?: VoiceTriageLatestResponse;
  triage_report_id?: string | null;
  updated_at?: string;
};

const SYMPTOM_WARNING_PREVIEW_SESSION: VoiceTriageSessionResponse = {
  conversation_id: "symptom-warning-preview",
  status: "active",
  latest_response: {
    status: "active",
    question: {
      stage: "red_flag",
      text: "Do any of these warning signs apply?",
      choices: [
        { id: "very_high_bp", spoken_label: "Very high blood pressure", value: "My blood pressure is very high." },
        { id: "one_sided_weakness", spoken_label: "Weakness or speech trouble", value: "I have weakness or speech trouble." },
        { id: "new_confusion", spoken_label: "Confusion, hard to wake, heavy bleeding, severe pain, or swelling", value: "One of these warning signs applies." },
        { id: "chest_pain", spoken_label: "Chest pain, breathing trouble, or pale/blue skin", value: "One of these warning signs applies." },
        { id: "stroke_sign", spoken_label: "Face/arm weakness, speech or vision trouble, seizure, or fainting", value: "One of these warning signs applies." },
        { id: "no_red_flag", spoken_label: "No, none of these", value: "None of these warning signs apply." },
      ],
    },
  },
};

type ProfileContactsResponse = {
  caregiverName?: string | null;
  caregiverContact?: string | null;
  gpName?: string | null;
  gpPhone?: string | null;
  gpEmail?: string | null;
} | null;

type CareTeamMember = {
  id: string;
  invitee_name?: string | null;
  invitee_phone?: string | null;
  invitee_email?: string | null;
  role?: string | null;
  relationship?: string | null;
  status?: string | null;
};

type DoctorShareTarget = {
  name: string;
  value: string;
  channel: "email" | "sms";
};

type SavedTriageReport = {
  id?: string;
  chief_complaint?: string;
  symptoms?: string[];
  urgency?: TriageSummary["urgency"];
  recommendations?: string[];
  disclaimer?: string;
  ai_summary?: string | null;
  next_step_label?: string | null;
  next_step_level?: TriageSummary["nextStepLevel"] | null;
  triage_reasons?: string[];
  watch_signs?: string[];
  profile_considerations?: string[];
  vitals_notes?: string[];
  scan_results?: TriageScanResult[];
  scan_notes?: string[];
  interpretation?: string | null;
  possible_patterns?: TriageSummary["possiblePatterns"];
  uncertainty?: string[];
  reassessment_window?: string | null;
  change_plan_triggers?: string[];
  clinical_handoff?: TriageSummary["clinicalHandoff"] | null;
  bpm?: number | null;
  respiratory_rate?: number | null;
  duration_seconds?: number | null;
  created_at?: string;
  sent_to?: string[];
  staff_review_requested?: boolean;
};

export function triageSummaryFromSavedReport(report: SavedTriageReport | null | undefined): TriageSummary | null {
  if (!report?.chief_complaint || !report.urgency) return null;
  return {
    chiefComplaint: report.chief_complaint,
    symptoms: report.symptoms ?? [],
    urgency: report.urgency,
    recommendations: report.recommendations ?? [],
    disclaimer: report.disclaimer ?? "",
    aiSummary: report.ai_summary ?? undefined,
    nextStepLabel: report.next_step_label ?? undefined,
    nextStepLevel: report.next_step_level ?? undefined,
    triageReasons: report.triage_reasons ?? [],
    watchSigns: report.watch_signs ?? [],
    profileConsiderations: report.profile_considerations ?? [],
    vitalsNotes: report.vitals_notes ?? [],
    scanResults: report.scan_results ?? [],
    scanNotes: report.scan_notes ?? [],
    interpretation: report.interpretation ?? undefined,
    possiblePatterns: report.possible_patterns ?? [],
    uncertainty: report.uncertainty ?? [],
    reassessmentWindow: report.reassessment_window ?? undefined,
    changePlanTriggers: report.change_plan_triggers ?? [],
    clinicalHandoff: report.clinical_handoff ?? undefined,
  };
}

type ConciergePrefillKind = "ride" | "appointment" | "home_care_quote";

type ReportAction = {
  kind: SymptomRecommendationActionKind | "add_doctor_contact";
  label: string;
  ariaLabel: string;
  Icon: LucideIcon;
  href?: string;
  onClick?: () => void;
};

const SYMPTOM_CHECK_DRAFT_KEY = "vyva.symptomCheck.draft.v1";
const SYMPTOM_CHECK_DRAFT_TTL_MS = 2 * 60 * 60 * 1000;
const SYMPTOM_CHECK_VISITED_KEY = "vyva_symptom_check_visited";

type SymptomCheckDraft = {
  version: 1;
  updatedAt: number;
  step: Exclude<Step, "intro">;
  initialClue: string;
  bpm: number | null;
  respiratoryRate: number | null;
  chatStartTime: number | null;
  summary: TriageSummary | null;
  reportSaveState: ReportSaveState;
  reportId: string | null;
  durationSeconds: number | null;
  refinementStatus: RefinementStatus;
  chatDraft: TriageChatDraft | null;
  assessmentStage: SymptomAssessmentStageId;
};

const isSymptomAssessmentStageId = (value: unknown): value is SymptomAssessmentStageId =>
  typeof value === "string"
  && (SYMPTOM_ASSESSMENT_STAGE_IDS as readonly string[]).includes(value);

const canUseSessionStorage = () => typeof window !== "undefined" && Boolean(window.sessionStorage);

function writeSymptomCheckVisited() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SYMPTOM_CHECK_VISITED_KEY, "true");
  } catch {
    return;
  }
}

function clearSymptomCheckDraft() {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.removeItem(SYMPTOM_CHECK_DRAFT_KEY);
}

function readSymptomCheckDraft(): SymptomCheckDraft | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(SYMPTOM_CHECK_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SymptomCheckDraft>;
    const isExpired = typeof parsed.updatedAt !== "number" || Date.now() - parsed.updatedAt > SYMPTOM_CHECK_DRAFT_TTL_MS;
    const hasValidStep = parsed.step === "chat" || parsed.step === "report";
    const hasRestorableState = parsed.step === "chat"
      ? Boolean(parsed.chatDraft)
      : Boolean(parsed.summary);
    if (parsed.version !== 1 || isExpired || !hasValidStep || !hasRestorableState) {
      clearSymptomCheckDraft();
      return null;
    }
    return {
      version: 1,
      updatedAt: parsed.updatedAt,
      step: parsed.step,
      initialClue: typeof parsed.initialClue === "string" ? parsed.initialClue : "",
      bpm: typeof parsed.bpm === "number" ? parsed.bpm : null,
      respiratoryRate: typeof parsed.respiratoryRate === "number" ? parsed.respiratoryRate : null,
      chatStartTime: typeof parsed.chatStartTime === "number" ? parsed.chatStartTime : null,
      summary: parsed.summary ?? null,
      reportSaveState: parsed.reportSaveState === "saving" ? "idle" : parsed.reportSaveState ?? "idle",
      reportId: typeof parsed.reportId === "string" ? parsed.reportId : null,
      durationSeconds: typeof parsed.durationSeconds === "number" ? parsed.durationSeconds : null,
      refinementStatus: parsed.refinementStatus ?? { state: "idle" },
      chatDraft: parsed.chatDraft ?? null,
      assessmentStage: isSymptomAssessmentStageId(parsed.assessmentStage)
        ? parsed.assessmentStage
        : parsed.step === "report"
          ? "safest_next_step"
          : parsed.chatDraft?.pendingRequest
            ? "checking"
            : "symptom_selection",
    };
  } catch {
    clearSymptomCheckDraft();
    return null;
  }
}

function writeSymptomCheckDraft(draft: Omit<SymptomCheckDraft, "version" | "updatedAt">) {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(SYMPTOM_CHECK_DRAFT_KEY, JSON.stringify({
    ...draft,
    version: 1,
    updatedAt: Date.now(),
  }));
}

export function AssessmentConfidenceTracker({
  current,
  variant = "full",
}: {
  current: Step;
  variant?: "full" | "compact";
}) {
  const { t } = useTranslation();
  const isReport = current === "report";
  const activeIndex = isReport ? 2 : current === "chat" ? 1 : 0;
  const filledSignals = isReport ? 5 : current === "chat" ? 4 : 2;
  const confidenceLabel = isReport
    ? t("health.symptomCheck.tracker.high", "High")
    : current === "chat"
      ? t("health.symptomCheck.tracker.medium", "Medium")
      : t("health.symptomCheck.tracker.low", "Low");
  const statusLabel = isReport
    ? t("health.symptomCheck.tracker.ready", "Ready to guide")
    : current === "chat"
      ? t("health.symptomCheck.tracker.building", "Confidence improving")
      : t("health.symptomCheck.tracker.starting", "Getting started");
  const detailLabel = isReport
    ? t("health.symptomCheck.tracker.prepared", "Next steps are ready")
    : current === "chat"
      ? t("health.symptomCheck.tracker.checking", "VYVA is checking symptoms and safety signs")
      : t("health.symptomCheck.tracker.listening", "Tell me how you feel, right now");
  const milestones = [
    { key: "listen", label: t("health.symptomCheck.tracker.listen", "Symptoms"), Icon: Stethoscope },
    { key: "check", label: t("health.symptomCheck.tracker.check", "Safety check"), Icon: Activity },
    { key: "next", label: t("health.symptomCheck.tracker.nextStep", "Next step"), Icon: CheckCircle },
  ];
  const confidenceValue = `${filledSignals}/5`;
  const activeStageLabel = milestones[activeIndex]?.label ?? milestones[0].label;

  if (variant === "compact") {
    return (
      <section
        className="mx-4 overflow-hidden rounded-[28px] border border-[#D8C7FF] bg-white shadow-[0_16px_36px_rgba(63,45,35,0.10)] sm:mx-5 lg:mx-auto lg:w-full lg:max-w-[760px]"
        data-testid="assessment-confidence-tracker"
      >
        <div className="bg-[linear-gradient(135deg,#FFFFFF_0%,#F7F1FF_58%,#FFF8EA_100%)] px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-[22px] bg-vyva-purple text-white shadow-[0_12px_24px_rgba(107,33,168,0.24)]"
              aria-hidden="true"
            >
              <Activity size={25} className={!isReport ? "motion-safe:animate-pulse" : ""} />
              {!isReport ? (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#34D399] ring-4 ring-white">
                  <span className="h-2 w-2 rounded-full bg-white motion-safe:animate-pulse" />
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-body text-[12px] font-black uppercase text-vyva-purple">
                {t("health.symptomCheck.tracker.live", "Live assessment")}
              </p>
              <p className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
                {statusLabel}
              </p>
              <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                {detailLabel}
              </p>
            </div>

            <div
              className="flex min-h-[58px] min-w-[74px] flex-shrink-0 flex-col items-center justify-center rounded-[22px] border border-white bg-white px-2 text-center shadow-[0_8px_18px_rgba(63,45,35,0.07)]"
              role="meter"
              aria-label={t("health.symptomCheck.tracker.label", "Confidence level")}
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={filledSignals}
              aria-valuetext={`${confidenceLabel} ${confidenceValue}`}
            >
              <span className="font-body text-[20px] font-black leading-none text-vyva-purple">
                {confidenceValue}
              </span>
              <span className="mt-1 rounded-full bg-[#ECFDF5] px-2 py-1 font-body text-[10px] font-black uppercase text-[#047857]">
                {confidenceLabel}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => {
              const isFilled = index < filledSignals;
              const isCurrent = index === filledSignals - 1 && !isReport;

              return (
                <span
                  key={index}
                  className={`h-3 rounded-full transition-all duration-300 ${
                    isFilled
                      ? `bg-vyva-purple shadow-[0_7px_14px_rgba(107,33,168,0.18)] ${isCurrent ? "motion-safe:animate-pulse" : ""}`
                      : "bg-[#E8DED4]"
                  }`}
                />
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#EEE4DA] bg-[#FFFCF8] px-3 py-3">
          <div className="grid grid-cols-3 gap-2" aria-label={t("health.symptomCheck.tracker.label", "Confidence level")} data-testid="assessment-confidence-signals">
            {milestones.map(({ key, label, Icon }, index) => {
              const isComplete = index < activeIndex;
              const isActive = index === activeIndex;
              const stateLabel = isComplete
                ? t("health.symptomCheck.tracker.complete", "Done")
                : isActive
                  ? t("health.symptomCheck.tracker.current", "Now")
                  : t("health.symptomCheck.tracker.waiting", "Next");
              const tileClass = isActive
                ? "border-vyva-purple bg-vyva-purple text-white shadow-[0_10px_22px_rgba(107,33,168,0.18)]"
                : isComplete
                  ? "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"
                  : "border-[#E8DED4] bg-white text-vyva-text-2";
              const iconClass = isActive
                ? `bg-white/18 text-white ${isReport ? "" : "motion-safe:animate-pulse"}`
                : isComplete
                  ? "bg-[#10B981] text-white"
                  : "bg-[#F4EEE8] text-vyva-text-2";

              return (
                <div
                  key={key}
                  aria-current={isActive ? "step" : undefined}
                  className={`min-h-[70px] rounded-[18px] border px-2 py-2 text-center transition-all ${tileClass}`}
                >
                  <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-[14px] ${iconClass}`}>
                    <Icon size={17} />
                  </span>
                  <span className="mt-1 block font-body text-[11px] font-black leading-tight">
                    {label}
                  </span>
                  <span className="mt-0.5 block font-body text-[10px] font-black uppercase opacity-75">
                    {stateLabel}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-center font-body text-[12px] font-black text-vyva-purple">
            {activeStageLabel}
          </p>
        </div>
      </section>
    );
  }

  return (
    <div
      className="mx-4 rounded-[30px] border border-[#E8DED4] bg-[linear-gradient(135deg,#FFFFFF_0%,#F6EEFF_48%,#FFF7E8_100%)] p-4 shadow-[0_16px_34px_rgba(63,45,35,0.10)] sm:mx-5 lg:mx-auto lg:w-full lg:max-w-[760px]"
      data-testid="assessment-confidence-tracker"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="relative flex min-h-[102px] flex-shrink-0 items-center gap-3 rounded-[26px] border border-white/80 bg-white px-4 py-3 shadow-[0_12px_26px_rgba(107,33,168,0.14)] sm:w-[188px] sm:flex-col sm:items-start sm:justify-center"
          role="meter"
          aria-label={t("health.symptomCheck.tracker.label", "Confidence level")}
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={filledSignals}
          aria-valuetext={`${confidenceLabel} ${filledSignals}/5`}
        >
          <span className="flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-[20px] bg-vyva-purple text-white shadow-[0_12px_22px_rgba(107,33,168,0.24)]">
            <Activity size={28} className={!isReport ? "motion-safe:animate-pulse" : ""} />
          </span>
          <span className="min-w-0 font-body leading-tight">
            <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-vyva-text-3">
              {t("health.symptomCheck.tracker.label", "Confidence level")}
            </span>
            <strong className="mt-1 block text-[24px] font-black text-vyva-purple">{confidenceLabel}</strong>
            <span className="mt-2 flex gap-1" aria-hidden="true" data-testid="assessment-confidence-signals">
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={index}
                  className={`h-3 w-3 rounded-full ${
                    index < filledSignals
                      ? "bg-vyva-purple"
                      : "bg-[#E8DED4]"
                  }`}
                />
              ))}
            </span>
          </span>
          <span className="sr-only">
            {t("health.symptomCheck.tracker.label", "Confidence level")}:
            {" "}
            {filledSignals}/5
            {" "}
            {confidenceLabel}
          </span>
          {!isReport ? (
            <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[#34D399] ring-4 ring-white">
              <span className="h-2 w-2 rounded-full bg-white motion-safe:animate-pulse" />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                {isReport
                  ? t("health.symptomCheck.tracker.complete", "Done")
                  : t("health.symptomCheck.tracker.live", "Live")}
              </p>
              <p className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
                {statusLabel}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#047857] shadow-[0_4px_12px_rgba(63,45,35,0.06)]">
              {confidenceLabel}
            </span>
          </div>
          <p className="mt-2 font-body text-[15px] font-bold leading-snug text-vyva-text-2 sm:text-[16px]">
            {detailLabel}
          </p>
          <div className="mt-4 rounded-[22px] border border-white/80 bg-white/82 px-4 py-3 shadow-[0_8px_18px_rgba(63,45,35,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-text-3">
                {t("health.symptomCheck.tracker.live", "Live")}
              </span>
              <span className="flex gap-2" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-4 w-4 rounded-full transition-all duration-300 ${
                      index < filledSignals
                        ? "bg-vyva-purple shadow-[0_6px_14px_rgba(107,33,168,0.22)]"
                        : "bg-[#E8DED4]"
                    }`}
                  />
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2" aria-label={t("health.symptomCheck.tracker.label", "Confidence level")}>
        {milestones.map(({ key, label, Icon }, index) => {
          const isComplete = index < activeIndex;
          const isActive = index === activeIndex;
          const stateLabel = isComplete
            ? t("health.symptomCheck.tracker.complete", "Done")
            : isActive
              ? t("health.symptomCheck.tracker.current", "Now")
              : t("health.symptomCheck.tracker.waiting", "Next");
          const tileClass = isActive
            ? "border-vyva-purple bg-white text-vyva-purple shadow-[0_10px_20px_rgba(107,33,168,0.14)]"
            : isComplete
              ? "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"
              : "border-[#E8DED4] bg-white/70 text-vyva-text-2";
          const iconClass = isActive
            ? `bg-vyva-purple text-white ${isReport ? "" : "motion-safe:animate-pulse"}`
            : isComplete
              ? "bg-[#10B981] text-white"
              : "bg-[#F4EEE8] text-vyva-text-2";

          return (
            <div
              key={key}
              aria-current={isActive ? "step" : undefined}
              className={`min-h-[82px] rounded-[20px] border px-2 py-2 text-center transition-all ${tileClass}`}
            >
              <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-[14px] ${iconClass}`}>
                <Icon size={18} />
              </span>
              <span className="mt-1 block font-body text-[12px] font-black leading-tight">
                {label}
              </span>
              <span className="mt-0.5 block font-body text-[10px] font-black uppercase tracking-[0.08em] opacity-70">
                {stateLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type VoiceTriageAnswerInput = {
  choiceId?: string | null;
  utterance: string;
  vitalsText?: string | null;
  vitalsSource?: "phone_estimate" | "manual_entry" | "connected_device" | "clinical";
  vitalsAffectsTriage?: boolean;
};

export function VoiceTriageLivePanel({
  session,
  stageId,
  modality,
  onAnswer,
  isAnswering = false,
}: {
  session: VoiceTriageSessionResponse;
  stageId: SymptomAssessmentStageId;
  modality: HomeInteractionMode;
  onAnswer?: (answer: VoiceTriageAnswerInput) => void;
  isAnswering?: boolean;
}) {
  const { t } = useTranslation();
  const { language: activeLanguage } = useLanguage();
  const navigate = useNavigate();
  const { isDark } = useHomeMasterTheme();
  const [typedAnswer, setTypedAnswer] = useState("");
  const latest = session.latest_response;
  const question = latest?.question;
  const choices = question?.choices ?? [];
  const localizedQuestion = question?.text
    ? localizeTriageQuestion(activeLanguage, question.text)
    : undefined;
  const displayedChoices = choices.map((choice) => ({
    choice,
    displayLabel: localizeTriageAnswerLabel(activeLanguage, choice.spoken_label),
  }));
  const severityChoices = choices.map((choice) => ({
    id: choice.id,
    label: localizeTriageAnswerLabel(activeLanguage, choice.spoken_label),
    value: choice.value || choice.spoken_label,
  }));
  const usesNumericSeverityScale = stageId === "severity"
    && isNumericSeverityScaleChoices(severityChoices);
  const reviewLabelByKind: Record<string, string> = {
    symptom: t("health.symptomCheck.chat.reviewSymptom", "Symptom"),
    location: t("health.symptomCheck.chat.reviewLocation", "Location"),
    severity: t("health.symptomCheck.chat.reviewSeverity", "Severity"),
    duration: t("health.symptomCheck.chat.reviewOnset", "When it started"),
    trend: t("health.symptomCheck.chat.reviewRelatedDetail", "Related detail"),
  };
  const voiceReviewItems = (latest?.review_answers ?? [])
    .filter((answer) => Boolean(answer.kind && reviewLabelByKind[answer.kind]))
    .map((answer) => ({
      label: reviewLabelByKind[answer.kind ?? ""],
      value: answer.kind === "severity" && /^severity_(?:10|[0-9])$/.test(answer.id)
        ? `${answer.id.replace("severity_", "")} / 10`
        : localizeTriageAnswerLabel(activeLanguage, answer.label),
    }));
  const usesRuntimeQuestion = [
    "safety_check",
    "symptom_selection",
    "severity",
    "onset",
    "review",
  ].includes(stageId);
  const actionOptions = latest?.action_options?.filter((action) => action.kind !== "call_emergency") ?? [];
  const vitalsPrompt = latest?.vitals_prompt;
  const isEmergency = session.status === "emergency";
  const isComplete = session.status === "complete";
  const isFailed = session.status === "failed";
  const canTapAnswer = Boolean(onAnswer && !isAnswering && !isEmergency && !isComplete && !isFailed);
  const showTypedAnswerComposer = stageId !== "checking"
    && stageId !== "review"
    && !usesNumericSeverityScale
    && !isEmergency
    && !isComplete
    && !isFailed;
  const emergencyContact = latest?.emergencyContact;
  const cleanTypedAnswer = typedAnswer.trim();
  const [showVitalsCapture, setShowVitalsCapture] = useState(false);
  useEffect(() => {
    const open = () => setShowVitalsCapture(true);
    window.addEventListener(VYVA_DR_AI_VITALS_OPEN_EVENT, open);
    return () => window.removeEventListener(VYVA_DR_AI_VITALS_OPEN_EVENT, open);
  }, []);
  const applyVoiceVitals = (values: TriageVitalValues, affectsTriage: boolean, source: "phone_estimate" | "manual_entry" | "connected_device" | "clinical") => {
    const parts = [
      typeof values.bpm === "number" ? `heart rate ${values.bpm}` : "",
      typeof values.respiratoryRate === "number" ? `breathing rate ${values.respiratoryRate}` : "",
      typeof values.oxygenSaturation === "number" ? `oxygen ${values.oxygenSaturation}` : "",
      typeof values.temperatureC === "number" ? `temperature ${values.temperatureC}` : "",
      typeof values.systolicBp === "number" && typeof values.diastolicBp === "number" ? `${values.systolicBp} over ${values.diastolicBp}` : "",
      typeof values.glucoseMgdl === "number" ? `glucose ${values.glucoseMgdl}` : "",
    ].filter(Boolean).join(", ");
    if (!parts) return;
    setShowVitalsCapture(false);
    onAnswer?.({ utterance: parts, vitalsText: parts, vitalsSource: source, vitalsAffectsTriage: affectsTriage });
  };
  const submitTypedAnswer = () => {
    if (!cleanTypedAnswer || !canTapAnswer) return;
    onAnswer?.({ utterance: cleanTypedAnswer });
    setTypedAnswer("");
  };
  const runActionOption = (action: VoiceTriageActionOption) => {
    if (action.disabled) return;
    if (action.tel_href) {
      window.location.href = action.tel_href;
      return;
    }
    if (action.route) navigate(action.route);
  };

  if (stageId === "describe") {
    return (
      <IntroScreen
        onStart={(clue) => onAnswer?.({ utterance: clue })}
        startDisabled={!canTapAnswer}
        onTalkToVyva={() => undefined}
        showEmergencyModal={false}
      />
    );
  }

  return (
    <aside
      className="mx-auto mb-8 mt-4 w-full max-w-[760px] md:mb-10"
      data-testid="voice-triage-live-panel"
      aria-live="polite"
    >
      <SymptomAssessmentPresentation
        stageId={stageId}
        modality={modality}
        showHeader={false}
        title={stageId === "related_details"
          ? t("health.symptomCheck.chat.relatedDetailsTitle", "One more detail")
          : stageId === "urgent_escalation"
            ? t("health.symptomCheck.chat.urgentTitle", "Get urgent help now")
            : usesRuntimeQuestion
              ? localizedQuestion?.trim() || undefined
              : undefined}
        helper={stageId === "related_details"
          ? t("health.symptomCheck.chat.relatedDetailsHelper", "Choose the pattern that fits best.")
          : stageId === "urgent_escalation"
            ? t(
                "health.symptomCheck.chat.urgentHelper",
                "Call emergency services now. Do not wait for an online assessment.",
              )
            : usesRuntimeQuestion && !usesNumericSeverityScale
              ? ""
              : undefined}
        reviewItems={stageId === "review" ? voiceReviewItems : []}
      >
        {usesNumericSeverityScale ? (
          <SeverityScaleControl
            choices={severityChoices}
            disabled={!canTapAnswer}
            onSubmit={(choice) => onAnswer?.({
              choiceId: choice.id,
              utterance: choice.value,
            })}
            continueLabel={t("health.symptomCheck.chat.continue", "Continue")}
            minimumLabel={t("health.symptomCheck.chat.severityNone", "None")}
            maximumLabel={t("health.symptomCheck.chat.severityWorst", "Worst imaginable")}
          />
        ) : stageId !== "checking" && choices.length ? (
          <div
            className={`grid gap-[10px] ${stageId === "review" ? "grid-cols-2" : "grid-cols-1"}`}
            data-testid={`voice-triage-choice-grid-${stageId}`}
          >
            {displayedChoices.map(({ choice, displayLabel }) => {
              const isSafetyChoice = stageId === "safety_check";
              const isNoWarningChoice = choice.id === "no_red_flag";
              const ChoiceIcon = isNoWarningChoice ? CheckCircle : AlertTriangle;
              const assessmentChoiceIcon = assessmentChoiceIconByStage[stageId]
                ?? { Icon: Activity, accent: "pulse" as const };

              if (isSafetyChoice) {
                return (
                  <SymptomSafetyChoiceCard
                    key={choice.id}
                    Icon={ChoiceIcon}
                    label={displayLabel}
                    tone={isNoWarningChoice ? "clear" : "warning"}
                    accent={isNoWarningChoice ? "check" : "signal"}
                    disabled={!canTapAnswer}
                    testId={`voice-triage-choice-${choice.id}`}
                    onClick={() => onAnswer?.({
                      choiceId: choice.id,
                      utterance: choice.value || choice.spoken_label,
                    })}
                  />
                );
              }

              if (stageId !== "review") {
                return (
                  <SymptomChoiceCard
                    key={choice.id}
                    Icon={assessmentChoiceIcon.Icon}
                    accent={assessmentChoiceIcon.accent}
                    label={displayLabel}
                    disabled={!canTapAnswer}
                    testId={`voice-triage-choice-${choice.id}`}
                    onClick={() => onAnswer?.({
                      choiceId: choice.id,
                      utterance: choice.value || choice.spoken_label,
                    })}
                  />
                );
              }

              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={!canTapAnswer}
                  data-testid={`voice-triage-choice-${choice.id}`}
                  onClick={() => onAnswer?.({
                    choiceId: choice.id,
                    utterance: choice.value || choice.spoken_label,
                  })}
                  className={`vyva-tap flex min-h-[54px] w-full items-center justify-center rounded-full border px-3 py-3 text-center text-[15px] font-black leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${isDark ? "border-white/[0.14] bg-[#352842] text-[#FFF8FF] hover:border-[#8B5CF6]/60 hover:bg-[#45325E]" : "border-[#D7C6E3] bg-white text-[#241238] hover:border-[#7024C4] hover:bg-[#F3EAFF]"}`}
                >
                  <span>{displayLabel}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {showTypedAnswerComposer ? (
          <div
            className={`rounded-[18px] border p-2 ${isDark ? "border-white/[0.14] bg-[#352842]" : "border-[#D9CFE0] bg-white"}`}
            data-testid="voice-triage-typed-composer"
          >
            <label className="sr-only" htmlFor="voice-triage-typed-answer">
              {t("health.symptomCheck.voicePanel.typeAnother", "Type another answer")}
            </label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                id="voice-triage-typed-answer"
                value={typedAnswer}
                onChange={(event) => setTypedAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitTypedAnswer();
                  }
                }}
                placeholder={t("health.symptomCheck.voicePanel.typePlaceholder", "Or type your answer...")}
                className={`min-h-[56px] min-w-0 rounded-[14px] border border-transparent px-4 text-[16px] font-bold outline-none focus:border-[#8B5CF6] ${isDark ? "bg-[#2B2035] text-[#FFF8FF] placeholder:text-[#AA9DB7]" : "bg-[#FBF6FF] text-[#241238] placeholder:text-[#9A8C83]"}`}
              />
              <button
                type="button"
                onClick={submitTypedAnswer}
                disabled={!canTapAnswer || cleanTypedAnswer.length < 2}
                className="vyva-tap flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-[#7024C4] px-5 text-[15px] font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Send size={18} strokeWidth={2.7} />
                {t("health.symptomCheck.voicePanel.sendAnswer", "Send")}
              </button>
            </div>
          </div>
        ) : null}

        {!isEmergency && !isComplete && vitalsPrompt?.actions?.length ? (
          <div className="mt-4 rounded-[8px] border border-[#B8E3D0] bg-[#E6F8F4] p-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#E6FAFD] text-[#0E7490]">
                <Activity size={20} strokeWidth={2.7} />
              </span>
              <div className="min-w-0">
                <p className="font-body text-[15px] font-black text-vyva-text-1">
                  {vitalsPrompt.title}
                </p>
                <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                  {vitalsPrompt.body}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {vitalsPrompt.camera_action ? (
                <button
                  type="button"
                  disabled={!canTapAnswer}
                  onClick={() => setShowVitalsCapture(true)}
                  className="vyva-tap min-h-[54px] rounded-[8px] bg-[#7024C4] px-3 text-[14px] font-black text-white disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {vitalsPrompt.camera_action.label}
                </button>
              ) : null}
              {vitalsPrompt.manual_action ? (
                <button
                  type="button"
                  disabled={!canTapAnswer}
                  onClick={() => setShowVitalsCapture(true)}
                  className="vyva-tap min-h-[54px] rounded-[8px] border border-[#B8E3D0] bg-white px-3 text-[14px] font-black text-[#087F76] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {vitalsPrompt.manual_action.label}
                </button>
              ) : null}
              {vitalsPrompt.skip_action ? (
                <button
                  type="button"
                  disabled={!canTapAnswer}
                  onClick={() => onAnswer?.({ choiceId: "skip_vitals", utterance: "Skip vitals for now" })}
                  className={`vyva-tap min-h-[54px] rounded-[8px] border px-3 text-[14px] font-black disabled:cursor-not-allowed disabled:opacity-55 ${isDark ? "border-white/[0.14] bg-[#352842] text-[#F4ECFA]" : "border-[#D9CFE0] bg-white text-[#5B4B63]"}`}
                >
                  {vitalsPrompt.skip_action.label}
                </button>
              ) : null}
            </div>
            {showVitalsCapture ? (
              <div className="mt-3 rounded-[16px] border border-[#D9CFE0] bg-white/90 p-3" data-testid="voice-triage-vitals-capture">
                <VitalsAcquisitionPanel
                  actions={[{ id: "camera_vitals", label: vitalsPrompt.camera_action?.label || "Camera: heart & breathing" }, ...vitalsPrompt.actions]}
                  disabled={!canTapAnswer}
                  onApply={(values, _disclosure, affectsTriage, source) => applyVoiceVitals(values, affectsTriage, source)}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {stageId !== "review" && question?.reason ? (
          <details className={`mt-4 rounded-[18px] border px-4 py-3 ${isDark ? "border-white/[0.13] bg-[#352842]" : "border-[#E7DDE6] bg-white"}`}>
            <summary className={`cursor-pointer list-none font-body text-[13px] font-black ${isDark ? "text-[#D8CDE4]" : "text-vyva-text-2"}`}>
              {t("health.symptomCheck.voicePanel.whyAsking", "Why VYVA is asking this")}
            </summary>
            <p className={`mt-2 font-body text-[14px] font-bold leading-snug ${isDark ? "text-[#D8CDE4]" : "text-vyva-text-2"}`}>
              {question.reason}
            </p>
          </details>
        ) : null}

        {isComplete && actionOptions.length ? (
          <div className="grid gap-[10px]">
            {actionOptions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={Boolean(action.disabled)}
                onClick={() => runActionOption(action)}
                className={`vyva-tap flex min-h-[58px] items-center gap-3 rounded-[16px] border px-[14px] py-3 text-left text-[15px] font-black disabled:cursor-default disabled:opacity-55 ${isDark ? "border-white/[0.13] bg-[#352842] text-[#FFF8FF]" : "border-[#DED3E2] bg-white text-[#241238]"}`}
              >
                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[8px] bg-[#F3EAFF] text-[#7024C4]">
                  {action.kind === "view_report" ? <FileText size={17} strokeWidth={2.7} /> : <CheckCircle size={17} strokeWidth={2.7} />}
                </span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {isEmergency && emergencyContact?.telHref ? (
          <a
            href={emergencyContact.telHref}
            className={`vyva-tap flex min-h-[58px] w-full items-center gap-3 rounded-[16px] border px-[14px] py-3 text-left text-[15px] font-black ${isDark ? "border-[#FB7185]/40 bg-[#3A242E] text-[#FDA4AF]" : "border-[#DED3E2] bg-white text-[#241238]"}`}
          >
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[8px] bg-[#FFF0EF] text-[#D94C48]">
              <PhoneCall size={19} strokeWidth={2.8} />
            </span>
            <span>{t("health.symptomCheck.voicePanel.callEmergency", "Call {{number}} now", { number: emergencyContact.label })}</span>
          </a>
        ) : null}
      </SymptomAssessmentPresentation>
    </aside>
  );
}

export function CompletedVoiceReportFallback({
  reportId,
  reportAction,
  isLoading,
  isError,
  onRetry,
  onDone,
}: {
  reportId: string | null;
  reportAction?: VoiceTriageActionOption | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useHomeMasterTheme();
  const reportActionLabel = reportAction?.label?.trim() || t("health.symptomCheck.voiceReport.openReports", "Open My Reports");
  const openReport = () => {
    if (reportAction?.disabled) return;
    if (reportAction?.tel_href) {
      window.location.href = reportAction.tel_href;
      return;
    }
    if (reportAction?.route) {
      navigate(reportAction.route);
      return;
    }
    navigate(reportId ? `/informes/${reportId}` : "/informes");
  };

  return (
    <div
      className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center px-4 pb-[152px] pt-6 sm:px-5"
      data-testid="voice-report-complete-fallback"
      aria-live="polite"
    >
      <HealthWizardCard className="text-center">
        <span className={`mx-auto grid h-16 w-16 place-items-center rounded-[22px] ${isDark ? "bg-[#45325E]" : "bg-[#F3EAFF]"}`}>
          {isLoading
            ? <Loader2 size={30} className="animate-spin text-vyva-purple" aria-hidden="true" />
            : <VyvaIcon icon={FileText} accent="check" size={31} />}
        </span>
        <h1 className="mt-4 font-body text-[27px] font-extrabold leading-tight tracking-[-0.03em] text-vyva-text-1 sm:text-[32px]">
          {isLoading
            ? t("health.symptomCheck.voiceReport.loadingTitle", "Preparing your report")
            : t("health.symptomCheck.voiceReport.completeTitle", "Your check is complete")}
        </h1>
        <p className="mx-auto mt-2 max-w-[520px] font-body text-[16px] font-semibold leading-relaxed text-vyva-text-2">
          {isLoading
            ? t("health.symptomCheck.voiceReport.loadingBody", "Your guidance is saved. We’re loading the full report now.")
            : isError
              ? t("health.symptomCheck.voiceReport.errorBody", "Your check is complete, but the full report could not be loaded here yet.")
              : t("health.symptomCheck.voiceReport.savedBody", "Your guidance has been saved in My Reports.")}
        </p>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {isError ? (
            <button
              type="button"
              onClick={onRetry}
              data-testid="button-retry-voice-report"
              className="vyva-tap inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] bg-vyva-purple px-5 font-body text-[16px] font-black text-white"
            >
              <RefreshCw size={19} aria-hidden="true" />
              {t("health.symptomCheck.voiceReport.retry", "Try loading again")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={openReport}
            disabled={Boolean(reportAction?.disabled)}
            data-testid="button-open-saved-voice-report"
            className={`vyva-tap inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] border px-5 font-body text-[16px] font-black ${isDark ? "border-white/[0.16] bg-[#2D2038] text-[#D8B4FE]" : "border-[#E7DCF8] bg-white text-vyva-purple"}`}
          >
            <FileText size={19} aria-hidden="true" />
            {reportActionLabel}
          </button>
          <button
            type="button"
            onClick={onDone}
            data-testid="button-done-voice-report"
            className={`vyva-tap min-h-[54px] rounded-[18px] border px-5 font-body text-[16px] font-black ${isDark ? "border-white/[0.16] bg-transparent text-white" : "border-[#D8CDD9] bg-[#FAF7FC] text-vyva-text-1"}`}
          >
            {t("health.symptomCheck.voiceReport.done", "Done")}
          </button>
        </div>
      </HealthWizardCard>
    </div>
  );
}

export function SymptomWarningSignsPreviewScreen() {
  const navigate = useNavigate();
  const [interactionMode, setInteractionMode] = useState<HomeInteractionMode>("touch");
  const shellContract = resolveSymptomAssessmentPresentation("safety_check").shell;

  return (
    <PrototypeSymptomAssessmentShell
      interactionMode={interactionMode}
      onInteractionModeChange={setInteractionMode}
      onBack={() => navigate("/dev/home-master/health")}
      shellContract={shellContract}
    >
      <VoiceTriageLivePanel
        session={SYMPTOM_WARNING_PREVIEW_SESSION}
        stageId="safety_check"
        modality={interactionMode}
        onAnswer={() => undefined}
      />
    </PrototypeSymptomAssessmentShell>
  );
}

export function SymptomCheckingPreviewScreen() {
  const navigate = useNavigate();
  const [interactionMode, setInteractionMode] = useState<HomeInteractionMode>("touch");
  const shellContract = resolveSymptomAssessmentPresentation("checking").shell;

  return (
    <PrototypeSymptomAssessmentShell
      interactionMode={interactionMode}
      onInteractionModeChange={setInteractionMode}
      onBack={() => navigate("/dev/home-master/ask-dr-ai")}
      shellContract={shellContract}
    >
      <SymptomAssessmentPresentation stageId="checking" modality={interactionMode} showHeader={false} />
    </PrototypeSymptomAssessmentShell>
  );
}

const SYMPTOM_SEVERITY_PREVIEW_CHOICES = Array.from({ length: 11 }, (_, value) => ({
  id: `severity_${value}`,
  label: String(value),
  value: String(value),
}));

export function SymptomSeverityPreviewScreen() {
  const navigate = useNavigate();
  const [interactionMode, setInteractionMode] = useState<HomeInteractionMode>("touch");
  const shellContract = resolveSymptomAssessmentPresentation("severity").shell;

  return (
    <PrototypeSymptomAssessmentShell
      interactionMode={interactionMode}
      onInteractionModeChange={setInteractionMode}
      onBack={() => navigate("/dev/home-master/ask-dr-ai-checking")}
      shellContract={shellContract}
    >
      <SymptomAssessmentPresentation
        stageId="severity"
        modality={interactionMode}
        showHeader={false}
        title="How strong is it?"
        helper="0 is none. 10 is the worst imaginable."
      >
        <SeverityScaleControl
          choices={SYMPTOM_SEVERITY_PREVIEW_CHOICES}
          onSubmit={() => undefined}
          continueLabel="Continue"
          minimumLabel="None"
          maximumLabel="Worst imaginable"
        />
      </SymptomAssessmentPresentation>
    </PrototypeSymptomAssessmentShell>
  );
}

type IntroScreenProps = {
  onStart: (clue: string) => void;
  startDisabled?: boolean;
  onTalkToVyva?: () => void;
  onNavigate?: (route: string) => void;
  personalizedSuggestions?: TriagePersonalizedSuggestion[];
  activeConditions?: string[];
  profileContextItems?: string[];
  emergencyContact?: EmergencyContact | null;
  showEmergencyModal?: boolean;
  onEmergencyModalDismiss?: () => void;
};

function EmergencySafetyDialog({
  emergencyContact,
  onDismiss,
}: {
  emergencyContact?: EmergencyContact | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const emergencyCallLabel = emergencyContact?.telHref
    ? t("health.symptomCheck.intro.emergencyCallNumber", "Call {{number}} now", { number: emergencyContact.label })
    : t("health.symptomCheck.intro.emergencyCall", "Call emergency services");

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center overflow-y-auto bg-[#1C1714]/50 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-[2px] sm:items-center sm:px-6 sm:py-8"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="symptom-emergency-modal-title"
        aria-describedby="symptom-emergency-modal-description"
        data-testid="symptom-emergency-modal"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[440px] overflow-y-auto rounded-[26px] border border-[#F3C4C4] bg-white p-4 text-left shadow-[0_24px_70px_rgba(63,45,35,0.30)] sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#FEE2E2] text-[#B91C1C]">
            <AlertTriangle size={23} strokeWidth={2.7} aria-hidden="true" />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id="symptom-emergency-modal-title" className="font-body text-[20px] font-black leading-[1.15] text-[#7F1D1D] sm:text-[22px]">
              {t("health.symptomCheck.intro.emergencyTitle", "Do not wait in an emergency")}
            </h2>
            <p id="symptom-emergency-modal-description" className="mt-2 font-body text-[15px] font-semibold leading-[1.4] text-[#7F1D1D]">
              {t("health.symptomCheck.intro.emergencyBody", "Call now for chest pain, severe breathing trouble, sudden weakness, heavy bleeding, or collapse.")}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2.5">
          {emergencyContact?.telHref ? (
            <a
              href={emergencyContact.telHref}
              className="vyva-tap flex min-h-[52px] items-center justify-center gap-2 rounded-[17px] bg-[#B91C1C] px-4 text-center font-body text-[16px] font-black leading-tight text-white shadow-[0_10px_22px_rgba(185,28,28,0.22)]"
            >
              <PhoneCall size={19} strokeWidth={2.8} aria-hidden="true" />
              {emergencyCallLabel}
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="flex min-h-[52px] cursor-not-allowed items-center justify-center rounded-[17px] bg-[#B91C1C] px-4 text-center font-body text-[16px] font-black leading-tight text-white opacity-70"
            >
              {emergencyCallLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            data-testid="button-symptom-emergency-continue"
            className="vyva-tap min-h-[50px] w-full rounded-[17px] border border-[#E7DCEB] bg-[#FAF7FC] px-4 font-body text-[16px] font-black text-vyva-purple"
          >
            {t("health.symptomCheck.intro.emergencyContinue", "Continue to Ask Dr. AI")}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function fallbackIntroSuggestions(t: ReturnType<typeof useTranslation>["t"]): TriagePersonalizedSuggestion[] {
  return [
    {
      id: "fallback-breathing",
      kind: "common_concern",
      label: t("health.symptomCheck.intro.fallbackBreathingLabel", "Breathing feels different"),
      description: t("health.symptomCheck.intro.fallbackBreathingDesc", "Start with what changed and when."),
      initialClue: t("health.symptomCheck.intro.fallbackBreathingClue", "Breathing feels different"),
      tone: "blue",
      icon: "wind",
      source: "fallback",
      priority: 45,
    },
    {
      id: "fallback-pain",
      kind: "common_concern",
      label: t("health.symptomCheck.intro.fallbackPainLabel", "Pain or headache"),
      description: t("health.symptomCheck.intro.fallbackPainDesc", "Tell VYVA where it hurts."),
      initialClue: t("health.symptomCheck.intro.fallbackPainClue", "Pain or headache"),
      tone: "red",
      icon: "heart",
      source: "fallback",
      priority: 44,
    },
    {
      id: "fallback-dizzy",
      kind: "common_concern",
      label: t("health.symptomCheck.intro.fallbackDizzyLabel", "Dizzy or weak"),
      description: t("health.symptomCheck.intro.fallbackDizzyDesc", "Start with when it began."),
      initialClue: t("health.symptomCheck.intro.fallbackDizzyClue", "Dizzy or weak"),
      tone: "amber",
      icon: "activity",
      source: "fallback",
      priority: 43,
    },
    {
      id: "fallback-stomach",
      kind: "common_concern",
      label: t("health.symptomCheck.intro.fallbackStomachLabel", "Stomach or nausea"),
      description: t("health.symptomCheck.intro.fallbackStomachDesc", "Start with what feels different."),
      initialClue: t("health.symptomCheck.intro.fallbackStomachClue", "Stomach discomfort or nausea"),
      tone: "amber",
      icon: "stethoscope",
      source: "fallback",
      priority: 42,
    },
    {
      id: "fallback-fever",
      kind: "common_concern",
      label: t("health.symptomCheck.intro.fallbackFeverLabel", "Fever or chills"),
      description: t("health.symptomCheck.intro.fallbackFeverDesc", "Start with when it began."),
      initialClue: t("health.symptomCheck.intro.fallbackFeverClue", "Fever or chills"),
      tone: "red",
      icon: "activity",
      source: "fallback",
      priority: 41,
    },
    {
      id: "fallback-skin",
      kind: "common_concern",
      label: t("health.symptomCheck.intro.fallbackSkinLabel", "Skin change or swelling"),
      description: t("health.symptomCheck.intro.fallbackSkinDesc", "Tell VYVA where you notice it."),
      initialClue: t("health.symptomCheck.intro.fallbackSkinClue", "Skin change or swelling"),
      tone: "purple",
      icon: "droplet",
      source: "fallback",
      priority: 40,
    },
    {
      id: "fallback-vitals",
      kind: "health_improvement",
      label: t("health.symptomCheck.intro.fallbackVitalsLabel", "Check vitals"),
      description: t("health.symptomCheck.intro.fallbackVitalsDesc", "Add a quick reading before or after the check."),
      route: "/health/vitals",
      tone: "blue",
      icon: "gauge",
      source: "fallback",
      priority: 39,
    },
    {
      id: "fallback-checkin",
      kind: "health_improvement",
      label: t("health.symptomCheck.intro.fallbackCheckinLabel", "Daily check-in"),
      description: t("health.symptomCheck.intro.fallbackCheckinDesc", "Log how today feels in one minute."),
      route: "/health/check-in",
      tone: "green",
      icon: "activity",
      source: "fallback",
      priority: 38,
    },
  ];
}

function symptomSeverityForSummary(summary: TriageSummary): "mild" | "moderate" | "severe" {
  if (summary.nextStepLevel === "emergency" || summary.nextStepLevel === "doctor_today" || summary.urgency === "urgent") {
    return "severe";
  }
  if (summary.nextStepLevel === "doctor_24_48" || summary.urgency === "routine") {
    return "moderate";
  }
  return "mild";
}

type ConditionChipGroup = "heart" | "diabetes" | "alzheimers" | "asthma" | "anxiety" | "falls" | "oncology";

const conditionChipGroups: Array<{ group: ConditionChipGroup; pattern: RegExp }> = [
  { group: "heart", pattern: /\b(heart|cardiac|coronary|angina|atrial|afib|hypertension|blood pressure|stroke|tia)\b/i },
  { group: "diabetes", pattern: /\b(diabetes|diabetic|glucose|blood sugar|insulin|metformin)\b/i },
  { group: "alzheimers", pattern: /\b(alzheimer|dementia|memory|cognitive)\b/i },
  { group: "asthma", pattern: /\b(asthma|copd|emphysema|inhaler|breathing)\b/i },
  { group: "anxiety", pattern: /\b(anxiety|panic|anxious|depression|low mood)\b/i },
  { group: "falls", pattern: /\b(fall|falls|unsteady|frail|frailty|balance|walker|walking aid|mobility)\b/i },
  { group: "oncology", pattern: /\b(cancer|oncology|chemo|chemotherapy|tumou?r|malignan)\b/i },
];

function matchedConditionGroups(activeConditions: string[]): ConditionChipGroup[] {
  const normalized = activeConditions.join(" ");
  const groups: ConditionChipGroup[] = [];
  for (const item of conditionChipGroups) {
    if (item.pattern.test(normalized) && !groups.includes(item.group)) groups.push(item.group);
  }
  return groups;
}

function conditionAwareIntroSuggestions(
  activeConditions: string[],
  t: ReturnType<typeof useTranslation>["t"],
): TriagePersonalizedSuggestion[] {
  const groupSuggestions: Record<ConditionChipGroup, TriagePersonalizedSuggestion[]> = {
    heart: [
      {
        id: "condition-heart-chest-tight",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionHeartChest", "Chest feels tight"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionHeartChestClue", "Chest feels tight"),
        tone: "red",
        icon: "heart",
        source: "profile",
        reasonCode: "condition_match",
        priority: 120,
      },
      {
        id: "condition-heart-short-breath",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionShortBreath", "Short of breath"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionShortBreathClue", "I feel short of breath"),
        tone: "red",
        icon: "wind",
        source: "profile",
        reasonCode: "condition_match",
        priority: 119,
      },
    ],
    diabetes: [
      {
        id: "condition-diabetes-shaky",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionDiabetesShaky", "Feeling shaky or weak"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionDiabetesShakyClue", "I feel shaky or weak"),
        tone: "amber",
        icon: "activity",
        source: "profile",
        reasonCode: "condition_match",
        priority: 118,
      },
      {
        id: "condition-diabetes-thirsty",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionDiabetesThirsty", "Very thirsty"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionDiabetesThirstyClue", "I feel very thirsty"),
        tone: "amber",
        icon: "droplet",
        source: "profile",
        reasonCode: "condition_match",
        priority: 117,
      },
    ],
    alzheimers: [
      {
        id: "condition-alzheimers-confused",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionAlzheimersConfused", "Feeling confused"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionAlzheimersConfusedClue", "I feel confused"),
        tone: "red",
        icon: "brain",
        source: "profile",
        reasonCode: "condition_match",
        priority: 116,
      },
      {
        id: "condition-alzheimers-memory",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionAlzheimersMemory", "Memory feels off"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionAlzheimersMemoryClue", "My memory feels off"),
        tone: "purple",
        icon: "brain",
        source: "profile",
        reasonCode: "condition_match",
        priority: 115,
      },
    ],
    asthma: [
      {
        id: "condition-asthma-hard-breathe",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionAsthmaBreathe", "Hard to breathe"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionAsthmaBreatheClue", "It is hard to breathe"),
        tone: "red",
        icon: "wind",
        source: "profile",
        reasonCode: "condition_match",
        priority: 114,
      },
      {
        id: "condition-asthma-chest-tight",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionHeartChest", "Chest feels tight"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionHeartChestClue", "Chest feels tight"),
        tone: "red",
        icon: "heart",
        source: "profile",
        reasonCode: "condition_match",
        priority: 113,
      },
    ],
    anxiety: [
      {
        id: "condition-anxiety-heart-racing",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionAnxietyHeart", "Heart racing"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionAnxietyHeartClue", "My heart is racing"),
        tone: "amber",
        icon: "heart",
        source: "profile",
        reasonCode: "condition_match",
        priority: 112,
      },
      {
        id: "condition-anxiety-panicked",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionAnxietyPanicked", "Feeling panicked"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionAnxietyPanickedClue", "I feel panicked"),
        tone: "purple",
        icon: "brain",
        source: "profile",
        reasonCode: "condition_match",
        priority: 111,
      },
    ],
    falls: [
      {
        id: "condition-falls-unsteady",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionFallsUnsteady", "Feeling unsteady"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionFallsUnsteadyClue", "I feel unsteady"),
        tone: "amber",
        icon: "activity",
        source: "profile",
        reasonCode: "condition_match",
        priority: 110,
      },
      {
        id: "condition-falls-dizzy",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionFallsDizzy", "Dizzy or lightheaded"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionFallsDizzyClue", "I feel dizzy or lightheaded"),
        tone: "amber",
        icon: "activity",
        source: "profile",
        reasonCode: "condition_match",
        priority: 109,
      },
    ],
    oncology: [
      {
        id: "condition-oncology-tired",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionOncologyTired", "More tired than usual"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionOncologyTiredClue", "I feel more tired than usual"),
        tone: "amber",
        icon: "activity",
        source: "profile",
        reasonCode: "condition_match",
        priority: 108,
      },
      {
        id: "condition-oncology-sick",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionOncologySick", "Feeling sick"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionOncologySickClue", "I feel sick"),
        tone: "amber",
        icon: "stethoscope",
        source: "profile",
        reasonCode: "condition_match",
        priority: 107,
      },
    ],
  };

  const seen = new Set<string>();
  const chips: TriagePersonalizedSuggestion[] = [];
  for (const group of matchedConditionGroups(activeConditions)) {
    for (const suggestion of groupSuggestions[group]) {
      const dedupeKey = suggestion.label.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      chips.push(suggestion);
      if (chips.length >= 4) return chips;
    }
  }
  return chips;
}

const suggestionIconByKey: Record<TriagePersonalizedSuggestion["icon"], LucideIcon> = {
  activity: Activity,
  brain: Brain,
  droplet: Droplets,
  gauge: Gauge,
  heart: HeartPulse,
  home: Home,
  pill: Pill,
  shield: ShieldCheck,
  stethoscope: Stethoscope,
  wind: Wind,
};

const suggestionAccentByKey: Record<TriagePersonalizedSuggestion["icon"], VyvaIconAccent> = {
  activity: "pulse",
  brain: "bridge",
  droplet: "dot",
  gauge: "trend",
  heart: "pulse",
  home: "path",
  pill: "divider",
  shield: "check",
  stethoscope: "scope",
  wind: "signal",
};

const assessmentChoiceIconByStage: Partial<Record<SymptomAssessmentStageId, {
  Icon: LucideIcon;
  accent: VyvaIconAccent;
}>> = {
  describe: { Icon: Stethoscope, accent: "scope" },
  symptom_selection: { Icon: HeartPulse, accent: "pulse" },
  severity: { Icon: Gauge, accent: "trend" },
  onset: { Icon: Calendar, accent: "calendar" },
  related_details: { Icon: Activity, accent: "signal" },
  review: { Icon: ClipboardList, accent: "check" },
};

const suggestionToneClass: Record<TriagePersonalizedSuggestion["tone"], { button: string; icon: string; badge: string }> = {
  amber: {
    button: "border-[#FED7AA] bg-[#FFF7ED] hover:border-[#FDBA74]",
    icon: "bg-[#FFEDD5] text-[#C2410C]",
    badge: "bg-[#FFEDD5] text-[#9A3412]",
  },
  blue: {
    button: "border-[#BFDBFE] bg-[#EFF6FF] hover:border-[#93C5FD]",
    icon: "bg-[#DBEAFE] text-[#1D4ED8]",
    badge: "bg-[#DBEAFE] text-[#1D4ED8]",
  },
  green: {
    button: "border-[#BBF7D0] bg-[#ECFDF5] hover:border-[#86EFAC]",
    icon: "bg-[#D1FAE5] text-[#047857]",
    badge: "bg-[#D1FAE5] text-[#047857]",
  },
  purple: {
    button: "border-[#DDD6FE] bg-[#F5F3FF] hover:border-[#C4B5FD]",
    icon: "bg-[#EDE9FE] text-vyva-purple",
    badge: "bg-[#EDE9FE] text-vyva-purple",
  },
  red: {
    button: "border-[#FECACA] bg-[#FEF2F2] hover:border-[#FCA5A5]",
    icon: "bg-[#FEE2E2] text-[#B91C1C]",
    badge: "bg-[#FEE2E2] text-[#B91C1C]",
  },
};

type VoiceCaptureState = "idle" | "recording" | "transcribing";
const VOICE_CAPTURE_MAX_MS = 30_000;

const voiceMimeCandidates = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function preferredVoiceMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return voiceMimeCandidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  }) ?? "";
}

function stopVoiceStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function IntroScreen({
  onStart,
  startDisabled = false,
  onTalkToVyva,
  onNavigate,
  personalizedSuggestions,
  activeConditions = [],
  profileContextItems = [],
  emergencyContact = null,
  showEmergencyModal: controlledShowEmergencyModal,
  onEmergencyModalDismiss,
}: IntroScreenProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { isDark } = useHomeMasterTheme();
  const [clue, setClue] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceCaptureState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [localShowEmergencyModal, setLocalShowEmergencyModal] = useState(true);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [examplePage, setExamplePage] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStopTimerRef = useRef<number | null>(null);
  const cleanClue = clue.trim();
  const canStart = cleanClue.length >= 2;
  const isRecordingVoice = voiceState === "recording";
  const isTranscribingVoice = voiceState === "transcribing";
  const fallbackSuggestions = fallbackIntroSuggestions(t);
  const suggestions = personalizedSuggestions?.length ? personalizedSuggestions : fallbackSuggestions;
  const conditionExamples = conditionAwareIntroSuggestions(activeConditions, t);
  const candidateConcerns = suggestions.filter((suggestion) => suggestion.kind === "common_concern");
  const fallbackConcerns = fallbackSuggestions.filter((suggestion) => suggestion.kind === "common_concern");
  const examplePoolCandidates = [
    ...conditionExamples,
    ...candidateConcerns,
    ...fallbackConcerns,
  ];
  const examplePool = examplePoolCandidates.filter((suggestion, index) => {
    const normalizedLabel = suggestion.label.trim().toLowerCase();
    return examplePoolCandidates.findIndex((candidate) => candidate.label.trim().toLowerCase() === normalizedLabel) === index;
  });
  const examplePageCount = Math.max(1, Math.ceil(examplePool.length / 3));
  const normalizedExamplePage = examplePage % examplePageCount;
  const exampleOffset = normalizedExamplePage * 3;
  const visibleExamples = Array.from(
    { length: Math.min(3, examplePool.length) },
    (_, index) => examplePool[(exampleOffset + index) % examplePool.length],
  );
  const canRefreshExamples = examplePool.length > visibleExamples.length;
  const visibleExampleIds = new Set(visibleExamples.map((suggestion) => suggestion.id));
  const moreSymptoms = [
    ...suggestions.filter((suggestion) => !visibleExampleIds.has(suggestion.id)),
    ...fallbackSuggestions.filter((suggestion) => !visibleExampleIds.has(suggestion.id) && !suggestions.some((current) => current.id === suggestion.id)),
  ].slice(0, 8);
  const hasProfileSuggestions = suggestions.some((suggestion) => suggestion.source !== "fallback");
  const sourceLabels: Record<TriagePersonalizedSuggestion["source"], string> = {
    fallback: t("health.symptomCheck.intro.sourceFallback", "Common option"),
    medications: t("health.symptomCheck.intro.sourceMedications", "From medicines"),
    profile: t("health.symptomCheck.intro.sourceProfile", "Based on profile"),
    recent_report: t("health.symptomCheck.intro.sourceRecentReport", "Recent report"),
    vitals: t("health.symptomCheck.intro.sourceVitals", "Recent vitals"),
  };
  const renderSuggestion = (suggestion: TriagePersonalizedSuggestion) => {
    const Icon = suggestionIconByKey[suggestion.icon] ?? Stethoscope;
    const accent = suggestionAccentByKey[suggestion.icon] ?? "scope";
    const tone = suggestionToneClass[suggestion.tone] ?? suggestionToneClass.purple;
    const isConcern = suggestion.kind === "common_concern";
    return (
      <button
        key={suggestion.id}
        type="button"
        disabled={isConcern && startDisabled}
        onClick={() => {
          if (isConcern && startDisabled) return;
          if (isConcern) {
            onStart(suggestion.initialClue || suggestion.label);
            return;
          }
          if (suggestion.route) onNavigate?.(suggestion.route);
        }}
        data-testid={`button-symptom-intro-suggestion-${suggestion.id}`}
        className={`vyva-tap group flex min-h-[72px] w-full min-w-0 items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/45 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-55 ${isDark ? "border-white/[0.13] bg-[#352842] shadow-[0_8px_22px_rgba(0,0,0,0.10)] hover:border-[#8B5CF6]/55 hover:bg-[#3D2D4B]" : `${tone.button} shadow-[0_8px_20px_rgba(63,45,35,0.05)]`}`}
      >
        <span
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[13px] ${isDark ? "bg-[#45325E]" : tone.icon}`}
          data-vyva-icon-tile={suggestion.icon}
        >
          <VyvaIcon icon={Icon} accent={accent} size={21} strokeWidth={2.45} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`break-words font-body text-[16px] font-semibold leading-[1.42] tracking-[-0.005em] ${isDark ? "text-[#FFF8FF]" : "text-vyva-text-1"}`}>
              {suggestion.label}
            </span>
            {suggestion.source !== "fallback" ? (
              <span className={`rounded-full px-2.5 py-1 font-body text-[10px] font-black uppercase tracking-[0.08em] ${isDark ? "bg-[#45325E] text-[#D8B4FE]" : tone.badge}`}>
                {sourceLabels[suggestion.source]}
              </span>
            ) : null}
          </span>
          <span className={`mt-1 block font-body text-[13px] font-bold leading-snug ${isDark ? "text-[#D8CDE4]" : "text-vyva-text-2"}`}>
            {suggestion.description}
          </span>
        </span>
        {isConcern ? null : (
          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${isDark ? "bg-[#45325E]" : "bg-white/80 shadow-sm"}`}>
            <VyvaIcon icon={ArrowRight} tone="muted" size={18} strokeWidth={2.8} />
          </span>
        )}
      </button>
    );
  };

  const renderExampleChip = (suggestion: TriagePersonalizedSuggestion, index: number) => {
    const Icon = suggestionIconByKey[suggestion.icon] ?? Stethoscope;
    const accent = suggestionAccentByKey[suggestion.icon] ?? "scope";
    return (
      <button
        key={suggestion.id}
        type="button"
        disabled={startDisabled}
        onClick={() => onStart(suggestion.initialClue || suggestion.label)}
        data-testid={`button-symptom-example-${index}`}
        className={`symptom-canonical-choice vyva-tap flex min-h-[60px] min-w-0 items-center gap-3 rounded-[18px] border px-4 py-3 text-left shadow-[0_8px_22px_rgba(0,0,0,0.08)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/40 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-55 ${isDark ? "border-white/[0.13] bg-[#352842] hover:border-[#8B5CF6]/55" : "border-[#DED3E2] bg-white hover:border-[#B99BCE]"}`}
      >
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] ${isDark ? "bg-[#45325E]" : "bg-[#F3EAFF]"}`}
          data-vyva-icon-tile={suggestion.icon}
        >
          <VyvaIcon icon={Icon} accent={accent} size={21} strokeWidth={2.45} />
        </span>
        <span className="min-w-0 flex-1">
            <span className={`block break-words font-body text-[16px] font-semibold leading-[1.42] tracking-[-0.005em] ${isDark ? "text-[#FFF8FF]" : "text-vyva-text-1"}`}>
            {suggestion.label}
          </span>
          {suggestion.source !== "fallback" ? (
            <span className="mt-1 block font-body text-[10px] font-black uppercase tracking-[0.08em] text-[#765C83]">
              {sourceLabels[suggestion.source]}
            </span>
          ) : null}
        </span>
        <VyvaIcon icon={ArrowRight} tone="muted" size={18} strokeWidth={2.6} className="flex-shrink-0" />
      </button>
    );
  };

  const clearVoiceStopTimer = useCallback(() => {
    if (voiceStopTimerRef.current !== null) {
      window.clearTimeout(voiceStopTimerRef.current);
      voiceStopTimerRef.current = null;
    }
  }, []);

  const transcribeVoiceBlob = useCallback(async (blob: Blob) => {
    if (blob.size < 32) {
      setVoiceState("idle");
      setVoiceError(t("health.symptomCheck.intro.voiceEmpty", "I couldn't hear anything clearly. Please try again."));
      return;
    }

    setVoiceState("transcribing");
    try {
      const res = await apiFetch(`/api/triage/transcribe?language=${encodeURIComponent(language)}`, {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
      });

      const payload = await res.json().catch(() => null) as { transcript?: unknown; error?: unknown } | null;
      if (!res.ok) {
        const message = typeof payload?.error === "string"
          ? payload.error
          : t("health.symptomCheck.intro.voiceFailed", "I couldn't turn that voice note into text. Please try again.");
        throw new Error(message);
      }

      const transcript = typeof payload?.transcript === "string" ? payload.transcript.trim() : "";
      if (!transcript) {
        throw new Error(t("health.symptomCheck.intro.voiceEmpty", "I couldn't hear anything clearly. Please try again."));
      }

      setClue(transcript);
      setShowCustomInput(true);
      setVoiceError(null);
      window.setTimeout(() => {
        document.getElementById("symptom-clue")?.focus();
      }, 0);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : t("health.symptomCheck.intro.voiceFailed", "I couldn't turn that voice note into text. Please try again."));
    } finally {
      setVoiceState("idle");
    }
  }, [language, t]);

  const stopVoiceCapture = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const startVoiceCapture = useCallback(async () => {
    setVoiceError(null);
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError(t("health.symptomCheck.intro.voiceUnsupported", "Voice input is not available in this browser."));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];

      const mimeType = preferredVoiceMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        clearVoiceStopTimer();
        stopVoiceStream(stream);
        voiceStreamRef.current = null;
        recorderRef.current = null;
        voiceChunksRef.current = [];
        setVoiceState("idle");
        setVoiceError(t("health.symptomCheck.intro.voiceMicError", "I couldn't use the microphone. Please try again or type instead."));
      };
      recorder.onstop = () => {
        clearVoiceStopTimer();
        const chunks = voiceChunksRef.current;
        const recordedType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: recordedType });
        stopVoiceStream(stream);
        voiceStreamRef.current = null;
        recorderRef.current = null;
        voiceChunksRef.current = [];
        void transcribeVoiceBlob(blob);
      };

      recorder.start();
      voiceStopTimerRef.current = window.setTimeout(() => {
        const activeRecorder = recorderRef.current;
        if (activeRecorder && activeRecorder.state !== "inactive") {
          activeRecorder.stop();
        }
      }, VOICE_CAPTURE_MAX_MS);
      setVoiceState("recording");
    } catch {
      clearVoiceStopTimer();
      stopVoiceStream(voiceStreamRef.current);
      voiceStreamRef.current = null;
      recorderRef.current = null;
      setVoiceState("idle");
      setVoiceError(t("health.symptomCheck.intro.voiceMicError", "I couldn't use the microphone. Please try again or type instead."));
    }
  }, [clearVoiceStopTimer, t, transcribeVoiceBlob]);

  const toggleVoiceCapture = useCallback(() => {
    if (isTranscribingVoice) return;
    if (isRecordingVoice) {
      stopVoiceCapture();
      return;
    }
    void startVoiceCapture();
  }, [isRecordingVoice, isTranscribingVoice, startVoiceCapture, stopVoiceCapture]);

  useEffect(() => () => {
    clearVoiceStopTimer();
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
    }
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    stopVoiceStream(voiceStreamRef.current);
  }, [clearVoiceStopTimer]);

  const voiceButtonLabel = isRecordingVoice
    ? t("health.symptomCheck.intro.voiceStop", "Stop voice input")
    : isTranscribingVoice
      ? t("health.symptomCheck.intro.voiceTranscribing", "Turning voice into text")
      : onTalkToVyva
        ? t("health.symptomCheck.intro.talkToVyva", "Talk to VYVA")
        : t("health.symptomCheck.intro.voiceStart", "Use voice input");
  const voiceStatus = isRecordingVoice
    ? t("health.symptomCheck.intro.voiceRecording", "Listening... tap again to stop. It stops after 30 seconds.")
    : isTranscribingVoice
      ? t("health.symptomCheck.intro.voiceTranscribingStatus", "Turning voice into text...")
      : voiceError;
  const showEmergencyModal = controlledShowEmergencyModal ?? localShowEmergencyModal;
  const dismissEmergencyModal = () => {
    if (onEmergencyModalDismiss) {
      onEmergencyModalDismiss();
      return;
    }
    setLocalShowEmergencyModal(false);
  };

  if (showCustomInput) {
    return (
      <div
        className="symptom-canonical-intro mx-auto flex min-h-0 w-full max-w-[760px] flex-1 flex-col px-4 pb-24 pt-2 sm:px-5 lg:px-0"
        data-testid="symptom-custom-input"
      >
        <div className={`flex min-h-[calc(100dvh-280px)] flex-1 flex-col rounded-[28px] border px-5 pb-5 pt-4 shadow-[0_16px_40px_rgba(0,0,0,0.10)] sm:min-h-[calc(100dvh-230px)] sm:px-7 sm:pb-7 ${isDark ? "border-white/[0.14] bg-[#2B2035]" : "border-[#E2D7E7] bg-white"}`}>
          <button
            type="button"
            onClick={() => setShowCustomInput(false)}
            className="vyva-tap inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full px-1 pr-3 font-body text-[14px] font-black text-vyva-purple transition hover:bg-[#F7F1FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7024C4] focus-visible:ring-offset-2"
          >
            <ChevronLeft size={19} strokeWidth={2.7} aria-hidden="true" />
            {t("health.symptomCheck.intro.backToOptions", "Back to options")}
          </button>

          <label className={`mt-4 font-body text-[28px] font-extrabold leading-tight tracking-[-0.025em] sm:text-[32px] ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"}`} htmlFor="symptom-clue">
            {t("health.symptomCheck.intro.writeTitle", "What are you feeling?")}
          </label>
          <textarea
            id="symptom-clue"
            value={clue}
            onChange={(event) => {
              setClue(event.target.value);
              if (voiceError) setVoiceError(null);
            }}
            placeholder={t("health.symptomCheck.intro.writePlaceholder", "Start typing...")}
            data-testid="input-symptom-clue"
            style={{ border: "none", boxShadow: "none" }}
            className={`mt-4 min-h-[32dvh] w-full flex-1 resize-none appearance-none border-none bg-transparent p-0 font-body text-[20px] font-semibold leading-[1.7] outline-none placeholder:text-[#A79BA9] focus:border-transparent focus:outline-none focus:ring-0 sm:min-h-[46dvh] ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"}`}
          />

          <div className="mt-4 border-t border-[#E9E0EC] pt-4">
            <button
              type="button"
              onClick={() => onStart(cleanClue)}
              disabled={!canStart || startDisabled}
              data-testid="button-symptom-check-start"
              className="vyva-tap flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#7024C4] px-5 font-body text-[17px] font-black text-white shadow-[0_10px_22px_rgba(112,36,196,0.18)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("health.symptomCheck.intro.startBtn", "Start check")}
              <ArrowRight size={19} strokeWidth={2.8} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="symptom-canonical-intro mx-auto flex w-full min-w-0 max-w-[1040px] flex-1 flex-col gap-4 px-4 py-3 sm:px-5 lg:px-0" data-testid="symptom-check-intro">
      {showEmergencyModal ? (
        <EmergencySafetyDialog
          emergencyContact={emergencyContact}
          onDismiss={dismissEmergencyModal}
        />
      ) : null}

      <div
        data-testid="symptom-check-start-panel"
        className="mx-auto w-full min-w-0 max-w-[760px]"
      >
        <span className="sr-only">
          {t("health.symptomCheck.intro.assistantTitle", "Choose what feels different")}
        </span>
        <SymptomAssessmentPresentation
          stageId="describe"
          modality="touch"
          showHeader={false}
          title={t("health.symptomCheck.intro.choiceTitle", "What feels different today?")}
          helper=""
        >
          <div className="grid min-w-0 gap-2 text-left" data-testid="symptom-check-example-chips">
            <div className="flex min-h-8 items-center justify-end px-1">
              {canRefreshExamples ? (
                <button
                  type="button"
                  onClick={() => setExamplePage((current) => (current + 1) % examplePageCount)}
                  data-testid="button-symptom-more-examples"
                  aria-label={t("health.symptomCheck.intro.moreExamples", "More examples")}
                  title={t("health.symptomCheck.intro.moreExamples", "More examples")}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-vyva-purple transition hover:text-[#4C168C] active:rotate-45 focus-visible:rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7024C4] focus-visible:ring-offset-2"
                >
                  <VyvaIcon icon={RefreshCw} accent="spark" size={20} strokeWidth={2.5} />
                </button>
              ) : null}
            </div>
            <div className="grid gap-2" aria-live="polite" data-example-page={normalizedExamplePage + 1}>
              {visibleExamples.map(renderExampleChip)}
              <button
                type="button"
                disabled={startDisabled}
                onClick={() => {
                  setShowCustomInput(true);
                  window.setTimeout(() => {
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                    document.getElementById("symptom-clue")?.focus({ preventScroll: true });
                  }, 0);
                }}
                aria-expanded={showCustomInput}
                data-testid="button-symptom-other"
                className={`symptom-canonical-choice vyva-tap flex min-h-[60px] min-w-0 items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/40 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-55 ${isDark ? "border-white/[0.13] bg-[#352842] hover:border-[#8B5CF6]/55" : "border-[#DED3E2] bg-[#FCFAFD] hover:border-[#B99BCE] hover:bg-white"}`}
              >
                <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] ${isDark ? "bg-[#45325E]" : "bg-[#F3EAFF]"}`}>
                  <VyvaIcon icon={Keyboard} accent="knobs" size={20} strokeWidth={2.45} />
                </span>
                <span className={`min-w-0 flex-1 font-body text-[16px] font-semibold leading-[1.42] tracking-[-0.005em] ${isDark ? "text-[#FFF8FF]" : "text-vyva-text-1"}`}>
                  {t("health.symptomCheck.intro.typeOption", "Type your symptoms")}
                </span>
                <VyvaIcon icon={ArrowRight} tone="muted" size={18} strokeWidth={2.6} className="flex-shrink-0" />
              </button>
            </div>

            {!onTalkToVyva ? (
              <button
                type="button"
                onClick={toggleVoiceCapture}
                disabled={isTranscribingVoice}
                aria-label={voiceButtonLabel}
                title={voiceButtonLabel}
                data-testid="button-symptom-clue-voice"
                className={`vyva-tap mt-1 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[16px] px-4 font-body text-[16px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B21A8] focus-visible:ring-offset-2 ${
                  isRecordingVoice
                    ? "border border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]"
                    : "border border-[#D8C7E4] bg-white text-vyva-purple"
                } disabled:cursor-wait disabled:opacity-70`}
              >
                {isTranscribingVoice ? (
                  <Loader2 size={20} strokeWidth={2.8} className="animate-spin" />
                ) : isRecordingVoice ? (
                  <Square size={17} strokeWidth={3} fill="currentColor" />
                ) : (
                  <Mic size={20} strokeWidth={2.7} />
                )}
                {voiceButtonLabel}
              </button>
            ) : null}

            {voiceStatus ? (
              <p
                role={voiceError ? "alert" : "status"}
                data-testid="symptom-clue-voice-status"
                className={`mt-1 px-2 font-body text-[13px] font-bold leading-snug ${voiceError ? "text-[#B91C1C]" : "text-vyva-text-2"}`}
              >
                {voiceStatus}
              </p>
            ) : null}
          </div>
        </SymptomAssessmentPresentation>
      </div>

      {(moreSymptoms.length || profileContextItems.length) ? (
        <details
          data-testid="symptom-check-more-symptoms"
          className={`group mx-auto mb-[calc(8rem+env(safe-area-inset-bottom))] hidden w-full max-w-[520px] rounded-[22px] border p-4 shadow-[0_10px_26px_rgba(0,0,0,0.10)] lg:block ${isDark ? "border-white/[0.14] bg-[#2B2035]" : "border-[#E8DED4] bg-white"}`}
        >
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/45">
            <span className={`font-body text-[17px] font-black ${isDark ? "text-[#FFF8FF]" : "text-vyva-text-1"}`}>
              {t("health.symptomCheck.intro.moreSymptoms", "More symptoms")}
            </span>
            <ChevronLeft size={20} className="-rotate-90 flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-90" />
          </summary>
          <div className={`mt-3 grid gap-2.5 border-t pt-3 ${isDark ? "border-white/[0.10]" : "border-[#EADFD5]"}`}>
            {profileContextItems.length ? (
              <div data-testid="symptom-check-profile-context" className={`rounded-[18px] border px-4 py-3 ${isDark ? "border-white/[0.12] bg-[#352842]" : "border-[#EDE5DB] bg-[#FFFCF8]"}`}>
                <p className={`font-body text-[12px] font-black uppercase tracking-[0.14em] ${isDark ? "text-[#D8B4FE]" : "text-vyva-purple"}`}>
                  {hasProfileSuggestions
                    ? t("health.symptomCheck.intro.personalizedBadge", "Profile tuned")
                    : t("health.symptomCheck.intro.fallbackBadge", "Helpful starts")}
                </p>
                <p className={`mt-1 font-body text-[14px] font-bold leading-snug ${isDark ? "text-[#D8CDE4]" : "text-vyva-text-2"}`}>
                  {profileContextItems.slice(0, 4).join(" - ")}
                </p>
              </div>
            ) : null}
            {moreSymptoms.map(renderSuggestion)}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ReportConfig(summary: TriageSummary) {
  const level = summary.nextStepLevel ?? (summary.urgency === "urgent" ? "doctor_today" : summary.urgency === "routine" ? "doctor_24_48" : "monitor");
  if (level === "emergency") {
    return {
      bg: "linear-gradient(135deg, #B91C1C 0%, #EF4444 100%)",
      icon: AlertTriangle,
      urgencyLabel: "health.symptomCheck.report.emergencyUrgencyLabel",
      fallbackUrgencyLabel: "Emergency urgency",
      label: "health.symptomCheck.report.emergencyLabel",
      fallbackLabel: "Emergency now",
      pillBg: "rgba(255,255,255,0.25)",
      level,
    };
  }
  if (level === "doctor_today") {
    return {
      bg: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)",
      icon: Stethoscope,
      urgencyLabel: "health.symptomCheck.report.highUrgencyLabel",
      fallbackUrgencyLabel: "High urgency",
      label: "health.symptomCheck.report.doctorTodayLabel",
      fallbackLabel: "Doctor today",
      pillBg: "rgba(255,255,255,0.25)",
      level,
    };
  }
  if (level === "doctor_24_48") {
    return {
      bg: "linear-gradient(135deg, #1D4ED8 0%, #6D28D9 100%)",
      icon: Eye,
      urgencyLabel: "health.symptomCheck.report.mediumUrgencyLabel",
      fallbackUrgencyLabel: "Medium urgency",
      label: "health.symptomCheck.report.routineLabel",
      fallbackLabel: "Doctor within 24-48 hours",
      pillBg: "rgba(255,255,255,0.25)",
      level,
    };
  }
  return {
    bg: "linear-gradient(135deg, #0A7C4E 0%, #10B981 100%)",
    icon: CheckCircle,
    urgencyLabel: "health.symptomCheck.report.lowUrgencyLabel",
    fallbackUrgencyLabel: "Low urgency",
    label: "health.symptomCheck.report.monitorLabel",
    fallbackLabel: "Monitor at home",
    pillBg: "rgba(255,255,255,0.25)",
    level,
  };
}

function uniqueLines(lines: string[]) {
  return uniqueReportLines(lines);
}

function directShareChannel(value: string): DoctorShareTarget["channel"] {
  return value.includes("@") ? "email" : "sms";
}

function findDoctorShareTarget(
  profileContacts: ProfileContactsResponse | undefined,
  careTeamMembers: CareTeamMember[],
  fallbackDoctorName: string,
): DoctorShareTarget | null {
  const gpPhone = profileContacts?.gpPhone?.trim();
  if (gpPhone) {
    return {
      name: profileContacts?.gpName?.trim() || fallbackDoctorName,
      value: gpPhone,
      channel: "sms",
    };
  }

  const careTeamDoctor = careTeamMembers.find((member) => {
    const status = member.status?.toLowerCase();
    if (status && ["revoked", "declined", "expired"].includes(status)) return false;
    const hasContact = Boolean(member.invitee_email?.trim() || member.invitee_phone?.trim());
    if (!hasContact) return false;
    const role = member.role?.toLowerCase();
    const relationship = member.relationship?.toLowerCase();
    return role === "doctor" || relationship === "gp" || relationship === "specialist_doctor";
  });

  const value = careTeamDoctor?.invitee_email?.trim() || careTeamDoctor?.invitee_phone?.trim();
  if (!careTeamDoctor || !value) return null;

  return {
    name: careTeamDoctor.invitee_name?.trim() || fallbackDoctorName,
    value,
    channel: directShareChannel(value),
  };
}

function directDoctorShareHref(target: DoctorShareTarget, subject: string, text: string) {
  if (target.channel === "email") {
    return `mailto:${encodeURIComponent(target.value)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  }

  const separator = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?";
  return `sms:${target.value}${separator}body=${encodeURIComponent(text)}`;
}

function parseNumber(raw: string) {
  const value = Number(raw.replace(",", ".").trim());
  return Number.isFinite(value) ? value : null;
}

function parseRangeNumber(raw: string, min: number, max: number) {
  const value = parseNumber(raw);
  if (value == null || value < min || value > max) return null;
  return value;
}

function parseBloodPressure(raw: string) {
  const match = raw.trim().match(/^(\d{2,3})\s*[/ ]\s*(\d{2,3})$/);
  if (!match) return null;
  const systolic = Number(match[1]);
  const diastolic = Number(match[2]);
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null;
  return { systolic, diastolic };
}

function normalizeReadingValue(value: string | number | null | undefined) {
  if (value == null) return "";
  return String(value).trim();
}

function findLatestReading(readings: LatestVitalReading[], signalType: string) {
  return readings.find((reading) => reading.signal_type === signalType && normalizeReadingValue(reading.value));
}

function latestCandidateForAction(action: RefinementVitalConfig, readings: LatestVitalReading[]): LatestVitalCandidate | null {
  if (action.key === "bloodPressure") {
    const systolic = findLatestReading(readings, "bp_systolic");
    const diastolic = findLatestReading(readings, "bp_diastolic");
    if (!systolic || !diastolic) return null;

    const value = `${normalizeReadingValue(systolic.value)}/${normalizeReadingValue(diastolic.value)}`;
    const parsed = action.parse(value);
    if (!parsed) return null;
    return {
      value,
      display: parsed.display,
      source: systolic.source ?? diastolic.source ?? null,
    };
  }

  const reading = findLatestReading(readings, action.signalType);
  if (!reading) return null;
  const value = normalizeReadingValue(reading.value);
  const parsed = action.parse(value);
  if (!parsed) return null;
  return {
    value,
    display: parsed.display,
    source: reading.source ?? null,
  };
}

function refinementKeyForMissingSignal(label: string): RefinementVitalKey | null {
  const normalized = label.toLowerCase();
  if (/\b(blood pressure|bp|hypertension|pressure)\b/.test(normalized)) return "bloodPressure";
  if (/\b(pulse|heart rate|heartbeat|afib|irregular)\b/.test(normalized)) return "pulse";
  if (/\b(oxygen|spo2|short of breath|breathing|breathless)\b/.test(normalized)) return "oxygen";
  if (/\b(respiratory rate|breathing rate|breaths per minute|fast breathing)\b/.test(normalized)) return "respiratoryRate";
  if (/\b(fever|temperature|chills)\b/.test(normalized)) return "temperature";
  if (/\b(glucose|sugar|diabetes|diabetic|insulin|cgm)\b/.test(normalized)) return "glucose";
  if (/\b(pain|ache|headache|injury)\b/.test(normalized)) return "pain";
  if (/\b(energy|fatigue|tired|weak|exhausted|dizzy)\b/.test(normalized)) return "energy";
  return null;
}

function reportText(summary: TriageSummary) {
  return [
    summary.chiefComplaint,
    ...summary.symptoms,
  ...(summary.triageReasons ?? []),
  ...(summary.profileConsiderations ?? []),
  ...(summary.vitalsNotes ?? []),
  ...(summary.scanNotes ?? []),
  ].join(" ").toLowerCase();
}

export function ReportScreen({
  summary,
  bpm,
  respiratoryRate,
  durationSeconds,
  reportId,
  reportSaveState,
  savedReport,
  profileContacts,
  careTeamMembers,
  emergencyContact,
  latestVitalReadings = [],
  refinementStatus,
  onRefineVital,
  onDone,
}: {
  summary: TriageSummary;
  bpm: number | null;
  respiratoryRate: number | null;
  durationSeconds: number | null;
  reportId: string | null;
  reportSaveState: ReportSaveState;
  savedReport: SavedTriageReport | null;
  profileContacts?: ProfileContactsResponse;
  careTeamMembers: CareTeamMember[];
  emergencyContact?: EmergencyContact | null;
  latestVitalReadings?: LatestVitalReading[];
  refinementStatus: RefinementStatus;
  onRefineVital?: (config: RefinementVitalConfig, rawValue: string) => Promise<void>;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useHomeMasterTheme();
  const { toast } = useToast();
  const cfg = ReportConfig(summary);
  const UrgencyIcon = cfg.icon;
  const isEmergency = cfg.level === "emergency";
  const urgencyIconAccent = isEmergency ? undefined : "spark";
  const darkHeroVisual = cfg.level === "emergency"
    ? { background: "#3A242E", accent: "#FDA4AF", border: "rgba(251, 113, 133, 0.35)", iconBg: "#562C38" }
    : cfg.level === "doctor_today"
      ? { background: "#382D24", accent: "#FCD98A", border: "rgba(248, 174, 27, 0.32)", iconBg: "#52402A" }
      : cfg.level === "doctor_24_48"
        ? { background: "#342548", accent: "#D8B4FE", border: "rgba(167, 139, 250, 0.35)", iconBg: "#45325E" }
        : { background: "#1D332B", accent: "#A7F3D0", border: "rgba(74, 222, 128, 0.35)", iconBg: "#234D3A" };
  const lightHeroVisual = cfg.level === "emergency"
    ? { background: "#FFF7F7", border: "#F2B8B8", accent: "#B91C1C", iconBg: "#FEE2E2", pillBg: "#FDE8E8" }
    : cfg.level === "doctor_today"
      ? { background: "#FFFBEB", border: "#F3D38B", accent: "#A64B08", iconBg: "#FEF3C7", pillBg: "#FEF3C7" }
      : cfg.level === "doctor_24_48"
        ? { background: "#F8F7FF", border: "#CBC6F7", accent: "#5B35B5", iconBg: "#EDE9FE", pillBg: "#EDE9FE" }
        : { background: "#F3FBF7", border: "#A9DEC5", accent: "#087A50", iconBg: "#DDF5E9", pillBg: "#DDF5E9" };
  const urgencyQualifierText = t(cfg.urgencyLabel, cfg.fallbackUrgencyLabel);
  const urgencyStatusText = t(cfg.label, cfg.fallbackLabel);
  const nextStepDisplayText = (() => {
    const level = summary.nextStepLevel ?? cfg.level;
    if (level === "emergency") {
      return t("health.symptomCheck.report.nextStepEmergency", "Call emergency services now");
    }
    if (level === "doctor_today") {
      return t("health.symptomCheck.report.nextStepDoctorToday", "Talk to a doctor today");
    }
    if (level === "doctor_24_48") {
      return t("health.symptomCheck.report.nextStepDoctor24_48", "Talk to a doctor within 24-48 hours");
    }
    if (level === "monitor") {
      return t("health.symptomCheck.report.nextStepMonitorReady", "Monitor at home, with doctor access ready");
    }
    return summary.nextStepLabel ?? t(cfg.label, cfg.fallbackLabel);
  })();
  const recommendationExplanation = (() => {
    const level = summary.nextStepLevel ?? cfg.level;
    if (level === "emergency") {
      return t("health.symptomCheck.report.explainEmergency", "Your answers included an emergency warning sign, so the next step is urgent help now.");
    }
    if (level === "doctor_today") {
      return t("health.symptomCheck.report.explainDoctorToday", "Your answers suggest this should be reviewed today rather than watched at home.");
    }
    if (level === "doctor_24_48") {
      return t("health.symptomCheck.report.explainDoctorSoon", "Your answers point to medical follow-up soon, with clear watch signs in the meantime.");
    }
    return t("health.symptomCheck.report.explainMonitor", "Your answers fit home monitoring for now, with clear signs that should change the plan.");
  })();
  const emergencyCallLabel = emergencyContact?.telHref
    ? t("health.symptomCheck.report.callEmergencyNumber", "Call {{number}}", { number: emergencyContact.label })
    : t("health.symptomCheck.report.contactEmergencyServices", "Contact emergency services");
  const emergencyBody = emergencyContact?.telHref
    ? t("health.symptomCheck.report.emergencyBodyWithNumber", "Call {{number}} now. Do not drive yourself. Keep this report open for the responder.", {
        number: emergencyContact.label,
      })
    : t("health.symptomCheck.report.emergencyBodyGeneric", "Contact local emergency services now. Do not drive yourself. Keep this report open for the responder.");
  const [openVitalKey, setOpenVitalKey] = useState<RefinementVitalKey | null>(null);
  const [vitalInputs, setVitalInputs] = useState<Record<string, string>>({});
  const [vitalInputError, setVitalInputError] = useState<string | null>(null);
  const reportTopRef = useRef<HTMLDivElement | null>(null);
  const vitalRefinementRef = useRef<HTMLDetailsElement | null>(null);
  const reportDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const [reportDetailView, setReportDetailView] = useState<"why" | "context" | "share" | "full" | null>(isEmergency ? "why" : null);
  useEffect(() => {
    if (refinementStatus.state === "done") {
      reportTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [refinementStatus.state]);
  const durationText = durationSeconds != null
    ? durationSeconds < 60
      ? `${durationSeconds}s`
      : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
    : null;
  const doctorContactName = profileContacts?.gpName?.trim() || (profileContacts?.gpPhone?.trim() ? t("health.symptomCheck.report.doctorContact", "your doctor") : "");
  const caregiverContactName = profileContacts?.caregiverName?.trim() || (profileContacts?.caregiverContact?.trim() ? t("health.symptomCheck.report.caregiverContact", "your caregiver") : "");
  const reportMissingSignals = uniqueLines([
    ...(summary.contextConfidence?.missing ?? []),
    ...(summary.contextSignals ?? [])
      .filter((signal) => signal.status === "missing")
      .map((signal) => signal.label),
  ]).slice(0, 3);
  const actionText = [reportText(summary), ...reportMissingSignals].join(" ").toLowerCase();
  const vitalActions: RefinementVitalConfig[] = [
    /\b(glucose|sugar|diabetes|diabetic|insulin|cgm)\b/.test(actionText)
      ? {
          key: "glucose",
          title: t("health.symptomCheck.report.checkGlucoseNow", "Check glucose now"),
          unit: "mg/dL",
          placeholder: "92",
          helper: t("health.symptomCheck.report.checkGlucoseReason", "Add the number to this report before you speak to a doctor."),
          signalType: "glucose_mgdl",
          parse: (raw) => {
            const value = parseNumber(raw);
            return value == null ? null : { value, display: `${value} mg/dL`, vitals: { glucoseMgdl: value } };
          },
        }
      : null,
    /\b(blood pressure|bp|hypertension|180\/120|pressure)\b/.test(actionText)
      ? {
          key: "bloodPressure",
          title: t("health.symptomCheck.report.checkBloodPressureNow", "Check blood pressure now"),
          unit: "",
          placeholder: "120/80",
          helper: t("health.symptomCheck.report.checkBloodPressureReason", "Enter both numbers, for example 120/80."),
          signalType: "bp_systolic",
          parse: (raw) => {
            const bp = parseBloodPressure(raw);
            return bp ? { value: bp.systolic, extraValue: bp.diastolic, display: `${bp.systolic}/${bp.diastolic}`, vitals: { systolicBp: bp.systolic, diastolicBp: bp.diastolic } } : null;
          },
        }
      : null,
    /\b(oxygen|spo2|short of breath|breathing|breathless|blue lips)\b/.test(actionText)
      ? {
          key: "oxygen",
          title: t("health.symptomCheck.report.checkOxygenNow", "Check oxygen now"),
          unit: "%",
          placeholder: "96",
          helper: t("health.symptomCheck.report.checkOxygenReason", "Add your oxygen reading if you have a pulse oximeter."),
          signalType: "oxygen_saturation",
          parse: (raw) => {
            const value = parseNumber(raw);
            return value == null ? null : { value, display: `${value}%`, vitals: { oxygenSaturation: value } };
          },
        }
      : null,
    /\b(respiratory rate|breathing rate|breaths per minute|fast breathing)\b/.test(actionText)
      ? {
          key: "respiratoryRate",
          title: t("health.symptomCheck.report.checkBreathingRateNow", "Check breathing rate now"),
          unit: "/min",
          placeholder: "16",
          helper: t("health.symptomCheck.report.checkBreathingRateReason", "Count breaths for one minute, or use the scan result."),
          signalType: "respiratory_rate",
          parse: (raw) => {
            const value = parseNumber(raw);
            return value == null ? null : { value, display: `${value}/min`, vitals: { respiratoryRate: value } };
          },
        }
      : null,
    /\b(fever|temperature|chills|infection)\b/.test(actionText)
      ? {
          key: "temperature",
          title: t("health.symptomCheck.report.checkTemperatureNow", "Check temperature now"),
          unit: "C",
          placeholder: "37.8",
          helper: t("health.symptomCheck.report.checkTemperatureReason", "Add the thermometer reading."),
          signalType: "temperature_c",
          parse: (raw) => {
            const value = parseNumber(raw);
            return value == null ? null : { value, display: `${value} C`, vitals: { temperatureC: value } };
          },
        }
      : null,
    /\b(pulse|heart rate|heartbeat|afib|irregular)\b/.test(actionText)
      ? {
          key: "pulse",
          title: t("health.symptomCheck.report.checkPulseNow", "Check pulse now"),
          unit: "bpm",
          placeholder: "72",
          helper: t("health.symptomCheck.report.checkPulseReason", "Add pulse from a device or count it manually."),
          signalType: "resting_hr_bpm",
          parse: (raw) => {
            const value = parseNumber(raw);
            return value == null ? null : { value, display: `${value} bpm`, vitals: { pulseBpm: value } };
          },
        }
      : null,
    /\b(pain|ache|headache|back|belly pain|stomach pain|fall|injury|dolor|cabeza|espalda|barriga|caida|golpe)\b/.test(actionText)
      ? {
          key: "pain",
          title: t("health.symptomCheck.report.checkPainNow", "Rate pain now"),
          unit: "/10",
          placeholder: "6",
          helper: t("health.symptomCheck.report.checkPainReason", "Use 0 for no pain and 10 for the worst pain."),
          signalType: "pain_score",
          invalidMessage: t("health.symptomCheck.report.invalidPainReading", "Enter pain from 0 to 10."),
          parse: (raw) => {
            const value = parseRangeNumber(raw, 0, 10);
            return value == null ? null : { value, display: `${value}/10`, vitals: { painScore: value } };
          },
        }
      : null,
    /\b(tired|weak|fatigue|energy|exhausted|dizzy|confused|cansado|debil|energia|agotado|mareo|confusion)\b/.test(actionText)
      ? {
          key: "energy",
          title: t("health.symptomCheck.report.checkEnergyNow", "Rate energy now"),
          unit: "/10",
          placeholder: "4",
          helper: t("health.symptomCheck.report.checkEnergyReason", "Use 1 for very low energy and 10 for normal/high energy."),
          signalType: "energy_level",
          invalidMessage: t("health.symptomCheck.report.invalidEnergyReading", "Enter energy from 1 to 10."),
          parse: (raw) => {
            const value = parseRangeNumber(raw, 1, 10);
            return value == null ? null : { value, display: `${value}/10`, vitals: { energyLevel: value } };
          },
        }
      : null,
  ].filter(Boolean) as RefinementVitalConfig[];
  const latestVitalCandidates = useMemo(() => {
    const entries = vitalActions.map((action) => [action.key, latestCandidateForAction(action, latestVitalReadings)] as const);
    return Object.fromEntries(entries) as Partial<Record<RefinementVitalKey, LatestVitalCandidate | null>>;
  }, [latestVitalReadings, vitalActions]);
  const missingSignalActions = Array.from(
    reportMissingSignals
      .reduce((actions, label) => {
        const key = refinementKeyForMissingSignal(label);
        const action = key ? vitalActions.find((candidate) => candidate.key === key) : undefined;
        if (action && !actions.has(action.key)) {
          actions.set(action.key, { label, action });
        }
        return actions;
      }, new Map<RefinementVitalKey, { label: string; action: RefinementVitalConfig }>())
      .values(),
  );
  const passiveMissingSignals = reportMissingSignals.filter((label) => !refinementKeyForMissingSignal(label));
  const openMissingSignalAction = (action: RefinementVitalConfig) => {
    if (reportDetailsRef.current) reportDetailsRef.current.open = true;
    setReportDetailView("context");
    if (vitalRefinementRef.current) vitalRefinementRef.current.open = true;
    setOpenVitalKey(action.key);
    setVitalInputError(null);
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(`[data-testid="card-report-vital-action-${action.key}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };
  const latestSourceLabel = (source?: string | null) => {
    if (source === "connected_device") return t("health.symptomCheck.report.latestSourceDevice", "device reading");
    if (source === "clinical") return t("health.symptomCheck.report.latestSourceClinical", "clinical reading");
    if (source === "phone_estimate") return t("health.symptomCheck.report.latestSourcePhone", "phone estimate");
    return t("health.symptomCheck.report.latestSourceManual", "saved reading");
  };
  const doctorTellItems = uniqueLines([
    `${t("health.symptomCheck.report.tellMainSymptom", "Main symptom")}: ${summary.chiefComplaint}`,
    summary.symptoms.length ? `${t("health.symptomCheck.report.symptoms", "Symptoms noted")}: ${summary.symptoms.join(", ")}` : "",
    nextStepDisplayText ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${nextStepDisplayText}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Initial Assessment")}: ${summary.triageReasons.join(" ")}` : "",
    summary.vitalsNotes?.length ? `${t("health.symptomCheck.report.vitalsUsed", "Vitals used")}: ${summary.vitalsNotes.join(" ")}` : "",
    summary.scanNotes?.length ? `${t("health.symptomCheck.report.scanNotes", "Scan notes")}: ${summary.scanNotes.join(" ")}` : "",
    summary.profileConsiderations?.length ? `${t("health.symptomCheck.report.profileConsidered", "Profile considered")}: ${summary.profileConsiderations.join(" ")}` : "",
    summary.watchSigns?.length ? `${t("health.symptomCheck.report.watchSigns", "Watch signs")}: ${summary.watchSigns.join(" ")}` : "",
  ]).slice(0, 6);
  const reportRecommendations = compactReportRecommendations(summary.recommendations, { max: 4, level: cfg.level });
  const doctorNote = [
    summary.chiefComplaint,
    summary.symptoms.length ? `${t("health.symptomCheck.report.symptoms", "Symptoms noted")}: ${summary.symptoms.join(", ")}` : "",
    bpm != null ? `${t("health.symptomCheck.scan.heartRate", "Heart Rate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Breathing rate")}: ${respiratoryRate} breaths/min` : "",
    `${urgencyQualifierText}: ${urgencyStatusText}`,
    nextStepDisplayText ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${nextStepDisplayText}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Initial Assessment")}: ${summary.triageReasons.join(" ")}` : "",
    summary.evidenceSummary ? `${t("health.symptomCheck.report.evidenceChecked", "Science-based source check")}: ${summary.evidenceSummary}` : "",
    reportRecommendations.length ? `${t("health.symptomCheck.report.recommendations", "What to do next")}: ${reportRecommendations.join(" ")}` : "",
    summary.watchSigns?.length ? `${t("health.symptomCheck.report.watchSigns", "Watch signs")}: ${summary.watchSigns.join(" ")}` : "",
    summary.profileConsiderations?.length ? `${t("health.symptomCheck.report.profileConsidered", "Profile considered")}: ${summary.profileConsiderations.join(" ")}` : "",
    summary.vitalsNotes?.length ? `${t("health.symptomCheck.report.vitalsUsed", "Vitals used")}: ${summary.vitalsNotes.join(" ")}` : "",
    summary.scanNotes?.length ? `${t("health.symptomCheck.report.scanNotes", "Scan notes")}: ${summary.scanNotes.join(" ")}` : "",
  ].filter(Boolean).join("\n");
  const doctorShareTarget = findDoctorShareTarget(profileContacts, careTeamMembers, t("health.symptomCheck.report.doctorContact", "your doctor"));
  const doctorShareHref = doctorShareTarget
    ? directDoctorShareHref(doctorShareTarget, t("health.symptomCheck.report.shareTitle"), doctorNote)
    : "";
  const openDoctorContactSetup = () => navigate("/onboarding/profile/gp");
  const openDoctorWithContext = () => {
    navigate("/health/doctor", {
      state: {
        autoStartVoice: true,
        latestSymptomReport: doctorNote,
      },
    });
  };
  const gpPhone = profileContacts?.gpPhone?.trim() ?? "";
  const gpEmail = profileContacts?.gpEmail?.trim() ?? "";
  const telHref = gpPhone ? `tel:${gpPhone.replace(/[^\d+]/g, "") || gpPhone}` : "";
  const emailSubject = t("health.symptomCheck.report.actions.emailSubject", "VYVA symptom report");
  const mailtoHref = gpEmail
    ? `mailto:${gpEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(doctorNote)}`
    : "";

  const conciergePrefillMessage = (kind: ConciergePrefillKind, recommendation: string) => {
    const key = kind === "ride"
      ? "health.symptomCheck.report.actions.ridePrefill"
      : kind === "appointment"
        ? "health.symptomCheck.report.actions.appointmentPrefill"
        : "health.symptomCheck.report.actions.quotePrefill";
    const fallback = kind === "ride"
      ? "Please help me book a safe ride for this health recommendation: {{recommendation}}. Report: {{report}}. Ask me to confirm before booking."
      : kind === "appointment"
        ? "Please help me schedule care for this health recommendation: {{recommendation}}. Report: {{report}}. Ask me to confirm before booking."
        : "Please help me request a quote for someone to stay with me or support me at home: {{recommendation}}. Report: {{report}}. Ask me to confirm before requesting anything.";
    return t(key, fallback, { recommendation, report: doctorNote });
  };

  const openConciergePrefill = (kind: ConciergePrefillKind, recommendation: string) => {
    navigate("/concierge", {
      state: {
        conciergePrefill: {
          kind,
          message: conciergePrefillMessage(kind, recommendation),
          source: "symptom_report",
        },
      },
    });
  };

  const openSupportPackage = (packageId: ShoppingSupportPackageId, recommendation: string) => {
    navigate("/concierge/shopping", {
      state: {
        shoppingPrefill: {
          packageId,
          sourceRecommendation: recommendation,
          needText: t(
            "health.symptomCheck.report.actions.hydrationPrefill",
            "Hydration support for this health recommendation: {{recommendation}}. Please suggest easy delivery options such as water, oral rehydration salts, or electrolyte drinks.",
            { recommendation, report: doctorNote },
          ),
          category: "groceries",
          priorities: ["delivery", "simplicity"],
        },
      },
    });
  };

  const reportActionLabels: Record<SymptomRecommendationActionKind, string> = {
    call_emergency: emergencyContact?.telHref
      ? t("health.symptomCheck.report.callEmergencyNumber", "Call {{number}}", { number: emergencyContact.label })
      : t("health.symptomCheck.report.contactEmergencyServices", "Contact emergency services"),
    call_gp: t("health.symptomCheck.report.actions.callGp", "Call GP"),
    email_gp: t("health.symptomCheck.report.actions.emailGp", "Email GP"),
    doctor_help: t("health.symptomCheck.report.actions.doctorHelp", "Doctor help"),
    book_ride: t("health.symptomCheck.report.actions.bookRide", "Find transport"),
    schedule_appointment: t("health.symptomCheck.report.actions.scheduleAppointment", "Appointment"),
    online_order: t("health.symptomCheck.report.actions.onlineOrder", "Get support package"),
    request_quote: t("health.symptomCheck.report.actions.requestQuote", "Request quote"),
  };

  const reportActionIcons: Record<SymptomRecommendationActionKind, LucideIcon> = {
    call_emergency: PhoneCall,
    call_gp: PhoneCall,
    email_gp: Mail,
    doctor_help: Stethoscope,
    book_ride: Car,
    schedule_appointment: Calendar,
    online_order: ShoppingBasket,
    request_quote: ClipboardList,
  };

  const actionsForRecommendation = (recommendation: string): ReportAction[] => {
    const actions = getSymptomRecommendationActionKinds(recommendation, {
      hasEmergencyContact: Boolean(emergencyContact?.telHref),
      hasGpPhone: Boolean(gpPhone),
      hasGpEmail: Boolean(gpEmail),
    }).map((kind): ReportAction => {
      const label = reportActionLabels[kind];
      const base = {
        kind,
        label,
        ariaLabel: t("health.symptomCheck.report.actions.aria", "{{action}} for: {{recommendation}}", {
          action: label,
          recommendation,
        }),
        Icon: reportActionIcons[kind],
      };

      if (kind === "call_emergency") return { ...base, href: emergencyContact?.telHref };
      if (kind === "call_gp") return { ...base, href: telHref };
      if (kind === "email_gp") return { ...base, href: mailtoHref };
      if (kind === "doctor_help") return { ...base, onClick: openDoctorWithContext };
      if (kind === "book_ride") return { ...base, onClick: () => openConciergePrefill("ride", recommendation) };
      if (kind === "schedule_appointment") return { ...base, onClick: () => openConciergePrefill("appointment", recommendation) };
      if (kind === "online_order") return { ...base, onClick: () => openSupportPackage("hydration_support", recommendation) };
      return { ...base, onClick: () => openConciergePrefill("home_care_quote", recommendation) };
    }).filter((action) => action.href || action.onClick);

    const hasDoctorAction = actions.some((action) => action.kind === "doctor_help" || action.kind === "call_gp" || action.kind === "email_gp");
    if (hasDoctorAction && !gpPhone && !gpEmail) {
      actions.push({
        kind: "add_doctor_contact",
        label: t("health.symptomCheck.report.addDoctorContact", "Add doctor contact"),
        ariaLabel: t("health.symptomCheck.report.addDoctorContact", "Add doctor contact"),
        Icon: Users,
        onClick: openDoctorContactSetup,
      });
    }

    return actions;
  };
  const allReasons = uniqueLines([
    ...(summary.triageReasons ?? []),
    ...(summary.profileConsiderations ?? []),
    ...(summary.vitalsNotes ?? []),
    ...(summary.scanNotes ?? []),
  ]);
  const visibleRecommendations = reportRecommendations.slice(0, 4);
  const primaryRecommendations = visibleRecommendations.slice(0, 2);
  const remainingRecommendations = visibleRecommendations.slice(2);
  const visibleWatchSigns = uniqueLines(summary.watchSigns ?? []).slice(0, 2);
  const visiblePatterns = (summary.possiblePatterns ?? []).slice(0, 3);
  const visibleChangeTriggers = uniqueLines(summary.changePlanTriggers ?? summary.watchSigns ?? []).slice(0, 3);
  const contextNotes = uniqueLines([...(summary.profileConsiderations ?? []), ...(summary.vitalsNotes ?? []), ...(summary.scanNotes ?? [])]);
  const reportContextConfidence = summary.contextConfidence;
  const reportConfidenceScore = typeof reportContextConfidence?.score === "number"
    ? Math.min(5, Math.max(1, reportContextConfidence.score))
    : Math.min(5, Math.max(2, 2 + (contextNotes.length ? 1 : 0) + (bpm != null || respiratoryRate != null ? 1 : 0)));
  const reportConfidenceLabel = reportContextConfidence?.label ?? (
    reportConfidenceScore >= 5
      ? t("health.symptomCheck.report.contextConfidenceHigh", "High confidence")
      : reportConfidenceScore >= 4
        ? t("health.symptomCheck.report.contextConfidenceStrong", "Strong confidence")
        : reportConfidenceScore >= 3
          ? t("health.symptomCheck.report.contextConfidenceBuilding", "Building confidence")
          : t("health.symptomCheck.report.contextConfidenceEarly", "Early confidence")
  );
  const reportConfidenceReasons = uniqueLines([
    ...(reportContextConfidence?.reasons ?? []),
    ...(summary.contextBrief ? [summary.contextBrief] : []),
    ...(contextNotes.length ? [t("health.symptomCheck.report.contextProfileUsed", "profile and recent context considered")] : []),
  ]).slice(0, 3);
  const vitalsSummaryItems = uniqueLines([
    bpm != null ? `${t("health.symptomCheck.scan.heartRate", "Heart Rate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Breathing rate")}: ${respiratoryRate} breaths/min` : "",
    ...(summary.vitalsNotes ?? []),
  ]).slice(0, 4);
  const evidenceSourceNames = summary.evidenceSources?.map((source) => source.title).filter(Boolean) ?? [];
  const openReport = () => navigate(reportId ? `/informes/${reportId}` : "/informes");
  const primaryActionKind: SymptomRecommendationActionKind | null = isEmergency
    ? "call_emergency"
    : cfg.level === "monitor"
      ? null
      : telHref
        ? "call_gp"
        : mailtoHref
          ? "email_gp"
          : "doctor_help";
  const primaryAction = isEmergency
    ? {
        label: emergencyCallLabel,
        Icon: PhoneCall,
        onClick: () => {
          if (emergencyContact?.telHref) {
            window.location.href = emergencyContact.telHref;
          }
        },
        className: "bg-[#DC2626] text-white shadow-[0_12px_26px_rgba(220,38,38,0.24)] disabled:opacity-70",
        testId: "button-report-emergency",
      }
    : cfg.level === "monitor"
      ? {
          label: t("health.symptomCheck.report.nextStepVitals", "Check vitals"),
          Icon: Activity,
          onClick: () => navigate("/health/vitals"),
          className: "bg-[#6B21A8] text-white shadow-[0_12px_26px_rgba(107,33,168,0.20)]",
          testId: "button-report-vitals",
        }
      : {
          label: telHref
            ? t("health.symptomCheck.report.actions.callGp", "Call GP")
            : mailtoHref
              ? t("health.symptomCheck.report.actions.emailGp", "Email GP")
              : t("health.symptomCheck.report.callDoctor", "Talk to doctor"),
          Icon: telHref ? PhoneCall : mailtoHref ? Mail : Stethoscope,
          onClick: () => {
            if (telHref) {
              window.location.href = telHref;
              return;
            }
            if (mailtoHref) {
              window.location.href = mailtoHref;
              return;
            }
            openDoctorWithContext();
          },
          className: "bg-[#6B21A8] text-white shadow-[0_12px_26px_rgba(107,33,168,0.20)]",
          testId: telHref ? "button-report-call-gp" : mailtoHref ? "button-report-email-gp" : "button-report-doctor",
        };
  const savedRecipientLabels = uniqueLines(savedReport?.sent_to ?? []);
  const staffReviewRequested = Boolean(savedReport?.staff_review_requested);
  const reportStatusText = reportSaveState === "saving"
    ? t("health.symptomCheck.report.savingReport", "Saving this report to My Reports...")
    : reportSaveState === "error"
      ? t("health.symptomCheck.report.reportSaveFailed", "This report could not be saved automatically. You can still share it now.")
      : reportId
        ? t("health.symptomCheck.report.reportSaved", "Saved in My Reports")
        : t("health.symptomCheck.report.reportNotSavedYet", "Not saved yet");
  const handoffTitle = staffReviewRequested
    ? t("health.symptomCheck.report.staffReviewTitle", "Staff review requested")
    : savedRecipientLabels.length
      ? t("health.symptomCheck.report.handoffSentTitle", "Care handoff started")
      : t("health.symptomCheck.report.handoffNoneTitle", "No handoff sent");
  const handoffBody = staffReviewRequested
    ? savedRecipientLabels.length
      ? t("health.symptomCheck.report.staffReviewWithContacts", "The team has this report for review. It was also shared with {{contacts}}.", {
          contacts: savedRecipientLabels.join(", "),
        })
      : t("health.symptomCheck.report.staffReviewNoContacts", "The team has this report for review. Add a doctor or caregiver contact to share future reports automatically.")
    : savedRecipientLabels.length
      ? t("health.symptomCheck.report.handoffSentBody", "This report was shared with {{contacts}} so they can help with the next step.", {
          contacts: savedRecipientLabels.join(", "),
        })
      : t("health.symptomCheck.report.handoffReadyBody", "No caregiver or doctor was notified automatically. You can share this report with someone you trust.");
  const handoffIsActive = staffReviewRequested || savedRecipientLabels.length > 0;
  const planSteps = visibleRecommendations.length
    ? visibleRecommendations.slice(0, 3)
    : [recommendationExplanation];
  const supportActions = Array.from(
    visibleRecommendations
      .flatMap((recommendation) => actionsForRecommendation(recommendation))
      .reduce((map, action) => {
        if (action.kind === primaryActionKind) return map;
        if (!map.has(action.kind)) map.set(action.kind, action);
        return map;
      }, new Map<ReportAction["kind"], ReportAction>())
      .values(),
  ).slice(0, 3);
  const simpleReportRows = [
    {
      label: t("health.symptomCheck.report.simpleWhatChanged", "Situation"),
      value: summary.chiefComplaint || summary.symptoms[0] || t("health.symptomCheck.report.notRecorded", "Not recorded"),
    },
    {
      label: t("health.symptomCheck.report.simpleHelpNeeded", "Help needed"),
      value: planSteps[0] ?? nextStepDisplayText,
    },
    {
      label: t("health.symptomCheck.report.simpleEscalateIf", "Escalate if"),
      value: visibleWatchSigns.length
        ? visibleWatchSigns.join(" ")
        : t("health.symptomCheck.report.noWatchSigns", "If symptoms worsen or feel urgent, seek medical help."),
    },
  ];

  const handleRefineVital = async (config: RefinementVitalConfig, rawValue: string) => {
    if (!onRefineVital) return;
    const parsed = config.parse(rawValue);
    if (!parsed) {
      setVitalInputError(config.invalidMessage ?? t("health.symptomCheck.report.enterValidReading", "Enter a valid reading first."));
      return;
    }
    setVitalInputError(null);
    await onRefineVital(config, rawValue);
  };

  const shareText = [
    t("health.symptomCheck.report.shareTitle"),
    "",
    `${t("health.symptomCheck.report.chiefComplaint")}: ${summary.chiefComplaint}`,
    bpm != null ? `${t("health.symptomCheck.scan.heartRate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Breathing rate")}: ${respiratoryRate} breaths/min` : "",
    durationText ? `${t("health.symptomCheck.report.timeTaken", "Time taken")}: ${durationText}` : "",
    "",
    `${urgencyQualifierText}: ${urgencyStatusText}`,
    nextStepDisplayText ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${nextStepDisplayText}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Initial Assessment")}: ${summary.triageReasons.join(" ")}` : "",
    summary.interpretation ? `${t("health.symptomCheck.report.whatAnswersMean", "What your answers mean")}: ${summary.interpretation}` : "",
    visiblePatterns.length ? `${t("health.symptomCheck.report.possibleSituations", "Possible situations")}: ${visiblePatterns.map((pattern) => `${pattern.label} — ${pattern.explanation}`).join(" ")}` : "",
    summary.uncertainty?.length ? `${t("health.symptomCheck.report.whatWeCannotTell", "What we cannot tell")}: ${summary.uncertainty.join(" ")}` : "",
    summary.reassessmentWindow ? `${t("health.symptomCheck.report.whenToReassess", "When to reassess")}: ${summary.reassessmentWindow}` : "",
    visibleChangeTriggers.length ? `${t("health.symptomCheck.report.changePlanIf", "Change the plan if")}: ${visibleChangeTriggers.join(" ")}` : "",
    summary.evidenceSummary ? `${t("health.symptomCheck.report.evidenceChecked", "Science-based source check")}: ${summary.evidenceSummary}` : "",
    "",
    t("health.symptomCheck.report.recommendations") + ":",
    ...reportRecommendations.map((r, i) => `${i + 1}. ${r}`),
    "",
    t("health.symptomCheck.report.disclaimer"),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("health.symptomCheck.report.shareTitle"), text: shareText });
        return;
      } catch {
        /* user cancelled or not supported */
      }
    }
    const copied = await navigator.clipboard.writeText(shareText).then(() => true).catch(() => false);
    if (copied) {
      toast({
        title: t("health.symptomCheck.report.copiedToast"),
        description: t("health.symptomCheck.report.copiedToastDesc"),
      });
    }
  };
  const renderRecommendationItem = (recommendation: string, index: number) => {
    const actions = actionsForRecommendation(recommendation);
    return (
      <li key={`${recommendation}-${index}`} className="rounded-[20px] border border-[#F1E8DE] bg-[#FFFCF8] p-3">
        <div className="flex items-start gap-3 font-body text-[16px] font-bold leading-snug text-vyva-text-1">
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple text-white">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 pt-0.5">{recommendation}</span>
        </div>
        {actions.length ? (
          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2" data-testid={`report-actions-${index}`}>
            {actions.map((action) => {
              const Icon = action.Icon;
              const className = `vyva-tap inline-flex min-h-[50px] min-w-0 items-center justify-center gap-2 rounded-[16px] border px-4 py-3 text-center font-body text-[15px] font-semibold leading-[1.4] tracking-[-0.005em] shadow-sm ${isDark ? "border-white/[0.14] bg-[#2D2038] text-[#D8B4FE]" : "border-[#E7DCF8] bg-white text-vyva-purple"}`;
              if (action.href) {
                return (
                  <a
                    key={action.kind}
                    href={action.href}
                    aria-label={action.ariaLabel}
                    data-testid={`button-report-action-${index}-${action.kind}`}
                    className={className}
                  >
                    <Icon size={19} className="flex-shrink-0" />
                    <span className="min-w-0 break-words">{action.label}</span>
                  </a>
                );
              }
              return (
                <button
                  key={action.kind}
                  type="button"
                  onClick={action.onClick}
                  aria-label={action.ariaLabel}
                  data-testid={`button-report-action-${index}-${action.kind}`}
                  className={className}
                >
                  <Icon size={19} className="flex-shrink-0" />
                  <span className="min-w-0 break-words">{action.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </li>
    );
  };
  const PrimaryActionIcon = primaryAction.Icon;

  return (
    <div className="symptom-canonical-report flex min-h-0 flex-1 flex-col overflow-y-auto" data-testid="symptom-check-report">
      <div ref={reportTopRef} />
      <section
        data-testid="card-report-overview"
        data-approved-frame="summary.share_or_save"
        className={`mx-auto w-[calc(100%_-_28px)] max-w-[330px] overflow-hidden rounded-[30px] border px-[18px] pb-[18px] pt-6 sm:max-w-[760px] sm:px-[22px] sm:pb-[22px] sm:pt-7 ${
          isDark
            ? "border-white/[0.14] bg-[#2B2035] text-[#FFF8FF] shadow-[0_22px_48px_rgba(0,0,0,0.22)]"
            : "border-[#DFD3E7] bg-[#FBF6FF] text-[#241238] shadow-[0_22px_48px_rgba(87,54,99,0.12)]"
        }`}
      >
        <h1 className="text-center font-body text-[28px] font-extrabold leading-tight tracking-[-0.035em] text-vyva-text-1 sm:text-[31px]">
          {t("health.symptomCheck.report.summaryTitle", "Your summary")}
        </h1>
        <section
          data-testid="card-report-answer"
          data-theme-surface={isDark ? "canonical-dark" : "canonical-light"}
          className={`relative mt-5 overflow-hidden rounded-[18px] border p-4 sm:p-[18px] ${isDark ? "text-white shadow-[0_8px_22px_rgba(0,0,0,0.12)]" : "text-vyva-text-1 shadow-[0_8px_22px_rgba(63,45,35,0.06)]"} ${isEmergency ? "motion-safe:animate-pulse" : ""}`}
          style={{
            background: isDark ? darkHeroVisual.background : lightHeroVisual.background,
            borderColor: isDark ? darkHeroVisual.border : lightHeroVisual.border,
          }}
        >
        <div className="relative flex items-start gap-4">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] p-3 sm:h-[52px] sm:w-[52px]"
            style={{ background: isDark ? darkHeroVisual.iconBg : lightHeroVisual.iconBg }}
          >
            <VyvaIcon icon={UrgencyIcon} accent={urgencyIconAccent} size={25} tone={isDark && isEmergency ? "inverse" : "brand"} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="font-body text-[11px] font-extrabold uppercase tracking-[0.12em] sm:text-[12px]"
              style={{ color: isDark ? darkHeroVisual.accent : lightHeroVisual.accent }}
            >
              {urgencyQualifierText}
            </p>
            <p className={`mt-1 font-body text-[22px] font-extrabold leading-tight tracking-[-0.025em] sm:text-[24px] ${isDark ? "text-white" : "text-vyva-text-1"}`}>
              {urgencyStatusText}
            </p>
          </div>
        </div>

        <p className={`relative mt-3 border-t pt-3 font-body text-[17px] font-black leading-tight sm:text-[19px] ${isDark ? "border-white/10 text-white" : "border-black/[0.07] text-vyva-text-1"}`}>
          {summary.chiefComplaint || t("health.symptomCheck.report.checkComplete", "Your check is complete")}
        </p>
        <p className={`relative mt-1.5 hidden max-w-[620px] font-body text-[14px] font-semibold leading-relaxed sm:block ${isDark ? "text-white/78" : "text-vyva-text-2"}`}>
          {t("health.symptomCheck.report.resultSummary", "VYVA has turned your answers into a simple plan below.")}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {bpm != null ? (
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ background: isDark ? cfg.pillBg : lightHeroVisual.pillBg }}
            >
              <Heart size={13} style={{ color: isDark ? "white" : lightHeroVisual.accent }} />
              <span className={`font-body text-[13px] font-semibold ${isDark ? "text-white" : "text-vyva-text-1"}`}>
                {bpm} bpm
              </span>
            </span>
          ) : null}
          {respiratoryRate != null ? (
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ background: isDark ? cfg.pillBg : lightHeroVisual.pillBg }}
            >
              <Activity size={13} style={{ color: isDark ? "white" : lightHeroVisual.accent }} />
              <span className={`font-body text-[13px] font-semibold ${isDark ? "text-white" : "text-vyva-text-1"}`}>
                {respiratoryRate} breaths/min
              </span>
            </span>
          ) : null}
        </div>
        </section>

        <section className={`mt-3 overflow-hidden rounded-[20px] border ${isDark ? "border-white/[0.12] bg-[#352842]" : "border-[#E8DED4] bg-white"}`} data-testid="card-report-do-now">
          <div className={`border-b p-3 sm:p-4 ${isDark ? "border-white/[0.12] bg-[#352842]" : "border-[#EFE5DA] bg-[#FFFCF8]"}`}>
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
              {t("health.symptomCheck.report.whatToDoNow", "What to do now")}
            </p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-body text-[20px] font-black leading-tight text-vyva-text-1 sm:text-[24px]">
                  {nextStepDisplayText}
                </p>
                <p className="mt-1.5 font-body text-[14px] font-bold leading-snug text-vyva-text-2 sm:mt-2 sm:text-[15px] sm:leading-relaxed">
                  {recommendationExplanation}
                </p>
                {summary.reassessmentWindow ? (
                  <p className={`mt-2 rounded-[12px] px-3 py-2 font-body text-[13px] font-black leading-snug ${isDark ? "bg-[#45325E] text-[#E9D5FF]" : "bg-[#F5F3FF] text-vyva-purple"}`} data-testid="report-reassessment-window">
                    {t("health.symptomCheck.report.whenToReassess", "When to reassess")}: {summary.reassessmentWindow}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={isEmergency && !emergencyContact?.telHref}
                data-testid={primaryAction.testId}
                className={`vyva-tap inline-flex min-h-[50px] flex-shrink-0 items-center justify-center gap-2 rounded-[16px] px-4 text-center font-body text-[15px] font-black leading-tight sm:min-h-[52px] sm:text-[16px] md:px-5 ${primaryAction.className}`}
              >
                <PrimaryActionIcon size={19} className="flex-shrink-0" />
                <span>{primaryAction.label}</span>
              </button>
            </div>
          </div>
          <details className={`group border-t ${isDark ? "border-white/[0.12] bg-[#2D2038]" : "border-[#EFE5DA] bg-white"}`} data-testid="card-report-plan-details">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 sm:px-4">
              <span className="flex min-w-0 items-center gap-3">
                <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] ${isDark ? "bg-[#45325E]" : "bg-[#F5F3FF]"}`}>
                  <VyvaIcon icon={ClipboardList} accent="step" size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block font-body text-[15px] font-black text-vyva-text-1">
                    {t("health.symptomCheck.report.yourStepPlan", "Your {{count}}-step plan", { count: planSteps.length })}
                  </span>
                  <span className="mt-0.5 block font-body text-[12px] font-bold text-vyva-text-3">
                    {t("health.symptomCheck.report.openPlanDetails", "Open for the practical details")}
                  </span>
                </span>
              </span>
              <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-90" />
            </summary>
            <div className="grid gap-3 border-t border-[#EFE5DA] p-3 sm:gap-4 sm:p-4">
              <ol className="grid gap-2 sm:gap-3">
              {planSteps.map((recommendation, index) => (
                <li key={`${recommendation}-${index}`} className="flex items-start gap-3 rounded-[16px] border border-[#F1E8DE] bg-[#FFFCF8] p-2.5 sm:rounded-[20px] sm:p-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple font-body text-[12px] font-black text-white sm:h-8 sm:w-8 sm:text-[13px]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 pt-0.5 font-body text-[14px] font-bold leading-snug text-vyva-text-1 sm:text-[16px]">
                    {recommendation}
                  </span>
                </li>
              ))}
              </ol>
              {supportActions.length ? (
              <div className={`rounded-[22px] border p-3 ${isDark ? "border-white/[0.14] bg-[#3B294C]" : "border-[#E7DCF8] bg-[#F8F5FF]"}`} data-testid="report-support-actions">
                <p className={`font-body text-[12px] font-bold uppercase tracking-[0.1em] ${isDark ? "text-[#D8B4FE]" : "text-vyva-purple"}`}>
                  {t("health.symptomCheck.report.supportOptions", "Useful support")}
                </p>
                <div className="mt-3 grid min-w-0 gap-2 lg:grid-cols-3">
                  {supportActions.map((action) => {
                    const Icon = action.Icon;
                    const className = `vyva-tap inline-flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 rounded-[16px] border px-3 py-3 text-center font-body text-[14px] font-semibold leading-[1.4] tracking-[-0.005em] shadow-sm ${isDark ? "border-white/[0.14] bg-[#2D2038] text-[#D8B4FE]" : "border-[#E7DCF8] bg-white text-vyva-purple"}`;
                    if (action.href) {
                      return (
                        <a key={action.kind} href={action.href} aria-label={action.ariaLabel} data-testid={`button-report-support-${action.kind}`} className={className}>
                          <Icon size={18} className="flex-shrink-0" />
                          <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{action.label}</span>
                        </a>
                      );
                    }
                    return (
                      <button key={action.kind} type="button" onClick={action.onClick} aria-label={action.ariaLabel} data-testid={`button-report-support-${action.kind}`} className={className}>
                        <Icon size={18} className="flex-shrink-0" />
                        <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              ) : null}
            </div>
          </details>
        </section>

        {summary.interpretation ? (
          <section className={`mt-3 rounded-[20px] border p-3 sm:p-4 ${isDark ? "border-white/[0.12] bg-[#352842]" : "border-[#E7DCF8] bg-[#F8F5FF]"}`} data-testid="card-report-interpretation">
            <div className="flex items-start gap-3">
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] ${isDark ? "bg-[#45325E]" : "bg-white"}`}>
                <VyvaIcon icon={Brain} accent="step" size={18} />
              </span>
              <div className="min-w-0">
                <p className={`font-body text-[11px] font-extrabold uppercase tracking-[0.1em] ${isDark ? "text-[#D8B4FE]" : "text-vyva-purple"}`}>
                  {t("health.symptomCheck.report.whatAnswersMean", "What your answers mean")}
                </p>
                <p className="mt-1 font-body text-[14px] font-bold leading-relaxed text-vyva-text-2 sm:text-[15px]">{summary.interpretation}</p>
                {summary.uncertainty?.length ? (
                  <div className={`mt-2 border-t pt-2 ${isDark ? "border-white/[0.1]" : "border-[#E7DCF8]"}`} data-testid="report-uncertainty">
                    <p className="font-body text-[11px] font-extrabold uppercase tracking-[0.08em] text-vyva-text-3">{t("health.symptomCheck.report.whatWeCannotTell", "What we cannot tell")}</p>
                    <p className="mt-1 font-body text-[12px] font-semibold leading-relaxed text-vyva-text-2">{summary.uncertainty.join(" ")}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {!isEmergency && visiblePatterns.length ? (
          <section className={`mt-3 rounded-[20px] border p-3 sm:p-4 ${isDark ? "border-white/[0.12] bg-[#2D2038]" : "border-[#E8DED4] bg-white"}`} data-testid="card-report-possible-patterns">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">{t("health.symptomCheck.report.possibleSituations", "Possible situations")}</p>
            <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">{t("health.symptomCheck.report.notDiagnosis", "These are patterns your answers can sometimes fit, not a diagnosis.")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {visiblePatterns.map((pattern) => (
                <article key={pattern.id} className={`rounded-[16px] border p-3 ${isDark ? "border-white/[0.1] bg-[#352842]" : "border-[#EEE5DC] bg-[#FFFCF8]"}`}>
                  <h2 className="font-body text-[15px] font-black leading-snug text-vyva-text-1">{pattern.label}</h2>
                  <p className="mt-1 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">{pattern.explanation}</p>
                  {pattern.supportingAnswers.length ? <p className="mt-2 font-body text-[12px] font-bold leading-snug text-vyva-text-3">{t("health.symptomCheck.report.basedOn", "Based on")}: {pattern.supportingAnswers.join("; ")}</p> : null}
                  {pattern.clarifyingSigns.length ? <p className={`mt-2 border-t pt-2 font-body text-[12px] font-bold leading-snug ${isDark ? "border-white/[0.1] text-[#D8CDE4]" : "border-[#EEE5DC] text-vyva-text-2"}`}>{t("health.symptomCheck.report.helpNarrow", "What would help narrow it")}: {pattern.clarifyingSigns.join("; ")}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>

      <div className="mx-auto mt-3 flex w-[calc(100%_-_28px)] max-w-[330px] flex-col gap-3 pb-[152px] sm:max-w-[760px] sm:pb-[168px]">

        {!isEmergency && visibleChangeTriggers.length ? (
          <div className={`flex items-start gap-3 rounded-[20px] border px-3 py-3 ${isDark ? "border-[#6A4B25] bg-[#2B2118] text-[#F7E4BE] shadow-[0_10px_24px_rgba(0,0,0,0.18)]" : "border-[#FED7AA] bg-[#FFF7ED] text-[#9A3412] shadow-[0_8px_20px_rgba(154,52,18,0.07)]"}`} data-testid="card-report-watch-highlight">
            <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] ${isDark ? "bg-[#3B2B19] text-[#F8AE1B]" : "bg-[#FFEDD5] text-[#C2410C]"}`}>
              <AlertTriangle size={17} />
            </span>
            <span className="min-w-0">
              <span className={`block font-body text-[11px] font-black uppercase tracking-[0.09em] ${isDark ? "text-[#F8AE1B]" : "text-[#C2410C]"}`}>
                {t("health.symptomCheck.report.changePlanIf", "Change the plan if")}
              </span>
              <span className={`mt-0.5 block font-body text-[14px] font-black leading-snug ${isDark ? "text-[#F7E4BE]" : "text-[#9A3412]"}`}>
                {visibleChangeTriggers.join(" ")}
              </span>
            </span>
          </div>
        ) : null}

        <details
          ref={reportDetailsRef}
          open={isEmergency || undefined}
          className={`group/result-details min-w-0 overflow-hidden rounded-[22px] border p-3 ${isDark ? "border-[#483650] bg-[#24182E] shadow-[0_14px_30px_rgba(0,0,0,0.18)]" : "border-[#E8DED4] bg-white shadow-[0_8px_22px_rgba(63,45,35,0.05)]"}`}
          data-testid="report-result-details"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] ${isDark ? "bg-[#45325E]" : "bg-[#F5F3FF]"}`}>
                <VyvaIcon icon={ClipboardList} accent="step" size={19} />
              </span>
              <span className="min-w-0">
                <span className="block font-body text-[16px] font-black text-vyva-text-1">
                  {t("health.symptomCheck.report.resultDetails", "Result details")}
                </span>
                <span className="mt-0.5 block truncate font-body text-[12px] font-bold text-vyva-text-3">
                  {t("health.symptomCheck.report.resultDetailsSubCompact", "Why, context & sharing")}
                </span>
              </span>
            </span>
            <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 text-vyva-purple transition-transform group-open/result-details:rotate-90" />
          </summary>
          <div className="mt-3 grid min-w-0 max-w-full gap-3 border-t border-[#EADFD5] pt-3">

            <div className="grid min-w-0 max-w-full grid-cols-[repeat(2,minmax(0,1fr))] gap-2" data-testid="report-detail-hub">
              {([
                { id: "why", label: t("health.symptomCheck.report.whyAndSafety", "Why & safety"), meta: visibleWatchSigns.length ? t("health.symptomCheck.report.watchCount", "{{count}} watch signs", { count: visibleWatchSigns.length }) : t("health.symptomCheck.report.reasoning", "Reasoning"), Icon: ShieldCheck },
                { id: "context", label: t("health.symptomCheck.report.contextAndReadings", "Context"), meta: `${reportConfidenceScore}/5 ${t("health.symptomCheck.report.confidenceShort", "confidence")}`, Icon: Activity },
                { id: "share", label: t("health.symptomCheck.report.shareAndCare", "Share & care"), meta: reportStatusText, Icon: Share2 },
                { id: "full", label: t("health.symptomCheck.report.fullReport", "Full report"), meta: t("health.symptomCheck.report.allDetails", "All details"), Icon: FileText },
              ] as const).map(({ id, label, meta, Icon }) => {
                const active = reportDetailView === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setReportDetailView((current) => current === id ? null : id)}
                    aria-pressed={active}
                    data-testid={`button-report-detail-${id}`}
                    className={`vyva-tap flex min-h-[72px] min-w-0 flex-col items-start justify-center gap-1 rounded-[16px] border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-[#C4B5FD] bg-[#F5F3FF] text-vyva-purple"
                        : "border-[#EEE5DC] bg-[#FFFCF8] text-vyva-text-1"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2 font-body text-[13px] font-black leading-tight">
                      <Icon size={16} className="flex-shrink-0" />
                      <span className="min-w-0 whitespace-normal">{label}</span>
                    </span>
                    <span className="line-clamp-1 font-body text-[10px] font-bold text-vyva-text-3">{meta}</span>
                  </button>
                );
              })}
            </div>

        <div className={reportDetailView === "context" ? "grid min-w-0 max-w-full gap-3 overflow-hidden" : "hidden"}>
        <details className="group rounded-[22px] border border-[#BFDBFE] bg-[#EFF6FF] p-3 text-blue-950 shadow-[0_8px_22px_rgba(29,78,216,0.07)]" data-testid="card-report-context-confidence">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <span
                role="meter"
                aria-label={t("health.symptomCheck.report.contextConfidence", "Context confidence")}
                aria-valuemin={1}
                aria-valuemax={5}
                aria-valuenow={reportConfidenceScore}
                className="relative grid h-12 w-12 flex-shrink-0 place-items-center rounded-full p-1 shadow-[0_8px_18px_rgba(29,78,216,0.12)]"
                style={{ background: `conic-gradient(#2563EB 0 ${reportConfidenceScore * 20}%, #DBEAFE ${reportConfidenceScore * 20}% 100%)` }}
              >
                <span className="grid h-full w-full place-items-center rounded-full bg-white font-body text-[13px] font-black text-[#1D4ED8]">
                  {reportConfidenceScore}/5
                </span>
              </span>
              <span className="min-w-0">
                <span className="block font-body text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#1D4ED8]">
                  {t("health.symptomCheck.report.contextConfidence", "Context confidence")}
                </span>
                <span className="mt-0.5 block truncate font-body text-[16px] font-black text-vyva-text-1">
                  {reportConfidenceLabel}
                </span>
              </span>
            </span>
            <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 text-blue-700 transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-3 border-t border-[#BFDBFE] pt-3">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div
              role="meter"
              aria-label={t("health.symptomCheck.report.contextConfidence", "Context confidence")}
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={reportConfidenceScore}
              className="relative mx-auto hidden h-[92px] w-[92px] flex-shrink-0 place-items-center rounded-full p-2 shadow-[0_14px_28px_rgba(29,78,216,0.14)] lg:grid"
              style={{ background: `conic-gradient(#2563EB 0 ${reportConfidenceScore * 20}%, #DBEAFE ${reportConfidenceScore * 20}% 100%)` }}
            >
              <span className="grid h-full w-full place-items-center rounded-full bg-white text-center">
                <span className="font-body text-[23px] font-black leading-none text-[#1D4ED8]">
                  {reportConfidenceScore}/5
                </span>
                <span className="font-body text-[9px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                  {t("health.symptomCheck.report.contextSignalShort", "Signals")}
                </span>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#1D4ED8]">
                {t("health.symptomCheck.report.contextConfidence", "Context confidence")}
              </p>
              <p className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1">
                {reportConfidenceLabel}
              </p>
              <p className="mt-2 font-body text-[15px] font-bold leading-relaxed text-blue-900">
                {reportConfidenceReasons.length
                  ? t("health.symptomCheck.report.contextConfidenceReason", "This check used {{items}}.", { items: reportConfidenceReasons.join(", ") })
                  : t("health.symptomCheck.report.contextConfidenceGeneric", "This check used the answers from this session and any available profile context.")}
              </p>
              {reportMissingSignals.length ? (
                <div className="mt-3 rounded-[18px] border border-[#BFDBFE] bg-white px-3 py-3">
                  <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                    {t("health.symptomCheck.report.missingSignals", "Add what is missing")}
                  </p>
                  <p className="mt-1 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
                    {reportMissingSignals.join(", ")}
                  </p>
                  {missingSignalActions.length ? (
                    <div className="mt-3 grid min-w-0 gap-2 lg:grid-cols-2" data-testid="report-missing-signal-actions">
                      {missingSignalActions.map(({ action }) => (
                        <button
                          key={action.key}
                          type="button"
                          onClick={() => openMissingSignalAction(action)}
                          data-testid={`button-report-missing-signal-${action.key}`}
                          className="vyva-tap flex min-h-[54px] w-full min-w-0 items-center justify-between gap-3 rounded-[18px] bg-[#1D4ED8] px-3 text-left font-body text-[14px] font-black leading-tight text-white shadow-[0_10px_20px_rgba(29,78,216,0.18)]"
                        >
                          <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{action.title}</span>
                          <ArrowRight className="h-4 w-4 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {passiveMissingSignals.length ? (
                    <p className="mt-2 font-body text-[13px] font-bold leading-snug text-vyva-text-3">
                      {t("health.symptomCheck.report.passiveMissingSignals", "Also useful for care review: {{items}}", {
                        items: passiveMissingSignals.join(", "),
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          </div>
        </details>
        </div>

        <div className={reportDetailView === "share" ? "grid min-w-0 max-w-full gap-3 overflow-hidden" : "hidden"}>
        <details className="group rounded-[22px] border border-[#D9F0E3] bg-[#F0FDF4] p-3 text-[#064E3B] shadow-[0_8px_22px_rgba(4,120,87,0.08)]" data-testid="card-report-handoff">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-[#047857] shadow-sm">
              {staffReviewRequested ? <ShieldCheck size={20} /> : savedRecipientLabels.length ? <Send size={20} /> : <Users size={20} />}
              </span>
              <span className="min-w-0">
                <span className="block font-body text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#047857]">
                {t("health.symptomCheck.report.handoffLabel", "Care handoff")}
                </span>
                <span className="mt-0.5 block truncate font-body text-[16px] font-black text-[#052E25]">
                {handoffTitle}
                </span>
              </span>
            </span>
            <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 text-[#047857] transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-3 border-t border-[#BBF7D0] pt-3">
              <p className="mt-2 font-body text-[15px] font-bold leading-relaxed text-[#065F46]">
                {handoffBody}
              </p>
              <p className="mt-3 inline-flex rounded-full border border-[#BBF7D0] bg-white px-3 py-1.5 font-body text-[13px] font-black text-[#047857]">
                {reportStatusText}
              </p>
              {summary.clinicalHandoff ? (
                <div className="mt-3 rounded-[16px] border border-[#BBF7D0] bg-white p-3" data-testid="report-clinical-handoff">
                  <p className="font-body text-[11px] font-extrabold uppercase tracking-[0.09em] text-[#047857]">
                    {t("health.symptomCheck.report.clinicianBrief", "Clinician brief")}
                  </p>
                  <p className="mt-1 font-body text-[14px] font-black leading-snug text-[#052E25]">{summary.clinicalHandoff.summary}</p>
                  {summary.clinicalHandoff.keyPoints.length ? (
                    <ul className="mt-2 grid gap-1">
                      {summary.clinicalHandoff.keyPoints.map((point) => <li key={point} className="font-body text-[13px] font-semibold leading-snug text-[#065F46]">• {point}</li>)}
                    </ul>
                  ) : null}
                  {summary.clinicalHandoff.questions.length ? (
                    <p className="mt-2 border-t border-[#D9F0E3] pt-2 font-body text-[13px] font-bold leading-snug text-[#065F46]">
                      {summary.clinicalHandoff.questions.join(" ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
          </div>
        </details>

        <details className="group rounded-[22px] border border-[#E8DED4] bg-white p-3 shadow-[0_8px_22px_rgba(63,45,35,0.05)]" data-testid="card-report-simple-summary">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
                <FileText size={18} />
              </span>
              <span className="min-w-0">
                <span className="block font-body text-[11px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                {t("health.symptomCheck.report.simpleReport", "Simple report")}
                </span>
                <span className="mt-0.5 block truncate font-body text-[16px] font-black text-vyva-text-1">
                {t("health.symptomCheck.report.simpleReportTitle", "For someone helping you")}
                </span>
              </span>
            </span>
            <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-3 border-t border-[#EADFD5] pt-3">
            <button
              type="button"
              onClick={handleShare}
              data-testid="button-report-share-simple"
              className="vyva-tap inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] border border-[#E7DCF8] bg-[#F5F3FF] px-4 text-center font-body text-[15px] font-black text-vyva-purple lg:w-auto"
            >
              <Share2 size={17} />
              {t("health.symptomCheck.report.shareReportAria", "Share report")}
            </button>
          <dl className="mt-4 grid gap-3">
            {simpleReportRows.map((row) => (
              <div key={row.label} className="rounded-[18px] border border-[#F1E8DE] bg-[#FFFCF8] p-3">
                <dt className="font-body text-[11px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                  {row.label}
                </dt>
                <dd className="mt-1 font-body text-[16px] font-black leading-snug text-vyva-text-1">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          </div>
        </details>
        </div>

        <div className={reportDetailView === "why" ? "grid min-w-0 max-w-full gap-3 overflow-hidden" : "hidden"}>
        {isEmergency && visibleWatchSigns.length ? (
          <section className="overflow-hidden rounded-[28px] border-2 border-[#FDBA74] bg-[#FFF7ED] text-[#9A3412] shadow-[0_18px_42px_rgba(154,52,18,0.12)]" data-testid="card-report-watch">
            <div className="flex items-center gap-3 border-b border-[#FED7AA] bg-[#FFEDD5] px-4 py-3">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#C2410C] text-white shadow-[0_10px_22px_rgba(194,65,12,0.22)]">
                <AlertTriangle size={25} strokeWidth={2.4} />
              </span>
              <p className="font-body text-[13px] font-black uppercase tracking-[0.11em]">
                {t("health.symptomCheck.report.watchSigns", "Watch for")}
              </p>
            </div>
            <ul className="grid gap-3 p-4">
              {visibleWatchSigns.map((sign, index) => (
                <li key={index} className="flex items-start gap-3 rounded-[20px] border border-[#FED7AA] bg-white px-4 py-3 shadow-[0_8px_18px_rgba(154,52,18,0.08)]">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#FFF7ED] text-[#C2410C] ring-2 ring-[#FDBA74]">
                    <AlertTriangle size={17} strokeWidth={2.5} />
                  </span>
                  <span className="font-body text-[15px] font-black leading-snug text-[#9A3412] sm:text-[17px]">
                    {sign}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!isEmergency && visibleWatchSigns.length ? (
          <details className="group rounded-[22px] border border-[#FED7AA] bg-[#FFF7ED] p-4 text-[#9A3412] shadow-[0_8px_22px_rgba(154,52,18,0.08)]" data-testid="card-report-watch">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#FFEDD5] text-[#C2410C]">
                  <AlertTriangle size={18} />
                </span>
                <span className="font-body text-[15px] font-black text-[#9A3412]">
                  {t("health.symptomCheck.report.whatToWatchFor", "What to watch for")}
                </span>
              </span>
              <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 text-[#C2410C] transition-transform group-open:rotate-90" />
            </summary>
            <ul className="mt-3 grid gap-2 border-t border-[#FED7AA] pt-3">
              {visibleWatchSigns.map((sign, index) => (
                <li key={index} className="rounded-[16px] bg-white px-4 py-3 font-body text-[15px] font-black leading-snug text-[#9A3412] shadow-sm">
                  {sign}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {allReasons.length ? (
          <details className="group rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]" data-testid="card-report-why">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
                  <Stethoscope size={18} />
                </span>
                <span className="font-body text-[15px] font-black text-vyva-text-1">
                  {t("health.symptomCheck.report.whyThisAnswer", "Why this answer")}
                </span>
              </span>
              <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-90" />
            </summary>
            <ul className="mt-3 grid gap-2 border-t border-[#EADFD5] pt-3">
              {allReasons.map((reason, index) => (
                <li key={index} className="rounded-[16px] bg-[#FAF7F3] px-4 py-3 font-body text-[15px] font-bold leading-snug text-vyva-text-1">
                  {reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        </div>

        <div className={reportDetailView === "context" ? "grid min-w-0 max-w-full gap-3 overflow-hidden" : "hidden"}>
        {(vitalsSummaryItems.length || summary.evidenceSummary || evidenceSourceNames.length) ? (
          <details className="group rounded-[22px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-blue-900 shadow-[0_8px_22px_rgba(29,78,216,0.07)]" data-testid="card-report-vitals-context">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-blue-700 shadow-sm">
                  <Activity size={18} />
                </span>
                <span className="font-body text-[15px] font-black text-blue-900">
                  {t("health.symptomCheck.report.readingsUsed", "Readings used")}
                </span>
              </span>
              <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 text-blue-700 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-3 grid gap-3 border-t border-[#BFDBFE] pt-3">
              {vitalsSummaryItems.length ? (
                <ul className="grid gap-2">
                  {vitalsSummaryItems.map((item, index) => (
                    <li key={index} className="rounded-[16px] bg-white px-4 py-3 font-body text-[15px] font-black leading-snug text-vyva-text-1 shadow-sm">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              {summary.evidenceSummary ? (
                <p className="rounded-[16px] bg-white px-4 py-3 font-body text-[15px] font-bold leading-snug text-vyva-text-1 shadow-sm">
                  {summary.evidenceSummary}
                </p>
              ) : null}
              {evidenceSourceNames.length ? (
                <p className="font-body text-[13px] font-extrabold leading-snug text-blue-700">
                  {evidenceSourceNames.slice(0, 2).join(" - ")}
                </p>
              ) : null}
            </div>
          </details>
        ) : null}

        {onRefineVital && vitalActions.length ? (
          <details ref={vitalRefinementRef} className="group rounded-[22px] border border-[#DDD6FE] bg-[#FAF5FF] p-3 shadow-[0_8px_22px_rgba(107,33,168,0.08)]" data-testid="card-report-vital-refinement-note">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-vyva-purple shadow-sm">
                  <Activity size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block font-body text-[11px] font-extrabold uppercase tracking-[0.1em] text-vyva-purple">
                    {t("health.symptomCheck.report.optionalReadings", "Optional readings")}
                  </span>
                  <span className="mt-0.5 block truncate font-body text-[16px] font-black text-vyva-text-1">
                    {t("health.symptomCheck.report.refineWithReadingCount", "Add a reading · {{count}} available", { count: vitalActions.length })}
                  </span>
                </span>
              </span>
              <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#DDD6FE] pt-3">
            {vitalActions.map((action) => {
            const open = openVitalKey === action.key;
            const value = vitalInputs[action.key] ?? "";
            const busy = refinementStatus.state === "saving" || refinementStatus.state === "refining";
            const latestCandidate = latestVitalCandidates[action.key] ?? null;
            const latestSource = latestSourceLabel(latestCandidate?.source);
            const statusTone = refinementStatus.state === "error"
              ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
              : "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]";
            return (
              <div key={action.key} className="min-w-0 overflow-hidden rounded-[20px] border border-[#DDD6FE] bg-white p-3" data-testid={`card-report-vital-action-${action.key}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-vyva-purple shadow-sm">
                    <Activity size={23} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-body text-[17px] font-black leading-tight text-vyva-text-1 lg:text-[19px]">
                      {action.title}
                    </p>
                    <p className="mt-1 break-words font-body text-[14px] font-bold leading-snug text-vyva-text-2 sm:text-[15px]">
                      {action.helper}
                    </p>
                  </div>
                </div>
                <div className={`mt-3 grid min-w-0 gap-2 ${latestCandidate ? "lg:grid-cols-2" : ""}`}>
                  {latestCandidate ? (
                    <button
                     type="button"
                     onClick={() => {
                       if (reportDetailsRef.current) reportDetailsRef.current.open = true;
                       if (vitalRefinementRef.current) vitalRefinementRef.current.open = true;
                       setOpenVitalKey(action.key);
                        setVitalInputs((current) => ({
                          ...current,
                          [action.key]: latestCandidate.value,
                        }));
                        setVitalInputError(null);
                      }}
                      disabled={busy}
                      data-testid={`button-report-vital-latest-${action.key}`}
                      className="vyva-tap flex min-h-[62px] w-full min-w-0 items-center justify-between rounded-[20px] bg-[#6B21A8] px-4 text-left text-white shadow-[0_10px_22px_rgba(107,33,168,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="grid min-w-0 gap-1">
                        <span className="min-w-0 font-body text-[16px] font-black leading-tight">
                          {t("health.symptomCheck.report.useLatestReading", "Use latest saved reading")}
                        </span>
                        <span className="min-w-0 font-body text-[13px] font-bold leading-snug text-white/82">
                          {t("health.symptomCheck.report.latestReadingDetail", "{{display}} from {{source}}", {
                            display: latestCandidate.display,
                            source: latestSource,
                          })}
                        </span>
                      </span>
                      <ChevronLeft size={20} className="ml-3 flex-shrink-0 rotate-180" />
                    </button>
                  ) : null}
                  <button
                     type="button"
                     onClick={() => {
                       if (reportDetailsRef.current) reportDetailsRef.current.open = true;
                       if (vitalRefinementRef.current) vitalRefinementRef.current.open = true;
                       setOpenVitalKey(action.key);
                      setVitalInputError(null);
                    }}
                    disabled={busy}
                    data-testid={`button-report-vital-add-${action.key}`}
                    className={`vyva-tap flex min-h-[62px] w-full min-w-0 items-center justify-between rounded-[20px] px-4 text-left font-body font-black shadow-sm disabled:opacity-60 ${
                      latestCandidate
                        ? "border border-[#DDD6FE] bg-white text-vyva-purple"
                        : "bg-[#6B21A8] text-white shadow-[0_10px_22px_rgba(107,33,168,0.16)]"
                    }`}
                  >
                    <span className="min-w-0 text-[17px] leading-tight">
                      {t("health.symptomCheck.report.addReading", "Add reading")}
                    </span>
                    <ChevronLeft size={20} className={`ml-3 flex-shrink-0 rotate-180 ${latestCandidate ? "text-vyva-purple" : "text-white"}`} />
                  </button>
                  {!latestCandidate ? (
                    <p className="px-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2 lg:col-span-2">
                      {t("health.symptomCheck.report.noLatestReadingDetail", "Enter this reading manually to refine the assessment.")}
                    </p>
                  ) : null}
                  {open ? (
                    <div className="grid min-w-0 gap-3 overflow-hidden border-t border-[#DDD6FE] pt-3 lg:col-span-2">
                      <label className="flex min-h-[86px] w-full min-w-0 max-w-full items-end gap-2 overflow-hidden rounded-[24px] border-2 border-[#DDD6FE] bg-white px-4 py-2 lg:items-baseline lg:gap-3 lg:py-0">
                        <input
                          type="text"
                          inputMode={action.key === "bloodPressure" ? "text" : "decimal"}
                          value={value}
                          onChange={(event) => setVitalInputs((current) => ({ ...current, [action.key]: event.target.value }))}
                          placeholder={action.placeholder}
                          className="w-full min-w-0 flex-1 bg-transparent font-body text-[34px] font-black leading-none text-vyva-text-1 outline-none placeholder:text-[#D6C7BA] sm:text-[48px]"
                        />
                        <span className="flex-shrink-0 pb-1 font-body text-[15px] font-black text-vyva-text-2 sm:pb-0 sm:text-[20px]">{action.unit}</span>
                      </label>
                      {vitalInputError ? (
                        <p className="font-body text-[16px] font-black text-[#B91C1C]">{vitalInputError}</p>
                      ) : null}
                      {refinementStatus.message ? (
                        <div className={`rounded-[18px] border p-3 font-body text-[16px] font-black leading-snug ${statusTone}`} aria-live="polite">
                          {busy ? <Loader2 className="mr-2 inline h-5 w-5 animate-spin align-[-3px]" /> : null}
                          {refinementStatus.message}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRefineVital(action, value)}
                        className="vyva-tap flex min-h-[74px] w-full min-w-0 max-w-full items-center justify-center gap-3 overflow-hidden rounded-[22px] bg-[#0A7C4E] px-4 text-center font-body text-[16px] font-black leading-tight text-white disabled:opacity-60 sm:text-[20px]"
                      >
                        {busy ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle size={22} />}
                        {busy
                          ? t("health.symptomCheck.report.refining", "Updating your result...")
                          : t("health.symptomCheck.report.saveAndRefine", "Save and refine result")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {refinementStatus.message ? (
            <div className={`rounded-[22px] border p-4 font-body text-[17px] font-black leading-snug ${
              refinementStatus.state === "error"
                ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
                : "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"
            }`}>
              {refinementStatus.message}
            </div>
          ) : null}
            </div>
          </details>
        ) : null}
        </div>

        <div className={reportDetailView === "why" ? "grid min-w-0 max-w-full gap-3 overflow-hidden" : "hidden"}>
        {isEmergency ? (
          <section className="rounded-[22px] border-2 border-[#DC2626] bg-[#FEF2F2] p-4 text-[#991B1B] shadow-[0_12px_30px_rgba(220,38,38,0.14)]" data-testid="card-report-emergency">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={18} />
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                {t("health.symptomCheck.report.emergencyDoNotWait", "Do not wait")}
              </p>
            </div>
            <p className="font-body text-[16px] font-bold leading-snug">
              {emergencyBody}
            </p>
          </section>
        ) : null}
        </div>

        <div className={reportDetailView === "share" ? "grid min-w-0 max-w-full gap-3 overflow-hidden" : "hidden"}>
        <details className="group rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]" data-testid="report-share-save">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
                <Share2 size={18} />
              </span>
              <span className="font-body text-[15px] font-black text-vyva-text-1">
                {t("health.symptomCheck.report.shareOrSave", "Share or save")}
              </span>
            </span>
            <ChevronLeft size={20} className="-rotate-90 flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-4 grid gap-2 border-t border-[#EADFD5] pt-4 lg:grid-cols-2">
            <button
              type="button"
              onClick={handleShare}
              data-testid="button-report-share"
              className="vyva-tap inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] border border-[#E8DED4] bg-[#FAF9F6] px-4 text-center font-body text-[15px] font-black text-vyva-purple"
            >
              <Share2 size={18} />
              {t("health.symptomCheck.report.shareReportAria", "Share report")}
            </button>
            <button
              type="button"
              onClick={openReport}
              data-testid="button-report-view-reports"
              className="vyva-tap inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 text-center font-body text-[15px] font-black text-[#1D4ED8]"
            >
              <FileText size={18} />
              {t("health.symptomCheck.report.openReportAria", "Open report")}
            </button>
          </div>
        </details>
        </div>

        <div className={reportDetailView === "share" ? "grid min-w-0 max-w-full gap-3 overflow-hidden" : "hidden"}>
        <details className="group rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
          <summary className="cursor-pointer list-none">
            <span className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
                  <Stethoscope size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                    {t("health.symptomCheck.report.detailsForDoctor", "Details for doctor")}
                  </span>
                  <span className="mt-1 block font-body text-[14px] font-bold text-vyva-text-2">
                    {t("health.symptomCheck.report.doctorNoteSub", "Plain text to read, show, or share.")}
                  </span>
                </span>
              </span>
              <ChevronLeft size={20} className="-rotate-90 flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-90" />
            </span>
            <span className="mt-3 block">
              {doctorShareHref ? (
                <a
                  href={doctorShareHref}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={t("health.symptomCheck.report.shareWithDoctor", "Share with doctor")}
                  title={doctorShareTarget?.name}
                  data-testid="link-report-share-doctor"
                  className="vyva-tap inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-vyva-purple px-4 text-center font-body text-[15px] font-black leading-tight text-white shadow-[0_10px_22px_rgba(107,33,168,0.18)] lg:w-auto"
                >
                  <Send size={18} className="flex-shrink-0" />
                  <span className="min-w-0 truncate">{t("health.symptomCheck.report.shareWithDoctor", "Share with doctor")}</span>
                </a>
              ) : (
                <span
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  className="grid w-full gap-2 lg:grid-cols-2"
                >
                  <button
                    type="button"
                    onClick={openDoctorContactSetup}
                    data-testid="button-report-add-doctor-contact"
                    className="vyva-tap inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-vyva-purple px-4 text-center font-body text-[15px] font-black leading-tight text-white shadow-[0_10px_22px_rgba(107,33,168,0.18)]"
                  >
                    <Users size={18} className="flex-shrink-0" />
                    <span className="min-w-0 truncate">{t("health.symptomCheck.report.addDoctorContact", "Add doctor contact")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={openDoctorWithContext}
                    data-testid="button-report-doctor-help-inline"
                    className="vyva-tap inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border border-[#D8B4FE] bg-white px-4 text-center font-body text-[15px] font-black leading-tight text-vyva-purple"
                  >
                    <Stethoscope size={18} className="flex-shrink-0" />
                    <span className="min-w-0 truncate">{t("health.symptomCheck.report.actions.doctorHelp", "Doctor help")}</span>
                  </button>
                  <span className="rounded-[16px] bg-[#FAF9F6] px-3 py-2 text-center font-body text-[13px] font-bold text-vyva-text-2 lg:col-span-2">
                    {t("health.symptomCheck.report.noDoctorToShare", "No doctor contact in profile")}
                  </span>
                </span>
              )}
            </span>
          </summary>
          <div className="mt-4 grid gap-3 border-t border-[#EADFD5] pt-4">
            {doctorTellItems.length ? (
              <ul className="grid gap-2">
                {doctorTellItems.map((item, index) => (
                  <li key={index} className="font-body text-[15px] font-bold leading-snug text-vyva-text-1">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="whitespace-pre-line rounded-[18px] bg-[#FAF7F3] p-4 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-1">
              {doctorNote}
            </p>
          </div>
        </details>

        </div>

        <div className={reportDetailView === "full" ? "grid min-w-0 max-w-full gap-3 overflow-hidden" : "hidden"}>

        <details className="group rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#EFF6FF] text-[#1D4ED8]">
                <FileText size={18} />
              </span>
              <span className="min-w-0 font-body text-[15px] font-extrabold text-vyva-text-1">
                {t("health.symptomCheck.report.fullReport", "Full report")}
              </span>
            </span>
            <ChevronLeft size={20} className="-rotate-90 text-vyva-purple transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-4 grid gap-5 border-t border-[#EADFD5] pt-4">
            {summary.symptoms.length > 0 ? (
              <div>
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                  {t("health.symptomCheck.report.symptoms")}
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {summary.symptoms.map((symptom, index) => (
                    <li key={index} className="rounded-full bg-[#F5F3FF] px-3 py-2 font-body text-[13px] font-bold text-[#6B21A8]">
                      {symptom}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {reportRecommendations.length > 0 ? (
              <div>
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                  {t("health.symptomCheck.report.recommendations")}
                </p>
                <ol className="mt-3 grid gap-3">
                  {reportRecommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple font-body text-[12px] font-bold text-white">
                        {index + 1}
                      </span>
                      <span className="font-body text-[15px] font-semibold leading-relaxed text-vyva-text-1">{recommendation}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {summary.watchSigns?.length ? (
              <div className="rounded-[22px] border border-[#FED7AA] bg-[#FFF7ED] p-3">
                <div className="flex items-center gap-2 text-[#9A3412]">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#C2410C] text-white">
                    <AlertTriangle size={18} />
                  </span>
                  <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                    {t("health.symptomCheck.report.watchSigns", "Watch for")}
                  </p>
                </div>
                <ul className="mt-3 grid gap-2">
                  {summary.watchSigns.map((sign, index) => (
                    <li key={index} className="flex items-start gap-2 rounded-[16px] bg-white px-3 py-2 font-body text-[15px] font-bold leading-snug text-[#9A3412]">
                      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[#C2410C]" />
                      <span>{sign}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {contextNotes.length ? (
              <div>
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-purple">
                  {t("health.symptomCheck.report.contextUsed", "What VYVA considered")}
                </p>
                <ul className="mt-3 grid gap-2">
                  {contextNotes.map((note, index) => (
                    <li key={index} className="font-body text-[15px] font-bold leading-snug text-vyva-text-1">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(summary.evidenceSummary || evidenceSourceNames.length) ? (
              <div>
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#1D4ED8]">
                  {t("health.symptomCheck.report.evidenceChecked", "Science-based source check")}
                </p>
                {summary.evidenceSummary ? (
                  <p className="mt-2 font-body text-[15px] font-semibold leading-relaxed text-vyva-text-1">
                    {summary.evidenceSummary}
                  </p>
                ) : null}
                {evidenceSourceNames.length ? (
                  <p className="mt-2 font-body text-[13px] font-extrabold leading-snug text-[#1D4ED8]">
                    {evidenceSourceNames.slice(0, 2).join(" - ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className={`flex items-start gap-3 border-t border-[#EADFD5] pt-4 ${handoffIsActive ? "text-[#047857]" : "text-vyva-text-2"}`}>
              <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${handoffIsActive ? "bg-[#DCFCE7]" : "bg-[#F5F3FF]"}`}>
                {handoffIsActive ? <CheckCircle size={18} /> : <ClipboardList size={18} />}
              </span>
              <div>
                <p className="font-body text-[15px] font-extrabold leading-snug">
                  {handoffBody}
                </p>
                <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-3">
                  {reportStatusText}
                </p>
                {durationText ? (
                  <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-3">
                    {t("health.symptomCheck.report.timeTaken", "Time taken")}: {durationText}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </details>

        </div>
          </div>
        </details>

        <div className="grid min-w-0 grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] gap-2" data-testid="report-footer-actions">
          <button
            type="button"
            onClick={onDone}
            data-testid="button-report-done"
            className={`vyva-tap min-h-[54px] min-w-0 rounded-[18px] border px-3 text-center font-body text-[14px] font-black leading-tight shadow-[0_8px_20px_rgba(74,35,105,0.07)] ${isDark ? "border-[#4A3657] bg-[#24182E] text-[#EEE4F8]" : "border-[#E7DCF8] bg-[#FBF8FF] text-vyva-purple"}`}
          >
            {t("health.symptomCheck.report.returnToHealth", "Return to My Health")}
          </button>
          <button
            type="button"
            onClick={handleShare}
            data-testid="button-report-share-footer"
            className="vyva-tap inline-flex min-h-[54px] min-w-0 items-center justify-center gap-2 rounded-[18px] bg-vyva-purple px-3 text-center font-body text-[14px] font-black leading-tight text-white shadow-[0_10px_22px_rgba(107,33,168,0.18)]"
          >
            <Share2 size={17} className="flex-shrink-0" />
            {t("health.symptomCheck.report.shareShort", "Share")}
          </button>
        </div>

        <p className="px-3 text-center font-body text-[11px] leading-relaxed text-vyva-text-3 sm:px-8">
          {t("health.symptomCheck.report.disclaimer")}
        </p>
      </div>

    </div>
  );
}

export function SymptomReportPreviewScreen() {
  const navigate = useNavigate();
  const [interactionMode, setInteractionMode] = useState<HomeInteractionMode>("touch");
  const shellContract = resolveSymptomAssessmentPresentation("save_share_summary").shell;
  const previewSummary: TriageSummary = {
    chiefComplaint: "Ongoing mild symptom",
    symptoms: ["Ongoing mild symptom"],
    urgency: "routine",
    recommendations: [
      "Arrange a non-urgent appointment with your doctor.",
      "Rest, hydrate, and keep normal activity gentle until the visit.",
      "Keep a short note of any change so it is easy to explain.",
    ],
    disclaimer: "This report is guidance only and does not replace medical diagnosis or treatment.",
    aiSummary: "Your answers point to medical follow-up soon, with clear watch signs in the meantime.",
    nextStepLabel: "Talk to a doctor within 24-48 hours",
    nextStepLevel: "doctor_24_48",
    triageReasons: ["The symptom is ongoing but no emergency warning sign was selected."],
    watchSigns: ["Symptoms get worse or new symptoms appear."],
    contextBrief: "Your symptom description, timing, and safety answers were reviewed together.",
    contextConfidence: {
      score: 4,
      label: "Good",
      reasons: ["symptom details", "timing", "safety answers"],
      missing: [],
    },
  };

  return (
    <PrototypeSymptomAssessmentShell
      interactionMode={interactionMode}
      onInteractionModeChange={setInteractionMode}
      onBack={() => navigate("/dev/home-master/health")}
      shellContract={shellContract}
    >
      <ReportScreen
        summary={previewSummary}
        bpm={null}
        respiratoryRate={null}
        durationSeconds={96}
        reportId="preview-report"
        reportSaveState="saved"
        savedReport={null}
        profileContacts={{}}
        careTeamMembers={[]}
        emergencyContact={null}
        refinementStatus={{ state: "idle" }}
        onRefineVital={async () => undefined}
        onDone={() => navigate("/dev/home-master/health")}
      />
    </PrototypeSymptomAssessmentShell>
  );
}

export default function SymptomCheckScreen() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { isLoading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { markCompleted, markAbandoned, markBlocked } = useHomeFastHelpOutcome(location.state);
  const incomingState = location.state as SymptomCheckLocationState;
  const incomingInitialClue = typeof incomingState?.initialClue === "string" ? incomingState.initialClue.trim() : "";
  const isFreshStart = new URLSearchParams(window.location.search).get("fresh") === "1";
  const [restoredDraft] = useState(() => (
    isFreshStart
      ? null
      : readSymptomCheckDraft()
  ));
  const { data: triageContext } = useQuery<TriageContextResponse>({
    queryKey: ["/api/triage/context"],
    retry: false,
    staleTime: 2 * 60 * 1000,
  });
  const { data: profileContacts } = useQuery<ProfileContactsResponse>({
    queryKey: ["/api/profile"],
    retry: false,
    staleTime: 2 * 60 * 1000,
  });
  const [step, setStep] = useState<Step>(() => restoredDraft?.step ?? (incomingInitialClue ? "chat" : "intro"));
  const [touchAssessmentStage, setTouchAssessmentStage] = useState<SymptomAssessmentStageId>(() => (
    restoredDraft?.assessmentStage
      ?? (restoredDraft?.step === "report" ? "safest_next_step" : incomingInitialClue ? "symptom_selection" : "describe")
  ));
  const [bpm, setBpm] = useState<number | null>(() => restoredDraft?.bpm ?? null);
  const [respiratoryRate, setRespiratoryRate] = useState<number | null>(() => restoredDraft?.respiratoryRate ?? null);
  const [chatStartTime, setChatStartTime] = useState<number | null>(() => restoredDraft?.chatStartTime ?? (incomingInitialClue ? Date.now() : null));
  const [initialClue, setInitialClue] = useState(() => restoredDraft?.initialClue ?? incomingInitialClue);
  const [autoStartVoice, setAutoStartVoice] = useState(() => Boolean(!restoredDraft && incomingState?.autoStartVoice));
  const [summary, setSummary] = useState<TriageSummary | null>(() => restoredDraft?.summary ?? null);
  const [reportSaveState, setReportSaveState] = useState<ReportSaveState>(() => restoredDraft?.reportSaveState ?? "idle");
  const [reportId, setReportId] = useState<string | null>(() => restoredDraft?.reportId ?? null);
  const [savedReport, setSavedReport] = useState<SavedTriageReport | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(() => restoredDraft?.durationSeconds ?? null);
  const [refinementStatus, setRefinementStatus] = useState<RefinementStatus>(() => restoredDraft?.refinementStatus ?? { state: "idle" });
  const [chatDraft, setChatDraft] = useState<TriageChatDraft | null>(() => restoredDraft?.chatDraft ?? null);
  const [resumePendingRequest] = useState(() => Boolean(restoredDraft?.chatDraft?.pendingRequest));
  const [voiceTriageSessionId, setVoiceTriageSessionId] = useState<string | null>(() => (
    isFreshStart ? null : readVoiceSessionId()
  ));
  const [voiceStartPending, setVoiceStartPending] = useState(false);
  const [symptomInteractionMode, setSymptomInteractionMode] = useState<HomeInteractionMode>(() =>
    incomingState?.autoStartVoice ? "voice" : "touch",
  );
  const [hasAcknowledgedEmergencySafety, setHasAcknowledgedEmergencySafety] = useState(false);
  const voiceStartResetTimerRef = useRef<number | null>(null);
  const chatBackHandlerRef = useRef<(() => boolean) | null>(null);
  const completedVoiceOutcomeRef = useRef<string | null>(null);
  const openedVoiceReportRef = useRef<string | null>(null);
  const { data: drAiVoiceFeature } = useQuery<{ enabled: boolean; mode: "disabled" | "pilot" | "active" }>({
    queryKey: ["/api/config/features/dr-ai-voice"],
    queryFn: async () => {
      const res = await apiFetch("/api/config/features/dr-ai-voice");
      if (!res.ok) return { enabled: false, mode: "disabled" };
      return res.json();
    },
    retry: false,
    staleTime: 60 * 1000,
  });
  const fetchVoiceTriageSession = useCallback(async (conversationId: string) => {
    const res = await apiFetch(`/api/voice-triage/session/${encodeURIComponent(conversationId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json() as Promise<VoiceTriageSessionResponse>;
  }, []);
  const { data: voiceTriageSession } = useQuery<VoiceTriageSessionResponse | null>({
    queryKey: ["/api/voice-triage/session", voiceTriageSessionId],
    enabled: Boolean(voiceTriageSessionId),
    queryFn: async () => {
      if (!voiceTriageSessionId) return null;
      return fetchVoiceTriageSession(voiceTriageSessionId);
    },
    retry: false,
    refetchInterval: (query) => {
      const session = query.state.data;
      return voiceTriageSessionId && session?.status !== "complete" && session?.status !== "emergency"
        ? 1000
        : false;
    },
  });
  const isCompletedVoiceTriageSession = voiceTriageSession?.status === "complete"
    || voiceTriageSession?.latest_response?.status === "complete";
  const voiceReportId = isCompletedVoiceTriageSession
    ? voiceTriageSession?.latest_response?.report?.triage_report_id ?? voiceTriageSession?.triage_report_id ?? null
    : null;
  const embeddedVoiceReportSummary = isCompletedVoiceTriageSession
    ? voiceTriageSession?.latest_response?.summary ?? null
    : null;
  const {
    data: fetchedVoiceReport,
    isLoading: isVoiceReportLoading,
    isError: isVoiceReportError,
    refetch: refetchVoiceReport,
  } = useQuery<SavedTriageReport | null>({
    queryKey: [`/api/reports/triage/${voiceReportId}`],
    enabled: Boolean(isCompletedVoiceTriageSession && voiceReportId && !embeddedVoiceReportSummary),
    queryFn: async () => {
      if (!voiceReportId) return null;
      const res = await apiFetch(`/api/reports/triage/${encodeURIComponent(voiceReportId)}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<SavedTriageReport>;
    },
    retry: 1,
  });
  const voiceReportSummary = embeddedVoiceReportSummary
    ?? triageSummaryFromSavedReport(fetchedVoiceReport);
  const shouldLoadReportContext = step === "report" || isCompletedVoiceTriageSession;
  const { data: careTeamData } = useQuery<{ members: CareTeamMember[] }>({
    queryKey: ["/api/onboarding/careteam"],
    enabled: shouldLoadReportContext,
    retry: false,
    staleTime: 2 * 60 * 1000,
  });
  const { data: latestVitalsData } = useQuery<LatestVitalsResponse>({
    queryKey: ["/api/vitals-engine/latest", "symptom-report"],
    enabled: shouldLoadReportContext,
    retry: false,
    staleTime: 60 * 1000,
  });
  const voiceTriageAnswerMutation = useMutation({
    mutationFn: async (answer: VoiceTriageAnswerInput) => {
      if (!voiceTriageSessionId) throw new Error("No active voice check");
      const res = await apiFetch(`/api/voice-triage/session/${encodeURIComponent(voiceTriageSessionId)}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: language,
          utterance: answer.utterance,
          choice_id: answer.choiceId ?? undefined,
          vitals_text: answer.vitalsText ?? undefined,
          vitals_source: answer.vitalsSource ?? undefined,
          vitals_affects_triage: answer.vitalsAffectsTriage ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<VoiceTriageLatestResponse>;
    },
    onSuccess: (latest, answer) => {
      if (!voiceTriageSessionId) return;
      emitVoiceTriageTouchAnswer({
        conversationId: voiceTriageSessionId,
        utterance: answer.utterance,
        choiceId: answer.choiceId ?? null,
        vitalsText: answer.vitalsText ?? null,
        nextQuestion: latest.question?.text || latest.spoken_text || null,
        status: latest.status ?? "active",
      });
      queryClient.setQueryData<VoiceTriageSessionResponse | null>(
        ["/api/voice-triage/session", voiceTriageSessionId],
        (current) => current
          ? {
              ...current,
              status: (latest.status as VoiceTriageSessionResponse["status"]) || current.status,
              latest_response: latest,
              triage_report_id: latest.report?.triage_report_id ?? current.triage_report_id,
              updated_at: new Date().toISOString(),
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["/api/voice-triage/session", voiceTriageSessionId] });
    },
    onError: () => {
      toast({
        title: t("health.symptomCheck.voicePanel.answerFailedTitle", "Could not continue the voice check"),
        description: t("health.symptomCheck.voicePanel.answerFailedBody", "Please try again, or use emergency services now if this feels urgent."),
        variant: "destructive",
      });
    },
  });
  const handleVoiceTriageAnswer = useCallback((answer: VoiceTriageAnswerInput) => {
    voiceTriageAnswerMutation.mutate(answer);
  }, [voiceTriageAnswerMutation]);

  useEffect(() => {
    if (!isCompletedVoiceTriageSession || !voiceTriageSession) return;
    const outcomeKey = `${voiceTriageSession.conversation_id}:${voiceReportId ?? "no-report"}`;
    if (completedVoiceOutcomeRef.current !== outcomeKey) {
      completedVoiceOutcomeRef.current = outcomeKey;
      markCompleted({
        reason: "voice_triage_completed",
        referenceId: voiceReportId ?? voiceTriageSession.conversation_id,
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/reports/triage"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/reports/summary"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/symptoms"] });
    }

    if (!voiceReportId || openedVoiceReportRef.current === voiceReportId) return;
    openedVoiceReportRef.current = voiceReportId;
    clearSymptomCheckDraft();
    clearVoiceSessionId();
    navigate(`/informes/${encodeURIComponent(voiceReportId)}`, { replace: true });
  }, [isCompletedVoiceTriageSession, markCompleted, navigate, voiceReportId, voiceTriageSession]);

  useEffect(() => {
    const handleScreenSyncRequest = async (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as DrAiScreenSyncRequestDetail | undefined
        : undefined;
      if (!detail?.conversationId || !detail.requestId) return;
      if (isCompletedVoiceTriageSession) {
        acknowledgeDrAiScreenSync({ ...detail, rendered: true });
        return;
      }

      let rendered = false;
      try {
        setVoiceTriageSessionId(detail.conversationId);
        const session = await queryClient.fetchQuery({
          queryKey: ["/api/voice-triage/session", detail.conversationId],
          queryFn: () => fetchVoiceTriageSession(detail.conversationId),
          staleTime: 0,
        });
        rendered = Boolean(session);
        if (rendered) {
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        }
      } catch (error) {
        console.warn("[Dr. AI] Could not synchronize the triage screen:", error);
      }
      acknowledgeDrAiScreenSync({ ...detail, rendered });
    };

    window.addEventListener(VYVA_DR_AI_SCREEN_SYNC_REQUEST_EVENT, handleScreenSyncRequest);
    return () => window.removeEventListener(VYVA_DR_AI_SCREEN_SYNC_REQUEST_EVENT, handleScreenSyncRequest);
  }, [fetchVoiceTriageSession, isCompletedVoiceTriageSession]);

  const endVoiceTriageSession = useCallback((conversationId: string | null) => {
    if (!conversationId) return;
    void apiFetch(`/api/voice-triage/session/${encodeURIComponent(conversationId)}/end`, {
      method: "POST",
    }).catch((error) => console.warn("[Dr. AI] Could not end the triage session:", error));
  }, []);

  const resetSymptomCheck = useCallback(() => {
    if (voiceStartResetTimerRef.current !== null) {
      window.clearTimeout(voiceStartResetTimerRef.current);
      voiceStartResetTimerRef.current = null;
    }
    endVoiceTriageSession(voiceTriageSessionId);
    clearSymptomCheckDraft();
    clearVoiceSessionId();
    setBpm(null);
    setRespiratoryRate(null);
    setChatStartTime(null);
    setInitialClue("");
    setAutoStartVoice(false);
    setSummary(null);
    setReportSaveState("idle");
    setReportId(null);
    setSavedReport(null);
    setDurationSeconds(null);
    setRefinementStatus({ state: "idle" });
    setChatDraft(null);
    setVoiceTriageSessionId(null);
    setVoiceStartPending(false);
    setSymptomInteractionMode("touch");
    voiceTriageAnswerMutation.reset();
    completedVoiceOutcomeRef.current = null;
    setStep("intro");
    setTouchAssessmentStage("describe");
  }, [endVoiceTriageSession, voiceTriageAnswerMutation, voiceTriageSessionId]);

  useEffect(() => {
    if (step === "intro") return;
    if (step === "chat" && !chatDraft) return;
    if (step === "report" && !summary) return;
    writeSymptomCheckDraft({
      step,
      initialClue,
      bpm,
      respiratoryRate,
      chatStartTime,
      summary,
      reportSaveState,
      reportId,
      durationSeconds,
      refinementStatus,
      chatDraft,
      assessmentStage: touchAssessmentStage,
    });
  }, [bpm, chatDraft, chatStartTime, durationSeconds, initialClue, refinementStatus, reportId, reportSaveState, respiratoryRate, step, summary, touchAssessmentStage]);

  const handleBack = () => {
    if (isCompletedVoiceTriageSession) {
      markCompleted({ reason: "symptom_check_finished", referenceId: voiceReportId });
      clearSymptomCheckDraft();
      clearVoiceSessionId();
      setVoiceTriageSessionId(null);
      completedVoiceOutcomeRef.current = null;
      navigate(symptomCheckHealthReturnPath(location.pathname));
      return;
    }

    if (step === "chat") {
      if (chatBackHandlerRef.current?.()) return;
      resetSymptomCheck();
      return;
    }

    if (step === "report") {
      const previousTurn = stepBackTriageDraft(chatDraft);
      if (previousTurn) {
        setChatDraft(previousTurn.draft);
        setSummary(null);
        setReportSaveState("idle");
        setReportId(null);
        setSavedReport(null);
        setDurationSeconds(null);
        setRefinementStatus({ state: "idle" });
        setStep("chat");
        setTouchAssessmentStage(previousTurn.presentationStage ?? "review");
        return;
      }

      if (chatDraft) {
        setSummary(null);
        setStep("chat");
        setTouchAssessmentStage("review");
        return;
      }

      resetSymptomCheck();
      return;
    }

    markAbandoned({ reason: "left_symptom_check" });
    clearSymptomCheckDraft();
    navigate(symptomCheckHealthReturnPath(location.pathname));
  };

  const startChatDirectly = (clue: string, withVoice = false) => {
    clearSymptomCheckDraft();
    setChatDraft(null);
    setSummary(null);
    setReportId(null);
    setSavedReport(null);
    setDurationSeconds(null);
    setReportSaveState("idle");
    setRefinementStatus({ state: "idle" });
    setInitialClue(clue);
    setChatStartTime(Date.now());
    setAutoStartVoice(withVoice);
    setStep("chat");
    setTouchAssessmentStage(clue ? "symptom_selection" : "describe");
  };

  const handleIntroStart = useCallback((clue: string) => {
    writeSymptomCheckVisited();
    startChatDirectly(clue, false);
  }, []);

  const refreshVoiceSessionIdSoon = useCallback(() => {
    setVoiceTriageSessionId(readVoiceSessionId());
    window.setTimeout(() => setVoiceTriageSessionId(readVoiceSessionId()), 250);
    window.setTimeout(() => setVoiceTriageSessionId(readVoiceSessionId()), 1200);
  }, []);

  const scheduleVoiceStartReset = useCallback(() => {
    if (voiceStartResetTimerRef.current !== null) {
      window.clearTimeout(voiceStartResetTimerRef.current);
    }
    voiceStartResetTimerRef.current = window.setTimeout(() => {
      setVoiceStartPending(false);
      voiceStartResetTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    if (voiceTriageSessionId) setVoiceStartPending(false);
  }, [voiceTriageSessionId]);

  useEffect(() => {
    if (isFreshStart) {
      clearVoiceSessionId();
      setVoiceTriageSessionId(null);
    }
    const syncVoiceSessionId = () => setVoiceTriageSessionId(readVoiceSessionId());
    if (!isFreshStart) syncVoiceSessionId();
    window.addEventListener(VYVA_VOICE_SESSION_CHANGED_EVENT, syncVoiceSessionId);
    window.addEventListener("storage", syncVoiceSessionId);
    return () => {
      window.removeEventListener(VYVA_VOICE_SESSION_CHANGED_EVENT, syncVoiceSessionId);
      window.removeEventListener("storage", syncVoiceSessionId);
    };
  }, [isFreshStart]);

  useEffect(() => () => {
    if (voiceStartResetTimerRef.current !== null) {
      window.clearTimeout(voiceStartResetTimerRef.current);
    }
  }, []);

  const handleTalkToVyva = useCallback(() => {
    if (drAiVoiceFeature?.enabled === false) {
      toast({
        title: t("health.symptomCheck.voiceUnavailableTitle", "Dr. AI voice is not available yet"),
        description: t("health.symptomCheck.voiceUnavailableBody", "You can continue the same symptom check by touch."),
      });
      return;
    }
    setSymptomInteractionMode("voice");
    setVoiceStartPending(true);
    writeSymptomCheckVisited();
    const contextHint = "The user opened Symptom Check and wants a voice-first symptom check. Start by asking what has changed today, then call the VYVA triage tool before giving health guidance.";
    emitVoiceSpecialistTransfer({
      domain: "health",
      reason: "The user tapped Talk to VYVA on Symptom Check.",
      evidence: "Symptom Check voice-first entry",
      contextHint,
      route: "/health/symptom-check",
      agentSlug: VOICE_SPECIALIST_AGENT_SLUGS.health,
      autoStart: true,
      appEntrypoint: "feel_better_voice",
    });
    refreshVoiceSessionIdSoon();
    scheduleVoiceStartReset();
  }, [drAiVoiceFeature?.enabled, refreshVoiceSessionIdSoon, scheduleVoiceStartReset, t, toast]);

  useEffect(() => {
    if (voiceTriageSessionId) setSymptomInteractionMode("voice");
  }, [voiceTriageSessionId]);

  const handleChatDraftChange = useCallback((draft: TriageChatDraft) => {
    setChatDraft(draft);
  }, []);

  const handleChatBackHandlerChange = useCallback((handler: (() => boolean) | null) => {
    chatBackHandlerRef.current = handler;
  }, []);

  const handleDone = () => {
    const completedReportId = isCompletedVoiceTriageSession ? voiceReportId : reportId;
    markCompleted({ reason: "symptom_check_finished", referenceId: completedReportId });
    clearSymptomCheckDraft();
    if (isCompletedVoiceTriageSession) {
      clearVoiceSessionId();
      setVoiceTriageSessionId(null);
      completedVoiceOutcomeRef.current = null;
    }
    navigate(symptomCheckHealthReturnPath(location.pathname));
  };

  const handleReportVoiceClick = () => {
    if (isCompletedVoiceTriageSession) {
      clearVoiceSessionId();
      setVoiceTriageSessionId(null);
      completedVoiceOutcomeRef.current = null;
    }
    handleTalkToVyva();
  };

  const saveTriageReport = async (
    triageSummary: TriageSummary,
    reportDurationSeconds: number | null,
    vitalOverrides?: { bpm?: number | null; respiratoryRate?: number | null },
  ) => {
    const res = await apiFetch("/api/reports/triage", {
      method: "POST",
      body: JSON.stringify({
        chief_complaint: triageSummary.chiefComplaint,
        symptoms: triageSummary.symptoms,
        urgency: triageSummary.urgency,
        recommendations: triageSummary.recommendations,
        disclaimer: triageSummary.disclaimer,
        ai_summary: triageSummary.aiSummary ?? null,
        next_step_label: triageSummary.nextStepLabel ?? null,
        next_step_level: triageSummary.nextStepLevel ?? null,
        triage_reasons: triageSummary.triageReasons ?? [],
        watch_signs: triageSummary.watchSigns ?? [],
        profile_considerations: triageSummary.profileConsiderations ?? [],
        vitals_notes: triageSummary.vitalsNotes ?? [],
        interpretation: triageSummary.interpretation ?? null,
        possible_patterns: triageSummary.possiblePatterns ?? [],
        uncertainty: triageSummary.uncertainty ?? [],
        reassessment_window: triageSummary.reassessmentWindow ?? null,
        change_plan_triggers: triageSummary.changePlanTriggers ?? [],
        clinical_handoff: triageSummary.clinicalHandoff ?? null,
        scan_results: triageSummary.scanResults ?? [],
        scan_notes: triageSummary.scanNotes ?? [],
        bpm: vitalOverrides?.bpm ?? bpm ?? null,
        respiratory_rate: vitalOverrides?.respiratoryRate ?? respiratoryRate ?? null,
        duration_seconds: reportDurationSeconds,
      }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json().catch(() => null) as Promise<SavedTriageReport | null>;
  };

  const logSymptomResult = (triageSummary: TriageSummary, saved: SavedTriageReport | null) => {
    if (!saved?.id) return;

    void apiFetch("/api/symptoms/log", {
      method: "POST",
      body: JSON.stringify({
        triage_report_id: saved.id,
        symptom_description: triageSummary.chiefComplaint,
        severity: symptomSeverityForSummary(triageSummary),
        check_completed: true,
        vyva_recommendation: triageSummary.nextStepLabel || triageSummary.recommendations[0] || "",
        escalated_to_caregiver: Boolean(saved.sent_to?.length),
      }),
    })
      .then((response) => {
        if (!response.ok) return;
        void queryClient.invalidateQueries({ queryKey: ["/api/health/prevention"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/reports/summary"] });
      })
      .catch((err) => {
        console.warn("[symptoms/log] refresh skipped:", err);
      });
  };

  const applySavedReport = (saved: SavedTriageReport | null) => {
    setReportId(saved?.id ?? null);
    setSavedReport(saved);
    setReportSaveState("saved");
    queryClient.invalidateQueries({ queryKey: ["/api/reports/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/reports/vitals/history"] });
    if (saved) {
      queryClient.setQueryData(["/api/reports/summary"], (current: unknown) => ({
        latestVitals: null,
        latestSignals: [],
        todayMeds: { taken: 0, total: 0, adherencePct: null },
        ...(current && typeof current === "object" ? current : {}),
        latestTriage: saved,
      }));
      if (saved.id) {
        queryClient.setQueryData([`/api/reports/triage/${saved.id}`], saved);
      }
    }
  };

  const handleChatComplete = (triageSummary: TriageSummary) => {
    const durationSeconds = chatStartTime
      ? Math.round((Date.now() - chatStartTime) / 1000)
      : null;
    setDurationSeconds(durationSeconds);
    setSummary(triageSummary);
    setReportId(null);
    setSavedReport(null);
    setRefinementStatus({ state: "idle" });
    setReportSaveState("saving");
    setStep("report");
    saveTriageReport(triageSummary, durationSeconds)
      .then((saved) => {
        applySavedReport(saved);
        logSymptomResult(triageSummary, saved);
        markCompleted({ reason: "symptom_report_saved", referenceId: saved?.id });
        if (saved?.id) {
          clearSymptomCheckDraft();
          navigate(`/informes/${encodeURIComponent(saved.id)}`, { replace: true });
        }
      })
      .catch((err) => {
        console.error("[reports/triage] save failed:", err);
        setReportSaveState("error");
        markBlocked({ reason: "symptom_report_save_failed" });
      });
  };

  const handleRefineVital = async (config: RefinementVitalConfig, rawValue: string) => {
    if (!summary) return;
    const parsed = config.parse(rawValue);
    if (!parsed) return;

    const previousNextStep = summary.nextStepLevel ?? summary.nextStepLabel ?? "";
    try {
      setRefinementStatus({
        state: "saving",
        message: t("health.symptomCheck.report.savingReading", "Saving {{display}}...", { display: parsed.display }),
      });

      const readings = config.key === "bloodPressure"
        ? [
            { signal_type: "bp_systolic", value: parsed.value },
            { signal_type: "bp_diastolic", value: parsed.extraValue },
          ]
        : [{ signal_type: config.signalType, value: parsed.value }];

      for (const reading of readings) {
        if (reading.value == null) continue;
        const saveReading = await apiFetch("/api/vitals-engine/reading", {
          method: "POST",
          body: JSON.stringify({
            signal_type: reading.signal_type,
            value: reading.value,
            source: "manual_entry",
            context_tag: "general",
          }),
        });
        if (!saveReading.ok) throw new Error(`vitals ${saveReading.status}`);
      }

      setRefinementStatus({
        state: "refining",
        message: t("health.symptomCheck.report.updatingWithReading", "Updating your result with this reading..."),
      });

      const refinedVitals = {
        bpm: parsed.vitals.pulseBpm ?? bpm ?? undefined,
        respiratoryRate: parsed.vitals.respiratoryRate ?? respiratoryRate ?? undefined,
        ...parsed.vitals,
      };
      const context = summary.refinementContext;
      const baseMessages = context?.messages?.length
        ? context.messages
        : [{ role: "user" as const, content: initialClue || summary.chiefComplaint }];

      const refineResponse = await apiFetch("/api/triage/message", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            ...baseMessages,
            {
              role: "user",
              content: t(
                "health.symptomCheck.report.refinePrompt",
                "New vital added after the first report: {{title}}: {{display}}. Refine the triage result with this new reading. Vitals can increase or clarify urgency, but must not downgrade emergency red flags.",
                { title: config.title, display: parsed.display },
              ),
            },
          ],
          vitals: refinedVitals,
          locale: language,
          wizard: {
            mode: context?.entryMode ?? "without_vitals",
            vitalsScanCompleted: false,
            vitals: refinedVitals,
            quickAnswers: context?.quickAnswers ?? [],
            scanResults: context?.scanResults ?? summary.scanResults ?? [],
            refineRequested: true,
            previousSummary: summary,
          },
          healthMemory: triageContext?.memory ?? null,
        }),
      });
      if (!refineResponse.ok) throw new Error(`triage ${refineResponse.status}`);
      const refinedPayload = await refineResponse.json();
      if (!refinedPayload?.done || !refinedPayload?.summary) {
        throw new Error("refinement did not return a report");
      }

      const refinedSummary = {
        ...refinedPayload.summary,
        aiSummary: refinedPayload.content,
        evidenceSources: refinedPayload.summary.evidenceSources ?? refinedPayload.evidenceSources,
        contextConfidence: refinedPayload.guidancePlan?.confidence ?? summary.contextConfidence,
        contextSignals: refinedPayload.guidancePlan?.usefulSignals ?? summary.contextSignals,
        contextBrief: refinedPayload.guidancePlan
          ? `${refinedPayload.guidancePlan.protocolLabel}: ${refinedPayload.guidancePlan.nextQuestionFocus}`
          : summary.contextBrief,
        refinementContext: context,
      } as TriageSummary;

      if (parsed.vitals.pulseBpm != null) setBpm(parsed.vitals.pulseBpm);
      if (parsed.vitals.respiratoryRate != null) setRespiratoryRate(parsed.vitals.respiratoryRate);
      setSummary(refinedSummary);
      setReportSaveState("saving");

      const saved = await saveTriageReport(refinedSummary, durationSeconds, {
        bpm: parsed.vitals.pulseBpm ?? bpm,
        respiratoryRate: parsed.vitals.respiratoryRate ?? respiratoryRate,
      });
      applySavedReport(saved);
      logSymptomResult(refinedSummary, saved);

      const nextStepChanged = Boolean(
        previousNextStep &&
        (refinedSummary.nextStepLevel ?? refinedSummary.nextStepLabel) &&
        (refinedSummary.nextStepLevel ?? refinedSummary.nextStepLabel) !== previousNextStep,
      );
      setRefinementStatus({
        state: "done",
        message: t(
          nextStepChanged ? "health.symptomCheck.report.updatedReadingChanged" : "health.symptomCheck.report.updatedReadingSame",
          nextStepChanged
            ? "Updated with {{display}}. Next step changed. Report updated and ready to share."
            : "Updated with {{display}}. Next step stayed the same. Report updated and ready to share.",
          { display: parsed.display },
        ),
      });
    } catch (err) {
      console.error("[symptom-check] refinement failed:", err);
      setRefinementStatus({
        state: "error",
        message: t("health.symptomCheck.report.updateReadingFailed", "Could not update with this reading. The original report is still available."),
      });
    }
  };

  const provisionalVoiceTriageSession: VoiceTriageSessionResponse | null =
    voiceStartPending && voiceTriageSessionId && !voiceTriageSession
      ? {
          conversation_id: voiceTriageSessionId,
          status: "active",
          latest_response: {
            ok: true,
            status: "active",
            spoken_text: t("health.symptomCheck.voicePanel.connectingPrompt", "Connecting to VYVA. Tell VYVA what has changed today."),
            question: {
              stage: "start",
              text: t("health.symptomCheck.voicePanel.connectingQuestion", "Tell VYVA what has changed today."),
              reason: t("health.symptomCheck.voicePanel.connectingReason", "VYVA is starting the same safety-first check for voice and touch."),
              profile_context_used: true,
              choices: [],
            },
          },
        }
      : null;
  const activeVoiceTriageSession = voiceTriageSession ?? provisionalVoiceTriageSession;
  const canAnswerVoiceTriageSession = Boolean(voiceTriageSession);
  const displayedReportSummary = isCompletedVoiceTriageSession
    ? voiceReportSummary
    : step === "report"
      ? summary
      : null;
  const displayedReportId = isCompletedVoiceTriageSession ? voiceReportId : reportId;
  const displayedSavedReport = isCompletedVoiceTriageSession ? fetchedVoiceReport ?? null : savedReport;
  const displayedReportSaveState: ReportSaveState = isCompletedVoiceTriageSession
    ? (voiceReportId ? "saved" : "error")
    : reportSaveState;
  const completedVoiceReportAction = isCompletedVoiceTriageSession
    ? voiceTriageSession?.latest_response?.action_options?.find((action) => action.kind === "view_report") ?? null
    : null;
  const voiceRuntimeStage = activeVoiceTriageSession?.latest_response?.question?.stage;
  const voiceUrgent = activeVoiceTriageSession?.status === "emergency"
    || activeVoiceTriageSession?.latest_response?.status === "emergency";
  const currentAssessmentStage = isCompletedVoiceTriageSession
    ? (displayedReportSummary && voiceReportId ? "save_share_summary" : "safest_next_step")
    : activeVoiceTriageSession
    ? symptomAssessmentStageForRuntime(voiceRuntimeStage, voiceUrgent)
    : step === "report"
      ? (reportSaveState === "saved" ? "save_share_summary" : "safest_next_step")
      : touchAssessmentStage;
  const currentAssessmentPresentation = resolveSymptomAssessmentPresentation(currentAssessmentStage);

  return (
    <PrototypeSymptomAssessmentShell
      interactionMode={symptomInteractionMode}
      onInteractionModeChange={(mode) => {
        if (mode === "voice") {
          if (displayedReportSummary) {
            handleReportVoiceClick();
          } else {
            handleTalkToVyva();
          }
          return;
        }
        setSymptomInteractionMode("touch");
      }}
      onBack={handleBack}
      shellContract={currentAssessmentPresentation.shell}
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        data-testid="symptom-check-shell"
        data-flow-id="health.symptom_assessment"
        data-stage-id={currentAssessmentStage}
        data-registry-scene={currentAssessmentPresentation.registrySceneId}
        data-voice-presentation-id={currentAssessmentPresentation.voiceSceneId}
        data-touch-presentation-id={currentAssessmentPresentation.touchSceneId}
      >
        {step === "intro" && !activeVoiceTriageSession && (
          <IntroScreen
            onStart={handleIntroStart}
            onTalkToVyva={handleTalkToVyva}
            onNavigate={(route) => navigate(route)}
            personalizedSuggestions={triageContext?.personalizedSuggestions}
            activeConditions={triageContext?.activeConditions ?? []}
            profileContextItems={triageContext?.usedItems ?? []}
            emergencyContact={triageContext?.emergencyContact ?? null}
            showEmergencyModal={!hasAcknowledgedEmergencySafety}
            onEmergencyModalDismiss={() => setHasAcknowledgedEmergencySafety(true)}
          />
        )}

        {activeVoiceTriageSession && !isCompletedVoiceTriageSession ? (
          <VoiceTriageLivePanel
            session={activeVoiceTriageSession}
            stageId={currentAssessmentStage}
            modality={symptomInteractionMode}
            onAnswer={canAnswerVoiceTriageSession ? handleVoiceTriageAnswer : undefined}
            isAnswering={voiceTriageAnswerMutation.isPending || !canAnswerVoiceTriageSession}
          />
        ) : null}

        {step === "chat" && !isCompletedVoiceTriageSession && (
          <TriageChat
            bpm={bpm}
            respiratoryRate={respiratoryRate}
            entryMode="without_vitals"
            initialClue={initialClue}
            healthMemory={triageContext?.memory ?? null}
            autoStartVoice={autoStartVoice}
            initialDraft={chatDraft}
            resumePendingRequest={resumePendingRequest}
            language={language}
            languageReady={!profileLoading}
            presentationStage={currentAssessmentStage}
            composerVisibility={currentAssessmentPresentation.shell.composer}
            onStageChange={(runtimeStage, urgent) => setTouchAssessmentStage(
              symptomAssessmentStageForRuntime(runtimeStage, urgent),
            )}
            onDraftChange={handleChatDraftChange}
            onBackHandlerChange={handleChatBackHandlerChange}
            onVitalsScanned={(nextBpm, nextRespiratoryRate) => {
              if (nextBpm != null) setBpm(nextBpm);
              if (nextRespiratoryRate != null) setRespiratoryRate(nextRespiratoryRate);
            }}
            onVoiceAutoStarted={() => setAutoStartVoice(false)}
            onComplete={handleChatComplete}
          />
        )}

        {displayedReportSummary ? (
          <ReportScreen
            summary={displayedReportSummary}
            bpm={isCompletedVoiceTriageSession ? fetchedVoiceReport?.bpm ?? null : bpm}
            respiratoryRate={isCompletedVoiceTriageSession ? fetchedVoiceReport?.respiratory_rate ?? null : respiratoryRate}
            durationSeconds={isCompletedVoiceTriageSession ? fetchedVoiceReport?.duration_seconds ?? null : durationSeconds}
            reportId={displayedReportId}
            reportSaveState={displayedReportSaveState}
            savedReport={displayedSavedReport}
            profileContacts={profileContacts}
            careTeamMembers={careTeamData?.members ?? []}
            emergencyContact={triageContext?.emergencyContact ?? null}
            latestVitalReadings={latestVitalsData?.recent_readings ?? []}
            refinementStatus={refinementStatus}
            onRefineVital={handleRefineVital}
            onDone={handleDone}
          />
        ) : null}

        {isCompletedVoiceTriageSession && !displayedReportSummary ? (
          <SymptomAssessmentPresentation
            stageId="safest_next_step"
            modality="voice"
            showHeader={false}
            fullBleedChildren
          >
            <CompletedVoiceReportFallback
              reportId={voiceReportId}
              reportAction={completedVoiceReportAction}
              isLoading={isVoiceReportLoading}
              isError={isVoiceReportError || (!isVoiceReportLoading && !voiceReportSummary)}
              onRetry={() => { void refetchVoiceReport(); }}
              onDone={handleDone}
            />
          </SymptomAssessmentPresentation>
        ) : null}
      </div>
    </PrototypeSymptomAssessmentShell>
  );
}
