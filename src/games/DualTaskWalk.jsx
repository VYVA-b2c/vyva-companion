import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Eye,
} from "lucide-react";
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

const SYMBOLS = ["★", "●", "▲", "■", "♦"];
const BRAND = {
  purple: "#6B21A8",
  gold: "#F59E0B",
  bg: "#FAF9F6",
  ink: "#2B2233",
  softPurple: "#F3E8FF",
  border: "#E7D8F3",
};

const DEMO_SEQUENCE = {
  id: "demo",
  start_number: 51,
  expected_answers: [44, 37, 30],
  symbol_stream: ["★", "●", "★", "★", "▲", "●"],
  match_indices: [3],
  symbol_count: 6,
  match_count: 1,
  round_duration_ms: 12000,
  difficulty_tier: 1,
  language: "es",
};

const FALLBACK_SEQUENCE = {
  id: null,
  start_number: 58,
  expected_answers: [51, 44, 37, 30],
  symbol_stream: ["▲", "★", "●", "★", "★", "▲", "●", "●", "★", "▲"],
  match_indices: [4, 7],
  symbol_count: 10,
  match_count: 2,
  round_duration_ms: 30000,
  difficulty_tier: 1,
  language: "es",
};

const DUAL_TASK_TUTORIAL_KEY = "dualTaskWalk:tutorialSeen:v1";

function tutorialStorageKey(userId) {
  return userId ? `${DUAL_TASK_TUTORIAL_KEY}:${userId}` : DUAL_TASK_TUTORIAL_KEY;
}

function readTutorialSeen(userId) {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(tutorialStorageKey(userId)) === "true";
  } catch {
    return false;
  }
}

function writeTutorialSeen(userId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tutorialStorageKey(userId), "true");
  } catch {
    // Tutorial persistence is helpful, but the exercise should still work.
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function getTodayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getTodayKey(yesterday);
}

function getStartOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function getDefaultUserState(userId) {
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
  };
}

function normalizeSequence(row) {
  const expectedAnswers = asArray(row.expected_answers).map(Number);
  const symbolStream = asArray(row.symbol_stream).map(String);
  const matchIndices = asArray(row.match_indices).map(Number);

  return {
    ...row,
    expected_answers: expectedAnswers,
    symbol_stream: symbolStream,
    match_indices: matchIndices,
    symbol_count: Number(row.symbol_count ?? symbolStream.length),
    match_count: Number(row.match_count ?? matchIndices.length),
    round_duration_ms: Number(row.round_duration_ms ?? 30000),
    difficulty_tier: Number(row.difficulty_tier ?? 1),
  };
}

function getTapStats(tapLog, sequence) {
  const hits = tapLog.filter((entry) => entry.wasMatch && entry.tapped).length;
  const misses = tapLog.filter((entry) => entry.wasMatch && !entry.tapped).length;
  const falsePositives = tapLog.filter((entry) => !entry.wasMatch && entry.tapped).length;
  const precision = hits / Math.max(1, hits + falsePositives);
  const recall = hits / Math.max(1, sequence.match_count);
  const f1 = (2 * precision * recall) / Math.max(0.001, precision + recall);

  return {
    hits,
    misses,
    falsePositives,
    f1,
    accuracyPct: Math.round(f1 * 10000) / 100,
  };
}

function NumberPicker({ value, min, max, onChange, ariaLabel, increaseLabel, decreaseLabel }) {
  const safeValue = Number.isFinite(value) ? value : min;
  const setNext = (nextValue) => onChange(clamp(nextValue, min, max));
  const visible = [clamp(safeValue + 1, min, max), safeValue, clamp(safeValue - 1, min, max)];

  return (
    <div
      className="grid w-[118px] grid-rows-[44px_56px_44px] overflow-hidden rounded-[22px] border bg-white sm:w-[178px] sm:grid-rows-[64px_76px_64px]"
      style={{ borderColor: BRAND.border }}
      onWheel={(event) => {
        event.preventDefault();
        setNext(safeValue + (event.deltaY > 0 ? -1 : 1));
      }}
      aria-label={ariaLabel}
      role="spinbutton"
      aria-valuenow={safeValue}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      <button
        type="button"
        onClick={() => setNext(safeValue + 1)}
        className="flex min-h-[44px] items-center justify-center text-[22px] font-semibold sm:min-h-[64px] sm:text-[26px]"
        style={{ color: BRAND.purple }}
        aria-label={increaseLabel}
      >
        <ChevronUp size={30} />
      </button>
      <div className="grid grid-rows-3 text-center">
        <div className="text-[18px] leading-[17px] text-[#7C6D94] sm:text-[24px] sm:leading-[22px]">{visible[0] === safeValue ? "" : visible[0]}</div>
        <div className="text-[30px] font-bold leading-[22px] sm:text-[38px] sm:leading-[32px]" style={{ color: BRAND.ink }}>
          {safeValue}
        </div>
        <div className="text-[18px] leading-[17px] text-[#7C6D94] sm:text-[24px] sm:leading-[22px]">{visible[2] === safeValue ? "" : visible[2]}</div>
      </div>
      <button
        type="button"
        onClick={() => setNext(safeValue - 1)}
        className="flex min-h-[44px] items-center justify-center text-[22px] font-semibold sm:min-h-[64px] sm:text-[26px]"
        style={{ color: BRAND.purple }}
        aria-label={decreaseLabel}
      >
        <ChevronDown size={30} />
      </button>
    </div>
  );
}

export default function DualTaskWalk({ userId, onExit }) {
  const { language, t } = useLanguage();
  const lang = normalizeGameLanguage(language);
  const text = useMemo(() => ({
    loading: t("brainGames.dualTask.loading"),
    back: t("common.back"),
    title: t("brainGames.dualTask.title"),
    subtitle: t("brainGames.dualTask.subtitle"),
    level: t("common.level"),
    example: t("brainGames.dualTask.example"),
    countBack: t("brainGames.dualTask.countBack"),
    tapMatch: t("brainGames.dualTask.tapMatch"),
    tutorialTitle: t("brainGames.dualTask.tutorialTitle"),
    skip: t("brainGames.dualTask.skip"),
    start: t("brainGames.dualTask.start"),
    startAt: t("brainGames.dualTask.startAt"),
    previousSymbol: t("brainGames.dualTask.previousSymbol"),
    sameSymbol: t("brainGames.dualTask.sameSymbol"),
    tapHere: t("brainGames.dualTask.tapHere"),
    exit: t("brainGames.dualTask.exit"),
    confirm: t("brainGames.dualTask.confirm"),
    step: t("brainGames.dualTask.step"),
    of: t("brainGames.dualTask.of"),
    question: t("brainGames.dualTask.question"),
    recent: t("brainGames.dualTask.recent"),
    hits: t("brainGames.dualTask.hits"),
    almost: t("brainGames.dualTask.almost"),
    visualDone: t("brainGames.dualTask.visualDone"),
    resultGreat: t("brainGames.dualTask.resultGreat"),
    resultGood: t("brainGames.dualTask.resultGood"),
    mathTask: t("brainGames.dualTask.mathTask"),
    visualTask: t("brainGames.dualTask.visualTask"),
    totalScore: t("brainGames.dualTask.totalScore"),
    streak: t("brainGames.dualTask.streak"),
    days: t("brainGames.dualTask.days"),
    mathLine: t("brainGames.dualTask.mathLine"),
    visualLine: t("brainGames.dualTask.visualLine"),
    keepGoing: t("brainGames.dualTask.keepGoing"),
    newLevel: t("brainGames.dualTask.newLevel"),
    continueAction: t("brainGames.resultActions.continue"),
    continueToLevel: t("brainGames.resultActions.continueToLevel"),
    playAgain: t("brainGames.resultActions.playAgain"),
    playAnotherGame: t("brainGames.resultActions.playAnotherGame"),
    increaseNumber: t("brainGames.dualTask.increaseNumber"),
    decreaseNumber: t("brainGames.dualTask.decreaseNumber"),
    tutorialNumber: t("brainGames.dualTask.tutorialNumber"),
    mathAnswer: t("brainGames.dualTask.mathAnswer"),
    instructions: t("brainGames.dualTask.instructions", "Instructions"),
    tutorialUnderstand: t("brainGames.dualTask.tutorialUnderstand", "I understand"),
    tutorialCount: t("brainGames.dualTask.tutorialCount", "Count back"),
    tutorialWatch: t("brainGames.dualTask.tutorialWatch", "Watch symbols"),
    tutorialTap: t("brainGames.dualTask.tutorialTap", "Tap repeats"),
  }), [t]);

  const [screen, setScreen] = useState("loading");
  const [sequence, setSequence] = useState(null);
  const [userState, setUserState] = useState(null);
  const [tutorialSeen, setTutorialSeen] = useState(() => readTutorialSeen(userId));
  const [tutorialReturnScreen, setTutorialReturnScreen] = useState("intro");

  const [serial7sStep, setSerial7sStep] = useState(0);
  const [pickerValue, setPickerValue] = useState(0);
  const [pickerTouched, setPickerTouched] = useState(false);
  const [serial7sLog, setSerial7sLog] = useState([]);
  const [serialFeedback, setSerialFeedback] = useState(null);

  const [symbolIndex, setSymbolIndex] = useState(0);
  const [tapLog, setTapLog] = useState([]);
  const [lastTapResult, setLastTapResult] = useState(null);
  const [symbolsComplete, setSymbolsComplete] = useState(false);

  const [roundProgress, setRoundProgress] = useState(1);
  const [sessionResult, setSessionResult] = useState(null);

  const symbolIntervalRef = useRef(null);
  const roundTimerRef = useRef(null);
  const tapWindowRef = useRef(false);
  const roundStartedAtRef = useRef(null);
  const sequenceRef = useRef(null);
  const symbolIndexRef = useRef(0);
  const symbolsCompleteRef = useRef(false);
  const serial7sStepRef = useRef(0);
  const serial7sLogRef = useRef([]);
  const tapLogRef = useRef([]);
  const finalizingRef = useRef(false);
  const screenRef = useRef("loading");
  const userStateRef = useRef(null);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    sequenceRef.current = sequence;
  }, [sequence]);

  useEffect(() => {
    userStateRef.current = userState;
  }, [userState]);

  const currentSequence = sequence ?? FALLBACK_SEQUENCE;
  const expectedAnswers = currentSequence.expected_answers;
  const symbolStream = currentSequence.symbol_stream;
  const matchIndices = currentSequence.match_indices;
  const serialSteps = expectedAnswers.length;
  const currentMinuend = serial7sStep === 0 ? currentSequence.start_number : expectedAnswers[serial7sStep - 1];
  const currentSymbol = symbolStream[Math.min(symbolIndex, Math.max(0, symbolStream.length - 1))] ?? SYMBOLS[0];
  const previousSymbol = symbolIndex > 0 ? symbolStream[symbolIndex - 1] : "—";
  const isCurrentMatch = symbolIndex > 0 && matchIndices.includes(symbolIndex);
  const pickerMin = currentSequence.start_number - Math.max(50, serialSteps * 7 + 5);
  const pickerMax = currentSequence.start_number + 50;

  const computeScore = useCallback((mathLog, visualLog, seq, abandoned = false) => {
    const steps = seq.expected_answers.length;
    const serial7sAttempts = mathLog.length;
    const serial7sCorrect = mathLog.filter((entry) => entry.correct).length;
    const serial7sAccuracyPct = serial7sAttempts === 0 ? 0 : Math.round((serial7sCorrect / serial7sAttempts) * 10000) / 100;
    const serial7sScore = (serial7sCorrect / Math.max(1, steps)) * 400;

    const tapStats = getTapStats(visualLog, seq);
    const shownSymbols = symbolsCompleteRef.current ? seq.symbol_count : Math.min(seq.symbol_count, symbolIndexRef.current + 1);
    const bothAttempted = serial7sAttempts >= steps * 0.5 && shownSymbols >= seq.symbol_count * 0.5;
    const completionBonus = bothAttempted ? 200 : 0;
    const dualTaskScore = Math.round(serial7sScore + tapStats.f1 * 400 + completionBonus);
    const combinedAccuracyPct = Math.round(((serial7sAccuracyPct + tapStats.accuracyPct) / 2) * 100) / 100;

    return {
      sequence_id: seq.id,
      difficulty_tier: seq.difficulty_tier,
      serial7s_attempts: serial7sAttempts,
      serial7s_correct: serial7sCorrect,
      serial7s_accuracy_pct: serial7sAccuracyPct,
      tap_hits: tapStats.hits,
      tap_misses: tapStats.misses,
      tap_false_positives: tapStats.falsePositives,
      tap_accuracy_pct: tapStats.accuracyPct,
      dual_task_score: clamp(dualTaskScore, 0, 1000),
      combined_accuracy_pct: combinedAccuracyPct,
      completed: !abandoned && serial7sAttempts >= steps && shownSymbols >= seq.symbol_count,
      abandoned,
      duration_seconds: roundStartedAtRef.current ? Math.max(1, Math.round((Date.now() - roundStartedAtRef.current) / 1000)) : 0,
      serial7s_log: mathLog,
      tap_log: visualLog,
    };
  }, []);

  const loadUserState = useCallback(async () => {
    const fallback = getDefaultUserState(userId);
    if (!userId) return fallback;

    const existing = await gameData
      .table("dual_task_user_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing.data) return existing.data;
    if (existing.error) throw new Error(existing.error.message);

    const created = await gameData
      .table("dual_task_user_state")
      .upsert(fallback, { onConflict: "user_id" })
      .select("*")
      .single();

    if (created.error) throw new Error(created.error.message);
    return created.data ?? fallback;
  }, [userId]);

  const loadSequence = useCallback(async (state) => {
    const tier = state?.current_tier ?? 1;
    const languageOrder = [...new Set([normalizeGameLanguage(lang), "es", "en", "de"])];
    let sequences = [];

    for (const languageToUse of languageOrder) {
      const rows = await gameData
        .table("dual_task_sequences")
        .select("*")
        .eq("difficulty_tier", tier)
        .eq("is_active", true)
        .eq("language", languageToUse);

      if (rows.error) throw new Error(rows.error.message);
      sequences = (rows.data ?? []).map(normalizeSequence);
      if (sequences.length > 0) break;
    }

    if (sequences.length === 0) throw new Error("No Dual Task Walk sequences are available.");

    const todaySessions = userId
      ? await gameData
          .table("dual_task_sessions")
          .select("sequence_id,played_at")
          .eq("user_id", userId)
          .gte("played_at", getStartOfTodayIso())
      : { data: [], error: null };

    const usedToday = new Set((todaySessions.data ?? []).map((entry) => entry.sequence_id).filter(Boolean));
    const unusedToday = sequences.filter((entry) => !usedToday.has(entry.id));
    if (unusedToday.length > 0) return shuffle(unusedToday)[0];

    const allSessions = userId
      ? await gameData
          .table("dual_task_sessions")
          .select("sequence_id,played_at")
          .eq("user_id", userId)
      : { data: [], error: null };

    const lastPlayed = new Map();
    (allSessions.data ?? []).forEach((entry) => {
      if (!entry.sequence_id || !entry.played_at) return;
      const previous = lastPlayed.get(entry.sequence_id);
      if (!previous || new Date(entry.played_at) > new Date(previous)) {
        lastPlayed.set(entry.sequence_id, entry.played_at);
      }
    });

    return [...sequences].sort((a, b) => {
      const aTime = lastPlayed.get(a.id) ? new Date(lastPlayed.get(a.id)).getTime() : 0;
      const bTime = lastPlayed.get(b.id) ? new Date(lastPlayed.get(b.id)).getTime() : 0;
      return aTime - bTime;
    })[0];
  }, [lang, userId]);

  const saveSession = useCallback(async (result) => {
    if (!userId) return;

    const payload = {
      user_id: userId,
      sequence_id: result.sequence_id,
      difficulty_tier: result.difficulty_tier,
      serial7s_attempts: result.serial7s_attempts,
      serial7s_correct: result.serial7s_correct,
      serial7s_accuracy_pct: result.serial7s_accuracy_pct,
      tap_hits: result.tap_hits,
      tap_misses: result.tap_misses,
      tap_false_positives: result.tap_false_positives,
      tap_accuracy_pct: result.tap_accuracy_pct,
      dual_task_score: result.dual_task_score,
      completed: result.completed,
      abandoned: result.abandoned,
      duration_seconds: result.duration_seconds,
    };
    const { data } = await gameData.table("dual_task_sessions").insert(payload);
    const savedSession = Array.isArray(data) ? data[0] : data;

    await recordCognitiveSession({
      userId,
      activityType: "dual_task_walk",
      domain: "attention",
      secondaryDomain: "executive_function",
      difficulty: result.difficulty_tier,
      difficultyScale: "tier",
      completed: result.completed,
      abandoned: result.abandoned,
      score: result.dual_task_score,
      accuracyPct: result.combined_accuracy_pct,
      durationSeconds: result.duration_seconds,
      language: lang,
      source: "dual_task_walk",
      sourceTable: "dual_task_sessions",
      sourceSessionId: savedSession?.id ?? null,
      metadata: {
        sequenceId: result.sequence_id,
        serial7sAttempts: result.serial7s_attempts,
        serial7sCorrect: result.serial7s_correct,
        tapHits: result.tap_hits,
        tapMisses: result.tap_misses,
        tapFalsePositives: result.tap_false_positives,
      },
    });
  }, [lang, userId]);

  const updateUserState = useCallback(async (result) => {
    if (!userId || result.abandoned) return;

    const current = userStateRef.current ?? getDefaultUserState(userId);
    const isWin = result.combined_accuracy_pct >= 70;
    const isLoss = result.combined_accuracy_pct < 40;
    let consecutiveWins = isWin ? (current.consecutive_wins ?? 0) + 1 : 0;
    let consecutiveLosses = isLoss ? (current.consecutive_losses ?? 0) + 1 : 0;
    let currentTier = current.current_tier ?? 1;
    let sessionsAtTier = (current.sessions_at_tier ?? 0) + 1;

    if (consecutiveWins >= 3 && currentTier < BRAIN_COACH_MAX_LEVEL) {
      currentTier += 1;
      consecutiveWins = 0;
      consecutiveLosses = 0;
      sessionsAtTier = 0;
    } else if (consecutiveLosses >= 3 && currentTier > 1) {
      currentTier -= 1;
      consecutiveWins = 0;
      consecutiveLosses = 0;
      sessionsAtTier = 0;
    }

    const today = getTodayKey();
    const yesterday = getYesterdayKey();
    const lastStreakDate = current.last_streak_date;
    const streakDays =
      lastStreakDate === today
        ? current.streak_days ?? 0
        : lastStreakDate === yesterday
          ? (current.streak_days ?? 0) + 1
          : 1;

    const payload = {
      user_id: userId,
      current_tier: clamp(currentTier, 1, BRAIN_COACH_MAX_LEVEL),
      sessions_at_tier: sessionsAtTier,
      consecutive_wins: consecutiveWins,
      consecutive_losses: consecutiveLosses,
      total_sessions: (current.total_sessions ?? 0) + 1,
      best_score: Math.max(current.best_score ?? 0, result.dual_task_score),
      last_played_at: new Date().toISOString(),
      streak_days: streakDays,
      last_streak_date: today,
      updated_at: new Date().toISOString(),
    };

    const updated = await gameData
      .table("dual_task_user_state")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (updated.data) setUserState(updated.data);
  }, [userId]);

  const clearRoundTimers = useCallback(() => {
    if (symbolIntervalRef.current) window.clearInterval(symbolIntervalRef.current);
    if (roundTimerRef.current) window.clearInterval(roundTimerRef.current);
    symbolIntervalRef.current = null;
    roundTimerRef.current = null;
  }, []);

  const evaluateTapWindow = useCallback((index) => {
    if (index < 0) return;
    if (tapLogRef.current.some((entry) => entry.index === index)) return;

    const seq = sequenceRef.current;
    if (!seq) return;
    const wasMatch = seq.match_indices.includes(index);
    const entry = { index, tapped: tapWindowRef.current, wasMatch };
    const nextLog = [...tapLogRef.current, entry];
    tapLogRef.current = nextLog;
    setTapLog(nextLog);
    tapWindowRef.current = false;
  }, []);

  const finishRound = useCallback(async (abandoned = false) => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;

    const seq = sequenceRef.current ?? FALLBACK_SEQUENCE;
    if (screenRef.current === "playing" && !symbolsCompleteRef.current) {
      evaluateTapWindow(symbolIndexRef.current);
    }
    clearRoundTimers();

    const result = computeScore(serial7sLogRef.current, tapLogRef.current, seq, abandoned);
    setSessionResult(result);

    await saveSession(result);
    if (!abandoned) {
      setScreen("result");
      await updateUserState(result);
    } else if (onExit) {
      onExit();
    }
  }, [clearRoundTimers, computeScore, evaluateTapWindow, onExit, saveSession, updateUserState]);

  const checkRoundCompletion = useCallback(() => {
    const seq = sequenceRef.current;
    if (!seq || finalizingRef.current) return;
    const allMathDone = serial7sStepRef.current >= seq.expected_answers.length;
    if (symbolsCompleteRef.current && allMathDone) {
      void finishRound(false);
      return;
    }

    const elapsed = roundStartedAtRef.current ? Date.now() - roundStartedAtRef.current : 0;
    if (elapsed >= seq.round_duration_ms + 10000) {
      void finishRound(false);
    }
  }, [finishRound]);

  const advanceSymbol = useCallback(() => {
    const seq = sequenceRef.current;
    if (!seq || finalizingRef.current) return;

    const currentIndex = symbolIndexRef.current;
    evaluateTapWindow(currentIndex);

    if (currentIndex >= seq.symbol_count - 1) {
      symbolsCompleteRef.current = true;
      setSymbolsComplete(true);
      if (symbolIntervalRef.current) window.clearInterval(symbolIntervalRef.current);
      symbolIntervalRef.current = null;
      checkRoundCompletion();
      return;
    }

    const nextIndex = currentIndex + 1;
    symbolIndexRef.current = nextIndex;
    tapWindowRef.current = false;
    setLastTapResult(null);
    setSymbolIndex(nextIndex);
  }, [checkRoundCompletion, evaluateTapWindow]);

  const startRound = useCallback((overrideSequence = null) => {
    const seq = overrideSequence ?? sequenceRef.current ?? FALLBACK_SEQUENCE;
    if (overrideSequence) {
      sequenceRef.current = overrideSequence;
      setSequence(overrideSequence);
    }
    clearRoundTimers();
    finalizingRef.current = false;
    roundStartedAtRef.current = Date.now();
    symbolIndexRef.current = 0;
    symbolsCompleteRef.current = false;
    serial7sStepRef.current = 0;
    serial7sLogRef.current = [];
    tapLogRef.current = [];
    tapWindowRef.current = false;

    setSerial7sStep(0);
    setSerial7sLog([]);
    setTapLog([]);
    setSymbolIndex(0);
    setSymbolsComplete(false);
    setLastTapResult(null);
    setSerialFeedback(null);
    setRoundProgress(1);
    setSessionResult(null);
    setPickerValue(seq.start_number);
    setPickerTouched(false);
    setScreen("playing");

    const intervalMs = seq.round_duration_ms / seq.symbol_count;
    symbolIntervalRef.current = window.setInterval(advanceSymbol, intervalMs);
    roundTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - roundStartedAtRef.current;
      setRoundProgress(clamp(1 - elapsed / seq.round_duration_ms, 0, 1));
      if (elapsed >= seq.round_duration_ms + 10000) {
        void finishRound(false);
      }
    }, 100);
  }, [advanceSymbol, clearRoundTimers, finishRound]);

  const handleContinue = useCallback(async () => {
    setScreen("loading");
    try {
      const nextSequence = await loadSequence(userStateRef.current ?? userState ?? getDefaultUserState(userId));
      startRound(nextSequence);
    } catch {
      startRound();
    }
  }, [loadSequence, startRound, userId, userState]);

  const handlePlayAgain = useCallback(async () => {
    const completedTier = sequenceRef.current?.difficulty_tier ?? sequence?.difficulty_tier ?? FALLBACK_SEQUENCE.difficulty_tier;
    const sameTierState = {
      ...(userStateRef.current ?? userState ?? getDefaultUserState(userId)),
      current_tier: completedTier,
    };

    setScreen("loading");
    try {
      const nextSequence = await loadSequence(sameTierState);
      startRound(nextSequence);
    } catch {
      startRound(sequenceRef.current ?? sequence ?? FALLBACK_SEQUENCE);
    }
  }, [loadSequence, sequence, startRound, userId, userState]);

  const handleTap = useCallback(() => {
    if (screenRef.current !== "playing" || symbolsCompleteRef.current || tapWindowRef.current) return;
    tapWindowRef.current = true;
    setLastTapResult(isCurrentMatch ? "hit" : "fp");
  }, [isCurrentMatch]);

  const handleSerial7sConfirm = useCallback(() => {
    const seq = sequenceRef.current;
    if (!seq || serial7sStepRef.current >= seq.expected_answers.length || !pickerTouched) return;

    const step = serial7sStepRef.current;
    const expected = seq.expected_answers[step];
    const given = Number(pickerValue);
    const correct = given === expected;
    const entry = { expected, given, correct };
    const nextLog = [...serial7sLogRef.current, entry];
    const nextStep = step + 1;

    serial7sLogRef.current = nextLog;
    serial7sStepRef.current = nextStep;
    setSerial7sLog(nextLog);
    setSerial7sStep(nextStep);
    setSerialFeedback(correct ? "correct" : "almost");

    const nextMinuend = nextStep === 0 ? seq.start_number : seq.expected_answers[nextStep - 1] ?? expected;
    setPickerValue(clamp(nextMinuend, seq.start_number - Math.max(50, seq.expected_answers.length * 7 + 5), seq.start_number + 50));
    setPickerTouched(false);
    window.setTimeout(() => setSerialFeedback(null), 650);
    checkRoundCompletion();
  }, [checkRoundCompletion, pickerTouched, pickerValue]);

  const handleExit = useCallback(() => {
    if (screenRef.current === "playing") {
      void finishRound(true);
      return;
    }
    onExit?.();
  }, [finishRound, onExit]);

  const markTutorialSeen = useCallback(() => {
    writeTutorialSeen(userId);
    setTutorialSeen(true);
  }, [userId]);

  const openInstructions = useCallback(() => {
    setTutorialReturnScreen(screenRef.current === "playing" ? "intro" : screenRef.current || "intro");
    setScreen("tutorial");
  }, []);

  const closeTutorial = useCallback(() => {
    markTutorialSeen();
    setScreen(tutorialReturnScreen || "intro");
  }, [markTutorialSeen, tutorialReturnScreen]);

  useEffect(() => {
    let active = true;

    async function prepare() {
      setScreen("loading");
      try {
        const state = await loadUserState();
        const nextSequence = await loadSequence(state);
        if (!active) return;
        setUserState(state);
        setSequence(nextSequence);
        setPickerValue(nextSequence.start_number);
        setPickerTouched(false);
        setTutorialReturnScreen("intro");
        setScreen(readTutorialSeen(userId) ? "intro" : "tutorial");
      } catch {
        if (!active) return;
        const fallbackState = getDefaultUserState(userId);
        setUserState(fallbackState);
        setSequence(FALLBACK_SEQUENCE);
        setPickerValue(FALLBACK_SEQUENCE.start_number);
        setPickerTouched(false);
        setTutorialReturnScreen("intro");
        setScreen(readTutorialSeen(userId) ? "intro" : "tutorial");
      }
    }

    void prepare();
    return () => {
      active = false;
    };
  }, [loadSequence, loadUserState, userId]);

  useEffect(() => clearRoundTimers, [clearRoundTimers]);

  const resultToneGreat = (sessionResult?.dual_task_score ?? 0) >= 600;
  const lastThreeMath = serial7sLog.slice(-3);
  const progressToPromotion = clamp(((userState?.consecutive_wins ?? 0) / 3) * 100, 0, 100);
  const currentBand = getBrainCoachLevelBand(currentSequence.difficulty_tier ?? 1);
  const nextTier = clamp((userState?.current_tier ?? currentSequence.difficulty_tier) + 1, 1, BRAIN_COACH_MAX_LEVEL);

  const shellStyle = {
    background: BRAND.bg,
    color: BRAND.ink,
  };
  if (screen === "loading") {
    return (
      <BrainCoachLoadingState
        title={text.title}
        label={text.loading}
        testId="dual-task-walk-flow-shell"
        presentationId="brain_coach.activity_session.train_reflexes.dual_task_walk.loading.touch"
        sceneId="brain_coach.activity_session.train_reflexes.dual_task_walk"
      />
    );
  }

  if (screen === "intro") {
    return (
      <BrainCoachActivityShell
        title={text.title}
        backLabel={text.back}
        onBack={handleExit}
        testId="dual-task-walk-flow-shell"
        presentationId="brain_coach.activity_session.train_reflexes.dual_task_walk.intro.touch"
        sceneId="brain_coach.activity_session.train_reflexes.dual_task_walk"
        sceneKind="intro"
        sceneLayout="dual_task_preview"
      >
        <div className="pb-6" data-testid="dual-task-intro">
        <div className="mx-auto flex w-full max-w-[820px] flex-col rounded-[28px] border border-[#EEE8F1] bg-white p-5 shadow-vyva-card sm:p-6">
          <div className="flex shrink-0 items-center justify-center gap-3">
            <div className="flex min-h-[56px] items-center rounded-full bg-[#FEF3C7] px-5 text-[21px] font-bold text-[#92400E]">
              {text.level} {currentSequence.difficulty_tier} - {currentBand.label}
            </div>
            {tutorialSeen ? (
              <button
                type="button"
                onClick={openInstructions}
                aria-label={text.instructions}
                title={text.instructions}
                className="flex min-h-[64px] w-[64px] items-center justify-center rounded-full bg-white text-vyva-purple shadow-vyva-card"
              >
                <CircleHelp size={28} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <main className="flex min-h-0 flex-1 flex-col justify-center py-5">
            <div className="text-center">
              <p className="mx-auto max-w-[26ch] text-[22px] font-bold leading-[1.35] text-[#5B4B71]">{text.subtitle}</p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 md:mt-7">
              <div className="flex min-h-[124px] items-center gap-4 rounded-[24px] border bg-white p-5 shadow-vyva-card" style={{ borderColor: BRAND.border }}>
                <div className="flex h-[64px] w-[64px] flex-shrink-0 items-center justify-center rounded-[20px]" style={{ background: BRAND.softPurple }}>
                  <Brain className="h-10 w-10" style={{ color: BRAND.purple }} />
                </div>
                <p className="text-[24px] font-bold leading-[1.2]">{text.countBack}</p>
              </div>
              <div className="flex min-h-[124px] items-center gap-4 rounded-[24px] border bg-white p-5 shadow-vyva-card" style={{ borderColor: BRAND.border }}>
                <div className="flex h-[64px] w-[64px] flex-shrink-0 items-center justify-center rounded-[20px] bg-[#FFF7ED]">
                  <Eye className="h-10 w-10" style={{ color: BRAND.gold }} />
                </div>
                <p className="text-[24px] font-bold leading-[1.2]">{text.tapMatch}</p>
              </div>
            </div>
          </main>

          <button
            type="button"
            onClick={() => startRound()}
            className="min-h-[72px] w-full shrink-0 rounded-full px-6 text-[26px] font-bold text-white shadow-vyva-card sm:px-8 sm:text-[28px]"
            style={{ background: BRAND.purple }}
          >
            {text.start}
          </button>
        </div>
        </div>
      </BrainCoachActivityShell>
    );
  }

  if (screen === "tutorial") {
    return (
      <BrainCoachActivityShell
        title={text.title}
        backLabel={text.back}
        onBack={handleExit}
        testId="dual-task-walk-flow-shell"
        presentationId="brain_coach.activity_session.train_reflexes.dual_task_walk.tutorial.touch"
        sceneId="brain_coach.activity_session.train_reflexes.dual_task_walk"
        sceneKind="tutorial"
        sceneLayout="dual_task_example"
      >
        <div className="pb-6">
        <div className="mx-auto flex w-full max-w-[820px] flex-col">
          <header className="flex min-h-[64px] shrink-0 items-center gap-3">
            <h1 className="min-w-0 font-display text-[34px] font-bold leading-tight sm:text-[40px]">{text.tutorialTitle}</h1>
          </header>

          <main className="flex min-h-0 flex-1 flex-col justify-center py-3">
            <section className="rounded-[28px] border bg-white p-5 text-center shadow-vyva-card sm:p-6" style={{ borderColor: BRAND.border }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] bg-[#FAF7FF] p-5">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white" style={{ color: BRAND.purple }}>
                    <Brain size={34} aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-[22px] font-black leading-tight">{text.tutorialCount}</p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-[34px] font-black leading-none" style={{ color: BRAND.purple }}>
                    <span>{DEMO_SEQUENCE.start_number}</span>
                    <span className="h-1 w-7 rounded-full bg-[#8A7B96]" aria-hidden="true" />
                    <span>{DEMO_SEQUENCE.expected_answers[0]}</span>
                  </div>
                  <p className="mt-3 text-[18px] font-bold leading-snug text-[#5B4B71]">{text.countBack}</p>
                </div>

                <div className="rounded-[24px] bg-[#FFF7ED] p-5">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white" style={{ color: BRAND.gold }}>
                    <Eye size={34} aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-[22px] font-black leading-tight">{text.tutorialTap}</p>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <span className="h-12 w-12 rounded-full" style={{ background: BRAND.ink }} />
                    <span className="h-12 w-12 rounded-full" style={{ background: BRAND.ink }} />
                  </div>
                  <p className="mt-3 text-[18px] font-bold leading-snug text-[#5B4B71]">{text.tapMatch}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[text.tutorialCount, text.tutorialWatch, text.tutorialTap].map((label, index) => (
                  <div key={label} className="flex min-h-[74px] items-center gap-3 rounded-[18px] border bg-white px-4 text-left" style={{ borderColor: BRAND.border }}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px] font-black text-white" style={{ background: BRAND.purple }}>
                      {index + 1}
                    </span>
                    <p className="text-[18px] font-black leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            </section>
          </main>

          <button
            type="button"
            onClick={closeTutorial}
            className="min-h-[72px] w-full shrink-0 rounded-full px-8 text-[28px] font-bold text-white shadow-vyva-card"
            style={{ background: BRAND.purple }}
          >
            {text.tutorialUnderstand}
          </button>
        </div>
        </div>
      </BrainCoachActivityShell>
    );
  }

  if (screen === "playing") {
    const mathDone = serial7sStep >= serialSteps;

    return (
      <BrainCoachActivityShell
        title={text.title}
        backLabel={text.exit}
        onBack={handleExit}
        testId="dual-task-walk-flow-shell"
        presentationId="brain_coach.activity_session.train_reflexes.dual_task_walk.playing.touch"
        sceneId="brain_coach.activity_session.train_reflexes.dual_task_walk"
        sceneKind="playing"
        sceneLayout="dual_task_board"
      >
        <div className="pb-6">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-3">
          <header className="shrink-0">
            <div className="h-2 overflow-hidden rounded-full bg-[#EDE6F4]">
              <div className="h-full transition-[width] duration-100" style={{ width: `${roundProgress * 100}%`, background: BRAND.purple }} />
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col gap-2">
            <section
              className={`flex min-h-0 shrink-0 flex-col rounded-[24px] border bg-white p-3 transition-colors sm:p-4 ${
                serialFeedback === "correct" ? "bg-[#ECFDF3]" : serialFeedback === "almost" ? "bg-[#FFFBEB]" : ""
              }`}
              style={{
                borderColor: serialFeedback === "correct" ? "#16A34A" : serialFeedback === "almost" ? BRAND.gold : BRAND.border,
                flexBasis: "clamp(228px, 34dvh, 316px)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 text-[18px] font-bold leading-[1.1] sm:text-[28px]">
                  {text.startAt}: <span style={{ color: BRAND.purple }}>{currentSequence.start_number}</span>
                </p>
                <p className="shrink-0 text-[17px] font-bold leading-[1.1] text-[#5B4B71] sm:text-[24px]">
                  {text.step} {Math.min(serial7sStep + 1, serialSteps)} {text.of} {serialSteps}
                </p>
              </div>

              {mathDone ? (
                <div className="mt-2 flex min-h-0 flex-1 items-center justify-center rounded-[20px] text-[30px] font-bold sm:text-[32px]" style={{ background: "#ECFDF3", color: "#15803D" }}>
                  <Check size={46} />
                  <span className="ml-3">✓ ✓ ✓</span>
                </div>
              ) : (
                <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
                  <div className="min-w-0 shrink-0">
                    <p className="text-[22px] font-bold leading-[1.05] sm:text-[30px]">
                      {text.question} {currentMinuend} - 7?
                    </p>
                    <p className="mt-1 text-[17px] font-semibold leading-[1.1] text-[#5B4B71] sm:text-[24px]">
                      {text.recent}:{" "}
                      {lastThreeMath.length === 0
                        ? "—"
                        : lastThreeMath.map((entry) => (entry.correct ? "OK" : text.almost)).join(" ")}
                    </p>
                  </div>
                  <div className="grid min-h-0 grid-cols-[118px_minmax(0,1fr)] items-stretch gap-2 sm:grid-cols-[178px_minmax(0,1fr)] sm:gap-3">
                    <NumberPicker
                      value={pickerValue}
                      min={pickerMin}
                      max={pickerMax}
                      onChange={(nextValue) => {
                        setPickerValue(nextValue);
                        setPickerTouched(true);
                      }}
                      ariaLabel={text.mathAnswer}
                      increaseLabel={text.increaseNumber}
                      decreaseLabel={text.decreaseNumber}
                    />
                    <button
                      type="button"
                      onClick={handleSerial7sConfirm}
                      disabled={!pickerTouched}
                      className="inline-flex min-h-[72px] items-center justify-center gap-2 rounded-full px-3 text-[20px] font-bold leading-[1.05] text-white transition-opacity disabled:opacity-45 sm:min-h-[96px] sm:gap-3 sm:px-6 sm:text-[26px]"
                      style={{ background: pickerTouched ? BRAND.purple : "#9CA3AF" }}
                    >
                      <Check size={28} />
                      {text.confirm}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section
              className={`flex min-h-0 flex-1 flex-col rounded-[24px] border bg-white p-3 transition-colors sm:p-4 ${
                lastTapResult === "hit" ? "bg-[#ECFDF3]" : lastTapResult === "fp" ? "bg-[#FEF2F2]" : ""
              }`}
              style={{ borderColor: lastTapResult === "hit" ? "#16A34A" : lastTapResult === "fp" ? "#DC2626" : BRAND.border }}
            >
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-[18px] font-semibold leading-[1.05] text-[#5B4B71] sm:text-[24px]">
                  {text.previousSymbol}: <span className="text-[24px] text-[#2B2233] sm:text-[36px]">{previousSymbol}</span>
                </p>
                <div className="flex items-center gap-3 text-[18px] font-bold leading-[1.05] sm:gap-6 sm:text-[24px]">
                  <span>{text.hits}: {tapLog.filter((entry) => entry.wasMatch && entry.tapped).length}</span>
                  <span>{text.almost}: {tapLog.filter((entry) => !entry.wasMatch && entry.tapped).length}</span>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center py-1">
                {symbolsComplete ? (
                  <p className="text-center text-[24px] font-bold sm:text-[32px]" style={{ color: BRAND.purple }}>{text.visualDone}</p>
                ) : (
                  <div className="text-[62px] font-bold leading-none sm:text-[112px]">{currentSymbol}</div>
                )}
              </div>
              <button
                type="button"
                onClick={handleTap}
                disabled={symbolsComplete}
                className="mx-auto flex min-h-[108px] w-full max-w-[560px] shrink-0 items-center justify-center rounded-[28px] px-6 text-center text-[24px] font-bold leading-[1.05] text-white disabled:opacity-60 sm:min-h-[200px] sm:px-8 sm:text-[32px]"
                style={{ background: lastTapResult === "hit" ? "#16A34A" : lastTapResult === "fp" ? "#DC2626" : BRAND.purple }}
              >
                {text.tapHere}
              </button>
            </section>
          </main>
        </div>
        </div>
      </BrainCoachActivityShell>
    );
  }

  const result = sessionResult ?? computeScore(serial7sLog, tapLog, currentSequence, false);
  const mathMarks = result.serial7s_log.map((entry) => (entry.correct ? "OK" : text.almost)).join(" ");
  const completedTier = currentSequence.difficulty_tier;
  const adaptiveTier = userState?.current_tier ?? completedTier;
  const adaptiveBand = getBrainCoachLevelBand(adaptiveTier);
  const resultWasPromoted = adaptiveTier > completedTier;
  const resultSummary = resultWasPromoted
    ? getBrainCoachSupportiveProgressCopy({ advanced: true, level: completedTier })
    : result.dual_task_score >= 600
      ? `${text.totalScore}: ${result.dual_task_score}`
      : getBrainCoachSupportiveProgressCopy({ advanced: false, level: completedTier });
  const continueLabel = resultWasPromoted
    ? text.continueToLevel.replace("{level}", String(adaptiveTier))
    : text.continueAction;
  const promotionLabel =
    resultWasPromoted
      ? text.newLevel
      : `${text.keepGoing} ${text.level} ${nextTier}`;

  return (
    <BrainCoachActivityShell
      title={text.title}
      backLabel={text.exit}
      onBack={handleExit}
      showHeader={false}
      testId="dual-task-walk-flow-shell"
      presentationId="brain_coach.activity_session.train_reflexes.dual_task_walk.result.touch"
      sceneId="brain_coach.activity_session.train_reflexes.dual_task_walk"
      sceneKind="completion"
      sceneLayout="modal_actions"
      state="complete"
    >
      <div className="min-h-[100dvh]" style={shellStyle}>
        <BrainGameCompletionDialog
          title={resultToneGreat ? text.resultGreat : text.resultGood}
          summary={resultSummary}
          metrics={[
            { label: text.mathTask, value: `${Math.round(result.serial7s_accuracy_pct)}%` },
            { label: text.visualTask, value: `${Math.round(result.tap_accuracy_pct)}%` },
            { label: text.totalScore, value: result.dual_task_score },
            { label: text.streak, value: `${userState?.streak_days ?? 0} ${text.days}` },
          ]}
          continueLabel={continueLabel}
          replayLabel={text.playAgain}
          anotherLabel={text.playAnotherGame}
          onContinue={handleContinue}
          onReplay={handlePlayAgain}
          onAnother={handleExit}
          details={
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-[#EADFF8] bg-[#FFF9F1] px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-[15px] font-black text-vyva-text-1">
                    <span>{text.mathTask}</span>
                    <span>{Math.round(result.serial7s_accuracy_pct)}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#EDE6F4]">
                    <div className="h-full rounded-full bg-vyva-purple" style={{ width: `${result.serial7s_accuracy_pct}%` }} />
                  </div>
                  <p className="mt-2 text-[14px] font-bold text-vyva-text-2">{text.mathLine}: {mathMarks || "-"}</p>
                </div>
                <div className="rounded-[18px] border border-[#EADFF8] bg-[#FFF9F1] px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-[15px] font-black text-vyva-text-1">
                    <span>{text.visualTask}</span>
                    <span>{Math.round(result.tap_accuracy_pct)}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#EDE6F4]">
                    <div className="h-full rounded-full bg-vyva-gold" style={{ width: `${result.tap_accuracy_pct}%` }} />
                  </div>
                  <p className="mt-2 text-[14px] font-bold text-vyva-text-2">
                    {text.visualLine}: {text.hits} {result.tap_hits} | {text.almost} {result.tap_false_positives + result.tap_misses}
                  </p>
                </div>
              </div>
              <div className="rounded-[18px] border border-[#EADFF8] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-[15px] font-black text-vyva-text-1">
                  <span>{promotionLabel}</span>
                  <span>{Math.round(progressToPromotion)}%</span>
                </div>
                <p className="mt-1 text-[14px] font-bold text-vyva-text-2">
                  {text.level} {adaptiveTier} - {adaptiveBand.label}
                </p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#EDE6F4]">
                  <div className="h-full rounded-full bg-vyva-purple" style={{ width: `${progressToPromotion}%` }} />
                </div>
              </div>
            </div>
          }
        />
      </div>
    </BrainCoachActivityShell>
  );
}

// TODO: Voice input for Serial 7s.
// TODO: Stepping / movement integration with device accelerometer.
// TODO: Caregiver dashboard data for seven-day dual-task trends.
// TODO: VYVA voice integration for post-session readouts.
// TODO: Adaptive symbol interval based on previous tap reaction time.
