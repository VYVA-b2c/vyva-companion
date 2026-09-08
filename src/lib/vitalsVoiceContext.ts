import type { VitalsCaptureMethod, VitalsSignalKey } from "../../shared/vitalsSignalCatalog";

export type VitalsVoiceStage = "vital" | "tracked" | "method" | "capture" | "confirm";

export type VitalsVoiceScanStatus =
  | "idle"
  | "camera"
  | "scanning"
  | "reading"
  | "complete"
  | "not_configured"
  | "failed"
  | "local_estimate";

export type VitalsVoiceReading = {
  signal: string;
  value: string | number;
  unit: string | null;
  source: string | null;
  confidence: string | null;
};

export type VitalsVoiceFlowState = {
  stage: VitalsVoiceStage;
  selectedSignal: VitalsSignalKey | null;
  selectedSignalLabel: string | null;
  captureMethod: VitalsCaptureMethod | null;
  scanStatus: VitalsVoiceScanStatus | null;
  pendingReadings: VitalsVoiceReading[];
  busy: boolean;
  listening: boolean;
};

export type VitalsVoiceUiState = {
  view: "dashboard" | "add_reading";
  stage: VitalsVoiceStage | null;
  selectedSignal: VitalsSignalKey | null;
  selectedSignalLabel: string | null;
  captureMethod: VitalsCaptureMethod | null;
  scanStatus: VitalsVoiceScanStatus | null;
  pendingReadings: VitalsVoiceReading[];
  safetyStatus: string | null;
  riskScore: number | null;
  recentReadings: VitalsVoiceReading[];
  busy: boolean;
  listening: boolean;
};

const EMPTY_VITALS_VOICE_STATE: VitalsVoiceUiState = {
  view: "dashboard",
  stage: null,
  selectedSignal: null,
  selectedSignalLabel: null,
  captureMethod: null,
  scanStatus: null,
  pendingReadings: [],
  safetyStatus: null,
  riskScore: null,
  recentReadings: [],
  busy: false,
  listening: false,
};

export function initialVitalsVoiceUiState(): VitalsVoiceUiState {
  return { ...EMPTY_VITALS_VOICE_STATE };
}

export function vitalsVoiceDynamicVariables(state: VitalsVoiceUiState): Record<string, string | number | boolean> {
  return {
    app_entrypoint: "vitals_canonical_header",
    health_focus: "vitals",
    voice_ui_state_json: JSON.stringify(state),
    vitals_ui_view: state.view,
    vitals_ui_stage: state.stage ?? "none",
    vitals_selected_signal: state.selectedSignal ?? "none",
    vitals_selected_signal_label: state.selectedSignalLabel ?? "none",
    vitals_capture_method: state.captureMethod ?? "none",
    vitals_scan_status: state.scanStatus ?? "none",
    vitals_has_pending_readings: state.pendingReadings.length > 0,
    vitals_pending_readings_confirmed: false,
    vitals_pending_readings_json: JSON.stringify(state.pendingReadings),
    vitals_safety_status: state.safetyStatus ?? "unknown",
    vitals_risk_score: state.riskScore ?? "unknown",
    vitals_recent_readings_json: JSON.stringify(state.recentReadings),
  };
}

export function vitalsVoiceContextHint(baseHint: string, state: VitalsVoiceUiState): string {
  const location = state.view === "dashboard"
    ? "The user is on the Vitals dashboard."
    : `The user is in the add-reading flow at the ${state.stage ?? "unknown"} step.`;
  const selection = state.selectedSignalLabel
    ? ` The selected vital is ${state.selectedSignalLabel}${state.captureMethod ? ` using ${state.captureMethod}` : ""}.`
    : "";
  const scan = state.scanStatus ? ` The camera scan state is ${state.scanStatus}.` : "";
  const pending = state.pendingReadings.length
    ? ` There are ${state.pendingReadings.length} pending reading${state.pendingReadings.length === 1 ? "" : "s"} visible for review. They are unconfirmed and not saved; never describe them as recorded or use them for triage until the user confirms them.`
    : " There are no pending unconfirmed readings.";

  return `${baseHint} ${location}${selection}${scan}${pending}`;
}

export function vitalsVoiceContextUpdate(state: VitalsVoiceUiState): string {
  return [
    `Current Vitals UI state: ${JSON.stringify(state)}.`,
    "Treat pendingReadings as visible draft values only: they are unconfirmed, unsaved, and must not affect triage until the user confirms them.",
  ].join(" ");
}
