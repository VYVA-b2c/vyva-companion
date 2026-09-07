import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Headphones, Info, Play, Volume2, Waves } from "lucide-react";
import { useLanguage } from "@/i18n";
import { BrainCoachActivityShell, BrainCoachLoadingState } from "@/components/brain/BrainCoachFlowShell";
import { gameData } from "./shared/gameDataApi";
import { recordCognitiveSession } from "./shared/brainCoachSessions";
import BrainGameCompletionDialog from "./shared/BrainGameCompletionDialog";
import {
  BRAIN_COACH_MAX_LEVEL,
  getBrainCoachLevelBand,
  getBrainCoachSupportiveProgressCopy,
} from "./shared/brainCoachProgression";
import { normalizeGameLanguage } from "./shared/language";
import {
  LISTEN_CLOSELY_FALLBACK_SOUNDSCAPES,
  computeListenCloselyResult,
  getDefaultListenCloselyUserState,
  getNextListenCloselyStateAfterSession,
  normalizeListenCloselySoundscape,
  selectListenCloselySoundscape,
} from "./shared/listenCloselyData";
import {
  canUseListenCloselyAudio,
  createListenCloselyAudioContext,
  playListenCloselySound,
  scheduleListenCloselySoundscape,
} from "./shared/listenCloselyAudio";

const BRAND = {
  purple: "#6B21A8",
  gold: "#F59E0B",
  bg: "#FAF9F6",
  ink: "#2B2233",
  muted: "#62536B",
  border: "#E7D8F3",
  softPurple: "#F3E8FF",
  teal: "#0F766E",
  tealPale: "#DDF7F1",
};

const LISTEN_CLOSELY_TUTORIAL_KEY = "listenClosely:tutorialSeen:v1";

function tutorialStorageKey(userId) {
  return userId ? `${LISTEN_CLOSELY_TUTORIAL_KEY}:${userId}` : LISTEN_CLOSELY_TUTORIAL_KEY;
}

function readListenCloselyTutorialSeen(userId) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(tutorialStorageKey(userId)) === "true";
  } catch {
    return false;
  }
}

function writeListenCloselyTutorialSeen(userId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tutorialStorageKey(userId), "true");
  } catch {
    // Tutorial persistence is helpful but should never block the game.
  }
}

function localDayBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function soundLabel(t, sound) {
  if (!sound) return "";
  return t(`games.listenClosely.sounds.${sound}`, sound.replaceAll("_", " "));
}

function useLatestRef(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function ProgressBar({ value }) {
  return (
    <div className="h-4 overflow-hidden rounded-full bg-[#EFE7F6]" aria-hidden="true">
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: BRAND.gold }}
      />
    </div>
  );
}

function ListeningOrb({ active, hitFeedback }) {
  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[360px] items-center justify-center">
      <div
        className={`absolute h-[78%] w-[78%] rounded-full border ${active ? "listen-closely-wave" : ""}`}
        style={{ borderColor: "#D8B4FE", background: "rgba(243,232,255,0.48)" }}
      />
      <div
        className={`absolute h-[58%] w-[58%] rounded-full border ${active ? "listen-closely-wave listen-closely-wave-delay" : ""}`}
        style={{ borderColor: "#FCD34D", background: "rgba(255,247,237,0.72)" }}
      />
      <div
        className="relative flex h-[46%] w-[46%] items-center justify-center rounded-full shadow-vyva-hero"
        style={{ background: hitFeedback ? BRAND.teal : BRAND.purple, color: "white" }}
      >
        {hitFeedback ? <Check size={58} strokeWidth={3} /> : <Waves size={64} strokeWidth={2.4} />}
      </div>
    </div>
  );
}

function ListenTutorialVisual() {
  return (
    <div className="relative mx-auto h-[160px] w-full max-w-[540px] overflow-hidden rounded-[22px] border sm:h-[180px]" style={{ borderColor: BRAND.border, background: BRAND.softPurple }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.95),rgba(255,255,255,0.35))]" />
      {[0, 1, 2].map((ring) => (
        <div
          key={ring}
          className="absolute left-1/2 top-1/2 rounded-full border-2"
          style={{
            height: 72 + ring * 48,
            width: 72 + ring * 48,
            transform: "translate(-50%, -50%)",
            borderColor: ring === 1 ? BRAND.gold : BRAND.purple,
            opacity: 0.14 + ring * 0.04,
          }}
        />
      ))}
      <div className="absolute left-1/2 top-1/2 flex h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-vyva-hero sm:h-[84px] sm:w-[84px]" style={{ background: BRAND.purple }}>
        <Headphones size={40} strokeWidth={2.2} aria-hidden="true" />
      </div>
      <div className="absolute left-[10%] top-[22%] flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-vyva-card" style={{ color: BRAND.teal }}>
        <Volume2 size={22} aria-hidden="true" />
      </div>
      <div className="absolute bottom-[18%] right-[10%] flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-vyva-card" style={{ color: BRAND.gold }}>
        <Check size={24} strokeWidth={3} aria-hidden="true" />
      </div>
    </div>
  );
}

export default function ListenClosely({ userId, onExit }) {
  const { language, t } = useLanguage();
  const gameLanguage = normalizeGameLanguage(language);
  const [screen, setScreen] = useState("loading");
  const [soundscape, setSoundscape] = useState(null);
  const [userState, setUserState] = useState(null);
  const [loadNote, setLoadNote] = useState("");
  const [sessionResult, setSessionResult] = useState(null);
  const [progressPct, setProgressPct] = useState(0);
  const [hitFeedback, setHitFeedback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [audioWarning, setAudioWarning] = useState("");

  const audioContextRef = useRef(null);
  const endTimerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const playStartMsRef = useRef(0);
  const sessionSavedRef = useRef(false);
  const finalizingRef = useRef(false);
  const tapTimesRef = useRef([]);
  const consumedPreviewTargetsRef = useRef(new Set());
  const soundscapeRef = useLatestRef(soundscape);
  const userStateRef = useLatestRef(userState);

  const normalizedSoundscape = useMemo(
    () => soundscape ? normalizeListenCloselySoundscape(soundscape) : null,
    [soundscape],
  );
  const isCompareMode = normalizedSoundscape?.mode === "count_compare";
  const targetLabel = soundLabel(t, normalizedSoundscape?.target_sound_character);
  const secondTargetLabel = soundLabel(t, normalizedSoundscape?.second_target_sound_character);
  const currentTier = userState?.current_tier ?? normalizedSoundscape?.difficulty_tier ?? 1;

  const stopTimers = useCallback(() => {
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    endTimerRef.current = null;
    progressTimerRef.current = null;
    feedbackTimerRef.current = null;
  }, []);

  const closeAudio = useCallback(() => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context?.close) {
      context.close().catch(() => undefined);
    }
  }, []);

  const getAudioContext = useCallback(async () => {
    let context = audioContextRef.current;
    if (!context) {
      context = createListenCloselyAudioContext();
      audioContextRef.current = context;
    }
    if (!context) {
      setAudioWarning(t("games.listenClosely.audioUnavailable", "Sound is not available in this browser, but you can still view the game."));
      return null;
    }
    if (context.state === "suspended" && context.resume) {
      await context.resume().catch(() => undefined);
    }
    return context;
  }, [t]);

  const loadUserState = useCallback(async () => {
    if (!userId) return getDefaultListenCloselyUserState("");

    const { data, error } = await gameData
      .table("listen_closely_user_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) return data;
    if (error) {
      console.warn("Listen Closely could not load progress state.", error);
      return getDefaultListenCloselyUserState(userId);
    }

    const fallback = getDefaultListenCloselyUserState(userId);
    const saved = await gameData
      .table("listen_closely_user_state")
      .upsert(fallback, { onConflict: "user_id" })
      .select("*")
      .single();

    if (saved.data) return saved.data;
    if (saved.error) {
      console.warn("Listen Closely could not create progress state.", saved.error);
    }
    return fallback;
  }, [userId]);

  const loadSoundscape = useCallback(async (tier) => {
    const fallbackRows = LISTEN_CLOSELY_FALLBACK_SOUNDSCAPES.filter((row) => row.difficulty_tier === tier);
    if (!userId) return selectListenCloselySoundscape(fallbackRows, tier);

    const { start, end } = localDayBounds();
    const [todaySessions, historySessions, soundscapes] = await Promise.all([
      gameData
        .table("listen_closely_sessions")
        .select("soundscape_id")
        .eq("user_id", userId)
        .gte("played_at", start.toISOString())
        .lt("played_at", end.toISOString()),
      gameData
        .table("listen_closely_sessions")
        .select("soundscape_id,played_at")
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(500),
      gameData
        .table("listen_closely_soundscapes")
        .select("*")
        .eq("difficulty_tier", tier)
        .eq("is_active", true),
    ]);

    if (soundscapes.error) throw soundscapes.error;
    if (todaySessions.error) {
      console.warn("Listen Closely could not load today's soundscapes.", todaySessions.error);
    }
    if (historySessions.error) {
      console.warn("Listen Closely could not load soundscape history.", historySessions.error);
    }

    return selectListenCloselySoundscape(
      soundscapes.data ?? fallbackRows,
      tier,
      todaySessions.data ?? [],
      historySessions.data ?? [],
    );
  }, [userId]);

  const loadGame = useCallback(async (preferredState = null) => {
    setScreen("loading");
    setLoadNote("");
    setAudioWarning("");
    setSessionResult(null);
    setProgressPct(0);
    setHitFeedback(false);
    stopTimers();
    closeAudio();
    finalizingRef.current = false;
    sessionSavedRef.current = false;
    tapTimesRef.current = [];
    consumedPreviewTargetsRef.current = new Set();

    try {
      const state = preferredState ?? await loadUserState();
      const tier = Math.max(1, Math.min(BRAIN_COACH_MAX_LEVEL, Number(state.current_tier ?? 1)));
      const selected = await loadSoundscape(tier);
      const hasSeenTutorial = readListenCloselyTutorialSeen(userId);
      setUserState(state);
      setSoundscape(selected);
      setScreen(hasSeenTutorial ? "intro" : "tutorial");
    } catch (error) {
      console.warn("Listen Closely could not load from the database.", error);
      const fallbackState = preferredState ?? getDefaultListenCloselyUserState(userId ?? "");
      const hasSeenTutorial = readListenCloselyTutorialSeen(userId);
      setUserState(fallbackState);
      setSoundscape(selectListenCloselySoundscape(LISTEN_CLOSELY_FALLBACK_SOUNDSCAPES, fallbackState.current_tier ?? 1));
      setLoadNote(t("games.listenClosely.practiceFallback", "We will use a short practice soundscape."));
      setScreen(hasSeenTutorial ? "intro" : "tutorial");
    }
  }, [closeAudio, loadSoundscape, loadUserState, stopTimers, t, userId]);

  useEffect(() => {
    void loadGame();
    return () => {
      stopTimers();
      closeAudio();
    };
  }, [closeAudio, loadGame, stopTimers]);

  const saveSession = useCallback(async (result) => {
    if (!userId || sessionSavedRef.current) return null;
    sessionSavedRef.current = true;

    const payload = {
      user_id: userId,
      soundscape_id: result.soundscape_id,
      difficulty_tier: result.difficulty_tier,
      mode: result.mode,
      target_total: result.target_total,
      hits: result.hits,
      misses: result.misses,
      false_positives: result.false_positives,
      avg_reaction_time_ms: result.avg_reaction_time_ms,
      accuracy_pct: result.accuracy_pct,
      user_comparison_choice: result.user_comparison_choice,
      comparison_correct: result.comparison_correct,
      score: result.score,
      completed: result.completed,
      abandoned: result.abandoned,
      duration_seconds: result.duration_seconds,
    };

    const saved = await gameData.table("listen_closely_sessions").insert(payload);
    if (saved.error) {
      console.warn("Listen Closely could not save the session.", saved.error);
      sessionSavedRef.current = false;
    }
    const savedSession = Array.isArray(saved.data) ? saved.data[0] : saved.data;

    await recordCognitiveSession({
      userId,
      activityType: "listen_closely",
      domain: "attention",
      secondaryDomain: "processing_speed",
      difficulty: result.difficulty_tier,
      difficultyScale: "tier",
      completed: result.completed,
      abandoned: result.abandoned,
      score: result.score,
      accuracyPct: result.accuracy_pct,
      speedPct: result.avg_reaction_time_ms === null
        ? null
        : Math.max(0, Math.min(100, 100 - ((result.avg_reaction_time_ms / Math.max(1, normalizedSoundscape?.response_window_ms ?? 1600)) * 100))),
      durationSeconds: result.duration_seconds,
      language: gameLanguage,
      source: "listen_closely",
      sourceTable: "listen_closely_sessions",
      sourceSessionId: savedSession?.id ?? null,
      metadata: {
        mode: result.mode,
        targetSound: normalizedSoundscape?.target_sound_character,
        secondTargetSound: normalizedSoundscape?.second_target_sound_character,
        falsePositives: result.false_positives,
        comparisonChoice: result.user_comparison_choice,
      },
    });

    return saved.error ? null : savedSession;
  }, [gameLanguage, normalizedSoundscape?.response_window_ms, normalizedSoundscape?.second_target_sound_character, normalizedSoundscape?.target_sound_character, userId]);

  const updateUserState = useCallback(async (result) => {
    if (!userId) {
      const next = getNextListenCloselyStateAfterSession(userStateRef.current, result);
      setUserState(next);
      return next;
    }

    const latestState = await loadUserState().catch(() => userStateRef.current);
    const next = getNextListenCloselyStateAfterSession(latestState, result);
    setUserState(next);

    const saved = await gameData
      .table("listen_closely_user_state")
      .upsert(next, { onConflict: "user_id" })
      .select("*")
      .single();

    if (saved.data) {
      setUserState(saved.data);
      return saved.data;
    }
    if (saved.error) {
      console.warn("Listen Closely could not save progress state.", saved.error);
    }
    return next;
  }, [loadUserState, userId, userStateRef]);

  const finishSession = useCallback(async (abandoned = false, comparisonChoice = null) => {
    if (finalizingRef.current) return null;
    const currentSoundscape = soundscapeRef.current;
    if (!currentSoundscape) return null;
    finalizingRef.current = true;
    stopTimers();
    closeAudio();
    setSaving(true);

    const result = computeListenCloselyResult({
      soundscape: currentSoundscape,
      tapTimesMs: tapTimesRef.current,
      comparisonChoice,
      durationSeconds: currentSoundscape.duration_seconds,
      abandoned,
    });

    await saveSession(result);
    const nextState = !abandoned ? await updateUserState(result) : userStateRef.current;
    const resultWithState = { ...result, userState: nextState };
    setSessionResult(resultWithState);
    setSaving(false);
    if (!abandoned) setScreen("result");
    return resultWithState;
  }, [closeAudio, saveSession, soundscapeRef, stopTimers, updateUserState, userStateRef]);

  const playTargetSample = useCallback(async () => {
    const context = await getAudioContext();
    if (!context || !normalizedSoundscape) return;
    playListenCloselySound(context, normalizedSoundscape.target_sound_character, context.currentTime + 0.04, { volume: 0.28 });
    if (normalizedSoundscape.mode === "count_compare" && normalizedSoundscape.second_target_sound_character) {
      playListenCloselySound(context, normalizedSoundscape.second_target_sound_character, context.currentTime + 0.72, { volume: 0.28 });
    }
  }, [getAudioContext, normalizedSoundscape]);

  const closeTutorial = useCallback(() => {
    writeListenCloselyTutorialSeen(userId);
    setScreen("intro");
  }, [userId]);

  const openInstructions = useCallback(() => {
    setScreen("tutorial");
  }, []);

  const startSession = useCallback(async () => {
    if (!normalizedSoundscape) return;
    const context = await getAudioContext();
    setAudioWarning(context ? "" : audioWarning);
    stopTimers();
    finalizingRef.current = false;
    sessionSavedRef.current = false;
    tapTimesRef.current = [];
    consumedPreviewTargetsRef.current = new Set();
    setHitFeedback(false);
    setProgressPct(0);
    setScreen("playing");

    const delayMs = context ? 650 : 0;
    const contextStartAt = context ? context.currentTime + (delayMs / 1000) : 0;
    playStartMsRef.current = performance.now() + delayMs;
    if (context) {
      scheduleListenCloselySoundscape(context, normalizedSoundscape, contextStartAt);
    }

    progressTimerRef.current = window.setInterval(() => {
      const elapsed = Math.max(0, performance.now() - playStartMsRef.current);
      setProgressPct(Math.min(100, (elapsed / (normalizedSoundscape.duration_seconds * 1000)) * 100));
    }, 200);

    endTimerRef.current = window.setTimeout(() => {
      setProgressPct(100);
      if (normalizedSoundscape.mode === "count_compare") {
        stopTimers();
        closeAudio();
        setScreen("compare");
      } else {
        void finishSession(false);
      }
    }, (normalizedSoundscape.duration_seconds * 1000) + delayMs + 250);
  }, [audioWarning, closeAudio, finishSession, getAudioContext, normalizedSoundscape, stopTimers]);

  const handleTapTarget = useCallback(() => {
    const current = soundscapeRef.current ? normalizeListenCloselySoundscape(soundscapeRef.current) : null;
    if (!current || current.mode === "count_compare") return;

    const tapTime = Math.max(0, performance.now() - playStartMsRef.current);
    tapTimesRef.current.push(tapTime);
    const targetIndex = current.target_event_times.findIndex((targetTime, index) => (
      !consumedPreviewTargetsRef.current.has(index) &&
      tapTime >= targetTime &&
      tapTime <= targetTime + current.response_window_ms
    ));

    if (targetIndex >= 0) {
      consumedPreviewTargetsRef.current.add(targetIndex);
      setHitFeedback(true);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => setHitFeedback(false), 650);
    }
  }, [soundscapeRef]);

  const handleComparisonChoice = useCallback((choice) => {
    void finishSession(false, choice);
  }, [finishSession]);

  const handleExit = useCallback(() => {
    if (screen === "playing") {
      void finishSession(true).finally(() => onExit?.());
      return;
    }
    onExit?.();
    stopTimers();
    closeAudio();
  }, [closeAudio, finishSession, onExit, screen, stopTimers]);

  const resultState = sessionResult?.userState ?? userState ?? getDefaultListenCloselyUserState(userId ?? "");
  const resultIsGood = Number(sessionResult?.score ?? 0) >= 650;
  const modeLabel = normalizedSoundscape?.mode === "count_compare"
    ? t("games.listenClosely.modeCompare", "Count compare")
    : normalizedSoundscape?.mode === "oddball"
      ? t("games.listenClosely.modeOddball", "Odd sound")
      : t("games.listenClosely.modeFind", "Find it");
  const introInstruction = normalizedSoundscape?.mode === "oddball"
    ? t("games.listenClosely.tapSpecialShort", "Tap only for this sound.")
    : t("games.listenClosely.tapTargetShort", "Tap when you hear it.");
  const tutorialRespond = isCompareMode
    ? t("games.listenClosely.tutorialChoose", "Choose more")
    : t("games.listenClosely.tutorialTap", "Tap when heard");

  if (screen === "loading") {
    return (
      <BrainCoachLoadingState
        title={t("games.listenClosely.title", "Listen Closely")}
        backLabel={t("common.back", "Back")}
        onBack={handleExit}
        showHeader={false}
        label={t("games.listenClosely.preparing", "Preparing the sounds...")}
        testId="listen-closely-flow-shell"
        presentationId="brain_coach.activity_session.sharpen_senses.listen_closely.loading.touch"
        sceneId="brain_coach.activity_session.sharpen_senses.listen_closely"
      />
    );
  }

  if (!normalizedSoundscape) return null;

  if (screen === "intro") {
    return (
      <BrainCoachActivityShell
        title={t("games.listenClosely.title", "Listen Closely")}
        backLabel={t("common.back", "Back")}
        onBack={handleExit}
        testId="listen-closely-flow-shell"
        presentationId="brain_coach.activity_session.sharpen_senses.listen_closely.intro.touch"
        sceneId="brain_coach.activity_session.sharpen_senses.listen_closely"
        sceneKind="intro"
        sceneLayout="instruction_panel"
      >
        <div className="mx-auto flex w-full max-w-[780px] flex-col gap-5">
          <section className="rounded-[28px] border bg-white p-5 text-center shadow-[0_18px_46px_rgba(54,35,78,0.10)] sm:p-6" style={{ borderColor: "#EEE8F1" }}>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={openInstructions}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border bg-white px-4 text-[14px] font-extrabold"
                style={{ borderColor: BRAND.border, color: BRAND.purple }}
              >
                <Info size={18} aria-hidden="true" />
                {t("games.listenClosely.instructions", "Instructions")}
              </button>
            </div>
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[32px]">
              {t("games.listenClosely.introShort", "Listen, then choose.")}
            </h1>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="rounded-full px-4 py-2 text-[14px] font-extrabold" style={{ background: BRAND.softPurple, color: BRAND.purple }}>
                {t("common.level", "Level")} {currentTier}
              </span>
              <span className="rounded-full px-4 py-2 text-[14px] font-extrabold" style={{ background: "#FEF3C7", color: "#92400E" }}>
                {modeLabel}
              </span>
            </div>

            <div className="mt-4 rounded-[20px] border p-4" style={{ borderColor: BRAND.border, background: "#FFFCF7" }}>
              {isCompareMode ? (
                <>
                  <p className="text-[13px] font-black uppercase tracking-[0.04em]" style={{ color: BRAND.muted }}>
                    {t("games.listenClosely.taskLabel", "Your task")}
                  </p>
                  <p className="mt-1.5 font-display text-[24px] font-semibold leading-tight" style={{ color: BRAND.teal }}>
                    {t("games.listenClosely.whichMore", "Which sound happened more?")}
                  </p>
                  <div className="mx-auto mt-4 grid max-w-[560px] gap-3 sm:grid-cols-2">
                    {[targetLabel, secondTargetLabel].map((label) => (
                      <div key={label} className="rounded-[16px] border bg-white px-4 py-3 text-[18px] font-extrabold leading-tight shadow-sm" style={{ borderColor: BRAND.border, color: BRAND.purple }}>
                        {label}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-black uppercase tracking-[0.04em]" style={{ color: BRAND.muted }}>
                    {t("games.listenClosely.listenFor", "Listen for")}
                  </p>
                  <p className="mt-1.5 font-display text-[24px] font-semibold leading-tight" style={{ color: BRAND.purple }}>
                    {targetLabel}
                  </p>
                  <p className="mx-auto mt-2 max-w-[560px] text-[16px] font-semibold leading-relaxed" style={{ color: BRAND.muted }}>
                    {introInstruction}
                  </p>
                </>
              )}
            </div>

            {loadNote && (
              <p className="mx-auto mt-4 inline-flex rounded-full px-4 py-2 text-[18px] font-extrabold" style={{ background: BRAND.tealPale, color: BRAND.teal }}>
                {t("games.listenClosely.practiceLabel", "Practice round")}
              </p>
            )}
            {audioWarning && <p className="mt-4 text-[20px] font-semibold" style={{ color: "#92400E" }}>{audioWarning}</p>}

            <div className="mt-5 grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
              <button
                type="button"
                onClick={() => void playTargetSample()}
                disabled={!canUseListenCloselyAudio()}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-full border bg-white px-6 text-[16px] font-extrabold disabled:opacity-60"
                style={{ borderColor: BRAND.border, color: BRAND.purple }}
              >
                <Volume2 size={20} />
                {isCompareMode
                  ? t("games.listenClosely.sampleSounds", "Hear sounds")
                  : t("games.listenClosely.sampleTarget", "Hear target")}
              </button>
              <button
                type="button"
                onClick={() => void startSession()}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[17px] font-extrabold text-white shadow-vyva-hero active:scale-[0.99]"
                style={{ background: BRAND.purple }}
              >
                <Play size={20} fill="currentColor" />
                {t("games.listenClosely.start", "Start")}
              </button>
            </div>
          </section>
        </div>
      </BrainCoachActivityShell>
    );
  }

  if (screen === "tutorial") {
    return (
      <BrainCoachActivityShell
        title={t("games.listenClosely.title", "Listen Closely")}
        backLabel={t("common.back", "Back")}
        onBack={handleExit}
        testId="listen-closely-flow-shell"
        presentationId="brain_coach.activity_session.sharpen_senses.listen_closely.tutorial.touch"
        sceneId="brain_coach.activity_session.sharpen_senses.listen_closely"
        sceneKind="tutorial"
        sceneLayout="example_panel"
      >
        <div className="mx-auto flex w-full max-w-[780px] flex-col gap-5">
          <section className="rounded-[28px] border bg-white p-4 text-center shadow-[0_18px_46px_rgba(54,35,78,0.10)] sm:p-5" style={{ borderColor: "#EEE8F1" }}>
            <ListenTutorialVisual />
            <h1 className="mt-3 font-display text-[24px] font-semibold leading-tight tracking-[-0.03em] sm:text-[27px]">
              {t("games.listenClosely.tutorialSubtitle", "Hear the sound. Then respond.")}
            </h1>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: t("games.listenClosely.tutorialListen", "Listen"), Icon: Headphones },
                { label: tutorialRespond, Icon: isCompareMode ? Check : Waves },
                { label: t("games.listenClosely.tutorialResult", "See result"), Icon: Check },
              ].map(({ label, Icon }) => (
                <div key={label} className="min-h-[72px] rounded-[18px] px-2 py-2.5" style={{ background: BRAND.softPurple, color: BRAND.purple }}>
                  <Icon className="mx-auto" size={22} aria-hidden="true" />
                  <span className="mt-1.5 block text-[13px] font-black leading-tight sm:text-[14px]">{label}</span>
                </div>
              ))}
            </div>

            <p className="mx-auto mt-3 max-w-[560px] text-[13px] font-bold leading-snug sm:text-[14px]" style={{ color: BRAND.muted }}>
              {t("games.listenClosely.tutorialPace", "Take your time. One steady round is enough.")}
            </p>

            <button
              type="button"
              onClick={closeTutorial}
              className="mt-4 min-h-[52px] w-full rounded-full px-6 text-[17px] font-extrabold text-white shadow-vyva-card"
              style={{ background: BRAND.purple }}
            >
              {t("common.continue", "Continue")}
            </button>
          </section>
        </div>
      </BrainCoachActivityShell>
    );
  }

  if (screen === "playing") {
    return (
      <BrainCoachActivityShell
        title={t("games.listenClosely.title", "Listen Closely")}
        backLabel={t("common.exit", "Exit")}
        onBack={handleExit}
        testId="listen-closely-flow-shell"
        presentationId="brain_coach.activity_session.sharpen_senses.listen_closely.playing.touch"
        sceneId="brain_coach.activity_session.sharpen_senses.listen_closely"
        sceneKind="playing"
        sceneLayout="audio_focus"
        contentClassName="sm:mt-4"
      >
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4">
          <header className="rounded-[24px] border bg-white p-4 shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-[28px] font-semibold leading-[1.1]" style={{ color: BRAND.muted }}>
                  {isCompareMode
                    ? t("games.listenClosely.justListen", "Just listen.")
                    : t("games.listenClosely.tapWhenHeard", "Tap when you hear it.")}
                </h1>
              </div>
            </div>
            <div className="mt-4">
              <ProgressBar value={progressPct} />
            </div>
          </header>

          <section className="rounded-[28px] border bg-white p-5 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <p className="text-[20px] font-black uppercase tracking-[0.04em]" style={{ color: BRAND.muted }}>
              {isCompareMode ? t("games.listenClosely.playingLabelCompare", "Listen to both sounds") : t("games.listenClosely.targetSound", "Target sound")}
            </p>
            <p className="mt-1 font-display text-[36px] font-bold leading-tight" style={{ color: BRAND.purple }}>
              {isCompareMode ? `${targetLabel} / ${secondTargetLabel}` : targetLabel}
            </p>
            <ListeningOrb active hitFeedback={hitFeedback} />
            {!isCompareMode && (
              <button
                type="button"
                onClick={handleTapTarget}
                className="mt-4 flex min-h-[96px] w-full items-center justify-center rounded-full px-6 text-[30px] font-black text-white shadow-vyva-hero active:scale-[0.99]"
                style={{ background: hitFeedback ? BRAND.teal : BRAND.gold, color: hitFeedback ? "white" : "#2B2233" }}
              >
                {hitFeedback ? t("games.listenClosely.heard", "Heard it") : t("games.listenClosely.tapButton", "I heard it")}
              </button>
            )}
          </section>
        </div>

        <style>{`
          .listen-closely-wave {
            animation: listen-closely-pulse 2.2s ease-in-out infinite;
          }
          .listen-closely-wave-delay {
            animation-delay: 0.55s;
          }
          @keyframes listen-closely-pulse {
            0%, 100% { transform: scale(0.92); opacity: 0.7; }
            50% { transform: scale(1.04); opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .listen-closely-wave {
              animation: none;
            }
          }
        `}</style>
      </BrainCoachActivityShell>
    );
  }

  if (screen === "compare") {
    return (
      <BrainCoachActivityShell
        title={t("games.listenClosely.title", "Listen Closely")}
        backLabel={t("common.exit", "Exit")}
        onBack={handleExit}
        testId="listen-closely-flow-shell"
        presentationId="brain_coach.activity_session.sharpen_senses.listen_closely.compare.touch"
        sceneId="brain_coach.activity_session.sharpen_senses.listen_closely"
        sceneKind="decision"
        sceneLayout="choice_panel"
        contentClassName="items-center justify-center"
      >
        <section className="w-full max-w-[740px] rounded-[28px] border bg-white p-6 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
          <div className="mx-auto flex h-[86px] w-[86px] items-center justify-center rounded-[26px]" style={{ background: BRAND.tealPale, color: BRAND.teal }}>
            <Headphones size={50} />
          </div>
          <h1 className="mt-5 font-display text-[42px] font-bold leading-tight">
            {t("games.listenClosely.whichMore", "Which sound happened more?")}
          </h1>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[normalizedSoundscape.target_sound_character, normalizedSoundscape.second_target_sound_character].map((sound) => (
              <button
                key={sound}
                type="button"
                onClick={() => handleComparisonChoice(sound)}
                disabled={saving}
                className="min-h-[104px] rounded-[22px] border bg-white px-5 text-[28px] font-black shadow-sm transition-transform active:scale-[0.99]"
                style={{ borderColor: BRAND.border, color: BRAND.purple }}
              >
                {soundLabel(t, sound)}
              </button>
            ))}
          </div>
        </section>
      </BrainCoachActivityShell>
    );
  }

  const score = sessionResult?.score ?? 0;
  const accuracy = Math.round(sessionResult?.accuracy_pct ?? 0);
  const progress = Math.max(0, Math.min(100, ((resultState.consecutive_wins ?? 0) / 3) * 100));
  const completedTier = Number(sessionResult?.difficulty_tier ?? resultState.current_tier ?? 1);
  const resultTier = Number(resultState.current_tier ?? completedTier);
  const resultBand = getBrainCoachLevelBand(resultTier);
  const levelUnlocked = resultTier > completedTier;
  const nextTier = Math.min(BRAIN_COACH_MAX_LEVEL, resultTier + 1);
  const winsRemaining = Math.max(0, 3 - Number(resultState.consecutive_wins ?? 0));
  const progressHint = levelUnlocked
    ? t("games.listenClosely.levelReady", "Level {level} is ready.", { level: `${resultTier} - ${resultBand.label}` })
    : resultIsGood
      ? t("games.listenClosely.levelProgressHint", "{n} more good rounds to unlock Level {level}.", { n: winsRemaining, level: nextTier })
      : getBrainCoachSupportiveProgressCopy({ advanced: false, level: completedTier });
  const continueLabel = levelUnlocked
    ? t("games.listenClosely.startLevel", "Start Level {level}", { level: resultTier })
    : t("games.listenClosely.nextRound", "Next round");

  return (
    <BrainCoachActivityShell
      title={t("games.listenClosely.title", "Listen Closely")}
      showHeader={false}
      testId="listen-closely-flow-shell"
      presentationId="brain_coach.activity_session.sharpen_senses.listen_closely.result.touch"
      sceneId="brain_coach.activity_session.sharpen_senses.listen_closely"
      sceneKind="completion"
      sceneLayout="modal_actions"
      state="complete"
    >
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
        <BrainGameCompletionDialog
          title={
            resultIsGood
              ? t("games.listenClosely.resultGood", "Good listening.")
              : t("games.listenClosely.resultTry", "Nice practice. Listening gets easier with time.")
          }
          summary={progressHint}
          metrics={[
            { label: t("games.listenClosely.accuracy", "Accuracy"), value: `${accuracy}%` },
            { label: t("games.listenClosely.score", "Score"), value: score },
            { label: t("games.listenClosely.heardCount", "Heard"), value: `${sessionResult?.hits ?? 0}/${sessionResult?.target_total ?? 0}` },
            { label: t("games.listenClosely.streak", "Streak"), value: `${resultState.streak_days ?? 0}` },
          ]}
          details={
            <div className="rounded-[20px] border border-[#EADFF8] bg-[#FFFCF7] px-4 py-4 text-left">
              <div className="flex items-center justify-between gap-3 text-[15px] font-black text-vyva-text-1">
                <span>{t("games.listenClosely.progress", "Level progress")}</span>
                <span className="text-vyva-purple">{resultState.consecutive_wins ?? 0}/3</span>
              </div>
              <div className="mt-3">
                <ProgressBar value={progress} />
              </div>
              <p className="mt-2 text-[14px] font-bold text-vyva-text-2">
                {t("games.listenClosely.currentLevel", "Current level")}: {resultTier} - {resultBand.label}
              </p>
            </div>
          }
          continueLabel={continueLabel}
          anotherLabel={t("games.listenClosely.finish", "Finish")}
          onContinue={() => void loadGame(resultState)}
          onAnother={handleExit}
          disabled={saving}
        />
      </div>
    </BrainCoachActivityShell>
  );
}
