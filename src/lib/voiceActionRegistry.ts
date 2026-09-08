import type {
  VoiceAppAction,
  VoiceAppActionDomain,
  VoiceSpecialistTransferDomain,
} from "@/lib/voiceNavigation";

export type VoiceActionSafetyLevel = "routine" | "sensitive" | "medical" | "urgent";
export type VoiceActionCompletionMode = "manual" | "route_landed";

export type VoiceActionRegistryEntry = {
  actionType: string;
  aliases: readonly string[];
  id: string;
  domain: VoiceAppActionDomain;
  route: string;
  title: string;
  summary: string;
  cue: string;
  priority: VoiceAppAction["priority"];
  feedbackReason: string;
  requiredPayloadKeys: readonly string[];
  optionalPayloadKeys: readonly string[];
  safetyLevel: VoiceActionSafetyLevel;
  requiresConfirmation: boolean;
  completion: {
    mode: VoiceActionCompletionMode;
    doneLabel: string;
    routeLandedDelayMs?: number;
    expiresAfterMs: number;
  };
};

export const VOICE_ACTION_REGISTRY = {
  "meds.management": {
    actionType: "meds.management",
    aliases: ["meds_management", "medications", "medication"],
    id: "voice_meds_management",
    domain: "meds",
    route: "/meds",
    title: "Medication management",
    summary: "Opening the medication page for schedule, dose, refill, and routine support.",
    cue: "Use the medication profile and ask what part of the routine they want to review.",
    priority: "high",
    feedbackReason: "Agent requested medication management context.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["medication_name", "routine_focus", "dose_time"],
    safetyLevel: "medical",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "meds.refill_request": {
    actionType: "meds.refill_request",
    aliases: ["meds_refill_request", "refill", "medicine_refill", "more_medicine"],
    id: "voice_meds_refill_request",
    domain: "meds",
    route: "/meds/adherence-report",
    title: "Medication refill",
    summary: "Opening medication stock and adherence context before preparing refill help.",
    cue: "Check the medication name, supply concern, and pharmacy preference before any refill or pharmacy contact.",
    priority: "high",
    feedbackReason: "User asked for medication refill or more medicine.",
    requiredPayloadKeys: ["medication_name"],
    optionalPayloadKeys: ["supply_concern", "days_remaining", "pharmacy_preference"],
    safetyLevel: "medical",
    requiresConfirmation: true,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "meds.inventory_report": {
    actionType: "meds.inventory_report",
    aliases: ["meds_inventory_report", "inventory", "stock", "adherence"],
    id: "voice_meds_inventory_report",
    domain: "meds",
    route: "/meds/adherence-report",
    title: "Medication check",
    summary: "Opening the medication report so VYVA can use adherence and stock context.",
    cue: "Review medication confirmations, missed doses, and practical next steps.",
    priority: "high",
    feedbackReason: "Agent requested medication stock, adherence, or refill context.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["medication_name", "inventory_question", "days_remaining"],
    safetyLevel: "medical",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "health.vitals_capture": {
    actionType: "health.vitals_capture",
    aliases: ["vitals_capture", "capture_vitals", "measure_vitals", "record_vitals"],
    id: "voice_vitals_capture",
    domain: "health",
    route: "/health/vitals",
    title: "Capture vitals",
    summary: "Opening vitals capture so the user can add a reading while VYVA stays with them.",
    cue: "Help capture one reading at a time and confirm before saving any new value.",
    priority: "high",
    feedbackReason: "User asked to measure, record, or add vitals.",
    requiredPayloadKeys: ["vital_type"],
    optionalPayloadKeys: ["reading_value", "reading_time", "capture_mode", "device_type"],
    safetyLevel: "medical",
    requiresConfirmation: true,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "health.vitals_review": {
    actionType: "health.vitals_review",
    aliases: ["vitals_review", "vitals", "blood_pressure"],
    id: "voice_vitals_review",
    domain: "health",
    route: "/health/vitals",
    title: "Vitals review",
    summary: "Opening vitals so VYVA can use the latest scan and trend context.",
    cue: "Review the latest vitals context without diagnosing.",
    priority: "high",
    feedbackReason: "Agent requested vitals context.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["vital_type", "reading_time", "trend_focus"],
    safetyLevel: "medical",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "health.doctor_support": {
    actionType: "health.doctor_support",
    aliases: ["doctor_health_support", "doctor", "gp"],
    id: "voice_doctor_health_support",
    domain: "health",
    route: "/health/doctor",
    title: "Doctor support",
    summary: "Opening doctor support so the conversation can use health profile context.",
    cue: "Use profile, GP, vitals, symptoms, and care context before asking repeat questions.",
    priority: "high",
    feedbackReason: "Agent requested doctor or health-support context.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["health_topic", "provider_type", "appointment_goal"],
    safetyLevel: "medical",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "health.symptom_support": {
    actionType: "health.symptom_support",
    aliases: ["symptom_support", "symptoms", "symptom"],
    id: "voice_symptom_support",
    domain: "health",
    route: "/health/symptom-check",
    title: "Symptom support",
    summary: "Opening symptom support so VYVA can help structure what is happening.",
    cue: "Ask one focused question at a time and stay away from diagnosis.",
    priority: "high",
    feedbackReason: "Agent requested symptom-support context.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["symptom", "severity", "started_at", "change_from_baseline"],
    safetyLevel: "medical",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "health.daily_checkin": {
    actionType: "health.daily_checkin",
    aliases: ["daily_checkin", "health_checkin", "check_in", "how_i_feel"],
    id: "voice_health_daily_checkin",
    domain: "health",
    route: "/health/check-in",
    title: "Daily check-in",
    summary: "Opening daily check-in so VYVA can capture how the user feels today.",
    cue: "Ask about mood, symptoms, medication, and vitals one step at a time before saving.",
    priority: "high",
    feedbackReason: "User asked for a daily check-in or how-they-feel review.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["mood", "symptom", "medication_note", "vitals_note"],
    safetyLevel: "medical",
    requiresConfirmation: true,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "safety.support": {
    actionType: "safety.support",
    aliases: ["safety_support", "safety", "emergency", "safe_home"],
    id: "voice_safety_support",
    domain: "safety",
    route: "/safe-home",
    title: "Safety support",
    summary: "Opening safety support for urgent help, falls, or immediate concerns.",
    cue: "Check immediate safety and whether emergency help or a caregiver is needed.",
    priority: "high",
    feedbackReason: "Agent requested safety support.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["risk_type", "location", "care_contact"],
    safetyLevel: "urgent",
    requiresConfirmation: true,
    completion: {
      mode: "manual",
      doneLabel: "Safe now",
      expiresAfterMs: 120000,
    },
  },
  "safety.scam_support": {
    actionType: "safety.scam_support",
    aliases: ["scam_support", "scam", "fraud"],
    id: "voice_scam_support",
    domain: "safety",
    route: "/scam-guard",
    title: "Scam support",
    summary: "Opening scam support so VYVA can help check the situation calmly.",
    cue: "Ask what happened and avoid asking for bank details.",
    priority: "high",
    feedbackReason: "Agent requested scam or fraud support.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["message_source", "requested_action", "risk_detail"],
    safetyLevel: "sensitive",
    requiresConfirmation: true,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 120000,
    },
  },
  "concierge.appointment_help": {
    actionType: "concierge.appointment_help",
    aliases: ["appointment_help", "book_health_appointment", "book_appointment"],
    id: "voice_book_health_appointment",
    domain: "concierge",
    route: "/concierge",
    title: "Appointment help",
    summary: "Opening Concierge to help plan, book, remind, or prepare for an appointment.",
    cue: "Offer help with booking, questions, reminders, transport, or provider contact.",
    priority: "high",
    feedbackReason: "Agent requested appointment support.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["provider_type", "appointment_reason", "date_preference", "location"],
    safetyLevel: "sensitive",
    requiresConfirmation: true,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "concierge.home_service": {
    actionType: "concierge.home_service",
    aliases: ["home_service", "trusted_provider", "provider_search"],
    id: "voice_concierge_home_service",
    domain: "concierge",
    route: "/concierge",
    title: "Home service help",
    summary: "Opening Concierge to prepare a trusted home-service request.",
    cue: "Ask the few service-specific questions needed, then prepare trusted options and require confirmation before contact.",
    priority: "high",
    feedbackReason: "Agent requested home-service support.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: [
      "intake_origin",
      "service_type",
      "urgency",
      "problem_summary",
      "problem_type",
      "active_flooding",
      "affected_area",
      "shutoff_status",
      "scope",
      "breaker_status",
      "safety_risk",
      "medical_device",
      "criteria",
      "access_notes",
    ],
    safetyLevel: "sensitive",
    requiresConfirmation: true,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "concierge.ride_booking": {
    actionType: "concierge.ride_booking",
    aliases: ["ride_booking", "book_ride", "taxi_booking", "transport_booking"],
    id: "voice_concierge_ride_booking",
    domain: "concierge",
    route: "/concierge",
    title: "Ride help",
    summary: "Opening Concierge transport support to prepare a ride without booking yet.",
    cue: "Gather pickup, destination, timing, and mobility needs, then require confirmation before booking or contacting anyone.",
    priority: "high",
    feedbackReason: "User asked to book, call, or arrange a ride.",
    requiredPayloadKeys: ["pickup", "destination", "time"],
    optionalPayloadKeys: ["mobility_needs", "ride_type", "care_contact"],
    safetyLevel: "sensitive",
    requiresConfirmation: true,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "concierge.order_request": {
    actionType: "concierge.order_request",
    aliases: ["order_request", "place_order", "grocery_order", "shopping_order"],
    id: "voice_concierge_order_request",
    domain: "concierge",
    route: "/concierge/shopping",
    title: "Order help",
    summary: "Opening shopping support to prepare an order request without checkout.",
    cue: "Clarify the items, budget, delivery timing, and substitutions before any checkout or provider contact.",
    priority: "high",
    feedbackReason: "User asked to order groceries, supplies, or products.",
    requiredPayloadKeys: ["items"],
    optionalPayloadKeys: ["budget", "delivery_time", "substitutions", "category", "constraint"],
    safetyLevel: "sensitive",
    requiresConfirmation: true,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "concierge.shopping": {
    actionType: "concierge.shopping",
    aliases: ["shopping_helper", "shopping", "groceries", "product_choice"],
    id: "voice_concierge_shopping",
    domain: "concierge",
    route: "/concierge/shopping",
    title: "Shopping helper",
    summary: "Opening Shopping Helper to compare simple product choices without checkout.",
    cue: "Ask what the user needs, compare a few bounded catalog choices, and avoid purchase or checkout steps.",
    priority: "medium",
    feedbackReason: "Agent requested shopping recommendation support.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["category", "need", "priority", "constraint"],
    safetyLevel: "sensitive",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "concierge.task": {
    actionType: "concierge.task",
    aliases: ["concierge_task", "concierge", "appointment_help"],
    id: "voice_concierge_task",
    domain: "concierge",
    route: "/concierge",
    title: "Concierge help",
    summary: "Opening Concierge for appointments, transport, shopping, reminders, or planning.",
    cue: "Turn the request into one practical next step and confirm before taking action.",
    priority: "medium",
    feedbackReason: "Agent requested concierge support.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["task_type", "provider", "date_preference", "location"],
    safetyLevel: "sensitive",
    requiresConfirmation: true,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "concierge.reminder": {
    actionType: "concierge.reminder",
    aliases: ["reminder", "set_reminder", "scheduled_support", "schedule_reminder"],
    id: "voice_concierge_reminder",
    domain: "concierge",
    route: "/settings/scheduled-support",
    title: "Reminder help",
    summary: "Opening scheduled support so VYVA can prepare a reminder.",
    cue: "Confirm the reminder text, time, recurrence, and recipient before saving.",
    priority: "medium",
    feedbackReason: "User asked VYVA to remind them or schedule support.",
    requiredPayloadKeys: ["reminder_text", "reminder_time"],
    optionalPayloadKeys: ["recurrence", "recipient", "support_type"],
    safetyLevel: "sensitive",
    requiresConfirmation: true,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "brain.activity": {
    actionType: "brain.activity",
    aliases: ["brain_activity", "brain_exercise", "cognitive", "cognitive_exercise", "activity", "activities"],
    id: "voice_brain_activity",
    domain: "brain_coach",
    route: "/mind-memory",
    title: "Mind & Memory",
    summary: "Opening Mind & Memory for games, practice, and friendly brain-coach support.",
    cue: "Offer a light activity and keep encouragement available.",
    priority: "medium",
    feedbackReason: "Agent requested brain-coach activity context.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["activity_type", "difficulty", "encouragement_style"],
    safetyLevel: "routine",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "brain.memory_game": {
    actionType: "brain.memory_game",
    aliases: ["memory_game", "memory", "game"],
    id: "voice_memory_game",
    domain: "brain_coach",
    route: "/brain-coach/remember",
    title: "Memory games",
    summary: "Opening memory games so the Brain Coach can keep the user company while playing.",
    cue: "Encourage the user and offer a gentle game choice.",
    priority: "medium",
    feedbackReason: "Agent requested memory game context.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["game_type", "difficulty", "encouragement_style"],
    safetyLevel: "routine",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "brain.relax_breathe": {
    actionType: "brain.relax_breathe",
    aliases: ["relax_breathe", "breathing", "relax", "calm"],
    id: "voice_brain_relax_breathe",
    domain: "brain_coach",
    route: "/activities/relax-breathe",
    title: "Relax and breathe",
    summary: "Opening a calm breathing activity with VYVA as a gentle coach.",
    cue: "Keep instructions short, calm, and easy to interrupt.",
    priority: "medium",
    feedbackReason: "User asked to relax, breathe, or calm down.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["duration", "comfort_preference"],
    safetyLevel: "routine",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "brain.focus": {
    actionType: "brain.focus",
    aliases: ["focus", "attention", "attention_booster"],
    id: "voice_brain_focus",
    domain: "brain_coach",
    route: "/brain-coach/focus",
    title: "Focus practice",
    summary: "Opening attention boosters for a short focus exercise.",
    cue: "Offer one simple focus activity and adapt to the time available.",
    priority: "medium",
    feedbackReason: "User asked for focus or attention support.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["duration", "activity_type"],
    safetyLevel: "routine",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "brain.learn": {
    actionType: "brain.learn",
    aliases: ["learn", "learning", "learn_something"],
    id: "voice_brain_learn",
    domain: "brain_coach",
    route: "/learn",
    title: "Learning",
    summary: "Opening learning activities so VYVA can suggest a topic.",
    cue: "Ask for a topic, language, or difficulty only if it is missing.",
    priority: "medium",
    feedbackReason: "User asked to learn something.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["topic", "language", "difficulty"],
    safetyLevel: "routine",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "brain.senses": {
    actionType: "brain.senses",
    aliases: ["senses", "sensory", "train_senses"],
    id: "voice_brain_senses",
    domain: "brain_coach",
    route: "/brain-coach/calm",
    title: "Senses practice",
    summary: "Opening sensory activities for gentle smell, sound, and association practice.",
    cue: "Offer a sensory activity choice and keep the pace gentle.",
    priority: "medium",
    feedbackReason: "User asked for senses or sensory training.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["activity_type", "difficulty"],
    safetyLevel: "routine",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "social.companion_chat": {
    actionType: "social.companion_chat",
    aliases: ["companion_chat", "companion", "talk_to_someone", "company"],
    id: "voice_social_companion_chat",
    domain: "social",
    route: "/companions",
    title: "Companion chat",
    summary: "Opening companion support for a private, one-to-one conversation.",
    cue: "Keep the conversation warm and private unless the user asks for community.",
    priority: "medium",
    feedbackReason: "User asked for companionship or someone to talk to.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["conversation_style", "interest", "mood"],
    safetyLevel: "routine",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "social.rooms": {
    actionType: "social.rooms",
    aliases: ["social_rooms", "social", "companion"],
    id: "voice_social_rooms",
    domain: "social",
    route: "/social-rooms",
    title: "Social rooms",
    summary: "Opening social rooms so VYVA can suggest a warm connection around interests.",
    cue: "Use interests and recent social context to suggest one room or chat topic.",
    priority: "medium",
    feedbackReason: "Agent requested social or companion context.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["interest", "room_slug", "conversation_style"],
    safetyLevel: "routine",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
  "reports.history": {
    actionType: "reports.history",
    aliases: ["reports_history", "reports", "history"],
    id: "voice_reports_history",
    domain: "reports",
    route: "/informes",
    title: "Reports",
    summary: "Opening reports so VYVA can reference previous scans and health summaries.",
    cue: "Use report history only when relevant to the user's question.",
    priority: "medium",
    feedbackReason: "Agent requested reports or history context.",
    requiredPayloadKeys: [],
    optionalPayloadKeys: ["report_type", "time_period", "focus"],
    safetyLevel: "medical",
    requiresConfirmation: false,
    completion: {
      mode: "manual",
      doneLabel: "Done",
      expiresAfterMs: 90000,
    },
  },
} as const satisfies Record<string, VoiceActionRegistryEntry>;

export const VOICE_SPECIALIST_AGENT_SLUGS: Partial<Record<VoiceSpecialistTransferDomain, string>> = {
  meds: "meds",
  health: "dr-ai",
  doctor: "doctor",
  safety: "safety",
  concierge: "concierge",
  brain_coach: "brain-coach",
  social: "companion",
  companion: "companion",
};

const DOMAIN_TO_ACTION_TYPE: Record<VoiceAppActionDomain, keyof typeof VOICE_ACTION_REGISTRY> = {
  meds: "meds.management",
  health: "health.doctor_support",
  safety: "safety.support",
  concierge: "concierge.task",
  brain_coach: "brain.activity",
  social: "social.rooms",
  reports: "reports.history",
};

const SPECIALIST_TO_ACTION_TYPE: Record<VoiceSpecialistTransferDomain, keyof typeof VOICE_ACTION_REGISTRY> = {
  meds: "meds.management",
  health: "health.doctor_support",
  doctor: "health.doctor_support",
  safety: "safety.support",
  concierge: "concierge.task",
  brain_coach: "brain.activity",
  social: "social.rooms",
  companion: "social.companion_chat",
  reports: "reports.history",
};

const REGISTRY_ENTRIES = Object.values(VOICE_ACTION_REGISTRY);
const ACTION_ID_TO_ENTRY = new Map(REGISTRY_ENTRIES.map((entry) => [entry.id, entry]));
const ROUTE_TO_ENTRY = new Map(REGISTRY_ENTRIES.map((entry) => [entry.route, entry]));
const ACTION_TYPE_TO_ENTRY = (() => {
  const map = new Map<string, VoiceActionRegistryEntry>();
  REGISTRY_ENTRIES.forEach((entry) => {
    if (!map.has(entry.actionType)) map.set(entry.actionType, entry);
    entry.aliases.forEach((alias) => {
      if (!map.has(alias)) map.set(alias, entry);
    });
  });
  return map;
})();

export function voiceActionRegistryEntries() {
  return REGISTRY_ENTRIES;
}

export function normalizeVoiceActionRoute(route: string) {
  const trimmed = route.trim();
  if (!trimmed.startsWith("/")) return "";
  return trimmed.replace(/\/+$/, "") || "/";
}

export function isVoiceAppActionDomain(value: string): value is VoiceAppActionDomain {
  return value in DOMAIN_TO_ACTION_TYPE;
}

export function isVoiceSpecialistTransferDomain(value: string): value is VoiceSpecialistTransferDomain {
  return value in SPECIALIST_TO_ACTION_TYPE;
}

export function voiceActionEntryForLookup(input: {
  actionType?: string;
  actionId?: string;
  route?: string;
  domain?: string;
}) {
  const actionType = input.actionType?.trim();
  if (actionType) {
    const match = ACTION_TYPE_TO_ENTRY.get(actionType);
    if (match) return match;
  }

  const actionId = input.actionId?.trim();
  if (actionId) {
    const match = ACTION_ID_TO_ENTRY.get(actionId);
    if (match) return match;
  }

  const route = input.route ? normalizeVoiceActionRoute(input.route) : "";
  if (route) {
    const match = ROUTE_TO_ENTRY.get(route);
    if (match) return match;
  }

  const domain = input.domain?.trim();
  if (domain && isVoiceAppActionDomain(domain)) {
    return VOICE_ACTION_REGISTRY[DOMAIN_TO_ACTION_TYPE[domain]];
  }

  return null;
}

export function voiceActionEntryForSpecialistTransfer(domain: VoiceSpecialistTransferDomain, route?: string) {
  const routeMatch = route ? ROUTE_TO_ENTRY.get(normalizeVoiceActionRoute(route)) : undefined;
  return routeMatch ?? VOICE_ACTION_REGISTRY[SPECIALIST_TO_ACTION_TYPE[domain]];
}

export function buildVoiceAppAction(
  entry: VoiceActionRegistryEntry,
  sourceText: string,
  overrides: Partial<Pick<
    VoiceAppAction,
    "id" | "title" | "summary" | "cue" | "priority" | "extractedSubject" | "feedbackReason" | "payload"
  >> = {},
): VoiceAppAction {
  return {
    id: overrides.id ?? entry.id,
    actionType: entry.actionType,
    domain: entry.domain,
    route: entry.route,
    title: overrides.title ?? entry.title,
    summary: overrides.summary ?? entry.summary,
    cue: overrides.cue ?? entry.cue,
    sourceText: sourceText || overrides.feedbackReason || entry.feedbackReason,
    priority: overrides.priority ?? entry.priority,
    extractedSubject: overrides.extractedSubject,
    feedbackReason: overrides.feedbackReason ?? entry.feedbackReason,
    payload: overrides.payload,
    requiredPayloadKeys: entry.requiredPayloadKeys,
    optionalPayloadKeys: entry.optionalPayloadKeys,
    safetyLevel: entry.safetyLevel,
    requiresConfirmation: entry.requiresConfirmation,
    completion: entry.completion,
  };
}
