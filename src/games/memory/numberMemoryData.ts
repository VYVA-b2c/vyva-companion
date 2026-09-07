import type { LanguageCode } from "@/i18n/languages";
import type { MemoryGameLevel, MemoryGameVariantContent } from "./types";

export const NUMBER_MEMORY_MAX_LEVEL = 30;
export const NUMBER_MEMORY_VARIANTS_PER_LEVEL = 12;
export const NUMBER_MEMORY_ROUNDS_PER_LEVEL = 3;

export type NumberMemoryMode = "forward" | "reverse" | "ascending";

export type NumberMemoryRound = {
  id: string;
  digits: string;
  mode: NumberMemoryMode;
  presentationMsPerDigit: number;
};

export type NumberMemoryPayload = {
  roundVersion: "number_memory_v2";
  rounds: NumberMemoryRound[];
};

const LANGUAGES: LanguageCode[] = ["en", "es", "fr", "de", "it", "pt"];

const TITLES: Record<LanguageCode, string> = {
  en: "Number Memory", es: "Memoria de números", fr: "Mémoire des nombres",
  de: "Zahlengedächtnis", it: "Memoria dei numeri", pt: "Memória de números",
};

const PROMPTS: Record<LanguageCode, Record<NumberMemoryMode | "mixed", string>> = {
  en: { forward: "Enter the numbers in the same order.", reverse: "Enter the numbers in reverse order.", ascending: "Enter the numbers from lowest to highest.", mixed: "Complete three different number challenges." },
  es: { forward: "Introduce los números en el mismo orden.", reverse: "Introduce los números en orden inverso.", ascending: "Introduce los números de menor a mayor.", mixed: "Completa tres retos numéricos diferentes." },
  fr: { forward: "Saisissez les nombres dans le même ordre.", reverse: "Saisissez les nombres dans l’ordre inverse.", ascending: "Saisissez les nombres du plus petit au plus grand.", mixed: "Réalisez trois défis numériques différents." },
  de: { forward: "Geben Sie die Zahlen in derselben Reihenfolge ein.", reverse: "Geben Sie die Zahlen in umgekehrter Reihenfolge ein.", ascending: "Geben Sie die Zahlen von klein nach groß ein.", mixed: "Lösen Sie drei verschiedene Zahlenaufgaben." },
  it: { forward: "Inserisci i numeri nello stesso ordine.", reverse: "Inserisci i numeri in ordine inverso.", ascending: "Inserisci i numeri dal più piccolo al più grande.", mixed: "Completa tre diverse sfide numeriche." },
  pt: { forward: "Introduza os números pela mesma ordem.", reverse: "Introduza os números pela ordem inversa.", ascending: "Introduza os números do menor para o maior.", mixed: "Complete três desafios numéricos diferentes." },
};

type RoundSpec = Pick<NumberMemoryRound, "mode" | "presentationMsPerDigit"> & { length: number };

export function getNumberMemoryRoundSpecs(level: number): RoundSpec[] {
  const safeLevel = Math.min(NUMBER_MEMORY_MAX_LEVEL, Math.max(1, Math.round(level)));
  if (safeLevel <= 5) {
    const lengths = [3, 3, 4, 4, 5];
    const paces = [1200, 1100, 1100, 1000, 1000];
    return Array.from({ length: 3 }, () => ({ mode: "forward", length: lengths[safeLevel - 1], presentationMsPerDigit: paces[safeLevel - 1] }));
  }
  if (safeLevel <= 10) {
    const lengths = [5, 5, 6, 6, 7];
    return Array.from({ length: 3 }, () => ({ mode: "forward", length: lengths[safeLevel - 6], presentationMsPerDigit: 1000 }));
  }
  if (safeLevel <= 15) {
    const lengths = [3, 3, 4, 4, 5];
    const paces = [1200, 1100, 1100, 1000, 1000];
    return Array.from({ length: 3 }, () => ({ mode: "reverse", length: lengths[safeLevel - 11], presentationMsPerDigit: paces[safeLevel - 11] }));
  }
  if (safeLevel <= 20) {
    const lengths = [5, 5, 6, 6, 7];
    return Array.from({ length: 3 }, () => ({ mode: "reverse", length: lengths[safeLevel - 16], presentationMsPerDigit: 1000 }));
  }
  if (safeLevel <= 25) {
    const lengths = [3, 3, 4, 4, 5];
    const paces = [1200, 1100, 1100, 1000, 1000];
    return Array.from({ length: 3 }, () => ({ mode: "ascending", length: lengths[safeLevel - 21], presentationMsPerDigit: paces[safeLevel - 21] }));
  }
  const mixedLengths = [
    [6, 4, 4], [6, 5, 4], [7, 5, 5], [7, 6, 5], [8, 6, 6],
  ][safeLevel - 26];
  return (["forward", "reverse", "ascending"] as NumberMemoryMode[]).map((mode, index) => ({
    mode,
    length: mixedLengths[index],
    presentationMsPerDigit: 1000,
  }));
}

function nextSeed(seed: number) {
  return (seed * 1664525 + 1013904223) >>> 0;
}

export function isValidNumberMemorySequence(digits: string, unique = false) {
  if (!/^\d+$/.test(digits) || digits.startsWith("0")) return false;
  if (unique && new Set(digits).size !== digits.length) return false;
  if (digits === [...digits].reverse().join("")) return false;
  for (let index = 1; index < digits.length; index += 1) {
    if (digits[index] === digits[index - 1]) return false;
  }
  for (let index = 2; index < digits.length; index += 1) {
    const a = Number(digits[index - 2]);
    const b = Number(digits[index - 1]);
    const c = Number(digits[index]);
    if ((b === a + 1 && c === b + 1) || (b === a - 1 && c === b - 1)) return false;
  }
  return true;
}

function generateDigits(level: number, variant: number, round: number, spec: RoundSpec) {
  let seed = (level * 73856093) ^ (variant * 19349663) ^ (round * 83492791);
  for (let attempt = 0; attempt < 500; attempt += 1) {
    let candidate = "";
    const used = new Set<number>();
    while (candidate.length < spec.length) {
      seed = nextSeed(seed);
      const digit = seed % 10;
      if (candidate.length === 0 && digit === 0) continue;
      if (spec.mode === "ascending" && used.has(digit)) continue;
      used.add(digit);
      candidate += String(digit);
    }
    if (isValidNumberMemorySequence(candidate, spec.mode === "ascending")) return candidate;
  }
  throw new Error(`Unable to generate Number Memory sequence for level ${level}`);
}

export function getNumberMemoryExpectedAnswer(round: NumberMemoryRound) {
  if (round.mode === "reverse") return [...round.digits].reverse().join("");
  if (round.mode === "ascending") return [...round.digits].sort((a, b) => Number(a) - Number(b)).join("");
  return round.digits;
}

export function getNumberMemoryEditDistance(expected: string, actual: string) {
  const previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let expectedIndex = 1; expectedIndex <= expected.length; expectedIndex += 1) {
    const current = [expectedIndex];
    for (let actualIndex = 1; actualIndex <= actual.length; actualIndex += 1) {
      current[actualIndex] = Math.min(
        current[actualIndex - 1] + 1,
        previous[actualIndex] + 1,
        previous[actualIndex - 1] + (expected[expectedIndex - 1] === actual[actualIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[actual.length];
}

export function scoreNumberMemoryRounds(rounds: NumberMemoryRound[], answers: string[]) {
  const expectedAnswers = rounds.map(getNumberMemoryExpectedAnswer);
  const editDistances = expectedAnswers.map((expected, index) => getNumberMemoryEditDistance(expected, answers[index] ?? ""));
  const totalDigitCount = expectedAnswers.reduce((sum, answer) => sum + answer.length, 0);
  const mistakes = editDistances.reduce((sum, distance) => sum + distance, 0);
  const correctDigitCount = Math.max(0, totalDigitCount - mistakes);
  const accuracy = Math.round((correctDigitCount / Math.max(1, totalDigitCount)) * 100);
  const exactRoundCount = editDistances.filter((distance) => distance === 0).length;
  return { expectedAnswers, editDistances, totalDigitCount, mistakes, correctDigitCount, accuracy, exactRoundCount, levelPassed: exactRoundCount >= 2 && accuracy >= 80 };
}

export function buildNumberMemoryLevels(): MemoryGameLevel[] {
  return Array.from({ length: NUMBER_MEMORY_MAX_LEVEL }, (_, levelIndex) => {
    const level = levelIndex + 1;
    const specs = getNumberMemoryRoundSpecs(level);
    return {
      level,
      variants: Array.from({ length: NUMBER_MEMORY_VARIANTS_PER_LEVEL }, (_, variantIndex) => {
        const variant = variantIndex + 1;
        const rounds = specs.map((spec, roundIndex) => ({
          id: `number_memory-l${level}-v${variant}-r${roundIndex + 1}`,
          digits: generateDigits(level, variant, roundIndex + 1, spec),
          mode: spec.mode,
          presentationMsPerDigit: spec.presentationMsPerDigit,
        }));
        const promptKey = new Set(rounds.map((round) => round.mode)).size > 1 ? "mixed" : rounds[0].mode;
        const content = LANGUAGES.reduce((localized, language) => {
          localized[language] = { title: TITLES[language], prompt: PROMPTS[language][promptKey], payload: { roundVersion: "number_memory_v2", rounds } satisfies NumberMemoryPayload };
          return localized;
        }, {} as Partial<Record<LanguageCode, MemoryGameVariantContent>> & { es: MemoryGameVariantContent });
        return { id: `number_memory-l${level}-v${variant}`, level, content };
      }),
    };
  });
}
