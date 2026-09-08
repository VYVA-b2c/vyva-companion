import type { Request, Response } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db } from "../db.js";
import {
  profiles,
  sessionState,
  sessionExchanges,
  agentDifficulty,
} from "../../shared/schema.js";
import { genderInstruction, inferProfileGender, type GrammaticalGender } from "../lib/userPersonalization.js";
import { buildVoiceContext, type VoiceDynamicVariables } from "../lib/voiceContext.js";
import {
  formatMemoryBlock,
  getMem0ApiKey,
  scheduleMem0Add,
  searchMemories,
  type Mem0Memory,
} from "../lib/mem0.js";
import { buildAgentOperatingRules, buildConversationPlan } from "../lib/voiceAgentPolicy.js";
import { formatConversationPlanPrompt, selectVoiceConversationPlan } from "../lib/voiceConversationPlans.js";
import {
  signMedicalProfileToolToken,
  signVoiceRecommendationFeedbackToolToken,
} from "../lib/jwt.js";
import { buildUserConversationContext, formatConversationContextForPrompt } from "../lib/conversationContext.js";
import {
  getLatestShownVoiceRecommendation,
  inferVoiceRecommendationResponseAction,
  recordShownVoiceRecommendation,
  recordVoiceRecommendationFeedback,
} from "../lib/voiceRecommendationFeedback.js";
import {
  resolveHealthMemoryPolicyFlag,
  type HealthMemoryPolicyFlagResolution,
} from "../memory/healthMemoryPolicy.js";
import { buildBrainCoachSpecialistRouteAugmentation } from "../brainCoach/brainCoachRouterAdapter.js";
import { buildMentalWellbeingSpecialistRouteAugmentation } from "../mentalWellbeing/mentalWellbeingRouterAdapter.js";
import { buildMedicationSpecialistRouteAugmentation } from "../medication/medicationRouterAdapter.js";
import { buildConciergeSpecialistRouteAugmentation } from "../concierge/conciergeRouterAdapter.js";
import { buildSocialSupportSpecialistRouteAugmentation } from "../socialSupport/socialSupportRouterAdapter.js";

export type RoutingDomain =
  | "safety"
  | "meds"
  | "health"
  | "concierge"
  | "brain_coach"
  | "companion";

export function resolveRouterHealthMemoryPolicyFlag(input: {
  domain: RoutingDomain;
  userId: string;
  env?: Readonly<Record<string, string | undefined>>;
}): HealthMemoryPolicyFlagResolution | null {
  return input.domain === "health"
    ? resolveHealthMemoryPolicyFlag({
        env: input.env ?? process.env,
        userRef: input.userId,
        cohortKey: input.userId,
      })
    : null;
}

export function shouldUseLegacyRouterMem0(
  domain: RoutingDomain,
  _healthMemoryFlag: HealthMemoryPolicyFlagResolution | null,
): boolean {
  return !(["health", "meds", "safety"] as RoutingDomain[]).includes(domain);
}

type ConversationTurn = { role: "user" | "assistant"; content: string };

type RouterRequestBody = {
  user_id: string;
  session_id: string;
  utterance: string;
  conversation_history: ConversationTurn[];
  last_assistant_metadata?: { escalate_to?: string };
  store_next_turn_override?: string;
  app_entrypoint?: string;
};

const DOMAIN_ORDER: Exclude<RoutingDomain, "safety" | "companion">[] = [
  "meds",
  "health",
  "concierge",
  "brain_coach",
];

const ESCALATION_DOMAINS = new Set([
  "safety",
  "meds",
  "health",
  "concierge",
  "brain_coach",
  "companion",
]);

const SAFETY_PHRASES = [
  "chest pain",
  "can't breathe",
  "cant breathe",
  "call ambulance",
  "hurt myself",
  "harm myself",
  "self harm",
  "self-harm",
  "suicide",
  "suicidal",
  "kill myself",
  "end my life",
  "want to die",
  "wish i was dead",
  "not responding",
  "i've had a fall",
  "i think i fell",
  "they asked for my bank",
  "someone is trying to trick me",
];
const SAFETY_TOKENS = ["emergency", "unconscious", "ambulance", "scam", "sos"];
const SAFETY_WORDS_BOUNDARY = /\b(fallen|fall)\b/i;
const SAFETY_DISTRESS_HELP = /^\s*(?:help|help me|please help|help please|vyva help|i need help(?:\s+now)?|i really need help(?:\s+now)?)\s*[.!?]*\s*$/i;
const SAFETY_BREATHING_DISTRESS_PATTERNS = [
  /\b(?:i|we|he|she|they|someone)\s+(?:can't|cant|cannot|can not)\s+breathe\b/i,
  /\b(?:i|we|he|she|they|someone)\s+(?:can\s+)?(?:barely|hardly)\s+breathe\b/i,
  /\b(?:i(?:'m| am)?|we(?:'re| are)?|he(?:'s| is)?|she(?:'s| is)?|they(?:'re| are)?|someone(?: is)?)\s+(?:unable|struggling)\s+to\s+breathe\b/i,
];
const SAFETY_OVERDOSE_PATTERNS = [
  /\bi\s+(?:think\s+i\s+)?overdosed\b/i,
  /\bi(?:'ve| have)\s+overdosed\b/i,
  /\bi\s+(?:may|might)\s+have\s+overdosed\b/i,
  /\bi\s+(?:think\s+i\s+)?took\s+an\s+overdose\b/i,
];
const SAFETY_MEDICATION_RISK_PATTERNS = [
  /\bi\s+(?:think\s+i\s+)?(?:took|taken|had|swallowed)\s+(?:too\s+much|too\s+many)\b/i,
  /\b(?:too\s+much|too\s+many)\s+(?:medicine|medication|pills?|tablets?|doses?)\b/i,
  /\b(?:double|extra)\s+dose\b/i,
  /\b(?:accidentally\s+)?(?:took|taken|had|swallowed)\s+(?:two|double|extra)\s+(?:doses?|pills?|tablets?)\b/i,
  /\b(?:allergic|adverse)\s+reaction\b/i,
  /\b(?:severe\s+)?dizz(?:y|iness)\s+(?:after|from|because\s+of)\s+(?:my\s+)?(?:medicine|medication|pills?|tablets?|dose)\b/i,
  /\b(?:fainted|fainting|passed\s+out)\s+(?:after|from|because\s+of)\s+(?:my\s+)?(?:medicine|medication|pills?|tablets?|dose)\b/i,
  /\bdangerous\s+(?:drug\s+)?interaction\b/i,
  /\b(?:mixed|mixing|combine|combined|taking)\s+(?:my\s+)?(?:medicine|medication|pills?)\s+with\s+alcohol\b/i,
  /\balcohol\s+with\s+(?:my\s+)?(?:medicine|medication|pills?)\b/i,
  /\b(?:suicide|suicidal|kill myself|end my life).*(?:overdose|medicine|medication|pills?)\b/i,
];
const SAFETY_DANGER_PATTERNS = [
  /\b(?:i(?:'m| am)?|we(?:'re| are)?|someone(?: is)?|they(?:'re| are)?|he(?:'s| is)?|she(?:'s| is)?)\s+in\s+(?:immediate\s+)?danger\b/i,
];
const SAFETY_DEATH_INTENT_PATTERNS = [
  /\bi(?:'m| am)\s+(?:depressed|sad|down|low|upset|scared|worried|anxious|overwhelmed)\s+and\s+thinking\s+(?:about|of)\s+dying\b/i,
  /\bi(?:'ve| have)\s+been\s+thinking\s+(?:about|of)\s+dying\b/i,
  /\bi\s+keep\s+thinking\s+(?:about|of)\s+dying\b/i,
  /\bi(?:'m| am)\s+thinking\s+(?:about|of)\s+dying\b/i,
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSafetyUtterance(utterance: string): boolean {
  const t = utterance.toLowerCase();
  for (const p of SAFETY_PHRASES) {
    if (t.includes(p)) return true;
  }
  if (SAFETY_BREATHING_DISTRESS_PATTERNS.some((pattern) => pattern.test(utterance))) return true;
  if (SAFETY_OVERDOSE_PATTERNS.some((pattern) => pattern.test(utterance))) return true;
  if (SAFETY_MEDICATION_RISK_PATTERNS.some((pattern) => pattern.test(utterance))) return true;
  if (SAFETY_DANGER_PATTERNS.some((pattern) => pattern.test(utterance))) return true;
  if (SAFETY_DEATH_INTENT_PATTERNS.some((pattern) => pattern.test(utterance))) return true;
  for (const w of SAFETY_TOKENS) {
    if (new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(utterance)) return true;
  }
  return SAFETY_DISTRESS_HELP.test(utterance) || SAFETY_WORDS_BOUNDARY.test(utterance);
}

const MEDS_KEYWORDS = [
  "reorder prescription", "drug interaction", "side effect", "time for my",
  "missed my", "prescription", "medication", "medicine", "metformin",
  "lisinopril", "aspirin", "remind", "tablet", "pill", "dose", "taken", "forgot",
  "medication schedule", "medication inventory", "medication refill", "adherence report",
];
const HEALTH_KEYWORDS = [
  "worried about my health", "i think i might have", "not feeling well",
  "feel dizzy", "blood pressure", "my head feels", "my chest", "my back",
  "my knee", "breathless", "symptom", "nausea", "temperature", "unwell",
  "doctor", "health", "vitals", "vital signs", "hurts", "ache", "pain",
  "allergy", "allergies", "allergic", "allergen", "anaphylaxis", "hives", "rash",
  "epipen", "antihistamine", "hay fever", "pollen", "dust mite",
  "natural remedy for", "natural remedies for", "remedy for my allerg", "allergic reaction",
  "my allergies", "my allergens", "remedies",
];
const HEALTH_BODY_OR_SYMPTOM = [
  "worried about my health", "i think i might have", "not feeling well",
  "feel dizzy", "blood pressure", "my head feels", "my chest", "my back",
  "my knee", "breathless", "symptom", "nausea", "temperature", "unwell",
  "doctor", "hurts", "ache", "pain",
  "allergy", "allergies", "allergic", "allergen", "anaphylaxis", "hives", "rash",
  "my allergies", "my allergens",
];
const CONCIERGE_KEYWORDS = [
  "remind me to pick up", "remind me to call", "find nearby", "call the pharmacy",
  "appointment", "schedule", "delivery", "shopping", "groceries", "what time",
  "weather", "taxi", "book", "order", "reorder", "\\bcar\\b",
];
const NEWS_FOR_COMPANION = [
  "what's in the news", "what is in the news", "in the news", "\\bnews\\b",
];
const BRAIN_COACH_KEYWORDS = [
  "memory game", "brain exercise", "brain training", "test my memory",
  "let's do a game", "lets do a game", "exercise my brain", "scrabble",
  "trivia", "puzzle", "cognitive", "cognition", "quiz", "logic", "game", "practice",
];
const STORY_FOR_COMPANION = ["tell me a story", "read me", "\\bstory\\b"];

const TRUSTED_HELP_SETUP_NAVIGATION_PATTERN =
  /^(?:open|show|view|go to|take me to|set up|setup) (?:my )?trusted help(?: settings| setup)?[.!?]?$/i;

const SOCIAL_SUPPORT_NAVIGATION_PATTERN =
  /^(?:(?:open|show|view|go to|take me to|join) (?:my )?(?:community|community hub|social|social hub|social rooms|community room|community rooms|community activities|social activities)(?: page| hub)?|(?:i want to do|i'd like to do|let's do|lets do) (?:a )?social activit(?:y|ies))[.!?]?$/i;

const THRESHOLD = 0.55;

const ROUTING_HINTS: Array<{ domain: RoutingDomain; patterns: string[] }> = [
  { domain: "safety", patterns: ["urgent health", "emergency help", "safety", "scam guard"] },
  { domain: "meds", patterns: ["medication", "medicine", "meds", "prescription", "pill", "tablet", "adherence report"] },
  { domain: "health", patterns: ["health", "doctor", "medical", "vitals", "vital signs", "signos", "symptom", "allergy", "allergies"] },
  { domain: "concierge", patterns: ["concierge", "appointment", "schedule", "taxi", "shopping"] },
  { domain: "brain_coach", patterns: ["brain", "cognitive", "cognition", "memory", "activity", "activities"] },
  { domain: "companion", patterns: ["companion", "community", "social", "social rooms"] },
];

function countKeywordHits(utterance: string, patterns: string[]): number {
  let n = 0;
  const lower = utterance.toLowerCase();
  for (const p of patterns) {
    if (p.startsWith("\\")) {
      try {
        if (new RegExp(p, "i").test(utterance)) n++;
      } catch {
        if (lower.includes(p.replace(/\\b/g, ""))) n++;
      }
    } else if (lower.includes(p.toLowerCase())) {
      n++;
    }
  }
  return n;
}

function scoreFromHits(hits: number): number {
  if (hits <= 0) return 0;
  return Math.min(1, hits * 0.275);
}

function isNewsUtterance(utterance: string): boolean {
  return countKeywordHits(utterance, NEWS_FOR_COMPANION) > 0;
}
function isStoryUtterance(utterance: string): boolean {
  return countKeywordHits(utterance, STORY_FOR_COMPANION) > 0;
}
function healthDisallowedTiredOnly(utterance: string): boolean {
  const lower = utterance.toLowerCase();
  const hasTired = /\btired\b/i.test(utterance) || lower.includes("feeling low");
  if (!hasTired) return false;
  return countKeywordHits(utterance, HEALTH_BODY_OR_SYMPTOM) === 0;
}

function classifyRoutingHint(utterance: string): RoutingDomain | null {
  const normalized = utterance.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (TRUSTED_HELP_SETUP_NAVIGATION_PATTERN.test(normalized)) {
    return "concierge";
  }
  if (SOCIAL_SUPPORT_NAVIGATION_PATTERN.test(normalized)) {
    return "companion";
  }
  for (const hint of ROUTING_HINTS) {
    if (hint.patterns.some((pattern) => normalized === pattern || normalized.includes(pattern))) {
      return hint.domain;
    }
  }
  return null;
}

function classifyIntent(utterance: string): { domain: RoutingDomain; confidence: number } {
  const hintedDomain = classifyRoutingHint(utterance);
  if (hintedDomain) return { domain: hintedDomain, confidence: 1 };

  for (const domain of DOMAIN_ORDER) {
    let hits = 0;
    if (domain === "meds") {
      hits = countKeywordHits(utterance, MEDS_KEYWORDS);
    } else if (domain === "health") {
      if (healthDisallowedTiredOnly(utterance)) continue;
      hits = countKeywordHits(utterance, HEALTH_KEYWORDS);
    } else if (domain === "concierge") {
      if (isNewsUtterance(utterance)) continue;
      hits = countKeywordHits(utterance, CONCIERGE_KEYWORDS);
    } else if (domain === "brain_coach") {
      if (isStoryUtterance(utterance)) continue;
      hits = countKeywordHits(utterance, BRAIN_COACH_KEYWORDS);
    }
    const score = scoreFromHits(hits);
    if (score >= THRESHOLD) return { domain, confidence: score };
  }
  return { domain: "companion", confidence: 1 };
}

function resolveEscalationDomain(raw?: string): RoutingDomain | null {
  if (!raw || typeof raw !== "string") return null;
  const k = raw.toLowerCase().trim();
  if (!ESCALATION_DOMAINS.has(k)) return null;
  return k as RoutingDomain;
}

const AGENT_ENV_MAP: Record<RoutingDomain, string> = {
  safety: "ELEVENLABS_SAFETY_AGENT_ID",
  meds: "ELEVENLABS_MEDS_AGENT_ID",
  health: "ELEVENLABS_HEALTH_AGENT_ID",
  concierge: "ELEVENLABS_CONCIERGE_AGENT_ID",
  brain_coach: "ELEVENLABS_BRAIN_COACH_AGENT_ID",
  companion: "ELEVENLABS_COMPANION_AGENT_ID",
};

function agentIdForDomain(domain: RoutingDomain): string {
  return process.env[AGENT_ENV_MAP[domain]] ?? "";
}

function timeOfDayLabel(d: Date): string {
  const h = d.getUTCHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function firstName(fullName: string | null): string {
  if (!fullName?.trim()) return "friend";
  return fullName.trim().split(/\s+/)[0] ?? "friend";
}

function buildRouteDynamicVariables(data: {
  domain: RoutingDomain;
  confidence: number;
  sessionId: string;
  turnCount: number;
  lastAgent: string | null;
  lastTopic: string;
  timeOfDay: string;
  firstName: string;
  memoryBlock: string;
  brainCoachStreak?: number;
  difficultyLevel?: number;
  difficultySessionsAtLevel?: number;
  difficultyLastScore?: number | null;
}) {
  const variables: Record<string, string | number | boolean> = {
    routing_domain: data.domain,
    intent_confidence: data.confidence,
    session_id: data.sessionId,
    turn_count: data.turnCount,
    last_agent: data.lastAgent ?? "",
    last_topic: data.lastTopic,
    time_of_day: data.timeOfDay,
    first_name: data.firstName,
    memory_block: data.memoryBlock || "(no memory retrieved)",
  };

  if (data.brainCoachStreak !== undefined) {
    variables.brain_coach_streak = data.brainCoachStreak;
  }
  if (data.difficultyLevel !== undefined) {
    variables.difficulty_level = data.difficultyLevel;
    variables.difficulty_sessions_at_level = data.difficultySessionsAtLevel ?? 0;
    variables.difficulty_last_score = data.difficultyLastScore ?? "";
  }

  return variables;
}

function contextValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

async function recordRecommendationResponseFromUtterance(input: {
  userId: string;
  sessionId: string;
  utterance: string;
  routedDomain: RoutingDomain;
}) {
  const latestShown = await getLatestShownVoiceRecommendation(input.userId, input.sessionId).catch(() => null);
  const action = inferVoiceRecommendationResponseAction({
    utterance: input.utterance,
    routedDomain: input.routedDomain,
    latestShown,
  });
  if (!latestShown || !action) return;

  await recordVoiceRecommendationFeedback({
    userId: input.userId,
    sessionId: input.sessionId,
    recommendationId: latestShown.recommendation_id,
    action,
    domain: latestShown.domain,
    title: latestShown.title,
    reason: latestShown.reason,
    source: "router_inferred",
    metadata: {
      routed_domain: input.routedDomain,
      utterance_preview: input.utterance.slice(0, 160),
    },
  }).catch((err) => {
    console.warn("[router] voice recommendation response feedback unavailable:", err);
  });
}

function recordShownRecommendationFromContext(input: {
  userId: string;
  sessionId: string;
  voiceContext: VoiceDynamicVariables;
  source: string;
}) {
  void recordShownVoiceRecommendation({
    userId: input.userId,
    sessionId: input.sessionId,
    voiceContext: input.voiceContext,
    source: input.source,
  }).catch((err) => {
    console.warn("[router] voice recommendation shown feedback unavailable:", err);
  });
}

function buildVoiceContextPromptBlock(voiceContext: VoiceDynamicVariables) {
  return [
    `Profile summary: ${contextValue(voiceContext.profile_summary) || "Not recorded"}`,
    `First voice session: ${contextValue(voiceContext.is_first_voice_session) || "false"}`,
    `Prior voice exchanges: ${contextValue(voiceContext.prior_voice_exchange_count) || "0"}`,
    contextValue(voiceContext.app_entrypoint) ? `App entrypoint: ${contextValue(voiceContext.app_entrypoint)}` : "",
    contextValue(voiceContext.memory_block) ? `Memory: ${contextValue(voiceContext.memory_block)}` : "",
    contextValue(voiceContext.next_best_conversation)
      ? `Next best conversation: ${contextValue(voiceContext.next_best_conversation)}`
      : "",
    contextValue(voiceContext.next_best_conversation_title)
      ? `Next best opening: ${[
          contextValue(voiceContext.next_best_conversation_title),
          contextValue(voiceContext.next_best_conversation_reason),
          contextValue(voiceContext.next_best_conversation_opening_cue),
          contextValue(voiceContext.next_best_conversation_suggested_action),
        ].filter(Boolean).join(" | ")}`
      : "",
    contextValue(voiceContext.next_best_conversation_candidates)
      ? `Next best candidates: ${contextValue(voiceContext.next_best_conversation_candidates)}`
      : "",
    contextValue(voiceContext.next_best_conversation_feedback)
      ? `Next best feedback history: ${contextValue(voiceContext.next_best_conversation_feedback)}`
      : "",
    contextValue(voiceContext.voice_recommendation_feedback_tool)
      ? `Voice feedback tool guidance: ${contextValue(voiceContext.voice_recommendation_feedback_tool)}`
      : "",
    contextValue(voiceContext.orchestrator_context)
      ? `Orchestrator context: ${contextValue(voiceContext.orchestrator_context)}`
      : "",
    contextValue(voiceContext.last_visit_activity)
      ? `Relationship continuity: ${contextValue(voiceContext.last_visit_activity)}`
      : "",
    contextValue(voiceContext.app_insight_context)
      ? `App insight: ${contextValue(voiceContext.app_insight_context)}`
      : "",
    contextValue(voiceContext.personalisation_opportunities)
      ? `Personalisation opportunities: ${contextValue(voiceContext.personalisation_opportunities)}`
      : "",
    contextValue(voiceContext.preference_context) ? `Preference context: ${contextValue(voiceContext.preference_context)}` : "",
    contextValue(voiceContext.birthday_context) ? `Birthday context: ${contextValue(voiceContext.birthday_context)}` : "",
    contextValue(voiceContext.upcoming_events) ? `Upcoming events: ${contextValue(voiceContext.upcoming_events)}` : "",
    contextValue(voiceContext.recent_activity_summary)
      ? `Recent activity: ${contextValue(voiceContext.recent_activity_summary)}`
      : "",
    contextValue(voiceContext.brain_coach_context)
      ? `Brain Coach context: ${contextValue(voiceContext.brain_coach_context)}`
      : "",
    contextValue(voiceContext.brain_coach_plan)
      ? `Brain Coach plan: ${contextValue(voiceContext.brain_coach_plan)}`
      : "",
    contextValue(voiceContext.brain_coach_plan_id)
      ? `Brain Coach plan IDs: plan_id ${contextValue(voiceContext.brain_coach_plan_id)}; recommended_plan_item_id ${contextValue(voiceContext.brain_coach_recommended_plan_item_id)}`
      : "",
    contextValue(voiceContext.brain_coach_recommended_activity_prompt)
      ? `Brain Coach recommended activity prompt: ${contextValue(voiceContext.brain_coach_recommended_activity_prompt)}`
      : "",
    contextValue(voiceContext.brain_coach_missed_session_awareness)
      ? `Brain Coach missed-session awareness: ${contextValue(voiceContext.brain_coach_missed_session_awareness)}`
      : "",
    contextValue(voiceContext.brain_coach_streak_awareness)
      ? `Brain Coach streak awareness: ${contextValue(voiceContext.brain_coach_streak_awareness)}`
      : "",
    contextValue(voiceContext.social_activity_summary)
      ? `Recent social activity: ${contextValue(voiceContext.social_activity_summary)}`
      : "",
    contextValue(voiceContext.nearby_events_of_interest)
      ? `Nearby interest opportunities: ${contextValue(voiceContext.nearby_events_of_interest)}`
      : "",
    contextValue(voiceContext.matching_social_rooms)
      ? `Good-fit social rooms: ${contextValue(voiceContext.matching_social_rooms)}`
      : "",
    contextValue(voiceContext.social_context) ? `Social context: ${contextValue(voiceContext.social_context)}` : "",
    contextValue(voiceContext.health_profile_summary) ? `Health profile summary: ${contextValue(voiceContext.health_profile_summary)}` : "",
    contextValue(voiceContext.health_context) ? `Health context: ${contextValue(voiceContext.health_context)}` : "",
    contextValue(voiceContext.latest_vitals_scan) ? `Latest vitals scan: ${contextValue(voiceContext.latest_vitals_scan)}` : "",
    contextValue(voiceContext.vitals_trend) ? `Vitals trend: ${contextValue(voiceContext.vitals_trend)}` : "",
    contextValue(voiceContext.latest_symptom_report) ? `Latest symptom report: ${contextValue(voiceContext.latest_symptom_report)}` : "",
    contextValue(voiceContext.medication_adherence_summary)
      ? `Medication adherence summary: ${contextValue(voiceContext.medication_adherence_summary)}`
      : "",
    contextValue(voiceContext.medication_interaction_context)
      ? `Medication interaction context: ${contextValue(voiceContext.medication_interaction_context)}`
      : "",
    contextValue(voiceContext.latest_medical_visit) ? `Latest medical visit: ${contextValue(voiceContext.latest_medical_visit)}` : "",
    contextValue(voiceContext.upcoming_medical_appointment)
      ? `Upcoming medical appointment: ${contextValue(voiceContext.upcoming_medical_appointment)}`
      : "",
    contextValue(voiceContext.location_context) ? `Location context: ${contextValue(voiceContext.location_context)}` : "",
    contextValue(voiceContext.communication_preferences)
      ? `Communication preferences: ${contextValue(voiceContext.communication_preferences)}`
      : "",
    contextValue(voiceContext.safety_context) ? `Safety context: ${contextValue(voiceContext.safety_context)}` : "",
  ].filter(Boolean).join("\n").slice(0, 9000);
}

function buildMem0Messages(history: ConversationTurn[], utterance: string): ConversationTurn[] {
  const last = history[history.length - 1];
  if (last?.role === "user" && last.content?.trim() === utterance.trim()) return history;
  return [...history, { role: "user" as const, content: utterance }];
}

async function getProfile(userId: string) {
  const rows = await db
    .select({
      full_name: profiles.full_name,
      mem0_user_id: profiles.mem0_user_id,
      data_sharing_consent: profiles.data_sharing_consent,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

function profileGender(profile: Awaited<ReturnType<typeof getProfile>>): GrammaticalGender {
  const name = firstName(profile?.full_name ?? null);
  return inferProfileGender(profile?.data_sharing_consent, name);
}

async function getSessionState(sessionId: string) {
  const rows = await db
    .select()
    .from(sessionState)
    .where(eq(sessionState.session_id, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

async function upsertSessionState(data: {
  user_id: string;
  session_id: string;
  current_agent: string;
  last_agent: string | null;
  last_intent: string;
  last_activity_at: Date;
  turn_count: number;
  next_agent_override: string | null;
}) {
  await db
    .insert(sessionState)
    .values({
      ...data,
      last_activity_at: data.last_activity_at,
    })
    .onConflictDoUpdate({
      target: sessionState.session_id,
      set: {
        current_agent: data.current_agent,
        last_agent: data.last_agent,
        last_intent: data.last_intent,
        last_activity_at: data.last_activity_at,
        turn_count: data.turn_count,
        next_agent_override: data.next_agent_override,
        updated_at: new Date(),
      },
    });
}

async function insertExchange(data: {
  session_id: string;
  user_id: string;
  speaker: string;
  message: string;
  agent_used: string;
  intent_classified: string;
  intent_confidence: number;
}) {
  await db.insert(sessionExchanges).values(data);
}

async function getAgentDifficulty(userId: string, agentName: string) {
  const rows = await db
    .select()
    .from(agentDifficulty)
    .where(and(eq(agentDifficulty.user_id, userId), eq(agentDifficulty.agent_name, agentName)))
    .limit(1);
  return rows[0] ?? null;
}

async function getBrainCoachStreak(sessionId: string, userId: string): Promise<number> {
  const rows = await db
    .select({ agent_used: sessionExchanges.agent_used })
    .from(sessionExchanges)
    .where(and(eq(sessionExchanges.session_id, sessionId), eq(sessionExchanges.user_id, userId)))
    .orderBy(desc(sessionExchanges.created_at))
    .limit(30);
  let streak = 0;
  for (const row of rows) {
    if (row.agent_used === "brain_coach") streak++;
    else break;
  }
  return streak;
}

async function getPriorVoiceExchangeCount(userId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(sessionExchanges)
    .where(eq(sessionExchanges.user_id, userId));
  return Number(rows[0]?.value ?? 0);
}

export async function routerHandler(req: Request, res: Response) {
  const body = req.body as RouterRequestBody;
  const { user_id, session_id, utterance, conversation_history } = body;

  if (!user_id || !session_id || typeof utterance !== "string") {
    return res.status(400).json({ error: "Missing required fields: user_id, session_id, utterance" });
  }

  const history = Array.isArray(conversation_history) ? conversation_history : [];
  const appEntrypoint = typeof body.app_entrypoint === "string" && body.app_entrypoint.trim()
    ? body.app_entrypoint.trim()
    : utterance === "app_open"
    ? "app_open"
    : "";

  let domain: RoutingDomain;
  let confidence: number;

  const safetyHit = isSafetyUtterance(utterance);

  if (safetyHit) {
    domain = "safety";
    confidence = 1;

    const mem0Key = getMem0ApiKey();
    const useLegacyRouterMem0 = shouldUseLegacyRouterMem0("safety", null);
    const [profileSafe, prevSafe, priorVoiceExchangeCountSafe, conversationContextSafe] = await Promise.all([
      getProfile(user_id).catch(() => null),
      getSessionState(session_id).catch(() => null),
      getPriorVoiceExchangeCount(user_id).catch(() => 0),
      buildUserConversationContext(user_id).catch(() => null),
    ]);

    const mem0UserIdSafe = profileSafe?.mem0_user_id?.trim() || user_id;
    let memoriesSafe: Mem0Memory[] = [];
    if (mem0Key && useLegacyRouterMem0) {
      memoriesSafe = await searchMemories(utterance, mem0UserIdSafe, mem0Key).catch(() => []);
    }

    const firstSafe = firstName(profileSafe?.full_name ?? null);
    const genderSafe = profileGender(profileSafe);
    const nowSafe = new Date();
    const memoryBlockSafe = formatMemoryBlock(memoriesSafe);
    const lastTopicSafe = prevSafe?.last_intent ?? prevSafe?.last_agent ?? "general chat";
    const conversationPlanSafe = selectVoiceConversationPlan({
      domain: "safety",
      appEntrypoint,
      priorVoiceExchangeCount: priorVoiceExchangeCountSafe,
    });
    const voiceContext = await buildVoiceContext(user_id, "safety", utterance, {
      appEntrypoint,
      priorVoiceExchangeCount: priorVoiceExchangeCountSafe,
    }).catch((err) => {
      console.warn("[router] voice context unavailable:", err);
      return {};
    });
    await recordRecommendationResponseFromUtterance({
      userId: user_id,
      sessionId: session_id,
      utterance,
      routedDomain: "safety",
    });
    recordShownRecommendationFromContext({
      userId: user_id,
      sessionId: session_id,
      voiceContext,
      source: "router_safety",
    });

    const system_prompt_override = [
      buildAgentOperatingRules("safety"),
      "",
      `VOICE CONTEXT BLOCK:\n${buildVoiceContextPromptBlock(voiceContext)}`,
      "",
      memoryBlockSafe ? `MEMORY BLOCK:\n${memoryBlockSafe}` : "MEMORY BLOCK:\n(no memory retrieved)",
      "",
      formatConversationContextForPrompt(conversationContextSafe),
      "",
      `SESSION BLOCK:\nCurrent agent domain: safety.\nLast topic discussed: ${lastTopicSafe}.\nTime of day (UTC bucket): ${timeOfDayLabel(nowSafe)}.\nUser first name: ${firstSafe}.\n${genderInstruction(genderSafe)}\n`,
      `CONVERSATION PLAN:\n${formatConversationPlanPrompt(conversationPlanSafe) || buildConversationPlan("safety")}`,
      "",
      "URGENT: Treat this as a potential safety or crisis situation. Prioritise calm, clear guidance and appropriate escalation.",
    ].join("\n");

    const newTurnSafe = (prevSafe?.turn_count ?? 0) + 1;
    const lastAgentBeforeSafe = prevSafe?.current_agent ?? null;
    const persistNextSafe = resolveEscalationDomain(body.store_next_turn_override);

    await Promise.all([
      upsertSessionState({
        user_id, session_id, current_agent: "safety", last_agent: lastAgentBeforeSafe,
        last_intent: "safety", last_activity_at: nowSafe,
        turn_count: newTurnSafe, next_agent_override: persistNextSafe ?? null,
      }),
      insertExchange({
        session_id, user_id, speaker: "user", message: utterance,
        agent_used: "safety", intent_classified: "safety", intent_confidence: confidence,
      }),
    ]);

    if (mem0Key && useLegacyRouterMem0) {
      scheduleMem0Add(mem0UserIdSafe, buildMem0Messages(history, utterance), mem0Key);
    }

    const agent_id = agentIdForDomain("safety");
    const feedbackTokenSafe = await signVoiceRecommendationFeedbackToolToken(user_id, session_id).catch((err) => {
      console.warn("[router] voice recommendation feedback token unavailable:", err);
      return "";
    });
    return res.json({
      agent_id, system_prompt_override,
      dynamic_variables: {
        ...voiceContext,
        ...buildRouteDynamicVariables({
          domain: "safety",
          confidence,
          sessionId: session_id,
          turnCount: newTurnSafe,
          lastAgent: lastAgentBeforeSafe,
          lastTopic: lastTopicSafe,
          timeOfDay: timeOfDayLabel(nowSafe),
          firstName: firstSafe,
          memoryBlock: memoryBlockSafe,
        }),
        conversation_id: session_id,
        ...(feedbackTokenSafe ? { voice_recommendation_feedback_token: feedbackTokenSafe } : {}),
      },
      session_data: { domain: "safety", intent_confidence: confidence, session_id, turn_count: newTurnSafe, last_agent: lastAgentBeforeSafe },
    });
  }

  const [profile, sessionRow, priorVoiceExchangeCount] = await Promise.all([
    getProfile(user_id).catch(() => null),
    getSessionState(session_id).catch(() => null),
    getPriorVoiceExchangeCount(user_id).catch(() => 0),
  ]);

  const fromBody = resolveEscalationDomain(body.last_assistant_metadata?.escalate_to);
  const fromDb = resolveEscalationDomain(sessionRow?.next_agent_override ?? undefined);
  let consumedDbOverride = false;

  if (fromBody) {
    domain = fromBody;
    confidence = 1;
  } else if (fromDb) {
    domain = fromDb;
    confidence = 1;
    consumedDbOverride = true;
  } else {
    const c = classifyIntent(utterance);
    domain = c.domain;
    confidence = c.confidence;
  }

  const mem0Key = getMem0ApiKey();
  const mem0UserId = profile?.mem0_user_id?.trim() || user_id;
  const healthMemoryFlag = resolveRouterHealthMemoryPolicyFlag({
    domain,
    userId: user_id,
    env: process.env,
  });
  const useLegacyRouterMem0 = shouldUseLegacyRouterMem0(domain, healthMemoryFlag);
  let memories: Mem0Memory[] = [];
  if (mem0Key && useLegacyRouterMem0) {
    memories = await searchMemories(utterance, mem0UserId, mem0Key).catch(() => []);
  }

  const [diffRow, streak, conversationContext] = await Promise.all([
    getAgentDifficulty(user_id, domain).catch(() => null),
    domain === "brain_coach" ? getBrainCoachStreak(session_id, user_id).catch(() => 0) : Promise.resolve(0),
    buildUserConversationContext(user_id).catch(() => null),
  ]);

  const first = firstName(profile?.full_name ?? null);
  const gender = profileGender(profile);
  const now = new Date();

  const lastTopic = sessionRow?.last_intent ?? sessionRow?.last_agent ?? "general chat";
  const sessionBlockLines = [
    `Current agent domain: ${domain}.`,
    `Last topic discussed: ${lastTopic}.`,
    `Time of day (UTC bucket): ${timeOfDayLabel(now)}.`,
    `User first name: ${first}.`,
    genderInstruction(gender),
  ];
  if (domain === "brain_coach") {
    sessionBlockLines.push(`Brain Coach streak (recent turns): ${streak}.`);
  }
  if (diffRow) {
    sessionBlockLines.push(
      `Difficulty context: level ${diffRow.difficulty_level}, sessions_at_level ${diffRow.sessions_at_level}, last_score ${diffRow.last_score ?? "n/a"}.`
    );
  }
  const conversationPlan = selectVoiceConversationPlan({
    domain,
    appEntrypoint,
    priorVoiceExchangeCount,
  });
  const voiceContext = await buildVoiceContext(user_id, domain, utterance, {
    appEntrypoint,
    priorVoiceExchangeCount,
    ...(healthMemoryFlag?.effectiveMode === "pilot"
      ? {
          healthMemoryPolicy: {
            enabled: true,
            flowInstanceId: session_id,
            env: process.env,
          },
        }
      : {}),
  }).catch((err) => {
    console.warn("[router] voice context unavailable:", err);
    return {};
  });
  const policyMemoryBlock = contextValue(voiceContext.memory_block);
  const memoryBlock = healthMemoryFlag?.effectiveMode === "pilot"
    ? (policyMemoryBlock === "(no memory retrieved)" ? "" : policyMemoryBlock)
    : formatMemoryBlock(memories);
  await recordRecommendationResponseFromUtterance({
    userId: user_id,
    sessionId: session_id,
    utterance,
    routedDomain: domain,
  });
  recordShownRecommendationFromContext({
    userId: user_id,
    sessionId: session_id,
    voiceContext,
    source: "router",
  });

  const newTurn = (sessionRow?.turn_count ?? 0) + 1;
  const brainCoachSpecialist = buildBrainCoachSpecialistRouteAugmentation({
    domain,
    userId: user_id,
    sessionId: session_id,
    utterance,
    turnCount: newTurn,
    confidence,
    now,
    env: process.env,
    currentRoute: appEntrypoint,
  });
  const medicationSpecialist = buildMedicationSpecialistRouteAugmentation({
    domain,
    userId: user_id,
    sessionId: session_id,
    utterance,
    turnCount: newTurn,
    confidence,
    now,
    env: process.env,
    currentRoute: appEntrypoint,
  });
  const mentalWellbeingSpecialist = buildMentalWellbeingSpecialistRouteAugmentation({
    domain,
    userId: user_id,
    sessionId: session_id,
    utterance,
    turnCount: newTurn,
    confidence,
    now,
    env: process.env,
    currentRoute: appEntrypoint,
  });
  const conciergeSpecialist = buildConciergeSpecialistRouteAugmentation({
    domain,
    userId: user_id,
    sessionId: session_id,
    utterance,
    turnCount: newTurn,
    confidence,
    now,
    env: process.env,
    currentRoute: appEntrypoint,
  });
  const socialSupportSpecialist = buildSocialSupportSpecialistRouteAugmentation({
    domain,
    userId: user_id,
    sessionId: session_id,
    utterance,
    turnCount: newTurn,
    confidence,
    now,
    env: process.env,
    currentRoute: appEntrypoint,
  });

  const system_prompt_override = [
    buildAgentOperatingRules(domain),
    "",
    `VOICE CONTEXT BLOCK:\n${buildVoiceContextPromptBlock(voiceContext)}`,
    "",
    memoryBlock ? `MEMORY BLOCK:\n${memoryBlock}` : "MEMORY BLOCK:\n(no memory retrieved)",
    "",
    formatConversationContextForPrompt(conversationContext),
    "",
    `SESSION BLOCK:\n${sessionBlockLines.join("\n")}`,
    "",
    `CONVERSATION PLAN:\n${formatConversationPlanPrompt(conversationPlan) || buildConversationPlan(domain)}`,
    brainCoachSpecialist ? ["", brainCoachSpecialist.promptBlock].join("\n") : "",
    medicationSpecialist ? ["", medicationSpecialist.promptBlock].join("\n") : "",
    mentalWellbeingSpecialist ? ["", mentalWellbeingSpecialist.promptBlock].join("\n") : "",
    conciergeSpecialist ? ["", conciergeSpecialist.promptBlock].join("\n") : "",
    socialSupportSpecialist ? ["", socialSupportSpecialist.promptBlock].join("\n") : "",
  ].join("\n");

  const lastAgentBefore = sessionRow?.current_agent ?? null;
  const persistNext = resolveEscalationDomain(body.store_next_turn_override);
  const nextOverrideAfter =
    persistNext ?? ((fromBody || consumedDbOverride) ? null : (sessionRow?.next_agent_override ?? null));

  await Promise.all([
    upsertSessionState({
      user_id, session_id, current_agent: domain, last_agent: lastAgentBefore,
      last_intent: domain, last_activity_at: now,
      turn_count: newTurn, next_agent_override: nextOverrideAfter,
    }),
    insertExchange({
      session_id, user_id, speaker: "user", message: utterance,
      agent_used: domain, intent_classified: domain, intent_confidence: confidence,
    }),
  ]);

  if (mem0Key && useLegacyRouterMem0) scheduleMem0Add(mem0UserId, buildMem0Messages(history, utterance), mem0Key);

  const agent_id = agentIdForDomain(domain);
  if (!agent_id) console.error(`Missing env for domain ${domain}: ${AGENT_ENV_MAP[domain]}`);
  const medicalProfileToolToken = ["health", "meds", "safety"].includes(domain)
    ? await signMedicalProfileToolToken(user_id, session_id).catch((err) => {
        console.warn("[router] medical profile tool token unavailable:", err);
        return "";
      })
    : "";
  const feedbackToken = await signVoiceRecommendationFeedbackToolToken(user_id, session_id).catch((err) => {
    console.warn("[router] voice recommendation feedback token unavailable:", err);
    return "";
  });

  return res.json({
    agent_id, system_prompt_override,
    dynamic_variables: {
      ...voiceContext,
      ...buildRouteDynamicVariables({
        domain,
        confidence,
        sessionId: session_id,
        turnCount: newTurn,
        lastAgent: lastAgentBefore,
        lastTopic,
        timeOfDay: timeOfDayLabel(now),
        firstName: first,
        memoryBlock,
        ...(domain === "brain_coach" ? { brainCoachStreak: streak } : {}),
        ...(diffRow ? {
          difficultyLevel: diffRow.difficulty_level,
          difficultySessionsAtLevel: diffRow.sessions_at_level,
          difficultyLastScore: diffRow.last_score,
        } : {}),
      }),
      ...(medicalProfileToolToken
        ? {
            conversation_id: session_id,
            context_token: medicalProfileToolToken,
            medical_profile_token: medicalProfileToolToken,
          }
        : { conversation_id: session_id }),
      ...(feedbackToken ? { voice_recommendation_feedback_token: feedbackToken } : {}),
      ...(brainCoachSpecialist ? brainCoachSpecialist.dynamicVariables : {}),
      ...(medicationSpecialist ? medicationSpecialist.dynamicVariables : {}),
      ...(mentalWellbeingSpecialist ? mentalWellbeingSpecialist.dynamicVariables : {}),
      ...(conciergeSpecialist ? conciergeSpecialist.dynamicVariables : {}),
      ...(socialSupportSpecialist ? socialSupportSpecialist.dynamicVariables : {}),
    },
    session_data: {
      domain,
      intent_confidence: confidence,
      session_id,
      turn_count: newTurn,
      last_agent: lastAgentBefore,
      ...(brainCoachSpecialist
        ? { brain_coach_specialist: brainCoachSpecialist.sessionData }
        : {}),
      ...(medicationSpecialist
        ? { medication_specialist: medicationSpecialist.sessionData }
        : {}),
      ...(mentalWellbeingSpecialist
        ? { mental_wellbeing_specialist: mentalWellbeingSpecialist.sessionData }
        : {}),
      ...(conciergeSpecialist
        ? { concierge_specialist: conciergeSpecialist.sessionData }
        : {}),
      ...(socialSupportSpecialist
        ? { social_support_specialist: socialSupportSpecialist.sessionData }
        : {}),
    },
  });
}
