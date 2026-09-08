import {
  VITALS_SIGNAL_CATALOG,
  type VitalsCaptureMethod,
  type VitalsSignalKey,
} from "./vitalsSignalCatalog.js";
import {
  vitalsEvidenceFor,
  type VitalsReadingSource,
  type VitalsSourceConfidence,
} from "./vitalsEvidence.js";

export const VITALS_CURRENT_WINDOW_MS = 30 * 60 * 1000;
export const VITALS_CONTEXT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type VitalsFreshness = "current" | "recent_context" | "history";
export type VitalsAcquisitionSurface = "triage" | "vitals" | "report";
export type VitalsAcquisitionMethod = VitalsCaptureMethod;

export type VitalsMeasurementEnvelope = {
  id?: string;
  signalType: VitalsSignalKey;
  value: number;
  unit: string;
  recordedAt: string;
  source: VitalsReadingSource;
  captureMethod: VitalsCaptureMethod;
  confidence: VitalsSourceConfidence;
  qualityFlag: string;
  sourceRef?: Record<string, unknown> | null;
  assessmentSessionId?: string | null;
  freshness: VitalsFreshness;
};

export type VitalsAcquisitionAdapter = {
  id: VitalsAcquisitionMethod;
  supportedSignals: readonly VitalsSignalKey[];
  isAvailable: (signal: VitalsSignalKey) => boolean;
};

export type VitalsProviderSyncAdapter = {
  id: string;
  transport: "native_bridge" | "vendor_cloud";
  supportedSignals: readonly VitalsSignalKey[];
  backgroundSyncAvailable: false;
  connect: () => Promise<{ externalDeviceId?: string; displayName?: string }>;
  syncForeground: () => Promise<VitalsMeasurementEnvelope[]>;
};

export const VITALS_PROVIDER_SYNC_POLICY = {
  backgroundSyncAvailable: false,
  releaseMode: "foreground_only",
} as const;

export const TRIAGE_VITAL_SIGNAL_MAP = {
  camera_vitals: ["resting_hr_bpm", "respiratory_rate"],
  pulse: ["resting_hr_bpm"],
  oxygen: ["oxygen_saturation"],
  blood_pressure: ["bp_systolic", "bp_diastolic"],
  temperature: ["temperature_c"],
  glucose: ["glucose_mgdl"],
} as const satisfies Record<string, readonly VitalsSignalKey[]>;

export const VITALS_DEVICE_CAPABILITIES = {
  bp_cuff: ["bp_systolic", "bp_diastolic", "resting_hr_bpm"],
  pulse_oximeter: ["oxygen_saturation", "resting_hr_bpm"],
  thermometer: ["temperature_c"],
  glucose_meter: ["glucose_mgdl"],
  weight_scale: ["weight_kg"],
  heart_monitor: ["resting_hr_bpm"],
} as const satisfies Record<string, readonly VitalsSignalKey[]>;

const PHONE_CAMERA_SIGNALS = new Set<VitalsSignalKey>([
  "resting_hr_bpm",
  "respiratory_rate",
  "hrv_ms",
]);

const DEVICE_PHOTO_SIGNALS = new Set<VitalsSignalKey>([
  "resting_hr_bpm",
  "respiratory_rate",
  "bp_systolic",
  "bp_diastolic",
  "oxygen_saturation",
  "temperature_c",
  "glucose_mgdl",
  "weight_kg",
]);

const BLUETOOTH_SIGNALS = new Set<VitalsSignalKey>([
  "resting_hr_bpm",
  "bp_systolic",
  "bp_diastolic",
  "oxygen_saturation",
  "temperature_c",
  "glucose_mgdl",
  "weight_kg",
]);

export function classifyVitalsFreshness(recordedAt: string | Date, now = new Date()): VitalsFreshness {
  const timestamp = recordedAt instanceof Date ? recordedAt.getTime() : Date.parse(recordedAt);
  if (!Number.isFinite(timestamp)) return "history";
  const age = Math.max(0, now.getTime() - timestamp);
  if (age <= VITALS_CURRENT_WINDOW_MS) return "current";
  if (age <= VITALS_CONTEXT_WINDOW_MS) return "recent_context";
  return "history";
}

export function compatibleCaptureMethods(signal: VitalsSignalKey): VitalsCaptureMethod[] {
  const methods: VitalsCaptureMethod[] = [];
  if (BLUETOOTH_SIGNALS.has(signal)) methods.push("web_bluetooth");
  if (PHONE_CAMERA_SIGNALS.has(signal)) methods.push("phone_camera");
  if (DEVICE_PHOTO_SIGNALS.has(signal)) methods.push("device_photo");
  if (!VITALS_SIGNAL_CATALOG[signal].futureReady || signal === "hrv_ms") {
    methods.push("voice", "manual");
  }
  return methods;
}

export function canReadingAffectTriage(reading: Pick<VitalsMeasurementEnvelope, "signalType" | "freshness" | "source" | "qualityFlag">) {
  if (reading.signalType === "hrv_ms" || reading.freshness !== "current" || reading.qualityFlag !== "clean") return false;
  return reading.source !== "phone_estimate";
}

export function measurementEnvelope(input: {
  id?: string;
  signalType: VitalsSignalKey;
  value: number | string;
  unit?: string | null;
  recordedAt: string | Date;
  source?: string | null;
  captureMethod?: string | null;
  qualityFlag?: string | null;
  sourceRef?: Record<string, unknown> | null;
  assessmentSessionId?: string | null;
}, now = new Date()): VitalsMeasurementEnvelope {
  const evidence = vitalsEvidenceFor(input.source, input.signalType);
  const recordedAt = input.recordedAt instanceof Date ? input.recordedAt.toISOString() : input.recordedAt;
  return {
    id: input.id,
    signalType: input.signalType,
    value: Number(input.value),
    unit: input.unit || VITALS_SIGNAL_CATALOG[input.signalType].unit,
    recordedAt,
    source: evidence.source,
    captureMethod: (input.captureMethod || "manual") as VitalsCaptureMethod,
    confidence: evidence.confidence,
    qualityFlag: input.qualityFlag || "clean",
    sourceRef: input.sourceRef,
    assessmentSessionId: input.assessmentSessionId,
    freshness: classifyVitalsFreshness(recordedAt, now),
  };
}

export function newestReadingBySignal(readings: VitalsMeasurementEnvelope[]) {
  const result = new Map<VitalsSignalKey, VitalsMeasurementEnvelope>();
  for (const reading of readings) {
    const current = result.get(reading.signalType);
    if (!current || Date.parse(reading.recordedAt) > Date.parse(current.recordedAt)) {
      result.set(reading.signalType, reading);
    }
  }
  return result;
}
