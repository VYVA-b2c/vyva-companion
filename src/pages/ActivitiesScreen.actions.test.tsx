import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActivitiesScreen from "./ActivitiesScreen";

const voiceHeroMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey?: unknown[] }) => ({
      data: queryKey?.[0] === "/api/games/progress"
        ? {
            summary: { streakDays: 2 },
            today: { completedCount: 0, activityTypes: [] },
          }
        : undefined,
    }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock("@/hooks/useRouteVoiceAutoStart", () => ({
  useRouteVoiceAutoStart: () => false,
}));

vi.mock("@/components/VoiceHero", () => ({
  default: (props: { autoStartVoice?: boolean | string; children?: ReactNode; voiceAgentSlug?: string }) => {
    voiceHeroMock(props);
    return <div data-testid="voice-hero">{props.children}</div>;
  },
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => <div data-testid="voice-action-panel" />,
}));

const labels: Record<string, string> = {
  "brain.voiceSource": "Brain coach",
  "brain.headline": "Brain coach",
  "brain.subtitle": "Keep your mind sharp",
  "brain.streakThisWeek": "Streak this week",
  "brain.progressSummary": "Brain Coach progress",
  "brain.progressStreak": "2 day streak",
  "brain.progressStart": "Start with one short activity",
  "activities.primaryTitle": "Choose your focus",
  "activities.libraryTitle": "Choose an activity",
  "activities.primary.memory": "Strengthen Memory",
  "activities.primary.memorySub": "Practice recall, matching, and daily routines.",
  "activities.primary.reflexes": "Train Reflexes",
  "activities.primary.reflexesSub": "Build faster focus and response.",
  "activities.primary.intelligence": "Improve Thinking",
  "activities.primary.intelligenceSub": "Challenge logic, planning, and problem solving.",
  "activities.primary.senses": "Sharpen Senses",
  "activities.primary.sensesSub": "Reset with sound, breath, and calm attention.",
  "mindMemory.cards.strengthenMemory": "Remember",
  "mindMemory.cards.strengthenMemoryDetail": "Recall people, places, words, numbers, and future cues.",
  "mindMemory.cards.trainReflexes": "Focus & React",
  "mindMemory.cards.trainReflexesDetail": "Stay attentive, react, and keep pace.",
  "mindMemory.cards.improveThinking": "Think & Plan",
  "mindMemory.cards.improveThinkingDetail": "Plan, sort, switch rules, and solve sequences.",
  "mindMemory.cards.sharpenSenses": "Calm & Notice",
  "mindMemory.cards.sharpenSensesDetail": "Slow down, breathe, and reconnect with sensory memory.",
  "activities.quick.kicker": "Brain Coach",
  "activities.quick.relax": "Relax & Breathe",
  "activities.quick.relaxSub": "Take a calm guided pause.",
  "activities.quick.learn": "Learn Something New",
  "activities.quick.learnSub": "Start a short daily learning program.",
  "activities.quick.learnSubMobile": "Daily lessons",
  "activities.quick.play": "Take a cognitive assessment.",
  "activities.quick.playSub": "Practice memory and focus.",
  "activities.chooseActivity": "Choose an activity",
  "activities.trivia": "Train Reflexes",
  "activities.memory": "Strengthen Memory",
  "activities.spatialNavigator": "Logic & Reasoning",
  "activities.scrabble": "Word & Language",
  "activities.logicPuzzle": "Improve Thinking",
  "activities.meditation": "Relax & Breathe",
  "activities.breathing": "Relax & Breathe",
  "activities.doneToday": "Done today",
  "activities.joinSocialRoom": "Join a room",
  "activities.joinSocialRoomSub": "Start a friendly conversation now.",
  "activities.findCompanions": "Find companions",
  "activities.findCompanionsSub": "Match around interests and routines.",
  "companions.activityTile": "Connect with others",
  "companions.activityTileSubtitle": "Meet others with shared interests",
  "voiceHero.endCall": "Pause listening",
};

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    t: (key: string) => labels[key] ?? key,
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <div data-testid="route-state">{JSON.stringify(location.state ?? {})}</div>
    </>
  );
}

function renderActivities() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/activities"]}>
      <Routes>
        <Route path="/activities" element={<ActivitiesScreen />} />
        <Route path="/activity" element={<LocationProbe />} />
        <Route path="/brain-coach/remember" element={<LocationProbe />} />
        <Route path="/learn" element={<LocationProbe />} />
        <Route path="/brain-coach/focus" element={<LocationProbe />} />
        <Route path="/brain-coach/calm" element={<LocationProbe />} />
        <Route path="/brain-coach/think" element={<LocationProbe />} />
        <Route path="/language" element={<LocationProbe />} />
        <Route path="/activities/relax-breathe" element={<LocationProbe />} />
        <Route path="/social-rooms" element={<LocationProbe />} />
        <Route path="/companions" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Activities service actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    voiceHeroMock.mockClear();
  });

  it("renders the health-style primary cards and reordered activity library", () => {
    renderActivities();

    const primarySection = screen.getByTestId("section-activities-primary-actions");
    expect(screen.queryByTestId("brain-coach-weekly-streak")).not.toBeInTheDocument();
    expect(screen.queryByTestId("brain-coach-progress-summary")).not.toBeInTheDocument();

    expect(primarySection).toBeInTheDocument();
    expect(screen.getByText("Choose your focus")).toBeInTheDocument();
    expect(voiceHeroMock).toHaveBeenCalledWith(expect.objectContaining({
      autoStartVoice: false,
      voiceAgentSlug: "brain-coach",
    }));
    expect(screen.getByTestId("button-activities-primary-memory")).toHaveTextContent("Remember");
    expect(screen.getByTestId("button-activities-primary-reflexes")).toHaveTextContent("Focus & React");
    expect(screen.getByTestId("button-activities-primary-intelligence")).toHaveTextContent("Think & Plan");
    expect(screen.getByTestId("button-activities-primary-senses")).toHaveTextContent("Calm & Notice");

    const quickActions = screen.getByTestId("activities-quick-actions");
    expect(quickActions).toHaveTextContent("Brain Coach");
    expect(quickActions).toHaveTextContent("Choose an activity");
    expect(screen.queryByTestId(/^activity-card-/)).not.toBeInTheDocument();
    expect(screen.getByTestId("button-activities-quick-relax")).toHaveTextContent("Relax & Breathe");
    expect(screen.getByTestId("button-activities-quick-relax")).toHaveTextContent("Take a calm guided pause.");
    expect(screen.getByTestId("button-activities-quick-learn")).toHaveTextContent("Learn Something New");
    expect(screen.getByTestId("button-activities-quick-play")).toHaveTextContent("Take a cognitive assessment.");
  });

  it("routes the Remember primary card to its module", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("button-activities-primary-memory"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/brain-coach/remember"));
  });

  it("routes the Calm & Notice primary card to its module", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("button-activities-primary-senses"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/brain-coach/calm"));
  });

  it("routes the Relax & Breathe quick action to the dedicated page", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("button-activities-quick-relax"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/activities/relax-breathe"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("{}");
  });

  it("routes the Learn Something New quick action to the learning program", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("button-activities-quick-learn"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/learn"));
  });

  it("routes the brain game quick action to memory games", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("button-activities-quick-play"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/brain-coach/remember"));
  });

  it("does not render the old companionship tile on Activities", () => {
    renderActivities();

    expect(screen.queryByTestId("activities-companion-actions")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect with others")).not.toBeInTheDocument();
  });
});
