import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConditionsSection from "./ConditionsSection";
import MedicationsSection from "./MedicationsSection";
import AllergiesSection from "./AllergiesSection";
import { apiFetch, queryClient } from "@/lib/queryClient";

vi.mock("@/i18n", () => ({
  getLanguageSnapshot: () => ({ language: "en", source: "test" }),
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

vi.mock("@/components/onboarding/SpeakItOverlay", () => ({
  default: ({ title, onDone, onCancel }: {
    title: string;
    onDone: (transcript: string) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="mock-speak-it-overlay" aria-label={title}>
      <button
        type="button"
        data-testid="button-mock-speak-it-done"
        onClick={() => onDone("I have high cholesterol")}
      >
        Use spoken conditions
      </button>
      <button type="button" data-testid="button-mock-speak-it-cancel" onClick={onCancel}>
        Cancel voice
      </button>
    </div>
  ),
}));

vi.mock("@/components/VoiceMedsModal", () => ({
  default: ({ open, onAddMedication }: {
    open: boolean;
    onAddMedication: (med: {
      name: string;
      dosage: string;
      frequency: string;
      times: string;
      with_food: string;
      prescribed_by: string;
    }) => void;
  }) => open ? (
    <button
      type="button"
      data-testid="button-mock-voice-meds-add"
      onClick={() =>
        onAddMedication({
          name: "Metformin",
          dosage: "500mg",
          frequency: "",
          times: "Morning",
          with_food: "",
          prescribed_by: "",
        })
      }
    >
      Add mock medication
    </button>
  ) : null,
}));

vi.mock("@/components/VoiceAllergiesModal", () => ({
  default: ({ open, onAddAllergies }: {
    open: boolean;
    onAddAllergies: (allergies: string[]) => void;
  }) => open ? (
    <button
      type="button"
      data-testid="button-mock-voice-allergies-add"
      onClick={() => onAddAllergies(["Penicillin", "Latex"])}
    >
      Add mock allergies
    </button>
  ) : null,
}));

const apiFetchMock = vi.mocked(apiFetch);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function onboardingState(profile: Record<string, unknown> = {}) {
  return {
    profile,
    onboardingState: {},
    account: { id: "user-1", activeProfileId: "user-1", role: "elder" },
  };
}

function seedOnboardingState(profile: Record<string, unknown> = {}) {
  const state = onboardingState(profile);
  queryClient.clear();
  queryClient.setQueryData(["/api/onboarding/state"], state);
  vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(state)));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
}

function renderSection(section: ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {section}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function lastPostedBody() {
  const postCall = apiFetchMock.mock.calls.find(([, init]) => init?.method === "POST");
  if (!postCall) throw new Error("No POST request was made");
  return JSON.parse((postCall[1]?.body ?? "{}") as string) as Record<string, unknown>;
}

describe("profile section reviewed-empty choices", () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(jsonResponse({ ok: true }));
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it("keeps health incomplete until no known conditions is selected", async () => {
    seedOnboardingState();
    renderSection(<ConditionsSection />);

    const save = await screen.findByTestId("button-conditions-save");
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-conditions-no-known"));
    expect(save).toBeEnabled();

    fireEvent.click(save);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/onboarding/section/conditions",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(lastPostedBody()).toMatchObject({
      health_conditions: [],
      no_known_conditions: true,
    });
  });

  it("clears the no known conditions choice when a condition is added", async () => {
    seedOnboardingState();
    renderSection(<ConditionsSection />);

    fireEvent.click(await screen.findByTestId("button-conditions-no-known"));
    expect(screen.getByTestId("button-conditions-no-known")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("accordion-heart"));
    fireEvent.click(screen.getByTestId("card-condition-hypertension"));
    expect(screen.getByTestId("button-conditions-no-known")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByTestId("button-conditions-save"));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      health_conditions: ["Hypertension"],
      no_known_conditions: false,
    });
  });

  it("keeps optional daily-life context compact until requested", async () => {
    seedOnboardingState();
    renderSection(<ConditionsSection />);

    const dailyLifeButton = await screen.findByTestId("button-conditions-daily-life");
    expect(dailyLifeButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Living situation")).not.toBeInTheDocument();

    fireEvent.click(dailyLifeButton);

    expect(dailyLifeButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Mobility")).toBeInTheDocument();
    expect(screen.getByText("Living situation")).toBeInTheDocument();
  });

  it("uses companion guidance in health without saving before an explicit choice", async () => {
    seedOnboardingState();
    renderSection(<ConditionsSection />);

    const chip = await screen.findByTestId("onboarding-companion-mode-chip");
    expect(chip).toHaveTextContent("Say one or more health conditions.");
    expect(screen.getByTestId("button-section-companion-primary-voice-action")).toHaveTextContent("Tell VYVA");
    expect(screen.queryByTestId("button-conditions-speak-it")).not.toBeInTheDocument();
    expect(screen.queryByText("Add by voice")).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("button-section-companion-primary-voice-action"));

    expect(chip).toHaveTextContent("Listening");
    expect(chip).toHaveTextContent("Tell VYVA one or more health conditions.");
    expect(screen.getByTestId("mock-speak-it-overlay")).toHaveAccessibleName("Tell VYVA your conditions");
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.focus(screen.getByTestId("input-conditions-search"));

    expect(chip).toHaveTextContent("Listening");
    expect(chip).toHaveTextContent("Search by condition name, or say the condition to VYVA.");
    expect(screen.getByTestId("input-conditions-search").closest("[data-vyva-companion-target]")).toHaveAttribute(
      "data-vyva-companion-target-active",
      "true",
    );
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("moves health guidance to review after a selection while save remains explicit", async () => {
    seedOnboardingState();
    renderSection(<ConditionsSection />);

    fireEvent.click(await screen.findByTestId("accordion-heart"));
    fireEvent.click(screen.getByTestId("card-condition-hypertension"));

    expect(screen.getByTestId("onboarding-companion-mode-chip")).toHaveTextContent("Selected Hypertension");
    expect(screen.getByTestId("button-conditions-save").closest("[data-vyva-companion-target]")).toHaveAttribute(
      "data-vyva-companion-target-active",
      "true",
    );
    expect(screen.getByTestId("button-conditions-save")).toBeEnabled();
  });

  it("does not autosave health tactile edits before explicit save", async () => {
    seedOnboardingState();
    renderSection(<ConditionsSection />);

    fireEvent.click(await screen.findByTestId("accordion-heart"));
    fireEvent.click(screen.getByTestId("card-condition-hypertension"));
    apiFetchMock.mockClear();

    vi.useFakeTimers();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("keeps health voice and tactile modes on the same UI and returns to voice when Tell VYVA is tapped", async () => {
    seedOnboardingState();
    renderSection(<ConditionsSection />);

    expect(await screen.findByTestId("button-section-companion-primary-voice-action")).toBeInTheDocument();
    expect(screen.queryByTestId("button-conditions-speak-it")).not.toBeInTheDocument();
    expect(screen.getByTestId("input-conditions-search")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-section-companion-mode-tactile"));

    await waitFor(() => {
      expect(screen.getByTestId("onboarding-companion-mode-chip")).toHaveTextContent(
        "Use touch or keyboard controls quietly.",
      );
    });
    expect(screen.getByTestId("button-conditions-speak-it")).toBeInTheDocument();
    expect(screen.queryByText("Voice-only health screen")).not.toBeInTheDocument();
    expect(document.querySelector("[data-vyva-companion-target-active='true']")).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("button-conditions-speak-it"));

    await waitFor(() => {
      expect(screen.getByTestId("button-section-companion-mode-voice")).toHaveAttribute("aria-checked", "true");
      expect(screen.getByTestId("onboarding-companion-mode-chip")).toHaveTextContent("Listening");
    });
    expect(screen.getByTestId("mock-speak-it-overlay")).toHaveAccessibleName("Tell VYVA your conditions");
    expect(screen.queryByTestId("button-conditions-speak-it")).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("turns health voice capture into a local review draft without autosaving", async () => {
    seedOnboardingState();
    renderSection(<ConditionsSection />);

    fireEvent.click(await screen.findByTestId("button-section-companion-primary-voice-action"));
    fireEvent.click(screen.getByTestId("button-mock-speak-it-done"));

    expect(await screen.findByTestId("panel-conditions-speak-it-confirm")).toHaveTextContent("High cholesterol");
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add these" }));

    expect(screen.getByTestId("button-remove-condition-high-cholesterol")).toBeInTheDocument();
    expect(screen.getByTestId("button-conditions-save")).toBeEnabled();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("keeps medications incomplete until no current medications is selected", async () => {
    seedOnboardingState();
    renderSection(<MedicationsSection />);

    const save = await screen.findByTestId("button-meds-save");
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-meds-no-current"));
    expect(save).toBeEnabled();

    fireEvent.click(save);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/onboarding/section/medications",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(lastPostedBody()).toMatchObject({
      medications: [],
      no_known_medications: true,
    });
  });

  it("clears the no current medications choice when a medication is entered", async () => {
    seedOnboardingState();
    renderSection(<MedicationsSection />);

    fireEvent.click(await screen.findByTestId("button-meds-no-current"));
    expect(screen.getByTestId("button-meds-no-current")).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByTestId("input-med-name-0"), { target: { value: "Metformin" } });
    expect(screen.getByTestId("button-meds-no-current")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByTestId("button-meds-save"));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      medications: [{ medication_name: "Metformin" }],
      no_known_medications: false,
    });
  });

  it("uses companion guidance in medications without saving before entry or explicit review", async () => {
    seedOnboardingState();
    renderSection(<MedicationsSection />);

    const voice = await screen.findByTestId("button-meds-voice");
    expect(screen.queryByTestId("onboarding-companion-mode-chip")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Medications" })).toHaveLength(1);
    expect(screen.queryByTestId("button-section-companion-primary-voice-action")).not.toBeInTheDocument();
    expect(screen.queryByText("Add by voice")).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.click(voice);
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.focus(screen.getByTestId("input-med-name-0"));

    expect(screen.getByTestId("card-med-med-1")).toHaveAttribute(
      "data-vyva-companion-target-active",
      "true",
    );
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("input-med-name-0"), { target: { value: "Metformin" } });

    expect(screen.getByTestId("button-meds-save").closest("[data-vyva-companion-target]")).toHaveAttribute(
      "data-vyva-companion-target-active",
      "true",
    );
  });

  it("does not autosave medication tactile edits before explicit save", async () => {
    seedOnboardingState();
    renderSection(<MedicationsSection />);

    fireEvent.change(await screen.findByTestId("input-med-name-0"), {
      target: { value: "Metformin" },
    });
    apiFetchMock.mockClear();

    vi.useFakeTimers();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("keeps voice and manual medication entry together without a separate mode panel", async () => {
    seedOnboardingState();
    renderSection(<MedicationsSection />);

    expect(await screen.findByTestId("button-meds-voice")).toBeInTheDocument();
    expect(screen.getByTestId("button-meds-no-current")).toBeInTheDocument();
    expect(screen.getByTestId("input-med-name-0")).toBeInTheDocument();

    expect(screen.queryByTestId("onboarding-companion-mode-chip")).not.toBeInTheDocument();
    expect(screen.queryByText("Voice-only medication screen")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-meds-voice"));

    expect(screen.getByTestId("button-meds-voice")).toBeInTheDocument();
    expect(screen.getByTestId("input-med-name-0")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("adds medication voice output locally and waits for explicit save before writing", async () => {
    seedOnboardingState();
    renderSection(<MedicationsSection />);

    fireEvent.click(await screen.findByTestId("button-meds-voice"));
    fireEvent.click(screen.getByTestId("button-mock-voice-meds-add"));

    await waitFor(() => {
      expect(screen.getByTestId("input-med-name-1")).toHaveValue("Metformin");
    });
    expect(screen.getByTestId("input-med-dosage-1")).toHaveValue("500mg");
    expect(screen.getByTestId("input-med-times-1")).toHaveValue("Morning");
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("button-meds-save"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/onboarding/section/medications",
      expect.objectContaining({ method: "POST" }),
    ));
  });

  it("keeps allergies incomplete until no known allergies is selected", async () => {
    seedOnboardingState();
    renderSection(<AllergiesSection />);

    const save = await screen.findByTestId("button-allergies-save");
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-allergies-no-known"));
    expect(save).toBeEnabled();

    fireEvent.click(save);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/onboarding/section/medications",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(lastPostedBody()).toMatchObject({
      known_allergies: [],
      no_known_allergies: true,
    });
  });

  it("clears the no known allergies choice when an allergy is added", async () => {
    seedOnboardingState();
    renderSection(<AllergiesSection />);

    fireEvent.click(await screen.findByTestId("button-allergies-no-known"));
    expect(screen.getByTestId("button-allergies-no-known")).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByTestId("input-allergies-new"), { target: { value: "Penicillin" } });
    fireEvent.click(screen.getByTestId("button-allergies-add"));
    expect(screen.getByTestId("button-allergies-no-known")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByTestId("button-allergies-save"));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(lastPostedBody()).toMatchObject({
      known_allergies: ["Penicillin"],
      no_known_allergies: false,
    });
  });

  it("reviews allergies voice output as a draft before applying or saving", async () => {
    seedOnboardingState();
    renderSection(<AllergiesSection />);

    fireEvent.click(await screen.findByTestId("button-section-companion-primary-voice-action"));
    fireEvent.click(screen.getByTestId("button-mock-voice-allergies-add"));

    const draft = await screen.findByTestId("panel-allergies-voice-draft");
    expect(draft).toHaveTextContent("Review allergies");
    expect(within(draft).getByText("Penicillin")).toBeInTheDocument();
    expect(within(draft).getByText("Latex")).toBeInTheDocument();
    expect(screen.queryByTestId("tag-allergy-penicillin")).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("button-profile-voice-draft-remove-latex"));
    expect(within(draft).queryByText("Latex")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-profile-voice-draft-confirm"));

    expect(await screen.findByTestId("tag-allergy-penicillin")).toBeInTheDocument();
    expect(screen.queryByTestId("tag-allergy-latex")).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("button-allergies-save"));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/onboarding/section/medications",
      expect.objectContaining({ method: "POST" }),
    ));
  });

  it("does not autosave allergy tactile edits before explicit save", async () => {
    seedOnboardingState();
    renderSection(<AllergiesSection />);

    fireEvent.change(await screen.findByTestId("input-allergies-new"), {
      target: { value: "Penicillin" },
    });
    fireEvent.click(screen.getByTestId("button-allergies-add"));
    apiFetchMock.mockClear();

    vi.useFakeTimers();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();

    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
