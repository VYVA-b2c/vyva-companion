import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleHelp, Layers, Palette, Ruler, Shapes } from "lucide-react";
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
};

const COLOR_HEX = {
  red: "#DC2626",
  blue: "#2563EB",
  yellow: "#FACC15",
  green: "#16A34A",
  purple: "#7C3AED",
  orange: "#F97316",
};

const COLOR_ORDER = ["red", "blue", "yellow", "green", "purple", "orange"];
const SHAPE_ORDER = ["circle", "square", "triangle", "star", "diamond", "cross"];
const SIZE_ORDER = ["small", "medium", "large"];
const MAX_CATEGORY_SORT_TIER = BRAIN_COACH_MAX_LEVEL;
const LEVEL_UP_ACCURACY_PCT = 75;
const LEVEL_DOWN_ACCURACY_PCT = 45;
const LOCAL_STATE_PREFIX = "vyva_category_sort_user_state";

const RULE_LABELS = {
  color: { es: "Color", en: "Colour", fr: "Couleur", de: "Farbe" },
  shape: { es: "Forma", en: "Shape", fr: "Forme", de: "Form" },
  size: { es: "Tamano", en: "Size", fr: "Taille", de: "Grosse" },
  semantic_living: { es: "Vivo", en: "Living", fr: "Vivant", de: "Lebendig" },
  semantic_food: { es: "Comida", en: "Food", fr: "Aliment", de: "Essen" },
  semantic_group: { es: "Categoria", en: "Category", fr: "Categorie", de: "Kategorie" },
};

function labelForRule(rule, language) {
  if (rule?.rule === "semantic_group") {
    return RULE_LABELS[`semantic_${rule.semantic_group_value}`]?.[language] ?? RULE_LABELS.semantic_group[language] ?? RULE_LABELS.semantic_group.en;
  }

  return RULE_LABELS[rule?.rule]?.[language] ?? "";
}

function ruleEntry(rule, switchAfter = 4, extra = {}) {
  const labels = labelForRule({ rule, ...extra }, "es")
    ? {
        label_es: labelForRule({ rule, ...extra }, "es"),
        label_en: labelForRule({ rule, ...extra }, "en"),
        label_fr: labelForRule({ rule, ...extra }, "fr"),
        label_de: labelForRule({ rule, ...extra }, "de"),
      }
    : {};

  return { rule, switch_after: switchAfter, ...extra, ...labels };
}

const FALLBACK_CARDS = [
  { id: "practice-1", color: "red", shape: "circle", size: "large", semantic_class: "food", semantic_group: "food", label_es: "Manzana", label_de: "Apfel", label_en: "Apple", icon: "🍎" },
  { id: "practice-2", color: "blue", shape: "square", size: "medium", semantic_class: "vehicle", semantic_group: "non_living", label_es: "Coche", label_de: "Auto", label_en: "Car", icon: "🚗" },
  { id: "practice-3", color: "yellow", shape: "triangle", size: "small", semantic_class: "animal", semantic_group: "living", label_es: "Mariposa", label_de: "Schmetterling", label_en: "Butterfly", icon: "🦋" },
  { id: "practice-4", color: "green", shape: "circle", size: "medium", semantic_class: "plant", semantic_group: "living", label_es: "Arbol", label_de: "Baum", label_en: "Tree", icon: "🌲" },
  { id: "practice-5", color: "purple", shape: "diamond", size: "large", semantic_class: "tool", semantic_group: "non_living", label_es: "Llave", label_de: "Schluessel", label_en: "Key", icon: "🔑" },
  { id: "practice-6", color: "orange", shape: "cross", size: "small", semantic_class: "animal", semantic_group: "living", label_es: "Zorro", label_de: "Fuchs", label_en: "Fox", icon: "🦊" },
  { id: "practice-7", color: "red", shape: "diamond", size: "small", semantic_class: "clothing", semantic_group: "man_made", label_es: "Gorra", label_de: "Muetze", label_en: "Hat", icon: "👒" },
  { id: "practice-8", color: "blue", shape: "cross", size: "large", semantic_class: "nature", semantic_group: "nature", label_es: "Montana", label_de: "Berg", label_en: "Mountain", icon: "🏔️" },
  { id: "practice-9", color: "yellow", shape: "circle", size: "small", semantic_class: "food", semantic_group: "food", label_es: "Limon", label_de: "Zitrone", label_en: "Lemon", icon: "🍋" },
  { id: "practice-10", color: "green", shape: "star", size: "large", semantic_class: "building", semantic_group: "non_living", label_es: "Casa", label_de: "Haus", label_en: "House", icon: "🏠" },
  { id: "practice-11", color: "purple", shape: "triangle", size: "medium", semantic_class: "animal", semantic_group: "living", label_es: "Pajaro", label_de: "Vogel", label_en: "Bird", icon: "🐦" },
  { id: "practice-12", color: "orange", shape: "square", size: "large", semantic_class: "food", semantic_group: "food", label_es: "Uvas", label_de: "Trauben", label_en: "Grapes", icon: "🍇" },
];

const FALLBACK_SEQUENCE = {
  id: null,
  difficulty_tier: 1,
  card_ids: FALLBACK_CARDS.map((card) => card.id),
  card_count: FALLBACK_CARDS.length,
  language: "es",
  rules: [
    ruleEntry("color"),
    ruleEntry("shape"),
    ruleEntry("color"),
  ],
};

export function getFallbackSequence(tier = 1) {
  const difficultyTier = clamp(Number(tier) || 1, 1, MAX_CATEGORY_SORT_TIER);
  const fallbackRules = [
    [ruleEntry("color"), ruleEntry("shape"), ruleEntry("color")],
    [ruleEntry("shape"), ruleEntry("color"), ruleEntry("shape")],
    [ruleEntry("color"), ruleEntry("size"), ruleEntry("shape")],
    [ruleEntry("shape"), ruleEntry("size"), ruleEntry("color")],
    [
      ruleEntry("semantic_group", 4, {
        semantic_group_value: "living",
        categories: [{ value: "living" }, { value: "non_living" }],
      }),
      ruleEntry("color"),
      ruleEntry("shape"),
    ],
    [
      ruleEntry("semantic_group", 4, {
        semantic_group_value: "food",
        categories: [{ value: "food" }, { value: "non_food" }],
      }),
      ruleEntry("size"),
      ruleEntry("shape"),
    ],
  ];

  return {
    ...FALLBACK_SEQUENCE,
    difficulty_tier: difficultyTier,
    rules: fallbackRules[(difficultyTier - 1) % fallbackRules.length],
  };
}

export function getNextCategorySortTierAfterRound(currentTier, combinedAccuracyPct) {
  const tier = clamp(Number(currentTier) || 1, 1, MAX_CATEGORY_SORT_TIER);
  if (Number(combinedAccuracyPct) >= LEVEL_UP_ACCURACY_PCT) {
    return clamp(tier + 1, 1, MAX_CATEGORY_SORT_TIER);
  }
  return tier;
}

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
    updated_at: new Date().toISOString(),
  };
}

function localStateKey(userId) {
  return `${LOCAL_STATE_PREFIX}:${userId || "local"}`;
}

function readLocalUserState(userId) {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(localStateKey(userId));
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return {
      ...getDefaultUserState(userId),
      ...parsed,
      user_id: userId,
      current_tier: clamp(Number(parsed.current_tier ?? 1), 1, MAX_CATEGORY_SORT_TIER),
    };
  } catch {
    return null;
  }
}

function writeLocalUserState(userId, state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localStateKey(userId), JSON.stringify(state));
  } catch {
    // Local progress is helpful, but the game should remain playable if storage is unavailable.
  }
}

function normalizeSequence(row) {
  return {
    ...row,
    card_ids: asArray(row.card_ids),
    rules: asArray(row.rules),
    card_count: Number(row.card_count ?? asArray(row.card_ids).length),
    difficulty_tier: Number(row.difficulty_tier ?? 1),
  };
}

function ruleLabel(rule, language) {
  const key = `label_${language}`;
  return rule?.[key] ?? labelForRule(rule, language) ?? rule?.label_en ?? rule?.label_es ?? "";
}

function cardLabel(card, language) {
  const key = `label_${language}`;
  return card?.[key] ?? card?.label_es ?? card?.label_en ?? "";
}

function getSemanticCategory(card, semanticType) {
  if (semanticType === "living") {
    return card.semantic_class === "animal" || card.semantic_class === "plant" ? "living" : "non_living";
  }

  if (semanticType === "food") {
    return card.semantic_class === "food" ? "food" : "non_food";
  }

  if (["tool", "vehicle", "building", "clothing"].includes(card.semantic_class)) {
    return "man_made";
  }

  return "nature";
}

function getCorrectCategory(card, rule) {
  if (!card || !rule) return "";
  if (rule.rule === "color") return card.color;
  if (rule.rule === "shape") return card.shape;
  if (rule.rule === "size") return card.size;
  if (rule.rule === "semantic_group") {
    return getSemanticCategory(card, rule.semantic_group_value ?? card.semantic_group);
  }
  return "";
}

function getRulePhaseKey(entry) {
  if (entry.rule === "semantic_group") return `${entry.rule}:${entry.semantic_group_value}`;
  return entry.rule;
}

function iconForRule(rule) {
  if (rule?.rule === "color") return Palette;
  if (rule?.rule === "shape") return Shapes;
  if (rule?.rule === "size") return Ruler;
  return Layers;
}

function ShapeGlyph({ shape, color, className = "", size = 84 }) {
  const fill = COLOR_HEX[color] ?? color ?? BRAND.purple;
  const stroke = fill === COLOR_HEX.yellow ? "#9A6B00" : "#FFFFFF";

  if (shape === "circle") {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
        <circle cx="50" cy="50" r="35" fill={fill} stroke={stroke} strokeWidth="4" />
      </svg>
    );
  }

  if (shape === "square") {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
        <rect x="21" y="21" width="58" height="58" rx="6" fill={fill} stroke={stroke} strokeWidth="4" />
      </svg>
    );
  }

  if (shape === "triangle") {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
        <path d="M50 14 L86 82 H14 Z" fill={fill} stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
      </svg>
    );
  }

  if (shape === "star") {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
        <path d="M50 10 L61 36 L89 38 L67 56 L74 84 L50 69 L26 84 L33 56 L11 38 L39 36 Z" fill={fill} stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
      </svg>
    );
  }

  if (shape === "diamond") {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
        <path d="M50 10 L88 50 L50 90 L12 50 Z" fill={fill} stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <path d="M40 15 H60 V40 H85 V60 H60 V85 H40 V60 H15 V40 H40 Z" fill={fill} stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

function CategoryMarker({ category, rule, compact = false }) {
  if (rule.rule === "color") {
    return <span className={`${compact ? "h-6 w-6" : "h-8 w-8"} shrink-0 rounded-full border-2 border-white shadow-sm`} style={{ background: COLOR_HEX[category.value] ?? BRAND.purple }} aria-hidden="true" />;
  }

  if (rule.rule === "shape") {
    return <ShapeGlyph shape={category.value} color="purple" size={compact ? 28 : 38} />;
  }

  if (rule.rule === "size") {
    const scale = compact
      ? category.value === "small" ? "h-4 w-4" : category.value === "medium" ? "h-5 w-5" : "h-6 w-6"
      : category.value === "small" ? "h-5 w-5" : category.value === "medium" ? "h-7 w-7" : "h-9 w-9";
    return <span className={`${scale} rounded-[6px] bg-vyva-purple`} aria-hidden="true" />;
  }

  const symbol = category.value === "living" || category.value === "nature" || category.value === "food" ? "✓" : "•";
  return <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF7ED] text-[26px] font-black text-[#9A3412]" aria-hidden="true">{symbol}</span>;
}

export default function CategorySort({
  userId,
  onExit,
  assessmentPractice = null,
  onAssessmentPracticeComplete,
  onAssessmentPracticeReturn,
}) {
  const { language, t } = useLanguage();
  const gameLanguage = normalizeGameLanguage(language);
  const text = useMemo(() => ({
    loading: t("brainGames.categorySort.loading"),
    practiceNote: t("brainGames.categorySort.practiceNote"),
    title: t("brainGames.categorySort.title"),
    subtitle: t("brainGames.categorySort.subtitle"),
    level: t("common.level"),
    back: t("common.back"),
    example: t("brainGames.categorySort.example"),
    start: t("brainGames.categorySort.start"),
    tutorialTitle: t("brainGames.categorySort.tutorialTitle"),
    tutorialColorHint: t("brainGames.categorySort.tutorialColorHint"),
    tutorialShapeHint: t("brainGames.categorySort.tutorialShapeHint"),
    skip: t("brainGames.categorySort.skip"),
    exit: t("brainGames.categorySort.exit"),
    card: t("brainGames.categorySort.card"),
    of: t("brainGames.categorySort.of"),
    sortBy: t("brainGames.categorySort.sortBy"),
    newRule: t("brainGames.categorySort.newRule"),
    correct: t("brainGames.categorySort.correct"),
    reminder: t("brainGames.categorySort.reminder"),
    streak: t("brainGames.categorySort.streak"),
    resultGreat: t("brainGames.categorySort.resultGreat"),
    resultGood: t("brainGames.categorySort.resultGood"),
    accuracy: t("brainGames.categorySort.accuracy"),
    flexibility: t("brainGames.categorySort.flexibility"),
    flexibilityHint: t("brainGames.categorySort.flexibilityHint"),
    score: t("brainGames.categorySort.score"),
    days: t("brainGames.categorySort.days"),
    ruleBreakdown: t("brainGames.categorySort.ruleBreakdown"),
    progressNext: t("brainGames.categorySort.progressNext"),
    continueAction: t("brainGames.resultActions.continue"),
    continueToLevel: t("brainGames.resultActions.continueToLevel"),
    playAgain: t("brainGames.resultActions.playAgain"),
    playAnotherGame: t("brainGames.resultActions.playAnotherGame"),
  }), [t]);

  const [screen, setScreen] = useState("loading");
  const [sequence, setSequence] = useState(null);
  const [cards, setCards] = useState([]);
  const [userState, setUserState] = useState(null);
  const [loadNote, setLoadNote] = useState("");

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [currentRuleIndex, setCurrentRuleIndex] = useState(0);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [showRuleChange, setShowRuleChange] = useState(false);
  const [ruleChangeRule, setRuleChangeRule] = useState(null);
  const [lastFeedback, setLastFeedback] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const [sessionLog, setSessionLog] = useState([]);
  const [sessionResult, setSessionResult] = useState(null);

  const [tutorialRuleIndex, setTutorialRuleIndex] = useState(0);
  const [tutorialCardIndex, setTutorialCardIndex] = useState(0);
  const [tutorialCorrect, setTutorialCorrect] = useState(0);
  const [tutorialOverlay, setTutorialOverlay] = useState(false);

  const timersRef = useRef([]);
  const sessionLogRef = useRef([]);
  const cardStartTimeRef = useRef(Date.now());
  const sessionStartedAtRef = useRef(Date.now());
  const previousRuleRef = useRef(null);
  const switchStatsRef = useRef({ total: 0, handled: 0 });
  const adaptationWindowRef = useRef(null);
  const sessionSavedRef = useRef(false);
  const finalizingRef = useRef(false);
  const latestRef = useRef({ screen: "loading", sequence: null, cards: [] });

  useEffect(() => {
    latestRef.current = { screen, sequence, cards };
  }, [screen, sequence, cards]);

  const addTimer = useCallback((callback, delay) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((timerId) => timerId !== id);
      callback();
    }, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const getCategoryLabel = useCallback((value, group) => {
    return t(`brainGames.categorySort.${group}.${value}`);
  }, [t]);

  const getCategoriesForRule = useCallback((rule, cardQueue) => {
    if (!rule) return [];

    if (rule.rule === "color") {
      return [...new Set(cardQueue.map((card) => card.color))]
        .sort((a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b))
        .map((value) => ({ value, label: getCategoryLabel(value, "colors") }));
    }

    if (rule.rule === "shape") {
      return [...new Set(cardQueue.map((card) => card.shape))]
        .sort((a, b) => SHAPE_ORDER.indexOf(a) - SHAPE_ORDER.indexOf(b))
        .map((value) => ({ value, label: getCategoryLabel(value, "shapes") }));
    }

    if (rule.rule === "size") {
      return SIZE_ORDER.map((value) => ({ value, label: getCategoryLabel(value, "sizes") }));
    }

    return asArray(rule.categories).map((category) => ({
      value: category.value,
      label: getCategoryLabel(category.value, "semantic"),
    }));
  }, [getCategoryLabel]);

  const resetRoundState = useCallback(() => {
    clearTimers();
    setCurrentCardIndex(0);
    setCurrentRuleIndex(0);
    setConsecutiveCorrect(0);
    setShowRuleChange(false);
    setRuleChangeRule(null);
    setLastFeedback(null);
    setIsResolving(false);
    setSessionLog([]);
    setSessionResult(null);
    setTutorialRuleIndex(0);
    setTutorialCardIndex(0);
    setTutorialCorrect(0);
    setTutorialOverlay(false);
    sessionLogRef.current = [];
    previousRuleRef.current = null;
    switchStatsRef.current = { total: 0, handled: 0 };
    adaptationWindowRef.current = null;
    sessionSavedRef.current = false;
    finalizingRef.current = false;
    sessionStartedAtRef.current = Date.now();
    cardStartTimeRef.current = Date.now();
  }, [clearTimers]);

  const loadUserState = useCallback(async () => {
    const fallback = getDefaultUserState(userId);
    if (!userId) return readLocalUserState(userId) ?? fallback;

    const existing = await gameData
      .table("category_sort_user_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (existing.data) return existing.data;

    const created = await gameData
      .table("category_sort_user_state")
      .upsert(fallback, { onConflict: "user_id" })
      .select("*")
      .single();

    if (created.error) throw created.error;
    return created.data ?? fallback;
  }, [userId]);

  const loadSequence = useCallback(async (state) => {
    if (!userId) {
      return { sequence: getFallbackSequence(state?.current_tier), cards: FALLBACK_CARDS };
    }

    const tier = Number(state?.current_tier ?? 1);
    const languageOrder = [...new Set([gameLanguage, "es", "en", "de"])];
    const start = startOfLocalDay();
    const end = addDays(start, 1);

    const todaySessions = await gameData
      .table("category_sort_sessions")
      .select("sequence_id")
      .eq("user_id", userId)
      .gte("played_at", start.toISOString())
      .lt("played_at", end.toISOString());

    if (todaySessions.error) throw todaySessions.error;
    const playedToday = (todaySessions.data ?? []).map((session) => session.sequence_id).filter(Boolean);

    let selectedSequence = null;

    for (const languageToUse of languageOrder) {
      let query = gameData
        .table("category_sort_sequences")
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
        selectedSequence = rows.data[Math.floor(Math.random() * rows.data.length)];
        break;
      }
    }

    if (!selectedSequence) {
      const history = await gameData
        .table("category_sort_sessions")
        .select("sequence_id,played_at")
        .eq("user_id", userId)
        .eq("difficulty_tier", tier)
        .order("played_at", { ascending: false })
        .limit(500);

      if (history.error) throw history.error;
      const lastPlayed = new Map();
      for (const session of history.data ?? []) {
        if (session.sequence_id && !lastPlayed.has(session.sequence_id)) {
          lastPlayed.set(session.sequence_id, new Date(session.played_at).getTime());
        }
      }

      for (const languageToUse of languageOrder) {
        const rows = await gameData
          .table("category_sort_sequences")
          .select("*")
          .eq("difficulty_tier", tier)
          .eq("is_active", true)
          .eq("language", languageToUse)
          .limit(80);

        if (rows.error) throw rows.error;
        if (!rows.data?.length) continue;
        selectedSequence = [...rows.data].sort((a, b) => (lastPlayed.get(a.id) ?? 0) - (lastPlayed.get(b.id) ?? 0))[0];
        break;
      }
    }

    if (!selectedSequence) throw new Error("No Category Sort sequences are available.");

    const normalized = normalizeSequence(selectedSequence);
    const cardIds = normalized.card_ids;
    const cardRows = await gameData
      .table("category_sort_cards")
      .select("*")
      .in("id", cardIds);

    if (cardRows.error) throw cardRows.error;
    const cardById = new Map((cardRows.data ?? []).map((card) => [card.id, card]));
    const orderedCards = cardIds.map((id) => cardById.get(id)).filter(Boolean);
    if (orderedCards.length !== cardIds.length) throw new Error("A Category Sort sequence is missing card data.");

    return { sequence: normalized, cards: orderedCards };
  }, [gameLanguage, userId]);

  const loadGame = useCallback(async (overrideState) => {
    resetRoundState();
    setScreen("loading");
    setLoadNote("");
    let attemptedState = overrideState ?? null;

    try {
      const state = overrideState ?? await loadUserState();
      attemptedState = state;
      const loaded = await loadSequence(state);
      setUserState(state);
      setSequence(loaded.sequence);
      setCards(loaded.cards);
      setScreen("intro");
    } catch (error) {
      console.warn("Category Sort is using the practice deck because levels could not load.", error);
      const fallbackState = attemptedState ?? getDefaultUserState(userId);
      setUserState(fallbackState);
      setSequence(getFallbackSequence(fallbackState.current_tier));
      setCards(FALLBACK_CARDS);
      setLoadNote(text.practiceNote);
      setScreen("intro");
    }
  }, [loadSequence, loadUserState, resetRoundState, text.practiceNote, userId]);

  useEffect(() => {
    void loadGame();
    return () => {
      clearTimers();
    };
  }, [clearTimers, loadGame]);

  const saveSession = useCallback(async (result) => {
    if (!userId || sessionSavedRef.current) return;
    sessionSavedRef.current = true;

    const payload = {
      user_id: userId,
      sequence_id: result.sequence_id ?? null,
      difficulty_tier: result.difficulty_tier,
      card_count: result.card_count,
      cards_sorted: result.cards_sorted,
      cards_correct: result.cards_correct,
      perseverative_errors: result.perseverative_errors,
      rule_switches_total: result.rule_switches_total,
      rule_switches_handled: result.rule_switches_handled,
      accuracy_pct: result.accuracy_pct,
      flexibility_pct: result.flexibility_pct,
      avg_response_ms: result.avg_response_ms,
      score: result.score,
      completed: result.completed,
      abandoned: result.abandoned,
      duration_seconds: result.duration_seconds,
    };

    const saved = await gameData.table("category_sort_sessions").insert(payload);
    if (saved.error) {
      sessionSavedRef.current = false;
    }
    const savedSession = Array.isArray(saved.data) ? saved.data[0] : saved.data;

    await recordCognitiveSession({
      userId,
      activityType: "category_sort",
      domain: "executive_function",
      difficulty: result.difficulty_tier,
      difficultyScale: "tier",
      completed: result.completed,
      abandoned: result.abandoned,
      score: result.score,
      accuracyPct: result.combined_accuracy_pct,
      durationSeconds: result.duration_seconds,
      language: gameLanguage,
      source: "category_sort",
      sourceTable: "category_sort_sessions",
      sourceSessionId: savedSession?.id ?? null,
      metadata: {
        sequenceId: result.sequence_id ?? null,
        cardCount: result.card_count,
        cardsSorted: result.cards_sorted,
        cardsCorrect: result.cards_correct,
        perseverativeErrors: result.perseverative_errors,
        ruleSwitchesTotal: result.rule_switches_total,
        ruleSwitchesHandled: result.rule_switches_handled,
        avgResponseMs: result.avg_response_ms,
      },
    });
  }, [gameLanguage, userId]);

  const updateUserState = useCallback(async (result) => {
    if (result.abandoned) return userState;

    const persistedState = userId ? await loadUserState().catch((error) => {
      console.warn("Category Sort could not refresh saved progress before updating.", error);
      return null;
    }) : readLocalUserState(userId);
    const previous = persistedState ?? userState ?? getDefaultUserState(userId);
    const today = todayKey();
    const yesterday = todayKey(addDays(new Date(), -1));

    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    if (result.combined_accuracy_pct >= LEVEL_UP_ACCURACY_PCT) {
      consecutiveWins = Number(previous.consecutive_wins ?? 0) + 1;
    } else if (result.combined_accuracy_pct < LEVEL_DOWN_ACCURACY_PCT) {
      consecutiveLosses = Number(previous.consecutive_losses ?? 0) + 1;
    }

    let currentTier = Number(previous.current_tier ?? 1);
    let sessionsAtTier = Number(previous.sessions_at_tier ?? 0) + 1;

    const promotedTier = getNextCategorySortTierAfterRound(currentTier, result.combined_accuracy_pct);
    if (promotedTier > currentTier) {
      currentTier = promotedTier;
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
      current_tier: clamp(currentTier, 1, MAX_CATEGORY_SORT_TIER),
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
    if (!userId) {
      writeLocalUserState(userId, next);
      return next;
    }

    const updated = await gameData
      .table("category_sort_user_state")
      .upsert(next, { onConflict: "user_id" })
      .select("*")
      .single();

    if (updated.data) {
      setUserState(updated.data);
      return updated.data;
    }

    if (updated.error) {
      console.warn("Category Sort could not save progress state.", updated.error);
    }

    return next;
  }, [loadUserState, userId, userState]);

  const computeScore = useCallback((log, abandoned = false) => {
    const currentSequence = sequence ?? FALLBACK_SEQUENCE;
    const cardsSorted = log.length;
    const cardsCorrect = log.filter((entry) => entry.correct).length;
    const accuracyPct = cardsSorted ? (cardsCorrect / cardsSorted) * 100 : 0;
    const ruleSwitchesTotal = switchStatsRef.current.total;
    const ruleSwitchesHandled = switchStatsRef.current.handled;
    const flexibilityPct = ruleSwitchesTotal ? (ruleSwitchesHandled / ruleSwitchesTotal) * 100 : 0;
    const avgResponseMs = cardsSorted
      ? Math.round(log.reduce((sum, entry) => sum + entry.response_ms, 0) / cardsSorted)
      : null;
    const accuracyScore = (cardsCorrect / Math.max(1, cardsSorted)) * 600;
    const flexibilityScore = flexibilityPct * 4;
    const score = abandoned ? 0 : Math.round(accuracyScore + flexibilityScore);

    return {
      sequence_id: currentSequence.id,
      difficulty_tier: currentSequence.difficulty_tier,
      card_count: currentSequence.card_count ?? cards.length,
      cards_sorted: cardsSorted,
      cards_correct: cardsCorrect,
      perseverative_errors: log.filter((entry) => entry.perseverative).length,
      rule_switches_total: ruleSwitchesTotal,
      rule_switches_handled: ruleSwitchesHandled,
      accuracy_pct: Number(accuracyPct.toFixed(2)),
      flexibility_pct: Number(flexibilityPct.toFixed(2)),
      avg_response_ms: avgResponseMs,
      score: clamp(score, 0, 1000),
      combined_accuracy_pct: Number(((accuracyPct + flexibilityPct) / 2).toFixed(2)),
      completed: !abandoned && cardsSorted >= (currentSequence.card_count ?? cards.length),
      abandoned,
      duration_seconds: Math.max(1, Math.round((Date.now() - sessionStartedAtRef.current) / 1000)),
      log,
    };
  }, [cards.length, sequence]);

  const finishRound = useCallback(async (abandoned = false) => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    clearTimers();
    const result = computeScore(sessionLogRef.current, abandoned);

    if (abandoned) {
      await saveSession(result);
      return;
    }

    setIsResolving(true);
    setSessionResult(result);
    await saveSession(result);

    await updateUserState(result);
    onAssessmentPracticeComplete?.({
      score: result.score,
      accuracyPct: result.combined_accuracy_pct,
      practiceTitle: assessmentPractice?.practiceTitle,
    });
    setScreen("result");
    setIsResolving(false);
  }, [assessmentPractice, clearTimers, computeScore, onAssessmentPracticeComplete, saveSession, updateUserState]);

  const saveAbandonedIfNeeded = useCallback(async () => {
    if (sessionSavedRef.current) return;
    const shouldSave = latestRef.current.screen === "playing";
    if (!shouldSave) return;
    await finishRound(true);
  }, [finishRound]);

  useEffect(() => {
    return () => {
      void saveAbandonedIfNeeded();
    };
  }, [saveAbandonedIfNeeded]);

  const startRound = useCallback(() => {
    resetRoundState();
    sessionStartedAtRef.current = Date.now();
    cardStartTimeRef.current = Date.now();
    setScreen("playing");
  }, [resetRoundState]);

  const advanceCard = useCallback(() => {
    setCurrentCardIndex((index) => Math.min(index + 1, Math.max(0, cards.length - 1)));
    setLastFeedback(null);
    setIsResolving(false);
    cardStartTimeRef.current = Date.now();
  }, [cards.length]);

  const triggerRuleSwitch = useCallback((nextRuleIndex, oldRule) => {
    const currentSequence = sequence ?? FALLBACK_SEQUENCE;
    const nextRule = currentSequence.rules[nextRuleIndex];
    previousRuleRef.current = oldRule;
    switchStatsRef.current.total += 1;
    adaptationWindowRef.current = { remaining: 2, handled: false };
    setRuleChangeRule(nextRule);
    setShowRuleChange(true);

    addTimer(() => {
      setCurrentRuleIndex(nextRuleIndex);
      setConsecutiveCorrect(0);
      setShowRuleChange(false);
      setRuleChangeRule(null);
      advanceCard();
    }, 2000);
  }, [addTimer, advanceCard, sequence]);

  const handleCategoryTap = useCallback((value) => {
    const currentSequence = sequence ?? FALLBACK_SEQUENCE;
    const currentCard = cards[currentCardIndex];
    const currentRule = currentSequence.rules[currentRuleIndex];
    if (!currentCard || !currentRule || isResolving || showRuleChange) return;

    const responseMs = Math.max(1, Date.now() - cardStartTimeRef.current);
    const correctAnswer = getCorrectCategory(currentCard, currentRule);
    const correct = value === correctAnswer;
    const previousRule = previousRuleRef.current;
    const perseverative = Boolean(!correct && previousRule && value === getCorrectCategory(currentCard, previousRule));

    if (adaptationWindowRef.current) {
      if (correct && !adaptationWindowRef.current.handled) {
        adaptationWindowRef.current.handled = true;
        switchStatsRef.current.handled += 1;
      }
      adaptationWindowRef.current.remaining -= 1;
      if (correct || adaptationWindowRef.current.remaining <= 0) {
        adaptationWindowRef.current = null;
      }
    }

    const entry = {
      card_id: currentCard.id,
      card_label: cardLabel(currentCard, gameLanguage),
      rule: currentRule.rule,
      rule_key: getRulePhaseKey(currentRule),
      rule_label: ruleLabel(currentRule, gameLanguage),
      tapped: value,
      correct_answer: correctAnswer,
      correct,
      perseverative,
      response_ms: responseMs,
    };

    const nextLog = [...sessionLogRef.current, entry];
    sessionLogRef.current = nextLog;
    setSessionLog(nextLog);
    setLastFeedback(correct ? "correct" : "reminder");
    const nextConsecutive = correct ? consecutiveCorrect + 1 : 0;
    setConsecutiveCorrect(nextConsecutive);
    setIsResolving(true);

    const isLastCard = currentCardIndex >= cards.length - 1;
    if (isLastCard) {
      addTimer(() => {
        void finishRound(false);
      }, correct ? 450 : 750);
      return;
    }

    const switchAfter = Number(currentRule.switch_after ?? 4);
    if (correct && nextConsecutive >= switchAfter) {
      const nextRuleIndex = (currentRuleIndex + 1) % currentSequence.rules.length;
      triggerRuleSwitch(nextRuleIndex, currentRule);
      return;
    }

    addTimer(advanceCard, correct ? 450 : 800);
  }, [
    addTimer,
    advanceCard,
    cards,
    consecutiveCorrect,
    currentCardIndex,
    currentRuleIndex,
    finishRound,
    gameLanguage,
    isResolving,
    sequence,
    showRuleChange,
    triggerRuleSwitch,
  ]);

  const handleTutorialTap = useCallback((value) => {
    if (tutorialOverlay) return;
    const tutorialRules = FALLBACK_SEQUENCE.rules;
    const tutorialCards = FALLBACK_CARDS.slice(0, 8);
    const rule = tutorialRules[tutorialRuleIndex];
    const card = tutorialCards[tutorialCardIndex % tutorialCards.length];
    const correct = value === getCorrectCategory(card, rule);
    if (!correct) return;

    const nextCorrect = tutorialCorrect + 1;
    setTutorialCorrect(nextCorrect);

    if (tutorialRuleIndex === 0 && nextCorrect >= 4) {
      setTutorialOverlay(true);
      addTimer(() => {
        setTutorialRuleIndex(1);
        setTutorialCorrect(0);
        setTutorialOverlay(false);
        setTutorialCardIndex((index) => index + 1);
      }, 2000);
      return;
    }

    setTutorialCardIndex((index) => index + 1);
  }, [addTimer, tutorialCardIndex, tutorialCorrect, tutorialOverlay, tutorialRuleIndex]);

  const handleExit = useCallback(async () => {
    await saveAbandonedIfNeeded();
    onExit?.();
  }, [onExit, saveAbandonedIfNeeded]);

  const handleReplay = useCallback(() => {
    const currentTier = Number(sequence?.difficulty_tier ?? userState?.current_tier ?? 1);
    void loadGame({ ...(userState ?? getDefaultUserState(userId)), current_tier: currentTier });
  }, [loadGame, sequence?.difficulty_tier, userId, userState]);

  const handleContinue = useCallback(() => {
    void loadGame();
  }, [loadGame]);

  const currentSequence = sequence ?? FALLBACK_SEQUENCE;
  const currentCard = cards[currentCardIndex];
  const currentRule = currentSequence.rules[currentRuleIndex] ?? currentSequence.rules[0];
  const currentBand = getBrainCoachLevelBand(currentSequence.difficulty_tier ?? 1);
  const categories = getCategoriesForRule(currentRule, cards);
  const progress = cards.length ? ((currentCardIndex + 1) / cards.length) * 100 : 0;
  const RuleIcon = iconForRule(currentRule);
  const RuleChangeIcon = iconForRule(ruleChangeRule ?? currentRule);
  const result = sessionResult ?? computeScore(sessionLog, false);
  const progressToPromotion = clamp((result.combined_accuracy_pct / LEVEL_UP_ACCURACY_PCT) * 100, 0, 100);
  const resultTier = Number(userState?.current_tier ?? currentSequence.difficulty_tier ?? 1);
  const resultBand = getBrainCoachLevelBand(resultTier);
  const completedTier = Number(currentSequence.difficulty_tier ?? 1);
  const resultWasPromoted = resultTier > completedTier;
  const resultSummary = resultWasPromoted
    ? getBrainCoachSupportiveProgressCopy({ advanced: true, level: completedTier })
    : result.combined_accuracy_pct >= LEVEL_UP_ACCURACY_PCT
      ? `${text.score}: ${result.score} | ${text.accuracy}: ${Math.round(result.accuracy_pct)}%`
      : getBrainCoachSupportiveProgressCopy({ advanced: false, level: completedTier });
  const continueLabel = resultWasPromoted
    ? text.continueToLevel.replace("{level}", String(resultTier))
    : text.continueAction;
  const nextTier = clamp(resultTier + 1, 1, MAX_CATEGORY_SORT_TIER);
  const groupedResults = Object.values(result.log.reduce((groups, entry) => {
    const key = entry.rule_key;
    if (!groups[key]) groups[key] = { label: entry.rule_label, marks: [] };
    groups[key].marks.push(entry.correct ? "✓" : "·");
    return groups;
  }, {}));

  const shellStyle = {
    background: BRAND.bg,
    color: BRAND.ink,
    paddingTop: "max(8px, env(safe-area-inset-top))",
    paddingBottom: "max(8px, env(safe-area-inset-bottom))",
  };

  if (screen === "loading") {
    return (
      <BrainCoachLoadingState
        title={text.title}
        label={text.loading}
        testId="category-sort-flow-shell"
        presentationId="brain_coach.activity_session.improve_thinking.category_sort.loading.touch"
        sceneId="brain_coach.activity_session.improve_thinking.category_sort"
      />
    );
  }

  if (screen === "intro") {
    return (
      <BrainCoachActivityShell
        title={text.title}
        backLabel={text.back}
        onBack={handleExit}
        testId="category-sort-flow-shell"
        presentationId="brain_coach.activity_session.improve_thinking.category_sort.intro.touch"
        sceneId="brain_coach.activity_session.improve_thinking.category_sort"
        sceneKind="intro"
        sceneLayout="rule_preview"
      >
        <div className="pb-6" data-testid="category-sort-intro">
        <div className="mx-auto grid w-full max-w-[760px] gap-5 rounded-[28px] border border-[#EEE8F1] bg-white p-5 shadow-vyva-card sm:p-6">
          <header className="flex shrink-0 justify-center">
            <div className="flex min-h-[48px] shrink-0 items-center rounded-full bg-[#FEF3C7] px-4 text-[18px] font-bold text-[#92400E] sm:min-h-[58px] sm:px-5 sm:text-[21px]">
              {text.level} {currentSequence.difficulty_tier} - {currentBand.label}
            </div>
          </header>

          <main className="flex min-h-0 flex-col justify-start gap-4 sm:gap-5">
            <div className="text-center">
              <p className="mx-auto max-w-[34ch] text-[19px] font-bold leading-[1.3] sm:text-[23px]" style={{ color: BRAND.muted }}>{text.subtitle}</p>
              {loadNote && (
                <p className="mx-auto mt-3 inline-flex max-w-full rounded-full bg-[#FFF7ED] px-4 py-2 text-center text-[17px] font-bold leading-[1.15] text-[#9A3412] sm:text-[20px]">
                  {loadNote}
                </p>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-3 sm:gap-3" data-testid="category-sort-rule-strip">
              {currentSequence.rules.slice(0, 3).map((rule, index) => {
                const Icon = iconForRule(rule);
                return (
                  <div
                    key={`${rule.rule}-${index}`}
                    className="grid min-h-[58px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[22px] border bg-white px-3 py-2 shadow-vyva-card sm:min-h-[104px] sm:grid-cols-1 sm:items-start sm:p-4"
                    style={{ borderColor: BRAND.border }}
                    data-testid="category-sort-rule-card"
                  >
                    <Icon className="h-7 w-7 sm:h-9 sm:w-9" style={{ color: index === 1 ? BRAND.gold : BRAND.purple }} />
                    <p className="min-w-0 text-[19px] font-extrabold leading-[1.08] [overflow-wrap:anywhere] sm:mt-2 sm:text-[22px]">{ruleLabel(rule, gameLanguage)}</p>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-[16px] font-black sm:hidden" style={{ background: BRAND.softPurple, color: BRAND.purple }}>
                      {index + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </main>

          <footer className="grid shrink-0 gap-2 pb-1 sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              onClick={startRound}
              className="min-h-[62px] rounded-full px-5 text-[22px] font-bold text-white shadow-vyva-card sm:min-h-[72px] sm:px-6 sm:text-[26px]"
              style={{ background: BRAND.purple }}
            >
              {text.start}
            </button>
            <button
              type="button"
              onClick={() => setScreen("tutorial")}
              className="min-h-[58px] rounded-full border bg-white px-5 text-[21px] font-bold shadow-vyva-card sm:min-h-[72px] sm:px-6 sm:text-[26px]"
              style={{ borderColor: BRAND.border, color: BRAND.purple }}
            >
              {text.example}
            </button>
          </footer>
        </div>
        </div>
      </BrainCoachActivityShell>
    );
  }

  if (screen === "tutorial") {
    const tutorialRules = FALLBACK_SEQUENCE.rules;
    const tutorialCards = FALLBACK_CARDS.slice(0, 8);
    const tutorialRule = tutorialRules[tutorialRuleIndex];
    const tutorialCard = tutorialCards[tutorialCardIndex % tutorialCards.length];
    const tutorialCategories = getCategoriesForRule(tutorialRule, tutorialCards);
    const TutorialRuleIcon = iconForRule(tutorialRule);

    return (
      <BrainCoachActivityShell
        title={text.title}
        backLabel={text.back}
        onBack={handleExit}
        testId="category-sort-flow-shell"
        presentationId="brain_coach.activity_session.improve_thinking.category_sort.tutorial.touch"
        sceneId="brain_coach.activity_session.improve_thinking.category_sort"
        sceneKind="tutorial"
        sceneLayout="rule_example"
      >
        <div className="relative pb-6">
        {tutorialOverlay && (
          <div className="absolute inset-0 z-30 flex items-center justify-center px-6 text-center" style={{ background: BRAND.gold }}>
            <div>
              <Shapes className="mx-auto h-20 w-20 text-white" />
              <p className="mt-6 text-[38px] font-black leading-[1.08] text-white">
                {text.newRule}: {ruleLabel(tutorialRules[1], gameLanguage)}
              </p>
            </div>
          </div>
        )}

        <div className="mx-auto flex h-full w-full max-w-[820px] flex-col">
          <header className="flex min-h-[52px] shrink-0 items-center gap-3 border-b-2" style={{ borderColor: BRAND.border }}>
            <h1 className="min-w-0 text-[22px] font-bold leading-[1.1] sm:text-[26px]">{text.tutorialTitle}</h1>
          </header>

          <main className="flex min-h-0 flex-1 flex-col justify-center gap-2 py-2">
            <div className="rounded-[22px] border px-3 py-2 text-center shadow-vyva-card" style={{ borderColor: BRAND.border, background: BRAND.gold }}>
              <p className="inline-flex items-center gap-3 text-[22px] font-black leading-[1.1] text-white sm:text-[24px]">
                <TutorialRuleIcon size={30} />
                {text.sortBy}: {ruleLabel(tutorialRule, gameLanguage)}
              </p>
            </div>

            <div className="mx-auto flex h-[clamp(116px,22dvh,176px)] min-h-0 w-full max-w-[380px] items-center justify-center rounded-[24px] border bg-white p-3 shadow-vyva-card" style={{ borderColor: BRAND.border }}>
              <CardFace card={tutorialCard} language={gameLanguage} showLabel={false} compact />
            </div>

            <p className="text-center text-[20px] font-bold leading-[1.15] sm:text-[22px]" style={{ color: BRAND.muted }}>
              {tutorialRuleIndex === 0 ? text.tutorialColorHint : text.tutorialShapeHint}
            </p>

            <div className="grid shrink-0 grid-cols-2 gap-2 sm:gap-3">
              {tutorialCategories.map((category) => (
                <CategoryButton
                  key={category.value}
                  category={category}
                  rule={tutorialRule}
                  onClick={handleTutorialTap}
                  disabled={tutorialOverlay}
                  compact
                />
              ))}
            </div>
          </main>

          <button
            type="button"
            onClick={startRound}
            className="min-h-[56px] w-full shrink-0 rounded-full px-8 text-[23px] font-bold text-white shadow-vyva-card sm:text-[25px]"
            style={{ background: BRAND.purple }}
          >
            {text.start}
          </button>
        </div>
        </div>
      </BrainCoachActivityShell>
    );
  }

  if (screen === "playing") {
    const showSemanticLabel = Number(currentSequence.difficulty_tier ?? 1) >= 6;

    return (
      <BrainCoachActivityShell
        title={text.title}
        backLabel={text.exit}
        onBack={handleExit}
        testId="category-sort-flow-shell"
        presentationId="brain_coach.activity_session.improve_thinking.category_sort.playing.touch"
        sceneId="brain_coach.activity_session.improve_thinking.category_sort"
        sceneKind="playing"
        sceneLayout="sorting_board"
      >
        <div className="relative pb-6">
        {showRuleChange && ruleChangeRule && (
          <div className="absolute inset-0 z-40 flex items-center justify-center px-6 text-center" style={{ background: BRAND.gold }}>
            <div>
              <RuleChangeIcon className="mx-auto h-20 w-20 text-white" />
              <p className="mt-6 text-[38px] font-black leading-[1.08] text-white">
                {text.newRule}: {ruleLabel(ruleChangeRule, gameLanguage)}
              </p>
            </div>
          </div>
        )}

        <div className="mx-auto flex h-full w-full max-w-[820px] flex-col gap-2">
          <header className="shrink-0">
            <div className="h-2 overflow-hidden rounded-full bg-[#EDE6F4]">
              <div className="h-full transition-[width] duration-300" style={{ width: `${progress}%`, background: BRAND.purple }} />
            </div>
            <p className="mt-1 text-center text-[18px] font-bold sm:text-[20px]" style={{ color: BRAND.muted }}>
              {text.card} {Math.min(currentCardIndex + 1, cards.length)} {text.of} {cards.length}
            </p>
          </header>

          <main className="flex min-h-0 flex-1 flex-col gap-2">
            <section className="rounded-[22px] border px-4 py-3 text-center shadow-vyva-card" style={{ borderColor: "#D97706", background: BRAND.gold }}>
              <p className="inline-flex items-center justify-center gap-3 text-[22px] font-black leading-[1.1] text-white sm:text-[24px]">
                <RuleIcon size={30} />
                {text.sortBy}: {ruleLabel(currentRule, gameLanguage)}
              </p>
            </section>

            <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
              <div className="flex h-[clamp(116px,22dvh,178px)] min-h-0 w-full max-w-[400px] items-center justify-center rounded-[24px] border bg-white p-3 shadow-vyva-card" style={{ borderColor: BRAND.border }}>
                <CardFace card={currentCard} language={gameLanguage} showLabel={showSemanticLabel} compact />
              </div>

              <div className="flex min-h-[clamp(26px,4dvh,42px)] items-center justify-center text-center">
                {lastFeedback === "correct" && (
                  <p className="inline-flex items-center gap-2 text-[22px] font-black text-[#15803D] sm:text-[24px]">
                    <Check size={30} />
                    {text.correct}
                  </p>
                )}
                {lastFeedback === "reminder" && (
                  <p className="text-[21px] font-black text-[#9A3412] sm:text-[23px]">{text.reminder}</p>
                )}
              </div>
            </section>

            <section className="grid shrink-0 grid-cols-2 gap-2 pb-1 sm:gap-3">
              {categories.map((category) => (
                <CategoryButton
                  key={category.value}
                  category={category}
                  rule={currentRule}
                  onClick={handleCategoryTap}
                  disabled={isResolving || showRuleChange}
                  compact
                />
              ))}
            </section>
          </main>

          <footer className="shrink-0 text-center text-[18px] font-bold sm:text-[20px]" style={{ color: BRAND.muted }}>
            {text.streak}: {consecutiveCorrect}
          </footer>
        </div>
        </div>
      </BrainCoachActivityShell>
    );
  }

  return (
    <BrainCoachActivityShell
      title={text.title}
      backLabel={text.exit}
      onBack={handleExit}
      showHeader={false}
      testId="category-sort-flow-shell"
      presentationId="brain_coach.activity_session.improve_thinking.category_sort.result.touch"
      sceneId="brain_coach.activity_session.improve_thinking.category_sort"
      sceneKind="completion"
      sceneLayout="modal_actions"
      state="complete"
    >
      <div className="min-h-[100dvh]" style={shellStyle}>
        <BrainGameCompletionDialog
          title={result.score >= 600 ? text.resultGreat : text.resultGood}
          summary={resultSummary}
          metrics={[
            { label: text.accuracy, value: `${Math.round(result.accuracy_pct)}%` },
            { label: text.flexibility, value: `${Math.round(result.flexibility_pct)}%` },
            { label: text.score, value: String(result.score) },
            { label: text.streak, value: `${userState?.streak_days ?? 1} ${text.days}` },
          ]}
          continueLabel={continueLabel}
          replayLabel={text.playAgain}
          anotherLabel={text.playAnotherGame}
          assessmentReturnLabel={assessmentPractice ? t("brainGames.resultActions.backToResults", "Back to my results") : undefined}
          assessmentReturnHint={
            assessmentPractice
              ? t("brainGames.resultActions.assessmentPracticeComplete", "Good. You practiced the area VYVA noticed.")
              : undefined
          }
          onContinue={handleContinue}
          onReplay={handleReplay}
          onAnother={handleExit}
          onAssessmentReturn={assessmentPractice ? onAssessmentPracticeReturn : undefined}
          details={
            <div className="grid gap-3">
              <div className="rounded-[18px] border border-[#EADFF8] bg-[#FFF9F1] px-4 py-3">
                <p className="text-[14px] font-black uppercase text-vyva-text-2">{text.ruleBreakdown}</p>
                <div className="mt-2 grid gap-2">
                  {groupedResults.length ? groupedResults.map((group) => (
                    <div key={group.label} className="flex items-center justify-between gap-3 rounded-[14px] bg-white px-3 py-2">
                      <span className="text-[15px] font-bold text-vyva-text-2">{group.label}</span>
                      <span className="text-[18px] font-black tracking-[0.08em] text-vyva-purple">{group.marks.join(" ")}</span>
                    </div>
                  )) : (
                    <p className="text-[15px] font-bold text-vyva-text-2">-</p>
                  )}
                </div>
              </div>
              <div className="rounded-[18px] border border-[#EADFF8] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-[15px] font-black text-vyva-text-1">
                  <span>{text.progressNext} {nextTier}</span>
                  <span>{Math.round(progressToPromotion)}%</span>
                </div>
                <p className="mt-1 text-[14px] font-bold text-vyva-text-2">
                  {text.level} {resultTier} - {resultBand.label}
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

function CardFace({ card, language, showLabel, compact = false }) {
  if (!card) return null;
  const size = compact
    ? card.size === "small" ? 58 : card.size === "medium" ? 76 : 94
    : card.size === "small" ? 88 : card.size === "medium" ? 116 : 142;

  return (
    <div className={`relative flex flex-col items-center justify-center ${compact ? "min-h-[104px] min-w-[104px]" : "min-h-[160px] min-w-[160px]"}`}>
      <ShapeGlyph shape={card.shape} color={card.color} size={size} />
      <div className={`absolute inset-0 flex items-center justify-center leading-none drop-shadow-sm ${compact ? "text-[36px]" : "text-[52px]"}`} aria-hidden="true">
        {card.icon}
      </div>
      {showLabel && (
        <p className={`${compact ? "mt-1 text-[18px]" : "mt-2 text-[22px]"} max-w-[14ch] text-center font-black leading-[1.05]`} style={{ color: BRAND.ink }}>
          {cardLabel(card, language)}
        </p>
      )}
    </div>
  );
}

function CategoryButton({ category, rule, onClick, disabled, compact = false }) {
  return (
    <button
      type="button"
      onClick={() => onClick(category.value)}
      disabled={disabled}
      className={`flex w-full items-center rounded-[20px] border bg-white text-left font-black leading-[1.08] shadow-vyva-card transition-transform active:scale-[0.99] disabled:opacity-70 ${compact ? "gap-3 px-3 py-2 text-[20px] sm:px-4 sm:text-[22px]" : "min-h-[72px] gap-4 px-5 py-3 text-[24px]"}`}
      style={{
        borderColor: BRAND.border,
        color: BRAND.ink,
        minHeight: compact ? "clamp(52px, 8dvh, 68px)" : undefined,
      }}
    >
      <CategoryMarker category={category} rule={rule} compact={compact} />
      <span className="min-w-0 [overflow-wrap:anywhere]">{category.label}</span>
    </button>
  );
}

function Metric({ label, value, hint, accent = false }) {
  return (
    <div className="min-h-[116px] rounded-[20px] bg-[#FFF9F1] p-3">
      <p className="flex items-center justify-center gap-2 text-[22px] font-bold leading-[1.1]" style={{ color: BRAND.muted }}>
        {label}
        {hint && <CircleHelp size={22} aria-label={hint} title={hint} />}
      </p>
      <p className="mt-2 text-[40px] font-black leading-none" style={{ color: accent ? BRAND.gold : BRAND.purple }}>
        {value}
      </p>
    </div>
  );
}

// TODO: Blind rule switching (WCST pure mode) for an optional expert path.
// TODO: 4-category semantic rules for upper tiers.
// TODO: Caregiver dashboard data from perseverative error trends.
// TODO: VYVA voice integration for rule-change announcements.
// TODO: Timed pressure mode using avg_response_ms.
