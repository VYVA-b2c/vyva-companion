import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrainCircuit, Check, CircleHelp, MessageCircle, PartyPopper, RefreshCw, Sparkles } from "lucide-react";
import { useLanguage } from "@/i18n";
import { BrainCoachActivityShell, BrainCoachLoadingState } from "@/components/brain/BrainCoachFlowShell";
import { apiFetch } from "@/lib/queryClient";
import DualInput from "./shared/DualInput";
import BrainGameCompletionDialog from "./shared/BrainGameCompletionDialog";
import { getBrainCoachMilestoneJourney } from "./shared/brainCoachProgression";
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

const DEFAULT_STREAK_STATE = {
  total_sessions: 0,
  streak_days: 0,
  last_streak_date: null,
  last_played_at: null,
};

const CURIOUS_MINDS_TUTORIAL_KEY = "curiousMinds:tutorialSeen:v1";

function tutorialStorageKey(userId) {
  return userId ? `${CURIOUS_MINDS_TUTORIAL_KEY}:${userId}` : CURIOUS_MINDS_TUTORIAL_KEY;
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
    // Local tutorial persistence should never block the game.
  }
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

function chooseRandom(items, random = Math.random) {
  if (!items.length) return null;
  return items[Math.floor(random() * items.length)];
}

export function getDefaultCuriousMindsUserState(userId) {
  return {
    user_id: userId,
    ...DEFAULT_STREAK_STATE,
    updated_at: new Date().toISOString(),
  };
}

export function pickCuriousMindsContent(rows, todaySessions = [], historySessions = [], fieldName, random = Math.random) {
  const usedToday = new Set(todaySessions.map((session) => session[fieldName]).filter(Boolean));
  const unusedToday = rows.filter((row) => row?.id && !usedToday.has(row.id));
  if (unusedToday.length > 0) return chooseRandom(unusedToday, random);

  const lastPlayed = new Map();
  historySessions.forEach((session) => {
    const contentId = session[fieldName];
    if (!contentId || !session.played_at || lastPlayed.has(contentId)) return;
    lastPlayed.set(contentId, session.played_at);
  });

  return [...rows].sort((a, b) => {
    const aPlayed = lastPlayed.get(a.id) ?? "";
    const bPlayed = lastPlayed.get(b.id) ?? "";
    return aPlayed.localeCompare(bPlayed);
  })[0] ?? null;
}

export function getNextCuriousMindsStateAfterSession(previousState, now = new Date()) {
  const previous = previousState ?? DEFAULT_STREAK_STATE;
  const today = todayKey(now);
  const yesterday = todayKey(addDays(now, -1));
  const lastStreakDate = previous.last_streak_date;
  const streakDays =
    lastStreakDate === today
      ? Math.max(1, Number(previous.streak_days ?? 1))
      : lastStreakDate === yesterday
        ? Number(previous.streak_days ?? 0) + 1
        : 1;

  return {
    ...previous,
    total_sessions: Number(previous.total_sessions ?? 0) + 1,
    last_played_at: now.toISOString(),
    streak_days: streakDays,
    last_streak_date: today,
    updated_at: now.toISOString(),
  };
}

function useLatestRef(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export default function CuriousMinds({
  userId,
  onExit,
  assessmentPractice = null,
  onAssessmentPracticeComplete,
  onAssessmentPracticeReturn,
}) {
  const { language, t } = useLanguage();
  const gameLanguage = normalizeGameLanguage(language);
  const [screen, setScreen] = useState("loading");
  const [hookRevealed, setHookRevealed] = useState(false);
  const [hook, setHook] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [userState, setUserState] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [saving, setSaving] = useState(false);
  const [tutorialSeen, setTutorialSeen] = useState(() => readTutorialSeen(userId));
  const [tutorialReturnScreen, setTutorialReturnScreen] = useState("hook");

  const [hookGuessText, setHookGuessText] = useState("");
  const [hookGuessMethod, setHookGuessMethod] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [ideaText, setIdeaText] = useState("");
  const [lastEncouragement, setLastEncouragement] = useState("");
  const [callbackRevealed, setCallbackRevealed] = useState(false);
  const [callbackText, setCallbackText] = useState("");
  const [callbackMethod, setCallbackMethod] = useState(null);
  const [callbackAttempted, setCallbackAttempted] = useState(false);

  const sessionStartRef = useRef(Date.now());
  const sessionSavedRef = useRef(false);
  const screenRef = useLatestRef(screen);
  const hookRef = useLatestRef(hook);
  const promptRef = useLatestRef(prompt);
  const ideasRef = useLatestRef(ideas);
  const hookGuessTextRef = useLatestRef(hookGuessText);
  const hookGuessMethodRef = useLatestRef(hookGuessMethod);
  const callbackTextRef = useLatestRef(callbackText);
  const callbackMethodRef = useLatestRef(callbackMethod);
  const callbackAttemptedRef = useLatestRef(callbackAttempted);

  const encouragements = useMemo(() => [
    t("games.curiousMinds.encouragements.one", "Nice idea!"),
    t("games.curiousMinds.encouragements.two", "Interesting"),
    t("games.curiousMinds.encouragements.three", "I like that"),
    t("games.curiousMinds.encouragements.four", "How original!"),
    t("games.curiousMinds.encouragements.five", "Ah, I had not thought of that"),
  ], [t]);
  const milestoneJourney = getBrainCoachMilestoneJourney(userState?.streak_days ?? 1);
  const nextMilestoneValue = milestoneJourney.next
    ? `${milestoneJourney.next.label} (${milestoneJourney.next.count} days)`
    : t("brainCoach.progression.monthlyPracticeHeld", "Monthly practice held");

  const loadTodaysContent = useCallback(async () => {
    if (!userId) throw new Error("Curious Minds needs a signed-in user.");

    const response = await apiFetch(`/api/games/curious-minds/content?language=${encodeURIComponent(gameLanguage)}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error ?? t("games.curiousMinds.contentUnavailable", "There is no reviewed Curious Minds content available yet."));
    }

    setHook(payload.hook);
    setPrompt(payload.prompt);
    setUserState(payload.state ?? getDefaultCuriousMindsUserState(userId));
  }, [gameLanguage, t, userId]);

  const loadGame = useCallback(async () => {
    setScreen("loading");
    setLoadError("");
    setSaveWarning("");
    sessionStartRef.current = Date.now();
    sessionSavedRef.current = false;

    try {
      await loadTodaysContent();
      setTutorialReturnScreen("hook");
      setScreen(readTutorialSeen(userId) ? "hook" : "tutorial");
    } catch (error) {
      console.warn("Curious Minds could not load.", error);
      setLoadError(error instanceof Error ? error.message : t("games.curiousMinds.contentUnavailable", "There is no reviewed Curious Minds content available yet."));
      setScreen("error");
    }
  }, [loadTodaysContent, t]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  const saveSession = useCallback(async ({ completed, abandoned }) => {
    if (sessionSavedRef.current || !userId) return null;
    sessionSavedRef.current = true;

    const currentHook = hookRef.current;
    const currentPrompt = promptRef.current;
    const currentIdeas = ideasRef.current;
    const durationSeconds = Math.max(0, Math.round((Date.now() - sessionStartRef.current) / 1000));

    const payload = {
      hookId: currentHook?.id ?? null,
      hookGuessText: hookGuessTextRef.current || null,
      hookGuessInputMethod: hookGuessMethodRef.current,
      promptId: currentPrompt?.id ?? null,
      ideasGenerated: currentIdeas,
      callbackAttempted: callbackAttemptedRef.current,
      callbackResponseText: callbackTextRef.current || null,
      callbackInputMethod: callbackMethodRef.current,
      completed,
      abandoned,
      durationSeconds,
      language: gameLanguage,
    };

    const response = await apiFetch("/api/games/curious-minds/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const saved = await response.json().catch(() => ({}));

    if (!response.ok) {
      sessionSavedRef.current = false;
      throw new Error(saved?.error ?? "Curious Minds session could not be saved.");
    }

    if (saved.state) setUserState(saved.state);
    return saved.session ?? null;
  }, [
    callbackAttemptedRef,
    callbackMethodRef,
    callbackTextRef,
    gameLanguage,
    hookGuessMethodRef,
    hookGuessTextRef,
    hookRef,
    ideasRef,
    promptRef,
    userId,
  ]);

  const handleHookSubmit = (text, method) => {
    setHookGuessText(text);
    setHookGuessMethod(method);
    setHookRevealed(true);
  };

  const handleHookSkip = () => {
    setHookGuessText("");
    setHookGuessMethod(null);
    setHookRevealed(true);
  };

  const handleIdeaSubmit = (text, method) => {
    setIdeas((current) => [...current, { text, input_method: method }]);
    setIdeaText("");
    setLastEncouragement(chooseRandom(encouragements) ?? encouragements[0]);
  };

  const handleCallbackSubmit = (text, method) => {
    setCallbackText(text);
    setCallbackMethod(method);
    setCallbackAttempted(true);
    setCallbackRevealed(true);
  };

  const handleCallbackSkip = () => {
    setCallbackText("");
    setCallbackMethod(null);
    setCallbackAttempted(false);
    setCallbackRevealed(true);
  };

  const completeSession = async () => {
    setSaving(true);
    setSaveWarning("");
    try {
      await saveSession({ completed: true, abandoned: false });
      onAssessmentPracticeComplete?.({
        practiceTitle: assessmentPractice?.practiceTitle,
        ideasGenerated: ideasRef.current.length,
      });
    } catch (error) {
      console.warn("Curious Minds could not save the completed session.", error);
      setSaveWarning(t("games.curiousMinds.saveWarning", "Your session summary is shown here, but saving may need to be retried."));
    } finally {
      setSaving(false);
      setScreen("close");
    }
  };

  const exitGame = async () => {
    if (!["close", "loading", "error"].includes(screenRef.current)) {
      setSaving(true);
      try {
        await saveSession({ completed: false, abandoned: true });
      } catch (error) {
        console.warn("Curious Minds could not save the abandoned session.", error);
      } finally {
        setSaving(false);
      }
    }
    onExit?.();
  };

  const markTutorialSeen = () => {
    writeTutorialSeen(userId);
    setTutorialSeen(true);
  };

  const openInstructions = () => {
    setTutorialReturnScreen(screenRef.current === "tutorial" ? "hook" : screenRef.current || "hook");
    setScreen("tutorial");
  };

  const closeTutorial = () => {
    markTutorialSeen();
    setScreen(tutorialReturnScreen || "hook");
  };

  if (screen === "loading") {
    return (
      <BrainCoachLoadingState
        title={t("games.curiousMinds.title", "Curious Minds")}
        label={t("games.curiousMinds.preparing", "Preparing something curious...")}
        testId="curious-minds-flow-shell"
        presentationId="brain_coach.activity_session.memory.curious_minds.loading.touch"
        sceneId="brain_coach.activity_session.memory.curious_minds"
      />
    );
  }

  return (
    <BrainCoachActivityShell
      title={t("games.curiousMinds.title", "Curious Minds")}
      backLabel={t("common.exit", "Exit")}
      onBack={() => void exitGame()}
      showHeader={screen !== "close"}
      action={
        tutorialSeen && screen !== "close" ? (
          <button
            type="button"
            onClick={openInstructions}
            aria-label={t("games.curiousMinds.instructions", "Instructions")}
            title={t("games.curiousMinds.instructions", "Instructions")}
            className="vyva-tap grid h-11 w-11 place-items-center rounded-full bg-white text-vyva-purple shadow-[0_14px_32px_rgba(80,52,109,0.12)] ring-1 ring-black/[0.05]"
          >
            <CircleHelp size={24} aria-hidden="true" />
          </button>
        ) : null
      }
      testId="curious-minds-flow-shell"
      presentationId={`brain_coach.activity_session.memory.curious_minds.${screen}.touch`}
      sceneId="brain_coach.activity_session.memory.curious_minds"
      sceneKind={screen === "close" ? "completion" : screen}
      sceneLayout={screen === "close" ? "modal_actions" : screen === "wonder" ? "idea_prompt" : "activity_panel"}
      state={screen === "close" ? "complete" : "default"}
    >
      <div className="mx-auto w-full max-w-[780px]" style={{ color: BRAND.ink }}>
        {screen === "tutorial" ? (
          <section className="mt-6 rounded-[28px] border bg-white p-5 text-center shadow-vyva-card sm:p-6" style={{ borderColor: BRAND.border }}>
            <h2 className="font-display text-[36px] leading-tight sm:text-[42px]">{t("games.curiousMinds.tutorialTitle", "How it works")}</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { Icon: Sparkles, label: t("games.curiousMinds.tutorialGuess", "Guess first"), bg: "#FAF7FF" },
                { Icon: MessageCircle, label: t("games.curiousMinds.tutorialIdeas", "Share ideas"), bg: "#F0FDFA" },
                { Icon: RefreshCw, label: t("games.curiousMinds.tutorialRemember", "Remember later"), bg: "#FFF7ED" },
              ].map(({ Icon, label, bg }, index) => (
                <div key={label} className="relative rounded-[22px] px-4 py-5" style={{ background: bg }}>
                  <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-black text-white" style={{ background: BRAND.purple }}>
                    {index + 1}
                  </span>
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-vyva-purple">
                    <Icon size={28} aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-[20px] font-black leading-tight text-vyva-text-1">{label}</p>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-5 max-w-[28ch] text-[20px] font-bold leading-snug" style={{ color: BRAND.muted }}>
              {t("games.curiousMinds.tutorialPace", "There are no wrong answers. Take your time.")}
            </p>
            <button
              type="button"
              onClick={closeTutorial}
              className="mt-7 min-h-[72px] w-full rounded-full px-6 text-[24px] font-black text-white shadow-vyva-card"
              style={{ background: BRAND.purple }}
            >
              {t("games.curiousMinds.tutorialUnderstand", "I understand")}
            </button>
          </section>
        ) : null}

        {screen === "error" ? (
          <section className="mt-6 rounded-[28px] border bg-white p-6 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <h1 className="font-display text-[34px] leading-tight">{t("games.curiousMinds.unavailable", "This activity could not open")}</h1>
            <p className="mt-4 text-[24px] font-bold" style={{ color: BRAND.muted }}>{loadError}</p>
            <button
              type="button"
              onClick={() => void loadGame()}
              className="mt-7 inline-flex min-h-[72px] items-center justify-center gap-3 rounded-full px-6 text-[24px] font-black text-white shadow-vyva-card"
              style={{ background: BRAND.purple }}
            >
              <RefreshCw size={26} aria-hidden="true" />
              {t("games.curiousMinds.tryAgain", "Try again")}
            </button>
          </section>
        ) : null}

        {screen === "hook" ? (
          <section className="mt-6 rounded-[28px] border bg-white p-6 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-[24px]" style={{ background: BRAND.softPurple, color: BRAND.purple }}>
              <Sparkles size={52} aria-hidden="true" />
            </div>
            <p className="mt-5 text-[26px] font-black" style={{ color: BRAND.purple }}>
              {t("games.curiousMinds.hookIntro", "Here's something curious...")}
            </p>

            {!hookRevealed ? (
              <>
                <h1 className="mt-5 font-display text-[40px] leading-tight">{hook?.fact_prompt}</h1>
                <p className="mt-4 text-[24px] font-bold" style={{ color: BRAND.muted }}>
                  {t("games.curiousMinds.guessFirst", "Try to guess before I tell you")}
                </p>
                <div className="mt-6">
                  <DualInput
                    value={hookGuessText}
                    onChange={setHookGuessText}
                    onSubmit={handleHookSubmit}
                    placeholder={t("games.curiousMinds.guessPlaceholder", "Your guess...")}
                    skipLabel={t("games.curiousMinds.skipGuess", "I don't know, tell me")}
                    onSkip={handleHookSkip}
                    submitLabel={t("common.continue", "Continue")}
                    dictateLabel={t("games.curiousMinds.dictateLabel", "Dictate")}
                    listeningLabel={t("games.curiousMinds.listeningLabel", "Listening...")}
                    voiceUnavailableLabel={t("games.curiousMinds.voiceUnavailableLabel", "Voice input is not available")}
                    language={language}
                  />
                </div>
              </>
            ) : (
              <>
                {hookGuessText ? (
                  <p className="mt-5 text-[26px] font-black" style={{ color: BRAND.teal }}>
                    {t("games.curiousMinds.niceGuess", "Nice guess!")}
                  </p>
                ) : null}
                <p className="mx-auto mt-5 max-w-[680px] text-[30px] font-black leading-snug">{hook?.fact_answer}</p>
                <button
                  type="button"
                  onClick={() => setScreen("wonder")}
                  className="mt-7 min-h-[72px] w-full rounded-full px-6 text-[24px] font-black text-white shadow-vyva-card"
                  style={{ background: BRAND.purple }}
                >
                  {t("common.continue", "Continue")}
                </button>
              </>
            )}
          </section>
        ) : null}

        {screen === "wonder" ? (
          <section className="mt-6 rounded-[28px] border bg-white p-6 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-[24px]" style={{ background: "#FFF7ED", color: "#B45309" }}>
              <BrainCircuit size={52} aria-hidden="true" />
            </div>
            <h1 className="mt-6 font-display text-[40px] leading-tight">{prompt?.prompt_text}</h1>

            {ideas.length > 0 ? (
              <div className="mt-6 flex flex-wrap justify-center gap-3" aria-live="polite">
                {ideas.map((idea, index) => (
                  <span key={`${idea.text}-${index}`} className="rounded-[18px] border border-[#D8B4FE] bg-[#F3E8FF] px-4 py-3 text-[22px] font-black text-[#4C1D95]">
                    {idea.text}
                  </span>
                ))}
              </div>
            ) : null}

            {lastEncouragement ? (
              <p className="mt-5 text-[26px] font-black" style={{ color: BRAND.teal }}>
                {lastEncouragement}
              </p>
            ) : null}

            <div className="mt-6">
              <DualInput
                value={ideaText}
                onChange={setIdeaText}
                onSubmit={handleIdeaSubmit}
                placeholder={t("games.curiousMinds.ideaPlaceholder", "Another idea...")}
                submitLabel={t("games.curiousMinds.addIdeaLabel", "Add idea")}
                dictateLabel={t("games.curiousMinds.dictateLabel", "Dictate")}
                listeningLabel={t("games.curiousMinds.listeningLabel", "Listening...")}
                voiceUnavailableLabel={t("games.curiousMinds.voiceUnavailableLabel", "Voice input is not available")}
                language={language}
              />
            </div>

            <button
              type="button"
              onClick={() => setScreen("callback")}
              className="mt-3 min-h-[64px] rounded-full px-5 font-body text-[22px] font-extrabold text-[#6B21A8] underline underline-offset-4"
            >
              {t("games.curiousMinds.doneIdeas", "I can't think of more")}
            </button>
          </section>
        ) : null}

        {screen === "callback" ? (
          <section className="mt-6 rounded-[28px] border bg-white p-6 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-[24px]" style={{ background: BRAND.tealPale, color: BRAND.teal }}>
              <RefreshCw size={52} aria-hidden="true" />
            </div>

            {!callbackRevealed ? (
              <>
                <h1 className="mt-6 font-display text-[40px] leading-tight">
                  {t("games.curiousMinds.callbackPrompt", "Earlier I told you something curious. Do you remember what it was?")}
                </h1>
                <div className="mt-6">
                  <DualInput
                    value={callbackText}
                    onChange={setCallbackText}
                    onSubmit={handleCallbackSubmit}
                    placeholder={t("games.curiousMinds.callbackPlaceholder", "Whatever you remember...")}
                    skipLabel={t("games.curiousMinds.dontRemember", "I don't remember")}
                    onSkip={handleCallbackSkip}
                    submitLabel={t("common.continue", "Continue")}
                    dictateLabel={t("games.curiousMinds.dictateLabel", "Dictate")}
                    listeningLabel={t("games.curiousMinds.listeningLabel", "Listening...")}
                    voiceUnavailableLabel={t("games.curiousMinds.voiceUnavailableLabel", "Voice input is not available")}
                    language={language}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="mt-5 text-[26px] font-black" style={{ color: BRAND.teal }}>
                  {callbackAttempted
                    ? t("games.curiousMinds.callbackAck", "That's it! Here's a reminder:")
                    : t("games.curiousMinds.callbackReminder", "No worries, here's a reminder:")}
                </p>
                <p className="mx-auto mt-5 max-w-[680px] text-[30px] font-black leading-snug">{hook?.fact_answer}</p>
                <button
                  type="button"
                  onClick={() => void completeSession()}
                  disabled={saving}
                  className="mt-7 min-h-[72px] w-full rounded-full px-6 text-[24px] font-black text-white shadow-vyva-card disabled:opacity-50"
                  style={{ background: BRAND.purple }}
                >
                  {t("common.continue", "Continue")}
                </button>
              </>
            )}
          </section>
        ) : null}

        {screen === "close" ? (
          <BrainGameCompletionDialog
            title={t("games.curiousMinds.closeTitle", "Thanks for thinking with me today!")}
            summary={t("games.curiousMinds.closeSummary", "Today you came up with {n} different ideas.", { n: ideas.length })}
            metrics={[
              { label: t("games.curiousMinds.ideas", "Ideas"), value: ideas.length },
              { label: t("games.curiousMinds.streak", "Streak"), value: t("games.curiousMinds.streakLabel", "{n} days thinking together", { n: userState?.streak_days ?? 1 }) },
              { label: t("brainCoach.progression.milestone", "Milestone"), value: milestoneJourney.current.label },
              { label: t("brainCoach.progression.nextMilestone", "Next milestone"), value: nextMilestoneValue },
            ]}
            details={saveWarning ? <p className="text-[15px] font-bold text-[#92400E]">{saveWarning}</p> : null}
            continueLabel={t("common.finish", "Finish")}
            replayLabel={t("common.playAgain", "Play again")}
            assessmentReturnLabel={assessmentPractice ? t("brainGames.resultActions.backToResults", "Back to my results") : undefined}
            assessmentReturnHint={
              assessmentPractice
                ? t("brainGames.resultActions.assessmentPracticeComplete", "Good. You practiced the area VYVA noticed.")
                : undefined
            }
            onContinue={onExit}
            onReplay={() => void loadGame()}
            onAssessmentReturn={assessmentPractice ? onAssessmentPracticeReturn : undefined}
            disabled={saving}
          />
        ) : null}
      </div>
    </BrainCoachActivityShell>
  );
}

// TODO: Cross-session callback variant
// The current design tests same-session recall only. A cross-session variant
// could test longer-term consolidation once this version has engagement data.

// TODO: VYVA voice delivery
// This game is structurally suited to a pure voice conversation through the
// ElevenLabs Companion agent after the screen-based version validates content.

// TODO: Idea bank for personalisation
// An anonymised idea bank could later surface delightful answers as inspiration
// without compromising the private, judgment-free core game.

// TODO: Caregiver-visible engagement (not content)
// Caregiver dashboards may show participation only, never guesses or ideas.
