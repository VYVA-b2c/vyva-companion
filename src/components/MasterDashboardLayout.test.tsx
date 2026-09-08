import { act, render, screen, within } from "@testing-library/react";
import { Brain, Heart, Mic, ShieldCheck, Users } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MasterDashboardLayout, { type MasterFastHelpAction } from "./MasterDashboardLayout";

vi.mock("@/components/VyvaSessionCta", () => ({
  default: ({ testId }: { testId?: string }) => (
    <button type="button" data-testid={testId ?? "mock-vyva-session-cta"}>
      Voice orb
    </button>
  ),
}));

function makeAction(id: string, label: string, pinned = false): MasterFastHelpAction {
  return {
    id,
    icon: id === "urgent" ? ShieldCheck : Users,
    label,
    detail: "Detail",
    tone: { iconBg: "#FFFFFF", iconColor: "#111827", border: "#E5E7EB" },
    onClick: vi.fn(),
    testId: `fast-${id}`,
    pinned,
  };
}

function renderLayout(actions: MasterFastHelpAction[]) {
  return render(
    <MasterDashboardLayout
      hero={{
        icon: Mic,
        eyebrow: "Today",
        title: "Ready",
        action: { label: "Talk", onClick: vi.fn() },
      }}
      cards={[
        { id: "one", icon: Heart, title: "One", detail: "Detail", tone: { iconBg: "#FFFFFF", iconColor: "#111827", border: "#E5E7EB" }, onClick: vi.fn() },
        { id: "two", icon: Brain, title: "Two", detail: "Detail", tone: { iconBg: "#FFFFFF", iconColor: "#111827", border: "#E5E7EB" }, onClick: vi.fn() },
      ]}
      fastHelpTitle="Fast help"
      fastHelpActions={actions}
      fastHelpTestId="fast-help"
    />,
  );
}

describe("MasterDashboardLayout Fast help rotation", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows three actions and keeps urgent pinned while rotating", () => {
    vi.useFakeTimers();
    renderLayout([
      makeAction("urgent", "Safety signs", true),
      makeAction("one", "First"),
      makeAction("two", "Second"),
      makeAction("three", "Third"),
      makeAction("four", "Fourth"),
    ]);

    const fastHelp = screen.getByTestId("fast-help");
    expect(within(fastHelp).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByTestId("fast-urgent")).toHaveTextContent("Safety signs");
    expect(screen.getByTestId("fast-one")).toHaveTextContent("First");
    expect(screen.getByTestId("fast-two")).toHaveTextContent("Second");

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByTestId("fast-urgent")).toHaveTextContent("Safety signs");
    expect(screen.getByTestId("fast-three")).toHaveTextContent("Third");
    expect(screen.getByTestId("fast-four")).toHaveTextContent("Fourth");
  });

  it("does not rotate when reduced motion is preferred", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      })),
    });

    renderLayout([
      makeAction("urgent", "Safety signs", true),
      makeAction("one", "First"),
      makeAction("two", "Second"),
      makeAction("three", "Third"),
      makeAction("four", "Fourth"),
    ]);

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByTestId("fast-urgent")).toHaveTextContent("Safety signs");
    expect(screen.getByTestId("fast-one")).toHaveTextContent("First");
    expect(screen.getByTestId("fast-two")).toHaveTextContent("Second");
    expect(screen.queryByTestId("fast-three")).not.toBeInTheDocument();
  });

  it("suppresses contextual controls on the home master voice surface", () => {
    const onMessageAction = vi.fn();
    const onMessageDismiss = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(
      <MasterDashboardLayout
        launcherVariant="homeMaster"
        showCards={false}
        hero={{
          icon: Mic,
          eyebrow: "Today",
          title: "Good morning, Karim",
          subtitle: "Your medicine is due soon.",
          action: { kind: "voice", label: "Talk", testId: "button-home-hero-talk" },
          testId: "home-master-hero",
          messageActionLabel: "View",
          onMessageAction,
          onMessageDismiss,
          messageDismissLabel: "Not now",
        }}
        cards={[]}
        fastHelpTitle="Fast help"
        fastHelpActions={[]}
      />,
    );

    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Good morning, Karim");
    expect(screen.getByTestId("home-master-hero")).toHaveClass("md:flex-1", "md:justify-center", "md:pt-0");
    expect(screen.getByTestId("home-master-hero").parentElement).toHaveClass(
      "md:min-h-[calc(100svh-186px)]",
      "md:max-w-[640px]",
      "md:pb-0",
      "md:flex",
    );
    expect(screen.getByTestId("home-master-hero")).not.toHaveTextContent("Your medicine is due soon.");
    expect(screen.getByTestId("button-home-hero-talk")).toBeInTheDocument();
    expect(screen.queryByTestId("button-home-context-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-context-dismiss")).not.toBeInTheDocument();
    expect(onMessageAction).not.toHaveBeenCalled();
    expect(onMessageDismiss).not.toHaveBeenCalled();
  });
});

describe("MasterDashboardLayout contextual message", () => {
  it("offers the message action and dismissal without adding another heading", () => {
    const onMessageAction = vi.fn();
    const onMessageDismiss = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(
      <MasterDashboardLayout
        hero={{
          icon: Mic,
          eyebrow: "Today",
          title: "Good morning, Karim",
          subtitle: "Your medicine is due soon.",
          action: { label: "Talk", onClick: vi.fn() },
          messageActionLabel: "View",
          onMessageAction,
          onMessageDismiss,
          messageDismissLabel: "Dismiss",
        }}
        cards={[]}
        fastHelpActions={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Good morning, Karim" })).toBeInTheDocument();
    expect(screen.getByTestId("button-home-context-action")).toHaveTextContent("Your medicine is due soon.");
    expect(screen.queryByText("View")).not.toBeInTheDocument();

    screen.getByTestId("button-home-context-action").click();
    screen.getByTestId("button-home-context-dismiss").click();

    expect(onMessageAction).toHaveBeenCalledOnce();
    expect(onMessageDismiss).toHaveBeenCalledOnce();
  });
});

describe("MasterDashboardLayout Home card presentation", () => {
  it("supports canonical action cards with short visible summaries and full accessible labels", () => {
    render(
      <MasterDashboardLayout
        heroLayoutVariant="canonicalMenu"
        cardLayoutVariant="canonicalActionGrid"
        fastHelpLayoutVariant="canonicalActionGrid"
        isDarkMode
        hero={{
          icon: Mic,
          eyebrow: "Today",
          title: "Ready",
          action: { label: "Talk", onClick: vi.fn() },
        }}
        cards={[
          {
            id: "memory",
            icon: Brain,
            iconAccent: "bridge",
            title: "Strengthen Memory",
            detail: "Practice recall, matching, and daily routines.",
            summary: "Matching and recall",
            tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
            onClick: vi.fn(),
            testId: "card-memory",
          },
        ]}
        fastHelpTitle="Fast help"
        fastHelpActions={[makeAction("assessment", "Cognitive Assessment")]}
        cardGridTestId="cards"
        fastHelpTestId="fast-help"
      />,
    );

    expect(screen.getByRole("heading", { name: "Ready" }).closest("section")).toHaveAttribute("data-hero-layout", "canonical-menu");
    expect(screen.getByTestId("cards").querySelector('[data-card-layout="canonical-action-grid"]')).toBeInTheDocument();
    expect(screen.getByTestId("card-memory")).toHaveAttribute("data-vyva-card-layout", "canonical-action");
    expect(screen.getByTestId("card-memory-detail")).toHaveTextContent("Matching and recall");
    expect(screen.getByTestId("card-memory")).toHaveAccessibleName("Strengthen Memory. Practice recall, matching, and daily routines.");
    expect(screen.getByTestId("card-memory").querySelector('[data-vyva-accent="bridge"]')).toBeInTheDocument();
    expect(screen.getByTestId("fast-help")).toHaveAttribute("data-fast-help-layout", "canonical-action-grid");
  });

  it("keeps mobile Home cards down to icon, label, and chevron", () => {
    render(
      <MasterDashboardLayout
        launcherVariant="homeMaster"
        intentLayer="concierge"
        showCards
        hero={{
          icon: Mic,
          eyebrow: "Today",
          title: "Good morning, Karim",
          action: { kind: "voice", label: "Talk" },
        }}
        cards={[
          {
            id: "home-care",
            icon: Heart,
            title: "Home Care",
            detail: "Plumber, electrician, cleaning",
            tone: { iconBg: "#FFFFFF", iconColor: "#111827", border: "#E5E7EB" },
            onClick: vi.fn(),
          },
        ]}
        fastHelpActions={[]}
      />,
    );

    const detail = screen.getByText("Plumber, electrician, cleaning");
    expect(detail).toHaveClass("sr-only");
  });

  it("uses compact more copy on mobile and full copy on larger screens", () => {
    render(
      <MasterDashboardLayout
        launcherVariant="homeMaster"
        intentLayer="concierge"
        showCards
        hero={{
          icon: Mic,
          eyebrow: "Today",
          title: "Good morning, Karim",
          action: { kind: "voice", label: "Talk" },
        }}
        cards={[]}
        fastHelpActions={[]}
        cardSectionMoreLabel="Plus de services concierge"
        cardSectionMoreCompactLabel="Autres"
        cardSectionMoreTestId="button-home-concierge-more"
        onCardSectionMore={vi.fn()}
      />,
    );

    expect(screen.getByText("Autres")).toHaveClass("sm:hidden");
    expect(screen.getByText("Plus de services concierge")).toHaveClass("hidden");
    expect(screen.getByText("Plus de services concierge")).toHaveClass("sm:inline");
  });
});
