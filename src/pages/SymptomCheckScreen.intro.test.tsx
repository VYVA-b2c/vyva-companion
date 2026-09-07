import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AssessmentConfidenceTracker,
  IntroScreen,
  SymptomWarningSignsPreviewScreen,
  VoiceTriageLivePanel,
  symptomAssessmentStageForRuntime,
  symptomCheckHealthReturnPath,
} from "./SymptomCheckScreen";
import type { TriagePersonalizedSuggestion } from "@/triage";

const { apiFetchMock, markCompletedMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  markCompletedMock: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location-path">{location.pathname}</span>;
}

vi.mock("@/lib/queryClient", () => ({
  apiFetch: apiFetchMock,
  queryClient: {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  },
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ isLoading: false }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    language: "en",
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useHomeFastHelpOutcome", () => ({
  useHomeFastHelpOutcome: () => ({
    markCompleted: markCompletedMock,
    markAbandoned: vi.fn(),
    markBlocked: vi.fn(),
  }),
}));

vi.mock("@/components/TriageChat", () => ({
  default: ({
    onStageChange,
    onComplete,
  }: {
    onStageChange?: (stage: string, urgent?: boolean) => void;
    onComplete: (summary: Record<string, unknown>) => void;
  }) => (
    <div data-testid="mock-triage-runtime">
      {[
        ["red_flag", false],
        ["red_flag", true],
        ["symptom", false],
        ["severity", false],
        ["duration", false],
        ["trend", false],
        ["support", false],
        ["checking", false],
        ["complete", false],
      ].map(([stage, urgent]) => (
        <button
          key={`${stage}-${urgent}`}
          type="button"
          data-testid={`runtime-${stage}-${urgent ? "urgent" : "normal"}`}
          onClick={() => onStageChange?.(String(stage), Boolean(urgent))}
        >
          {String(stage)}
        </button>
      ))}
      <button
        type="button"
        data-testid="runtime-finish"
        onClick={() => onComplete({
          chiefComplaint: "Headache",
          symptoms: ["headache"],
          urgency: "monitor",
          recommendations: ["Rest and monitor"],
          disclaimer: "Not a diagnosis",
        })}
      >
        finish
      </button>
    </div>
  ),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
  };
});

describe("SymptomCheck intro chips", () => {
  it("returns report completion to the matching My Health route", () => {
    expect(symptomCheckHealthReturnPath("/dev/home-master/ask-dr-ai")).toBe("/dev/home-master/health");
    expect(symptomCheckHealthReturnPath("/health/symptom-check")).toBe("/health");
  });

  it("presents warning signs as readable single-column choices without a false selected state", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SymptomWarningSignsPreviewScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Ask Dr. AI" })).toBeInTheDocument();
    expect(screen.getByTestId("voice-triage-choice-grid-safety_check")).toHaveClass("grid-cols-1");

    const warningChoice = screen.getByTestId("voice-triage-choice-one_sided_weakness");
    expect(warningChoice).toHaveClass("symptom-canonical-choice", "w-full", "rounded-[18px]", "bg-[#3A242E]", "text-left");
    expect(warningChoice).toHaveAttribute("data-safety-tone", "warning");
    expect(warningChoice).not.toHaveClass("bg-[#7024C4]");

    const noWarningChoice = screen.getByTestId("voice-triage-choice-no_red_flag");
    expect(noWarningChoice).toHaveTextContent("No, none of these");
    expect(noWarningChoice).toHaveAttribute("data-safety-tone", "clear");
  });

  it("maps the live triage runtime onto symptom-assessment presentation stages", () => {
    expect(symptomAssessmentStageForRuntime(undefined)).toBe("describe");
    expect(symptomAssessmentStageForRuntime("red_flag")).toBe("safety_check");
    expect(symptomAssessmentStageForRuntime("red_flag", true)).toBe("urgent_escalation");
    expect(symptomAssessmentStageForRuntime("symptom")).toBe("symptom_selection");
    expect(symptomAssessmentStageForRuntime("location")).toBe("symptom_selection");
    expect(symptomAssessmentStageForRuntime("severity")).toBe("severity");
    expect(symptomAssessmentStageForRuntime("duration")).toBe("onset");
    expect(symptomAssessmentStageForRuntime("trend")).toBe("related_details");
    expect(symptomAssessmentStageForRuntime("support")).toBe("review");
    expect(symptomAssessmentStageForRuntime("checking")).toBe("checking");
    expect(symptomAssessmentStageForRuntime("complete")).toBe("safest_next_step");
  });

  it("keeps numeric voice severity focused on the scale without a competing text composer", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <VoiceTriageLivePanel
          session={{
            conversation_id: "voice-severity",
            status: "active",
            latest_response: {
              status: "active",
              question: {
                stage: "severity",
                text: "Quelle est son intensité ?",
                choices: Array.from({ length: 11 }, (_, value) => ({
                  id: `severity-${value}`,
                  spoken_label: String(value),
                  value: String(value),
                })),
              },
            },
          }}
          stageId="severity"
          modality="voice"
          onAnswer={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("symptom-severity-scale")).toHaveAttribute(
      "data-visual-layout",
      "embedded",
    );
    expect(screen.getByTestId("symptom-severity-continue")).toBeVisible();
    expect(screen.queryByTestId("voice-triage-typed-composer")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("retains the typed fallback for open voice questions", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <VoiceTriageLivePanel
          session={{
            conversation_id: "voice-onset",
            status: "active",
            latest_response: {
              status: "active",
              question: {
                stage: "duration",
                text: "When did it start?",
                choices: [],
              },
            },
          }}
          stageId="onset"
          modality="voice"
          onAnswer={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("voice-triage-typed-composer")).toBeVisible();
    expect(screen.getByRole("textbox")).toBeVisible();
  });

  afterEach(() => {
    vi.useRealTimers();
    apiFetchMock.mockReset();
    markCompletedMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  const profileSuggestions: TriagePersonalizedSuggestion[] = [
    {
      id: "heart-chest-pressure",
      kind: "common_concern",
      label: "Chest pressure or tightness",
      description: "VYVA will check warning signs first.",
      initialClue: "Chest pressure or tightness",
      tone: "red",
      icon: "heart",
      source: "profile",
      priority: 99,
      reasonCode: "condition_match",
      score: 3430,
    },
    {
      id: "heart-bp-check",
      kind: "health_improvement",
      label: "Blood pressure check",
      description: "Add a BP reading before deciding next steps.",
      route: "/health/vitals",
      tone: "blue",
      icon: "gauge",
      source: "profile",
      priority: 90,
      reasonCode: "condition_match",
      score: 3421,
    },
  ];

  const completedVoiceSummary = {
    chiefComplaint: "Breathing feels different",
    symptoms: ["Shortness of breath"],
    urgency: "monitor" as const,
    recommendations: ["Rest and monitor your breathing"],
    disclaimer: "This is not a diagnosis.",
    aiSummary: "Your answers support monitoring at home.",
    nextStepLabel: "Monitor at home",
    nextStepLevel: "monitor" as const,
    triageReasons: ["Symptoms are mild and improving."],
    watchSigns: ["Breathing becomes difficult at rest."],
    profileConsiderations: [],
    vitalsNotes: [],
  };

  const renderVoiceSessionScreen = async (session: Record<string, unknown>, reportResponse?: Record<string, unknown>) => {
    const { default: SymptomCheckScreen } = await import("./SymptomCheckScreen");
    window.sessionStorage.setItem("vyva.voice.sessionId", "voice-complete-1");
    apiFetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/config/features/dr-ai-voice") {
        return { ok: true, status: 200, json: async () => ({ enabled: true, mode: "active" }) };
      }
      if (url === "/api/voice-triage/session/voice-complete-1") {
        return { ok: true, status: 200, json: async () => session };
      }
      if (url === "/api/reports/triage/report-voice-1" && reportResponse) {
        return { ok: true, status: 200, json: async () => reportResponse };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, queryFn: async () => ({}) },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dev/home-master/ask-dr-ai?lang=fr"]}>
          <LocationProbe />
          <SymptomCheckScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it("opens the corresponding saved report when voice evaluation completes", async () => {
    await renderVoiceSessionScreen({
      conversation_id: "voice-complete-1",
      status: "complete",
      triage_report_id: "report-voice-1",
      latest_response: {
        ok: true,
        status: "complete",
        spoken_text: "Your report is ready.",
        summary: completedVoiceSummary,
        report: { triage_report_id: "report-voice-1" },
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/informes/report-voice-1");
    });
    await waitFor(() => expect(markCompletedMock).toHaveBeenCalledTimes(1));
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/reports/triage/report-voice-1");
  });

  it("opens the saved report route when the embedded voice summary is missing", async () => {
    await renderVoiceSessionScreen({
      conversation_id: "voice-complete-1",
      status: "complete",
      triage_report_id: "report-voice-1",
      latest_response: {
        ok: true,
        status: "complete",
        spoken_text: "Your report is ready.",
        report: { triage_report_id: "report-voice-1" },
      },
    }, {
      id: "report-voice-1",
      chief_complaint: "Dizziness after standing",
      symptoms: ["Dizziness"],
      urgency: "routine",
      recommendations: ["Arrange a clinician review"],
      disclaimer: "This is not a diagnosis.",
      next_step_label: "Talk to a doctor within 24-48 hours",
      next_step_level: "doctor_24_48",
      triage_reasons: ["The symptom is continuing."],
      watch_signs: ["Fainting or new weakness."],
      profile_considerations: [],
      vitals_notes: [],
      bpm: null,
      respiratory_rate: null,
      duration_seconds: 95,
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/informes/report-voice-1");
    });
  });

  it("keeps a stable completion screen when the saved voice report cannot be loaded", async () => {
    await renderVoiceSessionScreen({
      conversation_id: "voice-complete-1",
      status: "complete",
      latest_response: {
        ok: true,
        status: "complete",
        spoken_text: "Your report is ready.",
      },
    });

    await waitFor(
      () => expect(screen.getByTestId("button-retry-voice-report")).toBeVisible(),
      { timeout: 3_500 },
    );
    expect(screen.getByTestId("voice-report-complete-fallback")).toHaveTextContent("Your check is complete");
    expect(screen.getByTestId("button-open-saved-voice-report")).toBeVisible();
    expect(screen.queryByTestId("voice-triage-live-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("symptom-check-intro")).not.toBeInTheDocument();
  });

  it("clears the terminal voice-session reference when it opens the report", async () => {
    await renderVoiceSessionScreen({
      conversation_id: "voice-complete-1",
      status: "complete",
      triage_report_id: "report-voice-1",
      latest_response: {
        ok: true,
        status: "complete",
        summary: completedVoiceSummary,
        report: { triage_report_id: "report-voice-1" },
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/informes/report-voice-1");
    });
    expect(window.sessionStorage.getItem("vyva.voice.sessionId")).toBeNull();
  });

  it("leaves emergency voice completion on the emergency panel", async () => {
    await renderVoiceSessionScreen({
      conversation_id: "voice-complete-1",
      status: "emergency",
      latest_response: {
        ok: true,
        status: "emergency",
        spoken_text: "Call emergency services now.",
        emergencyContact: { label: "112", telHref: "tel:112" },
        action_options: [{ id: "call_emergency", kind: "call_emergency", label: "Call 112 now", tel_href: "tel:112" }],
      },
    });

    expect(await screen.findByTestId("voice-triage-live-panel")).toHaveTextContent("Call emergency services now.");
    expect(screen.queryByTestId("symptom-check-report")).not.toBeInTheDocument();
  });

  it("exposes all 11 ordered runtime presentation identities on the real screen", async () => {
    const { default: SymptomCheckScreen } = await import("./SymptomCheckScreen");
    apiFetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/reports/triage") {
        return { ok: true, json: async () => ({ id: "report-11" }) };
      }
      if (url === "/api/symptoms/log") return { ok: true, json: async () => ({}) };
      return { ok: true, json: async () => ({}) };
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, queryFn: async () => ({}) },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/health/symptom-check"]}>
          <LocationProbe />
          <SymptomCheckScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const shell = screen.getByTestId("symptom-check-shell");
    const expectStage = (stageId: string) => {
      expect(shell).toHaveAttribute("data-flow-id", "health.symptom_assessment");
      expect(shell).toHaveAttribute("data-stage-id", stageId);
      expect(shell).toHaveAttribute("data-voice-presentation-id", `health.symptom_assessment.${stageId}.voice`);
      expect(shell).toHaveAttribute("data-touch-presentation-id", `health.symptom_assessment.${stageId}.touch`);
    };

    expectStage("describe");
    fireEvent.click(screen.getByRole("button", { name: "Continue to Ask Dr. AI" }));
    fireEvent.click(screen.getByTestId("button-symptom-example-0"));

    await screen.findByTestId("mock-triage-runtime");
    fireEvent.click(screen.getByTestId("runtime-red_flag-normal"));
    expectStage("safety_check");
    fireEvent.click(screen.getByTestId("runtime-red_flag-urgent"));
    expectStage("urgent_escalation");
    fireEvent.click(screen.getByTestId("runtime-symptom-normal"));
    expectStage("symptom_selection");
    fireEvent.click(screen.getByTestId("runtime-severity-normal"));
    expectStage("severity");
    fireEvent.click(screen.getByTestId("runtime-duration-normal"));
    expectStage("onset");
    fireEvent.click(screen.getByTestId("runtime-trend-normal"));
    expectStage("related_details");
    fireEvent.click(screen.getByTestId("runtime-support-normal"));
    expectStage("review");
    fireEvent.click(screen.getByTestId("runtime-checking-normal"));
    expectStage("checking");
    fireEvent.click(screen.getByTestId("runtime-complete-normal"));
    expectStage("safest_next_step");
    fireEvent.click(screen.getByTestId("runtime-finish"));
    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/informes/report-11");
    });
  });

  it("shows a dynamic confidence tracker instead of a plain progress bar", () => {
    const { rerender } = render(<AssessmentConfidenceTracker current="chat" variant="compact" />);

    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Confidence");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Confidence improving");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Medium");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Symptoms");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Safety check");
    expect(screen.getByRole("meter", { name: "Confidence level" })).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByTestId("assessment-confidence-signals")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    rerender(<AssessmentConfidenceTracker current="report" />);

    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Ready to guide");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("High");
    expect(screen.getByRole("meter", { name: "Confidence level" })).toHaveAttribute("aria-valuenow", "5");
  });

  it("renders one senior-friendly start panel", () => {
    render(<IntroScreen onStart={vi.fn()} />);

    expect(screen.getByTestId("symptom-emergency-modal")).toHaveTextContent("Do not wait in an emergency");
    expect(screen.queryByRole("button", { name: "Help me decide" })).not.toBeInTheDocument();
    expect(screen.getByTestId("symptom-check-start-panel")).toHaveTextContent("Choose what feels different");
    expect(screen.getByTestId("symptom-check-start-panel")).toHaveTextContent("What feels different today?");
    expect(screen.queryByTestId("input-symptom-clue")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-symptom-check-start")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type your symptoms" })).toBeVisible();
    expect(screen.getByRole("button", { name: "More examples" })).toBeVisible();
    expect(screen.queryByTestId("symptom-example-group-label")).not.toBeInTheDocument();
    expect(screen.queryByText("Choose the closest option.")).not.toBeInTheDocument();
    expect(screen.queryByText("Examples")).not.toBeInTheDocument();
    expect(screen.queryByText("How VYVA helps")).not.toBeInTheDocument();
    expect(screen.queryByTestId("symptom-check-one-question-note")).not.toBeInTheDocument();
    expect(screen.queryByText("One question at a time")).not.toBeInTheDocument();
    expect(screen.queryByText("Profile tuned")).not.toBeInTheDocument();
    expect(screen.queryByText("Common concerns from your profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Ways to improve health")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/button-symptom-example-/)).toHaveLength(3);
  });

  it("uses semantic VYVA library accents for the symptom entry icons", () => {
    render(<IntroScreen onStart={vi.fn()} personalizedSuggestions={[]} />);

    expect(screen.getByRole("button", { name: /Breathing feels different/i })
      .querySelector("[data-vyva-accent]"))
      .toHaveAttribute("data-vyva-accent", "signal");
    expect(screen.getByRole("button", { name: /Pain or headache/i })
      .querySelector("[data-vyva-accent]"))
      .toHaveAttribute("data-vyva-accent", "pulse");
    expect(screen.getByRole("button", { name: /Dizzy or weak/i })
      .querySelector("[data-vyva-accent]"))
      .toHaveAttribute("data-vyva-accent", "pulse");
    expect(screen.getByRole("button", { name: "Type your symptoms" })
      .querySelector("[data-vyva-accent]"))
      .toHaveAttribute("data-vyva-accent", "knobs");
    expect(screen.getByRole("button", { name: "More examples" })
      .querySelector("[data-vyva-accent]"))
      .toHaveAttribute("data-vyva-accent", "spark");
  });

  it("dismisses the emergency modal before the symptom check", () => {
    render(<IntroScreen onStart={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue to Ask Dr. AI" }));

    expect(screen.queryByTestId("symptom-emergency-modal")).not.toBeInTheDocument();
    expect(screen.getByTestId("symptom-check-example-chips")).toBeVisible();
    expect(screen.queryByTestId("input-symptom-clue")).not.toBeInTheDocument();
  });

  it("keeps the emergency acknowledgement when the intro remounts for voice mode", () => {
    const onEmergencyModalDismiss = vi.fn();
    const { rerender } = render(
      <IntroScreen
        key="touch"
        onStart={vi.fn()}
        showEmergencyModal
        onEmergencyModalDismiss={onEmergencyModalDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue to Ask Dr. AI" }));
    expect(onEmergencyModalDismiss).toHaveBeenCalledTimes(1);

    rerender(
      <IntroScreen
        key="voice"
        onStart={vi.fn()}
        showEmergencyModal={false}
        onEmergencyModalDismiss={onEmergencyModalDismiss}
      />,
    );

    expect(screen.queryByTestId("symptom-emergency-modal")).not.toBeInTheDocument();
  });

  it("does not show the emergency modal again when Ask Dr. AI switches to voice", async () => {
    const { default: SymptomCheckScreen } = await import("./SymptomCheckScreen");
    window.localStorage.clear();
    window.sessionStorage.clear();
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, mode: "active" }),
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, queryFn: async () => ({}) },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/health/symptom-check?fresh=1"]}>
          <SymptomCheckScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue to Ask Dr. AI" }));
    expect(screen.queryByTestId("symptom-emergency-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch to voice mode" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Switch to touch mode" })).toBeInTheDocument());
    expect(screen.queryByTestId("symptom-emergency-modal")).not.toBeInTheDocument();
  });

  it("keeps the canonical symptom choices instead of showing the legacy voice describe panel", () => {
    const onAnswer = vi.fn();

    render(
      <MemoryRouter>
        <VoiceTriageLivePanel
          session={{
            conversation_id: "voice-describe",
            status: "active",
            latest_response: {
              ok: true,
              status: "active",
              spoken_text: "Tell VYVA what has changed today.",
              question: { stage: "start", text: "Tell VYVA what has changed today.", choices: [] },
            },
          }}
          stageId="describe"
          modality="voice"
          onAnswer={onAnswer}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("symptom-check-intro")).toBeVisible();
    expect(screen.getByText("What feels different today?")).toBeVisible();
    expect(screen.getByRole("button", { name: /Breathing feels different/i })).toBeEnabled();
    expect(screen.queryByTestId("voice-triage-live-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Breathing feels different/i }));
    expect(onAnswer).toHaveBeenCalledWith({ utterance: "Breathing feels different" });
  });

  it("shows the canonical answer summary on the voice review screen", () => {
    render(
      <MemoryRouter>
        <VoiceTriageLivePanel
          session={{
            conversation_id: "voice-review",
            status: "active",
            latest_response: {
              ok: true,
              status: "active",
              spoken_text: "Does this look right?",
              question: {
                stage: "support",
                text: "Does this look right?",
                reason: "Review before guidance.",
                choices: [
                  { id: "edit_answers", spoken_label: "Edit", value: "Edit my answers." },
                  { id: "confirm_review", spoken_label: "Yes, show my guidance", value: "Show my guidance." },
                ],
              },
              review_answers: [
                { id: "breathing", label: "Breathing feels different", value: "Breathing feels different", kind: "symptom" },
                { id: "severity_5", label: "5", value: "5 out of 10", kind: "severity" },
                { id: "few_days", label: "Few days", value: "It started a few days ago", kind: "duration" },
                { id: "mild_improving", label: "Mild and improving", value: "It is mild and improving", kind: "trend" },
              ],
            },
          }}
          stageId="review"
          modality="voice"
          onAnswer={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("symptom-scene-review")).toHaveTextContent("Breathing feels different");
    expect(screen.getByTestId("symptom-scene-review")).toHaveTextContent("5 / 10");
    expect(screen.getByTestId("symptom-scene-review")).toHaveTextContent("Few days");
    expect(screen.queryByPlaceholderText("Or type your answer...")).not.toBeInTheDocument();
    expect(screen.queryByText("Why VYVA is asking this")).not.toBeInTheDocument();
  });

  it("offers inline camera capture, manual readings, and a one-time skip for useful vitals", () => {
    const onAnswer = vi.fn();
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ readings: [], signals: [], devices: [] }),
    });
    render(
      <MemoryRouter>
        <VoiceTriageLivePanel
          session={{
            conversation_id: "voice-vitals",
            status: "active",
            latest_response: {
              ok: true,
              status: "active",
              spoken_text: "How strong is it?",
              question: { stage: "severity", text: "How strong is it?", choices: [] },
              vitals_prompt: {
                title: "A quick vital-sign check could help",
                body: "Use your phone camera, enter a device reading, or skip this.",
                actions: [{ id: "oxygen", label: "Oxygen", value: "oxygen" }],
                camera_action: { id: "use_camera", label: "Use camera for heart and breathing", route: "/health/vitals" },
                manual_action: { id: "enter_reading", label: "Enter a device reading" },
                skip_action: { id: "skip_vitals", label: "Skip for now" },
              },
            },
          }}
          stageId="severity"
          modality="voice"
          onAnswer={onAnswer}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use camera for heart and breathing" }));
    expect(screen.getByTestId("voice-triage-vitals-capture")).toBeVisible();
    expect(screen.getByRole("button", { name: "Enter a device reading" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(onAnswer).toHaveBeenCalledWith({ choiceId: "skip_vitals", utterance: "Skip vitals for now" });
  });

  it("leaves the single voice entry point to the shared Home header", () => {
    const onTalkToVyva = vi.fn();
    render(<IntroScreen onStart={vi.fn()} onTalkToVyva={onTalkToVyva} />);

    expect(screen.queryByRole("button", { name: "Use Voice mode" })).not.toBeInTheDocument();
    expect(onTalkToVyva).not.toHaveBeenCalled();
    expect(screen.queryByTestId("button-symptom-clue-voice")).not.toBeInTheDocument();
  });

  it("shows profile-aware examples and keeps extra ideas collapsed", () => {
    render(
      <IntroScreen
        onStart={vi.fn()}
        personalizedSuggestions={profileSuggestions}
        profileContextItems={["medications", "latest vitals"]}
      />,
    );

    expect(screen.getByRole("button", { name: /Chest pressure or tightness/i })).toBeVisible();
    expect(screen.queryByTestId("symptom-example-group-label")).not.toBeInTheDocument();
    expect(screen.getAllByText("Based on profile").length).toBeGreaterThan(0);
    expect(screen.getByText("More symptoms")).toBeVisible();
    expect(screen.getByRole("button", { name: /Blood pressure check/i })).not.toBeVisible();

    fireEvent.click(screen.getByText("More symptoms"));

    expect(screen.getByRole("button", { name: /Blood pressure check/i })).toBeVisible();
    expect(screen.getByText("Profile tuned")).toBeVisible();
    expect(screen.queryByText("condition_match")).not.toBeInTheDocument();
    expect(screen.queryByText("3430")).not.toBeInTheDocument();
  });

  it("starts immediately from a suggested concern", () => {
    const onStart = vi.fn();
    render(<IntroScreen onStart={onStart} personalizedSuggestions={profileSuggestions} />);

    fireEvent.click(screen.getByRole("button", { name: /Chest pressure or tightness/i }));

    expect(onStart).toHaveBeenCalledWith("Chest pressure or tightness");
  });

  it("opens a dedicated full-page writing surface when the user prefers to type", () => {
    const onStart = vi.fn();
    render(<IntroScreen onStart={onStart} />);

    expect(screen.queryByTestId("input-symptom-clue")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Type your symptoms" }));

    const input = screen.getByTestId("input-symptom-clue");
    expect(input).toBeVisible();
    expect(screen.getByTestId("symptom-custom-input")).toBeVisible();
    expect(screen.getByRole("button", { name: "Back to options" })).toBeVisible();
    expect(screen.queryByTestId("symptom-check-example-chips")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Aching back" } });
    fireEvent.click(screen.getByRole("button", { name: "Start check" }));

    expect(onStart).toHaveBeenCalledWith("Aching back");
  });

  it("fills the symptom input from the voice transcription button", async () => {
    const trackStop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: trackStop }],
    });

    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      mimeType = "audio/webm";
      state: RecordingState = "inactive";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["symptom voice audio content with enough bytes"], { type: "audio/webm" }),
        } as BlobEvent);
        this.onstop?.(new Event("stop"));
      }
    }

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({ transcript: "bad headache" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    render(<IntroScreen onStart={vi.fn()} />);

    const voiceButton = screen.getByTestId("button-symptom-clue-voice");
    fireEvent.click(voiceButton);

    expect(await screen.findByText("Listening... tap again to stop. It stops after 30 seconds.")).toBeVisible();

    fireEvent.click(voiceButton);

    await waitFor(() => {
      expect(screen.getByTestId("input-symptom-clue")).toHaveValue("bad headache");
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/triage/transcribe?language=en", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
    }));
    expect(trackStop).toHaveBeenCalled();
  });

  it("automatically stops voice capture after the safety limit", async () => {
    vi.useFakeTimers();
    const trackStop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: trackStop }],
    });
    const recorderStop = vi.fn();

    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      mimeType = "audio/webm";
      state: RecordingState = "inactive";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: ((event: Event) => void) | null = null;

      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}

      start() {
        this.state = "recording";
      }

      stop() {
        recorderStop();
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["automatic stop voice audio content with enough bytes"], { type: "audio/webm" }),
        } as BlobEvent);
        this.onstop?.(new Event("stop"));
      }
    }

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({ transcript: "aching back" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    render(<IntroScreen onStart={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-symptom-clue-voice"));
      await Promise.resolve();
    });
    expect(screen.getByText("Listening... tap again to stop. It stops after 30 seconds.")).toBeVisible();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(recorderStop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("input-symptom-clue")).toHaveValue("aching back");
    expect(trackStop).toHaveBeenCalled();
  });

  it("opens support routes from improvement chips", () => {
    const onNavigate = vi.fn();
    render(<IntroScreen onStart={vi.fn()} onNavigate={onNavigate} personalizedSuggestions={profileSuggestions} />);

    fireEvent.click(screen.getByText("More symptoms"));
    fireEvent.click(screen.getByRole("button", { name: /Blood pressure check/i }));

    expect(onNavigate).toHaveBeenCalledWith("/health/vitals");
  });

  it("shows three fallback example chips and moves other ideas behind disclosure", () => {
    render(<IntroScreen onStart={vi.fn()} personalizedSuggestions={[]} />);

    expect(screen.queryByText("Helpful starts")).not.toBeInTheDocument();
    expect(screen.queryByText("Common concerns to start with")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/button-symptom-example-/)).toHaveLength(3);
    expect(screen.queryByTestId("symptom-example-group-label")).not.toBeInTheDocument();
    expect(screen.queryByText("Based on profile")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Breathing feels different/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Dizzy or weak/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Check vitals/i })).not.toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "More examples" }));

    expect(screen.getByRole("button", { name: /Stomach or nausea/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Fever or chills/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Skin change or swelling/i })).toBeVisible();
    expect(screen.getByTestId("symptom-check-example-chips")).not.toHaveTextContent("Breathing feels different");

    fireEvent.click(screen.getByText("More symptoms"));

    expect(screen.getByRole("button", { name: /Check vitals/i })).toBeVisible();
  });

  it("starts the assessment from an expanded fallback symptom", () => {
    const onStart = vi.fn();
    render(<IntroScreen onStart={onStart} personalizedSuggestions={[]} />);

    fireEvent.click(screen.getByText("More symptoms"));
    fireEvent.click(screen.getByRole("button", { name: /Stomach or nausea/i }));

    expect(onStart).toHaveBeenCalledWith("Stomach discomfort or nausea");
  });
});
