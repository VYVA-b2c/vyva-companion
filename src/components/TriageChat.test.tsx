import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TriageChat, { stepBackTriageDraft, type TriageChatDraft } from "./TriageChat";
import { apiFetch } from "@/lib/queryClient";
import { setLanguage } from "@/i18n";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/imageCompression", () => ({
  compressImageFile: vi.fn(async () => "data:image/jpeg;base64,dGlueSB0ZXN0IGltYWdlIHBheWxvYWQ="),
}));

const apiFetchMock = vi.mocked(apiFetch);

const quickReplies = [
  { id: "no_red_flag", label: "No warning signs", value: "No warning signs.", icon: "help", tone: "green", kind: "red_flag" },
];

const dizzinessGuidancePlan = {
  protocolId: "dizziness",
  protocolLabel: "Dizziness and faintness",
  stage: "severity",
  priorityLabel: "Profile-aware",
  nextQuestionFocus: "Checking whether dizziness is strong enough to make standing or walking unsafe.",
  confidence: {
    score: 4,
    label: "Strong confidence",
    reasons: ["symptom described", "safety question answered", "health profile considered"],
    missing: ["optional useful reading"],
  },
  profileContextUsed: true,
  usefulSignals: [
    { id: "pulse", label: "Pulse", status: "missing" },
    { id: "blood_pressure", label: "Blood pressure", status: "missing" },
  ],
};

const manyQuickReplies = [
  { id: "answer-1", label: "First answer", value: "First answer.", icon: "help", tone: "green", kind: "choice" },
  { id: "answer-2", label: "Second answer", value: "Second answer.", icon: "help", tone: "green", kind: "choice" },
  { id: "answer-3", label: "Third answer", value: "Third answer.", icon: "help", tone: "green", kind: "choice" },
  { id: "answer-4", label: "Fourth answer", value: "Fourth answer.", icon: "help", tone: "green", kind: "choice" },
  { id: "answer-5", label: "Fifth answer", value: "Fifth answer.", icon: "help", tone: "green", kind: "choice" },
  { id: "answer-6", label: "Sixth answer", value: "Sixth answer.", icon: "help", tone: "green", kind: "choice" },
];

function triageResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function renderTriageChat(props: Partial<ComponentProps<typeof TriageChat>> = {}) {
  let result: ReturnType<typeof render>;

  await act(async () => {
    result = render(
      <TriageChat
        bpm={null}
        respiratoryRate={null}
        entryMode="without_vitals"
        initialClue="Feeling anxious"
        onComplete={vi.fn()}
        {...props}
      />,
    );
    await Promise.resolve();
  });

  return result!;
}

describe("TriageChat MediSearch follow-ups", () => {
  afterEach(() => {
    cleanup();
    apiFetchMock.mockReset();
    setLanguage("en");
    vi.useRealTimers();
  });

  it("sends the selected app language to the triage service", async () => {
    setLanguage("es");
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "Bien",
      quickReplies: [],
      evidenceSources: [],
    }));

    await renderTriageChat();

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse((apiFetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(request.locale).toBe("es");
    await screen.findByText("Bien");
  });

  it("waits for the app language before starting the triage request", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "Bien",
      quickReplies: [],
      evidenceSources: [],
    }));

    const { rerender } = await renderTriageChat({ language: "es", languageReady: false });

    await screen.findByTestId("triage-review-panel");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apiFetchMock).not.toHaveBeenCalled();

    await act(async () => {
      rerender(
        <TriageChat
          bpm={null}
          respiratoryRate={null}
          entryMode="without_vitals"
          initialClue="Feeling anxious"
          language="es"
          languageReady
          onComplete={vi.fn()}
        />,
      );
    });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse((apiFetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(request.locale).toBe("es");
    await screen.findByText("Bien");
  });

  it("obeys the registry composer contract", async () => {
    await renderTriageChat({ languageReady: false, composerVisibility: "hidden" });

    expect(screen.queryByTestId("input-triage-message")).not.toBeInTheDocument();
  });

  it("renders the canonical checking scene while the triage request is pending", async () => {
    apiFetchMock.mockImplementationOnce(() => new Promise<Response>(() => undefined));

    await renderTriageChat({
      presentationStage: "checking",
      composerVisibility: "hidden",
    });

    expect(await screen.findByTestId("symptom-presentation-checking-touch")).toBeVisible();
    expect(screen.getByTestId("symptom-scene-progress")).toBeVisible();
    expect(screen.queryByTestId("triage-review-panel")).not.toBeInTheDocument();
  });

  it("rotates the review headline through VYVA thinking steps", async () => {
    vi.useFakeTimers();

    await renderTriageChat({ languageReady: false });

    expect(screen.getByTestId("triage-review-headline")).toHaveTextContent("Checking your next step");

    act(() => {
      vi.advanceTimersByTime(2200);
    });

    expect(screen.getByTestId("triage-review-headline")).toHaveTextContent("Reviewing trusted medical guidance");

    act(() => {
      vi.advanceTimersByTime(2200);
    });

    expect(screen.getByTestId("triage-review-headline")).toHaveTextContent("Checking your answers for red flags");
  });

  it("renders follow-up chips below the primary answer tiles", async () => {
    apiFetchMock.mockResolvedValue(triageResponse({
      role: "assistant",
      content: "Q?",
      done: false,
      quickReplies,
      wizardStage: "red_flag",
      wizardStageLabel: "Safety check",
      medicalFollowups: ["Could caffeine make anxiety worse?"],
      medisearchConversationId: "conversation-1",
    }));

    await renderTriageChat();

    await waitFor(() => {
      expect(screen.getByTestId("triage-quick-answers")).toBeInTheDocument();
      expect(screen.getByTestId("triage-medical-followups")).toBeInTheDocument();
    });

    const primaryTiles = screen.getByTestId("triage-quick-answers");
    const followups = screen.getByTestId("triage-medical-followups");
    expect(primaryTiles.compareDocumentPosition(followups) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Useful follow-up questions")).toBeInTheDocument();
    expect(screen.getByTestId("triage-medical-followup-0")).not.toBeVisible();

    fireEvent.click(screen.getByText("Useful follow-up questions"));

    expect(screen.getByText("Could caffeine make anxiety worse?")).toBeVisible();
  });

  it("uses readable stacked safety cards without a false selected state", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "Are any warning signs present?",
      done: false,
      quickReplies: [
        { id: "cannot_speak", label: "Gasping or cannot speak", value: "I am gasping or cannot speak.", icon: "help", tone: "red", kind: "red_flag" },
        { id: "worse_but_speaking", label: "Worse than usual, but I can speak", value: "Breathing is worse than usual.", icon: "activity", tone: "amber", kind: "red_flag" },
        { id: "walking_only", label: "Mild or only with activity", value: "It is mild or only with activity.", icon: "help", tone: "green", kind: "red_flag" },
        { id: "no_red_flag", label: "No, none of these", value: "No warning signs.", icon: "help", tone: "green", kind: "red_flag" },
      ],
      evidenceSources: [],
    }));

    await renderTriageChat({
      presentationStage: "safety_check",
      composerVisibility: "hidden",
    });

    const warningChoice = await screen.findByRole("button", { name: "Gasping or cannot speak" });
    const cautionChoice = screen.getByRole("button", { name: "Worse than usual, but I can speak" });
    const mildChoice = screen.getByRole("button", { name: "Mild or only with activity" });
    const clearChoice = screen.getByRole("button", { name: "No, none of these" });

    expect(warningChoice).toHaveClass("symptom-canonical-choice", "w-full", "rounded-[18px]", "bg-[#3A242E]", "text-left");
    expect(warningChoice).toHaveAttribute("data-safety-tone", "warning");
    expect(cautionChoice).toHaveAttribute("data-safety-tone", "caution");
    expect(mildChoice).toHaveAttribute("data-safety-tone", "clear");
    expect(clearChoice).toHaveAttribute("data-safety-tone", "clear");
    expect(clearChoice).not.toHaveClass("bg-[#7024C4]");
    expect(warningChoice.querySelector('[data-vyva-accent="signal"]')).toBeInTheDocument();
  });

  it("recovers from a failed triage request with saved answers and an explicit retry", async () => {
    const onStageChange = vi.fn();
    apiFetchMock
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(triageResponse({
        role: "assistant",
        content: "Are any warning signs present?",
        done: false,
        quickReplies,
        evidenceSources: [],
      }));

    await renderTriageChat({
      presentationStage: "safety_check",
      composerVisibility: "hidden",
      onStageChange,
    });

    const alert = await screen.findByTestId("triage-request-error");
    expect(alert).toHaveTextContent(/try again/i);
    expect(alert).toHaveClass("scroll-mb-[calc(9rem+env(safe-area-inset-bottom))]");
    expect(screen.getByRole("button", { name: "Try again" })).toHaveClass("w-full");
    expect(onStageChange).toHaveBeenNthCalledWith(1, "checking");
    expect(onStageChange).toHaveBeenLastCalledWith("red_flag");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Are any warning signs present?");
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("triage-request-error")).not.toBeInTheDocument();
  });

  it("does not abort a slow but valid 16-second triage response", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    apiFetchMock.mockImplementationOnce((_url, init) => {
      requestSignal = init?.signal as AbortSignal;
      return new Promise<Response>((resolve) => {
        window.setTimeout(() => resolve(triageResponse({
          role: "assistant",
          content: "The check completed safely.",
          done: false,
          quickReplies,
          evidenceSources: [],
        })), 16_000);
      });
    });

    await renderTriageChat();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(requestSignal?.aborted).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(16_000);
      await Promise.resolve();
    });
    expect(requestSignal?.aborted).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(4_000);
      await Promise.resolve();
    });
    expect(requestSignal?.aborted).toBe(false);
  });

  it("renders a compact accessible severity slider with one primary continuation", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "How strong is it from 0 to 10?",
      done: false,
      quickReplies: Array.from({ length: 11 }, (_, value) => ({
        id: `severity-${value}`,
        label: String(value),
        value: String(value),
        icon: "help",
        tone: "purple",
        kind: "severity",
      })),
      evidenceSources: [],
    }));

    await renderTriageChat({
      presentationStage: "severity",
      composerVisibility: "hidden",
    });

    expect(await screen.findByTestId("symptom-severity-scale")).toHaveAttribute(
      "data-visual-layout",
      "embedded",
    );
    expect(screen.getByRole("slider", { name: "Symptom severity from 0 to 10" })).toHaveValue("5");
    expect(screen.getByTestId("symptom-severity-continue")).toHaveClass("vyva-primary-action");
    expect(screen.queryByRole("button", { name: "5" })).not.toBeInTheDocument();
  });

  it("keeps the approved related-detail question with matching factor answers", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "A runtime trend prompt that should not replace the approved scene copy.",
      done: false,
      quickReplies: [
        { id: "better", label: "Rest or medicine helped", value: "Rest or medicine helped.", icon: "help", tone: "purple", kind: "trend" },
        { id: "worse", label: "Activity, light, or noise made it worse", value: "Activity, light, or noise made it worse.", icon: "activity", tone: "purple", kind: "trend" },
        { id: "same", label: "Nothing clearly changed it", value: "Nothing clearly changed it.", icon: "help", tone: "purple", kind: "trend" },
      ],
      evidenceSources: [],
    }));

    await renderTriageChat({
      presentationStage: "related_details",
      composerVisibility: "hidden",
    });

    expect(await screen.findByRole("heading", { name: "One more detail" })).toBeVisible();
    expect(screen.getByText("Choose the pattern that fits best.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "A runtime trend prompt that should not replace the approved scene copy." })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rest or medicine helped" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Activity, light, or noise made it worse" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Nothing clearly changed it" })).toBeVisible();
  });

  it("uses choice cards when a severity-stage question is not a numeric scale", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "Where is the pain mainly?",
      done: false,
      quickReplies: [
        { id: "head", label: "Head or neck", value: "Head or neck.", icon: "help", tone: "purple", kind: "severity" },
        { id: "back", label: "Back", value: "Back.", icon: "help", tone: "purple", kind: "severity" },
        { id: "joint", label: "Arm, leg, or joint", value: "Arm, leg, or joint.", icon: "help", tone: "purple", kind: "severity" },
      ],
      evidenceSources: [],
    }));

    await renderTriageChat({
      presentationStage: "severity",
      composerVisibility: "hidden",
    });

    expect(await screen.findByRole("heading", { name: "Where is the pain mainly?" })).toBeVisible();
    expect(screen.queryByTestId("symptom-severity-scale")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Head or neck" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Back" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Arm, leg, or joint" })).toBeVisible();
  });

  it("keeps the reported symptom in review and ignores the no-additional-symptoms answer", async () => {
    await renderTriageChat({
      initialClue: "I have a headache",
      presentationStage: "review",
      composerVisibility: "hidden",
      initialDraft: {
        messages: [{ role: "assistant", content: "Does this summary look right?" }],
        selectedQuickAnswers: [
          { id: "no-additional-symptoms", label: "Nothing else", value: "No other symptoms.", kind: "symptom" },
          { id: "severity-5", label: "5", value: "5", kind: "severity" },
          { id: "today", label: "Today", value: "Today", kind: "duration" },
          { id: "same", label: "Nothing clearly changed it", value: "Nothing clearly changed it", kind: "trend" },
        ],
        apiQuickReplies: [
          { id: "confirm", label: "Yes, it is right", value: "Yes.", icon: "help", tone: "purple", kind: "review" },
          { id: "change", label: "Change something", value: "Change something.", icon: "help", tone: "purple", kind: "review" },
        ],
      },
    });

    const review = await screen.findByTestId("symptom-scene-review");
    expect(review).toHaveTextContent("I have a headache");
    expect(review).not.toHaveTextContent("Nothing else");
    expect(review).toHaveTextContent("When it started");
    expect(review).toHaveTextContent("Related detail");
  });

  it("localizes the French review chrome without changing the submitted answer values", async () => {
    setLanguage("fr");

    await renderTriageChat({
      initialClue: "Je me sens étourdi ou proche du malaise",
      presentationStage: "review",
      composerVisibility: "hidden",
      initialDraft: {
        messages: [{ role: "assistant", content: "Does this look right?" }],
        selectedQuickAnswers: [
          { id: "severity_5", label: "5", value: "The symptom feels 5 out of 10.", kind: "severity" },
          { id: "few_days", label: "Few days", value: "It has been going on for a few days.", kind: "duration" },
          { id: "ongoing_not_improving", label: "It is ongoing and not improving", value: "It is ongoing and not improving.", kind: "trend" },
        ],
        apiQuickReplies: [
          { id: "edit_answers", label: "Edit", value: "I want to edit my answers.", icon: "activity", tone: "purple", kind: "support" },
          { id: "confirm_review", label: "Yes, show my guidance", value: "These answers are correct. Show my guidance.", icon: "help", tone: "purple", kind: "support" },
        ],
      },
    });

    const review = await screen.findByTestId("symptom-scene-review");
    expect(screen.getByRole("heading", { name: "Est-ce correct ?" })).toBeVisible();
    expect(review).toHaveTextContent("Symptôme");
    expect(review).toHaveTextContent("Intensité");
    expect(review).toHaveTextContent("Quelques jours");
    expect(review).toHaveTextContent("Cela persiste sans s’améliorer");
    expect(screen.getByRole("button", { name: "Modifier" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Oui, afficher mes conseils" })).toBeVisible();
  });

  it("localizes French protocol questions and choices but submits the original clinical value", async () => {
    setLanguage("fr");
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "When did the breathing change start?",
      done: false,
      wizardStage: "duration",
      quickReplies: [],
      evidenceSources: [],
    }));

    await renderTriageChat({
      initialClue: "Je suis essoufflé",
      presentationStage: "safety_check",
      composerVisibility: "hidden",
      initialDraft: {
        messages: [{ role: "assistant", content: "How is your breathing right now?" }],
        selectedQuickAnswers: [{ id: "breathing", label: "Breathing", value: "I feel short of breath.", kind: "symptom" }],
        apiQuickReplies: [
          { id: "worse_but_speaking", label: "Worse than usual, but I can speak", value: "My breathing is worse than usual, but I can speak.", icon: "wind", tone: "amber", kind: "red_flag" },
        ],
      },
    });

    expect(screen.getByRole("heading", { name: "Comment respirez-vous en ce moment ?" })).toBeVisible();
    const answer = screen.getByRole("button", { name: "Pire que d’habitude, mais je peux parler" });
    fireEvent.click(answer);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const requestBody = JSON.parse((apiFetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(requestBody.messages.at(-1).content).toBe("My breathing is worse than usual, but I can speak.");
    expect(requestBody.wizard.quickAnswers.at(-1)).toEqual(expect.objectContaining({
      id: "worse_but_speaking",
      value: "My breathing is worse than usual, but I can speak.",
    }));
  });

  it("returns to severity when the user edits the review", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "How strong is it?",
      done: false,
      wizardStage: "severity",
      quickReplies: Array.from({ length: 11 }, (_, value) => ({
        id: `severity_${value}`,
        label: String(value),
        value: `The symptom feels ${value} out of 10.`,
        icon: "activity",
        tone: "purple",
        kind: "severity",
      })),
    }));

    await renderTriageChat({
      initialClue: "I have a headache",
      presentationStage: "review",
      composerVisibility: "hidden",
      initialDraft: {
        messages: [{ role: "assistant", content: "Does this look right?" }],
        selectedQuickAnswers: [
          { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
          { id: "no_red_flag", label: "No warning signs", value: "No warning signs.", kind: "red_flag" },
          { id: "severity_5", label: "5", value: "The symptom feels 5 out of 10.", kind: "severity" },
          { id: "today", label: "Today", value: "Today", kind: "duration" },
          { id: "same", label: "Nothing changed", value: "Nothing changed.", kind: "trend" },
        ],
        apiQuickReplies: [
          { id: "edit_answers", label: "Edit", value: "I want to edit my answers.", icon: "activity", tone: "purple", kind: "support" },
          { id: "confirm_review", label: "Confirm", value: "These answers are correct.", icon: "help", tone: "purple", kind: "support" },
        ],
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const requestBody = JSON.parse((apiFetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(requestBody.wizard.quickAnswers).toEqual([
      expect.objectContaining({ id: "pain", kind: "symptom" }),
      expect.objectContaining({ id: "no_red_flag", kind: "red_flag" }),
    ]);
  });

  it("shows simple question progress without the confidence tracker by default", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "How are you feeling now?",
      done: false,
      quickReplies,
      wizardStage: "severity",
      wizardStageLabel: "Severity check",
      evidenceSources: [],
    }));

    await renderTriageChat({ bpm: 72, respiratoryRate: 18 });

    await screen.findByText("How are you feeling now?", {}, { timeout: 5000 });
    expect(screen.queryByTestId("triage-confidence-tracker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("triage-session-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("triage-question-progress")).toHaveTextContent("Question 1");
    expect(screen.queryByText("Answer this question")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("meter", { name: "Confidence level" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("triage-existing-vitals")).not.toBeInTheDocument();
    expect(screen.queryByText("72 bpm")).not.toBeInTheDocument();
    expect(screen.queryByText("18 breaths/min")).not.toBeInTheDocument();
    expect(screen.getByText("Choose the closest answer")).toBeInTheDocument();
  });

  it("uses a dedicated condition-aware vitals checkpoint before completing the assessment", async () => {
    apiFetchMock
      .mockResolvedValueOnce(triageResponse({
        role: "assistant",
        content: "How strong is the dizziness right now?",
        done: false,
        quickReplies,
        wizardStage: "severity",
        wizardStageLabel: "More details",
        questionReason: "How strong it feels helps choose the safest next step.",
        profileContextUsed: true,
        guidancePlan: dizzinessGuidancePlan,
        vitalsPrompt: {
          title: "If you can, one reading may help",
          body: "Only do this if it is easy and safe. You can keep answering without it.",
          actions: [
            { id: "pulse", label: "Pulse", value: "I can check my pulse if that would help.", icon: "heart", tone: "purple" },
            { id: "blood_pressure", label: "Blood pressure", value: "I can check my blood pressure if that would help.", icon: "activity", tone: "blue" },
          ],
        },
        evidenceSources: [],
      }))
      .mockResolvedValueOnce(triageResponse({
        readings: [],
        signals: [
          { signal_type: "resting_hr_bpm", current_reading: null, compatible_methods: ["web_bluetooth", "phone_camera", "device_photo", "voice", "manual"] },
          { signal_type: "bp_systolic", current_reading: null, compatible_methods: ["web_bluetooth", "device_photo", "voice", "manual"] },
          { signal_type: "bp_diastolic", current_reading: null, compatible_methods: ["web_bluetooth", "device_photo", "voice", "manual"] },
        ],
        devices: [],
      }))
      .mockResolvedValueOnce(triageResponse({
        role: "assistant",
        content: "Thanks. I’ll continue without a reading.",
        done: false,
        quickReplies,
        wizardStage: "onset",
        wizardStageLabel: "Timing",
        vitalsPrompt: null,
        evidenceSources: [],
      }));

    renderTriageChat({
      initialClue: "I feel dizzy",
      presentationStage: "severity",
      composerVisibility: "hidden",
    });

    await screen.findByText("How strong is the dizziness right now?", {}, { timeout: 5000 });
    expect(screen.queryByTestId("triage-session-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("triage-guidance-confidence")).not.toBeInTheDocument();
    expect(screen.queryByTestId("triage-guidance-focus")).not.toBeInTheDocument();
    expect(screen.queryByTestId("triage-question-reason")).not.toBeInTheDocument();
    expect(screen.queryByText("Why this question?")).not.toBeInTheDocument();
    expect(screen.queryByText("How strong it feels helps choose the safest next step.")).not.toBeInTheDocument();
    expect(screen.queryByTestId("triage-guidance-plan")).not.toBeInTheDocument();
    expect(screen.getByTestId("triage-contextual-vitals-prompt")).toHaveTextContent("A reading could improve your result");
    expect(screen.getByTestId("triage-contextual-vitals-prompt")).toHaveTextContent("If you can, one reading may help");
    expect(screen.getByTestId("triage-contextual-vitals-prompt")).toHaveTextContent("Optional");
    expect(screen.getByText("Only do this if it is easy and safe. You can keep answering without it.")).toBeVisible();
    expect(screen.getByTestId("triage-camera-vitals-reminder")).toHaveTextContent("camera can estimate your heart rate and breathing rate");
    expect(screen.getByRole("button", { name: "Pulse" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Blood pressure" })).toBeVisible();
    expect(screen.getByTestId("button-triage-vitals-skip")).toHaveTextContent("I can’t measure this");

    fireEvent.click(screen.getByRole("button", { name: "Pulse" }));

    expect(await screen.findByRole("button", { name: "Bluetooth device" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Camera scan" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Scan device screen" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Speak reading" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Type reading" })).toBeVisible();
    expect(apiFetchMock.mock.calls.filter(([url]) => url === "/api/triage/message")).toHaveLength(1);

    fireEvent.click(screen.getByTestId("button-triage-vitals-skip"));

    await waitFor(() => {
      expect(apiFetchMock.mock.calls.filter(([url]) => url === "/api/triage/message")).toHaveLength(2);
    });
    const skipRequest = apiFetchMock.mock.calls.filter(([url]) => url === "/api/triage/message")[1]?.[1];
    expect(JSON.parse(String(skipRequest?.body)).wizard.declinedScanTypes).toContain("vitals");
    expect(await screen.findByText("Thanks. I’ll continue without a reading.")).toBeVisible();
  });

  it("shows only four answer buttons until More choices is opened", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "Which one is closest?",
      done: false,
      quickReplies: manyQuickReplies,
      wizardStage: "severity",
      wizardStageLabel: "Severity check",
      evidenceSources: [],
    }));

    await renderTriageChat();

    await screen.findByRole("button", { name: "First answer" }, { timeout: 5000 });
    expect(screen.getByText("Which one is closest?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First answer" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Fourth answer" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Fifth answer" })).not.toBeVisible();
    expect(screen.getByText("More choices")).toBeVisible();

    fireEvent.click(screen.getByText("More choices"));

    expect(screen.getByRole("button", { name: "Fifth answer" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sixth answer" })).toBeVisible();
  });

  it("does not ask for an initial symptom a second time", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "Which symptom is closest?",
      done: false,
      quickReplies: [
        { id: "headache", label: "Headache", value: "Headache", icon: "help", tone: "purple", kind: "symptom" },
        { id: "dizziness", label: "Dizziness", value: "Dizziness", icon: "help", tone: "purple", kind: "symptom" },
        { id: "nausea", label: "Nausea", value: "Nausea", icon: "help", tone: "purple", kind: "symptom" },
      ],
      guidancePlan: {
        stage: "symptom",
        priorityLabel: "Safety first",
        protocolLabel: "Symptom assessment",
        nextQuestionFocus: "Choose symptoms",
        usefulSignals: [],
        confidence: { score: 3, label: "Building", reasons: [], missing: [] },
      },
    }));

    await renderTriageChat({
      initialClue: "Pain or headache",
      presentationStage: "symptom_selection",
      composerVisibility: "hidden",
    });

    expect(await screen.findByRole("heading", { name: "Anything else?" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Headache" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dizziness" })).toBeVisible();
    const dizzinessChoice = screen.getByRole("button", { name: "Dizziness" });
    expect(dizzinessChoice).toHaveClass("w-full", "rounded-[18px]", "text-left");
    expect(dizzinessChoice.querySelectorAll("svg")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Nausea" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Nothing else" })).toBeVisible();
  });

  it("sends follow-up chips as free text without adding quickAnswers", async () => {
    apiFetchMock
      .mockResolvedValueOnce(triageResponse({
        role: "assistant",
        content: "Q?",
        done: false,
        quickReplies,
        wizardStage: "red_flag",
        wizardStageLabel: "Safety check",
        medicalFollowups: ["Could caffeine make anxiety worse?"],
        medisearchConversationId: "conversation-1",
      }))
      .mockResolvedValueOnce(triageResponse({
        role: "assistant",
        content: "Q?",
        done: false,
        quickReplies,
        wizardStage: "red_flag",
        wizardStageLabel: "Safety check",
        medicalFollowups: [],
        medisearchConversationId: "conversation-1",
      }));

    await renderTriageChat();

    await waitFor(() => {
      expect(screen.getByTestId("triage-medical-followups")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Useful follow-up questions"));

    fireEvent.click(screen.getByTestId("triage-medical-followup-0"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
    });

    const secondBody = JSON.parse((apiFetchMock.mock.calls[1]?.[1] as RequestInit).body as string);
    expect(secondBody.messages.at(-1)).toEqual({
      role: "user",
      content: "Could caffeine make anxiety worse?",
    });
    expect(secondBody.wizard.quickAnswers).toEqual([]);
    expect(secondBody.medisearchConversationId).toBe("conversation-1");
  });

  it("restores the previous question without sending another triage request", async () => {
    let backHandler: (() => boolean) | null = null;
    apiFetchMock
      .mockResolvedValueOnce(triageResponse({
        role: "assistant",
        content: "Do any warning signs apply?",
        done: false,
        quickReplies,
        wizardStage: "red_flag",
        wizardStageLabel: "Safety check",
      }))
      .mockResolvedValueOnce(triageResponse({
        role: "assistant",
        content: "When did this begin?",
        done: false,
        quickReplies: [
          { id: "today", label: "Today", value: "It started today.", icon: "calendar", tone: "purple", kind: "duration" },
        ],
        wizardStage: "duration",
        wizardStageLabel: "When it started",
      }));

    await renderTriageChat({
      onBackHandlerChange: (handler) => {
        backHandler = handler;
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "No warning signs" }));
    await screen.findByText("When did this begin?");
    expect(apiFetchMock).toHaveBeenCalledTimes(2);

    act(() => {
      expect(backHandler).not.toBeNull();
      expect(backHandler!()).toBe(true);
    });

    expect(await screen.findByText("Do any warning signs apply?")).toBeVisible();
    expect(screen.getByRole("button", { name: "No warning signs" })).toBeVisible();
    expect(screen.queryByText("When did this begin?")).not.toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledTimes(2);

    act(() => {
      expect(backHandler!()).toBe(false);
    });
  });

  it("cancels an in-flight next question when returning to the previous turn", async () => {
    let backHandler: (() => boolean) | null = null;
    let pendingSignal: AbortSignal | undefined;
    apiFetchMock
      .mockResolvedValueOnce(triageResponse({
        role: "assistant",
        content: "Do any warning signs apply?",
        done: false,
        quickReplies,
        wizardStage: "red_flag",
        wizardStageLabel: "Safety check",
      }))
      .mockImplementationOnce((_url, init) => {
        pendingSignal = init?.signal as AbortSignal;
        return new Promise<Response>((_resolve, reject) => {
          pendingSignal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      });

    await renderTriageChat({
      onBackHandlerChange: (handler) => {
        backHandler = handler;
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "No warning signs" }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      expect(backHandler!()).toBe(true);
      await Promise.resolve();
    });

    expect(pendingSignal?.aborted).toBe(true);
    expect(await screen.findByText("Do any warning signs apply?")).toBeVisible();
    expect(screen.getByRole("button", { name: "No warning signs" })).toBeEnabled();
    expect(screen.queryByTestId("triage-request-error")).not.toBeInTheDocument();
  });

  it("restores the final review turn from a completed draft", () => {
    const reviewTurn: NonNullable<TriageChatDraft["backStack"]>[number] = {
      messages: [{ role: "assistant", content: "Does this look right?" }],
      selectedQuickAnswers: [{ id: "today", label: "Today", value: "Today", kind: "duration" }],
      presentationStage: "review",
    };
    const result = stepBackTriageDraft({
      assessmentSessionId: "assessment-1",
      messages: [...reviewTurn.messages, { role: "user", content: "Show my guidance" }],
      selectedQuickAnswers: reviewTurn.selectedQuickAnswers,
      backStack: [reviewTurn],
      pendingRequest: false,
    });

    expect(result).toEqual({
      draft: {
        assessmentSessionId: "assessment-1",
        ...reviewTurn,
        backStack: [],
        pendingRequest: false,
      },
      presentationStage: "review",
    });
  });

  it("does not show MediSearch follow-up chips during a safety alert", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "Emergency warning",
      done: false,
      urgent: true,
      safetyAlert: {
        id: "red_flag",
        label: "Chest pain",
        recommendation: "Call emergency services now.",
      },
      quickReplies: [],
      emergencyContact: { label: "112", telHref: "tel:112" },
      evidenceSources: [],
      medisearchConversationId: "conversation-1",
      medicalFollowups: ["Could this be anxiety?"],
    }));

    await renderTriageChat();

    expect(await screen.findAllByText("Emergency warning")).not.toHaveLength(0);
    await waitFor(() => {
      expect(screen.queryByTestId("triage-medical-followups")).not.toBeInTheDocument();
    });
  });

  it("renders an optional scan card from restored structured answers and can skip it", async () => {
    const onDraftChange = vi.fn();
    setLanguage("es");

    await renderTriageChat({
      initialClue: "",
      initialDraft: {
        messages: [{ role: "assistant", content: "How is breathing now?" }],
        selectedQuickAnswers: [
          { id: "breathing", label: "Breathing", value: "I feel short of breath.", kind: "symptom" },
          { id: "worse_but_speaking", label: "Worse than usual, but I can speak", value: "Breathing is worse than usual, but I can speak.", kind: "red_flag" },
        ],
        apiQuickReplies: quickReplies,
        wizardSymptomId: "breathing",
      },
      onDraftChange,
    });

    expect(screen.getByTestId("triage-optional-scan")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Anadir una medicion rapida"));
    expect(screen.getByTestId("triage-scan-card")).toBeVisible();
    expect(screen.getByText("Revisar pulso y respiracion")).toBeInTheDocument();
    expect(screen.queryByText("Tu decides")).not.toBeInTheDocument();
    expect(screen.getByText("Ahora no")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-triage-scan-skip"));

    await waitFor(() => {
      expect(screen.queryByTestId("triage-scan-card")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("triage-quick-answers")).toBeInTheDocument();
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
      declinedScanTypes: ["vitals"],
    }));
  });

  it("adds photo scan results to the next triage request and supports retake", async () => {
    apiFetchMock
      .mockResolvedValueOnce(triageResponse({
        id: "scan-1",
        type: "wound_photo",
        label: "Skin or wound photo",
        concernLevel: "watch",
        summary: "Mild redness is visible.",
        findings: ["Mild redness"],
        capturedAt: new Date().toISOString(),
      }))
      .mockResolvedValueOnce(triageResponse({
        id: "scan-1",
        type: "wound_photo",
        label: "Skin or wound photo",
        concernLevel: "watch",
        summary: "Mild redness is visible.",
        findings: ["Mild redness"],
        capturedAt: new Date().toISOString(),
      }))
      .mockResolvedValueOnce(triageResponse({
        role: "assistant",
        content: "How long has it been there?",
        done: false,
        quickReplies: [],
        wizardStage: "duration",
        wizardStageLabel: "When it started",
        wizardSymptomId: "skin",
      }));

    await renderTriageChat({
      initialClue: "",
      initialDraft: {
        messages: [{ role: "assistant", content: "Do any skin warning signs apply?" }],
        selectedQuickAnswers: [
          { id: "skin", label: "Skin or wound", value: "I have a skin or wound problem.", kind: "symptom" },
          { id: "wound_spreading", label: "Open wound or spreading redness", value: "I have an open or draining wound.", kind: "red_flag" },
        ],
        apiQuickReplies: quickReplies,
        wizardSymptomId: "skin",
      },
    });

    fireEvent.click(screen.getByTestId("button-triage-scan-now"));
    fireEvent.change(screen.getByTestId("input-triage-scan-photo"), {
      target: {
        files: [new File(["photo"], "wound.jpg", { type: "image/jpeg" })],
      },
    });

    await screen.findByText("Scan note added");
    expect(screen.getByText("Mild redness is visible.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-triage-scan-retake"));
    expect(screen.getByText("Photo of the skin change")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-triage-scan-now"));
    fireEvent.change(screen.getByTestId("input-triage-scan-photo"), {
      target: {
        files: [new File(["photo"], "wound.jpg", { type: "image/jpeg" })],
      },
    });
    await screen.findByText("Mild redness is visible.");
    fireEvent.click(screen.getByTestId("button-triage-scan-continue"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(3));
    const triageBody = JSON.parse((apiFetchMock.mock.calls[2]?.[1] as RequestInit).body as string);
    expect(triageBody.wizard.scanResults).toEqual([
      expect.objectContaining({
        id: "scan-1",
        type: "wound_photo",
        summary: "Mild redness is visible.",
      }),
    ]);
  });
});
