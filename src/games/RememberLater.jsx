import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  Circle,
  Clock,
  Flag,
  Heart,
  KeyRound,
  Leaf,
  Moon,
  Music,
  Play,
  Sparkles,
  Square,
  Triangle,
} from "lucide-react";
import { useLanguage } from "@/i18n";
import { BrainCoachActivityShell, BrainCoachLoadingState } from "@/components/brain/BrainCoachFlowShell";
import { gameData } from "./shared/gameDataApi";
import BrainGameCompletionDialog from "./shared/BrainGameCompletionDialog";
import { recordCognitiveSession } from "./shared/brainCoachSessions";
import {
  BRAIN_COACH_MAX_LEVEL,
  getBrainCoachLevelBand,
  getBrainCoachMilestoneLabel,
} from "./shared/brainCoachProgression";
import { normalizeGameLanguage } from "./shared/language";

const BRAND = {
  purple: "#6B21A8",
  gold: "#F59E0B",
  bg: "#FAF9F6",
  ink: "#2B2233",
  muted: "#5B4A61",
  border: "#E7D8F3",
  softPurple: "#F3E8FF",
  teal: "#0F766E",
  tealPale: "#DDF7F1",
};

const MAX_TIER = BRAIN_COACH_MAX_LEVEL;
const DEFAULT_ENTRY_TIER = 1;
const LOCAL_VARIANTS_PER_TIER = 20;
const COUNTDOWN_STEPS = [3, 2, 1];
const COUNTDOWN_STEP_MS = 700;
const LEVEL_LOSS_ACCURACY_PCT = 30;
const LEVEL_REQUIREMENTS = [
  { maxTier: 1, combinedAccuracyPct: 60, matchingAccuracyPct: 50 },
  { maxTier: 5, combinedAccuracyPct: 64, matchingAccuracyPct: 56 },
  { maxTier: 10, combinedAccuracyPct: 68, matchingAccuracyPct: 60 },
  { maxTier: 15, combinedAccuracyPct: 72, matchingAccuracyPct: 64 },
  { maxTier: MAX_TIER, combinedAccuracyPct: 76, matchingAccuracyPct: 68 },
];
const ROUND_TUNING = [
  { maxTier: 1, minIntervalMs: 1700, maxItems: 10, tailSeconds: 0 },
  { maxTier: 5, minIntervalMs: 1550, maxItems: 14, tailSeconds: 0 },
  { maxTier: 10, minIntervalMs: 1450, maxItems: 18, tailSeconds: 1 },
  { maxTier: 15, minIntervalMs: 1350, maxItems: Infinity, tailSeconds: 1 },
  { maxTier: MAX_TIER, minIntervalMs: 1200, maxItems: Infinity, tailSeconds: 0 },
];
const LOCAL_TUTORIAL_KEY = "rememberLater:tutorialSeen:v1";
const LOCAL_TUTORIAL_COOKIE = "remember_later_tutorial_seen_v1";
const LOCAL_STATE_KEY = "rememberLater:state:v1";
const LOCAL_SESSIONS_KEY = "rememberLater:sessions:v1";

const COLOR_HEX = {
  red: "#DC2626",
  blue: "#2563EB",
  yellow: "#F59E0B",
};

const COLOR_RULES = new Set(["color_red", "color_blue", "color_yellow"]);

const RESULT_MESSAGE_VARIANTS = {
  promoted: [
    {
      titleKey: "games.rememberLater.resultTitles.promoted0",
      title: "Level up. Nicely handled.",
      summaryKey: "games.rememberLater.resultSummaries.promoted0",
      summary: "You can start Level {level}, or replay this one while it feels fresh.",
      detailKey: "games.rememberLater.resultDetails.promoted0",
      detail: "You used both buttons at the right time.",
    },
    {
      titleKey: "games.rememberLater.resultTitles.promoted1",
      title: "That round opened the next level.",
      summaryKey: "games.rememberLater.resultSummaries.promoted1",
      summary: "{milestone}. The next round adds a little more to hold in mind.",
      detailKey: "games.rememberLater.resultDetails.promoted1",
      detail: "You kept the target and reminder active together.",
    },
    {
      titleKey: "games.rememberLater.resultTitles.promoted2",
      title: "Strong round. Next level ready.",
      summaryKey: "games.rememberLater.resultSummaries.promoted2",
      summary: "You earned the move into {band}. Take it at your pace.",
      detailKey: "games.rememberLater.resultDetails.promoted2",
      detail: "That was steady enough to move your practice forward.",
    },
  ],
  counted: [
    {
      titleKey: "games.rememberLater.resultTitles.counted0",
      title: "Good round. That one counts.",
      summaryKey: "games.rememberLater.resultSummaries.counted0",
      summary: "{count} to go before the next level.",
      detailKey: "games.rememberLater.resultDetails.counted0",
      detail: "You used both buttons at the right time.",
    },
    {
      titleKey: "games.rememberLater.resultTitles.counted1",
      title: "Nice work. You held the reminder in mind.",
      summaryKey: "games.rememberLater.resultSummaries.counted1",
      summary: "Keep that rhythm. {count} more before Level {level}.",
      detailKey: "games.rememberLater.resultDetails.counted1",
      detail: "You balanced the matching task with the reminder.",
    },
    {
      titleKey: "games.rememberLater.resultTitles.counted2",
      title: "Solid round. You caught the key moment.",
      summaryKey: "games.rememberLater.resultSummaries.counted2",
      summary: "That added progress. {count} more like this unlocks the next level.",
      detailKey: "games.rememberLater.resultDetails.counted2",
      detail: "Both parts landed cleanly enough to count.",
    },
  ],
  reminderOnly: [
    {
      titleKey: "games.rememberLater.resultTitles.reminderOnly0",
      title: "You caught the reminder.",
      summaryKey: "games.rememberLater.resultSummaries.reminderOnly0",
      summary: "Now strengthen the matching side of the round.",
      detailKey: "games.rememberLater.resultDetails.reminderOnly0",
      detail: "Nice work. Improve your matching accuracy next round so it counts toward Level {nextLevel}.",
    },
    {
      titleKey: "games.rememberLater.resultTitles.reminderOnly1",
      title: "Good recall. Now steady the target taps.",
      summaryKey: "games.rememberLater.resultSummaries.reminderOnly1",
      summary: "The future action landed. Next, aim for more target taps.",
      detailKey: "games.rememberLater.resultDetails.reminderOnly1",
      detail: "Nice work. Improve your matching accuracy next round so it counts toward Level {nextLevel}.",
    },
    {
      titleKey: "games.rememberLater.resultTitles.reminderOnly2",
      title: "The reminder stayed with you.",
      summaryKey: "games.rememberLater.resultSummaries.reminderOnly2",
      summary: "That memory moment was useful practice; the level waits for cleaner matching.",
      detailKey: "games.rememberLater.resultDetails.reminderOnly2",
      detail: "Nice work. Improve your matching accuracy next round so it counts toward Level {nextLevel}.",
    },
  ],
  missed: [
    {
      titleKey: "games.rememberLater.resultTitles.missed0",
      title: "Stay with it. The reminder slipped this time.",
      summaryKey: "games.rememberLater.resultSummaries.missed0",
      summary: "Use the next round to watch both the target and the reminder.",
      detailKey: "games.rememberLater.resultDetails.missed0",
      detail: "Stay here and strengthen this level. Use purple for targets and the reminder button for reminders.",
    },
    {
      titleKey: "games.rememberLater.resultTitles.missed1",
      title: "This one is worth another try.",
      summaryKey: "games.rememberLater.resultSummaries.missed1",
      summary: "No harsh reset here. Stay steady and try the same level again.",
      detailKey: "games.rememberLater.resultDetails.missed1",
      detail: "The level is still here for practice. Look for the cue, then touch the reminder button.",
    },
    {
      titleKey: "games.rememberLater.resultTitles.missed2",
      title: "A repeat round will help.",
      summaryKey: "games.rememberLater.resultSummaries.missed2",
      summary: "Take a breath, then run this level once more.",
      detailKey: "games.rememberLater.resultDetails.missed2",
      detail: "Nothing punitive happened. This is the spot to rebuild the reminder habit.",
    },
  ],
};

const CUE_ICON_COMPONENTS = {
  bell: Bell,
  moon: Moon,
  key: KeyRound,
  leaf: Leaf,
  heart: Heart,
  sparkle: Sparkles,
  flag: Flag,
  music: Music,
};

const LOCAL_ONGOING_RULES = [
  "shape_circle",
  "shape_square",
  "shape_triangle",
  "color_red",
  "color_blue",
  "color_yellow",
  "number_even",
  "number_odd",
];

const LOCAL_CUE_ICONS = ["bell", "moon", "key", "leaf", "heart", "sparkle", "flag", "music"];

const FALLBACK_ROUND = {
  id: null,
  round_type: "event_based",
  difficulty_tier: 1,
  round_duration_seconds: 24,
  ongoing_task_rule: "shape_circle",
  filler_stream: [
    { type: "shape", value: "circle", matches_rule: true },
    { type: "shape", value: "square", matches_rule: false },
    { type: "shape", value: "triangle", matches_rule: false },
    { type: "shape", value: "circle", matches_rule: true },
    { type: "icon", value: "cue", icon: "cue", matches_rule: false, cue: true },
    { type: "shape", value: "square", matches_rule: false },
    { type: "shape", value: "circle", matches_rule: true },
    { type: "shape", value: "triangle", matches_rule: false },
  ],
  filler_item_count: 8,
  filler_item_interval_ms: 1600,
  intentions: [{ type: "event", cue_icon: "bell", cue_position_index: 4, response_window_items: 3 }],
  is_local_practice: true,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function localDayBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function getTierProfile(profiles, tier) {
  return profiles.find((profile) => tier <= profile.maxTier) ?? profiles[profiles.length - 1];
}

export function getRememberLaterLevelRequirements(tier = 1) {
  return getTierProfile(LEVEL_REQUIREMENTS, clamp(Number(tier ?? 1), 1, MAX_TIER));
}

function getRememberLaterRoundTuning(tier = 1) {
  return getTierProfile(ROUND_TUNING, clamp(Number(tier ?? 1), 1, MAX_TIER));
}

function hashSeed(seedText) {
  let hash = 2166136261;
  String(seedText).split("").forEach((character) => {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return hash >>> 0;
}

function createLocalRng(seedText) {
  let state = hashSeed(seedText);
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    return (state >>> 0) / 0x100000000;
  };
}

function localIntegerBetween(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function localShuffle(random, items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function getLocalRoundSettings(tier) {
  const difficultyTier = clamp(Number(tier ?? DEFAULT_ENTRY_TIER), 1, MAX_TIER);
  const roundType = difficultyTier <= 4 ? "event_based" : difficultyTier <= 8 ? "time_based" : "dual";

  return {
    tier: difficultyTier,
    roundType,
    duration: Math.min(90, 24 + (difficultyTier * 4)),
    items: Math.min(54, 8 + (difficultyTier * 3)),
    interval: Math.max(1250, 1725 - (difficultyTier * 25)),
    responseWindow: difficultyTier <= 4 ? 3 : difficultyTier <= 14 ? 2 : 1,
    tolerance: difficultyTier <= 8 ? 8 : difficultyTier <= 14 ? 6 : 4,
  };
}

function localMiddleIndexRange(itemCount) {
  return {
    min: Math.max(1, Math.ceil(itemCount * 0.2)),
    max: Math.max(1, Math.floor(itemCount * 0.75)),
  };
}

function localMiddleDelayRange(durationSeconds) {
  return {
    min: Math.max(10, Math.ceil(durationSeconds * 0.45)),
    max: Math.max(12, Math.floor(durationSeconds * 0.7)),
  };
}

function localItemForRule(rule, shouldMatch, random) {
  const [kind, targetValue] = String(rule).split("_");
  const shapeValues = ["circle", "square", "triangle"];
  const colorValues = ["red", "blue", "yellow"];
  const evenValues = [2, 4, 6, 8];
  const oddValues = [1, 3, 5, 7, 9];

  if (kind === "shape") {
    const pool = shouldMatch ? [targetValue] : shapeValues.filter((value) => value !== targetValue);
    return {
      type: "shape",
      value: pool[Math.floor(random() * pool.length)],
      matches_rule: shouldMatch,
    };
  }

  if (kind === "color") {
    const pool = shouldMatch ? [targetValue] : colorValues.filter((value) => value !== targetValue);
    return {
      type: "color",
      value: pool[Math.floor(random() * pool.length)],
      matches_rule: shouldMatch,
    };
  }

  const pool = shouldMatch
    ? targetValue === "even" ? evenValues : oddValues
    : targetValue === "even" ? oddValues : evenValues;

  return {
    type: "number",
    value: pool[Math.floor(random() * pool.length)],
    matches_rule: shouldMatch,
  };
}

function buildLocalFillerStream(settings, rule, cuePositionIndex, random) {
  const indices = Array.from({ length: settings.items }, (_, index) => index);
  const tappableIndices = cuePositionIndex == null ? indices : indices.filter((index) => index !== cuePositionIndex);
  const matchCount = Math.max(2, Math.floor(settings.items * 0.4));
  const matches = new Set(localShuffle(random, tappableIndices).slice(0, matchCount));

  return indices.map((index) => {
    if (index === cuePositionIndex) {
      return {
        type: "icon",
        value: "cue",
        icon: "cue",
        matches_rule: false,
        cue: true,
      };
    }

    return localItemForRule(rule, matches.has(index), random);
  });
}

export function buildLocalRememberLaterRounds(tier, variantCount = LOCAL_VARIANTS_PER_TIER) {
  const settings = getLocalRoundSettings(tier);
  const rounds = [];

  for (let variant = 1; variant <= variantCount; variant += 1) {
    const random = createLocalRng(`remember-later-local:${settings.tier}:${variant}`);
    const ongoingRule = LOCAL_ONGOING_RULES[(settings.tier + variant - 2) % LOCAL_ONGOING_RULES.length];
    const cueIcon = LOCAL_CUE_ICONS[(variant - 1) % LOCAL_CUE_ICONS.length];
    const intentions = [];
    let cuePositionIndex = null;

    if (settings.roundType === "event_based" || settings.roundType === "dual") {
      const { min, max } = localMiddleIndexRange(settings.items);
      cuePositionIndex = localIntegerBetween(random, min, max);
      intentions.push({
        type: "event",
        cue_icon: cueIcon,
        cue_position_index: cuePositionIndex,
        response_window_items: settings.responseWindow,
      });
    }

    if (settings.roundType === "time_based" || settings.roundType === "dual") {
      const { min, max } = localMiddleDelayRange(settings.duration);
      intentions.push({
        type: "time",
        target_delay_seconds: localIntegerBetween(random, min, max),
        tolerance_seconds: settings.tolerance,
      });
    }

    rounds.push(normalizeRememberLaterRound({
      id: `local-remember-later-${settings.tier}-${variant}`,
      round_type: settings.roundType,
      difficulty_tier: settings.tier,
      round_duration_seconds: settings.duration,
      ongoing_task_rule: ongoingRule,
      filler_stream: buildLocalFillerStream(settings, ongoingRule, cuePositionIndex, random),
      filler_item_count: settings.items,
      filler_item_interval_ms: settings.interval,
      intentions,
      is_local_practice: true,
    }));
  }

  return rounds;
}

export function isRememberLaterCountedRound(result) {
  if (!result || result.abandoned || result.pm_hits < 1) return false;
  const requirements = getRememberLaterLevelRequirements(result.difficulty_tier);
  return (
    Number(result.combined_accuracy_pct ?? 0) >= requirements.combinedAccuracyPct
    && Number(result.ongoing_accuracy_pct ?? 0) >= requirements.matchingAccuracyPct
  );
}

function getLatestTimedIntentionSeconds(intentions) {
  return intentions.reduce((latestSeconds, intention) => {
    if (intention?.type !== "time") return latestSeconds;
    const targetSeconds = Number(intention.target_delay_seconds ?? 0);
    const toleranceSeconds = Number(intention.tolerance_seconds ?? 0);
    return Math.max(latestSeconds, targetSeconds + toleranceSeconds);
  }, 0);
}

function tuneFillerStreamForTier(fillerStream, intentions, tier, intervalMs) {
  const tuning = getRememberLaterRoundTuning(tier);
  if (!Number.isFinite(tuning.maxItems) || fillerStream.length <= tuning.maxItems) return fillerStream;

  const lastRequiredCueIndex = intentions.reduce((lastIndex, intention) => {
    if (intention?.type !== "event") return lastIndex;
    return Math.max(lastIndex, Number(intention.cue_position_index ?? 0));
  }, 0);
  const targetCount = Math.min(
    fillerStream.length,
    Math.max(
      tuning.maxItems,
      lastRequiredCueIndex + 1,
      Math.ceil((getLatestTimedIntentionSeconds(intentions) * 1000) / intervalMs) + 1,
    ),
  );

  return fillerStream.slice(0, targetCount);
}

export function getDefaultRememberLaterUserState(userId) {
  return {
    user_id: userId,
    current_tier: DEFAULT_ENTRY_TIER,
    sessions_at_tier: 0,
    consecutive_wins: 0,
    consecutive_losses: 0,
    total_sessions: 0,
    best_score: 0,
    has_seen_tutorial: false,
    last_played_at: null,
    streak_days: 0,
    last_streak_date: null,
    updated_at: new Date().toISOString(),
  };
}

export function normalizeRememberLaterRound(row) {
  const fillerStream = asArray(row?.filler_stream);
  const intentions = asArray(row?.intentions);
  const difficultyTier = clamp(Number(row?.difficulty_tier ?? 1), 1, MAX_TIER);
  const tuning = getRememberLaterRoundTuning(difficultyTier);
  const intervalMs = Math.max(Number(row?.filler_item_interval_ms ?? 1600), tuning.minIntervalMs);
  const tunedFillerStream = tuneFillerStreamForTier(fillerStream, intentions, difficultyTier, intervalMs);
  const streamDurationSeconds = Math.ceil((tunedFillerStream.length * intervalMs) / 1000);
  const timedIntentionSeconds = getLatestTimedIntentionSeconds(intentions);
  const durationSeconds = Math.max(
    1,
    streamDurationSeconds + tuning.tailSeconds,
    timedIntentionSeconds > 0 ? Math.ceil(timedIntentionSeconds + tuning.tailSeconds) : 0,
  );

  return {
    ...row,
    round_type: row?.round_type ?? "event_based",
    difficulty_tier: difficultyTier,
    round_duration_seconds: durationSeconds,
    ongoing_task_rule: row?.ongoing_task_rule ?? "shape_circle",
    filler_stream: tunedFillerStream,
    filler_item_count: tunedFillerStream.length,
    filler_item_interval_ms: intervalMs,
    intentions,
  };
}

function normalizeRememberLaterUserState(state) {
  const normalized = state ?? getDefaultRememberLaterUserState("");
  const currentTier = clamp(Number(normalized.current_tier ?? DEFAULT_ENTRY_TIER), 1, MAX_TIER);

  return {
    ...normalized,
    current_tier: currentTier,
  };
}

export function shouldShowRememberLaterIntro(state, round) {
  const stateTier = Number(state?.current_tier ?? DEFAULT_ENTRY_TIER);
  const roundTier = Number(round?.difficulty_tier ?? stateTier);
  const effectiveTier = clamp(Number.isFinite(roundTier) ? roundTier : stateTier, 1, MAX_TIER);

  return !state?.has_seen_tutorial && effectiveTier <= 1;
}

export function pickRememberLaterRound(rounds, todaySessions = [], historySessions = [], random = Math.random) {
  const normalizedRounds = rounds.map(normalizeRememberLaterRound).filter((round) => round.filler_stream.length > 0);
  const usedToday = new Set(todaySessions.map((session) => session.round_id).filter(Boolean));
  const unusedToday = normalizedRounds.filter((round) => !usedToday.has(round.id));

  if (unusedToday.length > 0) {
    return unusedToday[Math.floor(random() * unusedToday.length)];
  }

  const lastPlayed = new Map();
  historySessions.forEach((session) => {
    if (!session.round_id || !session.played_at) return;
    const previous = lastPlayed.get(session.round_id);
    if (!previous || session.played_at > previous) {
      lastPlayed.set(session.round_id, session.played_at);
    }
  });

  return [...normalizedRounds].sort((a, b) => {
    const aPlayed = lastPlayed.get(a.id) ?? "";
    const bPlayed = lastPlayed.get(b.id) ?? "";
    return aPlayed.localeCompare(bPlayed);
  })[0] ?? null;
}

export function computeRememberLaterScore(input) {
  const round = normalizeRememberLaterRound(input.round ?? FALLBACK_ROUND);
  const seenItemCount = clamp(Number(input.seenItemCount ?? round.filler_stream.length), 0, round.filler_stream.length);
  const seenItems = round.filler_stream.slice(0, seenItemCount);
  const tapped = new Set(input.ongoingTappedIndices ?? []);
  const matchingIndices = seenItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => Boolean(item.matches_rule))
    .map(({ index }) => index);
  const ongoingTotal = matchingIndices.length;
  const ongoingCorrect = matchingIndices.filter((index) => tapped.has(index)).length;
  const ongoingAccuracyPct = ongoingTotal > 0 ? (ongoingCorrect / ongoingTotal) * 100 : 0;
  const intentionResults = (input.intentionStates ?? round.intentions.map((intention) => ({ intention, hit: false }))).map((state) => ({
    type: state.intention?.type ?? state.type,
    cue_icon: state.intention?.cue_icon,
    hit: Boolean(state.hit),
    response_delay_items: state.response_delay_items ?? null,
    timing_error_seconds: state.timing_error_seconds ?? null,
  }));
  const pmTotal = Math.max(1, round.intentions.length);
  const pmHits = intentionResults.filter((entry) => entry.hit).length;
  const pmAccuracyPct = (pmHits / pmTotal) * 100;
  const score = Math.round((ongoingAccuracyPct * 4) + (pmAccuracyPct * 6));
  const timingErrors = intentionResults
    .map((entry) => entry.timing_error_seconds)
    .filter((value) => Number.isFinite(value));

  return {
    round_id: round.id ?? null,
    difficulty_tier: round.difficulty_tier,
    round_type: round.round_type,
    ongoing_correct: ongoingCorrect,
    ongoing_total: ongoingTotal,
    ongoing_false_alarms: Number(input.ongoingFalseAlarms ?? 0),
    ongoing_accuracy_pct: Number(ongoingAccuracyPct.toFixed(2)),
    intention_results: intentionResults,
    pm_hits: pmHits,
    pm_total: pmTotal,
    pm_false_alarms: Number(input.pmFalseAlarms ?? 0),
    pm_accuracy_pct: Number(pmAccuracyPct.toFixed(2)),
    avg_timing_error_seconds: timingErrors.length
      ? Number((timingErrors.reduce((total, value) => total + Math.abs(value), 0) / timingErrors.length).toFixed(2))
      : null,
    combined_accuracy_pct: Number(((ongoingAccuracyPct * 0.4) + (pmAccuracyPct * 0.6)).toFixed(2)),
    score,
    completed: !input.abandoned,
    abandoned: Boolean(input.abandoned),
    duration_seconds: Number(input.durationSeconds ?? 0),
  };
}

export function getNextRememberLaterStateAfterSession(previousState, result, now = new Date()) {
  if (result.abandoned) return previousState;

  const previous = previousState ?? getDefaultRememberLaterUserState(result.user_id ?? "");
  const today = todayKey(now);
  const yesterday = todayKey(addDays(now, -1));
  const isWin = isRememberLaterCountedRound(result);
  const isLoss = result.combined_accuracy_pct < LEVEL_LOSS_ACCURACY_PCT;
  let consecutiveWins = isWin ? Number(previous.consecutive_wins ?? 0) + 1 : 0;
  let consecutiveLosses = isLoss ? Number(previous.consecutive_losses ?? 0) + 1 : 0;
  let currentTier = clamp(Number(previous.current_tier ?? 1), 1, MAX_TIER);
  let sessionsAtTier = Number(previous.sessions_at_tier ?? 0) + 1;

  if (consecutiveWins >= 3) {
    currentTier = clamp(currentTier + 1, 1, MAX_TIER);
    sessionsAtTier = 0;
    consecutiveWins = 0;
    consecutiveLosses = 0;
  } else if (consecutiveLosses >= 3) {
    currentTier = clamp(currentTier - 1, 1, MAX_TIER);
    sessionsAtTier = 0;
    consecutiveWins = 0;
    consecutiveLosses = 0;
  }

  const lastStreakDate = previous.last_streak_date;
  const streakDays =
    lastStreakDate === today
      ? Number(previous.streak_days ?? 1)
      : lastStreakDate === yesterday
        ? Number(previous.streak_days ?? 0) + 1
        : 1;

  return {
    ...previous,
    current_tier: currentTier,
    sessions_at_tier: sessionsAtTier,
    consecutive_wins: consecutiveWins,
    consecutive_losses: consecutiveLosses,
    total_sessions: Number(previous.total_sessions ?? 0) + 1,
    best_score: Math.max(Number(previous.best_score ?? 0), Number(result.score ?? 0)),
    last_played_at: now.toISOString(),
    streak_days: streakDays,
    last_streak_date: today,
    updated_at: now.toISOString(),
  };
}

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readTutorialCookieSeen() {
  if (typeof document === "undefined" || typeof document.cookie !== "string") return false;
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .includes(`${LOCAL_TUTORIAL_COOKIE}=true`);
}

function writeTutorialCookieSeen() {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${LOCAL_TUTORIAL_COOKIE}=true; Max-Age=31536000; Path=/; SameSite=Lax`;
  } catch {
    // Cookie persistence is a fallback; gameplay should continue if it is blocked.
  }
}

function readLocalTutorialSeen() {
  const storage = getLocalStorage();
  return storage?.getItem(LOCAL_TUTORIAL_KEY) === "true" || readTutorialCookieSeen();
}

function writeLocalTutorialSeen() {
  const storage = getLocalStorage();
  try {
    storage?.setItem(LOCAL_TUTORIAL_KEY, "true");
  } catch {
    // Local persistence is a fallback; gameplay should continue if it is blocked.
  }
  writeTutorialCookieSeen();
}

function readLocalJson(key, fallback) {
  const storage = getLocalStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Local persistence is a fallback; gameplay should continue if it is blocked.
  }
}

function readLocalRememberLaterState() {
  const stored = readLocalJson(LOCAL_STATE_KEY, null);
  const fallback = getDefaultRememberLaterUserState("");
  const normalized = normalizeRememberLaterUserState({
    ...fallback,
    ...(stored && typeof stored === "object" ? stored : {}),
    user_id: "",
    has_seen_tutorial: Boolean(stored?.has_seen_tutorial || readLocalTutorialSeen()),
  });

  return normalized;
}

function writeLocalRememberLaterState(state) {
  writeLocalJson(LOCAL_STATE_KEY, {
    ...normalizeRememberLaterUserState(state),
    user_id: "",
  });
}

function readLocalRememberLaterSessions() {
  const stored = readLocalJson(LOCAL_SESSIONS_KEY, []);
  if (!Array.isArray(stored)) return [];

  return stored.filter((session) => session && typeof session === "object" && typeof session.played_at === "string");
}

function writeLocalRememberLaterSession(result, playedAt = new Date()) {
  if (!result?.round_id) return;
  const nextSession = {
    round_id: result.round_id,
    difficulty_tier: result.difficulty_tier,
    played_at: playedAt.toISOString(),
  };
  const nextSessions = [...readLocalRememberLaterSessions(), nextSession].slice(-500);
  writeLocalJson(LOCAL_SESSIONS_KEY, nextSessions);
}

function getTodayLocalRememberLaterSessions(date = new Date()) {
  const { start, end } = localDayBounds(date);
  return readLocalRememberLaterSessions().filter((session) => {
    const playedAt = new Date(session.played_at);
    return playedAt >= start && playedAt < end;
  });
}

function CueIcon({ icon = "bell", size = 72, className = "" }) {
  const Icon = CUE_ICON_COMPONENTS[icon] ?? Bell;
  return <Icon aria-hidden="true" size={size} strokeWidth={2.5} className={className} />;
}

function readableKey(value) {
  return String(value ?? "").replaceAll("_", " ");
}

function ruleLabel(rule, t) {
  return t(`games.rememberLater.rules.${rule}`, readableKey(rule));
}

function isColorRule(rule) {
  return COLOR_RULES.has(rule);
}

function cueLabel(icon, t) {
  return t(`games.rememberLater.cueLabels.${icon}`, readableKey(icon));
}

function sentenceCase(value) {
  const text = String(value ?? "").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function getResultMessageOutcome({ promotedThisRound, resultCountsForLevel, resultToneHit }) {
  if (promotedThisRound) return "promoted";
  if (resultCountsForLevel) return "counted";
  if (resultToneHit) return "reminderOnly";
  return "missed";
}

function pickResultMessageVariant(result, outcome, progressWins) {
  const variants = RESULT_MESSAGE_VARIANTS[outcome] ?? RESULT_MESSAGE_VARIANTS.missed;
  const seed = [
    result?.round_id ?? "local-round",
    result?.difficulty_tier ?? DEFAULT_ENTRY_TIER,
    result?.score ?? 0,
    result?.pm_hits ?? 0,
    result?.ongoing_correct ?? 0,
    result?.ongoing_total ?? 0,
    progressWins ?? 0,
    outcome,
  ].join(":");

  return variants[hashSeed(seed) % variants.length] ?? variants[0];
}

export function getRememberLaterResultMessage({
  t,
  result,
  resultCountsForLevel,
  resultToneHit,
  promotedThisRound,
  progressWins,
  progressWinsNeeded,
  nextTier,
  nextTierBand,
  completedMilestone,
}) {
  if (!result) return { title: "", summary: "", detail: "" };

  const outcome = getResultMessageOutcome({ promotedThisRound, resultCountsForLevel, resultToneHit });
  const variant = pickResultMessageVariant(result, outcome, progressWins);
  const params = {
    band: nextTierBand.label,
    count: progressWinsNeeded,
    level: nextTier,
    nextLevel: Math.min(MAX_TIER, nextTier + 1),
    milestone: completedMilestone ?? t("games.rememberLater.verdictLevelUp", "Level up"),
  };
  const detail = outcome === "reminderOnly" && nextTier >= MAX_TIER
    ? t(
      "games.rememberLater.resultDetails.reminderOnlyMax",
      "Nice work. Improve your matching accuracy next round to complete a balanced round at the highest level.",
      params,
    )
    : t(variant.detailKey, variant.detail, params);

  return {
    title: t(variant.titleKey, variant.title, params),
    summary: t(variant.summaryKey, variant.summary, params),
    detail,
  };
}

function RuleVisual({ rule, size = 52 }) {
  if (rule === "shape_square") return <Square size={size} strokeWidth={2.5} />;
  if (rule === "shape_triangle") return <Triangle size={size} strokeWidth={2.5} />;
  if (isColorRule(rule)) {
    const color = COLOR_HEX[rule.replace("color_", "")] ?? BRAND.purple;
    return (
      <span
        aria-hidden="true"
        className="block rounded-[10px] border-[3px] border-white shadow-[0_6px_14px_rgba(43,34,51,0.12)]"
        style={{
          width: size,
          height: Math.max(18, Math.round(size * 0.72)),
          background: color,
        }}
      />
    );
  }
  if (rule === "number_even" || rule === "number_odd") {
    return <span className="font-display text-[42px] leading-none">{rule === "number_even" ? "2" : "3"}</span>;
  }
  return <Circle size={size} strokeWidth={2.5} />;
}

function Stimulus({ item, cueIcon }) {
  if (!item) return null;
  if (item.cue) {
    return (
      <div className="flex h-[132px] w-[132px] items-center justify-center rounded-[36px] bg-[#FFF7ED] text-[#B45309] shadow-vyva-card">
        <CueIcon icon={cueIcon} size={76} />
      </div>
    );
  }

  if (item.type === "number") {
    return (
      <div className="flex h-[132px] w-[132px] items-center justify-center rounded-[34px] bg-[#F8FAFC] text-[64px] font-black text-[#2B2233] shadow-vyva-card">
        {item.value}
      </div>
    );
  }

  if (item.type === "color") {
    return (
      <div
        className="h-[132px] w-[132px] rounded-[34px] border-[10px] border-white shadow-vyva-card"
        style={{ background: COLOR_HEX[item.value] ?? BRAND.purple }}
      />
    );
  }

  const shapeClass = "h-[116px] w-[116px] text-[#6B21A8]";
  if (item.value === "square") return <Square aria-hidden="true" className={shapeClass} strokeWidth={2.2} />;
  if (item.value === "triangle") return <Triangle aria-hidden="true" className={shapeClass} strokeWidth={2.2} />;
  return <Circle aria-hidden="true" className={shapeClass} strokeWidth={2.2} />;
}

function useLatestRef(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export default function RememberLater({
  userId,
  onExit,
  assessmentPractice = null,
  onAssessmentPracticeComplete,
  onAssessmentPracticeReturn,
  countdownStepMs = COUNTDOWN_STEP_MS,
}) {
  const { language, t } = useLanguage();
  const gameLanguage = normalizeGameLanguage(language);
  const [screen, setScreen] = useState("loading");
  const [round, setRound] = useState(null);
  const [userState, setUserState] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionResult, setSessionResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [autoStartAfterLoad, setAutoStartAfterLoad] = useState(false);
  const [hideIntroAfterStart, setHideIntroAfterStart] = useState(true);
  const [countdownValue, setCountdownValue] = useState(COUNTDOWN_STEPS[0]);
  const roundRef = useLatestRef(round);
  const screenRef = useLatestRef(screen);
  const userStateRef = useLatestRef(userState);
  const intervalRef = useRef(null);
  const durationTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const roundStartRef = useRef(null);
  const streamDoneRef = useRef(false);
  const durationDoneRef = useRef(false);
  const finalizingRef = useRef(false);
  const sessionSavedRef = useRef(false);
  const ongoingTappedRef = useRef(new Set());
  const ongoingFalseAlarmsRef = useRef(0);
  const pmFalseAlarmsRef = useRef(0);
  const intentionStatesRef = useRef([]);
  const seenItemCountRef = useRef(0);

  const normalizedRound = useMemo(() => round ? normalizeRememberLaterRound(round) : null, [round]);
  const currentItem = normalizedRound?.filler_stream[currentIndex] ?? null;
  const firstCueIcon = normalizedRound?.intentions.find((intention) => intention.type === "event")?.cue_icon ?? "bell";

  const stopTimers = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (durationTimerRef.current) window.clearTimeout(durationTimerRef.current);
    if (countdownTimerRef.current) window.clearTimeout(countdownTimerRef.current);
    intervalRef.current = null;
    durationTimerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const loadUserState = useCallback(async () => {
    if (!userId) {
      return readLocalRememberLaterState();
    }

    const { data, error } = await gameData
      .table("remember_later_user_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      return normalizeRememberLaterUserState({
        ...data,
        has_seen_tutorial: Boolean(data.has_seen_tutorial || readLocalTutorialSeen()),
      });
    }
    if (error) {
      console.warn("Remember Later could not load progress state.", error);
    }

    const fallback = {
      ...getDefaultRememberLaterUserState(userId),
      has_seen_tutorial: readLocalTutorialSeen(),
    };
    const saved = await gameData
      .table("remember_later_user_state")
      .upsert(fallback, { onConflict: "user_id" })
      .select("*")
      .single();

    if (saved.data) {
      return normalizeRememberLaterUserState({
        ...saved.data,
        has_seen_tutorial: Boolean(saved.data.has_seen_tutorial || readLocalTutorialSeen()),
      });
    }
    if (saved.error) {
      console.warn("Remember Later could not create progress state.", saved.error);
    }
    return normalizeRememberLaterUserState(fallback);
  }, [userId]);

  const loadRound = useCallback(async (tier) => {
    if (!userId) {
      const localRounds = buildLocalRememberLaterRounds(tier);
      const todaySessions = getTodayLocalRememberLaterSessions();
      return pickRememberLaterRound(localRounds, todaySessions, readLocalRememberLaterSessions(), () => 0) ?? normalizeRememberLaterRound(FALLBACK_ROUND);
    }

    const { start, end } = localDayBounds();
    const [todaySessionsResult, roundsResult] = await Promise.all([
      gameData
        .table("remember_later_sessions")
        .select("round_id")
        .eq("user_id", userId)
        .gte("played_at", start.toISOString())
        .lt("played_at", end.toISOString()),
      gameData
        .table("remember_later_rounds")
        .select("*")
        .eq("difficulty_tier", tier)
        .eq("is_active", true),
    ]);

    if (roundsResult.error) throw roundsResult.error;
    if (todaySessionsResult.error) {
      console.warn("Remember Later could not load today's rounds.", todaySessionsResult.error);
    }

    const freshRound = pickRememberLaterRound(roundsResult.data ?? [], todaySessionsResult.data ?? []);
    if (freshRound && !(todaySessionsResult.data ?? []).some((session) => session.round_id === freshRound.id)) {
      return freshRound;
    }

    const historyResult = await gameData
      .table("remember_later_sessions")
      .select("round_id, played_at")
      .eq("user_id", userId)
      .not("round_id", "is", null)
      .order("played_at", { ascending: false })
      .limit(500);

    if (historyResult.error) {
      console.warn("Remember Later could not load round history.", historyResult.error);
    }

    return pickRememberLaterRound(roundsResult.data ?? [], todaySessionsResult.data ?? [], historyResult.data ?? []) ?? normalizeRememberLaterRound(FALLBACK_ROUND);
  }, [userId]);

  const loadGame = useCallback(async () => {
    setScreen("loading");
    setLoadError("");
    setAutoStartAfterLoad(false);
    stopTimers();
    finalizingRef.current = false;
    sessionSavedRef.current = false;
    try {
      const state = await loadUserState();
      const nextRound = await loadRound(Number(state.current_tier ?? 1));
      const shouldShowIntro = shouldShowRememberLaterIntro(state, nextRound);
      setUserState(state);
      setRound(nextRound);
      setCurrentIndex(0);
      setSessionResult(null);
      setAutoStartAfterLoad(!shouldShowIntro);
      setScreen("intro");
    } catch (error) {
      console.warn("Remember Later could not load.", error);
      const fallbackState = userId
        ? normalizeRememberLaterUserState({
          ...getDefaultRememberLaterUserState(userId),
          has_seen_tutorial: readLocalTutorialSeen(),
        })
        : readLocalRememberLaterState();
      setUserState(fallbackState);
      setRound(normalizeRememberLaterRound(FALLBACK_ROUND));
      setLoadError(t("games.rememberLater.practiceFallback", "We will use a short practice round."));
      setAutoStartAfterLoad(!shouldShowRememberLaterIntro(fallbackState, FALLBACK_ROUND));
      setScreen("intro");
    }
  }, [loadRound, loadUserState, stopTimers, t, userId]);

  useEffect(() => {
    void loadGame();
    return () => {
      stopTimers();
    };
  }, [loadGame, stopTimers]);

  const saveSession = useCallback(async (result) => {
    if (sessionSavedRef.current) return null;
    sessionSavedRef.current = true;

    const payload = {
      user_id: userId,
      round_id: result.round_id,
      difficulty_tier: result.difficulty_tier,
      round_type: result.round_type,
      ongoing_correct: result.ongoing_correct,
      ongoing_total: result.ongoing_total,
      ongoing_false_alarms: result.ongoing_false_alarms,
      ongoing_accuracy_pct: result.ongoing_accuracy_pct,
      intention_results: result.intention_results,
      pm_hits: result.pm_hits,
      pm_total: result.pm_total,
      pm_false_alarms: result.pm_false_alarms,
      pm_accuracy_pct: result.pm_accuracy_pct,
      avg_timing_error_seconds: result.avg_timing_error_seconds,
      score: result.score,
      completed: result.completed,
      abandoned: result.abandoned,
      duration_seconds: result.duration_seconds,
    };

    if (!userId) {
      writeLocalRememberLaterSession(result);
      return null;
    }

    const saved = await gameData
      .table("remember_later_sessions")
      .insert(payload)
      .select("*")
      .single();

    if (saved.error) {
      console.warn("Remember Later could not save the session.", saved.error);
      sessionSavedRef.current = false;
    }

    await recordCognitiveSession({
      userId,
      activityType: "remember_later",
      domain: "prospective_memory",
      secondaryDomain: "attention",
      difficulty: result.difficulty_tier,
      difficultyScale: "tier",
      completed: result.completed,
      abandoned: result.abandoned,
      score: result.score,
      accuracyPct: result.pm_accuracy_pct,
      speedPct: result.ongoing_accuracy_pct,
      durationSeconds: result.duration_seconds,
      language: gameLanguage,
      source: "remember_later",
      sourceTable: "remember_later_sessions",
      sourceSessionId: saved.data?.id ?? null,
      metadata: {
        roundId: result.round_id,
        roundType: result.round_type,
        pmHits: result.pm_hits,
        pmTotal: result.pm_total,
        pmFalseAlarms: result.pm_false_alarms,
        ongoingFalseAlarms: result.ongoing_false_alarms,
        avgTimingErrorSeconds: result.avg_timing_error_seconds,
        intentionResults: result.intention_results,
      },
    });

    return saved.data ?? null;
  }, [gameLanguage, userId]);

  const updateUserState = useCallback(async (result) => {
    if (!userId) {
      const next = getNextRememberLaterStateAfterSession(userStateRef.current, result);
      setUserState(next);
      writeLocalRememberLaterState(next);
      return next;
    }

    const latestState = await loadUserState().catch(() => userStateRef.current);
    const next = getNextRememberLaterStateAfterSession(latestState, result);
    setUserState(next);

    const saved = await gameData
      .table("remember_later_user_state")
      .upsert(next, { onConflict: "user_id" })
      .select("*")
      .single();

    if (saved.data) {
      const savedState = normalizeRememberLaterUserState(saved.data);
      setUserState(savedState);
      return savedState;
    }

    if (saved.error) {
      console.warn("Remember Later could not save progress state.", saved.error);
    }

    return next;
  }, [loadUserState, userId, userStateRef]);

  const finishRound = useCallback(async (abandoned = false) => {
    if (finalizingRef.current) return null;
    finalizingRef.current = true;
    stopTimers();
    setSaving(true);

    const currentRound = roundRef.current ? normalizeRememberLaterRound(roundRef.current) : normalizeRememberLaterRound(FALLBACK_ROUND);
    const startedAt = roundStartRef.current ?? Date.now();
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const result = computeRememberLaterScore({
      round: currentRound,
      ongoingTappedIndices: [...ongoingTappedRef.current],
      ongoingFalseAlarms: ongoingFalseAlarmsRef.current,
      intentionStates: intentionStatesRef.current,
      pmFalseAlarms: pmFalseAlarmsRef.current,
      seenItemCount: abandoned ? Math.max(1, seenItemCountRef.current) : currentRound.filler_stream.length,
      durationSeconds,
      abandoned,
    });

    await saveSession(result);
    if (!abandoned) await updateUserState(result);
    if (!abandoned) {
      onAssessmentPracticeComplete?.({
        score: result.score,
        accuracyPct: result.pm_accuracy_pct,
        practiceTitle: assessmentPractice?.practiceTitle,
      });
    }
    setSessionResult(result);
    setSaving(false);
    if (!abandoned) setScreen("result");
    return result;
  }, [assessmentPractice, onAssessmentPracticeComplete, roundRef, saveSession, stopTimers, updateUserState]);

  const finishRoundRef = useLatestRef(finishRound);

  useEffect(() => {
    return () => {
      if (screenRef.current === "playing" && !finalizingRef.current) {
        void finishRoundRef.current(true);
      }
    };
  }, [finishRoundRef, screenRef]);

  const maybeFinishRound = useCallback(() => {
    if (streamDoneRef.current && durationDoneRef.current) {
      void finishRound(false);
    }
  }, [finishRound]);

  const startRound = useCallback(() => {
    const currentRound = normalizedRound ?? normalizeRememberLaterRound(FALLBACK_ROUND);
    stopTimers();
    setAutoStartAfterLoad(false);
    setCurrentIndex(0);
    setSessionResult(null);
    setScreen("playing");
    finalizingRef.current = false;
    sessionSavedRef.current = false;
    streamDoneRef.current = currentRound.filler_stream.length <= 1;
    durationDoneRef.current = false;
    ongoingTappedRef.current = new Set();
    ongoingFalseAlarmsRef.current = 0;
    pmFalseAlarmsRef.current = 0;
    seenItemCountRef.current = 1;
    roundStartRef.current = Date.now();
    intentionStatesRef.current = currentRound.intentions.map((intention) => ({ intention, hit: false }));

    intervalRef.current = window.setInterval(() => {
      setCurrentIndex((previous) => {
        const next = previous + 1;
        if (next >= currentRound.filler_stream.length) {
          streamDoneRef.current = true;
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          intervalRef.current = null;
          maybeFinishRound();
          return previous;
        }
        seenItemCountRef.current = next + 1;
        return next;
      });
    }, currentRound.filler_item_interval_ms);

    durationTimerRef.current = window.setTimeout(() => {
      durationDoneRef.current = true;
      maybeFinishRound();
    }, currentRound.round_duration_seconds * 1000);
  }, [maybeFinishRound, normalizedRound, stopTimers]);

  const beginCountdown = useCallback(() => {
    stopTimers();
    setAutoStartAfterLoad(false);
    setCurrentIndex(0);
    setSessionResult(null);
    setCountdownValue(COUNTDOWN_STEPS[0]);
    setScreen("countdown");

    const delayMs = Math.max(0, Number(countdownStepMs) || 0);
    let stepIndex = 0;
    const tick = () => {
      stepIndex += 1;
      if (stepIndex >= COUNTDOWN_STEPS.length) {
        countdownTimerRef.current = null;
        startRound();
        return;
      }
      setCountdownValue(COUNTDOWN_STEPS[stepIndex]);
      countdownTimerRef.current = window.setTimeout(tick, delayMs);
    };

    countdownTimerRef.current = window.setTimeout(tick, delayMs);
  }, [countdownStepMs, startRound, stopTimers]);

  useEffect(() => {
    if (screen !== "intro" || !autoStartAfterLoad || !normalizedRound) return undefined;

    const timeoutId = window.setTimeout(() => {
      beginCountdown();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [autoStartAfterLoad, beginCountdown, normalizedRound, screen]);

  const markTutorialSeen = useCallback(async () => {
    writeLocalTutorialSeen();
    const next = {
      ...(userStateRef.current ?? getDefaultRememberLaterUserState(userId ?? "")),
      has_seen_tutorial: true,
      updated_at: new Date().toISOString(),
    };
    setUserState(next);

    if (!userId) {
      writeLocalRememberLaterState(next);
      return;
    }

    try {
      const saved = await gameData
        .table("remember_later_user_state")
        .upsert(next, { onConflict: "user_id" })
        .select("*")
        .single();

      if (saved.data) {
        setUserState(normalizeRememberLaterUserState({
          ...saved.data,
          has_seen_tutorial: true,
        }));
      }
      if (saved.error) {
        console.warn("Remember Later could not save tutorial preference.", saved.error);
      }
    } catch (error) {
      console.warn("Remember Later could not save tutorial preference.", error);
    }
  }, [userId, userStateRef]);

  const beginAfterIntro = useCallback(() => {
    if (hideIntroAfterStart && !userState?.has_seen_tutorial) {
      void markTutorialSeen();
    }
    beginCountdown();
  }, [beginCountdown, hideIntroAfterStart, markTutorialSeen, userState?.has_seen_tutorial]);

  const handleOngoingTap = useCallback(() => {
    if (screenRef.current !== "playing" || !roundRef.current) return;
    const currentRound = normalizeRememberLaterRound(roundRef.current);
    const item = currentRound.filler_stream[currentIndex];
    if (!item) return;

    if (item.matches_rule) {
      ongoingTappedRef.current.add(currentIndex);
    } else {
      ongoingFalseAlarmsRef.current += 1;
    }
  }, [currentIndex, roundRef, screenRef]);

  const handleIntentionTap = useCallback(() => {
    if (screenRef.current !== "playing" || !roundRef.current || !roundStartRef.current) return;
    const elapsedSeconds = (Date.now() - roundStartRef.current) / 1000;
    let anyHit = false;

    intentionStatesRef.current = intentionStatesRef.current.map((state) => {
      if (state.hit) return state;
      const intention = state.intention;
      if (intention.type === "event") {
        const start = Number(intention.cue_position_index);
        const end = start + Number(intention.response_window_items ?? 0);
        if (currentIndex >= start && currentIndex <= end) {
          anyHit = true;
          return {
            ...state,
            hit: true,
            response_delay_items: Math.max(0, currentIndex - start),
          };
        }
      }

      if (intention.type === "time") {
        const target = Number(intention.target_delay_seconds);
        const tolerance = Number(intention.tolerance_seconds);
        if (elapsedSeconds >= target - tolerance && elapsedSeconds <= target + tolerance) {
          anyHit = true;
          return {
            ...state,
            hit: true,
            timing_error_seconds: Number((elapsedSeconds - target).toFixed(2)),
          };
        }
      }

      return state;
    });

    if (!anyHit) pmFalseAlarmsRef.current += 1;
  }, [currentIndex, roundRef, screenRef]);

  const exitGame = useCallback(async () => {
    if (screenRef.current === "playing") {
      await finishRound(true);
    } else {
      stopTimers();
    }
    onExit?.();
  }, [finishRound, onExit, screenRef, stopTimers]);

  const resultToneHit = (sessionResult?.pm_hits ?? 0) > 0;
  const nextTier = userState?.current_tier ?? normalizedRound?.difficulty_tier ?? 1;
  const isAtMaxTier = nextTier >= MAX_TIER;
  const nextTierBand = getBrainCoachLevelBand(nextTier);
  const currentTierBand = normalizedRound ? getBrainCoachLevelBand(normalizedRound.difficulty_tier) : nextTierBand;
  const progressWins = userState?.consecutive_wins ?? 0;
  const ongoingRuleLabel = normalizedRound ? ruleLabel(normalizedRound.ongoing_task_rule, t) : "";
  const ongoingRuleIsColor = normalizedRound ? isColorRule(normalizedRound.ongoing_task_rule) : false;
  const matchButtonLabel = normalizedRound
    ? ongoingRuleIsColor
      ? t("games.rememberLater.matchColorButtonLabel", "Tap when the color is {color}", { color: ongoingRuleLabel })
      : t("games.rememberLater.matchButtonLabel", "Tap when you see {rule}", { rule: ongoingRuleLabel })
    : t("games.rememberLater.tapButtonShort", "Tap when it matches");
  const firstIntention = normalizedRound?.intentions[0] ?? null;
  const firstCueLabel = cueLabel(firstCueIcon, t);
  const firstCuePromptLabel = sentenceCase(firstCueLabel);
  const matchActionLabel = normalizedRound
    ? ongoingRuleIsColor
      ? t("games.rememberLater.matchColorActionLabel", "Tap when the color is {color}", { color: ongoingRuleLabel })
      : t("games.rememberLater.matchActionLabel", "Tap when you see {rule}", { rule: ongoingRuleLabel })
    : t("games.rememberLater.matchActionFallback", "Target? Tap purple");
  const targetCueLabel = normalizedRound
    ? ongoingRuleIsColor
      ? t("games.rememberLater.targetColorCueLabel", "Color is {color}", { color: ongoingRuleLabel })
      : t("games.rememberLater.targetCueLabel", "See {rule}", { rule: ongoingRuleLabel })
    : t("games.rememberLater.targetCueFallback", "See the target");
  const starActionLabel =
    firstIntention?.type === "event"
      ? t("games.rememberLater.starActionEvent", "{cue}? Touch this button", { cue: firstCuePromptLabel })
      : t("games.rememberLater.starActionTime", "Later? Touch this button");
  const reminderCueLabel =
    firstIntention?.type === "event"
      ? t("games.rememberLater.reminderCueLabel", "See the {cue}", { cue: firstCueLabel })
      : t("games.rememberLater.reminderCueTimeLabel", "Later in the round");
  const progressWinsNeeded = Math.max(0, 3 - progressWins);
  const resultCountsForLevel = isRememberLaterCountedRound(sessionResult);
  const promotedThisRound = Boolean(sessionResult && resultCountsForLevel && nextTier > sessionResult.difficulty_tier);
  const completedMilestone = sessionResult ? getBrainCoachMilestoneLabel(sessionResult.difficulty_tier) : null;
  const resultVerdict = sessionResult
    ? promotedThisRound
      ? completedMilestone ?? t("games.rememberLater.verdictLevelUp", "Level up")
      : resultCountsForLevel
        ? t("games.rememberLater.verdictCounted", "Good round")
        : resultToneHit
          ? t("games.rememberLater.verdictMemoryCredit", "You remembered the reminder")
          : t("games.rememberLater.verdictNotCounted", "Stay with this level")
    : "";
  const resultWhy = sessionResult
    ? resultCountsForLevel
      ? t("games.rememberLater.resultWhyCounted", "You used both buttons at the right time.")
      : resultToneHit
        ? isAtMaxTier
          ? t("games.rememberLater.resultWhyMemoryCreditMax", "Nice work. Improve your matching accuracy next round to complete a balanced round at the highest level.")
          : t("games.rememberLater.resultWhyMemoryCredit", "Nice work. Improve your matching accuracy next round so it counts toward Level {nextLevel}.", { nextLevel: nextTier + 1 })
        : t("games.rememberLater.resultWhyNeedsRecall", "Stay here and strengthen this level. Use purple for targets and the reminder button for reminders.")
    : "";
  const resultMessage = getRememberLaterResultMessage({
    t,
    result: sessionResult,
    resultCountsForLevel,
    resultToneHit,
    promotedThisRound,
    progressWins,
    progressWinsNeeded,
    nextTier,
    nextTierBand,
    completedMilestone,
  });
  const resultContinueLabel = promotedThisRound
    ? t("games.rememberLater.startLevel", "Start Level {level}", { level: nextTier })
    : t("games.rememberLater.nextRound", "Next round");

  if (screen === "loading") {
    return (
      <BrainCoachLoadingState
        title={t("games.rememberLater.title", "Remember Later")}
        label={t("games.rememberLater.preparing", "Preparing the reminder...")}
        testId="remember-later-flow-shell"
        presentationId="brain_coach.activity_session.memory.remember_later.loading.touch"
        sceneId="brain_coach.activity_session.memory.remember_later"
      />
    );
  }

  return (
    <BrainCoachActivityShell
      title={t("games.rememberLater.title", "Remember Later")}
      backLabel={t("common.exit", "Exit")}
      onBack={exitGame}
      showHeader={screen !== "result"}
      testId="remember-later-flow-shell"
      frameClassName="lg:max-w-[980px]"
      presentationId={`brain_coach.activity_session.memory.remember_later.${screen}.touch`}
      sceneId="brain_coach.activity_session.memory.remember_later"
      sceneKind={screen === "result" ? "completion" : screen}
      sceneLayout={screen === "playing" ? "dual_action_game" : screen === "result" ? "modal_actions" : "activity_panel"}
      state={screen === "result" ? "complete" : "default"}
    >
      <div className="mx-auto w-full max-w-[980px]" style={{ color: BRAND.ink }}>
        {screen === "intro" && normalizedRound ? (
          <section className="mt-5 rounded-[28px] border bg-white p-5 shadow-vyva-card sm:p-7" style={{ borderColor: BRAND.border }}>
            {loadError ? <p className="m-5 rounded-2xl bg-[#FFF7ED] px-4 py-3 text-[20px] font-bold text-[#92400E]">{loadError}</p> : null}
            <div className="text-left">
              <p className="inline-flex rounded-full px-4 py-2 text-[17px] font-black sm:text-[18px]" style={{ background: "#FEF3C7", color: "#92400E" }}>
                {t("common.level", "Level")} {normalizedRound.difficulty_tier} - {currentTierBand.label}
              </p>
              <h1 className="mt-4 max-w-[560px] font-display text-[30px] font-semibold leading-snug sm:text-[34px]" style={{ color: BRAND.ink }}>
                {t("games.rememberLater.introLead", "Watch for two things.")}
              </h1>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-3 rounded-full border bg-white px-4 py-3 text-[17px] font-extrabold leading-snug shadow-[0_10px_24px_rgba(80,52,109,0.08)]" style={{ borderColor: BRAND.border, color: BRAND.muted }}>
                <input
                  type="checkbox"
                  checked={hideIntroAfterStart}
                  onChange={(event) => setHideIntroAfterStart(event.target.checked)}
                  className="h-6 w-6 shrink-0 rounded-lg border-2"
                  style={{ accentColor: BRAND.purple }}
                />
                <span>{t("games.rememberLater.hideInstructionsAfterStart", "Do not show these instructions again.")}</span>
              </label>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-[24px] border p-4" style={{ borderColor: BRAND.border, background: BRAND.softPurple }}>
                <div className="flex min-h-[118px] items-center gap-4">
                  <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-[22px] bg-white" style={{ color: BRAND.purple }}>
                    <RuleVisual rule={normalizedRound.ongoing_task_rule} size={48} />
                  </div>
                  <div>
                    <p className="text-[18px] font-extrabold leading-tight" style={{ color: BRAND.muted }}>{targetCueLabel}</p>
                    <p className="mt-1 text-[27px] font-black leading-tight sm:text-[30px]">
                      {t("games.rememberLater.tutorialTapPurple", "Tap purple")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border p-4" style={{ borderColor: "#FDE68A", background: "#FFF7ED" }}>
                <div className="flex min-h-[118px] items-center gap-4">
                  <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-[22px] bg-white" style={{ color: "#B45309" }}>
                    {firstIntention?.type === "event" ? <CueIcon icon={firstIntention.cue_icon} size={48} /> : <Clock size={48} />}
                  </div>
                  <div>
                    <p className="text-[18px] font-extrabold leading-tight" style={{ color: BRAND.muted }}>{reminderCueLabel}</p>
                    <p className="mt-1 text-[27px] font-black leading-tight sm:text-[30px]" style={{ color: "#92400E" }}>
                      {t("games.rememberLater.tutorialTapGold", "Touch this button")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="rounded-[22px] bg-[#F8FAFC] px-4 py-4">
                <p className="text-[23px] font-black leading-tight">{t("games.rememberLater.waitAnythingElse", "Anything else: wait.")}</p>
                <p className="mt-1 text-[17px] font-extrabold leading-snug" style={{ color: BRAND.muted }}>
                  {t("games.rememberLater.firstRoundOnly", "First round only. After this, levels start right away.")}
                </p>
              </div>
              <p className="rounded-full px-4 py-3 text-center text-[17px] font-black" style={{ background: "#ECFDF5", color: BRAND.teal }}>
                {t("games.rememberLater.countedRoundIntro", "3 good rounds = next level.")}
              </p>
            </div>

            <button
              type="button"
              onClick={beginAfterIntro}
              className="mt-6 inline-flex min-h-[78px] w-full items-center justify-center gap-3 rounded-full px-6 text-[26px] font-black text-white shadow-vyva-card"
              style={{ background: BRAND.purple }}
            >
              <Play size={30} fill="currentColor" />
              {t("games.rememberLater.startRound", "Start round")}
            </button>
          </section>
        ) : null}

        {screen === "countdown" && normalizedRound ? (
          <section className="mt-5 rounded-[28px] border bg-white p-6 text-center shadow-vyva-card sm:p-8" style={{ borderColor: BRAND.border }}>
            <p className="mx-auto inline-flex rounded-full px-4 py-2 text-[17px] font-black sm:text-[18px]" style={{ background: "#FEF3C7", color: "#92400E" }}>
              {t("common.level", "Level")} {normalizedRound.difficulty_tier} - {currentTierBand.label}
            </p>
            <div className="mx-auto mt-8 flex min-h-[340px] max-w-[520px] flex-col items-center justify-center rounded-[28px] border" style={{ borderColor: BRAND.border, background: BRAND.softPurple }}>
              <p className="text-[26px] font-black leading-tight" style={{ color: BRAND.purple }}>
                {t("games.rememberLater.countdownReady", "Get ready")}
              </p>
              <p className="mt-2 text-[19px] font-extrabold leading-snug" style={{ color: BRAND.muted }}>
                {t("games.rememberLater.countdownStartsIn", "Round starts in")}
              </p>
              <div
                aria-live="assertive"
                aria-label={t("games.rememberLater.countdownValue", "Round starts in {count}", { count: countdownValue })}
                className="mt-6 flex h-[154px] w-[154px] items-center justify-center rounded-full text-[86px] font-black leading-none text-white shadow-vyva-card"
                style={{ background: BRAND.purple }}
              >
                {countdownValue}
              </div>
            </div>
          </section>
        ) : null}

        {screen === "playing" && normalizedRound ? (
          <section className="relative mt-5 rounded-[28px] border bg-white p-5 shadow-vyva-card sm:p-6" style={{ borderColor: BRAND.border }}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <p className="inline-flex rounded-full px-4 py-2 text-[17px] font-black sm:text-[18px]" style={{ background: "#FEF3C7", color: "#92400E" }}>
                  {t("common.level", "Level")} {normalizedRound.difficulty_tier} - {currentTierBand.label}
                </p>
              </div>

              {normalizedRound.round_type === "event_based" ? (
                <div className="h-3 overflow-hidden rounded-full bg-[#EDE9FE]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, ((currentIndex + 1) / normalizedRound.filler_stream.length) * 100)}%`,
                      background: BRAND.purple,
                    }}
                  />
                </div>
              ) : null}

              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[26px] border bg-[#FFFEFC] sm:min-h-[320px]" style={{ borderColor: BRAND.border }}>
                <Stimulus item={currentItem} cueIcon={firstCueIcon} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleOngoingTap}
                  aria-label={matchButtonLabel}
                  className="group min-h-[86px] rounded-[24px] border px-4 py-3 text-left shadow-[0_12px_26px_rgba(80,52,109,0.08)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 active:translate-y-0"
                  style={{
                    background: "#FBF7FF",
                    borderColor: "#D8B4FE",
                    color: BRAND.ink,
                    "--tw-ring-color": "rgba(107, 33, 168, 0.18)",
                  }}
                >
                  <span className="flex items-center gap-4">
                    <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[18px] bg-white shadow-[0_8px_18px_rgba(107,33,168,0.10)]" style={{ color: BRAND.purple }}>
                      <RuleVisual rule={normalizedRound.ongoing_task_rule} size={32} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[22px] font-black leading-tight sm:text-[23px]">{matchActionLabel}</span>
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleIntentionTap}
                  aria-label={starActionLabel}
                  className="group min-h-[86px] rounded-[24px] border px-4 py-3 text-left shadow-[0_12px_26px_rgba(80,52,109,0.08)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 active:translate-y-0"
                  style={{
                    background: "#FFF8E6",
                    borderColor: "#FCD34D",
                    color: BRAND.ink,
                    "--tw-ring-color": "rgba(245, 158, 11, 0.22)",
                  }}
                >
                  <span className="flex items-center gap-4">
                    <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[18px] bg-white shadow-[0_8px_18px_rgba(180,83,9,0.12)]" style={{ color: BRAND.gold }}>
                      {firstIntention?.type === "event" ? <CueIcon icon={firstIntention.cue_icon} size={32} /> : <Clock size={32} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[22px] font-black leading-tight sm:text-[23px]" style={{ color: "#92400E" }}>{starActionLabel}</span>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {screen === "result" && sessionResult ? (
          <BrainGameCompletionDialog
            title={resultMessage.title}
            summary={resultMessage.summary}
            metrics={[
              { label: t("games.rememberLater.matchingTask", "Matching task"), value: `${Math.round(sessionResult.ongoing_accuracy_pct)}%` },
              { label: t("games.rememberLater.remembered", "Recall"), value: `${sessionResult.pm_hits}/${sessionResult.pm_total}` },
              { label: t("games.rememberLater.overall", "Overall"), value: `${Math.round(sessionResult.combined_accuracy_pct)}%` },
              { label: t("games.rememberLater.points", "Points"), value: `${sessionResult.score}/1000` },
            ]}
            details={
              <div
                className="rounded-[20px] px-4 py-4 text-left"
                style={{
                  background: resultCountsForLevel ? BRAND.tealPale : resultToneHit ? "#FEF3C7" : BRAND.softPurple,
                  color: resultCountsForLevel ? BRAND.teal : resultToneHit ? "#92400E" : BRAND.purple,
                }}
              >
                <p className="text-[15px] font-black uppercase">{resultVerdict}</p>
                <p className="mt-1 text-[15px] font-extrabold leading-snug">{resultMessage.detail || resultWhy}</p>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[15px] font-black">
                    <span>
                      {isAtMaxTier
                        ? t("games.rememberLater.masteryProgress", "Balanced-round progress")
                        : t("games.rememberLater.promotionProgress", "Progress to Level {level}", {
                          level: nextTier + 1,
                        })}
                    </span>
                    <span>{t("games.rememberLater.progressCount", "{count} of 3", { count: progressWins })}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/70">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (progressWins / 3) * 100)}%`, background: BRAND.purple }} />
                  </div>
                  <p className="mt-2 text-[14px] font-bold">
                    {t("games.rememberLater.currentLevel", "Current level")}: {nextTier} - {nextTierBand.label}
                  </p>
                </div>
              </div>
            }
            continueLabel={resultContinueLabel}
            anotherLabel={t("common.finish", "Finish")}
            assessmentReturnLabel={assessmentPractice ? t("brainGames.resultActions.backToResults", "Back to my results") : undefined}
            assessmentReturnHint={
              assessmentPractice
                ? t("brainGames.resultActions.assessmentPracticeComplete", "Good. You practiced the area VYVA noticed.")
                : undefined
            }
            onContinue={loadGame}
            onAnother={onExit}
            onAssessmentReturn={assessmentPractice ? onAssessmentPracticeReturn : undefined}
            disabled={saving}
          />
        ) : null}
      </div>
    </BrainCoachActivityShell>
  );
}
