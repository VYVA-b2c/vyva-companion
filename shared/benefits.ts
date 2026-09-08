import type { AppLanguage } from "./language.js";

export const BENEFITS_COUNTRIES = ["ES", "DE"] as const;
export const BENEFITS_LIVING_SITUATIONS = ["alone", "partner", "family", "care_home", "other"] as const;

export type BenefitsCountry = (typeof BENEFITS_COUNTRIES)[number];
export type BenefitsLivingSituation = (typeof BENEFITS_LIVING_SITUATIONS)[number];
export type BenefitsLocalizedText = Record<AppLanguage, string>;

export type BenefitsScreeningAnswers = {
  country: BenefitsCountry;
  region?: string;
  age: number;
  livingSituation: BenefitsLivingSituation;
  currentBenefits: string[];
};

export type BenefitsEligibilityRule = {
  field: "age" | "livingSituation" | "currentBenefits";
  operator: "gte" | "equals" | "notIncludes";
  value: string | number;
};

export type BenefitsProgramRecord = {
  id: string;
  country: BenefitsCountry;
  region?: string | null;
  name: BenefitsLocalizedText;
  description: BenefitsLocalizedText;
  eligibilityRules: BenefitsEligibilityRule[];
  isActive: boolean;
};

export type BenefitsProgramResult = {
  id: string;
  country: BenefitsCountry;
  region?: string | null;
  name: string;
  description: string;
  askInesStarter: string;
};

function ruleMatches(rule: BenefitsEligibilityRule, answers: BenefitsScreeningAnswers) {
  if (rule.field === "age" && rule.operator === "gte" && typeof rule.value === "number") {
    return answers.age >= rule.value;
  }
  if (rule.field === "livingSituation" && rule.operator === "equals" && typeof rule.value === "string") {
    return answers.livingSituation === rule.value;
  }
  if (rule.field === "currentBenefits" && rule.operator === "notIncludes" && typeof rule.value === "string") {
    return !answers.currentBenefits.includes(rule.value);
  }
  return false;
}

export function matchesBenefitsProgram(program: BenefitsProgramRecord, answers: BenefitsScreeningAnswers) {
  if (!program.isActive || program.country !== answers.country) return false;
  if (program.region && program.region.toLowerCase() !== answers.region?.trim().toLowerCase()) return false;
  return program.eligibilityRules.every((rule) => ruleMatches(rule, answers));
}

export function localizeBenefitsText(copy: BenefitsLocalizedText, language: AppLanguage) {
  return copy[language] || copy.en;
}
