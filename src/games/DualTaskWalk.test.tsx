import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import DualTaskWalk from "./DualTaskWalk";

const gameDataMock = vi.hoisted(() => {
  const query: Record<string, unknown> = {
    data: [],
    error: null,
  };

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.gte = vi.fn(() => query);
  query.insert = vi.fn(() => query);
  query.upsert = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  query.single = vi.fn(async () => ({ data: null, error: null }));

  return {
    from: vi.fn(() => query),
  };
});

vi.mock("./shared/gameDataApi", () => ({
  gameData: {
    table: gameDataMock.from,
  },
}));

vi.mock("./shared/brainCoachSessions", () => ({
  recordCognitiveSession: vi.fn(),
}));

describe("DualTaskWalk", () => {
  beforeEach(() => {
    setLanguage("en");
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows the tutorial once before the first local practice", async () => {
    render(<DualTaskWalk userId="" onExit={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "How it works" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I understand" }));

    expect(window.localStorage.getItem("dualTaskWalk:tutorialSeen:v1")).toBe("true");
    expect(await screen.findByTestId("dual-task-intro")).toBeInTheDocument();
    expect(screen.getByTestId("dual-task-walk-flow-shell").querySelector("h1")).toHaveTextContent("Dual Task");
    expect(screen.getByRole("button", { name: "Instructions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start exercise" })).toBeInTheDocument();
  });

  it("skips the tutorial after it has been seen and reopens from Instructions", async () => {
    window.localStorage.setItem("dualTaskWalk:tutorialSeen:v1", "true");

    render(<DualTaskWalk userId="" onExit={vi.fn()} />);

    expect(await screen.findByTestId("dual-task-intro")).toBeInTheDocument();
    expect(screen.getByTestId("dual-task-walk-flow-shell").querySelector("h1")).toHaveTextContent("Dual Task");
    expect(screen.queryByRole("heading", { name: "How it works" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Instructions" }));

    expect(await screen.findByRole("heading", { name: "How it works" })).toBeInTheDocument();
  });
});
