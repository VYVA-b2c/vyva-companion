import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ListenClosely from "./ListenClosely";

const translate = (_key: string, fallback?: string) => fallback ?? _key;

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    language: "en",
    t: translate,
  }),
}));

vi.mock("./shared/brainCoachSessions", () => ({
  recordCognitiveSession: vi.fn(async () => ({ persisted: false })),
}));

describe("Listen Closely", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("shows the tutorial once and reopens it from Instructions", async () => {
    render(<ListenClosely userId="" onExit={vi.fn()} />);

    expect(await screen.findByText("Hear the sound. Then respond.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(window.localStorage.getItem("listenClosely:tutorialSeen:v1")).toBe("true");
    expect(await screen.findByRole("button", { name: "Start" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Instructions" }));

    expect(await screen.findByText("Hear the sound. Then respond.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("button", { name: "Start" })).toBeInTheDocument();
  });

  it("renders the senior-friendly intro and starts the listening screen", async () => {
    window.localStorage.setItem("listenClosely:tutorialSeen:v1", "true");
    const onExit = vi.fn();
    render(<ListenClosely userId="" onExit={onExit} />);

    expect(await screen.findByRole("heading", { name: "Listen, then choose." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Listen Closely", level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText(/Which sound happened more\?|Listen for/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Listen to both sounds. At the end, choose which one happened more.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toHaveClass("min-h-[52px]");

    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(
      await screen.findAllByText(/Tap when you hear it\.|Just listen\.|Listen to both sounds/),
    ).not.toHaveLength(0);
  });

  it("exits through the provided callback from the intro", async () => {
    window.localStorage.setItem("listenClosely:tutorialSeen:v1", "true");
    const onExit = vi.fn();
    render(<ListenClosely userId="" onExit={onExit} />);

    fireEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
