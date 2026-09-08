import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Loader2,
  ConciergeBell,
  Car,
  Calendar,
  Wrench,
  Search,
  Tag,
  Map,
  MapPin,
  FileText,
  Sparkles,
  BellRing,
  Eye,
  ShieldCheck,
  PhoneCall,
  CircleCheck,
  ExternalLink,
  Camera,
  FileUp,
  Mic,
  PackageCheck,
  ShoppingBasket,
  Pill,
  PiggyBank,
  Building2,
  PencilLine,
  Zap,
  X,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Square,
  Scale,
  HeartHandshake,
  Home,
  AlertTriangle,
  UserRound,
  Users,
  Mail,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ActionCard,
  PurpleModal,
  PurpleModalHeader,
  PurpleModalOption,
  PurpleModalSectionLabel,
  ResponsiveGrid,
  VYVA_MODAL_PRIMARY_ACTION_CLASS,
  VYVA_MODAL_SECONDARY_ACTION_CLASS,
} from "@/components/vyva-ui";
import VoiceHero from "@/components/VoiceHero";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import ActionConfirmationCheckpoint from "@/components/concierge/ActionConfirmationCheckpoint";
import ActionReadinessPanel from "@/components/concierge/ActionReadinessPanel";
import {
  ConciergeHomeTaskOverview,
  ConciergeTaskWorkspaceHeader,
} from "@/components/concierge/ConciergeTaskNavigation";
import {
  AppointmentVoiceCanvas,
  ProviderReplyVoiceCanvas,
  RideVoiceCanvas,
  type AppointmentCanvasCopy,
  type AppointmentCanvasDraft,
  type AppointmentCanvasState,
  type ProviderReplyCanvasCopy,
  type ProviderReplyCanvasDraft,
  type RideCanvasCopy,
  type RideCanvasDraft,
  type RideCanvasState,
  isAppointmentCanvasEnabled,
  isHomeServiceCanvasEnabled,
  isProviderReplyCanvasEnabled,
  isRestorableHomeServiceRequestStatus,
  isRideCanvasEnabled,
  parseAppointmentCanvasRolloutConfig,
  parseHomeServiceCanvasRolloutConfig,
  parseProviderReplyCanvasRolloutConfig,
  parseRideCanvasRolloutConfig,
  trackAppointmentCanvasEvent,
  trackProviderReplyCanvasEvent,
  trackRideCanvasEvent,
  useCanvasExternalActionGate,
} from "@/components/voice-canvas";
import ProviderComparisonPanel from "@/components/ProviderComparisonPanel";
import ProviderShortlistFollowUpPanel from "@/components/ProviderShortlistFollowUpPanel";
import MasterDashboardLayout, {
  type MasterDashboardCard,
  type MasterFastHelpAction,
} from "@/components/MasterDashboardLayout";
import { useRouteVoiceAutoStart } from "@/hooks/useRouteVoiceAutoStart";
import { useVoiceActionFulfillment } from "@/hooks/useVoiceActionFulfillment";
import { useVoiceCanvasController } from "@/hooks/useVoiceCanvasController";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import {
  getTrustedHelpMissionPresentation,
  getTrustedHelpMissionStatusLabel,
  type TrustedHelpMissionPresentation,
} from "@/design/conciergeTrustedHelpPresentationMap";
import {
  coerceConciergeTaskEntry,
  conciergeTaskEntrySummary,
  conciergeTaskEntryTitle,
  conciergeTaskInboxItemPath,
  conciergeTaskPath,
  type ConciergeTaskEntry,
  type ConciergeTaskStage,
} from "@/lib/conciergeTaskNavigation";
import {
  ConciergeTaskNoLongerActiveError,
  createConciergeTaskDraft,
  deleteConciergeTaskDraft,
  fetchConciergeTaskDraft,
  isPersistedConciergeTaskId,
  listConciergeTaskDrafts,
  updateConciergeTaskDraft,
  type ConciergeTaskDraft,
  type ConciergeTaskProgressPayload,
  type PersistedConciergeTaskStage,
} from "@/lib/conciergeTaskDrafts";
import { emergencyContactForCountry, sanitizePhoneHref } from "@/lib/emergencyContacts";
import {
  buildConciergeAppointmentCanvasViewModel,
  type ConciergeAppointmentCanvasCopy,
  type ConciergeAppointmentCanvasOption,
  type ConciergeAppointmentCanvasStep,
} from "@/lib/conciergeAppointmentCanvas";
import {
  buildConciergeRideCanvasViewModel,
  type ConciergeRideCanvasCopy,
  type ConciergeRideCanvasStep,
  type ConciergeRideCanvasOption,
} from "@/lib/conciergeRideCanvas";
import {
  buildConciergeHomeServiceCanvasViewModel,
  homeServiceCanvasCopy,
  type ConciergeHomeServiceCanvasOption,
  type ConciergeHomeServiceCanvasStep,
} from "@/lib/conciergeHomeServiceCanvas";
import {
  clearVoiceCanvasScene,
  voiceCanvasResponseMatchesScene,
  VYVA_VOICE_CANVAS_RESPONSE_EVENT,
  type VoiceCanvasResponseDetail,
} from "@/lib/voiceCanvasBridge";
import {
  buildHomeServiceIntake,
  homeServiceAddressFromPreferences,
  homeServiceIntakeFromPreferences,
  homeServiceQuestionsFor,
  homeServiceTypeLabel,
  HOME_SERVICE_TYPES,
  normalizeHomeServiceType,
  type HomeServiceQuestion,
  type HomeServiceType,
  type ServiceIntakeOrigin,
} from "../../shared/serviceIntake";
import {
  CONCIERGE_FLOW_REFERENCES,
  normalizeConciergeProviderCategory,
  providerSetupFocusForFlow,
  type ConciergeProviderCategoryId,
  type ConciergeFlowReference,
  type ConciergeToolRequirement,
} from "../../shared/conciergeFlowRegistry";
import {
  evaluateConciergeFlowRequirements,
  type ConciergeFlowRequirementKey,
} from "../../shared/conciergeFlowRequirements";
import { getConciergeFlowMap } from "../../shared/conciergeFlowAlignment";
import {
  evaluateConciergeToolReadiness,
  preferredToolFromTransportActions,
  toolFromAppointmentChannel,
  type ConciergeToolReadinessResult,
} from "../../shared/conciergeToolReadiness";
import type {
  ConciergeExecutionTask,
  ConciergeExecutionTaskStatus,
} from "../../shared/conciergeActionExecution";
import {
  conciergeCanvasExplainability,
  conciergeCanvasPrimaryActionDisplayLabel,
  deriveConciergeCanvasState,
} from "../../shared/conciergeCanvasState";
import { buildConciergeConfirmationReceipt } from "../../shared/conciergeConfirmationReceipt";
import {
  CONCIERGE_DRY_RUN_TEST_MODE,
  isConciergeDryRunPayload,
} from "../../shared/conciergeDryRun";
import {
  isShowVyvaPreparedTask,
  type ShowVyvaExecutionGuide,
  showVyvaExecutionGuide,
  showVyvaResumeActionLabel,
  showVyvaResumeSourceLabel,
  showVyvaResumeSummary,
} from "../../shared/showVyvaResume";
import {
  buildConciergeGuidedDetailCapture,
  type ConciergeGuidedDetailCapture,
  type ConciergeGuidedDetailQuestion,
} from "../../shared/conciergeGuidedDetails";
import {
  activeConciergeReconfirmationRequestFromPayload,
  type ConciergeReconfirmationRequest,
} from "../../shared/conciergeReconfirmation";
import {
  buildProviderComparisonOptions,
  buildProviderContactPlan,
  buildProviderContactPayload,
  buildProviderRecheckContext,
  buildProviderShortlistRecheckPayload,
  buildProviderShortlistPayload,
  buildTrustedProviderPrefill,
  parseProviderShortlistPayload,
  updateProviderShortlistPayload,
  type ProviderComparisonOption,
  type ProviderComparisonSourceOption,
  type ProviderRecheckContext,
  type ProviderShortlistState,
} from "../../shared/providerComparison";
import {
  selectConciergeSavedProvider,
  savedProviderIsTrusted,
} from "../../shared/conciergeSavedProviders";
import {
  buildConciergeProviderActionNeededPatch,
  buildConciergeProviderReplyPatch,
  conciergeProviderCompletionSummary,
  conciergeProviderReplySnapshot,
  type ConciergeProviderTaskStatus,
} from "../../shared/conciergeProviderReplies";
import {
  buildConciergeProviderReplyDecisionPatch,
  buildConciergeProviderReplyCompletionPayload,
  parseConciergeProviderReplyDecisionHistory,
  parseConciergeProviderReplyResolution,
  type ConciergeProviderReplyPrimaryAction,
  type ConciergeProviderReplyResolution,
} from "../../shared/conciergeProviderReplyResolution";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type ConciergeRoutePrefill = {
  kind: "ride" | "appointment" | "home_care_quote" | "task";
  message: string;
  flowReference?: ConciergeFlowReference;
  requestedTool?: ConciergeToolRequirement;
  actionLabel?: string;
  summary?: string;
  payload?: Record<string, unknown>;
  useCase?: "scam_check" | "admin_task" | "paperwork" | "send_message" | "find_offers" | "find_provider" | "shopping_request";
  providerSearchMode?: string;
  providerSearchCriteria?: string[];
  providerSearchQuery?: string;
  source?: "symptom_report" | "daily_checkin" | "shared_checkin" | "visual_scan" | "caregiver_alert" | "doctor_choice" | "adherence_report" | "medication_support" | "safe_home_scan" | "shopping_helper" | "shopping_recommendation" | "scam_guard" | "health_home_doctor" | "specialist_finder" | "vitals_safety" | "activity_support" | "home_quick_action" | "voice_action" | "show_vyva";
};

type ConciergeLocationState = {
  conciergeTaskEntry?: unknown;
  conciergePrefill?: unknown;
  conciergeCompletedTemplate?: unknown;
  conciergeProviderAction?: unknown;
  trustedProviderSaved?: unknown;
  providerSetupHelpRequested?: unknown;
  voiceActionPayload?: Record<string, unknown>;
  focusRightNow?: boolean;
  conciergePendingId?: unknown;
  crossPillarIdempotencyKey?: unknown;
} | null;

type ConciergeProviderRouteAction = {
  pendingId: string;
  mode: "follow_up" | "reply";
};

type ConciergeProviderResumeContext =
  | {
      kind: "transport";
      message?: string;
      pickup?: string;
      destination?: string;
      time?: string;
      mobilityNeeds?: string[];
      voiceCanvas?: boolean;
    }
  | {
      kind: "otc_pharmacy";
      itemText?: string;
      fulfillmentPreference?: "delivery" | "pickup";
      requestedTime?: string;
      notes?: string;
    }
  | {
      kind: "medical_appointment";
      appointmentType?: AppointmentType;
      note?: string;
      requestedTime?: string;
      coverageLabel?: string;
      voiceCanvas?: boolean;
    }
  | {
      kind: "home_service";
      serviceType?: HomeServiceType | null;
      origin?: ServiceIntakeOrigin;
      note?: string;
      answers?: Record<string, string>;
      textDrafts?: Record<string, string>;
      voiceCanvas?: boolean;
      photoName?: string;
    }
  | {
      kind: "provider_search";
      mode?: ProviderSearchMode | null;
      query?: string;
      criteria?: ProviderSearchCriterionKey[];
    }
  | {
      kind: "provider_shortlist";
      pendingId: string;
      preferredProviderId?: string;
    }
  | {
      kind: "generic";
      message?: string;
    };

type TrustedProviderSavedRoute = {
  name: string;
  category: ConciergeProviderCategoryId;
  conciergeResume: ConciergeProviderResumeContext | null;
};

type ProviderSetupHelpRequestedRoute = {
  setupReason: string;
  conciergeResume: ConciergeProviderResumeContext | null;
  helperName?: string;
};

type RoutePrefillHighlight = {
  label: string;
  value: string;
};

function scrollIntoViewIfAvailable(element: Element | null | undefined, options?: ScrollIntoViewOptions) {
  if (typeof element?.scrollIntoView === "function") {
    element.scrollIntoView(options);
  }
}

type ConciergeProfileSummary = {
  street?: string | null;
  cityState?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  savedProviders?: Array<{
    name?: string | null;
    role?: string | null;
    category?: string | null;
    phone?: string | null;
    email?: string | null;
    whatsapp?: string | null;
    bookingUrl?: string | null;
    booking_url?: string | null;
    preferredChannel?: string | null;
    preferred_channel?: string | null;
    address?: string | null;
    websiteUrl?: string | null;
    website_uri?: string | null;
    notes?: string | null;
    isTrusted?: boolean | null;
    isDefault?: boolean | null;
  }>;
  coverage?: CoverageReadinessSummary | null;
  serviceReadiness?: {
    hasSavedPharmacy?: boolean;
    hasSavedDoctor?: boolean;
    hasCoverageInfo?: boolean;
    hasSavedTransportProvider?: boolean;
    hasMobilityInfo?: boolean;
  };
};

type SavedConciergeProvider = NonNullable<ConciergeProfileSummary["savedProviders"]>[number];

type CoverageReadinessType = "public" | "private" | "mixed" | "self_pay" | "unknown";

type CoverageReadinessSummary = {
  coverageType?: string | null;
  provider?: string | null;
  memberId?: string | null;
  plan?: string | null;
  notes?: string | null;
};

const CONCIERGE_ROUTE_PREFILL_KINDS = ["ride", "appointment", "home_care_quote", "task"] as const;
const OTC_PHARMACY_FLOW_REFERENCE = CONCIERGE_FLOW_REFERENCES.otcPharmacy;
const TRANSPORT_BOOKING_FLOW_REFERENCE = CONCIERGE_FLOW_REFERENCES.transportBooking;
const MEDICAL_APPOINTMENT_FLOW_REFERENCE = CONCIERGE_FLOW_REFERENCES.medicalAppointment;
const SHOPPING_SUPPORT_FLOW_REFERENCE = CONCIERGE_FLOW_REFERENCES.shoppingSupport;
const CARE_NAVIGATION_FLOW_REFERENCE = CONCIERGE_FLOW_REFERENCES.careNavigation;
const SCAM_CHECK_FLOW_REFERENCE = CONCIERGE_FLOW_REFERENCES.scamCheck;
const INSURANCE_ADMIN_FLOW_REFERENCE = CONCIERGE_FLOW_REFERENCES.insuranceAdmin;
const OTC_PHARMACY_SETUP_FOCUS = providerSetupFocusForFlow(OTC_PHARMACY_FLOW_REFERENCE) ?? "pharmacy";
const TRANSPORT_SETUP_FOCUS = providerSetupFocusForFlow(TRANSPORT_BOOKING_FLOW_REFERENCE) ?? "transport";
const MEDICAL_APPOINTMENT_SETUP_FOCUS = providerSetupFocusForFlow(MEDICAL_APPOINTMENT_FLOW_REFERENCE) ?? "doctor_clinic";
const CONCIERGE_TOOL_REQUIREMENTS: ConciergeToolRequirement[] = [
  "phone_call",
  "email",
  "whatsapp",
  "booking_link",
  "camera_or_upload",
  "web_search",
  "operator_review",
];
const CONCIERGE_PREPARED_USE_CASES = ["scam_check", "admin_task", "paperwork", "send_message", "find_offers", "find_provider", "shopping_request"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isConciergeRoutePrefillKind(value: unknown): value is ConciergeRoutePrefill["kind"] {
  return typeof value === "string" && CONCIERGE_ROUTE_PREFILL_KINDS.includes(value as ConciergeRoutePrefill["kind"]);
}

function isConciergeFlowReference(value: unknown): value is ConciergeFlowReference {
  return typeof value === "string" && Object.values(CONCIERGE_FLOW_REFERENCES).includes(value as ConciergeFlowReference);
}

function isConciergeToolRequirement(value: unknown): value is ConciergeToolRequirement {
  return typeof value === "string" && CONCIERGE_TOOL_REQUIREMENTS.includes(value as ConciergeToolRequirement);
}

function isConciergePreparedUseCase(value: unknown): value is ConciergeRoutePrefill["useCase"] {
  return typeof value === "string" && CONCIERGE_PREPARED_USE_CASES.includes(value as typeof CONCIERGE_PREPARED_USE_CASES[number]);
}

function coerceConciergeRoutePrefill(value: unknown): ConciergeRoutePrefill | null {
  if (!isRecord(value) || !isConciergeRoutePrefillKind(value.kind) || typeof value.message !== "string") {
    return null;
  }

  const message = value.message.trim();
  if (!message) return null;
  return {
    kind: value.kind,
    message,
    flowReference: isConciergeFlowReference(value.flowReference) ? value.flowReference : undefined,
    requestedTool: isConciergeToolRequirement(value.requestedTool) ? value.requestedTool : undefined,
    actionLabel: typeof value.actionLabel === "string" && value.actionLabel.trim() ? value.actionLabel.trim() : undefined,
    summary: typeof value.summary === "string" && value.summary.trim() ? value.summary.trim() : undefined,
    payload: isRecord(value.payload) ? value.payload : undefined,
    useCase: isConciergePreparedUseCase(value.useCase) ? value.useCase : undefined,
    providerSearchMode: typeof value.providerSearchMode === "string" && value.providerSearchMode.trim() ? value.providerSearchMode.trim() : undefined,
    providerSearchCriteria: routeStringList(value.providerSearchCriteria),
    providerSearchQuery: typeof value.providerSearchQuery === "string" && value.providerSearchQuery.trim() ? value.providerSearchQuery.trim() : undefined,
    source: typeof value.source === "string" ? value.source as ConciergeRoutePrefill["source"] : undefined,
  };
}

function coerceConciergeProviderRouteAction(value: unknown): ConciergeProviderRouteAction | null {
  if (!isRecord(value) || typeof value.pendingId !== "string") return null;
  if (value.mode !== "follow_up" && value.mode !== "reply") return null;
  const pendingId = value.pendingId.trim();
  if (!pendingId) return null;
  return { pendingId, mode: value.mode };
}

function routeText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function routeStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.entries(value).reduce<Record<string, string>>((acc, [key, entry]) => {
    if (typeof entry === "string" && entry.trim()) acc[key] = entry.trim();
    return acc;
  }, {});
}

function routeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim()).map((item) => item.trim());
  }
  return typeof value === "string" && value.trim() ? splitRoutePayloadList(value) : [];
}

function isAppointmentType(value: unknown): value is AppointmentType {
  return typeof value === "string" && APPOINTMENT_TYPE_CHIPS.some((chip) => chip.key === value);
}

function isProviderSearchMode(value: unknown): value is ProviderSearchMode {
  return typeof value === "string" && ["personal-care", "specialist", "residence", "care", "transport", "pharmacy", "home-service", "shopping-seller"].includes(value);
}

function isProviderSearchCriterion(value: unknown): value is ProviderSearchCriterionKey {
  return typeof value === "string" && ["nearby", "reputation", "accessible", "clear-price", "available-soon", "coverage"].includes(value);
}

function coerceConciergeResumeContext(value: unknown): ConciergeProviderResumeContext | null {
  if (!isRecord(value)) return null;
  const kind = routeText(value, ["kind", "flow"]);
  if (kind === "transport") {
    return {
      kind,
      message: routeText(value, ["message"]),
      pickup: routeText(value, ["pickup", "pickupAddress"]),
      destination: routeText(value, ["destination", "destinationAddress"]),
      time: routeText(value, ["time", "requestedTime"]),
      mobilityNeeds: routeStringList(value.mobilityNeeds ?? value.mobility_needs),
      voiceCanvas: value.voiceCanvas === true || value.voice_canvas === true,
    };
  }
  if (kind === "otc_pharmacy") {
    const fulfillment = routeText(value, ["fulfillmentPreference", "fulfillment_preference"]);
    return {
      kind,
      itemText: routeText(value, ["itemText", "item_text"]),
      fulfillmentPreference: fulfillment === "pickup" ? "pickup" : "delivery",
      requestedTime: routeText(value, ["requestedTime", "requested_time"]),
      notes: routeText(value, ["notes"]),
    };
  }
  if (kind === "medical_appointment") {
    return {
      kind,
      appointmentType: isAppointmentType(value.appointmentType ?? value.appointment_type) ? (value.appointmentType ?? value.appointment_type) as AppointmentType : "medical",
      note: routeText(value, ["note", "message", "appointmentNote"]),
      requestedTime: routeText(value, ["requestedTime", "requested_time", "datePreference", "date_preference"]),
      coverageLabel: routeText(value, ["coverageLabel", "coverage_label"]),
      voiceCanvas: value.voiceCanvas === true || value.voice_canvas === true,
    };
  }
  if (kind === "home_service") {
    const serviceType = routeText(value, ["serviceType", "service_type"]);
    const origin = routeText(value, ["origin"]);
    return {
      kind,
      serviceType: serviceType ? normalizeHomeServiceType(serviceType) : null,
      origin: origin === "voice" ? "voice" : "app",
      note: routeText(value, ["note", "message", "appointmentNote"]),
      answers: routeStringRecord(value.answers),
      textDrafts: routeStringRecord(value.textDrafts ?? value.text_drafts),
      voiceCanvas: value.voiceCanvas === true || value.voice_canvas === true,
      photoName: routeText(value, ["photoName", "photo_name"]),
    };
  }
  if (kind === "provider_search") {
    const criteria = Array.isArray(value.criteria)
      ? value.criteria.filter(isProviderSearchCriterion)
      : [];
    return {
      kind,
      mode: isProviderSearchMode(value.mode) ? value.mode : null,
      query: routeText(value, ["query"]),
      criteria,
    };
  }
  if (kind === "provider_shortlist") {
    const pendingId = routeText(value, ["pendingId", "pending_id"]);
    if (!pendingId) return null;
    return {
      kind,
      pendingId,
      preferredProviderId: routeText(value, ["preferredProviderId", "preferred_provider_id"]) || undefined,
    };
  }
  if (kind === "generic") {
    return {
      kind,
      message: routeText(value, ["message"]),
    };
  }
  return null;
}

function coerceTrustedProviderSavedRoute(value: unknown): TrustedProviderSavedRoute | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) return null;
  return {
    name,
    category: normalizeConciergeProviderCategory(typeof value.category === "string" ? value.category : null),
    conciergeResume: coerceConciergeResumeContext(value.conciergeResume ?? value.resume),
  };
}

function coerceProviderSetupHelpRequestedRoute(value: unknown): ProviderSetupHelpRequestedRoute | null {
  if (!isRecord(value)) return null;
  const setupReason = typeof value.setupReason === "string" ? value.setupReason.trim() : "";
  const conciergeResume = coerceConciergeResumeContext(value.conciergeResume ?? value.resume);
  if (!setupReason && !conciergeResume) return null;
  const helperName = typeof value.helperName === "string" ? value.helperName.trim() : "";
  return {
    setupReason,
    conciergeResume,
    helperName: helperName || undefined,
  };
}

function providerCategoryFromResumeContext(resume: ConciergeProviderResumeContext | null): ConciergeProviderCategoryId {
  if (!resume) return "other";
  if (resume.kind === "transport") return "transport";
  if (resume.kind === "otc_pharmacy") return "pharmacy";
  if (resume.kind === "medical_appointment") return "doctor_clinic";
  if (resume.kind === "home_service") return "home_service";
  return "other";
}

function routePayloadString(state: ConciergeLocationState, key: string) {
  const value = state?.voiceActionPayload?.[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function inferRideDestinationFromMessage(message: string) {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const match = normalized.match(/\b(?:ride|taxi|cab|transport|uber|lift|take me|pick me up|llevarme|recogerme)\s+(?:to|towards|at|a|al|hasta)\s+(?:the\s+|el\s+|la\s+)?(.+?)(?:\s+(?:tomorrow|manana|today|hoy|tonight|esta noche|now|ahora|morning|afternoon|evening|night|por la manana|por la tarde|at|around)\b|[.?!]|$)/i)
    || normalized.match(/\b(?:to|towards|at|al|hasta)\s+(?:the\s+|el\s+|la\s+)?(.+?)(?:\s+(?:tomorrow|manana|today|hoy|tonight|esta noche|now|ahora|morning|afternoon|evening|night|por la manana|por la tarde|at|around)\b|[.?!]|$)/i);
  return match?.[1]
    ?.replace(/\b(?:please|thanks|thank you|por favor|gracias|prepare)\b.*$/i, "")
    .replace(/^(?:the|a|an|el|la)\s+/i, "")
    .trim() || "";
}

function inferRideTimeFromMessage(message: string) {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\btomorrow morning\b|\bmanana por la manana\b/.test(normalized)) return "tomorrow morning";
  if (/\btomorrow afternoon\b|\bmanana por la tarde\b/.test(normalized)) return "tomorrow afternoon";
  if (/\btomorrow\b|\bmanana\b/.test(normalized)) return "tomorrow";
  if (/\btonight\b|\besta noche\b/.test(normalized)) return "tonight";
  if (/\btoday\b|\bhoy\b/.test(normalized)) return "today";
  if (/\bnow\b|\bright now\b|\bahora\b/.test(normalized)) return "now";
  return "";
}

function splitRoutePayloadList(value: string) {
  return value
    .split(",")
    .map((item) => {
      const trimmed = item.trim();
      const normalized = trimmed.toLowerCase();
      if (/wheelchair|silla de ruedas/.test(normalized)) return "Wheelchair access";
      if (/walker|cane|andador|baston/.test(normalized)) return "Walker or cane";
      if (/door|getting in|getting out|subir|bajar|puerta/.test(normalized)) return "Help to the door";
      if (/caregiver|carer|cuidador/.test(normalized)) return "Caregiver coming";
      if (/low walking|short walk|caminar poco/.test(normalized)) return "Low walking distance";
      return trimmed;
    })
    .filter(Boolean);
}

type ConciergeOnboardingState = {
  profile?: {
    country?: string | null;
    emergency_contact?: {
      name?: string | null;
      primary_phone?: string | null;
      secondary_phone?: string | null;
    } | null;
  } | null;
} | null;

function conciergeEmergencyContactFromState(data?: ConciergeOnboardingState) {
  const contact = data?.profile?.emergency_contact;
  const phone = contact?.primary_phone?.trim() || contact?.secondary_phone?.trim() || "";
  if (!phone) return null;
  return {
    name: contact?.name?.trim() || "",
    phone,
  };
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return "";
}

function cleanRoutePrefillText(message: string) {
  return message
    .replace(/\s+/g, " ")
    .replace(/\s+(Do not call, book, message, or share details without my confirmation\.?|Do not book, contact, message, or share details without my confirmation\.?|No llames, reserves, envies mensajes ni compartas datos sin mi confirmacion\.?|No reserves, contactes, envies mensajes ni compartas datos sin mi confirmacion\.?).*$/i, "")
    .replace(/^(I could not verify provider search access right now\. Prepare this Concierge request so I can review trusted options before anyone is contacted\.|No he podido verificar la busqueda de proveedores ahora mismo\. Prepara esta solicitud de Concierge para revisar opciones fiables antes de contactar con nadie\.)\s*/i, "")
    .replace(/^(I could not verify appointment access right now\. Prepare this Concierge request for review before acting\.|No he podido verificar el acceso a la cita ahora mismo\. Prepara esta solicitud de Concierge para revisarla antes de actuar\.)\s*/i, "")
    .replace(/^(Request details|Detalle):\s*/i, "")
    .trim();
}

function buildRoutePrefillHighlights(message: string, isSpanish: boolean): RoutePrefillHighlight[] {
  const cleanText = cleanRoutePrefillText(message);
  const service = firstMatch(cleanText, [
    /^([^.?]+? needed)\.?/i,
    /(?:service|servicio):\s*([^.?]+)/i,
  ]);
  const urgency = firstMatch(cleanText, [
    /How urgent is it\??:\s*([^.?]+)/i,
    /Que urgencia tiene\??:\s*([^.?]+)/i,
  ]);
  const problem = firstMatch(cleanText, [
    /What happened\??:\s*([^.?]+)/i,
    /Que ha pasado\??:\s*([^.?]+)/i,
  ]);
  const location = firstMatch(cleanText, [
    /Where is the problem\??:\s*([^.?]+)/i,
    /Donde esta el problema\??:\s*([^.?]+)/i,
  ]);
  const criteria = firstMatch(cleanText, [
    /Criteria:\s*([^.?]+)/i,
    /Criterios?:\s*([^.?]+)/i,
  ]);

  const structured = [
    service ? { label: isSpanish ? "Necesitas" : "Need", value: service } : null,
    urgency ? { label: isSpanish ? "Urgencia" : "Urgency", value: urgency } : null,
    problem ? { label: isSpanish ? "Problema" : "Problem", value: problem } : null,
    location ? { label: isSpanish ? "Lugar" : "Where", value: location } : null,
    criteria ? { label: isSpanish ? "Prioridad" : "Priority", value: criteria } : null,
  ].filter(Boolean) as RoutePrefillHighlight[];

  if (structured.length > 0) return structured.slice(0, 4);

  const general = cleanText
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line && !/confirm|confirmacion|book|contacted|contactar|compartas/i.test(line))
    .slice(0, 3);

  return general.length > 0
    ? general.map((value, index) => ({
      label: index === 0 ? (isSpanish ? "Solicitud" : "Request") : (isSpanish ? "Detalle" : "Detail"),
      value,
    }))
    : [{ label: isSpanish ? "Solicitud" : "Request", value: cleanText || message.trim() }];
}

function toolGatedRequirementFromMessage(message: string): ConciergeToolRequirement {
  const text = message.toLowerCase();
  if (/\b(whatsapp|wa)\b/.test(text)) return "whatsapp";
  if (/\b(email|e-mail|correo)\b/.test(text)) return "email";
  if (/\b(call|phone|ring|llamar|llamada|telefono|tel[eé]fono)\b/.test(text)) return "phone_call";
  if (/\b(photo|camera|upload|document|letter|bill|invoice|foto|camara|c[aá]mara|subir|documento|carta|factura)\b/.test(text)) return "camera_or_upload";
  if (/\b(search|reputation|company|offer|seller|lookup|buscar|busqueda|b[uú]squeda|reputacion|reputaci[oó]n|empresa|oferta|vendedor)\b/.test(text)) return "web_search";
  if (/\b(form|application|apply|submit|booking link|reservation|formulario|solicitud|enviar|reservar|reserva)\b/.test(text)) return "booking_link";
  return "operator_review";
}

function routePrefillTaskReadiness(prefill: ConciergeRoutePrefill): ConciergeToolReadinessResult {
  const requestedTool = prefill.requestedTool ?? toolGatedRequirementFromMessage(prefill.message);
  return evaluateConciergeToolReadiness({
    flowReference: prefill.flowReference ?? CONCIERGE_FLOW_REFERENCES.toolGatedTask,
    requestedTool,
    capabilities: {
      operator_review: true,
      camera_or_upload: true,
      web_search: true,
      booking_link: false,
      email: false,
      phone_call: false,
      whatsapp: false,
    },
    provider: { name: "Concierge task" },
  });
}

function routePrefillTaskActionLabel(tool: ConciergeToolRequirement, isSpanish: boolean, actionLabel?: string): string {
  if (actionLabel?.trim()) return actionLabel.trim();
  switch (tool) {
    case "phone_call":
      return isSpanish ? "Preparar llamada" : "Prepare call";
    case "email":
      return isSpanish ? "Preparar email" : "Prepare email";
    case "whatsapp":
      return isSpanish ? "Preparar WhatsApp" : "Prepare WhatsApp";
    case "booking_link":
      return isSpanish ? "Preparar formulario" : "Prepare form";
    case "camera_or_upload":
      return isSpanish ? "Revisar documento" : "Review document";
    case "web_search":
      return isSpanish ? "Preparar busqueda" : "Prepare search";
    default:
      return isSpanish ? "Preparar solicitud" : "Prepare request";
  }
}

function routePrefillTaskTitle(prefill: ConciergeRoutePrefill, isSpanish: boolean): string {
  if (prefill.flowReference === SCAM_CHECK_FLOW_REFERENCE) {
    return isSpanish ? "Revision segura preparada" : "Safe check ready";
  }
  if (prefill.flowReference === INSURANCE_ADMIN_FLOW_REFERENCE) {
    return isSpanish ? "Gestion preparada" : "Paperwork task ready";
  }
  if (prefill.flowReference === SHOPPING_SUPPORT_FLOW_REFERENCE) {
    if (prefill.useCase === "find_offers") {
      return isSpanish ? "Comparacion preparada" : "Deal comparison ready";
    }
    return isSpanish ? "Compra preparada" : "Shopping request ready";
  }
  if (prefill.flowReference === CARE_NAVIGATION_FLOW_REFERENCE) {
    return isSpanish ? "Busqueda de cuidado preparada" : "Care search ready";
  }
  if (prefill.useCase === "find_provider") {
    return isSpanish ? "Busqueda preparada" : "Provider search ready";
  }
  return isSpanish ? "Revisa la solicitud" : "Review request";
}

function routePrefillTaskDetail(prefill: ConciergeRoutePrefill, isSpanish: boolean): string {
  if (prefill.summary?.trim()) return prefill.summary.trim();
  if (prefill.flowReference === SCAM_CHECK_FLOW_REFERENCE) {
    return isSpanish
      ? "VYVA prepara una revision sin hacer clic ni compartir datos."
      : "VYVA prepares a safe review without clicking or sharing details.";
  }
  if (prefill.flowReference === INSURANCE_ADMIN_FLOW_REFERENCE) {
    return isSpanish
      ? "VYVA organiza el documento, destinatario y proximo paso."
      : "VYVA organizes the document, recipient, and next step.";
  }
  if (prefill.flowReference === SHOPPING_SUPPORT_FLOW_REFERENCE) {
    if (prefill.useCase === "find_offers") {
      return isSpanish
        ? "VYVA compara precio, condiciones, confianza y riesgo antes de cualquier compra o cambio."
        : "VYVA compares price, terms, trust, and risk before any purchase or switch.";
    }
    return isSpanish
      ? "VYVA prepara la solicitud de compra. No se pide, paga ni contacta a nadie sin confirmacion."
      : "VYVA prepares the shopping request. Nothing is ordered, paid, or sent without confirmation.";
  }
  if (prefill.flowReference === CARE_NAVIGATION_FLOW_REFERENCE) {
    return isSpanish
      ? "VYVA prepara opciones de cuidado antes de contactar con nadie."
      : "VYVA prepares care options before contacting anyone.";
  }
  if (prefill.useCase === "find_provider") {
    return isSpanish
      ? "VYVA prepara opciones fiables antes de contactar con nadie."
      : "VYVA prepares trusted options before contacting anyone.";
  }
  return isSpanish ? "Comprueba los detalles antes de enviarlos." : "Check the details before sending.";
}

function appointmentFlowReferenceFromPreferences(
  preferences: Record<string, unknown> | null | undefined,
  fallback: ConciergeFlowReference,
): ConciergeFlowReference {
  const value = preferences?.flow_reference;
  return isConciergeFlowReference(value) ? value : fallback;
}

interface StoredChatHistory {
  savedAt: string;
  messages: ChatMessage[];
}

interface ConciergePendingItem {
  id: string;
  use_case: string;
  provider_name: string | null;
  provider_phone: string | null;
  requested_tool?: string | null;
  active_tool?: string | null;
  action_summary: string;
  action_payload: Record<string, unknown> | null;
  status: "pending" | "calling" | "completed" | "failed" | "cancelled";
  language: string;
  confirmed_at?: string | null;
  expires_at?: string | null;
}

interface ConciergeActionConfirmationResult {
  pendingId: string;
  status: string;
  message?: string;
  historySessionId?: string | null;
}

type ConciergeExternalConfirmationKind = "confirm" | "phone" | "email" | "whatsapp" | "booking";

type ConciergeExternalConfirmationRequest = {
  item: ConciergePendingItem;
  kind: ConciergeExternalConfirmationKind;
  href?: string;
  label: string;
  target?: "_self" | "_blank";
};

interface ConciergeCompletedSession {
  id: string;
  pending_id: string | null;
  use_case: string;
  provider_name: string | null;
  outcome: string | null;
  outcome_payload: Record<string, unknown> | null;
  outcome_summary: string | null;
  completed_at: string | null;
}

type ConciergeLiveHandoffState =
  | "ready"
  | "sent_or_called"
  | "waiting"
  | "completed"
  | "failed"
  | "needs_human_help";

type ConciergeLiveHandoffReadinessItem = {
  key: string;
  label: string;
  value: string;
  ready: boolean;
};

type ConciergeLiveHandoffSummary = {
  state: ConciergeLiveHandoffState;
  label: string;
  helper: string;
  items: ConciergeLiveHandoffReadinessItem[];
};

function coerceConciergeCompletedTemplate(value: unknown): ConciergeCompletedSession | null {
  if (!isRecord(value)) return null;
  const useCase = typeof value.use_case === "string" && value.use_case.trim() ? value.use_case.trim() : "";
  if (!useCase) return null;
  return {
    id: typeof value.id === "string" && value.id.trim() ? value.id.trim() : `completed-template-${useCase}`,
    pending_id: typeof value.pending_id === "string" && value.pending_id.trim() ? value.pending_id.trim() : null,
    use_case: useCase,
    provider_name: typeof value.provider_name === "string" && value.provider_name.trim() ? value.provider_name.trim() : null,
    outcome: typeof value.outcome === "string" && value.outcome.trim() ? value.outcome.trim() : "completed",
    outcome_payload: isRecord(value.outcome_payload) ? value.outcome_payload : null,
    outcome_summary: typeof value.outcome_summary === "string" && value.outcome_summary.trim() ? value.outcome_summary.trim() : null,
    completed_at: typeof value.completed_at === "string" && value.completed_at.trim() ? value.completed_at.trim() : null,
  };
}

type ConciergeEmailDraft = {
  address: string;
  subject: string;
  body: string;
};

type ConciergeWhatsAppDraft = {
  number: string;
  message: string;
};

type AppointmentType = (typeof APPOINTMENT_TYPE_CHIPS)[number]["key"];
type AppointmentChannel = "booking_url" | "phone" | "whatsapp" | "email" | "manual";

interface AppointmentRequestItem {
  id: string;
  appointment_type: AppointmentType;
  reason_detail: string | null;
  preferences?: Record<string, unknown>;
  status: string;
  selected_provider_option_id: string | null;
  selected_channel: AppointmentChannel | null;
}

interface AppointmentProviderOption {
  id: string;
  provider_id: string | null;
  provider_source: "saved" | "external" | "manual";
  provider_snapshot: Record<string, unknown>;
  match_reason: string | null;
  available_channels: AppointmentChannel[];
  rank: number;
  status: string;
}

interface AppointmentAttemptResponse {
  attempt?: { id: string; channel: AppointmentChannel; status: string };
  pending?: { pendingId?: string; status?: string; message?: string } | null;
  communication?: { id: string; channel: string; recipient: string; status: string; provider_message_id?: string | null; error?: string } | null;
  form_task?: { status: string; booking_url?: string | null; pending_id?: string | null; scheduled_event_id?: string | null } | null;
  scheduled_event?: { id: string; scheduled_for?: string; title?: string } | null;
  booking_url?: string | null;
  draft?: string | null;
  handled_by_vyva?: boolean;
  needs_booking_confirmation?: boolean;
  mission?: AppointmentMissionState;
}

interface AppointmentDiscoveryMeta {
  source?: string;
  fallback_reason?: "google_places_not_configured" | "no_google_results" | "google_places_unavailable";
  inserted_count?: number;
  reservation_systems?: Array<{ name: string; category: string; url: string }>;
}

interface AppointmentMissionState {
  status:
    | "collecting_details"
    | "selecting_provider"
    | "awaiting_confirmation"
    | "contacting_provider"
    | "form_in_progress"
    | "awaiting_provider_reply"
    | "awaiting_user_save"
    | "booked"
    | "stopped";
  current_step: string;
  preferred_channel: AppointmentChannel | null;
  provider_preference_snapshot?: {
    preferred_booking_method?: AppointmentChannel | null;
    booking_preferences?: Record<string, unknown>;
    source?: "provider" | "user_default" | "fallback";
  };
  user_control_state?: {
    listening: boolean;
    muted: boolean;
    stopped: boolean;
    awaiting_confirmation: boolean;
  };
  activity_log: string[];
}

interface AppointmentRequestResponse {
  request: AppointmentRequestItem;
  options: AppointmentProviderOption[];
  discovery?: AppointmentDiscoveryMeta;
  mission?: AppointmentMissionState;
}

interface AppointmentOptionResponse {
  option: AppointmentProviderOption;
  mission?: AppointmentMissionState;
}

interface AppointmentErrorBody {
  error?: string;
  code?: string;
  nextRoute?: string;
}

class AppointmentRequestError extends Error {
  status?: number;
  code?: string;
  nextRoute?: string;

  constructor(message: string, status?: number, code?: string, nextRoute?: string) {
    super(message);
    this.name = "AppointmentRequestError";
    this.status = status;
    this.code = code;
    this.nextRoute = nextRoute;
  }
}

async function readAppointmentErrorBody(response: Response): Promise<AppointmentErrorBody> {
  try {
    const parsed = await response.json();
    return typeof parsed === "object" && parsed !== null ? parsed as AppointmentErrorBody : {};
  } catch {
    return {};
  }
}

function isFeatureAccessVerificationError(error: unknown) {
  if (error instanceof AppointmentRequestError && error.code === "FEATURE_ACCESS_UNAVAILABLE") return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /could not verify feature access/i.test(message) || /could not verify access/i.test(message);
}

function appointmentErrorMessage(error: unknown, isSpanish: boolean, fallback: string) {
  if (error instanceof AppointmentRequestError) {
    if (error.status === 401) return isSpanish ? "Inicia sesion de nuevo y vuelve a intentarlo." : "Please sign in again and try once more.";
    if (error.status === 403 || error.code === "ENTITLEMENT_REQUIRED") {
      return isSpanish
        ? "Concierge no esta incluido en este plan. Revisa la suscripcion para activarlo."
        : "Concierge is not included in this plan. Check subscription settings to enable it.";
    }
    if (error.status === 409) return isSpanish ? "Elige o termina un perfil de cuidado primero." : "Choose or finish a care profile first.";
    if (isFeatureAccessVerificationError(error)) {
      return isSpanish
        ? "No he podido verificar el acceso ahora mismo. Vuelve a intentarlo."
        : "I could not verify access right now. Please try again.";
    }
    return error.message || fallback;
  }
  if (error instanceof Error) {
    if (isFeatureAccessVerificationError(error)) {
      return isSpanish
        ? "No he podido verificar el acceso ahora mismo. Vuelve a intentarlo."
        : "I could not verify access right now. Please try again.";
    }
    return error.message || fallback;
  }
  return fallback;
}

type TransportAction =
  | "open_url"
  | "call_phone"
  | "draft_message"
  | "start_concierge_action";

type TransportOptionKind =
  | "saved_provider"
  | "ride_app"
  | "local_taxi"
  | "medical_transport"
  | "caregiver"
  | "concierge_manual";

interface TransportOption {
  id: string;
  kind: TransportOptionKind;
  label: string;
  description: string;
  providerName?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  bookingUrl?: string;
  preferredChannel?: string;
  url?: string;
  actions: TransportAction[];
}

interface TransportOptionsResponse {
  market: { countryCode?: string; region?: string; city?: string };
  options: TransportOption[];
  fallbackReason?: string;
  disclaimers: string[];
}

type TransportPreparedResponse = { pendingId?: string; status?: string; message?: string };
type OtcPreparedResponse = { pendingId?: string; status?: string; message?: string };
type PreparedTaskResponse = { pendingId?: string; status?: string; message?: string };

type ConciergeActionListResponse<T> = { items?: T[] };

async function completePendingConciergeAction(params: {
  pendingId: string;
  outcomeSummary: string;
  outcomePayload: Record<string, unknown>;
}) {
  const res = await apiFetch(`/api/concierge/actions/${params.pendingId}/complete`, {
    method: "POST",
    body: JSON.stringify({
      outcome_summary: params.outcomeSummary,
      outcome_payload: params.outcomePayload,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not complete concierge action");
  }
  return await res.json() as { ok: true; status: "completed"; sessionId?: string | null };
}

async function patchPendingConciergeAction(params: {
  pendingId: string;
  actionPayload: Record<string, unknown>;
}) {
  const res = await apiFetch(`/api/concierge/actions/${params.pendingId}/details`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action_payload: params.actionPayload }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not update concierge action");
  }
  return await res.json() as { ok: true; item: ConciergePendingItem };
}

interface OfferScoreBreakdown {
  distance: number;
  price_value: number;
  trust: number;
  simplicity: number;
  preference_match: number;
}

interface OfferOption extends ProviderComparisonSourceOption {
  label: "Opcion recomendada" | "Alternativa 1" | "Alternativa 2";
  name: string;
  category: string;
  what_it_offers: string;
  price_or_advantage: string;
  why_good_option: string;
  distance_or_availability: string;
  contact_method: string;
  phone?: string;
  website?: string;
  maps_url?: string;
  trust_note: string;
  source_label?: string;
  source_status?: "verified" | "reported" | "unknown";
  score: number;
  score_breakdown?: OfferScoreBreakdown;
}

function offerReviewStructuredPayload(option: OfferOption, params: {
  intent: "compare" | "watch";
  query: string;
  criteria: string[];
  category?: string | null;
}): Record<string, unknown> {
  const contact = option.phone || option.website || option.maps_url || "";
  return {
    task_type: params.intent === "watch" ? "deal_watch" : "deal_comparison",
    shopping_need: params.intent === "watch" ? `Watch ${option.name}` : `Review ${option.name}`,
    shopping_context: params.category || option.category || "deal_review",
    review_target: option.name,
    offer_name: option.name,
    deal_name: option.name,
    category: option.category,
    query: params.query,
    criteria: params.criteria,
    comparison_summary: option.why_good_option || option.trust_note || option.what_it_offers,
    price_or_advantage: option.price_or_advantage,
    distance_or_availability: option.distance_or_availability,
    contact_method: option.contact_method,
    website: option.website || option.maps_url || null,
    phone: option.phone || null,
    provider_name: option.name,
    trust_note: option.trust_note,
    contact,
  };
}

interface OfferProtectionSummary {
  title: string;
  checkpoints: string[];
  notification_triggers: string[];
  action_guardrail: string;
}

interface OffersSearchResponse {
  category: string;
  options: OfferOption[];
  decision_explanation: string;
  neutrality_note: string;
  source_guidance: string[];
  protection_summary?: OfferProtectionSummary;
  next_step: string;
  no_results_message?: string;
}

type WebSearchActionResult = {
  query: string;
  result: OffersSearchResponse;
};

type BillDocumentAnalysis = {
  document_type: "electricity_bill" | "gas_bill" | "internet_phone_bill" | "insurance_policy" | "home_service_invoice" | "unknown";
  category: string;
  provider_name: string | null;
  service_address?: string | null;
  postcode?: string | null;
  cups?: string | null;
  billing_period: string | null;
  billing_period_days?: number | null;
  total_amount: number | null;
  power_kw?: number | null;
  currency: string | null;
  usage: {
    kwh: number | null;
    gas_kwh: number | null;
    data_or_phone_plan: string | null;
  };
  tariff_or_plan: string | null;
  unit_prices: {
    electricity_price_per_kwh: number | null;
    gas_price_per_kwh: number | null;
    standing_charge: number | null;
  };
  confidence: "high" | "medium" | "low";
  missing_fields: string[];
  suggested_query: string;
  user_summary: string;
  isFallback?: boolean;
  fallback_reason?: "missing_api_key" | "invalid_model_json" | "openai_error" | "unreadable";
};

type UtilityInputMethod = "upload" | "photo" | "voice" | "manual";
type UtilityType = "electricity" | "gas" | "dual";
type SavingsPanelView = "overview" | "utilities";
type ProviderSearchMode = "personal-care" | "specialist" | "residence" | "care" | "transport" | "pharmacy" | "home-service" | "shopping-seller";
type ProviderSearchCriterionKey = "nearby" | "reputation" | "accessible" | "clear-price" | "available-soon" | "coverage";

interface NormalizedUtilityInput {
  country: "ES";
  utility_type: UtilityType;
  postcode: string;
  cups: string;
  provider: string;
  tariff_name: string;
  power_kw: number | null;
  consumption_kwh: number | null;
  billing_period_days: number | null;
  total_cost: number | null;
  has_social_bonus: boolean | null;
  confidence: number;
  missing_fields: string[];
}

interface UtilityComparisonResult {
  provider: string;
  tariff_name: string;
  estimated_monthly_cost: number | null;
  estimated_annual_cost: number | null;
  estimated_monthly_savings: number | null;
  contract_type: string;
  permanence: string;
  price_stability: string;
  green_energy: boolean | null;
  source: "CNMC" | "Fallback";
  source_url?: string;
  provider_url?: string;
  action_label?: string;
  confidence: "high" | "medium" | "low";
  notes: string[];
}

interface UtilityCompareResponse {
  normalized_input: NormalizedUtilityInput;
  source_used: "CNMC" | "Fallback";
  source_status: "success" | "fallback" | "failed";
  source_url?: string;
  summary: {
    headline: string;
    current_monthly_cost: number | null;
    best_estimated_monthly_cost: number | null;
    estimated_monthly_savings: number | null;
  };
  results: UtilityComparisonResult[];
  calculation_note: string;
  estimated_note: string;
  neutrality_note: string;
  source_note: string;
}

const OFFER_CATEGORY_CHIPS = [
  {
    es: "Gastos del hogar",
    en: "Household costs",
    detailEs: "Electricidad, gas, internet, telefono y mantenimiento.",
    detailEn: "Electricity, gas, internet, phone, and maintenance.",
    queryEs: "revisar gastos del hogar electricidad gas internet telefono mantenimiento",
    queryEn: "review household costs electricity gas internet phone maintenance",
  },
  {
    es: "Vivienda y cuidados",
    en: "Living and care",
    detailEs: "Residencias, centros de dia, ayuda a domicilio y estancias temporales.",
    detailEn: "Care homes, day centres, home help, and temporary stays.",
    queryEs: "comparar residencia mayores centro de dia ayuda a domicilio estancias temporales",
    queryEn: "compare senior residence day centre home care temporary stays",
  },
  {
    es: "Seguros y proteccion",
    en: "Insurance and protection",
    detailEs: "Salud, hogar, vida, asistencia y dependencia.",
    detailEn: "Health, home, life, assistance, and dependency support.",
    queryEs: "revisar seguro salud hogar vida asistencia dependencia cobertura precio",
    queryEn: "review health home life assistance dependency insurance coverage price",
  },
  {
    es: "Servicios en casa",
    en: "Home support",
    detailEs: "Limpieza, reparaciones, mantenimiento y cuidado personal en casa.",
    detailEn: "Cleaning, repairs, maintenance, and personal care at home.",
    queryEs: "servicios fiables en casa limpieza reparaciones mantenimiento cuidado personal",
    queryEn: "reliable home services cleaning repairs maintenance personal care",
  },
  {
    es: "Ayudas y beneficios",
    en: "Benefits and support",
    detailEs: "Subvenciones, beneficios para mayores, ayudas locales y programas sociales.",
    detailEn: "Grants, senior benefits, local support, and social programmes.",
    queryEs: "ayudas disponibles beneficios para mayores subvenciones programas sociales locales",
    queryEn: "available benefits senior support grants local social programmes",
  },
] as const;

const OFFER_CATEGORY_VISUALS = [
  { Icon: Zap, color: "#6B21A8", bg: "#F5F3FF", border: "#DDD6FE" },
  { Icon: Building2, color: "#0F766E", bg: "#F0FDFA", border: "#99F6E4" },
  { Icon: ShieldCheck, color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" },
  { Icon: PackageCheck, color: "#B45309", bg: "#FFF7ED", border: "#FED7AA" },
  { Icon: PiggyBank, color: "#0A7C4E", bg: "#ECFDF5", border: "#BBF7D0" },
] as const;

const OFFER_STARTER_VISUALS = [
  { Icon: PiggyBank, color: "#0A7C4E", bg: "#ECFDF5" },
  { Icon: CircleCheck, color: "#B45309", bg: "#FFF7ED" },
  { Icon: Building2, color: "#6B21A8", bg: "#F5F3FF" },
] as const;

const OFFER_IDEA_CHIPS = [
  {
    es: "Reducir gastos mensuales",
    en: "Reduce monthly costs",
    queryEs: "reducir gastos mensuales luz gas internet seguros servicios esenciales",
    queryEn: "reduce monthly costs electricity gas internet insurance essential services",
  },
  {
    es: "Revisar ayudas disponibles",
    en: "Review available benefits",
    queryEs: "revisar ayudas disponibles para mayores en mi zona",
    queryEn: "review available senior benefits in my area",
  },
  {
    es: "Comparar servicios de cuidado",
    en: "Compare care services",
    queryEs: "comparar ayuda a domicilio centros de dia residencias mayores",
    queryEn: "compare home help day centres senior residences",
  },
  {
    es: "Revisar mi internet",
    en: "Review my internet plan",
    queryEs: "revisar internet telefono precio cobertura facilidad para mayores",
    queryEn: "review internet phone price coverage ease for seniors",
  },
  {
    es: "Comprobar seguro actual",
    en: "Check current insurance",
    queryEs: "revisar seguro actual cobertura precio proteccion",
    queryEn: "review current insurance coverage price protection",
  },
  {
    es: "Ayuda fiable en casa",
    en: "Reliable help at home",
    queryEs: "buscar ayuda fiable en casa limpieza reparaciones mantenimiento",
    queryEn: "find reliable help at home cleaning repairs maintenance",
  },
  {
    es: "Opciones de residencia",
    en: "Care home options",
    queryEs: "comparar residencias de mayores cerca calidad precio ubicacion",
    queryEn: "compare nearby care homes quality price location",
  },
  {
    es: "Optimizar mis facturas",
    en: "Optimise my bills",
    queryEs: "optimizar facturas electricidad gas internet mantenimiento hogar",
    queryEn: "optimise bills electricity gas internet home maintenance",
  },
] as const;

const DEFAULT_PROVIDER_SEARCH_CRITERIA: ProviderSearchCriterionKey[] = ["nearby", "reputation", "accessible"];
const TRANSPORT_PROVIDER_QUALITY_CRITERIA: ProviderSearchCriterionKey[] = ["nearby", "available-soon", "accessible", "clear-price", "reputation"];
const OTC_PHARMACY_QUALITY_CRITERIA: ProviderSearchCriterionKey[] = ["nearby", "available-soon", "clear-price", "reputation"];

const PROVIDER_SEARCH_CRITERIA: Array<{
  key: ProviderSearchCriterionKey;
  en: string;
  es: string;
  queryEn: string;
  queryEs: string;
}> = [
  {
    key: "nearby",
    en: "Nearby",
    es: "Cerca",
    queryEn: "nearby or easy to reach",
    queryEs: "cerca o facil de llegar",
  },
  {
    key: "reputation",
    en: "Good reputation",
    es: "Buena reputacion",
    queryEn: "strong reputation with verifiable reviews",
    queryEs: "buena reputacion con opiniones verificables",
  },
  {
    key: "accessible",
    en: "Easy access",
    es: "Acceso facil",
    queryEn: "accessible for older adults and simple to use",
    queryEs: "accesible para mayores y facil de usar",
  },
  {
    key: "clear-price",
    en: "Clear price",
    es: "Precio claro",
    queryEn: "clear pricing and no hidden fees",
    queryEs: "precio claro y sin cargos ocultos",
  },
  {
    key: "available-soon",
    en: "Soon",
    es: "Pronto",
    queryEn: "available soon",
    queryEs: "disponible pronto",
  },
  {
    key: "coverage",
    en: "Coverage",
    es: "Cobertura",
    queryEn: "fits public or private coverage where relevant",
    queryEs: "compatible con cobertura publica o privada cuando aplique",
  },
];

const UTILITY_INPUT_METHODS = [
  { key: "upload", icon: FileUp, es: "Subir factura", en: "Upload bill" },
  { key: "photo", icon: Camera, es: "Hacer foto", en: "Take photo" },
  { key: "voice", icon: Mic, es: "Responder por voz", en: "Answer by voice" },
  { key: "manual", icon: PencilLine, es: "Rellenar datos manualmente", en: "Fill manually" },
] as const;

const UTILITY_VOICE_QUESTIONS = [
  { key: "utility_type", es: "La factura es de luz, gas o ambas?", en: "Is the bill for electricity, gas, or both?" },
  { key: "postcode", es: "Cual es su codigo postal?", en: "What is your postcode?" },
  { key: "monthly_cost", es: "Cuanto paga aproximadamente al mes?", en: "How much do you pay approximately each month?" },
  { key: "consumption_kwh", es: "Sabe cuantos kWh consume? Si no lo sabe, no pasa nada.", en: "Do you know how many kWh you use? If not, that is okay." },
  { key: "power_kw", es: "Sabe que potencia tiene contratada? Si no lo sabe, puedo estimarla.", en: "Do you know your contracted power? If not, I can estimate it." },
] as const;

const EMPTY_UTILITY_FORM = {
  utility_type: "electricity",
  postcode: "",
  monthly_cost: "",
  consumption_kwh: "",
  power_kw: "",
  provider: "",
};

const APPOINTMENT_TYPE_CHIPS = [
  {
    key: "medical",
    es: "Medica",
    en: "Medical",
    promptEs: "Ayudame a programar una cita medica. Usa mi perfil primero, busca opciones cercanas si hace falta, y antes de actuar preparame un resumen para confirmar.",
    promptEn: "Help me schedule a medical appointment. Use my profile first, search nearby options if needed, and prepare a confirmation summary before acting.",
  },
  {
    key: "personal-care",
    es: "Cuidado personal",
    en: "Personal care",
    promptEs: "Ayudame a programar una cita de cuidado personal, como peluqueria, podologia o bienestar. Prioriza cercania, facilidad y WhatsApp si esta disponible.",
    promptEn: "Help me schedule a personal care appointment, such as hair, podiatry, or wellness. Prioritize proximity, ease, and WhatsApp if available.",
  },
  {
    key: "government",
    es: "Tramite oficial",
    en: "Government",
    promptEs: "Ayudame a programar una cita para un tramite oficial. Revisa que documentos podria necesitar y prepara recordatorios.",
    promptEn: "Help me schedule an appointment for an official service. Check what documents may be needed and prepare reminders.",
  },
  {
    key: "home-service",
    es: "Servicio en casa",
    en: "Home service",
    promptEs: "Ayudame a programar un servicio en casa. Usa mi direccion, prioriza proveedores fiables, y confirma precio, hora y forma de contacto.",
    promptEn: "Help me schedule a home service. Use my address, prioritize trusted providers, and confirm price, time, and the next step.",
  },
  {
    key: "social",
    es: "Social o restaurante",
    en: "Social or restaurant",
    promptEs: "Ayudame a programar una reserva social o restaurante. Busca opciones accesibles, cercanas y faciles, y ofrece transporte si conviene.",
    promptEn: "Help me schedule a social booking or restaurant. Find accessible, nearby, easy options and offer transport if useful.",
  },
  {
    key: "other",
    es: "Otro",
    en: "Other",
    promptEs: "Ayudame a programar una cita o servicio. Preguntame lo que falte, prepara las opciones, y confirma conmigo antes de actuar.",
    promptEn: "Help me schedule an appointment or service. Ask me for anything missing, prepare the options, and confirm with me before acting.",
  },
] as const;

const COVERAGE_TYPE_OPTIONS: Array<{
  key: CoverageReadinessType;
  en: string;
  es: string;
}> = [
  { key: "public", en: "Public", es: "Publica" },
  { key: "private", en: "Private", es: "Privada" },
  { key: "mixed", en: "Both", es: "Ambas" },
  { key: "self_pay", en: "Self-pay", es: "Pago propio" },
];

function normalizeCoverageReadinessType(value: unknown): CoverageReadinessType {
  return COVERAGE_TYPE_OPTIONS.some((option) => option.key === value)
    ? value as CoverageReadinessType
    : "public";
}

const SCHEDULE_APPOINTMENT_TYPE_KEYS = new Set<AppointmentType>([
  "medical",
  "government",
  "personal-care",
]);

type ScamCheckKind = "email" | "document" | "phone" | "company";
type InsuranceAdminKind = "insurance-letter" | "claim" | "government-form" | "call-email";
type InsuranceAdminDetails = {
  subject: string;
  recipient: string;
  deadline: string;
  notes: string;
};

const SCAM_CHECK_OPTIONS: Array<{
  key: ScamCheckKind;
  en: string;
  es: string;
  detailEn: string;
  detailEs: string;
  requestedTool: ConciergeToolRequirement;
  Icon: LucideIcon;
}> = [
  {
    key: "email",
    en: "Email or message",
    es: "Email o mensaje",
    detailEn: "Forward or paste it",
    detailEs: "Reenviar o pegar",
    requestedTool: "email",
    Icon: Mail,
  },
  {
    key: "document",
    en: "Document or photo",
    es: "Documento o foto",
    detailEn: "Show camera or upload",
    detailEs: "Camara o subir",
    requestedTool: "camera_or_upload",
    Icon: Camera,
  },
  {
    key: "phone",
    en: "Phone number",
    es: "Numero de telefono",
    detailEn: "Check who it may be",
    detailEs: "Comprobar quien puede ser",
    requestedTool: "web_search",
    Icon: PhoneCall,
  },
  {
    key: "company",
    en: "Company or offer",
    es: "Empresa u oferta",
    detailEn: "Reputation search",
    detailEs: "Buscar reputacion",
    requestedTool: "web_search",
    Icon: Building2,
  },
];

const INSURANCE_ADMIN_OPTIONS: Array<{
  key: InsuranceAdminKind;
  en: string;
  es: string;
  detailEn: string;
  detailEs: string;
  requestedTool: ConciergeToolRequirement;
  Icon: LucideIcon;
}> = [
  {
    key: "insurance-letter",
    en: "Insurance letter or bill",
    es: "Carta o factura de seguro",
    detailEn: "Photo, upload, or paste",
    detailEs: "Foto, subir o pegar",
    requestedTool: "camera_or_upload",
    Icon: FileUp,
  },
  {
    key: "claim",
    en: "Claim or reimbursement",
    es: "Reclamo o reembolso",
    detailEn: "Prepare what to send",
    detailEs: "Preparar que enviar",
    requestedTool: "email",
    Icon: PiggyBank,
  },
  {
    key: "government-form",
    en: "Government/admin form",
    es: "Formulario oficial",
    detailEn: "Fill step by step",
    detailEs: "Rellenar paso a paso",
    requestedTool: "camera_or_upload",
    Icon: Building2,
  },
  {
    key: "call-email",
    en: "Call or email someone",
    es: "Llamar o enviar email",
    detailEn: "Draft before action",
    detailEs: "Borrador antes de actuar",
    requestedTool: "phone_call",
    Icon: PhoneCall,
  },
];

function scamCheckDetailCopy(kind: ScamCheckKind, isSpanish: boolean): { label: string; placeholder: string; helper: string } {
  const copy: Record<ScamCheckKind, { en: string; es: string; placeholderEn: string; placeholderEs: string; helperEn: string; helperEs: string }> = {
    email: {
      en: "Paste the message or say how you can share it",
      es: "Pega el mensaje o di como puedes compartirlo",
      placeholderEn: "Paste text, sender, or subject...",
      placeholderEs: "Pega texto, remitente o asunto...",
      helperEn: "Do not click links or reply.",
      helperEs: "No pulses enlaces ni respondas.",
    },
    document: {
      en: "What document should VYVA review?",
      es: "Que documento debe revisar VYVA?",
      placeholderEn: "Letter, bill, invoice, photo...",
      placeholderEs: "Carta, factura, recibo, foto...",
      helperEn: "Use photo/upload only when you confirm.",
      helperEs: "Usa foto/subida solo cuando confirmes.",
    },
    phone: {
      en: "Phone number or caller name",
      es: "Numero de telefono o nombre",
      placeholderEn: "+34..., unknown caller, bank claim...",
      placeholderEs: "+34..., llamada desconocida, banco...",
      helperEn: "VYVA checks safely before calling back.",
      helperEs: "VYVA revisa antes de devolver llamada.",
    },
    company: {
      en: "Company, seller, offer, or link",
      es: "Empresa, vendedor, oferta o enlace",
      placeholderEn: "Name, website, marketplace link...",
      placeholderEs: "Nombre, web, enlace de marketplace...",
      helperEn: "VYVA looks for reliable reputation signals.",
      helperEs: "VYVA busca senales fiables de reputacion.",
    },
  };
  const item = copy[kind];
  return {
    label: isSpanish ? item.es : item.en,
    placeholder: isSpanish ? item.placeholderEs : item.placeholderEn,
    helper: isSpanish ? item.helperEs : item.helperEn,
  };
}

function insuranceAdminDetailCopy(kind: InsuranceAdminKind, isSpanish: boolean): {
  subjectLabel: string;
  subjectPlaceholder: string;
  recipientLabel: string;
  deadlineLabel: string;
  notesLabel: string;
} {
  if (kind === "call-email") {
    return {
      subjectLabel: isSpanish ? "Motivo" : "Reason",
      subjectPlaceholder: isSpanish ? "Ej. pedir cita, aclarar factura..." : "E.g. request appointment, clarify bill...",
      recipientLabel: isSpanish ? "A quien contactar" : "Who to contact",
      deadlineLabel: isSpanish ? "Para cuando" : "By when",
      notesLabel: isSpanish ? "Resultado deseado" : "Desired outcome",
    };
  }
  if (kind === "government-form") {
    return {
      subjectLabel: isSpanish ? "Formulario" : "Form",
      subjectPlaceholder: isSpanish ? "Nombre del formulario o tramite..." : "Form or application name...",
      recipientLabel: isSpanish ? "Organismo" : "Office / agency",
      deadlineLabel: isSpanish ? "Fecha limite" : "Deadline",
      notesLabel: isSpanish ? "Datos que ya tienes" : "Details you already have",
    };
  }
  if (kind === "claim") {
    return {
      subjectLabel: isSpanish ? "Que reclamar" : "What to claim",
      subjectPlaceholder: isSpanish ? "Reembolso, pago, factura..." : "Reimbursement, payment, bill...",
      recipientLabel: isSpanish ? "Aseguradora o destinatario" : "Insurer or recipient",
      deadlineLabel: isSpanish ? "Fecha limite" : "Deadline",
      notesLabel: isSpanish ? "Documentos o importes" : "Documents or amounts",
    };
  }
  return {
    subjectLabel: isSpanish ? "Carta o factura" : "Letter or bill",
    subjectPlaceholder: isSpanish ? "Que quieres entender..." : "What you want to understand...",
    recipientLabel: isSpanish ? "Aseguradora" : "Insurer",
    deadlineLabel: isSpanish ? "Fecha limite" : "Deadline",
    notesLabel: isSpanish ? "Preguntas o preocupaciones" : "Questions or worries",
  };
}

function scamCheckStructuredPayload(option: typeof SCAM_CHECK_OPTIONS[number], detail: string, isSpanish: boolean): Record<string, unknown> {
  const cleanDetail = detail.trim();
  const optionLabel = isSpanish ? option.es : option.en;
  const payload: Record<string, unknown> = {
    source_type: option.key,
    review_kind: "scam_or_safety_check",
    review_label: optionLabel,
    concern: optionLabel,
    risk_context: option.key === "company"
      ? "Company, seller, offer, or service reputation"
      : option.key === "phone"
        ? "Suspicious phone number or caller"
        : option.key === "document"
          ? "Suspicious document, letter, invoice, or photo"
          : "Suspicious email or message",
  };

  if (!cleanDetail) return payload;

  payload.review_source = cleanDetail;
  payload.scam_detail = cleanDetail;
  payload.detail = cleanDetail;

  if (option.key === "email") payload.email_body = cleanDetail;
  if (option.key === "document") payload.document_type = cleanDetail;
  if (option.key === "phone") payload.phone_number = cleanDetail;
  if (option.key === "company") payload.company_name = cleanDetail;

  return payload;
}

function insuranceAdminStructuredPayload(option: typeof INSURANCE_ADMIN_OPTIONS[number], details: InsuranceAdminDetails, isSpanish: boolean): Record<string, unknown> {
  const subject = details.subject.trim();
  const recipient = details.recipient.trim();
  const deadline = details.deadline.trim();
  const notes = details.notes.trim();
  const optionLabel = isSpanish ? option.es : option.en;
  const payload: Record<string, unknown> = {
    task_type: option.key,
    admin_task: optionLabel,
    action_type: option.requestedTool,
    requested_tool: option.requestedTool,
  };

  if (subject) {
    payload.detail = subject;
    payload.reason = subject;
    if (option.key === "insurance-letter" || option.key === "government-form") {
      payload.document_type = subject;
    }
  }
  if (recipient) {
    payload.recipient = recipient;
    payload.recipient_name = recipient;
  }
  if (deadline) payload.deadline = deadline;
  if (notes) payload.notes = notes;

  return payload;
}

const CHAT_HISTORY_BASE = "vyva_concierge_chat";
const CHAT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const HOME_SERVICE_GUIDE_STORAGE_KEY = "vyva_concierge_home_service_guide_hidden_v1";

const HOME_SERVICE_VOICE_ANSWER_KEYS = [
  "urgency",
  "problem_type",
  "active_flooding",
  "affected_area",
  "shutoff_status",
  "scope",
  "safety_risk",
  "medical_device",
  "criteria",
] as const;

function homeServiceTextFromQuestion(question: HomeServiceQuestion, isSpanish: boolean) {
  return isSpanish ? question.es : question.en;
}

function homeServiceOptionText(option: { en: string; es: string }, isSpanish: boolean) {
  return isSpanish ? option.es : option.en;
}

function chatHistoryKey(locale: string) {
  const lang = locale.split("-")[0].toLowerCase();
  return `${CHAT_HISTORY_BASE}_${lang}`;
}

const PRIMARY_CONCIERGE_CARDS = [
  {
    key: "service",
    fallback: "Help",
    descriptionFallback: "Home service, forms, legal/admin, care",
    mobileFallback: "Help",
    mobileDescriptionFallback: "Forms, care, home",
    Icon: Wrench,
    iconColor: "#B45309",
    iconBg: "linear-gradient(135deg, #FFF1D6 0%, #FFF7ED 100%)",
    glow: "rgba(180,83,9,0.12)",
  },
  {
    key: "ride",
    fallback: "Ride",
    descriptionFallback: "Now, later, medical transport",
    mobileFallback: "Ride",
    mobileDescriptionFallback: "Now or later",
    Icon: Car,
    iconColor: "#149A63",
    iconBg: "linear-gradient(135deg, #DDF8EA 0%, #F1FBF5 100%)",
    glow: "rgba(20,154,99,0.12)",
  },
  {
    key: "delivery",
    fallback: "Order",
    descriptionFallback: "Groceries, essentials, prepared meals",
    mobileFallback: "Order",
    mobileDescriptionFallback: "Food and essentials",
    Icon: PackageCheck,
    iconColor: "#2F66D0",
    iconBg: "linear-gradient(135deg, #E6F0FF 0%, #F3F8FF 100%)",
    glow: "rgba(47,102,208,0.12)",
  },
  {
    key: "appointment",
    fallback: "Schedule",
    descriptionFallback: "Medical, government, personal care",
    mobileFallback: "Schedule",
    mobileDescriptionFallback: "Medical and admin",
    Icon: Calendar,
    iconColor: "#6B21A8",
    iconBg: "linear-gradient(135deg, #ECE4FF 0%, #F8F2FF 100%)",
    glow: "rgba(124,58,237,0.13)",
  },
] as const;

const CONCIERGE_FAST_HELP_ACTIONS = [
  {
    key: "legal-advice",
    fallbackTitle: "Get legal advice",
    fallbackSubtitle: "Understand options before acting",
    mobileFallbackSubtitle: "Know your options",
    Icon: Scale,
    color: "#6B21A8",
    bg: "#F5F3FF",
    border: "#D8B4FE",
    shadow: "rgba(107,33,168,0.10)",
  },
  {
    key: "trip",
    fallbackTitle: "Plan me a trip",
    fallbackSubtitle: "Routes, timing, visits, reminders",
    mobileFallbackSubtitle: "Routes and reminders",
    Icon: Map,
    iconColor: "#0F766E",
    color: "#0F766E",
    bg: "#CCFBF1",
    border: "#99F6E4",
    shadow: "rgba(15,118,110,0.10)",
  },
  {
    key: "care",
    fallbackTitle: "Find the best care for me",
    fallbackSubtitle: "Compare safe care and support",
    mobileFallbackSubtitle: "Care and support",
    Icon: HeartHandshake,
    color: "#047857",
    bg: "#ECFDF5",
    border: "#BBF7D0",
    shadow: "rgba(4,120,87,0.10)",
  },
  {
    key: "form",
    fallbackTitle: "Fill a form",
    fallbackSubtitle: "Prepare answers, stop before submit",
    mobileFallbackSubtitle: "Prepare answers",
    Icon: FileText,
    color: "#B45309",
    bg: "#FFF7ED",
    border: "#FED7AA",
    shadow: "rgba(180,83,9,0.10)",
  },
  {
    key: "research",
    fallbackTitle: "Research a topic",
    fallbackSubtitle: "Summarize sources and next steps",
    mobileFallbackSubtitle: "Sources and steps",
    Icon: Search,
    color: "#2F66D0",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    shadow: "rgba(47,102,208,0.10)",
  },
  {
    key: "best-deal",
    fallbackTitle: "Find the best deal",
    fallbackSubtitle: "Compare price, trust, and fit",
    mobileFallbackSubtitle: "Compare options",
    Icon: Tag,
    color: "#BE185D",
    bg: "#FCE7F3",
    border: "#FBCFE8",
    shadow: "rgba(190,24,93,0.10)",
  },
  {
    key: "age-at-home",
    fallbackTitle: "Age in grace at home",
    fallbackSubtitle: "Plan safer home support",
    mobileFallbackSubtitle: "Safer home support",
    Icon: Home,
    color: "#0F766E",
    bg: "#F0FDFA",
    border: "#99F6E4",
    shadow: "rgba(15,118,110,0.10)",
  },
] as const;

const TRANSPORT_DESTINATION_HINTS = [
  { value: "Doctor or clinic", en: "Doctor", es: "Medico" },
  { value: "Pharmacy", en: "Pharmacy", es: "Farmacia" },
  { value: "Hospital", en: "Hospital", es: "Hospital" },
  { value: "Return home", en: "Back home", es: "Volver a casa" },
] as const;

const TRANSPORT_TIME_HINTS = [
  { value: "now", en: "Now", es: "Ahora" },
  { value: "today", en: "Today", es: "Hoy" },
  { value: "tomorrow morning", en: "Tomorrow morning", es: "Manana por la manana" },
  { value: "for my appointment time", en: "For appointment", es: "Para mi cita" },
] as const;

const TRANSPORT_MOBILITY_NEEDS = [
  { value: "Wheelchair access", en: "Wheelchair access", es: "Silla de ruedas" },
  { value: "Help to the door", en: "Door-to-door help", es: "Ayuda puerta a puerta" },
  { value: "Walker or cane", en: "Walker or cane", es: "Andador o baston" },
  { value: "Caregiver coming", en: "Caregiver coming", es: "Viene cuidador" },
  { value: "Low walking distance", en: "Low walking", es: "Caminar poco" },
] as const;

const OTC_PHARMACY_TIME_HINTS = [
  { value: "today", en: "Today", es: "Hoy" },
  { value: "tomorrow", en: "Tomorrow", es: "Manana" },
  { value: "this week", en: "This week", es: "Esta semana" },
] as const;

const OTC_PHARMACY_DELIVERY_OPTIONS = [
  { value: "delivery", en: "Delivery", es: "Entrega" },
  { value: "pickup", en: "Pickup", es: "Recoger" },
] as const;

const OTC_PHARMACY_ITEM_HINTS = [
  { value: "Pain relief, non-prescription", en: "Pain relief", es: "Dolor sin receta" },
  { value: "Bandages or first aid", en: "First aid", es: "Botiquin" },
  { value: "Vitamins", en: "Vitamins", es: "Vitaminas" },
] as const;

async function callConcierge(
  prompt: string,
  history: ChatMessage[],
  locale: string
): Promise<string> {
  const res = await fetch("/api/concierge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, history, locale }),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as { response?: string };
  return data.response ?? "";
}

async function fetchPendingActions(): Promise<ConciergePendingItem[]> {
  const res = await apiFetch("/api/concierge/actions/pending");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as ConciergeActionListResponse<ConciergePendingItem>;
  return data.items ?? [];
}

async function fetchCompletedConciergeSessions(): Promise<ConciergeCompletedSession[]> {
  const res = await apiFetch("/api/concierge/actions/sessions");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as ConciergeActionListResponse<ConciergeCompletedSession>;
  return data.items ?? [];
}

async function createAppointmentRequest(params: {
  appointmentType: AppointmentType;
  detail: string;
  preferences?: Record<string, unknown>;
  flowReference?: ConciergeFlowReference;
  routePrefillSource?: string;
  locale: string;
  draft?: boolean;
}): Promise<AppointmentRequestResponse> {
  const preferences = params.flowReference
    ? { ...(params.preferences ?? {}), flow_reference: params.flowReference }
    : params.preferences ?? {};
  const res = await apiFetch("/api/appointments/requests", {
    method: "POST",
    body: JSON.stringify({
      appointment_type: params.appointmentType,
      detail: params.detail,
      preferences,
      route_prefill_source: params.routePrefillSource,
      language: params.locale,
      draft: params.draft ?? false,
    }),
  });
  if (!res.ok) {
    const data = await readAppointmentErrorBody(res);
    throw new AppointmentRequestError(data.error ?? "Could not create appointment request", res.status, data.code, data.nextRoute);
  }
  return await res.json() as AppointmentRequestResponse;
}

interface HomeServiceCanvasPhoto {
  name: string;
  type: "image/jpeg" | "image/png" | "image/webp";
  dataUrl: string;
}

async function fetchActiveHomeServiceDraft(): Promise<AppointmentRequestResponse | null> {
  const res = await apiFetch("/api/appointments/requests/active-home-service");
  if (!res.ok) return null;
  const data = await res.json() as AppointmentRequestResponse & { request: AppointmentRequestItem | null };
  return data.request ? data as AppointmentRequestResponse : null;
}

async function fetchAppointmentRequest(requestId: string): Promise<AppointmentRequestResponse | null> {
  const res = await apiFetch(`/api/appointments/requests/${encodeURIComponent(requestId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return await res.json() as AppointmentRequestResponse;
}

async function updateHomeServiceDraft(params: {
  requestId: string;
  detail: string;
  preferences: Record<string, unknown>;
  locale: string;
  finalize?: boolean;
}): Promise<AppointmentRequestResponse> {
  const res = await apiFetch(`/api/appointments/requests/${params.requestId}/home-service-draft`, {
    method: "PATCH",
    body: JSON.stringify({
      detail: params.detail,
      preferences: params.preferences,
      language: params.locale,
      finalize: params.finalize ?? false,
    }),
  });
  if (!res.ok) {
    const data = await readAppointmentErrorBody(res);
    throw new AppointmentRequestError(data.error ?? "Could not save home service draft", res.status, data.code, data.nextRoute);
  }
  return await res.json() as AppointmentRequestResponse;
}

async function discoverAppointmentOptions(params: {
  requestId: string;
}): Promise<AppointmentRequestResponse> {
  const res = await apiFetch(`/api/appointments/requests/${params.requestId}/discover-options`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await readAppointmentErrorBody(res);
    throw new AppointmentRequestError(data.error ?? "Could not look for appointment options", res.status, data.code, data.nextRoute);
  }
  return await res.json() as AppointmentRequestResponse;
}

async function addAppointmentBookingSiteOption(params: {
  requestId: string;
  system: NonNullable<AppointmentDiscoveryMeta["reservation_systems"]>[number];
}): Promise<AppointmentOptionResponse> {
  const res = await apiFetch(`/api/appointments/requests/${params.requestId}/options`, {
    method: "POST",
    body: JSON.stringify({
      provider_source: "external",
      provider_snapshot: {
        source: "reservation_system",
        name: params.system.name,
        category: params.system.category,
        booking_url: params.system.url,
        url: params.system.url,
        preferred_channel: "booking_url",
        notes: "Booking-site fallback prepared for Concierge review.",
      },
      match_reason: "Booking-site fallback. VYVA will review before opening or submitting any form.",
      available_channels: ["booking_url", "manual"],
      rank: 40,
      select: true,
    }),
  });
  if (!res.ok) {
    const data = await readAppointmentErrorBody(res);
    throw new AppointmentRequestError(data.error ?? "Could not prepare booking site", res.status, data.code, data.nextRoute);
  }
  return await res.json() as AppointmentOptionResponse;
}

async function confirmAppointmentAttempt(params: {
  requestId: string;
  optionId: string;
  channel: AppointmentChannel;
  shareDetails?: {
    share_home_address: boolean;
    photo?: { name: string; type: "image/jpeg" | "image/png" | "image/webp"; data_url: string };
  };
}): Promise<AppointmentAttemptResponse> {
  const res = await apiFetch(`/api/appointments/requests/${params.requestId}/confirm-attempt`, {
    method: "POST",
    body: JSON.stringify({
      option_id: params.optionId,
      channel: params.channel,
      share_details: params.shareDetails,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not confirm appointment attempt");
  }
  return await res.json() as AppointmentAttemptResponse;
}

async function markAppointmentBooked(params: {
  requestId: string;
  scheduledFor: string;
  timezone: string;
  providerName?: string;
  location?: string;
  notes?: string;
}): Promise<{ scheduled_event?: unknown; mission?: AppointmentMissionState }> {
  const scheduledDate = new Date(params.scheduledFor);
  const res = await apiFetch(`/api/appointments/requests/${params.requestId}/mark-booked`, {
    method: "POST",
    body: JSON.stringify({
      scheduled_for: scheduledDate.toISOString(),
      timezone: params.timezone,
      provider_name: params.providerName,
      location: params.location,
      notes: params.notes,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not save appointment");
  }
  return await res.json() as { scheduled_event?: unknown; mission?: AppointmentMissionState };
}

async function saveConfirmedAppointmentFromProviderReply(params: {
  item: ConciergePendingItem;
  form: ProviderReplyForm;
  timezone: string;
  isSpanish: boolean;
}): Promise<{
  event?: unknown;
  taskUpdate?: unknown;
  completionStatus: "reply_received" | "review_pending";
  completionError?: string | null;
  savedFlow: "appointment";
}> {
  const { item, form } = params;
  const scheduledDate = new Date(form.scheduledFor);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error(params.isSpanish ? "Usa una fecha y hora validas." : "Use a valid date and time.");
  }

  const payload = providerReplyOutcomePayload(item, form);
  const providerName = String(payload.provider_name || item.provider_name || (params.isSpanish ? "clinica" : "clinic"));
  const providerReply = form.providerReply.trim();
  const reference = form.reference.trim();
  const price = form.price.trim();
  const followUp = form.followUp.trim();
  const notes = form.notes.trim();
  const appointmentType = payloadString(item.action_payload, ["appointment_type", "type"]) || "medical";
  const reason = payloadString(item.action_payload, ["appointment_reason", "reason", "detail", "notes"]) || item.action_summary;
  const location = form.location.trim() || payloadString(item.action_payload, ["location", "address", "home_address"]) || null;
  const description = [
    reason ? `Reason: ${reason}` : "",
    providerReply ? `Provider reply: ${providerReply}` : "",
    price ? `Price: ${price}` : "",
    followUp ? `Follow-up: ${followUp}` : "",
    reference ? `Reference: ${reference}` : "",
    notes ? `Notes: ${notes}` : "",
  ].filter(Boolean).join("\n").slice(0, 1000);

  const res = await apiFetch("/api/profile/scheduled-events", {
    method: "POST",
    body: JSON.stringify({
      event_type: "appointment",
      title: `Appointment with ${providerName}`,
      description: description || null,
      channel: "app",
      scheduled_for: scheduledDate.toISOString(),
      timezone: params.timezone,
      recurrence: "none",
      status: "upcoming",
      source: "concierge",
      metadata: {
        ...payload,
        flow_reference: MEDICAL_APPOINTMENT_FLOW_REFERENCE,
        pending_id: item.id,
        appointment_type: appointmentType,
        provider_name: providerName,
        provider_phone: payload.provider_phone ?? item.provider_phone ?? null,
        provider_reply: providerReply || null,
        reference: reference || null,
        location,
        notes: notes || null,
        scheduled_for: scheduledDate.toISOString(),
      },
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not save appointment");
  }

  const saved = await res.json() as { event?: unknown };
  const scheduledEventId = isRecord(saved.event) && typeof saved.event.id === "string" ? saved.event.id : null;
  try {
    const taskUpdate = await patchPendingConciergeAction({
      pendingId: item.id,
      actionPayload: providerReplyOpenTaskPayload(item, form, params.isSpanish, {
        flow_reference: MEDICAL_APPOINTMENT_FLOW_REFERENCE,
        appointment_type: appointmentType,
        scheduled_for: scheduledDate.toISOString(),
        scheduled_event_id: scheduledEventId,
      }),
    });
    return { ...saved, taskUpdate, completionStatus: "reply_received", savedFlow: "appointment" };
  } catch (error) {
    return {
      ...saved,
      completionStatus: "review_pending",
      completionError: error instanceof Error ? error.message : "Could not update pending task",
      savedFlow: "appointment",
    };
  }
}

async function saveConfirmedHomeServiceFromProviderReply(params: {
  item: ConciergePendingItem;
  form: ProviderReplyForm;
  timezone: string;
  locale: string;
  isSpanish: boolean;
}): Promise<{
  event?: unknown;
  taskUpdate?: unknown;
  completionStatus: "reply_received" | "review_pending";
  completionError?: string | null;
  savedFlow: "home_service";
}> {
  const { item, form } = params;
  const scheduledDate = new Date(form.scheduledFor);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error(params.isSpanish ? "Usa una fecha y hora validas." : "Use a valid date and time.");
  }

  const payload = providerReplyOutcomePayload(item, form);
  const flowReference = isConciergeFlowReference(payload.flow_reference)
    ? payload.flow_reference
    : CONCIERGE_FLOW_REFERENCES.homeService;
  const providerName = String(payload.provider_name || item.provider_name || (params.isSpanish ? "proveedor" : "provider"));
  const serviceType = normalizeHomeServiceType(payloadString(item.action_payload, ["service_type", "service_label", "service_needed"]) || item.action_summary);
  const serviceLabel = payloadString(item.action_payload, ["service_label", "service_needed"]) || homeServiceTypeLabel(serviceType, params.locale);
  const problem = payloadString(item.action_payload, ["problem_summary", "reason", "detail", "service_needed"]) || item.action_summary;
  const urgency = payloadString(item.action_payload, ["urgency", "priority", "requested_time"]);
  const accessNotes = payloadString(item.action_payload, ["home_access_or_safety_notes", "access_notes", "safety_notes"]);
  const providerReply = form.providerReply.trim();
  const reference = form.reference.trim();
  const explicitPrice = form.price.trim();
  const followUp = form.followUp.trim();
  const notes = form.notes.trim();
  const location = form.location.trim() || payloadString(item.action_payload, ["location", "address", "home_address"]) || null;
  const estimatedCost = explicitPrice || estimateFromHomeServiceReply(providerReply, notes);
  const description = [
    problem ? `Problem: ${problem}` : "",
    urgency ? `Urgency: ${urgency}` : "",
    accessNotes ? `Access/safety: ${accessNotes}` : "",
    providerReply ? `Provider reply: ${providerReply}` : "",
    estimatedCost ? `Estimate: ${estimatedCost}` : "",
    followUp ? `Follow-up: ${followUp}` : "",
    reference ? `Reference: ${reference}` : "",
    notes ? `Notes: ${notes}` : "",
  ].filter(Boolean).join("\n").slice(0, 1000);

  const res = await apiFetch("/api/profile/scheduled-events", {
    method: "POST",
    body: JSON.stringify({
      event_type: "home_service",
      title: `${serviceLabel} with ${providerName}`,
      description: description || null,
      channel: "app",
      scheduled_for: scheduledDate.toISOString(),
      timezone: params.timezone,
      recurrence: "none",
      status: "upcoming",
      source: "concierge",
      metadata: {
        ...payload,
        flow_reference: flowReference,
        pending_id: item.id,
        appointment_type: "home-service",
        provider_name: providerName,
        provider_phone: payload.provider_phone ?? item.provider_phone ?? null,
        service_type: serviceType,
        service_label: serviceLabel,
        problem_summary: problem || null,
        urgency: urgency || null,
        estimated_cost: estimatedCost,
        provider_reply: providerReply || null,
        reference: reference || null,
        location,
        notes: notes || null,
        home_access_or_safety_notes: accessNotes || null,
        scheduled_for: scheduledDate.toISOString(),
      },
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not save home service visit");
  }

  const saved = await res.json() as { event?: unknown };
  const scheduledEventId = isRecord(saved.event) && typeof saved.event.id === "string" ? saved.event.id : null;
  try {
    const taskUpdate = await patchPendingConciergeAction({
      pendingId: item.id,
      actionPayload: providerReplyOpenTaskPayload(item, form, params.isSpanish, {
        flow_reference: flowReference,
        appointment_type: "home-service",
        provider_name: providerName,
        service_type: serviceType,
        service_label: serviceLabel,
        problem_summary: problem || null,
        urgency: urgency || null,
        estimated_cost: estimatedCost,
        scheduled_for: scheduledDate.toISOString(),
        scheduled_event_id: scheduledEventId,
      }),
    });
    return { ...saved, taskUpdate, completionStatus: "reply_received", savedFlow: "home_service" };
  } catch (error) {
    return {
      ...saved,
      completionStatus: "review_pending",
      completionError: error instanceof Error ? error.message : "Could not update pending task",
      savedFlow: "home_service",
    };
  }
}

async function fetchTransportOptions(params: {
  pickupAddress: string;
  destinationAddress: string;
  requestedTime: string;
  mobilityNeeds: string[];
  locale: string;
}): Promise<TransportOptionsResponse> {
  const res = await apiFetch("/api/transport/options", {
    method: "POST",
    body: JSON.stringify({
      pickup: params.pickupAddress.trim() ? { address: params.pickupAddress.trim() } : undefined,
      destination: params.destinationAddress.trim() ? { address: params.destinationAddress.trim() } : undefined,
      requestedTime: params.requestedTime.trim() || "now",
      purpose: "medical",
      mobilityNeeds: params.mobilityNeeds,
      language: params.locale,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return await res.json() as TransportOptionsResponse;
}

function cleanContactValue(value?: string | null): string {
  return value?.trim() ?? "";
}

function normalizeProviderChannel(value?: string | null): AppointmentChannel | "" {
  const normalized = cleanContactValue(value).toLowerCase().replace("-", "_");
  if (normalized === "booking_link") return "booking_url";
  if (normalized === "booking_url" || normalized === "phone" || normalized === "whatsapp" || normalized === "email" || normalized === "manual") {
    return normalized;
  }
  return "";
}

function preferredChannelForContacts(params: {
  preferredChannel?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  bookingUrl?: string | null;
  fallbackActions?: TransportAction[];
}): AppointmentChannel {
  const explicit = normalizeProviderChannel(params.preferredChannel);
  if (explicit) return explicit;
  if (cleanContactValue(params.bookingUrl)) return "booking_url";
  if (cleanContactValue(params.whatsapp)) return "whatsapp";
  if (cleanContactValue(params.email)) return "email";
  if (cleanContactValue(params.phone)) return "phone";
  if (params.fallbackActions?.includes("draft_message")) return "whatsapp";
  if (params.fallbackActions?.includes("open_url")) return "booking_url";
  return "manual";
}

function toolFromPreferredChannel(channel: AppointmentChannel): ConciergeToolRequirement {
  if (channel === "booking_url") return "booking_link";
  if (channel === "phone") return "phone_call";
  if (channel === "whatsapp") return "whatsapp";
  if (channel === "email") return "email";
  return "operator_review";
}

function preferredToolForTransportOption(option: TransportOption): ConciergeToolRequirement {
  const bookingUrl = cleanContactValue(option.bookingUrl || (option.kind === "ride_app" ? option.url : ""));
  const channel = preferredChannelForContacts({
    preferredChannel: option.preferredChannel,
    phone: option.phone,
    email: option.email,
    whatsapp: option.whatsapp,
    bookingUrl,
    fallbackActions: option.actions,
  });
  const tool = toolFromPreferredChannel(channel);
  return tool === "operator_review" ? preferredToolFromTransportActions(option.actions) : tool;
}

function transportDraftMessage(params: {
  pickupAddress: string;
  destinationAddress: string;
  requestedTime: string;
  mobilityNeeds: string[];
  qualityCriteria: ProviderSearchCriterionKey[];
}): string {
  const criteria = providerCriterionLabels(params.qualityCriteria, false).join(", ");
  const parts = [
    "Hello, I would like to arrange a ride.",
    params.pickupAddress.trim() ? `Pickup: ${params.pickupAddress.trim()}.` : "",
    params.destinationAddress.trim() ? `Destination: ${params.destinationAddress.trim()}.` : "",
    params.requestedTime.trim() ? `Time: ${params.requestedTime.trim()}.` : "",
    params.mobilityNeeds.length ? `Mobility needs: ${params.mobilityNeeds.join(", ")}.` : "",
    criteria ? `Priorities: ${criteria}.` : "",
    "Please confirm availability and the next step before anything is booked.",
  ].filter(Boolean);
  return parts.join(" ");
}

function otcPharmacyDraftMessage(params: {
  itemText: string;
  fulfillmentPreference: string;
  requestedTime: string;
  notes: string;
  qualityCriteria: ProviderSearchCriterionKey[];
}): string {
  const criteria = providerCriterionLabels(params.qualityCriteria, false).join(", ");
  const parts = [
    `Hello, I would like help with over-the-counter pharmacy items: ${params.itemText.trim() || "items to confirm"}.`,
    `Preference: ${params.fulfillmentPreference}.`,
    params.requestedTime.trim() ? `Timing: ${params.requestedTime.trim()}.` : "",
    params.notes.trim() ? `Notes: ${params.notes.trim()}.` : "",
    criteria ? `Priorities: ${criteria}.` : "",
    "Please confirm availability and cost before preparing anything.",
  ].filter(Boolean);
  return parts.join(" ");
}

async function prepareTransportConciergeAction(params: {
  option: TransportOption;
  pickupAddress: string;
  destinationAddress: string;
  requestedTime: string;
  mobilityNeeds: string[];
  hasSavedMobilityInfo: boolean;
  hasSavedTransportProvider: boolean;
  savedTransportProviderName: string;
  locale: string;
}) {
  const bookingUrl = cleanContactValue(params.option.bookingUrl || (params.option.kind === "ride_app" ? params.option.url : ""));
  const preferredChannel = preferredChannelForContacts({
    preferredChannel: params.option.preferredChannel,
    phone: params.option.phone,
    email: params.option.email,
    whatsapp: params.option.whatsapp,
    bookingUrl,
    fallbackActions: params.option.actions,
  });
  const messageBody = transportDraftMessage({
    pickupAddress: params.pickupAddress,
    destinationAddress: params.destinationAddress,
    requestedTime: params.requestedTime,
    mobilityNeeds: params.mobilityNeeds,
    qualityCriteria: TRANSPORT_PROVIDER_QUALITY_CRITERIA,
  });
  const summaryParts = [
    params.option.providerName || params.option.label,
    params.destinationAddress.trim() ? `to ${params.destinationAddress.trim()}` : "",
    params.requestedTime.trim() ? `at ${params.requestedTime.trim()}` : "",
  ].filter(Boolean);

  const res = await apiFetch("/api/concierge/actions/trigger", {
    method: "POST",
    body: JSON.stringify({
      use_case: "book_ride",
      provider_name: params.option.providerName || params.option.label,
      provider_phone: params.option.phone ?? null,
      found_externally: params.option.kind !== "saved_provider",
      action_summary: `Transport option prepared: ${summaryParts.join(" ") || params.option.label}.`,
      action_payload: {
        pickup_address: params.pickupAddress.trim(),
        destination_address: params.destinationAddress.trim(),
        requested_time: params.requestedTime.trim() || "now",
        mobility_needs: params.mobilityNeeds,
        mobility_info_source: params.hasSavedMobilityInfo ? "profile" : "session",
        option_kind: params.option.kind,
        provider_url: params.option.url,
        provider_email: cleanContactValue(params.option.email) || null,
        provider_whatsapp: cleanContactValue(params.option.whatsapp) || null,
        booking_url: bookingUrl || null,
        preferred_channel: preferredChannel,
        execution_channel: preferredChannel,
        live_handoff_flow: "transport_booking_v1",
        live_handoff_status: "ready",
        handoff_readiness: {
          provider_saved: params.option.kind === "saved_provider" || params.hasSavedTransportProvider,
          provider_name: params.option.providerName || params.option.label,
          contact_channel: preferredChannel,
          has_contact_channel: preferredChannel !== "manual",
          has_pickup: Boolean(params.pickupAddress.trim()),
          has_destination: Boolean(params.destinationAddress.trim()),
          has_time: Boolean(params.requestedTime.trim() || "now"),
          has_mobility_needs: params.hasSavedMobilityInfo || params.mobilityNeeds.length > 0,
          final_confirmation_required: true,
        },
        email_subject: "Ride request",
        email_body: messageBody,
        whatsapp_message: messageBody,
        draft_message: messageBody,
        criteria: TRANSPORT_PROVIDER_QUALITY_CRITERIA,
        criteria_labels: providerCriterionLabels(TRANSPORT_PROVIDER_QUALITY_CRITERIA, false),
        criteria_summary: providerCriterionLabels(TRANSPORT_PROVIDER_QUALITY_CRITERIA, params.locale.startsWith("es")).join(", "),
        saved_transport_provider_first: params.hasSavedTransportProvider,
        saved_transport_provider_name: params.savedTransportProviderName,
      },
      language: params.locale,
      trigger_source: "user_request",
      auto_start: false,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not prepare transport request");
  }
  return await res.json() as TransportPreparedResponse;
}

async function saveConfirmedRide(params: {
  option: TransportOption;
  pendingId?: string | null;
  scheduledFor: string;
  timezone: string;
  pickupAddress: string;
  destinationAddress: string;
  requestedTime: string;
  mobilityNeeds: string[];
  providerReply: string;
  priceEstimate: string;
  bookingReference: string;
  notes: string;
}): Promise<{
  event?: unknown;
  completion?: unknown;
  completionStatus: "closed" | "none" | "review_pending";
  completionError?: string | null;
}> {
  const scheduledDate = new Date(params.scheduledFor);
  const providerName = params.option.providerName || params.option.label;
  const description = [
    `Pickup: ${params.pickupAddress.trim() || "To confirm"}`,
    `Destination: ${params.destinationAddress.trim() || "To confirm"}`,
    params.requestedTime.trim() ? `Requested time: ${params.requestedTime.trim()}` : "",
    params.providerReply.trim() ? `Provider reply: ${params.providerReply.trim()}` : "",
    params.priceEstimate.trim() ? `Price: ${params.priceEstimate.trim()}` : "",
    params.bookingReference.trim() ? `Reference: ${params.bookingReference.trim()}` : "",
    params.mobilityNeeds.length ? `Mobility needs: ${params.mobilityNeeds.join(", ")}` : "",
    params.notes.trim() ? `Notes: ${params.notes.trim()}` : "",
  ].filter(Boolean).join("\n").slice(0, 1000);

  const res = await apiFetch("/api/profile/scheduled-events", {
    method: "POST",
    body: JSON.stringify({
      event_type: "transport",
      title: `Ride with ${providerName}`,
      description,
      channel: "app",
      scheduled_for: scheduledDate.toISOString(),
      timezone: params.timezone,
      recurrence: "none",
      status: "upcoming",
      source: "concierge",
      metadata: {
        flow_reference: TRANSPORT_BOOKING_FLOW_REFERENCE,
        pending_id: params.pendingId ?? null,
        provider_name: providerName,
        provider_phone: params.option.phone ?? null,
        provider_email: params.option.email ?? null,
        provider_whatsapp: params.option.whatsapp ?? null,
        booking_url: params.option.bookingUrl || (params.option.kind === "ride_app" ? params.option.url : null) || null,
        option_kind: params.option.kind,
        criteria: TRANSPORT_PROVIDER_QUALITY_CRITERIA,
        criteria_labels: providerCriterionLabels(TRANSPORT_PROVIDER_QUALITY_CRITERIA, false),
        pickup_address: params.pickupAddress.trim(),
        destination_address: params.destinationAddress.trim(),
        requested_time: params.requestedTime.trim() || "now",
        mobility_needs: params.mobilityNeeds,
        provider_reply: params.providerReply.trim(),
        price_estimate: params.priceEstimate.trim(),
        booking_reference: params.bookingReference.trim(),
        notes: params.notes.trim(),
      },
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not save confirmed ride");
  }
  const saved = await res.json() as { event?: unknown };
  if (!params.pendingId) return { ...saved, completionStatus: "none" };

  try {
    const completion = await completePendingConciergeAction({
      pendingId: params.pendingId,
      outcomeSummary: `Ride saved with ${providerName}.`,
      outcomePayload: {
        flow_reference: TRANSPORT_BOOKING_FLOW_REFERENCE,
        live_handoff_flow: "transport_booking_v1",
        live_handoff_status: "completed",
        live_handoff_outcome: "ride_confirmed",
        scheduled_for: scheduledDate.toISOString(),
        provider_name: providerName,
        provider_reply: params.providerReply.trim(),
        price_estimate: params.priceEstimate.trim(),
        booking_reference: params.bookingReference.trim(),
        criteria: TRANSPORT_PROVIDER_QUALITY_CRITERIA,
        criteria_labels: providerCriterionLabels(TRANSPORT_PROVIDER_QUALITY_CRITERIA, false),
        pickup_address: params.pickupAddress.trim(),
        destination_address: params.destinationAddress.trim(),
        requested_time: params.requestedTime.trim() || "now",
      },
    });
    return { ...saved, completion, completionStatus: "closed" };
  } catch (error) {
    return {
      ...saved,
      completionStatus: "review_pending",
      completionError: error instanceof Error ? error.message : "Could not close pending task",
    };
  }
}

async function prepareOtcPharmacyConciergeAction(params: {
  pharmacyName: string;
  providerPhone?: string | null;
  providerEmail?: string | null;
  providerWhatsapp?: string | null;
  providerBookingUrl?: string | null;
  preferredChannel?: string | null;
  itemText: string;
  fulfillmentPreference: string;
  requestedTime: string;
  notes: string;
  locale: string;
}) {
  const itemText = params.itemText.trim();
  const providerBookingUrl = cleanContactValue(params.providerBookingUrl);
  const preferredChannel = preferredChannelForContacts({
    preferredChannel: params.preferredChannel,
    phone: params.providerPhone,
    email: params.providerEmail,
    whatsapp: params.providerWhatsapp,
    bookingUrl: providerBookingUrl,
  });
  const messageBody = otcPharmacyDraftMessage({
    itemText,
    fulfillmentPreference: params.fulfillmentPreference,
    requestedTime: params.requestedTime,
    notes: params.notes,
    qualityCriteria: OTC_PHARMACY_QUALITY_CRITERIA,
  });
  const res = await apiFetch("/api/concierge/actions/trigger", {
    method: "POST",
    body: JSON.stringify({
      use_case: "order_medicine",
      provider_name: params.pharmacyName,
      provider_phone: cleanContactValue(params.providerPhone) || null,
      found_externally: false,
      action_summary: `OTC pharmacy request prepared: ${itemText || "items"} via ${params.pharmacyName}.`,
      action_payload: {
        pharmacy_name: params.pharmacyName,
        provider_email: cleanContactValue(params.providerEmail) || null,
        provider_whatsapp: cleanContactValue(params.providerWhatsapp) || null,
        booking_url: providerBookingUrl || null,
        preferred_channel: preferredChannel,
        execution_channel: preferredChannel,
        email_subject: "OTC pharmacy request",
        email_body: messageBody,
        whatsapp_message: messageBody,
        draft_message: messageBody,
        criteria: OTC_PHARMACY_QUALITY_CRITERIA,
        criteria_labels: providerCriterionLabels(OTC_PHARMACY_QUALITY_CRITERIA, false),
        criteria_summary: providerCriterionLabels(OTC_PHARMACY_QUALITY_CRITERIA, params.locale.startsWith("es")).join(", "),
        item_text: itemText,
        item_scope: "over_the_counter_only",
        prescription_items_allowed: false,
        fulfillment_preference: params.fulfillmentPreference,
        requested_time: params.requestedTime.trim() || "today",
        notes: params.notes.trim(),
        confirmation_required_before_contact: true,
      },
      language: params.locale,
      trigger_source: "user_request",
      auto_start: false,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not prepare OTC pharmacy request");
  }
  return await res.json() as OtcPreparedResponse;
}

async function prepareToolGatedConciergeTask(params: {
  prefill: ConciergeRoutePrefill;
  readiness: ConciergeToolReadinessResult;
  locale: string;
}) {
  const actionLabel = params.prefill.actionLabel?.trim() || routePrefillTaskActionLabel(
    params.readiness.requestedTool,
    params.locale.startsWith("es"),
  );
  const summary = params.prefill.summary?.trim() || `${actionLabel} prepared for VYVA review.`;
  const structuredPayload = params.prefill.payload ?? {};
  const payloadFlowReference = typeof structuredPayload.flow_reference === "string" && isConciergeFlowReference(structuredPayload.flow_reference)
    ? structuredPayload.flow_reference
    : undefined;
  const flowReference = params.prefill.flowReference ?? payloadFlowReference ?? CONCIERGE_FLOW_REFERENCES.toolGatedTask;
  const res = await apiFetch("/api/concierge/actions/trigger", {
    method: "POST",
    body: JSON.stringify({
      use_case: params.prefill.useCase ?? "paperwork",
      provider_name: "VYVA review",
      provider_phone: null,
      found_externally: false,
      action_summary: summary,
      action_payload: {
        ...structuredPayload,
        flow_reference: flowReference,
        requested_tool: params.readiness.requestedTool,
        active_tool: params.readiness.activeTool,
        readiness_status: params.readiness.status,
        execution_channel: "manual",
        action_label: actionLabel,
        draft_message: params.prefill.message,
        provider_search_mode: params.prefill.providerSearchMode ?? structuredPayload.provider_search_mode ?? null,
        provider_search_query: params.prefill.providerSearchQuery ?? structuredPayload.provider_search_query ?? null,
        criteria: params.prefill.providerSearchCriteria?.length ? params.prefill.providerSearchCriteria : structuredPayload.criteria ?? null,
        source: params.prefill.source ?? structuredPayload.source ?? "user_request",
        confirmation_required_before_action: true,
        review_fallback: params.readiness.activeTool === "operator_review",
        no_external_action_without_confirmation: true,
        user_confirmed: false,
      },
      language: params.locale,
      trigger_source: "user_request",
      auto_start: false,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not prepare concierge task");
  }
  return await res.json() as PreparedTaskResponse;
}

async function saveCompletedOtcPharmacyRequest(params: {
  pendingId: string;
  pharmacyName: string;
  itemText: string;
  fulfillmentPreference: string;
  requestedTime: string;
  availability: string;
  costEstimate: string;
  fulfillmentNote: string;
  reference: string;
  notes: string;
}) {
  return completePendingConciergeAction({
    pendingId: params.pendingId,
    outcomeSummary: `OTC pharmacy request saved with ${params.pharmacyName}.`,
    outcomePayload: {
      flow_reference: OTC_PHARMACY_FLOW_REFERENCE,
      pharmacy_name: params.pharmacyName,
      item_text: params.itemText.trim(),
      item_scope: "over_the_counter_only",
      prescription_items_allowed: false,
      criteria: OTC_PHARMACY_QUALITY_CRITERIA,
      criteria_labels: providerCriterionLabels(OTC_PHARMACY_QUALITY_CRITERIA, false),
      fulfillment_preference: params.fulfillmentPreference,
      requested_time: params.requestedTime.trim() || "today",
      availability: params.availability.trim(),
      cost_estimate: params.costEstimate.trim(),
      fulfillment_note: params.fulfillmentNote.trim(),
      pharmacy_reference: params.reference.trim(),
      notes: params.notes.trim(),
    },
  });
}

async function searchOffers(
  query: string,
  locale: string,
  documentContext?: BillDocumentAnalysis,
  recheckContext?: ProviderRecheckContext,
  providerMode?: ProviderSearchMode | null,
): Promise<OffersSearchResponse> {
  const res = await apiFetch("/api/offers/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      locale,
      provider_mode: providerMode ?? undefined,
      document_context: documentContext,
      recheck_context: recheckContext
        ? {
            preferred_sources: recheckContext.preferredSources,
            criteria: recheckContext.criteria,
            providers: recheckContext.providers.map((provider) => ({
              id: provider.id,
              name: provider.name,
              official_website: provider.officialWebsite,
              directory_url: provider.directoryUrl,
            })),
          }
        : undefined,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return await res.json() as OffersSearchResponse;
}

async function saveProviderShortlistAction(params: {
  options: ProviderComparisonOption[];
  mode: ProviderSearchMode;
  query: string;
  criteria: ProviderSearchCriterionKey[];
  flowReference: ConciergeFlowReference;
  locale: string;
}) {
  const payload = buildProviderShortlistPayload(params.options, {
    mode: params.mode,
      query: params.query,
      criteria: params.criteria,
      flowReference: params.flowReference,
      locale: params.locale,
      resumeContext: {
      kind: "provider_search",
      mode: params.mode,
      query: params.query,
      criteria: params.criteria,
    },
  });
  const names = params.options.map((option) => option.name).join(", ");
  const trigger = await apiFetch("/api/concierge/actions/trigger", {
    method: "POST",
    body: JSON.stringify({
      use_case: params.mode === "shopping-seller" ? "find_offers" : "find_provider",
      provider_name: params.options[0]?.name ?? null,
      provider_phone: params.options[0]?.contact.phone ?? null,
      found_externally: true,
      action_summary: `Provider shortlist saved: ${names}.`,
      action_payload: payload,
      language: params.locale,
      trigger_source: "user_request",
      auto_start: false,
    }),
  });
  if (!trigger.ok) {
    const data = (await trigger.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not save provider shortlist");
  }
  const result = await trigger.json() as { pendingId?: string | null };
  if (!result.pendingId) throw new Error("Could not save provider shortlist");
  return { pendingId: result.pendingId };
}

function compressBillImage(file: File, targetChars = 1_500_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas context unavailable"));

      const emergencyMode = targetChars <= 120_000;
      const qualities = emergencyMode
        ? [0.48, 0.4, 0.32, 0.24, 0.16, 0.1]
        : [0.86, 0.78, 0.68, 0.58, 0.48, 0.38];
      const maxSizes = emergencyMode
        ? [620, 520, 420, 340, 260, 200, 160]
        : [1900, 1600, 1300, 1050, 850];
      let best = "";

      for (const maxSize of maxSizes) {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        for (const quality of qualities) {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          if (!best || dataUrl.length < best.length) best = dataUrl;
          if (dataUrl.length <= targetChars) {
            resolve(dataUrl);
            return;
          }
        }
      }

      resolve(best);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No he podido abrir el archivo."));
    reader.readAsDataURL(file);
  });
}

function billReaderEndpoints(): string[] {
  return ["/api/bill-reader/analyze", "/api/offers/analyze-document"];
}

function billReaderError(message: string, status?: number): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

async function analyzeBillDocument(image: string, locale: string): Promise<BillDocumentAnalysis> {
  let lastResponse: Response | null = null;

  for (const endpoint of billReaderEndpoints()) {
    const res = await apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ image, locale }),
    }).catch(() => null);

    if (!res) continue;
    lastResponse = res;
    if (res.status === 404) continue;
    if (res.ok) return await res.json() as BillDocumentAnalysis;
    break;
  }

  const res = lastResponse;
  if (!res) {
    throw billReaderError(locale.startsWith("es")
      ? "No he podido conectar con el lector de facturas. Reinicie la app y pruebe de nuevo."
      : "I could not connect to the bill reader. Restart the app and try again.");
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 404) {
      throw billReaderError(locale.startsWith("es")
        ? "El lector de facturas todavia no esta activo en el servidor. Actualice el codigo y reinicie la app."
        : "The bill reader is not active on the server yet. Pull the latest code and restart the app.", res.status);
    }
    if (res.status === 413) {
      const sizeMb = (image.length / 1024 / 1024).toFixed(1);
      throw billReaderError(locale.startsWith("es")
        ? `La imagen no ha podido enviarse al lector (${sizeMb} MB). Voy a intentarlo con una version mas ligera.`
        : `The image could not be sent to the reader (${sizeMb} MB). I will try a lighter version.`, res.status);
    }
    throw billReaderError(data?.error ?? `Request failed: ${res.status}`, res.status);
  }

  return await res.json() as BillDocumentAnalysis;
}

function billAnalysisToUtilityExtracted(analysis: BillDocumentAnalysis): Record<string, unknown> {
  return {
    document_type: analysis.document_type,
    provider_name: analysis.provider_name,
    service_address: analysis.service_address,
    postcode: analysis.postcode,
    cups: analysis.cups,
    tariff_or_plan: analysis.tariff_or_plan,
    billing_period: analysis.billing_period,
    billing_period_days: analysis.billing_period_days,
    total_amount: analysis.total_amount,
    power_kw: analysis.power_kw,
    usage: analysis.usage,
    unit_prices: analysis.unit_prices,
    confidence: analysis.confidence,
    missing_fields: analysis.missing_fields,
  };
}

async function normalizeUtilityReview(params: {
  input_method: UtilityInputMethod;
  locale: string;
  extracted_data?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  voice_answers?: Record<string, unknown>;
}): Promise<{ normalized_input: NormalizedUtilityInput; can_compare: boolean; next_missing_field?: string }> {
  const res = await apiFetch("/api/utilities/normalize", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return await res.json();
}

async function compareUtilityReview(params: {
  input_method: UtilityInputMethod;
  locale: string;
  normalized_input: NormalizedUtilityInput;
  extracted_data?: Record<string, unknown>;
}): Promise<UtilityCompareResponse> {
  const res = await apiFetch("/api/utilities/compare", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return await res.json() as UtilityCompareResponse;
}

function billDocumentLabel(type: BillDocumentAnalysis["document_type"], es: boolean): string {
  switch (type) {
    case "electricity_bill":
      return es ? "Factura de luz" : "Electricity bill";
    case "gas_bill":
      return es ? "Factura de gas" : "Gas bill";
    case "internet_phone_bill":
      return es ? "Internet / telefono" : "Internet / phone";
    case "insurance_policy":
      return es ? "Seguro" : "Insurance";
    case "home_service_invoice":
      return es ? "Servicio en casa" : "Home service";
    default:
      return es ? "Documento no identificado" : "Unidentified document";
  }
}

function isCnmcUtilityBillDocument(type: BillDocumentAnalysis["document_type"]): boolean {
  return type === "electricity_bill" || type === "gas_bill";
}

function nonCnmcBillNotice(type: BillDocumentAnalysis["document_type"], es: boolean): string {
  const label = billDocumentLabel(type, es).toLowerCase();
  if (type === "internet_phone_bill") {
    return es
      ? "He detectado una factura de internet o telefono. La comparacion oficial de CNMC solo cubre luz y gas; por ahora puedo preparar una revision orientativa de servicio."
      : "I detected an internet or phone bill. The official CNMC comparison only covers electricity and gas; for now I can prepare an indicative service review.";
  }
  return es
    ? `He detectado ${label}. Esta herramienta compara oficialmente luz y gas; para este documento puedo preparar una revision orientativa.`
    : `I detected ${label}. This tool officially compares electricity and gas; for this document I can prepare an indicative review.`;
}

function shouldOpenUtilitySavingsReview(labelEs: string): boolean {
  return ["Gastos del hogar", "Reducir gastos mensuales", "Optimizar mis facturas"].includes(labelEs);
}

function providerSearchModeLabel(mode: ProviderSearchMode | null, es: boolean): string {
  if (mode === "personal-care") return es ? "cuidado personal" : "personal care";
  if (mode === "specialist") return es ? "especialista" : "specialist";
  if (mode === "residence") return es ? "residencia o centro de cuidado" : "residence or care home";
  if (mode === "care") return es ? "opciones de cuidado" : "care options";
  if (mode === "transport") return es ? "transporte" : "transport";
  if (mode === "pharmacy") return es ? "farmacia" : "pharmacy";
  if (mode === "home-service") return es ? "servicio en casa" : "home service";
  if (mode === "shopping-seller") return es ? "vendedor o tienda" : "seller or shop";
  return es ? "proveedor" : "provider";
}

function providerSearchSetupFocus(mode: ProviderSearchMode | null): string {
  if (mode === "specialist") return "doctor_clinic";
  if (mode === "transport") return "transport";
  if (mode === "pharmacy") return "pharmacy";
  if (mode === "home-service") return "home_service";
  if (mode === "residence" || mode === "personal-care" || mode === "care") return "personal_care";
  return "other";
}

function providerSearchFlowReference(mode: ProviderSearchMode | null): ConciergeFlowReference {
  if (mode === "transport") return TRANSPORT_BOOKING_FLOW_REFERENCE;
  if (mode === "pharmacy") return OTC_PHARMACY_FLOW_REFERENCE;
  if (mode === "home-service") return CONCIERGE_FLOW_REFERENCES.homeService;
  if (mode === "shopping-seller") return SHOPPING_SUPPORT_FLOW_REFERENCE;
  if (mode === "personal-care" || mode === "specialist" || mode === "residence" || mode === "care") {
    return CARE_NAVIGATION_FLOW_REFERENCE;
  }
  return CONCIERGE_FLOW_REFERENCES.toolGatedTask;
}

function providerSearchActionFlowReference(item: ConciergePendingItem): ConciergeFlowReference {
  const explicit = payloadString(item.action_payload, ["flow_reference"]);
  if (isConciergeFlowReference(explicit)) return explicit;
  return providerSearchFlowReference(providerRecoveryModeFromCategory(providerSearchCategoryFromAction(item)));
}

function providerCriterionLabels(criteria: ProviderSearchCriterionKey[], es: boolean): string[] {
  return PROVIDER_SEARCH_CRITERIA
    .filter((item) => criteria.includes(item.key))
    .map((item) => es ? item.es : item.en);
}

function buildProviderSearchQuery(query: string, criteria: ProviderSearchCriterionKey[], mode: ProviderSearchMode | null, es: boolean): string {
  if (!mode || criteria.length === 0) return query;
  const selected = PROVIDER_SEARCH_CRITERIA
    .filter((item) => criteria.includes(item.key))
    .map((item) => es ? item.queryEs : item.queryEn);
  if (selected.length === 0) return query;
  return es
    ? `${query}. Prioriza para ${providerSearchModeLabel(mode, true)}: ${selected.join(", ")}. Explica proximidad, precio, reputacion y disponibilidad. No contactar ni compartir datos sin confirmacion.`
    : `${query}. Prioritize for ${providerSearchModeLabel(mode, false)} search: ${selected.join(", ")}. Explain proximity, price, reputation, and availability. Do not contact or share details without confirmation.`;
}

function billConfidenceLabel(confidence: BillDocumentAnalysis["confidence"], es: boolean): string {
  if (confidence === "high") return es ? "alta" : "high";
  if (confidence === "medium") return es ? "media" : "medium";
  return es ? "baja" : "low";
}

function formatBillAmount(amount: number | null, currency: string | null, es: boolean): string {
  if (amount == null) return es ? "No visible" : "Not visible";
  return `${amount.toLocaleString(es ? "es-ES" : "en-GB", { maximumFractionDigits: 2 })} ${currency ?? ""}`.trim();
}

function utilityTypeLabel(type: UtilityType, es: boolean): string {
  if (type === "gas") return es ? "Gas" : "Gas";
  if (type === "dual") return es ? "Luz + gas" : "Electricity + gas";
  return es ? "Luz" : "Electricity";
}

function formatEuro(amount: number | null, es: boolean): string {
  if (amount == null) return es ? "No disponible" : "Not available";
  return `${amount.toLocaleString(es ? "es-ES" : "en-GB", { maximumFractionDigits: 2 })} €`;
}

function fieldValue(value: string | number | boolean | null | undefined, fallback: string): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Si" : "No";
  return String(value);
}

function hasFieldValue(value: string | number | boolean | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function utilityDetailLabel(field: string, es: boolean): string {
  const isEstimated = field.startsWith("estimated:");
  const key = isEstimated ? field.replace("estimated:", "") : field;
  const labels: Record<string, { es: string; en: string }> = {
    postcode: { es: "codigo postal", en: "postcode" },
    power_kw: { es: "potencia", en: "power" },
    consumption_kwh: { es: "consumo", en: "usage" },
    "estimated monthly cost or consumption_kwh": {
      es: "importe mensual o consumo",
      en: "monthly cost or usage",
    },
  };
  const label = labels[key]?.[es ? "es" : "en"] ?? key.replace(/_/g, " ");
  if (!isEstimated) return label;
  return es ? `${label} estimado` : `estimated ${label}`;
}

function billClientMessage(locale: string, key: "unsupported" | "read_failed"): string {
  const lang = locale.split("-")[0].toLowerCase();
  const messages = {
    unsupported: {
      es: "Puedo leer fotos, imagenes o PDF de facturas. Pruebe con uno de esos formatos.",
      de: "Ich kann Fotos, Bilder oder PDF-Rechnungen lesen. Bitte versuchen Sie eines dieser Formate.",
      fr: "Je peux lire des photos, images ou PDF de factures. Essayez l'un de ces formats.",
      it: "Posso leggere foto, immagini o PDF di fatture. Prova con uno di questi formati.",
      pt: "Posso ler fotos, imagens ou PDF de faturas. Tente um desses formatos.",
      en: "I can read bill photos, images, or PDFs. Please try one of those formats.",
    },
    read_failed: {
      es: "No he podido procesar la factura automaticamente. Puede rellenar los datos a mano o intentarlo de nuevo.",
      de: "Ich konnte die Rechnung nicht automatisch verarbeiten. Sie koennen die Daten manuell eingeben oder es erneut versuchen.",
      fr: "Je n'ai pas pu traiter automatiquement la facture. Vous pouvez saisir les donnees manuellement ou reessayer.",
      it: "Non sono riuscita a elaborare automaticamente la fattura. Puoi inserire i dati manualmente o riprovare.",
      pt: "Nao consegui processar automaticamente a fatura. Pode preencher os dados manualmente ou tentar novamente.",
      en: "I could not process the bill automatically. You can enter the details manually or try again.",
    },
  } as const;
  return messages[key][lang as keyof typeof messages[typeof key]] ?? messages[key].en;
}

async function confirmPendingAction(item: ConciergePendingItem) {
  const isDryRun = isConciergeDryRunPayload(item.action_payload);
  const bookingUrl = getBookingUrl(item);
  const emailDraft = getActionEmailDraft(item);
  const whatsAppDraft = getActionWhatsAppDraft(item);
  const preferredHandoffChannel = getPreferredHandoffChannel(item);
  const followUpUrl = whatsAppDraft && (preferredHandoffChannel === "whatsapp" || (!item.provider_phone && !emailDraft && !bookingUrl))
    ? whatsAppDraftHref(whatsAppDraft)
    : emailDraft && (preferredHandoffChannel === "email" || (!item.provider_phone && !bookingUrl))
      ? emailDraftHref(emailDraft)
      : !item.provider_phone && bookingUrl
        ? bookingUrl
        : "";
  const task = getConciergeExecutionTask(item);
  const channelReadiness = task?.channel_readiness ?? null;
  const liveFollowUpAllowed = Boolean(
    task &&
    channelReadiness?.channel &&
    channelReadiness.external_action_allowed,
  );

  const res = await apiFetch(`/api/concierge/actions/${item.id}/confirm`, { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Failed to confirm concierge action");
  }
  if (followUpUrl && !isDryRun && liveFollowUpAllowed) window.open(followUpUrl, "_blank", "noopener,noreferrer");
}

async function confirmPendingActionReview(item: ConciergePendingItem) {
  const res = await apiFetch(`/api/concierge/actions/${item.id}/review-confirm`, { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Failed to confirm concierge action");
  }
  return await res.json().catch(() => ({
    pendingId: item.id,
    status: item.status,
  })) as ConciergeActionConfirmationResult;
}

function guidedDetailInputTestId(question: ConciergeGuidedDetailQuestion, useFormCompatibleIds = true): string {
  if (!useFormCompatibleIds) return `input-concierge-guided-detail-${question.key}`;
  if (question.key === "destination_address") return "input-transport-destination";
  if (question.key === "pickup_address") return "input-transport-pickup";
  if (question.key === "requested_time") return "input-transport-time";
  if (question.key === "item_text") return "input-otc-item";
  if (question.key === "fulfillment_preference") return "input-otc-fulfillment-preference";
  return `input-concierge-guided-detail-${question.key}`;
}

async function updatePendingActionDetails(params: {
  item: ConciergePendingItem;
  question: ConciergeGuidedDetailQuestion;
  value: string;
}) {
  const value = params.value.trim();
  const res = await apiFetch(`/api/concierge/actions/${params.item.id}/details`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action_payload: {
        [params.question.payloadKey]: value,
      },
      answer_key: params.question.key,
      answer_value: value,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Failed to save concierge action details");
  }
}

async function cancelPendingAction(id: string) {
  const res = await apiFetch(`/api/concierge/actions/${id}/cancel`, { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Failed to cancel concierge action");
  }
}

async function saveCoverageReadiness(payload: {
  coverageType: CoverageReadinessType;
  provider: string;
  memberId: string;
  plan: string;
  notes: string;
}) {
  const res = await apiFetch("/api/profile/coverage", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => null)) as {
    error?: string;
    coverage?: CoverageReadinessSummary;
    serviceReadiness?: { hasCoverageInfo?: boolean };
  } | null;
  if (!res.ok) {
    throw new Error(data?.error ?? "Failed to save coverage details");
  }
  return data ?? {};
}

function phoneHref(phone?: string | null): string {
  const raw = phone?.trim();
  if (!raw) return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  return `tel:${normalized || raw}`;
}

function testIdSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function appointmentSnapshotText(option: AppointmentProviderOption | null | undefined, key: string): string {
  const value = option?.provider_snapshot?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function appointmentOptionName(option: AppointmentProviderOption | null | undefined, isSpanish: boolean): string {
  return appointmentSnapshotText(option, "name") || (isSpanish ? "Proveedor guardado" : "Saved provider");
}

function appointmentOptionAvailability(option: AppointmentProviderOption | null | undefined): string {
  if (!option) return "";
  const keys = ["next_available", "availability", "available_at", "opening_hours", "hours"];
  for (const key of keys) {
    const value = appointmentSnapshotText(option, key);
    if (value) return value;
  }
  return "";
}

function homeServiceCanvasOptionDescription(option: AppointmentProviderOption, isSpanish: boolean): string {
  const value = (...keys: string[]) => keys.map((key) => appointmentSnapshotText(option, key)).find(Boolean) || "";
  const unknown = isSpanish ? "No indicado" : "Unknown";
  const availability = appointmentOptionAvailability(option) || unknown;
  const price = value("call_out_fee", "callout_fee", "price", "price_or_advantage") || unknown;
  const distance = value("distance", "distance_text", "distance_or_availability") || unknown;
  const reputation = value("rating", "reputation", "trust_note") || unknown;
  return [
    `${isSpanish ? "Disponibilidad" : "Availability"}: ${availability}`,
    `${isSpanish ? "Precio" : "Price"}: ${price}`,
    `${isSpanish ? "Distancia" : "Distance"}: ${distance}`,
    `${isSpanish ? "Reputacion" : "Reputation"}: ${reputation}`,
  ].join(" · ");
}

function appointmentChannelLabel(channel: AppointmentChannel, isSpanish: boolean): string {
  switch (channel) {
    case "booking_url":
      return isSpanish ? "VYVA rellena formulario" : "VYVA fills form";
    case "phone":
      return isSpanish ? "VYVA llama" : "VYVA calls";
    case "whatsapp":
      return isSpanish ? "VYVA envia WhatsApp" : "VYVA sends WhatsApp";
    case "email":
      return isSpanish ? "VYVA envia email" : "VYVA sends email";
    case "manual":
      return isSpanish ? "VYVA gestiona" : "VYVA handles it";
    default:
      return channel;
  }
}

function toolReadinessLabel(tool: ConciergeToolReadinessResult["activeTool"], isSpanish: boolean): string {
  switch (tool) {
    case "phone_call":
      return isSpanish ? "llamada" : "call";
    case "email":
      return isSpanish ? "email" : "email";
    case "whatsapp":
      return "WhatsApp";
    case "booking_link":
      return isSpanish ? "enlace de reserva" : "booking link";
    case "camera_or_upload":
      return isSpanish ? "camara o subida" : "camera or upload";
    case "web_search":
      return isSpanish ? "busqueda web" : "web search";
    case "operator_review":
      return isSpanish ? "revision de VYVA" : "VYVA review";
    default:
      return tool;
  }
}

function toolReadinessConfirmationItem(
  readiness: ConciergeToolReadinessResult | null | undefined,
  isSpanish: boolean,
): { label: string; helper?: string } | null {
  if (!readiness) return null;
  const activeTool = toolReadinessLabel(readiness.activeTool, isSpanish);
  const requestedTool = toolReadinessLabel(readiness.requestedTool, isSpanish);

  if (readiness.status === "ready") {
    return {
      label: isSpanish ? `Herramienta lista: ${activeTool}` : `Tool ready: ${activeTool}`,
      helper: isSpanish
        ? "VYVA puede preparar esta via, pero aun pide tu confirmacion."
        : "VYVA can prepare this route, but still asks for your confirmation.",
    };
  }

  if (readiness.status === "manual_review") {
    return {
      label: isSpanish ? "Revision lista" : "Review path ready",
      helper: isSpanish
        ? `La via directa (${requestedTool}) necesita un dato o configuracion. VYVA lo prepara para revisar.`
        : `The direct route (${requestedTool}) needs a detail or setup. VYVA prepares it for review.`,
    };
  }

  return {
    label: isSpanish ? "Falta configurar una herramienta" : "Tool setup needed",
    helper: isSpanish
      ? "VYVA no actuara hasta que esta via este configurada."
      : "VYVA will not act until this route is configured.",
  };
}

function appointmentHandlingLabel(channel: AppointmentChannel | null | undefined, isSpanish: boolean): string {
  if (!channel) return isSpanish ? "VYVA prepara el camino" : "VYVA prepares the path";
  return isSpanish ? "VYVA elige la via segura" : "VYVA chooses the safe path";
}

function appointmentPreferredChannel(option: AppointmentProviderOption | null | undefined): AppointmentChannel | null {
  if (!option) return null;
  const available = option.available_channels;
  const preferred = option.provider_snapshot?.preferred_channel;
  if (typeof preferred === "string" && available.includes(preferred as AppointmentChannel)) {
    return preferred as AppointmentChannel;
  }
  return available.find((channel) => channel !== "manual") ?? available[0] ?? null;
}

function cleanProfileText(value?: string | null): string {
  return value?.trim() ?? "";
}

function profileHomeAddressLabel(profile: ConciergeProfileSummary | null | undefined): string {
  const street = cleanProfileText(profile?.street);
  const city = cleanProfileText(profile?.cityState);
  const region = cleanProfileText(profile?.region);
  const postalCode = cleanProfileText(profile?.postalCode);
  const country = cleanProfileText(profile?.country);
  const cityLine = [postalCode, city].filter(Boolean).join(" ");
  return [street, cityLine, region, country].filter(Boolean).join(", ");
}

function estimateFromHomeServiceReply(...values: Array<string | null | undefined>): string | null {
  const text = values
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  const match = text.match(/(?:EUR|€|\$|£)\s?\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s?(?:EUR|€|\$|£)/i);
  return match?.[0]?.trim() || null;
}

function appointmentConfirmationItems(params: {
  providerName: string;
  providerTrustNote: string;
  contactRoute: string;
  isMedical: boolean;
  hasCoverageInfo: boolean;
  homeAddress?: string;
  homeAccessNotes?: string;
  toolReadiness?: ConciergeToolReadinessResult | null;
  isSpanish: boolean;
}) {
  const { providerName, providerTrustNote, contactRoute, isMedical, hasCoverageInfo, homeAddress, homeAccessNotes, toolReadiness, isSpanish } = params;
  const items = [
    {
      label: isSpanish ? `Proveedor: ${providerName}` : `Provider: ${providerName}`,
      helper: providerTrustNote,
    },
    {
      label: isSpanish ? `Via de contacto: ${contactRoute}` : `Contact route: ${contactRoute}`,
      helper: isSpanish
        ? "VYVA usa esta via y se detiene antes de reservar o pagar."
        : "VYVA uses this route and stops before booking or payment.",
    },
  ];
  const readinessItem = toolReadinessConfirmationItem(toolReadiness, isSpanish);
  if (readinessItem) items.push(readinessItem);

  if (isMedical) {
    items.push({
      label: hasCoverageInfo
        ? (isSpanish ? "Seguro: guardado en perfil" : "Insurance: saved in profile")
        : (isSpanish ? "Seguro: no guardado todavia" : "Insurance: not saved yet"),
      helper: hasCoverageInfo
        ? (isSpanish
          ? "VYVA te preguntara antes de compartir cualquier dato."
          : "VYVA will ask before sharing any details.")
        : (isSpanish
          ? "Si el proveedor lo necesita, VYVA te preguntara antes de compartir datos."
          : "If the provider needs it, VYVA will ask before sharing details."),
    });
  } else {
    items.push({
      label: homeAddress?.trim()
        ? (isSpanish ? "Direccion: guardada" : "Address: saved")
        : (isSpanish ? "Direccion: pendiente" : "Address: needed"),
      helper: homeAddress?.trim()
        ? (isSpanish
          ? "VYVA usara esta direccion solo despues de tu confirmacion."
          : "VYVA uses this address only after your confirmation.")
        : (isSpanish
          ? "Anade donde debe ir el proveedor antes de contactar."
          : "Add where the provider should visit before contact."),
    });
    if (homeAccessNotes?.trim()) {
      items.push({
        label: isSpanish ? "Acceso: preparado" : "Access: prepared",
        helper: homeAccessNotes.trim(),
      });
    }
  }

  items.push(
    {
      label: isSpanish ? "Tu confirmas antes de cualquier accion final" : "You confirm before any final action",
      helper: isSpanish
        ? "No se reserva, paga ni envia nada final sin tu aprobacion."
        : "Nothing final is booked, paid, or sent without your approval.",
    },
    {
      label: isSpanish ? "Guardar cuando el proveedor confirme" : "Save once the provider confirms",
      helper: isSpanish
        ? "VYVA registra la cita solo despues de tener fecha y hora."
        : "VYVA records the appointment only after there is a date and time.",
    },
  );

  return items;
}

function savedPharmacyProviderDetails(profile: ConciergeProfileSummary | null | undefined): SavedConciergeProvider | null {
  return selectConciergeSavedProvider(profile?.savedProviders, "pharmacy");
}

function savedPharmacyName(profile: ConciergeProfileSummary | null | undefined): string {
  const pharmacy = savedPharmacyProviderDetails(profile);
  return pharmacy?.name?.trim() || "";
}

function profileHasSavedPharmacy(profile: ConciergeProfileSummary | null | undefined): boolean {
  return Boolean(savedPharmacyName(profile));
}

function savedMedicalProviderDetails(profile: ConciergeProfileSummary | null | undefined): SavedConciergeProvider | null {
  return selectConciergeSavedProvider(profile?.savedProviders, "doctor_clinic");
}

function savedMedicalProviderName(profile: ConciergeProfileSummary | null | undefined): string {
  const provider = savedMedicalProviderDetails(profile);
  return provider?.name?.trim() || "";
}

function profileHasSavedMedicalProvider(profile: ConciergeProfileSummary | null | undefined): boolean {
  return Boolean(savedMedicalProviderName(profile));
}

function savedTransportProviderDetails(profile: ConciergeProfileSummary | null | undefined): SavedConciergeProvider | null {
  return selectConciergeSavedProvider(profile?.savedProviders, "transport");
}

function savedTransportProviderName(profile: ConciergeProfileSummary | null | undefined): string {
  const provider = savedTransportProviderDetails(profile);
  return provider?.name?.trim() || "";
}

function profileHasSavedTransportProvider(profile: ConciergeProfileSummary | null | undefined): boolean {
  return Boolean(savedTransportProviderName(profile));
}

function savedHomeServiceProviderDetails(
  profile: ConciergeProfileSummary | null | undefined,
  serviceType: HomeServiceType | null,
): SavedConciergeProvider | null {
  const providers = (profile?.savedProviders ?? []).filter(savedProviderIsTrusted);
  const serviceTerms = serviceType
    ? HOME_SERVICE_TYPES.find((item) => item.key === serviceType)?.searchTerms ?? []
    : [];
  const generalTerms = [
    "home_service",
    "home service",
    "home-service",
    "repair",
    "maintenance",
    "handyman",
    "manitas",
    "plumber",
    "plumbing",
    "fontanero",
    "electrician",
    "electricista",
    "locksmith",
    "cerrajero",
    "cleaner",
    "cleaning",
    "limpieza",
  ];

  return selectConciergeSavedProvider(providers, "home_service", serviceTerms.length > 0 ? serviceTerms : generalTerms);
}

function preferredToolForSavedProvider(
  provider: SavedConciergeProvider | null,
): ConciergeToolRequirement {
  const preferredChannel = (provider?.preferredChannel || provider?.preferred_channel || "").trim().toLowerCase();
  if (preferredChannel === "booking_url") return "booking_link";
  if (preferredChannel === "phone") return "phone_call";
  if (preferredChannel === "whatsapp") return "whatsapp";
  if (preferredChannel === "email") return "email";
  if (provider?.bookingUrl?.trim() || provider?.booking_url?.trim()) return "booking_link";
  if (provider?.websiteUrl?.trim()) return "booking_link";
  if (provider?.phone?.trim()) return "phone_call";
  if (provider?.whatsapp?.trim()) return "whatsapp";
  if (provider?.email?.trim()) return "email";
  return "operator_review";
}

function transportConfirmationItems(params: {
  option: TransportOption;
  pickupAddress: string;
  destinationAddress: string;
  requestedTime: string;
  mobilityNeeds: string[];
  hasSavedMobilityInfo: boolean;
  hasSavedTransportProvider: boolean;
  savedProviderName: string;
  toolReadiness?: ConciergeToolReadinessResult | null;
  isSpanish: boolean;
}): Array<{ label: string; helper?: string }> {
  const destination = params.destinationAddress.trim() || (params.isSpanish ? "Destino pendiente" : "Destination needed");
  const pickup = params.pickupAddress.trim() || (params.isSpanish ? "Recogida pendiente" : "Pickup needed");
  const time = params.requestedTime.trim() || (params.isSpanish ? "ahora" : "now");
  const mobility = params.hasSavedMobilityInfo
    ? (params.isSpanish ? "Preferencias guardadas en el perfil" : "Mobility preferences saved in profile")
    : params.mobilityNeeds.length
      ? params.mobilityNeeds.join(", ")
      : (params.isSpanish ? "No se anadio ayuda especial" : "No extra help added");
  const providerHelper = params.option.kind === "saved_provider" || params.hasSavedTransportProvider
    ? params.savedProviderName
      ? (params.isSpanish ? `Proveedor guardado: ${params.savedProviderName}` : `Saved provider: ${params.savedProviderName}`)
      : (params.isSpanish ? "Se revisa primero el proveedor guardado" : "Saved provider is checked first")
    : (params.isSpanish ? "VYVA compara opciones seguras disponibles" : "VYVA compares safe available options");
  const criteria = providerCriterionLabels(TRANSPORT_PROVIDER_QUALITY_CRITERIA, params.isSpanish).join(", ");

  const items = [
    {
      label: params.isSpanish ? `Destino: ${destination}` : `Destination: ${destination}`,
      helper: params.isSpanish ? `Recogida: ${pickup}` : `Pickup: ${pickup}`,
    },
    {
      label: params.isSpanish ? `Hora: ${time}` : `Time: ${time}`,
      helper: mobility,
    },
    {
      label: params.isSpanish ? `Opcion: ${params.option.label}` : `Option: ${params.option.label}`,
      helper: providerHelper,
    },
    {
      label: params.isSpanish ? `Criterios: ${criteria}` : `Criteria: ${criteria}`,
      helper: params.isSpanish
        ? "VYVA compara cercania, disponibilidad, acceso, precio y reputacion."
        : "VYVA checks proximity, availability, access, price, and reputation.",
    },
  ];
  const readinessItem = toolReadinessConfirmationItem(params.toolReadiness, params.isSpanish);
  if (readinessItem) items.push(readinessItem);
  return items;
}

type FinalConfirmationField = {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "datetime-local";
  multiline?: boolean;
  testId: string;
  fullWidth?: boolean;
};

function FinalConfirmationCard({
  title,
  body,
  providerName,
  icon: Icon,
  fields,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  primaryPending,
  testId,
  primaryTestId,
  secondaryTestId,
  isSpanish,
}: {
  title: string;
  body: string;
  providerName?: string | null;
  icon: LucideIcon;
  fields: FinalConfirmationField[];
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryPending?: boolean;
  testId: string;
  primaryTestId?: string;
  secondaryTestId?: string;
  isSpanish: boolean;
}) {
  return (
    <div
      className="mt-3 rounded-[22px] border border-[#99F6E4] bg-[#F0FDFA] p-4 shadow-[0_14px_30px_rgba(13,148,136,0.10)] sm:p-5"
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-[#0F766E] shadow-sm">
          <Icon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
            {isSpanish ? "Ultimo paso" : "Final step"}
          </p>
          <h3 className="mt-1 font-body text-[18px] font-black leading-tight text-vyva-text-1">
            {title}
          </h3>
          <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
            {body}
          </p>
        </div>
      </div>

      {providerName ? (
        <div className="mt-3 rounded-[16px] border border-[#99F6E4] bg-white px-3 py-2 font-body text-[13px] font-black text-[#0F766E]">
          {providerName}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          const labelClassName = `block font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#0F766E]${
            field.fullWidth || field.multiline ? " sm:col-span-2" : ""
          }`;

          return (
            <label key={field.key} className={labelClassName}>
              {field.label}
              {field.multiline ? (
                <textarea
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-[16px] border border-[#99F6E4] bg-white px-3 py-3 font-body text-[14px] font-semibold normal-case tracking-normal text-vyva-text-1 outline-none transition focus:border-[#0F766E] focus:ring-4 focus:ring-[#14B8A6]/15"
                  data-testid={field.testId}
                />
              ) : (
                <Input
                  type={field.type ?? "text"}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  placeholder={field.placeholder}
                  className="mt-2 min-h-[48px] rounded-[16px] border-[#99F6E4] bg-white font-body text-[14px] focus-visible:ring-[#14B8A6]/20"
                  data-testid={field.testId}
                />
              )}
            </label>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryPending}
          className={VYVA_MODAL_PRIMARY_ACTION_CLASS}
          data-testid={primaryTestId}
        >
          {primaryPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CircleCheck size={16} className="mr-2" />}
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={onSecondary}
          disabled={primaryPending}
          className={`${VYVA_MODAL_SECONDARY_ACTION_CLASS} border-[#99F6E4] text-[#0F766E]`}
          data-testid={secondaryTestId}
        >
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}

function otcPharmacyConfirmationItems(params: {
  pharmacyName: string;
  itemText: string;
  fulfillmentPreference: string;
  requestedTime: string;
  notes: string;
  toolReadiness?: ConciergeToolReadinessResult | null;
  isSpanish: boolean;
}): Array<{ label: string; helper?: string }> {
  const itemText = params.itemText.trim() || (params.isSpanish ? "Producto pendiente" : "Item needed");
  const preference = params.fulfillmentPreference === "pickup"
    ? (params.isSpanish ? "Recoger" : "Pickup")
    : (params.isSpanish ? "Entrega" : "Delivery");
  const criteria = providerCriterionLabels(OTC_PHARMACY_QUALITY_CRITERIA, params.isSpanish).join(", ");
  const items = [
    {
      label: params.isSpanish ? `Farmacia: ${params.pharmacyName}` : `Pharmacy: ${params.pharmacyName}`,
      helper: params.isSpanish ? "Proveedor guardado en el perfil" : "Saved provider from profile",
    },
    {
      label: params.isSpanish ? `Producto OTC: ${itemText}` : `OTC item: ${itemText}`,
      helper: params.isSpanish ? "Solo productos sin receta" : "Over-the-counter only",
    },
    {
      label: params.isSpanish ? `${preference}: ${params.requestedTime.trim() || "hoy"}` : `${preference}: ${params.requestedTime.trim() || "today"}`,
      helper: params.notes.trim() || (params.isSpanish ? "Sin notas extra" : "No extra notes"),
    },
    {
      label: params.isSpanish ? `Criterios: ${criteria}` : `Criteria: ${criteria}`,
      helper: params.isSpanish
        ? "VYVA revisa stock, cercania, precio claro y reputacion."
        : "VYVA checks stock, proximity, clear price, and reputation.",
    },
  ];
  const readinessItem = toolReadinessConfirmationItem(params.toolReadiness, params.isSpanish);
  if (readinessItem) items.push(readinessItem);
  return items;
}

function appointmentMissionStatusLabel(status: AppointmentMissionState["status"], isSpanish: boolean): string {
  return getTrustedHelpMissionStatusLabel(status, isSpanish);
}

function isAppointmentMissionStatus(value: unknown): value is AppointmentMissionState["status"] {
  return typeof value === "string" && [
    "collecting_details",
    "selecting_provider",
    "awaiting_confirmation",
    "contacting_provider",
    "form_in_progress",
    "awaiting_provider_reply",
    "awaiting_user_save",
    "booked",
    "stopped",
  ].includes(value);
}

function offerProtectionFallback(isSpanish: boolean): OfferProtectionSummary {
  return isSpanish
    ? {
      title: "Revision objetiva",
      checkpoints: [
        "Sin ranking pagado.",
        "Valida precio, confianza, facilidad y encaje.",
        "Usa fuentes oficiales, publicas o verificables.",
        "Separa hechos, estimaciones y pendientes.",
      ],
      notification_triggers: [
        "cambio de precio",
        "renovacion",
        "dato pendiente",
        "nueva senal de riesgo",
      ],
      action_guardrail: "VYVA pide confirmacion antes de contactar, cambiar o compartir datos.",
    }
    : {
      title: "Objective check",
      checkpoints: [
        "No paid ranking.",
        "Validates price, trust, ease, and fit.",
        "Uses official, public, or verifiable sources.",
        "Separates facts, estimates, and gaps.",
      ],
      notification_triggers: [
        "price change",
        "renewal date",
        "missing detail",
        "new risk signal",
      ],
      action_guardrail: "VYVA asks before contact, switching, or sharing details.",
    };
}

function sourceGuidanceFor(result: OffersSearchResponse, isSpanish: boolean): string[] {
  const guidance = Array.isArray(result.source_guidance) ? result.source_guidance : [];
  if (guidance.length > 0) return guidance;
  return isSpanish
    ? ["fuentes oficiales o reguladas", "negocios locales verificables", "programas publicos o comunitarios"]
    : ["official or regulated sources", "verifiable local businesses", "public or community programmes"];
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function offerCardKey(option: OfferOption): string {
  return `${option.label}-${option.name}`.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "offer";
}

function getBookingUrl(item: ConciergePendingItem): string {
  const plan = item.action_payload?.form_automation_plan;
  const planPrefilledUrl = plan && typeof plan === "object" && !Array.isArray(plan)
    ? (plan as Record<string, unknown>).prefilled_url
    : null;
  return payloadString(item.action_payload, ["form_automation_prefilled_url"]) ||
    (typeof planPrefilledUrl === "string" ? planPrefilledUrl.trim() : "") ||
    payloadString(item.action_payload, ["booking_url"]);
}

function getExecutionChannel(item: ConciergePendingItem): string {
  return typeof item.action_payload?.execution_channel === "string"
    ? item.action_payload.execution_channel.trim()
    : "";
}

function getPreferredHandoffChannel(item: ConciergePendingItem): string {
  return getExecutionChannel(item) || payloadString(item.action_payload, ["preferred_channel"]);
}

function payloadString(payload: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!payload) return "";
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function isWebSearchPendingAction(item: ConciergePendingItem | null | undefined): item is ConciergePendingItem {
  if (!item || item.status !== "pending") return false;
  const toolText = [
    payloadString(item.action_payload, ["requested_tool"]),
    payloadString(item.action_payload, ["active_tool"]),
    payloadString(item.action_payload, ["tool"]),
    getExecutionChannel(item),
  ].join(" ").toLowerCase();
  return /\bweb_search\b/.test(toolText);
}

function webSearchFlowReference(item: ConciergePendingItem): ConciergeFlowReference {
  const payloadReference = payloadString(item.action_payload, ["flow_reference"]);
  if (isConciergeFlowReference(payloadReference)) return payloadReference;
  if (item.use_case === "scam_check") return SCAM_CHECK_FLOW_REFERENCE;
  return CONCIERGE_FLOW_REFERENCES.toolGatedTask;
}

function webSearchActionQuery(item: ConciergePendingItem, isSpanish: boolean): string {
  const payload = item.action_payload;
  const explicit = payloadString(payload, [
    "search_query",
    "query",
    "company_name",
    "provider_name",
    "phone_number",
    "url",
    "user_detail",
  ]);
  if (explicit) return explicit;

  const draft = payloadString(payload, ["draft_message", "message", "body", "detail"]);
  const userDetail = lineValueFromText(draft, [
    "User detail",
    "Detalle del usuario",
    "Company",
    "Empresa",
    "Phone",
    "Telefono",
    "Teléfono",
  ]);
  if (userDetail) return userDetail;

  const pieces = [
    item.provider_name && !/^(vyva review|selected provider|proveedor seleccionado)$/i.test(item.provider_name)
      ? item.provider_name
      : "",
    item.action_summary,
    draft,
  ].filter(Boolean);
  const query = pieces.join(" ").replace(/\s+/g, " ").trim();
  return query || (isSpanish ? "busqueda segura" : "safe search");
}

function webSearchOutcomeSummary(item: ConciergePendingItem, search: WebSearchActionResult, isSpanish: boolean): string {
  const topOption = search.result.options[0]?.name;
  if (topOption) {
    return isSpanish
      ? `Busqueda segura completada. Resultado principal: ${topOption}.`
      : `Safe search completed. Top result: ${topOption}.`;
  }
  return isSpanish
    ? "Busqueda segura completada. Revisa las notas antes de actuar."
    : "Safe search completed. Review the notes before acting.";
}

function webSearchOutcomePayload(item: ConciergePendingItem, search: WebSearchActionResult): Record<string, unknown> {
  return {
    flow_reference: webSearchFlowReference(item),
    execution_type: "safe_web_search",
    query: search.query,
    category: search.result.category,
    decision_explanation: search.result.decision_explanation,
    neutrality_note: search.result.neutrality_note,
    source_guidance: search.result.source_guidance,
    protection_summary: search.result.protection_summary ?? null,
    next_step: search.result.next_step,
    no_results_message: search.result.no_results_message ?? null,
    options: search.result.options.slice(0, 3).map((option) => ({
      name: option.name,
      category: option.category,
      label: option.label,
      why_good_option: option.why_good_option,
      distance_or_availability: option.distance_or_availability,
      contact_method: option.contact_method,
      trust_note: option.trust_note,
      score: option.score,
      website: option.website ?? null,
      maps_url: option.maps_url ?? null,
    })),
    no_external_action_without_confirmation: true,
    searched_at: new Date().toISOString(),
  };
}

function manualReviewFlowReference(item: ConciergePendingItem): string {
  const explicit = payloadString(item.action_payload, ["flow_reference"]);
  if (explicit) return explicit;
  if (item.use_case === "scam_check") return SCAM_CHECK_FLOW_REFERENCE;
  if (item.use_case === "insurance_admin" || item.use_case === "admin_task" || item.use_case === "paperwork") {
    return INSURANCE_ADMIN_FLOW_REFERENCE;
  }
  return CONCIERGE_FLOW_REFERENCES.toolGatedTask;
}

function manualReviewSubject(item: ConciergePendingItem, isSpanish: boolean): string {
  return payloadString(item.action_payload, [
    "review_source",
    "scam_detail",
    "review_target",
    "offer_name",
    "deal_name",
    "company_name",
    "document_type",
    "phone_number",
    "recipient",
    "recipient_name",
    "task_goal",
    "goal",
    "detail",
    "reason",
  ]) || item.action_summary || (isSpanish ? "revision VYVA" : "VYVA review");
}

function manualReviewStatusLabel(status: ManualReviewOutcomeStatus, isSpanish: boolean): string {
  if (status === "review_pending") return isSpanish ? "Revision pendiente" : "Review pending";
  return isSpanish ? "Completado" : "Completed";
}

function manualReviewOutcomeSummary(
  item: ConciergePendingItem,
  form: ManualReviewOutcomeForm,
  isSpanish: boolean,
): string {
  const subject = manualReviewSubject(item, isSpanish);
  const status = manualReviewStatusLabel(form.status, isSpanish);
  const reference = form.reference.trim();
  if (reference) {
    return isSpanish
      ? `${status}: ${subject}. Referencia: ${reference}.`
      : `${status}: ${subject}. Reference: ${reference}.`;
  }
  return `${status}: ${subject}.`;
}

function manualReviewOutcomePayload(
  item: ConciergePendingItem,
  form: ManualReviewOutcomeForm,
): Record<string, unknown> {
  const payload = item.action_payload ?? {};
  const summary = form.summary.trim();
  const nextStep = form.nextStep.trim();
  const reference = form.reference.trim();
  const notes = form.notes.trim();
  return {
    ...payload,
    flow_reference: manualReviewFlowReference(item),
    execution_type: "manual_review_outcome_capture",
    execution_channel: "operator_review",
    review_outcome: form.status,
    review_summary: summary || null,
    next_step: nextStep || null,
    reference: reference || payloadString(payload, ["reference", "case_reference", "claim_reference"]) || null,
    notes: notes || null,
    live_handoff_status: form.status === "review_pending" ? "needs_human_help" : "completed",
    live_handoff_outcome: form.status,
    completed_from: "manual_review_outcome_panel",
    no_external_action_without_confirmation: true,
    reviewed_at: new Date().toISOString(),
  };
}

function dryRunOutcomeSummary(item: ConciergePendingItem, isSpanish: boolean): string {
  const subject = payloadString(item.action_payload, [
    "task_goal",
    "action_label",
    "reason",
    "service_label",
    "item_text",
    "document_type",
    "review_source",
    "provider_search_query",
  ]) || item.action_summary;

  return isSpanish
    ? `Resultado simulado de prueba: ${subject}`
    : `Simulated dry-run outcome: ${subject}`;
}

function dryRunOutcomePayload(item: ConciergePendingItem): Record<string, unknown> {
  const payload = item.action_payload ?? {};
  const flowReference = payloadString(payload, ["flow_reference"]) || manualReviewFlowReference(item);
  return {
    ...payload,
    flow_reference: flowReference,
    dry_run: true,
    test_mode: CONCIERGE_DRY_RUN_TEST_MODE,
    simulated_outcome: true,
    no_real_provider_contact: true,
    no_external_action_without_confirmation: true,
    live_handoff_status: "completed",
    live_handoff_outcome: "dry_run_simulated",
    completed_from: "concierge_dry_run_outcome_panel",
    simulated_at: new Date().toISOString(),
  };
}

function isManualReviewOutcomePendingAction(item: ConciergePendingItem | null | undefined): item is ConciergePendingItem {
  if (!item || (item.status !== "pending" && item.status !== "calling")) return false;
  if (isWebSearchPendingAction(item)) return false;
  if (isPhoneCallPendingAction(item)) return false;
  if (getActionEmailDraft(item) || getActionWhatsAppDraft(item) || getBookingUrl(item)) return false;
  if (isProviderSearchPendingAction(item)) return false;
  if (item.use_case === "scam_check" || item.use_case === "insurance_admin" || item.use_case === "admin_task" || item.use_case === "paperwork") {
    return true;
  }
  const toolText = [
    payloadString(item.action_payload, ["requested_tool"]),
    payloadString(item.action_payload, ["active_tool"]),
    payloadString(item.action_payload, ["execution_channel"]),
  ].join(" ").toLowerCase();
  return /\b(operator_review|manual|manual_review|camera_or_upload)\b/.test(toolText);
}

function getActionEmailDraft(item: ConciergePendingItem): ConciergeEmailDraft | null {
  const payload = item.action_payload;
  const address = payloadString(payload, [
    "provider_email",
    "recipient_email",
    "to_email",
    "email_to",
    "email",
  ]);
  if (!address || !address.includes("@")) return null;

  return {
    address,
    subject: payloadString(payload, ["email_subject", "subject"]) || item.action_summary,
    body: payloadString(payload, ["email_body", "draft_body", "message_body", "message", "body"]) || item.action_summary,
  };
}

function emailDraftHref(draft: ConciergeEmailDraft): string {
  const params = [
    draft.subject ? `subject=${encodeURIComponent(draft.subject)}` : "",
    draft.body ? `body=${encodeURIComponent(draft.body)}` : "",
  ].filter(Boolean);
  return `mailto:${draft.address}${params.length ? `?${params.join("&")}` : ""}`;
}

function emailDraftFlowReference(item: ConciergePendingItem): string {
  const explicit = payloadString(item.action_payload, ["flow_reference"]);
  if (explicit) return explicit;
  if (item.use_case === "book_ride") return TRANSPORT_BOOKING_FLOW_REFERENCE;
  if (item.use_case === "order_medicine") return OTC_PHARMACY_FLOW_REFERENCE;
  if (isHomeServicePendingAction(item)) return CONCIERGE_FLOW_REFERENCES.homeService;
  if (item.use_case === "book_appointment") return MEDICAL_APPOINTMENT_FLOW_REFERENCE;
  if (item.use_case === "insurance_admin") return INSURANCE_ADMIN_FLOW_REFERENCE;
  if (item.use_case === "scam_check") return SCAM_CHECK_FLOW_REFERENCE;
  return CONCIERGE_FLOW_REFERENCES.toolGatedTask;
}

function emailDraftProviderName(item: ConciergePendingItem, draft: ConciergeEmailDraft, isSpanish: boolean): string {
  return item.provider_name?.trim()
    || payloadString(item.action_payload, ["recipient_name", "provider_name", "pharmacy_name", "selected_provider_name"])
    || draft.address
    || (isSpanish ? "destinatario" : "recipient");
}

function emailDraftOutcomeSummary(
  item: ConciergePendingItem,
  draft: ConciergeEmailDraft,
  form: EmailDraftOutcomeForm,
  isSpanish: boolean,
): string {
  const recipient = emailDraftProviderName(item, draft, isSpanish);
  const reference = form.reference.trim();
  if (reference) {
    return isSpanish
      ? `Email enviado a ${recipient}. Referencia: ${reference}.`
      : `Email sent to ${recipient}. Reference: ${reference}.`;
  }
  return isSpanish ? `Email enviado a ${recipient}.` : `Email sent to ${recipient}.`;
}

function emailDraftOutcomePayload(
  item: ConciergePendingItem,
  draft: ConciergeEmailDraft,
  form: EmailDraftOutcomeForm,
): Record<string, unknown> {
  const payload = item.action_payload ?? {};
  return {
    ...payload,
    flow_reference: emailDraftFlowReference(item),
    execution_type: "email_draft_outcome_capture",
    execution_channel: "email",
    email_outcome: "sent",
    provider_name: item.provider_name ?? (payloadString(payload, ["recipient_name", "provider_name", "pharmacy_name", "selected_provider_name"]) || null),
    provider_email: payloadString(payload, ["provider_email", "recipient_email", "to_email", "email_to", "email"]) || draft.address,
    recipient_email: draft.address,
    email_subject: draft.subject,
    email_body: draft.body,
    reference: form.reference.trim() || payloadString(payload, ["email_reference", "reference"]) || null,
    notes: form.notes.trim() || null,
    live_handoff_status: "sent_or_called",
    live_handoff_outcome: "email_sent",
    completed_from: "email_draft_outcome_panel",
    no_external_action_without_confirmation: true,
    sent_at: new Date().toISOString(),
  };
}

function whatsAppDraftFlowReference(item: ConciergePendingItem): string {
  return emailDraftFlowReference(item);
}

function whatsAppDraftProviderName(item: ConciergePendingItem, draft: ConciergeWhatsAppDraft, isSpanish: boolean): string {
  return item.provider_name?.trim()
    || payloadString(item.action_payload, ["recipient_name", "provider_name", "pharmacy_name", "selected_provider_name"])
    || draft.number
    || (isSpanish ? "destinatario" : "recipient");
}

function whatsAppDraftOutcomeSummary(
  item: ConciergePendingItem,
  draft: ConciergeWhatsAppDraft,
  form: WhatsAppDraftOutcomeForm,
  isSpanish: boolean,
): string {
  const recipient = whatsAppDraftProviderName(item, draft, isSpanish);
  const reference = form.reference.trim();
  if (reference) {
    return isSpanish
      ? `WhatsApp enviado a ${recipient}. Referencia: ${reference}.`
      : `WhatsApp sent to ${recipient}. Reference: ${reference}.`;
  }
  return isSpanish ? `WhatsApp enviado a ${recipient}.` : `WhatsApp sent to ${recipient}.`;
}

function whatsAppDraftOutcomePayload(
  item: ConciergePendingItem,
  draft: ConciergeWhatsAppDraft,
  form: WhatsAppDraftOutcomeForm,
): Record<string, unknown> {
  const payload = item.action_payload ?? {};
  return {
    ...payload,
    flow_reference: whatsAppDraftFlowReference(item),
    execution_type: "whatsapp_draft_outcome_capture",
    execution_channel: "whatsapp",
    whatsapp_outcome: "sent",
    provider_name: item.provider_name ?? (payloadString(payload, ["recipient_name", "provider_name", "pharmacy_name", "selected_provider_name"]) || null),
    provider_phone: item.provider_phone ?? (payloadString(payload, ["provider_phone", "phone"]) || null),
    provider_whatsapp: payloadString(payload, ["provider_whatsapp", "recipient_whatsapp", "to_whatsapp", "whatsapp_to", "whatsapp_number", "whatsapp"]) || draft.number,
    recipient_whatsapp: draft.number,
    whatsapp_message: draft.message,
    reference: form.reference.trim() || payloadString(payload, ["whatsapp_reference", "reference"]) || null,
    notes: form.notes.trim() || null,
    live_handoff_status: "sent_or_called",
    live_handoff_outcome: "whatsapp_sent",
    completed_from: "whatsapp_draft_outcome_panel",
    no_external_action_without_confirmation: true,
    sent_at: new Date().toISOString(),
  };
}

function normalizeWhatsAppNumber(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function getActionWhatsAppDraft(item: ConciergePendingItem): ConciergeWhatsAppDraft | null {
  const payload = item.action_payload;
  const preferredChannel = getPreferredHandoffChannel(item);
  const explicitNumber = payloadString(payload, [
    "provider_whatsapp",
    "recipient_whatsapp",
    "to_whatsapp",
    "whatsapp_to",
    "whatsapp_number",
    "whatsapp",
  ]);
  const number = explicitNumber || (preferredChannel === "whatsapp" ? item.provider_phone?.trim() ?? "" : "");
  const normalized = normalizeWhatsAppNumber(number);
  if (!normalized) return null;

  return {
    number: normalized,
    message: payloadString(payload, ["whatsapp_message", "draft_message", "message_body", "message", "body"]) || item.action_summary,
  };
}

function whatsAppDraftHref(draft: ConciergeWhatsAppDraft): string {
  const params = draft.message ? `?text=${encodeURIComponent(draft.message)}` : "";
  return `https://wa.me/${draft.number}${params}`;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim()).map((entry) => entry.trim()) : [];
}

function getFormAutomationPlan(item: ConciergePendingItem): { adapterLabel: string | null; missingFields: string[]; nextStep: string | null; prefilledUrl: string | null } | null {
  const plan = item.action_payload?.form_automation_plan;
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null;
  const record = plan as Record<string, unknown>;
  const adapterLabel = typeof record.adapter_label === "string" && record.adapter_label.trim() ? record.adapter_label.trim() : null;
  const nextStep = typeof record.next_step === "string" && record.next_step.trim() ? record.next_step.trim() : null;
  const prefilledUrl = typeof record.prefilled_url === "string" && record.prefilled_url.trim()
    ? record.prefilled_url.trim()
    : payloadString(item.action_payload, ["form_automation_prefilled_url"]);
  return {
    adapterLabel,
    missingFields: stringList(record.missing_fields),
    nextStep,
    prefilledUrl,
  };
}

function statusLabel(status: ConciergePendingItem["status"], locale = "es"): string {
  const es = locale.startsWith("es");
  switch (status) {
    case "pending":
      return es ? "Pendiente de confirmar" : "Awaiting confirmation";
    case "calling":
      return es ? "Llamando ahora" : "Calling now";
    case "completed":
      return es ? "Completado" : "Completed";
    case "failed":
      return es ? "Necesita revision" : "Needs attention";
    case "cancelled":
      return es ? "Cancelado" : "Cancelled";
    default:
      return status;
  }
}

function isHomeServicePendingAction(item: ConciergePendingItem): boolean {
  return item.use_case === "home_service" || item.action_payload?.appointment_type === "home-service";
}

function isMedicalAppointmentPendingAction(item: ConciergePendingItem): boolean {
  return item.use_case === "book_appointment" && !isHomeServicePendingAction(item);
}

function isHomeServiceCompletedSession(session: ConciergeCompletedSession): boolean {
  return session.use_case === "home_service" || session.outcome_payload?.appointment_type === "home-service";
}

function completedSessionFlowLabel(session: ConciergeCompletedSession, locale = "es"): string {
  const es = locale.startsWith("es");
  const flowReference = payloadString(session.outcome_payload, ["flow_reference"]);
  if (flowReference === CONCIERGE_FLOW_REFERENCES.safeHomeSupport) return es ? "Casa segura" : "Safe home";
  if (isHomeServiceCompletedSession(session)) return es ? "Servicio en casa" : "Home service";
  if (session.use_case === "book_ride" || flowReference === TRANSPORT_BOOKING_FLOW_REFERENCE) return es ? "Viaje" : "Ride";
  if (session.use_case === "order_medicine" || flowReference === OTC_PHARMACY_FLOW_REFERENCE) return es ? "Farmacia OTC" : "OTC pharmacy";
  if (session.use_case === "shopping_request" || flowReference === SHOPPING_SUPPORT_FLOW_REFERENCE) return es ? "Compra" : "Shopping";
  if (session.use_case === "book_appointment" || flowReference === MEDICAL_APPOINTMENT_FLOW_REFERENCE) return es ? "Cita" : "Appointment";
  if (flowReference === CARE_NAVIGATION_FLOW_REFERENCE) return es ? "Opciones de cuidado" : "Care options";
  return getUseCaseLabel(session.use_case, locale);
}

function completedSessionProvider(session: ConciergeCompletedSession, isSpanish: boolean): string {
  return session.provider_name?.trim()
    || payloadString(session.outcome_payload, ["provider_name", "pharmacy_name"])
    || (isSpanish ? "VYVA" : "VYVA");
}

function formatConciergeCompletedAt(value: string | null | undefined, locale = "es"): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const dateLocale = locale.startsWith("es") ? "es-ES" : "en-GB";
  return new Intl.DateTimeFormat(dateLocale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function completedSessionOutcomeLabel(session: ConciergeCompletedSession, isSpanish: boolean): string {
  const payload = session.outcome_payload;
  const rawOutcome = payloadString(payload, [
    "call_outcome",
    "provider_reply_status",
    "form_outcome",
    "email_outcome",
    "whatsapp_outcome",
  ]) || session.outcome || "completed";
  const outcome = rawOutcome.toLowerCase().replace(/\s+/g, "_");

  switch (outcome) {
    case "confirmed":
      return isSpanish ? "Confirmado" : "Confirmed";
    case "submitted":
      return isSpanish ? "Enviado" : "Submitted";
    case "sent":
      return isSpanish ? "Enviado" : "Sent";
    case "no_answer":
      return isSpanish ? "Sin respuesta" : "No answer";
    case "needs_info":
    case "needs_more_info":
      return isSpanish ? "Necesita mas datos" : "Needs more details";
    case "unavailable":
    case "cant_fulfil":
      return isSpanish ? "No disponible" : "Unavailable";
    case "cancelled":
    case "user_cancelled":
      return isSpanish ? "Cancelado" : "Cancelled";
    case "error":
      return isSpanish ? "Necesita revision" : "Needs review";
    case "completed":
    default:
      return isSpanish ? "Completado" : "Completed";
  }
}

function completedSessionDetails(session: ConciergeCompletedSession, isSpanish: boolean): Array<{ label: string; value: string }> {
  const payload = session.outcome_payload;
  const providerResolution = parseConciergeProviderReplyResolution(payload?.provider_reply_resolution);
  const providerDecisionHistory = parseConciergeProviderReplyDecisionHistory(payload?.provider_reply_decisions);
  const providerDecisionAction = providerResolution?.decision?.action
    ?? providerDecisionHistory[providerDecisionHistory.length - 1]?.action;
  const providerDecision = providerDecisionAction === "confirm"
    ? (isSpanish ? "Confirmado" : "Confirmed")
    : providerDecisionAction === "answer_provider"
      ? (isSpanish ? "Respuesta enviada" : "Provider answered")
      : providerDecisionAction === "mark_complete"
        ? (isSpanish ? "Marcado como hecho" : "Marked complete")
        : "";
  const entries = [
    {
      label: isSpanish ? "Respuesta" : "Provider reply",
      value: payloadString(payload, ["provider_reply"]),
    },
    {
      label: isSpanish ? "Decision" : "Decision",
      value: providerDecision,
    },
    {
      label: isSpanish ? "Hora" : "Time",
      value: payloadString(payload, ["scheduled_for", "requested_time"]),
    },
    {
      label: isSpanish ? "Coste" : "Cost",
      value: payloadString(payload, ["price_estimate", "cost_estimate", "estimated_cost"]),
    },
    {
      label: isSpanish ? "Referencia" : "Reference",
      value: payloadString(payload, ["booking_reference", "pharmacy_reference", "reference", "provider_message_id"]),
    },
    {
      label: isSpanish ? "Telefono" : "Phone",
      value: payloadString(payload, ["provider_phone", "phone", "contact_phone"]),
    },
    {
      label: "Email",
      value: payloadString(payload, ["recipient_email", "provider_email", "email"]),
    },
    {
      label: isSpanish ? "Asunto" : "Subject",
      value: payloadString(payload, ["email_subject", "subject"]),
    },
    {
      label: "WhatsApp",
      value: payloadString(payload, ["recipient_whatsapp", "provider_whatsapp", "whatsapp"]),
    },
    {
      label: isSpanish ? "Estado" : "Status",
      value: payloadString(payload, ["availability", "fulfillment_note"]),
    },
    {
      label: isSpanish ? "Lugar" : "Place",
      value: payloadString(payload, ["location", "destination_address", "pickup_address"]),
    },
  ];
  return entries.filter((entry) => entry.value);
}

function completedSessionReceiptDetails(
  session: ConciergeCompletedSession,
  isSpanish: boolean,
  locale = "es",
): Array<{ label: string; value: string }> {
  const receipt = buildConciergeConfirmationReceipt({
    useCase: session.use_case,
    providerName: session.provider_name,
    outcome: session.outcome,
    outcomeSummary: session.outcome_summary,
    completedAt: session.completed_at,
    payload: session.outcome_payload,
  }, isSpanish);
  const completedAt = formatConciergeCompletedAt(session.completed_at, locale);
  const executionMode = payloadString(session.outcome_payload, ["execution_mode"]);
  const executionModeLabel = executionMode === "live"
    ? (isSpanish ? "Accion en vivo" : "Live action")
    : executionMode === "manual_review"
      ? (isSpanish ? "Revision manual" : "Manual review")
      : executionMode === "blocked"
        ? (isSpanish ? "Canal bloqueado" : "Channel blocked")
        : executionMode === "simulated"
          ? (isSpanish ? "Prueba sin contacto real" : "Test mode, no real contact")
          : "";
  const executionTask = isRecord(session.outcome_payload?.execution_task)
    ? session.outcome_payload.execution_task
    : null;
  const userConfirmed = session.outcome_payload?.user_confirmed === true
    || executionTask?.user_confirmed === true;
  return [
    {
      label: isSpanish ? "Tipo" : "Type",
      value: completedSessionFlowLabel(session, locale),
    },
    {
      label: isSpanish ? "Resultado" : "Result",
      value: receipt.statusLabel,
    },
    {
      label: isSpanish ? "Proveedor" : "Provider",
      value: receipt.subjectLabel === (isSpanish ? "Con quien" : "With")
        ? receipt.subjectValue
        : completedSessionProvider(session, isSpanish),
    },
    {
      label: isSpanish ? "Completado" : "Completed",
      value: completedAt,
    },
    ...(executionModeLabel ? [{
      label: isSpanish ? "Modo" : "Mode",
      value: executionModeLabel,
    }] : isConciergeDryRunPayload(session.outcome_payload) ? [{
      label: isSpanish ? "Modo" : "Mode",
      value: isSpanish ? "Prueba sin contacto real" : "Test mode, no real contact",
    }] : []),
    ...(userConfirmed ? [{
      label: isSpanish ? "Confirmado" : "Confirmed",
      value: isSpanish ? "Si" : "Yes",
    }] : []),
    ...completedSessionDetails(session, isSpanish),
  ].filter((entry) => entry.value);
}

function completedSessionContactLink(
  session: ConciergeCompletedSession,
  isSpanish: boolean,
): { href: string; label: string; external: boolean } | null {
  if (isConciergeDryRunPayload(session.outcome_payload)) return null;
  if (payloadString(session.outcome_payload, ["execution_mode"]) !== "live") return null;
  const payload = session.outcome_payload;
  const phone = payloadString(payload, ["provider_phone", "phone", "contact_phone"]);
  const email = payloadString(payload, ["provider_email", "recipient_email", "email"]);
  const whatsapp = payloadString(payload, ["provider_whatsapp", "whatsapp", "whatsapp_number"]);
  const bookingUrl = payloadString(payload, ["form_automation_prefilled_url", "prefilled_url", "booking_url"]);

  if (phone) {
    return {
      href: phoneHref(phone),
      label: isSpanish ? "Llamar proveedor" : "Call provider",
      external: false,
    };
  }
  if (whatsapp) {
    return {
      href: `https://wa.me/${normalizeWhatsAppNumber(whatsapp)}`,
      label: "WhatsApp",
      external: true,
    };
  }
  if (email && email.includes("@")) {
    return {
      href: `mailto:${email}`,
      label: isSpanish ? "Email proveedor" : "Email provider",
      external: false,
    };
  }
  if (bookingUrl) {
    return {
      href: bookingUrl,
      label: isSpanish ? "Abrir enlace" : "Open link",
      external: true,
    };
  }
  return null;
}

function completedSessionPrompt(
  session: ConciergeCompletedSession,
  isSpanish: boolean,
  mode: "question" | "repeat",
): string {
  const flow = completedSessionFlowLabel(session, isSpanish ? "es" : "en");
  const provider = completedSessionProvider(session, isSpanish);
  const summary = session.outcome_summary || (isSpanish ? "tarea completada" : "completed task");
  const details = completedSessionDetails(session, isSpanish)
    .map((detail) => `${detail.label}: ${detail.value}`)
    .join(", ");
  if (mode === "repeat") {
    return isSpanish
      ? `Ayudame a repetir esta gestion: ${flow} con ${provider}. Usa esta referencia como contexto: ${summary}${details ? ` (${details})` : ""}. Antes de actuar, pideme confirmacion.`
      : `Help me do this again: ${flow} with ${provider}. Use this as context: ${summary}${details ? ` (${details})` : ""}. Ask me to confirm before acting.`;
  }
  return isSpanish
    ? `Tengo una pregunta sobre esta gestion completada: ${flow} con ${provider}. Resumen: ${summary}${details ? ` (${details})` : ""}. Ayudame a entender el siguiente paso.`
    : `I have a question about this completed task: ${flow} with ${provider}. Summary: ${summary}${details ? ` (${details})` : ""}. Help me understand the next step.`;
}

type CompletedSessionTemplateKind = "ride" | "otc" | "home-service" | "appointment" | "task";

function completedSessionTemplateKind(session: ConciergeCompletedSession): CompletedSessionTemplateKind {
  const flowReference = payloadString(session.outcome_payload, ["flow_reference"]);
  if (session.use_case === "book_ride" || flowReference === TRANSPORT_BOOKING_FLOW_REFERENCE) return "ride";
  if (session.use_case === "order_medicine" || flowReference === OTC_PHARMACY_FLOW_REFERENCE) return "otc";
  if (isHomeServiceCompletedSession(session)) return "home-service";
  if (session.use_case === "book_appointment" || flowReference === MEDICAL_APPOINTMENT_FLOW_REFERENCE) return "appointment";
  return "task";
}

type RightNowActionLabelsParams = {
  item: ConciergePendingItem;
  isSpanish: boolean;
  opensWhatsApp: boolean;
  opensEmail: boolean;
  opensBooking: boolean;
  needsPhoneOutcome: boolean;
  needsWhatsAppOutcome: boolean;
  needsEmailOutcome: boolean;
  canOpenForm: boolean;
  isVyvaTask: boolean;
  formMissingFields: string[];
};

type PendingActionReviewDetail = {
  label: string;
  value: string;
  isMissing?: boolean;
};

type PendingActionReconfirmationSummary = {
  changedFields: string;
  providerName: string;
  providerContact: string;
  summary: string;
  outboundPayload: unknown;
  requestedAt: string;
};

type PendingActionReviewSummary = {
  title: string;
  eyebrow: string;
  summary: string;
  details: PendingActionReviewDetail[];
  missingDetails: string[];
  reconfirmation?: PendingActionReconfirmationSummary | null;
};

type ActiveTaskChecklistItemState = "done" | "active" | "needed" | "waiting" | "warning";
type ActiveTaskChecklistAction = "details" | "provider" | "contact" | "reply" | "confirm";

type ActiveTaskChecklistItem = {
  key: string;
  label: string;
  value: string;
  state: ActiveTaskChecklistItemState;
  action?: ActiveTaskChecklistAction;
  actionLabel?: string;
};

type ActiveTaskChecklist = {
  title: string;
  helper: string;
  flowTitle: string;
  items: ActiveTaskChecklistItem[];
};

type ConciergeFocusedDetailTarget =
  | "appointment-note"
  | "otc-item"
  | "otc-time"
  | "transport-destination"
  | "transport-pickup"
  | "transport-time";

const CONCIERGE_DETAIL_FOCUS_TEST_IDS: Record<ConciergeFocusedDetailTarget, string> = {
  "appointment-note": "input-appointment-note",
  "otc-item": "input-otc-pharmacy-item",
  "otc-time": "input-otc-pharmacy-time",
  "transport-destination": "input-transport-destination",
  "transport-pickup": "input-transport-pickup",
  "transport-time": "input-transport-time",
};

function humanizeValue(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function handoffChannelLabel(item: ConciergePendingItem, isSpanish: boolean): string {
  const channel = getPreferredHandoffChannel(item).toLowerCase();
  if (channel === "phone") return isSpanish ? "Llamada" : "Phone call";
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return isSpanish ? "Email" : "Email";
  if (channel === "booking_url") return isSpanish ? "Enlace o formulario" : "Booking link or form";
  if (channel === "manual") return isSpanish ? "Gestion VYVA" : "VYVA handling";
  if (item.provider_phone) return isSpanish ? "Llamada" : "Phone call";
  if (getActionWhatsAppDraft(item)) return "WhatsApp";
  if (getActionEmailDraft(item)) return isSpanish ? "Email" : "Email";
  if (getBookingUrl(item)) return isSpanish ? "Enlace o formulario" : "Booking link or form";
  return isSpanish ? "Revision VYVA" : "VYVA review";
}

function isConciergeLiveHandoffState(value: string): value is ConciergeLiveHandoffState {
  return ["ready", "sent_or_called", "waiting", "completed", "failed", "needs_human_help"].includes(value);
}

function isRideLiveHandoffAction(item: ConciergePendingItem | null | undefined): item is ConciergePendingItem {
  if (!item) return false;
  return item.use_case === "book_ride" || payloadString(item.action_payload, ["flow_reference"]) === TRANSPORT_BOOKING_FLOW_REFERENCE;
}

function isReusableLiveHandoffAction(item: ConciergePendingItem | null | undefined): item is ConciergePendingItem {
  if (!item) return false;
  if (isRideLiveHandoffAction(item)) return true;
  if (item.use_case === "order_medicine" || item.use_case === "book_appointment" || isHomeServicePendingAction(item)) return true;
  const flowReference = payloadString(item.action_payload, ["flow_reference"]);
  return flowReference === OTC_PHARMACY_FLOW_REFERENCE ||
    flowReference === MEDICAL_APPOINTMENT_FLOW_REFERENCE ||
    flowReference === CONCIERGE_FLOW_REFERENCES.homeService ||
    flowReference === CONCIERGE_FLOW_REFERENCES.safeHomeSupport;
}

function handoffReadinessFlag(
  payload: Record<string, unknown> | null | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const readiness = payload?.handoff_readiness;
  if (isRecord(readiness) && typeof readiness[key] === "boolean") return readiness[key] as boolean;
  return fallback;
}

function liveHandoffStateFromAction(item: ConciergePendingItem): ConciergeLiveHandoffState {
  const explicit = payloadString(item.action_payload, ["live_handoff_status"]);
  if (isConciergeLiveHandoffState(explicit)) return explicit;

  const callOutcome = payloadString(item.action_payload, ["call_outcome"]);
  if (callOutcome === "confirmed") return "completed";
  if (callOutcome === "no_answer") return "waiting";
  if (callOutcome === "needs_info") return "needs_human_help";
  if (callOutcome === "cancelled") return "failed";
  if (payloadString(item.action_payload, ["provider_reply_status"]) === "confirmed") return "completed";
  if (payloadString(item.action_payload, ["review_outcome"]) === "review_pending") return "needs_human_help";
  if (
    payloadString(item.action_payload, ["email_outcome"]) === "sent" ||
    payloadString(item.action_payload, ["whatsapp_outcome"]) === "sent" ||
    payloadString(item.action_payload, ["form_outcome"]) === "submitted"
  ) {
    return "sent_or_called";
  }

  const missionStatus = payloadString(item.action_payload, ["mission_status", "status"]).toLowerCase();
  if (missionStatus.includes("awaiting_provider")) return "waiting";

  const task = getConciergeExecutionTask(item);
  if (task?.lifecycle_status === "done") return "completed";
  if (task?.lifecycle_status === "failed" || task?.lifecycle_status === "cancelled") return "failed";
  if (task?.lifecycle_status === "in_progress") return "sent_or_called";
  if (task?.lifecycle_status === "confirmed") return "waiting";
  if (task?.lifecycle_status === "needs_info") return "needs_human_help";

  if (item.status === "completed") return "completed";
  if (item.status === "failed" || item.status === "cancelled") return "failed";
  if (item.status === "calling") return "sent_or_called";
  if (conciergeActionAlreadyConfirmed(item)) return "waiting";
  return "ready";
}

function liveHandoffStateLabel(state: ConciergeLiveHandoffState, isSpanish: boolean): { label: string; helper: string } {
  const copy: Record<ConciergeLiveHandoffState, { en: string; es: string; helperEn: string; helperEs: string }> = {
    ready: {
      en: "Ready for your OK",
      es: "Listo para tu OK",
      helperEn: "Everything stays paused until the user confirms.",
      helperEs: "Todo queda pausado hasta que la persona confirme.",
    },
    sent_or_called: {
      en: "Sent or called",
      es: "Enviado o llamado",
      helperEn: "The contact step happened. Save the result next.",
      helperEs: "El contacto ya se hizo. Guarda el resultado despues.",
    },
    waiting: {
      en: "Waiting for provider",
      es: "Esperando al proveedor",
      helperEn: "VYVA is waiting for a provider reply or final detail.",
      helperEs: "VYVA espera respuesta o el ultimo dato.",
    },
    completed: {
      en: "Completed",
      es: "Completado",
      helperEn: "The outcome is saved in Concierge history.",
      helperEs: "El resultado esta guardado en el historial.",
    },
    failed: {
      en: "Could not complete",
      es: "No se pudo completar",
      helperEn: "Review the issue before trying again.",
      helperEs: "Revisa el problema antes de intentarlo otra vez.",
    },
    needs_human_help: {
      en: "Needs human help",
      es: "Necesita ayuda humana",
      helperEn: "A person should review the task before it moves on.",
      helperEs: "Una persona debe revisar antes de seguir.",
    },
  };
  const entry = copy[state] ?? copy.ready;
  return {
    label: isSpanish ? entry.es : entry.en,
    helper: isSpanish ? entry.helperEs : entry.helperEn,
  };
}

function buildRideLiveHandoffSummary(item: ConciergePendingItem, isSpanish: boolean): ConciergeLiveHandoffSummary {
  const payload = item.action_payload;
  const state = liveHandoffStateFromAction(item);
  const stateCopy = liveHandoffStateLabel(state, isSpanish);
  const providerName = item.provider_name?.trim() || payloadString(payload, ["provider_name", "selected_provider_name"]);
  const channel = handoffChannelLabel(item, isSpanish);
  const pickup = payloadString(payload, ["pickup_address", "pickup"]);
  const destination = payloadString(payload, ["destination_address", "destination"]);
  const requestedTime = payloadString(payload, ["requested_time", "time"]) || (isSpanish ? "Ahora" : "Now");
  const mobilityNeeds = stringList(payload?.mobility_needs);
  const mobilitySource = payloadString(payload, ["mobility_info_source"]);
  const hasFinalOk = conciergeActionAlreadyConfirmed(item) || state === "sent_or_called" || state === "waiting" || state === "completed";
  const providerSaved = handoffReadinessFlag(payload, "provider_saved", Boolean(payload?.saved_transport_provider_first));
  const contactReady = handoffReadinessFlag(payload, "has_contact_channel", !/review|revision|manual/i.test(channel));
  const mobilityReady = handoffReadinessFlag(payload, "has_mobility_needs", mobilityNeeds.length > 0 || mobilitySource === "profile");

  return {
    state,
    label: stateCopy.label,
    helper: stateCopy.helper,
    items: [
      {
        key: "provider",
        label: isSpanish ? "Proveedor" : "Provider",
        value: providerName
          ? `${providerName}${providerSaved ? (isSpanish ? " - guardado" : " - saved") : ""}`
          : (isSpanish ? "Falta proveedor" : "Provider needed"),
        ready: Boolean(providerName),
      },
      {
        key: "contact",
        label: isSpanish ? "Contacto" : "Contact",
        value: channel,
        ready: contactReady,
      },
      {
        key: "pickup",
        label: isSpanish ? "Recogida" : "Pickup",
        value: pickup || (isSpanish ? "Falta recogida" : "Pickup needed"),
        ready: handoffReadinessFlag(payload, "has_pickup", Boolean(pickup)),
      },
      {
        key: "destination",
        label: isSpanish ? "Destino" : "Destination",
        value: destination || (isSpanish ? "Falta destino" : "Destination needed"),
        ready: handoffReadinessFlag(payload, "has_destination", Boolean(destination)),
      },
      {
        key: "time",
        label: isSpanish ? "Hora" : "Time",
        value: requestedTime,
        ready: handoffReadinessFlag(payload, "has_time", Boolean(requestedTime)),
      },
      {
        key: "mobility",
        label: isSpanish ? "Movilidad" : "Mobility",
        value: mobilityNeeds.length
          ? mobilityNeeds.join(", ")
          : mobilitySource === "profile"
            ? (isSpanish ? "Guardada en perfil" : "Saved in profile")
            : (isSpanish ? "Pregunta si hace falta" : "Ask if needed"),
        ready: mobilityReady,
      },
      {
        key: "confirmation",
        label: isSpanish ? "OK final" : "Final OK",
        value: hasFinalOk
          ? (isSpanish ? "Confirmado" : "Confirmed")
          : (isSpanish ? "Pendiente" : "Pending"),
        ready: hasFinalOk,
      },
    ],
  };
}

function genericHandoffDetailLabel(item: ConciergePendingItem, isSpanish: boolean): string {
  if (item.use_case === "order_medicine") return isSpanish ? "Producto" : "Item";
  if (isHomeServicePendingAction(item)) return isSpanish ? "Servicio" : "Service";
  if (item.use_case === "book_appointment") return isSpanish ? "Motivo" : "Reason";
  return isSpanish ? "Detalle" : "Detail";
}

function genericHandoffDetailValue(item: ConciergePendingItem, isSpanish: boolean): string {
  const payload = item.action_payload;
  if (item.use_case === "order_medicine") {
    return payloadString(payload, ["item_text", "items", "item"]) || (isSpanish ? "Falta producto" : "Item needed");
  }
  if (isHomeServicePendingAction(item)) {
    return payloadString(payload, ["service_needed", "problem_summary", "service_type", "reason", "detail"]) ||
      (isSpanish ? "Falta servicio" : "Service needed");
  }
  if (item.use_case === "book_appointment") {
    return payloadString(payload, ["reason", "detail", "problem_summary", "provider_notes"]) ||
      (isSpanish ? "Falta motivo" : "Reason needed");
  }
  return payloadString(payload, ["reason", "detail", "draft_message", "message"]) || (isSpanish ? "Falta detalle" : "Detail needed");
}

function buildGenericLiveHandoffSummary(item: ConciergePendingItem, isSpanish: boolean): ConciergeLiveHandoffSummary {
  const payload = item.action_payload;
  const state = liveHandoffStateFromAction(item);
  const stateCopy = liveHandoffStateLabel(state, isSpanish);
  const providerName = activeTaskProviderLabel(item, isSpanish);
  const channel = handoffChannelLabel(item, isSpanish);
  const detailValue = genericHandoffDetailValue(item, isSpanish);
  const timeValue = payloadString(payload, ["requested_time", "preferred_time", "scheduled_for", "time"]);
  const requirements = evaluateConciergeFlowRequirements({
    useCase: item.use_case,
    payload,
    providerName,
    summary: item.action_summary,
  });
  const firstMissing = requirements.firstMissingRequirement;
  const detailsReady = requirements.missingRequirements.length === 0;
  const hasFinalOk = conciergeActionAlreadyConfirmed(item) || state === "sent_or_called" || state === "waiting" || state === "completed";

  return {
    state,
    label: stateCopy.label,
    helper: stateCopy.helper,
    items: [
      {
        key: "provider",
        label: isSpanish ? "Proveedor" : "Provider",
        value: providerName || (requirements.needsProvider ? (isSpanish ? "Falta proveedor" : "Provider needed") : (isSpanish ? "VYVA" : "VYVA")),
        ready: Boolean(providerName) || !requirements.needsProvider,
      },
      {
        key: "contact",
        label: isSpanish ? "Contacto" : "Contact",
        value: channel,
        ready: !/review|revision|manual/i.test(channel),
      },
      {
        key: "details",
        label: genericHandoffDetailLabel(item, isSpanish),
        value: detailsReady
          ? detailValue
          : firstMissing
            ? (isSpanish ? `Falta ${firstMissing.labelEs}` : `${firstMissing.labelEn} needed`)
            : detailValue,
        ready: detailsReady,
      },
      {
        key: "time",
        label: isSpanish ? "Hora" : "Time",
        value: timeValue || (isSpanish ? "Por confirmar" : "To confirm"),
        ready: Boolean(timeValue) || !requirements.missingRequirements.some((requirement) => requirement.key === "time"),
      },
      {
        key: "confirmation",
        label: isSpanish ? "OK final" : "Final OK",
        value: hasFinalOk
          ? (isSpanish ? "Confirmado" : "Confirmed")
          : (isSpanish ? "Pendiente" : "Pending"),
        ready: hasFinalOk,
      },
    ],
  };
}

function buildConciergeLiveHandoffSummary(
  item: ConciergePendingItem | null | undefined,
  isSpanish: boolean,
): ConciergeLiveHandoffSummary | null {
  if (isRideLiveHandoffAction(item)) return buildRideLiveHandoffSummary(item, isSpanish);
  if (isReusableLiveHandoffAction(item)) return buildGenericLiveHandoffSummary(item, isSpanish);
  return null;
}

function addReviewDetail(
  details: PendingActionReviewDetail[],
  missingDetails: string[],
  label: string,
  value: string,
  missingLabel?: string,
) {
  const cleanValue = value.trim();
  if (cleanValue) {
    details.push({ label, value: cleanValue });
    return;
  }
  if (missingLabel) {
    details.push({ label, value: missingLabel, isMissing: true });
    missingDetails.push(label);
  }
}

function reconfirmationFieldLabels(fields: string[], isSpanish: boolean): string {
  const labels: Record<string, { en: string; es: string }> = {
    approval: { en: "approval record", es: "registro de aprobacion" },
    channel: { en: "contact route", es: "ruta de contacto" },
    provider_name: { en: "provider", es: "proveedor" },
    provider_contact: { en: "provider contact", es: "contacto del proveedor" },
    summary: { en: "summary", es: "resumen" },
    payload: { en: "action details", es: "detalles de la gestion" },
  };
  const values = fields.length > 0 ? fields : ["approval"];
  return values.map((field) => {
    const label = labels[field];
    return label ? (isSpanish ? label.es : label.en) : humanizeValue(field);
  }).join(", ");
}

function buildPendingActionReconfirmationSummary(
  request: ConciergeReconfirmationRequest | null,
  isSpanish: boolean,
): PendingActionReconfirmationSummary | null {
  if (!request) return null;
  const preview = request.payload_preview;
  return {
    changedFields: reconfirmationFieldLabels(request.changed_fields, isSpanish),
    providerName: preview?.provider_name || (isSpanish ? "Sin proveedor guardado" : "No provider saved"),
    providerContact: preview?.provider_contact || (isSpanish ? "Sin contacto guardado" : "No contact saved"),
    summary: preview?.summary || (isSpanish ? "Sin resumen guardado" : "No summary saved"),
    outboundPayload: preview?.outbound_payload ?? {},
    requestedAt: request.requested_at,
  };
}

function buildPendingActionReviewSummary(params: {
  item: ConciergePendingItem;
  isSpanish: boolean;
  nextStepLabel: string;
  nextStepHelper: string;
}): PendingActionReviewSummary {
  const { item, isSpanish, nextStepLabel, nextStepHelper } = params;
  const payload = item.action_payload;
  const details: PendingActionReviewDetail[] = [];
  const missingDetails: string[] = [];
  const missing = isSpanish ? "Falta confirmar" : "Needs confirmation";
  const reconfirmation = buildPendingActionReconfirmationSummary(
    activeConciergeReconfirmationRequestFromPayload(payload),
    isSpanish,
  );

  addReviewDetail(
    details,
    missingDetails,
    isSpanish ? "Siguiente paso" : "Next step",
    nextStepLabel,
    missing,
  );
  addReviewDetail(
    details,
    missingDetails,
    isSpanish ? "Proveedor" : "Provider",
    item.provider_name ?? payloadString(payload, ["provider_name", "pharmacy_name"]),
    missing,
  );
  addReviewDetail(
    details,
    missingDetails,
    isSpanish ? "Ruta de contacto" : "Contact route",
    handoffChannelLabel(item, isSpanish),
    missing,
  );

  const flowRequirements = evaluateConciergeFlowRequirements({
    useCase: item.use_case,
    payload,
    providerName: activeTaskProviderLabel(item, isSpanish),
    summary: item.action_summary,
  });

  if (isManualReviewOutcomePendingAction(item) && flowRequirements.flowReference === CONCIERGE_FLOW_REFERENCES.scamCheck) {
    addReviewDetail(
      details,
      missingDetails,
      isSpanish ? "Fuente" : "Source",
      payloadString(payload, [
        "review_source",
        "scam_detail",
        "document_url",
        "uploaded_file",
        "uploaded_document",
        "uploaded_image",
        "document_type",
        "phone_number",
        "company_name",
        "email_body",
        "sender",
        "link",
        "url",
        "show_vyva_input_type",
        "show_vyva_source",
      ]),
      missing,
    );
    addReviewDetail(
      details,
      missingDetails,
      isSpanish ? "Riesgo" : "Concern",
      payloadString(payload, ["concern", "what_worries_you", "risk_context", "review_question", "review_summary", "risk_level", "reason", "detail"]),
      missing,
    );
  } else if (isManualReviewOutcomePendingAction(item) && flowRequirements.flowReference === CONCIERGE_FLOW_REFERENCES.insuranceAdmin) {
    addReviewDetail(
      details,
      missingDetails,
      isSpanish ? "Gestion" : "Task",
      payloadString(payload, ["document_type", "task_type", "admin_task", "action_label", "reason", "detail"]) || item.action_summary,
      missing,
    );
    addReviewDetail(
      details,
      missingDetails,
      isSpanish ? "Destinatario" : "Recipient",
      payloadString(payload, ["recipient", "recipient_name", "recipient_email", "provider_email", "email", "phone"]),
      missing,
    );
    addReviewDetail(
      details,
      missingDetails,
      isSpanish ? "Fecha limite" : "Deadline",
      payloadString(payload, ["deadline", "due_date", "requested_time"]),
      missing,
    );
  } else if (isManualReviewOutcomePendingAction(item) && flowRequirements.flowReference === CONCIERGE_FLOW_REFERENCES.toolGatedTask) {
    addReviewDetail(
      details,
      missingDetails,
      isSpanish ? "Objetivo" : "Goal",
      payloadString(payload, ["task_goal", "goal", "reason", "detail", "message", "draft_message"]) || item.action_summary,
      missing,
    );
    addReviewDetail(
      details,
      missingDetails,
      isSpanish ? "Tipo de accion" : "Action type",
      payloadString(payload, ["action_type", "requested_tool", "active_tool", "execution_channel", "preferred_channel"]),
      missing,
    );
    addReviewDetail(
      details,
      missingDetails,
      isSpanish ? "Web o contacto" : "Website or contact",
      payloadString(payload, ["recipient", "recipient_email", "website", "booking_url", "provider_name", "provider_email", "phone"]),
      missing,
    );
  }

  if (item.use_case === "book_ride") {
    addReviewDetail(details, missingDetails, isSpanish ? "Recogida" : "Pickup", payloadString(payload, ["pickup_address", "pickup"]), missing);
    addReviewDetail(details, missingDetails, isSpanish ? "Destino" : "Destination", payloadString(payload, ["destination_address", "destination"]), missing);
    addReviewDetail(details, missingDetails, isSpanish ? "Hora" : "Time", payloadString(payload, ["requested_time", "time"]) || (isSpanish ? "Ahora" : "Now"));
    const mobilityNeeds = stringList(payload?.mobility_needs).join(", ");
    const mobilitySource = payloadString(payload, ["mobility_info_source"]);
    if (mobilityNeeds || mobilitySource === "profile") {
      details.push({
        label: isSpanish ? "Movilidad" : "Mobility",
        value: mobilityNeeds || (isSpanish ? "Guardada en perfil" : "Saved in profile"),
      });
    }
  } else if (item.use_case === "order_medicine") {
    addReviewDetail(details, missingDetails, isSpanish ? "Producto" : "Item", payloadString(payload, ["item_text", "items", "item"]), missing);
    details.push({
      label: isSpanish ? "Alcance" : "Scope",
      value: isSpanish ? "Solo sin receta" : "Over-the-counter only",
    });
    addReviewDetail(details, missingDetails, isSpanish ? "Preferencia" : "Preference", humanizeValue(payloadString(payload, ["fulfillment_preference"])) || (isSpanish ? "Entrega" : "Delivery"));
    addReviewDetail(details, missingDetails, isSpanish ? "Hora" : "Time", payloadString(payload, ["requested_time", "time"]) || (isSpanish ? "Hoy" : "Today"));
    addReviewDetail(details, missingDetails, isSpanish ? "Nota" : "Note", payloadString(payload, ["notes", "note"]));
  } else if (item.use_case === "book_appointment" || isHomeServicePendingAction(item)) {
    const isHomeService = isHomeServicePendingAction(item);
    details.push({
      label: isSpanish ? "Tipo" : "Type",
      value: isHomeService ? (isSpanish ? "Servicio en casa" : "Home service") : (isSpanish ? "Cita" : "Appointment"),
    });
    addReviewDetail(details, missingDetails, isSpanish ? "Motivo" : "Reason", payloadString(payload, ["reason", "detail", "problem_summary", "service_needed"]), missing);
    addReviewDetail(details, missingDetails, isSpanish ? "Hora preferida" : "Preferred time", payloadString(payload, ["requested_time", "preferred_time", "scheduled_for"]));
    addReviewDetail(details, missingDetails, isSpanish ? "Lugar" : "Place", payloadString(payload, ["location", "address", "home_address"]));
    addReviewDetail(details, missingDetails, isSpanish ? "Nota proveedor" : "Provider note", payloadString(payload, ["provider_notes"]));
  } else {
    addReviewDetail(details, missingDetails, isSpanish ? "Detalle" : "Detail", payloadString(payload, ["draft_message", "message", "body", "reason"]) || item.action_summary, missing);
  }

  return {
    eyebrow: reconfirmation
      ? (isSpanish ? "Confirma de nuevo" : "Fresh OK needed")
      : (isSpanish ? "Tu OK primero" : "Your OK first"),
    title: reconfirmation
      ? (isSpanish ? "Revisa los datos actualizados" : "Review the updated details")
      : (isSpanish ? "Listo para revisar" : "Ready to review"),
    summary: reconfirmation
      ? (isSpanish
          ? "VYVA actualizo esta gestion. Nada se enviara, llamara ni reservara hasta que confirmes otra vez."
          : "VYVA updated this action. Nothing will be sent, called, or booked until you approve it again.")
      : nextStepHelper,
    details: details.slice(0, 8),
    missingDetails,
    reconfirmation,
  };
}

function activeTaskProviderLabel(item: ConciergePendingItem, isSpanish: boolean): string {
  if (isProviderSearchPendingAction(item)) return providerSearchProviderName(item, isSpanish);
  return item.provider_name?.trim()
    || payloadString(item.action_payload, ["provider_name", "pharmacy_name", "selected_provider_name"])
    || "";
}

function focusedDetailTargetForRequirement(
  item: ConciergePendingItem,
  requirementKey: ConciergeFlowRequirementKey | string | null | undefined,
): ConciergeFocusedDetailTarget | null {
  if (!requirementKey) return null;

  if (item.use_case === "book_ride") {
    if (requirementKey === "destination" || requirementKey === "destination_address") return "transport-destination";
    if (requirementKey === "pickup" || requirementKey === "pickup_address") return "transport-pickup";
    if (requirementKey === "time" || requirementKey === "requested_time") return "transport-time";
  }

  if (item.use_case === "order_medicine") {
    if (requirementKey === "otc_item" || requirementKey === "item_text") return "otc-item";
    if (requirementKey === "time" || requirementKey === "requested_time") return "otc-time";
  }

  if (item.use_case === "book_appointment" && !isHomeServicePendingAction(item)) {
    if (requirementKey === "reason" || requirementKey === "time") return "appointment-note";
  }

  return null;
}

function buildActiveTaskChecklist(params: RightNowActionLabelsParams & {
  nextStepLabel: string;
  timeline: ConciergeFollowThroughStatus | null;
}): ActiveTaskChecklist {
  const {
    item,
    isSpanish,
    formMissingFields,
    isVyvaTask,
    nextStepLabel,
    timeline,
  } = params;
  const provider = activeTaskProviderLabel(item, isSpanish);
  const requirementStatus = evaluateConciergeFlowRequirements({
    useCase: item.use_case,
    payload: item.action_payload,
    providerName: provider,
    summary: item.action_summary,
  });
  const flowMap = getConciergeFlowMap(requirementStatus.flowReference);
  const providerNotRequired = !requirementStatus.needsProvider && !isProviderSearchPendingAction(item);
  const providerReady = providerNotRequired || Boolean(provider);
  const channel = handoffChannelLabel(item, isSpanish);
  const missionStatus = payloadString(item.action_payload, ["mission_status", "status"]).toLowerCase();
  const isWaitingForProvider = item.status === "calling" || missionStatus.includes("awaiting_provider");
  const hasMissingFormFields = formMissingFields.length > 0;
  const firstMissingRequirement = requirementStatus.firstMissingRequirement;
  const missingRequirementLabel = firstMissingRequirement
    ? (isSpanish ? firstMissingRequirement.labelEs : firstMissingRequirement.labelEn)
    : "";
  const detailsReady = requirementStatus.missingRequirements.length === 0 && !hasMissingFormFields;
  const detailsValue = hasMissingFormFields
    ? (isSpanish ? "Formulario incompleto" : "Form details needed")
    : firstMissingRequirement
      ? (isSpanish ? `Falta ${missingRequirementLabel}` : `${missingRequirementLabel} needed`)
      : (isSpanish ? "Listos" : "Ready");

  const items: ActiveTaskChecklistItem[] = [
    {
      key: "details",
      label: isSpanish ? "Falta" : "Missing",
      value: detailsValue,
      state: hasMissingFormFields ? "needed" : detailsReady ? "done" : "active",
      action: "details",
      actionLabel: hasMissingFormFields || !detailsReady
        ? (isSpanish ? "Anadir" : "Add")
        : (isSpanish ? "Revisar" : "Review"),
    },
    {
      key: "provider",
      label: isSpanish ? "Proveedor" : "Provider",
      value: provider || (providerNotRequired
        ? (isSpanish ? "No necesario" : "Not needed")
        : (isSpanish ? "Elige o anade" : "Choose or add")),
      state: provider ? "done" : providerNotRequired ? "done" : "needed",
      action: providerNotRequired ? undefined : "provider",
      actionLabel: providerNotRequired
        ? undefined
        : provider
          ? (isSpanish ? "Cambiar" : "Change")
          : (isSpanish ? "Anadir" : "Add"),
    },
    {
      key: "contact",
      label: isSpanish ? "Accion" : "Action",
      value: channel,
      state: channel.toLowerCase().includes("review") || channel.toLowerCase().includes("revision")
        ? "active"
        : "done",
      action: item.status === "pending" ? "contact" : undefined,
      actionLabel: item.status === "pending" ? (isSpanish ? "Cambiar" : "Change") : undefined,
    },
  ];

  if (isWaitingForProvider) {
    items.push({
      key: "reply",
      label: isSpanish ? "Respuesta" : "Provider reply",
      value: timeline?.activeStepId === "confirmed"
        ? (isSpanish ? "Recibida" : "Received")
        : (isSpanish ? "Esperando" : "Waiting"),
      state: timeline?.activeStepId === "confirmed" ? "done" : "waiting",
      action: "reply",
      actionLabel: isSpanish ? "Registrar" : "Record",
    });
  }

  items.push({
    key: "confirm",
    label: isSpanish ? "Tu OK" : "Your OK",
    value: item.status === "failed"
      ? (isSpanish ? "Revisar" : "Review needed")
      : isWaitingForProvider
        ? (isSpanish ? "Tras respuesta" : "After reply")
        : !providerReady
          ? (isSpanish ? "Elegir proveedor" : "Choose provider")
        : !detailsReady
          ? (isSpanish ? "Completar detalles" : "Complete details")
        : isVyvaTask
          ? (isSpanish ? "Tu OK primero" : "Your OK first")
          : nextStepLabel || (isSpanish ? "Tu OK primero" : "Your OK first"),
    state: item.status === "failed"
      ? "warning"
      : isWaitingForProvider
        ? "waiting"
        : !providerReady
          ? "needed"
        : !detailsReady
          ? "needed"
      : isVyvaTask
        ? "active"
        : "active",
    action: isWaitingForProvider
      ? "reply"
      : item.status === "pending"
      ? (!providerReady ? "provider" : !detailsReady ? "details" : "confirm")
      : undefined,
    actionLabel: isWaitingForProvider
      ? (isSpanish ? "Registrar" : "Record")
      : item.status === "pending"
      ? (!providerReady || !detailsReady ? (isSpanish ? "Anadir" : "Add") : (isSpanish ? "OK" : "OK"))
      : undefined,
  });

  return {
    title: isSpanish ? "Camino claro" : "Clear path",
    flowTitle: flowMap.title,
    helper: isSpanish
      ? "Solo pedimos lo que falta. Nada sale sin tu OK."
      : "Only missing info. Nothing goes out without your OK.",
    items,
  };
}

function activeTaskChecklistStateClasses(state: ActiveTaskChecklistItemState): string {
  switch (state) {
    case "done":
      return "border-[#BBF7D0] bg-[#F8FFFC] text-[#047857]";
    case "needed":
      return "border-[#FED7AA] bg-[#FFF7ED] text-[#9A3412]";
    case "waiting":
      return "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]";
    case "warning":
      return "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]";
    case "active":
    default:
      return "border-[#DDD6FE] bg-white text-vyva-purple";
  }
}

function ConciergeApprovalPromise({ isSpanish, tone = "teal" }: { isSpanish: boolean; tone?: "teal" | "purple" }) {
  const classes = tone === "purple"
    ? "border-[#E9D5FF] bg-white text-vyva-purple"
    : "border-[#CCFBF1] bg-white text-[#0F766E]";
  return (
    <div className={`mt-3 flex items-center gap-2 rounded-[15px] border px-3 py-2 font-body text-[12px] font-black leading-snug ${classes}`}>
      <ShieldCheck size={14} className="flex-shrink-0" aria-hidden="true" />
      <span>
        {isSpanish
          ? "Tu confirmas antes de enviar, llamar o reservar."
          : "You approve before anything is sent, called, or booked."}
      </span>
    </div>
  );
}

function ActiveTaskChecklistPanel({
  checklist,
  onAction,
}: {
  checklist: ActiveTaskChecklist;
  onAction: (action: ActiveTaskChecklistAction) => void;
}) {
  return (
    <div
      className="mt-3 rounded-[18px] border border-vyva-border bg-white p-3"
      data-testid="panel-concierge-flow-checklist"
      aria-label={checklist.flowTitle}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-vyva-text-2">
            {checklist.title}
          </p>
          <p className="mt-1 font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {checklist.helper}
          </p>
        </div>
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]">
          <ShieldCheck size={15} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {checklist.items.map((item) => {
          const contents = (
            <>
            <p className="font-body text-[11px] font-black uppercase tracking-[0.08em] opacity-80">
              {item.label}
            </p>
            <p className="mt-1 font-body text-[13px] font-black leading-tight text-vyva-text-1">
              {item.value}
            </p>
            {item.action && item.actionLabel ? (
              <span className="mt-2 inline-flex rounded-full bg-white/80 px-2.5 py-1 font-body text-[11px] font-black text-current shadow-sm">
                {item.actionLabel}
              </span>
            ) : null}
            </>
          );
          const className = `min-h-[58px] rounded-[14px] border px-3 py-2 text-left transition ${
            activeTaskChecklistStateClasses(item.state)
          }`;
          if (item.action) {
            return (
              <button
                key={item.key}
                type="button"
                data-state={item.state}
                data-testid={`button-concierge-checklist-${item.key}`}
                onClick={() => onAction(item.action as ActiveTaskChecklistAction)}
                className={`${className} vyva-tap`}
              >
                {contents}
              </button>
            );
          }
          return (
            <div
              key={item.key}
              data-state={item.state}
              className={className}
            >
              {contents}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function liveHandoffStateClasses(state: ConciergeLiveHandoffState): string {
  switch (state) {
    case "completed":
      return "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]";
    case "sent_or_called":
    case "waiting":
      return "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]";
    case "needs_human_help":
      return "border-[#FED7AA] bg-[#FFF7ED] text-[#9A3412]";
    case "failed":
      return "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]";
    case "ready":
    default:
      return "border-[#DDD6FE] bg-[#F5F3FF] text-vyva-purple";
  }
}

function ConciergeLiveHandoffPanel({ summary, isSpanish }: { summary: ConciergeLiveHandoffSummary; isSpanish: boolean }) {
  return (
    <div
      className="mt-3 rounded-[20px] border border-[#CCFBF1] bg-[#F8FFFC] p-3"
      data-testid="panel-concierge-live-handoff"
      data-state={summary.state}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
            {isSpanish ? "Traspaso real" : "Live handoff"}
          </p>
          <p className="mt-1 font-body text-[15px] font-black leading-tight text-vyva-text-1">
            {summary.label}
          </p>
          <p className="mt-1 font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {summary.helper}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 font-body text-[11px] font-black ${liveHandoffStateClasses(summary.state)}`}
          data-testid="chip-concierge-live-handoff-state"
        >
          {summary.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summary.items.map((item) => (
          <div
            key={item.key}
            className={`min-h-[68px] rounded-[15px] border px-3 py-2 ${
              item.ready
                ? "border-[#BBF7D0] bg-white text-[#047857]"
                : "border-[#FED7AA] bg-[#FFFBF5] text-[#9A3412]"
            }`}
            data-testid={`item-live-handoff-${item.key}`}
            data-ready={item.ready ? "true" : "false"}
          >
            <div className="flex items-center gap-1.5">
              {item.ready ? <CircleCheck size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
              <p className="font-body text-[10px] font-black uppercase tracking-[0.08em]">
                {item.label}
              </p>
            </div>
            <p className="mt-1 font-body text-[12px] font-black leading-tight text-vyva-text-1">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuidedDetailCapturePanel({
  capture,
  value,
  onChange,
  onSave,
  isSaving,
  error,
  notice,
  useFormCompatibleTestIds,
  isSpanish,
}: {
  capture: ConciergeGuidedDetailCapture;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  error: string | null;
  notice: string | null;
  useFormCompatibleTestIds: boolean;
  isSpanish: boolean;
}) {
  const question = capture.nextQuestion;
  if (!question) return null;
  const inputTestId = guidedDetailInputTestId(question, useFormCompatibleTestIds);

  return (
    <div
      className="mt-3 rounded-[22px] border border-[#C4B5FD] bg-[#FBFAFF] p-4 shadow-[0_14px_30px_rgba(124,58,237,0.10)]"
      data-testid="panel-concierge-guided-details"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#6D28D9] shadow-sm">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#6D28D9]">
            {capture.title}
          </span>
          <span className="mt-1 block font-body text-[17px] font-black leading-tight text-vyva-text-1">
            {question.prompt}
          </span>
          <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {capture.helper}
          </span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {capture.questions.map((entry) => {
          const isDone = capture.answeredKeys.includes(entry.key);
          const isCurrent = entry.key === question.key;
          return (
            <span
              key={entry.key}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-body text-[11px] font-black ${
                isDone
                  ? "border-[#99F6E4] bg-white text-[#0F766E]"
                  : isCurrent
                    ? "border-[#DDD6FE] bg-white text-[#6D28D9]"
                    : "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
              }`}
            >
              {isDone ? <CircleCheck size={12} aria-hidden="true" /> : null}
              {entry.label}
            </span>
          );
        })}
      </div>

      <label className="mt-3 block">
        <span className="font-body text-[12px] font-black text-vyva-text-1">{question.label}</span>
        {question.inputType === "select" ? (
          <select
            data-testid={inputTestId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="mt-1 w-full rounded-[16px] border border-[#DDD6FE] bg-white px-3 py-3 font-body text-[15px] font-bold text-vyva-text-1 shadow-sm outline-none focus:border-[#7C3AED]"
          >
            <option value="">{question.placeholder}</option>
            {(question.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : question.inputType === "textarea" ? (
          <textarea
            data-testid={inputTestId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={question.placeholder}
            rows={3}
            className="mt-1 w-full rounded-[16px] border border-[#DDD6FE] bg-white px-3 py-3 font-body text-[15px] font-bold text-vyva-text-1 shadow-sm outline-none placeholder:text-vyva-text-3 focus:border-[#7C3AED]"
          />
        ) : (
          <input
            data-testid={inputTestId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={question.placeholder}
            className="mt-1 w-full rounded-[16px] border border-[#DDD6FE] bg-white px-3 py-3 font-body text-[15px] font-bold text-vyva-text-1 shadow-sm outline-none placeholder:text-vyva-text-3 focus:border-[#7C3AED]"
          />
        )}
      </label>

      {error ? (
        <p className="mt-2 rounded-[12px] bg-[#FEF2F2] px-3 py-2 font-body text-[12px] font-bold text-[#B91C1C]">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-2 rounded-[12px] bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-bold text-[#047857]">
          {notice}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          data-testid="button-concierge-guided-detail-save"
          onClick={onSave}
          disabled={!value.trim() || isSaving}
          className="vyva-tap inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#7C3AED] px-5 py-3 font-body text-[14px] font-black text-white shadow-[0_12px_26px_rgba(124,58,237,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}
          {isSpanish ? "Guardar detalle" : "Save detail"}
        </button>
        <span className="font-body text-[12px] font-bold leading-snug text-vyva-text-2">
          {isSpanish
            ? "Despues veras el OK final antes de enviar, llamar o reservar."
            : "After this, you still get the final OK before anything is sent, called, or booked."}
        </span>
      </div>
    </div>
  );
}

function ShowVyvaExecutionGuidePanel({
  guide,
}: {
  guide: ShowVyvaExecutionGuide;
}) {
  return (
    <div
      className="mt-3 rounded-[22px] border border-[#BFDBFE] bg-[#F8FBFF] p-4 shadow-[0_12px_28px_rgba(37,99,235,0.08)]"
      data-testid="panel-show-vyva-execution-guide"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#2563EB] shadow-sm">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#2563EB]">
            {guide.title}
          </span>
          <span className="mt-1 block font-body text-[16px] font-black leading-tight text-vyva-text-1">
            {guide.nextQuestion}
          </span>
          <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {guide.helper}
          </span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {guide.requiredDetails.slice(0, 4).map((detail) => (
          <span
            key={detail}
            className="rounded-full border border-[#DBEAFE] bg-white px-3 py-1 font-body text-[11px] font-black text-[#1D4ED8]"
          >
            {detail}
          </span>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {guide.steps.slice(0, 3).map((step, index) => (
          <div key={`${step}-${index}`} className="rounded-[14px] bg-white px-3 py-2 text-center shadow-sm">
            <p className="font-body text-[10px] font-black uppercase tracking-[0.08em] text-[#64748B]">
              {index + 1}
            </p>
            <p className="mt-0.5 font-body text-[12px] font-black leading-tight text-vyva-text-1">
              {step}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 flex items-start gap-2 rounded-[14px] bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black leading-snug text-[#047857]">
        <ShieldCheck size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>{guide.confirmationReminder}</span>
      </p>
    </div>
  );
}

function PendingActionReviewCard({
  review,
  primaryLabel,
  onConfirm,
  onChange,
  onCancel,
  confirmPending,
  cancelPending,
  primaryDisabled,
  primaryIcon: PrimaryIcon,
  confirmTestId,
  changeTestId,
  cancelTestId,
  isSpanish,
}: {
  review: PendingActionReviewSummary;
  primaryLabel: string;
  onConfirm: () => void;
  onChange: () => void;
  onCancel: () => void;
  confirmPending: boolean;
  cancelPending: boolean;
  primaryDisabled: boolean;
  primaryIcon: LucideIcon;
  confirmTestId: string;
  changeTestId: string;
  cancelTestId: string;
  isSpanish: boolean;
}) {
  return (
    <div
      className="mt-3 rounded-[22px] border border-[#99F6E4] bg-[#F8FFFC] p-4 shadow-[0_14px_30px_rgba(13,148,136,0.10)]"
      data-testid="panel-concierge-next-action"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#0F766E] shadow-sm">
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
            {review.eyebrow}
          </span>
          <span className="mt-1 block font-body text-[17px] font-black leading-tight text-vyva-text-1">
            {review.title}
          </span>
          <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {review.summary}
          </span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {review.details.map((detail) => (
          <div
            key={`${detail.label}-${detail.value}`}
            className={`rounded-[15px] border px-3 py-2 ${
              detail.isMissing
                ? "border-[#FED7AA] bg-[#FFF7ED]"
                : "border-[#CCFBF1] bg-white"
            }`}
          >
            <p className={`font-body text-[10px] font-black uppercase tracking-[0.08em] ${
              detail.isMissing ? "text-[#9A3412]" : "text-[#0F766E]"
            }`}>
              {detail.label}
            </p>
            <p className="mt-0.5 font-body text-[12px] font-black leading-snug text-vyva-text-1">
              {detail.value}
            </p>
          </div>
        ))}
      </div>

      {review.missingDetails.length > 0 ? (
        <p className="mt-3 rounded-[14px] bg-[#FFF7ED] px-3 py-2 font-body text-[12px] font-bold leading-snug text-[#9A3412]">
          {isSpanish ? "Completa antes de confirmar: " : "Complete before confirming: "}
          {review.missingDetails.join(", ")}
        </p>
      ) : null}

      {review.reconfirmation ? (
        <div
          className="mt-3 rounded-[16px] border border-[#FBBF24] bg-[#FFFBEB] px-3 py-3"
          data-testid="panel-concierge-reconfirmation-request"
        >
          <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#92400E]">
            {isSpanish ? "Aprobacion actualizada" : "Updated approval"}
          </p>
          <p className="mt-1 font-body text-[13px] font-black leading-snug text-[#78350F]">
            {isSpanish ? "Cambio desde tu ultimo OK: " : "Changed since your last OK: "}
            {review.reconfirmation.changedFields}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-[13px] bg-white px-3 py-2">
              <p className="font-body text-[10px] font-black uppercase tracking-[0.08em] text-[#92400E]">
                {isSpanish ? "Proveedor" : "Provider"}
              </p>
              <p className="mt-1 font-body text-[12px] font-black leading-snug text-vyva-text-1">
                {review.reconfirmation.providerName}
              </p>
            </div>
            <div className="rounded-[13px] bg-white px-3 py-2">
              <p className="font-body text-[10px] font-black uppercase tracking-[0.08em] text-[#92400E]">
                {isSpanish ? "Contacto" : "Contact"}
              </p>
              <p className="mt-1 font-body text-[12px] font-black leading-snug text-vyva-text-1">
                {review.reconfirmation.providerContact}
              </p>
            </div>
            <div className="rounded-[13px] bg-white px-3 py-2">
              <p className="font-body text-[10px] font-black uppercase tracking-[0.08em] text-[#92400E]">
                {isSpanish ? "Resumen" : "Summary"}
              </p>
              <p className="mt-1 font-body text-[12px] font-black leading-snug text-vyva-text-1">
                {review.reconfirmation.summary}
              </p>
            </div>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer font-body text-[12px] font-black text-[#92400E]">
              {isSpanish ? "Ver datos preparados" : "Show prepared payload"}
            </summary>
            <pre className="mt-2 max-h-44 overflow-auto rounded-[13px] bg-[#2F2135] p-3 text-left font-mono text-[11px] leading-relaxed text-white">
              {JSON.stringify(review.reconfirmation.outboundPayload ?? {}, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}

      <ConciergeApprovalPromise isSpanish={isSpanish} />

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Button
          data-testid={confirmTestId}
          onClick={onConfirm}
          disabled={primaryDisabled || confirmPending || cancelPending}
          className="vyva-primary-action h-auto hover:bg-vyva-purple/90"
        >
          {confirmPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <PrimaryIcon size={16} className="mr-2" />}
          {primaryLabel}
        </Button>
        <Button
          data-testid={changeTestId}
          onClick={onChange}
          disabled={confirmPending || cancelPending}
          variant="outline"
          className="vyva-secondary-action h-auto border-[#99F6E4] text-[#0F766E]"
        >
          <PencilLine size={15} className="mr-2" />
          {isSpanish ? "Cambiar" : "Change"}
        </Button>
        <Button
          data-testid={cancelTestId}
          onClick={onCancel}
          disabled={confirmPending || cancelPending}
          variant="outline"
          className="vyva-secondary-action h-auto"
        >
          {isSpanish ? "Cancelar" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

function isVerifiedProviderContactHandoff(item: ConciergePendingItem | null | undefined): item is ConciergePendingItem {
  return item?.action_payload?.live_handoff_flow === "verified_provider_contact_v1";
}

function providerContactSourceShortlistId(item: ConciergePendingItem): string {
  return payloadString(item.action_payload, ["source_shortlist_pending_id"]);
}

function providerContactSelectedProviderId(item: ConciergePendingItem): string {
  const comparison = isRecord(item.action_payload?.comparison) ? item.action_payload?.comparison : null;
  return comparison && typeof comparison.id === "string" ? comparison.id.trim() : "";
}

function ProviderContactHandoffPanel({ item, isSpanish }: { item: ConciergePendingItem; isSpanish: boolean }) {
  const payload = item.action_payload;
  const verification = isRecord(payload?.provider_verification) ? payload.provider_verification : null;
  const status = verification && typeof verification.status === "string" ? verification.status : "unknown";
  const source = verification && typeof verification.source === "string" ? verification.source : "";
  const checkedAt = verification && typeof verification.checked_at === "string" ? verification.checked_at : "";
  const checkedDate = checkedAt && Number.isFinite(new Date(checkedAt).getTime())
    ? new Intl.DateTimeFormat(isSpanish ? "es-ES" : "en-GB", { dateStyle: "medium" }).format(new Date(checkedAt))
    : "";
  const exactContent = payloadString(payload, ["call_script", "whatsapp_message", "email_body", "draft_message"]);

  return (
    <section
      className="mt-3 rounded-[22px] border border-[#BFE7E1] bg-[#F8FFFC] p-4"
      data-testid="panel-provider-contact-handoff"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#0F766E] shadow-sm">
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
            {isSpanish ? "Contacto comprobado" : "Checked contact"}
          </p>
          <p className="mt-1 font-body text-[16px] font-black leading-tight text-vyva-text-1">
            {item.provider_name || payloadString(payload, ["selected_provider_name", "provider_name"])}
          </p>
          <p className="mt-1 font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {status === "verified"
              ? (isSpanish ? "Fuente verificada" : "Verified source")
              : status === "reported"
                ? (isSpanish ? "Informacion publicada; revisa antes de continuar" : "Published information; review before continuing")
                : (isSpanish ? "La fuente no esta verificada" : "Source is not verified")}
            {source ? ` - ${source}` : ""}{checkedDate ? ` - ${checkedDate}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 font-body text-[11px] font-black text-[#0F766E]">
          {handoffChannelLabel(item, isSpanish)}
        </span>
      </div>
      {exactContent ? (
        <div className="mt-3 rounded-[16px] border border-[#D9ECE8] bg-white p-3">
          <p className="font-body text-[10px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
            {isSpanish ? "Esto es lo que VYVA dira o enviara" : "What VYVA will say or send"}
          </p>
          <p className="mt-1 whitespace-pre-wrap font-body text-[13px] font-semibold leading-relaxed text-vyva-text-1">
            {exactContent}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function BookingFormSupportPanel({
  item,
  plan,
  bookingUrl,
  canOpenForm,
  externalLinksAllowed,
  isDryRun,
  form,
  notice,
  error,
  intakeDraft,
  isSaving,
  isSpanish,
  onFormChange,
  onOpenForm,
  onSubmitted,
  onAddDetails,
  onNeedHelp,
}: {
  item: ConciergePendingItem;
  plan: ReturnType<typeof getFormAutomationPlan>;
  bookingUrl: string;
  canOpenForm: boolean;
  externalLinksAllowed: boolean;
  isDryRun: boolean;
  form: BookingFormOutcomeForm;
  notice: string | null;
  error: string | null;
  intakeDraft: string;
  isSaving: boolean;
  isSpanish: boolean;
  onFormChange: (field: keyof BookingFormOutcomeForm, value: string) => void;
  onOpenForm: (href: string, label: string) => void;
  onSubmitted: () => void;
  onAddDetails: () => void;
  onNeedHelp: () => void;
}) {
  const adapterLabel = plan?.adapterLabel;
  const missingFields = plan?.missingFields ?? [];
  const nextStep = plan?.nextStep;
  return (
    <div
      className="mt-3 rounded-[18px] border border-[#BBF7D0] bg-[#F8FFFC] px-3 py-3"
      data-testid="panel-concierge-form-plan"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-[#047857] shadow-sm">
          <Calendar size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#047857]">
            {adapterLabel
              ? (isSpanish ? `Sistema: ${adapterLabel}` : `System: ${adapterLabel}`)
              : (isSpanish ? "Formulario VYVA" : "VYVA form task")}
          </span>
          {missingFields.length > 0 ? (
            <span className="mt-1 block font-body text-[13px] font-bold text-vyva-text-2">
              {isSpanish ? "Falta primero: " : "Needs first: "}{missingFields.join(", ")}
            </span>
          ) : canOpenForm ? (
            <span className="mt-1 block font-body text-[13px] font-bold text-vyva-text-2">
              {isSpanish ? "Listo para abrir con los datos reunidos." : "Ready to open with the gathered details."}
            </span>
          ) : nextStep ? (
            <span className="mt-1 block font-body text-[13px] font-bold text-vyva-text-2">
              {nextStep}
            </span>
          ) : null}
        </span>
      </div>

      {canOpenForm && bookingUrl ? (
        <div className="mt-3 rounded-[16px] border border-[#BBF7D0] bg-white p-3" data-testid={`panel-booking-form-ready-${item.id}`}>
          <div className="flex flex-wrap gap-2">
            {externalLinksAllowed ? (
              <button
                type="button"
                onClick={() => onOpenForm(bookingUrl, isSpanish ? "Abrir formulario" : "Open form")}
                data-testid={`link-booking-form-open-${item.id}`}
                className="vyva-tap inline-flex min-h-[40px] items-center gap-2 rounded-full bg-[#047857] px-4 font-body text-[13px] font-black text-white shadow-sm"
              >
                <ExternalLink size={14} />
                {isSpanish ? "Abrir formulario" : "Open form"}
              </button>
            ) : (
              <p
                data-testid={`text-booking-form-confirm-first-${item.id}`}
                className="rounded-[14px] bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]"
              >
                {isDryRun
                  ? (isSpanish ? "Modo prueba: no se abrira ni enviara ningun formulario real." : "Test mode: no real form will open or submit.")
                  : (isSpanish ? "Confirma arriba antes de abrir el formulario." : "Confirm above before opening the form.")}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              data-testid={`button-booking-form-help-${item.id}`}
              onClick={onNeedHelp}
              className="vyva-secondary-action h-auto border-[#BBF7D0] text-[#047857]"
            >
              <MessageCircle size={14} className="mr-2" />
              {isSpanish ? "Necesito ayuda" : "Need help"}
            </Button>
          </div>
          {externalLinksAllowed ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Input
                  value={form.reference}
                  onChange={(event) => onFormChange("reference", event.target.value)}
                  placeholder={isSpanish ? "Referencia opcional" : "Reference optional"}
                  data-testid={`input-booking-form-reference-${item.id}`}
                  className="h-[44px] rounded-[14px] border-[#BBF7D0] bg-white font-body text-[14px]"
                />
                <Input
                  value={form.notes}
                  onChange={(event) => onFormChange("notes", event.target.value)}
                  placeholder={isSpanish ? "Nota opcional" : "Optional note"}
                  data-testid={`input-booking-form-notes-${item.id}`}
                  className="h-[44px] rounded-[14px] border-[#BBF7D0] bg-white font-body text-[14px]"
                />
              </div>
              <Button
                type="button"
                data-testid={`button-booking-form-submitted-${item.id}`}
                onClick={onSubmitted}
                disabled={isSaving || isDryRun}
                className="vyva-primary-action mt-3 h-auto w-full bg-[#047857] hover:bg-[#065F46]"
              >
                {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CircleCheck size={16} className="mr-2" />}
                {isDryRun
                  ? (isSpanish ? "Usa la simulacion arriba" : "Use simulated outcome above")
                  : (isSpanish ? "Ya lo envie" : "I submitted it")}
              </Button>
            </>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            data-testid={`button-booking-form-add-details-${item.id}`}
            onClick={onAddDetails}
            className="vyva-primary-action h-auto bg-[#047857] hover:bg-[#065F46]"
          >
            <PencilLine size={15} className="mr-2" />
            {isSpanish ? "Anadir datos" : "Add details"}
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid={`button-booking-form-help-${item.id}`}
            onClick={onNeedHelp}
            className="vyva-secondary-action h-auto border-[#BBF7D0] text-[#047857]"
          >
            <MessageCircle size={15} className="mr-2" />
            {isSpanish ? "Pedir ayuda" : "Ask VYVA"}
          </Button>
        </div>
      )}

      {notice ? (
        <p data-testid="booking-form-notice" className="mt-3 rounded-[14px] bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]">
          {notice}
        </p>
      ) : null}
      {intakeDraft ? (
        <div
          data-testid={`panel-booking-form-intake-draft-${item.id}`}
          className="mt-3 rounded-[16px] border border-[#BBF7D0] bg-white px-3 py-2"
        >
          <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#047857]">
            {isSpanish ? "Borrador para VYVA" : "Intake draft"}
          </p>
          <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-1">
            {intakeDraft}
          </p>
        </div>
      ) : null}
      {error ? (
        <p data-testid="booking-form-error" className="mt-3 rounded-[14px] bg-[#FEF2F2] px-3 py-2 font-body text-[12px] font-black text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PhoneCallOutcomePanel({
  item,
  form,
  notice,
  error,
  isSaving,
  isDryRun,
  isSpanish,
  onFormChange,
  onCall,
  onSave,
}: {
  item: ConciergePendingItem;
  form: PhoneCallOutcomeForm;
  notice: string | null;
  error: string | null;
  isSaving: boolean;
  isDryRun: boolean;
  isSpanish: boolean;
  onFormChange: (field: keyof PhoneCallOutcomeForm, value: string) => void;
  onCall: (href: string, label: string) => void;
  onSave: () => void;
}) {
  const provider = phoneCallProviderName(item, isSpanish);
  const phone = phoneCallProviderPhone(item);
  const href = phoneHref(phone);
  const script = phoneCallScript(item, isSpanish);
  const statusOptions: PhoneCallOutcomeStatus[] = ["confirmed", "no_answer", "needs_info", "cancelled"];

  return (
    <div
      className="mt-3 rounded-[22px] border border-[#DDD6FE] bg-[#FBFAFF] p-4"
      data-testid="panel-concierge-phone-call"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-vyva-purple shadow-sm">
          <PhoneCall size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-vyva-purple">
            {isSpanish ? "Paso de llamada" : "Call step"}
          </span>
          <span className="mt-1 block truncate font-body text-[16px] font-black leading-tight text-vyva-text-1">
            {provider}
          </span>
          <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {isSpanish
              ? "Llama ahora y guarda lo que paso."
              : "Call now, then save what happened."}
          </span>
        </span>
        {href ? (
          <button
            type="button"
            onClick={() => onCall(href, isSpanish ? "Llamar" : "Call now")}
            data-testid={`link-concierge-phone-call-${item.id}`}
            disabled={isDryRun}
            className={`vyva-tap inline-flex min-h-[40px] flex-shrink-0 items-center gap-2 rounded-full px-4 font-body text-[13px] font-black text-white shadow-sm ${isDryRun ? "bg-emerald-700 opacity-80" : "bg-vyva-purple"}`}
            aria-label={`${isSpanish ? "Llamar" : "Call"} ${phone}`}
          >
            <PhoneCall size={14} />
            {isDryRun ? (isSpanish ? "Prueba" : "Test mode") : (isSpanish ? "Llamar" : "Call now")}
          </button>
        ) : null}
      </div>

      <div className="mt-3 rounded-[18px] border border-[#EDE9FE] bg-white p-3">
        <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-vyva-purple">
          {isSpanish ? "Guion" : "Script"}
        </p>
        <p className="mt-1 line-clamp-4 whitespace-pre-wrap font-body text-[12px] font-semibold leading-relaxed text-vyva-text-2">
          {script}
        </p>
      </div>

      <ConciergeApprovalPromise isSpanish={isSpanish} tone="purple" />

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {statusOptions.map((status) => {
          const selected = form.status === status;
          return (
            <Button
              key={status}
              type="button"
              data-testid={`button-phone-outcome-status-${status}-${item.id}`}
              onClick={() => onFormChange("status", status)}
              variant={selected ? "default" : "outline"}
              className={selected ? "vyva-primary-action h-auto" : "vyva-secondary-action h-auto border-[#DDD6FE] text-vyva-purple"}
            >
              {phoneCallOutcomeStatusLabel(status, isSpanish)}
            </Button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input
          value={form.scheduledFor}
          onChange={(event) => onFormChange("scheduledFor", event.target.value)}
          placeholder={isSpanish ? "Hora confirmada opcional" : "Confirmed time optional"}
          data-testid={`input-phone-outcome-time-${item.id}`}
          className="h-[44px] rounded-[14px] border-[#DDD6FE] bg-white font-body text-[14px]"
        />
        <Input
          value={form.reference}
          onChange={(event) => onFormChange("reference", event.target.value)}
          placeholder={isSpanish ? "Referencia opcional" : "Reference optional"}
          data-testid={`input-phone-outcome-reference-${item.id}`}
          className="h-[44px] rounded-[14px] border-[#DDD6FE] bg-white font-body text-[14px]"
        />
        <Input
          value={form.price}
          onChange={(event) => onFormChange("price", event.target.value)}
          placeholder={isSpanish ? "Precio opcional" : "Price optional"}
          data-testid={`input-phone-outcome-price-${item.id}`}
          className="h-[44px] rounded-[14px] border-[#DDD6FE] bg-white font-body text-[14px]"
        />
        <Input
          value={form.followUp}
          onChange={(event) => onFormChange("followUp", event.target.value)}
          placeholder={isSpanish ? "Seguimiento opcional" : "Follow-up optional"}
          data-testid={`input-phone-outcome-follow-up-${item.id}`}
          className="h-[44px] rounded-[14px] border-[#DDD6FE] bg-white font-body text-[14px]"
        />
        <textarea
          value={form.notes}
          onChange={(event) => onFormChange("notes", event.target.value)}
          placeholder={isSpanish ? "Nota breve opcional" : "Optional short note"}
          data-testid={`input-phone-outcome-notes-${item.id}`}
          className="min-h-[70px] rounded-[14px] border border-[#DDD6FE] bg-white px-3 py-2 font-body text-[14px] font-semibold text-vyva-text-1 outline-none focus:border-vyva-purple focus:ring-2 focus:ring-[#EDE9FE] sm:col-span-2"
        />
      </div>

      <Button
        type="button"
        data-testid={`button-phone-outcome-save-${item.id}`}
        onClick={onSave}
        disabled={isSaving || isDryRun}
        className="vyva-primary-action mt-3 h-auto w-full"
      >
        {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CircleCheck size={16} className="mr-2" />}
        {isDryRun
          ? (isSpanish ? "Usa la simulacion arriba" : "Use simulated outcome above")
          : (isSpanish ? "Guardar resultado" : "Save result")}
      </Button>

      {notice ? (
        <p data-testid="phone-outcome-notice" className="mt-3 rounded-[14px] bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p data-testid="phone-outcome-error" className="mt-3 rounded-[14px] bg-[#FEF2F2] px-3 py-2 font-body text-[12px] font-black text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EmailDraftOutcomePanel({
  item,
  draft,
  href,
  form,
  notice,
  error,
  isSaving,
  isDryRun,
  isSpanish,
  onFormChange,
  onOpenDraft,
  onSent,
}: {
  item: ConciergePendingItem;
  draft: ConciergeEmailDraft;
  href: string;
  form: EmailDraftOutcomeForm;
  notice: string | null;
  error: string | null;
  isSaving: boolean;
  isDryRun: boolean;
  isSpanish: boolean;
  onFormChange: (field: keyof EmailDraftOutcomeForm, value: string) => void;
  onOpenDraft: (href: string, label: string) => void;
  onSent: () => void;
}) {
  return (
    <div
      className="mt-3 rounded-[22px] border border-[#C7D2FE] bg-[#F8FAFF] p-4"
      data-testid="panel-concierge-email-draft"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-vyva-purple shadow-sm">
          <Mail size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-vyva-purple">
            {isSpanish ? "Email preparado" : "Email ready"}
          </span>
          <span className="mt-1 block truncate font-body text-[16px] font-black leading-tight text-vyva-text-1">
            {draft.address}
          </span>
          <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {isDryRun
              ? (isSpanish ? "Modo prueba: no se abrira ni enviara ningun email real." : "Test mode: no real email will open or send.")
              : (isSpanish
                ? "Abre el borrador, envialo desde tu correo y guarda que ya salio."
                : "Open the draft, send it from your email, then save that it went out.")}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onOpenDraft(href, isSpanish ? "Abrir email" : "Open email")}
          data-testid={`link-concierge-email-draft-open-${item.id}`}
          disabled={isDryRun}
          className={`vyva-tap inline-flex min-h-[40px] flex-shrink-0 items-center gap-2 rounded-full px-4 font-body text-[13px] font-black text-white shadow-sm ${isDryRun ? "bg-emerald-700 opacity-80" : "bg-vyva-purple"}`}
          aria-label={`${isSpanish ? "Abrir email" : "Open email"} ${draft.address}`}
        >
          <ExternalLink size={14} />
          {isDryRun ? (isSpanish ? "Prueba" : "Test mode") : (isSpanish ? "Abrir" : "Open")}
        </button>
      </div>

      <div className="mt-3 rounded-[18px] border border-[#E0E7FF] bg-white p-3">
        <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-vyva-purple">
          {isSpanish ? "Asunto" : "Subject"}
        </p>
        <p className="mt-1 font-body text-[13px] font-black leading-snug text-vyva-text-1">
          {draft.subject}
        </p>
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap font-body text-[12px] font-semibold leading-relaxed text-vyva-text-2">
          {draft.body}
        </p>
      </div>

      <ConciergeApprovalPromise isSpanish={isSpanish} tone="purple" />

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input
          value={form.reference}
          onChange={(event) => onFormChange("reference", event.target.value)}
          placeholder={isSpanish ? "Referencia opcional" : "Reference optional"}
          data-testid={`input-email-draft-reference-${item.id}`}
          className="h-[44px] rounded-[14px] border-[#C7D2FE] bg-white font-body text-[14px]"
        />
        <Input
          value={form.notes}
          onChange={(event) => onFormChange("notes", event.target.value)}
          placeholder={isSpanish ? "Nota opcional" : "Optional note"}
          data-testid={`input-email-draft-notes-${item.id}`}
          className="h-[44px] rounded-[14px] border-[#C7D2FE] bg-white font-body text-[14px]"
        />
      </div>

      <Button
        type="button"
        data-testid={`button-email-draft-sent-${item.id}`}
        onClick={onSent}
        disabled={isSaving || isDryRun}
        className="vyva-primary-action mt-3 h-auto w-full"
      >
        {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CircleCheck size={16} className="mr-2" />}
        {isDryRun
          ? (isSpanish ? "Usa la simulacion arriba" : "Use simulated outcome above")
          : (isSpanish ? "Ya lo envie" : "I sent it")}
      </Button>

      {notice ? (
        <p data-testid="email-draft-notice" className="mt-3 rounded-[14px] bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p data-testid="email-draft-error" className="mt-3 rounded-[14px] bg-[#FEF2F2] px-3 py-2 font-body text-[12px] font-black text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function WhatsAppDraftOutcomePanel({
  item,
  draft,
  href,
  form,
  notice,
  error,
  isSaving,
  isDryRun,
  isSpanish,
  onFormChange,
  onOpenDraft,
  onSent,
}: {
  item: ConciergePendingItem;
  draft: ConciergeWhatsAppDraft;
  href: string;
  form: WhatsAppDraftOutcomeForm;
  notice: string | null;
  error: string | null;
  isSaving: boolean;
  isDryRun: boolean;
  isSpanish: boolean;
  onFormChange: (field: keyof WhatsAppDraftOutcomeForm, value: string) => void;
  onOpenDraft: (href: string, label: string) => void;
  onSent: () => void;
}) {
  return (
    <div
      className="mt-3 rounded-[22px] border border-[#99F6E4] bg-[#F0FDFA] p-4"
      data-testid="panel-concierge-whatsapp-draft"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#0F766E] shadow-sm">
          <Send size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
            {isSpanish ? "WhatsApp preparado" : "WhatsApp ready"}
          </span>
          <span className="mt-1 block truncate font-body text-[16px] font-black leading-tight text-vyva-text-1">
            {draft.number}
          </span>
          <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {isDryRun
              ? (isSpanish ? "Modo prueba: no se abrira ni enviara ningun WhatsApp real." : "Test mode: no real WhatsApp will open or send.")
              : (isSpanish
                ? "Abre el borrador, envialo en WhatsApp y guarda que ya salio."
                : "Open the draft, send it in WhatsApp, then save that it went out.")}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onOpenDraft(href, isSpanish ? "Abrir WhatsApp" : "Open WhatsApp")}
          data-testid={`link-concierge-whatsapp-draft-open-${item.id}`}
          disabled={isDryRun}
          className="vyva-tap inline-flex min-h-[40px] flex-shrink-0 items-center gap-2 rounded-full bg-[#0F766E] px-4 font-body text-[13px] font-black text-white shadow-sm disabled:opacity-80"
          aria-label={`${isSpanish ? "Abrir WhatsApp" : "Open WhatsApp"} ${draft.number}`}
        >
          <ExternalLink size={14} />
          {isDryRun ? (isSpanish ? "Prueba" : "Test mode") : (isSpanish ? "Abrir" : "Open")}
        </button>
      </div>

      <div className="mt-3 rounded-[18px] border border-[#CCFBF1] bg-white p-3">
        <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
          {isSpanish ? "Mensaje" : "Message"}
        </p>
        <p className="mt-1 line-clamp-4 whitespace-pre-wrap font-body text-[12px] font-semibold leading-relaxed text-vyva-text-2">
          {draft.message}
        </p>
      </div>

      <ConciergeApprovalPromise isSpanish={isSpanish} />

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input
          value={form.reference}
          onChange={(event) => onFormChange("reference", event.target.value)}
          placeholder={isSpanish ? "Referencia opcional" : "Reference optional"}
          data-testid={`input-whatsapp-draft-reference-${item.id}`}
          className="h-[44px] rounded-[14px] border-[#99F6E4] bg-white font-body text-[14px]"
        />
        <Input
          value={form.notes}
          onChange={(event) => onFormChange("notes", event.target.value)}
          placeholder={isSpanish ? "Nota opcional" : "Optional note"}
          data-testid={`input-whatsapp-draft-notes-${item.id}`}
          className="h-[44px] rounded-[14px] border-[#99F6E4] bg-white font-body text-[14px]"
        />
      </div>

      <Button
        type="button"
        data-testid={`button-whatsapp-draft-sent-${item.id}`}
        onClick={onSent}
        disabled={isSaving || isDryRun}
        className="vyva-primary-action mt-3 h-auto w-full"
      >
        {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CircleCheck size={16} className="mr-2" />}
        {isDryRun
          ? (isSpanish ? "Usa la simulacion arriba" : "Use simulated outcome above")
          : (isSpanish ? "Ya lo envie" : "I sent it")}
      </Button>

      {notice ? (
        <p data-testid="whatsapp-draft-notice" className="mt-3 rounded-[14px] bg-white px-3 py-2 font-body text-[12px] font-black text-[#047857]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p data-testid="whatsapp-draft-error" className="mt-3 rounded-[14px] bg-[#FEF2F2] px-3 py-2 font-body text-[12px] font-black text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProviderReplyPanel({
  item,
  mode,
  form,
  waitingSinceLabel,
  notice,
  error,
  isSaving,
  isUpdating,
  isSpanish,
  onMode,
  onFormChange,
  onNoAnswer,
  onSaveConfirmed,
  onUnavailable,
  onNeedMoreInfo,
  onResolve,
  onReviewDraft,
  onMarkComplete,
}: {
  item: ConciergePendingItem;
  mode: ProviderReplyMode;
  form: ProviderReplyForm;
  waitingSinceLabel: string;
  notice: string | null;
  error: string | null;
  isSaving: boolean;
  isUpdating: boolean;
  isSpanish: boolean;
  onMode: (mode: ProviderReplyMode) => void;
  onFormChange: (field: keyof ProviderReplyForm, value: string) => void;
  onNoAnswer: () => void;
  onSaveConfirmed: () => void;
  onUnavailable: () => void;
  onNeedMoreInfo: () => void;
  onResolve: (
    resolution: ConciergeProviderReplyResolution,
    action: ConciergeProviderReplyPrimaryAction,
    answers: Record<string, string>,
  ) => void;
  onReviewDraft: (resolution: ConciergeProviderReplyResolution) => void;
  onMarkComplete: () => void;
}) {
  const [resolutionAnswers, setResolutionAnswers] = useState<Record<string, string>>({});
  const [reviewingDraft, setReviewingDraft] = useState(false);
  useEffect(() => {
    setResolutionAnswers({});
    setReviewingDraft(false);
  }, [item.id]);
  const needsScheduledTime = isMedicalAppointmentPendingAction(item) || isHomeServicePendingAction(item);
  const scheduledTimeLabel = isHomeServicePendingAction(item)
    ? (isSpanish ? "visita" : "visit")
    : (isSpanish ? "cita" : "appointment");
  const hasProviderReply = Boolean(form.providerReply.trim());
  const canSave = (needsScheduledTime
    ? providerReplyHasValidScheduledTime(form) && hasProviderReply
    : providerReplyFormHasDetails(form)) && !isSaving && !isUpdating;
  const providerUpdate = conciergeProviderReplySnapshot(item.action_payload);
  if (providerUpdate?.status === "reply_received" || providerUpdate?.status === "action_needed") {
    const resolution = providerUpdate.resolution;
    const primaryAction = resolution?.primaryAction
      ?? (providerUpdate.status === "action_needed" ? "answer_provider" : "mark_complete");
    const missingRequests = resolution?.requestedInformation.filter((request) => request.missing) ?? [];
    const answersComplete = missingRequests.every((request) => Boolean(resolutionAnswers[request.key]?.trim()));
    const draftReady = Boolean(resolution?.decision?.status === "draft_ready" && resolution.draftFollowUp);
    const recipient = resolution?.channel === "whatsapp"
      ? payloadString(item.action_payload, ["recipient_whatsapp", "provider_whatsapp", "provider_inbound_sender"])
      : payloadString(item.action_payload, ["recipient_email", "provider_email", "provider_inbound_sender"]);
    const executionTask = isRecord(item.action_payload?.execution_task)
      ? item.action_payload.execution_task
      : {};
    const executionAdapter = isRecord(item.action_payload?.execution_adapter)
      ? item.action_payload.execution_adapter
      : {};
    const followUpSent = draftReady && (
      item.action_payload?.provider_follow_up_confirmed === true
      || executionAdapter.status === "sent"
      || item.action_payload?.email_outcome === "sent"
      || executionTask.user_confirmed === true
    );
    const facts = resolution ? [
      resolution.availability !== "unknown" ? {
        label: isSpanish ? "Disponibilidad" : "Availability",
        value: resolution.availability === "available"
          ? (isSpanish ? "Disponible" : "Available")
          : resolution.availability === "limited"
            ? (isSpanish ? "Limitada" : "Limited")
            : (isSpanish ? "No disponible" : "Unavailable"),
      } : null,
      resolution.dateTime ? { label: isSpanish ? "Fecha y hora" : "Date and time", value: resolution.dateTime } : null,
      resolution.price ? { label: isSpanish ? "Precio" : "Price", value: resolution.price } : null,
      resolution.referenceNumber ? { label: isSpanish ? "Referencia" : "Reference", value: resolution.referenceNumber } : null,
    ].filter((fact): fact is { label: string; value: string } => Boolean(fact)) : [];
    return (
      <div className="mt-3 border-y border-vyva-border py-4" data-testid="panel-concierge-provider-reply">
        <p className="font-body text-[11px] font-black uppercase text-[#047857]">
          {providerUpdate.status === "action_needed"
            ? (isSpanish ? "Necesita tu respuesta" : "Needs your answer")
            : (isSpanish ? "Respuesta recibida" : "Reply received")}
        </p>
        <p className="mt-2 font-body text-[15px] font-black text-vyva-text-1">
          {resolution?.summary || providerUpdate.summary || providerUpdate.reply}
        </p>
        {facts.length > 0 ? (
          <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2" data-testid="list-provider-reply-facts">
            {facts.map((fact) => (
              <div key={fact.label} className="border-t border-vyva-border pt-2">
                <dt className="font-body text-[11px] font-black uppercase text-vyva-text-3">{fact.label}</dt>
                <dd className="mt-0.5 font-body text-[13px] font-bold text-vyva-text-1">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {primaryAction === "answer_provider" && missingRequests.length > 0 && !draftReady ? (
          <div className="mt-3 grid gap-3" data-testid="panel-provider-reply-missing-information">
            {missingRequests.map((request) => (
              <label key={request.key} className="grid gap-1 font-body text-[12px] font-black text-vyva-text-2">
                {request.label}
                <Input
                  value={resolutionAnswers[request.key] ?? ""}
                  onChange={(event) => setResolutionAnswers((current) => ({
                    ...current,
                    [request.key]: event.target.value,
                  }))}
                  data-testid={`input-provider-reply-resolution-${request.key}`}
                  className="h-[44px] rounded-[12px] border-vyva-border bg-white font-body text-[14px]"
                />
              </label>
            ))}
          </div>
        ) : null}
        {draftReady && resolution?.draftFollowUp ? (
          <div className="mt-3 border-t border-vyva-border pt-3" data-testid="panel-provider-reply-draft">
            <p className="font-body text-[11px] font-black uppercase text-vyva-text-3">
              {isSpanish ? "Respuesta preparada" : "Reply ready"}
            </p>
            <p className="mt-2 font-body text-[12px] font-black text-vyva-text-2" data-testid="provider-reply-draft-recipient">
              {isSpanish ? "Para" : "To"}: {recipient || (isSpanish ? "Falta el contacto" : "Contact missing")}
            </p>
            {resolution.channel === "email" ? (
              <p className="mt-1 font-body text-[12px] font-bold text-vyva-text-2">
                {isSpanish ? "Asunto" : "Subject"}: {resolution.draftFollowUp.subject}
              </p>
            ) : null}
            <p className="mt-1 whitespace-pre-wrap font-body text-[13px] font-semibold leading-relaxed text-vyva-text-1">
              {resolution.draftFollowUp.body}
            </p>
          </div>
        ) : null}
        {providerUpdate.reply && providerUpdate.reply !== (resolution?.summary || providerUpdate.summary) ? (
          <details className="mt-3 border-t border-vyva-border pt-2">
            <summary className="vyva-tap cursor-pointer font-body text-[12px] font-black text-vyva-text-2">
              {isSpanish ? "Ver respuesta original" : "View original reply"}
            </summary>
            <p className="mt-2 whitespace-pre-wrap font-body text-[13px] font-semibold text-vyva-text-2">
              {providerUpdate.reply}
            </p>
          </details>
        ) : null}
        {followUpSent ? (
          <p
            className="mt-3 border-t border-vyva-border pt-3 font-body text-[13px] font-black text-[#047857]"
            data-testid="status-provider-reply-sent"
          >
            {isSpanish ? "Respuesta enviada. Esperando al proveedor." : "Reply sent. Waiting for the provider."}
          </p>
        ) : (
          <>
            {draftReady && resolution ? (
              reviewingDraft ? (
                <div className="mt-3 border-t border-vyva-border pt-3" data-testid="panel-provider-reply-final-confirmation">
                  <p className="font-body text-[14px] font-black text-vyva-text-1">
                    {isSpanish ? "Enviar este mensaje?" : "Send this message?"}
                  </p>
                  <p className="mt-1 font-body text-[12px] font-semibold text-vyva-text-2">
                    {isSpanish ? "Nada se enviara hasta que confirmes aqui." : "Nothing is sent until you confirm here."}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setReviewingDraft(false)}
                      disabled={isSaving || isUpdating}
                      className="vyva-secondary-action h-auto"
                    >
                      {isSpanish ? "Volver" : "Back"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => onReviewDraft(resolution)}
                      disabled={isSaving || isUpdating || !recipient}
                      className="vyva-primary-action h-auto"
                      data-testid={`button-provider-reply-send-${item.id}`}
                    >
                      {resolution.channel === "whatsapp"
                        ? (isSpanish ? "Enviar WhatsApp" : "Send WhatsApp")
                        : (isSpanish ? "Enviar email" : "Send email")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => setReviewingDraft(true)}
                  disabled={isSaving || isUpdating || !recipient}
                  className="vyva-primary-action mt-3 h-auto w-full"
                  data-testid={`button-provider-reply-review-${item.id}`}
                >
                  {isSpanish ? "Revisar y enviar" : "Review and send"}
                </Button>
              )
            ) : primaryAction === "answer_provider" && resolution ? (
              <Button
                type="button"
                onClick={() => onResolve(resolution, "answer_provider", resolutionAnswers)}
                disabled={isSaving || isUpdating || !answersComplete}
                className="vyva-primary-action mt-3 h-auto w-full"
                data-testid={`button-provider-reply-answer-${item.id}`}
              >
                {isSpanish ? "Preparar respuesta" : "Prepare reply"}
              </Button>
            ) : primaryAction === "mark_complete" ? (
              <Button
                type="button"
                onClick={onMarkComplete}
                disabled={isSaving || isUpdating}
                className="vyva-primary-action mt-3 h-auto w-full"
                data-testid={`button-provider-reply-mark-complete-${item.id}`}
              >
                {isSpanish ? "Marcar como hecho" : "Mark complete"}
              </Button>
            ) : resolution ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-3" data-testid="provider-reply-decision-options">
                {primaryAction !== "request_alternatives" ? (
                  <Button
                    type="button"
                    onClick={() => onResolve(resolution, "confirm", {})}
                    disabled={isSaving || isUpdating}
                    className="vyva-primary-action h-auto"
                    data-testid={`button-provider-reply-confirm-${item.id}`}
                  >
                    {isSpanish ? "Aceptar" : "Accept"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant={primaryAction === "request_alternatives" ? "default" : "outline"}
                  onClick={() => onResolve(resolution, "request_alternatives", {})}
                  disabled={isSaving || isUpdating}
                  className={primaryAction === "request_alternatives" ? "vyva-primary-action h-auto" : "vyva-secondary-action h-auto"}
                  data-testid={`button-provider-reply-alternatives-${item.id}`}
                >
                  {isSpanish ? "Pedir otra opcion" : "Ask for another option"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onResolve(resolution, "decline", {})}
                  disabled={isSaving || isUpdating}
                  className="vyva-secondary-action h-auto"
                  data-testid={`button-provider-reply-decline-${item.id}`}
                >
                  {isSpanish ? "Rechazar" : "Decline"}
                </Button>
                {primaryAction === "request_alternatives" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onMarkComplete}
                    disabled={isSaving || isUpdating}
                    className="vyva-secondary-action h-auto"
                    data-testid={`button-provider-reply-mark-complete-${item.id}`}
                  >
                    {isSpanish ? "Cerrar tarea" : "Close task"}
                  </Button>
                ) : null}
              </div>
            ) : (
              <Button type="button" onClick={onNeedMoreInfo} className="vyva-primary-action mt-3 h-auto w-full">
                {isSpanish ? "Responder" : "Respond"}
              </Button>
            )}
            {!draftReady ? (
              <p className="mt-2 font-body text-[12px] font-semibold text-vyva-text-2">
                {primaryAction === "mark_complete"
                  ? (isSpanish ? "La respuesta quedara en el historial." : "The reply will stay in completion history.")
                  : (isSpanish ? "Primero prepararemos el mensaje. Nada se enviara todavia." : "We will prepare the message first. Nothing is sent yet.")}
              </p>
            ) : null}
          </>
        )}
        {notice ? <p data-testid="provider-reply-notice" className="mt-2 font-body text-[12px] font-black text-[#047857]">{notice}</p> : null}
        {error ? <p data-testid="provider-reply-error" className="mt-2 font-body text-[12px] font-black text-[#B91C1C]">{error}</p> : null}
      </div>
    );
  }
  return (
    <div
      className="mt-3 rounded-[22px] border border-[#BFDBFE] bg-[#F8FBFF] p-4"
      data-testid="panel-concierge-provider-reply"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#2563EB] shadow-sm">
          <MessageCircle size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#2563EB]">
            {isSpanish ? "Respuesta del proveedor" : "Provider reply"}
          </span>
          <span className="mt-1 block font-body text-[16px] font-black leading-tight text-vyva-text-1">
            {isSpanish ? "Que dijeron?" : "What did they say?"}
          </span>
          <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {isSpanish
              ? "Guarda la respuesta o cambia el plan si no pueden hacerlo."
              : "Save the reply, or change the plan if they cannot do it."}
          </span>
          <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1 font-body text-[11px] font-black text-[#1D4ED8] shadow-sm">
            {waitingSinceLabel}
          </span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          type="button"
          data-testid={`button-provider-reply-confirmed-${item.id}`}
          onClick={() => onMode("confirmed")}
          variant={mode === "confirmed" ? "default" : "outline"}
          className={mode === "confirmed" ? "vyva-primary-action h-auto" : "vyva-secondary-action h-auto border-[#BFDBFE] text-[#1D4ED8]"}
        >
          {isSpanish ? "Tengo respuesta" : "I got a reply"}
        </Button>
        <Button
          type="button"
          data-testid={`button-provider-reply-no-answer-${item.id}`}
          onClick={onNoAnswer}
          disabled={isSaving || isUpdating}
          variant="outline"
          className="vyva-secondary-action h-auto border-[#BFDBFE] text-[#1D4ED8]"
        >
          {isUpdating ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
          {isSpanish ? "Sin respuesta" : "No answer"}
        </Button>
        <details className="col-span-2 border-t border-[#DBEAFE] pt-2">
          <summary className="vyva-tap cursor-pointer font-body text-[13px] font-black text-vyva-text-2">
            {isSpanish ? "Mas opciones" : "More options"}
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              data-testid={`button-provider-reply-unavailable-${item.id}`}
              onClick={onUnavailable}
              variant="outline"
              className="vyva-secondary-action h-auto border-[#FED7AA] text-[#9A3412]"
            >
              {isSpanish ? "Probar otro" : "Try another provider"}
            </Button>
            <Button
              type="button"
              data-testid={`button-provider-reply-more-info-${item.id}`}
              onClick={() => onMode("more_info")}
              variant={mode === "more_info" ? "default" : "outline"}
              className={mode === "more_info" ? "vyva-primary-action h-auto" : "vyva-secondary-action h-auto border-[#BFDBFE] text-[#1D4ED8]"}
            >
              {isSpanish ? "Piden datos" : "Provider needs info"}
            </Button>
            <Button
              type="button"
              data-testid={`button-provider-reply-mark-complete-${item.id}`}
              onClick={onMarkComplete}
              disabled={isSaving || isUpdating}
              variant="outline"
              className="vyva-secondary-action h-auto border-[#BBF7D0] text-[#047857]"
            >
              {isSpanish ? "Marcar completado" : "Mark complete"}
            </Button>
          </div>
        </details>
      </div>

      {mode === "confirmed" ? (
        <div className="mt-3 rounded-[18px] border border-[#BFDBFE] bg-white p-3" data-testid={`panel-provider-reply-confirmed-${item.id}`}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type={needsScheduledTime ? "datetime-local" : "text"}
              value={form.scheduledFor}
              onChange={(event) => onFormChange("scheduledFor", event.target.value)}
              placeholder={isSpanish ? "Hora o fecha confirmada" : "Confirmed time or date"}
              data-testid={`input-provider-reply-time-${item.id}`}
              className="h-[44px] rounded-[14px] border-[#DBEAFE] bg-white font-body text-[14px]"
            />
            <Input
              value={form.reference}
              onChange={(event) => onFormChange("reference", event.target.value)}
              placeholder={isSpanish ? "Referencia opcional" : "Reference optional"}
              data-testid={`input-provider-reply-reference-${item.id}`}
              className="h-[44px] rounded-[14px] border-[#DBEAFE] bg-white font-body text-[14px]"
            />
            <Input
              value={form.location}
              onChange={(event) => onFormChange("location", event.target.value)}
              placeholder={isSpanish ? "Lugar opcional" : "Place optional"}
              data-testid={`input-provider-reply-location-${item.id}`}
              className="h-[44px] rounded-[14px] border-[#DBEAFE] bg-white font-body text-[14px] sm:col-span-2"
            />
            <Input
              value={form.price}
              onChange={(event) => onFormChange("price", event.target.value)}
              placeholder={isSpanish ? "Precio confirmado opcional" : "Confirmed price optional"}
              data-testid={`input-provider-reply-price-${item.id}`}
              className="h-[44px] rounded-[14px] border-[#DBEAFE] bg-white font-body text-[14px]"
            />
            <Input
              value={form.followUp}
              onChange={(event) => onFormChange("followUp", event.target.value)}
              placeholder={isSpanish ? "Seguimiento opcional" : "Follow-up optional"}
              data-testid={`input-provider-reply-follow-up-${item.id}`}
              className="h-[44px] rounded-[14px] border-[#DBEAFE] bg-white font-body text-[14px]"
            />
            <textarea
              value={form.providerReply}
              onChange={(event) => onFormChange("providerReply", event.target.value)}
              placeholder={isSpanish ? "Respuesta breve del proveedor" : "Short provider reply"}
              data-testid={`input-provider-reply-text-${item.id}`}
              className="min-h-[74px] rounded-[14px] border border-[#DBEAFE] bg-white px-3 py-2 font-body text-[14px] font-semibold text-vyva-text-1 outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#DBEAFE] sm:col-span-2"
            />
            <textarea
              value={form.notes}
              onChange={(event) => onFormChange("notes", event.target.value)}
              placeholder={isSpanish ? "Nota para VYVA opcional" : "Optional note for VYVA"}
              data-testid={`input-provider-reply-notes-${item.id}`}
              className="min-h-[62px] rounded-[14px] border border-[#DBEAFE] bg-white px-3 py-2 font-body text-[14px] font-semibold text-vyva-text-1 outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#DBEAFE] sm:col-span-2"
            />
          </div>
          <Button
            type="button"
            data-testid={`button-provider-reply-save-${item.id}`}
            onClick={onSaveConfirmed}
            disabled={!canSave}
            className="vyva-primary-action mt-3 h-auto w-full"
          >
            {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CircleCheck size={16} className="mr-2" />}
            {isSpanish ? "Guardar como hecho" : "Save as done"}
          </Button>
          {needsScheduledTime ? (
            <p className="mt-2 font-body text-[12px] font-bold text-vyva-text-2">
              {isSpanish
                ? `Se necesita fecha y hora para guardar la ${scheduledTimeLabel} en Scheduled Support.`
                : `A date and time are needed to save the ${scheduledTimeLabel} in Scheduled Support.`}
            </p>
          ) : null}
          {needsScheduledTime ? (
            <p className="mt-1 font-body text-[12px] font-bold text-vyva-text-2">
              {isSpanish
                ? "Anade la respuesta del proveedor antes de guardar."
                : "Add the provider reply before saving."}
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "more_info" ? (
        <div className="mt-3 rounded-[18px] border border-[#DDD6FE] bg-white p-3" data-testid={`panel-provider-reply-more-info-${item.id}`}>
          <textarea
            value={form.followUpQuestion}
            onChange={(event) => onFormChange("followUpQuestion", event.target.value)}
            placeholder={isSpanish ? "Pregunta breve" : "Short question"}
            data-testid={`input-provider-reply-question-${item.id}`}
            className="min-h-[76px] w-full rounded-[14px] border border-[#DDD6FE] bg-white px-3 py-2 font-body text-[14px] font-semibold text-vyva-text-1 outline-none focus:border-vyva-purple focus:ring-2 focus:ring-[#EDE9FE]"
          />
          <Button
            type="button"
            data-testid={`button-provider-reply-ask-${item.id}`}
            onClick={onNeedMoreInfo}
            disabled={!form.followUpQuestion.trim()}
            className="vyva-primary-action mt-3 h-auto w-full"
          >
            <MessageCircle size={16} className="mr-2" />
            {isSpanish ? "Preguntar a VYVA" : "Ask VYVA"}
          </Button>
        </div>
      ) : null}

      {notice ? (
        <p data-testid="provider-reply-notice" className="mt-3 rounded-[14px] bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p data-testid="provider-reply-error" className="mt-3 rounded-[14px] bg-[#FEF2F2] px-3 py-2 font-body text-[12px] font-black text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProviderSearchFollowThroughPanel({
  item,
  details,
  isSpanish,
  onReply,
  onSaveProvider,
  onTryAnother,
}: {
  item: ConciergePendingItem;
  details: ReturnType<typeof providerSearchActionDetails>;
  isSpanish: boolean;
  onReply: () => void;
  onSaveProvider: () => void;
  onTryAnother: () => void;
}) {
  const chips = [
    details.categoryLabel,
    details.criteria,
    details.contact ? (isSpanish ? "Contacto disponible" : "Contact ready") : "",
  ].filter(Boolean);
  return (
    <div
      className="mt-3 rounded-[22px] border border-[#99F6E4] bg-[#F0FDFA] p-4"
      data-testid="panel-provider-search-follow-through"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#0F766E] shadow-sm">
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
            {isSpanish ? "Proveedor encontrado" : "Provider shortlisted"}
          </span>
          <span className="mt-1 block font-body text-[16px] font-black leading-tight text-vyva-text-1">
            {details.providerName}
          </span>
          <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {isSpanish
              ? "Guarda, registra la respuesta o busca otra opcion. Nada se contacta sin tu OK."
              : "Save it, record the reply, or find another option. Nothing is contacted without your OK."}
          </span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-white px-3 py-1 font-body text-[11px] font-black text-[#0F766E] shadow-sm"
          >
            {chip}
          </span>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          data-testid={`button-provider-search-reply-${item.id}`}
          onClick={onReply}
          variant="outline"
          className="vyva-secondary-action h-auto border-[#99F6E4] text-[#0F766E]"
        >
          <MessageCircle size={15} className="mr-2" />
          {isSpanish ? "Tengo respuesta" : "I got a reply"}
        </Button>
        <Button
          type="button"
          data-testid={`button-provider-search-save-provider-${item.id}`}
          onClick={onSaveProvider}
          className="vyva-primary-action h-auto bg-[#0F766E] hover:bg-[#115E59]"
        >
          <CircleCheck size={15} className="mr-2" />
          {isSpanish ? "Guardar proveedor" : "Save provider"}
        </Button>
        <Button
          type="button"
          data-testid={`button-provider-search-try-another-${item.id}`}
          onClick={onTryAnother}
          variant="outline"
          className="vyva-secondary-action h-auto border-[#FED7AA] text-[#9A3412]"
        >
          <Search size={15} className="mr-2" />
          {isSpanish ? "Buscar otro" : "Find another"}
        </Button>
      </div>
    </div>
  );
}

function SafeWebSearchExecutionPanel({
  item,
  search,
  error,
  isRunning,
  isSaving,
  isSpanish,
  onRun,
  onSave,
}: {
  item: ConciergePendingItem;
  search: WebSearchActionResult | null;
  error: string | null;
  isRunning: boolean;
  isSaving: boolean;
  isSpanish: boolean;
  onRun: () => void;
  onSave: () => void;
}) {
  const topOptions = search?.result.options.slice(0, 2) ?? [];
  return (
    <div
      className="mt-3 rounded-[22px] border border-[#99F6E4] bg-[#F0FDFA] p-4"
      data-testid={`panel-safe-web-search-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#0F766E] shadow-sm">
          <Search size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
            {isSpanish ? "Busqueda segura" : "Safe search"}
          </span>
          <span className="mt-1 block font-body text-[16px] font-black leading-tight text-vyva-text-1">
            {isSpanish ? "Revisar senales publicas" : "Check public signals"}
          </span>
          <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {isSpanish
              ? "VYVA busca senales neutrales. No contacta, envia ni abre nada por ti."
              : "VYVA checks neutral signals. Nothing is contacted, sent, or opened for you."}
          </span>
        </span>
      </div>

      {search ? (
        <div className="mt-3 space-y-2" data-testid={`safe-web-search-result-${item.id}`}>
          <div className="rounded-[16px] bg-white p-3 shadow-sm">
            <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
              {isSpanish ? "Resultado" : "Result"}
            </p>
            <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-1">
              {search.result.decision_explanation || search.result.no_results_message || search.result.next_step}
            </p>
          </div>
          {topOptions.map((option) => (
            <div key={offerCardKey(option)} className="rounded-[16px] bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-body text-[13px] font-black text-vyva-text-1">
                    {option.name}
                  </span>
                  <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
                    {option.trust_note || option.why_good_option}
                  </span>
                </span>
                <span className="rounded-full bg-[#ECFDF5] px-2 py-1 font-body text-[11px] font-black text-[#047857]">
                  {clampScore(option.score)}
                </span>
              </div>
            </div>
          ))}
          <p className="rounded-[14px] bg-white px-3 py-2 font-body text-[12px] font-bold leading-snug text-vyva-text-2 shadow-sm">
            {search.result.next_step}
          </p>
        </div>
      ) : null}

      {error ? (
        <p data-testid={`safe-web-search-error-${item.id}`} className="mt-3 rounded-[14px] bg-[#FEF2F2] px-3 py-2 font-body text-[12px] font-black text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          data-testid={`button-safe-web-search-run-${item.id}`}
          onClick={onRun}
          disabled={isRunning || isSaving}
          className="vyva-primary-action h-auto bg-[#0F766E] hover:bg-[#115E59]"
        >
          {isRunning ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Search size={15} className="mr-2" />}
          {search
            ? (isSpanish ? "Buscar de nuevo" : "Search again")
            : (isSpanish ? "Ejecutar busqueda" : "Run safe search")}
        </Button>
        <Button
          type="button"
          data-testid={`button-safe-web-search-save-${item.id}`}
          onClick={onSave}
          disabled={!search || isRunning || isSaving}
          variant="outline"
          className="vyva-secondary-action h-auto border-[#99F6E4] text-[#0F766E]"
        >
          {isSaving ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CircleCheck size={15} className="mr-2" />}
          {isSpanish ? "Guardar y cerrar" : "Save and close"}
        </Button>
      </div>
    </div>
  );
}

function ManualReviewOutcomePanel({
  item,
  form,
  notice,
  error,
  isSaving,
  isSpanish,
  onFormChange,
  onSave,
}: {
  item: ConciergePendingItem;
  form: ManualReviewOutcomeForm;
  notice: string | null;
  error: string | null;
  isSaving: boolean;
  isSpanish: boolean;
  onFormChange: (field: keyof ManualReviewOutcomeForm, value: string) => void;
  onSave: () => void;
}) {
  const canSave = Boolean(form.summary.trim()) && !isSaving;
  const statusOptions: ManualReviewOutcomeStatus[] = ["completed", "review_pending"];
  return (
    <div
      className="mt-3 rounded-[22px] border border-[#DDD6FE] bg-[#FBFAFF] p-4"
      data-testid={`panel-manual-review-outcome-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-vyva-purple shadow-sm">
          <FileText size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-vyva-purple">
            {isSpanish ? "Resultado de revision" : "Review outcome"}
          </span>
          <span className="mt-1 block font-body text-[16px] font-black leading-tight text-vyva-text-1">
            {manualReviewSubject(item, isSpanish)}
          </span>
          <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {isSpanish
              ? "Guarda si la revision queda resuelta o si necesita seguimiento."
              : "Save whether the review is resolved or still needs follow-up."}
          </span>
        </span>
      </div>

      <ConciergeApprovalPromise isSpanish={isSpanish} tone="purple" />

      <div className="mt-3 grid grid-cols-2 gap-2">
        {statusOptions.map((status) => {
          const selected = form.status === status;
          return (
            <Button
              key={status}
              type="button"
              data-testid={`button-manual-review-status-${status}-${item.id}`}
              onClick={() => onFormChange("status", status)}
              variant={selected ? "default" : "outline"}
              className={selected ? "vyva-primary-action h-auto" : "vyva-secondary-action h-auto border-[#DDD6FE] text-vyva-purple"}
            >
              {manualReviewStatusLabel(status, isSpanish)}
            </Button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <textarea
          value={form.summary}
          onChange={(event) => onFormChange("summary", event.target.value)}
          placeholder={isSpanish ? "Resumen de lo revisado" : "Summary of what was reviewed"}
          data-testid={`input-manual-review-summary-${item.id}`}
          className="min-h-[76px] rounded-[14px] border border-[#DDD6FE] bg-white px-3 py-2 font-body text-[14px] font-semibold text-vyva-text-1 outline-none focus:border-vyva-purple focus:ring-2 focus:ring-[#EDE9FE] sm:col-span-2"
        />
        <Input
          value={form.reference}
          onChange={(event) => onFormChange("reference", event.target.value)}
          placeholder={isSpanish ? "Referencia opcional" : "Reference optional"}
          data-testid={`input-manual-review-reference-${item.id}`}
          className="h-[44px] rounded-[14px] border-[#DDD6FE] bg-white font-body text-[14px]"
        />
        <Input
          value={form.nextStep}
          onChange={(event) => onFormChange("nextStep", event.target.value)}
          placeholder={isSpanish ? "Siguiente paso opcional" : "Next step optional"}
          data-testid={`input-manual-review-next-step-${item.id}`}
          className="h-[44px] rounded-[14px] border-[#DDD6FE] bg-white font-body text-[14px]"
        />
        <textarea
          value={form.notes}
          onChange={(event) => onFormChange("notes", event.target.value)}
          placeholder={isSpanish ? "Notas opcionales" : "Optional notes"}
          data-testid={`input-manual-review-notes-${item.id}`}
          className="min-h-[64px] rounded-[14px] border border-[#DDD6FE] bg-white px-3 py-2 font-body text-[14px] font-semibold text-vyva-text-1 outline-none focus:border-vyva-purple focus:ring-2 focus:ring-[#EDE9FE] sm:col-span-2"
        />
      </div>

      <Button
        type="button"
        data-testid={`button-manual-review-save-${item.id}`}
        onClick={onSave}
        disabled={!canSave}
        className="vyva-primary-action mt-3 h-auto w-full"
      >
        {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CircleCheck size={16} className="mr-2" />}
        {isSpanish ? "Guardar resultado" : "Save outcome"}
      </Button>

      {notice ? (
        <p data-testid="manual-review-notice" className="mt-3 rounded-[14px] bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p data-testid="manual-review-error" className="mt-3 rounded-[14px] bg-[#FEF2F2] px-3 py-2 font-body text-[12px] font-black text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DryRunOutcomePanel({
  item,
  canSave,
  isSaving,
  notice,
  error,
  isSpanish,
  onSave,
}: {
  item: ConciergePendingItem;
  canSave: boolean;
  isSaving: boolean;
  notice: string | null;
  error: string | null;
  isSpanish: boolean;
  onSave: () => void;
}) {
  return (
    <div
      className="mt-3 rounded-[22px] border border-emerald-200 bg-emerald-50 p-4"
      data-testid={`panel-concierge-dry-run-outcome-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-emerald-700 shadow-sm">
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-emerald-800">
            {isSpanish ? "Modo prueba" : "Test mode"}
          </span>
          <span className="mt-1 block font-body text-[16px] font-black leading-tight text-emerald-950">
            {isSpanish ? "Guardar resultado simulado" : "Save simulated outcome"}
          </span>
          <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-emerald-900">
            {isSpanish
              ? "No se llamara, enviara, subira ni abrira nada real. Esto solo guarda el ensayo en el historial completado."
              : "No real call, email, upload, form, or provider contact will happen. This only saves the rehearsal to completed history."}
          </span>
        </span>
      </div>

      {!canSave ? (
        <p
          className="mt-3 rounded-[14px] bg-white px-3 py-2 font-body text-[12px] font-black text-emerald-900"
          data-testid={`text-concierge-dry-run-confirm-first-${item.id}`}
        >
          {isSpanish
            ? "Confirma el paso preparado antes de guardar el resultado simulado."
            : "Confirm the prepared step before saving the simulated result."}
        </p>
      ) : null}

      <Button
        type="button"
        data-testid={`button-concierge-dry-run-complete-${item.id}`}
        onClick={onSave}
        disabled={!canSave || isSaving}
        className="vyva-primary-action mt-3 h-auto w-full bg-emerald-700 hover:bg-emerald-800"
      >
        {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CircleCheck size={16} className="mr-2" />}
        {isSpanish ? "Guardar simulacion" : "Save simulation"}
      </Button>

      {notice ? (
        <p data-testid="dry-run-outcome-notice" className="mt-3 rounded-[14px] bg-white px-3 py-2 font-body text-[12px] font-black text-emerald-800">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p data-testid="dry-run-outcome-error" className="mt-3 rounded-[14px] bg-[#FEF2F2] px-3 py-2 font-body text-[12px] font-black text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type MissingProviderChoicePanelProps = {
  title: string;
  body: string;
  addLabel: string;
  findLabel: string;
  helperLabel: string;
  addDetail?: string;
  findDetail?: string;
  helperDetail?: string;
  onAddProvider: () => void;
  onFindOptions: () => void;
  onAskHelper: () => void;
  isFinding?: boolean;
  findDisabled?: boolean;
  testId: string;
  addTestId?: string;
  findTestId?: string;
  helperTestId?: string;
  isSpanish: boolean;
};

function MissingProviderChoicePanel({
  title,
  body,
  addLabel,
  findLabel,
  helperLabel,
  addDetail,
  findDetail,
  helperDetail,
  onAddProvider,
  onFindOptions,
  onAskHelper,
  isFinding = false,
  findDisabled = false,
  testId,
  addTestId,
  findTestId,
  helperTestId,
  isSpanish,
}: MissingProviderChoicePanelProps) {
  const choices: Array<{
    key: string;
    label: string;
    detail?: string;
    Icon: LucideIcon;
    onClick: () => void;
    testId: string;
    disabled?: boolean;
    busy?: boolean;
  }> = [
    {
      key: "add",
      label: addLabel,
      detail: addDetail,
      Icon: ShieldCheck,
      onClick: onAddProvider,
      testId: addTestId ?? `${testId}-add-provider`,
    },
    {
      key: "find",
      label: findLabel,
      detail: findDetail,
      Icon: Search,
      onClick: onFindOptions,
      testId: findTestId ?? `${testId}-find-options`,
      disabled: findDisabled || isFinding,
      busy: isFinding,
    },
    {
      key: "helper",
      label: helperLabel,
      detail: helperDetail,
      Icon: HeartHandshake,
      onClick: onAskHelper,
      testId: helperTestId ?? `${testId}-ask-helper`,
    },
  ];

  return (
    <div className="rounded-[22px] border border-[#FCD34D] bg-[#FFFBEB] p-4" data-testid={testId}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#B45309]">
          <ShieldCheck size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[16px] font-black leading-tight text-vyva-text-1">
            {title}
          </p>
          <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
            {body}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {choices.map(({ key, label, detail, Icon, onClick, testId: buttonTestId, disabled, busy }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            disabled={disabled}
            data-testid={buttonTestId}
            className="vyva-tap flex min-h-[76px] items-start gap-3 rounded-[18px] border border-[#FCD34D] bg-white px-3 py-3 text-left font-body shadow-sm disabled:opacity-60"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#FFF7ED] text-[#B45309]">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Icon size={17} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-black leading-tight text-vyva-text-1">{label}</span>
              {detail ? (
                <span className="sr-only">{detail}</span>
              ) : null}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-3 rounded-full bg-white px-3 py-2 text-center font-body text-[12px] font-black text-[#92400E]">
        {isSpanish
          ? "Nada se llama, reserva, envia ni comparte hasta que confirmes."
          : "Nothing is called, booked, sent, or shared until you confirm."}
      </p>
    </div>
  );
}

function PendingExternalConfirmationModal({
  request,
  review,
  locale,
  isSpanish,
  isPending,
  onCancel,
  onConfirm,
}: {
  request: ConciergeExternalConfirmationRequest;
  review: PendingActionReviewSummary;
  locale: string;
  isSpanish: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const preparedByShowVyva = isShowVyvaPreparedTask(request.item.action_payload);
  const sourceLabel = preparedByShowVyva ? showVyvaResumeSourceLabel(request.item.action_payload, locale) : "";
  const actionLabel = preparedByShowVyva ? showVyvaResumeActionLabel(request.item.action_payload, locale) : request.label;
  const summary = preparedByShowVyva
    ? showVyvaResumeSummary(request.item.action_payload, request.item.action_summary)
    : request.item.action_summary;

  return (
    <PurpleModal
      Icon={ShieldCheck}
      kicker={preparedByShowVyva ? (isSpanish ? "VYVA lo preparo" : "VYVA prepared this") : review.eyebrow}
      title={isSpanish ? "Revisar primero" : "Review first"}
      subtitle={isSpanish
        ? "Confirma solo si quieres continuar. Nada sale sin este paso."
        : "Confirm only if you want to continue. Nothing leaves without this step."}
      titleId="concierge-final-confirmation-title"
      onClose={onCancel}
      closeLabel={isSpanish ? "Cerrar" : "Close"}
      modalTestId="modal-concierge-final-confirmation"
      panelTestId="panel-concierge-final-confirmation"
      size="narrow"
      layer="top"
    >
      <div className="rounded-[22px] border border-[#CCFBF1] bg-[#F8FFFC] p-4">
        <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
          {preparedByShowVyva && sourceLabel ? sourceLabel : (isSpanish ? "Siguiente paso" : "Next step")}
        </p>
        <p className="mt-1 font-body text-[18px] font-black leading-tight text-vyva-text-1">
          {actionLabel}
        </p>
        {summary ? (
          <p className="mt-2 font-body text-[13px] font-bold leading-relaxed text-vyva-text-2">
            {summary}
          </p>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2">
        {review.details.slice(0, 4).map((detail) => (
          <div
            key={`${detail.label}-${detail.value}`}
            className="flex items-start justify-between gap-3 rounded-[16px] border border-vyva-border bg-white px-3 py-2"
          >
            <span className="font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
              {detail.label}
            </span>
            <span className="text-right font-body text-[13px] font-black leading-snug text-vyva-text-1">
              {detail.value}
            </span>
          </div>
        ))}
      </div>

      <ConciergeApprovalPromise isSpanish={isSpanish} />

      <div className="mt-4 grid grid-cols-1 gap-2">
        <button
          type="button"
          data-testid="button-concierge-final-confirm"
          onClick={onConfirm}
          disabled={isPending}
          className={VYVA_MODAL_PRIMARY_ACTION_CLASS}
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <CircleCheck size={16} />}
          {isSpanish ? "Confirmar y continuar" : "Confirm and continue"}
        </button>
        <button
          type="button"
          data-testid="button-concierge-final-cancel"
          onClick={onCancel}
          disabled={isPending}
          className={VYVA_MODAL_SECONDARY_ACTION_CLASS}
        >
          {isSpanish ? "Cancelar" : "Cancel"}
        </button>
      </div>
    </PurpleModal>
  );
}

function rightNowPassiveActionLabel(params: Pick<RightNowActionLabelsParams, "item" | "isSpanish" | "formMissingFields">): string {
  const { item, isSpanish, formMissingFields } = params;
  const missionStatus = payloadString(item.action_payload, ["mission_status", "status"]).toLowerCase();
  if (formMissingFields.length > 0) return isSpanish ? "Anadir datos que faltan" : "Add missing details";
  if (missionStatus.includes("awaiting_provider")) return isSpanish ? "Esperar respuesta" : "Wait for provider reply";
  if (missionStatus.includes("form")) return isSpanish ? "VYVA prepara el formulario" : "VYVA is preparing the form";
  if (item.use_case === "order_medicine") return isSpanish ? "VYVA prepara el pedido OTC" : "VYVA is preparing the OTC request";
  return isSpanish ? "VYVA lo esta preparando" : "VYVA is preparing this";
}

function rightNowPrimaryActionLabel(params: RightNowActionLabelsParams): string {
  const { item, isSpanish, opensWhatsApp, opensEmail, opensBooking, needsPhoneOutcome, needsWhatsAppOutcome, needsEmailOutcome, canOpenForm, isVyvaTask, formMissingFields } = params;
  if (needsPhoneOutcome) return isSpanish ? "Revisar guion de llamada" : "Review call script";
  if (isVyvaTask) {
    const task = getConciergeExecutionTask(item);
    if (task && !task.user_confirmed && task.missing_requirements.length === 0 && formMissingFields.length === 0) {
      return isSpanish ? "Confirmar revision VYVA" : "Confirm VYVA review";
    }
    return rightNowPassiveActionLabel({ item, isSpanish, formMissingFields });
  }
  if (needsWhatsAppOutcome) return isSpanish ? "Abrir borrador de WhatsApp" : "Open WhatsApp draft";
  if (needsEmailOutcome) return isSpanish ? "Abrir borrador de email" : "Open email draft";

  if (isHomeServicePendingAction(item)) {
    if (opensWhatsApp || opensEmail) return isSpanish ? "Revisar solicitud de servicio" : "Review service request";
    if (opensBooking) return isSpanish ? "Abrir solicitud de servicio" : "Open service request";
    return isSpanish ? "Confirmar llamada de servicio" : "Confirm service call";
  }

  if (item.use_case === "book_ride") {
    if (opensWhatsApp || opensEmail) return isSpanish ? "Confirmar mensaje del viaje" : "Confirm ride message";
    if (opensBooking) return isSpanish ? "Abrir reserva del viaje" : "Open ride booking";
    return isSpanish ? "Confirmar llamada del viaje" : "Confirm ride call";
  }

  if (item.use_case === "book_appointment") {
    if (opensWhatsApp || opensEmail) return isSpanish ? "Confirmar mensaje de cita" : "Confirm appointment message";
    if (opensBooking) return canOpenForm
      ? (isSpanish ? "Abrir formulario de cita" : "Open appointment form")
      : (isSpanish ? "Abrir reserva de cita" : "Open appointment booking");
    return isSpanish ? "Confirmar llamada de cita" : "Confirm appointment call";
  }

  if (item.use_case === "order_medicine") {
    if (opensWhatsApp || opensEmail) return isSpanish ? "Confirmar pedido OTC" : "Confirm OTC request";
    if (opensBooking) return isSpanish ? "Abrir pedido de farmacia" : "Open pharmacy request";
    return isSpanish ? "Confirmar llamada a farmacia" : "Confirm pharmacy call";
  }

  if (opensWhatsApp) return isSpanish ? "Abrir WhatsApp" : "Open WhatsApp draft";
  if (opensEmail) return isSpanish ? "Abrir email" : "Open email draft";
  if (opensBooking) return canOpenForm
    ? (isSpanish ? "Abrir formulario" : "Open form")
    : (isSpanish ? "Abrir reserva" : "Open booking");
  return isSpanish ? "Confirmar y llamar" : "Confirm and call";
}

function rightNowNextStepLabel(params: RightNowActionLabelsParams): string {
  const { item, isSpanish, needsPhoneOutcome, needsWhatsAppOutcome, needsEmailOutcome } = params;
  const missionStatus = payloadString(item.action_payload, ["mission_status", "status"]).toLowerCase();
  if (item.status === "calling") {
    if (item.use_case === "book_appointment") return isSpanish ? "Escuchar, silenciar o detener" : "Listen, mute, or stop";
    return isSpanish ? "Esperar respuesta del proveedor" : "Wait for provider reply";
  }
  if (item.status === "failed") return isSpanish ? "Revisar y elegir siguiente paso" : "Review and choose next step";
  if (needsPhoneOutcome) return isSpanish ? "Llamar y guardar resultado" : "Call and save result";
  if (needsWhatsAppOutcome) return isSpanish ? "Enviar WhatsApp y guardar" : "Send WhatsApp and save";
  if (needsEmailOutcome) return isSpanish ? "Enviar email y guardar" : "Send email and save";
  if (missionStatus.includes("awaiting_user_save") || missionStatus.includes("booked")) {
    if (item.use_case === "book_ride") return isSpanish ? "Guardar viaje confirmado" : "Save confirmed ride";
    if (isHomeServicePendingAction(item)) return isSpanish ? "Guardar servicio confirmado" : "Save confirmed service";
    if (item.use_case === "book_appointment") return isSpanish ? "Guardar cita confirmada" : "Save confirmed appointment";
    return isSpanish ? "Guardar confirmacion" : "Save confirmation";
  }
  if (missionStatus.includes("awaiting_provider")) return isSpanish ? "Esperar respuesta del proveedor" : "Wait for provider reply";
  return rightNowPrimaryActionLabel(params);
}

function rightNowNextStepHelper(params: RightNowActionLabelsParams): string {
  const { item, isSpanish, isVyvaTask, needsPhoneOutcome, needsWhatsAppOutcome, needsEmailOutcome, formMissingFields } = params;
  if (item.status === "calling") {
    return isSpanish ? "Puedes volver mas tarde; la tarea seguira aqui." : "You can come back later; this task stays here.";
  }
  if (item.status === "failed") {
    return isSpanish ? "Nada se envia hasta que lo confirmes." : "Nothing is sent until you confirm.";
  }
  if (needsPhoneOutcome) {
    return isSpanish
      ? "Llama desde aqui y guarda el resultado para cerrar la tarea."
      : "Call from here, then save what happened to close the task.";
  }
  if (needsWhatsAppOutcome) {
    return isSpanish
      ? "VYVA no lo envia por ti. Abre WhatsApp y guarda el resultado."
      : "VYVA does not send it for you. Open WhatsApp and save that it went out.";
  }
  if (needsEmailOutcome) {
    return isSpanish
      ? "VYVA no lo envia por ti. Abre el borrador y guarda el resultado."
      : "VYVA does not send it for you. Open the draft and save that it went out.";
  }
  if (isVyvaTask) {
    const task = getConciergeExecutionTask(item);
    if (task && !task.user_confirmed && task.missing_requirements.length === 0 && formMissingFields.length === 0) {
      return isSpanish
        ? "Confirma para ponerlo en la cola de VYVA. Nada se envia sin ese OK."
        : "Confirm to place it in the VYVA queue. Nothing is sent without that OK.";
    }
    return isSpanish ? "VYVA lo mantiene aqui hasta que este listo para confirmar." : "VYVA keeps it here until it is ready to confirm.";
  }
  return isSpanish ? "Tu confirmas antes de enviar, llamar o reservar." : "You confirm before anything is sent, called, or booked.";
}

type ConciergeTimelineStepState = "done" | "active" | "upcoming" | "warning";

type ConciergeTimelineStep = {
  id: string;
  label: string;
  helper: string;
  state: ConciergeTimelineStepState;
};

type ConciergeFollowThroughStatus = {
  eyebrow: string;
  title: string;
  helper: string;
  activeStepId: string;
  steps: ConciergeTimelineStep[];
};

type ProviderReplyMode = "confirmed" | "more_info" | null;

type ProviderReplyForm = {
  scheduledFor: string;
  reference: string;
  location: string;
  price: string;
  followUp: string;
  providerReply: string;
  notes: string;
  followUpQuestion: string;
};

type BookingFormOutcomeForm = {
  reference: string;
  notes: string;
};

type PhoneCallOutcomeStatus = "confirmed" | "no_answer" | "needs_info" | "cancelled";

type PhoneCallOutcomeForm = {
  status: PhoneCallOutcomeStatus;
  scheduledFor: string;
  reference: string;
  price: string;
  followUp: string;
  notes: string;
};

type EmailDraftOutcomeForm = {
  reference: string;
  notes: string;
};

type WhatsAppDraftOutcomeForm = {
  reference: string;
  notes: string;
};

type ManualReviewOutcomeStatus = "completed" | "review_pending";

type ManualReviewOutcomeForm = {
  status: ManualReviewOutcomeStatus;
  summary: string;
  nextStep: string;
  reference: string;
  notes: string;
};

function missionStatusForPendingAction(item: ConciergePendingItem): AppointmentMissionState["status"] | null {
  return isAppointmentMissionStatus(item.action_payload?.mission_status)
    ? item.action_payload.mission_status
    : null;
}

function timelineStepCopy(id: string, isSpanish: boolean): Omit<ConciergeTimelineStep, "id" | "state"> {
  const copy: Record<string, { en: string; es: string; helperEn: string; helperEs: string }> = {
    review: {
      en: "Review",
      es: "Revisar",
      helperEn: "Nothing is sent yet.",
      helperEs: "Aun no se envia nada.",
    },
    requested: {
      en: "Requested",
      es: "Solicitado",
      helperEn: "VYVA has started it.",
      helperEs: "VYVA lo ha iniciado.",
    },
    waiting: {
      en: "Waiting",
      es: "Esperando",
      helperEn: "Provider reply pending.",
      helperEs: "Falta respuesta del proveedor.",
    },
    confirmed: {
      en: "Confirmed",
      es: "Confirmado",
      helperEn: "Save the final detail.",
      helperEs: "Guarda el dato final.",
    },
    done: {
      en: "Done",
      es: "Hecho",
      helperEn: "Saved in Concierge.",
      helperEs: "Guardado en Concierge.",
    },
    attention: {
      en: "Needs attention",
      es: "Necesita revision",
      helperEn: "Review before continuing.",
      helperEs: "Revisa antes de continuar.",
    },
    cancelled: {
      en: "Cancelled",
      es: "Cancelado",
      helperEn: "This task will not continue.",
      helperEs: "Esta gestion no continuara.",
    },
  };
  const entry = copy[id] ?? copy.review;
  return {
    label: isSpanish ? entry.es : entry.en,
    helper: isSpanish ? entry.helperEs : entry.helperEn,
  };
}

function buildConciergeFollowThroughStatus(item: ConciergePendingItem, isSpanish: boolean): ConciergeFollowThroughStatus {
  const missionStatus = missionStatusForPendingAction(item);
  const executionChannel = getExecutionChannel(item);
  const bookingUrl = getBookingUrl(item);
  const formPlan = getFormAutomationPlan(item);
  const formReady = executionChannel === "booking_url" && Boolean(bookingUrl) && (formPlan?.missingFields.length ?? 0) === 0;
  const isVyvaTask = executionChannel === "manual" || (executionChannel === "booking_url" && !formReady);
  const userConfirmed = conciergeActionAlreadyConfirmed(item);
  const operatorAssigned = conciergeOperatorAssigned(item);
  const stepIds = ["review", "requested", "waiting", "confirmed", "done"];

  let activeId = isVyvaTask || userConfirmed ? "requested" : "review";
  const eyebrow = isSpanish ? "Seguimiento" : "Follow-through";
  let title = isVyvaTask || userConfirmed
    ? (
      operatorAssigned
        ? (isSpanish ? "Un operador VYVA lo prepara" : "A VYVA operator is preparing it")
        : (isSpanish ? "VYVA lo esta preparando" : "VYVA is preparing it")
    )
    : (isSpanish ? "Listo para tu OK" : "Ready for your OK");
  let helper = isVyvaTask || userConfirmed
    ? (isSpanish ? "La tarea se queda aqui mientras VYVA reune lo necesario." : "This stays here while VYVA gathers what is needed.")
    : (isSpanish ? "Nada se envia, llama o reserva hasta que confirmes." : "Nothing is sent, called, or booked until you confirm.");

  if (item.status === "calling") {
    activeId = "requested";
    title = isSpanish ? "Solicitud iniciada" : "Request started";
    helper = isSpanish ? "VYVA esta contactando al proveedor." : "VYVA is contacting the provider.";
  }
  if (item.status === "completed") {
    activeId = "done";
    title = isSpanish ? "Completado" : "Completed";
    helper = isSpanish ? "Guardado en el historial de Concierge." : "Saved in Concierge history.";
  }
  if (item.status === "failed") {
    return {
      eyebrow,
      title: isSpanish ? "Necesita revision" : "Needs attention",
      helper: isSpanish ? "Revisa la tarea antes de continuar." : "Review the task before continuing.",
      activeStepId: "attention",
      steps: [
        { id: "review", ...timelineStepCopy("review", isSpanish), state: "done" },
        { id: "attention", ...timelineStepCopy("attention", isSpanish), state: "warning" },
      ],
    };
  }
  if (item.status === "cancelled") {
    return {
      eyebrow,
      title: isSpanish ? "Cancelado" : "Cancelled",
      helper: isSpanish ? "Esta gestion no continuara." : "This task will not continue.",
      activeStepId: "cancelled",
      steps: [
        { id: "review", ...timelineStepCopy("review", isSpanish), state: "done" },
        { id: "cancelled", ...timelineStepCopy("cancelled", isSpanish), state: "warning" },
      ],
    };
  }

  if (missionStatus) {
    if (missionStatus === "awaiting_confirmation") {
      activeId = "review";
      title = isSpanish ? "Listo para tu OK" : "Ready for your OK";
    }
    if (missionStatus === "contacting_provider" || missionStatus === "form_in_progress") {
      activeId = "requested";
      title = isSpanish ? "Solicitud iniciada" : "Request started";
      helper = isSpanish ? "VYVA esta contactando o preparando el formulario." : "VYVA is contacting or preparing the form.";
    }
    if (missionStatus === "awaiting_provider_reply") {
      activeId = "waiting";
      title = isSpanish ? "Esperando proveedor" : "Waiting for provider";
      helper = isSpanish ? "La respuesta aparecera aqui cuando llegue." : "The reply will appear here when it arrives.";
    }
    if (missionStatus === "awaiting_user_save" || missionStatus === "booked") {
      activeId = "confirmed";
      title = isSpanish ? "Proveedor confirmado" : "Provider confirmed";
      helper = isSpanish ? "Guarda la hora, referencia o detalle final." : "Save the time, reference, or final detail.";
    }
    if (missionStatus === "stopped") {
      return {
        eyebrow,
        title: isSpanish ? "Detenido" : "Stopped",
        helper: isSpanish ? "Esta gestion no continuara." : "This task will not continue.",
        activeStepId: "cancelled",
        steps: [
          { id: "review", ...timelineStepCopy("review", isSpanish), state: "done" },
          { id: "cancelled", ...timelineStepCopy("cancelled", isSpanish), state: "warning" },
        ],
      };
    }
  }

  const activeIndex = Math.max(0, stepIds.indexOf(activeId));
  return {
    eyebrow,
    title,
    helper,
    activeStepId: activeId,
    steps: stepIds.map((id, index) => ({
      id,
      ...timelineStepCopy(id, isSpanish),
      state: index < activeIndex ? "done" : index === activeIndex ? "active" : "upcoming",
    })),
  };
}

function canRecordProviderReply(status: ConciergeFollowThroughStatus | null): boolean {
  return Boolean(status && ["requested", "waiting", "confirmed"].includes(status.activeStepId));
}

type ConciergeExecutionTone = "purple" | "blue" | "green" | "amber" | "red";

type ConciergeExecutionStatusSummary = {
  phase: "needs_ok" | "needs_info" | "being_prepared" | "waiting" | "ready_to_save" | "completed" | "cancelled" | "attention";
  label: string;
  helper: string;
  tone: ConciergeExecutionTone;
};

type ConciergeUserUpdateSummary = ConciergeExecutionStatusSummary & {
  detail: string;
  chips: string[];
};

function getConciergeExecutionTask(item: ConciergePendingItem): ConciergeExecutionTask | null {
  const task = item.action_payload?.execution_task;
  if (!isRecord(task) || task.version !== 1) return null;
  const lifecycleStatus = typeof task.lifecycle_status === "string"
    ? task.lifecycle_status
    : "";
  if (!["ready", "needs_info", "confirmed", "in_progress", "done", "failed", "cancelled"].includes(lifecycleStatus)) return null;
  return task as unknown as ConciergeExecutionTask;
}

function conciergeOperatorAssigned(item: ConciergePendingItem): boolean {
  return Boolean(
    payloadString(item.action_payload, ["operator_assigned_to"])
      || payloadString(item.action_payload, ["operator_assigned_email"]),
  );
}

function conciergeActionAlreadyConfirmed(item: ConciergePendingItem): boolean {
  if (activeConciergeReconfirmationRequestFromPayload(item.action_payload)) return false;
  const task = getConciergeExecutionTask(item);
  return Boolean(
    task?.user_confirmed
      || item.confirmed_at
      || payloadString(item.action_payload, ["operator_assigned_at", "confirmed_at"]),
  );
}

function executionActionLabel(actionType: ConciergeExecutionTask["action_type"], isSpanish: boolean): string {
  switch (actionType) {
    case "phone_call":
      return isSpanish ? "llamada" : "call";
    case "message":
      return isSpanish ? "mensaje" : "message";
    case "booking_link":
      return isSpanish ? "reserva" : "booking";
    case "provider_search":
      return isSpanish ? "busqueda de proveedor" : "provider search";
    case "admin_paperwork":
      return isSpanish ? "gestion" : "paperwork";
    case "web_search":
      return isSpanish ? "busqueda segura" : "safe search";
    case "shopping_request":
      return isSpanish ? "compra" : "shopping";
    case "manual_review":
    default:
      return isSpanish ? "revision VYVA" : "VYVA review";
  }
}

function executionTaskStatusSummary(task: ConciergeExecutionTask, isSpanish: boolean): ConciergeExecutionStatusSummary {
  const missing = task.missing_requirements?.[0];
  const missingLabel = missing ? (isSpanish ? missing.label_es : missing.label_en) : "";
  const actionLabel = executionActionLabel(task.action_type, isSpanish);
  const statusCopy: Record<ConciergeExecutionTaskStatus, ConciergeExecutionStatusSummary> = {
    ready: {
      phase: "needs_ok",
      label: isSpanish ? "Lista para tu OK" : "Ready for your OK",
      helper: isSpanish
        ? `VYVA tiene lo necesario para preparar la ${actionLabel}.`
        : `VYVA has what it needs to prepare the ${actionLabel}.`,
      tone: "purple",
    },
    needs_info: {
      phase: "needs_info",
      label: isSpanish ? "Faltan datos" : "Needs details",
      helper: missingLabel
        ? (isSpanish ? `Anade ${missingLabel} para seguir.` : `Add ${missingLabel} to continue.`)
        : (isSpanish ? "Anade un detalle para seguir." : "Add one detail to continue."),
      tone: "amber",
    },
    confirmed: {
      phase: "waiting",
      label: isSpanish ? "Confirmado" : "Confirmed",
      helper: isSpanish
        ? "VYVA ya tiene tu OK y mantiene la tarea en cola."
        : "VYVA has your OK and is keeping this task queued.",
      tone: "blue",
    },
    in_progress: {
      phase: "waiting",
      label: isSpanish ? "En marcha" : "In progress",
      helper: isSpanish
        ? "La tarjeta se queda aqui hasta guardar el resultado."
        : "This stays here until the result is saved.",
      tone: "blue",
    },
    done: {
      phase: "completed",
      label: isSpanish ? "Guardado" : "Saved",
      helper: isSpanish ? "El resultado esta en el historial." : "The result is in the history.",
      tone: "green",
    },
    failed: {
      phase: "attention",
      label: isSpanish ? "Necesita revision" : "Needs review",
      helper: isSpanish ? "Revisa el siguiente paso antes de continuar." : "Review the next step before continuing.",
      tone: "red",
    },
    cancelled: {
      phase: "cancelled",
      label: isSpanish ? "Cancelado" : "Cancelled",
      helper: isSpanish ? "Esta gestion no seguira adelante." : "This task will not continue.",
      tone: "amber",
    },
  };
  return statusCopy[task.lifecycle_status] ?? statusCopy.ready;
}

function buildConciergeExecutionStatus(
  item: ConciergePendingItem,
  status: ConciergeFollowThroughStatus | null,
  isSpanish: boolean,
): ConciergeExecutionStatusSummary {
  const task = getConciergeExecutionTask(item);
  if (task) return executionTaskStatusSummary(task, isSpanish);

  if (!status) {
    return {
      phase: "needs_ok",
      label: isSpanish ? "Necesita tu OK" : "Needs your OK",
      helper: isSpanish ? "Confirmas antes de enviar, llamar o reservar." : "You confirm before anything is sent, called, or booked.",
      tone: "purple",
    };
  }

  if (item.status === "failed" || status.activeStepId === "attention") {
    return {
      phase: "attention",
      label: isSpanish ? "Necesita revision" : "Needs review",
      helper: isSpanish ? "Revisa el siguiente paso antes de continuar." : "Review the next step before continuing.",
      tone: "red",
    };
  }
  if (item.status === "cancelled" || status.activeStepId === "cancelled") {
    return {
      phase: "cancelled",
      label: isSpanish ? "Cancelado" : "Cancelled",
      helper: isSpanish ? "Esta gestion no seguira adelante." : "This task will not continue.",
      tone: "amber",
    };
  }
  if (item.status === "completed" || status.activeStepId === "done") {
    return {
      phase: "completed",
      label: isSpanish ? "Guardado" : "Saved",
      helper: isSpanish ? "El resultado esta en el historial." : "The result is in the history.",
      tone: "green",
    };
  }
  if (status.activeStepId === "confirmed") {
    return {
      phase: "ready_to_save",
      label: isSpanish ? "Listo para guardar" : "Ready to save",
      helper: isSpanish ? "Guarda la hora, referencia o respuesta final." : "Save the time, reference, or final reply.",
      tone: "green",
    };
  }
  if (status.activeStepId === "waiting") {
    return {
      phase: "waiting",
      label: isSpanish ? "Esperando respuesta" : "Waiting for reply",
      helper: isSpanish ? "Cuando llegue, guardala aqui para cerrar la tarea." : "When it arrives, save it here to close the task.",
      tone: "blue",
    };
  }
  if (status.activeStepId === "requested" || item.status === "calling") {
    return {
      phase: item.status === "calling" ? "waiting" : "being_prepared",
      label: item.status === "calling"
        ? (isSpanish ? "Esperando respuesta" : "Waiting for reply")
        : (isSpanish ? "VYVA lo prepara" : "VYVA is preparing it"),
      helper: item.status === "calling"
        ? (isSpanish ? "La tarjeta se queda aqui hasta guardar el resultado." : "This stays here until the result is saved.")
        : (isSpanish ? "VYVA reunira lo necesario antes de pedir tu OK." : "VYVA gathers what is needed before asking for your OK."),
      tone: item.status === "calling" ? "blue" : "purple",
    };
  }
  return {
    phase: "needs_ok",
    label: isSpanish ? "Necesita tu OK" : "Needs your OK",
    helper: isSpanish ? "Confirmas antes de enviar, llamar o reservar." : "You confirm before anything is sent, called, or booked.",
    tone: "purple",
  };
}

function buildConciergeUserUpdateSummary(
  item: ConciergePendingItem,
  fallback: ConciergeExecutionStatusSummary,
  isSpanish: boolean,
): ConciergeUserUpdateSummary {
  const task = getConciergeExecutionTask(item);
  const missing = task?.missing_requirements?.[0];
  const missingLabel = missing ? (isSpanish ? missing.label_es : missing.label_en) : "";
  const alreadyConfirmed = conciergeActionAlreadyConfirmed(item);
  const operatorAssigned = conciergeOperatorAssigned(item);
  const baseSafeChip = isSpanish ? "Tu confirmas" : "You confirm";

  if (fallback.phase === "needs_info") {
    return {
      ...fallback,
      detail: missingLabel
        ? (isSpanish ? `VYVA necesita: ${missingLabel}.` : `VYVA needs: ${missingLabel}.`)
        : (isSpanish ? "Anade el dato que falta y VYVA sigue." : "Add the missing detail and VYVA will continue."),
      chips: [isSpanish ? "Falta un dato" : "One detail needed", baseSafeChip],
    };
  }

  if (item.status === "calling" || fallback.phase === "waiting") {
    return {
      ...fallback,
      label: isSpanish ? "VYVA esta con ello" : "VYVA is working on it",
      helper: isSpanish
        ? "Puedes volver mas tarde; la tarea seguira aqui."
        : "You can come back later; this task stays here.",
      detail: isSpanish
        ? "Cuando haya respuesta, aparecera aqui para guardar o revisar."
        : "When there is a reply, it will appear here to save or review.",
      chips: [isSpanish ? "En marcha" : "In progress", baseSafeChip],
    };
  }

  if (alreadyConfirmed && item.status === "pending") {
    return {
      phase: "being_prepared",
      label: operatorAssigned
        ? (isSpanish ? "Un operador VYVA lo prepara" : "A VYVA operator is preparing this")
        : (isSpanish ? "VYVA lo esta preparando" : "VYVA is preparing this"),
      helper: isSpanish
        ? "Ya diste tu OK. VYVA te pedira confirmacion antes del paso final."
        : "You already gave your OK. VYVA will ask again before any final step.",
      detail: isSpanish
        ? "Mira esta tarjeta para la siguiente actualizacion."
        : "Watch this card for the next update.",
      tone: operatorAssigned ? "blue" : "purple",
      chips: [
        isSpanish ? "OK recibido" : "OK received",
        operatorAssigned ? (isSpanish ? "Operador asignado" : "Operator assigned") : (isSpanish ? "Preparando" : "Preparing"),
      ],
    };
  }

  if (fallback.phase === "ready_to_save") {
    return {
      ...fallback,
      detail: isSpanish
        ? "Guarda el detalle final para cerrar la gestion."
        : "Save the final detail to close the task.",
      chips: [isSpanish ? "Listo para cerrar" : "Ready to close", baseSafeChip],
    };
  }

  if (fallback.phase === "attention") {
    return {
      ...fallback,
      label: isSpanish ? "No se pudo completar aun" : "Could not complete yet",
      detail: isSpanish
        ? "Revisa el siguiente paso o pide a VYVA que pruebe otra opcion."
        : "Review the next step or ask VYVA to try another option.",
      chips: [isSpanish ? "Necesita revision" : "Needs review", baseSafeChip],
    };
  }

  return {
    ...fallback,
    detail: isSpanish
      ? "Nada se envia, llama ni reserva sin tu permiso."
      : "Nothing is sent, called, or booked without your permission.",
    chips: [baseSafeChip, isSpanish ? "Sin sorpresas" : "No surprises"],
  };
}

const EMPTY_PROVIDER_REPLY_FORM: ProviderReplyForm = {
  scheduledFor: "",
  reference: "",
  location: "",
  price: "",
  followUp: "",
  providerReply: "",
  notes: "",
  followUpQuestion: "",
};

const EMPTY_BOOKING_FORM_OUTCOME_FORM: BookingFormOutcomeForm = {
  reference: "",
  notes: "",
};

const EMPTY_PHONE_CALL_OUTCOME_FORM: PhoneCallOutcomeForm = {
  status: "confirmed",
  scheduledFor: "",
  reference: "",
  price: "",
  followUp: "",
  notes: "",
};

const EMPTY_EMAIL_DRAFT_OUTCOME_FORM: EmailDraftOutcomeForm = {
  reference: "",
  notes: "",
};

const EMPTY_WHATSAPP_DRAFT_OUTCOME_FORM: WhatsAppDraftOutcomeForm = {
  reference: "",
  notes: "",
};

const EMPTY_MANUAL_REVIEW_OUTCOME_FORM: ManualReviewOutcomeForm = {
  status: "completed",
  summary: "",
  nextStep: "",
  reference: "",
  notes: "",
};

function providerReplyFormHasDetails(form: ProviderReplyForm): boolean {
  return Boolean(
    form.scheduledFor.trim() ||
    form.reference.trim() ||
    form.location.trim() ||
    form.price.trim() ||
    form.followUp.trim() ||
    form.providerReply.trim() ||
    form.notes.trim(),
  );
}

function providerReplyHasValidScheduledTime(form: ProviderReplyForm): boolean {
  const value = form.scheduledFor.trim();
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function providerReplyInitialForm(item: ConciergePendingItem, isSpanish: boolean): ProviderReplyForm {
  const payload = item.action_payload;
  const needsScheduledEvent = isMedicalAppointmentPendingAction(item) || isHomeServicePendingAction(item);
  const rawScheduledFor = payloadString(payload, needsScheduledEvent
    ? ["scheduled_for", "time"]
    : ["scheduled_for", "requested_time", "time"]);
  const scheduledFor = needsScheduledEvent && rawScheduledFor && Number.isNaN(new Date(rawScheduledFor).getTime())
    ? ""
    : rawScheduledFor;
  const savedProviderQuestion = payloadString(payload, ["provider_response_summary", "provider_reply"]);
  const needsMoreInfo = payloadString(payload, ["provider_task_status"]) === "action_needed"
    || payloadString(payload, ["provider_reply_status"]) === "needs_more_info";
  return {
    scheduledFor,
    reference: payloadString(payload, ["booking_reference", "pharmacy_reference", "reference"]),
    location: payloadString(payload, ["location", "address", "destination_address", "home_address"]),
    price: payloadString(payload, ["price", "price_estimate", "estimated_cost", "cost"]),
    followUp: payloadString(payload, ["follow_up", "follow_up_date", "next_step"]),
    providerReply: payloadString(payload, ["provider_reply", "fulfillment_note"]),
    notes: "",
    followUpQuestion: needsMoreInfo && savedProviderQuestion
      ? savedProviderQuestion
      : isSpanish
        ? "Que dato necesita el proveedor para confirmar?"
        : "What detail does the provider need before confirming?",
  };
}

function providerReplyOutcomePayload(item: ConciergePendingItem, form: ProviderReplyForm): Record<string, unknown> {
  const payload = item.action_payload ?? {};
  const providerName = isProviderSearchPendingAction(item)
    ? providerSearchProviderName(item)
    : item.provider_name ?? (payloadString(payload, ["provider_name", "pharmacy_name"]) || null);
  const providerPhone = item.provider_phone ?? (payloadString(payload, ["provider_phone", "phone"]) || null);
  return {
    ...payload,
    provider_name: providerName,
    provider_phone: providerPhone,
    provider_reply_status: "confirmed",
    provider_reply: form.providerReply.trim() || "Provider confirmed.",
    scheduled_for: form.scheduledFor.trim() || payloadString(payload, ["scheduled_for", "requested_time", "time"]) || null,
    reference: form.reference.trim() || payloadString(payload, ["booking_reference", "pharmacy_reference", "reference"]) || null,
    location: form.location.trim() || payloadString(payload, ["location", "address", "destination_address", "home_address"]) || null,
    price: form.price.trim() || payloadString(payload, ["price", "price_estimate", "estimated_cost", "cost"]) || null,
    follow_up: form.followUp.trim() || payloadString(payload, ["follow_up", "follow_up_date", "next_step"]) || null,
    notes: form.notes.trim() || null,
    live_handoff_status: "completed",
    live_handoff_outcome: "provider_confirmed",
    completed_from: "provider_reply_panel",
  };
}

function providerReplyOutcomeSummary(item: ConciergePendingItem, form: ProviderReplyForm, isSpanish: boolean): string {
  const provider = isProviderSearchPendingAction(item)
    ? providerSearchProviderName(item, isSpanish)
    : item.provider_name?.trim() || (isSpanish ? "proveedor" : "provider");
  const time = form.scheduledFor.trim();
  const reference = form.reference.trim();
  if (time && reference) {
    return isSpanish
      ? `Proveedor confirmado: ${provider}. Hora: ${time}. Referencia: ${reference}.`
      : `Provider confirmed: ${provider}. Time: ${time}. Reference: ${reference}.`;
  }
  if (time) {
    return isSpanish
      ? `Proveedor confirmado: ${provider}. Hora: ${time}.`
      : `Provider confirmed: ${provider}. Time: ${time}.`;
  }
  if (reference) {
    return isSpanish
      ? `Proveedor confirmado: ${provider}. Referencia: ${reference}.`
      : `Provider confirmed: ${provider}. Reference: ${reference}.`;
  }
  return isSpanish
    ? `Proveedor confirmado: ${provider}.`
    : `Provider confirmed: ${provider}.`;
}

function providerReplyOpenTaskPayload(
  item: ConciergePendingItem,
  form: ProviderReplyForm,
  isSpanish: boolean,
  details: Record<string, unknown> = {},
): Record<string, unknown> {
  const outcome = providerReplyOutcomePayload(item, form);
  return buildConciergeProviderReplyPatch({
    payload: item.action_payload,
    reply: form.providerReply.trim() || (isSpanish ? "Proveedor confirmado." : "Provider confirmed."),
    summary: providerReplyOutcomeSummary(item, form, isSpanish),
    source: isConciergeDryRunPayload(item.action_payload) ? "simulated" : "live",
    details: {
      ...outcome,
      ...details,
    },
  });
}

function conciergeProviderStatusPriority(status: ConciergeProviderTaskStatus | null | undefined): number {
  if (status === "action_needed") return 0;
  if (status === "reply_received") return 1;
  if (!status) return 2;
  if (status === "waiting") return 3;
  return 4;
}

function bookingFormFlowReference(item: ConciergePendingItem): string {
  const explicit = payloadString(item.action_payload, ["flow_reference"]);
  if (explicit) return explicit;
  if (isHomeServicePendingAction(item)) return CONCIERGE_FLOW_REFERENCES.homeService;
  if (item.use_case === "book_appointment") return MEDICAL_APPOINTMENT_FLOW_REFERENCE;
  if (item.use_case === "book_ride") return TRANSPORT_BOOKING_FLOW_REFERENCE;
  if (item.use_case === "order_medicine") return OTC_PHARMACY_FLOW_REFERENCE;
  return CONCIERGE_FLOW_REFERENCES.toolGatedTask;
}

function bookingFormProviderName(item: ConciergePendingItem, isSpanish: boolean): string {
  return item.provider_name?.trim()
    || payloadString(item.action_payload, ["provider_name", "pharmacy_name", "selected_provider_name"])
    || (isSpanish ? "proveedor" : "provider");
}

function bookingFormOutcomeSummary(item: ConciergePendingItem, form: BookingFormOutcomeForm, isSpanish: boolean): string {
  const provider = bookingFormProviderName(item, isSpanish);
  const reference = form.reference.trim();
  if (reference) {
    return isSpanish
      ? `Formulario enviado: ${provider}. Referencia: ${reference}.`
      : `Form submitted: ${provider}. Reference: ${reference}.`;
  }
  return isSpanish ? `Formulario enviado: ${provider}.` : `Form submitted: ${provider}.`;
}

function bookingFormOutcomePayload(item: ConciergePendingItem, form: BookingFormOutcomeForm): Record<string, unknown> {
  const payload = item.action_payload ?? {};
  const plan = getFormAutomationPlan(item);
  const bookingUrl = getBookingUrl(item);
  return {
    ...payload,
    flow_reference: bookingFormFlowReference(item),
    execution_type: "form_booking_link_outcome_capture",
    execution_channel: "booking_url",
    form_outcome: "submitted",
    provider_name: item.provider_name ?? (payloadString(payload, ["provider_name", "pharmacy_name", "selected_provider_name"]) || null),
    booking_url: payloadString(payload, ["booking_url"]) || bookingUrl || null,
    prefilled_url: plan?.prefilledUrl || payloadString(payload, ["form_automation_prefilled_url", "prefilled_url"]) || null,
    adapter_label: plan?.adapterLabel ?? null,
    missing_fields: plan?.missingFields ?? [],
    reference: form.reference.trim() || payloadString(payload, ["booking_reference", "reference"]) || null,
    notes: form.notes.trim() || null,
    live_handoff_status: "sent_or_called",
    live_handoff_outcome: "form_submitted",
    completed_from: "booking_form_support_panel",
    no_external_action_without_confirmation: true,
  };
}

function phoneCallProviderPhone(item: ConciergePendingItem): string {
  return item.provider_phone?.trim() || payloadString(item.action_payload, ["provider_phone", "phone", "contact_phone"]);
}

function phoneCallProviderName(item: ConciergePendingItem, isSpanish: boolean): string {
  return item.provider_name?.trim()
    || payloadString(item.action_payload, ["provider_name", "pharmacy_name", "selected_provider_name"])
    || (isSpanish ? "proveedor" : "provider");
}

function phoneCallScript(item: ConciergePendingItem, isSpanish: boolean): string {
  const script = payloadString(item.action_payload, [
    "call_script",
    "phone_script",
    "script",
    "draft_body",
    "draft_message",
    "message_body",
    "message",
    "body",
  ]);
  if (script) return script;
  const provider = phoneCallProviderName(item, isSpanish);
  return isSpanish
    ? `Hola, llamo por esta solicitud con ${provider}: ${item.action_summary}`
    : `Hello, I am calling about this request with ${provider}: ${item.action_summary}`;
}

function phoneCallFlowReference(item: ConciergePendingItem): string {
  const explicit = payloadString(item.action_payload, ["flow_reference"]);
  if (explicit) return explicit;
  if (item.use_case === "book_ride") return TRANSPORT_BOOKING_FLOW_REFERENCE;
  if (item.use_case === "order_medicine") return OTC_PHARMACY_FLOW_REFERENCE;
  if (isHomeServicePendingAction(item)) return CONCIERGE_FLOW_REFERENCES.homeService;
  if (item.use_case === "book_appointment") return MEDICAL_APPOINTMENT_FLOW_REFERENCE;
  if (item.use_case === "insurance_admin") return INSURANCE_ADMIN_FLOW_REFERENCE;
  if (item.use_case === "scam_check") return SCAM_CHECK_FLOW_REFERENCE;
  return CONCIERGE_FLOW_REFERENCES.toolGatedTask;
}

function phoneCallToolHint(item: ConciergePendingItem): string {
  return [
    item.requested_tool ?? "",
    item.active_tool ?? "",
    payloadString(item.action_payload, [
      "requested_tool",
      "active_tool",
      "tool",
      "tool_required",
      "preferred_tool",
      "execution_channel",
      "preferred_channel",
      "handoff_channel",
    ]),
  ].join(" ").toLowerCase();
}

function isPhoneCallPendingAction(item: ConciergePendingItem): boolean {
  if (item.status !== "pending") return false;
  const channel = getPreferredHandoffChannel(item).toLowerCase();
  const toolHint = phoneCallToolHint(item);
  const hasPhone = Boolean(phoneCallProviderPhone(item));
  if (!hasPhone) return false;
  if (channel === "whatsapp" || toolHint.includes("whatsapp")) return false;
  if (channel === "email" || toolHint.includes("email")) return false;
  if (channel === "booking_url" || channel === "manual") return false;
  if (toolHint.includes("form") || toolHint.includes("booking")) return false;
  if (channel.includes("phone") || channel.includes("call")) return true;
  if (toolHint.includes("phone") || toolHint.includes("call")) return true;
  return !getActionEmailDraft(item) && !getActionWhatsAppDraft(item) && !getBookingUrl(item);
}

function phoneCallOutcomeStatusLabel(status: PhoneCallOutcomeStatus, isSpanish: boolean): string {
  switch (status) {
    case "confirmed":
      return isSpanish ? "Confirmado" : "Confirmed";
    case "no_answer":
      return isSpanish ? "Sin respuesta" : "No answer";
    case "needs_info":
      return isSpanish ? "Piden datos" : "Needs info";
    case "cancelled":
      return isSpanish ? "Cancelado" : "Cancelled";
    default:
      return status;
  }
}

function liveHandoffStatusForPhoneOutcome(status: PhoneCallOutcomeStatus): ConciergeLiveHandoffState {
  if (status === "confirmed") return "completed";
  if (status === "no_answer") return "waiting";
  if (status === "needs_info") return "needs_human_help";
  return "failed";
}

function phoneCallOutcomeSummary(item: ConciergePendingItem, form: PhoneCallOutcomeForm, isSpanish: boolean): string {
  const provider = phoneCallProviderName(item, isSpanish);
  const statusLabel = phoneCallOutcomeStatusLabel(form.status, isSpanish).toLowerCase();
  const time = form.scheduledFor.trim();
  const reference = form.reference.trim();
  if (time && reference) {
    return isSpanish
      ? `Llamada guardada con ${provider}. Resultado: ${statusLabel}. Hora: ${time}. Referencia: ${reference}.`
      : `Call saved with ${provider}. Result: ${statusLabel}. Time: ${time}. Reference: ${reference}.`;
  }
  if (time) {
    return isSpanish
      ? `Llamada guardada con ${provider}. Resultado: ${statusLabel}. Hora: ${time}.`
      : `Call saved with ${provider}. Result: ${statusLabel}. Time: ${time}.`;
  }
  if (reference) {
    return isSpanish
      ? `Llamada guardada con ${provider}. Resultado: ${statusLabel}. Referencia: ${reference}.`
      : `Call saved with ${provider}. Result: ${statusLabel}. Reference: ${reference}.`;
  }
  return isSpanish
    ? `Llamada guardada con ${provider}. Resultado: ${statusLabel}.`
    : `Call saved with ${provider}. Result: ${statusLabel}.`;
}

function phoneCallOutcomePayload(item: ConciergePendingItem, form: PhoneCallOutcomeForm, isSpanish: boolean): Record<string, unknown> {
  const payload = item.action_payload ?? {};
  return {
    ...payload,
    flow_reference: phoneCallFlowReference(item),
    execution_type: "phone_call_outcome_capture",
    execution_channel: "phone_call",
    call_outcome: form.status,
    provider_name: phoneCallProviderName(item, isSpanish),
    provider_phone: phoneCallProviderPhone(item),
    call_script: phoneCallScript(item, isSpanish),
    scheduled_for: form.scheduledFor.trim() || payloadString(payload, ["scheduled_for", "requested_time", "time"]) || null,
    reference: form.reference.trim() || payloadString(payload, ["booking_reference", "pharmacy_reference", "reference"]) || null,
    price: form.price.trim() || payloadString(payload, ["price", "price_estimate", "estimated_cost", "cost"]) || null,
    follow_up: form.followUp.trim() || payloadString(payload, ["follow_up", "follow_up_date", "next_step"]) || null,
    notes: form.notes.trim() || null,
    live_handoff_status: liveHandoffStatusForPhoneOutcome(form.status),
    live_handoff_outcome: form.status,
    completed_from: "phone_call_outcome_panel",
    no_external_action_without_confirmation: true,
  };
}

type ProviderFollowUpState = "waiting" | "needs_human_help";

type ProviderFollowUpAttempt = {
  at: string;
  channel: string;
  outcome: string;
  summary: string;
};

function providerFollowUpAttempts(payload: Record<string, unknown> | null | undefined): ProviderFollowUpAttempt[] {
  const attempts = payload?.provider_contact_attempts;
  if (!Array.isArray(attempts)) return [];
  return attempts.filter(isRecord).map((attempt) => ({
    at: typeof attempt.at === "string" ? attempt.at : "",
    channel: typeof attempt.channel === "string" ? attempt.channel : "manual",
    outcome: typeof attempt.outcome === "string" ? attempt.outcome : "contacted",
    summary: typeof attempt.summary === "string" ? attempt.summary : "",
  })).filter((attempt) => Boolean(attempt.at));
}

function buildProviderFollowUpPatch(params: {
  item: ConciergePendingItem;
  outcomePayload: Record<string, unknown>;
  outcomeSummary: string;
  outcome: string;
  channel: string;
  state?: ProviderFollowUpState;
}): Record<string, unknown> {
  const now = new Date().toISOString();
  const state = params.state ?? "waiting";
  const payload = params.item.action_payload ?? {};
  const previousAttempts = providerFollowUpAttempts(payload);
  const previousCount = typeof payload.provider_contact_attempt_count === "number"
    ? payload.provider_contact_attempt_count
    : previousAttempts.length;
  const waitingSince = payloadString(payload, ["provider_waiting_since", "waiting_since"]) || now;
  const previousMissionStatus = payloadString(payload, ["mission_status"]);
  const attempt: ProviderFollowUpAttempt = {
    at: now,
    channel: params.channel,
    outcome: params.outcome,
    summary: params.outcomeSummary,
  };

  return {
    ...params.outcomePayload,
    provider_task_status: state === "waiting" ? "waiting" : "action_needed",
    live_handoff_status: state,
    live_handoff_outcome: params.outcome,
    provider_follow_up_status: state,
    provider_waiting_since: waitingSince,
    provider_last_contact_at: now,
    provider_last_contact_channel: params.channel,
    provider_last_contact_outcome: params.outcome,
    provider_last_contact_summary: params.outcomeSummary,
    provider_contact_attempt_count: previousCount + 1,
    provider_contact_attempts: [...previousAttempts, attempt].slice(-10),
    waiting_for_provider: state === "waiting",
    mission_status: state === "waiting" ? "awaiting_provider_reply" : previousMissionStatus || "needs_info",
    provider_follow_up_requires_confirmation: true,
    provider_follow_up_confirmed: false,
    no_external_action_without_confirmation: true,
  };
}

async function recordPendingConciergeFollowUp(params: {
  item: ConciergePendingItem;
  outcomePayload: Record<string, unknown>;
  outcomeSummary: string;
  outcome: string;
  channel: string;
  state?: ProviderFollowUpState;
}) {
  return patchPendingConciergeAction({
    pendingId: params.item.id,
    actionPayload: buildProviderFollowUpPatch(params),
  });
}

function providerWaitingDate(item: ConciergePendingItem): Date | null {
  const rawDate = payloadString(item.action_payload, [
    "provider_waiting_since",
    "waiting_since",
    "provider_last_contact_at",
    "contacted_at",
  ]) || item.confirmed_at
    || payloadString(item.action_payload, ["requested_at", "started_at", "created_at"]);
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatProviderWaitingSince(item: ConciergePendingItem, locale: string, isSpanish: boolean, nowMs: number): string {
  const waitingDate = providerWaitingDate(item);
  if (!waitingDate) return isSpanish ? "Esperando respuesta" : "Waiting for reply";

  const elapsedMinutes = Math.max(0, Math.floor((nowMs - waitingDate.getTime()) / 60_000));
  if (elapsedMinutes < 1) return isSpanish ? "Enviado ahora" : "Sent just now";
  if (elapsedMinutes < 60) return isSpanish ? `${elapsedMinutes} min esperando` : `${elapsedMinutes} min waiting`;
  if (elapsedMinutes < 24 * 60) {
    const hours = Math.floor(elapsedMinutes / 60);
    return isSpanish ? `${hours} h esperando` : `${hours} hr waiting`;
  }

  const displayLocale = isSpanish || locale === "es" ? "es-ES" : "en-GB";
  const now = new Date(nowMs);
  const sameDay =
    waitingDate.getFullYear() === now.getFullYear()
    && waitingDate.getMonth() === now.getMonth()
    && waitingDate.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat(displayLocale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(waitingDate);

  if (sameDay) {
    return isSpanish ? `Esperando desde ${time}` : `Waiting since ${time}`;
  }

  const day = new Intl.DateTimeFormat(displayLocale, {
    day: "2-digit",
    month: "short",
  }).format(waitingDate);
  return isSpanish ? `Esperando desde ${day}, ${time}` : `Waiting since ${day}, ${time}`;
}

function providerFollowUpPrompt(item: ConciergePendingItem, isSpanish: boolean, locale: string): string {
  const provider = providerSearchProviderName(item, isSpanish) || item.provider_name?.trim() || (isSpanish ? "el proveedor" : "the provider");
  const actionLabel = getPendingActionUseCaseLabel(item, locale).toLowerCase();
  return isSpanish
    ? `Prepara un seguimiento breve para ${actionLabel} con ${provider}. Pregunta si pueden confirmar esta solicitud. Mantenlo claro y breve, y no envies nada hasta que yo confirme.`
    : `Prepare a short follow-up for ${actionLabel} with ${provider}. Ask whether they can confirm this request. Keep it polite and concise, and do not send anything until I confirm.`;
}

function isProviderSearchPendingAction(item: ConciergePendingItem | null | undefined): item is ConciergePendingItem {
  return item?.use_case === "find_provider";
}

function cleanProviderSearchValue(value: string): string {
  return value.trim().replace(/[.\s]+$/g, "").trim();
}

function lineValueFromText(text: string, labels: string[]): string {
  const loweredLabels = labels.map((label) => label.toLowerCase());
  for (const line of text.split(/\r?\n/)) {
    const normalized = line.trim();
    const lower = normalized.toLowerCase();
    const label = loweredLabels.find((entry) => lower.startsWith(`${entry}:`));
    if (label) return cleanProviderSearchValue(normalized.slice(label.length + 1));
  }
  return "";
}

function providerSearchProviderName(item: ConciergePendingItem, isSpanish = false): string {
  const payload = item.action_payload;
  const payloadName = payloadString(payload, ["provider_name", "selected_provider_name", "name"]);
  if (payloadName) return cleanProviderSearchValue(payloadName);

  const providerName = item.provider_name?.trim() ?? "";
  const genericProvider = providerName && !/^(vyva review|selected provider|proveedor seleccionado)$/i.test(providerName)
    ? providerName
    : "";
  if (genericProvider) return cleanProviderSearchValue(genericProvider);

  const summaryMatch = item.action_summary.match(/(?:Provider search prepared|Busqueda de proveedor preparada):\s*(.+)$/i);
  if (summaryMatch?.[1]) return cleanProviderSearchValue(summaryMatch[1]);

  const draft = payloadString(payload, ["draft_message", "message", "body", "reason", "detail"]);
  const draftMatch = draft.match(/(?:prepare contact with|preparar el contacto con)\s+([^\n.]+)/i);
  if (draftMatch?.[1]) return cleanProviderSearchValue(draftMatch[1]);

  return isSpanish ? "Proveedor" : "Provider";
}

function providerSearchCategoryFromAction(item: ConciergePendingItem): ConciergeProviderCategoryId {
  const payload = item.action_payload;
  const explicit = payloadString(payload, ["provider_category", "category", "setup_focus", "provider_type"]);
  const typeLabel = lineValueFromText(payloadString(payload, ["draft_message", "message", "body"]), ["Type", "Tipo"]);
  const priority = [explicit, typeLabel].join(" ").toLowerCase();
  if (/personal care|care home|residence|care|cuidado personal|residencia|centro de cuidado/.test(priority)) return "personal_care";
  if (/doctor|clinic|specialist|medical|medic|clinica|especialista|salud/.test(priority)) return "doctor_clinic";
  if (/pharmacy|farmacia/.test(priority)) return "pharmacy";
  if (/taxi|transport|ride|driver|transporte|conductor/.test(priority)) return "transport";
  if (/home service|plumber|electrician|repair|cleaner|servicio en casa|fontaner|electricista|reparacion|limpieza/.test(priority)) return "home_service";
  if (/restaurant|food|meal|comida|restaurante/.test(priority)) return "food";

  const haystack = [
    explicit,
    typeLabel,
    item.action_summary,
    payloadString(payload, ["draft_message", "message", "body"]),
  ].join(" ").toLowerCase();

  if (/pharmacy|farmacia/.test(haystack)) return "pharmacy";
  if (/taxi|transport|ride|driver|transporte|conductor/.test(haystack)) return "transport";
  if (/home service|plumber|electrician|repair|cleaner|servicio en casa|fontaner|electricista|reparacion|limpieza/.test(haystack)) return "home_service";
  if (/restaurant|food|meal|comida|restaurante/.test(haystack)) return "food";
  if (/personal care|care home|residence|care|cuidado personal|residencia|centro de cuidado/.test(haystack)) return "personal_care";
  if (/doctor|clinic|specialist|medical|medic|clinica|especialista|salud/.test(haystack)) return "doctor_clinic";
  return "other";
}

function providerSearchCategoryLabel(category: ConciergeProviderCategoryId, isSpanish: boolean): string {
  const labels: Record<ConciergeProviderCategoryId, { en: string; es: string }> = {
    pharmacy: { en: "Pharmacy", es: "Farmacia" },
    doctor_clinic: { en: "Doctor / Clinic", es: "Doctor / clinica" },
    transport: { en: "Transport / Taxi", es: "Transporte / taxi" },
    home_service: { en: "Home service", es: "Servicio en casa" },
    personal_care: { en: "Personal care", es: "Cuidado personal" },
    food: { en: "Restaurant / Food", es: "Restaurante / comida" },
    other: { en: "Other", es: "Otro" },
  };
  return isSpanish ? labels[category].es : labels[category].en;
}

function providerSearchActionDetails(item: ConciergePendingItem, isSpanish: boolean): {
  providerName: string;
  category: ConciergeProviderCategoryId;
  categoryLabel: string;
  criteria: string;
  contact: string;
} {
  const payload = item.action_payload;
  const draft = payloadString(payload, ["draft_message", "message", "body"]);
  const category = providerSearchCategoryFromAction(item);
  const criteria = payloadString(payload, ["criteria", "chosen_criteria"]) ||
    lineValueFromText(draft, ["Chosen criteria", "Criterios elegidos", "Criterios"]);
  const contact = payloadString(payload, [
    "provider_phone",
    "phone",
    "provider_email",
    "email",
    "provider_whatsapp",
    "whatsapp",
    "booking_url",
  ]) || lineValueFromText(draft, ["Available contact", "Contacto disponible"]);
  return {
    providerName: providerSearchProviderName(item, isSpanish),
    category,
    categoryLabel: providerSearchCategoryLabel(category, isSpanish),
    criteria: cleanProviderSearchValue(criteria),
    contact: cleanProviderSearchValue(contact),
  };
}

type ProviderRecoverySearchPlan = {
  mode: ProviderSearchMode;
  query: string;
  criteria: ProviderSearchCriterionKey[];
  notice: string;
};

function providerRecoveryModeFromCategory(category: ConciergeProviderCategoryId): ProviderSearchMode {
  if (category === "transport") return "transport";
  if (category === "pharmacy") return "pharmacy";
  if (category === "home_service") return "home-service";
  if (category === "doctor_clinic") return "specialist";
  if (category === "personal_care") return "personal-care";
  return "care";
}

function providerUnavailableRecoveryPlan(item: ConciergePendingItem, isSpanish: boolean): ProviderRecoverySearchPlan {
  const payload = item.action_payload;
  const failedProvider = providerSearchProviderName(item, isSpanish) || item.provider_name?.trim() || "";
  const avoidLine = failedProvider
    ? (isSpanish ? `Evita este proveedor: ${failedProvider}.` : `Avoid this provider: ${failedProvider}.`)
    : "";
  const safeEnd = isSpanish
    ? "Prepara opciones verificables. No contactes, reserves ni compartas datos sin mi confirmacion."
    : "Prepare verifiable options. Do not contact, book, or share details without my confirmation.";

  if (item.use_case === "book_ride") {
    const destination = payloadString(payload, ["destination_address", "destination", "dropoff_address", "to"]);
    const pickup = payloadString(payload, ["pickup_address", "pickup", "start_location", "origin_address", "from"]);
    const requestedTime = payloadString(payload, ["requested_time", "scheduled_for", "scheduled_time", "time"]);
    const mobilityNeeds = stringList(payload?.mobility_needs).join(", ");
    const query = isSpanish
      ? [
        "Busca otro transporte para este viaje.",
        destination ? `Destino: ${destination}.` : "",
        pickup ? `Recogida: ${pickup}.` : "",
        requestedTime ? `Hora: ${requestedTime}.` : "",
        mobilityNeeds ? `Ayuda necesaria: ${mobilityNeeds}.` : "",
        avoidLine,
        "Prioriza cercania, disponibilidad, precio claro y acceso facil.",
        safeEnd,
      ].filter(Boolean).join(" ")
      : [
        "Find another transport option for this ride.",
        destination ? `Destination: ${destination}.` : "",
        pickup ? `Pickup: ${pickup}.` : "",
        requestedTime ? `Time: ${requestedTime}.` : "",
        mobilityNeeds ? `Help needed: ${mobilityNeeds}.` : "",
        avoidLine,
        "Prioritize proximity, availability, clear price, and easy access.",
        safeEnd,
      ].filter(Boolean).join(" ");
    return {
      mode: "transport",
      query,
      criteria: ["nearby", "available-soon", "accessible", "clear-price", "reputation"],
      notice: isSpanish ? "Busqueda de transporte preparada con los mismos detalles." : "Transport search prepared with the same details.",
    };
  }

  if (item.use_case === "order_medicine") {
    const itemText = payloadString(payload, ["item_text", "items", "item", "product_name", "medicine_name"]);
    const fulfillment = payloadString(payload, ["fulfillment_preference", "fulfillment", "delivery_preference"]);
    const requestedTime = payloadString(payload, ["requested_time", "scheduled_for", "scheduled_time", "time"]);
    const notes = payloadString(payload, ["notes", "note", "brand", "quantity", "special_requests"]);
    const query = isSpanish
      ? [
        "Busca otra farmacia para producto sin receta.",
        itemText ? `Producto: ${itemText}.` : "",
        fulfillment ? `Preferencia: ${fulfillment}.` : "",
        requestedTime ? `Cuando: ${requestedTime}.` : "",
        notes ? `Notas: ${notes}.` : "",
        avoidLine,
        "Prioriza stock, entrega o recogida clara, cercania y precio claro.",
        safeEnd,
      ].filter(Boolean).join(" ")
      : [
        "Find another pharmacy for an over-the-counter item.",
        itemText ? `Item: ${itemText}.` : "",
        fulfillment ? `Preference: ${fulfillment}.` : "",
        requestedTime ? `When: ${requestedTime}.` : "",
        notes ? `Notes: ${notes}.` : "",
        avoidLine,
        "Prioritize stock, clear delivery or pickup, proximity, and clear price.",
        safeEnd,
      ].filter(Boolean).join(" ");
    return {
      mode: "pharmacy",
      query,
      criteria: ["nearby", "available-soon", "clear-price", "reputation"],
      notice: isSpanish ? "Busqueda de farmacia preparada con el producto original." : "Pharmacy search prepared with the original item.",
    };
  }

  if (isHomeServicePendingAction(item)) {
    const serviceType = payloadString(payload, ["service_type", "service_label", "provider_type", "issue_type", "service_needed"]);
    const problem = payloadString(payload, ["problem_summary", "issue_summary", "service_needed", "reason", "detail"]);
    const urgency = payloadString(payload, ["urgency", "priority", "requested_time"]);
    const location = payloadString(payload, ["location", "address", "home_address"]);
    const query = isSpanish
      ? [
        "Busca otro proveedor de servicio en casa.",
        serviceType ? `Tipo: ${serviceType}.` : "",
        problem ? `Problema: ${problem}.` : "",
        urgency ? `Urgencia: ${urgency}.` : "",
        location ? `Lugar: ${location}.` : "",
        avoidLine,
        "Prioriza disponibilidad, buenas opiniones, precio claro y facilidad para personas mayores.",
        safeEnd,
      ].filter(Boolean).join(" ")
      : [
        "Find another home-service provider.",
        serviceType ? `Type: ${serviceType}.` : "",
        problem ? `Problem: ${problem}.` : "",
        urgency ? `Urgency: ${urgency}.` : "",
        location ? `Location: ${location}.` : "",
        avoidLine,
        "Prioritize availability, good reputation, clear price, and senior-friendly service.",
        safeEnd,
      ].filter(Boolean).join(" ");
    return {
      mode: "home-service",
      query,
      criteria: ["available-soon", "reputation", "clear-price", "accessible"],
      notice: isSpanish ? "Busqueda de servicio preparada con el problema original." : "Home-service search prepared with the original problem.",
    };
  }

  if (item.use_case === "book_appointment") {
    const reason = payloadString(payload, ["appointment_reason", "reason", "detail", "notes"]);
    const appointmentType = payloadString(payload, ["appointment_type", "type"]);
    const requestedTime = payloadString(payload, ["requested_time", "preferred_time", "scheduled_for", "time"]);
    const location = payloadString(payload, ["location", "address", "area"]);
    const query = isSpanish
      ? [
        "Busca otro medico o clinica para esta cita.",
        appointmentType ? `Tipo: ${appointmentType}.` : "",
        reason ? `Motivo: ${reason}.` : "",
        requestedTime ? `Preferencia de hora: ${requestedTime}.` : "",
        location ? `Zona: ${location}.` : "",
        avoidLine,
        "Prioriza cercania, reputacion, acceso, disponibilidad y cobertura si aplica.",
        safeEnd,
      ].filter(Boolean).join(" ")
      : [
        "Find another doctor or clinic for this appointment.",
        appointmentType ? `Type: ${appointmentType}.` : "",
        reason ? `Reason: ${reason}.` : "",
        requestedTime ? `Preferred time: ${requestedTime}.` : "",
        location ? `Area: ${location}.` : "",
        avoidLine,
        "Prioritize proximity, reputation, access, availability, and coverage if relevant.",
        safeEnd,
      ].filter(Boolean).join(" ");
    return {
      mode: "specialist",
      query,
      criteria: ["nearby", "reputation", "accessible", "available-soon", "coverage"],
      notice: isSpanish ? "Busqueda de cita alternativa preparada." : "Alternative appointment search prepared.",
    };
  }

  const details = providerSearchActionDetails(item, isSpanish);
  const query = isSpanish
    ? [
      `Busca otra opcion parecida a ${details.providerName}.`,
      `Categoria: ${details.categoryLabel}.`,
      details.criteria ? `Mantener criterios: ${details.criteria}.` : "Prioriza cercania, reputacion, acceso y precio claro.",
      avoidLine,
      safeEnd,
    ].filter(Boolean).join(" ")
    : [
      `Find another option similar to ${details.providerName}.`,
      `Category: ${details.categoryLabel}.`,
      details.criteria ? `Keep criteria: ${details.criteria}.` : "Prioritize proximity, reputation, access, and clear price.",
      avoidLine,
      safeEnd,
    ].filter(Boolean).join(" ");
  return {
    mode: providerRecoveryModeFromCategory(details.category),
    query,
    criteria: DEFAULT_PROVIDER_SEARCH_CRITERIA,
    notice: isSpanish ? "Busqueda alternativa preparada." : "Alternative search prepared.",
  };
}

function ConciergeActionTimeline({ status }: { status: ConciergeFollowThroughStatus }) {
  return (
    <div
      className="mt-4 rounded-[18px] border border-[#E9D5FF] bg-[#FBF8FF] p-3"
      data-testid="panel-concierge-action-timeline"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-vyva-purple shadow-sm">
          <PackageCheck size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.12em] text-vyva-purple">
            {status.eyebrow}
          </span>
          <span className="mt-0.5 block font-body text-[15px] font-black leading-tight text-vyva-text-1">
            {status.title}
          </span>
          <span className="mt-0.5 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {status.helper}
          </span>
        </span>
      </div>
      <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {status.steps.map((step, index) => {
          const isDone = step.state === "done";
          const isActive = step.state === "active";
          const isWarning = step.state === "warning";
          return (
            <li
              key={step.id}
              data-testid={`timeline-step-${step.id}`}
              data-state={step.state}
              className={`flex min-h-[58px] items-start gap-3 rounded-[14px] border px-3 py-2 ${
                isWarning
                  ? "border-[#FCA5A5] bg-[#FEF2F2]"
                  : isActive
                    ? "border-[#C4B5FD] bg-white"
                    : isDone
                      ? "border-[#BBF7D0] bg-[#F8FFFC]"
                      : "border-transparent bg-white/60"
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-body text-[11px] font-black ${
                  isWarning
                    ? "bg-[#FEE2E2] text-[#B91C1C]"
                    : isActive
                      ? "bg-vyva-purple text-white"
                      : isDone
                        ? "bg-[#ECFDF5] text-[#047857]"
                        : "bg-[#F3F4F6] text-vyva-text-3"
                }`}
              >
                {isDone ? <CircleCheck size={13} /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-body text-[13px] font-black leading-tight text-vyva-text-1">
                  {step.label}
                </span>
                <span className="mt-0.5 block font-body text-[11px] font-semibold leading-snug text-vyva-text-2">
                  {step.helper}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ConciergeExecutionStatusPanel({
  summary,
  update,
  missionPresentation,
}: {
  summary: ConciergeExecutionStatusSummary;
  update?: ConciergeUserUpdateSummary | null;
  missionPresentation?: TrustedHelpMissionPresentation | null;
}) {
  const display = update ?? {
    ...summary,
    detail: "",
    chips: [] as string[],
  };
  const toneClasses: Record<ConciergeExecutionTone, string> = {
    purple: "border-[#E9D5FF] bg-[#FBF8FF] text-vyva-purple",
    blue: "border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1]",
    green: "border-[#BBF7D0] bg-[#F8FFFC] text-[#047857]",
    amber: "border-[#FED7AA] bg-[#FFFBEB] text-[#A16207]",
    red: "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]",
  };
  const Icon = display.tone === "green"
    ? CircleCheck
    : display.tone === "red"
      ? AlertTriangle
      : PackageCheck;

  return (
    <div
      className={`mt-4 rounded-[18px] border px-3 py-2.5 ${toneClasses[display.tone]}`}
      data-phase={display.phase}
      data-presentation-step={missionPresentation?.stepId}
      data-presentation-status={missionPresentation?.status}
      data-presentation-family={missionPresentation?.presentationFamilyId}
      data-external-action-boundary={missionPresentation?.externalActionBoundary}
      data-testid="panel-concierge-execution-status"
    >
      <div className="flex items-start gap-3" data-testid="panel-concierge-user-update">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/80">
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-body text-[14px] font-black leading-tight text-vyva-text-1">
            {display.label}
          </span>
          <span className="mt-0.5 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {display.helper}
          </span>
          {display.detail ? (
            <span className="mt-1 block font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
              {display.detail}
            </span>
          ) : null}
        </span>
      </div>
      {display.chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {display.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-white/80 px-3 py-1 font-body text-[11px] font-black text-current shadow-sm"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getUseCaseLabel(useCase: string, locale = "es"): string {
  const es = locale.startsWith("es");
  switch (useCase) {
    case "book_ride":
      return es ? "Taxi" : "Ride";
    case "order_medicine":
      return es ? "Medicacion" : "Medicine";
    case "book_appointment":
      return es ? "Cita medica" : "Appointment";
    case "find_provider":
      return es ? "Busqueda de proveedor" : "Provider search";
    case "admin_task":
      return es ? "Gestion administrativa" : "Admin task";
    case "scam_check":
      return es ? "Revision de seguridad" : "Scam check";
    case "paperwork":
      return es ? "Papeleo" : "Paperwork";
    case "send_message":
      return es ? "Mensaje" : "Message";
    case "shopping_request":
      return es ? "Compra" : "Shopping";
    default:
      return useCase.replace(/_/g, " ");
  }
}

function getPendingActionUseCaseLabel(item: ConciergePendingItem, locale = "es"): string {
  const es = locale.startsWith("es");
  if (isHomeServicePendingAction(item)) return es ? "Servicio en casa" : "Home service";
  if (payloadString(item.action_payload, ["flow_reference"]) === CARE_NAVIGATION_FLOW_REFERENCE) {
    return es ? "Opciones de cuidado" : "Care options";
  }
  return getUseCaseLabel(item.use_case, locale);
}

type BrowserSpeechRecognitionEvent = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window & typeof globalThis & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

export type ConciergeScreenMode = "legacy" | "home" | "task";

type ConciergeScreenProps = {
  mode?: ConciergeScreenMode;
};

const ConciergeScreen = ({ mode = "legacy" }: ConciergeScreenProps) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { taskId } = useParams<{ taskId: string }>();
  const taskEntry = useMemo(
    () => coerceConciergeTaskEntry((location.state as ConciergeLocationState)?.conciergeTaskEntry),
    [location.state],
  );
  const crossPillarIdempotencyKey = useMemo(() => {
    const value = (location.state as ConciergeLocationState)?.crossPillarIdempotencyKey;
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }, [location.state]);
  const locale = language.split("-")[0].toLowerCase();
  const isSpanish = locale === "es";
  const autoStartVoice = useRouteVoiceAutoStart();
  const queryClient = useQueryClient();
  const persistedTaskQuery = useQuery({
    queryKey: ["/api/concierge/tasks", taskId],
    queryFn: () => fetchConciergeTaskDraft(taskId!),
    enabled: mode === "task" && isPersistedConciergeTaskId(taskId),
    retry: false,
  });
  const persistedTask = persistedTaskQuery.data ?? null;
  const effectiveTaskEntry = useMemo(
    () => taskEntry ?? coerceConciergeTaskEntry(persistedTask?.entry_payload),
    [persistedTask?.entry_payload, taskEntry],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasRestoredHistory, setHasRestoredHistory] = useState(false);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [visibleActionId, setVisibleActionId] = useState<string | null>(null);
  const [isRightNowHidden, setIsRightNowHidden] = useState(false);
  const [providerWaitingClockMs, setProviderWaitingClockMs] = useState(() => Date.now());
  const [selectedCompletedSessionId, setSelectedCompletedSessionId] = useState<string | null>(null);
  const [externalConfirmationRequest, setExternalConfirmationRequest] = useState<ConciergeExternalConfirmationRequest | null>(null);
  const [guidedDetailDraft, setGuidedDetailDraft] = useState("");
  const [guidedDetailNotice, setGuidedDetailNotice] = useState<string | null>(null);
  const [guidedDetailError, setGuidedDetailError] = useState<string | null>(null);
  const [providerReplyMode, setProviderReplyMode] = useState<ProviderReplyMode>(null);
  const [providerReplyForm, setProviderReplyForm] = useState<ProviderReplyForm>(EMPTY_PROVIDER_REPLY_FORM);
  const [providerReplyNotice, setProviderReplyNotice] = useState<string | null>(null);
  const [providerReplyError, setProviderReplyError] = useState<string | null>(null);
  const [bookingFormOutcomeForm, setBookingFormOutcomeForm] = useState<BookingFormOutcomeForm>(EMPTY_BOOKING_FORM_OUTCOME_FORM);
  const [bookingFormNotice, setBookingFormNotice] = useState<string | null>(null);
  const [bookingFormError, setBookingFormError] = useState<string | null>(null);
  const [phoneCallOutcomeForm, setPhoneCallOutcomeForm] = useState<PhoneCallOutcomeForm>(EMPTY_PHONE_CALL_OUTCOME_FORM);
  const [phoneCallOutcomeNotice, setPhoneCallOutcomeNotice] = useState<string | null>(null);
  const [phoneCallOutcomeError, setPhoneCallOutcomeError] = useState<string | null>(null);
  const [emailDraftOutcomeForm, setEmailDraftOutcomeForm] = useState<EmailDraftOutcomeForm>(EMPTY_EMAIL_DRAFT_OUTCOME_FORM);
  const [emailDraftNotice, setEmailDraftNotice] = useState<string | null>(null);
  const [recentEmailDraftCompletion, setRecentEmailDraftCompletion] = useState<{ actionId: string; notice: string } | null>(null);
  const [emailDraftError, setEmailDraftError] = useState<string | null>(null);
  const [whatsAppDraftOutcomeForm, setWhatsAppDraftOutcomeForm] = useState<WhatsAppDraftOutcomeForm>(EMPTY_WHATSAPP_DRAFT_OUTCOME_FORM);
  const [whatsAppDraftNotice, setWhatsAppDraftNotice] = useState<string | null>(null);
  const [whatsAppDraftError, setWhatsAppDraftError] = useState<string | null>(null);
  const [manualReviewOutcomeForm, setManualReviewOutcomeForm] = useState<ManualReviewOutcomeForm>(EMPTY_MANUAL_REVIEW_OUTCOME_FORM);
  const [manualReviewNotice, setManualReviewNotice] = useState<string | null>(null);
  const [manualReviewError, setManualReviewError] = useState<string | null>(null);
  const [dryRunOutcomeNotice, setDryRunOutcomeNotice] = useState<string | null>(null);
  const [dryRunOutcomeError, setDryRunOutcomeError] = useState<string | null>(null);
  const [confirmedReviewActionIds, setConfirmedReviewActionIds] = useState<Set<string>>(() => new Set());
  const [focusedDetailTarget, setFocusedDetailTarget] = useState<ConciergeFocusedDetailTarget | null>(null);
  const reqIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLElement>(null);
  const rightNowSectionRef = useRef<HTMLElement>(null);
  const guidedDetailPanelRef = useRef<HTMLDivElement>(null);
  const currentLocaleRef = useRef(language);
  const saveReadyRef = useRef(false);
  const billInputRef = useRef<HTMLInputElement>(null);
  const lastAppliedConciergeVoiceActionRef = useRef<string | null>(null);
  const lastAppliedConciergeTaskEntryRef = useRef<string | null>(null);
  const taskCreationStartedRef = useRef(false);
  const hydratedConciergeTaskIdRef = useRef<string | null>(null);
  const lastSavedConciergeTaskHashRef = useRef<string | null>(null);
  const lastRoutePrefillKeyRef = useRef<string | null>(null);
  const lastCompletedTemplateKeyRef = useRef<string | null>(null);
  const lastProviderRouteActionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== "task" || taskId !== "new" || !taskEntry || taskCreationStartedRef.current) return;
    taskCreationStartedRef.current = true;
    void createConciergeTaskDraft({
      entry: taskEntry,
      language: locale,
      idempotencyKey: crossPillarIdempotencyKey,
    })
      .then((createdTask) => {
        queryClient.setQueryData(["/api/concierge/tasks", createdTask.id], createdTask);
        void queryClient.invalidateQueries({ queryKey: ["/api/concierge/tasks"] });
        navigate(conciergeTaskPath(createdTask.id), { replace: true, state: null });
      })
      .catch(() => {
        taskCreationStartedRef.current = false;
        setChatError(isSpanish ? "No he podido guardar esta tarea." : "I could not save this task.");
      });
  }, [crossPillarIdempotencyKey, isSpanish, locale, mode, navigate, queryClient, taskEntry, taskId]);

  useEffect(() => {
    if (!(persistedTaskQuery.error instanceof ConciergeTaskNoLongerActiveError)) return;
    navigate("/concierge", {
      replace: true,
      state: {
        notice: isSpanish
          ? "Esta tarea ya esta cerrada."
          : "This task is already closed.",
      },
    });
  }, [isSpanish, navigate, persistedTaskQuery.error]);

  useEffect(() => {
    const timer = window.setInterval(() => setProviderWaitingClockMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const lastTrustedProviderSavedKeyRef = useRef<string | null>(null);
  const lastProviderSetupHelpRequestedKeyRef = useRef<string | null>(null);

  const [appointmentOpen, setAppointmentOpen] = useState(() => (
    mode === "task" && (taskEntry?.kind === "appointment" || taskEntry?.kind === "home_service")
  ));
  const [appointmentNote, setAppointmentNote] = useState("");
  const [homeServiceType, setHomeServiceType] = useState<HomeServiceType | null>(null);
  const [homeServiceIntakeOrigin, setHomeServiceIntakeOrigin] = useState<ServiceIntakeOrigin>("app");
  const [homeServiceIntakeAnswers, setHomeServiceIntakeAnswers] = useState<Record<string, string>>({});
  const [homeServiceTextDrafts, setHomeServiceTextDrafts] = useState<Record<string, string>>({});
  const [homeServiceCanvasMode, setHomeServiceCanvasMode] = useState(false);
  const [homeServiceCanvasStep, setHomeServiceCanvasStep] = useState<ConciergeHomeServiceCanvasStep | null>(null);
  const [homeServiceCanvasRevision, setHomeServiceCanvasRevision] = useState(1);
  const [homeServiceCanvasPhoto, setHomeServiceCanvasPhoto] = useState<HomeServiceCanvasPhoto | null>(null);
  const [homeServiceCanvasPhotoName, setHomeServiceCanvasPhotoName] = useState("");
  const [homeServiceCanvasError, setHomeServiceCanvasError] = useState<string | null>(null);
  const homeServiceActionGate = useCanvasExternalActionGate();
  const homeServiceCanvasRolloutQuery = useQuery({
    queryKey: ["/api/config/features/home-service-voice-canvas"],
    queryFn: async () => {
      const response = await apiFetch("/api/config/features/home-service-voice-canvas");
      return response.ok ? parseHomeServiceCanvasRolloutConfig(await response.json()) : { enabled: false, rolloutPercent: 0 };
    },
    staleTime: 0,
    refetchInterval: 10_000,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  const homeServiceCanvasEnabled = isHomeServiceCanvasEnabled(homeServiceCanvasRolloutQuery.data, location.key || "anonymous");
  useEffect(() => {
    if (homeServiceCanvasEnabled || !homeServiceCanvasMode) return;
    homeServiceActionGate.invalidate();
    setHomeServiceCanvasMode(false);
    setHomeServiceCanvasStep(null);
    clearVoiceCanvasScene({ owner: "concierge_home_service" });
  }, [homeServiceActionGate, homeServiceCanvasEnabled, homeServiceCanvasMode]);
  const homeServiceDraftRestoreAppliedRef = useRef(false);
  const advanceHomeServiceCanvas = useCallback((step: ConciergeHomeServiceCanvasStep) => {
    setHomeServiceCanvasStep(step);
    setHomeServiceCanvasRevision((revision) => revision + 1);
  }, []);
  const [appointmentRequest, setAppointmentRequest] = useState<AppointmentRequestItem | null>(null);
  const [appointmentOptions, setAppointmentOptions] = useState<AppointmentProviderOption[]>([]);
  const [appointmentDiscovery, setAppointmentDiscovery] = useState<AppointmentDiscoveryMeta | null>(null);
  const [selectedAppointmentOptionId, setSelectedAppointmentOptionId] = useState<string | null>(null);
  const [selectedAppointmentChip, setSelectedAppointmentChip] = useState<(typeof APPOINTMENT_TYPE_CHIPS)[number] | null>(() => {
    if (mode !== "task") return null;
    const initialKey = taskEntry?.kind === "home_service" ? "home-service" : taskEntry?.appointmentKind;
    return APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === initialKey) ?? null;
  });
  const [appointmentAttemptResult, setAppointmentAttemptResult] = useState<AppointmentAttemptResponse | null>(null);
  const [appointmentControlMode, setAppointmentControlMode] = useState<"listening" | "muted" | "stopped">("listening");
  const [homeServiceGuideOpen, setHomeServiceGuideOpen] = useState(false);
  const [homeServiceGuideDismissed, setHomeServiceGuideDismissed] = useState(false);
  const [homeServiceGuideNeverShow, setHomeServiceGuideNeverShow] = useState(false);
  const [homeServiceGuideHidden, setHomeServiceGuideHidden] = useState(() => {
    try {
      return localStorage.getItem(HOME_SERVICE_GUIDE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [appointmentNotice, setAppointmentNotice] = useState<string | null>(null);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [coverageType, setCoverageType] = useState<CoverageReadinessType>("public");
  const [coverageProvider, setCoverageProvider] = useState("");
  const [coverageMemberId, setCoverageMemberId] = useState("");
  const [coveragePlan, setCoveragePlan] = useState("");
  const [coverageNotes, setCoverageNotes] = useState("");
  const [coverageNotice, setCoverageNotice] = useState<string | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [appointmentBookedForm, setAppointmentBookedForm] = useState({
    scheduledFor: "",
    location: "",
    providerReply: "",
    reference: "",
    notes: "",
  });
  const [appointmentCanvasMode, setAppointmentCanvasMode] = useState(false);
  const [appointmentCanvasStep, setAppointmentCanvasStep] = useState<ConciergeAppointmentCanvasStep | null>(null);
  const [appointmentCanvasRevision, setAppointmentCanvasRevision] = useState(1);
  const [appointmentCanvasRequestedTime, setAppointmentCanvasRequestedTime] = useState("");
  const [appointmentCanvasCoverageLabel, setAppointmentCanvasCoverageLabel] = useState("");
  const advanceAppointmentCanvas = useCallback((step: ConciergeAppointmentCanvasStep) => {
    setAppointmentCanvasStep(step);
    setAppointmentCanvasRevision((revision) => revision + 1);
  }, []);
  const [routePrefill, setRoutePrefill] = useState<ConciergeRoutePrefill | null>(() => (
    mode === "task" && taskEntry?.kind === "transport"
      ? {
          kind: "ride",
          message: t(
            "concierge.fastHelp.ridePrefill",
            "Please help me find safe transport options. Ask for destination and timing, prepare clear options, and do not book anything without my confirmation.",
          ),
          source: "home_quick_action",
        }
      : null
  ));
  const [routePrefillError, setRoutePrefillError] = useState<string | null>(null);
  const [trustedProviderResume, setTrustedProviderResume] = useState<TrustedProviderSavedRoute | null>(null);
  const [providerSetupHelpRequest, setProviderSetupHelpRequest] = useState<ProviderSetupHelpRequestedRoute | null>(null);
  const [transportPickup, setTransportPickup] = useState("");
  const [transportDestination, setTransportDestination] = useState("");
  const [transportTime, setTransportTime] = useState("now");
  const [transportMobilityNeeds, setTransportMobilityNeeds] = useState<string[]>([]);
  const [transportDetailsOpen, setTransportDetailsOpen] = useState(() => mode === "task" && taskEntry?.kind === "transport");
  const [transportResult, setTransportResult] = useState<TransportOptionsResponse | null>(null);
  const [transportPreparedOption, setTransportPreparedOption] = useState<TransportOption | null>(null);
  const [transportPreparedResult, setTransportPreparedResult] = useState<TransportPreparedResponse | null>(null);
  const [rideCanvasMode, setRideCanvasMode] = useState(false);
  const [rideCanvasStep, setRideCanvasStep] = useState<ConciergeRideCanvasStep | null>(null);
  const [rideCanvasRevision, setRideCanvasRevision] = useState(1);
  const [rideCanvasSelectedOptionId, setRideCanvasSelectedOptionId] = useState<string | null>(null);
  const advanceRideCanvas = useCallback((step: ConciergeRideCanvasStep) => {
    setRideCanvasStep(step);
    setRideCanvasRevision((revision) => revision + 1);
  }, []);
  const [transportFinalForm, setTransportFinalForm] = useState({
    scheduledFor: "",
    pickup: "",
    destination: "",
    providerReply: "",
    priceEstimate: "",
    bookingReference: "",
    notes: "",
  });
  function resetTransportFinalReview() {
    setTransportPreparedOption(null);
    setTransportPreparedResult(null);
    setTransportFinalForm({
      scheduledFor: "",
      pickup: "",
      destination: "",
      providerReply: "",
      priceEstimate: "",
      bookingReference: "",
      notes: "",
    });
  }
  const [transportError, setTransportError] = useState<string | null>(null);
  const [transportNotice, setTransportNotice] = useState<string | null>(null);
  const [insuranceAdminOpen, setInsuranceAdminOpen] = useState(() => mode === "task" && taskEntry?.kind === "document");
  const [scamCheckOpen, setScamCheckOpen] = useState(() => mode === "task" && taskEntry?.kind === "scam_review");
  const [selectedScamCheckKind, setSelectedScamCheckKind] = useState<ScamCheckKind | null>(null);
  const [scamCheckDetail, setScamCheckDetail] = useState("");
  const [selectedInsuranceAdminKind, setSelectedInsuranceAdminKind] = useState<InsuranceAdminKind | null>(() => (
    mode === "task" && taskEntry?.kind === "document" ? taskEntry.documentKind ?? null : null
  ));
  const [insuranceAdminDetails, setInsuranceAdminDetails] = useState<InsuranceAdminDetails>({
    subject: "",
    recipient: "",
    deadline: "",
    notes: "",
  });
  const [otcPharmacyOpen, setOtcPharmacyOpen] = useState(() => mode === "task" && taskEntry?.kind === "otc_pharmacy");
  const [otcItemText, setOtcItemText] = useState("");
  const [otcFulfillmentPreference, setOtcFulfillmentPreference] = useState<"delivery" | "pickup">("delivery");
  const [otcRequestedTime, setOtcRequestedTime] = useState("today");
  const [otcNotes, setOtcNotes] = useState("");
  const [otcPreparedResult, setOtcPreparedResult] = useState<OtcPreparedResponse | null>(null);
  const [otcOutcomeForm, setOtcOutcomeForm] = useState({
    availability: "",
    costEstimate: "",
    fulfillmentNote: "",
    reference: "",
    notes: "",
  });
  function resetOtcOutcomeReview() {
    setOtcPreparedResult(null);
    setOtcOutcomeForm({
      availability: "",
      costEstimate: "",
      fulfillmentNote: "",
      reference: "",
      notes: "",
    });
  }
  const [otcNotice, setOtcNotice] = useState<string | null>(null);
  const [otcError, setOtcError] = useState<string | null>(null);

  useEffect(() => {
    if (!focusedDetailTarget) return;

    const targetTestId = CONCIERGE_DETAIL_FOCUS_TEST_IDS[focusedDetailTarget];
    let attempts = 0;
    let timeoutId: number | null = null;

    const focusTarget = () => {
      const target = document.querySelector<HTMLElement>(`[data-testid="${targetTestId}"]`);
      if (target) {
        target.focus();
        target.scrollIntoView?.({ behavior: "smooth", block: "center" });
        setFocusedDetailTarget(null);
        return;
      }

      attempts += 1;
      if (attempts >= 8) {
        setFocusedDetailTarget(null);
        return;
      }
      timeoutId = window.setTimeout(focusTarget, 80);
    };

    timeoutId = window.setTimeout(focusTarget, 80);

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [focusedDetailTarget]);

  const [offersOpen, setOffersOpen] = useState(() => mode === "task" && taskEntry?.kind === "provider_contact");
  const [savingsPanelView, setSavingsPanelView] = useState<SavingsPanelView>("overview");
  const [offersQuery, setOffersQuery] = useState(() => (
    mode === "task" && taskEntry?.kind === "provider_contact" ? taskEntry.query ?? "" : ""
  ));
  const [providerSearchMode, setProviderSearchMode] = useState<ProviderSearchMode | null>(() => (
    mode === "task" && taskEntry?.kind === "provider_contact" ? taskEntry.providerSearchMode ?? "specialist" : null
  ));
  const [providerSearchCriteria, setProviderSearchCriteria] = useState<ProviderSearchCriterionKey[]>(DEFAULT_PROVIDER_SEARCH_CRITERIA);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersResult, setOffersResult] = useState<OffersSearchResponse | null>(null);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [providerShortlistIds, setProviderShortlistIds] = useState<string[]>([]);
  const [providerShortlistNotice, setProviderShortlistNotice] = useState<string | null>(null);
  const [providerShortlistError, setProviderShortlistError] = useState<string | null>(null);
  const [editingProviderShortlistId, setEditingProviderShortlistId] = useState<string | null>(null);
  const [activeProviderShortlistNotice, setActiveProviderShortlistNotice] = useState<string | null>(null);
  const [activeProviderShortlistError, setActiveProviderShortlistError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "task" || !effectiveTaskEntry) return;
    const entryKey = JSON.stringify(effectiveTaskEntry);
    if (lastAppliedConciergeTaskEntryRef.current === entryKey) return;
    lastAppliedConciergeTaskEntryRef.current = entryKey;

    setInsuranceAdminOpen(effectiveTaskEntry.kind === "document");
    setScamCheckOpen(effectiveTaskEntry.kind === "scam_review");
    setOtcPharmacyOpen(effectiveTaskEntry.kind === "otc_pharmacy");
    setAppointmentOpen(effectiveTaskEntry.kind === "appointment" || effectiveTaskEntry.kind === "home_service");
    setOffersOpen(effectiveTaskEntry.kind === "provider_contact");

    if (effectiveTaskEntry.kind === "document") {
      setSelectedInsuranceAdminKind(effectiveTaskEntry.documentKind ?? null);
    } else if (effectiveTaskEntry.kind === "appointment" || effectiveTaskEntry.kind === "home_service") {
      const chipKey = effectiveTaskEntry.kind === "home_service" ? "home-service" : effectiveTaskEntry.appointmentKind;
      setSelectedAppointmentChip(APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === chipKey) ?? null);
    } else if (effectiveTaskEntry.kind === "provider_contact") {
      setProviderSearchMode(effectiveTaskEntry.providerSearchMode ?? "specialist");
      setOffersQuery(effectiveTaskEntry.query ?? "");
      setOffersError(null);
      setOffersResult(null);
    } else if (effectiveTaskEntry.kind === "transport") {
      const message = t(
        "concierge.fastHelp.ridePrefill",
        "Please help me find safe transport options. Ask for destination and timing, prepare clear options, and do not book anything without my confirmation.",
      );
      setRoutePrefill({ kind: "ride", message, source: "home_quick_action" });
      setTransportDetailsOpen(true);
      setTransportPickup((current) => current.trim() ? current : (isSpanish ? "Casa guardada" : "Saved home"));
      if (mode === "task" && persistedTask?.progress_payload.canvasStep) {
        setRideCanvasMode(true);
        setRideCanvasSelectedOptionId(persistedTask.progress_payload.selectedProviderOptionId ?? null);
        setRideCanvasStep(persistedTask.progress_payload.canvasStep as ConciergeRideCanvasStep);
      }
    }
  }, [effectiveTaskEntry, isSpanish, mode, persistedTask?.progress_payload.canvasStep, persistedTask?.progress_payload.selectedProviderOptionId, t]);

  useEffect(() => {
    if (!persistedTask || hydratedConciergeTaskIdRef.current === persistedTask.id) return;
    hydratedConciergeTaskIdRef.current = persistedTask.id;
    lastSavedConciergeTaskHashRef.current = JSON.stringify({
      progress: persistedTask.progress_payload,
      stage: persistedTask.stage,
    });
    const progress = persistedTask.progress_payload;

    if (persistedTask.kind === "document") {
      setInsuranceAdminOpen(true);
      setSelectedInsuranceAdminKind(progress.documentKind ?? effectiveTaskEntry?.documentKind ?? null);
      if (progress.documentDetails) setInsuranceAdminDetails(progress.documentDetails);
      return;
    }

    if (persistedTask.kind === "appointment") {
      setAppointmentOpen(true);
      const chipKey = progress.appointmentType ?? effectiveTaskEntry?.appointmentKind ?? "medical";
      setSelectedAppointmentChip(APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === chipKey) ?? APPOINTMENT_TYPE_CHIPS[0]);
      setAppointmentNote(progress.note ?? "");
      setAppointmentCanvasRequestedTime(progress.requestedTime ?? "");
      setAppointmentCanvasCoverageLabel(progress.coverageLabel ?? "");
      if (progress.canvasStep) {
        setAppointmentCanvasMode(true);
        setAppointmentCanvasStep(progress.canvasStep as ConciergeAppointmentCanvasStep);
      }
      setSelectedAppointmentOptionId(progress.selectedProviderOptionId ?? null);
      return;
    }

    if (persistedTask.kind === "home_service") {
      setAppointmentOpen(true);
      setSelectedAppointmentChip(APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === "home-service") ?? APPOINTMENT_TYPE_CHIPS[0]);
      setAppointmentNote(progress.note ?? "");
      setHomeServiceType(progress.serviceType ? normalizeHomeServiceType(progress.serviceType) : null);
      setHomeServiceIntakeOrigin(progress.origin ?? "app");
      setHomeServiceIntakeAnswers(progress.answers ?? {});
      setHomeServiceTextDrafts(progress.textDrafts ?? {});
      setHomeServiceCanvasPhotoName(progress.photoName ?? "");
      if (progress.canvasStep) {
        setHomeServiceCanvasMode(true);
        setHomeServiceCanvasStep(progress.canvasStep as ConciergeHomeServiceCanvasStep);
      }
      setSelectedAppointmentOptionId(progress.selectedProviderOptionId ?? null);
      return;
    }

    if (persistedTask.kind === "provider_contact") {
      setOffersOpen(true);
      setProviderSearchMode(isProviderSearchMode(progress.providerSearchMode)
        ? progress.providerSearchMode
        : effectiveTaskEntry?.providerSearchMode ?? "specialist");
      setOffersQuery(progress.query ?? effectiveTaskEntry?.query ?? "");
      setProviderSearchCriteria((progress.criteria ?? DEFAULT_PROVIDER_SEARCH_CRITERIA).filter(isProviderSearchCriterion));
      setOffersResult((progress.providerResult ?? null) as OffersSearchResponse | null);
      setProviderShortlistIds(progress.shortlistIds ?? []);
      return;
    }

    if (persistedTask.kind === "transport") {
      const pickupFallback = isSpanish ? "Casa guardada" : "Saved home";
      setRoutePrefill({
        kind: "ride",
        message: t(
          "concierge.fastHelp.ridePrefill",
          "Please help me find safe transport options. Ask for destination and timing, prepare clear options, and do not book anything without my confirmation.",
        ),
        source: "home_quick_action",
      });
      setTransportDetailsOpen(true);
      setTransportPickup(progress.textDrafts?.transportPickup || pickupFallback);
      setTransportDestination(progress.textDrafts?.transportDestination ?? "");
      setTransportTime(progress.requestedTime ?? "now");
      setTransportMobilityNeeds(splitRoutePayloadList(progress.answers?.transportMobilityNeeds ?? ""));
      setTransportResult(null);
      setTransportPreparedOption(null);
      setTransportPreparedResult(null);
      setRideCanvasSelectedOptionId(progress.selectedProviderOptionId ?? null);
      if (progress.canvasStep) {
        setRideCanvasMode(true);
        setRideCanvasStep(progress.canvasStep as ConciergeRideCanvasStep);
      }
    }
  }, [effectiveTaskEntry, isSpanish, persistedTask, t]);

  const savedConciergeTaskProgress = useMemo<ConciergeTaskProgressPayload>(() => {
    switch (effectiveTaskEntry?.kind) {
      case "document":
        return {
          documentKind: selectedInsuranceAdminKind,
          documentDetails: insuranceAdminDetails,
        };
      case "appointment":
        return {
          appointmentType: selectedAppointmentChip?.key ?? null,
          note: appointmentNote,
          requestedTime: appointmentCanvasRequestedTime,
          coverageLabel: appointmentCanvasCoverageLabel,
          canvasStep: appointmentCanvasStep,
          requestId: appointmentRequest?.id ?? null,
          selectedProviderOptionId: selectedAppointmentOptionId,
        };
      case "home_service":
        return {
          appointmentType: "home-service",
          note: appointmentNote,
          serviceType: homeServiceType,
          origin: homeServiceIntakeOrigin,
          answers: homeServiceIntakeAnswers,
          textDrafts: homeServiceTextDrafts,
          canvasStep: homeServiceCanvasStep,
          photoName: homeServiceCanvasPhotoName,
          requestId: appointmentRequest?.id ?? null,
          selectedProviderOptionId: selectedAppointmentOptionId,
        };
      case "transport":
        return {
          requestedTime: transportTime,
          canvasStep: rideCanvasStep,
          textDrafts: {
            transportPickup,
            transportDestination,
          },
          answers: {
            transportMobilityNeeds: transportMobilityNeeds.join("\n"),
          },
          requestId: transportPreparedResult?.pendingId ?? null,
          selectedProviderOptionId: rideCanvasSelectedOptionId,
        };
      case "provider_contact":
        return {
          providerSearchMode,
          query: offersQuery,
          criteria: providerSearchCriteria,
          providerResult: offersResult as unknown as Record<string, unknown> | null,
          shortlistIds: providerShortlistIds,
        };
      default:
        return {};
    }
  }, [
    appointmentCanvasCoverageLabel,
    appointmentCanvasRequestedTime,
    appointmentCanvasStep,
    appointmentNote,
    appointmentRequest?.id,
    effectiveTaskEntry?.kind,
    homeServiceCanvasPhotoName,
    homeServiceCanvasStep,
    homeServiceIntakeAnswers,
    homeServiceIntakeOrigin,
    homeServiceTextDrafts,
    homeServiceType,
    insuranceAdminDetails,
    offersQuery,
    offersResult,
    providerSearchCriteria,
    providerSearchMode,
    providerShortlistIds,
    rideCanvasSelectedOptionId,
    rideCanvasStep,
    selectedAppointmentChip?.key,
    selectedAppointmentOptionId,
    selectedInsuranceAdminKind,
    transportDestination,
    transportMobilityNeeds,
    transportPickup,
    transportPreparedResult?.pendingId,
    transportTime,
  ]);

  const savedConciergeTaskStage: PersistedConciergeTaskStage = persistedTask?.stage === "review"
    || persistedTask?.linked_pending_id
    || (effectiveTaskEntry?.kind === "transport" && Boolean(rideCanvasStep && !["destination", "pickup", "pickup_custom"].includes(rideCanvasStep)))
    || appointmentOptions.length > 0
    || offersResult
    || (effectiveTaskEntry?.kind === "document" && routePrefill)
    ? "review"
    : "details";

  useEffect(() => {
    if (!persistedTask || hydratedConciergeTaskIdRef.current !== persistedTask.id) return;
    const nextHash = JSON.stringify({ progress: savedConciergeTaskProgress, stage: savedConciergeTaskStage });
    if (nextHash === lastSavedConciergeTaskHashRef.current) return;
    const timer = window.setTimeout(() => {
      lastSavedConciergeTaskHashRef.current = nextHash;
      void updateConciergeTaskDraft({
        id: persistedTask.id,
        progress: savedConciergeTaskProgress,
        stage: savedConciergeTaskStage,
      }).then((updatedTask) => {
        queryClient.setQueryData(["/api/concierge/tasks", updatedTask.id], updatedTask);
        queryClient.setQueryData<ConciergeTaskDraft[]>(["/api/concierge/tasks"], (current) => (
          current?.map((task) => task.id === updatedTask.id ? updatedTask : task) ?? current
        ));
      }).catch(() => {
        lastSavedConciergeTaskHashRef.current = null;
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [persistedTask, queryClient, savedConciergeTaskProgress, savedConciergeTaskStage]);

  const providerComparisonOptions = useMemo(
    () => buildProviderComparisonOptions(offersResult?.options ?? []),
    [offersResult],
  );
  const [webSearchResultsByActionId, setWebSearchResultsByActionId] = useState<Record<string, WebSearchActionResult>>({});
  const [webSearchErrorsByActionId, setWebSearchErrorsByActionId] = useState<Record<string, string>>({});
  const [objectiveProofOpen, setObjectiveProofOpen] = useState(false);
  const [billAnalysis, setBillAnalysis] = useState<BillDocumentAnalysis | null>(null);
  const [billAnalysisLoading, setBillAnalysisLoading] = useState(false);
  const [billAnalysisError, setBillAnalysisError] = useState<string | null>(null);
  const [utilityMethod, setUtilityMethod] = useState<UtilityInputMethod | null>(null);
  const [utilityForm, setUtilityForm] = useState({ ...EMPTY_UTILITY_FORM });
  const [utilityVoiceAnswers, setUtilityVoiceAnswers] = useState<Record<string, string>>({});
  const [utilityVoiceStep, setUtilityVoiceStep] = useState(0);
  const [utilityVoiceDraft, setUtilityVoiceDraft] = useState("");
  const [utilityNormalized, setUtilityNormalized] = useState<NormalizedUtilityInput | null>(null);
  const [utilityResult, setUtilityResult] = useState<UtilityCompareResponse | null>(null);
  const [utilityLoading, setUtilityLoading] = useState(false);
  const [utilityError, setUtilityError] = useState<string | null>(null);
  const [utilityNotice, setUtilityNotice] = useState<string | null>(null);
  const {
    action: conciergeVoiceAction,
    payloadValue: conciergePayloadValue,
  } = useVoiceActionFulfillment({
    domain: "concierge",
    actionTypes: [
      "concierge.appointment_help",
      "concierge.home_service",
      "concierge.ride_booking",
      "concierge.reminder",
      "concierge.task",
    ],
  });
  const conciergeVoiceTaskType = conciergePayloadValue("task_type")
    || (conciergeVoiceAction?.actionType === "concierge.appointment_help" ? "appointment" : "");
  const conciergeVoiceProvider = conciergePayloadValue("provider") || conciergePayloadValue("provider_type");
  const conciergeVoiceDate = conciergePayloadValue("date_preference");
  const conciergeVoiceLocation = conciergePayloadValue("location");
  const conciergeVoicePickup = conciergePayloadValue("pickup");
  const conciergeVoiceDestination = conciergePayloadValue("destination");
  const conciergeVoiceTime = conciergePayloadValue("time")
    || conciergePayloadValue("date_preference")
    || conciergePayloadValue("reminder_time");
  const conciergeVoiceMobilityNeeds = conciergePayloadValue("mobility_needs");
  const conciergeVoiceReminderText = conciergePayloadValue("reminder_text");
  const conciergeVoiceReminderRecurrence = conciergePayloadValue("recurrence");
  const conciergeVoiceReason = conciergePayloadValue("appointment_reason") || conciergeVoiceAction?.extractedSubject || "";
  const conciergeVoiceServiceType = conciergePayloadValue("service_type")
    || conciergePayloadValue("provider_type")
    || conciergeVoiceProvider;
  const conciergeVoiceUrgency = conciergePayloadValue("urgency");
  const conciergeVoiceCriteria = conciergePayloadValue("criteria");
  const conciergeVoiceDraft = useMemo(() => {
    if (!conciergeVoiceAction) return "";
    const details = [
      conciergeVoiceTaskType ? `${isSpanish ? "tipo" : "type"}: ${conciergeVoiceTaskType}` : "",
      conciergeVoiceProvider ? `${isSpanish ? "proveedor" : "provider"}: ${conciergeVoiceProvider}` : "",
      conciergeVoiceServiceType ? `${isSpanish ? "servicio" : "service"}: ${conciergeVoiceServiceType}` : "",
      conciergeVoicePickup ? `${isSpanish ? "recogida" : "pickup"}: ${conciergeVoicePickup}` : "",
      conciergeVoiceDestination ? `${isSpanish ? "destino" : "destination"}: ${conciergeVoiceDestination}` : "",
      conciergeVoiceDate ? `${isSpanish ? "fecha" : "date"}: ${conciergeVoiceDate}` : "",
      conciergeVoiceTime ? `${isSpanish ? "hora" : "time"}: ${conciergeVoiceTime}` : "",
      conciergeVoiceLocation ? `${isSpanish ? "zona" : "location"}: ${conciergeVoiceLocation}` : "",
      conciergeVoiceReason ? `${isSpanish ? "motivo" : "reason"}: ${conciergeVoiceReason}` : "",
      conciergeVoiceReminderText ? `${isSpanish ? "recordatorio" : "reminder"}: ${conciergeVoiceReminderText}` : "",
      conciergeVoiceReminderRecurrence ? `${isSpanish ? "repeticion" : "recurrence"}: ${conciergeVoiceReminderRecurrence}` : "",
    ].filter(Boolean).join(", ");
    if (isSpanish) {
      return `Ayudame con ${conciergeVoiceAction.title.toLowerCase()}${details ? ` (${details})` : ""}. Prepara el siguiente paso y pideme confirmacion antes de actuar.`;
    }
    return `Help me with ${conciergeVoiceAction.title.toLowerCase()}${details ? ` (${details})` : ""}. Prepare the next step and ask me to confirm before acting.`;
  }, [
    conciergeVoiceAction,
    conciergeVoiceDate,
    conciergeVoiceDestination,
    conciergeVoiceLocation,
    conciergeVoicePickup,
    conciergeVoiceProvider,
    conciergeVoiceReason,
    conciergeVoiceReminderRecurrence,
    conciergeVoiceReminderText,
    conciergeVoiceServiceType,
    conciergeVoiceTime,
    conciergeVoiceTaskType,
    isSpanish,
  ]);
  const savedTransportPickupLabel = isSpanish ? "Casa guardada" : "Saved home";
  const rideCanvasCopy = useMemo<ConciergeRideCanvasCopy>(() => {
    const copy = (key: string, fallback: string) => String(t(`voiceCanvas.ride.${key}`, { defaultValue: fallback }));
    return {
      destinationTitle: copy("destinationTitle", "Where are you going?"),
      destinationHelper: copy("destinationHelper", "Say the place or type the address."),
      destinationLabel: copy("destinationLabel", "Destination"),
      destinationPlaceholder: copy("destinationPlaceholder", "Place or address"),
      continue: copy("continue", "Continue"),
      pickupTitle: copy("pickupTitle", "Where should we pick you up?"),
      pickupHelper: copy("pickupHelper", "Choose your saved home or another place."),
      savedHome: copy("savedHome", "Saved home"),
      savedHomeDescription: copy("savedHomeDescription", "Use the address in your profile"),
      anotherPickup: copy("anotherPickup", "Another place"),
      anotherPickupDescription: copy("anotherPickupDescription", "Say or type a different pickup"),
      pickupLabel: copy("pickupLabel", "Pickup place"),
      pickupPlaceholder: copy("pickupPlaceholder", "Pickup address"),
      timeTitle: copy("timeTitle", "When do you need the ride?"),
      timeHelper: copy("timeHelper", "Choose a time or tell VYVA."),
      now: copy("now", "Now"),
      today: copy("today", "Later today"),
      tomorrowMorning: copy("tomorrowMorning", "Tomorrow morning"),
      appointmentTime: copy("appointmentTime", "For an appointment"),
      anotherTime: copy("anotherTime", "Another time"),
      timeLabel: copy("timeLabel", "Pickup time"),
      timePlaceholder: copy("timePlaceholder", "For example, Friday at 10"),
      mobilityTitle: copy("mobilityTitle", "Any help for the journey?"),
      mobilityHelper: copy("mobilityHelper", "We only ask when this is not saved in your profile."),
      noMobilityNeeds: copy("noMobilityNeeds", "No extra help"),
      wheelchair: copy("wheelchair", "Wheelchair space"),
      doorHelp: copy("doorHelp", "Help at the door"),
      walkerOrCane: copy("walkerOrCane", "Walker or cane"),
      caregiverComing: copy("caregiverComing", "Someone is coming with me"),
      providerTitle: copy("providerTitle", "Add a trusted transport provider"),
      providerHelper: copy("providerHelper", "Save a taxi or transport contact before VYVA prepares the ride."),
      addProvider: copy("addProvider", "Add provider"),
      reviewTitle: copy("reviewTitle", "Check the ride details"),
      reviewHelper: copy("reviewHelper", "Nothing is booked or contacted yet."),
      pickup: copy("pickup", "Pickup"),
      destination: copy("destination", "Destination"),
      when: copy("when", "When"),
      mobility: copy("mobility", "Journey help"),
      provider: copy("provider", "Provider"),
      none: copy("none", "None"),
      compareRides: copy("compareRides", "Show ride options"),
      change: copy("change", "Change details"),
      optionsTitle: copy("optionsTitle", "Choose a ride option"),
      optionsHelper: copy("optionsHelper", "Review one option before VYVA prepares contact."),
      optionReviewTitle: copy("optionReviewTitle", "Prepare this ride?"),
      optionReviewHelper: copy("optionReviewHelper", "This prepares the request. It does not contact anyone."),
      prepareRide: copy("prepareRide", "Prepare ride"),
      back: copy("back", "Back"),
      detailTitle: copy("detailTitle", "One more detail"),
      detailHelper: copy("detailHelper", "Add this before reviewing the final confirmation."),
      confirmTitle: copy("confirmTitle", "Ready for your confirmation"),
      confirmHelper: copy("confirmHelper", "Only this final confirmation can start contact or booking."),
      confirmContact: copy("confirmContact", "Confirm and continue"),
      waitingTitle: copy("waitingTitle", "VYVA is preparing the next step"),
      waitingHelper: copy("waitingHelper", "You can minimize this and keep using the app."),
      completedTitle: copy("completedTitle", "Ride arranged"),
      completedHelper: copy("completedHelper", "The confirmed result is saved in Concierge."),
      errorTitle: copy("errorTitle", "The ride could not continue"),
      tryAgain: copy("tryAgain", "Try again"),
    };
  }, [t]);
  const appointmentCanvasCopy = useMemo<ConciergeAppointmentCanvasCopy>(() => {
    const copy = (key: string, fallback: string) => String(t(`voiceCanvas.appointment.${key}`, { defaultValue: fallback }));
    return {
      reasonTitle: copy("reasonTitle", "What is the appointment for?"),
      reasonHelper: copy("reasonHelper", "Share only what is useful for the request."),
      reasonLabel: copy("reasonLabel", "Reason for appointment"),
      reasonPlaceholder: copy("reasonPlaceholder", "For example, a check-up or follow-up"),
      continue: copy("continue", "Continue"),
      timeTitle: copy("timeTitle", "When would suit you?"),
      timeHelper: copy("timeHelper", "Choose a preference. The provider will confirm availability."),
      today: copy("today", "Today"),
      tomorrow: copy("tomorrow", "Tomorrow"),
      thisWeek: copy("thisWeek", "This week"),
      nextWeek: copy("nextWeek", "Next week"),
      anotherTime: copy("anotherTime", "Another time"),
      timeLabel: copy("timeLabel", "Preferred date or time"),
      timePlaceholder: copy("timePlaceholder", "For example, Friday morning"),
      coverageTitle: copy("coverageTitle", "How will this appointment be covered?"),
      coverageHelper: copy("coverageHelper", "VYVA will ask again before sharing coverage details."),
      useSavedCoverage: copy("useSavedCoverage", "Use saved coverage"),
      publicCoverage: copy("publicCoverage", "Public coverage"),
      privateCoverage: copy("privateCoverage", "Private insurance"),
      selfPay: copy("selfPay", "I will pay"),
      coverageUnsure: copy("coverageUnsure", "I am not sure"),
      providerTitle: copy("providerTitle", "Which provider should we check?"),
      providerHelper: copy("providerHelper", "Use your saved doctor, find another, or add a trusted provider."),
      useSavedProvider: copy("useSavedProvider", "Use saved doctor"),
      useSavedProviderDescription: copy("useSavedProviderDescription", "Saved in your profile"),
      findProvider: copy("findProvider", "Find another provider"),
      findProviderDescription: copy("findProviderDescription", "Compare suitable options before contact"),
      addProvider: copy("addProvider", "Add a trusted doctor or clinic"),
      addProviderDescription: copy("addProviderDescription", "Save a provider, then return here"),
      searchingTitle: copy("searchingTitle", "Checking suitable providers"),
      searchingHelper: copy("searchingHelper", "Nothing is contacted or booked yet."),
      optionsTitle: copy("optionsTitle", "Choose an option to review"),
      optionsHelper: copy("optionsHelper", "Availability may still need provider confirmation."),
      savedProvider: copy("savedProvider", "Saved provider"),
      availabilityUnknown: copy("availabilityUnknown", "Availability to be confirmed"),
      reviewTitle: copy("reviewTitle", "Confirm before VYVA contacts anyone"),
      reviewHelper: copy("reviewHelper", "Review the provider, time, coverage, and contact route."),
      reason: copy("reason", "Reason"),
      preferredTime: copy("preferredTime", "Preferred time"),
      coverage: copy("coverage", "Coverage"),
      provider: copy("provider", "Provider"),
      availability: copy("availability", "Availability"),
      contactRoute: copy("contactRoute", "Contact route"),
      confirmContact: copy("confirmContact", "Confirm and contact provider"),
      change: copy("change", "Change details"),
      back: copy("back", "Back"),
      contactingTitle: copy("contactingTitle", "VYVA is preparing the contact"),
      contactingHelper: copy("contactingHelper", "You can minimize this and continue using the app."),
      completedTitle: copy("completedTitle", "The appointment request is in progress"),
      completedHelper: copy("completedHelper", "VYVA will keep the provider response in Concierge."),
      errorTitle: copy("errorTitle", "The appointment request could not continue"),
      tryAgain: copy("tryAgain", "Try again"),
    };
  }, [t]);

  const { data: pendingActions = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/concierge/actions/pending"],
    queryFn: fetchPendingActions,
    refetchInterval: 8000,
  });

  const { data: savedTaskDrafts = [], isLoading: savedTaskDraftsLoading } = useQuery({
    queryKey: ["/api/concierge/tasks"],
    queryFn: listConciergeTaskDrafts,
    enabled: mode === "home",
    staleTime: 10 * 1000,
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteConciergeTaskDraft,
    onSuccess: async (deletedTask) => {
      queryClient.removeQueries({ queryKey: ["/api/concierge/tasks", deletedTask.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/tasks"] });
      navigate("/concierge", { replace: true });
    },
    onError: () => {
      setChatError(isSpanish ? "No he podido eliminar esta tarea." : "I could not remove this task.");
    },
  });

  const { data: completedSessions = [], isLoading: completedSessionsLoading } = useQuery({
    queryKey: ["/api/concierge/actions/sessions"],
    queryFn: fetchCompletedConciergeSessions,
    staleTime: 30 * 1000,
  });

  const { data: conciergeProfile = null } = useQuery<ConciergeProfileSummary | null>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile");
      if (!res.ok) return null;
      return (await res.json()) as ConciergeProfileSummary | null;
    },
    staleTime: 30 * 1000,
  });

  const activeHomeServiceDraftQuery = useQuery({
    queryKey: ["/api/appointments/requests/active-home-service"],
    queryFn: fetchActiveHomeServiceDraft,
    staleTime: 15 * 1000,
    retry: false,
    enabled: mode !== "task",
  });

  const persistedAppointmentRequestId = persistedTask?.progress_payload.requestId ?? null;
  const persistedAppointmentRequestQuery = useQuery({
    queryKey: ["/api/appointments/requests", persistedAppointmentRequestId],
    queryFn: () => fetchAppointmentRequest(persistedAppointmentRequestId!),
    enabled: mode === "task" && isPersistedConciergeTaskId(persistedAppointmentRequestId),
    retry: false,
  });

  useEffect(() => {
    const restored = persistedAppointmentRequestQuery.data;
    if (!restored?.request) return;
    setAppointmentRequest(restored.request);
    setAppointmentOptions(restored.options);
    setAppointmentDiscovery(restored.discovery ?? null);
    setSelectedAppointmentOptionId((current) => {
      if (current && restored.options.some((option) => option.id === current)) return current;
      const savedOptionId = persistedTask?.progress_payload.selectedProviderOptionId;
      if (savedOptionId && restored.options.some((option) => option.id === savedOptionId)) return savedOptionId;
      return restored.options[0]?.id ?? null;
    });
  }, [persistedAppointmentRequestQuery.data, persistedTask?.progress_payload.selectedProviderOptionId]);

  const selectedAppointmentOption = useMemo(() => {
    if (selectedAppointmentOptionId) {
      return appointmentOptions.find((option) => option.id === selectedAppointmentOptionId) ?? appointmentOptions[0] ?? null;
    }
    return appointmentOptions[0] ?? null;
  }, [appointmentOptions, selectedAppointmentOptionId]);

  const appointmentProviderName = appointmentOptionName(selectedAppointmentOption, isSpanish);
  const appointmentProviderAddress = appointmentSnapshotText(selectedAppointmentOption, "address");
  const appointmentProviderTrustNote = selectedAppointmentOption?.provider_source === "saved"
    ? (isSpanish ? "Guardado en tu perfil" : "Saved in your profile")
    : selectedAppointmentOption?.provider_source === "external"
      ? (isSpanish ? "Encontrado en fuentes verificables" : "Found from verifiable sources")
      : (isSpanish ? "Preparado para revisar" : "Prepared for review");
  const selectedAppointmentActionChannel = appointmentPreferredChannel(selectedAppointmentOption);
  const hasAppointmentCoverageInfo = Boolean(conciergeProfile?.serviceReadiness?.hasCoverageInfo);
  const savedCoverage = conciergeProfile?.coverage ?? null;
  const hasSavedMedicalProvider = profileHasSavedMedicalProvider(conciergeProfile);
  const savedMedicalProvider = savedMedicalProviderName(conciergeProfile);
  const savedPharmacyProviderDetailsValue = savedPharmacyProviderDetails(conciergeProfile);
  const savedPharmacy = savedPharmacyProviderDetailsValue?.name?.trim() || savedPharmacyName(conciergeProfile);
  const hasSavedPharmacy = profileHasSavedPharmacy(conciergeProfile);
  const savedTransportProviderDetailsValue = savedTransportProviderDetails(conciergeProfile);
  const savedTransportProvider = savedTransportProviderName(conciergeProfile);
  const hasSavedTransportProvider = profileHasSavedTransportProvider(conciergeProfile);
  const savedHomeServiceProviderDetailsValue = savedHomeServiceProviderDetails(conciergeProfile, homeServiceType);
  const savedHomeServiceProvider = savedHomeServiceProviderDetailsValue?.name?.trim() || "";
  const hasSavedHomeServiceProvider = Boolean(savedHomeServiceProviderDetailsValue);
  const savedHomeAddress = profileHomeAddressLabel(conciergeProfile);
  const homeServiceSessionAddress = homeServiceIntakeAnswers.home_address?.trim() || homeServiceIntakeAnswers.location?.trim() || "";
  const appointmentHomeServiceAddress = appointmentRequest?.appointment_type === "home-service"
    ? homeServiceAddressFromPreferences(appointmentRequest.preferences)
    : "";
  const homeServiceVisitAddress = appointmentHomeServiceAddress || homeServiceSessionAddress || savedHomeAddress;
  const homeServiceAddressSource = appointmentHomeServiceAddress
    ? "request"
    : homeServiceSessionAddress
      ? "session"
      : savedHomeAddress
        ? "profile"
        : "";
  const hasSavedTransportMobilityInfo = Boolean(conciergeProfile?.serviceReadiness?.hasMobilityInfo);
  const shouldAskTransportMobility = !hasSavedTransportMobilityInfo;
  const hasTransportDestination = transportDestination.trim().length > 0;
  const canFindTransportOptions = hasSavedTransportProvider && hasTransportDestination;
  const openTransportProviderSetup = useCallback(() => {
    const message = routePrefill?.kind === "ride" && routePrefill.message.trim()
      ? routePrefill.message
      : (isSpanish
        ? "Ayudame a preparar transporte seguro. Preguntame destino, recogida y hora antes de reservar."
        : "Help me prepare safe transport. Ask for destination, pickup, and time before booking.");
    navigate("/onboarding/profile/providers", {
      state: {
        returnTo: "/concierge",
        setupFocus: TRANSPORT_SETUP_FOCUS,
        setupFlow: TRANSPORT_BOOKING_FLOW_REFERENCE,
        setupReason: "Add or choose a saved transport provider",
        conciergeResume: {
          kind: "transport",
          message,
          pickup: transportPickup.trim() || savedTransportPickupLabel,
          destination: transportDestination.trim(),
          time: transportTime.trim() || "now",
          mobilityNeeds: transportMobilityNeeds,
          voiceCanvas: rideCanvasMode,
        },
        notice: isSpanish
          ? "Guarda un taxi o transporte preferido para usarlo primero."
          : "Add or choose a preferred taxi or transport provider to check first.",
      },
    });
  }, [
    isSpanish,
    navigate,
    routePrefill,
    rideCanvasMode,
    savedTransportPickupLabel,
    transportDestination,
    transportMobilityNeeds,
    transportPickup,
    transportTime,
  ]);
  const canPrepareOtcPharmacy = hasSavedPharmacy && otcItemText.trim().length > 0;
  const openMedicalProviderSetup = useCallback(() => {
    const appointmentType = appointmentRequest?.appointment_type ?? selectedAppointmentChip?.key ?? "medical";
    navigate("/onboarding/profile/providers", {
      state: {
        returnTo: "/concierge",
        setupFocus: MEDICAL_APPOINTMENT_SETUP_FOCUS,
        setupFlow: MEDICAL_APPOINTMENT_FLOW_REFERENCE,
        setupReason: "Add or choose a saved doctor or clinic",
        conciergeResume: {
          kind: "medical_appointment",
          appointmentType,
          note: appointmentNote.trim(),
          requestedTime: appointmentCanvasRequestedTime.trim(),
          coverageLabel: appointmentCanvasCoverageLabel.trim(),
          voiceCanvas: appointmentCanvasMode,
        },
        notice: isSpanish
          ? "Guarda un medico o clinica de confianza para usarlo primero."
          : "Add or choose a trusted doctor or clinic so VYVA can use it first.",
      },
    });
  }, [
    appointmentCanvasCoverageLabel,
    appointmentCanvasMode,
    appointmentCanvasRequestedTime,
    appointmentNote,
    appointmentRequest?.appointment_type,
    isSpanish,
    navigate,
    selectedAppointmentChip?.key,
  ]);
  const openHomeServiceProviderSetup = useCallback(() => {
    navigate("/onboarding/profile/providers", {
      state: {
        returnTo: "/concierge",
        setupFocus: "home_service",
        setupFlow: CONCIERGE_FLOW_REFERENCES.homeService,
        setupReason: "Add or choose a saved home service provider",
        conciergeResume: {
          kind: "home_service",
          serviceType: homeServiceType,
          origin: homeServiceIntakeOrigin,
          note: homeServiceIntakeAnswers.problem_summary?.trim() || appointmentNote.trim(),
          answers: homeServiceIntakeAnswers,
          textDrafts: homeServiceTextDrafts,
          voiceCanvas: homeServiceCanvasMode,
          photoName: homeServiceCanvasPhotoName,
        },
        notice: isSpanish
          ? "Guarda un proveedor de servicio en casa para continuar esta solicitud."
          : "Add a trusted home service provider to continue this request.",
      },
    });
  }, [
    appointmentNote,
    homeServiceCanvasMode,
    homeServiceCanvasPhotoName,
    homeServiceIntakeAnswers,
    homeServiceIntakeOrigin,
    homeServiceTextDrafts,
    homeServiceType,
    isSpanish,
    navigate,
  ]);
  const openProviderSetupHelper = useCallback((setupReason: string, resume?: Record<string, unknown>) => {
    navigate("/onboarding/careteam", {
      state: {
        returnTo: "/concierge",
        setupReason,
        conciergeResume: resume ?? null,
        notice: isSpanish
          ? "Anade una persona de confianza para ayudarte a configurar este proveedor."
          : "Add someone trusted who can help set up this provider.",
      },
    });
  }, [isSpanish, navigate]);
  const canSaveOtcOutcome = Boolean(otcPreparedResult?.pendingId)
    && (
      otcOutcomeForm.availability.trim().length > 0
      || otcOutcomeForm.costEstimate.trim().length > 0
      || otcOutcomeForm.fulfillmentNote.trim().length > 0
      || otcOutcomeForm.reference.trim().length > 0
      || otcOutcomeForm.notes.trim().length > 0
    );
  const appointmentIntentType = appointmentRequest?.appointment_type ?? selectedAppointmentChip?.key ?? null;
  const appointmentFlowReference = appointmentIntentType === "home-service"
    ? appointmentFlowReferenceFromPreferences(appointmentRequest?.preferences, CONCIERGE_FLOW_REFERENCES.homeService)
    : CONCIERGE_FLOW_REFERENCES.medicalAppointment;
  const otcToolReadiness = evaluateConciergeToolReadiness({
    flowReference: OTC_PHARMACY_FLOW_REFERENCE,
    requestedTool: hasSavedPharmacy
      ? preferredToolForSavedProvider(savedPharmacyProviderDetailsValue)
      : "operator_review",
    provider: savedPharmacyProviderDetailsValue
      ? {
          name: savedPharmacyProviderDetailsValue.name,
          providerName: savedPharmacyProviderDetailsValue.name,
          phone: savedPharmacyProviderDetailsValue.phone,
          email: savedPharmacyProviderDetailsValue.email,
          whatsapp: savedPharmacyProviderDetailsValue.whatsapp,
          booking_url: savedPharmacyProviderDetailsValue.bookingUrl || savedPharmacyProviderDetailsValue.booking_url,
          websiteUrl: savedPharmacyProviderDetailsValue.websiteUrl,
          website_uri: savedPharmacyProviderDetailsValue.website_uri,
        }
      : {
          name: savedPharmacy || "pharmacy",
        },
  });
  const transportToolReadiness = evaluateConciergeToolReadiness({
    flowReference: TRANSPORT_BOOKING_FLOW_REFERENCE,
    requestedTool: hasSavedTransportProvider
      ? preferredToolForSavedProvider(savedTransportProviderDetailsValue)
      : "operator_review",
    provider: savedTransportProviderDetailsValue
      ? {
          name: savedTransportProviderDetailsValue.name,
          providerName: savedTransportProviderDetailsValue.name,
          phone: savedTransportProviderDetailsValue.phone,
          email: savedTransportProviderDetailsValue.email,
          whatsapp: savedTransportProviderDetailsValue.whatsapp,
          booking_url: savedTransportProviderDetailsValue.bookingUrl || savedTransportProviderDetailsValue.booking_url,
          websiteUrl: savedTransportProviderDetailsValue.websiteUrl,
          website_uri: savedTransportProviderDetailsValue.website_uri,
        }
      : {
          name: savedTransportProvider || "transport",
        },
  });
  const homeServiceToolReadiness = evaluateConciergeToolReadiness({
    flowReference: CONCIERGE_FLOW_REFERENCES.homeService,
    requestedTool: hasSavedHomeServiceProvider
      ? preferredToolForSavedProvider(savedHomeServiceProviderDetailsValue)
      : "operator_review",
    provider: savedHomeServiceProviderDetailsValue
      ? {
          name: savedHomeServiceProviderDetailsValue.name,
          providerName: savedHomeServiceProviderDetailsValue.name,
          phone: savedHomeServiceProviderDetailsValue.phone,
          email: savedHomeServiceProviderDetailsValue.email,
          whatsapp: savedHomeServiceProviderDetailsValue.whatsapp,
          booking_url: savedHomeServiceProviderDetailsValue.bookingUrl || savedHomeServiceProviderDetailsValue.booking_url,
          websiteUrl: savedHomeServiceProviderDetailsValue.websiteUrl,
          website_uri: savedHomeServiceProviderDetailsValue.website_uri,
        }
      : {
          name: savedHomeServiceProvider || "home service",
        },
  });
  const otcPharmacyConfirmation = otcPharmacyConfirmationItems({
    pharmacyName: savedPharmacy || (isSpanish ? "Farmacia guardada" : "Saved pharmacy"),
    itemText: otcItemText,
    fulfillmentPreference: otcFulfillmentPreference,
    requestedTime: otcRequestedTime,
    notes: otcNotes,
    toolReadiness: otcToolReadiness,
    isSpanish,
  });
  const selectedAppointmentToolReadiness = selectedAppointmentActionChannel && selectedAppointmentOption
    ? evaluateConciergeToolReadiness({
        flowReference: appointmentFlowReference,
        requestedTool: toolFromAppointmentChannel(selectedAppointmentActionChannel),
        provider: {
          ...selectedAppointmentOption.provider_snapshot,
          availableChannels: selectedAppointmentOption.available_channels,
        },
      })
    : null;
  const selectedAppointmentConfirmationItems = selectedAppointmentActionChannel
    ? appointmentConfirmationItems({
        providerName: appointmentProviderName,
        providerTrustNote: appointmentProviderTrustNote,
        contactRoute: appointmentChannelLabel(selectedAppointmentActionChannel, isSpanish),
        isMedical: (appointmentRequest?.appointment_type ?? selectedAppointmentChip?.key) === "medical",
        hasCoverageInfo: hasAppointmentCoverageInfo,
        homeAddress: (appointmentRequest?.appointment_type ?? selectedAppointmentChip?.key) === "home-service"
          ? homeServiceVisitAddress
          : "",
        homeAccessNotes: (appointmentRequest?.appointment_type ?? selectedAppointmentChip?.key) === "home-service"
          ? homeServiceIntakeAnswers.access_notes
          : "",
        toolReadiness: selectedAppointmentToolReadiness,
        isSpanish,
      })
    : [];

  useEffect(() => {
    if (!hasAppointmentCoverageInfo || !savedCoverage) return;
    setCoverageType(normalizeCoverageReadinessType(savedCoverage.coverageType));
    setCoverageProvider(savedCoverage.provider?.trim() ?? "");
    setCoverageMemberId(savedCoverage.memberId?.trim() ?? "");
    setCoveragePlan(savedCoverage.plan?.trim() ?? "");
    setCoverageNotes(savedCoverage.notes?.trim() ?? "");
  }, [
    hasAppointmentCoverageInfo,
    savedCoverage,
    savedCoverage?.coverageType,
    savedCoverage?.memberId,
    savedCoverage?.notes,
    savedCoverage?.plan,
    savedCoverage?.provider,
  ]);

  function prepareAppointmentAccessFallback(appointmentType: AppointmentType, detail: string) {
    const cleanedDetail = detail.trim();
    const typeLabel = APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === appointmentType)?.[isSpanish ? "es" : "en"];
    if (appointmentType === "home-service") {
      const message = [
        isSpanish
          ? "No he podido verificar la busqueda de proveedores ahora mismo. Prepara esta solicitud de Concierge para revisar opciones fiables antes de contactar con nadie."
          : "I could not verify provider search access right now. Prepare this Concierge request so I can review trusted options before anyone is contacted.",
        cleanedDetail ? `${isSpanish ? "Detalle" : "Request details"}:\n${cleanedDetail}` : "",
        isSpanish
          ? "No llames, reserves, envies mensajes ni compartas datos sin mi confirmacion."
          : "Do not call, book, message, or share details without my confirmation.",
      ].filter(Boolean).join("\n\n");

      setRoutePrefill({ kind: "task", message });
      setInput(message);
      closeOffersPanel();
      setAppointmentError(null);
      setAppointmentNotice(isSpanish
        ? "He preparado la solicitud por chat para revisarla primero."
        : "I prepared this as a Concierge request to review first.");
      setAppointmentRequest(null);
      setAppointmentOptions([]);
      setAppointmentDiscovery(null);
      setSelectedAppointmentOptionId(null);
      setAppointmentAttemptResult(null);
      setAppointmentOpen(false);
      scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" });
      return;
    }

    const message = [
      isSpanish
        ? "No he podido verificar el acceso a la cita ahora mismo. Prepara esta solicitud de Concierge para revisarla antes de actuar."
        : "I could not verify appointment access right now. Prepare this Concierge request for review before acting.",
      typeLabel ? `${isSpanish ? "Tipo" : "Type"}: ${typeLabel}` : "",
      cleanedDetail ? `${isSpanish ? "Detalle" : "Request details"}:\n${cleanedDetail}` : "",
      isSpanish
        ? "No reserves, contactes, envies mensajes ni compartas datos sin mi confirmacion."
        : "Do not book, contact, message, or share details without my confirmation.",
    ].filter(Boolean).join("\n\n");

    setAppointmentError(null);
    setAppointmentNotice(isSpanish
      ? "He preparado la solicitud por chat para revisarla primero."
      : "I prepared this as a Concierge request to review first.");
    setAppointmentRequest(null);
    setAppointmentOptions([]);
    setAppointmentDiscovery(null);
    setSelectedAppointmentOptionId(null);
    setAppointmentAttemptResult(null);
    setAppointmentOpen(false);
    prepareConciergeRequest(message);
  }

  function prepareHomeServiceAccessFallback(detail: string) {
    prepareAppointmentAccessFallback("home-service", detail);
  }

  const saveCoverageMutation = useMutation({
    mutationFn: () => saveCoverageReadiness({
      coverageType,
      provider: coverageProvider,
      memberId: coverageMemberId,
      plan: coveragePlan,
      notes: coverageNotes,
    }),
    onMutate: () => {
      setCoverageError(null);
      setCoverageNotice(null);
    },
    onSuccess: async (result) => {
      const nextCoverage = result.coverage ?? {
        coverageType,
        provider: coverageProvider,
        memberId: coverageMemberId,
        plan: coveragePlan,
        notes: coverageNotes,
      };
      queryClient.setQueryData<ConciergeProfileSummary | null>(["/api/profile"], (current) => ({
        ...(current ?? {}),
        coverage: nextCoverage,
        serviceReadiness: {
          ...(current?.serviceReadiness ?? {}),
          hasCoverageInfo: result.serviceReadiness?.hasCoverageInfo ?? true,
        },
      }));
      const savedMessage = isSpanish
        ? "Cobertura guardada. VYVA te preguntara antes de compartirla."
        : "Coverage saved. VYVA will ask before sharing it.";
      setCoverageNotice(savedMessage);
      setAppointmentNotice(savedMessage);
      await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
    onError: (error) => {
      setCoverageError(error instanceof Error
        ? error.message
        : (isSpanish ? "No he podido guardar la cobertura." : "I could not save coverage details."));
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: (params: Parameters<typeof createAppointmentRequest>[0]) => createAppointmentRequest({
      ...params,
      preferences: persistedTask
        ? { ...(params.preferences ?? {}), concierge_task_id: persistedTask.id }
        : params.preferences,
    }),
    onMutate: () => {
      setAppointmentError(null);
      setAppointmentNotice(null);
      setAppointmentAttemptResult(null);
      setAppointmentRequest(null);
      setAppointmentOptions([]);
      setAppointmentDiscovery(null);
      setSelectedAppointmentOptionId(null);
      setAppointmentControlMode("listening");
      setAppointmentBookedForm({ scheduledFor: "", location: "", providerReply: "", reference: "", notes: "" });
    },
    onSuccess: (result) => {
      setAppointmentRequest(result.request);
      setAppointmentOptions(result.options);
      setAppointmentDiscovery(result.discovery ?? null);
      setSelectedAppointmentOptionId(result.options[0]?.id ?? null);
      const isHomeServiceRequest = result.request.appointment_type === "home-service";
      if (isHomeServiceRequest && result.options.length === 0) {
        setAppointmentNotice(isSpanish ? "Estoy buscando opciones fiables cerca." : "I am checking trusted nearby options.");
        void discoverAppointmentOptions({ requestId: result.request.id })
          .then((nextResult) => {
            setAppointmentRequest(nextResult.request);
            setAppointmentOptions(nextResult.options);
            setAppointmentDiscovery(nextResult.discovery ?? null);
            setSelectedAppointmentOptionId(nextResult.options[0]?.id ?? null);
            setAppointmentNotice(nextResult.options.length > 0
              ? (isSpanish ? "He encontrado una opcion fiable para revisar." : "I found a trusted option to review.")
              : (isSpanish ? "No he encontrado una opcion clara. Puedo prepararlo por chat." : "I did not find a clear option. I can still prepare this in chat."));
          })
          .catch((error) => {
            if (isFeatureAccessVerificationError(error)) {
              prepareHomeServiceAccessFallback(result.request.reason_detail ?? "");
              return;
            }
            setAppointmentError(appointmentErrorMessage(error, isSpanish, isSpanish ? "No he podido buscar opciones." : "I could not look for options."));
          });
        return;
      }
      const firstOptionIsSavedProvider = result.options[0]?.provider_source === "saved";
      setAppointmentNotice(result.options.length > 0
        ? firstOptionIsSavedProvider
          ? (isSpanish ? "He encontrado un proveedor guardado para revisar primero." : "I found a saved provider to review first.")
          : (isSpanish ? "He encontrado una opcion fiable para revisar." : "I found a trusted option to review.")
        : isHomeServiceRequest
          ? (isSpanish ? "Aun no hay proveedor guardado. Puedo buscar opciones fiables." : "No saved provider yet. I can look for trusted options.")
          : (isSpanish ? "No veo un proveedor guardado para esto. Puedo buscar opciones." : "I do not see a saved provider for this yet. I can look for options."));
    },
    onError: (error, variables) => {
      if (isFeatureAccessVerificationError(error)) {
        prepareAppointmentAccessFallback(variables.appointmentType, variables.detail);
        return;
      }
      setAppointmentError(appointmentErrorMessage(error, isSpanish, isSpanish ? "No he podido crear la solicitud." : "I could not create the request."));
    },
  });

  const homeServiceDraftMutation = useMutation({
    mutationFn: async ({ finalize = false }: { finalize?: boolean } = {}) => {
      const { intake, preferences } = buildCurrentHomeServiceIntake();
      if (appointmentRequest?.appointment_type === "home-service") {
        return updateHomeServiceDraft({
          requestId: appointmentRequest.id,
          detail: intake.research_brief,
          preferences: {
            ...preferences,
            flow_reference: CONCIERGE_FLOW_REFERENCES.homeService,
            ...(persistedTask ? { concierge_task_id: persistedTask.id } : {}),
          },
          locale,
          finalize,
        });
      }
      return createAppointmentRequest({
        appointmentType: "home-service",
        detail: intake.research_brief,
        preferences: {
          ...preferences,
          flow_reference: CONCIERGE_FLOW_REFERENCES.homeService,
          ...(persistedTask ? { concierge_task_id: persistedTask.id } : {}),
        },
        flowReference: CONCIERGE_FLOW_REFERENCES.homeService,
        routePrefillSource: routePrefill?.source,
        locale,
        draft: !finalize,
      });
    },
    onSuccess: (result) => {
      setAppointmentRequest(result.request);
      setAppointmentOptions(result.options);
      setAppointmentDiscovery(result.discovery ?? null);
      setSelectedAppointmentOptionId((current) => current && result.options.some((option) => option.id === current)
        ? current
        : result.options[0]?.id ?? null);
      void queryClient.invalidateQueries({ queryKey: ["/api/appointments/requests/active-home-service"] });
    },
    onError: (error) => {
      setHomeServiceCanvasError(error instanceof Error ? error.message : (isSpanish ? "No pude guardar la solicitud." : "I could not save the request."));
    },
  });
  const saveHomeServiceDraft = homeServiceDraftMutation.mutate;
  const isHomeServiceDraftSaving = homeServiceDraftMutation.isPending;

  const discoverAppointmentOptionsMutation = useMutation({
    mutationFn: discoverAppointmentOptions,
    onMutate: () => {
      setAppointmentError(null);
      setAppointmentNotice(null);
    },
    onSuccess: (result) => {
      setAppointmentRequest(result.request);
      setAppointmentOptions(result.options);
      setAppointmentDiscovery(result.discovery ?? null);
      setSelectedAppointmentOptionId((current) => {
        if (current && result.options.some((option) => option.id === current)) return current;
        return result.options[0]?.id ?? null;
      });

      const inserted = result.discovery?.inserted_count ?? 0;
      if (inserted > 0) {
        setAppointmentNotice(isSpanish
          ? "He encontrado opciones. Elige una antes de contactar."
          : "I found options. Choose one before contacting.");
        return;
      }
      if (result.discovery?.fallback_reason === "google_places_not_configured") {
        setAppointmentNotice(isSpanish
          ? "La busqueda externa aun no esta configurada. Puedo prepararlo por chat."
          : "External search is not configured yet. I can still prepare this in chat.");
        return;
      }
      setAppointmentNotice(isSpanish
        ? "No he encontrado una opcion clara. Puedo prepararlo por chat."
        : "I did not find a clear option. I can still prepare this in chat.");
    },
    onError: (error) => {
      if (isFeatureAccessVerificationError(error)) {
        const fallbackType = appointmentRequest?.appointment_type ?? selectedAppointmentChip?.key ?? "medical";
        const fallbackDetail = fallbackType === "home-service"
          ? appointmentRequest?.reason_detail ?? buildCurrentHomeServiceIntake().intake.research_brief ?? ""
          : appointmentRequest?.reason_detail ?? appointmentNote.trim();
        prepareAppointmentAccessFallback(fallbackType, fallbackDetail);
        return;
      }
      setAppointmentError(appointmentErrorMessage(error, isSpanish, isSpanish ? "No he podido buscar opciones." : "I could not look for options."));
    },
  });

  const addAppointmentBookingSiteMutation = useMutation({
    mutationFn: addAppointmentBookingSiteOption,
    onMutate: () => {
      setAppointmentError(null);
      setAppointmentNotice(null);
    },
    onSuccess: (result) => {
      setAppointmentOptions((current) => {
        const withoutDuplicate = current.filter((option) => option.id !== result.option.id);
        return [result.option, ...withoutDuplicate];
      });
      setSelectedAppointmentOptionId(result.option.id);
      setAppointmentNotice(isSpanish
        ? "Sitio de reserva preparado. Confirma antes de que VYVA abra o envie el formulario."
        : "Booking site prepared. Confirm before VYVA opens or submits the form.");
    },
    onError: (error) => {
      setAppointmentError(error instanceof Error
        ? error.message
        : (isSpanish ? "No he podido preparar el sitio de reserva." : "I could not prepare the booking site."));
    },
  });

  const confirmAppointmentMutation = useMutation({
    mutationFn: confirmAppointmentAttempt,
    onMutate: () => {
      setAppointmentError(null);
      setAppointmentNotice(null);
    },
    onSuccess: async (result) => {
      setAppointmentAttemptResult(result);
      if (result.pending?.status === "calling") {
        setAppointmentControlMode("listening");
      }
      if (result.scheduled_event) {
        setAppointmentNotice(isSpanish ? "VYVA ha confirmado y guardado la cita." : "VYVA confirmed and saved the appointment.");
      } else if (result.pending?.status === "calling") {
        setAppointmentNotice(isSpanish ? "VYVA esta llamando ahora. Guarda la cita cuando este confirmada." : "VYVA is calling now. Save the appointment once confirmed.");
      } else if (result.communication?.status === "sent") {
        setAppointmentNotice(isSpanish ? "VYVA ha enviado el mensaje. Guarda la cita cuando respondan." : "VYVA sent the message. Save the appointment when they reply.");
      } else if (result.form_task) {
        setAppointmentNotice(isSpanish ? "VYVA tiene la tarea del formulario. Guarda la cita cuando este confirmada." : "VYVA has the booking form task. Save the appointment once confirmed.");
      } else if (result.pending) {
        setAppointmentNotice(isSpanish ? "VYVA tiene esta gestion en Ahora mismo." : "VYVA is handling this under Right now.");
      } else if (result.draft) {
        setAppointmentNotice(isSpanish ? "Borrador preparado. Copialo o usalo antes de guardar la cita." : "Draft prepared. Copy or use it before saving the appointment.");
      } else {
        setAppointmentNotice(isSpanish ? "Siguiente paso preparado. Guarda la cita cuando este confirmada." : "Next step prepared. Save the appointment once it is confirmed.");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/scheduled-events"] });
    },
    onError: (error) => {
      setAppointmentError(error instanceof Error ? error.message : (isSpanish ? "No he podido preparar el contacto." : "I could not prepare the contact step."));
    },
  });

  const markAppointmentBookedMutation = useMutation({
    mutationFn: markAppointmentBooked,
    onMutate: () => {
      setAppointmentError(null);
      setAppointmentNotice(null);
    },
    onSuccess: async (result) => {
      const pendingId = appointmentAttemptResult?.pending?.pendingId || appointmentAttemptResult?.form_task?.pending_id || null;
      const hadPendingTask = Boolean(pendingId);
      let taskClosed = false;
      if (pendingId && appointmentRequest) {
        const isHomeServiceOutcome = appointmentRequest.appointment_type === "home-service";
        const providerReply = appointmentBookedForm.providerReply.trim();
        const notes = appointmentBookedForm.notes.trim();
        const outcomeLocation = appointmentBookedForm.location.trim()
          || (isHomeServiceOutcome ? homeServiceVisitAddress : appointmentSnapshotText(selectedAppointmentOption, "address"))
          || null;
        const homeServiceEstimate = isHomeServiceOutcome
          ? estimateFromHomeServiceReply(providerReply, notes)
          : null;
        try {
          await completePendingConciergeAction({
            pendingId,
            outcomeSummary: isHomeServiceOutcome
              ? `Home service visit confirmed with ${appointmentProviderName}.`
              : `Medical appointment confirmed with ${appointmentProviderName}.`,
            outcomePayload: {
              flow_reference: appointmentFlowReference,
              appointment_request_id: appointmentRequest.id,
              appointment_type: appointmentRequest.appointment_type,
              provider_name: appointmentProviderName,
              selected_channel: appointmentRequest.selected_channel ?? selectedAppointmentActionChannel,
              scheduled_for: appointmentBookedForm.scheduledFor,
              location: outcomeLocation,
              provider_reply: providerReply || null,
              reference: appointmentBookedForm.reference.trim() || null,
              notes: notes || null,
              coverage_info_saved: appointmentRequest.appointment_type === "medical" ? hasAppointmentCoverageInfo : null,
              ...(isHomeServiceOutcome ? {
                service_type: homeServiceType ?? null,
                service_label: homeServiceNeededLabel || (homeServiceType ? homeServiceTypeLabel(homeServiceType, locale) : null),
                urgency: homeServiceIntakeAnswers.urgency ?? null,
                criteria: homeServiceIntakeAnswers.criteria ?? null,
                safety_flags: homeServiceSafetyFlags,
                estimated_cost: homeServiceEstimate,
                home_address: homeServiceVisitAddress || null,
                home_address_source: homeServiceAddressSource || null,
                home_access_or_safety_notes: homeServiceIntakeAnswers.access_notes ?? null,
              } : {}),
              scheduled_event_id: typeof result.scheduled_event === "object" && result.scheduled_event && "id" in result.scheduled_event
                ? String(result.scheduled_event.id)
                : null,
            },
          });
          taskClosed = true;
        } catch (error) {
          setAppointmentError(error instanceof Error
            ? error.message
            : (isSpanish ? "La cita se guardo, pero no pude cerrar la tarea." : "The appointment was saved, but I could not close the task."));
        }
      }
      setAppointmentNotice(!hadPendingTask
        ? (isSpanish ? "Cita guardada en Scheduled Support." : "Appointment saved in Scheduled Support.")
        : taskClosed
        ? (isSpanish ? "Cita guardada en Scheduled Support. La tarea queda cerrada." : "Appointment saved in Scheduled Support. The task is closed.")
        : (isSpanish ? "Cita guardada en Scheduled Support. Revisa la tarea pendiente." : "Appointment saved in Scheduled Support. Please review the pending task."));
      setAppointmentRequest(null);
      setAppointmentOptions([]);
      setAppointmentDiscovery(null);
      setSelectedAppointmentOptionId(null);
      setAppointmentAttemptResult(null);
      setAppointmentBookedForm({ scheduledFor: "", location: "", providerReply: "", reference: "", notes: "" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/profile/scheduled-events"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/scheduled-events"] }),
      ]);
    },
    onError: (error) => {
      setAppointmentError(error instanceof Error ? error.message : (isSpanish ? "No he podido guardar la cita." : "I could not save the appointment."));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: confirmPendingAction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
  });

  const guidedDetailMutation = useMutation({
    mutationFn: updatePendingActionDetails,
    onMutate: () => {
      setGuidedDetailError(null);
      setGuidedDetailNotice(null);
    },
    onSuccess: async () => {
      setGuidedDetailDraft("");
      setGuidedDetailNotice(isSpanish ? "Detalle guardado." : "Detail saved.");
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
    },
    onError: (error) => {
      setGuidedDetailError(error instanceof Error ? error.message : (isSpanish ? "No he podido guardar el detalle." : "I could not save the detail."));
    },
  });

  function requestExternalConfirmation(request: ConciergeExternalConfirmationRequest) {
    setExternalConfirmationRequest(request);
  }

  function handleExternalConfirmationConfirm() {
    const request = externalConfirmationRequest;
    if (!request) return;

    if (request.kind === "confirm") {
      confirmMutation.mutate(request.item, {
        onSuccess: () => setExternalConfirmationRequest(null),
      });
      return;
    }

    const requestTask = getConciergeExecutionTask(request.item);
    const requestChannelReadiness = requestTask?.channel_readiness ?? null;
    const requestLiveAllowed = Boolean(
      (requestTask?.external_action_allowed || confirmedReviewActionIds.has(request.item.id)) &&
      (requestChannelReadiness?.channel ? requestChannelReadiness.external_action_allowed : true),
    );

    if (request.href && !isConciergeDryRunPayload(request.item.action_payload) && requestLiveAllowed) {
      window.open(
        request.href,
        request.target ?? "_self",
        request.target === "_blank" ? "noopener,noreferrer" : undefined,
      );
    }
    setExternalConfirmationRequest(null);
  }

  const reviewConfirmMutation = useMutation({
    mutationFn: async ({ item, kind }: { item: ConciergePendingItem; kind: "phone" | "email" | "whatsapp" }) => {
      const result = await confirmPendingActionReview(item);
      return { item, kind, result };
    },
    onSuccess: async ({ item, kind, result }) => {
      if (result.historySessionId) {
        const notice = isSpanish
          ? "Email enviado y guardado. Esperando al proveedor."
          : "Email sent and saved. Waiting for the provider.";
        setEmailDraftNotice(notice);
        setRecentEmailDraftCompletion({ actionId: item.id, notice });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
        ]);
        return;
      }
      setConfirmedReviewActionIds((current) => {
        const next = new Set(current);
        next.add(item.id);
        return next;
      });
      if (kind === "phone") {
        showPhoneCallReview(item);
      } else if (kind === "email") {
        showEmailDraftReview(item);
      } else {
        showWhatsAppDraftReview(item);
      }
    },
    onError: (error, { kind }) => {
      const message = error instanceof Error
        ? error.message
        : (isSpanish ? "No he podido confirmar la accion." : "I could not confirm the action.");
      if (kind === "phone") setPhoneCallOutcomeError(message);
      if (kind === "email") setEmailDraftError(message);
      if (kind === "whatsapp") setWhatsAppDraftError(message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelPendingAction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
  });

  const executeWebSearchActionMutation = useMutation({
    mutationFn: async ({ item }: { item: ConciergePendingItem }) => {
      const query = webSearchActionQuery(item, isSpanish);
      const result = await searchOffers(query, language);
      return { item, query, result };
    },
    onMutate: ({ item }) => {
      setWebSearchErrorsByActionId((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    },
    onSuccess: ({ item, query, result }) => {
      setWebSearchResultsByActionId((current) => ({
        ...current,
        [item.id]: { query, result },
      }));
    },
    onError: (error, { item }) => {
      setWebSearchErrorsByActionId((current) => ({
        ...current,
        [item.id]: error instanceof Error
          ? error.message
          : (isSpanish ? "No he podido completar la busqueda." : "I could not complete the search."),
      }));
    },
  });

  const completeWebSearchActionMutation = useMutation({
    mutationFn: ({ item, search }: { item: ConciergePendingItem; search: WebSearchActionResult }) => (
      completePendingConciergeAction({
        pendingId: item.id,
        outcomeSummary: webSearchOutcomeSummary(item, search, isSpanish),
        outcomePayload: webSearchOutcomePayload(item, search),
      })
    ),
    onSuccess: async (_result, { item }) => {
      setWebSearchResultsByActionId((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setWebSearchErrorsByActionId((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
    onError: (error, { item }) => {
      setWebSearchErrorsByActionId((current) => ({
        ...current,
        [item.id]: error instanceof Error
          ? error.message
          : (isSpanish ? "No he podido guardar la busqueda." : "I could not save the search."),
      }));
    },
  });

  const providerReplyCompletionMutation = useMutation({
    mutationFn: ({ item, form }: { item: ConciergePendingItem; form: ProviderReplyForm }) => {
      if (isHomeServicePendingAction(item)) {
        return saveConfirmedHomeServiceFromProviderReply({
          item,
          form,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid",
          locale,
          isSpanish,
        });
      }
      if (isMedicalAppointmentPendingAction(item)) {
        return saveConfirmedAppointmentFromProviderReply({
          item,
          form,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid",
          isSpanish,
        });
      }
      return patchPendingConciergeAction({
        pendingId: item.id,
        actionPayload: providerReplyOpenTaskPayload(item, form, isSpanish),
      });
    },
    onMutate: () => {
      setProviderReplyError(null);
      setProviderReplyNotice(null);
    },
    onSuccess: async (result, { item }) => {
      setProviderReplyMode(null);
      setProviderReplyForm(EMPTY_PROVIDER_REPLY_FORM);
      const completionStatus = isRecord(result) && typeof result.completionStatus === "string" ? result.completionStatus : "";
      const savedFlow = isRecord(result) && typeof result.savedFlow === "string" ? result.savedFlow : "";
      setProviderReplyNotice(completionStatus === "review_pending"
        ? savedFlow === "home_service"
          ? (isSpanish
            ? "Visita guardada. Revisa la respuesta antes de completar la tarea."
            : "Visit saved. Review the reply before completing the task.")
          : (isSpanish
            ? "Cita guardada. Revisa la respuesta antes de completar la tarea."
            : "Appointment saved. Review the reply before completing the task.")
        : completionStatus === "reply_received"
          ? savedFlow === "home_service"
            ? (isSpanish
              ? "Respuesta y visita guardadas. Marca la tarea como hecha cuando termines."
              : "Reply and visit saved. Mark the task done when you are finished.")
            : (isSpanish
              ? "Respuesta y cita guardadas. Marca la tarea como hecha cuando termines."
              : "Reply and appointment saved. Mark the task done when you are finished.")
          : (isSpanish ? "Respuesta guardada. Revisa y marca la tarea como hecha." : "Reply saved. Review it, then mark the task done."));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/profile/scheduled-events"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/scheduled-events"] }),
      ]);
    },
    onError: (error) => {
      setProviderReplyError(error instanceof Error ? error.message : (isSpanish ? "No he podido guardar la respuesta." : "I could not save the reply."));
    },
  });

  const providerNoAnswerMutation = useMutation({
    mutationFn: ({ item }: { item: ConciergePendingItem }) => {
      const provider = providerSearchProviderName(item, isSpanish)
        || item.provider_name?.trim()
        || (isSpanish ? "el proveedor" : "the provider");
      const summary = isSpanish
        ? `Sin respuesta de ${provider}. La tarea sigue abierta.`
        : `No answer from ${provider}. The task remains open.`;
      return recordPendingConciergeFollowUp({
        item,
        outcomeSummary: summary,
        outcomePayload: {
          ...(item.action_payload ?? {}),
          provider_no_answer_at: new Date().toISOString(),
        },
        outcome: "no_answer",
        channel: getPreferredHandoffChannel(item)
          || getExecutionChannel(item)
          || (item.provider_phone?.trim() ? "phone" : "manual"),
      });
    },
    onMutate: () => {
      setProviderReplyError(null);
      setProviderReplyNotice(null);
    },
    onSuccess: async (_result, { item }) => {
      setProviderReplyMode(null);
      setProviderReplyNotice(isSpanish
        ? "Sin respuesta guardado. La tarea sigue abierta y el seguimiento necesita tu OK."
        : "No answer saved. The task stays open, and any follow-up still needs your OK.");
      setInput(providerFollowUpPrompt(item, isSpanish, locale));
      setIsRightNowHidden(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
      window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
    },
    onError: (error) => {
      setProviderReplyError(error instanceof Error
        ? error.message
        : (isSpanish ? "No he podido guardar que no respondieron." : "I could not save the no-answer result."));
    },
  });

  const providerNeedsInfoMutation = useMutation({
    mutationFn: ({ item, question }: { item: ConciergePendingItem; question: string }) => patchPendingConciergeAction({
      pendingId: item.id,
      actionPayload: buildConciergeProviderActionNeededPatch({
        payload: item.action_payload,
        question,
        source: isConciergeDryRunPayload(item.action_payload) ? "simulated" : "live",
      }),
    }),
    onMutate: () => {
      setProviderReplyError(null);
      setProviderReplyNotice(null);
    },
    onSuccess: async (_result, { item, question }) => {
      const provider = providerSearchProviderName(item, isSpanish)
        || item.provider_name?.trim()
        || (isSpanish ? "el proveedor" : "the provider");
      const actionLabel = getPendingActionUseCaseLabel(item, locale).toLowerCase();
      setInput(isSpanish
        ? `El proveedor necesita mas informacion para ${actionLabel} con ${provider}: ${question}. Ayudame a responder de forma breve.`
        : `The provider needs more information for ${actionLabel} with ${provider}: ${question}. Help me answer briefly.`);
      setProviderReplyNotice(isSpanish ? "La pregunta esta lista para responder." : "The question is ready to answer.");
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
      window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
    },
    onError: (error) => {
      setProviderReplyError(error instanceof Error
        ? error.message
        : (isSpanish ? "No he podido guardar la pregunta." : "I could not save the question."));
    },
  });

  const providerReplyResolutionMutation = useMutation({
    mutationFn: ({
      item,
      resolution,
      action,
      answers,
    }: {
      item: ConciergePendingItem;
      resolution: ConciergeProviderReplyResolution;
      action: ConciergeProviderReplyPrimaryAction;
      answers: Record<string, string>;
    }) => patchPendingConciergeAction({
      pendingId: item.id,
      actionPayload: buildConciergeProviderReplyDecisionPatch({
        payload: item.action_payload,
        resolution,
        action,
        answers,
      }),
    }),
    onMutate: () => {
      setProviderReplyError(null);
      setProviderReplyNotice(null);
    },
    onSuccess: async () => {
      setProviderReplyNotice(isSpanish
        ? "Respuesta preparada. Revisala antes de enviar."
        : "Reply prepared. Review it before sending.");
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
    },
    onError: (error) => {
      setProviderReplyError(error instanceof Error
        ? error.message
        : (isSpanish ? "No he podido preparar la respuesta." : "I could not prepare the reply."));
    },
  });

  const providerMarkCompleteMutation = useMutation({
    mutationFn: ({ item }: { item: ConciergePendingItem }) => {
      const resolution = conciergeProviderReplySnapshot(item.action_payload)?.resolution ?? null;
      const outcomeSummary = conciergeProviderCompletionSummary(
        item.action_payload,
        isSpanish ? "Tarea marcada como completada." : "Task marked complete.",
      );
      return completePendingConciergeAction({
        pendingId: item.id,
        outcomeSummary,
        outcomePayload: {
          ...buildConciergeProviderReplyCompletionPayload({
            payload: item.action_payload,
            resolution,
            outcomeSummary,
          }),
          completed_from: "provider_follow_up_panel",
        },
      });
    },
    onMutate: () => {
      setProviderReplyError(null);
      setProviderReplyNotice(null);
    },
    onSuccess: async (_result, { item }) => {
      setProviderReplyMode(null);
      setProviderReplyForm(EMPTY_PROVIDER_REPLY_FORM);
      setProviderReplyNotice(isSpanish ? "Tarea completada." : "Task completed.");
      await resumeProviderHandoffSource(item, "completed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
    onError: (error) => {
      setProviderReplyError(error instanceof Error
        ? error.message
        : (isSpanish ? "No he podido completar la tarea." : "I could not complete the task."));
    },
  });

  const bookingFormOutcomeMutation = useMutation({
    mutationFn: ({ item, form }: { item: ConciergePendingItem; form: BookingFormOutcomeForm }) => {
      const outcomeSummary = bookingFormOutcomeSummary(item, form, isSpanish);
      return recordPendingConciergeFollowUp({
        item,
        outcomeSummary,
        outcomePayload: bookingFormOutcomePayload(item, form),
        outcome: "form_submitted",
        channel: "booking_url",
      });
    },
    onMutate: () => {
      setBookingFormError(null);
      setBookingFormNotice(null);
    },
    onSuccess: async () => {
      setBookingFormOutcomeForm(EMPTY_BOOKING_FORM_OUTCOME_FORM);
      setBookingFormNotice(isSpanish ? "Formulario enviado. Esperando al proveedor." : "Form submitted. Waiting for the provider.");
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
    },
    onError: (error) => {
      setBookingFormError(error instanceof Error ? error.message : (isSpanish ? "No he podido guardar el formulario." : "I could not save the form."));
    },
  });

  const phoneCallOutcomeMutation = useMutation({
    mutationFn: ({ item, form }: { item: ConciergePendingItem; form: PhoneCallOutcomeForm }) => {
      const outcomeSummary = phoneCallOutcomeSummary(item, form, isSpanish);
      const outcomePayload = phoneCallOutcomePayload(item, form, isSpanish);
      if (form.status === "confirmed" || form.status === "cancelled") {
        return completePendingConciergeAction({
          pendingId: item.id,
          outcomeSummary,
          outcomePayload,
        });
      }
      return recordPendingConciergeFollowUp({
        item,
        outcomeSummary,
        outcomePayload,
        outcome: form.status,
        channel: "phone",
        state: form.status === "needs_info" ? "needs_human_help" : "waiting",
      });
    },
    onMutate: () => {
      setPhoneCallOutcomeError(null);
      setPhoneCallOutcomeNotice(null);
    },
    onSuccess: async (_result, { item, form }) => {
      setPhoneCallOutcomeForm(EMPTY_PHONE_CALL_OUTCOME_FORM);
      setPhoneCallOutcomeNotice(form.status === "no_answer"
        ? (isSpanish ? "Sin respuesta. La tarea sigue abierta." : "No answer. The task stays open.")
        : form.status === "needs_info"
          ? (isSpanish ? "Faltan datos. La tarea sigue abierta." : "More information is needed. The task stays open.")
          : (isSpanish ? "Llamada guardada. La tarea queda cerrada." : "Call saved. The task is closed."));
      if (form.status === "confirmed" || form.status === "cancelled") {
        await resumeProviderHandoffSource(item, form.status === "confirmed" ? "completed" : "failed");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
    onError: (error) => {
      setPhoneCallOutcomeError(error instanceof Error ? error.message : (isSpanish ? "No he podido guardar la llamada." : "I could not save the call."));
    },
  });

  const emailDraftOutcomeMutation = useMutation({
    mutationFn: ({ item, draft, form }: { item: ConciergePendingItem; draft: ConciergeEmailDraft; form: EmailDraftOutcomeForm }) => {
      const outcomeSummary = emailDraftOutcomeSummary(item, draft, form, isSpanish);
      return recordPendingConciergeFollowUp({
        item,
        outcomeSummary,
        outcomePayload: emailDraftOutcomePayload(item, draft, form),
        outcome: "email_sent",
        channel: "email",
      });
    },
    onMutate: () => {
      setEmailDraftError(null);
      setEmailDraftNotice(null);
      setRecentEmailDraftCompletion(null);
    },
    onSuccess: async (_completion, variables) => {
      const notice = isSpanish ? "Email enviado. Esperando al proveedor." : "Email sent. Waiting for the provider.";
      setEmailDraftOutcomeForm(EMPTY_EMAIL_DRAFT_OUTCOME_FORM);
      setEmailDraftNotice(notice);
      setRecentEmailDraftCompletion({ actionId: variables.item.id, notice });
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
    },
    onError: (error) => {
      setEmailDraftError(error instanceof Error ? error.message : (isSpanish ? "No he podido guardar el email." : "I could not save the email."));
    },
  });

  const whatsAppDraftOutcomeMutation = useMutation({
    mutationFn: ({ item, draft, form }: { item: ConciergePendingItem; draft: ConciergeWhatsAppDraft; form: WhatsAppDraftOutcomeForm }) => {
      const outcomeSummary = whatsAppDraftOutcomeSummary(item, draft, form, isSpanish);
      return recordPendingConciergeFollowUp({
        item,
        outcomeSummary,
        outcomePayload: whatsAppDraftOutcomePayload(item, draft, form),
        outcome: "whatsapp_sent",
        channel: "whatsapp",
      });
    },
    onMutate: () => {
      setWhatsAppDraftError(null);
      setWhatsAppDraftNotice(null);
    },
    onSuccess: async () => {
      setWhatsAppDraftOutcomeForm(EMPTY_WHATSAPP_DRAFT_OUTCOME_FORM);
      setWhatsAppDraftNotice(isSpanish ? "WhatsApp enviado. Esperando al proveedor." : "WhatsApp sent. Waiting for the provider.");
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
    },
    onError: (error) => {
      setWhatsAppDraftError(error instanceof Error ? error.message : (isSpanish ? "No he podido guardar el WhatsApp." : "I could not save the WhatsApp."));
    },
  });

  const manualReviewOutcomeMutation = useMutation({
    mutationFn: ({ item, form }: { item: ConciergePendingItem; form: ManualReviewOutcomeForm }) => (
      completePendingConciergeAction({
        pendingId: item.id,
        outcomeSummary: manualReviewOutcomeSummary(item, form, isSpanish),
        outcomePayload: manualReviewOutcomePayload(item, form),
      })
    ),
    onMutate: () => {
      setManualReviewError(null);
      setManualReviewNotice(null);
    },
    onSuccess: async (_result, { form }) => {
      setManualReviewOutcomeForm(EMPTY_MANUAL_REVIEW_OUTCOME_FORM);
      setManualReviewNotice(form.status === "review_pending"
        ? (isSpanish ? "Revision guardada como pendiente. La tarea queda en historial." : "Review saved as pending. The task is in history.")
        : (isSpanish ? "Revision guardada. La tarea queda cerrada." : "Review saved. The task is closed."));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
    onError: (error) => {
      setManualReviewError(error instanceof Error ? error.message : (isSpanish ? "No he podido guardar la revision." : "I could not save the review."));
    },
  });

  const providerShortlistMutation = useMutation({
    mutationFn: async (options: ProviderComparisonOption[]) => {
      if (editingProviderShortlistId) {
        const existing = pendingActions.find((item) => item.id === editingProviderShortlistId);
        const parsed = parseProviderShortlistPayload(existing?.action_payload);
        if (!existing?.action_payload || !parsed) throw new Error("Could not reopen provider shortlist");
        const merged = [...parsed.options, ...options].filter((option, index, all) => (
          all.findIndex((candidate) => candidate.id === option.id || candidate.name.toLowerCase() === option.name.toLowerCase()) === index
        )).slice(0, 3);
        await patchPendingConciergeAction({
          pendingId: existing.id,
          actionPayload: updateProviderShortlistPayload(existing.action_payload, merged, {
            preferredProviderId: parsed.preferredProviderId,
          }),
        });
        return { pendingId: existing.id, edited: true };
      }
      return {
        ...await saveProviderShortlistAction({
          options,
          mode: providerSearchMode ?? "shopping-seller",
          query: offersQuery.trim() || providerSearchModeLabel(providerSearchMode ?? "shopping-seller", isSpanish),
          criteria: providerSearchCriteria,
          flowReference: providerSearchFlowReference(providerSearchMode ?? "shopping-seller"),
          locale,
        }),
        edited: false,
      };
    },
    onMutate: () => {
      setProviderShortlistError(null);
      setProviderShortlistNotice(null);
    },
    onSuccess: async (result) => {
      setProviderShortlistNotice(isSpanish
        ? "Seleccion guardada en En curso. No se ha contactado con nadie."
        : "Shortlist saved in In progress. Nobody was contacted.");
      setEditingProviderShortlistId(null);
      setVisibleActionId(result.pendingId);
      setIsRightNowHidden(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
      if (result.edited) {
        setOffersOpen(false);
        window.setTimeout(() => scrollIntoViewIfAvailable(rightNowSectionRef.current, { behavior: "smooth", block: "start" }), 80);
      }
    },
    onError: (error) => {
      setProviderShortlistError(error instanceof Error
        ? error.message
        : (isSpanish ? "No he podido guardar la seleccion." : "I could not save the shortlist."));
    },
  });

  const activeProviderShortlistMutation = useMutation({
    mutationFn: async ({
      item,
      shortlist,
      options,
      preferredProviderId,
    }: {
      item: ConciergePendingItem;
      shortlist: ProviderShortlistState;
      options: ProviderComparisonOption[];
      preferredProviderId?: string | null;
    }) => {
      if (!item.action_payload || options.length === 0) throw new Error("A shortlist needs at least one option");
      return patchPendingConciergeAction({
        pendingId: item.id,
        actionPayload: updateProviderShortlistPayload(item.action_payload, options, {
          preferredProviderId: preferredProviderId === undefined ? shortlist.preferredProviderId : preferredProviderId,
        }),
      });
    },
    onMutate: () => {
      setActiveProviderShortlistError(null);
      setActiveProviderShortlistNotice(null);
    },
    onSuccess: async () => {
      setActiveProviderShortlistNotice(isSpanish ? "Seleccion actualizada." : "Shortlist updated.");
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
    },
    onError: (error) => {
      setActiveProviderShortlistError(error instanceof Error ? error.message : (isSpanish ? "No he podido actualizar la seleccion." : "I could not update the shortlist."));
    },
  });

  const recheckProviderShortlistMutation = useMutation({
    mutationFn: async ({
      item,
      shortlist,
    }: {
      item: ConciergePendingItem;
      shortlist: ProviderShortlistState;
    }) => {
      if (!item.action_payload) throw new Error("Could not reopen provider shortlist");
      const mode = providerShortlistMode(shortlist);
      const criteria = (shortlist.context.criteria ?? []).filter(isProviderSearchCriterion);
      const query = shortlist.context.query?.trim() || providerSearchModeLabel(mode, isSpanish);
      const criteriaQuery = buildProviderSearchQuery(query, criteria, mode, isSpanish);
      const result = await searchOffers(
        criteriaQuery,
        language,
        undefined,
        buildProviderRecheckContext(shortlist),
        mode,
      );
      const latestOptions = buildProviderComparisonOptions(result.options);
      return patchPendingConciergeAction({
        pendingId: item.id,
        actionPayload: buildProviderShortlistRecheckPayload(item.action_payload, latestOptions),
      });
    },
    onMutate: () => {
      setActiveProviderShortlistError(null);
      setActiveProviderShortlistNotice(null);
    },
    onSuccess: async () => {
      setActiveProviderShortlistNotice(isSpanish
        ? "Comprobacion actualizada. Revisa los cambios antes de elegir."
        : "Latest check saved. Review any changes before choosing.");
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
    },
    onError: (error) => {
      setActiveProviderShortlistError(error instanceof Error
        ? error.message
        : (isSpanish ? "No he podido comprobar la seleccion." : "I could not check the shortlist."));
    },
  });

  const completeProviderShortlistMutation = useMutation({
    mutationFn: ({ item, shortlist, decision }: { item: ConciergePendingItem; shortlist: ProviderShortlistState; decision: "dismissed" | "preferred_selected" }) => {
      const preferred = shortlist.options.find((option) => option.id === shortlist.preferredProviderId) ?? null;
      return completePendingConciergeAction({
        pendingId: item.id,
        outcomeSummary: decision === "dismissed"
          ? "Provider shortlist dismissed."
          : `Provider selected: ${preferred?.name ?? "provider"}.`,
        outcomePayload: {
          ...(item.action_payload ?? {}),
          shortlist_status: decision,
          shortlist_completed_at: new Date().toISOString(),
          preferred_provider_id: preferred?.id ?? null,
          preferred_provider_name: preferred?.name ?? null,
          no_external_action_taken: true,
        },
      });
    },
    onMutate: () => {
      setActiveProviderShortlistError(null);
      setActiveProviderShortlistNotice(null);
    },
    onSuccess: async (_result, { decision }) => {
      setActiveProviderShortlistNotice(decision === "dismissed"
        ? (isSpanish ? "Seleccion descartada." : "Shortlist dismissed.")
        : (isSpanish ? "Eleccion guardada." : "Choice saved."));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
    onError: (error) => {
      setActiveProviderShortlistError(error instanceof Error ? error.message : (isSpanish ? "No he podido cerrar la seleccion." : "I could not finish the shortlist."));
    },
  });

  const dryRunOutcomeMutation = useMutation({
    mutationFn: ({ item }: { item: ConciergePendingItem }) => completePendingConciergeAction({
      pendingId: item.id,
      outcomeSummary: dryRunOutcomeSummary(item, isSpanish),
      outcomePayload: dryRunOutcomePayload(item),
    }),
    onMutate: () => {
      setDryRunOutcomeNotice(null);
      setDryRunOutcomeError(null);
    },
    onSuccess: async () => {
      setDryRunOutcomeNotice(isSpanish
        ? "Simulacion guardada en historial completado. No se contacto con ningun proveedor real."
        : "Simulation saved to completed history. No real provider was contacted.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
    onError: (error) => {
      setDryRunOutcomeError(error instanceof Error ? error.message : (isSpanish ? "No he podido guardar la simulacion." : "I could not save the simulation."));
    },
  });

  const transportOptionsMutation = useMutation({
    mutationFn: () => fetchTransportOptions({
      pickupAddress: transportPickup,
      destinationAddress: transportDestination,
      requestedTime: transportTime,
      mobilityNeeds: transportMobilityNeeds,
      hasSavedMobilityInfo: hasSavedTransportMobilityInfo,
      hasSavedTransportProvider,
      savedTransportProviderName: savedTransportProvider,
      locale,
    }),
    onMutate: () => {
      setTransportError(null);
      setTransportNotice(null);
      setTransportResult(null);
      resetTransportFinalReview();
    },
    onSuccess: (result) => {
      setTransportResult(result);
    },
    onError: (error) => {
      setTransportError(error instanceof Error ? error.message : (isSpanish ? "No he podido buscar transporte." : "I could not find transport options."));
    },
  });

  const prepareTransportMutation = useMutation({
    mutationFn: (option: TransportOption) => prepareTransportConciergeAction({
      option,
      pickupAddress: transportPickup,
      destinationAddress: transportDestination,
      requestedTime: transportTime,
      mobilityNeeds: transportMobilityNeeds,
      hasSavedMobilityInfo: hasSavedTransportMobilityInfo,
      hasSavedTransportProvider,
      savedTransportProviderName: savedTransportProvider,
      locale,
    }),
    onMutate: () => {
      setTransportError(null);
      setTransportNotice(null);
    },
    onSuccess: async (result, option) => {
      setTransportPreparedOption(option);
      setTransportPreparedResult(result);
      setTransportFinalForm({
        scheduledFor: "",
        pickup: transportPickup.trim() || savedTransportPickupLabel,
        destination: transportDestination.trim(),
        providerReply: "",
        priceEstimate: "",
        bookingReference: "",
        notes: "",
      });
      setTransportNotice(isSpanish
        ? "Solicitud preparada. Confirma el contacto en Ahora mismo; despues revisa y guarda el viaje."
        : "Ride request prepared. Confirm contact in Right now, then review and save the ride.");
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
    },
    onError: (error) => {
      setTransportError(error instanceof Error ? error.message : (isSpanish ? "No he podido preparar la solicitud." : "I could not prepare the request."));
    },
  });

  const saveTransportRideMutation = useMutation({
    mutationFn: saveConfirmedRide,
    onMutate: () => {
      setTransportError(null);
      setTransportNotice(null);
    },
    onSuccess: async (result) => {
      setTransportNotice(result.completionStatus === "closed"
        ? (isSpanish ? "Viaje guardado en Scheduled Support. La tarea queda cerrada." : "Ride saved in Scheduled Support. The task is closed.")
        : result.completionStatus === "review_pending"
          ? (isSpanish ? "Viaje guardado en Scheduled Support. Revisa la tarea pendiente." : "Ride saved in Scheduled Support. Please review the pending task.")
          : (isSpanish ? "Viaje guardado en Scheduled Support." : "Ride saved in Scheduled Support."));
      resetTransportFinalReview();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/profile/scheduled-events"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/scheduled-events"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
    onError: (error) => {
      setTransportError(error instanceof Error ? error.message : (isSpanish ? "No he podido guardar el viaje." : "I could not save the ride."));
    },
  });

  const prepareOtcPharmacyMutation = useMutation({
    mutationFn: () => prepareOtcPharmacyConciergeAction({
      pharmacyName: savedPharmacy || (isSpanish ? "Farmacia guardada" : "Saved pharmacy"),
      providerPhone: savedPharmacyProviderDetailsValue?.phone,
      providerEmail: savedPharmacyProviderDetailsValue?.email,
      providerWhatsapp: savedPharmacyProviderDetailsValue?.whatsapp,
      providerBookingUrl: savedPharmacyProviderDetailsValue?.bookingUrl || savedPharmacyProviderDetailsValue?.booking_url,
      preferredChannel: savedPharmacyProviderDetailsValue?.preferredChannel || savedPharmacyProviderDetailsValue?.preferred_channel,
      itemText: otcItemText,
      fulfillmentPreference: otcFulfillmentPreference,
      requestedTime: otcRequestedTime,
      notes: otcNotes,
      locale,
    }),
    onMutate: () => {
      setOtcError(null);
      setOtcNotice(null);
      resetOtcOutcomeReview();
    },
    onSuccess: async (result) => {
      setOtcPreparedResult(result);
      setOtcNotice(isSpanish
        ? "Solicitud OTC preparada. Confirma antes de que VYVA contacte con la farmacia."
        : "OTC request prepared. Confirm before VYVA contacts the pharmacy.");
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
    },
    onError: (error) => {
      setOtcError(error instanceof Error ? error.message : (isSpanish ? "No he podido preparar la solicitud OTC." : "I could not prepare the OTC request."));
    },
  });

  const saveOtcPharmacyOutcomeMutation = useMutation({
    mutationFn: () => {
      if (!otcPreparedResult?.pendingId) {
        throw new Error(isSpanish ? "Primero prepara la solicitud OTC." : "Prepare the OTC request first.");
      }
      return saveCompletedOtcPharmacyRequest({
        pendingId: otcPreparedResult.pendingId,
        pharmacyName: savedPharmacy || (isSpanish ? "Farmacia guardada" : "Saved pharmacy"),
        itemText: otcItemText,
        fulfillmentPreference: otcFulfillmentPreference,
        requestedTime: otcRequestedTime,
        availability: otcOutcomeForm.availability,
        costEstimate: otcOutcomeForm.costEstimate,
        fulfillmentNote: otcOutcomeForm.fulfillmentNote,
        reference: otcOutcomeForm.reference,
        notes: otcOutcomeForm.notes,
      });
    },
    onMutate: () => {
      setOtcError(null);
      setOtcNotice(null);
    },
    onSuccess: async () => {
      setOtcNotice(isSpanish
        ? "Respuesta de farmacia guardada. La tarea OTC queda cerrada."
        : "Pharmacy reply saved. The OTC task is closed.");
      resetOtcOutcomeReview();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
    onError: (error) => {
      setOtcError(error instanceof Error ? error.message : (isSpanish ? "No he podido guardar la respuesta OTC." : "I could not save the OTC reply."));
    },
  });

  const prepareToolGatedTaskMutation = useMutation({
    mutationFn: (prefill: ConciergeRoutePrefill) => {
      const readiness = routePrefillTaskReadiness(prefill);
      return prepareToolGatedConciergeTask({
        prefill,
        readiness,
        locale,
      });
    },
    onMutate: () => {
      setRoutePrefillError(null);
    },
    onSuccess: async (_result, prefill) => {
      setRoutePrefill(null);
      setIsRightNowHidden(false);
      const sourceShortlistId = typeof prefill.payload?.source_shortlist_pending_id === "string"
        ? prefill.payload.source_shortlist_pending_id.trim()
        : "";
      if (sourceShortlistId) {
        const sourceShortlistPayload = isRecord(prefill.payload?.source_shortlist_payload)
          ? prefill.payload.source_shortlist_payload
          : {};
        await patchPendingConciergeAction({
          pendingId: sourceShortlistId,
          actionPayload: {
            ...sourceShortlistPayload,
            shortlist_status: "contact_prepared",
            selected_provider_name: prefill.payload?.selected_provider_name ?? null,
            related_contact_task_pending_id: _result.pendingId ?? null,
            contact_handoff_status: "ready_for_confirmation",
            confirmation_still_required: true,
            no_external_action_taken: true,
          },
        });
      }
      if (_result.pendingId) setVisibleActionId(_result.pendingId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
      ]);
    },
    onError: (error) => {
      setRoutePrefillError(error instanceof Error ? error.message : (isSpanish ? "No he podido preparar la tarea." : "I could not prepare the task."));
    },
  });

  const isMedicalAppointmentIntent = appointmentIntentType === "medical";
  const shouldShowCoverageReadiness = isMedicalAppointmentIntent && !hasAppointmentCoverageInfo;
  const canSaveCoverageReadiness = coverageType !== "unknown"
    || coverageProvider.trim().length > 0
    || coverageMemberId.trim().length > 0
    || coveragePlan.trim().length > 0;
  const isHomeServiceAppointment = appointmentIntentType === "home-service";
  const isHomeServiceIntakeActive = isHomeServiceAppointment && Boolean(homeServiceType);
  const isHomeServiceWithoutProvider = isHomeServiceAppointment && Boolean(appointmentRequest) && appointmentOptions.length === 0 && !appointmentAttemptResult;
  const isMedicalAppointmentWithoutProvider = appointmentIntentType === "medical" && Boolean(appointmentRequest) && appointmentOptions.length === 0 && !hasSavedMedicalProvider && !appointmentAttemptResult;
  const AppointmentPanelIcon = isHomeServiceAppointment ? Wrench : Calendar;
  const appointmentPanelKicker = isHomeServiceAppointment
    ? (isSpanish ? "Servicio" : "Service")
    : (isSpanish ? "Cita" : "Appointment");
  const appointmentPanelTitle = isHomeServiceAppointment
    ? (isSpanish ? "En casa" : "Home service")
    : (isSpanish ? "Programar" : "Schedule");
  const appointmentDetailLabel = isHomeServiceAppointment
    ? (isSpanish ? "Que ha pasado?" : "What happened?")
    : (isSpanish ? "Detalle opcional" : "Optional detail");
  const appointmentDetailPlaceholder = isHomeServiceAppointment
    ? (isSpanish ? "Ej. fuga bajo el fregadero, atasco, sin agua caliente" : "E.g. leaking sink, blocked toilet, no hot water")
    : (isSpanish ? "Ej. dermatologia, martes por la manana, WhatsApp si se puede" : "E.g. dermatology, Tuesday morning, WhatsApp if possible");
  const noSavedProviderTitle = isHomeServiceAppointment
    ? (isSpanish ? "Sin opcion clara todavia" : "No clear option yet")
    : (isSpanish ? "No hay proveedor de confianza elegido." : "No trusted provider selected.");
  const noSavedProviderBody = isHomeServiceAppointment
    ? (isSpanish
      ? "VYVA puede buscar opciones fiables cerca antes de contactar con nadie."
      : "VYVA can search trusted nearby options before anyone is contacted.")
    : isMedicalAppointmentWithoutProvider
      ? (isSpanish
        ? "Anade o elige un medico o clinica de confianza, o busca opciones para revisar."
        : "Add or choose a trusted doctor or clinic, or look for options to review.")
      : null;
  const appointmentDiscoverLabel = isHomeServiceAppointment
    ? (isSpanish ? "Buscar opciones fiables" : "Find trusted options")
    : (isSpanish ? "Buscar opciones" : "Look for options");
  const appointmentPrepareLabel = isHomeServiceAppointment
    ? (isSpanish ? "Preparar mensaje" : "Prepare message")
    : (isSpanish ? "Prepararlo por chat" : "Prepare in chat");
  const appointmentFinalReviewTitle = isHomeServiceAppointment
    ? (isSpanish ? "Revisar y confirmar visita" : "Review and confirm visit")
    : (isSpanish ? "Revisar y confirmar cita" : "Review and confirm appointment");
  const appointmentFinalReviewBody = isHomeServiceAppointment
    ? (isSpanish
      ? "Cuando el proveedor responda, guarda aqui la hora, lugar, precio o preparacion. Nada queda final hasta que confirmes."
      : "When the provider replies, save the time, place, price, or prep here. Nothing is final until you confirm.")
    : (isSpanish
      ? "Cuando el proveedor responda, guarda aqui la hora, lugar y cualquier instruccion. Nada queda final hasta que confirmes."
      : "When the provider replies, save the time, place, and any instructions here. Nothing is final until you confirm.");
  const appointmentFinalSaveLabel = isHomeServiceAppointment
    ? (isSpanish ? "Guardar visita confirmada" : "Save confirmed visit")
    : (isSpanish ? "Guardar cita confirmada" : "Save confirmed appointment");
  const showAppointmentStatusMessage = Boolean(
    appointmentError
    || createAppointmentMutation.isPending
    || discoverAppointmentOptionsMutation.isPending
    || (appointmentNotice && !(isHomeServiceWithoutProvider && !appointmentDiscovery)),
  );
  const homeServiceQuestions = useMemo(
    () => homeServiceType ? homeServiceQuestionsFor(homeServiceType, homeServiceIntakeAnswers) : [],
    [homeServiceIntakeAnswers, homeServiceType],
  );
  const isHomeServiceElectricalDanger = homeServiceType === "electrician" &&
    (homeServiceIntakeAnswers.safety_risk === "danger_now" || homeServiceIntakeAnswers.safety_risk === "hazard");
  const hasHomeServicePoweredMedicalEquipment = homeServiceType === "electrician" && homeServiceIntakeAnswers.medical_device === "yes";
  const activeHomeServiceQuestion = useMemo(
    () => isHomeServiceElectricalDanger ? null : homeServiceQuestions.find((question) => !homeServiceIntakeAnswers[question.key]) ?? null,
    [homeServiceIntakeAnswers, homeServiceQuestions, isHomeServiceElectricalDanger],
  );
  const answeredHomeServiceQuestionCount = homeServiceQuestions.filter((question) => homeServiceIntakeAnswers[question.key]).length;
  const isHomeServiceQuestionSetComplete = Boolean(
    !isHomeServiceElectricalDanger
    && homeServiceType
    && homeServiceQuestions.length > 0
    && answeredHomeServiceQuestionCount === homeServiceQuestions.length,
  );
  const homeServiceNeedsVisitAddress = Boolean(isHomeServiceQuestionSetComplete && !homeServiceVisitAddress.trim());
  const isHomeServiceIntakeComplete = Boolean(isHomeServiceQuestionSetComplete && !homeServiceNeedsVisitAddress);
  const homeServiceCurrentStep = homeServiceQuestions.length > 0
    ? Math.min(answeredHomeServiceQuestionCount + (activeHomeServiceQuestion ? 1 : 0), homeServiceQuestions.length)
    : 0;
  const homeServiceProgressPercent = homeServiceQuestions.length > 0
    ? Math.round((homeServiceCurrentStep / homeServiceQuestions.length) * 100)
    : 0;
  const homeServiceProgressLabel = homeServiceQuestions.length > 0
    ? (isHomeServiceIntakeComplete
      ? (isSpanish ? "Listo" : "Ready")
      : isSpanish
        ? `Paso ${homeServiceCurrentStep} de ${homeServiceQuestions.length}`
        : `Step ${homeServiceCurrentStep} of ${homeServiceQuestions.length}`)
    : "";
  const homeServiceCompletedLabel = homeServiceQuestions.length > 0
    ? (isSpanish
      ? `${answeredHomeServiceQuestionCount} de ${homeServiceQuestions.length} listo`
      : `${answeredHomeServiceQuestionCount} of ${homeServiceQuestions.length} done`)
    : "";
  const homeServiceNeededLabel = homeServiceType === "other" && homeServiceIntakeAnswers.service_needed && homeServiceIntakeAnswers.service_needed !== "skip"
    ? homeServiceIntakeAnswers.service_needed.trim()
    : "";
  const homeServiceSafetyFlags = useMemo(() => {
    if (!homeServiceType) return [];
    return buildHomeServiceIntake({
      origin: homeServiceIntakeOrigin,
      serviceType: homeServiceType,
      urgency: homeServiceIntakeAnswers.urgency,
      criteria: homeServiceIntakeAnswers.criteria,
      answers: homeServiceIntakeAnswers,
      language: locale,
    }).safety_flags;
  }, [homeServiceIntakeAnswers, homeServiceIntakeOrigin, homeServiceType, locale]);
  const { data: homeServiceEmergencyState, isLoading: homeServiceEmergencyContactLoading } = useQuery<ConciergeOnboardingState>({
    queryKey: ["/api/onboarding/state", "home-service-emergency"],
    queryFn: async () => {
      const response = await apiFetch("/api/onboarding/state");
      if (!response.ok) throw new Error(`onboarding-state ${response.status}`);
      return response.json();
    },
    enabled: isHomeServiceElectricalDanger || homeServiceIntakeAnswers.immediate_danger === "yes",
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
  const homeServiceLocalEmergency = emergencyContactForCountry(homeServiceEmergencyState?.profile?.country);
  const homeServiceEmergencyContact = conciergeEmergencyContactFromState(homeServiceEmergencyState);
  const homeServiceEmergencyContactHref = sanitizePhoneHref(homeServiceEmergencyContact?.phone);

  useEffect(() => {
    if (!appointmentOpen || !isHomeServiceAppointment) {
      setHomeServiceGuideOpen(false);
      return;
    }

    if (!homeServiceGuideHidden && !homeServiceGuideDismissed) {
      setHomeServiceGuideOpen(true);
    }
  }, [appointmentOpen, homeServiceGuideDismissed, homeServiceGuideHidden, isHomeServiceAppointment]);

  function dismissHomeServiceGuide() {
    setHomeServiceGuideOpen(false);
    setHomeServiceGuideDismissed(true);

    if (!homeServiceGuideNeverShow) return;

    try {
      localStorage.setItem(HOME_SERVICE_GUIDE_STORAGE_KEY, "true");
    } catch {
      // Ignore storage failures; the current session dismissal still applies.
    }
    setHomeServiceGuideHidden(true);
  }

  useEffect(() => {
    if (pendingActions.length === 0) {
      setVisibleActionId(null);
      setIsRightNowHidden(false);
      return;
    }

    setVisibleActionId((currentId) => {
      if (currentId && pendingActions.some((action) => action.id === currentId)) {
        return currentId;
      }
      return pendingActions[0]?.id ?? null;
    });
  }, [pendingActions]);

  useEffect(() => {
    currentLocaleRef.current = language;
  });

  const resetHomeServiceIntake = useCallback((origin: ServiceIntakeOrigin = "app", serviceType: HomeServiceType | null = null) => {
    setHomeServiceIntakeOrigin(origin);
    setHomeServiceType(serviceType);
    setHomeServiceIntakeAnswers({});
    setHomeServiceTextDrafts({});
  }, []);

  const clearAppointmentAssistantState = useCallback(() => {
    setHomeServiceCanvasMode(false);
    setHomeServiceCanvasStep(null);
    clearVoiceCanvasScene({ owner: "concierge_home_service" });
    setAppointmentCanvasMode(false);
    setAppointmentCanvasStep(null);
    clearVoiceCanvasScene({ owner: "concierge_appointment" });
    setAppointmentOpen(false);
    setSelectedAppointmentChip(null);
    setAppointmentNote("");
    resetHomeServiceIntake("app", null);
    setHomeServiceCanvasPhoto(null);
    setHomeServiceCanvasPhotoName("");
    setHomeServiceCanvasError(null);
    setAppointmentRequest(null);
    setAppointmentOptions([]);
    setAppointmentDiscovery(null);
    setSelectedAppointmentOptionId(null);
    setAppointmentAttemptResult(null);
    setAppointmentNotice(null);
    setAppointmentError(null);
    setAppointmentBookedForm({ scheduledFor: "", location: "", providerReply: "", reference: "", notes: "" });
  }, [resetHomeServiceIntake]);

  useEffect(() => {
    if (!conciergeVoiceAction || !conciergeVoiceDraft) return;
    const mayBeHomeServiceRequest = conciergeVoiceAction.actionType === "concierge.home_service"
      || /home service|plumb|fontaner|electric|electricista|locksmith|cerraj|clean|limpiez|repair|repar|handyman|manitas/i.test(`${conciergeVoiceAction.sourceText} ${conciergeVoiceTaskType} ${conciergeVoiceServiceType}`);
    if (mayBeHomeServiceRequest && homeServiceCanvasRolloutQuery.isLoading) return;
    const actionKey = `${conciergeVoiceAction.id}:${conciergeVoiceAction.sourceText}`;
    if (lastAppliedConciergeVoiceActionRef.current === actionKey) return;

    const voiceText = [
      conciergeVoiceAction.sourceText,
      conciergeVoiceTaskType,
      conciergeVoiceServiceType,
      conciergeVoiceProvider,
      conciergeVoiceReason,
    ].join(" ").toLowerCase();
    const isAppointmentRequest =
      conciergeVoiceAction.actionType === "concierge.appointment_help"
      || conciergeVoiceTaskType.toLowerCase().includes("appointment")
      || conciergeVoiceTaskType.toLowerCase().includes("cita");
    const isHomeServiceVoiceRequest =
      conciergeVoiceAction.actionType === "concierge.home_service"
      || /home service|plumb|fontaner|electric|electricista|locksmith|cerraj|clean|limpiez|repair|repar|handyman|manitas/.test(voiceText);
    const isRideVoiceRequest =
      conciergeVoiceAction.actionType === "concierge.ride_booking"
      || conciergeVoiceTaskType.toLowerCase().includes("ride")
      || conciergeVoiceTaskType.toLowerCase().includes("transport")
      || conciergeVoiceTaskType.toLowerCase().includes("taxi");
    const isReminderVoiceRequest = conciergeVoiceAction.actionType === "concierge.reminder";
    const isMedicalAppointmentVoiceRequest = isAppointmentRequest && !isHomeServiceVoiceRequest;

    if (mode === "home") {
      if (isReminderVoiceRequest) {
        navigate(conciergeTaskPath(), {
          state: {
            conciergePrefill: { kind: "task", message: conciergeVoiceDraft, source: "voice_action" },
          },
        });
      } else {
        const conciergeTaskEntry: ConciergeTaskEntry = isRideVoiceRequest
          ? { kind: "transport" }
          : isHomeServiceVoiceRequest
            ? { kind: "home_service" }
            : { kind: "appointment", appointmentKind: "medical" };
        navigate(conciergeTaskPath(), { state: { conciergeTaskEntry } });
      }
      return;
    }

    lastAppliedConciergeVoiceActionRef.current = actionKey;

    if (!isRideVoiceRequest && rideCanvasMode) {
      setRideCanvasMode(false);
      setRideCanvasStep(null);
      clearVoiceCanvasScene({ owner: "concierge_ride" });
    }
    if (!isMedicalAppointmentVoiceRequest && appointmentCanvasMode) {
      setAppointmentCanvasMode(false);
      setAppointmentCanvasStep(null);
      clearVoiceCanvasScene({ owner: "concierge_appointment" });
    }
    if (!isHomeServiceVoiceRequest && homeServiceCanvasMode) {
      setHomeServiceCanvasMode(false);
      setHomeServiceCanvasStep(null);
      clearVoiceCanvasScene({ owner: "concierge_home_service" });
    }

    if (isRideVoiceRequest) {
      setHomeServiceCanvasMode(false);
      setHomeServiceCanvasStep(null);
      clearVoiceCanvasScene({ owner: "concierge_home_service" });
      setAppointmentCanvasMode(false);
      setAppointmentCanvasStep(null);
      clearVoiceCanvasScene({ owner: "concierge_appointment" });
      setRideCanvasMode(true);
      setRideCanvasSelectedOptionId(null);
      advanceRideCanvas(conciergeVoiceDestination.trim() ? "pickup" : "destination");
      setRoutePrefill({ kind: "ride", message: conciergeVoiceDraft, source: "voice_action" });
      clearAppointmentAssistantState();
      setTransportPickup((current) => current.trim() ? current : conciergeVoicePickup || savedTransportPickupLabel);
      setTransportDestination((current) => current.trim() ? current : conciergeVoiceDestination);
      setTransportTime((current) => {
        if (current.trim() && current.trim().toLowerCase() !== "now") return current;
        return conciergeVoiceTime || "now";
      });
      setTransportMobilityNeeds((current) => {
        if (current.length > 0) return current;
        return splitRoutePayloadList(conciergeVoiceMobilityNeeds);
      });
      setTransportResult(null);
      setTransportError(null);
      setTransportNotice(null);
      setTransportDetailsOpen(true);
      setOffersOpen(false);
    } else if (isReminderVoiceRequest) {
      setHomeServiceCanvasMode(false);
      setHomeServiceCanvasStep(null);
      clearVoiceCanvasScene({ owner: "concierge_home_service" });
      setAppointmentCanvasMode(false);
      setAppointmentCanvasStep(null);
      clearVoiceCanvasScene({ owner: "concierge_appointment" });
      setRideCanvasMode(false);
      setRideCanvasStep(null);
      clearVoiceCanvasScene({ owner: "concierge_ride" });
      setRoutePrefill({ kind: "task", message: conciergeVoiceDraft, source: "voice_action" });
      clearAppointmentAssistantState();
      setOffersOpen(false);
    } else if (isAppointmentRequest || isHomeServiceVoiceRequest) {
      setRideCanvasMode(false);
      setRideCanvasStep(null);
      clearVoiceCanvasScene({ owner: "concierge_ride" });
      setAppointmentOpen(true);
      setOffersOpen(false);
      if (isHomeServiceVoiceRequest) {
        const homeServiceChip = APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === "home-service") ?? APPOINTMENT_TYPE_CHIPS[0];
        const serviceTypeSource = conciergeVoiceServiceType || conciergeVoiceReason || conciergeVoiceAction.sourceText;
        const hasSpecificServiceType = Boolean(conciergeVoiceServiceType.trim())
          || /plumb|fontaner|electric|electricista|locksmith|cerraj|clean|limpiez|handyman|manitas|other service|otro servicio/i.test(serviceTypeSource);
        const serviceType = hasSpecificServiceType ? normalizeHomeServiceType(serviceTypeSource) : null;
        const nextAnswers: Record<string, string> = {};
        HOME_SERVICE_VOICE_ANSWER_KEYS.forEach((key) => {
          const value = conciergePayloadValue(key);
          if (value) nextAnswers[key] = value;
        });
        if (conciergeVoiceUrgency) nextAnswers.urgency = conciergeVoiceUrgency;
        if (conciergeVoiceCriteria) nextAnswers.criteria = conciergeVoiceCriteria;
        if (conciergeVoiceReason && !nextAnswers.problem_summary) nextAnswers.problem_summary = conciergeVoiceReason;
        setSelectedAppointmentChip(homeServiceChip);
        setHomeServiceIntakeOrigin("voice");
        setHomeServiceType(serviceType);
        setHomeServiceIntakeAnswers((current) => ({ ...nextAnswers, ...current }));
        setHomeServiceTextDrafts((current) => ({ ...nextAnswers, ...current }));
        setAppointmentNote("");
        setHomeServiceCanvasMode(homeServiceCanvasEnabled);
        setHomeServiceCanvasPhoto(null);
        setHomeServiceCanvasPhotoName("");
        setHomeServiceCanvasError(null);
        if (homeServiceCanvasEnabled) advanceHomeServiceCanvas(serviceType
          ? (nextAnswers.problem_summary ? "danger" : "description")
          : "service");
        else setHomeServiceCanvasStep(null);
      } else {
        setHomeServiceCanvasMode(false);
        setHomeServiceCanvasStep(null);
        clearVoiceCanvasScene({ owner: "concierge_home_service" });
        const reason = conciergeVoiceReason.trim() || conciergeVoiceDraft.trim();
        const requestedTime = [conciergeVoiceDate.trim(), conciergeVoiceTime.trim()].filter(Boolean).join(" ");
        setSelectedAppointmentChip(APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === "medical") ?? APPOINTMENT_TYPE_CHIPS[0]);
        setAppointmentNote((current) => current.trim() ? current : reason);
        setAppointmentCanvasRequestedTime((current) => current.trim() ? current : requestedTime);
        setAppointmentCanvasCoverageLabel((current) => current.trim() ? current : "");
        setAppointmentCanvasMode(true);
        advanceAppointmentCanvas(reason ? (requestedTime ? "coverage" : "time") : "reason");
      }
    }

    setInput((current) => current.trim() ? current : conciergeVoiceDraft);
    window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
  }, [
    advanceAppointmentCanvas,
    advanceHomeServiceCanvas,
    advanceRideCanvas,
    appointmentCanvasMode,
    conciergePayloadValue,
    clearAppointmentAssistantState,
    conciergeVoiceAction,
    conciergeVoiceCriteria,
    conciergeVoiceDate,
    conciergeVoiceDestination,
    conciergeVoiceDraft,
    conciergeVoiceMobilityNeeds,
    conciergeVoicePickup,
    conciergeVoiceProvider,
    conciergeVoiceReason,
    conciergeVoiceServiceType,
    conciergeVoiceTime,
    conciergeVoiceTaskType,
    conciergeVoiceUrgency,
    homeServiceCanvasEnabled,
    homeServiceCanvasRolloutQuery.isLoading,
    rideCanvasMode,
    homeServiceCanvasMode,
    mode,
    navigate,
    savedTransportPickupLabel,
  ]);

  useEffect(() => {
    const routeState = location.state as ConciergeLocationState;
    if (!routeState?.focusRightNow) return undefined;
    const pendingId = typeof routeState.conciergePendingId === "string" ? routeState.conciergePendingId.trim() : "";
    if (mode === "home" && pendingId) {
      navigate(conciergeTaskPath(pendingId), { replace: true, state: null });
      return undefined;
    }
    if (pendingId && pendingActions.some((item) => item.id === pendingId)) {
      setVisibleActionId(pendingId);
    }
    setIsRightNowHidden(false);
    const timer = window.setTimeout(() => {
      scrollIntoViewIfAvailable(rightNowSectionRef.current, { behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [location.state, mode, navigate, pendingActions]);

  useEffect(() => {
    if (mode !== "task" || !taskId || taskId === "new") return;
    const routedPendingId = persistedTask?.linked_pending_id ?? taskId;
    if (pendingActions.some((item) => item.id === routedPendingId)) {
      setVisibleActionId(routedPendingId);
      setIsRightNowHidden(false);
    }
  }, [mode, pendingActions, persistedTask?.linked_pending_id, taskId]);

  useEffect(() => {
    const routeState = location.state as ConciergeLocationState;
    const savedProvider = coerceTrustedProviderSavedRoute(routeState?.trustedProviderSaved);
    if (!savedProvider) {
      if (routeState?.trustedProviderSaved) {
        navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
      }
      return;
    }

    if (mode === "home") {
      navigate(conciergeTaskPath(), { replace: true, state: location.state });
      return;
    }

    const resumeKey = `${savedProvider.category}:${savedProvider.name}`;
    if (lastTrustedProviderSavedKeyRef.current === resumeKey) return;
    lastTrustedProviderSavedKeyRef.current = resumeKey;
    setTrustedProviderResume(savedProvider);
    void queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    setIsRightNowHidden(false);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, mode, navigate, queryClient]);

  useEffect(() => {
    const routeState = location.state as ConciergeLocationState;
    const setupHelp = coerceProviderSetupHelpRequestedRoute(routeState?.providerSetupHelpRequested);
    if (!setupHelp) {
      if (routeState?.providerSetupHelpRequested) {
        navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
      }
      return;
    }

    if (mode === "home") {
      navigate(conciergeTaskPath(), { replace: true, state: location.state });
      return;
    }

    const setupHelpKey = `${setupHelp.setupReason}:${setupHelp.helperName ?? ""}:${JSON.stringify(setupHelp.conciergeResume ?? {})}`;
    if (lastProviderSetupHelpRequestedKeyRef.current === setupHelpKey) return;
    lastProviderSetupHelpRequestedKeyRef.current = setupHelpKey;
    setProviderSetupHelpRequest(setupHelp);
    setIsRightNowHidden(false);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, mode, navigate]);

  useEffect(() => {
    const routeState = location.state as ConciergeLocationState;
    const template = coerceConciergeCompletedTemplate(routeState?.conciergeCompletedTemplate);
    if (!template) {
      if (routeState?.conciergeCompletedTemplate) {
        navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
      }
      return;
    }

    if (mode === "home") {
      navigate(conciergeTaskPath(), { replace: true, state: location.state });
      return;
    }

    const templateKey = `${template.id}:${template.completed_at ?? ""}:${JSON.stringify(template.outcome_payload ?? {})}`;
    if (lastCompletedTemplateKeyRef.current === templateKey) return;
    lastCompletedTemplateKeyRef.current = templateKey;
    handleCompletedSessionUseTemplate(template);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, location.state, mode, navigate]);

  useEffect(() => {
    const routeState = location.state as ConciergeLocationState;
    const prefill = coerceConciergeRoutePrefill(routeState?.conciergePrefill);
    if (!prefill) {
      if (routeState?.conciergePrefill) {
        navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
      }
      return;
    }
    if (mode === "home") {
      navigate(conciergeTaskPath(), { replace: true, state: location.state });
      return;
    }
    const message = prefill.message;
    const prefillKey = `${prefill.kind}:${message}`;
    if (lastRoutePrefillKeyRef.current === prefillKey) return;

    lastRoutePrefillKeyRef.current = prefillKey;
    const nextPrefill = { ...prefill, message };
    setRoutePrefill(nextPrefill);
    setInput((current) => current.trim() ? current : message);
    setOffersOpen(false);
    setAppointmentOpen(prefill.kind === "appointment");
    setAppointmentNote((current) => current.trim() ? current : message);
    if (prefill.kind === "ride") {
      const routePickup = routePayloadString(routeState, "pickup");
      const routeDestination = routePayloadString(routeState, "destination") || inferRideDestinationFromMessage(message);
      const routeTime = routePayloadString(routeState, "time")
        || routePayloadString(routeState, "requested_time")
        || inferRideTimeFromMessage(message);
      const routeMobilityNeeds = splitRoutePayloadList(routePayloadString(routeState, "mobility_needs"));
      setTransportPickup(routePickup || savedTransportPickupLabel);
      setTransportDestination(routeDestination);
      setTransportResult(null);
      setTransportError(null);
      setTransportNotice(null);
      setTransportTime(routeTime || "now");
      setTransportMobilityNeeds(routeMobilityNeeds);
      setTransportDetailsOpen(true);
      if (prefill.source === "voice_action") {
        setRideCanvasMode(true);
        setRideCanvasSelectedOptionId(null);
        advanceRideCanvas(routeDestination ? "pickup" : "destination");
      }
    } else if (rideCanvasMode) {
      setRideCanvasMode(false);
      setRideCanvasStep(null);
      clearVoiceCanvasScene({ owner: "concierge_ride" });
    }

    window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [advanceRideCanvas, location.pathname, location.search, location.state, mode, navigate, rideCanvasMode, savedTransportPickupLabel]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(chatHistoryKey(language));
      if (raw) {
        const stored = JSON.parse(raw) as StoredChatHistory;
        const age = Date.now() - new Date(stored.savedAt).getTime();
        if (Array.isArray(stored.messages) && stored.messages.length > 0 && age < CHAT_MAX_AGE_MS) {
          setMessages(stored.messages);
          setHasRestoredHistory(true);
          return;
        }
        localStorage.removeItem(chatHistoryKey(language));
      }
    } catch {
      // Ignore corrupt cache.
    }
    setMessages([]);
    setHasRestoredHistory(false);
  }, [language]);

  useEffect(() => {
    if (!saveReadyRef.current) {
      saveReadyRef.current = true;
      return;
    }
    if (messages.length === 0) return;
    try {
      const stored: StoredChatHistory = { savedAt: new Date().toISOString(), messages };
      localStorage.setItem(chatHistoryKey(currentLocaleRef.current), JSON.stringify(stored));
    } catch {
      // Ignore storage errors.
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  function handleNewConversation() {
    setMessages([]);
    setHasRestoredHistory(false);
    try {
      localStorage.removeItem(chatHistoryKey(language));
    } catch {
      // Ignore.
    }
  }

  async function sendMessage(text: string, history: ChatMessage[]) {
    const myReqId = ++reqIdRef.current;
    setChatLoading(true);
    setChatError(null);
    try {
      const response = await callConcierge(text, history, language);
      if (reqIdRef.current !== myReqId) return;
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch {
      if (reqIdRef.current !== myReqId) return;
      setChatError(t("concierge.errorMsg"));
    } finally {
      if (reqIdRef.current === myReqId) setChatLoading(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    sendMessage(text, nextHistory);
  }

  function sendPrefillToConcierge() {
    const text = routePrefill?.message.trim() || input.trim();
    if (!text || chatLoading) return;
    if (routePrefill?.kind === "task") {
      prepareToolGatedTaskMutation.mutate(routePrefill);
      return;
    }
    if (routePrefill?.kind === "appointment") {
      const chip = APPOINTMENT_TYPE_CHIPS[0];
      setSelectedAppointmentChip(chip);
      setAppointmentOpen(true);
      setAppointmentNote(text);
      setInput((current) => current.trim() ? current : text);
      setRoutePrefill(null);
      createAppointmentMutation.mutate({
        appointmentType: chip.key,
        detail: text,
        routePrefillSource: routePrefill.source,
        locale,
      });
      return;
    }
    if (routePrefill?.kind === "home_care_quote") {
      const chip = APPOINTMENT_TYPE_CHIPS.find((item) => item.key === "home-service") ?? APPOINTMENT_TYPE_CHIPS[0];
      setSelectedAppointmentChip(chip);
      setAppointmentOpen(true);
      setAppointmentNote(text);
      setInput((current) => current.trim() ? current : text);
      setRoutePrefill(null);
      createAppointmentMutation.mutate({
        appointmentType: "home-service",
        detail: text,
        preferences: {
          flow_reference: routePrefill.flowReference ?? CONCIERGE_FLOW_REFERENCES.homeService,
          safety_source: routePrefill.source ?? "safe_home",
          action_label: routePrefill.actionLabel ?? null,
          summary: routePrefill.summary ?? null,
        },
        flowReference: routePrefill.flowReference ?? CONCIERGE_FLOW_REFERENCES.homeService,
        routePrefillSource: routePrefill.source,
        locale,
      });
      return;
    }
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setRoutePrefill(null);
    setAppointmentOpen(false);
    sendMessage(text, nextHistory);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function resetProviderShortlistState() {
    setProviderShortlistIds([]);
    setProviderShortlistNotice(null);
    setProviderShortlistError(null);
  }

  function openSavingsPanel(query?: string) {
    setOffersOpen(true);
    setSavingsPanelView("overview");
    setProviderSearchMode(null);
    setProviderSearchCriteria(DEFAULT_PROVIDER_SEARCH_CRITERIA);
    setAppointmentOpen(false);
    setInsuranceAdminOpen(false);
    setScamCheckOpen(false);
    setOtcPharmacyOpen(false);
    setOffersError(null);
    resetProviderShortlistState();
    if (query) {
      setOffersQuery(query);
      return;
    }
    if (!offersQuery) {
      setOffersQuery(isSpanish
        ? "reducir gastos mensuales y revisar servicios importantes"
        : "reduce monthly costs and review important services");
    }
  }

  function openProviderSearchPanel(mode: ProviderSearchMode, query: string) {
    setOffersOpen(true);
    setSavingsPanelView("overview");
    setProviderSearchMode(mode);
    setProviderSearchCriteria(DEFAULT_PROVIDER_SEARCH_CRITERIA);
    setAppointmentOpen(false);
    setInsuranceAdminOpen(false);
    setScamCheckOpen(false);
    setOtcPharmacyOpen(false);
    setOffersError(null);
    setOffersResult(null);
    setBillAnalysis(null);
    setUtilityResult(null);
    setObjectiveProofOpen(false);
    resetProviderShortlistState();
    setOffersQuery(query);
  }

  function findTransportProviderOptions() {
    openProviderSearchPanel(
      "transport",
      transportDestination.trim()
        ? (isSpanish
          ? `Transporte de confianza cerca para ir a ${transportDestination.trim()}`
          : `Trusted transport nearby to ${transportDestination.trim()}`)
        : (isSpanish ? "Taxi o transporte de confianza cerca" : "Trusted taxi or transport nearby"),
    );
  }

  function findOtcPharmacyOptions() {
    openProviderSearchPanel(
      "pharmacy",
      otcItemText.trim()
        ? (isSpanish
          ? `Farmacia cercana para productos sin receta: ${otcItemText.trim()}`
          : `Nearby pharmacy for over-the-counter items: ${otcItemText.trim()}`)
        : (isSpanish ? "Farmacia cercana para productos sin receta" : "Nearby pharmacy for over-the-counter items"),
    );
  }

  function toggleProviderSearchCriterion(key: ProviderSearchCriterionKey) {
    setProviderSearchCriteria((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  }

  function openAppointmentAssistant() {
    setAppointmentOpen(true);
    setOffersOpen(false);
    setProviderSearchMode(null);
    setInsuranceAdminOpen(false);
    setScamCheckOpen(false);
    setOtcPharmacyOpen(false);
    setAppointmentError(null);
  }

  function setHomeServiceAnswer(key: string, value: string) {
    setHomeServiceIntakeAnswers((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function buildCurrentHomeServiceIntake() {
    const visitAddress = homeServiceVisitAddress.trim();
    const answerSource = visitAddress && !homeServiceIntakeAnswers.home_address?.trim()
      ? { home_address: visitAddress }
      : {};
    const intake = buildHomeServiceIntake({
      origin: homeServiceIntakeOrigin,
      serviceType: homeServiceType,
      urgency: homeServiceIntakeAnswers.urgency,
      criteria: homeServiceIntakeAnswers.criteria,
      answers: {
        ...homeServiceIntakeAnswers,
        ...answerSource,
      },
      language: locale,
    });
    return {
      intake,
      preferences: {
        service_intake: intake,
        requested_time: homeServiceIntakeAnswers.requested_time?.trim() || null,
        home_access_or_safety_notes: homeServiceIntakeAnswers.access_notes?.trim() || null,
        photo_name: homeServiceCanvasPhotoName || null,
        photo_ready: Boolean(homeServiceCanvasPhoto),
        no_external_action_without_confirmation: true,
        ...(visitAddress ? {
          home_address: visitAddress,
          home_address_source: homeServiceAddressSource || "session",
        } : {}),
      },
    };
  }

  useEffect(() => {
    const draft = activeHomeServiceDraftQuery.data;
    if (!draft?.request || homeServiceDraftRestoreAppliedRef.current || homeServiceCanvasMode || conciergeVoiceAction) return;
    if (!isRestorableHomeServiceRequestStatus(draft.request.status)) return;
    const intake = homeServiceIntakeFromPreferences(draft.request.preferences);
    if (!intake) return;
    homeServiceDraftRestoreAppliedRef.current = true;
    const preferences = draft.request.preferences ?? {};
    const requestedTime = typeof preferences.requested_time === "string" ? preferences.requested_time : "";
    const accessNotes = typeof preferences.home_access_or_safety_notes === "string" ? preferences.home_access_or_safety_notes : "";
    const photoName = typeof preferences.photo_name === "string" ? preferences.photo_name : "";
    const answers = {
      ...intake.answers,
      ...(requestedTime ? { requested_time: requestedTime } : {}),
      ...(accessNotes ? { access_notes: accessNotes } : {}),
    };
    const nextStep: ConciergeHomeServiceCanvasStep = draft.options.length > 0
      ? "options"
      : draft.request.status === "needs_provider"
        ? "provider"
        : !intake.service_type
          ? "service"
          : !answers.problem_summary
            ? "description"
            : !answers.immediate_danger
              ? "danger"
              : answers.immediate_danger === "yes" || answers.immediate_danger === "not_sure"
                ? "emergency"
              : !answers.safety_check
                ? "safety"
                : answers.safety_check === "yes" || answers.safety_check === "not_sure"
                  ? "emergency"
                : !answers.urgency
                  ? "urgency"
                  : !answers.requested_time
                    ? "time"
                    : !Object.prototype.hasOwnProperty.call(answers, "access_notes")
                      ? "access"
                      : !homeServiceAddressFromPreferences(preferences)
                        ? "location"
                        : "provider";
    setAppointmentOpen(true);
    setSelectedAppointmentChip(APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === "home-service") ?? APPOINTMENT_TYPE_CHIPS[0]);
    setAppointmentRequest(draft.request);
    setAppointmentOptions(draft.options);
    setSelectedAppointmentOptionId(draft.options[0]?.id ?? null);
    setHomeServiceType(intake.service_type);
    setHomeServiceIntakeOrigin(intake.origin);
    setHomeServiceIntakeAnswers(answers);
    setHomeServiceTextDrafts(answers);
    setHomeServiceCanvasPhoto(null);
    setHomeServiceCanvasPhotoName(photoName);
    setHomeServiceCanvasMode(true);
    advanceHomeServiceCanvas(nextStep);
  }, [
    activeHomeServiceDraftQuery.data,
    advanceHomeServiceCanvas,
    conciergeVoiceAction,
    homeServiceCanvasMode,
  ]);

  useEffect(() => {
    if (!homeServiceCanvasMode || !homeServiceType || !homeServiceIntakeAnswers.problem_summary?.trim()) return;
    if (!homeServiceCanvasStep || !["description", "danger", "emergency", "safety", "urgency", "time", "access", "location", "location_custom", "provider"].includes(homeServiceCanvasStep)) return;
    const timer = window.setTimeout(() => {
      if (!isHomeServiceDraftSaving) saveHomeServiceDraft({ finalize: false });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [
    appointmentRequest?.id,
    homeServiceCanvasMode,
    homeServiceCanvasPhotoName,
    homeServiceCanvasStep,
    homeServiceIntakeAnswers,
    homeServiceType,
    isHomeServiceDraftSaving,
    saveHomeServiceDraft,
  ]);

  function openScheduleAssistant(chipKey?: AppointmentType) {
    const chip = chipKey ? APPOINTMENT_TYPE_CHIPS.find((item) => item.key === chipKey) ?? null : null;
    setAppointmentOpen(true);
    setOffersOpen(false);
    setAppointmentError(null);
    setSelectedAppointmentChip(chip);
    setAppointmentNote("");
    resetHomeServiceIntake("app", null);
    setAppointmentRequest(null);
    setAppointmentOptions([]);
    setAppointmentDiscovery(null);
    setSelectedAppointmentOptionId(null);
    setAppointmentAttemptResult(null);
    setAppointmentNotice(null);
  }

  function openHelpRequest() {
    clearAppointmentAssistantState();
    prepareConciergeRequest(isSpanish
      ? "Necesito ayuda de Concierge. Preguntame si es servicio en casa, rellenar un formulario, ayuda legal o administrativa, o encontrar cuidados. No contactes ni envies nada sin mi confirmacion."
      : "I need Concierge help. Ask whether this is home service, filling a form, legal or admin help, or finding care. Do not contact or submit anything without my confirmation.");
  }

  function prepareRideRequest(messageOverride?: string, requestedTime = "now") {
    const message = messageOverride ?? t(
      "concierge.fastHelp.ridePrefill",
      "Please help me find safe transport options. Ask for destination and timing, prepare clear options, and do not book anything without my confirmation.",
    );
    setRoutePrefill({ kind: "ride", message, source: "home_quick_action" });
    setInput((current) => current.trim() ? current : message);
    clearAppointmentAssistantState();
    setInsuranceAdminOpen(false);
    setScamCheckOpen(false);
    setOtcPharmacyOpen(false);
    setTransportPickup(savedTransportPickupLabel);
    setTransportDestination("");
    setTransportMobilityNeeds([]);
    setTransportResult(null);
    setTransportError(null);
    setTransportNotice(null);
    resetTransportFinalReview();
    setTransportTime(requestedTime);
    setTransportDetailsOpen(true);
    setOffersOpen(false);
    window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
  }

  function openHomeServiceAssistant() {
    const homeServiceChip = APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === "home-service") ?? APPOINTMENT_TYPE_CHIPS[0];
    openAppointmentAssistant();
    setSelectedAppointmentChip(homeServiceChip);
    setAppointmentNote("");
    resetHomeServiceIntake("app", null);
    setAppointmentRequest(null);
    setAppointmentOptions([]);
    setAppointmentDiscovery(null);
    setAppointmentAttemptResult(null);
    setAppointmentNotice(null);
  }

  function handlePrimaryConciergeCard(key: (typeof PRIMARY_CONCIERGE_CARDS)[number]["key"]) {
    if (key === "service") {
      openHelpRequest();
      return;
    }
    if (key === "ride") {
      prepareRideRequest();
      return;
    }
    if (key === "delivery") {
      navigate("/concierge/shopping", {
        state: {
          shoppingPrefill: {
            needText: isSpanish
              ? "Ayudame a pedir comida, farmacia, compra o productos esenciales sin iniciar compra"
              : "Help me order food, pharmacy, groceries, or essentials without starting checkout",
            category: "groceries",
            priorities: ["delivery", "simplicity", "safety"],
            constraints: isSpanish
              ? ["no iniciar compra", "confirmar antes de contactar o pedir"]
              : ["no checkout", "confirm before contacting or ordering"],
            sourceRecommendation: isSpanish
              ? "VYVA prepara opciones y pide confirmacion antes de cualquier pedido."
              : "VYVA prepares options and asks for confirmation before any order.",
          },
        },
      });
      return;
    }
    if (key === "appointment") {
      openScheduleAssistant();
      return;
    }
  }

  function handleFastHelpAction(key: (typeof CONCIERGE_FAST_HELP_ACTIONS)[number]["key"]) {
    if (key === "legal-advice") {
      prepareConciergeRequest(isSpanish
        ? "Ayudame a entender mis opciones legales. Resume los puntos importantes, prepara preguntas o documentos, y no contactes ni envies nada sin mi confirmacion."
        : "Help me understand my legal options. Summarize what matters, prepare questions or documents, and do not contact or send anything without my confirmation.");
      return;
    }
    if (key === "trip") {
      prepareConciergeRequest(isSpanish
        ? "Ayudame a planear un viaje o visita. Compara rutas, horarios, transporte, recordatorios y necesidades practicas. No reserves ni contactes con nadie sin mi confirmacion."
        : "Help me plan a trip or visit. Compare routes, timing, transport, reminders, and practical needs. Do not book or contact anyone without my confirmation.");
      return;
    }
    if (key === "care") {
      prepareConciergeRequest(isSpanish
        ? "Ayudame a encontrar la mejor atencion para mi. Compara proveedores, seguridad, accesibilidad, precio y cercania. No contactes ni reserves nada sin mi confirmacion."
        : "Help me find the best care for me. Compare providers, safety, accessibility, price, and distance. Do not contact or book anything without my confirmation.");
      return;
    }
    if (key === "form") {
      prepareConciergeRequest(isSpanish
        ? "Ayudame a rellenar un formulario. Prepara respuestas, marca lo que falte y deten antes de enviar para que yo confirme."
        : "Help me fill a form. Prepare answers, flag anything missing, and stop before submitting so I can confirm.");
      return;
    }
    if (key === "research") {
      prepareConciergeRequest(isSpanish
        ? "Ayudame a investigar un tema. Resume fuentes fiables, riesgos, opciones y proximos pasos. Preguntame antes de actuar."
        : "Help me research a topic. Summarize reliable sources, risks, options, and next steps. Ask before taking action.");
      return;
    }
    if (key === "best-deal") {
      openSavingsPanel(isSpanish
        ? "encontrar la mejor oferta comparando precio, confianza y condiciones"
        : "find the best deal by comparing price, trust, and conditions");
      return;
    }
    if (key === "age-at-home") {
      prepareConciergeRequest(isSpanish
        ? "Ayudame a crear un plan para vivir en casa con mas seguridad y dignidad. Revisa apoyo, adaptaciones, cuidados, transporte y tareas. No contactes con nadie sin mi confirmacion."
        : "Help me create a plan to age in grace at home. Review support, home adaptations, care, transport, and tasks. Do not contact anyone without my confirmation.");
    }
  }

  function startAppointmentFlow(chip: (typeof APPOINTMENT_TYPE_CHIPS)[number]) {
    const base = isSpanish ? chip.promptEs : chip.promptEn;
    const note = appointmentNote.trim();
    setSelectedAppointmentChip(chip);
    if (chip.key === "government") {
      setAppointmentOpen(false);
      setAppointmentError(null);
      setAppointmentNotice(null);
      setAppointmentRequest(null);
      setAppointmentOptions([]);
      setAppointmentDiscovery(null);
      setAppointmentAttemptResult(null);
      openInsuranceAdminAssistant("government-form", { subject: note });
      return;
    }
    if (chip.key === "personal-care") {
      setAppointmentOpen(false);
      setAppointmentError(null);
      setAppointmentNotice(null);
      setAppointmentRequest(null);
      setAppointmentOptions([]);
      setAppointmentDiscovery(null);
      setAppointmentAttemptResult(null);
      setAppointmentNote("");
      openProviderSearchPanel(
        "personal-care",
        note
          ? `${base}\n\n${isSpanish ? "Detalle del usuario" : "User detail"}: ${note}`
          : base,
      );
      return;
    }
    if (chip.key === "home-service") {
      const { intake, preferences } = buildCurrentHomeServiceIntake();
      const flowReference = routePrefill?.flowReference ?? CONCIERGE_FLOW_REFERENCES.homeService;
      createAppointmentMutation.mutate({
        appointmentType: chip.key,
        detail: intake.research_brief || note || base,
        preferences: {
          ...preferences,
          flow_reference: flowReference,
        },
        flowReference,
        routePrefillSource: routePrefill?.source,
        locale,
      });
      return;
    }
    createAppointmentMutation.mutate({
      appointmentType: chip.key,
      detail: note || base,
      routePrefillSource: routePrefill?.source,
      locale,
    });
  }

  function sendAppointmentToChat() {
    const chip = selectedAppointmentChip ?? APPOINTMENT_TYPE_CHIPS[0];
    const base = isSpanish ? chip.promptEs : chip.promptEn;
    const note = chip.key === "home-service" && homeServiceType
      ? buildCurrentHomeServiceIntake().intake.research_brief
      : appointmentNote.trim();
    const message = note
      ? `${base}\n\nDetalle del usuario: ${note}`
      : base;
    const userMsg: ChatMessage = { role: "user", content: message };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setAppointmentOpen(false);
    setAppointmentNote("");
    setAppointmentRequest(null);
    setAppointmentOptions([]);
    setAppointmentDiscovery(null);
    setAppointmentAttemptResult(null);
    scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" });
    sendMessage(message, nextHistory);
  }

  function handleDiscoverAppointmentOptions() {
    if (!appointmentRequest) return;
    discoverAppointmentOptionsMutation.mutate({ requestId: appointmentRequest.id });
  }

  function handleAppointmentChannel(channel: AppointmentChannel) {
    if (!appointmentRequest || !selectedAppointmentOption) return;
    confirmAppointmentMutation.mutate({
      requestId: appointmentRequest.id,
      optionId: selectedAppointmentOption.id,
      channel,
    });
  }

  function handleAppointmentControl(mode: "listening" | "muted" | "stopped") {
    setAppointmentControlMode(mode);
    const pendingId = appointmentAttemptResult?.pending?.pendingId || appointmentAttemptResult?.form_task?.pending_id;
    if (mode === "stopped" && pendingId) {
      cancelMutation.mutate(pendingId);
    }
  }

  function handleMarkAppointmentBooked() {
    if (!appointmentRequest || !appointmentBookedForm.scheduledFor) {
      setAppointmentError(isSpanish ? "Anade fecha y hora confirmadas." : "Add the confirmed date and time.");
      return;
    }
    const providerReply = appointmentBookedForm.providerReply.trim();
    const reference = appointmentBookedForm.reference.trim();
    const userNotes = appointmentBookedForm.notes.trim();
    const finalNotes = [
      providerReply ? `Provider reply: ${providerReply}` : "",
      reference ? `Reference: ${reference}` : "",
      userNotes ? `Notes: ${userNotes}` : "",
    ].filter(Boolean).join("\n");
    markAppointmentBookedMutation.mutate({
      requestId: appointmentRequest.id,
      scheduledFor: appointmentBookedForm.scheduledFor,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid",
      providerName: appointmentProviderName,
      location: appointmentBookedForm.location.trim()
        || (appointmentRequest.appointment_type === "home-service" ? homeServiceVisitAddress : appointmentSnapshotText(selectedAppointmentOption, "address"))
        || undefined,
      notes: finalNotes || appointmentRequest.reason_detail || undefined,
    });
  }

  function handleReviseAppointmentAfterReply() {
    setAppointmentAttemptResult(null);
    setAppointmentNotice(isSpanish
      ? "Revisa la opcion o pide a VYVA que contacte de nuevo."
      : "Review the option or ask VYVA to contact them again.");
    setAppointmentError(null);
    setAppointmentBookedForm({ scheduledFor: "", location: "", providerReply: "", reference: "", notes: "" });
  }

  function handleSaveConfirmedRide() {
    if (!transportPreparedOption) return;
    if (!transportFinalForm.scheduledFor) {
      setTransportError(isSpanish ? "Anade la hora confirmada de recogida." : "Add the confirmed pickup time.");
      return;
    }
    const scheduledDate = new Date(transportFinalForm.scheduledFor);
    if (Number.isNaN(scheduledDate.getTime())) {
      setTransportError(isSpanish ? "Usa una fecha y hora validas." : "Use a valid date and time.");
      return;
    }
    saveTransportRideMutation.mutate({
      option: transportPreparedOption,
      pendingId: transportPreparedResult?.pendingId ?? null,
      scheduledFor: transportFinalForm.scheduledFor,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid",
      pickupAddress: transportFinalForm.pickup.trim() || transportPickup.trim() || savedTransportPickupLabel,
      destinationAddress: transportFinalForm.destination.trim() || transportDestination.trim(),
      requestedTime: transportTime,
      mobilityNeeds: transportMobilityNeeds,
      providerReply: transportFinalForm.providerReply,
      priceEstimate: transportFinalForm.priceEstimate,
      bookingReference: transportFinalForm.bookingReference,
      notes: transportFinalForm.notes,
    });
  }

  function handleReviseConfirmedRide() {
    resetTransportFinalReview();
    setTransportNotice(isSpanish
      ? "Puedes cambiar el viaje o elegir otra opcion."
      : "You can change the ride or choose another option.");
    setTransportError(null);
  }

  async function handleSearchOffers(nextQuery = offersQuery, documentContext?: BillDocumentAnalysis) {
    const query = nextQuery.trim();
    if (!query || offersLoading) return;
    setOffersLoading(true);
    setOffersError(null);
    setObjectiveProofOpen(false);
    resetProviderShortlistState();
    try {
      const criteriaQuery = buildProviderSearchQuery(query, providerSearchCriteria, providerSearchMode, isSpanish);
      const result = await searchOffers(criteriaQuery, language, documentContext, undefined, providerSearchMode);
      setOffersResult(result);
    } catch {
      setOffersError(isSpanish
        ? "No he podido comparar opciones verificables ahora mismo."
        : "I could not compare verifiable options right now.");
    } finally {
      setOffersLoading(false);
    }
  }

  function handleOfferChipSearch(query: string) {
    setSavingsPanelView("overview");
    setProviderSearchMode(null);
    setProviderSearchCriteria(DEFAULT_PROVIDER_SEARCH_CRITERIA);
    setOffersQuery(query);
    setOffersResult(null);
    setBillAnalysis(null);
    setUtilityResult(null);
    setObjectiveProofOpen(false);
    resetProviderShortlistState();
    handleSearchOffers(query);
  }

  function openUtilitySavingsReview() {
    setSavingsPanelView("utilities");
    setProviderSearchMode(null);
    setProviderSearchCriteria(DEFAULT_PROVIDER_SEARCH_CRITERIA);
    setOffersResult(null);
    setOffersError(null);
    setObjectiveProofOpen(false);
    resetProviderShortlistState();
  }

  function closeOffersPanel() {
    setOffersOpen(false);
    setSavingsPanelView("overview");
    setProviderSearchMode(null);
    setObjectiveProofOpen(false);
    setEditingProviderShortlistId(null);
    resetProviderShortlistState();
  }

  function resetUtilityReview(method?: UtilityInputMethod) {
    setUtilityMethod(method ?? null);
    setUtilityForm({ ...EMPTY_UTILITY_FORM });
    setUtilityVoiceAnswers({});
    setUtilityVoiceStep(0);
    setUtilityVoiceDraft("");
    setUtilityNormalized(null);
    setUtilityResult(null);
    setUtilityError(null);
    setUtilityNotice(null);
    setBillAnalysis(null);
    setBillAnalysisError(null);
  }

  async function normalizeFromBillAnalysis(analysis: BillDocumentAnalysis, inputMethod: UtilityInputMethod) {
    setUtilityLoading(true);
    setUtilityError(null);
    try {
      const extracted = billAnalysisToUtilityExtracted(analysis);
      const normalized = await normalizeUtilityReview({
        input_method: inputMethod,
        locale: language,
        extracted_data: extracted,
      });
      setUtilityNormalized(normalized.normalized_input);
      setUtilityMethod(inputMethod);
      if (!normalized.can_compare) {
        setUtilityError(isSpanish
          ? `Para comparar mejor, necesito un dato mas: ${normalized.next_missing_field}. Puede corregirlo abajo.`
          : `To compare better, I need one more detail: ${normalized.next_missing_field}. You can correct it below.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setUtilityError(isSpanish
        ? (message || "No he podido preparar los datos de la factura.")
        : (message || "I could not prepare the bill details."));
    } finally {
      setUtilityLoading(false);
    }
  }

  async function handleBillFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!file.type.startsWith("image/") && !isPdf) {
      setBillAnalysisError(billClientMessage(language, "unsupported"));
      return;
    }
    setBillAnalysisLoading(true);
    setBillAnalysis(null);
    setBillAnalysisError(null);
    setOffersResult(null);
    setUtilityNormalized(null);
    setUtilityResult(null);
    try {
      const documentDataUrl = isPdf ? await readFileAsDataUrl(file) : await compressBillImage(file);
      let analysis: BillDocumentAnalysis;
      try {
        analysis = await analyzeBillDocument(documentDataUrl, language);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status !== 413 || isPdf) throw err;
        const emergencyDataUrl = await compressBillImage(file, 75_000);
        analysis = await analyzeBillDocument(emergencyDataUrl, language);
      }
      setBillAnalysis(analysis);
      setOffersQuery(analysis.suggested_query);
      if (!analysis.isFallback && isCnmcUtilityBillDocument(analysis.document_type)) {
        await normalizeFromBillAnalysis(analysis, utilityMethod === "upload" ? "upload" : "photo");
      }
      if (!analysis.isFallback && analysis.document_type !== "unknown" && !isCnmcUtilityBillDocument(analysis.document_type)) {
        setUtilityMethod(utilityMethod === "upload" ? "upload" : "photo");
        setUtilityNotice(nonCnmcBillNotice(analysis.document_type, isSpanish));
      }
      if (!analysis.isFallback && analysis.document_type === "unknown") {
        setBillAnalysisError(analysis.user_summary);
      }
      if (analysis.isFallback) {
        setBillAnalysisError(analysis.user_summary);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setBillAnalysisError(message || billClientMessage(language, "read_failed"));
    } finally {
      setBillAnalysisLoading(false);
    }
  }

  function handleCompareBillAnalysis() {
    if (!billAnalysis || billAnalysis.document_type === "unknown") return;
    const query = billAnalysis.suggested_query.trim() || (isSpanish
      ? "comparar factura de servicios importantes"
      : "compare important service bill");
    setOffersQuery(query);
    setOffersResult(null);
    handleSearchOffers(query, billAnalysis);
  }

  function updateUtilityNormalizedField(key: keyof NormalizedUtilityInput, value: string) {
    setUtilityError(null);
    setUtilityResult(null);
    setUtilityNormalized((prev) => {
      if (!prev) return prev;
      const numericFields = new Set(["power_kw", "consumption_kwh", "billing_period_days", "total_cost", "confidence"]);
      const nextValue = numericFields.has(key as string)
        ? (value.trim() ? Number(value.replace(",", ".")) : null)
        : value;
      const next = { ...prev, [key]: nextValue } as NormalizedUtilityInput;
      if (value.trim()) {
        next.missing_fields = next.missing_fields.filter((field) => field !== key && field !== `estimated:${key}`);
      }
      return next;
    });
  }

  async function handleNormalizeManualUtility() {
    setUtilityLoading(true);
    setUtilityError(null);
    setUtilityResult(null);
    try {
      const normalized = await normalizeUtilityReview({
        input_method: "manual",
        locale: language,
        fields: utilityForm,
      });
      setUtilityNormalized(normalized.normalized_input);
      if (!normalized.can_compare) {
        setUtilityError(isSpanish
          ? `Para comparar mejor, necesito un dato mas: ${normalized.next_missing_field}.`
          : `To compare better, I need one more detail: ${normalized.next_missing_field}.`);
      }
    } catch {
      setUtilityError(isSpanish ? "No he podido preparar esos datos." : "I could not prepare those details.");
    } finally {
      setUtilityLoading(false);
    }
  }

  async function handleUtilityVoiceNext() {
    const question = UTILITY_VOICE_QUESTIONS[utilityVoiceStep];
    if (!question) return;
    const answer = utilityVoiceDraft.trim();
    if (!answer) return;
    const nextAnswers = { ...utilityVoiceAnswers, [question.key]: answer };
    setUtilityVoiceAnswers(nextAnswers);
    setUtilityVoiceDraft("");
    if (utilityVoiceStep < UTILITY_VOICE_QUESTIONS.length - 1) {
      setUtilityVoiceStep((step) => step + 1);
      return;
    }
    setUtilityLoading(true);
    setUtilityError(null);
    try {
      const normalized = await normalizeUtilityReview({
        input_method: "voice",
        locale: language,
        voice_answers: nextAnswers,
      });
      setUtilityNormalized(normalized.normalized_input);
      if (!normalized.can_compare) {
        setUtilityError(isSpanish
          ? `Para comparar mejor, necesito un dato mas: ${normalized.next_missing_field}.`
          : `To compare better, I need one more detail: ${normalized.next_missing_field}.`);
      }
    } catch {
      setUtilityError(isSpanish ? "No he podido preparar sus respuestas." : "I could not prepare your answers.");
    } finally {
      setUtilityLoading(false);
    }
  }

  function startUtilityVoiceDictation() {
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setUtilityError(isSpanish
        ? "Este navegador no permite dictado aqui. Puede escribir la respuesta en una frase corta."
        : "This browser does not support dictation here. You can type the answer in a short sentence.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = isSpanish ? "es-ES" : language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) setUtilityVoiceDraft(transcript);
    };
    recognition.onerror = () => {
      setUtilityError(isSpanish
        ? "No he podido escuchar bien. Puede intentarlo otra vez o escribir la respuesta."
        : "I could not hear clearly. You can try again or type the answer.");
    };
    recognition.start();
  }

  async function handleCompareUtility() {
    if (!utilityNormalized) return;
    if (!hasFieldValue(utilityNormalized.postcode)) {
      setUtilityError(isSpanish
        ? "Para comparar mejor, escriba su codigo postal."
        : "To compare better, please enter your postcode.");
      return;
    }
    const comparableInput: NormalizedUtilityInput = {
      ...utilityNormalized,
      postcode: String(utilityNormalized.postcode ?? "").trim(),
      missing_fields: utilityNormalized.missing_fields.filter((field) => {
        if (field === "postcode" && String(utilityNormalized.postcode ?? "").trim()) return false;
        if (field === "power_kw" && utilityNormalized.power_kw != null) return false;
        if (field === "estimated:power_kw" && utilityNormalized.power_kw != null) return false;
        if (field === "estimated monthly cost or consumption_kwh"
          && (utilityNormalized.total_cost != null || utilityNormalized.consumption_kwh != null)) return false;
        return true;
      }),
    };
    setUtilityLoading(true);
    setUtilityError(null);
    setUtilityNotice(null);
    setUtilityResult(null);
    try {
      const result = await compareUtilityReview({
        input_method: utilityMethod ?? "manual",
        locale: language,
        normalized_input: comparableInput,
        extracted_data: billAnalysis ? billAnalysisToUtilityExtracted(billAnalysis) : {},
      });
      setUtilityResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setUtilityError(message || (isSpanish
        ? "No he podido completar la comparacion oficial ahora."
        : "I could not complete the official comparison right now."));
    } finally {
      setUtilityLoading(false);
    }
  }

  function buildUtilityShareText(result: UtilityCompareResponse): string {
    const best = result.results[0];
    const bestUrl = best ? utilityOptionUrl(best, result) : result.source_url ?? "";
    const optionLines = result.results
      .map((option, index) => {
        const optionUrl = utilityOptionUrl(option, result);
        return `${index + 1}. ${option.provider} - ${option.tariff_name}: ${formatEuro(option.estimated_monthly_cost, isSpanish)}/mes${optionUrl ? ` (${optionUrl})` : ""}`;
      })
      .join("\n");
    return [
      isSpanish ? "Resumen de revision de factura VYVA" : "VYVA bill review summary",
      `${isSpanish ? "Coste actual aproximado" : "Approx current cost"}: ${formatEuro(result.summary.current_monthly_cost, isSpanish)}/mes`,
      best ? `${isSpanish ? "Mejor opcion estimada" : "Best estimated option"}: ${best.provider} - ${best.tariff_name}` : "",
      `${isSpanish ? "Coste estimado" : "Estimated cost"}: ${formatEuro(result.summary.best_estimated_monthly_cost, isSpanish)}/mes`,
      `${isSpanish ? "Ahorro estimado" : "Estimated saving"}: ${formatEuro(result.summary.estimated_monthly_savings, isSpanish)}/mes`,
      optionLines ? `${isSpanish ? "Opciones sugeridas" : "Suggested options"}:\n${optionLines}` : "",
      bestUrl ? `${isSpanish ? "Verificar o contratar" : "Verify or contract"}: ${bestUrl}` : "",
      result.estimated_note,
      result.neutrality_note,
    ].filter(Boolean).join("\n");
  }

  function isUsefulUtilityUrl(url?: string): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      if (/comparador\.cnmc\.gob\.es$/i.test(parsed.hostname)) {
        return /^\/comparador\/listado\//i.test(parsed.pathname);
      }
      return true;
    } catch {
      return false;
    }
  }

  function isCnmcResultsUrl(url?: string): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return /comparador\.cnmc\.gob\.es$/i.test(parsed.hostname)
        && /^\/comparador\/listado\//i.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  function utilityOptionUrl(result: UtilityComparisonResult, parent?: UtilityCompareResponse): string {
    return [
      result.source_url,
      parent?.source_url,
      result.provider_url,
    ]
      .find((url) => isUsefulUtilityUrl(url)) ?? "";
  }

  function utilityOptionActionLabel(result: UtilityComparisonResult, url?: string): string {
    if (isUsefulUtilityUrl(url)) return isSpanish ? "Ver ofertas" : "View offers";
    if (result.source === "CNMC") return isSpanish ? "Ver resultados" : "View results";
    return isSpanish ? "Ver opciones" : "View options";
  }

  function handleUtilityOptionReview(option: UtilityComparisonResult, optionUrl: string) {
    if (!utilityResult) return;
    const target = `${option.provider} - ${option.tariff_name}`;
    const message = isSpanish
      ? [
        `Ayudame a revisar esta opcion de tarifa antes de abrir o cambiar: ${target}.`,
        `Coste estimado: ${formatEuro(option.estimated_monthly_cost, true)}/mes.`,
        `Ahorro estimado: ${formatEuro(option.estimated_monthly_savings, true)}/mes.`,
        optionUrl ? `Enlace disponible: ${optionUrl}.` : "",
        "Comprueba condiciones, permanencia, precio real y pasos seguros. No abras, contrates, llames ni compartas datos sin mi confirmacion.",
      ].filter(Boolean).join("\n")
      : [
        `Help me review this tariff option before opening or switching: ${target}.`,
        `Estimated cost: ${formatEuro(option.estimated_monthly_cost, false)}/month.`,
        `Estimated saving: ${formatEuro(option.estimated_monthly_savings, false)}/month.`,
        optionUrl ? `Available link: ${optionUrl}.` : "",
        "Check terms, commitment, real price, and safe steps. Do not open, switch, call, or share details without my confirmation.",
      ].filter(Boolean).join("\n");
    prepareConciergeRequest(message, {
      flowReference: SHOPPING_SUPPORT_FLOW_REFERENCE,
      requestedTool: "operator_review",
      actionLabel: isSpanish ? "Revisar cambio" : "Review switch",
      summary: isSpanish
        ? `Comparacion preparada: ${target}.`
        : `Deal comparison prepared: ${target}.`,
      useCase: "find_offers",
      payload: {
        task_type: "utility_switch_review",
        shopping_need: isSpanish ? `Revisar ${target}` : `Review ${target}`,
        shopping_context: "utility_comparison",
        review_target: target,
        offer_name: target,
        deal_name: target,
        provider_name: option.provider,
        tariff_name: option.tariff_name,
        estimated_monthly_cost: option.estimated_monthly_cost,
        estimated_monthly_savings: option.estimated_monthly_savings,
        contract_type: option.contract_type,
        permanence: option.permanence,
        price_stability: option.price_stability,
        source: option.source,
        source_url: option.source_url || utilityResult.source_url || null,
        provider_url: option.provider_url || null,
        website: optionUrl || null,
        comparison_summary: utilityResult.summary.headline,
        current_monthly_cost: utilityResult.summary.current_monthly_cost,
        best_estimated_monthly_cost: utilityResult.summary.best_estimated_monthly_cost,
        calculation_note: utilityResult.calculation_note,
        neutrality_note: utilityResult.neutrality_note,
      },
    });
  }

  async function handleUtilityResultAction(action: "whatsapp" | "save" | "remind" | "switch") {
    if (!utilityResult) return;
    if (action === "whatsapp") {
      const shareText = buildUtilityShareText(utilityResult);
      prepareConciergeRequest(
        isSpanish
          ? `Prepara este resumen de comparacion para WhatsApp. No abras WhatsApp ni envies nada sin mi confirmacion.\n\n${shareText}`
          : `Prepare this comparison summary for WhatsApp. Do not open WhatsApp or send anything without my confirmation.\n\n${shareText}`,
        {
          flowReference: SHOPPING_SUPPORT_FLOW_REFERENCE,
          requestedTool: "whatsapp",
          actionLabel: isSpanish ? "Preparar WhatsApp" : "Prepare WhatsApp",
          summary: isSpanish ? "Resumen de comparacion preparado para WhatsApp." : "Comparison summary prepared for WhatsApp.",
          useCase: "find_offers",
          payload: {
            task_type: "utility_whatsapp_summary",
            shopping_context: "utility_comparison",
            whatsapp_message: shareText,
            comparison_summary: utilityResult.summary.headline,
            current_monthly_cost: utilityResult.summary.current_monthly_cost,
            best_estimated_monthly_cost: utilityResult.summary.best_estimated_monthly_cost,
            calculation_note: utilityResult.calculation_note,
            neutrality_note: utilityResult.neutrality_note,
            source_url: utilityResult.source_url,
          },
        },
      );
      return;
    }
    if (action === "save") {
      setUtilityNotice(isSpanish
        ? "Revision guardada. VYVA la tendra en cuenta para futuras comparaciones."
        : "Review saved. VYVA will use it for future comparisons.");
      return;
    }
    const prompt = action === "remind"
      ? (isSpanish
        ? "Recuerdame revisar esta factura de luz o gas de nuevo el mes que viene."
        : "Remind me to review this electricity or gas bill again next month.")
      : (isSpanish
        ? "Ayudame a cambiar de tarifa paso a paso usando esta comparacion. Primero prepara un resumen y pideme confirmacion."
        : "Help me switch tariff step by step using this comparison. First prepare a summary and ask me to confirm.");
    setInput(prompt);
    closeOffersPanel();
    scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" });
  }

  function prepareConciergeRequest(message: string, options: Omit<Partial<ConciergeRoutePrefill>, "kind" | "message"> = {}) {
    const payload = persistedTask
      ? { ...(options.payload ?? {}), concierge_task_id: persistedTask.id }
      : options.payload;
    setRoutePrefill({ kind: "task", message, ...options, payload });
    setRoutePrefillError(null);
    setInput(message);
    setInsuranceAdminOpen(false);
    setScamCheckOpen(false);
    setOtcPharmacyOpen(false);
    closeOffersPanel();
    scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" });
  }

  function handleChangePendingAction(item: ConciergePendingItem, focusTarget?: ConciergeFocusedDetailTarget | null) {
    const payload = item.action_payload;
    const message = payloadString(payload, ["draft_message", "message", "reason", "detail"]) || item.action_summary;

    setIsRightNowHidden(false);
    setFocusedDetailTarget(focusTarget ?? null);
    setInput((current) => current.trim() ? current : message);
    setInsuranceAdminOpen(false);
    setScamCheckOpen(false);
    closeOffersPanel();

    if (item.use_case === "book_ride") {
      setRoutePrefill({ kind: "ride", message, source: "home_quick_action" });
      clearAppointmentAssistantState();
      setOtcPharmacyOpen(false);
      setTransportPickup(payloadString(payload, ["pickup_address", "pickup"]) || savedTransportPickupLabel);
      setTransportDestination(payloadString(payload, ["destination_address", "destination"]));
      setTransportTime(payloadString(payload, ["requested_time", "time"]) || "now");
      setTransportMobilityNeeds(stringList(payload?.mobility_needs));
      setTransportResult(null);
      setTransportError(null);
      setTransportNotice(null);
      resetTransportFinalReview();
      setTransportDetailsOpen(focusTarget ? focusTarget === "transport-pickup" || focusTarget === "transport-time" : true);
    } else if (item.use_case === "order_medicine") {
      const fulfillment = payloadString(payload, ["fulfillment_preference"]).toLowerCase();
      setRoutePrefill(null);
      clearAppointmentAssistantState();
      setOtcPharmacyOpen(true);
      setOtcNotice(null);
      setOtcError(null);
      resetOtcOutcomeReview();
      setOtcItemText(payloadString(payload, ["item_text", "items", "item"]));
      setOtcFulfillmentPreference(fulfillment.includes("pickup") || fulfillment.includes("collect") ? "pickup" : "delivery");
      setOtcRequestedTime(payloadString(payload, ["requested_time", "time"]) || "today");
      setOtcNotes(payloadString(payload, ["notes", "note"]));
    } else if (item.use_case === "book_appointment" || isHomeServicePendingAction(item)) {
      const isHomeService = isHomeServicePendingAction(item);
      const chip = APPOINTMENT_TYPE_CHIPS.find((entry) => entry.key === (isHomeService ? "home-service" : "medical")) ?? APPOINTMENT_TYPE_CHIPS[0];
      setRoutePrefill({ kind: "appointment", message, source: "home_quick_action" });
      setOtcPharmacyOpen(false);
      setAppointmentOpen(true);
      setSelectedAppointmentChip(chip);
      setAppointmentNote(payloadString(payload, ["reason", "detail", "problem_summary", "service_needed"]) || message);

      if (isHomeService) {
        const serviceType = normalizeHomeServiceType(payloadString(payload, ["service_type", "service_label", "service_needed"]) || message);
        const nextAnswers: Record<string, string> = {};
        const urgency = payloadString(payload, ["urgency", "priority"]);
        const problem = payloadString(payload, ["problem_summary", "service_needed", "reason"]);
        if (urgency) nextAnswers.urgency = urgency;
        if (problem) nextAnswers.problem_summary = problem;
        setHomeServiceIntakeOrigin("app");
        setHomeServiceType(serviceType);
        setHomeServiceIntakeAnswers((current) => ({ ...nextAnswers, ...current }));
        setHomeServiceTextDrafts((current) => ({ ...nextAnswers, ...current }));
      }
    } else {
      setRoutePrefill({ kind: "task", message, source: "home_quick_action" });
      setOtcPharmacyOpen(false);
      setAppointmentOpen(false);
    }

    window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
  }

  function openProviderSetupForPendingAction(item: ConciergePendingItem) {
    if (isProviderSearchPendingAction(item)) {
      handleSaveProviderSearchProvider(item);
      return;
    }

    const payload = item.action_payload;
    const message = payloadString(payload, ["draft_message", "message", "reason", "detail"]) || item.action_summary;

    if (item.use_case === "book_ride") {
      navigate("/onboarding/profile/providers", {
        state: {
          returnTo: "/concierge",
          setupFocus: TRANSPORT_SETUP_FOCUS,
          setupFlow: TRANSPORT_BOOKING_FLOW_REFERENCE,
          setupReason: "Add or choose a saved transport provider",
          conciergeResume: {
            kind: "transport",
            message,
            pickup: payloadString(payload, ["pickup_address", "pickup"]) || savedTransportPickupLabel,
            destination: payloadString(payload, ["destination_address", "destination"]),
            time: payloadString(payload, ["requested_time", "time"]) || "now",
            mobilityNeeds: stringList(payload?.mobility_needs),
          },
          notice: isSpanish
            ? "Guarda un taxi o transporte preferido. VYVA seguira pidiendo tu OK antes de reservar."
            : "Add or choose a preferred taxi or transport provider. VYVA will still ask for your OK before booking.",
        },
      });
      return;
    }

    if (item.use_case === "order_medicine") {
      const fulfillment = payloadString(payload, ["fulfillment_preference"]).toLowerCase();
      navigate("/onboarding/profile/providers", {
        state: {
          returnTo: "/concierge",
          setupFocus: OTC_PHARMACY_SETUP_FOCUS,
          setupFlow: OTC_PHARMACY_FLOW_REFERENCE,
          setupReason: "Add a saved pharmacy",
          conciergeResume: {
            kind: "otc_pharmacy",
            itemText: payloadString(payload, ["item_text", "items", "item"]),
            fulfillmentPreference: fulfillment.includes("pickup") || fulfillment.includes("collect") ? "pickup" : "delivery",
            requestedTime: payloadString(payload, ["requested_time", "time"]) || "today",
            notes: payloadString(payload, ["notes", "note"]),
          },
          notice: isSpanish
            ? "Guarda una farmacia para usarla primero con productos sin receta."
            : "Save a pharmacy so VYVA can use it first for over-the-counter items.",
        },
      });
      return;
    }

    if (item.use_case === "book_appointment" || isHomeServicePendingAction(item)) {
      const isHomeService = isHomeServicePendingAction(item);
      const serviceType = isHomeService
        ? normalizeHomeServiceType(payloadString(payload, ["service_type", "service_label", "service_needed"]) || message)
        : null;
      const answers: Record<string, string> = {};
      const urgency = payloadString(payload, ["urgency", "priority"]);
      const problem = payloadString(payload, ["problem_summary", "service_needed", "reason"]);
      if (urgency) answers.urgency = urgency;
      if (problem) answers.problem_summary = problem;

      navigate("/onboarding/profile/providers", {
        state: {
          returnTo: "/concierge",
          setupFocus: isHomeService ? "home_service" : MEDICAL_APPOINTMENT_SETUP_FOCUS,
          setupFlow: isHomeService ? CONCIERGE_FLOW_REFERENCES.homeService : MEDICAL_APPOINTMENT_FLOW_REFERENCE,
          setupReason: isHomeService ? "Add or choose a saved home service provider" : "Add or choose a saved doctor or clinic",
          conciergeResume: isHomeService
            ? {
              kind: "home_service",
              serviceType,
              origin: "app",
              note: payloadString(payload, ["problem_summary", "service_needed", "reason"]) || message,
              answers,
              textDrafts: answers,
            }
            : {
              kind: "medical_appointment",
              appointmentType: "medical",
              note: payloadString(payload, ["reason", "detail", "appointment_reason"]) || message,
            },
          notice: isHomeService
            ? (isSpanish
              ? "Guarda un proveedor de casa de confianza. VYVA pedira confirmacion antes de contactar."
              : "Add or choose a trusted home service provider. VYVA will ask before contacting.")
            : (isSpanish
              ? "Guarda un medico o clinica de confianza. VYVA pedira confirmacion antes de contactar."
              : "Add or choose a trusted doctor or clinic. VYVA will ask before contacting."),
        },
      });
      return;
    }

    navigate("/onboarding/profile/providers", {
      state: {
        returnTo: "/concierge",
        setupFocus: "other",
        setupFlow: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
        setupReason: "Add or choose a trusted provider",
        conciergeResume: {
          kind: "generic",
          message,
        },
        notice: isSpanish
          ? "Guarda el proveedor de confianza. VYVA seguira pidiendo tu OK antes de contactar."
          : "Add or choose the trusted provider. VYVA will still ask for your OK before contacting.",
      },
    });
  }

  function handleActiveChecklistAction(action: ActiveTaskChecklistAction) {
    if (!activeAction) return;
    setIsRightNowHidden(false);

    if (action === "details" || action === "contact") {
      if (action === "details" && activeActionNeedsGuidedDetails && activeActionGuidedDetails?.nextQuestion) {
        if (!activeActionGuidedPanelOpen) {
          handleChangePendingAction(activeAction, focusedDetailTargetForRequirement(activeAction, activeActionGuidedDetails.nextQuestion.key));
          return;
        }
        guidedDetailPanelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        window.setTimeout(() => {
          const input = document.querySelector<HTMLElement>(
            `[data-testid="${guidedDetailInputTestId(activeActionGuidedDetails.nextQuestion!, activeActionGuidedUsesFormCompatibleIds)}"]`,
          );
          input?.focus();
        }, 80);
        return;
      }
      const missingRequirement = action === "details"
        ? evaluateConciergeFlowRequirements({
          useCase: activeAction.use_case,
          payload: activeAction.action_payload,
          providerName: activeTaskProviderLabel(activeAction, isSpanish),
          summary: activeAction.action_summary,
        }).firstMissingRequirement
        : null;
      handleChangePendingAction(
        activeAction,
        focusedDetailTargetForRequirement(activeAction, missingRequirement?.key),
      );
      return;
    }

    if (action === "provider") {
      openProviderSetupForPendingAction(activeAction);
      return;
    }

    if (action === "reply") {
      if (activeActionCanRecordProviderReply) {
        openProviderReplyMode(activeAction, "confirmed");
      } else {
        handleProviderFollowUp(activeAction);
      }
      return;
    }

    if (action === "confirm") {
      if (activeActionNeedsGuidedDetails && activeActionGuidedDetails?.nextQuestion) {
        if (!activeActionGuidedPanelOpen) {
          handleChangePendingAction(activeAction, focusedDetailTargetForRequirement(activeAction, activeActionGuidedDetails.nextQuestion.key));
          return;
        }
        guidedDetailPanelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        window.setTimeout(() => {
          const input = document.querySelector<HTMLElement>(
            `[data-testid="${guidedDetailInputTestId(activeActionGuidedDetails.nextQuestion!, activeActionGuidedUsesFormCompatibleIds)}"]`,
          );
          input?.focus();
        }, 80);
      } else if (activeActionNeedsPhoneOutcome) {
        handlePhoneCallReview(activeAction);
      } else if (activeActionNeedsWhatsAppOutcome) {
        handleWhatsAppDraftReview(activeAction);
      } else if (activeActionNeedsEmailOutcome) {
        handleEmailDraftReview(activeAction);
      } else if (activeAction.status === "pending" && !activeActionIsVyvaTask) {
        requestExternalConfirmation({
          item: activeAction,
          kind: "confirm",
          label: activeActionPrimaryLabel,
        });
      } else {
        handleChangePendingAction(activeAction);
      }
    }
  }

  function handleSaveGuidedDetail() {
    if (!activeAction || !activeActionGuidedDetails?.nextQuestion) return;
    const value = guidedDetailDraft.trim();
    if (!value) {
      setGuidedDetailError(isSpanish ? "Anade este detalle para continuar." : "Add this detail to continue.");
      return;
    }
    guidedDetailMutation.mutate({
      item: activeAction,
      question: activeActionGuidedDetails.nextQuestion,
      value,
    });
  }

  function updateProviderReplyForm(field: keyof ProviderReplyForm, value: string) {
    setProviderReplyForm((current) => ({ ...current, [field]: value }));
  }

  function updateBookingFormOutcome(field: keyof BookingFormOutcomeForm, value: string) {
    setBookingFormOutcomeForm((current) => ({ ...current, [field]: value }));
  }

  function updatePhoneCallOutcomeForm(field: keyof PhoneCallOutcomeForm, value: string) {
    setPhoneCallOutcomeForm((current) => ({ ...current, [field]: value }));
  }

  function updateEmailDraftOutcome(field: keyof EmailDraftOutcomeForm, value: string) {
    setEmailDraftOutcomeForm((current) => ({ ...current, [field]: value }));
  }

  function updateWhatsAppDraftOutcome(field: keyof WhatsAppDraftOutcomeForm, value: string) {
    setWhatsAppDraftOutcomeForm((current) => ({ ...current, [field]: value }));
  }

  function updateManualReviewOutcome(field: keyof ManualReviewOutcomeForm, value: string) {
    setManualReviewOutcomeForm((current) => ({ ...current, [field]: value }));
  }

  function handleSaveManualReviewOutcome(item: ConciergePendingItem) {
    manualReviewOutcomeMutation.mutate({ item, form: manualReviewOutcomeForm });
  }

  function handleBookingFormSubmitted(item: ConciergePendingItem) {
    bookingFormOutcomeMutation.mutate({ item, form: bookingFormOutcomeForm });
  }

  function showPhoneCallReview(item: ConciergePendingItem) {
    setPhoneCallOutcomeError(null);
    setPhoneCallOutcomeNotice(isSpanish ? "Guion listo. Llama y guarda lo que paso." : "Script ready. Call and save what happened.");
    setVisibleActionId(item.id);
    setIsRightNowHidden(false);
    window.setTimeout(() => scrollIntoViewIfAvailable(rightNowSectionRef.current, { behavior: "smooth", block: "start" }), 80);
  }

  function handlePhoneCallReview(item: ConciergePendingItem) {
    reviewConfirmMutation.mutate({ item, kind: "phone" });
  }

  function handleSavePhoneCallOutcome(item: ConciergePendingItem) {
    phoneCallOutcomeMutation.mutate({ item, form: phoneCallOutcomeForm });
  }

  function showWhatsAppDraftReview(item: ConciergePendingItem) {
    setWhatsAppDraftError(null);
    setWhatsAppDraftNotice(isSpanish ? "Borrador listo. Abre WhatsApp y guarda el resultado." : "Draft ready. Open WhatsApp and save the result.");
    setVisibleActionId(item.id);
    setIsRightNowHidden(false);
    window.setTimeout(() => scrollIntoViewIfAvailable(rightNowSectionRef.current, { behavior: "smooth", block: "start" }), 80);
  }

  function handleWhatsAppDraftReview(item: ConciergePendingItem) {
    reviewConfirmMutation.mutate({ item, kind: "whatsapp" });
  }

  function handleWhatsAppDraftSent(item: ConciergePendingItem, draft: ConciergeWhatsAppDraft) {
    whatsAppDraftOutcomeMutation.mutate({ item, draft, form: whatsAppDraftOutcomeForm });
  }

  function showEmailDraftReview(item: ConciergePendingItem) {
    setEmailDraftError(null);
    setEmailDraftNotice(isSpanish ? "Borrador listo. Abre tu email y guarda el resultado." : "Draft ready. Open your email and save the result.");
    setVisibleActionId(item.id);
    setIsRightNowHidden(false);
    window.setTimeout(() => scrollIntoViewIfAvailable(rightNowSectionRef.current, { behavior: "smooth", block: "start" }), 80);
  }

  function handleEmailDraftReview(item: ConciergePendingItem) {
    reviewConfirmMutation.mutate({ item, kind: "email" });
  }

  function handleEmailDraftSent(item: ConciergePendingItem, draft: ConciergeEmailDraft) {
    emailDraftOutcomeMutation.mutate({ item, draft, form: emailDraftOutcomeForm });
  }

  function handleBookingFormAddDetails(item: ConciergePendingItem) {
    const plan = getFormAutomationPlan(item);
    const missing = plan?.missingFields.join(", ") || (isSpanish ? "datos del formulario" : "form details");
    setBookingFormError(null);
    setBookingFormNotice(isSpanish ? "VYVA puede ayudarte a completar esos datos." : "VYVA can help collect those details.");
    setInput(isSpanish
      ? `El formulario necesita estos datos: ${missing}. Ayudame a completarlos antes de abrir el enlace.`
      : `The form needs these details: ${missing}. Help me collect them before opening the link.`);
    setIsRightNowHidden(false);
    window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
  }

  function handleBookingFormNeedHelp(item: ConciergePendingItem) {
    const provider = bookingFormProviderName(item, isSpanish);
    const plan = getFormAutomationPlan(item);
    const missing = plan?.missingFields.length ? ` ${isSpanish ? "Falta: " : "Missing: "}${plan.missingFields.join(", ")}.` : "";
    setBookingFormError(null);
    setBookingFormNotice(isSpanish ? "Ayuda preparada en el chat." : "Help prepared in chat.");
    setInput(isSpanish
      ? `Necesito ayuda con el formulario de ${provider}.${missing} Revisa el siguiente paso y no envies nada sin mi confirmacion.`
      : `I need help with the form for ${provider}.${missing} Review the next step and do not submit anything without my confirmation.`);
    setIsRightNowHidden(false);
    window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
  }

  const openProviderReplyMode = useCallback((item: ConciergePendingItem, mode: ProviderReplyMode) => {
    setProviderReplyMode(mode);
    setProviderReplyError(null);
    setProviderReplyNotice(null);
    setProviderReplyForm(providerReplyInitialForm(item, isSpanish));
  }, [isSpanish]);

  const handleProviderFollowUp = useCallback((item: ConciergePendingItem) => {
    setProviderReplyMode(null);
    setProviderReplyForm(providerReplyInitialForm(item, isSpanish));
    setProviderReplyError(null);
    setProviderReplyNotice(isSpanish ? "Seguimiento preparado en el chat." : "Follow-up prepared in chat.");
    setInput(providerFollowUpPrompt(item, isSpanish, locale));
    window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
  }, [isSpanish, locale]);

  function handleSaveProviderReply(item: ConciergePendingItem) {
    providerReplyCompletionMutation.mutate({ item, form: providerReplyForm });
  }

  function handleProviderNoAnswer(item: ConciergePendingItem) {
    providerNoAnswerMutation.mutate({ item });
  }

  function handleProviderMarkComplete(item: ConciergePendingItem) {
    providerMarkCompleteMutation.mutate({ item });
  }

  async function resumeProviderHandoffSource(
    item: ConciergePendingItem,
    outcome: "completed" | "failed" | "unavailable",
  ): Promise<boolean> {
    const sourceId = providerContactSourceShortlistId(item);
    if (!sourceId) {
      const resumeContext = isRecord(item.action_payload?.resume_context) ? item.action_payload.resume_context : null;
      const originalQuery = resumeContext && typeof resumeContext.query === "string" ? resumeContext.query.trim() : "";
      if (!originalQuery) return false;
      setInput(outcome === "completed"
        ? (isSpanish
          ? `Continua mi solicitud original: ${originalQuery}. Usa el resultado guardado y no repitas los pasos completados.`
          : `Continue my original request: ${originalQuery}. Use the saved outcome and do not repeat completed steps.`)
        : (isSpanish
          ? `Continua mi solicitud original: ${originalQuery}. El contacto no se completo; ayudame con la siguiente opcion sin repetir mis datos.`
          : `Continue my original request: ${originalQuery}. Contact was not completed; help with the next option without asking for the same details again.`));
      setIsRightNowHidden(false);
      window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
      return true;
    }
    const source = pendingActions.find((candidate) => candidate.id === sourceId);
    const shortlist = parseProviderShortlistPayload(source?.action_payload);
    if (!source?.action_payload || !shortlist) return false;

    const selectedProviderId = providerContactSelectedProviderId(item) || shortlist.preferredProviderId || "";
    const unavailableProviderIds = new Set(shortlist.unavailableProviderIds);
    if (outcome === "unavailable" && selectedProviderId) unavailableProviderIds.add(selectedProviderId);
    const nextPayload = updateProviderShortlistPayload(source.action_payload, shortlist.options, {
      preferredProviderId: outcome === "completed" ? selectedProviderId || null : null,
      status: outcome === "completed" ? "preferred_selected" : "open",
    });

    await patchPendingConciergeAction({
      pendingId: sourceId,
      actionPayload: {
        ...nextPayload,
        contact_handoff_status: outcome,
        contact_handoff_provider_id: selectedProviderId || null,
        contact_handoff_provider_name: item.provider_name ?? payloadString(item.action_payload, ["selected_provider_name"]),
        contact_handoff_updated_at: new Date().toISOString(),
        contact_unavailable_provider_ids: [...unavailableProviderIds],
        related_contact_task_pending_id: null,
        confirmation_still_required: false,
      },
    });

    setVisibleActionId(sourceId);
    setIsRightNowHidden(false);
    setActiveProviderShortlistNotice(outcome === "completed"
      ? (isSpanish ? "Contacto guardado. Continua con tu solicitud original." : "Contact saved. Continue with your original request.")
      : outcome === "unavailable"
        ? (isSpanish ? "Este proveedor no esta disponible. Elige otra opcion guardada." : "This provider is unavailable. Choose another saved option.")
        : (isSpanish ? "El contacto no se completo. Puedes probar otra opcion guardada." : "Contact was not completed. You can try another saved option."));
    return true;
  }

  function handleProviderUnavailable(item: ConciergePendingItem) {
    if (isVerifiedProviderContactHandoff(item) && providerContactSourceShortlistId(item)) {
      setProviderReplyMode(null);
      setProviderReplyForm(EMPTY_PROVIDER_REPLY_FORM);
      setProviderReplyError(null);
      setProviderReplyNotice(isSpanish ? "Volviendo a tus opciones guardadas." : "Returning to your saved options.");
      void (async () => {
        await resumeProviderHandoffSource(item, "unavailable");
        await completePendingConciergeAction({
          pendingId: item.id,
          outcomeSummary: isSpanish ? "Proveedor no disponible." : "Provider unavailable.",
          outcomePayload: {
            ...(item.action_payload ?? {}),
            live_handoff_status: "failed",
            live_handoff_outcome: "provider_unavailable",
            provider_unavailable: true,
            returned_to_shortlist: true,
            no_external_action_without_confirmation: true,
          },
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
        ]);
      })().catch((error) => {
        setProviderReplyError(error instanceof Error
          ? error.message
          : (isSpanish ? "No he podido volver a la seleccion." : "I could not return to the shortlist."));
      });
      return;
    }
    const recovery = providerUnavailableRecoveryPlan(item, isSpanish);
    setProviderReplyMode(null);
    setProviderReplyForm(EMPTY_PROVIDER_REPLY_FORM);
    setProviderReplyError(null);
    setProviderReplyNotice(recovery.notice);
    setIsRightNowHidden(false);
    openProviderSearchPanel(recovery.mode, recovery.query);
    setProviderSearchCriteria(recovery.criteria);
    setInput(recovery.query);
    window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
  }

  function handleProviderNeedMoreInfo(item: ConciergePendingItem) {
    const question = providerReplyForm.followUpQuestion.trim();
    if (!question) return;
    providerNeedsInfoMutation.mutate({ item, question });
  }

  function handleProviderReplyResolution(
    item: ConciergePendingItem,
    resolution: ConciergeProviderReplyResolution,
    action: ConciergeProviderReplyPrimaryAction,
    answers: Record<string, string>,
  ) {
    providerReplyResolutionMutation.mutate({ item, resolution, action, answers });
  }

  function handleProviderReplyDraftReview(
    item: ConciergePendingItem,
    resolution: ConciergeProviderReplyResolution,
  ) {
    if (resolution.channel === "whatsapp") {
      handleWhatsAppDraftReview(item);
      return;
    }
    handleEmailDraftReview(item);
  }

  function handleSaveProviderSearchProvider(item: ConciergePendingItem) {
    const details = providerSearchActionDetails(item, isSpanish);
    const flowReference = providerSearchActionFlowReference(item);
    navigate("/onboarding/profile/providers", {
      state: {
        returnTo: "/concierge",
        setupFocus: details.category,
        setupFlow: flowReference,
        setupReason: "Save provider from Concierge",
        conciergeResume: {
          kind: flowReference === CARE_NAVIGATION_FLOW_REFERENCE ? "provider_search" : "generic",
          mode: flowReference === CARE_NAVIGATION_FLOW_REFERENCE ? providerRecoveryModeFromCategory(details.category) : undefined,
          message: isSpanish
            ? `Continua preparando el contacto con ${details.providerName}. Criterios: ${details.criteria || "seguridad y ajuste"}.`
            : `Continue preparing contact with ${details.providerName}. Criteria: ${details.criteria || "safety and fit"}.`,
        },
        providerPrefill: {
          name: details.providerName,
          category: details.category,
          phone: item.provider_phone || payloadString(item.action_payload, ["provider_phone", "phone"]) || undefined,
          email: payloadString(item.action_payload, ["provider_email", "email"]) || undefined,
          whatsapp: payloadString(item.action_payload, ["provider_whatsapp", "whatsapp"]) || undefined,
          booking_url: payloadString(item.action_payload, ["booking_url", "provider_booking_url"]) || undefined,
          notes: details.criteria || undefined,
        },
        notice: isSpanish
          ? "Guarda este proveedor como proveedor de confianza. VYVA seguira pidiendo tu OK antes de contactar."
          : "Save this as a trusted provider. VYVA will still ask for your OK before contacting them.",
      },
    });
  }

  function handleProviderSearchTryAnother(item: ConciergePendingItem) {
    const details = providerSearchActionDetails(item, isSpanish);
    const message = isSpanish
      ? [
        `Busca otra opcion parecida a ${details.providerName}.`,
        `Categoria: ${details.categoryLabel}.`,
        details.criteria ? `Mantener criterios: ${details.criteria}.` : "Prioriza cercania, reputacion, acceso y precio claro.",
        "Prepara opciones verificables y explica por que encajan. No contactes ni compartas datos sin mi confirmacion.",
      ].join("\n")
      : [
        `Find another option similar to ${details.providerName}.`,
        `Category: ${details.categoryLabel}.`,
        details.criteria ? `Keep criteria: ${details.criteria}.` : "Prioritize proximity, reputation, access, and clear price.",
        "Prepare verifiable options and explain why they fit. Do not contact or share details without my confirmation.",
      ].join("\n");
    prepareConciergeRequest(message, {
      flowReference: providerSearchActionFlowReference(item),
      requestedTool: "operator_review",
      actionLabel: isSpanish ? "Buscar otro proveedor" : "Find another provider",
      summary: isSpanish
        ? "Busqueda alternativa de proveedor preparada."
        : "Alternative provider search prepared.",
      useCase: "find_provider",
      providerSearchMode: providerRecoveryModeFromCategory(details.category),
      providerSearchCriteria: details.criteria ? details.criteria.split(",").map((item) => item.trim()).filter(Boolean) : DEFAULT_PROVIDER_SEARCH_CRITERIA,
      providerSearchQuery: details.providerName,
    });
    setProviderReplyNotice(isSpanish ? "Busqueda alternativa preparada en el chat." : "Alternative search prepared in chat.");
  }

  function handleCompletedSessionFollowUp(session: ConciergeCompletedSession, mode: "question" | "repeat") {
    const message = completedSessionPrompt(session, isSpanish, mode);
    setSelectedCompletedSessionId(null);
    prepareConciergeRequest(message);
  }

  function handleCompletedSessionUseTemplate(session: ConciergeCompletedSession) {
    const payload = session.outcome_payload;
    const message = completedSessionPrompt(session, isSpanish, "repeat");
    const kind = completedSessionTemplateKind(session);
    setSelectedCompletedSessionId(null);
    setInput(message);
    setInsuranceAdminOpen(false);
    setScamCheckOpen(false);
    closeOffersPanel();

    if (kind === "ride") {
      const mobilityList = stringList(payload?.mobility_needs);
      const mobilityText = payloadString(payload, ["mobility_needs", "mobility", "accessibility_needs"]);
      setRoutePrefill({ kind: "ride", message, source: "home_quick_action" });
      clearAppointmentAssistantState();
      setOtcPharmacyOpen(false);
      setTransportPickup(payloadString(payload, ["pickup_address", "pickup", "start_location", "origin_address", "from"]) || savedTransportPickupLabel);
      setTransportDestination(payloadString(payload, ["destination_address", "destination", "dropoff_address", "to"]));
      setTransportTime(payloadString(payload, ["requested_time", "scheduled_for", "scheduled_time", "time"]) || "now");
      setTransportMobilityNeeds(mobilityList.length > 0 ? mobilityList : splitRoutePayloadList(mobilityText));
      setTransportResult(null);
      setTransportError(null);
      setTransportNotice(null);
      resetTransportFinalReview();
      setTransportDetailsOpen(true);
      window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
      return;
    }

    if (kind === "otc") {
      const fulfillment = payloadString(payload, ["fulfillment_preference", "fulfillment", "delivery_preference"]).toLowerCase();
      setRoutePrefill(null);
      clearAppointmentAssistantState();
      setOtcPharmacyOpen(true);
      setOtcNotice(null);
      setOtcError(null);
      resetOtcOutcomeReview();
      setOtcItemText(payloadString(payload, ["item_text", "otc_item", "requested_item", "item", "product_name", "medicine_name"]) || session.outcome_summary || "");
      setOtcFulfillmentPreference(fulfillment.includes("pickup") || fulfillment.includes("collect") ? "pickup" : "delivery");
      setOtcRequestedTime(payloadString(payload, ["requested_time", "scheduled_for", "scheduled_time", "time"]) || "today");
      setOtcNotes(payloadString(payload, ["notes", "note", "brand", "quantity", "special_requests", "fulfillment_note"]));
      window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
      return;
    }

    if (kind === "home-service") {
      const homeServiceChip = APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === "home-service") ?? APPOINTMENT_TYPE_CHIPS[0];
      const rawService = payloadString(payload, ["service_type", "service_label", "provider_type", "issue_type"]) || session.outcome_summary || session.provider_name || "";
      const serviceType = normalizeHomeServiceType(rawService);
      const problem = payloadString(payload, ["problem_summary", "issue_summary", "service_needed", "notes", "provider_reply", "detail"]) || session.outcome_summary || "";
      const nextAnswers: Record<string, string> = {};
      if (problem) nextAnswers.problem_summary = problem;
      const urgency = payloadString(payload, ["urgency", "priority"]);
      if (urgency) nextAnswers.urgency = urgency;
      const criteria = payloadString(payload, ["criteria", "special_requests"]);
      if (criteria) nextAnswers.criteria = criteria;
      const locationLabel = payloadString(payload, ["location", "address", "home_address"]);
      if (locationLabel) nextAnswers.location = locationLabel;

      setRoutePrefill(null);
      setOtcPharmacyOpen(false);
      setAppointmentOpen(true);
      setSelectedAppointmentChip(homeServiceChip);
      setAppointmentNote(problem || message);
      setHomeServiceIntakeOrigin("app");
      setHomeServiceType(serviceType);
      setHomeServiceIntakeAnswers(nextAnswers);
      setHomeServiceTextDrafts(nextAnswers);
      setAppointmentRequest(null);
      setAppointmentOptions([]);
      setAppointmentDiscovery(null);
      setSelectedAppointmentOptionId(null);
      setAppointmentAttemptResult(null);
      setAppointmentNotice(null);
      setAppointmentError(null);
      setAppointmentBookedForm({ scheduledFor: "", location: "", providerReply: "", reference: "", notes: "" });
      window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
      return;
    }

    if (kind === "appointment") {
      const appointmentType = payloadString(payload, ["appointment_type", "type"]).toLowerCase();
      const chip = APPOINTMENT_TYPE_CHIPS.find((item) => (
        item.key === appointmentType
        || item.en.toLowerCase() === appointmentType
        || item.es.toLowerCase() === appointmentType
      )) ?? APPOINTMENT_TYPE_CHIPS[0];
      const note = payloadString(payload, ["appointment_reason", "reason", "detail", "notes", "provider_reply"]) || session.outcome_summary || "";
      setRoutePrefill(null);
      setOtcPharmacyOpen(false);
      setAppointmentOpen(true);
      setSelectedAppointmentChip(chip);
      setAppointmentNote(note || message);
      resetHomeServiceIntake("app", null);
      setAppointmentRequest(null);
      setAppointmentOptions([]);
      setAppointmentDiscovery(null);
      setSelectedAppointmentOptionId(null);
      setAppointmentAttemptResult(null);
      setAppointmentNotice(null);
      setAppointmentError(null);
      setAppointmentBookedForm({ scheduledFor: "", location: "", providerReply: "", reference: "", notes: "" });
      window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
      return;
    }

    prepareConciergeRequest(message);
  }

  function openScamCheckAssistant() {
    setScamCheckOpen(true);
    setInsuranceAdminOpen(false);
    setOtcPharmacyOpen(false);
    setSelectedScamCheckKind(null);
    setScamCheckDetail("");
    setRoutePrefill(null);
    closeOffersPanel();
    window.setTimeout(() => {
      scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" });
    }, 80);
  }

  function scamCheckReadiness(option: typeof SCAM_CHECK_OPTIONS[number]) {
    const capabilities: Partial<Record<ConciergeToolRequirement, boolean>> = {
      operator_review: true,
      camera_or_upload: true,
      web_search: true,
    };
    if (option.requestedTool === "email") {
      capabilities[option.requestedTool] = false;
    }
    return evaluateConciergeToolReadiness({
      flowReference: SCAM_CHECK_FLOW_REFERENCE,
      requestedTool: option.requestedTool,
      capabilities,
      provider: { name: isSpanish ? option.es : option.en },
    });
  }

  function scamCheckPrompt(option: typeof SCAM_CHECK_OPTIONS[number], detail: string) {
    const common = isSpanish
      ? "No hagas clic, no respondas, no pagues ni compartas datos. Pideme confirmacion antes de reenviar, subir, buscar o contactar."
      : "Do not click, reply, pay, or share personal details. Ask me to confirm before forwarding, uploading, searching, or contacting anyone.";
    const detailLine = detail.trim()
      ? (isSpanish ? `Detalle del usuario: ${detail.trim()}.` : `User detail: ${detail.trim()}.`)
      : (isSpanish ? "Pregunta primero por el dato que falta." : "Ask first for the missing detail.");
    if (option.key === "email") {
      return isSpanish
        ? `Ayudame a revisar un email o mensaje sospechoso. ${detailLine} Resume el riesgo y dime el siguiente paso mas seguro. ${common}`
        : `Help me check a suspicious email or message. ${detailLine} Summarize the risk and tell me the safest next step. ${common}`;
    }
    if (option.key === "document") {
      return isSpanish
        ? `Ayudame a revisar un documento, carta, factura o foto sospechosa. ${detailLine} Si hace falta, pideme mostrarlo a la camara o subirlo. Dime el siguiente paso mas seguro. ${common}`
        : `Help me check a suspicious document, letter, invoice, or photo. ${detailLine} If needed, ask me to show it to the camera or upload it. Tell me the safest next step. ${common}`;
    }
    if (option.key === "phone") {
      return isSpanish
        ? `Ayudame a revisar un numero de telefono sospechoso. ${detailLine} Comprueba lo que se pueda revisar de forma segura y dime si devolver la llamada es arriesgado. ${common}`
        : `Help me check a suspicious phone number. ${detailLine} Verify what can be checked safely and tell me whether calling back is risky. ${common}`;
    }
    return isSpanish
      ? `Ayudame a revisar la reputacion online de una empresa, oferta, vendedor o servicio. ${detailLine} Compara senales fiables y dime el siguiente paso mas seguro. ${common}`
      : `Help me check a company, offer, seller, or service reputation online. ${detailLine} Compare reliable signals and tell me the safest next step. ${common}`;
  }

  function handleScamCheckChoice(option: typeof SCAM_CHECK_OPTIONS[number]) {
    setSelectedScamCheckKind(option.key);
    setScamCheckDetail("");
  }

  function prepareSelectedScamCheck() {
    const option = SCAM_CHECK_OPTIONS.find((item) => item.key === selectedScamCheckKind);
    if (!option) return;
    prepareConciergeRequest(scamCheckPrompt(option, scamCheckDetail), {
      flowReference: SCAM_CHECK_FLOW_REFERENCE,
      requestedTool: option.requestedTool,
      actionLabel: isSpanish ? option.es : option.en,
      summary: isSpanish
        ? `Revision segura: ${option.es}.`
        : `Safe check prepared: ${option.en}.`,
      payload: scamCheckStructuredPayload(option, scamCheckDetail, isSpanish),
      useCase: "scam_check",
    });
    setScamCheckOpen(false);
    setSelectedScamCheckKind(null);
    setScamCheckDetail("");
  }

  function openInsuranceAdminAssistant(
    initialKind: InsuranceAdminKind | null = null,
    initialDetails: Partial<InsuranceAdminDetails> = {},
  ) {
    setInsuranceAdminOpen(true);
    setScamCheckOpen(false);
    setOtcPharmacyOpen(false);
    setSelectedInsuranceAdminKind(initialKind);
    setInsuranceAdminDetails({ subject: "", recipient: "", deadline: "", notes: "", ...initialDetails });
    setRoutePrefill(null);
    closeOffersPanel();
    window.setTimeout(() => {
      scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" });
    }, 80);
  }

  function insuranceAdminReadiness(option: typeof INSURANCE_ADMIN_OPTIONS[number]) {
    const capabilities: Partial<Record<ConciergeToolRequirement, boolean>> = {
      operator_review: true,
      camera_or_upload: true,
      email: false,
      phone_call: false,
    };
    return evaluateConciergeToolReadiness({
      flowReference: INSURANCE_ADMIN_FLOW_REFERENCE,
      requestedTool: option.requestedTool,
      capabilities,
      provider: { name: isSpanish ? option.es : option.en },
    });
  }

  function insuranceAdminPrompt(option: typeof INSURANCE_ADMIN_OPTIONS[number], details: InsuranceAdminDetails) {
    const common = isSpanish
      ? "Pide primero el documento, destinatario, fecha limite y para quien es. No envies, llames, subas ni compartas datos sin mi confirmacion."
      : "Ask first for the document, recipient, deadline, and who this is for. Do not send, call, upload, or share details without my confirmation.";
    const detailLines = [
      details.subject.trim() ? (isSpanish ? `Tema: ${details.subject.trim()}.` : `Subject: ${details.subject.trim()}.`) : "",
      details.recipient.trim() ? (isSpanish ? `Destinatario: ${details.recipient.trim()}.` : `Recipient: ${details.recipient.trim()}.`) : "",
      details.deadline.trim() ? (isSpanish ? `Fecha limite: ${details.deadline.trim()}.` : `Deadline: ${details.deadline.trim()}.`) : "",
      details.notes.trim() ? (isSpanish ? `Notas: ${details.notes.trim()}.` : `Notes: ${details.notes.trim()}.`) : "",
    ].filter(Boolean).join(" ");
    const detailText = detailLines || (isSpanish ? "Pregunta por los datos que falten." : "Ask for any missing details.");
    if (option.key === "insurance-letter") {
      return isSpanish
        ? `Ayudame a entender una carta o factura de seguro. ${detailText} Resume lo importante, marca lo que falte, y dime el siguiente paso mas seguro. ${common}`
        : `Help me understand an insurance letter or bill. ${detailText} Summarize what matters, flag anything missing, and tell me the safest next step. ${common}`;
    }
    if (option.key === "claim") {
      return isSpanish
        ? `Ayudame a preparar un reclamo o reembolso. ${detailText} Prepara un borrador para revisar. ${common}`
        : `Help me prepare a claim or reimbursement. ${detailText} Prepare a draft for review. ${common}`;
    }
    if (option.key === "government-form") {
      return isSpanish
        ? `Ayudame a rellenar un formulario oficial o administrativo. ${detailText} Guiame campo por campo, marca lo que falte y prepara un resumen antes de enviar. ${common}`
        : `Help me fill a government or admin form. ${detailText} Guide me field by field, flag missing items, and prepare a summary before submission. ${common}`;
    }
    return isSpanish
      ? `Ayudame a preparar una llamada o email administrativo. ${detailText} Prepara guion o borrador y espera mi confirmacion. ${common}`
      : `Help me prepare an admin call or email. ${detailText} Prepare a script or draft and wait for my confirmation. ${common}`;
  }

  function handleInsuranceAdminChoice(option: typeof INSURANCE_ADMIN_OPTIONS[number]) {
    setSelectedInsuranceAdminKind(option.key);
    setInsuranceAdminDetails({ subject: "", recipient: "", deadline: "", notes: "" });
  }

  function prepareSelectedInsuranceAdminTask() {
    const option = INSURANCE_ADMIN_OPTIONS.find((item) => item.key === selectedInsuranceAdminKind);
    if (!option) return;
    prepareConciergeRequest(insuranceAdminPrompt(option, insuranceAdminDetails), {
      flowReference: INSURANCE_ADMIN_FLOW_REFERENCE,
      requestedTool: option.requestedTool,
      actionLabel: isSpanish ? option.es : option.en,
      summary: isSpanish
        ? `Gestion preparada: ${option.es}.`
        : `Paperwork task prepared: ${option.en}.`,
      payload: insuranceAdminStructuredPayload(option, insuranceAdminDetails, isSpanish),
      useCase: "admin_task",
    });
    setInsuranceAdminOpen(false);
    setSelectedInsuranceAdminKind(null);
    setInsuranceAdminDetails({ subject: "", recipient: "", deadline: "", notes: "" });
  }

  function handleOfferAssistance(option: OfferOption) {
    const contact = option.phone || option.website || option.maps_url || (isSpanish ? "sin contacto publicado" : "no published contact");
    const criteria = providerCriterionLabels(providerSearchCriteria, isSpanish);
    const comparison = buildProviderComparisonOptions([option])[0];
    const comparisonPayload = comparison
      ? buildProviderContactPayload(comparison, {
          mode: "shopping-seller",
          query: offersQuery.trim(),
          criteria: providerSearchCriteria,
          flowReference: SHOPPING_SUPPORT_FLOW_REFERENCE,
        })
      : {};
    const message = isSpanish
      ? [
        `Ayudame a revisar ${option.name} antes de contactar.`,
        `Contacto disponible: ${contact}.`,
        "Comprueba condiciones, precio real, permanencia, opiniones y riesgos. No llames, contrates ni compartas datos sin pedirme confirmacion.",
      ].join("\n")
      : [
        `Help me review ${option.name} before contacting them.`,
        `Available contact: ${contact}.`,
        "Check terms, real price, commitment, reviews, and risks. Do not call, book, switch, or share details without asking me to confirm.",
      ].join("\n");
    prepareConciergeRequest(message, {
      flowReference: SHOPPING_SUPPORT_FLOW_REFERENCE,
      requestedTool: "operator_review",
      actionLabel: isSpanish ? "Revisar oferta" : "Review deal",
      summary: isSpanish
        ? `Comparacion preparada: ${option.name}.`
        : `Deal comparison prepared: ${option.name}.`,
      payload: {
        ...offerReviewStructuredPayload(option, {
          intent: "compare",
          query: offersQuery.trim(),
          criteria,
          category: offersResult?.category,
        }),
        ...comparisonPayload,
      },
      useCase: "find_offers",
    });
  }

  function handleProviderSearchAssistance(option: OfferOption) {
    const contact = option.phone || option.website || option.maps_url || (isSpanish ? "sin contacto publicado" : "no published contact");
    const criteria = providerCriterionLabels(providerSearchCriteria, isSpanish).join(", ");
    const comparison = buildProviderComparisonOptions([option])[0];
    const comparisonPayload = comparison
      ? buildProviderContactPayload(comparison, {
          mode: providerSearchMode,
          query: offersQuery.trim(),
          criteria: providerSearchCriteria,
          flowReference: providerSearchFlowReference(providerSearchMode),
          resumeContext: {
            kind: "provider_search",
            mode: providerSearchMode,
            query: offersQuery.trim(),
            criteria: providerSearchCriteria,
          },
        })
      : {};
    const message = isSpanish
      ? [
        `Ayudame a preparar el contacto con ${option.name}.`,
        `Tipo: ${providerSearchModeLabel(providerSearchMode, true)}.`,
        `Criterios elegidos: ${criteria || "seguridad y ajuste"}.`,
        `Por que encaja: ${option.why_good_option || option.trust_note || option.what_it_offers}.`,
        `Disponibilidad o distancia: ${option.distance_or_availability}.`,
        `Precio o ventaja: ${option.price_or_advantage}.`,
        `Contacto disponible: ${contact}.`,
        "Prepara un resumen claro y una pregunta para confirmar. No llames, reserves, envies mensajes ni compartas datos sin mi confirmacion.",
      ].join("\n")
      : [
        `Help me prepare contact with ${option.name}.`,
        `Type: ${providerSearchModeLabel(providerSearchMode, false)}.`,
        `Chosen criteria: ${criteria || "safety and fit"}.`,
        `Why it fits: ${option.why_good_option || option.trust_note || option.what_it_offers}.`,
        `Availability or distance: ${option.distance_or_availability}.`,
        `Price or advantage: ${option.price_or_advantage}.`,
        `Available contact: ${contact}.`,
        "Prepare a clear summary and ask me to confirm. Do not call, book, message, or share details without my confirmation.",
      ].join("\n");
    prepareConciergeRequest(message, {
      flowReference: providerSearchFlowReference(providerSearchMode),
      requestedTool: "operator_review",
      actionLabel: isSpanish ? "Preparar contacto" : "Prepare contact",
      summary: isSpanish
        ? `Busqueda de proveedor preparada: ${option.name}.`
        : `Provider search prepared: ${option.name}.`,
      useCase: "find_provider",
      providerSearchMode: providerSearchMode ?? undefined,
      providerSearchCriteria: providerSearchCriteria,
      providerSearchQuery: offersQuery.trim() || providerSearchModeLabel(providerSearchMode, isSpanish),
      payload: {
        ...comparisonPayload,
        provider_search_mode: providerSearchMode ?? null,
        provider_search_query: offersQuery.trim() || providerSearchModeLabel(providerSearchMode, isSpanish),
        criteria: providerSearchCriteria,
        chosen_criteria: providerSearchCriteria,
        selected_provider_name: option.name,
        provider_name: option.name,
        provider_phone: option.phone || null,
        website: option.website || option.maps_url || null,
        comparison_summary: option.why_good_option || option.trust_note || option.what_it_offers,
        price_or_advantage: option.price_or_advantage,
        distance_or_availability: option.distance_or_availability,
        contact_method: option.contact_method,
      },
    });
  }

  function toggleProviderShortlist(option: ProviderComparisonOption) {
    setProviderShortlistNotice(null);
    setProviderShortlistError(null);
    setProviderShortlistIds((current) => current.includes(option.id)
      ? current.filter((id) => id !== option.id)
      : [...current, option.id].slice(0, 3));
  }

  function handleSaveComparisonProvider(option: ProviderComparisonOption) {
    const mode = providerSearchMode ?? "shopping-seller";
    navigate("/onboarding/profile/providers", {
      state: {
        returnTo: "/concierge",
        setupFocus: providerSearchSetupFocus(mode),
        setupFlow: providerSearchFlowReference(mode),
        setupReason: "Save provider from comparison",
        conciergeResume: {
          kind: "provider_search",
          mode,
          query: offersQuery.trim(),
          criteria: providerSearchCriteria,
        },
        providerPrefill: buildTrustedProviderPrefill(option, providerSearchSetupFocus(mode)),
        notice: isSpanish
          ? "Guarda este proveedor de confianza. Volveras a la comparacion despues."
          : "Save this trusted provider. You will return to the comparison afterwards.",
      },
    });
  }

  function handlePrepareComparisonContact(option: ProviderComparisonOption) {
    const mode = providerSearchMode ?? "shopping-seller";
    const context = {
      mode,
      query: offersQuery.trim() || providerSearchModeLabel(mode, isSpanish),
      criteria: providerSearchCriteria,
      flowReference: providerSearchFlowReference(mode),
      locale,
      resumeContext: {
        kind: "provider_search",
        mode,
        query: offersQuery.trim(),
        criteria: providerSearchCriteria,
      },
    };
    const plan = buildProviderContactPlan(option, context);
    const isSeller = mode === "shopping-seller";
    prepareConciergeRequest(
      isSpanish
        ? `Revisa el contacto preparado con ${option.name}. Nada se envia, llama ni reserva hasta que confirmes.`
        : `Review the prepared contact with ${option.name}. Nothing is sent, called, or booked until you confirm.`,
      {
        flowReference: providerSearchFlowReference(mode),
        requestedTool: plan.requestedTool,
        actionLabel: isSeller
          ? (isSpanish ? "Revisar oferta" : "Review deal")
          : (isSpanish ? "Preparar contacto" : "Prepare contact"),
        summary: isSeller
          ? (isSpanish ? `Comparacion preparada: ${option.name}.` : `Deal comparison prepared: ${option.name}.`)
          : (isSpanish ? `Busqueda de proveedor preparada: ${option.name}.` : `Provider search prepared: ${option.name}.`),
        payload: buildProviderContactPayload(option, context),
        useCase: mode === "shopping-seller" ? "find_offers" : "find_provider",
        providerSearchMode: mode,
        providerSearchCriteria,
        providerSearchQuery: context.query,
      },
    );
  }

  function providerShortlistMode(shortlist: ProviderShortlistState): ProviderSearchMode {
    return isProviderSearchMode(shortlist.context.mode) ? shortlist.context.mode : "shopping-seller";
  }

  function handleRemoveActiveShortlistOption(item: ConciergePendingItem, shortlist: ProviderShortlistState, option: ProviderComparisonOption) {
    const options = shortlist.options.filter((candidate) => candidate.id !== option.id);
    if (options.length === 0) {
      setActiveProviderShortlistError(isSpanish ? "Conserva una opcion o descarta la seleccion." : "Keep one option or dismiss the shortlist.");
      return;
    }
    activeProviderShortlistMutation.mutate({ item, shortlist, options });
  }

  function handleAddActiveShortlistOption(item: ConciergePendingItem, shortlist: ProviderShortlistState) {
    const mode = providerShortlistMode(shortlist);
    openProviderSearchPanel(mode, shortlist.context.query?.trim() || providerSearchModeLabel(mode, isSpanish));
    setProviderSearchCriteria((shortlist.context.criteria ?? []).filter(isProviderSearchCriterion));
    setEditingProviderShortlistId(item.id);
    setProviderShortlistNotice(isSpanish
      ? "Elige una opcion nueva y pulsa Guardar seleccion."
      : "Choose a new option, then keep the shortlist.");
  }

  function handleSelectActiveShortlistProvider(item: ConciergePendingItem, shortlist: ProviderShortlistState, option: ProviderComparisonOption) {
    activeProviderShortlistMutation.mutate({
      item,
      shortlist,
      options: shortlist.options,
      preferredProviderId: option.id,
    });
  }

  function handleRecheckActiveShortlist(item: ConciergePendingItem, shortlist: ProviderShortlistState) {
    recheckProviderShortlistMutation.mutate({ item, shortlist });
  }

  function handleSaveActiveShortlistProvider(item: ConciergePendingItem, shortlist: ProviderShortlistState, option: ProviderComparisonOption) {
    const mode = providerShortlistMode(shortlist);
    navigate("/onboarding/profile/providers", {
      state: {
        returnTo: "/concierge",
        setupFocus: providerSearchSetupFocus(mode),
        setupFlow: providerSearchFlowReference(mode),
        setupReason: "Save provider from active shortlist",
        conciergeResume: {
          kind: "provider_shortlist",
          pendingId: item.id,
          preferredProviderId: option.id,
        },
        providerPrefill: buildTrustedProviderPrefill(option, providerSearchSetupFocus(mode)),
        notice: isSpanish
          ? "Guarda el proveedor. Tu seleccion seguira en curso."
          : "Save the provider. Your shortlist will stay in progress.",
      },
    });
  }

  function handlePrepareActiveShortlistContact(item: ConciergePendingItem, shortlist: ProviderShortlistState, option: ProviderComparisonOption) {
    const mode = providerShortlistMode(shortlist);
    const context = { ...shortlist.context, locale };
    const plan = buildProviderContactPlan(option, context);
    const contactPayload = buildProviderContactPayload(option, context);
    const updatedShortlistPayload = updateProviderShortlistPayload(item.action_payload ?? {}, shortlist.options, {
      preferredProviderId: option.id,
    });
    void patchPendingConciergeAction({
      pendingId: item.id,
      actionPayload: updatedShortlistPayload,
    }).then(() => {
      prepareConciergeRequest(
        isSpanish
          ? `Prepara el contacto con ${option.name}. No llames, escribas ni reserves hasta que yo confirme.`
          : `Prepare contact with ${option.name}. Do not call, message, or book until I confirm.`,
        {
          flowReference: isConciergeFlowReference(shortlist.context.flowReference) ? shortlist.context.flowReference : providerSearchFlowReference(mode),
          requestedTool: plan.requestedTool,
          actionLabel: isSpanish ? "Preparar contacto" : "Prepare contact",
          summary: isSpanish ? `Contacto preparado con ${option.name}.` : `Contact prepared with ${option.name}.`,
          payload: {
            ...contactPayload,
            source_shortlist_pending_id: item.id,
            source_shortlist_payload: updatedShortlistPayload,
          },
          useCase: mode === "shopping-seller" ? "find_offers" : "find_provider",
          providerSearchMode: mode,
          providerSearchCriteria: (shortlist.context.criteria ?? []).filter(isProviderSearchCriterion),
          providerSearchQuery: shortlist.context.query ?? undefined,
        },
      );
    }).catch((error) => {
      setActiveProviderShortlistError(error instanceof Error ? error.message : (isSpanish ? "No he podido preparar el contacto." : "I could not prepare contact."));
    });
  }

  function handleProviderManualSearch() {
    const criteria = providerCriterionLabels(providerSearchCriteria, isSpanish).join(", ");
    const message = isSpanish
      ? [
        `Ayudame a buscar manualmente ${providerSearchModeLabel(providerSearchMode, true)}.`,
        `Busqueda: ${offersQuery.trim() || providerSearchModeLabel(providerSearchMode, true)}.`,
        `Criterios: ${criteria || "cercania, reputacion, acceso y precio claro"}.`,
        "Prepara opciones verificables y explicalas. No contactes ni compartas datos sin mi confirmacion.",
      ].join("\n")
      : [
        `Help me manually search for ${providerSearchModeLabel(providerSearchMode, false)}.`,
        `Search: ${offersQuery.trim() || providerSearchModeLabel(providerSearchMode, false)}.`,
        `Criteria: ${criteria || "proximity, reputation, access, and clear price"}.`,
        "Prepare verifiable options and explain them. Do not contact or share details without my confirmation.",
      ].join("\n");
    prepareConciergeRequest(message, {
      flowReference: providerSearchFlowReference(providerSearchMode),
      requestedTool: "operator_review",
      actionLabel: isSpanish ? "Buscar manualmente" : "Manual search",
      summary: isSpanish
        ? "Busqueda de proveedor preparada para revision."
        : "Provider search prepared for review.",
      useCase: "find_provider",
      providerSearchMode: providerSearchMode ?? undefined,
      providerSearchCriteria: providerSearchCriteria,
      providerSearchQuery: offersQuery.trim() || providerSearchModeLabel(providerSearchMode, isSpanish),
      payload: {
        provider_search_mode: providerSearchMode ?? null,
        provider_search_query: offersQuery.trim() || providerSearchModeLabel(providerSearchMode, isSpanish),
        criteria: providerSearchCriteria,
        chosen_criteria: providerSearchCriteria,
      },
    });
  }

  function openProviderSearchSetup() {
    navigate("/onboarding/profile/providers", {
      state: {
        returnTo: "/concierge",
        setupFocus: providerSearchSetupFocus(providerSearchMode),
        setupFlow: providerSearchFlowReference(providerSearchMode),
        setupReason: "Add or choose a trusted provider",
        conciergeResume: {
          kind: "provider_search",
          mode: providerSearchMode,
          query: offersQuery.trim(),
          criteria: providerSearchCriteria,
        },
        notice: isSpanish
          ? "Guarda un proveedor de confianza para que VYVA pueda usarlo primero."
          : "Add or choose a trusted provider so VYVA can use it first.",
      },
    });
  }

  const trustedProviderResumeMeta = trustedProviderResume
    ? {
        categoryLabel: providerSearchCategoryLabel(trustedProviderResume.category, isSpanish),
        primaryLabel: trustedProviderResume.category === "transport"
          ? (isSpanish ? "Continuar viaje" : "Continue ride")
          : trustedProviderResume.category === "pharmacy"
            ? (isSpanish ? "Continuar farmacia" : "Continue pharmacy")
            : trustedProviderResume.category === "doctor_clinic"
              ? (isSpanish ? "Continuar cita" : "Continue appointment")
              : trustedProviderResume.category === "home_service"
                ? (isSpanish ? "Continuar servicio" : "Continue service")
                : (isSpanish ? "Continuar" : "Continue"),
        detail: trustedProviderResume.category === "transport"
          ? (isSpanish ? "Ahora VYVA puede preguntar destino y hora." : "VYVA can now ask for destination and time.")
          : trustedProviderResume.category === "pharmacy"
            ? (isSpanish ? "Ahora VYVA puede preparar productos sin receta." : "VYVA can now prepare non-prescription items.")
            : trustedProviderResume.category === "doctor_clinic"
              ? (isSpanish ? "Ahora VYVA puede preparar la solicitud de cita." : "VYVA can now prepare the appointment request.")
              : trustedProviderResume.category === "home_service"
                ? (isSpanish ? "Ahora VYVA puede preparar el servicio en casa." : "VYVA can now prepare the home service.")
                : (isSpanish ? "VYVA lo usara primero si encaja." : "VYVA will use this first when it fits."),
      }
    : null;
  const providerSetupHelpRequestMeta = providerSetupHelpRequest
    ? {
        categoryLabel: providerSearchCategoryLabel(
          providerCategoryFromResumeContext(providerSetupHelpRequest.conciergeResume),
          isSpanish,
        ),
        title: isSpanish ? "Ayuda de configuracion solicitada" : "Setup help requested",
        detail: providerSetupHelpRequest.helperName
          ? (isSpanish
            ? `${providerSetupHelpRequest.helperName} puede ayudarte a guardar el proveedor.`
            : `${providerSetupHelpRequest.helperName} can help save the provider.`)
          : (isSpanish
            ? "Cuando la persona de confianza lo configure, VYVA podra continuar desde aqui."
            : "When your trusted helper sets it up, VYVA can continue from here."),
      }
    : null;

  function continueConciergeProviderResume(resumeRoute: TrustedProviderSavedRoute) {
    const { name, category, conciergeResume } = resumeRoute;

    if (conciergeResume?.kind === "provider_shortlist") {
      const resumeNotice = isSpanish
        ? `${name} guardado. Tu seleccion sigue en curso.`
        : `${name} saved. Your shortlist is still in progress.`;
      setVisibleActionId(conciergeResume.pendingId);
      setIsRightNowHidden(false);
      window.setTimeout(() => setActiveProviderShortlistNotice(resumeNotice), 0);
      window.setTimeout(() => scrollIntoViewIfAvailable(rightNowSectionRef.current, { behavior: "smooth", block: "start" }), 80);
      return;
    }

    if (conciergeResume?.kind === "transport") {
      const resumeInVoiceCanvas = conciergeResume.voiceCanvas === true;
      const message = conciergeResume.message?.trim()
        || (isSpanish
          ? `Usa ${name} como proveedor de transporte de confianza. Confirma destino, recogida y hora antes de reservar.`
          : `Use ${name} as my trusted transport provider. Confirm destination, pickup, and time before booking.`);
      setRoutePrefill({ kind: "ride", message, source: resumeInVoiceCanvas ? "voice_action" : "home_quick_action" });
      setInput((current) => current.trim() ? current : message);
      clearAppointmentAssistantState();
      setInsuranceAdminOpen(false);
      setScamCheckOpen(false);
      setOtcPharmacyOpen(false);
      setTransportPickup(conciergeResume.pickup?.trim() || savedTransportPickupLabel);
      setTransportDestination(conciergeResume.destination?.trim() || "");
      setTransportTime(conciergeResume.time?.trim() || "now");
      setTransportMobilityNeeds(conciergeResume.mobilityNeeds ?? []);
      setTransportResult(null);
      setTransportError(null);
      setTransportNotice(null);
      resetTransportFinalReview();
      setTransportDetailsOpen(true);
      setOffersOpen(false);
      if (resumeInVoiceCanvas) {
        setRideCanvasMode(true);
        setRideCanvasSelectedOptionId(null);
        advanceRideCanvas(conciergeResume.destination?.trim() ? "review" : "destination");
      }
      window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
      return;
    }

    if (conciergeResume?.kind === "otc_pharmacy") {
      openOtcPharmacyAssistant();
      setOtcItemText(conciergeResume.itemText?.trim() || "");
      setOtcFulfillmentPreference(conciergeResume.fulfillmentPreference ?? "delivery");
      setOtcRequestedTime(conciergeResume.requestedTime?.trim() || "today");
      setOtcNotes(conciergeResume.notes?.trim() || "");
      setOtcNotice(isSpanish
        ? `${name} guardado. Continua con el producto sin receta.`
        : `${name} saved. Continue with the non-prescription item.`);
      return;
    }

    if (conciergeResume?.kind === "medical_appointment") {
      openScheduleAssistant(conciergeResume.appointmentType ?? "medical");
      const restoredReason = conciergeResume.note?.trim() || (isSpanish
        ? `Usa ${name} como proveedor medico de confianza. Preguntame motivo y horario preferido antes de preparar la solicitud.`
        : `Use ${name} as my trusted medical provider. Ask me for reason and preferred time before preparing the request.`);
      setAppointmentNote(restoredReason);
      setAppointmentCanvasRequestedTime(conciergeResume.requestedTime?.trim() || "");
      setAppointmentCanvasCoverageLabel(conciergeResume.coverageLabel?.trim() || "");
      if (conciergeResume.voiceCanvas === true) {
        setAppointmentCanvasMode(true);
        advanceAppointmentCanvas(conciergeResume.requestedTime?.trim() ? "provider" : "time");
      }
      return;
    }

    if (conciergeResume?.kind === "home_service") {
      openHomeServiceAssistant();
      setHomeServiceIntakeOrigin(conciergeResume.origin ?? "app");
      setHomeServiceType(conciergeResume.serviceType ?? null);
      setHomeServiceIntakeAnswers(conciergeResume.answers ?? {});
      setHomeServiceTextDrafts(conciergeResume.textDrafts ?? conciergeResume.answers ?? {});
      setHomeServiceCanvasPhoto(null);
      setHomeServiceCanvasPhotoName(conciergeResume.photoName?.trim() || "");
      setAppointmentNote(conciergeResume.note?.trim() || (isSpanish
        ? `Usa ${name} como proveedor de servicio en casa de confianza. Preguntame el problema, urgencia y horario preferido.`
        : `Use ${name} as my trusted home-service provider. Ask me for the problem, urgency, and preferred time.`));
      if (conciergeResume.voiceCanvas === true) {
        setHomeServiceCanvasMode(true);
        setHomeServiceCanvasError(null);
        advanceHomeServiceCanvas("provider");
      }
      return;
    }

    if (conciergeResume?.kind === "provider_search") {
      const mode = conciergeResume.mode
        ?? (category === "doctor_clinic" ? "specialist" : category === "personal_care" ? "personal-care" : null);
      if (mode) {
        openProviderSearchPanel(mode, conciergeResume.query?.trim() || (isSpanish ? `usar ${name}` : `use ${name}`));
        if (conciergeResume.criteria?.length) {
          setProviderSearchCriteria(conciergeResume.criteria);
        }
        return;
      }
    }

    if (conciergeResume?.kind === "generic" && conciergeResume.message?.trim()) {
      prepareConciergeRequest(conciergeResume.message);
      return;
    }

    if (category === "transport") {
      prepareRideRequest(isSpanish
        ? `Usa ${name} como proveedor de transporte de confianza. Preguntame destino, recogida y hora. No reserves sin mi confirmacion.`
        : `Use ${name} as my trusted transport provider. Ask me for destination, pickup, and time. Do not book without my confirmation.`);
      return;
    }

    if (category === "pharmacy") {
      openOtcPharmacyAssistant();
      setOtcNotice(isSpanish
        ? `${name} guardado. Dime que producto sin receta necesitas.`
        : `${name} saved. Tell me which non-prescription item you need.`);
      return;
    }

    if (category === "doctor_clinic") {
      openScheduleAssistant("medical");
      setAppointmentNote(isSpanish
        ? `Usa ${name} como proveedor medico de confianza. Preguntame motivo y horario preferido antes de preparar la solicitud.`
        : `Use ${name} as my trusted medical provider. Ask me for reason and preferred time before preparing the request.`);
      return;
    }

    if (category === "home_service") {
      openHomeServiceAssistant();
      setAppointmentNote(isSpanish
        ? `Usa ${name} como proveedor de servicio en casa de confianza. Preguntame el problema, urgencia y horario preferido.`
        : `Use ${name} as my trusted home-service provider. Ask me for the problem, urgency, and preferred time.`);
      return;
    }

    if (category === "personal_care") {
      openProviderSearchPanel("personal-care", isSpanish
        ? `usar proveedor guardado ${name}`
        : `use saved provider ${name}`);
      return;
    }

    prepareConciergeRequest(isSpanish
      ? `He guardado ${name} como proveedor de confianza (${providerSearchCategoryLabel(category, true)}). Ayudame a usarlo para la solicitud correcta y pideme confirmacion antes de contactar.`
      : `I saved ${name} as a trusted provider (${providerSearchCategoryLabel(category, false)}). Help me use it for the right request and ask me to confirm before contacting.`);
  }

  function continueTrustedProviderResume() {
    if (!trustedProviderResume) return;
    const resumeRoute = trustedProviderResume;
    setTrustedProviderResume(null);
    continueConciergeProviderResume(resumeRoute);
  }

  function continueProviderSetupHelpRequest() {
    if (!providerSetupHelpRequest) return;
    const request = providerSetupHelpRequest;
    setProviderSetupHelpRequest(null);
    continueConciergeProviderResume({
      name: isSpanish ? "tu proveedor" : "your provider",
      category: providerCategoryFromResumeContext(request.conciergeResume),
      conciergeResume: request.conciergeResume,
    });
  }

  function handleOfferWatch(option: OfferOption) {
    const criteria = providerCriterionLabels(providerSearchCriteria, isSpanish);
    const message = isSpanish
      ? [
        `Vigila cambios importantes para ${option.name}.`,
        "Avisame si cambia el precio, aparece una permanencia, faltan documentos, baja la confianza o aparece una opcion claramente mejor.",
        "Antes de actuar, prepara un resumen breve y pideme confirmacion.",
      ].join("\n")
      : [
        `Watch important changes for ${option.name}.`,
        "Notify me if the price changes, a commitment appears, documents are missing, trust drops, or a clearly better option appears.",
        "Before acting, prepare a short summary and ask me to confirm.",
      ].join("\n");
    prepareConciergeRequest(message, {
      flowReference: SHOPPING_SUPPORT_FLOW_REFERENCE,
      requestedTool: "operator_review",
      actionLabel: isSpanish ? "Vigilar cambios" : "Watch changes",
      summary: isSpanish
        ? `Seguimiento preparado: ${option.name}.`
        : `Offer watch prepared: ${option.name}.`,
      payload: offerReviewStructuredPayload(option, {
        intent: "watch",
        query: offersQuery.trim(),
        criteria,
        category: offersResult?.category,
      }),
      useCase: "find_offers",
    });
  }

  const activeAction = pendingActions.find((action) => action.id === visibleActionId) ?? pendingActions[0];
  const activeActionProviderShortlist = parseProviderShortlistPayload(activeAction?.action_payload);
  const activeActionProviderShortlistNotice = activeProviderShortlistNotice
    ?? (activeActionProviderShortlist && activeAction?.action_payload?.contact_handoff_status === "unavailable"
      ? (isSpanish ? "Este proveedor no esta disponible. Elige otra opcion guardada." : "This provider is unavailable. Choose another saved option.")
      : null);
  const activeActionIsDryRun = activeAction ? isConciergeDryRunPayload(activeAction.action_payload) : false;
  const queuedActions = activeAction ? pendingActions.filter((action) => action.id !== activeAction.id) : [];
  const queuedActionCount = queuedActions.length;
  const recentCompletedSessions = completedSessions
    .filter((session) => session.outcome === "completed" || Boolean(session.completed_at))
    .sort((a, b) => {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })
    .slice(0, 3);
  const selectedCompletedSession = selectedCompletedSessionId
    ? completedSessions.find((session) => session.id === selectedCompletedSessionId) ?? null
    : null;
  const selectedCompletedSessionReceipt = selectedCompletedSession
    ? buildConciergeConfirmationReceipt({
        useCase: selectedCompletedSession.use_case,
        providerName: selectedCompletedSession.provider_name,
        outcome: selectedCompletedSession.outcome,
        outcomeSummary: selectedCompletedSession.outcome_summary,
        completedAt: selectedCompletedSession.completed_at,
        payload: selectedCompletedSession.outcome_payload,
      }, isSpanish)
    : null;
  const selectedCompletedSessionContactLink = selectedCompletedSession
    ? completedSessionContactLink(selectedCompletedSession, isSpanish)
    : null;
  const priorityOfferIdeas = OFFER_IDEA_CHIPS.slice(0, 3);
  const activeActionPhoneHref = phoneHref(activeAction?.provider_phone);
  const activeActionBookingUrl = activeAction ? getBookingUrl(activeAction) : "";
  const activeActionEmailDraft = activeAction ? getActionEmailDraft(activeAction) : null;
  const activeActionEmailHref = activeActionEmailDraft ? emailDraftHref(activeActionEmailDraft) : "";
  const activeActionWhatsAppDraft = activeAction ? getActionWhatsAppDraft(activeAction) : null;
  const activeActionWhatsAppHref = activeActionWhatsAppDraft ? whatsAppDraftHref(activeActionWhatsAppDraft) : "";
  const activeActionTimeline = activeAction && !activeActionProviderShortlist ? buildConciergeFollowThroughStatus(activeAction, isSpanish) : null;
  const activeActionExecutionTask = activeAction && !activeActionProviderShortlist ? getConciergeExecutionTask(activeAction) : null;
  const activeActionExecutionStatus = activeAction
    ? buildConciergeExecutionStatus(activeAction, activeActionTimeline, isSpanish)
    : null;
  const activeActionUserUpdate = activeAction && activeActionExecutionStatus
    ? buildConciergeUserUpdateSummary(activeAction, activeActionExecutionStatus, isSpanish)
    : null;
  const activeActionLiveHandoff = activeAction && !activeActionProviderShortlist
    ? buildConciergeLiveHandoffSummary(activeAction, isSpanish)
    : null;
  const activeActionCanRecordProviderReply = canRecordProviderReply(activeActionTimeline);
  const providerReplyCanvasRolloutQuery = useQuery({
    queryKey: ["/api/config/features/provider-reply-voice-canvas"],
    queryFn: async () => {
      const response = await apiFetch("/api/config/features/provider-reply-voice-canvas");
      return response.ok
        ? parseProviderReplyCanvasRolloutConfig(await response.json())
        : { enabled: false, rolloutPercent: 0 };
    },
    enabled: Boolean(activeActionCanRecordProviderReply && activeAction),
    staleTime: 0,
    refetchInterval: 10_000,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  const usesProviderReplyVoiceCanvas = Boolean(
    activeAction &&
      activeActionCanRecordProviderReply &&
      isProviderReplyCanvasEnabled(
        providerReplyCanvasRolloutQuery.data,
        activeAction.id,
      ),
  );
  const providerReplyCanvasCopy = useMemo<ProviderReplyCanvasCopy>(() => ({
    agentPresence: {
      idleLabel: isSpanish ? "VYVA lista" : "VYVA is ready",
      idleDescription: isSpanish ? "Puedes hablar o tocar la pantalla." : "You can speak or use the screen.",
      listeningLabel: isSpanish ? "Escuchando contigo" : "Listening with you",
      listeningDescription: isSpanish ? "Puedes dictar la respuesta o revisar los campos." : "You can dictate the reply or review the fields.",
      speakingLabel: isSpanish ? "VYVA está hablando" : "VYVA is speaking",
      speakingDescription: isSpanish ? "La pantalla seguirá el mismo paso." : "The screen will stay on the same step.",
      thinkingLabel: isSpanish ? "Guardando la respuesta" : "Thinking through the provider reply",
      thinkingDescription: isSpanish ? "Revisando el registro antes de guardar." : "Checking the record before saving.",
      accessibleLabel: isSpanish ? "Estado de voz de VYVA para la respuesta del proveedor" : "VYVA voice status for the provider reply",
      spokenChoiceMessage: (label) => isSpanish ? `VYVA escuchó ${label}` : `VYVA heard ${label}`,
    },
    listening: {
      status: isSpanish ? "Escuchando" : "Listening",
      title: isSpanish ? "Revisemos la respuesta" : "Review the provider reply",
      helper: isSpanish ? "Usa voz, pantalla o teclado." : "Use voice, touch, or keyboard.",
      start: isSpanish ? "Empezar" : "Start",
      cancel: isSpanish ? "Ahora no" : "Not now",
    },
    context: {
      title: isSpanish ? "Contexto del proveedor" : "Provider context",
      helper: isSpanish
        ? "Comprueba la tarea antes de guardar nada."
        : "Check the task before saving anything.",
      provider: isSpanish ? "Proveedor" : "Provider",
      providerType: isSpanish ? "Tipo de proveedor" : "Provider type",
      action: isSpanish ? "Tarea" : "Task",
      waiting: isSpanish ? "Espera" : "Waiting",
      continue: isSpanish ? "Continuar" : "Continue",
      back: isSpanish ? "Volver" : "Back",
    },
    reply: {
      title: isSpanish ? "Que dijeron?" : "What did they say?",
      helper: isSpanish
        ? "Guarda solo la respuesta del proveedor."
        : "Record only the provider reply.",
      label: isSpanish ? "Respuesta del proveedor" : "Provider reply",
      placeholder: isSpanish ? "El proveedor confirmo..." : "The provider confirmed...",
      continue: isSpanish ? "Continuar" : "Continue",
      back: isSpanish ? "Volver" : "Back",
    },
    scheduledFor: {
      title: isSpanish ? "Cuando esta programado?" : "When is it scheduled?",
      helper: isSpanish
        ? "Hace falta fecha y hora para guardar esto en Scheduled Support."
        : "A date and time is needed for Scheduled Support.",
      label: isSpanish ? "Fecha y hora confirmadas" : "Confirmed date and time",
      continue: isSpanish ? "Continuar" : "Continue",
      back: isSpanish ? "Volver" : "Back",
    },
    details: {
      title: isSpanish ? "Alguna nota para VYVA?" : "Any note for VYVA?",
      helper: isSpanish ? "Opcional." : "Optional.",
      label: isSpanish ? "Notas" : "Notes",
      placeholder: isSpanish ? "Nota opcional" : "Optional note",
      continue: isSpanish ? "Revisar" : "Review",
      back: isSpanish ? "Volver" : "Back",
    },
    review: {
      title: isSpanish ? "Revisa antes de guardar" : "Review before saving",
      helper: isSpanish
        ? "Esto guarda la respuesta, pero no completa la tarea."
        : "This saves the reply, but does not complete the task.",
      provider: isSpanish ? "Proveedor" : "Provider",
      intent: isSpanish ? "Intencion de respuesta" : "Reply intent",
      action: isSpanish ? "Tarea" : "Task",
      reply: isSpanish ? "Respuesta" : "Reply",
      scheduledFor: isSpanish ? "Programado para" : "Scheduled for",
      notes: isSpanish ? "Notas" : "Notes",
      noNotes: isSpanish ? "Ninguna" : "None",
      save: isSpanish ? "Guardar respuesta" : "Save reply",
      back: isSpanish ? "Volver" : "Back",
    },
    saving: {
      status: isSpanish ? "Guardando" : "Saving",
      title: isSpanish ? "Guardando la respuesta" : "Saving the reply",
      helper: isSpanish ? "No se envia ningun mensaje externo." : "No external message is sent.",
      action: isSpanish ? "Guardando..." : "Saving...",
    },
    saved: {
      status: isSpanish ? "Guardada" : "Saved",
      title: isSpanish ? "Respuesta guardada" : "Reply saved",
      helper: isSpanish
        ? "Ahora puedes marcar la tarea como hecha."
        : "Now you can mark the task complete.",
      reference: isSpanish ? "Referencia" : "Reference",
      markComplete: isSpanish ? "Marcar completado" : "Mark complete",
      edit: isSpanish ? "Editar respuesta" : "Edit reply",
    },
    completing: {
      status: isSpanish ? "Completando" : "Completing",
      title: isSpanish ? "Completando la tarea" : "Completing the task",
      helper: isSpanish ? "Espera un momento." : "Please wait.",
      action: isSpanish ? "Completando..." : "Completing...",
    },
    completed: {
      status: isSpanish ? "Completado" : "Completed",
      title: isSpanish ? "Tarea completada" : "Task complete",
      helper: isSpanish
        ? "La respuesta guardada queda en el historial."
        : "The saved reply is in history.",
      reference: isSpanish ? "Referencia" : "Reference",
      done: isSpanish ? "Terminar" : "Done",
    },
    blocked: {
      status: isSpanish ? "Necesita atencion" : "Needs attention",
      title: isSpanish ? "Necesita atencion" : "Needs attention",
      helper: isSpanish ? "Revisa e intentalo otra vez." : "Review and try again.",
      missingContextHelper: isSpanish
        ? "Falta el contexto del proveedor."
        : "Provider context is missing.",
      incompleteReplyHelper: isSpanish
        ? "Anade la respuesta del proveedor antes de continuar."
        : "Add the provider reply before continuing.",
      incompleteScheduledForHelper: isSpanish
        ? "Anade una fecha y hora validas antes de continuar."
        : "Add a valid date and time before continuing.",
      urgentBoundaryHelper: isSpanish
        ? "Esto puede necesitar ayuda urgente. No se envio ningun mensaje."
        : "This may need urgent help. No message was sent.",
      retry: isSpanish ? "Reintentar" : "Retry",
      cancel: isSpanish ? "Cancelar" : "Cancel",
    },
    cancelled: {
      status: isSpanish ? "Cancelado" : "Cancelled",
      title: isSpanish ? "No se guardo nada" : "Nothing saved",
      helper: isSpanish ? "La respuesta no se guardo." : "The reply was not saved.",
      restart: isSpanish ? "Empezar otra vez" : "Start again",
    },
    detailLabels: {
      messagePurpose: isSpanish ? "Proposito del mensaje" : "Message purpose",
      providerType: isSpanish ? "Tipo de proveedor" : "Provider type",
      confidence: isSpanish ? "Confianza" : "Confidence",
      reviewNeeded: isSpanish ? "Revisar" : "Review needed",
      draftOnly: isSpanish ? "Solo borrador" : "Draft only",
      noMessageSent: isSpanish ? "No se envio ningun mensaje" : "No message sent yet",
      reviewBeforeSend: isSpanish ? "Revisar antes de enviar" : "Review before send",
      recommended: isSpanish ? "Recomendado" : "Recommended",
      urgentBoundary: isSpanish ? "Limite de seguridad urgente" : "Urgent safety boundary",
      outgoingDraft: isSpanish ? "Borrador saliente" : "Outgoing draft",
      editBeforeSend: isSpanish ? "Puedes editar antes de guardar nada." : "You can edit before anything is saved.",
    },
    progress: (current, total) => isSpanish ? `Paso ${current} de ${total}` : `Step ${current} of ${total}`,
  }), [isSpanish]);
  const providerReplyCanvasContext = useMemo(() => {
    if (!activeAction) return {};
    const providerName = providerSearchProviderName(activeAction, isSpanish)
      || activeAction.provider_name?.trim()
      || payloadString(activeAction.action_payload, ["provider_name", "pharmacy_name", "selected_provider_name"]);
    const actionLabel = getPendingActionUseCaseLabel(activeAction, locale);
    const providerType = providerSearchCategoryLabel(providerSearchCategoryFromAction(activeAction), isSpanish);
    const existingReply = conciergeProviderReplySnapshot(activeAction.action_payload);
    const summary = existingReply?.summary || existingReply?.reply || activeAction.action_summary;
    return {
      providerName,
      providerType,
      actionLabel,
      waitingSinceLabel: formatProviderWaitingSince(activeAction, locale, isSpanish, providerWaitingClockMs),
      requiresScheduledFor: isMedicalAppointmentPendingAction(activeAction) || isHomeServicePendingAction(activeAction),
      replyIntents: [
        {
          id: "confirm-appointment",
          label: isSpanish ? "Confirmar cita o detalle" : "Confirm appointment or detail",
          subtitle: isSpanish ? "Solo borrador" : "Draft only",
          description: isSpanish ? "Guardar la confirmacion para revisarla." : "Save the confirmation for review.",
          providerType,
          purposeLabel: isSpanish ? "Confirmar" : "Confirm",
          confidenceLabel: isSpanish ? "Revisar" : "Review needed",
          draftOnlyLabel: isSpanish ? "No se envio ningun mensaje" : "No message sent yet",
          reviewReminder: isSpanish ? "Revisar antes de enviar" : "Review before send",
          recommended: true,
          voiceAliases: isSpanish ? ["confirmar", "confirmar cita"] : ["confirm", "confirm appointment"],
        },
        {
          id: "reschedule",
          label: isSpanish ? "Reprogramar" : "Reschedule",
          subtitle: isSpanish ? "Necesita revision" : "Needs review",
          description: isSpanish ? "Preparar una respuesta de cambio de horario." : "Prepare a schedule-change reply.",
          providerType,
          purposeLabel: isSpanish ? "Reprogramar" : "Reschedule",
          confidenceLabel: isSpanish ? "Revisar" : "Review needed",
          draftOnlyLabel: isSpanish ? "No se envio ningun mensaje" : "No message sent yet",
          voiceAliases: isSpanish ? ["reprogramar"] : ["reschedule"],
        },
        {
          id: "ask-question",
          label: isSpanish ? "Hacer una pregunta" : "Ask a question",
          subtitle: isSpanish ? "Solo borrador" : "Draft only",
          description: isSpanish ? "Preparar una pregunta antes de guardar." : "Prepare a question before saving.",
          providerType,
          purposeLabel: isSpanish ? "Pregunta" : "Question",
          confidenceLabel: isSpanish ? "Revisar" : "Review needed",
          draftOnlyLabel: isSpanish ? "No se envio ningun mensaje" : "No message sent yet",
          voiceAliases: isSpanish ? ["pregunta", "hacer pregunta"] : ["question", "ask a question"],
        },
        {
          id: "send-info",
          label: isSpanish ? "Enviar informacion o documentos" : "Send information or documents",
          subtitle: isSpanish ? "Revisar primero" : "Review first",
          description: isSpanish ? "Preparar informacion para revisar antes de cualquier envio." : "Prepare information to review before anything is sent.",
          providerType,
          purposeLabel: isSpanish ? "Informacion" : "Information",
          confidenceLabel: isSpanish ? "Revisar" : "Review needed",
          draftOnlyLabel: isSpanish ? "No se envio ningun mensaje" : "No message sent yet",
          voiceAliases: isSpanish ? ["informacion", "documentos"] : ["information", "documents", "send documents"],
        },
        {
          id: "decline-cancel",
          label: isSpanish ? "Cancelar o rechazar" : "Decline or cancel",
          subtitle: isSpanish ? "Necesita revision" : "Needs review",
          description: isSpanish ? "Preparar una respuesta para revisar antes de actuar." : "Prepare a reply to review before acting.",
          providerType,
          purposeLabel: isSpanish ? "Cancelar" : "Cancel",
          confidenceLabel: isSpanish ? "Revisar" : "Review needed",
          draftOnlyLabel: isSpanish ? "No se envio ningun mensaje" : "No message sent yet",
          voiceAliases: isSpanish ? ["cancelar", "rechazar"] : ["cancel", "decline"],
        },
        {
          id: "urgent",
          label: isSpanish ? "Urgente o seguridad" : "Urgent or safety concern",
          subtitle: isSpanish ? "Detiene este flujo" : "Stops this flow",
          description: isSpanish ? "No uses una respuesta normal para ayuda urgente." : "Do not use a normal provider reply for urgent help.",
          providerType,
          purposeLabel: isSpanish ? "Urgente" : "Urgent",
          confidenceLabel: isSpanish ? "Bloqueado" : "Blocked",
          draftOnlyLabel: isSpanish ? "No se envio ningun mensaje" : "No message sent yet",
          boundaryLabel: isSpanish ? "Este camino queda bloqueado y seguro." : "This path is blocked and safe.",
          urgent: true,
          voiceAliases: isSpanish ? ["urgente", "emergencia"] : ["urgent", "emergency"],
        },
      ],
      rows: summary ? [{
        id: "summary",
        label: isSpanish ? "Resumen" : "Summary",
        value: summary,
      }] : [],
    };
  }, [activeAction, isSpanish, locale, providerWaitingClockMs]);
  const providerReplyCanvasInitialDraft = useMemo(() => {
    if (!activeAction) return undefined;
    const form = providerReplyInitialForm(activeAction, isSpanish);
    return {
      providerReply: form.providerReply,
      scheduledFor: form.scheduledFor,
      notes: form.notes,
    };
  }, [activeAction, isSpanish]);
  const providerReplyCanvasCommands = useMemo(() => ({
    start: isSpanish ? ["empezar", "revisar respuesta"] : ["start", "review reply"],
    back: isSpanish ? ["volver", "atras"] : ["back", "go back"],
    cancel: isSpanish ? ["cancelar", "ahora no"] : ["cancel", "not now"],
    continue: isSpanish ? ["continuar"] : ["continue"],
    save: isSpanish ? ["guardar respuesta", "guardar"] : ["save reply", "save"],
    complete: isSpanish ? ["marcar completado", "completar"] : ["mark complete", "complete"],
    retry: isSpanish ? ["reintentar", "intentar otra vez"] : ["retry", "try again"],
    skip: isSpanish ? ["omitir", "sin notas"] : ["skip", "no notes"],
  }), [isSpanish]);
  const saveProviderReplyFromCanvas = useCallback(async (
    draft: Readonly<ProviderReplyCanvasDraft>,
    { signal }: { requestId: number; revision: number; signal: AbortSignal },
  ) => {
    if (!activeAction) {
      throw new Error(isSpanish ? "No hay tarea activa." : "No active task.");
    }
    const initialForm = providerReplyInitialForm(activeAction, isSpanish);
    const form: ProviderReplyForm = {
      ...initialForm,
      providerReply: draft.providerReply,
      scheduledFor: draft.scheduledFor || initialForm.scheduledFor,
      notes: draft.notes,
    };
    const result = await providerReplyCompletionMutation.mutateAsync({ item: activeAction, form });
    if (signal.aborted) throw new DOMException("Provider reply save cancelled", "AbortError");
    const completionStatus = isRecord(result) && typeof result.completionStatus === "string"
      ? result.completionStatus
      : "reply_received";
    return {
      summary: completionStatus === "review_pending"
        ? (isSpanish
            ? "Respuesta guardada. Revisa antes de completar la tarea."
            : "Reply saved. Review before completing the task.")
        : (isSpanish
            ? "Respuesta guardada. Marca la tarea como hecha cuando termines."
            : "Reply saved. Mark the task done when you are finished."),
      reference: payloadString(activeAction.action_payload, ["reference", "booking_reference"]) || activeAction.id,
    };
  }, [activeAction, isSpanish, providerReplyCompletionMutation]);
  const markProviderReplyCompleteFromCanvas = useCallback(async (
    _draft: Readonly<ProviderReplyCanvasDraft>,
    { signal }: { requestId: number; revision: number; signal: AbortSignal },
  ) => {
    if (!activeAction) {
      throw new Error(isSpanish ? "No hay tarea activa." : "No active task.");
    }
    const result = await providerMarkCompleteMutation.mutateAsync({ item: activeAction });
    if (signal.aborted) throw new DOMException("Provider reply completion cancelled", "AbortError");
    return {
      reference: isRecord(result) && typeof result.sessionId === "string"
        ? result.sessionId
        : activeAction.id,
    };
  }, [activeAction, isSpanish, providerMarkCompleteMutation]);
  const activeActionProviderSearchDetails = !activeActionProviderShortlist && isProviderSearchPendingAction(activeAction)
    ? providerSearchActionDetails(activeAction, isSpanish)
    : null;
  const activeActionWebSearch = !activeActionProviderShortlist && isWebSearchPendingAction(activeAction) ? activeAction : null;
  const activeActionWebSearchResult = activeActionWebSearch
    ? webSearchResultsByActionId[activeActionWebSearch.id] ?? null
    : null;
  const activeActionWebSearchError = activeActionWebSearch
    ? webSearchErrorsByActionId[activeActionWebSearch.id] ?? null
    : null;
  const selectedScamCheckOption = SCAM_CHECK_OPTIONS.find((option) => option.key === selectedScamCheckKind) ?? null;
  const selectedScamCheckCopy = selectedScamCheckOption
    ? scamCheckDetailCopy(selectedScamCheckOption.key, isSpanish)
    : null;
  const SelectedScamCheckIcon = selectedScamCheckOption?.Icon ?? AlertTriangle;
  const selectedInsuranceAdminOption = INSURANCE_ADMIN_OPTIONS.find((option) => option.key === selectedInsuranceAdminKind) ?? null;
  const selectedInsuranceAdminCopy = selectedInsuranceAdminOption
    ? insuranceAdminDetailCopy(selectedInsuranceAdminOption.key, isSpanish)
    : null;
  const SelectedInsuranceAdminIcon = selectedInsuranceAdminOption?.Icon ?? FileText;
  useEffect(() => {
    setActiveProviderShortlistNotice(null);
    setActiveProviderShortlistError(null);
    setGuidedDetailDraft("");
    setGuidedDetailNotice(null);
    setGuidedDetailError(null);
    setProviderReplyMode(null);
    setProviderReplyForm(EMPTY_PROVIDER_REPLY_FORM);
    setProviderReplyNotice(null);
    setProviderReplyError(null);
    setBookingFormOutcomeForm(EMPTY_BOOKING_FORM_OUTCOME_FORM);
    setBookingFormNotice(null);
    setBookingFormError(null);
    setPhoneCallOutcomeForm(EMPTY_PHONE_CALL_OUTCOME_FORM);
    setPhoneCallOutcomeNotice(null);
    setPhoneCallOutcomeError(null);
    setEmailDraftOutcomeForm(EMPTY_EMAIL_DRAFT_OUTCOME_FORM);
    setEmailDraftNotice(null);
    setEmailDraftError(null);
    setWhatsAppDraftOutcomeForm(EMPTY_WHATSAPP_DRAFT_OUTCOME_FORM);
    setWhatsAppDraftNotice(null);
    setWhatsAppDraftError(null);
    setManualReviewOutcomeForm(EMPTY_MANUAL_REVIEW_OUTCOME_FORM);
    setManualReviewNotice(null);
    setManualReviewError(null);
    setDryRunOutcomeNotice(null);
    setDryRunOutcomeError(null);
  }, [activeAction?.id]);
  useEffect(() => {
    const routeState = location.state as ConciergeLocationState;
    const routeAction = coerceConciergeProviderRouteAction(routeState?.conciergeProviderAction);
    if (!routeAction) {
      if (routeState?.conciergeProviderAction) {
        navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
      }
      return;
    }

    if (mode === "home") {
      navigate(conciergeTaskPath(routeAction.pendingId), { replace: true, state: location.state });
      return;
    }

    const targetAction = pendingActions.find((action) => action.id === routeAction.pendingId);
    if (!targetAction) return;
    if (activeAction?.id !== targetAction.id) {
      setVisibleActionId(targetAction.id);
      return;
    }
    if (!activeActionCanRecordProviderReply) return;

    const actionKey = `${routeAction.pendingId}:${routeAction.mode}`;
    if (lastProviderRouteActionKeyRef.current === actionKey) return;
    lastProviderRouteActionKeyRef.current = actionKey;

    if (routeAction.mode === "follow_up") {
      handleProviderFollowUp(targetAction);
    } else {
      openProviderReplyMode(targetAction, "confirmed");
    }
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [
    activeAction?.id,
    activeActionCanRecordProviderReply,
    handleProviderFollowUp,
    location.pathname,
    location.search,
    location.state,
    mode,
    navigate,
    openProviderReplyMode,
    pendingActions,
  ]);
  const activeActionPreferredHandoffChannel = activeAction ? getPreferredHandoffChannel(activeAction) : "";
  const activeActionOpensWhatsApp = Boolean(activeActionWhatsAppDraft && (
    activeActionPreferredHandoffChannel === "whatsapp" ||
    (!activeAction?.provider_phone && !activeActionEmailDraft && !activeActionBookingUrl)
  ));
  const activeActionOpensEmail = Boolean(activeActionEmailDraft && !activeActionOpensWhatsApp && (
    activeActionPreferredHandoffChannel === "email" ||
    (!activeAction?.provider_phone && !activeActionBookingUrl)
  ));
  const activeActionExecutionChannel = activeAction ? getExecutionChannel(activeAction) : "";
  const activeActionAlreadyConfirmed = activeAction ? conciergeActionAlreadyConfirmed(activeAction) : false;
  const activeActionReviewConfirmed = activeAction ? confirmedReviewActionIds.has(activeAction.id) : false;
  const activeActionNeedsUserConfirmation = Boolean(!activeActionProviderShortlist && activeAction?.status === "pending" && !activeActionAlreadyConfirmed);
  const activeActionCanSaveDryRunOutcome = Boolean(
    activeActionIsDryRun &&
    activeAction &&
    (
      activeActionReviewConfirmed ||
      activeActionAlreadyConfirmed ||
      activeActionExecutionTask?.user_confirmed ||
      activeAction.status === "calling"
    ),
  );
  const activeActionGuidedDetails = activeAction
    ? buildConciergeGuidedDetailCapture({
        useCase: activeAction.use_case,
        payload: activeAction.action_payload,
        providerName: activeAction.provider_name,
        providerPhone: activeAction.provider_phone,
        locale,
      })
    : null;
  const activeActionNeedsRecipientEmail = Boolean(
    activeActionGuidedDetails?.nextQuestion?.key === "recipient_email"
      && activeActionExecutionChannel === "email",
  );
  const activeActionCoreGuidedUseCase = Boolean(
    activeAction &&
    ["book_ride", "order_medicine", "home_service"].includes(activeAction.use_case),
  );
  const activeActionHasPreparedGuidedBypass = Boolean(
    activeActionWebSearch ||
    activeActionEmailDraft ||
    activeActionWhatsAppDraft ||
    activeActionBookingUrl ||
    (activeAction && !activeActionCoreGuidedUseCase && isPhoneCallPendingAction(activeAction)),
  );
  const activeActionCanUseGuidedFallback = Boolean(
    activeActionCoreGuidedUseCase &&
    !activeActionHasPreparedGuidedBypass,
  );
  const activeActionNeedsGuidedDetails = Boolean(
    activeActionNeedsUserConfirmation &&
    activeActionGuidedDetails &&
    !activeActionGuidedDetails.complete &&
    (
      (activeActionExecutionTask?.lifecycle_status === "needs_info" && !activeActionHasPreparedGuidedBypass) ||
      activeActionNeedsRecipientEmail ||
      (!activeActionExecutionTask && activeActionCanUseGuidedFallback)
    ),
  );
  const activeActionGuidedUsesFormCompatibleIds = !transportDetailsOpen && !otcPharmacyOpen;
  const activeActionUsesInlineGuidedPanel = activeAction?.use_case !== "order_medicine";
  const activeActionGuidedPanelOpen = Boolean(
    activeActionNeedsGuidedDetails &&
    activeActionUsesInlineGuidedPanel &&
    !transportDetailsOpen &&
    !otcPharmacyOpen,
  );
  const activeActionFormPlan = activeAction ? getFormAutomationPlan(activeAction) : null;
  const activeActionFormMissingFields = activeActionFormPlan?.missingFields ?? [];
  const activeActionCanOpenForm = Boolean(
    activeActionExecutionChannel === "booking_url" &&
    activeActionBookingUrl &&
    activeActionFormMissingFields.length === 0,
  );
  const activeActionHasBookingFormSupport = Boolean(
    activeActionExecutionChannel === "booking_url" &&
    activeActionBookingUrl,
  );
  const activeActionNeedsWhatsAppOutcome = Boolean(
    activeActionNeedsUserConfirmation &&
    activeActionWhatsAppDraft &&
    activeActionOpensWhatsApp &&
    !activeActionHasBookingFormSupport,
  );
  const activeActionNeedsEmailOutcome = Boolean(
    activeActionNeedsUserConfirmation &&
    activeActionEmailDraft &&
    activeActionOpensEmail &&
    !activeActionHasBookingFormSupport,
  );
  const activeActionIsVyvaTask = activeActionAlreadyConfirmed || activeActionExecutionChannel === "manual" || (
    activeActionExecutionChannel === "booking_url" &&
    !activeActionCanOpenForm
  );
  const activeActionOpensBooking = Boolean(
    activeActionBookingUrl &&
    !activeActionOpensWhatsApp &&
    !activeActionOpensEmail &&
    (activeActionCanOpenForm || (!activeAction?.provider_phone && activeActionExecutionChannel !== "booking_url"))
  );
  const activeActionNeedsPhoneOutcome = activeActionNeedsUserConfirmation && activeAction ? isPhoneCallPendingAction(activeAction) : false;
  const activeActionCanShowPhoneOutcome = activeActionNeedsPhoneOutcome && activeActionReviewConfirmed;
  const activeActionCanShowWhatsAppOutcome = activeActionNeedsWhatsAppOutcome && activeActionReviewConfirmed;
  const activeActionCanShowEmailOutcome = activeActionNeedsEmailOutcome && activeActionReviewConfirmed;
  const recentEmailDraftCompletionNotice = recentEmailDraftCompletion && (
    activeAction?.id !== recentEmailDraftCompletion.actionId ||
    !activeActionCanShowEmailOutcome
  )
    ? recentEmailDraftCompletion.notice
    : null;
  const activeActionChannelReadiness = activeActionExecutionTask?.channel_readiness ?? null;
  const activeActionLiveChannelAllowed = Boolean(
    (activeActionExecutionTask?.external_action_allowed || activeActionReviewConfirmed) &&
    (activeActionChannelReadiness?.channel ? activeActionChannelReadiness.external_action_allowed : true),
  );
  const activeActionExternalLinksAllowed = !activeActionNeedsUserConfirmation && !activeActionIsDryRun && activeActionLiveChannelAllowed;
  const activeActionChannelBlocked = Boolean(
    activeAction &&
    !activeActionIsDryRun &&
    activeActionChannelReadiness?.channel &&
    !activeActionChannelReadiness.external_action_allowed,
  );
  const activeActionCanShowManualReviewOutcome = Boolean(
    activeAction &&
    isManualReviewOutcomePendingAction(activeAction) &&
    !activeActionNeedsUserConfirmation,
  );
  const activeActionBookingFormIntakeDraft = activeActionHasBookingFormSupport && bookingFormNotice && input.trim()
    ? input.trim()
    : "";
  const activeActionIsAppointment = activeAction?.use_case === "book_appointment";
  const activeActionMissionStatus = activeActionIsAppointment && isAppointmentMissionStatus(activeAction?.action_payload?.mission_status)
    ? activeAction.action_payload.mission_status
    : null;
  const activeActionPresentationStatus = activeAction
    ? (
      payloadString(activeAction.action_payload, ["mission_status", "status"]) ||
      activeActionLiveHandoff?.state ||
      activeActionExecutionStatus?.phase ||
      activeAction.status
    )
    : "";
  const activeActionMissionPresentation = activeAction
    ? getTrustedHelpMissionPresentation(activeActionPresentationStatus)
    : null;
  const activeActionPreferredChannel = activeActionIsAppointment && typeof activeAction?.action_payload?.preferred_channel === "string"
    ? activeAction.action_payload.preferred_channel as AppointmentChannel
    : null;
  const activeActionLabelParams = activeAction && !activeActionProviderShortlist ? {
    item: activeAction,
    isSpanish,
    opensWhatsApp: activeActionOpensWhatsApp,
    opensEmail: activeActionOpensEmail,
    opensBooking: activeActionOpensBooking,
    needsPhoneOutcome: activeActionNeedsPhoneOutcome,
    needsWhatsAppOutcome: activeActionNeedsWhatsAppOutcome,
    needsEmailOutcome: activeActionNeedsEmailOutcome,
    canOpenForm: activeActionCanOpenForm,
    isVyvaTask: activeActionIsVyvaTask,
    formMissingFields: activeActionFormMissingFields,
  } : null;
  const activeActionPrimaryLabel = activeActionLabelParams ? rightNowPrimaryActionLabel(activeActionLabelParams) : "";
  const activeActionNextStepLabel = activeActionLabelParams ? rightNowNextStepLabel(activeActionLabelParams) : "";
  const activeActionNextStepHelper = activeActionLabelParams ? rightNowNextStepHelper(activeActionLabelParams) : "";
  const activeActionReviewSummary = activeAction && activeActionLabelParams
    ? buildPendingActionReviewSummary({
      item: activeAction,
      isSpanish,
      nextStepLabel: activeActionNextStepLabel,
      nextStepHelper: activeActionNextStepHelper,
    })
    : null;
  const activeActionShowVyvaPrepared = activeAction ? isShowVyvaPreparedTask(activeAction.action_payload) : false;
  const activeActionShowVyvaSource = activeActionShowVyvaPrepared
    ? showVyvaResumeSourceLabel(activeAction?.action_payload, locale)
    : "";
  const activeActionShowVyvaTask = activeActionShowVyvaPrepared
    ? showVyvaResumeActionLabel(activeAction?.action_payload, locale)
    : "";
  const activeActionShowVyvaSummary = activeActionShowVyvaPrepared
    ? showVyvaResumeSummary(activeAction?.action_payload, activeAction?.action_summary)
    : "";
  const activeActionShowVyvaGuide = activeActionShowVyvaPrepared
    ? showVyvaExecutionGuide(activeAction?.action_payload, locale)
    : null;
  const externalConfirmationReview = externalConfirmationRequest
    ? buildPendingActionReviewSummary({
      item: externalConfirmationRequest.item,
      isSpanish,
      nextStepLabel: externalConfirmationRequest.label,
      nextStepHelper: isSpanish
        ? "Nada se envia, llama ni abre hasta que confirmes."
        : "Nothing is sent, called, or opened until you confirm.",
    })
    : null;
  const activeActionChecklist = activeAction && activeActionLabelParams
    ? buildActiveTaskChecklist({
      ...activeActionLabelParams,
      nextStepLabel: activeActionNextStepLabel,
      timeline: activeActionTimeline,
    })
    : null;
  const activeActionPrimaryIcon: LucideIcon = activeActionOpensWhatsApp
    ? Send
    : activeActionOpensEmail
      ? Mail
      : activeActionOpensBooking
        ? ExternalLink
        : activeActionIsVyvaTask
          ? Sparkles
      : PhoneCall;
  const appointmentCanvasOptions = useMemo<ConciergeAppointmentCanvasOption[]>(() => (
    appointmentOptions.map((option) => ({
      id: option.id,
      label: appointmentOptionName(option, isSpanish),
      description: option.match_reason || undefined,
      availability: appointmentOptionAvailability(option) || undefined,
      providerSource: option.provider_source,
    }))
  ), [appointmentOptions, isSpanish]);
  const appointmentCanvasSelectedOption = appointmentCanvasOptions.find((option) => option.id === selectedAppointmentOptionId)
    ?? appointmentCanvasOptions[0]
    ?? null;
  const appointmentCanvasChannelLabel = selectedAppointmentActionChannel
    ? String(t(`voiceCanvas.appointment.channels.${selectedAppointmentActionChannel}`, {
        defaultValue: appointmentChannelLabel(selectedAppointmentActionChannel, isSpanish),
      }))
    : "";
  const savedAppointmentCoverageLabel = useMemo(() => {
    const detail = [savedCoverage?.provider, savedCoverage?.plan].map((value) => value?.trim()).filter(Boolean).join(" · ");
    if (detail) return detail;
    switch (savedCoverage?.coverageType) {
      case "private": return appointmentCanvasCopy.privateCoverage;
      case "self_pay": return appointmentCanvasCopy.selfPay;
      case "mixed": return `${appointmentCanvasCopy.publicCoverage} + ${appointmentCanvasCopy.privateCoverage}`;
      default: return appointmentCanvasCopy.publicCoverage;
    }
  }, [appointmentCanvasCopy, savedCoverage?.coverageType, savedCoverage?.plan, savedCoverage?.provider]);
  const appointmentCanvasViewModel = useMemo(() => {
    if (!appointmentCanvasMode || !appointmentCanvasStep) return null;
    return buildConciergeAppointmentCanvasViewModel({
      step: appointmentCanvasStep,
      copy: appointmentCanvasCopy,
      reason: appointmentNote,
      requestedTime: appointmentCanvasRequestedTime,
      coverageLabel: appointmentCanvasCoverageLabel,
      hasSavedCoverage: hasAppointmentCoverageInfo,
      savedProviderName: savedMedicalProvider,
      options: appointmentCanvasOptions,
      selectedOption: appointmentCanvasSelectedOption,
      contactChannelLabel: appointmentCanvasChannelLabel,
      error: appointmentError,
    });
  }, [
    appointmentCanvasChannelLabel,
    appointmentCanvasCopy,
    appointmentCanvasCoverageLabel,
    appointmentCanvasMode,
    appointmentCanvasOptions,
    appointmentCanvasRequestedTime,
    appointmentCanvasSelectedOption,
    appointmentCanvasStep,
    appointmentError,
    appointmentNote,
    hasAppointmentCoverageInfo,
    savedMedicalProvider,
  ]);

  const requestAppointmentCanvasOptions = useCallback((preferSavedProvider: boolean) => {
    if (!appointmentNote.trim() || !appointmentCanvasRequestedTime.trim()) {
      setAppointmentError(String(t("voiceCanvas.appointment.missingDetails", { defaultValue: "Add the reason and preferred time first." })));
      advanceAppointmentCanvas("error");
      return;
    }
    setAppointmentError(null);
    advanceAppointmentCanvas("searching");
    createAppointmentMutation.mutate({
      appointmentType: "medical",
      detail: appointmentNote.trim(),
      preferences: {
        date_preference: appointmentCanvasRequestedTime.trim(),
        coverage_type: coverageType,
        coverage_provider: coverageProvider.trim() || undefined,
        coverage_plan: coveragePlan.trim() || undefined,
        use_saved_provider: preferSavedProvider,
        provider_preference: preferSavedProvider ? savedMedicalProvider : undefined,
        no_external_action_without_confirmation: true,
      },
      flowReference: MEDICAL_APPOINTMENT_FLOW_REFERENCE,
      routePrefillSource: "voice_action",
      locale,
    }, {
      onSuccess: (result) => {
        if (result.options.length > 0) {
          advanceAppointmentCanvas("options");
          return;
        }
        discoverAppointmentOptionsMutation.mutate({ requestId: result.request.id }, {
          onSuccess: (discoveryResult) => advanceAppointmentCanvas(discoveryResult.options.length > 0 ? "options" : "error"),
          onError: () => advanceAppointmentCanvas("error"),
        });
      },
      onError: () => advanceAppointmentCanvas("error"),
    });
  }, [
    advanceAppointmentCanvas,
    appointmentCanvasRequestedTime,
    appointmentNote,
    coveragePlan,
    coverageProvider,
    coverageType,
    createAppointmentMutation,
    discoverAppointmentOptionsMutation,
    locale,
    savedMedicalProvider,
    t,
  ]);

  useEffect(() => {
    if (!appointmentCanvasMode || appointmentCanvasStep !== "provider" || !hasSavedMedicalProvider) return;
    requestAppointmentCanvasOptions(true);
  }, [
    appointmentCanvasMode,
    appointmentCanvasStep,
    hasSavedMedicalProvider,
    requestAppointmentCanvasOptions,
  ]);

  const activeAppointmentCanvasSceneRef = useVoiceCanvasController({
    owner: "concierge_appointment",
    enabled: appointmentCanvasMode,
    revision: appointmentCanvasRevision,
    actionId: conciergeVoiceAction?.id,
    flowReference: MEDICAL_APPOINTMENT_FLOW_REFERENCE,
    viewModel: appointmentCanvasViewModel,
  });

  useEffect(() => {
    const handleAppointmentCanvasResponse = (event: Event) => {
      const response = event instanceof CustomEvent
        ? (event.detail as VoiceCanvasResponseDetail | undefined)
        : undefined;
      const scene = activeAppointmentCanvasSceneRef.current;
      if (!response || !scene || scene.owner !== "concierge_appointment" || !voiceCanvasResponseMatchesScene(response, scene)) return;

      const answer = (response.value || response.utterance).trim();
      const affirmative = /^(yes|yes please|confirm|continue|go ahead|si|sí|confirmar|continúa|adelante|ja|bestätigen|weiter|oui|confirmer|continuer|sì|conferma|sim|continuar)$/i.test(answer.toLocaleLowerCase());

      if (response.kind === "secondary") {
        if (appointmentCanvasStep === "time_custom") advanceAppointmentCanvas("time");
        else if (appointmentCanvasStep === "time") advanceAppointmentCanvas("reason");
        else if (appointmentCanvasStep === "coverage") advanceAppointmentCanvas("time");
        else if (appointmentCanvasStep === "provider") advanceAppointmentCanvas("coverage");
        else if (appointmentCanvasStep === "options") advanceAppointmentCanvas("provider");
        else if (appointmentCanvasStep === "review") advanceAppointmentCanvas("options");
        else if (appointmentCanvasStep === "error") advanceAppointmentCanvas(appointmentCanvasSelectedOption ? "review" : "provider");
        return;
      }

      if (appointmentCanvasStep === "reason") {
        const reason = response.kind === "primary" ? appointmentNote.trim() : answer;
        if (!reason) return;
        setAppointmentNote(reason);
        advanceAppointmentCanvas("time");
        return;
      }
      if (appointmentCanvasStep === "time") {
        if (response.choiceId === "another_time") {
          advanceAppointmentCanvas("time_custom");
          return;
        }
        const timeByChoice: Record<string, string> = {
          today: appointmentCanvasCopy.today,
          tomorrow: appointmentCanvasCopy.tomorrow,
          this_week: appointmentCanvasCopy.thisWeek,
          next_week: appointmentCanvasCopy.nextWeek,
        };
        const requestedTime = response.choiceId ? timeByChoice[response.choiceId] : answer;
        if (!requestedTime) return;
        setAppointmentCanvasRequestedTime(requestedTime);
        advanceAppointmentCanvas("coverage");
        return;
      }
      if (appointmentCanvasStep === "time_custom") {
        if (!answer || response.kind === "primary") return;
        setAppointmentCanvasRequestedTime(answer);
        advanceAppointmentCanvas("coverage");
        return;
      }
      if (appointmentCanvasStep === "coverage") {
        const labels: Record<string, string> = {
          saved: savedAppointmentCoverageLabel,
          public: appointmentCanvasCopy.publicCoverage,
          private: appointmentCanvasCopy.privateCoverage,
          self_pay: appointmentCanvasCopy.selfPay,
          unknown: appointmentCanvasCopy.coverageUnsure,
        };
        const choice = response.choiceId || "";
        const nextLabel = labels[choice] || answer;
        if (!nextLabel) return;
        setAppointmentCanvasCoverageLabel(nextLabel);
        if (choice === "public" || choice === "private" || choice === "self_pay" || choice === "unknown") {
          setCoverageType(choice);
        }
        advanceAppointmentCanvas("provider");
        return;
      }
      if (appointmentCanvasStep === "provider") {
        if (response.choiceId === "add_provider") {
          openMedicalProviderSetup();
          return;
        }
        if (response.choiceId === "saved_provider") {
          requestAppointmentCanvasOptions(true);
          return;
        }
        if (response.choiceId === "find_provider") {
          requestAppointmentCanvasOptions(false);
        }
        return;
      }
      if (appointmentCanvasStep === "options") {
        if (!response.choiceId || !appointmentOptions.some((option) => option.id === response.choiceId)) return;
        setSelectedAppointmentOptionId(response.choiceId);
        advanceAppointmentCanvas("review");
        return;
      }
      if (appointmentCanvasStep === "review") {
        if ((response.kind !== "primary" && !affirmative) || !appointmentRequest || !selectedAppointmentOption || !selectedAppointmentActionChannel) return;
        advanceAppointmentCanvas("contacting");
        confirmAppointmentMutation.mutate({
          requestId: appointmentRequest.id,
          optionId: selectedAppointmentOption.id,
          channel: selectedAppointmentActionChannel,
        }, {
          onSuccess: () => advanceAppointmentCanvas("completed"),
          onError: () => advanceAppointmentCanvas("error"),
        });
        return;
      }
      if (appointmentCanvasStep === "error" && (response.kind === "primary" || affirmative)) {
        setAppointmentError(null);
        advanceAppointmentCanvas(appointmentCanvasSelectedOption ? "review" : "provider");
      }
    };

    window.addEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, handleAppointmentCanvasResponse);
    return () => window.removeEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, handleAppointmentCanvasResponse);
  }, [
    activeAppointmentCanvasSceneRef,
    advanceAppointmentCanvas,
    appointmentCanvasCopy,
    appointmentCanvasSelectedOption,
    appointmentCanvasStep,
    appointmentNote,
    appointmentOptions,
    appointmentRequest,
    confirmAppointmentMutation,
    openMedicalProviderSetup,
    requestAppointmentCanvasOptions,
    savedAppointmentCoverageLabel,
    selectedAppointmentActionChannel,
    selectedAppointmentOption,
  ]);

  const homeServiceCanvasCopyValue = useMemo(() => homeServiceCanvasCopy(locale), [locale]);
  const homeServiceCanvasOptions = useMemo<ConciergeHomeServiceCanvasOption[]>(() => (
    appointmentOptions.map((option) => ({
      id: option.id,
      label: appointmentOptionName(option, isSpanish),
      description: homeServiceCanvasOptionDescription(option, isSpanish),
    }))
  ), [appointmentOptions, isSpanish]);
  const homeServiceCanvasSelectedOption = homeServiceCanvasOptions.find((option) => option.id === selectedAppointmentOptionId)
    ?? homeServiceCanvasOptions[0]
    ?? null;
  const homeServiceCanvasChannelLabel = selectedAppointmentActionChannel
    ? appointmentChannelLabel(selectedAppointmentActionChannel, isSpanish)
    : "";
  const homeServiceCanvasViewModel = useMemo(() => {
    if (!homeServiceCanvasMode || !homeServiceCanvasStep) return null;
    return buildConciergeHomeServiceCanvasViewModel({
      step: homeServiceCanvasStep,
      copy: homeServiceCanvasCopyValue,
      serviceType: homeServiceType,
      description: homeServiceIntakeAnswers.problem_summary?.trim() || "",
      photoName: homeServiceCanvasPhotoName,
      photoAvailable: Boolean(homeServiceCanvasPhoto),
      safetyAnswer: homeServiceIntakeAnswers.safety_check,
      urgency: homeServiceIntakeAnswers.urgency?.trim() || "",
      requestedTime: homeServiceIntakeAnswers.requested_time?.trim() || "",
      accessNotes: homeServiceIntakeAnswers.access_notes === "__none__"
        ? ""
        : homeServiceIntakeAnswers.access_notes?.trim() || "",
      location: homeServiceVisitAddress,
      hasSavedLocation: Boolean(savedHomeAddress),
      savedProviderName: savedHomeServiceProvider,
      options: homeServiceCanvasOptions,
      selectedOption: homeServiceCanvasSelectedOption,
      contactChannelLabel: homeServiceCanvasChannelLabel,
      photoWillBeSent: selectedAppointmentActionChannel === "email" && Boolean(homeServiceCanvasPhoto),
      error: homeServiceCanvasError || appointmentError,
    });
  }, [
    appointmentError,
    homeServiceCanvasChannelLabel,
    homeServiceCanvasCopyValue,
    homeServiceCanvasError,
    homeServiceCanvasMode,
    homeServiceCanvasOptions,
    homeServiceCanvasPhoto,
    homeServiceCanvasPhotoName,
    homeServiceCanvasSelectedOption,
    homeServiceCanvasStep,
    homeServiceIntakeAnswers,
    homeServiceType,
    homeServiceVisitAddress,
    savedHomeAddress,
    savedHomeServiceProvider,
    selectedAppointmentActionChannel,
  ]);
  const activeHomeServiceCanvasSceneRef = useVoiceCanvasController({
    owner: "concierge_home_service",
    enabled: homeServiceCanvasMode,
    revision: homeServiceCanvasRevision,
    actionId: conciergeVoiceAction?.id,
    flowReference: CONCIERGE_FLOW_REFERENCES.homeService,
    pendingId: appointmentAttemptResult?.pending?.pendingId || appointmentAttemptResult?.form_task?.pending_id || undefined,
    viewModel: homeServiceCanvasViewModel,
  });

  const finalizeHomeServiceCanvasProvider = useCallback((mode: "saved" | "compare") => {
    setHomeServiceCanvasError(null);
    advanceHomeServiceCanvas("searching");
    saveHomeServiceDraft({ finalize: true }, {
      onSuccess: async (result) => {
        try {
          let nextResult = result;
          if (mode === "compare") {
            nextResult = await discoverAppointmentOptions({ requestId: result.request.id });
            setAppointmentRequest(nextResult.request);
            setAppointmentOptions(nextResult.options);
            setAppointmentDiscovery(nextResult.discovery ?? null);
          }
          const nextOption = mode === "saved"
            ? nextResult.options.find((option) => option.provider_source === "saved") ?? nextResult.options[0]
            : nextResult.options[0];
          if (!nextOption) {
            setHomeServiceCanvasError(isSpanish
              ? "No encontré una opción clara. Puedes añadir un proveedor de confianza o volver a intentarlo."
              : "I could not find a clear option. Add a trusted provider or try again.");
            advanceHomeServiceCanvas("error");
            return;
          }
          setSelectedAppointmentOptionId(nextOption.id);
          advanceHomeServiceCanvas(mode === "saved" ? "review" : "options");
        } catch (error) {
          setHomeServiceCanvasError(error instanceof Error ? error.message : (isSpanish ? "No pude buscar proveedores." : "I could not check providers."));
          advanceHomeServiceCanvas("error");
        }
      },
      onError: () => advanceHomeServiceCanvas("error"),
    });
  }, [advanceHomeServiceCanvas, isSpanish, saveHomeServiceDraft]);

  useEffect(() => {
    if (!homeServiceCanvasMode || homeServiceCanvasStep !== "provider" || !hasSavedHomeServiceProvider) return;
    finalizeHomeServiceCanvasProvider("saved");
  }, [
    finalizeHomeServiceCanvasProvider,
    hasSavedHomeServiceProvider,
    homeServiceCanvasMode,
    homeServiceCanvasStep,
  ]);

  useEffect(() => {
    const handleHomeServiceCanvasResponse = async (event: Event) => {
      const response = event instanceof CustomEvent
        ? (event.detail as VoiceCanvasResponseDetail | undefined)
        : undefined;
      const scene = activeHomeServiceCanvasSceneRef.current;
      if (!response || !scene || scene.owner !== "concierge_home_service" || !voiceCanvasResponseMatchesScene(response, scene)) return;

      const answer = (response.value || response.utterance).trim();
      const affirmative = /^(yes|yes please|confirm|continue|go ahead|si|sí|confirmar|continúa|adelante|ja|bestätigen|weiter|oui|confirmer|continuer|sì|conferma|sim|continuar)$/i.test(answer.toLocaleLowerCase());

      if (response.kind === "file") {
        if (!response.file) {
          setHomeServiceCanvasPhoto(null);
          setHomeServiceCanvasPhotoName("");
          setHomeServiceCanvasError(null);
          return;
        }
        if (!/^image\/(jpeg|png|webp)$/i.test(response.file.type)) {
          setHomeServiceCanvasError(isSpanish ? "Elige una foto JPG, PNG o WebP." : "Choose a JPG, PNG, or WebP photo.");
          return;
        }
        try {
          const dataUrl = await compressBillImage(response.file, 1_800_000);
          const normalizedName = response.file.name.replace(/\.[^.]+$/, "") || "home-service-photo";
          setHomeServiceCanvasPhoto({ name: `${normalizedName}.jpg`, type: "image/jpeg", dataUrl });
          setHomeServiceCanvasPhotoName(response.file.name);
          setHomeServiceCanvasError(null);
        } catch {
          setHomeServiceCanvasError(isSpanish ? "No pude preparar esa foto. Prueba con otra." : "I could not prepare that photo. Try another one.");
        }
        return;
      }

      if (response.kind === "secondary") {
        if (homeServiceCanvasStep === "description") advanceHomeServiceCanvas("service");
        else if (homeServiceCanvasStep === "danger") advanceHomeServiceCanvas("description");
        else if (homeServiceCanvasStep === "emergency") {
          setHomeServiceAnswer("immediate_danger", "no");
          advanceHomeServiceCanvas("safety");
        } else if (homeServiceCanvasStep === "safety") advanceHomeServiceCanvas("danger");
        else if (homeServiceCanvasStep === "urgency") advanceHomeServiceCanvas("safety");
        else if (homeServiceCanvasStep === "time") advanceHomeServiceCanvas("urgency");
        else if (homeServiceCanvasStep === "access") {
          setHomeServiceAnswer("access_notes", "__none__");
          advanceHomeServiceCanvas("location");
        } else if (homeServiceCanvasStep === "location") advanceHomeServiceCanvas("access");
        else if (homeServiceCanvasStep === "location_custom") advanceHomeServiceCanvas("location");
        else if (homeServiceCanvasStep === "provider") advanceHomeServiceCanvas("location");
        else if (homeServiceCanvasStep === "options") advanceHomeServiceCanvas("provider");
        else if (homeServiceCanvasStep === "review") advanceHomeServiceCanvas("provider");
        else if (homeServiceCanvasStep === "error") advanceHomeServiceCanvas(homeServiceCanvasSelectedOption ? "review" : "provider");
        return;
      }

      if (homeServiceCanvasStep === "service") {
        const nextType = normalizeHomeServiceType(response.choiceId || answer);
        if (!nextType) return;
        setHomeServiceType(nextType);
        advanceHomeServiceCanvas("description");
        return;
      }
      if (homeServiceCanvasStep === "description") {
        const description = response.kind === "primary"
          ? homeServiceIntakeAnswers.problem_summary?.trim() || ""
          : answer;
        if (!description) return;
        setHomeServiceAnswer("problem_summary", description);
        setAppointmentNote(description);
        advanceHomeServiceCanvas("danger");
        return;
      }
      if (homeServiceCanvasStep === "danger") {
        const danger = response.choiceId || answer;
        if (!danger) return;
        setHomeServiceAnswer("immediate_danger", danger);
        advanceHomeServiceCanvas(danger === "no" ? "safety" : "emergency");
        return;
      }
      if (homeServiceCanvasStep === "emergency") {
        if (response.kind === "primary" || affirmative) {
          const emergencyHref = homeServiceLocalEmergency.telHref || "tel:112";
          window.location.assign(emergencyHref);
        }
        return;
      }
      if (homeServiceCanvasStep === "safety") {
        const safety = response.choiceId || answer;
        if (!safety) return;
        setHomeServiceAnswer("safety_check", safety);
        if (safety === "yes") {
          if (homeServiceType === "plumber") setHomeServiceAnswer("active_flooding", "yes");
          else if (homeServiceType === "electrician") setHomeServiceAnswer("problem_type", "sparks_smell");
          else if (homeServiceType === "locksmith") setHomeServiceAnswer("lockout_hazard", "yes");
          else setHomeServiceAnswer("environment_hazard", "yes");
        }
        advanceHomeServiceCanvas(safety === "no" ? "urgency" : "emergency");
        return;
      }
      if (homeServiceCanvasStep === "urgency") {
        const urgency = response.choiceId || answer;
        if (!urgency) return;
        setHomeServiceAnswer("urgency", urgency);
        advanceHomeServiceCanvas("time");
        return;
      }
      if (homeServiceCanvasStep === "time") {
        if (!answer) return;
        setHomeServiceAnswer("requested_time", answer);
        advanceHomeServiceCanvas("access");
        return;
      }
      if (homeServiceCanvasStep === "access") {
        setHomeServiceAnswer("access_notes", response.kind === "primary" ? (homeServiceIntakeAnswers.access_notes?.trim() || "__none__") : (answer || "__none__"));
        advanceHomeServiceCanvas("location");
        return;
      }
      if (homeServiceCanvasStep === "location") {
        if (response.choiceId === "saved_home" && savedHomeAddress) {
          setHomeServiceAnswer("home_address", savedHomeAddress);
          advanceHomeServiceCanvas("provider");
        } else if (response.choiceId === "another_address") {
          advanceHomeServiceCanvas("location_custom");
        }
        return;
      }
      if (homeServiceCanvasStep === "location_custom") {
        if (!answer) return;
        setHomeServiceAnswer("home_address", answer);
        setHomeServiceAnswer("location", answer);
        advanceHomeServiceCanvas("provider");
        return;
      }
      if (homeServiceCanvasStep === "provider") {
        if (response.choiceId === "add_provider") openHomeServiceProviderSetup();
        else if (response.choiceId === "saved_provider") finalizeHomeServiceCanvasProvider("saved");
        else if (response.choiceId === "compare_providers") finalizeHomeServiceCanvasProvider("compare");
        return;
      }
      if (homeServiceCanvasStep === "options") {
        if (!response.choiceId || !appointmentOptions.some((option) => option.id === response.choiceId)) return;
        setSelectedAppointmentOptionId(response.choiceId);
        advanceHomeServiceCanvas("review");
        return;
      }
      if (homeServiceCanvasStep === "review") {
        if ((response.kind !== "primary" && !affirmative) || !appointmentRequest || !selectedAppointmentOption || !selectedAppointmentActionChannel) return;
        const actionRequestId = homeServiceCanvasRevision + 1;
        homeServiceActionGate.authorize(actionRequestId, homeServiceCanvasRevision);
        const controller = homeServiceActionGate.begin(actionRequestId, homeServiceCanvasRevision);
        if (!controller) return;
        advanceHomeServiceCanvas("waiting");
        confirmAppointmentMutation.mutate({
          requestId: appointmentRequest.id,
          optionId: selectedAppointmentOption.id,
          channel: selectedAppointmentActionChannel,
          shareDetails: {
            share_home_address: Boolean(homeServiceVisitAddress.trim()),
            photo: selectedAppointmentActionChannel === "email" && homeServiceCanvasPhoto
              ? { name: homeServiceCanvasPhoto.name, type: homeServiceCanvasPhoto.type, data_url: homeServiceCanvasPhoto.dataUrl }
              : undefined,
          },
        }, {
          onSuccess: () => {
            if (homeServiceActionGate.isCurrent(actionRequestId, controller)) advanceHomeServiceCanvas("completed");
          },
          onError: () => {
            if (homeServiceActionGate.isCurrent(actionRequestId, controller)) advanceHomeServiceCanvas("error");
          },
        });
        return;
      }
      if (homeServiceCanvasStep === "error" && (response.kind === "primary" || affirmative)) {
        setHomeServiceCanvasError(null);
        advanceHomeServiceCanvas(homeServiceCanvasSelectedOption ? "review" : "provider");
      }
    };

    window.addEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, handleHomeServiceCanvasResponse);
    return () => window.removeEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, handleHomeServiceCanvasResponse);
  }, [
    activeHomeServiceCanvasSceneRef,
    advanceHomeServiceCanvas,
    appointmentOptions,
    appointmentRequest,
    confirmAppointmentMutation,
    finalizeHomeServiceCanvasProvider,
    homeServiceCanvasSelectedOption,
    homeServiceCanvasPhoto,
    homeServiceCanvasStep,
    homeServiceCanvasRevision,
    homeServiceActionGate,
    homeServiceIntakeAnswers.access_notes,
    homeServiceIntakeAnswers.problem_summary,
    homeServiceLocalEmergency.telHref,
    homeServiceType,
    homeServiceVisitAddress,
    isSpanish,
    openHomeServiceProviderSetup,
    savedHomeAddress,
    selectedAppointmentActionChannel,
    selectedAppointmentOption,
  ]);

  const rideCanvasOptions = useMemo<ConciergeRideCanvasOption[]>(() => (
    (transportResult?.options ?? []).map((option) => ({
      id: option.id,
      label: option.label,
      description: option.description,
      providerName: option.providerName,
    }))
  ), [transportResult?.options]);
  const rideCanvasSelectedTransportOption = transportResult?.options.find((option) => option.id === rideCanvasSelectedOptionId) ?? null;
  const rideCanvasSelectedOption = rideCanvasOptions.find((option) => option.id === rideCanvasSelectedOptionId) ?? null;
  const rideCanvasPendingId = transportPreparedResult?.pendingId?.trim() || "";
  const rideCanvasPendingAction = rideCanvasPendingId
    ? pendingActions.find((item) => item.id === rideCanvasPendingId) ?? null
    : null;
  const rideCanvasPendingDetails = rideCanvasPendingAction
    ? buildConciergeGuidedDetailCapture({
        useCase: rideCanvasPendingAction.use_case,
        payload: rideCanvasPendingAction.action_payload,
        providerName: rideCanvasPendingAction.provider_name,
        providerPhone: rideCanvasPendingAction.provider_phone,
        locale,
      })
    : null;
  const rideCanvasCompletedSession = rideCanvasPendingId
    ? completedSessions.find((session) => session.pending_id === rideCanvasPendingId) ?? null
    : null;
  const rideCanvasViewModel = useMemo(() => {
    if (!rideCanvasMode || !rideCanvasStep) return null;
    const question = rideCanvasPendingDetails?.nextQuestion ?? null;
    return buildConciergeRideCanvasViewModel({
      step: rideCanvasStep,
      copy: rideCanvasCopy,
      destination: transportDestination,
      pickup: transportPickup,
      requestedTime: transportTime,
      mobilityNeeds: transportMobilityNeeds,
      savedPickupLabel: savedTransportPickupLabel,
      savedProviderName: savedTransportProvider,
      options: rideCanvasOptions,
      selectedOption: rideCanvasSelectedOption,
      pendingProviderName: rideCanvasPendingAction?.provider_name ?? transportPreparedOption?.providerName,
      pendingDetail: question ? {
        label: question.label,
        prompt: question.prompt,
        placeholder: question.placeholder,
      } : null,
      error: transportError,
    });
  }, [
    rideCanvasCopy,
    rideCanvasMode,
    rideCanvasOptions,
    rideCanvasPendingAction?.provider_name,
    rideCanvasPendingDetails?.nextQuestion,
    rideCanvasSelectedOption,
    rideCanvasStep,
    savedTransportPickupLabel,
    savedTransportProvider,
    transportDestination,
    transportError,
    transportMobilityNeeds,
    transportPickup,
    transportPreparedOption?.providerName,
    transportTime,
  ]);

  const activeRideCanvasSceneRef = useVoiceCanvasController({
    owner: "concierge_ride",
    enabled: rideCanvasMode,
    revision: rideCanvasRevision,
    actionId: conciergeVoiceAction?.id,
    flowReference: TRANSPORT_BOOKING_FLOW_REFERENCE,
    pendingId: rideCanvasPendingId || undefined,
    viewModel: rideCanvasViewModel,
  });

  useEffect(() => {
    if (!rideCanvasMode || !rideCanvasStep) return;
    if (transportError && rideCanvasStep !== "error") {
      advanceRideCanvas("error");
      return;
    }
    if (rideCanvasCompletedSession && rideCanvasStep !== "completed") {
      advanceRideCanvas("completed");
      return;
    }
    if (!rideCanvasPendingAction) return;
    if (rideCanvasPendingAction.status === "calling" || rideCanvasPendingAction.confirmed_at) {
      if (rideCanvasStep !== "waiting") advanceRideCanvas("waiting");
      return;
    }
    if (rideCanvasPendingAction.status !== "pending") return;
    const nextStep = rideCanvasPendingDetails?.nextQuestion ? "pending_detail" : "pending_confirm";
    if (rideCanvasStep !== nextStep) advanceRideCanvas(nextStep);
  }, [
    activeRideCanvasSceneRef,
    advanceRideCanvas,
    rideCanvasCompletedSession,
    rideCanvasMode,
    rideCanvasPendingAction,
    rideCanvasPendingDetails?.nextQuestion,
    rideCanvasStep,
    transportError,
  ]);

  useEffect(() => {
    if (rideCanvasMode && rideCanvasStep === "provider" && hasSavedTransportProvider) {
      advanceRideCanvas("review");
    }
  }, [advanceRideCanvas, hasSavedTransportProvider, rideCanvasMode, rideCanvasStep]);

  useEffect(() => {
    const handleRideCanvasResponse = (event: Event) => {
      const response = event instanceof CustomEvent
        ? (event.detail as VoiceCanvasResponseDetail | undefined)
        : undefined;
      const scene = activeRideCanvasSceneRef.current;
      if (!response || !scene || scene.owner !== "concierge_ride" || !voiceCanvasResponseMatchesScene(response, scene)) return;

      const answer = (response.value || response.utterance).trim();
      const normalizedAnswer = answer.toLocaleLowerCase();
      const affirmative = /^(yes|yes please|confirm|continue|go ahead|si|sí|confirmar|continua|continúa|adelante|ja|bestätigen|weiter|oui|confirmer|continuer|sì|si|conferma|continua|sim|confirmar|continuar)$/i.test(normalizedAnswer);
      const nextAfterTimeOrMobility = () => advanceRideCanvas(hasSavedTransportProvider ? "review" : "provider");

      if (response.kind === "secondary") {
        if (rideCanvasStep === "pickup_custom") advanceRideCanvas("pickup");
        else if (rideCanvasStep === "time_custom") advanceRideCanvas("time");
        else if (rideCanvasStep === "provider") advanceRideCanvas(shouldAskTransportMobility ? "mobility" : "time");
        else if (rideCanvasStep === "option_review") advanceRideCanvas("options");
        else if (rideCanvasStep === "pending_detail" || rideCanvasStep === "pending_confirm") advanceRideCanvas("review");
        else if (rideCanvasStep === "error") advanceRideCanvas("destination");
        else advanceRideCanvas("destination");
        return;
      }

      if (rideCanvasStep === "destination") {
        if (!answer || response.kind === "primary") return;
        setTransportDestination(answer);
        advanceRideCanvas("pickup");
        return;
      }
      if (rideCanvasStep === "pickup") {
        if (response.choiceId === "another_pickup") {
          advanceRideCanvas("pickup_custom");
          return;
        }
        if (response.choiceId === "saved_home") {
          setTransportPickup(savedTransportPickupLabel);
        } else if (answer) {
          setTransportPickup(answer);
        } else {
          return;
        }
        advanceRideCanvas("time");
        return;
      }
      if (rideCanvasStep === "pickup_custom") {
        if (!answer || response.kind === "primary") return;
        setTransportPickup(answer);
        advanceRideCanvas("time");
        return;
      }
      if (rideCanvasStep === "time") {
        if (response.choiceId === "another_time" || response.choiceId === "appointment_time") {
          advanceRideCanvas("time_custom");
          return;
        }
        const selectedTime = response.choiceId === "now"
          ? "now"
          : response.choiceId === "today"
            ? rideCanvasCopy.today
            : response.choiceId === "tomorrow_morning"
              ? rideCanvasCopy.tomorrowMorning
              : answer;
        if (!selectedTime) return;
        setTransportTime(selectedTime);
        if (shouldAskTransportMobility) advanceRideCanvas("mobility");
        else nextAfterTimeOrMobility();
        return;
      }
      if (rideCanvasStep === "time_custom") {
        if (!answer || response.kind === "primary") return;
        setTransportTime(answer);
        if (shouldAskTransportMobility) advanceRideCanvas("mobility");
        else nextAfterTimeOrMobility();
        return;
      }
      if (rideCanvasStep === "mobility") {
        const mobilityByChoice: Record<string, string[]> = {
          none: [],
          wheelchair: [rideCanvasCopy.wheelchair],
          door_help: [rideCanvasCopy.doorHelp],
          walker: [rideCanvasCopy.walkerOrCane],
          caregiver: [rideCanvasCopy.caregiverComing],
        };
        const nextMobilityNeeds = response.choiceId
          ? mobilityByChoice[response.choiceId]
          : answer
            ? [answer]
            : undefined;
        if (!nextMobilityNeeds) return;
        setTransportMobilityNeeds(nextMobilityNeeds);
        nextAfterTimeOrMobility();
        return;
      }
      if (rideCanvasStep === "provider") {
        if (response.kind === "primary" || affirmative) openTransportProviderSetup();
        return;
      }
      if (rideCanvasStep === "review") {
        if (response.kind !== "primary" && !affirmative) return;
        if (!hasSavedTransportProvider) {
          advanceRideCanvas("provider");
          return;
        }
        transportOptionsMutation.mutate(undefined, {
          onSuccess: () => advanceRideCanvas("options"),
          onError: () => advanceRideCanvas("error"),
        });
        return;
      }
      if (rideCanvasStep === "options") {
        if (!response.choiceId || !transportResult?.options.some((option) => option.id === response.choiceId)) return;
        setRideCanvasSelectedOptionId(response.choiceId);
        advanceRideCanvas("option_review");
        return;
      }
      if (rideCanvasStep === "option_review") {
        if ((response.kind !== "primary" && !affirmative) || !rideCanvasSelectedTransportOption) return;
        prepareTransportMutation.mutate(rideCanvasSelectedTransportOption, {
          onSuccess: (result) => {
            if (result.pendingId) setVisibleActionId(result.pendingId);
            setIsRightNowHidden(false);
            advanceRideCanvas("waiting");
          },
          onError: () => advanceRideCanvas("error"),
        });
        return;
      }
      if (rideCanvasStep === "pending_detail") {
        const question = rideCanvasPendingDetails?.nextQuestion;
        if (!rideCanvasPendingAction || !question || !answer || response.kind === "primary") return;
        guidedDetailMutation.mutate({ item: rideCanvasPendingAction, question, value: answer }, {
          onSuccess: () => advanceRideCanvas("waiting"),
          onError: () => advanceRideCanvas("error"),
        });
        return;
      }
      if (rideCanvasStep === "pending_confirm") {
        if (!rideCanvasPendingAction || (response.kind !== "primary" && !affirmative)) return;
        confirmMutation.mutate(rideCanvasPendingAction, {
          onSuccess: () => advanceRideCanvas("waiting"),
          onError: () => advanceRideCanvas("error"),
        });
        return;
      }
      if (rideCanvasStep === "error" && (response.kind === "primary" || affirmative)) {
        setTransportError(null);
        advanceRideCanvas("review");
      }
    };

    window.addEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, handleRideCanvasResponse);
    return () => window.removeEventListener(VYVA_VOICE_CANVAS_RESPONSE_EVENT, handleRideCanvasResponse);
  }, [
    activeRideCanvasSceneRef,
    advanceRideCanvas,
    confirmMutation,
    guidedDetailMutation,
    hasSavedTransportProvider,
    openTransportProviderSetup,
    prepareTransportMutation,
    rideCanvasCopy,
    rideCanvasPendingAction,
    rideCanvasPendingDetails?.nextQuestion,
    rideCanvasSelectedTransportOption,
    rideCanvasStep,
    savedTransportPickupLabel,
    shouldAskTransportMobility,
    transportOptionsMutation,
    transportResult?.options,
  ]);
  const routePrefillHighlights = routePrefill
    ? buildRoutePrefillHighlights(routePrefill.message, isSpanish)
    : [];
  const routePrefillReadiness = routePrefill?.kind === "task"
    ? routePrefillTaskReadiness(routePrefill)
    : null;
  const routePrefillMeta = routePrefill
    ? {
        Icon: routePrefill.kind === "ride"
          ? Car
          : routePrefill.kind === "appointment"
            ? Calendar
            : routePrefill.flowReference === SCAM_CHECK_FLOW_REFERENCE
              ? ShieldCheck
              : routePrefill.flowReference === INSURANCE_ADMIN_FLOW_REFERENCE
                ? FileText
                : PencilLine,
        title: routePrefill.kind === "ride"
          ? (isSpanish ? "Opciones de transporte" : "Transport options")
          : routePrefill.kind === "appointment"
            ? (isSpanish ? "Solicitud de cita preparada" : "Appointment request ready")
            : routePrefill.kind === "home_care_quote"
              ? (isSpanish ? "Presupuesto de apoyo preparado" : "Support quote ready")
              : routePrefillTaskTitle(routePrefill, isSpanish),
        detail: routePrefill.kind === "ride"
          ? (isSpanish ? "Compara formas seguras. Confirmas primero." : "Compare safe ways. You confirm first.")
          : routePrefill.kind === "appointment"
            ? (isSpanish ? "VYVA prepara el motivo, proveedor y horario antes de confirmar." : "VYVA prepares the reason, provider, and timing before confirming.")
            : routePrefill.kind === "home_care_quote"
              ? (isSpanish ? "VYVA puede solicitar una ayuda en casa o compania con confirmacion previa." : "VYVA can request home support or companionship with confirmation first.")
              : routePrefillTaskDetail(routePrefill, isSpanish),
        primaryLabel: routePrefill.kind === "ride"
          ? (isSpanish ? "Buscar transporte" : "Find ride options")
          : routePrefill.kind === "appointment"
            ? (isSpanish ? "Iniciar solicitud" : "Start appointment request")
            : routePrefill.kind === "home_care_quote"
              ? (isSpanish ? "Pedir presupuesto" : "Request quote")
              : routePrefill.payload?.task_type === "provider_contact_preparation" && routePrefill.actionLabel?.trim()
                ? routePrefill.actionLabel.trim()
              : (isSpanish ? "Anadir a Ahora mismo" : "Add to Right now"),
        secondaryLabel: routePrefill.kind === "appointment"
          ? (isSpanish ? "Anadir detalles" : "Add details")
          : (isSpanish ? "Editar solicitud" : "Edit request"),
      }
    : null;
  const routePrefillSafetyCopy = routePrefill?.kind === "task"
    && routePrefill.payload?.task_type === "provider_contact_preparation"
    ? (isSpanish
        ? "Nada se envia, llama ni abre hasta que confirmes."
        : "Nothing is sent, called, or opened until you confirm.")
    : (isSpanish
        ? "Nada se reserva ni solicita sin tu confirmacion."
        : "Nothing is booked or requested without your confirmation.");
  const isVoiceRideHandoff = routePrefill?.kind === "ride" && routePrefill.source === "voice_action";
  const rideCanvasRolloutQuery = useQuery({
    queryKey: ["/api/config/features/ride-voice-canvas"],
    queryFn: async () => {
      const response = await apiFetch("/api/config/features/ride-voice-canvas");
      if (!response.ok) return { enabled: false, rolloutPercent: 0 };
      return parseRideCanvasRolloutConfig(await response.json());
    },
    enabled: isVoiceRideHandoff && !rideCanvasMode,
    staleTime: 0,
    refetchInterval: 10_000,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  const usesLegacyRideVoiceCanvas = !rideCanvasMode && isVoiceRideHandoff && isRideCanvasEnabled(
    rideCanvasRolloutQuery.data,
    conciergeVoiceAction?.id ?? "anonymous",
  );
  const legacyRideCanvasCopy = useMemo<RideCanvasCopy>(() => ({
    agentPresence: {
      idleLabel: isSpanish ? "VYVA lista" : "VYVA is ready",
      idleDescription: isSpanish ? "Puedes hablar o tocar la pantalla." : "You can speak or use the screen.",
      listeningLabel: isSpanish ? "Escuchando contigo" : "Listening with you",
      listeningDescription: isSpanish ? "Puedes decir el destino o tocar una opción." : "You can say the destination or tap an option.",
      speakingLabel: isSpanish ? "VYVA está hablando" : "VYVA is speaking",
      speakingDescription: isSpanish ? "La pantalla seguirá el mismo paso." : "The screen will stay on the same step.",
      thinkingLabel: isSpanish ? "Preparando opciones" : "Thinking through ride options",
      thinkingDescription: isSpanish ? "Revisando los detalles del viaje." : "Checking the ride details.",
      accessibleLabel: isSpanish ? "Estado de voz de VYVA para el viaje" : "VYVA voice status for the ride",
      spokenChoiceMessage: (label) => isSpanish ? `VYVA escuchó ${label}` : `VYVA heard ${label}`,
    },
    listening: {
      status: isSpanish ? "Escuchando" : "Listening",
      title: isSpanish ? "¿Adonde te ayudo a ir?" : "Where can I help you go?",
      helper: isSpanish ? "Habla o usa el boton para continuar." : "Use your voice or choose the button below.",
      start: isSpanish ? "Preparar un viaje" : "Arrange a ride",
      cancel: isSpanish ? "Ahora no" : "Not now",
    },
    place: {
      title: isSpanish ? "¿Adonde quieres ir?" : "Where would you like to go?",
      helper: isSpanish ? "Elige un lugar guardado o escribe uno nuevo." : "Choose a saved place or enter somewhere new.",
      newAddress: isSpanish ? "Una direccion nueva" : "A new address",
      newAddressHelper: isSpanish ? "Dile a VYVA adonde vas" : "Tell VYVA where you are going",
      continue: isSpanish ? "Continuar" : "Continue",
      back: isSpanish ? "Volver" : "Go back",
    },
    provider: {
      title: isSpanish ? "¿Que opcion de viaje prefieres?" : "Which ride option looks best?",
      helper: isSpanish ? "Compara estimacion, reputacion y ayuda disponible antes de elegir." : "Compare estimate, reputation, and available help before choosing.",
      back: isSpanish ? "Volver" : "Go back",
    },
    details: {
      savedPlace: isSpanish ? "Lugar guardado" : "Saved place",
      newAddress: isSpanish ? "Nuevo destino" : "New destination",
      provider: isSpanish ? "Empresa de viaje" : "Ride company",
      estimatedPickup: isSpanish ? "Recogida estimada" : "Estimated pickup",
      estimatedArrival: isSpanish ? "Llegada estimada" : "Estimated arrival",
      estimatedPrice: isSpanish ? "Precio estimado" : "Estimated price",
      reputation: isSpanish ? "Reputacion" : "Reputation",
      accessibility: isSpanish ? "Accesibilidad" : "Accessibility",
      recommended: isSpanish ? "Recomendada" : "Recommended",
      reviewBeforeBooking: isSpanish ? "Revisar antes de reservar" : "Review before booking",
      noBookingYet: isSpanish ? "Sin reserva todavia" : "No booking yet",
    },
    address: {
      title: isSpanish ? "¿Que direccion usamos?" : "What address should we use?",
      helper: isSpanish ? "Escribe la direccion completa o el codigo postal." : "Type the full address or just the postcode.",
      label: isSpanish ? "Direccion de destino" : "Destination address",
      placeholder: isSpanish ? "Empieza a escribir una direccion" : "Start typing an address",
      continue: isSpanish ? "Continuar" : "Continue",
      back: isSpanish ? "Volver" : "Go back",
    },
    dateTime: {
      title: isSpanish ? "¿Cuando debe llegar?" : "When should the ride arrive?",
      helper: isSpanish ? "Elige primero el dia y luego la hora." : "Choose the day first, then the time.",
      timeLabel: isSpanish ? "Hora de recogida" : "Pickup time",
      continue: isSpanish ? "Revisar el viaje" : "Review the ride",
      back: isSpanish ? "Volver" : "Go back",
    },
    review: {
      title: isSpanish ? "¿Esta todo correcto?" : "Does everything look right?",
      helper: isSpanish ? "No se solicita nada hasta que confirmes." : "Nothing will be requested until you confirm.",
      destination: isSpanish ? "Destino" : "Destination",
      provider: isSpanish ? "Opcion de viaje" : "Ride option",
      date: isSpanish ? "Dia" : "Date",
      time: isSpanish ? "Hora" : "Time",
      confirm: isSpanish ? "Confirmar y preparar viaje" : "Confirm and prepare ride",
      change: isSpanish ? "Cambiar un dato" : "Make a change",
    },
    waiting: {
      status: isSpanish ? "Espera un momento" : "Please wait",
      title: isSpanish ? "Preparando tu solicitud" : "Preparing your ride request",
      helper: isSpanish ? "Puede tardar un momento." : "This may take a moment. Please stay on this screen.",
      action: isSpanish ? "Preparando…" : "Preparing…",
    },
    completed: {
      status: isSpanish ? "Completado" : "Completed",
      title: isSpanish ? "La solicitud esta preparada" : "Your ride request is ready",
      helper: isSpanish ? "Revisa el siguiente paso en Ahora mismo." : "Review the next step in Right now.",
      reference: isSpanish ? "Referencia" : "Reference",
      done: isSpanish ? "Terminar" : "Done",
    },
    blocked: {
      status: isSpanish ? "Necesita atencion" : "Needs attention",
      title: isSpanish ? "No pudimos preparar el viaje" : "We could not prepare the ride",
      helper: isSpanish ? "Revisa los datos e intentalo otra vez." : "Review the details and try again.",
      retry: isSpanish ? "Revisar e intentar otra vez" : "Review and retry",
      cancel: isSpanish ? "Cancelar" : "Cancel",
    },
    cancelled: {
      status: isSpanish ? "Cancelado" : "Cancelled",
      title: isSpanish ? "No se solicito ningun viaje" : "No ride was requested",
      helper: isSpanish ? "Tus datos no se enviaron a nadie." : "Your details have not been sent anywhere.",
      restart: isSpanish ? "Empezar otra vez" : "Start again",
    },
    progress: (current, total) => isSpanish ? `Paso ${current} de ${total}` : `Step ${current} of ${total}`,
  }), [isSpanish]);
  const rideCanvasPlaces = useMemo(() => savedHomeAddress
    ? [{
      id: "home",
      label: isSpanish ? "Casa" : "Home",
      address: savedHomeAddress,
      subtitle: isSpanish ? "Guardado en tu perfil" : "Saved in your profile",
      pickupEstimate: { value: "8-12 min", tone: "good" as const },
      priceEstimate: { value: isSpanish ? "Se revisa antes de confirmar" : "Reviewed before confirmation" },
      reputation: { value: isSpanish ? "Perfil guardado" : "Saved profile", tone: "good" as const },
      accessibilityNote: hasSavedTransportMobilityInfo
        ? { value: isSpanish ? "Tiene en cuenta tus necesidades guardadas" : "Uses your saved mobility needs", tone: "good" as const }
        : undefined,
      recommended: true,
    }]
    : [], [hasSavedTransportMobilityInfo, isSpanish, savedHomeAddress]);
  const rideCanvasProviders = useMemo(() => {
    const savedProviderOptions = hasSavedTransportProvider && savedTransportProvider.trim()
      ? [{
        id: "saved-provider",
        label: savedTransportProvider,
        subtitle: isSpanish ? "Proveedor guardado" : "Saved provider",
        description: isSpanish ? "Se usara solo despues de tu confirmacion." : "Used only after your confirmation.",
        pickupEstimate: { value: isSpanish ? "Segun disponibilidad" : "Based on availability" },
        priceEstimate: { value: isSpanish ? "Se confirma antes de actuar" : "Confirmed before action" },
        reputation: { value: isSpanish ? "Preferencia guardada" : "Saved preference", tone: "good" as const },
        accessibilityNote: hasSavedTransportMobilityInfo
          ? { value: isSpanish ? "Incluye notas de movilidad guardadas" : "Includes saved mobility notes", tone: "good" as const }
          : undefined,
        recommended: true,
        voiceAliases: [savedTransportProvider],
      }]
      : [];
    return [
      ...savedProviderOptions,
      {
        id: "concierge-compare",
        label: isSpanish ? "Comparar opciones seguras" : "Compare safe options",
        subtitle: isSpanish ? "VYVA prepara opciones" : "VYVA prepares options",
        description: isSpanish ? "No llama, reserva ni escribe hasta que confirmes." : "No calls, bookings, or messages happen until you confirm.",
        pickupEstimate: { value: isSpanish ? "Varia por disponibilidad" : "Varies by availability" },
        priceEstimate: { value: isSpanish ? "Rango antes de confirmar" : "Range before confirmation" },
        reputation: { value: isSpanish ? "Compara reputacion y disponibilidad" : "Compares reputation and availability" },
        accessibilityNote: { value: isSpanish ? "Puede priorizar ayuda en puerta o movilidad" : "Can prioritize door help or mobility support" },
        recommended: savedProviderOptions.length === 0,
      },
    ];
  }, [hasSavedTransportMobilityInfo, hasSavedTransportProvider, isSpanish, savedTransportProvider]);
  const rideCanvasDates = useMemo(() => [
    { id: "today", label: isSpanish ? "Hoy" : "Today", value: "today" },
    { id: "tomorrow", label: isSpanish ? "Mañana" : "Tomorrow", value: "tomorrow" },
  ], [isSpanish]);
  const rideCanvasCommands = useMemo(() => ({
    start: isSpanish ? ["preparar un viaje", "empezar"] : ["arrange a ride", "start"],
    back: isSpanish ? ["volver", "atras"] : ["go back", "back"],
    cancel: isSpanish ? ["cancelar", "ahora no"] : ["cancel", "not now"],
    confirm: isSpanish ? ["confirmar", "si, confirmar"] : ["confirm", "yes, confirm"],
    retry: isSpanish ? ["intentar otra vez"] : ["retry", "try again"],
  }), [isSpanish]);
  const rideCanvasInitialState = useMemo<RideCanvasState>(() => ({
    step: transportDestination.trim() ? "provider" : "listening",
    requestId: 0,
    draft: {
      placeId: "",
      destination: transportDestination.trim(),
      providerId: "",
      providerName: "",
      dateChoice: "",
      time: "",
    },
  }), [transportDestination]);
  const confirmRideCanvas = useCallback(async (
    draft: Readonly<RideCanvasDraft>,
    { signal }: { requestId: number; signal: AbortSignal },
  ) => {
    const requestedTime = `${draft.dateChoice} ${draft.time}`.trim();
    setTransportDestination(draft.destination);
    setTransportTime(requestedTime);
    setTransportError(null);
    setTransportNotice(null);
    resetTransportFinalReview();
    const options = await fetchTransportOptions({
      pickupAddress: transportPickup.trim() || savedTransportPickupLabel,
      destinationAddress: draft.destination,
      requestedTime,
      mobilityNeeds: transportMobilityNeeds,
      hasSavedMobilityInfo: hasSavedTransportMobilityInfo,
      hasSavedTransportProvider: hasSavedTransportProvider || Boolean(draft.providerName),
      savedTransportProviderName: draft.providerName || savedTransportProvider,
      locale,
    });
    if (signal.aborted) throw new DOMException("Ride request cancelled", "AbortError");
    setTransportResult(options);
    const option = options.options.find((candidate) => candidate.kind === "saved_provider" && candidate.actions.includes("start_concierge_action"))
      ?? options.options.find((candidate) => candidate.actions.includes("start_concierge_action"));
    if (!option) throw new Error(isSpanish ? "No hay una opcion de transporte disponible." : "No ride option is available right now.");
    const prepared = await prepareTransportConciergeAction({
      option,
      pickupAddress: transportPickup.trim() || savedTransportPickupLabel,
      destinationAddress: draft.destination,
      requestedTime,
      mobilityNeeds: transportMobilityNeeds,
      hasSavedMobilityInfo: hasSavedTransportMobilityInfo,
      hasSavedTransportProvider: hasSavedTransportProvider || Boolean(draft.providerName),
      savedTransportProviderName: draft.providerName || savedTransportProvider,
      locale,
    });
    if (signal.aborted) throw new DOMException("Ride request cancelled", "AbortError");
    setTransportPreparedOption(option);
    setTransportPreparedResult(prepared);
    setTransportFinalForm({
      scheduledFor: "",
      pickup: transportPickup.trim() || savedTransportPickupLabel,
      destination: draft.destination,
      providerReply: "",
      priceEstimate: "",
      bookingReference: "",
      notes: "",
    });
    setTransportNotice(isSpanish
      ? "Solicitud preparada. Revisa el siguiente paso en Ahora mismo."
      : "Ride request prepared. Review the next step in Right now.");
    await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
    return { reference: prepared.pendingId || prepared.status };
  }, [
    hasSavedTransportMobilityInfo,
    hasSavedTransportProvider,
    isSpanish,
    locale,
    queryClient,
    savedTransportPickupLabel,
    savedTransportProvider,
    transportMobilityNeeds,
    transportPickup,
  ]);
  const isVoiceAppointmentHandoff=routePrefill?.kind==="appointment"&&routePrefill.source==="voice_action";
  const appointmentCanvasRolloutQuery=useQuery({queryKey:["/api/config/features/appointment-voice-canvas"],queryFn:async()=>{const response=await apiFetch("/api/config/features/appointment-voice-canvas");return response.ok?parseAppointmentCanvasRolloutConfig(await response.json()):{enabled:false,rolloutPercent:0}},enabled:isVoiceAppointmentHandoff,staleTime:0,refetchInterval:10_000,refetchOnWindowFocus:"always",retry:false});
  const usesAppointmentVoiceCanvas=isVoiceAppointmentHandoff&&isAppointmentCanvasEnabled(appointmentCanvasRolloutQuery.data,conciergeVoiceAction?.id??"anonymous");
  const appointmentVoiceCanvasCopy=useMemo<AppointmentCanvasCopy>(()=>({
    agentPresence:{idleLabel:isSpanish?"VYVA lista":"VYVA is ready",idleDescription:isSpanish?"Puedes hablar o tocar la pantalla.":"You can speak or use the screen.",listeningLabel:isSpanish?"Escuchando contigo":"Listening with you",listeningDescription:isSpanish?"Puedes decir el profesional, el motivo o la hora.":"You can say the provider, reason, or time.",speakingLabel:isSpanish?"VYVA está hablando":"VYVA is speaking",speakingDescription:isSpanish?"La pantalla seguirá el mismo paso.":"The screen will stay on the same step.",thinkingLabel:isSpanish?"Preparando la cita":"Thinking through appointment details",thinkingDescription:isSpanish?"Revisando la preparación antes de confirmar.":"Checking the preparation before confirmation.",accessibleLabel:isSpanish?"Estado de voz de VYVA para la cita":"VYVA voice status for the appointment"},
    listening:{status:isSpanish?"Escuchando":"Listening",title:isSpanish?"Preparemos tu cita":"Let’s prepare your appointment",helper:isSpanish?"Puedes hablar o usar los botones.":"Use your voice or the buttons below.",start:isSpanish?"Empezar":"Start",cancel:isSpanish?"Ahora no":"Not now"},
    provider:{title:isSpanish?"¿Con qué profesional o clínica?":"Which clinician or clinic?",helper:isSpanish?"Elige uno guardado o añade otro.":"Choose a saved provider or add another.",newProvider:isSpanish?"Otro profesional o clínica":"A different provider",newProviderHelper:isSpanish?"Escribe el nombre":"Enter the provider name",back:isSpanish?"Volver":"Go back"},
    providerEntry:{title:isSpanish?"¿Qué nombre usamos?":"What provider should we use?",helper:isSpanish?"Escribe el profesional o la clínica.":"Enter the clinician or clinic.",label:isSpanish?"Profesional o clínica":"Clinician or clinic",placeholder:isSpanish?"Nombre del profesional o clínica":"Provider or clinic name",continue:isSpanish?"Continuar":"Continue",back:isSpanish?"Volver":"Go back"},
    reason:{title:isSpanish?"¿Para qué es la cita?":"What is the appointment for?",helper:isSpanish?"Incluye solo lo necesario para preparar la solicitud.":"Include only what is helpful to prepare the request.",label:isSpanish?"Motivo de la cita":"Reason for appointment",placeholder:isSpanish?"Por ejemplo, revisión o seguimiento":"For example, check-up or follow-up",continue:isSpanish?"Continuar":"Continue",back:isSpanish?"Volver":"Go back"},
    dateTime:{title:isSpanish?"¿Cuándo te viene bien?":"When works for you?",helper:isSpanish?"Elige un día y una hora preferidos.":"Choose a preferred day and time.",timeLabel:isSpanish?"Hora preferida":"Preferred time",continue:isSpanish?"Revisar":"Review",back:isSpanish?"Volver":"Go back"},
    review:{title:isSpanish?"Revisa la preparación":"Review appointment preparation",helper:isSpanish?"Nada se envía ni se reserva hasta que confirmes.":"Nothing is sent or booked until you confirm.",provider:isSpanish?"Profesional":"Provider",reason:isSpanish?"Motivo":"Reason",date:isSpanish?"Día":"Day",time:isSpanish?"Hora":"Time",confirm:isSpanish?"Confirmar y preparar":"Confirm and prepare",change:isSpanish?"Cambiar un dato":"Make a change"},
    waiting:{status:isSpanish?"Espera un momento":"Please wait",title:isSpanish?"Preparando la solicitud":"Preparing the request",helper:isSpanish?"No salgas de esta pantalla.":"Please stay on this screen.",action:isSpanish?"Preparando…":"Preparing…"},
    completed:{status:isSpanish?"Completado":"Completed",title:isSpanish?"La preparación está lista":"Appointment preparation is ready",helper:isSpanish?"Revisa los siguientes pasos antes de cualquier acción externa.":"Review the next steps before any external action.",reference:isSpanish?"Referencia":"Reference",done:isSpanish?"Terminar":"Done"},
    blocked:{status:isSpanish?"Necesita atención":"Needs attention",title:isSpanish?"No pudimos preparar la solicitud":"We could not prepare the request",helper:isSpanish?"Revisa los datos e inténtalo otra vez.":"Review the details and try again.",retry:isSpanish?"Revisar e intentar otra vez":"Review and retry",cancel:isSpanish?"Cancelar":"Cancel"},
    cancelled:{status:isSpanish?"Cancelado":"Cancelled",title:isSpanish?"No se preparó ninguna solicitud":"Nothing was prepared",helper:isSpanish?"No se envió ningún dato.":"No details were sent.",restart:isSpanish?"Empezar otra vez":"Start again"},progress:(current,total)=>isSpanish?`Paso ${current} de ${total}`:`Step ${current} of ${total}`}),[isSpanish]);
  const appointmentCanvasProviders=useMemo(()=>savedMedicalProvider?[{id:"saved-medical-provider",label:savedMedicalProvider,description:isSpanish?"Guardado en tu perfil":"Saved in your profile"}]:[],[isSpanish,savedMedicalProvider]);
  const appointmentCanvasDates=useMemo(()=>[{id:"today",label:isSpanish?"Hoy":"Today",value:"today"},{id:"tomorrow",label:isSpanish?"Mañana":"Tomorrow",value:"tomorrow"},{id:"next-week",label:isSpanish?"La próxima semana":"Next week",value:"next-week"}],[isSpanish]);
  const appointmentCanvasCommands=useMemo(()=>({start:isSpanish?["empezar","preparar cita"]:["start","prepare appointment"],back:isSpanish?["volver","atrás"]:["back","go back"],cancel:isSpanish?["cancelar","ahora no"]:["cancel","not now"],confirm:isSpanish?["confirmar","sí, confirmar"]:["confirm","yes, confirm"],retry:isSpanish?["intentar otra vez"]:["retry","try again"]}),[isSpanish]);
  const appointmentCanvasInitialState=useMemo<AppointmentCanvasState>(()=>({step:"listening",requestId:0,draft:{providerId:"",providerName:conciergeVoiceProvider.trim(),reason:conciergeVoiceReason.trim(),dateChoice:conciergeVoiceDate.trim(),time:conciergeVoiceTime.trim()}}),[conciergeVoiceDate,conciergeVoiceProvider,conciergeVoiceReason,conciergeVoiceTime]);
  const confirmAppointmentCanvas=useCallback(async(draft:Readonly<AppointmentCanvasDraft>,{signal}:{requestId:number;signal:AbortSignal})=>{const result=await createAppointmentRequest({appointmentType:"medical",detail:draft.reason,locale,routePrefillSource:routePrefill?.source,preferences:{provider_id:draft.providerId||undefined,provider_name:draft.providerName,date_preference:draft.dateChoice,preferred_time:draft.time,preparation_only:true,no_external_action_without_confirmation:true,...(persistedTask?{concierge_task_id:persistedTask.id}:{})}});if(signal.aborted)throw new DOMException("Appointment preparation cancelled","AbortError");setAppointmentRequest(result.request);setAppointmentOptions(result.options);setAppointmentDiscovery(result.discovery??null);setSelectedAppointmentOptionId(result.options[0]?.id??null);setAppointmentOpen(true);setAppointmentNotice(isSpanish?"Solicitud preparada. Revisa el siguiente paso antes de actuar.":"Request prepared. Review the next step before any action.");return{reference:result.request.id}},[isSpanish,locale,persistedTask,routePrefill?.source]);

  function showNextQueuedAction() {
    const nextAction = queuedActions[0] ?? pendingActions[0];
    if (!nextAction) return;
    setVisibleActionId(nextAction.id);
    setIsRightNowHidden(false);
  }

  function openShoppingHelp(kind: "groceries" | "essentials" | "prepared-meals" | "pharmacy" = "groceries") {
    if (kind === "pharmacy") {
      openOtcPharmacyAssistant();
      return;
    }

    const pharmacyName = savedPharmacyName(conciergeProfile);
    const orderCopy = {
      groceries: {
        category: "groceries",
        needText: isSpanish
          ? "Ayudame con la compra de alimentos. No compres ni contactes sin mi confirmacion."
          : "Help me with groceries. Do not buy or contact anyone without my confirmation.",
        sourceRecommendation: isSpanish
          ? "VYVA prepara opciones de compra y pide confirmacion antes de cualquier pedido."
          : "VYVA prepares grocery options and asks for confirmation before any order.",
      },
      essentials: {
        category: "groceries",
        needText: isSpanish
          ? "Ayudame a pedir productos esenciales para casa. No compres ni contactes sin mi confirmacion."
          : "Help me order essential household items. Do not buy or contact anyone without my confirmation.",
        sourceRecommendation: isSpanish
          ? "VYVA prepara productos esenciales y pide confirmacion antes de cualquier pedido."
          : "VYVA prepares essential-item options and asks for confirmation before any order.",
      },
      "prepared-meals": {
        category: "groceries",
        needText: isSpanish
          ? "Ayudame a encontrar comidas preparadas o entrega de comida sencilla. No compres ni contactes sin mi confirmacion."
          : "Help me find prepared meals or simple meal delivery. Do not buy or contact anyone without my confirmation.",
        sourceRecommendation: isSpanish
          ? "VYVA prepara opciones de comidas preparadas y pide confirmacion antes de cualquier pedido."
          : "VYVA prepares prepared-meal options and asks for confirmation before any order.",
      },
      pharmacy: {
        category: "pharmacy_basics",
        needText: isSpanish
          ? `Ayudame con productos de farmacia sin receta${pharmacyName ? ` usando ${pharmacyName}` : ""}. No compres ni contactes sin mi confirmacion.`
          : `Help me with over-the-counter pharmacy items${pharmacyName ? ` using ${pharmacyName}` : ""}. Do not buy or contact anyone without my confirmation.`,
        sourceRecommendation: isSpanish
          ? "VYVA solo prepara productos sin receta y pide confirmacion antes de contactar o pedir."
          : "VYVA only prepares over-the-counter items and asks for confirmation before contact or ordering.",
      },
    }[kind];

    navigate("/concierge/shopping", {
      state: {
        shoppingPrefill: {
          needText: orderCopy.needText,
          category: orderCopy.category,
          priorities: ["delivery", "simplicity", "safety"],
          constraints: isSpanish
            ? ["confirmar antes de contactar o pedir"]
            : ["confirm before contacting or ordering"],
          sourceRecommendation: orderCopy.sourceRecommendation,
        },
      },
    });
  }

  function openOtcPharmacyAssistant() {
    setOtcPharmacyOpen(true);
    setInsuranceAdminOpen(false);
    setScamCheckOpen(false);
    setAppointmentOpen(false);
    setOffersOpen(false);
    setRoutePrefill(null);
    setOtcNotice(null);
    setOtcError(null);
    setOtcFulfillmentPreference("delivery");
    setOtcRequestedTime("today");
    setOtcNotes("");
    if (!otcItemText.trim()) {
      setOtcItemText("");
    }
    window.setTimeout(() => scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" }), 80);
  }

  function openOtcPharmacyProviderSetup() {
    navigate("/onboarding/profile/providers", {
      state: {
        returnTo: "/concierge",
        setupFocus: OTC_PHARMACY_SETUP_FOCUS,
        setupFlow: OTC_PHARMACY_FLOW_REFERENCE,
        setupReason: "Add a saved pharmacy",
        conciergeResume: {
          kind: "otc_pharmacy",
          itemText: otcItemText.trim(),
          fulfillmentPreference: otcFulfillmentPreference,
          requestedTime: otcRequestedTime.trim() || "today",
          notes: otcNotes.trim(),
        },
        notice: isSpanish
          ? "Anade una farmacia guardada antes de pedir ayuda con productos sin receta."
          : "Add a saved pharmacy before asking for help with over-the-counter items.",
      },
    });
  }

  function launchConciergeTask(entry: ConciergeTaskEntry, openInline: () => void) {
    if (mode === "home") {
      navigate(conciergeTaskPath(), { state: { conciergeTaskEntry: entry } });
      return;
    }
    openInline();
  }

  const conciergeMasterCards: MasterDashboardCard[] = [
    {
      id: "home-care",
      icon: Home,
      title: t("concierge.master.cards.homeCare", "Home Care"),
      detail: t("concierge.master.cards.homeCareDetail", "Plumber, electrician, cleaning"),
      chips: [
        t("concierge.master.cards.homeCareChipPlumber", "Plumber"),
        t("concierge.master.cards.homeCareChipElectrician", "Electrician"),
        t("concierge.master.cards.homeCareChipCleaning", "Cleaning"),
      ],
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0", surface: "#FFFFFF" },
      onClick: () => launchConciergeTask({ kind: "home_service" }, openHomeServiceAssistant),
      testId: "button-concierge-card-service",
    },
    {
      id: "personal-care",
      icon: UserRound,
      title: t("concierge.master.cards.personalCare", "Personal Care"),
      detail: t("concierge.master.cards.personalCareDetail", "Find a specialist, find a residence"),
      chips: [
        t("concierge.master.cards.personalCareChipSpecialist", "Find a Specialist"),
        t("concierge.master.cards.personalCareChipResidence", "Find a Residence"),
      ],
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA", surface: "#FFFFFF" },
      onClick: () => {
        const query = isSpanish
          ? "comparar especialista, cuidado personal o residencia"
          : "compare a specialist, personal care, or residence";
        launchConciergeTask(
          { kind: "provider_contact", providerSearchMode: "personal-care", query },
          () => openProviderSearchPanel("personal-care", query),
        );
      },
      testId: "button-concierge-card-ride",
    },
    {
      id: "order-in",
      icon: PackageCheck,
      title: t("concierge.master.cards.orderIn", "Order In"),
      detail: t("concierge.master.cards.orderInDetail", "Groceries, household"),
      chips: [
        t("concierge.master.cards.orderInChipGroceries", "Groceries"),
        t("concierge.master.cards.orderInChipHousehold", "Household"),
      ],
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA", surface: "#FFFFFF" },
      onClick: () => openShoppingHelp("groceries"),
      testId: "button-concierge-card-delivery",
    },
    {
      id: "book-now",
      icon: Calendar,
      title: t("concierge.master.cards.bookNow", "Book Now"),
      detail: t("concierge.master.cards.bookNowDetail", "Medical, government, personal care"),
      chips: [
        t("concierge.master.cards.bookNowChipMedical", "Medical"),
        t("concierge.master.cards.bookNowChipGovernment", "Government"),
        t("concierge.master.cards.bookNowChipPersonalCare", "Personal care"),
      ],
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE", surface: "#FFFFFF" },
      onClick: () => launchConciergeTask({ kind: "appointment" }, () => openScheduleAssistant()),
      testId: "button-concierge-card-appointment",
    },
  ];

  const conciergeMasterFastHelpActions: MasterFastHelpAction[] = [
    {
      id: "safe-home",
      icon: ShieldCheck,
      label: t("concierge.master.fastHelp.safeHome", "Safe Home"),
      detail: t("concierge.master.fastHelp.safeHomeDetail", "Safety check"),
      tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", border: "#99F6E4" },
      onClick: () =>
        navigate("/safe-home", {
          state: {
            source: "concierge_fast_help",
            flowReference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
          },
        }),
      testId: "button-concierge-fast-safe-home",
    },
    {
      id: "paperwork-help",
      icon: FileText,
      label: t("concierge.master.fastHelp.paperworkHelp", "Paperwork Help"),
      detail: t("concierge.master.fastHelp.paperworkHelpDetail", "Forms and admin"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
      onClick: () => launchConciergeTask({ kind: "document" }, () => openInsuranceAdminAssistant()),
      testId: "button-concierge-fast-fill-form",
    },
    {
      id: "find-plumber",
      icon: Wrench,
      label: t("concierge.master.fastHelp.findPlumber", "Find Plumber"),
      detail: t("concierge.master.fastHelp.findPlumberDetail", "Home repair"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA" },
      onClick: () => launchConciergeTask({ kind: "home_service" }, openHomeServiceAssistant),
      testId: "button-concierge-fast-home-service",
    },
    {
      id: "check-scam",
      icon: AlertTriangle,
      label: t("concierge.master.fastHelp.checkScam", "Check Scam"),
      detail: t("concierge.master.fastHelp.checkScamDetail", "Message or offer"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E11D48", border: "#FECACA" },
      onClick: () => launchConciergeTask({ kind: "scam_review" }, openScamCheckAssistant),
      testId: "button-concierge-fast-check-scam",
    },
    {
      id: "book-ride",
      icon: Car,
      label: t("concierge.master.fastHelp.bookRide", "Book Ride"),
      detail: t("concierge.master.fastHelp.bookRideDetail", "Transport help"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE" },
      onClick: () => launchConciergeTask({ kind: "transport" }, () => prepareRideRequest(undefined, "now")),
      testId: "button-concierge-fast-book-ride",
    },
    {
      id: "order-groceries",
      icon: ShoppingBasket,
      label: t("concierge.master.fastHelp.orderGroceries", "Order Groceries"),
      detail: t("concierge.master.fastHelp.orderGroceriesDetail", "Food shopping"),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0" },
      onClick: () => openShoppingHelp("groceries"),
      testId: "button-concierge-fast-order-groceries",
    },
    {
      id: "otc-pharmacy",
      icon: Pill,
      label: t("concierge.master.fastHelp.otcPharmacy", "OTC Pharmacy"),
      detail: t("concierge.master.fastHelp.otcPharmacyDetail", "Non-prescription"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA" },
      onClick: () => launchConciergeTask({ kind: "otc_pharmacy" }, openOtcPharmacyAssistant),
      testId: "button-concierge-fast-otc-pharmacy",
    },
    {
      id: "find-specialist",
      icon: UserRound,
      label: t("concierge.master.fastHelp.findSpecialist", "Find Specialist"),
      detail: t("concierge.master.fastHelp.findSpecialistDetail", "Care options"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
      onClick: () => {
        const query = isSpanish ? "buscar especialista" : "find a specialist";
        launchConciergeTask(
          { kind: "provider_contact", providerSearchMode: "specialist", query },
          () => openProviderSearchPanel("specialist", query),
        );
      },
      testId: "button-concierge-fast-find-care",
    },
    {
      id: "find-residence",
      icon: HeartHandshake,
      label: t("concierge.master.fastHelp.findResidence", "Find Residence"),
      detail: t("concierge.master.fastHelp.findResidenceDetail", "Compare support"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA" },
      onClick: () => {
        const query = isSpanish ? "comparar residencias o centros de cuidado" : "compare residences or care homes";
        launchConciergeTask(
          { kind: "provider_contact", providerSearchMode: "residence", query },
          () => openProviderSearchPanel("residence", query),
        );
      },
      testId: "button-concierge-fast-find-residence",
    },
    {
      id: "book-medical",
      icon: Calendar,
      label: t("concierge.master.fastHelp.bookMedical", "Book Medical"),
      detail: t("concierge.master.fastHelp.bookMedicalDetail", "Doctor or clinic"),
      tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", border: "#99F6E4" },
      onClick: () => launchConciergeTask(
        { kind: "appointment", appointmentKind: "medical" },
        () => openScheduleAssistant("medical"),
      ),
      testId: "button-concierge-fast-book-medical",
    },
    {
      id: "government-help",
      icon: Building2,
      label: t("concierge.master.fastHelp.governmentHelp", "Government Help"),
      detail: t("concierge.master.fastHelp.governmentHelpDetail", "Official tasks"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE" },
      onClick: () => launchConciergeTask(
        { kind: "document", documentKind: "government-form" },
        () => openInsuranceAdminAssistant("government-form"),
      ),
      testId: "button-concierge-fast-government-help",
    },
    {
      id: "prepared-meals",
      icon: PackageCheck,
      label: t("concierge.master.fastHelp.preparedMeals", "Prepared Meals"),
      detail: t("concierge.master.fastHelp.preparedMealsDetail", "Simple meals"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA" },
      onClick: () => openShoppingHelp("prepared-meals"),
      testId: "button-concierge-fast-prepared-meals",
    },
  ];

  const taskWorkspaceStage: ConciergeTaskStage = activeActionNeedsUserConfirmation
    ? "confirmation"
    : activeAction || routePrefill
      ? "review"
      : persistedTask?.stage ?? "details";
  const taskWorkspaceTitle = effectiveTaskEntry
    ? conciergeTaskEntryTitle(effectiveTaskEntry, isSpanish)
    : activeAction
      ? getPendingActionUseCaseLabel(activeAction, locale)
      : conciergeTaskEntryTitle(null, isSpanish);
  const taskWorkspaceSummary = activeAction?.action_summary
    || routePrefill?.summary
    || (effectiveTaskEntry ? conciergeTaskEntrySummary(effectiveTaskEntry, isSpanish) : (isSpanish
      ? "Completa solo los datos que faltan y revisa cada paso antes de confirmar."
      : "Complete only the missing details and review each step before confirming."));
  const activeSavedTask = savedTaskDrafts
    .map((task, index) => {
      const action = task.linked_pending_id
        ? pendingActions.find((candidate) => candidate.id === task.linked_pending_id) ?? null
        : null;
      const providerUpdate = conciergeProviderReplySnapshot(action?.action_payload);
      return { task, action, providerUpdate, index };
    })
    .sort((left, right) => (
      conciergeProviderStatusPriority(left.providerUpdate?.status)
      - conciergeProviderStatusPriority(right.providerUpdate?.status)
      || left.index - right.index
    ))[0] ?? null;
  const activeSavedTaskEntry = coerceConciergeTaskEntry(activeSavedTask?.task.entry_payload);
  const activeSavedTaskExecutionTask = activeSavedTask?.action
    ? getConciergeExecutionTask(activeSavedTask.action)
    : null;
  const activeSavedTaskMissingRequirements = Array.isArray(activeSavedTaskExecutionTask?.missing_requirements)
    ? activeSavedTaskExecutionTask.missing_requirements
    : [];
  const activeSavedTaskCanvasState = activeSavedTask?.action
    ? deriveConciergeCanvasState({
        status: activeSavedTask.action.status,
        useCase: activeSavedTask.action.use_case,
        flowReference: activeSavedTaskExecutionTask?.flow_reference
          ?? payloadString(activeSavedTask.action.action_payload, ["flow_reference"]),
        actionType: activeSavedTaskExecutionTask?.action_type
          ?? payloadString(activeSavedTask.action.action_payload, ["action_type", "task_type"]),
        executionTask: activeSavedTaskExecutionTask,
        hasMissingDetails: activeSavedTaskMissingRequirements.length > 0
          || activeSavedTaskExecutionTask?.lifecycle_status === "needs_info",
        hasReviewSummary: true,
        reviewPresented: activeSavedTask.action.status === "pending"
          && activeSavedTaskExecutionTask?.lifecycle_status !== "needs_info",
        providerReply: activeSavedTask.providerUpdate,
        waitingForProvider: activeSavedTask.action.status === "calling",
        missionStatus: payloadString(activeSavedTask.action.action_payload, ["mission_status", "status"]),
      })
    : null;
  const activeActionProviderUpdate = conciergeProviderReplySnapshot(activeAction?.action_payload);
  const activeActionCanvasState = activeAction
    ? deriveConciergeCanvasState({
        status: activeAction.status,
        useCase: activeAction.use_case,
        flowReference: activeActionExecutionTask?.flow_reference
          ?? payloadString(activeAction.action_payload, ["flow_reference"]),
        actionType: activeActionExecutionTask?.action_type,
        executionTask: activeActionExecutionTask,
        hasMissingDetails: activeActionNeedsGuidedDetails
          || activeActionFormMissingFields.length > 0
          || Boolean(activeActionReviewSummary?.missingDetails.length),
        hasReviewSummary: Boolean(activeActionReviewSummary),
        reviewPresented: activeActionNeedsUserConfirmation && Boolean(activeActionReviewSummary),
        providerReply: activeActionProviderUpdate,
        waitingForProvider: activeAction.status === "calling",
        missionStatus: payloadString(activeAction.action_payload, ["mission_status", "status"]),
        reconfirmationRequired: Boolean(activeActionReviewSummary?.reconfirmation),
      })
    : null;
  const activeActionCanvasPrimaryLabel = activeActionCanvasState
    ? conciergeCanvasPrimaryActionDisplayLabel(activeActionCanvasState.state, isSpanish)
    : "";
  const activeActionCanvasCopy = activeActionCanvasState
    ? conciergeCanvasExplainability(activeActionCanvasState, isSpanish, {
        providerName: activeAction?.provider_name,
      })
    : null;
  const homeActiveTask = activeSavedTask
    ? {
        id: activeSavedTask.task.id,
        detailPath: activeSavedTask.action
          ? conciergeTaskInboxItemPath("pending", activeSavedTask.action.id)
          : conciergeTaskInboxItemPath("draft", activeSavedTask.task.id),
        title: conciergeTaskEntryTitle(activeSavedTaskEntry, isSpanish),
        summary: activeSavedTask.providerUpdate?.summary
          || conciergeTaskEntrySummary(activeSavedTaskEntry, isSpanish),
        providerStatus: activeSavedTask.providerUpdate?.status ?? null,
        canvasState: activeSavedTaskCanvasState?.state ?? null,
        canvasSummary: activeSavedTaskCanvasState,
      }
    : activeAction
    ? {
        id: activeAction.id,
        detailPath: conciergeTaskInboxItemPath("pending", activeAction.id),
        title: getPendingActionUseCaseLabel(activeAction, locale),
        summary: activeActionProviderUpdate?.summary
          || activeAction.action_summary
          || activeTaskProviderLabel(activeAction, isSpanish),
        providerStatus: activeActionProviderUpdate?.status ?? null,
        canvasState: activeActionCanvasState?.state ?? null,
        canvasSummary: activeActionCanvasState,
      }
    : null;
  const trustedHelpSetupPanel = (
    <section
      className="order-[10] mt-4 rounded-[26px] border border-[#99F6E4] bg-[#F0FDFA] p-4 shadow-[0_16px_34px_rgba(15,118,110,0.08)]"
      data-testid="panel-concierge-trusted-help"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-[#0F766E] shadow-sm">
            <ShieldCheck size={23} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
              {isSpanish ? "Configuracion segura" : "Trusted setup"}
            </p>
            <h2 className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1">
              {isSpanish ? "Mi ayuda de confianza" : "My Trusted Help"}
            </h2>
            <p className="mt-1 max-w-[560px] font-body text-[13px] font-bold leading-snug text-vyva-text-2">
              {isSpanish
                ? "Proveedores, pagos, familia y limites para pedidos o reservas."
                : "Providers, payment, family approvals, and limits for orders or bookings."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/settings/trusted-help")}
          className="vyva-tap inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#0F766E] px-5 font-body text-[14px] font-black text-white shadow-[0_12px_26px_rgba(15,118,110,0.18)]"
          data-testid="button-concierge-trusted-help"
        >
          <Sparkles size={16} aria-hidden="true" />
          {isSpanish ? "Configurar" : "Set up"}
        </button>
      </div>
    </section>
  );
  return (
    <MasterDashboardLayout
      testId="concierge-master-layout"
      cardGridTestId="concierge-master-cards"
      fastHelpTestId="concierge-fast-help"
      fastHelpTitle={t("concierge.fastHelp.kicker", "Fast help")}
      hero={{
        icon: ConciergeBell,
        eyebrow: t("concierge.master.heroEyebrow", "Concierge"),
        title: t("concierge.master.heroTitle", "Concierge ready"),
        action: {
          kind: "voice",
          label: t("concierge.master.heroAction", "Talk to VYVA"),
          supportingLabel: t("concierge.master.voiceSupport", "Speak anytime"),
          contextHint: t("concierge.master.voiceContext", "Concierge support. Ask what the user needs, compare options, and do not book or submit anything without confirmation."),
          voiceAgentSlug: "concierge",
          voiceDynamicVariables: { app_entrypoint: "concierge_master_hero" },
          autoStartListening: true,
          testId: "button-concierge-hero-talk",
        },
        testId: "concierge-master-hero",
        tone: {
          iconBg: "#ECFDF5",
          iconColor: "#047857",
          border: "#BBF7D0",
          surface: "#FFFFFF",
        },
      }}
      cards={conciergeMasterCards}
      fastHelpActions={conciergeMasterFastHelpActions}
      showLauncher={mode !== "task"}
    >
      {mode === "home" ? (
        <>
          <ConciergeHomeTaskOverview
            activeTask={homeActiveTask}
            isLoading={pendingLoading || savedTaskDraftsLoading || completedSessionsLoading}
            isSpanish={isSpanish}
            onContinue={(task) => navigate(task.detailPath)}
            onOpenInbox={() => navigate("/concierge/tasks")}
          />
          {trustedHelpSetupPanel}
        </>
      ) : (
        <>
          {mode !== "task" ? trustedHelpSetupPanel : null}
          {mode === "task" ? (
            <ConciergeTaskWorkspaceHeader
              title={taskWorkspaceTitle}
              summary={taskWorkspaceSummary}
              stage={taskWorkspaceStage}
              providerUpdate={activeActionProviderUpdate ? {
                status: activeActionProviderUpdate.status,
                summary: activeActionProviderUpdate.summary,
              } : null}
              canvasState={activeActionCanvasState?.state ?? null}
              canvasSummary={activeActionCanvasState}
              isSpanish={isSpanish}
              onBack={() => navigate("/concierge/tasks")}
              onDelete={persistedTask ? () => {
                const approved = window.confirm(isSpanish
                  ? "Eliminar esta tarea guardada?"
                  : "Remove this saved task?");
                if (approved) deleteTaskMutation.mutate(persistedTask.id);
              } : undefined}
              isDeleting={deleteTaskMutation.isPending}
            />
          ) : null}
      {trustedProviderResume && trustedProviderResumeMeta && (
        <section
          className="order-[12] mt-4 rounded-[26px] border border-[#BBF7D0] bg-[#F0FDF4] p-4 shadow-[0_16px_36px_rgba(4,120,87,0.10)]"
          data-testid="panel-concierge-provider-resume"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-[#047857] shadow-sm">
                <CircleCheck size={23} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#047857]">
                  {isSpanish ? "Proveedor guardado" : "Provider saved"}
                </p>
                <h2 className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1">
                  {trustedProviderResume.name}
                </h2>
                <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                  {trustedProviderResumeMeta.categoryLabel} - {trustedProviderResumeMeta.detail}
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:min-w-[260px] sm:grid-cols-2">
              <button
                type="button"
                onClick={continueTrustedProviderResume}
                className="vyva-tap inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[#047857] px-4 font-body text-[14px] font-black text-white"
                data-testid="button-provider-resume-continue"
              >
                <Sparkles size={16} aria-hidden="true" />
                {trustedProviderResumeMeta.primaryLabel}
              </button>
              <button
                type="button"
                onClick={() => setTrustedProviderResume(null)}
                className="vyva-tap inline-flex min-h-[46px] items-center justify-center rounded-full border border-[#BBF7D0] bg-white px-4 font-body text-[14px] font-black text-[#047857]"
                data-testid="button-provider-resume-dismiss"
              >
                {isSpanish ? "Ahora no" : "Not now"}
              </button>
            </div>
          </div>
        </section>
      )}

      {providerSetupHelpRequest && providerSetupHelpRequestMeta && (
        <section
          className="order-[13] mt-4 rounded-[26px] border border-[#FED7AA] bg-[#FFF7ED] p-4 shadow-[0_16px_36px_rgba(180,83,9,0.10)]"
          data-testid="panel-concierge-provider-setup-help"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-[#B45309] shadow-sm">
                <Users size={23} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#B45309]">
                  {isSpanish ? "Esperando ayuda" : "Waiting for help"}
                </p>
                <h2 className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1">
                  {providerSetupHelpRequestMeta.title}
                </h2>
                <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                  {providerSetupHelpRequestMeta.categoryLabel} - {providerSetupHelpRequestMeta.detail}
                </p>
                {providerSetupHelpRequest.setupReason ? (
                  <p className="mt-2 font-body text-[12px] font-semibold leading-snug text-[#92400E]">
                    {providerSetupHelpRequest.setupReason}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-2 sm:min-w-[280px] sm:grid-cols-2">
              <button
                type="button"
                onClick={continueProviderSetupHelpRequest}
                className="vyva-tap inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[#B45309] px-4 font-body text-[14px] font-black text-white"
                data-testid="button-provider-setup-help-continue"
              >
                <Sparkles size={16} aria-hidden="true" />
                {isSpanish ? "Continuar manual" : "Continue manually"}
              </button>
              <button
                type="button"
                onClick={() => setProviderSetupHelpRequest(null)}
                className="vyva-tap inline-flex min-h-[46px] items-center justify-center rounded-full border border-[#FED7AA] bg-white px-4 font-body text-[14px] font-black text-[#92400E]"
                data-testid="button-provider-setup-help-dismiss"
              >
                {isSpanish ? "Ocultar" : "Dismiss"}
              </button>
            </div>
          </div>
        </section>
      )}

      {insuranceAdminOpen && (
        <section
          className="relative z-20 order-[14] mt-4 scroll-mt-[88px] overflow-hidden rounded-[28px] border border-[#DDD6FE] bg-white"
          style={{ boxShadow: "0 18px 42px rgba(107,33,168,0.12)" }}
          data-testid="panel-insurance-admin"
        >
          <div className="bg-[#F5F3FF] p-4 lg:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-[#6B21A8] shadow-sm">
                <FileText size={23} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#6B21A8]">
                  {isSpanish ? "Ayuda administrativa" : "Paperwork help"}
                </p>
                <h2 className="mt-1 font-body text-[23px] font-black leading-tight text-vyva-text-1">
                  {isSpanish ? "Que necesitas preparar?" : "What do you need to prepare?"}
                </h2>
                <p className="mt-2 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
                  {isSpanish
                    ? "VYVA organiza los pasos, pero no envia, llama ni comparte datos sin tu confirmacion."
                    : "VYVA organizes the steps, but does not send, call, or share details without your confirmation."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInsuranceAdminOpen(false);
                  setSelectedInsuranceAdminKind(null);
                  setInsuranceAdminDetails({ subject: "", recipient: "", deadline: "", notes: "" });
                }}
                className="vyva-tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#6B21A8]"
                aria-label={isSpanish ? "Cerrar" : "Close"}
                data-testid="button-insurance-admin-close"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="space-y-3 p-4 lg:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {INSURANCE_ADMIN_OPTIONS.map((option) => {
                const Icon = option.Icon;
                const readiness = insuranceAdminReadiness(option);
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleInsuranceAdminChoice(option)}
                    className="vyva-tap flex min-h-[112px] items-start gap-3 rounded-[22px] border border-[#DDD6FE] bg-[#FBF8FF] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                    data-testid={`button-insurance-admin-${option.key}`}
                  >
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[17px] bg-white text-[#6B21A8] shadow-sm">
                      <Icon size={22} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-body text-[16px] font-black leading-tight text-vyva-text-1">
                        {isSpanish ? option.es : option.en}
                      </span>
                      <span className="sr-only">
                        {isSpanish ? option.detailEs : option.detailEn}
                      </span>
                      <ActionReadinessPanel
                        readiness={readiness}
                        desiredAction={isSpanish ? option.es : option.en}
                        isSpanish={isSpanish}
                        compact
                        testId={`panel-insurance-admin-readiness-${option.key}`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedInsuranceAdminOption && selectedInsuranceAdminCopy ? (
              <div
                className="rounded-[24px] border border-[#DDD6FE] bg-[#FBF8FF] p-4"
                data-testid="panel-insurance-admin-guided-fields"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-[#6B21A8] shadow-sm">
                    <SelectedInsuranceAdminIcon size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-body text-[16px] font-black leading-tight text-vyva-text-1">
                      {isSpanish ? selectedInsuranceAdminOption.es : selectedInsuranceAdminOption.en}
                    </p>
                    <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                      {isSpanish
                        ? "Completa solo lo que sepas. VYVA preguntara lo que falte."
                        : "Fill only what you know. VYVA will ask for what is missing."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                      {selectedInsuranceAdminCopy.subjectLabel}
                    </span>
                    <Input
                      value={insuranceAdminDetails.subject}
                      onChange={(event) => setInsuranceAdminDetails((current) => ({ ...current, subject: event.target.value }))}
                      placeholder={selectedInsuranceAdminCopy.subjectPlaceholder}
                      data-testid="input-insurance-admin-subject"
                      className="min-h-[48px] rounded-[16px] border-[#DDD6FE] bg-white font-body text-[15px] font-semibold"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                      {selectedInsuranceAdminCopy.recipientLabel}
                    </span>
                    <Input
                      value={insuranceAdminDetails.recipient}
                      onChange={(event) => setInsuranceAdminDetails((current) => ({ ...current, recipient: event.target.value }))}
                      placeholder={isSpanish ? "Opcional" : "Optional"}
                      data-testid="input-insurance-admin-recipient"
                      className="min-h-[48px] rounded-[16px] border-[#DDD6FE] bg-white font-body text-[15px] font-semibold"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                      {selectedInsuranceAdminCopy.deadlineLabel}
                    </span>
                    <Input
                      value={insuranceAdminDetails.deadline}
                      onChange={(event) => setInsuranceAdminDetails((current) => ({ ...current, deadline: event.target.value }))}
                      placeholder={isSpanish ? "Opcional" : "Optional"}
                      data-testid="input-insurance-admin-deadline"
                      className="min-h-[48px] rounded-[16px] border-[#DDD6FE] bg-white font-body text-[15px] font-semibold"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                      {selectedInsuranceAdminCopy.notesLabel}
                    </span>
                    <Input
                      value={insuranceAdminDetails.notes}
                      onChange={(event) => setInsuranceAdminDetails((current) => ({ ...current, notes: event.target.value }))}
                      placeholder={isSpanish ? "Opcional" : "Optional"}
                      data-testid="input-insurance-admin-notes"
                      className="min-h-[48px] rounded-[16px] border-[#DDD6FE] bg-white font-body text-[15px] font-semibold"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={prepareSelectedInsuranceAdminTask}
                  className="vyva-tap mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#6B21A8] px-5 font-body text-[16px] font-black text-white shadow-[0_12px_26px_rgba(107,33,168,0.18)]"
                  data-testid="button-insurance-admin-prepare"
                >
                  <Send size={17} />
                  {isSpanish ? "Preparar para revisar" : "Prepare for review"}
                </button>
              </div>
            ) : null}
            <p className="rounded-[20px] bg-[#F8FAFC] px-4 py-3 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
              {isSpanish
                ? "Si falta una herramienta, VYVA prepara un resumen para revision en lugar de dejarte bloqueado."
                : "If a tool is missing, VYVA prepares a review summary instead of leaving you stuck."}
            </p>
          </div>
        </section>
      )}

      {scamCheckOpen && (
        <section
          className="relative z-20 order-[14] mt-4 scroll-mt-[88px] overflow-hidden rounded-[28px] border border-[#FECACA] bg-white"
          style={{ boxShadow: "0 18px 42px rgba(225,29,72,0.10)" }}
          data-testid="panel-scam-check"
        >
          <div className="bg-[#FFF1F2] p-4 lg:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-[#E11D48] shadow-sm">
                <AlertTriangle size={23} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#BE123C]">
                  {isSpanish ? "Revision segura" : "Safe check"}
                </p>
                <h2 className="mt-1 font-body text-[23px] font-black leading-tight text-vyva-text-1">
                  {isSpanish ? "Comprobar una posible estafa" : "Check a possible scam"}
                </h2>
                <p className="mt-2 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
                  {isSpanish
                    ? "Elige el tipo. VYVA prepara el siguiente paso y te pide confirmacion antes de actuar."
                    : "Choose the type. VYVA prepares the next step and asks before acting."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScamCheckOpen(false);
                  setSelectedScamCheckKind(null);
                  setScamCheckDetail("");
                }}
                className="vyva-tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#BE123C]"
                aria-label={isSpanish ? "Cerrar" : "Close"}
                data-testid="button-scam-check-close"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="space-y-3 p-4 lg:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {SCAM_CHECK_OPTIONS.map((option) => {
                const Icon = option.Icon;
                const readiness = scamCheckReadiness(option);
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleScamCheckChoice(option)}
                    className="vyva-tap flex min-h-[112px] items-start gap-3 rounded-[22px] border border-[#FECACA] bg-[#FFFCFC] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                    data-testid={`button-scam-check-${option.key}`}
                  >
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[17px] bg-white text-[#E11D48] shadow-sm">
                      <Icon size={22} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-body text-[16px] font-black leading-tight text-vyva-text-1">
                        {isSpanish ? option.es : option.en}
                      </span>
                      <span className="sr-only">
                        {isSpanish ? option.detailEs : option.detailEn}
                      </span>
                      <ActionReadinessPanel
                        readiness={readiness}
                        desiredAction={isSpanish ? option.es : option.en}
                        isSpanish={isSpanish}
                        compact
                        testId={`panel-scam-check-readiness-${option.key}`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedScamCheckOption && selectedScamCheckCopy ? (
              <div
                className="rounded-[24px] border border-[#FECACA] bg-[#FFF7F8] p-4"
                data-testid="panel-scam-check-guided-fields"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-[#BE123C] shadow-sm">
                    <SelectedScamCheckIcon size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-body text-[16px] font-black leading-tight text-vyva-text-1">
                      {isSpanish ? selectedScamCheckOption.es : selectedScamCheckOption.en}
                    </p>
                    <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                      {selectedScamCheckCopy.helper}
                    </p>
                  </div>
                </div>
                <label className="mt-4 block">
                  <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                    {selectedScamCheckCopy.label}
                  </span>
                  <textarea
                    value={scamCheckDetail}
                    onChange={(event) => setScamCheckDetail(event.target.value)}
                    placeholder={selectedScamCheckCopy.placeholder}
                    data-testid="input-scam-check-detail"
                    className="min-h-[82px] w-full rounded-[18px] border border-[#FECACA] bg-white px-4 py-3 font-body text-[15px] font-semibold text-vyva-text-1 shadow-sm outline-none focus:border-[#BE123C]"
                  />
                </label>
                <button
                  type="button"
                  onClick={prepareSelectedScamCheck}
                  className="vyva-tap mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#BE123C] px-5 font-body text-[16px] font-black text-white shadow-[0_12px_26px_rgba(190,18,60,0.16)]"
                  data-testid="button-scam-check-prepare"
                >
                  <ShieldCheck size={17} />
                  {isSpanish ? "Preparar revision segura" : "Prepare safe check"}
                </button>
              </div>
            ) : null}
            <p className="rounded-[20px] bg-[#F8FAFC] px-4 py-3 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
              {isSpanish
                ? "VYVA no hara clic, no enviara dinero y no compartira datos sin tu confirmacion."
                : "VYVA will not click links, send money, or share details without your confirmation."}
            </p>
          </div>
        </section>
      )}

      {otcPharmacyOpen && (
        <section
          className="relative z-20 order-[15] mt-4 scroll-mt-[88px] overflow-hidden rounded-[28px] border border-[#FED7AA] bg-white"
          style={{ boxShadow: "0 18px 42px rgba(180,83,9,0.12)" }}
          data-testid="panel-otc-pharmacy"
        >
          <div className="bg-[#FFF7ED] p-4 lg:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-[#B45309] shadow-sm">
                <Pill size={23} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#B45309]">
                  {isSpanish ? "Farmacia OTC" : "OTC pharmacy"}
                </p>
                <h2 className="mt-1 font-body text-[23px] font-black leading-tight text-vyva-text-1">
                  {hasSavedPharmacy
                    ? (isSpanish ? "Productos sin receta" : "Non-prescription items")
                    : (isSpanish ? "Guarda una farmacia primero" : "Save a pharmacy first")}
                </h2>
                <p className="mt-2 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
                  {isSpanish
                    ? "VYVA no gestiona medicinas con receta aqui."
                    : "VYVA does not handle prescription medicines here."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOtcPharmacyOpen(false)}
                className="vyva-tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#B45309]"
                aria-label={isSpanish ? "Cerrar" : "Close"}
                data-testid="button-otc-pharmacy-close"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {!hasSavedPharmacy ? (
            <div className="space-y-3 p-4 lg:p-5">
              <MissingProviderChoicePanel
                title={isSpanish ? "Servicio no activo todavia" : "Service not active yet"}
                body={isSpanish
                  ? "Para OTC, elige como quieres preparar una farmacia antes de pedir entrega o recogida."
                  : "For OTC help, choose how to prepare a pharmacy before delivery or pickup."}
                addLabel={isSpanish ? "Anadir mi farmacia" : "Add my usual pharmacy"}
                addDetail={isSpanish ? "Guardar para usarla primero" : "Save it for next time"}
                findLabel={isSpanish ? "Buscar opciones" : "Find options nearby"}
                findDetail={isSpanish ? "Revisar farmacias cercanas" : "Review nearby pharmacies"}
                helperLabel={isSpanish ? "Pedir ayuda" : "Ask someone to help"}
                helperDetail={isSpanish ? "Familia o cuidador" : "Family or caregiver setup"}
                onAddProvider={openOtcPharmacyProviderSetup}
                onFindOptions={findOtcPharmacyOptions}
                onAskHelper={() => openProviderSetupHelper("Ask trusted helper to set up a pharmacy", {
                  kind: "otc_pharmacy",
                  itemText: otcItemText.trim(),
                  fulfillmentPreference: otcFulfillmentPreference,
                  requestedTime: otcRequestedTime.trim() || "today",
                  notes: otcNotes.trim(),
                })}
                testId="panel-otc-missing-provider"
                addTestId="button-otc-pharmacy-setup"
                findTestId="button-otc-pharmacy-find-options"
                helperTestId="button-otc-pharmacy-ask-helper"
                isSpanish={isSpanish}
              />
            </div>
          ) : (
            <div className="space-y-3 p-4 lg:p-5">
              <div className="rounded-[22px] border border-[#FED7AA] bg-[#FFFCF8] p-4">
                <div className="flex items-start gap-3 rounded-[16px] bg-white px-3 py-2">
                  <CircleCheck size={17} className="mt-0.5 flex-shrink-0 text-[#B45309]" />
                  <p className="font-body text-[13px] font-black leading-snug text-vyva-text-1">
                    {isSpanish ? `Farmacia guardada: ${savedPharmacy || "Farmacia"}` : `Saved pharmacy: ${savedPharmacy || "Pharmacy"}`}
                  </p>
                </div>

                <ActionReadinessPanel
                  readiness={otcToolReadiness}
                  desiredAction={isSpanish ? "Preparar OTC" : "Prepare OTC request"}
                  recipient={savedPharmacy || (isSpanish ? "Farmacia guardada" : "Saved pharmacy")}
                  isSpanish={isSpanish}
                  compact
                  testId="panel-otc-pharmacy-readiness"
                />

                <label className="mt-4 block">
                  <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                    {isSpanish ? "Que necesitas" : "What do you need"}
                  </span>
                  <Input
                    value={otcItemText}
                    onChange={(event) => setOtcItemText(event.target.value)}
                    placeholder={isSpanish ? "Ej. vitaminas, tiritas, jarabe sin receta" : "E.g. vitamins, bandages, OTC cough syrup"}
                    data-testid="input-otc-pharmacy-item"
                    className="min-h-[56px] rounded-[18px] border-[#FED7AA] bg-white font-body text-[17px] font-semibold shadow-sm"
                  />
                </label>

                <div className="mt-2 flex flex-wrap gap-2">
                  {OTC_PHARMACY_ITEM_HINTS.map((hint) => (
                    <button
                      key={hint.value}
                      type="button"
                      onClick={() => setOtcItemText(hint.value)}
                      className="vyva-tap min-h-[38px] rounded-full border border-[#FED7AA] bg-white px-3 font-body text-[12px] font-black text-[#B45309]"
                      data-testid={`button-otc-item-${testIdSlug(hint.en)}`}
                    >
                      {isSpanish ? hint.es : hint.en}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                      {isSpanish ? "Como" : "How"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {OTC_PHARMACY_DELIVERY_OPTIONS.map((option) => {
                        const selected = otcFulfillmentPreference === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setOtcFulfillmentPreference(option.value)}
                            data-testid={`button-otc-fulfillment-${option.value}`}
                            className={`vyva-tap min-h-[40px] rounded-full border px-4 font-body text-[13px] font-black ${
                              selected ? "border-[#B45309] bg-[#FFF7ED] text-[#B45309]" : "border-[#FED7AA] bg-white text-vyva-text-2"
                            }`}
                          >
                            {isSpanish ? option.es : option.en}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block">
                      <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                        {isSpanish ? "Cuando" : "When"}
                      </span>
                      <Input
                        value={otcRequestedTime}
                        onChange={(event) => setOtcRequestedTime(event.target.value)}
                        placeholder={isSpanish ? "hoy, manana..." : "today, tomorrow..."}
                        data-testid="input-otc-pharmacy-time"
                        className="min-h-[48px] rounded-[16px] border-[#FED7AA] bg-white font-body text-[15px] font-semibold"
                      />
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {OTC_PHARMACY_TIME_HINTS.map((hint) => (
                        <button
                          key={hint.value}
                          type="button"
                          onClick={() => setOtcRequestedTime(hint.value)}
                          className="vyva-tap min-h-[34px] rounded-full border border-[#FED7AA] bg-white px-3 font-body text-[11px] font-black text-[#B45309]"
                        >
                          {isSpanish ? hint.es : hint.en}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                    {isSpanish ? "Marca, cantidad o nota" : "Brand, quantity, or note"}
                  </span>
                  <textarea
                    value={otcNotes}
                    onChange={(event) => setOtcNotes(event.target.value)}
                    placeholder={isSpanish ? "Opcional" : "Optional"}
                    data-testid="input-otc-pharmacy-notes"
                    className="min-h-[74px] w-full rounded-[18px] border border-[#FED7AA] bg-white px-4 py-3 font-body text-[15px] font-semibold text-vyva-text-1 shadow-sm outline-none focus:border-[#B45309]"
                  />
                </label>
              </div>

              {otcError ? (
                <p className="rounded-[18px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 font-body text-[13px] font-black text-[#B91C1C]">
                  {otcError}
                </p>
              ) : null}
              {otcNotice ? (
                <p className="rounded-[18px] border border-[#BBF7D0] bg-[#ECFDF5] px-3 py-2 font-body text-[13px] font-black text-[#047857]">
                  {otcNotice}
                </p>
              ) : null}

              <ActionConfirmationCheckpoint
                title={isSpanish ? "Confirmar primero" : "Confirm first"}
                summary={isSpanish
                  ? "VYVA prepara una solicitud OTC. No contacta ni compra nada todavia."
                  : "VYVA prepares an OTC request. Nothing is contacted or bought yet."}
                items={otcPharmacyConfirmation}
                primaryLabel={isSpanish ? "Confirmar: preparar OTC" : "Confirm: prepare OTC request"}
                onConfirm={() => prepareOtcPharmacyMutation.mutate()}
                isPending={prepareOtcPharmacyMutation.isPending}
                disabled={!canPrepareOtcPharmacy}
                testId="panel-otc-pharmacy-confirmation"
                buttonTestId="button-otc-pharmacy-prepare"
              />

              {otcPreparedResult?.pendingId ? (
                <div
                  className="rounded-[24px] border border-[#FED7AA] bg-[#FFFCF8] p-4"
                  data-testid="panel-otc-pharmacy-outcome"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#FFF7ED] text-[#B45309]">
                      <PackageCheck size={19} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-body text-[17px] font-black leading-tight text-vyva-text-1">
                        {isSpanish ? "Respuesta de farmacia" : "Pharmacy reply"}
                      </p>
                      <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                        {isSpanish
                          ? "Guarda solo productos OTC. Nada queda comprado aqui."
                          : "Save OTC details only. Nothing is purchased here."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                        {isSpanish ? "Disponibilidad" : "Availability"}
                      </span>
                      <Input
                        value={otcOutcomeForm.availability}
                        onChange={(event) => setOtcOutcomeForm((current) => ({ ...current, availability: event.target.value }))}
                        placeholder={isSpanish ? "Ej. disponible manana" : "E.g. available tomorrow"}
                        data-testid="input-otc-outcome-availability"
                        className="min-h-[48px] rounded-[16px] border-[#FED7AA] bg-white font-body text-[15px] font-semibold"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                        {isSpanish ? "Coste" : "Cost"}
                      </span>
                      <Input
                        value={otcOutcomeForm.costEstimate}
                        onChange={(event) => setOtcOutcomeForm((current) => ({ ...current, costEstimate: event.target.value }))}
                        placeholder={isSpanish ? "Ej. EUR12" : "E.g. EUR12"}
                        data-testid="input-otc-outcome-cost"
                        className="min-h-[48px] rounded-[16px] border-[#FED7AA] bg-white font-body text-[15px] font-semibold"
                      />
                    </label>
                  </div>

                  <label className="mt-3 block">
                    <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                      {isSpanish ? "Entrega o recogida" : "Pickup or delivery"}
                    </span>
                    <Input
                      value={otcOutcomeForm.fulfillmentNote}
                      onChange={(event) => setOtcOutcomeForm((current) => ({ ...current, fulfillmentNote: event.target.value }))}
                      placeholder={isSpanish ? "Ej. recoger despues de las 17:00" : "E.g. pickup after 5pm"}
                      data-testid="input-otc-outcome-fulfillment"
                      className="min-h-[48px] rounded-[16px] border-[#FED7AA] bg-white font-body text-[15px] font-semibold"
                    />
                  </label>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                        {isSpanish ? "Referencia" : "Reference"}
                      </span>
                      <Input
                        value={otcOutcomeForm.reference}
                        onChange={(event) => setOtcOutcomeForm((current) => ({ ...current, reference: event.target.value }))}
                        placeholder={isSpanish ? "Opcional" : "Optional"}
                        data-testid="input-otc-outcome-reference"
                        className="min-h-[48px] rounded-[16px] border-[#FED7AA] bg-white font-body text-[15px] font-semibold"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                        {isSpanish ? "Nota" : "Note"}
                      </span>
                      <Input
                        value={otcOutcomeForm.notes}
                        onChange={(event) => setOtcOutcomeForm((current) => ({ ...current, notes: event.target.value }))}
                        placeholder={isSpanish ? "Opcional" : "Optional"}
                        data-testid="input-otc-outcome-notes"
                        className="min-h-[48px] rounded-[16px] border-[#FED7AA] bg-white font-body text-[15px] font-semibold"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => saveOtcPharmacyOutcomeMutation.mutate()}
                    disabled={!canSaveOtcOutcome || saveOtcPharmacyOutcomeMutation.isPending}
                    data-testid="button-otc-outcome-save"
                    className="vyva-tap mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#B45309] px-5 font-body text-[16px] font-black text-white shadow-[0_12px_26px_rgba(180,83,9,0.18)] disabled:opacity-60"
                  >
                    {saveOtcPharmacyOutcomeMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <CircleCheck size={18} />}
                    {isSpanish ? "Guardar y cerrar tarea" : "Save and close task"}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      )}

      {usesLegacyRideVoiceCanvas && (
        <section
          className="order-[15] mt-4 flex justify-center rounded-[28px] bg-[#F8F4FA] p-2 sm:p-4"
          data-testid="panel-concierge-ride-voice-canvas"
        >
          <RideVoiceCanvas
            copy={legacyRideCanvasCopy}
            places={rideCanvasPlaces}
            providers={rideCanvasProviders}
            dateChoices={rideCanvasDates}
            voiceCommands={rideCanvasCommands}
            initialState={rideCanvasInitialState}
            storageKey={`vyva.rideCanvas.concierge.${conciergeVoiceAction?.id ?? "active"}`}
            onConfirmRide={confirmRideCanvas}
            onDone={() => setRoutePrefill(null)}
            onCancel={() => setRoutePrefill(null)}
            onTelemetry={trackRideCanvasEvent}
          />
        </section>
      )}

      {routePrefill?.kind === "ride" && (!isVoiceRideHandoff || !usesLegacyRideVoiceCanvas) && routePrefillMeta && (
        <section
          className="relative z-20 order-[15] mt-4 scroll-mt-[88px] overflow-hidden rounded-[28px] border border-[#BBF7D0] bg-white"
          style={{ boxShadow: "0 18px 42px rgba(4,120,87,0.14)" }}
          data-testid="panel-concierge-route-prefill"
        >
          <div className="bg-[linear-gradient(135deg,#0F9F6E_0%,#047857_100%)] p-4 text-white" data-testid="panel-concierge-transport">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white/18 text-white shadow-sm">
                <Car size={23} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#BBF7D0]">
                  {isSpanish ? "Transporte" : "Transport"}
                </p>
                <h2 className="mt-1 font-body text-[23px] font-black leading-tight">
                  {routePrefillMeta.title}
                </h2>
                <p className="mt-2 font-body text-[15px] font-bold leading-snug text-white/88">
                  {routePrefillMeta.detail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoutePrefill(null)}
                className="vyva-tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/14 text-white"
                aria-label={isSpanish ? "Cerrar" : "Close"}
              >
                <X size={17} />
              </button>
            </div>
          </div>
          <div className="space-y-3 p-4 lg:p-5">
            <div className="relative z-10 overflow-hidden rounded-[24px] border border-[#BBF7D0] bg-[#FFFCF8]">
              <div className="p-4 lg:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#047857]">
                    <ShieldCheck size={21} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-body text-[19px] font-black leading-tight text-vyva-text-1">
                      {isSpanish ? "Solo dime a donde vas." : "Where are you going?"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-[18px] border border-[#BBF7D0] bg-[#F0FDF4] p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 font-body text-[14px] font-black leading-snug text-vyva-text-1">
                      <span className="text-[#047857]">{isSpanish ? "Desde" : "From"}:</span>{" "}
                      <span className="truncate">{transportPickup.trim() || savedTransportPickupLabel}</span>
                      <span className="px-2 text-[#047857]">•</span>
                      <span className="text-[#047857]">{isSpanish ? "Hora" : "When"}:</span>{" "}
                      <span>{transportTime.trim() || (isSpanish ? "ahora" : "now")}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setTransportDetailsOpen((open) => !open)}
                      className="vyva-tap inline-flex min-h-[40px] flex-shrink-0 items-center justify-center gap-2 rounded-full border border-[#BBF7D0] bg-white px-4 font-body text-[13px] font-black text-[#047857]"
                    >
                      {transportDetailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {transportDetailsOpen
                        ? (isSpanish ? "Ocultar" : "Hide")
                        : (isSpanish ? "Cambiar" : "Change")}
                    </button>
                  </div>
                  {transportMobilityNeeds.length > 0 && !transportDetailsOpen ? (
                    <p className="mt-2 font-body text-[12px] font-black text-[#047857]">
                      {isSpanish ? "Ayuda: " : "Help: "}{transportMobilityNeeds.join(", ")}
                    </p>
                  ) : null}
                </div>

                <div
                  className="mt-3 rounded-[18px] border border-[#BBF7D0] bg-white px-3 py-2"
                  data-testid="note-transport-provider-readiness"
                >
                  <div className="flex items-start gap-2">
                    <CircleCheck size={17} className="mt-0.5 flex-shrink-0 text-[#047857]" />
                    <p className="font-body text-[13px] font-black leading-snug text-vyva-text-1">
                      {hasSavedTransportProvider
                        ? (
                          savedTransportProvider
                            ? (isSpanish ? `Primero: ${savedTransportProvider}.` : `Saved provider first: ${savedTransportProvider}.`)
                            : (isSpanish ? "Primero revisamos tu proveedor guardado." : "Saved provider is checked first.")
                        )
                        : (isSpanish ? "Sin proveedor de confianza elegido. Anade o elige uno para continuar." : "No trusted provider selected. Add or choose one to continue.")}
                    </p>
                  </div>
                </div>

                {!hasSavedTransportProvider ? (
                  <div className="mt-3">
                    <MissingProviderChoicePanel
                      title={isSpanish ? "Elige como continuar" : "Choose how to continue"}
                      body={isSpanish
                        ? "Puedes guardar tu transporte habitual, buscar opciones cercanas o pedir ayuda para configurarlo."
                        : "You can save your usual transport, find nearby options, or ask someone trusted to help set it up."}
                      addLabel={isSpanish ? "Anadir mi transporte" : "Add my usual provider"}
                      addDetail={isSpanish ? "Taxi o transporte preferido" : "Taxi or preferred ride"}
                      findLabel={isSpanish ? "Buscar opciones" : "Find options nearby"}
                      findDetail={isSpanish ? "Comparar antes de contactar" : "Compare before contact"}
                      helperLabel={isSpanish ? "Pedir ayuda" : "Ask someone to help"}
                      helperDetail={isSpanish ? "Familia o cuidador" : "Family or caregiver setup"}
                      onAddProvider={openTransportProviderSetup}
                      onFindOptions={findTransportProviderOptions}
                      onAskHelper={() => openProviderSetupHelper("Ask trusted helper to set up transport", {
                        kind: "transport",
                        pickup: transportPickup.trim() || savedTransportPickupLabel,
                        destination: transportDestination.trim(),
                        time: transportTime.trim() || "now",
                        mobilityNeeds: transportMobilityNeeds,
                      })}
                      testId="panel-transport-missing-provider"
                      addTestId="button-transport-provider-setup"
                      findTestId="button-transport-provider-find-options"
                      helperTestId="button-transport-provider-ask-helper"
                      isSpanish={isSpanish}
                    />
                  </div>
                ) : null}

                <ActionReadinessPanel
                  readiness={transportToolReadiness}
                  desiredAction={isSpanish ? "Preparar transporte" : "Prepare ride"}
                  recipient={savedTransportProvider || (isSpanish ? "Opciones seguras" : "Safe ride options")}
                  isSpanish={isSpanish}
                  compact
                  testId="panel-transport-readiness"
                />

                <div className="mt-4">
                  <label className="block">
                    <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                      {isSpanish ? "Destino" : "Destination"}
                    </span>
                    <Input
                      value={transportDestination}
                      onChange={(event) => setTransportDestination(event.target.value)}
                      placeholder={isSpanish ? "Clinica, farmacia o direccion" : "Clinic, pharmacy, or address"}
                      data-testid="input-transport-destination"
                      className="min-h-[56px] rounded-[18px] border-[#D6F5DF] bg-white font-body text-[17px] font-semibold shadow-sm"
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TRANSPORT_DESTINATION_HINTS.map((hint) => (
                      <button
                        key={hint.value}
                        type="button"
                        onClick={() => setTransportDestination(hint.value)}
                        className="vyva-tap min-h-[38px] rounded-full border border-[#BBF7D0] bg-white px-3 font-body text-[12px] font-black text-[#047857]"
                      >
                        {isSpanish ? hint.es : hint.en}
                      </button>
                    ))}
                  </div>
                </div>

                {transportDetailsOpen ? (
                  <div className="mt-4 rounded-[20px] border border-[#E8DED4] bg-white p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                          {isSpanish ? "Recogida" : "Pickup"}
                        </span>
                        <div className="relative">
                          <Input
                            value={transportPickup}
                            onChange={(event) => setTransportPickup(event.target.value)}
                            placeholder={isSpanish ? "Casa, hotel o recogida" : "Home, hotel, or pickup"}
                            data-testid="input-transport-pickup"
                            className="min-h-[50px] rounded-[16px] border-[#E8DED4] bg-[#FFFCF8] pr-[82px] font-body text-[16px] font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => setTransportPickup(savedTransportPickupLabel)}
                            className="vyva-tap absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[#ECFDF5] px-3 py-1.5 font-body text-[11px] font-black text-[#047857]"
                          >
                            {isSpanish ? "Casa" : "Home"}
                          </button>
                        </div>
                      </label>

                      <div>
                        <label className="block">
                          <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                            {isSpanish ? "Hora" : "When"}
                          </span>
                          <Input
                            value={transportTime}
                            onChange={(event) => setTransportTime(event.target.value)}
                            placeholder={isSpanish ? "ahora, manana..." : "now, tomorrow..."}
                            data-testid="input-transport-time"
                            className="min-h-[50px] rounded-[16px] border-[#E8DED4] bg-[#FFFCF8] font-body text-[16px] font-semibold"
                          />
                        </label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {TRANSPORT_TIME_HINTS.map((hint) => {
                            const selected = transportTime.trim().toLowerCase() === hint.value.toLowerCase();
                            return (
                              <button
                                key={hint.value}
                                type="button"
                                onClick={() => setTransportTime(hint.value)}
                                className={`vyva-tap min-h-[36px] rounded-full border px-3 font-body text-[12px] font-black ${
                                  selected
                                    ? "border-[#047857] bg-[#ECFDF5] text-[#047857]"
                                    : "border-[#E8DED4] bg-white text-vyva-text-2"
                                }`}
                              >
                                {isSpanish ? hint.es : hint.en}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-[#F0E6DB] pt-3">
                      {shouldAskTransportMobility ? (
                        <>
                          <p className="font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                            {isSpanish ? "Ayuda al subir o bajar" : "Help getting in or out"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {TRANSPORT_MOBILITY_NEEDS.map((need) => {
                              const selected = transportMobilityNeeds.includes(need.value);
                              return (
                                <button
                                  key={need.value}
                                  type="button"
                                  data-testid={`button-transport-need-${testIdSlug(need.value)}`}
                                  onClick={() => setTransportMobilityNeeds((current) => (
                                    current.includes(need.value)
                                      ? current.filter((item) => item !== need.value)
                                      : [...current, need.value]
                                  ))}
                                  className={`vyva-tap inline-flex min-h-[38px] items-center gap-2 rounded-full border px-3 font-body text-[12px] font-black ${
                                    selected
                                      ? "border-[#047857] bg-[#ECFDF5] text-[#047857]"
                                      : "border-[#E8DED4] bg-[#FFFCF8] text-vyva-text-2"
                                  }`}
                                >
                                  {selected ? <CircleCheck size={15} /> : null}
                                  <span>{isSpanish ? need.es : need.en}</span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div
                          className="rounded-[16px] border border-[#BBF7D0] bg-[#ECFDF5] px-3 py-2"
                          data-testid="note-transport-mobility-readiness"
                        >
                          <div className="flex items-start gap-2">
                            <CircleCheck size={16} className="mt-0.5 flex-shrink-0 text-[#047857]" />
                            <div className="min-w-0">
                              <p className="font-body text-[13px] font-black leading-snug text-[#047857]">
                                {isSpanish ? "Movilidad guardada en tu perfil." : "Mobility preferences saved in your profile."}
                              </p>
                              <p className="mt-0.5 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
                                {transportMobilityNeeds.length > 0
                                  ? (isSpanish ? `Hoy: ${transportMobilityNeeds.join(", ")}` : `Today: ${transportMobilityNeeds.join(", ")}`)
                                  : (isSpanish ? "Dile a VYVA si hoy es diferente." : "Tell VYVA if today is different.")}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-[#E8DED4] bg-white p-4 lg:px-5">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasSavedTransportProvider) {
                        openTransportProviderSetup();
                        return;
                      }
                      transportOptionsMutation.mutate();
                    }}
                    disabled={transportOptionsMutation.isPending || (hasSavedTransportProvider && !canFindTransportOptions)}
                    data-testid="button-transport-find-options"
                    className="vyva-tap inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-full bg-[#047857] px-5 font-body text-[17px] font-black text-white shadow-[0_12px_26px_rgba(4,120,87,0.22)] disabled:opacity-60"
                  >
                    {transportOptionsMutation.isPending
                      ? <Loader2 size={18} className="animate-spin" />
                      : hasSavedTransportProvider ? <Search size={18} /> : <ShieldCheck size={18} />}
                    {!hasSavedTransportProvider
                      ? (isSpanish ? "Anadir o elegir transporte" : "Add or choose transport")
                      : (isSpanish ? "Comparar viajes seguros" : "Compare safe rides")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInput(routePrefill.message);
                      setRoutePrefill(null);
                    }}
                    className="vyva-tap inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border border-[#BBF7D0] bg-white px-4 font-body text-[14px] font-black text-[#047857]"
                  >
                    <PencilLine size={16} />
                    {isSpanish ? "Usar chat" : "Use chat"}
                  </button>
                </div>
                {!transportResult ? (
                  <p className="mt-3 rounded-full bg-[#ECFDF5] px-4 py-2 text-center font-body text-[12px] font-black text-[#047857]">
                    {!hasSavedTransportProvider
                      ? (isSpanish ? "Guarda un proveedor primero. Nada se contacta sin confirmar." : "Save a provider first. Nothing is contacted without confirmation.")
                      : !hasTransportDestination
                        ? (isSpanish ? "Primero dime a donde ir." : "Tell VYVA where to go first.")
                      : (isSpanish ? "Nada se reserva ni se contacta sin tu confirmacion." : "Nothing is booked or requested without your confirmation.")}
                  </p>
                ) : null}
              </div>
            </div>

            {transportError ? (
              <p className="mt-3 rounded-[18px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 font-body text-[13px] font-black text-[#B91C1C]">
                {transportError}
              </p>
            ) : null}
            {transportNotice ? (
              <p className="mt-3 rounded-[18px] border border-[#BBF7D0] bg-[#ECFDF5] px-3 py-2 font-body text-[13px] font-black text-[#047857]">
                {transportNotice}
              </p>
            ) : null}

            {transportResult ? (
              <div className="mt-4 space-y-3" data-testid="transport-options-list">
                {transportResult.fallbackReason ? (
                  <p className="rounded-[18px] bg-[#FFF7ED] px-3 py-2 font-body text-[13px] font-bold text-[#9A3412]">
                    {isSpanish ? "Si falta algun dato, VYVA aun puede preparar una opcion manual." : "If a detail is missing, VYVA can still prepare a manual option."}
                  </p>
                ) : null}
                {[...transportResult.options]
                  .sort((left, right) => Number(right.kind === "saved_provider") - Number(left.kind === "saved_provider"))
                  .map((option) => {
                  const href = phoneHref(option.phone);
                  const canPrepare = option.actions.includes("start_concierge_action");
                  const toolReadiness = evaluateConciergeToolReadiness({
                    flowReference: TRANSPORT_BOOKING_FLOW_REFERENCE,
                    requestedTool: preferredToolForTransportOption(option),
                    provider: {
                      phone: option.phone,
                      email: option.email,
                      whatsapp: option.whatsapp,
                      booking_url: option.bookingUrl,
                      url: option.url,
                      actions: option.actions,
                      providerName: option.providerName,
                      name: option.label,
                    },
                  });
                  const confirmationItems = transportConfirmationItems({
                    option,
                    pickupAddress: transportPickup,
                    destinationAddress: transportDestination,
                    requestedTime: transportTime,
                    mobilityNeeds: transportMobilityNeeds,
                    hasSavedMobilityInfo: hasSavedTransportMobilityInfo,
                    hasSavedTransportProvider,
                    savedProviderName: savedTransportProvider,
                    toolReadiness,
                    isSpanish,
                  });
                  return (
                    <article
                      key={option.id}
                      data-testid={`card-transport-option-${option.id}`}
                      className="rounded-[22px] border border-[#E8DED4] bg-[#FFFCF8] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#047857]">
                          {option.kind === "ride_app" ? <ExternalLink size={20} /> : <Car size={20} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block font-body text-[17px] font-black leading-tight text-vyva-text-1">
                            {option.label}
                          </strong>
                          <span className="mt-1 block font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                            {option.description}
                          </span>
                        </span>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        {option.url ? (
                          <a
                            href={option.url}
                            target="_blank"
                            rel="noreferrer"
                            data-testid={`link-transport-open-${option.id}`}
                            className="vyva-tap inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full border border-[#BBF7D0] bg-white px-4 font-body text-[15px] font-black text-[#047857]"
                          >
                            <ExternalLink size={16} />
                            {isSpanish ? "Abrir opcion" : "Open option"}
                          </a>
                        ) : null}
                        {href ? (
                          <a
                            href={href}
                            data-testid={`link-transport-call-${option.id}`}
                            className="vyva-tap inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full border border-[#BFDBFE] bg-white px-4 font-body text-[15px] font-black text-[#2563EB]"
                          >
                            <PhoneCall size={16} />
                            {isSpanish ? "Llamar" : "Call"}
                          </a>
                        ) : null}
                      </div>
                      {canPrepare ? (
                        <div className="mt-3">
                          <ActionConfirmationCheckpoint
                            title={isSpanish ? "Confirmar primero" : "Confirm first"}
                            summary={isSpanish
                              ? "VYVA prepara este viaje. Aun no reserva ni contacta."
                              : "VYVA prepares this ride. Nothing is booked or requested yet."}
                            items={confirmationItems}
                            primaryLabel={isSpanish ? "Confirmar: preparar viaje" : "Confirm: prepare ride"}
                            onConfirm={() => prepareTransportMutation.mutate(option)}
                            isPending={prepareTransportMutation.isPending}
                            disabled={!hasTransportDestination}
                            testId={`panel-transport-confirm-${option.id}`}
                            buttonTestId={`button-transport-prepare-${option.id}`}
                          />
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {transportPreparedOption ? (
                  <FinalConfirmationCard
                    title={isSpanish ? "Revisar y confirmar viaje" : "Review and confirm ride"}
                    body={isSpanish
                      ? "Cuando el proveedor confirme, guarda aqui hora, precio o referencia."
                      : "When the provider confirms, save the time, price, or reference here."}
                    providerName={transportPreparedOption.providerName || transportPreparedOption.label}
                    icon={Car}
                    fields={[
                      {
                        key: "scheduledFor",
                        label: isSpanish ? "Recogida confirmada" : "Confirmed pickup",
                        value: transportFinalForm.scheduledFor,
                        onChange: (value) => setTransportFinalForm((current) => ({ ...current, scheduledFor: value })),
                        type: "datetime-local",
                        testId: "input-transport-confirmed-time",
                      },
                      {
                        key: "priceEstimate",
                        label: isSpanish ? "Precio" : "Price",
                        value: transportFinalForm.priceEstimate,
                        onChange: (value) => setTransportFinalForm((current) => ({ ...current, priceEstimate: value })),
                        placeholder: isSpanish ? "Ej. 18 EUR" : "E.g. EUR18",
                        testId: "input-transport-confirmed-price",
                      },
                      {
                        key: "pickup",
                        label: isSpanish ? "Desde" : "Pickup",
                        value: transportFinalForm.pickup,
                        onChange: (value) => setTransportFinalForm((current) => ({ ...current, pickup: value })),
                        placeholder: transportPickup.trim() || savedTransportPickupLabel,
                        testId: "input-transport-confirmed-pickup",
                      },
                      {
                        key: "destination",
                        label: isSpanish ? "Destino" : "Destination",
                        value: transportFinalForm.destination,
                        onChange: (value) => setTransportFinalForm((current) => ({ ...current, destination: value })),
                        placeholder: transportDestination,
                        testId: "input-transport-confirmed-destination",
                      },
                      {
                        key: "providerReply",
                        label: isSpanish ? "Respuesta del proveedor" : "Provider reply",
                        value: transportFinalForm.providerReply,
                        onChange: (value) => setTransportFinalForm((current) => ({ ...current, providerReply: value })),
                        placeholder: isSpanish ? "Ej. Confirmado, llega a las 09:30." : "E.g. Confirmed, arrives at 09:30.",
                        multiline: true,
                        testId: "input-transport-provider-reply",
                      },
                      {
                        key: "bookingReference",
                        label: isSpanish ? "Referencia" : "Reference",
                        value: transportFinalForm.bookingReference,
                        onChange: (value) => setTransportFinalForm((current) => ({ ...current, bookingReference: value })),
                        placeholder: isSpanish ? "Opcional" : "Optional",
                        testId: "input-transport-confirmed-reference",
                      },
                      {
                        key: "notes",
                        label: isSpanish ? "Nota" : "Note",
                        value: transportFinalForm.notes,
                        onChange: (value) => setTransportFinalForm((current) => ({ ...current, notes: value })),
                        placeholder: isSpanish ? "Opcional" : "Optional",
                        testId: "input-transport-confirmed-note",
                      },
                    ]}
                    primaryLabel={isSpanish ? "Guardar viaje confirmado" : "Save confirmed ride"}
                    secondaryLabel={isSpanish ? "Cambiar" : "Change"}
                    onPrimary={handleSaveConfirmedRide}
                    onSecondary={handleReviseConfirmedRide}
                    primaryPending={saveTransportRideMutation.isPending}
                    testId="panel-transport-final-review"
                    primaryTestId="button-transport-save-confirmed-ride"
                    secondaryTestId="button-transport-revise-confirmed-ride"
                    isSpanish={isSpanish}
                  />
                ) : null}
                <p className="rounded-full bg-[#ECFDF5] px-3 py-2 text-center font-body text-[13px] font-black text-[#047857]">
                  {transportResult.disclaimers[2] ?? (isSpanish ? "Nada se reserva sin tu confirmacion." : "Nothing is booked without your confirmation.")}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {usesAppointmentVoiceCanvas && (
        <section className="order-[15] mt-4 flex justify-center rounded-[28px] bg-[#F8F4FA] p-2 sm:p-4" data-testid="panel-concierge-appointment-voice-canvas">
          <AppointmentVoiceCanvas copy={appointmentVoiceCanvasCopy} providers={appointmentCanvasProviders} dateChoices={appointmentCanvasDates} voiceCommands={appointmentCanvasCommands} initialState={appointmentCanvasInitialState} storageKey={`vyva.appointmentCanvas.concierge.${conciergeVoiceAction?.id??"active"}`} onConfirmPrepare={confirmAppointmentCanvas} onDone={()=>setRoutePrefill(null)} onCancel={()=>setRoutePrefill(null)} onTelemetry={trackAppointmentCanvasEvent}/>
        </section>
      )}
      {routePrefill && routePrefill.kind !== "ride" && !usesAppointmentVoiceCanvas && routePrefillMeta && (
        <section
          className="order-[15] mt-4 overflow-hidden rounded-[28px] border border-[#D8B4FE] bg-white"
          style={{ boxShadow: "0 18px 42px rgba(107,33,168,0.16)" }}
          data-testid="panel-concierge-route-prefill"
        >
          <PurpleModalHeader
            Icon={routePrefillMeta.Icon}
            kicker={isSpanish ? "Revisar primero" : "Review first"}
            title={routePrefillMeta.title}
            subtitle={routePrefillMeta.detail}
            onClose={() => {
              setRoutePrefill(null);
              setRoutePrefillError(null);
            }}
            closeLabel={isSpanish ? "Cerrar" : "Close"}
          />
          <div className="p-4">
            {routePrefillReadiness ? (
              <ActionReadinessPanel
                readiness={routePrefillReadiness}
                desiredAction={routePrefillTaskActionLabel(routePrefillReadiness.requestedTool, isSpanish, routePrefill.actionLabel)}
                recipient={isSpanish ? "Antes de actuar" : "Before action"}
                isSpanish={isSpanish}
                compact
                testId="panel-route-prefill-readiness"
              />
            ) : null}
            {routePrefillError ? (
              <p className="mb-3 rounded-[16px] bg-[#FEF2F2] px-3 py-2 font-body text-[13px] font-black leading-snug text-[#B91C1C]" data-testid="error-route-prefill">
                {routePrefillError}
              </p>
            ) : null}
            <div className="rounded-[22px] border border-[#E9D5FF] bg-[#FBF8FF] p-3">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-text-3">
                {isSpanish ? "Detalles clave" : "Key details"}
              </p>
              <div className="mt-2 grid gap-2">
                {routePrefillHighlights.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="flex flex-col gap-0.5 rounded-[16px] bg-white px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                    <span className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-vyva-text-3 sm:w-24">
                      {item.label}
                    </span>
                    <span className="font-body text-[15px] font-bold leading-snug text-vyva-text-1">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={sendPrefillToConcierge}
                disabled={chatLoading || prepareToolGatedTaskMutation.isPending}
                data-testid="button-concierge-prefill-send"
                className="vyva-tap inline-flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-full bg-vyva-purple px-5 font-body text-[17px] font-black text-white shadow-[0_12px_26px_rgba(107,33,168,0.22)] disabled:opacity-60"
              >
                {chatLoading || prepareToolGatedTaskMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {routePrefillMeta.primaryLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (routePrefill.kind === "appointment") {
                    openAppointmentAssistant();
                    return;
                  }
                  setInput(routePrefill.message);
                  setRoutePrefill(null);
                  setRoutePrefillError(null);
                }}
                className="vyva-tap inline-flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-full border border-[#D8B4FE] bg-white px-5 font-body text-[17px] font-black text-vyva-purple"
              >
                <PencilLine size={18} />
                {routePrefillMeta.secondaryLabel}
              </button>
            </div>
            <p className="mt-3 rounded-full bg-[#ECFDF5] px-3 py-2 text-center font-body text-[13px] font-black text-[#047857]">
              {routePrefillSafetyCopy}
            </p>
          </div>
        </section>
      )}

      {conciergeVoiceAction && (
        <section
          className="order-[15] mt-4 rounded-[24px] border border-[#99F6E4] bg-[#F0FDFA] p-4"
          style={{ boxShadow: "0 12px 32px rgba(15,118,110,0.12)" }}
          data-testid="panel-voice-concierge-prefill"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-[#0F766E]">
              <Calendar size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#0F766E]">
                {isSpanish ? "Borrador preparado" : "Draft prepared"}
              </p>
              <h2 className="mt-1 font-body text-[17px] font-extrabold leading-tight text-vyva-text-1">
                {conciergeVoiceAction.title}
              </h2>
              <p className="mt-1 font-body text-[14px] leading-[1.45] text-vyva-text-2">
                {conciergeVoiceDraft}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {conciergeVoiceTaskType && (
              <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-[#0F766E]">
                {isSpanish ? "Tipo" : "Type"}: {conciergeVoiceTaskType}
              </span>
            )}
            {conciergeVoiceProvider && (
              <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-vyva-text-2">
                {isSpanish ? "Proveedor" : "Provider"}: {conciergeVoiceProvider}
              </span>
            )}
            {conciergeVoiceDate && (
              <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-vyva-text-2">
                {isSpanish ? "Fecha" : "Date"}: {conciergeVoiceDate}
              </span>
            )}
            {conciergeVoiceLocation && (
              <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-vyva-text-2">
                {isSpanish ? "Zona" : "Location"}: {conciergeVoiceLocation}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setInput(conciergeVoiceDraft);
              scrollIntoViewIfAvailable(chatSectionRef.current, { behavior: "smooth", block: "start" });
            }}
            className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#0F766E] px-4 font-body text-[15px] font-bold text-white transition active:scale-[0.98]"
          >
            <PencilLine size={18} />
            {isSpanish ? "Usar este borrador" : "Use this draft"}
          </button>
        </section>
      )}

      {(mode !== "task" || activeAction) ? <section
        ref={rightNowSectionRef}
        className="order-[20] mt-5"
        data-testid={mode === "task" && activeActionNeedsUserConfirmation
          ? "concierge-task-confirmation-screen"
          : "section-concierge-active-task"}
      >
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="vyva-section-title">
            {mode === "task"
              ? activeActionNeedsUserConfirmation
                ? (isSpanish ? "Confirma esta tarea" : "Confirm this task")
                : (isSpanish ? "Detalle de la tarea" : "Task details")
              : (isSpanish ? "Ahora mismo" : "Right now")}
          </h2>
          {queuedActionCount > 0 && (
            <button
              type="button"
              onClick={showNextQueuedAction}
              className="vyva-tap rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[12px] font-semibold text-vyva-purple"
              aria-label={isSpanish ? "Mostrar siguiente accion en cola" : "Show next queued action"}
            >
              +{queuedActionCount} {isSpanish ? "en cola" : "queued"}
            </button>
          )}
        </div>

        {recentEmailDraftCompletionNotice ? (
          <p data-testid="email-draft-notice" className="mb-3 rounded-[14px] bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]">
            {recentEmailDraftCompletionNotice}
          </p>
        ) : null}

        {pendingLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 size={16} className="animate-spin text-vyva-purple" />
            <span className="font-body text-[13px] text-vyva-text-2">
              {isSpanish ? "Buscando acciones activas..." : "Looking for active actions..."}
            </span>
          </div>
        ) : !activeAction ? (
          <div
            className="vyva-card p-[18px]"
            style={{ boxShadow: "0 10px 30px rgba(107,33,168,0.08)" }}
          >
            <div className="flex items-start gap-4">
              <div className="w-[48px] h-[48px] rounded-[16px] flex items-center justify-center bg-[#F5F3FF]">
                <Sparkles size={22} style={{ color: "#6B21A8" }} />
              </div>
              <div className="flex-1">
                <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                  {isSpanish ? "Sin tareas pendientes" : "No pending tasks"}
                </p>
                <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                  {isSpanish
                    ? "Cuando VYVA prepare una llamada, reserva o gestion, aparecera aqui para que la confirmes."
                    : "When VYVA prepares a call, booking, or task, it will appear here for your confirmation."}
                </p>
              </div>
            </div>
          </div>
        ) : isRightNowHidden && activeAction ? (
          <button
            type="button"
            onClick={() => setIsRightNowHidden(false)}
            className="vyva-tap flex w-full items-center justify-between gap-4 rounded-[22px] border border-vyva-border bg-[#FFFCF8] p-4 text-left"
            style={{ boxShadow: "0 10px 28px rgba(60,38,20,0.08)" }}
            data-testid="button-concierge-show-right-now"
          >
            <div>
              <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                {isSpanish ? "Tarjeta oculta" : "Card hidden"}
              </p>
              <p className="sr-only">
                {isSpanish ? "Toca para volver a verla." : "Tap to show it again."}
              </p>
            </div>
            <span className="rounded-full bg-[#F5F3FF] px-4 py-2 font-body text-[13px] font-semibold text-vyva-purple">
              {isSpanish ? "Mostrar" : "Show"}
            </span>
          </button>
        ) : (
          <div
            className="vyva-card p-[18px]"
            style={{ boxShadow: "0 14px 38px rgba(107,33,168,0.12)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[12px] uppercase tracking-[0.12em] text-vyva-text-2">
                  {activeActionShowVyvaPrepared
                    ? (isSpanish ? "VYVA lo preparo" : "VYVA prepared this")
                    : getPendingActionUseCaseLabel(activeAction, locale)}
                </p>
                <p className="mt-1 font-body text-[20px] font-semibold leading-tight text-vyva-text-1">
                  {activeActionShowVyvaPrepared
                    ? activeActionShowVyvaTask
                    : activeAction.provider_name || (isSpanish ? "Proveedor seleccionado" : "Selected provider")}
                </p>
                {activeActionShowVyvaPrepared && activeActionShowVyvaSource ? (
                  <p className="mt-1 font-body text-[13px] font-black leading-tight text-[#0F766E]">
                    {activeActionShowVyvaSource}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {activeActionIsDryRun ? (
                  <span
                    className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-black text-emerald-800"
                    data-testid={`badge-concierge-dry-run-${activeAction.id}`}
                  >
                    {isSpanish ? "Modo prueba" : "Test mode"}
                  </span>
                ) : null}
                <span
                  className="rounded-full px-3 py-1 text-[12px] font-medium"
                  style={{
                    background: activeAction.status === "calling" ? "#F5F3FF" : "#F3F4F6",
                    color: activeAction.status === "calling" ? "#6B21A8" : "#374151",
                  }}
                >
                  {statusLabel(activeAction.status, locale)}
                </span>
                {activeActionCanvasCopy ? (
                  <span
                    className="rounded-full border border-[#BFE7E1] bg-[#F0FDFA] px-3 py-1 font-body text-[12px] font-black text-[#0F766E]"
                    data-testid={`badge-concierge-canvas-state-${activeAction.id}`}
                    title={activeActionCanvasState?.reason}
                  >
                    {activeActionCanvasCopy.stateLabel}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsRightNowHidden(true)}
                  className="vyva-tap flex h-9 w-9 items-center justify-center rounded-full border border-vyva-border bg-white text-vyva-text-2"
                  aria-label={isSpanish ? "Ocultar tarjeta" : "Hide card"}
                  title={isSpanish ? "Ocultar" : "Hide"}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <p className="mt-4 font-body text-[15px] leading-relaxed text-vyva-text-1">
              {activeActionShowVyvaSummary || activeAction.action_summary}
            </p>
            {activeActionCanvasCopy ? (
              <div className="mt-3 rounded-[18px] border border-[#BFE7E1] bg-[#F0FDFA] px-3 py-2" data-testid={`panel-concierge-canvas-explainability-${activeAction.id}`}>
                <p className="font-body text-[13px] font-bold leading-snug text-[#115E59]">
                  {activeActionCanvasCopy.stateExplanation}
                </p>
                {activeActionCanvasState?.state !== "completed" ? (
                  <p className="mt-1 font-body text-[12px] font-bold leading-snug text-[#0F766E]">
                    {activeActionCanvasCopy.safetyRule}
                  </p>
                ) : null}
              </div>
            ) : null}

            {activeActionProviderShortlist ? (
              <ProviderShortlistFollowUpPanel
                shortlist={activeActionProviderShortlist}
                locale={locale}
                busy={activeProviderShortlistMutation.isPending || completeProviderShortlistMutation.isPending || recheckProviderShortlistMutation.isPending}
                rechecking={recheckProviderShortlistMutation.isPending}
                notice={activeActionProviderShortlistNotice}
                error={activeProviderShortlistError}
                onRemove={(option) => handleRemoveActiveShortlistOption(activeAction, activeActionProviderShortlist, option)}
                onAdd={() => handleAddActiveShortlistOption(activeAction, activeActionProviderShortlist)}
                onSelectPreferred={(option) => handleSelectActiveShortlistProvider(activeAction, activeActionProviderShortlist, option)}
                onSaveProvider={(option) => handleSaveActiveShortlistProvider(activeAction, activeActionProviderShortlist, option)}
                onPrepareContact={(option) => handlePrepareActiveShortlistContact(activeAction, activeActionProviderShortlist, option)}
                onRecheck={() => handleRecheckActiveShortlist(activeAction, activeActionProviderShortlist)}
                onDismiss={() => completeProviderShortlistMutation.mutate({ item: activeAction, shortlist: activeActionProviderShortlist, decision: "dismissed" })}
                onFinish={() => completeProviderShortlistMutation.mutate({ item: activeAction, shortlist: activeActionProviderShortlist, decision: "preferred_selected" })}
              />
            ) : null}

            {activeActionExecutionStatus ? (
              <ConciergeExecutionStatusPanel
                summary={activeActionExecutionStatus}
                update={activeActionUserUpdate}
                missionPresentation={activeActionMissionPresentation}
              />
            ) : null}

            {activeActionLiveHandoff ? (
              <ConciergeLiveHandoffPanel
                summary={activeActionLiveHandoff}
                isSpanish={isSpanish}
              />
            ) : null}

            {activeActionTimeline ? <ConciergeActionTimeline status={activeActionTimeline} /> : null}

            {activeActionChecklist ? (
              <ActiveTaskChecklistPanel
                checklist={activeActionChecklist}
                onAction={handleActiveChecklistAction}
              />
            ) : null}

            {isVerifiedProviderContactHandoff(activeAction) ? (
              <ProviderContactHandoffPanel item={activeAction} isSpanish={isSpanish} />
            ) : null}

            {activeActionShowVyvaGuide ? (
              <ShowVyvaExecutionGuidePanel guide={activeActionShowVyvaGuide} />
            ) : null}

            {activeActionGuidedPanelOpen && activeActionGuidedDetails ? (
              <div ref={guidedDetailPanelRef}>
                <GuidedDetailCapturePanel
                  capture={activeActionGuidedDetails}
                  value={guidedDetailDraft}
                  onChange={(value) => {
                    setGuidedDetailDraft(value);
                    setGuidedDetailError(null);
                    setGuidedDetailNotice(null);
                  }}
                  onSave={handleSaveGuidedDetail}
                  isSaving={guidedDetailMutation.isPending}
                  error={guidedDetailError}
                  notice={guidedDetailNotice}
                  useFormCompatibleTestIds={activeActionGuidedUsesFormCompatibleIds}
                  isSpanish={isSpanish}
                />
              </div>
            ) : null}

            {!activeActionNeedsGuidedDetails && activeActionNeedsUserConfirmation && activeActionReviewSummary ? (
              <PendingActionReviewCard
                review={activeActionReviewSummary}
                primaryLabel={activeActionCanvasPrimaryLabel || activeActionPrimaryLabel}
                primaryIcon={activeActionPrimaryIcon}
                onConfirm={() => {
                  if (activeActionNeedsPhoneOutcome) {
                    handlePhoneCallReview(activeAction);
                  } else if (activeActionNeedsWhatsAppOutcome) {
                    handleWhatsAppDraftReview(activeAction);
                  } else if (activeActionNeedsEmailOutcome) {
                    handleEmailDraftReview(activeAction);
                  } else {
                    requestExternalConfirmation({
                      item: activeAction,
                      kind: "confirm",
                      label: activeActionPrimaryLabel,
                    });
                  }
                }}
                onChange={() => handleChangePendingAction(activeAction)}
                onCancel={() => cancelMutation.mutate(activeAction.id)}
                confirmPending={
                  confirmMutation.isPending ||
                  reviewConfirmMutation.isPending ||
                  phoneCallOutcomeMutation.isPending ||
                  emailDraftOutcomeMutation.isPending ||
                  whatsAppDraftOutcomeMutation.isPending ||
                  manualReviewOutcomeMutation.isPending
                }
                cancelPending={cancelMutation.isPending}
                primaryDisabled={
                  activeActionReviewSummary.missingDetails.length > 0 ||
                  activeActionFormMissingFields.length > 0 ||
                  Boolean(activeActionWebSearch)
                }
                confirmTestId={`button-concierge-confirm-${activeAction.id}`}
                changeTestId={`button-concierge-change-${activeAction.id}`}
                cancelTestId={`button-concierge-cancel-${activeAction.id}`}
                isSpanish={isSpanish}
              />
            ) : !activeActionNeedsGuidedDetails && !activeActionProviderShortlist ? (
              <div
                className="mt-3 rounded-[18px] border border-[#BBF7D0] bg-[#F8FFFC] px-3 py-2"
                data-testid="panel-concierge-next-action"
              >
                <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#047857]">
                  {isSpanish ? "Siguiente paso" : "Next step"}
                </p>
                <p className="mt-1 font-body text-[15px] font-black leading-tight text-vyva-text-1">
                  {activeActionNextStepLabel}
                </p>
                <p className="mt-1 font-body text-[12px] font-bold leading-snug text-vyva-text-2">
                  {activeActionNextStepHelper}
                </p>
              </div>
            ) : null}

            {activeActionChannelBlocked && activeActionChannelReadiness ? (
              <div
                className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-2"
                data-testid="panel-concierge-channel-readiness-blocked"
              >
                <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-amber-800">
                  {isSpanish ? "Canal no configurado" : "Channel not ready"}
                </p>
                <p className="mt-1 font-body text-[13px] font-black leading-snug text-amber-950">
                  {activeActionChannelReadiness.label}
                </p>
                <p className="mt-1 font-body text-[12px] font-bold leading-snug text-amber-900">
                  {isSpanish
                    ? "VYVA no abrira ni contactara a un proveedor hasta que administracion active, configure y verifique este canal."
                    : "VYVA will not open or contact a provider until an admin enables, configures, and verifies this channel."}
                </p>
              </div>
            ) : null}

            {activeActionIsDryRun && activeAction ? (
              <DryRunOutcomePanel
                item={activeAction}
                canSave={activeActionCanSaveDryRunOutcome}
                isSaving={dryRunOutcomeMutation.isPending}
                notice={dryRunOutcomeNotice}
                error={dryRunOutcomeError}
                isSpanish={isSpanish}
                onSave={() => dryRunOutcomeMutation.mutate({ item: activeAction })}
              />
            ) : null}

            {activeActionProviderSearchDetails ? (
              <ProviderSearchFollowThroughPanel
                item={activeAction}
                details={activeActionProviderSearchDetails}
                isSpanish={isSpanish}
                onReply={() => openProviderReplyMode(activeAction, "confirmed")}
                onSaveProvider={() => handleSaveProviderSearchProvider(activeAction)}
                onTryAnother={() => handleProviderSearchTryAnother(activeAction)}
              />
            ) : null}

            {activeActionWebSearch ? (
              <SafeWebSearchExecutionPanel
                item={activeActionWebSearch}
                search={activeActionWebSearchResult}
                error={activeActionWebSearchError}
                isRunning={executeWebSearchActionMutation.isPending}
                isSaving={completeWebSearchActionMutation.isPending}
                isSpanish={isSpanish}
                onRun={() => executeWebSearchActionMutation.mutate({ item: activeActionWebSearch })}
                onSave={() => {
                  if (!activeActionWebSearchResult) return;
                  completeWebSearchActionMutation.mutate({
                    item: activeActionWebSearch,
                    search: activeActionWebSearchResult,
                  });
                }}
              />
            ) : null}

            {activeActionCanShowManualReviewOutcome && activeAction ? (
              <ManualReviewOutcomePanel
                item={activeAction}
                form={manualReviewOutcomeForm}
                notice={manualReviewNotice}
                error={manualReviewError}
                isSaving={manualReviewOutcomeMutation.isPending}
                isSpanish={isSpanish}
                onFormChange={updateManualReviewOutcome}
                onSave={() => handleSaveManualReviewOutcome(activeAction)}
              />
            ) : null}

            {activeActionCanShowPhoneOutcome ? (
              <PhoneCallOutcomePanel
                item={activeAction}
                form={phoneCallOutcomeForm}
                notice={phoneCallOutcomeNotice}
                error={phoneCallOutcomeError}
                isSaving={phoneCallOutcomeMutation.isPending}
                isDryRun={activeActionIsDryRun}
                isSpanish={isSpanish}
                onFormChange={updatePhoneCallOutcomeForm}
                onCall={(href, label) => requestExternalConfirmation({
                  item: activeAction,
                  kind: "phone",
                  href,
                  label,
                })}
                onSave={() => handleSavePhoneCallOutcome(activeAction)}
              />
            ) : null}

            {activeActionCanShowWhatsAppOutcome && activeActionWhatsAppDraft ? (
              <WhatsAppDraftOutcomePanel
                item={activeAction}
                draft={activeActionWhatsAppDraft}
                href={activeActionWhatsAppHref}
                form={whatsAppDraftOutcomeForm}
                notice={whatsAppDraftNotice}
                error={whatsAppDraftError}
                isSaving={whatsAppDraftOutcomeMutation.isPending}
                isDryRun={activeActionIsDryRun}
                isSpanish={isSpanish}
                onFormChange={updateWhatsAppDraftOutcome}
                onOpenDraft={(href, label) => requestExternalConfirmation({
                  item: activeAction,
                  kind: "whatsapp",
                  href,
                  label,
                  target: "_blank",
                })}
                onSent={() => handleWhatsAppDraftSent(activeAction, activeActionWhatsAppDraft)}
              />
            ) : null}

            {activeActionCanShowEmailOutcome && activeActionEmailDraft ? (
              <EmailDraftOutcomePanel
                item={activeAction}
                draft={activeActionEmailDraft}
                href={activeActionEmailHref}
                form={emailDraftOutcomeForm}
                notice={emailDraftNotice}
                error={emailDraftError}
                isSaving={emailDraftOutcomeMutation.isPending}
                isDryRun={activeActionIsDryRun}
                isSpanish={isSpanish}
                onFormChange={updateEmailDraftOutcome}
                onOpenDraft={(href, label) => requestExternalConfirmation({
                  item: activeAction,
                  kind: "email",
                  href,
                  label,
                })}
                onSent={() => handleEmailDraftSent(activeAction, activeActionEmailDraft)}
              />
            ) : null}

            {activeActionCanRecordProviderReply || providerReplyMode ? (
              usesProviderReplyVoiceCanvas && !providerReplyMode ? (
                <div className="mt-3 flex min-w-0 justify-center rounded-[28px] bg-[#F8F4FA] p-2 sm:p-4" data-testid="panel-concierge-provider-reply-canvas">
                  <ProviderReplyVoiceCanvas
                    copy={providerReplyCanvasCopy}
                    context={providerReplyCanvasContext}
                    voiceCommands={providerReplyCanvasCommands}
                    initialDraft={providerReplyCanvasInitialDraft}
                    storageKey={`vyva.providerReplyCanvas.concierge.${activeAction.id}`}
                    onSaveReply={saveProviderReplyFromCanvas}
                    onMarkComplete={markProviderReplyCompleteFromCanvas}
                    onDone={showNextQueuedAction}
                    onCancel={() => setProviderReplyNotice(isSpanish ? "Respuesta no guardada." : "Reply not saved.")}
                    onTelemetry={trackProviderReplyCanvasEvent}
                  />
                </div>
              ) : (
                <ProviderReplyPanel
                  item={activeAction}
                  mode={providerReplyMode}
                  form={providerReplyForm}
                  waitingSinceLabel={formatProviderWaitingSince(activeAction, locale, isSpanish, providerWaitingClockMs)}
                  notice={providerReplyNotice}
                  error={providerReplyError}
                  isSaving={providerReplyCompletionMutation.isPending}
                  isUpdating={providerNoAnswerMutation.isPending
                    || providerMarkCompleteMutation.isPending
                    || providerReplyResolutionMutation.isPending
                    || reviewConfirmMutation.isPending}
                  isSpanish={isSpanish}
                  onMode={(mode) => openProviderReplyMode(activeAction, mode)}
                  onFormChange={updateProviderReplyForm}
                  onNoAnswer={() => handleProviderNoAnswer(activeAction)}
                  onSaveConfirmed={() => handleSaveProviderReply(activeAction)}
                  onUnavailable={() => handleProviderUnavailable(activeAction)}
                  onNeedMoreInfo={() => handleProviderNeedMoreInfo(activeAction)}
                  onResolve={(resolution, action, answers) => handleProviderReplyResolution(activeAction, resolution, action, answers)}
                  onReviewDraft={(resolution) => handleProviderReplyDraftReview(activeAction, resolution)}
                  onMarkComplete={() => handleProviderMarkComplete(activeAction)}
                />
              )
            ) : null}

            {activeActionIsAppointment && (
              <div
                className="mt-3 rounded-[18px] border border-[#D8B4FE] bg-[#F5F3FF] px-3 py-2"
                data-testid="panel-concierge-appointment-mission"
                data-presentation-step={activeActionMissionPresentation?.stepId}
                data-presentation-status={activeActionMissionPresentation?.status}
                data-presentation-family={activeActionMissionPresentation?.presentationFamilyId}
                data-external-action-boundary={activeActionMissionPresentation?.externalActionBoundary}
              >
                <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-vyva-purple">
                  {activeActionCanOpenForm
                    ? (isSpanish ? "Formulario listo" : "Form ready")
                    : (isSpanish ? "VYVA lo gestiona" : "VYVA is handling this")}
                </p>
                <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-2">
                  {activeActionMissionStatus
                    ? appointmentMissionStatusLabel(activeActionMissionStatus, isSpanish)
                    : activeAction.status === "calling"
                      ? (isSpanish ? "Llamando ahora" : "Calling now")
                      : (isSpanish ? "Pendiente de confirmacion" : "Pending confirmation")}
                  {activeActionPreferredChannel
                    ? ` - ${appointmentHandlingLabel(activeActionPreferredChannel, isSpanish)}`
                    : ""}
                </p>
                {activeAction.status === "calling" && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <p className="basis-full font-body text-[12px] font-bold text-vyva-text-2">
                      {appointmentControlMode === "muted"
                        ? (isSpanish ? "La llamada sigue en curso, silenciada para ti." : "The call is still running, muted for you.")
                        : appointmentControlMode === "stopped"
                          ? (isSpanish ? "Has pedido detener esta gestion." : "You asked VYVA to stop this.")
                          : (isSpanish ? "Puedes escuchar o detener la llamada." : "You can listen or stop the call.")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setAppointmentControlMode("listening")}
                      className="vyva-tap inline-flex min-h-[36px] items-center gap-2 rounded-full bg-white px-3 font-body text-[12px] font-black text-vyva-purple"
                    >
                      <Volume2 size={13} />
                      {isSpanish ? "Escuchar" : "Listen"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppointmentControlMode("muted")}
                      className="vyva-tap inline-flex min-h-[36px] items-center gap-2 rounded-full bg-white px-3 font-body text-[12px] font-black text-vyva-purple"
                    >
                      <VolumeX size={13} />
                      {isSpanish ? "Silenciar" : "Mute"}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelMutation.mutate(activeAction.id)}
                      className="vyva-tap inline-flex min-h-[36px] items-center gap-2 rounded-full bg-white px-3 font-body text-[12px] font-black text-[#B91C1C]"
                    >
                      <Square size={13} />
                      {isSpanish ? "Detener" : "Stop"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeActionHasBookingFormSupport && (
              <BookingFormSupportPanel
                item={activeAction}
                plan={activeActionFormPlan}
                bookingUrl={activeActionBookingUrl}
                canOpenForm={activeActionCanOpenForm}
                externalLinksAllowed={activeActionExternalLinksAllowed}
                isDryRun={activeActionIsDryRun}
                form={bookingFormOutcomeForm}
                notice={bookingFormNotice}
                error={bookingFormError}
                intakeDraft={activeActionBookingFormIntakeDraft}
                isSaving={bookingFormOutcomeMutation.isPending}
                isSpanish={isSpanish}
                onFormChange={updateBookingFormOutcome}
                onOpenForm={(href, label) => requestExternalConfirmation({
                  item: activeAction,
                  kind: "booking",
                  href,
                  label,
                  target: "_blank",
                })}
                onSubmitted={() => handleBookingFormSubmitted(activeAction)}
                onAddDetails={() => handleBookingFormAddDetails(activeAction)}
                onNeedHelp={() => handleBookingFormNeedHelp(activeAction)}
              />
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {activeActionPhoneHref && activeActionExternalLinksAllowed && (
                <button
                  type="button"
                  onClick={() => requestExternalConfirmation({
                    item: activeAction,
                    kind: "phone",
                    href: activeActionPhoneHref,
                    label: isSpanish ? "Llamar" : "Call",
                  })}
                  className="vyva-tap inline-flex items-center gap-2 rounded-full bg-[#F5F3FF] px-3 py-2 font-body text-[12px] font-black text-vyva-purple"
                  aria-label={`${isSpanish ? "Llamar" : "Call"} ${activeAction.provider_phone}`}
                >
                  <PhoneCall size={13} style={{ color: "#6B21A8" }} />
                  {activeAction.provider_phone}
                </button>
              )}
              {activeActionEmailDraft && activeActionExternalLinksAllowed && (
                <button
                  type="button"
                  onClick={() => requestExternalConfirmation({
                    item: activeAction,
                    kind: "email",
                    href: activeActionEmailHref,
                    label: isSpanish ? "Abrir email" : "Open email",
                  })}
                  className="vyva-tap inline-flex items-center gap-2 rounded-full bg-[#EEF2FF] px-3 py-2 font-body text-[12px] font-black text-vyva-purple"
                  aria-label={`Email ${activeActionEmailDraft.address}`}
                  data-testid={`link-concierge-email-${activeAction.id}`}
                >
                  <Mail size={13} style={{ color: "#6B21A8" }} />
                  {activeActionEmailDraft.address}
                </button>
              )}
              {activeActionWhatsAppDraft && activeActionExternalLinksAllowed && (
                <button
                  type="button"
                  onClick={() => requestExternalConfirmation({
                    item: activeAction,
                    kind: "whatsapp",
                    href: activeActionWhatsAppHref,
                    label: isSpanish ? "Abrir WhatsApp" : "Open WhatsApp",
                    target: "_blank",
                  })}
                  className="vyva-tap inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]"
                  aria-label={`WhatsApp ${activeActionWhatsAppDraft.number}`}
                  data-testid={`link-concierge-whatsapp-${activeAction.id}`}
                >
                  <Send size={13} style={{ color: "#047857" }} />
                  WhatsApp
                </button>
              )}
              {activeActionBookingUrl && activeActionIsVyvaTask && (
                <span
                  className="inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]"
                >
                  <Calendar size={13} style={{ color: "#0A7C4E" }} />
                  {isSpanish ? "Formulario pendiente en VYVA" : "Form waiting in VYVA"}
                </span>
              )}
              {activeActionCanOpenForm && activeActionBookingUrl && activeActionExternalLinksAllowed && (
                <button
                  type="button"
                  onClick={() => requestExternalConfirmation({
                    item: activeAction,
                    kind: "booking",
                    href: activeActionBookingUrl,
                    label: isSpanish ? "Abrir formulario" : "Open form",
                    target: "_blank",
                  })}
                  className="vyva-tap inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]"
                  data-testid={`link-concierge-form-${activeAction.id}`}
                >
                  <Calendar size={13} style={{ color: "#0A7C4E" }} />
                  {isSpanish ? "Formulario listo" : "Form ready"}
                </button>
              )}
              {!activeActionCanOpenForm && !activeAction.provider_phone && activeActionBookingUrl && !activeActionIsVyvaTask && activeActionExternalLinksAllowed && (
                <button
                  type="button"
                  onClick={() => requestExternalConfirmation({
                    item: activeAction,
                    kind: "booking",
                    href: activeActionBookingUrl,
                    label: isSpanish ? "Abrir reserva" : "Open booking",
                    target: "_blank",
                  })}
                  className="vyva-tap inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]"
                >
                  <Calendar size={13} style={{ color: "#0A7C4E" }} />
                  {isSpanish ? "Reserva online disponible" : "Online booking available"}
                </button>
              )}
            </div>

          </div>
        )}

        {mode !== "task" && (completedSessionsLoading ? (
          <div className="mt-3 flex items-center gap-2 rounded-[18px] border border-[#E9D5FF] bg-white px-3 py-2 font-body text-[12px] font-bold text-vyva-text-2">
            <Loader2 size={14} className="animate-spin text-vyva-purple" />
            {isSpanish ? "Cargando tareas completadas..." : "Loading completed tasks..."}
          </div>
        ) : recentCompletedSessions.length > 0 ? (
          <div
            className="mt-4 rounded-[22px] border border-[#BBF7D0] bg-[#F8FFFC] p-3"
            data-testid="section-concierge-completed-history"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#047857]">
                {isSpanish ? "Hecho recientemente" : "Done recently"}
              </p>
              <span className="rounded-full bg-white px-2.5 py-1 font-body text-[11px] font-black text-[#047857]">
                {recentCompletedSessions.length}
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              {recentCompletedSessions.map((session) => {
                const details = completedSessionDetails(session, isSpanish);
                const completedAt = formatConciergeCompletedAt(session.completed_at, locale);
                const sessionIsDryRun = isConciergeDryRunPayload(session.outcome_payload);
                const completedCanvasCopy = conciergeCanvasExplainability("completed", isSpanish);

                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedCompletedSessionId(session.id)}
                    className="vyva-tap rounded-[18px] border border-[#D1FAE5] bg-white px-3 py-2.5 text-left transition hover:border-[#86EFAC] hover:bg-[#FEFFFE]"
                    data-testid={`card-concierge-completed-${session.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]">
                        <CircleCheck size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 font-body text-[10px] font-black uppercase tracking-[0.08em] text-[#047857]">
                            {completedSessionFlowLabel(session, locale)}
                          </span>
                          <span
                            className="rounded-full bg-white px-2 py-0.5 font-body text-[10px] font-black uppercase tracking-[0.08em] text-[#047857]"
                            data-testid={`badge-concierge-completed-state-${session.id}`}
                          >
                            {completedCanvasCopy.stateLabel}
                          </span>
                          {completedAt && (
                            <span className="font-body text-[11px] font-bold text-vyva-text-3">
                              {completedAt}
                            </span>
                          )}
                          {sessionIsDryRun ? (
                            <span
                              className="rounded-full bg-emerald-50 px-2 py-0.5 font-body text-[10px] font-black uppercase tracking-[0.08em] text-emerald-800"
                              data-testid={`badge-concierge-completed-dry-run-${session.id}`}
                            >
                              {isSpanish ? "Prueba" : "Test mode"}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate font-body text-[14px] font-black text-vyva-text-1">
                          {completedSessionProvider(session, isSpanish)}
                        </p>
                        <p className="mt-0.5 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
                          {session.outcome_summary || (isSpanish ? "Tarea completada por VYVA." : "Task completed by VYVA.")}
                        </p>
                        <p className="mt-1 font-body text-[12px] font-bold leading-snug text-[#115E59]" data-testid={`text-concierge-completed-explanation-${session.id}`}>
                          {completedCanvasCopy.stateExplanation}
                        </p>

                        {details.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {details.slice(0, 2).map((detail) => (
                              <span
                                key={`${session.id}-${detail.label}`}
                                className="rounded-full bg-[#FFFCF8] px-2 py-1 font-body text-[11px] font-black text-vyva-text-2"
                              >
                                {detail.label}: {detail.value}
                              </span>
                            ))}
                          </div>
                        )}

                        <span className="mt-2 inline-flex font-body text-[12px] font-black text-[#047857]">
                          {isSpanish ? "Ver recibo" : "View receipt"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null)}
      </section> : null}

      {externalConfirmationRequest && externalConfirmationReview ? (
        <PendingExternalConfirmationModal
          request={externalConfirmationRequest}
          review={externalConfirmationReview}
          locale={locale}
          isSpanish={isSpanish}
          isPending={confirmMutation.isPending}
          onCancel={() => setExternalConfirmationRequest(null)}
          onConfirm={handleExternalConfirmationConfirm}
        />
      ) : null}

      {selectedCompletedSession && selectedCompletedSessionReceipt && (
        <PurpleModal
          Icon={CircleCheck}
          kicker={isSpanish ? "Recibo" : "Receipt"}
          title={selectedCompletedSessionReceipt.flowLabel}
          subtitle={selectedCompletedSessionReceipt.whatVyvaDid}
          titleId="concierge-completed-receipt-title"
          onClose={() => setSelectedCompletedSessionId(null)}
          closeLabel={isSpanish ? "Cerrar" : "Close"}
          panelTestId="panel-concierge-completed-receipt"
          modalTestId="modal-concierge-completed-receipt"
          size="narrow"
        >
          <div className="rounded-[22px] border border-[#BBF7D0] bg-[#F8FFFC] p-4">
            <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#047857]">
              {isSpanish ? "Que hizo VYVA" : "What VYVA did"}
            </p>
            <p className="mt-2 font-body text-[15px] font-bold leading-relaxed text-vyva-text-1">
              {selectedCompletedSessionReceipt.whatVyvaDid}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-[16px] bg-white px-3 py-2">
                <p className="font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                  {selectedCompletedSessionReceipt.subjectLabel}
                </p>
                <p className="mt-1 font-body text-[13px] font-black text-vyva-text-1">
                  {selectedCompletedSessionReceipt.subjectValue}
                </p>
              </div>
              <div className="rounded-[16px] bg-white px-3 py-2" data-testid="panel-concierge-receipt-status">
                <p className="font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                  {isSpanish ? "Estado actual" : "Current status"}
                </p>
                <p className="mt-1 font-body text-[13px] font-black text-vyva-text-1">
                  {selectedCompletedSessionReceipt.statusLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-[22px] border border-[#E9D5FF] bg-white p-4" data-testid="panel-concierge-receipt-next-step">
            <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
              {isSpanish ? "Que pasa ahora" : "What happens next"}
            </p>
            <p className="mt-2 font-body text-[14px] font-bold leading-relaxed text-vyva-text-1">
              {selectedCompletedSessionReceipt.nextStep}
            </p>
          </div>

          <div className="mt-3 grid gap-2" data-testid="list-concierge-completed-receipt-details">
            {completedSessionReceiptDetails(selectedCompletedSession, isSpanish, locale).map((detail) => (
              <div
                key={`${selectedCompletedSession.id}-${detail.label}`}
                className="flex items-start justify-between gap-3 rounded-[16px] border border-vyva-border bg-white px-3 py-2.5"
              >
                <span className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                  {detail.label}
                </span>
                <span className="text-right font-body text-[13px] font-black leading-snug text-vyva-text-1">
                  {detail.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => handleCompletedSessionFollowUp(selectedCompletedSession, "question")}
              className={VYVA_MODAL_PRIMARY_ACTION_CLASS}
              data-testid="button-concierge-receipt-ask"
            >
              <Sparkles size={16} className="mr-2" />
              {isSpanish ? "Preguntar a VYVA" : "Ask VYVA"}
            </button>
            <button
              type="button"
              onClick={() => handleCompletedSessionUseTemplate(selectedCompletedSession)}
              className={VYVA_MODAL_SECONDARY_ACTION_CLASS}
              data-testid="button-concierge-receipt-template"
            >
              <PackageCheck size={16} className="mr-2" />
              {isSpanish ? "Usar como plantilla" : "Use as template"}
            </button>
            {selectedCompletedSessionContactLink && (
              <a
                href={selectedCompletedSessionContactLink.href}
                target={selectedCompletedSessionContactLink.external ? "_blank" : undefined}
                rel={selectedCompletedSessionContactLink.external ? "noopener noreferrer" : undefined}
                className={`${VYVA_MODAL_SECONDARY_ACTION_CLASS} text-center`}
                data-testid="link-concierge-receipt-contact"
              >
                <ExternalLink size={16} className="mr-2" />
                {selectedCompletedSessionContactLink.label}
              </a>
            )}
          </div>
        </PurpleModal>
      )}

      {(mode !== "task" || appointmentOpen || offersOpen) ? <section className="order-[10] mt-[22px] flex flex-col" data-testid="concierge-guided-hub">
        {appointmentOpen && (
          <PurpleModal
            Icon={AppointmentPanelIcon}
            kicker={appointmentPanelKicker}
            title={appointmentPanelTitle}
            titleId="appointment-assistant-title"
            onClose={() => setAppointmentOpen(false)}
            closeLabel={isSpanish ? "Cerrar" : "Close"}
            panelTestId="panel-appointment-assistant"
            body={isHomeServiceIntakeActive ? "tight" : "normal"}
          >

            {isHomeServiceAppointment && homeServiceGuideOpen && (
              <PurpleModal
                Icon={Wrench}
                kicker={isSpanish ? "Servicio" : "Service"}
                title={isSpanish ? "En casa" : "Home help"}
                titleId="home-service-guide-title"
                onClose={() => setHomeServiceGuideOpen(false)}
                closeLabel={isSpanish ? "Cerrar" : "Close"}
                panelTestId="panel-home-service-guide"
                modalTestId="modal-home-service-guide"
                size="narrow"
                layer="top"
              >

                  <div className="mt-4 grid gap-2">
                    {[
                      {
                        Icon: CircleCheck,
                        label: isSpanish ? "Lista guardada revisada" : "Saved list checked",
                        color: "#6D28D9",
                        bg: "#F5F3FF",
                        border: "#D8B4FE",
                      },
                      {
                        Icon: Search,
                        label: isSpanish ? "Busqueda fiable" : "Trusted search",
                        color: "#6D28D9",
                        bg: "#F5F3FF",
                        border: "#D8B4FE",
                      },
                      {
                        Icon: ShieldCheck,
                        label: isSpanish ? "Tu confirmas" : "You confirm",
                        color: "#6D28D9",
                        bg: "#F5F3FF",
                        border: "#D8B4FE",
                      },
                    ].map(({ Icon, label, color, bg, border }) => (
                      <div
                        key={label}
                        className="flex min-h-[48px] items-center gap-3 rounded-full border bg-white px-3"
                        style={{ borderColor: border }}
                      >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: bg, color }}>
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <span className="font-body text-[13px] font-black text-vyva-text-1">{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[18px] border border-[#E9D5FF] bg-[#FBF8FF] p-3">
                    <label className="flex items-start gap-3 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                      <input
                        type="checkbox"
                        checked={homeServiceGuideNeverShow}
                        onChange={(event) => setHomeServiceGuideNeverShow(event.target.checked)}
                        data-testid="checkbox-home-service-guide-never"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-[#C4B5FD] text-[#6D28D9]"
                      />
                      <span>{isSpanish ? "No mostrar de nuevo" : "Never show this again"}</span>
                    </label>
                    <button
                      type="button"
                      onClick={dismissHomeServiceGuide}
                      data-testid="button-home-service-guide-understood"
                      className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} mt-3`}
                    >
                      {isSpanish ? "Entendido" : "Understood"}
                    </button>
                  </div>
              </PurpleModal>
            )}

            {isHomeServiceAppointment && (
              <div
                className="mt-3 overflow-hidden rounded-[26px] border border-[#D8B4FE] bg-white shadow-[0_18px_44px_rgba(49,18,94,0.16)]"
                data-testid="panel-home-service-intake"
              >
                <div className="border-b border-[#E9D5FF] bg-[#FBF8FF] px-4 py-3">
                  <div>
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
                      {isSpanish ? "Detalles de solicitud" : "Request details"}
                    </p>
                    <h3 className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1">
                      {homeServiceNeededLabel || (homeServiceType
                        ? homeServiceTypeLabel(homeServiceType, locale)
                        : (isSpanish ? "Que necesitas?" : "What do you need?"))}
                    </h3>
                  </div>
                  {homeServiceType && (
                    <div
                      className="mt-2 flex items-center justify-between gap-3 rounded-full border border-[#E9D5FF] bg-white px-3 py-2"
                      data-testid="panel-home-service-selected-service"
                    >
                      <span className="min-w-0 font-body text-[13px] font-black leading-tight text-[#6D28D9]">
                        {isSpanish ? "Progreso" : "Progress"}
                      </span>
                      <span className="flex-shrink-0 rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[12px] font-black text-[#6D28D9]">
                        {homeServiceCompletedLabel}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col px-3 pb-3 sm:px-4 sm:pb-4">
                  {homeServiceType && activeHomeServiceQuestion && (
                    <div
                      className="order-1 mt-3 rounded-[22px] border border-[#D8B4FE] bg-[#FBF8FF] p-3 shadow-[0_10px_24px_rgba(107,33,168,0.08)]"
                      data-testid="panel-home-service-question"
                      aria-live="polite"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
                            <Sparkles size={18} aria-hidden="true" />
                          </span>
                          <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                            {isSpanish ? "Pregunta actual" : "Current question"}
                          </p>
                        </div>
                        <span className="flex-shrink-0 rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[12px] font-black text-vyva-purple">
                          {homeServiceProgressLabel}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E9D5FF]">
                        <div
                          className="h-full rounded-full bg-vyva-purple"
                          style={{ width: `${homeServiceProgressPercent}%` }}
                        />
                      </div>

                      <div className="pt-4">
                        <p className="font-body text-[20px] font-black leading-[1.12] text-vyva-text-1">
                          {homeServiceTextFromQuestion(activeHomeServiceQuestion, isSpanish)}
                        </p>
                        {activeHomeServiceQuestion.kind === "choice" ? (
                          <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-3">
                            {activeHomeServiceQuestion.options?.map((option) => (
                              <PurpleModalOption
                                key={option.key}
                                onClick={() => setHomeServiceAnswer(activeHomeServiceQuestion.key, option.key)}
                                data-testid={`button-home-service-answer-${option.key}`}
                                align="center"
                                className="min-h-[50px] px-3 text-[15px]"
                              >
                                {homeServiceOptionText(option, isSpanish)}
                              </PurpleModalOption>
                            ))}
                            {!activeHomeServiceQuestion.options?.some((option) => option.key === "not_sure") && (
                              <PurpleModalOption
                                onClick={() => setHomeServiceAnswer(activeHomeServiceQuestion.key, "not_sure")}
                                align="center"
                                className="min-h-[50px] px-3 text-[15px]"
                              >
                                {isSpanish ? "No lo se" : "Not sure"}
                              </PurpleModalOption>
                            )}
                          </div>
                        ) : (
                          <div className="mt-4">
                            <textarea
                              value={homeServiceTextDrafts[activeHomeServiceQuestion.key] ?? homeServiceIntakeAnswers[activeHomeServiceQuestion.key] ?? ""}
                              onChange={(event) => setHomeServiceTextDrafts((current) => ({
                                ...current,
                                [activeHomeServiceQuestion.key]: event.target.value,
                              }))}
                              placeholder={isSpanish ? activeHomeServiceQuestion.placeholderEs : activeHomeServiceQuestion.placeholderEn}
                              rows={3}
                              className="min-h-[104px] w-full resize-none rounded-[18px] border border-[#D8B4FE] bg-[#FBF8FF] px-4 py-3 font-body text-[16px] font-semibold leading-relaxed text-vyva-text-1 outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/15"
                            />
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const draft = (homeServiceTextDrafts[activeHomeServiceQuestion.key] ?? "").trim();
                                  setHomeServiceAnswer(activeHomeServiceQuestion.key, draft || "skip");
                                }}
                                data-testid="button-home-service-answer-next"
                                className={VYVA_MODAL_PRIMARY_ACTION_CLASS}
                              >
                                {isSpanish ? "Guardar" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setHomeServiceAnswer(activeHomeServiceQuestion.key, "skip")}
                                data-testid="button-home-service-answer-skip"
                                className={VYVA_MODAL_SECONDARY_ACTION_CLASS}
                              >
                                {isSpanish ? "Saltar" : "Skip"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isHomeServiceElectricalDanger && (
                    <div
                      className="order-1 mt-4 rounded-[24px] border-2 border-[#B91C1C] bg-[#FEF2F2] p-4 shadow-[0_18px_38px_rgba(185,28,28,0.16)]"
                      data-testid="panel-home-service-emergency"
                      role="alert"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-[#B91C1C]">
                          <AlertTriangle size={23} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-body text-[18px] font-black leading-tight text-[#991B1B]">
                            {isSpanish ? "Primero, seguridad." : "Safety first."}
                          </p>
                          <p className="mt-1 font-body text-[13px] font-bold leading-snug text-[#7F1D1D]">
                            {isSpanish
                              ? "No toques enchufes, cables, cuadros electricos ni aparatos si hay peligro. Si alguien esta en riesgo, pide ayuda urgente ahora."
                              : "Do not touch sockets, wires, breakers, or appliances if there is danger. If anyone is at risk, get urgent help now."}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <a
                          href={homeServiceLocalEmergency.telHref}
                          data-testid="button-home-service-call-emergency"
                          className="vyva-tap inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-[#B91C1C] px-4 font-body text-[16px] font-black text-white shadow-[0_12px_24px_rgba(185,28,28,0.20)]"
                        >
                          <PhoneCall size={18} aria-hidden="true" />
                          {isSpanish
                            ? `Llamar al ${homeServiceLocalEmergency.label} ahora`
                            : `Call ${homeServiceLocalEmergency.label} now`}
                        </a>
                        {homeServiceEmergencyContactHref ? (
                          <a
                            href={homeServiceEmergencyContactHref}
                            data-testid="button-home-service-call-caregiver"
                            className="vyva-tap inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-2 border-[#FCA5A5] bg-white px-4 font-body text-[15px] font-black text-[#B91C1C]"
                          >
                            <UserRound size={17} aria-hidden="true" />
                            {isSpanish
                              ? `Avisar a ${homeServiceEmergencyContact?.name || "mi contacto"}`
                              : `Alert ${homeServiceEmergencyContact?.name || "my contact"}`}
                          </a>
                        ) : homeServiceEmergencyContactLoading ? (
                          <div className="min-h-[50px] rounded-full border border-[#FCA5A5] bg-white px-4 py-3 text-center font-body text-[13px] font-bold text-[#7F1D1D]">
                            {isSpanish ? "Buscando contacto guardado..." : "Checking saved contact..."}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setHomeServiceAnswer("safety_risk", "safe_for_now")}
                          data-testid="button-home-service-safe-for-now"
                          className="vyva-tap inline-flex min-h-[50px] items-center justify-center rounded-full border-2 border-[#FCA5A5] bg-white px-4 font-body text-[14px] font-black text-[#7F1D1D]"
                        >
                          {isSpanish ? "Estoy a salvo, seguir con electricista urgente" : "I am safe, continue with urgent electrician"}
                        </button>
                      </div>
                    </div>
                  )}

                  {homeServiceNeedsVisitAddress && (
                    <div
                      className="order-1 mt-4 rounded-[22px] border-2 border-[#F59E0B] bg-[#FFFBEB] p-4 shadow-[0_14px_28px_rgba(245,158,11,0.12)]"
                      data-testid="panel-home-service-address"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#B45309]">
                          <MapPin size={19} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-body text-[17px] font-black leading-tight text-[#92400E]">
                            {isSpanish ? "Donde debe ir el proveedor?" : "Where should the provider come?"}
                          </p>
                          <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                            {isSpanish
                              ? "VYVA usara esta direccion solo cuando confirmes el contacto o la reserva."
                              : "VYVA uses this address only when you confirm contact or booking."}
                          </p>
                        </div>
                      </div>
                      <textarea
                        value={homeServiceTextDrafts.home_address ?? ""}
                        onChange={(event) => setHomeServiceTextDrafts((current) => ({
                          ...current,
                          home_address: event.target.value,
                        }))}
                        placeholder={isSpanish ? "Direccion, piso, puerta o notas de acceso" : "Address, apartment, entrance, or access notes"}
                        rows={2}
                        data-testid="input-home-service-address"
                        className="mt-3 min-h-[86px] w-full resize-none rounded-[18px] border border-[#FCD34D] bg-white px-4 py-3 font-body text-[16px] font-semibold leading-relaxed text-vyva-text-1 outline-none focus:border-[#B45309] focus:ring-4 focus:ring-[#F59E0B]/15"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const draft = (homeServiceTextDrafts.home_address ?? "").trim();
                          if (draft) setHomeServiceAnswer("home_address", draft);
                        }}
                        disabled={!(homeServiceTextDrafts.home_address ?? "").trim()}
                        data-testid="button-home-service-address-save"
                        className="vyva-tap mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#B45309] px-4 font-body text-[15px] font-black text-white shadow-[0_12px_26px_rgba(180,83,9,0.18)] disabled:opacity-55"
                      >
                        <CircleCheck size={16} aria-hidden="true" />
                        {isSpanish ? "Usar esta direccion" : "Use this address"}
                      </button>
                    </div>
                  )}

                  {homeServiceType && !activeHomeServiceQuestion && !isHomeServiceElectricalDanger && isHomeServiceIntakeComplete && (
                    <div className="order-1 mt-4 rounded-[22px] border-2 border-[#0F766E] bg-[#ECFDF5] p-4 shadow-[0_14px_28px_rgba(15,118,110,0.14)]" data-testid="panel-home-service-ready">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#0F766E]">
                          <CircleCheck size={20} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-body text-[17px] font-black leading-tight text-[#0F766E]">
                            {isSpanish ? "Listo. VYVA ya tiene lo necesario para buscar." : "Ready. VYVA has enough to search."}
                          </p>
                          {homeServiceSafetyFlags.length > 0 && (
                            <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                              {hasHomeServicePoweredMedicalEquipment
                                ? (isSpanish
                                  ? "VYVA priorizara ayuda rapida por equipo medico electrico."
                                  : "VYVA will prioritize fast help because powered medical equipment is involved.")
                                : (isSpanish ? "Se priorizara urgencia y seguridad." : "Urgency and safety will be prioritized.")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {homeServiceType ? (
                    <details
                      className="order-2 mt-3 rounded-[18px] border border-[#E9D5FF] bg-[#FBF8FF] p-2"
                      data-testid="panel-home-service-service-picker"
                    >
                      <summary className="vyva-tap flex min-h-[42px] cursor-pointer list-none items-center justify-between rounded-[14px] px-2 font-body text-[13px] font-black text-vyva-purple">
                        <span>{isSpanish ? "Cambiar servicio" : "Change service"}</span>
                        <ChevronDown size={16} aria-hidden="true" />
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {HOME_SERVICE_TYPES.map((service) => {
                          const selected = homeServiceType === service.key;
                          return (
                            <PurpleModalOption
                              key={service.key}
                              onClick={() => {
                                setHomeServiceType(service.key);
                                setHomeServiceIntakeOrigin((current) => current || "app");
                                setHomeServiceIntakeAnswers({});
                                setHomeServiceTextDrafts({});
                                setAppointmentRequest(null);
                                setAppointmentOptions([]);
                                setAppointmentDiscovery(null);
                                setAppointmentAttemptResult(null);
                                setAppointmentNotice(null);
                                setAppointmentError(null);
                              }}
                              data-testid={`button-home-service-type-${service.key}`}
                              selected={selected}
                              className="min-h-[46px] px-3 text-[12px]"
                            >
                              {isSpanish ? service.es : service.en}
                            </PurpleModalOption>
                          );
                        })}
                      </div>
                    </details>
                  ) : (
                    <div className="order-1 mt-3" data-testid="panel-home-service-service-picker">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {HOME_SERVICE_TYPES.map((service) => (
                          <PurpleModalOption
                            key={service.key}
                            onClick={() => {
                              setHomeServiceType(service.key);
                              setHomeServiceIntakeOrigin((current) => current || "app");
                              setHomeServiceIntakeAnswers({});
                              setHomeServiceTextDrafts({});
                              setAppointmentRequest(null);
                              setAppointmentOptions([]);
                              setAppointmentDiscovery(null);
                              setAppointmentAttemptResult(null);
                              setAppointmentNotice(null);
                              setAppointmentError(null);
                            }}
                            data-testid={`button-home-service-type-${service.key}`}
                            className="min-h-[56px] px-3 text-[13px]"
                          >
                            {isSpanish ? service.es : service.en}
                          </PurpleModalOption>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isHomeServiceAppointment && (
              <div className="mt-1 rounded-[20px] bg-white p-1">
                  <PurpleModalSectionLabel>
                    {isSpanish ? "Tipo de cita" : "Appointment type"}
                  </PurpleModalSectionLabel>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {APPOINTMENT_TYPE_CHIPS.filter((chip) => SCHEDULE_APPOINTMENT_TYPE_KEYS.has(chip.key)).map((chip) => {
                      const isSelectedAppointmentChip = appointmentIntentType === chip.key;
                      return (
                        <PurpleModalOption
                          key={chip.key}
                          onClick={() => startAppointmentFlow(chip)}
                          disabled={chatLoading || createAppointmentMutation.isPending}
                          selected={isSelectedAppointmentChip}
                        >
                          {isSpanish ? chip.es : chip.en}
                        </PurpleModalOption>
                      );
                    })}
                  </div>
              </div>
            )}

            {!isHomeServiceAppointment && (
              <div className="mt-4 rounded-[20px] bg-white p-1">
                <label className="block">
                  <PurpleModalSectionLabel className="text-vyva-text-2">
                  {appointmentDetailLabel}
                  </PurpleModalSectionLabel>
                </label>
                <Input
                  value={appointmentNote}
                  onChange={(e) => setAppointmentNote(e.target.value)}
                  placeholder={appointmentDetailPlaceholder}
                  data-testid="input-appointment-note"
                  className="mt-2 min-h-[50px] rounded-[18px] border-[#D8B4FE] bg-white font-body text-[15px] focus-visible:ring-[#7C3AED]/20"
                />
              </div>
            )}

            {shouldShowCoverageReadiness && (
              <div
                className="mt-3 rounded-[22px] border border-[#99F6E4] bg-[#F0FDFA] p-4 shadow-[0_12px_28px_rgba(15,118,110,0.10)]"
                data-testid="panel-coverage-readiness"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#0F766E]">
                    <ShieldCheck size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-body text-[16px] font-black leading-tight text-[#0F766E]">
                      {isSpanish ? "Cobertura para citas medicas" : "Coverage for medical bookings"}
                    </p>
                    <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                      {isSpanish ? "Guardala una vez. VYVA pregunta antes de compartirla." : "Save it once. VYVA asks before sharing it."}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {COVERAGE_TYPE_OPTIONS.map((option) => {
                    const selected = coverageType === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setCoverageType(option.key)}
                        data-testid={`button-coverage-type-${option.key}`}
                        className={`vyva-tap min-h-[44px] rounded-full border px-3 font-body text-[13px] font-black ${
                          selected
                            ? "border-[#0F766E] bg-[#0F766E] text-white"
                            : "border-[#99F6E4] bg-white text-[#0F766E]"
                        }`}
                      >
                        {isSpanish ? option.es : option.en}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    value={coverageProvider}
                    onChange={(event) => setCoverageProvider(event.target.value)}
                    data-testid="input-coverage-provider"
                    placeholder={isSpanish ? "Aseguradora o sistema (opcional)" : "Insurer or system (optional)"}
                    className="min-h-[48px] rounded-[16px] border-[#99F6E4] bg-white font-body text-[14px] focus-visible:ring-[#0F766E]/20"
                  />
                  <Input
                    value={coverageMemberId}
                    onChange={(event) => setCoverageMemberId(event.target.value)}
                    data-testid="input-coverage-member-id"
                    placeholder={isSpanish ? "Numero o referencia (opcional)" : "Member or policy ref (optional)"}
                    className="min-h-[48px] rounded-[16px] border-[#99F6E4] bg-white font-body text-[14px] focus-visible:ring-[#0F766E]/20"
                  />
                  <Input
                    value={coveragePlan}
                    onChange={(event) => setCoveragePlan(event.target.value)}
                    data-testid="input-coverage-plan"
                    placeholder={isSpanish ? "Plan o red preferida (opcional)" : "Plan or network (optional)"}
                    className="min-h-[48px] rounded-[16px] border-[#99F6E4] bg-white font-body text-[14px] focus-visible:ring-[#0F766E]/20 sm:col-span-2"
                  />
                </div>

                {(coverageNotice || coverageError) && (
                  <p
                    className={`mt-3 rounded-[14px] px-3 py-2 font-body text-[12px] font-black ${
                      coverageError ? "bg-[#FEF2F2] text-[#B91C1C]" : "bg-white text-[#0F766E]"
                    }`}
                  >
                    {coverageError || coverageNotice}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => saveCoverageMutation.mutate()}
                  disabled={!canSaveCoverageReadiness || saveCoverageMutation.isPending}
                  data-testid="button-coverage-save"
                  className="vyva-tap mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#0F766E] px-4 font-body text-[15px] font-black text-white shadow-[0_12px_26px_rgba(15,118,110,0.18)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {saveCoverageMutation.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}
                  {isSpanish ? "Guardar cobertura" : "Save coverage"}
                </button>
              </div>
            )}

            {isHomeServiceAppointment && !isHomeServiceElectricalDanger && !appointmentRequest && (!homeServiceType || !activeHomeServiceQuestion) && (
              isHomeServiceIntakeComplete ? (
                <ActionReadinessPanel
                  readiness={homeServiceToolReadiness}
                  desiredAction={isSpanish ? "Preparar servicio en casa" : "Prepare home service"}
                  recipient={savedHomeServiceProvider || (isSpanish ? "Busqueda fiable" : "Trusted search")}
                  isSpanish={isSpanish}
                  compact
                  testId="panel-home-service-readiness"
                />
              ) : null
            )}

            {isHomeServiceAppointment && !isHomeServiceElectricalDanger && !appointmentRequest && (!homeServiceType || !activeHomeServiceQuestion) && (
              <button
                type="button"
                onClick={() => startAppointmentFlow(selectedAppointmentChip ?? APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === "home-service") ?? APPOINTMENT_TYPE_CHIPS[0])}
                disabled={chatLoading || createAppointmentMutation.isPending || !isHomeServiceIntakeComplete}
                data-testid="button-appointment-start-home-service"
                className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} mt-3`}
              >
                {createAppointmentMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Search size={16} className="mr-2" />}
                {isSpanish ? "Buscar opciones fiables" : "Find trusted options"}
              </button>
            )}

            {showAppointmentStatusMessage && (
              <div
                className={`mt-3 rounded-[18px] px-4 py-3 font-body text-[13px] font-semibold ${
                  appointmentError ? "bg-[#FEF2F2] text-[#B91C1C]" : "border border-[#D8B4FE] bg-[#FBF8FF] text-vyva-purple"
                }`}
              >
                {createAppointmentMutation.isPending
                  ? (isSpanish ? "Preparando solicitud..." : "Preparing request...")
                  : discoverAppointmentOptionsMutation.isPending
                    ? (isSpanish ? "Buscando opciones..." : "Looking for options...")
                  : appointmentError || appointmentNotice}
              </div>
            )}

            {appointmentRequest && appointmentOptions.length > 0 && (
              <div className="mt-3 rounded-[24px] border border-[#D8B4FE] bg-white p-4 shadow-[0_16px_36px_rgba(49,18,94,0.10)] sm:p-5" data-testid="panel-appointment-provider-options">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-vyva-purple">
                    <ShieldCheck size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
                      {isSpanish ? "Opcion recomendada" : "Recommended option"}
                    </p>
                    <h3 className="mt-1 font-body text-[20px] font-black leading-tight text-vyva-text-1 sm:text-[22px]">
                      {appointmentProviderName}
                    </h3>
                    <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                      {selectedAppointmentOption?.match_reason || appointmentProviderTrustNote}
                    </p>
                    {appointmentProviderAddress && (
                      <p className="mt-1 font-body text-[12px] font-semibold leading-snug text-vyva-text-3">
                        {appointmentProviderAddress}
                      </p>
                    )}
                  </div>
                </div>

                {selectedAppointmentOption && selectedAppointmentActionChannel && (
                  <>
                    {selectedAppointmentToolReadiness ? (
                      <ActionReadinessPanel
                        readiness={selectedAppointmentToolReadiness}
                        desiredAction={isHomeServiceAppointment
                          ? (isSpanish ? "Preparar servicio en casa" : "Prepare home service")
                          : (isSpanish ? "Preparar cita" : "Prepare appointment")}
                        recipient={appointmentProviderName}
                        isSpanish={isSpanish}
                        compact
                        testId="panel-appointment-readiness"
                      />
                    ) : null}
                    <ActionConfirmationCheckpoint
                      title={isSpanish ? "Confirma antes de que VYVA actue" : "Confirm before VYVA acts"}
                      summary={isSpanish
                        ? "VYVA puede contactar al proveedor para comprobar opciones. Nada queda reservado, pagado ni enviado como final sin tu aprobacion."
                        : "VYVA can contact the provider to check options. Nothing is booked, paid, or sent as final without your approval."}
                      items={selectedAppointmentConfirmationItems}
                      primaryLabel={isSpanish ? "Confirmar: VYVA lo gestiona" : "Confirm: Ask VYVA to handle this"}
                      onConfirm={() => handleAppointmentChannel(selectedAppointmentActionChannel)}
                      isPending={confirmAppointmentMutation.isPending}
                      disabled={confirmAppointmentMutation.isPending}
                      testId="panel-appointment-confirmation-checkpoint"
                      buttonTestId="button-appointment-handle-provider"
                    />
                  </>
                )}

                {appointmentOptions.length > 1 && (
                  <details className="mt-3 overflow-hidden rounded-[16px] border border-[#E9D5FF] bg-[#FBF8FF]">
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-3 font-body text-[12px] font-black text-vyva-purple">
                      <span>{isSpanish ? "Ver otras opciones" : "See other options"}</span>
                      <ChevronDown size={15} aria-hidden="true" />
                    </summary>
                    <div className="grid grid-cols-1 gap-2 border-t border-[#E9D5FF] p-3 sm:grid-cols-2">
                      {appointmentOptions.map((option) => {
                        const isSelected = option.id === selectedAppointmentOption?.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setSelectedAppointmentOptionId(option.id)}
                            data-testid={`button-appointment-option-${testIdSlug(appointmentOptionName(option, isSpanish))}`}
                            className={`vyva-tap rounded-[14px] border px-3 py-2 text-left font-body ${
                              isSelected ? "border-vyva-purple bg-[#F5F3FF]" : "border-[#D8B4FE] bg-white"
                            }`}
                          >
                            <span className="block text-[13px] font-black text-vyva-text-1">
                              {appointmentOptionName(option, isSpanish)}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-semibold text-vyva-text-2">
                              {option.match_reason || (isSpanish ? "Fuente revisable" : "Reviewable source")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            )}

            {appointmentRequest && appointmentOptions.length === 0 && (
              <div className="mt-3">
                <MissingProviderChoicePanel
                  title={noSavedProviderTitle}
                  body={noSavedProviderBody || (isSpanish ? "VYVA puede buscar opciones antes de contactar." : "VYVA can look for options before contacting anyone.")}
                  addLabel={isHomeServiceAppointment
                    ? (isSpanish ? "Anadir mi proveedor" : "Add my usual provider")
                    : (isSpanish ? "Anadir mi clinica" : "Add my usual provider")}
                  addDetail={isHomeServiceAppointment
                    ? (isSpanish ? "Servicio en casa de confianza" : "Trusted home service")
                    : (isSpanish ? "Medico o clinica de confianza" : "Doctor or clinic")}
                  findLabel={appointmentDiscoverLabel}
                  findDetail={isSpanish ? "Revisar opciones primero" : "Review options first"}
                  helperLabel={isSpanish ? "Pedir ayuda" : "Ask someone to help"}
                  helperDetail={isSpanish ? "Familia o cuidador" : "Family or caregiver setup"}
                  onAddProvider={isHomeServiceAppointment ? openHomeServiceProviderSetup : openMedicalProviderSetup}
                  onFindOptions={handleDiscoverAppointmentOptions}
                  onAskHelper={() => openProviderSetupHelper(isHomeServiceAppointment
                    ? "Ask trusted helper to set up a home service provider"
                    : "Ask trusted helper to set up a doctor or clinic", {
                      kind: isHomeServiceAppointment ? "home_service" : "medical_appointment",
                      appointmentType: appointmentRequest.appointment_type,
                      note: appointmentNote.trim(),
                      requestedTime: appointmentCanvasRequestedTime.trim(),
                    })}
                  isFinding={discoverAppointmentOptionsMutation.isPending}
                  testId="panel-appointment-missing-provider"
                  addTestId="button-appointment-provider-setup"
                  findTestId="button-appointment-discover-options"
                  helperTestId="button-appointment-ask-helper"
                  isSpanish={isSpanish}
                />
                {appointmentNotice && appointmentOptions.length === 0 && (!isHomeServiceWithoutProvider || appointmentDiscovery) && (
                  <button
                    type="button"
                    onClick={sendAppointmentToChat}
                    disabled={chatLoading}
                    className={`${VYVA_MODAL_SECONDARY_ACTION_CLASS} mt-2 border-[#FCD34D] text-[#92400E]`}
                  >
                    {appointmentPrepareLabel}
                  </button>
                )}
                {appointmentDiscovery?.reservation_systems?.length && appointmentOptions.length === 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2" data-testid="panel-appointment-booking-sites">
                    {appointmentDiscovery.reservation_systems.slice(0, 3).map((system) => (
                      <button
                        key={`${system.name}-${system.url}`}
                        type="button"
                        onClick={() => appointmentRequest && addAppointmentBookingSiteMutation.mutate({
                          requestId: appointmentRequest.id,
                          system,
                        })}
                        disabled={!appointmentRequest || addAppointmentBookingSiteMutation.isPending}
                        data-testid={`button-appointment-booking-site-${testIdSlug(system.name)}`}
                        className="vyva-tap inline-flex min-h-[38px] items-center justify-center rounded-full border border-[#FCD34D] bg-white px-3 font-body text-[12px] font-black text-[#92400E] disabled:opacity-60"
                      >
                        {addAppointmentBookingSiteMutation.isPending ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <ShieldCheck size={13} className="mr-1.5" />}
                        {system.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {appointmentAttemptResult?.draft && (
              <div className="mt-3 rounded-[20px] border border-[#D8B4FE] bg-white p-4" data-testid="panel-appointment-draft">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
                  {isSpanish ? "Borrador" : "Draft"}
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-body text-[13px] font-semibold leading-relaxed text-vyva-text-1">
                  {appointmentAttemptResult.draft}
                </pre>
              </div>
            )}

            {appointmentAttemptResult && appointmentRequest && !appointmentAttemptResult.scheduled_event && (
              <FinalConfirmationCard
                title={appointmentFinalReviewTitle}
                body={appointmentFinalReviewBody}
                providerName={appointmentProviderName}
                icon={CircleCheck}
                fields={[
                  {
                    key: "providerReply",
                    label: isSpanish ? "Respuesta del proveedor" : "Provider reply",
                    value: appointmentBookedForm.providerReply,
                    onChange: (value) => setAppointmentBookedForm((current) => ({ ...current, providerReply: value })),
                    placeholder: isHomeServiceAppointment
                      ? (isSpanish ? "Ej. Puede venir manana a las 10:00. Coste estimado 80 EUR." : "E.g. Can visit tomorrow at 10:00. Estimated cost EUR80.")
                      : (isSpanish ? "Ej. Confirmado martes a las 10:00. Traer tarjeta sanitaria." : "E.g. Confirmed Tuesday at 10:00. Bring insurance card."),
                    multiline: true,
                    testId: "input-appointment-provider-reply",
                  },
                  {
                    key: "scheduledFor",
                    label: isSpanish ? "Fecha y hora" : "Date and time",
                    value: appointmentBookedForm.scheduledFor,
                    onChange: (value) => setAppointmentBookedForm((current) => ({ ...current, scheduledFor: value })),
                    type: "datetime-local",
                    testId: "input-appointment-confirmed-time",
                  },
                  {
                    key: "location",
                    label: isSpanish ? "Lugar" : "Place",
                    value: appointmentBookedForm.location,
                    onChange: (value) => setAppointmentBookedForm((current) => ({ ...current, location: value })),
                    placeholder: (isHomeServiceAppointment ? homeServiceVisitAddress : appointmentProviderAddress) || (isSpanish ? "Lugar" : "Location"),
                    testId: "input-appointment-confirmed-location",
                  },
                  {
                    key: "reference",
                    label: isSpanish ? "Referencia" : "Reference",
                    value: appointmentBookedForm.reference,
                    onChange: (value) => setAppointmentBookedForm((current) => ({ ...current, reference: value })),
                    placeholder: isSpanish ? "Opcional" : "Optional",
                    testId: "input-appointment-confirmed-reference",
                  },
                  {
                    key: "notes",
                    label: isSpanish ? "Nota para VYVA" : "Note for VYVA",
                    value: appointmentBookedForm.notes,
                    onChange: (value) => setAppointmentBookedForm((current) => ({ ...current, notes: value })),
                    placeholder: isSpanish ? "Opcional" : "Optional",
                    testId: "input-appointment-confirmed-note",
                    fullWidth: true,
                  },
                ]}
                primaryLabel={appointmentFinalSaveLabel}
                secondaryLabel={isSpanish ? "Cambiar" : "Change"}
                onPrimary={handleMarkAppointmentBooked}
                onSecondary={handleReviseAppointmentAfterReply}
                primaryPending={markAppointmentBookedMutation.isPending}
                testId="panel-appointment-mark-booked"
                primaryTestId="button-appointment-save-confirmed"
                secondaryTestId="button-appointment-revise-after-reply"
                isSpanish={isSpanish}
              />
            )}

            {appointmentRequest && appointmentOptions.length > 0 && (
              <button
                type="button"
                onClick={handleDiscoverAppointmentOptions}
                disabled={discoverAppointmentOptionsMutation.isPending}
                data-testid="button-appointment-discover-more-options"
                className={`${VYVA_MODAL_SECONDARY_ACTION_CLASS} mt-3`}
              >
                {discoverAppointmentOptionsMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                {isSpanish ? "Buscar otras opciones" : "Look for other options"}
              </button>
            )}
          </PurpleModal>
        )}

        {offersOpen && (
          <div
            className="mt-4 rounded-[26px] border border-[#D9C7B6] bg-[#FCF8F1] p-4"
            style={{ boxShadow: "0 14px 34px rgba(76,49,28,0.10)" }}
            data-testid="panel-offers-search"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] bg-white shadow-sm">
                <ShieldCheck size={21} style={{ color: "#6B21A8" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[18px] font-semibold leading-tight text-vyva-text-1">
                  {providerSearchMode
                    ? (isSpanish ? "Busca con criterios claros" : "Find with clear criteria")
                    : (isSpanish ? "Ahorra con proteccion real" : "Save with real protection")}
                </p>
                <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                  {providerSearchMode
                    ? (isSpanish
                        ? "VYVA compara cercania, reputacion, precio y acceso antes de sugerir el siguiente paso."
                        : "VYVA compares proximity, reputation, price, and access before suggesting the next step.")
                    : (isSpanish
                        ? "La IA compara, valida y espera su confirmacion antes de actuar."
                        : "AI compares, validates, and waits for your confirmation before action.")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { Icon: ShieldCheck, label: isSpanish ? "Sin comisiones" : "No commissions" },
                    { Icon: CircleCheck, label: isSpanish ? "Validado" : "Validated" },
                    { Icon: Search, label: isSpanish ? "Fuentes fiables" : "Trusted sources" },
                    { Icon: BellRing, label: isSpanish ? "Alertas" : "Alerts" },
                  ].map((chip) => {
                    const Icon = chip.Icon;
                    return (
                      <span
                        key={chip.label}
                        role="img"
                        aria-label={chip.label}
                        title={chip.label}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-vyva-purple shadow-sm"
                      >
                        <Icon size={13} aria-hidden="true" />
                      </span>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={closeOffersPanel}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-vyva-text-2"
                aria-label={isSpanish ? "Cerrar" : "Close"}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>



            {savingsPanelView === "utilities" && (
            <div className="mt-4 rounded-[22px] border border-[#E8DCCF] bg-white p-4">
              <input
                ref={billInputRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={handleBillFileSelect}
                data-testid="input-offers-bill-photo"
              />
              <button
                type="button"
                onClick={() => setSavingsPanelView("overview")}
                className="mb-3 inline-flex rounded-full bg-[#FBF8F4] px-3 py-2 font-body text-[12px] font-semibold text-vyva-purple"
              >
                {isSpanish ? "Ahorra y mejora > Reducir gastos mensuales" : "Save and improve > Reduce monthly costs"}
              </button>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F5F3FF]">
                  <Zap size={20} style={{ color: "#6B21A8" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[16px] font-semibold leading-tight text-vyva-text-1">
                    {isSpanish ? "Revisa tus facturas y servicios" : "Review your bills and services"}
                  </p>
                  <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                    {isSpanish
                      ? "Empiece con luz y gas en España. VYVA normaliza los datos y compara opciones oficiales u orientativas."
                      : "Start with electricity and gas in Spain. VYVA normalizes the details and compares official or fallback options."}
                  </p>
                </div>
              </div>

              <p className="mt-4 font-body text-[15px] font-semibold text-vyva-text-1">
                {isSpanish ? "Como quiere revisar su factura?" : "How would you like to review your bill?"}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {UTILITY_INPUT_METHODS.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.key}
                      type="button"
                      onClick={() => {
                        resetUtilityReview(method.key);
                        if (method.key === "upload" || method.key === "photo") {
                          window.setTimeout(() => billInputRef.current?.click(), 0);
                        }
                      }}
                      className={`vyva-tap rounded-[17px] border px-3 py-3 text-left ${
                        utilityMethod === method.key ? "border-vyva-purple bg-[#F5F3FF]" : "border-vyva-border bg-[#FFFCF7]"
                      }`}
                    >
                      <span className="flex items-center gap-2 font-body text-[14px] font-semibold text-vyva-text-1">
                        <Icon size={16} className="text-vyva-purple" />
                        {isSpanish ? method.es : method.en}
                      </span>
                    </button>
                  );
                })}
              </div>

              {(utilityMethod === "upload" || utilityMethod === "photo") && (
                <div className="mt-3 rounded-[16px] bg-[#F5F3FF] px-3 py-2 font-body text-[13px] leading-relaxed text-vyva-text-2">
                  {isSpanish
                    ? "La foto o PDF se usa solo para leer la factura. No se guarda."
                    : "The photo or PDF is only used to read the bill. It is not stored."}
                </div>
              )}

              {billAnalysisError && (
                <p className="mt-3 rounded-[16px] bg-[#FFF7ED] px-3 py-2 font-body text-[13px] leading-relaxed text-[#9A3412]">
                  {billAnalysisError}
                </p>
              )}

              {billAnalysisLoading && (
                <div className="mt-3 flex items-center gap-2 rounded-[16px] bg-[#FFFCF7] px-3 py-3 font-body text-[13px] text-vyva-text-2">
                  <Loader2 size={16} className="animate-spin text-vyva-purple" />
                  {isSpanish ? "Leyendo factura..." : "Reading bill..."}
                </div>
              )}

              {utilityMethod === "voice" && !utilityNormalized && (
                <div className="mt-4 rounded-[18px] border border-vyva-border bg-[#FFFCF7] p-3">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                    {isSpanish ? "Pregunta breve" : "Short question"}
                  </p>
                  <p className="mt-2 font-body text-[16px] font-semibold leading-snug text-vyva-text-1">
                    {isSpanish ? UTILITY_VOICE_QUESTIONS[utilityVoiceStep].es : UTILITY_VOICE_QUESTIONS[utilityVoiceStep].en}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={utilityVoiceDraft}
                      onChange={(e) => setUtilityVoiceDraft(e.target.value)}
                      placeholder={isSpanish ? "Responda aqui..." : "Answer here..."}
                      className="h-[44px] rounded-full border-vyva-border bg-white font-body text-[14px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startUtilityVoiceDictation}
                      className="h-[44px] rounded-full border-vyva-border bg-white px-3"
                      aria-label={isSpanish ? "Dictar respuesta" : "Dictate answer"}
                    >
                      <Mic size={16} />
                    </Button>
                    <Button
                      type="button"
                      onClick={handleUtilityVoiceNext}
                      disabled={!utilityVoiceDraft.trim() || utilityLoading}
                      className="h-[44px] rounded-full bg-vyva-purple px-4 font-body text-[13px]"
                    >
                      {utilityVoiceStep === UTILITY_VOICE_QUESTIONS.length - 1
                        ? (isSpanish ? "Preparar" : "Prepare")
                        : (isSpanish ? "Siguiente" : "Next")}
                    </Button>
                  </div>
                </div>
              )}

              {utilityMethod === "manual" && !utilityNormalized && (
                <div className="mt-4 rounded-[18px] border border-vyva-border bg-[#FFFCF7] p-3">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                    {isSpanish ? "Datos sencillos" : "Simple details"}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      value={utilityForm.utility_type}
                      onChange={(e) => setUtilityForm((prev) => ({ ...prev, utility_type: e.target.value }))}
                      className="h-[46px] rounded-[16px] border border-vyva-border bg-white px-3 font-body text-[14px]"
                    >
                      <option value="electricity">{isSpanish ? "Luz" : "Electricity"}</option>
                      <option value="gas">{isSpanish ? "Gas" : "Gas"}</option>
                      <option value="dual">{isSpanish ? "Luz + gas" : "Electricity + gas"}</option>
                    </select>
                    <Input value={utilityForm.postcode} onChange={(e) => setUtilityForm((prev) => ({ ...prev, postcode: e.target.value }))} placeholder={isSpanish ? "Codigo postal" : "Postcode"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                    <Input value={utilityForm.monthly_cost} onChange={(e) => setUtilityForm((prev) => ({ ...prev, monthly_cost: e.target.value }))} placeholder={isSpanish ? "Importe mensual aprox." : "Approx monthly cost"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                    <Input value={utilityForm.consumption_kwh} onChange={(e) => setUtilityForm((prev) => ({ ...prev, consumption_kwh: e.target.value }))} placeholder={isSpanish ? "Consumo kWh opcional" : "kWh optional"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                    <Input value={utilityForm.power_kw} onChange={(e) => setUtilityForm((prev) => ({ ...prev, power_kw: e.target.value }))} placeholder={isSpanish ? "Potencia kW opcional" : "Power kW optional"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                    <Input value={utilityForm.provider} onChange={(e) => setUtilityForm((prev) => ({ ...prev, provider: e.target.value }))} placeholder={isSpanish ? "Compania actual opcional" : "Current provider optional"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                  </div>
                  <Button type="button" onClick={handleNormalizeManualUtility} disabled={utilityLoading} className="mt-3 h-[42px] rounded-full bg-vyva-purple px-4 font-body text-[13px]">
                    {utilityLoading ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CircleCheck size={15} className="mr-2" />}
                    {isSpanish ? "Preparar comparacion" : "Prepare comparison"}
                  </Button>
                </div>
              )}

              {utilityNormalized && (
                <div className="mt-3 rounded-[18px] border border-vyva-border bg-[#FFFCF7] p-3">
                  {(() => {
                    const postcodeMissing = !hasFieldValue(utilityNormalized.postcode);
                    const blockingMissingFields = utilityNormalized.missing_fields.filter((field) => !field.startsWith("estimated:"));
                    const shownMissingFields = blockingMissingFields.filter((field) => !(field === "postcode" && !postcodeMissing));
                    const estimatedFields = utilityNormalized.missing_fields.filter((field) => field.startsWith("estimated:"));
                    const detailLabels = [...shownMissingFields, ...estimatedFields].map((field) => utilityDetailLabel(field, isSpanish));
                    const consumptionEstimated = utilityNormalized.missing_fields.includes("estimated:consumption_kwh");
                    const powerEstimated = utilityNormalized.missing_fields.includes("estimated:power_kw");

                    return (
                      <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                        {isSpanish ? "He encontrado estos datos en su factura:" : "I found these details in your bill:"}
                      </p>
                      <p className="mt-1 font-body text-[16px] font-semibold text-vyva-text-1">
                        {utilityTypeLabel(utilityNormalized.utility_type, isSpanish)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 font-body text-[12px] font-semibold ${
                      utilityNormalized.confidence >= 0.75
                        ? "bg-[#ECFDF5] text-[#0A7C4E]"
                        : utilityNormalized.confidence >= 0.45
                          ? "bg-[#FEF3C7] text-[#92400E]"
                          : "bg-[#FEE2E2] text-[#B91C1C]"
                    }`}>
                      {isSpanish ? "Confianza" : "Confidence"}: {Math.round(utilityNormalized.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-[14px] bg-white p-3">
                      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.10em] text-vyva-text-2">
                        {isSpanish ? "Compania" : "Provider"}
                      </p>
                      <Input value={utilityNormalized.provider} onChange={(e) => updateUtilityNormalizedField("provider", e.target.value)} placeholder={isSpanish ? "No visible" : "Not visible"} className="mt-1 h-[38px] rounded-[12px] border-vyva-border bg-white font-body text-[14px]" />
                    </div>
                    <div className={`rounded-[14px] p-3 ${postcodeMissing ? "border border-[#FDBA74] bg-[#FFF7ED]" : "bg-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                      <p className={`font-body text-[11px] font-semibold uppercase tracking-[0.10em] ${postcodeMissing ? "text-[#9A3412]" : "text-vyva-text-2"}`}>
                        {isSpanish ? "Codigo postal" : "Postcode"}
                      </p>
                      {postcodeMissing && (
                        <span className="font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-[#C2410C]">
                          {isSpanish ? "Necesario" : "Required"}
                        </span>
                      )}
                      </div>
                      <Input
                        value={utilityNormalized.postcode}
                        onChange={(e) => updateUtilityNormalizedField("postcode", e.target.value)}
                        placeholder={isSpanish ? "Escriba su codigo postal" : "Enter postcode"}
                        className={`mt-1 h-[38px] rounded-[12px] bg-white font-body text-[14px] ${postcodeMissing ? "border-[#FB923C] focus-visible:ring-[#FB923C]" : "border-vyva-border"}`}
                      />
                      {postcodeMissing && (
                        <p className="mt-2 font-body text-[11px] leading-snug text-[#9A3412]">
                          {isSpanish
                            ? "No aparece de forma fiable en la factura. Escríbalo para comparar opciones de su zona."
                            : "It was not found reliably on the bill. Enter it to compare options in your area."}
                        </p>
                      )}
                    </div>
                    <div className={`rounded-[14px] p-3 ${consumptionEstimated ? "border border-[#FDE68A] bg-[#FFFBEB]" : "bg-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.10em] text-vyva-text-2">
                          {isSpanish ? "Consumo" : "Usage"}
                        </p>
                        {consumptionEstimated && (
                          <span className="rounded-full bg-white px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-[#92400E]">
                            {isSpanish ? "Estimado" : "Estimated"}
                          </span>
                        )}
                      </div>
                      <Input value={fieldValue(utilityNormalized.consumption_kwh, "")} onChange={(e) => updateUtilityNormalizedField("consumption_kwh", e.target.value)} placeholder="kWh" className={`mt-1 h-[38px] rounded-[12px] bg-white font-body text-[14px] ${consumptionEstimated ? "border-[#FBBF24] focus-visible:ring-[#FBBF24]" : "border-vyva-border"}`} />
                      {consumptionEstimated && (
                        <p className="mt-2 font-body text-[11px] leading-snug text-[#92400E]">
                          {isSpanish
                            ? "VYVA lo ha estimado desde el importe. Corrijalo si ve el kWh exacto en la factura."
                            : "VYVA estimated this from the amount. Correct it if you see the exact kWh on the bill."}
                        </p>
                      )}
                    </div>
                    <div className={`rounded-[14px] p-3 ${powerEstimated ? "border border-[#FDE68A] bg-[#FFFBEB]" : "bg-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.10em] text-vyva-text-2">
                          {isSpanish ? "Potencia contratada" : "Contracted power"}
                        </p>
                        {powerEstimated && (
                          <span className="rounded-full bg-white px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-[#92400E]">
                            {isSpanish ? "Estimado" : "Estimated"}
                          </span>
                        )}
                      </div>
                      <Input value={fieldValue(utilityNormalized.power_kw, "")} onChange={(e) => updateUtilityNormalizedField("power_kw", e.target.value)} placeholder="kW" className={`mt-1 h-[38px] rounded-[12px] bg-white font-body text-[14px] ${powerEstimated ? "border-[#FBBF24] focus-visible:ring-[#FBBF24]" : "border-vyva-border"}`} />
                      {powerEstimated && (
                        <p className="mt-2 font-body text-[11px] leading-snug text-[#92400E]">
                          {isSpanish
                            ? "Estimacion segura para comparar. Puede cambiarla si aparece en la factura."
                            : "Safe estimate for comparison. You can change it if it appears on the bill."}
                        </p>
                      )}
                    </div>
                    <div className="rounded-[14px] bg-white p-3 sm:col-span-2">
                      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.10em] text-vyva-text-2">
                        {isSpanish ? "Importe total / mensual" : "Total / monthly amount"}
                      </p>
                      <Input value={fieldValue(utilityNormalized.total_cost, "")} onChange={(e) => updateUtilityNormalizedField("total_cost", e.target.value)} placeholder="€" className="mt-1 h-[38px] rounded-[12px] border-vyva-border bg-white font-body text-[14px]" />
                    </div>
                  </div>

                  {detailLabels.length > 0 && (
                    <p className="mt-3 rounded-[14px] bg-white px-3 py-2 font-body text-[12px] leading-relaxed text-vyva-text-2">
                      {isSpanish ? "Datos pendientes o estimados: " : "Pending or estimated details: "}
                      {detailLabels.join(", ")}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      data-testid="button-utilities-compare"
                      onClick={handleCompareUtility}
                      disabled={utilityLoading}
                      className="h-[42px] rounded-full bg-vyva-purple px-4 font-body text-[13px] hover:bg-vyva-purple/90 disabled:opacity-50"
                    >
                      {utilityLoading ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CircleCheck size={15} className="mr-2" />}
                      {isSpanish ? "Comparar opciones" : "Compare options"}
                    </Button>
                  </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {utilityError && (
                <p className="mt-3 rounded-[16px] bg-[#FFF7ED] px-3 py-2 font-body text-[13px] leading-relaxed text-[#9A3412]">
                  {utilityError}
                </p>
              )}
              {utilityNotice && (
                <p className="mt-3 rounded-[16px] bg-[#F0FDF4] px-3 py-2 font-body text-[13px] leading-relaxed text-[#166534]">
                  {utilityNotice}
                </p>
              )}

              {utilityResult && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-[18px] border border-[#BBF7D0] bg-[#F0FDF4] p-3">
                    <p className="font-body text-[18px] font-semibold text-vyva-text-1">
                      {utilityResult.summary.headline}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                      {isSpanish ? "Actualmente paga aproximadamente " : "You currently pay approximately "}
                      <strong>{formatEuro(utilityResult.summary.current_monthly_cost, isSpanish)}</strong>.
                      {" "}
                      {isSpanish ? "La mejor opcion encontrada estima " : "The best option found estimates "}
                      <strong>{formatEuro(utilityResult.summary.best_estimated_monthly_cost, isSpanish)}</strong>.
                      {" "}
                      {isSpanish ? "Ahorro estimado: " : "Estimated saving: "}
                      <strong>{formatEuro(utilityResult.summary.estimated_monthly_savings, isSpanish)}</strong>.
                    </p>
                  </div>

                  <div data-testid="panel-utility-validation-trail" className="rounded-[20px] border border-[#D9C7B6] bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
                        <Eye size={19} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-body text-[15px] font-semibold leading-tight text-vyva-text-1">
                          {isSpanish ? "Validacion de factura" : "Bill validation trail"}
                        </p>
                        <p className="mt-1 font-body text-[12px] leading-relaxed text-vyva-text-2">
                          {utilityResult.source_note || (isSpanish
                            ? "VYVA separa datos leidos, estimaciones y fuentes antes de recomendar."
                            : "VYVA separates read details, estimates, and sources before recommending.")}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {[
                        isSpanish ? "Datos normalizados antes de comparar." : "Details normalized before comparison.",
                        utilityResult.source_used === "CNMC"
                          ? (isSpanish ? "Comparacion con fuente oficial CNMC." : "Compared with the official CNMC source.")
                          : (isSpanish ? "Fuente alternativa marcada como orientativa." : "Fallback source clearly marked as indicative."),
                        isSpanish ? "Ahorros y costes son estimaciones, no promesas." : "Savings and costs are estimates, not promises.",
                        isSpanish ? "VYVA pide confirmacion antes de cambiar o compartir datos." : "VYVA asks for confirmation before switching or sharing details.",
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-2 rounded-[14px] bg-[#FBF8F4] px-3 py-2">
                          <CircleCheck size={15} className="mt-0.5 shrink-0 text-[#0A7C4E]" aria-hidden="true" />
                          <span className="font-body text-[12px] leading-relaxed text-vyva-text-2">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        isSpanish ? "subida de precio" : "price increase",
                        isSpanish ? "fin de permanencia" : "commitment end",
                        isSpanish ? "mejor tarifa nueva" : "better new tariff",
                        isSpanish ? "dato pendiente" : "missing detail",
                      ].map((item) => (
                        <span key={item} className="inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] px-3 py-1 font-body text-[12px] text-[#0A7C4E]">
                          <BellRing size={12} aria-hidden="true" />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {utilityResult.results.map((result, index) => {
                    const optionUrl = utilityOptionUrl(result, utilityResult);
                    return (
                    <div key={`${result.provider}-${result.tariff_name}-${index}`} className="rounded-[20px] border border-vyva-border bg-white p-4">
                      <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                        {index === 0 ? (isSpanish ? "Opcion recomendada" : "Recommended option") : index === 1 ? (isSpanish ? "Mas economica" : "Cheapest") : (isSpanish ? "Mas estable / sencilla" : "Most stable / simple")}
                      </p>
                      <p className="mt-1 font-body text-[17px] font-semibold text-vyva-text-1">{result.provider}</p>
                      <p className="font-body text-[13px] text-vyva-text-2">{result.tariff_name}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-[14px] bg-[#F5F3FF] p-3">
                          <p className="font-body text-[11px] uppercase tracking-[0.10em] text-vyva-text-2">{isSpanish ? "Coste estimado" : "Estimated cost"}</p>
                          <p className="font-body text-[15px] font-semibold text-vyva-text-1">{formatEuro(result.estimated_monthly_cost, isSpanish)}/mes</p>
                        </div>
                        <div className="rounded-[14px] bg-[#ECFDF5] p-3">
                          <p className="font-body text-[11px] uppercase tracking-[0.10em] text-vyva-text-2">{isSpanish ? "Ahorro" : "Saving"}</p>
                          <p className="font-body text-[15px] font-semibold text-[#0A7C4E]">{formatEuro(result.estimated_monthly_savings, isSpanish)}/mes</p>
                        </div>
                      </div>
                      {optionUrl && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleUtilityOptionReview(result, optionUrl)}
                            data-testid={`button-utility-option-review-${index}`}
                            className="h-[40px] rounded-full border-vyva-purple/20 bg-[#F5F3FF] px-4 font-body text-[13px] font-semibold text-vyva-purple"
                          >
                            <ShieldCheck size={15} className="mr-2" />
                            {utilityOptionActionLabel(result, optionUrl)}
                          </Button>
                          <span
                            data-testid={`badge-utility-option-gated-${index}`}
                            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#DDD6FE] bg-white px-4 font-body text-[13px] font-bold text-vyva-purple"
                          >
                            <ShieldCheck size={15} />
                            {isSpanish ? "Enlace tras tu OK" : "Link after your OK"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                  })}

                  <div className="rounded-[18px] border border-vyva-border bg-white p-3">
                    <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                      {isSpanish ? "Como lo he calculado" : "How I calculated it"}
                    </p>
                    <p className="mt-1 font-body text-[12px] leading-relaxed text-vyva-text-2">{utilityResult.calculation_note}</p>
                    {utilityResult.estimated_note && <p className="mt-2 font-body text-[12px] leading-relaxed text-[#92400E]">{utilityResult.estimated_note}</p>}
                    <p className="mt-2 font-body text-[12px] leading-relaxed text-vyva-text-2">{utilityResult.neutrality_note}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { key: "whatsapp", es: "Enviar resumen por WhatsApp", en: "Send summary by WhatsApp" },
                      { key: "save", es: "Guardar revision", en: "Save review" },
                      { key: "remind", es: "Recordarme revisar de nuevo", en: "Remind me to review again" },
                      { key: "switch", es: "Ayudarme a cambiar", en: "Help me switch" },
                    ].map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => handleUtilityResultAction(action.key as "whatsapp" | "save" | "remind" | "switch")}
                        className="vyva-tap rounded-[16px] border border-vyva-border bg-white px-3 py-3 text-left font-body text-[13px] font-semibold text-vyva-text-1"
                      >
                        {isSpanish ? action.es : action.en}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {savingsPanelView === "overview" && (
              <>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(250px,0.82fr)_minmax(0,1.18fr)] lg:items-start">
              <div className="space-y-3">
                {providerSearchMode && (
                  <div
                    className="rounded-[20px] border border-[#C7E9E3] bg-[#F0FDFA] p-3"
                    data-testid="panel-provider-search-criteria"
                  >
                    <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0F766E]">
                      {isSpanish ? "Que importa mas" : "What matters most"}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                      {isSpanish
                        ? "VYVA ordena opciones por estos criterios y espera su confirmacion antes de contactar."
                        : "VYVA ranks options by these choices and waits for your confirmation before contact."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {PROVIDER_SEARCH_CRITERIA.map((criterion) => {
                        const selected = providerSearchCriteria.includes(criterion.key);
                        return (
                          <button
                            key={criterion.key}
                            type="button"
                            data-testid={`button-provider-criterion-${criterion.key}`}
                            aria-pressed={selected}
                            onClick={() => toggleProviderSearchCriterion(criterion.key)}
                            className={`vyva-tap rounded-full border px-3 py-2 font-body text-[12px] font-semibold ${
                              selected
                                ? "border-[#0F766E] bg-[#0F766E] text-white"
                                : "border-[#BFE7E1] bg-white text-[#0F766E]"
                            }`}
                          >
                            {isSpanish ? criterion.es : criterion.en}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-[20px] bg-white/90 p-3">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                    {isSpanish ? "Empiece aqui" : "Start here"}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {priorityOfferIdeas.map((idea, index) => {
                      const label = isSpanish ? idea.es : idea.en;
                      const query = isSpanish ? idea.queryEs : idea.queryEn;
                      const opensUtilityReview = shouldOpenUtilitySavingsReview(idea.es);
                      const visual = OFFER_STARTER_VISUALS[index] ?? OFFER_STARTER_VISUALS[0];
                      const Icon = visual.Icon;
                      return (
                        <button
                          key={idea.es}
                          type="button"
                          onClick={() => opensUtilityReview ? openUtilitySavingsReview() : handleOfferChipSearch(query)}
                          className="vyva-tap flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[15px] border border-[#E8DCCF] bg-[#FFFCF7] px-2 py-2 text-center font-body text-[12px] font-semibold leading-tight text-vyva-text-1"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: visual.bg, color: visual.color }}>
                            <Icon size={17} aria-hidden="true" />
                          </span>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[20px] bg-white/90 p-3">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                    {isSpanish ? "Categorias" : "Categories"}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-3">
                    {OFFER_CATEGORY_CHIPS.map((chip, index) => {
                      const label = isSpanish ? chip.es : chip.en;
                      const detail = isSpanish ? chip.detailEs : chip.detailEn;
                      const query = isSpanish ? chip.queryEs : chip.queryEn;
                      const opensUtilityReview = shouldOpenUtilitySavingsReview(chip.es);
                      const visual = OFFER_CATEGORY_VISUALS[index] ?? OFFER_CATEGORY_VISUALS[0];
                      const Icon = visual.Icon;
                      return (
                        <button
                          key={chip.es}
                          type="button"
                          aria-label={`${label}: ${detail}`}
                          onClick={() => opensUtilityReview ? openUtilitySavingsReview() : handleOfferChipSearch(query)}
                          className="vyva-tap flex min-h-[82px] flex-col items-start justify-between rounded-[15px] border px-3 py-2.5 text-left"
                          style={{ background: visual.bg, borderColor: visual.border }}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white" style={{ color: visual.color }}>
                            <Icon size={16} aria-hidden="true" />
                          </span>
                          <span className="block font-body text-[13px] font-semibold leading-tight text-vyva-text-1">
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[20px] border border-[#E8DCCF] bg-white p-3">
                  <label className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple" htmlFor="offers-query">
                    {isSpanish ? "Buscar" : "Search"}
                  </label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="offers-query"
                      data-testid="input-offers-query"
                      value={offersQuery}
                      onChange={(event) => setOffersQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleSearchOffers();
                        }
                      }}
                      placeholder={isSpanish ? "Seguro, luz, ayuda en casa..." : "Insurance, electricity, home help..."}
                      className="h-[44px] min-w-0 flex-1 rounded-full border-[#D9C7B6] bg-white font-body text-[14px]"
                    />
                    <Button
                      data-testid="button-offers-search"
                      onClick={() => handleSearchOffers()}
                      disabled={offersLoading || !offersQuery.trim()}
                      className="h-[44px] shrink-0 rounded-full bg-vyva-purple px-4 font-body text-[13px] hover:bg-vyva-purple/90"
                    >
                      {offersLoading ? <Loader2 size={16} className="animate-spin text-white" /> : (isSpanish ? "Buscar" : "Search")}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {offersLoading && (
                  <div className="flex items-center gap-2 rounded-[18px] bg-white p-3 font-body text-[13px] text-vyva-text-2">
                    <Loader2 size={16} className="animate-spin text-vyva-purple" />
                    {isSpanish ? "Validando opciones..." : "Validating options..."}
                  </div>
                )}

                {offersError && (
                  <p className="rounded-[16px] bg-white px-3 py-2 font-body text-[13px] text-[#B91C1C]">
                    {offersError}
                  </p>
                )}

                {!offersLoading && !offersError && !offersResult && (
                  <div className="rounded-[20px] border border-[#E8DCCF] bg-white/90 p-4">
                    <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                      {isSpanish ? "Elija una mejora o busque directamente." : "Choose an improvement or search directly."}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                      {isSpanish
                        ? "VYVA muestra la recomendacion y guarda la prueba detallada para cuando quiera verla."
                        : "VYVA shows the recommendation first and keeps the detailed proof one tap away."}
                    </p>
                  </div>
                )}

                {offersResult && (
                  <>
                    <div className="rounded-[18px] bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-[#C9890A]">
                          {offersResult.category}
                        </p>
                        <span
                          role="img"
                          aria-label={isSpanish ? "Recomendacion protegida" : "Protected recommendation"}
                          title={isSpanish ? "Recomendacion protegida" : "Protected recommendation"}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F3FF] text-vyva-purple"
                        >
                          <ShieldCheck size={15} aria-hidden="true" />
                        </span>
                      </div>
                      <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                        {offersResult.decision_explanation}
                      </p>
                    </div>

                    {(() => {
                      const protection = offersResult.protection_summary ?? offerProtectionFallback(isSpanish);
                      const sourceGuidance = sourceGuidanceFor(offersResult, isSpanish);
                      const sourceCountLabel = isSpanish
                        ? `${sourceGuidance.length} fuentes`
                        : `${sourceGuidance.length} sources`;
                      const summaryChips = [
                        isSpanish ? "Independiente" : "Independent",
                        sourceCountLabel,
                        isSpanish ? "Usted confirma" : "You confirm",
                      ];
                      return (
                        <div data-testid="panel-offers-objective-summary" className="rounded-[20px] border border-[#BBF7D0] bg-[#F0FDF4] p-3">
                          <button
                            type="button"
                            data-testid="button-offers-objective-toggle"
                            onClick={() => setObjectiveProofOpen((open) => !open)}
                            aria-expanded={objectiveProofOpen}
                            className="flex w-full items-center justify-between gap-3 text-left"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-white text-[#0A7C4E]">
                                <ShieldCheck size={18} aria-hidden="true" />
                              </span>
                              <span>
                                <span className="block font-body text-[15px] font-semibold leading-tight text-vyva-text-1">
                                  {isSpanish ? "Por que es objetivo" : "Why this is objective"}
                                </span>
                                <span className="mt-0.5 block font-body text-[12px] leading-snug text-[#166534]">
                                  {protection.title}
                                </span>
                              </span>
                            </span>
                            {objectiveProofOpen ? <ChevronUp size={16} className="shrink-0 text-[#0A7C4E]" /> : <ChevronDown size={16} className="shrink-0 text-[#0A7C4E]" />}
                          </button>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {summaryChips.map((chip) => (
                              <span key={chip} className="rounded-full bg-white px-3 py-1 font-body text-[12px] font-semibold text-[#166534]">
                                {chip}
                              </span>
                            ))}
                          </div>
                          {objectiveProofOpen && (
                            <div data-testid="panel-offers-objective-details" className="mt-3 grid gap-2">
                              <p className="rounded-[15px] bg-white/80 px-3 py-2 font-body text-[12px] leading-relaxed text-[#166534]">
                                {protection.action_guardrail}
                              </p>
                              <div className="rounded-[15px] bg-white/80 p-3">
                                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A7C4E]">
                                  {isSpanish ? "Fuentes" : "Sources"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {sourceGuidance.map((source) => (
                                    <span key={source} className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[12px] text-[#166534]">
                                      {source}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-[15px] bg-white/80 p-3">
                                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A7C4E]">
                                  {isSpanish ? "Validaciones" : "Checkpoints"}
                                </p>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  {protection.checkpoints.map((checkpoint) => (
                                    <span key={checkpoint} className="flex items-start gap-2 font-body text-[12px] leading-snug text-vyva-text-2">
                                      <CircleCheck size={14} className="mt-0.5 shrink-0 text-[#0A7C4E]" aria-hidden="true" />
                                      {checkpoint}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-[15px] bg-white/80 p-3">
                                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A7C4E]">
                                  {isSpanish ? "Alertas" : "Alerts"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {protection.notification_triggers.map((trigger) => (
                                    <span key={trigger} className="inline-flex items-center gap-1 rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[12px] text-vyva-purple">
                                      <BellRing size={12} aria-hidden="true" />
                                      {trigger}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {offersResult.options.length === 0 ? (
                      <div className="rounded-[18px] bg-white p-4">
                        <p className="font-body text-[14px] leading-relaxed text-vyva-text-1">
                          {offersResult.no_results_message || (isSpanish
                            ? "No hay suficientes opciones verificables ahora mismo."
                            : "There are not enough verifiable options right now.")}
                        </p>
                        {providerSearchMode && (
                          <div className="mt-3">
                            <MissingProviderChoicePanel
                              title={isSpanish ? "Elige como continuar" : "Choose how to continue"}
                              body={isSpanish
                                ? "Puedes guardar tu proveedor habitual, pedir a VYVA que busque opciones o pedir ayuda para configurarlo."
                                : "You can save your usual provider, ask VYVA to search for options, or ask someone trusted to help set it up."}
                              addLabel={isSpanish ? "Anadir mi proveedor" : "Add my usual provider"}
                              addDetail={isSpanish ? "Guardarlo para usarlo primero" : "Save it for next time"}
                              findLabel={isSpanish ? "Que VYVA busque" : "Ask VYVA to search"}
                              findDetail={isSpanish ? "Con criterios seguros" : "With safe criteria"}
                              helperLabel={isSpanish ? "Pedir ayuda" : "Ask someone to help"}
                              helperDetail={isSpanish ? "Familia o cuidador" : "Family or caregiver setup"}
                              onAddProvider={openProviderSearchSetup}
                              onFindOptions={handleProviderManualSearch}
                              onAskHelper={() => openProviderSetupHelper("Ask trusted helper to set up provider search", {
                                kind: "provider_search",
                                mode: providerSearchMode,
                                query: offersQuery.trim(),
                                criteria: providerSearchCriteria,
                              })}
                              testId="panel-provider-search-missing-provider"
                              addTestId="button-provider-search-setup"
                              findTestId="button-provider-search-manual"
                              helperTestId="button-provider-search-ask-helper"
                              isSpanish={isSpanish}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <ProviderComparisonPanel
                          options={providerComparisonOptions}
                          locale={locale}
                          shortlistedIds={providerShortlistIds}
                          shortlistSaved={Boolean(providerShortlistNotice)}
                          shortlistSaving={providerShortlistMutation.isPending}
                          onToggleShortlist={toggleProviderShortlist}
                          onSaveShortlist={(options) => providerShortlistMutation.mutate(options)}
                          onSaveProvider={handleSaveComparisonProvider}
                          onPrepareContact={handlePrepareComparisonContact}
                          onWatch={providerSearchMode ? undefined : (option) => {
                            const comparisonIndex = providerComparisonOptions.findIndex((candidate) => candidate.id === option.id);
                            const raw = comparisonIndex >= 0 ? offersResult.options[comparisonIndex] : undefined;
                            if (raw) handleOfferWatch(raw);
                          }}
                        />
                        {providerShortlistNotice && (
                          <p
                            data-testid="notice-provider-shortlist"
                            className="rounded-lg border border-[#BFE7E1] bg-[#F0FDFA] px-3 py-2 font-body text-[13px] font-semibold text-[#0F766E]"
                          >
                            {providerShortlistNotice}
                          </p>
                        )}
                        {providerShortlistError && (
                          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-body text-[13px] text-red-700">
                            {providerShortlistError}
                          </p>
                        )}
                      </div>
                    )}

                    <p className="rounded-[16px] border border-vyva-border bg-white px-3 py-2 font-body text-[12px] leading-relaxed text-vyva-text-2">
                      {offersResult.neutrality_note} {offersResult.next_step}
                    </p>
                  </>
                )}
              </div>
            </div>
              </>
            )}
          </div>
        )}
      </section> : null}

        </>
      )}

    </MasterDashboardLayout>
  );
};

export default ConciergeScreen;
