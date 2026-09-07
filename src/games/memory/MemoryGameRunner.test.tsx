import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import { getGameHistory, saveGameResult } from "./gameStorage";
import type { GameResult } from "./types";
import MemoryGameRunner from "./MemoryGameRunner";

const mocks = vi.hoisted(() => ({
  speakSequence: vi.fn(),
  stopTts: vi.fn(),
  startListening: vi.fn(() => false),
  stopListening: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useOptionalVyvaVoice: () => null,
  useTtsReadout: () => ({
    speakSequence: mocks.speakSequence,
    stopTts: mocks.stopTts,
    isTtsSpeaking: false,
  }),
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => null,
}));

vi.mock("./useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    isSupported: false,
    isListening: false,
    startListening: mocks.startListening,
    stopListening: mocks.stopListening,
  }),
}));

vi.mock("./gameStorage", async () => {
  const actual = await vi.importActual<typeof import("./gameStorage")>("./gameStorage");
  return {
    ...actual,
    getGameHistory: vi.fn(),
    saveGameResult: vi.fn(),
  };
});

function renderMemoryGame(initialEntry: string) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/memory-games/:gameType" element={<MemoryGameRunner />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderWordRecall() {
  return renderMemoryGame("/memory-games/word_recall?level=1&variant=word_recall-l1-v1");
}

function renderRhythmTap() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/attention-boosters/rhythm-tap?level=1&variant=sequence_memory-l1-v1"]}>
      <Routes>
        <Route
          path="/attention-boosters/rhythm-tap"
          element={<MemoryGameRunner forcedGameType="sequence_memory" returnPath="/attention-boosters" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function visualResult(minutesAgo: number): GameResult {
  return {
    userId: "user-1",
    gameType: "memory_match",
    cognitiveDomain: "visual_memory",
    variantId: `memory_match-l1-v${minutesAgo + 2}`,
    level: 1,
    score: 500,
    accuracy: 100,
    mistakes: 0,
    durationSeconds: 20,
    completedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    language: "en",
  };
}

async function completeLevelOneVisualMemoryBoard() {
  const cards = await screen.findAllByTestId("visual-memory-card");

  fireEvent.click(cards[0]);
  fireEvent.click(cards[5]);
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  });
  fireEvent.click(cards[1]);
  fireEvent.click(cards[2]);
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  });
  fireEvent.click(cards[3]);
  fireEvent.click(cards[4]);
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  });
}

describe("MemoryGameRunner word recall", () => {
  beforeEach(() => {
    setLanguage("en");
    mocks.speakSequence.mockClear();
    mocks.stopTts.mockClear();
    mocks.startListening.mockClear();
    mocks.stopListening.mockClear();
    vi.mocked(saveGameResult).mockReset();
    vi.mocked(saveGameResult).mockReturnValue(new Promise<void>(() => undefined));
    vi.mocked(getGameHistory).mockReset();
    vi.mocked(getGameHistory).mockResolvedValue([]);
    vi.spyOn(Math, "random").mockReturnValue(0);
    window.scrollTo = vi.fn();
    window.localStorage.clear();
  });

  it("keeps the next-level action available when result persistence is still pending", async () => {
    renderWordRecall();

    fireEvent.click(await screen.findByRole("button", { name: /hide words/i }));
    fireEvent.click(await screen.findByRole("button", { name: "bread" }));
    fireEvent.click(await screen.findByRole("button", { name: "milk" }));
    fireEvent.click(await screen.findByRole("button", { name: "cheese" }));

    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).not.toBeDisabled();

    fireEvent.click(continueButton);

    expect(await screen.findByText("Well done")).toBeInTheDocument();
    expect(screen.getByText(/building the base/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to Level 2" })).not.toBeDisabled();
    expect(saveGameResult).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      gameType: "word_recall",
      cognitiveDomain: "episodic_memory",
      variantId: "word_recall-l1-v1",
      language: "en",
    }));
  });

  it("runs Connections through study, neutral reset, deferred recall, and review", async () => {
    vi.mocked(saveGameResult).mockResolvedValueOnce();
    renderMemoryGame("/memory-games/association_memory?level=3&variant=association_memory-l3-v1");

    expect((await screen.findAllByText("Connections")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Remember these plans")).toBeInTheDocument();
    expect(screen.getByText("red folder")).toBeInTheDocument();
    expect(screen.getByText("striped umbrella")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

    expect(screen.getByText("Clear your mind")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "11" }));
    fireEvent.click(screen.getByRole("button", { name: "15" }));
    fireEvent.click(screen.getByRole("button", { name: "18" }));

    expect(screen.getByText(/Question 1\/4/)).toBeInTheDocument();
    expect(screen.queryByText("Correct connection")).not.toBeInTheDocument();
    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Not sure" }));
    }

    expect(await screen.findByText("Review")).toBeInTheDocument();
    expect(screen.getAllByText("Correct connection")).toHaveLength(4);
    expect(saveGameResult).toHaveBeenCalledWith(expect.objectContaining({
      gameType: "association_memory",
      score: 0,
      accuracy: 0,
      metadata: expect.objectContaining({
        roundVersion: "connections_v2",
        associationCount: 3,
        questionCount: 4,
        correctCount: 0,
        questionsAnswered: 0,
        resetKind: "number_order",
      }),
    }));

    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    expect(await screen.findByRole("button", { name: "Next activity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next level/i })).not.toBeInTheDocument();
  });

  it("makes the next level explicit after reaching the 80 percent threshold", async () => {
    vi.mocked(saveGameResult).mockResolvedValueOnce();
    renderMemoryGame("/memory-games/association_memory?level=3&variant=association_memory-l3-v1");

    fireEvent.click(await screen.findByRole("button", { name: "Start recall" }));
    fireEvent.click(screen.getByRole("button", { name: "11" }));
    fireEvent.click(screen.getByRole("button", { name: "15" }));
    fireEvent.click(screen.getByRole("button", { name: "18" }));
    fireEvent.click(screen.getByRole("button", { name: "library" }));
    fireEvent.click(screen.getByRole("button", { name: "Daniel" }));
    fireEvent.click(screen.getByRole("button", { name: "green notebook" }));
    fireEvent.click(screen.getByRole("button", { name: "Maya" }));

    fireEvent.click(await screen.findByRole("button", { name: "See results" }));
    expect(await screen.findByRole("button", { name: "Next level 4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next activity" })).not.toBeInTheDocument();
  });

  it("shows Number Memory guidance before the first three-round session", async () => {
    renderMemoryGame("/memory-games/number_memory?level=6&variant=number_memory-l6-v1");

    expect(await screen.findByText("Level 6")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Remember in the same order" })).toBeInTheDocument();
    expect(screen.getByText("Watch or listen, then repeat the numbers in the same order.")).toBeInTheDocument();
    expect(screen.queryByText(/Example:/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Round 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Let’s start" })).toBeInTheDocument();
  });

  it("shows Rhythm Tap instructions once and reopens them from the icon", async () => {
    setLanguage("en");
    renderRhythmTap();

    expect(await screen.findByRole("heading", { name: "How it works" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I understand" }));

    expect(window.localStorage.getItem("sequenceMemory:tutorialSeen:v1:user-1")).toBe("true");
    expect(await screen.findByRole("button", { name: "Instructions" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Instructions" }));

    expect(await screen.findByRole("heading", { name: "How it works" })).toBeInTheDocument();
  });

  it("shows Visual Memory instructions once at Level 1 and reopens them on request", async () => {
    renderMemoryGame("/memory-games/memory_match?level=1&variant=memory_match-l1-v1");

    expect(await screen.findByRole("heading", { name: "Find the pairs" })).toBeInTheDocument();
    expect(screen.queryByText("Different pictures? Both cards turn back. Try another pair.")).not.toBeInTheDocument();
    expect(screen.getByText("Find all 3 pairs to finish. There is no timer.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Level 1" }));

    expect(window.localStorage.getItem("visualMemory:tutorialSeen:v1:user-1")).toBe("true");
    expect(screen.queryByRole("button", { name: "Pause VYVA's voice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Let VYVA encourage me" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Instructions" }));
    expect(await screen.findByRole("heading", { name: "Find the pairs" })).toBeInTheDocument();
  });

  it("starts Visual Memory above Level 1 without repeating basic instructions", async () => {
    renderMemoryGame("/memory-games/memory_match?level=2&variant=memory_match-l2-v1");

    expect(await screen.findByRole("heading", { name: /matching pairs/i })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /Visual memory/i })).toHaveLength(1);
    expect(screen.queryByText("Tap two cards to find the pair.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Instructions" })).toBeInTheDocument();
  });

  it("unlocks the next Visual Memory level after one completed board", async () => {
    window.localStorage.setItem("visualMemory:tutorialSeen:v1:user-1", "true");
    renderMemoryGame("/memory-games/memory_match?level=1&variant=memory_match-l1-v1");

    await completeLevelOneVisualMemoryBoard();

    expect(await screen.findByRole("dialog")).toHaveTextContent("Level 1 of 20");
    expect(mocks.speakSequence).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Next Level 2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next round" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play again" })).toBeInTheDocument();
  });

  it("keeps Next Level available when earlier Visual Memory history exists", async () => {
    window.localStorage.setItem("visualMemory:tutorialSeen:v1:user-1", "true");
    vi.mocked(getGameHistory).mockResolvedValue([visualResult(0), visualResult(1)]);
    renderMemoryGame("/memory-games/memory_match?level=1&variant=memory_match-l1-v1");

    await completeLevelOneVisualMemoryBoard();

    expect(await screen.findByRole("dialog")).toHaveTextContent("Level 1 of 20");
    expect(screen.getByRole("button", { name: "Next Level 2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next round" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play again" })).toBeInTheDocument();
  });
});
