const DAY_MS = 24 * 60 * 60 * 1000;

export type BrainCoachPlanSession = {
  activityType: string;
  domain: string;
  secondaryDomain?: string | null;
  completed?: boolean | null;
  score?: number | string | null;
  accuracyPct?: number | string | null;
  durationSeconds?: number | string | null;
  playedAt?: Date | string | null;
};

export type BrainCoachPlanEvent = {
  activityType?: string | null;
  eventType: string;
  createdAt?: Date | string | null;
};

export type BrainCoachPlanPreferences = {
  sessionLengthMins?: number | null;
  trainingTime?: string | null;
  variety?: string | null;
  pace?: string | null;
  memoryDifficulties?: string | null;
  cognitiveDiagnosis?: string | null;
  hobbies?: string[];
  personality?: Record<string, string>;
  preferredDomains?: string[];
  excludedActivityTypes?: string[];
  weeklyTargetDays?: number | null;
  caregiverPaused?: boolean | null;
};

export type BrainCoachPlanActivity = {
  activityType: string;
  title: string;
  domain: string;
  secondaryDomain?: string;
  route: string;
  estimatedDurationMinutes: number;
  rationale: string;
  completedToday: boolean;
};

export type BrainCoachDailyPlan = {
  planDate: string;
  generatedAt: string;
  estimatedDurationMinutes: number;
  recommendedDomains: string[];
  activities: BrainCoachPlanActivity[];
  rationale: string[];
  completion: {
    completedCount: number;
    totalCount: number;
    allComplete: boolean;
    completedActivityTypes: string[];
  };
};

type ActivityCandidate = {
  activityType: string;
  title: string;
  domain: string;
  secondaryDomain?: string;
  route: string;
  estimatedDurationMinutes: number;
};

type ScoredCandidate = ActivityCandidate & {
  score: number;
  reason: string;
};

type ActivityTrendStats = {
  sessions: number;
  completed: number;
  averageScore: number;
  averageAccuracy: number;
  accepted: number;
  started: number;
  skipped: number;
  completedEvents: number;
};

const ACTIVITY_CATALOG: ActivityCandidate[] = [
  {
    activityType: "sequence_memory",
    title: "Rhythm Tap",
    domain: "attention",
    route: "/attention-boosters/rhythm-tap",
    estimatedDurationMinutes: 4,
  },
  {
    activityType: "dual_task_walk",
    title: "Dual Task Walk",
    domain: "attention",
    secondaryDomain: "executive_function",
    route: "/dual-task-walk",
    estimatedDurationMinutes: 5,
  },
  {
    activityType: "memory_match",
    title: "Memory Match",
    domain: "visual_memory",
    route: "/memory-games/memory_match",
    estimatedDurationMinutes: 4,
  },
  {
    activityType: "word_recall",
    title: "Word Recall",
    domain: "episodic_memory",
    route: "/memory-games/word_recall",
    estimatedDurationMinutes: 5,
  },
  {
    activityType: "association_memory",
    title: "Connections",
    domain: "associative_memory",
    route: "/memory-games/association_memory",
    estimatedDurationMinutes: 4,
  },
  {
    activityType: "number_memory",
    title: "Number Memory",
    domain: "working_memory",
    route: "/memory-games/number_memory",
    estimatedDurationMinutes: 4,
  },
  {
    activityType: "remember_later",
    title: "Remember Later",
    domain: "prospective_memory",
    secondaryDomain: "attention",
    route: "/memory-games/remember-later",
    estimatedDurationMinutes: 5,
  },
  {
    activityType: "curious_minds",
    title: "Curious Minds",
    domain: "divergent_thinking",
    secondaryDomain: "attention",
    route: "/memory-games/curious-minds",
    estimatedDurationMinutes: 5,
  },
  {
    activityType: "scent_memory",
    title: "Scent Memory",
    domain: "episodic_memory",
    route: "/senses/scent-memory",
    estimatedDurationMinutes: 4,
  },
  {
    activityType: "breath_garden",
    title: "Breath Garden",
    domain: "arousal_regulation",
    route: "/senses/breath-garden",
    estimatedDurationMinutes: 4,
  },
  {
    activityType: "listen_closely",
    title: "Listen Closely",
    domain: "auditory_attention",
    secondaryDomain: "attention",
    route: "/senses/listen-closely",
    estimatedDurationMinutes: 4,
  },
  {
    activityType: "story_recall",
    title: "Story Recall",
    domain: "language",
    route: "/memory-games/story_recall",
    estimatedDurationMinutes: 5,
  },
  {
    activityType: "category_sort",
    title: "Category Sort",
    domain: "executive_function",
    route: "/executive-function/category-sort",
    estimatedDurationMinutes: 5,
  },
  {
    activityType: "number_trails",
    title: "Number Trails",
    domain: "processing_speed",
    secondaryDomain: "executive_function",
    route: "/executive-function/number-trails",
    estimatedDurationMinutes: 5,
  },
  {
    activityType: "face_name_match",
    title: "Face-Name Match",
    domain: "associative_memory",
    secondaryDomain: "social_recognition",
    route: "/face-name-match",
    estimatedDurationMinutes: 5,
  },
];

export function getBrainCoachActivityCatalog(): ActivityCandidate[] {
  return ACTIVITY_CATALOG.map((activity) => ({ ...activity }));
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function dayStart(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function numberValue(value: number | string | null | undefined, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function optionalNumberValue(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sortedSessions(sessions: BrainCoachPlanSession[]) {
  return [...sessions].sort((a, b) => {
    const aDate = asDate(a.playedAt)?.getTime() ?? 0;
    const bDate = asDate(b.playedAt)?.getTime() ?? 0;
    return bDate - aDate;
  });
}

function completedDayKeys(sessions: BrainCoachPlanSession[]) {
  return new Set(
    sessions
      .filter((session) => session.completed)
      .map((session) => asDate(session.playedAt))
      .filter((date): date is Date => Boolean(date))
      .map((date) => dayKey(new Date(dayStart(date)))),
  );
}

export function calculatePlanStreakDays(sessions: BrainCoachPlanSession[], now = new Date()): number {
  const days = completedDayKeys(sessions);
  const todayStart = dayStart(now);
  const yesterdayStart = todayStart - DAY_MS;
  let cursor = days.has(dayKey(new Date(todayStart)))
    ? todayStart
    : days.has(dayKey(new Date(yesterdayStart)))
      ? yesterdayStart
      : null;

  if (cursor === null) return 0;

  let streak = 0;
  while (days.has(dayKey(new Date(cursor)))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

function daysSinceLastSession(sessions: BrainCoachPlanSession[], now: Date): number | null {
  const latest = sortedSessions(sessions)[0];
  const latestDate = asDate(latest?.playedAt);
  if (!latestDate) return null;
  return Math.max(0, Math.floor((dayStart(now) - dayStart(latestDate)) / DAY_MS));
}

function lastPlayedBy<T extends "activityType" | "domain">(sessions: BrainCoachPlanSession[], key: T) {
  const map = new Map<string, Date>();
  sortedSessions(sessions).forEach((session) => {
    const date = asDate(session.playedAt);
    const value = session[key];
    if (!date || !value || map.has(value)) return;
    map.set(value, date);
  });
  return map;
}

function recentDomainStats(sessions: BrainCoachPlanSession[], now: Date) {
  const stats = new Map<string, { count: number; completed: number; averageScore: number; averageAccuracy: number }>();
  const cutoff = now.getTime() - 30 * DAY_MS;

  sessions.forEach((session) => {
    const playedAt = asDate(session.playedAt);
    if (!playedAt || playedAt.getTime() < cutoff) return;

    const current = stats.get(session.domain) ?? {
      count: 0,
      completed: 0,
      averageScore: 0,
      averageAccuracy: 0,
    };
    current.count += 1;
    current.completed += session.completed ? 1 : 0;
    current.averageScore += numberValue(session.score);
    current.averageAccuracy += numberValue(session.accuracyPct);
    stats.set(session.domain, current);
  });

  stats.forEach((value) => {
    value.averageScore = value.count > 0 ? value.averageScore / value.count : 0;
    value.averageAccuracy = value.count > 0 ? value.averageAccuracy / value.count : 0;
  });

  return stats;
}

function recentActivityTrendStats(
  sessions: BrainCoachPlanSession[],
  events: BrainCoachPlanEvent[],
  now: Date,
) {
  const stats = new Map<string, ActivityTrendStats>();
  const cutoff = now.getTime() - 30 * DAY_MS;

  function current(activityType: string) {
    const existing = stats.get(activityType) ?? {
      sessions: 0,
      completed: 0,
      averageScore: 0,
      averageAccuracy: 0,
      accepted: 0,
      started: 0,
      skipped: 0,
      completedEvents: 0,
    };
    stats.set(activityType, existing);
    return existing;
  }

  sessions.forEach((session) => {
    const playedAt = asDate(session.playedAt);
    if (!playedAt || playedAt.getTime() < cutoff) return;
    const trend = current(session.activityType);
    trend.sessions += 1;
    trend.completed += session.completed ? 1 : 0;
    trend.averageScore += numberValue(session.score);
    trend.averageAccuracy += numberValue(session.accuracyPct);
  });

  events.forEach((event) => {
    if (!event.activityType) return;
    const createdAt = asDate(event.createdAt);
    if (!createdAt || createdAt.getTime() < cutoff) return;
    const trend = current(event.activityType);
    if (event.eventType === "accepted") trend.accepted += 1;
    if (event.eventType === "started") trend.started += 1;
    if (event.eventType === "skipped") trend.skipped += 1;
    if (event.eventType === "completed") trend.completedEvents += 1;
  });

  stats.forEach((value) => {
    value.averageScore = value.sessions > 0 ? value.averageScore / value.sessions : 0;
    value.averageAccuracy = value.sessions > 0 ? value.averageAccuracy / value.sessions : 0;
  });

  return stats;
}

function preferredPlanMinutes(preferences: BrainCoachPlanPreferences, lapsed: boolean): number {
  const requested = numberValue(preferences.sessionLengthMins, 7);
  if (lapsed) return 5;
  return Math.min(10, Math.max(5, requested));
}

function recencyScore(lastPlayed: Date | undefined, now: Date): { points: number; reason: string } {
  if (!lastPlayed) {
    return { points: 35, reason: "new area for variety" };
  }

  const daysAgo = Math.floor((dayStart(now) - dayStart(lastPlayed)) / DAY_MS);
  if (daysAgo <= 0) return { points: -25, reason: "already practised today" };
  if (daysAgo === 1) return { points: -8, reason: "practised yesterday" };
  if (daysAgo <= 3) return { points: 8, reason: "light recent practice" };
  if (daysAgo <= 7) return { points: 18, reason: "not practised this week" };
  return { points: 30, reason: "not practised recently" };
}

function scoreCandidate(
  candidate: ActivityCandidate,
  sessions: BrainCoachPlanSession[],
  events: BrainCoachPlanEvent[],
  preferences: BrainCoachPlanPreferences,
  now: Date,
): ScoredCandidate {
  const latest = sortedSessions(sessions);
  const domainLastPlayed = lastPlayedBy(sessions, "domain");
  const activityLastPlayed = lastPlayedBy(sessions, "activityType");
  const domainStats = recentDomainStats(sessions, now);
  const activityTrends = recentActivityTrendStats(sessions, events, now);
  const domainRecency = recencyScore(domainLastPlayed.get(candidate.domain), now);
  const activityRecency = recencyScore(activityLastPlayed.get(candidate.activityType), now);

  let score = 50 + domainRecency.points + Math.round(activityRecency.points / 2);
  let reason = domainRecency.reason;
  const lastActivityType = latest[0]?.activityType;
  const repeatingAllowed = preferences.variety === "repeating";

  if (lastActivityType === candidate.activityType) {
    score -= repeatingAllowed ? 10 : 35;
    reason = repeatingAllowed ? "familiar activity, with light variety control" : "avoids repeating the same game";
  } else if (latest.slice(0, 3).some((session) => session.activityType === candidate.activityType)) {
    score -= repeatingAllowed ? 3 : 14;
  }

  const stats = domainStats.get(candidate.domain);
  const completionRate = stats && stats.count > 0 ? stats.completed / stats.count : 1;
  const weakDomain = Boolean(stats && stats.count >= 2 && (
    stats.averageScore < 600 ||
    stats.averageAccuracy < 65 ||
    completionRate < 0.7
  ));
  const strongDomain = Boolean(stats && stats.count >= 2 && (
    stats.averageScore >= 800 ||
    stats.averageAccuracy >= 85
  ) && completionRate >= 0.8);

  if (weakDomain) {
    score += 45;
    reason = "recent scores suggest this domain needs gentle practice";
  } else if (strongDomain) {
    score -= 12;
    reason = "already looking strong recently";
  }

  const activityTrend = activityTrends.get(candidate.activityType);
  if (activityTrend) {
    const completionRate = activityTrend.sessions > 0 ? activityTrend.completed / activityTrend.sessions : 1;
    const acceptedAndCompleted = activityTrend.accepted + activityTrend.completedEvents;

    if (activityTrend.sessions >= 2 && (activityTrend.averageScore < 600 || activityTrend.averageAccuracy < 65 || completionRate < 0.6)) {
      score += 16;
      reason = "activity trend suggests more gentle practice would help";
    }

    if (activityTrend.skipped >= 2) {
      score -= Math.min(45, 18 + activityTrend.skipped * 8);
      reason = "recent skips suggest choosing a different activity first";
    } else if (activityTrend.skipped === 1) {
      score -= 8;
    }

    if (acceptedAndCompleted >= 2 && activityTrend.skipped === 0) {
      score += 6;
    }
  }

  if (preferences.memoryDifficulties && preferences.memoryDifficulties !== "none") {
    if (candidate.domain.includes("memory")) score += 8;
    if (candidate.domain === "attention") score += 5;
  }

  if (preferences.preferredDomains?.includes(candidate.domain) || (candidate.secondaryDomain && preferences.preferredDomains?.includes(candidate.secondaryDomain))) {
    score += 22;
    reason = "matches caregiver-approved focus domains";
  }

  if (preferences.pace === "slower" || preferences.pace === "very_slow") {
    if (candidate.estimatedDurationMinutes <= 4) score += 6;
    if (candidate.activityType === "dual_task_walk") score -= 6;
  }

  return { ...candidate, score, reason };
}

function selectActivities(
  scored: ScoredCandidate[],
  targetMinutes: number,
): ScoredCandidate[] {
  const selected: ScoredCandidate[] = [];

  for (const candidate of scored) {
    if (selected.some((activity) => activity.activityType === candidate.activityType)) continue;
    if (selected.length > 0 && selected.some((activity) => activity.domain === candidate.domain)) continue;
    const nextMinutes = selected.reduce((total, activity) => total + activity.estimatedDurationMinutes, 0) + candidate.estimatedDurationMinutes;
    if (selected.length > 0 && nextMinutes > 10) continue;
    selected.push(candidate);
    if (nextMinutes >= targetMinutes || selected.length >= 2) break;
  }

  if (selected.length === 0) {
    selected.push(scored[0]);
  }

  return selected;
}

export function buildBrainCoachDailyPlan(input: {
  sessions?: BrainCoachPlanSession[];
  events?: BrainCoachPlanEvent[];
  preferences?: BrainCoachPlanPreferences | null;
  now?: Date;
  streakDays?: number;
}): BrainCoachDailyPlan {
  const sessions = sortedSessions(input.sessions ?? []);
  const events = input.events ?? [];
  const preferences = input.preferences ?? {};
  const now = input.now ?? new Date();
  const today = dayKey(now);
  if (preferences.caregiverPaused) {
    return {
      planDate: today,
      generatedAt: now.toISOString(),
      estimatedDurationMinutes: 0,
      recommendedDomains: [],
      activities: [],
      rationale: ["Brain Coach planning is paused by caregiver-approved settings."],
      completion: {
        completedCount: 0,
        totalCount: 0,
        allComplete: false,
        completedActivityTypes: [],
      },
    };
  }
  const lapsedDays = daysSinceLastSession(sessions, now);
  const lapsed = lapsedDays !== null && lapsedDays >= 7;
  const targetMinutes = preferredPlanMinutes(preferences, lapsed);
  const todayCompleted = new Set(
    sessions
      .filter((session) => session.completed && asDate(session.playedAt) && dayKey(asDate(session.playedAt)!) === today)
      .map((session) => session.activityType),
  );

  const excluded = new Set(preferences.excludedActivityTypes ?? []);
  const candidates = ACTIVITY_CATALOG.filter((candidate) => !excluded.has(candidate.activityType));
  const catalog = candidates.length > 0 ? candidates : ACTIVITY_CATALOG;

  const scored = catalog
    .map((candidate) => scoreCandidate(candidate, sessions, events, preferences, now))
    .sort((a, b) => b.score - a.score);
  const selected = selectActivities(scored, targetMinutes);
  const estimatedDurationMinutes = selected.reduce((total, activity) => total + activity.estimatedDurationMinutes, 0);
  const streakDays = input.streakDays ?? calculatePlanStreakDays(sessions, now);
  const completedActivityTypes = selected
    .filter((activity) => todayCompleted.has(activity.activityType))
    .map((activity) => activity.activityType);

  const rationale = [
    sessions.length === 0
      ? "Starts with a short balanced plan because there is no Brain Coach history yet."
      : lapsed
        ? "Keeps the plan short to restart after a gap in practice."
        : "Balances recent history with domains not practised recently.",
    preferences.variety === "repeating"
      ? "Allows some familiar repetition because onboarding preferences allow it."
      : "Avoids repeating the same game continuously.",
    preferences.preferredDomains && preferences.preferredDomains.length > 0
      ? `Uses caregiver-approved focus domains: ${preferences.preferredDomains.join(", ")}.`
      : "Uses the default domain balance when no caregiver focus is set.",
    preferences.weeklyTargetDays
      ? `Supports the caregiver-approved weekly goal of ${preferences.weeklyTargetDays} Brain Coach days.`
      : "Uses the default weekly goal for gentle consistency.",
    streakDays > 0
      ? `Keeps momentum from the current ${streakDays}-day streak.`
      : "Aims for one clear completion today.",
  ];

  return {
    planDate: today,
    generatedAt: now.toISOString(),
    estimatedDurationMinutes,
    recommendedDomains: [...new Set(selected.flatMap((activity) => [activity.domain, activity.secondaryDomain].filter(Boolean) as string[]))],
    activities: selected.map((activity) => ({
      activityType: activity.activityType,
      title: activity.title,
      domain: activity.domain,
      secondaryDomain: activity.secondaryDomain,
      route: activity.route,
      estimatedDurationMinutes: activity.estimatedDurationMinutes,
      rationale: activity.reason,
      completedToday: todayCompleted.has(activity.activityType),
    })),
    rationale,
    completion: {
      completedCount: completedActivityTypes.length,
      totalCount: selected.length,
      allComplete: completedActivityTypes.length === selected.length,
      completedActivityTypes,
    },
  };
}

export function extractBrainCoachPreferences(input: unknown): BrainCoachPlanPreferences {
  const root = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const cognitive = root.cognitive && typeof root.cognitive === "object"
    ? root.cognitive as Record<string, unknown>
    : {};
  const hobbiesSection = root.hobbies && typeof root.hobbies === "object"
    ? root.hobbies as Record<string, unknown>
    : {};

  return {
    sessionLengthMins: optionalNumberValue(cognitive.session_length_mins),
    trainingTime: typeof cognitive.training_time === "string" ? cognitive.training_time : null,
    variety: typeof cognitive.variety === "string" ? cognitive.variety : null,
    pace: typeof cognitive.pace === "string" ? cognitive.pace : null,
    memoryDifficulties: typeof cognitive.memory_difficulties === "string" ? cognitive.memory_difficulties : null,
    cognitiveDiagnosis: typeof cognitive.cognitive_diagnosis === "string" ? cognitive.cognitive_diagnosis : null,
    hobbies: Array.isArray(hobbiesSection.hobbies)
      ? hobbiesSection.hobbies.filter((entry): entry is string => typeof entry === "string")
      : [],
    personality: hobbiesSection.personality && typeof hobbiesSection.personality === "object"
      ? hobbiesSection.personality as Record<string, string>
      : {},
  };
}
