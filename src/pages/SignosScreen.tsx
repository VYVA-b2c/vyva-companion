import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ArrowRight,
  Bluetooth,
  Brain,
  Camera,
  Check,
  CheckCircle2,
  Car,
  ChevronLeft,
  ClipboardList,
  Droplets,
  Dumbbell,
  Footprints,
  Heart,
  Keyboard,
  LucideIcon,
  Loader2,
  MessageCircle,
  Mic,
  Moon,
  Pill,
  Plus,
  ScanLine,
  Scale,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Stethoscope,
  Target,
  Thermometer,
  Trophy,
  Utensils,
  Users,
  Video,
  Wind,
  X,
} from "lucide-react";
import VitalsScan from "@/components/VitalsScan";
import {
  HealthWizardCard,
  HealthWizardShell,
  HealthWizardTopBar,
} from "@/components/health/HealthWizard";
import { PurpleModal, PurpleModalOption } from "@/components/vyva-ui";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import {
  appendPreventionLoopHistory,
  encodePreventionLearningQuery,
  learningContextForPreventionRequest,
  PREVENTION_LOOP_LAST_FEEDBACK_KEY,
  PREVENTION_LOOP_LAST_VIEW_KEY,
  preventionDateKey,
  preventionFeedbackStorageKey,
  readStoredJson,
  writeStoredJson,
} from "@/lib/preventionLoop";
import type {
  PreventionLoopLastFeedback,
  PreventionLoopLastView,
} from "@/lib/preventionLoop";
import { sanitizePhoneHref } from "@/lib/emergencyContacts";
import { captureVitalLensPayload } from "@/lib/vitalLens";
import { VITALS_DEVICE_CATALOG, type VitalsDeviceCatalogItem, type VitalsDeviceKind } from "@/lib/vitalsDeviceCatalog";
import {
  isWebBluetoothSupported,
  readStandardBluetoothDevice,
  type BluetoothCaptureState,
} from "@/lib/vitalsBluetooth";
import { type VitalsSourceConfidence } from "../../shared/vitalsEvidence";
import {
  VITALS_SIGNAL_CATALOG,
  type VitalsSignalKey,
} from "../../shared/vitalsSignalCatalog";
import { compatibleCaptureMethods } from "../../shared/vitalsAcquisition";
import {
  formatVitalsReadingDisplay,
  type ProposedVitalsReading,
  type VitalsParsingResult,
} from "../../shared/vitalsParsing";

type MetricType = "hr" | "rr" | "bp";
type ReadingSource = "phone_estimate" | "manual_entry" | "connected_device" | "clinical";

interface VitalsSummaryEntry {
  latest_value: string | null;
  latest_recorded_at: string | null;
  latest_source?: ReadingSource | null;
  latest_source_confidence?: VitalsSourceConfidence | null;
  latest_source_confidence_reason?: string | null;
  latest_source_display_label?: string | null;
  latest_source_context_label?: string | null;
  trend: (string | null)[];
  has_data: boolean;
}

interface VitalsResponse {
  summary: Record<string, VitalsSummaryEntry>;
  compliance_days: boolean[];
}

type PreventionFocus = "Heart" | "Falls" | "Diabetes" | "Medicine" | "Follow-up" | "Plan";
type PreventionConfidence = "strong" | "moderate" | "limited";
type PreventionActionStep = "Eat" | "Move" | "Calm" | "Avoid" | "Check" | "Protect" | "Home" | "Medicine" | "Follow-up" | "Review" | "Plan" | "Sleep";
type PreventionActionTone = "food" | "movement" | "check" | "support" | "medicine";

type PreventionSignal = {
  id: string;
  label: string;
  detail?: string;
  category: "profile" | "vitals" | "medicine" | "symptom" | "safety";
  strength: "high" | "medium" | "low";
  route?: string;
};

type PreventionInsight = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "alert" | "caution" | "steady";
  route?: string;
};

type PreventionAction = {
  id: string;
  label: string;
  detail: string;
  route: string;
  priority: "primary" | "secondary";
  mode?: "navigate" | "voice";
};

type PreventionShoppingPrefill = {
  needText: string;
  category: string;
  priorities: string[];
  constraints?: string[];
  packageId?: string;
  sourceRecommendation?: string;
};

type PreventionGuidanceAction = {
  id: string;
  label: string;
  detail: string;
  route: string;
  priority: "primary" | "secondary";
  mode?: "navigate" | "voice";
  shoppingPrefill?: PreventionShoppingPrefill;
};

type PreventionActionSheet = {
  title: string;
  summary: string;
  primaryAction: PreventionGuidanceAction;
  secondaryActions: PreventionGuidanceAction[];
  safetyNote?: string;
};

type PreventionDailyAction = {
  id: string;
  step: PreventionActionStep;
  title: string;
  detail: string;
  why: string;
  evidenceLabel: string;
  tone: PreventionActionTone;
  actionSheet: PreventionActionSheet;
  feedbackOptions: Array<{
    id: "done" | "too_hard" | "remind" | "ask_vyva";
    label: string;
  }>;
};

type PreventionWeeklySummary = {
  headline: string;
  detail: string;
  bullets: string[];
  doctorSummary: string;
  caregiverSummary: string;
};

type PreventionFocusResponse = {
  focus: PreventionFocus;
  headline: string;
  why: string[];
  todayAction: string;
  helpSigns: string[];
  primaryRoute: string;
  secondaryRoute?: string;
  confidence: PreventionConfidence;
  signals?: PreventionSignal[];
  insights?: PreventionInsight[];
  actions?: PreventionAction[];
  dailyActions?: PreventionDailyAction[];
  personalizationSummary?: string[];
  profileSignals?: string[];
  weeklySummary?: PreventionWeeklySummary;
  generatedAt?: string;
};

type AgeWellConfidenceLabel = "Clear" | "Likely" | "Building";

type AgeWellScore = {
  value: number;
  label: AgeWellConfidenceLabel;
};

type AgeWellFeedback = "done" | "too_hard" | "not_today";

type StoredAgeWellFeedback = Record<string, AgeWellFeedback>;

type AgeWellMissionKind = "first" | "steady" | "support";

type AgeWellMissionStep = {
  id: AgeWellMissionKind;
  number: number;
  label: string;
  detail: string;
  action: PreventionDailyAction;
  Icon: LucideIcon;
  accent: string;
  soft: string;
  onOpen?: () => void;
};

type AgeWellSignalRow = {
  id: string;
  label: string;
  value: string;
  detail: string;
  Icon: LucideIcon;
  accent: string;
  soft: string;
  onClick?: () => void;
};

type VitalsCaptureMode = "text" | "voice" | "photo";

interface MetricMeta {
  id: MetricType;
  Icon: LucideIcon;
  labelKey: string;
  fallbackLabel: string;
  unit: string;
  placeholder: string;
  accent: string;
  soft: string;
  range?: { low: number; high: number };
}

const METRIC_META: Record<MetricType, MetricMeta> = {
  hr: {
    id: "hr",
    Icon: Heart,
    labelKey: "statusVitals.metrics.heartRate",
    fallbackLabel: "Heart rate",
    unit: "bpm",
    placeholder: "72",
    accent: "#BE123C",
    soft: "#FFF1F2",
    range: { low: 50, high: 100 },
  },
  rr: {
    id: "rr",
    Icon: Wind,
    labelKey: "statusVitals.metrics.respiration",
    fallbackLabel: "Respiration",
    unit: "rpm",
    placeholder: "16",
    accent: "#0369A1",
    soft: "#EFF6FF",
    range: { low: 12, high: 20 },
  },
  bp: {
    id: "bp",
    Icon: Activity,
    labelKey: "statusVitals.metrics.bloodPressure",
    fallbackLabel: "Blood pressure",
    unit: "mmHg",
    placeholder: "118/76",
    accent: "#6B21A8",
    soft: "#F5F3FF",
  },
};

const ENGINE_SIGNAL_BY_METRIC: Record<MetricType, string> = {
  hr: "resting_hr_bpm",
  rr: "respiratory_rate",
  bp: "bp_systolic",
};

const ageWellFallbackDailyActions: PreventionDailyAction[] = [
  {
    id: "fallback-eat",
    step: "Eat",
    title: "Steady meal",
    detail: "Fruit or veg, protein, and water.",
    why: "A steady meal supports energy and medication routines.",
    evidenceLabel: "Daily basics",
    tone: "food",
    actionSheet: {
      title: "Steady meal",
      summary: "Choose a simple meal that fits your diet and allergies.",
      primaryAction: {
        id: "show-groceries",
        label: "Food ideas",
        detail: "Open simple groceries or prepared meals",
        route: "/concierge/shopping",
        priority: "primary",
        shoppingPrefill: {
          needText: "Help me choose simple groceries or prepared meals that fit my diet. Do not order without my confirmation.",
          category: "groceries",
          priorities: ["diet", "simplicity", "delivery"],
          constraints: ["check ingredients for allergies", "confirm before ordering"],
          packageId: "easy_meals",
        },
      },
      secondaryActions: [],
      safetyNote: "Check ingredients fit your diet and allergies.",
    },
    feedbackOptions: [
      { id: "done", label: "Done" },
      { id: "too_hard", label: "Too hard" },
    ],
  },
  {
    id: "fallback-move",
    step: "Move",
    title: "Gentle movement",
    detail: "Try a short walk, stretch, or calm breathing.",
    why: "Small movement helps the plan without overdoing it.",
    evidenceLabel: "Gentle",
    tone: "movement",
    actionSheet: {
      title: "Gentle movement",
      summary: "Pick a light routine that feels safe today.",
      primaryAction: {
        id: "start-breathing",
        label: "Start calm",
        detail: "Open a breathing routine",
        route: "/activities/relax-breathe",
        priority: "primary",
      },
      secondaryActions: [],
      safetyNote: "Stop and ask for help if you feel chest pain, faint, or very breathless.",
    },
    feedbackOptions: [
      { id: "done", label: "Done" },
      { id: "too_hard", label: "Too hard" },
    ],
  },
  {
    id: "fallback-sleep",
    step: "Sleep",
    title: "Wind-down tonight",
    detail: "Keep bedtime calm and simple.",
    why: "A steady evening routine supports recovery.",
    evidenceLabel: "Sleep",
    tone: "support",
    actionSheet: {
      title: "Wind-down tonight",
      summary: "Choose one calm evening step.",
      primaryAction: {
        id: "open-evening-plan",
        label: "Evening plan",
        detail: "Open gentle prevention ideas",
        route: "/health/prevention",
        priority: "primary",
      },
      secondaryActions: [],
    },
    feedbackOptions: [
      { id: "done", label: "Done" },
      { id: "too_hard", label: "Too hard" },
    ],
  },
];

const ageWellFallbackFocus: PreventionFocusResponse = {
  focus: "Plan",
  headline: "Choose one useful step.",
  why: ["Small food, movement, and recovery choices help VYVA keep the plan practical."],
  todayAction: "Start with the easiest AgeWell move.",
  helpSigns: ["Sudden chest pain", "Trouble breathing", "New confusion"],
  primaryRoute: "/health/check-in",
  confidence: "limited",
  dailyActions: ageWellFallbackDailyActions,
  personalizationSummary: ["Health profile"],
  profileSignals: ["Plan"],
  weeklySummary: {
    headline: "VYVA is still learning.",
    detail: "Mark what works or feels hard so tomorrow can be more personal.",
    bullets: ["Start with one small signal"],
    doctorSummary: "No weekly prevention feedback yet.",
    caregiverSummary: "No weekly prevention feedback yet.",
  },
  generatedAt: new Date(0).toISOString(),
};

function ageWellLibraryAction({
  id,
  step,
  title,
  detail,
  why,
  evidenceLabel,
  tone,
  route,
  label,
  shoppingPrefill,
}: {
  id: string;
  step: PreventionActionStep;
  title: string;
  detail: string;
  why: string;
  evidenceLabel: string;
  tone: PreventionActionTone;
  route: string;
  label: string;
  shoppingPrefill?: PreventionShoppingPrefill;
}): PreventionDailyAction {
  return {
    id,
    step,
    title,
    detail,
    why,
    evidenceLabel,
    tone,
    actionSheet: {
      title,
      summary: detail,
      primaryAction: {
        id: `${id}-open`,
        label,
        detail,
        route,
        priority: "primary",
        shoppingPrefill,
      },
      secondaryActions: [],
    },
    feedbackOptions: [
      { id: "done", label: "Done" },
      { id: "too_hard", label: "Too hard" },
    ],
  };
}

const ageWellActionLibraryByFocus: Partial<Record<PreventionFocus, PreventionDailyAction[]>> = {
  Heart: [
    ageWellLibraryAction({
      id: "heart-lower-salt-lunch",
      step: "Eat",
      title: "Lower-salt lunch",
      detail: "Choose one simple lower-salt meal.",
      why: "Less salt is a practical heart step today.",
      evidenceLabel: "Heart",
      tone: "food",
      route: "/concierge/shopping",
      label: "Food ideas",
      shoppingPrefill: {
        needText: "Help me choose a simple lower-salt lunch. Do not order without my confirmation.",
        category: "prepared_meals",
        priorities: ["low salt", "simple", "delivery"],
        constraints: ["confirm ingredients", "confirm before ordering"],
        packageId: "heart_low_salt_lunch",
      },
    }),
    ageWellLibraryAction({
      id: "heart-steady-walk",
      step: "Move",
      title: "Steady walk",
      detail: "Keep an easy talk pace.",
      why: "Gentle movement supports heart, mood, and circulation.",
      evidenceLabel: "Mobility",
      tone: "movement",
      route: "/social-rooms/morning-movement/exercises/chair-yoga",
      label: "Start easy",
    }),
    ageWellLibraryAction({
      id: "heart-calm-breathing",
      step: "Calm",
      title: "Slow breathing",
      detail: "Take two quiet minutes.",
      why: "Slow breathing can help the body settle.",
      evidenceLabel: "Calm",
      tone: "support",
      route: "/activities/relax-breathe",
      label: "Breathe",
    }),
    ageWellLibraryAction({
      id: "heart-avoid-rushing",
      step: "Avoid",
      title: "Rise slowly",
      detail: "Pause before standing up.",
      why: "Avoiding rushing helps reduce dizziness and strain.",
      evidenceLabel: "Avoid",
      tone: "support",
      route: "/health/prevention",
      label: "Why it helps",
    }),
  ],
  Diabetes: [
    ageWellLibraryAction({
      id: "diabetes-protein-breakfast",
      step: "Eat",
      title: "Protein breakfast",
      detail: "Choose a steady morning meal.",
      why: "Protein helps keep morning energy steadier.",
      evidenceLabel: "Sugar",
      tone: "food",
      route: "/concierge/shopping",
      label: "Food ideas",
      shoppingPrefill: {
        needText: "Help me choose a simple protein breakfast for steadier blood sugar. Do not order without my confirmation.",
        category: "groceries",
        priorities: ["protein", "low sugar", "simple"],
        constraints: ["confirm ingredients", "confirm before ordering"],
        packageId: "diabetes_protein_breakfast",
      },
    }),
    ageWellLibraryAction({
      id: "diabetes-after-meal-walk",
      step: "Move",
      title: "After-meal walk",
      detail: "Walk gently after eating.",
      why: "A short walk can support glucose patterns.",
      evidenceLabel: "Glucose",
      tone: "movement",
      route: "/social-rooms/morning-movement/exercises/chair-yoga",
      label: "Start easy",
    }),
    ageWellLibraryAction({
      id: "diabetes-avoid-sugary-drinks",
      step: "Avoid",
      title: "Skip sugary drinks",
      detail: "Choose water or unsweetened tea.",
      why: "Drinks can raise sugar quickly.",
      evidenceLabel: "Avoid",
      tone: "support",
      route: "/health/prevention",
      label: "Why it helps",
    }),
  ],
  Falls: [
    ageWellLibraryAction({
      id: "falls-chair-mobility",
      step: "Move",
      title: "Chair mobility",
      detail: "Five safe seated minutes.",
      why: "Seated movement supports balance without rushing.",
      evidenceLabel: "Mobility",
      tone: "movement",
      route: "/social-rooms/morning-movement/exercises/chair-yoga",
      label: "Start easy",
    }),
    ageWellLibraryAction({
      id: "falls-walking-path",
      step: "Home",
      title: "Clear your path",
      detail: "Check rugs, wires, and hallway.",
      why: "A clear route lowers fall risk at home.",
      evidenceLabel: "Home",
      tone: "support",
      route: "/safe-home",
      label: "Safe home",
    }),
    ageWellLibraryAction({
      id: "falls-rise-slowly",
      step: "Avoid",
      title: "Stand up slowly",
      detail: "Pause before the first step.",
      why: "Rushing can make dizziness or imbalance worse.",
      evidenceLabel: "Avoid",
      tone: "support",
      route: "/health/prevention",
      label: "Why it helps",
    }),
  ],
  Medicine: [
    ageWellLibraryAction({
      id: "medicine-side-effects",
      step: "Medicine",
      title: "Know side effects",
      detail: "Review what to watch for.",
      why: "Awareness helps you spot changes early.",
      evidenceLabel: "Medicine",
      tone: "medicine",
      route: "/meds",
      label: "Review meds",
    }),
    ageWellLibraryAction({
      id: "medicine-same-time",
      step: "Medicine",
      title: "Same time today",
      detail: "Keep the routine steady.",
      why: "Consistent timing supports the medication routine.",
      evidenceLabel: "Routine",
      tone: "medicine",
      route: "/meds",
      label: "Open meds",
    }),
    ageWellLibraryAction({
      id: "medicine-calm-check",
      step: "Calm",
      title: "Pause and check",
      detail: "Notice dizziness or stomach upset.",
      why: "A calm check-in helps separate side effects from noise.",
      evidenceLabel: "Body",
      tone: "support",
      route: "/health/check-in",
      label: "Check in",
    }),
  ],
  "Follow-up": [
    ageWellLibraryAction({
      id: "follow-up-symptom-change",
      step: "Follow-up",
      title: "Note any change",
      detail: "Better, same, or worse?",
      why: "A simple change note is useful for care decisions.",
      evidenceLabel: "Symptoms",
      tone: "support",
      route: "/health/check-in",
      label: "Check in",
    }),
    ageWellLibraryAction({
      id: "follow-up-doctor-question",
      step: "Follow-up",
      title: "Doctor question",
      detail: "Write one thing to ask.",
      why: "One prepared question makes follow-up easier.",
      evidenceLabel: "Care",
      tone: "support",
      route: "/health/doctor",
      label: "Doctor help",
    }),
    ageWellLibraryAction({
      id: "follow-up-book-care",
      step: "Follow-up",
      title: "Book care",
      detail: "Get help arranging the visit.",
      why: "VYVA can help coordinate without booking until you confirm.",
      evidenceLabel: "Concierge",
      tone: "support",
      route: "/concierge",
      label: "Book help",
    }),
  ],
  Plan: [
    ...ageWellFallbackDailyActions.filter((action) => action.id !== "fallback-sleep"),
    ageWellLibraryAction({
      id: "plan-wind-down",
      step: "Sleep",
      title: "Wind-down tonight",
      detail: "Keep bedtime calm and simple.",
      why: "A steady night routine supports recovery.",
      evidenceLabel: "Sleep",
      tone: "support",
      route: "/health/prevention",
      label: "Evening plan",
    }),
  ],
};

const DEVICE_ICON_BY_ID: Record<VitalsDeviceKind, LucideIcon> = {
  bp_cuff: Activity,
  pulse_oximeter: Wind,
  thermometer: Thermometer,
  glucose_meter: Stethoscope,
  weight_scale: Scale,
  heart_monitor: Heart,
};

const VITALS_AUDIO_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function supportedVitalsAudioType() {
  if (typeof MediaRecorder === "undefined") return "";
  return VITALS_AUDIO_TYPES.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  }) ?? "";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function publicSignalLabel(signal: VitalsSignalKey) {
  if (signal === "bp_systolic" || signal === "bp_diastolic") return "Blood pressure";
  return VITALS_SIGNAL_CATALOG[signal].shortLabel;
}

type ProposedVitalsReadingCard = {
  key: string;
  display: string;
  explanation: string;
  confidence: VitalsSourceConfidence;
};

function lowerConfidence(a: VitalsSourceConfidence, b: VitalsSourceConfidence): VitalsSourceConfidence {
  const rank: Record<VitalsSourceConfidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[a] <= rank[b] ? a : b;
}

function proposedVitalsReadingCards(readings: ProposedVitalsReading[]): ProposedVitalsReadingCard[] {
  const systolic = readings.find((reading) => reading.signal_type === "bp_systolic");
  const diastolic = readings.find((reading) => reading.signal_type === "bp_diastolic");
  const cards: ProposedVitalsReadingCard[] = [];

  for (const reading of readings) {
    if (reading.signal_type === "bp_systolic" && diastolic) {
      cards.push({
        key: "blood-pressure-pair",
        display: `Blood pressure: ${reading.value}/${diastolic.value} mmHg`,
        explanation: "Blood pressure reading detected.",
        confidence: lowerConfidence(reading.confidence, diastolic.confidence),
      });
      continue;
    }

    if (reading.signal_type === "bp_diastolic" && systolic) continue;

    cards.push({
      key: `${reading.signal_type}-${reading.value}-${reading.context_tag}`,
      display: formatVitalsReadingDisplay(reading),
      explanation: reading.explanation,
      confidence: reading.confidence,
    });
  }

  return cards;
}

function readingsPayloadFromProposed(readings: ProposedVitalsReading[]) {
  return readings.map((reading) => ({
    signal_type: reading.signal_type,
    value: reading.value,
    source: reading.source,
    capture_method: reading.capture_method,
    context_tag: reading.context_tag,
    unit: reading.unit,
    recorded_at: reading.recorded_at,
    source_ref: reading.source_ref,
  }));
}

type VitalsStatusServiceActionKind =
  | "call_gp"
  | "email_gp"
  | "doctor_help"
  | "add_doctor_contact"
  | "schedule_appointment"
  | "book_ride";

type VitalsStatusServiceAction = {
  kind: VitalsStatusServiceActionKind;
  label: string;
  href?: string;
  to?: string;
  state?: Record<string, unknown>;
};

type VitalsStatusServiceLabels = {
  callGp: string;
  callGpWithName: string;
  emailGp: string;
  doctorHelp: string;
  addDoctor: string;
  appointment: string;
  ride: string;
  appointmentPrefill: string;
  ridePrefill: string;
};

export function vitalsStatusServiceActionsFor({
  gpName,
  gpPhone,
  gpEmail,
  context,
  labels,
}: {
  gpName?: string | null;
  gpPhone?: string | null;
  gpEmail?: string | null;
  context: string;
  labels: VitalsStatusServiceLabels;
}): VitalsStatusServiceAction[] {
  const actions: VitalsStatusServiceAction[] = [];
  const gpPhoneHref = sanitizePhoneHref(gpPhone);
  const email = gpEmail?.trim() ?? "";
  const displayName = gpName?.trim();
  const safeContext = context.trim() || "VYVA vitals summary requested.";

  if (gpPhoneHref) {
    actions.push({
      kind: "call_gp",
      label: displayName ? labels.callGpWithName.replace("{{name}}", displayName) : labels.callGp,
      href: gpPhoneHref,
    });
  }

  if (email) {
    actions.push({
      kind: "email_gp",
      label: labels.emailGp,
      href: `mailto:${email}?subject=${encodeURIComponent("VYVA vitals summary")}&body=${encodeURIComponent(safeContext)}`,
    });
  }

  if (!gpPhoneHref && !email) {
    actions.push({
      kind: "add_doctor_contact",
      label: labels.addDoctor,
      to: "/onboarding/profile/gp",
    });
  }

  actions.push({
    kind: "doctor_help",
    label: labels.doctorHelp,
    to: "/health/doctor",
    state: {
      autoStartVoice: true,
      latestSymptomReport: safeContext,
      source: "vitals_status",
    },
  });

  actions.push({
    kind: "schedule_appointment",
    label: labels.appointment,
    to: "/concierge",
    state: {
      conciergePrefill: {
        kind: "appointment",
        message: `${labels.appointmentPrefill}\n\nContext:\n${safeContext}`,
        source: "vitals_safety",
      },
    },
  });

  actions.push({
    kind: "book_ride",
    label: labels.ride,
    to: "/concierge",
    state: {
      conciergePrefill: {
        kind: "ride",
        message: `${labels.ridePrefill}\n\nContext:\n${safeContext}`,
        source: "vitals_safety",
      },
    },
  });

  return actions;
}

function formatRecordedAt(iso: string | null, language: string): string {
  if (!iso) return "--";
  const date = new Date(iso);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24) {
    return `${language.startsWith("es") ? "Hoy" : "Today"}, ${date.toLocaleTimeString(language, {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  if (diffHours < 48) return language.startsWith("es") ? "Ayer" : "Yesterday";
  return date.toLocaleDateString(language, { day: "numeric", month: "short" });
}

function metricHasValue(summary: VitalsResponse["summary"] | undefined, key: MetricType) {
  const entry = summary?.[key];
  return Boolean(entry?.has_data && entry.latest_value);
}

function metricDisplay(summary: VitalsResponse["summary"] | undefined, key: MetricType, missingLabel: string) {
  const entry = summary?.[key];
  if (!entry?.has_data || !entry.latest_value) return missingLabel;
  if (key === "hr") return `Pulse ${entry.latest_value}`;
  if (key === "rr") return `Breathing ${entry.latest_value}`;
  return `BP ${entry.latest_value}`;
}

function findSignal(focus: PreventionFocusResponse, category: PreventionSignal["category"]) {
  return focus.signals?.find((signal) => signal.category === category);
}

function findInsight(focus: PreventionFocusResponse, matcher: RegExp) {
  return focus.insights?.find((insight) => matcher.test(`${insight.id} ${insight.label} ${insight.value}`));
}

function confidenceLabel(confidence: PreventionConfidence | undefined, hasPrevention: boolean): AgeWellConfidenceLabel {
  if (!hasPrevention) return "Building";
  if (confidence === "strong") return "Clear";
  if (confidence === "moderate") return "Likely";
  return "Building";
}

function calculateAgeWellScore({
  summary,
  focus,
  hasPrevention,
}: {
  summary: VitalsResponse["summary"] | undefined;
  focus: PreventionFocusResponse;
  hasPrevention: boolean;
}): AgeWellScore {
  let value = 45;
  if (metricHasValue(summary, "bp")) value += 15;
  if (metricHasValue(summary, "hr")) value += 8;
  if (metricHasValue(summary, "rr")) value += 7;

  if (hasPrevention) {
    value += focus.confidence === "strong" ? 15 : focus.confidence === "moderate" ? 10 : 5;
    value += Math.min(focus.dailyActions?.length ?? 0, 3) * 5;
    if (focus.weeklySummary?.headline || focus.weeklySummary?.detail || focus.weeklySummary?.bullets?.length) value += 5;
  }

  return {
    value: Math.min(98, value),
    label: confidenceLabel(focus.confidence, hasPrevention),
  };
}

function actionRouteLabel(action: PreventionDailyAction) {
  return action.actionSheet?.primaryAction?.label || "Open";
}

function ageWellStepKey(action: PreventionDailyAction) {
  return action.step.toLowerCase();
}

function isVitalsCaptureAction(action: PreventionDailyAction) {
  const route = action.actionSheet.primaryAction.route;
  const text = `${action.id} ${action.title} ${action.detail} ${action.evidenceLabel}`.toLowerCase();
  return route === "/health/vitals" || (ageWellStepKey(action) === "check" && /\bbp\b|blood pressure|reading|vital/.test(text));
}

function seedActionsForFocus(focus: PreventionFocus) {
  return ageWellActionLibraryByFocus[focus] ?? ageWellActionLibraryByFocus.Plan ?? [];
}

function selectLongevityMoves(actions: PreventionDailyAction[] | undefined, focus: PreventionFocus): PreventionDailyAction[] {
  const engineActions = actions?.length ? actions : [];
  const source = [
    ...(engineActions.length ? engineActions : seedActionsForFocus(focus)),
    ...ageWellFallbackDailyActions,
  ].filter((item, index, list) => list.findIndex((existing) => existing.id === item.id) === index);
  const usefulSource = source.filter((item) => !isVitalsCaptureAction(item));
  const buckets: Array<(item: PreventionDailyAction) => boolean> = [
    (item) => ageWellStepKey(item) === "eat",
    (item) => ageWellStepKey(item) === "move" || ageWellStepKey(item) === "calm",
    (item) => ["avoid", "protect", "medicine", "home", "follow-up", "review", "plan", "sleep"].includes(ageWellStepKey(item)),
  ];
  const selected: PreventionDailyAction[] = [];

  for (const matcher of buckets) {
    const match = usefulSource.find((item) => matcher(item) && !selected.some((existing) => existing.id === item.id));
    if (match) selected.push(match);
  }

  for (const item of usefulSource) {
    if (selected.length >= 3) break;
    if (!selected.some((existing) => existing.id === item.id)) selected.push(item);
  }

  return selected.slice(0, 3);
}

function ageWellFocusLabel(focus: PreventionFocus) {
  if (focus === "Heart") return "Heart";
  if (focus === "Falls") return "Falls";
  if (focus === "Diabetes") return "Sugar";
  if (focus === "Medicine") return "Medicine";
  if (focus === "Follow-up") return "Follow-up";
  return "Plan";
}

function buildAgeWellMission({
  actions,
}: {
  actions: PreventionDailyAction[];
}): AgeWellMissionStep[] {
  const eatAction = actions.find((action) => ageWellStepKey(action) === "eat");
  const moveAction = actions.find((action) => ageWellStepKey(action) === "move" || ageWellStepKey(action) === "calm");
  const protectAction = actions.find((action) => ["avoid", "protect", "medicine", "home", "follow-up", "review", "plan", "sleep"].includes(ageWellStepKey(action)));
  const sourceOrder = [eatAction, moveAction, protectAction, ...actions];
  const uniqueActions = sourceOrder.filter((action): action is PreventionDailyAction => Boolean(action) && !isVitalsCaptureAction(action))
    .filter((action, index, list) => list.findIndex((item) => item.id === action.id) === index)
    .slice(0, 3);
  const fallback = uniqueActions.length ? uniqueActions : ageWellFallbackDailyActions.slice(0, 3);
  const labels: Array<Omit<AgeWellMissionStep, "action">> = [
    {
      id: "first",
      number: 1,
      label: "Nourish",
      detail: "A practical food step for today.",
      Icon: Utensils,
      accent: "#B45309",
      soft: "#FFF7ED",
    },
    {
      id: "steady",
      number: 2,
      label: "Move or calm",
      detail: "Keep the body steady.",
      Icon: Footprints,
      accent: "#047857",
      soft: "#ECFDF5",
    },
    {
      id: "support",
      number: 3,
      label: "Protect",
      detail: "Avoid one thing that can make today harder.",
      Icon: ShieldCheck,
      accent: "#6B21A8",
      soft: "#F5F3FF",
    },
  ];

  return fallback.map((action, index) => ({
    ...labels[index],
    action,
    detail: action.detail || labels[index].detail,
  }));
}

function easierAgeWellPrimaryAction(action: PreventionDailyAction): PreventionGuidanceAction {
  if (action.tone === "food") {
    return {
      id: "agewell-easy-food",
      label: "Easy food help",
      detail: "Prepared meal or simple grocery support",
      route: "/concierge/shopping",
      priority: "primary",
      shoppingPrefill: action.actionSheet.primaryAction.shoppingPrefill ?? {
        needText: `Find an easy version of this prevention step: ${action.title}. Keep it simple and do not order without my confirmation.`,
        category: "groceries",
        priorities: ["simple", "delivery", "diet"],
        constraints: ["easy preparation", "confirm before ordering"],
        packageId: "easy_agewell_food",
      },
    };
  }

  if (action.tone === "movement" || action.tone === "support") {
    return {
      id: "agewell-easy-calm",
      label: "Start easier",
      detail: "Breathing or seated reset",
      route: "/activities/relax-breathe",
      priority: "primary",
    };
  }

  return {
    id: "agewell-easy-vyva",
    label: "Ask VYVA",
    detail: "Break this into one safe step",
    route: "/health/doctor",
    priority: "primary",
    mode: "voice",
  };
}

function makeAgeWellEasierAction(action: PreventionDailyAction, reason: string): PreventionDailyAction {
  const primaryAction = easierAgeWellPrimaryAction(action);
  return {
    ...action,
    title: "Easier version",
    detail: action.tone === "food"
      ? "Use one simple swap or prepared help."
      : action.tone === "movement" || action.tone === "support"
        ? "Start with breathing or seated movement."
        : "Ask VYVA for one small step.",
    why: reason,
    evidenceLabel: "Adjusted",
    actionSheet: {
      title: "Easier version",
      summary: `${reason} Start smaller and keep the original step available.`,
      primaryAction,
      secondaryActions: [
        {
          id: "agewell-original-action",
          label: action.actionSheet.primaryAction.label,
          detail: action.actionSheet.primaryAction.detail,
          route: action.actionSheet.primaryAction.route,
          priority: "secondary",
          mode: action.actionSheet.primaryAction.mode,
          shoppingPrefill: action.actionSheet.primaryAction.shoppingPrefill,
        },
        {
          id: "agewell-ask-easier",
          label: "Ask VYVA",
          detail: `Make ${action.title} easier for me`,
          route: "/health/doctor",
          priority: "secondary",
          mode: "voice",
        },
      ],
      safetyNote: action.actionSheet.safetyNote,
    },
  };
}

function ageWellActionMatchesFeedback(action: PreventionDailyAction, last: PreventionLoopLastFeedback): boolean {
  return action.id === last.actionId || action.step === last.step || action.tone === last.tone;
}

function adaptAgeWellMovesForLoop({
  actions,
  feedback,
  lastFeedback,
  lastView,
  currentDate,
}: {
  actions: PreventionDailyAction[];
  feedback: StoredAgeWellFeedback;
  lastFeedback: PreventionLoopLastFeedback | null;
  lastView: PreventionLoopLastView | null;
  currentDate: string;
}): PreventionDailyAction[] {
  const adapted = actions.map((action) => {
    if (feedback[action.id] === "too_hard") {
      return makeAgeWellEasierAction(action, "You said this felt too hard, so VYVA made it smaller.");
    }
    if (lastFeedback?.date !== currentDate && lastFeedback?.feedback === "too_hard" && ageWellActionMatchesFeedback(action, lastFeedback)) {
      return makeAgeWellEasierAction(action, "Yesterday felt hard, so VYVA starts easier today.");
    }
    if (!lastFeedback && lastView && lastView.date !== currentDate && action === actions[0]) {
      return makeAgeWellEasierAction(action, "Yesterday was skipped, so VYVA starts with a smaller step.");
    }
    return action;
  });

  const hasDoneToday = Object.values(feedback).includes("done");
  if (!hasDoneToday && lastFeedback?.date !== currentDate && lastFeedback?.feedback === "done") {
    const familyIndex = adapted.findIndex((action) => action.id !== lastFeedback.actionId && (
      action.step === lastFeedback.step || action.tone === lastFeedback.tone
    ));
    if (familyIndex > 0) {
      const next = [...adapted];
      const [familyAction] = next.splice(familyIndex, 1);
      next.unshift(familyAction);
      return next;
    }
  }

  return adapted;
}

function ageWellLoopInsight({
  focus,
  feedback,
  lastFeedback,
  lastView,
  currentDate,
  hasRecentLearning,
}: {
  focus: PreventionFocusResponse;
  feedback: StoredAgeWellFeedback;
  lastFeedback: PreventionLoopLastFeedback | null;
  lastView: PreventionLoopLastView | null;
  currentDate: string;
  hasRecentLearning: boolean;
}): string {
  const values = Object.values(feedback);
  if (values.includes("too_hard")) return "Made easier for today.";
  if (values.includes("done")) return "VYVA will build on what worked.";
  if (values.includes("not_today")) return "Kept lighter for later.";
  if (lastFeedback && lastFeedback.date !== currentDate && lastFeedback.feedback === "too_hard") return "Started easier today.";
  if (lastFeedback && lastFeedback.date !== currentDate && lastFeedback.feedback === "done") return "Fresh step, same rhythm.";
  if (!lastFeedback && lastView && lastView.date !== currentDate) return "Smaller step today.";
  if (hasRecentLearning) return "Using recent feedback.";
  return `Your choice tunes tomorrow's ${focus.focus.toLowerCase()} plan.`;
}

function dailyActionToneStyle(tone: PreventionActionTone) {
  if (tone === "food") {
    return {
      border: "#FAD7AA",
      bg: "#FFFCF7",
      iconBg: "#FFF2DC",
      iconColor: "#B45309",
      chipBg: "#FFF7ED",
      chipText: "#9A3412",
    };
  }
  if (tone === "movement") {
    return {
      border: "#BDEAD7",
      bg: "#F8FFFC",
      iconBg: "#E9FBF3",
      iconColor: "#047857",
      chipBg: "#ECFDF5",
      chipText: "#047857",
    };
  }
  if (tone === "medicine") {
    return {
      border: "#E9D5FF",
      bg: "#FFFBFF",
      iconBg: "#FDF4FF",
      iconColor: "#86198F",
      chipBg: "#F5F3FF",
      chipText: "#6B21A8",
    };
  }
  if (tone === "support") {
    return {
      border: "#FED7AA",
      bg: "#FFFCF7",
      iconBg: "#FFFBEB",
      iconColor: "#B45309",
      chipBg: "#FFF7ED",
      chipText: "#9A3412",
    };
  }
  return {
    border: "#DDD6FE",
    bg: "#FFFFFF",
    iconBg: "#F5F3FF",
    iconColor: "#6B21A8",
    chipBg: "#F5F3FF",
    chipText: "#6B21A8",
  };
}

const dailyActionIcons: Record<PreventionActionTone, LucideIcon> = {
  food: Utensils,
  movement: Dumbbell,
  check: CheckCircle2,
  support: ShieldCheck,
  medicine: Pill,
};

function LogReadingModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [metricType, setMetricType] = useState<MetricType>("hr");
  const [value, setValue] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/vitals", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ metric_type: metricType, value: value.trim(), source: "manual_entry" }),
      });
      if (!response.ok) throw new Error("Failed to save reading");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vitals"] });
      toast({
        title: t("statusVitals.savedTitle", "Reading saved"),
        description: t("statusVitals.savedBody", "Your vitals timeline has been updated."),
      });
      onClose();
    },
    onError: () => {
      toast({
        title: t("statusVitals.saveErrorTitle", "Could not save reading"),
        description: t("statusVitals.saveErrorBody", "Please try again in a moment."),
        variant: "destructive",
      });
    },
  });

  const activeMetric = METRIC_META[metricType];

  return (
    <PurpleModal
      Icon={activeMetric.Icon}
      kicker={t("statusVitals.kicker", "Vitals")}
      title={t("statusVitals.logTitle", "Log a reading")}
      subtitle={t("statusVitals.logSubtitle", "Add a confirmed number from a device or manual check.")}
      titleId="log-reading-title"
      onClose={onClose}
      closeLabel={t("common.close", "Close")}
      panelTestId="log-reading-modal"
      size="narrow"
    >

        <div className="mb-5 grid grid-cols-3 gap-2">
          {(Object.keys(METRIC_META) as MetricType[]).map((key) => {
            const meta = METRIC_META[key];
            const Icon = meta.Icon;
            const active = metricType === key;
            return (
              <PurpleModalOption
                key={key}
                onClick={() => {
                  setMetricType(key);
                  setValue("");
                }}
                selected={active}
                align="center"
                className="min-h-[84px] flex-col gap-2 px-2 py-3 text-[11px]"
                data-testid={`button-metric-select-${key}`}
              >
                <Icon size={18} />
                <span className="font-body text-[11px] font-bold leading-tight">{meta.unit}</span>
              </PurpleModalOption>
            );
          })}
        </div>

        <label className="mb-2 block font-body text-[12px] font-bold uppercase tracking-[0.1em] text-vyva-text-2" htmlFor="vitals-value-input">
          {t(activeMetric.labelKey, activeMetric.fallbackLabel)} ({activeMetric.unit})
        </label>
        <input
          id="vitals-value-input"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={activeMetric.placeholder}
          className="mb-5 w-full rounded-[18px] border-2 border-transparent bg-[#F7F1E9] px-4 py-4 font-body text-[22px] font-bold text-vyva-text-1 outline-none focus:border-[#6B21A8]"
          data-testid="input-vitals-value"
        />
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!value.trim() || mutation.isPending}
          className="vyva-primary-action w-full"
          data-testid="button-save-vital"
        >
          {mutation.isPending ? t("statusVitals.saving", "Saving...") : t("statusVitals.saveReading", "Save reading")}
        </button>
    </PurpleModal>
  );
}

function ScanModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return (
    <div className="fixed inset-0 z-[80] flex justify-center bg-white">
      <section className="flex min-h-screen w-full max-w-[520px] flex-col bg-[#FBF7F2]">
        <div className="flex items-center justify-between border-b border-[#EDE5DB] bg-white px-5 py-4">
          <div>
            <h2 className="font-display text-[22px] italic text-vyva-text-1">
              {t("statusVitals.scanTitle", "Vitals scan")}
            </h2>
            <p className="font-body text-[12px] text-vyva-text-2">
              {t("statusVitals.scanSubtitle", "Camera estimate, not a medical device reading")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7F1E9]"
            aria-label={t("common.close", "Close")}
            data-testid="button-close-scan-modal"
          >
            <X size={18} />
          </button>
        </div>
        <VitalsScan
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/vitals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/reports/vitals/history"] });
            onClose();
          }}
        />
      </section>
    </div>
  );
}

function VitalsCaptureModal({
  mode,
  onClose,
  initialSignal,
}: {
  mode: VitalsCaptureMode;
  onClose: () => void;
  initialSignal?: VitalsSignalKey | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [inputText, setInputText] = useState(initialSignal ? `${publicSignalLabel(initialSignal)} ` : "");
  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<VitalsParsingResult | null>(null);
  const [error, setError] = useState("");

  const proposed = useMemo(() => result?.proposed_readings ?? [], [result?.proposed_readings]);
  const proposedCards = useMemo(() => proposedVitalsReadingCards(proposed), [proposed]);
  const title =
    mode === "voice"
      ? t("statusVitals.capture.voiceTitle", "Say a reading")
      : mode === "photo"
        ? t("statusVitals.capture.photoTitle", "Scan a device screen")
        : t("statusVitals.capture.textTitle", "Type a reading");
  const subtitle =
    mode === "voice"
      ? t("statusVitals.capture.voiceSubtitle", "Say something like: blood pressure 128 over 76, oxygen 97, sugar 142.")
      : mode === "photo"
        ? t("statusVitals.capture.photoSubtitle", "Take or upload a clear photo of the number on your device.")
        : t("statusVitals.capture.textSubtitle", "Use natural words. VYVA will pull out the numbers for you to confirm.");

  const parseText = useCallback(async () => {
    if (!inputText.trim()) return;
    setIsParsing(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/parse-text", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ text: inputText.trim(), capture_method: "manual", source: "manual_entry" }),
      });
      if (!response.ok) throw new Error("parse failed");
      setResult(await response.json() as VitalsParsingResult);
    } catch {
      setError(t("statusVitals.capture.parseError", "I could not read that yet. Try a simpler phrase or type the number."));
    } finally {
      setIsParsing(false);
    }
  }, [inputText, t]);

  const sendAudio = useCallback(async (blob: Blob) => {
    setIsParsing(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/parse-audio", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      if (!response.ok) throw new Error("audio parse failed");
      setResult(await response.json() as VitalsParsingResult);
    } catch {
      setError(t("statusVitals.capture.voiceError", "I could not read the voice note. You can type it instead."));
    } finally {
      setIsParsing(false);
    }
  }, [t]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(t("statusVitals.capture.voiceUnsupported", "Voice capture is not available on this browser."));
      return;
    }
    setError("");
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = supportedVitalsAudioType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size > 0) void sendAudio(blob);
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      setError(t("statusVitals.capture.voicePermission", "Microphone access is needed to say a reading."));
    }
  }, [sendAudio, t]);

  const parsePhoto = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setError("");
    try {
      const image = await fileToDataUrl(file);
      const response = await apiFetch("/api/vitals-engine/scan-device-photo", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ image }),
      });
      if (!response.ok) throw new Error("photo parse failed");
      setResult(await response.json() as VitalsParsingResult);
    } catch {
      setError(t("statusVitals.capture.photoError", "I could not read that photo. Try a clearer image or type the number."));
    } finally {
      setIsParsing(false);
    }
  }, [t]);

  const saveReadings = useCallback(async () => {
    if (!proposed.length) return;
    setIsSaving(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/readings", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          readings: readingsPayloadFromProposed(proposed),
        }),
      });
      if (!response.ok) throw new Error("save failed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/vitals"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/vitals-engine/latest"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/vitals-engine/latest", "hub-prompts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/reports/vitals/history"] }),
      ]);
      window.dispatchEvent(new Event("vyva:vitals-updated"));
      toast({
        title: t("statusVitals.savedTitle", "Reading saved"),
        description: t("statusVitals.savedBody", "Your vitals timeline has been updated."),
      });
      onClose();
    } catch {
      setError(t("statusVitals.saveErrorBody", "Please try again in a moment."));
    } finally {
      setIsSaving(false);
    }
  }, [onClose, proposed, queryClient, t, toast]);

  const CaptureIcon = mode === "voice" ? Mic : mode === "photo" ? Camera : Keyboard;

  return (
    <PurpleModal
      Icon={CaptureIcon}
      kicker={t("statusVitals.kicker", "Vitals")}
      title={title}
      subtitle={subtitle}
      titleId="vitals-capture-title"
      onClose={onClose}
      closeLabel={t("common.close", "Close")}
      modalTestId="vitals-capture-modal"
      size="default"
    >

        {mode === "text" && (
          <div className="grid gap-3">
            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder={t("statusVitals.capture.textPlaceholder", "BP 128/76, oxygen 97, sugar 142...")}
              className="min-h-[132px] rounded-[22px] border border-[#DDD6FE] bg-[#FAF9F6] px-4 py-4 font-body text-[18px] font-bold leading-snug text-vyva-text-1 outline-none focus:border-[#7C3AED]"
              data-testid="textarea-vitals-reading"
            />
            <button
              type="button"
              onClick={parseText}
              disabled={!inputText.trim() || isParsing}
              className="vyva-primary-action min-h-[58px] text-[17px] disabled:opacity-60"
              data-testid="button-parse-vitals-text"
            >
              {isParsing ? <Loader2 size={18} className="animate-spin" /> : <Keyboard size={18} />}
              {isParsing ? t("statusVitals.capture.reading", "Reading...") : t("statusVitals.capture.findReadings", "Find readings")}
            </button>
          </div>
        )}

        {mode === "voice" && (
          <div className="grid gap-3">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isParsing}
              className={`flex min-h-[96px] items-center justify-center gap-3 rounded-[24px] px-5 font-body text-[20px] font-black text-white shadow-[0_12px_26px_rgba(107,33,168,0.24)] ${isRecording ? "bg-[#BE123C]" : "bg-[#6B21A8]"}`}
              data-testid="button-vitals-voice-record"
            >
              {isParsing ? <Loader2 size={22} className="animate-spin" /> : <Mic size={24} />}
              {isParsing
                ? t("statusVitals.capture.reading", "Reading...")
                : isRecording
                  ? t("statusVitals.capture.stopRecording", "Stop")
                  : t("statusVitals.capture.startRecording", "Record reading")}
            </button>
            <p className="rounded-[18px] border border-[#EDE5DB] bg-[#FAF9F6] px-4 py-3 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
              {t("statusVitals.capture.voiceHint", "VYVA only uses this voice note to extract the numbers you confirm here.")}
            </p>
          </div>
        )}

        {mode === "photo" && (
          <div className="grid gap-3">
            <label className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-[#BDA7FF] bg-[#F5F3FF] px-5 text-center font-body text-[17px] font-black text-[#6B21A8]">
              {isParsing ? <Loader2 size={24} className="animate-spin" /> : <Camera size={26} />}
              {isParsing ? t("statusVitals.capture.reading", "Reading...") : t("statusVitals.capture.choosePhoto", "Take or upload photo")}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={parsePhoto}
                className="hidden"
                data-testid="input-vitals-device-photo"
              />
            </label>
            <p className="rounded-[18px] border border-[#EDE5DB] bg-[#FAF9F6] px-4 py-3 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
              {t("statusVitals.capture.photoHint", "Photos are used to read the device number. Confirm before anything is saved.")}
            </p>
          </div>
        )}

        {result?.transcript && mode !== "text" && (
          <p className="mt-4 rounded-[18px] bg-[#FAF9F6] px-4 py-3 font-body text-[13px] font-semibold text-vyva-text-2">
            {result.transcript}
          </p>
        )}

        {result?.clarification_prompt && (
          <p className="mt-4 rounded-[18px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 font-body text-[14px] font-bold leading-snug text-[#92400E]">
            {result.clarification_prompt}
          </p>
        )}

        {proposed.length > 0 && (
          <div className="mt-5 rounded-[24px] border border-[#EDE5DB] bg-[#FAF9F6] p-4">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.11em] text-vyva-purple">
              {t("statusVitals.capture.confirmTitle", "Confirm before saving")}
            </p>
            <div className="mt-3 grid gap-2">
              {proposedCards.map((reading) => (
                <div key={reading.key} className="flex items-start gap-3 rounded-[18px] bg-white px-4 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]">
                    <Check size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[17px] font-black leading-tight text-vyva-text-1">
                      {reading.display}
                    </p>
                    <p className="mt-1 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
                      {reading.explanation} {reading.confidence === "medium" ? t("statusVitals.confidence.medium", "Medium") : reading.confidence}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={saveReadings}
              disabled={isSaving}
              className="vyva-primary-action mt-4 min-h-[60px] w-full text-[18px] disabled:opacity-60"
              data-testid="button-confirm-vitals-readings"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {isSaving ? t("statusVitals.saving", "Saving...") : t("statusVitals.capture.saveConfirmed", "Save confirmed readings")}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-[18px] bg-[#FEF2F2] px-4 py-3 font-body text-[14px] font-bold text-[#B91C1C]">
            {error}
          </p>
        )}
    </PurpleModal>
  );
}

function BluetoothDeviceModal({
  device,
  onClose,
  onFallback,
}: {
  device: VitalsDeviceCatalogItem;
  onClose: () => void;
  onFallback: (mode: VitalsCaptureMode, signal?: VitalsSignalKey) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [state, setState] = useState<BluetoothCaptureState>(isWebBluetoothSupported() ? "supported" : "unsupported");
  const [result, setResult] = useState<VitalsParsingResult | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const proposed = useMemo(() => result?.proposed_readings ?? [], [result?.proposed_readings]);
  const proposedCards = useMemo(() => proposedVitalsReadingCards(proposed), [proposed]);
  const Icon = DEVICE_ICON_BY_ID[device.id];
  const primarySignal = device.fallbackSignals[0];

  const stateCopy: Record<BluetoothCaptureState, string> = {
    supported: t("statusVitals.bluetooth.supported", "Ready to search nearby Bluetooth devices."),
    unsupported: t("statusVitals.bluetooth.unsupported", "Bluetooth is not available in this browser. You can scan, say, or type the reading instead."),
    searching: t("statusVitals.bluetooth.searching", "Searching for your device..."),
    connected: t("statusVitals.bluetooth.connected", "Connected. Keep the device nearby."),
    waiting: t("statusVitals.bluetooth.waiting", "Waiting for the measurement..."),
    reading_found: t("statusVitals.bluetooth.readingFound", "Reading found."),
    needs_confirmation: t("statusVitals.bluetooth.confirm", "Please confirm before saving."),
    failed: t("statusVitals.bluetooth.failed", "Could not read this device. Use scan, voice, or type instead."),
  };

  const startBluetooth = useCallback(async () => {
    setError("");
    setResult(null);
    try {
      const readResult = await readStandardBluetoothDevice(device, setState);
      setResult({
        proposed_readings: readResult.readings,
        needs_confirmation: true,
        clarification_prompt: t("statusVitals.bluetooth.confirmPrompt", "Confirm these Bluetooth readings before VYVA saves them."),
        transcript: readResult.deviceName,
      });
    } catch (err) {
      setState(isWebBluetoothSupported() ? "failed" : "unsupported");
      setError(err instanceof Error ? err.message : t("statusVitals.bluetooth.failed", "Could not read this device."));
    }
  }, [device, t]);

  const saveReadings = useCallback(async () => {
    if (!proposed.length) return;
    setIsSaving(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/readings", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ readings: readingsPayloadFromProposed(proposed) }),
      });
      if (!response.ok) throw new Error("save failed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/vitals"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/vitals-engine/latest"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/vitals-engine/latest", "hub-prompts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/reports/vitals/history"] }),
      ]);
      window.dispatchEvent(new Event("vyva:vitals-updated"));
      toast({
        title: t("statusVitals.savedTitle", "Reading saved"),
        description: t("statusVitals.bluetooth.saved", "Bluetooth reading added to your vitals."),
      });
      onClose();
    } catch {
      setError(t("statusVitals.saveErrorBody", "Please try again in a moment."));
    } finally {
      setIsSaving(false);
    }
  }, [onClose, proposed, queryClient, t, toast]);

  const fallback = (mode: VitalsCaptureMode) => {
    onClose();
    onFallback(mode, mode === "photo" ? undefined : primarySignal);
  };

  return (
    <PurpleModal
      Icon={Icon}
      kicker={t("statusVitals.bluetooth.title", "Bluetooth device")}
      title={device.label}
      subtitle={device.helper}
      titleId="bluetooth-device-title"
      onClose={onClose}
      closeLabel={t("common.close", "Close")}
      panelTestId="bluetooth-device-modal"
      size="wide"
    >

        <div className="rounded-[24px] border border-[#EDE5DB] bg-[#FAF9F6] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#6B21A8]">
              {state === "searching" || state === "waiting" ? <Loader2 size={18} className="animate-spin" /> : <Bluetooth size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.11em] text-vyva-purple">
                {t("statusVitals.bluetooth.title", "Bluetooth device")}
              </p>
              <p className="mt-1 font-body text-[15px] font-bold leading-snug text-vyva-text-1" data-testid={`bluetooth-state-${state}`}>
                {stateCopy[state]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={startBluetooth}
            disabled={state === "searching" || state === "waiting" || state === "connected"}
            className="vyva-primary-action mt-4 min-h-[58px] w-full text-[17px] disabled:opacity-60"
            data-testid="button-start-bluetooth"
          >
            {state === "searching" || state === "waiting" ? <Loader2 size={18} className="animate-spin" /> : <Bluetooth size={18} />}
            {t("statusVitals.bluetooth.try", "Try Bluetooth")}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <PurpleModalOption
            onClick={() => fallback("photo")}
            align="center"
            className="min-h-[64px] flex-col gap-1 px-2 text-[12px]"
            data-testid="button-bluetooth-fallback-photo"
          >
            <Camera size={17} />
            {t("statusVitals.capture.photoShort", "Scan")}
          </PurpleModalOption>
          <PurpleModalOption
            onClick={() => fallback("voice")}
            align="center"
            className="min-h-[64px] flex-col gap-1 px-2 text-[12px]"
            data-testid="button-bluetooth-fallback-voice"
          >
            <Mic size={17} />
            {t("statusVitals.capture.voiceShort", "Say")}
          </PurpleModalOption>
          <PurpleModalOption
            onClick={() => fallback("text")}
            align="center"
            className="min-h-[64px] flex-col gap-1 px-2 text-[12px]"
            data-testid="button-bluetooth-fallback-type"
          >
            <Keyboard size={17} />
            {t("statusVitals.capture.typeShort", "Type")}
          </PurpleModalOption>
        </div>

        {result?.clarification_prompt && (
          <p className="mt-4 rounded-[18px] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3 font-body text-[14px] font-bold leading-snug text-[#6B21A8]">
            {result.clarification_prompt}
          </p>
        )}

        {proposed.length > 0 && (
          <div className="mt-5 rounded-[24px] border border-[#EDE5DB] bg-[#FAF9F6] p-4">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.11em] text-vyva-purple">
              {t("statusVitals.capture.confirmTitle", "Confirm before saving")}
            </p>
            <div className="mt-3 grid gap-2">
              {proposedCards.map((reading) => (
                <div key={reading.key} className="flex items-start gap-3 rounded-[18px] bg-white px-4 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]">
                    <Check size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[17px] font-black leading-tight text-vyva-text-1">{reading.display}</p>
                    <p className="mt-1 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
                      {reading.explanation} {t("statusVitals.confidence.high", "High")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={saveReadings}
              disabled={isSaving}
              className="vyva-primary-action mt-4 min-h-[60px] w-full text-[18px] disabled:opacity-60"
              data-testid="button-confirm-bluetooth-readings"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {isSaving ? t("statusVitals.saving", "Saving...") : t("statusVitals.capture.saveConfirmed", "Save confirmed readings")}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-[18px] bg-[#FEF2F2] px-4 py-3 font-body text-[14px] font-bold text-[#B91C1C]">
            {error}
          </p>
        )}
    </PurpleModal>
  );
}

function FaceScanModal({
  onClose,
  onLocalScan,
}: {
  onClose: () => void;
  onLocalScan: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "camera" | "scanning" | "reading" | "needs_confirmation" | "not_configured" | "failed">("idle");
  const [result, setResult] = useState<VitalsParsingResult | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const proposed = useMemo(() => result?.proposed_readings ?? [], [result?.proposed_readings]);
  const proposedCards = useMemo(() => proposedVitalsReadingCards(proposed), [proposed]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startScan = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("failed");
      setError(t("statusVitals.faceScan.unsupported", "Camera access is not available on this browser."));
      return;
    }

    setError("");
    setResult(null);
    try {
      setStatus("camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current || !canvasRef.current) throw new Error("Camera preview is not ready.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStatus("scanning");
      const payload = await captureVitalLensPayload(videoRef.current, canvasRef.current);
      stream.getTracks().forEach((track) => track.stop());
      setStatus("reading");
      const response = await apiFetch("/api/vitals-engine/face-scan", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("face scan failed");
      const parsed = await response.json() as VitalsParsingResult;
      setResult(parsed);
      if (parsed.proposed_readings.length > 0) {
        setStatus("needs_confirmation");
      } else {
        setStatus("not_configured");
      }
    } catch (err) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setStatus("failed");
      setError(err instanceof Error ? err.message : t("statusVitals.faceScan.failed", "Face scan did not complete."));
    }
  }, [t]);

  const saveReadings = useCallback(async () => {
    if (!proposed.length) return;
    setIsSaving(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/readings", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ readings: readingsPayloadFromProposed(proposed) }),
      });
      if (!response.ok) throw new Error("save failed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/vitals"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/vitals-engine/latest"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/vitals-engine/latest", "hub-prompts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/reports/vitals/history"] }),
      ]);
      window.dispatchEvent(new Event("vyva:vitals-updated"));
      toast({
        title: t("statusVitals.savedTitle", "Reading saved"),
        description: t("statusVitals.faceScan.saved", "Face scan estimate added to your vitals."),
      });
      onClose();
    } catch {
      setError(t("statusVitals.saveErrorBody", "Please try again in a moment."));
    } finally {
      setIsSaving(false);
    }
  }, [onClose, proposed, queryClient, t, toast]);

  const useLocalScan = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    onClose();
    onLocalScan();
  };

  const statusText = {
    idle: t("statusVitals.faceScan.idle", "Use your front camera for heart rate, breathing, and HRV estimates."),
    camera: t("statusVitals.faceScan.camera", "Opening camera..."),
    scanning: t("statusVitals.faceScan.scanning", "Hold still while VYVA captures a short face scan."),
    reading: t("statusVitals.faceScan.reading", "Reading estimates securely..."),
    needs_confirmation: t("statusVitals.faceScan.confirm", "Confirm before saving."),
    not_configured: result?.clarification_prompt ?? t("statusVitals.faceScan.notConfigured", "VitalLens is not configured yet. You can use the local phone estimate instead."),
    failed: t("statusVitals.faceScan.failed", "Face scan did not complete."),
  }[status];

  return (
    <PurpleModal
      Icon={Video}
      kicker={t("statusVitals.faceScan.kicker", "Face scan")}
      title={t("statusVitals.faceScan.title", "Face scan")}
      subtitle={t("statusVitals.faceScan.subtitle", "Camera estimates are for wellness trends and always need confirmation.")}
      titleId="face-scan-title"
      onClose={onClose}
      closeLabel={t("common.close", "Close")}
      panelTestId="face-scan-modal"
      size="wide"
    >

        <div className="overflow-hidden rounded-[26px] border border-[#EDE5DB] bg-[#151026]">
          <video ref={videoRef} playsInline muted className="h-[260px] w-full object-cover" style={{ transform: "scaleX(-1)" }} />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <p className="mt-4 rounded-[18px] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3 font-body text-[14px] font-bold leading-snug text-[#6B21A8]" data-testid={`face-scan-status-${status}`}>
          {statusText}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={startScan}
            disabled={status === "camera" || status === "scanning" || status === "reading"}
            className="vyva-primary-action min-h-[60px] text-[17px] disabled:opacity-60"
            data-testid="button-start-face-scan"
          >
            {status === "camera" || status === "scanning" || status === "reading" ? <Loader2 size={18} className="animate-spin" /> : <Video size={18} />}
            {t("statusVitals.faceScan.start", "Start face scan")}
          </button>
          <button
            type="button"
            onClick={useLocalScan}
            className="vyva-secondary-action min-h-[60px] rounded-full text-[17px]"
            data-testid="button-use-local-phone-scan"
          >
            <ScanLine size={18} />
            {t("statusVitals.faceScan.local", "Phone estimate")}
          </button>
        </div>

        {proposed.length > 0 && (
          <div className="mt-5 rounded-[24px] border border-[#EDE5DB] bg-[#FAF9F6] p-4">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.11em] text-vyva-purple">
              {t("statusVitals.capture.confirmTitle", "Confirm before saving")}
            </p>
            <div className="mt-3 grid gap-2">
              {proposedCards.map((reading) => (
                <div key={reading.key} className="flex items-start gap-3 rounded-[18px] bg-white px-4 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]">
                    <Check size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[17px] font-black leading-tight text-vyva-text-1">{reading.display}</p>
                    <p className="mt-1 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
                      {reading.explanation} {reading.confidence === "medium" ? t("statusVitals.confidence.medium", "Medium") : reading.confidence}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={saveReadings}
              disabled={isSaving}
              className="vyva-primary-action mt-4 min-h-[60px] w-full text-[18px] disabled:opacity-60"
              data-testid="button-confirm-face-scan-readings"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {isSaving ? t("statusVitals.saving", "Saving...") : t("statusVitals.capture.saveConfirmed", "Save confirmed readings")}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-[18px] bg-[#FEF2F2] px-4 py-3 font-body text-[14px] font-bold text-[#B91C1C]">
            {error}
          </p>
        )}
    </PurpleModal>
  );
}

function AddReadingSheet({
  selectedSignal,
  onClose,
  onCapture,
  onFaceScan,
  onConnectDevice,
}: {
  selectedSignal: VitalsSignalKey | null;
  onClose: () => void;
  onCapture: (mode: VitalsCaptureMode, signal?: VitalsSignalKey) => void;
  onFaceScan: () => void;
  onConnectDevice: () => void;
}) {
  const { t } = useTranslation();
  const signalLabel = selectedSignal ? publicSignalLabel(selectedSignal) : null;
  const compatibleMethods = selectedSignal ? compatibleCaptureMethods(selectedSignal) : null;
  const allows = (method: "phone_camera" | "web_bluetooth" | "device_photo" | "voice" | "manual") => !compatibleMethods || compatibleMethods.includes(method);
  const captureWithSignal = (mode: VitalsCaptureMode) => {
    onClose();
    onCapture(mode, selectedSignal ?? undefined);
  };

  return (
    <PurpleModal
      Icon={Activity}
      kicker={t("statusVitals.kicker", "Vitals")}
      title={t("statusVitals.addSheet.title", "Add a reading")}
      subtitle={
        signalLabel
          ? t("statusVitals.addSheet.signalSubtitle", { defaultValue: "Choose how to add {{label}}.", label: signalLabel })
          : t("statusVitals.addSheet.subtitle", "Choose the easiest way. VYVA saves only after you confirm.")
      }
      titleId="add-reading-sheet-title"
      onClose={onClose}
      closeLabel={t("common.close", "Close")}
      panelTestId="add-reading-sheet"
      size="default"
    >

        <div className="grid gap-3">
          {allows("phone_camera") ? <PurpleModalOption
            onClick={() => {
              onClose();
              onFaceScan();
            }}
            className="min-h-[70px] gap-4 p-4"
            data-testid="button-open-face-scan"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
              <Video size={22} />
            </span>
            <span className="min-w-0">
              <span className="block font-body text-[17px] font-black leading-tight">{t("statusVitals.faceScan.action", "Face scan")}</span>
              <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">{t("statusVitals.faceScan.actionHint", "Heart, breathing, HRV")}</span>
            </span>
          </PurpleModalOption> : null}

          {allows("web_bluetooth") ? <PurpleModalOption
            onClick={onConnectDevice}
            className="min-h-[66px] gap-4 p-4"
            data-testid="button-open-bluetooth-device"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F5F3FF] text-vyva-purple">
              <Bluetooth size={21} />
            </span>
            <span className="min-w-0">
              <span className="block font-body text-[15px] font-black leading-tight text-vyva-text-1">{t("settings.healthDevices.title", "Health devices")}</span>
              <span className="mt-0.5 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">{t("settings.healthDevices.addSheetHint", "Set up Bluetooth devices in Settings")}</span>
            </span>
          </PurpleModalOption> : null}

          <div className="grid gap-3 sm:grid-cols-3">
            {allows("voice") ? <PurpleModalOption
              onClick={() => captureWithSignal("voice")}
              align="center"
              className="min-h-[62px] gap-2 px-3 text-[14px]"
              data-testid="button-vitals-say-reading"
            >
              <Mic size={17} />
              {t("statusVitals.hub.say", "Say reading")}
            </PurpleModalOption> : null}
            {allows("device_photo") ? <PurpleModalOption
              onClick={() => captureWithSignal("photo")}
              align="center"
              className="min-h-[62px] gap-2 px-3 text-[14px]"
              data-testid="button-vitals-snap-reading"
            >
              <Camera size={17} />
              {t("statusVitals.hub.snapShort", "Scan")}
            </PurpleModalOption> : null}
            {allows("manual") ? <PurpleModalOption
              onClick={() => captureWithSignal("text")}
              align="center"
              className="min-h-[62px] gap-2 px-3 text-[14px]"
              data-testid="button-log-reading"
            >
              <Keyboard size={17} />
              {t("statusVitals.logAction", "Type reading")}
            </PurpleModalOption> : null}
          </div>
        </div>
    </PurpleModal>
  );
}

function ConnectDeviceSheet({
  onClose,
  onSelectDevice,
  onCapture,
}: {
  onClose: () => void;
  onSelectDevice: (device: VitalsDeviceCatalogItem) => void;
  onCapture: (mode: VitalsCaptureMode, signal?: VitalsSignalKey) => void;
}) {
  const { t } = useTranslation();

  const captureFallback = (mode: VitalsCaptureMode, signal?: VitalsSignalKey) => {
    onClose();
    onCapture(mode, signal);
  };

  return (
    <PurpleModal
      Icon={Bluetooth}
      kicker={t("settings.healthDevices.kicker", "Health devices")}
      title={t("statusVitals.devices.sheetTitle", "Connect device")}
      subtitle={t("statusVitals.devices.sheetBody", "Try Bluetooth, or scan, say, or type the same reading.")}
      titleId="connect-device-sheet-title"
      onClose={onClose}
      closeLabel={t("common.close", "Close")}
      panelTestId="connect-health-devices"
      size="wide"
    >

        <div className="grid gap-2">
          {VITALS_DEVICE_CATALOG.map((device) => {
            const Icon = DEVICE_ICON_BY_ID[device.id];
            return (
              <article
                key={device.id}
                className="rounded-[20px] border border-[#D8B4FE] bg-white p-3 shadow-[0_8px_18px_rgba(107,33,168,0.06)]"
                data-testid={`device-card-${device.id}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px]" style={{ color: device.accent, background: device.bg }}>
                    <Icon size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[15px] font-black leading-tight text-vyva-text-1">{device.label}</p>
                    <p className="mt-1 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">{device.helper}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {device.signals.map((signal) => (
                        <span key={signal} className="rounded-full border border-[#D8B4FE] bg-[#F5F3FF] px-2 py-0.5 font-body text-[10px] font-black text-vyva-purple">
                          {publicSignalLabel(signal)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectDevice(device);
                    }}
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-[14px] bg-vyva-purple font-body text-[12px] font-black text-white shadow-[0_7px_14px_rgba(107,33,168,0.12)] active:scale-[0.98]"
                    data-testid={`button-device-bluetooth-${device.id}`}
                  >
                    <Bluetooth size={14} />
                    {t("statusVitals.bluetooth.tryShort", "Bluetooth")}
                  </button>
                  <button
                    type="button"
                    onClick={() => captureFallback("photo")}
                    className="flex min-h-[40px] items-center justify-center gap-1 rounded-[14px] border border-[#D8B4FE] bg-white font-body text-[12px] font-black text-vyva-purple"
                    data-testid={`button-device-photo-${device.id}`}
                  >
                    <Camera size={13} />
                    {t("statusVitals.capture.photoShort", "Scan")}
                  </button>
                  <button
                    type="button"
                    onClick={() => captureFallback("voice", device.fallbackSignals[0])}
                    className="flex min-h-[40px] items-center justify-center gap-1 rounded-[14px] border border-[#D8B4FE] bg-white font-body text-[12px] font-black text-vyva-purple"
                    data-testid={`button-device-voice-${device.id}`}
                  >
                    <Mic size={13} />
                    {t("statusVitals.capture.voiceShort", "Say")}
                  </button>
                  <button
                    type="button"
                    onClick={() => captureFallback("text", device.fallbackSignals[0])}
                    className="flex min-h-[40px] items-center justify-center gap-1 rounded-[14px] border border-[#D8B4FE] bg-white font-body text-[12px] font-black text-vyva-purple"
                    data-testid={`button-device-type-${device.id}`}
                  >
                    <Keyboard size={13} />
                    {t("statusVitals.capture.typeShort", "Type")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
    </PurpleModal>
  );
}

function AgeWellScoreRing({ score }: { score: AgeWellScore }) {
  const degrees = Math.max(0, Math.min(100, score.value)) * 3.6;

  return (
    <div
      className="relative flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center rounded-full p-1.5 shadow-[0_16px_34px_rgba(107,33,168,0.12)] sm:h-[148px] sm:w-[148px] sm:p-2"
      style={{ background: `conic-gradient(#6B21A8 ${degrees}deg, #EFE7FF 0deg)` }}
      aria-label={`AgeWell Score ${score.value}, ${score.label}`}
      data-testid="agewell-score-ring"
    >
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white">
        <span className="font-body text-[30px] font-black leading-none text-vyva-text-1 sm:text-[48px]" data-testid="agewell-score-value">
          {score.value}
        </span>
        <span className="mt-1 rounded-full bg-[#F5F3FF] px-2.5 py-0.5 font-body text-[11px] font-black text-[#6B21A8] sm:px-3 sm:py-1 sm:text-[12px]">
          {score.label}
        </span>
      </div>
    </div>
  );
}

function AgeWellSignalRowCard({ row }: { row: AgeWellSignalRow }) {
  const Icon = row.Icon;
  const content = (
    <>
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] sm:h-11 sm:w-11 sm:rounded-[16px]" style={{ background: row.soft, color: row.accent }}>
        <Icon size={19} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[12px] font-black leading-tight text-vyva-text-2 sm:text-[14px]">{row.label}</span>
        <span className="mt-0.5 block font-body text-[14px] font-black leading-tight text-vyva-text-1 sm:text-[17px]">{row.value}</span>
        <span className="mt-1 hidden font-body text-[13px] font-semibold leading-snug text-vyva-text-2 sm:block">{row.detail}</span>
      </span>
      {row.onClick ? <ArrowRight size={18} className="flex-shrink-0 text-vyva-text-3" aria-hidden="true" /> : null}
    </>
  );

  if (row.onClick) {
    return (
      <button
        type="button"
        onClick={row.onClick}
        className="vyva-tap flex min-h-[82px] w-full items-center gap-2 rounded-[18px] border border-[#EFE5DC] bg-white px-2.5 py-2 text-left transition hover:border-[#D8B4FE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B21A8] sm:min-h-[76px] sm:gap-3 sm:rounded-[20px] sm:px-4 sm:py-3"
        data-testid={`agewell-signal-${row.id}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className="flex min-h-[82px] w-full items-center gap-2 rounded-[18px] border border-[#EFE5DC] bg-white px-2.5 py-2 sm:min-h-[76px] sm:gap-3 sm:rounded-[20px] sm:px-4 sm:py-3"
      data-testid={`agewell-signal-${row.id}`}
    >
      {content}
    </div>
  );
}

function AgeWellMissionStepCard({
  step,
  feedback,
  onOpen,
  onFeedback,
}: {
  step: AgeWellMissionStep;
  feedback?: AgeWellFeedback;
  onOpen: () => void;
  onFeedback: (feedback: AgeWellFeedback) => void;
}) {
  const action = step.action;
  const style = dailyActionToneStyle(action.tone);
  const Icon = step.Icon;
  const feedbackLabel = feedback === "done" ? "Done" : feedback === "too_hard" ? "Too hard" : feedback === "not_today" ? "Not today" : null;

  return (
    <article className="rounded-[20px] border border-[#EFE5DC] bg-white p-2.5 shadow-[0_10px_22px_rgba(63,45,35,0.05)] sm:p-3" data-testid={`agewell-step-${step.id}`}>
      <div className="flex items-start gap-2.5">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px]" style={{ background: step.soft, color: step.accent }}>
          <Icon size={19} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full px-2 py-0.5 font-body text-[10px] font-black uppercase tracking-[0.04em] sm:text-[11px]" style={{ background: step.soft, color: step.accent }}>
              {step.number}. {step.label}
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 font-body text-[10px] font-black sm:text-[11px]" style={{ color: style.iconColor }}>
              {action.evidenceLabel}
            </span>
            <button
              type="button"
              onClick={onOpen}
              className="vyva-tap inline-flex min-h-[28px] items-center justify-center gap-1 rounded-full bg-[#FBFAF7] px-2.5 font-body text-[11px] font-black shadow-[0_5px_12px_rgba(31,41,55,0.04)]"
              style={{ color: step.accent }}
              data-testid={`button-agewell-open-${action.id}`}
            >
              {actionRouteLabel(action)}
              <ArrowRight size={12} aria-hidden="true" />
            </button>
            {feedbackLabel ? (
              <span className="rounded-full bg-white px-2 py-0.5 font-body text-[10px] font-black text-vyva-text-2 sm:text-[11px]" data-testid={`agewell-feedback-${action.id}`}>
                {feedbackLabel}
              </span>
            ) : null}
          </div>
          <h3 className="mt-1.5 font-body text-[18px] font-black leading-tight text-vyva-text-1 sm:text-[20px]">
            {action.title}
          </h3>
          <p className="mt-0.5 font-body text-[13px] font-bold leading-snug text-vyva-text-2 sm:text-[14px]">
            {step.detail}
          </p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => onFeedback("done")}
          className="vyva-tap flex min-h-[36px] items-center justify-center gap-1 rounded-full bg-white px-2 font-body text-[12px] font-black text-[#047857] shadow-[0_5px_12px_rgba(31,41,55,0.05)] sm:text-[13px]"
          data-testid={`button-agewell-feedback-${action.id}-done`}
        >
          <Check size={14} aria-hidden="true" />
          Done
        </button>
        <button
          type="button"
          onClick={() => onFeedback("too_hard")}
          className="vyva-tap flex min-h-[36px] items-center justify-center gap-1 rounded-full bg-white px-2 font-body text-[12px] font-black text-[#6B21A8] shadow-[0_5px_12px_rgba(31,41,55,0.05)] sm:text-[13px]"
          data-testid={`button-agewell-feedback-${action.id}-too_hard`}
        >
          <X size={14} aria-hidden="true" />
          Hard
        </button>
        <button
          type="button"
          onClick={() => onFeedback("not_today")}
          className="vyva-tap flex min-h-[36px] items-center justify-center rounded-full bg-[#F7F3ED] px-2 font-body text-[12px] font-black text-vyva-text-2 shadow-[0_5px_12px_rgba(31,41,55,0.04)] sm:text-[13px]"
          data-testid={`button-agewell-feedback-${action.id}-not_today`}
        >
          Skip
        </button>
      </div>
    </article>
  );
}

const SignosScreen = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language: appLanguage } = useLanguage();
  const { toast } = useToast();
  const { profile } = useProfile();
  const [showScanModal, setShowScanModal] = useState(false);
  const [showFaceScanModal, setShowFaceScanModal] = useState(false);
  const [showAddReadingSheet, setShowAddReadingSheet] = useState(false);
  const [selectedSuggestedSignal, setSelectedSuggestedSignal] = useState<VitalsSignalKey | null>(null);
  const [bluetoothDevice, setBluetoothDevice] = useState<VitalsDeviceCatalogItem | null>(null);
  const [captureMode, setCaptureMode] = useState<VitalsCaptureMode | null>(null);
  const [captureSignal, setCaptureSignal] = useState<VitalsSignalKey | null>(null);
  const [ageWellFeedback, setAgeWellFeedback] = useState<Record<string, AgeWellFeedback>>({});
  const [lastLoopFeedback, setLastLoopFeedback] = useState<PreventionLoopLastFeedback | null>(null);
  const [lastLoopView, setLastLoopView] = useState<PreventionLoopLastView | null>(null);
  const [requestLearning] = useState(() => learningContextForPreventionRequest());

  const { data: vitalsData } = useQuery<VitalsResponse>({
    queryKey: ["/api/vitals"],
    retry: false,
  });
  const { data: preventionData, isError: preventionError } = useQuery<PreventionFocusResponse>({
    queryKey: ["/api/health/prevention", requestLearning.clientHour, requestLearning.recentFeedback.length, requestLearning.recentFeedback[0]?.savedAt],
    retry: false,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const res = await apiFetch(`/api/health/prevention?learning=${encodePreventionLearningQuery(requestLearning)}`);
      if (!res.ok) throw new Error("Could not load prevention focus");
      return res.json();
    },
  });

  const summary = vitalsData?.summary;
  const hasPrevention = Boolean(preventionData?.focus && !preventionError);
  const preventionFocus = hasPrevention ? preventionData : ageWellFallbackFocus;
  const currentDateKey = preventionDateKey(preventionFocus.generatedAt);
  const feedbackStorageKey = preventionFeedbackStorageKey(preventionFocus.focus, currentDateKey);
  const ageWellScore = useMemo(() => calculateAgeWellScore({
    summary,
    focus: preventionFocus,
    hasPrevention,
  }), [hasPrevention, preventionFocus, summary]);
  const baseLongevityMoves = useMemo(() => selectLongevityMoves(preventionFocus.dailyActions, preventionFocus.focus), [preventionFocus.dailyActions, preventionFocus.focus]);
  const longevityMoves = useMemo(() => adaptAgeWellMovesForLoop({
    actions: baseLongevityMoves,
    feedback: ageWellFeedback,
    lastFeedback: lastLoopFeedback,
    lastView: lastLoopView,
    currentDate: currentDateKey,
  }), [ageWellFeedback, baseLongevityMoves, currentDateKey, lastLoopFeedback, lastLoopView]);
  const loopInsight = useMemo(() => ageWellLoopInsight({
    focus: preventionFocus,
    feedback: ageWellFeedback,
    lastFeedback: lastLoopFeedback,
    lastView: lastLoopView,
    currentDate: currentDateKey,
    hasRecentLearning: requestLearning.recentFeedback.length > 0,
  }), [ageWellFeedback, currentDateKey, lastLoopFeedback, lastLoopView, preventionFocus, requestLearning.recentFeedback.length]);

  const openCapture = useCallback((mode: VitalsCaptureMode, signal?: VitalsSignalKey) => {
    setShowAddReadingSheet(false);
    setCaptureSignal(signal ?? null);
    setCaptureMode(mode);
  }, []);
  const openAddReadingSheet = useCallback((signal?: VitalsSignalKey | null) => {
    setSelectedSuggestedSignal(signal ?? null);
    setShowAddReadingSheet(true);
  }, []);

  useEffect(() => {
    const stored = readStoredJson<StoredAgeWellFeedback>(feedbackStorageKey);
    setAgeWellFeedback(stored ?? {});

    const previousFeedback = readStoredJson<PreventionLoopLastFeedback>(PREVENTION_LOOP_LAST_FEEDBACK_KEY);
    const previousView = readStoredJson<PreventionLoopLastView>(PREVENTION_LOOP_LAST_VIEW_KEY);
    setLastLoopFeedback(previousFeedback?.focus === preventionFocus.focus ? previousFeedback : null);
    setLastLoopView(previousView?.focus === preventionFocus.focus ? previousView : null);
    writeStoredJson(PREVENTION_LOOP_LAST_VIEW_KEY, {
      focus: preventionFocus.focus,
      date: currentDateKey,
      actionIds: baseLongevityMoves.map((item) => item.id),
      viewedAt: new Date().toISOString(),
    } satisfies PreventionLoopLastView);
  }, [baseLongevityMoves, currentDateKey, feedbackStorageKey, preventionFocus.focus]);

  useEffect(() => {
    if (!baseLongevityMoves.length) return;
    const viewedKey = `vyva-prevention-loop:viewed:${preventionFocus.focus}:${currentDateKey}:agewell`;
    const viewedValue = baseLongevityMoves.map((item) => item.id).join("|");
    if (window.localStorage.getItem(viewedKey) === viewedValue) return;
    appendPreventionLoopHistory(baseLongevityMoves.map((action) => ({
      actionId: action.id,
      title: action.title,
      step: action.step,
      tone: action.tone,
      focus: preventionFocus.focus,
      feedback: "shown",
      date: currentDateKey,
      savedAt: new Date().toISOString(),
    })));
    window.localStorage.setItem(viewedKey, viewedValue);
  }, [baseLongevityMoves, currentDateKey, preventionFocus.focus]);

  const markAgeWellAction = useCallback((action: PreventionDailyAction, feedback: AgeWellFeedback) => {
    const savedAt = new Date().toISOString();
    const loopFeedbackValue = feedback === "not_today" ? "remind" : feedback;
    const loopFeedback = {
      focus: preventionFocus.focus,
      date: currentDateKey,
      actionId: action.id,
      step: action.step,
      tone: action.tone,
      feedback: loopFeedbackValue,
      title: action.title,
      savedAt,
    } satisfies PreventionLoopLastFeedback;

    setAgeWellFeedback((current) => {
      const next = { ...current, [action.id]: feedback };
      writeStoredJson(feedbackStorageKey, next);
      return next;
    });
    writeStoredJson(PREVENTION_LOOP_LAST_FEEDBACK_KEY, loopFeedback);
    appendPreventionLoopHistory([{
      actionId: action.id,
      title: action.title,
      step: action.step,
      tone: action.tone,
      focus: preventionFocus.focus,
      feedback: loopFeedbackValue,
      date: currentDateKey,
      savedAt,
    }]);
    setLastLoopFeedback(loopFeedback);
  }, [currentDateKey, feedbackStorageKey, preventionFocus.focus]);

  const latestReadingAt = useMemo(() => {
    if (!summary) return null;
    const dates = Object.values(summary)
      .map((entry) => entry.latest_recorded_at)
      .filter(Boolean) as string[];
    return dates.sort().reverse()[0] ?? null;
  }, [summary]);
  const latestText = latestReadingAt
    ? formatRecordedAt(latestReadingAt, appLanguage)
    : t("statusVitals.noLatest", "No recent readings");
  const statusSummaryText = useMemo(() => {
    const lines = (["hr", "rr", "bp"] as MetricType[]).map((key) => {
      const meta = METRIC_META[key];
      const value = summary?.[key]?.latest_value;
      return `${t(meta.labelKey, meta.fallbackLabel)}: ${value ? `${value} ${meta.unit}` : t("statusVitals.noReading", "no reading")}`;
    });
    return `${t("statusVitals.shareTitle", "VYVA Status / Vitals")}\n${lines.join("\n")}\n${t("statusVitals.shareUpdated", "Updated")}: ${latestText}`;
  }, [latestText, summary, t]);
  const openTalk = useCallback((context = "Please help me understand my AgeWell plan for today.") => {
    navigate("/health/doctor", {
      state: {
        autoStartVoice: true,
        latestSymptomReport: context,
        source: "agewell_plan",
      },
    });
  }, [navigate]);

  const openGuidanceAction = useCallback((action: PreventionGuidanceAction, contextTitle?: string) => {
    if (action.shoppingPrefill) {
      navigate("/concierge/shopping", {
        state: {
          shoppingPrefill: action.shoppingPrefill,
        },
      });
      return;
    }
    if (action.mode === "voice" || action.route === "/health/doctor") {
      openTalk(`${preventionFocus.focus}: ${contextTitle ?? action.label}. ${action.detail}.`);
      return;
    }
    if (action.route === "/health/vitals") {
      openAddReadingSheet();
      return;
    }
    navigate(action.route || "/health");
  }, [navigate, openAddReadingSheet, openTalk, preventionFocus.focus]);

  const openDailyAction = useCallback((action: PreventionDailyAction) => {
    openGuidanceAction(action.actionSheet.primaryAction, action.title);
  }, [openGuidanceAction]);

  const statusServiceActions = useMemo(() => vitalsStatusServiceActionsFor({
    gpName: profile?.gpName,
    gpPhone: profile?.gpPhone,
    gpEmail: profile?.gpEmail,
    context: statusSummaryText,
    labels: {
      callGp: t("statusVitals.actions.callGp", "Call GP"),
      callGpWithName: t("statusVitals.actions.callGpWithName", "Call {{name}}"),
      emailGp: t("statusVitals.actions.emailGp", "Email GP"),
      doctorHelp: t("statusVitals.actions.doctorHelp", "Doctor help"),
      addDoctor: t("statusVitals.actions.addDoctor", "Add doctor"),
      appointment: t("statusVitals.actions.appointment", "Book appointment"),
      ride: t("statusVitals.actions.ride", "Find transport"),
      appointmentPrefill: t("statusVitals.actions.appointmentPrefill", "Please help me schedule a doctor appointment based on my VYVA vitals. Ask me to confirm before booking."),
      ridePrefill: t("statusVitals.actions.ridePrefill", "Please help me find safe transport options based on my VYVA vitals. Ask me to confirm before booking."),
    },
  }), [profile?.gpEmail, profile?.gpName, profile?.gpPhone, statusSummaryText, t]);
  const doctorHelpAction = statusServiceActions.find((action) => action.kind === "doctor_help");
  const rideAction = statusServiceActions.find((action) => action.kind === "book_ride");
  const guideQuery = `Please guide me through my AgeWell plan. Focus: ${preventionFocus.focus}. ${preventionFocus.why?.[0] ?? preventionFocus.headline}`;
  const ageWellMissionSteps = useMemo(() => buildAgeWellMission({
    actions: longevityMoves,
  }), [longevityMoves]);
  const completedAction = ageWellMissionSteps.map((step) => step.action).find((action) => ageWellFeedback[action.id] === "done") ?? null;
  const isAgeWellComplete = Boolean(completedAction);
  const primaryAgeWellAction = ageWellMissionSteps[0]?.action ?? longevityMoves[0] ?? ageWellFallbackDailyActions[0];
  const heroTitle = isAgeWellComplete
    ? t("statusVitals.plan.doneToday", "Done today")
    : primaryAgeWellAction.title;
  const heroScoreSuffix = ageWellScore.label === "Building"
    ? t("statusVitals.plan.buildingShort", "Building")
    : t("statusVitals.plan.clarityShort", "clarity");
  const heroChips = isAgeWellComplete
    ? [
      t("statusVitals.plan.complete", "Complete"),
      t("statusVitals.plan.logged", "Logged"),
      `${ageWellScore.value} ${heroScoreSuffix}`,
    ]
    : [
      ageWellFocusLabel(preventionFocus.focus),
      ageWellScore.label,
      `${ageWellScore.value} ${heroScoreSuffix}`,
    ];
  const primaryHeroLabel = isAgeWellComplete
    ? t("statusVitals.plan.askVyva", "Ask VYVA")
    : actionRouteLabel(primaryAgeWellAction);
  const primaryHeroAction = isAgeWellComplete
    ? () => openTalk(guideQuery)
    : () => openDailyAction(primaryAgeWellAction);

  const ageWellSignalRows = useMemo<AgeWellSignalRow[]>(() => {
    const missingLabel = t("statusVitals.plan.missing", "Missing");
    const vitalsValues = (["bp", "hr", "rr"] as MetricType[])
      .filter((key) => metricHasValue(summary, key))
      .map((key) => metricDisplay(summary, key, missingLabel));
    const missingVitals = (["bp", "hr", "rr"] as MetricType[])
      .filter((key) => !metricHasValue(summary, key))
      .map((key) => key === "bp" ? "BP" : key === "hr" ? "Pulse" : "Breathing");
    const medicineSignal = findSignal(preventionFocus, "medicine");
    const medicineInsight = findInsight(preventionFocus, /medic|adherence|routine/i);
    const symptomSignal = findSignal(preventionFocus, "symptom");
    const symptomInsight = findInsight(preventionFocus, /symptom|follow/i);
    const contextSignals = [
      ...(preventionFocus.personalizationSummary ?? []),
      ...(preventionFocus.profileSignals ?? []),
    ].filter(Boolean);
    const vitalsMissingTemplate = t("statusVitals.plan.vitalsMissingDetail", "Missing: {{items}}");
    const vitalsReadyTemplate = t("statusVitals.plan.vitalsReadyDetail", "Latest: {{time}}");

    return [
      {
        id: "vitals",
        label: t("statusVitals.plan.vitalsSignal", "Vitals"),
        value: vitalsValues.length ? vitalsValues.join(" · ") : t("statusVitals.plan.noVitalsYet", "No fresh vitals yet"),
        detail: missingVitals.length
          ? vitalsMissingTemplate.replace("{{items}}", missingVitals.join(", "))
          : vitalsReadyTemplate.replace("{{time}}", latestText),
        Icon: Activity,
        accent: "#B45309",
        soft: "#FFF2DC",
        onClick: () => openAddReadingSheet(),
      },
      {
        id: "medicine",
        label: t("statusVitals.plan.medicineSignal", "Medicine"),
        value: medicineInsight?.value || medicineSignal?.label || t("statusVitals.plan.medicineBuilding", "Routine signal"),
        detail: medicineSignal?.detail || medicineInsight?.detail || t("statusVitals.plan.medicineSignalDetail", "VYVA checks dose routine, missed doses, and medicine safety when available."),
        Icon: Pill,
        accent: "#7E22CE",
        soft: "#F5F3FF",
        onClick: () => navigate("/meds"),
      },
      {
        id: "symptoms",
        label: t("statusVitals.plan.symptomsSignal", "Symptoms"),
        value: symptomInsight?.value || symptomSignal?.label || t("statusVitals.plan.symptomsBuilding", "No follow-up flag"),
        detail: symptomSignal?.detail || symptomInsight?.detail || t("statusVitals.plan.symptomsSignalDetail", "Latest symptom reports help VYVA know what changed."),
        Icon: Heart,
        accent: "#BE123C",
        soft: "#FFF1F2",
        onClick: () => navigate("/health/symptom-check"),
      },
      {
        id: "prevention",
        label: t("statusVitals.plan.preventionSignal", "Prevention context"),
        value: preventionFocus.focus,
        detail: contextSignals.length
          ? contextSignals.slice(0, 3).join(" · ")
          : t("statusVitals.plan.preventionSignalDetail", "Using profile, mobility, living context, and recent feedback."),
        Icon: ShieldCheck,
        accent: "#047857",
        soft: "#ECFDF5",
        onClick: () => navigate("/health/prevention"),
      },
    ];
  }, [latestText, navigate, openAddReadingSheet, preventionFocus, summary, t]);

  const runStatusAction = (action?: VitalsStatusServiceAction) => {
    if (!action) return;
    if (action.href) {
      window.location.href = action.href;
      return;
    }
    if (action.to) navigate(action.to, { state: action.state });
  };

  const askCaregiver = async () => {
    // TODO: Replace this placeholder with caregiver messaging once the caregiver request flow is available.
    try {
      await navigator.clipboard.writeText(statusSummaryText);
      toast({ description: t("statusVitals.plan.caregiverCopied", "Health plan summary copied for your caregiver.") });
    } catch {
      toast({ description: t("statusVitals.plan.caregiverTodo", "Caregiver request will be added here soon.") });
    }
  };

  const shareStatus = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("statusVitals.shareTitle", "VYVA Status / Vitals"), text: statusSummaryText });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    await navigator.clipboard.writeText(statusSummaryText);
    toast({ description: t("statusVitals.copied", "Vitals summary copied.") });
  };

  return (
    <HealthWizardShell contentClassName="max-w-[1180px] px-4 pb-40 sm:px-6 lg:px-8">
      <HealthWizardTopBar
        title={t("statusVitals.plan.pageTitle", "Longevity Plan")}
        kicker={t("statusVitals.hub.pageKicker", "Health")}
        onBack={() => navigate("/health")}
        backLabel={t("common.back", "Back")}
        className="mb-2"
        compact
      />

      <section
        className="overflow-hidden rounded-[24px] border border-[#E6D7F7] bg-[#FFFCF7] p-4 shadow-[0_16px_36px_rgba(63,45,35,0.07)] sm:rounded-[30px] sm:p-5"
        data-testid="vitals-guided-hub"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[19px] bg-[#F5F3FF] text-[#6B21A8] sm:h-14 sm:w-14">
              <Target size={24} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="flex flex-wrap items-center gap-1.5"
                aria-label={`AgeWell Score ${ageWellScore.value}, ${ageWellScore.label}`}
                data-testid="agewell-score-ring"
              >
                {heroChips.map((chip, index) => (
                  <span
                    key={`${chip}-${index}`}
                    className="rounded-full border border-[#E9D5FF] bg-white px-2.5 py-1 font-body text-[11px] font-black leading-none text-[#6B21A8]"
                  >
                    {index === 2 ? <span data-testid="agewell-score-value">{ageWellScore.value}</span> : null}
                    {index === 2 ? ` ${heroScoreSuffix}` : chip}
                  </span>
                ))}
              </div>
              <h2 className="mt-2 max-w-[13ch] font-body text-[31px] font-black leading-[0.98] text-vyva-text-1 sm:max-w-none sm:text-[44px]">
                {heroTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => openTalk(guideQuery)}
              className="vyva-tap flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-[#DDD6FE] bg-white text-[#6B21A8] shadow-[0_10px_20px_rgba(107,33,168,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B21A8]"
              data-testid="button-agewell-ask-vyva"
              aria-label={t("statusVitals.plan.askVyva", "Ask VYVA")}
            >
              <Mic size={20} aria-hidden="true" />
            </button>
          </div>
          <div>
            <button
              type="button"
              onClick={primaryHeroAction}
              className="vyva-tap flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#6B21A8] px-5 font-body text-[15px] font-black text-white shadow-[0_12px_24px_rgba(107,33,168,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B21A8] sm:min-h-[54px] sm:text-[16px]"
              data-testid="button-agewell-primary-action"
            >
              {isAgeWellComplete ? <MessageCircle size={19} aria-hidden="true" /> : <ArrowRight size={19} aria-hidden="true" />}
              {primaryHeroLabel}
            </button>
          </div>
        </div>
      </section>

      <HealthWizardCard className="mt-4 p-4 sm:p-5" testId="agewell-longevity-moves">
        <div className="mb-3">
          <h2 className="font-body text-[24px] font-black leading-tight text-vyva-text-1">
            {t("statusVitals.plan.chooseMoveTitle", "Next 3 moves")}
          </h2>
          <p className="sr-only" data-testid="agewell-loop-insight">
            {loopInsight}
          </p>
        </div>
        {isAgeWellComplete ? (
          <div className="mb-3 rounded-[20px] border border-[#BDEAD7] bg-[#F8FFFC] p-3" data-testid="agewell-complete-state">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#E9FBF3] text-[#047857]">
                <CheckCircle2 size={19} aria-hidden="true" />
              </span>
              <div>
                <p className="font-body text-[16px] font-black leading-tight text-vyva-text-1">
                  {t("statusVitals.plan.ageWellDone", "AgeWell done for today")}
                </p>
                <p className="mt-0.5 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                  {t("statusVitals.plan.ageWellDoneCopy", "Tomorrow's plan will use what worked.")}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-3">
          {ageWellMissionSteps.map((step) => (
            <AgeWellMissionStepCard
              key={step.id}
              step={step}
              feedback={ageWellFeedback[step.action.id]}
              onOpen={() => openDailyAction(step.action)}
              onFeedback={(feedback) => markAgeWellAction(step.action, feedback)}
            />
          ))}
        </div>
        {preventionError ? (
          <p className="mt-3 rounded-[16px] bg-[#FFFBEB] px-3 py-2 font-body text-[13px] font-bold text-[#92400E]" data-testid="agewell-fallback-note">
            {t("statusVitals.plan.ageWellFallback", "Using a simple AgeWell plan until your latest prevention signals load.")}
          </p>
        ) : null}
      </HealthWizardCard>

      <HealthWizardCard className="mt-4 p-4 sm:p-5" testId="agewell-signals-section">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-body text-[22px] font-black leading-tight text-vyva-text-1 sm:text-[24px]">
              {t("statusVitals.plan.signalsCheckedTitle", "Signals checked")}
            </h2>
            <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
              {t("statusVitals.plan.signalsCheckedCopy", "The ingredients behind today's AgeWell focus.")}
            </p>
          </div>
          <span className="hidden rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[12px] font-black text-[#6B21A8] sm:inline-flex">
            {ageWellScore.label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {ageWellSignalRows.map((row) => (
            <AgeWellSignalRowCard key={row.id} row={row} />
          ))}
        </div>
      </HealthWizardCard>

      <HealthWizardCard className="mt-4 p-4 sm:p-5" testId="compact-vitals-help">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-[#6B21A8]">
              <ShieldCheck size={20} />
            </span>
            <div className="min-w-0">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#6B21A8]">
                {t("statusVitals.plan.helpKicker", "Support")}
              </p>
              <h2 className="font-body text-[20px] font-black leading-tight text-vyva-text-1">
                {t("statusVitals.plan.helpTitle", "Need help completing your plan?")}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/health/doctor", {
              state: {
                autoStartVoice: true,
                latestSymptomReport: guideQuery,
              },
            })}
            className="vyva-tap flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#6B21A8] px-5 font-body text-[14px] font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B21A8]"
          >
            <MessageCircle size={18} />
            {t("statusVitals.plan.askVyvaGuide", "Ask VYVA to guide me")}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => runStatusAction(doctorHelpAction)}
              className="vyva-tap flex min-h-[52px] items-center justify-center gap-2 rounded-[17px] border border-[#DDD6FE] bg-white px-3 font-body text-[14px] font-black text-[#6B21A8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B21A8]"
              data-testid="button-status-doctor-help"
            >
              <Stethoscope size={18} />
              {t("statusVitals.actions.doctorHelp", "Doctor help")}
            </button>
            <button
              type="button"
              onClick={() => runStatusAction(rideAction)}
              className="vyva-tap flex min-h-[52px] items-center justify-center gap-2 rounded-[17px] border border-[#BFDBFE] bg-[#EFF6FF] px-3 font-body text-[14px] font-black text-[#1D4ED8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
              data-testid="button-status-book-ride"
            >
              <Car size={18} />
              {t("statusVitals.actions.ride", "Find transport")}
            </button>
            <button
              type="button"
              onClick={askCaregiver}
              className="vyva-tap flex min-h-[52px] items-center justify-center gap-2 rounded-[17px] border border-[#BBF7D0] bg-[#ECFDF5] px-3 font-body text-[14px] font-black text-[#047857] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]"
            >
              <Users size={18} />
              {t("statusVitals.plan.askCaregiver", "Ask caregiver")}
            </button>
        </div>
        <button
          type="button"
          onClick={shareStatus}
          className="vyva-tap mt-3 flex min-h-[42px] items-center justify-center rounded-full border border-[#EDE5DB] bg-white px-4 font-body text-[13px] font-black text-vyva-text-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B21A8]"
          data-testid="button-share-care-team"
        >
          {t("statusVitals.copySummary", "Copy summary")}
        </button>
      </HealthWizardCard>

      <section className="mt-5 rounded-[22px] border border-[#FED7AA] bg-[#FFFBEB] p-4">
        <div className="flex items-start gap-3">
          <ClipboardList size={18} className="mt-0.5 flex-shrink-0" style={{ color: "#B45309" }} />
          <p className="font-body text-[12px] leading-relaxed" style={{ color: "#92400E" }}>
            {t("statusVitals.plan.disclaimer", "VYVA's health plan is informational and does not replace medical care. If symptoms are severe, sudden, or worrying, contact emergency services.")}
          </p>
        </div>
      </section>

      {showAddReadingSheet && (
        <AddReadingSheet
          selectedSignal={selectedSuggestedSignal}
          onClose={() => setShowAddReadingSheet(false)}
          onCapture={openCapture}
          onFaceScan={() => setShowFaceScanModal(true)}
          onConnectDevice={() => {
            setShowAddReadingSheet(false);
            navigate("/settings/health-devices");
          }}
        />
      )}
      {showScanModal && <ScanModal onClose={() => setShowScanModal(false)} />}
      {showFaceScanModal && (
        <FaceScanModal
          onClose={() => setShowFaceScanModal(false)}
          onLocalScan={() => setShowScanModal(true)}
        />
      )}
      {bluetoothDevice && (
        <BluetoothDeviceModal
          device={bluetoothDevice}
          onClose={() => setBluetoothDevice(null)}
          onFallback={openCapture}
        />
      )}
      {captureMode && (
        <VitalsCaptureModal
          mode={captureMode}
          initialSignal={captureSignal}
          onClose={() => {
            setCaptureMode(null);
            setCaptureSignal(null);
          }}
        />
      )}
    </HealthWizardShell>
  );
};

export default SignosScreen;
