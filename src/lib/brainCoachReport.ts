export type BrainCoachSession = {
  id?: string | null;
  activityType: string;
  domain: string;
  secondaryDomain?: string | null;
  difficulty?: number | null;
  difficultyScale?: string | null;
  completed?: boolean | null;
  abandoned?: boolean | null;
  score?: number | null;
  accuracyPct?: number | null;
  speedPct?: number | null;
  durationSeconds?: number | null;
  playedAt?: string | null;
  source?: string | null;
};

export type BrainCoachGroupSummary = {
  totalSessions: number;
  completedSessions: number;
  bestScore: number;
  totalDurationSeconds: number;
  lastPlayedAt: string | null;
};

export type BrainCoachProgress = {
  summary?: {
    totalSessions: number;
    completedSessions: number;
    streakDays: number;
    bestStreakDays: number;
    lastPlayedAt: string | null;
    totalDurationSeconds: number;
  };
  today?: {
    completedCount: number;
    activityTypes: string[];
    domains: string[];
  };
  domains?: Array<BrainCoachGroupSummary & { domain: string }>;
  activities?: Array<BrainCoachGroupSummary & { activityType: string }>;
  history?: BrainCoachSession[];
};

const domainLabels: Record<string, string> = {
  attention: "Focus",
  executive_function: "Planning",
  language: "Language",
  memory: "Memory",
  sensory: "Senses",
  spatial_navigation: "Spatial skills",
  processing_speed: "Speed",
};

const activityLabels: Record<string, string> = {
  association_memory: "Connections",
  breath_garden: "Breath garden",
  category_sort: "Category sort",
  curious_minds: "Curious minds",
  dual_task_walk: "Dual task walk",
  face_name_match: "Face-name match",
  listen_closely: "Listen closely",
  number_trails: "Number trails",
  remember_later: "Remember later",
  scent_memory: "Scent memory",
  sequence_memory: "Rhythm tap",
  spatial_navigator: "Spatial navigator",
  word_recall: "Word recall",
};

function humanizeKey(value?: string | null) {
  if (!value) return "Brain Coach";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function domainLabel(value?: string | null) {
  return value ? domainLabels[value] ?? humanizeKey(value) : "Brain Coach";
}

export function activityLabel(value?: string | null) {
  return value ? activityLabels[value] ?? humanizeKey(value) : "Brain Coach activity";
}

export function hasBrainCoachData(progress?: BrainCoachProgress | null) {
  const summary = progress?.summary;
  return Boolean((summary?.completedSessions ?? 0) > 0 || (summary?.totalSessions ?? 0) > 0);
}

export function formatBrainCoachDuration(seconds?: number | null) {
  const safeSeconds = Math.max(0, Math.round(safeNumber(seconds)));
  if (safeSeconds === 0) return "0 min";
  if (safeSeconds < 60) return "<1 min";

  const minutes = Math.max(1, Math.round(safeSeconds / 60));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function formatBrainCoachDate(iso?: string | null) {
  if (!iso) return "Not yet";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Not yet";
  }
}

export function formatBrainCoachTime(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function formatBrainCoachAccuracy(value?: number | null) {
  const numeric = safeNumber(value, Number.NaN);
  return Number.isFinite(numeric) ? `${Math.round(numeric)}%` : "--";
}

export function strongestBrainCoachDomain(progress?: BrainCoachProgress | null) {
  return [...(progress?.domains ?? [])].sort((a, b) => {
    if (b.completedSessions !== a.completedSessions) return b.completedSessions - a.completedSessions;
    if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
    return (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? "");
  })[0] ?? null;
}

export function brainCoachCompletionLabel(progress?: BrainCoachProgress | null) {
  const completed = progress?.summary?.completedSessions ?? 0;
  if (completed === 0) return "No games completed yet";
  if (completed === 1) return "1 game completed";
  return `${completed} games completed`;
}

export function buildBrainCoachNarrative(progress?: BrainCoachProgress | null) {
  if (!hasBrainCoachData(progress)) {
    return "Play a few short games and VYVA will turn them into a simple progress report.";
  }

  const summary = progress!.summary!;
  const strongest = strongestBrainCoachDomain(progress);
  const streak = summary.streakDays;
  const completed = summary.completedSessions;
  const area = strongest ? domainLabel(strongest.domain).toLowerCase() : "brain training";

  if (streak >= 3) {
    return `You are on a ${streak}-day streak. Your most practiced area is ${area}.`;
  }

  if (completed >= 3) {
    return `You have completed ${completed} games. Keep three steady days in a row to build a stronger routine.`;
  }

  return "A few more short sessions will make this report more useful.";
}

export function buildBrainCoachNextSteps(progress?: BrainCoachProgress | null) {
  if (!hasBrainCoachData(progress)) {
    return [
      "Start with one short memory game.",
      "Come back tomorrow so VYVA can spot a pattern.",
      "Keep sessions short and steady.",
    ];
  }

  const summary = progress!.summary!;
  const domains = progress?.domains ?? [];
  const steps: string[] = [];

  if ((progress?.today?.completedCount ?? 0) === 0) {
    steps.push("Do one short Brain Coach game today.");
  } else {
    steps.push("You already practiced today. Keep tomorrow light and steady.");
  }

  if (summary.streakDays < 3) {
    steps.push("Aim for 3 completed days in a row.");
  } else {
    steps.push("Protect the streak with one easy game tomorrow.");
  }

  if (domains.length <= 1) {
    steps.push("Try a different area next, like focus or language.");
  } else {
    const leastPracticed = [...domains].sort((a, b) => a.completedSessions - b.completedSessions)[0];
    steps.push(`Give ${domainLabel(leastPracticed.domain).toLowerCase()} a turn next.`);
  }

  return [...new Set(steps)].slice(0, 3);
}

export function buildBrainCoachShareText(progress?: BrainCoachProgress | null) {
  const summary = progress?.summary;
  const strongest = strongestBrainCoachDomain(progress);
  const lines = [
    "VYVA Brain Coach report",
    `Completed games: ${summary?.completedSessions ?? 0}`,
    `Current streak: ${summary?.streakDays ?? 0} day${(summary?.streakDays ?? 0) === 1 ? "" : "s"}`,
    `Practice time: ${formatBrainCoachDuration(summary?.totalDurationSeconds ?? 0)}`,
    `Last played: ${formatBrainCoachDate(summary?.lastPlayedAt ?? null)}`,
  ];

  if (strongest) {
    lines.push(`Most practiced area: ${domainLabel(strongest.domain)}`);
  }

  lines.push(`Next step: ${buildBrainCoachNextSteps(progress)[0]}`);
  return lines.join("\n");
}
