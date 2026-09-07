import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertCircle,
  BedDouble,
  BookOpenCheck,
  Brain,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Camera,
  CheckCircle,
  ChevronDown,
  CircleCheckBig,
  HeartPulse,
  HelpCircle,
  ListChecks,
  Mic,
  PhoneCall,
  Send,
  ScanFace,
  Square,
  Thermometer,
  TrendingUp,
  Wind,
} from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import { useLanguage } from "@/i18n";
import {
  localizeTriageAnswerLabel,
  localizeTriageQuestion,
} from "../../shared/triageDisplayLocalization";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { HealthWizardCard, HealthWizardChoiceTile, HealthWizardHero } from "@/components/health/HealthWizard";
import { SymptomAssessmentPresentation } from "@/components/health/SymptomAssessmentPresentation";
import {
  isNumericSeverityScaleChoices,
  SeverityScaleControl,
} from "@/components/health/SeverityScaleControl";
import { SymptomSafetyChoiceCard, type SymptomSafetyChoiceTone } from "@/components/health/SymptomSafetyChoiceCard";
import { SymptomChoiceCard } from "@/components/health/SymptomChoiceCard";
import type { VyvaIconAccent } from "@/components/brand/VyvaIcon";
import type {
  SymptomAssessmentComposerVisibility,
  SymptomAssessmentStageId,
} from "@/design/screenPresentation";
import TriageScanCard from "@/components/TriageScanCard";
import { VitalsAcquisitionPanel, type TriageVitalValues } from "@/components/VitalsAcquisitionPanel";
import { ListenButton } from "@/components/ListenButton";
import { selectTriageScanOffer } from "@/lib/triageScanOffers";
import type { TriageScanResult, TriageScanType } from "../../shared/triageScans";
import type { VitalsReadingSource } from "../../shared/vitalsEvidence";

const TRIAGE_REQUEST_TIMEOUT_MS = 20_000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type TriageEvidenceSource = { title?: string; url?: string; year?: string; journal?: string };
type TriageSafetyAlert = { id: string; label: string; recommendation: string; emergencyContact?: EmergencyContact };

type TriageGuidanceSignal = {
  id: string;
  label: string;
  status: "available" | "missing" | "not_needed";
};

type TriageGuidancePlan = {
  protocolId: string;
  protocolLabel: string;
  stage: string;
  priorityLabel: string;
  nextQuestionFocus: string;
  confidence: {
    score: number;
    label: string;
    reasons: string[];
    missing: string[];
  };
  profileContextUsed: boolean;
  usefulSignals: TriageGuidanceSignal[];
};

type TriageRefinementAnswer = {
  id: string;
  label: string;
  value: string;
  kind: string;
};

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
  vitalsSnapshot?: import("../../shared/schema.js").TriageReportVitalsSnapshot | null;
  scanResults?: TriageScanResult[];
  scanNotes?: string[];
  evidenceSummary?: string;
  evidenceSources?: TriageEvidenceSource[];
  contextConfidence?: TriageGuidancePlan["confidence"];
  contextSignals?: TriageGuidanceSignal[];
  contextBrief?: string;
  refinementContext?: {
    messages: ChatMessage[];
    quickAnswers: TriageRefinementAnswer[];
    scanResults?: TriageScanResult[];
    entryMode: WizardEntryMode;
    initialClue: string;
  };
}

interface TriageResponse {
  role: "assistant";
  content: string;
  done?: boolean;
  summary?: TriageSummary;
  urgent?: boolean;
  safetyAlert?: TriageSafetyAlert;
  quickReplies?: ApiQuickReply[];
  wizardStage?: string;
  wizardStageLabel?: string;
  wizardSymptomId?: string;
  evidenceSources?: TriageEvidenceSource[];
  emergencyContact?: EmergencyContact;
  medisearchConversationId?: string;
  medicalFollowups?: string[];
  questionReason?: string | null;
  profileContextUsed?: boolean;
  vitalsPrompt?: TriageVitalsPrompt | null;
  guidancePlan?: TriageGuidancePlan | null;
}

type TriageVitalsPromptAction = {
  id: "pulse" | "oxygen" | "blood_pressure" | "temperature" | "glucose";
  label: string;
  value: string;
  icon: QuickAnswerIcon;
  tone: QuickAnswerTone;
};

type TriageVitalsPrompt = {
  title: string;
  body: string;
  actions: TriageVitalsPromptAction[];
  deviceAccess?: {
    status: "connected" | "not_connected";
    actionIds: TriageVitalsPromptAction["id"][];
  };
};

type WizardEntryMode = "with_vitals" | "without_vitals";

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

interface TriageChatProps {
  bpm: number | null;
  respiratoryRate?: number | null;
  entryMode: WizardEntryMode;
  initialClue?: string;
  healthMemory?: TriageHealthMemory | null;
  autoStartVoice?: boolean;
  initialDraft?: TriageChatDraft | null;
  resumePendingRequest?: boolean;
  language?: string;
  languageReady?: boolean;
  showProgressCard?: boolean;
  presentationStage?: SymptomAssessmentStageId;
  composerVisibility?: SymptomAssessmentComposerVisibility;
  onStageChange?: (stage: string, urgent?: boolean) => void;
  onDraftChange?: (draft: TriageChatDraft) => void;
  onBackHandlerChange?: (handler: (() => boolean) | null) => void;
  onVitalsScanned?: (bpm: number | null, respiratoryRate: number | null) => void;
  onVoiceAutoStarted?: () => void;
  onComplete: (summary: TriageSummary) => void;
}

type QuickAnswerTone = "purple" | "red" | "blue" | "amber" | "green";
type QuickAnswerIcon =
  | "heart"
  | "wind"
  | "thermometer"
  | "activity"
  | "alert"
  | "help"
  | "calendar"
  | "calendar_range"
  | "calendar_clock"
  | "trend_up"
  | "bed"
  | "check"
  | "face";

type ApiQuickReply = {
  id: string;
  label: string;
  value: string;
  icon: QuickAnswerIcon;
  tone: QuickAnswerTone;
  kind?: string;
};

type QuickAnswer = {
  id: string;
  label: string;
  value: string;
  Icon: typeof HeartPulse;
  accent?: VyvaIconAccent;
  tone: QuickAnswerTone;
  kind: string;
};

type SelectedQuickAnswer = {
  id: string;
  label: string;
  value: string;
  kind: string;
};

type AcquiredVitalEvidence = Partial<Record<keyof TriageVitalValues, {
  source: VitalsReadingSource;
  affectsTriage: boolean;
}>>;

type PendingTriageRequest = {
  history: ChatMessage[];
  quickAnswerTrail: SelectedQuickAnswer[];
  nextScanResults: TriageScanResult[];
  nextDeclinedScanTypes: TriageScanType[];
  vitalsOverride?: TriageVitalValues;
};

function runtimeStageForPresentation(stage: SymptomAssessmentStageId | undefined) {
  switch (stage) {
    case "safety_check": return "red_flag";
    case "severity": return "severity";
    case "onset": return "duration";
    case "related_details": return "trend";
    case "review": return "support";
    case "safest_next_step":
    case "save_share_summary": return "complete";
    case "symptom_selection":
    case "describe":
    default: return "symptom";
  }
}

function safetyToneForQuickAnswer(answer: QuickAnswer): SymptomSafetyChoiceTone {
  if (answer.id === "no_red_flag" || answer.tone === "green") return "clear";
  if (answer.tone === "amber" || answer.tone === "purple" || answer.tone === "blue") return "caution";
  return "warning";
}

export type TriageChatTurnSnapshot = {
  messages: ChatMessage[];
  selectedQuickAnswers: SelectedQuickAnswer[];
  apiQuickReplies?: ApiQuickReply[] | null;
  evidenceSources?: TriageEvidenceSource[];
  safetyAlert?: TriageSafetyAlert | null;
  emergencyContact?: EmergencyContact | null;
  wizardStageLabel?: string;
  wizardSymptomId?: string;
  medisearchConversationId?: string | null;
  medicalFollowups?: string[];
  questionReason?: string | null;
  profileContextUsed?: boolean;
  vitalsPrompt?: TriageVitalsPrompt | null;
  guidancePlan?: TriageGuidancePlan | null;
  scanResults?: TriageScanResult[];
  declinedScanTypes?: TriageScanType[];
  acquiredVitals?: TriageVitalValues;
  acquiredVitalEvidence?: AcquiredVitalEvidence;
  readingDisclosure?: string;
  presentationStage?: SymptomAssessmentStageId;
};

export type TriageChatDraft = TriageChatTurnSnapshot & {
  assessmentSessionId?: string;
  backStack?: TriageChatTurnSnapshot[];
  pendingRequest?: boolean;
};

export function stepBackTriageDraft(draft: TriageChatDraft | null): {
  draft: TriageChatDraft;
  presentationStage?: SymptomAssessmentStageId;
} | null {
  const backStack = draft?.backStack ?? [];
  const previous = backStack.at(-1);
  if (!draft || !previous) return null;

  return {
    draft: {
      assessmentSessionId: draft.assessmentSessionId,
      ...previous,
      backStack: backStack.slice(0, -1),
      pendingRequest: false,
    },
    presentationStage: previous.presentationStage,
  };
}

const iconTreatmentByKey: Record<QuickAnswerIcon, { Icon: typeof HeartPulse; accent: VyvaIconAccent }> = {
  heart: { Icon: HeartPulse, accent: "pulse" },
  wind: { Icon: Wind, accent: "signal" },
  thermometer: { Icon: Thermometer, accent: "signal" },
  activity: { Icon: Activity, accent: "trend" },
  alert: { Icon: AlertCircle, accent: "signal" },
  help: { Icon: HelpCircle, accent: "spark" },
  calendar: { Icon: CalendarDays, accent: "calendar" },
  calendar_range: { Icon: CalendarRange, accent: "path" },
  calendar_clock: { Icon: CalendarClock, accent: "calendar" },
  trend_up: { Icon: TrendingUp, accent: "trend" },
  bed: { Icon: BedDouble, accent: "dot" },
  check: { Icon: CircleCheckBig, accent: "check" },
  face: { Icon: ScanFace, accent: "dot" },
};

const answerTone: Record<QuickAnswerTone, { border: string; text: string }> = {
  purple: { border: "#DDD6FE", text: "#332925" },
  red: { border: "#FECACA", text: "#332925" },
  blue: { border: "#BFDBFE", text: "#332925" },
  amber: { border: "#FED7AA", text: "#332925" },
  green: { border: "#BBF7D0", text: "#332925" },
};

const symptomConceptPatterns = [
  { key: "headache", pattern: /\b(headach\w*|migraine\w*)\b/i },
  { key: "pain", pattern: /\b(pain\w*|hurt\w*|ache\w*)\b/i },
  { key: "dizziness", pattern: /\b(dizz\w*|lighthead\w*|vertigo\w*)\b/i },
  { key: "breathing", pattern: /\b(breath\w*|wheez\w*)\b/i },
  { key: "nausea", pattern: /\b(nause\w*|vomit\w*)\b/i },
  { key: "weakness", pattern: /\b(weak\w*|faint\w*)\b/i },
] as const;

function symptomConceptsFor(value: string): Set<string> {
  return new Set(
    symptomConceptPatterns
      .filter(({ pattern }) => pattern.test(value))
      .map(({ key }) => key),
  );
}

function quickAnswerRepeatsInitialSymptom(initialClue: string, answer: QuickAnswer): boolean {
  if (answer.kind !== "symptom") return false;
  const initialConcepts = symptomConceptsFor(initialClue);
  const answerConcepts = symptomConceptsFor(`${answer.label} ${answer.value}`);
  return [...answerConcepts].some((concept) => initialConcepts.has(concept));
}

type BrowserSpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

const speechLangFor = (language: string) => {
  const base = language.split("-")[0];
  const map: Record<string, string> = {
    es: "es-ES",
    en: "en-US",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-PT",
  };
  return map[base] ?? "en-US";
};

function TriageReviewPanel() {
  const { t } = useTranslation();
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const reviewSteps = [
    t("health.symptomCheck.chat.reviewStepMedical", "Reviewing trusted medical guidance"),
    t("health.symptomCheck.chat.reviewStepSafety", "Checking your answers for red flags"),
    t("health.symptomCheck.chat.reviewStepProfile", "Considering your health profile and medications"),
    t("health.symptomCheck.chat.reviewStepNext", "Preparing clear next steps"),
  ];
  const reviewHeadlines = [
    t("health.symptomCheck.chat.reviewTitle", "Checking your next step"),
    ...reviewSteps,
  ];
  const activeHeadline = reviewHeadlines[headlineIndex % reviewHeadlines.length];

  useEffect(() => {
    const timer = setInterval(() => {
      setHeadlineIndex((current) => (current + 1) % reviewHeadlines.length);
    }, 2200);

    return () => clearInterval(timer);
  }, [reviewHeadlines.length]);

  return (
    <section
      className="relative overflow-hidden rounded-[24px] border border-[#C4B5FD] bg-[linear-gradient(135deg,#3B0764_0%,#6B21A8_54%,#8B5CF6_100%)] px-5 py-4 text-white shadow-[0_18px_36px_rgba(91,18,160,0.18)]"
      data-testid="triage-review-panel"
      aria-live="polite"
      aria-label={t("health.symptomCheck.chat.reviewAria", "VYVA is reviewing your answers and preparing guidance")}
    >
      <span className="triage-review-scan absolute left-0 top-0 h-full w-1/3 bg-white/14" aria-hidden="true" />
      <div className="relative flex items-center gap-4">
        <div className="relative flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full border border-white/24 bg-white/14 text-white shadow-[0_12px_26px_rgba(31,15,54,0.18)]">
          <span className="triage-review-pulse absolute inset-[-6px] rounded-full border border-white/22" aria-hidden="true" />
          <Activity size={26} strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.18em] text-white/72">
            {t("health.symptomCheck.chat.reviewEyebrow", "VYVA is reviewing")}
          </p>
          <h2
            className="mt-1 min-h-[58px] font-body text-[22px] font-black leading-tight text-white sm:min-h-[60px] sm:text-[25px]"
            data-testid="triage-review-headline"
          >
            {activeHeadline}
          </h2>
          <div className="mt-2 flex items-center gap-2" aria-hidden="true">
            <span className="triage-review-dot h-2 w-2 rounded-full bg-white/90" />
            <span className="triage-review-dot h-2 w-2 rounded-full bg-white/90 [animation-delay:0.18s]" />
            <span className="triage-review-dot h-2 w-2 rounded-full bg-white/90 [animation-delay:0.36s]" />
            <span className="ml-1 h-px min-w-0 flex-1 bg-white/24" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function TriageChat({
  bpm,
  respiratoryRate = null,
  entryMode,
  initialClue = "",
  healthMemory = null,
  autoStartVoice = false,
  initialDraft = null,
  resumePendingRequest = false,
  language,
  languageReady = true,
  showProgressCard = false,
  presentationStage,
  composerVisibility,
  onStageChange,
  onDraftChange,
  onBackHandlerChange,
  onVitalsScanned,
  onVoiceAutoStarted,
  onComplete,
}: TriageChatProps) {
  const { t } = useTranslation();
  const { language: appLanguage, t: appT } = useLanguage();
  const { isDark } = useHomeMasterTheme();
  const activeLanguage = language ?? appLanguage;
  const hasInitialDraft = Boolean(initialDraft);
  const [assessmentSessionId] = useState(() => initialDraft?.assessmentSessionId
    ?? globalThis.crypto?.randomUUID?.()
    ?? `triage-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialDraft?.messages ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initiated, setInitiated] = useState(() => hasInitialDraft);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [apiQuickReplies, setApiQuickReplies] = useState<ApiQuickReply[] | null>(() => initialDraft?.apiQuickReplies ?? null);
  const [selectedQuickAnswers, setSelectedQuickAnswers] = useState<SelectedQuickAnswer[]>(() => initialDraft?.selectedQuickAnswers ?? []);
  const [evidenceSources, setEvidenceSources] = useState<TriageResponse["evidenceSources"]>(() => initialDraft?.evidenceSources ?? []);
  const [safetyAlert, setSafetyAlert] = useState<TriageResponse["safetyAlert"] | null>(() => initialDraft?.safetyAlert ?? null);
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact | null>(() => initialDraft?.emergencyContact ?? initialDraft?.safetyAlert?.emergencyContact ?? null);
  const [wizardStageLabel, setWizardStageLabel] = useState(() => initialDraft?.wizardStageLabel ?? "");
  const [wizardSymptomId, setWizardSymptomId] = useState(() => initialDraft?.wizardSymptomId ?? "");
  const [medisearchConversationId, setMedisearchConversationId] = useState<string | null>(() => initialDraft?.medisearchConversationId ?? null);
  const [medicalFollowups, setMedicalFollowups] = useState<string[]>(() => initialDraft?.medicalFollowups ?? []);
  const [questionReason, setQuestionReason] = useState<string | null>(() => initialDraft?.questionReason ?? null);
  const [profileContextUsed, setProfileContextUsed] = useState(() => Boolean(initialDraft?.profileContextUsed));
  const [vitalsPrompt, setVitalsPrompt] = useState<TriageVitalsPrompt | null>(() => initialDraft?.vitalsPrompt ?? null);
  const [guidancePlan, setGuidancePlan] = useState<TriageGuidancePlan | null>(() => initialDraft?.guidancePlan ?? null);
  const [scanResults, setScanResults] = useState<TriageScanResult[]>(() => initialDraft?.scanResults ?? []);
  const [declinedScanTypes, setDeclinedScanTypes] = useState<TriageScanType[]>(() => initialDraft?.declinedScanTypes ?? []);
  const [acquiredVitals, setAcquiredVitals] = useState<TriageVitalValues>(() => initialDraft?.acquiredVitals ?? {});
  const [acquiredVitalEvidence, setAcquiredVitalEvidence] = useState<AcquiredVitalEvidence>(() => initialDraft?.acquiredVitalEvidence ?? {});
  const [readingDisclosure, setReadingDisclosure] = useState(() => initialDraft?.readingDisclosure ?? "");
  const [backStack, setBackStack] = useState<TriageChatTurnSnapshot[]>(() => initialDraft?.backStack ?? []);
  const [requestError, setRequestError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestErrorRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<BrowserSpeechRecognition | null>(null);
  const pendingResumeSentRef = useRef(false);
  const lastRequestRef = useRef<PendingTriageRequest | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const backStackRef = useRef(backStack);
  const userMessageCount = messages.filter((msg) => msg.role === "user").length;
  const fallbackQuickAnswers: QuickAnswer[] = userMessageCount === 0
    ? [
        { id: "pain", label: t("health.symptomCheck.chat.quickPain", "Pain"), value: t("health.symptomCheck.chat.quickPainValue", "I have pain."), Icon: HeartPulse, tone: "red", kind: "symptom" },
        { id: "chest", label: t("health.symptomCheck.chat.quickChest", "Chest discomfort"), value: t("health.symptomCheck.chat.quickChestValue", "I have chest discomfort."), Icon: HeartPulse, tone: "red", kind: "symptom" },
        { id: "breathing", label: t("health.symptomCheck.chat.quickBreathing", "Breathing"), value: t("health.symptomCheck.chat.quickBreathingValue", "I feel short of breath."), Icon: Wind, tone: "blue", kind: "symptom" },
        { id: "fever", label: t("health.symptomCheck.chat.quickFever", "Fever"), value: t("health.symptomCheck.chat.quickFeverValue", "I have a fever."), Icon: Thermometer, tone: "amber", kind: "symptom" },
        { id: "tired", label: t("health.symptomCheck.chat.quickTired", "Very tired"), value: t("health.symptomCheck.chat.quickTiredValue", "I feel very tired."), Icon: Activity, tone: "purple", kind: "symptom" },
      ]
    : userMessageCount === 1
      ? [
          { id: "mild", label: t("health.symptomCheck.chat.quickMild", "Mild"), value: t("health.symptomCheck.chat.quickMildValue", "It feels mild."), Icon: Activity, tone: "green", kind: "severity" },
          { id: "moderate", label: t("health.symptomCheck.chat.quickModerate", "Moderate"), value: t("health.symptomCheck.chat.quickModerateValue", "It feels moderate."), Icon: AlertCircle, tone: "amber", kind: "severity" },
          { id: "strong", label: t("health.symptomCheck.chat.quickStrong", "Strong"), value: t("health.symptomCheck.chat.quickStrongValue", "It feels strong."), Icon: HeartPulse, tone: "red", kind: "severity" },
          { id: "not_sure", label: t("health.symptomCheck.chat.quickNotSure", "Not sure"), value: t("health.symptomCheck.chat.quickNotSureValue", "I am not sure."), Icon: HelpCircle, tone: "purple", kind: "uncertain" },
        ]
      : [
          { id: "yes", label: t("health.symptomCheck.chat.quickYes", "Yes"), value: t("health.symptomCheck.chat.quickYesValue", "Yes."), Icon: HeartPulse, tone: "green", kind: "yes_no" },
          { id: "no", label: t("health.symptomCheck.chat.quickNo", "No"), value: t("health.symptomCheck.chat.quickNoValue", "No."), Icon: AlertCircle, tone: "red", kind: "yes_no" },
          { id: "worse", label: t("health.symptomCheck.chat.quickWorse", "Worse"), value: t("health.symptomCheck.chat.quickWorseValue", "It is getting worse."), Icon: Activity, tone: "amber", kind: "trend" },
          { id: "not_sure", label: t("health.symptomCheck.chat.quickNotSure", "Not sure"), value: t("health.symptomCheck.chat.quickNotSureValue", "I am not sure."), Icon: HelpCircle, tone: "purple", kind: "uncertain" },
        ];
  const quickAnswers: QuickAnswer[] = apiQuickReplies?.length
    ? apiQuickReplies.map((reply) => {
        const treatment = iconTreatmentByKey[reply.icon] ?? iconTreatmentByKey.help;
        return {
          id: reply.id,
          label: localizeTriageAnswerLabel(activeLanguage, reply.label),
          value: reply.value,
          Icon: treatment.Icon,
          accent: treatment.accent,
          tone: reply.tone,
          kind: reply.kind ?? reply.id,
        };
      })
    : fallbackQuickAnswers;
  const repeatedInitialSymptomAnswers = presentationStage === "symptom_selection"
    ? quickAnswers.filter((answer) => quickAnswerRepeatsInitialSymptom(initialClue, answer))
    : [];
  const hasRepeatedInitialSymptom = repeatedInitialSymptomAnswers.length > 0;
  const displayedQuickAnswers: QuickAnswer[] = hasRepeatedInitialSymptom
    ? [
        ...quickAnswers.filter((answer) => !repeatedInitialSymptomAnswers.some((repeated) => repeated.id === answer.id)),
        {
          id: "no-additional-symptoms",
          label: t("health.symptomCheck.chat.noAdditionalSymptoms", "Nothing else"),
          value: t("health.symptomCheck.chat.noAdditionalSymptomsValue", "No other symptoms."),
          Icon: CheckCircle,
          tone: "purple",
          kind: "symptom",
        },
      ]
    : quickAnswers;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (presentationStage) {
        const appShell = scrollRef.current?.closest<HTMLElement>('[data-testid="app-shell"]');
        const appScroller = appShell?.querySelector<HTMLElement>('[data-testid="app-shell-scroll"]');
        appScroller?.scrollTo?.({ top: 0, behavior: "auto" });
        document.scrollingElement?.scrollTo?.({ top: 0, behavior: "auto" });
        return;
      }
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        scrollRef.current.scrollIntoView?.({ block: "end", behavior: "smooth" });
      }
    }, 80);
  }, [presentationStage]);

  useEffect(() => {
    if (!requestError) return;
    const timeoutId = window.setTimeout(() => {
      requestErrorRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [requestError]);

  const animateMessage = useCallback(
    (_msgIdx: number, _fullText: string, onDone?: () => void) => {
      scrollToBottom();
      onDone?.();
    },
    [scrollToBottom]
  );

  const startListening = useCallback(() => {
    const speechWindow = window as unknown as SpeechRecognitionWindow;
    const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SR) {
      setVoiceError(t("health.symptomCheck.chat.voiceUnsupported"));
      return;
    }

    try {
      recRef.current?.stop();
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = speechLangFor(activeLanguage);

      rec.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      rec.onresult = (event) => {
        const text = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")
          .trim();
        setInput(text);
      };

      rec.onerror = () => {
        setVoiceError(t("health.symptomCheck.chat.voiceError"));
        setIsListening(false);
        recRef.current = null;
      };

      rec.onend = () => {
        setIsListening(false);
        recRef.current = null;
        inputRef.current?.focus();
      };

      recRef.current = rec;
      rec.start();
    } catch {
      setVoiceError(t("health.symptomCheck.chat.voiceError"));
      setIsListening(false);
      recRef.current = null;
    }
  }, [activeLanguage, t]);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setIsListening(false);
  }, []);

  const sendToApi = useCallback(
    async (
      history: ChatMessage[],
      quickAnswerTrail: SelectedQuickAnswer[] = selectedQuickAnswers,
      nextScanResults: TriageScanResult[] = scanResults,
      nextDeclinedScanTypes: TriageScanType[] = declinedScanTypes,
      vitalsOverride?: TriageVitalValues,
    ) => {
      if (!languageReady) return;
      const recoverPresentationStage = presentationStage;
      lastRequestRef.current = {
        history,
        quickAnswerTrail,
        nextScanResults,
        nextDeclinedScanTypes,
        vitalsOverride,
      };
      setRequestError(null);
      setLoading(true);
      onStageChange?.("checking");
      requestAbortRef.current?.abort();
      const requestController = new AbortController();
      requestAbortRef.current = requestController;
      const requestTimeout = window.setTimeout(() => requestController.abort(), TRIAGE_REQUEST_TIMEOUT_MS);
      try {
        const wizardVitals = {
          ...acquiredVitals,
          ...vitalsOverride,
          bpm: vitalsOverride?.bpm ?? acquiredVitals.bpm ?? bpm,
          respiratoryRate: vitalsOverride?.respiratoryRate ?? acquiredVitals.respiratoryRate ?? respiratoryRate,
        };
        const response = await apiFetch("/api/triage/message", {
          method: "POST",
          signal: requestController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            vitals: wizardVitals,
            locale: activeLanguage,
            wizard: {
              mode: entryMode,
              vitalsScanCompleted: entryMode === "with_vitals" || nextScanResults.some((result) => result.type === "vitals"),
              vitals: wizardVitals,
              vitalsEvidence: {
                ...(typeof wizardVitals.bpm === "number" && !acquiredVitalEvidence.bpm ? { bpm: { source: "phone_estimate", affectsTriage: false } } : {}),
                ...(typeof wizardVitals.respiratoryRate === "number" && !acquiredVitalEvidence.respiratoryRate ? { respiratoryRate: { source: "phone_estimate", affectsTriage: false } } : {}),
                ...acquiredVitalEvidence,
              },
              quickAnswers: quickAnswerTrail,
              scanResults: nextScanResults,
              declinedScanTypes: nextDeclinedScanTypes,
            },
            healthMemory,
            medisearchConversationId,
          }),
        });
        if (!response.ok) throw new Error(`${response.status}`);
        const res = await response.json() as TriageResponse;
        setApiQuickReplies(res.quickReplies?.length ? res.quickReplies : null);
        setSafetyAlert(res.safetyAlert ?? null);
        setEmergencyContact(res.emergencyContact ?? res.safetyAlert?.emergencyContact ?? null);
        if (res.evidenceSources) setEvidenceSources(res.evidenceSources);
        if (res.wizardStageLabel) setWizardStageLabel(res.wizardStageLabel);
        if (res.wizardSymptomId) setWizardSymptomId(res.wizardSymptomId);
        if (res.medisearchConversationId) setMedisearchConversationId(res.medisearchConversationId);
        setQuestionReason(res.questionReason?.trim() || null);
        setProfileContextUsed(Boolean(res.profileContextUsed));
        setVitalsPrompt(res.vitalsPrompt && Array.isArray(res.vitalsPrompt.actions) && res.vitalsPrompt.actions.length ? res.vitalsPrompt : null);
        setGuidancePlan(res.guidancePlan ?? null);
        onStageChange?.(res.guidancePlan?.stage ?? (res.done ? "complete" : "symptom"), Boolean(res.safetyAlert));
        setMedicalFollowups(
          !res.done && !res.safetyAlert && Array.isArray(res.medicalFollowups)
            ? res.medicalFollowups
                .filter((item): item is string => typeof item === "string")
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 3)
            : [],
        );

        const msgIdx = history.length;
        setMessages((prev) => [...prev, { role: "assistant", content: res.content }]);

        const triggerComplete = res.done && res.summary
          ? {
              ...res.summary,
              aiSummary: res.content,
              evidenceSources: res.summary.evidenceSources ?? res.evidenceSources,
              contextConfidence: res.guidancePlan?.confidence,
              contextSignals: res.guidancePlan?.usefulSignals,
              contextBrief: res.guidancePlan
                ? `${res.guidancePlan.protocolLabel}: ${res.guidancePlan.nextQuestionFocus}`
                : undefined,
              refinementContext: {
                messages: history,
                quickAnswers: quickAnswerTrail,
                scanResults: nextScanResults,
                entryMode,
                initialClue,
              },
            }
          : null;

        animateMessage(msgIdx, res.content, () => {
          if (triggerComplete) {
            setTimeout(() => onComplete(triggerComplete), 800);
          }
        });
      } catch {
        if (requestController.signal.aborted && requestAbortRef.current !== requestController) return;
        setMedicalFollowups([]);
        setRequestError(t("health.symptomCheck.chat.errorMsg", "We could not complete that check. Your answers are saved—please try again."));
        onStageChange?.(runtimeStageForPresentation(recoverPresentationStage));
      } finally {
        window.clearTimeout(requestTimeout);
        if (requestAbortRef.current === requestController) {
          requestAbortRef.current = null;
          setLoading(false);
        }
      }
    },
    [acquiredVitalEvidence, acquiredVitals, activeLanguage, animateMessage, bpm, declinedScanTypes, entryMode, healthMemory, initialClue, languageReady, medisearchConversationId, onComplete, onStageChange, presentationStage, respiratoryRate, scanResults, selectedQuickAnswers, t]
  );

  const applyAcquiredReading = useCallback((values: TriageVitalValues, disclosure: string, affectsTriage: boolean, source: VitalsReadingSource) => {
    setReadingDisclosure(affectsTriage ? disclosure : `${disclosure} · Confirm with a device before it changes guidance`);
    setAcquiredVitals((current) => ({ ...current, ...values }));
    setAcquiredVitalEvidence((current) => {
      const next = { ...current };
      for (const key of Object.keys(values) as Array<keyof TriageVitalValues>) {
        if (typeof values[key] === "number") next[key] = { source, affectsTriage };
      }
      return next;
    });
  }, []);

  const createTurnSnapshot = useCallback((): TriageChatTurnSnapshot => ({
    messages,
    selectedQuickAnswers,
    apiQuickReplies,
    evidenceSources,
    safetyAlert,
    emergencyContact,
    wizardStageLabel,
    wizardSymptomId,
    medisearchConversationId,
    medicalFollowups,
    questionReason,
    profileContextUsed,
    vitalsPrompt,
    guidancePlan,
    scanResults,
    declinedScanTypes,
    acquiredVitals,
    acquiredVitalEvidence,
    readingDisclosure,
    presentationStage,
  }), [acquiredVitalEvidence, acquiredVitals, apiQuickReplies, declinedScanTypes, emergencyContact, evidenceSources, guidancePlan, medicalFollowups, medisearchConversationId, messages, presentationStage, profileContextUsed, questionReason, readingDisclosure, safetyAlert, scanResults, selectedQuickAnswers, vitalsPrompt, wizardStageLabel, wizardSymptomId]);

  const replaceBackStack = useCallback((nextBackStack: TriageChatTurnSnapshot[]) => {
    backStackRef.current = nextBackStack;
    setBackStack(nextBackStack);
  }, []);

  const restoreTurnSnapshot = useCallback((snapshot: TriageChatTurnSnapshot) => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    lastRequestRef.current = null;
    setLoading(false);
    setRequestError(null);
    setInput("");
    setMessages(snapshot.messages);
    setSelectedQuickAnswers(snapshot.selectedQuickAnswers);
    setApiQuickReplies(snapshot.apiQuickReplies ?? null);
    setEvidenceSources(snapshot.evidenceSources ?? []);
    setSafetyAlert(snapshot.safetyAlert ?? null);
    setEmergencyContact(snapshot.emergencyContact ?? snapshot.safetyAlert?.emergencyContact ?? null);
    setWizardStageLabel(snapshot.wizardStageLabel ?? "");
    setWizardSymptomId(snapshot.wizardSymptomId ?? "");
    setMedisearchConversationId(snapshot.medisearchConversationId ?? null);
    setMedicalFollowups(snapshot.medicalFollowups ?? []);
    setQuestionReason(snapshot.questionReason ?? null);
    setProfileContextUsed(Boolean(snapshot.profileContextUsed));
    setVitalsPrompt(snapshot.vitalsPrompt ?? null);
    setGuidancePlan(snapshot.guidancePlan ?? null);
    setScanResults(snapshot.scanResults ?? []);
    setDeclinedScanTypes(snapshot.declinedScanTypes ?? []);
    setAcquiredVitals(snapshot.acquiredVitals ?? {});
    setAcquiredVitalEvidence(snapshot.acquiredVitalEvidence ?? {});
    setReadingDisclosure(snapshot.readingDisclosure ?? "");
    onStageChange?.(
      runtimeStageForPresentation(snapshot.presentationStage),
      Boolean(snapshot.safetyAlert),
    );
    scrollToBottom();
  }, [onStageChange, scrollToBottom]);

  const stepBack = useCallback(() => {
    const previous = backStackRef.current.at(-1);
    if (!previous) return false;

    replaceBackStack(backStackRef.current.slice(0, -1));
    restoreTurnSnapshot(previous);
    return true;
  }, [replaceBackStack, restoreTurnSnapshot]);

  useEffect(() => {
    backStackRef.current = backStack;
  }, [backStack]);

  useEffect(() => {
    onBackHandlerChange?.(stepBack);
    return () => onBackHandlerChange?.(null);
  }, [onBackHandlerChange, stepBack]);

  useEffect(() => {
    if (!languageReady) return;
    if (!initiated) {
      setInitiated(true);
      const clue = initialClue.trim();
      if (clue) {
        const initialMessage: ChatMessage = { role: "user", content: clue };
        setMessages([initialMessage]);
        sendToApi([initialMessage]);
      } else {
        sendToApi([]);
      }
    }
  }, [initialClue, initiated, languageReady, sendToApi]);

  useEffect(() => {
    if (!languageReady) return;
    if (!resumePendingRequest || pendingResumeSentRef.current || loading) return;
    pendingResumeSentRef.current = true;
    void sendToApi(messages, selectedQuickAnswers);
  }, [languageReady, loading, messages, resumePendingRequest, selectedQuickAnswers, sendToApi]);

  useEffect(() => {
    onDraftChange?.({
      assessmentSessionId,
      messages,
      selectedQuickAnswers,
      apiQuickReplies,
      evidenceSources,
      safetyAlert,
      emergencyContact,
      wizardStageLabel,
      wizardSymptomId,
      medisearchConversationId,
      medicalFollowups,
      questionReason,
      profileContextUsed,
      vitalsPrompt,
      guidancePlan,
      scanResults,
      declinedScanTypes,
      acquiredVitals,
      acquiredVitalEvidence,
      readingDisclosure,
      presentationStage,
      backStack,
      pendingRequest: loading || (!languageReady && !initiated),
    });
  }, [acquiredVitalEvidence, acquiredVitals, apiQuickReplies, assessmentSessionId, backStack, declinedScanTypes, emergencyContact, evidenceSources, guidancePlan, initiated, languageReady, loading, medicalFollowups, medisearchConversationId, messages, onDraftChange, presentationStage, profileContextUsed, questionReason, readingDisclosure, safetyAlert, scanResults, selectedQuickAnswers, vitalsPrompt, wizardStageLabel, wizardSymptomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      const activeRequest = requestAbortRef.current;
      requestAbortRef.current = null;
      activeRequest?.abort();
    };
  }, []);

  useEffect(() => {
    if (!autoStartVoice || loading || messages.length === 0) return;
    const timer = setTimeout(() => {
      startListening();
      onVoiceAutoStarted?.();
    }, 300);
    return () => clearTimeout(timer);
  }, [autoStartVoice, loading, messages.length, startListening, onVoiceAutoStarted]);

  const sendText = async (rawText: string, quickAnswer?: QuickAnswer) => {
    const text = rawText.trim();
    if (!text || !languageReady || loading) return;
    setInput("");

    if (messages.some((message) => message.role === "assistant")) {
      replaceBackStack([...backStackRef.current, createTurnSnapshot()]);
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    const newHistory = [...messages, userMsg];
    if (quickAnswer?.id === "edit_answers") {
      const retainedAnswers = selectedQuickAnswers.filter((answer) =>
        answer.kind === "symptom" || answer.kind === "red_flag"
      );
      setSelectedQuickAnswers(retainedAnswers);
      setMessages(newHistory);
      scrollToBottom();
      await sendToApi(newHistory, retainedAnswers);
      inputRef.current?.focus();
      return;
    }
    const nextSelectedQuickAnswers = quickAnswer
      ? [...selectedQuickAnswers, { id: quickAnswer.id, label: quickAnswer.label, value: quickAnswer.value, kind: quickAnswer.kind }]
      : selectedQuickAnswers;
    setSelectedQuickAnswers(nextSelectedQuickAnswers);
    setMessages(newHistory);
    scrollToBottom();

    await sendToApi(newHistory, nextSelectedQuickAnswers);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    await sendText(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const latestAssistantEntry = messages
    .map((msg, index) => ({ msg, index }))
    .reverse()
    .find(({ msg }) => msg.role === "assistant");
  const latestQuestion = localizeTriageQuestion(
    activeLanguage,
    latestAssistantEntry
      ? latestAssistantEntry.msg.content
      : t("health.symptomCheck.chat.reviewTitle", "Checking your next step"),
  );
  const showQuestion = Boolean(latestAssistantEntry || !loading || presentationStage === "checking");
  const waitingForLanguage = !languageReady && !initiated;
  const canAnswer = languageReady && !loading && messages.length > 0;
  const canShowMedicalFollowups = canAnswer && !safetyAlert && medicalFollowups.length > 0;
  const scanOffer = selectTriageScanOffer({
    selectedAnswers: selectedQuickAnswers,
    symptomId: wizardSymptomId,
    scanResults,
    declinedScanTypes,
    safetyAlertActive: Boolean(safetyAlert),
    loading,
    localize: appT,
  });
  const answeredCount = selectedQuickAnswers.length;
  const questionNumber = answeredCount + 1;
  const visibleQuickAnswers = displayedQuickAnswers.slice(0, 4);
  const extraQuickAnswers = displayedQuickAnswers.slice(4);
  const guidanceConfidenceScore = guidancePlan?.confidence?.score;
  const confidenceSignals = typeof guidanceConfidenceScore === "number"
    ? Math.min(5, Math.max(1, guidanceConfidenceScore))
    : Math.min(5, Math.max(2, answeredCount + 2));
  const confidencePercent = confidenceSignals * 20;
  const confidenceValue = `${confidenceSignals}/5`;
  const confidenceLevel = guidancePlan?.confidence?.label ?? (answeredCount >= 3
    ? t("health.symptomCheck.tracker.high", "High")
    : answeredCount > 0
      ? t("health.symptomCheck.tracker.medium", "Medium")
      : t("health.symptomCheck.tracker.low", "Low"));
  const confidenceStatus = answeredCount >= 3
    ? t("health.symptomCheck.tracker.ready", "Ready to guide")
    : answeredCount > 0
      ? t("health.symptomCheck.tracker.building", "Confidence improving")
      : t("health.symptomCheck.tracker.starting", "Getting started");
  const confidenceStageIndex = answeredCount >= 3 ? 2 : answeredCount > 0 ? 1 : 0;
  const confidenceStages = [
    { key: "symptoms", label: t("health.symptomCheck.tracker.listen", "Symptoms"), Icon: ListChecks },
    { key: "safety", label: t("health.symptomCheck.tracker.check", "Safety check"), Icon: Activity },
    { key: "next", label: t("health.symptomCheck.tracker.nextStep", "Next step"), Icon: CheckCircle },
  ];
  const smartBriefItems = guidancePlan
    ? [
        guidancePlan.protocolLabel,
        ...guidancePlan.confidence.reasons,
      ].filter(Boolean).slice(0, 3)
    : [
        healthMemory?.conditions ? t("health.symptomCheck.chat.briefProfile", "health profile") : "",
        healthMemory?.medications ? t("health.symptomCheck.chat.briefMeds", "medications") : "",
        healthMemory?.latestVitals || healthMemory?.vitalsTrend ? t("health.symptomCheck.chat.briefVitals", "recent vitals") : "",
      ].filter(Boolean).slice(0, 3);
  const readoutText = [
    latestQuestion,
    visibleQuickAnswers.length
      ? t("health.symptomCheck.chat.readoutChoices", "Choices: {{choices}}", { choices: visibleQuickAnswers.map((answer) => answer.label).join(". ") })
      : "",
  ].filter(Boolean).join(" ");
  const initialSymptomConcepts = symptomConceptsFor(initialClue);
  const additionalSymptomLabels = selectedQuickAnswers
    .filter((answer) => answer.kind === "symptom" && answer.id !== "no-additional-symptoms")
    .filter((answer) => {
      const answerConcepts = symptomConceptsFor(`${answer.label} ${answer.value}`);
      return ![...answerConcepts].some((concept) => initialSymptomConcepts.has(concept));
    })
    .map((answer) => answer.label);
  const symptomSummary = [initialClue.trim(), ...additionalSymptomLabels].filter(Boolean).join("; ");
  const reviewLabelByKind: Record<string, string> = {
    location: t("health.symptomCheck.chat.reviewLocation", "Location"),
    severity: t("health.symptomCheck.chat.reviewSeverity", "Severity"),
    duration: t("health.symptomCheck.chat.reviewOnset", "When it started"),
    trend: t("health.symptomCheck.chat.reviewRelatedDetail", "Related detail"),
  };
  const reviewAnswerLabelById: Record<string, string> = {
    today: t("health.symptomCheck.chat.reviewAnswerToday", "Started today"),
    few_days: t("health.symptomCheck.chat.reviewAnswerFewDays", "Few days"),
    week_plus: t("health.symptomCheck.chat.reviewAnswerWeekPlus", "Longer than a few days"),
    not_sure: t("health.symptomCheck.chat.reviewAnswerNotSure", "I am not sure"),
    after_medicine_surgery_fall: t(
      "health.symptomCheck.chat.reviewAnswerAfterCare",
      "It started after medicine, surgery, hospital, or a fall",
    ),
  };
  const canonicalReviewItems = [
    ...(symptomSummary
      ? [{ label: t("health.symptomCheck.chat.reviewSymptom", "Symptom"), value: symptomSummary }]
      : []),
    ...selectedQuickAnswers
      .filter((answer) => reviewLabelByKind[answer.kind])
      .slice(-4)
      .map((answer) => ({
        label: reviewLabelByKind[answer.kind],
        value: reviewAnswerLabelById[answer.id]
          ?? localizeTriageAnswerLabel(activeLanguage, answer.label),
      })),
  ];
  const usesNumericSeverityScale = presentationStage === "severity"
    && isNumericSeverityScaleChoices(displayedQuickAnswers);
  const usesRuntimeQuestion = presentationStage !== undefined && [
    "safety_check",
    "symptom_selection",
    "severity",
    "onset",
    "review",
  ].includes(presentationStage);
  const canonicalSceneControls = usesNumericSeverityScale && canAnswer ? (
    <div data-testid="triage-quick-answers">
      <SeverityScaleControl
        choices={displayedQuickAnswers}
        onSubmit={(choice) => {
          const quickAnswer = displayedQuickAnswers.find((answer) => answer.id === choice.id);
          if (quickAnswer) void sendText(quickAnswer.value, quickAnswer);
        }}
        continueLabel={t("health.symptomCheck.chat.continue", "Continue")}
        minimumLabel={t("health.symptomCheck.chat.severityNone", "None")}
        maximumLabel={t("health.symptomCheck.chat.severityWorst", "Worst imaginable")}
      />
    </div>
  ) : presentationStage && canAnswer ? (
    <div data-testid="triage-quick-answers">
      <div
        className={
          presentationStage === "review"
            ? "grid grid-cols-2 gap-[10px]"
            : "grid gap-[10px]"
        }
      >
        {displayedQuickAnswers.map((quickAnswer) => {
          const { id, label, value, Icon, accent } = quickAnswer;
          const isSafetyChoice = presentationStage === "safety_check";
          const isReviewAction = presentationStage === "review";
          const reviewActionLabel = id === "edit_answers" || id === "change"
            ? t("health.symptomCheck.chat.reviewEdit", "Edit")
            : id === "confirm_review" || id === "confirm"
              ? t("health.symptomCheck.chat.reviewShowGuidance", "Yes, show my guidance")
              : label;

          if (isSafetyChoice) {
            return (
              <SymptomSafetyChoiceCard
                key={id}
                Icon={Icon}
                label={label}
                tone={safetyToneForQuickAnswer(quickAnswer)}
                accent={quickAnswer.tone === "red" ? "signal" : quickAnswer.tone === "green" ? "check" : accent ?? "dot"}
                onClick={() => void sendText(value, quickAnswer)}
              />
            );
          }

          if (!isReviewAction) {
            return (
              <SymptomChoiceCard
                key={id}
                Icon={Icon}
                accent={accent ?? "dot"}
                label={label}
                onClick={() => void sendText(value, quickAnswer)}
              />
            );
          }

          return (
            <button
              type="button"
              key={id}
              onClick={() => void sendText(value, quickAnswer)}
              className={`vyva-tap flex min-h-[54px] items-center justify-center rounded-full border px-3 text-center text-[14px] font-black transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8B5CF6]/30 ${isDark ? "border-white/[0.18] bg-[#352842] text-[#FFF8FF] hover:border-[#8B5CF6]/55 hover:bg-[#45325E]" : "border-[#D9CFE0] bg-white text-[#241238] hover:border-[#BFA2D8]"}`}
            >
              <span>{reviewActionLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  const handleSkipScan = (type: TriageScanType) => {
    setDeclinedScanTypes((current) => current.includes(type) ? current : [...current, type]);
  };

  const continueAfterVitals = async () => {
    setVitalsPrompt(null);
    await sendToApi(messages, selectedQuickAnswers, scanResults, declinedScanTypes, acquiredVitals);
  };

  const skipContextualVitals = async () => {
    const nextDeclinedScanTypes = declinedScanTypes.includes("vitals")
      ? declinedScanTypes
      : [...declinedScanTypes, "vitals" as const];
    setDeclinedScanTypes(nextDeclinedScanTypes);
    setVitalsPrompt(null);
    await sendToApi(messages, selectedQuickAnswers, scanResults, nextDeclinedScanTypes, acquiredVitals);
  };

  const handleAcceptScan = async (result: TriageScanResult) => {
    const nextScanResults = [
      ...scanResults.filter((scan) => scan.type !== result.type),
      result,
    ];
    const nextDeclinedScanTypes = declinedScanTypes.filter((type) => type !== result.type);
    setScanResults(nextScanResults);
    setDeclinedScanTypes(nextDeclinedScanTypes);
    const vitalsOverride = result.type === "vitals"
      ? { bpm: result.values?.pulseBpm ?? bpm, respiratoryRate: result.values?.respiratoryRate ?? respiratoryRate }
      : undefined;
    await sendToApi(messages, selectedQuickAnswers, nextScanResults, nextDeclinedScanTypes, vitalsOverride);
  };

  return (
    <div className="symptom-canonical-triage flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className={presentationStage
          ? requestError
            ? "pb-[calc(18rem+env(safe-area-inset-bottom))] pt-4"
            : "pb-[calc(11rem+env(safe-area-inset-bottom))] pt-4"
          : "px-4 py-4"}
      >
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
          {showProgressCard ? (
            <HealthWizardCard
              tone="soft"
              className="overflow-hidden border-[#D8C7FF] bg-white p-0 shadow-[0_18px_42px_rgba(63,45,35,0.10)]"
              testId="triage-confidence-tracker"
            >
              <div className="grid gap-4 bg-[linear-gradient(135deg,#FFFFFF_0%,#F7F1FF_58%,#FFF8EA_100%)] p-4 sm:grid-cols-[112px_minmax(0,1fr)]">
                <div
                  role="meter"
                  aria-label={t("health.symptomCheck.tracker.label", "Confidence level")}
                  aria-valuemin={1}
                  aria-valuemax={5}
                  aria-valuenow={confidenceSignals}
                  aria-valuetext={`${confidenceLevel} ${confidenceValue}`}
                  className="relative mx-auto grid h-[112px] w-[112px] place-items-center rounded-full p-2 shadow-[0_18px_32px_rgba(107,33,168,0.18)] sm:mx-0"
                  style={{ background: `conic-gradient(#6B21A8 0 ${confidencePercent}%, #E8DED4 ${confidencePercent}% 100%)` }}
                >
                  <span className="grid h-full w-full place-items-center rounded-full bg-white text-center">
                    <Activity className={!loading ? "h-7 w-7 text-vyva-purple motion-safe:animate-pulse" : "h-7 w-7 text-vyva-purple"} />
                    <span className="mt-1 block font-body text-[25px] font-black leading-none text-vyva-purple">
                      {confidenceValue}
                    </span>
                    <span className="mt-0.5 block font-body text-[10px] font-black uppercase tracking-[0.1em] text-vyva-text-3">
                      {t("health.symptomCheck.tracker.shortLabel", "Confidence")}
                    </span>
                  </span>
                  <span className="absolute right-1 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#34D399] ring-4 ring-white">
                    <span className="h-2.5 w-2.5 rounded-full bg-white motion-safe:animate-pulse" />
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex h-full flex-col justify-center gap-3">
                    <div className="min-w-0">
                      <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                        {t("health.symptomCheck.tracker.label", "Confidence level")}
                      </p>
                      <p className="mt-1 font-body text-[24px] font-black leading-tight text-vyva-text-1">
                        {confidenceStatus}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#ECFDF5] px-3 py-1.5 font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#047857] shadow-[0_5px_14px_rgba(4,120,87,0.10)]">
                        {confidenceLevel}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-black text-vyva-purple shadow-sm">
                        {wizardStageLabel || t("health.symptomCheck.chat.currentQuestion", "Current question")}
                      </span>
                    </div>
                    <p className="font-body text-[15px] font-bold leading-snug text-vyva-text-2">
                      <span className="text-vyva-text-1">
                        {t("health.symptomCheck.chat.oneQuestion", "One question at a time")}
                      </span>
                      {" - "}
                      {answeredCount > 0
                        ? t("health.symptomCheck.chat.answersSaved", "{{count}} answers saved", { count: answeredCount })
                        : t("health.symptomCheck.chat.startAnswering", "Choose the closest answer, or type in your own words.")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#EEE4DA] bg-[#FFFCF8] p-3">
                <div
                  className="grid grid-cols-3 gap-2"
                  aria-label={t("health.symptomCheck.tracker.label", "Confidence level")}
                  data-testid="triage-confidence-signals"
                >
                  {confidenceStages.map(({ key, label, Icon }, index) => {
                    const isComplete = index < confidenceStageIndex;
                    const isActive = index === confidenceStageIndex;
                    const stateLabel = isComplete
                      ? t("health.symptomCheck.tracker.complete", "Done")
                      : isActive
                        ? t("health.symptomCheck.tracker.current", "Now")
                        : t("health.symptomCheck.tracker.waiting", "Next");
                    const tileClass = isActive
                      ? "border-vyva-purple bg-white text-vyva-purple shadow-[0_8px_18px_rgba(107,33,168,0.12)]"
                      : isComplete
                        ? "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"
                        : "border-[#E8DED4] bg-white/70 text-vyva-text-2";
                    const iconClass = isActive
                      ? "bg-vyva-purple text-white"
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
                          <Icon className="h-[18px] w-[18px]" />
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
                <div className="mt-3 rounded-[18px] border border-[#E8DED4] bg-white px-3 py-3" data-testid="smart-check-brief">
                  <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-purple">
                    {t("health.symptomCheck.chat.smartBriefTitle", "Smart check brief")}
                  </p>
                  <p className="mt-1 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
                    {smartBriefItems.length
                      ? t("health.symptomCheck.chat.smartBriefWithContext", "VYVA is using {{items}} to choose safer questions.", { items: smartBriefItems.join(", ") })
                      : t("health.symptomCheck.chat.smartBriefNoContext", "VYVA will start with your words and add context as you answer.")}
                  </p>
                  {guidancePlan?.confidence.missing.length ? (
                    <p className="mt-2 font-body text-[13px] font-bold leading-snug text-vyva-text-3">
                      {t("health.symptomCheck.chat.smartBriefMissing", "Helpful later: {{items}}", { items: guidancePlan.confidence.missing.join(", ") })}
                    </p>
                  ) : null}
                </div>
              </div>
            </HealthWizardCard>
          ) : null}

          {safetyAlert && presentationStage === "urgent_escalation" ? (
            <SymptomAssessmentPresentation
              stageId="urgent_escalation"
              modality="touch"
              showHeader={false}
              title={t("health.symptomCheck.chat.urgentTitle", "Get urgent help now")}
              helper={t(
                "health.symptomCheck.chat.urgentHelper",
                "Call emergency services now. Do not wait for an online assessment.",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  if (emergencyContact?.telHref) window.location.href = emergencyContact.telHref;
                }}
                disabled={!emergencyContact?.telHref}
                className="vyva-tap flex min-h-[58px] w-full items-center gap-3 rounded-[8px] border border-[#DED3E2] bg-white px-[14px] py-3 text-left text-[15px] font-black text-[#241238]"
              >
                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[8px] bg-[#FFF0EF] text-[#D94C48]">
                  <PhoneCall size={19} />
                </span>
                <span>
                  {emergencyContact?.telHref
                    ? t("health.symptomCheck.chat.callEmergencyNumber", "Call {{number}}", { number: emergencyContact.label })
                    : t("health.symptomCheck.chat.contactEmergency", "Contact emergency services")}
                </span>
              </button>
            </SymptomAssessmentPresentation>
          ) : safetyAlert && (
            <HealthWizardHero
              tone="red"
              className="motion-safe:animate-pulse"
              icon={<AlertCircle size={28} />}
              title={t("health.symptomCheck.chat.emergencyTitle", "Emergency warning")}
              body={safetyAlert.recommendation}
            >
              <button
                type="button"
                onClick={() => {
                  if (emergencyContact?.telHref) {
                    window.location.href = emergencyContact.telHref;
                  }
                }}
                disabled={!emergencyContact?.telHref}
                className="vyva-tap inline-flex min-h-[66px] w-full items-center justify-center gap-3 rounded-[22px] bg-[#DC2626] px-5 font-body text-[19px] font-black text-white shadow-[0_10px_24px_rgba(127,29,29,0.24)]"
              >
                <PhoneCall size={22} />
                {emergencyContact?.telHref
                  ? t("health.symptomCheck.chat.callEmergencyNumber", "Call {{number}}", { number: emergencyContact.label })
                  : t("health.symptomCheck.chat.contactEmergency", "Contact emergency services")}
              </button>
            </HealthWizardHero>
          )}

          {showQuestion && presentationStage ? (
            presentationStage !== "urgent_escalation" ? (
              <SymptomAssessmentPresentation
                stageId={presentationStage}
                modality="touch"
                showHeader={false}
                title={presentationStage === "symptom_selection" && hasRepeatedInitialSymptom
                  ? t("health.symptomCheck.chat.anythingElse", "Anything else?")
                  : presentationStage === "review"
                    ? t("health.symptomCheck.chat.reviewConfirmTitle", "Does this look right?")
                    : presentationStage === "related_details"
                      ? t("health.symptomCheck.chat.relatedDetailsTitle", "One more detail")
                  : usesRuntimeQuestion
                    ? latestQuestion.trim() || undefined
                    : undefined}
                helper={presentationStage === "related_details"
                  ? t("health.symptomCheck.chat.relatedDetailsHelper", "Choose the pattern that fits best.")
                  : usesRuntimeQuestion && !usesNumericSeverityScale
                    ? ""
                    : undefined}
                reviewItems={canonicalReviewItems}
              >
                {canonicalSceneControls}
              </SymptomAssessmentPresentation>
            ) : null
          ) : showQuestion && (
            <HealthWizardCard className="overflow-hidden border-[#D8C7FF] bg-[linear-gradient(135deg,#FFFFFF_0%,#FBFAFF_54%,#FFF8EA_100%)] px-5 py-5 shadow-[0_18px_44px_rgba(107,33,168,0.12)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-body text-[13px] font-black text-vyva-purple shadow-sm">
                    <Brain className="h-4 w-4" />
                    <span data-testid="triage-question-progress">
                      {t("health.symptomCheck.chat.questionCount", "Question {{count}}", { count: questionNumber })}
                    </span>
                  </span>
                  {guidancePlan ? (
                    <span
                      data-testid="triage-guidance-confidence"
                      className="rounded-full border border-[#BBF7D0] bg-[#ECFDF5] px-3 py-1.5 font-body text-[12px] font-black leading-none text-[#047857]"
                    >
                      {guidancePlan.confidence.label} - {guidancePlan.confidence.score}/5
                    </span>
                  ) : null}
                </div>
                <ListenButton
                  text={readoutText}
                  language={activeLanguage}
                  label={t("health.symptomCheck.chat.playQuestion", "Play question")}
                  stopLabel={t("health.symptomCheck.chat.stopQuestion", "Stop")}
                  className="min-h-[42px] px-3 text-[13px]"
                />
              </div>
              <h2 className={`font-body text-[30px] font-black leading-[1.12] sm:text-[36px] ${safetyAlert ? "motion-safe:animate-pulse text-[#B91C1C]" : "text-vyva-text-1"}`}>
                {latestQuestion}
              </h2>
              {guidancePlan ? (
                <p data-testid="triage-guidance-focus" className="mt-4 rounded-[18px] border border-[#E8DED4] bg-white/78 px-4 py-3 font-body text-[15px] font-bold leading-snug text-vyva-text-2">
                  {guidancePlan.priorityLabel ? (
                    <>
                      <span className="font-black text-vyva-purple">{guidancePlan.priorityLabel}:</span>{" "}
                    </>
                  ) : null}
                  {guidancePlan.protocolLabel}
                </p>
              ) : null}
            </HealthWizardCard>
          )}

          {requestError ? (
            <section
              ref={requestErrorRef}
              role="alert"
              data-testid="triage-request-error"
              className={`mx-auto w-full max-w-[520px] scroll-mb-[calc(9rem+env(safe-area-inset-bottom))] rounded-[20px] border px-4 py-4 shadow-[0_12px_28px_rgba(0,0,0,0.12)] ${isDark ? "border-[#F8AE1B]/35 bg-[#382D24] text-[#FFF1C8]" : "border-[#E8CF9D] bg-[#FFFCF5] text-[#5F3A00]"}`}
            >
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${isDark ? "bg-[#52402A]" : "bg-[#FFF5DD]"}`}>
                  <AlertCircle size={20} strokeWidth={2.5} className="text-[#F8AE1B]" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[15px] font-black leading-snug">{requestError}</p>
                  <button
                    type="button"
                    className={`vyva-tap mt-3 min-h-[46px] w-full rounded-full border px-5 font-body text-[14px] font-black sm:w-auto ${isDark ? "border-[#F8AE1B]/50 bg-[#2B211A] text-[#FFD98A]" : "border-[#D6AE5B] bg-white text-[#7A4A00]"}`}
                    onClick={() => {
                      const pending = lastRequestRef.current;
                      if (!pending) return;
                      void sendToApi(
                        pending.history,
                        pending.quickAnswerTrail,
                        pending.nextScanResults,
                        pending.nextDeclinedScanTypes,
                        pending.vitalsOverride,
                      );
                    }}
                  >
                    {t("health.symptomCheck.chat.retry", "Try again")}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {(loading || waitingForLanguage) && presentationStage !== "checking" && (
            <TriageReviewPanel />
          )}

          {evidenceSources && evidenceSources.length > 0 && (
            <details
              data-testid="triage-evidence-details"
              className="group rounded-[22px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-blue-900 shadow-[0_8px_20px_rgba(29,78,216,0.06)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="font-body text-[15px] font-black text-blue-900">
                  {t("health.symptomCheck.chat.evidence", "Evidence checked")}
                </span>
                <ChevronDown size={18} className="flex-shrink-0 text-blue-700 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 border-t border-[#BFDBFE] pt-3 font-body text-[16px] font-bold leading-snug text-blue-900">
                {evidenceSources.slice(0, 2).map((source) => source.title).filter(Boolean).join(" - ")}
              </p>
            </details>
          )}

          {canAnswer && scanOffer && !vitalsPrompt && (
            <details
              data-testid="triage-optional-scan"
              className={`group mx-auto w-full max-w-[520px] rounded-[22px] border shadow-[0_8px_22px_rgba(0,0,0,0.10)] ${isDark ? "border-white/[0.13] bg-[#352842]" : "border-[#DDD6FE] bg-white"}`}
            >
              <summary className="vyva-tap flex min-h-[64px] cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7024C4] focus-visible:ring-offset-2">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F3E8FF] text-vyva-purple">
                  <Activity size={20} strokeWidth={2.7} aria-hidden="true" />
                </span>
                <span className={`min-w-0 flex-1 text-left font-body text-[16px] font-black ${isDark ? "text-[#FFF8FF]" : "text-vyva-text-1"}`}>
                  {scanOffer.type === "vitals"
                    ? t("health.symptomCheck.chat.addQuickReading", "Add a quick reading")
                    : t("health.symptomCheck.chat.addPhoto", "Add a photo")}
                </span>
                <span className={`rounded-full px-2.5 py-1 font-body text-[11px] font-black uppercase tracking-[0.08em] ${isDark ? "bg-[#45325E] text-[#D4B5FF]" : "bg-[#F5F3FF] text-vyva-purple"}`}>
                  {t("health.symptomCheck.chat.optional", "Optional")}
                </span>
                <ChevronDown size={18} className="flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-180" />
              </summary>
              <div className={`border-t p-4 ${isDark ? "border-white/[0.12]" : "border-[#EEE7F3]"}`}>
                <TriageScanCard
                  offer={scanOffer}
                  language={activeLanguage}
                  onAccepted={(result) => void handleAcceptScan(result)}
                  onSkip={handleSkipScan}
                  onVitalsCaptured={onVitalsScanned}
                />
              </div>
            </details>
          )}

          {canAnswer && !presentationStage && (
            <div className="grid gap-3 rounded-[28px] border border-[#E8DED4] bg-white/88 p-3 shadow-[0_12px_30px_rgba(63,45,35,0.06)]" data-testid="triage-quick-answers">
              <div className="flex items-center gap-2 px-2 font-body text-[15px] font-black text-vyva-text-2">
                <CheckCircle className="h-4 w-4 text-teal-700" />
                {t("health.symptomCheck.chat.chooseClosest", "Choose the closest answer")}
              </div>
              {visibleQuickAnswers.map((quickAnswer) => {
                const { label, value, Icon } = quickAnswer;
                return (
                  <HealthWizardChoiceTile
                    key={label}
                    onClick={() => void sendText(value, quickAnswer)}
                    icon={<Icon size={24} />}
                    title={label}
                    className="min-h-[76px] rounded-[22px] hover:border-vyva-purple hover:shadow-[0_12px_24px_rgba(107,33,168,0.10)]"
                  />
                );
              })}
              {extraQuickAnswers.length ? (
                <details
                  data-testid="triage-more-choices"
                  className="group rounded-[22px] border border-[#E8DED4] bg-white p-3 shadow-[0_8px_20px_rgba(63,45,35,0.05)]"
                >
                  <summary className="flex min-h-[54px] cursor-pointer list-none items-center justify-between gap-3 px-1">
                    <span className="font-body text-[16px] font-black text-vyva-purple">
                      {t("health.symptomCheck.chat.moreChoices", "More choices")}
                    </span>
                    <ChevronDown size={18} className="flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 grid gap-3 border-t border-[#EADFD5] pt-3">
                    {extraQuickAnswers.map((quickAnswer) => {
                      const { label, value, Icon } = quickAnswer;
                      return (
                        <HealthWizardChoiceTile
                          key={label}
                          onClick={() => void sendText(value, quickAnswer)}
                          icon={<Icon size={24} />}
                          title={label}
                          className="min-h-[76px] rounded-[22px] hover:border-vyva-purple hover:shadow-[0_12px_24px_rgba(107,33,168,0.10)]"
                        />
                      );
                    })}
                  </div>
                </details>
              ) : null}
            </div>
          )}

          {canAnswer && vitalsPrompt ? (
            <section
              data-testid="triage-contextual-vitals-prompt"
              aria-labelledby="triage-vitals-heading"
              className={`mx-auto w-full max-w-[560px] overflow-hidden rounded-[28px] border shadow-[0_18px_42px_rgba(63,45,35,0.10)] ${isDark ? "border-white/[0.14] bg-[#2B2035]" : "border-[#D8C7FF] bg-white"}`}
            >
              <div className={`px-5 pb-4 pt-5 text-center sm:px-6 ${isDark ? "bg-[#352842]" : "bg-[linear-gradient(135deg,#FFFFFF_0%,#F7F1FF_100%)]"}`}>
                <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-[17px] ${isDark ? "bg-[#45325E]" : "bg-[#F3E8FF]"}`}>
                  <Activity size={23} strokeWidth={2.7} className="text-vyva-purple" aria-hidden="true" />
                </span>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <h2 id="triage-vitals-heading" className={`font-body text-[22px] font-black leading-tight ${isDark ? "text-[#FFF8FF]" : "text-vyva-text-1"}`}>
                    {t("health.symptomCheck.chat.vitalsCheckpointTitle", "A reading could improve your result")}
                  </h2>
                  <span className={`rounded-full px-2.5 py-1 font-body text-[10px] font-black uppercase tracking-[0.08em] ${isDark ? "bg-[#45325E] text-[#D4B5FF]" : "bg-white text-vyva-purple"}`}>
                    {t("health.symptomCheck.chat.optional", "Optional")}
                  </span>
                </div>
                <p className={`mt-2 font-body text-[16px] font-black leading-snug ${isDark ? "text-[#F4ECFA]" : "text-vyva-text-1"}`}>
                  {vitalsPrompt.title}
                </p>
                {vitalsPrompt.body ? (
                  <p className={`mx-auto mt-1.5 max-w-[440px] font-body text-[13px] font-semibold leading-relaxed ${isDark ? "text-[#D2C6DC]" : "text-vyva-text-2"}`}>
                    {vitalsPrompt.body}
                  </p>
                ) : null}
                {vitalsPrompt.deviceAccess?.status === "connected" ? (
                  <p className={`mx-auto mt-3 max-w-[440px] rounded-[14px] px-3 py-2 font-body text-[13px] font-black ${isDark ? "bg-[#173C32] text-[#A7F3D0]" : "bg-[#ECFDF5] text-[#047857]"}`} data-testid="triage-connected-vitals-message">
                    {t("health.symptomCheck.chat.connectedVitalsReady", "A connected device is available. VYVA can use its current reading directly.")}
                  </p>
                ) : null}
                {vitalsPrompt.actions.some((action) => action.id === "pulse") ? (
                <div
                  className={`mx-auto mt-3 flex max-w-[440px] items-start gap-2 rounded-[14px] px-3 py-2.5 text-left ${isDark ? "bg-[#45325E] text-[#F4ECFA]" : "bg-white text-vyva-text-2"}`}
                  data-testid="triage-camera-vitals-reminder"
                >
                  <Camera size={18} className="mt-0.5 shrink-0 text-vyva-purple" aria-hidden="true" />
                  <p className="font-body text-[13px] font-bold leading-snug">
                    {t("health.symptomCheck.chat.cameraVitalsReminder", "Your phone camera can estimate your heart rate and breathing rate—no extra device needed.")}
                  </p>
                </div>
                ) : null}
                {readingDisclosure ? <p className="mt-2 rounded-[14px] bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]" data-testid="triage-reading-disclosure">{readingDisclosure}</p> : null}
              </div>
              <VitalsAcquisitionPanel
                actions={vitalsPrompt.actions}
                assessmentSessionId={assessmentSessionId}
                disabled={!canAnswer}
                onApply={applyAcquiredReading}
              />
              <div className={`grid gap-2 border-t px-4 pb-4 pt-3 sm:grid-cols-2 ${isDark ? "border-white/[0.12]" : "border-[#EEE7F3]"}`}>
                {readingDisclosure ? (
                  <button type="button" onClick={() => void continueAfterVitals()} disabled={!canAnswer} data-testid="button-triage-vitals-continue" className="vyva-tap min-h-[52px] rounded-full bg-vyva-purple px-5 font-body text-[15px] font-black text-white disabled:opacity-55">
                    {t("common.continue", "Continue")}
                  </button>
                ) : null}
                <button type="button" onClick={() => void skipContextualVitals()} disabled={!canAnswer} data-testid="button-triage-vitals-skip" className={`vyva-tap min-h-[52px] rounded-full border px-5 font-body text-[14px] font-black disabled:opacity-55 ${isDark ? "border-white/[0.16] bg-[#352842] text-[#F4ECFA]" : "border-[#D9CFE0] bg-white text-[#5B4B63]"}`}>
                  {t("health.symptomCheck.chat.cannotMeasure", "I can’t measure this")}
                </button>
              </div>
            </section>
          ) : null}

          {canShowMedicalFollowups && (
            <details
              data-testid="triage-medical-followups"
              className="group rounded-[24px] border border-[#DDD6FE] bg-[#F5F3FF] p-4 shadow-[0_8px_22px_rgba(107,33,168,0.08)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-vyva-purple shadow-[0_6px_16px_rgba(107,33,168,0.10)]">
                  <BookOpenCheck size={21} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                    {t("health.symptomCheck.chat.followupTitle", "Useful follow-up questions")}
                  </p>
                  <p className="font-body text-[16px] font-bold leading-snug text-vyva-text-2">
                    {t("health.symptomCheck.chat.followupSub", "Tap one if it matches what you want to ask next.")}
                  </p>
                </div>
                <ChevronDown size={18} className="flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4 grid gap-2 border-t border-[#DDD6FE] pt-4">
                {medicalFollowups.map((question, index) => (
                  <button
                    key={`${question}-${index}`}
                    type="button"
                    onClick={() => void sendText(question)}
                    data-testid={`triage-medical-followup-${index}`}
                    className="vyva-tap flex min-h-[64px] items-center justify-between gap-3 rounded-[20px] border border-[#DDD6FE] bg-white px-4 py-3 text-left font-body text-[17px] font-black leading-snug text-vyva-text-1 shadow-[0_8px_20px_rgba(107,33,168,0.07)]"
                  >
                    <span>{question}</span>
                    <Send size={18} className="flex-shrink-0 text-vyva-purple" />
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {(composerVisibility ? composerVisibility === "visible" : !presentationStage) ? <div
        className="symptom-canonical-composer px-4 pb-3 pt-2"
        style={{
          background: isDark
            ? "linear-gradient(180deg, rgba(18,11,35,0) 0%, #120B23 28%)"
            : "linear-gradient(180deg, rgba(250,247,243,0) 0%, hsl(var(--vyva-bg)) 28%)",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2">
          {voiceError && (
            <p className="text-center font-body text-[14px] font-semibold" style={{ color: "#B91C1C" }}>
              {voiceError}
            </p>
          )}
          {isListening && (
            <p className="text-center font-body text-[14px] font-extrabold" style={{ color: "hsl(var(--vyva-purple))" }}>
              {t("health.symptomCheck.chat.listening")}
            </p>
          )}
          <div className={`flex items-center gap-1.5 rounded-[30px] border p-2 shadow-[0_14px_34px_rgba(0,0,0,0.12)] sm:gap-3 ${isDark ? "border-white/[0.13] bg-[#352842]" : "border-[#E8DED4] bg-white"}`}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!languageReady || loading}
              placeholder={t("health.symptomCheck.chat.placeholder")}
              data-testid="input-triage-message"
              className={`min-w-0 flex-1 rounded-full px-3 py-[15px] font-body text-[17px] font-bold outline-none sm:px-4 sm:py-[16px] sm:text-[20px] ${isDark ? "text-[#FFF8FF] placeholder:text-[#AA9DB7]" : "text-vyva-text-1 placeholder:text-[#9A8C83]"}`}
              style={{
                background: "transparent",
              }}
            />
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={!isListening && (!languageReady || loading)}
              data-testid="button-triage-voice"
              aria-label={t(isListening ? "health.symptomCheck.chat.voiceStop" : "health.symptomCheck.chat.voiceStart")}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40 sm:h-12 sm:w-12"
              style={{
                background: isListening ? "#FEE2E2" : isDark ? "#45325E" : "hsl(var(--vyva-purple-light))",
                color: isListening ? "#B91C1C" : isDark ? "#C7A4FF" : "hsl(var(--vyva-purple))",
              }}
            >
              {isListening ? <Square size={18} /> : <Mic size={19} />}
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || !languageReady || loading}
              data-testid="button-triage-send"
              aria-label={t("health.symptomCheck.chat.send")}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40 sm:h-12 sm:w-12"
              style={{ background: "hsl(var(--vyva-purple))" }}
            >
              <Send size={18} className="text-white" />
            </button>
          </div>
        </div>
      </div> : null}
    </div>
  );
}
