import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VitalsScreen from "./VitalsScreen";

const mocks = vi.hoisted(() => ({
  trackerProps: vi.fn(),
  startVoice: vi.fn(),
  stopVoice: vi.fn(),
  sendContextUpdate: vi.fn(),
  voiceStatus: { current: "idle" as "idle" | "connected" },
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useOptionalVyvaVoice: () => ({
    status: mocks.voiceStatus.current,
    isConnecting: false,
    startVoice: mocks.startVoice,
    stopVoice: mocks.stopVoice,
    sendContextUpdate: mocks.sendContextUpdate,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: () => ({ data: { conditions: ["hypertension"] } }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    profile: {
      country: "GB",
      gpName: "Dr Smith",
      gpPhone: "+441234567890",
      gpEmail: "gp@example.com",
      caregiverContact: "+449876543210",
    },
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/components/VitalsTracker", () => ({
  default: (props: Record<string, unknown>) => {
    mocks.trackerProps(props);
    return <div data-testid="vitals-tracker">Vitals tracker</div>;
  },
}));

describe("VitalsScreen", () => {
  beforeEach(() => {
    mocks.trackerProps.mockClear();
    mocks.startVoice.mockClear();
    mocks.stopVoice.mockClear();
    mocks.sendContextUpdate.mockClear();
    mocks.voiceStatus.current = "idle";
  });

  it("updates an active voice session when the visible Vitals flow changes", () => {
    mocks.voiceStatus.current = "connected";
    render(
      <MemoryRouter>
        <VitalsScreen />
      </MemoryRouter>,
    );

    const latestTrackerProps = mocks.trackerProps.mock.calls.at(-1)?.[0] as {
      onVoiceStateChange: (state: Record<string, unknown>) => void;
    };
    act(() => {
      latestTrackerProps.onVoiceStateChange({
        view: "add_reading",
        stage: "capture",
        selectedSignal: "respiratory_rate",
        selectedSignalLabel: "Breathing rate",
        captureMethod: "phone_camera",
        scanStatus: "scanning",
        pendingReadings: [],
        safetyStatus: "steady",
        riskScore: 16,
        recentReadings: [],
        busy: true,
        listening: false,
      });
    });

    expect(mocks.sendContextUpdate).toHaveBeenLastCalledWith(expect.stringContaining('"scanStatus":"scanning"'));
    expect(mocks.sendContextUpdate).toHaveBeenLastCalledWith(expect.stringContaining("unconfirmed, unsaved"));
  });

  it("starts the health agent with the current add-reading and unconfirmed scan context", () => {
    render(
      <MemoryRouter>
        <VitalsScreen />
      </MemoryRouter>,
    );

    const latestTrackerProps = mocks.trackerProps.mock.calls.at(-1)?.[0] as {
      onVoiceStateChange: (state: Record<string, unknown>) => void;
    };
    act(() => {
      latestTrackerProps.onVoiceStateChange({
        view: "add_reading",
        stage: "confirm",
        selectedSignal: "resting_hr_bpm",
        selectedSignalLabel: "Heart rate",
        captureMethod: "phone_camera",
        scanStatus: "reading",
        pendingReadings: [{ signal: "resting_hr_bpm", value: 70, unit: "bpm", source: "phone_estimate", confidence: "medium" }],
        safetyStatus: "steady",
        riskScore: 16,
        recentReadings: [],
        busy: false,
        listening: false,
      });
    });
    fireEvent.click(screen.getByTestId("button-vitals-header-voice"));

    expect(mocks.startVoice).toHaveBeenCalledTimes(1);
    const [contextHint, , options] = mocks.startVoice.mock.calls[0];
    expect(contextHint).toContain("selected vital is Heart rate using phone_camera");
    expect(contextHint).toContain("unconfirmed and not saved");
    expect(options).toEqual(expect.objectContaining({
      agentSlug: "health",
      autoStartListening: true,
      dynamicVariables: expect.objectContaining({
        vitals_ui_view: "add_reading",
        vitals_ui_stage: "confirm",
        vitals_selected_signal: "resting_hr_bpm",
        vitals_scan_status: "reading",
        vitals_has_pending_readings: true,
        vitals_pending_readings_confirmed: false,
      }),
    }));
    expect(String(options.dynamicVariables.voice_ui_state_json)).toContain('"value":70');
  });

  it("renders the dedicated Vitals experience without Longevity content", () => {
    render(
      <MemoryRouter>
        <VitalsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Vitals" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Vitals" })).toHaveClass("font-display", "font-semibold");
    expect(screen.getByTestId("vitals-page")).toHaveAttribute("data-header-contract", "detail.voice-touch");
    expect(screen.getByTestId("vitals-page")).toHaveAttribute("data-shell-contract", "home.production");
    expect(screen.getByTestId("button-vitals-header-voice")).toHaveAccessibleName("Talk to VYVA");
    expect(screen.getByTestId("vitals-tracker")).toBeVisible();
    expect(screen.queryByText("Longevity Plan")).not.toBeInTheDocument();
    expect(mocks.trackerProps).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-123",
      userConditions: ["hypertension"],
      language: "en",
      country: "GB",
      gpName: "Dr Smith",
      gpPhone: "+441234567890",
      gpEmail: "gp@example.com",
      caregiverContact: "+449876543210",
    }));
  });

  it("renders representative readings for the local Vitals preview", () => {
    const previewData = {
      analysis: {
        safety_status: "steady" as const,
        senior_message: "Your latest readings look steady.",
      },
      recent_readings: [],
      latest_alert: null,
    };

    render(
      <MemoryRouter>
        <VitalsScreen
          previewData={previewData}
          previewConditions={["hypertension"]}
          backPath="/dev/home-master/health"
        />
      </MemoryRouter>,
    );

    expect(mocks.trackerProps).toHaveBeenCalledWith(expect.objectContaining({
      userId: "preview-user",
      userConditions: ["hypertension"],
      previewData,
    }));
  });
});
