import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import RememberLater, {
  buildLocalRememberLaterRounds,
  computeRememberLaterScore,
  getDefaultRememberLaterUserState,
  getRememberLaterLevelRequirements,
  getRememberLaterResultMessage,
  getNextRememberLaterStateAfterSession,
  isRememberLaterCountedRound,
  normalizeRememberLaterRound,
  pickRememberLaterRound,
  shouldShowRememberLaterIntro,
} from "./RememberLater";
import { recordCognitiveSession } from "./shared/brainCoachSessions";

const gameDataMock = vi.hoisted(() => {
  const queue: Array<{ data: unknown; error: unknown }> = [];
  const calls: Array<{ table: string; type: string; payload?: unknown }> = [];
  const from = vi.fn((table: string) => {
    const query: Record<string, unknown> = { table };
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.gte = vi.fn(() => query);
    query.lt = vi.fn(() => query);
    query.not = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.limit = vi.fn(() => query);
    query.insert = vi.fn((payload) => {
      calls.push({ table, type: "insert", payload });
      query.payload = payload;
      return query;
    });
    query.upsert = vi.fn((payload) => {
      calls.push({ table, type: "upsert", payload });
      query.payload = payload;
      return query;
    });
    query.single = vi.fn(() => Promise.resolve(queue.shift() ?? { data: query.payload, error: null }));
    query.maybeSingle = vi.fn(() => Promise.resolve(queue.shift() ?? { data: null, error: null }));
    query.then = (onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) =>
      Promise.resolve(queue.shift() ?? { data: [], error: null }).then(onfulfilled, onrejected);
    return query;
  });

  return { calls, from, queue };
});

vi.mock("./shared/gameDataApi", () => ({
  gameData: {
    table: gameDataMock.from,
  },
}));

vi.mock("./shared/brainCoachSessions", () => ({
  recordCognitiveSession: vi.fn().mockResolvedValue({ persisted: true }),
}));

const testRound = {
  id: "round-1",
  round_type: "event_based",
  difficulty_tier: 1,
  round_duration_seconds: 1,
  ongoing_task_rule: "shape_circle",
  filler_stream: [
    { type: "shape", value: "circle", matches_rule: true },
    { type: "icon", value: "cue", icon: "cue", matches_rule: false, cue: true },
    { type: "shape", value: "circle", matches_rule: true },
  ],
  filler_item_count: 3,
  filler_item_interval_ms: 10,
  intentions: [{ type: "event", cue_icon: "bell", cue_position_index: 1, response_window_items: 1 }],
  is_active: true,
};

const componentRound = {
  ...testRound,
  difficulty_tier: 20,
  round_duration_seconds: 1,
  filler_stream: [
    { type: "shape", value: "square", matches_rule: false },
    { type: "icon", value: "cue", icon: "cue", matches_rule: false, cue: true },
    { type: "shape", value: "circle", matches_rule: true },
  ],
  filler_item_interval_ms: 80,
};

const levelOneComponentRound = {
  ...testRound,
  difficulty_tier: 1,
  filler_stream: [
    { type: "icon", value: "cue", icon: "cue", matches_rule: false, cue: true },
    { type: "shape", value: "circle", matches_rule: true },
  ],
  filler_item_count: 2,
  filler_item_interval_ms: 80,
  intentions: [{ type: "event", cue_icon: "bell", cue_position_index: 0, response_window_items: 1 }],
};

const colorBlueComponentRound = {
  ...levelOneComponentRound,
  ongoing_task_rule: "color_blue",
  filler_stream: [
    { type: "color", value: "red", matches_rule: false },
    { type: "icon", value: "cue", icon: "cue", matches_rule: false, cue: true },
    { type: "color", value: "blue", matches_rule: true },
  ],
  filler_item_count: 3,
  intentions: [{ type: "event", cue_icon: "bell", cue_position_index: 1, response_window_items: 1 }],
};

const TEST_COUNTDOWN_STEP_MS = 10;

function translateFallback(_key: string, fallback: string, params?: Record<string, unknown>) {
  return Object.entries(params ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    fallback,
  );
}

describe("RememberLater helpers", () => {
  it("starts new practice at level one", () => {
    expect(getDefaultRememberLaterUserState("user-1").current_tier).toBe(1);
  });

  it("shows instructions only for unseen level-one onboarding", () => {
    expect(shouldShowRememberLaterIntro(
      { ...getDefaultRememberLaterUserState("user-1"), has_seen_tutorial: false },
      { difficulty_tier: 1 },
    )).toBe(true);
    expect(shouldShowRememberLaterIntro(
      { ...getDefaultRememberLaterUserState("user-1"), has_seen_tutorial: true },
      { difficulty_tier: 1 },
    )).toBe(false);
    expect(shouldShowRememberLaterIntro(
      { ...getDefaultRememberLaterUserState("user-1"), current_tier: 2, has_seen_tutorial: false },
      { difficulty_tier: 2 },
    )).toBe(false);
  });

  it("scores prospective memory higher than the matching task", () => {
    const result = computeRememberLaterScore({
      round: testRound,
      ongoingTappedIndices: [0],
      ongoingFalseAlarms: 1,
      intentionStates: [{ intention: testRound.intentions[0], hit: true, response_delay_items: 0 }],
      pmFalseAlarms: 0,
      seenItemCount: 3,
      durationSeconds: 1,
    });

    expect(result.ongoing_accuracy_pct).toBe(50);
    expect(result.pm_accuracy_pct).toBe(100);
    expect(result.score).toBe(800);
    expect(result.combined_accuracy_pct).toBe(80);
  });

  it("keeps the point score aligned with the overall weighted percentage", () => {
    const result = computeRememberLaterScore({
      round: {
        ...testRound,
        filler_stream: [
          { type: "shape", value: "circle", matches_rule: true },
          { type: "shape", value: "circle", matches_rule: true },
          { type: "shape", value: "circle", matches_rule: true },
          { type: "shape", value: "circle", matches_rule: true },
          { type: "shape", value: "circle", matches_rule: true },
          { type: "icon", value: "cue", icon: "cue", matches_rule: false, cue: true },
        ],
        filler_item_count: 6,
      },
      ongoingTappedIndices: [0, 1],
      ongoingFalseAlarms: 0,
      intentionStates: [{ intention: testRound.intentions[0], hit: false, response_delay_items: null }],
      pmFalseAlarms: 0,
      seenItemCount: 6,
      durationSeconds: 1,
    });

    expect(result.ongoing_accuracy_pct).toBe(40);
    expect(result.pm_accuracy_pct).toBe(0);
    expect(result.combined_accuracy_pct).toBe(16);
    expect(result.score).toBe(160);
  });

  it("varies completion messages across finished rounds", () => {
    const common = {
      resultCountsForLevel: true,
      resultToneHit: true,
      promotedThisRound: false,
      progressWins: 1,
      progressWinsNeeded: 2,
      nextTier: 2,
      nextTierBand: { label: "Foundation" },
      completedMilestone: null,
    };
    const titles = ["round-a", "round-b", "round-c"].map((roundId) =>
      getRememberLaterResultMessage({
        ...common,
        t: translateFallback,
        result: {
          round_id: roundId,
          difficulty_tier: 2,
          score: 840,
          pm_hits: 1,
          ongoing_correct: 2,
          ongoing_total: 2,
        },
      }).title);

    expect(new Set(titles).size).toBeGreaterThan(1);
  });

  it("uses mastery wording instead of promising another level at the final tier", () => {
    const message = getRememberLaterResultMessage({
      t: translateFallback,
      result: {
        round_id: "round-max",
        difficulty_tier: 20,
        score: 600,
        pm_hits: 1,
        ongoing_correct: 0,
        ongoing_total: 3,
      },
      resultCountsForLevel: false,
      resultToneHit: true,
      promotedThisRound: false,
      progressWins: 0,
      progressWinsNeeded: 3,
      nextTier: 20,
      nextTierBand: { label: "Mastery" },
      completedMilestone: null,
    });

    expect(message.detail).toMatch(/highest level/i);
    expect(message.detail).not.toMatch(/toward Level 20/i);
  });

  it("keeps early tiers approachable without making them feel trivial", () => {
    const normalized = normalizeRememberLaterRound({
      ...testRound,
      difficulty_tier: 1,
      round_duration_seconds: 90,
      filler_item_interval_ms: 400,
      filler_stream: [
        { type: "shape", value: "circle", matches_rule: true },
        { type: "shape", value: "square", matches_rule: false },
        { type: "shape", value: "triangle", matches_rule: false },
        { type: "shape", value: "circle", matches_rule: true },
        { type: "icon", value: "cue", icon: "cue", matches_rule: false, cue: true },
        { type: "shape", value: "square", matches_rule: false },
        { type: "shape", value: "circle", matches_rule: true },
        { type: "shape", value: "triangle", matches_rule: false },
        { type: "shape", value: "circle", matches_rule: true },
        { type: "shape", value: "square", matches_rule: false },
        { type: "shape", value: "circle", matches_rule: true },
        { type: "shape", value: "triangle", matches_rule: false },
      ],
    });

    expect(normalized.filler_stream).toHaveLength(10);
    expect(normalized.filler_item_interval_ms).toBe(1700);
    expect(normalized.round_duration_seconds).toBe(17);
  });

  it("counts early rounds with gentler matching requirements, then tightens later", () => {
    expect(getRememberLaterLevelRequirements(1)).toEqual(expect.objectContaining({
      combinedAccuracyPct: 60,
      matchingAccuracyPct: 50,
    }));
    expect(isRememberLaterCountedRound({
      difficulty_tier: 1,
      combined_accuracy_pct: 80,
      ongoing_accuracy_pct: 50,
      pm_hits: 1,
      abandoned: false,
    })).toBe(true);
    expect(isRememberLaterCountedRound({
      difficulty_tier: 4,
      combined_accuracy_pct: 80,
      ongoing_accuracy_pct: 50,
      pm_hits: 1,
      abandoned: false,
    })).toBe(false);
  });

  it("promotes only after three PM-supported wins", () => {
    const previous = {
      ...getDefaultRememberLaterUserState("user-1"),
      current_tier: 2,
      consecutive_wins: 2,
      sessions_at_tier: 2,
    };
    const next = getNextRememberLaterStateAfterSession(previous, {
      difficulty_tier: 2,
      combined_accuracy_pct: 80,
      ongoing_accuracy_pct: 80,
      pm_hits: 1,
      score: 850,
      abandoned: false,
    }, new Date("2026-06-20T12:00:00Z"));

    expect(next.current_tier).toBe(3);
    expect(next.consecutive_wins).toBe(0);
    expect(next.sessions_at_tier).toBe(0);
  });

  it("does not promote when the future intention was not remembered", () => {
    const previous = {
      ...getDefaultRememberLaterUserState("user-1"),
      current_tier: 2,
      consecutive_wins: 2,
    };
    const next = getNextRememberLaterStateAfterSession(previous, {
      difficulty_tier: 2,
      combined_accuracy_pct: 90,
      ongoing_accuracy_pct: 90,
      pm_hits: 0,
      score: 760,
      abandoned: false,
    }, new Date("2026-06-20T12:00:00Z"));

    expect(next.current_tier).toBe(2);
    expect(next.consecutive_wins).toBe(0);
  });

  it("does not add level progress when recall succeeds but the matching task is too low", () => {
    const previous = {
      ...getDefaultRememberLaterUserState("user-1"),
      current_tier: 1,
      consecutive_wins: 0,
    };
    const next = getNextRememberLaterStateAfterSession(previous, {
      difficulty_tier: 1,
      combined_accuracy_pct: 60,
      ongoing_accuracy_pct: 0,
      pm_hits: 1,
      score: 600,
      abandoned: false,
    }, new Date("2026-06-20T12:00:00Z"));

    expect(next.current_tier).toBe(1);
    expect(next.consecutive_wins).toBe(0);
  });

  it("picks an unused round today, then falls back to least recently played", () => {
    const rounds = [
      { ...testRound, id: "old-round" },
      { ...testRound, id: "fresh-round" },
    ];

    expect(pickRememberLaterRound(rounds, [{ round_id: "old-round" }], [], () => 0)?.id).toBe("fresh-round");
    expect(pickRememberLaterRound(rounds, [{ round_id: "old-round" }, { round_id: "fresh-round" }], [
      { round_id: "old-round", played_at: "2026-06-20T10:00:00Z" },
      { round_id: "fresh-round", played_at: "2026-06-19T10:00:00Z" },
    ])?.id).toBe("fresh-round");
  });

  it("builds varied local rounds within the same level", () => {
    const rounds = buildLocalRememberLaterRounds(1);
    const firstThreeSignatures = rounds.slice(0, 3).map((round) => {
      const cueIcon = round.intentions.find((intention) => intention.type === "event")?.cue_icon;
      const streamSignature = round.filler_stream
        .slice(0, 6)
        .map((item) => `${item.type}:${item.value}:${item.cue ? "cue" : item.matches_rule ? "hit" : "wait"}`)
        .join("|");

      return `${round.ongoing_task_rule}:${cueIcon}:${streamSignature}`;
    });

    expect(rounds).toHaveLength(20);
    expect(new Set(firstThreeSignatures).size).toBe(3);
    expect(rounds[0].ongoing_task_rule).toBe("shape_circle");
    expect(rounds[0].intentions[0]).toEqual(expect.objectContaining({
      type: "event",
      cue_icon: "bell",
    }));
  });

  it("rotates local rounds played today before repeating a level", () => {
    const rounds = buildLocalRememberLaterRounds(1);
    const nextRound = pickRememberLaterRound(
      rounds,
      [
        { round_id: rounds[0].id },
        { round_id: rounds[1].id },
      ],
      [],
      () => 0,
    );

    expect(nextRound?.id).toBe(rounds[2].id);
  });
});

describe("RememberLater component", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = "remember_later_tutorial_seen_v1=; Max-Age=0; Path=/";
    setLanguage("en");
    gameDataMock.calls.length = 0;
    gameDataMock.queue.length = 0;
    gameDataMock.from.mockClear();
    vi.mocked(recordCognitiveSession).mockClear();
  });

  it("shows the tutorial once, plays a round, saves the session, and records Brain Coach history", async () => {
    const userState = {
      ...getDefaultRememberLaterUserState("user-1"),
      has_seen_tutorial: false,
    };
    gameDataMock.queue.push(
      { data: userState, error: null },
      { data: [], error: null },
      { data: [levelOneComponentRound], error: null },
      { data: { ...userState, has_seen_tutorial: true }, error: null },
      { data: { id: "session-1" }, error: null },
      { data: { ...userState, has_seen_tutorial: true }, error: null },
    );

    render(<RememberLater userId="user-1" onExit={vi.fn()} countdownStepMs={TEST_COUNTDOWN_STEP_MS} />);

    expect(await screen.findByRole("heading", { name: "Watch for two things." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Remember Later", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("See a circle")).toBeInTheDocument();
    expect(screen.getByText("See the bell")).toBeInTheDocument();
    expect(screen.getByText("Anything else: wait.")).toBeInTheDocument();
    expect(screen.getByText(/First round only/i)).toBeInTheDocument();
    expect(screen.getByText(/3 good rounds/i)).toBeInTheDocument();
    expect(screen.getByText("Tap purple")).toBeInTheDocument();
    expect(screen.getByText("Touch this button")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Do not show these instructions again." })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(window.localStorage.getItem("rememberLater:tutorialSeen:v1")).toBe("true");
    expect(screen.getByText("Get ready")).toBeInTheDocument();
    expect(screen.getByLabelText("Round starts in 3")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Tap when you see a circle" })).toBeInTheDocument();
    expect(screen.getAllByText("Tap when you see a circle")).toHaveLength(1);
    expect(screen.getAllByText("Bell? Touch this button")).toHaveLength(1);
    const reminderButton = screen.getByRole("button", { name: "Bell? Touch this button" });
    expect(reminderButton.querySelector(".lucide-bell")).toBeInTheDocument();
    expect(reminderButton.querySelector(".lucide-star")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Touch this button/i }));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1800));
    });
    fireEvent.click(screen.getByRole("button", { name: "Tap when you see a circle" }));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
    });

    expect(await screen.findByRole("heading", { name: /Good round|Nice work|Solid round/i })).toBeInTheDocument();
    expect(screen.getByText("Good round")).toBeInTheDocument();
    expect(screen.getByText(/used both buttons|balanced the matching task|both parts landed/i)).toBeInTheDocument();
    expect(screen.getByText("Overall")).toBeInTheDocument();
    expect(screen.getByText("Points")).toBeInTheDocument();
    expect(screen.getByText("1000/1000")).toBeInTheDocument();
    expect(screen.queryByText("Score")).not.toBeInTheDocument();
    expect(screen.queryByText("Streak")).not.toBeInTheDocument();
    expect(screen.getByText(/2 to go|2 more before|2 more like this/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next round" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play again" })).not.toBeInTheDocument();

    const savedSession = gameDataMock.calls.find((call) => call.table === "remember_later_sessions" && call.type === "insert");
    expect(savedSession?.payload).toEqual(expect.objectContaining({
      round_id: "round-1",
      pm_hits: 1,
      pm_total: 1,
      completed: true,
      abandoned: false,
    }));

    expect(recordCognitiveSession).toHaveBeenCalledWith(expect.objectContaining({
      activityType: "remember_later",
      domain: "prospective_memory",
      secondaryDomain: "attention",
      accuracyPct: 100,
      sourceTable: "remember_later_sessions",
    }));
  }, 10_000);

  it("lets people choose whether starting level one hides future instructions", async () => {
    const { unmount } = render(<RememberLater onExit={vi.fn()} countdownStepMs={TEST_COUNTDOWN_STEP_MS} />);

    const hideInstructions = await screen.findByRole("checkbox", { name: "Do not show these instructions again." });
    expect(hideInstructions).toBeChecked();

    fireEvent.click(hideInstructions);
    expect(hideInstructions).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Start round" }));

    expect(window.localStorage.getItem("rememberLater:tutorialSeen:v1")).toBeNull();
    unmount();
  });

  it("does not repeat the intro once the merged example has been seen", async () => {
    window.localStorage.setItem("rememberLater:tutorialSeen:v1", "true");

    render(<RememberLater onExit={vi.fn()} countdownStepMs={TEST_COUNTDOWN_STEP_MS} />);

    expect(await screen.findByRole("button", { name: "Tap when you see a circle" })).toBeInTheDocument();
    expect(screen.queryByText("Watch for two things.")).not.toBeInTheDocument();
    expect(screen.queryByText("Anything else: wait.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start round" })).not.toBeInTheDocument();
  });

  it("does not repeat the intro when the cookie fallback marks it seen", async () => {
    document.cookie = "remember_later_tutorial_seen_v1=true; Path=/";

    render(<RememberLater onExit={vi.fn()} countdownStepMs={TEST_COUNTDOWN_STEP_MS} />);

    expect(await screen.findByRole("button", { name: "Tap when you see a circle" })).toBeInTheDocument();
    expect(screen.queryByText("Watch for two things.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start round" })).not.toBeInTheDocument();
  });

  it("uses the local tutorial flag when server progress is stale", async () => {
    window.localStorage.setItem("rememberLater:tutorialSeen:v1", "true");
    gameDataMock.queue.push(
      {
        data: {
          ...getDefaultRememberLaterUserState("user-1"),
          current_tier: 1,
          has_seen_tutorial: false,
        },
        error: null,
      },
      { data: [], error: null },
      { data: [levelOneComponentRound], error: null },
    );

    render(<RememberLater userId="user-1" onExit={vi.fn()} countdownStepMs={TEST_COUNTDOWN_STEP_MS} />);

    expect(await screen.findByRole("button", { name: "Tap when you see a circle" })).toBeInTheDocument();
    expect(screen.queryByText("Watch for two things.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start round" })).not.toBeInTheDocument();
  });

  it("uses the local tutorial flag when creating missing server progress", async () => {
    window.localStorage.setItem("rememberLater:tutorialSeen:v1", "true");
    gameDataMock.queue.push(
      { data: null, error: null },
      {
        data: {
          ...getDefaultRememberLaterUserState("user-1"),
          current_tier: 1,
          has_seen_tutorial: false,
        },
        error: null,
      },
      { data: [], error: null },
      { data: [levelOneComponentRound], error: null },
    );

    render(<RememberLater userId="user-1" onExit={vi.fn()} countdownStepMs={TEST_COUNTDOWN_STEP_MS} />);

    expect(await screen.findByRole("button", { name: "Tap when you see a circle" })).toBeInTheDocument();
    expect(screen.queryByText("Watch for two things.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start round" })).not.toBeInTheDocument();

    const savedState = gameDataMock.calls.find((call) => call.table === "remember_later_user_state" && call.type === "upsert");
    expect(savedState?.payload).toEqual(expect.objectContaining({
      has_seen_tutorial: true,
    }));
  });

  it("opens the next local variant when a level round has already been played today", async () => {
    const rounds = buildLocalRememberLaterRounds(1);
    window.localStorage.setItem("rememberLater:tutorialSeen:v1", "true");
    window.localStorage.setItem("rememberLater:sessions:v1", JSON.stringify([
      { round_id: rounds[0].id, played_at: new Date().toISOString() },
    ]));

    render(<RememberLater onExit={vi.fn()} countdownStepMs={TEST_COUNTDOWN_STEP_MS} />);

    expect(await screen.findByRole("button", { name: "Tap when you see a square" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tap when you see a circle" })).not.toBeInTheDocument();
  });

  it("describes color rules as colors instead of shapes", async () => {
    const userState = {
      ...getDefaultRememberLaterUserState("user-1"),
      has_seen_tutorial: true,
    };
    gameDataMock.queue.push(
      { data: userState, error: null },
      { data: [], error: null },
      { data: [colorBlueComponentRound], error: null },
    );

    render(<RememberLater userId="user-1" onExit={vi.fn()} countdownStepMs={TEST_COUNTDOWN_STEP_MS} />);

    expect(await screen.findByRole("button", { name: "Tap when the color is blue" })).toBeInTheDocument();
    expect(screen.getAllByText("Tap when the color is blue")).toHaveLength(1);
    expect(screen.queryByText("Tap when you see blue")).not.toBeInTheDocument();
  });

  it("skips instructions by default from level two onward", async () => {
    const userState = {
      ...getDefaultRememberLaterUserState("user-1"),
      current_tier: 2,
      has_seen_tutorial: false,
    };
    gameDataMock.queue.push(
      { data: userState, error: null },
      { data: [], error: null },
      { data: [{ ...componentRound, difficulty_tier: 2 }], error: null },
    );

    render(<RememberLater userId="user-1" onExit={vi.fn()} countdownStepMs={TEST_COUNTDOWN_STEP_MS} />);

    expect(await screen.findByRole("button", { name: "Tap when you see a circle" })).toBeInTheDocument();
    expect(screen.queryByText("Watch for two things.")).not.toBeInTheDocument();
    expect(screen.queryByText("Anything else: wait.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start round" })).not.toBeInTheDocument();
  });

  it("explains when recall alone does not move the level bar", async () => {
    const userState = {
      ...getDefaultRememberLaterUserState("user-1"),
      current_tier: 1,
      has_seen_tutorial: true,
    };
    gameDataMock.queue.push(
      { data: userState, error: null },
      { data: [], error: null },
      { data: [componentRound], error: null },
      { data: { id: "session-1" }, error: null },
      { data: userState, error: null },
    );

    render(<RememberLater userId="user-1" onExit={vi.fn()} countdownStepMs={TEST_COUNTDOWN_STEP_MS} />);

    expect(await screen.findByRole("button", { name: "Tap when you see a circle" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start round" })).not.toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1250));
    });
    fireEvent.click(screen.getByRole("button", { name: /Touch this button/i }));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 2600));
    });

    expect(await screen.findByRole("heading", { name: /caught the reminder|Good recall|reminder stayed/i })).toBeInTheDocument();
    expect(screen.getByText(/You remembered the reminder/i)).toBeInTheDocument();
    expect(screen.getByText("Matching task")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText(/Improve your matching accuracy next round so it counts toward Level 2/i)).toBeInTheDocument();
    expect(screen.getByText("Progress to Level 2")).toBeInTheDocument();
    expect(screen.getByText("0 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next round" })).toBeInTheDocument();
  }, 10_000);
});
