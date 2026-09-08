import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SocialHub from "./SocialHub";
import type { SocialHubResponse, SocialRoom } from "./types";

const queryMock = vi.hoisted(() => vi.fn());
const voiceHeroMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => queryMock(),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: (props: { autoStartVoice?: boolean | string; voiceAgentSlug?: string }) => {
    voiceHeroMock(props);
    return <div data-testid="voice-hero" />;
  },
}));

vi.mock("@/components/VyvaSessionCta", () => ({
  default: ({ label, testId, className }: { label?: string; testId?: string; className?: string }) => (
    <button type="button" data-testid={testId} className={className}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => null,
}));

vi.mock("@/hooks/useRouteVoiceAutoStart", () => ({
  SECTION_VOICE_AUTO_START_KEY: "autoStartSectionVoice",
  useRouteVoiceAutoStart: () => false,
}));

function socialRoom(slug: string, name: string, overrides: Partial<SocialRoom> = {}): SocialRoom {
  return {
    slug,
    name,
    category: "social",
    agentSlug: `${slug}-agent`,
    agentFullName: "VYVA Host",
    agentColour: "#6D28D9",
    agentCredential: "Room guide",
    ctaLabel: "Enter room",
    topicTags: ["community"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    participantCount: 8,
    sessionDate: "2026-06-20",
    topic: `${name} topic`,
    opener: `${name} opener`,
    quote: "",
    activityType: "discussion",
    contentTag: "",
    contentTitle: `${name} today`,
    contentBody: `${name} details`,
    options: [],
    liveBadge: "8 in the room",
    ...overrides,
  };
}

const hubResponse: SocialHubResponse = {
  user: { id: "user-1", firstName: "Karim", language: "en" },
  timeSlot: "morning",
  activeCount: 5,
  interestTags: [],
  lastRooms: [],
  heroRooms: [],
  alsoForYou: [],
  listRooms: [
    socialRoom("reading-room", "Reading Room"),
    socialRoom("games-room", "Games Room"),
    socialRoom("kitchen-table", "Kitchen Table"),
    socialRoom("music-room", "Music Room"),
    socialRoom("garden-corner", "Garden Corner"),
  ],
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

function renderSocialHub() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/social-rooms"]}>
      <Routes>
        <Route path="/social-rooms" element={<><SocialHub /><LocationProbe /></>} />
        <Route path="/social-rooms/join-in" element={<><SocialHub roomsOnly /><LocationProbe /></>} />
        <Route path="/social-rooms/experts" element={<LocationProbe />} />
        <Route path="/social-rooms/share" element={<LocationProbe />} />
        <Route path="/social-rooms/activities" element={<LocationProbe />} />
        <Route path="/social-rooms/:slug" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SocialHub home-style layout", () => {
  beforeEach(() => {
    queryMock.mockReset();
    voiceHeroMock.mockClear();
    queryMock.mockReturnValue({
      data: hubResponse,
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders the Community master layout without the old duplicate room launcher", () => {
    renderSocialHub();

    expect(screen.getByTestId("community-master-layout")).toBeInTheDocument();
    expect(screen.getByTestId("community-master-hero")).toHaveTextContent("Community ready");
    expect(screen.queryByTestId("voice-hero")).not.toBeInTheDocument();
    expect(voiceHeroMock).not.toHaveBeenCalled();

    const primaryCards = screen.getByTestId("social-primary-cards");
    expect(within(primaryCards).getByRole("button", { name: "Make Friends. Find people like me" })).toBeInTheDocument();
    expect(within(primaryCards).getByRole("button", { name: "Ask an Expert. Talk with a VYVA specialist" })).toBeInTheDocument();
    expect(within(primaryCards).getByRole("button", { name: "Share Stories. A memory or song" })).toBeInTheDocument();
    expect(within(primaryCards).getByRole("button", { name: "What's On. Movement and clubs" })).toBeInTheDocument();
    expect(within(primaryCards).getAllByRole("button").map((card) => card.getAttribute("data-testid"))).toEqual([
      "card-social-primary-match",
      "card-social-primary-experts",
      "card-social-primary-share",
      "card-social-primary-activities",
    ]);
    expect(primaryCards).not.toHaveTextContent("Participate");
    expect(primaryCards).not.toHaveTextContent("Join In");
    expect(screen.getByTestId("card-social-primary-experts")).toHaveAccessibleName("Ask an Expert. Talk with a VYVA specialist");
    expect(primaryCards).toHaveTextContent("Movement and clubs");
    expect(screen.getByTestId("card-social-primary-activities")).toHaveAccessibleName("What's On. Movement and clubs");
    expect(primaryCards).not.toHaveTextContent("Challenge");
    expect(primaryCards).not.toHaveTextContent("Learn");
    expect(screen.queryByTestId("button-social-quick-challenge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-social-quick-learn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("social-room-list")).not.toBeInTheDocument();
  });

  it("opens Ask an Expert as a dedicated expert hub", () => {
    renderSocialHub();

    fireEvent.click(screen.getByTestId("card-social-primary-experts"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/experts");
  });

  it("opens Activities as the Community activities area", () => {
    renderSocialHub();

    fireEvent.click(screen.getByTestId("card-social-primary-activities"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/activities");
  });

  it("opens Share Stories as the dedicated story drop box", () => {
    renderSocialHub();

    fireEvent.click(screen.getByTestId("card-social-primary-share"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/share");
  });

  it("shows three visible Fast help actions", () => {
    renderSocialHub();

    const fastHelp = screen.getByTestId("social-fast-help");
    expect(fastHelp).toHaveTextContent("Fast help");
    expect(fastHelp).toHaveTextContent("Bring Song");
    expect(fastHelp).toHaveTextContent("Cook Together");
    expect(fastHelp).toHaveTextContent("Garden Chat");
    expect(screen.getAllByTestId(/^button-social-fast-help-/)).toHaveLength(3);
  });

  it("rotates through the full final Fast help set", () => {
    vi.useFakeTimers();
    renderSocialHub();

    expect(screen.getByTestId("button-social-fast-help-bring-song")).toHaveTextContent("Bring Song");
    expect(screen.getByTestId("button-social-fast-help-cook-together")).toHaveTextContent("Cook Together");
    expect(screen.getByTestId("button-social-fast-help-garden-chat")).toHaveTextContent("Garden Chat");

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByTestId("button-social-fast-help-reading-corner")).toHaveTextContent("Reading Corner");
    expect(screen.getByTestId("button-social-fast-help-light-game")).toHaveTextContent("Light Game");
    expect(screen.getByTestId("button-social-fast-help-move-together")).toHaveTextContent("Move Together");
  });

  it("opens room routes from Fast help", () => {
    renderSocialHub();

    fireEvent.click(screen.getByTestId("button-social-fast-help-cook-together"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/kitchen-table");
  });
});
