import type { GameResult } from "./types";

const STORAGE_KEY = "vyva-memory-game-results";

let memoryFallback: GameResult[] = [];

type GameStorageAdapter = {
  saveGameResult: (result: GameResult) => Promise<void>;
  getGameHistory: (userId: string) => Promise<GameResult[]>;
  getRecentGameHistory: (userId: string, days: number) => Promise<GameResult[]>;
};

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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
      ? (parsed as GameResult[]).map((entry) => ({
          language: "es",
          ...entry,
        }))
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
    const results = readAllResults();
    results.push(result);
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

// TODO: Add a server-backed database adapter for authenticated users.
// TODO: Prefer the server adapter when a database is available, and keep localStorage as offline fallback.
const adapter: GameStorageAdapter = localStorageAdapter;

export async function saveGameResult(result: GameResult): Promise<void> {
  await adapter.saveGameResult(result);
}

export async function getGameHistory(userId: string): Promise<GameResult[]> {
  return adapter.getGameHistory(userId);
}

export async function getRecentGameHistory(userId: string, days: number): Promise<GameResult[]> {
  return adapter.getRecentGameHistory(userId, days);
}

export type { GameResult };
