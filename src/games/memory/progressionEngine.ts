import { translate } from "@/i18n";
import { BRAIN_COACH_MAX_LEVEL, clampBrainCoachLevel } from "../shared/brainCoachProgression";
import type { LanguageCode } from "@/i18n/languages";
import { getGameHistory, getRecentGameHistory } from "./gameStorage";
import { getGameDefinition, getGameLevel, MEMORY_GAME_ORDER } from "./memoryGameRegistry";
import type { CognitiveDomain, GameResult, MemoryGameType, Recommendation } from "./types";

const DOMAIN_ROTATION: CognitiveDomain[] = [
  "visual_memory",
  "working_memory",
  "episodic_memory",
  "associative_memory",
];

export const MEMORY_LEVEL_UP_ACCURACY = 80;
export const VISUAL_MEMORY_ROUNDS_TO_ADVANCE = 1;

export type VisualMemoryLevelProgress = {
  completedRounds: number;
  roundsRequired: number;
  levelCompleted: boolean;
  advanced: boolean;
  nextLevel: number;
};

function getMaximumLevel(gameType?: MemoryGameType) {
  if (!gameType) return BRAIN_COACH_MAX_LEVEL;
  return getGameDefinition(gameType).levels.reduce((maximum, entry) => Math.max(maximum, entry.level), 1);
}

function clampGameLevel(level: number, gameType?: MemoryGameType) {
  return Math.min(getMaximumLevel(gameType), Math.max(1, Math.round(level)));
}

export function getRepeatLevelForResult(currentLevel: number, accuracy: number, gameType?: MemoryGameType) {
  return clampGameLevel(accuracy >= MEMORY_LEVEL_UP_ACCURACY ? currentLevel + 1 : currentLevel, gameType);
}

function getConsecutiveVisualMemoryRounds(history: GameResult[], level: number) {
  let rounds = 0;
  const visualMemoryHistory = sortNewestFirst(history).filter((entry) => entry.gameType === "memory_match");

  for (const entry of visualMemoryHistory) {
    if (entry.level !== level) break;
    rounds += 1;
    if (rounds >= VISUAL_MEMORY_ROUNDS_TO_ADVANCE) break;
  }

  return rounds;
}

export function getVisualMemoryLevelProgress(
  history: GameResult[],
  currentLevel: number,
): VisualMemoryLevelProgress {
  const level = clampBrainCoachLevel(currentLevel);
  const completedRounds = Math.min(
    VISUAL_MEMORY_ROUNDS_TO_ADVANCE,
    getConsecutiveVisualMemoryRounds(history, level) + 1,
  );
  const levelCompleted = completedRounds >= VISUAL_MEMORY_ROUNDS_TO_ADVANCE;
  const advanced = levelCompleted && level < BRAIN_COACH_MAX_LEVEL;

  return {
    completedRounds,
    roundsRequired: VISUAL_MEMORY_ROUNDS_TO_ADVANCE,
    levelCompleted,
    advanced,
    nextLevel: advanced ? clampBrainCoachLevel(level + 1) : level,
  };
}

function sortNewestFirst(results: GameResult[]) {
  return [...results].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}

export function getRecommendedLevelForGame(history: GameResult[], gameType: MemoryGameType): number {
  const gameHistory = sortNewestFirst(history).filter((entry) => entry.gameType === gameType);
  if (gameHistory.length === 0) return 1;

  if (gameType === "memory_match") {
    const latestLevel = gameHistory[0].level;
    const completedLevel = getConsecutiveVisualMemoryRounds(history, latestLevel) >= VISUAL_MEMORY_ROUNDS_TO_ADVANCE;
    return clampGameLevel(completedLevel ? latestLevel + 1 : latestLevel, gameType);
  }

  const recent = gameHistory.slice(0, 3);
  const latestLevel = gameHistory[0].level;
  const averageAccuracy = recent.reduce((sum, entry) => sum + entry.accuracy, 0) / recent.length;

  if (averageAccuracy >= MEMORY_LEVEL_UP_ACCURACY) return clampGameLevel(latestLevel + 1, gameType);
  if (averageAccuracy < 50) return clampGameLevel(latestLevel - 1, gameType);
  return clampGameLevel(latestLevel, gameType);
}

export function pickVariantForGame(history: GameResult[], gameType: MemoryGameType, level: number) {
  const levelConfig = getGameLevel(gameType, level);
  const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentVariantIds = new Set(
    history
      .filter((entry) => entry.gameType === gameType)
      .filter((entry) => new Date(entry.completedAt).getTime() >= recentCutoff)
      .map((entry) => entry.variantId),
  );

  return levelConfig.variants.find((variant) => !recentVariantIds.has(variant.id)) ?? levelConfig.variants[0];
}

export function pickNextVariantForSameGame(history: GameResult[], gameType: MemoryGameType, level: number, excludeVariantId?: string) {
  const levelConfig = getGameLevel(gameType, level);
  const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const sameGameHistory = sortNewestFirst(history).filter((entry) => entry.gameType === gameType);
  const recentVariantIds = new Set(
    sameGameHistory
      .filter((entry) => new Date(entry.completedAt).getTime() >= recentCutoff)
      .map((entry) => entry.variantId),
  );

  const availableVariants = levelConfig.variants.filter((variant) => variant.id !== excludeVariantId);
  const unusedRecentVariant = availableVariants.find((variant) => !recentVariantIds.has(variant.id));
  if (unusedRecentVariant) return unusedRecentVariant;

  const lastPlayedAt = new Map<string, number>();
  sameGameHistory.forEach((entry) => {
    if (!lastPlayedAt.has(entry.variantId)) {
      lastPlayedAt.set(entry.variantId, new Date(entry.completedAt).getTime());
    }
  });

  return (
    [...availableVariants].sort((a, b) => {
      const timeA = lastPlayedAt.get(a.id) ?? 0;
      const timeB = lastPlayedAt.get(b.id) ?? 0;
      return timeA - timeB;
    })[0] ?? levelConfig.variants[0]
  );
}

function getNextDomain(lastDomain?: CognitiveDomain): CognitiveDomain {
  if (!lastDomain) return DOMAIN_ROTATION[0];

  const index = DOMAIN_ROTATION.indexOf(lastDomain);
  if (index === -1) return DOMAIN_ROTATION[0];
  return DOMAIN_ROTATION[(index + 1) % DOMAIN_ROTATION.length];
}

function buildReasonLabel(language: LanguageCode, gameType: MemoryGameType, hasHistory: boolean) {
  if (!hasHistory) {
    return translate(language, "recommendationReasons.beginner");
  }

  const definition = getGameDefinition(gameType);
  return translate(language, `recommendationReasons.${definition.cognitiveDomain}`);
}

export async function selectGamePlan(
  userId: string,
  gameType: MemoryGameType,
  language: LanguageCode,
): Promise<Recommendation> {
  const history = await getGameHistory(userId);
  const level = getRecommendedLevelForGame(history, gameType);
  const variant = pickVariantForGame(history, gameType, level);

  return {
    gameType,
    level,
    variantId: variant.id,
    reasonLabel: buildReasonLabel(language, gameType, history.length > 0),
  };
}

export async function selectNextVariantForSameGame(
  userId: string,
  gameType: MemoryGameType,
  language: LanguageCode,
  levelOverride?: number,
  excludeVariantId?: string,
): Promise<Recommendation> {
  const history = await getGameHistory(userId);
  const gameHistory = sortNewestFirst(history).filter((entry) => entry.gameType === gameType);
  const level = levelOverride ?? getRecommendedLevelForGame(history, gameType);
  const latestVariantId = excludeVariantId ?? gameHistory[0]?.variantId;
  const variant = pickNextVariantForSameGame(history, gameType, level, latestVariantId);

  return {
    gameType,
    level,
    variantId: variant.id,
    reasonLabel: buildReasonLabel(language, gameType, gameHistory.length > 0),
  };
}

export async function selectNextMemoryGame(userId: string, language: LanguageCode): Promise<Recommendation> {
  const history = await getGameHistory(userId);
  const recentHistory = await getRecentGameHistory(userId, 30);

  if (history.length === 0) {
    return selectGamePlan(userId, "memory_match", language);
  }

  const newest = sortNewestFirst(history)[0];
  const lastGameType = newest.gameType as MemoryGameType;
  const preferredDomain = getNextDomain(newest.cognitiveDomain as CognitiveDomain);

  const candidates = MEMORY_GAME_ORDER
    .filter((gameType) => gameType !== lastGameType)
    .map((gameType) => {
      const definition = getGameDefinition(gameType);
      const level = getRecommendedLevelForGame(history, gameType);
      const lastPlayed = history.find((entry) => entry.gameType === gameType);
      const recentCount = recentHistory.filter((entry) => entry.gameType === gameType).length;

      return {
        gameType,
        level,
        cognitiveDomain: definition.cognitiveDomain,
        lastPlayedAt: lastPlayed ? new Date(lastPlayed.completedAt).getTime() : 0,
        recentCount,
      };
    })
    .sort((a, b) => {
      const domainA = a.cognitiveDomain === preferredDomain ? 0 : 1;
      const domainB = b.cognitiveDomain === preferredDomain ? 0 : 1;
      if (domainA !== domainB) return domainA - domainB;
      if (a.recentCount !== b.recentCount) return a.recentCount - b.recentCount;
      return a.lastPlayedAt - b.lastPlayedAt;
    });

  const selected = candidates[0] ?? {
    gameType: "memory_match" as MemoryGameType,
    level: 1,
  };

  const variant = pickVariantForGame(history, selected.gameType, selected.level);

  return {
    gameType: selected.gameType,
    level: selected.level,
    variantId: variant.id,
    reasonLabel: buildReasonLabel(language, selected.gameType, true),
  };
}
