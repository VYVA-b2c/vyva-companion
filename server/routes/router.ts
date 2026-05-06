import type { Request, Response } from "express";
import { eq, and, desc } from "drizzle-orm";
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

type RoutingDomain =
  | "safety"
  | "meds"
  | "health"
  | "concierge"
  | "brain_coach"
  | "companion";

type ConversationTurn = { role: "user" | "assistant"; content: string };

type RouterRequestBody = {
  user_id: string;
  session_id: string;
  utterance: string;
  conversation_history: ConversationTurn[];
  last_assistant_metadata?: { escalate_to?: string };
  store_next_turn_override?: string;
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
  "not responding",
  "vyva help",
  "i've had a fall",
  "i think i fell",
  "they asked for my bank",
  "someone is trying to trick me",
];
const SAFETY_TOKENS = ["emergency", "unconscious", "ambulance", "scam", "sos"];
const SAFETY_WORDS_BOUNDARY = /\b(help|fallen|fall)\b/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSafetyUtterance(utterance: string): boolean {
  const t = utterance.toLowerCase();
  for (const p of SAFETY_PHRASES) {
    if (t.includes(p)) return true;
  }
  for (const w of SAFETY_TOKENS) {
    if (new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(utterance)) return true;
  }
  return SAFETY_WORDS_BOUNDARY.test(utterance);
}

const MEDS_KEYWORDS = [
  "reorder prescription", "drug interaction", "side effect", "time for my",
  "missed my", "prescription", "medication", "medicine", "metformin",
  "lisinopril", "aspirin", "remind", "tablet", "pill", "dose", "taken", "forgot",
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

const THRESHOLD = 0.55;

const ROUTING_HINTS: Array<{ domain: RoutingDomain; patterns: string[] }> = [
  { domain: "safety", patterns: ["urgent health", "emergency help", "safety", "scam guard"] },
  { domain: "meds", patterns: ["medication", "medicine", "meds", "prescription", "pill", "tablet"] },
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

async function safeBuildVoiceContext(userId: string, domain: RoutingDomain, memoryQuery: string): Promise<VoiceDynamicVariables> {
  try {
    return await buildVoiceContext(userId, domain, memoryQuery);
  } catch (err) {
    console.warn("[router] voice context unavailable:", err);
    return {};
  }
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

export async function routerHandler(req: Request, res: Response) {
  const body = req.body as RouterRequestBody;
  const { user_id, session_id, utterance, conversation_history } = body;

  if (!user_id || !session_id || typeof utterance !== "string") {
    return res.status(400).json({ error: "Missing required fields: user_id, session_id, utterance" });
  }

  const history = Array.isArray(conversation_history) ? conversation_history : [];

  let domain: RoutingDomain;
  let confidence: number;

  const safetyHit = isSafetyUtterance(utterance);

  if (safetyHit) {
    domain = "safety";
    confidence = 1;

    const mem0Key = getMem0ApiKey();
    const [profileSafe, prevSafe] = await Promise.all([
      getProfile(user_id).catch(() => null),
      getSessionState(session_id).catch(() => null),
    ]);

    const mem0UserIdSafe = profileSafe?.mem0_user_id?.trim() || user_id;
    let memoriesSafe: Mem0Memory[] = [];
    if (mem0Key) {
      memoriesSafe = await searchMemories(utterance, mem0UserIdSafe, mem0Key).catch(() => []);
    }

    const firstSafe = firstName(profileSafe?.full_name ?? null);
    const genderSafe = profileGender(profileSafe);
    const nowSafe = new Date();
    const memoryBlockSafe = formatMemoryBlock(memoriesSafe);
    const lastTopicSafe = prevSafe?.last_intent ?? prevSafe?.last_agent ?? "general chat";

    const system_prompt_override = [
      memoryBlockSafe ? `MEMORY BLOCK:\n${memoryBlockSafe}` : "MEMORY BLOCK:\n(no memory retrieved)",
      "",
      `SESSION BLOCK:\nCurrent agent domain: safety.\nLast topic discussed: ${lastTopicSafe}.\nTime of day (UTC bucket): ${timeOfDayLabel(nowSafe)}.\nUser first name: ${firstSafe}.\n${genderInstruction(genderSafe)}\n`,
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

    if (mem0Key) scheduleMem0Add(mem0UserIdSafe, buildMem0Messages(history, utterance), mem0Key);

    const agent_id = agentIdForDomain("safety");
    const voiceContext = await safeBuildVoiceContext(user_id, "safety", utterance);
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
      },
      session_data: { domain: "safety", intent_confidence: confidence, session_id, turn_count: newTurnSafe, last_agent: lastAgentBeforeSafe },
    });
  }

  const [profile, sessionRow] = await Promise.all([
    getProfile(user_id).catch(() => null),
    getSessionState(session_id).catch(() => null),
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
  let memories: Mem0Memory[] = [];
  if (mem0Key) {
    memories = await searchMemories(utterance, mem0UserId, mem0Key).catch(() => []);
  }

  const [diffRow, streak] = await Promise.all([
    getAgentDifficulty(user_id, domain).catch(() => null),
    domain === "brain_coach" ? getBrainCoachStreak(session_id, user_id).catch(() => 0) : Promise.resolve(0),
  ]);

  const first = firstName(profile?.full_name ?? null);
  const gender = profileGender(profile);
  const now = new Date();
  const memoryBlock = formatMemoryBlock(memories);

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

  const system_prompt_override = [
    memoryBlock ? `MEMORY BLOCK:\n${memoryBlock}` : "MEMORY BLOCK:\n(no memory retrieved)",
    "",
    `SESSION BLOCK:\n${sessionBlockLines.join("\n")}`,
  ].join("\n");

  const newTurn = (sessionRow?.turn_count ?? 0) + 1;
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

  if (mem0Key) scheduleMem0Add(mem0UserId, buildMem0Messages(history, utterance), mem0Key);

  const agent_id = agentIdForDomain(domain);
  if (!agent_id) console.error(`Missing env for domain ${domain}: ${AGENT_ENV_MAP[domain]}`);
  const voiceContext = await safeBuildVoiceContext(user_id, domain, utterance);

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
    },
    session_data: { domain, intent_confidence: confidence, session_id, turn_count: newTurn, last_agent: lastAgentBefore },
  });
}
