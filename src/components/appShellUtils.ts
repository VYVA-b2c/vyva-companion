import type { VoiceAppAction } from "@/lib/voiceNavigation";

export type AppShellLayout = "compact" | "wide" | "vitals" | "fullscreen";

const FULLSCREEN_ROUTE_PREFIXES = ["/memory-games/", "/social-rooms/morning-movement/exercises/", "/activities/relax-breathe"];
const FULLSCREEN_ROUTES = [
  "/chat",
  "/spatial-navigator",
  "/face-name-match",
  "/attention-boosters/rhythm-tap",
  "/dual-task-walk",
];

const STANDALONE_BRAIN_COACH_ACTIVITY_ROUTES = [
  "/spatial-navigator",
  "/face-name-match",
  "/dual-task-walk",
] as const;

const WIDE_ROUTE_PREFIXES = [
  "/brain-coach",
  "/settings",
  "/health",
  "/informes",
  "/mind-memory/cognitive-assessment",
  "/social-rooms",
  "/meds",
  "/attention-boosters",
  "/executive-function",
  "/memory-games",
  "/concierge",
];

const WIDE_ROUTES = [
  "/",
  "/menu",
  "/companions",
  "/mind-memory",
  "/activities",
  "/senses",
  "/activity",
  "/learn",
  "/language",
  "/safe-home",
  "/scam-guard",
  "/history",
];

export function getAppShellLayout(pathname: string): AppShellLayout {
  if (pathname === "/health/vitals" || pathname === "/dev/home-master/vitals") {
    return "vitals";
  }

  if (
    FULLSCREEN_ROUTES.includes(pathname) ||
    FULLSCREEN_ROUTE_PREFIXES.some((route) => pathname.startsWith(route))
  ) {
    return "fullscreen";
  }

  if (
    WIDE_ROUTES.includes(pathname) ||
    WIDE_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  ) {
    return "wide";
  }

  return "compact";
}

export function isBrainCoachAppRoute(pathname: string) {
  return (
    STANDALONE_BRAIN_COACH_ACTIVITY_ROUTES.includes(pathname as typeof STANDALONE_BRAIN_COACH_ACTIVITY_ROUTES[number]) ||
    pathname === "/brain-coach" ||
    pathname.startsWith("/brain-coach/") ||
    pathname === "/mind-memory" ||
    pathname.startsWith("/mind-memory/") ||
    pathname === "/memory-games" ||
    pathname.startsWith("/memory-games/") ||
    pathname === "/attention-boosters" ||
    pathname.startsWith("/attention-boosters/") ||
    pathname === "/executive-function" ||
    pathname.startsWith("/executive-function/") ||
    pathname === "/senses" ||
    pathname.startsWith("/senses/")
  );
}

export function usesBrainCoachDocklessRoute(pathname: string) {
  if (
    pathname === "/mind-memory" ||
    pathname === "/brain-coach/remember" ||
    pathname === "/brain-coach/focus" ||
    pathname === "/brain-coach/think" ||
    pathname === "/brain-coach/calm"
  ) {
    return false;
  }

  return (
    STANDALONE_BRAIN_COACH_ACTIVITY_ROUTES.includes(pathname as typeof STANDALONE_BRAIN_COACH_ACTIVITY_ROUTES[number]) ||
    pathname === "/brain-coach" ||
    pathname.startsWith("/brain-coach/") ||
    pathname === "/memory-games" ||
    pathname.startsWith("/memory-games/") ||
    pathname === "/attention-boosters" ||
    pathname.startsWith("/attention-boosters/") ||
    pathname === "/executive-function" ||
    pathname.startsWith("/executive-function/") ||
    pathname === "/senses" ||
    pathname.startsWith("/senses/")
  );
}

export type EmergencyProfileContact = {
  name?: string | null;
  relationship?: string | null;
  primaryPhone?: string | null;
  secondaryPhone?: string | null;
};

export type OnboardingStateResponse = {
  profile?: {
    emergency_contact?: {
      name?: string | null;
      relationship?: string | null;
      primary_phone?: string | null;
      secondary_phone?: string | null;
    } | null;
  } | null;
} | null;

export function emergencyProfileContactFromState(data?: OnboardingStateResponse): EmergencyProfileContact | null {
  const contact = data?.profile?.emergency_contact;
  if (!contact) return null;
  const primaryPhone = contact.primary_phone?.trim() ?? "";
  const secondaryPhone = contact.secondary_phone?.trim() ?? "";
  if (!primaryPhone && !secondaryPhone) return null;
  return {
    name: contact.name?.trim() || null,
    relationship: contact.relationship?.trim() || null,
    primaryPhone,
    secondaryPhone,
  };
}

function voicePayloadString(action: VoiceAppAction, key: string) {
  const value = action.payload?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function voicePayloadDetails(action: VoiceAppAction, keys: string[]) {
  return keys
    .map((key) => {
      const value = voicePayloadString(action, key);
      return value ? `${key.replace(/_/g, " ")}: ${value}` : "";
    })
    .filter(Boolean)
    .join(", ");
}

function buildConciergePrefillMessage(action: VoiceAppAction) {
  const details = voicePayloadDetails(action, [
    "pickup",
    "destination",
    "time",
    "mobility_needs",
    "provider_type",
    "appointment_reason",
    "reminder_text",
    "reminder_time",
  ]);
  const base = action.sourceText.trim() || action.summary;
  return `${base}${details ? ` (${details})` : ""}. Prepare the next step and ask me to confirm before acting.`;
}

function shoppingCategoryForVoiceAction(action: VoiceAppAction) {
  const category = voicePayloadString(action, "category").toLowerCase();
  if (["groceries", "pharmacy_basics", "household", "mobility_aids", "safe_home"].includes(category)) {
    return category;
  }
  const text = `${action.sourceText} ${voicePayloadString(action, "items")}`.toLowerCase();
  if (/grocery|groceries|food|meal|supermarket|comida|compra/.test(text)) return "groceries";
  if (/pharmacy|farmacia/.test(text)) return "pharmacy_basics";
  if (/walker|cane|wheelchair|mobility|andador|baston/.test(text)) return "mobility_aids";
  if (/cleaning|household|home|limpieza|hogar/.test(text)) return "household";
  return "safe_home";
}

function shoppingPrioritiesForVoiceAction(action: VoiceAppAction) {
  const text = `${action.sourceText} ${voicePayloadString(action, "constraint")}`.toLowerCase();
  if (/budget|cheap|cost|precio|barato/.test(text)) return ["budget", "delivery"];
  if (/diet|salt|sugar|comida|food/.test(text)) return ["diet", "delivery"];
  if (/pharmacy|medicine|farmacia/.test(text)) return ["safety", "simplicity"];
  return ["delivery", "simplicity"];
}

export function buildVoiceActionRouteState(action: VoiceAppAction): Record<string, unknown> {
  const baseState: Record<string, unknown> = {
    voiceActionId: action.id,
    voiceActionTitle: action.title,
    voiceActionDomain: action.domain,
    voiceActionType: action.actionType,
    voiceActionPayload: action.payload ?? {},
    voiceActionRequiredPayloadKeys: action.requiredPayloadKeys ?? [],
    voiceActionOptionalPayloadKeys: action.optionalPayloadKeys ?? [],
  };

  if (action.actionType === "concierge.ride_booking") {
    return {
      ...baseState,
      conciergePrefill: {
        kind: "ride",
        message: buildConciergePrefillMessage(action),
        source: "voice_action",
      },
    };
  }

  if (action.actionType === "concierge.appointment_help") {
    return {
      ...baseState,
      conciergePrefill: {
        kind: "appointment",
        message: buildConciergePrefillMessage(action),
        source: "voice_action",
      },
    };
  }

  if (action.actionType === "concierge.order_request" || action.actionType === "concierge.shopping") {
    const items = voicePayloadString(action, "items") || voicePayloadString(action, "need") || action.sourceText;
    const constraints = [
      voicePayloadString(action, "budget"),
      voicePayloadString(action, "delivery_time"),
      voicePayloadString(action, "substitutions"),
      voicePayloadString(action, "constraint"),
    ].filter(Boolean);

    return {
      ...baseState,
      shoppingPrefill: {
        needText: items,
        category: shoppingCategoryForVoiceAction(action),
        priorities: shoppingPrioritiesForVoiceAction(action),
        constraints,
        sourceRecommendation: buildConciergePrefillMessage(action),
      },
    };
  }

  return baseState;
}
