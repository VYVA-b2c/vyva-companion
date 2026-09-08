import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { buildBrainCoachCaregiverSummary } from "../lib/brainCoachCaregiverSummary.js";
import { mergeCaregiverSettingsIntoPreferences } from "../lib/brainCoachCaregiverSettings.js";
import { buildBrainCoachDailyPlan, extractBrainCoachPreferences } from "../lib/brainCoachPlan.js";
import {
  applyPlanItemEvent,
  buildBrainCoachPlanRows,
  buildPersistedBrainCoachPlan,
  completionSyncForPlan,
  type BrainCoachPlanEventType,
  type StoredBrainCoachPlan,
  type StoredBrainCoachPlanItem,
} from "../lib/brainCoachPlanLifecycle.js";

const OPENAI_MODEL = "gpt-4o-mini";
const ELEVENLABS_TTS_MODEL = "eleven_multilingual_v2";
const SCORE_RETELL_TIMEOUT_MS = 10000;
const GAME_LANGUAGES = ["es", "en", "fr", "de", "it", "pt"] as const;
type GameLanguage = (typeof GAME_LANGUAGES)[number];

type RetellScore = {
  covered: number[];
  not_covered: number[];
  covered_count: number;
  total_count: number;
  error: string | null;
};

const languageInstructions: Record<GameLanguage, string> = {
  es: "The story and retell are in Spanish.",
  en: "The story and retell are in English.",
  fr: "The story and retell are in French.",
  de: "The story and retell are in German.",
  it: "The story and retell are in Italian.",
  pt: "The story and retell are in Portuguese.",
};

const retellSchema = z.object({
  retellText: z.string().trim().max(5000),
  keyFacts: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  language: z.string().optional(),
});

const ttsSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  language: z.string().optional(),
  voiceProfile: z.enum(["brain", "meditation"]).optional().default("brain"),
});

function resolveGameTtsVoiceId(voiceProfile: "brain" | "meditation") {
  if (voiceProfile === "meditation") {
    return process.env.ELEVENLABS_MEDITATION_TTS_VOICE_ID
      ?? process.env.ELEVENLABS_BREATH_TTS_VOICE_ID
      ?? process.env.ELEVENLABS_BRAIN_TTS_VOICE_ID
      ?? process.env.ELEVENLABS_VOICE_ID
      ?? "";
  }

  return process.env.ELEVENLABS_BRAIN_TTS_VOICE_ID ?? process.env.ELEVENLABS_VOICE_ID ?? "";
}

const MEMORY_ACTIVITY_TYPES = [
  "memory_match",
  "sequence_memory",
  "word_recall",
  "remember_later",
  "scent_memory",
  "number_memory",
  "routine_memory",
  "association_memory",
  "story_recall",
] as const;

const cognitiveSessionWriteSchema = z.object({
  activityType: z.string().trim().min(1).max(80),
  domain: z.string().trim().min(1).max(80),
  secondaryDomain: z.string().trim().min(1).max(80).nullable().optional(),
  difficulty: z.number().int().min(1).max(100).optional().default(1),
  difficultyScale: z.string().trim().min(1).max(40).optional().default("level"),
  completed: z.boolean().optional().default(false),
  abandoned: z.boolean().optional().default(false),
  score: z.number().int().min(0).max(1000000).optional().default(0),
  accuracyPct: z.number().min(0).max(100).nullable().optional(),
  speedPct: z.number().min(0).max(100).nullable().optional(),
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60).optional().default(0),
  playedAt: z.string().optional(),
  language: z.string().trim().min(2).max(12).optional().default("es"),
  source: z.string().trim().min(1).max(80).optional().default("app"),
  sourceTable: z.string().trim().min(1).max(80).nullable().optional(),
  sourceSessionId: z.string().trim().min(1).max(120).nullable().optional(),
  clientResultId: z.string().trim().min(1).max(160).nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

const dailyPlanEventSchema = z.object({
  planId: z.string().uuid(),
  planItemId: z.string().uuid().optional(),
  activityType: z.string().trim().min(1).max(80).optional(),
  nudgeEventId: z.string().trim().min(1).max(120).optional(),
  eventType: z.enum(["accepted", "started", "skipped", "caregiver_nudge_read", "caregiver_nudge_dismissed"]),
  source: z.string().trim().min(1).max(80).optional().default("app"),
  metadata: z.record(z.unknown()).optional().default({}),
}).superRefine((value, ctx) => {
  if (isCaregiverNudgeVisibilityEvent(value.eventType)) {
    if (!value.nudgeEventId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "nudgeEventId is required.",
        path: ["nudgeEventId"],
      });
    }
    return;
  }

  if (!value.planItemId && !value.activityType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "planItemId or activityType is required.",
      path: ["planItemId"],
    });
  }
});

const curiousMindInputMethodSchema = z.enum(["voice", "typed"]).nullable().optional();

const curiousMindsIdeaSchema = z.object({
  text: z.string().trim().min(1).max(500),
  input_method: z.enum(["voice", "typed"]),
});

const curiousMindsSessionSchema = z.object({
  hookId: z.string().uuid().nullable().optional(),
  hookGuessText: z.string().trim().max(1000).nullable().optional(),
  hookGuessInputMethod: curiousMindInputMethodSchema,
  promptId: z.string().uuid().nullable().optional(),
  ideasGenerated: z.array(curiousMindsIdeaSchema).max(100).optional().default([]),
  callbackAttempted: z.boolean().optional().default(false),
  callbackResponseText: z.string().trim().max(1000).nullable().optional(),
  callbackInputMethod: curiousMindInputMethodSchema,
  completed: z.boolean().optional().default(false),
  abandoned: z.boolean().optional().default(false),
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60).nullable().optional(),
  language: z.string().trim().min(2).max(12).optional().default("es"),
});

const scentMemoryInputMethodSchema = z.enum(["voice", "typed"]).nullable().optional();

const scentMemorySessionSchema = z.object({
  promptId: z.string().uuid().nullable().optional(),
  responseText: z.string().trim().max(4000).nullable().optional(),
  responseInputMethod: scentMemoryInputMethodSchema,
  completed: z.boolean().optional().default(false),
  abandoned: z.boolean().optional().default(false),
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60).nullable().optional(),
  language: z.string().trim().min(2).max(12).optional().default("es"),
});

const breathGardenThemeSchema = z.enum(["garden", "tide", "stars", "ripples"]);

const breathGardenTapSchema = z.object({
  timestamp_ms: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  phase: z.enum(["inhale_peak", "exhale_peak"]),
});

const breathGardenSessionSchema = z.object({
  breathTaps: z.array(breathGardenTapSchema).max(1000).optional().default([]),
  sessionDurationSeconds: z.number().int().min(0).max(24 * 60 * 60),
  breathCycleCount: z.number().int().min(0).max(1000).optional().default(0),
  avgBreathCycleSeconds: z.number().min(0).max(3600).nullable().optional(),
  breathConsistencyIndex: z.number().min(0).max(100).nullable().optional(),
  finalPaceBreathsPerMin: z.number().min(0).max(200).nullable().optional(),
  gardenTheme: breathGardenThemeSchema.optional().default("garden"),
  bloomLevelReached: z.number().int().min(1).max(5).optional().default(1),
  targetDurationSeconds: z.union([z.literal(60), z.literal(120), z.literal(300)]).optional().default(120),
  guidedCycleCount: z.number().int().min(0).max(180).optional().default(0),
  guidedPatternId: z.enum(["gentle_4_6", "gentle_5_6"]).optional().default("gentle_5_6"),
  completionReason: z.enum(["timer_complete", "finished_early", "exited"]).optional(),
  completed: z.boolean().optional().default(false),
  abandoned: z.boolean().optional().default(false),
  language: z.string().trim().min(2).max(12).optional().default("es"),
});

function isCaregiverNudgeVisibilityEvent(eventType: string): eventType is Extract<BrainCoachPlanEventType, "caregiver_nudge_read" | "caregiver_nudge_dismissed"> {
  return eventType === "caregiver_nudge_read" || eventType === "caregiver_nudge_dismissed";
}

function normalizeGameLanguage(language: unknown): GameLanguage {
  return GAME_LANGUAGES.includes(language as GameLanguage) ? (language as GameLanguage) : "es";
}

function coerceDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function toIsoDate(value: unknown): string | null {
  const date = coerceDate(value, new Date(Number.NaN));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function utcDayStart(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function utcDayKeyFromStart(dayStart: number): string {
  return new Date(dayStart).toISOString().slice(0, 10);
}

function utcDayKey(value: unknown): string | null {
  const date = coerceDate(value, new Date(Number.NaN));
  return Number.isNaN(date.getTime()) ? null : utcDayKeyFromStart(utcDayStart(date));
}

type BrainCoachSessionLike = {
  id?: string;
  userId?: string;
  activityType: string;
  domain: string;
  secondaryDomain?: string | null;
  difficulty?: number | string | null;
  difficultyScale?: string | null;
  completed?: boolean | null;
  abandoned?: boolean | null;
  score?: number | string | null;
  accuracyPct?: number | string | null;
  speedPct?: number | string | null;
  durationSeconds?: number | string | null;
  playedAt?: Date | string | null;
  language?: string | null;
  source?: string | null;
  sourceTable?: string | null;
  sourceSessionId?: string | null;
  clientResultId?: string | null;
  metadata?: unknown;
  createdAt?: Date | string | null;
};

function normalizeProgressSession(row: BrainCoachSessionLike) {
  return {
    id: row.id ?? null,
    userId: row.userId ?? null,
    activityType: row.activityType,
    domain: row.domain,
    secondaryDomain: row.secondaryDomain ?? null,
    difficulty: Math.max(1, Math.round(toNumber(row.difficulty, 1))),
    difficultyScale: row.difficultyScale ?? "level",
    completed: Boolean(row.completed),
    abandoned: Boolean(row.abandoned),
    score: Math.max(0, Math.round(toNumber(row.score, 0))),
    accuracyPct: toNullableNumber(row.accuracyPct),
    speedPct: toNullableNumber(row.speedPct),
    durationSeconds: Math.max(0, Math.round(toNumber(row.durationSeconds, 0))),
    playedAt: toIsoDate(row.playedAt) ?? new Date().toISOString(),
    language: row.language ?? "es",
    source: row.source ?? "app",
    sourceTable: row.sourceTable ?? null,
    sourceSessionId: row.sourceSessionId ?? null,
    clientResultId: row.clientResultId ?? null,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: toIsoDate(row.createdAt),
  };
}

export function calculateBrainCoachStreak(sessions: BrainCoachSessionLike[], now = new Date()): number {
  const completedDays = new Set(
    sessions
      .filter((session) => session.completed)
      .map((session) => utcDayKey(session.playedAt))
      .filter((key): key is string => Boolean(key)),
  );
  if (completedDays.size === 0) return 0;

  const todayStart = utcDayStart(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  let cursor = completedDays.has(utcDayKeyFromStart(todayStart))
    ? todayStart
    : completedDays.has(utcDayKeyFromStart(yesterdayStart))
      ? yesterdayStart
      : null;

  if (cursor === null) return 0;

  let streak = 0;
  while (completedDays.has(utcDayKeyFromStart(cursor))) {
    streak += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }

  return streak;
}

export function calculateBestBrainCoachStreak(sessions: BrainCoachSessionLike[]): number {
  const completedDayStarts = [
    ...new Set(
      sessions
        .filter((session) => session.completed)
        .map((session) => {
          const date = coerceDate(session.playedAt, new Date(Number.NaN));
          return Number.isNaN(date.getTime()) ? null : utcDayStart(date);
        })
        .filter((day): day is number => day !== null),
    ),
  ].sort((a, b) => a - b);

  let best = 0;
  let current = 0;
  let previous: number | null = null;

  completedDayStarts.forEach((dayStart) => {
    current = previous !== null && dayStart === previous + 24 * 60 * 60 * 1000 ? current + 1 : 1;
    best = Math.max(best, current);
    previous = dayStart;
  });

  return best;
}

function summariseGroup(sessions: ReturnType<typeof normalizeProgressSession>[], key: "domain" | "activityType") {
  const groups = new Map<string, {
    key: string;
    totalSessions: number;
    completedSessions: number;
    bestScore: number;
    totalDurationSeconds: number;
    lastPlayedAt: string | null;
  }>();

  sessions.forEach((session) => {
    const groupKey = session[key];
    const existing = groups.get(groupKey) ?? {
      key: groupKey,
      totalSessions: 0,
      completedSessions: 0,
      bestScore: 0,
      totalDurationSeconds: 0,
      lastPlayedAt: null,
    };
    existing.totalSessions += 1;
    existing.completedSessions += session.completed ? 1 : 0;
    existing.bestScore = Math.max(existing.bestScore, session.score);
    existing.totalDurationSeconds += session.durationSeconds;
    existing.lastPlayedAt = !existing.lastPlayedAt || session.playedAt > existing.lastPlayedAt
      ? session.playedAt
      : existing.lastPlayedAt;
    groups.set(groupKey, existing);
  });

  return [...groups.values()].sort((a, b) => {
    if (b.completedSessions !== a.completedSessions) return b.completedSessions - a.completedSessions;
    return (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? "");
  });
}

export function buildBrainCoachProgress(sessions: BrainCoachSessionLike[], now = new Date()) {
  const normalized = sessions
    .map(normalizeProgressSession)
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  const completed = normalized.filter((session) => session.completed);
  const todayKey = utcDayKey(now);
  const todayCompleted = completed.filter((session) => utcDayKey(session.playedAt) === todayKey);

  return {
    summary: {
      totalSessions: normalized.length,
      completedSessions: completed.length,
      streakDays: calculateBrainCoachStreak(normalized, now),
      bestStreakDays: calculateBestBrainCoachStreak(normalized),
      lastPlayedAt: normalized[0]?.playedAt ?? null,
      totalDurationSeconds: normalized.reduce((total, session) => total + session.durationSeconds, 0),
    },
    today: {
      completedCount: todayCompleted.length,
      activityTypes: [...new Set(todayCompleted.map((session) => session.activityType))],
      domains: [...new Set(todayCompleted.map((session) => session.domain))],
    },
    domains: summariseGroup(normalized, "domain").map(({ key, ...rest }) => ({ domain: key, ...rest })),
    activities: summariseGroup(normalized, "activityType").map(({ key, ...rest }) => ({ activityType: key, ...rest })),
    history: normalized.slice(0, 25),
  };
}

function fallbackRetellScore(keyFacts: string[], error: string): RetellScore {
  return {
    covered: [],
    not_covered: Array.from({ length: keyFacts.length }, (_, index) => index + 1),
    covered_count: 0,
    total_count: keyFacts.length,
    error,
  };
}

function normalizeIndexList(value: unknown, total: number): number[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<number>();

  value.forEach((entry) => {
    const index = Number(entry);
    if (Number.isInteger(index) && index >= 1 && index <= total) {
      unique.add(index);
    }
  });

  return [...unique].sort((a, b) => a - b);
}

function normalizeRetellScore(value: unknown, total: number): RetellScore {
  const raw = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const covered = normalizeIndexList(raw.covered, total);
  const notCoveredFromModel = normalizeIndexList(raw.not_covered, total).filter((index) => !covered.includes(index));
  const not_covered = notCoveredFromModel.length > 0
    ? notCoveredFromModel
    : Array.from({ length: total }, (_, index) => index + 1).filter((index) => !covered.includes(index));

  return {
    covered,
    not_covered,
    covered_count: covered.length,
    total_count: total,
    error: null,
  };
}

function buildRetellPrompt(retellText: string, keyFacts: string[], language: GameLanguage) {
  return `You are scoring a memory recall exercise for a senior adult.
${languageInstructions[language]}
The user read a short story and is now retelling it from memory.

Key facts from the story (${keyFacts.length} total):
${keyFacts.map((fact, index) => `${index + 1}. ${fact}`).join("\n")}

User's retell:
"${retellText}"

For each key fact, determine if the user's retell covers that fact,
even if expressed differently, partially, or in different words.
Be generous: if the core idea is present, count it as covered.

Respond only with a valid JSON object:
{
  "covered": [1, 3, 4],
  "not_covered": [2, 5, 6],
  "covered_count": 3,
  "total_count": 6
}`;
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

function getRetellScoringErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "OpenAI scoring timed out.";
  }
  return error instanceof Error ? error.message : "OpenAI scoring failed.";
}

function logRetellScoringFallback(reason: string, message: string) {
  console.warn("[games] Retell scoring fallback", {
    reason,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: OPENAI_MODEL,
    message,
  });
}

export async function scoreRetellHandler(req: Request, res: Response) {
  const parsed = retellSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid retell scoring request." });
  }

  const { retellText, keyFacts } = parsed.data;
  const language = normalizeGameLanguage(parsed.data.language);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    const message = "OpenAI API key is not configured.";
    logRetellScoringFallback("missing_key", message);
    return res.json(fallbackRetellScore(keyFacts, message));
  }

  try {
    const client = new OpenAI({ apiKey });
    const timeout = createTimeoutSignal(SCORE_RETELL_TIMEOUT_MS);
    const completion = await client.chat.completions.create(
      {
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 250,
        messages: [{ role: "user", content: buildRetellPrompt(retellText, keyFacts, language) }],
      },
      { signal: timeout.signal },
    ).finally(timeout.clear);

    const content = completion.choices[0]?.message?.content ?? "{}";
    return res.json(normalizeRetellScore(JSON.parse(content), keyFacts.length));
  } catch (error) {
    const message = getRetellScoringErrorMessage(error);
    logRetellScoringFallback(message.includes("timed out") ? "timeout" : "openai_error", message);
    return res.json(fallbackRetellScore(keyFacts, message));
  }
}

export async function ttsHandler(req: Request, res: Response) {
  const parsed = ttsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid TTS request." });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  const voiceId = resolveGameTtsVoiceId(parsed.data.voiceProfile);
  if (!apiKey || !voiceId) {
    return res.status(503).json({ error: "ElevenLabs TTS is not configured." });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: parsed.data.text,
          model_id: ELEVENLABS_TTS_MODEL,
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true,
          },
          language_code: normalizeGameLanguage(parsed.data.language),
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn("[games] ElevenLabs TTS failed:", detail);
      return res.status(502).json({ error: "ElevenLabs TTS request failed." });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", response.headers.get("content-type") ?? "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.send(audio);
  } catch (error) {
    console.error("[games] ElevenLabs TTS error:", error);
    return res.status(502).json({ error: "ElevenLabs TTS request failed." });
  }
}

function queryNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function queryLimit(value: unknown, fallback: number, max: number): number {
  const numeric = queryNumber(value);
  if (numeric === null) return fallback;
  return Math.min(max, Math.max(1, Math.round(numeric)));
}

async function loadCognitiveSessionDb() {
  const [
    { db },
    {
      cognitiveSessionIndex,
      profiles,
      cognitiveDailyPlans,
      cognitiveDailyPlanItems,
      cognitiveDailyPlanEvents,
      cognitiveCaregiverSettings,
      curiousMindsHooks,
      curiousMindsPrompts,
      curiousMindsSessions,
      curiousMindsUserState,
      scentMemoryPrompts,
      scentMemorySessions,
      scentMemoryUserState,
      breathGardenSessions,
      breathGardenUserState,
    },
    { and, asc, desc, eq, gte, inArray, lt },
  ] = await Promise.all([
    import("../db.js"),
    import("../../shared/schema.js"),
    import("drizzle-orm"),
  ]);
  return {
    db,
    cognitiveSessionIndex,
    profiles,
    cognitiveDailyPlans,
    cognitiveDailyPlanItems,
    cognitiveDailyPlanEvents,
    cognitiveCaregiverSettings,
    curiousMindsHooks,
    curiousMindsPrompts,
    curiousMindsSessions,
    curiousMindsUserState,
    scentMemoryPrompts,
    scentMemorySessions,
    scentMemoryUserState,
    breathGardenSessions,
    breathGardenUserState,
    and,
    asc,
    desc,
    eq,
    gte,
    inArray,
    lt,
  };
}

type CognitiveSessionDb = Awaited<ReturnType<typeof loadCognitiveSessionDb>>;

function storedPlan(row: unknown): StoredBrainCoachPlan {
  return row as StoredBrainCoachPlan;
}

function storedItems(rows: unknown[]): StoredBrainCoachPlanItem[] {
  return rows as StoredBrainCoachPlanItem[];
}

function recordValue(row: unknown, key: string): unknown {
  return row && typeof row === "object" ? (row as Record<string, unknown>)[key] : undefined;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function latestCaregiverNudge(events: unknown[], planId: string) {
  const event = events
    .filter((row) => (
      recordValue(row, "planId") === planId &&
      recordValue(row, "eventType") === "caregiver_nudge"
    ))
    .sort((left, right) => {
      const leftTime = coerceDate(recordValue(left, "createdAt"), new Date(0)).getTime();
      const rightTime = coerceDate(recordValue(right, "createdAt"), new Date(0)).getTime();
      return rightTime - leftTime;
    })[0];
  if (!event) return null;

  const metadata = recordValue(event, "metadata");
  const metadataRecord = metadata && typeof metadata === "object"
    ? metadata as Record<string, unknown>
    : {};
  const title = stringValue(metadataRecord.title);
  const body = stringValue(metadataRecord.body);
  if (!title || !body) return null;

  const nudgeId = stringValue(recordValue(event, "id"));
  const visibilityEvents = events
    .filter((row) => {
      const rowMetadata = recordValue(row, "metadata");
      const rowMetadataRecord = rowMetadata && typeof rowMetadata === "object"
        ? rowMetadata as Record<string, unknown>
        : {};
      return (
        recordValue(row, "planId") === planId &&
        nudgeId !== null &&
        stringValue(rowMetadataRecord.nudge_event_id) === nudgeId &&
        (
          recordValue(row, "eventType") === "caregiver_nudge_read" ||
          recordValue(row, "eventType") === "caregiver_nudge_dismissed"
        )
      );
    })
    .sort((left, right) => {
      const leftTime = coerceDate(recordValue(left, "createdAt"), new Date(0)).getTime();
      const rightTime = coerceDate(recordValue(right, "createdAt"), new Date(0)).getTime();
      return rightTime - leftTime;
    });

  const readEvent = visibilityEvents.find((row) => recordValue(row, "eventType") === "caregiver_nudge_read");
  const dismissedEvent = visibilityEvents.find((row) => recordValue(row, "eventType") === "caregiver_nudge_dismissed");
  const status = dismissedEvent ? "dismissed" : readEvent ? "read" : "unread";

  return {
    id: nudgeId,
    planId,
    messageType: stringValue(metadataRecord.message_type) ?? "today_plan",
    title,
    body,
    sentAt: toIsoDate(recordValue(event, "createdAt")) ?? stringValue(metadataRecord.sent_at),
    sentBy: stringValue(metadataRecord.sent_by),
    status,
    isUnread: status === "unread",
    readAt: toIsoDate(recordValue(readEvent, "createdAt")),
    dismissedAt: toIsoDate(recordValue(dismissedEvent, "createdAt")),
  };
}

async function selectPlanItems(ctx: CognitiveSessionDb, planId: string) {
  const { db, cognitiveDailyPlanItems, asc, eq } = ctx;
  return db
    .select()
    .from(cognitiveDailyPlanItems)
    .where(eq(cognitiveDailyPlanItems.planId, planId))
    .orderBy(asc(cognitiveDailyPlanItems.sortOrder));
}

async function updatePlanCompletionStatus(ctx: CognitiveSessionDb, plan: StoredBrainCoachPlan, items: StoredBrainCoachPlanItem[]) {
  const { db, cognitiveDailyPlans, eq } = ctx;
  const allComplete = items.length > 0 && items.every((item) => item.status === "completed" || Boolean(item.completedAt));
  if (allComplete && plan.status !== "completed") {
    const completedAt = new Date();
    const [updated] = await db
      .update(cognitiveDailyPlans)
      .set({ status: "completed", completedAt, updatedAt: completedAt })
      .where(eq(cognitiveDailyPlans.id, plan.id))
      .returning();
    return storedPlan(updated);
  }
  return plan;
}

async function syncPersistedPlanCompletion(
  ctx: CognitiveSessionDb,
  planRow: unknown,
  itemRows: unknown[],
  sessions: BrainCoachSessionLike[],
) {
  const { db, cognitiveDailyPlanItems, cognitiveDailyPlanEvents, and, eq } = ctx;
  let plan = storedPlan(planRow);
  let items = storedItems(itemRows);
  const sync = completionSyncForPlan({
    planDate: plan.planDate,
    items,
    sessions,
  });

  for (const item of items) {
    if (!sync.completedActivityTypes.includes(item.activityType)) continue;
    if (item.status === "completed" || item.completedAt) continue;
    const completedAt = new Date();
    await db
      .update(cognitiveDailyPlanItems)
      .set({ status: "completed", completedAt, updatedAt: completedAt })
      .where(and(
        eq(cognitiveDailyPlanItems.id, item.id),
        eq(cognitiveDailyPlanItems.userId, plan.userId),
      ));
    await db.insert(cognitiveDailyPlanEvents).values({
      planId: plan.id,
      planItemId: item.id,
      userId: plan.userId,
      activityType: item.activityType,
      eventType: "completed" satisfies BrainCoachPlanEventType,
      source: "cognitive_session_index",
      metadata: { plan_date: plan.planDate },
    });
  }

  items = storedItems(await selectPlanItems(ctx, plan.id));
  plan = await updatePlanCompletionStatus(ctx, plan, items);
  return buildPersistedBrainCoachPlan(plan, items);
}

async function syncSessionToDailyPlan(ctx: CognitiveSessionDb, userId: string, session: BrainCoachSessionLike) {
  if (!session.completed) return;
  const planDate = utcDayKey(session.playedAt);
  if (!planDate) return;

  const { db, cognitiveDailyPlans, and, eq } = ctx;
  const [plan] = await db
    .select()
    .from(cognitiveDailyPlans)
    .where(and(
      eq(cognitiveDailyPlans.userId, userId),
      eq(cognitiveDailyPlans.planDate, planDate),
    ))
    .limit(1);
  if (!plan) return;

  const items = await selectPlanItems(ctx, plan.id);
  await syncPersistedPlanCompletion(ctx, plan, items, [session]);
}

function localDayBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function todayDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeCuriousMindsState(row: unknown, userId: string) {
  const value = row && typeof row === "object" ? row as Record<string, unknown> : {};
  return {
    user_id: userId,
    total_sessions: toNumber(value.totalSessions, 0),
    last_played_at: toIsoDate(value.lastPlayedAt),
    streak_days: toNumber(value.streakDays, 0),
    last_streak_date: typeof value.lastStreakDate === "string" ? value.lastStreakDate : value.lastStreakDate instanceof Date ? todayDateKey(value.lastStreakDate) : null,
    updated_at: toIsoDate(value.updatedAt) ?? new Date().toISOString(),
  };
}

function nextCuriousMindsState(previousState: ReturnType<typeof normalizeCuriousMindsState>, now = new Date()) {
  const today = todayDateKey(now);
  const yesterday = todayDateKey(addCalendarDays(now, -1));
  const lastStreakDate = previousState.last_streak_date;
  const streakDays =
    lastStreakDate === today
      ? Math.max(1, Number(previousState.streak_days ?? 1))
      : lastStreakDate === yesterday
        ? Number(previousState.streak_days ?? 0) + 1
        : 1;

  return {
    user_id: previousState.user_id,
    total_sessions: Number(previousState.total_sessions ?? 0) + 1,
    last_played_at: now.toISOString(),
    streak_days: streakDays,
    last_streak_date: today,
    updated_at: now.toISOString(),
  };
}

async function getOrCreateCuriousMindsState(ctx: CognitiveSessionDb, userId: string) {
  const { db, curiousMindsUserState, eq } = ctx;
  const [existing] = await db
    .select()
    .from(curiousMindsUserState)
    .where(eq(curiousMindsUserState.userId, userId))
    .limit(1);

  if (existing) return normalizeCuriousMindsState(existing, userId);

  const [created] = await db
    .insert(curiousMindsUserState)
    .values({ userId, updatedAt: new Date() })
    .onConflictDoNothing()
    .returning();

  return normalizeCuriousMindsState(created, userId);
}

function pickCuriousMindsContent<T extends { id: string }>(
  rows: T[],
  todaySessions: unknown[],
  historySessions: unknown[],
  fieldName: "hookId" | "promptId",
) {
  const usedToday = new Set(
    todaySessions
      .map((session) => recordValue(session, fieldName))
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );
  const unusedToday = rows.filter((row) => !usedToday.has(row.id));
  if (unusedToday.length > 0) return unusedToday[Math.floor(Math.random() * unusedToday.length)] ?? null;

  const lastPlayed = new Map<string, string>();
  historySessions.forEach((session) => {
    const contentId = recordValue(session, fieldName);
    if (typeof contentId !== "string" || !contentId || lastPlayed.has(contentId)) return;
    lastPlayed.set(contentId, toIsoDate(recordValue(session, "playedAt")) ?? "");
  });

  return [...rows].sort((a, b) => {
    const aPlayed = lastPlayed.get(a.id) ?? "";
    const bPlayed = lastPlayed.get(b.id) ?? "";
    return aPlayed.localeCompare(bPlayed);
  })[0] ?? null;
}

function serializeCuriousMindsHook(row: Record<string, unknown>) {
  return {
    id: row.id,
    fact_prompt: row.factPrompt,
    fact_answer: row.factAnswer,
    category: row.category,
    language: row.language,
    source: row.source,
    reviewed_at: toIsoDate(row.reviewedAt),
    reviewed_by: row.reviewedBy ?? null,
    is_active: Boolean(row.isActive),
    created_at: toIsoDate(row.createdAt),
  };
}

function serializeCuriousMindsPrompt(row: Record<string, unknown>) {
  return {
    id: row.id,
    prompt_type: row.promptType,
    prompt_text: row.promptText,
    topic: row.topic,
    language: row.language,
    source: row.source,
    reviewed_at: toIsoDate(row.reviewedAt),
    reviewed_by: row.reviewedBy ?? null,
    is_active: Boolean(row.isActive),
    created_at: toIsoDate(row.createdAt),
  };
}

async function loadCuriousMindsActiveRows(ctx: CognitiveSessionDb, tableName: "hooks" | "prompts", requestedLanguage: string) {
  const { db, curiousMindsHooks, curiousMindsPrompts, and, eq } = ctx;
  const normalizedLanguage = normalizeGameLanguage(requestedLanguage);
  const languageCandidates = Array.from(new Set([normalizedLanguage, "es", "en"]));
  const table = tableName === "hooks" ? curiousMindsHooks : curiousMindsPrompts;

  for (const language of languageCandidates) {
    const rows = await db
      .select()
      .from(table)
      .where(and(eq(table.isActive, true), eq(table.language, language)))
      .limit(500);
    if (rows.length > 0) return rows;
  }

  return db
    .select()
    .from(table)
    .where(eq(table.isActive, true))
    .limit(500);
}

function normalizeScentMemoryState(row: unknown, userId: string) {
  const value = row && typeof row === "object" ? row as Record<string, unknown> : {};
  return {
    user_id: userId,
    total_sessions: toNumber(value.totalSessions, 0),
    last_played_at: toIsoDate(value.lastPlayedAt),
    streak_days: toNumber(value.streakDays, 0),
    last_streak_date: typeof value.lastStreakDate === "string" ? value.lastStreakDate : value.lastStreakDate instanceof Date ? todayDateKey(value.lastStreakDate) : null,
    updated_at: toIsoDate(value.updatedAt) ?? new Date().toISOString(),
  };
}

function nextScentMemoryState(previousState: ReturnType<typeof normalizeScentMemoryState>, now = new Date()) {
  const today = todayDateKey(now);
  const yesterday = todayDateKey(addCalendarDays(now, -1));
  const lastStreakDate = previousState.last_streak_date;
  const streakDays =
    lastStreakDate === today
      ? Math.max(1, Number(previousState.streak_days ?? 1))
      : lastStreakDate === yesterday
        ? Number(previousState.streak_days ?? 0) + 1
        : 1;

  return {
    user_id: previousState.user_id,
    total_sessions: Number(previousState.total_sessions ?? 0) + 1,
    last_played_at: now.toISOString(),
    streak_days: streakDays,
    last_streak_date: today,
    updated_at: now.toISOString(),
  };
}

async function getOrCreateScentMemoryState(ctx: CognitiveSessionDb, userId: string) {
  const { db, scentMemoryUserState, eq } = ctx;
  const [existing] = await db
    .select()
    .from(scentMemoryUserState)
    .where(eq(scentMemoryUserState.userId, userId))
    .limit(1);

  if (existing) return normalizeScentMemoryState(existing, userId);

  const [created] = await db
    .insert(scentMemoryUserState)
    .values({ userId, updatedAt: new Date() })
    .onConflictDoNothing()
    .returning();

  return normalizeScentMemoryState(created, userId);
}

export function pickScentMemoryPrompt<T extends { id: string; category?: string | null }>(
  rows: T[],
  todaySessions: unknown[],
  historySessions: unknown[],
  random = Math.random,
  excludedPromptId?: string | null,
  excludedCategory?: string | null,
) {
  const rowsOutsideCategory = excludedCategory
    ? rows.filter((row) => row.category !== excludedCategory)
    : rows;
  const categoryEligibleRows = rowsOutsideCategory.length > 0 ? rowsOutsideCategory : rows;
  const rowsOutsidePrompt = excludedPromptId
    ? categoryEligibleRows.filter((row) => row.id !== excludedPromptId)
    : categoryEligibleRows;
  const eligibleRows = rowsOutsidePrompt.length > 0 ? rowsOutsidePrompt : categoryEligibleRows;
  const usedToday = new Set(
    todaySessions
      .map((session) => recordValue(session, "promptId"))
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );
  const unusedToday = eligibleRows.filter((row) => !usedToday.has(row.id));
  if (unusedToday.length > 0) return unusedToday[Math.floor(random() * unusedToday.length)] ?? null;

  const lastPlayed = new Map<string, string>();
  historySessions.forEach((session) => {
    const contentId = recordValue(session, "promptId");
    if (typeof contentId !== "string" || !contentId || lastPlayed.has(contentId)) return;
    lastPlayed.set(contentId, toIsoDate(recordValue(session, "playedAt")) ?? "");
  });

  return [...eligibleRows].sort((a, b) => {
    const aPlayed = lastPlayed.get(a.id) ?? "";
    const bPlayed = lastPlayed.get(b.id) ?? "";
    return aPlayed.localeCompare(bPlayed);
  })[0] ?? null;
}

function serializeScentMemoryPrompt(row: Record<string, unknown>) {
  return {
    id: row.id,
    scent_name: row.scentName,
    scent_description: row.scentDescription,
    guiding_question: row.guidingQuestion,
    category: row.category,
    language: row.language,
    source: row.source,
    reviewed_at: toIsoDate(row.reviewedAt),
    reviewed_by: row.reviewedBy ?? null,
    rejected: Boolean(row.rejected),
    is_active: Boolean(row.isActive),
    created_at: toIsoDate(row.createdAt),
  };
}

async function loadScentMemoryActiveRows(ctx: CognitiveSessionDb, requestedLanguage: string) {
  const { db, scentMemoryPrompts, and, eq } = ctx;
  const normalizedLanguage = normalizeGameLanguage(requestedLanguage);
  const languageCandidates = Array.from(new Set([normalizedLanguage, "es", "en"]));

  for (const language of languageCandidates) {
    const rows = await db
      .select()
      .from(scentMemoryPrompts)
      .where(and(
        eq(scentMemoryPrompts.isActive, true),
        eq(scentMemoryPrompts.rejected, false),
        eq(scentMemoryPrompts.language, language),
      ))
      .limit(500);
    if (rows.length > 0) return rows;
  }

  return db
    .select()
    .from(scentMemoryPrompts)
    .where(and(
      eq(scentMemoryPrompts.isActive, true),
      eq(scentMemoryPrompts.rejected, false),
    ))
    .limit(500);
}

export async function scentMemoryContentHandler(req: Request, res: Response) {
  const language = typeof req.query.language === "string" ? req.query.language : "es";
  const excludePromptId = typeof req.query.excludePromptId === "string" ? req.query.excludePromptId : null;
  const excludeCategory = typeof req.query.excludeCategory === "string" ? req.query.excludeCategory : null;

  try {
    const ctx = await loadCognitiveSessionDb();
    const { db, scentMemorySessions, and, desc, eq, gte, lt } = ctx;
    const userId = req.user!.id;
    const { start, end } = localDayBounds();

    const [state, todaySessions, historySessions, prompts] = await Promise.all([
      getOrCreateScentMemoryState(ctx, userId),
      db
        .select()
        .from(scentMemorySessions)
        .where(and(
          eq(scentMemorySessions.userId, userId),
          gte(scentMemorySessions.playedAt, start),
          lt(scentMemorySessions.playedAt, end),
        )),
      db
        .select()
        .from(scentMemorySessions)
        .where(eq(scentMemorySessions.userId, userId))
        .orderBy(desc(scentMemorySessions.playedAt))
        .limit(500),
      loadScentMemoryActiveRows(ctx, language),
    ]);

    const selectedPrompt = pickScentMemoryPrompt(
      prompts as Array<{ id: string; category?: string | null }>,
      todaySessions,
      historySessions,
      Math.random,
      excludePromptId,
      excludeCategory,
    );

    if (!selectedPrompt) {
      return res.status(404).json({ error: "There is no reviewed Scent Memory content available yet." });
    }

    return res.json({
      state,
      prompt: serializeScentMemoryPrompt(selectedPrompt as Record<string, unknown>),
    });
  } catch (error) {
    console.error("[games] Scent Memory content failed:", error);
    return res.status(500).json({ error: "Scent Memory content could not be loaded." });
  }
}

export async function scentMemorySessionHandler(req: Request, res: Response) {
  const parsed = scentMemorySessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid Scent Memory session request." });
  }

  const data = parsed.data;
  const userId = req.user!.id;
  const now = new Date();
  const hasResponse = Boolean(data.responseText?.trim());

  try {
    const ctx = await loadCognitiveSessionDb();
    const { db, scentMemorySessions, scentMemoryUserState, cognitiveSessionIndex } = ctx;
    const [session] = await db
      .insert(scentMemorySessions)
      .values({
        userId,
        playedAt: now,
        promptId: data.promptId ?? null,
        responseText: data.responseText || null,
        responseInputMethod: data.responseInputMethod ?? null,
        completed: data.completed,
        abandoned: data.abandoned,
        durationSeconds: data.durationSeconds ?? null,
      })
      .returning();

    let nextState: ReturnType<typeof normalizeScentMemoryState> | null = null;
    if (data.completed) {
      const previousState = await getOrCreateScentMemoryState(ctx, userId);
      nextState = nextScentMemoryState(previousState, now);
      const [savedState] = await db
        .insert(scentMemoryUserState)
        .values({
          userId,
          totalSessions: nextState.total_sessions,
          lastPlayedAt: now,
          streakDays: nextState.streak_days,
          lastStreakDate: nextState.last_streak_date,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: scentMemoryUserState.userId,
          set: {
            totalSessions: nextState.total_sessions,
            lastPlayedAt: now,
            streakDays: nextState.streak_days,
            lastStreakDate: nextState.last_streak_date,
            updatedAt: now,
          },
        })
        .returning();
      nextState = normalizeScentMemoryState(savedState, userId);

      const [indexedSession] = await db
        .insert(cognitiveSessionIndex)
        .values({
          userId,
          activityType: "scent_memory",
          domain: "episodic_memory",
          secondaryDomain: null,
          difficulty: 1,
          difficultyScale: "none",
          completed: true,
          abandoned: false,
          score: hasResponse ? 100 : 0,
          accuracyPct: hasResponse ? 100 : 0,
          speedPct: null,
          durationSeconds: data.durationSeconds ?? 0,
          playedAt: now,
          language: normalizeGameLanguage(data.language),
          source: "scent_memory",
          sourceTable: "scent_memory_sessions",
          sourceSessionId: session?.id ?? null,
          metadata: {
            promptId: data.promptId ?? null,
            responseProvided: hasResponse,
            responseInputMethod: data.responseInputMethod ?? null,
          },
        })
        .returning();

      await syncSessionToDailyPlan(ctx, userId, indexedSession).catch((error) => {
        console.warn("[games] Scent Memory daily plan sync failed:", error);
      });
    }

    return res.status(201).json({
      session,
      state: nextState ?? await getOrCreateScentMemoryState(ctx, userId),
    });
  } catch (error) {
    console.error("[games] Scent Memory session save failed:", error);
    return res.status(500).json({ error: "Scent Memory session could not be saved." });
  }
}

function normalizeBreathGardenState(row: unknown, userId: string) {
  const value = row && typeof row === "object" ? row as Record<string, unknown> : {};
  const preferredTheme = stringValue(value.preferredTheme) ?? "garden";
  return {
    user_id: userId,
    total_sessions: toNumber(value.totalSessions, 0),
    last_played_at: toIsoDate(value.lastPlayedAt),
    streak_days: toNumber(value.streakDays, 0),
    last_streak_date: typeof value.lastStreakDate === "string" ? value.lastStreakDate : value.lastStreakDate instanceof Date ? todayDateKey(value.lastStreakDate) : null,
    preferred_theme: ["garden", "tide", "stars", "ripples"].includes(preferredTheme) ? preferredTheme : "garden",
    preferred_duration_seconds: [60, 120, 300].includes(toNumber(value.preferredDurationSeconds, 120))
      ? toNumber(value.preferredDurationSeconds, 120)
      : 120,
    updated_at: toIsoDate(value.updatedAt) ?? new Date().toISOString(),
  };
}

function nextBreathGardenState(
  previousState: ReturnType<typeof normalizeBreathGardenState>,
  preferredDurationSeconds: number,
  now = new Date(),
) {
  const today = todayDateKey(now);
  const yesterday = todayDateKey(addCalendarDays(now, -1));
  const lastStreakDate = previousState.last_streak_date;
  const streakDays =
    lastStreakDate === today
      ? Math.max(1, Number(previousState.streak_days ?? 1))
      : lastStreakDate === yesterday
        ? Number(previousState.streak_days ?? 0) + 1
        : 1;

  return {
    user_id: previousState.user_id,
    total_sessions: Number(previousState.total_sessions ?? 0) + 1,
    last_played_at: now.toISOString(),
    streak_days: streakDays,
    last_streak_date: today,
    preferred_theme: "garden",
    preferred_duration_seconds: preferredDurationSeconds,
    updated_at: now.toISOString(),
  };
}

async function getOrCreateBreathGardenState(ctx: CognitiveSessionDb, userId: string) {
  const { db, breathGardenUserState, eq } = ctx;
  const [existing] = await db
    .select()
    .from(breathGardenUserState)
    .where(eq(breathGardenUserState.userId, userId))
    .limit(1);

  if (existing) return normalizeBreathGardenState(existing, userId);

  const [created] = await db
    .insert(breathGardenUserState)
    .values({ userId, preferredTheme: "garden", preferredDurationSeconds: 120, updatedAt: new Date() })
    .onConflictDoNothing()
    .returning();

  return normalizeBreathGardenState(created, userId);
}

export async function breathGardenStateHandler(req: Request, res: Response) {
  try {
    const ctx = await loadCognitiveSessionDb();
    const state = await getOrCreateBreathGardenState(ctx, req.user!.id);
    return res.json({ state });
  } catch (error) {
    console.error("[games] Breath Garden state failed:", error);
    return res.status(500).json({ error: "Breath Garden state could not be loaded." });
  }
}

export async function breathGardenSessionHandler(req: Request, res: Response) {
  const parsed = breathGardenSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid Breath Garden session request." });
  }

  const data = parsed.data;
  const userId = req.user!.id;
  const now = new Date();
  const completionReason = data.completionReason ?? (data.completed ? "timer_complete" : "exited");

  try {
    const ctx = await loadCognitiveSessionDb();
    const { db, breathGardenSessions, breathGardenUserState, cognitiveSessionIndex } = ctx;
    const [session] = await db
      .insert(breathGardenSessions)
      .values({
        userId,
        playedAt: now,
        breathTaps: data.breathTaps,
        sessionDurationSeconds: data.sessionDurationSeconds,
        breathCycleCount: data.breathCycleCount,
        avgBreathCycleSeconds: data.avgBreathCycleSeconds ?? null,
        breathConsistencyIndex: data.breathConsistencyIndex ?? null,
        finalPaceBreathsPerMin: data.finalPaceBreathsPerMin ?? null,
        gardenTheme: data.gardenTheme,
        bloomLevelReached: data.bloomLevelReached,
        targetDurationSeconds: data.targetDurationSeconds,
        guidedCycleCount: data.guidedCycleCount,
        guidedPatternId: data.guidedPatternId,
        completionReason,
        completed: data.completed,
        abandoned: data.abandoned,
      })
      .returning();

    let nextState: ReturnType<typeof normalizeBreathGardenState> | null = null;
    const previousState = await getOrCreateBreathGardenState(ctx, userId);

    if (data.completed) {
      nextState = nextBreathGardenState(previousState, data.targetDurationSeconds, now);
    } else {
      nextState = {
        ...previousState,
        preferred_theme: "garden",
        preferred_duration_seconds: data.targetDurationSeconds,
        updated_at: now.toISOString(),
      };
    }

    const [savedState] = await db
      .insert(breathGardenUserState)
      .values({
        userId,
        totalSessions: nextState.total_sessions,
        lastPlayedAt: data.completed ? now : previousState.last_played_at ? new Date(previousState.last_played_at) : null,
        streakDays: nextState.streak_days,
        lastStreakDate: nextState.last_streak_date,
        preferredTheme: "garden",
        preferredDurationSeconds: data.targetDurationSeconds,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: breathGardenUserState.userId,
        set: {
          totalSessions: nextState.total_sessions,
          lastPlayedAt: data.completed ? now : previousState.last_played_at ? new Date(previousState.last_played_at) : null,
          streakDays: nextState.streak_days,
          lastStreakDate: nextState.last_streak_date,
          preferredTheme: "garden",
          preferredDurationSeconds: data.targetDurationSeconds,
          updatedAt: now,
        },
      })
      .returning();
    nextState = normalizeBreathGardenState(savedState, userId);

    if (data.completed) {
      const [indexedSession] = await db
        .insert(cognitiveSessionIndex)
        .values({
          userId,
          activityType: "breath_garden",
          domain: "arousal_regulation",
          secondaryDomain: null,
          difficulty: 1,
          difficultyScale: "none",
          completed: true,
          abandoned: false,
          score: null,
          accuracyPct: null,
          speedPct: null,
          durationSeconds: data.sessionDurationSeconds,
          playedAt: now,
          language: normalizeGameLanguage(data.language),
          source: "breath_garden",
          sourceTable: "breath_garden_sessions",
          sourceSessionId: session?.id ?? null,
          metadata: {
            scoringModel: "none",
            targetDurationSeconds: data.targetDurationSeconds,
            guidedCycleCount: data.guidedCycleCount,
            guidedPatternId: data.guidedPatternId,
            completionReason,
            bloomLevelReached: data.bloomLevelReached,
          },
        })
        .returning();

      await syncSessionToDailyPlan(ctx, userId, indexedSession).catch((error) => {
        console.warn("[games] Breath Garden daily plan sync failed:", error);
      });
    }

    return res.status(201).json({
      session,
      state: nextState,
    });
  } catch (error) {
    console.error("[games] Breath Garden session save failed:", error);
    return res.status(500).json({ error: "Breath Garden session could not be saved." });
  }
}

export async function curiousMindsContentHandler(req: Request, res: Response) {
  const language = typeof req.query.language === "string" ? req.query.language : "es";

  try {
    const ctx = await loadCognitiveSessionDb();
    const { db, curiousMindsSessions, and, desc, eq, gte, lt } = ctx;
    const userId = req.user!.id;
    const { start, end } = localDayBounds();

    const [state, todaySessions, historySessions, hooks, prompts] = await Promise.all([
      getOrCreateCuriousMindsState(ctx, userId),
      db
        .select()
        .from(curiousMindsSessions)
        .where(and(
          eq(curiousMindsSessions.userId, userId),
          gte(curiousMindsSessions.playedAt, start),
          lt(curiousMindsSessions.playedAt, end),
        )),
      db
        .select()
        .from(curiousMindsSessions)
        .where(eq(curiousMindsSessions.userId, userId))
        .orderBy(desc(curiousMindsSessions.playedAt))
        .limit(500),
      loadCuriousMindsActiveRows(ctx, "hooks", language),
      loadCuriousMindsActiveRows(ctx, "prompts", language),
    ]);

    const selectedHook = pickCuriousMindsContent(hooks as Array<{ id: string }>, todaySessions, historySessions, "hookId");
    const selectedPrompt = pickCuriousMindsContent(prompts as Array<{ id: string }>, todaySessions, historySessions, "promptId");

    if (!selectedHook || !selectedPrompt) {
      return res.status(404).json({ error: "There is no reviewed Curious Minds content available yet." });
    }

    return res.json({
      state,
      hook: serializeCuriousMindsHook(selectedHook as Record<string, unknown>),
      prompt: serializeCuriousMindsPrompt(selectedPrompt as Record<string, unknown>),
    });
  } catch (error) {
    console.error("[games] Curious Minds content failed:", error);
    return res.status(500).json({ error: "Curious Minds content could not be loaded." });
  }
}

export async function curiousMindsSessionHandler(req: Request, res: Response) {
  const parsed = curiousMindsSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid Curious Minds session request." });
  }

  const data = parsed.data;
  const userId = req.user!.id;
  const now = new Date();
  const ideasCount = data.ideasGenerated.length;

  try {
    const ctx = await loadCognitiveSessionDb();
    const { db, curiousMindsSessions, curiousMindsUserState, cognitiveSessionIndex, eq } = ctx;
    const [session] = await db
      .insert(curiousMindsSessions)
      .values({
        userId,
        playedAt: now,
        hookId: data.hookId ?? null,
        hookGuessText: data.hookGuessText || null,
        hookGuessInputMethod: data.hookGuessInputMethod ?? null,
        promptId: data.promptId ?? null,
        ideasGenerated: data.ideasGenerated,
        ideasCount,
        callbackAttempted: data.callbackAttempted,
        callbackResponseText: data.callbackResponseText || null,
        callbackInputMethod: data.callbackInputMethod ?? null,
        completed: data.completed,
        abandoned: data.abandoned,
        durationSeconds: data.durationSeconds ?? null,
      })
      .returning();

    let nextState: ReturnType<typeof normalizeCuriousMindsState> | null = null;
    if (data.completed) {
      const previousState = await getOrCreateCuriousMindsState(ctx, userId);
      nextState = nextCuriousMindsState(previousState, now);
      const [savedState] = await db
        .insert(curiousMindsUserState)
        .values({
          userId,
          totalSessions: nextState.total_sessions,
          lastPlayedAt: now,
          streakDays: nextState.streak_days,
          lastStreakDate: nextState.last_streak_date,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: curiousMindsUserState.userId,
          set: {
            totalSessions: nextState.total_sessions,
            lastPlayedAt: now,
            streakDays: nextState.streak_days,
            lastStreakDate: nextState.last_streak_date,
            updatedAt: now,
          },
        })
        .returning();
      nextState = normalizeCuriousMindsState(savedState, userId);

      const [indexedSession] = await db
        .insert(cognitiveSessionIndex)
        .values({
          userId,
          activityType: "curious_minds",
          domain: "divergent_thinking",
          secondaryDomain: "attention",
          difficulty: 1,
          difficultyScale: "none",
          completed: true,
          abandoned: false,
          score: Math.min(100, ideasCount * 10),
          accuracyPct: data.callbackAttempted ? 100 : 0,
          speedPct: null,
          durationSeconds: data.durationSeconds ?? 0,
          playedAt: now,
          language: normalizeGameLanguage(data.language),
          source: "curious_minds",
          sourceTable: "curious_minds_sessions",
          sourceSessionId: session?.id ?? null,
          metadata: {
            hookId: data.hookId ?? null,
            promptId: data.promptId ?? null,
            ideasCount,
            callbackAttempted: data.callbackAttempted,
          },
        })
        .returning();

      await syncSessionToDailyPlan(ctx, userId, indexedSession).catch((error) => {
        console.warn("[games] Curious Minds daily plan sync failed:", error);
      });
    }

    return res.status(201).json({
      session,
      state: nextState ?? await getOrCreateCuriousMindsState(ctx, userId),
    });
  } catch (error) {
    console.error("[games] Curious Minds session save failed:", error);
    return res.status(500).json({ error: "Curious Minds session could not be saved." });
  }
}

export async function createCognitiveSessionHandler(req: Request, res: Response) {
  const parsed = cognitiveSessionWriteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid cognitive session request." });
  }

  const data = parsed.data;

  try {
    const ctx = await loadCognitiveSessionDb();
    const { db, cognitiveSessionIndex, and, eq } = ctx;

    if (data.clientResultId) {
      const [existing] = await db
        .select()
        .from(cognitiveSessionIndex)
        .where(and(
          eq(cognitiveSessionIndex.userId, req.user!.id),
          eq(cognitiveSessionIndex.clientResultId, data.clientResultId),
        ))
        .limit(1);

      if (existing) {
        return res.json({ session: normalizeProgressSession(existing) });
      }
    }

    const [session] = await db
      .insert(cognitiveSessionIndex)
      .values({
        userId: req.user!.id,
        activityType: data.activityType,
        domain: data.domain,
        secondaryDomain: data.secondaryDomain ?? null,
        difficulty: data.difficulty,
        difficultyScale: data.difficultyScale,
        completed: data.completed,
        abandoned: data.abandoned,
        score: data.score,
        accuracyPct: data.accuracyPct ?? null,
        speedPct: data.speedPct ?? null,
        durationSeconds: data.durationSeconds,
        playedAt: coerceDate(data.playedAt),
        language: data.language,
        source: data.source,
        sourceTable: data.sourceTable ?? null,
        sourceSessionId: data.sourceSessionId ?? null,
        clientResultId: data.clientResultId ?? null,
        metadata: data.metadata,
      })
      .returning();

    await syncSessionToDailyPlan(ctx, req.user!.id, session).catch((error) => {
      console.warn("[games] Daily Brain Coach plan completion sync failed:", error);
    });

    return res.status(201).json({ session: normalizeProgressSession(session) });
  } catch (error) {
    console.error("[games] Cognitive session create failed:", error);
    return res.status(500).json({ error: "Cognitive session could not be saved." });
  }
}

export async function cognitiveSessionHistoryHandler(req: Request, res: Response) {
  const limit = queryLimit(req.query.limit, 100, 500);
  const days = queryNumber(req.query.days);
  const family = typeof req.query.family === "string" ? req.query.family : null;

  try {
    const { db, cognitiveSessionIndex, and, desc, eq, gte, inArray } = await loadCognitiveSessionDb();
    const conditions = [eq(cognitiveSessionIndex.userId, req.user!.id)];
    if (days !== null && days > 0) {
      conditions.push(gte(cognitiveSessionIndex.playedAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000)));
    }
    if (family === "memory") {
      conditions.push(inArray(cognitiveSessionIndex.activityType, [...MEMORY_ACTIVITY_TYPES]));
    }

    const rows = await db
      .select()
      .from(cognitiveSessionIndex)
      .where(and(...conditions))
      .orderBy(desc(cognitiveSessionIndex.playedAt))
      .limit(limit);

    return res.json({ sessions: rows.map(normalizeProgressSession) });
  } catch (error) {
    console.error("[games] Cognitive session history failed:", error);
    return res.status(500).json({ error: "Cognitive session history could not be loaded." });
  }
}

export async function brainCoachProgressHandler(req: Request, res: Response) {
  const limit = queryLimit(req.query.limit, 500, 1000);
  const days = queryNumber(req.query.days);

  try {
    const { db, cognitiveSessionIndex, and, desc, eq, gte } = await loadCognitiveSessionDb();
    const conditions = [eq(cognitiveSessionIndex.userId, req.user!.id)];
    if (days !== null && days > 0) {
      conditions.push(gte(cognitiveSessionIndex.playedAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000)));
    }

    const rows = await db
      .select()
      .from(cognitiveSessionIndex)
      .where(and(...conditions))
      .orderBy(desc(cognitiveSessionIndex.playedAt))
      .limit(limit);

    return res.json(buildBrainCoachProgress(rows));
  } catch (error) {
    console.error("[games] Brain Coach progress failed:", error);
    return res.status(500).json({ error: "Brain Coach progress could not be loaded." });
  }
}

export async function loadBrainCoachProgressForUser(userId: string, options: { limit?: number; days?: number } = {}) {
  const { db, cognitiveSessionIndex, and, desc, eq, gte } = await loadCognitiveSessionDb();
  const conditions = [eq(cognitiveSessionIndex.userId, userId)];
  if (typeof options.days === "number" && options.days > 0) {
    conditions.push(gte(cognitiveSessionIndex.playedAt, new Date(Date.now() - options.days * 24 * 60 * 60 * 1000)));
  }

  const rows = await db
    .select()
    .from(cognitiveSessionIndex)
    .where(and(...conditions))
    .orderBy(desc(cognitiveSessionIndex.playedAt))
    .limit(options.limit ?? 500);

  return buildBrainCoachProgress(rows);
}

export async function brainCoachDailyPlanHandler(req: Request, res: Response) {
  try {
    const ctx = await loadCognitiveSessionDb();
    const {
      db,
      cognitiveSessionIndex,
      profiles,
      cognitiveDailyPlans,
      cognitiveDailyPlanItems,
      cognitiveDailyPlanEvents,
      cognitiveCaregiverSettings,
      desc,
      eq,
      and,
      gte,
    } = ctx;
    const trendWindowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [rows, planEvents] = await Promise.all([
      db
        .select()
        .from(cognitiveSessionIndex)
        .where(eq(cognitiveSessionIndex.userId, req.user!.id))
        .orderBy(desc(cognitiveSessionIndex.playedAt))
        .limit(300),
      db
        .select()
        .from(cognitiveDailyPlanEvents)
        .where(and(
          eq(cognitiveDailyPlanEvents.userId, req.user!.id),
          gte(cognitiveDailyPlanEvents.createdAt, trendWindowStart),
        ))
        .orderBy(desc(cognitiveDailyPlanEvents.createdAt))
        .limit(200),
    ]);

    const [[profile], [caregiverSettings]] = await Promise.all([
      db
        .select({
          dataSharingConsent: profiles.data_sharing_consent,
        })
        .from(profiles)
        .where(eq(profiles.id, req.user!.id))
        .limit(1),
      db
        .select()
        .from(cognitiveCaregiverSettings)
        .where(eq(cognitiveCaregiverSettings.userId, req.user!.id))
        .limit(1),
    ]);

    const preferences = mergeCaregiverSettingsIntoPreferences(
      extractBrainCoachPreferences(profile?.dataSharingConsent),
      caregiverSettings,
    );
    const progress = buildBrainCoachProgress(rows);
    const generatedPlan = buildBrainCoachDailyPlan({
      sessions: rows,
      events: planEvents,
      preferences,
      streakDays: progress.summary.streakDays,
    });
    const planDate = generatedPlan.planDate;

    let [plan] = await db
      .select()
      .from(cognitiveDailyPlans)
      .where(and(
        eq(cognitiveDailyPlans.userId, req.user!.id),
        eq(cognitiveDailyPlans.planDate, planDate),
      ))
      .limit(1);

    if (!plan) {
      const built = buildBrainCoachPlanRows({
        userId: req.user!.id,
        generatedPlan,
        sourceContext: {
          total_sessions: progress.summary.totalSessions,
          completed_sessions: progress.summary.completedSessions,
          streak_days: progress.summary.streakDays,
          training_time: preferences.trainingTime ?? null,
          session_length_mins: preferences.sessionLengthMins ?? null,
        },
      });
      [plan] = await db
        .insert(cognitiveDailyPlans)
        .values(built.plan)
        .returning();

      if (built.items.length > 0) {
        await db.insert(cognitiveDailyPlanItems).values(
          built.items.map((item) => ({
            ...item,
            planId: plan.id,
          })),
        );
      }
    }

    const items = await selectPlanItems(ctx, plan.id);
    const persistedPlan = await syncPersistedPlanCompletion(ctx, plan, items, rows);

    return res.json({
      ...persistedPlan,
      caregiverNudge: latestCaregiverNudge(planEvents, plan.id),
    });
  } catch (error) {
    console.error("[games] Brain Coach daily plan failed:", error);
    return res.status(500).json({ error: "Brain Coach daily plan could not be loaded." });
  }
}

export async function brainCoachDailyPlanEventHandler(req: Request, res: Response) {
  const parsed = dailyPlanEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid Brain Coach plan event request." });
  }

  const data = parsed.data;

  try {
    const ctx = await loadCognitiveSessionDb();
    const {
      db,
      cognitiveDailyPlans,
      cognitiveDailyPlanItems,
      cognitiveDailyPlanEvents,
      and,
      desc,
      eq,
    } = ctx;
    const [plan] = await db
      .select()
      .from(cognitiveDailyPlans)
      .where(and(
        eq(cognitiveDailyPlans.id, data.planId),
        eq(cognitiveDailyPlans.userId, req.user!.id),
      ))
      .limit(1);

    if (!plan) {
      return res.status(404).json({ error: "Brain Coach plan not found." });
    }

    if (isCaregiverNudgeVisibilityEvent(data.eventType)) {
      const [nudgeEvent] = await db
        .select()
        .from(cognitiveDailyPlanEvents)
        .where(and(
          eq(cognitiveDailyPlanEvents.id, data.nudgeEventId!),
          eq(cognitiveDailyPlanEvents.planId, plan.id),
          eq(cognitiveDailyPlanEvents.userId, req.user!.id),
          eq(cognitiveDailyPlanEvents.eventType, "caregiver_nudge"),
        ))
        .limit(1);

      if (!nudgeEvent) {
        return res.status(404).json({ error: "Brain Coach caregiver nudge not found." });
      }

      await db.insert(cognitiveDailyPlanEvents).values({
        planId: plan.id,
        planItemId: null,
        userId: req.user!.id,
        activityType: null,
        eventType: data.eventType satisfies BrainCoachPlanEventType,
        source: data.source,
        metadata: {
          ...data.metadata,
          nudge_event_id: data.nudgeEventId,
        },
      });

      const [items, planEvents] = await Promise.all([
        selectPlanItems(ctx, plan.id),
        db
          .select()
          .from(cognitiveDailyPlanEvents)
          .where(and(
            eq(cognitiveDailyPlanEvents.planId, plan.id),
            eq(cognitiveDailyPlanEvents.userId, req.user!.id),
          ))
          .orderBy(desc(cognitiveDailyPlanEvents.createdAt))
          .limit(50),
      ]);
      const persistedPlan = buildPersistedBrainCoachPlan(storedPlan(plan), storedItems(items));
      return res.json({
        ...persistedPlan,
        caregiverNudge: latestCaregiverNudge(planEvents, plan.id),
      });
    }

    const itemConditions = [
      eq(cognitiveDailyPlanItems.planId, data.planId),
      eq(cognitiveDailyPlanItems.userId, req.user!.id),
    ];
    if (data.planItemId) {
      itemConditions.push(eq(cognitiveDailyPlanItems.id, data.planItemId));
    } else if (data.activityType) {
      itemConditions.push(eq(cognitiveDailyPlanItems.activityType, data.activityType));
    }

    const [item] = await db
      .select()
      .from(cognitiveDailyPlanItems)
      .where(and(...itemConditions))
      .limit(1);

    if (!item) {
      return res.status(404).json({ error: "Brain Coach plan item not found." });
    }

    const patch = applyPlanItemEvent(storedItems([item])[0], data.eventType);
    if (Object.keys(patch).length > 0) {
      await db
        .update(cognitiveDailyPlanItems)
        .set(patch)
        .where(and(
          eq(cognitiveDailyPlanItems.id, item.id),
          eq(cognitiveDailyPlanItems.userId, req.user!.id),
        ));
    }

    await db.insert(cognitiveDailyPlanEvents).values({
      planId: plan.id,
      planItemId: item.id,
      userId: req.user!.id,
      activityType: item.activityType,
      eventType: data.eventType,
      source: data.source,
      metadata: data.metadata,
    });

    const items = await selectPlanItems(ctx, plan.id);
    const persistedPlan = buildPersistedBrainCoachPlan(storedPlan(plan), storedItems(items));
    return res.json(persistedPlan);
  } catch (error) {
    console.error("[games] Brain Coach daily plan event failed:", error);
    return res.status(500).json({ error: "Brain Coach plan event could not be saved." });
  }
}

export async function brainCoachCaregiverSummaryHandler(req: Request, res: Response) {
  try {
    const ctx = await loadCognitiveSessionDb();
    const {
      db,
      cognitiveSessionIndex,
      cognitiveDailyPlans,
      cognitiveDailyPlanItems,
      and,
      desc,
      eq,
      gte,
      asc,
    } = ctx;
    const now = new Date();
    const todayStart = utcDayStart(now);
    const planWindowStart = new Date(todayStart - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sessionWindowStart = new Date(todayStart - 29 * 24 * 60 * 60 * 1000);

    const [sessions, plans, planItems] = await Promise.all([
      db
        .select()
        .from(cognitiveSessionIndex)
        .where(and(
          eq(cognitiveSessionIndex.userId, req.user!.id),
          gte(cognitiveSessionIndex.playedAt, sessionWindowStart),
        ))
        .orderBy(desc(cognitiveSessionIndex.playedAt))
        .limit(100),
      db
        .select()
        .from(cognitiveDailyPlans)
        .where(and(
          eq(cognitiveDailyPlans.userId, req.user!.id),
          gte(cognitiveDailyPlans.planDate, planWindowStart),
        ))
        .orderBy(desc(cognitiveDailyPlans.planDate))
        .limit(7),
      db
        .select()
        .from(cognitiveDailyPlanItems)
        .where(and(
          eq(cognitiveDailyPlanItems.userId, req.user!.id),
          gte(cognitiveDailyPlanItems.planDate, planWindowStart),
        ))
        .orderBy(asc(cognitiveDailyPlanItems.planDate), asc(cognitiveDailyPlanItems.sortOrder)),
    ]);

    return res.json(buildBrainCoachCaregiverSummary({ sessions, plans, planItems, now }));
  } catch (error) {
    console.error("[games] Brain Coach caregiver summary failed:", error);
    return res.status(500).json({ error: "Brain Coach caregiver summary could not be loaded." });
  }
}

type SupabaseCompatFilter = {
  column: string;
  expression: string;
};

type SupabaseCompatPayload = {
  method?: string;
  selectColumns?: string;
  filters?: SupabaseCompatFilter[];
  orderClause?: string | null;
  limitCount?: number | null;
  body?: unknown;
  onConflict?: string | null;
};

type SupabaseCompatAccess = "user" | "content" | "adminContent";

const SUPABASE_COMPAT_TABLES: Record<string, SupabaseCompatAccess> = {
  category_sort_cards: "content",
  category_sort_sequences: "content",
  category_sort_sessions: "user",
  category_sort_user_state: "user",
  curious_minds_hooks: "adminContent",
  curious_minds_prompts: "adminContent",
  curious_minds_sessions: "user",
  curious_minds_user_state: "user",
  dual_task_sequences: "content",
  dual_task_sessions: "user",
  dual_task_user_state: "user",
  face_name_personas: "content",
  face_name_sets: "content",
  face_name_sessions: "user",
  face_name_user_state: "user",
  listen_closely_sessions: "user",
  listen_closely_soundscapes: "content",
  listen_closely_user_state: "user",
  number_trails_configs: "content",
  number_trails_sessions: "user",
  number_trails_user_state: "user",
  remember_later_rounds: "content",
  remember_later_sessions: "user",
  remember_later_user_state: "user",
  spatial_nav_maps: "content",
  spatial_nav_sessions: "user",
  spatial_nav_user_state: "user",
};

const SUPABASE_COMPAT_FILTER_OPERATORS: Record<string, string> = {
  eq: "=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();

function isIdentifier(value: string) {
  return /^[a-z_][a-z0-9_]*$/i.test(value);
}

function quoteIdentifier(value: string) {
  if (!isIdentifier(value)) throw new Error("Invalid identifier.");
  return `"${value}"`;
}

function parseSupabaseCompatValue(value: string) {
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function parseSupabaseCompatList(value: string) {
  const trimmed = value.trim();
  const inner = trimmed.startsWith("(") && trimmed.endsWith(")")
    ? trimmed.slice(1, -1)
    : trimmed;
  if (!inner.trim()) return [];
  return inner.split(",").map((entry) => parseSupabaseCompatValue(entry.trim()));
}

function selectedColumns(selectColumns: string | undefined, availableColumns: Set<string>) {
  if (!selectColumns || selectColumns.trim() === "*" || selectColumns.trim() === "") {
    return "*";
  }

  return selectColumns
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
    .map((column) => {
      if (!availableColumns.has(column)) throw new Error(`Column ${column} is not available.`);
      return quoteIdentifier(column);
    })
    .join(", ");
}

function rowsFromBody(body: unknown): Record<string, unknown>[] {
  const values = Array.isArray(body) ? body : [body];
  return values.filter((value): value is Record<string, unknown> => (
    value !== null && typeof value === "object" && !Array.isArray(value)
  ));
}

function filterSql(
  filters: SupabaseCompatFilter[] | undefined,
  availableColumns: Set<string>,
  values: unknown[],
) {
  const clauses: string[] = [];

  for (const filter of filters ?? []) {
    if (!availableColumns.has(filter.column)) {
      throw new Error(`Column ${filter.column} is not available.`);
    }
    const column = quoteIdentifier(filter.column);
    const expression = String(filter.expression ?? "");

    const operator = expression.split(".", 1)[0];
    if (operator === "in") {
      const list = parseSupabaseCompatList(expression.slice("in.".length));
      if (list.length === 0) {
        clauses.push("false");
        continue;
      }
      const placeholders = list.map((entry) => {
        values.push(entry);
        return `$${values.length}`;
      });
      clauses.push(`${column} IN (${placeholders.join(", ")})`);
      continue;
    }

    if (operator === "not") {
      const rest = expression.slice("not.".length);
      const nestedOperator = rest.split(".", 1)[0];
      const rawValue = rest.slice(nestedOperator.length + 1);
      if (nestedOperator === "is" && rawValue === "null") {
        clauses.push(`${column} IS NOT NULL`);
        continue;
      }
      if (nestedOperator === "in") {
        const list = parseSupabaseCompatList(rawValue);
        if (list.length === 0) continue;
        const placeholders = list.map((entry) => {
          values.push(entry);
          return `$${values.length}`;
        });
        clauses.push(`${column} NOT IN (${placeholders.join(", ")})`);
        continue;
      }
      throw new Error(`Filter operator not.${nestedOperator} is not supported.`);
    }

    const sqlOperator = SUPABASE_COMPAT_FILTER_OPERATORS[operator];
    if (!sqlOperator) {
      throw new Error(`Filter operator ${operator} is not supported.`);
    }
    values.push(parseSupabaseCompatValue(expression.slice(operator.length + 1)));
    clauses.push(`${column} ${sqlOperator} $${values.length}`);
  }

  return clauses;
}

function orderSql(orderClause: string | null | undefined, availableColumns: Set<string>) {
  if (!orderClause) return "";
  const [column, direction] = orderClause.split(".");
  if (!availableColumns.has(column)) throw new Error(`Column ${column} is not available.`);
  return ` ORDER BY ${quoteIdentifier(column)} ${direction === "desc" ? "DESC" : "ASC"}`;
}

function limitSql(limitCount: number | null | undefined, values: unknown[]) {
  if (!Number.isFinite(limitCount ?? Number.NaN)) return "";
  const limit = Math.min(1000, Math.max(1, Math.round(Number(limitCount))));
  values.push(limit);
  return ` LIMIT $${values.length}`;
}

function cleanWriteRow(
  row: Record<string, unknown>,
  availableColumns: Set<string>,
  access: SupabaseCompatAccess,
  userId: string,
) {
  const cleaned: Record<string, unknown> = {};
  Object.entries(row).forEach(([key, value]) => {
    if (availableColumns.has(key)) cleaned[key] = value;
  });
  if (access === "user" && availableColumns.has("user_id")) {
    cleaned.user_id = userId;
  }
  return cleaned;
}

async function loadSupabaseCompatColumns(pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ column_name: string }> }> }, table: string) {
  const result = await pool.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = $1`,
    [table],
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function isSupabaseCompatAdmin(
  pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ ok: boolean }> }> },
  req: Request,
) {
  const requestEmail = typeof req.user?.email === "string" ? req.user.email.toLowerCase() : "";
  if (requestEmail && requestEmail === SUPER_ADMIN_EMAIL) return true;

  const result = await pool.query(
    `select (
       exists (
         select 1 from profiles
         where id = $1
           and (
             role = 'admin'
             or lower(coalesce(email, '')) = $2
           )
       )
       or exists (
         select 1 from users
         where id = $1
           and lower(coalesce(email, '')) = $2
       )
     ) as ok`,
    [req.user!.id, SUPER_ADMIN_EMAIL],
  );
  return Boolean(result.rows[0]?.ok);
}

async function selectSupabaseCompatRows(
  pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  table: string,
  columns: Set<string>,
  access: SupabaseCompatAccess,
  isAdmin: boolean,
  req: Request,
  payload: SupabaseCompatPayload,
) {
  const values: unknown[] = [];
  const clauses = filterSql(payload.filters, columns, values);
  if (access === "user" && columns.has("user_id")) {
    values.push(req.user!.id);
    clauses.push(`"user_id" = $${values.length}`);
  }
  if (access === "content" && columns.has("is_active")) {
    values.push(true);
    clauses.push(`"is_active" = $${values.length}`);
  }
  if (access === "adminContent" && !isAdmin && columns.has("is_active")) {
    values.push(true);
    clauses.push(`"is_active" = $${values.length}`);
  }

  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const order = orderSql(payload.orderClause, columns);
  const limit = limitSql(payload.limitCount, values);
  const selected = selectedColumns(payload.selectColumns, columns);
  const sql = `SELECT ${selected} FROM public.${quoteIdentifier(table)}${where}${order}${limit}`;
  const result = await pool.query(sql, values);
  return result.rows;
}

async function insertSupabaseCompatRows(
  pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  table: string,
  columns: Set<string>,
  access: SupabaseCompatAccess,
  req: Request,
  payload: SupabaseCompatPayload,
) {
  const rows = rowsFromBody(payload.body).map((row) => cleanWriteRow(row, columns, access, req.user!.id));
  if (rows.length === 0) return [];

  const insertColumns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((column) => columns.has(column));
  if (insertColumns.length === 0) throw new Error("No writable columns were provided.");

  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const placeholders = insertColumns.map((column) => {
      values.push(row[column] ?? null);
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });

  const sql = `INSERT INTO public.${quoteIdentifier(table)} (${insertColumns.map(quoteIdentifier).join(", ")})
    VALUES ${tuples.join(", ")}
    RETURNING *`;
  const result = await pool.query(sql, values);
  return result.rows;
}

async function updateSupabaseCompatRows(
  pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  table: string,
  columns: Set<string>,
  access: SupabaseCompatAccess,
  req: Request,
  payload: SupabaseCompatPayload,
) {
  const row = cleanWriteRow(rowsFromBody(payload.body)[0] ?? {}, columns, access, req.user!.id);
  const writeColumns = Object.keys(row).filter((column) => column !== "user_id" && columns.has(column));
  if (writeColumns.length === 0) throw new Error("No writable columns were provided.");

  const values: unknown[] = [];
  const setSql = writeColumns.map((column) => {
    values.push(row[column] ?? null);
    return `${quoteIdentifier(column)} = $${values.length}`;
  });
  const clauses = filterSql(payload.filters, columns, values);
  if (access === "user" && columns.has("user_id")) {
    values.push(req.user!.id);
    clauses.push(`"user_id" = $${values.length}`);
  }
  if (clauses.length === 0) throw new Error("Update requires a filter.");

  const sql = `UPDATE public.${quoteIdentifier(table)}
    SET ${setSql.join(", ")}
    WHERE ${clauses.join(" AND ")}
    RETURNING *`;
  const result = await pool.query(sql, values);
  return result.rows;
}

async function upsertSupabaseCompatRows(
  pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  table: string,
  columns: Set<string>,
  access: SupabaseCompatAccess,
  req: Request,
  payload: SupabaseCompatPayload,
) {
  const conflictColumns = String(payload.onConflict ?? "")
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
  if (conflictColumns.length === 0 || conflictColumns.some((column) => !columns.has(column))) {
    throw new Error("Upsert requires valid conflict columns.");
  }
  if (access === "user" && columns.has("user_id") && !conflictColumns.includes("user_id")) {
    throw new Error("User-owned upserts must conflict on user_id.");
  }

  const rows = rowsFromBody(payload.body).map((row) => cleanWriteRow(row, columns, access, req.user!.id));
  if (rows.length === 0) return [];

  const insertColumns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((column) => columns.has(column));
  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const placeholders = insertColumns.map((column) => {
      values.push(row[column] ?? null);
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  const updates = insertColumns
    .filter((column) => !conflictColumns.includes(column))
    .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`);

  const sql = `INSERT INTO public.${quoteIdentifier(table)} (${insertColumns.map(quoteIdentifier).join(", ")})
    VALUES ${tuples.join(", ")}
    ON CONFLICT (${conflictColumns.map(quoteIdentifier).join(", ")})
    DO UPDATE SET ${updates.length ? updates.join(", ") : `${quoteIdentifier(conflictColumns[0])} = EXCLUDED.${quoteIdentifier(conflictColumns[0])}`}
    RETURNING *`;
  const result = await pool.query(sql, values);
  return result.rows;
}

async function runGameDataRequest(req: Request, res: Response, table: string, payload: SupabaseCompatPayload) {
  const access = SUPABASE_COMPAT_TABLES[table];
  if (!access) {
    return res.status(404).json({ error: "Table is not available through the backend adapter." });
  }

  const method = String(payload.method ?? "GET").toUpperCase();
  const needsAdmin = access === "adminContent" && method !== "GET";
  if (access === "content" && method !== "GET") {
    return res.status(403).json({ error: "Content tables are read-only through the backend adapter." });
  }

  try {
    const { pool } = await import("../db.js");
    const [columns, isAdmin] = await Promise.all([
      loadSupabaseCompatColumns(pool, table),
      access === "adminContent" || needsAdmin ? isSupabaseCompatAdmin(pool, req) : Promise.resolve(false),
    ]);
    if (columns.size === 0) {
      return res.status(404).json({ error: "Table does not exist." });
    }
    if (needsAdmin && !isAdmin) {
      return res.status(403).json({ error: "Admin access required." });
    }

    const rows = method === "GET"
      ? await selectSupabaseCompatRows(pool, table, columns, access, isAdmin, req, payload)
      : method === "POST" && payload.onConflict
        ? await upsertSupabaseCompatRows(pool, table, columns, access, req, payload)
        : method === "POST"
          ? await insertSupabaseCompatRows(pool, table, columns, access, req, payload)
          : method === "PATCH"
            ? await updateSupabaseCompatRows(pool, table, columns, access, req, payload)
            : null;

    if (rows === null) {
      return res.status(405).json({ error: "Method is not supported." });
    }
    return res.json({ data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backend adapter request failed.";
    console.error("[games] Backend Supabase adapter failed:", error);
    return res.status(400).json({ error: message });
  }
}

export async function supabaseCompatHandler(req: Request, res: Response) {
  return runGameDataRequest(req, res, req.params.table, req.body as SupabaseCompatPayload);
}

export async function gameDataQueryHandler(req: Request, res: Response) {
  return runGameDataRequest(req, res, req.params.table, { ...(req.body as SupabaseCompatPayload), method: "GET" });
}

export async function gameDataCreateHandler(req: Request, res: Response) {
  return runGameDataRequest(req, res, req.params.table, { ...(req.body as SupabaseCompatPayload), method: "POST" });
}

export async function gameDataUpdateHandler(req: Request, res: Response) {
  return runGameDataRequest(req, res, req.params.table, { ...(req.body as SupabaseCompatPayload), method: "PATCH" });
}

const router = Router();
router.post("/data/:table/query", gameDataQueryHandler);
router.post("/data/:table", gameDataCreateHandler);
router.patch("/data/:table", gameDataUpdateHandler);
router.post("/supabase/:table", supabaseCompatHandler);
router.get("/curious-minds/content", curiousMindsContentHandler);
router.post("/curious-minds/sessions", curiousMindsSessionHandler);
router.get("/scent-memory/content", scentMemoryContentHandler);
router.post("/scent-memory/sessions", scentMemorySessionHandler);
router.get("/breath-garden/state", breathGardenStateHandler);
router.post("/breath-garden/sessions", breathGardenSessionHandler);
router.post("/sessions", createCognitiveSessionHandler);
router.get("/history", cognitiveSessionHistoryHandler);
router.get("/progress", brainCoachProgressHandler);
router.get("/daily-plan", brainCoachDailyPlanHandler);
router.post("/daily-plan/events", brainCoachDailyPlanEventHandler);
router.get("/caregiver-summary", brainCoachCaregiverSummaryHandler);
router.post("/score-retell", scoreRetellHandler);
router.post("/tts", ttsHandler);

export default router;
