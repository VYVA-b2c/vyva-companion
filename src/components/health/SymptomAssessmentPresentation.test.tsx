import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { HeartPulse } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE,
  SymptomAssessmentPresentation,
} from "./SymptomAssessmentPresentation";
import { SYMPTOM_ASSESSMENT_STAGE_IDS } from "@/design/screenPresentation";
import { resolveSymptomAssessmentPresentation } from "@/design/screenPresentation";
import { SymptomChoiceCard } from "./SymptomChoiceCard";
import { HOME_MASTER_THEME_STORAGE_KEY } from "@/hooks/useHomeMasterTheme";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.removeItem(HOME_MASTER_THEME_STORAGE_KEY);
});

describe("SymptomAssessmentPresentation", () => {
  const expectedLayout = {
    describe: "capture",
    safety_check: "binary",
    urgent_escalation: "alert",
    symptom_selection: "choices",
    severity: "scale",
    onset: "choices",
    related_details: "capture",
    review: "review",
    checking: "progress",
    safest_next_step: "guidance",
    save_share_summary: "handoff",
  } as const;

  it.each(SYMPTOM_ASSESSMENT_STAGE_IDS)("renders both approved %s presentation variants", (stageId) => {
    render(
      <>
        <SymptomAssessmentPresentation stageId={stageId} modality="voice" />
        <SymptomAssessmentPresentation stageId={stageId} modality="touch" />
      </>,
    );

    for (const modality of ["voice", "touch"] as const) {
      const presentation = screen.getByTestId(`symptom-presentation-${stageId}-${modality}`);
      expect(presentation).toHaveClass(
        stageId === "severity" ? "max-w-[360px]" : "max-w-[330px]",
        "sm:max-w-[760px]",
      );
      expect(presentation).toHaveAttribute(
        "data-approved-frame",
        SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE[stageId],
      );
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-presentation-modality",
        modality,
      );
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-flow-id",
        "health.symptom_assessment",
      );
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-presentation-id",
        modality === "voice"
          ? resolveSymptomAssessmentPresentation(stageId).voiceSceneId
          : resolveSymptomAssessmentPresentation(stageId).touchSceneId,
      );
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-scene-layout",
        expectedLayout[stageId],
      );
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-shell-contract",
        "home.production",
      );
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-header-contract",
        "detail.voice-touch",
      );
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-container-contract",
        "flow.rounded-card",
      );
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-bottom-nav-contract",
        "home-sos-reports",
      );
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-composer-contract",
        "hidden",
      );
    }
  });

  it("shows the canonical mode chrome and Voice capture orb only for Voice capture", () => {
    render(
      <>
        <SymptomAssessmentPresentation stageId="describe" modality="voice" />
        <SymptomAssessmentPresentation stageId="describe" modality="touch" />
      </>,
    );

    const voiceScene = screen.getByTestId("symptom-presentation-describe-voice");
    const touchScene = screen.getByTestId("symptom-presentation-describe-touch");
    expect(within(voiceScene).getByLabelText("Voice mode")).toBeInTheDocument();
    expect(within(touchScene).getByLabelText("Touch mode")).toBeInTheDocument();
    expect(within(voiceScene).getByTestId("symptom-scene-orb")).toHaveAttribute(
      "aria-label",
      "Voice capture ready",
    );
    expect(within(touchScene).queryByTestId("symptom-scene-orb")).not.toBeInTheDocument();
  });

  it("renders the canonical urgent, progress, guidance, and review scene structures", () => {
    render(
      <>
        <SymptomAssessmentPresentation stageId="urgent_escalation" modality="touch" />
        <SymptomAssessmentPresentation stageId="checking" modality="touch">
          <button type="button">Leaked severity choice</button>
        </SymptomAssessmentPresentation>
        <SymptomAssessmentPresentation stageId="safest_next_step" modality="touch" />
        <SymptomAssessmentPresentation
          stageId="review"
          modality="touch"
          reviewItems={[
            { label: "Symptom", value: "Headache" },
            { label: "Severity", value: "6 out of 10" },
          ]}
        />
      </>,
    );

    expect(screen.getByTestId("symptom-scene-alert")).toHaveTextContent("Call emergency services");
    const progress = screen.getByTestId("symptom-scene-progress");
    expect(screen.getByRole("heading", { name: "Reviewing your symptoms" })).toBeInTheDocument();
    expect(progress).toHaveTextContent("Reviewing your symptoms");
    expect(progress).not.toHaveTextContent("Reviewing your health profile");
    expect(progress).not.toHaveTextContent("What VYVA is considering");
    expect(progress).not.toHaveTextContent("anything missing stays unknown");
    expect(screen.getByTestId("symptom-presentation-checking-touch")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "Leaked severity choice" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("symptom-scene-controls-checking-touch")).not.toBeInTheDocument();
    expect(screen.getByTestId("symptom-scene-guidance")).toHaveTextContent("Follow this guidance");
    expect(screen.getByTestId("symptom-scene-review")).toHaveTextContent("Headache");
    expect(screen.getByTestId("symptom-scene-review")).toHaveTextContent("6 out of 10");
  });

  it("rotates one useful checking insight at a time", () => {
    vi.useFakeTimers();
    render(<SymptomAssessmentPresentation stageId="checking" modality="touch" />);

    expect(screen.getByRole("heading", { name: "Reviewing your symptoms" })).toBeInTheDocument();
    expect(screen.queryByText("Reviewing your health profile")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2400));
    expect(screen.getByRole("heading", { name: "Reviewing your health profile" })).toBeInTheDocument();
    expect(screen.queryByText("Reviewing your symptoms")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2400));
    expect(screen.getByRole("heading", { name: "Searching 40M+ peer-reviewed sources" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2400));
    expect(screen.getByRole("heading", { name: "Checking safety signals" })).toBeInTheDocument();
  });

  it.each([
    ["light", "canonical-light"],
    ["dark", "canonical-dark"],
  ] as const)("uses the canonical %s progress surface", (theme, expectedSurface) => {
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, theme);

    render(<SymptomAssessmentPresentation stageId="checking" modality="touch" />);

    expect(screen.getByTestId("symptom-presentation-checking-touch")).toHaveAttribute(
      "data-theme-surface",
      expectedSurface,
    );
    expect(screen.getByTestId("symptom-checking-progress-track")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.getByTestId("symptom-checking-copy-slot")).toHaveClass("h-[84px]");
  });

  it("keeps the approved mobile Touch selected-control state child-owned and interactive", () => {
    function SelectedControlFixture() {
      const [selected, setSelected] = useState(false);
      return (
        <SymptomAssessmentPresentation stageId="symptom_selection" modality="touch">
          <button
            aria-pressed={selected}
            data-presentation-state={selected ? "selected" : "default"}
            data-testid="symptom-option-aches"
            type="button"
            onClick={() => setSelected((current) => !current)}
          >
            Aches or discomfort
          </button>
        </SymptomAssessmentPresentation>
      );
    }

    render(<SelectedControlFixture />);

    const option = screen.getByTestId("symptom-option-aches");
    expect(option).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(option);
    expect(option).toHaveAttribute("aria-pressed", "true");
    expect(option).toHaveAttribute("data-presentation-state", "selected");
  });

  it("renders the approved mobile Touch validation-error state without advancing", () => {
    render(
      <SymptomAssessmentPresentation stageId="severity" modality="touch">
        <div data-presentation-state="validation-error" role="alert">Choose a severity to continue.</div>
        <button disabled type="button">Continue</button>
      </SymptomAssessmentPresentation>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a severity to continue.");
    expect(screen.getByRole("alert")).toHaveAttribute("data-presentation-state", "validation-error");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("renders the approved mobile Voice generic-error state with a retry child action", () => {
    let retried = false;
    render(
      <SymptomAssessmentPresentation stageId="checking" modality="voice" allowProgressChildren>
        <div data-presentation-state="error" role="alert">
          <p>Something went wrong.</p>
          <button type="button" onClick={() => { retried = true; }}>Retry</button>
        </div>
      </SymptomAssessmentPresentation>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong.");
    expect(screen.getByRole("alert")).toHaveAttribute("data-presentation-state", "error");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retried).toBe(true);
    expect(screen.getByTestId("symptom-presentation-checking-voice")).toHaveAttribute(
      "data-presentation-state",
      "loading",
    );
  });

  it("renders the approved mobile Touch completed state without owning final actions", () => {
    let action = "";
    render(
      <SymptomAssessmentPresentation stageId="save_share_summary" modality="touch">
        <div data-presentation-state="completed" role="status">Saved</div>
        <button type="button" onClick={() => { action = "share"; }}>Share</button>
        <button type="button" onClick={() => { action = "done"; }}>Done</button>
      </SymptomAssessmentPresentation>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByRole("status")).toHaveAttribute("data-presentation-state", "completed");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(action).toBe("share");
    expect(screen.getByTestId("symptom-presentation-save_share_summary-touch")).toHaveAttribute(
      "data-presentation-state",
      "default",
    );
  });

  it("uses concise mobile helper copy for result and handoff scenes", () => {
    render(
      <>
        <SymptomAssessmentPresentation stageId="safest_next_step" modality="touch" fullBleedChildren />
        <SymptomAssessmentPresentation stageId="save_share_summary" modality="touch" fullBleedChildren />
      </>,
    );

    expect(screen.getByText("Follow this guidance.")).toHaveClass("md:hidden");
    expect(screen.getByText("Follow this guidance and watch for any change in how you feel.")).toHaveClass("hidden", "md:inline");
    expect(screen.getByRole("heading", { name: "Your summary" })).toBeInTheDocument();
    expect(screen.queryByText(/ready to share/i)).not.toBeInTheDocument();
  });

  it("keeps supporting copy and choice labels at the readable canonical scale", () => {
    render(
      <SymptomAssessmentPresentation stageId="related_details" modality="touch">
        <SymptomChoiceCard
          Icon={HeartPulse}
          label="It is mild, usual for me, and improving"
          onClick={() => undefined}
        />
      </SymptomAssessmentPresentation>,
    );

    expect(screen.getByText("Choose the pattern that fits best.")).toHaveClass(
      "max-w-[320px]",
      "text-[16px]",
    );
    expect(screen.getByRole("button", { name: /It is mild, usual for me, and improving/i })).toHaveClass(
      "min-h-[72px]",
      "py-3.5",
    );
    expect(screen.getByText("It is mild, usual for me, and improving")).toHaveClass(
      "text-[17px]",
      "leading-[1.42]",
    );
  });

  it("lets a full-bleed report own the single page heading", () => {
    render(
      <SymptomAssessmentPresentation
        stageId="save_share_summary"
        modality="touch"
        showTitle={false}
        fullBleedChildren
      >
        <h1>Your summary</h1>
      </SymptomAssessmentPresentation>,
    );

    expect(screen.getAllByRole("heading", { name: "Your summary" })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Your summary" })).toBeVisible();
  });
});
