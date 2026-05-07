import type { LanguageCode } from "@/i18n/languages";

export type CognitiveDomain =
  | "attention"
  | "language"
  | "visual_memory"
  | "working_memory"
  | "episodic_memory"
  | "prospective_memory"
  | "associative_memory"
  | "comprehension_memory";

export type MemoryGameType =
  | "memory_match"
  | "sequence_memory"
  | "word_recall"
  | "number_memory"
  | "routine_memory"
  | "association_memory"
  | "story_recall";

export type MemoryGameVariant = {
  id: string;
  level: number;
  content: Partial<Record<LanguageCode, MemoryGameVariantContent>> & {
    es: MemoryGameVariantContent;
  };
};

export type MemoryGameVariantContent = {
  title: string;
  prompt: string;
  payload: Record<string, unknown>;
};

export type MemoryGameLevel = {
  level: number;
  variants: MemoryGameVariant[];
};

export type MemoryGameDefinition = {
  gameType: MemoryGameType;
  titleKey: string;
  descriptionKey: string;
  cognitiveDomain: CognitiveDomain;
  accentColor: string;
  iconBg: string;
  levels: MemoryGameLevel[];
};

export type Recommendation = {
  gameType: MemoryGameType;
  level: number;
  variantId: string;
  reasonLabel: string;
};

export type GameResult = {
  userId: string;
  gameType: string;
  cognitiveDomain: string;
  variantId: string;
  level: number;
  score: number;
  accuracy: number;
  mistakes: number;
  durationSeconds: number;
  completedAt: string;
  language: LanguageCode;
};
