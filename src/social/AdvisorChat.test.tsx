import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdvisorChat from "./AdvisorChat";
import type { AdvisorSessionResponse } from "../../shared/advisors";

const queryMock = vi.hoisted(() => vi.fn());
const apiFetchMock = vi.hoisted(() => vi.fn());
const startVoiceMock = vi.hoisted(() => vi.fn());
const stopVoiceMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => queryMock(),
  };
});

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => ({
    startVoice: startVoiceMock,
    stopVoice: stopVoiceMock,
    status: "idle",
    isSpeaking: false,
    isConnecting: false,
    transcript: [],
  }),
}));

const ui = {
  backToCommunity: "Back to Community",
  eyebrow: "MY EXPERTS",
  title: "Choose an expert",
  instruction: "Tap an expert to talk.",
  loading: "Preparing your experts...",
  empty: "Your experts are not available right now.",
  neverTalked: "Never talked",
  today: "Today",
  yesterday: "Yesterday",
  daysAgo: (days: number) => `${days} days ago`,
  lastWeek: "Last week",
  startTalking: "Start talking",
  inputPlaceholder: "Write a message...",
  send: "Send",
  micIdle: "Talk by voice",
  micListening: "Listening",
  retry: "Try again",
  sendError: "Could not send. Try again.",
  disclaimerLabel: "Important note",
};

const noraSession: AdvisorSessionResponse = {
  language: "en",
  ui,
  advisor: {
    slug: "nora",
    name: "Nora",
    role: "Nutrition",
    shortRole: "Meals",
    intro: "Hi, I am Nora. I can help with simple meal ideas.",
    starter: "What would you like help planning today?",
    disclaimerText: "Nora shares general food and wellbeing information, not medical advice.",
    sortOrder: 10,
    iconKey: "nutrition",
    chipBg: "#E4F3E7",
    iconColor: "#3F8752",
    recencyLabel: "Never talked",
    sessionCount: 0,
    lastMessageAt: null,
  },
  introRequired: true,
  session: null,
  messages: [],
};

const amaraSession: AdvisorSessionResponse = {
  language: "en",
  ui,
  advisor: {
    slug: "amara",
    name: "Amara",
    role: "Coach",
    shortRole: "Movement",
    intro: "Gentle movement, balance, Tai chi, chair yoga, and light strength.",
    starter: "Would you like to move seated, with chair support, or a little more actively?",
    disclaimerText: "Amara shares gentle movement guidance. Stop if you feel pain, dizzy, or short of breath.",
    sortOrder: 5,
    iconKey: "coach",
    chipBg: "#E8F7EF",
    iconColor: "#0A7C4E",
    recencyLabel: "Never talked",
    sessionCount: 0,
    lastMessageAt: null,
  },
  introRequired: true,
  session: null,
  messages: [],
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

function renderChat(initialPath = "/social-rooms/experts/nora") {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[initialPath]}>
      <Routes>
        <Route path="/social-rooms/experts" element={<LocationProbe />} />
        <Route path="/social-rooms/experts/:agentSlug" element={<><AdvisorChat /><LocationProbe /></>} />
        <Route path="/social-rooms/morning-movement" element={<LocationProbe />} />
        <Route path="/social-rooms/morning-movement/exercises/:exerciseId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdvisorChat", () => {
  beforeEach(() => {
    queryMock.mockReset();
    apiFetchMock.mockReset();
    startVoiceMock.mockReset();
    stopVoiceMock.mockReset();
    queryMock.mockReturnValue({
      data: noraSession,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the first-session intro, starts a session, and opens voice with advisor context", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          id: "session-1",
          status: "active",
          startedAt: "2026-07-07T10:00:00.000Z",
          lastMessageAt: "2026-07-07T10:00:00.000Z",
        },
      }),
    });

    renderChat();

    expect(screen.getByTestId("advisor-intro")).toHaveTextContent("Nora Nutrition");
    expect(screen.queryByText("Hi, I am Nora. I can help with simple meal ideas.")).not.toBeInTheDocument();
    expect(screen.getByTestId("advisor-disclaimer")).toHaveTextContent("not medical advice");

    fireEvent.click(screen.getByTestId("button-advisor-start-talking"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/advisors/nora/sessions?lang=en", expect.objectContaining({ method: "POST" }));
    });
    expect(startVoiceMock).toHaveBeenCalledWith(
      expect.stringContaining("Ask an Expert with Nora"),
      undefined,
      expect.objectContaining({
        agentSlug: "nora",
        dynamicVariables: expect.objectContaining({ app_entrypoint: "ask_an_expert_chat" }),
      }),
    );
  });

  it("sends typed messages and shows user plus assistant bubbles", async () => {
    queryMock.mockReturnValue({
      data: {
        ...noraSession,
        introRequired: false,
        session: {
          id: "session-1",
          status: "active",
          startedAt: "2026-07-07T10:00:00.000Z",
          lastMessageAt: null,
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        session: {
          id: "session-1",
          status: "active",
          startedAt: "2026-07-07T10:00:00.000Z",
          lastMessageAt: "2026-07-07T10:02:00.000Z",
        },
        userMessage: {
          id: "message-user",
          role: "user",
          text: "Can you help with dinner?",
          source: "text",
          createdAt: "2026-07-07T10:01:00.000Z",
        },
        assistantMessage: {
          id: "message-assistant",
          role: "assistant",
          text: "Yes. Tell me what you have at home.",
          source: "text",
          createdAt: "2026-07-07T10:02:00.000Z",
        },
        advisor: noraSession.advisor,
      }),
    });

    renderChat();

    fireEvent.change(screen.getByTestId("input-advisor-message"), {
      target: { value: "Can you help with dinner?" },
    });
    fireEvent.click(screen.getByTestId("button-advisor-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/advisors/nora/messages?lang=en", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prompt: "Can you help with dinner?", sessionId: "session-1", source: "text" }),
      }));
    });

    expect(await screen.findByText("Can you help with dinner?")).toBeInTheDocument();
    expect(screen.getByText("Yes. Tell me what you have at home.")).toBeInTheDocument();
  });

  it("prefills a validated starter handoff from Benefits Navigator", () => {
    queryMock.mockReturnValue({
      data: { ...noraSession, introRequired: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderChat("/social-rooms/experts/nora?starter=Please%20explain%20housing%20benefit");

    expect(screen.getByTestId("input-advisor-message")).toHaveValue("Please explain housing benefit");
  });

  it("renders the backend movement coach with touch routine shortcuts", async () => {
    queryMock.mockReturnValue({
      data: amaraSession,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderChat("/social-rooms/experts/amara");

    expect(screen.getByRole("heading", { name: "Amara Coach" })).toBeInTheDocument();
    expect(screen.getByTestId("movement-coach-routines")).toHaveTextContent("Pick a routine");
    expect(screen.getByTestId("button-movement-coach-routine-chair-yoga")).toBeInTheDocument();
    expect(screen.getByTestId("button-movement-coach-routine-tai-chi")).toBeInTheDocument();
    expect(screen.getByTestId("button-movement-coach-routine-sit-to-stand")).toBeInTheDocument();
    expect(screen.queryByTestId("button-movement-coach-routine-calm-breathing")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-movement-coach-routine-chair-yoga"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/morning-movement/exercises/chair-yoga");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("starts the movement coach through the advisor API with voice context", async () => {
    queryMock.mockReturnValue({
      data: amaraSession,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          id: "amara-session-1",
          status: "active",
          startedAt: "2026-07-07T10:00:00.000Z",
          lastMessageAt: "2026-07-07T10:00:00.000Z",
        },
      }),
    });

    renderChat("/social-rooms/experts/amara");

    fireEvent.click(screen.getByTestId("button-advisor-start-talking"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/advisors/amara/sessions?lang=en", expect.objectContaining({ method: "POST" }));
      expect(startVoiceMock).toHaveBeenCalledWith(
        expect.stringContaining("Ask an Expert with Amara Coach"),
        undefined,
        expect.objectContaining({
          agentSlug: "amara",
          dynamicVariables: expect.objectContaining({ advisor_slug: "amara" }),
        }),
      );
    });
  });
});
