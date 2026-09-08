import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BenefitsNavigatorScreen from "./BenefitsNavigatorScreen";

const apiFetchMock = vi.hoisted(() => vi.fn());
const voiceHeroMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queryClient", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: "en" },
  }),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: (props: { voiceAgentSlug?: string; onChatClick?: () => void }) => {
    voiceHeroMock(props);
    return <button type="button" data-testid="mock-benefits-chat" onClick={props.onChatClick}>Chat with Inés</button>;
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname + location.search}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={["/benefits"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/benefits" element={<><BenefitsNavigatorScreen /><LocationProbe /></>} />
        <Route path="/social-rooms/experts/ines" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BenefitsNavigatorScreen", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    voiceHeroMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses Inés for the permanent voice and chat entry point", () => {
    renderScreen();

    expect(voiceHeroMock).toHaveBeenCalledWith(expect.objectContaining({
      voiceAgentSlug: "ines",
      voiceDynamicVariables: expect.objectContaining({ app_entrypoint: "benefits_navigator" }),
    }));

    fireEvent.click(screen.getByTestId("mock-benefits-chat"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/experts/ines");
  });

  it("submits the five-question screener and hands a result to Inés as a starter", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{
          id: "program-1",
          country: "ES",
          region: null,
          name: "Minimum Living Income",
          description: "Household income support.",
          askInesStarter: "Can you explain Minimum Living Income?",
        }],
      }),
    });
    renderScreen();

    fireEvent.click(screen.getByTestId("button-benefits-check"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/benefits/screenings?lang=en", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByRole("heading", { name: "Minimum Living Income" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Read explanation" }));
    expect(screen.getByText("Household income support.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ask Inés about this" }));
    expect(screen.getByTestId("current-route")).toHaveTextContent(
      "/social-rooms/experts/ines?starter=Can%20you%20explain%20Minimum%20Living%20Income%3F",
    );
  });

  it("shows the governed empty state when no reviewed programme is active", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });
    renderScreen();

    fireEvent.click(screen.getByTestId("button-benefits-check"));

    expect(await screen.findByText("No reviewed matches yet")).toBeInTheDocument();
  });
});
