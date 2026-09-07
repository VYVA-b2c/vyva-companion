import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  initialPrototypeCheckInFlowState,
  normalizePrototypeCheckInAnswer,
  PrototypeBrainScreen,
  PrototypeCheckInScreen,
  PrototypeCommunityScreen,
  PrototypeConciergeScreen,
  PrototypeHealthActionPreviewScreen,
  PrototypeHealthScreen,
  PrototypeHomeScreen,
  PrototypeMenuScreen,
  PrototypeProfileActionPreviewScreen,
  PrototypeProfileScreen,
  PrototypeReportsScreen,
  PrototypeSymptomAssessmentShell,
  PrototypeSymptomReportPreviewScreen,
  submitPrototypeCheckInAnswer,
} from "./HomeNavPrototypeScreens";
import { SYMPTOM_ASSESSMENT_SHELL_CONTRACT } from "@/design/screenPresentation";
import { VYVA_OPEN_SOS_EVENT } from "@/lib/sosEvents";
import {
  hidesHomeNavPrototypeDock,
  isHomeNavPrototypeDockRoute,
  isHomeNavPrototypeTopbarRoute,
} from "@/lib/homeNavPrototypeRoutes";
import { HOME_MASTER_THEME_STORAGE_KEY } from "@/hooks/useHomeMasterTheme";
import { READABLE_TEXT_SIZE_STORAGE_KEY } from "@/hooks/useReadableTextSize";
import { BRAIN_COACH_ACTIVITY_CATALOG, getBrainCoachActivityPath } from "@/games/brainCoachCatalog";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    firstName: "Karim",
    profile: {
      firstName: "Karim",
      lastName: "",
      cityState: "Tarifa",
      country: "Spain",
    },
  }),
}));

function renderScreen(ui: React.ReactElement) {
  navigateMock.mockClear();
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {ui}
    </MemoryRouter>,
  );
}

describe("Home/Nav prototype screens", () => {
  afterEach(() => {
    window.localStorage.removeItem(HOME_MASTER_THEME_STORAGE_KEY);
    window.localStorage.removeItem(READABLE_TEXT_SIZE_STORAGE_KEY);
  });

  it("renders the Home companion presence with profile/settings, manual menu, orb, and moment feed", () => {
    renderScreen(<PrototypeHomeScreen />);

    expect(screen.getByTestId("home-master-layout")).toBeInTheDocument();
    expect(screen.getByTestId("home-master-layout-frame")).toHaveClass("pb-[calc(10rem+env(safe-area-inset-bottom))]");
    expect(screen.getByTestId("home-rotating-moment")).toHaveClass("mt-10");
    expect(screen.getByTestId("home-rotating-moment")).toHaveClass("md:mt-auto");
    expect(screen.getByTestId("home-rotating-moment").querySelector("span.block")).toHaveClass("[-webkit-line-clamp:2]");
    expect(screen.getByTestId("button-home-profile")).toBeInTheDocument();
    expect(screen.getByTestId("home-topbar-action-pill")).toBeInTheDocument();
    expect(screen.getByTestId("button-home-mode-touch")).toBeInTheDocument();
    expect(screen.getByTestId("home-dormant-zamora-orb-visual")).toHaveAttribute("data-orb-state", "idle");
    expect(screen.queryByTestId("home-idle-hand-cue")).not.toBeInTheDocument();
    expect(screen.getByText(/Good morning|Good afternoon|Good evening/)).toHaveTextContent("Karim");
    expect(screen.getByText("Tap the circle to talk")).toBeInTheDocument();
  });

  it("hides the Home rotating moment while VYVA is actively listening or responding", async () => {
    renderScreen(<PrototypeHomeScreen />);

    expect(screen.getByTestId("home-rotating-moment")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("home-dormant-zamora-orb-visual"));

    await waitFor(() => {
      expect(screen.queryByTestId("home-rotating-moment")).not.toBeInTheDocument();
      expect(screen.queryByTestId("home-idle-hand-cue")).not.toBeInTheDocument();
    });
  });

  it("renders Symptom Assessment chrome from its registry shell contract", () => {
    renderScreen(
      <PrototypeSymptomAssessmentShell
        interactionMode="touch"
        onInteractionModeChange={vi.fn()}
        onBack={vi.fn()}
        shellContract={SYMPTOM_ASSESSMENT_SHELL_CONTRACT}
      >
        <div>Assessment content</div>
      </PrototypeSymptomAssessmentShell>,
    );

    const shell = screen.getByTestId("prototype-symptom-assessment-screen");
    expect(shell).toHaveAttribute("data-shell-contract", "home.production");
    expect(shell).toHaveAttribute("data-header-contract", "detail.voice-touch");
    expect(shell).toHaveAttribute("data-container-contract", "flow.rounded-card");
    expect(shell).toHaveAttribute("data-bottom-nav-contract", "home-sos-reports");
    expect(shell).toHaveAttribute("data-composer-contract", "hidden");
    expect(screen.getByRole("heading", { name: "Ask Dr. AI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to voice mode" })).toBeInTheDocument();
    expect(screen.getByTestId("prototype-symptom-assessment-screen-frame")).toHaveClass(
      "max-w-[430px]",
      "sm:max-w-[680px]",
      "lg:max-w-[900px]",
      "min-h-[calc(100svh-136px)]",
    );
    expect(screen.getByTestId("prototype-symptom-assessment-screen-frame")).toHaveClass("pb-[calc(11rem+env(safe-area-inset-bottom))]");
    expect(screen.getByTestId("prototype-symptom-assessment-content")).toHaveClass("mt-5", "sm:mt-7");
  });

  it.each(["/health/symptom-check", "/health/vitals", "/informes/report-1", "/brain-coach/remember", "/brain-coach/focus", "/brain-coach/think", "/brain-coach/calm", "/dev/home-master/ask-dr-ai", "/dev/home-master/ask-dr-ai-checking", "/dev/home-master/ask-dr-ai-next", "/dev/home-master/symptom-report", "/dev/home-master/vitals", "/meds/refills"])(
    "keeps one flow-owned header and the shared Home/SOS/Reports dock on %s",
    (pathname) => {
      expect(isHomeNavPrototypeTopbarRoute(pathname)).toBe(true);
      expect(isHomeNavPrototypeDockRoute(pathname)).toBe(true);
      expect(hidesHomeNavPrototypeDock(pathname)).toBe(false);
    },
  );

  it.each([
    "/brain-coach/activity/remember_later",
    "/memory-games/memory_match",
    "/attention-boosters/rhythm-tap",
    "/executive-function/category-sort",
    "/senses/breath-garden",
    "/spatial-navigator",
    "/face-name-match",
    "/dual-task-walk",
  ])("lets the Brain Coach activity own its canonical topbar on %s", (pathname) => {
    expect(isHomeNavPrototypeTopbarRoute(pathname)).toBe(true);
    expect(isHomeNavPrototypeDockRoute(pathname)).toBe(false);
  });

  it("keeps every active Brain Coach catalog activity inside the activity-owned canonical shell", () => {
    for (const activity of BRAIN_COACH_ACTIVITY_CATALOG.filter(({ status }) => status === "active")) {
      for (const pathname of [activity.route, getBrainCoachActivityPath(activity.id)]) {
        expect(isHomeNavPrototypeTopbarRoute(pathname), pathname).toBe(true);
        expect(isHomeNavPrototypeDockRoute(pathname), pathname).toBe(false);
      }
    }
  });

  it("shows the idle prompt only during the first ten seconds after app load", () => {
    vi.useFakeTimers();
    try {
      renderScreen(<PrototypeHomeScreen />);

      expect(screen.getByText("Tap the circle to talk")).toBeInTheDocument();
      expect(screen.getByTestId("home-rotating-moment")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(9_999);
      });
      expect(screen.getByText("Tap the circle to talk")).toBeInTheDocument();
      expect(screen.getByTestId("home-rotating-moment")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByText("Tap the circle to talk")).not.toBeInTheDocument();
      expect(screen.getByTestId("home-rotating-moment")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders Menu with the canonical My Health two-by-two action-card grammar", () => {
    renderScreen(<PrototypeMenuScreen />);

    expect(screen.getByTestId("prototype-menu-screen")).toBeInTheDocument();
    expect(within(screen.getByTestId("menu-tile-grid")).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByTestId("button-prototype-back")).toBeInTheDocument();
    expect(screen.getByTestId("button-compact-voice")).toBeInTheDocument();
    const menuCards = ["health", "brain", "community", "concierge"].map((name) =>
      screen.getByTestId(`card-home-agent-${name}`),
    );
    expect(menuCards).toHaveLength(4);
    expect(screen.getByText("My Health")).toBeInTheDocument();
    expect(screen.getByText("My Brain")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Concierge")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Menu" })).toBeInTheDocument();
    expect(screen.queryByText("Reports")).not.toBeInTheDocument();
    expect(screen.getByTestId("menu-tile-grid")).toHaveClass("grid-cols-1", "md:grid-cols-2", "gap-4", "md:gap-5");
    for (const button of menuCards) {
      expect(button).toHaveClass("min-h-[84px]", "md:min-h-[158px]", "rounded-[26px]", "md:p-5");
      expect(button.querySelector("[data-vyva-icon-tile]")).toBeInTheDocument();
      expect(button.querySelector('[data-vyva-icon="utility"]')).toBeInTheDocument();
    }
    expect(screen.getByTestId("card-home-agent-health").querySelector('[data-vyva-accent="pulse"]')).toBeInTheDocument();
    expect(screen.getByTestId("card-home-agent-brain").querySelector('[data-vyva-accent="bridge"]')).toBeInTheDocument();
    expect(screen.getByTestId("card-home-agent-community").querySelector('[data-vyva-accent="link"]')).toBeInTheDocument();
    expect(screen.getByTestId("card-home-agent-concierge").querySelector('[data-vyva-accent="clapper"]')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-prototype-back"));
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master");
  });

  it("switches from manual Menu back to the voice Home surface when compact mic is tapped", () => {
    renderScreen(<PrototypeMenuScreen />);

    fireEvent.click(screen.getByTestId("button-compact-voice"));

    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master");
  });

  it("renders the non-Health destination surfaces with the shared peer-screen controls and row grammar", () => {
    const cases = [
      [<PrototypeBrainScreen key="brain" />, "My Brain", "Rhythm Tap", "Rhythm Tap — this week"],
      [<PrototypeCommunityScreen key="community" />, "Community", "Book Club", "Elena: I loved"],
      [<PrototypeConciergeScreen key="concierge" />, "Concierge", "Ride to Dr. Reyes", "Confirmed for tomorrow"],
      [<PrototypeReportsScreen key="reports" />, "My Reports", "Steps", "Appointments kept"],
    ] as const;

    for (const [ui, title, row, note] of cases) {
      const { unmount } = renderScreen(ui);
      expect(screen.getAllByRole("heading", { name: title }).length).toBeGreaterThan(0);
      expect(screen.getByTestId("button-prototype-back")).toBeInTheDocument();
      expect(screen.getByTestId("button-compact-voice")).toBeInTheDocument();
      expect(screen.queryByText("Ask VYVA")).not.toBeInTheDocument();
      expect(screen.getByText(row)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(note))).toBeInTheDocument();
      expect(screen.getByText(row).closest("button")?.querySelector('[data-vyva-icon="utility"]')).toBeInTheDocument();
      expect(screen.getByText(row).closest("button")?.querySelector("[data-vyva-accent]")).toBeInTheDocument();
      unmount();
    }
  });

  it("switches destination screens back to the voice Home surface when compact mic is tapped", () => {
    renderScreen(<PrototypeBrainScreen />);

    fireEvent.click(screen.getByTestId("button-compact-voice"));

    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master");
  });

  it("uses the approved gold-accent vocabulary across every destination and profile row", () => {
    const cases = [
      [<PrototypeBrainScreen key="brain" />, ["pulse", "id", "smile"]],
      [<PrototypeCommunityScreen key="community" />, ["bookmark", "path", "spark"]],
      [<PrototypeConciergeScreen key="concierge" />, ["pin", "divider", "signal"]],
      [<PrototypeReportsScreen key="reports" />, ["step", "trend", "dot", "calendar"]],
      [<PrototypeProfileScreen key="profile" />, ["id", "pulse", "divider", "check", "knobs", "link", "scope"]],
    ] as const;

    for (const [ui, expectedAccents] of cases) {
      const { container, unmount } = renderScreen(ui);
      const accents = Array.from(container.querySelectorAll("[data-vyva-accent]"), (element) => element.getAttribute("data-vyva-accent"));
      expect(accents).toEqual(expectedAccents);
      unmount();
    }
  });

  it("renders Health as a calm responsive action grid with check-in and symptom report separated", () => {
    renderScreen(<PrototypeHealthScreen />);

    expect(screen.getByTestId("button-prototype-back")).toBeInTheDocument();
    expect(screen.getByTestId("button-compact-voice")).toBeInTheDocument();
    expect(screen.queryByTestId("prototype-health-orb")).not.toBeInTheDocument();
    expect(screen.queryByText("Ask VYVA")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Health" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My Health" })).toBeInTheDocument();
    expect(screen.getByText("Longevity")).toBeInTheDocument();
    expect(screen.getByText("Prevention is the best cure")).toBeInTheDocument();
    expect(screen.getByText("Ask Dr. AI")).toBeInTheDocument();
    expect(screen.getByText("Aches or changes")).toBeInTheDocument();
    expect(screen.getByText("My Vitals")).toBeInTheDocument();
    expect(screen.getByText("Readings and trends")).toBeInTheDocument();
    expect(screen.getByText("Medication")).toBeInTheDocument();
    expect(screen.getByText("Doses and reminders")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("72 bpm")).toBeInTheDocument();
    expect(screen.getByText("2:00 PM")).toBeInTheDocument();
    expect(screen.getByTestId("health-action-grid")).toHaveClass("grid-cols-1", "md:grid-cols-2");
    for (const testId of ["button-health-plan", "button-health-symptom-report", "button-health-vitals", "button-health-medicines"]) {
      expect(screen.getByTestId(testId)).toHaveClass("bg-[#2A2034]");
      expect(screen.getByTestId(testId)).toHaveClass("min-h-[84px]", "md:min-h-[158px]");
      expect(screen.getByTestId(testId)).not.toHaveClass("bg-white/92");
      expect(screen.getByTestId(`${testId}-icon`)).toHaveClass("bg-[#3C2956]");
      expect(screen.getByTestId(`${testId}-icon`)).not.toHaveClass("text-white");
      expect(screen.getByTestId(`${testId}-icon`).getAttribute("style")).toBeNull();
      expect(screen.getByTestId(`${testId}-icon`).querySelector("svg")).toHaveAttribute("data-brand-icon");
      expect(screen.getByTestId(`${testId}-status`).getAttribute("style")).toContain("background:");
      expect(screen.getByTestId(`${testId}-status`).getAttribute("style")).toContain("color:");
    }
    expect(screen.getByTestId("button-health-symptom-report-icon").querySelector("svg")).toHaveAttribute("data-brand-icon", "doctor");
    expect(screen.getByTestId("button-health-plan-icon").querySelector("svg")).toHaveAttribute("data-brand-icon", "longevity");
    expect(screen.getByTestId("button-health-vitals-icon").querySelector("svg")).toHaveAttribute("data-brand-icon", "vitals");
    expect(screen.getByTestId("button-health-medicines-icon").querySelector("svg")).toHaveAttribute("data-brand-icon", "medication");
    expect(screen.queryByText("Heart rate — this week")).not.toBeInTheDocument();
    expect(screen.queryByText("Heart rate")).not.toBeInTheDocument();
    expect(screen.queryByText("Blood pressure")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-prototype-back"));
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/menu");
  });

  it("switches from Health back to the voice Home surface when compact mic is tapped", () => {
    renderScreen(<PrototypeHealthScreen />);

    fireEvent.click(screen.getByTestId("button-compact-voice"));

    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master");
  });

  it("fits the production Health hub inside the AppShell viewport without nested overflow", () => {
    renderScreen(<PrototypeHealthScreen contained />);

    expect(screen.getByTestId("prototype-health-screen")).toHaveClass("min-h-[calc(100svh-136px)]");
    expect(screen.getByTestId("prototype-health-screen-frame")).toHaveClass("min-h-[calc(100svh-136px)]");
    expect(screen.getByTestId("prototype-health-screen")).not.toHaveClass("min-h-[100svh]");
    expect(screen.getByTestId("prototype-health-screen")).not.toHaveClass("pb-32");
    expect(screen.getByTestId("prototype-health-screen-frame")).not.toHaveClass("pb-[calc(10rem+env(safe-area-inset-bottom))]");
  });

  it("lets the dev Health preview route entry rows to the intended destinations", () => {
    renderScreen(<PrototypeHealthScreen />);

    fireEvent.click(screen.getByTestId("button-health-plan"));
    fireEvent.click(screen.getByTestId("button-health-symptom-report"));
    fireEvent.click(screen.getByTestId("button-health-vitals"));
    fireEvent.click(screen.getByTestId("button-health-medicines"));

    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/health-plan");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/ask-dr-ai?fresh=1");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/vitals");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/medicines");
  });

  it("supports production Health hub destinations and expands its frame on larger screens", () => {
    renderScreen(
      <PrototypeHealthScreen
        healthPlanPath="/health/prevention"
        askDrAiPath="/health/symptom-check?fresh=1"
        vitalsPath="/health/vitals"
        medicinesPath="/meds/my-medicines"
        voicePath="/"
        profilePath="/settings/account"
        backPath="/menu"
      />,
    );

    const frame = screen.getByTestId("prototype-health-screen-frame");
    expect(frame).toHaveClass("max-w-[430px]");
    expect(frame).toHaveClass("sm:max-w-[680px]");
    expect(frame).toHaveClass("lg:max-w-[900px]");

    fireEvent.click(screen.getByTestId("button-health-plan"));
    fireEvent.click(screen.getByTestId("button-health-symptom-report"));
    fireEvent.click(screen.getByTestId("button-health-vitals"));
    fireEvent.click(screen.getByTestId("button-health-medicines"));
    fireEvent.click(screen.getByTestId("button-compact-voice"));
    fireEvent.click(screen.getByTestId("button-prototype-back"));

    expect(navigateMock).toHaveBeenCalledWith("/health/prevention");
    expect(navigateMock).toHaveBeenCalledWith("/health/symptom-check?fresh=1");
    expect(navigateMock).toHaveBeenCalledWith("/health/vitals");
    expect(navigateMock).toHaveBeenCalledWith("/meds/my-medicines");
    expect(navigateMock).toHaveBeenCalledWith("/");
    expect(navigateMock).toHaveBeenCalledWith("/menu");
  });

  it("routes Profile rows to dev-safe preview destinations instead of protected login handoffs", () => {
    renderScreen(<PrototypeProfileScreen />);

    fireEvent.click(screen.getByTestId("button-profile-account"));
    fireEvent.click(screen.getByTestId("button-profile-health"));
    fireEvent.click(screen.getByTestId("button-profile-medicines"));
    fireEvent.click(screen.getByTestId("button-profile-emergency"));
    fireEvent.click(screen.getByTestId("button-profile-care-team"));
    fireEvent.click(screen.getByTestId("button-profile-providers"));
    fireEvent.click(screen.getByTestId("button-profile-accessibility"));

    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/account");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/health");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/medicines");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/emergency");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/care-team");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/providers");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/preferences");
  });

  it("renders Preferences as a local profile sub-screen with changeable preference rows", () => {
    renderScreen(<PrototypeProfileActionPreviewScreen kind="accessibility" />);

    expect(screen.getByTestId("prototype-profile-action-preview-accessibility")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Preferences" })).toBeInTheDocument();
    expect(screen.getByText("Text size")).toBeInTheDocument();
    expect(screen.getByText("Currently Large")).toBeInTheDocument();
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("Currently Dark")).toBeInTheDocument();
    expect(screen.getAllByText("Change")).toHaveLength(2);
  });

  it("lets the Preferences Theme row toggle the local preview theme", async () => {
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "dark");
    renderScreen(<PrototypeProfileActionPreviewScreen kind="accessibility" />);

    expect(screen.getByTestId("prototype-profile-action-preview-accessibility")).toHaveAttribute("data-home-master-theme", "dark");
    expect(screen.getByText("Currently Dark")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("profile-accessibility-theme"));

    await waitFor(() => {
      expect(screen.getByTestId("prototype-profile-action-preview-accessibility")).toHaveAttribute("data-home-master-theme", "light");
    });
    expect(screen.getByText("Currently Light")).toBeInTheDocument();

    window.localStorage.removeItem(HOME_MASTER_THEME_STORAGE_KEY);
  });

  it("lets the Preferences Text size row toggle the local preview text size", async () => {
    window.localStorage.setItem(READABLE_TEXT_SIZE_STORAGE_KEY, "large");
    renderScreen(<PrototypeProfileActionPreviewScreen kind="accessibility" />);

    expect(screen.getByTestId("prototype-profile-action-preview-accessibility")).toHaveAttribute("data-vyva-text-size", "large");
    expect(screen.getByText("Currently Large")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("profile-accessibility-text-size"));

    await waitFor(() => {
      expect(screen.getByTestId("prototype-profile-action-preview-accessibility")).toHaveAttribute("data-vyva-text-size", "normal");
    });
    expect(screen.getByText("Currently Normal")).toBeInTheDocument();
  });

  it("renders the Brain and Reports trend/detail rows from the reference brief", () => {
    const brain = renderScreen(<PrototypeBrainScreen />);
    expect(screen.getByText("Rhythm Tap — this week")).toBeInTheDocument();
    brain.unmount();

    renderScreen(<PrototypeReportsScreen />);
    expect(screen.getByText("Appointments kept")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("renders Profile as a peer surface with caregiver visibility and preference rows", () => {
    renderScreen(<PrototypeProfileScreen />);

    expect(screen.getByRole("heading", { name: "Karim" })).toBeInTheDocument();
    expect(screen.getByTestId("button-prototype-back")).toBeInTheDocument();
    expect(screen.getByTestId("button-compact-voice")).toBeInTheDocument();
    expect(screen.getByText("Profile & settings")).toBeInTheDocument();
    expect(screen.getByText("Tarifa, Spain")).toBeInTheDocument();
    expect(screen.getByText("Your details")).toBeInTheDocument();
    expect(screen.getByText("Account details")).toBeInTheDocument();
    expect(screen.getByText("Health profile")).toBeInTheDocument();
    expect(screen.getByText("Emergency contact")).toBeInTheDocument();
    expect(screen.getByText("Who can help")).toBeInTheDocument();
    expect(screen.getByText("Care team")).toBeInTheDocument();
    expect(screen.getByText("Doctors & providers")).toBeInTheDocument();
    expect(screen.getByText("Preferences")).toBeInTheDocument();
    expect(screen.getByText("Text and theme")).toBeInTheDocument();
    expect(screen.getByText("Call support")).toBeInTheDocument();
  });

  it("skips the follow-up question when the first answer is Great or Okay", () => {
    renderScreen(<PrototypeCheckInScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Okay" }));

    expect(screen.getByTestId("prototype-checkin-summary")).toBeInTheDocument();
    expect(screen.getByText("Feeling today")).toBeInTheDocument();
    expect(screen.getByText("Okay")).toBeInTheDocument();
    expect(screen.queryByText("A little more")).not.toBeInTheDocument();
  });

  it("renders the storyboard follow-up path, summary and safety interruption", () => {
    const sosEvents: Event[] = [];
    const handler = (event: Event) => sosEvents.push(event);
    window.addEventListener(VYVA_OPEN_SOS_EVENT, handler);
    renderScreen(<PrototypeCheckInScreen />);

    expect(screen.getByTestId("prototype-checkin-question")).toHaveAttribute("data-question-id", "feeling");
    expect(screen.getByTestId("checkin-question-source-icon")).toHaveAttribute("data-icon-type", "vyva-mark");
    expect(screen.getByTestId("button-checkin-urgent-escape")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Great" })).toBeInTheDocument();
    expect(screen.getByTestId("button-checkin-option-great")).toHaveTextContent("Great");
    expect(screen.getByRole("button", { name: "Okay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not my best" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Something's bothering me" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Good" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Low energy" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Something's bothering me" }));
    expect(screen.getByTestId("prototype-checkin-question")).toHaveAttribute("data-question-id", "detail");
    expect(screen.getByRole("button", { name: "Tired or low energy" })).toBeInTheDocument();
    expect(screen.getByTestId("button-checkin-option-aches_discomfort")).toHaveTextContent("Aches or discomfort");
    expect(screen.queryByRole("button", { name: "Breathing feels harder" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aches or discomfort" }));
    expect(screen.getByTestId("prototype-checkin-summary")).toBeInTheDocument();
    expect(screen.getByText("Here’s what you told VYVA.")).toBeInTheDocument();
    expect(screen.getByText("Thanks for checking in.")).toBeInTheDocument();
    expect(screen.getByText("Feeling today")).toBeInTheDocument();
    expect(screen.getByText("A little more")).toBeInTheDocument();
    expect(screen.getByText("Something's bothering me")).toBeInTheDocument();
    expect(screen.getByText("Aches or discomfort")).toBeInTheDocument();
    expect(screen.queryByText("Suggested next step")).not.toBeInTheDocument();
    expect(screen.queryByText(/symptom support can help/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Symptom Report" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Get Urgent Help" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/health");
    expect(sosEvents).toHaveLength(0);

    window.removeEventListener(VYVA_OPEN_SOS_EVENT, handler);
  });

  it("opens Ask Dr. AI as a fresh assessment instead of the report placeholder", () => {
    renderScreen(<PrototypeHealthScreen checkInPath="/dev/home-master/check-in" askDrAiPath="/dev/home-master/ask-dr-ai?fresh=1" />);

    fireEvent.click(screen.getByTestId("button-health-symptom-report"));

    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/ask-dr-ai?fresh=1");
  });

  it("renders the local symptom-report handoff preview without requiring auth", () => {
    renderScreen(<PrototypeSymptomReportPreviewScreen />);

    expect(screen.getByTestId("prototype-health-action-preview-symptom")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ask Dr. AI" })).toBeInTheDocument();
    expect(screen.getByText("A focused symptom report starts here.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-health-action-preview-back"));
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/health");
  });

  it("renders local preview handoffs for protected Health destinations", () => {
    const cases = [
      ["plan", "Longevity", "Prevention is the best cure"],
      ["vitals", "My Vitals", "Latest readings and new measurements live here."],
      ["medicines", "Medication", "Dose times and reminders open here."],
    ] as const;

    for (const [kind, title, subtitle] of cases) {
      const { unmount } = renderScreen(<PrototypeHealthActionPreviewScreen kind={kind} />);
      expect(screen.getByTestId(`prototype-health-action-preview-${kind}`)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByText(subtitle)).toBeInTheDocument();
      unmount();
    }
  });

  it("opens the existing SOS pathway from the check-in safety state and can resume", () => {
    const sosEvents: Event[] = [];
    const handler = (event: Event) => sosEvents.push(event);
    window.addEventListener(VYVA_OPEN_SOS_EVENT, handler);
    renderScreen(<PrototypeCheckInScreen />);

    fireEvent.click(screen.getByTestId("button-checkin-urgent-escape"));
    expect(screen.getByTestId("prototype-checkin-safety")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-checkin-safety-sos"));
    expect(sosEvents).toHaveLength(1);
    fireEvent.click(screen.getByTestId("button-checkin-safety-resume"));
    expect(screen.getByTestId("prototype-checkin-question")).toHaveAttribute("data-question-id", "feeling");

    window.removeEventListener(VYVA_OPEN_SOS_EVENT, handler);
  });

  it("exposes the check-in adapter boundary without making the UI authoritative", () => {
    renderScreen(<PrototypeCheckInScreen />);

    const boundary = screen.getByTestId("checkin-flow-adapter-boundary");
    expect(boundary).toHaveAttribute("data-flow-id", "health.preventive_check");
    expect(boundary).toHaveAttribute("data-flow-version", "1.0.0");
    expect(boundary).toHaveAttribute("data-source", "local_fixture_adapter");
    expect(boundary).toHaveAttribute("data-status", "collecting");
    expect(boundary).toHaveAttribute("data-scene-id", "health.preventive_check.feeling");
    expect(boundary).toHaveAttribute("data-question-id", "feeling");
    expect(boundary).toHaveAttribute("data-answer-count", "0");
  });

  it("normalizes equivalent spoken and tapped check-in answers to the same semantic answer", () => {
    const touched = normalizePrototypeCheckInAnswer("feeling", "okay", "touch");
    const spoken = normalizePrototypeCheckInAnswer("feeling", "okay", "voice");

    expect(touched).not.toBeNull();
    expect(spoken).not.toBeNull();
    expect({ ...touched, modality: undefined }).toEqual({ ...spoken, modality: undefined });
    expect(touched?.modality).toBe("touch");
    expect(spoken?.modality).toBe("voice");
  });

  it("rejects stale scene answers without advancing or rebinding them to the current question", () => {
    const onDetailQuestion = submitPrototypeCheckInAnswer(initialPrototypeCheckInFlowState, {
      questionId: "feeling",
      optionId: "something_bothering_me",
      modality: "touch",
    });

    const staleTouch = submitPrototypeCheckInAnswer(onDetailQuestion, {
      questionId: "feeling",
      optionId: "okay",
      modality: "touch",
    });
    const staleVoice = submitPrototypeCheckInAnswer(onDetailQuestion, {
      questionId: "feeling",
      optionId: "great",
      modality: "voice",
    });

    for (const result of [staleTouch, staleVoice]) {
      expect(result.status).toBe("collecting");
      expect(result.currentQuestionId).toBe("detail");
      expect(result.answers).toHaveLength(1);
      expect(result.answers[0]?.optionId).toBe("something_bothering_me");
      expect(result.lastRejection?.reason).toBe("stale_scene");
      expect(result.lastRejection?.activeQuestionId).toBe("detail");
    }
  });

  it("rejects duplicate answers after summary without progressing again", () => {
    const summary = submitPrototypeCheckInAnswer(initialPrototypeCheckInFlowState, {
      questionId: "feeling",
      optionId: "okay",
      modality: "touch",
    });
    const duplicate = submitPrototypeCheckInAnswer(summary, {
      questionId: "feeling",
      optionId: "okay",
      modality: "voice",
    });

    expect(summary.status).toBe("summary");
    expect(duplicate.status).toBe("summary");
    expect(duplicate.answers).toHaveLength(1);
    expect(duplicate.lastRejection?.reason).toBe("inactive_flow");
  });

  it("resumes the same follow-up question after the safety interruption", () => {
    renderScreen(<PrototypeCheckInScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Something's bothering me" }));
    expect(screen.getByTestId("prototype-checkin-question")).toHaveAttribute("data-question-id", "detail");
    fireEvent.click(screen.getByTestId("button-checkin-urgent-escape"));
    fireEvent.click(screen.getByTestId("button-checkin-safety-resume"));

    expect(screen.getByTestId("prototype-checkin-question")).toHaveAttribute("data-question-id", "detail");
    expect(screen.getByRole("button", { name: "Trouble sleeping" })).toBeInTheDocument();
  });

  it("keeps the desktop check-in layout as one centered projection column", () => {
    renderScreen(<PrototypeCheckInScreen />);

    expect(screen.getByTestId("checkin-desktop-shell")).toHaveClass("max-w-[32.5rem]");
    expect(screen.queryByText(/fixture only/i)).not.toBeInTheDocument();
  });
});
