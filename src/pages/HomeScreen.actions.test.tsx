import "@testing-library/react/dont-cleanup-after-each";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { flushSync } from "react-dom";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomeScreen from "./HomeScreen";
import {
  homeFastHelpJourneyStorageKey,
  markHomeFastHelpJourney,
  mergeSyncedHomeFastHelpJourneys,
  startHomeFastHelpJourney,
} from "@/lib/homeFastHelpOutcome";
import { SHOW_VYVA_REVIEW_HISTORY_KEY } from "@/lib/showVyvaReviewHistory";
import {
  VYVA_VOICE_APP_ACTION_RESULT_EVENT,
  VYVA_VOICE_HOME_INTENT_EVENT,
  VYVA_VOICE_HOME_SUBFLOW_EVENT,
  VYVA_VOICE_USER_MESSAGE_EVENT,
  VOICE_HOME_SUBFLOW_PILLARS,
} from "@/lib/voiceNavigation";
import { CROSS_PILLAR_COMPLETION_ACTIONS } from "@/components/voice-canvas/CrossPillarSubflowCanvas";
import {
  HOME_CONTEXT_ACTION_HISTORY_KEY,
  type HomeContextMessageActionHistory,
} from "@/lib/homeContextMessages";
import {
  VYVA_HOME_MODE_CONTROL_ACTION_EVENT,
  readLatestHomeModeControl,
  type HomeInteractionMode,
} from "@/lib/homeModeControl";
import { VOICE_ORB_HINT_SEEN_STORAGE_KEY } from "@/lib/voiceOrbHint";

const guardPathMock = vi.fn();
const canUseServiceMock = vi.fn(() => true);
const queryMock = vi.fn();
const voiceHeroMock = vi.hoisted(() => vi.fn());
const voiceMock = vi.hoisted(() => ({
  status: "idle" as "idle" | "connecting" | "connected",
  isConnecting: false,
  sendContextUpdate: vi.fn(() => true),
}));
const profileMock = vi.hoisted(() => ({
  firstName: "Karim",
  profileId: "profile-home",
  serviceReadiness: {
    hasSavedDoctor: undefined as boolean | undefined,
    hasSavedTransportProvider: undefined as boolean | undefined,
    hasMobilityInfo: undefined as boolean | undefined,
    hasCoverageInfo: undefined as boolean | undefined,
  },
  withGpContact: true,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey: unknown[] }) => queryMock(options.queryKey),
  };
});

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    firstName: profileMock.firstName,
    profile: profileMock.withGpContact
      ? {
          profileId: profileMock.profileId,
          gpName: "Dr Garcia",
          gpPhone: "+34 612 345 678",
          gpEmail: "gp@example.com",
          serviceReadiness: profileMock.serviceReadiness,
        }
      : {
          profileId: profileMock.profileId,
          serviceReadiness: profileMock.serviceReadiness,
        },
  }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  serviceForPath: () => undefined,
  useServiceGate: () => ({
    guardPath: guardPathMock,
    canUseService: canUseServiceMock,
    readiness: { services: {} },
  }),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useOptionalVyvaVoice: () => voiceMock,
}));

vi.mock("@/components/VoiceHero", () => ({
  default: (props: {
    autoStartListening?: boolean;
    autoStartVoice?: boolean | string;
    chatLabel?: string;
    canStartVoice?: () => boolean;
    contextHint?: string;
    heroSurface?: string;
    onChatClick?: () => void;
    showVoiceOverlay?: boolean;
    talkLabel?: string;
    voiceAgentSlug?: string;
    voiceDynamicVariables?: Record<string, string | number | boolean>;
    headline?: ReactNode;
  }) => {
    voiceHeroMock(props);
    return (
      <div
        data-testid="voice-hero"
        data-overlay={String(Boolean(props.showVoiceOverlay))}
        data-auto-start={String(Boolean(props.autoStartVoice))}
        data-auto-listening={String(Boolean(props.autoStartListening))}
        data-context={props.contextHint ?? ""}
        data-agent-slug={props.voiceAgentSlug ?? ""}
        data-app-entrypoint={String(props.voiceDynamicVariables?.app_entrypoint ?? "")}
      >
        <div data-testid="voice-hero-headline">{props.headline}</div>
        <button type="button" data-testid="button-voice-hero-talk" onClick={() => props.canStartVoice?.()}>
          {props.talkLabel}
        </button>
        {props.onChatClick && (
          <button type="button" data-testid="button-home-type-instead" onClick={props.onChatClick}>
            {props.chatLabel}
          </button>
        )}
      </div>
    );
  },
}));

vi.mock("@/components/VyvaSessionCta", () => ({
  default: ({
    label,
    testId,
    className,
    supportingLabel,
    visual,
    voiceOrbCaptionTestId,
    onFirstVoiceOrbActivation,
  }: {
    label?: string;
    testId?: string;
    className?: string;
    supportingLabel?: string;
    visual?: string;
    voiceOrbCaptionTestId?: string;
    onFirstVoiceOrbActivation?: () => void;
  }) => (
    <button
      type="button"
      data-testid={testId}
      className={className}
      aria-label={visual === "voiceRail" ? supportingLabel : label}
      onClick={onFirstVoiceOrbActivation}
    >
      {visual === "voiceOrb" ? <span data-testid="home-dormant-zamora-orb" /> : null}
      {visual === "voiceRail" ? null : label}
      {visual === "voiceOrb" ? <span data-testid={voiceOrbCaptionTestId}>{supportingLabel}</span> : null}
    </button>
  ),
}));

const labels: Record<string, string> = {
  "home.whatNow": "or explore a topic",
  "home.mode.label": "Choose how to talk with VYVA",
  "home.mode.type": "Type",
  "home.mode.voice": "Voice",
  "home.mode.switchToTouch": "Switch to touch",
  "home.mode.switchToVoice": "Switch to voice",
  "home.mode.voiceCta": "Talk to VYVA",
  "home.master.chooseCategory": "Today tray",
  "home.master.heroSubtitle": "VYVA is ready when you are.",
  "home.master.touchOrbToBegin": "Touch the orb to begin.",
  "home.master.proactiveGreeting.morning": "How are you feeling?",
  "home.master.proactiveGreeting.afternoon": "How are you feeling?",
  "home.master.proactiveGreeting.evening": "How are you feeling?",
  "home.master.voiceSupport": "Touch the orb to begin.",
  "home.master.healthIntent.title": "Are you OK?",
  "home.master.healthIntent.more": "More health options",
  "home.master.healthIntent.moreCompact": "More",
  "home.master.healthIntent.dormantSubtitle": "Choose a health option, or touch the orb.",
  "home.master.healthIntent.voiceSubtitle": "Touch the orb to begin.",
  "home.master.mindIntent.title": "What would you like to exercise?",
  "home.master.mindIntent.more": "More mind activities",
  "home.master.mindIntent.moreCompact": "More",
  "home.master.mindIntent.dormantSubtitle": "Choose an activity, or touch the orb.",
  "home.master.mindIntent.voiceSubtitle": "Touch the orb to begin.",
  "home.master.communityIntent.title": "How would you like to connect?",
  "home.master.communityIntent.more": "More community options",
  "home.master.communityIntent.moreCompact": "More",
  "home.master.communityIntent.dormantSubtitle": "Choose a way to connect, or touch the orb.",
  "home.master.communityIntent.voiceSubtitle": "Touch the orb to begin.",
  "home.master.conciergeIntent.title": "What can VYVA help arrange?",
  "home.master.conciergeIntent.more": "More concierge services",
  "home.master.conciergeIntent.moreCompact": "Other",
  "home.master.conciergeIntent.dormantSubtitle": "Choose a service, or touch the orb.",
  "home.master.conciergeIntent.voiceSubtitle": "Touch the orb to begin.",
  "home.greeting.afternoon.withName.1": "Good afternoon, {{name}}",
  "home.greeting.afternoon.withoutName.1": "Good afternoon",
  "home.greeting.evening.withName.1": "Good evening, {{name}}",
  "home.fastHelp.kicker": "Fast help",
  "home.fastHelp.title": "What would you like VYVA to do?",
  "home.fastHelp.doctor.label": "Talk to a real doctor now",
  "home.fastHelp.doctor.sub": "Get live medical help.",
  "home.fastHelp.rotate": "More",
  "home.fastHelp.rotateAria": "Show different fast help choices",
  "home.fastHelp.appointment.label": "Schedule an appointment",
  "home.fastHelp.appointment.sub": "Let VYVA arrange it with you.",
  "home.fastHelp.ride.label": "Find transport",
  "home.fastHelp.ride.sub": "Compare safe ways to get there.",
  "home.fastHelp.doctorContext": "Home quick doctor help request. Ask what is happening and help prepare a safe next step.",
  "home.fastHelp.appointmentPrefill": "Please help me schedule an appointment. Ask what kind of appointment I need and do not book anything without my confirmation.",
  "home.fastHelp.ridePrefill": "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation.",
  "home.nudge.text": "Not sure where to start?",
  "home.nudge.action": "Ask VYVA",
  "home.nudge.aria": "Ask VYVA where to start",
  "home.recoveryNudge.title": "Continue where you left off",
  "home.recoveryNudge.detail": "Continue {{action}} when you are ready.",
  "home.recoveryNudge.blockedTitle": "One quick step first",
  "home.recoveryNudge.blockedDetail": "Open {{action}} to see what is needed.",
  "home.recoveryNudge.transportSetupTitle": "One quick setup first",
  "home.recoveryNudge.transportSetupDetail": "Add a trusted transport provider to continue your ride.",
  "home.recoveryNudge.transportSetupNotice": "Save a trusted taxi or transport provider, then continue your ride.",
  "home.recoveryNudge.continue": "Continue",
  "home.recoveryNudge.later": "Later",
  "home.recoveryNudge.dismiss": "Dismiss",
  "home.conciergeResume.kicker": "Right now",
  "home.conciergeResume.kickerConfirm": "Needs your OK",
  "home.conciergeResume.kickerReview": "Needs review",
  "home.conciergeResume.kickerWaiting": "Waiting",
  "home.conciergeResume.titlePrefix": "VYVA is working on your",
  "home.conciergeResume.titleConfirmPrefix": "Confirm your",
  "home.conciergeResume.titleReviewPrefix": "Review your",
  "home.conciergeResume.task.ride": "ride",
  "home.conciergeResume.task.appointment": "appointment",
  "home.conciergeResume.task.pharmacy": "pharmacy request",
  "home.conciergeResume.task.homeService": "home service",
  "home.conciergeResume.task.provider": "provider search",
  "home.conciergeResume.task.providerShortlist": "saved options",
  "home.conciergeResume.task.admin": "admin task",
  "home.conciergeResume.task.safety": "safety check",
  "home.conciergeResume.task.default": "request",
  "home.conciergeResume.fastStatus.ride": "Check ride status",
  "home.conciergeResume.fastStatus.appointment": "Check appointment",
  "home.conciergeResume.fastStatus.pharmacy": "Check pharmacy request",
  "home.conciergeResume.fastStatus.homeService": "Check home service",
  "home.conciergeResume.fastStatus.provider": "Check provider search",
  "home.conciergeResume.fastStatus.providerShortlist": "Review shortlist",
  "home.conciergeResume.fastStatus.admin": "Check admin task",
  "home.conciergeResume.fastStatus.safety": "Check safety review",
  "home.conciergeResume.fastStatus.default": "Check request",
  "home.conciergeResume.step.contacting": "Contacting provider",
  "home.conciergeResume.step.waiting": "Waiting for reply",
  "home.conciergeResume.step.form": "Preparing form",
  "home.conciergeResume.step.save": "Ready to save",
  "home.conciergeResume.step.attention": "Needs your review",
  "home.conciergeResume.step.confirm": "Waiting for your confirmation",
  "home.conciergeResume.step.providerShortlist": "Review saved options",
  "home.conciergeResume.kickerProviderShortlist": "Saved shortlist",
  "home.conciergeResume.titleProviderShortlistPrefix": "Review your",
  "home.conciergeResume.open": "Open Right Now",
  "home.conciergeResume.openShort": "Open",
  "home.conciergeResume.followUp": "Follow up",
  "home.conciergeResume.gotReply": "I got a reply",
  "home.conciergeResume.waitingTitle": "Waiting for {{provider}}",
  "home.conciergeResume.providerFallback": "provider",
  "home.conciergeReuse.kicker": "Useful again",
  "home.conciergeReuse.title": "Use last {{task}} again",
  "home.conciergeReuse.action": "Use template",
  "home.conciergeReuse.providerFallback": "VYVA",
  "meds.callGpNamed": "Call {{name}}",
  "meds.callGp": "Call GP",
  "meds.callGpSub": "Speak to your practice now.",
  "meds.emailGp": "Email GP",
  "meds.emailGpSub": "Open an email with context filled in.",
  "health.symptomCheck.report.actions.emailSubject": "VYVA symptom report",
  "home.voiceCards.health.title": "My health",
  "home.voiceCards.health.subtitle": "Symptoms, meds and wellbeing",
  "home.voiceCards.health.micLabel": "Talk about my health",
  "home.voiceCards.cognitive.title": "Brain Power",
  "home.voiceCards.cognitive.subtitle": "Memory, focus and calm",
  "home.voiceCards.cognitive.micLabel": "Open Brain Power",
  "home.voiceCards.social.title": "My Community",
  "home.voiceCards.social.subtitle": "Rooms, chats and shared moments",
  "home.voiceCards.social.micLabel": "Talk to VYVA",
  "home.voiceCards.concierge.title": "My Concierge",
  "home.voiceCards.concierge.subtitle": "Bookings, errands and support",
  "home.voiceCards.concierge.micLabel": "Ask for help by voice",
  "home.master.cards.healthShortTitle": "My Health",
  "home.master.cards.healthDetailShort": "Check-ins, vitals, medicines",
  "home.master.cards.mindMemoryShortTitle": "Brain Power",
  "home.master.cards.mindMemoryDetailShort": "Memory, focus, calm",
  "home.master.cards.communityShortTitle": "Community",
  "home.master.cards.communityDetailShort": "Rooms and support",
  "home.master.cards.conciergeShortTitle": "Concierge",
  "home.master.cards.conciergeDetailShort": "Everyday help",
};

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      i18n: { language: "en" },
      t: (key: string, fallbackOrValues?: string | Record<string, unknown>, values?: Record<string, unknown>) => {
        const raw = labels[key] ?? (typeof fallbackOrValues === "string" ? fallbackOrValues : key);
        const interpolation = typeof fallbackOrValues === "object" ? fallbackOrValues : values;
        return raw.replace(/\{\{(\w+)\}\}/g, (_match, token) => String(interpolation?.[token] ?? `{{${token}}}`));
      },
    }),
  };
});

const HomeScreenWithModeControl = ({ menuPath }: { menuPath?: string }) => <HomeScreen menuPath={menuPath} />;

const renderHomeScreen = (props?: { menuPath?: string }) => render(<HomeScreenWithModeControl {...props} />);

const expectHomeModeControl = (
  mode: HomeInteractionMode,
  testId: "button-home-mode-touch" | "button-home-mode-voice",
  label: string,
) => {
  expect(readLatestHomeModeControl()).toMatchObject({
    label,
    mode,
    testId,
    visible: true,
  });
};

const switchHomeMode = (mode: HomeInteractionMode) => {
  act(() => {
    flushSync(() => {
      window.dispatchEvent(new CustomEvent(VYVA_HOME_MODE_CONTROL_ACTION_EVENT, {
        detail: { mode },
      }));
    });
  });
};

describe("Home fast service actions", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    guardPathMock.mockReturnValue(true);
    canUseServiceMock.mockReturnValue(true);
    voiceHeroMock.mockClear();
    voiceMock.status = "idle";
    voiceMock.isConnecting = false;
    voiceMock.sendContextUpdate.mockClear();
    profileMock.firstName = "Karim";
    profileMock.withGpContact = true;
    profileMock.serviceReadiness.hasSavedDoctor = undefined;
    profileMock.serviceReadiness.hasSavedTransportProvider = undefined;
    profileMock.serviceReadiness.hasMobilityInfo = undefined;
    profileMock.serviceReadiness.hasCoverageInfo = undefined;
    window.localStorage.clear();
    window.sessionStorage.clear();
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      return {
        data: null,
        isError: false,
        error: null,
      };
    });
  });

  afterEach(async () => {
    await act(async () => {
      await Promise.resolve();
    });
    try {
      act(() => {
        vi.runOnlyPendingTimers();
      });
    } catch {
      // Some tests use real timers; only fake-timer tests need a drain.
    }
    cleanup();
    vi.useRealTimers();
  });

  it("keeps top-level Home focused on the greeting orb and sends destinations to Menu", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T22:00:00"));
    profileMock.firstName = "karim";
    window.localStorage.setItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY, "true");

    renderHomeScreen();

    const voiceLayout = screen.getByTestId("home-master-layout");
    expect(voiceLayout).toBeInTheDocument();
    expect(voiceLayout).toHaveAttribute("data-screen-contract", "home");
    expect(voiceLayout).toHaveAttribute("data-screen-mode", "voice");
    expect(voiceLayout).toHaveAttribute("data-primary-surface", "orb");
    expect(voiceLayout).toHaveAttribute("data-cards", "hidden");
    expect(voiceLayout).toHaveAttribute("data-chips", "hidden");
    expect(voiceLayout).toHaveAttribute("data-bottom-nav-clearance", "112");
    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Good evening, Karim");
    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Touch the orb to begin.");
    expect(screen.getByTestId("button-home-hero-talk")).toHaveAccessibleName("Talk to VYVA");
    expect(screen.getByTestId("button-home-hero-talk")).not.toHaveClass("hover:-translate-y-0.5");
    expect(screen.getByTestId("home-topbar")).toBeInTheDocument();
    const actionPill = within(screen.getByTestId("home-topbar-action-pill"));
    const profileButton = screen.getByTestId("button-home-profile");
    const manualButton = actionPill.getByTestId("button-home-mode-touch");
    expect(profileButton).toHaveAccessibleName("Open profile and settings");
    expect(profileButton).toHaveClass("h-9");
    expect(profileButton).toHaveClass("w-9");
    expect(profileButton).toHaveClass("!min-h-9");
    expect(manualButton).toHaveAccessibleName("Open manual menu");
    expect(manualButton).toHaveClass("h-9");
    expect(manualButton).toHaveClass("w-9");
    expect(manualButton).toHaveClass("!min-h-9");
    expect(screen.getByTestId("home-dayline")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByTestId("button-home-mode-touch"));
    expect(guardPathMock).toHaveBeenCalledWith("/menu", undefined);
    fireEvent.click(screen.getByTestId("button-home-profile"));
    const profileMenu = screen.getByTestId("home-profile-menu");
    expect(profileMenu).toBeInTheDocument();
    expect(profileMenu).toHaveTextContent("Profile & settings");
    expect(profileMenu).toHaveClass("md:max-w-[720px]");
    expect(profileMenu).toHaveClass("md:top-1/2");
    expect(profileMenu).toHaveClass("md:-translate-y-1/2");
    expect(screen.getByTestId("home-profile-menu-links")).toHaveClass("md:grid-cols-2");
    expect(screen.getByTestId("button-home-profile-menu-backdrop")).toHaveClass("md:backdrop-blur-[3px]");
    expect(screen.getByTestId("button-home-profile-account")).toHaveTextContent("Account details");
    expect(screen.getByTestId("button-home-profile-health")).toHaveTextContent("Health profile");
    expect(screen.getByTestId("button-home-profile-medications")).toHaveTextContent("My Medication");
    expect(screen.getByTestId("button-home-profile-emergency")).toHaveTextContent("Emergency contact");
    expect(screen.getByTestId("button-home-profile-care-team")).toHaveTextContent("Care team");
    expect(screen.getByTestId("button-home-profile-providers")).toHaveTextContent("Doctors & providers");
    fireEvent.click(screen.getByTestId("button-home-profile-account"));
    expect(guardPathMock).toHaveBeenCalledWith("/settings/account", undefined);
    expect(screen.getByTestId("home-dormant-zamora-orb")).toBeInTheDocument();
    expectHomeModeControl("voice", "button-home-mode-touch", "Switch to touch");
    expect(screen.queryByTestId("home-pillar-cards")).not.toBeInTheDocument();
    switchHomeMode("touch");
    const touchLayout = screen.getByTestId("home-master-layout");
    expect(touchLayout).toHaveAttribute("data-screen-mode", "touch");
    expect(touchLayout).toHaveAttribute("data-primary-surface", "orb");
    expect(touchLayout).toHaveAttribute("data-cards", "hidden");
    expect(touchLayout).toHaveAttribute("data-chips", "hidden");
    expect(touchLayout).toHaveAttribute("data-heading-detail", "visible");
    expect(screen.getByTestId("home-master-hero")).toBeInTheDocument();
    expect(screen.getByTestId("button-home-hero-talk")).toBeInTheDocument();
    expect(screen.getByTestId("home-dormant-zamora-orb")).toBeInTheDocument();
    expectHomeModeControl("touch", "button-home-mode-voice", "Switch to voice");
    expect(actionPill.getByTestId("button-home-mode-touch")).toHaveAccessibleName("Open manual menu");
    expect(screen.queryByTestId("home-touch-subheading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-gentle-routine-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-start-gentle-routine")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-browse-gentle-exercises")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-pillar-cards")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-health")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-cognitive")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-social")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-concierge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-meds")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-doctor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-start-nudge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-fast-help")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-fast-feel-better")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-master-start-nudge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-start-nudge-voice")).not.toBeInTheDocument();
  });

  it("routes the topbar hand control to the manual Menu instead of changing modes", () => {
    window.localStorage.setItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY, "true");
    renderHomeScreen();

    const actionPill = within(screen.getByTestId("home-topbar-action-pill"));
    fireEvent.click(actionPill.getByTestId("button-home-mode-touch"));

    expect(screen.getByTestId("home-master-layout")).toHaveAttribute("data-screen-mode", "voice");
    expect(guardPathMock).toHaveBeenCalledWith("/menu", undefined);
    expect(guardPathMock).not.toHaveBeenCalledWith("/login", expect.anything());
    expect(guardPathMock).not.toHaveBeenCalledWith("/settings/account", expect.anything());
    expect(guardPathMock).not.toHaveBeenCalledWith("/", expect.anything());
  });

  it("can route the topbar menu button to the public preview menu without changing production default", () => {
    window.localStorage.setItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY, "true");
    renderHomeScreen({ menuPath: "/dev/home-master/menu" });

    fireEvent.click(screen.getByTestId("button-home-mode-touch"));

    expect(guardPathMock).toHaveBeenCalledWith("/dev/home-master/menu", undefined);
    expect(guardPathMock).not.toHaveBeenCalledWith("/login", expect.anything());
  });

  it("uses the existing profile editors from the Home profile menu", () => {
    window.localStorage.setItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY, "true");
    renderHomeScreen();

    const openProfileMenu = () => fireEvent.click(screen.getByTestId("button-home-profile"));
    const expectProfileRoute = (testId: string, path: string) => {
      guardPathMock.mockClear();
      openProfileMenu();
      fireEvent.click(screen.getByTestId(testId));
      expect(guardPathMock).toHaveBeenCalledWith(path, undefined);
    };

    expectProfileRoute("button-home-profile-account", "/settings/account");
    expectProfileRoute("button-home-profile-health", "/onboarding/profile/health");
    expectProfileRoute("button-home-profile-medications", "/onboarding/profile/medications");
    expectProfileRoute("button-home-profile-emergency", "/onboarding/profile/emergency");
    expectProfileRoute("button-home-profile-care-team", "/onboarding/profile/care-team");
    expectProfileRoute("button-home-profile-providers", "/onboarding/profile/providers");

    openProfileMenu();
    expect(screen.getByTestId("button-home-profile-text-size")).toHaveTextContent("Text size");
    expect(screen.getByTestId("button-home-profile-theme")).toHaveTextContent("Theme");
    expect(screen.getByTestId("button-home-profile-mode")).toHaveTextContent("Mode");
  });

  it("shows the next display preference target instead of the current state", () => {
    window.localStorage.setItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY, "true");
    renderHomeScreen();

    fireEvent.click(screen.getByTestId("button-home-profile"));

    const textSizeButton = screen.getByTestId("button-home-profile-text-size");
    const themeButton = screen.getByTestId("button-home-profile-theme");
    const modeButton = screen.getByTestId("button-home-profile-mode");

    // Defaults are large text, dark theme, and voice mode, so each tile offers the opposite action.
    expect(textSizeButton).toHaveTextContent("Normal");
    expect(textSizeButton).not.toHaveTextContent("Large");
    expect(themeButton).toHaveTextContent("Light");
    expect(themeButton).not.toHaveTextContent("Dark");
    expect(modeButton).toHaveTextContent("Touch");
    expect(modeButton).not.toHaveTextContent("Voice");

    fireEvent.click(textSizeButton);
    fireEvent.click(themeButton);

    expect(textSizeButton).toHaveTextContent("Large");
    expect(textSizeButton).not.toHaveTextContent("Normal");
    expect(themeButton).toHaveTextContent("Dark");
    expect(themeButton).not.toHaveTextContent("Light");
    expect(modeButton).toHaveTextContent("Touch");
    expect(modeButton).not.toHaveTextContent("Voice");
  });

  it("opens the manual Menu when the profile settings mode target is Touch", () => {
    window.localStorage.setItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY, "true");
    renderHomeScreen({ menuPath: "/dev/home-master/menu" });

    fireEvent.click(screen.getByTestId("button-home-profile"));
    const modeButton = screen.getByTestId("button-home-profile-mode");

    expect(modeButton).toHaveTextContent("Touch");

    fireEvent.click(modeButton);

    expect(guardPathMock).toHaveBeenCalledWith("/dev/home-master/menu", undefined);
    expect(screen.queryByTestId("home-profile-menu")).not.toBeInTheDocument();
  });

  it("returns the profile settings mode target to Voice after touch mode is active", () => {
    window.localStorage.setItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY, "true");
    window.localStorage.setItem("vyva:home-interaction-mode:v1", "touch");
    renderHomeScreen();

    fireEvent.click(screen.getByTestId("button-home-profile"));
    const modeButton = screen.getByTestId("button-home-profile-mode");

    expect(modeButton).toHaveTextContent("Voice");
    expect(modeButton).not.toHaveTextContent("Touch");

    fireEvent.click(modeButton);

    expect(guardPathMock).not.toHaveBeenCalledWith("/menu", expect.anything());
    expect(screen.queryByTestId("home-profile-menu")).not.toBeInTheDocument();
  });

  it("keeps top-level Home on the greeting orb after switching to touch mode", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T22:00:00"));
    profileMock.firstName = "karim";
    window.localStorage.setItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY, "true");

    renderHomeScreen();

    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Good evening, Karim");
    expect(screen.getByTestId("button-home-hero-talk")).toHaveAccessibleName("Talk to VYVA");
    expect(screen.getByTestId("home-dormant-zamora-orb")).toBeInTheDocument();
    expectHomeModeControl("voice", "button-home-mode-touch", "Switch to touch");
    expect(screen.queryByTestId("home-pillar-cards")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-fast-help")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-master-start-nudge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-health")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-cognitive")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-social")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-concierge")).not.toBeInTheDocument();
    expect(screen.queryByText("VYVA understood")).not.toBeInTheDocument();

    switchHomeMode("touch");

    expect(screen.getByTestId("home-master-hero")).toBeInTheDocument();
    expectHomeModeControl("touch", "button-home-mode-voice", "Switch to voice");
    expect(screen.queryByTestId("home-pillar-cards")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-health")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-cognitive")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-social")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-concierge")).not.toBeInTheDocument();
  });

  it("keeps voice mode on the orb cue after activation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T10:00:00"));

    renderHomeScreen();

    expect(screen.getByTestId("home-master-hero-subtitle")).toHaveTextContent("Touch the orb to begin.");

    fireEvent.click(screen.getByTestId("button-home-hero-talk"));

    expect(screen.getByTestId("home-master-hero-subtitle")).toHaveTextContent("Touch the orb to begin.");
  });

  it("keeps live-signal pillar cards out of top-level Home", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/meds/adherence-report") {
        return { data: { todaySummary: { scheduled: 4, remaining: 2 } }, isError: false, error: null };
      }
      if (key === "/api/games/progress") {
        return { data: { summary: { completedSessions: 8, streakDays: 4 }, today: { completedCount: 0 } }, isError: false, error: null };
      }
      if (typeof key === "string" && key.startsWith("/api/social/participate/pulse")) {
        return {
          data: {
            pulse: {
              featuredEvent: { format: "nearby" },
              notifications: [],
              savedEvents: [{ id: "one" }, { id: "two" }],
            },
          },
          isError: false,
          error: null,
        };
      }
      if (key === "/api/concierge/actions/pending") {
        return { data: { items: [{ id: "one" }, { id: "two" }] }, isError: false, error: null };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();
    switchHomeMode("touch");

    expect(screen.queryByTestId("home-pillar-cards")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-health")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-cognitive")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-social")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-agent-concierge")).not.toBeInTheDocument();
  });

  it("keeps timely schedule nudges out of the voice surface until touch mode", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/meds/adherence-report") {
        return {
          data: { todaySummary: { scheduled: 1, remaining: 1 }, nextDose: { name: "Monoprost", minutesUntil: 25 } },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Touch the orb to begin.");
    expect(screen.getByTestId("home-master-hero")).not.toHaveTextContent("Monoprost");
    expect(screen.queryByTestId("button-home-context-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-context-dismiss")).not.toBeInTheDocument();

    switchHomeMode("touch");

    expect(screen.queryByTestId("home-touch-subheading")).not.toBeInTheDocument();
  });

  it("quietly updates an active voice session when the selected Home message changes", () => {
    let medicineData: unknown = null;
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/meds/adherence-report") {
        return { data: medicineData, isError: false, error: null };
      }
      return { data: null, isError: false, error: null };
    });

    voiceMock.status = "connecting";
    voiceMock.isConnecting = true;
    const view = renderHomeScreen();

    voiceMock.status = "connected";
    voiceMock.isConnecting = false;
    view.rerender(<HomeScreenWithModeControl />);
    expect(voiceMock.sendContextUpdate).not.toHaveBeenCalled();

    medicineData = {
      todaySummary: { scheduled: 1, remaining: 1 },
      nextDose: { name: "Monoprost", minutesUntil: 25 },
    };
    view.rerender(<HomeScreenWithModeControl />);

    expect(voiceMock.sendContextUpdate).toHaveBeenCalledTimes(1);
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledWith(
      expect.stringContaining("Monoprost"),
    );

    view.rerender(<HomeScreenWithModeControl />);
    expect(voiceMock.sendContextUpdate).toHaveBeenCalledTimes(1);
  });

  it("opens the hidden Home context when the user gives a short voice reply", () => {
    voiceMock.status = "connected";
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/meds/adherence-report") {
        return {
          data: { todaySummary: { scheduled: 1, remaining: 1 }, nextDose: { name: "Monoprost", minutesUntil: 25 } },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();
    expect(screen.getByTestId("home-master-hero")).not.toHaveTextContent("Monoprost");
    expect(screen.queryByTestId("button-home-context-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-context-dismiss")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: { text: "Show me" },
      }));
    });

    expect(guardPathMock).toHaveBeenCalledWith("/meds", { state: undefined });
    const history = JSON.parse(
      window.localStorage.getItem(HOME_CONTEXT_ACTION_HISTORY_KEY) ?? "{}",
    ) as HomeContextMessageActionHistory;
    expect(history["dose:Monoprost"]).toMatchObject({
      action: "opened",
      source: "voice",
    });
  });

  it("defers the visible Home message from the canonical voice tool result", () => {
    voiceMock.status = "connected";
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/meds/adherence-report") {
        return {
          data: { todaySummary: { scheduled: 1, remaining: 1 }, nextDose: { name: "Monoprost", minutesUntil: 25 } },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();
    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_APP_ACTION_RESULT_EVENT, {
        detail: {
          action: "dismissed",
          actionId: "dose:Monoprost",
          reason: "User said later",
        },
      }));
    });

    expect(screen.getByTestId("home-master-hero")).not.toHaveTextContent("Monoprost");
    const history = JSON.parse(
      window.localStorage.getItem(HOME_CONTEXT_ACTION_HISTORY_KEY) ?? "{}",
    ) as HomeContextMessageActionHistory;
    expect(history["dose:Monoprost"]).toMatchObject({
      action: "deferred",
      source: "voice_tool",
    });
  });

  it("keeps the master home free of legacy fast help and resume blocks", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "ride-1",
              use_case: "book_ride",
              status: "pending",
              provider_name: "Radio Taxi",
              action_summary: "Ready to confirm.",
              action_payload: null,
            }],
          },
          isError: false,
          error: null,
        };
      }
      if (key === "/api/concierge/actions/sessions") {
        return {
          data: {
            items: [{
              id: "session-ride",
              pending_id: "old-ride",
              use_case: "book_ride",
              provider_name: "Radio Taxi",
              outcome: "completed",
              outcome_summary: "Ride saved with Radio Taxi.",
              completed_at: "2026-08-04T09:30:00.000Z",
              outcome_payload: {},
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    window.localStorage.setItem(SHOW_VYVA_REVIEW_HISTORY_KEY, JSON.stringify([{
      id: "review-unresolved",
      reviewedAt: "2026-07-19T10:00:00.000Z",
      useCaseId: "provider_or_deal",
      followUpContext: "provider_deal",
      inputType: "company_name",
      source: "paste_text",
      summary: "Possible overcharging in a service quote.",
      decision: "Check before agreeing",
      confidenceLabel: "Needs review",
      actionSaved: false,
      savedActionLabel: null,
      resumeRoute: "/scam-guard",
    }]));

    renderHomeScreen();

    expect(screen.queryByTestId("home-fast-help")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-concierge-resume")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-concierge-reuse")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-show-vyva-review-resume")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-start-nudge")).not.toBeInTheDocument();
  });

  it.skip("counts only active Concierge tasks on the Home badge", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [
              {
                id: "done-ride",
                use_case: "book_ride",
                status: "completed",
                provider_name: "Old Taxi",
                action_summary: "Completed ride.",
                action_payload: null,
              },
              {
                id: "cancelled-admin",
                use_case: "admin_task",
                status: "cancelled",
                provider_name: "VYVA review",
                action_summary: "Cancelled task.",
                action_payload: null,
              },
              {
                id: "active-service",
                use_case: "home_service",
                status: "calling",
                provider_name: "Saved Plumber",
                action_summary: "VYVA is contacting Saved Plumber.",
                action_payload: { mission_status: "awaiting_provider_reply" },
              },
            ],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    expect(screen.queryByTestId("card-home-agent-concierge")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-home-concierge-resume")).toHaveTextContent("Waiting for Saved Plumber");
    expect(screen.queryByText("Old Taxi")).not.toBeInTheDocument();
  });

  it.skip("surfaces a pending Concierge task until the user confirms it", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "ride-1",
              use_case: "book_ride",
              status: "pending",
              provider_name: "Radio Taxi",
              action_summary: "Ready to confirm.",
              action_payload: null,
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    const nudge = screen.getByTestId("card-home-concierge-resume");
    expect(nudge).toHaveTextContent("Ready to review");
    expect(nudge).toHaveTextContent("Review your ride");
    expect(screen.getByTestId("text-home-concierge-state-explanation")).toHaveTextContent("Check the summary before VYVA moves ahead with the ride.");
    expect(nudge).toHaveTextContent("Nothing is called, sent, booked, or shared before you confirm.");
    expect(screen.getByTestId("button-home-concierge-open")).toHaveTextContent("Open");
    expect(screen.queryByTestId("button-home-concierge-follow-up")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-concierge-got-reply")).not.toBeInTheDocument();

    expect(screen.queryByTestId("home-fast-help")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-fast-concierge-status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-home-concierge-open"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/ride-1", { state: { focusRightNow: true, conciergePendingId: "ride-1" } });
  });

  it.skip("selects the actionable form instead of the first passive provider wait", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "waiting-ride",
              use_case: "book_ride",
              status: "calling",
              provider_name: "Radio Taxi",
              confirmed_at: "2026-07-17T13:00:00.000Z",
              action_payload: { mission_status: "awaiting_provider_reply" },
            }, {
              id: "insurance-form",
              use_case: "admin_task",
              status: "pending",
              provider_name: "VYVA review",
              confirmed_at: "2026-07-17T10:00:00.000Z",
              action_payload: { mission_status: "preparing_form" },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    const card = screen.getByTestId("card-home-concierge-resume");
    expect(card).toHaveAttribute("data-resume-kind", "form");
    expect(card).toHaveTextContent("Review your admin task");
    expect(card).toHaveTextContent("Nothing is called, sent, booked, or shared before you confirm.");
    expect(card).not.toHaveTextContent("Radio Taxi");
    expect(screen.queryByTestId("card-home-fast-help-recovery")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-home-concierge-open"));
    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/insurance-form", {
      state: { focusRightNow: true, conciergePendingId: "insurance-form" },
    });
  });

  it.skip("selects a provider setup blocker before a newer booking", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "newer-booking",
              use_case: "book_appointment",
              status: "pending",
              confirmed_at: "2026-07-17T13:00:00.000Z",
              action_payload: {},
            }, {
              id: "provider-setup",
              use_case: "find_provider",
              status: "pending",
              confirmed_at: "2026-07-16T13:00:00.000Z",
              action_payload: {
                retry_blocker: "adapter_payload_missing_provider_contact",
                setup_focus: "doctor_clinic",
              },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    expect(screen.getByTestId("card-home-concierge-resume")).toHaveAttribute("data-resume-kind", "provider_setup");
    fireEvent.click(screen.getByTestId("button-home-concierge-open"));
    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/provider-setup", {
      state: { focusRightNow: true, conciergePendingId: "provider-setup" },
    });
  });

  it.skip("surfaces saved Show VYVA tasks as prepared work from Home", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "show-vyva-scam-1",
              use_case: "scam_check",
              status: "pending",
              provider_name: "Trusted contact",
              action_summary: "Ask before replying to this bank message.",
              action_payload: {
                show_vyva_action_id: "call_trusted_contact",
                show_vyva_follow_up_context: "scam",
                show_vyva_source: "paste_text",
                source_route: "/scam-guard",
                review_summary: "Suspicious bank message",
                requested_tool: "phone_call",
                confirmation_required_before_action: true,
                no_external_action_without_confirmation: true,
                executor_version: 1,
              },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    const nudge = screen.getByTestId("card-home-concierge-resume");
    expect(nudge).toHaveTextContent("VYVA prepared this");
    expect(nudge).toHaveTextContent("Scam Guard");
    expect(nudge).toHaveTextContent("Call");
    expect(nudge).toHaveTextContent("Suspicious bank message");
    expect(screen.queryByTestId("button-home-fast-concierge-status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-home-concierge-open"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/show-vyva-scam-1", { state: { focusRightNow: true, conciergePendingId: "show-vyva-scam-1" } });
  });

  it.skip("surfaces the latest unresolved Show VYVA review from Home without exposing raw reviewed content", () => {
    window.localStorage.setItem(SHOW_VYVA_REVIEW_HISTORY_KEY, JSON.stringify([
      {
        id: "review-unresolved",
        reviewedAt: "2026-07-19T10:00:00.000Z",
        useCaseId: "provider_or_deal",
        followUpContext: "provider_deal",
        inputType: "company_name",
        source: "paste_text",
        summary: "Possible overcharging in a service quote.",
        decision: "Check before agreeing",
        confidenceLabel: "Needs review",
        actionSaved: false,
        savedActionLabel: null,
        resumeRoute: "/scam-guard",
      },
      {
        id: "review-saved",
        reviewedAt: "2026-07-18T10:00:00.000Z",
        useCaseId: "scam_check",
        followUpContext: "scam",
        inputType: "phone_number",
        source: "paste_text",
        summary: "Suspicious phone number.",
        decision: "Do not call back yet",
        confidenceLabel: "Clear risk",
        actionSaved: true,
        savedActionLabel: "Block or report",
        resumeRoute: "/scam-guard",
      },
    ]));

    renderHomeScreen();

    const nudge = screen.getByTestId("card-home-show-vyva-review-resume");
    expect(nudge).toHaveTextContent("Recent Show VYVA");
    expect(nudge).toHaveTextContent("Continue this review");
    expect(nudge).toHaveTextContent("Check before agreeing");
    expect(nudge).toHaveTextContent("Possible overcharging in a service quote.");
    expect(nudge).not.toHaveTextContent("+34 600 111 222");

    fireEvent.click(nudge);

    expect(guardPathMock).toHaveBeenCalledWith("/scam-guard", {
      state: {
        showVyvaReviewHistoryId: "review-unresolved",
        showVyvaResume: true,
      },
    });
  });

  it.skip("surfaces a saved provider shortlist and opens the exact Concierge task", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "shortlist-7",
              use_case: "find_provider",
              status: "pending",
              provider_name: "Harbour Clinic",
              action_summary: "Two provider options saved.",
              action_payload: {
                task_type: "provider_shortlist",
                selected_provider_names: ["Harbour Clinic", "Garden Care"],
              },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    expect(screen.getByTestId("card-home-concierge-resume")).toHaveTextContent("Saved shortlist");
    expect(screen.getByTestId("card-home-concierge-resume")).toHaveTextContent("Review your saved options");
    expect(screen.getByTestId("card-home-concierge-resume")).toHaveTextContent("Review saved options");
    expect(screen.getByTestId("card-home-concierge-resume")).toHaveAttribute("data-resume-kind", "provider_shortlist");

    fireEvent.click(screen.getByTestId("button-home-concierge-open"));
    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/shortlist-7", {
      state: { focusRightNow: true, conciergePendingId: "shortlist-7" },
    });
  });

  it.skip("labels home-service appointment tasks as home service on Home", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "service-1",
              use_case: "book_appointment",
              status: "pending",
              provider_name: "Saved Plumber",
              action_summary: "VYVA is preparing a plumber visit.",
              action_payload: {
                appointment_type: "home-service",
                mission_status: "awaiting_user_save",
              },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    const nudge = screen.getByTestId("card-home-concierge-resume");
    expect(nudge).toHaveTextContent("Review your home service");
    expect(nudge).toHaveTextContent("Ready to review");
    expect(nudge).toHaveAttribute("data-resume-kind", "booking");
  });

  it.skip("labels admin and safety concierge tasks instead of generic requests", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "admin-1",
              use_case: "admin_task",
              status: "pending",
              provider_name: "VYVA review",
              action_summary: "Paperwork task prepared.",
              action_payload: { flow_reference: "FLOW_INSURANCE_ADMIN", execution_channel: "manual" },
            }],
          },
          isError: false,
          error: null,
        };
      }
      if (key === "/api/concierge/actions/sessions") {
        return {
          data: {
            items: [{
              id: "scam-session-1",
              pending_id: "scam-1",
              use_case: "scam_check",
              provider_name: "VYVA review",
              outcome: "completed",
              outcome_summary: "Safety review completed.",
              completed_at: "2026-08-04T09:30:00.000Z",
              outcome_payload: { flow_reference: "FLOW_SCAM_CHECK" },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    expect(screen.getByTestId("card-home-concierge-resume")).toHaveTextContent("Review your admin task");
    expect(screen.getByTestId("card-home-concierge-resume")).toHaveTextContent("Nothing is called, sent, booked, or shared before you confirm.");
    expect(screen.getByTestId("card-home-concierge-resume")).toHaveAttribute("data-resume-kind", "form");
    expect(screen.queryByTestId("button-home-fast-concierge-status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-concierge-reuse")).not.toBeInTheDocument();
  });

  it.skip("surfaces completed Concierge tasks as reusable templates from Home", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/sessions") {
        return {
          data: {
            items: [{
              id: "session-ride",
              pending_id: "old-ride",
              use_case: "book_ride",
              provider_name: "Radio Taxi",
              outcome: "completed",
              outcome_summary: "Ride saved with Radio Taxi.",
              completed_at: "2026-08-04T09:30:00.000Z",
              outcome_payload: {
                provider_phone: "+34 612 345 678",
                pickup_address: "Saved home",
                destination_address: "City Clinic",
                requested_time: "tomorrow 09:00",
              },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    const card = screen.getByTestId("card-home-concierge-reuse");
    expect(card).toHaveTextContent("Useful again");
    expect(screen.getByTestId("badge-home-concierge-completed-state")).toHaveTextContent("Completed");
    expect(screen.getByTestId("text-home-concierge-reuse-explanation")).toHaveTextContent("saved");
    expect(card).toHaveTextContent("Use last ride again");
    expect(card).toHaveTextContent("Radio Taxi");
    expect(screen.getByTestId("text-home-concierge-receipt-status")).toHaveTextContent("Receipt: Completed");

    fireEvent.click(screen.getByTestId("button-home-concierge-show-receipt"));
    expect(screen.getByTestId("panel-home-concierge-receipt-details")).toHaveTextContent("Ride saved with Radio Taxi.");
    expect(screen.getByTestId("panel-home-concierge-receipt-details")).toHaveTextContent("You can review this receipt");
    expect(screen.getByTestId("panel-home-concierge-receipt-details")).toHaveTextContent("City Clinic");

    fireEvent.click(screen.getByTestId("button-home-concierge-use-template"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge", {
      state: {
        conciergeCompletedTemplate: expect.objectContaining({
          id: "session-ride",
          use_case: "book_ride",
          provider_name: "Radio Taxi",
          outcome_payload: expect.objectContaining({
            destination_address: "City Clinic",
            requested_time: "tomorrow 09:00",
          }),
        }),
      },
    });
  });

  it.skip("surfaces an in-progress Concierge task and opens Right Now", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "ride-1",
              use_case: "book_ride",
              status: "calling",
              provider_name: "Radio Taxi",
              action_summary: "VYVA is contacting Radio Taxi.",
              action_payload: {
                mission_status: "awaiting_provider_reply",
                live_handoff_status: "waiting",
                provider_waiting_since: new Date(Date.now() - (30 * 60_000) - 1_000).toISOString(),
              },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    const nudge = screen.getByTestId("card-home-concierge-resume");
    expect(nudge).toHaveTextContent("Waiting");
    expect(nudge).toHaveTextContent("Waiting for Radio Taxi");
    expect(nudge).toHaveTextContent("30 min waiting");
    expect(screen.getByTestId("button-home-concierge-open")).toHaveTextContent("Open");
    expect(screen.getByTestId("button-home-concierge-follow-up")).toHaveTextContent("Follow up");
    expect(screen.getByTestId("button-home-concierge-got-reply")).toHaveTextContent("I got a reply");
    expect(screen.queryByTestId("button-home-fast-concierge-status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-fast-help")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-fast-book-ride")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-fast-feel-better")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-fast-safe-home")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-home-concierge-open"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/ride-1", { state: { focusRightNow: true, conciergePendingId: "ride-1" } });

    fireEvent.click(screen.getByTestId("button-home-concierge-follow-up"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/ride-1", {
      state: {
        focusRightNow: true,
        conciergeProviderAction: {
          pendingId: "ride-1",
          mode: "follow_up",
        },
      },
    });

    fireEvent.click(screen.getByTestId("button-home-concierge-got-reply"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/ride-1", {
      state: {
        focusRightNow: true,
        conciergeProviderAction: {
          pendingId: "ride-1",
          mode: "reply",
        },
      },
    });
  });

  it("does not render the legacy Home chat nudge", () => {
    renderHomeScreen();

    expect(screen.queryByTestId("home-start-nudge")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-home-hero-talk")).toHaveAccessibleName("Talk to VYVA");
    expect(guardPathMock).not.toHaveBeenCalledWith("/chat", undefined);
  });

  it.skip("renders three contextual Fast help actions that stay stable throughout the day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T08:00:00.000Z"));
    renderHomeScreen();

    const fastHelp = screen.getByTestId("home-fast-help");
    expect(fastHelp).toHaveTextContent("Fast help");
    const initialActions = within(fastHelp).getAllByRole("button").map((button) => button.dataset.testid);
    expect(initialActions).toHaveLength(3);
    expect(screen.getByTestId("button-home-fast-feel-better")).toHaveTextContent("Ask Dr. AI");
    expect(screen.getByTestId("button-home-fast-stay-well")).toHaveTextContent("Age Well");
    expect(screen.getByTestId("button-home-fast-find-care")).toHaveTextContent("Find Care");
    const initialImpressions = JSON.parse(
      window.localStorage.getItem("vyva:home-fast-help-impressions:v1:profile-home") ?? "[]",
    );
    expect(initialImpressions).toHaveLength(1);
    expect(initialImpressions[0]).toMatchObject({
      actionIds: initialActions.map((testId) => testId?.replace("button-home-fast-", "")),
      rankingVersion: "personalized-v1",
    });
    expect(Object.keys(initialImpressions[0]).sort()).toEqual(["actionIds", "id", "rankingVersion", "shownAt"]);

    act(() => {
      vi.setSystemTime(new Date("2026-07-17T20:00:00.000Z"));
      vi.advanceTimersByTime(60_000);
    });

    expect(within(fastHelp).getAllByRole("button").map((button) => button.dataset.testid)).toEqual(initialActions);
    expect(JSON.parse(
      window.localStorage.getItem("vyva:home-fast-help-impressions:v1:profile-home") ?? "[]",
    )).toHaveLength(1);
  });

  it.skip("opens Find Care as a structured Concierge provider search", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    renderHomeScreen();

    fireEvent.click(screen.getByTestId("button-home-fast-find-care"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge", expect.objectContaining({
      state: expect.objectContaining({
        conciergePrefill: expect.objectContaining({
          kind: "task",
          flowReference: "FLOW_CARE_NAVIGATION",
          requestedTool: "operator_review",
          actionLabel: "Prepare care search",
          useCase: "find_provider",
          source: "home_quick_action",
        }),
        homeFastHelpContext: expect.objectContaining({
          actionId: "find-care",
          destinationPath: "/concierge",
        }),
      }),
    }));
    expect(JSON.parse(
      window.localStorage.getItem("vyva:home-fast-help-history:v1:profile-home") ?? "[]",
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionId: "find-care", status: "used" }),
    ]));
    const impressions = JSON.parse(
      window.localStorage.getItem("vyva:home-fast-help-impressions:v1:profile-home") ?? "[]",
    );
    const journeys = JSON.parse(
      window.localStorage.getItem("vyva:home-fast-help-journeys:v1:profile-home") ?? "[]",
    );
    expect(journeys[0]).toMatchObject({ actionId: "find-care" });
    const attributedImpression = impressions.find((impression: { id: string }) => (
      impression.id === journeys[0].impressionId
    ));
    expect(attributedImpression).toBeDefined();
    expect(attributedImpression.actionIds).toContain("find-care");
  });

  it.skip("shows one calm recovery nudge after the cooldown and resumes the exact journey", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    const started = startHomeFastHelpJourney({
      actionId: "find-care",
      destinationPath: "/concierge",
      destinationState: { conciergePrefill: { useCase: "find_provider" } },
      profileId: profileMock.profileId,
      occurredAtMs: Date.now() - 13 * 60 * 60 * 1000,
    });
    markHomeFastHelpJourney(started.context, "abandoned", {
      occurredAtMs: Date.now() - 13 * 60 * 60 * 1000 + 30_000,
      reason: "returned_home",
    });

    renderHomeScreen();

    const recovery = screen.getByTestId("card-home-fast-help-recovery");
    expect(recovery).toHaveTextContent("Continue where you left off");
    expect(recovery).toHaveTextContent("Continue Find Care when you are ready.");
    fireEvent.click(screen.getByTestId("button-home-fast-help-recovery-continue"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge", {
      state: expect.objectContaining({
        conciergePrefill: { useCase: "find_provider" },
        homeFastHelpContext: expect.objectContaining({
          journeyId: started.journey.id,
          actionId: "find-care",
        }),
      }),
    });
  });

  it.skip("shows one actionable Fast Help recovery instead of a passive Concierge wait", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    const started = startHomeFastHelpJourney({
      actionId: "paperwork-help",
      destinationPath: "/concierge",
      destinationState: { conciergePrefill: { useCase: "admin_task" } },
      profileId: profileMock.profileId,
      occurredAtMs: Date.now() - 13 * 60 * 60 * 1000,
    });
    markHomeFastHelpJourney(started.context, "abandoned", {
      occurredAtMs: Date.now() - 13 * 60 * 60 * 1000 + 30_000,
      reason: "returned_home",
    });
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "waiting-provider",
              use_case: "home_service",
              status: "calling",
              provider_name: "Saved Plumber",
              action_payload: { mission_status: "awaiting_provider_reply" },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    expect(screen.getByTestId("card-home-fast-help-recovery")).toHaveAttribute("data-resume-kind", "fast_help");
    expect(screen.queryByTestId("card-home-concierge-resume")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-concierge-reuse")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-fast-paperwork-help")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-home-fast-help-recovery-continue"));
    expect(guardPathMock).toHaveBeenCalledWith("/concierge", {
      state: expect.objectContaining({
        conciergePrefill: { useCase: "admin_task" },
        homeFastHelpContext: expect.objectContaining({ journeyId: started.journey.id }),
      }),
    });
  });

  it.skip("resumes a journey opened on another device with locally derived safe instructions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    const storageKey = homeFastHelpJourneyStorageKey(profileMock.profileId);
    mergeSyncedHomeFastHelpJourneys(storageKey, [{
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actionId: "book-ride",
      status: "abandoned",
      startedAt: "2026-07-16T23:00:00.000Z",
      updatedAt: "2026-07-16T23:01:00.000Z",
      referenceId: null,
      events: [{
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "opened",
        occurredAt: "2026-07-16T23:00:00.000Z",
        referenceId: null,
      }, {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "abandoned",
        occurredAt: "2026-07-16T23:01:00.000Z",
        referenceId: null,
      }],
    }]);

    renderHomeScreen();
    fireEvent.click(screen.getByTestId("button-home-fast-help-recovery-continue"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge", {
      state: expect.objectContaining({
        conciergePrefill: expect.objectContaining({
          kind: "ride",
          flowReference: "FLOW_TRANSPORT_BOOKING",
          source: "home_quick_action",
        }),
        homeFastHelpContext: expect.objectContaining({
          journeyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          actionId: "book-ride",
        }),
      }),
    });
  });

  it.skip("suppresses a blocked choice and explains the useful alternative", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    const started = startHomeFastHelpJourney({
      actionId: "find-care",
      destinationPath: "/concierge",
      profileId: profileMock.profileId,
      occurredAtMs: Date.now() - 60_000,
    });
    markHomeFastHelpJourney(started.context, "blocked", {
      occurredAtMs: Date.now() - 30_000,
      reason: "service_not_ready",
    });

    renderHomeScreen();

    expect(screen.queryByTestId("button-home-fast-find-care")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-home-fast-help-recovery")).toHaveTextContent("One quick step first");
    expect(screen.getByTestId("home-fast-help")).toHaveTextContent("Try this useful next step instead");
  });

  it.skip("defers a recovery nudge and respects the cooldown", () => {
    vi.useFakeTimers();
    const now = new Date("2026-07-17T14:00:00.000Z");
    vi.setSystemTime(now);
    const started = startHomeFastHelpJourney({
      actionId: "paperwork-help",
      destinationPath: "/concierge",
      profileId: profileMock.profileId,
      occurredAtMs: now.getTime() - 13 * 60 * 60 * 1000,
    });
    markHomeFastHelpJourney(started.context, "abandoned", {
      occurredAtMs: now.getTime() - 13 * 60 * 60 * 1000 + 30_000,
    });

    const first = renderHomeScreen();
    fireEvent.click(screen.getByTestId("button-home-fast-help-recovery-later"));
    expect(screen.queryByTestId("card-home-fast-help-recovery")).not.toBeInTheDocument();
    first.unmount();

    vi.setSystemTime(new Date(now.getTime() + 11 * 60 * 60 * 1000));
    const beforeCooldown = renderHomeScreen();
    expect(screen.queryByTestId("card-home-fast-help-recovery")).not.toBeInTheDocument();
    beforeCooldown.unmount();

    vi.setSystemTime(new Date(now.getTime() + 13 * 60 * 60 * 1000));
    renderHomeScreen();
    expect(screen.getByTestId("card-home-fast-help-recovery")).toHaveTextContent("Continue where you left off");
  });

  it.skip("dismisses a recovery nudge permanently", () => {
    vi.useFakeTimers();
    const now = new Date("2026-07-17T14:00:00.000Z");
    vi.setSystemTime(now);
    const started = startHomeFastHelpJourney({
      actionId: "stay-well",
      destinationPath: "/health/prevention",
      profileId: profileMock.profileId,
      occurredAtMs: now.getTime() - 13 * 60 * 60 * 1000,
    });
    markHomeFastHelpJourney(started.context, "abandoned", {
      occurredAtMs: now.getTime() - 13 * 60 * 60 * 1000 + 30_000,
    });

    const first = renderHomeScreen();
    fireEvent.click(screen.getByTestId("button-home-fast-help-recovery-dismiss"));
    expect(screen.queryByTestId("card-home-fast-help-recovery")).not.toBeInTheDocument();
    first.unmount();

    vi.setSystemTime(new Date("2026-07-25T14:00:00.000Z"));
    renderHomeScreen();
    expect(screen.queryByTestId("card-home-fast-help-recovery")).not.toBeInTheDocument();
  });

  it.skip("routes a blocked ride to focused transport setup and preserves its return context", () => {
    vi.useFakeTimers();
    const now = new Date("2026-07-17T14:00:00.000Z");
    vi.setSystemTime(now);
    profileMock.serviceReadiness.hasSavedTransportProvider = false;
    const started = startHomeFastHelpJourney({
      actionId: "book-ride",
      destinationPath: "/concierge",
      profileId: profileMock.profileId,
      occurredAtMs: now.getTime() - 13 * 60 * 60 * 1000,
    });
    markHomeFastHelpJourney(started.context, "abandoned", {
      occurredAtMs: now.getTime() - 13 * 60 * 60 * 1000 + 30_000,
    });

    renderHomeScreen();
    expect(screen.getByTestId("card-home-fast-help-recovery")).toHaveTextContent("Add a trusted transport provider");
    fireEvent.click(screen.getByTestId("button-home-fast-help-recovery-continue"));

    expect(guardPathMock).toHaveBeenCalledWith("/onboarding/profile/providers", {
      state: expect.objectContaining({
        returnTo: "/concierge",
        setupFocus: "transport",
        setupFlow: "FLOW_TRANSPORT_BOOKING",
        conciergeResume: expect.objectContaining({ kind: "transport" }),
        returnState: expect.objectContaining({
          homeFastHelpContext: expect.objectContaining({
            journeyId: started.journey.id,
            actionId: "book-ride",
          }),
        }),
      }),
    });
  });

  it.skip("puts an urgent health signal first with a reassuring reason", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/vitals-engine/latest") {
        return {
          data: { analysis: { safety_status: "attention", recommended_action: "Seek care today" } },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    renderHomeScreen();

    const actions = within(screen.getByTestId("home-fast-help")).getAllByRole("button");
    expect(actions[0]).toHaveAttribute("data-testid", "button-home-fast-feel-better");
    expect(actions[0]).toHaveTextContent("A recent health signal may need attention");
  });

  it.skip("uses saved transport readiness and avoids a recently used action", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    profileMock.serviceReadiness.hasSavedTransportProvider = true;
    window.localStorage.setItem("vyva:home-fast-help-history:v1:profile-home", JSON.stringify([{
      actionId: "feel-better",
      status: "used",
      occurredAt: "2026-07-17T13:30:00.000Z",
    }]));

    renderHomeScreen();

    expect(screen.getByTestId("button-home-fast-book-ride")).toHaveTextContent("Your transport setup is ready");
    expect(screen.queryByTestId("button-home-fast-feel-better")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-home-fast-safe-home")).toBeInTheDocument();
  });

  it("renders the session-aware main hero CTA", () => {
    renderHomeScreen();

    expect(screen.getByTestId("button-home-hero-talk")).toHaveAccessibleName("Talk to VYVA");
    expect(screen.getByTestId("button-home-hero-talk")).toHaveTextContent("Talk to VYVA");
  });

  it("keeps the Home hero greeting on the user's first name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T14:00:00"));
    window.sessionStorage.setItem("home.greetingVariant", "1");

    renderHomeScreen();

    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Good afternoon, Karim");
    expect(voiceHeroMock).not.toHaveBeenCalled();
  });

  it("uses concise evening copy instead of long late-night variants", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T22:00:00"));

    renderHomeScreen();

    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Good evening, Karim");
  });

  it("automatically refreshes the greeting when the time period changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T16:59:30"));

    renderHomeScreen();

    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Good afternoon, Karim");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Good evening, Karim");
  });

  it("does not use an account email as the Home hero name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T14:00:00"));
    window.sessionStorage.setItem("home.greetingVariant", "1");
    profileMock.firstName = "qm@4cksa.com";

    renderHomeScreen();

    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Good afternoon");
    expect(screen.getByTestId("home-master-hero")).not.toHaveTextContent("qm@4cksa.com");
  });

  it.each([
    ["cognitive", "mind", ["memory", "reflexes", "focus", "senses"], "/mind-memory"],
    ["social", "community", ["friends", "experts", "share", "activities"], "/social-rooms"],
    ["concierge", "concierge", ["home", "care", "order", "book"], "/concierge"],
  ] as const)("opens the four %s choices before routing to the full pillar", (_masterCard, intent, cardIds, route) => {
    renderHomeScreen();

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_HOME_INTENT_EVENT, { detail: intent }));
    });
    switchHomeMode("touch");

    expect(guardPathMock).not.toHaveBeenCalled();
    for (const cardId of cardIds) {
      expect(screen.getByTestId(`card-home-${intent}-${cardId}`)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId(`button-home-${intent}-more`));
    expect(guardPathMock).toHaveBeenCalledWith(route, undefined);
  });

  it("opens a focused Health intent layer before routing to health actions", () => {
    renderHomeScreen();

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_HOME_INTENT_EVENT, { detail: "health" }));
    });
    switchHomeMode("touch");

    expect(guardPathMock).not.toHaveBeenCalledWith("/health", undefined);
    expect(screen.queryByTestId("home-master-hero")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-touch-heading")).toHaveTextContent("Are you OK?");
    expect(screen.getByTestId("home-pillar-cards")).not.toHaveTextContent("What do you need?");
    expect(screen.getByTestId("card-home-health-symptoms")).toHaveTextContent("Symptoms");
    expect(screen.getByTestId("card-home-health-vitals")).toHaveTextContent("Vitals");
    expect(screen.getByTestId("card-home-health-meds")).toHaveTextContent("Medications");
    expect(screen.getByTestId("card-home-health-doctor")).toHaveTextContent("Doctor next step");
    expect(screen.queryByTestId("card-home-health-prevention")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-health-visual-scan")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-home-health-more")).toHaveTextContent("More health options");

    fireEvent.click(screen.getByTestId("button-home-health-more"));
    expect(guardPathMock).toHaveBeenCalledWith("/health", undefined);

    fireEvent.click(screen.getByTestId("card-home-health-symptoms"));
    expect(screen.getByTestId("cross-pillar-subflow-canvas")).toHaveAttribute("data-action-id", "health-symptoms");
    fireEvent.click(screen.getByTestId("card-home-health-vitals"));
    expect(screen.getByTestId("cross-pillar-subflow-canvas")).toHaveAttribute("data-action-id", "health-vitals");
    fireEvent.click(screen.getByTestId("card-home-health-meds"));
    expect(screen.getByTestId("cross-pillar-subflow-canvas")).toHaveAttribute("data-action-id", "health-meds");
    fireEvent.click(screen.getByTestId("card-home-health-doctor"));

    expect(screen.getByTestId("cross-pillar-subflow-canvas")).toHaveAttribute(
      "data-action-id",
      "health-doctor",
    );
    expect(guardPathMock).not.toHaveBeenCalledWith(
      "/health/doctor",
      expect.anything(),
    );

    fireEvent.click(screen.getByRole("button", { name: /My usual doctor/i }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open next step/i }));

    expect(guardPathMock).toHaveBeenCalledWith("/onboarding/profile/providers?focus=doctor_clinic", expect.objectContaining({
      state: expect.objectContaining({
        setupFocus: "doctor_clinic",
        returnTo: "/",
        resumeAfterSetup: true,
        crossPillarOriginalDestinationPath: "/concierge",
      }),
    }));

    expect(screen.queryByTestId("button-home-master-intent-back")).not.toBeInTheDocument();
  });

  it("keeps broad Health choices hidden in voice mode until touch mode", () => {
    renderHomeScreen();

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_HOME_INTENT_EVENT, { detail: "health" }));
    });

    expect(screen.getByTestId("home-master-hero")).toBeInTheDocument();
    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Touch the orb to begin.");
    expectHomeModeControl("voice", "button-home-mode-touch", "Switch to touch");
    expect(screen.queryByTestId("home-pillar-cards")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-health-symptoms")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-health-more")).not.toBeInTheDocument();
    expect(guardPathMock).not.toHaveBeenCalled();

    switchHomeMode("touch");

    expect(screen.queryByTestId("home-master-hero")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-touch-heading")).toHaveTextContent("Are you OK?");
    expect(screen.getByTestId("card-home-health-symptoms")).toBeInTheDocument();
    expect(screen.getByTestId("button-home-health-more")).toHaveTextContent("More health options");
  });

  it.each([
    ["mind", ["memory", "reflexes", "focus", "senses"]],
    ["community", ["friends", "experts", "share", "activities"]],
    ["concierge", ["home", "care", "order", "book"]],
  ] as const)("keeps broad %s voice intent choices hidden until touch mode", (intent, cardIds) => {
    renderHomeScreen();

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_HOME_INTENT_EVENT, { detail: intent }));
    });

    expect(guardPathMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("home-master-hero")).toBeInTheDocument();
    expect(screen.queryByTestId("home-pillar-cards")).not.toBeInTheDocument();
    for (const cardId of cardIds) {
      expect(screen.queryByTestId(`card-home-${intent}-${cardId}`)).not.toBeInTheDocument();
    }

    switchHomeMode("touch");

    for (const cardId of cardIds) {
      expect(screen.getByTestId(`card-home-${intent}-${cardId}`)).toBeInTheDocument();
    }
  });

  it("restores the active pillar context without showing cards until touch mode", () => {
    const firstRender = renderHomeScreen();

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_HOME_INTENT_EVENT, { detail: "mind" }));
    });
    expect(screen.queryByTestId("card-home-mind-memory")).not.toBeInTheDocument();

    firstRender.unmount();
    renderHomeScreen();

    expect(screen.getByTestId("home-master-hero")).toBeInTheDocument();
    expect(screen.queryByTestId("card-home-mind-memory")).not.toBeInTheDocument();

    switchHomeMode("touch");

    expect(screen.getByTestId("card-home-mind-memory")).toBeInTheDocument();
    expect(screen.getByTestId("card-home-mind-senses")).toBeInTheDocument();
    expect(guardPathMock).not.toHaveBeenCalled();
  });

  it("highlights the exact action understood from voice and restores it on return", () => {
    const firstRender = renderHomeScreen();

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_HOME_SUBFLOW_EVENT, {
        detail: { actionId: "health-vitals", pillar: "health" },
      }));
    });

    expect(screen.queryByTestId("card-home-health-vitals")).not.toBeInTheDocument();
    expectHomeModeControl("voice", "button-home-mode-touch", "Switch to touch");

    switchHomeMode("touch");

    const selectedCard = screen.getByTestId("card-home-health-vitals");
    expect(selectedCard).toHaveAttribute("aria-current", "true");
    expect(selectedCard).toHaveTextContent("VYVA understood");
    expect(screen.getByTestId("card-home-health-symptoms")).not.toHaveAttribute("aria-current");
    switchHomeMode("voice");

    firstRender.unmount();
    renderHomeScreen();

    expect(screen.queryByTestId("card-home-health-vitals")).not.toBeInTheDocument();
    switchHomeMode("touch");

    expect(screen.getByTestId("card-home-health-vitals")).toHaveAttribute("aria-current", "true");
    expect(guardPathMock).not.toHaveBeenCalled();
  });

  it("keeps the selected action while hiding it in voice mode and showing it in touch mode", () => {
    renderHomeScreen();

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_HOME_SUBFLOW_EVENT, {
        detail: { actionId: "community-activities", pillar: "community" },
      }));
    });

    expect(screen.queryByTestId("card-home-community-activities")).not.toBeInTheDocument();
    switchHomeMode("touch");
    expect(screen.getByTestId("card-home-community-activities")).toHaveAttribute("aria-current", "true");
    switchHomeMode("voice");
    expect(screen.queryByTestId("card-home-community-activities")).not.toBeInTheDocument();
    switchHomeMode("touch");
    expect(screen.getByTestId("card-home-community-activities")).toHaveAttribute("aria-current", "true");
  });

  it.each(CROSS_PILLAR_COMPLETION_ACTIONS)(
    "keeps Voice mode and opens the exact canvas for %s",
    (actionId) => {
      renderHomeScreen();

      act(() => {
        window.dispatchEvent(new CustomEvent(VYVA_VOICE_HOME_SUBFLOW_EVENT, {
          detail: {
            actionId,
            pillar: VOICE_HOME_SUBFLOW_PILLARS[actionId],
          },
        }));
      });

      expectHomeModeControl("voice", "button-home-mode-touch", "Switch to touch");
      expect(screen.getByTestId("cross-pillar-subflow-canvas")).toHaveAttribute(
        "data-action-id",
        actionId,
      );
      expect(guardPathMock).not.toHaveBeenCalled();
    },
  );

  it("ignores malformed and duplicate broad voice intent events", () => {
    renderHomeScreen();

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_HOME_INTENT_EVENT, { detail: "unknown" }));
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_HOME_INTENT_EVENT, { detail: "community" }));
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_HOME_INTENT_EVENT, { detail: "community" }));
    });

    expect(guardPathMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("card-home-community-friends")).not.toBeInTheDocument();
    switchHomeMode("touch");
    expect(screen.getByTestId("card-home-community-friends")).toBeInTheDocument();
    expect(screen.getByTestId("card-home-community-activities")).toBeInTheDocument();
  });
});
