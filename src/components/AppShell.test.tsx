import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell, { SosSheet } from "./AppShell";
import {
  buildVoiceActionRouteState,
  emergencyProfileContactFromState,
  getAppShellLayout,
  isBrainCoachAppRoute,
  usesBrainCoachDocklessRoute,
} from "./appShellUtils";
import type { VoiceSessionPhase } from "@/lib/voiceSessionState";
import {
  VYVA_VOICE_APP_ACTION_EVENT,
  VYVA_VOICE_HOME_INTENT_EVENT,
  VYVA_VOICE_USER_MESSAGE_EVENT,
  type VoiceAppAction,
} from "@/lib/voiceNavigation";

const voiceState = vi.hoisted(() => ({
  status: "idle" as "idle" | "connecting" | "connected",
  isConnecting: false,
  isSpeaking: false,
  transcript: [] as Array<{ from: "user" | "vyva"; text: string; timestamp: number }>,
  voiceSessionPhase: "idle" as VoiceSessionPhase,
  isMicMuted: false,
  lastError: null as string | null,
  lastErrorCode: null as string | null,
  voiceDiagnostics: [],
  stopVoice: vi.fn(),
  setMicrophoneMuted: vi.fn(),
  startVoice: vi.fn(),
  beginVoiceTransfer: vi.fn(),
  sendContextUpdate: vi.fn(),
  recordRecommendationFeedback: vi.fn(),
}));

const voiceActionState = vi.hoisted(() => ({
  activeAction: null as VoiceAppAction | null,
  completeActiveAction: vi.fn(),
  dismissActiveAction: vi.fn(),
}));

const voiceCanvasState = vi.hoisted(() => ({
  activeScene: null as import("@/lib/voiceCanvasBridge").VoiceCanvasSceneEnvelope | null,
  submitResponse: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: null, isLoading: false }),
  };
});

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => voiceState,
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: { country: "US" } }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  useServiceGate: () => ({
    canUseService: () => true,
    guardPath: vi.fn(() => true),
    readiness: { services: {} },
  }),
}));

vi.mock("@/hooks/useToastSurface", () => ({
  useToastSurface: () => ({ current: null }),
}));

vi.mock("@/contexts/VoiceActionContext", () => ({
  useVoiceActionContext: () => ({
    activeAction: voiceActionState.activeAction,
    completeActiveAction: voiceActionState.completeActiveAction,
    dismissActiveAction: voiceActionState.dismissActiveAction,
  }),
}));

vi.mock("@/contexts/VoiceCanvasContext", () => ({
  useVoiceCanvasContext: () => ({
    activeScene: voiceCanvasState.activeScene,
    submitResponse: voiceCanvasState.submitResponse,
  }),
}));

vi.mock("./StatusBar", () => ({
  default: ({ variant, wide, autoHideHomeControls }: { variant?: string; wide?: boolean; autoHideHomeControls?: boolean }) => (
    <div
      data-testid="status-bar"
      data-variant={variant}
      data-wide={wide ? "true" : "false"}
      data-auto-hide-home-controls={autoHideHomeControls === undefined ? "unset" : String(autoHideHomeControls)}
    />
  ),
}));

vi.mock("./BottomNav", () => ({
  default: () => <nav data-testid="bottom-nav" />,
}));

vi.mock("./VoiceActionSimulator", () => ({
  default: () => null,
}));

vi.mock("./MotivationMilestoneProvider", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("./VoiceCallOverlay", () => ({
  default: ({ onEnd, onMinimize, canvasViewModel }: {
    onEnd: () => void;
    onMinimize?: () => void;
    canvasViewModel?: { title: string } | null;
  }) => (
    <div data-testid="voice-call-overlay">
      {canvasViewModel ? <div data-testid="voice-canvas-surface">{canvasViewModel.title}</div> : null}
      {onMinimize && (
        <button type="button" data-testid="button-minimize-call" onClick={onMinimize}>
          Minimize
        </button>
      )}
      <button type="button" data-testid="button-end-call" onClick={onEnd}>
        End
      </button>
    </div>
  ),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string, values?: Record<string, string>) => {
        if (!fallback) return _key;
        return fallback.replace(/{{(\w+)}}/g, (_, token) => values?.[token] ?? "");
      },
    }),
  };
});

describe("SOS service actions", () => {
  it("turns the primary SOS action into a direct emergency call", () => {
    render(<SosSheet open onOpenChange={vi.fn()} country="US" />);

    expect(screen.getByTestId("button-sos-confirm")).toHaveAttribute("href", "tel:911");
    expect(screen.getByTestId("button-sos-confirm")).toHaveTextContent("Call 911 now");
  });

  it("adds a direct call to the saved emergency contact when available", () => {
    render(
      <SosSheet
        open
        onOpenChange={vi.fn()}
        country="ES"
        profileContact={{ name: "Maria", primaryPhone: "+34 612 345 678" }}
      />,
    );

    expect(screen.getByTestId("button-sos-confirm")).toHaveAttribute("href", "tel:112");
    expect(screen.getByTestId("button-sos-call-contact")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-sos-call-contact")).toHaveTextContent("Call Maria");
  });

  it("keeps the cancel action as a close-only action", () => {
    const onOpenChange = vi.fn();
    render(<SosSheet open onOpenChange={onOpenChange} country="ES" />);

    fireEvent.click(screen.getByTestId("button-sos-cancel"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("extracts the profile emergency contact from onboarding state", () => {
    expect(emergencyProfileContactFromState({
      profile: {
        emergency_contact: {
          name: "Maria",
          relationship: "Daughter",
          primary_phone: "+34 612 345 678",
          secondary_phone: "",
        },
      },
    })).toEqual({
      name: "Maria",
      relationship: "Daughter",
      primaryPhone: "+34 612 345 678",
      secondaryPhone: "",
    });
  });
});

describe("app shell route layout", () => {
  it.each([
    ["/", "wide"],
    ["/menu", "wide"],
    ["/settings/account", "wide"],
    ["/health/symptom-check", "wide"],
    ["/health/vitals", "vitals"],
    ["/dev/home-master/vitals", "vitals"],
    ["/social-rooms/music-room", "wide"],
    ["/companions", "wide"],
    ["/concierge/shopping", "wide"],
    ["/senses", "wide"],
    ["/brain-coach/remember", "wide"],
    ["/chat", "fullscreen"],
    ["/activities/relax-breathe", "fullscreen"],
    ["/memory-games/word_recall", "fullscreen"],
    ["/attention-boosters/rhythm-tap", "fullscreen"],
    ["/dual-task-walk", "fullscreen"],
    ["/profiles/select", "compact"],
    ["/onboarding/profile/health", "compact"],
  ] as const)("classifies %s as %s", (pathname, layout) => {
    expect(getAppShellLayout(pathname)).toBe(layout);
  });

  it.each([
    "/mind-memory",
    "/mind-memory/cognitive-assessment",
    "/brain-coach/remember",
    "/brain-coach/focus",
    "/brain-coach/think",
    "/brain-coach/calm",
    "/brain-coach/activity/listen_closely",
    "/memory-games",
    "/memory-games/remember-later",
    "/attention-boosters",
    "/executive-function",
    "/senses",
    "/senses/listen-closely",
    "/spatial-navigator",
    "/face-name-match",
    "/dual-task-walk",
  ])("treats %s as a Brain Coach route", (pathname) => {
    expect(isBrainCoachAppRoute(pathname)).toBe(true);
  });

  it.each([
    "/brain-coach/activity/listen_closely",
    "/memory-games",
    "/memory-games/remember-later",
    "/attention-boosters",
    "/executive-function",
    "/senses",
    "/senses/listen-closely",
    "/spatial-navigator",
    "/face-name-match",
    "/dual-task-walk",
  ])("removes the global bottom dock on Brain Coach module route %s", (pathname) => {
    expect(usesBrainCoachDocklessRoute(pathname)).toBe(true);
  });

  it.each([
    "/mind-memory/cognitive-assessment",
    "/mind-memory",
    "/brain-coach/remember",
    "/brain-coach/focus",
    "/brain-coach/think",
    "/brain-coach/calm",
  ])("keeps the global bottom dock available on canonical Brain Coach route %s", (pathname) => {
    expect(usesBrainCoachDocklessRoute(pathname)).toBe(false);
  });

  it("shows the bottom dock on the canonical Brain Coach main menu", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/mind-memory"]}>
        <AppShell>
          <div>Brain menu</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
  });

  it("hides the bottom dock inside Brain Coach module hubs", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/memory-games"]}>
        <AppShell>
          <div>Memory module</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument();
  });

  it.each([
    ["/mind-memory", false],
    ["/brain-coach/remember", false],
    ["/brain-coach/activity/remember_later", true],
    ["/memory-games", true],
  ] as const)("starts the owned Brain Coach surface flush with the viewport on %s", (path, dockless) => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
        <AppShell>
          <div>Brain Coach page content</div>
        </AppShell>
      </MemoryRouter>,
    );

    const content = screen.getByTestId("app-shell-scroll");
    expect(content).toHaveClass("pt-0");
    expect(content).not.toHaveClass("pt-6");
    expect(content).toHaveClass(dockless ? "pb-0" : "pb-[112px]");
  });

  it.each([
    "/menu",
    "/health",
    "/health/symptom-check",
    "/health/vitals",
    "/health/prevention",
    "/dev/home-master/menu",
    "/dev/home-master/health",
    "/dev/home-master/brain",
    "/dev/home-master/community",
    "/dev/home-master/concierge",
    "/dev/home-master/reports",
    "/dev/home-master/check-in",
    "/dev/home-master/health-plan",
    "/dev/home-master/symptom-report",
    "/dev/home-master/symptom-warning",
    "/dev/home-master/ask-dr-ai",
    "/dev/home-master/ask-dr-ai-checking",
    "/dev/home-master/ask-dr-ai-next",
    "/dev/home-master/vitals",
    "/dev/home-master/medicines",
    "/informes/report-1",
  ])(
    "lets %s own the prototype topbar instead of rendering the global status surface",
    (path) => {
      render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
          <AppShell>
            <div>Menu page content</div>
          </AppShell>
        </MemoryRouter>,
      );

      expect(screen.queryByTestId("status-bar")).not.toBeInTheDocument();
      const shell = screen.getByTestId("app-shell");
      const content = screen.getByText("Menu page content").closest("main");
      if (
        path === "/menu" ||
        path === "/health" ||
        path === "/health/symptom-check" ||
        path === "/health/vitals" ||
        path === "/dev/home-master/vitals" ||
        path === "/dev/home-master/symptom-report" ||
        path === "/dev/home-master/symptom-warning" ||
        path.startsWith("/dev/home-master/ask-dr-ai")
      ) {
        expect(content).toHaveClass("h-[100svh]", "min-h-0", "[scrollbar-gutter:stable_both-edges]");
        expect(content).not.toHaveClass("min-h-screen");
      }
      if (path === "/health/vitals" || path === "/dev/home-master/vitals") {
        expect(shell.className).toContain("max-w-[1180px]");
        expect(shell.className).toContain(
          path.startsWith("/dev/home-master")
            ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)]"
            : "bg-[radial-gradient(circle_at_50%_18%,#30206B_0%,#171026_46%,#080715_100%)]",
        );
      } else if (path === "/health/prevention" || path.startsWith("/informes/")) {
        expect(shell.className).toContain("max-w-[920px]");
        expect(shell.className).toContain("bg-[radial-gradient(circle_at_50%_18%,#30206B_0%,#171026_46%,#080715_100%)]");
      } else if (path.startsWith("/dev/home-master")) {
        expect(shell.className).toContain("max-w-none");
        expect(shell.className).toContain("bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)]");
      } else {
        expect(shell.className).toContain("max-w-[430px]");
        expect(shell.className).toContain("md:max-w-[720px]");
        expect(shell.className).toContain("lg:max-w-[960px]");
        expect(shell.className).toContain("bg-[radial-gradient(circle_at_50%_18%,#30206B_0%,#171026_46%,#080715_100%)]");
      }
    },
  );

  it.each([
    "/settings/account",
    "/health/check-in",
    "/dev/home-master/check-in",
    "/dev/home-master/medicines",
  ])(
    "hides the prototype dock on %s",
    (path) => {
      render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
          <AppShell>
            <div>Focused page content</div>
          </AppShell>
        </MemoryRouter>,
      );

      expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument();
    },
  );

  it.each(["/health/vitals", "/dev/home-master/vitals"])(
    "uses the canonical single-header shell and shared dock on %s",
    (path) => {
      render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
          <AppShell>
            <div>Vitals page content</div>
          </AppShell>
        </MemoryRouter>,
      );

      expect(screen.queryByTestId("status-bar")).not.toBeInTheDocument();
      expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
      expect(screen.getByText("Vitals page content").closest("main")).toHaveClass(
        "h-[100svh]",
        "min-h-0",
        "[scrollbar-gutter:stable_both-edges]",
      );
    },
  );

  it("keeps the shared prototype dock on the canonical longevity plan", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/dev/home-master/health-plan"]}>
        <AppShell>
          <div>Longevity plan content</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
  });

  it("keeps the shared prototype dock on the canonical symptom report", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/dev/home-master/symptom-report"]}>
        <AppShell>
          <div>Symptom report content</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
  });
});

describe("app shell voice dock", () => {
  function makeVoiceAction(overrides: Partial<VoiceAppAction> = {}): VoiceAppAction {
    return {
      id: "voice_concierge_task",
      actionType: "concierge.task",
      domain: "concierge",
      route: "/concierge",
      title: "Concierge help",
      summary: "Opening Concierge.",
      cue: "Help with the request.",
      sourceText: "help me book something",
      priority: "medium",
      feedbackReason: "Agent requested concierge support.",
      requiredPayloadKeys: [],
      optionalPayloadKeys: [],
      safetyLevel: "sensitive",
      requiresConfirmation: true,
      completion: {
        mode: "manual",
        doneLabel: "Done",
        expiresAfterMs: 90000,
      },
      ...overrides,
    };
  }

  function renderShell(path = "/") {
    return render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
        <AppShell>
          <div>Page content</div>
        </AppShell>
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    voiceState.status = "connected";
    voiceState.isConnecting = false;
    voiceState.isSpeaking = false;
    voiceState.transcript = [{ from: "vyva", text: "Hello Karim", timestamp: 1 }];
    voiceState.voiceSessionPhase = "listening";
    voiceState.isMicMuted = false;
    voiceState.lastError = null;
    voiceState.lastErrorCode = null;
    voiceState.stopVoice.mockClear();
    voiceState.setMicrophoneMuted.mockClear();
    voiceActionState.activeAction = null;
    voiceActionState.completeActiveAction.mockClear();
    voiceActionState.dismissActiveAction.mockClear();
    voiceCanvasState.activeScene = null;
    voiceCanvasState.submitResponse.mockClear();
  });

  it("opens the focused voice screen from the dock and restores the dock when minimized", () => {
    renderShell("/settings");

    expect(screen.getByTestId("voice-session-dock")).toBeInTheDocument();
    expect(screen.getByTestId("voice-session-dock")).toHaveTextContent("Listening");
    expect(screen.getByTestId("voice-session-dock")).toHaveTextContent("Hello Karim");
    expect(screen.queryByTestId("button-dock-toggle-mic")).not.toBeInTheDocument();
    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-open-voice-overlay"));

    expect(screen.getByTestId("voice-call-overlay")).toBeInTheDocument();
    expect(screen.queryByTestId("voice-session-dock")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-minimize-call"));

    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("voice-session-dock")).toBeInTheDocument();
    expect(voiceState.stopVoice).not.toHaveBeenCalled();
  });

  it("lets the Home orb own active voice sessions without rendering the shell dock", () => {
    renderShell("/");

    expect(screen.queryByTestId("voice-session-dock")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-open-voice-overlay")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-dock-toggle-mic")).not.toBeInTheDocument();
    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
  });

  it("lets the dev Home master topbar own visual controls for regression", () => {
    renderShell("/dev/home-master");

    expect(screen.queryByTestId("status-bar")).not.toBeInTheDocument();
  });

  it("keeps Concierge voice canvas work compact and non-blocking", async () => {
    voiceCanvasState.activeScene = {
      owner: "concierge_ride",
      revision: 1,
      viewModel: {
        sceneId: "ride-destination",
        kind: "place",
        title: "Where are you going?",
      },
    };

    renderShell("/concierge");

    const shell = screen.getByTestId("app-shell");
    expect(shell).toHaveAttribute("data-layout", "wide");
    expect(shell.className).toContain("max-w-[920px]");
    expect(shell.className).not.toContain("lg:max-w-[980px]");
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.queryByTestId("voice-canvas-surface")).not.toBeInTheDocument();
    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeVisible();
    expect(screen.getByTestId("voice-session-dock")).toHaveAttribute("data-variant", "home-stop");

    fireEvent.click(screen.getByTestId("button-dock-end-call"));

    expect(voiceState.stopVoice).toHaveBeenCalledTimes(1);
  });

  it("uses compact active voice copy on prototype dock routes", () => {
    voiceState.isSpeaking = true;
    voiceState.voiceSessionPhase = "speaking";
    voiceState.transcript = [{ from: "vyva", text: "Try naming three things", timestamp: 2 }];

    renderShell("/mind-memory");

    const dock = screen.getByTestId("voice-session-dock");
    expect(dock).toHaveAttribute("data-variant", "home-stop");
    expect(dock).toHaveClass("min-h-[44px]");
    expect(dock.parentElement).toHaveClass("right-3", "sm:inset-x-0");
    expect(dock).toHaveTextContent("Voice on");
    expect(dock).not.toHaveTextContent("Speaking");
    expect(dock).not.toHaveTextContent("VYVA speaking");
    expect(dock).not.toHaveTextContent("Try naming three things");
    expect(screen.getByTestId("button-dock-end-call")).toBeInTheDocument();
  });

  it("ignores punctuation-only voice transcript events", () => {
    const actionHandler = vi.fn();
    window.addEventListener(VYVA_VOICE_APP_ACTION_EVENT, actionHandler);

    try {
      renderShell();

      window.dispatchEvent(new CustomEvent(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: {
          text: "'",
          transcriptEntry: { from: "user", text: "'", timestamp: 3 },
        },
      }));

      expect(actionHandler).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(VYVA_VOICE_APP_ACTION_EVENT, actionHandler);
    }
  });

  it("turns cognitive exercise voice transcripts into Brain Coach actions", () => {
    const actionHandler = vi.fn();
    window.addEventListener(VYVA_VOICE_APP_ACTION_EVENT, actionHandler);

    try {
      renderShell();

      window.dispatchEvent(new CustomEvent(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: {
          text: "I want cognitive exercises",
          transcriptEntry: { from: "user", text: "I want cognitive exercises", timestamp: 3 },
        },
      }));

      expect(actionHandler).toHaveBeenCalledTimes(1);
      expect(actionHandler.mock.calls[0][0].detail).toMatchObject({
        actionType: "brain.activity",
        domain: "brain_coach",
        route: "/mind-memory",
      });
    } finally {
      window.removeEventListener(VYVA_VOICE_APP_ACTION_EVENT, actionHandler);
    }
  });

  it("turns a broad Health transcript into the Home Health choice layer", () => {
    const homeIntentHandler = vi.fn();
    const actionHandler = vi.fn();
    window.addEventListener(VYVA_VOICE_HOME_INTENT_EVENT, homeIntentHandler);
    window.addEventListener(VYVA_VOICE_APP_ACTION_EVENT, actionHandler);

    try {
      renderShell("/");

      window.dispatchEvent(new CustomEvent(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: {
          text: "Mi salud",
          transcriptEntry: { from: "user", text: "Mi salud", timestamp: 3 },
        },
      }));

      expect(homeIntentHandler).toHaveBeenCalledTimes(1);
      expect(homeIntentHandler.mock.calls[0][0].detail).toBe("health");
      expect(actionHandler).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(VYVA_VOICE_HOME_INTENT_EVENT, homeIntentHandler);
      window.removeEventListener(VYVA_VOICE_APP_ACTION_EVENT, actionHandler);
    }
  });

  it("turns natural broad Health speech into the Home Health choice layer", () => {
    const homeIntentHandler = vi.fn();
    window.addEventListener(VYVA_VOICE_HOME_INTENT_EVENT, homeIntentHandler);

    try {
      renderShell("/dev/home-master");

      window.dispatchEvent(new CustomEvent(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: {
          text: "Quiero ayuda con mi salud",
          transcriptEntry: { from: "user", text: "Quiero ayuda con mi salud", timestamp: 4 },
        },
      }));

      expect(homeIntentHandler).toHaveBeenCalledTimes(1);
      expect(homeIntentHandler.mock.calls[0][0].detail).toBe("health");
    } finally {
      window.removeEventListener(VYVA_VOICE_HOME_INTENT_EVENT, homeIntentHandler);
    }
  });

  it.each([
    ["Mi salud", "health"],
    ["My mind", "mind"],
    ["Ma communaut\u00e9", "community"],
    ["Mein Concierge", "concierge"],
  ])("turns the broad %s transcript into the matching Home intent", (text, intent) => {
    const homeIntentHandler = vi.fn();
    const actionHandler = vi.fn();
    window.addEventListener(VYVA_VOICE_HOME_INTENT_EVENT, homeIntentHandler);
    window.addEventListener(VYVA_VOICE_APP_ACTION_EVENT, actionHandler);

    try {
      renderShell("/");

      window.dispatchEvent(new CustomEvent(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: {
          text,
          transcriptEntry: { from: "user", text, timestamp: 5 },
        },
      }));

      expect(homeIntentHandler).toHaveBeenCalledTimes(1);
      expect(homeIntentHandler.mock.calls[0][0].detail).toBe(intent);
      expect(actionHandler).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(VYVA_VOICE_HOME_INTENT_EVENT, homeIntentHandler);
      window.removeEventListener(VYVA_VOICE_APP_ACTION_EVENT, actionHandler);
    }
  });

  it("keeps non-health voice actions visible on their route", () => {
    voiceActionState.activeAction = makeVoiceAction();

    renderShell("/concierge");

    expect(screen.getByTestId("voice-action-card")).toHaveTextContent("Concierge help");
    expect(screen.getByTestId("voice-action-card")).toHaveTextContent("VYVA opened Concierge");
  });

  it("builds route prefill state for ride voice actions", () => {
    const state = buildVoiceActionRouteState(makeVoiceAction({
      id: "voice_concierge_ride_booking",
      actionType: "concierge.ride_booking",
      title: "Ride help",
      route: "/concierge",
      payload: {
        pickup: "Home",
        destination: "Doctor",
        time: "tomorrow morning",
        mobility_needs: "walker",
      },
    }));

    expect(state.voiceActionType).toBe("concierge.ride_booking");
    expect(state.voiceActionPayload).toMatchObject({
      pickup: "Home",
      destination: "Doctor",
      time: "tomorrow morning",
    });
    expect(state.conciergePrefill).toMatchObject({
      kind: "ride",
      source: "voice_action",
    });
    expect(JSON.stringify(state.conciergePrefill)).toContain("destination: Doctor");
  });

  it("builds shopping prefill state for order voice actions", () => {
    const state = buildVoiceActionRouteState(makeVoiceAction({
      id: "voice_concierge_order_request",
      actionType: "concierge.order_request",
      title: "Order help",
      route: "/concierge/shopping",
      sourceText: "Order groceries for tomorrow",
      payload: {
        items: "groceries",
        category: "groceries",
        delivery_time: "tomorrow",
      },
    }));

    expect(state.voiceActionType).toBe("concierge.order_request");
    expect(state.shoppingPrefill).toMatchObject({
      needText: "groceries",
      category: "groceries",
      priorities: ["delivery", "simplicity"],
      constraints: ["tomorrow"],
    });
  });

  it("does not show Health voice action cards after landing on a Health route", async () => {
    voiceActionState.activeAction = makeVoiceAction({
      id: "voice_symptom_support",
      actionType: "health.symptom_support",
      domain: "health",
      route: "/health/symptom-check",
      title: "Symptom support",
      summary: "Opening symptom support.",
      cue: "Ask one focused question at a time.",
      sourceText: "I want a symptom check",
      feedbackReason: "Agent requested symptom-support context.",
      safetyLevel: "medical",
      requiresConfirmation: false,
    });

    renderShell("/health/symptom-check");

    expect(screen.queryByTestId("voice-action-card")).not.toBeInTheDocument();
    expect(screen.queryByText("VYVA opened Health")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(voiceActionState.completeActiveAction).toHaveBeenCalledWith({
        metadata: {
          source: "app_voice_health_route_landed",
          current_path: "/health/symptom-check",
        },
      });
    });
  });
});
