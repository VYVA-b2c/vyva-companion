import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommunityActivitiesScreen from "./CommunityActivitiesScreen";
import type { ParticipationEventRecommendation, ParticipationPulse } from "./types";

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
  getLanguageSnapshot: () => ({ language: "en", source: "test" }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => null,
}));

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function eventFixture(input: Partial<ParticipationEventRecommendation> & { id: string; title: string }): ParticipationEventRecommendation {
  return {
    id: input.id,
    eventKey: input.id,
    title: input.title,
    summary: input.summary ?? "A gentle curated event chosen for this profile.",
    description: input.description ?? "VYVA checks details before anyone commits.",
    format: input.format ?? "nearby",
    locationLabel: input.locationLabel ?? "Nearby or online",
    city: input.city ?? null,
    countryCode: input.countryCode ?? "ES",
    timeLabel: input.timeLabel ?? "This week, time to be checked",
    startsAt: null,
    endsAt: null,
    costLabel: input.costLabel ?? "Free or low cost",
    languageCodes: input.languageCodes ?? ["en", "es", "de"],
    tags: input.tags ?? ["music", "social"],
    interestTags: input.interestTags ?? ["music", "choir"],
    accessibilityTags: input.accessibilityTags ?? ["seating", "easy_access"],
    helperActions: input.helperActions ?? ["check_details", "transport", "reminder"],
    source: input.source ?? "curated",
    sourceUrl: null,
    status: input.status ?? "active",
    isCurated: input.isCurated ?? true,
    needsLiveCheck: input.needsLiveCheck ?? true,
    safetyStatus: input.safetyStatus ?? "approved",
    responseCounts: input.responseCounts ?? { interested: 2, maybe: 1, not_for_me: 0 },
    myResponse: input.myResponse ?? null,
    fitReasons: input.fitReasons ?? [
      { id: "interest", kind: "interest", label: "Matches music" },
      { id: "access", kind: "access", label: "Comfort and access included" },
      { id: "safety", kind: "safety", label: "VYVA checks details before you commit" },
    ],
    checkStatus: input.checkStatus ?? "none",
    score: input.score ?? 90,
  };
}

function pulseFixture(overrides: Partial<ParticipationPulse> = {}): ParticipationPulse {
  const featuredEvent = eventFixture({
    id: "gentle-choir-table",
    title: "Familiar songs table",
    summary: "A small gathering to listen, hum along, or share a song you love.",
    format: "hybrid",
  });
  const recommendations = [
    eventFixture({
      id: "book-club-taster",
      title: "Book club taster",
      summary: "A light session to hear recommendations and share a favourite read.",
      tags: ["reading"],
      interestTags: ["reading"],
      score: 70,
    }),
    eventFixture({
      id: "garden-walk",
      title: "Garden walk with pauses",
      summary: "A short outing to enjoy plants, sit when needed, and return without rushing.",
      tags: ["nature", "walking"],
      interestTags: ["nature", "walking"],
      score: 65,
    }),
  ];

  return {
    generatedAt: "2026-06-24T10:00:00.000Z",
    language: "en",
    headline: "Events chosen for you",
    reassurance: "VYVA checks details before you commit.",
    safetyCopy: "No booking, payment, or outside contact happens without your confirmation.",
    profileSignals: {
      interests: ["music", "reading"],
      locationLabel: "Near you or online",
      preferredTimes: ["afternoon"],
      languageLabel: "English",
      needsProfileNudge: false,
    },
    featuredEvent,
    recommendations,
    savedEvents: [],
    notifications: [],
    ...overrides,
  };
}

function clonePulse(pulse: ParticipationPulse): ParticipationPulse {
  return JSON.parse(JSON.stringify(pulse)) as ParticipationPulse;
}

function updatePulseResponse(pulse: ParticipationPulse, eventId: string, response: "interested" | "maybe" | "not_for_me" | "clear") {
  const nextResponse = response === "clear" ? null : response;
  const updateEvent = <T extends ParticipationEventRecommendation>(event: T): T => (
    event.id === eventId ? { ...event, myResponse: nextResponse } : event
  );
  const featuredEvent = updateEvent(pulse.featuredEvent);
  const recommendations = pulse.recommendations.map(updateEvent);
  const savedEvents = [featuredEvent, ...recommendations].filter((event) => (
    event.myResponse === "interested" || event.myResponse === "maybe"
  ));
  return { ...pulse, featuredEvent, recommendations, savedEvents };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <pre data-testid="route-state">{JSON.stringify(location.state ?? {})}</pre>
    </>
  );
}

function renderCommunityActivities(initialEntry = "/social-rooms/activities") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const res = await fetch(queryKey[0] as string);
          if (!res.ok) throw new Error("query failed");
          return res.json();
        },
      },
      mutations: { retry: false },
    },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/social-rooms/activities" element={<CommunityActivitiesScreen />} />
          <Route path="/social-rooms" element={<LocationProbe />} />
          <Route path="/concierge" element={<LocationProbe />} />
          <Route path="/onboarding/profile/hobbies" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...view, queryClient };
}

describe("CommunityActivitiesScreen", () => {
  let currentPulse: ParticipationPulse;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    currentPulse = pulseFixture();
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/social/participate/pulse")) {
        return jsonResponse({ pulse: clonePulse(currentPulse) });
      }
      if (url.includes("/respond") && init?.method === "POST") {
        const eventId = url.split("/events/")[1]?.split("/")[0] ?? "";
        const body = JSON.parse(String(init.body ?? "{}")) as { response: "interested" | "maybe" | "not_for_me" | "clear" };
        currentPulse = updatePulseResponse(currentPulse, eventId, body.response);
        return jsonResponse({
          ok: true,
          eventId,
          response: body.response === "clear" ? null : body.response,
          responseCounts: { interested: 3, maybe: 1, not_for_me: 0 },
        });
      }
      if (url.includes("/ask-vyva") && init?.method === "POST") {
        const eventId = url.split("/events/")[1]?.split("/")[0] ?? "";
        return jsonResponse({
          ok: true,
          eventId,
          checkStatus: "requested",
          conciergePrefill: {
            kind: "events",
            source: "participate",
            message: "Help me check this event. Do not book or contact anyone without my confirmation.",
            event: { id: eventId, title: "Familiar songs table" },
          },
        });
      }
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders a calm curated activities screen with a focused decision card", async () => {
    renderCommunityActivities();

    expect(await screen.findByRole("heading", { name: "For you" })).toBeInTheDocument();
    expect(screen.getByText("VYVA checks details before you commit.")).toBeInTheDocument();
    expect(screen.getByText("You confirm first")).toBeInTheDocument();
    expect(screen.getByTestId("activities-profile-signals")).toHaveTextContent("music");
    expect(screen.getByTestId("activities-featured-event")).toHaveTextContent("Familiar songs table");
    expect(screen.getByTestId("activities-featured-event")).toHaveTextContent("Matches music");
    expect(screen.getByTestId("activities-featured-event")).not.toHaveTextContent("Both");
    expect(screen.getByTestId("activities-featured-event")).toHaveTextContent("This week, time to be checked");
    expect(screen.getByTestId("activities-featured-event")).not.toHaveTextContent("Date TBC");
    expect(screen.getByTestId("activities-featured-event")).toHaveTextContent("Nearby or online");
    expect(screen.getByTestId("activities-profile-signals")).toHaveTextContent("Near you or online");
    expect(screen.getByText("Book club taster")).toBeInTheDocument();

    const interested = screen.getAllByRole("button", { name: /Interested/i })[0];
    const maybe = screen.getAllByRole("button", { name: /Maybe/i })[0];
    const askVyva = screen.getAllByRole("button", { name: /Check/i })[0];
    const notForMe = screen.getAllByRole("button", { name: /No thanks/i })[0];
    expect(interested).toHaveClass("min-h-[50px]");
    expect(interested).toHaveClass("bg-[#047857]");
    expect(maybe).toHaveClass("min-h-[44px]");
    expect(askVyva).toHaveClass("min-h-[44px]");
    expect(notForMe).toHaveClass("min-h-[44px]");
  });

  it("opens a Longevity walking handoff as nearby activity ideas with walking hints", async () => {
    renderCommunityActivities("/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning");

    expect(await screen.findByRole("heading", { name: "Nearby ideas" })).toBeInTheDocument();
    expect(screen.getByText("VYVA looks for gentle walks, local programs, and social activities close to home.")).toBeInTheDocument();
    expect(screen.getByTestId("activities-filter-nearby")).toHaveClass("bg-[#0F766E]");
    expect(screen.getByTestId("activities-more-recommendations")).toHaveTextContent("Garden walk with pauses");
    expect(fetchMock).toHaveBeenCalledWith("/api/social/participate/pulse?lang=en&interests=walking%2Cnature%2Ccommunity%2Clearning");
  });

  it("saves interested and maybe choices without making a commitment", async () => {
    renderCommunityActivities();

    fireEvent.click((await screen.findAllByRole("button", { name: /Interested/i }))[0]);

    await waitFor(() => {
      expect(screen.getByTestId("activities-featured-event")).toHaveTextContent("Interest saved");
    });
    expect(screen.getByTestId("activities-saved-events")).toHaveTextContent("Familiar songs table");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/social/participate/events/gentle-choir-table/respond",
      expect.objectContaining({ method: "POST" }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Maybe/i })[0]);

    await waitFor(() => {
      expect(screen.getByTestId("activities-featured-event")).toHaveTextContent("Saved for later");
    });
  });

  it("asks VYVA to check an event and carries event context to Concierge", async () => {
    renderCommunityActivities();

    fireEvent.click((await screen.findAllByRole("button", { name: /Check/i }))[0]);

    await waitFor(() => {
      expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge");
    });
    expect(screen.getByTestId("route-state")).toHaveTextContent("gentle-choir-table");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Do not book or contact anyone");
  });

  it("invites seniors with missing profile signals to add hobbies", async () => {
    currentPulse = pulseFixture({
      profileSignals: {
        interests: [],
        locationLabel: "Near you or online",
        preferredTimes: [],
        languageLabel: "English",
        needsProfileNudge: true,
      },
      emptyProfileNudge: {
        title: "Tell us your interests",
        body: "VYVA can then recommend events, classes, and outings that fit you.",
        actionLabel: "Add hobbies",
        path: "/onboarding/profile/hobbies",
      },
    });

    renderCommunityActivities();

    expect(await screen.findByTestId("activities-profile-nudge")).toHaveTextContent("Tell us your interests");

    fireEvent.click(screen.getByRole("button", { name: "Add hobbies" }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/onboarding/profile/hobbies");
  });
});
