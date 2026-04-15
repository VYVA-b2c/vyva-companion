import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

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
  "doctor", "hurts", "ache", "pain",
];
const HEALTH_BODY_OR_SYMPTOM = [
  "worried about my health", "i think i might have", "not feeling well",
  "feel dizzy", "blood pressure", "my head feels", "my chest", "my back",
  "my knee", "breathless", "symptom", "nausea", "temperature", "unwell",
  "doctor", "hurts", "ache", "pain",
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
  "trivia", "puzzle", "cognitive", "quiz", "logic", "game", "practice",
];
const STORY_FOR_COMPANION = ["tell me a story", "read me", "\\bstory\\b"];

const THRESHOLD = 0.55;

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

function classifyIntent(utterance: string): { domain: RoutingDomain; confidence: number } {
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

type Mem0Memory = { memory?: string; content?: string; text?: string };

async function searchMemories(query: string, mem0UserId: string, apiKey: string): Promise<Mem0Memory[]> {
  const headers = {
    Authorization: `Token ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const tryV1 = await fetch("https://api.mem0.ai/v1/memories/search/", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, user_id: mem0UserId, limit: 5 }),
  }).catch(() => null);

  if (tryV1?.ok) {
    const data = await tryV1.json().catch(() => null);
    const list = normalizeMem0SearchResponse(data);
    if (list.length) return list;
  }

  const tryV2 = await fetch("https://api.mem0.ai/v2/memories/search/", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, filters: { user_id: mem0UserId }, top_k: 5 }),
  }).catch(() => null);

  if (tryV2?.ok) {
    const data = await tryV2.json().catch(() => null);
    return normalizeMem0SearchResponse(data);
  }
  return [];
}

function normalizeMem0SearchResponse(data: unknown): Mem0Memory[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Mem0Memory[];
  if (typeof data === "object" && data !== null) {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.memories)) return o.memories as Mem0Memory[];
    if (Array.isArray(o.results)) return o.results as Mem0Memory[];
  }
  return [];
}

function memoryText(m: Mem0Memory): string {
  const s = m.memory ?? m.content ?? m.text ?? "";
  return typeof s === "string" ? s.trim() : "";
}

function formatMemoryBlock(memories: Mem0Memory[]): string {
  const top = memories.slice(0, 3).map(memoryText).filter(Boolean);
  if (!top.length) return "";
  const labels = ["Margaret mentioned", "Margaret likes", "Margaret also shared"];
  return top.map((t, i) => `${labels[i] ?? "Memory"}: ${t}.`).join(" ");
}

function scheduleMem0Add(mem0UserId: string, messages: ConversationTurn[], apiKey: string): void {
  fetch("https://api.mem0.ai/v1/memories/", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ user_id: mem0UserId, messages }),
  }).catch((e) => console.error("[mem0] add error:", e));
}

function buildMem0Messages(history: ConversationTurn[], utterance: string): ConversationTurn[] {
  const last = history[history.length - 1];
  if (last?.role === "user" && last.content?.trim() === utterance.trim()) return history;
  return [...history, { role: "user" as const, content: utterance }];
}

type SessionRow = {
  id: string;
  user_id: string;
  session_id: string;
  current_agent: string;
  last_agent: string | null;
  last_intent: string | null;
  turn_count: number;
  next_agent_override: string | null;
};

export async function routerHandler(req: Request, res: Response) {
  const body = req.body as RouterRequestBody;
  const { user_id, session_id, utterance, conversation_history } = body;

  if (!user_id || !session_id || typeof utterance !== "string") {
    return res.status(400).json({ error: "Missing required fields: user_id, session_id, utterance" });
  }

  const history = Array.isArray(conversation_history) ? conversation_history : [];

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let domain: RoutingDomain;
  let confidence: number;

  const safetyHit = isSafetyUtterance(utterance);

  if (safetyHit) {
    domain = "safety";
    confidence = 1;

    const mem0Key = process.env.MEM0_API_KEY ?? "";
    const { data: profileSafe } = await supabase
      .from("profiles")
      .select("full_name, mem0_user_id")
      .eq("id", user_id)
      .maybeSingle();

    const mem0UserIdSafe = (profileSafe as any)?.mem0_user_id?.trim() || user_id;
    let memoriesSafe: Mem0Memory[] = [];
    if (mem0Key) {
      memoriesSafe = await searchMemories(utterance, mem0UserIdSafe, mem0Key).catch(() => []);
    }

    const { data: prevSafe } = await supabase
      .from("session_state")
      .select("*")
      .eq("session_id", session_id)
      .maybeSingle();

    const sessionRowSafe = prevSafe as SessionRow | null;
    const firstSafe = firstName((profileSafe as any)?.full_name ?? null);
    const nowSafe = new Date();
    const memoryBlockSafe = formatMemoryBlock(memoriesSafe);
    const lastTopicSafe = sessionRowSafe?.last_intent ?? sessionRowSafe?.last_agent ?? "general chat";

    const system_prompt_override = [
      memoryBlockSafe ? `MEMORY BLOCK:\n${memoryBlockSafe}` : "MEMORY BLOCK:\n(no memory retrieved)",
      "",
      `SESSION BLOCK:\nCurrent agent domain: safety.\nLast topic discussed: ${lastTopicSafe}.\nTime of day (UTC bucket): ${timeOfDayLabel(nowSafe)}.\nUser first name: ${firstSafe}.\n`,
      "URGENT: Treat this as a potential safety or crisis situation. Prioritise calm, clear guidance and appropriate escalation.",
    ].join("\n");

    const newTurnSafe = (sessionRowSafe?.turn_count ?? 0) + 1;
    const lastAgentBeforeSafe = sessionRowSafe?.current_agent ?? null;
    const persistNextSafe = resolveEscalationDomain(body.store_next_turn_override);

    await supabase.from("session_state").upsert(
      {
        user_id, session_id, current_agent: "safety", last_agent: lastAgentBeforeSafe,
        last_intent: "safety", last_activity_at: nowSafe.toISOString(),
        turn_count: newTurnSafe, next_agent_override: persistNextSafe ?? null,
      },
      { onConflict: "session_id" }
    );

    await supabase.from("session_exchanges").insert({
      session_id, user_id, speaker: "user", message: utterance,
      agent_used: "safety", intent_classified: "safety", intent_confidence: confidence,
    });

    if (mem0Key) scheduleMem0Add(mem0UserIdSafe, buildMem0Messages(history, utterance), mem0Key);

    const agent_id = agentIdForDomain("safety");
    return res.json({
      agent_id, system_prompt_override,
      session_data: { domain: "safety", intent_confidence: confidence, session_id, turn_count: newTurnSafe, last_agent: lastAgentBeforeSafe },
    });
  }

  const [profileRes, sessionRes] = await Promise.all([
    supabase.from("profiles").select("full_name, mem0_user_id").eq("id", user_id).maybeSingle(),
    supabase.from("session_state").select("*").eq("session_id", session_id).maybeSingle(),
  ]);

  const profile = profileRes.data as any;
  const sessionRow = sessionRes.data as SessionRow | null;

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

  const mem0Key = process.env.MEM0_API_KEY ?? "";
  const mem0UserId = profile?.mem0_user_id?.trim() || user_id;
  let memories: Mem0Memory[] = [];
  if (mem0Key) {
    memories = await searchMemories(utterance, mem0UserId, mem0Key).catch(() => []);
  }

  const { data: diffRow } = await supabase
    .from("agent_difficulty")
    .select("*")
    .eq("user_id", user_id)
    .eq("agent_name", domain)
    .maybeSingle();

  const first = firstName(profile?.full_name ?? null);
  const now = new Date();
  const memoryBlock = formatMemoryBlock(memories);

  let streak = 0;
  if (domain === "brain_coach") {
    const { data: streakData } = await supabase
      .from("session_exchanges")
      .select("agent_used")
      .eq("session_id", session_id)
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (streakData?.length) {
      for (const row of streakData) {
        if ((row as any).agent_used === "brain_coach") streak++;
        else break;
      }
    }
  }

  const lastTopic = sessionRow?.last_intent ?? sessionRow?.last_agent ?? "general chat";
  const sessionBlockLines = [
    `Current agent domain: ${domain}.`,
    `Last topic discussed: ${lastTopic}.`,
    `Time of day (UTC bucket): ${timeOfDayLabel(now)}.`,
    `User first name: ${first}.`,
  ];
  if (domain === "brain_coach") {
    sessionBlockLines.push(`Brain Coach streak (recent turns): ${streak}.`);
  }
  if (diffRow) {
    const d = diffRow as any;
    sessionBlockLines.push(
      `Difficulty context: level ${d.difficulty_level}, sessions_at_level ${d.sessions_at_level}, last_score ${d.last_score ?? "n/a"}.`
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

  await supabase.from("session_state").upsert(
    {
      user_id, session_id, current_agent: domain, last_agent: lastAgentBefore,
      last_intent: domain, last_activity_at: now.toISOString(),
      turn_count: newTurn, next_agent_override: nextOverrideAfter,
    },
    { onConflict: "session_id" }
  );

  await supabase.from("session_exchanges").insert({
    session_id, user_id, speaker: "user", message: utterance,
    agent_used: domain, intent_classified: domain, intent_confidence: confidence,
  });

  if (mem0Key) scheduleMem0Add(mem0UserId, buildMem0Messages(history, utterance), mem0Key);

  const agent_id = agentIdForDomain(domain);
  if (!agent_id) console.error(`Missing env for domain ${domain}: ${AGENT_ENV_MAP[domain]}`);

  return res.json({
    agent_id, system_prompt_override,
    session_data: { domain, intent_confidence: confidence, session_id, turn_count: newTurn, last_agent: lastAgentBefore },
  });
}
