import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import { saveGameResult } from "./gameStorage";
import type { GameResult } from "./types";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const result: GameResult = {
  userId: "user-1",
  gameType: "word_recall",
  cognitiveDomain: "episodic_memory",
  variantId: "word_recall-l1-v1",
  level: 1,
  score: 100,
  accuracy: 100,
  mistakes: 0,
  durationSeconds: 45,
  completedAt: "2026-06-01T09:57:00.000Z",
  language: "fr",
};

describe("memory game storage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(apiFetch).mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    window.localStorage.clear();
  });

  it("falls back to localStorage when server persistence hangs", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockReturnValue(new Promise<Response>(() => undefined));

    const savePromise = saveGameResult(result);
    await vi.advanceTimersByTimeAsync(4600);
    await savePromise;

    const stored = JSON.parse(window.localStorage.getItem("vyva-memory-game-results") ?? "[]") as GameResult[];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      userId: "user-1",
      gameType: "word_recall",
      variantId: "word_recall-l1-v1",
      language: "fr",
    });
    expect(stored[0].clientResultId).toMatch(/^memory:/);
  });

  it("does not write local fallback when the server save succeeds", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 201 }));

    await saveGameResult(result);

    expect(window.localStorage.getItem("vyva-memory-game-results")).toBeNull();
  });

  it("merges game-specific metadata into the cognitive session payload", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 201 }));

    await saveGameResult({
      ...result,
      gameType: "association_memory",
      variantId: "association_memory-l3-v1",
      metadata: { roundVersion: "connections_v2", questionCount: 4, correctCount: 3 },
    });

    const [, request] = vi.mocked(apiFetch).mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.metadata).toMatchObject({
      variantId: "association_memory-l3-v1",
      mistakes: 0,
      roundVersion: "connections_v2",
      questionCount: 4,
      correctCount: 3,
    });
  });
});
