import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MousePointer2, Play, Route, Smile, Sparkles, Timer, Zap } from "lucide-react";
import { useLanguage } from "@/i18n";
import { BrainCoachActivityShell, BrainCoachLoadingState } from "@/components/brain/BrainCoachFlowShell";
import { gameData } from "./shared/gameDataApi";
import BrainGameCompletionDialog from "./shared/BrainGameCompletionDialog";
import { recordCognitiveSession } from "./shared/brainCoachSessions";
import {
  BRAIN_COACH_MAX_LEVEL,
  getBrainCoachLevelBand,
  getBrainCoachSupportiveProgressCopy,
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
  tealPale: "#DDF7F1",
  teal: "#0F766E",
  red: "#DC2626",
};

const TUTORIAL_NODES = [
  { label: "1", x: 0.18, y: 0.22 },
  { label: "2", x: 0.72, y: 0.36 },
  { label: "3", x: 0.32, y: 0.64 },
  { label: "4", x: 0.78, y: 0.82 },
];

const FALLBACK_CONFIG = {
  id: null,
  local_key: "local-empty",
  trail_type: "numeric",
  node_count: 0,
  nodes: [],
  par_time_seconds: 30,
  difficulty_tier: 1,
  language: "es",
  is_active: true,
  is_local_practice: true,
};

const TUTORIAL_SEEN_KEY = "numberTrails:tutorialSeen:v1";
const RECENT_LOCAL_TRAILS_KEY = "numberTrails:recentLocalTrails:v1";
const RECENT_CONFIGS_KEY = "numberTrails:recentConfigIds:v1";
const RECENT_TRAIL_LIMIT = 8;

const TIER_SETTINGS = [
  { trailType: "numeric", nodeCount: 5, parSeconds: 30 },
  { trailType: "numeric", nodeCount: 8, parSeconds: 45 },
  { trailType: "numeric", nodeCount: 10, parSeconds: 55 },
  { trailType: "numeric", nodeCount: 12, parSeconds: 65 },
  { trailType: "numeric", nodeCount: 15, parSeconds: 80 },
  { trailType: "alternating", nodeCount: 8, parSeconds: 50 },
  { trailType: "alternating", nodeCount: 10, parSeconds: 65 },
  { trailType: "alternating", nodeCount: 14, parSeconds: 85 },
  { trailType: "alternating", nodeCount: 18, parSeconds: 110 },
  { trailType: "alternating", nodeCount: 25, parSeconds: 150 },
  { trailType: "numeric", nodeCount: 18, parSeconds: 95 },
  { trailType: "numeric", nodeCount: 20, parSeconds: 105 },
  { trailType: "alternating", nodeCount: 18, parSeconds: 105 },
  { trailType: "alternating", nodeCount: 20, parSeconds: 118 },
  { trailType: "alternating", nodeCount: 22, parSeconds: 132 },
  { trailType: "numeric", nodeCount: 22, parSeconds: 105 },
  { trailType: "alternating", nodeCount: 22, parSeconds: 118 },
  { trailType: "numeric", nodeCount: 25, parSeconds: 120 },
  { trailType: "alternating", nodeCount: 24, parSeconds: 128 },
  { trailType: "alternating", nodeCount: 25, parSeconds: 136 },
];

let localTrailCounter = 0;

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

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function defaultUserState(userId) {
  return {
    user_id: userId,
    current_tier: 1,
    sessions_at_tier: 0,
    consecutive_wins: 0,
    consecutive_losses: 0,
    total_sessions: 0,
    best_score: 0,
    last_played_at: null,
    streak_days: 0,
    last_streak_date: null,
    updated_at: new Date().toISOString(),
  };
}

function normalizeConfig(row) {
  const nodes = asArray(row?.nodes).map((node) => ({
    label: String(node.label),
    x: Number(node.x),
    y: Number(node.y),
  }));

  return {
    ...row,
    trail_type: row?.trail_type ?? "numeric",
    node_count: Number(row?.node_count ?? nodes.length),
    nodes,
    par_time_seconds: Number(row?.par_time_seconds ?? 30),
    difficulty_tier: Number(row?.difficulty_tier ?? 1),
  };
}

function readStorageArray(key) {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function rememberStorageValue(key, value, limit = RECENT_TRAIL_LIMIT) {
  if (typeof window === "undefined" || !value) return;
  const next = [String(value), ...readStorageArray(key).filter((item) => item !== String(value))].slice(0, limit);
  window.localStorage.setItem(key, JSON.stringify(next));
}

function hasSeenTutorial() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === "true";
}

function saveTutorialSeen() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TUTORIAL_SEEN_KEY, "true");
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = hashString(seed) || 1;
  return () => {
    state += 0x6D2B79F5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRandom(items, random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getTierSettings(tier) {
  const safeTier = clamp(Number(tier) || 1, 1, TIER_SETTINGS.length);
  return {
    tier: safeTier,
    ...TIER_SETTINGS[safeTier - 1],
  };
}

function buildTrailLabels(nodeCount, trailType) {
  return Array.from({ length: nodeCount }, (_, index) => {
    if (trailType !== "alternating") return String(index + 1);
    const pair = Math.floor(index / 2) + 1;
    return index % 2 === 0 ? String(pair) : String.fromCharCode(64 + pair);
  });
}

function generateTrailNodes(nodeCount, trailType, random) {
  const columns = Math.ceil(Math.sqrt(nodeCount * 1.2));
  const rows = Math.ceil(nodeCount / columns);
  const cells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({ row, column });
    }
  }

  const labels = buildTrailLabels(nodeCount, trailType);
  const selectedCells = shuffleWithRandom(cells, random).slice(0, nodeCount);

  return labels.map((label, index) => {
    const cell = selectedCells[index];
    const jitterX = (random() - 0.5) * 0.46;
    const jitterY = (random() - 0.5) * 0.42;
    const x = clamp((cell.column + 0.5 + jitterX) / columns, 0.09, 0.91);
    const y = clamp((cell.row + 0.5 + jitterY) / rows, 0.12, 0.88);

    return {
      label,
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
    };
  });
}

function createLocalTrailConfig(tier, language = "es") {
  const settings = getTierSettings(tier);
  const recent = readStorageArray(RECENT_LOCAL_TRAILS_KEY);
  let selected = null;

  for (let attempt = 0; attempt < RECENT_TRAIL_LIMIT + 2; attempt += 1) {
    localTrailCounter += 1;
    const seed = `${todayKey()}-${settings.tier}-${localTrailCounter}-${Date.now()}-${Math.random()}-${attempt}`;
    const localKey = `local-${settings.tier}-${hashString(seed).toString(36)}`;
    const random = createSeededRandom(seed);
    const candidate = {
      id: null,
      local_key: localKey,
      trail_type: settings.trailType,
      node_count: settings.nodeCount,
      nodes: generateTrailNodes(settings.nodeCount, settings.trailType, random),
      par_time_seconds: settings.parSeconds,
      difficulty_tier: settings.tier,
      language,
      is_active: true,
      is_local_practice: true,
    };

    selected = candidate;
    if (!recent.includes(localKey)) break;
  }

  rememberStorageValue(RECENT_LOCAL_TRAILS_KEY, selected.local_key);
  return selected;
}

export function pickFreshNumberTrailConfig(rows, recentIds = []) {
  const configs = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!configs.length) return null;
  const recent = new Set(recentIds.map(String));
  const fresh = configs.filter((row) => !recent.has(String(row.id)));
  const pool = fresh.length ? fresh : configs;
  return pool[Math.floor(Math.random() * pool.length)];
}

function rememberConfig(config) {
  if (config?.id) {
    rememberStorageValue(RECENT_CONFIGS_KEY, config.id);
  }
}

function withFallbackTier(tier, language = "es") {
  const fallback = createLocalTrailConfig(tier, language);
  return {
    ...FALLBACK_CONFIG,
    ...fallback,
  };
}

function formatTemplate(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function wholeSeconds(ms) {
  return Math.max(1, Math.round((ms ?? 0) / 1000));
}

function linesForCompleted(nodes, count) {
  const lines = [];
  for (let index = 1; index < count; index += 1) {
    lines.push({ from: nodes[index - 1], to: nodes[index] });
  }
  return lines;
}

function computeScore(nodesCorrect, nodesTotal, completionMs, parMs, abandoned = false) {
  const accuracyPct = nodesTotal ? (nodesCorrect / nodesTotal) * 100 : 0;
  let speedPct = 0;

  if (!abandoned && completionMs && parMs) {
    const speedRatio = completionMs / parMs;
    speedPct = clamp(100 * (1 - (speedRatio - 1)), 0, 100);
  }

  const score = abandoned ? 0 : Math.round(accuracyPct * 6 + speedPct * 4);

  return {
    nodes_correct: nodesCorrect,
    nodes_total: nodesTotal,
    completion_time_ms: completionMs ?? null,
    par_time_ms: parMs,
    accuracy_pct: Number(accuracyPct.toFixed(2)),
    speed_pct: Number(speedPct.toFixed(2)),
    combined_accuracy_pct: Number(((accuracyPct + speedPct) / 2).toFixed(2)),
    completed: !abandoned && nodesCorrect >= nodesTotal,
    abandoned,
    score: clamp(score, 0, 1000),
  };
}

function useMeasuredCanvas(mode) {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 360, height: mode === "playing" ? 520 : 180 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const updateSize = () => {
      const width = node.getBoundingClientRect().width || 360;
      const height =
        mode === "playing"
          ? Math.max(480, Math.min(640, Math.round(width * 1.25)))
          : mode === "tutorial"
            ? 360
            : mode === "result"
              ? 200
              : 180;

      setSize({ width, height });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [mode]);

  return { ref, size };
}

function TrailCanvas({
  nodes,
  completedLabels,
  lines,
  nextLabel,
  flashLabel,
  onNodeTap,
  mode = "playing",
  showAllLines = false,
  handNode = null,
}) {
  const { ref, size } = useMeasuredCanvas(mode);
  const nodeSize = mode === "playing" || mode === "tutorial" ? 64 : mode === "result" ? 38 : 34;
  const renderedLines = showAllLines ? linesForCompleted(nodes, nodes.length) : lines;

  return (
    <div
      ref={ref}
      className={`nt-canvas nt-canvas-${mode} relative w-full overflow-hidden rounded-[26px] border bg-white`}
      style={{
        height: size.height,
        borderColor: mode === "playing" ? BRAND.border : "#EFE4D5",
      }}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
        {renderedLines.map((line, index) => (
          <line
            key={`${line.from.label}-${line.to.label}-${index}`}
            x1={line.from.x * size.width}
            y1={line.from.y * size.height}
            x2={line.to.x * size.width}
            y2={line.to.y * size.height}
            stroke={BRAND.purple}
            strokeWidth={mode === "result" || mode === "preview" ? 2 : 3}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {nodes.map((node) => {
        const completed = completedLabels.has(node.label) || showAllLines;
        const isNext = nextLabel === node.label && !completed;
        const flashing = flashLabel === node.label;
        const isStart = node.label === nodes[0]?.label;
        const isFinish = node.label === nodes[nodes.length - 1]?.label;
        const borderColor = completed
          ? BRAND.purple
          : isNext || isFinish
            ? BRAND.gold
            : isStart
              ? BRAND.teal
              : BRAND.purple;
        return (
          <button
            key={node.label}
            type="button"
            disabled={!onNodeTap}
            onClick={() => onNodeTap?.(node)}
            aria-pressed={completed}
            className={`nt-node absolute flex items-center justify-center rounded-full border-[3px] text-center font-extrabold transition-transform ${
              completed ? "nt-node-completed" : "bg-white"
            } ${isNext ? "nt-node-next" : ""} ${flashing ? "nt-node-flash" : ""}`}
            style={{
              left: `${node.x * 100}%`,
              top: `${node.y * 100}%`,
              width: nodeSize,
              height: nodeSize,
              minWidth: nodeSize,
              minHeight: nodeSize,
              transform: "translate(-50%, -50%)",
              borderColor,
              color: completed ? "#FFFFFF" : BRAND.ink,
              background: completed ? BRAND.purple : "#FFFFFF",
              fontSize: mode === "playing" || mode === "tutorial" ? 24 : 18,
              lineHeight: 1,
              boxShadow: flashing ? `0 0 0 7px ${BRAND.red}` : "0 3px 12px rgba(43,34,51,0.08)",
            }}
          >
            {(isStart || isFinish) && (
              <span
                className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white"
                style={{ background: isStart ? BRAND.teal : BRAND.gold }}
                aria-hidden="true"
              />
            )}
            {node.label}
          </button>
        );
      })}

      {handNode && (
        <div
          className="nt-hand-pointer absolute flex h-[54px] w-[54px] items-center justify-center rounded-full bg-white text-vyva-purple shadow-vyva-card"
          style={{
            left: `${handNode.x * 100}%`,
            top: `${handNode.y * 100}%`,
            transform: "translate(-18%, -12%)",
          }}
          aria-hidden="true"
        >
          <MousePointer2 size={30} />
        </div>
      )}
    </div>
  );
}

export default function NumberTrails({
  userId,
  onExit,
  assessmentPractice = null,
  onAssessmentPracticeComplete,
  onAssessmentPracticeReturn,
}) {
  const { language, t } = useLanguage();
  const gameLanguage = normalizeGameLanguage(language);
  const text = useMemo(() => ({
    preparing: t("games.numberTrails.preparing"),
    practiceNote: t("games.numberTrails.practiceNote"),
    title: t("games.numberTrails.title"),
    subtitle: t("games.numberTrails.subtitle"),
    instruction: t("games.numberTrails.instruction"),
    instructionAlt: t("games.numberTrails.instructionAlt"),
    example: t("games.numberTrails.example"),
    tapInOrder: t("games.numberTrails.tapInOrder"),
    nextTarget: t("games.numberTrails.nextTarget"),
    stillThere: t("games.numberTrails.stillThere"),
    badgeNumeric: t("games.numberTrails.badgeNumeric"),
    badgeAlternating: t("games.numberTrails.badgeAlternating"),
    completedIn: t("games.numberTrails.completedIn"),
    parTime: t("games.numberTrails.parTime"),
    fasterThanPar: t("games.numberTrails.fasterThanPar"),
    speed: t("games.numberTrails.speed"),
    resultGood: t("games.numberTrails.resultGood"),
    resultTry: t("games.numberTrails.resultTry"),
    accuracy: t("games.numberTrails.accuracy"),
    score: t("games.numberTrails.score"),
    streak: t("games.numberTrails.streak"),
    days: t("games.numberTrails.days"),
    nextTrail: t("games.numberTrails.nextTrail"),
    tryThisTrail: t("games.numberTrails.tryThisTrail"),
    start: t("common.start"),
    skip: t("common.skip"),
    exit: t("common.exit"),
    nextLevel: t("common.nextLevel"),
    level: t("common.level"),
    continueToLevel: t("brainGames.resultActions.continueToLevel"),
    playAnotherGame: t("brainGames.resultActions.playAnotherGame"),
  }), [t]);

  const [screen, setScreen] = useState("loading");
  const [config, setConfig] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [userState, setUserState] = useState(null);
  const [loadNote, setLoadNote] = useState("");
  const [tutorialSeen, setTutorialSeen] = useState(() => hasSeenTutorial());

  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [completedNodes, setCompletedNodes] = useState(new Set());
  const [drawnLines, setDrawnLines] = useState([]);
  const [errors, setErrors] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [gamePhase, setGamePhase] = useState("waiting");
  const [flashLabel, setFlashLabel] = useState(null);
  const [idlePrompt, setIdlePrompt] = useState(false);
  const [sessionResult, setSessionResult] = useState(null);
  const [savingResult, setSavingResult] = useState(false);

  const [tutorialAnimating, setTutorialAnimating] = useState(false);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [tutorialCompleted, setTutorialCompleted] = useState(new Set());
  const [tutorialLines, setTutorialLines] = useState([]);
  const [tutorialCanTry, setTutorialCanTry] = useState(false);
  const [tutorialFlash, setTutorialFlash] = useState(null);

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const timeoutsRef = useRef([]);
  const sessionSavedRef = useRef(false);
  const finalizingRef = useRef(false);
  const errorsRef = useRef(0);
  const latestRef = useRef({
    screen: "loading",
    config: null,
    nodes: [],
    currentTargetIndex: 0,
    errors: 0,
    elapsedMs: 0,
  });

  useEffect(() => {
    latestRef.current = {
      screen,
      config,
      nodes,
      currentTargetIndex,
      errors,
      elapsedMs,
    };
    errorsRef.current = errors;
  }, [config, currentTargetIndex, elapsedMs, errors, nodes, screen]);

  const scheduleTimeout = useCallback((callback, delay) => {
    const id = window.setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((timerId) => timerId !== id);
      callback();
    }, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  const clearRoundTimers = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
    timerRef.current = null;
    idleTimerRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = window.setInterval(() => {
      if (startTimeRef.current) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
    }, 250);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    setIdlePrompt(false);
    idleTimerRef.current = window.setTimeout(() => setIdlePrompt(true), 60000);
  }, []);

  const resetRoundState = useCallback(() => {
    clearRoundTimers();
    setCurrentTargetIndex(0);
    setCompletedNodes(new Set());
    setDrawnLines([]);
    setErrors(0);
    errorsRef.current = 0;
    setElapsedMs(0);
    setGamePhase("waiting");
    setFlashLabel(null);
    setIdlePrompt(false);
    setSessionResult(null);
    setSavingResult(false);
    setTutorialAnimating(false);
    setTutorialIndex(0);
    setTutorialCompleted(new Set());
    setTutorialLines([]);
    setTutorialCanTry(false);
    setTutorialFlash(null);
    startTimeRef.current = null;
    sessionSavedRef.current = false;
    finalizingRef.current = false;
  }, [clearRoundTimers]);

  const loadUserState = useCallback(async () => {
    const fallback = defaultUserState(userId);
    if (!userId) return fallback;

    const existing = await gameData
      .table("number_trails_user_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (existing.data) return existing.data;

    const created = await gameData
      .table("number_trails_user_state")
      .upsert(fallback, { onConflict: "user_id" })
      .single();

    if (created.error) throw created.error;
    return created.data ?? fallback;
  }, [userId]);

  const loadConfig = useCallback(async (state) => {
    if (!userId) return withFallbackTier(state?.current_tier, gameLanguage);

    const tier = Number(state?.current_tier ?? 1);
    const start = startOfLocalDay();
    const end = addDays(start, 1);
    const languageOrder = [...new Set([gameLanguage, "es", "en", "de"])];
    const recentConfigIds = readStorageArray(RECENT_CONFIGS_KEY);

    const todaySessions = await gameData
      .table("number_trails_sessions")
      .select("config_id")
      .eq("user_id", userId)
      .gte("played_at", start.toISOString())
      .lt("played_at", end.toISOString());

    if (todaySessions.error) throw todaySessions.error;
    const playedToday = (todaySessions.data ?? []).map((session) => session.config_id).filter(Boolean);

    for (const languageToUse of languageOrder) {
      let query = gameData
        .table("number_trails_configs")
        .select("*")
        .eq("difficulty_tier", tier)
        .eq("is_active", true)
        .eq("language", languageToUse)
        .limit(80);

      if (playedToday.length) {
        query = query.not("id", "in", `(${playedToday.join(",")})`);
      }

      const rows = await query;
      if (rows.error) throw rows.error;
      if (rows.data?.length) {
        const selected = pickFreshNumberTrailConfig(rows.data, recentConfigIds);
        rememberConfig(selected);
        return normalizeConfig(selected);
      }
    }

    const history = await gameData
      .table("number_trails_sessions")
      .select("config_id,played_at")
      .eq("user_id", userId)
      .eq("difficulty_tier", tier)
      .order("played_at", { ascending: false })
      .limit(500);

    if (history.error) throw history.error;

    const lastPlayed = new Map();
    for (const session of history.data ?? []) {
      if (session.config_id && !lastPlayed.has(session.config_id)) {
        lastPlayed.set(session.config_id, new Date(session.played_at).getTime());
      }
    }

    for (const languageToUse of languageOrder) {
      const rows = await gameData
        .table("number_trails_configs")
        .select("*")
        .eq("difficulty_tier", tier)
        .eq("is_active", true)
        .eq("language", languageToUse)
        .limit(80);

      if (rows.error) throw rows.error;
      if (!rows.data?.length) continue;

      const leastRecentRows = [...rows.data].sort((a, b) => (lastPlayed.get(a.id) ?? 0) - (lastPlayed.get(b.id) ?? 0));
      const selected = pickFreshNumberTrailConfig(leastRecentRows, recentConfigIds);
      rememberConfig(selected);
      return normalizeConfig(selected);
    }

    return withFallbackTier(tier, gameLanguage);
  }, [gameLanguage, userId]);

  const loadGame = useCallback(async (overrideState = null) => {
    resetRoundState();
    setScreen("loading");
    setLoadNote("");

    let attemptedState = overrideState;
    try {
      const state = overrideState ?? await loadUserState();
      attemptedState = state;
      const selectedConfig = await loadConfig(state);
      const normalized = normalizeConfig(selectedConfig);
      setUserState(state);
      setConfig(normalized);
      setNodes(normalized.nodes);
      setLoadNote(normalized.is_local_practice ? text.practiceNote : "");
      setScreen("intro");
    } catch (error) {
      console.warn("Number Trails is using a local practice trail.", error);
      const fallbackState = attemptedState ?? defaultUserState(userId);
      const fallbackConfig = withFallbackTier(fallbackState.current_tier, gameLanguage);
      setUserState(fallbackState);
      setConfig(fallbackConfig);
      setNodes(fallbackConfig.nodes);
      setLoadNote(text.practiceNote);
      setScreen("intro");
    }
  }, [gameLanguage, loadConfig, loadUserState, resetRoundState, text.practiceNote, userId]);

  const saveSession = useCallback(async (result) => {
    if (!userId || !config || sessionSavedRef.current) return null;
    sessionSavedRef.current = true;

    const payload = {
      user_id: userId,
      config_id: config.id ?? null,
      difficulty_tier: Number(config.difficulty_tier ?? 1),
      trail_type: config.trail_type,
      node_count: Number(config.node_count ?? nodes.length),
      nodes_correct: result.nodes_correct,
      nodes_total: result.nodes_total,
      errors: result.errors ?? 0,
      completion_time_ms: result.completion_time_ms,
      par_time_ms: result.par_time_ms,
      accuracy_pct: result.accuracy_pct,
      speed_pct: result.speed_pct,
      completed: result.completed,
      abandoned: result.abandoned,
      score: result.score,
    };

    const saved = await gameData.table("number_trails_sessions").insert(payload);
    if (saved.error) {
      console.warn("Number Trails could not save the session.", saved.error);
    }

    const savedSession = Array.isArray(saved.data) ? saved.data[0] : saved.data;
    await recordCognitiveSession({
      userId,
      activityType: "number_trails",
      domain: "processing_speed",
      secondaryDomain: "executive_function",
      difficulty: payload.difficulty_tier,
      difficultyScale: "tier",
      completed: result.completed,
      abandoned: result.abandoned,
      score: result.score,
      accuracyPct: result.combined_accuracy_pct,
      speedPct: result.speed_pct,
      durationSeconds: result.completion_time_ms ? Math.max(1, Math.round(result.completion_time_ms / 1000)) : 0,
      language: gameLanguage,
      source: "number_trails",
      sourceTable: "number_trails_sessions",
      sourceSessionId: savedSession?.id ?? null,
      metadata: {
        configId: config.id ?? null,
        trailType: config.trail_type,
        nodeCount: payload.node_count,
        nodesCorrect: result.nodes_correct,
        nodesTotal: result.nodes_total,
        errors: result.errors ?? 0,
        parTimeMs: result.par_time_ms,
      },
    });

    return saved.error ? null : savedSession;
  }, [config, gameLanguage, nodes.length, userId]);

  const updateUserState = useCallback(async (result) => {
    if (!userId || result.abandoned) return userState;

    const persistedState = await loadUserState().catch((error) => {
      console.warn("Number Trails could not refresh saved progress before updating.", error);
      return null;
    });
    const previous = persistedState ?? userState ?? defaultUserState(userId);
    const today = todayKey();
    const yesterday = todayKey(addDays(new Date(), -1));

    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    if (result.combined_accuracy_pct >= 75) {
      consecutiveWins = Number(previous.consecutive_wins ?? 0) + 1;
    } else if (result.combined_accuracy_pct < 45) {
      consecutiveLosses = Number(previous.consecutive_losses ?? 0) + 1;
    }

    let currentTier = Number(previous.current_tier ?? 1);
    let sessionsAtTier = Number(previous.sessions_at_tier ?? 0) + 1;

    if (consecutiveWins >= 3 && currentTier < BRAIN_COACH_MAX_LEVEL) {
      currentTier += 1;
      sessionsAtTier = 0;
      consecutiveWins = 0;
      consecutiveLosses = 0;
    } else if (consecutiveLosses >= 3 && currentTier > 1) {
      currentTier -= 1;
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

    const next = {
      ...previous,
      user_id: userId,
      current_tier: clamp(currentTier, 1, BRAIN_COACH_MAX_LEVEL),
      sessions_at_tier: sessionsAtTier,
      consecutive_wins: consecutiveWins,
      consecutive_losses: consecutiveLosses,
      total_sessions: Number(previous.total_sessions ?? 0) + 1,
      best_score: Math.max(Number(previous.best_score ?? 0), result.score),
      last_played_at: new Date().toISOString(),
      streak_days: streakDays,
      last_streak_date: today,
      updated_at: new Date().toISOString(),
    };

    setUserState(next);
    const updated = await gameData
      .table("number_trails_user_state")
      .upsert(next, { onConflict: "user_id" })
      .single();

    if (updated.data) {
      setUserState(updated.data);
      return updated.data;
    }

    if (updated.error) {
      console.warn("Number Trails could not save progress state.", updated.error);
    }

    return next;
  }, [loadUserState, userId, userState]);

  const finishRound = useCallback(async (abandoned = false, overrideCorrect = null, overrideCompletionMs = null) => {
    if (finalizingRef.current) return null;
    finalizingRef.current = true;
    stopTimer();
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;

    const currentConfig = config ?? FALLBACK_CONFIG;
    const totalNodes = nodes.length || Number(currentConfig.node_count ?? 0);
    const correctCount = overrideCorrect ?? currentTargetIndex;
    const completionMs = abandoned
      ? (startTimeRef.current ? Math.max(1, Date.now() - startTimeRef.current) : null)
      : overrideCompletionMs;
    const parMs = Number(currentConfig.par_time_seconds ?? 30) * 1000;
    const result = {
      ...computeScore(correctCount, totalNodes, completionMs, parMs, abandoned),
      config_id: currentConfig.id ?? null,
      difficulty_tier: Number(currentConfig.difficulty_tier ?? 1),
      trail_type: currentConfig.trail_type,
      node_count: totalNodes,
      errors: errorsRef.current,
    };

    if (abandoned) {
      await saveSession(result);
      return result;
    }

    setSavingResult(true);
    setSessionResult(result);
    await saveSession(result);
    const nextState = await updateUserState(result);
    setSessionResult({ ...result, userState: nextState });
    onAssessmentPracticeComplete?.({
      score: result.score,
      accuracyPct: result.combined_accuracy_pct,
      practiceTitle: assessmentPractice?.practiceTitle,
    });
    setScreen("result");
    setSavingResult(false);
    return result;
  }, [assessmentPractice, config, currentTargetIndex, nodes.length, onAssessmentPracticeComplete, saveSession, stopTimer, updateUserState]);

  const saveAbandonedSnapshot = useCallback(async () => {
    const latest = latestRef.current;
    if (sessionSavedRef.current || finalizingRef.current || latest.screen !== "playing") return;
    if (!userId || !latest.config) return;

    const totalNodes = latest.nodes.length || Number(latest.config.node_count ?? 0);
    const completionMs = startTimeRef.current ? Math.max(1, Date.now() - startTimeRef.current) : null;
    const result = {
      ...computeScore(latest.currentTargetIndex, totalNodes, completionMs, Number(latest.config.par_time_seconds ?? 30) * 1000, true),
      errors: latest.errors,
    };

    sessionSavedRef.current = true;
    const payload = {
      user_id: userId,
      config_id: latest.config.id ?? null,
      difficulty_tier: Number(latest.config.difficulty_tier ?? 1),
      trail_type: latest.config.trail_type,
      node_count: totalNodes,
      nodes_correct: result.nodes_correct,
      nodes_total: result.nodes_total,
      errors: result.errors,
      completion_time_ms: result.completion_time_ms,
      par_time_ms: result.par_time_ms,
      accuracy_pct: result.accuracy_pct,
      speed_pct: result.speed_pct,
      completed: false,
      abandoned: true,
      score: 0,
    };
    const saved = await gameData.table("number_trails_sessions").insert(payload);
    const savedSession = Array.isArray(saved.data) ? saved.data[0] : saved.data;

    await recordCognitiveSession({
      userId,
      activityType: "number_trails",
      domain: "processing_speed",
      secondaryDomain: "executive_function",
      difficulty: payload.difficulty_tier,
      difficultyScale: "tier",
      completed: false,
      abandoned: true,
      score: 0,
      accuracyPct: result.combined_accuracy_pct,
      speedPct: result.speed_pct,
      durationSeconds: result.completion_time_ms ? Math.max(1, Math.round(result.completion_time_ms / 1000)) : 0,
      language: gameLanguage,
      source: "number_trails",
      sourceTable: "number_trails_sessions",
      sourceSessionId: savedSession?.id ?? null,
      metadata: {
        configId: latest.config.id ?? null,
        trailType: latest.config.trail_type,
        nodeCount: totalNodes,
        nodesCorrect: result.nodes_correct,
        nodesTotal: result.nodes_total,
        errors: result.errors ?? 0,
        parTimeMs: result.par_time_ms,
      },
    });
  }, [computeScore, gameLanguage, userId]);

  useEffect(() => {
    void loadGame();
    return () => {
      clearRoundTimers();
    };
  }, [clearRoundTimers, loadGame]);

  useEffect(() => {
    return () => {
      void saveAbandonedSnapshot();
    };
  }, [saveAbandonedSnapshot]);

  useEffect(() => {
    if (screen !== "tutorial") return undefined;

    setTutorialAnimating(true);
    setTutorialCanTry(false);
    setTutorialIndex(0);
    setTutorialCompleted(new Set());
    setTutorialLines([]);

    let index = 0;
    const interval = window.setInterval(() => {
      const node = TUTORIAL_NODES[index];
      setTutorialCompleted((previous) => new Set([...previous, node.label]));
      if (index > 0) {
        setTutorialLines((previous) => [...previous, { from: TUTORIAL_NODES[index - 1], to: node }]);
      }
      setTutorialIndex(index);
      index += 1;

      if (index >= TUTORIAL_NODES.length) {
        window.clearInterval(interval);
        scheduleTimeout(() => {
          setTutorialAnimating(false);
          setTutorialCanTry(true);
          setTutorialIndex(0);
          setTutorialCompleted(new Set());
          setTutorialLines([]);
        }, 700);
      }
    }, 650);

    return () => window.clearInterval(interval);
  }, [scheduleTimeout, screen]);

  const beginPlaying = useCallback(() => {
    setCurrentTargetIndex(0);
    setCompletedNodes(new Set());
    setDrawnLines([]);
    setErrors(0);
    errorsRef.current = 0;
    setElapsedMs(0);
    setGamePhase("waiting");
    setFlashLabel(null);
    setIdlePrompt(false);
    setSessionResult(null);
    setSavingResult(false);
    startTimeRef.current = null;
    sessionSavedRef.current = false;
    finalizingRef.current = false;
    setScreen("playing");
    resetIdleTimer();
  }, [resetIdleTimer]);

  const rememberTutorialSeen = useCallback(() => {
    saveTutorialSeen();
    setTutorialSeen(true);
  }, []);

  const handleStartTrail = useCallback(() => {
    if (tutorialSeen) {
      beginPlaying();
      return;
    }
    setScreen("tutorial");
  }, [beginPlaying, tutorialSeen]);

  const handleSkipTutorial = useCallback(() => {
    rememberTutorialSeen();
    beginPlaying();
  }, [beginPlaying, rememberTutorialSeen]);

  const replayCurrentTrail = useCallback(() => {
    if (!config?.nodes?.length) {
      void loadGame(userState);
      return;
    }

    resetRoundState();
    setConfig(config);
    setNodes(config.nodes);
    setLoadNote(config.is_local_practice ? text.practiceNote : "");
    setScreen("intro");
  }, [config, loadGame, resetRoundState, text.practiceNote, userState]);

  const handleNodeTap = useCallback((node) => {
    if (gamePhase === "complete" || savingResult || !nodes.length) return;
    const expectedNode = nodes[currentTargetIndex];
    if (!expectedNode) return;

    resetIdleTimer();
    if (!startTimeRef.current) startTimer();
    setGamePhase("playing");

    if (node.label !== expectedNode.label) {
      errorsRef.current += 1;
      setErrors(errorsRef.current);
      setFlashLabel(node.label);
      scheduleTimeout(() => setFlashLabel(null), 300);
      return;
    }

    const nextIndex = currentTargetIndex + 1;
    setCompletedNodes((previous) => new Set([...previous, node.label]));
    if (currentTargetIndex > 0) {
      setDrawnLines((previous) => [...previous, { from: nodes[currentTargetIndex - 1], to: node }]);
    }
    setCurrentTargetIndex(nextIndex);

    if (nextIndex >= nodes.length) {
      setGamePhase("complete");
      const completionMs = Math.max(1, Date.now() - (startTimeRef.current ?? Date.now()));
      setElapsedMs(completionMs);
      void finishRound(false, nextIndex, completionMs);
    }
  }, [currentTargetIndex, finishRound, gamePhase, nodes, resetIdleTimer, savingResult, scheduleTimeout, startTimer]);

  const handleTutorialTap = useCallback((node) => {
    if (!tutorialCanTry || tutorialAnimating) return;
    const expected = TUTORIAL_NODES[tutorialIndex];
    if (!expected) return;

    if (node.label !== expected.label) {
      setTutorialFlash(node.label);
      scheduleTimeout(() => setTutorialFlash(null), 300);
      return;
    }

    const nextIndex = tutorialIndex + 1;
    setTutorialCompleted((previous) => new Set([...previous, node.label]));
    if (tutorialIndex > 0) {
      setTutorialLines((previous) => [...previous, { from: TUTORIAL_NODES[tutorialIndex - 1], to: node }]);
    }
    setTutorialIndex(nextIndex);

    if (nextIndex >= TUTORIAL_NODES.length) {
      scheduleTimeout(() => {
        rememberTutorialSeen();
        beginPlaying();
      }, 1000);
    }
  }, [beginPlaying, rememberTutorialSeen, scheduleTimeout, tutorialAnimating, tutorialCanTry, tutorialIndex]);

  const handleExit = useCallback(async () => {
    if (screen === "playing") {
      await finishRound(true);
    }
    onExit?.();
  }, [finishRound, onExit, screen]);

  const trailTypeLabel = config?.trail_type === "alternating" ? text.badgeAlternating : text.badgeNumeric;
  const nextNode = nodes[currentTargetIndex] ?? null;
  const progress = nodes.length ? currentTargetIndex / nodes.length : 0;
  const parSeconds = Number(config?.par_time_seconds ?? 30);
  const currentTier = Number(config?.difficulty_tier ?? userState?.current_tier ?? 1);
  const currentTierBand = getBrainCoachLevelBand(currentTier);

  if (screen === "loading") {
    return (
      <BrainCoachLoadingState
        title={text.title}
        label={text.preparing}
        testId="number-trails-flow-shell"
        presentationId="brain_coach.activity_session.improve_thinking.number_trails.loading.touch"
        sceneId="brain_coach.activity_session.improve_thinking.number_trails"
      />
    );
  }

  if (screen === "intro") {
    const instruction = config?.trail_type === "alternating"
      ? text.instructionAlt
      : formatTemplate(text.instruction, { n: nodes[nodes.length - 1]?.label ?? nodes.length });

    return (
      <BrainCoachActivityShell
        title={text.title}
        backLabel={text.exit}
        onBack={handleExit}
        testId="number-trails-flow-shell"
        presentationId="brain_coach.activity_session.improve_thinking.number_trails.intro.touch"
        sceneId="brain_coach.activity_session.improve_thinking.number_trails"
        sceneKind="intro"
        sceneLayout="trail_preview"
      >
        <main className="pb-6" data-testid="number-trails-intro">
        <div className="mx-auto flex w-full max-w-[780px] flex-col gap-5">
          <section className="rounded-[28px] border bg-white p-6 shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="flex flex-col items-center text-center">
              <p className="text-[24px] font-bold leading-[1.3]" style={{ color: BRAND.muted }}>{text.subtitle}</p>

              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <span className="rounded-full px-5 py-3 text-[22px] font-extrabold" style={{ background: "#FEF3C7", color: "#92400E" }}>
                  {text.level} {currentTier} - {currentTierBand.label}
                </span>
                <span className="rounded-full px-5 py-3 text-[22px] font-extrabold" style={{ background: BRAND.tealPale, color: BRAND.teal }}>
                  {trailTypeLabel}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <TrailCanvas
                nodes={nodes}
                completedLabels={new Set()}
                lines={[]}
                mode="preview"
              />
            </div>

            {loadNote && <p className="mt-4 text-center text-[22px] font-semibold" style={{ color: BRAND.muted }}>{loadNote}</p>}

            <button
              type="button"
              onClick={handleStartTrail}
              className="mt-6 flex min-h-[72px] w-full items-center justify-center gap-3 rounded-full px-6 text-[24px] font-extrabold text-white shadow-vyva-hero active:scale-[0.99]"
              style={{ background: BRAND.purple }}
            >
              <Play size={30} />
              {text.start}
            </button>

            <p className="mt-5 text-center text-[24px] font-semibold leading-[1.35]" style={{ color: BRAND.ink }}>
              {instruction}
            </p>
          </section>
        </div>
        </main>
      </BrainCoachActivityShell>
    );
  }

  if (screen === "tutorial") {
    const tutorialNext = tutorialAnimating ? TUTORIAL_NODES[tutorialIndex]?.label : TUTORIAL_NODES[tutorialIndex]?.label;
    const handNode = tutorialAnimating ? TUTORIAL_NODES[tutorialIndex] : null;

    return (
      <BrainCoachActivityShell
        title={text.title}
        backLabel={text.exit}
        onBack={handleExit}
        testId="number-trails-flow-shell"
        presentationId="brain_coach.activity_session.improve_thinking.number_trails.tutorial.touch"
        sceneId="brain_coach.activity_session.improve_thinking.number_trails"
        sceneKind="tutorial"
        sceneLayout="trail_example"
      >
        <main className="pb-6">
        <div className="mx-auto flex w-full max-w-[780px] flex-col gap-5">
          <div className="flex items-center justify-between gap-4 rounded-[24px] border bg-white p-4 shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <h1 className="text-[26px] font-extrabold leading-[1.15]" style={{ color: BRAND.ink }}>{text.example}</h1>
            <button
              type="button"
              onClick={handleSkipTutorial}
              className="min-h-[64px] rounded-full border-2 bg-white px-5 text-[22px] font-extrabold"
              style={{ borderColor: BRAND.border, color: BRAND.purple }}
            >
              {text.skip}
            </button>
          </div>

          <section className="rounded-[28px] border bg-white p-5 shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <TrailCanvas
              nodes={TUTORIAL_NODES}
              completedLabels={tutorialCompleted}
              lines={tutorialLines}
              nextLabel={tutorialNext}
              flashLabel={tutorialFlash}
              onNodeTap={tutorialCanTry ? handleTutorialTap : null}
              mode="tutorial"
              handNode={handNode}
            />

            <div className="mt-5 rounded-[20px] px-4 py-4 text-center text-[24px] font-extrabold leading-[1.2]" style={{ background: "#FFF7ED", color: "#92400E" }}>
              {text.tapInOrder}
            </div>
          </section>
        </div>
        </main>
      </BrainCoachActivityShell>
    );
  }

  if (screen === "playing") {
    return (
      <BrainCoachActivityShell
        title={text.title}
        backLabel={text.exit}
        onBack={handleExit}
        testId="number-trails-flow-shell"
        presentationId="brain_coach.activity_session.improve_thinking.number_trails.playing.touch"
        sceneId="brain_coach.activity_session.improve_thinking.number_trails"
        sceneKind="playing"
        sceneLayout="trail_canvas"
      >
        <main className="pb-6">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4">
          <header className="rounded-[24px] border bg-white p-4 shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="flex items-center justify-center gap-3 text-[24px] font-extrabold" style={{ color: BRAND.purple }}>
              <Timer size={30} />
              <span>{formatClock(elapsedMs)}</span>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#F0E7F8]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress * 100}%`, background: BRAND.gold }}
              />
            </div>
          </header>

          <TrailCanvas
            nodes={nodes}
            completedLabels={completedNodes}
            lines={drawnLines}
            nextLabel={nextNode?.label}
            flashLabel={flashLabel}
            onNodeTap={handleNodeTap}
            mode="playing"
          />

          <footer className="rounded-[24px] border bg-white px-5 py-4 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <p className="text-[24px] font-extrabold leading-[1.25]" style={{ color: BRAND.ink }}>
              {formatTemplate(text.nextTarget, { label: nextNode?.label ?? "-" })}
            </p>
            {idlePrompt && (
              <p className="mt-2 text-[22px] font-bold leading-[1.3]" style={{ color: BRAND.muted }}>
                {text.stillThere}
              </p>
            )}
          </footer>
        </div>
        </main>
      </BrainCoachActivityShell>
    );
  }

  const result = sessionResult;
  const resultState = result?.userState ?? userState ?? defaultUserState(userId);
  const score = result?.score ?? 0;
  const resultIsGood = score >= 600;
  const completionSeconds = wholeSeconds(result?.completion_time_ms);
  const fasterThanPar = result?.completion_time_ms && result.completion_time_ms <= result.par_time_ms;
  const completedTier = currentTier;
  const resultTier = Number(resultState.current_tier ?? completedTier);
  const resultWasPromoted = resultTier > completedTier;
  const continueLabel = resultWasPromoted
    ? text.continueToLevel.replace("{level}", String(resultTier))
    : text.nextTrail;
  const resultTierBand = getBrainCoachLevelBand(resultTier);
  const nextTier = clamp(resultTier + 1, 1, BRAIN_COACH_MAX_LEVEL);
  const resultProgressSummary = resultWasPromoted
    ? getBrainCoachSupportiveProgressCopy({ advanced: true, level: completedTier })
    : resultIsGood
      ? `${formatTemplate(text.completedIn, { n: completionSeconds })} | ${formatTemplate(text.parTime, { n: parSeconds })}`
      : getBrainCoachSupportiveProgressCopy({ advanced: false, level: completedTier });
  const promotionProgress = clamp(Number(resultState.consecutive_wins ?? 0) / 3, 0, 1);

  return (
    <BrainCoachActivityShell
      title={text.title}
      backLabel={text.exit}
      onBack={handleExit}
      showHeader={false}
      testId="number-trails-flow-shell"
      presentationId="brain_coach.activity_session.improve_thinking.number_trails.result.touch"
      sceneId="brain_coach.activity_session.improve_thinking.number_trails"
      sceneKind="completion"
      sceneLayout="modal_actions"
      state="complete"
    >
      <div className="min-h-[100dvh]" style={{ background: BRAND.bg }}>
        <BrainGameCompletionDialog
          title={resultIsGood ? text.resultGood : text.resultTry}
          summary={resultProgressSummary}
          metrics={[
            { label: text.accuracy, value: `${Math.round(result?.accuracy_pct ?? 0)}%` },
            { label: text.speed, value: `${Math.round(result?.speed_pct ?? 0)}%` },
            { label: text.score, value: score },
            { label: text.streak, value: `${resultState.streak_days ?? 0} ${text.days}` },
          ]}
          continueLabel={continueLabel}
          replayLabel={text.tryThisTrail}
          anotherLabel={text.playAnotherGame}
          assessmentReturnLabel={assessmentPractice ? t("brainGames.resultActions.backToResults", "Back to my results") : undefined}
          assessmentReturnHint={
            assessmentPractice
              ? t("brainGames.resultActions.assessmentPracticeComplete", "Good. You practiced the area VYVA noticed.")
              : undefined
          }
          onContinue={() => loadGame(resultState)}
          onReplay={replayCurrentTrail}
          onAnother={handleExit}
          onAssessmentReturn={assessmentPractice ? onAssessmentPracticeReturn : undefined}
          disabled={savingResult}
          details={
            <div className="grid gap-3">
              <div className="rounded-[18px] border border-[#EADFF8] bg-[#FFF9F1] px-4 py-3 text-center">
                <p className="text-[15px] font-extrabold text-vyva-text-1">
                  {formatTemplate(text.completedIn, { n: completionSeconds })}
                  <span> | </span>
                  {formatTemplate(text.parTime, { n: parSeconds })}
                </p>
                {fasterThanPar && (
                  <p className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-[#FEF3C7] px-4 py-2 text-[15px] font-black text-[#92400E]">
                    <Zap size={18} />
                    {text.fasterThanPar}
                  </p>
                )}
                <p className="mt-2 text-[14px] font-bold text-vyva-text-2">
                  {text.level} {resultTier} - {resultTierBand.label}
                </p>
              </div>
              {!resultWasPromoted && (
                <div className="rounded-[18px] border border-[#EADFF8] bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-[15px] font-black text-vyva-text-1">
                    <span>{formatTemplate(text.nextLevel, { n: nextTier })}</span>
                    <span>{Math.round(promotionProgress * 3)}/3</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#EDE6F4]">
                    <div className="h-full rounded-full bg-vyva-gold" style={{ width: `${promotionProgress * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          }
        />
      </div>

      <style>{`
        .nt-node {
          touch-action: manipulation;
        }

        .nt-node-next {
          animation: nt-next-pulse 1.5s ease-in-out infinite;
        }

        .nt-node-flash {
          animation: nt-flash 0.3s ease-out;
        }

        .nt-hand-pointer {
          animation: nt-hand-tap 0.65s ease-in-out infinite;
        }

        @keyframes nt-next-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.08); }
        }

        @keyframes nt-flash {
          0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.75); }
          100% { box-shadow: 0 0 0 7px rgba(220, 38, 38, 0); }
        }

        @keyframes nt-hand-tap {
          0%, 100% { transform: translate(-18%, -12%) scale(1); }
          50% { transform: translate(-18%, -12%) scale(0.92); }
        }

        @media (prefers-reduced-motion: reduce) {
          .nt-node-next,
          .nt-node-flash,
          .nt-hand-pointer {
            animation: none;
          }
        }
      `}</style>
    </BrainCoachActivityShell>
  );
}
