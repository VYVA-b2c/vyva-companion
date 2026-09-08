import { describe, expect, it } from "vitest";
import { matchesBenefitsProgram, type BenefitsProgramRecord, type BenefitsScreeningAnswers } from "./benefits";

const answers: BenefitsScreeningAnswers = {
  country: "ES",
  region: "",
  age: 70,
  livingSituation: "alone",
  currentBenefits: [],
};

function program(overrides: Partial<BenefitsProgramRecord> = {}): BenefitsProgramRecord {
  const copy = { en: "Example", es: "Ejemplo", de: "Beispiel", fr: "Exemple", it: "Esempio", pt: "Exemplo" };
  return {
    id: "program-1",
    country: "ES",
    region: null,
    name: copy,
    description: copy,
    eligibilityRules: [{ field: "age", operator: "gte", value: 65 }],
    isActive: true,
    ...overrides,
  };
}

describe("Benefits Navigator eligibility gate", () => {
  it("matches an active programme when every minimal rule passes", () => {
    expect(matchesBenefitsProgram(program(), answers)).toBe(true);
  });

  it("never returns an inactive programme even when its rules pass", () => {
    expect(matchesBenefitsProgram(program({ isActive: false }), answers)).toBe(false);
  });

  it("excludes support the user already receives", () => {
    const existing = program({
      eligibilityRules: [{ field: "currentBenefits", operator: "notIncludes", value: "es-pnc" }],
    });
    expect(matchesBenefitsProgram(existing, { ...answers, currentBenefits: ["es-pnc"] })).toBe(false);
  });
});
