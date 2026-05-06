import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  Grid2x2,
  Hash,
  Layers3,
  Link2,
  Loader2,
  Mic,
  NotebookPen,
  RotateCcw,
  Route,
  Type,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n";
import { useTtsReadout } from "@/hooks/useVyvaVoice";
import { saveGameResult } from "./gameStorage";
import {
  getGameDefinition,
  getGameDescription,
  getGameLevel,
  getGameTitle,
  getVariantContent,
  memoryGameRegistry,
} from "./memoryGameRegistry";
import { selectGamePlan, selectNextMemoryGame, selectNextVariantForSameGame } from "./progressionEngine";
import type { MemoryGameType, Recommendation } from "./types";
import { useSpeechRecognition } from "./useSpeechRecognition";

const FALLBACK_USER_ID = "vyva-local-user";
const MEMORY_AUDIO_STORAGE_KEY = "vyva_memory_audio_muted";

type MemoryCard = {
  deckId: string;
  pairId: string;
  label: string;
  emoji: string;
};

type SequenceTile = {
  id: string;
  emoji: string;
  color: string;
};

type CompletionMetrics = {
  score: number;
  accuracy: number;
  mistakes: number;
  durationSeconds: number;
};

type CompletionDetails = {
  rememberedWords?: string[];
  correctWords?: string[];
  missedWords?: string[];
};

type WordRecallDistractionType = "count_backwards" | "choose_blue" | "breathe_continue";

function shuffleCards(cards: MemoryCard[]) {
  const copy = [...cards];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function getDurationSeconds(startedAt: number) {
  return Math.max(1, Math.round((Date.now() - startedAt) / 1000));
}

function getMemoryMatchAccuracy(matches: number, attempts: number) {
  if (attempts === 0) return 100;
  return Math.round((matches / attempts) * 100);
}

function getSequenceAccuracy(totalSteps: number, mistakes: number) {
  const attempts = totalSteps + mistakes;
  if (attempts <= 0) return 100;
  return Math.round((totalSteps / attempts) * 100);
}

function getScore(level: number, accuracy: number, mistakes: number, durationSeconds: number) {
  return Math.max(60, Math.round(accuracy + level * 12 - mistakes * 2 + Math.max(0, 45 - durationSeconds)));
}

function getMirroredSequenceIndex(index: number) {
  if (index < 0 || index > 3) return index;
  return index < 2 ? index + 2 : index - 2;
}

function shuffleItems<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normalizeRecallWord(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeWord(value: string) {
  if (value.length > 4 && value.endsWith("es")) return value.slice(0, -2);
  if (value.length > 3 && value.endsWith("s")) return value.slice(0, -1);
  return value;
}

function wordsMatch(candidate: string, target: string) {
  const normalizedCandidate = singularizeWord(normalizeRecallWord(candidate));
  const normalizedTarget = singularizeWord(normalizeRecallWord(target));
  if (!normalizedCandidate || !normalizedTarget) return false;
  return (
    normalizedCandidate === normalizedTarget ||
    normalizedCandidate.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedCandidate)
  );
}

function splitRecallText(value: string) {
  return value
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function dedupeWords(words: string[]) {
  const unique: string[] = [];
  words.forEach((word) => {
    if (!unique.some((entry) => wordsMatch(entry, word))) {
      unique.push(word);
    }
  });
  return unique;
}

function getMemoryGameIcon(gameType: MemoryGameType) {
  switch (gameType) {
    case "memory_match":
      return Grid2x2;
    case "sequence_memory":
      return Route;
    case "word_recall":
      return NotebookPen;
    case "number_memory":
      return Hash;
    case "routine_memory":
      return Clock3;
    case "association_memory":
      return Link2;
    case "story_recall":
      return BookOpen;
    default:
      return Layers3;
  }
}

function getSpeechLanguage(language: string) {
  switch (language) {
    case "en":
      return "en-US";
    case "fr":
      return "fr-FR";
    case "de":
      return "de-DE";
    case "it":
      return "it-IT";
    case "pt":
      return "pt-PT";
    case "es":
    default:
      return "es-ES";
  }
}

function getWordRecallCommandTerms(language: string) {
  switch (language) {
    case "en":
      return {
        ready: ["ready", "continue", "go on"],
        repeat: ["repeat", "again", "say again"],
      };
    case "fr":
      return {
        ready: ["je suis pret", "pret", "continuer"],
        repeat: ["repeter", "encore", "redis"],
      };
    case "de":
      return {
        ready: ["ich bin bereit", "bereit", "weiter"],
        repeat: ["wiederholen", "nochmal", "erneut"],
      };
    case "it":
      return {
        ready: ["sono pronto", "pronto", "continua"],
        repeat: ["ripeti", "di nuovo", "ripetere"],
      };
    case "pt":
      return {
        ready: ["estou pronto", "pronto", "continuar"],
        repeat: ["repetir", "outra vez", "de novo"],
      };
    case "es":
    default:
      return {
        ready: ["estoy listo", "lista", "listo", "continuar", "seguir"],
        repeat: ["repetir", "otra vez", "repite"],
      };
  }
}

const MemoryGameRunner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameType } = useParams<{ gameType: MemoryGameType }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { speakSequence, stopTts, isTtsSpeaking } = useTtsReadout();
  const userId = user?.id ?? FALLBACK_USER_ID;

  const validGameType = gameType && gameType in memoryGameRegistry ? (gameType as MemoryGameType) : null;
  const initialLevel = Number(searchParams.get("level") ?? "1");
  const initialVariantId = searchParams.get("variant") ?? "";

  const [plan, setPlan] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [memoryAttempts, setMemoryAttempts] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completionMetrics, setCompletionMetrics] = useState<CompletionMetrics | null>(null);
  const [completionDetails, setCompletionDetails] = useState<CompletionDetails | null>(null);
  const [actionLoading, setActionLoading] = useState<"recommended" | "repeat" | null>(null);
  const [sequencePhase, setSequencePhase] = useState<"countdown" | "watching" | "input">("countdown");
  const [sequenceProgress, setSequenceProgress] = useState(0);
  const [activeSequenceTile, setActiveSequenceTile] = useState<string | null>(null);
  const [sequenceReady, setSequenceReady] = useState(false);
  const [sequenceTotalMistakes, setSequenceTotalMistakes] = useState(0);
  const [sequenceRun, setSequenceRun] = useState(0);
  const [sequenceCountdown, setSequenceCountdown] = useState(3);
  const [sequenceStatus, setSequenceStatus] = useState<"idle" | "wrong" | "wait">("idle");
  const [sequencePreviewStep, setSequencePreviewStep] = useState(0);
  const [wordRecallPhase, setWordRecallPhase] = useState<"memorize" | "distraction" | "recall">("memorize");
  const [wordRecallSelectedWords, setWordRecallSelectedWords] = useState<string[]>([]);
  const [wordRecallTypedWords, setWordRecallTypedWords] = useState<string[]>([]);
  const [wordRecallInput, setWordRecallInput] = useState("");
  const [wordRecallChoicesSeed, setWordRecallChoicesSeed] = useState(0);
  const [wordRecallMessage, setWordRecallMessage] = useState<string | null>(null);
  const [wordRecallVoiceMessage, setWordRecallVoiceMessage] = useState<string | null>(null);
  const [isMemoryAudioMuted, setIsMemoryAudioMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(MEMORY_AUDIO_STORAGE_KEY) === "true";
  });
  const timeoutRef = useRef<number | null>(null);
  const sequenceStatusTimeoutRef = useRef<number | null>(null);
  const sequenceProgressRef = useRef(0);
  const lastSequenceTapRef = useRef<{ tileId: string; at: number } | null>(null);
  const latestWordRecallWordsRef = useRef<string[]>([]);
  const wordRecallNarrationKeyRef = useRef<string>("");
  const wordRecallCommandCooldownRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function resolvePlan() {
      if (!validGameType) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const nextPlan =
        initialVariantId && Number.isFinite(initialLevel)
          ? {
              gameType: validGameType,
              level: Math.min(5, Math.max(1, initialLevel)),
              variantId: initialVariantId,
              reasonLabel: "",
            }
          : await selectGamePlan(userId, validGameType, language);

      if (!active) return;

      setPlan(nextPlan);
      setMatchedIds([]);
      setRevealed([]);
      setMemoryAttempts(0);
      setMistakes(0);
      setFinished(false);
      setSaving(false);
      setCompletionMetrics(null);
      setCompletionDetails(null);
      setActionLoading(null);
      setStartedAt(Date.now());
      setSequencePhase("countdown");
      setSequenceProgress(0);
      sequenceProgressRef.current = 0;
      setActiveSequenceTile(null);
      setSequenceReady(false);
      setSequenceTotalMistakes(0);
      setSequenceRun(0);
      setSequenceCountdown(3);
      setSequenceStatus("idle");
      setWordRecallPhase("memorize");
      setWordRecallSelectedWords([]);
      setWordRecallTypedWords([]);
      setWordRecallInput("");
      setWordRecallChoicesSeed((current) => current + 1);
      setWordRecallMessage(null);
      setWordRecallVoiceMessage(null);
      setLoading(false);
    }

    void resolvePlan();

    return () => {
      active = false;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      if (sequenceStatusTimeoutRef.current) {
        window.clearTimeout(sequenceStatusTimeoutRef.current);
      }
    };
  }, [initialLevel, initialVariantId, language, location.key, userId, validGameType]);

  const definition = plan ? getGameDefinition(plan.gameType) : null;
  const variant = useMemo(() => {
    if (!plan) return null;
    const levelConfig = getGameLevel(plan.gameType, plan.level);
    return levelConfig.variants.find((entry) => entry.id === plan.variantId) ?? levelConfig.variants[0];
  }, [plan]);

  const localizedVariant = useMemo(() => {
    if (!variant) return null;
    return getVariantContent(variant, language);
  }, [language, variant]);

  const wordRecallWords = useMemo(() => {
    if (!plan || plan.gameType !== "word_recall" || !localizedVariant) return [];
    return ((localizedVariant.payload.words as string[]) ?? []).filter(Boolean);
  }, [localizedVariant, plan]);

  const wordRecallDistractors = useMemo(() => {
    if (!plan || plan.gameType !== "word_recall" || !localizedVariant) return [];
    return ((localizedVariant.payload.distractors as string[]) ?? []).filter(Boolean);
  }, [localizedVariant, plan]);

  const wordRecallDistractionType = useMemo(() => {
    if (!plan || plan.gameType !== "word_recall" || !localizedVariant) return null;
    return (localizedVariant.payload.distractionType as WordRecallDistractionType | null) ?? null;
  }, [localizedVariant, plan]);

  const wordRecallChoiceWords = useMemo(() => {
    void wordRecallChoicesSeed;
    if (plan?.gameType !== "word_recall") return [];
    return shuffleItems([...wordRecallWords, ...wordRecallDistractors]);
  }, [plan?.gameType, wordRecallChoicesSeed, wordRecallDistractors, wordRecallWords]);

  const wordRecallCoachSegments = useMemo(() => {
    if (plan?.gameType !== "word_recall") return [];

    if (wordRecallPhase === "memorize") {
      return [
        { text: t("wordRecall.coachIntro"), delayMs: 500 },
        { text: localizedVariant?.prompt ?? "", delayMs: 450 },
        { text: t("wordRecall.coachMemorize"), delayMs: 500 },
        ...wordRecallWords.map((word) => ({ text: word, delayMs: 800, rate: 0.82 })),
        { text: t("wordRecall.coachReady"), delayMs: 450 },
      ];
    }

    if (wordRecallPhase === "distraction") {
      const distractionLine =
        wordRecallDistractionType === "choose_blue"
          ? t("wordRecall.distractionChooseBlue")
          : wordRecallDistractionType === "breathe_continue"
            ? t("wordRecall.distractionBreathe")
            : t("wordRecall.distractionCountBackwards");

      return [
        { text: t("wordRecall.coachDistraction"), delayMs: 500 },
        { text: distractionLine, delayMs: 450 },
      ];
    }

    return [
      { text: t("wordRecall.coachRecall"), delayMs: 450 },
      { text: t("wordRecall.selectRememberedWords"), delayMs: 350 },
    ];
  }, [localizedVariant?.prompt, plan?.gameType, t, wordRecallDistractionType, wordRecallPhase, wordRecallWords]);

  const wordRecallCommandTerms = useMemo(() => getWordRecallCommandTerms(language), [language]);

  const { isSupported: wordRecallVoiceSupported, isListening: wordRecallListening, startListening: startWordRecallListening } =
    useSpeechRecognition({
      language,
      onTranscript: (transcript) => {
        const transcriptParts = splitRecallText(transcript.replace(/\s+y\s+|\s+and\s+|\s+et\s+|\s+und\s+|\s+e\s+|\s+ou\s+/gi, ","));
        const matchedWords = latestWordRecallWordsRef.current.filter((word) =>
          transcriptParts.some((part) => wordsMatch(part, word)) || wordsMatch(transcript, word),
        );

        if (matchedWords.length === 0) {
          setWordRecallVoiceMessage(t("wordRecall.tryAgain"));
          return;
        }

        setWordRecallVoiceMessage(dedupeWords(matchedWords).join(", "));
        setWordRecallSelectedWords((current) => dedupeWords([...current, ...matchedWords]));
      },
    });

  const {
    isSupported: wordRecallCommandSupported,
    isListening: wordRecallCommandListening,
    startListening: startWordRecallCommandListening,
    stopListening: stopWordRecallCommandListening,
  } = useSpeechRecognition({
    language,
    onTranscript: (transcript) => {
      const now = Date.now();
      if (now - wordRecallCommandCooldownRef.current < 1200) return;

      const normalizedTranscript = normalizeRecallWord(transcript);
      const saidReady = wordRecallCommandTerms.ready.some((term) => normalizedTranscript.includes(normalizeRecallWord(term)));
      const saidRepeat = wordRecallCommandTerms.repeat.some((term) => normalizedTranscript.includes(normalizeRecallWord(term)));

      if (saidRepeat) {
        wordRecallCommandCooldownRef.current = now;
        wordRecallNarrationKeyRef.current = "";
        setWordRecallMessage(t("wordRecall.commandRepeatHeard"));
        stopTts();
        setTimeout(() => {
          speakSequence(
            wordRecallCoachSegments.map((segment) => ({
              ...segment,
              lang: getSpeechLanguage(language),
            })),
          );
        }, 180);
        return;
      }

      if (!saidReady) return;

      wordRecallCommandCooldownRef.current = now;
      setWordRecallMessage(t("wordRecall.commandReadyHeard"));

      if (wordRecallPhase === "memorize") {
        continueWordRecall();
        return;
      }

      if (wordRecallPhase === "distraction") {
        completeWordRecallDistraction();
      }
    },
  });

  useEffect(() => {
    latestWordRecallWordsRef.current = wordRecallWords;
  }, [wordRecallWords]);

  useEffect(() => {
    if (plan?.gameType !== "word_recall") return;
    if (isMemoryAudioMuted) {
      stopTts();
      return;
    }
    if (wordRecallCoachSegments.length === 0) return;

    const narrationKey = `${variant?.id ?? "word"}-${wordRecallPhase}-${wordRecallDistractionType ?? "none"}`;
    if (wordRecallNarrationKeyRef.current === narrationKey) return;
    wordRecallNarrationKeyRef.current = narrationKey;

    const timer = window.setTimeout(() => {
      speakSequence(
        wordRecallCoachSegments.map((segment) => ({
          ...segment,
          lang: getSpeechLanguage(language),
        })),
      );
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    isMemoryAudioMuted,
    language,
    plan?.gameType,
    speakSequence,
    stopTts,
    variant?.id,
    wordRecallCoachSegments,
    wordRecallDistractionType,
    wordRecallPhase,
  ]);

  useEffect(() => {
    if (plan?.gameType !== "word_recall") {
      stopTts();
      return;
    }
  }, [plan?.gameType, stopTts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MEMORY_AUDIO_STORAGE_KEY, String(isMemoryAudioMuted));
    if (isMemoryAudioMuted) {
      stopTts();
    }
  }, [isMemoryAudioMuted, stopTts]);

  useEffect(() => {
    const canListenForCommands =
      plan?.gameType === "word_recall" &&
      wordRecallCommandSupported &&
      !isMemoryAudioMuted &&
      !isTtsSpeaking &&
      (wordRecallPhase === "memorize" || wordRecallPhase === "distraction");

    if (!canListenForCommands) {
      stopWordRecallCommandListening();
      return;
    }

    if (!wordRecallCommandListening) {
      const timer = window.setTimeout(() => {
        startWordRecallCommandListening();
      }, 350);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [
    isMemoryAudioMuted,
    isTtsSpeaking,
    plan?.gameType,
    startWordRecallCommandListening,
    stopWordRecallCommandListening,
    wordRecallCommandListening,
    wordRecallCommandSupported,
    wordRecallPhase,
  ]);

  const memoryDeck = useMemo(() => {
    if (!plan || plan.gameType !== "memory_match" || !localizedVariant) return [];
    const pairItems = (localizedVariant.payload.pairItems as { label: string; emoji: string }[]) ?? [];

    return shuffleCards(
      pairItems.flatMap((item, index) => [
        { deckId: `${variant?.id}-${index}-a`, pairId: `${variant?.id}-${index}`, label: item.label, emoji: item.emoji },
        { deckId: `${variant?.id}-${index}-b`, pairId: `${variant?.id}-${index}`, label: item.label, emoji: item.emoji },
      ]),
    );
  }, [localizedVariant, plan, variant?.id]);

  const sequenceTiles = useMemo(() => {
    if (!plan || plan.gameType !== "sequence_memory" || !localizedVariant) return [];
    return ((localizedVariant.payload.tiles as SequenceTile[]) ?? []).slice(0, 4);
  }, [localizedVariant, plan]);

  const expectedSequence = useMemo(() => {
    if (!plan || plan.gameType !== "sequence_memory" || !localizedVariant) return [];
    const baseSequence = (localizedVariant.payload.sequence as string[]) ?? [];
    const reverse = Boolean(localizedVariant.payload.reverse);
    return reverse ? [...baseSequence].reverse() : baseSequence;
  }, [localizedVariant, plan]);

  const previewSequence = useMemo(() => {
    if (!plan || plan.gameType !== "sequence_memory" || !localizedVariant) return [];
    return (localizedVariant.payload.sequence as string[]) ?? [];
  }, [localizedVariant, plan]);

  const sequenceTileMap = useMemo(
    () => new Map(sequenceTiles.map((tile) => [tile.id, tile])),
    [sequenceTiles],
  );
  const sequenceTileRows = useMemo(
    () => [sequenceTiles.slice(0, 2), sequenceTiles.slice(2, 4)],
    [sequenceTiles],
  );
  const previewSequencePositions = useMemo(
    () => previewSequence.map((tileId) => sequenceTiles.findIndex((tile) => tile.id === tileId)).filter((index) => index >= 0),
    [previewSequence, sequenceTiles],
  );
  const expectedSequencePositions = useMemo(
    () => expectedSequence.map((tileId) => sequenceTiles.findIndex((tile) => tile.id === tileId)).filter((index) => index >= 0),
    [expectedSequence, sequenceTiles],
  );

  const replaySequence = () => {
    setSequencePhase("countdown");
    setSequenceReady(false);
    setSequenceProgress(0);
    sequenceProgressRef.current = 0;
    lastSequenceTapRef.current = null;
    setActiveSequenceTile(null);
    setSequenceCountdown(3);
    setSequenceStatus("idle");
    setSequencePreviewStep(0);
    setSequenceRun((current) => current + 1);
  };

  useEffect(() => {
    if (!plan || plan.gameType !== "sequence_memory" || !sequenceTiles.length || !expectedSequence.length || finished) return;

    setSequenceReady(false);
    setSequencePhase("countdown");
    setSequenceProgress(0);
    sequenceProgressRef.current = 0;
    lastSequenceTapRef.current = null;
    setActiveSequenceTile(null);
    setSequenceCountdown(3);
    setSequenceStatus("idle");
    setSequencePreviewStep(0);

    let cancelled = false;
    const previewSteps = [...previewSequence];
    const timeouts: number[] = [];

    [3, 2, 1].forEach((count, index) => {
      timeouts.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setSequencePhase("countdown");
          setSequenceCountdown(count);
        }, index * 1000),
      );
    });

    previewSteps.forEach((tileId, index) => {
      timeouts.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setSequencePhase("watching");
          setSequenceCountdown(0);
          setSequencePreviewStep(index + 1);
          setActiveSequenceTile(tileId);
        }, index * 900 + 3400),
      );
      timeouts.push(
        window.setTimeout(() => {
          if (!cancelled) setActiveSequenceTile(null);
        }, index * 900 + 3980),
      );
    });

    timeouts.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setSequencePhase("input");
        setSequenceReady(true);
        lastSequenceTapRef.current = null;
        setActiveSequenceTile(null);
        setStartedAt(Date.now());
      }, previewSteps.length * 900 + 3600),
    );

    return () => {
      cancelled = true;
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [expectedSequence, finished, plan, previewSequence, sequenceRun, sequenceTiles.length]);

  useEffect(() => {
    if (!plan || finished || saving) return;

    if (plan.gameType === "memory_match") {
      if (matchedIds.length !== memoryDeck.length || memoryDeck.length === 0) return;
      const durationSeconds = getDurationSeconds(startedAt);
      const accuracy = getMemoryMatchAccuracy(memoryDeck.length / 2, memoryAttempts);
      const score = getScore(plan.level, accuracy, mistakes, durationSeconds);
      setCompletionMetrics({ score, accuracy, mistakes, durationSeconds });
      setCompletionDetails(null);

      let active = true;
      async function completeGame() {
        setSaving(true);
        try {
          await saveGameResult({
            userId,
            gameType: plan.gameType,
            cognitiveDomain: definition?.cognitiveDomain ?? "visual_memory",
            variantId: plan.variantId,
            level: plan.level,
            score,
            accuracy,
            mistakes,
            durationSeconds,
            completedAt: new Date().toISOString(),
            language,
          });
        } finally {
          if (active) {
            setSaving(false);
            setFinished(true);
          }
        }
      }
      void completeGame();
      return () => {
        active = false;
      };
    }

    if (plan.gameType === "sequence_memory") {
      if (!sequenceReady || sequenceProgress !== expectedSequence.length || expectedSequence.length === 0) return;
      const durationSeconds = getDurationSeconds(startedAt);
      const accuracy = getSequenceAccuracy(expectedSequence.length, sequenceTotalMistakes);
      const score = getScore(plan.level, accuracy, sequenceTotalMistakes, durationSeconds);
      setCompletionMetrics({ score, accuracy, mistakes: sequenceTotalMistakes, durationSeconds });
      setCompletionDetails(null);

      let active = true;
      async function completeGame() {
        setSaving(true);
        try {
          await saveGameResult({
            userId,
            gameType: plan.gameType,
            cognitiveDomain: definition?.cognitiveDomain ?? "working_memory",
            variantId: plan.variantId,
            level: plan.level,
            score,
            accuracy,
            mistakes: sequenceTotalMistakes,
            durationSeconds,
            completedAt: new Date().toISOString(),
            language,
          });
        } finally {
          if (active) {
            setSaving(false);
            setFinished(true);
          }
        }
      }
      void completeGame();
      return () => {
        active = false;
      };
    }

    if (plan.gameType === "word_recall" && completionMetrics && !finished) {
      let active = true;
      async function completeGame() {
        setSaving(true);
        try {
          await saveGameResult({
            userId,
            gameType: plan.gameType,
            cognitiveDomain: definition?.cognitiveDomain ?? "episodic_memory",
            variantId: plan.variantId,
            level: plan.level,
            score: completionMetrics.score,
            accuracy: completionMetrics.accuracy,
            mistakes: completionMetrics.mistakes,
            durationSeconds: completionMetrics.durationSeconds,
            completedAt: new Date().toISOString(),
            language,
          });
        } finally {
          if (active) {
            setSaving(false);
            setFinished(true);
          }
        }
      }
      void completeGame();
      return () => {
        active = false;
      };
    }
  }, [
    completionMetrics,
    definition?.cognitiveDomain,
    expectedSequence.length,
    finished,
    language,
    matchedIds.length,
    memoryAttempts,
    memoryDeck.length,
    mistakes,
    plan,
    saving,
    sequenceProgress,
    sequenceReady,
    sequenceTotalMistakes,
    startedAt,
    userId,
  ]);

  const openRecommended = async () => {
    if (!plan) return;
    setActionLoading("recommended");
    try {
      const nextRecommendation = await selectNextMemoryGame(userId, language);
      navigate(`/memory-games/${nextRecommendation.gameType}?level=${nextRecommendation.level}&variant=${nextRecommendation.variantId}`, {
        state: { sessionToken: Date.now() },
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openSameGame = async () => {
    if (!plan) return;
    setActionLoading("repeat");
    try {
      const sameGameRecommendation = await selectNextVariantForSameGame(userId, plan.gameType, language);
      navigate(`/memory-games/${sameGameRecommendation.gameType}?level=${sameGameRecommendation.level}&variant=${sameGameRecommendation.variantId}`, {
        state: { sessionToken: Date.now() },
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (!validGameType) {
    return (
      <div className="px-[22px] py-8">
        <button
          onClick={() => navigate("/memory-games")}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
        >
          <ArrowLeft size={18} />
          {t("common.back")}
        </button>
        <div className="mt-5 rounded-[24px] border border-vyva-border bg-white p-6 shadow-vyva-card">
          <h1 className="font-display text-[28px] text-vyva-text-1">{t("memory.exerciseNotFound")}</h1>
          <p className="mt-3 text-[16px] text-vyva-text-2">{t("memory.exerciseNotFoundBody")}</p>
        </div>
      </div>
    );
  }

  if (loading || !plan || !definition || !variant || !localizedVariant) {
    return (
      <div className="px-[22px] py-10">
        <div className="flex items-center justify-center rounded-[24px] bg-white py-12 shadow-vyva-card">
          <Loader2 size={24} className="animate-spin text-vyva-purple" />
        </div>
      </div>
    );
  }

  const durationSeconds = completionMetrics?.durationSeconds ?? getDurationSeconds(startedAt);
  const memoryAccuracy = getMemoryMatchAccuracy(matchedIds.length / 2, memoryAttempts);
  const sequenceAccuracy = getSequenceAccuracy(expectedSequence.length, sequenceTotalMistakes);
  const summaryAccuracy = plan.gameType === "sequence_memory" ? sequenceAccuracy : memoryAccuracy;
  const summaryMistakes = plan.gameType === "sequence_memory" ? sequenceTotalMistakes : mistakes;
  const gameTitle = getGameTitle(plan.gameType, language);
  const gamePrompt = localizedVariant?.prompt ?? getGameDescription(plan.gameType, language);
  const GameIcon = getMemoryGameIcon(plan.gameType);
  const gameIconStyle = { background: definition.iconBg, color: definition.accentColor };

  if (plan.gameType !== "memory_match" && plan.gameType !== "sequence_memory" && plan.gameType !== "word_recall") {
    return (
      <div className="px-[22px] pb-6">
        <button
          onClick={() => navigate("/memory-games")}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
        >
          <ArrowLeft size={18} />
          {t("common.back")}
        </button>
        <div className="mt-4 rounded-[26px] bg-white p-6 shadow-vyva-card">
          <div
            className="inline-flex h-[64px] w-[64px] items-center justify-center rounded-[20px]"
            style={gameIconStyle}
          >
            <GameIcon size={28} />
          </div>
          <h1 className="mt-4 font-display text-[30px] text-vyva-text-1">{gameTitle}</h1>
          <p className="mt-2 text-[17px] leading-[1.6] text-vyva-text-2">{getGameDescription(plan.gameType, language)}</p>
          <div className="mt-5 rounded-[20px] border border-vyva-border bg-vyva-cream p-5">
            <p className="text-[18px] font-semibold text-vyva-text-1">{t("common.comingSoon")}</p>
            <p className="mt-2 text-[15px] leading-[1.6] text-vyva-text-2">{t("memory.stubBody")}</p>
          </div>
          <button
            onClick={() => navigate("/memory-games")}
            className="mt-5 w-full rounded-[18px] bg-vyva-purple px-5 py-4 text-[17px] font-semibold text-white"
          >
            {t("memory.backToMemory")}
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    const score = completionMetrics?.score ?? getScore(plan.level, summaryAccuracy, summaryMistakes, durationSeconds);
    const finishedAccuracy = completionMetrics?.accuracy ?? summaryAccuracy;
    const finishedMistakes = completionMetrics?.mistakes ?? summaryMistakes;

    return (
      <div className="px-[22px] pb-6">
        <div className="mt-6 rounded-[28px] bg-white p-6 shadow-vyva-card">
          <div className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-[#ECFDF5] text-[#0A7C4E]">
            <CheckCircle2 size={34} />
          </div>
          <h1 className="mt-5 font-display text-[34px] text-vyva-text-1">{t("memory.wellDone")}</h1>
          <p className="mt-2 text-[18px] leading-[1.6] text-vyva-text-2">{t("memory.exerciseCompleted")}</p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { label: t("memory.score"), value: `${score}` },
              { label: t("memory.accuracy"), value: `${finishedAccuracy}%` },
              { label: t("memory.mistakes"), value: `${finishedMistakes}` },
              { label: t("memory.duration"), value: `${durationSeconds}s` },
            ].map((item) => (
              <div key={item.label} className="rounded-[20px] border border-vyva-border bg-vyva-cream p-4">
                <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{item.label}</p>
                <p className="mt-2 text-[26px] font-semibold text-vyva-text-1">{item.value}</p>
              </div>
            ))}
          </div>

          {completionDetails && (
            <div className="mt-5 grid gap-3">
              {completionDetails.rememberedWords && completionDetails.rememberedWords.length > 0 && (
                <div className="rounded-[20px] border border-vyva-border bg-[#F8FAFC] p-4">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{t("wordRecall.remembered")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {completionDetails.rememberedWords.map((word) => (
                      <span key={`remembered-${word}`} className="rounded-full bg-white px-3 py-2 text-[15px] font-medium text-vyva-text-1 shadow-sm">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {completionDetails.correctWords && completionDetails.correctWords.length > 0 && (
                <div className="rounded-[20px] border border-[#CFE9D9] bg-[#F0FDF4] p-4">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{t("wordRecall.correctWords")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {completionDetails.correctWords.map((word) => (
                      <span key={`correct-${word}`} className="rounded-full bg-white px-3 py-2 text-[15px] font-medium text-vyva-text-1 shadow-sm">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {completionDetails.missedWords && completionDetails.missedWords.length > 0 && (
                <div className="rounded-[20px] border border-[#F3E0BD] bg-[#FFF7ED] p-4">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{t("wordRecall.missedWords")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {completionDetails.missedWords.map((word) => (
                      <span key={`missed-${word}`} className="rounded-full bg-white px-3 py-2 text-[15px] font-medium text-vyva-text-1 shadow-sm">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={openRecommended}
              disabled={actionLoading !== null}
              className="w-full rounded-[20px] bg-vyva-purple px-5 py-5 text-left text-[18px] font-semibold text-white shadow-vyva-card disabled:opacity-60"
            >
              <span className="block">{t("memory.continueRecommended")}</span>
              <span className="mt-1 block text-[14px] font-medium text-white/82">{t("memory.nextRecommended")}</span>
            </button>
            <button
              onClick={openSameGame}
              disabled={actionLoading !== null}
              className="w-full rounded-[20px] border border-[#D8C7F3] bg-[#FAF7FF] px-5 py-5 text-left text-[18px] font-semibold text-vyva-text-1 shadow-vyva-card disabled:opacity-60"
            >
              <span className="block">{t("memory.repeatSameGame")}</span>
              <span className="mt-1 block text-[14px] font-medium text-vyva-text-2">{t("memory.currentLevel")}</span>
            </button>
            <button
              onClick={() => navigate("/memory-games")}
              disabled={actionLoading !== null}
              className="w-full rounded-[20px] border border-vyva-border bg-white px-5 py-5 text-left text-[18px] font-semibold text-vyva-text-1 shadow-vyva-card disabled:opacity-60"
            >
              <span className="block">{t("memory.chooseAnotherExercise")}</span>
              <span className="mt-1 block text-[14px] font-medium text-vyva-text-2">{t("memory.chooseAnother")}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const onMemoryCardClick = (card: MemoryCard) => {
    if (finished || saving) return;
    if (matchedIds.includes(card.deckId) || revealed.includes(card.deckId) || revealed.length === 2) return;

    const nextRevealed = [...revealed, card.deckId];
    setRevealed(nextRevealed);

    if (nextRevealed.length < 2) return;

    setMemoryAttempts((current) => current + 1);

    const [firstId, secondId] = nextRevealed;
    const firstCard = memoryDeck.find((entry) => entry.deckId === firstId);
    const secondCard = memoryDeck.find((entry) => entry.deckId === secondId);

    if (!firstCard || !secondCard) {
      setRevealed([]);
      return;
    }

    if (firstCard.pairId === secondCard.pairId) {
      timeoutRef.current = window.setTimeout(() => {
        setMatchedIds((current) => [...current, firstId, secondId]);
        setRevealed([]);
      }, 450);
      return;
    }

    setMistakes((current) => current + 1);
    timeoutRef.current = window.setTimeout(() => {
      setRevealed([]);
    }, 850);
  };

  const onSequenceTileClick = (tileId: string, tileIndex: number) => {
    if (finished || saving) return;

    if (!sequenceReady || sequencePhase !== "input") {
      setSequenceStatus("wait");
      if (sequenceStatusTimeoutRef.current) {
        window.clearTimeout(sequenceStatusTimeoutRef.current);
      }
      sequenceStatusTimeoutRef.current = window.setTimeout(() => {
        setSequenceStatus((current) => (current === "wait" ? "idle" : current));
      }, 1200);
      return;
    }

    const now = Date.now();
    if (lastSequenceTapRef.current?.tileId === tileId && now - lastSequenceTapRef.current.at < 180) {
      return;
    }
    lastSequenceTapRef.current = { tileId, at: now };

    const currentProgress = sequenceProgressRef.current;
    const expectedPosition = expectedSequencePositions[currentProgress];
    if (expectedPosition === undefined) return;

    const isMatchingPosition = getMirroredSequenceIndex(tileIndex) === expectedPosition;

    if (isMatchingPosition) {
      setSequenceStatus("idle");
      setActiveSequenceTile(tileId);
      window.setTimeout(() => {
        setActiveSequenceTile(null);
      }, 220);
      const nextProgress = currentProgress + 1;
      sequenceProgressRef.current = nextProgress;
      setSequenceProgress(nextProgress);
      return;
    }

    setSequenceTotalMistakes((current) => current + 1);
    setSequenceStatus("wrong");
    setSequenceReady(false);
    setSequencePhase("countdown");
    setSequenceCountdown(3);
    setSequenceProgress(0);
    sequenceProgressRef.current = 0;
    setSequencePreviewStep(0);
    setActiveSequenceTile(tileId);
    window.setTimeout(() => {
      setActiveSequenceTile(null);
      lastSequenceTapRef.current = null;
      setSequenceRun((current) => current + 1);
    }, 700);
  };

  const onWordRecallChipToggle = (word: string) => {
    setWordRecallMessage(null);
    setWordRecallVoiceMessage(null);
    setWordRecallSelectedWords((current) =>
      current.some((entry) => wordsMatch(entry, word))
        ? current.filter((entry) => !wordsMatch(entry, word))
        : dedupeWords([...current, word]),
    );
  };

  const addTypedRecallWords = () => {
    const newWords = splitRecallText(wordRecallInput);
    if (newWords.length === 0) return;
    setWordRecallTypedWords((current) => dedupeWords([...current, ...newWords]));
    setWordRecallInput("");
    setWordRecallMessage(null);
  };

  const finishWordRecall = () => {
    const pendingWords = splitRecallText(wordRecallInput);
    const rememberedWords = dedupeWords([...wordRecallSelectedWords, ...wordRecallTypedWords, ...pendingWords]);
    const correctWords = wordRecallWords.filter((targetWord) =>
      rememberedWords.some((candidate) => wordsMatch(candidate, targetWord)),
    );
    const wrongWords = rememberedWords.filter(
      (candidate) => !wordRecallWords.some((targetWord) => wordsMatch(candidate, targetWord)),
    );
    const missedWords = wordRecallWords.filter(
      (targetWord) => !rememberedWords.some((candidate) => wordsMatch(candidate, targetWord)),
    );
    const accuracy = Math.round((correctWords.length / Math.max(1, wordRecallWords.length)) * 100);
    const score = Math.round((correctWords.length / Math.max(1, wordRecallWords.length)) * 100);
    const nextDurationSeconds = getDurationSeconds(startedAt);

    setCompletionDetails({
      rememberedWords,
      correctWords,
      missedWords,
    });
    setCompletionMetrics({
      score,
      accuracy,
      mistakes: wrongWords.length,
      durationSeconds: nextDurationSeconds,
    });
  };

  const continueWordRecall = () => {
    setWordRecallMessage(null);
    if (plan.level >= 4 && wordRecallDistractionType) {
      setWordRecallPhase("distraction");
      return;
    }
    setWordRecallPhase("recall");
  };

  const completeWordRecallDistraction = () => {
    setWordRecallMessage(null);
    setWordRecallPhase("recall");
  };

  const startWordRecallVoice = () => {
    setWordRecallVoiceMessage(null);
    if (!wordRecallVoiceSupported) {
      setWordRecallVoiceMessage(t("wordRecall.voiceNotSupported"));
      return;
    }
    const started = startWordRecallListening();
    if (!started) {
      setWordRecallVoiceMessage(t("wordRecall.voiceNotSupported"));
    }
  };

  const toggleMemoryAudio = () => {
    setIsMemoryAudioMuted((current) => {
      const next = !current;
      if (!next) {
        wordRecallNarrationKeyRef.current = "";
      }
      return next;
    });
  };

  const onWordRecallBlueChoice = (choice: "blue" | "other") => {
    if (choice === "blue") {
      completeWordRecallDistraction();
      return;
    }
    setWordRecallMessage(t("wordRecall.tryAgain"));
  };

  if (plan.gameType === "word_recall") {
    const rememberedCount = dedupeWords([...wordRecallSelectedWords, ...wordRecallTypedWords]).length;

    return (
      <div className="px-[22px] pb-6">
        <button
          onClick={() => navigate("/memory-games")}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
        >
          <ArrowLeft size={18} />
          {t("common.back")}
        </button>

        <section className="mt-4 overflow-hidden rounded-[28px] border border-[#EFE7DB] bg-[#FFF9F1] p-5 shadow-vyva-card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple shadow-sm">
                <NotebookPen size={14} />
                {t("wordRecall.memorizeInstruction")}
              </div>
              <h1 className="mt-4 font-display text-[30px] leading-[1.06] text-vyva-text-1">{gameTitle}</h1>
              <p className="mt-3 max-w-[24ch] text-[15px] leading-[1.55] text-vyva-text-2">{gamePrompt}</p>
            </div>
            <div className="flex h-[84px] w-[84px] flex-shrink-0 items-center justify-center rounded-[24px] bg-white shadow-vyva-card">
              <div className="flex h-[58px] w-[58px] items-center justify-center rounded-[18px]" style={gameIconStyle}>
                <GameIcon size={28} />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">{`${t("common.level")} ${plan.level}`}</span>
            <span className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">{`${t("wordRecall.correctWords")} ${rememberedCount}/${wordRecallWords.length}`}</span>
            <span className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">{`${t("memory.duration")} ${durationSeconds}s`}</span>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={toggleMemoryAudio}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D8C7F3] bg-white px-4 py-3 text-[15px] font-semibold text-vyva-purple shadow-vyva-card"
            >
              {isMemoryAudioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              {isMemoryAudioMuted ? t("wordRecall.unmuteAudio") : t("wordRecall.muteAudio")}
            </button>
          </div>

          {wordRecallPhase === "memorize" && (
            <>
              <div className="mt-4 rounded-[22px] border border-[#EADFF8] bg-white p-5">
                <p className="text-[17px] font-semibold text-vyva-text-1">{t("wordRecall.voiceCommandsHint")}</p>
                {wordRecallMessage && (
                  <div className="mt-4 rounded-[16px] border border-[#D8C7F3] bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1">
                    {wordRecallMessage}
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {wordRecallWords.map((word, index) => (
                  <div
                    key={word}
                    className="rounded-[24px] border border-white/70 px-5 py-7 text-center shadow-vyva-card"
                    style={{
                      background: index % 2 === 0 ? "#FFFFFF" : "#FAF7FF",
                    }}
                  >
                    <span className="text-[28px] font-semibold text-vyva-text-1">{word}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={continueWordRecall}
                className="mt-6 w-full rounded-[22px] bg-vyva-purple px-5 py-5 text-[20px] font-semibold text-white shadow-vyva-card"
              >
                {t("wordRecall.readyButton")}
              </button>
            </>
          )}

          {wordRecallPhase === "distraction" && (
            <div className="mt-5 rounded-[22px] border border-vyva-border bg-[#FFF7ED] p-5">
              <p className="text-[18px] font-semibold text-vyva-text-1">{t("wordRecall.distractionTitle")}</p>
              <p className="mt-2 text-[16px] leading-[1.6] text-vyva-text-2">
                {wordRecallDistractionType === "choose_blue"
                  ? t("wordRecall.distractionChooseBlue")
                  : wordRecallDistractionType === "breathe_continue"
                    ? t("wordRecall.distractionBreathe")
                    : t("wordRecall.distractionCountBackwards")}
              </p>
              <p className="mt-3 text-[14px] font-medium text-vyva-text-2">{t("wordRecall.voiceCommandsHint")}</p>

              {wordRecallDistractionType === "choose_blue" ? (
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { key: "other", color: "#F97316" },
                    { key: "blue", color: "#2563EB" },
                    { key: "other-2", color: "#16A34A" },
                  ].map((choice) => (
                    <button
                      key={choice.key}
                      onClick={() => onWordRecallBlueChoice(choice.key === "blue" ? "blue" : "other")}
                      className="min-h-[86px] rounded-[20px] shadow-vyva-card"
                      style={{ background: choice.color }}
                    />
                  ))}
                </div>
              ) : (
                <button
                  onClick={completeWordRecallDistraction}
                  className="mt-5 w-full rounded-[20px] bg-vyva-purple px-5 py-4 text-[18px] font-semibold text-white shadow-vyva-card"
                >
                  {t("wordRecall.continueButton")}
                </button>
              )}

              {wordRecallMessage && (
                <div className="mt-4 rounded-[16px] border border-[#F3E0BD] bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1">
                  {wordRecallMessage}
                </div>
              )}
            </div>
          )}

          {wordRecallPhase === "recall" && (
            <>
              <div className="mt-4 rounded-[20px] border border-vyva-border bg-vyva-purple-light p-5">
                <p className="text-[18px] font-semibold text-vyva-text-1">{t("wordRecall.recallInstruction")}</p>
                <p className="mt-2 text-[15px] leading-[1.6] text-vyva-text-2">{t("wordRecall.selectRememberedWords")}</p>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                <button
                  onClick={startWordRecallVoice}
                  disabled={wordRecallListening}
                  className="flex w-full items-center justify-between rounded-[22px] bg-vyva-purple px-5 py-5 text-left text-white shadow-vyva-card"
                >
                  <div>
                    <p className="text-[20px] font-semibold">{t("wordRecall.speakWords")}</p>
                    <p className="mt-1 text-[15px] text-white/85">
                      {wordRecallListening ? t("wordRecall.listening") : t("wordRecall.selectRememberedWords")}
                    </p>
                  </div>
                  <Mic size={24} />
                </button>

                {!wordRecallVoiceSupported && (
                  <div className="rounded-[16px] border border-vyva-border bg-white px-4 py-3 text-[15px] text-vyva-text-2">
                    {t("wordRecall.voiceNotSupported")}
                  </div>
                )}

                {wordRecallVoiceMessage && (
                  <div className="rounded-[16px] border border-[#D8C7F3] bg-[#FAF7FF] px-4 py-3 text-[15px] font-medium text-vyva-text-1">
                    {wordRecallVoiceMessage}
                  </div>
                )}

                <div className="rounded-[20px] border border-vyva-border bg-white p-4 shadow-vyva-card">
                  <div className="flex items-center gap-2 text-vyva-text-1">
                    <Type size={18} />
                    <span className="text-[16px] font-semibold">{t("wordRecall.remembered")}</span>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <input
                      value={wordRecallInput}
                      onChange={(event) => setWordRecallInput(event.target.value)}
                      placeholder={t("wordRecall.typeWordsPlaceholder")}
                      className="min-h-[56px] flex-1 rounded-[16px] border border-vyva-border px-4 text-[17px] text-vyva-text-1 outline-none"
                    />
                    <button
                      onClick={addTypedRecallWords}
                      className="rounded-[16px] border border-[#D8C7F3] bg-[#FAF7FF] px-5 text-[16px] font-semibold text-vyva-purple"
                    >
                      {t("wordRecall.addWord")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {wordRecallChoiceWords.map((word) => {
                  const selected = wordRecallSelectedWords.some((entry) => wordsMatch(entry, word));
                  return (
                    <button
                      key={word}
                      onClick={() => onWordRecallChipToggle(word)}
                      className="rounded-full border px-4 py-3 text-[17px] font-medium shadow-sm transition-all"
                      style={{
                        background: selected ? "#6B21A8" : "#FFFFFF",
                        color: selected ? "#FFFFFF" : "#2B2233",
                        borderColor: selected ? "#6B21A8" : "#D8C7F3",
                      }}
                    >
                      {word}
                    </button>
                  );
                })}
              </div>

              {(wordRecallSelectedWords.length > 0 || wordRecallTypedWords.length > 0) && (
                <div className="mt-5 rounded-[20px] border border-vyva-border bg-[#F8FAFC] p-4">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{t("wordRecall.remembered")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dedupeWords([...wordRecallSelectedWords, ...wordRecallTypedWords]).map((word) => (
                      <span key={`selected-${word}`} className="rounded-full bg-white px-3 py-2 text-[15px] font-medium text-vyva-text-1 shadow-sm">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={finishWordRecall}
                disabled={saving}
                className="mt-6 w-full rounded-[22px] bg-vyva-purple px-5 py-5 text-[20px] font-semibold text-white shadow-vyva-card disabled:opacity-60"
              >
                {t("wordRecall.continueButton")}
              </button>
            </>
          )}
        </section>
      </div>
    );
  }

  if (plan.gameType === "sequence_memory") {
    const reverseMode = Boolean(localizedVariant.payload.reverse);
    const sequenceInstruction =
      sequencePhase === "countdown"
        ? `${t("memory.sequenceCountdown")} ${sequenceCountdown}...`
        : sequencePhase === "watching"
        ? t("memory.sequenceWatch")
        : reverseMode
          ? t("memory.sequenceReverse")
          : t("memory.sequenceRepeat");
    const sequenceSupportText =
      sequenceStatus === "wait"
        ? t("memory.sequenceWaitTurnHint")
        : sequenceStatus === "wrong"
        ? t("memory.sequenceTryAgain")
        : sequencePhase === "countdown"
          ? t("memory.sequenceCountdownHint")
          : sequencePhase === "watching"
            ? t("memory.sequenceReady")
            : t("memory.sequenceTapHint");
    const currentStepIndex = Math.min(sequenceProgress + 1, expectedSequence.length);

    return (
      <div className="px-[22px] pb-6">
        <button
          onClick={() => navigate("/memory-games")}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
        >
          <ArrowLeft size={18} />
          {t("common.back")}
        </button>

        <section className="mt-4 overflow-hidden rounded-[28px] border border-[#EFE7DB] bg-[#FFF9F1] p-5 shadow-vyva-card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple shadow-sm">
                <Route size={14} />
                {t("memory.sequenceWatch")}
              </div>
              <h1 className="mt-4 font-display text-[30px] leading-[1.06] text-vyva-text-1">{gameTitle}</h1>
              <p className="mt-3 max-w-[24ch] text-[15px] leading-[1.55] text-vyva-text-2">{gamePrompt}</p>
            </div>
            <div className="flex h-[84px] w-[84px] flex-shrink-0 items-center justify-center rounded-[24px] bg-white shadow-vyva-card">
              <div className="flex h-[58px] w-[58px] items-center justify-center rounded-[18px]" style={gameIconStyle}>
                <GameIcon size={28} />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">{`${t("common.level")} ${plan.level}`}</span>
            <span className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">{`${sequenceProgress}/${expectedSequence.length}`}</span>
            <span className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">{`${t("memory.mistakes")} ${sequenceTotalMistakes}`}</span>
            <span className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">{`${durationSeconds}s`}</span>
          </div>

          <div className="mt-4 rounded-[22px] border border-[#EADFF8] bg-white p-5">
            <p className="text-[18px] font-semibold text-vyva-text-1">{sequenceInstruction}</p>
            <p className="mt-2 text-[15px] leading-[1.55] text-vyva-text-2">{sequenceSupportText}</p>
            {sequenceStatus === "wrong" && (
              <div className="mt-4 rounded-[16px] border border-[#F3C6CE] bg-[#FFF2F4] px-4 py-3 text-[15px] font-medium text-[#9F1239]">
                {t("memory.sequenceWrong")}
              </div>
            )}
            {sequenceStatus === "wait" && (
              <div className="mt-4 rounded-[16px] border border-[#CFE0FF] bg-[#EFF6FF] px-4 py-3 text-[15px] font-medium text-[#1D4ED8]">
                {t("memory.sequenceWaitTurn")}
              </div>
            )}
            {sequenceReady && (
              <button
                onClick={replaySequence}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#D8C7F3] bg-white px-4 py-3 text-[15px] font-semibold text-vyva-purple shadow-vyva-card"
              >
                <RotateCcw size={16} />
                {t("memory.sequenceWatchAgain")}
              </button>
            )}
          </div>

          <div className="mt-4 rounded-[20px] border border-[#EADFF8] bg-[#FFFCF8] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <div className="flex flex-wrap gap-2">
              {sequencePhase === "input"
                ? expectedSequencePositions.map((tileIndex, index) => {
                    const isDone = index < sequenceProgress;
                    const isCurrent = index === sequenceProgress;
                    return (
                      <div
                        key={`progress-${index}`}
                        className="flex h-[44px] min-w-[44px] items-center justify-center rounded-full border text-[15px] font-semibold"
                        style={{
                          background: isDone ? "#6B21A8" : isCurrent ? "#F3E8FF" : "#FAF7FF",
                          color: isDone ? "#FFFFFF" : "#5B4B71",
                          borderColor: isDone ? "#6B21A8" : "#D8C7F3",
                        }}
                      >
                        {tileIndex + 1}
                      </div>
                    );
                  })
                : previewSequencePositions.map((tileIndex, index) => {
                    const tile = sequenceTiles[tileIndex];
                    const revealed = index < sequencePreviewStep && tile;
                    return (
                      <div
                        key={`preview-${index}`}
                        className="flex h-[50px] min-w-[50px] items-center justify-center rounded-[16px] border text-[22px] shadow-sm"
                        style={{
                          background: revealed ? tile.color : "#FAF7FF",
                          color: revealed ? "#FFFFFF" : "#7C6D94",
                          borderColor: revealed ? tile.color : "#D8C7F3",
                          transform: revealed && index + 1 === sequencePreviewStep ? "translateY(-2px) scale(1.02)" : "none",
                        }}
                      >
                        {tileIndex + 1}
                      </div>
                    );
                  })}
            </div>
            <p className="mt-3 text-[14px] font-medium text-vyva-text-2">
              {sequencePhase === "input" ? `${currentStepIndex}/${expectedSequence.length}` : `${sequencePreviewStep}/${previewSequencePositions.length}`}
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            {sequenceTileRows.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="grid grid-cols-2 gap-4">
                {row.map((tile, columnIndex) => {
                  const index = rowIndex * 2 + columnIndex;
                  const isActive = activeSequenceTile === tile.id;
                  const isWatching = sequencePhase === "watching";
                  const shouldDim = isWatching && !isActive;
                  return (
                    <button
                      key={tile.id}
                      onClick={() => onSequenceTileClick(tile.id, index)}
                      aria-disabled={!sequenceReady}
                      className="min-h-[148px] rounded-[24px] border border-vyva-border px-4 py-5 text-white shadow-vyva-card transition-transform"
                      style={{
                        background: isActive ? "#111827" : tile.color,
                        transform: isActive ? "scale(1.03)" : shouldDim ? "scale(0.98)" : "scale(1)",
                        opacity: sequenceReady ? 1 : shouldDim ? 0.42 : 0.76,
                        borderColor: isActive ? "#FFFFFF" : "#E9DDF8",
                        boxShadow: isActive ? "0 0 0 6px rgba(255,255,255,0.88), 0 18px 36px rgba(17,24,39,0.25)" : undefined,
                      }}
                    >
                      <div className="flex h-full flex-col items-center justify-center">
                        <span className="mb-3 inline-flex h-[28px] min-w-[28px] items-center justify-center rounded-full bg-white/18 px-2 text-[13px] font-semibold text-white">
                          {index + 1}
                        </span>
                        <span className="text-[42px] leading-none">{tile.emoji}</span>
                        {isWatching && isActive && (
                          <span className="mt-3 rounded-full bg-white/18 px-3 py-1 text-[15px] font-semibold text-white">
                            {index + 1}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

        </section>
      </div>
    );
  }

  const matchedPairs = matchedIds.length / 2;
  const totalPairs = memoryDeck.length / 2;

  return (
    <div className="px-[22px] pb-6">
      <button
        onClick={() => navigate("/memory-games")}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
      >
        <ArrowLeft size={18} />
        {t("common.back")}
      </button>
      <section className="mt-4 overflow-hidden rounded-[28px] border border-[#EFE7DB] bg-[#FFF9F1] p-5 shadow-vyva-card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple shadow-sm">
              <Grid2x2 size={14} />
              {t("memory.matchInstruction")}
            </div>
            <h1 className="mt-4 font-display text-[30px] leading-[1.06] text-vyva-text-1">{gameTitle}</h1>
            <p className="mt-3 max-w-[24ch] text-[15px] leading-[1.55] text-vyva-text-2">{gamePrompt}</p>
          </div>
          <div className="flex h-[84px] w-[84px] flex-shrink-0 items-center justify-center rounded-[24px] bg-white shadow-vyva-card">
            <div className="flex h-[58px] w-[58px] items-center justify-center rounded-[18px]" style={gameIconStyle}>
              <GameIcon size={28} />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">{`${t("common.level")} ${plan.level}`}</span>
          <span className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">{`${matchedPairs}/${totalPairs} ${t("memory.pairs")}`}</span>
          <span className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">{`${memoryAccuracy}%`}</span>
          <span className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">{`${durationSeconds}s`}</span>
        </div>

        <div className="mt-4 rounded-[22px] border border-[#EADFF8] bg-white p-4">
          <p className="text-[15px] font-medium text-vyva-text-1">
            {t("memory.matchInstruction")} <span className="font-semibold text-vyva-purple">{memoryAccuracy}%</span>
          </p>
        </div>

        <div className={`mt-5 grid gap-3 ${memoryDeck.length <= 6 ? "grid-cols-2" : "grid-cols-4"}`}>
          {memoryDeck.map((card) => {
            const isOpen = revealed.includes(card.deckId) || matchedIds.includes(card.deckId);
            return (
              <button
                key={card.deckId}
                onClick={() => onMemoryCardClick(card)}
                className="aspect-[0.9] rounded-[20px] border border-vyva-border p-3 text-center shadow-vyva-card transition-all"
                style={
                  isOpen
                    ? { background: "#FFFFFF", borderColor: "#C4B5FD", transform: "translateY(-1px)" }
                    : { background: "linear-gradient(145deg, #6B21A8 0%, #8B3FC8 100%)", color: "#FFFFFF" }
                }
              >
                <div className="flex h-full flex-col items-center justify-center">
                  {isOpen ? (
                    <>
                      <span className="text-[36px] leading-none">{card.emoji}</span>
                      <span className="mt-3 text-[18px] font-semibold text-vyva-text-1">{card.label}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[34px] font-semibold">?</span>
                      <span className="mt-3 text-[15px] font-medium text-white/90">{t("common.continue")}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default MemoryGameRunner;
