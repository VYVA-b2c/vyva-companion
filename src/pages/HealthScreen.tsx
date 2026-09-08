import { useState, useRef, useEffect, useMemo, CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Stethoscope,
  Camera,
  UserSearch,
  Phone,
  PhoneCall,
  Mail,
  MapPin,
  Share2,
  ChevronRight,
  ChevronDown,
  X,
  Clock,
  Pill,
  Activity,
  Calendar,
  Car,
  ChefHat,
  ClipboardList,
  Flower2,
  Gamepad2,
  HeartPulse,
  Music,
  Trash2,
  Copy,
  History,
  Salad,
  BookOpen,
  Bandage,
  Star,
  Mic,
  Square,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShoppingBasket,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import MasterDashboardLayout, {
  type MasterDashboardCard,
  type MasterFastHelpAction,
} from "@/components/MasterDashboardLayout";
import ShowVyvaChooser from "@/components/ShowVyvaChooser";
import ShowVyvaCaptureCoach from "@/components/ShowVyvaCaptureCoach";
import ShowVyvaLiveCamera, { supportsShowVyvaLiveCamera } from "@/components/ShowVyvaLiveCamera";
import ShowVyvaPastedReviewResult from "@/components/ShowVyvaPastedReviewResult";
import ShowVyvaResultCard from "@/components/ShowVyvaResultCard";
import ShowVyvaReviewHistory from "@/components/ShowVyvaReviewHistory";
import type { ShowVyvaFollowUpAction } from "@/components/ShowVyvaFollowUpPanel";
import ProviderSetupFallbackPanel from "@/components/ProviderSetupFallbackPanel";
import VoiceHero from "@/components/VoiceHero";
import { ResponsiveGrid, SectionTitle } from "@/components/vyva-ui";
import { useProfile } from "@/contexts/ProfileContext";
import { useScreenPresentation } from "@/design/screenPresentation";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { saveShowVyvaActionExecutionPlan } from "@/lib/showVyvaActionExecutorClient";
import { markShowVyvaReviewHistoryActionSaved } from "@/lib/showVyvaReviewHistory";
import {
  prepareShowVyvaEvidenceFile,
  reviewShowVyvaVisualEvidence,
  type ShowVyvaPreparedEvidence,
} from "@/lib/showVyvaEvidence";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useDoctorVoice } from "@/hooks/useDoctorVoice";
import { useServiceGate } from "@/hooks/useServiceGate";
import { getSymptomRecommendationActionKinds, type SymptomRecommendationActionKind } from "@/lib/symptomReportActions";
import { useLanguage } from "@/i18n";
import {
  isVitalsSignalKey,
  VITALS_SIGNAL_CATALOG,
  type VitalsSignalKey,
} from "../../shared/vitalsSignalCatalog";
import {
  SHOW_VYVA_USE_CASE_IDS,
  type ShowVyvaCaptureSource,
  type ShowVyvaPastePayload,
  type ShowVyvaUseCaseId,
} from "../../shared/showVyvaFlow";
import { showVyvaReviewContractFromHealthResult, type ShowVyvaReviewContract } from "../../shared/showVyvaReviewContract";
import { buildShowVyvaActionExecutionPlan } from "../../shared/showVyvaActionExecutor";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";
import { APP_WORKFLOW_REFERENCES } from "../../shared/workflowRegistry";
import { buildWorkflowReceiptMoment } from "../../shared/workflowReceiptMoments";

type WoundScan = {
  id: string;
  severity: string;
  result_title: string;
  advice: string;
  image_data?: string | null;
  scanned_at: string;
};

type VisualScanImageType =
  | "xray"
  | "wound_photo"
  | "stool_image"
  | "urine_image"
  | "fluid_image"
  | "bruise_photo"
  | "skin_lesion"
  | "other_medical_image"
  | "unclear";

type VisualScanResult = {
  severity: string;
  resultTitle: string;
  advice: string;
  imageType?: VisualScanImageType;
  visibleObservations?: string[];
  potentialConcerns?: string[];
  uncertainty?: string[];
  recommendedNextStep?: string;
  isFallback?: boolean;
};

type ShowVyvaFileReviewInput = {
  useCaseId: ShowVyvaUseCaseId;
  source: Extract<ShowVyvaCaptureSource, "camera" | "upload">;
  fileName?: string | null;
  mimeType?: string | null;
  question?: string;
};

type TriageReport = {
  id: string;
  chief_complaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  bpm: number | null;
  respiratory_rate: number | null;
  created_at: string;
};

type ReportsSummary = {
  latestTriage: TriageReport | null;
  latestVitals: { bpm: number; respiratory_rate: number | null; recorded_at: string } | null;
  todayMeds: { taken: number; total: number; adherencePct: number | null };
};

type PreventionFocusResponse = {
  focus: "Heart" | "Falls" | "Diabetes" | "Medicine" | "Follow-up" | "Plan";
  headline: string;
  why: string[];
  todayAction: string;
  helpSigns: string[];
  primaryRoute: string;
  secondaryRoute?: string;
  confidence: "strong" | "moderate" | "limited";
  generatedAt: string;
};

type ProfileContactsResponse = {
  country?: string | null;
  gpPhone?: string | null;
  gpEmail?: string | null;
} | null;

type HealthHomeServiceActionKind = SymptomRecommendationActionKind | "open_report";

export type HealthHomeServiceAction = {
  kind: HealthHomeServiceActionKind;
  label: string;
  href?: string;
  to?: string;
  state?: unknown;
};

type HealthDoctorQuickActionKind =
  | "call_gp"
  | "email_gp"
  | "doctor_help"
  | "schedule_appointment"
  | "book_ride"
  | "add_doctor_contact";

export type HealthDoctorQuickAction = {
  kind: HealthDoctorQuickActionKind;
  label: string;
  description: string;
  href?: string;
  to?: string;
  state?: unknown;
};

type DailyCheckinToday = {
  status: "completed" | "upcoming" | "due_now" | "overdue" | "not_scheduled";
  date_key: string;
  timezone: string;
  schedule: {
    id: string | null;
    active: boolean;
    times_of_day: string[];
    next_run_at: string | null;
    last_completed_at: string | null;
    grace_minutes: number;
  };
  trend?: {
    streak_days: number;
    best_streak: number;
    total_checkins: number;
  };
  latest_checkin: {
    id: string;
    completed_at: string;
    feeling_label: string | null;
    overall_state: string | null;
    highlight: string | null;
  } | null;
  no_response: {
    overdue: boolean;
    minutes_overdue: number | null;
    alert_created: boolean;
    can_alert_caregiver: boolean;
    reason: string | null;
  };
  caregiver_alert?: {
    id: string;
    severity: string;
    message: string;
    created_at?: string | null;
  } | null;
  message: string;
  action_label: string;
};

type MedicationAdherenceReport = {
  latestTaken: {
    medication_name: string;
    scheduled_time: string;
    confirmed_taken_at: string;
  } | null;
  nextDue?: {
    medication_name: string;
    scheduled_time: string;
  } | null;
  todaySummary?: {
    taken: number;
    scheduled: number;
    remaining: number;
    medicationCount: number;
    completedMedicationCount: number;
    pendingMedicationCount: number;
  };
};

type MedicationDueSummary = {
  medication_name: string;
  scheduled_time: string;
};

type LatestVitalReading = {
  signal_type: string;
  context_tag?: string | null;
  value: string | number;
  recorded_at?: string | null;
  source?: string | null;
};

type VitalsSafetyStatus = "steady" | "recheck" | "share_with_caregiver" | "contact_doctor" | "urgent_help";

type LatestVitalsAnalysis = {
  safety_status?: string | null;
  recommended_action?: string | null;
  senior_message?: string | null;
  risk_score?: number | null;
  risk_tier?: string | null;
};

type LatestVitalsAlert = {
  severity?: string | null;
  message?: string | null;
  created_at?: string | null;
};

type LatestVitalsResponse = {
  analysis?: LatestVitalsAnalysis | null;
  recent_readings?: LatestVitalReading[];
  latest_alert?: LatestVitalsAlert | null;
};

type HealthHomeVitalsSnapshot = {
  value: string;
  detail: string;
  timeLabel: string;
  statusLabel: string;
  secondaryValues: string[];
  tone: {
    bg: string;
    text: string;
    border: string;
    iconBg: string;
  };
  hasReading: boolean;
  needsReview: boolean;
};

type HealthHomeInsight = {
  title: string;
  detail: string;
  Icon: LucideIcon;
  tone: {
    bg: string;
    text: string;
    iconBg: string;
  };
};

type HealthHomeOverview = {
  planStatus: string;
  primaryInsight: HealthHomeInsight;
  vitalsSnapshot: HealthHomeVitalsSnapshot;
  planItems: HealthPlanChecklistItem[];
  signalCards: HealthSignalCardItem[];
  recommendedAction: "open_plan" | "capture_vitals" | "symptom_report" | "symptom_check" | "checkin" | "checkin_history" | "medication";
};

export type SpecialistProvider = {
  name: string;
  specialty: string;
  specialtyLabel?: string;
  clinicName?: string;
  phone?: string | null;
  address?: string;
  bookingUrl?: string | null;
  mapsUrl?: string | null;
  sourceName: string;
  reviewScore?: number | null;
  reviewCount?: number | null;
  distanceLabel?: string | null;
  availabilityText?: string | null;
  openingTimes?: string | null;
  rationale: string;
  score: number;
};

type SpecialistRecommendation = {
  condition: string;
  matchedSpecialties: string[];
  safetyNote: string;
  providers: SpecialistProvider[];
  mapsSearchUrl?: string;
  nextStep: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  minor:    { bg: "#DCFCE7", text: "#15803D" },
  moderate: { bg: "#FEF9C3", text: "#A16207" },
  serious:  { bg: "#FEE2E2", text: "#B91C1C" },
};

const SCAN_SEVERITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Minor:    { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  Moderate: { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  Serious:  { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
};

const MOCK_SPECIALISTS: Record<string, { name: string; rating: number; waitN: number; waitUnit: "day" | "week" }[]> = {
  cardiología: [
    { name: "Dra. Elena Voss", rating: 4.9, waitN: 3, waitUnit: "day" },
    { name: "Dr. Martín Shore", rating: 4.7, waitN: 1, waitUnit: "week" },
  ],
  neurología: [
    { name: "Dra. Laura Chen", rating: 4.8, waitN: 1, waitUnit: "week" },
    { name: "Dr. Paulo Ferreira", rating: 4.6, waitN: 2, waitUnit: "week" },
  ],
  dermatología: [
    { name: "Dra. Nadia Kowal", rating: 4.7, waitN: 2, waitUnit: "day" },
    { name: "Dr. James O'Brien", rating: 4.5, waitN: 1, waitUnit: "week" },
  ],
  traumatología: [
    { name: "Dr. Carlos Reyes", rating: 4.6, waitN: 1, waitUnit: "week" },
    { name: "Dra. Ingrid Lund", rating: 4.8, waitN: 5, waitUnit: "day" },
  ],
};
const SPECIALTIES = Object.keys(MOCK_SPECIALISTS);
const DEFAULT_SPECIALIST_EXAMPLES_ES = [
  "dolor de rodilla",
  "problemas de memoria",
  "diabetes",
  "mancha en la piel",
  "falta de aire",
  "presión alta",
  "dolor de cadera",
  "herida que no cura",
  "revisar la vista",
  "problemas urinarios",
  "ánimo bajo",
  "tiroides",
];

const DEFAULT_SPECIALIST_EXAMPLES_EN = [
  "knee pain",
  "memory problems",
  "diabetes",
  "skin mark",
  "shortness of breath",
  "high blood pressure",
  "hip pain",
  "wound not healing",
  "eye check",
  "urinary problems",
  "low mood",
  "thyroid",
];

const SPECIALTY_LABELS_ES: Record<string, string> = {
  Dermatology: "Dermatología",
  Dermatologia: "Dermatología",
  Neurology: "Neurología",
  Geriatrics: "Geriatría",
  Neuropsychology: "Neuropsicología",
  Endocrinology: "Endocrinología",
  Cardiology: "Cardiología",
  "Traumatology / Orthopaedics": "Traumatología / Ortopedia",
  Physiotherapy: "Fisioterapia",
  Rheumatology: "Reumatología",
  "Internal Medicine": "Medicina interna",
  "General Practice": "Medicina general",
  "Wound Care Nursing": "Enfermería de heridas",
  Pulmonology: "Neumología",
  Gastroenterology: "Digestivo",
  Urology: "Urología",
  Gynaecology: "Ginecología",
  Gynecology: "Ginecología",
  Ophthalmology: "Oftalmología",
  Podiatry: "Podología",
  Psychology: "Psicología",
  Psychiatry: "Psiquiatría",
};

function activeLanguage(language?: string): string {
  return (language || "es").split("-")[0].toLowerCase();
}

function displaySpecialtyText(specialty: string, language: string): string {
  if (activeLanguage(language) === "es") {
    return SPECIALTY_LABELS_ES[specialty] ?? specialty;
  }
  return specialty;
}

function displaySpecialty(provider: SpecialistProvider, language: string): string {
  return displaySpecialtyText(provider.specialtyLabel ?? provider.specialty, language);
}

function normalizeForMatching(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function uniqueValues(values: string[]): string[] {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

const LOCATION_COUNTRY_CODE_LABELS: Record<string, string> = {
  DE: "Germany",
  ES: "Spain",
  FR: "France",
  GB: "United Kingdom",
  IT: "Italy",
  PT: "Portugal",
  UK: "United Kingdom",
  US: "United States",
};

function locationCountryLabel(country?: string | null): string {
  const trimmed = country?.trim();
  if (!trimmed) return "";
  if (/^[A-Za-z]{2}$/.test(trimmed)) return LOCATION_COUNTRY_CODE_LABELS[trimmed.toUpperCase()] ?? "";
  return trimmed;
}

export function profileLocationFromParts({
  street,
  postalCode,
  cityState,
  region,
  country,
}: {
  street?: string | null;
  postalCode?: string | null;
  cityState?: string | null;
  region?: string | null;
  country?: string | null;
}): string {
  const areaParts = [street, postalCode, cityState, region].map((part) => part?.trim()).filter(Boolean) as string[];
  if (!areaParts.length) return "";

  return uniqueValues([...areaParts, locationCountryLabel(country)].filter(Boolean)).join(", ");
}

function localizedSpecialistPrompt(key: string, language: string): string {
  const isSpanish = activeLanguage(language) === "es";
  const prompts: Record<string, { es: string; en: string }> = {
    knee: { es: "dolor de rodilla", en: "knee pain" },
    hip: { es: "dolor de cadera", en: "hip pain" },
    falls: { es: "caídas frecuentes", en: "frequent falls" },
    memory: { es: "problemas de memoria", en: "memory problems" },
    diabetes: { es: "diabetes", en: "diabetes" },
    skin: { es: "mancha en la piel", en: "skin mark" },
    wound: { es: "herida que no cura", en: "wound not healing" },
    breathing: { es: "falta de aire", en: "shortness of breath" },
    heart: { es: "control del corazón", en: "heart check" },
    pressure: { es: "presión alta", en: "high blood pressure" },
    thyroid: { es: "tiroides", en: "thyroid" },
    stomach: { es: "dolor de estómago", en: "stomach pain" },
    urinary: { es: "problemas urinarios", en: "urinary problems" },
    vision: { es: "revisar la vista", en: "eye check" },
    mood: { es: "ánimo bajo", en: "low mood" },
  };

  return prompts[key]?.[isSpanish ? "es" : "en"] ?? key;
}

function deriveSpecialistExamples(conditions: string[] | undefined, language: string): string[] {
  const normalizedConditions = (conditions ?? []).map(normalizeForMatching);
  const matches = (keywords: string[]) =>
    normalizedConditions.some((condition) => keywords.some((keyword) => condition.includes(keyword)));
  const suggestions: string[] = [];

  if (matches(["arthritis", "arthrosis", "osteoarthritis", "rodilla", "knee", "joint"])) suggestions.push(localizedSpecialistPrompt("knee", language));
  if (matches(["hip", "cadera"])) suggestions.push(localizedSpecialistPrompt("hip", language));
  if (matches(["fall", "falls", "caida", "caidas", "mobility", "balance"])) suggestions.push(localizedSpecialistPrompt("falls", language));
  if (matches(["memory", "memoria", "dementia", "alzheimer", "cognitive"])) suggestions.push(localizedSpecialistPrompt("memory", language));
  if (matches(["diabetes", "glucose", "glucosa", "sugar"])) suggestions.push(localizedSpecialistPrompt("diabetes", language));
  if (matches(["skin", "piel", "dermat", "lunar", "eczema", "psoriasis"])) suggestions.push(localizedSpecialistPrompt("skin", language));
  if (matches(["wound", "ulcer", "herida", "ulcera"])) suggestions.push(localizedSpecialistPrompt("wound", language));
  if (matches(["asthma", "asma", "copd", "epoc", "breathing", "respir", "pulmonary", "lung"])) suggestions.push(localizedSpecialistPrompt("breathing", language));
  if (matches(["heart", "cardiac", "corazon", "cardio", "angina", "arrhythmia"])) suggestions.push(localizedSpecialistPrompt("heart", language));
  if (matches(["hypertension", "blood pressure", "presion"])) suggestions.push(localizedSpecialistPrompt("pressure", language));
  if (matches(["thyroid", "tiroides"])) suggestions.push(localizedSpecialistPrompt("thyroid", language));
  if (matches(["digest", "stomach", "colon", "intestin", "estomago"])) suggestions.push(localizedSpecialistPrompt("stomach", language));
  if (matches(["urinary", "urine", "prostate", "urinario", "vejiga", "prostata"])) suggestions.push(localizedSpecialistPrompt("urinary", language));
  if (matches(["vision", "eye", "vista", "ojo", "cataract"])) suggestions.push(localizedSpecialistPrompt("vision", language));
  if (matches(["depression", "anxiety", "mood", "ansiedad", "depresion", "animo"])) suggestions.push(localizedSpecialistPrompt("mood", language));

  const defaults = activeLanguage(language) === "es"
    ? DEFAULT_SPECIALIST_EXAMPLES_ES
    : DEFAULT_SPECIALIST_EXAMPLES_EN;

  return uniqueValues([...suggestions, ...defaults]);
}

type TFunction = (key: string, fallback?: string) => string;

type VisualScanActionKind = "call_gp" | "email_gp" | "doctor_help" | "schedule_appointment" | "book_ride";

type VisualScanAction = {
  kind: VisualScanActionKind;
  label: string;
  Icon: LucideIcon;
  href?: string;
  onClick?: () => void;
};

const VISUAL_SCAN_FOLLOW_UP_ICONS: Record<VisualScanActionKind, ShowVyvaFollowUpAction["icon"]> = {
  call_gp: "phone",
  email_gp: "reply",
  doctor_help: "shield",
  schedule_appointment: "quote",
  book_ride: "map",
};

const VISUAL_SCAN_FOLLOW_UP_TONES: Record<VisualScanActionKind, ShowVyvaFollowUpAction["tone"]> = {
  call_gp: "safe",
  email_gp: "quiet",
  doctor_help: "primary",
  schedule_appointment: "warm",
  book_ride: "quiet",
};

type SpecialistProviderServiceActionKind = "call_provider" | "book_appointment" | "book_ride" | "open_map";

type SpecialistProviderServiceAction = {
  kind: SpecialistProviderServiceActionKind;
  href?: string;
};

export const VISUAL_SCAN_CATEGORY_KEYS = [
  { key: "wounds", fallback: "Wounds" },
  { key: "bruises", fallback: "Bruises" },
  { key: "fluids", fallback: "Fluids" },
  { key: "stool", fallback: "Stool" },
  { key: "urine", fallback: "Urine" },
  { key: "xrays", fallback: "X-rays" },
] as const;

const VISUAL_SCAN_IMAGE_TYPE_FALLBACKS: Record<VisualScanImageType, string> = {
  xray: "X-ray",
  wound_photo: "Wound photo",
  stool_image: "Stool image",
  urine_image: "Urine image",
  fluid_image: "Fluid image",
  bruise_photo: "Bruise photo",
  skin_lesion: "Skin or lesion",
  other_medical_image: "Medical image",
  unclear: "Unclear image",
};

function visualScanImageTypeLabel(t: TFunction, imageType?: VisualScanImageType) {
  const safeType = imageType ?? "unclear";
  return t(`health.scanWound.imageType.${safeType}`, VISUAL_SCAN_IMAGE_TYPE_FALLBACKS[safeType]);
}

function visualScanList(items?: string[]) {
  return Array.isArray(items) ? items.filter(Boolean) : [];
}

function visualScanReviewText(result: VisualScanResult) {
  return [
    result.severity,
    result.resultTitle,
    result.advice,
    result.recommendedNextStep,
    ...(result.potentialConcerns ?? []),
  ].filter(Boolean).join(" ");
}

export function visualScanServiceActionKindsFor(
  result: VisualScanResult,
  contacts: { hasGpPhone?: boolean; hasGpEmail?: boolean } = {},
): VisualScanActionKind[] {
  const text = normalizeForMatching(visualScanReviewText(result));
  const needsClinicalReview = /\b(doctor|clinician|clinical|healthcare|professional|radiologist|review|appointment|clinic|urgent|emergency|medico|medecin|arzt|dottore|medico)\b/.test(text);
  if (!needsClinicalReview && result.severity !== "Serious" && result.severity !== "Moderate") return [];
  return [
    ...(contacts.hasGpPhone ? ["call_gp" as const] : []),
    ...(contacts.hasGpEmail ? ["email_gp" as const] : []),
    "doctor_help",
    "schedule_appointment",
    "book_ride",
  ];
}

export function visualScanDoctorContext(result: VisualScanResult) {
  return [
    "VYVA visual health scan",
    `Image type: ${result.imageType ?? "unclear"}`,
    `Severity: ${result.severity}`,
    `Result: ${result.resultTitle}`,
    result.advice ? `Advice: ${result.advice}` : "",
    result.recommendedNextStep ? `Suggested next step: ${result.recommendedNextStep}` : "",
    result.visibleObservations?.length ? `Visible observations: ${result.visibleObservations.join("; ")}` : "",
    result.potentialConcerns?.length ? `Potential concerns: ${result.potentialConcerns.join("; ")}` : "",
    result.uncertainty?.length ? `Limits: ${result.uncertainty.join("; ")}` : "",
  ].filter(Boolean).join("\n");
}

export function VisualHealthScanCardContent({
  t,
  analyzing,
  onScanSource,
  onPasteReview,
}: {
  t: TFunction;
  analyzing: boolean;
  onScanSource: (source: Extract<ShowVyvaCaptureSource, "camera" | "upload">, useCaseId: ShowVyvaUseCaseId, question: string) => void;
  onPasteReview?: (payload: ShowVyvaPastePayload) => void;
}) {
  const navigate = useNavigate();

  return (
    <>
      <div className="px-[18px] py-[18px]">
        <ShowVyvaChooser
          title={t("showVyva.healthTitle", "Show VYVA")}
          subtitle={t("showVyva.healthSubtitle", "Use a photo, file, text, or link. VYVA helps decide the safest next step.")}
          defaultUseCaseId={SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto}
          useCaseIds={[
            SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
            SHOW_VYVA_USE_CASE_IDS.medicineOrOtc,
            SHOW_VYVA_USE_CASE_IDS.documentHelp,
          ]}
          busy={analyzing}
          onChooseFileSource={(source, useCase, question) => onScanSource(source, useCase.id, question)}
          onPaste={onPasteReview ? (payload) => onPasteReview(payload) : undefined}
        />
        <ShowVyvaReviewHistory
          className="mt-[14px]"
          onResume={(item) => navigate(item.resumeRoute)}
        />
      </div>
      <div className="flex flex-wrap gap-2 px-[18px] pb-[16px]">
        {VISUAL_SCAN_CATEGORY_KEYS.map((item) => (
          <span
            key={item.key}
            className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1 font-body text-[12px] font-bold text-[#92400E]"
          >
            {t(`health.scanWound.category.${item.key}`, item.fallback)}
          </span>
        ))}
      </div>
    </>
  );
}

export function VisualScanResultPanel({
  result,
  t,
  onClose,
  reviewInput,
  actions = [],
  onFollowUpSelect,
}: {
  result: VisualScanResult;
  t: TFunction;
  onClose: () => void;
  reviewInput?: ShowVyvaFileReviewInput;
  actions?: VisualScanAction[];
  onFollowUpSelect?: (action: ShowVyvaFollowUpAction, contract: ShowVyvaReviewContract) => void;
}) {
  const input = reviewInput ?? {
    useCaseId: SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
    source: "camera" as const,
  };
  const reviewContract = showVyvaReviewContractFromHealthResult({
    useCaseId: input.useCaseId,
    source: input.source,
    fileName: input.fileName,
    mimeType: input.mimeType,
    followUpContext: input.useCaseId === SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto ? "health_visual" : undefined,
  }, result);
  const resultActions = reviewContract.followUpContext === "health_visual"
    ? actions.map((action) => ({
        id: action.kind,
        label: action.label,
        detail: t(`showVyva.followUp.action.${action.kind}.detail`, "Prepare before acting."),
        icon: VISUAL_SCAN_FOLLOW_UP_ICONS[action.kind],
        tone: VISUAL_SCAN_FOLLOW_UP_TONES[action.kind],
        externalAction: action.kind === "call_gp" || action.kind === "email_gp" || action.kind === "schedule_appointment" || action.kind === "book_ride",
        requiresConfirmation: true,
      }) satisfies ShowVyvaFollowUpAction)
    : reviewContract.followUpActions;
  const isVisualHealthReview = reviewContract.followUpContext === "health_visual";

  return (
    <div className="mx-[18px] mb-[16px]">
      <ShowVyvaResultCard
        contract={reviewContract}
        testIdSuffix="health-current"
        reviewedLabel={isVisualHealthReview ? visualScanImageTypeLabel(t, result.imageType) : undefined}
        thinkingLabel={result.advice || result.resultTitle}
        actionSubtitle={isVisualHealthReview ? t("showVyva.followUp.subtitle.health_visual", "Choose how to use this review. VYVA asks before sharing or booking.") : undefined}
        actions={resultActions}
        onActionSelect={(selected) => {
            if (onFollowUpSelect) {
              onFollowUpSelect(selected, reviewContract);
              return;
            }
            const action = actions.find((item) => item.kind === selected.id);
            if (!action) return;
            if (action.href) {
              window.location.href = action.href;
              return;
            }
            action.onClick?.();
          }
        }
      />

      <p className="mt-3 rounded-[12px] bg-white/72 px-3 py-2 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
        {t("health.scanWound.disclaimer", "Assistive description only, not medical advice or diagnosis. A qualified clinician should review anything concerning.")}
      </p>
      <button
        data-testid="button-close-wound-result"
        onClick={onClose}
        className="mt-3 flex items-center gap-1 font-body text-[12px]"
        style={{ color: "#6B7280" }}
      >
        <X size={12} /> {t("health.scanWound.close", "Close")}
      </button>
    </div>
  );
}

function formatCheckinTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatHealthHomeTimestamp(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatMedicationScheduledTime(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return trimmed;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function latestHealthTimestamp(values: Array<string | null | undefined>) {
  const latest = values
    .map((value) => {
      if (!value) return null;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? null : { value, time };
    })
    .filter((value): value is { value: string; time: number } => Boolean(value))
    .sort((a, b) => b.time - a.time)[0];
  return latest?.value ?? "";
}

function compactVitalsSubject(value: string) {
  if (/^BP\b/i.test(value)) return "BP";
  const beforeColon = value.split(":")[0]?.trim();
  if (beforeColon && beforeColon.length < value.length) return beforeColon;
  const firstWord = value.split(/\s+/)[0]?.trim();
  return firstWord || value;
}

function compactVitalsCardTag(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";

  const bpMatch = trimmed.match(/^BP\s+([0-9.]+)\/([0-9.]+)/i);
  if (bpMatch) return `BP ${bpMatch[1]}/${bpMatch[2]}`;

  const labeledReadingMatch = trimmed.match(/^([^:]+):\s*([0-9.]+)\s*([^\s]+)?/);
  if (labeledReadingMatch) {
    const rawLabel = labeledReadingMatch[1].trim();
    const label = /^oxygen$/i.test(rawLabel) ? "SpO2" : rawLabel;
    const unit = labeledReadingMatch[3]?.trim() ?? "";
    const compactUnit = unit === "%" || unit === "C" || unit === "kg" ? unit : "";
    return `${label} ${labeledReadingMatch[2]}${compactUnit}`;
  }

  return trimmed
    .replace(/\s*mmHg\b/gi, "")
    .replace(/\s*bpm\b/gi, "")
    .replace(/:\s*/g, " ");
}

function formatHealthCardDateTag(value: string | null | undefined, todayLabel: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? todayLabel
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function scheduledTimeHour(value?: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

function isScheduledDoseSoonOrPast(value?: string | null) {
  const parsed = scheduledTimeHour(value);
  if (!parsed) return true;
  const now = new Date();
  const scheduled = new Date(now);
  scheduled.setHours(parsed.hour, parsed.minute, 0, 0);
  return scheduled.getTime() - now.getTime() <= 4 * 60 * 60 * 1000;
}

function isScheduledDoseTonight(value?: string | null) {
  const parsed = scheduledTimeHour(value);
  return Boolean(parsed && parsed.hour >= 17);
}

function roundedReadingValue(value: string | number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return String(value);
  return Number.isInteger(numberValue) ? String(numberValue) : String(Math.round(numberValue * 10) / 10);
}

function nearSameMoment(a?: string | null, b?: string | null) {
  if (!a || !b) return true;
  const first = new Date(a).getTime();
  const second = new Date(b).getTime();
  if (Number.isNaN(first) || Number.isNaN(second)) return true;
  return Math.abs(first - second) <= 5 * 60 * 1000;
}

function formatLatestVitalReading(reading: LatestVitalReading | undefined, readings: LatestVitalReading[]) {
  if (!reading) return "";
  if (reading.signal_type === "bp_systolic" || reading.signal_type === "bp_diastolic") {
    const systolic = reading.signal_type === "bp_systolic"
      ? reading
      : readings.find((item) => item.signal_type === "bp_systolic" && nearSameMoment(item.recorded_at, reading.recorded_at));
    const diastolic = reading.signal_type === "bp_diastolic"
      ? reading
      : readings.find((item) => item.signal_type === "bp_diastolic" && nearSameMoment(item.recorded_at, reading.recorded_at));
    if (systolic && diastolic) {
      return `BP ${roundedReadingValue(systolic.value)}/${roundedReadingValue(diastolic.value)} mmHg`;
    }
  }

  if (isVitalsSignalKey(reading.signal_type)) {
    const signal = reading.signal_type as VitalsSignalKey;
    const meta = VITALS_SIGNAL_CATALOG[signal];
    return `${meta.shortLabel}: ${roundedReadingValue(reading.value)}${meta.unit ? ` ${meta.unit}` : ""}`;
  }

  return `${reading.signal_type.replace(/_/g, " ")}: ${roundedReadingValue(reading.value)}`;
}

function normalizeVitalsSafetyStatus(value?: string | null): VitalsSafetyStatus {
  if (value === "urgent_help" || value === "contact_doctor" || value === "share_with_caregiver" || value === "recheck") {
    return value;
  }
  return "steady";
}

function latestTimeFromReadings(readings: LatestVitalReading[]) {
  const times = readings
    .map((reading) => reading.recorded_at ? new Date(reading.recorded_at).getTime() : NaN)
    .filter((time) => Number.isFinite(time));
  if (!times.length) return "";
  return new Date(Math.max(...times)).toISOString();
}

function bloodPressureReading(readings: LatestVitalReading[]) {
  const systolic = readings.find((reading) => reading.signal_type === "bp_systolic");
  const diastolic = readings.find((reading) =>
    reading.signal_type === "bp_diastolic" && nearSameMoment(reading.recorded_at, systolic?.recorded_at));
  if (!systolic || !diastolic) return null;

  return {
    value: `BP ${roundedReadingValue(systolic.value)}/${roundedReadingValue(diastolic.value)} mmHg`,
    recordedAt: systolic.recorded_at ?? diastolic.recorded_at ?? null,
  };
}

function preferredVitalsReading(readings: LatestVitalReading[]) {
  const bp = bloodPressureReading(readings);
  if (bp) return bp;
  const priority = [
    "resting_hr_bpm",
    "respiratory_rate",
    "oxygen_saturation",
    "glucose_mgdl",
    "weight_kg",
  ];
  const reading = priority
    .map((signal) => readings.find((item) => item.signal_type === signal))
    .find(Boolean) ?? readings[0];

  return reading ? {
    value: formatLatestVitalReading(reading, readings),
    recordedAt: reading.recorded_at ?? null,
  } : null;
}

function dailyCheckinTone(status?: DailyCheckinToday["status"]) {
  if (status === "completed") return { bg: "#ECFDF5", text: "#047857", Icon: CheckCircle2 };
  if (status === "overdue") return { bg: "#FEF2F2", text: "#B91C1C", Icon: AlertTriangle };
  if (status === "due_now") return { bg: "#FFF7ED", text: "#B45309", Icon: Clock };
  return { bg: "#F5F3FF", text: "#6B21A8", Icon: HeartPulse };
}

type HealthSignalCardItem = {
  id: string;
  Icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  actionLabel: string;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  shadow: string;
  onClick: () => void;
};

type HealthPlanChecklistItem = {
  id: string;
  Icon: LucideIcon;
  label: string;
  detail: string;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  onClick: () => void;
};

type HealthToolAction = {
  id: string;
  Icon: LucideIcon;
  label: string;
  detail: string;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
};

function HealthPlanChecklist({ items }: { items: HealthPlanChecklistItem[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="health-plan-checklist">
      {items.map((item) => {
        const Icon = item.Icon;
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`button-health-plan-step-${item.id}`}
            onClick={item.onClick}
            aria-label={`${item.label}. ${item.detail}`}
            className="vyva-tap min-w-0 rounded-[18px] border bg-white px-2.5 py-2 text-left shadow-[0_8px_18px_rgba(43,31,24,0.04)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B21A8]"
            style={{ borderColor: item.borderColor }}
          >
            <span className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[12px]"
                style={{ background: item.iconBg, color: item.iconColor }}
              >
                <Icon size={17} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-body text-[12px] font-black leading-tight text-vyva-text-1">
                  {item.label}
                </span>
                <span className="sr-only">
                  {item.detail}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function HealthToolButton({ tool }: { tool: HealthToolAction }) {
  const Icon = tool.Icon;
  return (
    <button
      type="button"
      onClick={tool.onClick}
      data-testid={`button-health-tool-${tool.id}`}
      aria-label={`${tool.label}. ${tool.detail}`}
      className="vyva-tap group flex min-h-[88px] items-center gap-3 rounded-[20px] border border-[#E8DED4] bg-[#FFFCF8] p-3 text-left shadow-[0_10px_24px_rgba(60,38,20,0.05)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B21A8] sm:min-h-[76px]"
    >
      <span
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px]"
        style={{ background: tool.iconBg, color: tool.iconColor }}
      >
        <Icon size={22} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[15px] font-black leading-tight text-vyva-text-1 sm:text-[16px]">
          {tool.label}
        </span>
        <span className="sr-only">
          {tool.detail}
        </span>
      </span>
      <ChevronRight size={16} strokeWidth={2.7} className="ml-auto flex-shrink-0 text-vyva-purple transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

function HealthSignalCard({ card }: { card: HealthSignalCardItem }) {
  const Icon = card.Icon;
  return (
    <button
      type="button"
      onClick={card.onClick}
      data-testid={`button-health-signal-${card.id}`}
      aria-label={`${card.label}. ${card.value}. ${card.detail}`}
      className="vyva-tap group flex min-h-[112px] w-full items-stretch gap-3 rounded-[22px] border bg-[#FFFCF8] p-3 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B21A8] sm:min-h-[124px] sm:rounded-[24px] sm:p-4"
      style={{ borderColor: card.borderColor, boxShadow: `0 14px 32px ${card.shadow}` }}
    >
      <span
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] sm:h-[50px] sm:w-[50px] sm:rounded-[18px]"
        style={{ background: card.iconBg, color: card.iconColor }}
      >
        <Icon size={23} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-vyva-text-3">
          {card.label}
        </span>
        <span className="mt-1.5 line-clamp-1 font-body text-[20px] font-black leading-tight text-vyva-text-1 sm:text-[22px]">
          {card.value}
        </span>
        <span className="sr-only">
          {card.detail}
        </span>
        <span className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[12px] font-black text-vyva-purple">
            {card.actionLabel}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F3FF] text-vyva-purple transition-transform group-hover:translate-x-0.5">
            <ChevronRight size={17} strokeWidth={2.7} aria-hidden="true" />
          </span>
        </span>
      </span>
    </button>
  );
}

export function DailyCheckinCard({
  checkin,
  t,
  onPrimary,
  onHistory,
}: {
  checkin?: DailyCheckinToday;
  t: TFunction;
  onPrimary: () => void;
  onHistory: () => void;
}) {
  const tone = dailyCheckinTone(checkin?.status);
  const Icon = tone.Icon;
  const completedTime = formatCheckinTime(checkin?.latest_checkin?.completed_at);
  const nextTime = formatCheckinTime(checkin?.schedule.next_run_at);
  const statusLabel =
    checkin?.status === "completed" ? t("health.dailyCheckin.completed", "Checked in today") :
    checkin?.status === "overdue" ? t("health.dailyCheckin.overdue", "Check-in overdue") :
    checkin?.status === "due_now" ? t("health.dailyCheckin.due", "Ready now") :
    checkin?.status === "not_scheduled" ? t("health.dailyCheckin.setup", "Set up") :
    t("health.dailyCheckin.upcoming", "Scheduled");
  const message =
    !checkin ? t("health.dailyCheckin.loadingMessage", "A quick check helps VYVA keep watch.") :
    checkin.status === "completed" ? t("health.dailyCheckin.messages.completed", "VYVA has today's signal.") :
    checkin.status === "due_now" ? t("health.dailyCheckin.messages.dueNow", "Answer in a few seconds.") :
    checkin.status === "overdue" ? (
      checkin.no_response.reason
        ? t("health.dailyCheckin.messages.overdueNeedsContact", "Add a caregiver contact for alerts.")
        : t("health.dailyCheckin.messages.overdueAlerted", "Caregiver safety alert recorded.")
    ) :
    checkin.status === "upcoming" ? t("health.dailyCheckin.messages.upcoming", "Scheduled for later today.") :
    t("health.dailyCheckin.messages.notScheduled", "Pick a daily check-in time.");
  const primaryLabel =
    checkin?.status === "completed" ? t("health.dailyCheckin.actions.viewHistory", "Longevity Plan") :
    checkin?.status === "upcoming" ? t("health.dailyCheckin.actions.checkInEarly", "Check early") :
    checkin?.status === "not_scheduled" ? t("health.dailyCheckin.actions.setup", "Set up") :
    t("health.dailyCheckin.actions.primary", "Check in");
  const showHistoryAction = checkin?.status !== "completed";
  const detail =
    checkin?.status === "completed" && completedTime
      ? t("health.dailyCheckin.completedAt", "Completed at") + ` ${completedTime}`
      : nextTime
        ? t("health.dailyCheckin.nextAt", "Next check-in") + ` ${nextTime}`
        : t("health.dailyCheckin.defaultTime", "Default time: 10:00");

  return (
    <section className="mt-[18px] rounded-[26px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_24px_rgba(63,45,35,0.06)]" data-testid="daily-checkin-status-card">
      <div className="flex items-center gap-3">
        <span
          className="flex h-[54px] w-[54px] flex-shrink-0 items-center justify-center rounded-[18px]"
          style={{ background: tone.bg, color: tone.text }}
        >
          <Icon size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]" style={{ color: tone.text }}>
              {t("health.dailyCheckin.kicker", "Daily check-in")}
            </p>
            <span className="rounded-full px-3 py-1 font-body text-[12px] font-bold" style={{ background: tone.bg, color: tone.text }}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-3">{detail}</p>
        </div>
      </div>
      <p className="mt-3 font-body text-[19px] font-extrabold leading-tight text-vyva-text-1">
        {checkin?.latest_checkin?.feeling_label ?? t("health.dailyCheckin.title", "How are you today?")}
      </p>
      <p className="mt-2 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
        {message}
      </p>
      <div className={`mt-4 grid gap-3 ${showHistoryAction ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          onClick={onPrimary}
          className="vyva-primary-action min-h-[58px] text-[17px]"
        >
          {primaryLabel}
        </button>
        {showHistoryAction ? (
          <button
            type="button"
            onClick={onHistory}
            className="vyva-secondary-action min-h-[58px] text-[17px]"
          >
            {t("health.dailyCheckin.history", "Longevity Plan")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function sanitizePhoneHref(phone?: string | null): string {
  const raw = phone?.trim();
  if (!raw) return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  return `tel:${normalized || raw}`;
}

function emergencyContactForCountry(country?: string | null) {
  const code = (country ?? "ES").trim().toUpperCase() || "ES";
  const numberByCountry: Record<string, string> = {
    ES: "112",
    FR: "112",
    DE: "112",
    IT: "112",
    PT: "112",
    IE: "112",
    GB: "999",
    UK: "999",
    US: "911",
    CA: "911",
    AU: "000",
  };
  const number = numberByCountry[code];
  return number ? { label: number, telHref: `tel:${number}` } : null;
}

type LatestTriageActionOptions = {
  report: TriageReport | null;
  country?: string | null;
  gpPhone?: string | null;
  gpEmail?: string | null;
  doctorContext: string;
  labels?: Partial<Record<HealthHomeServiceActionKind, string>>;
};

export function latestTriageServiceActionsFor({
  report,
  country,
  gpPhone,
  gpEmail,
  doctorContext,
  labels = {},
}: LatestTriageActionOptions): HealthHomeServiceAction[] {
  if (!report) return [];
  const emergencyContact = emergencyContactForCountry(country);
  const gpPhoneHref = sanitizePhoneHref(gpPhone);
  const gpEmailValue = gpEmail?.trim() ?? "";
  const recommendationTexts = [
    report.urgency === "urgent" ? "Call emergency services now" : "",
    ...(report.recommendations ?? []),
  ].filter(Boolean);
  const seen = new Set<HealthHomeServiceActionKind>();
  const actions: HealthHomeServiceAction[] = [];
  const defaultLabels: Record<SymptomRecommendationActionKind, string> = {
    call_emergency: emergencyContact?.label ? `Call ${emergencyContact.label}` : "Call emergency",
    call_gp: "Call GP",
    email_gp: "Email GP",
    doctor_help: "Doctor help",
    book_ride: "Find transport",
    schedule_appointment: "Appointment",
    online_order: "Online order",
    request_quote: "Request quote",
  };
  const add = (action: HealthHomeServiceAction) => {
    if (seen.has(action.kind)) return;
    seen.add(action.kind);
    actions.push(action);
  };

  recommendationTexts.forEach((recommendation) => {
    getSymptomRecommendationActionKinds(recommendation, {
      hasEmergencyContact: Boolean(emergencyContact?.telHref),
      hasGpPhone: Boolean(gpPhoneHref),
      hasGpEmail: Boolean(gpEmailValue),
    }).forEach((kind) => {
      const label = labels[kind] ?? defaultLabels[kind];
      if (kind === "call_emergency" && emergencyContact?.telHref) {
        add({ kind, label, href: emergencyContact.telHref });
      } else if (kind === "call_gp" && gpPhoneHref) {
        add({ kind, label, href: gpPhoneHref });
      } else if (kind === "email_gp" && gpEmailValue) {
        add({
          kind,
          label,
          href: `mailto:${gpEmailValue}?subject=${encodeURIComponent("VYVA symptom report")}&body=${encodeURIComponent(doctorContext)}`,
        });
      } else if (kind === "doctor_help") {
        add({
          kind,
          label,
          to: "/health/doctor",
          state: { autoStartVoice: true, latestSymptomReport: doctorContext || report.chief_complaint },
        });
      } else if (kind === "book_ride" || kind === "schedule_appointment" || kind === "request_quote") {
        add({
          kind,
          label,
          to: "/concierge",
          state: {
            conciergePrefill: {
              kind: kind === "book_ride" ? "ride" : kind === "schedule_appointment" ? "appointment" : "home_care_quote",
              message: recommendation,
              source: "symptom_report",
            },
          },
        });
      } else if (kind === "online_order") {
        add({
          kind,
          label,
          to: "/concierge/shopping",
          state: {
            shoppingPrefill: {
              needText: recommendation,
              category: "groceries",
              priorities: ["delivery", "simplicity"],
            },
          },
        });
      }
    });
  });

  return actions;
}

type HealthDoctorQuickActionOptions = {
  gpPhone?: string | null;
  gpEmail?: string | null;
  gpName?: string | null;
  doctorContext: string;
  labels?: Partial<Record<HealthDoctorQuickActionKind, string>>;
  descriptions?: Partial<Record<HealthDoctorQuickActionKind, string>>;
  messages?: Partial<Record<"appointment" | "ride", string>>;
};

export function healthDoctorQuickActionsFor({
  gpPhone,
  gpEmail,
  gpName,
  doctorContext,
  labels = {},
  descriptions = {},
  messages = {},
}: HealthDoctorQuickActionOptions): HealthDoctorQuickAction[] {
  const gpPhoneHref = sanitizePhoneHref(gpPhone);
  const gpEmailValue = gpEmail?.trim() ?? "";
  const gpLabelName = gpName?.trim() || "GP";
  const safeContext = doctorContext.trim() || "Health home doctor support request.";
  const appointmentMessage = messages.appointment
    ?? `Please help me schedule a doctor appointment. Ask me to confirm before booking anything.\n\n${safeContext}`;
  const rideMessage = messages.ride
    ?? `Please help me find safe transport options for a medical appointment. Ask me to confirm before contacting anyone.\n\n${safeContext}`;
  const actions: HealthDoctorQuickAction[] = [];

  if (gpPhoneHref) {
    actions.push({
      kind: "call_gp",
      label: labels.call_gp ?? `Call ${gpLabelName}`,
      description: descriptions.call_gp ?? "Speak to your practice now.",
      href: gpPhoneHref,
    });
  }

  if (gpEmailValue) {
    actions.push({
      kind: "email_gp",
      label: labels.email_gp ?? "Email GP",
      description: descriptions.email_gp ?? "Open a message with context filled in.",
      href: `mailto:${gpEmailValue}?subject=${encodeURIComponent("VYVA doctor support request")}&body=${encodeURIComponent(safeContext)}`,
    });
  }

  if (!gpPhoneHref && !gpEmailValue) {
    actions.push({
      kind: "add_doctor_contact",
      label: labels.add_doctor_contact ?? "Add GP contact",
      description: descriptions.add_doctor_contact ?? "Save phone or email first.",
      to: "/onboarding/profile/gp",
    });
  }

  actions.push(
    {
      kind: "doctor_help",
      label: labels.doctor_help ?? "Doctor help",
      description: descriptions.doctor_help ?? "Talk through the next step with VYVA.",
      to: "/health/doctor",
      state: { autoStartVoice: true, latestSymptomReport: safeContext, source: "health_home_doctor" },
    },
    {
      kind: "schedule_appointment",
      label: labels.schedule_appointment ?? "Book appointment",
      description: descriptions.schedule_appointment ?? "VYVA prepares the request for approval.",
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "appointment",
          message: appointmentMessage,
          source: "health_home_doctor",
        },
      },
    },
    {
      kind: "book_ride",
      label: labels.book_ride ?? "Find transport",
      description: descriptions.book_ride ?? "Compare safe ways to get there.",
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "ride",
          message: rideMessage,
          source: "health_home_doctor",
        },
      },
    },
  );

  return actions;
}

export function specialistProviderContext(provider: SpecialistProvider, condition: string, language = "en") {
  const specialty = displaySpecialty(provider, language);
  const providerName = provider.clinicName ?? provider.name;

  return [
    "VYVA specialist finder",
    condition.trim() ? `Reason: ${condition.trim()}` : "",
    `Provider: ${providerName}`,
    `Specialist: ${provider.name}`,
    specialty ? `Specialty: ${specialty}` : "",
    provider.phone ? `Phone: ${provider.phone}` : "",
    provider.address ? `Address: ${provider.address}` : "",
    provider.openingTimes ? `Hours: ${provider.openingTimes}` : "",
    provider.distanceLabel ? `Distance: ${provider.distanceLabel}` : "",
    provider.bookingUrl ? `Booking link: ${provider.bookingUrl}` : "",
  ].filter(Boolean).join("\n");
}

export function specialistRideState(provider: SpecialistProvider, condition: string, language = "en") {
  const isSpanish = activeLanguage(language) === "es";
  const context = specialistProviderContext(provider, condition, language);

  return {
    conciergePrefill: {
      kind: "ride" as const,
      source: "specialist_finder" as const,
      message: isSpanish
        ? `Ayudame a preparar transporte seguro para esta cita o visita medica. Confirma conmigo antes de reservar.\n\n${context}`
        : `Help me prepare safe transport for this medical appointment or visit. Ask me to confirm before booking.\n\n${context}`,
    },
  };
}

export function specialistProviderServiceActionsFor(provider: SpecialistProvider): SpecialistProviderServiceAction[] {
  const actions: SpecialistProviderServiceAction[] = [];
  const phoneHref = sanitizePhoneHref(provider.phone);

  if (phoneHref) {
    actions.push({ kind: "call_provider", href: phoneHref });
  }

  actions.push({ kind: "book_appointment", href: provider.bookingUrl?.trim() || undefined });
  actions.push({ kind: "book_ride" });

  if (provider.mapsUrl) {
    actions.push({ kind: "open_map", href: provider.mapsUrl });
  }

  return actions;
}

const ScanFullScreenModal = ({
  scan,
  onClose,
  t,
}: {
  scan: WoundScan;
  onClose: () => void;
  t: TFunction;
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const sColors = SEVERITY_COLORS[scan.severity.toLowerCase()] ?? { bg: "#F3F4F6", text: "#374151" };
  const modalDate = new Date(scan.scanned_at).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      data-testid="modal-scan-fullscreen"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-[18px] py-[14px] flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-[8px]">
          <span
            data-testid="text-modal-scan-severity"
            className="font-body text-[12px] font-semibold px-[10px] py-[3px] rounded-full"
            style={{ background: sColors.bg, color: sColors.text }}
          >
            {t(`health.scanWound.severityLabel.${scan.severity.toLowerCase()}`, scan.severity)}
          </span>
          <p data-testid="text-modal-scan-title" className="font-body text-[14px] font-semibold text-white">{scan.result_title}</p>
        </div>
        <button
          data-testid="button-close-fullscreen-scan"
          onClick={onClose}
          aria-label={t("common.close", "Close")}
          className="p-[8px] rounded-full transition-colors hover:bg-white/20 active:scale-95"
        >
          <X size={20} color="#fff" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-[18px] min-h-0" onClick={(e) => e.stopPropagation()}>
        {scan.image_data ? (
          <img
            data-testid="img-modal-scan-full"
            src={scan.image_data}
            alt={scan.result_title}
            className="max-w-full max-h-full rounded-[16px] object-contain"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
          />
        ) : (
          <div
            data-testid="scan-image-not-retained"
            className="flex flex-col items-center gap-3 rounded-[18px] bg-white/10 px-8 py-7 text-center text-white"
          >
            <ShieldCheck size={32} aria-hidden="true" />
            <p className="font-body text-[14px] font-semibold">
              {t("showVyva.capture.imageNotRetained", "Image not retained")}
            </p>
          </div>
        )}
      </div>

      <div
        data-testid="section-modal-scan-advice"
        className="flex-shrink-0 rounded-t-[24px] px-[20px] pt-[18px] pb-[28px]"
        style={{ background: "#FFFFFF" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-[6px] mb-[10px]">
          <Clock size={12} style={{ color: "#9CA3AF" }} />
          <p data-testid="text-modal-scan-date" className="font-body text-[12px]" style={{ color: "#9CA3AF" }}>{modalDate}</p>
        </div>
        <p className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[6px]" style={{ color: "#7C3AED" }}>
          {t("health.pastScans.aiAdvice", "AI Advice")}
        </p>
        <p data-testid="text-modal-scan-advice" className="font-body text-[14px] text-vyva-text-1 leading-snug">{scan.advice}</p>
      </div>
    </div>
  );
};

const HealthScreen = () => {
  const { t } = useTranslation();
  const { language: appLanguage } = useLanguage();
  const { firstName, profile } = useProfile();
  const healthPresentation = useScreenPresentation({ screenId: "health" });
  const navigate = useNavigate();
  const { guardPath, canUseService } = useServiceGate();
  const location = useLocation();
  const { toast } = useToast();
  const {
    stopDoctorVoice,
    status: doctorVoiceStatus,
    isVoiceLive: doctorVoiceLive,
    isSpeaking: doctorVoiceSpeaking,
    isConnecting: doctorVoiceConnecting,
    transcript: doctorVoiceTranscript,
    sendUserMessage: sendDoctorUserMessage,
  } = useDoctorVoice();

  const [seeDoctorOpen,    setSeeDoctorOpen]    = useState(false);
  const [visualScanOpen,   setVisualScanOpen]   = useState(false);
  const [specialistOpen,   setSpecialistOpen]   = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [specialistCondition, setSpecialistCondition] = useState("");
  const [specialistLocation, setSpecialistLocation] = useState("");
  const [specialistLocationEdited, setSpecialistLocationEdited] = useState(false);
  const [specialistResult, setSpecialistResult] = useState<SpecialistRecommendation | null>(null);
  const [specialistVoiceListening, setSpecialistVoiceListening] = useState(false);
  const [historialOpen,    setHistorialOpen]    = useState(false);
  const [expandedScanId,   setExpandedScanId]   = useState<string | null>(null);
  const [fullScreenScan,   setFullScreenScan]   = useState<WoundScan | null>(null);
  const [woundAnalyzing,   setWoundAnalyzing]   = useState(false);
  const [woundResult,      setWoundResult]      = useState<VisualScanResult | null>(null);
  const [showVyvaPasteReview, setShowVyvaPasteReview] = useState<ShowVyvaPastePayload | null>(null);
  const [showVyvaEvidenceReview, setShowVyvaEvidenceReview] = useState<ShowVyvaReviewContract | null>(null);
  const [visualScanCaptureSource, setVisualScanCaptureSource] = useState<Extract<ShowVyvaCaptureSource, "camera" | "upload">>("camera");
  const [visualCaptureDraft, setVisualCaptureDraft] = useState<ShowVyvaPreparedEvidence | null>(null);
  const [visualCapturePreparing, setVisualCapturePreparing] = useState(false);
  const [visualLiveCameraOpen, setVisualLiveCameraOpen] = useState(false);
  const [visualScanReviewInput, setVisualScanReviewInput] = useState<ShowVyvaFileReviewInput>({
    useCaseId: SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
    source: "camera",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const specialistRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    const state = location.state as { openVisualScan?: boolean } | null;
    if (state?.openVisualScan) {
      setVisualScanOpen(true);
    }
  }, [location.state]);

  const headlineBase = t("health.allGoodToday", "All good today");
  const headlineText = firstName ? `${headlineBase}, ${firstName}` : headlineBase;
  const specialistLanguage = activeLanguage(appLanguage);

  const profileLocation = useMemo(() => {
    return profileLocationFromParts({
      street: profile?.street,
      postalCode: profile?.postalCode,
      cityState: profile?.cityState,
      region: profile?.region,
      country: profile?.country,
    });
  }, [profile?.street, profile?.postalCode, profile?.cityState, profile?.region, profile?.country]);

  const { data: personalisationData } = useQuery<{
    conditions: string[];
    hobbies: string[];
    hasMedications: boolean;
  }>({
    queryKey: ["/api/profile/personalisation"],
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!specialistLocationEdited && profileLocation && !specialistLocation.trim()) {
      setSpecialistLocation(profileLocation);
    }
  }, [profileLocation, specialistLocation, specialistLocationEdited]);

  const { data: pastScans = [], isLoading: pastScansLoading } = useQuery<WoundScan[]>({
    queryKey: ["/api/wound-scan/history"],
    retry: false,
  });
  const { data: reportsSummary } = useQuery<ReportsSummary>({
    queryKey: ["/api/reports/summary"],
    retry: false,
    staleTime: 60 * 1000,
  });
  const { data: profileContacts } = useQuery<ProfileContactsResponse>({
    queryKey: ["/api/profile"],
    retry: false,
    staleTime: 2 * 60 * 1000,
  });
  const { data: medicationReport } = useQuery<MedicationAdherenceReport>({
    queryKey: ["/api/meds/adherence-report"],
    retry: false,
    staleTime: 60 * 1000,
  });
  const { data: latestVitalsData } = useQuery<LatestVitalsResponse>({
    queryKey: ["/api/vitals-engine/latest"],
    retry: false,
    staleTime: 60 * 1000,
  });
  const { data: preventionFocus } = useQuery<PreventionFocusResponse>({
    queryKey: ["/api/health/prevention"],
    retry: false,
    staleTime: 60 * 1000,
  });
  const { data: dailyCheckinToday } = useQuery<DailyCheckinToday>({
    queryKey: ["/api/checkins/today"],
    retry: false,
    staleTime: 60 * 1000,
  });
  const markDoseTakenMutation = useMutation({
    mutationFn: async (dose: MedicationDueSummary) => {
      const res = await apiFetch("/api/meds/adherence-report/confirm", {
        method: "POST",
        body: JSON.stringify({
          medication_name: dose.medication_name,
          scheduled_time: dose.scheduled_time,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body?.error === "string" ? body.error : "Could not mark medicine taken");
      }
      return res.json();
    },
    onSuccess: (_row, dose) => {
      const takenAt = new Date().toISOString();
      queryClient.setQueryData<MedicationAdherenceReport>(["/api/meds/adherence-report"], (current) => {
        if (!current) return current;
        const todaySummary = current.todaySummary
          ? {
              ...current.todaySummary,
              taken: Math.min(current.todaySummary.scheduled, current.todaySummary.taken + 1),
              remaining: Math.max(0, current.todaySummary.remaining - 1),
              pendingMedicationCount: current.todaySummary.remaining <= 1
                ? Math.max(0, current.todaySummary.pendingMedicationCount - 1)
                : current.todaySummary.pendingMedicationCount,
              completedMedicationCount: current.todaySummary.remaining <= 1
                ? current.todaySummary.completedMedicationCount + 1
                : current.todaySummary.completedMedicationCount,
            }
          : current.todaySummary;
        return {
          ...current,
          latestTaken: {
            medication_name: dose.medication_name,
            scheduled_time: dose.scheduled_time,
            confirmed_taken_at: takenAt,
          },
          nextDue: todaySummary?.remaining ? current.nextDue ?? null : null,
          todaySummary,
        };
      });
      toast({ description: t("health.planLead.markTakenSuccess", "{{name}} marked taken.", { name: dose.medication_name }) });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/summary"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      toast({
        description: message.toLowerCase().includes("fully confirmed")
          ? t("health.planLead.markTakenAlready", "This medicine is already marked taken today.")
          : t("health.planLead.markTakenError", "I could not mark that medicine taken. Please try again."),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
    },
  });
  const latestTriage = reportsSummary?.latestTriage ?? null;
  const latestTriageDate = latestTriage?.created_at
    ? new Date(latestTriage.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : "";
  const latestTriageTone = latestTriage?.urgency === "urgent"
    ? { icon: AlertTriangle, bg: "#FFF1F2", text: "#BE123C", label: t("informes.urgency.urgent", "Urgent") }
    : latestTriage?.urgency === "routine"
      ? { icon: AlertTriangle, bg: "#FFF7ED", text: "#B45309", label: t("informes.urgency.routine", "Routine") }
      : { icon: CheckCircle2, bg: "#ECFDF5", text: "#047857", label: t("informes.urgency.monitor", "Monitor") };
  const LatestTriageIcon = latestTriageTone.icon;
  const latestTriageDoctorContext = latestTriage
    ? [
        `${t("health.latestSymptomCheck.kicker", "Recent symptom check")}: ${latestTriage.chief_complaint}`,
        `${t("health.symptomCheck.report.urgencyLabel", "Urgency")}: ${latestTriageTone.label}`,
        latestTriage.symptoms?.length ? `${t("health.symptomCheck.report.symptoms", "Symptoms noted")}: ${latestTriage.symptoms.join(", ")}` : "",
        latestTriage.bpm != null ? `${t("health.symptomCheck.scan.heartRate", "Heart Rate")}: ${latestTriage.bpm} bpm` : "",
        latestTriage.respiratory_rate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Resp. Rate")}: ${latestTriage.respiratory_rate} rpm` : "",
        latestTriage.recommendations?.length ? `${t("health.symptomCheck.report.recommendations", "What to do next")}: ${latestTriage.recommendations.join(" ")}` : "",
      ].filter(Boolean).join("\n")
    : "";
  const latestTriageEmergencyContact = emergencyContactForCountry(profileContacts?.country ?? profile?.country);
  const latestTriageActions = latestTriageServiceActionsFor({
    report: latestTriage,
    country: profileContacts?.country ?? profile?.country,
    gpPhone: profileContacts?.gpPhone,
    gpEmail: profileContacts?.gpEmail,
    doctorContext: latestTriageDoctorContext,
    labels: {
      call_emergency: latestTriageEmergencyContact?.label ? `${t("common.call", "Call")} ${latestTriageEmergencyContact.label}` : t("health.symptomCheck.report.contactEmergencyServices", "Contact emergency services"),
      call_gp: t("health.symptomCheck.report.actions.callGp", "Call GP"),
      email_gp: t("health.symptomCheck.report.actions.emailGp", "Email GP"),
      doctor_help: t("health.symptomCheck.report.actions.doctorHelp", "Doctor help"),
      book_ride: t("health.symptomCheck.report.actions.bookRide", "Find transport"),
      schedule_appointment: t("health.symptomCheck.report.actions.scheduleAppointment", "Appointment"),
      online_order: t("health.symptomCheck.report.actions.onlineOrder", "Online order"),
      request_quote: t("health.symptomCheck.report.actions.requestQuote", "Request quote"),
    },
  });
  const latestTriageActionIcons: Record<HealthHomeServiceActionKind, LucideIcon> = {
    call_emergency: PhoneCall,
    call_gp: PhoneCall,
    email_gp: Mail,
    doctor_help: Stethoscope,
    book_ride: Car,
    schedule_appointment: Calendar,
    online_order: ShoppingBasket,
    request_quote: ClipboardList,
    open_report: ClipboardList,
  };
  const openLatestTriageAction = (action: HealthHomeServiceAction) => {
    if (action.to) {
      navigate(action.to, action.state ? { state: action.state } : undefined);
    }
  };
  const seeDoctorContext = latestTriageDoctorContext
    || t(
      "health.seeDoctor.actions.defaultContext",
      "Health home doctor support request. Ask what is needed and help prepare a safe next step.",
    );
  const seeDoctorActions = healthDoctorQuickActionsFor({
    gpPhone: profileContacts?.gpPhone ?? profile?.gpPhone,
    gpEmail: profileContacts?.gpEmail ?? profile?.gpEmail,
    gpName: profile?.gpName,
    doctorContext: seeDoctorContext,
    labels: {
      call_gp: profile?.gpName
        ? t("health.seeDoctor.actions.callGpNamed", "Call {{name}}", { name: profile.gpName })
        : t("health.seeDoctor.actions.callGp", "Call GP"),
      email_gp: t("health.seeDoctor.actions.emailGp", "Email GP"),
      doctor_help: t("health.seeDoctor.actions.doctorHelp", "Doctor help"),
      schedule_appointment: t("health.seeDoctor.actions.bookAppointment", "Book appointment"),
      book_ride: t("health.seeDoctor.actions.bookTransport", "Find transport"),
      add_doctor_contact: t("health.seeDoctor.actions.addGp", "Add GP contact"),
    },
    descriptions: {
      call_gp: t("health.seeDoctor.actions.callGpSub", "Speak to your practice now."),
      email_gp: t("health.seeDoctor.actions.emailGpSub", "Open an email with context filled in."),
      doctor_help: t("health.seeDoctor.actions.doctorHelpSub", "Talk through the next step with VYVA."),
      schedule_appointment: t("health.seeDoctor.actions.bookAppointmentSub", "VYVA prepares the request for approval."),
      book_ride: t("health.seeDoctor.actions.bookTransportSub", "Compare safe ways to get there."),
      add_doctor_contact: t("health.seeDoctor.actions.addGpSub", "Save phone or email first."),
    },
    messages: {
      appointment: t(
        "health.seeDoctor.actions.appointmentPrefill",
        "Please help me schedule a doctor appointment. Ask me to confirm before booking anything.\n\n{{context}}",
        { context: seeDoctorContext },
      ),
      ride: t(
        "health.seeDoctor.actions.ridePrefill",
        "Please help me find safe transport options for a medical appointment. Ask me to confirm before booking anything.\n\n{{context}}",
        { context: seeDoctorContext },
      ),
    },
  });
  const seeDoctorActionIcons: Record<HealthDoctorQuickActionKind, LucideIcon> = {
    call_gp: PhoneCall,
    email_gp: Mail,
    doctor_help: Stethoscope,
    schedule_appointment: Calendar,
    book_ride: Car,
    add_doctor_contact: UserSearch,
  };
  const hasDoctorContact = Boolean(profileContacts?.gpPhone || profile?.gpPhone || profileContacts?.gpEmail || profile?.gpEmail);
  const openDoctorProviderSetup = () => {
    navigate("/onboarding/profile/providers", {
      state: {
        setupFocus: "doctor_clinic",
        returnTo: "/health/doctor",
        notice: t("health.seeDoctor.providerSetupNotice", "Add your usual doctor or clinic. VYVA will bring you back to Health afterwards."),
        providerSetupHelpRequested: {
          flowReference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
          setupFocus: "doctor_clinic",
          setupReason: t("health.seeDoctor.providerHelperReason", "Ask someone you trust to help save your usual doctor or clinic."),
        },
      },
    });
  };
  const findDoctorOptions = () => {
    navigate("/concierge", {
      state: {
        conciergePrefill: {
          kind: "appointment",
          message: t(
            "health.seeDoctor.findOptionsPrefill",
            "Help me find doctor or clinic options nearby. Compare proximity, availability, reputation, accessibility, and coverage. Ask me to confirm before contacting anyone.",
          ),
          source: "health_missing_provider",
        },
      },
    });
  };
  const askHelperForDoctorSetup = () => {
    navigate("/onboarding/profile/care-team", {
      state: {
        returnTo: "/health/doctor",
        providerSetupHelpRequested: {
          flowReference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
          setupFocus: "doctor_clinic",
          setupReason: t("health.seeDoctor.providerHelperReason", "Ask someone you trust to help save your usual doctor or clinic."),
        },
      },
    });
  };
  const openSeeDoctorAction = (action: HealthDoctorQuickAction) => {
    if (action.kind === "add_doctor_contact") {
      openDoctorProviderSetup();
      return;
    }
    if (action.to) {
      navigate(action.to, action.state ? { state: action.state } : undefined);
    }
  };
  const visualScanContext = woundResult ? visualScanDoctorContext(woundResult) : "";
  const visualScanGpPhoneHref = sanitizePhoneHref(profileContacts?.gpPhone ?? profile?.gpPhone);
  const visualScanGpEmail = (profileContacts?.gpEmail ?? profile?.gpEmail ?? "").trim();
  const visualScanGpName = (profile?.gpName ?? "").trim();
  const visualScanGpEmailHref = visualScanGpEmail && visualScanContext
    ? `mailto:${visualScanGpEmail}?subject=${encodeURIComponent(t("health.scanWound.actions.emailSubject", "VYVA visual health scan"))}&body=${encodeURIComponent(visualScanContext)}`
    : "";
  const visualScanActions: VisualScanAction[] = woundResult
    ? visualScanServiceActionKindsFor(woundResult, {
        hasGpPhone: Boolean(visualScanGpPhoneHref),
        hasGpEmail: Boolean(visualScanGpEmailHref),
      }).map((kind) => {
        if (kind === "call_gp") {
          return {
            kind,
            label: visualScanGpName
              ? t("health.scanWound.actions.callGpNamed", "Call {{name}}", { name: visualScanGpName })
              : t("health.scanWound.actions.callGp", "Call GP"),
            Icon: PhoneCall,
            href: visualScanGpPhoneHref,
          };
        }

        if (kind === "email_gp") {
          return {
            kind,
            label: t("health.scanWound.actions.emailGp", "Email GP"),
            Icon: Mail,
            href: visualScanGpEmailHref,
          };
        }

        if (kind === "doctor_help") {
          return {
            kind,
            label: t("health.scanWound.actions.doctorHelp", "Doctor help"),
            Icon: Stethoscope,
            onClick: () => guardPath("/health/doctor", {
              state: {
                autoStartVoice: true,
                latestSymptomReport: visualScanContext,
                source: "visual_scan",
              },
            }),
          };
        }

        if (kind === "schedule_appointment") {
          return {
            kind,
            label: t("health.scanWound.actions.appointment", "Appointment"),
            Icon: Calendar,
            onClick: () => navigate("/concierge", {
              state: {
                conciergePrefill: {
                  kind: "appointment",
                  message: activeLanguage(appLanguage) === "es"
                    ? `Ayudame a preparar una cita clinica para revisar este escaneo visual de VYVA. Confirma conmigo antes de reservar.\n\n${visualScanContext}`
                    : `Help me prepare a clinical appointment to review this VYVA visual scan. Ask me to confirm before booking.\n\n${visualScanContext}`,
                  source: "visual_scan",
                },
              },
            }),
          };
        }

        return {
          kind,
          label: t("health.scanWound.actions.ride", "Find transport"),
          Icon: Car,
          onClick: () => navigate("/concierge", {
            state: {
              conciergePrefill: {
                kind: "ride",
                message: activeLanguage(appLanguage) === "es"
                  ? `Ayudame a preparar transporte seguro para una revision clinica de este escaneo visual de VYVA. Confirma conmigo antes de reservar.\n\n${visualScanContext}`
                  : `Help me prepare safe transport for a clinical review of this VYVA visual scan. Ask me to confirm before booking.\n\n${visualScanContext}`,
                source: "visual_scan",
              },
            },
          }),
        };
      })
    : [];

  const handleVisualScanFollowUpSelect = (
    action: ShowVyvaFollowUpAction,
    contract: ShowVyvaReviewContract,
  ) => {
    const preparedReceipt = buildWorkflowReceiptMoment({
      workflowReference: APP_WORKFLOW_REFERENCES.visualScan,
      status: "prepared",
      capturedSummary: t("showVyva.executor.saved", "Saved. Continue in Concierge when you are ready."),
      locale: activeLanguage(appLanguage) === "es" ? "es" : "en",
    });
    const plan = buildShowVyvaActionExecutionPlan({
      contract,
      action,
      language: appLanguage,
      sourceRoute: "/health",
      target: action.id === "call_gp" || action.id === "email_gp"
        ? {
            name: visualScanGpName || t("health.scanWound.actions.gpFallback", "GP"),
            phone: profileContacts?.gpPhone ?? profile?.gpPhone,
            email: visualScanGpEmail,
            relationship: "gp",
          }
        : undefined,
    });

    void saveShowVyvaActionExecutionPlan(plan)
      .then(async () => {
        markShowVyvaReviewHistoryActionSaved(contract, action, plan.targetRoute);
        await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
        toast({ title: preparedReceipt.title, description: preparedReceipt.message });
        navigate(plan.targetRoute);
      })
      .catch(() => {
        toast({ description: t("showVyva.executor.error", "I could not save that step. Please try again.") });
      });
  };

  const deleteScanMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/wound-scan/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wound-scan/history"] });
    },
  });

  const specialistMutation = useMutation({
    mutationFn: async (input?: { condition?: string; location?: string }) => {
      const condition = input?.condition ?? specialistCondition;
      const location = input?.location ?? (specialistLocation.trim() || profileLocation || "Tarifa, Cadiz");
      const res = await apiFetch("/api/specialists/recommendations", {
        method: "POST",
        body: JSON.stringify({
          condition,
          location,
          language: specialistLanguage,
          urgency: "routine",
        }),
      });
      if (!res.ok) throw new Error("Specialist search failed");
      return res.json() as Promise<SpecialistRecommendation>;
    },
    onSuccess: (data) => setSpecialistResult(data),
    onError: () => {
      toast({ description: t("health.findSpecialist.searchError", "I could not search for specialists right now. Please try again in a moment.") });
    },
  });

  const runSpecialistSearch = (condition = specialistCondition) => {
    const trimmedCondition = condition.trim();
    if (!trimmedCondition) {
      toast({ description: t("health.findSpecialist.emptyCondition", "Tell me the condition or need so I can find the right specialist.") });
      return;
    }
    setSpecialistCondition(trimmedCondition);
    setSpecialistResult(null);
    specialistMutation.mutate({ condition: trimmedCondition, location: specialistLocation.trim() || profileLocation || "Tarifa, Cadiz" });
  };

  const askExpertCards: Array<{
    id: string;
    label: string;
    detail: string;
    Icon: LucideIcon;
    iconBg: string;
    iconColor: string;
    onClick: () => void;
  }> = [
    {
      id: "elena-ruiz",
      label: t("health.findSpecialist.experts.elena.label", "Elena Ruiz"),
      detail: t("health.findSpecialist.experts.elena.detail", "Urban gardener"),
      Icon: Flower2,
      iconBg: "#ECFDF5",
      iconColor: "#16A34A",
      onClick: () => navigate("/social-rooms/garden-corner"),
    },
    {
      id: "viktor-sanz",
      label: t("health.findSpecialist.experts.viktor.label", "Viktor Sanz"),
      detail: t("health.findSpecialist.experts.viktor.detail", "Games companion"),
      Icon: Gamepad2,
      iconBg: "#FFF7ED",
      iconColor: "#F59E0B",
      onClick: () => navigate("/social-rooms/games-room"),
    },
    {
      id: "lola-martinez",
      label: t("health.findSpecialist.experts.lola.label", "Lola Martínez"),
      detail: t("health.findSpecialist.experts.lola.detail", "Mediterranean chef"),
      Icon: ChefHat,
      iconBg: "#FFF7ED",
      iconColor: "#C2410C",
      onClick: () => navigate("/social-rooms/kitchen-table"),
    },
    {
      id: "amara-osei",
      label: t("health.findSpecialist.experts.amara.label", "Amara Osei"),
      detail: t("health.findSpecialist.experts.amara.detail", "Movement guide"),
      Icon: Activity,
      iconBg: "#EFF6FF",
      iconColor: "#0284C7",
      onClick: () => navigate("/social-rooms/morning-movement"),
    },
    {
      id: "marco-reyes",
      label: t("health.findSpecialist.experts.marco.label", "Marco Reyes"),
      detail: t("health.findSpecialist.experts.marco.detail", "Calm guide"),
      Icon: HeartPulse,
      iconBg: "#EEF2FF",
      iconColor: "#4F46E5",
      onClick: () => navigate("/social-rooms/evening-wind-down"),
    },
    {
      id: "diego-salinas",
      label: t("health.findSpecialist.experts.diego.label", "Diego Salinas"),
      detail: t("health.findSpecialist.experts.diego.detail", "Musicologist"),
      Icon: Music,
      iconBg: "#F5F3FF",
      iconColor: "#7E22CE",
      onClick: () => navigate("/social-rooms/music-room"),
    },
    {
      id: "isabel-fuentes",
      label: t("health.findSpecialist.experts.isabel.label", "Isabel Fuentes"),
      detail: t("health.findSpecialist.experts.isabel.detail", "Literary host"),
      Icon: BookOpen,
      iconBg: "#FFF7ED",
      iconColor: "#7C2D12",
      onClick: () => navigate("/social-rooms/reading-room"),
    },
  ];

  const stopSpecialistVoice = () => {
    specialistRecognitionRef.current?.stop();
    specialistRecognitionRef.current = null;
    setSpecialistVoiceListening(false);
  };

  const startSpecialistVoice = () => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      toast({ description: t("health.findSpecialist.voiceUnsupported", "Voice dictation is not available here. You can type the condition.") });
      return;
    }

    const recognition = new Recognition();
    recognition.lang = specialistLanguage === "en" ? "en-US" : specialistLanguage === "de" ? "de-DE" : "es-ES";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        setSpecialistCondition(transcript);
        runSpecialistSearch(transcript);
      }
    };
    recognition.onerror = () => {
      toast({ description: t("health.findSpecialist.voiceError", "I could not hear clearly. Try again or type it.") });
      setSpecialistVoiceListening(false);
    };
    recognition.onend = () => {
      setSpecialistVoiceListening(false);
      specialistRecognitionRef.current = null;
    };

    specialistRecognitionRef.current = recognition;
    setSpecialistVoiceListening(true);
    recognition.start();
  };

  useEffect(() => () => {
    specialistRecognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    if (!new URLSearchParams(location.search).has("doctor")) return;

    setSeeDoctorOpen(true);
    const scrollTimer = window.setTimeout(() => {
      if (typeof document === "undefined") return;
      document.getElementById("health-see-doctor-card")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
    return () => window.clearTimeout(scrollTimer);
  }, [location.search]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (!searchParams.has("specialist") && !searchParams.has("provider")) return;

    setSpecialistOpen(true);
    const scrollTimer = window.setTimeout(() => {
      if (typeof document === "undefined") return;
      document.getElementById("health-specialist-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
    return () => window.clearTimeout(scrollTimer);
  }, [location.search]);

  const bookSpecialistMutation = useMutation({
    mutationFn: async (provider: SpecialistProvider) => {
      const specialty = displaySpecialty(provider, specialistLanguage);
      const providerName = provider.clinicName ?? provider.name;
      const res = await apiFetch("/api/concierge/actions/trigger", {
        method: "POST",
        body: JSON.stringify({
          use_case: "book_appointment",
          provider_name: providerName,
          provider_phone: provider.phone ?? null,
          found_externally: true,
          action_summary: activeLanguage(specialistLanguage) === "es"
            ? `Pedir una cita de ${specialty} en ${providerName}.`
            : `Request a ${specialty} appointment at ${providerName}.`,
          action_payload: {
            doctor_name: provider.name,
            practice_name: providerName,
            specialty,
            reason: specialistCondition,
            preferred_days: [],
            preferred_time: "",
            urgency: "routine",
            provider_address: provider.address ?? "",
            booking_url: provider.bookingUrl ?? "",
            source_name: provider.sourceName,
          },
          language: specialistLanguage,
          trigger_source: "user_request",
          auto_start: false,
        }),
      });
      if (!res.ok) throw new Error("Could not create appointment request");
      return res.json() as Promise<{ pendingId: string; status: string }>;
    },
    onSuccess: () => {
      toast({ description: t("health.findSpecialist.appointmentReady", "I prepared the request. I will take you to Concierge to confirm it.") });
      queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
      navigate("/concierge");
    },
    onError: () => {
      toast({ description: t("health.findSpecialist.appointmentError", "I could not prepare the appointment. Please try again in a moment.") });
    },
  });

  const shareSpecialistProvider = async (provider: SpecialistProvider) => {
    const specialty = displaySpecialty(provider, specialistLanguage);
    const location = provider.address ?? provider.clinicName ?? specialistLocation;
    const lines = [
      provider.name,
      specialty,
      provider.phone ? `${t("health.findSpecialist.phoneLabel", "Phone")}: ${provider.phone}` : null,
      location ? `${t("health.findSpecialist.locationLabel", "Location")}: ${location}` : null,
      provider.openingTimes ? `${t("health.findSpecialist.hoursLabel", "Hours")}: ${provider.openingTimes}` : null,
      provider.distanceLabel ? `${t("health.findSpecialist.distanceLabel", "Distance")}: ${provider.distanceLabel}` : null,
      provider.bookingUrl ? `${t("health.findSpecialist.moreInfoLabel", "More information")}: ${provider.bookingUrl}` : null,
      provider.mapsUrl ? `Google Maps: ${provider.mapsUrl}` : null,
    ].filter(Boolean).join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: provider.name, text: lines });
      } else {
        await navigator.clipboard.writeText(lines);
        toast({ description: t("health.findSpecialist.shareCopied", "Details copied for sharing.") });
      }
    } catch {
      toast({ description: t("health.findSpecialist.shareError", "I could not share it right now. Please try again.") });
    }
  };

  const prepareVisualCaptureFile = (file: File) => {
    const reviewInput = {
      ...visualScanReviewInput,
      fileName: file.name,
      mimeType: file.type,
    };
    setVisualScanReviewInput(reviewInput);
    setVisualCapturePreparing(true);

    prepareShowVyvaEvidenceFile(file)
      .then((evidence) => setVisualCaptureDraft(evidence))
      .catch((error) => {
        console.error("[show-vyva-capture] error:", error);
        toast({ description: t("showVyva.capture.error", "I could not prepare that item. Please try another photo or file.") });
      })
      .finally(() => setVisualCapturePreparing(false));
  };

  const handleWoundSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    prepareVisualCaptureFile(file);
  };

  const openVisualNativePicker = (source: Extract<ShowVyvaCaptureSource, "camera" | "upload">) => {
    setVisualLiveCameraOpen(false);
    setVisualScanCaptureSource(source);
    setVisualScanReviewInput((current) => ({ ...current, source }));
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const retakeVisualCapture = () => {
    setVisualCaptureDraft(null);
    if (visualScanReviewInput.source === "camera" && supportsShowVyvaLiveCamera()) {
      setVisualLiveCameraOpen(true);
      return;
    }
    openVisualNativePicker(visualScanReviewInput.source);
  };

  const submitWoundEvidence = async (evidence: ShowVyvaPreparedEvidence) => {
    const reviewInput = {
      ...visualScanReviewInput,
      fileName: evidence.fileName,
      mimeType: evidence.mimeType,
    };
    setVisualScanReviewInput(reviewInput);
    setVisualCaptureDraft(null);
    setShowVyvaPasteReview(null);
    setShowVyvaEvidenceReview(null);
    setWoundResult(null);
    setWoundAnalyzing(true);

    const errorFallback: VisualScanResult = {
      severity: "Minor",
      imageType: "unclear",
      resultTitle: t("health.scanWound.errorTitle"),
      visibleObservations: [],
      potentialConcerns: [t("health.scanWound.errorConcern", "The image could not be reviewed right now.")],
      uncertainty: [t("health.scanWound.errorUncertainty", "The assistant could not complete the image review.")],
      recommendedNextStep: t("health.scanWound.errorNextStep", "Please try again, or contact a healthcare professional if you are concerned."),
      advice: t("health.scanWound.errorAdvice"),
    };

    try {
      if (reviewInput.useCaseId !== SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto) {
        const contract = await reviewShowVyvaVisualEvidence({
          image: evidence.dataUrl,
          language: appLanguage,
          useCaseId: reviewInput.useCaseId,
          source: reviewInput.source,
          question: reviewInput.question,
          fileName: evidence.fileName,
          mimeType: evidence.mimeType,
        });
        setShowVyvaEvidenceReview(contract);
        return;
      }
      const res = await apiFetch("/api/wound-scan", {
        method: "POST",
        body: JSON.stringify({ image: evidence.dataUrl, language: appLanguage, question: reviewInput.question }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as VisualScanResult;
      if (data.isFallback) {
        setWoundResult(errorFallback);
      } else {
        setWoundResult(data);
        queryClient.invalidateQueries({ queryKey: ["/api/wound-scan/history"] });
      }
    } catch (err) {
      console.error("[wound-scan] error:", err);
      setWoundResult(errorFallback);
    } finally {
      setWoundAnalyzing(false);
    }
  };

  const openVisualScanFilePicker = (
    source: Extract<ShowVyvaCaptureSource, "camera" | "upload">,
    useCaseId: ShowVyvaUseCaseId = SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
    question = "",
  ) => {
    setVisualScanCaptureSource(source);
    setVisualScanReviewInput({
      useCaseId,
      source,
      fileName: null,
      mimeType: null,
      question,
    });
    if (source === "camera" && supportsShowVyvaLiveCamera()) {
      setVisualLiveCameraOpen(true);
      return;
    }
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const openShowVyvaConciergeReview = (payload: ShowVyvaPastePayload) => {
    setWoundResult(null);
    setShowVyvaEvidenceReview(null);
    setShowVyvaPasteReview(payload);
    setVisualScanOpen(true);
  };

  const latestVitalsReadings = latestVitalsData?.recent_readings ?? [];
  const preferredVitals = preferredVitalsReading(latestVitalsReadings);
  const latestVitalsValue = preferredVitals?.value ?? "";
  const latestVitalsTime = formatHealthHomeTimestamp(preferredVitals?.recordedAt ?? latestTimeFromReadings(latestVitalsReadings));
  const secondaryVitalsValues = [
    "resting_hr_bpm",
    "respiratory_rate",
    "oxygen_saturation",
  ]
    .map((signal) => latestVitalsReadings.find((reading) => reading.signal_type === signal))
    .filter((reading): reading is LatestVitalReading => Boolean(reading))
    .map((reading) => formatLatestVitalReading(reading, latestVitalsReadings))
    .filter((value) => value && value !== latestVitalsValue)
    .slice(0, 2);
  const vitalsSafetyStatus = normalizeVitalsSafetyStatus(
    latestVitalsData?.analysis?.recommended_action ?? latestVitalsData?.analysis?.safety_status,
  );
  const vitalsNeedsReview = vitalsSafetyStatus !== "steady" || Boolean(latestVitalsData?.latest_alert?.severity && latestVitalsData.latest_alert.severity !== "info");
  const vitalsSnapshot: HealthHomeVitalsSnapshot = {
    value: latestVitalsValue || t("health.planLead.vitalsEmptyValue", "Add vitals"),
    detail: latestVitalsValue
      ? latestVitalsTime
        ? t("health.planLead.vitalsUpdated", "Updated {{time}}", { time: latestVitalsTime })
        : t("health.planLead.vitalsFresh", "Latest capture")
      : t("health.planLead.vitalsEmptyDetail", "BP, pulse, or breathing"),
    timeLabel: latestVitalsTime,
    statusLabel: !latestVitalsValue
      ? t("health.planLead.vitalsStatusMissing", "Add vitals")
      : vitalsNeedsReview
        ? t("health.planLead.vitalsStatusReview", "Needs review")
        : t("health.planLead.vitalsStatusStable", "Stable"),
    secondaryValues: secondaryVitalsValues,
    tone: !latestVitalsValue
      ? { bg: "#F5F3FF", text: "#6B21A8", border: "#DDD6FE", iconBg: "#EDE9FE" }
      : vitalsNeedsReview
        ? { bg: "#FFF7ED", text: "#B45309", border: "#FED7AA", iconBg: "#FFEDD5" }
        : { bg: "#ECFDF5", text: "#047857", border: "#BBF7D0", iconBg: "#D1FAE5" },
    hasReading: Boolean(latestVitalsValue),
    needsReview: vitalsNeedsReview,
  };
  const latestTaken = medicationReport?.latestTaken ?? null;
  const nextDue = medicationReport?.nextDue ?? null;
  const medicationToday = medicationReport?.todaySummary;
  const latestTakenTime = formatHealthHomeTimestamp(latestTaken?.confirmed_taken_at);
  const latestTakenDoseTime = formatMedicationScheduledTime(latestTaken?.scheduled_time);
  const nextDueTime = formatMedicationScheduledTime(nextDue?.scheduled_time);
  const nextDueIsTonight = isScheduledDoseTonight(nextDue?.scheduled_time);
  const nextMedicineDueSummary = nextDue
    ? nextDueTime
      ? t("health.planLead.nextMedicineDueAt", "{{name}} due at {{time}}", {
          name: nextDue.medication_name,
          time: nextDueTime,
        })
      : t("health.planLead.nextMedicineDue", "{{name}} due", { name: nextDue.medication_name })
    : "";
  const medicineDoseLeftSummary = medicationToday?.remaining
    ? medicationToday.remaining === 1
      ? t("health.planLead.oneDoseLeft", "1 dose left today")
      : t("health.planLead.dosesLeft", "{{count}} doses left today", { count: medicationToday.remaining })
    : "";
  const medicationDueShort = medicationToday?.remaining
    ? t("health.homeSignals.medication.dueShort", "{{count}} due", { count: medicationToday.remaining })
    : "";
  const medicineValue = medicationToday?.scheduled
    ? medicationToday.remaining > 0
      ? medicationToday.remaining === 1 && nextDue
        ? nextDueIsTonight
          ? t("health.homeTools.medicine.oneDueTonight", "1 due tonight")
          : nextDueTime
            ? t("health.homeTools.medicine.oneDueAt", "1 due {{time}}", { time: nextDueTime })
            : t("health.homeSignals.medication.dueShort", "{{count}} due", { count: 1 })
        : t("health.homeSignals.medication.dueShort", "{{count}} due", { count: medicationToday.remaining })
      : t("health.homeSignals.medication.allTaken", "Done today")
    : latestTaken
      ? latestTaken.medication_name
      : t("health.homeSignals.medication.empty", "No medicine schedule yet");
  const medicineDetail = latestTaken
    ? latestTakenTime
      ? t("health.homeSignals.medication.lastTakenDetail", "{{name}} last {{time}}", {
          name: latestTaken.medication_name,
          time: latestTakenTime,
        })
      : [
          latestTaken.medication_name,
          medicationDueShort || (latestTakenDoseTime ? t("health.homeSignals.medication.doseTime", "Dose {{time}}", { time: latestTakenDoseTime }) : ""),
        ].filter(Boolean).join(" - ")
    : medicationToday?.scheduled
      ? t("health.homeSignals.medication.todayProgress", "{{taken}}/{{scheduled}} taken", {
          taken: medicationToday.taken,
          scheduled: medicationToday.scheduled,
        })
      : t("health.homeSignals.medication.emptyDetail", "Add schedule");
  const latestDataTimestamp = latestHealthTimestamp([
    preferredVitals?.recordedAt ?? latestTimeFromReadings(latestVitalsReadings),
    latestTaken?.confirmed_taken_at,
    dailyCheckinToday?.latest_checkin?.completed_at,
    latestTriage?.created_at,
  ]);
  const latestDataLabel = latestDataTimestamp
    ? t("health.planLead.updatedAt", "Updated {{time}}", { time: formatHealthHomeTimestamp(latestDataTimestamp) })
    : "";
  const checkinStatusLabel =
    dailyCheckinToday?.status === "completed" ? t("health.dailyCheckin.completed", "Checked in today") :
    dailyCheckinToday?.status === "overdue" ? t("health.dailyCheckin.overdue", "Check-in overdue") :
    dailyCheckinToday?.status === "due_now" ? t("health.dailyCheckin.due", "Ready now") :
    dailyCheckinToday?.status === "not_scheduled" ? t("health.dailyCheckin.setup", "Set up") :
    t("health.dailyCheckin.upcoming", "Scheduled");
  const checkinCompletedTime = formatHealthHomeTimestamp(dailyCheckinToday?.latest_checkin?.completed_at);
  const checkinNextTime = formatHealthHomeTimestamp(dailyCheckinToday?.schedule?.next_run_at);
  const checkinDetail =
    dailyCheckinToday?.status === "completed" && checkinCompletedTime
      ? dailyCheckinToday?.trend?.streak_days
        ? t("health.homeSignals.checkin.streak", "{{count}} day streak", { count: dailyCheckinToday.trend.streak_days })
        : t("health.homeSignals.checkin.completedAt", "Done {{time}}", { time: checkinCompletedTime })
      : checkinNextTime
        ? t("health.homeSignals.checkin.nextAt", "Next {{time}}", { time: checkinNextTime })
        : dailyCheckinToday?.message || t("health.homeSignals.checkin.emptyDetail", "Quick status");
  const checkinTone = dailyCheckinTone(dailyCheckinToday?.status);
  const checkinValue = dailyCheckinToday?.status === "completed"
    ? dailyCheckinToday.latest_checkin?.feeling_label || t("health.homeSignals.checkin.doneShort", "Done")
    : checkinStatusLabel;
  const steadyCheckinSummary = dailyCheckinToday?.status === "completed"
    ? dailyCheckinToday?.trend?.streak_days
      ? t("health.planLead.steadyCheckinStreak", "{{count}} day check-in streak", { count: dailyCheckinToday.trend.streak_days })
      : dailyCheckinToday.latest_checkin?.feeling_label || t("health.planLead.steadyCheckinDone", "Check-in done")
    : dailyCheckinToday?.status
      ? checkinStatusLabel
      : "";
  const steadyMedicineSummary = medicationToday?.remaining
    ? t("health.planLead.steadyMedicineDue", "{{count}} medicine due later", { count: medicationToday.remaining })
    : medicationToday?.scheduled
      ? t("health.planLead.steadyMedicineClear", "Medicines covered")
      : "";
  const steadyPlanSummary = [
    steadyCheckinSummary,
    steadyMedicineSummary,
  ].filter(Boolean).slice(0, 2).join(" - ");
  const symptomAdvice = latestTriage?.recommendations?.map((item) => item.trim()).find(Boolean) ?? "";
  const latestMedicineTakenSummary = latestTaken && latestTakenTime
    ? t("health.planLead.latestMedicineTaken", "{{name}} last {{time}}", {
        name: latestTaken.medication_name,
        time: latestTakenTime,
      })
    : "";
  const vitalsPlanReason = !vitalsSnapshot.hasReading
    ? t("health.planLead.reasonVitalsMissing", "Vitals missing")
    : vitalsSnapshot.needsReview
      ? t("health.planLead.reasonVitalsReview", "Vitals need review")
      : t("health.planLead.reasonVitalsStable", "Vitals stable");
  const medicinePlanReason = medicineDoseLeftSummary || t("health.planLead.insightMedicineDetail", "{{taken}}/{{scheduled}} taken", {
    taken: medicationToday?.taken ?? 0,
    scheduled: medicationToday?.scheduled ?? 0,
  });
  const medicinePlanDetail = [
    vitalsSnapshot.hasReading && !vitalsSnapshot.needsReview ? vitalsPlanReason : "",
    medicinePlanReason,
  ].filter(Boolean).join(". ");
  const primaryInsight: HealthHomeInsight = (() => {
    if (vitalsSnapshot.needsReview) {
      return {
        Icon: Activity,
        title: t("health.planLead.insightVitalsReview", "Vitals need review"),
        detail: latestVitalsData?.analysis?.senior_message
          ?? latestVitalsData?.latest_alert?.message
          ?? (latestVitalsValue ? t("health.planLead.insightVitalsDetail", "{{capture}} is the latest capture.", { capture: latestVitalsValue }) : vitalsSnapshot.detail),
        tone: { bg: "#FFF7ED", text: "#B45309", iconBg: "#FFEDD5" },
      };
    }

    if (latestTriage?.urgency === "urgent" || latestTriage?.urgency === "routine") {
      return {
        Icon: HeartPulse,
        title: t("health.planLead.insightSymptomsReview", "Review symptom follow-up"),
        detail: t("health.planLead.insightSymptomsDetail", "{{symptom}} - {{urgency}}", {
          symptom: latestTriage.chief_complaint,
          urgency: latestTriageTone.label,
        }),
        tone: { bg: "#FFF1F2", text: "#BE123C", iconBg: "#FFE4E6" },
      };
    }

    if (!vitalsSnapshot.hasReading) {
      return {
        Icon: Activity,
        title: t("health.planLead.insightAddVitals", "Add one BP reading"),
        detail: t("health.planLead.insightAddVitalsDetail", "Start your baseline with blood pressure, pulse, or breathing."),
        tone: { bg: "#F5F3FF", text: "#6B21A8", iconBg: "#EDE9FE" },
      };
    }

    if (dailyCheckinToday?.status && dailyCheckinToday.status !== "completed") {
      return {
        Icon: Calendar,
        title: t("health.planLead.insightCheckin", "Check in today"),
        detail: checkinNextTime
          ? t("health.planLead.insightCheckinDetail", "Next check-in {{time}}", { time: checkinNextTime })
          : checkinStatusLabel,
        tone: { bg: "#EFF6FF", text: "#2563EB", iconBg: "#DBEAFE" },
      };
    }

    if (medicationToday?.remaining && medicationToday.remaining > 0 && nextMedicineDueSummary) {
      return {
        Icon: Pill,
        title: nextMedicineDueSummary,
        detail: medicinePlanDetail,
        tone: { bg: "#FDF4FF", text: "#86198F", iconBg: "#F5D0FE" },
      };
    }

    if (medicationToday?.remaining && medicationToday.remaining > 0 && !latestTaken && medicationToday.taken === 0) {
      return {
        Icon: Pill,
        title: t("health.planLead.insightMedicine", "Review medicines today"),
        detail: t("health.planLead.insightMedicineDetail", "{{taken}}/{{scheduled}} taken", {
          taken: medicationToday.taken,
          scheduled: medicationToday.scheduled,
        }),
        tone: { bg: "#FFF7ED", text: "#B45309", iconBg: "#FFEDD5" },
      };
    }

    if (medicationToday?.remaining && medicationToday.remaining > 0) {
      return {
        Icon: Pill,
        title: t("health.planLead.insightMedicineLater", "Take {{count}} medicine later", { count: medicationToday.remaining }),
        detail: latestMedicineTakenSummary || steadyCheckinSummary || steadyMedicineSummary,
        tone: { bg: "#FDF4FF", text: "#86198F", iconBg: "#F5D0FE" },
      };
    }

    if (dailyCheckinToday?.status === "completed" && dailyCheckinToday?.trend?.streak_days) {
      return {
        Icon: CheckCircle2,
        title: t("health.planLead.insightKeepStreak", "Keep the streak going"),
        detail: steadyCheckinSummary,
        tone: { bg: "#ECFDF5", text: "#047857", iconBg: "#D1FAE5" },
      };
    }

    return {
      Icon: CheckCircle2,
      title: t("health.planLead.insightSteady", "Keep today steady"),
      detail: steadyPlanSummary || t("health.planLead.insightSteadyFallback", "Check-in is done."),
      tone: { bg: "#ECFDF5", text: "#047857", iconBg: "#D1FAE5" },
    };
  })();
  const hasMedicationRemaining = Boolean(medicationToday?.remaining && medicationToday.remaining > 0);
  const medicationDueSoonOrOverdue = Boolean(
    hasMedicationRemaining && (
      !nextDue?.scheduled_time || isScheduledDoseSoonOrPast(nextDue.scheduled_time)
    ),
  );
  const missingMedicationSetup = Boolean(!medicationToday?.scheduled && personalisationData?.hasMedications);
  const recommendedAction: HealthHomeOverview["recommendedAction"] =
    vitalsSnapshot.needsReview || !vitalsSnapshot.hasReading ? "capture_vitals" :
    latestTriage?.urgency === "urgent" || latestTriage?.urgency === "routine" ? "symptom_report" :
    dailyCheckinToday?.status && dailyCheckinToday.status !== "completed" ? "checkin" :
    hasMedicationRemaining ? "medication" :
    "open_plan";
  const canMarkNextMedicineTaken = recommendedAction === "medication" && Boolean(nextDue?.medication_name && nextDue.scheduled_time);
  const primaryActionLabel =
    recommendedAction === "capture_vitals" ? t("health.planLead.captureVitalsAction", "Capture vitals") :
    recommendedAction === "symptom_report" ? t("health.planLead.symptomAction", "Open report") :
    recommendedAction === "checkin" ? t("health.planLead.checkinAction", "Check in") :
    recommendedAction === "checkin_history" ? t("health.planLead.checkinHistoryAction", "View check-ins") :
    canMarkNextMedicineTaken
      ? markDoseTakenMutation.isPending
        ? t("health.planLead.markTakenPending", "Marking...")
        : t("health.planLead.markTakenAction", "Mark taken")
      : recommendedAction === "medication" ? t("health.planLead.medicationAction", "Review medicine") :
    t("health.planLead.primaryAction", "Open health plan");
  const openRecommendedHealthAction = () => {
    sendDoctorUserMessage("I want to review my personalised health plan");
    if (canMarkNextMedicineTaken && nextDue) {
      markDoseTakenMutation.mutate(nextDue);
      return;
    }
    if (recommendedAction === "checkin") {
      navigate("/health/check-in");
      return;
    }
    if (recommendedAction === "checkin_history") {
      navigate("/health/check-ins");
      return;
    }
    if (recommendedAction === "symptom_report" && latestTriage) {
      navigate(`/informes/${latestTriage.id}`);
      return;
    }
    if (recommendedAction === "symptom_check") {
      guardPath("/health/symptom-check");
      return;
    }
    if (recommendedAction === "medication") {
      guardPath("/meds");
      return;
    }
    navigate("/health/vitals");
  };
  const checkinNeedsAction = Boolean(dailyCheckinToday?.status && dailyCheckinToday.status !== "completed");
  const symptomNeedsAction = latestTriage
    ? latestTriage.urgency === "urgent" || latestTriage.urgency === "routine"
    : true;
  const medicationNeedsAction = medicationDueSoonOrOverdue || missingMedicationSetup;
  const showCheckinSignal = checkinNeedsAction && recommendedAction !== "checkin" && recommendedAction !== "checkin_history";
  const showSymptomsSignal = symptomNeedsAction && recommendedAction !== "symptom_report" && recommendedAction !== "symptom_check";
  const showMedicationSignal = medicationNeedsAction && recommendedAction !== "medication";
  const planStepCount = [
    !vitalsSnapshot.hasReading || vitalsSnapshot.needsReview,
    checkinNeedsAction,
    hasMedicationRemaining || missingMedicationSetup,
    symptomNeedsAction,
  ].filter(Boolean).length;
  const planToolDetail = planStepCount === 0
    ? t("health.homeTools.plan.upToDate", "Up to date")
    : planStepCount === 1
      ? t("health.homeTools.plan.stepLeft", "1 step left")
      : t("health.homeTools.plan.stepsLeft", "{{count}} steps left", { count: planStepCount });
  const vitalsToolDetail = !vitalsSnapshot.hasReading
    ? t("health.homeTools.vitals.detail", "Capture")
    : vitalsSnapshot.needsReview
      ? t("health.homeTools.vitals.reviewDetail", "Needs review")
      : t("health.homeTools.vitals.stableDetail", "{{signal}} stable", { signal: compactVitalsSubject(latestVitalsValue) });
  const symptomsToolDetail = latestTriage
    ? latestTriage.urgency === "monitor"
      ? t("health.homeTools.symptoms.monitorOnly", "Monitor only")
      : t("health.homeTools.symptoms.review", "Review report")
    : t("health.homeTools.symptoms.detail", "Start check");
  const symptomsCardAccent = latestTriage
    ? formatHealthCardDateTag(
      latestTriage.created_at,
      t("health.master.cards.today", "Today"),
    ) || t("health.master.cards.symptomsReview", "Review")
    : t("health.master.cards.symptomsStart", "Start");
  const vitalsCardAccent = !vitalsSnapshot.hasReading
    ? t("health.master.cards.vitalsAdd", "Add")
    : compactVitalsCardTag(vitalsSnapshot.value);
  const medicineToolDetail = nextDue
    ? medicationToday?.remaining === 1
      ? nextDueIsTonight
        ? t("health.homeTools.medicine.oneDueTonight", "1 due tonight")
        : nextDueTime
          ? t("health.homeTools.medicine.oneDueAt", "1 due {{time}}", { time: nextDueTime })
          : t("health.homeTools.medicine.due", "{{count}} due", { count: 1 })
      : nextDueTime
        ? t("health.homeTools.medicine.nextDue", "{{name}} {{time}}", { name: nextDue.medication_name, time: nextDueTime })
        : nextDue.medication_name
    : medicationToday?.remaining
      ? t("health.homeTools.medicine.due", "{{count}} due", { count: medicationToday.remaining })
      : latestTaken?.medication_name || t("health.homeTools.medicine.detail", "Schedule");
  const medicineCardAccent = hasMedicationRemaining
    ? medicationDueShort || medicineToolDetail
    : missingMedicationSetup
      ? medicineToolDetail
      : medicationToday?.scheduled
        ? t("health.master.cards.medicineProgress", "{{taken}}/{{total}} taken", {
          taken: medicationToday.taken ?? 0,
          total: medicationToday.scheduled,
        })
        : undefined;
  const checklistMedicineDetail = hasMedicationRemaining
    ? nextDueIsTonight
      ? t("health.planLead.checklist.medicineTonight", "Due tonight")
      : nextDueTime
        ? t("health.planLead.checklist.medicineAt", "Due {{time}}", { time: nextDueTime })
        : t("health.planLead.checklist.medicineDue", "Due today")
    : missingMedicationSetup
      ? t("health.planLead.checklist.medicineSetup", "Set schedule")
      : medicationToday?.scheduled
        ? t("health.planLead.checklist.medicineDone", "Done today")
        : t("health.planLead.checklist.medicineNone", "No schedule");
  const checklistSymptomsDetail = latestTriage
    ? latestTriage.urgency === "monitor"
      ? t("health.planLead.checklist.symptomsMonitor", "Monitor only")
      : t("health.planLead.checklist.symptomsReview", "Review")
    : t("health.planLead.checklist.symptomsStart", "Start check");
  const checklistItems: HealthPlanChecklistItem[] = [
    {
      id: "vitals",
      Icon: Activity,
      label: t("health.planLead.checklist.vitals", "Vitals"),
      detail: !vitalsSnapshot.hasReading
        ? t("health.planLead.checklist.vitalsAdd", "Add reading")
        : vitalsSnapshot.needsReview
          ? t("health.planLead.checklist.vitalsReview", "Review")
          : t("health.planLead.checklist.vitalsStable", "Stable"),
      iconBg: vitalsSnapshot.tone.iconBg,
      iconColor: vitalsSnapshot.tone.text,
      borderColor: vitalsSnapshot.tone.border,
      onClick: () => navigate("/health/vitals"),
    },
    {
      id: "medicine",
      Icon: Pill,
      label: t("health.planLead.checklist.medicine", "Medicine"),
      detail: checklistMedicineDetail,
      iconBg: hasMedicationRemaining || missingMedicationSetup ? "#F5D0FE" : "#ECFDF5",
      iconColor: hasMedicationRemaining || missingMedicationSetup ? "#86198F" : "#047857",
      borderColor: hasMedicationRemaining || missingMedicationSetup ? "#E9D5FF" : "#BBF7D0",
      onClick: () => guardPath("/meds"),
    },
    {
      id: "checkin",
      Icon: dailyCheckinToday?.status === "completed" ? CheckCircle2 : Calendar,
      label: t("health.planLead.checklist.checkin", "Check-in"),
      detail: dailyCheckinToday?.status === "completed"
        ? t("health.planLead.checklist.checkinDone", "Done")
        : dailyCheckinToday?.status
          ? checkinStatusLabel
          : t("health.planLead.checklist.checkinStart", "Start"),
      iconBg: checkinTone.bg,
      iconColor: checkinTone.text,
      borderColor: dailyCheckinToday?.status === "overdue" ? "#FECACA" : dailyCheckinToday?.status === "completed" ? "#BBF7D0" : "#DDD6FE",
      onClick: () => navigate(dailyCheckinToday?.status === "completed" ? "/health/check-ins" : "/health/check-in"),
    },
    ...(symptomNeedsAction ? [{
      id: "symptoms",
      Icon: HeartPulse,
      label: t("health.planLead.checklist.symptoms", "Symptoms"),
      detail: checklistSymptomsDetail,
      iconBg: "#FFF1F2",
      iconColor: "#E74C43",
      borderColor: "#FECACA",
      onClick: () => {
        if (latestTriage) {
          navigate(`/informes/${latestTriage.id}`);
          return;
        }
        guardPath("/health/symptom-check");
      },
    }] : []),
  ];
  const healthOverview: HealthHomeOverview = {
    planStatus: primaryInsight.title,
    primaryInsight,
    vitalsSnapshot,
    planItems: checklistItems,
    recommendedAction,
    signalCards: [
      ...(showCheckinSignal ? [{
        id: "checkin",
        Icon: checkinTone.Icon,
        label: t("health.homeSignals.checkin.label", "Check-in"),
        value: checkinValue,
        detail: checkinDetail,
        actionLabel: dailyCheckinToday?.status === "completed"
          ? t("health.homeSignals.checkin.actionHistory", "History")
          : t("health.homeSignals.checkin.actionStart", "Check in"),
        iconBg: checkinTone.bg,
        iconColor: checkinTone.text,
        borderColor: "#BBF7D0",
        shadow: "rgba(20,154,99,0.10)",
        onClick: () => {
          sendDoctorUserMessage("I want to review my daily check-in");
          navigate(dailyCheckinToday?.status === "completed" ? "/health/check-ins" : "/health/check-in");
        },
      }] : []),
      ...(showSymptomsSignal ? [{
        id: "symptoms",
        Icon: HeartPulse,
        label: t("health.homeSignals.symptoms.label", "Symptoms"),
        value: latestTriage?.chief_complaint
          ? t("health.homeSignals.symptoms.careValue", "{{symptom}} care", { symptom: latestTriage.chief_complaint })
          : t("health.homeSignals.symptoms.empty", "Quick body check"),
        detail: latestTriage
          ? symptomAdvice || t("health.homeSignals.symptoms.monitorDetail", "Open the advice if this changes")
          : t("health.homeSignals.symptoms.emptyDetail", "Tell VYVA what feels different"),
        actionLabel: latestTriage
          ? t("health.homeSignals.symptoms.actionReport", "Open advice")
          : t("health.homeSignals.symptoms.actionStart", "Check"),
        iconBg: "#FFF1F2",
        iconColor: "#E74C43",
        borderColor: "#FECACA",
        shadow: "rgba(231,76,67,0.10)",
        onClick: () => {
          sendDoctorUserMessage("I want to review my latest symptom check");
          if (latestTriage) {
            navigate(`/informes/${latestTriage.id}`);
            return;
          }
          guardPath("/health/symptom-check");
        },
      }] : []),
      ...(showMedicationSignal ? [{
        id: "medication",
        Icon: Pill,
        label: t("health.homeSignals.medication.label", "Medicine"),
        value: medicationToday?.remaining
          ? medicineValue
          : t("health.homeSignals.medication.empty", "Set medicine schedule"),
        detail: medicationToday?.remaining
          ? medicineDetail
          : t("health.homeSignals.medication.emptyDetail", "Add times and reminders"),
        actionLabel: medicationToday?.remaining
          ? t("health.homeSignals.medication.action", "Review")
          : t("health.homeSignals.medication.actionSetup", "Set up"),
        iconBg: "#FDF4FF",
        iconColor: "#86198F",
        borderColor: "#E9D5FF",
        shadow: "rgba(134,25,143,0.10)",
        onClick: () => {
          sendDoctorUserMessage("I want to review my medication status");
          guardPath("/meds");
        },
      }] : []),
    ],
  };
  const healthToolActions: HealthToolAction[] = [
    {
      id: "plan",
      Icon: ClipboardList,
      label: t("health.homeTools.plan.label", "Longevity Plan"),
      detail: planToolDetail,
      iconBg: "#F5F3FF",
      iconColor: "#6B21A8",
      onClick: () => {
        sendDoctorUserMessage("I want to open my health plan");
        navigate("/health/vitals");
      },
    },
    {
      id: "vitals",
      Icon: Activity,
      label: t("health.homeTools.vitals.label", "Vitals"),
      detail: vitalsToolDetail,
      iconBg: vitalsSnapshot.tone.iconBg,
      iconColor: vitalsSnapshot.tone.text,
      onClick: () => {
        sendDoctorUserMessage("I want to check my vitals");
        navigate("/health/vitals");
      },
    },
    {
      id: "symptoms",
      Icon: HeartPulse,
      label: t("health.homeTools.symptoms.label", "Symptoms"),
      detail: symptomsToolDetail,
      iconBg: "#FFF1F2",
      iconColor: "#E74C43",
      onClick: () => {
        sendDoctorUserMessage("I want to review symptoms");
        if (latestTriage) {
          navigate(`/informes/${latestTriage.id}`);
          return;
        }
        guardPath("/health/symptom-check");
      },
    },
    {
      id: "medicine",
      Icon: Pill,
      label: t("health.homeTools.medicine.label", "Medicine"),
      detail: medicineToolDetail,
      iconBg: "#FDF4FF",
      iconColor: "#86198F",
      onClick: () => {
        sendDoctorUserMessage("I want to open medicines");
        guardPath("/meds");
      },
    },
  ];
  const preventionCardDetail = t("health.master.cards.longevityDetail", "Prevention is the best cure");
  const preventionCardAccent = preventionCardDetail;

  const healthMasterCards: MasterDashboardCard[] = [
    {
      id: "feel-better",
      icon: HeartPulse,
      title: t("health.master.cards.feelBetter", "Ask Dr. AI"),
      detail: t("health.homeTools.symptoms.detail", "Start check"),
      accent: t("health.master.cards.symptomsStart", "Start"),
      tone: {
        iconBg: "#FFF1F2",
        iconColor: "#E74C43",
        border: "#FECACA",
        surface: "#FFFFFF",
      },
      onClick: () => {
        sendDoctorUserMessage("I want to check my symptoms");
        guardPath("/health/symptom-check");
      },
      testId: "button-health-tool-feel-better",
    },
    {
      id: "stay-well",
      icon: ShieldCheck,
      title: t("health.master.cards.stayWell", "Longevity"),
      detail: preventionCardDetail,
      accent: preventionCardAccent,
      tone: {
        iconBg: "#ECFDF5",
        iconColor: "#047857",
        border: "#BBF7D0",
        surface: "#FFFFFF",
      },
      onClick: () => {
        sendDoctorUserMessage("I want to review my prevention focus");
        navigate("/health/prevention-plan");
      },
      testId: "button-health-tool-stay-well",
    },
    {
      id: "my-vitals",
      icon: Activity,
      title: t("health.master.cards.myVitals", "My Vitals"),
      detail: healthOverview.vitalsSnapshot.value,
      accent: vitalsCardAccent,
      tone: {
        iconBg: healthOverview.vitalsSnapshot.tone.iconBg,
        iconColor: healthOverview.vitalsSnapshot.tone.text,
        border: healthOverview.vitalsSnapshot.tone.border,
        surface: healthOverview.vitalsSnapshot.tone.bg,
      },
      onClick: () => {
        sendDoctorUserMessage("I want to check my vitals");
        navigate("/health/vitals");
      },
      testId: "button-health-tool-my-vitals",
    },
    {
      id: "my-medication",
      icon: Pill,
      title: t("health.master.cards.myMedication", "Medication"),
      detail: medicineToolDetail,
      accent: medicineCardAccent,
      tone: {
        iconBg: hasMedicationRemaining || missingMedicationSetup ? "#FDF4FF" : "#ECFDF5",
        iconColor: hasMedicationRemaining || missingMedicationSetup ? "#86198F" : "#047857",
        border: hasMedicationRemaining || missingMedicationSetup ? "#E9D5FF" : "#BBF7D0",
        surface: "#FFFFFF",
      },
      onClick: () => {
        sendDoctorUserMessage("I want to open medicines");
        guardPath("/meds");
      },
      testId: "button-health-tool-my-medication",
    },
  ];

  const openVisualScan = () => {
    const shouldOpen = !visualScanOpen;
    setVisualScanOpen(shouldOpen);
    if (shouldOpen) {
      window.setTimeout(() => {
        if (typeof document === "undefined") return;
        document.getElementById("health-visual-scan-panel")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 80);
    }
  };

  const openSpecialistPanel = () => {
    const shouldOpen = !specialistOpen;
    setSpecialistOpen((value) => !value);
    if (shouldOpen) {
      window.setTimeout(() => {
        if (typeof document === "undefined") return;
        document.getElementById("health-specialist-panel")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 80);
    }
  };

  const healthFastHelpActions: MasterFastHelpAction[] = [
    {
      id: "my-reports",
      icon: ClipboardList,
      label: t("health.master.fastHelp.myReports", "My Reports"),
      detail: t("health.master.fastHelp.myReportsDetail", "Latest summary"),
      tone: {
        iconBg: "#EFF6FF",
        iconColor: "#2563EB",
        border: "#BFDBFE",
      },
      onClick: () => {
        sendDoctorUserMessage("I want to open my latest health report");
        navigate(latestTriage ? `/informes/${latestTriage.id}` : "/informes");
      },
      testId: "button-health-fast-my-reports",
    },
    {
      id: "visual-scan",
      icon: Camera,
      label: t("health.master.fastHelp.visualScan", "Visual Scan"),
      detail: t("health.master.fastHelp.visualScanDetail", "Photo review"),
      tone: {
        iconBg: "#FFF7ED",
        iconColor: "#B45309",
        border: "#FED7AA",
      },
      onClick: () => {
        sendDoctorUserMessage("I want to use visual scan");
        openVisualScan();
      },
      testId: "button-health-fast-visual-scan",
    },
    {
      id: "find-specialist",
      icon: UserSearch,
      label: t("health.master.fastHelp.findSpecialist", "Find Specialist"),
      detail: t("health.master.fastHelp.findSpecialistDetail", "Right expert"),
      tone: {
        iconBg: "#FDF4FF",
        iconColor: "#86198F",
        border: "#E9D5FF",
      },
      onClick: () => {
        sendDoctorUserMessage("I want to find the right specialist");
        openSpecialistPanel();
      },
      testId: "button-health-fast-find-specialist",
    },
    {
      id: "book-medical",
      icon: Calendar,
      label: t("health.master.fastHelp.bookMedical", "Book Medical"),
      detail: t("health.master.fastHelp.bookMedicalDetail", "Appointment help"),
      tone: {
        iconBg: "#F0FDFA",
        iconColor: "#0F766E",
        border: "#99F6E4",
      },
      onClick: () => {
        sendDoctorUserMessage("I want to book a medical appointment");
        guardPath("/concierge", {
          state: {
            conciergePrefill: {
              kind: "appointment",
              message: t("health.master.fastHelp.bookMedicalPrefill", "Help me book a medical appointment. Ask what kind of appointment I need and do not book anything without my confirmation."),
              source: "health_home_doctor",
            },
          },
        });
      },
      testId: "button-health-fast-book-medical",
    },
    {
      id: "check-vitals",
      icon: Activity,
      label: t("health.master.fastHelp.checkVitals", "Check Vitals"),
      detail: t("health.master.fastHelp.checkVitalsDetail", "Pulse or pressure"),
      tone: {
        iconBg: "#ECFDF5",
        iconColor: "#047857",
        border: "#BBF7D0",
      },
      onClick: () => {
        sendDoctorUserMessage("I want to check my vitals");
        navigate("/health/vitals");
      },
      testId: "button-health-fast-check-vitals",
    },
    {
      id: "talk-doctor",
      icon: Phone,
      label: t("health.master.fastHelp.talkDoctor", "Talk Doctor"),
      detail: t("health.master.fastHelp.talkDoctorDetail", "Prepare next step"),
      tone: {
        iconBg: "#EEF6FF",
        iconColor: "#2563EB",
        border: "#BFDBFE",
      },
      onClick: () => {
        sendDoctorUserMessage("I want to talk to a doctor");
        guardPath("/health/doctor", { state: { autoStartVoice: true, latestSymptomReport: latestTriageDoctorContext || undefined } });
      },
      testId: "button-health-fast-talk-doctor",
    },
  ];

  const showLegacyHealthSections = import.meta.env.MODE === "legacy-health-sections";

  return (
    <>
      <MasterDashboardLayout
        testId="health-master-layout"
        presentationAttributes={healthPresentation.dataAttributes}
        presentationClassName={healthPresentation.bottomNavClearanceClassName}
        cardGridTestId="health-master-cards"
        fastHelpTestId="health-fast-help"
        fastHelpTitle={t("health.fastHelp.kicker", "Fast help")}
        hero={{
          icon: Stethoscope,
          eyebrow: t("health.master.heroEyebrow", "Longevity"),
          title: t("health.master.heroTitle", "Your plan is ready"),
          action: {
            kind: "voice",
            label: t("health.master.talkToVyva", "Talk to VYVA"),
            supportingLabel: t("health.master.voiceSupport", "Speak anytime"),
            contextHint: t("health.master.voiceContext", "Health plan support. Ask about medicines, vitals, symptoms, prevention, and safe next steps."),
            voiceAgentSlug: "health",
            voiceDynamicVariables: { app_entrypoint: "health_master_hero" },
            autoStartListening: true,
            testId: "button-health-hero-talk",
          },
          testId: "health-master-hero",
          tone: {
            iconBg: "#F5F3FF",
            iconColor: "#6B21A8",
            border: "#DDD6FE",
            surface: "#FFFFFF",
          },
        }}
        cards={healthMasterCards}
        fastHelpActions={healthFastHelpActions}
      >
        {showLegacyHealthSections ? (
          <>

        {/* ── 1. Hero ── */}
        <VoiceHero
          heroSurface="health"
          headline={headlineText}
          contextHint="health symptoms"
          voiceAgentSlug="health"
          talkLabel={t("health.talkToDoctor", "Connect with a real doctor")}
          mobileTalkLabel={t("health.talkToDoctorMobile", "Talk to doctor")}
          compact
          onTalkClick={() => {
            if (doctorVoiceLive) {
              stopDoctorVoice();
              return;
            }
            guardPath("/health/doctor", { state: { autoStartVoice: true, latestSymptomReport: latestTriageDoctorContext || undefined } });
          }}
          voiceControls={{
            status: doctorVoiceStatus,
            isSpeaking: doctorVoiceSpeaking,
            isConnecting: doctorVoiceConnecting,
            transcript: doctorVoiceTranscript,
            onEnd: stopDoctorVoice,
            showOverlay: false,
            activeLabel: t("health.doctorChoice.stopCall", "Pause listening"),
          }}
        />

        {/* ── 2. Acceso rápido (2×2 grid) ── */}
        {showLegacyHealthSections && latestTriage ? (
          <section className="mt-[18px] rounded-[26px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_24px_rgba(63,45,35,0.06)]">
            <button
              type="button"
              onClick={() => navigate(`/informes/${latestTriage.id}`)}
              data-testid="button-health-latest-symptom-report"
              className="vyva-tap flex w-full items-center gap-4 text-left"
            >
              <span
                className="flex h-[56px] w-[56px] flex-shrink-0 items-center justify-center rounded-[20px]"
                style={{ background: latestTriageTone.bg, color: latestTriageTone.text }}
              >
                <LatestTriageIcon size={27} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-body text-[12px] font-extrabold uppercase tracking-[0.12em] text-vyva-text-3">
                  {t("health.latestSymptomCheck.kicker", "Recent symptom check")}
                </span>
                <span className="mt-1 line-clamp-1 block font-body text-[18px] font-extrabold leading-tight text-vyva-text-1">
                  {latestTriage.chief_complaint}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 font-body text-[13px] font-bold" style={{ color: latestTriageTone.text }}>
                  <span>{latestTriageTone.label}</span>
                  {latestTriageDate ? <span className="text-vyva-text-3">{latestTriageDate}</span> : null}
                  {latestTriage.bpm != null ? <span className="text-vyva-text-3">{latestTriage.bpm} bpm</span> : null}
                </span>
              </span>
              <ChevronRight size={24} className="flex-shrink-0 text-vyva-purple" />
            </button>
            {latestTriageActions.length ? (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="health-latest-triage-actions">
                {latestTriageActions.map((action) => {
                  const ActionIcon = latestTriageActionIcons[action.kind];
                  const className = "vyva-tap inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#E7DCF8] bg-[#FFFCF8] px-4 py-3 text-center font-body text-[14px] font-black leading-tight text-vyva-purple shadow-sm";
                  if (action.href) {
                    return (
                      <a
                        key={action.kind}
                        href={action.href}
                        data-testid={`button-health-latest-triage-action-${action.kind}`}
                        className={className}
                      >
                        <ActionIcon size={18} />
                        <span>{action.label}</span>
                      </a>
                    );
                  }
                  return (
                    <button
                      key={action.kind}
                      type="button"
                      onClick={() => openLatestTriageAction(action)}
                      data-testid={`button-health-latest-triage-action-${action.kind}`}
                      className={className}
                    >
                      <ActionIcon size={18} />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}

        <section
          className="mt-4 overflow-hidden rounded-[26px] border border-[#DDD6FE] bg-[#FFFCF8] shadow-[0_18px_42px_rgba(107,33,168,0.12)] sm:mt-[22px]"
          data-testid="health-plan-lead"
        >
          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="order-1 p-4 pb-3 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                  {t("health.planLead.title", "Today's health plan")}
                </span>
                <span
                  className="max-w-[58%] truncate rounded-full px-3 py-1 font-body text-[12px] font-black"
                  style={{ background: healthOverview.primaryInsight.tone.iconBg, color: healthOverview.primaryInsight.tone.text }}
                >
                  {planLeadBadge}
                </span>
              </div>
              <div className="mt-3 flex items-start gap-3" data-testid="health-plan-primary-insight">
                <span
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px]"
                  style={{ background: healthOverview.primaryInsight.tone.iconBg, color: healthOverview.primaryInsight.tone.text }}
                >
                  <PrimaryInsightIcon size={24} strokeWidth={2.5} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <p className="max-w-[34rem] font-body text-[24px] font-black leading-[1.05] text-vyva-text-1 sm:text-[28px]">
                    {healthOverview.planStatus}
                  </p>
                  <p className="mt-1 max-w-[34rem] line-clamp-2 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
                    {healthOverview.primaryInsight.detail}
                  </p>
                </span>
              </div>
              <HealthPlanChecklist items={healthOverview.planItems} />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  data-testid="button-health-plan-open"
                  onClick={openRecommendedHealthAction}
                  disabled={markDoseTakenMutation.isPending}
                  className="vyva-primary-action flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap px-5 text-[15px] sm:min-h-[52px] sm:text-[16px]"
                >
                  {markDoseTakenMutation.isPending && canMarkNextMedicineTaken ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
                  {primaryActionLabel}
                  {canMarkNextMedicineTaken ? <CheckCircle2 size={19} strokeWidth={2.7} aria-hidden="true" /> : <ChevronRight size={19} strokeWidth={2.7} aria-hidden="true" />}
                </button>
                {canMarkNextMedicineTaken ? (
                  <button
                    type="button"
                    data-testid="button-health-plan-review-medicine"
                    onClick={() => guardPath("/meds")}
                    className="vyva-secondary-action flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap px-5 text-[15px] sm:min-h-[52px] sm:text-[16px]"
                  >
                    <Pill size={18} strokeWidth={2.5} aria-hidden="true" />
                    {t("health.planLead.medicationAction", "Review medicine")}
                  </button>
                ) : null}
                <button
                  type="button"
                  data-testid="button-health-plan-checkin"
                  onClick={() => navigate(dailyCheckinToday?.status === "completed" ? "/health/check-ins" : "/health/check-in")}
                  className="vyva-secondary-action flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap px-5 text-[15px] sm:min-h-[52px] sm:text-[16px]"
                >
                  <Calendar size={18} strokeWidth={2.5} aria-hidden="true" />
                  {dailyCheckinToday?.status === "completed"
                    ? t("health.planLead.checkinHistoryAction", "View check-ins")
                    : t("health.planLead.checkinAction", "Check in")}
                </button>
              </div>
              {latestDataLabel ? (
                <p data-testid="health-plan-updated-at" className="mt-3 font-body text-[12px] font-bold text-vyva-text-3">
                  {latestDataLabel}
                </p>
              ) : null}
            </div>
            <div
              className="order-2 border-t p-4 sm:p-5 lg:border-l lg:border-t-0"
              style={{ background: healthOverview.vitalsSnapshot.tone.bg, borderColor: healthOverview.vitalsSnapshot.tone.border }}
            >
              <button
                type="button"
                onClick={() => navigate("/health/vitals")}
                data-testid="health-plan-vitals-snapshot"
                className="vyva-tap group flex h-full min-h-[160px] w-full flex-col rounded-[22px] border bg-white p-4 text-left shadow-[0_14px_30px_rgba(43,31,24,0.06)] transition-transform hover:-translate-y-0.5 sm:p-5"
                style={{ borderColor: healthOverview.vitalsSnapshot.tone.border }}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-body text-[12px] font-black uppercase tracking-[0.12em]" style={{ color: healthOverview.vitalsSnapshot.tone.text }}>
                    {t("health.planLead.vitalsKicker", "Latest vitals")}
                  </span>
                  <span
                    className="rounded-full px-3 py-1 font-body text-[12px] font-black"
                    style={{ background: healthOverview.vitalsSnapshot.tone.iconBg, color: healthOverview.vitalsSnapshot.tone.text }}
                  >
                    {healthOverview.vitalsSnapshot.statusLabel}
                  </span>
                </span>
                <span className="mt-4 flex items-start gap-3">
                  <span
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] sm:h-14 sm:w-14 sm:rounded-[20px]"
                    style={{ background: healthOverview.vitalsSnapshot.tone.iconBg, color: healthOverview.vitalsSnapshot.tone.text }}
                  >
                    <Activity size={25} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-body text-[28px] font-black leading-[1.04] text-vyva-text-1 sm:text-[32px]">
                      {healthOverview.vitalsSnapshot.value}
                    </span>
                    <span className="mt-1 block font-body text-[15px] font-bold leading-snug text-vyva-text-2">
                      {healthOverview.vitalsSnapshot.detail}
                    </span>
                  </span>
                </span>
                {healthOverview.vitalsSnapshot.secondaryValues.length ? (
                  <span className="mt-3 flex flex-wrap gap-2">
                    {healthOverview.vitalsSnapshot.secondaryValues.map((value) => (
                      <span
                        key={value}
                        className="rounded-full px-3 py-1 font-body text-[12px] font-black"
                        style={{ background: healthOverview.vitalsSnapshot.tone.iconBg, color: healthOverview.vitalsSnapshot.tone.text }}
                      >
                        {value}
                      </span>
                    ))}
                  </span>
                ) : null}
                <span className="mt-auto flex justify-end pt-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F3FF] text-vyva-purple transition-transform group-hover:translate-x-0.5">
                    <ChevronRight size={18} strokeWidth={2.7} aria-hidden="true" />
                  </span>
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="mt-4" data-testid="health-tool-section">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                {t("health.homeTools.kicker", "Health tools")}
              </p>
              <h2 className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1 sm:text-[22px]">
                {t("health.homeTools.title", "All health areas")}
              </h2>
            </div>
          </div>
          <ResponsiveGrid columns="two" gap="sm" className="grid-cols-2 lg:grid-cols-4" data-testid="health-tool-grid">
            {healthToolActions.map((tool) => (
              <HealthToolButton key={tool.id} tool={tool} />
            ))}
          </ResponsiveGrid>
        </section>

        {healthOverview.signalCards.length ? (
        <section className="mt-5" data-testid="health-signal-section">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                {t("health.homeSignals.kicker", "Today")}
              </p>
              <h2 className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
                {t("health.homeSignals.title", "Worth doing today")}
              </h2>
            </div>
          </div>
          <ResponsiveGrid columns="two" gap="sm" className="grid-cols-1 sm:grid-cols-2" data-testid="health-signal-grid">
            {healthOverview.signalCards.map((card) => (
              <HealthSignalCard key={card.id} card={card} />
            ))}
          </ResponsiveGrid>
        </section>
        ) : null}


        {/* ── 3. Acciones rápidas ── */}
        <section
          className="mt-4 rounded-[24px] border border-[#EDE2D1] bg-[#FFFCF8] p-4 shadow-[0_14px_32px_rgba(60,38,20,0.07)] sm:mt-[18px] sm:rounded-[28px] sm:p-5"
          data-testid="health-fast-help"
        >
          <div className="mb-4">
            <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
              {t("health.fastHelp.kicker", "Fast help")}
            </p>
            <h2 className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1 sm:text-[22px]">
              <span className="sm:hidden">{t("health.fastHelp.titleMobile", "Need help now?")}</span>
              <span className="hidden sm:inline">{t("health.fastHelp.title", "What do you need now?")}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {FAST_HELP_ACTIONS.map((action) => {
              const Icon = action.Icon;
              const isVisualScanAction = action.id === "visual-scan";
              const visualScanExpanded = isVisualScanAction && (visualScanOpen || Boolean(woundResult));
              return (
                <button
                  key={action.id}
                  type="button"
                  data-testid={`button-health-fast-${action.id}`}
                  onClick={action.action}
                  aria-expanded={isVisualScanAction ? visualScanExpanded : undefined}
                  aria-controls={isVisualScanAction ? "health-visual-scan-panel" : undefined}
                  className="vyva-tap flex min-h-[76px] w-full items-center gap-3 rounded-[20px] border bg-white px-3 py-3 text-left transition-transform hover:-translate-y-0.5 sm:min-h-[86px] sm:gap-4 sm:rounded-[22px] sm:px-4 sm:py-4"
                  style={{
                    borderColor: action.border,
                    boxShadow: `0 10px 24px ${action.shadow}`,
                  }}
                >
                  <span
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] sm:h-14 sm:w-14 sm:rounded-[18px]"
                    style={{ background: action.iconBg, color: action.iconColor }}
                  >
                    <Icon size={22} strokeWidth={2.4} className="sm:h-6 sm:w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-body text-[17px] font-black leading-tight text-vyva-text-1 sm:text-[18px]">
                      {action.label}
                    </span>
                    <span className="sr-only">
                      {action.subMobile}
                    </span>
                    <span className="sr-only">
                      {action.sub}
                    </span>
                  </span>
                  {isVisualScanAction ? (
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-transform"
                      style={{
                        background: "#FFFBEB",
                        color: action.iconColor,
                        transform: visualScanExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                      aria-hidden="true"
                    >
                      <ChevronDown size={20} strokeWidth={2.8} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

          </>
        ) : null}

        {(visualScanOpen || woundResult || showVyvaPasteReview) && (
          <div
            id="health-visual-scan-panel"
            className="mt-4 overflow-hidden rounded-[24px] border border-[#FDE68A] bg-white shadow-[0_10px_24px_rgba(201,137,10,0.08)]"
            data-testid="section-health-visual-scan"
          >
            <VisualHealthScanCardContent
              t={t}
              analyzing={woundAnalyzing || visualCapturePreparing}
              onScanSource={openVisualScanFilePicker}
              onPasteReview={openShowVyvaConciergeReview}
            />

            {showVyvaPasteReview && (
              <div className="mx-[18px]">
                <ShowVyvaPastedReviewResult
                  payload={showVyvaPasteReview}
                  testIdSuffix="health-pasted"
                  onActionSelect={handleVisualScanFollowUpSelect}
                  onClose={() => setShowVyvaPasteReview(null)}
                />
              </div>
            )}

            {showVyvaEvidenceReview && !woundAnalyzing && (
              <div className="mx-[18px]">
                <ShowVyvaResultCard
                  contract={showVyvaEvidenceReview}
                  testIdSuffix="health-visual-evidence"
                  headerAction={(
                    <button
                      type="button"
                      data-testid="button-close-health-visual-evidence"
                      onClick={() => setShowVyvaEvidenceReview(null)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EDE5DB] bg-white text-vyva-text-2"
                      aria-label={t("showVyva.closeReview", "Close review")}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  )}
                  onActionSelect={handleVisualScanFollowUpSelect}
                />
              </div>
            )}

            {woundResult && (
              <VisualScanResultPanel
                result={woundResult}
                t={t}
                reviewInput={visualScanReviewInput}
                actions={visualScanActions}
                onFollowUpSelect={handleVisualScanFollowUpSelect}
                onClose={() => setWoundResult(null)}
              />
            )}

            <button
              data-testid="button-toggle-scan-history"
              onClick={() => setHistorialOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-[18px] py-[12px] transition-colors"
              style={{ borderTop: "1px solid #F5EFE4" }}
            >
              <History size={14} style={{ color: "#C9890A" }} />
              <span className="font-body text-[13px] font-medium flex-1 text-left" style={{ color: "#C9890A" }}>
                {t("health.pastScans.viewHistory", "View history")}
                {!pastScansLoading && pastScans.length > 0 && (
                  <span
                    className="ml-[6px] px-[7px] py-[1px] rounded-full font-body text-[11px] font-semibold"
                    style={{ background: "#FEF3C7", color: "#92400E" }}
                  >
                    {pastScans.length}
                  </span>
                )}
              </span>
              <ChevronDown
                size={14}
                className="flex-shrink-0 transition-transform"
                style={{ color: "#C9890A", transform: historialOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>

            {historialOpen && (
              <div className="px-[14px] pb-[14px]" style={{ borderTop: "1px solid #FEF3C7" }}>
                {pastScansLoading ? (
                  <div className="mt-[10px] h-[54px] rounded-[12px] bg-gray-100 animate-pulse" />
                ) : pastScans.length === 0 ? (
                  <p className="font-body text-[13px] text-vyva-text-2 text-center py-4">{t("health.pastScans.empty", "No saved scans yet")}</p>
                ) : (
                  <div className="pt-[10px] grid gap-[10px]">
                    {pastScans.map((scan) => (
                      <button
                        key={scan.id}
                        data-testid={`button-expand-scan-${scan.id}`}
                        type="button"
                        onClick={() => setFullScreenScan(scan)}
                        className="vyva-tap flex w-full items-center gap-3 rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] p-[12px] text-left"
                      >
                        {scan.image_data ? (
                          <img src={scan.image_data} alt={scan.result_title} className="h-12 w-12 rounded-[10px] object-cover" />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-body text-[13px] font-semibold text-vyva-text-1">{scan.result_title}</span>
                          <span className="mt-1 block font-body text-[12px] text-vyva-text-2">
                            {new Date(scan.scanned_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {specialistOpen && (
          <div
            id="health-specialist-panel"
            className="mt-4 overflow-hidden rounded-[26px] border border-[#DDD6FE] bg-white p-[18px] shadow-[0_16px_34px_rgba(124,58,237,0.10)]"
            data-testid="section-health-specialist"
          >
            <div className="rounded-[22px] border border-[#E9D5FF] bg-[#FAF7FF] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-[#7C3AED] shadow-[0_10px_22px_rgba(124,58,237,0.10)]">
                  <UserSearch size={24} strokeWidth={2.4} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[20px] font-black leading-tight text-vyva-text-1">
                    {t("health.findSpecialist.title", "Find a Specialist")}
                  </span>
                  <span className="mt-1 block font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                    {t("health.findSpecialist.intro", "Describe the condition or concern. VYVA will look for the right specialist type and nearby options.")}
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-[#E9D5FF] bg-white p-3">
              <p className="mb-3 font-body text-[12px] font-black uppercase tracking-[0.1em]" style={{ color: "#7C3AED" }}>
                {t("health.findSpecialist.experts.title", "Choose an expert")}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {askExpertCards.map((expert) => {
                  const Icon = expert.Icon;
                  return (
                    <button
                      key={expert.id}
                      type="button"
                      data-testid={`button-ask-expert-${expert.id}`}
                      onClick={expert.onClick}
                      className="vyva-tap flex min-h-[74px] w-full items-center gap-3 rounded-[18px] border border-[#EEE6FA] bg-[#FFFCFF] p-3 text-left transition-transform hover:-translate-y-0.5"
                    >
                      <span
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px]"
                        style={{ background: expert.iconBg, color: expert.iconColor }}
                      >
                        <Icon size={21} strokeWidth={2.4} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-body text-[15px] font-black leading-tight text-vyva-text-1">
                          {expert.label}
                        </span>
                        <span className="sr-only">
                          {expert.detail}
                        </span>
                      </span>
                      <ChevronRight size={17} strokeWidth={2.6} className="flex-shrink-0 text-[#7C3AED]" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              <button
                data-testid="button-specialist-voice-search"
                onClick={specialistVoiceListening ? stopSpecialistVoice : startSpecialistVoice}
                disabled={specialistMutation.isPending}
                className={`vyva-tap flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] px-[14px] py-[13px] font-body text-[15px] font-black transition-all ${specialistVoiceListening ? "mic-pulse-listening" : ""}`}
                style={{
                  background: specialistVoiceListening ? "#ECFDF5" : "#F5F3FF",
                  color: specialistVoiceListening ? "#0A7C4E" : "#7C3AED",
                  border: specialistVoiceListening ? "1px solid #6EE7B7" : "1px solid #DDD6FE",
                }}
              >
                {specialistVoiceListening ? <Square size={16} /> : <Mic size={16} />}
                {specialistVoiceListening ? t("health.findSpecialist.listening", "Listening...") : t("health.findSpecialist.voiceSearch", "Search by voice")}
              </button>
              <label className="flex min-h-[58px] w-full items-center gap-3 rounded-[18px] border border-[#DDD6FE] bg-white px-4">
                <UserSearch size={20} strokeWidth={2.3} className="flex-shrink-0 text-[#7C3AED]" aria-hidden="true" />
                <input
                  data-testid="input-specialist-condition"
                  value={specialistCondition}
                  onChange={(e) => setSpecialistCondition(e.target.value)}
                  placeholder={t("health.findSpecialist.conditionPlaceholder", "e.g. knee pain, diabetes, memory...")}
                  className="min-w-0 flex-1 bg-transparent py-[14px] font-body text-[16px] font-semibold text-vyva-text-1 outline-none placeholder:text-[#A99BB5]"
                />
              </label>
              <label className="flex min-h-[58px] w-full items-center gap-3 rounded-[18px] border border-[#EDE5DB] bg-[#FFFCF8] px-4">
                <MapPin size={20} strokeWidth={2.3} className="flex-shrink-0 text-[#8A7A70]" aria-hidden="true" />
                <input
                  data-testid="input-specialist-location"
                  value={specialistLocation}
                  onChange={(e) => {
                    setSpecialistLocationEdited(true);
                    setSpecialistLocation(e.target.value);
                  }}
                  placeholder={profileLocation || t("health.findSpecialist.locationPlaceholder", "City or area")}
                  className="min-w-0 flex-1 bg-transparent py-[14px] font-body text-[16px] font-semibold text-vyva-text-1 outline-none placeholder:text-[#B4A69C]"
                />
              </label>
              <button
                data-testid="button-run-specialist-search"
                onClick={() => runSpecialistSearch()}
                disabled={specialistMutation.isPending}
                className="vyva-primary-action flex w-full items-center justify-center gap-2"
                style={{ background: "#7C3AED", color: "#FFFFFF" }}
              >
                <span>{specialistMutation.isPending ? t("health.findSpecialist.searching", "Searching specialists...") : t("health.findSpecialist.searchButton", "Search specialists")}</span>
                <ChevronRight size={18} strokeWidth={2.6} aria-hidden="true" />
              </button>
            </div>

            {specialistResult && (
              <div className="mt-[12px] flex flex-col gap-2">
                <div className="rounded-[14px] px-[14px] py-[11px]" style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
                  <p className="font-body text-[12px] font-semibold" style={{ color: "#6D28D9" }}>
                    {t("health.findSpecialist.recommendedSpecialties", "Recommended specialties")}
                  </p>
                  <p className="font-body text-[14px] font-semibold text-vyva-text-1">
                    {specialistResult.matchedSpecialties.map((specialty) => displaySpecialtyText(specialty, specialistLanguage)).join(", ")}
                  </p>
                </div>

                {specialistResult.providers.map((spec, i) => {
                  const location = spec.address ?? spec.clinicName ?? specialistLocation;
                  const providerActions = specialistProviderServiceActionsFor(spec);
                  return (
                    <div key={`${spec.name}-${i}`} className="rounded-[16px] px-[14px] py-[13px]" style={{ background: "#F9F6F2", border: "1px solid #EDE5DB" }}>
                      <div className="flex items-start gap-3">
                        <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#EDE9FE" }}>
                          <UserSearch size={17} style={{ color: "#7C3AED" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-[16px] font-semibold text-vyva-text-1 leading-tight">{spec.name}</p>
                          <p className="font-body text-[13px] font-semibold mt-[2px]" style={{ color: "#7C3AED" }}>{displaySpecialty(spec, specialistLanguage)}</p>
                          <p className="mt-2 font-body text-[13px] text-vyva-text-2 leading-snug">{location}</p>
                        </div>
                      </div>

                      <div className="mt-[12px] grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {providerActions.map((action) => {
                          if (action.kind === "call_provider" && action.href) {
                            return (
                              <a
                                key={action.kind}
                                href={action.href}
                                data-testid={`button-specialist-call-provider-${i}`}
                                className="min-h-[48px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2"
                                style={{ background: "#7C3AED", color: "#FFFFFF" }}
                              >
                                <PhoneCall size={15} />
                                {t("health.findSpecialist.call", "Call")}
                              </a>
                            );
                          }
                          if (action.kind === "book_appointment") {
                            return (
                              <button
                                key={action.kind}
                                type="button"
                                data-testid={`button-specialist-book-appointment-${i}`}
                                onClick={() => action.href ? window.open(action.href, "_blank", "noopener,noreferrer") : bookSpecialistMutation.mutate(spec)}
                                disabled={bookSpecialistMutation.isPending}
                                className="min-h-[48px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                                style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
                              >
                                <Calendar size={15} />
                                {t("health.findSpecialist.bookAppointment", "Appointment")}
                              </button>
                            );
                          }
                          if (action.kind === "book_ride") {
                            return (
                              <button
                                key={action.kind}
                                type="button"
                                data-testid={`button-specialist-book-ride-${i}`}
                                onClick={() => navigate("/concierge", { state: specialistRideState(spec, specialistCondition, specialistLanguage) })}
                                className="min-h-[48px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2"
                                style={{ background: "#F0FDF4", color: "#047857", border: "1px solid #BBF7D0" }}
                              >
                                <Car size={15} />
                                {t("health.findSpecialist.bookRide", "Find transport")}
                              </button>
                            );
                          }
                          if (action.kind === "open_map" && action.href) {
                            return (
                              <button
                                key={action.kind}
                                type="button"
                                data-testid={`button-map-specialist-${i}`}
                                onClick={() => window.open(action.href!, "_blank", "noopener,noreferrer")}
                                className="min-h-[48px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2"
                                style={{ background: "#F0FDF4", color: "#047857", border: "1px solid #BBF7D0" }}
                              >
                                <MapPin size={15} />
                                {t("health.findSpecialist.map", "Map")}
                              </button>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {showLegacyHealthSections ? <div className="mt-[24px]">
          <SectionTitle className="mb-3" title={t("health.quickActions", "Quick actions")} />

          <div className="flex flex-col gap-[10px]">

            {/* Ver a un médico */}
            <div
              id="health-see-doctor-card"
              className="vyva-card overflow-hidden"
              style={{ background: "#FFFFFF", border: "1px solid #EDE5DB", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-center gap-4 px-[18px] py-[18px]">
                <div className="w-[58px] h-[58px] rounded-[20px] flex items-center justify-center flex-shrink-0" style={{ background: "#F0FDF4" }}>
                  <Stethoscope size={30} style={{ color: "#0A7C4E" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[21px] font-extrabold leading-tight text-vyva-text-1">{t("health.seeDoctor.title", "See a Doctor")}</p>
                  <p className="mt-2 font-body text-[14px] font-medium leading-snug text-vyva-text-2">{t("health.seeDoctor.subtitle", "Call, appointment, or transport help")}</p>
                </div>
                <button
                  data-testid="button-see-doctor"
                  onClick={() => setSeeDoctorOpen((v) => !v)}
                  className="vyva-tap flex-shrink-0 rounded-full px-[16px] py-[8px] font-body text-[14px] font-semibold transition-all"
                  style={{ background: "#F0FDF4", color: "#0A7C4E", border: "1px solid #BBF7D0" }}
                >
                  {t("health.seeDoctor.cta", "Choose")}
                </button>
              </div>

              {seeDoctorOpen && (
                <div className="px-[18px] pb-[16px] flex flex-col gap-2" style={{ borderTop: "1px solid #F0FDF4" }}>
                  <p className="mt-3 font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#0A7C4E]">
                    {t("health.seeDoctor.actions.title", "Doctor access")}
                  </p>
                  {!hasDoctorContact ? (
                    <ProviderSetupFallbackPanel
                      testId="panel-health-doctor-setup-fallback"
                      workflowReference={APP_WORKFLOW_REFERENCES.doctorNextStep}
                      returnTo="/health/doctor"
                      title={t("health.seeDoctor.providerFallbackTitle", "Need a doctor or clinic first?")}
                      description={t("health.seeDoctor.providerFallbackDescription", "Save your usual contact, ask VYVA to find options, or let a trusted helper set it up.")}
                      addLabel={t("health.seeDoctor.providerFallbackAdd", "Add my usual doctor")}
                      findLabel={t("health.seeDoctor.providerFallbackFind", "Find nearby options")}
                      helperLabel={t("health.seeDoctor.providerFallbackHelper", "Ask family/caregiver")}
                      confirmation={t("health.seeDoctor.providerFallbackConfirm", "VYVA still asks before calling, booking, or sharing health details.")}
                      onAddProvider={openDoctorProviderSetup}
                      onFindOptions={findDoctorOptions}
                      onAskHelper={askHelperForDoctorSetup}
                    />
                  ) : null}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {seeDoctorActions.filter((action) => hasDoctorContact || action.kind !== "add_doctor_contact").map((action) => {
                      const Icon = seeDoctorActionIcons[action.kind];
                      const className = "vyva-tap flex min-h-[74px] items-center gap-3 rounded-[16px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-3 text-left transition active:scale-[0.98]";
                      const content = (
                        <>
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-[#0A7C4E] shadow-[0_6px_14px_rgba(10,124,78,0.10)]">
                            <Icon size={19} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-body text-[15px] font-black leading-tight text-vyva-text-1">{action.label}</span>
                            <span className="mt-0.5 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">{action.description}</span>
                          </span>
                        </>
                      );

                      if (action.href) {
                        return (
                          <a
                            key={action.kind}
                            href={action.href}
                            data-testid={`button-see-doctor-action-${action.kind}`}
                            className={className}
                          >
                            {content}
                          </a>
                        );
                      }

                      return (
                        <button
                          key={action.kind}
                          type="button"
                          onClick={() => openSeeDoctorAction(action)}
                          data-testid={`button-see-doctor-action-${action.kind}`}
                          className={className}
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Visual health scan */}
            <div
              className="vyva-card overflow-hidden"
              style={{ background: "#FFFFFF", border: "1px solid #EDE5DB", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
            >
              <VisualHealthScanCardContent
                t={t}
                analyzing={woundAnalyzing || visualCapturePreparing}
                onScanSource={openVisualScanFilePicker}
                onPasteReview={openShowVyvaConciergeReview}
              />

              {showVyvaPasteReview && (
                <div className="mx-[18px]">
                  <ShowVyvaPastedReviewResult
                    payload={showVyvaPasteReview}
                    testIdSuffix="health-pasted"
                    onActionSelect={handleVisualScanFollowUpSelect}
                    onClose={() => setShowVyvaPasteReview(null)}
                  />
                </div>
              )}

              {showVyvaEvidenceReview && !woundAnalyzing && (
                <div className="mx-[18px]">
                  <ShowVyvaResultCard
                    contract={showVyvaEvidenceReview}
                    testIdSuffix="health-visual-evidence-mobile"
                    headerAction={(
                      <button
                        type="button"
                        onClick={() => setShowVyvaEvidenceReview(null)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EDE5DB] bg-white text-vyva-text-2"
                        aria-label={t("showVyva.closeReview", "Close review")}
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    )}
                    onActionSelect={handleVisualScanFollowUpSelect}
                  />
                </div>
              )}

              {woundResult && (
                <VisualScanResultPanel
                  result={woundResult}
                  t={t}
                  reviewInput={visualScanReviewInput}
                  actions={visualScanActions}
                  onFollowUpSelect={handleVisualScanFollowUpSelect}
                  onClose={() => setWoundResult(null)}
                />
              )}

              {/* ── History toggle ── */}
              <button
                data-testid="button-toggle-scan-history"
                onClick={() => setHistorialOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-[18px] py-[12px] transition-colors"
                style={{ borderTop: "1px solid #F5EFE4" }}
              >
                <History size={14} style={{ color: "#C9890A" }} />
                <span className="font-body text-[13px] font-medium flex-1 text-left" style={{ color: "#C9890A" }}>
                  {t("health.pastScans.viewHistory", "View history")}
                  {!pastScansLoading && pastScans.length > 0 && (
                    <span
                      className="ml-[6px] px-[7px] py-[1px] rounded-full font-body text-[11px] font-semibold"
                      style={{ background: "#FEF3C7", color: "#92400E" }}
                    >
                      {pastScans.length}
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={14}
                  className="flex-shrink-0 transition-transform"
                  style={{ color: "#C9890A", transform: historialOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>

              {/* ── Inline history list ── */}
              {historialOpen && (
                <div className="px-[14px] pb-[14px] flex flex-col gap-[10px]" style={{ borderTop: "1px solid #FEF3C7" }}>
                  <div className="pt-[10px]">
                    {pastScansLoading ? (
                      [1, 2].map((i) => <div key={i} className="h-[54px] rounded-[12px] bg-gray-100 animate-pulse mb-[10px]" />)
                    ) : pastScans.length === 0 ? (
                      <p className="font-body text-[13px] text-vyva-text-2 text-center py-4">{t("health.pastScans.empty", "No saved scans yet")}</p>
                    ) : (
                      pastScans.map((scan) => {
                        const colors = SCAN_SEVERITY_COLORS[scan.severity] ?? SCAN_SEVERITY_COLORS["Minor"];
                        const isExpanded = expandedScanId === scan.id;
                        const date = new Date(scan.scanned_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                        const dateTime = new Date(scan.scanned_at).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
                        return (
                          <div key={scan.id} data-testid={`card-past-scan-${scan.id}`} className="rounded-[14px] overflow-hidden mb-[10px] last:mb-0" style={{ border: `1px solid ${isExpanded ? "#C4B5FD" : "#E5E7EB"}` }}>
                            <div
                              data-testid={`button-expand-scan-${scan.id}`}
                              role="button" tabIndex={0}
                              onClick={() => setExpandedScanId(isExpanded ? null : scan.id)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedScanId(isExpanded ? null : scan.id); } }}
                              className="w-full p-[12px] flex items-start gap-3 text-left transition-colors cursor-pointer select-none"
                              style={{ background: isExpanded ? "#F5F3FF" : "#F9FAFB" }}
                              aria-expanded={isExpanded}
                            >
                              {scan.image_data && (
                                <button
                                  data-testid={`button-fullscreen-scan-${scan.id}`}
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setFullScreenScan(scan); }}
                                  className="flex-shrink-0 rounded-[10px] overflow-hidden focus:outline-none active:scale-95 transition-transform"
                                  style={{ width: 48, height: 48 }}
                                >
                                  <img src={scan.image_data} alt={scan.result_title} className="w-full h-full object-cover" style={{ border: "1px solid #E5E7EB" }} />
                                </button>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-[2px]">
                                  <span className="font-body text-[11px] font-semibold px-[8px] py-[2px] rounded-full flex-shrink-0" style={{ background: colors.bg, color: colors.text }}>
                                    {t(`health.scanWound.severityLabel.${scan.severity.toLowerCase()}`, scan.severity)}
                                  </span>
                                  <p className="font-body text-[13px] font-semibold text-vyva-text-1 truncate">{scan.result_title}</p>
                                </div>
                                <p className="font-body text-[11px]" style={{ color: "#9CA3AF" }}>{date}</p>
                              </div>
                              <ChevronDown size={16} className="flex-shrink-0 mt-[2px] transition-transform" style={{ color: "#9CA3AF", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }} />
                            </div>

                            {isExpanded && (
                              <div data-testid={`section-scan-advice-${scan.id}`} style={{ borderTop: "1px solid #EDE9FE", background: "#FAFAFA" }} className="px-[14px] py-[12px]">
                                <div className="flex items-center justify-between mb-[8px]">
                                  <p className="font-body text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#7C3AED" }}>{t("health.pastScans.aiAdvice", "AI Advice")}</p>
                                  <div className="flex items-center gap-[4px]">
                                    <Clock size={11} style={{ color: "#9CA3AF" }} />
                                    <p className="font-body text-[11px]" style={{ color: "#9CA3AF" }}>{dateTime}</p>
                                  </div>
                                </div>
                                <p data-testid={`text-scan-advice-${scan.id}`} className="font-body text-[13px] text-vyva-text-1 leading-snug">{scan.advice}</p>
                                <div className="mt-[10px] flex items-center gap-[8px]">
                                  <button
                                    data-testid={`button-share-scan-${scan.id}`}
                                    onClick={async () => {
                                      const intro = t("health.pastScans.shareIntro", "My AI health scan says...");
                                      const text = `${intro} (${dateTime})\n\n${scan.advice}`;
                                      const confirmCopied = () => toast({ description: t("health.pastScans.copyAdviceDone", "Advice copied") });
                                      if (navigator.share) {
                                        try { await navigator.share({ title: t("health.pastScans.aiAdvice", "AI Advice"), text }); confirmCopied(); }
                                        catch (err: unknown) {
                                          if (err instanceof Error && err.name === "AbortError") return;
                                          try { await navigator.clipboard.writeText(text); confirmCopied(); } catch { return; }
                                        }
                                      } else {
                                        try { await navigator.clipboard.writeText(text); confirmCopied(); } catch { return; }
                                      }
                                    }}
                                    className="flex items-center gap-[5px] px-[10px] py-[5px] rounded-full transition-colors hover:bg-purple-50 active:scale-95"
                                    style={{ border: "1px solid #DDD6FE" }}
                                  >
                                    <Copy size={13} style={{ color: "#7C3AED" }} />
                                    <span className="font-body text-[12px]" style={{ color: "#7C3AED" }}>{t("health.pastScans.shareAdvice", "Share advice")}</span>
                                  </button>
                                  <button
                                    data-testid={`button-delete-scan-${scan.id}`}
                                    onClick={() => deleteScanMutation.mutate(scan.id)}
                                    disabled={deleteScanMutation.isPending}
                                    className="flex items-center gap-[5px] px-[10px] py-[5px] rounded-full transition-colors hover:bg-red-50 active:scale-95"
                                    style={{ border: "1px solid #FECACA" }}
                                  >
                                    <Trash2 size={13} style={{ color: "#EF4444" }} />
                                    <span className="font-body text-[12px]" style={{ color: "#EF4444" }}>{t("health.pastScans.delete", "Delete")}</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Encontrar especialista */}
            <div
              className="vyva-card overflow-hidden"
              style={{ background: "#FFFFFF", border: "1px solid #EDE5DB", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-center gap-4 px-[18px] py-[18px]">
                <div className="w-[58px] h-[58px] rounded-[20px] flex items-center justify-center flex-shrink-0" style={{ background: "#F5F3FF" }}>
                  <UserSearch size={30} style={{ color: "#7C3AED" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[21px] font-extrabold leading-tight text-vyva-text-1">{t("health.findSpecialist.title", "Find a Specialist")}</p>
                  <p className="mt-2 font-body text-[14px] font-medium leading-snug text-vyva-text-2">{t("health.findSpecialist.subtitle", "Connect with the right expert")}</p>
                </div>
                <button
                  data-testid="button-find-specialist"
                  onClick={() => {
                    if (specialistOpen) {
                      setSpecialistOpen(false);
                      setSpecialistResult(null);
                      return;
                    }
                    if (canUseService("localServices", "/health")) {
                      setSpecialistOpen(true);
                      setSpecialistResult(null);
                    }
                  }}
                  className="vyva-tap flex-shrink-0 rounded-full px-[16px] py-[8px] font-body text-[14px] font-semibold transition-all inline-flex items-center gap-2"
                  style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
                >
                  {specialistOpen ? (
                    <>
                      {t("health.findSpecialist.hideButton", "Hide")}
                      <ChevronUp size={16} />
                    </>
                  ) : (
                    t("health.findSpecialist.optionsButton", "Options")
                  )}
                </button>
              </div>

              {specialistOpen && (
                <div className="px-[18px] pb-[16px]" style={{ borderTop: "1px solid #F5F3FF" }}>
                  <div className="mt-[14px] rounded-[22px] border border-[#E9D5FF] bg-[#FAF7FF] p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-[#7C3AED] shadow-[0_10px_22px_rgba(124,58,237,0.10)]">
                        <UserSearch size={24} strokeWidth={2.4} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-body text-[20px] font-black leading-tight text-vyva-text-1">
                          {t("health.findSpecialist.title", "Find a Specialist")}
                        </span>
                        <span className="mt-1 block font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                          {t("health.findSpecialist.intro", "Describe the condition or concern. VYVA will look for the right specialist type and nearby options.")}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-[#E9D5FF] bg-white p-3">
                    <p className="mb-3 font-body text-[12px] font-black uppercase tracking-[0.1em]" style={{ color: "#7C3AED" }}>
                      {t("health.findSpecialist.experts.title", "Choose an expert")}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {askExpertCards.map((expert) => {
                        const Icon = expert.Icon;
                        return (
                          <button
                            key={expert.id}
                            type="button"
                            data-testid={`button-ask-expert-${expert.id}`}
                            onClick={expert.onClick}
                            className="vyva-tap flex min-h-[74px] w-full items-center gap-3 rounded-[18px] border border-[#EEE6FA] bg-[#FFFCFF] p-3 text-left transition-transform hover:-translate-y-0.5"
                          >
                            <span
                              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px]"
                              style={{ background: expert.iconBg, color: expert.iconColor }}
                            >
                              <Icon size={21} strokeWidth={2.4} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-body text-[15px] font-black leading-tight text-vyva-text-1">
                                {expert.label}
                              </span>
                              <span className="sr-only">
                                {expert.detail}
                              </span>
                            </span>
                            <ChevronRight size={17} strokeWidth={2.6} className="flex-shrink-0 text-[#7C3AED]" aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-3">
                    <button
                      data-testid="button-specialist-voice-search"
                      onClick={specialistVoiceListening ? stopSpecialistVoice : startSpecialistVoice}
                      disabled={specialistMutation.isPending}
                      className={`vyva-tap flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] px-[14px] py-[13px] font-body text-[15px] font-black transition-all ${specialistVoiceListening ? "mic-pulse-listening" : ""}`}
                      style={{
                        background: specialistVoiceListening ? "#ECFDF5" : "#F5F3FF",
                        color: specialistVoiceListening ? "#0A7C4E" : "#7C3AED",
                        border: specialistVoiceListening ? "1px solid #6EE7B7" : "1px solid #DDD6FE",
                      }}
                    >
                      {specialistVoiceListening ? <Square size={16} /> : <Mic size={16} />}
                      {specialistVoiceListening ? t("health.findSpecialist.listening", "Listening...") : t("health.findSpecialist.voiceSearch", "Search by voice")}
                    </button>
                    <label className="flex min-h-[58px] w-full items-center gap-3 rounded-[18px] border border-[#DDD6FE] bg-white px-4">
                      <UserSearch size={20} strokeWidth={2.3} className="flex-shrink-0 text-[#7C3AED]" aria-hidden="true" />
                      <input
                        data-testid="input-specialist-condition"
                        value={specialistCondition}
                        onChange={(e) => setSpecialistCondition(e.target.value)}
                        placeholder={t("health.findSpecialist.conditionPlaceholder", "e.g. knee pain, diabetes, memory...")}
                        className="min-w-0 flex-1 bg-transparent py-[14px] font-body text-[16px] font-semibold text-vyva-text-1 outline-none placeholder:text-[#A99BB5]"
                      />
                    </label>
                    <label className="flex min-h-[58px] w-full items-center gap-3 rounded-[18px] border border-[#EDE5DB] bg-[#FFFCF8] px-4">
                      <MapPin size={20} strokeWidth={2.3} className="flex-shrink-0 text-[#8A7A70]" aria-hidden="true" />
                      <input
                        data-testid="input-specialist-location"
                        value={specialistLocation}
                        onChange={(e) => {
                          setSpecialistLocationEdited(true);
                          setSpecialistLocation(e.target.value);
                        }}
                        placeholder={profileLocation || t("health.findSpecialist.locationPlaceholder", "City or area")}
                        className="min-w-0 flex-1 bg-transparent py-[14px] font-body text-[16px] font-semibold text-vyva-text-1 outline-none placeholder:text-[#B4A69C]"
                      />
                    </label>
                    <button
                      data-testid="button-run-specialist-search"
                      onClick={() => runSpecialistSearch()}
                      disabled={specialistMutation.isPending}
                      className="vyva-primary-action flex w-full items-center justify-center gap-2"
                      style={{ background: "#7C3AED", color: "#FFFFFF" }}
                    >
                      <span>{specialistMutation.isPending ? t("health.findSpecialist.searching", "Searching specialists...") : t("health.findSpecialist.searchButton", "Search specialists")}</span>
                      <ChevronRight size={18} strokeWidth={2.6} aria-hidden="true" />
                    </button>
                  </div>

                  {specialistResult && (
                    <div className="mt-[12px] flex flex-col gap-2">
                      <div className="rounded-[14px] px-[14px] py-[11px]" style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
                        <p className="font-body text-[12px] font-semibold" style={{ color: "#6D28D9" }}>
                          {t("health.findSpecialist.recommendedSpecialties", "Recommended specialties")}
                        </p>
                        <p className="font-body text-[14px] font-semibold text-vyva-text-1">
                          {specialistResult.matchedSpecialties.map((specialty) => displaySpecialtyText(specialty, specialistLanguage)).join(", ")}
                        </p>
                        <p className="font-body text-[11px] text-vyva-text-2 leading-snug mt-[6px]">
                          {t("health.findSpecialist.disclaimer", "This is not a diagnosis. If symptoms are serious or sudden, call emergency services or your doctor.")}
                        </p>
                      </div>
                      {specialistResult.providers.length === 0 ? (
                        <div className="rounded-[16px] px-[14px] py-[14px]" style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                          <p className="font-body text-[16px] font-semibold leading-tight text-vyva-text-1">
                            {t("health.findSpecialist.noProvidersTitle", "I could not find verified providers with enough data right now.")}
                          </p>
                          <p className="mt-2 font-body text-[13px] leading-snug text-vyva-text-2">
                            {t("health.findSpecialist.noProvidersBody", "You can try another city or open Google Maps to look for nearby options.")}
                          </p>
                          <button
                            data-testid="button-open-specialist-maps-search"
                            onClick={() => {
                              const query = specialistResult.mapsSearchUrl
                                ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${displaySpecialtyText(specialistResult.matchedSpecialties[0] ?? t("health.findSpecialist.doctorSearchTerm", "doctor"), specialistLanguage)} ${specialistLocation || profileLocation}`)}`;
                              window.open(query, "_blank", "noopener,noreferrer");
                            }}
                            className="mt-[12px] min-h-[44px] rounded-full px-[16px] font-body text-[14px] font-semibold flex items-center justify-center gap-2"
                            style={{ background: "#7C3AED", color: "#FFFFFF" }}
                          >
                            <MapPin size={15} />
                            {t("health.findSpecialist.openMaps", "Open Google Maps")}
                          </button>
                        </div>
                      ) : specialistResult.providers.map((spec, i) => {
                        const location = spec.address ?? spec.clinicName ?? specialistLocation;
                        const providerActions = specialistProviderServiceActionsFor(spec);

                        return (
                        <div key={`${spec.name}-${i}`} className="rounded-[16px] px-[14px] py-[13px]" style={{ background: "#F9F6F2", border: "1px solid #EDE5DB" }}>
                          <div className="flex items-start gap-3">
                            <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#EDE9FE" }}>
                              <UserSearch size={17} style={{ color: "#7C3AED" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-body text-[16px] font-semibold text-vyva-text-1 leading-tight">{spec.name}</p>
                              <p className="font-body text-[13px] font-semibold mt-[2px]" style={{ color: "#7C3AED" }}>{displaySpecialty(spec, specialistLanguage)}</p>
                            </div>
                          </div>

                          <div className="mt-[10px] grid gap-2">
                            {spec.phone && (
                              <div className="flex items-start gap-2 font-body text-[13px] text-vyva-text-2 leading-snug">
                                <Phone size={14} className="mt-[2px] flex-shrink-0" style={{ color: "#7C3AED" }} />
                                <span>{spec.phone}</span>
                              </div>
                            )}
                            <div className="flex items-start gap-2 font-body text-[13px] text-vyva-text-2 leading-snug">
                              <MapPin size={14} className="mt-[2px] flex-shrink-0" style={{ color: "#7C3AED" }} />
                              <span>{location}</span>
                            </div>
                            {spec.openingTimes && (
                              <div className="flex items-start gap-2 font-body text-[13px] text-vyva-text-2 leading-snug">
                                <Clock size={14} className="mt-[2px] flex-shrink-0" style={{ color: "#7C3AED" }} />
                                <span>{spec.openingTimes}</span>
                              </div>
                            )}
                            {spec.distanceLabel && (
                              <div className="flex items-start gap-2 font-body text-[13px] text-vyva-text-2 leading-snug">
                                <MapPin size={14} className="mt-[2px] flex-shrink-0" style={{ color: "#059669" }} />
                                <span>{spec.distanceLabel}</span>
                              </div>
                            )}
                            {spec.reviewScore && (
                              <div className="flex items-center gap-1 font-body text-[12px] text-vyva-text-2">
                                <Star size={12} fill="#F59E0B" style={{ color: "#F59E0B" }} />
                                <span>{spec.reviewScore}{spec.reviewCount ? ` (${spec.reviewCount})` : ""}</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-[12px] grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {providerActions.map((action) => {
                              if (action.kind === "call_provider" && action.href) {
                                return (
                                  <a
                                    key={action.kind}
                                    href={action.href}
                                    data-testid={`button-specialist-call-provider-${i}`}
                                    className="min-h-[48px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2"
                                    style={{ background: "#7C3AED", color: "#FFFFFF" }}
                                  >
                                    <PhoneCall size={15} />
                                    {t("health.findSpecialist.call", "Call")}
                                  </a>
                                );
                              }

                              if (action.kind === "book_appointment") {
                                if (action.href) {
                                  return (
                                    <a
                                      key={action.kind}
                                      href={action.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      data-testid={`button-specialist-book-appointment-${i}`}
                                      className="min-h-[48px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2"
                                      style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
                                    >
                                      <Calendar size={15} />
                                      {t("health.findSpecialist.bookAppointment", "Appointment")}
                                    </a>
                                  );
                                }

                                return (
                                  <button
                                    key={action.kind}
                                    type="button"
                                    data-testid={`button-specialist-book-appointment-${i}`}
                                    onClick={() => bookSpecialistMutation.mutate(spec)}
                                    disabled={bookSpecialistMutation.isPending}
                                    className="min-h-[48px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                                    style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
                                  >
                                    <Calendar size={15} />
                                    {t("health.findSpecialist.bookAppointment", "Appointment")}
                                  </button>
                                );
                              }

                              if (action.kind === "book_ride") {
                                return (
                                  <button
                                    key={action.kind}
                                    type="button"
                                    data-testid={`button-specialist-book-ride-${i}`}
                                    onClick={() => navigate("/concierge", { state: specialistRideState(spec, specialistCondition, specialistLanguage) })}
                                    className="min-h-[48px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2"
                                    style={{ background: "#F0FDF4", color: "#047857", border: "1px solid #BBF7D0" }}
                                  >
                                    <Car size={15} />
                                    {t("health.findSpecialist.bookRide", "Find transport")}
                                  </button>
                                );
                              }

                              if (action.kind === "open_map" && action.href) {
                                return (
                                  <button
                                    key={action.kind}
                                    type="button"
                                    data-testid={`button-map-specialist-${i}`}
                                    onClick={() => window.open(action.href!, "_blank", "noopener,noreferrer")}
                                    className="min-h-[48px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2"
                                    style={{ background: "#F0FDF4", color: "#047857", border: "1px solid #BBF7D0" }}
                                  >
                                    <MapPin size={15} />
                                    {t("health.findSpecialist.map", "Map")}
                                  </button>
                                );
                              }

                              return null;
                            })}
                            <button
                              data-testid={`button-share-specialist-${i}`}
                              onClick={() => shareSpecialistProvider(spec)}
                              className="min-h-[48px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2"
                              style={{ background: "#FFFFFF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
                            >
                              <Share2 size={15} />
                              {t("health.findSpecialist.share", "Share")}
                            </button>
                          </div>

                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div> : null}

      </MasterDashboardLayout>

      {/* Hidden file input for visual health scan */}
      <input
        ref={fileInputRef}
        type="file"
        accept={visualScanCaptureSource === "camera" ? "image/*" : "image/*,application/pdf,.pdf"}
        capture={visualScanCaptureSource === "camera" ? "environment" : undefined}
        className="hidden"
        onChange={handleWoundSelect}
        data-testid="input-wound-photo"
      />

      {visualLiveCameraOpen ? (
        <ShowVyvaLiveCamera
          useCaseId={visualScanReviewInput.useCaseId}
          onCapture={(file) => {
            setVisualLiveCameraOpen(false);
            prepareVisualCaptureFile(file);
          }}
          onUseDeviceCamera={() => openVisualNativePicker("camera")}
          onUpload={() => openVisualNativePicker("upload")}
          onCancel={() => setVisualLiveCameraOpen(false)}
        />
      ) : null}

      {visualCaptureDraft ? (
        <ShowVyvaCaptureCoach
          evidence={visualCaptureDraft}
          useCaseId={visualScanReviewInput.useCaseId}
          busy={woundAnalyzing}
          onUse={submitWoundEvidence}
          onRetake={retakeVisualCapture}
          onClose={() => setVisualCaptureDraft(null)}
        />
      ) : null}

      {/* Full-screen visual scan image modal */}
      {fullScreenScan && (
        <ScanFullScreenModal scan={fullScreenScan} onClose={() => setFullScreenScan(null)} t={t} />
      )}
    </>
  );
};

export default HealthScreen;
