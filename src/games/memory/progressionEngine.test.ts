import { describe, expect, it } from "vitest";
import {
  getRecommendedLevelForGame,
  getRepeatLevelForResult,
  getVisualMemoryLevelProgress,
  MEMORY_LEVEL_UP_ACCURACY,
  pickNextVariantForSameGame,
  VISUAL_MEMORY_ROUNDS_TO_ADVANCE,
} from "./progressionEngine";
import type { GameResult } from "./types";

function visualResult(level: number, accuracy: number, minutesAgo: number): GameResult {
  return {
    userId: "user-1",
    gameType: "memory_match",
    cognitiveDomain: "visual_memory",
    variantId: `memory_match-l${level}-v${minutesAgo + 1}`,
    level,
    score: 500,
    accuracy,
    mistakes: 0,
    durationSeconds: 30,
    completedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    language: "en",
  };
}

function numberResult(level: number, accuracy: number): GameResult {
  return { ...visualResult(level, accuracy, 0), gameType: "number_memory", cognitiveDomain: "working_memory", variantId: `number_memory-l${level}-v1` };
}

describe("memory game progression", () => {
  it("keeps repeat on the current level below the level-up threshold", () => {
    expect(getRepeatLevelForResult(3, MEMORY_LEVEL_UP_ACCURACY - 1)).toBe(3);
  });

  it("moves repeat to the next level at the level-up threshold", () => {
    expect(getRepeatLevelForResult(3, MEMORY_LEVEL_UP_ACCURACY)).toBe(4);
  });

  it("does not move beyond the maximum level", () => {
    expect(getRepeatLevelForResult(20, 100)).toBe(20);
  });

  it("allows Number Memory to advance from legacy Level 20 while other games remain capped", () => {
    expect(getRepeatLevelForResult(20, 100, "number_memory")).toBe(21);
    expect(getRepeatLevelForResult(30, 100, "number_memory")).toBe(30);
    expect(getRepeatLevelForResult(20, 100, "word_recall")).toBe(20);
  });

  it("recommends Level 21 after a successful legacy Number Memory Level 20 result", () => {
    expect(getRecommendedLevelForGame([numberResult(20, 100)], "number_memory")).toBe(21);
  });

  it("can exclude the just-played variant before storage history catches up", () => {
    const nextVariant = pickNextVariantForSameGame([], "memory_match", 1, "memory_match-l1-v1");

    expect(nextVariant.id).not.toBe("memory_match-l1-v1");
    expect(nextVariant.level).toBe(1);
  });

  it("advances Visual Memory after one completed board without trapping lower scores", () => {
    expect(getVisualMemoryLevelProgress([], 4)).toMatchObject({
      completedRounds: 1,
      roundsRequired: VISUAL_MEMORY_ROUNDS_TO_ADVANCE,
      levelCompleted: true,
      advanced: true,
      nextLevel: 5,
    });
  });

  it("uses a completed lower-score Visual Memory board to recommend the next level", () => {
    expect(getRecommendedLevelForGame([visualResult(7, 45, 0)], "memory_match")).toBe(8);
  });

  it("opens the next recommended Visual Memory level after one completed board", () => {
    expect(getRecommendedLevelForGame([visualResult(9, 46, 0)], "memory_match")).toBe(10);
  });

  it("completes Mastery at Level 20 without inventing a Level 21", () => {
    expect(getVisualMemoryLevelProgress([], 20)).toMatchObject({
      completedRounds: 1,
      levelCompleted: true,
      advanced: false,
      nextLevel: 20,
    });
  });
});
