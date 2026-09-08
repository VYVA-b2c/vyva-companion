import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import VitalsTracker, { type VitalsTrackerPreviewData } from "./VitalsTracker";
import VitalsAddReadingFlow, { type VitalsAcquisitionContext } from "./VitalsAddReadingFlow";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({ apiFetch: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

afterEach(() => {
  apiFetchMock.mockReset();
  delete (window as Window & { __VYVA_FACE_SCAN_TEST_DURATION_MS?: number }).__VYVA_FACE_SCAN_TEST_DURATION_MS;
});

const previewData: VitalsTrackerPreviewData = {
  analysis: {
    safety_status: "steady",
    recommended_action: "steady",
    risk_score: 16,
    senior_message: "Your latest readings look steady.",
  },
  recent_readings: [
    { signal_type: "resting_hr_bpm", value: 72, recorded_at: "2026-08-28T08:00:00.000Z", source: "manual_entry", source_confidence: "high", deviation_pct: 1, context_tag: "resting" },
    { signal_type: "oxygen_saturation", value: 98, recorded_at: "2026-08-28T07:59:00.000Z", source: "connected_device", source_confidence: "high", deviation_pct: 0, context_tag: "resting", capture_method: "web_bluetooth", source_ref: { device_name: "Pulse oximeter" } },
    { signal_type: "mood_score", value: 8, recorded_at: "2026-08-28T07:58:00.000Z", source: "manual_entry", source_confidence: "medium", deviation_pct: 0, context_tag: "general" },
  ],
  latest_alert: null,
};

function renderTracker(onVoiceStateChange?: Parameters<typeof VitalsTracker>[0]["onVoiceStateChange"]) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <VitalsTracker userId="preview-user" userConditions={[]} language="en" previewData={previewData} onVoiceStateChange={onVoiceStateChange} />
    </MemoryRouter>,
  );
}

describe("VitalsTracker redesign", () => {
  it("uses the real safety label, shows a labelled risk score, and declutters untracked readings", () => {
    renderTracker();

    expect(screen.getByTestId("vitals-hero")).not.toHaveTextContent("Steady");
    expect(screen.getByTestId("vitals-hero")).toHaveClass("-mx-2", "sm:-mx-4", "lg:-mx-14");
    expect(screen.getByTestId("vitals-hero-metric").querySelector("svg")).toBeNull();
    expect(screen.getByLabelText("Steady")).toBeVisible();
    expect(screen.getByTestId("vitals-risk-score")).toHaveTextContent("Risk score");
    expect(screen.getByTestId("vitals-risk-score")).toHaveTextContent("16/100");
    expect(screen.getByTestId("vitals-hero-message")).toHaveTextContent("All good");
    expect(screen.getByTestId("vitals-risk-score")).toHaveTextContent("Lower is better");
    expect(screen.getByTestId("vitals-risk-score")).toHaveClass("max-w-[520px]");
    expect(screen.getByTestId("vitals-risk-score")).not.toHaveClass("sm:mx-auto", "sm:w-[380px]");
    expect(screen.queryByTestId("vitals-hero-marker")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Latest readings 1" }));
    expect(screen.queryByTestId("vitals-risk-score")).not.toBeInTheDocument();
    expect(screen.getByTestId("vitals-hero-marker")).toHaveTextContent("Heart rate");
    expect(screen.getByTestId("vitals-hero-marker")).toHaveTextContent("72 bpm");
    expect(screen.getByTestId("vitals-hero-value")).toHaveClass("shrink-0", "whitespace-nowrap");
    expect(screen.getByTestId("vitals-hero-value")).not.toHaveClass("truncate");
    expect(screen.getByTestId("vitals-hero-metric").querySelector("svg")).toBeNull();
    expect(screen.getByTestId("vitals-hero-message")).toHaveTextContent("1% above your baseline");
    expect(screen.getByTestId("vitals-hero-marker")).toHaveClass("max-w-[520px]");
    expect(screen.getByTestId("vitals-hero-marker")).not.toHaveClass("sm:mx-auto", "sm:w-[380px]");
    fireEvent.click(screen.getByRole("button", { name: "Latest readings 2" }));
    expect(screen.getByTestId("vitals-hero-marker")).toHaveTextContent("Oxygen");
    expect(screen.getByTestId("vitals-hero-marker")).not.toHaveTextContent("0%");
    expect(screen.getByTestId("vitals-hero-message")).toHaveTextContent("Near your baseline");
    expect(screen.getByTestId("vitals-hero")).not.toHaveTextContent("Your latest readings look steady.");
    expect(screen.getByTestId("vitals-reading-groups")).toHaveTextContent("Heart");
    expect(screen.getByTestId("vitals-reading-groups")).toHaveTextContent("Breathing");
    expect(screen.getByTestId("vitals-reading-groups")).toHaveTextContent("Wellbeing");
    expect(screen.getByLabelText("Device - High")).toHaveTextContent("Device");
    expect(screen.getByTestId("vitals-more-readings")).toHaveTextContent("More vitals");
    expect(screen.getByTestId("button-vitals-hero-add")).toHaveAccessibleName("Add reading");
    expect(screen.getByTestId("button-vitals-hero-add")).not.toHaveTextContent("Add reading");
    expect(screen.getByTestId("button-vitals-hero-add")).toHaveClass("right-6", "top-[26px]", "sm:right-8");

    fireEvent.click(screen.getByText("How VYVA connects your health signals"));
    expect(screen.getByTestId("vitals-evidence-guide")).toHaveTextContent("personal baseline");
    expect(screen.getByTestId("vitals-evidence-guide")).toHaveTextContent("signals that move together");
    expect(screen.getByTestId("vitals-evidence-guide")).toHaveTextContent("anticipate possible outcomes and flag risks");
  });

  it("opens a vital-first picker and keeps phone camera separate from device photo", () => {
    renderTracker();
    fireEvent.click(screen.getByTestId("button-vitals-hero-add"));

    expect(screen.getByRole("heading", { name: "What would you like to add?" })).toBeVisible();
    expect(screen.queryByText("Heart rate variability")).not.toBeInTheDocument();
    expect(screen.queryByText("Steps")).not.toBeInTheDocument();
    expect(screen.getAllByText("Blood pressure")).toHaveLength(2);
    expect(screen.queryByText("Blood pressure top number")).not.toBeInTheDocument();
    expect(screen.queryByText("Blood pressure bottom number")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Systolic blood pressure mmHg" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Diastolic blood pressure mmHg" })).toBeVisible();

    fireEvent.click(screen.getByTestId("button-vital-resting_hr_bpm"));
    expect(screen.getByTestId("vitals-method-picker")).toBeVisible();
    expect(screen.getByTestId("button-method-phone_camera")).toHaveTextContent("Phone camera");
    expect(screen.getByTestId("button-method-device_photo")).toHaveTextContent("Device photo");
    expect(screen.getByTestId("button-method-web_bluetooth")).toBeVisible();
  });

  it("uses the Rouast camera UI to return heart rate and breathing together", async () => {
    const onVoiceStateChange = vi.fn();
    (window as Window & { __VYVA_FACE_SCAN_TEST_DURATION_MS?: number }).__VYVA_FACE_SCAN_TEST_DURATION_MS = 1;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })),
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn(async () => undefined),
    });
    const data = new Uint8ClampedArray(40 * 40 * 4).fill(120);
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data })),
      })),
    });
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({
      proposed_readings: [
        {
          signal_type: "resting_hr_bpm",
          value: 70,
          unit: "bpm",
          context_tag: "resting",
          recorded_at: "2026-09-01T10:00:00.000Z",
          source: "phone_estimate",
          capture_method: "phone_camera",
          confidence: "medium",
          explanation: "VitalLens face-scan heart-rate estimate.",
          source_ref: { provider: "rouast_vitallens" },
        },
        {
          signal_type: "respiratory_rate",
          value: 15,
          unit: "/min",
          context_tag: "resting",
          recorded_at: "2026-09-01T10:00:00.000Z",
          source: "phone_estimate",
          capture_method: "phone_camera",
          confidence: "medium",
          explanation: "VitalLens face-scan breathing estimate.",
          source_ref: { provider: "rouast_vitallens" },
        },
      ],
      needs_confirmation: true,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    renderTracker(onVoiceStateChange);
    fireEvent.click(screen.getByTestId("button-vitals-hero-add"));
    fireEvent.click(screen.getByTestId("button-vital-resting_hr_bpm"));
    fireEvent.click(screen.getByTestId("button-method-phone_camera"));

    expect(screen.getByTestId("vital-lens-face-scan")).toHaveTextContent("Heart rate & breathing");
    fireEvent.click(screen.getByTestId("button-start-vital-lens-scan"));

    const confirmation = await screen.findByTestId("vitals-confirm-readings");
    expect(screen.getByRole("heading", { name: "Heart rate & breathing" })).toBeVisible();
    expect(confirmation).toHaveTextContent("Pulse: 70 bpm");
    expect(confirmation).toHaveTextContent("Breathing: 15 /min");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/vitals-engine/face-scan", expect.objectContaining({ method: "POST" }));
    await waitFor(() => expect(onVoiceStateChange).toHaveBeenCalledWith(expect.objectContaining({
      view: "add_reading",
      stage: "confirm",
      selectedSignal: "resting_hr_bpm",
      selectedSignalLabel: "Heart rate",
      captureMethod: "phone_camera",
      scanStatus: "complete",
      pendingReadings: expect.arrayContaining([
        expect.objectContaining({ signal: "resting_hr_bpm", value: 70 }),
        expect.objectContaining({ signal: "respiratory_rate", value: 15 }),
      ]),
    })));
  });

  it("localizes saved English safety and alert copy when the account language is French", () => {
    const frenchPreview: VitalsTrackerPreviewData = {
      analysis: {
        safety_status: "contact_doctor",
        recommended_action: "contact_doctor",
        risk_score: 62,
        senior_message: "VYVA noticed a change worth same-day medical advice. Share this summary if you can.",
      },
      recent_readings: [],
      latest_alert: {
        id: "alert-1",
        severity: "warning",
        message: "Symptom report: Douleur à la tête ou au cou\nNext: Rest the painful area.",
      },
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <VitalsTracker
          userId="preview-user"
          userConditions={[]}
          language="fr"
          gpName="Quiron"
          gpPhone="+34 612 345 678"
          gpEmail="gp@example.com"
          previewData={frenchPreview}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("vitals-hero")).not.toHaveTextContent("VYVA noticed a change worth same-day medical advice.");
    expect(screen.getByTestId("daily-safety-check")).toHaveTextContent("Rapport de symptômes : Douleur à la tête ou au cou");
    expect(screen.getByTestId("button-safety-call-gp")).toHaveTextContent("Appeler Quiron");
    expect(screen.getByTestId("button-safety-email-gp")).toHaveTextContent("Envoyer un e-mail au médecin");
    expect(screen.getByTestId("button-safety-doctor-help")).toHaveTextContent("Aide médicale");
    expect(screen.getByText("Autres options")).toBeVisible();
    expect(screen.getByTestId("button-safety-schedule-appointment")).toHaveTextContent("Prendre rendez-vous");
    expect(screen.getByTestId("button-safety-book-ride")).toHaveTextContent("Trouver un transport");
    expect(screen.queryByText(/VYVA noticed|Symptom report|Next:|Doctor help|Book appointment|Find transport/i)).not.toBeInTheDocument();
  });
});

describe("VitalsAddReadingFlow current-reading shortcut", () => {
  it("offers the log-anyway escape hatch for a current connected reading", () => {
    const currentReading = {
      signalType: "resting_hr_bpm" as const,
      value: 71,
      unit: "bpm",
      recordedAt: new Date().toISOString(),
      source: "connected_device" as const,
      captureMethod: "web_bluetooth" as const,
      confidence: "high" as const,
      qualityFlag: "clean",
      sourceRef: { device_name: "Heart monitor" },
      freshness: "current" as const,
    };
    const context: VitalsAcquisitionContext = {
      readings: [currentReading],
      signals: [{ signal_type: "resting_hr_bpm", current_reading: currentReading, compatible_methods: ["web_bluetooth", "phone_camera", "device_photo", "voice", "manual"] }],
      devices: [{ deviceName: "Heart monitor", capabilities: ["resting_hr_bpm"] }],
    };

    render(<VitalsAddReadingFlow previewMode previewContext={context} onBack={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByTestId("button-vital-resting_hr_bpm"));

    expect(screen.getByTestId("vitals-already-tracked")).toHaveTextContent("Heart rate is already being tracked via Heart monitor");
    fireEvent.click(screen.getByRole("button", { name: "Log anyway" }));
    expect(screen.getByTestId("vitals-method-picker")).toBeVisible();
  });
});
