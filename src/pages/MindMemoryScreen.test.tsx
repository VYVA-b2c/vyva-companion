import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MindMemoryScreen from "./MindMemoryScreen";
import { HOME_MASTER_THEME_STORAGE_KEY } from "@/hooks/useHomeMasterTheme";

const guardPathMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  useServiceGate: () => ({ guardPath: guardPathMock }),
}));

vi.mock("@/components/CanonicalDetailFlowShell", () => ({
  CanonicalVoiceButton: ({ label, testId }: { label?: string; testId?: string }) => (
    <button type="button" data-testid={testId}>
      {label}
    </button>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

function renderMindMemory() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/mind-memory"]}>
      <Routes>
        <Route path="/mind-memory" element={<MindMemoryScreen />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MindMemoryScreen", () => {
  beforeEach(() => {
    guardPathMock.mockClear();
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "light");
  });

  it("uses the canonical health-hub structure for Brain Coach", () => {
    renderMindMemory();

    expect(screen.getByTestId("mind-memory-canonical-topbar")).toHaveTextContent("Brain Coach");
    expect(screen.getByTestId("mind-memory-master-layout")).toHaveAttribute("data-flow-id", "brain_coach.activity_session");
    expect(screen.getByTestId("mind-memory-master-layout")).toHaveAttribute("data-registry-scene", "brain_coach.activity_session.main");
    expect(screen.getByTestId("mind-memory-master-layout")).toHaveAttribute("data-home-master-theme", "light");
    expect(screen.getByTestId("mind-memory-cards")).toHaveAttribute("data-card-layout", "canonical-health-hub-grid");
    expect(screen.queryByText("Choose a skill")).not.toBeInTheDocument();
    expect(screen.queryByText("Cognitive Assessment")).not.toBeInTheDocument();

    const expectedCards = [
      ["card-mind-memory-strengthen-memory", "Remember", "8 activities", "bridge"],
      ["card-mind-memory-train-reflexes", "Focus & React", "3 activities", "pulse"],
      ["card-mind-memory-boost-focus", "Think & Plan", "3 activities", "knobs"],
      ["card-mind-memory-sharpen-senses", "Calm & Notice", "2 activities", "signal"],
    ] as const;

    for (const [testId, title, count, iconAccent] of expectedCards) {
      expect(screen.getByTestId(testId)).toHaveAttribute("data-vyva-card-layout", "canonical-health-hub-action");
      expect(screen.getByTestId(testId)).toHaveTextContent(title);
      expect(screen.getByTestId(`${testId}-status`)).toHaveTextContent(count);
      expect(screen.getByTestId(testId).querySelector(`[data-vyva-icon-tile="${iconAccent}"]`)).toBeInTheDocument();
    }

    expect(screen.queryByText("Memory and recall")).not.toBeInTheDocument();
    expect(screen.queryByText("Attention and response")).not.toBeInTheDocument();
    expect(screen.queryByText("Planning and rules")).not.toBeInTheDocument();
    expect(screen.queryByText("Calm and sensory awareness")).not.toBeInTheDocument();
  });

  it("uses the canonical dark surfaces when the saved theme is dark", () => {
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "dark");
    renderMindMemory();

    expect(screen.getByTestId("mind-memory-master-layout")).toHaveAttribute("data-home-master-theme", "dark");
    expect(screen.getByTestId("card-mind-memory-strengthen-memory")).toHaveClass("bg-white/[0.08]");
  });

  it.each([
    ["card-mind-memory-strengthen-memory", "/brain-coach/remember"],
    ["card-mind-memory-train-reflexes", "/brain-coach/focus"],
    ["card-mind-memory-boost-focus", "/brain-coach/think"],
    ["card-mind-memory-sharpen-senses", "/brain-coach/calm"],
  ])("routes %s to its existing module", (testId, route) => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId(testId));
    expect(screen.getByTestId("current-route")).toHaveTextContent(route);
  });
});
