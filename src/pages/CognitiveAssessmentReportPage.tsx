import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Gamepad2,
  History,
  Leaf,
  Lightbulb,
  Loader2,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getBrainCoachActivityPath } from "@/games/brainCoachCatalog";
import {
  cognitiveAssessmentPracticeStatusForReport,
  startCognitiveAssessmentPractice,
} from "@/lib/cognitiveAssessmentPracticeBridge";
import type {
  CognitiveAssessmentDomainTrend,
  CognitiveAssessmentHistoryResponse,
  CognitiveAssessmentLatestReportResponse,
  CognitiveAssessmentReport,
  CognitiveAssessmentTaskSummary,
  CognitiveAssessmentTrendPoint,
} from "../../shared/cognitiveAssessmentReport";

const EXPECTED_REPORT_AREAS = [
  { taskId: "orientation", label: "Orientation", domain: "Awareness" },
  { taskId: "story_recall_immediate", label: "Story recall", domain: "Memory" },
  { taskId: "fluency_semantic", label: "Category fluency", domain: "Language" },
  { taskId: "fluency_phonemic", label: "Letter fluency", domain: "Language" },
  { taskId: "digit_span", label: "Digit span", domain: "Attention" },
  { taskId: "similarities", label: "Similarities", domain: "Reasoning" },
  { taskId: "clock_drawing", label: "Clock drawing", domain: "Visual thinking" },
  { taskId: "story_recall_delayed", label: "Delayed recall", domain: "Memory" },
  { taskId: "mood_screen", label: "Mood check", domain: "Mood" },
  { taskId: "sleep_energy", label: "Sleep and energy", domain: "Sleep" },
  { taskId: "function_iadl", label: "Daily function", domain: "Daily function" },
  { taskId: "subjective_concern", label: "Memory concern", domain: "Self concern" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "Not completed yet";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function completionPercent(report: CognitiveAssessmentReport) {
  if (report.totalTasks <= 0) return 0;
  return Math.round((report.tasksCompleted / report.totalTasks) * 100);
}

function completionLabel(report: CognitiveAssessmentReport) {
  const percent = completionPercent(report);
  if (percent >= 100) return "Complete baseline";
  if (percent >= 70) return "Nearly complete";
  if (percent >= 35) return "Developing snapshot";
  return "Early snapshot";
}

function completedDomains(report: CognitiveAssessmentReport) {
  return Array.from(new Set(report.sections.map((section) => section.domain).filter(Boolean)));
}

function isContextSection(section: CognitiveAssessmentTaskSummary) {
  return CONTEXT_REPORT_TASK_IDS.has(section.taskId) || CONTEXT_REPORT_DOMAINS.has(section.domain);
}

function isContextSignal(signal: ReportTaskSignals[number]) {
  return CONTEXT_REPORT_TASK_IDS.has(signal.taskId) || CONTEXT_REPORT_DOMAINS.has(signal.domain);
}

function thinkingDomains(report: CognitiveAssessmentReport) {
  return Array.from(new Set(
    report.sections
      .filter((section) => !isContextSection(section))
      .map((section) => section.domain)
      .filter(Boolean),
  ));
}

function visibleScoreLabel(section: CognitiveAssessmentTaskSummary) {
  if (section.taskId.includes("story_recall")) return null;
  return section.scoreLabel ?? null;
}

function scoreSignalCount(report: CognitiveAssessmentReport) {
  return report.sections.filter((section) => visibleScoreLabel(section)).length;
}

function remainingAreas(report: CognitiveAssessmentReport) {
  const completed = new Set(report.sections.map((section) => section.taskId));
  return EXPECTED_REPORT_AREAS.filter((area) => !completed.has(area.taskId));
}

function shortList(items: string[], emptyText: string, max = 2) {
  if (items.length === 0) return emptyText;
  const shown = items.slice(0, max).join(", ");
  const extra = items.length > max ? ` +${items.length - max}` : "";
  return `${shown}${extra}`;
}

function nextPriorityLabel(report: CognitiveAssessmentReport) {
  return remainingAreas(report)[0]?.label ?? "Trend check";
}

function coverageMeaning(report: CognitiveAssessmentReport) {
  const remaining = Math.max(0, report.totalTasks - report.tasksCompleted);
  if (remaining === 0) return "Baseline ready";
  return `${remaining} left`;
}

type ReportHistory = CognitiveAssessmentHistoryResponse["history"];
type ReportHistoryInsights = CognitiveAssessmentHistoryResponse["historyInsights"];
type ReportTrendPoints = CognitiveAssessmentHistoryResponse["trendPoints"];
type ReportDomainTrends = CognitiveAssessmentHistoryResponse["domainTrends"];
type ReportDomainTrendSeries = CognitiveAssessmentHistoryResponse["domainTrendSeries"];
type ReportTaskSignals = CognitiveAssessmentHistoryResponse["taskSignals"];
type ReportBaselineBands = CognitiveAssessmentHistoryResponse["baselineBands"];
type ReportCheckQuality = CognitiveAssessmentHistoryResponse["checkQuality"];
type ReportContextInsight = CognitiveAssessmentHistoryResponse["contextInsight"];

const DEFAULT_CHECK_QUALITY: ReportCheckQuality = {
  status: "building",
  label: "Building comparison",
  detail: "Complete more areas before reading trends strongly.",
  factors: [],
};

const DEFAULT_CONTEXT_INSIGHT: ReportContextInsight = {
  tone: "building",
  label: "Context not saved",
  detail: "Mood, sleep, and daily function make comparisons clearer.",
  relatedSignals: [],
};

const CONTEXT_REPORT_TASK_IDS = new Set(["mood_screen", "sleep_energy", "function_iadl", "subjective_concern"]);
const CONTEXT_REPORT_DOMAINS = new Set(["Mood/Sleep/Daily Context", "Mood", "Sleep", "Daily function", "Self concern"]);

type ProgressPoint = {
  sessionId: string;
  completedAt: string | null;
  percent: number;
  steps: number;
  total: number;
  domainCount: number;
  isCurrent: boolean;
};

function progressPointFromTrend(point: CognitiveAssessmentTrendPoint, report: CognitiveAssessmentReport): ProgressPoint {
  return {
    sessionId: point.sessionId,
    completedAt: point.completedAt,
    percent: point.completionPercent,
    steps: point.completedSteps,
    total: point.totalSteps,
    domainCount: point.domainCount,
    isCurrent: point.sessionId === report.sessionId,
  };
}

function progressPoints(
  report: CognitiveAssessmentReport,
  history: ReportHistory,
  trendPoints: ReportTrendPoints,
): ProgressPoint[] {
  if (trendPoints.length > 0) {
    const points = trendPoints.map((point) => progressPointFromTrend(point, report));
    const hasCurrent = points.some((point) => point.sessionId === report.sessionId);
    if (!hasCurrent) {
      points.push({
        sessionId: report.sessionId,
        completedAt: report.completedAt,
        percent: completionPercent(report),
        steps: report.tasksCompleted,
        total: report.totalTasks,
        domainCount: completedDomains(report).length,
        isCurrent: true,
      });
    }
    return points.sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateA - dateB;
    }).slice(-12);
  }

  const pointsBySession = new Map<string, ProgressPoint>();

  history.forEach((item) => {
    const total = Math.max(1, item.totalTasks);
    pointsBySession.set(item.sessionId, {
      sessionId: item.sessionId,
      completedAt: item.completedAt,
      percent: Math.round((item.tasksCompleted / total) * 100),
      steps: item.tasksCompleted,
      total: item.totalTasks,
      domainCount: 0,
      isCurrent: item.sessionId === report.sessionId,
    });
  });

  pointsBySession.set(report.sessionId, {
    sessionId: report.sessionId,
    completedAt: report.completedAt,
    percent: completionPercent(report),
    steps: report.tasksCompleted,
    total: report.totalTasks,
    domainCount: completedDomains(report).length,
    isCurrent: true,
  });

  return Array.from(pointsBySession.values())
    .sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateA - dateB;
    })
    .slice(-12);
}

function shortDate(value: string | null | undefined) {
  if (!value) return "Today";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function currentProgressDelta(points: ProgressPoint[]) {
  const currentIndex = points.findIndex((point) => point.isCurrent);
  if (currentIndex <= 0) return "First saved check";

  const current = points[currentIndex];
  const previous = points[currentIndex - 1];
  const diff = current.percent - previous.percent;
  if (diff > 0) return `+${diff} pts since last check`;
  if (diff < 0) return `${diff} pts since last check`;
  return "Stable since last check";
}

function chartViewWidth(pointCount: number) {
  return Math.max(280, 36 + Math.max(244, Math.max(0, pointCount - 1) * 56));
}

function chartCoordinates(points: ProgressPoint[]) {
  const left = 18;
  const top = 18;
  const width = chartViewWidth(points.length) - 36;
  const height = 110;
  return points.map((point, index) => {
    const x = points.length === 1 ? left + width / 2 : left + (index / (points.length - 1)) * width;
    const y = top + ((100 - point.percent) / 100) * height;
    return { ...point, x, y };
  });
}

type PracticeKey = "memory" | "language" | "attention" | "reasoning" | "visual" | "context";

type PracticeRecommendation = {
  key: PracticeKey;
  title: string;
  detail: string;
  why: string;
  route: string;
  domainLabel: string;
  minutes: string;
  Icon: LucideIcon;
  tone: {
    border: string;
    bg: string;
    accent: string;
    soft: string;
  };
};

const PRACTICE_RECOMMENDATIONS: Record<PracticeKey, PracticeRecommendation> = {
  memory: {
    key: "memory",
    title: "Remember Later",
    detail: "Practice remembering an intention after a short delay.",
    why: "This gives memory a short, practical workout without turning the result into a test score.",
    route: getBrainCoachActivityPath("remember_later"),
    domainLabel: "Memory",
    minutes: "5 min",
    Icon: Brain,
    tone: { border: "#DDD6FE", bg: "#F5F3FF", accent: "#6B21A8", soft: "#FFFFFF" },
  },
  language: {
    key: "language",
    title: "Curious Minds",
    detail: "Warm up word finding with gentle idea prompts.",
    why: "This keeps word finding active with short prompts that feel more like conversation than testing.",
    route: getBrainCoachActivityPath("curious_minds"),
    domainLabel: "Language",
    minutes: "5 min",
    Icon: BookOpen,
    tone: { border: "#BFDBFE", bg: "#EFF6FF", accent: "#1D4ED8", soft: "#FFFFFF" },
  },
  attention: {
    key: "attention",
    title: "Number Trails",
    detail: "Follow a calm route and train focus step by step.",
    why: "This supports steady attention with a clear path and simple next target.",
    route: getBrainCoachActivityPath("number_trails"),
    domainLabel: "Attention",
    minutes: "5 min",
    Icon: Target,
    tone: { border: "#BBF7D0", bg: "#ECFDF5", accent: "#047857", soft: "#FFFFFF" },
  },
  reasoning: {
    key: "reasoning",
    title: "Category Sort",
    detail: "Sort everyday ideas and practice flexible thinking.",
    why: "This matches reasoning practice to everyday choices, grouping, and flexible thinking.",
    route: getBrainCoachActivityPath("category_sort"),
    domainLabel: "Reasoning",
    minutes: "5 min",
    Icon: Lightbulb,
    tone: { border: "#FED7AA", bg: "#FFF7ED", accent: "#C2410C", soft: "#FFFFFF" },
  },
  visual: {
    key: "visual",
    title: "Memory Match",
    detail: "Use visual pairs to strengthen recognition and recall.",
    why: "This gives visual thinking a simple recognition pattern to work with.",
    route: getBrainCoachActivityPath("memory_match"),
    domainLabel: "Visual thinking",
    minutes: "4 min",
    Icon: Gamepad2,
    tone: { border: "#FBCFE8", bg: "#FDF2F8", accent: "#BE185D", soft: "#FFFFFF" },
  },
  context: {
    key: "context",
    title: "Breath Garden",
    detail: "Settle attention before another memory or thinking task.",
    why: "This is useful when mood, sleep, or energy may be affecting the check.",
    route: getBrainCoachActivityPath("breath_garden"),
    domainLabel: "Mood and energy",
    minutes: "4 min",
    Icon: Leaf,
    tone: { border: "#99F6E4", bg: "#F0FDFA", accent: "#0F766E", soft: "#FFFFFF" },
  },
};

function practiceKeyForTask(taskId: string): PracticeKey | null {
  if (taskId.includes("story_recall")) return "memory";
  if (taskId.includes("fluency")) return "language";
  if (taskId.includes("digit_span")) return "attention";
  if (taskId.includes("similarities")) return "reasoning";
  if (taskId.includes("clock")) return "visual";
  if (CONTEXT_REPORT_TASK_IDS.has(taskId)) return "context";
  return null;
}

function practiceKeyForDomain(domain: string | null | undefined): PracticeKey {
  const normalized = (domain ?? "").toLowerCase();
  if (normalized.includes("language")) return "language";
  if (normalized.includes("attention")) return "attention";
  if (normalized.includes("reason")) return "reasoning";
  if (normalized.includes("visual") || normalized.includes("clock")) return "visual";
  if (normalized.includes("mood") || normalized.includes("sleep") || normalized.includes("daily") || normalized.includes("concern")) return "context";
  return "memory";
}

function signalStrength(signal: ReportTaskSignals[number]) {
  if (signal.rawValue === null) return 1;
  if (typeof signal.maxValue === "number" && signal.maxValue > 0) {
    return signal.rawValue / signal.maxValue;
  }
  return 0.72;
}

function primaryPracticeKey({
  report,
  taskSignals,
  domainTrends,
  baselineBands,
  contextInsight,
}: {
  report: CognitiveAssessmentReport;
  taskSignals: ReportTaskSignals;
  domainTrends: ReportDomainTrends;
  baselineBands: ReportBaselineBands;
  contextInsight: ReportContextInsight;
}): PracticeKey {
  const belowBaseline = baselineBands.find((band) => band.status === "below");
  if (belowBaseline) return practiceKeyForDomain(belowBaseline.label);

  const downwardTrend = domainTrends.find((trend) => trend.direction === "down" && trend.latestRawValue !== null);
  if (downwardTrend) return practiceKeyForDomain(downwardTrend.label);

  const scoredSignals = taskSignals
    .filter((signal) => !isContextSignal(signal) && signal.rawValue !== null)
    .sort((left, right) => signalStrength(left) - signalStrength(right));

  const lowestSignal = scoredSignals[0];
  if (lowestSignal) return practiceKeyForTask(lowestSignal.taskId) ?? practiceKeyForDomain(lowestSignal.domain);

  const firstThinkingSection = report.sections.find((section) => !isContextSection(section));
  if (firstThinkingSection) return practiceKeyForTask(firstThinkingSection.taskId) ?? practiceKeyForDomain(firstThinkingSection.domain);

  if (contextInsight.tone === "changed") return "context";

  const firstSection = report.sections[0];
  if (firstSection) return practiceKeyForTask(firstSection.taskId) ?? practiceKeyForDomain(firstSection.domain);

  return "attention";
}

function practiceSequence(primary: PracticeKey): PracticeRecommendation[] {
  const ordered: PracticeKey[] = [primary, "memory", "attention", "context", "language", "reasoning", "visual"];
  return Array.from(new Set(ordered)).slice(0, 3).map((key) => PRACTICE_RECOMMENDATIONS[key]);
}

function outcomeCopy(report: CognitiveAssessmentReport, checkQuality: ReportCheckQuality) {
  const percent = completionPercent(report);
  if (report.tasksCompleted >= report.totalTasks && checkQuality.status === "good") {
    return {
      label: "Result",
      title: "A clear starting map",
      detail: "Ready for one small practice and future comparison.",
    };
  }
  if (percent >= 70) {
    return {
      label: "Result",
      title: "A useful snapshot",
      detail: "Choose one practice now. Repeat later for a stronger trend.",
    };
  }
  if (percent >= 35) {
    return {
      label: "Result",
      title: "A snapshot is building",
      detail: "Practice can begin now. Fill the gaps next time.",
    };
  }
  return {
    label: "Result",
    title: "A first step is saved",
    detail: "Not a score. A starting point for support and practice.",
  };
}

function outcomeHighlights({
  report,
  taskSignals,
  domainTrends,
  contextInsight,
}: {
  report: CognitiveAssessmentReport;
  taskSignals: ReportTaskSignals;
  domainTrends: ReportDomainTrends;
  contextInsight: ReportContextInsight;
}) {
  const highlights: Array<{ title: string; detail: string }> = [];
  const thinking = thinkingDomains(report);
  if (thinking.length > 0) {
    highlights.push({
      title: "What went well",
      detail: `${shortList(thinking, "Thinking areas", 3)} captured.`,
    });
  }

  const positiveTrend = domainTrends.find((trend) => trend.direction === "up" || trend.direction === "flat");
  if (positiveTrend) {
    highlights.push({
      title: "Good signal",
      detail: `${positiveTrend.label} is ${domainTrendLabel(positiveTrend)}.`,
    });
  }

  const contextCount = taskSignals.filter(isContextSignal).length;
  if (contextCount > 0 || contextInsight.tone !== "building") {
    highlights.push({
      title: "Context helps",
      detail: contextInsight.tone === "changed" ? "Sleep, mood, or daily life may explain changes." : "Daily context can make future comparisons clearer.",
    });
  }

  if (highlights.length === 0) {
    highlights.push({
      title: "Ready to practice",
      detail: "Start with one short Brain Coach activity today.",
    });
  }

  return highlights.slice(0, 3);
}

function bestThinkingSignal(taskSignals: ReportTaskSignals) {
  return taskSignals
    .filter((signal) => !isContextSignal(signal) && signal.rawValue !== null)
    .sort((left, right) => signalStrength(right) - signalStrength(left))[0] ?? null;
}

function strengthMapItems({
  report,
  taskSignals,
  domainTrends,
  baselineBands,
  contextInsight,
}: {
  report: CognitiveAssessmentReport;
  taskSignals: ReportTaskSignals;
  domainTrends: ReportDomainTrends;
  baselineBands: ReportBaselineBands;
  contextInsight: ReportContextInsight;
}) {
  const bestSignal = bestThinkingSignal(taskSignals);
  const practiceKey = primaryPracticeKey({ report, taskSignals, domainTrends, baselineBands, contextInsight });
  const practice = PRACTICE_RECOMMENDATIONS[practiceKey];
  const trend = domainTrends.find((item) => item.latestRawValue !== null && item.direction !== "none");
  const contextPercent = contextInsight.tone === "building" ? 42 : contextInsight.tone === "changed" ? 74 : 68;

  return [
    {
      label: "Bright spot",
      value: bestSignal?.domain ?? trend?.label ?? "First signal",
      detail: bestSignal?.valueLabel ?? trend?.valueLabel ?? "Saved",
      percent: bestSignal ? Math.max(34, Math.min(100, Math.round(signalStrength(bestSignal) * 100))) : completionPercent(report),
      tone: "bg-[#ECFDF5] text-[#047857] border-[#BBF7D0]",
      bar: "#047857",
    },
    {
      label: "Focus next",
      value: practice.domainLabel,
      detail: practice.title,
      percent: 68,
      tone: "bg-[#F5F3FF] text-[#6B21A8] border-[#DDD6FE]",
      bar: practice.tone.accent,
    },
    {
      label: "Life context",
      value: contextInsight.label,
      detail: contextInsight.tone === "changed" ? "May explain changes" : "Helps comparisons",
      percent: contextPercent,
      tone: "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
      bar: "#C2410C",
    },
  ];
}

function StrengthMapCard({
  report,
  taskSignals,
  domainTrends,
  baselineBands,
  contextInsight,
}: {
  report: CognitiveAssessmentReport;
  taskSignals: ReportTaskSignals;
  domainTrends: ReportDomainTrends;
  baselineBands: ReportBaselineBands;
  contextInsight: ReportContextInsight;
}) {
  const items = strengthMapItems({ report, taskSignals, domainTrends, baselineBands, contextInsight });

  return (
    <section
      className="min-w-0 max-w-full overflow-hidden rounded-[28px] border border-[#E8DED4] bg-white p-4 shadow-[0_12px_28px_rgba(63,45,35,0.06)]"
      data-testid="assessment-strength-map"
      aria-labelledby="assessment-strength-map-title"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Strength map</p>
          <h2 id="assessment-strength-map-title" className="mt-1 text-[24px] font-black leading-tight text-[#2f2135]">
            What to use next
          </h2>
        </div>
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-[#6B21A8]">
          <Sparkles size={22} />
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className={`min-w-0 rounded-[20px] border px-3 py-3 ${item.tone}`}>
            <span className="block text-[11px] font-black uppercase tracking-[0.1em] opacity-80">{item.label}</span>
            <span className="mt-1 block truncate text-[18px] font-black leading-tight text-[#2f2135]">{item.value}</span>
            <span className="mt-1 block truncate text-[12px] font-bold opacity-85">{item.detail}</span>
            <span className="mt-3 block h-2 overflow-hidden rounded-full bg-white/80">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max(18, Math.min(100, item.percent))}%`, backgroundColor: item.bar }}
              />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReportHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const navigate = useNavigate();
  return (
    <header className="mx-auto w-full max-w-[1100px] px-5 pt-5 md:px-7 lg:px-8">
      <button
        type="button"
        onClick={() => navigate("/mind-memory")}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#2f2135] shadow-[0_8px_20px_rgba(63,45,35,0.07)]"
      >
        <ArrowLeft size={18} />
        Mind & Memory
      </button>
      <div className="mt-5 rounded-[28px] border border-[#DDD6FE] bg-white p-5 shadow-[0_14px_32px_rgba(63,45,35,0.07)] md:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-[#F5F3FF] text-[#6B21A8]">
            <Brain size={30} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Cognitive Assessment</p>
            <h1 className="mt-1 text-[32px] font-black leading-[1.02] text-[#2f2135] md:text-[38px]">{title}</h1>
            <p className="mt-2 text-[16px] font-bold leading-snug text-[#766b63]">{subtitle}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

function NoReportState() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-10">
      <ReportHeader
        title="No report yet"
        subtitle="Finish one Cognitive Assessment check to unlock the report."
      />
      <section className="mx-auto grid w-full max-w-[760px] gap-3 px-5 pt-5 md:px-7">
        <div className="rounded-[26px] border border-[#E8DED4] bg-white p-5 text-center shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          <FileText size={30} className="mx-auto text-[#6B21A8]" />
          <h2 className="mt-3 text-[26px] font-black leading-tight text-[#2f2135]">Your report will appear here</h2>
          <p className="mt-2 text-[15px] font-bold leading-relaxed text-[#62564f]">
            The program hub can start or continue the guided check.
          </p>
          <button
            type="button"
            onClick={() => navigate("/mind-memory/cognitive-assessment")}
            className="mt-5 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#2f2135] px-5 text-[16px] font-black text-white"
          >
            <Brain size={20} />
            Back to program
          </button>
        </div>
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F2EB] p-6">
      <div className="flex items-center gap-3 rounded-[22px] border border-[#E8DED4] bg-white px-5 py-4 text-sm font-black text-[#2f2135] shadow-[0_12px_28px_rgba(63,45,35,0.07)]">
        <Loader2 className="animate-spin" size={20} />
        Loading report
      </div>
    </main>
  );
}

function ErrorState() {
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-8">
      <ReportHeader
        title="Report unavailable"
        subtitle="The Cognitive Assessment report could not be loaded right now."
      />
      <section className="mx-auto w-full max-w-[1100px] px-5 pt-5 md:px-7 lg:px-8">
        <div className="rounded-[26px] border border-[#FECACA] bg-white p-5 text-[15px] font-bold leading-relaxed text-[#991B1B] shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
          Try again in a moment. If this keeps happening, the assessment database setup needs attention.
        </div>
      </section>
    </main>
  );
}

function MetricTile({
  icon,
  label,
  value,
  detail,
  className,
  valueClassName = "text-[27px] leading-none",
  targetId,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  className: string;
  valueClassName?: string;
  targetId?: string;
}) {
  const content = (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-white/80">
        {icon}
      </div>
      <p className="mt-3 text-[11px] font-black uppercase tracking-[0.1em] opacity-75">{label}</p>
      <p className={`mt-1 font-black ${valueClassName}`}>{value}</p>
      <p className="mt-2 text-[12px] font-black leading-snug opacity-80">{detail}</p>
    </>
  );

  if (targetId) {
    return (
      <button
        type="button"
        onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className={`min-h-[128px] rounded-[22px] border p-4 text-left shadow-[0_10px_24px_rgba(63,45,35,0.045)] ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`min-h-[128px] rounded-[22px] border p-4 shadow-[0_10px_24px_rgba(63,45,35,0.045)] ${className}`}>
      {content}
    </div>
  );
}

function ProgressionChart({
  report,
  history,
  trendPoints,
}: {
  report: CognitiveAssessmentReport;
  history: ReportHistory;
  trendPoints: ReportTrendPoints;
}) {
  const points = progressPoints(report, history, trendPoints);
  const coordinates = chartCoordinates(points);
  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const current = coordinates.find((point) => point.isCurrent) ?? coordinates[coordinates.length - 1];
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const viewWidth = chartViewWidth(points.length);

  return (
    <div className="min-w-0 max-w-full rounded-[28px] border border-[#BFDBFE] bg-[#F8FBFF] p-5 text-[#1D4ED8] shadow-[0_14px_32px_rgba(37,99,235,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2563EB]">Progression</p>
          <h2 className="mt-1 text-[24px] font-black leading-tight text-[#2f2135]">{current?.percent ?? completionPercent(report)}%</h2>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black shadow-sm">
          {currentProgressDelta(coordinates)}
        </span>
      </div>
      <p className="mt-2 text-[12px] font-black text-[#1D4ED8]">
        {points.length > 1 ? "Compared with previous check" : "First saved check"}
      </p>

      <div className="mt-3 overflow-x-auto pb-1">
        <svg
          className="h-[156px] min-w-full overflow-visible"
          style={{ width: viewWidth }}
          viewBox={`0 0 ${viewWidth} 156`}
          role="img"
          aria-label="Cognitive Assessment progression chart"
        >
          {[25, 50, 75, 100].map((line) => {
            const y = 18 + ((100 - line) / 100) * 110;
            return (
              <line
                key={line}
                x1="18"
                x2={viewWidth - 18}
                y1={y}
                y2={y}
                stroke="#DBEAFE"
                strokeWidth="1"
              />
            );
          })}
          {coordinates.length > 1 ? (
            <polyline
              points={polyline}
              fill="none"
              stroke="#2563EB"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="5"
            />
          ) : null}
          {coordinates.map((point) => (
            <g key={point.sessionId}>
              <circle
                cx={point.x}
                cy={point.y}
                r={point.isCurrent ? 8 : 6}
                fill={point.isCurrent ? "#7C3AED" : "#60A5FA"}
                stroke="#FFFFFF"
                strokeWidth="4"
              />
              {point.isCurrent ? (
                <text
                  x={Math.min(viewWidth - 34, Math.max(34, point.x))}
                  y={Math.max(16, point.y - 15)}
                  textAnchor="middle"
                  className="fill-[#5B21B6] text-[11px] font-black"
                >
                  Now
                </text>
              ) : null}
            </g>
          ))}
          <text x="18" y="150" className="fill-[#64748B] text-[11px] font-bold">
            {shortDate(first?.completedAt)}
          </text>
          <text x={viewWidth - 18} y="150" textAnchor="end" className="fill-[#64748B] text-[11px] font-bold">
            {shortDate(last?.completedAt)}
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[16px] bg-white px-3 py-2 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748B]">Checks</p>
          <p className="text-[18px] font-black text-[#2f2135]">{points.length}</p>
        </div>
        <div className="rounded-[16px] bg-white px-3 py-2 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748B]">Latest</p>
          <p className="text-[18px] font-black text-[#2f2135]">{current?.steps ?? report.tasksCompleted}/{current?.total ?? report.totalTasks}</p>
        </div>
        <div className="rounded-[16px] bg-white px-3 py-2 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748B]">Domains</p>
          <p className="text-[18px] font-black text-[#2f2135]">{current?.domainCount ?? completedDomains(report).length}</p>
        </div>
      </div>
    </div>
  );
}

function domainTrendTone(trend: CognitiveAssessmentDomainTrend) {
  if (trend.direction === "up") return "text-[#047857] bg-[#ECFDF5]";
  if (trend.direction === "down") return "text-[#B45309] bg-[#FFF7ED]";
  if (trend.direction === "new") return "text-[#5B21B6] bg-[#F5F3FF]";
  if (trend.direction === "flat") return "text-[#1D4ED8] bg-[#EFF6FF]";
  return "text-[#766b63] bg-[#F8F4EF]";
}

function domainTrendLabel(trend: CognitiveAssessmentDomainTrend) {
  if (trend.direction === "new") return "new";
  if (trend.direction === "flat") return "steady";
  if (trend.direction === "none") return "open";
  if (trend.latestRawValue === null || trend.previousRawValue === null) return "changed";
  const delta = trend.latestRawValue - trend.previousRawValue;
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function trendDeltaMagnitude(trend: CognitiveAssessmentDomainTrend) {
  if (trend.latestRawValue === null || trend.previousRawValue === null) return trend.direction === "new" ? 0.5 : 0;
  return Math.abs(trend.latestRawValue - trend.previousRawValue);
}

function whatChangedItems(domainTrends: ReportDomainTrends) {
  const changed = domainTrends
    .filter((trend) => trend.latestRawValue !== null && trend.direction !== "none" && trend.direction !== "flat")
    .sort((left, right) => trendDeltaMagnitude(right) - trendDeltaMagnitude(left));

  if (changed.length > 0) return changed.slice(0, 3);

  return domainTrends
    .filter((trend) => trend.latestRawValue !== null)
    .slice(0, 3);
}

function contextSignals(taskSignals: ReportTaskSignals) {
  const contextTaskIds = new Set(["mood_screen", "sleep_energy", "function_iadl", "subjective_concern"]);
  return taskSignals.filter((signal) => contextTaskIds.has(signal.taskId));
}

function miniTrendCoordinates(points: ReportDomainTrendSeries[number]["points"]) {
  const numeric = points.filter((point) => point.rawValue !== null);
  const max = Math.max(1, ...numeric.map((point) => point.rawValue ?? 0));
  const min = Math.min(0, ...numeric.map((point) => point.rawValue ?? 0));
  const range = Math.max(1, max - min);
  const left = 8;
  const top = 8;
  const width = 196;
  const height = 46;

  return points.map((point, index) => {
    const x = points.length === 1 ? left + width / 2 : left + (index / (points.length - 1)) * width;
    const y = point.rawValue === null
      ? top + height
      : top + ((max - point.rawValue) / range) * height;
    return { ...point, x, y };
  });
}

function WhatChangedStrip({ domainTrends }: { domainTrends: ReportDomainTrends }) {
  const items = whatChangedItems(domainTrends);
  if (items.length === 0) return null;

  return (
    <div className="min-w-0 max-w-full rounded-[24px] border border-[#E8DED4] bg-white p-4 shadow-[0_10px_24px_rgba(63,45,35,0.045)]">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">What changed</p>
          <h2 className="mt-1 text-[22px] font-black leading-tight text-[#2f2135]">Since last check</h2>
        </div>
        <span className="flex-shrink-0 rounded-full bg-[#F5F3FF] px-3 py-1.5 text-xs font-black text-[#5B21B6]">Raw signals</span>
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((trend) => (
          <div key={trend.domainId} className="flex min-h-[48px] min-w-0 items-center justify-between gap-3 rounded-[16px] bg-[#FBF8F4] px-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-black text-[#2f2135]">{trend.label}</span>
              <span className="block truncate text-[12px] font-bold text-[#766b63]">{trend.valueLabel}</span>
            </span>
            <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[12px] font-black ${domainTrendTone(trend)}`}>
              {domainTrendLabel(trend)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function checkQualityTone(checkQuality: ReportCheckQuality) {
  if (checkQuality.status === "good") return "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]";
  if (checkQuality.status === "partial") return "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]";
  return "border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]";
}

function comparisonConfidencePercent(checkQuality: ReportCheckQuality, report: CognitiveAssessmentReport) {
  const statusBase = checkQuality.status === "good" ? 88 : checkQuality.status === "partial" ? 68 : 42;
  const coverage = completionPercent(report);
  return Math.min(100, Math.max(24, Math.round((statusBase * 0.65) + (coverage * 0.35))));
}

function comparisonConfidenceLabel(checkQuality: ReportCheckQuality) {
  if (checkQuality.status === "good") return "High";
  if (checkQuality.status === "partial") return "Useful";
  return "Building";
}

function primaryInsightTrend(domainTrends: ReportDomainTrends) {
  const active = domainTrends.filter((trend) => trend.latestRawValue !== null && trend.direction !== "none");
  const changed = active
    .filter((trend) => trend.direction !== "flat")
    .sort((left, right) => trendDeltaMagnitude(right) - trendDeltaMagnitude(left));

  return changed[0] ?? active[0] ?? null;
}

function primaryTrendHeadline(trend: CognitiveAssessmentDomainTrend | null) {
  if (!trend) return "No signal yet";
  if (trend.direction === "new") return `${trend.label} saved`;
  if (trend.direction === "flat") return `${trend.label} steady`;
  if (trend.latestRawValue !== null && trend.previousRawValue !== null) {
    const delta = trend.latestRawValue - trend.previousRawValue;
    return `${trend.label} ${delta > 0 ? `+${delta}` : delta}`;
  }
  return trend.label;
}

function compactContextDetail(contextInsight: ReportContextInsight) {
  if (contextInsight.relatedSignals.length > 0) return contextInsight.relatedSignals[0];
  if (contextInsight.tone === "building") return "Add mood, sleep, and daily function";
  return "Saved for comparison";
}

function insightSnapshotItems(
  report: CognitiveAssessmentReport,
  domainTrends: ReportDomainTrends,
  checkQuality: ReportCheckQuality,
  contextInsight: ReportContextInsight,
) {
  const trend = primaryInsightTrend(domainTrends);
  const remaining = remainingAreas(report);
  const action = bestNextAction(remaining, checkQuality, contextInsight);

  return [
    {
      id: "change",
      label: trend?.direction === "new" ? "New signal" : "Most changed",
      value: primaryTrendHeadline(trend),
      detail: trend ? domainTrendPlainCopy(trend) : "Finish a step to start tracking.",
      icon: <Activity size={19} />,
      tone: "border-[#BBF7D0] bg-[#F4FFFB] text-[#047857]",
    },
    {
      id: "coverage",
      label: "Coverage",
      value: `${report.tasksCompleted}/${report.totalTasks} steps`,
      detail: coverageMeaning(report),
      icon: <ClipboardList size={19} />,
      tone: "border-[#DDD6FE] bg-[#F7F3FF] text-[#5B21B6]",
    },
    {
      id: "context",
      label: "Context",
      value: contextInsight.label,
      detail: compactContextDetail(contextInsight),
      icon: <ShieldCheck size={19} />,
      tone: contextInsightTone(contextInsight),
    },
    {
      id: "next",
      label: "Next",
      value: action.title,
      detail: remaining.length ? `${remaining.length} step${remaining.length === 1 ? "" : "s"} remaining` : "Ready to compare later",
      icon: <Target size={19} />,
      tone: "border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]",
    },
  ];
}

function ComparisonConfidenceMeter({
  checkQuality,
  report,
}: {
  checkQuality: ReportCheckQuality;
  report: CognitiveAssessmentReport;
}) {
  const confidence = comparisonConfidencePercent(checkQuality, report);
  const label = comparisonConfidenceLabel(checkQuality);

  return (
    <div className={`min-w-0 rounded-[20px] border p-4 ${checkQualityTone(checkQuality)}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[11px] font-black uppercase tracking-[0.1em] opacity-80">Comparison confidence</span>
          <span className="mt-1 block truncate text-[22px] font-black leading-tight text-[#2f2135]">{label}</span>
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-[13px] font-black shadow-sm">{confidence}%</span>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/85">
        <div className="h-full rounded-full bg-current" style={{ width: `${confidence}%` }} />
      </div>
      <p className="mt-3 text-[12px] font-bold leading-snug opacity-85">{checkQuality.detail}</p>
      {checkQuality.factors.length > 0 ? (
        <div className="mt-3 flex max-w-full flex-wrap gap-2">
          {checkQuality.factors.slice(0, 4).map((factor) => (
            <span key={factor} className="max-w-full rounded-full bg-white px-2.5 py-1 text-[11px] font-black shadow-sm">
              {factor}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InsightSnapshotCard({
  report,
  domainTrends,
  checkQuality,
  contextInsight,
}: {
  report: CognitiveAssessmentReport;
  domainTrends: ReportDomainTrends;
  checkQuality: ReportCheckQuality;
  contextInsight: ReportContextInsight;
}) {
  const items = insightSnapshotItems(report, domainTrends, checkQuality, contextInsight);

  return (
    <div id="insight-snapshot" className="min-w-0 max-w-full overflow-hidden rounded-[26px] border border-[#DDD6FE] bg-white p-4 shadow-[0_14px_32px_rgba(63,45,35,0.07)] md:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Insight snapshot</p>
          <h2 className="mt-1 text-[24px] font-black leading-tight text-[#2f2135]">What to notice</h2>
        </div>
        <span className="flex-shrink-0 rounded-full bg-[#F5F3FF] px-3 py-1.5 text-xs font-black text-[#5B21B6]">Raw tracking</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(230px,0.8fr)]">
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className={`min-w-0 rounded-[18px] border px-3 py-3 ${item.tone}`}>
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] bg-white/85 shadow-sm">
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-black uppercase tracking-[0.1em] opacity-75">{item.label}</span>
                  <span className="mt-1 block truncate text-[15px] font-black leading-tight text-[#2f2135]">{item.value}</span>
                  <span className="mt-1 block truncate text-[12px] font-bold opacity-80">{item.detail}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        <ComparisonConfidenceMeter checkQuality={checkQuality} report={report} />
      </div>
    </div>
  );
}

function baselineTone(status: ReportBaselineBands[number]["status"]) {
  if (status === "usual") return "bg-[#ECFDF5] text-[#047857]";
  if (status === "above") return "bg-[#F5F3FF] text-[#5B21B6]";
  if (status === "below") return "bg-[#FFF7ED] text-[#B45309]";
  if (status === "not_checked") return "bg-[#F8F4EF] text-[#766b63]";
  return "bg-[#EFF6FF] text-[#1D4ED8]";
}

function baselineLabel(status: ReportBaselineBands[number]["status"]) {
  if (status === "usual") return "Usual";
  if (status === "above") return "Above usual";
  if (status === "below") return "Below usual";
  if (status === "not_checked") return "Open";
  return "Building";
}

function baselineRangeCopy(band: ReportBaselineBands[number]) {
  if (band.status === "building" || band.status === "not_checked") return band.rangeLabel;
  return `range ${band.rangeLabel}`;
}

function baselineSummary(baselineBands: ReportBaselineBands) {
  const above = baselineBands.filter((band) => band.status === "above").length;
  const below = baselineBands.filter((band) => band.status === "below").length;
  const usual = baselineBands.filter((band) => band.status === "usual").length;
  const building = baselineBands.filter((band) => band.status === "building").length;
  if (above > 0) return `${above} above usual`;
  if (below > 0) return `${below} below usual`;
  if (usual > 0) return `${usual} usual`;
  if (building > 0) return "Building";
  return "Open";
}

function PersonalBaselineCard({ baselineBands }: { baselineBands: ReportBaselineBands }) {
  if (baselineBands.length === 0) return null;

  return (
    <details className="group rounded-[24px] border border-[#E8DED4] bg-white p-4 shadow-[0_10px_24px_rgba(63,45,35,0.045)]">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Personal baseline</p>
            <h2 className="mt-1 text-[22px] font-black leading-tight text-[#2f2135]">Usual range</h2>
            <p className="mt-1 text-[12px] font-bold leading-snug text-[#766b63]">Compares this member only with recent checks.</p>
          </div>
          <span
            className="rounded-full bg-[#F5F3FF] px-3 py-1.5 text-xs font-black text-[#5B21B6]"
            title="Usual range compares this member only with their own recent checks."
          >
            {baselineSummary(baselineBands)}
          </span>
        </div>
      </summary>
      <div className="mt-3 grid gap-2">
        {baselineBands.map((band) => (
          <div key={band.domainId} className="rounded-[16px] bg-[#FBF8F4] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-black text-[#2f2135]">{band.label}</span>
                <span className="block truncate text-[12px] font-bold text-[#766b63]">
                  {band.valueLabel} - {baselineRangeCopy(band)}
                </span>
              </span>
              <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${baselineTone(band.status)}`}>
                {baselineLabel(band.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function contextInsightTone(contextInsight: ReportContextInsight) {
  if (contextInsight.tone === "changed") return "border-[#FED7AA] bg-[#FFF7ED] text-[#7C2D12]";
  if (contextInsight.tone === "steady") return "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]";
  return "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]";
}

function domainTrendPlainCopy(trend: CognitiveAssessmentDomainTrend) {
  if (trend.direction === "none") return "This domain has not been saved yet.";
  if (trend.direction === "new") return "This is the first saved signal for this domain.";
  if (trend.direction === "flat") return "This domain looks steady compared with the last check.";
  if (trend.direction === "up") return "This raw signal is higher than the previous check.";
  if (trend.direction === "down") return "This raw signal is lower than the previous check.";
  return "This signal changed since the previous check.";
}

function rawValueLabel(value: number | null) {
  return value === null ? "None yet" : String(value);
}

function ContextOverlay({
  taskSignals,
  contextInsight,
}: {
  taskSignals: ReportTaskSignals;
  contextInsight: ReportContextInsight;
}) {
  const signals = contextSignals(taskSignals);
  if (signals.length === 0 && contextInsight.tone !== "building") return null;

  return (
    <div className={`rounded-[24px] border p-4 shadow-[0_10px_24px_rgba(63,45,35,0.055)] ${contextInsightTone(contextInsight)}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em]">Context</p>
          <h2 className="mt-1 text-[22px] font-black leading-tight text-[#2f2135]">{contextInsight.label}</h2>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black shadow-sm">{signals.length} saved</span>
      </div>
      <p className="mt-2 text-[13px] font-bold leading-snug opacity-85">{contextInsight.detail}</p>
      {contextInsight.relatedSignals.length > 0 || signals.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(contextInsight.relatedSignals.length > 0 ? contextInsight.relatedSignals : signals.map((signal) => `${signal.label}: ${signal.valueLabel}`)).map((signal) => (
            <span key={signal} className="rounded-full bg-white px-3 py-2 text-[12px] font-black shadow-sm">
              {signal}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DomainMiniHistory({
  series,
  trend,
}: {
  series: ReportDomainTrendSeries[number] | null;
  trend: CognitiveAssessmentDomainTrend;
}) {
  const trendDetails = (
    <div className="mt-3 grid grid-cols-3 gap-2">
      <div className="rounded-[14px] bg-white px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8A7C73]">Latest</p>
        <p className="mt-1 text-[13px] font-black text-[#2f2135]">{trend.valueLabel}</p>
      </div>
      <div className="rounded-[14px] bg-white px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8A7C73]">Previous</p>
        <p className="mt-1 text-[13px] font-black text-[#2f2135]">{rawValueLabel(trend.previousRawValue)}</p>
      </div>
      <div className="rounded-[14px] bg-white px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8A7C73]">Change</p>
        <p className="mt-1 text-[13px] font-black text-[#2f2135]">{domainTrendLabel(trend)}</p>
      </div>
    </div>
  );

  if (!series || series.points.length === 0) {
    return (
      <div>
        {trendDetails}
        <p className="mt-3 text-[12px] font-bold text-[#766b63]">{domainTrendPlainCopy(trend)}</p>
      </div>
    );
  }
  const coordinates = miniTrendCoordinates(series.points);
  const numericCoordinates = coordinates.filter((point) => point.rawValue !== null);
  const polyline = numericCoordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  return (
    <div className="mt-3 rounded-[16px] bg-white p-3">
      <p className="mb-3 text-[12px] font-bold text-[#62564f]">{domainTrendPlainCopy(trend)}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#8A7C73]">Mini history</p>
        <p className="text-[12px] font-black text-[#2f2135]">{last?.valueLabel ?? "Not checked"}</p>
      </div>
      <svg
        className="mt-2 h-[68px] w-full overflow-visible"
        viewBox="0 0 212 70"
        role="img"
        aria-label={`${series.label} mini history`}
      >
        {[0, 1, 2].map((line) => {
          const y = 10 + line * 18;
          return <line key={line} x1="8" x2="204" y1={y} y2={y} stroke="#EFE7DE" strokeWidth="1" />;
        })}
        {numericCoordinates.length > 1 ? (
          <polyline
            points={polyline}
            fill="none"
            stroke="#14B8A6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        ) : null}
        {coordinates.map((point) => (
          <circle
            key={point.sessionId}
            cx={point.x}
            cy={point.y}
            r={point.rawValue === null ? 3 : 5}
            fill={point.rawValue === null ? "#D6CEC7" : "#14B8A6"}
            stroke="#FFFFFF"
            strokeWidth="3"
          />
        ))}
        <text x="8" y="68" className="fill-[#8A7C73] text-[10px] font-bold">
          {shortDate(first?.completedAt)}
        </text>
        <text x="204" y="68" textAnchor="end" className="fill-[#8A7C73] text-[10px] font-bold">
          {shortDate(last?.completedAt)}
        </text>
      </svg>
      {trendDetails}
    </div>
  );
}

function DomainTrendChart({
  domainTrends,
  domainTrendSeries,
}: {
  domainTrends: ReportDomainTrends;
  domainTrendSeries: ReportDomainTrendSeries;
}) {
  const trends = domainTrends.length > 0
    ? domainTrends
    : [
      "Memory",
      "Language",
      "Attention",
      "Reasoning",
      "Visual/Clock",
      "Mood/Sleep/Daily Context",
    ].map((label, index) => ({
      domainId: `empty-${index}`,
      label,
      latestRawValue: null,
      previousRawValue: null,
      direction: "none" as const,
      valueLabel: "Not checked",
    }));
  const maxValue = Math.max(1, ...trends.map((trend) => trend.latestRawValue ?? 0));
  const seriesByDomain = new Map(domainTrendSeries.map((series) => [series.domainId, series]));

  return (
    <div className="min-w-0 max-w-full rounded-[28px] border border-[#D9ECE4] bg-white p-5 shadow-[0_12px_28px_rgba(63,45,35,0.055)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#047857]">Domain trends</p>
          <h2 className="mt-1 text-[24px] font-black leading-tight text-[#2f2135]">Raw signals</h2>
        </div>
        <span className="rounded-full bg-[#ECFDF5] px-3 py-1.5 text-xs font-black text-[#047857]">
          Latest check
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {trends.map((trend) => {
          const width = trend.latestRawValue === null ? 8 : Math.max(10, (trend.latestRawValue / maxValue) * 100);
          return (
            <details
              key={trend.domainId}
              className="group rounded-[18px] border border-[#E8DED4] bg-[#FBF8F4] p-3"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[14px] font-black text-[#2f2135]">{trend.label}</p>
                  <span className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${domainTrendTone(trend)}`}>
                      {domainTrendLabel(trend)}
                    </span>
                    <ChevronRight size={17} className="text-[#9A8F87] transition-transform group-open:rotate-90" />
                  </span>
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-[#EFE7DE]">
                  <div
                    className="h-2.5 rounded-full bg-[#14B8A6]"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="mt-2 block text-[12px] font-black text-[#766b63]">{trend.valueLabel}</span>
              </summary>
              <DomainMiniHistory series={seriesByDomain.get(trend.domainId) ?? null} trend={trend} />
            </details>
          );
        })}
      </div>
    </div>
  );
}

function taskSignalForSection(section: CognitiveAssessmentTaskSummary, taskSignals: ReportTaskSignals) {
  return taskSignals.find((signal) => signal.taskId === section.taskId) ?? null;
}

function scoredSignalCount(taskSignals: ReportTaskSignals, report: CognitiveAssessmentReport) {
  if (taskSignals.length > 0) {
    return taskSignals.filter((signal) => !isContextSignal(signal) && signal.rawValue !== null).length;
  }
  return report.sections
    .filter((section) => !isContextSection(section))
    .filter((section) => visibleScoreLabel(section)).length;
}

function AssessmentAreaRow({
  section,
  taskSignals,
}: {
  section: CognitiveAssessmentTaskSummary;
  taskSignals: ReportTaskSignals;
}) {
  const signal = taskSignalForSection(section, taskSignals);
  const score = signal?.valueLabel ?? visibleScoreLabel(section) ?? "saved";

  return (
    <details className="group rounded-[18px] border border-[#E8DED4] bg-white px-4 py-3 shadow-[0_8px_18px_rgba(63,45,35,0.045)]">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-[#8A7C73]">{signal?.domain ?? section.domain}</span>
          <span className="block truncate text-[16px] font-black text-[#2f2135]">{section.label}</span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          <span className="rounded-full bg-[#F5F3FF] px-3 py-1 text-xs font-black text-[#5B21B6]">{score}</span>
          <ChevronRight size={19} className="text-[#9A8F87] transition-transform group-open:rotate-90" />
        </span>
      </summary>
      <div className="pb-1 pl-0 pr-8">
        <span className="mb-2 inline-flex rounded-full bg-[#F8F4EF] px-2.5 py-1 text-[11px] font-black text-[#766b63]">
          {signalStatusLabel(signal)}
        </span>
        <p className="text-[13px] font-bold leading-relaxed text-[#62564f]">{section.detail}</p>
      </div>
    </details>
  );
}

function signalStatusLabel(signal: ReportTaskSignals[number] | null) {
  if (!signal) return "Not checked";
  if (signal.kind === "saved") return "Saved only";
  if (signal.kind === "count") return "Count signal";
  return "Scored signal";
}

function bestNextAction(
  remaining: ReturnType<typeof remainingAreas>,
  checkQuality: ReportCheckQuality,
  contextInsight: ReportContextInsight,
) {
  if (remaining.length > 0) {
    return {
      title: `Finish ${remaining[0].label}`,
      detail: "Completing the next missing area will make the trend easier to compare.",
      button: "Continue check",
    };
  }
  if (checkQuality.status !== "good") {
    return {
      title: "Repeat under similar conditions",
      detail: "A future check with the same language, mode, and time of day will compare better.",
      button: "Start new check",
    };
  }
  if (contextInsight.tone === "changed") {
    return {
      title: "Review context",
      detail: "Look at mood, sleep, and daily function beside the thinking signals.",
      button: "Start new check later",
    };
  }
  return {
    title: "Repeat later",
    detail: "The report is ready for future comparison after the next check.",
    button: "Start new check",
  };
}

type WeeklyPracticeState = "done" | "today" | "later";

function practiceByTitle(title: string) {
  return Object.values(PRACTICE_RECOMMENDATIONS).find((practice) => practice.title === title) ?? null;
}

function weeklyPracticeItems(
  practices: PracticeRecommendation[],
  practiceStatus: ReturnType<typeof cognitiveAssessmentPracticeStatusForReport>,
) {
  const completedTitle = practiceStatus?.status === "completed" ? practiceStatus.practiceTitle : "";
  const completedPractice = completedTitle ? practiceByTitle(completedTitle) : null;
  const planPractices = completedPractice && !practices.some((practice) => practice.key === completedPractice.key)
    ? [completedPractice, ...practices.filter((practice) => practice.key !== completedPractice.key)].slice(0, 3)
    : practices;
  const activeIndex = planPractices.findIndex((practice) => practice.title !== completedTitle);
  const nextIndex = activeIndex === -1 ? 0 : activeIndex;

  return planPractices.map((practice, index) => {
    const state: WeeklyPracticeState = practice.title === completedTitle ? "done" : index === nextIndex ? "today" : "later";
    return { practice, state };
  });
}

function activeWeeklyPractice(items: ReturnType<typeof weeklyPracticeItems>) {
  return items.find((item) => item.state !== "done")?.practice ?? items[0]?.practice ?? PRACTICE_RECOMMENDATIONS.memory;
}

function WeeklyPracticePlan({
  items,
  onOpenPractice,
}: {
  items: ReturnType<typeof weeklyPracticeItems>;
  onOpenPractice: (practice: PracticeRecommendation) => void;
}) {
  const completed = items.filter((item) => item.state === "done").length;
  const progress = Math.round((completed / Math.max(1, items.length)) * 100);

  return (
    <section
      className="mt-4 rounded-[24px] border border-[#E8DED4] bg-[#FBF8F4] p-4"
      data-testid="assessment-weekly-plan"
      aria-labelledby="assessment-weekly-plan-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">This week</p>
          <h3 id="assessment-weekly-plan-title" className="mt-1 text-[22px] font-black leading-tight text-[#2f2135]">
            3 small practices
          </h3>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-[#6B21A8] shadow-sm">
          {completed}/{items.length}
        </span>
      </div>
      <span className="mt-3 block h-2 overflow-hidden rounded-full bg-white">
        <span className="block h-full rounded-full bg-[#7C3AED]" style={{ width: `${progress}%` }} />
      </span>

      <div className="mt-4 grid gap-2">
        {items.map(({ practice, state }, index) => {
          const Icon = practice.Icon;
          const label = state === "done" ? "Done" : state === "today" ? "Start" : "Later";
          const buttonLabel = state === "done" ? "Do again" : state === "today" ? "Start practice" : "Open";
          return (
            <button
              key={practice.key}
              type="button"
              onClick={() => onOpenPractice(practice)}
              className="group flex min-h-[74px] w-full items-center justify-between gap-3 rounded-[18px] border bg-white px-3 py-3 text-left shadow-sm transition-transform hover:-translate-y-0.5"
              style={{ borderColor: practice.tone.border }}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px]"
                  style={{ backgroundColor: practice.tone.bg, color: practice.tone.accent }}
                >
                  {state === "done" ? <CheckCircle2 size={22} /> : <Icon size={22} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-[#766b63]">
                    {index + 1}. {label}
                  </span>
                  <span className="mt-0.5 block truncate text-[16px] font-black text-[#2f2135]">{practice.title}</span>
                  <span className="mt-0.5 block truncate text-[12px] font-bold text-[#766b63]">
                    {practice.domainLabel} - {practice.minutes}
                  </span>
                </span>
              </span>
              <span
                className="flex-shrink-0 rounded-full px-3 py-2 text-[12px] font-black"
                style={{ backgroundColor: practice.tone.bg, color: practice.tone.accent }}
              >
                {buttonLabel}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PostAssessmentRecommendationPanel({
  report,
  taskSignals,
  domainTrends,
  baselineBands,
  checkQuality,
  contextInsight,
}: {
  report: CognitiveAssessmentReport;
  taskSignals: ReportTaskSignals;
  domainTrends: ReportDomainTrends;
  baselineBands: ReportBaselineBands;
  checkQuality: ReportCheckQuality;
  contextInsight: ReportContextInsight;
}) {
  const navigate = useNavigate();
  const outcome = outcomeCopy(report, checkQuality);
  const highlights = outcomeHighlights({ report, taskSignals, domainTrends, contextInsight });
  const practiceKey = primaryPracticeKey({ report, taskSignals, domainTrends, baselineBands, contextInsight });
  const practices = practiceSequence(practiceKey);
  const [practiceIntent, setPracticeIntent] = useState(() => cognitiveAssessmentPracticeStatusForReport(report.sessionId));

  useEffect(() => {
    setPracticeIntent(cognitiveAssessmentPracticeStatusForReport(report.sessionId));
  }, [report.sessionId]);

  const openPractice = (practice: PracticeRecommendation) => {
    const intent = startCognitiveAssessmentPractice({
      reportSessionId: report.sessionId,
      recommendedDomain: practice.key,
      practiceTitle: practice.title,
      route: practice.route,
    });
    setPracticeIntent(intent);
    navigate(practice.route, {
      state: intent,
    });
  };

  const practiceStatus = practiceIntent?.reportSessionId === report.sessionId ? practiceIntent : null;
  const weeklyItems = weeklyPracticeItems(practices, practiceStatus);
  const primary = activeWeeklyPractice(weeklyItems);
  const PrimaryIcon = primary.Icon;

  return (
    <div
      id="recommended-practice"
      className="min-w-0 max-w-full overflow-hidden rounded-[28px] border border-[#DDD6FE] bg-white p-5 shadow-[0_14px_32px_rgba(63,45,35,0.07)]"
      data-testid="post-assessment-recommendations"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-[#6B21A8]">
          <Sparkles size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">{outcome.label}</p>
          <h2 className="mt-1 text-[26px] font-black leading-tight text-[#2f2135]">{outcome.title}</h2>
          <p className="mt-2 text-[14px] font-bold leading-relaxed text-[#62564f]">{outcome.detail}</p>
        </div>
      </div>

      {practiceStatus ? (
        <div
          className="mt-4 flex items-start gap-3 rounded-[20px] border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-[#0F766E]"
          data-testid="assessment-practice-status"
        >
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white">
            <CheckCircle2 size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-black uppercase tracking-[0.1em]">
              {practiceStatus.status === "completed" ? "Practiced today" : "Practice started"}
            </span>
            <span className="mt-1 block text-[14px] font-black leading-snug text-[#2f2135]">
              {practiceStatus.status === "completed"
                ? `Good. You practiced ${practiceStatus.practiceTitle} after this check.`
                : `${practiceStatus.practiceTitle} is ready. Come back here after the activity to keep going.`}
            </span>
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.82fr)]">
        <div className="grid gap-2">
          {highlights.map((item) => (
            <div key={`${item.title}-${item.detail}`} className="flex min-h-[58px] items-start gap-3 rounded-[18px] bg-[#FBF8F4] px-3 py-3">
              <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#047857]">
                <CheckCircle2 size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-black text-[#2f2135]">{item.title}</span>
                <span className="mt-0.5 block text-[12px] font-bold leading-snug text-[#766b63]">{item.detail}</span>
              </span>
            </div>
          ))}
        </div>

        <div
          className="rounded-[22px] border p-4"
          style={{ borderColor: primary.tone.border, backgroundColor: primary.tone.bg, color: primary.tone.accent }}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white">
              <PrimaryIcon size={23} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.1em]">Recommended practice</p>
              <h3 className="mt-1 text-[22px] font-black leading-tight text-[#2f2135]">{primary.title}</h3>
              <p className="mt-1 text-[13px] font-bold leading-snug opacity-85">{primary.detail}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black shadow-sm">{primary.domainLabel}</span>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black shadow-sm">{primary.minutes}</span>
          </div>
          <p className="mt-3 rounded-[16px] bg-white px-3 py-2 text-[12px] font-black leading-relaxed text-[#2f2135] shadow-sm">
            <span className="block text-[10px] uppercase tracking-[0.12em] opacity-65">Why this practice</span>
            {primary.why}
          </p>
          <button
            type="button"
            onClick={() => openPractice(primary)}
            className="mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#2f2135] px-4 text-center text-[15px] font-black text-white shadow-[0_10px_24px_rgba(63,45,35,0.12)]"
            data-testid="button-start-recommended-practice"
          >
            Start recommended practice
            <ArrowRight size={19} />
          </button>
        </div>
      </div>

      <WeeklyPracticePlan items={weeklyItems} onOpenPractice={openPractice} />
    </div>
  );
}

function ReportGuidanceCard({ report }: { report: CognitiveAssessmentReport }) {
  if (report.recommendations.length === 0 && !report.disclaimer) return null;

  return (
    <details className="group rounded-[24px] border border-[#E8DED4] bg-white p-4 shadow-[0_10px_24px_rgba(63,45,35,0.055)]">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Use this report</span>
            <span className="mt-1 block text-[22px] font-black leading-tight text-[#2f2135]">Helpful next steps</span>
          </span>
          <span className="rounded-full bg-[#F5F3FF] px-3 py-1.5 text-xs font-black text-[#5B21B6]">
            Open
          </span>
        </div>
      </summary>
      <div className="mt-3 grid gap-2">
        {report.recommendations.slice(0, 3).map((item) => (
          <p key={item} className="flex gap-2 text-[13px] font-bold leading-relaxed text-[#62564f]">
            <CheckCircle2 className="mt-0.5 flex-shrink-0 text-[#047857]" size={17} />
            <span>{item}</span>
          </p>
        ))}
        {report.disclaimer ? (
          <p className="mt-1 rounded-[16px] bg-[#FBF8F4] px-3 py-2 text-[12px] font-bold leading-relaxed text-[#766b63]">
            {report.disclaimer}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function BestNextActionCard({
  remaining,
  checkQuality,
  contextInsight,
  onStart,
}: {
  remaining: ReturnType<typeof remainingAreas>;
  checkQuality: ReportCheckQuality;
  contextInsight: ReportContextInsight;
  onStart: () => void;
}) {
  const action = bestNextAction(remaining, checkQuality, contextInsight);
  return (
    <div id="report-actions" className="rounded-[24px] border border-[#DDD6FE] bg-white p-4 shadow-[0_12px_28px_rgba(63,45,35,0.06)]">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Best next action</p>
      <h2 className="mt-1 text-[24px] font-black leading-tight text-[#2f2135]">{action.title}</h2>
      <p className="mt-2 text-[14px] font-bold leading-relaxed text-[#62564f]">{action.detail}</p>
      <button
        type="button"
        onClick={onStart}
        className="mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#2f2135] px-4 text-[15px] font-black text-white shadow-[0_10px_24px_rgba(63,45,35,0.12)]"
      >
        <PlayCircle size={20} />
        {action.button}
      </button>
    </div>
  );
}

function ReportView({
  report,
  title,
  history,
  trendPoints,
  domainTrends,
  domainTrendSeries,
  taskSignals,
  baselineBands,
  checkQuality,
  contextInsight,
}: {
  report: CognitiveAssessmentReport;
  title: string;
  history: ReportHistory;
  trendPoints: ReportTrendPoints;
  domainTrends: ReportDomainTrends;
  domainTrendSeries: ReportDomainTrendSeries;
  taskSignals: ReportTaskSignals;
  baselineBands: ReportBaselineBands;
  checkQuality: ReportCheckQuality;
  contextInsight: ReportContextInsight;
}) {
  const navigate = useNavigate();
  const percent = completionPercent(report);
  const thinkingDomainList = thinkingDomains(report);
  const thinkingTaskSignals = taskSignals.filter((signal) => !isContextSignal(signal));
  const thinkingSections = report.sections.filter((section) => !isContextSection(section));
  const scoreSignals = scoredSignalCount(taskSignals, report);
  const remaining = remainingAreas(report);
  const signalTotal = thinkingTaskSignals.length || thinkingSections.length || 0;
  const latestPoint = progressPoints(report, history, trendPoints).find((point) => point.isCurrent);
  const domainTotal = latestPoint?.domainCount ?? thinkingDomainList.length;
  const signalDetail = signalTotal === 0 ? "No saved signals" : `${signalTotal} saved`;
  const snapshotCopy = report.tasksCompleted >= report.totalTasks
    ? "Baseline ready for future comparison"
    : `Next: ${nextPriorityLabel(report)}`;

  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-8">
      <ReportHeader
        title={title}
        subtitle={`${formatDate(report.completedAt)} - ${report.tasksCompleted}/${report.totalTasks} steps saved`}
      />

      <section className="mx-auto grid w-full max-w-[1100px] min-w-0 gap-4 overflow-x-hidden px-5 pt-5 md:px-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] lg:items-start lg:px-8">
        <div className="grid min-w-0 gap-4">
          <div id="latest-snapshot" className="min-w-0 max-w-full overflow-hidden rounded-[30px] border border-[#DDD6FE] bg-white p-5 shadow-[0_18px_40px_rgba(63,45,35,0.08)] md:p-6">
            <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
              <div
                className="flex h-[112px] w-[112px] flex-shrink-0 items-center justify-center rounded-full sm:h-[124px] sm:w-[124px]"
                style={{ background: `conic-gradient(#7C3AED ${percent}%, #EFE7DE ${percent}% 100%)` }}
                aria-label={`${percent}% complete`}
              >
                <div className="flex h-[82px] w-[82px] flex-col items-center justify-center rounded-full bg-white text-center sm:h-[92px] sm:w-[92px]">
                  <span className="text-[26px] font-black leading-none text-[#2f2135] sm:text-[30px]">{percent}%</span>
                  <span className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#766b63]">complete</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Current snapshot</p>
                <h2 className="mt-1 text-[28px] font-black leading-[1.03] text-[#2f2135] md:text-[34px]">{completionLabel(report)}</h2>
                <p className="mt-2 text-[15px] font-bold leading-relaxed text-[#62564f]">{snapshotCopy}</p>
              </div>
            </div>
          </div>

          <InsightSnapshotCard
            report={report}
            domainTrends={domainTrends}
            checkQuality={checkQuality}
            contextInsight={contextInsight}
          />

          <StrengthMapCard
            report={report}
            taskSignals={taskSignals}
            domainTrends={domainTrends}
            baselineBands={baselineBands}
            contextInsight={contextInsight}
          />

          <div id="domain-trends">
            <DomainTrendChart domainTrends={domainTrends} domainTrendSeries={domainTrendSeries} />
          </div>

          <PostAssessmentRecommendationPanel
            report={report}
            taskSignals={taskSignals}
            domainTrends={domainTrends}
            baselineBands={baselineBands}
            checkQuality={checkQuality}
            contextInsight={contextInsight}
          />

          <WhatChangedStrip domainTrends={domainTrends} />

          <ProgressionChart report={report} history={history} trendPoints={trendPoints} />

          <PersonalBaselineCard baselineBands={baselineBands} />
        </div>

        <aside className="grid min-w-0 gap-4 lg:sticky lg:top-[84px]">
          <div className="grid grid-cols-2 gap-3">
            <MetricTile
              icon={<ClipboardList size={22} />}
              label="Coverage"
              value={`${percent}%`}
              detail={coverageMeaning(report)}
              className="border-[#DDD6FE] bg-[#F5F3FF] text-[#5B21B6]"
              targetId="latest-snapshot"
            />
            <MetricTile
              icon={<Activity size={22} />}
              label="Domains"
              value={`${domainTotal}`}
              detail={shortList(thinkingDomainList, "None yet", 2)}
              className="border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
              targetId="domain-trends"
            />
            <MetricTile
              icon={<BarChart3 size={22} />}
              label="Thinking"
              value={`${scoreSignals}/${signalTotal}`}
              detail={signalDetail}
              className="border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"
              targetId="areas-checked"
            />
            <MetricTile
              icon={<Target size={22} />}
              label="Next"
              value={nextPriorityLabel(report)}
              detail={remaining.length ? `${remaining.length} step${remaining.length === 1 ? "" : "s"} remaining` : "No missing areas"}
              className="border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]"
              valueClassName="text-[21px] leading-tight"
              targetId="report-actions"
            />
          </div>

          <ContextOverlay taskSignals={taskSignals} contextInsight={contextInsight} />

          <div id="areas-checked" className="grid gap-3 scroll-mt-4">
            <h2 className="px-1 text-[24px] font-black leading-tight text-[#2f2135]">Areas checked</h2>
            {report.sections.map((section) => (
              <AssessmentAreaRow key={`${section.taskId}-${section.label}`} section={section} taskSignals={taskSignals} />
            ))}
          </div>

          {report.sections.length === 0 ? (
            <div className="rounded-[24px] border border-[#E8DED4] bg-white p-5 text-[15px] font-bold text-[#766b63]">
              No assessment areas have been saved in this report yet.
            </div>
          ) : null}

          <div className="grid gap-3">
            <BestNextActionCard
              remaining={remaining}
              checkQuality={checkQuality}
              contextInsight={contextInsight}
              onStart={() => navigate("/mind-memory/cognitive-assessment/start")}
            />

            <ReportGuidanceCard report={report} />

            <button
              type="button"
              onClick={() => navigate("/mind-memory/cognitive-assessment/history")}
              className="flex min-h-[64px] w-full items-center justify-between rounded-[22px] border border-[#E8DED4] bg-white px-4 text-left shadow-[0_10px_24px_rgba(63,45,35,0.055)]"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#FFF7ED] text-[#B45309]">
                  <History size={23} />
                </span>
                <span>
                  <span className="block text-[17px] font-black text-[#2f2135]">Report history</span>
                  <span className="sr-only">Past checks and trends</span>
                </span>
              </span>
              <ChevronRight size={24} className="text-[#9A8F87]" />
            </button>
          </div>

          <p className="px-1 text-[12px] font-bold leading-relaxed text-[#766b63]">Tracking signals are not a diagnosis.</p>
        </aside>
      </section>
    </main>
  );
}

function HistoryView({
  history,
  historyInsights,
}: {
  history: CognitiveAssessmentHistoryResponse["history"];
  historyInsights: ReportHistoryInsights;
}) {
  const navigate = useNavigate();
  const insightsBySession = new Map(historyInsights.map((insight) => [insight.sessionId, insight]));
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-8">
      <ReportHeader title="Report history" subtitle="Past Mind & Memory checks stay available here." />
      <section className="grid gap-3 px-5 pt-5">
        {history.length === 0 ? (
          <div className="rounded-[24px] border border-[#E8DED4] bg-white p-5 text-[15px] font-bold text-[#766b63]">
            No completed checks yet.
          </div>
        ) : history.map((item) => {
          const insight = insightsBySession.get(item.sessionId);
          const percent = insight?.completionPercent ?? Math.round((item.tasksCompleted / Math.max(1, item.totalTasks)) * 100);
          return (
            <button
              key={item.sessionId}
              type="button"
              onClick={() => navigate(`/mind-memory/cognitive-assessment/report/${item.sessionId}`)}
              className="rounded-[22px] border border-[#E8DED4] bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(63,45,35,0.055)]"
            >
              <span className="flex min-w-0 items-start justify-between gap-3">
                <span className="flex min-w-0 items-start gap-3">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-[#6B21A8]">
                    <CalendarDays size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[17px] font-black text-[#2f2135]">{formatDate(item.completedAt)}</span>
                    <span className="mt-1 block text-[13px] font-bold text-[#766b63]">
                      {insight?.biggestChangeLabel ?? `${item.tasksCompleted}/${item.totalTasks} steps`}
                    </span>
                  </span>
                </span>
                <span className="flex flex-shrink-0 items-center gap-2">
                  <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-black text-[#1D4ED8]">{percent}%</span>
                  <ChevronRight size={22} className="text-[#9A8F87]" />
                </span>
              </span>
              <span className="mt-3 flex flex-wrap gap-2 pl-14">
                <span className="rounded-full bg-[#F8F4EF] px-2.5 py-1 text-[11px] font-black text-[#766b63]">
                  {insight?.contextLabel ?? item.language}
                </span>
                <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-black text-[#047857]">
                  {insight?.comparisonLabel ?? item.inputMode}
                </span>
                <span className="rounded-full bg-[#F5F3FF] px-2.5 py-1 text-[11px] font-black text-[#5B21B6]">
                  {item.tasksCompleted}/{item.totalTasks} steps
                </span>
              </span>
            </button>
          );
        })}
      </section>
    </main>
  );
}

export default function CognitiveAssessmentReportPage() {
  const location = useLocation();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const isHistory = location.pathname.endsWith("/history");
  const reportUrl = sessionId
    ? `/api/cognitive-assessment/reports/${sessionId}`
    : "/api/cognitive-assessment/latest-report";
  const reportQuery = useQuery<CognitiveAssessmentLatestReportResponse>({
    queryKey: [reportUrl],
    enabled: !isHistory,
    refetchOnMount: "always",
  });
  const historyQuery = useQuery<CognitiveAssessmentHistoryResponse>({
    queryKey: ["/api/cognitive-assessment/history"],
    enabled: true,
    refetchOnMount: "always",
  });

  if ((!isHistory && reportQuery.isLoading) || (isHistory && historyQuery.isLoading)) return <LoadingState />;
  if ((!isHistory && reportQuery.isError) || (isHistory && historyQuery.isError)) return <ErrorState />;
  if (isHistory) {
    return <HistoryView history={historyQuery.data?.history ?? []} historyInsights={historyQuery.data?.historyInsights ?? []} />;
  }

  const report = reportQuery.data?.report ?? null;
  if (!report || location.pathname.endsWith("/start")) return <NoReportState />;
  const historyData = historyQuery.data;
  return (
    <ReportView
      report={report}
      title={sessionId ? "Saved report" : "Latest report"}
      history={historyData?.history ?? []}
      trendPoints={historyData?.trendPoints ?? []}
      domainTrends={historyData?.domainTrends ?? []}
      domainTrendSeries={historyData?.domainTrendSeries ?? []}
      taskSignals={historyData?.taskSignals ?? []}
      baselineBands={historyData?.baselineBands ?? []}
      checkQuality={historyData?.checkQuality ?? DEFAULT_CHECK_QUALITY}
      contextInsight={historyData?.contextInsight ?? DEFAULT_CONTEXT_INSIGHT}
    />
  );
}
