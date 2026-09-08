import type { TriageScanResult, TriageScanType } from "../../shared/triageScans.js";

export type TriageRuleLevel = "emergency" | "doctor_today" | "doctor_24_48" | "monitor";

export type TriageUrgency = "urgent" | "routine" | "monitor";

export type TriageEscalationSource = "symptom" | "vitals" | "profile" | "caregiver";

export type TriageRuleRiskFlags = {
  diabetes?: boolean;
  copd?: boolean;
  heartFailure?: boolean;
  heartDisease?: boolean;
  afib?: boolean;
  hypertension?: boolean;
  bloodThinner?: boolean;
  immunosuppressed?: boolean;
  cognitiveConcern?: boolean;
  kidneyDisease?: boolean;
  strokeHistory?: boolean;
  fallsFrailty?: boolean;
  parkinsonMobility?: boolean;
  osteoporosis?: boolean;
  cancerActive?: boolean;
  recentSurgery?: boolean;
  utiHistory?: boolean;
  liverDisease?: boolean;
  depressionAnxiety?: boolean;
  sedatingMedication?: boolean;
  opioidMedication?: boolean;
  diureticMedication?: boolean;
  steroidMedication?: boolean;
};

export type ProfileRiskFlags = Required<TriageRuleRiskFlags>;

export type TriageVitals = {
  abnormalPulse?: boolean;
  abnormalBreathingRate?: boolean;
  pulseBpm?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  temperatureC?: number;
  systolicBp?: number;
  diastolicBp?: number;
  glucoseMgdl?: number;
  painScore?: number;
  energyLevel?: number;
};

export type TriageRuleInput = TriageVitals & {
  locale: string;
  symptomId?: string;
  answerIds: Set<string>;
  risks: TriageRuleRiskFlags;
  hasCriticalRedFlag: boolean;
};

export type TriageRuleDecision = {
  level: TriageRuleLevel;
  urgency: TriageUrgency;
  nextStepLabel: string;
  reasons: string[];
  recommendations: string[];
  watchSigns: string[];
  profileConsiderations: string[];
  telemetry: TriageRuleTelemetry;
};

export type TriageRuleTelemetry = {
  ruleIdsFired: string[];
  profileModifiersApplied: string[];
  vitalsOverlaysApplied: string[];
  escalationSources: TriageEscalationSource[];
};

export type TriagePossiblePattern = {
  id: string;
  label: string;
  explanation: string;
  supportingAnswers: string[];
  clarifyingSigns: string[];
};

export type TriageClinicalHandoff = {
  summary: string;
  keyPoints: string[];
  questions: string[];
};

export type TriageSummary = {
  chiefComplaint: string;
  symptoms: string[];
  urgency: TriageUrgency;
  recommendations: string[];
  disclaimer: string;
  nextStepLabel?: string;
  nextStepLevel?: TriageRuleLevel;
  triageReasons?: string[];
  watchSigns?: string[];
  profileConsiderations?: string[];
  vitalsNotes?: string[];
  vitalsSnapshot?: import("../../shared/schema.js").TriageReportVitalsSnapshot | null;
  scanResults?: TriageScanResult[];
  scanNotes?: string[];
  interpretation?: string;
  possiblePatterns?: TriagePossiblePattern[];
  uncertainty?: string[];
  reassessmentWindow?: string;
  changePlanTriggers?: string[];
  clinicalHandoff?: TriageClinicalHandoff;
  evidenceSummary?: string;
  evidenceSources?: Array<{ title?: string; url?: string; year?: string; journal?: string }>;
  contextConfidence?: {
    score: number;
    label: string;
    reasons: string[];
    missing: string[];
  };
  contextSignals?: Array<{
    id: string;
    label: string;
    status: "available" | "missing" | "not_needed";
  }>;
  contextBrief?: string;
};

export type TriageWizardAnswer = {
  id: string;
  label: string;
  value: string;
  kind?: string;
};

export type TriageWizardContext = {
  mode?: "with_vitals" | "without_vitals";
  vitalsScanCompleted?: boolean;
  refineRequested?: boolean;
  previousSummary?: TriageSummary;
  vitals?: {
    bpm?: number | null;
    respiratoryRate?: number | null;
    oxygenSaturation?: number | null;
    temperatureC?: number | null;
    systolicBp?: number | null;
    diastolicBp?: number | null;
    glucoseMgdl?: number | null;
    painScore?: number | null;
    energyLevel?: number | null;
  };
  vitalsEvidence?: Partial<Record<
    "bpm" | "respiratoryRate" | "oxygenSaturation" | "temperatureC" | "systolicBp" | "diastolicBp" | "glucoseMgdl" | "painScore" | "energyLevel",
    { source: "phone_estimate" | "manual_entry" | "connected_device" | "clinical"; affectsTriage: boolean }
  >>;
  quickAnswers?: TriageWizardAnswer[];
  scanResults?: TriageScanResult[];
  declinedScanTypes?: TriageScanType[];
};

export type TriageHealthMemory = {
  healthContext?: string;
  careContext?: string;
  checkinContext?: string;
  conditions?: string;
  allergies?: string;
  medications?: string;
  devices?: string;
  latestVitals?: string;
  vitalsTrend?: string;
  latestSymptomReport?: string;
  recentSymptomReports?: string;
  medicationAdherence?: string;
  medicationInteraction?: string;
  recentHealthEvents?: string;
  latestMedicalVisit?: string;
  upcomingMedicalAppointment?: string;
  countryCode?: string;
};

export type TriageGuidanceConfidence = {
  score: number;
  label: string;
  reasons: string[];
  missing: string[];
};

export type TriageGuidanceSignal = {
  id: string;
  label: string;
  status: "available" | "missing" | "not_needed";
};

export type TriageGuidancePlan = {
  protocolId: string;
  protocolLabel: string;
  stage: WizardStage;
  priorityLabel: string;
  nextQuestionFocus: string;
  confidence: TriageGuidanceConfidence;
  profileContextUsed: boolean;
  usefulSignals: TriageGuidanceSignal[];
};

export type TriageSuggestionReasonCode =
  | "condition_match"
  | "medicine_match"
  | "recent_report"
  | "recent_vitals"
  | "fallback";

export type TriagePersonalizedSuggestion = {
  id: string;
  kind: "common_concern" | "health_improvement";
  label: string;
  description: string;
  tone: "purple" | "red" | "blue" | "amber" | "green";
  icon: "heart" | "wind" | "droplet" | "activity" | "pill" | "home" | "brain" | "stethoscope" | "shield" | "gauge";
  source: "profile" | "medications" | "recent_report" | "vitals" | "fallback";
  priority: number;
  reasonCode?: TriageSuggestionReasonCode;
  score?: number;
  initialClue?: string;
  route?: string;
};

export type TriageChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type WizardStage = "symptom" | "location" | "red_flag" | "duration" | "severity" | "trend" | "support" | "complete";

export type ProtocolRule = {
  ids: string[];
  level: TriageRuleLevel;
  reasonEn: string;
  reasonEs: string;
  recommendationEn?: string;
  recommendationEs?: string;
};

export type ProtocolProfileModifier = {
  risks: Array<keyof TriageRuleRiskFlags>;
  ids?: string[];
  level: TriageRuleLevel;
  reasonEn: string;
  reasonEs: string;
  recommendationEn?: string;
  recommendationEs?: string;
};

export type TriageProtocol = {
  symptomId: string;
  emergency: ProtocolRule[];
  doctorToday: ProtocolRule[];
  doctor24_48: ProtocolRule[];
  monitorCriteriaEn: string[];
  monitorCriteriaEs: string[];
  profileModifiers: ProtocolProfileModifier[];
};

export type RaiseTriageLevel = (
  nextLevel: TriageRuleLevel,
  reason: string,
  recommendation?: string,
  telemetry?: {
    ruleId?: string;
    source?: TriageEscalationSource;
    profileModifierId?: string;
    vitalsOverlayId?: string;
  },
) => void;

export type LocalizeTriageText = (
  locale: string,
  english: string,
  spanish: string,
) => string;
