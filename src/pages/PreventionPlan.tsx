import { useQuery } from "@tanstack/react-query";
import {
  Apple,
  ArrowLeft,
  Brain,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Footprints,
  HeartPulse,
  PlayCircle,
  Sparkles,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VyvaIcon, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalProfile } from "@/contexts/ProfileContext";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";

export type PreventionPillar = "heart" | "brain" | "strength" | "nourishment" | "calm";
export type PreventionPillarStatus = "thriving" | "steady" | "needs_attention" | "priority_focus";
export type PreventionRecommendation = { action: string; why: string };
const LONGEVITY_MOMENTS = ["morning", "midday", "afternoon", "evening"] as const;
export type LongevityMoment = typeof LONGEVITY_MOMENTS[number];
type LongevityMomentStatus = "past" | "now" | "later";

export type PreventionPlanData = {
  id: string | null;
  generated_at: string | null;
  pillar_heart: PreventionPillarStatus;
  pillar_brain: PreventionPillarStatus;
  pillar_strength: PreventionPillarStatus;
  pillar_nourishment: PreventionPillarStatus;
  pillar_calm: PreventionPillarStatus;
  priority_pillar: PreventionPillar | null;
  priority_intervention: string | null;
  priority_why: string | null;
  plan_narrative_senior: string | null;
  plan_narrative_caregiver: string | null;
  recommendations: Partial<Record<PreventionPillar, PreventionRecommendation[]>>;
  source_signals: Record<string, boolean>;
  trajectory: "improving" | "stable" | "declining" | "first";
};

type DailyContentType = "exercise" | "meal" | "tip" | "article" | "supplement" | "natural_solution";
type DailyContentItem = {
  id: string;
  content_type: DailyContentType;
  title: string;
  description: string;
  detail_text: string | null;
  timing_guidance?: string | null;
  resource_title?: string | null;
  duration_seconds?: number | null;
  safety_notes?: string | null;
  source_label: string | null;
  source_url: string | null;
  condition_tags: string[];
  pillar_tag: PreventionPillar | null;
  time_of_day: string | null;
  language: string;
};

type DailyContentResponse = {
  exercise: DailyContentItem | null;
  meal: DailyContentItem | null;
  tip: DailyContentItem | null;
  supplement?: DailyContentItem | null;
  naturalSolution?: DailyContentItem | null;
  articles: DailyContentItem[];
  byPillar?: Partial<Record<PreventionPillar, DailyContentItem[]>>;
};

type PillarStatusResponse = {
  statuses: Partial<Record<PreventionPillar, PreventionPillarStatus>>;
  priority_pillar: PreventionPillar | null;
};

type CompanionSignal = {
  id: string;
  label: string;
  detail: string;
  source: "profile" | "medication" | "brain" | "check-in" | "symptom" | "vitals" | "feedback";
  pillar: PreventionPillar | null;
  tone: "steady" | "attention" | "positive";
};

type BrainChallenge = {
  kind: "memory_prompt" | "word_chain" | "riddle" | "chess_puzzle" | "crossword";
  prompt: string;
  hint: string;
  answer: string | null;
  followUp: string;
};

type BrainGameOption = BrainChallenge & {
  id: string;
  label: string;
  title: string;
};

type CompanionAction = {
  action_key: string;
  content_id?: string | null;
  content_type?: DailyContentType | null;
  timing_guidance?: string | null;
  title: string;
  detail: string;
  pillar: PreventionPillar | null;
  route: string | null;
  resource_label?: string | null;
  resource_url?: string | null;
  resource_title?: string | null;
  duration_seconds?: number | null;
  safety_notes?: string | null;
  prompt: string;
  source: "monthly_plan" | "daily_content" | "feedback_memory" | "fallback" | "program";
  challenge?: BrainChallenge | null;
  gameOptions?: BrainGameOption[] | null;
};

type DailyExperienceKind = "video" | "brain_game" | "movement" | "walking_route" | "food" | "calm" | "support";

type PrimaryExperience = {
  kind: DailyExperienceKind;
  title: string;
  detail: string;
  pillar: PreventionPillar | null;
  ctaLabel: string;
  action: CompanionAction;
  video: TodayVideo | null;
};

type CoveredPillar = {
  pillar: PreventionPillar;
  label: string;
  status: PreventionPillarStatus;
  actionTitle: string;
  reason: string;
  evidence: string;
};

type DailySession = {
  moment?: LongevityMoment;
  label?: string;
  sessionFocus: string;
  primaryExperience: PrimaryExperience;
  companionAction: CompanionAction;
  optionalChoices: CompanionAction[];
  coveredPillars: CoveredPillar[];
  whyThis: {
    summary: string;
    evidence: string[];
  };
};

type MomentSession = DailySession & {
  moment: LongevityMoment;
  label: string;
  status: LongevityMomentStatus;
  startsAt: string;
};

type TimelineItem = {
  moment: LongevityMoment;
  label: string;
  status: LongevityMomentStatus;
  startsAt: string;
  title: string;
  reason: string;
  pillar: PreventionPillar | null;
  kind: DailyExperienceKind;
};

type VideoCurationStatus = "ready" | "pending" | "fallback" | "failed";
type VideoTranscriptStatus = "pending" | "available" | "unavailable" | "manual_reviewed";

type ActiveProgram = {
  id: string;
  programKey: string;
  title: string;
  status: "active" | "paused" | "completed";
  focusPillars: PreventionPillar[];
  startDate: string;
  currentDay: number;
  totalDays: number;
  language: string;
  cadence: string;
};

type ProgramStep = {
  id: string;
  programId: string;
  dayIndex: number;
  pillar: PreventionPillar;
  theme: string;
  objective: string;
  actionTitle: string;
  actionDetail: string;
  videoQuery: string;
  scheduledDate: string;
  status: "scheduled" | "shown" | "completed" | "skipped";
};

type TodayVideo = {
  id: string;
  provider: "youtube";
  pillar?: PreventionPillar | null;
  videoId: string;
  url: string;
  title: string;
  channel: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  language: string;
  summary: string | null;
  selectedReason: string;
  safetyNotes: string;
  transcriptStatus?: VideoTranscriptStatus | null;
  keyPoints?: string[] | null;
  seniorTakeaway?: string | null;
  transcriptSummary?: string | null;
  afterWatchAction?: string | null;
  goodFor?: string[] | null;
  notFor?: string[] | null;
  momentFit?: LongevityMoment[] | null;
};

type VideoInsight = {
  transcriptStatus: VideoTranscriptStatus;
  keyPoints: string[];
  seniorTakeaway: string;
  transcriptSummary?: string;
  afterWatchAction?: string;
  goodFor?: string[];
  notFor?: string[];
  momentFit?: LongevityMoment[];
};

type FeedbackEventType = "done" | "too_hard" | "not_relevant" | "opened" | "saved";
type VideoFeedbackReason = "too_boring" | "too_hard" | "wrong_topic" | "wrong_language" | "watched_already";

const VIDEO_FEEDBACK_REASONS: VideoFeedbackReason[] = ["too_boring", "too_hard", "wrong_topic", "wrong_language", "watched_already"];
const FEEDBACK_REASON_EVENT_TYPE: Record<VideoFeedbackReason, FeedbackEventType> = {
  too_boring: "not_relevant",
  too_hard: "too_hard",
  wrong_topic: "not_relevant",
  wrong_language: "not_relevant",
  watched_already: "done",
};

type CompanionPayload = {
  plan: PreventionPlanData;
  activeProgram: ActiveProgram | null;
  todayProgramStep: ProgramStep | null;
  todayVideo: TodayVideo | null;
  videoCurationStatus: VideoCurationStatus;
  todayFocus: {
    pillar: PreventionPillar | null;
    label: string;
    headline: string;
    summary: string;
  };
  activeMoment?: LongevityMoment;
  todayTimeline?: TimelineItem[];
  currentMomentSession?: MomentSession | null;
  nextMomentPreview?: TimelineItem | null;
  whyToday: string;
  dailySession?: DailySession | null;
  primaryAction: CompanionAction;
  supportAction: CompanionAction;
  pillarActions?: Partial<Record<PreventionPillar, CompanionAction>>;
  careSummary: {
    title: string;
    bullets: string[];
    share_text: string;
  };
  signalsUsed: CompanionSignal[];
  dailyContent: DailyContentResponse;
  feedbackHistory: Array<{
    action_key: string;
    action_title: string;
    event_type: "shown" | "opened" | "done" | "too_hard" | "not_relevant";
    created_at: string;
  }>;
};

type PreventionPlanProps = {
  previewPlan?: PreventionPlanData;
  firstNameOverride?: string;
  backPath?: string;
  themeOverride?: "light" | "dark";
  languageOverride?: string;
  momentOverride?: LongevityMoment;
};

type PillarDefinition = {
  id: PreventionPillar;
  icon: LucideIcon;
  accent: VyvaIconAccent;
  label: string;
  shortLabel: string;
};

const PILLARS: PillarDefinition[] = [
  { id: "heart", icon: HeartPulse, accent: "pulse", label: "Heart & circulation", shortLabel: "Heart" },
  { id: "brain", icon: Brain, accent: "bridge", label: "Brain & memory", shortLabel: "Brain" },
  { id: "strength", icon: Footprints, accent: "step", label: "Strength & stability", shortLabel: "Strength" },
  { id: "nourishment", icon: Apple, accent: "check", label: "Nourishment", shortLabel: "Nourishment" },
  { id: "calm", icon: Waves, accent: "spark", label: "Calm & recovery", shortLabel: "Calm" },
];

function nextPillarId(current: PreventionPillar | null | undefined): PreventionPillar {
  const currentIndex = PILLARS.findIndex((pillar) => pillar.id === current);
  return PILLARS[(currentIndex + 1 + PILLARS.length) % PILLARS.length]?.id ?? "brain";
}

const STATUS: Record<PreventionPillarStatus, { label: string; tone: "success" | "steady" | "warning" }> = {
  thriving: { label: "Thriving", tone: "success" },
  steady: { label: "Steady", tone: "steady" },
  needs_attention: { label: "Needs attention", tone: "warning" },
  priority_focus: { label: "This month", tone: "warning" },
};

type PillarExperiencePreview = {
  label: string;
  title: string;
  detail: string;
  chips: string[];
};

const PILLAR_EXPERIENCE_PREVIEWS: Record<PreventionPillar, PillarExperiencePreview> = {
  heart: {
    label: "VYVA movement",
    title: "Guided heart movement",
    detail: "A gentle exercise selected for rhythm, circulation, and confidence.",
    chips: ["Steady pace", "Balance"],
  },
  brain: {
    label: "Brain Coach",
    title: "Short brain game",
    detail: "A small memory, word, riddle, or chess prompt with a clear finish.",
    chips: ["Engaging", "Short"],
  },
  strength: {
    label: "Route planner",
    title: "Safe route setup",
    detail: "Plan the walk around mobility, weather, daylight, and places to rest.",
    chips: ["Mobility", "Weather"],
  },
  nourishment: {
    label: "Food support",
    title: "Simple meal cue",
    detail: "One practical food choice for the next meal, shaped by the day.",
    chips: ["Next meal", "Simple"],
  },
  calm: {
    label: "Breath Garden",
    title: "Short reset",
    detail: "A quiet guided pause to help the day land more softly.",
    chips: ["2 min", "Wind-down"],
  },
};

const LONGEVITY_MOMENT_DETAILS: Record<LongevityMoment, { label: string; startsAt: string; startHour: number }> = {
  morning: { label: "Morning", startsAt: "05:00", startHour: 5 },
  midday: { label: "Midday", startsAt: "11:00", startHour: 11 },
  afternoon: { label: "Afternoon", startsAt: "14:00", startHour: 14 },
  evening: { label: "Evening", startsAt: "18:00", startHour: 18 },
};

const PREVIEW_MOMENT_PILLARS: Record<LongevityMoment, PreventionPillar> = {
  morning: "nourishment",
  midday: "heart",
  afternoon: "brain",
  evening: "calm",
};

const PREVIEW_MOMENT_COPY: Record<LongevityMoment, { focus: string; evidence: string }> = {
  morning: {
    focus: "start with one simple food cue today",
    evidence: "Morning is the right time for breakfast, hydration, and a lighter start.",
  },
  midday: {
    focus: "make movement feel doable before the day gets heavy",
    evidence: "Midday fits a short heart-supporting movement cue before afternoon fatigue builds.",
  },
  afternoon: {
    focus: "keep memory active with one short challenge today",
    evidence: "Afternoon is a practical window for a brain game, social cue, or short video.",
  },
  evening: {
    focus: "let the day land with one calmer reset",
    evidence: "Evening is better for wind-down, reflection, and tomorrow setup than another big task.",
  },
};

const PREVIEW_MOMENT_COPY_BY_LANGUAGE: Record<string, Record<LongevityMoment, { focus: string; evidence: string }>> = {
  en: PREVIEW_MOMENT_COPY,
  es: {
    morning: {
      focus: "empieza con una idea sencilla para la comida",
      evidence: "La mañana encaja con desayuno, hidratación y un comienzo ligero.",
    },
    midday: {
      focus: "haz que moverte sea fácil antes de que pese el día",
      evidence: "El mediodía encaja con una comida sencilla, hidratación y una rutina amable.",
    },
    afternoon: {
      focus: "mantén activa la memoria con un reto breve",
      evidence: "La tarde es un buen momento para un juego mental, conexión social o un video corto.",
    },
    evening: {
      focus: "cierra el día con una pausa más tranquila",
      evidence: "La noche encaja mejor con bajar el ritmo, reflexionar y preparar mañana.",
    },
  },
  fr: {
    morning: {
      focus: "commencez par un repère simple pour le repas",
      evidence: "Le matin convient au petit-déjeuner, à l'hydratation et à un départ léger.",
    },
    midday: {
      focus: "gardez le mouvement facile avant que la journée ne pèse",
      evidence: "Le midi convient au repas, à l'hydratation et à une routine simple.",
    },
    afternoon: {
      focus: "gardez la mémoire active avec un court défi",
      evidence: "L'après-midi convient à un jeu cognitif, un lien social ou une courte vidéo.",
    },
    evening: {
      focus: "terminez la journée avec une pause plus calme",
      evidence: "Le soir convient mieux au ralentissement, à la réflexion et à la préparation de demain.",
    },
  },
  de: {
    morning: {
      focus: "beginnen Sie mit einem einfachen Essensimpuls",
      evidence: "Der Morgen passt zu Frühstück, Flüssigkeit und einem leichten Start.",
    },
    midday: {
      focus: "machen Sie Bewegung leicht, bevor der Tag schwerer wird",
      evidence: "Der Mittag passt zu Essen, Flüssigkeit und einer freundlichen Routine.",
    },
    afternoon: {
      focus: "halten Sie das Gedächtnis mit einer kurzen Aufgabe aktiv",
      evidence: "Der Nachmittag passt zu Denkspielen, sozialem Kontakt oder einem kurzen Video.",
    },
    evening: {
      focus: "lassen Sie den Tag mit einer ruhigeren Pause ausklingen",
      evidence: "Der Abend passt besser zu Ruhe, Reflexion und Vorbereitung auf morgen.",
    },
  },
  it: {
    morning: {
      focus: "inizia con un semplice spunto per il pasto",
      evidence: "La mattina è adatta a colazione, idratazione e un inizio leggero.",
    },
    midday: {
      focus: "rendi il movimento facile prima che la giornata pesi",
      evidence: "Il mezzogiorno è adatto a pasti, idratazione e una routine delicata.",
    },
    afternoon: {
      focus: "mantieni attiva la memoria con una breve sfida",
      evidence: "Il pomeriggio è adatto a giochi mentali, contatto sociale o un breve video.",
    },
    evening: {
      focus: "chiudi la giornata con una pausa più calma",
      evidence: "La sera è più adatta a rallentare, riflettere e preparare domani.",
    },
  },
  pt: {
    morning: {
      focus: "comece com uma ideia simples para a refeição",
      evidence: "A manhã combina com café da manhã, hidratação e um começo leve.",
    },
    midday: {
      focus: "deixe o movimento fácil antes que o dia pese",
      evidence: "O meio-dia combina com refeição, hidratação e uma rotina leve.",
    },
    afternoon: {
      focus: "mantenha a memória ativa com um desafio breve",
      evidence: "A tarde combina com jogo mental, conexão social ou um vídeo curto.",
    },
    evening: {
      focus: "encerre o dia com uma pausa mais calma",
      evidence: "A noite combina melhor com desacelerar, refletir e preparar o amanhã.",
    },
  },
};

function previewMomentCopyForLanguage(language: string | null | undefined): Record<LongevityMoment, { focus: string; evidence: string }> {
  const code = copyLanguageCode(language);
  return PREVIEW_MOMENT_COPY_BY_LANGUAGE[code] ?? PREVIEW_MOMENT_COPY;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function isLongevityMoment(value: unknown): value is LongevityMoment {
  return typeof value === "string" && LONGEVITY_MOMENTS.includes(value as LongevityMoment);
}

type LongevityCopy = {
  title: string;
  backLabel: string;
  loadingLabel: string;
  errorTitle: string;
  errorMessage: string;
  errorButton: string;
  now: string;
  whyThis: string;
  fromVideo: string;
  vyvaConsidered: string;
  defaultWhy: string;
  currentTheme: string;
  programDay: string;
  momentEvidence: Record<LongevityMoment, string>;
  voiceContextReady: string;
  close: string;
  askVyva: string;
  watch: string;
  videoPrefix: string;
  resourcePrefix: string;
  fitPrefix: string;
  comfortPrefix: string;
  durationMinute: string;
  durationSecond: string;
  moments: Record<LongevityMoment, string>;
  pillarLabels: Record<PreventionPillar, string>;
  pillarShortLabels: Record<PreventionPillar, string>;
  pillarSelectorLabels: Record<PreventionPillar, string>;
  experienceLabels: Record<DailyExperienceKind, string>;
  ctaLabels: Record<DailyExperienceKind, string>;
  contentTypes: Record<DailyContentType, string>;
  experiencePreviews: Record<PreventionPillar, PillarExperiencePreview>;
  activityCtaLabels: Partial<Record<PreventionPillar, string>>;
  choosePillarLabel: string;
  showPillarLabel: (pillarLabel: string) => string;
  selectedPillarWhy: (pillarLabel: string, momentLabel: string, experienceLabel: string, detail: string) => string;
  notForMe: string;
  afterWatching: string;
  tryThisNow: string;
  saveForLater: string;
  makeEasier: string;
  feedbackQuestion: string;
  feedbackThanks: string;
  savedForLater: string;
  openingSupport: string;
  makingEasier: string;
  feedbackReasons: Record<VideoFeedbackReason, string>;
  makeEasierPrompt: (title: string, detail: string) => string;
};

const LONGEVITY_COPY: Record<string, LongevityCopy> = {
  en: {
    title: "Longevity",
    backLabel: "Return to My Health",
    loadingLabel: "Loading longevity plan",
    errorTitle: "Your longevity plan",
    errorMessage: "We could not load your plan just now. Please try again shortly.",
    errorButton: "Return to My Health",
    now: "Now",
    whyThis: "Why this?",
    fromVideo: "From the video",
    vyvaConsidered: "VYVA considered",
    defaultWhy: "This first plan uses general-wellness guidance while VYVA learns what matters to you.",
    currentTheme: "Current theme",
    programDay: "Program day",
    momentEvidence: {
      morning: "Morning is the right time for breakfast, hydration, and a lighter start.",
      midday: "Midday fits food, hydration, and a medication-friendly routine.",
      afternoon: "Afternoon is a practical window for movement, brain games, or social connection.",
      evening: "Evening is better for wind-down, reflection, and tomorrow setup.",
    },
    voiceContextReady: "Voice context ready",
    close: "Close",
    askVyva: "Ask VYVA",
    watch: "Watch",
    videoPrefix: "Video",
    resourcePrefix: "Resource",
    fitPrefix: "Fit",
    comfortPrefix: "Comfort note",
    durationMinute: "min",
    durationSecond: "sec",
    moments: {
      morning: "Morning",
      midday: "Midday",
      afternoon: "Afternoon",
      evening: "Evening",
    },
    pillarLabels: {
      heart: "Heart & circulation",
      brain: "Brain & memory",
      strength: "Strength & stability",
      nourishment: "Nourishment",
      calm: "Calm & recovery",
    },
    pillarShortLabels: {
      heart: "Heart",
      brain: "Brain",
      strength: "Strength",
      nourishment: "Nourishment",
      calm: "Calm",
    },
    pillarSelectorLabels: {
      heart: "Heart",
      brain: "Brain",
      strength: "Move",
      nourishment: "Food",
      calm: "Calm",
    },
    experienceLabels: {
      video: "Curated video",
      brain_game: "Brain game",
      movement: "Movement",
      walking_route: "Route",
      food: "Food",
      calm: "Calm",
      support: "Today",
    },
    ctaLabels: {
      video: "Watch",
      brain_game: "Play",
      movement: "Start exercise",
      walking_route: "Plan route",
      food: "Make it easy",
      calm: "Start reset",
      support: "Start",
    },
    contentTypes: {
      exercise: "Exercise",
      meal: "Food",
      tip: "Tip",
      article: "Read",
      supplement: "Supplement",
      natural_solution: "Natural support",
    },
    experiencePreviews: PILLAR_EXPERIENCE_PREVIEWS,
    activityCtaLabels: {
      heart: "Start VYVA movement",
      brain: "Play VYVA brain games",
      strength: "Start stability exercise",
      calm: "Open Breath Garden",
    },
    choosePillarLabel: "Choose a longevity pillar",
    showPillarLabel: (pillarLabel) => `Show ${pillarLabel}`,
    selectedPillarWhy: (pillarLabel, momentLabel, experienceLabel, detail) =>
      `${pillarLabel} is selected for this ${momentLabel.toLowerCase()} because it gives VYVA one practical ${experienceLabel.toLowerCase()} step: ${detail}`,
    notForMe: "Not for me",
    afterWatching: "After watching",
    tryThisNow: "Try this now",
    saveForLater: "Save for later",
    makeEasier: "Make easier",
    feedbackQuestion: "What did not fit?",
    feedbackThanks: "Got it. VYVA will adjust the next suggestion.",
    savedForLater: "Saved for later.",
    openingSupport: "Opening the next step.",
    makingEasier: "VYVA will help make this easier.",
    feedbackReasons: {
      too_boring: "Too boring",
      too_hard: "Too hard",
      wrong_topic: "Wrong topic",
      wrong_language: "Wrong language",
      watched_already: "Watched already",
    },
    makeEasierPrompt: (title, detail) =>
      `Make today's Longevity activity easier: ${title}. Keep it practical and gentle. Context: ${detail}`,
  },
  es: {
    title: "Longevidad",
    backLabel: "Volver a Mi salud",
    loadingLabel: "Cargando plan de longevidad",
    errorTitle: "Tu plan de longevidad",
    errorMessage: "No pudimos cargar tu plan ahora. Inténtalo de nuevo en un momento.",
    errorButton: "Volver a Mi salud",
    now: "Ahora",
    whyThis: "¿Por qué esto?",
    fromVideo: "Del video",
    vyvaConsidered: "VYVA tuvo en cuenta",
    defaultWhy: "Este primer plan usa orientación general de bienestar mientras VYVA aprende qué es importante para ti.",
    currentTheme: "Tema actual",
    programDay: "Día del programa",
    momentEvidence: {
      morning: "La mañana encaja con desayuno, hidratación y un comienzo sencillo.",
      midday: "El mediodía es práctico para comida, hidratación y una rutina amable.",
      afternoon: "La tarde encaja con movimiento ligero, juego mental o conexión social.",
      evening: "La noche es mejor para bajar el ritmo, reflexionar y preparar mañana.",
    },
    voiceContextReady: "Contexto de voz listo",
    close: "Cerrar",
    askVyva: "Preguntar a VYVA",
    watch: "Ver",
    videoPrefix: "Video",
    resourcePrefix: "Recurso",
    fitPrefix: "Encaja por",
    comfortPrefix: "Nota de comodidad",
    durationMinute: "min",
    durationSecond: "s",
    moments: {
      morning: "Mañana",
      midday: "Mediodía",
      afternoon: "Tarde",
      evening: "Noche",
    },
    pillarLabels: {
      heart: "Corazón y circulación",
      brain: "Cerebro y memoria",
      strength: "Fuerza y estabilidad",
      nourishment: "Nutrición",
      calm: "Calma y descanso",
    },
    pillarShortLabels: {
      heart: "Corazón",
      brain: "Cerebro",
      strength: "Fuerza",
      nourishment: "Nutrición",
      calm: "Calma",
    },
    pillarSelectorLabels: {
      heart: "Corazón",
      brain: "Cerebro",
      strength: "Mover",
      nourishment: "Comida",
      calm: "Calma",
    },
    experienceLabels: {
      video: "Video curado",
      brain_game: "Juego mental",
      movement: "Movimiento",
      walking_route: "Ruta",
      food: "Comida",
      calm: "Calma",
      support: "Hoy",
    },
    ctaLabels: {
      video: "Ver",
      brain_game: "Jugar",
      movement: "Empezar ejercicio",
      walking_route: "Planificar ruta",
      food: "Hacerlo fácil",
      calm: "Empezar pausa",
      support: "Empezar",
    },
    contentTypes: {
      exercise: "Ejercicio",
      meal: "Comida",
      tip: "Consejo",
      article: "Leer",
      supplement: "Suplemento",
      natural_solution: "Apoyo natural",
    },
    experiencePreviews: {
      heart: {
        label: "Movimiento VYVA",
        title: "Movimiento suave para el corazón",
        detail: "Un ejercicio sencillo para ritmo, circulación y confianza.",
        chips: ["Ritmo suave", "Equilibrio"],
      },
      brain: {
        label: "Brain Coach",
        title: "Juego mental corto",
        detail: "Un reto breve de memoria, palabras, acertijo o ajedrez con final claro.",
        chips: ["Entretenido", "Corto"],
      },
      strength: {
        label: "Planificador de ruta",
        title: "Ruta segura",
        detail: "Planifica el paseo según movilidad, clima, luz y lugares para descansar.",
        chips: ["Movilidad", "Clima"],
      },
      nourishment: {
        label: "Apoyo de comida",
        title: "Una idea simple para comer",
        detail: "Una elección práctica para la próxima comida, adaptada al momento del día.",
        chips: ["Próxima comida", "Simple"],
      },
      calm: {
        label: "Jardín de respiración",
        title: "Pausa breve",
        detail: "Una pausa guiada y tranquila para cerrar el día con más calma.",
        chips: ["2 min", "Descanso"],
      },
    },
    activityCtaLabels: {
      heart: "Movimiento VYVA",
      brain: "Juegos mentales VYVA",
      strength: "Ejercicio de estabilidad",
      calm: "Abrir respiración",
    },
    choosePillarLabel: "Elegir un pilar de longevidad",
    showPillarLabel: (pillarLabel) => `Mostrar ${pillarLabel}`,
    selectedPillarWhy: (pillarLabel, momentLabel, experienceLabel, detail) =>
      `${pillarLabel} está seleccionado para esta parte del día (${momentLabel.toLowerCase()}) porque ofrece un paso práctico de ${experienceLabel.toLowerCase()}: ${detail}`,
    notForMe: "No es para mí",
    afterWatching: "Después de verlo",
    tryThisNow: "Probar ahora",
    saveForLater: "Guardar",
    makeEasier: "Más fácil",
    feedbackQuestion: "¿Qué no encajó?",
    feedbackThanks: "Entendido. VYVA ajustará la próxima sugerencia.",
    savedForLater: "Guardado para después.",
    openingSupport: "Abriendo el siguiente paso.",
    makingEasier: "VYVA ayudará a hacerlo más fácil.",
    feedbackReasons: {
      too_boring: "Aburrido",
      too_hard: "Difícil",
      wrong_topic: "Otro tema",
      wrong_language: "Idioma",
      watched_already: "Ya lo vi",
    },
    makeEasierPrompt: (title, detail) =>
      `Haz más fácil la actividad de longevidad de hoy: ${title}. Que sea práctica y suave. Contexto: ${detail}`,
  },
  fr: {
    title: "Longévité",
    backLabel: "Retour à Ma santé",
    loadingLabel: "Chargement du plan longévité",
    errorTitle: "Votre plan longévité",
    errorMessage: "Nous n'avons pas pu charger votre plan pour le moment. Réessayez dans un instant.",
    errorButton: "Retour à Ma santé",
    now: "Maintenant",
    whyThis: "Pourquoi ceci ?",
    fromVideo: "Dans la vidéo",
    vyvaConsidered: "VYVA a pris en compte",
    defaultWhy: "Ce premier plan utilise des repères généraux de bien-être pendant que VYVA apprend ce qui compte pour vous.",
    currentTheme: "Thème actuel",
    programDay: "Jour du programme",
    momentEvidence: {
      morning: "Le matin convient au petit-déjeuner, à l'hydratation et à un départ simple.",
      midday: "Le midi convient aux repas, à l'hydratation et à une routine facile.",
      afternoon: "L'après-midi convient au mouvement, aux jeux cognitifs ou au lien social.",
      evening: "Le soir convient au ralentissement, à la réflexion et à la préparation de demain.",
    },
    voiceContextReady: "Contexte vocal prêt",
    close: "Fermer",
    askVyva: "Demander à VYVA",
    watch: "Regarder",
    videoPrefix: "Vidéo",
    resourcePrefix: "Ressource",
    fitPrefix: "Adapté",
    comfortPrefix: "Note de confort",
    durationMinute: "min",
    durationSecond: "s",
    moments: {
      morning: "Matin",
      midday: "Midi",
      afternoon: "Après-midi",
      evening: "Soir",
    },
    pillarLabels: {
      heart: "Cœur et circulation",
      brain: "Cerveau et mémoire",
      strength: "Force et stabilité",
      nourishment: "Nutrition",
      calm: "Calme et récupération",
    },
    pillarShortLabels: {
      heart: "Cœur",
      brain: "Cerveau",
      strength: "Force",
      nourishment: "Nutrition",
      calm: "Calme",
    },
    pillarSelectorLabels: {
      heart: "Cœur",
      brain: "Cerveau",
      strength: "Bouger",
      nourishment: "Repas",
      calm: "Calme",
    },
    experienceLabels: {
      video: "Vidéo choisie",
      brain_game: "Jeu cérébral",
      movement: "Mouvement",
      walking_route: "Itinéraire",
      food: "Repas",
      calm: "Calme",
      support: "Aujourd'hui",
    },
    ctaLabels: {
      video: "Regarder",
      brain_game: "Jouer",
      movement: "Commencer l'exercice",
      walking_route: "Planifier l'itinéraire",
      food: "Simplifier",
      calm: "Commencer la pause",
      support: "Commencer",
    },
    contentTypes: {
      exercise: "Exercice",
      meal: "Repas",
      tip: "Conseil",
      article: "Lire",
      supplement: "Complément",
      natural_solution: "Soutien naturel",
    },
    experiencePreviews: PILLAR_EXPERIENCE_PREVIEWS,
    activityCtaLabels: {
      heart: "Mouvement VYVA",
      brain: "Jeux cérébraux VYVA",
      strength: "Exercice de stabilité",
      calm: "Ouvrir la respiration",
    },
    choosePillarLabel: "Choisir un pilier de longévité",
    showPillarLabel: (pillarLabel) => `Afficher ${pillarLabel}`,
    selectedPillarWhy: (pillarLabel, momentLabel, experienceLabel, detail) =>
      `${pillarLabel} est sélectionné pour ce moment (${momentLabel.toLowerCase()}) car cela donne à VYVA une étape pratique de ${experienceLabel.toLowerCase()} : ${detail}`,
    notForMe: "Pas pour moi",
    afterWatching: "Après la vidéo",
    tryThisNow: "Essayer maintenant",
    saveForLater: "Garder",
    makeEasier: "Plus facile",
    feedbackQuestion: "Qu'est-ce qui ne convenait pas ?",
    feedbackThanks: "C'est noté. VYVA ajustera la prochaine suggestion.",
    savedForLater: "Gardé pour plus tard.",
    openingSupport: "Ouverture de l'étape suivante.",
    makingEasier: "VYVA va aider à simplifier cela.",
    feedbackReasons: {
      too_boring: "Trop ennuyeux",
      too_hard: "Trop difficile",
      wrong_topic: "Mauvais sujet",
      wrong_language: "Langue",
      watched_already: "Déjà vu",
    },
    makeEasierPrompt: (title, detail) =>
      `Rends l'activité longévité d'aujourd'hui plus facile : ${title}. Garde-la pratique et douce. Contexte : ${detail}`,
  },
  de: {
    title: "Langlebigkeit",
    backLabel: "Zurück zu Meine Gesundheit",
    loadingLabel: "Langlebigkeitsplan wird geladen",
    errorTitle: "Ihr Langlebigkeitsplan",
    errorMessage: "Wir konnten Ihren Plan gerade nicht laden. Bitte versuchen Sie es gleich erneut.",
    errorButton: "Zurück zu Meine Gesundheit",
    now: "Jetzt",
    whyThis: "Warum das?",
    fromVideo: "Aus dem Video",
    vyvaConsidered: "VYVA hat berücksichtigt",
    defaultWhy: "Dieser erste Plan nutzt allgemeine Wellness-Hinweise, während VYVA lernt, was Ihnen wichtig ist.",
    currentTheme: "Aktuelles Thema",
    programDay: "Programmtag",
    momentEvidence: {
      morning: "Der Morgen passt zu Frühstück, Flüssigkeit und einem einfachen Start.",
      midday: "Der Mittag passt zu Essen, Flüssigkeit und einer freundlichen Routine.",
      afternoon: "Der Nachmittag passt zu Bewegung, Denkspielen oder sozialem Kontakt.",
      evening: "Der Abend passt zu Ruhe, Reflexion und Vorbereitung auf morgen.",
    },
    voiceContextReady: "Sprachkontext bereit",
    close: "Schließen",
    askVyva: "VYVA fragen",
    watch: "Ansehen",
    videoPrefix: "Video",
    resourcePrefix: "Ressource",
    fitPrefix: "Passt",
    comfortPrefix: "Hinweis",
    durationMinute: "Min.",
    durationSecond: "Sek.",
    moments: {
      morning: "Morgen",
      midday: "Mittag",
      afternoon: "Nachmittag",
      evening: "Abend",
    },
    pillarLabels: {
      heart: "Herz und Kreislauf",
      brain: "Gehirn und Gedächtnis",
      strength: "Kraft und Stabilität",
      nourishment: "Ernährung",
      calm: "Ruhe und Erholung",
    },
    pillarShortLabels: {
      heart: "Herz",
      brain: "Gehirn",
      strength: "Kraft",
      nourishment: "Ernährung",
      calm: "Ruhe",
    },
    pillarSelectorLabels: {
      heart: "Herz",
      brain: "Gehirn",
      strength: "Bewegen",
      nourishment: "Essen",
      calm: "Ruhe",
    },
    experienceLabels: {
      video: "Ausgewähltes Video",
      brain_game: "Denkspiel",
      movement: "Bewegung",
      walking_route: "Route",
      food: "Essen",
      calm: "Ruhe",
      support: "Heute",
    },
    ctaLabels: {
      video: "Ansehen",
      brain_game: "Spielen",
      movement: "Übung starten",
      walking_route: "Route planen",
      food: "Einfach machen",
      calm: "Pause starten",
      support: "Starten",
    },
    contentTypes: {
      exercise: "Übung",
      meal: "Essen",
      tip: "Tipp",
      article: "Lesen",
      supplement: "Supplement",
      natural_solution: "Natürliche Unterstützung",
    },
    experiencePreviews: PILLAR_EXPERIENCE_PREVIEWS,
    activityCtaLabels: {
      heart: "VYVA-Bewegung starten",
      brain: "VYVA-Denkspiele spielen",
      strength: "Stabilitätsübung starten",
      calm: "Atemgarten öffnen",
    },
    choosePillarLabel: "Langlebigkeitsbereich wählen",
    showPillarLabel: (pillarLabel) => `${pillarLabel} anzeigen`,
    selectedPillarWhy: (pillarLabel, momentLabel, experienceLabel, detail) =>
      `${pillarLabel} ist für diesen Moment (${momentLabel.toLowerCase()}) ausgewählt, weil es einen praktischen ${experienceLabel.toLowerCase()}-Schritt bietet: ${detail}`,
    notForMe: "Nicht passend",
    afterWatching: "Nach dem Ansehen",
    tryThisNow: "Jetzt probieren",
    saveForLater: "Speichern",
    makeEasier: "Einfacher",
    feedbackQuestion: "Was hat nicht gepasst?",
    feedbackThanks: "Verstanden. VYVA passt den nächsten Vorschlag an.",
    savedForLater: "Für später gespeichert.",
    openingSupport: "Der nächste Schritt wird geöffnet.",
    makingEasier: "VYVA hilft, das einfacher zu machen.",
    feedbackReasons: {
      too_boring: "Zu langweilig",
      too_hard: "Zu schwer",
      wrong_topic: "Falsches Thema",
      wrong_language: "Sprache",
      watched_already: "Schon gesehen",
    },
    makeEasierPrompt: (title, detail) =>
      `Mache die heutige Longevity-Aktivität einfacher: ${title}. Bleib praktisch und sanft. Kontext: ${detail}`,
  },
  it: {
    title: "Longevità",
    backLabel: "Torna alla mia salute",
    loadingLabel: "Caricamento del piano longevità",
    errorTitle: "Il tuo piano longevità",
    errorMessage: "Non siamo riusciti a caricare il piano. Riprova tra poco.",
    errorButton: "Torna alla mia salute",
    now: "Ora",
    whyThis: "Perché questo?",
    fromVideo: "Dal video",
    vyvaConsidered: "VYVA ha considerato",
    defaultWhy: "Questo primo piano usa indicazioni generali di benessere mentre VYVA impara cosa conta per te.",
    currentTheme: "Tema attuale",
    programDay: "Giorno del programma",
    momentEvidence: {
      morning: "La mattina è adatta a colazione, idratazione e un inizio semplice.",
      midday: "Il mezzogiorno è adatto a pasti, idratazione e una routine gentile.",
      afternoon: "Il pomeriggio è adatto a movimento, giochi mentali o contatto sociale.",
      evening: "La sera è adatta a rallentare, riflettere e preparare domani.",
    },
    voiceContextReady: "Contesto vocale pronto",
    close: "Chiudi",
    askVyva: "Chiedi a VYVA",
    watch: "Guarda",
    videoPrefix: "Video",
    resourcePrefix: "Risorsa",
    fitPrefix: "Adatto",
    comfortPrefix: "Nota comfort",
    durationMinute: "min",
    durationSecond: "s",
    moments: {
      morning: "Mattina",
      midday: "Mezzogiorno",
      afternoon: "Pomeriggio",
      evening: "Sera",
    },
    pillarLabels: {
      heart: "Cuore e circolazione",
      brain: "Cervello e memoria",
      strength: "Forza e stabilità",
      nourishment: "Nutrizione",
      calm: "Calma e recupero",
    },
    pillarShortLabels: {
      heart: "Cuore",
      brain: "Cervello",
      strength: "Forza",
      nourishment: "Nutrizione",
      calm: "Calma",
    },
    pillarSelectorLabels: {
      heart: "Cuore",
      brain: "Cervello",
      strength: "Muovi",
      nourishment: "Cibo",
      calm: "Calma",
    },
    experienceLabels: {
      video: "Video curato",
      brain_game: "Gioco mentale",
      movement: "Movimento",
      walking_route: "Percorso",
      food: "Cibo",
      calm: "Calma",
      support: "Oggi",
    },
    ctaLabels: {
      video: "Guarda",
      brain_game: "Gioca",
      movement: "Inizia esercizio",
      walking_route: "Pianifica percorso",
      food: "Rendi semplice",
      calm: "Inizia pausa",
      support: "Inizia",
    },
    contentTypes: {
      exercise: "Esercizio",
      meal: "Cibo",
      tip: "Consiglio",
      article: "Leggi",
      supplement: "Integratore",
      natural_solution: "Supporto naturale",
    },
    experiencePreviews: PILLAR_EXPERIENCE_PREVIEWS,
    activityCtaLabels: {
      heart: "Movimento VYVA",
      brain: "Giochi mentali VYVA",
      strength: "Esercizio di stabilità",
      calm: "Apri respiro guidato",
    },
    choosePillarLabel: "Scegli un pilastro longevità",
    showPillarLabel: (pillarLabel) => `Mostra ${pillarLabel}`,
    selectedPillarWhy: (pillarLabel, momentLabel, experienceLabel, detail) =>
      `${pillarLabel} è selezionato per questo momento (${momentLabel.toLowerCase()}) perché offre un passo pratico di ${experienceLabel.toLowerCase()}: ${detail}`,
    notForMe: "Non fa per me",
    afterWatching: "Dopo il video",
    tryThisNow: "Prova ora",
    saveForLater: "Salva",
    makeEasier: "Più facile",
    feedbackQuestion: "Cosa non andava?",
    feedbackThanks: "Capito. VYVA adatterà il prossimo suggerimento.",
    savedForLater: "Salvato per dopo.",
    openingSupport: "Apro il passo successivo.",
    makingEasier: "VYVA aiuterà a renderlo più facile.",
    feedbackReasons: {
      too_boring: "Noioso",
      too_hard: "Troppo difficile",
      wrong_topic: "Tema sbagliato",
      wrong_language: "Lingua",
      watched_already: "Già visto",
    },
    makeEasierPrompt: (title, detail) =>
      `Rendi più facile l'attività Longevity di oggi: ${title}. Mantienila pratica e delicata. Contesto: ${detail}`,
  },
  pt: {
    title: "Longevidade",
    backLabel: "Voltar para Minha saúde",
    loadingLabel: "Carregando plano de longevidade",
    errorTitle: "Seu plano de longevidade",
    errorMessage: "Não conseguimos carregar seu plano agora. Tente novamente em instantes.",
    errorButton: "Voltar para Minha saúde",
    now: "Agora",
    whyThis: "Por que isto?",
    fromVideo: "Do vídeo",
    vyvaConsidered: "A VYVA considerou",
    defaultWhy: "Este primeiro plano usa orientação geral de bem-estar enquanto a VYVA aprende o que importa para você.",
    currentTheme: "Tema atual",
    programDay: "Dia do programa",
    momentEvidence: {
      morning: "A manhã combina com café da manhã, hidratação e um começo simples.",
      midday: "O meio-dia combina com refeição, hidratação e uma rotina leve.",
      afternoon: "A tarde combina com movimento, jogos mentais ou conexão social.",
      evening: "A noite combina com desacelerar, refletir e preparar o amanhã.",
    },
    voiceContextReady: "Contexto de voz pronto",
    close: "Fechar",
    askVyva: "Perguntar à VYVA",
    watch: "Assistir",
    videoPrefix: "Vídeo",
    resourcePrefix: "Recurso",
    fitPrefix: "Adequação",
    comfortPrefix: "Nota de conforto",
    durationMinute: "min",
    durationSecond: "s",
    moments: {
      morning: "Manhã",
      midday: "Meio-dia",
      afternoon: "Tarde",
      evening: "Noite",
    },
    pillarLabels: {
      heart: "Coração e circulação",
      brain: "Cérebro e memória",
      strength: "Força e estabilidade",
      nourishment: "Nutrição",
      calm: "Calma e recuperação",
    },
    pillarShortLabels: {
      heart: "Coração",
      brain: "Cérebro",
      strength: "Força",
      nourishment: "Nutrição",
      calm: "Calma",
    },
    pillarSelectorLabels: {
      heart: "Coração",
      brain: "Cérebro",
      strength: "Mover",
      nourishment: "Comida",
      calm: "Calma",
    },
    experienceLabels: {
      video: "Vídeo curado",
      brain_game: "Jogo mental",
      movement: "Movimento",
      walking_route: "Rota",
      food: "Comida",
      calm: "Calma",
      support: "Hoje",
    },
    ctaLabels: {
      video: "Assistir",
      brain_game: "Jogar",
      movement: "Começar exercício",
      walking_route: "Planejar rota",
      food: "Facilitar",
      calm: "Começar pausa",
      support: "Começar",
    },
    contentTypes: {
      exercise: "Exercício",
      meal: "Comida",
      tip: "Dica",
      article: "Ler",
      supplement: "Suplemento",
      natural_solution: "Apoio natural",
    },
    experiencePreviews: PILLAR_EXPERIENCE_PREVIEWS,
    activityCtaLabels: {
      heart: "Movimento VYVA",
      brain: "Jogos mentais VYVA",
      strength: "Exercício de estabilidade",
      calm: "Abrir respiração",
    },
    choosePillarLabel: "Escolher um pilar de longevidade",
    showPillarLabel: (pillarLabel) => `Mostrar ${pillarLabel}`,
    selectedPillarWhy: (pillarLabel, momentLabel, experienceLabel, detail) =>
      `${pillarLabel} está selecionado para este momento (${momentLabel.toLowerCase()}) porque oferece um passo prático de ${experienceLabel.toLowerCase()}: ${detail}`,
    notForMe: "Não é para mim",
    afterWatching: "Depois de assistir",
    tryThisNow: "Tentar agora",
    saveForLater: "Guardar",
    makeEasier: "Mais fácil",
    feedbackQuestion: "O que não combinou?",
    feedbackThanks: "Entendido. A VYVA vai ajustar a próxima sugestão.",
    savedForLater: "Guardado para depois.",
    openingSupport: "Abrindo o próximo passo.",
    makingEasier: "A VYVA vai ajudar a simplificar.",
    feedbackReasons: {
      too_boring: "Aborrecido",
      too_hard: "Difícil",
      wrong_topic: "Outro tema",
      wrong_language: "Idioma",
      watched_already: "Já vi",
    },
    makeEasierPrompt: (title, detail) =>
      `Facilite a atividade de longevidade de hoje: ${title}. Mantenha prática e suave. Contexto: ${detail}`,
  },
};

function copyLanguageCode(language: string | null | undefined): string {
  const code = (language ?? "en").slice(0, 2).toLowerCase();
  return LONGEVITY_COPY[code] ? code : "en";
}

function longevityCopyForLanguage(language: string | null | undefined): LongevityCopy {
  return LONGEVITY_COPY[copyLanguageCode(language)] ?? LONGEVITY_COPY.en;
}

function statusForMoment(moment: LongevityMoment, activeMoment: LongevityMoment): LongevityMomentStatus {
  if (moment === activeMoment) return "now";
  if (activeMoment === "evening") return "past";
  return LONGEVITY_MOMENTS.indexOf(moment) > LONGEVITY_MOMENTS.indexOf(activeMoment) ? "later" : "past";
}

function nextLongevityMoment(moment: LongevityMoment): LongevityMoment {
  const nextIndex = (LONGEVITY_MOMENTS.indexOf(moment) + 1) % LONGEVITY_MOMENTS.length;
  return LONGEVITY_MOMENTS[nextIndex];
}

function getLocalClockParts(timezone: string | null | undefined, now = new Date()): { hour: number; minute: number; second: number; millisecond: number } {
  if (!timezone) {
    return {
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
      millisecond: now.getMilliseconds(),
    };
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const valueFor = (type: "hour" | "minute" | "second") => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return {
      hour: valueFor("hour"),
      minute: valueFor("minute"),
      second: valueFor("second"),
      millisecond: now.getMilliseconds(),
    };
  } catch {
    return {
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
      millisecond: now.getMilliseconds(),
    };
  }
}

function longevityMomentForDate(timezone: string | null | undefined, now = new Date()): LongevityMoment {
  const { hour } = getLocalClockParts(timezone, now);
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 18) return "afternoon";
  return "evening";
}

function millisecondsUntilNextLongevityMoment(timezone: string | null | undefined, now = new Date()): number {
  const { hour, minute, second, millisecond } = getLocalClockParts(timezone, now);
  const elapsedToday = ((hour * 60 + minute) * 60 + second) * 1000 + millisecond;
  const nextBoundary = [5, 11, 14, 18].map((startHour) => startHour * HOUR_MS).find((boundary) => boundary > elapsedToday);
  const delay = (nextBoundary ?? DAY_MS + (LONGEVITY_MOMENT_DETAILS.morning.startHour * HOUR_MS)) - elapsedToday;
  return Math.max(1000, delay + 1000);
}

const PRIORITY_STATUS_RANK: Record<PreventionPillarStatus, number> = {
  priority_focus: 4,
  needs_attention: 3,
  steady: 2,
  thriving: 1,
};

const RESOURCE_URLS = {
  communityWalking: "/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning",
  niaBrain: "https://www.nia.nih.gov/health/brain-health/cognitive-health-and-older-adults",
  niaActivities: "https://www.nia.nih.gov/health/healthy-aging/participating-activities-you-enjoy-you-age",
  niaExerciseVideos: "https://www.nia.nih.gov/toolkits/exercise",
  niaFallHome: "https://www.nia.nih.gov/health/falls-and-falls-prevention/preventing-falls-home-room-room",
  niaFood: "https://www.nia.nih.gov/health/healthy-eating-nutrition-and-diet/healthy-eating-you-age-know-your-food-groups",
  niaMealPlanning: "https://www.nia.nih.gov/health/healthy-eating-nutrition-and-diet/healthy-meal-planning-tips-older-adults",
  niaSleep: "https://www.nia.nih.gov/health/sleep/sleep-and-older-adults",
  nihRelaxation: "https://www.nccih.nih.gov/health/relaxation-techniques-what-you-need-to-know",
};

const PREVIEW_DAILY_CONTENT: DailyContentResponse = {
  exercise: {
    id: "preview-exercise",
    content_type: "exercise",
    title: "Tai chi",
    description: "A slow balance-friendly VYVA exercise for light movement, posture, and rhythm.",
    detail_text: null,
    timing_guidance: "Afternoon",
    resource_title: "Tai chi",
    duration_seconds: 360,
    safety_notes: "Choose seated or supported movement if balance is limited.",
    source_label: "VYVA movement library",
    source_url: "/social-rooms/morning-movement/exercises/tai-chi",
    condition_tags: ["heart", "balance"],
    pillar_tag: "heart",
    time_of_day: "afternoon",
    language: "en",
  },
  meal: {
    id: "preview-meal",
    content_type: "meal",
    title: "Protein at breakfast",
    description: "A simple egg, yogurt, or beans helps energy and strength hold steadier.",
    detail_text: null,
    timing_guidance: "Morning breakfast",
    resource_title: "Breakfast support",
    duration_seconds: null,
    safety_notes: "Follow any food restrictions already given by the care team.",
    source_label: "VYVA food support",
    source_url: null,
    condition_tags: ["all"],
    pillar_tag: "nourishment",
    time_of_day: "morning",
    language: "en",
  },
  tip: {
    id: "preview-tip",
    content_type: "tip",
    title: "Same bedtime tonight",
    description: "A regular sleep time supports memory, mood, and blood sugar patterns.",
    detail_text: null,
    timing_guidance: "Evening",
    resource_title: "Breath Garden",
    duration_seconds: 120,
    safety_notes: "Keep breathing comfortable.",
    source_label: "Breath Garden",
    source_url: "/games/breath-garden",
    condition_tags: ["all"],
    pillar_tag: "calm",
    time_of_day: "evening",
    language: "en",
  },
  articles: [
    {
      id: "preview-article",
      content_type: "article",
      title: "Guided movement supports heart routines",
    description: "A short, practical resource connected to your current movement focus.",
    detail_text: null,
    resource_title: "Seated strength",
    duration_seconds: 240,
    safety_notes: "Use a chair or support if balance feels uncertain.",
    source_label: "VYVA movement library",
    source_url: "/social-rooms/morning-movement/exercises/seated-strength",
      condition_tags: ["strength"],
      pillar_tag: "strength",
      time_of_day: "any",
      language: "en",
    },
  ],
  byPillar: {
    heart: [{
      id: "preview-heart",
      content_type: "exercise",
      title: "Tai chi",
      description: "A slow balance-friendly VYVA exercise for light movement, posture, and rhythm.",
      detail_text: null,
      timing_guidance: "Afternoon",
      resource_title: "Tai chi",
      duration_seconds: 360,
      safety_notes: "Choose seated or supported movement if balance is limited.",
      source_label: "VYVA movement library",
      source_url: "/social-rooms/morning-movement/exercises/tai-chi",
      condition_tags: ["heart", "balance"],
      pillar_tag: "heart",
      time_of_day: "afternoon",
      language: "en",
    }],
    brain: [{
      id: "preview-brain",
      content_type: "tip",
      title: "Word recall challenge",
      description: "Study a few words, hide them, then see what you remember.",
      detail_text: null,
      timing_guidance: "Any time",
      resource_title: "Brain Coach",
      duration_seconds: null,
      safety_notes: "A short game is enough.",
      source_label: "Brain Coach",
      source_url: "/mind",
      condition_tags: ["brain"],
      pillar_tag: "brain",
      time_of_day: "any",
      language: "en",
    }],
    strength: [{
      id: "preview-strength",
      content_type: "tip",
      title: "Clear one walking path",
      description: "One clear route at home makes movement easier and steadier.",
      detail_text: null,
      timing_guidance: "Afternoon or before an outing",
      resource_title: "Walking route planner",
      duration_seconds: null,
      safety_notes: "Route planning only; stop for pain, dizziness, or unsafe conditions.",
      source_label: "VYVA route planner",
      source_url: "/social-rooms/walking-route?source=longevity&intent=clear-walking-path",
      condition_tags: ["falls"],
      pillar_tag: "strength",
      time_of_day: "evening",
      language: "en",
    }],
    nourishment: [{
      id: "preview-nourishment",
      content_type: "meal",
      title: "Protein with the next meal",
      description: "Choose one familiar protein food so nourishment does not become complicated.",
      detail_text: null,
      timing_guidance: "Next meal",
      resource_title: "Meal support",
      duration_seconds: null,
      safety_notes: "Follow any food restrictions already given by the care team.",
      source_label: "VYVA food support",
      source_url: null,
      condition_tags: ["all"],
      pillar_tag: "nourishment",
      time_of_day: "any",
      language: "en",
    }],
    calm: [{
      id: "preview-calm",
      content_type: "tip",
      title: "Same bedtime tonight",
      description: "A familiar evening time supports tomorrow's energy and attention.",
      detail_text: null,
      timing_guidance: "Evening",
      resource_title: "Breath Garden",
      duration_seconds: 120,
      safety_notes: "Keep breathing comfortable.",
      source_label: "Breath Garden",
      source_url: "/games/breath-garden",
      condition_tags: ["calm"],
      pillar_tag: "calm",
      time_of_day: "evening",
      language: "en",
    }],
  },
};

const PREVIEW_ACTIVE_PROGRAM: ActiveProgram = {
  id: "preview-longevity-program",
  programKey: "starter_video_longevity_v1",
  title: "14-day VYVA longevity starter",
  status: "active",
  focusPillars: ["brain", "heart", "strength", "nourishment", "calm"],
  startDate: "2026-08-01",
  currentDay: 1,
  totalDays: 14,
  language: "en",
  cadence: "daily",
};

const PREVIEW_PROGRAM_STEP: ProgramStep = {
  id: "preview-longevity-program-day-1",
  programId: PREVIEW_ACTIVE_PROGRAM.id,
  dayIndex: 1,
  pillar: "brain",
  theme: "Memory starter",
  objective: "Watch one short visual guide, then keep memory practice familiar.",
  actionTitle: "3-2-1 memory lane",
  actionDetail: "Pick a real place. Name 3 things you see there, 2 sounds, and 1 person connected to it.",
  videoQuery: "MIND diet brain health short Mayo Clinic video",
  scheduledDate: "2026-08-01",
  status: "scheduled",
};

const PREVIEW_PROGRAM_STEP_COPY_BY_LANGUAGE: Record<string, Pick<ProgramStep, "theme" | "objective" | "actionTitle" | "actionDetail">> = {
  en: {
    theme: "Memory starter",
    objective: "Watch one short visual guide, then keep memory practice familiar.",
    actionTitle: "3-2-1 memory lane",
    actionDetail: "Pick a real place. Name 3 things you see there, 2 sounds, and 1 person connected to it.",
  },
  es: {
    theme: "Inicio de memoria",
    objective: "Mira una guía breve y mantén la práctica de memoria familiar.",
    actionTitle: "3-2-1 de memoria",
    actionDetail: "Elige un lugar real. Nombra 3 cosas que ves allí, 2 sonidos y 1 persona vinculada.",
  },
  fr: {
    theme: "Départ mémoire",
    objective: "Regarder une courte vidéo, puis garder l'exercice de mémoire familier.",
    actionTitle: "Mémoire 3-2-1",
    actionDetail: "Choisissez un lieu réel. Nommez 3 choses vues là-bas, 2 sons et 1 personne liée.",
  },
  de: {
    theme: "Gedächtnisstart",
    objective: "Ein kurzes Video ansehen und die Gedächtnisübung vertraut halten.",
    actionTitle: "3-2-1-Gedächtnisrunde",
    actionDetail: "Wählen Sie einen echten Ort. Nennen Sie 3 Dinge dort, 2 Geräusche und 1 verbundene Person.",
  },
  it: {
    theme: "Avvio memoria",
    objective: "Guarda una breve guida e mantieni familiare l'esercizio di memoria.",
    actionTitle: "Memoria 3-2-1",
    actionDetail: "Scegli un luogo reale. Nomina 3 cose che vedi, 2 suoni e 1 persona collegata.",
  },
  pt: {
    theme: "Início da memória",
    objective: "Assista a um vídeo breve e mantenha a prática de memória familiar.",
    actionTitle: "Memória 3-2-1",
    actionDetail: "Escolha um lugar real. Diga 3 coisas que vê ali, 2 sons e 1 pessoa ligada a ele.",
  },
};

function previewProgramStepForLanguage(language: string | null | undefined): ProgramStep {
  const code = copyLanguageCode(language);
  return {
    ...PREVIEW_PROGRAM_STEP,
    ...(PREVIEW_PROGRAM_STEP_COPY_BY_LANGUAGE[code] ?? PREVIEW_PROGRAM_STEP_COPY_BY_LANGUAGE.en),
  };
}

const PREVIEW_TODAY_VIDEO: TodayVideo = {
  id: "preview-longevity-video",
  provider: "youtube",
  videoId: "hoPg4bkKemQ",
  url: "https://www.youtube.com/watch?v=hoPg4bkKemQ",
  title: "Mayo Clinic Minute: Can the MIND diet improve brain health?",
  channel: "Mayo Clinic",
  durationSeconds: 70,
  thumbnailUrl: "https://i.ytimg.com/vi/hoPg4bkKemQ/hqdefault.jpg",
  language: "en",
  summary: "A short visual guide connecting food choices with brain health.",
  selectedReason: "Connects one simple food choice with memory and energy for today.",
  safetyNotes: "General wellness education only.",
};

const EN_PILLAR_VIDEO_LIBRARY: Record<PreventionPillar, TodayVideo> = {
  brain: PREVIEW_TODAY_VIDEO,
  heart: {
    id: "pillar-video-heart-mayo-moving",
    provider: "youtube",
    videoId: "sjrEUD9RZqA",
    url: "https://www.youtube.com/watch?v=sjrEUD9RZqA",
    title: "Mayo Clinic Minute: A little moving goes long way for heart health",
    channel: "Mayo Clinic",
    durationSeconds: 60,
    thumbnailUrl: "https://i.ytimg.com/vi/sjrEUD9RZqA/hqdefault.jpg",
    language: "en",
    summary: "A short visual cue that heart-supporting movement can stay small and doable.",
    selectedReason: "Makes heart movement feel doable by keeping the first step small.",
    safetyNotes: "General wellness education only; choose comfortable movement.",
  },
  strength: {
    id: "pillar-video-strength-nia-workout",
    provider: "youtube",
    videoId: "G1lwVhnnkoU",
    url: "https://www.youtube.com/watch?v=G1lwVhnnkoU",
    title: "10-minute Workout for Older Adults",
    channel: "National Institute on Aging",
    durationSeconds: 600,
    thumbnailUrl: "https://i.ytimg.com/vi/G1lwVhnnkoU/hqdefault.jpg",
    language: "en",
    summary: "A bounded older-adult workout with strength, balance, flexibility, and endurance.",
    selectedReason: "Shows a bounded movement routine so starting feels clear and steady.",
    safetyNotes: "Use support nearby and make movements smaller whenever needed.",
  },
  nourishment: {
    id: "pillar-video-nourishment-mayo-fat",
    provider: "youtube",
    videoId: "R41BXXGohsU",
    url: "https://www.youtube.com/watch?v=R41BXXGohsU",
    title: "Mayo Clinic Minute: How to choose a healthy fat",
    channel: "Mayo Clinic",
    durationSeconds: 60,
    thumbnailUrl: "https://i.ytimg.com/vi/R41BXXGohsU/hqdefault.jpg",
    language: "en",
    summary: "A quick visual guide for making one meal choice easier.",
    selectedReason: "Turns nourishment into one practical choice at the next meal.",
    safetyNotes: "General nutrition education only; follow personal restrictions and clinician guidance.",
  },
  calm: {
    id: "pillar-video-calm-daily-calm",
    provider: "youtube",
    videoId: "ZToicYcHIOU",
    url: "https://www.youtube.com/watch?v=ZToicYcHIOU",
    title: "Daily Calm | 10 Minute Mindfulness Meditation | Be Present",
    channel: "Calm",
    durationSeconds: 600,
    thumbnailUrl: "https://i.ytimg.com/vi/ZToicYcHIOU/hqdefault.jpg",
    language: "en",
    summary: "A simple guided meditation for a calm reset.",
    selectedReason: "Gives the pause a gentle pace to follow without overthinking it.",
    safetyNotes: "Pause or stop if the exercise feels uncomfortable.",
  },
};

const PILLAR_VIDEO_LIBRARY_BY_LANGUAGE: Record<string, Record<PreventionPillar, TodayVideo>> = {
  en: EN_PILLAR_VIDEO_LIBRARY,
  es: {
    brain: {
      id: "pillar-video-brain-mayo-mind-es",
      provider: "youtube",
      videoId: "2XVQctv5WzQ",
      url: "https://www.youtube.com/watch?v=2XVQctv5WzQ",
      title: "El minuto de Mayo Clinic: La alimentación puede mejorar la salud cerebral",
      channel: "Mayo Clinic",
      durationSeconds: 70,
      thumbnailUrl: "https://i.ytimg.com/vi/2XVQctv5WzQ/hqdefault.jpg",
      language: "es",
      summary: "Una explicación breve sobre cómo la alimentación puede apoyar la salud cerebral.",
      selectedReason: "Conecta una comida sencilla con memoria y energía para elegir un cambio hoy.",
      safetyNotes: "Educación general de bienestar; no sustituye orientación clínica.",
    },
    heart: {
      id: "pillar-video-heart-mayo-exercise-es",
      provider: "youtube",
      videoId: "pEki37hCX9s",
      url: "https://www.youtube.com/watch?v=pEki37hCX9s",
      title: "El minuto de Mayo Clinic: ¿Por qué tiene que hacer ese ejercicio que odia?",
      channel: "Mayo Clinic",
      durationSeconds: 70,
      thumbnailUrl: "https://i.ytimg.com/vi/pEki37hCX9s/hqdefault.jpg",
      language: "es",
      summary: "Un recordatorio breve para elegir movimiento de una forma más llevadera.",
      selectedReason: "Ayuda a escoger un movimiento breve y amable para activar el día sin hacerlo pesado.",
      safetyNotes: "Mantén el movimiento cómodo y suave; detente si algo no se siente bien.",
    },
    strength: {
      id: "pillar-video-strength-warmup-es",
      provider: "youtube",
      videoId: "M0Jh5tLQRE0",
      url: "https://www.youtube.com/watch?v=M0Jh5tLQRE0",
      title: "Rutina de Ejercicios de CALENTAMIENTO para Adultos Mayores Activos (10 minutos)",
      channel: "Mariana Quevedo | Fisioterapia Querétaro",
      durationSeconds: 600,
      thumbnailUrl: "https://i.ytimg.com/vi/M0Jh5tLQRE0/hqdefault.jpg",
      language: "es",
      summary: "Una rutina breve de calentamiento para empezar movimiento con más seguridad.",
      selectedReason: "Ayuda a preparar el cuerpo antes de caminar o moverse por casa con más confianza.",
      safetyNotes: "Usa apoyo cercano y haz cada movimiento más pequeño si lo necesitas.",
    },
    nourishment: {
      id: "pillar-video-nourishment-healthy-eating-es",
      provider: "youtube",
      videoId: "pBVof_fgLV4",
      url: "https://www.youtube.com/watch?v=pBVof_fgLV4",
      title: "Alimentación saludable en las personas mayores",
      channel: "SaludMadrid",
      durationSeconds: null,
      thumbnailUrl: "https://i.ytimg.com/vi/pBVof_fgLV4/hqdefault.jpg",
      language: "es",
      summary: "Un recurso visual en español sobre alimentación saludable en personas mayores.",
      selectedReason: "Da ideas simples para mejorar la próxima comida sin cambiar toda la rutina.",
      safetyNotes: "Educación general; respeta alergias, preferencias y pautas del equipo sanitario.",
    },
    calm: {
      id: "pillar-video-calm-meditation-es",
      provider: "youtube",
      videoId: "FReFf1CLf-c",
      url: "https://www.youtube.com/watch?v=FReFf1CLf-c",
      title: "Meditación Guiada de 10 minutos | Calma la mente y consigue paz interior",
      channel: "Anabel Otero",
      durationSeconds: 600,
      thumbnailUrl: "https://i.ytimg.com/vi/FReFf1CLf-c/hqdefault.jpg",
      language: "es",
      summary: "Una meditación guiada corta en español para una pausa tranquila.",
      selectedReason: "Da estructura sonora y visual a una pausa de calma fácil de empezar.",
      safetyNotes: "Pausa o termina si respirar lento o cerrar los ojos no resulta cómodo.",
    },
  },
  fr: {
    brain: {
      id: "pillar-video-brain-food-cognition-fr",
      provider: "youtube",
      videoId: "Uplih5Mx1uw",
      url: "https://www.youtube.com/watch?v=Uplih5Mx1uw",
      title: "Les meilleurs aliments pour préserver son cerveau et ses facultés le plus longtemps possible",
      channel: "Allo Docteurs",
      durationSeconds: null,
      thumbnailUrl: "https://i.ytimg.com/vi/Uplih5Mx1uw/hqdefault.jpg",
      language: "fr",
      summary: "Un guide visuel en français sur les choix alimentaires liés au cerveau.",
      selectedReason: "Relie le repas à la mémoire avec une action simple pour aujourd'hui.",
      safetyNotes: "Information générale de bien-être; respecter les conseils médicaux personnels.",
    },
    heart: {
      id: "pillar-video-heart-gentle-exercise-fr",
      provider: "youtube",
      videoId: "OBn81SkwFtk",
      url: "https://www.youtube.com/watch?v=OBn81SkwFtk",
      title: "10 min d'exercice physique par jour pour les seniors - 1",
      channel: "Senioriales résidences seniors",
      durationSeconds: 600,
      thumbnailUrl: "https://i.ytimg.com/vi/OBn81SkwFtk/hqdefault.jpg",
      language: "fr",
      summary: "Une courte séance en français pour garder le mouvement simple.",
      selectedReason: "Aide à garder un mouvement doux et réaliste dans la journée.",
      safetyNotes: "Choisir une version confortable et garder un appui à proximité.",
    },
    strength: {
      id: "pillar-video-strength-gym-senior-fr",
      provider: "youtube",
      videoId: "XOYqccktGxQ",
      url: "https://www.youtube.com/watch?v=XOYqccktGxQ",
      title: "Gym douce senior : séance complète de 10 minutes",
      channel: "Gym Senior",
      durationSeconds: 600,
      thumbnailUrl: "https://i.ytimg.com/vi/XOYqccktGxQ/hqdefault.jpg",
      language: "fr",
      summary: "Une séance douce en français pour travailler mobilité et stabilité.",
      selectedReason: "Propose quelques mouvements pour démarrer avec plus de stabilité.",
      safetyNotes: "Utiliser un appui stable et réduire l'amplitude si nécessaire.",
    },
    nourishment: {
      id: "pillar-video-nourishment-senior-food-fr",
      provider: "youtube",
      videoId: "VWH4M7j0ECk",
      url: "https://www.youtube.com/watch?v=VWH4M7j0ECk",
      title: "Quelle alimentation pour les seniors ? - Sénior, et alors ?",
      channel: "mieux",
      durationSeconds: null,
      thumbnailUrl: "https://i.ytimg.com/vi/VWH4M7j0ECk/hqdefault.jpg",
      language: "fr",
      summary: "Un contenu en français sur les repères alimentaires pour seniors.",
      selectedReason: "Transforme les repères alimentaires en une amélioration simple du prochain repas.",
      safetyNotes: "Information générale; tenir compte des allergies et restrictions personnelles.",
    },
    calm: {
      id: "pillar-video-calm-meditation-fr",
      provider: "youtube",
      videoId: "T6VJVRmqVJ8",
      url: "https://www.youtube.com/watch?v=T6VJVRmqVJ8",
      title: "10 min de Calme et de Pleine conscience",
      channel: "Cédric Michel",
      durationSeconds: 600,
      thumbnailUrl: "https://i.ytimg.com/vi/T6VJVRmqVJ8/hqdefault.jpg",
      language: "fr",
      summary: "Une méditation guidée en français pour une pause calme.",
      selectedReason: "Donne un rythme guidé pour une pause calme facile à commencer.",
      safetyNotes: "Arrêter si l'exercice n'est pas confortable.",
    },
  },
};

const VIDEO_INSIGHTS_BY_ID: Record<string, VideoInsight> = {
  hoPg4bkKemQ: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Brain-friendly eating works best as a simple pattern, not a perfect rule.",
      "One useful swap today is easier to keep than a full meal overhaul.",
    ],
    seniorTakeaway: "Use the video as a cue to choose one brain-friendly food today, then keep the memory step short.",
  },
  sjrEUD9RZqA: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Small amounts of movement still count when the day feels full.",
      "The first step is choosing a comfortable movement, not chasing intensity.",
    ],
    seniorTakeaway: "Pick one gentle VYVA movement and treat starting as the win.",
  },
  R41BXXGohsU: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Healthy fats are easier to choose when they are tied to a real meal.",
      "The useful habit is one visible plate choice, not another food rule.",
    ],
    seniorTakeaway: "At the next meal, choose one familiar healthier fat or protein option that already fits your routine.",
  },
  ZToicYcHIOU: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "A guided rhythm can make a calm pause easier to follow.",
      "A few settled minutes are enough for today's calm step.",
    ],
    seniorTakeaway: "Let the video provide the pace; stop after a few minutes if that is enough.",
  },
  "2XVQctv5WzQ": {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "La alimentación puede apoyar la salud cerebral como parte de una rutina diaria.",
      "Un cambio pequeño en una comida es más práctico que intentar cambiar todo.",
    ],
    seniorTakeaway: "Usa el video para elegir hoy un alimento familiar que apoye memoria y energía.",
  },
  pEki37hCX9s: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "El movimiento funciona mejor cuando se adapta a lo que la persona puede hacer hoy.",
      "Empezar con algo cómodo ayuda más que forzar un ejercicio que se odia.",
    ],
    seniorTakeaway: "Escoge una versión suave y breve; la constancia importa más que hacerlo perfecto.",
  },
  M0Jh5tLQRE0: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Un calentamiento prepara el cuerpo antes de moverse más.",
      "Tener una silla o apoyo cerca hace que el paso sea más seguro.",
    ],
    seniorTakeaway: "Haz solo el calentamiento y reduce cualquier movimiento que no se sienta cómodo.",
  },
  pBVof_fgLV4: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "La alimentación saludable en mayores se entiende mejor con ejemplos concretos.",
      "El plato de hoy puede mejorar con una sola decisión visible.",
    ],
    seniorTakeaway: "En la próxima comida, añade agua, proteína o un alimento colorido que ya te guste.",
  },
  "FReFf1CLf-c": {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Una guía breve puede ayudar a calmar la mente sin complicar el día.",
      "La pausa debe sentirse cómoda, no exigente.",
    ],
    seniorTakeaway: "Sigue la voz unos minutos y termina antes si cerrar los ojos o respirar lento no encaja hoy.",
  },
  Uplih5Mx1uw: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Les choix alimentaires peuvent soutenir le cerveau dans une routine globale.",
      "Un repère simple au repas est plus utile qu'une liste compliquée.",
    ],
    seniorTakeaway: "Choisir aujourd'hui un aliment familier qui rend le repas un peu plus favorable au cerveau.",
  },
  OBn81SkwFtk: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Dix minutes peuvent suffire pour garder un mouvement doux dans la journée.",
      "Le bon rythme est celui qui reste confortable et régulier.",
    ],
    seniorTakeaway: "Faire la version la plus douce, avec un appui proche si besoin.",
  },
  XOYqccktGxQ: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Une séance courte aide à travailler mobilité et stabilité sans surcharge.",
      "Réduire l'amplitude rend l'exercice plus facile à adapter.",
    ],
    seniorTakeaway: "Commencer par quelques mouvements et garder une chaise stable à proximité.",
  },
  VWH4M7j0ECk: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Les besoins alimentaires changent avec l'âge et gagnent à rester concrets.",
      "Le meilleur pas est une amélioration visible du prochain repas.",
    ],
    seniorTakeaway: "Ajouter au prochain repas une option simple qui respecte les goûts et restrictions personnelles.",
  },
  T6VJVRmqVJ8: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Une courte méditation donne une structure claire au moment calme.",
      "La pause doit rester confortable et facile à arrêter.",
    ],
    seniorTakeaway: "Suivre quelques minutes guidées et arrêter si l'exercice ne convient pas aujourd'hui.",
  },
  uLLo9w4dbPA: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "A movement pledge works best when it is small and specific.",
      "Choosing the next step lowers the friction to begin.",
    ],
    seniorTakeaway: "Name one movement you would actually do today, then make it smaller if needed.",
  },
  "q-_BWXpM-Y0": {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "A short warm-up helps movement start gradually.",
      "Older-adult routines should stay bounded and easy to pause.",
    ],
    seniorTakeaway: "Use the warm-up only, with support nearby, before deciding whether to do more.",
  },
  BzpaQ0F49JE: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Protein can be framed as part of energy and strength support.",
      "Breakfast is a practical anchor because it is already a daily moment.",
    ],
    seniorTakeaway: "Choose one familiar protein at breakfast instead of redesigning the whole diet.",
  },
  inpok4MKVLM: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Five guided minutes can make meditation feel approachable.",
      "A timer and voice remove the need to decide what to do next.",
    ],
    seniorTakeaway: "Try the first few minutes seated comfortably; stopping early is still a useful reset.",
  },
  BHY0FxzoKZE: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Movement and brain health are connected through everyday habits.",
      "The practical takeaway is to pair thinking and moving in a small way.",
    ],
    seniorTakeaway: "After watching, pair one light movement with a tiny memory or word challenge.",
  },
  "61p1OIO20wk": {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Busy days need movement that fits into the day already happening.",
      "Short routine cues can be more useful than a separate workout plan.",
    ],
    seniorTakeaway: "Attach one gentle movement to something already on the calendar today.",
  },
  bAsTJg24gck: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Chair-based exercise can keep movement available on lower-energy days.",
      "Seated options still support mobility when standing work is not right.",
    ],
    seniorTakeaway: "Use the seated version and skip any movement that feels uncomfortable.",
  },
  "6O_jxyC-eu0": {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Older-adult nutrition is easier to act on when tied to the next meal.",
      "Hydration, protein, and colourful foods are practical levers.",
    ],
    seniorTakeaway: "Pick one plate upgrade for the meal that is easiest to change today.",
  },
  FJJazKtH_9I: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "A visual breathing pattern can make a calm reset concrete.",
      "Comfort matters more than holding the breath exactly.",
    ],
    seniorTakeaway: "Follow the visual rhythm gently and switch to normal slow breathing if holds feel wrong.",
  },
  LyR0l_GEgZI: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Low-intensity movement can happen indoors when outdoor walking is not ideal.",
      "A ten-minute limit makes the exercise easier to start and finish.",
    ],
    seniorTakeaway: "Start the low-intensity routine and keep the range small enough to feel steady.",
  },
  G1lwVhnnkoU: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "A short older-adult workout can combine strength, balance, flexibility, and endurance.",
      "Support nearby makes the routine easier to adapt safely.",
    ],
    seniorTakeaway: "Do the first few movements with a chair nearby; stop when you have done enough for today.",
  },
  "86HUcX8ZtAk": {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Progressive relaxation gives calm a clear sequence to follow.",
      "Skipping uncomfortable areas keeps the practice practical.",
    ],
    seniorTakeaway: "Use the guided sequence only where it feels comfortable and let that be enough.",
  },
};

function cleanVideoInsightText(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

const INTERNAL_VIDEO_REASON_PATTERN = /\b(?:en español|en français|language|langue|idioma|specific|específico|especifico|spécifique|adultos mayores|personas mayores|personnes âgées|older adults|seniors?|limited|limitado|limité|reviewed|curation|curated|fallback|api|youtube|program step|auto-selected|filters?)\b|\b(?:one-minute|\d+\s*(?:minutes?|minutos?)|dix minutes)\b/i;

const PUBLIC_VIDEO_REASONS: Record<string, Record<PreventionPillar, string>> = {
  en: {
    heart: "Offers one gentle movement cue that can fit into today without feeling heavy.",
    brain: "Turns the idea into a small memory-friendly choice you can try today.",
    strength: "Helps prepare the body for steadier movement at home or outside.",
    nourishment: "Makes the next meal easier to improve with one visible choice.",
    calm: "Gives the mind a simple pace to follow for a calmer pause.",
  },
  es: {
    heart: "Ofrece una forma suave de moverte hoy sin convertirlo en una tarea pesada.",
    brain: "Convierte la idea en una elección sencilla para apoyar memoria y energía.",
    strength: "Ayuda a preparar el cuerpo para moverte con más confianza en casa o fuera.",
    nourishment: "Hace más fácil mejorar la próxima comida con una sola elección visible.",
    calm: "Da un ritmo sencillo para hacer una pausa con más calma.",
  },
  fr: {
    heart: "Propose un mouvement doux qui peut entrer dans la journée sans la compliquer.",
    brain: "Transforme l'idée en un petit choix favorable à la mémoire aujourd'hui.",
    strength: "Aide à préparer le corps pour bouger avec plus de stabilité.",
    nourishment: "Rend le prochain repas plus facile à améliorer avec un seul choix visible.",
    calm: "Donne un rythme simple pour une pause plus calme.",
  },
  de: {
    heart: "Bietet einen sanften Bewegungsimpuls, der heute leicht in den Tag passt.",
    brain: "Macht die Idee zu einer kleinen gedächtnisfreundlichen Wahl für heute.",
    strength: "Hilft, den Körper auf stabilere Bewegung vorzubereiten.",
    nourishment: "Macht die nächste Mahlzeit mit einer sichtbaren Wahl leichter zu verbessern.",
    calm: "Gibt dem Kopf einen einfachen Rhythmus für eine ruhigere Pause.",
  },
  it: {
    heart: "Offre uno spunto di movimento delicato che può entrare nella giornata senza pesare.",
    brain: "Trasforma l'idea in una piccola scelta utile per memoria ed energia.",
    strength: "Aiuta a preparare il corpo a muoversi con più stabilità.",
    nourishment: "Rende il prossimo pasto più facile da migliorare con una sola scelta visibile.",
    calm: "Dà alla mente un ritmo semplice per una pausa più calma.",
  },
  pt: {
    heart: "Oferece um movimento suave que cabe no dia sem pesar.",
    brain: "Transforma a ideia em uma pequena escolha favorável à memória hoje.",
    strength: "Ajuda a preparar o corpo para se mover com mais estabilidade.",
    nourishment: "Torna a próxima refeição mais fácil de melhorar com uma escolha visível.",
    calm: "Dá à mente um ritmo simples para uma pausa mais calma.",
  },
};

const PUBLIC_VIDEO_FIT_NOTES: Record<string, Record<PreventionPillar, string>> = {
  en: {
    heart: "Keep the movement gentle and choose the easiest version today.",
    brain: "Use it as a small prompt, then keep the next step short.",
    strength: "Use support nearby and make any movement smaller if needed.",
    nourishment: "Follow your usual food restrictions and choose something familiar.",
    calm: "Stop early if the pace or breathing does not feel comfortable.",
  },
  es: {
    heart: "Mantén el movimiento suave y elige la versión más fácil hoy.",
    brain: "Úsalo como una pequeña señal y deja que el siguiente paso sea breve.",
    strength: "Ten apoyo cerca y haz cualquier movimiento más pequeño si lo necesitas.",
    nourishment: "Respeta tus restricciones habituales y elige algo familiar.",
    calm: "Termina antes si el ritmo o la respiración no se sienten cómodos.",
  },
  fr: {
    heart: "Garder le mouvement doux et choisir la version la plus facile aujourd'hui.",
    brain: "L'utiliser comme un petit repère, puis garder l'étape suivante courte.",
    strength: "Garder un appui proche et réduire les mouvements si besoin.",
    nourishment: "Respecter les restrictions habituelles et choisir quelque chose de familier.",
    calm: "Arrêter plus tôt si le rythme ou la respiration ne convient pas.",
  },
  de: {
    heart: "Die Bewegung sanft halten und heute die einfachste Version wählen.",
    brain: "Als kleinen Impuls nutzen und den nächsten Schritt kurz halten.",
    strength: "Eine Stütze in der Nähe behalten und Bewegungen bei Bedarf kleiner machen.",
    nourishment: "Gewohnte Einschränkungen beachten und etwas Vertrautes wählen.",
    calm: "Früher aufhören, wenn Rhythmus oder Atmung nicht angenehm sind.",
  },
  it: {
    heart: "Mantieni il movimento delicato e scegli oggi la versione più facile.",
    brain: "Usalo come piccolo promemoria e tieni breve il passo successivo.",
    strength: "Tieni un appoggio vicino e riduci il movimento se serve.",
    nourishment: "Rispetta le tue restrizioni abituali e scegli qualcosa di familiare.",
    calm: "Fermati prima se ritmo o respirazione non sono comodi.",
  },
  pt: {
    heart: "Mantenha o movimento suave e escolha hoje a versão mais fácil.",
    brain: "Use como um pequeno lembrete e mantenha o próximo passo curto.",
    strength: "Mantenha apoio por perto e reduza os movimentos se precisar.",
    nourishment: "Respeite suas restrições habituais e escolha algo familiar.",
    calm: "Pare mais cedo se o ritmo ou a respiração não forem confortáveis.",
  },
};

function videoReasonLooksInternal(value: string): boolean {
  return INTERNAL_VIDEO_REASON_PATTERN.test(value);
}

function publicVideoCopy(language: string | null | undefined, pillar: PreventionPillar | null | undefined, source: typeof PUBLIC_VIDEO_REASONS): string {
  const normalized = copyLanguageCode(language);
  const safePillar = pillar ?? "brain";
  return source[normalized]?.[safePillar] ?? source.en[safePillar] ?? source.en.brain;
}

function publicVideoReason(video: TodayVideo | null | undefined, pillar: PreventionPillar | null | undefined, language?: string | null): string {
  const reason = cleanVideoInsightText(video?.selectedReason);
  return reason && !videoReasonLooksInternal(reason)
    ? reason
    : publicVideoCopy(language ?? video?.language, pillar, PUBLIC_VIDEO_REASONS);
}

function publicVideoTakeaway(video: TodayVideo | null | undefined, pillar: PreventionPillar | null | undefined, language?: string | null): string {
  const takeaway = cleanVideoInsightText(video?.seniorTakeaway);
  return takeaway && !videoReasonLooksInternal(takeaway)
    ? takeaway
    : publicVideoCopy(language ?? video?.language, pillar, PUBLIC_VIDEO_REASONS);
}

function publicVideoKeyPoints(video: TodayVideo | null | undefined): string[] {
  return videoKeyPoints(video?.keyPoints).filter((point) => !videoReasonLooksInternal(point)).slice(0, 2);
}

function publicSafetyNote(value: string | null | undefined, pillar: PreventionPillar | null | undefined, language?: string | null): string {
  const note = cleanVideoInsightText(value);
  return note && !videoReasonLooksInternal(note)
    ? note
    : publicVideoCopy(language, pillar, PUBLIC_VIDEO_FIT_NOTES);
}

function publicAfterWatchAction(video: TodayVideo | null | undefined, action: CompanionAction, pillar: PreventionPillar | null | undefined, language?: string | null): string {
  const afterWatch = cleanVideoInsightText(video?.afterWatchAction);
  if (afterWatch && !videoReasonLooksInternal(afterWatch)) return afterWatch;
  const takeaway = cleanVideoInsightText(video?.seniorTakeaway);
  if (takeaway && !videoReasonLooksInternal(takeaway)) return takeaway;
  const detail = cleanVideoInsightText(action.detail);
  return detail && !videoReasonLooksInternal(detail) ? detail : publicVideoCopy(language ?? video?.language, pillar, PUBLIC_VIDEO_REASONS);
}

function cleanVideoList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? cleanVideoInsightText(item) : "")).filter(Boolean)
    : [];
}

function publicVideoList(value: unknown): string[] {
  return cleanVideoList(value).filter((item) => !videoReasonLooksInternal(item)).slice(0, 2);
}

function videoKeyPoints(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? cleanVideoInsightText(item) : "")).filter(Boolean).slice(0, 3)
    : [];
}

function videoWithInsights(video: TodayVideo): TodayVideo {
  const fallback = VIDEO_INSIGHTS_BY_ID[video.videoId];
  const keyPoints = videoKeyPoints(video.keyPoints);
  return {
    ...video,
    transcriptStatus: video.transcriptStatus ?? fallback?.transcriptStatus ?? "pending",
    keyPoints: keyPoints.length ? keyPoints : fallback?.keyPoints ?? [],
    seniorTakeaway: cleanVideoInsightText(video.seniorTakeaway) || fallback?.seniorTakeaway || video.summary || video.selectedReason,
    transcriptSummary: cleanVideoInsightText(video.transcriptSummary) || fallback?.transcriptSummary || cleanVideoInsightText(video.summary),
    afterWatchAction: cleanVideoInsightText(video.afterWatchAction) || fallback?.afterWatchAction || fallback?.seniorTakeaway || video.seniorTakeaway || video.summary || video.selectedReason,
    goodFor: cleanVideoList(video.goodFor).length ? cleanVideoList(video.goodFor) : fallback?.goodFor ?? [],
    notFor: cleanVideoList(video.notFor).length ? cleanVideoList(video.notFor) : fallback?.notFor ?? [],
    momentFit: Array.isArray(video.momentFit) && video.momentFit.every(isLongevityMoment) ? video.momentFit : fallback?.momentFit ?? [],
  };
}

function normalizeVideoLanguage(value?: string | null): string {
  const normalized = String(value ?? "en").trim().toLowerCase().slice(0, 2);
  return PILLAR_VIDEO_LIBRARY_BY_LANGUAGE[normalized] ? normalized : "en";
}

function videoForPillar(pillar: PreventionPillar, language?: string | null): TodayVideo {
  const normalized = normalizeVideoLanguage(language);
  return videoWithInsights(PILLAR_VIDEO_LIBRARY_BY_LANGUAGE[normalized]?.[pillar] ?? EN_PILLAR_VIDEO_LIBRARY[pillar]);
}

function videoMatchesLanguage(video: TodayVideo | null | undefined, language?: string | null): boolean {
  return Boolean(video && normalizeVideoLanguage(video.language) === normalizeVideoLanguage(language));
}

function reviewedVideoById(videoId: string): TodayVideo | null {
  for (const library of Object.values(PILLAR_VIDEO_LIBRARY_BY_LANGUAGE)) {
    const match = Object.values(library).find((video) => video.videoId === videoId);
    if (match) return videoWithInsights(match);
  }
  return null;
}

function upperFirst(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function lowerFirst(value: string): string {
  return value ? value[0].toLowerCase() + value.slice(1) : value;
}

function isPillarStatus(value: unknown): value is PreventionPillarStatus {
  return typeof value === "string" && value in STATUS;
}

function isPillar(value: unknown): value is PreventionPillar {
  return typeof value === "string" && PILLARS.some((pillar) => pillar.id === value);
}

function normalizePillarStatusResponse(value: unknown): PillarStatusResponse {
  const statuses: Partial<Record<PreventionPillar, PreventionPillarStatus>> = {};
  const data = value && typeof value === "object"
    ? value as { statuses?: Record<string, unknown>; priority_pillar?: unknown }
    : {};

  for (const pillar of PILLARS) {
    const status = data.statuses?.[pillar.id];
    if (isPillarStatus(status)) statuses[pillar.id] = status;
  }

  return {
    statuses,
    priority_pillar: isPillar(data.priority_pillar) ? data.priority_pillar : null,
  };
}

function isInternalResourceUrl(url: string): boolean {
  return url.startsWith("/");
}

function defaultResourceForPillar(pillar: PreventionPillar | null): { label: string; url: string } | null {
  if (pillar === "heart") return { label: "Nearby walking ideas", url: RESOURCE_URLS.communityWalking };
  if (pillar === "brain") return { label: "Brain Coach", url: "/mind" };
  if (pillar === "strength") return { label: "NIA exercise videos", url: RESOURCE_URLS.niaExerciseVideos };
  if (pillar === "nourishment") return { label: "NIA food guide", url: RESOURCE_URLS.niaFood };
  if (pillar === "calm") return { label: "NIA sleep guide", url: RESOURCE_URLS.niaSleep };
  return null;
}

type AppActivityCta = {
  label: string;
  route: string;
};

const APP_ACTIVITY_ROUTES_BY_PILLAR: Partial<Record<PreventionPillar, string>> = {
  heart: "/social-rooms/morning-movement/exercises/tai-chi",
  brain: "/memory-games",
  strength: "/social-rooms/morning-movement/exercises/seated-strength",
  calm: "/games/breath-garden",
};

function appActivityCtaForPillar(pillar: PreventionPillar | null | undefined, copy: LongevityCopy): AppActivityCta | null {
  if (!pillar) return null;
  const route = APP_ACTIVITY_ROUTES_BY_PILLAR[pillar];
  const label = copy.activityCtaLabels[pillar];
  return route && label ? { route, label } : null;
}

function actionDestination(action: CompanionAction): { label: string; url: string } | null {
  if (action.resource_url) {
    return {
      label: action.resource_label || (action.resource_url.match(/(?:youtube\.com|youtu\.be|vimeo\.com)/i) ? "Visual guide" : "Useful link"),
      url: action.resource_url,
    };
  }
  if (action.route) {
    return { label: action.pillar === "brain" ? "Brain Coach" : "Open step", url: action.route };
  }
  return null;
}

function withoutMonthlySuffix(value: string): string {
  return value.trim().replace(/\s+this month[.!]?$/i, "").replace(/[.!?]+$/, "");
}

function actionKeyFor(pillar: PreventionPillar | null, title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
  return `${pillar ?? "general"}:${slug || "action"}`;
}

function personalisedHeadline(firstName: string, intervention: string | null, priorityLabel: string | null): string {
  const action = intervention
    ? withoutMonthlySuffix(intervention)
    : priorityLabel
      ? "Focus on " + priorityLabel.toLowerCase()
      : "Begin with one practical step";
  return firstName ? firstName + ", " + lowerFirst(action) : upperFirst(action);
}

function personalisedNarrative(narrative: string | null, firstName: string): string | null {
  if (!narrative || !firstName) return narrative;
  return narrative.replace(/^[^,]+(?=,\s*this month\b)/i, firstName);
}

function pillarStatus(
  plan: PreventionPlanData,
  pillarId: PreventionPillar,
  liveStatuses?: Partial<Record<PreventionPillar, PreventionPillarStatus>>,
): PreventionPillarStatus {
  if (liveStatuses?.[pillarId]) return liveStatuses[pillarId];
  const key = ("pillar_" + pillarId) as keyof PreventionPlanData;
  return plan[key] as PreventionPillarStatus;
}

function resolvePriorityDefinition(
  plan: PreventionPlanData,
  livePriority?: PreventionPillar | null,
  liveStatuses?: Partial<Record<PreventionPillar, PreventionPillarStatus>>,
): PillarDefinition | null {
  const priority = livePriority ?? plan.priority_pillar;
  const apiPriority = priority
    ? PILLARS.find((pillar) => pillar.id === priority) ?? null
    : null;
  if (apiPriority) return apiPriority;
  return [...PILLARS].sort((a, b) => PRIORITY_STATUS_RANK[pillarStatus(plan, b.id, liveStatuses)] - PRIORITY_STATUS_RANK[pillarStatus(plan, a.id, liveStatuses)])[0] ?? null;
}

function buildPreviewCompanion(plan: PreventionPlanData, firstName: string, language = "en", momentOverride: LongevityMoment = "afternoon"): CompanionPayload {
  const previewLanguage = normalizeVideoLanguage(language);
  const copy = longevityCopyForLanguage(previewLanguage);
  const activeMoment = momentOverride;
  const activeMomentDetails = LONGEVITY_MOMENT_DETAILS[activeMoment];
  const activeMomentPillar = PREVIEW_MOMENT_PILLARS[activeMoment];
  const activeMomentCopy = previewMomentCopyForLanguage(previewLanguage)[activeMoment];
  const activeMomentLabel = copy.moments[activeMoment] ?? activeMomentDetails.label;
  const activeMomentPillarLabel = copy.pillarLabels[activeMomentPillar];
  const previewProgramStep = previewProgramStepForLanguage(previewLanguage);
  const previewProgramVideo = videoForPillar(previewProgramStep.pillar, previewLanguage);
  const previewTodayVideo = videoForPillar(activeMomentPillar, previewLanguage);
  const previewActiveProgram: ActiveProgram = { ...PREVIEW_ACTIVE_PROGRAM, language: previewLanguage };
  const priorityDefinition = resolvePriorityDefinition(plan);
  const priorityPillar = priorityDefinition?.id ?? "brain";
  const whyToday = `${activeMomentLabel}: ${activeMomentCopy.evidence}`;
  const actionFromContent = (pillar: PreventionPillar, content: DailyContentItem): CompanionAction => ({
    action_key: actionKeyFor(pillar, content.title),
    content_id: content.id,
    content_type: content.content_type,
    timing_guidance: content.timing_guidance ?? null,
    title: content.title,
    detail: content.description,
    pillar,
    route: content.source_url?.startsWith("/") ? content.source_url : routeForPillarAction(pillar, content.title),
    resource_label: videoForPillar(pillar, previewLanguage).channel ?? content.source_label,
    resource_url: videoForPillar(pillar, previewLanguage).url,
    resource_title: videoForPillar(pillar, previewLanguage).title,
    duration_seconds: videoForPillar(pillar, previewLanguage).durationSeconds,
    safety_notes: videoForPillar(pillar, previewLanguage).safetyNotes ?? content.safety_notes ?? null,
    prompt: `Help me with today's ${pillar} step: ${content.title}.`,
    source: "daily_content",
  });
  const pillarActions = Object.fromEntries(PILLARS.map((pillar) => {
    const content = PREVIEW_DAILY_CONTENT.byPillar?.[pillar.id]?.[0];
    const fallbackTitle = plan.recommendations[pillar.id]?.[0]?.action ?? `Choose one ${pillar.shortLabel.toLowerCase()} step`;
    const fallbackDetail = plan.recommendations[pillar.id]?.[0]?.why ?? "One small step is enough today.";
    const fallbackVideo = videoForPillar(pillar.id, previewLanguage);
    return [pillar.id, content
      ? actionFromContent(pillar.id, content)
      : {
        action_key: actionKeyFor(pillar.id, fallbackTitle),
        title: fallbackTitle,
        detail: fallbackDetail,
        pillar: pillar.id,
        route: null,
        resource_label: fallbackVideo.channel ?? defaultResourceForPillar(pillar.id)?.label ?? null,
        resource_url: fallbackVideo.url,
        resource_title: fallbackVideo.title,
        duration_seconds: fallbackVideo.durationSeconds,
        safety_notes: fallbackVideo.safetyNotes ?? null,
        prompt: `Help me with today's ${pillar.label} step: ${fallbackTitle}.`,
        source: "fallback" as const,
      }];
  })) as Record<PreventionPillar, CompanionAction>;
  const previewGameOptions: BrainGameOption[] = [
    {
      id: "memory_lane",
      label: "Memory",
      title: "3-2-1 memory lane",
      kind: "memory_prompt",
      prompt: PREVIEW_PROGRAM_STEP.actionDetail,
      hint: "Use a place you know well, such as your kitchen, a favorite street, or a holiday spot.",
      answer: null,
      followUp: "This uses personal memory and storytelling, not a score.",
    },
    {
      id: "word_chain",
      label: "Words",
      title: "Word chain",
      kind: "word_chain",
      prompt: "Start with garden. Say five connected words without stopping.",
      hint: "Try: garden, flower, colour, painting, gallery. Your chain can be different.",
      answer: null,
      followUp: "Word chains train flexible thinking without needing a long session.",
    },
    {
      id: "riddle",
      label: "Riddle",
      title: "Quick riddle",
      kind: "riddle",
      prompt: "I hold stories without a shelf and open when someone asks the right question. What am I?",
      hint: "It is something your brain uses every day.",
      answer: "memory",
      followUp: "A tiny riddle gives the day a clear start and finish.",
    },
    {
      id: "chess_scan",
      label: "Chess",
      title: "Chess scan",
      kind: "chess_puzzle",
      prompt: "Before a move, name one piece that is protected and one piece that is open.",
      hint: "A protected piece has another piece that could respond if it is taken.",
      answer: null,
      followUp: "This is a gentle planning puzzle, not a timed match.",
    },
  ];
  const programPrimaryAction: CompanionAction = {
    action_key: `program:${previewActiveProgram.id}:${previewProgramStep.dayIndex}:${actionKeyFor(previewProgramStep.pillar, previewProgramStep.actionTitle)}`,
    content_id: previewProgramStep.id,
    title: previewProgramStep.actionTitle,
    detail: "This uses personal memory and storytelling, not a score.",
    pillar: previewProgramStep.pillar,
    route: null,
    prompt: `${copy.askVyva}: ${previewProgramStep.actionTitle}. ${copy.experienceLabels.video}: ${previewProgramVideo.title}.`,
    source: "program",
    challenge: {
      kind: "memory_prompt",
      prompt: previewProgramStep.actionDetail,
      hint: "Use a place you know well, such as your kitchen, a favorite street, or a holiday spot.",
      answer: null,
      followUp: "This uses personal memory and storytelling, not a score.",
    },
    gameOptions: previewGameOptions,
  };
  const primaryAction = activeMomentPillar === previewProgramStep.pillar ? programPrimaryAction : pillarActions[activeMomentPillar];
  const supportAction = PILLARS.map((pillar) => pillarActions[pillar.id]).find((action) => action.pillar !== activeMomentPillar) ?? pillarActions.heart;
  const signalsUsed: CompanionSignal[] = [
    {
      id: "preview-brain",
      label: "Brain Coach",
      detail: "No recent Brain Coach sessions are logged in this preview.",
      source: "brain",
      pillar: "brain",
      tone: "attention",
    },
    {
      id: "preview-checkins",
      label: "Check-ins",
      detail: "Recent check-ins are available for context.",
      source: "check-in",
      pillar: "calm",
      tone: "steady",
    },
  ];
  const optionalChoices = PILLARS
    .map((pillar) => pillarActions[pillar.id])
    .filter((action) => action.pillar !== activeMomentPillar)
    .slice(0, 2);
  const todayTimeline: TimelineItem[] = LONGEVITY_MOMENTS.map((moment) => {
    const pillar = PREVIEW_MOMENT_PILLARS[moment];
    const video = videoForPillar(pillar, previewLanguage);
    const details = LONGEVITY_MOMENT_DETAILS[moment];
    return {
      moment,
      label: copy.moments[moment] ?? details.label,
      status: statusForMoment(moment, activeMoment),
      startsAt: details.startsAt,
      title: video.title,
      reason: video.selectedReason,
      pillar,
      kind: "video",
    };
  });
  const nextMoment = nextLongevityMoment(activeMoment);
  const nextMomentPreview = todayTimeline.find((item) => item.moment === nextMoment) ?? null;
  const dailySession: DailySession = {
    sessionFocus: firstName ? `${firstName}, ${activeMomentCopy.focus}.` : `${upperFirst(activeMomentCopy.focus)}.`,
    primaryExperience: {
      kind: "video",
      title: previewTodayVideo.title,
      detail: previewTodayVideo.selectedReason,
      pillar: activeMomentPillar,
      ctaLabel: copy.watch,
      action: primaryAction,
      video: previewTodayVideo,
    },
    companionAction: primaryAction,
    optionalChoices,
    coveredPillars: coveredPillarsFromActions(plan, pillarActions).map((pillar) => ({
      ...pillar,
      evidence: pillar.pillar === "brain"
        ? signalsUsed[0].detail
        : pillar.evidence,
    })),
    whyThis: {
      summary: whyToday,
      evidence: [
        activeMomentCopy.evidence,
        `${copy.currentTheme}: ${activeMomentPillarLabel ?? activeMomentPillar}.`,
        `${copy.experienceLabels.video}: ${previewTodayVideo.title}.`,
        `${copy.programDay} ${previewProgramStep.dayIndex}: ${previewProgramStep.theme}.`,
      ],
    },
  };
  const currentMomentSession: MomentSession = {
    ...dailySession,
    moment: activeMoment,
    label: activeMomentLabel,
    status: "now",
    startsAt: activeMomentDetails.startsAt,
  };

  return {
    plan,
    activeProgram: previewActiveProgram,
    todayProgramStep: previewProgramStep,
    todayVideo: previewTodayVideo,
    videoCurationStatus: "fallback",
    todayFocus: {
      pillar: activeMomentPillar ?? priorityPillar,
      label: activeMomentPillarLabel ?? priorityDefinition?.label ?? copy.title,
      headline: firstName ? `${firstName}, ${activeMomentCopy.focus}` : upperFirst(activeMomentCopy.focus),
      summary: previewTodayVideo.selectedReason,
    },
    activeMoment,
    todayTimeline,
    currentMomentSession,
    nextMomentPreview: nextMomentPreview ? { ...nextMomentPreview, status: "later" } : null,
    whyToday,
    dailySession,
    primaryAction,
    supportAction,
    pillarActions,
    careSummary: {
      title: `Longevity summary for ${firstName || "this user"}`,
      bullets: [
        `${copy.programDay} ${previewProgramStep.dayIndex}: ${previewProgramStep.theme}.`,
        `${copy.videoPrefix}: ${previewTodayVideo.title}.`,
        `${copy.experienceLabels.support}: ${primaryAction.title}.`,
        `${copy.vyvaConsidered}: ${PILLARS.map((pillar) => copy.pillarLabels[pillar.id]).join("; ")}.`,
        signalsUsed[0].detail,
      ],
      share_text: [
        `Longevity summary for ${firstName || "this user"}`,
        `- ${copy.programDay} ${previewProgramStep.dayIndex}: ${previewProgramStep.theme}.`,
        `- ${copy.videoPrefix}: ${previewTodayVideo.title}.`,
        `- ${copy.experienceLabels.support}: ${primaryAction.title}.`,
        `- ${copy.vyvaConsidered}: ${PILLARS.map((pillar) => copy.pillarLabels[pillar.id]).join("; ")}.`,
      ].join("\n"),
    },
    signalsUsed,
    dailyContent: PREVIEW_DAILY_CONTENT,
    feedbackHistory: [],
  };
}

function usePreventionCompanion(userId: string, language?: string | null) {
  const queryLanguage = normalizeVideoLanguage(language);
  return useQuery<CompanionPayload>({
    queryKey: ["prevention-companion", userId, queryLanguage],
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const response = await apiFetch("/api/prevention/companion/" + encodeURIComponent(userId));
      if (!response.ok) throw new Error("Could not load the longevity companion plan");
      return response.json();
    },
  });
}

function usePillarStatus(userId: string) {
  return useQuery<PillarStatusResponse>({
    queryKey: ["prevention-pillar-status", userId],
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      const response = await apiFetch("/api/prevention/pillar-status/" + encodeURIComponent(userId));
      if (!response.ok) throw new Error("Could not load live longevity status");
      return normalizePillarStatusResponse(await response.json());
    },
  });
}

function useLongevityMomentBoundaryRefresh(
  enabled: boolean,
  timezone: string | null | undefined,
  activeMoment: LongevityMoment | null | undefined,
  refetch: () => unknown,
) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const currentMoment = longevityMomentForDate(timezone);
    const delay = activeMoment && activeMoment !== currentMoment
      ? 1000
      : millisecondsUntilNextLongevityMoment(timezone);
    const timeout = window.setTimeout(() => {
      void refetch();
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [activeMoment, enabled, refetch, timezone]);
}

function statusClass(tone: "success" | "steady" | "warning", isDark: boolean): string {
  if (tone === "success") return isDark ? "bg-[#123D31] text-[#72E1B3]" : "bg-[#E4F7EF] text-[#0A7653]";
  if (tone === "warning") return isDark ? "bg-[#4A3618] text-[#FFC65A]" : "bg-[#FFF0D2] text-[#9A5A00]";
  return isDark ? "bg-white/[0.08] text-[#D9CFE3]" : "bg-[#F2EDF4] text-[#6E6175]";
}

function movementExerciseRouteForTitle(title: string): string | null {
  const text = title.toLowerCase();
  const movementRoutes: Array<[string[], string]> = [
    [["chair yoga"], "/social-rooms/morning-movement/exercises/chair-yoga"],
    [["tai chi", "tai-chi"], "/social-rooms/morning-movement/exercises/tai-chi"],
    [["seated strength", "chair strength", "chair exercises"], "/social-rooms/morning-movement/exercises/seated-strength"],
    [["calm breathing"], "/social-rooms/morning-movement/exercises/calm-breathing"],
    [["sit-to-stand", "sit to stand"], "/social-rooms/morning-movement/exercises/sit-to-stand"],
    [["heel raises"], "/social-rooms/morning-movement/exercises/heel-raises"],
    [["wall push-ups", "wall pushups"], "/social-rooms/morning-movement/exercises/wall-push-ups"],
    [["ankle mobility"], "/social-rooms/morning-movement/exercises/ankle-mobility"],
    [["chest opener"], "/social-rooms/morning-movement/exercises/chest-opener"],
    [["side steps"], "/social-rooms/morning-movement/exercises/side-steps"],
    [["hand breathing"], "/social-rooms/morning-movement/exercises/hand-breathing"],
    [["shoulder release"], "/social-rooms/morning-movement/exercises/shoulder-release"],
  ];
  return movementRoutes.find(([matches]) => matches.some((match) => text.includes(match)))?.[1] ?? null;
}

function routeForPillarAction(pillar: PreventionPillar, title: string): string | null {
  const text = title.toLowerCase();
  const movementRoute = movementExerciseRouteForTitle(title);
  if (movementRoute) return movementRoute;
  if (text.includes("walking path") || text.includes("clear route") || text.includes("remove obstacles")) {
    return "/social-rooms/walking-route?source=longevity&intent=clear-walking-path";
  }
  if (pillar === "brain") {
    if (text.includes("word")) return "/memory-games/word_recall";
    if (text.includes("challenge") || text.includes("game") || text.includes("memory")) return "/memory-games";
    return "/mind";
  }
  if (text.includes("brain coach")) return "/mind";
  if (pillar === "calm" || text.includes("breath")) return "/games/breath-garden";
  if (pillar === "heart" && (text.includes("nearby") || text.includes("outing") || text.includes("activity") || text.includes("social"))) return RESOURCE_URLS.communityWalking;
  if (pillar === "heart" && (text.includes("movement") || text.includes("exercise") || text.includes("walk"))) return "/social-rooms/morning-movement/exercises/tai-chi";
  if (pillar === "strength" || text.includes("walk") || text.includes("chair")) return "/health/exercises/gentle-walk";
  if (text.includes("medicine") || text.includes("medication")) return "/health/medications";
  return null;
}

function previewRouteForAction(action: CompanionAction, fallbackUrl = ""): string | null {
  const route = action.route ?? fallbackUrl;
  const resourceUrl = action.resource_url ?? fallbackUrl;
  if (route.startsWith("/social-rooms/walking-route") || resourceUrl.startsWith("/social-rooms/walking-route")) {
    const query = (route || resourceUrl).split("?")[1];
    return `/dev/social-rooms/walking-route${query ? `?${query}` : ""}`;
  }
  if (route.startsWith("/social-rooms/morning-movement/exercises/") || resourceUrl.startsWith("/social-rooms/morning-movement/exercises/")) {
    const exerciseRoute = route.startsWith("/social-rooms/morning-movement/exercises/") ? route : resourceUrl;
    return `/dev${exerciseRoute}`;
  }
  if (route.startsWith("/social-rooms/activities") || resourceUrl.startsWith("/social-rooms/activities")) return "/dev/home-master/community";
  if (route === "/mind" || action.pillar === "brain") return "/dev/home-master/brain";
  if (route === "/games/breath-garden" || action.pillar === "calm") return "/dev/breath-garden";
  if (route === "/health/medications") return "/dev/home-master/medicines";
  return null;
}

function fallbackActionForPillar(plan: PreventionPlanData, pillar: PreventionPillar): CompanionAction {
  const recommendation = plan.recommendations[pillar]?.[0];
  const pillarLabel = PILLARS.find((item) => item.id === pillar)?.shortLabel.toLowerCase() ?? "wellbeing";
  const title = recommendation?.action ?? `Choose one ${pillarLabel} step`;
  const detail = recommendation?.why ?? "One small step is enough today.";
  const resource = defaultResourceForPillar(pillar);
  return {
    action_key: actionKeyFor(pillar, title),
    title,
    detail,
    pillar,
    route: routeForPillarAction(pillar, title),
    resource_label: resource?.label ?? null,
    resource_url: resource?.url ?? null,
    prompt: `Help me with today's longevity step: ${title}.`,
    source: "fallback",
  };
}

function resolvePillarActions(companion: CompanionPayload, plan: PreventionPlanData): Record<PreventionPillar, CompanionAction> {
  return Object.fromEntries(PILLARS.map((pillar) => [
    pillar.id,
    companion.pillarActions?.[pillar.id]
      ?? (companion.primaryAction.pillar === pillar.id ? companion.primaryAction : null)
      ?? (companion.supportAction.pillar === pillar.id ? companion.supportAction : null)
      ?? fallbackActionForPillar(plan, pillar.id),
  ])) as Record<PreventionPillar, CompanionAction>;
}

function actionCategory(action: CompanionAction): DailyExperienceKind | "connection" {
  const text = `${action.title} ${action.detail} ${action.route ?? ""}`.toLowerCase();
  if (text.includes("youtube.com/watch") || text.includes("youtu.be/")) return "video";
  if (text.includes("memory-games") || text.includes("riddle") || text.includes("chess") || text.includes("word recall") || text.includes("memory lane") || text.includes("memory challenge") || (action.pillar === "brain" && text.includes("memory"))) return "brain_game";
  if (text.includes("morning-movement") || text.includes("tai chi") || text.includes("chair yoga") || text.includes("seated strength") || text.includes("chest opener") || text.includes("ankle mobility") || text.includes("side steps")) return "movement";
  if (text.includes("walking-route") || text.includes("walking path") || text.includes("clear route") || text.includes("remove obstacles")) return "walking_route";
  if (text.includes("protein") || text.includes("meal") || text.includes("food") || text.includes("water") || action.pillar === "nourishment") return "food";
  if (text.includes("breath") || text.includes("calm") || text.includes("wind-down") || action.pillar === "calm") return "calm";
  if (text.includes("call someone") || text.includes("social") || text.includes("conversation")) return "connection";
  return "support";
}

function isNearDuplicateAction(a: CompanionAction, b: CompanionAction): boolean {
  if (a.action_key === b.action_key) return true;
  if (a.title.trim().toLowerCase() === b.title.trim().toLowerCase()) return true;
  const aCategory = actionCategory(a);
  const bCategory = actionCategory(b);
  return aCategory !== "support" && aCategory === bCategory;
}

function ctaLabelForExperience(kind: DailyExperienceKind, copy = LONGEVITY_COPY.en): string {
  return copy.ctaLabels[kind];
}

function dailyContentTypeLabel(type?: DailyContentType | null, copy = LONGEVITY_COPY.en): string | null {
  if (!type) return null;
  return copy.contentTypes[type];
}

function localizedTimingGuidance(value: string | null | undefined, copy = LONGEVITY_COPY.en): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase().replace(/\.$/, "");
  const momentByTiming: Partial<Record<string, LongevityMoment>> = {
    morning: "morning",
    midday: "midday",
    afternoon: "afternoon",
    evening: "evening",
  };
  const moment = momentByTiming[normalized];
  if (moment) return copy.moments[moment];

  if (copy !== LONGEVITY_COPY.en && /\b(morning|breakfast|midday|lunch|afternoon|outing|evening|bedtime|tonight|before|after)\b/i.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function timingMetaLabel(action: CompanionAction, copy = LONGEVITY_COPY.en): string | null {
  return [dailyContentTypeLabel(action.content_type, copy), localizedTimingGuidance(action.timing_guidance, copy)].filter(Boolean).join(" · ") || null;
}

function experienceKindForAction(action: CompanionAction, video: TodayVideo | null): DailyExperienceKind {
  if (video) return "video";
  const category = actionCategory(action);
  return category === "connection" ? "support" : category;
}

function labelForExperienceKind(kind: DailyExperienceKind, copy = LONGEVITY_COPY.en): string {
  return copy.experienceLabels[kind];
}

function coveredPillarsFromActions(plan: PreventionPlanData, pillarActions: Record<PreventionPillar, CompanionAction>): CoveredPillar[] {
  return PILLARS.map((pillar) => ({
    pillar: pillar.id,
    label: pillar.label,
    status: pillarStatus(plan, pillar.id),
    actionTitle: pillarActions[pillar.id].title,
    reason: pillarActions[pillar.id].detail,
    evidence: `${pillar.label} is part of this monthly plan.`,
  }));
}

function fallbackDailySession(
  companion: CompanionPayload,
  plan: PreventionPlanData,
  firstName: string,
  pillarActions: Record<PreventionPillar, CompanionAction>,
): DailySession {
  const video = exactYoutubeUrl(companion.todayVideo?.url) ? companion.todayVideo : null;
  const primaryAction = companion.primaryAction ?? fallbackActionForPillar(plan, companion.todayFocus.pillar ?? "brain");
  const kind = experienceKindForAction(primaryAction, video);
  const optionalChoices = Object.values(pillarActions)
    .filter((action) => !isNearDuplicateAction(action, primaryAction))
    .slice(0, 2);
  return {
    sessionFocus: companion.todayFocus.headline || personalisedHeadline(firstName, plan.priority_intervention, companion.todayFocus.label),
    primaryExperience: {
      kind,
      title: video?.title ?? primaryAction.title,
      detail: video?.selectedReason ?? primaryAction.detail,
      pillar: primaryAction.pillar,
      ctaLabel: ctaLabelForExperience(kind),
      action: primaryAction,
      video,
    },
    companionAction: video ? primaryAction : companion.supportAction ?? optionalChoices[0] ?? primaryAction,
    optionalChoices,
    coveredPillars: coveredPillarsFromActions(plan, pillarActions),
    whyThis: {
      summary: companion.whyToday,
      evidence: companion.signalsUsed.slice(0, 4).map((signal) => `${signal.label}: ${signal.detail}`),
    },
  };
}

function exactYoutubeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if ((host === "youtube.com" || host === "m.youtube.com") && url.pathname === "/watch") {
      const videoId = url.searchParams.get("v");
      return videoId && /^[A-Za-z0-9_-]{6,}$/.test(videoId) ? `https://www.youtube.com/watch?v=${videoId}` : null;
    }
    if (host === "youtu.be") {
      const videoId = url.pathname.replace(/^\//, "").split("/")[0];
      return videoId && /^[A-Za-z0-9_-]{6,}$/.test(videoId) ? `https://www.youtube.com/watch?v=${videoId}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function youtubeVideoId(value: string | null | undefined): string | null {
  const exactUrl = exactYoutubeUrl(value);
  if (!exactUrl) return null;
  try {
    return new URL(exactUrl).searchParams.get("v");
  } catch {
    return null;
  }
}

function videoFromAction(action: CompanionAction, language?: string | null): TodayVideo | null {
  const exactUrl = exactYoutubeUrl(action.resource_url ?? action.route);
  const videoId = youtubeVideoId(exactUrl);
  const requestedLanguage = normalizeVideoLanguage(language);
  if (!exactUrl || !videoId) {
    const fallback = action.pillar ? videoForPillar(action.pillar, language) : null;
    return fallback
      ? videoWithInsights({
        ...fallback,
        id: action.content_id ? `${action.content_id}:video:${fallback.videoId}` : `${action.action_key}:video:${fallback.videoId}`,
        summary: action.detail || fallback.summary,
      })
      : null;
  }
  const curatedMatch = reviewedVideoById(videoId);
  if (action.pillar && !videoMatchesLanguage(curatedMatch, requestedLanguage)) {
    return videoForPillar(action.pillar, requestedLanguage);
  }
  return videoWithInsights({
    id: action.content_id ?? action.action_key,
    provider: "youtube",
    videoId,
    url: exactUrl,
    title: action.resource_title ?? curatedMatch?.title ?? action.title,
    channel: action.resource_label ?? curatedMatch?.channel ?? null,
    durationSeconds: action.duration_seconds ?? curatedMatch?.durationSeconds ?? null,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    language: curatedMatch?.language ?? requestedLanguage,
    summary: (action.detail || curatedMatch?.summary) ?? null,
    selectedReason: curatedMatch?.selectedReason ?? action.detail,
    safetyNotes: action.safety_notes ?? curatedMatch?.safetyNotes ?? "General wellness support only.",
    transcriptStatus: curatedMatch?.transcriptStatus ?? "pending",
    keyPoints: curatedMatch?.keyPoints ?? null,
    seniorTakeaway: curatedMatch?.seniorTakeaway ?? null,
  });
}

function formatDuration(seconds: number | null | undefined, copy = LONGEVITY_COPY.en): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  const totalSeconds = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  if (minutes === 0) return `${remainder} ${copy.durationSecond}`;
  if (remainder === 0) return `${minutes} ${copy.durationMinute}`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function PreventionPlanSkeleton({ isDark, copy }: { isDark: boolean; copy: LongevityCopy }) {
  return (
    <main
      className={[
        "min-h-[100svh] px-6 pb-40 pt-8",
        isDark
          ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)]"
          : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)]",
      ].join(" ")}
      aria-label={copy.loadingLabel}
    >
      <div className="mx-auto max-w-[900px] animate-pulse space-y-5">
        <div className={["h-12 rounded-2xl", isDark ? "bg-white/[0.08]" : "bg-white/80"].join(" ")} />
        <div className={["h-[290px] rounded-[32px]", isDark ? "bg-[#2B1E35]" : "bg-white"].join(" ")} />
        <div className="grid grid-cols-1 gap-4">
          {PILLARS.map((pillar) => (
            <div key={pillar.id} className={["h-[230px] rounded-[28px]", isDark ? "bg-[#2B1E35]" : "bg-white"].join(" ")} />
          ))}
        </div>
      </div>
    </main>
  );
}

export default function PreventionPlan({
  previewPlan,
  firstNameOverride,
  backPath = "/health",
  themeOverride,
  languageOverride,
  momentOverride,
}: PreventionPlanProps = {}) {
  const { user } = useAuth();
  const optionalProfile = useOptionalProfile();
  const { language: appLanguage } = useLanguage();
  const profileFirstName = optionalProfile?.firstName ?? "";
  const userPreferredLanguage = languageOverride ?? optionalProfile?.profile?.languagePreference ?? optionalProfile?.profile?.language ?? null;
  const profileLanguage = userPreferredLanguage ?? appLanguage ?? "en";
  const pageCopy = longevityCopyForLanguage(profileLanguage);
  const profileTimezone = optionalProfile?.profile?.timezone ?? null;
  const { isDark: preferredIsDark } = useHomeMasterTheme();
  const isDark = themeOverride ? themeOverride === "dark" : preferredIsDark;
  const navigate = useNavigate();
  const isPreview = Boolean(previewPlan);
  const userId = isPreview ? "" : user?.id ?? "";
  const firstName = firstNameOverride ?? profileFirstName;
  const query = usePreventionCompanion(userId, profileLanguage);
  const pillarStatusQuery = usePillarStatus(userId);
  useLongevityMomentBoundaryRefresh(!isPreview && Boolean(userId), profileTimezone, query.data?.activeMoment ?? null, query.refetch);
  const companion = previewPlan ? buildPreviewCompanion(previewPlan, firstName, profileLanguage, momentOverride) : query.data;
  const plan = companion?.plan;
  const [previewVoiceContext, setPreviewVoiceContext] = useState<{ title: string; prompt: string } | null>(null);
  const [selectedPillar, setSelectedPillar] = useState<PreventionPillar | null>(null);
  const [openedExperienceKey, setOpenedExperienceKey] = useState<string | null>(null);
  const [feedbackChoiceKey, setFeedbackChoiceKey] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  if (!previewPlan && (query.isLoading || !userId)) return <PreventionPlanSkeleton isDark={isDark} copy={pageCopy} />;

  if (query.isError || !companion || !plan) {
    return (
      <main className={[
        "min-h-[100svh] px-6 pb-40 pt-10 text-center",
        isDark
          ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)] text-[#F8F2FF]"
          : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]",
      ].join(" ")}>
        <section className={["mx-auto max-w-[680px] rounded-[30px] border p-8", isDark ? "border-white/[0.12] bg-white/[0.07]" : "border-[#EEE8F1] bg-white shadow-[0_18px_42px_rgba(80,52,109,0.08)]"].join(" ")}>
          <h1 className="font-display text-[32px] font-semibold">{pageCopy.errorTitle}</h1>
          <p className={["mt-4 font-body text-[18px] font-semibold leading-8", isDark ? "text-[#DDD3EA]" : "text-[#766C80]"].join(" ")}>{pageCopy.errorMessage}</p>
          <button type="button" onClick={() => navigate(backPath)} className="mt-7 min-h-[58px] rounded-[20px] bg-vyva-purple px-8 font-body text-[17px] font-black text-white">{pageCopy.errorButton}</button>
        </section>
      </main>
    );
  }

  const openVoicePrompt = (title: string, prompt: string) => {
    if (isPreview) {
      setPreviewVoiceContext({ title, prompt });
      return;
    }
    navigate("/chat?mode=voice&q=" + encodeURIComponent(prompt));
  };

  const openResourceUrl = (url: string, action?: CompanionAction) => {
    if (isInternalResourceUrl(url)) {
      if (isPreview) {
        const previewRoute = action
          ? previewRouteForAction({ ...action, route: url }, url)
          : previewRouteForAction({
            action_key: "preview-resource",
            title: "Preview resource",
            detail: "",
            pillar: null,
            route: url,
            prompt: "",
            source: "fallback",
          }, url);
        if (previewRoute) {
          navigate(previewRoute);
          return;
        }
      }
      navigate(url);
      return;
    }
    window.location.assign(url);
  };

  const openCompanionAction = (action: CompanionAction) => {
    const destination = actionDestination(action);
    if (destination) {
      openResourceUrl(destination.url, action);
      return;
    }
    if (isPreview) {
      openVoicePrompt(action.title, action.prompt);
      return;
    }
    openVoicePrompt(action.title, action.prompt);
  };

  const submitFeedback = async (
    action: CompanionAction,
    eventType: FeedbackEventType,
    extraContext: Record<string, unknown> = {},
  ) => {
    if (!userId) return;
    const explicitResourceId = typeof extraContext.resourceId === "string" ? extraContext.resourceId : null;
    const explicitVideoId = typeof extraContext.videoId === "string" ? extraContext.videoId : null;
    const explicitVideoUrl = typeof extraContext.videoUrl === "string" ? extraContext.videoUrl : null;
    const explicitVideoTitle = typeof extraContext.videoTitle === "string" ? extraContext.videoTitle : null;
    await apiFetch("/api/prevention/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        planId: plan.id,
        pillar: action.pillar,
        actionKey: action.action_key,
        actionTitle: action.title,
        eventType,
        barrier: typeof extraContext.barrier === "string" ? extraContext.barrier : null,
        moment: activeMoment,
        contentId: action.content_id ?? null,
        resourceId: explicitResourceId ?? primaryExperience.video?.id ?? companion.todayVideo?.id ?? null,
        sourceContext: {
          moment: activeMoment,
          currentMoment: currentMomentLabel,
          todayFocus: companion.todayFocus.label,
          whyToday: companion.whyToday,
          actionSource: action.source,
          contentId: action.content_id ?? null,
          programId: companion.activeProgram?.id ?? null,
          programKey: companion.activeProgram?.programKey ?? null,
          programDayId: companion.todayProgramStep?.id ?? null,
          programDayIndex: companion.todayProgramStep?.dayIndex ?? null,
          videoResourceId: explicitResourceId ?? companion.todayVideo?.id ?? null,
          videoId: explicitVideoId ?? companion.todayVideo?.videoId ?? null,
          videoUrl: explicitVideoUrl ?? companion.todayVideo?.url ?? null,
          videoTitle: explicitVideoTitle ?? companion.todayVideo?.title ?? null,
          ...extraContext,
        },
      }),
    }).catch((err) => console.warn("[prevention feedback]", err));
  };

  const liveStatuses = pillarStatusQuery.data?.statuses;
  const livePriority = pillarStatusQuery.data?.priority_pillar;
  const companionLanguage = userPreferredLanguage ?? companion.todayVideo?.language ?? companion.activeProgram?.language ?? appLanguage ?? "en";
  const copy = longevityCopyForLanguage(companionLanguage);
  const pillarActions = resolvePillarActions(companion, plan);
  const dailySession = companion.currentMomentSession ?? companion.dailySession ?? fallbackDailySession(companion, plan, firstName, pillarActions);
  const activeMoment = companion.activeMoment ?? dailySession.moment ?? null;
  const currentMomentLabel = activeMoment ? copy.moments[activeMoment] : companion.currentMomentSession?.label ?? dailySession.label ?? copy.now;
  const primaryExperience = dailySession.primaryExperience;
  const primaryExperienceAction = primaryExperience.action ?? companion.primaryAction;
  const mainAction = primaryExperience.kind === "video"
    ? dailySession.companionAction
    : primaryExperienceAction;
  const currentPriority = primaryExperience.pillar ?? companion.todayFocus.pillar ?? livePriority ?? null;
  const priorityDefinition = currentPriority
    ? PILLARS.find((pillar) => pillar.id === currentPriority) ?? resolvePriorityDefinition(plan, livePriority, liveStatuses)
    : resolvePriorityDefinition(plan, livePriority, liveStatuses);
  const priorityPillarId = priorityDefinition?.id ?? null;
  const priorityLabel = priorityDefinition?.label || companion.todayFocus.label || plan.priority_pillar;
  const priorityAction = mainAction ?? companion.primaryAction ?? (priorityPillarId ? pillarActions[priorityPillarId] : fallbackActionForPillar(plan, "brain"));
  const selectedPillarDefinition = selectedPillar ? PILLARS.find((pillar) => pillar.id === selectedPillar) ?? null : null;
  const selectedPillarAction = selectedPillar && selectedPillar !== priorityPillarId ? pillarActions[selectedPillar] : null;
  const heroAction = selectedPillarAction ?? priorityAction;
  const selectedPillarVideo = selectedPillarAction ? videoFromAction(selectedPillarAction, companionLanguage) : null;
  const primaryVideo = primaryExperience.video && exactYoutubeUrl(primaryExperience.video.url) && videoMatchesLanguage(primaryExperience.video, companionLanguage)
    ? videoWithInsights(primaryExperience.video)
    : null;
  const companionVideo = companion.todayVideo && exactYoutubeUrl(companion.todayVideo.url) && videoMatchesLanguage(companion.todayVideo, companionLanguage)
    ? videoWithInsights(companion.todayVideo)
    : null;
  const currentVideo = primaryVideo ?? companionVideo ?? videoFromAction(priorityAction, companionLanguage);
  const heroVideo = selectedPillarAction ? selectedPillarVideo : currentVideo;
  const heroVideoUrl = exactYoutubeUrl(heroVideo?.url);
  const heroVideoDuration = formatDuration(heroVideo?.durationSeconds, copy);
  const heroExperienceKind = experienceKindForAction(heroAction, heroVideo);
  const seniorNarrative = dailySession.whyThis.summary || companion.whyToday || personalisedNarrative(plan.plan_narrative_senior, firstName);
  const brainSpark = heroAction.challenge ?? null;
  const brainGameOptions: BrainGameOption[] = brainSpark
    ? heroAction.gameOptions?.length
      ? heroAction.gameOptions
      : [{
        id: "today",
        label: "Today",
        title: heroAction.title,
        ...brainSpark,
      }]
    : [];
  const activeBrainSpark = brainGameOptions[0] ?? brainSpark;
  const heroTimingGuidance = localizedTimingGuidance(heroAction.timing_guidance, copy);
  const heroTimingMeta = timingMetaLabel(heroAction, copy);
  const priorityActionLabel = labelForExperienceKind(heroExperienceKind, copy);
  const heroPillarDefinition = selectedPillarDefinition ?? priorityDefinition;
  const heroPillarId = heroPillarDefinition?.id ?? heroAction.pillar ?? currentPriority ?? null;
  const heroPillarLabel = heroPillarId ? copy.pillarShortLabels[heroPillarId] : companion.todayFocus.label ?? copy.experienceLabels.support;
  const heroPreview = heroPillarId ? copy.experiencePreviews[heroPillarId] : copy.experiencePreviews.brain;
  const heroActionDuration = formatDuration(heroAction.duration_seconds, copy);
  const heroTitle = heroVideo?.title ?? (heroExperienceKind === "video" ? copy.ctaLabels.video : heroAction.title);
  const heroVideoReason = heroVideo ? publicVideoReason(heroVideo, heroPillarId, companionLanguage) : "";
  const heroDetail = heroExperienceKind === "brain_game" && activeBrainSpark
    ? activeBrainSpark.prompt
    : heroVideo ? heroVideoReason : heroExperienceKind === "video" ? copy.defaultWhy : heroAction.detail;
  const heroKeyPoints = heroVideo ? publicVideoKeyPoints(heroVideo) : [];
  const heroVideoTakeaway = heroVideo ? publicVideoTakeaway(heroVideo, heroPillarId, companionLanguage) : "";
  const heroAfterWatchAction = heroVideo ? publicAfterWatchAction(heroVideo, heroAction, heroPillarId, companionLanguage) : heroAction.detail;
  const heroGoodFor = heroVideo ? publicVideoList(heroVideo.goodFor) : [];
  const heroNotFor = heroVideo ? publicVideoList(heroVideo.notFor) : [];
  const heroInsightPoints = Array.from(new Set([...heroKeyPoints, ...heroGoodFor])).slice(0, 3);
  const heroExperienceKey = `${heroAction.action_key}:${heroVideo?.videoId ?? heroExperienceKind}`;
  const hasOpenedHeroExperience = openedExperienceKey === heroExperienceKey;
  const isFeedbackChoosing = feedbackChoiceKey === heroExperienceKey;
  const heroMeta = heroVideo
    ? [heroVideo.channel, heroVideoDuration].filter(Boolean).join(" · ")
    : [heroAction.resource_label ?? heroPreview.label, heroActionDuration, heroTimingMeta].filter(Boolean).join(" · ");
  const heroCtaLabel = heroVideo ? copy.watch : heroExperienceKind === "video" ? copy.askVyva : ctaLabelForExperience(heroExperienceKind, copy);
  const rawHeroActivityCta = appActivityCtaForPillar(heroPillarId, copy);
  const heroActivityCta = rawHeroActivityCta && (heroVideo || heroAction.route !== rawHeroActivityCta.route)
    ? rawHeroActivityCta
    : null;
  const heroIcon = heroPillarDefinition?.icon ?? Sparkles;
  const heroAccent = heroPillarDefinition?.accent ?? "spark";
  const heroVisualTitle = heroAction.resource_title ?? heroPreview.title;
  const heroVisualDetail = heroAction.safety_notes ?? heroPreview.detail;
  const heroVisualChips = Array.from(new Set(
    [heroActionDuration, heroTimingGuidance, ...heroPreview.chips].filter((item): item is string => Boolean(item)),
  )).slice(0, 3);
  const primaryWhyEvidence = [
    heroPillarId ? `${copy.currentTheme}: ${copy.pillarLabels[heroPillarId]}.` : null,
    heroVideo ? `${copy.experienceLabels.video}: ${heroVideo.title}.` : null,
  ].filter((item): item is string => Boolean(item));
  const heroWhySummary = selectedPillarAction
    ? copy.selectedPillarWhy(copy.pillarLabels[heroPillarId ?? selectedPillarAction.pillar ?? "brain"] ?? heroPillarLabel, currentMomentLabel, labelForExperienceKind(heroExperienceKind, copy), heroDetail)
    : activeMoment
      ? `${currentMomentLabel}: ${copy.momentEvidence[activeMoment]}`
      : seniorNarrative;
  const heroTimingEvidence = heroTimingGuidance && !Object.values(copy.moments).includes(heroTimingGuidance)
    ? `${currentMomentLabel}: ${heroTimingGuidance}.`
    : null;
  const heroComfortEvidence = heroNotFor[0]
    ? `${copy.comfortPrefix}: ${heroNotFor[0]}`
    : `${copy.fitPrefix}: ${publicSafetyNote(heroVideo?.safetyNotes ?? heroAction.safety_notes, heroPillarId, companionLanguage)}`;
  const heroWhyEvidence = selectedPillarAction
    ? [
      heroTimingEvidence,
      heroVideo ? `${copy.videoPrefix}: ${heroVideo.title}${heroVideo.channel ? ` (${heroVideo.channel})` : ""}.` : heroAction.resource_label ? `${copy.resourcePrefix}: ${heroAction.resource_label}${heroAction.resource_title ? `, ${heroAction.resource_title}` : ""}.` : null,
      heroComfortEvidence,
    ].filter((item): item is string => Boolean(item))
    : primaryWhyEvidence.length ? primaryWhyEvidence : dailySession.whyThis.evidence;
  const openHeroVideo = () => {
    if (!heroVideo || !heroVideoUrl) return;
    setOpenedExperienceKey(heroExperienceKey);
    setFeedbackChoiceKey(null);
    setFeedbackMessage(null);
    void submitFeedback(heroAction, "opened", {
      resourceType: "video",
      openedUrl: heroVideoUrl,
      resourceId: heroVideo.id,
      videoId: heroVideo.videoId,
      videoUrl: heroVideoUrl,
      videoTitle: heroVideo.title,
      selectedPillar: heroPillarId,
    });
    window.open(heroVideoUrl, "_blank", "noopener,noreferrer");
  };

  const openHeroExperience = () => {
    setOpenedExperienceKey(heroExperienceKey);
    setFeedbackChoiceKey(null);
    setFeedbackMessage(null);
    if (heroVideo) {
      openHeroVideo();
      return;
    }
    void submitFeedback(heroAction, "opened", {
      resourceType: heroExperienceKind,
      selectedPillar: heroPillarId,
    });
    openCompanionAction(heroAction);
  };

  const openHeroActivity = () => {
    if (!heroActivityCta) return;
    void submitFeedback(heroAction, "opened", {
      resourceType: "app_activity",
      openedUrl: heroActivityCta.route,
      selectedPillar: heroPillarId,
    });
    openResourceUrl(heroActivityCta.route, {
      ...heroAction,
      title: heroActivityCta.label,
      route: heroActivityCta.route,
      resource_label: heroActivityCta.label,
      resource_url: null,
    });
  };

  const handleTryAfterWatching = () => {
    setFeedbackMessage(copy.openingSupport);
    void submitFeedback(heroAction, "opened", {
      barrier: "try_after_watching",
      afterWatching: true,
      selectedPillar: heroPillarId,
    });
    openCompanionAction(heroAction);
  };

  const handleSaveForLater = () => {
    setFeedbackMessage(copy.savedForLater);
    void submitFeedback(heroAction, "saved", {
      barrier: "save_for_later",
      afterWatching: true,
      selectedPillar: heroPillarId,
      videoId: heroVideo?.videoId ?? null,
      videoUrl: heroVideo?.url ?? null,
      videoTitle: heroVideo?.title ?? null,
    });
  };

  const handleMakeEasier = () => {
    setFeedbackMessage(copy.makingEasier);
    void submitFeedback(heroAction, "too_hard", {
      barrier: "make_easier",
      afterWatching: true,
      selectedPillar: heroPillarId,
      videoId: heroVideo?.videoId ?? null,
      videoUrl: heroVideo?.url ?? null,
      videoTitle: heroVideo?.title ?? null,
    });
    openVoicePrompt(heroAction.title, copy.makeEasierPrompt(heroAction.title, heroAfterWatchAction || heroAction.detail));
  };

  const handleFeedbackReason = (reason: VideoFeedbackReason) => {
    const eventType = FEEDBACK_REASON_EVENT_TYPE[reason];
    setFeedbackChoiceKey(null);
    setFeedbackMessage(copy.feedbackThanks);
    void submitFeedback(heroAction, eventType, {
      barrier: reason,
      feedbackReason: reason,
      selectedPillar: heroPillarId,
      videoId: heroVideo?.videoId ?? null,
      videoUrl: heroVideo?.url ?? null,
      videoTitle: heroVideo?.title ?? null,
    });
    if (reason !== "too_hard") {
      setSelectedPillar(nextPillarId(heroPillarId));
    }
  };

  const surfaceClass = isDark
    ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)] text-[#F8F2FF]"
    : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]";
  const cardClass = isDark
    ? "border-white/[0.12] bg-white/[0.07] shadow-[0_18px_48px_rgba(0,0,0,0.18)]"
    : "border-[#EEE8F1] bg-white shadow-[0_18px_42px_rgba(80,52,109,0.08)]";
  const mutedTextClass = isDark ? "text-[#D9CFE3]" : "text-[#766C80]";
  const dividerClass = isDark ? "border-white/[0.1]" : "border-[#EEE8F1]";

  return (
    <main data-testid="prevention-plan-screen" data-home-master-theme={isDark ? "dark" : "light"} className={["min-h-[100svh] w-full overflow-x-hidden px-5 pb-40 pt-6 sm:px-7 sm:pt-8", surfaceClass].join(" ")}>
      <div className="vyva-home-master-fixed-type mx-auto w-full max-w-[900px]">
        <header className="grid grid-cols-[44px_1fr_44px] items-center gap-3" data-testid="prevention-plan-topbar">
          <button type="button" onClick={() => navigate(backPath)} aria-label={copy.backLabel} className={["vyva-tap grid h-11 min-h-11 w-11 place-items-center rounded-full border", isDark ? "border-white/[0.18] bg-white/[0.07]" : "border-black/[0.05] bg-white shadow-[0_12px_28px_rgba(80,52,109,0.12)]"].join(" ")}>
            <VyvaIcon icon={ArrowLeft} size={20} strokeWidth={2.45} tone={isDark ? "inverse" : "brand"} />
          </button>
          <h1 className="truncate text-center font-display text-[24px] font-semibold tracking-[-0.03em]">{copy.title}</h1>
          <span aria-hidden="true" className="h-11 min-h-11 w-11" />
        </header>

        <section className="relative mt-6 overflow-hidden rounded-[16px] border-[0.5px] border-[#E8E0D0] border-l-4 border-l-[#F59E0B] bg-[#FFFFFF] px-5 py-5 shadow-[0_14px_34px_rgba(80,52,109,0.07)] sm:px-6 sm:py-6">
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-[#FFF7E8] ring-1 ring-inset ring-[#F6D7A4]"><VyvaIcon icon={heroIcon} accent={heroAccent} size={24} strokeWidth={2.4} tone="brand" /></span>
                <div>
                  <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#854F0B]">{currentMomentLabel}</p>
                  <p className="mt-0.5 font-body text-[12px] font-black text-[#766C80]">{priorityActionLabel}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[#FAEEDA] px-3 py-1.5 font-body text-[12px] font-black text-[#854F0B]">{heroPillarLabel}</span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(210px,0.78fr)_1fr] sm:items-center">
              {heroVideo ? (
                <button
                  type="button"
                  onClick={openHeroVideo}
                  aria-label={`${copy.watch} ${heroVideo.title}`}
                  className="group relative overflow-hidden rounded-[18px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-[18px] bg-[#F8F0FF]">
                    {heroVideo.thumbnailUrl ? (
                      <img src={heroVideo.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid h-full w-full place-items-center">
                        <VyvaIcon icon={PlayCircle} accent="spark" size={44} strokeWidth={1.8} tone="brand" />
                      </div>
                    )}
                    <span className="absolute inset-0 grid place-items-center bg-black/10">
                      <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-[#6B21A8] shadow-[0_12px_28px_rgba(0,0,0,0.2)] transition-transform group-hover:scale-105">
                        <PlayCircle size={30} strokeWidth={2.2} />
                      </span>
                    </span>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openHeroExperience}
                  aria-label={`${heroCtaLabel} ${heroTitle}`}
                  className="group relative overflow-hidden rounded-[18px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
                >
                  <div className="relative min-h-[126px] overflow-hidden rounded-[18px] border border-[#F0DFC1] bg-[#FFF9EF] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-body text-[10px] font-black uppercase tracking-[0.1em] text-[#854F0B]">{heroPreview.label}</p>
                        <p className="mt-1 font-display text-[18px] font-semibold leading-5 text-[#241C30]">{heroVisualTitle}</p>
                      </div>
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-white text-[#6B21A8] ring-1 ring-inset ring-[#E9D7FF] transition-transform group-hover:scale-105">
                        <VyvaIcon icon={heroIcon} accent={heroAccent} size={22} strokeWidth={2.35} tone="brand" />
                      </span>
                    </div>
                    <p className="mt-3 max-w-[260px] font-body text-[12px] font-semibold leading-5 text-[#766C80]">{heroVisualDetail}</p>
                    {heroVisualChips.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {heroVisualChips.map((chip) => (
                          <span key={chip} className="rounded-full bg-white px-2.5 py-1 font-body text-[10px] font-black text-[#854F0B] ring-1 ring-inset ring-[#F1DFC1]">{chip}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </button>
              )}
              <div className="min-w-0">
                <h2 className="max-w-[700px] font-display text-[22px] font-medium leading-[1.16]" style={{ color: "var(--text-primary, #241C30)" }}>{heroTitle}</h2>
                {heroMeta ? <p className="mt-2 font-body text-[13px] font-black text-[#766C80]">{heroMeta}</p> : null}
                <p className="mt-3 font-body text-[16px] font-semibold leading-7" style={{ color: "var(--text-secondary, #766C80)" }}>{heroDetail}</p>
                <button type="button" onClick={openHeroExperience} className="mt-4 inline-flex h-[52px] min-h-[52px] w-full items-center justify-center gap-3 rounded-[17px] bg-[#6B21A8] px-6 font-body text-[15px] font-black text-white shadow-[0_10px_24px_rgba(107,33,168,0.16)]">
                  {heroVideo ? <ExternalLink size={18} strokeWidth={2.4} /> : <ChevronRight size={18} strokeWidth={2.5} />}
                  {heroCtaLabel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackMessage(null);
                    setFeedbackChoiceKey((current) => current === heroExperienceKey ? null : heroExperienceKey);
                  }}
                  className="mt-2 inline-flex min-h-8 items-center rounded-full px-1 font-body text-[12px] font-black text-[#6B21A8]"
                  aria-expanded={isFeedbackChoosing}
                >
                  {copy.notForMe}
                </button>
                {isFeedbackChoosing ? (
                  <div className={["mt-2 rounded-[16px] border px-3 py-3", isDark ? "border-white/[0.12] bg-white/[0.06]" : "border-[#EEE8F1] bg-[#FFFBF7]"].join(" ")}>
                    <p className="font-body text-[12px] font-black text-[#854F0B]">{copy.feedbackQuestion}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {VIDEO_FEEDBACK_REASONS.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => handleFeedbackReason(reason)}
                          className={["min-h-8 rounded-full border px-3 font-body text-[11px] font-black", isDark ? "border-white/[0.12] bg-white/[0.06] text-[#F8F2FF]" : "border-[#E6D9EC] bg-white text-[#5A4B62]"].join(" ")}
                        >
                          {copy.feedbackReasons[reason]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {hasOpenedHeroExperience ? (
                  <div className={["mt-3 rounded-[16px] border px-3 py-3", isDark ? "border-white/[0.12] bg-white/[0.06]" : "border-[#E9D7FF] bg-[#FBF7FF]"].join(" ")}>
                    <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#854F0B]">{copy.afterWatching}</p>
                    <p className={["mt-1 font-body text-[13px] font-bold leading-5", mutedTextClass].join(" ")}>{heroAfterWatchAction}</p>
                    <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                      <button type="button" onClick={handleTryAfterWatching} className="min-h-9 rounded-full bg-[#6B21A8] px-3 font-body text-[12px] font-black leading-tight text-white sm:text-[11px]">{copy.tryThisNow}</button>
                      <button type="button" onClick={handleSaveForLater} className={["min-h-9 rounded-full border px-3 font-body text-[12px] font-black leading-tight sm:text-[11px]", isDark ? "border-white/[0.14] text-[#F8F2FF]" : "border-[#DCCCE8] bg-white text-[#6B21A8]"].join(" ")}>{copy.saveForLater}</button>
                      <button type="button" onClick={handleMakeEasier} className={["min-h-9 rounded-full border px-3 font-body text-[12px] font-black leading-tight sm:text-[11px]", isDark ? "border-white/[0.14] text-[#F8F2FF]" : "border-[#DCCCE8] bg-white text-[#6B21A8]"].join(" ")}>{copy.makeEasier}</button>
                    </div>
                  </div>
                ) : null}
                {feedbackMessage ? (
                  <p className="mt-2 rounded-[14px] bg-[#EEFDF6] px-3 py-2 font-body text-[12px] font-black leading-5 text-[#047857]" role="status">{feedbackMessage}</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <nav className="mt-3" aria-label={copy.choosePillarLabel}>
          <div
            data-testid="longevity-pillar-selector-rail"
            className="-mx-2 flex snap-x gap-2 overflow-x-auto overscroll-x-contain px-2 py-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 sm:py-0"
          >
            {PILLARS.map((pillar) => {
              const isSelected = heroPillarId === pillar.id;
              const pillarLabel = copy.pillarLabels[pillar.id];
              return (
                <button
                  key={pillar.id}
                  type="button"
                  aria-label={copy.showPillarLabel(pillarLabel)}
                  aria-pressed={isSelected}
                  title={copy.showPillarLabel(pillarLabel)}
                  onClick={() => setSelectedPillar((current) => (current === pillar.id || pillar.id === priorityPillarId ? null : pillar.id))}
                  className={[
                    "inline-flex h-8 min-h-8 min-w-[88px] snap-center flex-none items-center justify-center gap-1 rounded-full border px-2 font-body text-[10px] font-black leading-none transition sm:h-9 sm:min-h-9 sm:w-full sm:min-w-0 sm:gap-1.5 sm:px-1 sm:text-[11px]",
                    isSelected
                      ? "border-[#F59E0B] bg-[#FFF7E8] text-[#854F0B] shadow-[0_8px_18px_rgba(245,158,11,0.12)]"
                      : isDark
                        ? "border-white/[0.1] bg-white/[0.05] text-[#D9CFE3]"
                        : "border-[#E9E0EB] bg-white/70 text-[#6E6175] shadow-[0_6px_14px_rgba(80,52,109,0.05)]",
                  ].join(" ")}
                >
                  <VyvaIcon icon={pillar.icon} accent={pillar.accent} size={15} strokeWidth={2.35} tone={isDark && !isSelected ? "inverse" : "brand"} />
                  <span className="min-w-0 max-w-[58px] truncate whitespace-nowrap sm:max-w-none">{copy.pillarSelectorLabels[pillar.id]}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {previewVoiceContext ? (
          <section className={["mt-4 rounded-[18px] border px-4 py-3", isDark ? "border-white/[0.12] bg-white/[0.07]" : "border-[#E8E0D0] bg-white"].join(" ")} role="status" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-[10px] font-black uppercase tracking-[0.1em] text-[#854F0B]">{copy.voiceContextReady}</p>
                <h3 className="mt-1 font-display text-[17px] font-semibold leading-5">{previewVoiceContext.title}</h3>
                <p className={["mt-1 font-body text-[13px] font-semibold leading-5", mutedTextClass].join(" ")}>{previewVoiceContext.prompt}</p>
              </div>
              <button type="button" onClick={() => setPreviewVoiceContext(null)} className={["shrink-0 rounded-full border px-3 py-1.5 font-body text-[12px] font-black", isDark ? "border-white/[0.12] text-[#D9CFE3]" : "border-[#EEE8F1] text-[#6E6175]"].join(" ")}>{copy.close}</button>
            </div>
          </section>
        ) : null}

        <section className="mt-6 space-y-4">
          <details className={["group rounded-[26px] border", cardClass].join(" ")}>
            <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-4 px-5 font-body text-[17px] font-black sm:px-6">
              <span className="flex items-center gap-3"><span className={["grid h-10 w-10 place-items-center rounded-[14px]", isDark ? "bg-[#3C2956]" : "bg-[#F1E8FF]"].join(" ")}><VyvaIcon icon={Sparkles} accent="spark" size={22} strokeWidth={2.4} tone="brand" /></span>{copy.whyThis}</span>
              <ChevronDown className="transition-transform group-open:rotate-180" size={22} />
            </summary>
            <div className={["border-t px-5 py-5 sm:px-6", dividerClass].join(" ")}>
              {heroWhySummary ? <p className={["font-body text-[16px] font-semibold leading-7", mutedTextClass].join(" ")}>{heroWhySummary}</p> : null}
              {heroVideo && (heroVideoTakeaway || heroAfterWatchAction || heroInsightPoints.length) ? (
                <div className={["rounded-[18px] border px-4 py-4", heroWhySummary ? "mt-5" : "", isDark ? "border-[#3C2956] bg-[#241936]" : "border-[#E9D7FF] bg-[#FBF7FF]"].join(" ")}>
                  <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#9D4FE0]">{copy.fromVideo}</p>
                  {heroVideoTakeaway ? <p className={["mt-2 font-body text-[15px] font-bold leading-6", isDark ? "text-[#F8F2FF]" : "text-[#241C30]"].join(" ")}>{heroVideoTakeaway}</p> : null}
                  {heroAfterWatchAction && heroAfterWatchAction !== heroVideoTakeaway ? (
                    <p className={["mt-3 rounded-[14px] px-3 py-2 font-body text-[13px] font-bold leading-5", isDark ? "bg-white/[0.06] text-[#F8F2FF]" : "bg-white text-[#4B4055]"].join(" ")}>
                      <span className="text-[#854F0B]">{copy.afterWatching}: </span>{heroAfterWatchAction}
                    </p>
                  ) : null}
                  {heroInsightPoints.length ? (
                    <ul className={["space-y-2", heroVideoTakeaway || heroAfterWatchAction ? "mt-3" : "mt-2"].join(" ")}>
                      {heroInsightPoints.map((point) => (
                        <li key={point} className={["flex items-start gap-2 font-body text-[13px] font-bold leading-5", mutedTextClass].join(" ")}>
                          <span aria-hidden="true" className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#F59E0B]" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {heroActivityCta ? (
                    <button
                      type="button"
                      onClick={openHeroActivity}
                      className={["mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border px-4 font-body text-[13px] font-black leading-tight", isDark ? "border-white/[0.14] bg-white/[0.06] text-[#F8F2FF]" : "border-[#E9D7FF] bg-white text-[#6B21A8]"].join(" ")}
                    >
                      {heroActivityCta.label}
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </button>
                  ) : null}
                </div>
              ) : null}
              {heroWhyEvidence.length > 0 ? (
                <div className={heroWhySummary || heroVideoTakeaway || heroAfterWatchAction || heroInsightPoints.length ? "mt-5" : ""}>
                  <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#9D4FE0]">{copy.vyvaConsidered}</p>
                  <ul className={["mt-2 divide-y", dividerClass].join(" ")}>
                    {heroWhyEvidence.map((item) => (
                      <li key={item} className={["flex min-h-[48px] items-center gap-3 py-2 font-body text-[14px] font-bold leading-6", mutedTextClass].join(" ")}><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#F8AE1B]" /><span>{item}</span></li>
                    ))}
                  </ul>
                </div>
              ) : <p className={[(heroWhySummary ? "mt-4 " : "") + "font-body text-[16px] font-semibold leading-7", mutedTextClass].join(" ")}>{copy.defaultWhy}</p>}
            </div>
          </details>

        </section>
      </div>
    </main>
  );
}

// TODO: Add ElevenLabs structured voice walkthroughs for each pillar.
// TODO: Show month-over-month trajectory after at least two plans exist.
// TODO: Learn from Done and Skip outcomes after at least three months.
