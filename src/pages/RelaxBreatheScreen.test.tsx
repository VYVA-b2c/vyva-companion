import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import RelaxBreatheScreen from "./RelaxBreatheScreen";

const voiceMock = vi.hoisted(() => ({
  startVoice: vi.fn(),
  stopVoice: vi.fn(),
  sendText: vi.fn(),
  sendContextUpdate: vi.fn(),
  status: "idle" as "idle" | "connecting" | "connected",
  isMicMuted: false,
  transcript: [] as Array<{ from: "user" | "vyva"; text: string; timestamp: number }>,
}));

const labels: Record<string, string> = {
  "activities.relaxBreathe.title": "Relax & Breathe",
  "activities.relaxBreathe.intro": "A guided breathing session made for right now.",
  "activities.relaxBreathe.backToActivities": "Back to activities",
  "activities.relaxBreathe.safety": "If breathing feels difficult, painful, dizzy, or unusual, stop and seek help.",
  "activities.relaxBreathe.chooseTitle": "What would help now?",
  "activities.relaxBreathe.chooseBody": "Choose once. VYVA will shape the session and guide you.",
  "activities.relaxBreathe.talkToMarco": "Talk with Marco",
  "activities.relaxBreathe.planning": "Choosing a gentle plan...",
  "activities.relaxBreathe.listening": "Listening",
  "activities.relaxBreathe.muted": "Muted",
  "activities.relaxBreathe.voiceMode": "Voice",
  "activities.relaxBreathe.visualMode": "Visual",
  "activities.relaxBreathe.pause": "Pause",
  "activities.relaxBreathe.resume": "Resume",
  "activities.relaxBreathe.stop": "Stop",
  "activities.relaxBreathe.finish": "Finish",
  "activities.relaxBreathe.tryAgain": "Try again",
  "activities.relaxBreathe.completeTitle": "A calm pause is complete.",
  "activities.relaxBreathe.completeBody": "VYVA will remember what helped.",
  "activities.relaxBreathe.saferNext": "This may not be the right moment for breathing practice.",
  "activities.relaxBreathe.fallbackNotice": "Using a simple calm session for now.",
  "activities.relaxBreathe.proposedTitle": "Marco suggests",
  "activities.relaxBreathe.confirmStart": "Start this",
  "activities.relaxBreathe.askForChange": "Change it",
  "activities.relaxBreathe.voiceIntentHint": "Say calm, sleep, focus, easier, shorter, or stop.",
  "activities.relaxBreathe.awaitingConfirm": "Waiting for your yes.",
  "activities.relaxBreathe.slower": "Slower",
};

const recommendedPlan = {
  exerciseSlug: "sleep-soft-breath",
  title: "Sleep Soft Breath",
  description: "A slower wind-down session for bedtime.",
  purpose: "sleep",
  difficulty: 1,
  durationMinutes: 5,
  pattern: { inhale: 4, exhale: 7 },
  safetyNotes: ["Keep the breath comfortable."],
  voiceStyle: "soft",
  voicePrompt: "Guide a 5 minute Sleep Soft Breath session. The user may interrupt at any time.",
  phases: [
    { key: "settle", title: "Settle", instruction: "Let your eyes rest and soften your jaw.", cue: "Quiet body.", seconds: 45 },
    { key: "breathe", title: "Slow down", instruction: "Breathe in softly. Let the breath leave slowly.", cue: "In 4, out 7.", seconds: 210 },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    t: (key: string, fallback?: string) => labels[key] ?? fallback ?? key,
  }),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => ({
    startVoice: voiceMock.startVoice,
    stopVoice: voiceMock.stopVoice,
    sendText: voiceMock.sendText,
    sendContextUpdate: voiceMock.sendContextUpdate,
    status: voiceMock.status,
    isConnecting: false,
    isMicMuted: voiceMock.isMicMuted,
    lastError: null,
    transcript: voiceMock.transcript,
  }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

function mockReducedMotion(matches: boolean) {
  const mediaQuery = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mediaQuery));
}

function relaxBreatheTree() {
  return (
    <MemoryRouter initialEntries={["/activities/relax-breathe"]}>
      <Routes>
        <Route path="/activities/relax-breathe" element={<RelaxBreatheScreen />} />
        <Route path="/activities" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderRelaxBreathe() {
  return render(relaxBreatheTree());
}

function speak(text: string, timestamp: number) {
  voiceMock.transcript = [...voiceMock.transcript, { from: "user", text, timestamp }];
}

function mockHappyApi() {
  vi.mocked(apiFetch).mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === "/api/breathing/recommend") {
      return jsonResponse({
        safetyBlock: false,
        recommended: {
          exerciseSlug: recommendedPlan.exerciseSlug,
          name: recommendedPlan.title,
          description: recommendedPlan.description,
          difficulty: recommendedPlan.difficulty,
          durationMinutes: recommendedPlan.durationMinutes,
          why: "Matches sleep",
          plan: recommendedPlan,
        },
        options: [
          {
            exerciseSlug: recommendedPlan.exerciseSlug,
            name: recommendedPlan.title,
            description: recommendedPlan.description,
            difficulty: recommendedPlan.difficulty,
            durationMinutes: recommendedPlan.durationMinutes,
            why: "Matches sleep",
            plan: recommendedPlan,
          },
        ],
      });
    }

    if (url === "/api/breathing/sessions" && options?.method === "POST") {
      return jsonResponse({ session: { id: "session-1", status: "active" }, plan: recommendedPlan }, 201);
    }

    if (url === "/api/breathing/sessions/session-1" && options?.method === "PATCH") {
      return jsonResponse({ session: { id: "session-1", status: "completed" } });
    }

    return jsonResponse({ ok: true });
  });
}

describe("RelaxBreatheScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    voiceMock.status = "idle";
    voiceMock.isMicMuted = false;
    voiceMock.transcript = [];
    voiceMock.startVoice.mockResolvedValue(undefined);
    mockReducedMotion(false);
    mockHappyApi();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with one-tap guided intent choices instead of manual steps", () => {
    renderRelaxBreathe();

    expect(screen.getByRole("heading", { name: "Relax & Breathe" })).toBeInTheDocument();
    expect(screen.getByTestId("relax-breathe-intent-panel")).toHaveTextContent("What would help now?");
    expect(screen.getByTestId("button-relax-breathe-intent-calm")).toHaveTextContent("Calm");
    expect(screen.getByTestId("button-relax-breathe-intent-sleep")).toHaveTextContent("Sleep");
    expect(screen.queryByTestId("button-relax-breathe-stage-next")).not.toBeInTheDocument();
  });

  it("gets a personalized plan, saves an active session, and starts Marco listening", async () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-intent-sleep"));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/breathing/recommend",
      expect.objectContaining({ method: "POST" }),
    ));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/breathing/sessions",
      expect.objectContaining({ method: "POST" }),
    ));
    await waitFor(() => expect(voiceMock.startVoice).toHaveBeenCalledTimes(1));

    expect(voiceMock.startVoice).toHaveBeenCalledWith(
      expect.stringContaining("Sleep Soft Breath"),
      undefined,
      expect.objectContaining({
        agentSlug: "breathing-meditation",
        autoStartListening: true,
        dynamicVariables: expect.objectContaining({
          activity_id: "relax_breathe",
          activity_playbook_version: "relax_breathe.adaptive.v1",
          app_entrypoint: "relax_breathe_session",
          exercise_slug: "sleep-soft-breath",
          duration_minutes: 5,
        }),
      }),
    );
    expect(screen.getByTestId("relax-breathe-plan-summary")).toHaveTextContent("Sleep Soft Breath");
    expect(screen.getByTestId("relax-breathe-stage-instruction")).toHaveTextContent("Let your eyes rest");
  });

  it("starts a listening intent chat when the user wants to talk first", async () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-talk"));

    await waitFor(() => expect(voiceMock.startVoice).toHaveBeenCalledTimes(1));
    expect(voiceMock.startVoice).toHaveBeenCalledWith(
      expect.stringContaining("Start by asking what the user needs"),
      undefined,
      expect.objectContaining({
        agentSlug: "breathing-meditation",
        autoStartListening: true,
        dynamicVariables: expect.objectContaining({
          activity_id: "relax_breathe",
          app_entrypoint: "relax_breathe_intent",
        }),
      }),
    );
  });

  it("uses voice transcript to propose a plan, then starts only after confirmation", async () => {
    const view = renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-talk"));
    await waitFor(() => expect(voiceMock.startVoice).toHaveBeenCalledTimes(1));

    speak("I need help sleeping for five minutes", 1000);
    view.rerender(relaxBreatheTree());

    await waitFor(() => expect(screen.getByTestId("relax-breathe-proposed-plan")).toHaveTextContent("Sleep Soft Breath"));
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/breathing/recommend",
      expect.objectContaining({ method: "POST" }),
    );
    expect(vi.mocked(apiFetch).mock.calls.some(([url]) => url === "/api/breathing/sessions")).toBe(false);

    speak("yes start", 2000);
    view.rerender(relaxBreatheTree());

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/breathing/sessions",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(screen.getByTestId("relax-breathe-plan-summary")).toHaveTextContent("Sleep Soft Breath");
  });

  it("responds to voice pause during an active session", async () => {
    const view = renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-intent-sleep"));
    await waitFor(() => expect(screen.getByTestId("button-relax-breathe-pause")).toBeInTheDocument());

    speak("pause please", 3000);
    view.rerender(relaxBreatheTree());

    await waitFor(() => expect(screen.getByTestId("button-relax-breathe-resume")).toBeInTheDocument());
    expect(voiceMock.sendText).toHaveBeenCalledWith(
      expect.stringContaining("Pause the breathing guidance"),
      { invisibleInTranscript: true },
    );
  });

  it("shows safety guidance instead of starting a session when the backend blocks breathing practice", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse({
      safetyBlock: true,
      safetyMessage: "Stop and seek help.",
      options: [],
      recommended: null,
    }));

    renderRelaxBreathe();
    fireEvent.click(screen.getByTestId("button-relax-breathe-intent-calm"));

    await waitFor(() => expect(screen.getByTestId("relax-breathe-error")).toHaveTextContent("Stop and seek help."));
    expect(voiceMock.startVoice).not.toHaveBeenCalled();
  });

  it("saves completion and shows the completion state", async () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-intent-sleep"));
    await waitFor(() => expect(screen.getByTestId("button-relax-breathe-finish")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("button-relax-breathe-finish"));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/breathing/sessions/session-1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("session_completed"),
      }),
    ));
    expect(screen.getByTestId("relax-breathe-complete")).toHaveTextContent("A calm pause is complete.");
    expect(voiceMock.stopVoice).toHaveBeenCalled();
  });

  it("uses a static breathing cue when reduced motion is preferred", async () => {
    mockReducedMotion(true);
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-intent-sleep"));

    await waitFor(() => expect(screen.getByTestId("relax-breathe-orb")).toHaveAttribute("data-motion", "static"));
  });
});
