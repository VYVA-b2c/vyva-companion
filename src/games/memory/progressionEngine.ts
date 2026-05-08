import { translate } from "@/i18n";
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

function clampLevel(level: number) {
  return Math.min(5, Math.max(1, level));
}

function sortNewestFirst(results: GameResult[]) {
  return [...results].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}

export function getRecommendedLevelForGame(history: GameResult[], gameType: MemoryGameType): number {
  const gameHistory = sortNewestFirst(history).filter((entry) => entry.gameType === gameType);
  if (gameHistory.length === 0) return 1;

  const recent = gameHistory.slice(0, 3);
  const latestLevel = gameHistory[0].level;
  const averageAccuracy = recent.reduce((sum, entry) => sum + entry.accuracy, 0) / recent.length;

  if (averageAccuracy >= 80) return clampLevel(latestLevel + 1);
  if (averageAccuracy < 50) return clampLevel(latestLevel - 1);
  return clampLevel(latestLevel);
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

function pickNextVariantForSameGame(history: GameResult[], gameType: MemoryGameType, level: number, excludeVariantId?: string) {
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
): Promise<Recommendation> {
  const history = await getGameHistory(userId);
  const gameHistory = sortNewestFirst(history).filter((entry) => entry.gameType === gameType);
  const level = getRecommendedLevelForGame(history, gameType);
  const latestVariantId = gameHistory[0]?.variantId;
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
