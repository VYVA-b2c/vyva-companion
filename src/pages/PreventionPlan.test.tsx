import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PreventionPlan, { type PreventionPlanData } from "./PreventionPlan";

const apiFetchMock = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "11111111-1111-4111-8111-111111111111" } }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const plan: PreventionPlanData = {
  id: "22222222-2222-4222-8222-222222222222",
  generated_at: "2026-08-01T09:00:00.000Z",
  pillar_heart: "steady",
  pillar_brain: "priority_focus",
  pillar_strength: "steady",
  pillar_nourishment: "thriving",
  pillar_calm: "needs_attention",
  priority_pillar: "brain",
  priority_intervention: "Try one short memory challenge",
  priority_why: "A short daily practice supports continuity.",
  plan_narrative_senior: "Karim, this month we are keeping your plan simple and practical.",
  plan_narrative_caregiver: "Monthly wellness plan generated from available signals.",
  recommendations: {
    heart: [{ action: "Keep your daily walk going", why: "Consistency supports your heart." }],
    brain: [{ action: "Try one short memory challenge", why: "A named challenge gives the day a clear finish." }],
    strength: [{ action: "Keep moving every day", why: "Any comfortable movement counts." }],
    nourishment: [{ action: "Keep water within easy reach", why: "Hydration supports energy." }],
    calm: [{ action: "Open the Breath Garden for two minutes", why: "Slow breathing can help." }],
  },
  source_signals: { vitals: true, medications: true, cognitive: true, mood: true, symptoms: false },
  trajectory: "first",
};

const pillarActions = {
  heart: {
    action_key: "heart:tai-chi",
    content_id: "daily-heart",
    content_type: "exercise",
    timing_guidance: "Afternoon",
    title: "Tai chi",
    detail: "A slow balance-friendly VYVA exercise for light movement, posture, and rhythm.",
    pillar: "heart",
    route: "/social-rooms/morning-movement/exercises/tai-chi",
    resource_label: "Mayo Clinic",
    resource_url: "https://www.youtube.com/watch?v=sjrEUD9RZqA",
    resource_title: "Mayo Clinic Minute: A little moving goes long way for heart health",
    duration_seconds: 60,
    safety_notes: "General wellness education only; choose comfortable movement.",
    prompt: "Help me make today's heart step easy.",
    source: "daily_content",
  },
  brain: {
    action_key: "brain:word-recall-challenge",
    content_id: "daily-brain",
    content_type: "tip",
    title: "Word recall challenge",
    detail: "Study a few words, hide them, then see what you remember.",
    pillar: "brain",
    route: "/memory-games/word_recall",
    resource_label: "Mayo Clinic",
    resource_url: "https://www.youtube.com/watch?v=hoPg4bkKemQ",
    resource_title: "Mayo Clinic Minute: Can the MIND diet improve brain health?",
    duration_seconds: 70,
    safety_notes: "General wellness education only.",
    prompt: "Help me choose a short word recall challenge today.",
    source: "daily_content",
  },
  strength: {
    action_key: "strength:clear-one-walking-path",
    content_id: "daily-strength",
    content_type: "tip",
    timing_guidance: "Afternoon or before an outing",
    title: "Clear one walking path",
    detail: "One clear route at home makes movement easier and steadier.",
    pillar: "strength",
    route: "/social-rooms/walking-route?source=longevity&intent=clear-walking-path",
    resource_label: "National Institute on Aging",
    resource_url: "https://www.youtube.com/watch?v=G1lwVhnnkoU",
    resource_title: "10-minute Workout for Older Adults",
    duration_seconds: 600,
    safety_notes: "Use support nearby and make movements smaller whenever needed.",
    prompt: "Help me make today's movement step easy.",
    source: "daily_content",
  },
  nourishment: {
    action_key: "nourishment:protein-with-the-next-meal",
    content_id: "daily-nourishment",
    content_type: "meal",
    title: "Protein with the next meal",
    detail: "Choose one familiar protein food so nourishment does not become complicated.",
    pillar: "nourishment",
    route: null,
    resource_label: "Mayo Clinic",
    resource_url: "https://www.youtube.com/watch?v=R41BXXGohsU",
    resource_title: "Mayo Clinic Minute: How to choose a healthy fat",
    duration_seconds: 60,
    safety_notes: "General nutrition education only; follow personal restrictions and clinician guidance.",
    prompt: "Help me make today's nourishment step easy.",
    source: "daily_content",
  },
  calm: {
    action_key: "calm:same-bedtime-tonight",
    content_id: "daily-calm",
    content_type: "tip",
    timing_guidance: "Evening",
    title: "Same bedtime tonight",
    detail: "A familiar evening time supports tomorrow's energy and attention.",
    pillar: "calm",
    route: "/games/breath-garden",
    resource_label: "Calm",
    resource_url: "https://www.youtube.com/watch?v=ZToicYcHIOU",
    resource_title: "Daily Calm | 10 Minute Mindfulness Meditation | Be Present",
    duration_seconds: 600,
    safety_notes: "Pause or stop if the exercise feels uncomfortable.",
    prompt: "Help me make today's calm step easy.",
    source: "daily_content",
  },
} as const;

const activeProgram = {
  id: "program-1",
  programKey: "starter_video_longevity_v1",
  title: "14-day VYVA longevity starter",
  status: "active",
  focusPillars: ["brain", "heart", "strength", "nourishment", "calm"],
  startDate: "2026-08-01",
  currentDay: 1,
  totalDays: 14,
  language: "en",
  cadence: "daily",
} as const;

const todayProgramStep = {
  id: "program-day-1",
  programId: activeProgram.id,
  dayIndex: 1,
  pillar: "brain",
  theme: "Memory starter",
  objective: "Watch one short visual guide, then keep memory practice familiar.",
  actionTitle: "3-2-1 memory lane",
  actionDetail: "Pick a real place. Name 3 things you see there, 2 sounds, and 1 person connected to it.",
  videoQuery: "MIND diet brain health short Mayo Clinic video",
  scheduledDate: "2026-08-01",
  status: "scheduled",
} as const;

const todayVideo = {
  id: "video-resource-1",
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
  pillar: "brain",
  transcriptStatus: "manual_reviewed",
  keyPoints: [
    "Brain-friendly eating works best as a simple pattern, not a perfect rule.",
    "One useful swap today is easier to keep than a full meal overhaul.",
  ],
  seniorTakeaway: "Use the video as a cue to choose one brain-friendly food today, then keep the memory step short.",
  transcriptSummary: "The video links everyday food patterns with simple brain support.",
  afterWatchAction: "Choose one familiar brain-friendly food today, then keep the memory step short.",
  goodFor: ["When breakfast or lunch is the easiest meal to change."],
  notFor: ["Respect allergies, preferences, and clinician guidance."],
  momentFit: ["afternoon"],
} as const;

const programAction = {
  action_key: "program:program-1:1:brain:3-2-1-memory-lane",
  content_id: todayProgramStep.id,
  title: "3-2-1 memory lane",
  detail: "This uses personal memory and storytelling, not a score.",
  pillar: "brain",
  route: null,
  prompt: "Help me with today's Longevity activity.",
  source: "program",
  challenge: {
    kind: "memory_prompt",
    prompt: todayProgramStep.actionDetail,
    hint: "Use a place you know well, such as your kitchen, a favorite street, or a holiday spot.",
    answer: null,
    followUp: "This uses personal memory and storytelling, not a score.",
  },
  gameOptions: [
    {
      id: "memory_lane",
      label: "Memory",
      title: "3-2-1 memory lane",
      kind: "memory_prompt",
      prompt: todayProgramStep.actionDetail,
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
  ],
} as const;

const companion = {
  plan,
  activeProgram,
  todayProgramStep,
  todayVideo,
  videoCurationStatus: "fallback",
  todayFocus: {
    pillar: "brain",
    label: "Brain and memory",
    headline: "Karim, today's memory starter",
    summary: todayProgramStep.objective,
  },
  activeMoment: "afternoon",
  todayTimeline: [
    {
      moment: "morning",
      label: "Morning",
      status: "past",
      startsAt: "05:00",
      title: "Breakfast protein anchor",
      reason: "A simple food cue starts the day steadier.",
      pillar: "nourishment",
      kind: "food",
    },
    {
      moment: "midday",
      label: "Midday",
      status: "past",
      startsAt: "11:00",
      title: "Lunch plate check",
      reason: "Lunch is the practical time for food and hydration.",
      pillar: "nourishment",
      kind: "food",
    },
    {
      moment: "afternoon",
      label: "Afternoon",
      status: "now",
      startsAt: "14:00",
      title: todayVideo.title,
      reason: todayVideo.selectedReason,
      pillar: "brain",
      kind: "video",
    },
    {
      moment: "evening",
      label: "Evening",
      status: "later",
      startsAt: "18:00",
      title: "Two-minute breath garden",
      reason: "The evening is better for a quieter reset than another task.",
      pillar: "calm",
      kind: "calm",
    },
  ],
  currentMomentSession: {
    moment: "afternoon",
    label: "Afternoon",
    status: "now",
    startsAt: "14:00",
    sessionFocus: "Karim, keep memory active with one short challenge today.",
    primaryExperience: {
      kind: "video",
      title: todayVideo.title,
      detail: todayVideo.selectedReason,
      pillar: "brain",
      ctaLabel: "Watch",
      action: programAction,
      video: todayVideo,
    },
    companionAction: programAction,
    optionalChoices: [],
    coveredPillars: [],
    whyThis: {
      summary: "Afternoon fits because no recent Brain Coach sessions are logged.",
      evidence: [
        "Afternoon: Make the afternoon mentally engaging.",
        "Program day 1: Memory starter.",
        "Curated video: Mayo Clinic Minute: Can the MIND diet improve brain health?.",
      ],
    },
  },
  nextMomentPreview: {
    moment: "evening",
    label: "Evening",
    status: "later",
    startsAt: "18:00",
    title: "Two-minute breath garden",
    reason: "The evening is better for a quieter reset than another task.",
    pillar: "calm",
    kind: "calm",
  },
  whyToday: "Brain and memory comes first today because no recent Brain Coach sessions are logged.",
  dailySession: {
    sessionFocus: "Karim, keep memory active with one short challenge today.",
    primaryExperience: {
      kind: "video",
      title: todayVideo.title,
      detail: todayVideo.selectedReason,
      pillar: "brain",
      ctaLabel: "Watch",
      action: programAction,
      video: todayVideo,
    },
    companionAction: programAction,
    optionalChoices: [pillarActions.heart, pillarActions.calm],
    coveredPillars: [
      {
        pillar: "heart",
        label: "Heart & circulation",
        status: "steady",
        actionTitle: pillarActions.heart.title,
        reason: pillarActions.heart.detail,
        evidence: "Heart and circulation is part of this monthly plan.",
      },
      {
        pillar: "brain",
        label: "Brain & memory",
        status: "priority_focus",
        actionTitle: pillarActions.brain.title,
        reason: pillarActions.brain.detail,
        evidence: "No recent Brain Coach sessions are logged.",
      },
      {
        pillar: "strength",
        label: "Strength & stability",
        status: "steady",
        actionTitle: pillarActions.strength.title,
        reason: pillarActions.strength.detail,
        evidence: "Strength and stability is part of this monthly plan.",
      },
      {
        pillar: "nourishment",
        label: "Nourishment",
        status: "thriving",
        actionTitle: pillarActions.nourishment.title,
        reason: pillarActions.nourishment.detail,
        evidence: "Nourishment is part of this monthly plan.",
      },
      {
        pillar: "calm",
        label: "Calm & recovery",
        status: "needs_attention",
        actionTitle: pillarActions.calm.title,
        reason: pillarActions.calm.detail,
        evidence: "Recent sleep check-ins are part of the plan.",
      },
    ],
    whyThis: {
      summary: "Brain and memory comes first today because no recent Brain Coach sessions are logged.",
      evidence: [
        "Program day 1: Memory starter.",
        "Curated video: Mayo Clinic Minute: Can the MIND diet improve brain health?.",
        "Brain Coach: No recent Brain Coach sessions are logged.",
      ],
    },
  },
  primaryAction: programAction,
  supportAction: pillarActions.calm,
  pillarActions,
  careSummary: {
    title: "Longevity summary for Karim",
    bullets: [
      "Program day 1: Memory starter.",
      "Video: Mayo Clinic Minute: Can the MIND diet improve brain health? (Mayo Clinic).",
      "Companion step: 3-2-1 memory lane.",
      "Brain and memory comes first today because no recent Brain Coach sessions are logged.",
      "Health areas considered: Heart and circulation; Brain and memory; Strength and stability; Nourishment; Calm and recovery.",
    ],
    share_text: "Longevity summary for Karim\n- Brain and memory comes first today because no recent Brain Coach sessions are logged.",
  },
  signalsUsed: [{
    id: "brain-no-sessions",
    label: "Brain Coach",
    detail: "No recent Brain Coach sessions are logged.",
    source: "brain",
    pillar: "brain",
    tone: "attention",
  }],
  dailyContent: {
    exercise: null,
    meal: null,
    tip: null,
    articles: [],
    byPillar: {
      heart: [],
      brain: [],
      strength: [],
      nourishment: [],
      calm: [],
    },
  },
  feedbackHistory: [],
};

function renderPlan() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/health/prevention-plan"]}>
        <Routes>
          <Route path="/health/prevention-plan" element={<PreventionPlan />} />
          <Route path="/chat" element={<div>VYVA chat destination</div>} />
          <Route path="/social-rooms/morning-movement/exercises/:exerciseId" element={<div data-testid="movement-exercise-route">Movement exercise route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PreventionPlan", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    vi.stubGlobal("open", vi.fn());
    apiFetchMock.mockImplementation((url: string) => {
      if (url === "/api/prevention/feedback") return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      return Promise.resolve({ ok: true, json: async () => companion });
    });
  });

  it("renders a guided daily companion session", async () => {
    renderPlan();
    expect(await screen.findByRole("heading", { name: "Mayo Clinic Minute: Can the MIND diet improve brain health?" })).toBeVisible();
    expect(screen.getByText("Afternoon")).toBeVisible();
    expect(screen.getByText("Curated video")).toBeVisible();
    expect(screen.getAllByText("Brain")[0]).toBeVisible();
    expect(screen.getByText("Mayo Clinic · 1:10")).toBeVisible();
    expect(screen.getByText("Connects one simple food choice with memory and energy for today.")).toBeVisible();
    expect(screen.getByText("Use the video as a cue to choose one brain-friendly food today, then keep the memory step short.")).not.toBeVisible();
    expect(screen.getByText("Brain-friendly eating works best as a simple pattern, not a perfect rule.")).not.toBeVisible();
    expect(screen.getByText("One useful swap today is easier to keep than a full meal overhaul.")).not.toBeVisible();
    fireEvent.click(screen.getByText("Why this?").closest("summary")!);
    expect(screen.getByText("From the video")).toBeVisible();
    expect(screen.getByText("Use the video as a cue to choose one brain-friendly food today, then keep the memory step short.")).toBeVisible();
    expect(screen.getByText("Brain-friendly eating works best as a simple pattern, not a perfect rule.")).toBeVisible();
    expect(screen.getByText("One useful swap today is easier to keep than a full meal overhaul.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Watch" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Today" })).not.toBeInTheDocument();
    expect(screen.queryByText("Companion step")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "3-2-1 memory lane" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not for me" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Later today" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pick a game")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Memory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Riddle" })).not.toBeInTheDocument();
    expect(screen.queryByText("Also useful today")).not.toBeInTheDocument();
    expect(screen.queryByText("Health areas checked")).not.toBeInTheDocument();
    expect(screen.queryByText("Walk after lunch")).not.toBeInTheDocument();
    expect(screen.queryByText("Clear one walking path")).not.toBeInTheDocument();
    expect(screen.queryByText("Protein with the next meal")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pillars" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Too hard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Not relevant" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask VYVA" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask VYVA about my plan" })).not.toBeInTheDocument();
    expect(screen.queryByText("Care-team summary")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Show / })).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Show Brain & memory" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Show Heart & circulation" })).toHaveAttribute("aria-pressed", "false");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/companion/11111111-1111-4111-8111-111111111111");
  });

  it("opens the exact curated YouTube video and records the open event", async () => {
    renderPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Watch" }));

    expect(window.open).toHaveBeenCalledWith("https://www.youtube.com/watch?v=hoPg4bkKemQ", "_blank", "noopener,noreferrer");
    expect(screen.getByText("After watching")).toBeVisible();
    expect(screen.getAllByText("Choose one familiar brain-friendly food today, then keep the memory step short.")[0]).toBeVisible();
    expect(screen.getByRole("button", { name: "Try this now" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save for later" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Make easier" })).toBeVisible();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"eventType\":\"opened\""),
    })));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      body: expect.stringContaining("\"videoId\":\"hoPg4bkKemQ\""),
    }));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      body: expect.stringContaining("\"moment\":\"afternoon\""),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Save for later" }));

    expect(screen.getByRole("status")).toHaveTextContent("Saved for later.");
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      body: expect.stringContaining("\"eventType\":\"saved\""),
    })));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      body: expect.stringContaining("\"barrier\":\"save_for_later\""),
    }));
  });

  it("asks a lightweight reason when the current video does not fit", async () => {
    renderPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Not for me" }));

    expect(screen.getByText("What did not fit?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Too boring" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Wrong language" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Too boring" }));

    expect(screen.getByRole("status")).toHaveTextContent("Got it. VYVA will adjust the next suggestion.");
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      body: expect.stringContaining("\"eventType\":\"not_relevant\""),
    })));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      body: expect.stringContaining("\"barrier\":\"too_boring\""),
    }));
    expect(screen.getByRole("heading", { name: "10-minute Workout for Older Adults" })).toBeVisible();
  });

  it("switches the hero banner to another pillar and opens its exact video", async () => {
    renderPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Show Heart & circulation" }));

    expect(screen.getByRole("heading", { name: "Mayo Clinic Minute: A little moving goes long way for heart health" })).toBeVisible();
    expect(screen.getByText("Curated video")).toBeVisible();
    expect(screen.getAllByText("Heart")[0]).toBeVisible();
    expect(screen.getByText("Mayo Clinic · 1 min")).toBeVisible();
    expect(screen.getByText("Makes heart movement feel doable by keeping the first step small.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Watch" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Mayo Clinic Minute: Can the MIND diet improve brain health?" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Heart & circulation" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Watch" }));

    expect(window.open).toHaveBeenCalledWith("https://www.youtube.com/watch?v=sjrEUD9RZqA", "_blank", "noopener,noreferrer");
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"actionKey\":\"heart:tai-chi\""),
    })));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      body: expect.stringContaining("\"videoId\":\"sjrEUD9RZqA\""),
    }));
  });

  it("populates every pillar switch state with a curated video", async () => {
    renderPlan();

    const pillarStates = [
      {
        button: "Show Heart & circulation",
        title: "Mayo Clinic Minute: A little moving goes long way for heart health",
        meta: "Mayo Clinic · 1 min",
      },
      {
        button: "Show Strength & stability",
        title: "10-minute Workout for Older Adults",
        meta: "National Institute on Aging · 10 min",
      },
      {
        button: "Show Nourishment",
        title: "Mayo Clinic Minute: How to choose a healthy fat",
        meta: "Mayo Clinic · 1 min",
      },
      {
        button: "Show Calm & recovery",
        title: "Daily Calm | 10 Minute Mindfulness Meditation | Be Present",
        meta: "Calm · 10 min",
      },
    ];

    for (const state of pillarStates) {
      fireEvent.click(await screen.findByRole("button", { name: state.button }));
      expect(screen.getByRole("heading", { name: state.title })).toBeVisible();
      expect(screen.getByText(state.meta)).toBeVisible();
      expect(screen.getByRole("button", { name: "Watch" })).toBeVisible();
    }

    expect(screen.queryByText("NIA fall guide")).not.toBeInTheDocument();
    expect(screen.queryByText("NIA sleep guide")).not.toBeInTheDocument();
    expect(screen.queryByText("NIA food guide")).not.toBeInTheDocument();
  });

  it("renders representative preview data without replacing the production query path", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dev/home-master/health-plan"]}>
          <PreventionPlan previewPlan={plan} firstNameOverride="Karim" backPath="/dev/home-master/health" themeOverride="light" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Mayo Clinic Minute: Can the MIND diet improve brain health?" })).toBeVisible();
    expect(screen.getByText("Afternoon")).toBeVisible();
    expect(screen.getAllByText("Brain")[0]).toBeVisible();
    expect(screen.queryByRole("heading", { name: "3-2-1 memory lane" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Later today" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Today" })).not.toBeInTheDocument();
    expect(screen.queryByText("Companion step")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not for me" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Memory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Riddle" })).not.toBeInTheDocument();
    expect(screen.queryByText("Walk after lunch")).not.toBeInTheDocument();
    expect(screen.queryByText("Clear one walking path")).not.toBeInTheDocument();
    expect(screen.queryByText("Protein with the next meal")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tai chi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Same bedtime tonight/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("prevention-plan-screen")).toHaveAttribute("data-home-master-theme", "light");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("uses the local moment override to preview a different banner session", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dev/home-master/health-plan?moment=morning"]}>
          <PreventionPlan
            previewPlan={plan}
            firstNameOverride="Karim"
            backPath="/dev/home-master/health"
            themeOverride="light"
            momentOverride="morning"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Morning")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Mayo Clinic Minute: How to choose a healthy fat" })).toBeVisible();
    expect(screen.getAllByText("Nourishment")[0]).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Mayo Clinic Minute: Can the MIND diet improve brain health?" })).not.toBeInTheDocument();
  });

  it("uses the preview language override for the hero and pillar videos", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dev/home-master/health-plan?language=es"]}>
          <PreventionPlan
            previewPlan={plan}
            firstNameOverride="Karim"
            backPath="/dev/home-master/health"
            themeOverride="light"
            languageOverride="es"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "El minuto de Mayo Clinic: La alimentación puede mejorar la salud cerebral" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Longevidad" })).toBeVisible();
    expect(screen.getByText("Tarde")).toBeVisible();
    expect(screen.getByText("Video curado")).toBeVisible();
    expect(screen.getAllByText("Cerebro")[0]).toBeVisible();
    expect(screen.getByText("Mayo Clinic · 1:10")).toBeVisible();
    expect(screen.queryByText("Es un video en español, específico para adultos mayores y limitado a 10 minutos.")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Mayo Clinic Minute: Can the MIND diet improve brain health?" })).not.toBeInTheDocument();
    expect(screen.queryByText("Curated video")).not.toBeInTheDocument();
    expect(screen.queryByText("Current theme")).not.toBeInTheDocument();
    expect(screen.queryByText("Program day")).not.toBeInTheDocument();
    expect(screen.queryByText("Why this?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No es para mí" })).toBeVisible();
    expect(screen.getByTestId("longevity-pillar-selector-rail")).toHaveClass("no-scrollbar", "snap-x");

    fireEvent.click(screen.getByText("¿Por qué esto?"));
    expect(screen.getByRole("button", { name: "Juegos mentales VYVA" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar Calma y descanso" }));

    expect(screen.getByRole("heading", { name: "Meditación Guiada de 10 minutos | Calma la mente y consigue paz interior" })).toBeVisible();
    expect(screen.getByText("Anabel Otero · 10 min")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Ver" }));
    expect(screen.getByText("Después de verlo")).toBeVisible();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeVisible();
    expect(window.open).toHaveBeenCalledWith("https://www.youtube.com/watch?v=FReFf1CLf-c", "_blank", "noopener,noreferrer");
  });

  it("uses French video resources and copy for a French user language", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dev/home-master/health-plan?language=fr"]}>
          <PreventionPlan
            previewPlan={plan}
            firstNameOverride="Karim"
            backPath="/dev/home-master/health"
            themeOverride="light"
            languageOverride="fr"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Les meilleurs aliments pour préserver son cerveau et ses facultés le plus longtemps possible" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Longévité" })).toBeVisible();
    expect(screen.getByText("Après-midi")).toBeVisible();
    expect(screen.getByText("Vidéo choisie")).toBeVisible();
    expect(screen.getAllByText("Cerveau")[0]).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Mayo Clinic Minute: Can the MIND diet improve brain health?" })).not.toBeInTheDocument();
    expect(screen.queryByText("Curated video")).not.toBeInTheDocument();
    expect(screen.queryByText("Current theme")).not.toBeInTheDocument();
    expect(screen.queryByText("Program day")).not.toBeInTheDocument();
    expect(screen.queryByText("Why this?")).not.toBeInTheDocument();
    expect(screen.getByTestId("longevity-pillar-selector-rail")).toHaveClass("no-scrollbar", "snap-x");

    fireEvent.click(screen.getByText("Pourquoi ceci ?"));
    expect(screen.getByRole("button", { name: "Jeux cérébraux VYVA" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Afficher Calme et récupération" }));

    expect(screen.getByRole("heading", { name: "10 min de Calme et de Pleine conscience" })).toBeVisible();
    expect(screen.getByText("Cédric Michel · 10 min")).toBeVisible();
  });
});
