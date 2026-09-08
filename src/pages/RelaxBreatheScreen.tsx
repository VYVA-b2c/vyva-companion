import { ArrowLeft, CheckCircle2, Headphones, Loader2, Mic, Pause, Play, RotateCcw, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import { adjustBreathingIntentForControl, parseBreathingVoiceText, type BreathingVoiceControl } from "@/lib/breathingVoice";
import { apiFetch } from "@/lib/queryClient";
import {
  BREATHING_MEDITATION_AGENT_SLUG,
  buildBreathingMeditationAgentContext,
} from "../../shared/breathingMeditationAgent";

type BreathingIntent = {
  mood?: string;
  purpose?: string;
  difficulty?: number | "easy" | "medium" | "harder";
  durationMinutes?: number;
  mode?: "voice" | "visual";
  safetyFlags?: string[];
  freeText?: string;
};

type BreathingPhase = {
  key: string;
  title: string;
  instruction: string;
  cue: string;
  seconds: number;
};

type BreathingPlan = {
  exerciseSlug: string;
  title: string;
  description: string;
  purpose: string;
  difficulty: number;
  durationMinutes: number;
  pattern: Record<string, unknown>;
  phases: BreathingPhase[];
  safetyNotes: string[];
  voiceStyle: string;
  voicePrompt: string;
};

type BreathingRecommendationOption = {
  exerciseSlug: string;
  name: string;
  description: string;
  difficulty: number;
  durationMinutes: number;
  why: string;
  plan: BreathingPlan;
};

type BreathingRecommendationResponse = {
  recommended: BreathingRecommendationOption | null;
  options: BreathingRecommendationOption[];
  safetyBlock: boolean;
  safetyMessage?: string;
};

type BreathingSessionResponse = {
  session?: {
    id: string;
    status: string;
  };
  plan?: BreathingPlan;
};

type RelaxBreatheGuideMode = "voice" | "visual";
type SessionState = "choosing" | "planning" | "confirming" | "running" | "paused" | "completed" | "stopped";

const INTENT_PRESETS: Array<{ id: string; label: string; body: string; intent: BreathingIntent }> = [
  {
    id: "calm",
    label: "Calm",
    body: "Ease stress",
    intent: { purpose: "calm", mood: "tense", difficulty: "easy", durationMinutes: 3, mode: "voice" },
  },
  {
    id: "sleep",
    label: "Sleep",
    body: "Wind down",
    intent: { purpose: "sleep", mood: "restless", difficulty: "easy", durationMinutes: 5, mode: "voice" },
  },
  {
    id: "focus",
    label: "Focus",
    body: "Reset gently",
    intent: { purpose: "focus", mood: "scattered", difficulty: "medium", durationMinutes: 3, mode: "voice" },
  },
  {
    id: "easy",
    label: "Easy",
    body: "Start soft",
    intent: { purpose: "settle", mood: "unsure", difficulty: "easy", durationMinutes: 2, mode: "voice" },
  },
];

function fallbackPlan(): BreathingPlan {
  return {
    exerciseSlug: "gentle-calm-breath",
    title: "Gentle Calm Breath",
    description: "A simple calming session with a longer exhale.",
    purpose: "calm",
    difficulty: 1,
    durationMinutes: 3,
    pattern: { inhale: 4, exhale: 6 },
    safetyNotes: ["Stop if breathing feels painful, difficult, dizzy, or unusual."],
    voiceStyle: "gentle",
    voicePrompt: [
      "Ask what the user needs, then guide a gentle calm breathing session.",
      "Use simple language and keep listening so the user can interrupt, slow down, or stop.",
      "Stop if the user reports dizziness, pain, chest discomfort, or unusual breathing.",
    ].join(" "),
    phases: [
      { key: "arrive", title: "Arrive", instruction: "Sit comfortably and feel the chair supporting you.", cue: "Settle in.", seconds: 30 },
      { key: "breathe", title: "Breathe slowly", instruction: "Breathe in gently. Breathe out a little longer.", cue: "In 4, out 6.", seconds: 120 },
      { key: "return", title: "Return", instruction: "Notice the room and take one normal breath.", cue: "Come back gently.", seconds: 30 },
    ],
  };
}

function buildMarcoPrompt(plan: BreathingPlan, phase: BreathingPhase, phaseIndex: number) {
  return [
    plan.voicePrompt,
    `Current phase ${phaseIndex + 1} of ${plan.phases.length}: ${phase.title}.`,
    `Visible instruction: ${phase.instruction}`,
    `Visual cue: ${phase.cue}`,
    "Keep listening for the user. They can say slower, pause, stop, easier, or what is happening.",
  ].join(" ");
}

function usePrefersReducedMotion() {
  const readPreference = () => (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPreference);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json() as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // Keep the status text.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export default function RelaxBreatheScreen() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const prefersReducedMotion = usePrefersReducedMotion();
  const stageTimerRef = useRef<number | null>(null);
  const handledTranscriptAtRef = useRef<number>(0);
  const [guideMode, setGuideMode] = useState<RelaxBreatheGuideMode>("voice");
  const [sessionState, setSessionState] = useState<SessionState>("choosing");
  const [plan, setPlan] = useState<BreathingPlan | null>(null);
  const [proposedPlan, setProposedPlan] = useState<BreathingPlan | null>(null);
  const [options, setOptions] = useState<BreathingRecommendationOption[]>([]);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastIntent, setLastIntent] = useState<BreathingIntent>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    startVoice,
    stopVoice,
    sendText,
    sendContextUpdate,
    status: voiceStatus,
    isConnecting,
    isMicMuted,
    lastError: voiceError,
    transcript,
  } = useVyvaVoice();

  const copy = useMemo(() => ({
    title: t("activities.relaxBreathe.title", "Relax & Breathe"),
    intro: t("activities.relaxBreathe.intro", "A guided breathing session made for right now."),
    backToActivities: t("activities.relaxBreathe.backToActivities", "Back to activities"),
    safety: t("activities.relaxBreathe.safety", "If breathing feels difficult, painful, dizzy, or unusual, stop and seek help."),
    chooseTitle: t("activities.relaxBreathe.chooseTitle", "What would help now?"),
    chooseBody: t("activities.relaxBreathe.chooseBody", "Choose once. VYVA will shape the session and guide you."),
    talkToMarco: t("activities.relaxBreathe.talkToMarco", "Talk with Marco"),
    planning: t("activities.relaxBreathe.planning", "Choosing a gentle plan..."),
    listening: t("activities.relaxBreathe.listening", "Listening"),
    muted: t("activities.relaxBreathe.muted", "Muted"),
    voiceMode: t("activities.relaxBreathe.voiceMode", "Voice"),
    visualMode: t("activities.relaxBreathe.visualMode", "Visual"),
    pause: t("activities.relaxBreathe.pause", "Pause"),
    resume: t("activities.relaxBreathe.resume", "Resume"),
    stop: t("activities.relaxBreathe.stop", "Stop"),
    finish: t("activities.relaxBreathe.finish", "Finish"),
    tryAgain: t("activities.relaxBreathe.tryAgain", "Try again"),
    completeTitle: t("activities.relaxBreathe.completeTitle", "A calm pause is complete."),
    completeBody: t("activities.relaxBreathe.completeBody", "VYVA will remember what helped."),
    saferNext: t("activities.relaxBreathe.saferNext", "This may not be the right moment for breathing practice. Stop and seek help if symptoms feel unusual."),
    fallbackNotice: t("activities.relaxBreathe.fallbackNotice", "Using a simple calm session for now."),
    proposedTitle: t("activities.relaxBreathe.proposedTitle", "Marco suggests"),
    confirmStart: t("activities.relaxBreathe.confirmStart", "Start this"),
    askForChange: t("activities.relaxBreathe.askForChange", "Change it"),
    voiceIntentHint: t("activities.relaxBreathe.voiceIntentHint", "Say calm, sleep, focus, easier, shorter, or stop."),
    awaitingConfirm: t("activities.relaxBreathe.awaitingConfirm", "Waiting for your yes."),
    slower: t("activities.relaxBreathe.slower", "Slower"),
  }), [t]);

  const currentPhase = plan?.phases[phaseIndex] ?? null;
  const audioIsLive = voiceStatus === "connected";

  const clearStageTimer = useCallback(() => {
    if (stageTimerRef.current !== null) {
      window.clearTimeout(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  }, []);

  const sendPhasePrompt = useCallback((nextPlan: BreathingPlan, nextPhaseIndex: number) => {
    const phase = nextPlan.phases[nextPhaseIndex];
    if (!phase) return;
    sendContextUpdate(`Breathing session context: ${JSON.stringify({
      app_entrypoint: "relax_breathe_session",
      exercise_slug: nextPlan.exerciseSlug,
      session_title: nextPlan.title,
      purpose: nextPlan.purpose,
      difficulty: nextPlan.difficulty,
      duration_minutes: nextPlan.durationMinutes,
      current_phase_number: nextPhaseIndex + 1,
      phase_count: nextPlan.phases.length,
      phase_key: phase.key,
      phase_title: phase.title,
      phase_instruction: phase.instruction,
      breathing_cue: phase.cue,
      safety_line: copy.safety,
    })}`);
    sendText(buildMarcoPrompt(nextPlan, phase, nextPhaseIndex), { invisibleInTranscript: true });
  }, [copy.safety, sendContextUpdate, sendText]);

  const patchSession = useCallback(async (status: SessionState, extra: Record<string, unknown> = {}) => {
    if (!sessionId) return;
    const apiStatus = status === "running" ? "active" : status;
    try {
      await apiFetch(`/api/breathing/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: apiStatus,
          ...extra,
        }),
      });
    } catch (error) {
      console.warn("[RelaxBreathe] Could not update breathing session", error);
    }
  }, [sessionId]);

  const startVoiceForPlan = useCallback(async (nextPlan: BreathingPlan) => {
    if (guideMode !== "voice" || audioIsLive || isConnecting) return;
    const agentContext = buildBreathingMeditationAgentContext({
      activityId: "relax_breathe",
      language,
      durationSeconds: nextPlan.durationMinutes * 60,
      patternId: nextPlan.exerciseSlug,
      inhaleSeconds: Number(nextPlan.pattern.inhale ?? 0),
      exhaleSeconds: Number(nextPlan.pattern.exhale ?? 0),
      holdSeconds: Number(nextPlan.pattern.hold ?? 0),
    });
    await startVoice(nextPlan.voicePrompt, undefined, {
      agentSlug: BREATHING_MEDITATION_AGENT_SLUG,
      autoStartListening: true,
      dynamicVariables: {
        ...agentContext,
        app_entrypoint: "relax_breathe_session",
        exercise_slug: nextPlan.exerciseSlug,
        session_title: nextPlan.title,
        purpose: nextPlan.purpose,
        difficulty: nextPlan.difficulty,
        duration_minutes: nextPlan.durationMinutes,
        safety_line: copy.safety,
      },
    });
  }, [audioIsLive, copy.safety, guideMode, isConnecting, language, startVoice]);

  const beginPlan = useCallback(async (
    nextPlan: BreathingPlan,
    intent: BreathingIntent,
    source: "app" | "voice" = "app",
  ) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setLastIntent(intent);
    setPlan(nextPlan);
    setProposedPlan(null);
    setPhaseIndex(0);
    setSessionState("running");

    try {
      const response = await apiFetch("/api/breathing/sessions", {
        method: "POST",
        body: JSON.stringify({
          exerciseSlug: nextPlan.exerciseSlug,
          intent,
          plan: nextPlan,
          source,
          status: "active",
        }),
      });
      const body = await readJson<BreathingSessionResponse>(response);
      setSessionId(body.session?.id ?? null);
    } catch (error) {
      console.warn("[RelaxBreathe] Breathing session was not saved", error);
      setStatusMessage(copy.fallbackNotice);
    }

    if (guideMode === "voice") {
      try {
        await startVoiceForPlan(nextPlan);
        sendPhasePrompt(nextPlan, 0);
      } catch (error) {
        console.warn("[RelaxBreathe] Voice guide could not start", error);
        setStatusMessage(copy.fallbackNotice);
      }
    }
  }, [copy.fallbackNotice, guideMode, sendPhasePrompt, startVoiceForPlan]);

  const requestPlan = useCallback(async (
    intent: BreathingIntent,
    source: "app" | "voice" = "app",
    options: { waitForConfirmation?: boolean } = {},
  ) => {
    clearStageTimer();
    setSessionState("planning");
    setErrorMessage(null);
    setStatusMessage(null);
    setLastIntent(intent);
    setProposedPlan(null);

    try {
      const response = await apiFetch("/api/breathing/recommend", {
        method: "POST",
        body: JSON.stringify({ intent, limit: 3 }),
      });
      const recommendation = await readJson<BreathingRecommendationResponse>(response);
      if (recommendation.safetyBlock) {
        setSessionState("choosing");
        setErrorMessage(recommendation.safetyMessage ?? copy.saferNext);
        setOptions([]);
        return;
      }

      const nextOptions = recommendation.options ?? [];
      setOptions(nextOptions);
      const selected = recommendation.recommended?.plan ?? nextOptions[0]?.plan;
      if (selected) {
        if (options.waitForConfirmation) {
          setProposedPlan(selected);
          setSessionState("confirming");
          setStatusMessage(copy.awaitingConfirm);
          sendContextUpdate(`Breathing recommendation ready: ${JSON.stringify({
            title: selected.title,
            duration_minutes: selected.durationMinutes,
            difficulty: selected.difficulty,
            purpose: selected.purpose,
            safety_notes: selected.safetyNotes,
            next_step: "Ask the user to confirm before starting. They can say yes, easier, shorter, different, or stop.",
          })}`);
          sendText(
            `I suggest ${selected.title} for ${selected.durationMinutes} minutes. It is level ${selected.difficulty}. Ask the user if they want to start, or if they want it easier, shorter, or different.`,
            { invisibleInTranscript: true },
          );
          return;
        }
        await beginPlan(selected, intent, source);
        return;
      }
      throw new Error("No breathing plan returned");
    } catch (error) {
      console.warn("[RelaxBreathe] Breathing recommendation failed", error);
      const fallback = fallbackPlan();
      if (options.waitForConfirmation) {
        setProposedPlan(fallback);
        setSessionState("confirming");
        setStatusMessage(copy.fallbackNotice);
        return;
      }
      await beginPlan(fallback, intent, source);
    }
  }, [beginPlan, clearStageTimer, copy.awaitingConfirm, copy.fallbackNotice, copy.saferNext, sendContextUpdate, sendText]);

  const startVoiceIntent = useCallback(async () => {
    setGuideMode("voice");
    setErrorMessage(null);
    setProposedPlan(null);
    setStatusMessage(copy.listening);
    try {
      const agentContext = buildBreathingMeditationAgentContext({
        activityId: "relax_breathe",
        language,
        guidanceMode: "guided_audio",
      });
      await startVoice([
        "You are Marco, VYVA's breathing coach.",
        "Start by asking what the user needs from breathing today: calm, sleep, focus, energy, or something else.",
        "Ask about difficulty and time only if useful.",
        "Do not begin intense breathwork. Keep it senior-friendly, gentle, and safety-first.",
        "If the user reports dizziness, chest pain, painful breathing, or unusual shortness of breath, stop and advise seeking help.",
      ].join(" "), undefined, {
        agentSlug: BREATHING_MEDITATION_AGENT_SLUG,
        autoStartListening: true,
        dynamicVariables: {
          ...agentContext,
          app_entrypoint: "relax_breathe_intent",
          safety_line: copy.safety,
        },
      });
    } catch (error) {
      console.warn("[RelaxBreathe] Voice intent chat could not start", error);
      setErrorMessage(copy.fallbackNotice);
    }
  }, [copy.fallbackNotice, copy.listening, copy.safety, language, startVoice]);

  const pauseSession = useCallback(() => {
    clearStageTimer();
    setSessionState("paused");
    void patchSession("paused", { eventType: "session_paused" });
    sendText("Pause the breathing guidance. Stay quiet and wait for the user to resume.", { invisibleInTranscript: true });
  }, [clearStageTimer, patchSession, sendText]);

  const resumeSession = useCallback(() => {
    if (!plan) return;
    setSessionState("running");
    void patchSession("running", { eventType: "session_resumed" });
    sendPhasePrompt(plan, phaseIndex);
  }, [patchSession, phaseIndex, plan, sendPhasePrompt]);

  const slowCurrentSession = useCallback(() => {
    if (!plan) return;
    const slowerPlan = {
      ...plan,
      phases: plan.phases.map((phase, index) => ({
        ...phase,
        seconds: index >= phaseIndex ? Math.round(phase.seconds * 1.35) : phase.seconds,
      })),
    };
    setPlan(slowerPlan);
    setStatusMessage("Slowing down.");
    void patchSession("running", {
      eventType: "pace_slowed",
      eventPayload: { from_phase: phaseIndex + 1 },
    });
    sendContextUpdate("The user asked to slow down. Speak more slowly, lengthen pauses, and keep the breathing pace gentle.");
  }, [patchSession, phaseIndex, plan, sendContextUpdate]);

  const makeCurrentSessionEasier = useCallback(() => {
    setStatusMessage("Making it easier.");
    void patchSession("running", { eventType: "made_easier" });
    sendContextUpdate("The user asked for an easier session. Drop any holds, reduce effort, and use the gentlest possible pacing.");
  }, [patchSession, sendContextUpdate]);

  const shortenCurrentSession = useCallback(() => {
    if (!plan) return;
    const shortenedPlan = {
      ...plan,
      durationMinutes: Math.max(1, Math.min(plan.durationMinutes, Math.ceil((phaseIndex + 1) / 2))),
      phases: plan.phases.slice(0, Math.max(phaseIndex + 1, 1)),
    };
    setPlan(shortenedPlan);
    setStatusMessage("Shortening this session.");
    void patchSession("running", { eventType: "session_shortened" });
    sendContextUpdate("The user asked for a shorter session. Finish calmly after the current phase.");
  }, [patchSession, phaseIndex, plan, sendContextUpdate]);

  const stopSession = useCallback(() => {
    clearStageTimer();
    stopVoice();
    setSessionState("stopped");
    void patchSession("stopped", {
      stoppedReason: "user_stopped",
      eventType: "session_stopped",
    });
  }, [clearStageTimer, patchSession, stopVoice]);

  const finishSession = useCallback(() => {
    clearStageTimer();
    stopVoice();
    setSessionState("completed");
    void patchSession("completed", {
      moodAfter: "calmer",
      comfortRating: 4,
      eventType: "session_completed",
    });
  }, [clearStageTimer, patchSession, stopVoice]);

  const restartSession = useCallback(() => {
    clearStageTimer();
    stopVoice();
    setPlan(null);
    setOptions([]);
    setSessionId(null);
    setPhaseIndex(0);
    setSessionState("choosing");
    setStatusMessage(null);
    setErrorMessage(null);
    setProposedPlan(null);
  }, [clearStageTimer, stopVoice]);

  const handleVoiceControl = useCallback((control: BreathingVoiceControl) => {
    if (control === "confirm") {
      if (sessionState === "confirming" && proposedPlan) {
        void beginPlan(proposedPlan, lastIntent, "voice");
        return;
      }
      if (sessionState === "paused") {
        resumeSession();
        return;
      }
    }

    if (control === "pause" && sessionState === "running") {
      pauseSession();
      return;
    }

    if (control === "resume" && sessionState === "paused") {
      resumeSession();
      return;
    }

    if (control === "stop") {
      if (sessionState === "confirming" || sessionState === "planning") {
        setSessionState("choosing");
        setProposedPlan(null);
        setStatusMessage(null);
        sendContextUpdate("The user stopped the breathing plan before it started.");
        return;
      }
      stopSession();
      return;
    }

    if (control === "finish" && (sessionState === "running" || sessionState === "paused")) {
      finishSession();
      return;
    }

    if (control === "slower" && sessionState === "running") {
      slowCurrentSession();
      return;
    }

    if (control === "easier" && sessionState === "running") {
      makeCurrentSessionEasier();
      return;
    }

    if (control === "shorter" && sessionState === "running") {
      shortenCurrentSession();
      return;
    }

    if (["easier", "shorter", "harder", "longer", "change"].includes(control)) {
      const nextIntent = control === "change"
        ? { ...lastIntent, freeText: "User asked for a different breathing option" }
        : adjustBreathingIntentForControl(lastIntent, control);
      void requestPlan(nextIntent, "voice", { waitForConfirmation: true });
      return;
    }

    if (control === "status") {
      const message = proposedPlan
        ? `A ${proposedPlan.durationMinutes} minute ${proposedPlan.title} is ready. Say yes to start, or say easier, shorter, or different.`
        : plan
          ? `You are in ${plan.title}, phase ${phaseIndex + 1} of ${plan.phases.length}: ${currentPhase?.title ?? "breathing"}.`
          : "We are choosing a breathing plan. Say calm, sleep, focus, easy, or stop.";
      sendText(message, { invisibleInTranscript: true });
    }
  }, [
    beginPlan,
    currentPhase?.title,
    finishSession,
    lastIntent,
    makeCurrentSessionEasier,
    pauseSession,
    phaseIndex,
    plan,
    proposedPlan,
    requestPlan,
    resumeSession,
    sendContextUpdate,
    sendText,
    sessionState,
    shortenCurrentSession,
    slowCurrentSession,
    stopSession,
  ]);

  const goBackToActivities = useCallback(() => {
    clearStageTimer();
    stopVoice();
    navigate("/activities");
  }, [clearStageTimer, navigate, stopVoice]);

  useEffect(() => {
    try {
      if (navigator.userAgent.toLowerCase().includes("jsdom")) return () => stopVoice();
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch {
      // Some test environments do not implement scrollTo.
    }

    return () => {
      clearStageTimer();
      stopVoice();
    };
  }, [clearStageTimer, stopVoice]);

  useEffect(() => {
    clearStageTimer();
    if (!plan || sessionState !== "running") return undefined;

    const phase = plan.phases[phaseIndex];
    if (!phase) return undefined;

    stageTimerRef.current = window.setTimeout(() => {
      const nextPhaseIndex = phaseIndex + 1;
      if (nextPhaseIndex >= plan.phases.length) {
        finishSession();
        return;
      }
      setPhaseIndex(nextPhaseIndex);
      sendPhasePrompt(plan, nextPhaseIndex);
    }, Math.max(15, phase.seconds) * 1000);

    return clearStageTimer;
  }, [clearStageTimer, finishSession, phaseIndex, plan, sendPhasePrompt, sessionState]);

  useEffect(() => {
    const latestUserEntry = [...transcript].reverse().find((entry) => entry.from === "user");
    if (!latestUserEntry || latestUserEntry.timestamp <= handledTranscriptAtRef.current) return;
    handledTranscriptAtRef.current = latestUserEntry.timestamp;

    const parsed = parseBreathingVoiceText(latestUserEntry.text);
    if (parsed.safetyBlock) {
      clearStageTimer();
      if (sessionState === "running" || sessionState === "paused") {
        void patchSession("stopped", {
          stoppedReason: "safety_signal",
          eventType: "safety_stop",
          eventPayload: {
            user_message: latestUserEntry.text.slice(0, 240),
            safety_flags: parsed.intent?.safetyFlags ?? [],
          },
        });
      }
      stopVoice();
      setSessionState("choosing");
      setProposedPlan(null);
      setErrorMessage(copy.saferNext);
      return;
    }

    if (parsed.control) {
      handleVoiceControl(parsed.control);
      return;
    }

    if (parsed.intent && (sessionState === "choosing" || sessionState === "confirming" || sessionState === "planning")) {
      void requestPlan(parsed.intent, "voice", { waitForConfirmation: true });
      return;
    }

    if (parsed.intent && (sessionState === "running" || sessionState === "paused")) {
      const nextIntent = {
        ...lastIntent,
        ...parsed.intent,
      };
      clearStageTimer();
      setSessionState("planning");
      void requestPlan(nextIntent, "voice", { waitForConfirmation: true });
    }
  }, [
    clearStageTimer,
    copy.saferNext,
    handleVoiceControl,
    lastIntent,
    patchSession,
    requestPlan,
    sessionState,
    stopVoice,
    transcript,
  ]);

  const voiceStatusLabel = isConnecting
    ? copy.planning
    : guideMode === "voice"
      ? isMicMuted
        ? copy.muted
        : copy.listening
      : copy.visualMode;

  if (sessionState === "completed") {
    return (
      <section className="min-h-screen bg-[radial-gradient(circle_at_top,#F2FFFB_0%,#F8F4EF_46%,#F2ECE5_100%)] px-4 py-4 text-[#263238] sm:px-6 sm:py-6" data-testid="relax-breathe-screen">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-3xl items-center justify-center">
          <div className="w-full rounded-[2rem] border border-[#B7EFE6] bg-white/90 p-6 text-center shadow-[0_24px_70px_rgba(32,88,74,0.12)] sm:p-8" data-testid="relax-breathe-complete">
            <CheckCircle2 className="mx-auto h-14 w-14 text-[#0F8274]" aria-hidden="true" />
            <h1 className="mt-5 font-serif text-4xl text-[#173F38] sm:text-5xl">{copy.completeTitle}</h1>
            <p className="mx-auto mt-3 max-w-md text-lg font-semibold text-[#6F625B]">{copy.completeBody}</p>
            {plan && (
              <p className="mt-4 text-sm font-bold uppercase tracking-[0.12em] text-[#0F8274]">
                {plan.title} · {plan.durationMinutes} min
              </p>
            )}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0F8274] px-6 py-4 text-lg font-bold text-white shadow-[0_14px_28px_rgba(15,130,116,0.18)]"
                onClick={restartSession}
                data-testid="button-relax-breathe-try-again"
              >
                <RotateCcw className="h-5 w-5" aria-hidden="true" />
                {copy.tryAgain}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D8CEC4] bg-white px-6 py-4 text-lg font-bold text-[#4B3F39]"
                onClick={goBackToActivities}
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                {copy.backToActivities}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="min-h-screen bg-[radial-gradient(circle_at_top,#F2FFFB_0%,#F8F4EF_46%,#F2ECE5_100%)] px-4 py-4 text-[#263238] sm:px-6 sm:py-6"
      data-testid="relax-breathe-screen"
    >
      <style>
        {`
          @keyframes relax-breathe-pulse {
            0%, 100% { transform: scale(0.9); opacity: 0.84; }
            50% { transform: scale(1.08); opacity: 1; }
          }
          @keyframes relax-breathe-halo {
            0%, 100% { transform: scale(0.92); opacity: 0.5; }
            50% { transform: scale(1.08); opacity: 0.9; }
          }
          @media (prefers-reduced-motion: reduce) {
            .relax-breathe-orb,
            .relax-breathe-halo {
              animation: none !important;
            }
          }
        `}
      </style>

      <div className="mx-auto grid w-full max-w-6xl gap-5 pb-24 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="rounded-[2rem] border border-[#B7EFE6] bg-[#ECFFF9] p-5 shadow-[0_24px_70px_rgba(32,88,74,0.12)] sm:p-7">
          <button
            type="button"
            className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#CFE8E3] bg-white text-[#1F5B52]"
            onClick={goBackToActivities}
            aria-label={copy.backToActivities}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold uppercase tracking-[0.08em] text-[#0F8274]">
              <Headphones className="h-4 w-4" aria-hidden="true" />
              {plan ? `${plan.durationMinutes} min` : "Personal guide"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#0F8274] px-4 py-2 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(15,130,116,0.18)]" data-testid="relax-breathe-voice-status">
              <Mic className="h-4 w-4" aria-hidden="true" />
              {voiceStatusLabel}
            </span>
          </div>

          <div className="mt-5">
            <h1 className="font-serif text-5xl leading-none text-[#173F38] sm:text-6xl lg:text-7xl">{copy.title}</h1>
            <p className="mt-4 max-w-2xl text-xl font-semibold text-[#6F625B]">{copy.intro}</p>
          </div>

          {sessionState === "choosing" || sessionState === "planning" || sessionState === "confirming" ? (
            <div className="mt-8 grid gap-4" data-testid="relax-breathe-intent-panel">
              <div>
                <h2 className="text-3xl font-extrabold text-[#1F2528]">{copy.chooseTitle}</h2>
                <p className="mt-1 text-base font-semibold text-[#6F625B]">
                  {sessionState === "confirming" ? copy.voiceIntentHint : copy.chooseBody}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {INTENT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="min-h-[112px] rounded-[1.5rem] border border-[#D9EFEA] bg-white p-4 text-left shadow-[0_14px_36px_rgba(54,44,36,0.08)] transition hover:-translate-y-0.5 hover:border-[#0F8274] focus:outline-none focus:ring-4 focus:ring-[#B7EFE6]"
                    onClick={() => void requestPlan(preset.intent)}
                    disabled={sessionState === "planning"}
                    data-testid={`button-relax-breathe-intent-${preset.id}`}
                  >
                    <span className="block text-2xl font-extrabold text-[#1F2528]">{preset.label}</span>
                    <span className="sr-only">{preset.body}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="inline-flex min-h-[64px] items-center justify-center gap-3 rounded-full bg-[#0F8274] px-6 py-4 text-lg font-extrabold text-white shadow-[0_18px_38px_rgba(15,130,116,0.2)] disabled:opacity-70"
                onClick={startVoiceIntent}
                disabled={isConnecting}
                data-testid="button-relax-breathe-talk"
              >
                {isConnecting || sessionState === "planning" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Mic className="h-5 w-5" aria-hidden="true" />}
                {sessionState === "planning" ? copy.planning : copy.talkToMarco}
              </button>

              {proposedPlan && (
                <div
                  className="rounded-[1.75rem] border border-[#B7EFE6] bg-white p-5 shadow-[0_18px_44px_rgba(32,88,74,0.08)]"
                  data-testid="relax-breathe-proposed-plan"
                >
                  <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#0F8274]">{copy.proposedTitle}</p>
                  <h3 className="mt-2 text-3xl font-extrabold text-[#1F2528]">{proposedPlan.title}</h3>
                  <p className="mt-2 text-base font-bold text-[#6F625B]">{proposedPlan.description}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-extrabold text-[#0F8274]">
                    <span className="rounded-2xl bg-[#ECFFF9] p-3">{proposedPlan.durationMinutes} min</span>
                    <span className="rounded-2xl bg-[#ECFFF9] p-3">Level {proposedPlan.difficulty}</span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-full bg-[#0F8274] px-5 py-4 text-lg font-extrabold text-white shadow-[0_18px_38px_rgba(15,130,116,0.2)]"
                      onClick={() => void beginPlan(proposedPlan, lastIntent, "voice")}
                      data-testid="button-relax-breathe-confirm-plan"
                    >
                      <Play className="h-5 w-5" aria-hidden="true" />
                      {copy.confirmStart}
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-full border border-[#B7EFE6] bg-white px-5 py-4 text-lg font-extrabold text-[#0F8274]"
                      onClick={() => void requestPlan({ ...lastIntent, freeText: "User asked for a different breathing option" }, "voice", { waitForConfirmation: true })}
                      data-testid="button-relax-breathe-change-plan"
                    >
                      <RotateCcw className="h-5 w-5" aria-hidden="true" />
                      {copy.askForChange}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]" data-testid="relax-breathe-session-panel">
              <div
                className="flex aspect-square min-h-[300px] items-center justify-center rounded-[2rem] bg-white/40"
                data-testid="relax-breathe-visual"
              >
                <div className="relative flex h-72 w-72 items-center justify-center sm:h-96 sm:w-96">
                  <div
                    className="relax-breathe-halo absolute inset-0 rounded-full border border-[#B7EFE6] bg-white/20"
                    style={{ animation: prefersReducedMotion ? undefined : "relax-breathe-halo 8s ease-in-out infinite" }}
                    aria-hidden="true"
                  />
                  <div
                    className="relax-breathe-halo absolute h-[78%] w-[78%] rounded-full bg-[#CFF7EF]"
                    style={{ animation: prefersReducedMotion ? undefined : "relax-breathe-pulse 8s ease-in-out infinite" }}
                    aria-hidden="true"
                  />
                  <div
                    className="relax-breathe-orb relative flex h-[58%] w-[58%] flex-col items-center justify-center rounded-full bg-[#0F8274] p-6 text-center text-white shadow-[0_24px_60px_rgba(15,130,116,0.25)]"
                    data-testid="relax-breathe-orb"
                    data-motion={prefersReducedMotion ? "static" : "animated"}
                    style={{ animation: prefersReducedMotion ? undefined : "relax-breathe-pulse 8s ease-in-out infinite" }}
                  >
                    <span className="font-serif text-4xl leading-none sm:text-5xl">{currentPhase?.cue ?? "Breathe"}</span>
                    <span className="mt-4 text-sm font-extrabold uppercase tracking-[0.16em] opacity-80">
                      {sessionState === "paused" ? copy.pause : currentPhase?.title ?? plan?.title}
                    </span>
                  </div>
                </div>
              </div>

              <aside className="rounded-[1.5rem] border border-[#B7EFE6] bg-white/80 p-5 shadow-[0_18px_44px_rgba(32,88,74,0.08)]">
                <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#0F8274]">
                  {plan?.title}
                </p>
                <h2 className="mt-3 font-serif text-4xl text-[#173F38]">{currentPhase?.title}</h2>
                <p className="mt-4 text-xl font-extrabold leading-snug text-[#1F2528]" data-testid="relax-breathe-stage-instruction">
                  {currentPhase?.instruction}
                </p>
                <p className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-[#6F625B]" data-testid="relax-breathe-safety">
                  {plan?.safetyNotes[0] ?? copy.safety}
                </p>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#DDF5F0]" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-[#0F8274] transition-all"
                    style={{ width: plan ? `${Math.round(((phaseIndex + 1) / plan.phases.length) * 100)}%` : "0%" }}
                  />
                </div>
                <p className="mt-2 text-sm font-bold text-[#0F8274]">
                  {plan ? `${phaseIndex + 1} of ${plan.phases.length}` : ""}
                </p>
              </aside>
            </div>
          )}

          {statusMessage && (
            <p className="mt-5 rounded-2xl bg-white/80 p-4 text-sm font-bold text-[#0F8274]" data-testid="relax-breathe-status-message">
              {statusMessage}
            </p>
          )}

          {(errorMessage || voiceError) && (
            <p className="mt-5 rounded-2xl bg-[#FDECEC] p-4 text-base font-bold text-[#B4232A]" role="alert" data-testid="relax-breathe-error">
              {errorMessage ?? voiceError}
            </p>
          )}
        </main>

        <aside className="grid content-start gap-4">
          <div className="rounded-[1.75rem] border border-[#E7DCD1] bg-white/88 p-5 shadow-[0_18px_44px_rgba(54,44,36,0.08)]">
            <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#0F8274]">Guide</p>
            <div className="mt-4 grid grid-cols-2 gap-2" data-testid="relax-breathe-mode-switch">
              <button
                type="button"
                className={`rounded-full px-4 py-3 text-base font-extrabold ${guideMode === "voice" ? "bg-[#0F8274] text-white" : "bg-[#F4F0EA] text-[#4B3F39]"}`}
                aria-pressed={guideMode === "voice"}
                onClick={() => setGuideMode("voice")}
                data-testid="button-relax-breathe-mode-voice"
              >
                {copy.voiceMode}
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-3 text-base font-extrabold ${guideMode === "visual" ? "bg-[#0F8274] text-white" : "bg-[#F4F0EA] text-[#4B3F39]"}`}
                aria-pressed={guideMode === "visual"}
                onClick={() => {
                  setGuideMode("visual");
                  if (audioIsLive) stopVoice();
                }}
                data-testid="button-relax-breathe-mode-visual"
              >
                {copy.visualMode}
              </button>
            </div>
          </div>

          {plan && (
            <div className="rounded-[1.75rem] border border-[#B7EFE6] bg-white/88 p-5 shadow-[0_18px_44px_rgba(32,88,74,0.08)]" data-testid="relax-breathe-plan-summary">
              <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#0F8274]">Plan</p>
              <h2 className="mt-3 text-2xl font-extrabold text-[#1F2528]">{plan.title}</h2>
              <p className="mt-2 text-sm font-bold text-[#6F625B]">{plan.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-extrabold text-[#0F8274]">
                <span className="rounded-2xl bg-[#ECFFF9] p-3">{plan.durationMinutes} min</span>
                <span className="rounded-2xl bg-[#ECFFF9] p-3">Level {plan.difficulty}</span>
              </div>
            </div>
          )}

          {options.length > 1 && sessionState !== "planning" && (
            <div className="rounded-[1.75rem] border border-[#E7DCD1] bg-white/88 p-5 shadow-[0_18px_44px_rgba(54,44,36,0.08)]" data-testid="relax-breathe-options">
              <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#0F8274]">Try Instead</p>
              <div className="mt-3 grid gap-2">
                {options.filter((option) => option.exerciseSlug !== plan?.exerciseSlug).map((option) => (
                  <button
                    key={option.exerciseSlug}
                    type="button"
                    className="rounded-2xl border border-[#E7DCD1] bg-white p-3 text-left text-sm font-bold text-[#1F2528]"
                    onClick={() => void beginPlan(option.plan, lastIntent)}
                    data-testid={`button-relax-breathe-option-${option.exerciseSlug}`}
                  >
                    {option.name}
                    <span className="sr-only">{option.why}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {plan && (
            <div className="grid gap-3">
              {sessionState === "running" ? (
                <button
                  type="button"
                  className="inline-flex min-h-[58px] items-center justify-center gap-3 rounded-full border border-[#B7EFE6] bg-white px-5 py-4 text-lg font-extrabold text-[#0F8274]"
                  onClick={pauseSession}
                  data-testid="button-relax-breathe-pause"
                >
                  <Pause className="h-5 w-5" aria-hidden="true" />
                  {copy.pause}
                </button>
              ) : (
                <button
                  type="button"
                  className="inline-flex min-h-[58px] items-center justify-center gap-3 rounded-full bg-[#0F8274] px-5 py-4 text-lg font-extrabold text-white shadow-[0_18px_38px_rgba(15,130,116,0.2)]"
                  onClick={resumeSession}
                  data-testid="button-relax-breathe-resume"
                >
                  <Play className="h-5 w-5" aria-hidden="true" />
                  {copy.resume}
                </button>
              )}
              <button
                type="button"
                className="inline-flex min-h-[58px] items-center justify-center gap-3 rounded-full bg-[#0F8274] px-5 py-4 text-lg font-extrabold text-white shadow-[0_18px_38px_rgba(15,130,116,0.2)]"
                onClick={finishSession}
                data-testid="button-relax-breathe-finish"
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                {copy.finish}
              </button>
              <button
                type="button"
                className="inline-flex min-h-[58px] items-center justify-center gap-3 rounded-full border border-[#E7DCD1] bg-white px-5 py-4 text-lg font-extrabold text-[#7A2E2E]"
                onClick={stopSession}
                data-testid="button-relax-breathe-stop"
              >
                <Square className="h-5 w-5" aria-hidden="true" />
                {copy.stop}
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
