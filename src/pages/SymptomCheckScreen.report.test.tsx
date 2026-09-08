import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HOME_MASTER_THEME_STORAGE_KEY } from "@/hooks/useHomeMasterTheme";
import { ReportScreen } from "./SymptomCheckScreen";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string, values?: Record<string, unknown>) => {
        if (!fallback) return _key;
        return fallback.replace(/\{\{(\w+)\}\}/g, (_match, key) => String(values?.[key] ?? `{{${key}}}`));
      },
    }),
  };
});

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="route-state">{JSON.stringify(location.state)}</span>
    </>
  );
}

type ReportScreenProps = ComponentProps<typeof ReportScreen>;

const summary: ReportScreenProps["summary"] = {
  chiefComplaint: "Chest discomfort",
  symptoms: ["pressure"],
  urgency: "routine",
  recommendations: [],
  disclaimer: "This is not emergency medical care.",
  nextStepLabel: "Talk to a doctor today",
  nextStepLevel: "doctor_today",
  triageReasons: [],
  watchSigns: [],
};

function renderReport(
  profileContacts: { gpPhone?: string | null; gpEmail?: string | null } = {},
  options: {
    summaryOverride?: Partial<ReportScreenProps["summary"]>;
    emergencyContact?: { label: string; telHref?: string };
  } = {},
) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/health/symptom-check"]}>
      <LocationProbe />
      <ReportScreen
        summary={{ ...summary, ...options.summaryOverride }}
        bpm={null}
        respiratoryRate={null}
        durationSeconds={null}
        reportId="report-1"
        reportSaveState="saved"
        savedReport={null}
        profileContacts={profileContacts}
        careTeamMembers={[]}
        emergencyContact={options.emergencyContact ?? null}
        refinementStatus={{ state: "idle" }}
        onRefineVital={vi.fn(async () => undefined)}
        onDone={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("SymptomCheck report service actions", () => {
  it("uses the canonical summary heading and final report hierarchy", () => {
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "dark");
    renderReport();

    expect(screen.getAllByRole("heading", { level: 1, name: "Your summary" })).toHaveLength(1);
    expect(screen.queryByTestId("button-report-voice")).not.toBeInTheDocument();
    const reportOverview = screen.getByTestId("card-report-overview");
    expect(reportOverview).toHaveAttribute("data-approved-frame", "summary.share_or_save");
    expect(reportOverview.className).toContain("max-w-[330px]");
    expect(reportOverview.className).toContain("sm:max-w-[760px]");
    const reportAnswer = screen.getByTestId("card-report-answer");
    expect(reportAnswer).toHaveTextContent("Doctor today");
    expect(reportAnswer).toHaveAttribute("data-theme-surface", "canonical-dark");
    expect(reportAnswer).toHaveAttribute("data-recommendation-tone", "urgent");
    expect(reportAnswer).not.toHaveTextContent("VYVA has turned your answers into a simple plan below.");
    expect(screen.getByTestId("card-report-do-now")).toHaveTextContent("Talk to a doctor today");
    expect(screen.getByTestId("button-report-done")).toBeVisible();
  });

  it("puts an emergency call action on the live next step when an emergency number is known", () => {
    renderReport(
      {},
      {
        emergencyContact: { label: "112", telHref: "tel:112" },
        summaryOverride: {
          urgency: "urgent",
          nextStepLevel: "emergency",
          nextStepLabel: "Call emergency services now",
        },
      },
    );

    expect(screen.getByTestId("button-report-emergency")).toHaveTextContent("Call 112");
    expect(screen.queryByTestId("report-next-step-actions")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-report-emergency")).toHaveTextContent("Call 112 now");
    expect(screen.getByTestId("card-report-answer")).toHaveAttribute("data-recommendation-tone", "urgent");
  });

  it("uses amber for timely review recommendations", () => {
    renderReport({}, { summaryOverride: { urgency: "routine", nextStepLevel: "doctor_24_48" } });

    expect(screen.getByTestId("card-report-answer")).toHaveAttribute("data-recommendation-tone", "timely");
  });

  it("uses green for home-monitoring recommendations", () => {
    renderReport({}, { summaryOverride: { urgency: "self_care", nextStepLevel: "monitor" } });

    expect(screen.getByTestId("card-report-answer")).toHaveAttribute("data-recommendation-tone", "monitor");
  });

  it("keeps one direct GP primary action and one persistent report share action", () => {
    renderReport({
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
    });

    expect(screen.getByTestId("button-report-call-gp")).toHaveTextContent("Call GP");
    expect(screen.queryByTestId("report-next-step-actions")).not.toBeInTheDocument();
    expect(screen.getByTestId("link-report-share-doctor")).toHaveAttribute("href", expect.stringMatching(/^sms:/));
    expect(screen.getByTestId("button-report-share-footer")).toBeVisible();
    expect(screen.queryByTestId("report-result-details")).not.toBeInTheDocument();
  });

  it("opens doctor support directly when GP contact is missing", async () => {
    renderReport();

    expect(screen.getByTestId("button-report-doctor")).toHaveTextContent("Talk to doctor");
    expect(screen.queryByTestId("report-next-step-actions")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-report-doctor"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/health/doctor");
    });
  });

  it("routes practical hydration advice to a support package instead of a generic order", async () => {
    renderReport({}, {
      summaryOverride: {
        recommendations: ["Stay hydrated and drink fluids"],
      },
    });

    const packageAction = screen.getByTestId("button-report-support-online_order");
    expect(packageAction).toHaveTextContent("Get support package");

    fireEvent.click(packageAction);

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/shopping");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"packageId\":\"hydration_support\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"sourceRecommendation\":\"Stay hydrated and drink fluids\"");
    });
  });

  it("does not show a package action when fluids are part of a medical warning", () => {
    renderReport({}, {
      summaryOverride: {
        recommendations: ["Talk to a doctor today if symptoms worsen or fluids are difficult."],
      },
    });

    expect(screen.getByTestId("button-report-doctor")).toBeInTheDocument();
    expect(screen.queryByTestId("button-report-support-online_order")).not.toBeInTheDocument();
    expect(screen.queryByText("Get support package")).not.toBeInTheDocument();
  });

  it("shows a concise linear report without a secondary details dashboard", () => {
    renderReport({}, {
      summaryOverride: {
        recommendations: [
          "Drink water now",
          "Rest somewhere cool",
          "Call a doctor if symptoms worsen",
          "Write down any new symptoms",
        ],
        triageReasons: ["Symptoms were mild and stable."],
        watchSigns: ["Chest pain", "Confusion"],
        vitalsNotes: ["Heart Rate: 72 bpm"],
        evidenceSummary: "Checked trusted guidance.",
        contextConfidence: {
          score: 4,
          label: "Strong confidence",
          reasons: ["symptom described", "safety question answered"],
          missing: ["blood pressure"],
        },
        contextSignals: [
          { id: "bp", label: "Blood pressure", status: "missing" },
        ],
      },
    });

    expect(screen.queryByTestId("card-report-next-step-explainer")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-report-plan-details")).toHaveTextContent("Drink water now");
    expect(screen.getByTestId("card-report-plan-details")).toHaveTextContent("Rest somewhere cool");
    expect(screen.getByTestId("card-report-plan-details")).toHaveTextContent("Call a doctor if symptoms worsen");
    expect(screen.getByTestId("card-report-vitals-summary")).toHaveTextContent("Heart Rate: 72 bpm");
    expect(screen.getByTestId("card-report-actionable-uncertainty")).toHaveTextContent("blood pressure");
    expect(screen.queryByTestId("report-result-details")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-report-watch-highlight")).toHaveTextContent("Chest pain");
  });

  it("shows interpretation, possible situations, uncertainty, timing, and plan-change triggers", () => {
    renderReport({}, {
      summaryOverride: {
        interpretation: "The combined answers support monitoring for now. This is a pattern, not a diagnosis.",
        possiblePatterns: [{
          id: "activity_related",
          label: "Activity-related breathing pattern",
          explanation: "This can sometimes follow exertion or recovery.",
          supportingAnswers: ["Mild or only with activity"],
          clarifyingSigns: ["How quickly breathing returns to normal"],
        }],
        uncertainty: ["A questionnaire cannot confirm a cause."],
        reassessmentWindow: "Recheck in 24 hours.",
        changePlanTriggers: ["Breathing becomes difficult at rest."],
      },
    });

    const doNow = screen.getByTestId("card-report-do-now");
    const interpretation = screen.getByTestId("card-report-interpretation");
    expect(interpretation).toHaveTextContent("What your answers mean");
    expect(doNow.compareDocumentPosition(interpretation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const possibleSituations = screen.getByTestId("card-report-possible-patterns");
    const stepPlan = screen.getByTestId("card-report-plan-details");
    expect(possibleSituations).toHaveTextContent("Activity-related breathing pattern");
    expect(possibleSituations).toHaveTextContent("More consistent");
    expect(screen.getByText(/Based on:/).closest("p")).not.toBeVisible();
    fireEvent.click(screen.getByText("Why?"));
    expect(screen.getByText(/Based on:/).closest("p")).toBeVisible();
    expect(possibleSituations.compareDocumentPosition(stepPlan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stepPlan).toHaveTextContent("Practical actions for the next step");
    expect(screen.queryByTestId("report-uncertainty")).not.toBeInTheDocument();
    expect(screen.getByTestId("report-reassessment-window")).toHaveTextContent("Recheck in 24 hours");
    expect(screen.getByTestId("card-report-watch-highlight")).toHaveTextContent("Breathing becomes difficult at rest");
  });

  it("shows possible causes as secondary context for an emergency outcome", () => {
    renderReport({}, {
      summaryOverride: {
        urgency: "urgent",
        nextStepLevel: "emergency",
        nextStepLabel: "Call emergency services now",
        interpretation: "A warning sign is more important than identifying a cause online.",
        possiblePatterns: [{ id: "unsafe", label: "A cause", explanation: "Do not show", supportingAnswers: [], clarifyingSigns: [] }],
      },
    });

    expect(screen.getByTestId("card-report-interpretation")).toBeInTheDocument();
    expect(screen.queryByTestId("report-uncertainty")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-report-possible-patterns")).toBeInTheDocument();
  });

  it("does not reintroduce a details dashboard for a report that mentions a missing vital", () => {
    renderReport({}, {
      summaryOverride: {
        chiefComplaint: "Blood pressure feels high",
        symptoms: ["blood pressure"],
        triageReasons: ["Blood pressure was mentioned."],
      },
    });

    expect(screen.getByTestId("button-report-doctor")).toHaveTextContent("Talk to doctor");
    expect(screen.queryByText("A relevant reading can help VYVA update this assessment. Phone estimates are useful for trends; device or manual readings are stronger evidence.")).not.toBeInTheDocument();
    expect(screen.queryByTestId("report-result-details")).not.toBeInTheDocument();
  });
});
