import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CognitiveAssessmentReportPage from "./CognitiveAssessmentReportPage";
import type {
  CognitiveAssessmentHistoryResponse,
  CognitiveAssessmentReport,
} from "../../shared/cognitiveAssessmentReport";

const useQueryMock = vi.hoisted(() => vi.fn());
const assessmentPracticeStorageKey = "cognitiveAssessment:recommendedPractice:v1";

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
}));

const sampleReport: CognitiveAssessmentReport = {
  sessionId: "session-1",
  startedAt: "2026-07-04T10:00:00.000Z",
  completedAt: "2026-07-04T10:12:00.000Z",
  language: "en",
  inputMode: "wizard",
  tasksCompleted: 2,
  totalTasks: 12,
  overview: "2 of 12 assessment steps are saved in the latest Mind & Memory check.",
  trend: "This is the first saved Cognitive Assessment report for this member.",
  sections: [
    {
      taskId: "story_recall_immediate",
      label: "Story recall",
      domain: "Memory",
      status: "completed",
      detail: "3 story details recalled.",
      scoreLabel: "1",
    },
    {
      taskId: "similarities",
      label: "Similarities",
      domain: "Reasoning",
      status: "completed",
      detail: "4 of 4 answers saved.",
      scoreLabel: "4/8",
    },
  ],
  recommendations: [
    "Repeat the check under similar conditions so changes over time are easier to compare.",
    "Share meaningful changes with a trusted caregiver or clinician if the member is worried.",
    "Use this together with sleep, mood, medicines, and daily function context rather than as a standalone answer.",
  ],
  disclaimer: "This is a wellness check to help notice changes over time. It does not diagnose a medical condition.",
};

const completeReport: CognitiveAssessmentReport = {
  ...sampleReport,
  sessionId: "session-complete",
  startedAt: "2026-07-05T09:00:00.000Z",
  completedAt: "2026-07-05T09:18:00.000Z",
  tasksCompleted: 12,
  totalTasks: 12,
  overview: "12 of 12 assessment steps are saved in the latest Mind & Memory check.",
  trend: "The full Cognitive Assessment baseline is ready for future comparison.",
  sections: [
    { taskId: "orientation", label: "Orientation", domain: "Awareness", status: "completed", detail: "Date and place saved.", scoreLabel: "saved" },
    { taskId: "story_recall_immediate", label: "Story recall", domain: "Memory", status: "completed", detail: "5 story details recalled.", scoreLabel: "5" },
    { taskId: "fluency_semantic", label: "Category fluency", domain: "Language", status: "completed", detail: "12 category words saved.", scoreLabel: "12" },
    { taskId: "fluency_phonemic", label: "Letter fluency", domain: "Language", status: "completed", detail: "9 letter words saved.", scoreLabel: "9" },
    { taskId: "digit_span", label: "Digit span", domain: "Attention", status: "completed", detail: "Forward and backward span saved.", scoreLabel: "6" },
    { taskId: "similarities", label: "Similarities", domain: "Reasoning", status: "completed", detail: "6 of 8 answers saved.", scoreLabel: "6/8" },
    { taskId: "clock_drawing", label: "Clock drawing", domain: "Visual thinking", status: "completed", detail: "Clock drawing signal saved.", scoreLabel: "4/5" },
    { taskId: "story_recall_delayed", label: "Delayed recall", domain: "Memory", status: "completed", detail: "4 delayed story details recalled.", scoreLabel: "4" },
    { taskId: "mood_screen", label: "Mood check", domain: "Mood", status: "completed", detail: "Mood context saved.", scoreLabel: "saved" },
    { taskId: "sleep_energy", label: "Sleep and energy", domain: "Sleep", status: "completed", detail: "Sleep and energy context saved.", scoreLabel: "saved" },
    { taskId: "function_iadl", label: "Daily function", domain: "Daily function", status: "completed", detail: "Daily function context saved.", scoreLabel: "saved" },
    { taskId: "subjective_concern", label: "Memory concern", domain: "Self concern", status: "completed", detail: "Concern context saved.", scoreLabel: "saved" },
  ],
};

const sampleHistory: CognitiveAssessmentHistoryResponse["history"] = [
  {
    sessionId: "session-older",
    completedAt: "2026-06-20T10:12:00.000Z",
    language: "en",
    inputMode: "wizard",
    tasksCompleted: 1,
    totalTasks: 12,
    overview: "1 of 12 assessment steps saved.",
  },
  {
    sessionId: "session-1",
    completedAt: "2026-07-04T10:12:00.000Z",
    language: "en",
    inputMode: "wizard",
    tasksCompleted: 2,
    totalTasks: 12,
    overview: "2 of 12 assessment steps saved.",
  },
];

const sampleHistoryResponse: CognitiveAssessmentHistoryResponse = {
  history: sampleHistory,
  historyInsights: [
    {
      sessionId: "session-older",
      completionPercent: 8,
      completedSteps: 1,
      totalSteps: 12,
      thinkingDomainCount: 1,
      biggestChangeLabel: "First saved check",
      contextLabel: "Context open",
      comparisonLabel: "First saved check",
    },
    {
      sessionId: "session-1",
      completionPercent: 17,
      completedSteps: 2,
      totalSteps: 12,
      thinkingDomainCount: 2,
      biggestChangeLabel: "Memory +1",
      contextLabel: "Context saved",
      comparisonLabel: "Compared with previous",
    },
  ],
  trendPoints: [
    {
      sessionId: "session-older",
      completedAt: "2026-06-20T10:12:00.000Z",
      completionPercent: 8,
      completedSteps: 1,
      totalSteps: 12,
      domainCount: 1,
    },
    {
      sessionId: "session-1",
      completedAt: "2026-07-04T10:12:00.000Z",
      completionPercent: 17,
      completedSteps: 2,
      totalSteps: 12,
      domainCount: 2,
    },
  ],
  domainTrends: [
    {
      domainId: "memory",
      label: "Memory",
      latestRawValue: 3,
      previousRawValue: 2,
      direction: "up",
      valueLabel: "3 words",
    },
    {
      domainId: "language",
      label: "Language",
      latestRawValue: null,
      previousRawValue: null,
      direction: "none",
      valueLabel: "Not checked",
    },
    {
      domainId: "attention",
      label: "Attention",
      latestRawValue: null,
      previousRawValue: null,
      direction: "none",
      valueLabel: "Not checked",
    },
    {
      domainId: "reasoning",
      label: "Reasoning",
      latestRawValue: 4,
      previousRawValue: 3,
      direction: "up",
      valueLabel: "4/8",
    },
    {
      domainId: "visual_clock",
      label: "Visual/Clock",
      latestRawValue: null,
      previousRawValue: null,
      direction: "none",
      valueLabel: "Not checked",
    },
    {
      domainId: "daily_context",
      label: "Mood/Sleep/Daily Context",
      latestRawValue: null,
      previousRawValue: null,
      direction: "none",
      valueLabel: "Not checked",
    },
  ],
  domainTrendSeries: [
    {
      domainId: "memory",
      label: "Memory",
      points: [
        {
          sessionId: "session-older",
          completedAt: "2026-06-20T10:12:00.000Z",
          rawValue: 2,
          valueLabel: "2 words",
        },
        {
          sessionId: "session-1",
          completedAt: "2026-07-04T10:12:00.000Z",
          rawValue: 3,
          valueLabel: "3 words",
        },
      ],
    },
    {
      domainId: "reasoning",
      label: "Reasoning",
      points: [
        {
          sessionId: "session-older",
          completedAt: "2026-06-20T10:12:00.000Z",
          rawValue: 3,
          valueLabel: "3/8",
        },
        {
          sessionId: "session-1",
          completedAt: "2026-07-04T10:12:00.000Z",
          rawValue: 4,
          valueLabel: "4/8",
        },
      ],
    },
  ],
  taskSignals: [
    {
      taskId: "story_recall_immediate",
      label: "Story recall",
      domain: "Memory",
      kind: "count",
      rawValue: 3,
      valueLabel: "3 words",
    },
    {
      taskId: "similarities",
      label: "Similarities",
      domain: "Reasoning",
      kind: "score",
      rawValue: 4,
      maxValue: 8,
      valueLabel: "4/8",
    },
    {
      taskId: "sleep_energy",
      label: "Sleep and energy",
      domain: "Mood/Sleep/Daily Context",
      kind: "score",
      rawValue: 5,
      valueLabel: "5",
    },
  ],
  baselineBands: [
    {
      domainId: "memory",
      label: "Memory",
      status: "building",
      valueLabel: "3 words",
      rangeLabel: "2 checks",
      detail: "Building a personal baseline.",
      sampleSize: 2,
    },
    {
      domainId: "reasoning",
      label: "Reasoning",
      status: "building",
      valueLabel: "4/8",
      rangeLabel: "2 checks",
      detail: "Building a personal baseline.",
      sampleSize: 2,
    },
  ],
  checkQuality: {
    status: "building",
    label: "Building comparison",
    detail: "Complete more areas before reading trends strongly.",
    factors: ["2/12 steps", "2 thinking domains", "Similar time of day"],
  },
  contextInsight: {
    tone: "changed",
    label: "Memory changed",
    detail: "Context was saved for comparison with thinking signals.",
    relatedSignals: ["Sleep and energy: 5"],
  },
};

const completeHistoryResponse: CognitiveAssessmentHistoryResponse = {
  ...sampleHistoryResponse,
  history: [
    ...sampleHistory,
    {
      sessionId: "session-complete",
      completedAt: "2026-07-05T09:18:00.000Z",
      language: "en",
      inputMode: "wizard",
      tasksCompleted: 12,
      totalTasks: 12,
      overview: "12 of 12 assessment steps saved.",
    },
  ],
  trendPoints: [
    ...sampleHistoryResponse.trendPoints,
    {
      sessionId: "session-complete",
      completedAt: "2026-07-05T09:18:00.000Z",
      completionPercent: 100,
      completedSteps: 12,
      totalSteps: 12,
      domainCount: 6,
    },
  ],
  domainTrends: sampleHistoryResponse.domainTrends.map((trend) => ({
    ...trend,
    direction: trend.latestRawValue === null ? "none" : "flat",
  })),
  taskSignals: [
    { taskId: "story_recall_immediate", label: "Story recall", domain: "Memory", kind: "count", rawValue: 5, valueLabel: "5 words" },
    { taskId: "fluency_semantic", label: "Category fluency", domain: "Language", kind: "count", rawValue: 12, valueLabel: "12 words" },
    { taskId: "fluency_phonemic", label: "Letter fluency", domain: "Language", kind: "count", rawValue: 9, valueLabel: "9 words" },
    { taskId: "digit_span", label: "Digit span", domain: "Attention", kind: "score", rawValue: 6, maxValue: 8, valueLabel: "6/8" },
    { taskId: "similarities", label: "Similarities", domain: "Reasoning", kind: "score", rawValue: 6, maxValue: 8, valueLabel: "6/8" },
    { taskId: "clock_drawing", label: "Clock drawing", domain: "Visual thinking", kind: "score", rawValue: 4, maxValue: 5, valueLabel: "4/5" },
    { taskId: "story_recall_delayed", label: "Delayed recall", domain: "Memory", kind: "count", rawValue: 4, valueLabel: "4 words" },
    { taskId: "sleep_energy", label: "Sleep and energy", domain: "Mood/Sleep/Daily Context", kind: "score", rawValue: 5, valueLabel: "5" },
  ],
  checkQuality: {
    status: "good",
    label: "Good comparison",
    detail: "Enough areas were completed for a clear baseline.",
    factors: ["12/12 steps", "6 thinking domains", "Similar time of day"],
  },
  contextInsight: {
    tone: "steady",
    label: "Context steady",
    detail: "Mood, sleep, and daily function are saved for comparison.",
    relatedSignals: ["Sleep and energy: 5"],
  },
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

function renderReport(
  report: CognitiveAssessmentReport = sampleReport,
  historyResponse: CognitiveAssessmentHistoryResponse = sampleHistoryResponse,
  initialPath = "/mind-memory/cognitive-assessment/report",
) {
  useQueryMock.mockImplementation(({ queryKey, enabled }: { queryKey: string[]; enabled?: boolean }) => {
    if (enabled === false) return { isLoading: false, isError: false, data: undefined };
    const key = queryKey[0];
    if (key === "/api/cognitive-assessment/history") {
      return { isLoading: false, isError: false, data: historyResponse };
    }
    return { isLoading: false, isError: false, data: { report } };
  });

  return render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={[initialPath]}
    >
      <Routes>
        <Route path="/mind-memory/cognitive-assessment/*" element={<CognitiveAssessmentReportPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CognitiveAssessmentReportPage", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    window.localStorage.clear();
  });

  it("renders a chart-led member report with compact tracking signals", () => {
    renderReport();

    expect(screen.getByText("Early snapshot")).toBeInTheDocument();
    expect(screen.getAllByText("17%").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Progression")).toBeInTheDocument();
    expect(screen.getByText("+9 pts since last check")).toBeInTheDocument();
    expect(screen.getByText("Insight snapshot")).toBeInTheDocument();
    expect(screen.getByText("What to notice")).toBeInTheDocument();
    expect(screen.getByTestId("assessment-strength-map")).toHaveTextContent("Strength map");
    expect(screen.getByText("Bright spot")).toBeInTheDocument();
    expect(screen.getByText("Focus next")).toBeInTheDocument();
    expect(screen.getByTestId("assessment-weekly-plan")).toHaveTextContent("3 small practices");
    expect(screen.getByTestId("assessment-weekly-plan")).toHaveTextContent("0/3");
    expect(screen.getByText("Most changed")).toBeInTheDocument();
    expect(screen.getByText("Memory +1")).toBeInTheDocument();
    expect(screen.getByText("Comparison confidence")).toBeInTheDocument();
    expect(screen.getAllByText("Raw tracking").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("What changed")).toBeInTheDocument();
    expect(screen.getByText("Since last check")).toBeInTheDocument();
    expect(screen.getByText("Personal baseline")).toBeInTheDocument();
    expect(screen.getByText("Usual range")).toBeInTheDocument();
    expect(screen.getAllByText("Building").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Domain trends")).toBeInTheDocument();
    expect(screen.getAllByText("Raw signals").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Mood/Sleep/Daily Context")).toBeInTheDocument();
    expect(screen.getAllByText("Coverage").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Domains").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getAllByText("Next").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("10 left").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2 saved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Context").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Memory changed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Context was saved for comparison with thinking signals.")).toBeInTheDocument();
    expect(screen.getAllByText("Sleep and energy: 5").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("A first step is saved")).toBeInTheDocument();
    expect(screen.getByText("Recommended practice")).toBeInTheDocument();
    expect(screen.getByText("Why this practice")).toBeInTheDocument();
    expect(screen.getAllByText("Category Sort").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /start recommended practice/i })).toBeInTheDocument();
    expect(screen.getByText("Use this report")).toBeInTheDocument();
    expect(screen.getAllByText("Mini history").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Areas checked")).toBeInTheDocument();
    expect(screen.getByText("Best next action")).toBeInTheDocument();
    expect(screen.getAllByText("Finish Orientation").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("3 story details recalled.")).toBeInTheDocument();
    expect(screen.getAllByText("4/8").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Tracking signals are not a diagnosis.")).toBeInTheDocument();
    expect(screen.queryByText("Scientific basis")).not.toBeInTheDocument();
    expect(screen.queryByText("Coverage map")).not.toBeInTheDocument();
  });

  it("shows completed baseline guidance after all assessment steps are saved", () => {
    renderReport(completeReport, completeHistoryResponse);

    expect(screen.getByText("Complete baseline")).toBeInTheDocument();
    expect(screen.getByText("Baseline ready for future comparison")).toBeInTheDocument();
    expect(screen.getByText("A clear starting map")).toBeInTheDocument();
    expect(screen.getByText("Ready for one small practice and future comparison.")).toBeInTheDocument();
    expect(screen.getByText("The report is ready for future comparison after the next check.")).toBeInTheDocument();
    expect(screen.getAllByText("Repeat later").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Finish Orientation/i)).not.toBeInTheDocument();
  });

  it("opens the recommended Brain Coach practice from the result", () => {
    renderReport();

    fireEvent.click(screen.getByRole("button", { name: /start recommended practice/i }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/brain-coach/activity/category_sort");
    expect(JSON.parse(window.localStorage.getItem(assessmentPracticeStorageKey) ?? "{}")).toEqual(expect.objectContaining({
      source: "cognitive_assessment_report",
      reportSessionId: "session-1",
      recommendedDomain: "reasoning",
      practiceTitle: "Category Sort",
      route: "/brain-coach/activity/category_sort",
      status: "opened",
    }));
  });

  it("shows when a recommended practice was completed from the report", () => {
    window.localStorage.setItem(assessmentPracticeStorageKey, JSON.stringify({
      source: "cognitive_assessment_report",
      reportSessionId: "session-complete",
      recommendedDomain: "reasoning",
      practiceTitle: "Category Sort",
      route: "/brain-coach/activity/category_sort",
      returnTo: "/mind-memory/cognitive-assessment",
      status: "completed",
      startedAt: "2026-07-05T09:20:00.000Z",
      completedAt: "2026-07-05T09:25:00.000Z",
    }));

    renderReport(completeReport, completeHistoryResponse);

    expect(screen.getByTestId("assessment-practice-status")).toHaveTextContent("Practiced today");
    expect(screen.getByText("Good. You practiced Category Sort after this check.")).toBeInTheDocument();
    expect(screen.getByTestId("assessment-weekly-plan")).toHaveTextContent("1/3");
    expect(screen.getByTestId("assessment-weekly-plan")).toHaveTextContent("Done");
    expect(screen.getByTestId("post-assessment-recommendations")).toHaveTextContent("Remember Later");
  });

  it("keeps report routes short when no saved report exists", () => {
    renderReport(null as unknown as CognitiveAssessmentReport);

    expect(screen.getByText("No report yet")).toBeInTheDocument();
    expect(screen.getByText("Your report will appear here")).toBeInTheDocument();
    expect(screen.getByText("Back to program")).toBeInTheDocument();
    expect(screen.queryByText("Scientific basis")).not.toBeInTheDocument();
  });

  it("handles a single-session trend state", () => {
    renderReport(sampleReport, {
      ...sampleHistoryResponse,
      history: [sampleHistory[1]],
      trendPoints: [sampleHistoryResponse.trendPoints[1]],
    });

    expect(screen.getAllByText("First saved check").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Domain trends")).toBeInTheDocument();
  });

  it("renders enriched compact history rows", () => {
    renderReport(sampleReport, sampleHistoryResponse, "/mind-memory/cognitive-assessment/history");

    expect(screen.getByText("Report history")).toBeInTheDocument();
    expect(screen.getByText("Memory +1")).toBeInTheDocument();
    expect(screen.getByText("Context saved")).toBeInTheDocument();
    expect(screen.getByText("Compared with previous")).toBeInTheDocument();
    expect(screen.getAllByText("17%").length).toBeGreaterThanOrEqual(1);
  });
});
