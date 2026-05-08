import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  RotateCcw,
  Square,
} from "lucide-react";
import { useLanguage } from "@/i18n";
import { supabase } from "../lib/supabaseClient";
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

function NumberPicker({ value, min, max, onChange, ariaLabel }) {
  const setNext = (nextValue) => onChange(clamp(nextValue, min, max));
  const visible = [clamp(value + 1, min, max), value, clamp(value - 1, min, max)];

  return (
    <div
      className="grid w-[178px] grid-rows-[64px_96px_64px] overflow-hidden rounded-[8px] border-2 bg-white"
      style={{ borderColor: BRAND.border }}
      onWheel={(event) => {
        event.preventDefault();
        setNext(value + (event.deltaY > 0 ? -1 : 1));
      }}
      aria-label={ariaLabel}
      role="spinbutton"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      <button
        type="button"
        onClick={() => setNext(value + 1)}
        className="flex min-h-[64px] items-center justify-center text-[26px] font-semibold"
        style={{ color: BRAND.purple }}
        aria-label="Subir número"
      >
        <ChevronUp size={34} />
      </button>
      <div className="grid grid-rows-3 text-center">
        <div className="text-[24px] leading-[32px] text-[#7C6D94]">{visible[0] === value ? "" : visible[0]}</div>
        <div className="text-[40px] font-bold leading-[32px]" style={{ color: BRAND.ink }}>
          {value}
        </div>
        <div className="text-[24px] leading-[32px] text-[#7C6D94]">{visible[2] === value ? "" : visible[2]}</div>
      </div>
      <button
        type="button"
        onClick={() => setNext(value - 1)}
        className="flex min-h-[64px] items-center justify-center text-[26px] font-semibold"
        style={{ color: BRAND.purple }}
        aria-label="Bajar número"
      >
        <ChevronDown size={34} />
      </button>
    </div>
  );
}

export default function DualTaskWalk({ userId, onExit }) {
  const { language } = useLanguage();
  const lang = normalizeLanguage(language);
  const text = COPY[lang];

  const [screen, setScreen] = useState("loading");
  const [sequence, setSequence] = useState(null);
  const [userState, setUserState] = useState(null);
  const [loadNote, setLoadNote] = useState("");

  const [serial7sStep, setSerial7sStep] = useState(0);
  const [pickerValue, setPickerValue] = useState(0);
  const [serial7sLog, setSerial7sLog] = useState([]);
  const [serialFeedback, setSerialFeedback] = useState(null);

  const [symbolIndex, setSymbolIndex] = useState(0);
  const [tapLog, setTapLog] = useState([]);
  const [lastTapResult, setLastTapResult] = useState(null);
  const [symbolsComplete, setSymbolsComplete] = useState(false);

  const [roundProgress, setRoundProgress] = useState(1);
  const [sessionResult, setSessionResult] = useState(null);
  const [tutorialSymbolIndex, setTutorialSymbolIndex] = useState(0);
  const [tutorialTapped, setTutorialTapped] = useState(false);

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

    const existing = await supabase
      .from("dual_task_user_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing.data) return existing.data;
    if (existing.error) throw new Error(existing.error.message);

    const created = await supabase
      .from("dual_task_user_state")
      .upsert(fallback, { onConflict: "user_id" })
      .select("*")
      .single();

    if (created.error) throw new Error(created.error.message);
    return created.data ?? fallback;
  }, [userId]);

  const loadSequence = useCallback(async (state) => {
    const tier = state?.current_tier ?? 1;
    const languageToUse = normalizeLanguage(lang);
    const rows = await supabase
      .from("dual_task_sequences")
      .select("*")
      .eq("difficulty_tier", tier)
      .eq("is_active", true)
      .eq("language", languageToUse);

    if (rows.error) throw new Error(rows.error.message);
    const sequences = (rows.data ?? []).map(normalizeSequence);
    if (sequences.length === 0) throw new Error("No Dual Task Walk sequences are available.");

    const todaySessions = userId
      ? await supabase
          .from("dual_task_sessions")
          .select("sequence_id,played_at")
          .eq("user_id", userId)
          .gte("played_at", getStartOfTodayIso())
      : { data: [], error: null };

    const usedToday = new Set((todaySessions.data ?? []).map((entry) => entry.sequence_id).filter(Boolean));
    const unusedToday = sequences.filter((entry) => !usedToday.has(entry.id));
    if (unusedToday.length > 0) return shuffle(unusedToday)[0];

    const allSessions = userId
      ? await supabase
          .from("dual_task_sessions")
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

    await supabase.from("dual_task_sessions").insert({
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
    });
  }, [userId]);

  const updateUserState = useCallback(async (result) => {
    if (!userId || result.abandoned) return;

    const current = userStateRef.current ?? getDefaultUserState(userId);
    const isWin = result.combined_accuracy_pct >= 70;
    const isLoss = result.combined_accuracy_pct < 40;
    let consecutiveWins = isWin ? (current.consecutive_wins ?? 0) + 1 : 0;
    let consecutiveLosses = isLoss ? (current.consecutive_losses ?? 0) + 1 : 0;
    let currentTier = current.current_tier ?? 1;
    let sessionsAtTier = (current.sessions_at_tier ?? 0) + 1;

    if (consecutiveWins >= 3 && currentTier < 10) {
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
      current_tier: clamp(currentTier, 1, 10),
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

    const updated = await supabase
      .from("dual_task_user_state")
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
    setPickerValue(clamp(seq.start_number - 7, seq.start_number - Math.max(50, seq.expected_answers.length * 7 + 5), seq.start_number + 50));
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

  const handleReplay = useCallback(async () => {
    setScreen("loading");
    try {
      const nextSequence = await loadSequence(userStateRef.current ?? userState ?? getDefaultUserState(userId));
      startRound(nextSequence);
    } catch {
      startRound();
    }
  }, [loadSequence, startRound, userId, userState]);

  const handleTap = useCallback(() => {
    if (screenRef.current !== "playing" || symbolsCompleteRef.current || tapWindowRef.current) return;
    tapWindowRef.current = true;
    setLastTapResult(isCurrentMatch ? "hit" : "fp");
  }, [isCurrentMatch]);

  const handleSerial7sConfirm = useCallback(() => {
    const seq = sequenceRef.current;
    if (!seq || serial7sStepRef.current >= seq.expected_answers.length) return;

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

    const nextAnchor = correct ? expected : given;
    setPickerValue(clamp(nextAnchor - 7, seq.start_number - Math.max(50, seq.expected_answers.length * 7 + 5), seq.start_number + 50));
    window.setTimeout(() => setSerialFeedback(null), 650);
    checkRoundCompletion();
  }, [checkRoundCompletion, pickerValue]);

  const handleExit = useCallback(() => {
    if (screenRef.current === "playing") {
      void finishRound(true);
      return;
    }
    onExit?.();
  }, [finishRound, onExit]);

  useEffect(() => {
    let active = true;

    async function prepare() {
      setScreen("loading");
      setLoadNote("");
      try {
        const state = await loadUserState();
        const nextSequence = await loadSequence(state);
        if (!active) return;
        setUserState(state);
        setSequence(nextSequence);
        setPickerValue(nextSequence.start_number - 7);
        setScreen("intro");
      } catch {
        if (!active) return;
        const fallbackState = getDefaultUserState(userId);
        setUserState(fallbackState);
        setSequence(FALLBACK_SEQUENCE);
        setPickerValue(FALLBACK_SEQUENCE.start_number - 7);
        setLoadNote(text.preparingFallback);
        setScreen("intro");
      }
    }

    void prepare();
    return () => {
      active = false;
    };
  }, [loadSequence, loadUserState, text.preparingFallback, userId]);

  useEffect(() => clearRoundTimers, [clearRoundTimers]);

  useEffect(() => {
    if (screen !== "tutorial") return undefined;
    setTutorialSymbolIndex(0);
    setTutorialTapped(false);
    const timer = window.setInterval(() => {
      setTutorialSymbolIndex((current) => {
        if (current >= DEMO_SEQUENCE.symbol_stream.length - 1) {
          window.clearInterval(timer);
          return current;
        }
        setTutorialTapped(false);
        return current + 1;
      });
    }, 1800);

    return () => window.clearInterval(timer);
  }, [screen]);

  const resultToneGreat = (sessionResult?.dual_task_score ?? 0) >= 600;
  const lastThreeMath = serial7sLog.slice(-3);
  const progressToPromotion = clamp(((userState?.consecutive_wins ?? 0) / 3) * 100, 0, 100);
  const nextTier = clamp((userState?.current_tier ?? currentSequence.difficulty_tier) + 1, 1, 10);
  const tutorialCurrentSymbol = DEMO_SEQUENCE.symbol_stream[tutorialSymbolIndex];
  const tutorialPreviousSymbol = tutorialSymbolIndex > 0 ? DEMO_SEQUENCE.symbol_stream[tutorialSymbolIndex - 1] : "—";
  const tutorialMatch = tutorialSymbolIndex > 0 && DEMO_SEQUENCE.match_indices.includes(tutorialSymbolIndex);

  const shellStyle = {
    background: BRAND.bg,
    color: BRAND.ink,
  };

  if (screen === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center px-8" style={shellStyle}>
        <div className="text-center">
          <Loader2 className="mx-auto h-20 w-20 animate-spin" style={{ color: BRAND.purple }} />
          <p className="mt-8 text-[28px] font-semibold">{text.loading}</p>
        </div>
      </div>
    );
  }

  if (screen === "intro") {
    return (
      <div className="min-h-screen px-8 py-8" style={shellStyle}>
        <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[820px] flex-col">
          <div className="flex items-center justify-between">
            <div className="text-[28px] font-bold" style={{ color: BRAND.purple }}>VYVA</div>
            <div className="rounded-full px-5 py-3 text-[22px] font-bold text-white" style={{ background: BRAND.gold }}>
              {text.level} {currentSequence.difficulty_tier}
            </div>
          </div>

          <main className="flex flex-1 flex-col justify-center py-8">
            <div className="text-center">
              <div className="text-[84px] leading-none">🧠</div>
              <h1 className="mt-5 font-display text-[54px] font-bold leading-none">{text.title}</h1>
              <p className="mt-5 text-[28px] leading-[1.3] text-[#5B4B71]">{text.subtitle}</p>
              {loadNote && <p className="mt-4 text-[22px] font-semibold" style={{ color: BRAND.gold }}>{loadNote}</p>}
            </div>

            <div className="mt-10 grid grid-cols-2 overflow-hidden rounded-[8px] border-2 bg-white" style={{ borderColor: BRAND.border }}>
              <div className="border-r-2 p-7 text-center" style={{ borderColor: BRAND.border }}>
                <Brain className="mx-auto h-16 w-16" style={{ color: BRAND.purple }} />
                <p className="mt-5 text-[28px] font-semibold leading-[1.2]">{text.countBack}</p>
              </div>
              <div className="p-7 text-center">
                <Eye className="mx-auto h-16 w-16" style={{ color: BRAND.gold }} />
                <p className="mt-5 text-[28px] font-semibold leading-[1.2]">{text.tapMatch}</p>
              </div>
            </div>
          </main>

          <button
            type="button"
            onClick={() => setScreen("tutorial")}
            className="min-h-[72px] w-full rounded-[8px] px-8 text-[28px] font-bold text-white shadow-vyva-card"
            style={{ background: BRAND.purple }}
          >
            {text.example}
          </button>
        </div>
      </div>
    );
  }

  if (screen === "tutorial") {
    return (
      <div className="min-h-screen px-6 py-5" style={shellStyle}>
        <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[820px] flex-col">
          <header className="flex min-h-[76px] items-center justify-between border-b-2" style={{ borderColor: BRAND.border }}>
            <h1 className="text-[28px] font-bold">{text.tutorialTitle}</h1>
            <button
              type="button"
              onClick={() => startRound()}
              className="min-h-[64px] rounded-[8px] px-6 text-[24px] font-bold"
              style={{ background: BRAND.softPurple, color: BRAND.purple }}
            >
              {text.skip}
            </button>
          </header>

          <main className="grid flex-1 grid-rows-[40fr_60fr] gap-4 py-4">
            <section className="rounded-[8px] border-2 bg-white p-6" style={{ borderColor: BRAND.border }}>
              <p className="text-[28px] font-semibold">
                {text.startAt}: <span style={{ color: BRAND.purple }}>{DEMO_SEQUENCE.start_number}</span>
              </p>
              <div className="mt-5 flex items-center justify-between gap-5">
                <NumberPicker
                  value={44}
                  min={1}
                  max={100}
                  onChange={() => {}}
                  ariaLabel="Tutorial number"
                />
                <div className="flex min-h-[80px] flex-1 items-center justify-center rounded-[8px] text-[32px] font-bold" style={{ background: "#ECFDF3", color: "#15803D" }}>
                  <Check size={42} />
                  <span className="ml-3">✓ ✓</span>
                </div>
              </div>
            </section>

            <section className="relative flex flex-col rounded-[8px] border-2 bg-white p-6" style={{ borderColor: BRAND.border }}>
              {tutorialMatch && !tutorialTapped && (
                <div className="absolute left-6 right-6 top-6 rounded-[8px] px-5 py-4 text-center text-[26px] font-bold text-white" style={{ background: BRAND.gold }}>
                  {text.sameSymbol}
                </div>
              )}
              <p className="text-[24px] font-semibold text-[#5B4B71]">
                {text.previousSymbol}: <span className="text-[34px] text-[#2B2233]">{tutorialPreviousSymbol}</span>
              </p>
              <div className="flex flex-1 items-center justify-center text-[104px] font-bold leading-none">{tutorialCurrentSymbol}</div>
              <button
                type="button"
                onClick={() => setTutorialTapped(true)}
                className="mx-auto flex min-h-[92px] w-full max-w-[520px] items-center justify-center rounded-[8px] px-8 text-[30px] font-bold text-white"
                style={{ background: tutorialTapped && tutorialMatch ? "#16A34A" : BRAND.purple }}
              >
                {text.tapHere}
              </button>
            </section>
          </main>

          <button
            type="button"
            onClick={() => startRound()}
            className="min-h-[72px] w-full rounded-[8px] px-8 text-[28px] font-bold text-white shadow-vyva-card"
            style={{ background: BRAND.purple }}
          >
            {text.start}
          </button>
        </div>
      </div>
    );
  }

  if (screen === "playing") {
    const mathDone = serial7sStep >= serialSteps;

    return (
      <div className="min-h-screen px-5 py-4" style={shellStyle}>
        <div className="mx-auto flex min-h-[calc(100vh-32px)] w-full max-w-[820px] flex-col">
          <header className="border-b-2 pb-3" style={{ borderColor: BRAND.border }}>
            <div className="flex min-h-[70px] items-center justify-between gap-4">
              <h1 className="text-[30px] font-bold">{text.title}</h1>
              <button
                type="button"
                onClick={handleExit}
                className="inline-flex min-h-[64px] items-center gap-3 rounded-[8px] px-5 text-[24px] font-bold"
                style={{ background: "#FFF7ED", color: "#9A3412" }}
              >
                <Square size={24} />
                {text.exit}
              </button>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#EDE6F4]">
              <div className="h-full transition-[width] duration-100" style={{ width: `${roundProgress * 100}%`, background: BRAND.purple }} />
            </div>
          </header>

          <main className="grid flex-1 grid-rows-[40fr_60fr] gap-4 py-4">
            <section
              className={`rounded-[8px] border-2 bg-white p-5 transition-colors ${
                serialFeedback === "correct" ? "bg-[#ECFDF3]" : serialFeedback === "almost" ? "bg-[#FFFBEB]" : ""
              }`}
              style={{ borderColor: serialFeedback === "correct" ? "#16A34A" : serialFeedback === "almost" ? BRAND.gold : BRAND.border }}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-[28px] font-bold">
                  {text.startAt}: <span style={{ color: BRAND.purple }}>{currentSequence.start_number}</span>
                </p>
                <p className="text-[24px] font-bold text-[#5B4B71]">
                  {text.step} {Math.min(serial7sStep + 1, serialSteps)} {text.of} {serialSteps}
                </p>
              </div>

              {mathDone ? (
                <div className="mt-7 flex min-h-[170px] items-center justify-center rounded-[8px] text-[32px] font-bold" style={{ background: "#ECFDF3", color: "#15803D" }}>
                  <Check size={46} />
                  <span className="ml-3">✓ ✓ ✓</span>
                </div>
              ) : (
                <div className="mt-5 flex items-center justify-between gap-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[30px] font-bold leading-[1.2]">
                      {text.question} {currentMinuend} - 7?
                    </p>
                    <p className="mt-5 text-[24px] font-semibold text-[#5B4B71]">
                      {text.recent}:{" "}
                      {lastThreeMath.length === 0
                        ? "—"
                        : lastThreeMath.map((entry) => (entry.correct ? "✓" : "¡casi!")).join(" ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <NumberPicker
                      value={pickerValue}
                      min={pickerMin}
                      max={pickerMax}
                      onChange={setPickerValue}
                      ariaLabel="Respuesta de matemáticas"
                    />
                    <button
                      type="button"
                      onClick={handleSerial7sConfirm}
                      className="inline-flex min-h-[96px] items-center gap-3 rounded-[8px] px-6 text-[26px] font-bold text-white"
                      style={{ background: BRAND.purple }}
                    >
                      <Check size={34} />
                      {text.confirm}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section
              className={`flex flex-col rounded-[8px] border-2 bg-white p-5 transition-colors ${
                lastTapResult === "hit" ? "bg-[#ECFDF3]" : lastTapResult === "fp" ? "bg-[#FEF2F2]" : ""
              }`}
              style={{ borderColor: lastTapResult === "hit" ? "#16A34A" : lastTapResult === "fp" ? "#DC2626" : BRAND.border }}
            >
              <p className="text-[24px] font-semibold text-[#5B4B71]">
                {text.previousSymbol}: <span className="text-[36px] text-[#2B2233]">{previousSymbol}</span>
              </p>
              <div className="flex flex-1 items-center justify-center">
                {symbolsComplete ? (
                  <p className="text-center text-[32px] font-bold" style={{ color: BRAND.purple }}>{text.visualDone}</p>
                ) : (
                  <div className="text-[112px] font-bold leading-none">{currentSymbol}</div>
                )}
              </div>
              <button
                type="button"
                onClick={handleTap}
                disabled={symbolsComplete}
                className="mx-auto flex min-h-[200px] w-full max-w-[560px] items-center justify-center rounded-[8px] px-8 text-center text-[32px] font-bold text-white disabled:opacity-60"
                style={{ background: lastTapResult === "hit" ? "#16A34A" : lastTapResult === "fp" ? "#DC2626" : BRAND.purple }}
              >
                {text.tapHere}
              </button>
              <div className="mt-4 flex items-center justify-center gap-8 text-[24px] font-bold">
                <span>{text.hits}: {tapLog.filter((entry) => entry.wasMatch && entry.tapped).length}</span>
                <span>{text.almost}: {tapLog.filter((entry) => !entry.wasMatch && entry.tapped).length}</span>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  const result = sessionResult ?? computeScore(serial7sLog, tapLog, currentSequence, false);
  const mathMarks = result.serial7s_log.map((entry) => (entry.correct ? "✓" : "¡casi!")).join(" ");
  const promotionLabel =
    (userState?.current_tier ?? currentSequence.difficulty_tier) > currentSequence.difficulty_tier
      ? text.newLevel
      : `${text.keepGoing} ${text.level} ${nextTier}`;

  return (
    <div className="min-h-screen px-8 py-8" style={shellStyle}>
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[820px] flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <div className="text-center text-[82px] leading-none">{resultToneGreat ? "🎉" : "😊"}</div>
          <h1 className="mt-5 text-center font-display text-[44px] font-bold leading-[1.1]">
            {resultToneGreat ? text.resultGreat : text.resultGood}
          </h1>

          <section className="mt-8 rounded-[8px] border-2 bg-white p-6 shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="grid grid-cols-2 gap-5 text-center">
              <div>
                <p className="text-[24px] font-bold text-[#5B4B71]">{text.mathTask}</p>
                <p className="mt-2 text-[42px] font-bold" style={{ color: BRAND.purple }}>{Math.round(result.serial7s_accuracy_pct)}%</p>
              </div>
              <div>
                <p className="text-[24px] font-bold text-[#5B4B71]">{text.visualTask}</p>
                <p className="mt-2 text-[42px] font-bold" style={{ color: BRAND.purple }}>{Math.round(result.tap_accuracy_pct)}%</p>
              </div>
              <div>
                <p className="text-[24px] font-bold text-[#5B4B71]">{text.totalScore}</p>
                <p className="mt-2 text-[42px] font-bold" style={{ color: BRAND.gold }}>{result.dual_task_score}</p>
              </div>
              <div>
                <p className="text-[24px] font-bold text-[#5B4B71]">{text.streak}</p>
                <p className="mt-2 text-[42px] font-bold" style={{ color: BRAND.gold }}>
                  {userState?.streak_days ?? 0} <span className="text-[24px]">{text.days}</span>
                </p>
              </div>
            </div>
          </section>

          <div className="mt-6 grid grid-cols-2 gap-5">
            <div className="rounded-[8px] border-2 bg-white p-5" style={{ borderColor: BRAND.border }}>
              <div className="h-4 overflow-hidden rounded-full bg-[#EDE6F4]">
                <div className="h-full" style={{ width: `${result.serial7s_accuracy_pct}%`, background: BRAND.purple }} />
              </div>
              <p className="mt-4 text-[24px] font-bold">{text.mathLine}: {mathMarks || "—"}</p>
            </div>
            <div className="rounded-[8px] border-2 bg-white p-5" style={{ borderColor: BRAND.border }}>
              <div className="h-4 overflow-hidden rounded-full bg-[#EDE6F4]">
                <div className="h-full" style={{ width: `${result.tap_accuracy_pct}%`, background: BRAND.gold }} />
              </div>
              <p className="mt-4 text-[24px] font-bold">
                {text.visualLine}: {text.hits} {result.tap_hits} · {text.almost} {result.tap_false_positives + result.tap_misses}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[8px] border-2 bg-white p-5" style={{ borderColor: BRAND.border }}>
            <p className="text-[24px] font-bold">{promotionLabel}</p>
            <div className="mt-4 h-5 overflow-hidden rounded-full bg-[#EDE6F4]">
              <div className="h-full" style={{ width: `${progressToPromotion}%`, background: BRAND.purple }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={handleReplay}
            className="inline-flex min-h-[72px] items-center justify-center gap-3 rounded-[8px] px-6 text-[26px] font-bold text-white"
            style={{ background: BRAND.purple }}
          >
            <RotateCcw size={32} />
            {text.replay}
          </button>
          <button
            type="button"
            onClick={handleExit}
            className="inline-flex min-h-[72px] items-center justify-center gap-3 rounded-[8px] px-6 text-[26px] font-bold"
            style={{ background: "#FFF7ED", color: "#9A3412" }}
          >
            <ArrowLeft size={32} />
            {text.finish}
          </button>
        </div>
      </div>
    </div>
  );
}

// TODO: Voice input for Serial 7s.
// TODO: Stepping / movement integration with device accelerometer.
// TODO: Caregiver dashboard data for seven-day dual-task trends.
// TODO: VYVA voice integration for post-session readouts.
// TODO: Adaptive symbol interval based on previous tap reaction time.
