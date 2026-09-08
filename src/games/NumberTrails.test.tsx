import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import NumberTrails, { pickFreshNumberTrailConfig } from "./NumberTrails";

const gameDataMock = vi.hoisted(() => {
  const queue: Array<{ data: unknown; error: unknown }> = [];
  const from = vi.fn(() => {
    const query: Record<string, unknown> = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.gte = vi.fn(() => query);
    query.lt = vi.fn(() => query);
    query.limit = vi.fn(() => query);
    query.not = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.insert = vi.fn((payload) => Promise.resolve({ data: [{ id: "session-1", payload }], error: null }));
    query.upsert = vi.fn((payload) => {
      query.payload = payload;
      return query;
    });
    query.single = vi.fn(() => Promise.resolve({ data: query.payload, error: null }));
    query.maybeSingle = vi.fn(() => Promise.resolve(queue.shift() ?? { data: null, error: null }));
    query.then = (onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) =>
      Promise.resolve(queue.shift() ?? { data: null, error: null }).then(onfulfilled, onrejected);
    return query;
  });

  return { from, queue };
});

vi.mock("./shared/gameDataApi", () => ({
  gameData: {
    table: gameDataMock.from,
  },
}));

vi.mock("./shared/brainCoachSessions", () => ({
  recordCognitiveSession: vi.fn().mockResolvedValue(null),
}));

function tapCurrentTrail(labels = ["1", "2", "3", "4", "5"]) {
  labels.forEach((label) => {
    fireEvent.click(screen.getByRole("button", { name: label }));
  });
}

function nodePosition(label: string) {
  const node = screen.getByRole("button", { name: label });
  return `${node.style.left}:${node.style.top}`;
}

describe("NumberTrails", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLanguage("es");
    gameDataMock.queue.length = 0;
    gameDataMock.from.mockClear();
  });

  it("plays a local practice trail, ignores an out-of-order tap, completes, and exits", async () => {
    const onExit = vi.fn();
    render(<NumberTrails userId="" onExit={onExit} />);

    expect(await screen.findByTestId("number-trails-intro")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(screen.getByText("Ejemplo de practica - sin puntuacion")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    expect(screen.getByText("Siguiente punto: 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Siguiente punto: 1")).toBeInTheDocument();

    tapCurrentTrail();

    expect(await screen.findByRole("heading", { level: 2, name: "Buena orientacion." })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Siguiente sendero" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar este sendero" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terminar" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Jugar otro juego" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  }, 10_000);

  it("shows the practice example once, then starts future trails directly", async () => {
    render(<NumberTrails userId="" />);

    expect(await screen.findByTestId("number-trails-intro")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(screen.getByText("Ejemplo de practica - sin puntuacion")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    expect(window.localStorage.getItem("numberTrails:tutorialSeen:v1")).toBe("true");
    expect(screen.getByText("Siguiente punto: 1")).toBeInTheDocument();

    tapCurrentTrail();
    expect(await screen.findByRole("heading", { level: 2, name: "Buena orientacion." })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente sendero" }));
    expect(await screen.findByTestId("number-trails-intro")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(screen.queryByText("Ejemplo de practica - sin puntuacion")).not.toBeInTheDocument();
    expect(screen.getByText("Siguiente punto: 1")).toBeInTheDocument();
  }, 10_000);

  it("uses a fresh local trail for next trail and keeps replay intentional", async () => {
    render(<NumberTrails userId="" />);

    expect(await screen.findByTestId("number-trails-intro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));

    const firstTrailPosition = nodePosition("1");
    tapCurrentTrail();
    expect(await screen.findByRole("heading", { level: 2, name: "Buena orientacion." })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar este sendero" }));
    expect(await screen.findByTestId("number-trails-intro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(nodePosition("1")).toBe(firstTrailPosition);

    tapCurrentTrail();
    expect(await screen.findByRole("heading", { level: 2, name: "Buena orientacion." })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente sendero" }));
    expect(await screen.findByTestId("number-trails-intro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(nodePosition("1")).not.toBe(firstTrailPosition);
  }, 10_000);

  it("does not show next-next level progress when a level is unlocked", async () => {
    setLanguage("en");
    window.localStorage.setItem("numberTrails:tutorialSeen:v1", "true");
    const userState = {
      user_id: "user-1",
      current_tier: 1,
      sessions_at_tier: 2,
      consecutive_wins: 2,
      consecutive_losses: 0,
      total_sessions: 2,
      best_score: 500,
      last_played_at: null,
      streak_days: 1,
      last_streak_date: null,
      updated_at: new Date().toISOString(),
    };
    const config = {
      id: "config-1",
      trail_type: "numeric",
      node_count: 5,
      nodes: [
        { label: "1", x: 0.15, y: 0.2 },
        { label: "2", x: 0.72, y: 0.35 },
        { label: "3", x: 0.3, y: 0.58 },
        { label: "4", x: 0.8, y: 0.7 },
        { label: "5", x: 0.45, y: 0.88 },
      ],
      par_time_seconds: 30,
      difficulty_tier: 1,
      language: "en",
      is_active: true,
    };

    gameDataMock.queue.push(
      { data: userState, error: null },
      { data: [], error: null },
      { data: [config], error: null },
      { data: userState, error: null },
    );

    render(<NumberTrails userId="user-1" />);

    expect(await screen.findByTestId("number-trails-intro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    tapCurrentTrail();

    expect(await screen.findByRole("button", { name: "Continue to Level 2" })).toBeInTheDocument();
    expect(screen.queryByText("Next level: 3")).not.toBeInTheDocument();
  }, 10_000);

  it("prefers database configs outside the recent local guard", () => {
    const selected = pickFreshNumberTrailConfig(
      [
        { id: "already-used", nodes: [] },
        { id: "fresh-config", nodes: [] },
      ],
      ["already-used"],
    );

    expect(selected?.id).toBe("fresh-config");
  });
});
