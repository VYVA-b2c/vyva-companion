import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { NavigateOptions } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, ALargeSmall, Brain, Camera, Heart, Users, ConciergeBell, Stethoscope, Calendar, Car, PhoneCall, Mail, Pill, ShieldCheck, MessageCircle, MessageCircleHeart, FileText, HeartHandshake, HeartPulse, ChevronRight, ChevronDown, ChevronUp, PackageCheck, History, Headphones, Puzzle, Zap, Share2, Footprints, Hand, Home, Mic, Moon, Sun, UserRound, X, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import MedicationRefillAlertCard, { type MedicationRefillAlertResponse } from "@/features/medications/MedicationRefillAlertCard";
import VoiceHero from "@/components/VoiceHero";
import MasterDashboardLayout, {
  type MasterDashboardCard,
  type MasterFastHelpAction,
} from "@/components/MasterDashboardLayout";
import VyvaSessionCta from "@/components/VyvaSessionCta";
import { HomeMasterActionControl, HomeMasterProfileControl, HomeMasterTopbar } from "@/components/HomeMasterTopControls";
import CrossPillarSubflowCanvas, {
  isCrossPillarCompletionAction,
  type CrossPillarSubflowResult,
} from "@/components/voice-canvas/CrossPillarSubflowCanvas";
import { useScreenPresentation } from "@/design/screenPresentation";
import { ActionCard, ResponsiveGrid } from "@/components/vyva-ui";
import { useProfile } from "@/contexts/ProfileContext";
import { SECTION_VOICE_AUTO_START_KEY } from "@/hooks/useRouteVoiceAutoStart";
import { serviceForPath, useServiceGate } from "@/hooks/useServiceGate";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useReadableTextSize } from "@/hooks/useReadableTextSize";
import { useOptionalVyvaVoice } from "@/hooks/useVyvaVoice";
import { useHeroMessage } from "@/hooks/useHeroMessage";
import { useLanguage } from "@/i18n";
import { LONGEVITY_FOCUS_API_ROUTE, LONGEVITY_ROUTE } from "@/lib/homeNavPrototypeRoutes";
import { displayFirstName } from "@/lib/displayIdentity";
import { hasSeenVoiceOrbHint } from "@/lib/voiceOrbHint";
import {
  decideHomeContextMessage,
  homeContextActionForVoiceReply,
  readHomeContextMessageActionHistory,
  readHomeContextMessageHistory,
  readHomeContextMessageOutcomeHistory,
  HOME_CONTEXT_MESSAGE_DISPLAY_MS,
  writeHomeContextMessageAction,
  writeHomeContextMessageOutcome,
  writeHomeContextMessageSeen,
  type HomeContextMessage,
  type HomeContextMessageOutcome,
} from "@/lib/homeContextMessages";
import { adaptHeroMessageForHome } from "@/lib/homeAdminMessages";
import {
  normalizeHeroLanguage,
  recordHeroEvent,
  recordHeroImpression,
  type HeroReason,
} from "@/lib/heroMessages";
import type { WelcomeProfileCompletionSnapshot } from "../../shared/welcomeModule";
import {
  VYVA_HOME_MODE_CONTROL_ACTION_EVENT,
  publishHomeModeControl,
  type HomeInteractionMode,
  type HomeModeControlActionDetail,
  type HomeModeControlDetail,
} from "@/lib/homeModeControl";
import {
  VYVA_VOICE_APP_ACTION_RESULT_EVENT,
  VYVA_VOICE_HOME_INTENT_EVENT,
  VYVA_VOICE_HOME_SUBFLOW_EVENT,
  VYVA_VOICE_USER_MESSAGE_EVENT,
  type VoiceAppActionResult,
  type VoiceHomeIntent,
  type VoiceHomeSubflow,
  isVoiceHomeIntent,
  isVoiceHomeSubflow,
  transitionForVoiceHomeIntent,
  type VoiceUserMessageDetail,
} from "@/lib/voiceNavigation";
import {
  HOME_FAST_HELP_REASON_FALLBACKS,
  homeFastHelpHistoryStorageKey,
  rankContextualHomeFastHelp,
  readHomeFastHelpHistory,
  recordHomeFastHelpUse,
  writeHomeFastHelpHistory,
  type ContextualHomeFastHelpActionId,
  type HomeFastHelpActivity,
} from "@/lib/contextualHomeFastHelp";
import {
  HOME_FAST_HELP_JOURNEY_EVENT,
  HOME_FAST_HELP_RECOVERY_REFERENCE_ID,
  abandonOpenedHomeFastHelpJourneys,
  homeFastHelpActivityFromJourneys,
  homeFastHelpContextForJourney,
  homeFastHelpJourneyStorageKey,
  latestBlockedHomeFastHelpJourney,
  markHomeFastHelpJourney,
  readHomeFastHelpJourneys,
  reconcileHomeFastHelpJourneys,
  resumeHomeFastHelpJourney,
  selectHomeFastHelpRecoveryNudge,
  startHomeFastHelpJourney,
  withHomeFastHelpContextState,
  type HomeFastHelpJourney,
} from "@/lib/homeFastHelpOutcome";
import { recordHomeFastHelpImpression } from "@/lib/homeFastHelpInsights";
import { selectHomeResumeCandidate } from "@/lib/homeResumeOrchestrator";
import { conciergeTaskPath } from "@/lib/conciergeTaskNavigation";
import { executeCrossPillarHandoff } from "@/lib/crossPillarHandoffExecution";
import type {
  CrossPillarToolEvidence,
  CrossPillarToolFamily,
} from "../../shared/crossPillarToolReadiness";
import {
  readShowVyvaReviewHistory,
  SHOW_VYVA_REVIEW_HISTORY_EVENT,
  type ShowVyvaReviewHistoryItem,
} from "@/lib/showVyvaReviewHistory";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";
import {
  conciergeCanvasExplainability,
  conciergeCanvasStateLabel,
  deriveConciergeCanvasState,
  type ConciergeCanvasStateSummary,
} from "../../shared/conciergeCanvasState";
import { buildConciergeConfirmationReceipt } from "../../shared/conciergeConfirmationReceipt";
import type { ConciergeExecutionTask } from "../../shared/conciergeActionExecution";
import { HOME_FAST_HELP_RANKING_VERSION } from "../../shared/homeFastHelpSync";
import {
  isShowVyvaPreparedTask,
  showVyvaResumeActionLabel,
  showVyvaResumeSourceLabel,
  showVyvaResumeSummary,
} from "../../shared/showVyvaResume";

type HomeAgentCard = {
  id: "health" | "cognitive" | "social" | "concierge";
  icon: LucideIcon;
  path: string;
  theme: "pink" | "purple" | "blue" | "green";
};

type WeatherData = {
  city: string;
  temperature: number;
  description: string;
};

type MedicationHomeSignal = {
  todaySummary?: {
    scheduled: number;
    remaining: number;
  };
  nextDose?: {
    name?: string | null;
    minutesUntil?: number | null;
  };
};

type PreventionHomeSignal = {
  focus?: "Heart" | "Falls" | "Diabetes" | "Medicine" | "Follow-up" | "Plan";
};

type LatestVitalsHomeSignal = {
  analysis?: {
    safety_status?: string | null;
    recommended_action?: string | null;
  } | null;
  latest_alert?: {
    severity?: string | null;
  } | null;
};

type DailyCheckinHomeSignal = {
  status?: "completed" | "upcoming" | "due_now" | "overdue" | "not_scheduled";
};

type BrainCoachHomeSignal = {
  summary?: {
    completedSessions?: number;
    streakDays?: number;
  };
  today?: {
    completedCount?: number;
  };
};

type ParticipationPulseHomeSignal = {
  pulse?: {
    featuredEvent?: {
      id?: string;
      title?: string;
      startsAt?: string;
      location?: string;
      format?: "nearby" | "online" | "hybrid" | string;
    } | null;
    savedEvents?: unknown[];
    notifications?: Array<{
      id?: string;
      title?: string;
      body?: string;
      eventId?: string;
      readAt?: string | null;
    }>;
    emptyProfileNudge?: {
      title?: string;
      body?: string;
      actionLabel?: string;
      path?: string;
    } | null;
  };
};

type ScheduledEventsHomeSignal = {
  events?: Array<{
    id?: string;
    event_type?: string;
    title?: string;
    description?: string | null;
    scheduled_for?: string;
    status?: string;
    metadata?: Record<string, unknown> | null;
  }>;
};

type ConciergePendingHomeSignal = {
  items?: ConciergePendingHomeItem[];
};

type ConciergeCompletedHomeSignal = {
  items?: ConciergeCompletedHomeItem[];
};

type ConciergePendingHomeItem = {
  id?: string | null;
  use_case?: string | null;
  provider_name?: string | null;
  action_summary?: string | null;
  status?: "pending" | "calling" | "completed" | "failed" | "cancelled" | string | null;
  action_payload?: Record<string, unknown> | null;
  confirmed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  task_path?: string | null;
};

type ConciergeCompletedHomeItem = {
  id?: string | null;
  pending_id?: string | null;
  use_case?: string | null;
  provider_name?: string | null;
  outcome?: string | null;
  outcome_payload?: Record<string, unknown> | null;
  outcome_summary?: string | null;
  completed_at?: string | null;
};

type HomeFastAction = {
  id: "callGp" | "emailGp" | "doctor" | "appointment" | "ride";
  icon: LucideIcon;
  tone: "call" | "email" | "doctor" | "appointment" | "ride";
  label: string;
  sub: string;
  mobileLabel?: string;
  mobileSub?: string;
  href?: string;
};

type HomeIntentLayer = "home" | VoiceHomeIntent;

const HOME_INTENT_LAYER_STORAGE_KEY = "vyva:home-intent-layer:v1";
const HOME_SUBFLOW_STORAGE_KEY = "vyva:home-subflow:v1";

function readHomeIntentLayer(): HomeIntentLayer {
  try {
    const stored = sessionStorage.getItem(HOME_INTENT_LAYER_STORAGE_KEY);
    return isVoiceHomeIntent(stored) ? stored : "home";
  } catch {
    return "home";
  }
}

function writeHomeIntentLayer(layer: HomeIntentLayer) {
  try {
    if (layer === "home") sessionStorage.removeItem(HOME_INTENT_LAYER_STORAGE_KEY);
    else sessionStorage.setItem(HOME_INTENT_LAYER_STORAGE_KEY, layer);
  } catch {
    return;
  }
}

function readHomeSubflow(): VoiceHomeSubflow | null {
  try {
    const stored = sessionStorage.getItem(HOME_SUBFLOW_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as unknown;
    return isVoiceHomeSubflow(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeHomeSubflow(subflow: VoiceHomeSubflow | null) {
  try {
    if (subflow) sessionStorage.setItem(HOME_SUBFLOW_STORAGE_KEY, JSON.stringify(subflow));
    else sessionStorage.removeItem(HOME_SUBFLOW_STORAGE_KEY);
  } catch {
    return;
  }
}

const COORDS_WEATHER_CACHE_KEY = "vyva_coords_weather_cache";
const COORDS_WEATHER_TTL_MS = 30 * 60 * 1000;

function readCoordsWeatherCache(): WeatherData | null {
  try {
    const raw = localStorage.getItem(COORDS_WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: WeatherData; ts: number };
    if (Date.now() - parsed.ts > COORDS_WEATHER_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCoordsWeatherCache(data: WeatherData) {
  try {
    localStorage.setItem(COORDS_WEATHER_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    return;
  }
}

function sanitizePhoneHref(phone?: string | null) {
  const raw = phone?.trim();
  if (!raw) return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  return `tel:${normalized || raw}`;
}

function homeDoctorMailto(email: string | undefined | null, subject: string, body: string) {
  const raw = email?.trim();
  if (!raw) return "";
  return `mailto:${raw}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const HOME_AGENT_CARDS: HomeAgentCard[] = [
  { id: "health", icon: Heart, path: "/health", theme: "pink" },
  { id: "cognitive", icon: Brain, path: "/mind-memory", theme: "purple" },
  { id: "social", icon: Users, path: "/social-rooms", theme: "blue" },
  { id: "concierge", icon: ConciergeBell, path: "/concierge", theme: "green" },
];

const HOME_FAST_ACTIONS: Array<Pick<HomeFastAction, "id" | "icon" | "tone">> = [
  { id: "doctor", icon: Stethoscope, tone: "doctor" },
  { id: "appointment", icon: Calendar, tone: "appointment" },
  { id: "ride", icon: Car, tone: "ride" },
];

const HOME_AGENT_MOBILE_COPY: Record<HomeAgentCard["id"], { title: string; subtitle: string }> = {
  health: { title: "My Health", subtitle: "Check-ins, vitals, medicines" },
  cognitive: { title: "Brain Power", subtitle: "Memory, focus, calm" },
  social: { title: "Community", subtitle: "Rooms and support" },
  concierge: { title: "Concierge", subtitle: "Everyday help" },
};

const HOME_FAST_ACTION_MOBILE_COPY: Record<"doctor" | "appointment" | "ride", { label: string; sub: string }> = {
  doctor: { label: "Doctor help", sub: "Talk through a concern" },
  appointment: { label: "Appointment", sub: "Prepare a request" },
  ride: { label: "Find transport", sub: "Compare safe options" },
};

const HOME_FAST_HELP_VISIBLE_COUNT = 3;

const SECTION_VOICE_AUTO_START_OPTIONS: NavigateOptions = {
  state: { [SECTION_VOICE_AUTO_START_KEY]: true },
};

type HomeTranslate = (key: string, fallback: string, values?: Record<string, string | number>) => string;

function baseLanguageCode(language?: string | null) {
  const code = language?.split("-")[0]?.toLowerCase();
  if (code === "es" || code === "de") return code;
  return "en";
}

function conciergeHomeItems(pending: ConciergePendingHomeSignal | null | undefined) {
  return pending?.items?.filter((item) => item?.id && item.status !== "completed" && item.status !== "cancelled") ?? [];
}

function conciergeHomeStatus(item: ConciergePendingHomeItem) {
  return (item.status ?? "").toLowerCase();
}

function conciergeTaskKind(useCase: string | null | undefined, payload: Record<string, unknown> | null | undefined) {
  if (payload?.task_type === "provider_shortlist") return "providerShortlist";
  const appointmentType = typeof payload?.appointment_type === "string"
    ? payload.appointment_type
    : "";
  if (appointmentType === "home-service") return "homeService";
  switch (useCase) {
    case "book_ride":
      return "ride";
    case "book_appointment":
      return "appointment";
    case "order_medicine":
      return "pharmacy";
    case "home_service":
      return "homeService";
    case "find_provider":
      return "provider";
    case "admin_task":
    case "paperwork":
      return "admin";
    case "scam_check":
      return "safety";
    default:
      return "default";
  }
}

function conciergeHomeTaskKind(item: ConciergePendingHomeItem) {
  return conciergeTaskKind(item.use_case, item.action_payload);
}

function conciergeCompletedHomeTaskKind(item: ConciergeCompletedHomeItem) {
  return conciergeTaskKind(item.use_case, item.outcome_payload);
}

function contextualFastHelpActionForConciergeKind(
  kind: ReturnType<typeof conciergeTaskKind>,
): ContextualHomeFastHelpActionId | null {
  switch (kind) {
    case "ride":
      return "book-ride";
    case "appointment":
    case "homeService":
    case "pharmacy":
    case "provider":
    case "providerShortlist":
      return "find-care";
    case "admin":
      return "paperwork-help";
    case "safety":
      return "safe-home";
    default:
      return null;
  }
}

function contextualFastHelpRemoteActivity(
  completed: ConciergeCompletedHomeSignal | null | undefined,
): HomeFastHelpActivity[] {
  return completed?.items?.flatMap((item) => {
    const actionId = contextualFastHelpActionForConciergeKind(conciergeCompletedHomeTaskKind(item));
    const occurredAt = item.completed_at?.trim();
    if (!actionId || !occurredAt || Number.isNaN(new Date(occurredAt).getTime())) return [];
    const outcome = item.outcome?.toLowerCase() ?? "";
    const status = outcome.includes("dismiss") || outcome.includes("cancel") || outcome.includes("declin")
      ? "dismissed" as const
      : outcome.includes("fail") || outcome.includes("unavailable") || outcome.includes("error")
        ? "blocked" as const
        : "completed" as const;
    return [{ actionId, status, occurredAt }];
  }) ?? [];
}

function conciergeHomeTaskLabel(item: ConciergePendingHomeItem, t: HomeTranslate) {
  switch (conciergeHomeTaskKind(item)) {
    case "ride":
      return t("home.conciergeResume.task.ride", "ride");
    case "appointment":
      return t("home.conciergeResume.task.appointment", "appointment");
    case "pharmacy":
      return t("home.conciergeResume.task.pharmacy", "pharmacy request");
    case "homeService":
      return t("home.conciergeResume.task.homeService", "home service");
    case "provider":
      return t("home.conciergeResume.task.provider", "provider search");
    case "providerShortlist":
      return t("home.conciergeResume.task.providerShortlist", "saved options");
    case "admin":
      return t("home.conciergeResume.task.admin", "admin task");
    case "safety":
      return t("home.conciergeResume.task.safety", "safety check");
    default:
      return t("home.conciergeResume.task.default", "request");
  }
}

function conciergeHomeProviderLabel(item: ConciergePendingHomeItem, t: HomeTranslate) {
  return item.provider_name?.trim()
    || conciergeHomePayloadString(item, ["provider_name", "pharmacy_name"])
    || t("home.conciergeResume.providerFallback", "provider");
}

function conciergeCompletedHomeTaskLabel(item: ConciergeCompletedHomeItem, t: HomeTranslate) {
  switch (conciergeCompletedHomeTaskKind(item)) {
    case "ride":
      return t("home.conciergeResume.task.ride", "ride");
    case "appointment":
      return t("home.conciergeResume.task.appointment", "appointment");
    case "pharmacy":
      return t("home.conciergeResume.task.pharmacy", "pharmacy request");
    case "homeService":
      return t("home.conciergeResume.task.homeService", "home service");
    case "provider":
      return t("home.conciergeResume.task.provider", "provider search");
    case "admin":
      return t("home.conciergeResume.task.admin", "admin task");
    case "safety":
      return t("home.conciergeResume.task.safety", "safety check");
    default:
      return t("home.conciergeResume.task.default", "request");
  }
}

function conciergeHomePayloadString(item: ConciergePendingHomeItem, keys: string[]) {
  const payload = item.action_payload;
  if (!payload) return "";
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function conciergeHomeExecutionTask(item: ConciergePendingHomeItem): Partial<ConciergeExecutionTask> | null {
  const task = item.action_payload?.execution_task;
  return task && typeof task === "object" && !Array.isArray(task)
    ? task as Partial<ConciergeExecutionTask>
    : null;
}

function conciergeHomePayloadBoolean(item: ConciergePendingHomeItem, keys: string[]) {
  const payload = item.action_payload;
  if (!payload) return false;
  return keys.some((key) => payload[key] === true);
}

function conciergeHomeHasMissingDetails(item: ConciergePendingHomeItem) {
  const task = conciergeHomeExecutionTask(item);
  const missingRequirements = Array.isArray(task?.missing_requirements)
    ? task.missing_requirements
    : [];
  const missingDetails = item.action_payload?.missingDetails ?? item.action_payload?.missing_details;
  return missingRequirements.length > 0
    || (Array.isArray(missingDetails) && missingDetails.length > 0);
}

function conciergeHomeCanvasState(item: ConciergePendingHomeItem): ConciergeCanvasStateSummary {
  const executionTask = conciergeHomeExecutionTask(item);
  const hasMissingDetails = conciergeHomeHasMissingDetails(item);
  const requiresConfirmation = conciergeHomePayloadBoolean(item, [
    "confirmation_required_before_action",
    "no_external_action_without_confirmation",
  ]);
  const status = conciergeHomeStatus(item);

  return deriveConciergeCanvasState({
    status,
    useCase: item.use_case,
    flowReference: executionTask?.flow_reference
      ?? conciergeHomePayloadString(item, ["flow_reference"]),
    actionType: executionTask?.action_type
      ?? conciergeHomePayloadString(item, ["action_type", "task_type"]),
    executionTask,
    hasMissingDetails,
    hasReviewSummary: !hasMissingDetails,
    reviewPresented: status === "pending" && !hasMissingDetails && (requiresConfirmation || Boolean(executionTask)),
    waitingForProvider: conciergeHomeIsWaitingOnProvider(item),
    missionStatus: conciergeHomePayloadString(item, ["mission_status", "status", "current_step"]),
  });
}

function conciergeCompletedPayloadString(item: ConciergeCompletedHomeItem, keys: string[]) {
  const payload = item.outcome_payload;
  if (!payload) return "";
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function conciergeCompletedHomeItems(completed: ConciergeCompletedHomeSignal | null | undefined) {
  return completed?.items?.filter((item) => {
    if (!item?.id || !item.use_case) return false;
    if (item.outcome !== "completed" && !item.completed_at) return false;
    return conciergeCompletedHomeTaskKind(item) !== "default";
  }) ?? [];
}

function conciergeCompletedHomeProvider(item: ConciergeCompletedHomeItem, t: HomeTranslate) {
  return item.provider_name?.trim()
    || conciergeCompletedPayloadString(item, ["provider_name", "pharmacy_name"])
    || t("home.conciergeReuse.providerFallback", "VYVA");
}

function conciergeCompletedHomeTemplate(item: ConciergeCompletedHomeItem) {
  return {
    id: item.id ?? "home-completed-template",
    pending_id: item.pending_id ?? null,
    use_case: item.use_case ?? "concierge_task",
    provider_name: item.provider_name ?? null,
    outcome: item.outcome ?? "completed",
    outcome_summary: item.outcome_summary ?? null,
    completed_at: item.completed_at ?? null,
    outcome_payload: item.outcome_payload ?? {},
  };
}

function conciergeHomeIsWaitingOnProvider(item: ConciergePendingHomeItem) {
  const missionStatus = conciergeHomePayloadString(item, ["mission_status", "status", "current_step"]).toLowerCase();
  const liveHandoffStatus = conciergeHomePayloadString(item, ["live_handoff_status", "provider_follow_up_status"]).toLowerCase();
  const status = conciergeHomeStatus(item);
  return status === "calling"
    || status === "in_progress"
    || missionStatus.includes("awaiting_provider")
    || liveHandoffStatus === "waiting"
    || liveHandoffStatus === "sent_or_called";
}

function conciergeHomeWaitingLabel(
  item: ConciergePendingHomeItem,
  nowMs: number,
  language: string,
  t: HomeTranslate,
) {
  const raw = conciergeHomePayloadString(item, [
    "provider_waiting_since",
    "waiting_since",
    "provider_last_contact_at",
    "contacted_at",
  ]) || item.confirmed_at || "";
  const waitingSince = raw ? new Date(raw) : null;
  if (!waitingSince || Number.isNaN(waitingSince.getTime())) {
    return t("home.conciergeResume.step.waiting", "Waiting for reply");
  }

  const elapsedMinutes = Math.max(0, Math.floor((nowMs - waitingSince.getTime()) / 60_000));
  if (elapsedMinutes < 1) return t("home.conciergeResume.waitingNow", "Sent just now");
  if (elapsedMinutes < 60) {
    return t("home.conciergeResume.waitingMinutes", "{{count}} min waiting", { count: elapsedMinutes });
  }
  if (elapsedMinutes < 24 * 60) {
    const hours = Math.floor(elapsedMinutes / 60);
    return t("home.conciergeResume.waitingHours", "{{count}} hr waiting", { count: hours });
  }

  const time = new Intl.DateTimeFormat(language || "en", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(waitingSince);
  return t("home.conciergeResume.waitingSince", "Waiting since {{time}}", { time });
}

function conciergeHomeStepLabel(item: ConciergePendingHomeItem, t: HomeTranslate, isSpanish = false) {
  if (conciergeHomeTaskKind(item) === "providerShortlist") return t("home.conciergeResume.step.providerShortlist", "Review saved options");
  if (isShowVyvaPreparedTask(item.action_payload)) {
    return t("home.showVyvaResume.step", "Review first");
  }
  return conciergeCanvasStateLabel(conciergeHomeCanvasState(item).state, isSpanish);
}

function conciergeHomeKickerLabel(item: ConciergePendingHomeItem, t: HomeTranslate, isSpanish = false) {
  if (conciergeHomeTaskKind(item) === "providerShortlist") return t("home.conciergeResume.kickerProviderShortlist", "Saved shortlist");
  if (isShowVyvaPreparedTask(item.action_payload)) return t("home.showVyvaResume.kicker", "VYVA prepared this");
  return conciergeCanvasStateLabel(conciergeHomeCanvasState(item).state, isSpanish);
}

function conciergeHomeTitlePrefix(item: ConciergePendingHomeItem, t: HomeTranslate) {
  if (conciergeHomeTaskKind(item) === "providerShortlist") return t("home.conciergeResume.titleProviderShortlistPrefix", "Review your");
  const state = conciergeHomeCanvasState(item).state;
  if (state === "collecting") return t("home.conciergeResume.titleCollectPrefix", "Add detail for your");
  if (state === "ready_to_review") return t("home.conciergeResume.titleReviewPrefix", "Review your");
  if (state === "awaiting_confirmation") return t("home.conciergeResume.titleConfirmPrefix", "Confirm your");
  if (state === "failed") return t("home.conciergeResume.titleTryAgainPrefix", "Try another way for your");
  return t("home.conciergeResume.titlePrefix", "VYVA is working on your");
}

function conciergeCompletedCanvasLabel(isSpanish: boolean) {
  return conciergeCanvasStateLabel("completed", isSpanish);
}

const HOME_AGENT_THEMES: Record<HomeAgentCard["theme"], {
  iconBg: string;
  iconColor: string;
  glow: string;
}> = {
  pink: {
    iconBg: "linear-gradient(135deg, #FFE7E7 0%, #FFF7F2 100%)",
    iconColor: "#E74C43",
    glow: "rgba(231,76,67,0.12)",
  },
  purple: {
    iconBg: "linear-gradient(135deg, #ECE4FF 0%, #F8F2FF 100%)",
    iconColor: "#7C3AED",
    glow: "rgba(124,58,237,0.13)",
  },
  blue: {
    iconBg: "linear-gradient(135deg, #E6F0FF 0%, #F3F8FF 100%)",
    iconColor: "#2F66D0",
    glow: "rgba(47,102,208,0.12)",
  },
  green: {
    iconBg: "linear-gradient(135deg, #DDF8EA 0%, #F1FBF5 100%)",
    iconColor: "#149A63",
    glow: "rgba(20,154,99,0.12)",
  },
};

const HOME_FAST_ACTION_THEMES: Record<HomeFastAction["tone"], {
  iconBg: string;
  iconColor: string;
  border: string;
  shadow: string;
}> = {
  call: {
    iconBg: "#ECFDF5",
    iconColor: "#047857",
    border: "#BBF7D0",
    shadow: "rgba(4,120,87,0.10)",
  },
  email: {
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    border: "#BFDBFE",
    shadow: "rgba(37,99,235,0.10)",
  },
  doctor: {
    iconBg: "#EEF6FF",
    iconColor: "#2563EB",
    border: "#BFDBFE",
    shadow: "rgba(37,99,235,0.10)",
  },
  appointment: {
    iconBg: "#F5F3FF",
    iconColor: "#6B21A8",
    border: "#D8B4FE",
    shadow: "rgba(107,33,168,0.11)",
  },
  ride: {
    iconBg: "#ECFDF5",
    iconColor: "#047857",
    border: "#BBF7D0",
    shadow: "rgba(4,120,87,0.10)",
  },
};

type HomeScreenProps = {
  menuPath?: string;
  onShellNavigate?: (path: string, options?: NavigateOptions) => void;
};

const HomeScreen = ({ menuPath = "/menu", onShellNavigate }: HomeScreenProps = {}) => {
  const { guardPath, readiness, canUseService } = useServiceGate();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data: heroHomeState } = useQuery<{
    audience: "elder";
    snapshot: WelcomeProfileCompletionSnapshot;
  }>({
    queryKey: ["/api/hero-messages/home-state"],
    staleTime: 60 * 1000,
    retry: false,
  });
  const { isDark: isHomeMasterDark, toggleTheme } = useHomeMasterTheme();
  const { isLarge: isReadableTextLarge, toggleSize: toggleReadableTextSize } = useReadableTextSize();
  const voice = useOptionalVyvaVoice();
  const { firstName: profileFirstName, profile } = useProfile();
  const activeFastHelpImpressionIdRef = useRef<string | null>(null);
  const fastHelpImpressionIdsByFingerprintRef = useRef(new Map<string, string>());
  const [fastHelpStartIndex, setFastHelpStartIndex] = useState(0);
  const [conciergeClockMs, setConciergeClockMs] = useState(() => Date.now());
  const homeFastHelpHistoryKey = homeFastHelpHistoryStorageKey(profile?.profileId);
  const homeFastHelpJourneyKey = homeFastHelpJourneyStorageKey(profile?.profileId);
  const [homeFastHelpHistory, setHomeFastHelpHistory] = useState<HomeFastHelpActivity[]>(() => (
    readHomeFastHelpHistory(homeFastHelpHistoryKey)
  ));
  const [homeFastHelpJourneys, setHomeFastHelpJourneys] = useState<HomeFastHelpJourney[]>(() => (
    readHomeFastHelpJourneys(homeFastHelpJourneyKey)
  ));
  const [showVyvaReviewHistory, setShowVyvaReviewHistory] = useState<ShowVyvaReviewHistoryItem[]>(() => (
    readShowVyvaReviewHistory()
  ));
  const [homeIntentLayer, setHomeIntentLayer] = useState<HomeIntentLayer>(readHomeIntentLayer);
  const [homeSubflow, setHomeSubflow] = useState<VoiceHomeSubflow | null>(readHomeSubflow);
  const [homeProfileMenuOpen, setHomeProfileMenuOpen] = useState(false);
  const [homeInteractionMode, setHomeInteractionMode] = useState<"voice" | "touch">(() => {
    try {
      return localStorage.getItem("vyva:home-interaction-mode:v1") === "touch" ? "touch" : "voice";
    } catch {
      return "voice";
    }
  });
  const isTopLevelHome = homeIntentLayer === "home";
  const homePresentation = useScreenPresentation({
    screenId: "home",
    mode: homeInteractionMode,
    primarySurface: isTopLevelHome ? "orb" : undefined,
    cards: isTopLevelHome ? "hidden" : undefined,
  });
  const showHomeMasterHero = homePresentation.primarySurface === "orb";
  const showHomeMasterCards = !isTopLevelHome && homeInteractionMode === "touch" && homePresentation.cards === "visible";
  const [homeModeSwitcherVisible, setHomeModeSwitcherVisible] = useState(true);
  const [showVoiceOrbFirstUseHint, setShowVoiceOrbFirstUseHint] = useState(
    () => !hasSeenVoiceOrbHint(),
  );
  const [conciergeReceiptDetailsOpen, setConciergeReceiptDetailsOpen] = useState(false);
  const [homeContextHistoryRevision, setHomeContextHistoryRevision] = useState(0);
  const activeVoiceHomeContextFingerprintRef = useRef<string | null>(null);
  const stableHomeContextMessageIdRef = useRef<string | null>(null);
  const voiceEngagedMessageIdRef = useRef<string | null>(null);
  const shownHomeContextMessageIdRef = useRef<string | null>(null);
  const lastVoiceHomeIntentRef = useRef<{ intent: VoiceHomeIntent; at: number } | null>(null);

  useEffect(() => {
    const handleVoiceHomeIntent = (event: Event) => {
      const intent = event instanceof CustomEvent
        ? event.detail
        : undefined;
      if (!isVoiceHomeIntent(intent)) return;
      const now = Date.now();
      const previous = lastVoiceHomeIntentRef.current;
      if (previous?.intent === intent && now - previous.at < 3500) return;
      lastVoiceHomeIntentRef.current = { intent, at: now };
      const transition = transitionForVoiceHomeIntent(intent);
      setHomeIntentLayer(transition.layer);
      setHomeSubflow(null);
    };

    window.addEventListener(VYVA_VOICE_HOME_INTENT_EVENT, handleVoiceHomeIntent);
    return () => window.removeEventListener(VYVA_VOICE_HOME_INTENT_EVENT, handleVoiceHomeIntent);
  }, [guardPath]);

  useEffect(() => {
    const handleVoiceHomeSubflow = (event: Event) => {
      const subflow = event instanceof CustomEvent ? event.detail : undefined;
      if (!isVoiceHomeSubflow(subflow)) return;
      setHomeIntentLayer(subflow.pillar);
      setHomeSubflow(subflow);
    };

    window.addEventListener(VYVA_VOICE_HOME_SUBFLOW_EVENT, handleVoiceHomeSubflow);
    return () => window.removeEventListener(VYVA_VOICE_HOME_SUBFLOW_EVENT, handleVoiceHomeSubflow);
  }, []);

  useEffect(() => {
    writeHomeIntentLayer(homeIntentLayer);
  }, [homeIntentLayer]);

  useEffect(() => {
    writeHomeSubflow(homeSubflow);
  }, [homeSubflow]);

  useEffect(() => {
    try {
      localStorage.setItem("vyva:home-interaction-mode:v1", homeInteractionMode);
    } catch {
      return;
    }
  }, [homeInteractionMode]);

  useEffect(() => {
    const handleHomeModeControlAction = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as HomeModeControlActionDetail | undefined
        : undefined;
      if (detail?.mode !== "voice" && detail?.mode !== "touch") return;
      setHomeModeSwitcherVisible(true);
      setHomeInteractionMode(detail.mode);
    };

    window.addEventListener(VYVA_HOME_MODE_CONTROL_ACTION_EVENT, handleHomeModeControlAction);
    return () => window.removeEventListener(VYVA_HOME_MODE_CONTROL_ACTION_EVENT, handleHomeModeControlAction);
  }, []);

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    setHomeModeSwitcherVisible(true);
    const timer = window.setTimeout(() => setHomeModeSwitcherVisible(false), 4800);
    return () => window.clearTimeout(timer);
  }, [homeInteractionMode, homeIntentLayer]);

  useEffect(() => {
    const nextHomeInteractionMode: HomeInteractionMode = homeInteractionMode === "voice" ? "touch" : "voice";
    const detail: HomeModeControlDetail = {
      mode: homeInteractionMode,
      visible: homeModeSwitcherVisible,
      label: nextHomeInteractionMode === "touch"
        ? t("home.mode.switchToTouch", "Switch to touch")
        : t("home.mode.switchToVoice", "Switch to voice"),
      testId: nextHomeInteractionMode === "touch" ? "button-home-mode-touch" : "button-home-mode-voice",
    };

    publishHomeModeControl(detail);
    return () => {
      if (import.meta.env.MODE === "test") return;
      publishHomeModeControl({ ...detail, visible: false });
    };
  }, [homeInteractionMode, homeModeSwitcherVisible, t]);

  useEffect(() => {
    const timer = window.setInterval(() => setConciergeClockMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setHomeFastHelpHistory(readHomeFastHelpHistory(homeFastHelpHistoryKey));
  }, [homeFastHelpHistoryKey]);

  useEffect(() => {
    activeFastHelpImpressionIdRef.current = null;
    fastHelpImpressionIdsByFingerprintRef.current.clear();
  }, [profile?.profileId]);

  useEffect(() => {
    const syncJourneys = () => setHomeFastHelpJourneys(readHomeFastHelpJourneys(homeFastHelpJourneyKey));
    setHomeFastHelpJourneys(abandonOpenedHomeFastHelpJourneys(homeFastHelpJourneyKey));

    const handleJourneyChange = (event: Event) => {
      const changedKey = event instanceof CustomEvent && typeof event.detail?.storageKey === "string"
        ? event.detail.storageKey
        : null;
      if (changedKey && changedKey !== homeFastHelpJourneyKey) return;
      syncJourneys();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === homeFastHelpJourneyKey) syncJourneys();
    };
    window.addEventListener(HOME_FAST_HELP_JOURNEY_EVENT, handleJourneyChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(HOME_FAST_HELP_JOURNEY_EVENT, handleJourneyChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [homeFastHelpJourneyKey]);

  useEffect(() => {
    const refresh = () => setShowVyvaReviewHistory(readShowVyvaReviewHistory());
    window.addEventListener(SHOW_VYVA_REVIEW_HISTORY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SHOW_VYVA_REVIEW_HISTORY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const firstName = displayFirstName(profileFirstName);

  const homeDoctorContext = t("home.fastHelp.doctorContext", "Home quick doctor help request. Ask what is happening and help prepare a safe next step.");
  const gpName = profile?.gpName?.trim();
  const gpPhoneHref = sanitizePhoneHref(profile?.gpPhone);
  const gpEmailHref = homeDoctorMailto(
    profile?.gpEmail,
    t("health.symptomCheck.report.actions.emailSubject", "VYVA symptom report"),
    homeDoctorContext,
  );

  const {
    data: profileWeatherData,
    isError: profileWeatherError,
    error: profileWeatherRawError,
  } = useQuery<WeatherData>({
    queryKey: ["/api/weather"],
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    retry: false,
  });

  const [coordsWeatherData, setCoordsWeatherData] = useState<WeatherData | null>(() => readCoordsWeatherCache());
  const geoAttemptedRef = useRef(false);

  const noCityInProfile =
    profileWeatherError &&
    profileWeatherRawError instanceof Error &&
    profileWeatherRawError.message.startsWith("404");

  const fetchIpWeather = useCallback(async () => {
    try {
      const res = await fetch("/api/weather/by-ip");
      if (res.ok) {
        const data = await res.json();
        writeCoordsWeatherCache(data);
        setCoordsWeatherData(data);
      }
    } catch (err) {
      console.warn("[home] IP weather lookup failed:", err);
    }
  }, []);

  useEffect(() => {
    if (!noCityInProfile) return;
    if (geoAttemptedRef.current) return;
    geoAttemptedRef.current = true;

    if (readCoordsWeatherCache()) {
      return;
    }

    if (!navigator.geolocation) {
      fetchIpWeather();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/weather/by-coords?lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            writeCoordsWeatherCache(data);
            setCoordsWeatherData(data);
          }
        } catch (err) {
          console.warn("[home] coordinate weather lookup failed:", err);
        }
      },
      () => {
        fetchIpWeather();
      },
      { timeout: 8000 }
    );
  }, [fetchIpWeather, noCityInProfile]);

  const weatherData = profileWeatherData ?? coordsWeatherData;
  const participationLanguage = baseLanguageCode(language);

  const { data: medicationHomeSignal } = useQuery<MedicationHomeSignal>({
    queryKey: ["/api/meds/adherence-report"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });

  const { data: refillAlertHomeSignal } = useQuery<MedicationRefillAlertResponse>({
    queryKey: ["/api/meds/refills/me"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });
  const activeHomeRefillAlert = refillAlertHomeSignal?.alerts?.[0] ?? null;

  const { data: latestVitalsHomeSignal } = useQuery<LatestVitalsHomeSignal>({
    queryKey: ["/api/vitals-engine/latest"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });

  const { data: preventionHomeSignal } = useQuery<PreventionHomeSignal>({
    queryKey: [LONGEVITY_FOCUS_API_ROUTE],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });

  const { data: checkinHomeSignal } = useQuery<DailyCheckinHomeSignal>({
    queryKey: ["/api/checkins/today"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });

  const { data: brainCoachHomeSignal } = useQuery<BrainCoachHomeSignal>({
    queryKey: ["/api/games/progress"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });

  const { data: participationPulseHomeSignal } = useQuery<ParticipationPulseHomeSignal>({
    queryKey: [`/api/social/participate/pulse?lang=${participationLanguage}`],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });

  const { data: scheduledEventsHomeSignal } = useQuery<ScheduledEventsHomeSignal>({
    queryKey: ["/api/profile/scheduled-events"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });

  const { data: conciergePendingHomeSignal } = useQuery<ConciergePendingHomeSignal>({
    queryKey: ["/api/concierge/actions/pending"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });

  const { data: conciergeCompletedHomeSignal } = useQuery<ConciergeCompletedHomeSignal>({
    queryKey: ["/api/concierge/actions/sessions"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });

  const { data: crossPillarToolReadiness } = useQuery<{
    tools: CrossPillarToolEvidence[];
  }>({
    queryKey: ["/api/cross-pillar/tool-readiness"],
    staleTime: 30 * 1000,
    retry: false,
  });
  const crossPillarToolEvidence = useMemo(() => Object.fromEntries(
    (crossPillarToolReadiness?.tools ?? []).map((item) => [item.family, item]),
  ) as Partial<Record<CrossPillarToolFamily, CrossPillarToolEvidence>>, [crossPillarToolReadiness]);

  const timeGreetingKey = useMemo(() => {
    const hour = new Date(conciergeClockMs).getHours();
    if (hour >= 5 && hour <= 11) return "morning";
    if (hour >= 12 && hour <= 16) return "afternoon";
    return "evening";
  }, [conciergeClockMs]);

  const greetingText = useMemo(() => {
    const period = timeGreetingKey;
    const capitalizedName = firstName
      ? firstName.charAt(0).toLocaleUpperCase(language) + firstName.slice(1)
      : "";
    if (firstName) {
      return t(`home.greeting.${period}.withName.1`, { name: capitalizedName });
    }
    return t(`home.greeting.${period}.withoutName.1`);
  }, [firstName, language, timeGreetingKey, t]);

  const handleNavigate = useCallback((path: string, options?: NavigateOptions) => {
    guardPath(path, options);
  }, [guardPath]);

  const handleHomeShellNavigate = useCallback((path: string, options?: NavigateOptions) => {
    if (import.meta.env.MODE !== "test" && path.startsWith("/dev/home-master") && onShellNavigate) {
      onShellNavigate(path, options);
      return;
    }

    guardPath(path, options);
  }, [guardPath, onShellNavigate]);

  const handleProfileMenuNavigate = useCallback((path: string, options?: NavigateOptions) => {
    setHomeProfileMenuOpen(false);
    handleNavigate(path, options);
  }, [handleNavigate]);

  const switchHomeModeFromProfileMenu = useCallback(() => {
    const nextMode = homeInteractionMode === "voice" ? "touch" : "voice";
    setHomeModeSwitcherVisible(true);
    setHomeInteractionMode(nextMode);
    setHomeProfileMenuOpen(false);

    if (nextMode === "touch") {
      handleHomeShellNavigate(menuPath);
    }
  }, [handleHomeShellNavigate, homeInteractionMode, menuPath]);

  const launchHomeFastHelp = (
    actionId: ContextualHomeFastHelpActionId,
    path: string,
    options?: NavigateOptions,
  ) => {
    const { context } = startHomeFastHelpJourney({
      actionId,
      destinationPath: path,
      destinationState: options?.state,
      profileId: profile?.profileId,
      impressionId: activeFastHelpImpressionIdRef.current,
    });
    const allowed = handleNavigate(path, {
      ...options,
      state: withHomeFastHelpContextState(context, options?.state),
    });
    if (allowed === false) {
      markHomeFastHelpJourney(context, "blocked", { reason: "service_not_ready" });
    }
    setHomeFastHelpJourneys(readHomeFastHelpJourneys(context.storageKey));
  };

  const resumedHomeFastHelpState = (actionId: ContextualHomeFastHelpActionId) => {
    if (actionId === "book-ride") return {
      conciergePrefill: {
        kind: "ride",
        message: t("home.fastHelp.ridePrefill", "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation."),
        flowReference: CONCIERGE_FLOW_REFERENCES.transportBooking,
        source: "home_quick_action",
      },
    };
    if (actionId === "find-care") {
      const message = t("home.master.fastHelp.findCarePrefill", "Help me find care or support options. Ask what kind of care I need and do not contact anyone without my confirmation.");
      return {
        conciergePrefill: {
          kind: "task",
          message,
          flowReference: CONCIERGE_FLOW_REFERENCES.careNavigation,
          requestedTool: "operator_review",
          actionLabel: t("home.master.fastHelp.findCareAction", "Prepare care search"),
          summary: t("home.master.fastHelp.findCareSummary", "VYVA prepares options first, then asks before contacting anyone."),
          useCase: "find_provider",
          providerSearchMode: "care",
          providerSearchCriteria: ["nearby", "reputation", "accessible"],
          providerSearchQuery: message,
          source: "home_quick_action",
        },
      };
    }
    if (actionId === "paperwork-help") return {
      conciergePrefill: {
        kind: "task",
        message: t("home.master.fastHelp.paperworkHelpPrefill", "Help me with paperwork or a form. Prepare answers and stop before submitting so I can confirm."),
        flowReference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
        requestedTool: "operator_review",
        actionLabel: t("home.master.fastHelp.paperworkHelpAction", "Prepare paperwork"),
        summary: t("home.master.fastHelp.paperworkHelpSummary", "VYVA organizes the form, missing details, and safest next step."),
        useCase: "admin_task",
        source: "home_quick_action",
      },
    };
    return null;
  };

  const continueHomeFastHelp = (
    journey: HomeFastHelpJourney,
    stateOverride?: Record<string, unknown>,
    fromRecoveryNudge = false,
  ) => {
    const resumed = resumeHomeFastHelpJourney(
      journey,
      homeFastHelpJourneyKey,
      fromRecoveryNudge
        ? { reason: "recovery_nudge", referenceId: HOME_FAST_HELP_RECOVERY_REFERENCE_ID }
        : undefined,
    );
    const context = homeFastHelpContextForJourney(resumed, homeFastHelpJourneyKey);
    const destinationState = {
      ...(resumed.destinationState ?? resumedHomeFastHelpState(resumed.actionId) ?? {}),
      ...(stateOverride ?? {}),
    };
    const allowed = handleNavigate(resumed.destinationPath, {
      state: withHomeFastHelpContextState(context, destinationState),
    });
    if (allowed === false) {
      markHomeFastHelpJourney(context, "blocked", { reason: "service_not_ready" });
    }
    setHomeFastHelpJourneys(readHomeFastHelpJourneys(homeFastHelpJourneyKey));
  };

  const rememberHomeFastHelpUse = (actionId: ContextualHomeFastHelpActionId) => {
    setHomeFastHelpHistory((current) => {
      const next = recordHomeFastHelpUse(current, actionId);
      writeHomeFastHelpHistory(homeFastHelpHistoryKey, next);
      return next;
    });
  };

  const handleAgentCardOpen = (card: HomeAgentCard) => {
    if (card.id === "health") {
      setHomeIntentLayer("health");
      return;
    }
    handleNavigate(card.path, SECTION_VOICE_AUTO_START_OPTIONS);
  };

  const handleFastActionOpen = (action: HomeFastAction) => {
    if (action.id === "doctor") {
      handleNavigate("/health/doctor", {
        state: {
          autoStartVoice: true,
          latestSymptomReport: homeDoctorContext,
        },
      });
      return;
    }

    const isRide = action.id === "ride";
    handleNavigate("/concierge", {
      state: {
        conciergePrefill: {
          kind: isRide ? "ride" : "appointment",
          message: isRide
            ? t("home.fastHelp.ridePrefill", "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation.")
            : t("home.fastHelp.appointmentPrefill", "Please help me schedule an appointment. Ask what kind of appointment I need and do not book anything without my confirmation."),
          source: "home_quick_action",
        },
      },
    });
  };

  const homeFastActions: HomeFastAction[] = useMemo(() => [
    ...(gpPhoneHref
      ? [{
          id: "callGp" as const,
          icon: PhoneCall,
          tone: "call" as const,
          label: gpName ? t("meds.callGpNamed", "Call {{name}}", { name: gpName }) : t("meds.callGp", "Call GP"),
          sub: t("meds.callGpSub", "Speak to your practice now."),
          mobileLabel: t("meds.callGpMobile", "Call GP"),
          mobileSub: t("meds.callGpSubMobile", "Speak now"),
          href: gpPhoneHref,
        }]
      : []),
    ...(gpEmailHref
      ? [{
          id: "emailGp" as const,
          icon: Mail,
          tone: "email" as const,
          label: t("meds.emailGp", "Email GP"),
          sub: t("meds.emailGpSub", "Open an email with context filled in."),
          mobileLabel: t("meds.emailGpMobile", "Email GP"),
          mobileSub: t("meds.emailGpSubMobile", "Send context"),
          href: gpEmailHref,
        }]
      : []),
    ...HOME_FAST_ACTIONS.map((action) => ({
      ...action,
      label: t(`home.fastHelp.${action.id}.label`),
      sub: t(`home.fastHelp.${action.id}.sub`),
      mobileLabel: t(`home.fastHelp.${action.id}.mobileLabel`, HOME_FAST_ACTION_MOBILE_COPY[action.id].label),
      mobileSub: t(`home.fastHelp.${action.id}.mobileSub`, HOME_FAST_ACTION_MOBILE_COPY[action.id].sub),
    })),
  ], [gpEmailHref, gpName, gpPhoneHref, t]);

  useEffect(() => {
    if (fastHelpStartIndex < homeFastActions.length) return;
    setFastHelpStartIndex(0);
  }, [fastHelpStartIndex, homeFastActions.length]);

  const visibleFastActions = useMemo(() => {
    if (homeFastActions.length <= HOME_FAST_HELP_VISIBLE_COUNT) return homeFastActions;
    return Array.from({ length: HOME_FAST_HELP_VISIBLE_COUNT }, (_item, index) => (
      homeFastActions[(fastHelpStartIndex + index) % homeFastActions.length]!
    ));
  }, [fastHelpStartIndex, homeFastActions]);

  const rotateFastHelp = () => {
    if (homeFastActions.length <= HOME_FAST_HELP_VISIBLE_COUNT) return;
    setFastHelpStartIndex((current) => (current + HOME_FAST_HELP_VISIBLE_COUNT) % homeFastActions.length);
  };

  const isSubscriptionLocked = (path: string) => {
    const serviceId = serviceForPath(path);
    if (!serviceId) return false;
    const service = readiness?.services?.[serviceId];
    return Boolean(service && !service.ready && service.missing.some((step) => step.section === "subscription"));
  };

  const homeMasterCards: MasterDashboardCard[] = [
    {
      id: "health",
      icon: Heart,
      iconAccent: "pulse",
      title: t("home.master.cards.healthShortTitle", "My Health"),
      detail: t("home.master.cards.healthDetailShort", "Check-ins, vitals, medicines"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA", surface: "#FFFFFF" },
      onClick: () => {
        setHomeIntentLayer("health");
        setHomeSubflow(null);
      },
      testId: "card-home-agent-health",
    },
    {
      id: "mind-memory",
      icon: Brain,
      iconAccent: "bridge",
      title: t("home.master.cards.mindMemoryShortTitle", "Brain Power"),
      detail: t("home.master.cards.mindMemoryDetailShort", "Memory, focus, calm"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE", surface: "#FFFFFF" },
      onClick: () => {
        setHomeIntentLayer("mind");
        setHomeSubflow(null);
      },
      testId: "card-home-agent-cognitive",
    },
    {
      id: "social",
      icon: Users,
      iconAccent: "link",
      title: t("home.master.cards.communityShortTitle", "Community"),
      detail: t("home.master.cards.communityDetailShort", "Rooms and support"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2F66D0", border: "#BFDBFE", surface: "#FFFFFF" },
      onClick: () => {
        setHomeIntentLayer("community");
        setHomeSubflow(null);
      },
      testId: "card-home-agent-social",
    },
    {
      id: "concierge",
      icon: ConciergeBell,
      iconAccent: "clapper",
      title: t("home.master.cards.conciergeShortTitle", "Concierge"),
      detail: t("home.master.cards.conciergeDetailShort", "Everyday help"),
      tone: { iconBg: "#ECFDF5", iconColor: "#149A63", border: "#BBF7D0", surface: "#FFFFFF" },
      onClick: () => {
        setHomeIntentLayer("concierge");
        setHomeSubflow(null);
      },
      testId: "card-home-agent-concierge",
    },
  ];

  const openHealthPath = (path: string, options?: NavigateOptions) => {
    handleNavigate(path, options);
  };

  const homeMasterHealthCards: MasterDashboardCard[] = [
    {
      id: "health-symptoms",
      icon: HeartPulse,
      title: t("home.master.healthIntent.symptoms", "Symptoms"),
      detail: t("home.master.healthIntent.symptomsDetail", "Say what you feel"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA", surface: "#FFFFFF" },
      onClick: () => openHealthPath("/health/symptom-check", SECTION_VOICE_AUTO_START_OPTIONS),
      testId: "card-home-health-symptoms",
    },
    {
      id: "health-vitals",
      icon: Activity,
      title: t("home.master.healthIntent.vitals", "Vitals"),
      detail: t("home.master.healthIntent.vitalsDetail", "Blood pressure and readings"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2F66D0", border: "#BFDBFE", surface: "#FFFFFF" },
      onClick: () => openHealthPath("/health/vitals"),
      testId: "card-home-health-vitals",
    },
    {
      id: "health-meds",
      icon: Pill,
      title: t("home.master.healthIntent.meds", "Medications"),
      detail: t("home.master.healthIntent.medsDetail", "Doses and reminders"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE", surface: "#FFFFFF" },
      onClick: () => openHealthPath("/meds"),
      testId: "card-home-health-meds",
    },
    {
      id: "health-doctor",
      icon: Stethoscope,
      title: t("home.master.healthIntent.doctor", "Doctor next step"),
      detail: t("home.master.healthIntent.doctorDetail", "Prepare what to say"),
      tone: { iconBg: "#ECFDF5", iconColor: "#149A63", border: "#BBF7D0", surface: "#FFFFFF" },
      onClick: () => openHealthPath("/health/doctor", {
        state: {
          autoStartVoice: true,
          latestSymptomReport: homeDoctorContext,
        },
      }),
      testId: "card-home-health-doctor",
    },
    {
      id: "health-prevention",
      icon: ShieldCheck,
      title: t("home.master.healthIntent.prevention", "Prevention"),
      detail: t("home.master.healthIntent.preventionDetail", "Stay well today"),
      tone: { iconBg: "#FFF7ED", iconColor: "#C15B08", border: "#FED7AA", surface: "#FFFFFF" },
      onClick: () => openHealthPath(LONGEVITY_ROUTE),
      testId: "card-home-health-prevention",
    },
    {
      id: "health-visual-scan",
      icon: Camera,
      title: t("home.master.healthIntent.visualScan", "Visual scan"),
      detail: t("home.master.healthIntent.visualScanDetail", "Show VYVA a concern"),
      tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", border: "#99F6E4", surface: "#FFFFFF" },
      onClick: () => openHealthPath("/health", {
        state: {
          openVisualScan: true,
          source: "home_health_intent",
        },
      }),
      testId: "card-home-health-visual-scan",
    },
  ];

  const homeMasterMindCards: MasterDashboardCard[] = [
    {
      id: "mind-memory",
      icon: Brain,
      iconAccent: "bridge",
      title: t("mindMemory.cards.strengthenMemory", "Boost Memory"),
      detail: t("mindMemory.cards.strengthenMemoryDetail", "Recall people, places, words, numbers, and future cues."),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/brain-coach/remember"),
      testId: "card-home-mind-memory",
    },
    {
      id: "mind-reflexes",
      icon: Zap,
      iconAccent: "pulse",
      title: t("mindMemory.cards.trainReflexes", "Sharpen Focus"),
      detail: t("mindMemory.cards.trainReflexesDetail", "Stay attentive, react, and keep pace."),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/brain-coach/focus"),
      testId: "card-home-mind-reflexes",
    },
    {
      id: "mind-focus",
      icon: Puzzle,
      iconAccent: "knobs",
      title: t("mindMemory.cards.improveThinking", "Think & Plan"),
      detail: t("mindMemory.cards.improveThinkingDetail", "Plan, sort, switch rules, and solve sequences."),
      tone: { iconBg: "#FFFBEB", iconColor: "#B45309", border: "#FED7AA", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/brain-coach/think"),
      testId: "card-home-mind-focus",
    },
    {
      id: "mind-senses",
      icon: Headphones,
      iconAccent: "signal",
      title: t("mindMemory.cards.sharpenSenses", "Find Calm"),
      detail: t("mindMemory.cards.sharpenSensesDetail", "Slow down, breathe, and reconnect with sensory memory."),
      tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", border: "#99F6E4", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/brain-coach/calm"),
      testId: "card-home-mind-senses",
    },
  ];

  const homeMasterCommunityCards: MasterDashboardCard[] = [
    {
      id: "community-friends",
      icon: HeartHandshake,
      title: t("community.master.cards.match", "Make Friends"),
      detail: t("community.master.cards.matchDetail", "Find people like me"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/social-rooms/kitchen-table"),
      testId: "card-home-community-friends",
    },
    {
      id: "community-experts",
      icon: MessageCircleHeart,
      title: t("community.master.cards.experts", "Ask an Expert"),
      detail: t("community.master.cards.expertsDetail", "Talk with a VYVA specialist"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/social-rooms/experts"),
      testId: "card-home-community-experts",
    },
    {
      id: "community-share",
      icon: Share2,
      title: t("community.master.cards.share", "Share Stories"),
      detail: t("community.master.cards.shareDetail", "A memory or song"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/social-rooms/share"),
      testId: "card-home-community-share",
    },
    {
      id: "community-activities",
      icon: Footprints,
      title: t("community.master.cards.activities", "What's On"),
      detail: t("community.master.cards.activitiesDetail", "Movement and clubs"),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/social-rooms/activities"),
      testId: "card-home-community-activities",
    },
  ];

  const openConciergeTask = (entry: Record<string, unknown>) => {
    handleNavigate(conciergeTaskPath(), { state: { conciergeTaskEntry: entry } });
  };

  const homeMasterConciergeCards: MasterDashboardCard[] = [
    {
      id: "concierge-home",
      icon: Home,
      title: t("concierge.master.cards.homeCare", "Home Care"),
      detail: t("concierge.master.cards.homeCareDetail", "Plumber, electrician, cleaning"),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0", surface: "#FFFFFF" },
      onClick: () => openConciergeTask({ kind: "home_service" }),
      testId: "card-home-concierge-home",
    },
    {
      id: "concierge-care",
      icon: UserRound,
      title: t("concierge.master.cards.personalCare", "Personal Care"),
      detail: t("concierge.master.cards.personalCareDetail", "Find a specialist, find a residence"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA", surface: "#FFFFFF" },
      onClick: () => openConciergeTask({ kind: "provider_contact", providerSearchMode: "personal-care", query: "personal care" }),
      testId: "card-home-concierge-care",
    },
    {
      id: "concierge-order",
      icon: PackageCheck,
      title: t("concierge.master.cards.orderIn", "Order In"),
      detail: t("concierge.master.cards.orderInDetail", "Groceries, household"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/concierge/shopping"),
      testId: "card-home-concierge-order",
    },
    {
      id: "concierge-book",
      icon: Calendar,
      title: t("concierge.master.cards.bookNow", "Book Now"),
      detail: t("concierge.master.cards.bookNowDetail", "Medical, government, personal care"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE", surface: "#FFFFFF" },
      onClick: () => openConciergeTask({ kind: "appointment" }),
      testId: "card-home-concierge-book",
    },
  ];

  const conciergeResumeItems = conciergeHomeItems(conciergePendingHomeSignal);
  const nextConciergeTask = conciergeResumeItems[0] ?? null;
  const reusableConciergeHomeTask = conciergeCompletedHomeItems(conciergeCompletedHomeSignal)[0] ?? null;
  const reusableConciergeReceipt = reusableConciergeHomeTask
    ? buildConciergeConfirmationReceipt({
        useCase: reusableConciergeHomeTask.use_case,
        providerName: reusableConciergeHomeTask.provider_name,
        outcome: reusableConciergeHomeTask.outcome,
        outcomeSummary: reusableConciergeHomeTask.outcome_summary,
        completedAt: reusableConciergeHomeTask.completed_at,
        payload: reusableConciergeHomeTask.outcome_payload,
      }, language === "es")
    : null;
  const nextScheduledEvent = useMemo(() => {
    const now = conciergeClockMs;
    return (scheduledEventsHomeSignal?.events ?? [])
      .filter((event) => {
        const scheduledAt = Date.parse(event.scheduled_for ?? "");
        return Number.isFinite(scheduledAt)
          && scheduledAt >= now
          && !["cancelled", "completed", "dismissed"].includes(String(event.status ?? "").toLowerCase());
      })
      .sort((left, right) => Date.parse(left.scheduled_for ?? "") - Date.parse(right.scheduled_for ?? ""))[0] ?? null;
  }, [conciergeClockMs, scheduledEventsHomeSignal]);
  const remainingMedicineCount = medicationHomeSignal?.todaySummary?.remaining ?? 0;
  const nextMedicineName = medicationHomeSignal?.nextDose?.name?.trim();
  const nextMedicineMinutes = medicationHomeSignal?.nextDose?.minutesUntil;
  const isHomeMasterVoiceAlive = Boolean(voice && (voice.status === "connected" || voice.isConnecting));
  const isHomeMasterVoiceMode = homeInteractionMode === "voice";
  const homeContextHistorySnapshot = useMemo(() => ({
    actions: readHomeContextMessageActionHistory(),
    outcomes: readHomeContextMessageOutcomeHistory(),
    revision: homeContextHistoryRevision,
    seen: readHomeContextMessageHistory(),
  }), [homeContextHistoryRevision]);
  const homeContextDayStart = useMemo(() => {
    const day = new Date(conciergeClockMs);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
  }, [conciergeClockMs]);
  const elderFirstWelcomeSeen = useMemo(() => (
    Object.keys(homeContextHistorySnapshot.seen).some((id) => id.startsWith("hero:elder-first-"))
    || homeContextHistorySnapshot.outcomes.some((record) => (
      record.messageId.startsWith("hero:elder-first-")
      && ["shown", "opened", "dismissed", "completed"].includes(record.outcome)
    ))
  ), [homeContextHistorySnapshot]);
  const elderDailyWelcomeNudgeShownToday = useMemo(() => (
    homeContextHistorySnapshot.outcomes.some((record) => (
      record.messageId.startsWith("hero:elder-nudge-")
      && record.recordedAt >= homeContextDayStart
      && record.recordedAt <= conciergeClockMs
      && ["shown", "opened", "dismissed", "completed"].includes(record.outcome)
    ))
  ), [conciergeClockMs, homeContextDayStart, homeContextHistorySnapshot.outcomes]);
  const welcomeFirstLoginDue = heroHomeState?.audience === "elder" && !elderFirstWelcomeSeen;
  const welcomeDailyProfileNudgeDue = Boolean(
    heroHomeState?.audience === "elder"
    && heroHomeState.snapshot
    && !welcomeFirstLoginDue
    && !elderDailyWelcomeNudgeShownToday,
  );
  const managedHomeHeroMessage = useHeroMessage("home_voice", {
    language,
    trackImpression: false,
    welcomeAudience: "elder",
    welcomeFirstLoginDue,
    welcomeDailyProfileNudgeDue,
    profileCompletionSnapshot: heroHomeState?.snapshot ?? null,
  });
  const adminHomeContextMessage = useMemo(
    () => adaptHeroMessageForHome(managedHomeHeroMessage),
    [managedHomeHeroMessage],
  );
  const homeContextMessages = useMemo<HomeContextMessage[]>(() => {
    const messages: HomeContextMessage[] = [];
    if (homeIntentLayer !== "home") {
      const intentKey = `${homeIntentLayer}Intent`;
      messages.push({
        id: `active-flow:${homeIntentLayer}`,
        kind: "flow",
        title: t(`home.master.${intentKey}.title`),
        supportingText: isHomeMasterVoiceMode
          ? t(`home.master.${intentKey}.voiceSubtitle`)
          : t(`home.master.${intentKey}.dormantSubtitle`),
        priority: 100,
        category: homeIntentLayer,
        intentTags: [homeIntentLayer],
      });
    }
    const vitalsNeedAttention = ["urgent", "critical", "high"].includes(
      String(latestVitalsHomeSignal?.latest_alert?.severity ?? latestVitalsHomeSignal?.analysis?.safety_status ?? "").toLowerCase(),
    );
    if (vitalsNeedAttention) {
      messages.push({
        id: "vitals:attention",
        kind: "urgent",
        title: t("home.context.vitals.title", "Your health reading needs attention."),
        supportingText: t("home.context.vitals.support", "Open My Health to review the safest next step."),
        actionLabel: t("home.context.actions.review", "Review"),
        actionRoute: "/health",
        dismissible: false,
        priority: 90,
        repeatAfterMs: 30 * 60 * 1000,
        category: "health",
        intentTags: ["health", "vitals"],
      });
    }
    if (reusableConciergeHomeTask && reusableConciergeReceipt) {
      const completedAt = Date.parse(reusableConciergeHomeTask.completed_at ?? "");
      if (!Number.isFinite(completedAt) || conciergeClockMs - completedAt < 7 * 24 * 60 * 60 * 1000) {
        messages.push({
          id: `receipt:${reusableConciergeHomeTask.id ?? reusableConciergeHomeTask.pending_id ?? "latest"}`,
          kind: "receipt",
          title: reusableConciergeReceipt.subjectValue
            ? t("home.context.receipt.titleWithSubject", "{{subject}} is complete.", {
                subject: reusableConciergeReceipt.subjectValue,
              })
            : t("home.context.receipt.title", "Your request is complete."),
          supportingText: reusableConciergeReceipt.nextStep
            || t("home.context.receipt.support", "You can review what happened."),
          actionLabel: t("home.context.actions.view", "View"),
          actionRoute: "/concierge",
          actionState: { openCompletedHistory: true, source: "home_context_message" },
          dismissible: true,
          priority: 85,
          repeatAfterMs: 24 * 60 * 60 * 1000,
          category: "concierge",
          intentTags: ["concierge"],
        });
      }
    }
    if (nextConciergeTask) {
      messages.push({
        id: `concierge-task:${nextConciergeTask.id ?? "latest"}`,
        kind: "flow",
        title: nextConciergeTask.action_summary?.trim()
          || t("home.context.concierge.title", "Your request is still in progress."),
        supportingText: t("home.context.concierge.support", "Continue where you left off."),
        actionLabel: t("home.context.actions.continue", "Continue"),
        actionRoute: nextConciergeTask.task_path?.trim() || "/concierge",
        actionState: { resumePendingActionId: nextConciergeTask.id, source: "home_context_message" },
        dismissible: true,
        priority: 80,
        repeatAfterMs: 2 * 60 * 60 * 1000,
        category: "concierge",
        intentTags: ["concierge"],
      });
    }
    if (checkinHomeSignal?.status === "overdue" || checkinHomeSignal?.status === "due_now") {
      messages.push({
        id: `checkin:${checkinHomeSignal.status}`,
        kind: "reminder",
        title: t("home.context.checkin.title", "Your check-in is ready."),
        supportingText: t("home.context.checkin.support", "It only takes a moment."),
        actionLabel: t("home.context.actions.start", "Start"),
        actionRoute: "/health",
        actionState: { focusDailyCheckin: true, source: "home_context_message" },
        dismissible: true,
        priority: 75,
        repeatAfterMs: 60 * 60 * 1000,
        category: "health",
        intentTags: ["health", "checkin"],
      });
    }
    const refillAlert = refillAlertHomeSignal?.alerts?.[0];
    if (refillAlert) {
      messages.push({
        id: `refill:${refillAlert.id}`,
        kind: "reminder",
        title: refillAlert.title,
        supportingText: refillAlert.message,
        actionLabel: t("home.context.refill.update", "Update supply"),
        actionRoute: "/meds/refills",
        dismissible: refillAlert.status !== "refill_now",
        priority: refillAlert.status === "refill_now" ? 82 : 78,
        repeatAfterMs: refillAlert.status === "refill_now" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
        category: "medication",
        intentTags: ["health", "medication", "refill"],
      });
    }
    if (nextMedicineName && typeof nextMedicineMinutes === "number" && nextMedicineMinutes >= 0) {
      const doseDueAt = conciergeClockMs + nextMedicineMinutes * 60 * 1000;
      messages.push({
        id: `dose:${nextMedicineName}`,
        kind: "reminder",
        title: t("home.master.nextMedicationNudge", "Don't forget {{name}} in {{minutes}} min.", {
          minutes: nextMedicineMinutes,
          name: nextMedicineName,
        }),
        supportingText: t("home.context.medication.support", "Open My Health when you are ready."),
        actionLabel: t("home.context.actions.open", "Open"),
        actionRoute: "/meds",
        dismissible: true,
        priority: 70,
        expiresAt: conciergeClockMs + Math.max(15, nextMedicineMinutes + 15) * 60 * 1000,
        repeatAfterMs: 30 * 60 * 1000,
        category: "medication",
        intentTags: ["health", "medication", "meds"],
        dueAt: doseDueAt,
      });
    } else if (remainingMedicineCount > 0) {
      messages.push({
        id: `doses-remaining:${remainingMedicineCount}`,
        kind: "reminder",
        title: t(
          "home.master.medicationNudge",
          remainingMedicineCount === 1 ? "1 dose left today." : "{{count}} doses left today.",
          { count: remainingMedicineCount },
        ),
        supportingText: t("home.context.medication.support", "Open My Health when you are ready."),
        actionLabel: t("home.context.actions.open", "Open"),
        actionRoute: "/meds",
        dismissible: true,
        priority: 65,
        repeatAfterMs: 2 * 60 * 60 * 1000,
        category: "medication",
        intentTags: ["health", "medication", "meds"],
      });
    }
    const latestCommunityNotification = participationPulseHomeSignal?.pulse?.notifications
      ?.find((notification) => !notification.readAt && (notification.title || notification.body));
    if (latestCommunityNotification) {
      messages.push({
        id: `community-notification:${latestCommunityNotification.id ?? latestCommunityNotification.eventId ?? "latest"}`,
        kind: "event",
        title: latestCommunityNotification.title
          || t("home.context.community.title", "There is something new in your community."),
        supportingText: latestCommunityNotification.body
          || t("home.context.event.support", "Open My Community to take a look."),
        actionLabel: t("home.context.actions.view", "View"),
        actionRoute: "/social-rooms",
        dismissible: true,
        priority: 60,
        repeatAfterMs: 24 * 60 * 60 * 1000,
        category: "community",
        intentTags: ["community"],
        nonUrgent: true,
      });
    }
    if (nextScheduledEvent) {
      const startsAt = Date.parse(nextScheduledEvent.scheduled_for ?? "");
      const minutesUntil = Math.max(0, Math.round((startsAt - conciergeClockMs) / 60_000));
      messages.push({
        id: `scheduled-event:${nextScheduledEvent.id ?? nextScheduledEvent.scheduled_for ?? "next"}`,
        kind: "reminder",
        title: nextScheduledEvent.title?.trim()
          || t("home.context.scheduled.title", "You have something coming up."),
        supportingText: minutesUntil < 120
          ? t("home.context.scheduled.soon", "Starts in {{minutes}} minutes.", { minutes: minutesUntil })
          : t("home.context.scheduled.later", "Open your schedule for the details."),
        actionLabel: t("home.context.actions.view", "View"),
        actionRoute: "/settings/scheduled-support",
        dismissible: true,
        priority: minutesUntil <= 60 ? 72 : 45,
        startsAt: Math.min(conciergeClockMs, startsAt - 24 * 60 * 60 * 1000),
        expiresAt: startsAt + 60 * 60 * 1000,
        repeatAfterMs: 2 * 60 * 60 * 1000,
        category: nextScheduledEvent.event_type === "appointment" ? "appointment" : "general",
        intentTags: nextScheduledEvent.event_type === "appointment"
          ? ["health", "appointment", "doctor"]
          : ["schedule"],
        dueAt: startsAt,
      });
    }
    const featuredEvent = participationPulseHomeSignal?.pulse?.featuredEvent;
    if (featuredEvent?.format) {
      messages.push({
        id: `event:${featuredEvent.id ?? featuredEvent.title ?? featuredEvent.format}`,
        kind: "event",
        title: featuredEvent.title?.trim()
          || (featuredEvent.format === "online"
            ? t("home.context.event.online", "There is an online activity you may enjoy.")
            : t("home.context.event.nearby", "There is an activity nearby you may enjoy.")),
        supportingText: t("home.context.event.support", "Open My Community to take a look."),
        actionLabel: t("home.context.actions.view", "View"),
        actionRoute: "/social-rooms",
        dismissible: true,
        priority: 35,
        repeatAfterMs: 24 * 60 * 60 * 1000,
        category: "community",
        intentTags: ["community"],
        nonUrgent: true,
      });
    }
    if (preventionHomeSignal?.focus) {
      messages.push({
        id: `prevention:${preventionHomeSignal.focus}`,
        kind: "tip",
        title: t("home.context.prevention.title", "A small prevention step is ready."),
        supportingText: t("home.context.prevention.support", "See today's gentle health suggestion."),
        actionLabel: t("home.context.actions.view", "View"),
        actionRoute: LONGEVITY_ROUTE,
        dismissible: true,
        priority: 25,
        repeatAfterMs: 24 * 60 * 60 * 1000,
        category: "health",
        intentTags: ["health", "prevention"],
        nonUrgent: true,
      });
    }
    if (brainCoachHomeSignal?.summary && (brainCoachHomeSignal.today?.completedCount ?? 0) === 0) {
      messages.push({
        id: `brain-coach:${new Date().toISOString().slice(0, 10)}`,
        kind: "tip",
        title: t("home.context.mind.title", "Ready for a short mind activity?"),
        supportingText: t("home.context.mind.support", "Choose something that feels good today."),
        actionLabel: t("home.context.actions.open", "Open"),
        actionRoute: "/mind-memory",
        dismissible: true,
        priority: 20,
        repeatAfterMs: 24 * 60 * 60 * 1000,
        category: "mind",
        intentTags: ["mind", "cognitive"],
        nonUrgent: true,
      });
    }
    const emptyProfileNudge = participationPulseHomeSignal?.pulse?.emptyProfileNudge;
    if (emptyProfileNudge?.title && emptyProfileNudge.path) {
      messages.push({
        id: `feature:${emptyProfileNudge.path}`,
        kind: "feature",
        title: emptyProfileNudge.title,
        supportingText: emptyProfileNudge.body,
        actionLabel: emptyProfileNudge.actionLabel || t("home.context.actions.open", "Open"),
        actionRoute: emptyProfileNudge.path,
        dismissible: true,
        priority: 10,
        repeatAfterMs: 7 * 24 * 60 * 60 * 1000,
        category: "general",
        nonUrgent: true,
      });
    }
    if (adminHomeContextMessage) {
      messages.push(adminHomeContextMessage);
    }
    messages.push({
      id: `default:${timeGreetingKey}`,
      kind: "default",
      title: greetingText.replace(/[.]$/, ""),
      supportingText: t(`home.master.proactiveGreeting.${timeGreetingKey}`, "How are you feeling?"),
      priority: 1,
      category: "general",
      source: "fallback",
    });
    return messages;
  }, [
    checkinHomeSignal?.status,
    brainCoachHomeSignal,
    conciergeClockMs,
    adminHomeContextMessage,
    nextConciergeTask,
    nextScheduledEvent,
    preventionHomeSignal,
    refillAlertHomeSignal,
    reusableConciergeHomeTask,
    reusableConciergeReceipt,
    greetingText,
    homeIntentLayer,
    isHomeMasterVoiceMode,
    latestVitalsHomeSignal,
    nextMedicineMinutes,
    nextMedicineName,
    participationPulseHomeSignal,
    remainingMedicineCount,
    t,
    timeGreetingKey,
  ]);
  const selectedHomeContextDecision = useMemo(
    () => {
      return decideHomeContextMessage(
        homeContextMessages,
        homeContextHistorySnapshot.seen,
        conciergeClockMs,
        {
          actionHistory: homeContextHistorySnapshot.actions,
          outcomeHistory: homeContextHistorySnapshot.outcomes,
          activeIntent: homeIntentLayer === "home" ? null : homeIntentLayer,
          freezeRotation: isHomeMasterVoiceAlive,
          frozenMessageId: stableHomeContextMessageIdRef.current,
          dailyNonUrgentLimit: 3,
        },
      );
    },
    [
      conciergeClockMs,
      homeContextHistorySnapshot,
      homeContextMessages,
      homeIntentLayer,
      isHomeMasterVoiceAlive,
    ],
  );
  const selectedHomeContextMessage = selectedHomeContextDecision?.message ?? null;
  useEffect(() => {
    if (
      !selectedHomeContextMessage
      || (
        isHomeMasterVoiceAlive
        && selectedHomeContextMessage.kind !== "urgent"
        && selectedHomeContextMessage.kind !== "flow"
      )
    ) return;
    stableHomeContextMessageIdRef.current = selectedHomeContextMessage.id;
  }, [
    isHomeMasterVoiceAlive,
    selectedHomeContextMessage,
    selectedHomeContextMessage?.id,
    selectedHomeContextMessage?.kind,
  ]);
  const selectedHomeVoiceContext = useMemo(() => ({
    id: selectedHomeContextMessage?.id ?? "default",
    kind: selectedHomeContextMessage?.kind ?? "default",
    title: selectedHomeContextMessage?.title ?? greetingText.replace(/[.]$/, ""),
    supportingText: selectedHomeContextMessage?.spokenText
      ?? selectedHomeContextMessage?.supportingText
      ?? "",
    actionLabel: selectedHomeContextMessage?.actionLabel ?? "",
    actionRoute: selectedHomeContextMessage?.actionRoute ?? "",
    reason: selectedHomeContextDecision?.reason ?? "default_greeting",
    score: selectedHomeContextDecision?.score ?? 0,
  }), [
    greetingText,
    selectedHomeContextDecision?.reason,
    selectedHomeContextDecision?.score,
    selectedHomeContextMessage,
  ]);
  const selectedHomeVoiceContextFingerprint = useMemo(
    () => JSON.stringify(selectedHomeVoiceContext),
    [selectedHomeVoiceContext],
  );
  const trackHomeContextOutcome = useCallback((
    outcome: HomeContextMessageOutcome,
    source: "touch" | "voice" | "voice_tool" | "system",
  ) => {
    if (!selectedHomeContextMessage || selectedHomeContextMessage.kind === "default") return;
    writeHomeContextMessageOutcome({
      messageId: selectedHomeContextMessage.id,
      outcome,
      source,
      kind: selectedHomeContextMessage.kind,
    });
    const reason: HeroReason = selectedHomeContextDecision?.reason === "urgent_safety"
      ? "safety"
      : selectedHomeContextDecision?.reason === "due_personal"
        ? "scheduled_event"
        : selectedHomeContextDecision?.reason === "active_flow"
          ? "continuation"
          : "evergreen";
    const state = selectedHomeContextMessage.actionState ?? {};
    const heroMessageId = typeof state.heroMessageId === "string"
      ? state.heroMessageId
      : selectedHomeContextMessage.id.replace(/^(admin|hero):/, "");
    recordHeroEvent({
      messageId: heroMessageId,
      surface: "home_voice",
      language: normalizeHeroLanguage(language),
      eventType: outcome,
      reason,
      source: selectedHomeContextMessage.source
        ?? (selectedHomeContextMessage.id.startsWith("admin:") ? "managed" : "built_in"),
      route: selectedHomeContextMessage.actionRoute,
    });
  }, [
    language,
    selectedHomeContextDecision?.reason,
    selectedHomeContextMessage,
  ]);
  useEffect(() => {
    const voiceStatus = voice?.status;
    if (voiceStatus !== "connecting" && voiceStatus !== "connected") {
      activeVoiceHomeContextFingerprintRef.current = null;
      return;
    }

    if (!activeVoiceHomeContextFingerprintRef.current) {
      activeVoiceHomeContextFingerprintRef.current = selectedHomeVoiceContextFingerprint;
      return;
    }

    if (
      voiceStatus !== "connected"
      || activeVoiceHomeContextFingerprintRef.current === selectedHomeVoiceContextFingerprint
    ) {
      return;
    }

    const contextUpdate = [
      "Silent app context update. The Home message changed while this voice session is active.",
      `Message kind: ${selectedHomeVoiceContext.kind}.`,
      `Visible message: ${selectedHomeVoiceContext.title}.`,
      selectedHomeVoiceContext.supportingText
        ? `Supporting message: ${selectedHomeVoiceContext.supportingText}.`
        : "",
      selectedHomeVoiceContext.actionLabel
        ? `Available action: ${selectedHomeVoiceContext.actionLabel}${selectedHomeVoiceContext.actionRoute ? ` (${selectedHomeVoiceContext.actionRoute})` : ""}.`
        : "",
      `Selection reason: ${selectedHomeVoiceContext.reason}.`,
      "Use this as context only. Do not repeat or announce it unless it helps answer the user or requires timely attention.",
    ].filter(Boolean).join("\n");

    if (voice?.sendContextUpdate(contextUpdate)) {
      activeVoiceHomeContextFingerprintRef.current = selectedHomeVoiceContextFingerprint;
    }
  }, [
    selectedHomeVoiceContext,
    selectedHomeVoiceContextFingerprint,
    voice,
    voice?.sendContextUpdate,
    voice?.status,
  ]);
  useEffect(() => {
    if (!selectedHomeContextMessage || selectedHomeContextMessage.kind === "default") {
      shownHomeContextMessageIdRef.current = null;
      return;
    }
    if (shownHomeContextMessageIdRef.current === selectedHomeContextMessage.id) return;
    const seenTimer = window.setTimeout(() => {
      shownHomeContextMessageIdRef.current = selectedHomeContextMessage.id;
      writeHomeContextMessageSeen(selectedHomeContextMessage.id);
      trackHomeContextOutcome("shown", "system");
      setHomeContextHistoryRevision((current) => current + 1);
    }, HOME_CONTEXT_MESSAGE_DISPLAY_MS);
    return () => window.clearTimeout(seenTimer);
  }, [
    selectedHomeContextMessage,
    selectedHomeContextMessage?.id,
    trackHomeContextOutcome,
  ]);
  useEffect(() => {
    if (voice?.status !== "connected") {
      voiceEngagedMessageIdRef.current = null;
      return;
    }
    if (
      !selectedHomeContextMessage
      || selectedHomeContextMessage.kind === "default"
      || voiceEngagedMessageIdRef.current === selectedHomeContextMessage.id
    ) return;
    voiceEngagedMessageIdRef.current = selectedHomeContextMessage.id;
    trackHomeContextOutcome("voice_engaged", "voice");
  }, [
    selectedHomeContextMessage,
    selectedHomeContextMessage?.id,
    selectedHomeContextMessage?.kind,
    trackHomeContextOutcome,
    voice?.status,
  ]);
  useEffect(() => {
    if (
      !selectedHomeContextMessage
      || (!selectedHomeContextMessage.id.startsWith("admin:") && !selectedHomeContextMessage.id.startsWith("hero:"))
      || !managedHomeHeroMessage
    ) return;
    recordHeroImpression(managedHomeHeroMessage.messageId);
    recordHeroEvent({
      messageId: managedHomeHeroMessage.messageId,
      surface: managedHomeHeroMessage.surface,
      language: normalizeHeroLanguage(language),
      eventType: "impression",
      reason: managedHomeHeroMessage.reason,
      source: managedHomeHeroMessage.source,
    });
  }, [language, managedHomeHeroMessage, selectedHomeContextMessage]);
  const dismissSelectedHomeContextMessage = useCallback(() => {
    if (!selectedHomeContextMessage?.dismissible) return;
    if (
      (selectedHomeContextMessage.id.startsWith("admin:") || selectedHomeContextMessage.id.startsWith("hero:"))
      && managedHomeHeroMessage
    ) {
      recordHeroEvent({
        messageId: managedHomeHeroMessage.messageId,
        surface: managedHomeHeroMessage.surface,
        language: normalizeHeroLanguage(language),
        eventType: "dismiss",
        reason: managedHomeHeroMessage.reason,
        source: managedHomeHeroMessage.source,
      });
    }
    writeHomeContextMessageAction(selectedHomeContextMessage.id, "dismissed", { source: "touch" });
    trackHomeContextOutcome("dismissed", "touch");
    writeHomeContextMessageSeen(selectedHomeContextMessage.id);
    setHomeContextHistoryRevision((current) => current + 1);
  }, [
    language,
    managedHomeHeroMessage,
    selectedHomeContextMessage,
    trackHomeContextOutcome,
  ]);
  const openSelectedHomeContextMessage = useCallback((
    source: "touch" | "voice" | "voice_tool" = "touch",
  ) => {
    if (!selectedHomeContextMessage?.actionRoute) return;
    if (
      (selectedHomeContextMessage.id.startsWith("admin:") || selectedHomeContextMessage.id.startsWith("hero:"))
      && managedHomeHeroMessage
    ) {
      recordHeroEvent({
        messageId: managedHomeHeroMessage.messageId,
        surface: managedHomeHeroMessage.surface,
        language: normalizeHeroLanguage(language),
        eventType: "cta_click",
        reason: managedHomeHeroMessage.reason,
        source: managedHomeHeroMessage.source,
        route: selectedHomeContextMessage.actionRoute,
      });
    }
    writeHomeContextMessageAction(selectedHomeContextMessage.id, "opened", { source });
    trackHomeContextOutcome("opened", source);
    if (voice?.status === "connected") {
      voice.sendContextUpdate([
        "Silent app context update. The user opened the Home message that was visible.",
        `Message: ${selectedHomeContextMessage.title}.`,
        selectedHomeContextMessage.supportingText
          ? `Supporting context: ${selectedHomeContextMessage.supportingText}.`
          : "",
        `Destination: ${selectedHomeContextMessage.actionRoute}.`,
        "Continue naturally from this context. Do not make the user repeat what they selected.",
      ].filter(Boolean).join("\n"));
    }
    handleNavigate(selectedHomeContextMessage.actionRoute, {
      state: selectedHomeContextMessage.actionState,
    });
  }, [
    handleNavigate,
    language,
    managedHomeHeroMessage,
    selectedHomeContextMessage,
    trackHomeContextOutcome,
    voice,
  ]);
  useEffect(() => {
    if (
      voice?.status !== "connected"
      || !selectedHomeContextMessage
      || selectedHomeContextMessage.kind === "default"
    ) return;

    const applyVoiceMessageAction = (
      action: "open" | "defer" | "dismiss" | "complete",
      source: "voice" | "voice_tool",
    ) => {
      if (action === "open") {
        if (!selectedHomeContextMessage.actionRoute) return;
        openSelectedHomeContextMessage(source);
        return;
      }

      if (action === "defer") {
        writeHomeContextMessageAction(selectedHomeContextMessage.id, "deferred", { source });
        trackHomeContextOutcome("deferred", source);
      } else if (action === "dismiss") {
        if (!selectedHomeContextMessage.dismissible) return;
        writeHomeContextMessageAction(selectedHomeContextMessage.id, "dismissed", { source });
        trackHomeContextOutcome("dismissed", source);
      } else {
        writeHomeContextMessageAction(selectedHomeContextMessage.id, "completed", { source });
        trackHomeContextOutcome("completed", source);
      }
      writeHomeContextMessageSeen(selectedHomeContextMessage.id);
      setHomeContextHistoryRevision((current) => current + 1);
    };

    const handleVoiceReply = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as VoiceUserMessageDetail | undefined
        : undefined;
      const action = detail?.text ? homeContextActionForVoiceReply(detail.text) : null;
      if (action) applyVoiceMessageAction(action, "voice");
    };

    const handleVoiceToolResult = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as VoiceAppActionResult | undefined
        : undefined;
      if (!detail?.actionId || detail.actionId !== selectedHomeContextMessage.id) return;
      if (detail.action === "accepted") applyVoiceMessageAction("open", "voice_tool");
      if (detail.action === "dismissed") {
        const permanentlyDismiss = /\b(?:dismiss|remove|hide)\b/i.test(detail.reason ?? "");
        applyVoiceMessageAction(permanentlyDismiss ? "dismiss" : "defer", "voice_tool");
      }
      if (detail.action === "completed") applyVoiceMessageAction("complete", "voice_tool");
    };

    window.addEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleVoiceReply);
    window.addEventListener(VYVA_VOICE_APP_ACTION_RESULT_EVENT, handleVoiceToolResult);
    return () => {
      window.removeEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleVoiceReply);
      window.removeEventListener(VYVA_VOICE_APP_ACTION_RESULT_EVENT, handleVoiceToolResult);
    };
  }, [
    openSelectedHomeContextMessage,
    selectedHomeContextMessage,
    trackHomeContextOutcome,
    voice?.status,
  ]);
  const homeMasterGreetingText = greetingText.replace(/[.]$/, "");
  const activeIntentKey = homeIntentLayer === "home" ? null : `${homeIntentLayer}Intent`;
  const activeIntentTitle = activeIntentKey
    ? t(`home.master.${activeIntentKey}.title`)
    : homeMasterGreetingText;
  const activeIntentSubtitle = activeIntentKey
    ? isHomeMasterVoiceMode
      ? t(`home.master.${activeIntentKey}.voiceSubtitle`)
      : t(`home.master.${activeIntentKey}.dormantSubtitle`)
    : null;
  const selectedHomeContextTitle = selectedHomeContextMessage?.title?.trim() ?? "";
  const selectedHomeContextSupport = selectedHomeContextMessage?.supportingText?.trim()
    || selectedHomeContextMessage?.spokenText?.trim()
    || "";
  const selectedHomeContextLooksLikeGreeting = Boolean(selectedHomeContextTitle)
    && selectedHomeContextTitle.replace(/[.]$/, "").toLowerCase() === homeMasterGreetingText.toLowerCase();
  const homeMasterContextNudgeText = !activeIntentKey
    && selectedHomeContextMessage
    && selectedHomeContextMessage.kind !== "default"
    ? selectedHomeContextLooksLikeGreeting
      ? selectedHomeContextSupport
      : selectedHomeContextTitle || selectedHomeContextSupport
    : null;
  const homeMasterNormalHeroSubtitle = activeIntentSubtitle
    ?? homeMasterContextNudgeText
    ?? t(`home.master.proactiveGreeting.${timeGreetingKey}`, "How are you feeling?");
  const showHomeVoiceOrbCue = homeInteractionMode === "voice";
  const showHomeVoiceFirstUseHint = showHomeVoiceOrbCue && homeIntentLayer === "home" && showVoiceOrbFirstUseHint;
  const homeMasterHeroSubtitle = showHomeVoiceOrbCue
    ? t("home.master.touchOrbToBegin", "Touch the orb to begin.")
    : homeMasterNormalHeroSubtitle;
  const cardsByIntent: Record<HomeIntentLayer, MasterDashboardCard[]> = {
    home: homeMasterCards,
    health: homeMasterHealthCards.slice(0, 4),
    mind: homeMasterMindCards,
    community: homeMasterCommunityCards,
    concierge: homeMasterConciergeCards,
  };
  const moreRouteByIntent: Partial<Record<HomeIntentLayer, string>> = {
    health: "/health",
    mind: "/mind-memory",
    community: "/social-rooms",
    concierge: "/concierge",
  };
  const homeMasterVisibleCards = cardsByIntent[homeIntentLayer].map((card) => {
    if (homeIntentLayer === "home") return card;
    const selected = homeSubflow?.pillar === homeIntentLayer && homeSubflow.actionId === card.id;
    return {
      ...card,
      highlighted: selected,
      highlightLabel: selected
        ? t("home.master.intentUnderstood", "VYVA understood")
        : undefined,
      onClick: () => {
        setHomeSubflow({
          pillar: homeIntentLayer,
          actionId: card.id as VoiceHomeSubflow["actionId"],
        });
        if (!isCrossPillarCompletionAction(card.id as VoiceHomeSubflow["actionId"])) {
          card.onClick();
        }
      },
    };
  });
  const activeCompletionAction = homeSubflow && isCrossPillarCompletionAction(homeSubflow.actionId)
    ? homeSubflow.actionId
    : null;
  const continueCrossPillarSubflow = (result: CrossPillarSubflowResult) => {
    executeCrossPillarHandoff({
      result,
      locale: language,
      doctorContext: homeDoctorContext,
      readiness: {
        hasSavedDoctor: profile?.serviceReadiness?.hasSavedDoctor,
        toolEvidence: crossPillarToolEvidence,
      },
    }, (path, options) => {
      if (result.actionId === "health-symptoms") {
        return handleNavigate(path, {
          ...SECTION_VOICE_AUTO_START_OPTIONS,
          ...options,
          state: {
            ...SECTION_VOICE_AUTO_START_OPTIONS.state,
            ...(options?.state as Record<string, unknown> ?? {}),
          },
        });
      }
      return handleNavigate(path, options);
    });
  };
  const homeMasterCardSectionTitle = homeIntentLayer === "home"
    ? t("home.master.chooseCategory", "App shortcuts")
    : undefined;
  const homeMasterCardSectionDescription = undefined;
  const homeMasterMoreRoute = moreRouteByIntent[homeIntentLayer];
  const homeMasterMoreLabel = activeIntentKey
    ? t(`home.master.${activeIntentKey}.more`)
    : undefined;
  const homeMasterMoreCompactLabel = activeIntentKey
    ? t(`home.master.${activeIntentKey}.moreCompact`, "More")
    : undefined;

  const homeMasterFastHelpActions: MasterFastHelpAction[] = [
    {
      id: "feel-better",
      icon: HeartPulse,
      label: t("home.master.fastHelp.feelBetter", "Ask Dr. AI"),
      detail: t("home.master.fastHelp.feelBetterDetail", "Symptoms or worries"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA" },
      onClick: () => launchHomeFastHelp("feel-better", "/health/symptom-check"),
      testId: "button-home-fast-feel-better",
    },
    {
      id: "stay-well",
      icon: ShieldCheck,
      label: t("home.master.fastHelp.stayWell", "Longevity"),
      detail: t("home.master.fastHelp.stayWellDetail", "Your plan for today"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA" },
      onClick: () => launchHomeFastHelp("stay-well", LONGEVITY_ROUTE),
      testId: "button-home-fast-stay-well",
    },
    {
      id: "find-care",
      icon: HeartHandshake,
      label: t("home.master.fastHelp.findCare", "Find Care"),
      detail: t("home.master.fastHelp.findCareDetail", "Support options"),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0" },
      onClick: () => launchHomeFastHelp("find-care", "/concierge", {
        state: {
          conciergePrefill: {
            kind: "task",
            message: t("home.master.fastHelp.findCarePrefill", "Help me find care or support options. Ask what kind of care I need and do not contact anyone without my confirmation."),
            flowReference: CONCIERGE_FLOW_REFERENCES.careNavigation,
            requestedTool: "operator_review",
            actionLabel: t("home.master.fastHelp.findCareAction", "Prepare care search"),
            summary: t("home.master.fastHelp.findCareSummary", "VYVA prepares options first, then asks before contacting anyone."),
            useCase: "find_provider",
            providerSearchMode: "care",
            providerSearchCriteria: ["nearby", "reputation", "accessible"],
            providerSearchQuery: t("home.master.fastHelp.findCarePrefill", "Help me find care or support options. Ask what kind of care I need and do not contact anyone without my confirmation."),
            source: "home_quick_action",
          },
        },
      }),
      testId: "button-home-fast-find-care",
    },
    {
      id: "book-ride",
      icon: Car,
      label: t("home.master.fastHelp.bookRide", "Book Ride"),
      detail: t("home.master.fastHelp.bookRideDetail", "Transport help"),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0" },
      onClick: () => launchHomeFastHelp("book-ride", "/concierge", {
        state: {
          conciergePrefill: {
            kind: "ride",
            message: t("home.fastHelp.ridePrefill", "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation."),
            flowReference: CONCIERGE_FLOW_REFERENCES.transportBooking,
            source: "home_quick_action",
          },
        },
      }),
      testId: "button-home-fast-book-ride",
    },
    {
      id: "paperwork-help",
      icon: FileText,
      label: t("home.master.fastHelp.paperworkHelp", "Paperwork Help"),
      detail: t("home.master.fastHelp.paperworkHelpDetail", "Forms and admin"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
      onClick: () => launchHomeFastHelp("paperwork-help", "/concierge", {
        state: {
          conciergePrefill: {
            kind: "task",
            message: t("home.master.fastHelp.paperworkHelpPrefill", "Help me with paperwork or a form. Prepare answers and stop before submitting so I can confirm."),
            flowReference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
            requestedTool: "operator_review",
            actionLabel: t("home.master.fastHelp.paperworkHelpAction", "Prepare paperwork"),
            summary: t("home.master.fastHelp.paperworkHelpSummary", "VYVA organizes the form, missing details, and safest next step."),
            useCase: "admin_task",
            source: "home_quick_action",
          },
        },
      }),
      testId: "button-home-fast-paperwork-help",
    },
    {
      id: "safe-home",
      icon: ShieldCheck,
      label: t("home.master.fastHelp.safeHome", "Safe Home"),
      detail: t("home.master.fastHelp.safeHomeDetail", "Home or scam worry"),
      tone: { iconBg: "#FEF2F2", iconColor: "#B91C1C", border: "#FECACA" },
      onClick: () => launchHomeFastHelp("safe-home", "/safe-home"),
      testId: "button-home-fast-safe-home",
    },
  ];

  const remoteFastHelpActivityFingerprint = JSON.stringify(
    contextualFastHelpRemoteActivity(conciergeCompletedHomeSignal),
  );
  const remoteFastHelpActivity = useMemo<HomeFastHelpActivity[]>(
    () => JSON.parse(remoteFastHelpActivityFingerprint) as HomeFastHelpActivity[],
    [remoteFastHelpActivityFingerprint],
  );
  useEffect(() => {
    setHomeFastHelpJourneys(reconcileHomeFastHelpJourneys(
      homeFastHelpJourneyKey,
      remoteFastHelpActivity,
    ));
  }, [homeFastHelpJourneyKey, remoteFastHelpActivity]);
  const journeyFastHelpActivity = homeFastHelpActivityFromJourneys(homeFastHelpJourneys);
  const latestBlockedJourney = latestBlockedHomeFastHelpJourney(homeFastHelpJourneys, conciergeClockMs);
  const rawRecoveryNudge = selectHomeFastHelpRecoveryNudge(homeFastHelpJourneys, {
    nowMs: conciergeClockMs,
    hasSavedTransportProvider: profile?.serviceReadiness?.hasSavedTransportProvider,
  });
  const homeResumeCandidate = selectHomeResumeCandidate({
    conciergeItems: conciergeResumeItems,
    fastHelpRecovery: rawRecoveryNudge,
  });
  const activeConciergeHomeTask = homeResumeCandidate?.source === "concierge"
    ? homeResumeCandidate.item
    : null;
  const recoveryNudge = homeResumeCandidate?.source === "fast_help"
    ? homeResumeCandidate.nudge
    : null;
  const activeConciergeShowVyvaTask = activeConciergeHomeTask ? isShowVyvaPreparedTask(activeConciergeHomeTask.action_payload) : false;
  const activeConciergeTaskText = activeConciergeHomeTask
    ? activeConciergeShowVyvaTask
      ? showVyvaResumeActionLabel(activeConciergeHomeTask.action_payload, language)
      : conciergeHomeTaskLabel(activeConciergeHomeTask, t)
    : "";
  const conciergeHomeStepText = activeConciergeHomeTask ? conciergeHomeStepLabel(activeConciergeHomeTask, t, language === "es") : "";
  const conciergeHomeKickerText = activeConciergeHomeTask ? conciergeHomeKickerLabel(activeConciergeHomeTask, t, language === "es") : "";
  const conciergeHomeTitlePrefixText = activeConciergeHomeTask ? conciergeHomeTitlePrefix(activeConciergeHomeTask, t) : "";
  const activeConciergeWaitingOnProvider = activeConciergeHomeTask ? conciergeHomeIsWaitingOnProvider(activeConciergeHomeTask) : false;
  const activeConciergeWaitingText = activeConciergeHomeTask && activeConciergeWaitingOnProvider
    ? conciergeHomeWaitingLabel(activeConciergeHomeTask, conciergeClockMs, language, t)
    : conciergeHomeStepText;
  const activeConciergeCanvasState = activeConciergeHomeTask
    ? conciergeHomeCanvasState(activeConciergeHomeTask)
    : null;
  const activeConciergeProviderText = activeConciergeHomeTask ? conciergeHomeProviderLabel(activeConciergeHomeTask, t) : "";
  const activeConciergeCanvasCopy = activeConciergeCanvasState
    ? conciergeCanvasExplainability(activeConciergeCanvasState, language === "es", {
        providerName: activeConciergeProviderText,
      })
    : null;
  const activeConciergeShowVyvaSourceText = activeConciergeHomeTask && activeConciergeShowVyvaTask
    ? showVyvaResumeSourceLabel(activeConciergeHomeTask.action_payload, language)
    : "";
  const activeConciergeShowVyvaSummary = activeConciergeHomeTask && activeConciergeShowVyvaTask
    ? showVyvaResumeSummary(activeConciergeHomeTask.action_payload, activeConciergeHomeTask.action_summary)
    : "";
  const activeConciergeTitleText = activeConciergeHomeTask
    ? activeConciergeShowVyvaTask
      ? t("home.showVyvaResume.title", "VYVA prepared this")
      : activeConciergeWaitingOnProvider
      ? t("home.conciergeResume.waitingTitle", "Waiting for {{provider}}", { provider: activeConciergeProviderText })
      : `${conciergeHomeTitlePrefixText} ${activeConciergeTaskText}`
    : "";
  const openActiveConciergeTask = (mode?: "follow_up" | "reply") => {
    if (!activeConciergeHomeTask?.id) return;
    handleNavigate(activeConciergeHomeTask.task_path || conciergeTaskPath(activeConciergeHomeTask.id), {
      state: mode
        ? {
            focusRightNow: true,
            conciergeProviderAction: {
              pendingId: activeConciergeHomeTask.id,
              mode,
            },
          }
        : { focusRightNow: true, conciergePendingId: activeConciergeHomeTask.id },
    });
  };
  const activeContextualFastHelpActionId = activeConciergeHomeTask
    ? contextualFastHelpActionForConciergeKind(conciergeHomeTaskKind(activeConciergeHomeTask))
    : recoveryNudge?.journey.actionId ?? null;
  const unfinishedContextualFastHelpActionIds = [...new Set(
    conciergeResumeItems.flatMap((item) => {
      const actionId = contextualFastHelpActionForConciergeKind(conciergeHomeTaskKind(item));
      return actionId ? [actionId] : [];
    }),
  )];
  const contextualFastHelpRanking = rankContextualHomeFastHelp({
    activeTaskActionId: activeContextualFastHelpActionId,
    activity: [...homeFastHelpHistory, ...remoteFastHelpActivity, ...journeyFastHelpActivity],
    nowMs: conciergeClockMs,
    profile: profile?.serviceReadiness,
    rotationKey: profile?.profileId,
    signals: {
      alertSeverity: latestVitalsHomeSignal?.latest_alert?.severity,
      checkinStatus: checkinHomeSignal?.status,
      preventionFocus: preventionHomeSignal?.focus,
      recommendedAction: latestVitalsHomeSignal?.analysis?.recommended_action,
      safetyStatus: latestVitalsHomeSignal?.analysis?.safety_status,
    },
    unfinishedTaskActionIds: unfinishedContextualFastHelpActionIds,
    visibleCount: 3,
  });
  const homeMasterFastHelpActionById = new Map(
    homeMasterFastHelpActions.map((action) => [action.id as ContextualHomeFastHelpActionId, action]),
  );
  const contextualHomeMasterFastHelpActions = contextualFastHelpRanking.flatMap((ranked) => {
    const action = homeMasterFastHelpActionById.get(ranked.id);
    if (!action) return [];
    return [{
      ...action,
      detail: latestBlockedJourney && ranked.id !== latestBlockedJourney.actionId
        ? t("home.contextualFastHelp.outcome.blockedAlternative", "Try this useful next step instead")
        : t(
            `home.contextualFastHelp.reasons.${ranked.reason}`,
            HOME_FAST_HELP_REASON_FALLBACKS[ranked.reason],
          ),
      onClick: () => {
        rememberHomeFastHelpUse(ranked.id);
        action.onClick();
      },
    }];
  });
  const contextualFastHelpImpressionFingerprint = [
    profile?.profileId ?? "browser",
    HOME_FAST_HELP_RANKING_VERSION,
    ...contextualFastHelpRanking.map((ranked) => ranked.id),
  ].join(":");

  useEffect(() => {
    const existingId = fastHelpImpressionIdsByFingerprintRef.current.get(contextualFastHelpImpressionFingerprint);
    if (existingId) {
      activeFastHelpImpressionIdRef.current = existingId;
      return;
    }
    const impression = recordHomeFastHelpImpression({
      actionIds: contextualFastHelpRanking.map((ranked) => ranked.id),
      rankingVersion: HOME_FAST_HELP_RANKING_VERSION,
      profileId: profile?.profileId,
    });
    activeFastHelpImpressionIdRef.current = impression?.id ?? null;
    if (impression) {
      fastHelpImpressionIdsByFingerprintRef.current.set(contextualFastHelpImpressionFingerprint, impression.id);
    }
  }, [contextualFastHelpImpressionFingerprint, contextualFastHelpRanking, profile?.profileId]);
  const homeMasterFastHelpActionsWithStatus = contextualHomeMasterFastHelpActions;
  const conciergeCompletedCanvasCopy = conciergeCanvasExplainability("completed", language === "es");
  const conciergeRightNowNudge = activeConciergeHomeTask ? (
    <div
      data-testid="card-home-concierge-resume"
      data-resume-kind={homeResumeCandidate?.kind}
      className="w-full min-w-0 rounded-[22px] border border-[#BBF7D0] bg-[linear-gradient(135deg,#F8FFFC_0%,#FFFFFF_52%,#F4FDF8_100%)] p-3 text-left shadow-[0_12px_28px_rgba(4,120,87,0.08)] min-[390px]:p-4"
      aria-label={`${conciergeHomeKickerText}: ${activeConciergeTitleText}. ${activeConciergeShowVyvaTask ? activeConciergeTaskText : activeConciergeWaitingText}`}
    >
      <div className="flex min-w-0 items-center gap-3 min-[390px]:gap-4">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-[#ECFDF5] text-[#047857] min-[390px]:h-[54px] min-[390px]:w-[54px]">
          <ConciergeBell size={24} strokeWidth={2.55} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.13em] text-[#047857]">
            {conciergeHomeKickerText}
          </span>
          <span className="mt-0.5 block truncate font-body text-[16px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[18px]">
            {activeConciergeTitleText}
          </span>
          <span className="mt-0.5 block truncate font-body text-[13px] font-bold leading-tight text-vyva-text-2 min-[390px]:text-[14px]">
            {activeConciergeShowVyvaTask
              ? `${activeConciergeShowVyvaSourceText} · ${activeConciergeTaskText}`
              : activeConciergeWaitingText}
          </span>
          {activeConciergeCanvasCopy ? (
            <span
              className="mt-1 block line-clamp-2 font-body text-[12px] font-bold leading-tight text-[#115E59]"
              data-testid="text-home-concierge-state-explanation"
            >
              {activeConciergeCanvasCopy.stateExplanation}
            </span>
          ) : null}
          {activeConciergeCanvasCopy && activeConciergeCanvasState?.state !== "completed" ? (
            <span
              className="mt-1 block line-clamp-1 font-body text-[12px] font-bold leading-tight text-[#0F766E]"
              data-testid="text-home-concierge-safety-rule"
            >
              {activeConciergeCanvasCopy.safetyRule}
            </span>
          ) : null}
          {activeConciergeShowVyvaSummary ? (
            <span className="mt-1 block line-clamp-1 font-body text-[12px] font-bold leading-tight text-vyva-text-3">
              {activeConciergeShowVyvaSummary}
            </span>
          ) : null}
        </span>
      </div>
      <div className={`mt-3 grid gap-2 ${activeConciergeWaitingOnProvider ? "grid-cols-3" : "grid-cols-1"}`}>
        <button
          type="button"
          data-testid="button-home-concierge-open"
          onClick={() => openActiveConciergeTask()}
          className="vyva-tap min-h-[42px] rounded-full bg-white px-3 font-body text-[12px] font-black text-[#047857] shadow-[0_8px_18px_rgba(4,120,87,0.08)] transition-transform hover:-translate-y-0.5 min-[390px]:text-[13px]"
        >
          {t("home.conciergeResume.openShort", "Open")}
        </button>
        {activeConciergeWaitingOnProvider ? (
          <>
            <button
              type="button"
              data-testid="button-home-concierge-follow-up"
              onClick={() => openActiveConciergeTask("follow_up")}
              className="vyva-tap min-h-[42px] rounded-full bg-[#ECFDF5] px-3 font-body text-[12px] font-black text-[#047857] transition-transform hover:-translate-y-0.5 min-[390px]:text-[13px]"
            >
              {t("home.conciergeResume.followUp", "Follow up")}
            </button>
            <button
              type="button"
              data-testid="button-home-concierge-got-reply"
              onClick={() => openActiveConciergeTask("reply")}
              className="vyva-tap min-h-[42px] rounded-full bg-[#F5F3FF] px-3 font-body text-[12px] font-black text-vyva-purple transition-transform hover:-translate-y-0.5 min-[390px]:text-[13px]"
            >
              {t("home.conciergeResume.gotReply", "I got a reply")}
            </button>
          </>
        ) : null}
      </div>
    </div>
  ) : null;
  const conciergeReuseNudge = reusableConciergeHomeTask && reusableConciergeReceipt ? (
    <div
      data-testid="card-home-concierge-reuse"
      className="w-full min-w-0 rounded-[22px] border border-[#DDD6FE] bg-[linear-gradient(135deg,#FFFFFF_0%,#FBF8FF_100%)] p-3 text-left shadow-[0_12px_28px_rgba(107,33,168,0.07)] min-[390px]:p-4"
    >
      <div className="flex min-w-0 items-center gap-3 min-[390px]:gap-4">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-[#F5F3FF] text-vyva-purple min-[390px]:h-[54px] min-[390px]:w-[54px]">
          <PackageCheck size={24} strokeWidth={2.55} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.13em] text-vyva-purple">
            {t("home.conciergeReuse.kicker", "Useful again")}
          </span>
          <span
            className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 font-body text-[10px] font-black uppercase tracking-[0.08em] text-[#047857]"
            data-testid="badge-home-concierge-completed-state"
          >
            {conciergeCompletedCanvasLabel(language === "es")}
          </span>
          <span className="mt-0.5 block truncate font-body text-[16px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[18px]">
            {t("home.conciergeReuse.title", "Use last {{task}} again", {
              task: conciergeCompletedHomeTaskLabel(reusableConciergeHomeTask, t),
            })}
          </span>
          <span className="mt-0.5 block truncate font-body text-[13px] font-bold leading-tight text-vyva-text-2 min-[390px]:text-[14px]">
            {reusableConciergeReceipt.subjectValue}
          </span>
          <span className="mt-1 block line-clamp-1 font-body text-[12px] font-bold leading-tight text-[#115E59]" data-testid="text-home-concierge-reuse-explanation">
            {conciergeCompletedCanvasCopy.stateExplanation}
          </span>
          <span className="mt-1 block line-clamp-1 font-body text-[12px] font-bold leading-tight text-[#115E59]" data-testid="text-home-concierge-receipt-status">
            {t("home.conciergeReuse.receiptStatus", "Receipt: {{status}}", { status: reusableConciergeReceipt.statusLabel })}
          </span>
        </span>
      </div>

      {conciergeReceiptDetailsOpen ? (
        <div className="mt-3 rounded-[18px] border border-[#E9D5FF] bg-white px-3 py-2" data-testid="panel-home-concierge-receipt-details">
          <p className="font-body text-[12px] font-black text-vyva-text-1">
            {reusableConciergeReceipt.whatVyvaDid}
          </p>
          <p className="mt-1 font-body text-[12px] font-bold text-vyva-text-2">
            {reusableConciergeReceipt.nextStep}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reusableConciergeReceipt.details.slice(0, 3).map((detail) => (
              <span key={detail.key} className="rounded-full bg-[#F8F5FF] px-2 py-1 font-body text-[11px] font-black text-vyva-text-2">
                {detail.label}: {detail.value}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="button-home-concierge-use-template"
          onClick={() => handleNavigate("/concierge", {
            state: {
              conciergeCompletedTemplate: conciergeCompletedHomeTemplate(reusableConciergeHomeTask),
            },
          })}
          className="vyva-tap inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-white px-3 font-body text-[12px] font-black text-vyva-purple shadow-[0_8px_18px_rgba(107,33,168,0.08)] transition-transform hover:-translate-y-0.5 min-[390px]:text-[13px]"
        >
          {t("home.conciergeReuse.action", "Use template")}
          <ChevronRight size={16} strokeWidth={2.6} aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid="button-home-concierge-show-receipt"
          onClick={() => setConciergeReceiptDetailsOpen((open) => !open)}
          className="vyva-tap inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-[#F5F3FF] px-3 font-body text-[12px] font-black text-vyva-purple transition-transform hover:-translate-y-0.5 min-[390px]:text-[13px]"
        >
          {conciergeReceiptDetailsOpen
            ? t("home.conciergeReuse.hideDetails", "Hide details")
            : t("home.conciergeReuse.showDetails", "Show details")}
          {conciergeReceiptDetailsOpen
            ? <ChevronUp size={16} strokeWidth={2.6} aria-hidden="true" />
            : <ChevronDown size={16} strokeWidth={2.6} aria-hidden="true" />}
        </button>
      </div>
    </div>
  ) : null;
  const latestPendingShowVyvaReview = showVyvaReviewHistory.find((item) => !item.actionSaved) ?? null;
  const showVyvaReviewNudge = latestPendingShowVyvaReview ? (
    <button
      type="button"
      data-testid="card-home-show-vyva-review-resume"
      onClick={() => handleNavigate(latestPendingShowVyvaReview.resumeRoute, {
        state: {
          showVyvaReviewHistoryId: latestPendingShowVyvaReview.id,
          showVyvaResume: true,
        },
      })}
      className="vyva-tap flex w-full min-w-0 items-center gap-3 rounded-[22px] border border-[#BFE7E1] bg-[linear-gradient(135deg,#F8FFFC_0%,#FFFFFF_58%,#F7FBFF_100%)] p-3 text-left shadow-[0_12px_28px_rgba(15,118,110,0.08)] transition-transform hover:-translate-y-0.5 min-[390px]:gap-4 min-[390px]:p-4"
      aria-label={`${t("home.showVyvaReviewResume.kicker", "Recent Show VYVA")}: ${latestPendingShowVyvaReview.decision}`}
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-[#F0FDFA] text-[#0F766E] min-[390px]:h-[54px] min-[390px]:w-[54px]">
        <ShieldCheck size={24} strokeWidth={2.45} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[11px] font-black uppercase tracking-[0.13em] text-[#0F766E]">
          {t("home.showVyvaReviewResume.kicker", "Recent Show VYVA")}
        </span>
        <span className="mt-0.5 block truncate font-body text-[16px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[18px]">
          {t("home.showVyvaReviewResume.title", "Continue this review")}
        </span>
        <span className="mt-0.5 block truncate font-body text-[13px] font-bold leading-tight text-vyva-text-2 min-[390px]:text-[14px]">
          {latestPendingShowVyvaReview.decision}
        </span>
        <span className="mt-1 block line-clamp-1 font-body text-[12px] font-bold leading-tight text-vyva-text-3">
          {latestPendingShowVyvaReview.summary}
        </span>
      </span>
      <span className="hidden flex-shrink-0 rounded-full bg-white px-3 py-2 font-body text-[12px] font-black text-[#0F766E] shadow-[0_8px_18px_rgba(15,118,110,0.08)] min-[390px]:inline-flex">
        {t("home.showVyvaReviewResume.action", "Open")}
      </span>
      <ChevronRight size={24} strokeWidth={2.6} className="flex-shrink-0 text-[#0F766E]" aria-hidden="true" />
    </button>
  ) : null;
  const recoveryAction = recoveryNudge
    ? homeMasterFastHelpActionById.get(recoveryNudge.journey.actionId)
    : null;
  const continueRecoveryNudge = () => {
    if (!recoveryNudge) return;
    if (recoveryNudge.kind !== "transport_provider") {
      continueHomeFastHelp(recoveryNudge.journey, undefined, true);
      return;
    }

    const resumed = resumeHomeFastHelpJourney(recoveryNudge.journey, homeFastHelpJourneyKey, {
      reason: "recovery_nudge",
      referenceId: HOME_FAST_HELP_RECOVERY_REFERENCE_ID,
    });
    const context = homeFastHelpContextForJourney(resumed, homeFastHelpJourneyKey);
    const destinationState = resumed.destinationState ?? resumedHomeFastHelpState(resumed.actionId) ?? {};
    const conciergePrefill = destinationState.conciergePrefill && typeof destinationState.conciergePrefill === "object"
      ? destinationState.conciergePrefill as Record<string, unknown>
      : {};
    const message = typeof conciergePrefill.message === "string"
      ? conciergePrefill.message
      : t("home.fastHelp.ridePrefill", "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation.");
    handleNavigate("/onboarding/profile/providers", {
      state: {
        returnTo: "/concierge",
        returnState: withHomeFastHelpContextState(context, destinationState),
        setupFocus: "transport",
        setupFlow: CONCIERGE_FLOW_REFERENCES.transportBooking,
        setupReason: "Add a saved transport provider",
        conciergeResume: {
          kind: "transport",
          message,
          pickup: "",
          destination: "",
          time: "now",
          mobilityNeeds: [],
        },
        notice: t(
          "home.recoveryNudge.transportSetupNotice",
          "Save a trusted taxi or transport provider, then continue your ride.",
        ),
      },
    });
    setHomeFastHelpJourneys(readHomeFastHelpJourneys(homeFastHelpJourneyKey));
  };
  const deferRecoveryNudge = () => {
    if (!recoveryNudge) return;
    markHomeFastHelpJourney(
      homeFastHelpContextForJourney(recoveryNudge.journey, homeFastHelpJourneyKey),
      "abandoned",
      { reason: "recovery_later" },
    );
    setHomeFastHelpJourneys(readHomeFastHelpJourneys(homeFastHelpJourneyKey));
  };
  const dismissRecoveryNudge = () => {
    if (!recoveryNudge) return;
    markHomeFastHelpJourney(
      homeFastHelpContextForJourney(recoveryNudge.journey, homeFastHelpJourneyKey),
      "dismissed",
      { reason: "recovery_dismissed" },
    );
    setHomeFastHelpJourneys(readHomeFastHelpJourneys(homeFastHelpJourneyKey));
  };
  const fastHelpRecoveryNudge = recoveryNudge && recoveryAction ? (
    <div
      data-testid="card-home-fast-help-recovery"
      data-resume-kind={homeResumeCandidate?.kind}
      className="w-full min-w-0 rounded-[22px] border border-[#DDD6FE] bg-white p-3 shadow-[0_12px_28px_rgba(107,33,168,0.07)] min-[390px]:p-4"
    >
      <div className="flex min-w-0 items-center gap-3 min-[390px]:gap-4">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-[#F5F3FF] text-vyva-purple min-[390px]:h-[54px] min-[390px]:w-[54px]">
          <History size={25} strokeWidth={2.45} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[16px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[18px]">
            {recoveryNudge.kind === "transport_provider"
              ? t("home.recoveryNudge.transportSetupTitle", "One quick setup first")
              : recoveryNudge.kind === "blocked"
                ? t("home.recoveryNudge.blockedTitle", "One quick step first")
                : t("home.recoveryNudge.title", "Continue where you left off")}
          </span>
          <span className="mt-1 block font-body text-[13px] font-bold leading-snug text-vyva-text-2 min-[390px]:text-[14px]">
            {recoveryNudge.kind === "transport_provider"
              ? t("home.recoveryNudge.transportSetupDetail", "Add a trusted transport provider to continue your ride.")
              : recoveryNudge.kind === "blocked"
                ? t("home.recoveryNudge.blockedDetail", "Open {{action}} to see what is needed.", { action: recoveryAction.label })
                : t("home.recoveryNudge.detail", "Continue {{action}} when you are ready.", { action: recoveryAction.label })}
          </span>
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          data-testid="button-home-fast-help-recovery-continue"
          onClick={continueRecoveryNudge}
          className="vyva-tap min-h-[44px] rounded-full bg-vyva-purple px-2 font-body text-[12px] font-black text-white shadow-[0_8px_18px_rgba(107,33,168,0.14)] min-[390px]:text-[13px]"
        >
          {t("home.recoveryNudge.continue", "Continue")}
        </button>
        <button
          type="button"
          data-testid="button-home-fast-help-recovery-later"
          onClick={deferRecoveryNudge}
          className="vyva-tap min-h-[44px] rounded-full border border-[#DDD6FE] bg-[#F8F6FF] px-2 font-body text-[12px] font-black text-vyva-purple min-[390px]:text-[13px]"
        >
          {t("home.recoveryNudge.later", "Later")}
        </button>
        <button
          type="button"
          data-testid="button-home-fast-help-recovery-dismiss"
          onClick={dismissRecoveryNudge}
          className="vyva-tap min-h-[44px] rounded-full border border-[#E9E3DE] bg-white px-2 font-body text-[12px] font-black text-vyva-text-2 min-[390px]:text-[13px]"
        >
          {t("home.recoveryNudge.dismiss", "Dismiss")}
        </button>
      </div>
    </div>
  ) : null;
  const nextReadableTextSizeLabel = isReadableTextLarge
    ? t("home.profileMenu.normal", "Normal")
    : t("home.profileMenu.large", "Large");
  const nextThemeLabel = isHomeMasterDark
    ? t("home.profileMenu.light", "Light")
    : t("home.profileMenu.dark", "Dark");
  const nextModeLabel = homeInteractionMode === "voice"
    ? t("home.profileMenu.touch", "Touch")
    : t("home.profileMenu.voice", "Voice");
  const NextModeIcon = homeInteractionMode === "voice" ? Hand : Mic;
  const homeProfileMenuLinks: Array<{
    label: string;
    detail: string;
    path: string;
    icon: LucideIcon;
    testId: string;
    tone: string;
    darkTone: string;
  }> = [
    {
      label: t("home.profileMenu.account", "Account details"),
      detail: t("home.profileMenu.accountDetail", "Name, phone, language"),
      path: "/settings/account",
      icon: UserRound,
      testId: "button-home-profile-account",
      tone: "bg-[#F5F3FF] text-vyva-purple",
      darkTone: "bg-[#7C3AED]/20 text-[#D8B4FE] ring-1 ring-inset ring-[#C4B5FD]/20",
    },
    {
      label: t("home.profileMenu.health", "Health profile"),
      detail: t("home.profileMenu.healthDetail", "Conditions and basics"),
      path: "/onboarding/profile/health",
      icon: Heart,
      testId: "button-home-profile-health",
      tone: "bg-[#FFF1F2] text-[#E74C43]",
      darkTone: "bg-[#FB7185]/16 text-[#FDA4AF] ring-1 ring-inset ring-[#FDA4AF]/18",
    },
    {
      label: t("home.profileMenu.medications", "My Medication"),
      detail: t("home.profileMenu.medicationsDetail", "Current medications"),
      path: "/onboarding/profile/medications",
      icon: Pill,
      testId: "button-home-profile-medications",
      tone: "bg-[#FEF3C7] text-[#A16207]",
      darkTone: "bg-[#F59E0B]/18 text-[#FDE68A] ring-1 ring-inset ring-[#FDE68A]/18",
    },
    {
      label: t("home.profileMenu.emergency", "Emergency contact"),
      detail: t("home.profileMenu.emergencyDetail", "Who to call if needed"),
      path: "/onboarding/profile/emergency",
      icon: ShieldCheck,
      testId: "button-home-profile-emergency",
      tone: "bg-[#FFE4E6] text-[#E11D48]",
      darkTone: "bg-[#F43F5E]/18 text-[#FDA4AF] ring-1 ring-inset ring-[#FDA4AF]/18",
    },
    {
      label: t("home.profileMenu.careTeam", "Care team"),
      detail: t("home.profileMenu.careTeamDetail", "Family and contacts"),
      path: "/onboarding/profile/care-team",
      icon: Users,
      testId: "button-home-profile-care-team",
      tone: "bg-[#EFF6FF] text-[#2F66D0]",
      darkTone: "bg-[#3B82F6]/18 text-[#BFDBFE] ring-1 ring-inset ring-[#BFDBFE]/18",
    },
    {
      label: t("home.profileMenu.providers", "Doctors & providers"),
      detail: t("home.profileMenu.providersDetail", "Clinics and trusted help"),
      path: "/onboarding/profile/providers",
      icon: Stethoscope,
      testId: "button-home-profile-providers",
      tone: "bg-[#ECFDF5] text-[#149A63]",
      darkTone: "bg-[#10B981]/18 text-[#A7F3D0] ring-1 ring-inset ring-[#A7F3D0]/18",
    },
  ];
  const homeProfileMenu = homeProfileMenuOpen ? (
    <div className="fixed inset-0 z-[80]" data-testid="home-profile-menu-layer">
      <button
        type="button"
        data-testid="button-home-profile-menu-backdrop"
        className={[
          "absolute inset-0 cursor-default bg-transparent md:backdrop-blur-[3px]",
          isHomeMasterDark ? "md:bg-black/35" : "md:bg-[#2D1748]/15",
        ].join(" ")}
        aria-label={t("home.profileMenu.close", "Close profile menu")}
        onClick={() => setHomeProfileMenuOpen(false)}
      />
      <section
        id="home-profile-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t("home.profileMenu.title", "Profile & settings")}
        data-testid="home-profile-menu"
        className={[
          "absolute left-1/2 top-[88px] max-h-[calc(100svh-110px)] w-[calc(100vw-44px)] max-w-[348px] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[30px] border p-3 text-left backdrop-blur-2xl sm:top-[92px] sm:max-w-[366px] md:top-1/2 md:max-h-[calc(100svh-96px)] md:max-w-[720px] md:-translate-y-1/2 md:rounded-[32px] md:p-5",
          isHomeMasterDark
            ? "border-white/[0.12] bg-[#170C2A] text-[#FFF8FF] shadow-[0_28px_80px_rgba(0,0,0,0.28)]"
            : "border-[#EFE4F6] bg-white/[0.96] text-[var(--vyva-ink)] shadow-[0_24px_70px_rgba(67,36,95,0.16)]",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3 px-1 pb-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[18px] bg-[linear-gradient(145deg,#F8F4FF_0%,#EFE5FF_100%)] text-vyva-purple shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(107,33,168,0.10)]">
              <span className="font-display text-[22px] font-semibold leading-none" aria-hidden="true">
                {firstName ? firstName.charAt(0).toLocaleUpperCase(language) : "Y"}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[22px] font-semibold leading-none">
                {t("home.profileMenu.title", "Profile & settings")}
              </span>
              <span className={["mt-1 block font-body text-[11.5px] font-extrabold leading-snug", isHomeMasterDark ? "text-[#DCCFEF]" : "text-[#8F8192]"].join(" ")}>
                {t("home.profileMenu.subtitle", "Update health, contacts, and display.")}
              </span>
            </span>
          </div>
          <button
            type="button"
            data-testid="button-home-profile-menu-close"
            aria-label={t("home.profileMenu.close", "Close profile menu")}
            onClick={() => setHomeProfileMenuOpen(false)}
            className={["vyva-tap grid h-10 !min-h-10 w-10 flex-shrink-0 place-items-center rounded-full", isHomeMasterDark ? "bg-white/10 text-[#F6F0FF]" : "bg-[#F8F5FF] text-[#6B5173]"].join(" ")}
          >
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-2 grid gap-1.5 md:grid-cols-2 md:gap-3" data-testid="home-profile-menu-links">
          {homeProfileMenuLinks.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                data-testid={item.testId}
                onClick={() => handleProfileMenuNavigate(item.path)}
                className={[
                  "vyva-tap flex min-h-[60px] w-full items-center gap-2.5 rounded-[21px] border px-3 py-2 text-left transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 md:min-h-[72px] md:px-4",
                  isHomeMasterDark ? "border-white/[0.10] bg-white/[0.06]" : "border-[#F0E8F5] bg-white shadow-[0_8px_22px_rgba(67,36,95,0.05)]",
                ].join(" ")}
              >
                <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full ${isHomeMasterDark ? item.darkTone : item.tone}`}>
                  <Icon size={19} strokeWidth={2.25} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[19px] font-semibold leading-none">
                    {item.label}
                  </span>
                  <span className="sr-only">
                    {item.detail}
                  </span>
                </span>
                <ChevronRight size={20} strokeWidth={2.55} className={isHomeMasterDark ? "text-[#DCCFEF]" : "text-[#B6AAB8]"} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div className={["my-3 h-px", isHomeMasterDark ? "bg-white/[0.10]" : "bg-[#EFE4F6]"].join(" ")} />
        <p className={["px-2 pb-2 font-body text-[11px] font-black uppercase tracking-[0.16em]", isHomeMasterDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"].join(" ")}>
          {t("home.profileMenu.display", "Display preferences")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            data-testid="button-home-profile-text-size"
            onClick={toggleReadableTextSize}
            className={["vyva-tap flex min-h-[68px] flex-col items-center justify-center rounded-[19px] border px-2 text-center font-body text-[10.5px] font-black leading-tight", isHomeMasterDark ? "border-white/[0.10] bg-white/[0.07] text-[#F6F0FF]" : "border-[#EFE4F6] bg-[#FBF8FF] text-[#2D1748]"].join(" ")}
          >
            <ALargeSmall size={19} strokeWidth={2.35} aria-hidden="true" />
            <span className="mt-1">{t("home.profileMenu.textSize", "Text size")}</span>
            <span className={isHomeMasterDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"}>
              {nextReadableTextSizeLabel}
            </span>
          </button>
          <button
            type="button"
            data-testid="button-home-profile-theme"
            onClick={toggleTheme}
            className={["vyva-tap flex min-h-[68px] flex-col items-center justify-center rounded-[19px] border px-2 text-center font-body text-[10.5px] font-black leading-tight", isHomeMasterDark ? "border-white/[0.10] bg-white/[0.07] text-[#F6F0FF]" : "border-[#EFE4F6] bg-[#FBF8FF] text-[#2D1748]"].join(" ")}
          >
            {isHomeMasterDark ? <Sun size={18} strokeWidth={2.35} aria-hidden="true" /> : <Moon size={18} strokeWidth={2.35} aria-hidden="true" />}
            <span className="mt-1">{t("home.profileMenu.theme", "Theme")}</span>
            <span className={isHomeMasterDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"}>
              {nextThemeLabel}
            </span>
          </button>
          <button
            type="button"
            data-testid="button-home-profile-mode"
            onClick={switchHomeModeFromProfileMenu}
            className={["vyva-tap flex min-h-[68px] flex-col items-center justify-center rounded-[19px] border px-2 text-center font-body text-[10.5px] font-black leading-tight", isHomeMasterDark ? "border-white/[0.10] bg-white/[0.07] text-[#F6F0FF]" : "border-[#EFE4F6] bg-[#FBF8FF] text-[#2D1748]"].join(" ")}
          >
            <NextModeIcon size={18} strokeWidth={2.35} aria-hidden="true" />
            <span className="mt-1">{t("home.profileMenu.mode", "Mode")}</span>
            <span className={isHomeMasterDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"}>
              {nextModeLabel}
            </span>
          </button>
        </div>
      </section>
    </div>
  ) : null;
  // Home master design: latest VYVA wordmark header, greeting, dormant voice orb, four app-mode
  // shortcuts, and no extra Fast Help/nudge blocks on the landing screen.
  return (
    <MasterDashboardLayout
      testId="home-master-layout"
      cardGridTestId="home-pillar-cards"
      fastHelpTestId="home-fast-help"
      launcherVariant="homeMaster"
      intentLayer={homeIntentLayer !== "home"}
      presentationAttributes={homePresentation.dataAttributes}
      showHero={showHomeMasterHero}
      showCards={showHomeMasterCards}
      modeSwitcher={(
        <div className="mb-4 mt-0 min-[390px]:mb-5 sm:mb-8">
          <HomeMasterTopbar
            className={[
              "mb-4 min-[390px]:mb-5",
              isHomeMasterDark ? "text-[#FFF8FF]" : "text-[var(--vyva-ink)]",
            ].join(" ")}
            testId="home-topbar"
          >
            <HomeMasterProfileControl
              isDark={isHomeMasterDark}
              ariaLabel={t("home.profileMenu.open", "Open profile and settings")}
              testId="button-home-profile"
              onClick={() => setHomeProfileMenuOpen(true)}
              expanded={homeProfileMenuOpen}
              controls={homeProfileMenuOpen ? "home-profile-menu" : undefined}
            />
            <span data-testid="home-dayline" aria-hidden="true" />
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full sm:h-10 sm:w-10"
              data-testid="home-topbar-action-pill"
            >
              <HomeMasterActionControl
                isDark={isHomeMasterDark}
                icon={Hand}
                ariaLabel={t("home.mode.openManual", "Open manual menu")}
                onClick={() => handleHomeShellNavigate(menuPath)}
                testId="button-home-mode-touch"
              />
            </div>
          </HomeMasterTopbar>
          {homeProfileMenu}
          {showHomeMasterCards ? (
            <div className="px-3 text-center">
              <h1
                data-testid="home-touch-heading"
                className={[
                  "font-display text-[32px] font-semibold leading-[1.02] min-[390px]:text-[35px] sm:text-[42px]",
                  isHomeMasterDark ? "text-[#FFF8FF]" : "text-[var(--vyva-ink)]",
                ].join(" ")}
              >
                {activeIntentTitle}
              </h1>
              {homePresentation.showHeadingDetail && homeMasterHeroSubtitle ? (
                <p
                  data-testid="home-touch-subheading"
                  className={[
                    "mx-auto mt-2 hidden max-w-[19rem] font-body text-[15px] font-bold leading-snug min-[390px]:text-[16px] sm:block sm:max-w-[28rem] sm:text-[18px]",
                    isHomeMasterDark ? "text-[#E8DDF3]" : "text-[#6C5369]",
                  ].join(" ")}
                >
                  {homeMasterHeroSubtitle}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      isDarkMode={isHomeMasterDark}
      cardSectionTitle={homeMasterCardSectionTitle}
      cardSectionDescription={homeMasterCardSectionDescription}
      cardSectionMoreLabel={homeMasterMoreLabel}
      cardSectionMoreCompactLabel={homeMasterMoreCompactLabel}
      onCardSectionMore={homeMasterMoreRoute ? () => handleNavigate(homeMasterMoreRoute) : undefined}
      cardSectionMoreTestId={homeIntentLayer !== "home" ? `button-home-${homeIntentLayer}-more` : undefined}
      fastHelpTitle={t("home.fastHelp.kicker", "Fast help")}
      hero={{
        icon: MessageCircle,
        eyebrow: t("home.master.heroEyebrow", "Today"),
        title: homeMasterGreetingText,
        subtitle: homeMasterHeroSubtitle,
        subtitleTone: showHomeVoiceFirstUseHint ? "gold" : "default",
        action: {
          kind: "voice",
          label: t("home.mode.voiceCta", "Talk to VYVA"),
          supportingLabel: t("home.master.voiceSupport", "Touch the orb to begin."),
          contextHint: `${t("home.master.voiceContext", "Home screen. Ask what the user needs and help them choose the safest next step.")} Current home context: ${selectedHomeContextMessage?.spokenText ?? selectedHomeContextMessage?.title ?? ""}`,
          voiceAgentSlug: "main-vyva",
          voiceDynamicVariables: {
            app_entrypoint: "home_master_hero",
            home_context_kind: selectedHomeContextMessage?.kind ?? "default",
            home_context_message: selectedHomeContextMessage?.spokenText ?? selectedHomeContextMessage?.title ?? "",
            home_context_decision_reason: selectedHomeContextDecision?.reason ?? "default_greeting",
            home_context_decision_score: String(selectedHomeContextDecision?.score ?? 0),
          },
          autoStartListening: true,
          testId: "button-home-hero-talk",
          onFirstVoiceOrbActivation: () => setShowVoiceOrbFirstUseHint(false),
        },
        testId: "home-master-hero",
        messageActionLabel: undefined,
        onMessageAction: undefined,
        onMessageDismiss: undefined,
        messageDismissLabel: undefined,
        tone: {
          iconBg: "#F5F3FF",
          iconColor: "#6B21A8",
          border: "#DDD6FE",
          surface: "#FFFFFF",
        },
      }}
      cards={homeMasterVisibleCards}
      fastHelpActions={homeMasterFastHelpActionsWithStatus}
      beforeFastHelp={activeHomeRefillAlert || activeCompletionAction ? (
        <div className="flex flex-col gap-4">
          {activeHomeRefillAlert ? (
            <MedicationRefillAlertCard
              alert={activeHomeRefillAlert}
              canManage={refillAlertHomeSignal?.permissions.manage_inventory !== false}
              onOpen={() => handleNavigate("/meds/refills")}
              testId="home-refill-alert"
            />
          ) : null}
          {activeCompletionAction ? (
            <CrossPillarSubflowCanvas
              actionId={activeCompletionAction}
              onContinue={continueCrossPillarSubflow}
              onCancel={() => setHomeSubflow(null)}
            />
          ) : null}
        </div>
      ) : null}
    />
  );
};

export default HomeScreen;
