import { describe, expect, it } from "vitest";
import {
  buildNumberMemoryLevels,
  getNumberMemoryExpectedAnswer,
  getNumberMemoryRoundSpecs,
  isValidNumberMemorySequence,
  NUMBER_MEMORY_MAX_LEVEL,
  NUMBER_MEMORY_VARIANTS_PER_LEVEL,
  scoreNumberMemoryRounds,
  type NumberMemoryRound,
} from "./numberMemoryData";

describe("Number Memory v2 data", () => {
  it("builds 30 levels with 12 deterministic three-round variants", () => {
    const first = buildNumberMemoryLevels();
    const second = buildNumberMemoryLevels();
    expect(first).toHaveLength(NUMBER_MEMORY_MAX_LEVEL);
    expect(first.every((level) => level.variants.length === NUMBER_MEMORY_VARIANTS_PER_LEVEL)).toBe(true);
    expect(first.flatMap((level) => level.variants).every((variant) => {
      const payload = variant.content.en?.payload;
      return payload?.roundVersion === "number_memory_v2" && Array.isArray(payload.rounds) && payload.rounds.length === 3;
    })).toBe(true);
    first.forEach((level) => {
      const signatures = level.variants.map((variant) => JSON.stringify(variant.content.en!.payload.rounds));
      expect(new Set(signatures).size).toBe(NUMBER_MEMORY_VARIANTS_PER_LEVEL);
    });
    expect(first).toEqual(second);
  });

  it.each([
    [1, ["forward", "forward", "forward"], [3, 3, 3], [1200, 1200, 1200]],
    [5, ["forward", "forward", "forward"], [5, 5, 5], [1000, 1000, 1000]],
    [10, ["forward", "forward", "forward"], [7, 7, 7], [1000, 1000, 1000]],
    [11, ["reverse", "reverse", "reverse"], [3, 3, 3], [1200, 1200, 1200]],
    [20, ["reverse", "reverse", "reverse"], [7, 7, 7], [1000, 1000, 1000]],
    [21, ["ascending", "ascending", "ascending"], [3, 3, 3], [1200, 1200, 1200]],
    [25, ["ascending", "ascending", "ascending"], [5, 5, 5], [1000, 1000, 1000]],
    [26, ["forward", "reverse", "ascending"], [6, 4, 4], [1000, 1000, 1000]],
    [30, ["forward", "reverse", "ascending"], [8, 6, 6], [1000, 1000, 1000]],
  ])("uses the required progression at level %i", (level, modes, lengths, paces) => {
    const specs = getNumberMemoryRoundSpecs(level);
    expect(specs.map((spec) => spec.mode)).toEqual(modes);
    expect(specs.map((spec) => spec.length)).toEqual(lengths);
    expect(specs.map((spec) => spec.presentationMsPerDigit)).toEqual(paces);
  });

  it("rejects obvious patterns and keeps reorder rounds unambiguous", () => {
    const levels = buildNumberMemoryLevels();
    levels.forEach((level) => level.variants.forEach((variant) => {
      const rounds = variant.content.en!.payload.rounds as NumberMemoryRound[];
      rounds.forEach((round) => {
        expect(isValidNumberMemorySequence(round.digits, round.mode === "ascending")).toBe(true);
        if (round.mode === "ascending") expect(new Set(round.digits).size).toBe(round.digits.length);
      });
    }));
  });

  it("scores with edit distance and requires two exact rounds plus 80 percent", () => {
    const rounds: NumberMemoryRound[] = [
      { id: "1", digits: "482", mode: "forward", presentationMsPerDigit: 1000 },
      { id: "2", digits: "731", mode: "reverse", presentationMsPerDigit: 1000 },
      { id: "3", digits: "841", mode: "ascending", presentationMsPerDigit: 1000 },
    ];
    expect(rounds.map(getNumberMemoryExpectedAnswer)).toEqual(["482", "137", "148"]);
    expect(scoreNumberMemoryRounds(rounds, ["482", "137", "18"])).toMatchObject({
      exactRoundCount: 2,
      mistakes: 1,
      correctDigitCount: 8,
      totalDigitCount: 9,
      accuracy: 89,
      levelPassed: true,
    });
    expect(scoreNumberMemoryRounds(rounds, ["482", "13", "14"])).toMatchObject({ exactRoundCount: 1, accuracy: 78, levelPassed: false });
  });

  it("localizes every variant in all six supported languages", () => {
    const languages = ["en", "es", "fr", "de", "it", "pt"] as const;
    buildNumberMemoryLevels().forEach((level) => level.variants.forEach((variant) => {
      languages.forEach((language) => {
        expect(variant.content[language]?.title).toBeTruthy();
        expect(variant.content[language]?.prompt).toBeTruthy();
      });
    }));
  });
});
