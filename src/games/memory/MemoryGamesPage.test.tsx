import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import MemoryGamesPage from "./MemoryGamesPage";
import type { Recommendation } from "./types";

const mocks = vi.hoisted(() => ({
  selectNextMemoryGame: vi.fn(),
  selectGamePlan: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("./progressionEngine", () => ({
  getRecommendedLevelForGame: () => 1,
  selectGamePlan: mocks.selectGamePlan,
  selectNextMemoryGame: mocks.selectNextMemoryGame,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/memory-games"]}>
      <Routes>
        <Route path="/memory-games" element={<MemoryGamesPage />} />
        <Route path="/mind-memory" element={<LocationProbe />} />
        <Route path="/brain-coach/activity/:activityId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MemoryGamesPage", () => {
  beforeEach(() => {
    setLanguage("en");
    mocks.selectNextMemoryGame.mockReset();
    mocks.selectGamePlan.mockReset();
    mocks.selectGamePlan.mockImplementation((_userId: string, gameType: Recommendation["gameType"]) =>
      Promise.resolve({ gameType, level: 1, variantId: `${gameType}-l1-v1` }),
    );
  });

  it("waits for the recommendation before showing the alternate exercise cards", async () => {
    let resolveRecommendation: (recommendation: Recommendation) => void = () => undefined;
    const recommendationPromise = new Promise<Recommendation>((resolve) => {
      resolveRecommendation = resolve;
    });
    mocks.selectNextMemoryGame.mockReturnValue(recommendationPromise);

    renderPage();

    expect(screen.getByTestId("memory-games-flow-shell")).toHaveAttribute("data-flow-id", "brain_coach.activity_session");
    expect(screen.getByTestId("memory-games-flow-shell")).toHaveAttribute("data-registry-scene", "brain_coach.activity_session.memory");
    expect(screen.queryByText("More exercises")).not.toBeInTheDocument();

    resolveRecommendation({
      gameType: "memory_match",
      level: 1,
      variantId: "memory_match-l1-v1",
      reason: "recommended",
    });

    const heading = await screen.findByText("More exercises");
    const choices = heading.closest("section");
    expect(choices).not.toBeNull();
    expect(screen.getByTestId("button-memory-category-voice")).toBeInTheDocument();
    expect(screen.getByTestId("memory-recommended-card").querySelector('[data-vyva-accent="bridge"]')).toBeInTheDocument();
    expect(screen.queryByText("Recommended today")).not.toBeInTheDocument();
    expect(screen.queryByText("Recall people, places, words, numbers, and future cues.")).not.toBeInTheDocument();
    expect(screen.queryByText("Find matching pairs. Each round changes the set.")).not.toBeInTheDocument();

    expect(within(choices as HTMLElement).queryByText("Visual memory")).not.toBeInTheDocument();
    expect(within(choices as HTMLElement).queryByText("Curious Minds")).not.toBeInTheDocument();
    expect(within(choices as HTMLElement).getByText("Remember Later")).toBeInTheDocument();
    expect(within(choices as HTMLElement).getByRole("button", { name: /Remember Later/i }).querySelector('[data-vyva-accent="calendar"]')).toBeInTheDocument();
    expect(within(choices as HTMLElement).getByText("Connections")).toBeInTheDocument();
    expect(within(choices as HTMLElement).getByText("Word Recall")).toBeInTheDocument();
    expect(within(choices as HTMLElement).getByText("Story Recall")).toBeInTheDocument();
    expect(within(choices as HTMLElement).getByText("Number Memory")).toBeInTheDocument();
  });

  it("keeps the activity page heading-only", async () => {
    mocks.selectNextMemoryGame.mockResolvedValue({
      gameType: "memory_match",
      level: 1,
      variantId: "memory_match-l1-v1",
      reasonLabel: "Start here",
    });

    renderPage();

    expect(await screen.findByText("More exercises")).toBeInTheDocument();
    expect(screen.queryByText("Recommended today")).not.toBeInTheDocument();
    expect(screen.queryByText("Start recommended")).not.toBeInTheDocument();
  });

  it("returns to Mind & Memory from the back button", async () => {
    mocks.selectNextMemoryGame.mockResolvedValue({
      gameType: "memory_match",
      level: 1,
      variantId: "memory_match-l1-v1",
      reasonLabel: "Start here",
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(await screen.findByTestId("current-route")).toHaveTextContent("/mind-memory");
  });

  it("opens each standalone memory activity through its own canonical route", async () => {
    mocks.selectNextMemoryGame.mockResolvedValue({
      gameType: "memory_match",
      level: 1,
      variantId: "memory_match-l1-v1",
      reasonLabel: "Start here",
    });

    renderPage();

    fireEvent.click(await screen.findByTestId("brain-coach-activity-spatial-navigator"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/brain-coach/activity/spatial_navigator");
  });
});
