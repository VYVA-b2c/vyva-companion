import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Flower2, Info, MessageCircle, RefreshCw } from "lucide-react";
import { useLanguage } from "@/i18n";
import { BrainCoachActivityShell, BrainCoachLoadingState } from "@/components/brain/BrainCoachFlowShell";
import foodImage from "@/assets/scent-memory/food.jpg";
import breadImage from "@/assets/scent-memory/fresh-bread.jpg";
import homeImage from "@/assets/scent-memory/home.jpg";
import natureImage from "@/assets/scent-memory/nature.jpg";
import occasionImage from "@/assets/scent-memory/occasion.jpg";
import placeImage from "@/assets/scent-memory/place.jpg";
import seasonImage from "@/assets/scent-memory/season.jpg";
import { apiFetch } from "@/lib/queryClient";
import DualInput from "./shared/DualInput";
import BrainGameCompletionDialog from "./shared/BrainGameCompletionDialog";
import { normalizeGameLanguage } from "./shared/language";

const BRAND = {
  purple: "#6B21A8",
  gold: "#F59E0B",
  bg: "#FAF9F6",
  ink: "#2B2233",
  muted: "#5B4A61",
  border: "#E7D8F3",
  softPurple: "#F3E8FF",
  softGold: "#FFF7ED",
  teal: "#0F766E",
  tealPale: "#DDF7F1",
};

const SCENT_MEMORY_TUTORIAL_KEY = "scentMemory:tutorialSeen:v1";

function tutorialStorageKey(userId) {
  return userId ? `${SCENT_MEMORY_TUTORIAL_KEY}:${userId}` : SCENT_MEMORY_TUTORIAL_KEY;
}

function readScentMemoryTutorialSeen(userId) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(tutorialStorageKey(userId)) === "true";
  } catch {
    return false;
  }
}

function writeScentMemoryTutorialSeen(userId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tutorialStorageKey(userId), "true");
  } catch {
    // Tutorial persistence is helpful but should never block the reflection.
  }
}

const DEFAULT_STREAK_STATE = {
  total_sessions: 0,
  streak_days: 0,
  last_streak_date: null,
  last_played_at: null,
};

const SCENT_VISUAL_IMAGES = {
  bread: breadImage,
  food: foodImage,
  nature: natureImage,
  home: homeImage,
  season: seasonImage,
  place: placeImage,
  occasion: occasionImage,
};

const SCENT_VISUAL_DEFAULTS = {
  bread: "Warm from the oven.",
  food: "A familiar kitchen smell.",
  nature: "Fresh air, leaves, and flowers.",
  home: "A smell from home.",
  season: "A scent from a season.",
  place: "A place you can almost visit again.",
  occasion: "A scent from a special day.",
};

const BREAD_TERMS = ["bread", "sourdough", "loaf", "oven", "bakery", "baked", "pan", "brot", "pain", "pane", "pao"];

const FALLBACK_PROMPTS = {
  es: {
    id: "local-es-bread",
    scent_name: "pan recien hecho",
    scent_description: "Imagina ese olor calido y un poco dulce que sale del horno recien apagado.",
    guiding_question: "Te recuerda a algun momento, lugar o costumbre?",
    category: "food",
    language: "es",
  },
  de: {
    id: "local-de-bread",
    scent_name: "frisch gebackenes Brot",
    scent_description: "Stell dir diesen warmen, leicht suessen Duft vor, der aus einem gerade geoeffneten Ofen kommt.",
    guiding_question: "Erinnert dich das an einen Ort, einen Moment oder eine Gewohnheit?",
    category: "food",
    language: "de",
  },
  en: {
    id: "local-en-bread",
    scent_name: "fresh bread",
    scent_description: "Imagine that warm, slightly sweet smell coming from an oven that has just been opened.",
    guiding_question: "Does it bring back a place, a moment, or a small habit?",
    category: "food",
    language: "en",
  },
  fr: {
    id: "local-fr-bread",
    scent_name: "pain tout juste cuit",
    scent_description: "Imagine cette odeur chaude et legerement sucree qui sort d'un four que l'on vient d'ouvrir.",
    guiding_question: "Cela te rappelle-t-il un lieu, un moment ou une habitude?",
    category: "food",
    language: "fr",
  },
  it: {
    id: "local-it-bread",
    scent_name: "pane appena sfornato",
    scent_description: "Immagina quel profumo caldo e leggermente dolce che arriva da un forno appena aperto.",
    guiding_question: "Ti fa tornare in mente un luogo, un momento o una piccola abitudine?",
    category: "food",
    language: "it",
  },
  pt: {
    id: "local-pt-bread",
    scent_name: "pao acabado de fazer",
    scent_description: "Imagina esse cheiro quente e ligeiramente doce que sai de um forno acabado de abrir.",
    guiding_question: "Isto faz-te lembrar algum lugar, momento ou costume?",
    category: "food",
    language: "pt",
  },
};

const SECONDARY_FALLBACK_PROMPTS = {
  es: {
    id: "local-es-rain", scent_name: "tierra mojada después de la lluvia",
    scent_description: "Imagina el aroma fresco de la tierra cuando acaba de llover.",
    guiding_question: "¿Te recuerda a un jardín, un paseo o algún lugar especial?", category: "nature", language: "es",
  },
  de: {
    id: "local-de-rain", scent_name: "Erde nach dem Regen",
    scent_description: "Stell dir den frischen Duft der Erde direkt nach einem Regenschauer vor.",
    guiding_question: "Erinnert dich das an einen Garten, einen Spaziergang oder einen besonderen Ort?", category: "nature", language: "de",
  },
  en: {
    id: "local-en-rain", scent_name: "earth after rain",
    scent_description: "Imagine the fresh scent of the ground just after a rain shower.",
    guiding_question: "Does it bring back a garden, a walk, or somewhere special?", category: "nature", language: "en",
  },
  fr: {
    id: "local-fr-rain", scent_name: "la terre après la pluie",
    scent_description: "Imagine l'odeur fraîche de la terre juste après une averse.",
    guiding_question: "Cela te rappelle-t-il un jardin, une promenade ou un lieu particulier ?", category: "nature", language: "fr",
  },
  it: {
    id: "local-it-rain", scent_name: "terra dopo la pioggia",
    scent_description: "Immagina il profumo fresco della terra subito dopo un acquazzone.",
    guiding_question: "Ti ricorda un giardino, una passeggiata o un luogo speciale?", category: "nature", language: "it",
  },
  pt: {
    id: "local-pt-rain", scent_name: "terra depois da chuva",
    scent_description: "Imagina o aroma fresco da terra logo depois de uma chuvada.",
    guiding_question: "Faz-te lembrar um jardim, um passeio ou um lugar especial?", category: "nature", language: "pt",
  },
};

export function getDefaultScentMemoryUserState(userId) {
  return {
    user_id: userId,
    ...DEFAULT_STREAK_STATE,
    updated_at: new Date().toISOString(),
  };
}

function useLatestRef(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function fallbackPromptFor(language, previousPromptId = null) {
  const normalized = normalizeGameLanguage(language);
  const primary = FALLBACK_PROMPTS[normalized] ?? FALLBACK_PROMPTS.es;
  const secondary = SECONDARY_FALLBACK_PROMPTS[normalized] ?? SECONDARY_FALLBACK_PROMPTS.es;
  return previousPromptId === primary.id ? secondary : primary;
}

function normalizeScentText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getScentVisualKey(prompt) {
  const searchable = normalizeScentText(`${prompt?.scent_name ?? ""} ${prompt?.scent_description ?? ""}`);
  if (BREAD_TERMS.some((term) => searchable.includes(term))) return "bread";
  return SCENT_VISUAL_IMAGES[prompt?.category] ? prompt.category : "home";
}

function getScentVisual(prompt, t) {
  const key = getScentVisualKey(prompt);
  const scent = prompt?.scent_name ?? t("games.scentMemory.scentFallback", "this scent");
  return {
    image: SCENT_VISUAL_IMAGES[key] ?? homeImage,
    cue: t(`games.scentMemory.visualCues.${key}`, SCENT_VISUAL_DEFAULTS[key] ?? SCENT_VISUAL_DEFAULTS.home),
    alt: t("games.scentMemory.visualAlt", "{scent} visual cue", { scent }),
  };
}

function getMemoryAngle(prompt, t) {
  const category = prompt?.category;

  if (category === "nature" || category === "place") {
    return {
      label: t("games.scentMemory.memoryAngles.placeLabel", "Place memory"),
      question: prompt?.guiding_question || t("games.scentMemory.memoryAngles.placeQuestion", "Where does this scent take you?"),
      hint: t("games.scentMemory.memoryAngles.placeHint", "A garden, a street, or somewhere familiar."),
    };
  }

  if (category === "home") {
    return {
      label: t("games.scentMemory.memoryAngles.peopleLabel", "People & routines"),
      question: prompt?.guiding_question || t("games.scentMemory.memoryAngles.peopleQuestion", "Who or what does this remind you of?"),
      hint: t("games.scentMemory.memoryAngles.peopleHint", "A person, a room, or a familiar routine."),
    };
  }

  if (category === "season" || category === "occasion") {
    return {
      label: t("games.scentMemory.memoryAngles.occasionLabel", "Special moment"),
      question: prompt?.guiding_question || t("games.scentMemory.memoryAngles.occasionQuestion", "What was happening around you?"),
      hint: t("games.scentMemory.memoryAngles.occasionHint", "A season, a celebration, or an ordinary day."),
    };
  }

  return {
    label: t("games.scentMemory.memoryAngles.momentLabel", "Moment memory"),
    question: prompt?.guiding_question || t("games.scentMemory.memoryAngles.momentQuestion", "What moment comes back?"),
    hint: t("games.scentMemory.memoryAngles.momentHint", "A meal, a kitchen, or someone nearby."),
  };
}

function ScentTutorialVisual({ visual }) {
  return (
    <div className="relative mx-auto h-[150px] w-full max-w-[560px] overflow-hidden rounded-[22px] border sm:h-[180px]" style={{ borderColor: "#F3D9B7", background: BRAND.softGold }}>
      <img src={visual.image} alt="" aria-hidden="true" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#2B2233]/45 via-transparent to-white/10" />
      <div className="absolute bottom-3 left-3 right-3 rounded-full bg-white/95 px-4 py-2 text-[14px] font-extrabold leading-tight shadow-vyva-card sm:text-[15px]" style={{ color: BRAND.purple }}>
        {visual.cue}
      </div>
    </div>
  );
}

export default function ScentMemory({ userId, onExit }) {
  const { language, t } = useLanguage();
  const gameLanguage = normalizeGameLanguage(language);
  const [screen, setScreen] = useState("loading");
  const [prompt, setPrompt] = useState(null);
  const [userState, setUserState] = useState(null);
  const [questionRevealed, setQuestionRevealed] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [saving, setSaving] = useState(false);

  const sessionStartRef = useRef(Date.now());
  const sessionSavedRef = useRef(false);
  const responseInputMethodRef = useRef(null);
  const screenRef = useLatestRef(screen);
  const promptRef = useLatestRef(prompt);
  const responseTextRef = useLatestRef(responseText);

  const fallbackState = useMemo(() => getDefaultScentMemoryUserState(userId || "local"), [userId]);
  const scentVisual = useMemo(() => getScentVisual(prompt, t), [prompt, t]);
  const memoryAngle = useMemo(() => getMemoryAngle(prompt, t), [prompt, t]);

  const loadTodaysPrompt = useCallback(async (excludedPrompt = null) => {
    if (!userId) {
      setPrompt(fallbackPromptFor(gameLanguage, excludedPrompt?.id ?? null));
      setUserState(fallbackState);
      return;
    }

    const query = new URLSearchParams({ language: gameLanguage });
    if (excludedPrompt?.id) query.set("excludePromptId", excludedPrompt.id);
    if (excludedPrompt?.category) query.set("excludeCategory", excludedPrompt.category);
    const response = await apiFetch(`/api/games/scent-memory/content?${query.toString()}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error ?? t("games.scentMemory.contentUnavailable", "There is no reviewed Scent Memory content available yet."));
    }

    setPrompt(payload.prompt);
    setUserState(payload.state ?? getDefaultScentMemoryUserState(userId));
  }, [fallbackState, gameLanguage, t, userId]);

  const loadGame = useCallback(async () => {
    setScreen("loading");
    setLoadError("");
    setSaveWarning("");
    setQuestionRevealed(false);
    setResponseText("");
    sessionStartRef.current = Date.now();
    sessionSavedRef.current = false;

    try {
      await loadTodaysPrompt();
      setScreen(readScentMemoryTutorialSeen(userId) ? "scent" : "tutorial");
    } catch (error) {
      console.warn("Scent Memory could not load.", error);
      setLoadError(error instanceof Error ? error.message : t("games.scentMemory.contentUnavailable", "There is no reviewed Scent Memory content available yet."));
      setScreen("error");
    }
  }, [loadTodaysPrompt, t, userId]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  useEffect(() => {
    if (screen !== "scent") return undefined;
    if (questionRevealed) return undefined;
    const timeout = window.setTimeout(() => setQuestionRevealed(true), 3000);
    return () => window.clearTimeout(timeout);
  }, [questionRevealed, screen, prompt?.id]);

  const saveSession = useCallback(async ({ completed, abandoned, text, method }) => {
    if (sessionSavedRef.current) return null;
    sessionSavedRef.current = true;

    const currentPrompt = promptRef.current;
    const response = String(text ?? responseTextRef.current ?? "").trim();
    const durationSeconds = Math.max(0, Math.round((Date.now() - sessionStartRef.current) / 1000));

    if (!userId) {
      if (completed) {
        setUserState((current) => ({
          ...(current ?? fallbackState),
          total_sessions: Number(current?.total_sessions ?? 0) + 1,
          streak_days: Math.max(1, Number(current?.streak_days ?? 0)),
          last_played_at: new Date().toISOString(),
        }));
      }
      return null;
    }

    const apiResponse = await apiFetch("/api/games/scent-memory/sessions", {
      method: "POST",
      body: JSON.stringify({
        promptId: currentPrompt?.id ?? null,
        responseText: response || null,
        responseInputMethod: method ?? null,
        completed,
        abandoned,
        durationSeconds,
        language: gameLanguage,
      }),
    });
    const saved = await apiResponse.json().catch(() => ({}));

    if (!apiResponse.ok) {
      sessionSavedRef.current = false;
      throw new Error(saved?.error ?? "Scent Memory session could not be saved.");
    }

    if (saved.state) setUserState(saved.state);
    return saved.session ?? null;
  }, [fallbackState, gameLanguage, promptRef, responseTextRef, userId]);

  const reviewMemory = (text = "", method = null) => {
    setSaveWarning("");
    setResponseText(text);
    responseInputMethodRef.current = method;
    setScreen("close");
  };

  const saveCurrentMemory = useCallback(async (completed) => {
    return saveSession({
      completed,
      abandoned: false,
      text: responseTextRef.current,
      method: responseInputMethodRef.current,
    });
  }, [responseTextRef, saveSession]);

  const handleAnotherMemory = async () => {
    setSaving(true);
    setSaveWarning("");
    try {
      await saveCurrentMemory(false);
      setScreen("loading");
      setQuestionRevealed(false);
      await loadTodaysPrompt(promptRef.current);
      setResponseText("");
      responseInputMethodRef.current = null;
      sessionSavedRef.current = false;
      setScreen("scent");
    } catch (error) {
      console.warn("Scent Memory could not continue the session.", error);
      setSaveWarning(t("games.scentMemory.saveWarning", "Your reflection could not be saved yet. Please try again."));
      setScreen("close");
    } finally {
      setSaving(false);
    }
  };

  const handleFinishSession = async () => {
    setSaving(true);
    setSaveWarning("");
    try {
      await saveCurrentMemory(true);
      onExit?.();
    } catch (error) {
      console.warn("Scent Memory could not finish the session.", error);
      setSaveWarning(t("games.scentMemory.saveWarning", "Your reflection could not be saved yet. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (text, method) => {
    reviewMemory(text, method);
  };

  const handleSkip = () => {
    reviewMemory("", null);
  };

  const closeTutorial = () => {
    writeScentMemoryTutorialSeen(userId);
    setScreen("scent");
  };

  const openInstructions = () => {
    setScreen("tutorial");
  };

  const exitGame = async () => {
    if (screenRef.current === "scent") {
      setSaving(true);
      try {
        await saveSession({
          completed: false,
          abandoned: true,
          text: responseTextRef.current,
          method: null,
        });
      } catch (error) {
        console.warn("Scent Memory could not save the abandoned session.", error);
      } finally {
        setSaving(false);
      }
    }
    onExit?.();
  };

  if (screen === "loading") {
    return (
      <BrainCoachLoadingState
        title={t("games.scentMemory.title", "Scent Memory")}
        label={t("games.scentMemory.preparing", "Preparing a memory...")}
        testId="scent-memory-flow-shell"
        presentationId="brain_coach.activity_session.sharpen_senses.scent_memory.loading.touch"
        sceneId="brain_coach.activity_session.sharpen_senses.scent_memory"
      />
    );
  }

  return (
    <BrainCoachActivityShell
      title={t("games.scentMemory.title", "Scent Memory")}
      backLabel={t("common.exit", "Exit")}
      onBack={() => void exitGame()}
      showHeader={screen !== "close"}
      testId="scent-memory-flow-shell"
      presentationId={`brain_coach.activity_session.sharpen_senses.scent_memory.${screen}.touch`}
      sceneId="brain_coach.activity_session.sharpen_senses.scent_memory"
      sceneKind={screen === "close" ? "completion" : screen}
      sceneLayout={screen === "scent" ? "reflection_prompt" : screen === "close" ? "modal_actions" : "activity_panel"}
      state={screen === "close" ? "complete" : "default"}
    >
      <div className="mx-auto w-full max-w-[780px]" style={{ color: BRAND.ink }}>
        {screen === "error" ? (
          <section className="rounded-[28px] border bg-white p-5 text-center shadow-[0_18px_46px_rgba(54,35,78,0.10)] sm:p-6" style={{ borderColor: "#EEE8F1" }}>
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[32px]">{t("games.scentMemory.unavailable", "This memory could not open")}</h1>
            <p className="mt-3 text-[16px] font-semibold leading-relaxed" style={{ color: BRAND.muted }}>{loadError}</p>
            <button
              type="button"
              onClick={() => void loadGame()}
              className="mt-5 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[17px] font-extrabold text-white shadow-vyva-card"
              style={{ background: BRAND.purple }}
            >
              <RefreshCw size={20} aria-hidden="true" />
              {t("games.scentMemory.tryAgain", "Try again")}
            </button>
          </section>
        ) : null}

        {screen === "tutorial" ? (
          <section className="rounded-[28px] border bg-white p-4 text-center shadow-[0_18px_46px_rgba(54,35,78,0.10)] sm:p-5" style={{ borderColor: "#EEE8F1" }}>
            <ScentTutorialVisual visual={scentVisual} />
            <h1 className="mt-3 font-display text-[24px] font-semibold leading-tight tracking-[-0.03em] sm:text-[27px]">
              {t("games.scentMemory.tutorialSubtitle", "Look. Remember. Share if you want.")}
            </h1>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: t("games.scentMemory.tutorialLook", "Look"), Icon: Flower2 },
                { label: t("games.scentMemory.tutorialRemember", "Remember"), Icon: Check },
                { label: t("games.scentMemory.tutorialShare", "Share or skip"), Icon: MessageCircle },
              ].map(({ label, Icon }) => (
                <div key={label} className="min-h-[72px] rounded-[18px] px-2 py-2.5" style={{ background: BRAND.softGold, color: BRAND.gold }}>
                  <Icon className="mx-auto" size={22} aria-hidden="true" />
                  <span className="mt-1.5 block text-[13px] font-black leading-tight sm:text-[14px]">{label}</span>
                </div>
              ))}
            </div>

            <p className="mx-auto mt-3 max-w-[560px] text-[13px] font-bold leading-snug sm:text-[14px]" style={{ color: BRAND.muted }}>
              {t("games.scentMemory.tutorialPace", "There is no right answer. A small memory is enough.")}
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
        ) : null}

        {screen === "scent" ? (
          <section className="rounded-[28px] border bg-white p-5 text-center shadow-[0_18px_46px_rgba(54,35,78,0.10)] sm:p-6" style={{ borderColor: "#EEE8F1" }}>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={openInstructions}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border bg-white px-4 text-[14px] font-extrabold"
                style={{ borderColor: BRAND.border, color: BRAND.purple }}
              >
                <Info size={18} aria-hidden="true" />
                {t("games.scentMemory.instructions", "Guidance")}
              </button>
            </div>
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[32px]">
              {t("games.scentMemory.intro", "Look, then remember.")}
            </h1>

            <div className="mt-6 rounded-[26px] border p-4" style={{ background: "#FFFCF8", borderColor: "#F3D9B7" }}>
              <div className="relative overflow-hidden rounded-[22px] bg-[#F7EFE7]">
                <img
                  src={scentVisual.image}
                  alt={scentVisual.alt}
                  className="h-[210px] w-full object-cover sm:h-[240px]"
                />
                <div className="absolute inset-x-4 bottom-4 flex justify-start">
                  <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1 rounded-full bg-white/95 px-5 py-3 text-left leading-tight shadow-vyva-card">
                    <span className="text-[24px] font-black sm:text-[28px]" style={{ color: BRAND.purple }}>
                      {prompt?.scent_name}
                    </span>
                    <span aria-hidden="true" className="hidden text-[18px] font-black sm:inline" style={{ color: "#C084FC" }}>
                      /
                    </span>
                    <span className="text-[18px] font-black sm:text-[20px]" style={{ color: "#92400E" }}>
                      {scentVisual.cue}
                    </span>
                  </span>
                </div>
              </div>

              <div
                className={`mx-auto mt-5 max-w-[660px] transition-all duration-700 ${questionRevealed ? "opacity-100 translate-y-0" : "pointer-events-none translate-y-2 opacity-0"}`}
                aria-live="polite"
              >
                <p className="sr-only">
                  {prompt?.scent_description} {prompt?.guiding_question}
                </p>
                <span className="inline-flex rounded-full px-3 py-1 text-[13px] font-black uppercase tracking-[0.08em]" style={{ background: BRAND.tealPale, color: BRAND.teal }}>
                  {memoryAngle.label}
                </span>
                <p className="text-[30px] font-black leading-tight" style={{ color: BRAND.teal }}>
                  {memoryAngle.question}
                </p>
                <p className="mt-2 text-[20px] font-bold" style={{ color: BRAND.muted }}>
                  {memoryAngle.hint}
                </p>
                <div className="mt-5">
                  <DualInput
                    value={responseText}
                    onChange={setResponseText}
                    onSubmit={handleSubmit}
                    placeholder={t("games.scentMemory.placeholder", "Tell me what you remember...")}
                    skipLabel={t("common.skip", "Skip")}
                    onSkip={handleSkip}
                    submitLabel={t("games.scentMemory.saveMemory", "Save memory")}
                    dictateLabel={t("games.curiousMinds.dictateLabel", "Dictate")}
                    listeningLabel={t("games.curiousMinds.listeningLabel", "Listening...")}
                    voiceUnavailableLabel={t("games.curiousMinds.voiceUnavailableLabel", "Voice input is not available")}
                    language={language}
                    disabled={saving || !questionRevealed}
                  />
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {screen === "close" ? (
          <BrainGameCompletionDialog
            title={t("games.scentMemory.thanksForSharing", "Thanks for sharing that.")}
            summary={
              responseText.trim()
                ? t("games.scentMemory.gentleReflection", "A memory worth keeping close.")
                : t("games.scentMemory.skipReflection", "Some memories come quietly. That is fine.")
            }
            details={saveWarning ? <p className="text-[15px] font-bold text-[#92400E]">{saveWarning}</p> : null}
            continueLabel={t("common.finish", "Finish")}
            anotherLabel={t("games.scentMemory.doAnother", "Do another")}
            onContinue={() => void handleFinishSession()}
            onAnother={() => void handleAnotherMemory()}
            disabled={saving}
          />
        ) : null}
      </div>
    </BrainCoachActivityShell>
  );
}
