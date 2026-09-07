import { apiFetch } from "@/lib/queryClient";
import type { GameResult } from "./types";

const STORAGE_KEY = "vyva-memory-game-results";
const SERVER_SAVE_TIMEOUT_MS = 4500;

let memoryFallback: GameResult[] = [];

type GameStorageAdapter = {
  saveGameResult: (result: GameResult) => Promise<void>;
  getGameHistory: (userId: string) => Promise<GameResult[]>;
  getRecentGameHistory: (userId: string, days: number) => Promise<GameResult[]>;
};

type CognitiveSessionDto = {
  id?: string | null;
  userId?: string | null;
  activityType: string;
  domain: string;
  difficulty: number;
  completed: boolean;
  score: number;
  accuracyPct?: number | null;
  durationSeconds: number;
  playedAt: string;
  language?: string | null;
  sourceSessionId?: string | null;
  clientResultId?: string | null;
  metadata?: Record<string, unknown>;
};

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function stableClientResultId(result: GameResult): string {
  if (result.clientResultId) return result.clientResultId;

  const source = [
    result.userId,
    result.gameType,
    result.variantId,
    result.level,
    result.score,
    result.accuracy,
    result.durationSeconds,
    result.completedAt,
  ].join("|");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) | 0;
  }
  return `memory:${Math.abs(hash).toString(36)}`;
}

function normalizeResult(result: GameResult): GameResult {
  return {
    language: "es",
    ...result,
    clientResultId: stableClientResultId(result),
  };
}

function isSameResult(a: GameResult, b: GameResult) {
  if (a.clientResultId && b.clientResultId) return a.clientResultId === b.clientResultId;
  return (
    a.userId === b.userId &&
    a.gameType === b.gameType &&
    a.variantId === b.variantId &&
    a.completedAt === b.completedAt
  );
}

function readAllResults(): GameResult[] {
  if (!hasLocalStorage()) {
    return [...memoryFallback];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as GameResult[]).map(normalizeResult)
      : [];
  } catch {
    return [];
  }
}

function writeAllResults(results: GameResult[]) {
  if (!hasLocalStorage()) {
    memoryFallback = [...results];
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
}

const localStorageAdapter: GameStorageAdapter = {
  async saveGameResult(result) {
    const normalized = normalizeResult(result);
    const results = readAllResults();
    const existingIndex = results.findIndex((entry) => isSameResult(entry, normalized));
    if (existingIndex >= 0) {
      results[existingIndex] = normalized;
    } else {
      results.push(normalized);
    }
    writeAllResults(results);
  },

  async getGameHistory(userId) {
    return readAllResults()
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  },

  async getRecentGameHistory(userId, days) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return readAllResults()
      .filter((entry) => entry.userId === userId)
      .filter((entry) => new Date(entry.completedAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  },
};

function resultToSessionPayload(result: GameResult) {
  const normalized = normalizeResult(result);
  return {
    activityType: normalized.gameType,
    domain: normalized.cognitiveDomain,
    difficulty: normalized.level,
    difficultyScale: "level",
    completed: true,
    abandoned: false,
    score: Math.max(0, Math.round(normalized.score)),
    accuracyPct: Math.max(0, Math.min(100, normalized.accuracy)),
    durationSeconds: Math.max(0, Math.round(normalized.durationSeconds)),
    playedAt: normalized.completedAt,
    language: normalized.language,
    source: "memory_game",
    clientResultId: normalized.clientResultId,
    metadata: {
      variantId: normalized.variantId,
      mistakes: normalized.mistakes,
      ...normalized.metadata,
    },
  };
}

function sessionToGameResult(session: CognitiveSessionDto, fallbackUserId: string): GameResult {
  const metadata = session.metadata ?? {};
  const variantId = typeof metadata.variantId === "string"
    ? metadata.variantId
    : session.sourceSessionId ?? session.id ?? "server";
  const mistakes = Number(metadata.mistakes);

  return normalizeResult({
    userId: session.userId ?? fallbackUserId,
    gameType: session.activityType,
    cognitiveDomain: session.domain,
    variantId,
    level: session.difficulty,
    score: session.score,
    accuracy: session.accuracyPct ?? 0,
    mistakes: Number.isFinite(mistakes) ? mistakes : 0,
    durationSeconds: session.durationSeconds,
    completedAt: session.playedAt,
    language: (session.language ?? "es") as GameResult["language"],
    clientResultId: session.clientResultId ?? undefined,
    metadata,
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`Memory game result save timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const serverAdapter: GameStorageAdapter = {
  async saveGameResult(result) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const response = await withTimeout(apiFetch("/api/games/sessions", {
      method: "POST",
      body: JSON.stringify(resultToSessionPayload(result)),
      signal: controller?.signal,
    }), SERVER_SAVE_TIMEOUT_MS, () => controller?.abort());
    if (!response.ok) {
      throw new Error(`Memory game result save failed with ${response.status}`);
    }
  },

  async getGameHistory(userId) {
    const response = await apiFetch("/api/games/history?family=memory&limit=200");
    if (!response.ok) {
      throw new Error(`Memory game history load failed with ${response.status}`);
    }
    const payload = await response.json() as { sessions?: CognitiveSessionDto[] };
    return (payload.sessions ?? [])
      .map((session) => sessionToGameResult(session, userId))
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  },

  async getRecentGameHistory(userId, days) {
    const params = new URLSearchParams({
      family: "memory",
      days: String(days),
      limit: "200",
    });
    const response = await apiFetch(`/api/games/history?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Recent memory game history load failed with ${response.status}`);
    }
    const payload = await response.json() as { sessions?: CognitiveSessionDto[] };
    return (payload.sessions ?? [])
      .map((session) => sessionToGameResult(session, userId))
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  },
};

export async function saveGameResult(result: GameResult): Promise<void> {
  const normalized = normalizeResult(result);
  try {
    await serverAdapter.saveGameResult(normalized);
  } catch (error) {
    console.warn("[memory] Saving game result locally until server is available.", error);
    await localStorageAdapter.saveGameResult(normalized);
  }
}

export async function getGameHistory(userId: string): Promise<GameResult[]> {
  try {
    return await serverAdapter.getGameHistory(userId);
  } catch (error) {
    console.warn("[memory] Loading local game history fallback.", error);
    return localStorageAdapter.getGameHistory(userId);
  }
}

export async function getRecentGameHistory(userId: string, days: number): Promise<GameResult[]> {
  try {
    return await serverAdapter.getRecentGameHistory(userId, days);
  } catch (error) {
    console.warn("[memory] Loading recent local game history fallback.", error);
    return localStorageAdapter.getRecentGameHistory(userId, days);
  }
}

export type { GameResult };
