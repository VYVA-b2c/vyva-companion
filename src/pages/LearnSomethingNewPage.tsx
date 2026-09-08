import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  BookOpen,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  Cpu,
  Hand,
  Languages,
  Landmark,
  Leaf,
  Loader2,
  Mic,
  Music,
  Palette,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Square,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTtsReadout, type TtsSegment } from "@/hooks/useVyvaVoice";
import { useLanguage } from "@/i18n";
import { APP_WORKFLOW_REFERENCES } from "../../shared/workflowRegistry";
import { buildWorkflowReceiptMoment } from "../../shared/workflowReceiptMoments";

type LearningCategory = {
  id: string;
  slug: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
};

type LearningLesson = {
  id: string;
  categorySlug: string;
  language: string;
  title: string;
  hook: string;
  body: string;
  reflectionPrompt: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imagePrompt: string | null;
  estimatedMinutes: number;
  difficulty: string;
  tags: string[];
};

type LearningProgramItem = {
  id: string;
  programId: string;
  lessonId: string;
  programDay: number;
  scheduledDate: string;
  status: "recommended" | "saved" | "skipped" | "completed";
  completedAt: string | null;
  savedAt: string | null;
  skippedAt: string | null;
  lesson: LearningLesson | null;
};

type LearningProgram = {
  id: string;
  status: "active" | "completed" | "expired";
  interests: string[];
  pace: "gentle" | "steady" | "curious";
  frequency: "daily" | "three_times_week" | "weekly";
  durationWeeks: 1 | 4 | 12;
  dailyTime: string;
  lessonLengthMinutes: number;
  language: string;
  startDate: string;
  endDate: string;
  completedAt: string | null;
  items: LearningProgramItem[];
  progress: {
    completedCount: number;
    totalCount: number;
    allComplete: boolean;
    currentDay: number;
  };
};

type LearningTodayResponse = {
  onboardingRequired: boolean;
  categories: LearningCategory[];
  program: LearningProgram | null;
  todayItem: LearningProgramItem | null;
};

type ProgramForm = {
  learningMode: "voice" | "touch" | "both";
  interests: string[];
  pace: "gentle" | "steady" | "curious";
  frequency: "daily" | "three_times_week" | "weekly";
  durationWeeks: 1 | 4 | 12;
  dailyTime: string;
  lessonLengthMinutes: number;
};

const DEFAULT_INTEREST = "general_knowledge";
const LEARNING_MODE_STORAGE_KEY = "vyva.learning.mode";
const LESSON_READ_ALOUD_POSITION_PREFIX = "vyva.learning.read-aloud.v1";
const DEFAULT_FORM: ProgramForm = {
  learningMode: "both",
  interests: [DEFAULT_INTEREST],
  pace: "gentle",
  frequency: "three_times_week",
  durationWeeks: 4,
  dailyTime: "09:00",
  lessonLengthMinutes: 3,
};

function lessonReadAloudPositionKey(lessonId: string, language: string): string {
  return `${LESSON_READ_ALOUD_POSITION_PREFIX}:${lessonId}:${language}`;
}

function readLessonPosition(key: string | null): number {
  if (!key || typeof window === "undefined") return 0;
  const stored = Number(window.sessionStorage.getItem(key));
  return Number.isInteger(stored) && stored >= 0 ? stored : 0;
}

function saveLessonPosition(key: string | null, segmentIndex: number): void {
  if (!key || typeof window === "undefined") return;
  window.sessionStorage.setItem(key, String(Math.max(0, Math.floor(segmentIndex))));
}

function clearLessonPosition(key: string | null): void {
  if (!key || typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
}

const iconByName: Record<string, LucideIcon> = {
  atom: Atom,
  languages: Languages,
  palette: Palette,
  sparkles: Sparkles,
  music: Music,
  landmark: Landmark,
  leaf: Leaf,
  cpu: Cpu,
  "book-open": BookOpen,
};

const paceOptions: Array<{ id: ProgramForm["pace"]; label: string; description: string }> = [
  { id: "gentle", label: "Gentle", description: "One calm idea each day." },
  { id: "steady", label: "Steady", description: "A little more detail and reflection." },
  { id: "curious", label: "Curious", description: "Richer snippets for active learners." },
];

const learningModeOptions: Array<{ id: ProgramForm["learningMode"]; label: string; description: string; Icon: LucideIcon; recommended?: boolean }> = [
  { id: "voice", label: "Voice", description: "Listen and speak.", Icon: Mic },
  { id: "touch", label: "Touch", description: "Read and tap.", Icon: Hand },
  { id: "both", label: "Both", description: "Use either anytime.", Icon: Sparkles, recommended: true },
];

const frequencyOptions: Array<{ id: ProgramForm["frequency"]; label: string; description: string }> = [
  { id: "daily", label: "Daily", description: "Every day." },
  { id: "three_times_week", label: "3 times a week", description: "With rest days." },
  { id: "weekly", label: "Weekly", description: "Slow pace." },
];

const durationOptions: Array<{ id: ProgramForm["durationWeeks"]; label: string; description: string }> = [
  { id: 1, label: "1 week", description: "A quick start." },
  { id: 4, label: "1 month", description: "Build a habit." },
  { id: 12, label: "3 months", description: "A longer learning path." },
];

const wizardStepTitles = ["Mode", "Interests", "Pace", "Rhythm"] as const;

type LessonVisualScene = "rainbow" | "garden" | "music" | "history" | "language" | "technology" | "art" | "curiosity";

type LessonVisualTheme = {
  scene: LessonVisualScene;
  accent: string;
  background: string;
  ink: string;
};

function categoryIcon(category: LearningCategory) {
  return iconByName[category.icon] ?? BookOpen;
}

function categoryFor(categories: LearningCategory[], slug?: string | null) {
  return categories.find((category) => category.slug === slug) ?? categories.find((category) => category.slug === DEFAULT_INTEREST);
}

function timeLabel(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function programPeriodLabel(durationWeeks: ProgramForm["durationWeeks"]) {
  if (durationWeeks === 12) return "in 3 months";
  if (durationWeeks === 4) return "this month";
  return "this week";
}

function normalizeLearningMode(value: unknown): ProgramForm["learningMode"] {
  return value === "voice" || value === "touch" || value === "both" ? value : "both";
}

function readLearningModePreference(): ProgramForm["learningMode"] {
  if (typeof window === "undefined") return "both";
  try {
    return normalizeLearningMode(window.localStorage.getItem(LEARNING_MODE_STORAGE_KEY));
  } catch {
    return "both";
  }
}

function saveLearningModePreference(value: ProgramForm["learningMode"]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEARNING_MODE_STORAGE_KEY, value);
  } catch {
    // Local storage can be unavailable in private or locked-down browser modes.
  }
}

function learningModeLabel(value: ProgramForm["learningMode"]) {
  if (value === "voice") return "Voice";
  if (value === "touch") return "Touch";
  return "Voice + Touch";
}

function recommendedRhythmFor(form: Pick<ProgramForm, "pace" | "lessonLengthMinutes">): Pick<ProgramForm, "frequency" | "durationWeeks"> {
  const frequency = form.pace === "curious" && form.lessonLengthMinutes <= 4 ? "daily" : "three_times_week";
  return { frequency, durationWeeks: 4 };
}

function lessonCountForRhythm(form: Pick<ProgramForm, "frequency" | "durationWeeks">) {
  if (form.frequency === "weekly") return form.durationWeeks;
  if (form.frequency === "three_times_week") return form.durationWeeks * 3;
  return form.durationWeeks * 7;
}

function rhythmDaysLabel(frequency: ProgramForm["frequency"]) {
  if (frequency === "three_times_week") return "Mon/Wed/Fri";
  if (frequency === "weekly") return "Weekly";
  return "Every day";
}

function rhythmPreview(form: ProgramForm) {
  const lessonLabel = lessonCountForRhythm(form) === 1 ? "lesson" : "lessons";
  return `${lessonCountForRhythm(form)} ${lessonLabel} - ${rhythmDaysLabel(form.frequency)} - ${timeLabel(form.dailyTime)}`;
}

function isResolvedLearningItem(item: LearningProgramItem) {
  return item.status === "completed" || item.status === "skipped" || Boolean(item.completedAt) || Boolean(item.skippedAt);
}

function nextLearningItem(program: LearningProgram): LearningProgramItem | null {
  return program.items.find((item) => !isResolvedLearningItem(item)) ?? null;
}

function nextLearningLabel(item: LearningProgramItem | null, dailyTime: string) {
  if (!item) return "Plan complete";
  const todayKey = new Date().toISOString().slice(0, 10);
  const label = item.scheduledDate === todayKey
    ? "Today"
    : new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(`${item.scheduledDate}T12:00:00`));
  return `${label} at ${timeLabel(dailyTime)}`;
}

function learningInterestSummary(interests: string[], categories: LearningCategory[]) {
  const labels = interests
    .map((slug) => categoryFor(categories, slug)?.label ?? slug.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "))
    .slice(0, 2);
  return labels.length ? labels.join(" + ") : "General Knowledge";
}

function makeInitialForm(program: LearningProgram | null, learningMode: ProgramForm["learningMode"] = "both"): ProgramForm {
  if (!program) return { ...DEFAULT_FORM, learningMode };
  return {
    learningMode,
    interests: program.interests.length ? program.interests : [DEFAULT_INTEREST],
    pace: program.pace ?? "gentle",
    frequency: program.frequency ?? "daily",
    durationWeeks: program.durationWeeks ?? 1,
    dailyTime: program.dailyTime ?? "09:00",
    lessonLengthMinutes: program.lessonLengthMinutes ?? 3,
  };
}

function lessonSearchText(lesson: LearningLesson) {
  return `${lesson.title} ${lesson.hook} ${lesson.body} ${lesson.tags.join(" ")}`.toLowerCase();
}

function visualThemeFor(lesson: LearningLesson, category?: LearningCategory): LessonVisualTheme {
  const text = lessonSearchText(lesson);
  const fallbackAccent = category?.color ?? "#6D28D9";

  if (/(rainbow|light|sunlight|colour|color|weather|droplet|water)/.test(text)) {
    return {
      scene: "rainbow",
      accent: "#2563EB",
      background: "linear-gradient(135deg, #EAF7FF 0%, #FFF7D6 47%, #F5E8FF 100%)",
      ink: "#164E63",
    };
  }
  if (/(plant|leaf|tree|garden|nature|bird|flower|forest|outdoor)/.test(text)) {
    return {
      scene: "garden",
      accent: "#0F8A67",
      background: "linear-gradient(135deg, #E8FFF4 0%, #FFF8DF 100%)",
      ink: "#064E3B",
    };
  }
  if (/(music|song|sound|listen|rhythm|piano|voice)/.test(text)) {
    return {
      scene: "music",
      accent: "#7C3AED",
      background: "linear-gradient(135deg, #F3E8FF 0%, #ECFEFF 100%)",
      ink: "#3B0764",
    };
  }
  if (/(history|ancient|city|castle|museum|king|queen|war|culture)/.test(text)) {
    return {
      scene: "history",
      accent: "#B45309",
      background: "linear-gradient(135deg, #FFF7ED 0%, #F6E8D7 100%)",
      ink: "#78350F",
    };
  }
  if (/(language|word|phrase|speak|spanish|english|german|french|italian|portuguese)/.test(text)) {
    return {
      scene: "language",
      accent: "#0E7490",
      background: "linear-gradient(135deg, #ECFEFF 0%, #F7F0FF 100%)",
      ink: "#155E75",
    };
  }
  if (/(technology|computer|phone|internet|digital|machine|robot|ai)/.test(text)) {
    return {
      scene: "technology",
      accent: "#2563EB",
      background: "linear-gradient(135deg, #EFF6FF 0%, #EEF2FF 100%)",
      ink: "#1E3A8A",
    };
  }
  if (/(paint|art|artist|colour|color|picture|design|draw)/.test(text)) {
    return {
      scene: "art",
      accent: "#DB2777",
      background: "linear-gradient(135deg, #FDF2F8 0%, #FFF7ED 100%)",
      ink: "#831843",
    };
  }

  return {
    scene: "curiosity",
    accent: fallbackAccent,
    background: `linear-gradient(135deg, ${fallbackAccent}18 0%, #FFFDF8 48%, #E8F8F1 100%)`,
    ink: fallbackAccent,
  };
}

function lessonTakeaways(body: string) {
  return (body.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [body])
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function lessonTinyAction(lesson: LearningLesson, category?: LearningCategory) {
  const label = (category?.label ?? lesson.categorySlug).toLowerCase();
  if (label.includes("science")) return "Look for one everyday example of this idea today: light, water, sound, food, or a small object nearby.";
  if (label.includes("history")) return "Connect this to one object around you. Ask: who might have used something like this before me?";
  if (label.includes("language")) return "Try saying one new word from the lesson out loud once. That is enough.";
  if (label.includes("music")) return "Listen for one sound pattern today: rhythm, repetition, pause, or a change in tone.";
  if (label.includes("art")) return "Notice one color, shape, or texture near you and name what makes it interesting.";
  if (label.includes("nature")) return "Look for one small sign of this outside, from a window, or in a plant, sky, or animal nearby.";
  if (label.includes("technology")) return "Spot one quiet technology around you and wonder what small job it is doing.";
  return "Find one ordinary example of this idea today. One noticed detail is enough.";
}

function LessonScene({ scene, accent, ink }: { scene: LessonVisualScene; accent: string; ink: string }) {
  if (scene === "rainbow") {
    return (
      <svg viewBox="0 0 900 360" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="learn-rainbow" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="23%" stopColor="#F59E0B" />
            <stop offset="45%" stopColor="#FDE047" />
            <stop offset="65%" stopColor="#22C55E" />
            <stop offset="82%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <filter id="learn-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#0F172A" floodOpacity="0.12" />
          </filter>
        </defs>
        <circle cx="755" cy="78" r="46" fill="#FBBF24" opacity="0.92" />
        <path d="M74 284 C180 78 336 38 458 163 C568 274 642 268 776 118" fill="none" stroke="url(#learn-rainbow)" strokeLinecap="round" strokeWidth="44" filter="url(#learn-soft-shadow)" />
        <path d="M118 292 C222 130 338 104 430 191 C536 290 622 294 744 158" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeWidth="24" opacity="0.75" />
        <g fill="#FFFFFF" opacity="0.92">
          <ellipse cx="164" cy="94" rx="60" ry="28" />
          <ellipse cx="214" cy="91" rx="76" ry="34" />
          <ellipse cx="274" cy="106" rx="56" ry="25" />
        </g>
        <g fill={accent} opacity="0.22">
          <circle cx="168" cy="232" r="11" />
          <circle cx="222" cy="260" r="7" />
          <circle cx="696" cy="234" r="9" />
          <circle cx="744" cy="274" r="13" />
        </g>
      </svg>
    );
  }

  if (scene === "garden") {
    return (
      <svg viewBox="0 0 900 360" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M0 262 C170 198 275 294 436 230 C626 154 728 244 900 168 L900 360 L0 360 Z" fill="#BBF7D0" opacity="0.6" />
        <path d="M180 274 C236 188 310 174 356 92 C404 184 480 190 544 276" fill="none" stroke={accent} strokeWidth="18" strokeLinecap="round" />
        <ellipse cx="283" cy="178" rx="78" ry="36" fill="#34D399" opacity="0.86" transform="rotate(-24 283 178)" />
        <ellipse cx="431" cy="192" rx="84" ry="39" fill="#10B981" opacity="0.8" transform="rotate(23 431 192)" />
        <circle cx="704" cy="110" r="42" fill="#FBBF24" opacity="0.88" />
      </svg>
    );
  }

  if (scene === "music") {
    return (
      <svg viewBox="0 0 900 360" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M90 238 C194 118 298 310 404 184 C516 54 646 246 794 112" fill="none" stroke={accent} strokeWidth="20" strokeLinecap="round" opacity="0.32" />
        <g fill={accent}>
          <circle cx="254" cy="248" r="34" />
          <rect x="282" y="92" width="18" height="154" rx="9" />
          <path d="M296 92 C390 105 438 130 466 174 L466 204 C420 158 366 142 296 130 Z" opacity="0.86" />
        </g>
        <g fill={ink} opacity="0.14">
          <circle cx="636" cy="230" r="26" />
          <circle cx="708" cy="178" r="18" />
        </g>
      </svg>
    );
  }

  if (scene === "history") {
    return (
      <svg viewBox="0 0 900 360" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M138 275 L138 134 L242 134 L242 88 L334 88 L334 134 L438 134 L438 275 Z" fill="#FED7AA" stroke={accent} strokeWidth="10" />
        <path d="M498 282 C552 184 602 138 656 112 C714 152 760 204 790 282 Z" fill="#FDBA74" opacity="0.74" />
        <path d="M118 288 L820 288" stroke={ink} strokeWidth="12" strokeLinecap="round" opacity="0.22" />
      </svg>
    );
  }

  if (scene === "language") {
    return (
      <svg viewBox="0 0 900 360" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect x="144" y="82" width="256" height="150" rx="30" fill="#FFFFFF" opacity="0.86" />
        <rect x="488" y="126" width="272" height="150" rx="30" fill="#CFFAFE" opacity="0.82" />
        <path d="M232 232 L206 284 L286 232" fill="#FFFFFF" opacity="0.86" />
        <path d="M626 276 L662 316 L682 276" fill="#CFFAFE" opacity="0.82" />
        <text x="206" y="175" fill={accent} fontSize="64" fontWeight="800">Aa</text>
        <text x="548" y="218" fill={ink} fontSize="50" fontWeight="800">Hola</text>
      </svg>
    );
  }

  if (scene === "technology") {
    return (
      <svg viewBox="0 0 900 360" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect x="244" y="64" width="410" height="230" rx="42" fill="#FFFFFF" opacity="0.86" />
        <rect x="308" y="124" width="282" height="94" rx="24" fill={accent} opacity="0.16" />
        <g stroke={accent} strokeWidth="12" strokeLinecap="round" fill="none">
          <path d="M180 124 H308" />
          <path d="M590 172 H730" />
          <path d="M382 218 V302" />
          <path d="M512 64 V22" />
        </g>
        <g fill={accent}>
          <circle cx="180" cy="124" r="18" />
          <circle cx="730" cy="172" r="18" />
          <circle cx="382" cy="302" r="18" />
          <circle cx="512" cy="22" r="18" />
        </g>
      </svg>
    );
  }

  if (scene === "art") {
    return (
      <svg viewBox="0 0 900 360" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect x="150" y="74" width="250" height="210" rx="32" fill="#FFFFFF" opacity="0.88" transform="rotate(-5 150 74)" />
        <rect x="470" y="88" width="260" height="194" rx="32" fill="#FCE7F3" opacity="0.88" transform="rotate(5 470 88)" />
        <circle cx="270" cy="178" r="52" fill="#F59E0B" opacity="0.84" />
        <circle cx="576" cy="170" r="46" fill={accent} opacity="0.8" />
        <path d="M190 248 C284 204 326 294 410 238 C504 176 562 262 706 218" fill="none" stroke={ink} strokeWidth="13" strokeLinecap="round" opacity="0.3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 900 360" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <circle cx="242" cy="150" r="76" fill={accent} opacity="0.15" />
      <circle cx="664" cy="214" r="118" fill="#14B8A6" opacity="0.12" />
      <path d="M242 240 C366 92 526 88 664 214" fill="none" stroke={accent} strokeWidth="18" strokeLinecap="round" opacity="0.38" />
      <g fill={accent}>
        <circle cx="242" cy="240" r="28" />
        <circle cx="664" cy="214" r="28" />
      </g>
      <path d="M424 154 L476 122 L528 154 L508 214 H444 Z" fill="#FFFFFF" opacity="0.86" />
    </svg>
  );
}

function LessonVisual({ lesson, category }: { lesson: LearningLesson; category?: LearningCategory }) {
  const theme = visualThemeFor(lesson, category);
  const Icon = category ? categoryIcon(category) : BookOpen;

  return (
    <div
      className="relative min-h-[148px] overflow-hidden rounded-t-[22px] sm:min-h-[240px]"
      style={{ background: theme.background }}
      data-testid="learn-lesson-visual"
    >
      {lesson.imageUrl ? (
        <img
          src={lesson.imageUrl}
          alt={lesson.imageAlt || `${lesson.title} lesson image`}
          className="absolute inset-0 h-full w-full object-cover"
          data-testid="learn-lesson-image"
        />
      ) : (
        <LessonScene scene={theme.scene} accent={theme.accent} ink={theme.ink} />
      )}
      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 bg-gradient-to-t from-black/42 via-black/10 to-transparent p-3 sm:gap-3 sm:p-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-[13px] font-black text-[#271B2F] shadow-sm sm:px-4 sm:py-2 sm:text-[14px]">
          <Icon size={16} style={{ color: category?.color ?? theme.accent }} />
          {category?.label ?? "Learning"}
        </span>
        <span className="rounded-full bg-white/92 px-3 py-1.5 text-[13px] font-black text-[#6B4A12] shadow-sm sm:px-4 sm:py-2 sm:text-[14px]">
          {lesson.estimatedMinutes || 3} min
        </span>
      </div>
      <div className="absolute right-5 top-5 hidden h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-[#271B2F] shadow-sm backdrop-blur sm:flex">
        <Sparkles size={25} />
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-[#F8F4EF] px-4 py-6 text-[#2f2135]">
      <section className="mx-auto flex min-h-[420px] w-full max-w-4xl items-center justify-center rounded-[28px] border border-[#EDE2D1] bg-white">
        <span className="inline-flex items-center gap-3 text-sm font-black text-purple-700">
          <Loader2 className="animate-spin" size={20} />
          Loading learning program
        </span>
      </section>
    </main>
  );
}

function Wizard({
  categories,
  initialForm,
  saving,
  onCancel,
  onSubmit,
}: {
  categories: LearningCategory[];
  initialForm: ProgramForm;
  saving: boolean;
  onCancel?: () => void;
  onSubmit: (form: ProgramForm) => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProgramForm>(initialForm);
  const [rhythmTouched, setRhythmTouched] = useState(false);
  const hasRenderedStepRef = useRef(false);
  const canGoNext = step < wizardStepTitles.length - 1;
  const recommendedRhythm = recommendedRhythmFor(form);

  useEffect(() => {
    if (!hasRenderedStepRef.current) {
      hasRenderedStepRef.current = true;
      return;
    }
    if (navigator.userAgent.toLowerCase().includes("jsdom")) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [step]);

  const toggleInterest = (slug: string) => {
    setForm((current) => {
      const exists = current.interests.includes(slug);
      const interests = exists
        ? current.interests.filter((interest) => interest !== slug)
        : current.interests.length === 1 && current.interests[0] === DEFAULT_INTEREST && slug !== DEFAULT_INTEREST
          ? [slug]
          : [...current.interests, slug];
      return { ...current, interests: interests.length ? interests : [DEFAULT_INTEREST] };
    });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#FFF6E9_0%,#FAF8F4_34%,#F6F0EA_100%)] px-4 py-5 text-[#261c29] min-[390px]:px-5 sm:px-6 sm:py-7" data-testid="learn-wizard">
      <section className="mx-auto w-full max-w-[920px]">
        <section className="overflow-hidden rounded-[28px] border border-[#E9DDCF] bg-white/95 shadow-[0_18px_46px_rgba(63,45,35,0.08)]">
          <header className="border-b border-[#F0E6DA] bg-[linear-gradient(135deg,#FFFFFF_0%,#FFF8EF_55%,#F5ECFF_100%)] px-5 py-5 min-[390px]:px-6 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-7 sm:py-6">
            <div className="min-w-0">
              <p className="inline-flex rounded-full bg-[#FFF1B8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#7A4C00]">
                Learning setup
              </p>
              <h1 className="mt-3 max-w-[11em] font-body text-[31px] font-black leading-[0.98] text-[#211827] min-[390px]:text-[35px] sm:text-[42px]">
                Learn Something New
              </h1>
            </div>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[18px] border border-[#E4D9CE] bg-white px-4 text-[15px] font-black text-[#5b4a46] sm:mt-0 sm:w-auto"
              >
                Cancel
              </button>
            ) : null}
          </header>

          <div className="px-5 pb-5 pt-4 min-[390px]:px-6 min-[390px]:pb-6 sm:px-7 sm:pb-7">
            <div className="mb-5 rounded-[20px] border border-[#EFE6DA] bg-[#FFFCF8] p-3 min-[390px]:p-4">
              <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.1em] text-[#7a6c66] min-[390px]:text-[12px]">
                <span>Step {step + 1} of {wizardStepTitles.length}</span>
                <span className="rounded-full bg-white px-3 py-1 text-[#6D28D9] shadow-sm">{wizardStepTitles[step]}</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2" aria-hidden="true">
                {wizardStepTitles.map((_title, index) => (
                  <span
                    key={index}
                    className={`h-2 rounded-full ${index <= step ? "bg-[#6D28D9]" : "bg-[#E8DED4]"}`}
                  />
                ))}
              </div>
            </div>

          {step === 0 ? (
            <>
              <h2 className="max-w-[13em] font-body text-[27px] font-black leading-[1.02] text-[#211827] min-[390px]:text-[30px] sm:max-w-none">How do you want to learn?</h2>
              <p className="mt-2 max-w-[38rem] text-[14px] font-bold leading-snug text-[#7d6b65] min-[390px]:text-[15px]">Choose voice, touch, or both. You can still switch anytime.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {learningModeOptions.map(({ id, label, description, Icon, recommended }) => {
                  const active = form.learningMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, learningMode: id }))}
                      aria-pressed={active}
                      className={`min-h-[112px] rounded-[20px] border px-4 py-4 text-left transition-transform hover:-translate-y-0.5 ${
                        active ? "border-[#8B5CF6] bg-[#F7F2FF] shadow-[0_12px_24px_rgba(109,40,217,0.10)]" : "border-[#E9DFD5] bg-white"
                      }`}
                      data-testid={`button-learn-mode-${id}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#F4EDFF] text-[#6D28D9]">
                          <Icon size={22} strokeWidth={2.5} />
                        </span>
                        {recommended ? (
                          <span className="rounded-full bg-[#FFF1B8] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#7A4C00]">Recommended</span>
                        ) : null}
                      </span>
                      <span className="mt-4 block text-[19px] font-black leading-tight text-[#2f2135]">{label}</span>
                      <span className="sr-only">{description}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h2 className="max-w-[13em] font-body text-[27px] font-black leading-[1.02] text-[#211827] min-[390px]:text-[30px] sm:max-w-none">Choose what sparks your curiosity</h2>
              <p className="mt-2 max-w-[40rem] text-[14px] font-bold leading-snug text-[#7d6b65] min-[390px]:text-[15px]">Pick one or more interests. General Knowledge stays available as a fallback.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {categories.map((category) => {
                  const Icon = categoryIcon(category);
                  const active = form.interests.includes(category.slug);
                  return (
                    <button
                      key={category.slug}
                      type="button"
                      onClick={() => toggleInterest(category.slug)}
                      aria-pressed={active}
                      className={`group flex min-h-[86px] items-center gap-3 rounded-[20px] border px-3.5 py-3.5 text-left transition-transform hover:-translate-y-0.5 min-[390px]:gap-4 min-[390px]:px-4 ${
                        active ? "border-[#8B5CF6] bg-[#F7F2FF] shadow-[0_12px_24px_rgba(109,40,217,0.10)]" : "border-[#E9DFD5] bg-white hover:border-[#CDBCEB]"
                      }`}
                      data-testid={`button-learn-interest-${category.slug}`}
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px]" style={{ background: `${category.color}14`, color: category.color }}>
                        <Icon size={23} strokeWidth={2.45} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17px] font-black leading-tight text-[#2f2135] min-[390px]:text-[18px]">{category.label}</span>
                        <span className="sr-only">{category.description}</span>
                      </span>
                      {active ? <CheckCircle2 className="h-6 w-6 shrink-0 text-[#6D28D9]" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h2 className="font-body text-[27px] font-black leading-tight text-[#211827] min-[390px]:text-[30px]">Set the pace</h2>
              <p className="mt-2 max-w-[38rem] text-[14px] font-bold leading-snug text-[#7d6b65] min-[390px]:text-[15px]">Keep it light and readable. The lesson stays educational, not game-like.</p>
              <div className="mt-5 grid gap-3">
                {paceOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setForm((current) => {
                      const next = { ...current, pace: option.id };
                      return rhythmTouched ? next : { ...next, ...recommendedRhythmFor(next) };
                    })}
                    aria-pressed={form.pace === option.id}
                    className={`flex min-h-[82px] items-center justify-between gap-3 rounded-[20px] border px-4 py-3.5 text-left transition-transform hover:-translate-y-0.5 ${
                      form.pace === option.id ? "border-[#8B5CF6] bg-[#F7F2FF] shadow-[0_12px_24px_rgba(109,40,217,0.10)]" : "border-[#E9DFD5] bg-white"
                    }`}
                    data-testid={`button-learn-pace-${option.id}`}
                  >
                    <span>
                      <span className="block text-[18px] font-black leading-tight">{option.label}</span>
                      <span className="sr-only">{option.description}</span>
                    </span>
                    {form.pace === option.id ? <CheckCircle2 className="text-purple-700" size={22} /> : null}
                  </button>
                ))}
              </div>
              <label className="mt-5 block rounded-[20px] border border-[#E9DFD5] bg-[#FCFAF7] p-4">
                <span className="text-[16px] font-black text-[#2f2135]">Lesson length</span>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={form.lessonLengthMinutes}
                  onChange={(event) => setForm((current) => {
                    const next = { ...current, lessonLengthMinutes: Number(event.target.value) };
                    return rhythmTouched ? next : { ...next, ...recommendedRhythmFor(next) };
                  })}
                  className="mt-4 w-full accent-purple-700"
                />
                <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1.5 text-[13px] font-black text-purple-700 shadow-sm">{form.lessonLengthMinutes} min</span>
              </label>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h2 className="font-body text-[27px] font-black leading-tight text-[#211827] min-[390px]:text-[30px]">Choose your rhythm</h2>
              <p className="mt-2 max-w-[38rem] text-[14px] font-bold leading-snug text-[#7d6b65] min-[390px]:text-[15px]">Choose how often, how long, and when lessons should appear.</p>
              <section className="mt-5 rounded-[20px] border border-[#E9DFD5] bg-[#FCFAF7] p-4">
                <h3 className="text-[16px] font-black text-[#2f2135]">How often?</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {frequencyOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setRhythmTouched(true);
                        setForm((current) => ({ ...current, frequency: option.id }));
                      }}
                      aria-pressed={form.frequency === option.id}
                      className={`min-h-[78px] rounded-[18px] border px-3 py-3 text-left transition-transform hover:-translate-y-0.5 ${
                        form.frequency === option.id ? "border-[#8B5CF6] bg-[#F7F2FF] shadow-[0_10px_20px_rgba(109,40,217,0.10)]" : "border-[#E9DFD5] bg-white"
                      }`}
                      data-testid={`button-learn-frequency-${option.id}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="block text-[16px] font-black leading-tight text-[#2f2135]">{option.label}</span>
                        {recommendedRhythm.frequency === option.id ? (
                          <span className="rounded-full bg-[#FFF1B8] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#7A4C00]">Recommended</span>
                        ) : null}
                      </span>
                      <span className="sr-only">{option.description}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="mt-4 rounded-[20px] border border-[#E9DFD5] bg-[#FCFAF7] p-4">
                <h3 className="text-[16px] font-black text-[#2f2135]">For how long?</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {durationOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setRhythmTouched(true);
                        setForm((current) => ({ ...current, durationWeeks: option.id }));
                      }}
                      aria-pressed={form.durationWeeks === option.id}
                      className={`min-h-[78px] rounded-[18px] border px-3 py-3 text-left transition-transform hover:-translate-y-0.5 ${
                        form.durationWeeks === option.id ? "border-[#8B5CF6] bg-[#F7F2FF] shadow-[0_10px_20px_rgba(109,40,217,0.10)]" : "border-[#E9DFD5] bg-white"
                      }`}
                      data-testid={`button-learn-duration-${option.id}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="block text-[16px] font-black leading-tight text-[#2f2135]">{option.label}</span>
                        {recommendedRhythm.durationWeeks === option.id ? (
                          <span className="rounded-full bg-[#FFF1B8] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#7A4C00]">Recommended</span>
                        ) : null}
                      </span>
                      <span className="sr-only">{option.description}</span>
                    </button>
                  ))}
                </div>
              </section>
              <label className="mt-4 flex flex-col gap-3 rounded-[18px] border border-[#E9DFD5] bg-[#FCFAF7] p-4 min-[390px]:flex-row min-[390px]:items-center min-[390px]:justify-between">
                <span className="flex items-center gap-2 text-[16px] font-black text-[#2f2135]">
                  <CalendarDays size={18} />
                  Preferred time
                </span>
                <input
                  type="time"
                  value={form.dailyTime}
                  onChange={(event) => setForm((current) => ({ ...current, dailyTime: event.target.value }))}
                  className="h-12 w-full rounded-[16px] border border-[#E4D9CE] bg-white px-4 text-[17px] font-black text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100 min-[390px]:w-[150px]"
                  data-testid="input-learn-daily-time"
                />
              </label>
              <div className="mt-4 rounded-[18px] border border-[#DDECE2] bg-[#F3FAF5] px-4 py-3 text-[15px] font-black leading-snug text-[#0A7C4E]" data-testid="learn-rhythm-preview">
                {rhythmPreview(form)}
              </div>
            </>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#F0E6DA] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current - 1)}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-[#E4D9CE] bg-white px-4 text-[15px] font-black text-[#5b4a46] sm:w-auto"
                >
                  <ArrowLeft size={17} />
                  Back
                </button>
              ) : null}
            </div>

            {canGoNext ? (
              <button
                type="button"
                onClick={() => setStep((current) => current + 1)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-[#6D28D9] px-5 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(109,40,217,0.20)] sm:w-auto"
              >
                Next
                <ArrowRight size={17} />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => onSubmit(form)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-[#6D28D9] px-5 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(109,40,217,0.20)] disabled:opacity-60 sm:w-auto"
                data-testid="button-learn-start-program"
              >
                {saving ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
                Start my plan
              </button>
            )}
          </div>
          </div>
        </section>
      </section>
    </main>
  );
}

export default function LearnSomethingNewPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const {
    speakSequence,
    pauseTts,
    resumeTts,
    stopTts,
    playbackStatus,
    isTtsSupported,
    currentSegment,
    segmentCount,
  } = useTtsReadout();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [resumeSegmentIndex, setResumeSegmentIndex] = useState(0);
  const [revealedLessonPointCount, setRevealedLessonPointCount] = useState(1);
  const [learningMode, setLearningMode] = useState<ProgramForm["learningMode"]>(() => readLearningModePreference());
  const narrationStartedForItemRef = useRef<string | null>(null);

  const { data, isLoading, isError } = useQuery<LearningTodayResponse>({
    queryKey: ["/api/learning/today"],
    retry: false,
  });

  const categories = data?.categories ?? [];
  const program = data?.program ?? null;
  const today = data?.todayItem ?? null;
  const lesson = today?.lesson ?? null;
  const category = categoryFor(categories, lesson?.categorySlug);
  const nextItem = program ? nextLearningItem(program) : null;
  const lessonPoints = lesson ? lessonTakeaways(lesson.body) : [];
  const visibleLessonPoints = lessonPoints.slice(0, Math.min(revealedLessonPointCount, lessonPoints.length));
  const canRevealMore = revealedLessonPointCount < lessonPoints.length;
  const tinyAction = lesson ? lessonTinyAction(lesson, category) : "";
  const totalLessons = program ? program.progress.totalCount || lessonCountForRhythm(program) : 0;
  const activeLessonNumber = today?.programDay ?? program?.progress.currentDay ?? 1;
  const mobileProgressPercent = totalLessons > 0
    ? Math.min(100, Math.max(4, (activeLessonNumber / totalLessons) * 100))
    : 0;
  const readAloudPositionKey = lesson ? lessonReadAloudPositionKey(lesson.id, language) : null;
  const narrationSegments = useMemo<TtsSegment[]>(() => lesson ? [
    { text: lesson.title, lang: language, rate: 0.9, delayMs: 300 },
    { text: lesson.hook, lang: language, rate: 0.9, delayMs: 450 },
    { text: lesson.body, lang: language, rate: 0.88, delayMs: 500 },
    { text: `${t("learn.readAloud.reflectionIntro", "Reflection")}. ${lesson.reflectionPrompt}`, lang: language, rate: 0.88 },
  ] : [], [language, lesson, t]);

  useEffect(() => {
    setRevealedLessonPointCount(1);
  }, [lesson?.id]);

  useEffect(() => {
    stopTts();
    setResumeSegmentIndex(readLessonPosition(readAloudPositionKey));
    narrationStartedForItemRef.current = null;
  }, [lesson?.id, language, readAloudPositionKey, stopTts]);

  const createProgram = useMutation({
    mutationFn: async (form: ProgramForm) => {
      saveLearningModePreference(form.learningMode);
      setLearningMode(form.learningMode);
      const response = await apiFetch("/api/learning/programs", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Learning program could not be created.");
      return payload;
    },
    onSuccess: () => {
      setWizardOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["/api/learning/today"] });
      toast({ title: "Learning plan ready", description: "Your first lesson is waiting." });
    },
    onError: (error) => {
      toast({ title: "Could not start learning plan", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    },
  });

  const eventMutation = useMutation({
    mutationFn: async ({ eventType, item }: { eventType: "completed" | "saved" | "skipped" | "started"; item: LearningProgramItem }) => {
      const response = await apiFetch("/api/learning/events", {
        method: "POST",
        body: JSON.stringify({
          programId: item.programId,
          programItemId: item.id,
          eventType,
          source: "learn_hub",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Learning progress could not be saved.");
      return payload;
    },
    onSuccess: (_payload, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/learning/today"] });
      if (variables.eventType === "completed") {
        const receipt = buildWorkflowReceiptMoment({
          workflowReference: APP_WORKFLOW_REFERENCES.learningTodayLesson,
          status: "done",
          subject: variables.item.lesson?.title ?? "today's lesson",
          capturedSummary: "Nice. Tomorrow's snippet will keep the thread going.",
          locale: language === "es" ? "es" : "en",
        });
        toast({ title: receipt.title, description: receipt.message });
      }
      if (variables.eventType === "saved") {
        const receipt = buildWorkflowReceiptMoment({
          workflowReference: APP_WORKFLOW_REFERENCES.learningSaveForLater,
          status: "saved",
          capturedSummary: "This lesson will stay marked for another look.",
          locale: language === "es" ? "es" : "en",
        });
        toast({ title: receipt.title, description: receipt.message });
      }
      if (variables.eventType === "skipped") toast({ title: "Next lesson", description: "We moved this one aside." });
    },
    onError: (error) => {
      toast({ title: "Could not update lesson", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    },
  });

  const initialForm = useMemo(() => makeInitialForm(program, learningMode), [program, learningMode]);
  const voiceFirst = learningMode === "voice";

  const readLesson = (requestedStartIndex = resumeSegmentIndex) => {
    if (!lesson || !isTtsSupported || narrationSegments.length === 0) return;
    const startIndex = Math.min(narrationSegments.length - 1, Math.max(0, requestedStartIndex));
    const started = speakSequence(narrationSegments, {
      startIndex,
      onProgress: (segmentIndex) => {
        saveLessonPosition(readAloudPositionKey, segmentIndex);
        setResumeSegmentIndex(segmentIndex);
      },
      onComplete: () => {
        clearLessonPosition(readAloudPositionKey);
        setResumeSegmentIndex(0);
      },
    });
    if (started && today && narrationStartedForItemRef.current !== today.id) {
      narrationStartedForItemRef.current = today.id;
      eventMutation.mutate({ eventType: "started", item: today });
    }
  };

  const stopLessonNarration = () => {
    stopTts();
    clearLessonPosition(readAloudPositionKey);
    setResumeSegmentIndex(0);
  };

  const replayLesson = () => {
    clearLessonPosition(readAloudPositionKey);
    setResumeSegmentIndex(0);
    readLesson(0);
  };

  const goToNextLesson = () => {
    if (!today) return;
    stopLessonNarration();
    eventMutation.mutate({ eventType: "skipped", item: today });
  };

  const readAloudPrimaryLabel = playbackStatus === "loading"
    ? t("learn.readAloud.preparing", "Preparing voice...")
    : playbackStatus === "playing"
      ? t("learn.readAloud.pause", "Pause")
      : playbackStatus === "paused"
        ? t("learn.readAloud.resume", "Resume")
        : playbackStatus === "completed"
          ? t("learn.readAloud.replay", "Replay")
          : resumeSegmentIndex > 0
            ? t("learn.readAloud.resume", "Resume")
            : voiceFirst
              ? t("learn.readAloud.listen", "Listen aloud")
              : t("learn.readAloud.play", "Read aloud");

  const readAloudStatus = !isTtsSupported || playbackStatus === "unavailable"
    ? t("learn.readAloud.unavailableDetail", "Voice playback is unavailable on this device. The lesson remains available on screen.")
    : playbackStatus === "error"
      ? t("learn.readAloud.errorDetail", "Voice playback stopped. You can try again or continue reading on screen.")
      : playbackStatus === "completed"
        ? t("learn.readAloud.completed", "Lesson reading complete.")
        : (playbackStatus === "playing" || playbackStatus === "paused" || playbackStatus === "loading") && segmentCount > 0
          ? t("learn.readAloud.part", "Part {{current}} of {{total}}", { current: Math.max(1, currentSegment), total: segmentCount })
          : resumeSegmentIndex > 0
            ? t("learn.readAloud.resumeReady", "Continue from where you stopped.")
            : t("learn.readAloud.ready", "Hear this lesson in your app language.");

  const startAnotherPlan = () => {
    createProgram.mutate(initialForm);
  };

  if (isLoading) return <LoadingState />;

  if (isError) {
    return (
      <main className="min-h-screen bg-[#F8F4EF] px-4 py-6 text-[#2f2135]">
        <section className="mx-auto max-w-3xl rounded-[28px] border border-red-100 bg-white p-6 text-center">
          <h1 className="font-serif text-3xl">Learning could not load</h1>
          <p className="mt-2 text-sm font-semibold text-[#7d6b65]">Please try again in a moment.</p>
        </section>
      </main>
    );
  }

  if (data?.onboardingRequired || wizardOpen || !program) {
    return (
      <Wizard
        categories={categories}
        initialForm={initialForm}
        saving={createProgram.isPending}
        onCancel={program ? () => setWizardOpen(false) : undefined}
        onSubmit={(form) => createProgram.mutate(form)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF8F4] px-3 pb-28 pt-3 text-[#261c29] sm:px-4 sm:pt-6" data-testid="learn-hub">
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex items-center justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7A5C8A] sm:hidden">Learn Something New</p>
            <p className="mt-0.5 truncate text-[14px] font-black text-[#4d403c] sm:hidden">
              Lesson {activeLessonNumber} of {totalLessons || 1}
              {lesson ? ` - ${(category?.label ?? "Learning")} - ${lesson.estimatedMinutes || program.lessonLengthMinutes} min` : ""}
            </p>
            <h1 className="hidden font-serif text-[34px] leading-none text-[#211827] sm:block sm:text-[48px]">Learn Something New</h1>
            <div className="mt-4 hidden gap-2 text-[13px] font-black text-[#4d403c] sm:grid sm:grid-cols-3" data-testid="learn-plan-glance">
              <span className="rounded-[16px] border border-[#E9DFD5] bg-white px-3 py-2">Next: {nextLearningLabel(nextItem, program.dailyTime)}</span>
              <span className="rounded-[16px] border border-[#E9DFD5] bg-white px-3 py-2">{totalLessons || lessonCountForRhythm(program)} lessons {programPeriodLabel(program.durationWeeks)}</span>
              <span className="rounded-[16px] border border-[#E9DFD5] bg-white px-3 py-2">{learningModeLabel(learningMode)} - {learningInterestSummary(program.interests, categories)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            aria-label="Change interests"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#E4D9CE] bg-white text-sm font-black text-[#5b4a46] shadow-sm sm:h-auto sm:w-auto sm:min-h-10 sm:self-auto sm:px-4"
            data-testid="button-learn-change-interests"
          >
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Change interests</span>
          </button>
        </header>

        <div className="mt-3 sm:mt-5" aria-label="Learning plan progress">
          <div className="sm:hidden">
            <div className="h-1.5 overflow-hidden rounded-full bg-[#E5DCD2]">
              <span
                className="block h-full rounded-full bg-[#16A34A]"
                style={{ width: `${mobileProgressPercent}%` }}
              />
            </div>
          </div>

          <div className="hidden gap-2 sm:flex">
            {program.items.map((item) => {
              const isComplete = item.status === "completed";
              const isSkipped = item.status === "skipped";
              const isToday = item.id === today?.id;
              return (
                <span
                  key={item.id}
                  aria-label={`Lesson ${item.programDay}${isComplete ? " complete" : isSkipped ? " skipped" : isToday ? " today" : ""}`}
                  className={`h-2 flex-1 rounded-full ${
                    isComplete ? "bg-[#16A34A]" : isSkipped ? "bg-[#C8B8A8]" : isToday ? "bg-[#6D28D9]" : "bg-[#E5DCD2]"
                  }`}
                />
              );
            })}
          </div>
          <div className="mt-2 hidden justify-between text-[12px] font-bold text-[#7d6b65] sm:flex">
            <span>Lesson 1</span>
            <span>Lesson {totalLessons || 7}</span>
          </div>
        </div>

        {lesson && today ? (
          <article className="mt-3 overflow-hidden rounded-[22px] border border-[#E6DDD2] bg-white shadow-sm sm:mt-5" data-testid="learn-today-lesson">
            <LessonVisual lesson={lesson} category={category} />

            <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.82fr)]">
              <div>
                <div className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.12em]" style={{ color: category?.color ?? "#6D28D9" }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: category?.color ?? "#6D28D9" }} />
                  Today's discovery
                </div>

                <h2 className="mt-3 max-w-2xl font-serif text-[30px] leading-[1.02] text-[#211827] sm:text-[39px]">{lesson.title}</h2>
                <div className="mt-4 rounded-[18px] border border-[#E8DDF9] bg-[#FBF8FF] px-4 py-3">
                  <p className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.12em] text-[#6D28D9]">
                    <Sparkles size={15} />
                    Curiosity hook
                  </p>
                  <p className="mt-2 text-[18px] font-black leading-snug text-[#4B3A55]">{lesson.hook}</p>
                </div>

                <div className="mt-5 space-y-3" aria-label="Lesson highlights">
                  <p className="text-[12px] font-black uppercase tracking-[0.12em] text-[#8A6C5A]">How it works</p>
                  {visibleLessonPoints.map((point, index) => (
                    <div key={`${point}-${index}`} className="rounded-[18px] border border-[#EEE5DC] bg-[#FFFCF8] p-3 shadow-sm">
                      <div className="flex gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[14px] font-black text-[#6D28D9]">
                        {index + 1}
                      </span>
                        <p className="text-[16px] font-semibold leading-relaxed text-[#3f343d] sm:text-[17px]">{point}</p>
                      </div>
                    </div>
                  ))}
                  {canRevealMore ? (
                    <button
                      type="button"
                      onClick={() => setRevealedLessonPointCount((count) => Math.min(lessonPoints.length, count + 1))}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#D8C7F3] bg-white px-4 text-sm font-black text-[#6D28D9] shadow-sm"
                      data-testid="button-learn-reveal-next"
                    >
                      <ArrowRight size={17} />
                      Reveal next idea
                    </button>
                  ) : (
                    <p className="rounded-[16px] bg-[#F2FBF7] px-4 py-3 text-[14px] font-black text-[#0A7C4E]">
                      That is the core idea for today.
                    </p>
                  )}
                </div>
              </div>

              <aside className="flex flex-col justify-between gap-5 border-t border-[#EEE5DC] pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                <div>
                  <div className="rounded-[18px] border border-[#F1E1B5] bg-[#FFF8E6] px-4 py-3">
                    <p className="text-[12px] font-black uppercase tracking-[0.12em] text-[#9A5B00]">Try this today</p>
                    <p className="mt-2 text-[16px] font-black leading-snug text-[#5D4218]">{tinyAction}</p>
                  </div>

                  <div className="mt-4 border-l-4 border-[#6D28D9] bg-[#FAF8F4] px-4 py-3">
                    <p className="text-[12px] font-black uppercase tracking-[0.12em] text-[#6D28D9]">Reflection prompt</p>
                    <p className="mt-2 text-[18px] font-black leading-snug text-[#332934]">{lesson.reflectionPrompt}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.35fr_1fr_1fr] md:grid-cols-1">
                <div
                  className="col-span-2 rounded-[18px] border border-[#D8C7F3] bg-[#F8F4FF] p-2 sm:col-span-3 md:col-span-1"
                  data-testid="learn-read-aloud-controls"
                >
                  <button
                    type="button"
                    disabled={!isTtsSupported || playbackStatus === "loading"}
                    onClick={() => {
                      if (playbackStatus === "playing") {
                        pauseTts();
                      } else if (playbackStatus === "paused") {
                        resumeTts();
                      } else if (playbackStatus === "completed") {
                        replayLesson();
                      } else {
                        readLesson();
                      }
                    }}
                    className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#6D28D9] px-5 py-3 text-sm font-black text-white shadow-sm disabled:bg-[#B9A9C9]"
                    data-testid="button-learn-read-aloud"
                  >
                    {playbackStatus === "playing" ? <Pause size={18} /> : playbackStatus === "paused" ? <Play size={18} /> : <Volume2 size={18} />}
                    {readAloudPrimaryLabel}
                  </button>
                  <div className="mt-2 flex min-h-9 items-center justify-between gap-2 px-1">
                    <p className="text-[12px] font-bold leading-snug text-[#6E5A73]" role="status" data-testid="learn-read-aloud-status">
                      {readAloudStatus}
                    </p>
                    {playbackStatus === "playing" || playbackStatus === "paused" || playbackStatus === "completed" ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={replayLesson}
                          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-[#6D28D9] hover:bg-white"
                          aria-label={t("learn.readAloud.replay", "Replay")}
                          title={t("learn.readAloud.replay", "Replay")}
                          data-testid="button-learn-read-aloud-replay"
                        >
                          <RotateCcw size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={stopLessonNarration}
                          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-[#6E5A73] hover:bg-white"
                          aria-label={t("learn.readAloud.stop", "Stop")}
                          title={t("learn.readAloud.stop", "Stop")}
                          data-testid="button-learn-read-aloud-stop"
                        >
                          <Square size={16} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={eventMutation.isPending || today.status === "completed"}
                  onClick={() => eventMutation.mutate({ eventType: "completed", item: today })}
                  className={`${voiceFirst ? "border border-[#E4D9CE] bg-white text-[#5b4a46]" : "col-span-2 bg-[#6D28D9] text-white shadow-sm sm:col-span-1"} inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-black disabled:opacity-60 sm:min-h-[52px] md:col-span-1`}
                  data-testid="button-learn-complete"
                >
                  <CheckCircle2 size={18} />
                  I learned this
                </button>
                <button
                  type="button"
                  disabled={eventMutation.isPending}
                  onClick={() => eventMutation.mutate({ eventType: "saved", item: today })}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-[#E4D9CE] bg-white px-3 py-3 text-sm font-black text-[#5b4a46] sm:min-h-[52px] sm:px-5"
                  data-testid="button-learn-save"
                >
                  <Bookmark size={18} />
                  Save for later
                </button>
                <button
                  type="button"
                  disabled={eventMutation.isPending}
                  onClick={goToNextLesson}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-[#E4D9CE] bg-white px-3 py-3 text-sm font-black text-[#5b4a46] sm:min-h-[52px] sm:px-5"
                  data-testid="button-learn-next"
                >
                  <ArrowRight size={18} />
                  Next lesson
                </button>
              </div>
              </aside>
            </div>
          </article>
        ) : (
          <section className="mt-5 rounded-lg border border-[#DDECE2] bg-white p-6 text-center shadow-sm">
            <CheckCircle2 className="mx-auto text-[#0A7C4E]" size={42} />
            <h2 className="mt-3 font-serif text-3xl">This learning plan is complete.</h2>
            <p className="mt-2 text-sm font-semibold text-[#7d6b65]">Start another plan to keep receiving short lessons.</p>
            <button
              type="button"
              disabled={createProgram.isPending}
              onClick={startAnotherPlan}
              className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#6D28D9] px-5 text-sm font-black text-white"
              data-testid="button-learn-start-another-week"
            >
              <RotateCcw size={17} />
              Start another plan
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
