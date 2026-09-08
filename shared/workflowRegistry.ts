import {
  CONCIERGE_PROVIDER_CATEGORIES,
  CONCIERGE_FLOW_REFERENCES,
  CONCIERGE_FLOW_REGISTRY,
  getConciergeFlowDefinition,
  type ConciergeFlowReference,
} from "./conciergeFlowRegistry";

export const APP_WORKFLOW_REFERENCES = {
  homeHub: "WF_HOME_HUB",
  healthHub: "WF_HEALTH_HUB",
  symptomCheck: "WF_HEALTH_SYMPTOM_CHECK",
  healthCheckin: "WF_HEALTH_CHECKIN",
  vitalsTracking: "WF_HEALTH_VITALS_TRACKING",
  medicationPlan: "WF_MEDICATION_PLAN",
  medicationAdherence: "WF_MEDICATION_ADHERENCE",
  medicationSafety: "WF_MEDICATION_SAFETY",
  medicationAddByVoice: "WF_MEDICATION_ADD_BY_VOICE",
  medicationSideEffects: "WF_MEDICATION_SIDE_EFFECTS",
  medicationHomeRemedies: "WF_MEDICATION_HOME_REMEDIES",
  medicationResearch: "WF_MEDICATION_RESEARCH",
  healthPrevention: "WF_HEALTH_PREVENTION",
  healthReports: "WF_HEALTH_REPORTS",
  visualScan: "WF_HEALTH_VISUAL_SCAN",
  doctorNextStep: "WF_HEALTH_DOCTOR_NEXT_STEP",
  mindMemoryHub: "WF_MIND_MEMORY_HUB",
  memoryGames: "WF_MEMORY_GAMES",
  attentionTraining: "WF_ATTENTION_TRAINING",
  executiveFunction: "WF_EXECUTIVE_FUNCTION",
  sharpenSenses: "WF_SHARPEN_SENSES",
  cognitiveAssessment: "WF_COGNITIVE_ASSESSMENT",
  relaxBreathe: "WF_RELAX_BREATHE",
  learningPlan: "WF_LEARNING_PLAN",
  learningTodayLesson: "WF_LEARNING_TODAY_LESSON",
  learningInterests: "WF_LEARNING_INTERESTS",
  learningReadAloud: "WF_LEARNING_READ_ALOUD",
  learningSaveForLater: "WF_LEARNING_SAVE_FOR_LATER",
  communityHub: "WF_COMMUNITY_HUB",
  socialRoomList: "WF_SOCIAL_ROOM_LIST",
  socialRoomEnter: "WF_SOCIAL_ROOM_ENTER",
  socialRoomMessage: "WF_SOCIAL_ROOM_MESSAGE",
  socialMatch: "WF_SOCIAL_MATCH",
  socialConnect: "WF_SOCIAL_CONNECT",
  socialAdvisor: "WF_SOCIAL_ADVISOR",
  shareStory: "WF_SOCIAL_SHARE_STORY",
  communityActivities: "WF_COMMUNITY_ACTIVITIES",
  movementRoomExercise: "WF_MOVEMENT_ROOM_EXERCISE",
  togetherSharePlan: "WF_TOGETHER_SHARE_PLAN",
  togetherPlanResponse: "WF_TOGETHER_PLAN_RESPONSE",
  togetherGentleReply: "WF_TOGETHER_GENTLE_REPLY",
  togetherPoll: "WF_TOGETHER_POLL",
  togetherComfortCheck: "WF_TOGETHER_COMFORT_CHECK",
  togetherSafety: "WF_TOGETHER_SAFETY",
  musicShareSong: "WF_MUSIC_SHARE_SONG",
  musicReact: "WF_MUSIC_REACT",
  gameMemoryMatch: "GAME_MEMORY_MATCH",
  gameSequenceMemory: "GAME_SEQUENCE_MEMORY",
  gameWordRecall: "GAME_WORD_RECALL",
  gameNumberMemory: "GAME_NUMBER_MEMORY",
  gameRoutineMemory: "GAME_ROUTINE_MEMORY",
  gameAssociationMemory: "GAME_ASSOCIATION_MEMORY",
  gameStoryRecall: "GAME_STORY_RECALL",
  gameRememberLater: "GAME_REMEMBER_LATER",
  gameCuriousMinds: "GAME_CURIOUS_MINDS",
  gameDualTaskWalk: "GAME_DUAL_TASK_WALK",
  gameRhythmTap: "GAME_RHYTHM_TAP",
  gameNumberTrails: "GAME_NUMBER_TRAILS",
  gameCategorySort: "GAME_CATEGORY_SORT",
  gameFaceName: "GAME_FACE_NAME",
  gameSpatialNavigator: "GAME_SPATIAL_NAVIGATOR",
  gameListenClosely: "GAME_LISTEN_CLOSELY",
  gameBreathGarden: "GAME_BREATH_GARDEN",
  gameScentMemory: "GAME_SCENT_MEMORY",
  trustedProviders: "WF_TRUSTED_PROVIDERS",
} as const;

export type AppWorkflowReference = typeof APP_WORKFLOW_REFERENCES[keyof typeof APP_WORKFLOW_REFERENCES];
export type WorkflowReference = AppWorkflowReference | ConciergeFlowReference;

export type WorkflowDomain =
  | "home"
  | "health"
  | "medication"
  | "mind_memory"
  | "learning"
  | "community"
  | "room"
  | "game"
  | "concierge"
  | "profile";

export const WORKFLOW_DOMAINS: WorkflowDomain[] = [
  "home",
  "health",
  "medication",
  "mind_memory",
  "learning",
  "community",
  "room",
  "game",
  "concierge",
  "profile",
];

export type WorkflowEntrySurface =
  | "main_card"
  | "sub_card"
  | "fast_help"
  | "room_action"
  | "health_action"
  | "learning_action"
  | "game_action"
  | "voice_action"
  | "profile_setup";

export const WORKFLOW_ENTRY_SURFACES: WorkflowEntrySurface[] = [
  "main_card",
  "sub_card",
  "fast_help",
  "room_action",
  "health_action",
  "learning_action",
  "game_action",
  "voice_action",
  "profile_setup",
];

export type WorkflowStatus = "ready" | "partial" | "planned" | "deferred";

export const WORKFLOW_STATUSES: WorkflowStatus[] = ["ready", "partial", "planned", "deferred"];

export type WorkflowCoverageState = "complete" | "partial" | "missing";
export type WorkflowFlowStatus = "ready" | "partial" | "ui_only" | "blocked";

export type WorkflowActionLevel = "light" | "guided" | "external_action" | "setup" | "admin";

export const WORKFLOW_ACTION_LEVELS: WorkflowActionLevel[] = [
  "light",
  "guided",
  "external_action",
  "setup",
  "admin",
];

export const WORKFLOW_ACTION_LEVEL_LABELS: Record<WorkflowActionLevel, string> = {
  light: "Light",
  guided: "Guided",
  external_action: "External action",
  setup: "Setup",
  admin: "Admin",
};

export const WORKFLOW_ACTION_LEVEL_RULES: Record<WorkflowActionLevel, string> = {
  light: "Open, save, complete, or resume inside VYVA without extra intake.",
  guided: "Ask missing details, prepare a summary, or review sensitive context before saving.",
  external_action: "Check provider or tool readiness, prepare the action, ask final confirmation, then capture outcome and receipt.",
  setup: "Collect user, caregiver, provider, consent, or tool readiness details that enable future flows.",
  admin: "Internal content or operations workflow, not a direct senior-facing action.",
};

export type WorkflowFallback =
  | "ask_user"
  | "open_setup"
  | "open_existing_screen"
  | "operator_review"
  | "choose_input_type"
  | "safe_block"
  | "none";

export type WorkflowProfileDataSource =
  | "basic_profile"
  | "language"
  | "timezone"
  | "health_profile"
  | "medications"
  | "vitals"
  | "mobility"
  | "care_team"
  | "trusted_providers"
  | "learning_interests"
  | "social_interests"
  | "home_address"
  | "documents_media"
  | "none";

export interface WorkflowDefinition {
  reference: WorkflowReference;
  domain: WorkflowDomain;
  title: string;
  summary: string;
  status: WorkflowStatus;
  requiredInfo: string[];
  fallbackIfMissing: WorkflowFallback[];
  confirmationRule: string;
  completionState: string;
  primaryRoute?: string;
  relatedConciergeFlow?: ConciergeFlowReference;
  nextStep?: string;
  actionLevel?: WorkflowActionLevel;
  setupRequirement?: string;
  findOptionsPath?: string;
  receiptMoment?: string;
  resumeBehavior?: string;
  profileDataSources?: WorkflowProfileDataSource[];
}

export interface WorkflowEntryPoint {
  id: string;
  workflow: WorkflowReference;
  surface: WorkflowEntrySurface;
  source: string;
  label: string;
  route?: string;
  suggestedFlow: string;
}

export interface WorkflowActionLookup {
  entryPointId: string;
  workflowReference: WorkflowReference;
  label: string;
  source: string;
  surface: WorkflowEntrySurface;
  route?: string;
  suggestedFlow: string;
  workflowTitle: string;
  domain: WorkflowDomain;
  status: WorkflowStatus;
  coverageState: WorkflowCoverageState;
  nextStep: string;
  completionState: string;
  confirmationRule: string;
  fallbackIfMissing: WorkflowFallback[];
  relatedConciergeFlow?: ConciergeFlowReference;
  actionLevel: WorkflowActionLevel;
  actionLevelLabel: string;
  actionLevelRule: string;
}

export interface WorkflowActionTarget {
  entryPointId?: string;
  workflow?: WorkflowReference;
  source?: string;
  surface?: WorkflowEntrySurface;
  route?: string;
  label?: string;
}

export interface WorkflowFlowMatrixRow {
  reference: WorkflowReference;
  domain: WorkflowDomain;
  title: string;
  currentStatus: WorkflowFlowStatus;
  currentStatusLabel: string;
  entryPoints: WorkflowEntryPoint[];
  requiredSetup: string;
  missingSetupFallback: string;
  findOptionsPath: string;
  confirmationRule: string;
  receiptMoment: string;
  resumeBehavior: string;
  nextStep: string;
  profileDataSources: WorkflowProfileDataSource[];
  profileDataSourceLabels: string;
}

export type WorkflowSetupFallbackChoiceKind =
  | "ask_detail"
  | "add_provider"
  | "add_trusted_contact"
  | "find_options"
  | "ask_family"
  | "open_existing_screen"
  | "operator_review"
  | "choose_input_type"
  | "safe_block"
  | "none";

export interface WorkflowSetupFallbackChoice {
  kind: WorkflowSetupFallbackChoiceKind;
  label: string;
  description: string;
  route?: string;
  state?: Record<string, unknown>;
}

export interface WorkflowSetupFallbackOptions {
  returnTo?: string;
}

export type WorkflowReadinessGateKind =
  | "setup_fallback"
  | "tool_readiness"
  | "profile_data"
  | "confirmation"
  | "receipt"
  | "resume";

export type WorkflowReadinessGateState = "ready" | "needs_attention";

export interface WorkflowReadinessGate {
  kind: WorkflowReadinessGateKind;
  label: string;
  detail: string;
  state: WorkflowReadinessGateState;
}

export interface WorkflowReadinessChecklistRow {
  reference: WorkflowReference;
  domain: WorkflowDomain;
  title: string;
  actionLevel: WorkflowActionLevel;
  gates: WorkflowReadinessGate[];
  needsAttention: WorkflowReadinessGateKind[];
}

export interface WorkflowCoverageCounts {
  total: number;
  complete: number;
  partial: number;
  missing: number;
}

export interface WorkflowCoverageSummary {
  workflows: WorkflowCoverageCounts;
  entryPoints: WorkflowCoverageCounts;
  byDomain: Record<WorkflowDomain, WorkflowCoverageCounts>;
  bySurface: Record<WorkflowEntrySurface, WorkflowCoverageCounts>;
  byStatus: Record<WorkflowStatus, number>;
  byActionLevel: Record<WorkflowActionLevel, number>;
  partialWorkflows: WorkflowReference[];
  missingWorkflows: WorkflowReference[];
}

export type WorkflowParityStatus =
  | "ready"
  | "partial"
  | "missing_resume"
  | "missing_confirmation"
  | "missing_setup_path"
  | "needs_tool_service";

export const WORKFLOW_PARITY_STATUSES: WorkflowParityStatus[] = [
  "ready",
  "partial",
  "missing_resume",
  "missing_confirmation",
  "missing_setup_path",
  "needs_tool_service",
];

export const WORKFLOW_PARITY_STATUS_LABELS: Record<WorkflowParityStatus, string> = {
  ready: "Ready",
  partial: "Partial",
  missing_resume: "Missing resume",
  missing_confirmation: "Missing confirmation",
  missing_setup_path: "Missing setup path",
  needs_tool_service: "Needs tool/service",
};

export type WorkflowReusablePattern =
  | "setup_choice_panel"
  | "return_resume_state"
  | "confirmation_receipt"
  | "action_readiness"
  | "manual_fallback";

export const WORKFLOW_REUSABLE_PATTERN_LABELS: Record<WorkflowReusablePattern, string> = {
  setup_choice_panel: "Setup choice panel",
  return_resume_state: "Return/resume state",
  confirmation_receipt: "Confirmation receipt",
  action_readiness: "Action readiness",
  manual_fallback: "Manual fallback",
};

export interface WorkflowParityAuditItem {
  workflowReference: WorkflowReference;
  domain: WorkflowDomain;
  title: string;
  status: WorkflowParityStatus;
  affectedEntryPointIds: string[];
  reusablePatterns: WorkflowReusablePattern[];
  backlogPriority: 1 | 2 | 3 | 4;
  evidence: string;
  nextStep: string;
}

export interface WorkflowParityAuditSummary {
  total: number;
  byStatus: Record<WorkflowParityStatus, number>;
  byDomain: Record<WorkflowDomain, Record<WorkflowParityStatus, number>>;
  ready: number;
  blocked: number;
}

function conciergeWorkflowDefinitions(): WorkflowDefinition[] {
  return CONCIERGE_FLOW_REGISTRY.map((flow) => ({
    reference: flow.reference,
    domain: "concierge",
    title: flow.actionName,
    summary: `Concierge flow using ${flow.tools.join(", ")} with final user control.`,
    status: flow.status,
    requiredInfo: flow.firstQuestions,
    fallbackIfMissing: flow.savedData.includes("trusted_provider") || flow.setupFocus ? ["open_setup", "operator_review"] : ["ask_user", "operator_review"],
    confirmationRule: flow.confirmationRule,
    completionState: "prepared, confirmed, handed off, and captured in Concierge history",
    primaryRoute: "/concierge",
    relatedConciergeFlow: flow.reference,
    nextStep: flow.nextImplementationStep,
  }));
}

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  ...conciergeWorkflowDefinitions(),
  {
    reference: APP_WORKFLOW_REFERENCES.homeHub,
    domain: "home",
    title: "Home hub",
    summary: "Primary four-card entry into Health, Mind & Memory, Community, and Concierge.",
    status: "ready",
    requiredInfo: [],
    fallbackIfMissing: ["none"],
    confirmationRule: "No confirmation needed; this opens a section.",
    completionState: "section opened",
    primaryRoute: "/",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.healthHub,
    domain: "health",
    title: "Health Plan hub",
    summary: "Health entry for symptoms, medicines, vitals, prevention, reports, and clinical next steps.",
    status: "ready",
    requiredInfo: [],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "Confirm only before contacting a provider or sharing health information.",
    completionState: "health action opened or saved",
    primaryRoute: "/health",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.symptomCheck,
    domain: "health",
    title: "Symptoms check",
    summary: "Guided symptom capture and advice routing.",
    status: "ready",
    requiredInfo: ["symptom", "severity", "timing"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Ask before escalating, sharing, or starting a Concierge handoff.",
    completionState: "symptom report saved",
    primaryRoute: "/health/symptom-check",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.healthCheckin,
    domain: "health",
    title: "Daily health check-in",
    summary: "Daily wellbeing check-in that can feed reports and care follow-up.",
    status: "ready",
    requiredInfo: ["today_status"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Ask before sharing the check-in outside the user account.",
    completionState: "check-in saved",
    primaryRoute: "/health/check-in",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.vitalsTracking,
    domain: "health",
    title: "Vitals tracking",
    summary: "Capture and review vitals such as blood pressure, pulse, oxygen, and weight.",
    status: "ready",
    requiredInfo: ["reading_type", "reading_value", "reading_time"],
    fallbackIfMissing: ["ask_user", "open_existing_screen"],
    confirmationRule: "Ask before sharing readings or creating a medical appointment task.",
    completionState: "vitals reading saved or reviewed",
    primaryRoute: "/health/vitals",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.medicationPlan,
    domain: "medication",
    title: "Medication plan",
    summary: "Medication list, schedule, reminders, dose tracking, and refill support.",
    status: "ready",
    requiredInfo: ["medicine_name", "schedule"],
    fallbackIfMissing: ["ask_user", "open_existing_screen"],
    confirmationRule: "Never suggest dose changes; ask before contacting a pharmacy or clinician.",
    completionState: "medicine saved, dose tracked, or medication view opened",
    primaryRoute: "/meds",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.medicationAdherence,
    domain: "medication",
    title: "Medication adherence",
    summary: "Review today's doses and adherence report.",
    status: "ready",
    requiredInfo: ["saved_medications"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "Ask before sharing adherence with another person.",
    completionState: "adherence reviewed",
    primaryRoute: "/meds/adherence-report",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.medicationSafety,
    domain: "medication",
    title: "Medication safety",
    summary: "Interaction checks, safety cases, and pharmacist/doctor questions.",
    status: "ready",
    requiredInfo: ["saved_medications"],
    fallbackIfMissing: ["open_existing_screen", "ask_user"],
    confirmationRule: "Do not change doses; prepare questions and ask before contacting anyone.",
    completionState: "safety guidance reviewed",
    primaryRoute: "/meds/interactions",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.medicationAddByVoice,
    domain: "medication",
    title: "Add medicine by voice",
    summary: "Capture a medicine from speech and save it after parsing.",
    status: "ready",
    requiredInfo: ["medicine_name"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Show parsed details before relying on them for reminders or reports.",
    completionState: "medicine parsed and saved",
    primaryRoute: "/meds",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.medicationSideEffects,
    domain: "medication",
    title: "Side effects to watch",
    summary: "Plain-language side effect questions tied to saved medicines.",
    status: "ready",
    requiredInfo: ["saved_medications"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "Prepare watch-outs only; escalate or contact only after user confirmation.",
    completionState: "side-effect guidance shown",
    primaryRoute: "/meds",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.medicationHomeRemedies,
    domain: "medication",
    title: "Home remedy questions",
    summary: "Safe questions to ask about non-drug support alongside medicines.",
    status: "ready",
    requiredInfo: ["saved_medications", "concern"],
    fallbackIfMissing: ["ask_user", "open_existing_screen"],
    confirmationRule: "Do not replace medicine; frame as questions for pharmacist or doctor.",
    completionState: "questions prepared",
    primaryRoute: "/meds",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.medicationResearch,
    domain: "medication",
    title: "Medication updates",
    summary: "Dated AEMPS, FDA, and PubMed records for saved medicines, with original sources and clinician discussion questions.",
    status: "ready",
    requiredInfo: ["saved_medications"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "Never advise changing a medicine or dose; require confirmation before adding sourced questions to an appointment handoff.",
    completionState: "dated source-backed updates reviewed or appointment questions prepared",
    primaryRoute: "/meds",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.healthPrevention,
    domain: "health",
    title: "Age Well prevention",
    summary: "Prevention guidance, risks, and next steps.",
    status: "ready",
    requiredInfo: ["profile_signals"],
    fallbackIfMissing: ["ask_user", "open_existing_screen"],
    confirmationRule: "Ask before creating provider tasks or sharing health context.",
    completionState: "prevention focus reviewed",
    primaryRoute: "/health/prevention",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.healthReports,
    domain: "health",
    title: "Health reports",
    summary: "Latest symptom, vitals, medication, and wellbeing reports.",
    status: "ready",
    requiredInfo: [],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "Ask before sharing a report.",
    completionState: "report opened",
    primaryRoute: "/informes",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.visualScan,
    domain: "health",
    title: "Visual scan",
    summary: "Shared Show VYVA review for photos, uploads, pasted text, links, documents, phone numbers, and company names.",
    status: "ready",
    requiredInfo: ["review_input", "concern"],
    fallbackIfMissing: ["choose_input_type", "ask_user", "operator_review"],
    confirmationRule: "Ask before uploading, sharing, or escalating the image.",
    completionState: "review result shown with confirmation-safe follow-up actions",
    primaryRoute: "/health",
    relatedConciergeFlow: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
    nextStep: "Extend the shared Show VYVA chooser to every screen that accepts photos, documents, text, or links.",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.doctorNextStep,
    domain: "health",
    title: "Talk doctor / clinical next step",
    summary: "Prepare a doctor conversation or appointment next step.",
    status: "ready",
    requiredInfo: ["reason", "urgency"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Ask before calling, booking, or sharing symptom context.",
    completionState: "doctor next step prepared",
    primaryRoute: "/health/doctor",
    relatedConciergeFlow: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
  },
  {
    reference: APP_WORKFLOW_REFERENCES.mindMemoryHub,
    domain: "mind_memory",
    title: "Mind & Memory hub",
    summary: "Entry point for memory games, reflexes, focus, senses, learning, and cognitive assessment.",
    status: "ready",
    requiredInfo: [],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to open an exercise; ask before sharing results.",
    completionState: "mind-memory action opened",
    primaryRoute: "/mind-memory",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.memoryGames,
    domain: "game",
    title: "Memory games",
    summary: "Recommended memory game plus manual memory exercises.",
    status: "ready",
    requiredInfo: ["game_choice_or_recommendation"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play; ask before sharing results.",
    completionState: "game session completed",
    primaryRoute: "/memory-games",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.attentionTraining,
    domain: "game",
    title: "Attention training",
    summary: "Attention and reflex exercises.",
    status: "ready",
    requiredInfo: ["exercise_choice"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play; ask before sharing results.",
    completionState: "attention exercise completed",
    primaryRoute: "/attention-boosters",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.executiveFunction,
    domain: "game",
    title: "Executive function",
    summary: "Planning, route, category, and name-matching exercises.",
    status: "ready",
    requiredInfo: ["exercise_choice"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play; ask before sharing results.",
    completionState: "executive exercise completed",
    primaryRoute: "/executive-function",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.sharpenSenses,
    domain: "game",
    title: "Sharpen Senses",
    summary: "Sound, breath, and scent activities.",
    status: "ready",
    requiredInfo: ["exercise_choice"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play; ask before sharing results.",
    completionState: "senses exercise completed",
    primaryRoute: "/senses",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.cognitiveAssessment,
    domain: "mind_memory",
    title: "Cognitive assessment",
    summary: "Guided assessment, results, recommendations, and follow-up.",
    status: "ready",
    requiredInfo: ["assessment_program_status"],
    fallbackIfMissing: ["ask_user", "open_existing_screen"],
    confirmationRule: "Ask before sharing assessment results.",
    completionState: "assessment completed or program joined",
    primaryRoute: "/mind-memory/cognitive-assessment",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.relaxBreathe,
    domain: "mind_memory",
    title: "Relax Breathe",
    summary: "Calm breathing activity.",
    status: "ready",
    requiredInfo: [],
    fallbackIfMissing: ["none"],
    confirmationRule: "No confirmation needed.",
    completionState: "breathing session completed",
    primaryRoute: "/activities/relax-breathe",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.learningPlan,
    domain: "learning",
    title: "Learn Something New",
    summary: "Senior empowerment learning plan with daily lessons and interests.",
    status: "ready",
    requiredInfo: ["interests", "learning_mode"],
    fallbackIfMissing: ["ask_user", "open_existing_screen"],
    confirmationRule: "Ask before changing the learning plan or sharing progress.",
    completionState: "learning plan started or lesson completed",
    primaryRoute: "/learn",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.learningTodayLesson,
    domain: "learning",
    title: "Today's lesson",
    summary: "Read, complete, and reflect on the current lesson.",
    status: "ready",
    requiredInfo: ["lesson"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to mark learned; ask before sharing.",
    completionState: "lesson completed",
    primaryRoute: "/learn",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.learningInterests,
    domain: "learning",
    title: "Learning interests",
    summary: "Choose learning categories and mode.",
    status: "ready",
    requiredInfo: ["interest_choice"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Confirm changes when replacing an active plan.",
    completionState: "interests saved",
    primaryRoute: "/learn",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.learningReadAloud,
    domain: "learning",
    title: "Read lesson aloud",
    summary: "Resumable lesson playback in the selected app language using the matching system voice.",
    status: "ready",
    requiredInfo: ["lesson"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed.",
    completionState: "lesson playback completed or safely paused for later",
    primaryRoute: "/learn",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.learningSaveForLater,
    domain: "learning",
    title: "Save lesson for later",
    summary: "Save a lesson from the current learning plan.",
    status: "ready",
    requiredInfo: ["lesson"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed.",
    completionState: "lesson saved",
    primaryRoute: "/learn",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.communityHub,
    domain: "community",
    title: "Community hub",
    summary: "Entry point for rooms, matching, experts, stories, and activities.",
    status: "ready",
    requiredInfo: [],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "Ask before connecting two people or sharing personal content.",
    completionState: "community action opened",
    primaryRoute: "/social-rooms",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.socialRoomList,
    domain: "community",
    title: "Room list",
    summary: "Browse available social rooms before entering one.",
    status: "ready",
    requiredInfo: [],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to browse.",
    completionState: "room list opened",
    primaryRoute: "/social-rooms/join-in",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.socialRoomEnter,
    domain: "room",
    title: "Enter social room",
    summary: "Open a room session and load room context.",
    status: "ready",
    requiredInfo: ["room_slug"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "Use room promise or safety acknowledgement when the room requires it.",
    completionState: "room entered",
    primaryRoute: "/social-rooms/:slug",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.socialRoomMessage,
    domain: "room",
    title: "Room message",
    summary: "Send a room message or ask VYVA inside a room.",
    status: "ready",
    requiredInfo: ["message"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Apply room safety and moderation rules before posting.",
    completionState: "message sent",
    primaryRoute: "/social-rooms/:slug",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.socialMatch,
    domain: "community",
    title: "Make friends / match",
    summary: "Match with another member around room, activity, reading, or game preferences.",
    status: "ready",
    requiredInfo: ["room_or_interest"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Ask before connecting or revealing personal contact details.",
    completionState: "match suggested",
    primaryRoute: "/social-rooms/kitchen-table",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.socialConnect,
    domain: "room",
    title: "Connect with member",
    summary: "Send a safe greeting or room-based connection.",
    status: "ready",
    requiredInfo: ["member", "message"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Ask before sending contact details or opening private contact.",
    completionState: "connection request sent",
    primaryRoute: "/social-rooms/:slug",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.socialAdvisor,
    domain: "community",
    title: "Ask an expert",
    summary: "Talk to a VYVA advisor or specialist.",
    status: "ready",
    requiredInfo: ["topic"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Ask before creating external follow-up.",
    completionState: "advisor chat opened",
    primaryRoute: "/social-rooms/experts",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.shareStory,
    domain: "community",
    title: "Share story",
    summary: "Capture a memory, song, or typed story and route it to the right room.",
    status: "ready",
    requiredInfo: ["story_or_prompt"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Ask before publishing shared content into a room.",
    completionState: "story shared",
    primaryRoute: "/social-rooms/share",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.communityActivities,
    domain: "community",
    title: "Community activities",
    summary: "Browse curated activities and what's on.",
    status: "ready",
    requiredInfo: ["activity_interest"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "Ask before booking, joining, or sharing details.",
    completionState: "activity opened or saved",
    primaryRoute: "/social-rooms/activities",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.movementRoomExercise,
    domain: "room",
    title: "Movement room exercise",
    summary: "Open a guided movement routine from a room or prevention action.",
    status: "ready",
    requiredInfo: ["exercise_id"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed; show safety guidance before movement.",
    completionState: "exercise opened",
    primaryRoute: "/social-rooms/morning-movement",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.togetherSharePlan,
    domain: "room",
    title: "Together Room share a plan",
    summary: "Create and post a plan or experience for others to join or maybe.",
    status: "ready",
    requiredInfo: ["idea", "category", "place", "time"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Review sensitive categories before posting and keep final post under user control.",
    completionState: "plan shared",
    primaryRoute: "/social-rooms/together-room",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.togetherPlanResponse,
    domain: "room",
    title: "Together Room join or maybe",
    summary: "Respond to a shared plan with join, maybe, or clear.",
    status: "ready",
    requiredInfo: ["plan_id", "response"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No external commitment until the plan is confirmed later.",
    completionState: "plan response saved",
    primaryRoute: "/social-rooms/together-room",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.togetherGentleReply,
    domain: "room",
    title: "Together Room gentle reply",
    summary: "Send a short supportive reply to a shared plan.",
    status: "ready",
    requiredInfo: ["plan_id", "reply_tone"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Apply room safety and moderation rules.",
    completionState: "reply saved",
    primaryRoute: "/social-rooms/together-room",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.togetherPoll,
    domain: "room",
    title: "Together Room vote",
    summary: "Vote on a room poll or make a vote from a room question.",
    status: "ready",
    requiredInfo: ["poll_id", "choice"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No external action; save the user's room choice.",
    completionState: "vote saved",
    primaryRoute: "/social-rooms/together-room",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.togetherComfortCheck,
    domain: "room",
    title: "Together Room comfort check",
    summary: "Save comfort needs such as listen first or easy access.",
    status: "ready",
    requiredInfo: ["comfort_need"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "No confirmation needed; user can update later.",
    completionState: "comfort preference saved",
    primaryRoute: "/social-rooms/together-room",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.togetherSafety,
    domain: "room",
    title: "Together Room safety report",
    summary: "Report an uncomfortable item, reply, or room situation.",
    status: "ready",
    requiredInfo: ["target", "reason"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Confirm report details before sending to moderation.",
    completionState: "safety report sent",
    primaryRoute: "/social-rooms/together-room",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.musicShareSong,
    domain: "room",
    title: "Music Room share song",
    summary: "Post a song or memory and start a music connection.",
    status: "ready",
    requiredInfo: ["song", "memory_or_cause"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Ask before posting into the room.",
    completionState: "song shared",
    primaryRoute: "/social-rooms/music-room",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.musicReact,
    domain: "room",
    title: "Music Room reaction",
    summary: "React to a music circle item.",
    status: "ready",
    requiredInfo: ["item_id", "reaction"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed beyond tap.",
    completionState: "reaction saved",
    primaryRoute: "/social-rooms/music-room",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.trustedProviders,
    domain: "profile",
    title: "Trusted providers",
    summary: "Save pharmacies, transport, doctors, home service, food, and other trusted contacts.",
    status: "ready",
    requiredInfo: ["provider_name", "category"],
    fallbackIfMissing: ["ask_user"],
    confirmationRule: "Saved contact permission never skips final user confirmation for bookings or messages.",
    completionState: "provider saved",
    primaryRoute: "/onboarding/profile/providers",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameMemoryMatch,
    domain: "game",
    title: "Visual memory",
    summary: "Find matching pairs.",
    status: "ready",
    requiredInfo: ["level"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/memory-games/memory_match",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameSequenceMemory,
    domain: "game",
    title: "Sequence memory",
    summary: "Remember and repeat an ordered sequence.",
    status: "ready",
    requiredInfo: ["level"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/memory-games/sequence_memory",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameWordRecall,
    domain: "game",
    title: "Word Recall",
    summary: "Study words, hide them, then recall what remains.",
    status: "ready",
    requiredInfo: ["level"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/memory-games/word_recall",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameNumberMemory,
    domain: "game",
    title: "Number Memory",
    summary: "Study digits, hide them, then enter the order.",
    status: "ready",
    requiredInfo: ["level"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/memory-games/number_memory",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameRoutineMemory,
    domain: "game",
    title: "Routine memory",
    summary: "Remember daily routine steps.",
    status: "ready",
    requiredInfo: ["level"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/memory-games/routine_memory",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameAssociationMemory,
    domain: "game",
    title: "Connections",
    summary: "Remember people, places, and practical details.",
    status: "ready",
    requiredInfo: ["level"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/memory-games/association_memory",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameStoryRecall,
    domain: "game",
    title: "Story Recall",
    summary: "Read or listen, answer, then retell the story.",
    status: "ready",
    requiredInfo: ["level"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/memory-games/story_recall",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameRememberLater,
    domain: "game",
    title: "Remember Later",
    summary: "Prospective memory game: remember a future action while continuing play.",
    status: "ready",
    requiredInfo: ["round"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/memory-games/remember-later",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameCuriousMinds,
    domain: "game",
    title: "Curious Minds",
    summary: "Short curiosity prompts and recall.",
    status: "ready",
    requiredInfo: ["prompt"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/memory-games/curious-minds",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameDualTaskWalk,
    domain: "game",
    title: "Dual Task Walk",
    summary: "Walking and attention dual-task practice.",
    status: "ready",
    requiredInfo: ["level"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play; show safety guidance.",
    completionState: "game session saved",
    primaryRoute: "/dual-task-walk",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameRhythmTap,
    domain: "game",
    title: "Rhythm Tap",
    summary: "Tap along to a rhythm sequence.",
    status: "ready",
    requiredInfo: ["level"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/attention-boosters/rhythm-tap",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameNumberTrails,
    domain: "game",
    title: "Number Trails",
    summary: "Follow ordered number and letter trails.",
    status: "ready",
    requiredInfo: ["tier"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/executive-function/number-trails",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameCategorySort,
    domain: "game",
    title: "Category Sort",
    summary: "Sort items into categories.",
    status: "ready",
    requiredInfo: ["level"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/executive-function/category-sort",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameFaceName,
    domain: "game",
    title: "Face Name Match",
    summary: "Match faces and names.",
    status: "ready",
    requiredInfo: ["round"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/face-name-match",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameSpatialNavigator,
    domain: "game",
    title: "Spatial Navigator",
    summary: "Navigate spatial patterns.",
    status: "ready",
    requiredInfo: ["round"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/spatial-navigator",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameListenClosely,
    domain: "game",
    title: "Listen Closely",
    summary: "Sound attention game.",
    status: "ready",
    requiredInfo: ["round"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/senses/listen-closely",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameBreathGarden,
    domain: "game",
    title: "Breath Garden",
    summary: "Calm breathing game.",
    status: "ready",
    requiredInfo: ["round"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/senses/breath-garden",
  },
  {
    reference: APP_WORKFLOW_REFERENCES.gameScentMemory,
    domain: "game",
    title: "Scent Memory",
    summary: "Recall a familiar scent and memory.",
    status: "ready",
    requiredInfo: ["prompt"],
    fallbackIfMissing: ["open_existing_screen"],
    confirmationRule: "No confirmation needed to play.",
    completionState: "game session saved",
    primaryRoute: "/senses/scent-memory",
  },
];

const LIGHT_WORKFLOW_REFERENCES = new Set<WorkflowReference>([
  APP_WORKFLOW_REFERENCES.homeHub,
  APP_WORKFLOW_REFERENCES.healthHub,
  APP_WORKFLOW_REFERENCES.mindMemoryHub,
  APP_WORKFLOW_REFERENCES.memoryGames,
  APP_WORKFLOW_REFERENCES.attentionTraining,
  APP_WORKFLOW_REFERENCES.executiveFunction,
  APP_WORKFLOW_REFERENCES.sharpenSenses,
  APP_WORKFLOW_REFERENCES.relaxBreathe,
  APP_WORKFLOW_REFERENCES.learningPlan,
  APP_WORKFLOW_REFERENCES.learningTodayLesson,
  APP_WORKFLOW_REFERENCES.learningReadAloud,
  APP_WORKFLOW_REFERENCES.learningSaveForLater,
  APP_WORKFLOW_REFERENCES.communityHub,
  APP_WORKFLOW_REFERENCES.socialRoomList,
  APP_WORKFLOW_REFERENCES.socialRoomEnter,
  APP_WORKFLOW_REFERENCES.musicReact,
  APP_WORKFLOW_REFERENCES.vitalsTracking,
  APP_WORKFLOW_REFERENCES.medicationPlan,
  APP_WORKFLOW_REFERENCES.medicationAdherence,
  APP_WORKFLOW_REFERENCES.healthPrevention,
  APP_WORKFLOW_REFERENCES.healthReports,
  APP_WORKFLOW_REFERENCES.gameMemoryMatch,
  APP_WORKFLOW_REFERENCES.gameSequenceMemory,
  APP_WORKFLOW_REFERENCES.gameWordRecall,
  APP_WORKFLOW_REFERENCES.gameNumberMemory,
  APP_WORKFLOW_REFERENCES.gameRoutineMemory,
  APP_WORKFLOW_REFERENCES.gameAssociationMemory,
  APP_WORKFLOW_REFERENCES.gameStoryRecall,
  APP_WORKFLOW_REFERENCES.gameRememberLater,
  APP_WORKFLOW_REFERENCES.gameCuriousMinds,
  APP_WORKFLOW_REFERENCES.gameDualTaskWalk,
  APP_WORKFLOW_REFERENCES.gameRhythmTap,
  APP_WORKFLOW_REFERENCES.gameNumberTrails,
  APP_WORKFLOW_REFERENCES.gameCategorySort,
  APP_WORKFLOW_REFERENCES.gameFaceName,
  APP_WORKFLOW_REFERENCES.gameSpatialNavigator,
  APP_WORKFLOW_REFERENCES.gameListenClosely,
  APP_WORKFLOW_REFERENCES.gameBreathGarden,
  APP_WORKFLOW_REFERENCES.gameScentMemory,
]);

const SETUP_WORKFLOW_REFERENCES = new Set<WorkflowReference>([
  APP_WORKFLOW_REFERENCES.trustedProviders,
]);

const EXTERNAL_ACTION_WORKFLOW_REFERENCES = new Set<WorkflowReference>([
  APP_WORKFLOW_REFERENCES.doctorNextStep,
]);

export const WORKFLOW_ENTRY_POINTS: WorkflowEntryPoint[] = [
  { id: "home.route.root", workflow: APP_WORKFLOW_REFERENCES.homeHub, surface: "main_card", source: "AppRoutes", label: "Home", route: "/", suggestedFlow: "Open the main home hub." },
  { id: "home.card.health", workflow: APP_WORKFLOW_REFERENCES.healthHub, surface: "main_card", source: "HomeScreen", label: "My Health", route: "/health", suggestedFlow: "Open Health Plan hub." },
  { id: "home.card.mind-memory", workflow: APP_WORKFLOW_REFERENCES.mindMemoryHub, surface: "main_card", source: "HomeScreen", label: "My Mind", route: "/mind-memory", suggestedFlow: "Open Mind & Memory hub." },
  { id: "home.card.community", workflow: APP_WORKFLOW_REFERENCES.communityHub, surface: "main_card", source: "HomeScreen", label: "My Community", route: "/social-rooms", suggestedFlow: "Open Community hub." },
  { id: "home.card.concierge", workflow: CONCIERGE_FLOW_REFERENCES.toolGatedTask, surface: "main_card", source: "HomeScreen", label: "My Concierge", route: "/concierge", suggestedFlow: "Open Concierge and ask what the user needs." },
  { id: "home.fast.symptoms", workflow: APP_WORKFLOW_REFERENCES.symptomCheck, surface: "fast_help", source: "HomeScreen", label: "Symptom Check", route: "/health/symptom-check", suggestedFlow: "Start symptom check." },
  { id: "home.fast.age-well", workflow: APP_WORKFLOW_REFERENCES.healthPrevention, surface: "fast_help", source: "HomeScreen", label: "Age Well", route: "/health/prevention", suggestedFlow: "Open prevention focus." },
  { id: "home.fast.find-care", workflow: CONCIERGE_FLOW_REFERENCES.careNavigation, surface: "fast_help", source: "HomeScreen", label: "Find Care", route: "/concierge", suggestedFlow: "Collect care type, location, preferences, then prepare options." },
  { id: "home.fast.book-ride", workflow: CONCIERGE_FLOW_REFERENCES.transportBooking, surface: "fast_help", source: "HomeScreen", label: "Book Ride", route: "/concierge", suggestedFlow: "Ask destination, pickup, time, mobility needs, then confirm before booking." },
  { id: "home.fast.paperwork-help", workflow: CONCIERGE_FLOW_REFERENCES.insuranceAdmin, surface: "fast_help", source: "HomeScreen", label: "Paperwork Help", route: "/concierge", suggestedFlow: "Identify form or admin task, gather missing details, prepare before sending." },
  { id: "home.fast.safe-home", workflow: CONCIERGE_FLOW_REFERENCES.safeHomeSupport, surface: "fast_help", source: "HomeScreen", label: "Safe Home", route: "/safe-home", suggestedFlow: "Open safety support and ask what feels unsafe." },
  { id: "health.card.symptoms", workflow: APP_WORKFLOW_REFERENCES.symptomCheck, surface: "sub_card", source: "HealthScreen", label: "Symptom Check", route: "/health/symptom-check", suggestedFlow: "Start symptom check or open latest advice." },
  { id: "health.card.medication", workflow: APP_WORKFLOW_REFERENCES.medicationPlan, surface: "sub_card", source: "HealthScreen", label: "My Medication", route: "/meds", suggestedFlow: "Open medication plan and dose status." },
  { id: "health.card.vitals", workflow: APP_WORKFLOW_REFERENCES.vitalsTracking, surface: "sub_card", source: "HealthScreen", label: "My Vitals", route: "/health/vitals", suggestedFlow: "Open vitals capture and review." },
  { id: "health.card.age-well", workflow: APP_WORKFLOW_REFERENCES.healthPrevention, surface: "sub_card", source: "HealthScreen", label: "Age Well", route: "/health/prevention", suggestedFlow: "Open prevention plan." },
  { id: "health.action.checkin", workflow: APP_WORKFLOW_REFERENCES.healthCheckin, surface: "health_action", source: "HealthScreen", label: "Check-in", route: "/health/check-in", suggestedFlow: "Start or review daily check-in." },
  { id: "health.action.medicine", workflow: APP_WORKFLOW_REFERENCES.medicationPlan, surface: "health_action", source: "HealthScreen", label: "Medicine", route: "/meds", suggestedFlow: "Open medicine schedule." },
  { id: "health.action.vitals", workflow: APP_WORKFLOW_REFERENCES.vitalsTracking, surface: "health_action", source: "HealthScreen", label: "Vitals", route: "/health/vitals", suggestedFlow: "Add or review a vital reading." },
  { id: "health.action.symptoms", workflow: APP_WORKFLOW_REFERENCES.symptomCheck, surface: "health_action", source: "HealthScreen", label: "Symptoms", route: "/health/symptom-check", suggestedFlow: "Open latest symptom advice or start a check." },
  { id: "health.fast.reports", workflow: APP_WORKFLOW_REFERENCES.healthReports, surface: "fast_help", source: "HealthScreen", label: "My Reports", route: "/informes", suggestedFlow: "Open latest report." },
  { id: "health.fast.visual-scan", workflow: APP_WORKFLOW_REFERENCES.visualScan, surface: "fast_help", source: "HealthScreen", label: "Visual Scan", route: "/health", suggestedFlow: "Open photo review panel." },
  { id: "health.action.show-vyva", workflow: APP_WORKFLOW_REFERENCES.visualScan, surface: "health_action", source: "HealthScreen", label: "Show VYVA", route: "/health", suggestedFlow: "Choose camera, upload, or pasted text, then route to visual scan or Concierge review with confirmation." },
  { id: "health.fast.find-specialist", workflow: CONCIERGE_FLOW_REFERENCES.careNavigation, surface: "fast_help", source: "HealthScreen", label: "Find Specialist", route: "/health", suggestedFlow: "Ask specialty, proximity, reputation, coverage, then prepare options." },
  { id: "health.fast.book-medical", workflow: CONCIERGE_FLOW_REFERENCES.medicalAppointment, surface: "fast_help", source: "HealthScreen", label: "Book Medical", route: "/concierge", suggestedFlow: "Ask reason and time, use saved doctor/clinic if present, then confirm before booking." },
  { id: "health.fast.check-vitals", workflow: APP_WORKFLOW_REFERENCES.vitalsTracking, surface: "fast_help", source: "HealthScreen", label: "Check Vitals", route: "/health/vitals", suggestedFlow: "Open vitals capture." },
  { id: "health.fast.talk-doctor", workflow: APP_WORKFLOW_REFERENCES.doctorNextStep, surface: "fast_help", source: "HealthScreen", label: "Talk Doctor", route: "/health/doctor", suggestedFlow: "Prepare clinical next step and route to doctor support." },
  { id: "meds.card.my-medicines", workflow: APP_WORKFLOW_REFERENCES.medicationPlan, surface: "sub_card", source: "MedsScreen", label: "My Medicines", route: "/meds/my-medicines", suggestedFlow: "Open saved medicines." },
  { id: "meds.card.adherence", workflow: APP_WORKFLOW_REFERENCES.medicationAdherence, surface: "sub_card", source: "MedsScreen", label: "My Adherence", route: "/meds/adherence-report", suggestedFlow: "Open adherence report." },
  { id: "meds.card.refills", workflow: CONCIERGE_FLOW_REFERENCES.otcPharmacy, surface: "sub_card", source: "MedsScreen", label: "My Refills", route: "/concierge/shopping", suggestedFlow: "Keep prescription medicines blocked; help only with allowed OTC or pharmacy-safe support." },
  { id: "meds.card.interactions", workflow: APP_WORKFLOW_REFERENCES.medicationSafety, surface: "sub_card", source: "MedsScreen", label: "Safety Check", route: "/meds/interactions", suggestedFlow: "Open medicine interaction safety check." },
  { id: "meds.fast.interactions", workflow: APP_WORKFLOW_REFERENCES.medicationSafety, surface: "fast_help", source: "MedsScreen", label: "Check Interactions", route: "/meds/interactions", suggestedFlow: "Review medicine mix and prepare pharmacist/doctor questions." },
  { id: "meds.fast.side-effects", workflow: APP_WORKFLOW_REFERENCES.medicationSideEffects, surface: "fast_help", source: "MedsScreen", label: "Side Effects", route: "/meds", suggestedFlow: "Explain watch-outs in plain language." },
  { id: "meds.fast.refill-help", workflow: CONCIERGE_FLOW_REFERENCES.otcPharmacy, surface: "fast_help", source: "MedsScreen", label: "Refill Help", route: "/concierge/shopping", suggestedFlow: "Use safe pharmacy help; do not handle prescription medicines without supported setup." },
  { id: "meds.fast.add-medicine", workflow: APP_WORKFLOW_REFERENCES.medicationAddByVoice, surface: "fast_help", source: "MedsScreen", label: "Add Medicine", route: "/meds", suggestedFlow: "Capture voice, parse medicine details, then save." },
  { id: "meds.fast.home-remedies", workflow: APP_WORKFLOW_REFERENCES.medicationHomeRemedies, surface: "fast_help", source: "MedsScreen", label: "Home Remedies", route: "/meds", suggestedFlow: "Prepare safe questions, never replace medicine." },
  { id: "meds.fast.research", workflow: APP_WORKFLOW_REFERENCES.medicationResearch, surface: "fast_help", source: "MedsScreen", label: "Medication Research", route: "/meds", suggestedFlow: "Check dated AEMPS, FDA, and PubMed records, preserve direct sources, and prepare clinician questions without dosing advice." },
  { id: "mind.card.strengthen-memory", workflow: APP_WORKFLOW_REFERENCES.memoryGames, surface: "sub_card", source: "MindMemoryScreen", label: "Strengthen Memory", route: "/memory-games", suggestedFlow: "Open memory games." },
  { id: "mind.card.train-reflexes", workflow: APP_WORKFLOW_REFERENCES.attentionTraining, surface: "sub_card", source: "MindMemoryScreen", label: "Train Reflexes", route: "/attention-boosters", suggestedFlow: "Open attention training." },
  { id: "mind.card.boost-focus", workflow: APP_WORKFLOW_REFERENCES.executiveFunction, surface: "sub_card", source: "MindMemoryScreen", label: "Improve Thinking", route: "/executive-function", suggestedFlow: "Open executive function exercises." },
  { id: "mind.card.sharpen-senses", workflow: APP_WORKFLOW_REFERENCES.sharpenSenses, surface: "sub_card", source: "MindMemoryScreen", label: "Sharpen Senses", route: "/senses", suggestedFlow: "Open senses exercises." },
  { id: "mind.fast.relax-breathe", workflow: APP_WORKFLOW_REFERENCES.relaxBreathe, surface: "fast_help", source: "MindMemoryScreen", label: "Relax Breathe", route: "/activities/relax-breathe", suggestedFlow: "Start calm breathing." },
  { id: "mind.fast.learn-words", workflow: APP_WORKFLOW_REFERENCES.learningPlan, surface: "fast_help", source: "MindMemoryScreen", label: "Learn Words", route: "/learn", suggestedFlow: "Open learning plan." },
  { id: "mind.fast.cognitive-assessment", workflow: APP_WORKFLOW_REFERENCES.cognitiveAssessment, surface: "fast_help", source: "MindMemoryScreen", label: "Cognitive Assessment", route: "/mind-memory/cognitive-assessment", suggestedFlow: "Open or continue assessment." },
  { id: "mind.fast.play-game", workflow: APP_WORKFLOW_REFERENCES.memoryGames, surface: "fast_help", source: "MindMemoryScreen", label: "Play Game", route: "/memory-games", suggestedFlow: "Open recommended game." },
  { id: "mind.fast.listen-closely", workflow: APP_WORKFLOW_REFERENCES.gameListenClosely, surface: "fast_help", source: "MindMemoryScreen", label: "Listen Closely", route: "/senses/listen-closely", suggestedFlow: "Start sound practice." },
  { id: "mind.fast.calm-focus", workflow: APP_WORKFLOW_REFERENCES.attentionTraining, surface: "fast_help", source: "MindMemoryScreen", label: "Calm Focus", route: "/attention-boosters", suggestedFlow: "Open quiet attention practice." },
  { id: "learn.action.start-plan", workflow: APP_WORKFLOW_REFERENCES.learningPlan, surface: "learning_action", source: "LearnSomethingNewPage", label: "Start learning plan", route: "/learn", suggestedFlow: "Choose interests, rhythm, and mode, then start plan." },
  { id: "learn.action.today-lesson", workflow: APP_WORKFLOW_REFERENCES.learningTodayLesson, surface: "learning_action", source: "LearnSomethingNewPage", label: "Today's lesson", route: "/learn", suggestedFlow: "Read lesson and reflection prompt." },
  { id: "learn.action.change-interests", workflow: APP_WORKFLOW_REFERENCES.learningInterests, surface: "learning_action", source: "LearnSomethingNewPage", label: "Change interests", route: "/learn", suggestedFlow: "Open plan settings and update interests." },
  { id: "learn.action.learned", workflow: APP_WORKFLOW_REFERENCES.learningTodayLesson, surface: "learning_action", source: "LearnSomethingNewPage", label: "I learned this", route: "/learn", suggestedFlow: "Save lesson completion event." },
  { id: "learn.action.read-aloud", workflow: APP_WORKFLOW_REFERENCES.learningReadAloud, surface: "learning_action", source: "LearnSomethingNewPage", label: "Read aloud", route: "/learn", suggestedFlow: "Read current lesson aloud." },
  { id: "learn.action.save-for-later", workflow: APP_WORKFLOW_REFERENCES.learningSaveForLater, surface: "learning_action", source: "LearnSomethingNewPage", label: "Save for later", route: "/learn", suggestedFlow: "Save the lesson." },
  { id: "community.card.match", workflow: APP_WORKFLOW_REFERENCES.socialMatch, surface: "sub_card", source: "SocialHub", label: "Make Friends", route: "/social-rooms/kitchen-table", suggestedFlow: "Open matching room and suggest a safe greeting." },
  { id: "community.card.experts", workflow: APP_WORKFLOW_REFERENCES.socialAdvisor, surface: "sub_card", source: "SocialHub", label: "Ask an Expert", route: "/social-rooms/experts", suggestedFlow: "Choose advisor and open chat." },
  { id: "community.card.share", workflow: APP_WORKFLOW_REFERENCES.shareStory, surface: "sub_card", source: "SocialHub", label: "Share Stories", route: "/social-rooms/share", suggestedFlow: "Capture story or song and route to room." },
  { id: "community.card.activities", workflow: APP_WORKFLOW_REFERENCES.communityActivities, surface: "sub_card", source: "SocialHub", label: "What's On", route: "/social-rooms/activities", suggestedFlow: "Open curated activities." },
  { id: "community.fast.bring-song", workflow: APP_WORKFLOW_REFERENCES.musicShareSong, surface: "fast_help", source: "SocialHub", label: "Bring Song", route: "/social-rooms/music-room", suggestedFlow: "Open Music Room and share a song." },
  { id: "community.fast.cook-together", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "fast_help", source: "SocialHub", label: "Cook Together", route: "/social-rooms/kitchen-table", suggestedFlow: "Open Kitchen Table room." },
  { id: "community.fast.garden-chat", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "fast_help", source: "SocialHub", label: "Garden Chat", route: "/social-rooms/garden-corner", suggestedFlow: "Open Garden room." },
  { id: "community.fast.reading-corner", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "fast_help", source: "SocialHub", label: "Reading Corner", route: "/social-rooms/reading-room", suggestedFlow: "Open Reading Room." },
  { id: "community.fast.light-game", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "fast_help", source: "SocialHub", label: "Light Game", route: "/social-rooms/kitchen-table", suggestedFlow: "Open social game/chat room." },
  { id: "community.fast.move-together", workflow: APP_WORKFLOW_REFERENCES.movementRoomExercise, surface: "fast_help", source: "SocialHub", label: "Move Together", route: "/social-rooms/morning-movement", suggestedFlow: "Open movement room." },
  { id: "room.list.open", workflow: APP_WORKFLOW_REFERENCES.socialRoomList, surface: "room_action", source: "SocialRoomsOnlyScreen", label: "Room list", route: "/social-rooms/join-in", suggestedFlow: "Browse rooms and enter one." },
  { id: "room.enter.garden", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "room_action", source: "SocialHub", label: "Garden Corner", route: "/social-rooms/garden-corner", suggestedFlow: "Enter room." },
  { id: "room.enter.games", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "room_action", source: "SocialHub", label: "Games Room", route: "/social-rooms/games-room", suggestedFlow: "Enter room." },
  { id: "room.enter.kitchen", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "room_action", source: "SocialHub", label: "Kitchen Table", route: "/social-rooms/kitchen-table", suggestedFlow: "Enter room." },
  { id: "room.enter.movement", workflow: APP_WORKFLOW_REFERENCES.movementRoomExercise, surface: "room_action", source: "SocialHub", label: "Morning Movement", route: "/social-rooms/morning-movement", suggestedFlow: "Enter movement room or choose exercise." },
  { id: "room.enter.evening", workflow: APP_WORKFLOW_REFERENCES.relaxBreathe, surface: "room_action", source: "SocialHub", label: "Evening Wind Down", route: "/social-rooms/evening-wind-down", suggestedFlow: "Enter calm room and start breathing if desired." },
  { id: "room.enter.music", workflow: APP_WORKFLOW_REFERENCES.musicShareSong, surface: "room_action", source: "SocialHub", label: "Music Room", route: "/social-rooms/music-room", suggestedFlow: "Enter music room." },
  { id: "room.enter.reading", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "room_action", source: "SocialHub", label: "Reading Room", route: "/social-rooms/reading-room", suggestedFlow: "Enter reading room." },
  { id: "room.enter.memory-lane", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "room_action", source: "SocialHub", label: "Memory Lane", route: "/social-rooms/memory-lane", suggestedFlow: "Enter memory room." },
  { id: "room.enter.morning-circle", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "room_action", source: "SocialHub", label: "Morning Circle", route: "/social-rooms/morning-circle", suggestedFlow: "Enter daily circle." },
  { id: "room.enter.news", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "room_action", source: "SocialHub", label: "News", route: "/social-rooms/news-world-affairs", suggestedFlow: "Enter news room." },
  { id: "room.enter.walking", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "room_action", source: "SocialHub", label: "Walking Companion", route: "/social-rooms/walking-companion", suggestedFlow: "Enter walking room." },
  { id: "room.enter.together", workflow: APP_WORKFLOW_REFERENCES.socialRoomEnter, surface: "room_action", source: "SocialHub", label: "Together Room", route: "/social-rooms/together-room", suggestedFlow: "Enter Together Room." },
  { id: "room.action.message", workflow: APP_WORKFLOW_REFERENCES.socialRoomMessage, surface: "room_action", source: "RoomScreen", label: "Say hello / Ask VYVA", route: "/social-rooms/:slug", suggestedFlow: "Send room message or ask VYVA." },
  { id: "room.action.match", workflow: APP_WORKFLOW_REFERENCES.socialMatch, surface: "room_action", source: "RoomScreen", label: "Match", route: "/social-rooms/:slug", suggestedFlow: "Find a compatible member by room context." },
  { id: "room.action.connect", workflow: APP_WORKFLOW_REFERENCES.socialConnect, surface: "room_action", source: "RoomScreen", label: "Connect", route: "/social-rooms/:slug", suggestedFlow: "Send safe greeting or connection." },
  { id: "together.action.share-plan", workflow: APP_WORKFLOW_REFERENCES.togetherSharePlan, surface: "room_action", source: "TogetherRoomScreen", label: "Share a plan", route: "/social-rooms/together-room", suggestedFlow: "Open guided composer, collect idea/category/place/time, post after review." },
  { id: "together.action.respond-plan", workflow: APP_WORKFLOW_REFERENCES.togetherPlanResponse, surface: "room_action", source: "TogetherRoomScreen", label: "Join / Maybe", route: "/social-rooms/together-room", suggestedFlow: "Save response to a shared plan." },
  { id: "together.action.reply", workflow: APP_WORKFLOW_REFERENCES.togetherGentleReply, surface: "room_action", source: "TogetherRoomScreen", label: "Gentle reply", route: "/social-rooms/together-room", suggestedFlow: "Send supportive reply." },
  { id: "together.action.vote", workflow: APP_WORKFLOW_REFERENCES.togetherPoll, surface: "room_action", source: "TogetherRoomScreen", label: "Vote", route: "/social-rooms/together-room", suggestedFlow: "Save vote or make a poll from a question." },
  { id: "together.action.comfort", workflow: APP_WORKFLOW_REFERENCES.togetherComfortCheck, surface: "room_action", source: "TogetherRoomScreen", label: "Comfort check", route: "/social-rooms/together-room", suggestedFlow: "Save comfort preference." },
  { id: "together.action.safety", workflow: APP_WORKFLOW_REFERENCES.togetherSafety, surface: "room_action", source: "TogetherRoomScreen", label: "Safety help", route: "/social-rooms/together-room", suggestedFlow: "Collect report target and reason, then send to moderation." },
  { id: "music.action.share-song", workflow: APP_WORKFLOW_REFERENCES.musicShareSong, surface: "room_action", source: "MusicRoomScreen", label: "Share song", route: "/social-rooms/music-room", suggestedFlow: "Post song/memory and suggest connection." },
  { id: "music.action.react", workflow: APP_WORKFLOW_REFERENCES.musicReact, surface: "room_action", source: "MusicRoomScreen", label: "React", route: "/social-rooms/music-room", suggestedFlow: "Save reaction to a song item." },
  { id: "share-stories.action.start-voice", workflow: APP_WORKFLOW_REFERENCES.shareStory, surface: "room_action", source: "ShareStoriesScreen", label: "Start voice", route: "/social-rooms/share", suggestedFlow: "Capture story by voice." },
  { id: "share-stories.action.type", workflow: APP_WORKFLOW_REFERENCES.shareStory, surface: "room_action", source: "ShareStoriesScreen", label: "Type story", route: "/social-rooms/share", suggestedFlow: "Capture story by typing." },
  { id: "game.memory.recommended", workflow: APP_WORKFLOW_REFERENCES.memoryGames, surface: "game_action", source: "MemoryGamesPage", label: "Recommended game", route: "/memory-games", suggestedFlow: "Open recommended game at recommended level." },
  { id: "game.memory.memory-match", workflow: APP_WORKFLOW_REFERENCES.gameMemoryMatch, surface: "game_action", source: "MemoryGamesPage", label: "Visual memory", route: "/memory-games/memory_match", suggestedFlow: "Start visual memory round." },
  { id: "game.memory.sequence", workflow: APP_WORKFLOW_REFERENCES.gameSequenceMemory, surface: "game_action", source: "MemoryGamesPage", label: "Sequence memory", route: "/memory-games/sequence_memory", suggestedFlow: "Start sequence memory round." },
  { id: "game.memory.word-recall", workflow: APP_WORKFLOW_REFERENCES.gameWordRecall, surface: "game_action", source: "MemoryGamesPage", label: "Word Recall", route: "/memory-games/word_recall", suggestedFlow: "Start word recall round." },
  { id: "game.memory.number-memory", workflow: APP_WORKFLOW_REFERENCES.gameNumberMemory, surface: "game_action", source: "MemoryGamesPage", label: "Number Memory", route: "/memory-games/number_memory", suggestedFlow: "Start number memory round." },
  { id: "game.memory.routine", workflow: APP_WORKFLOW_REFERENCES.gameRoutineMemory, surface: "game_action", source: "MemoryGamesPage", label: "Routine memory", route: "/memory-games/routine_memory", suggestedFlow: "Start routine memory round." },
  { id: "game.memory.association", workflow: APP_WORKFLOW_REFERENCES.gameAssociationMemory, surface: "game_action", source: "MemoryGamesPage", label: "Connections", route: "/memory-games/association_memory", suggestedFlow: "Start a Connections memory round." },
  { id: "game.memory.story", workflow: APP_WORKFLOW_REFERENCES.gameStoryRecall, surface: "game_action", source: "MemoryGamesPage", label: "Story Recall", route: "/memory-games/story_recall", suggestedFlow: "Start story recall round." },
  { id: "game.remember-later", workflow: APP_WORKFLOW_REFERENCES.gameRememberLater, surface: "game_action", source: "MemoryGamesPage", label: "Remember Later", route: "/memory-games/remember-later", suggestedFlow: "Start prospective memory game." },
  { id: "game.curious-minds", workflow: APP_WORKFLOW_REFERENCES.gameCuriousMinds, surface: "game_action", source: "AttentionBoostersPage", label: "Curious Minds", route: "/memory-games/curious-minds", suggestedFlow: "Start curiosity recall game." },
  { id: "game.dual-task-walk", workflow: APP_WORKFLOW_REFERENCES.gameDualTaskWalk, surface: "game_action", source: "AttentionBoostersPage", label: "Dual Task Walk", route: "/dual-task-walk", suggestedFlow: "Start dual task walk with safety guidance." },
  { id: "game.rhythm-tap", workflow: APP_WORKFLOW_REFERENCES.gameRhythmTap, surface: "game_action", source: "AttentionBoostersPage", label: "Rhythm Tap", route: "/attention-boosters/rhythm-tap", suggestedFlow: "Start rhythm tap." },
  { id: "game.number-trails", workflow: APP_WORKFLOW_REFERENCES.gameNumberTrails, surface: "game_action", source: "ExecutiveFunctionPage", label: "Number Trails", route: "/executive-function/number-trails", suggestedFlow: "Start number trails." },
  { id: "game.category-sort", workflow: APP_WORKFLOW_REFERENCES.gameCategorySort, surface: "game_action", source: "ExecutiveFunctionPage", label: "Category Sort", route: "/executive-function/category-sort", suggestedFlow: "Start category sorting." },
  { id: "game.face-name", workflow: APP_WORKFLOW_REFERENCES.gameFaceName, surface: "game_action", source: "ExecutiveFunctionPage", label: "Face Name Match", route: "/face-name-match", suggestedFlow: "Start face-name matching." },
  { id: "game.spatial-navigator", workflow: APP_WORKFLOW_REFERENCES.gameSpatialNavigator, surface: "game_action", source: "AppRoutes", label: "Spatial Navigator", route: "/spatial-navigator", suggestedFlow: "Start spatial navigator." },
  { id: "game.listen-closely", workflow: APP_WORKFLOW_REFERENCES.gameListenClosely, surface: "game_action", source: "SensesPage", label: "Listen Closely", route: "/senses/listen-closely", suggestedFlow: "Start listening game." },
  { id: "game.breath-garden", workflow: APP_WORKFLOW_REFERENCES.gameBreathGarden, surface: "game_action", source: "SensesPage", label: "Breath Garden", route: "/senses/breath-garden", suggestedFlow: "Start breath garden." },
  { id: "game.scent-memory", workflow: APP_WORKFLOW_REFERENCES.gameScentMemory, surface: "game_action", source: "SensesPage", label: "Scent Memory", route: "/senses/scent-memory", suggestedFlow: "Start scent memory." },
  { id: "profile.setup.providers", workflow: APP_WORKFLOW_REFERENCES.trustedProviders, surface: "profile_setup", source: "ProvidersSection", label: "Trusted providers", route: "/onboarding/profile/providers", suggestedFlow: "Open focused provider setup." },
  { id: "concierge.fast.safe-home", workflow: CONCIERGE_FLOW_REFERENCES.safeHomeSupport, surface: "fast_help", source: "ConciergeScreen", label: "Safe Home", route: "/safe-home", suggestedFlow: "Open safety support and ask what feels unsafe before any escalation." },
  { id: "concierge.fast.paperwork-help", workflow: CONCIERGE_FLOW_REFERENCES.insuranceAdmin, surface: "fast_help", source: "ConciergeScreen", label: "Paperwork Help", route: "/concierge", suggestedFlow: "Identify the form or admin task, collect missing details, and stop before sending." },
  { id: "concierge.fast.find-plumber", workflow: CONCIERGE_FLOW_REFERENCES.homeService, surface: "fast_help", source: "ConciergeScreen", label: "Find Plumber", route: "/concierge", suggestedFlow: "Collect service type, urgency, address/access notes, and prepare provider options before contact." },
  { id: "concierge.fast.check-scam", workflow: CONCIERGE_FLOW_REFERENCES.scamCheck, surface: "fast_help", source: "ConciergeScreen", label: "Check Scam", route: "/concierge", suggestedFlow: "Route by email, document, phone, company, or link and ask before forwarding, searching, or sharing details." },
  { id: "concierge.fast.book-ride", workflow: CONCIERGE_FLOW_REFERENCES.transportBooking, surface: "fast_help", source: "ConciergeScreen", label: "Book Ride", route: "/concierge", suggestedFlow: "Ask destination, pickup, time, mobility needs, and provider preference before booking." },
  { id: "concierge.fast.order-groceries", workflow: CONCIERGE_FLOW_REFERENCES.shoppingSupport, surface: "fast_help", source: "ConciergeScreen", label: "Order Groceries", route: "/concierge/shopping", suggestedFlow: "Prepare grocery choices and ask before ordering, paying, or contacting anyone." },
  { id: "concierge.fast.otc-pharmacy", workflow: CONCIERGE_FLOW_REFERENCES.otcPharmacy, surface: "fast_help", source: "ConciergeScreen", label: "OTC Pharmacy", route: "/concierge", suggestedFlow: "Use a saved pharmacy and non-prescription item details, then confirm before contact." },
  { id: "concierge.fast.find-specialist", workflow: CONCIERGE_FLOW_REFERENCES.careNavigation, surface: "fast_help", source: "ConciergeScreen", label: "Find Specialist", route: "/concierge", suggestedFlow: "Collect specialty, proximity, reputation, coverage, availability, and accessibility preferences, then prepare options before contact." },
  { id: "concierge.fast.find-residence", workflow: CONCIERGE_FLOW_REFERENCES.careNavigation, surface: "fast_help", source: "ConciergeScreen", label: "Find Residence", route: "/concierge", suggestedFlow: "Compare care homes or residences by care need, location, price, reputation, and access needs, then prepare options before contact." },
  { id: "concierge.fast.book-medical", workflow: CONCIERGE_FLOW_REFERENCES.medicalAppointment, surface: "fast_help", source: "ConciergeScreen", label: "Book Medical", route: "/concierge", suggestedFlow: "Ask reason, preferred time, provider, and coverage note before any booking or message." },
  { id: "concierge.fast.government-help", workflow: CONCIERGE_FLOW_REFERENCES.insuranceAdmin, surface: "fast_help", source: "ConciergeScreen", label: "Government Help", route: "/concierge", suggestedFlow: "Collect official task, deadline, recipient, and missing documents before preparing the next step." },
  { id: "concierge.fast.prepared-meals", workflow: CONCIERGE_FLOW_REFERENCES.shoppingSupport, surface: "fast_help", source: "ConciergeScreen", label: "Prepared Meals", route: "/concierge/shopping", suggestedFlow: "Prepare simple meal options and ask before ordering, paying, or contacting anyone." },
  { id: "concierge.action.transport", workflow: CONCIERGE_FLOW_REFERENCES.transportBooking, surface: "voice_action", source: "ConciergeScreen", label: "Book ride", route: "/concierge", suggestedFlow: "Collect ride details and confirm before booking." },
  { id: "concierge.action.otc-pharmacy", workflow: CONCIERGE_FLOW_REFERENCES.otcPharmacy, surface: "voice_action", source: "ConciergeScreen", label: "OTC pharmacy help", route: "/concierge", suggestedFlow: "Use saved pharmacy and only non-prescription support." },
  { id: "concierge.action.medical-appointment", workflow: CONCIERGE_FLOW_REFERENCES.medicalAppointment, surface: "voice_action", source: "ConciergeScreen", label: "Medical appointment", route: "/concierge", suggestedFlow: "Collect reason, provider, and timing, then confirm." },
  { id: "concierge.action.home-service", workflow: CONCIERGE_FLOW_REFERENCES.homeService, surface: "voice_action", source: "ConciergeScreen", label: "Home service", route: "/concierge", suggestedFlow: "Collect service, urgency, address, provider/search criteria, then confirm." },
  { id: "concierge.action.shopping", workflow: CONCIERGE_FLOW_REFERENCES.shoppingSupport, surface: "voice_action", source: "ConciergeScreen", label: "Shopping support", route: "/concierge/shopping", suggestedFlow: "Prepare options and ask before ordering or contacting." },
  { id: "concierge.action.care-navigation", workflow: CONCIERGE_FLOW_REFERENCES.careNavigation, surface: "voice_action", source: "ConciergeScreen", label: "Care navigation", route: "/concierge", suggestedFlow: "Collect care need and search criteria, then prepare options." },
  { id: "concierge.action.scam-check", workflow: CONCIERGE_FLOW_REFERENCES.scamCheck, surface: "voice_action", source: "ConciergeScreen", label: "Scam check", route: "/concierge", suggestedFlow: "Route by email, document, phone, or company reputation check." },
  { id: "scam.action.show-vyva", workflow: CONCIERGE_FLOW_REFERENCES.scamCheck, surface: "fast_help", source: "ScamGuardScreen", label: "Show VYVA", route: "/scam-guard", suggestedFlow: "Choose camera, upload, pasted message, phone number, company, or link review; ask before forwarding, searching, contacting, or sharing details." },
  { id: "concierge.action.safe-home", workflow: CONCIERGE_FLOW_REFERENCES.safeHomeSupport, surface: "voice_action", source: "ConciergeScreen", label: "Safe home", route: "/safe-home", suggestedFlow: "Assess safety concern and confirm before any escalation." },
  { id: "safe-home.action.show-vyva", workflow: CONCIERGE_FLOW_REFERENCES.safeHomeSupport, surface: "fast_help", source: "SafeHomeScreen", label: "Show VYVA", route: "/safe-home", suggestedFlow: "Choose camera, upload, or pasted home-safety concern; scan photos directly or prepare Concierge review before any service action." },
  { id: "concierge.action.insurance-admin", workflow: CONCIERGE_FLOW_REFERENCES.insuranceAdmin, surface: "voice_action", source: "ConciergeScreen", label: "Insurance admin", route: "/concierge", suggestedFlow: "Collect document/task, deadline, and recipient before any send." },
  { id: "concierge.action.tool-gated-task", workflow: CONCIERGE_FLOW_REFERENCES.toolGatedTask, surface: "voice_action", source: "ConciergeScreen", label: "Call, email, form, application", route: "/concierge", suggestedFlow: "Check tool readiness, prepare draft/action, then confirm." },
];

export interface WorkflowRegistryValidationResult {
  duplicateWorkflowReferences: WorkflowReference[];
  duplicateEntryPointIds: string[];
  missingWorkflowReferences: WorkflowReference[];
  entryPointsWithoutSuggestedFlow: string[];
  workflowsWithoutEntryPoint: WorkflowReference[];
}

function duplicates<T extends string>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const repeated = new Set<T>();
  values.forEach((value) => {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  });
  return [...repeated];
}

export function validateWorkflowRegistry(): WorkflowRegistryValidationResult {
  const workflowReferences = WORKFLOW_DEFINITIONS.map((item) => item.reference);
  const workflowSet = new Set<WorkflowReference>(workflowReferences);
  const entryWorkflowReferences = WORKFLOW_ENTRY_POINTS.map((entry) => entry.workflow);
  return {
    duplicateWorkflowReferences: duplicates(workflowReferences),
    duplicateEntryPointIds: duplicates(WORKFLOW_ENTRY_POINTS.map((entry) => entry.id)),
    missingWorkflowReferences: [...new Set(entryWorkflowReferences.filter((reference) => !workflowSet.has(reference)))],
    entryPointsWithoutSuggestedFlow: WORKFLOW_ENTRY_POINTS
      .filter((entry) => entry.suggestedFlow.trim().length === 0)
      .map((entry) => entry.id),
    workflowsWithoutEntryPoint: workflowReferences.filter((reference) => !entryWorkflowReferences.includes(reference)),
  };
}

export function getWorkflowDefinition(reference: WorkflowReference): WorkflowDefinition {
  const definition = WORKFLOW_DEFINITIONS.find((item) => item.reference === reference);
  if (!definition) throw new Error(`Unknown workflow reference: ${reference}`);
  return definition;
}

export function getWorkflowEntryPoint(id: string): WorkflowEntryPoint {
  const entry = WORKFLOW_ENTRY_POINTS.find((item) => item.id === id);
  if (!entry) throw new Error(`Unknown workflow entry point: ${id}`);
  return entry;
}

export function workflowEntryPointsFor(reference: WorkflowReference): WorkflowEntryPoint[] {
  return WORKFLOW_ENTRY_POINTS.filter((entry) => entry.workflow === reference);
}

export function workflowEntryPointsForSurface(surface: WorkflowEntrySurface): WorkflowEntryPoint[] {
  return WORKFLOW_ENTRY_POINTS.filter((entry) => entry.surface === surface);
}

export function deduplicateWorkflowReferences(references: WorkflowReference[]): WorkflowReference[] {
  return [...new Set(references)];
}

export function workflowCoverageState(status: WorkflowStatus): WorkflowCoverageState {
  if (status === "ready") return "complete";
  if (status === "partial") return "partial";
  return "missing";
}

export function workflowFlowStatus(status: WorkflowStatus): WorkflowFlowStatus {
  if (status === "ready") return "ready";
  if (status === "partial") return "partial";
  if (status === "planned") return "ui_only";
  return "blocked";
}

export const WORKFLOW_FLOW_STATUS_LABELS: Record<WorkflowFlowStatus, string> = {
  ready: "Ready",
  partial: "Partial",
  ui_only: "UI only",
  blocked: "Blocked",
};

const FALLBACK_LABELS: Record<WorkflowFallback, string> = {
  ask_user: "Ask the user for the missing detail in the flow.",
  open_setup: "Open focused setup and return to the original task.",
  open_existing_screen: "Open the existing page that manages this information.",
  operator_review: "Offer VYVA or operator review when automation is not enough.",
  choose_input_type: "Let the user choose camera, upload, pasted text, link, phone, or company input.",
  safe_block: "Stop the action safely until required information or permission is present.",
  none: "No setup fallback needed.",
};

const SAVED_DATA_LABELS: Record<string, string> = {
  trusted_provider: "trusted provider",
  coverage: "insurance or coverage",
  mobility_preferences: "mobility preferences",
  home_address: "home address",
  contact_channel: "preferred contact channel",
  trusted_contact: "trusted contact",
  document_or_media: "document or media",
};

const PROFILE_DATA_SOURCE_LABELS: Record<WorkflowProfileDataSource, string> = {
  basic_profile: "basic profile",
  language: "language",
  timezone: "timezone",
  health_profile: "health profile",
  medications: "saved medicines",
  vitals: "vitals history",
  mobility: "mobility preferences",
  care_team: "care team",
  trusted_providers: "trusted providers",
  learning_interests: "learning interests",
  social_interests: "social interests",
  home_address: "home address",
  documents_media: "documents or media",
  none: "none",
};

function formatTokenList(values: readonly string[]): string {
  if (values.length === 0) return "None";
  return values.map((value) => value.replace(/_/g, " ")).join(", ");
}

function profileDataSourceLabel(source: WorkflowProfileDataSource): string {
  return PROFILE_DATA_SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

function uniqueProfileDataSources(values: readonly WorkflowProfileDataSource[]): WorkflowProfileDataSource[] {
  const withoutNone = values.filter((value) => value !== "none");
  const unique = [...new Set(withoutNone)];
  return unique.length ? unique : ["none"];
}

function profileDataSourcesFromConciergeFlow(reference: ConciergeFlowReference): WorkflowProfileDataSource[] {
  const flow = getConciergeFlowDefinition(reference);
  const sources: WorkflowProfileDataSource[] = [];
  if (flow.savedData.includes("trusted_provider")) sources.push("trusted_providers");
  if (flow.savedData.includes("coverage")) sources.push("health_profile");
  if (flow.savedData.includes("mobility_preferences")) sources.push("mobility");
  if (flow.savedData.includes("home_address")) sources.push("home_address");
  if (flow.savedData.includes("contact_channel")) sources.push("basic_profile");
  if (flow.savedData.includes("trusted_contact")) sources.push("care_team");
  if (flow.savedData.includes("document_or_media")) sources.push("documents_media");
  return uniqueProfileDataSources(sources);
}

export function workflowProfileDataSources(reference: WorkflowReference): WorkflowProfileDataSource[] {
  const workflow = getWorkflowDefinition(reference);
  if (workflow.profileDataSources?.length) return uniqueProfileDataSources(workflow.profileDataSources);

  const flowReference = workflow.relatedConciergeFlow ?? (workflow.domain === "concierge" ? workflow.reference as ConciergeFlowReference : null);
  const sources: WorkflowProfileDataSource[] = flowReference ? profileDataSourcesFromConciergeFlow(flowReference) : [];
  const requiredInfo = new Set(workflow.requiredInfo);

  if (workflow.domain === "home") sources.push("basic_profile", "timezone", "language");
  if (workflow.domain === "health") sources.push("health_profile");
  if (workflow.domain === "medication") sources.push("medications");
  if (workflow.domain === "learning") sources.push("learning_interests", "language");
  if (workflow.domain === "community" || workflow.domain === "room") sources.push("social_interests", "language");
  if (workflow.domain === "game" || workflow.domain === "mind_memory") sources.push("language");
  if (workflow.domain === "profile") sources.push("basic_profile");

  if (requiredInfo.has("saved_medications")) sources.push("medications");
  if (requiredInfo.has("reading_type") || requiredInfo.has("reading_value") || requiredInfo.has("reading_time")) sources.push("vitals");
  if (requiredInfo.has("profile_signals")) sources.push("basic_profile", "health_profile", "mobility");
  if (requiredInfo.has("interests") || requiredInfo.has("interest_choice")) sources.push("learning_interests");
  if (requiredInfo.has("room_or_interest") || requiredInfo.has("activity_interest")) sources.push("social_interests");

  return uniqueProfileDataSources(sources);
}

export function workflowProfileDataSourceLabels(reference: WorkflowReference): string {
  return workflowProfileDataSources(reference).map(profileDataSourceLabel).join(", ");
}

function providerCategoryLabel(reference: ConciergeFlowReference): string | null {
  const flow = getConciergeFlowDefinition(reference);
  if (!flow.setupFocus && !flow.providerCategory) return null;
  const categoryId = flow.setupFocus ?? flow.providerCategory;
  return CONCIERGE_PROVIDER_CATEGORIES.find((category) => category.id === categoryId)?.label ?? categoryId ?? null;
}

function requiredSetupForWorkflow(workflow: WorkflowDefinition): string {
  if (workflow.setupRequirement) return workflow.setupRequirement;
  const flowReference = workflow.relatedConciergeFlow ?? (workflow.domain === "concierge" ? workflow.reference as ConciergeFlowReference : null);
  if (flowReference) {
    const flow = getConciergeFlowDefinition(flowReference);
    const savedData = flow.savedData.map((key) => SAVED_DATA_LABELS[key] ?? key.replace(/_/g, " "));
    const category = providerCategoryLabel(flowReference);
    const setup = [
      ...(category && flow.savedData.includes("trusted_provider") ? [`saved ${category.toLowerCase()} provider`] : []),
      ...savedData.filter((item) => item !== "trusted provider"),
    ];
    return setup.length ? setup.join(", ") : "None";
  }
  return workflow.requiredInfo.length ? formatTokenList(workflow.requiredInfo) : "None";
}

function missingSetupFallbackForWorkflow(workflow: WorkflowDefinition): string {
  if (workflow.fallbackIfMissing.includes("none")) return FALLBACK_LABELS.none;
  const parts = workflow.fallbackIfMissing.map((fallback) => FALLBACK_LABELS[fallback]);
  const flowReference = workflow.relatedConciergeFlow ?? (workflow.domain === "concierge" ? workflow.reference as ConciergeFlowReference : null);
  if (flowReference) {
    const category = providerCategoryLabel(flowReference);
    if (category) {
      parts.unshift(`If no ${category.toLowerCase()} is saved, offer: add usual provider, find nearby options, or ask family/caregiver to help.`);
    }
  }
  return [...new Set(parts)].join(" ");
}

function findOptionsPathForWorkflow(workflow: WorkflowDefinition): string {
  if (workflow.findOptionsPath) return workflow.findOptionsPath;
  const flowReference = workflow.relatedConciergeFlow ?? (workflow.domain === "concierge" ? workflow.reference as ConciergeFlowReference : null);
  if (flowReference) {
    const flow = getConciergeFlowDefinition(flowReference);
    if (flow.tools.includes("web_search") || flow.providerCategory) {
      return "Use the shared provider/search criteria path: proximity, price, reputation, availability, accessibility, and coverage when relevant.";
    }
    return "Prepare the Concierge action path; use operator review when no direct search/tool is available.";
  }
  if (workflow.actionLevel === "setup" || workflow.domain === "profile") return "Not needed; this is setup itself.";
  if (workflow.domain === "game" || workflow.domain === "learning" || workflow.domain === "room") return "Not needed; user chooses from in-app options.";
  return "Use the relevant in-app page first; route to Concierge only when an external provider or service is needed.";
}

function receiptMomentForWorkflow(workflow: WorkflowDefinition): string {
  if (workflow.receiptMoment) return workflow.receiptMoment;
  const actionLevel = workflowActionLevelForDefinition(workflow);
  if (actionLevel === "external_action") return "Show an action-prepared or action-confirmed receipt before/after any external handoff.";
  if (actionLevel === "setup") return "Show a saved setup confirmation and return option.";
  return workflow.completionState;
}

function resumeBehaviorForWorkflow(workflow: WorkflowDefinition): string {
  if (workflow.resumeBehavior) return workflow.resumeBehavior;
  const actionLevel = workflowActionLevelForDefinition(workflow);
  if (actionLevel === "external_action") return "Resume from Home, Concierge, or the originating screen through the saved pending task.";
  if (actionLevel === "setup") return "Return to the original task through the setup return path when provided.";
  return "Stay in the current in-app flow or reopen from the same entry point.";
}

export function workflowFlowMatrixRows(): WorkflowFlowMatrixRow[] {
  return WORKFLOW_DEFINITIONS.map((workflow) => {
    const currentStatus = workflowFlowStatus(workflow.status);
    return {
      reference: workflow.reference,
      domain: workflow.domain,
      title: workflow.title,
      currentStatus,
      currentStatusLabel: WORKFLOW_FLOW_STATUS_LABELS[currentStatus],
      entryPoints: workflowEntryPointsFor(workflow.reference),
      requiredSetup: requiredSetupForWorkflow(workflow),
      missingSetupFallback: missingSetupFallbackForWorkflow(workflow),
      findOptionsPath: findOptionsPathForWorkflow(workflow),
      confirmationRule: workflow.confirmationRule,
      receiptMoment: receiptMomentForWorkflow(workflow),
      resumeBehavior: resumeBehaviorForWorkflow(workflow),
      nextStep: workflow.nextStep ?? "Keep current flow available.",
      profileDataSources: workflowProfileDataSources(workflow.reference),
      profileDataSourceLabels: workflowProfileDataSourceLabels(workflow.reference),
    };
  });
}

function pushUniqueSetupChoice(choices: WorkflowSetupFallbackChoice[], choice: WorkflowSetupFallbackChoice): void {
  if (!choices.some((item) => item.kind === choice.kind && item.route === choice.route)) {
    choices.push(choice);
  }
}

export function workflowSetupFallbackChoices(
  reference: WorkflowReference,
  options: WorkflowSetupFallbackOptions = {},
): WorkflowSetupFallbackChoice[] {
  const workflow = getWorkflowDefinition(reference);
  const flowReference = workflow.relatedConciergeFlow ?? (workflow.domain === "concierge" ? workflow.reference as ConciergeFlowReference : null);
  const flow = flowReference ? getConciergeFlowDefinition(flowReference) : null;
  const choices: WorkflowSetupFallbackChoice[] = [];
  const returnTo = options.returnTo ?? workflow.primaryRoute;
  const shouldUseFlowSetupChoices = workflow.domain === "concierge"
    || workflow.fallbackIfMissing.includes("open_setup")
    || !workflow.fallbackIfMissing.includes("choose_input_type");

  if (workflow.fallbackIfMissing.includes("none")) {
    return [{
      kind: "none",
      label: "No setup needed",
      description: "This flow can continue without extra setup.",
    }];
  }

  if (workflow.fallbackIfMissing.includes("ask_user")) {
    pushUniqueSetupChoice(choices, {
      kind: "ask_detail",
      label: "Ask a quick question",
      description: `Ask for ${formatTokenList(workflow.requiredInfo).toLowerCase()} inside the current flow.`,
    });
  }

  if (workflow.fallbackIfMissing.includes("choose_input_type")) {
    pushUniqueSetupChoice(choices, {
      kind: "choose_input_type",
      label: "Choose input type",
      description: "Let the user choose camera, upload, pasted text, link, phone number, or company lookup.",
      route: workflow.primaryRoute,
      state: { returnTo, workflowReference: workflow.reference },
    });
  }

  if (workflow.fallbackIfMissing.includes("open_existing_screen")) {
    pushUniqueSetupChoice(choices, {
      kind: "open_existing_screen",
      label: "Open the right page",
      description: "Open the existing page that already manages this information.",
      route: workflow.primaryRoute,
      state: { returnTo, workflowReference: workflow.reference },
    });
  }

  if (shouldUseFlowSetupChoices && flow && (workflow.fallbackIfMissing.includes("open_setup") || flow.savedData.includes("trusted_provider"))) {
    const category = flow.setupFocus ?? flow.providerCategory;
    const categoryLabel = flowReference ? providerCategoryLabel(flowReference) : null;
    if (category) {
      pushUniqueSetupChoice(choices, {
        kind: "add_provider",
        label: `Add usual ${categoryLabel?.toLowerCase() ?? "provider"}`,
        description: "Save the trusted provider once, then return to the original task.",
        route: "/onboarding/profile/providers",
        state: {
          setupFocus: category,
          returnTo,
          providerSetupHelpRequested: {
            flowReference,
            setupFocus: category,
            setupReason: workflow.title,
          },
        },
      });
    }
  }

  if (shouldUseFlowSetupChoices && flow?.savedData.includes("trusted_contact")) {
    pushUniqueSetupChoice(choices, {
      kind: "add_trusted_contact",
      label: "Add trusted contact",
      description: "Save a family member, caregiver, or trusted person before VYVA prepares contact steps.",
      route: "/onboarding/profile/care-team",
      state: {
        returnTo,
        providerSetupHelpRequested: {
          flowReference,
          setupFocus: "trusted_contact",
          setupReason: workflow.title,
        },
      },
    });
  }

  if (shouldUseFlowSetupChoices && flow && (flow.providerCategory || flow.tools.includes("web_search"))) {
    pushUniqueSetupChoice(choices, {
      kind: "find_options",
      label: "Find options nearby",
      description: "Use search criteria such as proximity, price, reputation, availability, accessibility, and coverage when relevant.",
      route: "/concierge",
      state: {
        returnTo,
        conciergePrefill: {
          flowReference,
          mode: "find_options",
          title: workflow.title,
        },
      },
    });
  }

  if (shouldUseFlowSetupChoices && flow && (flow.setupFocus || flow.providerCategory || flow.savedData.includes("trusted_provider") || flow.savedData.includes("trusted_contact"))) {
    pushUniqueSetupChoice(choices, {
      kind: "ask_family",
      label: "Ask family or caregiver",
      description: "Let a trusted helper set up the provider details before VYVA continues.",
      route: "/onboarding/profile/care-team",
      state: {
        returnTo,
        providerSetupHelpRequested: {
          flowReference,
          setupFocus: flow.setupFocus ?? flow.providerCategory ?? null,
          setupReason: workflow.title,
        },
      },
    });
  }

  if (workflow.fallbackIfMissing.includes("operator_review")) {
    pushUniqueSetupChoice(choices, {
      kind: "operator_review",
      label: "Ask VYVA to review",
      description: "Use manual review when automation, providers, or tools are not ready enough.",
      route: "/concierge",
      state: {
        returnTo,
        conciergePrefill: {
          flowReference,
          mode: "operator_review",
          title: workflow.title,
        },
      },
    });
  }

  if (workflow.fallbackIfMissing.includes("safe_block")) {
    pushUniqueSetupChoice(choices, {
      kind: "safe_block",
      label: "Stop safely",
      description: "Pause this action until required information or permission is present.",
    });
  }

  return choices.length ? choices : [{
    kind: "none",
    label: "No setup needed",
    description: "This flow can continue without extra setup.",
  }];
}

function readinessGate(
  kind: WorkflowReadinessGateKind,
  label: string,
  detail: string,
  state: WorkflowReadinessGateState = detail.trim().length > 0 ? "ready" : "needs_attention",
): WorkflowReadinessGate {
  return { kind, label, detail, state };
}

export function workflowReadinessChecklist(reference: WorkflowReference): WorkflowReadinessChecklistRow {
  const workflow = getWorkflowDefinition(reference);
  const actionLevel = workflowActionLevelForDefinition(workflow);
  const flowReference = workflow.relatedConciergeFlow ?? (workflow.domain === "concierge" ? workflow.reference as ConciergeFlowReference : null);
  const flow = flowReference ? getConciergeFlowDefinition(flowReference) : null;
  const setupChoices = workflowSetupFallbackChoices(reference);
  const setupReady = setupChoices.length > 0 && !setupChoices.every((choice) => choice.kind === "none" && workflow.fallbackIfMissing.includes("none") === false);
  const toolDetail = flow
    ? `Requires ${formatTokenList(flow.tools)}.`
    : actionLevel === "external_action"
      ? "External action must route through a related Concierge flow or explicit tool readiness gate."
      : "No external tool readiness needed.";
  const profileDetail = workflowProfileDataSourceLabels(reference);

  const gates: WorkflowReadinessGate[] = [
    readinessGate(
      "setup_fallback",
      "Missing setup fallback",
      setupChoices.map((choice) => choice.label).join(", "),
      setupReady ? "ready" : "needs_attention",
    ),
    readinessGate(
      "profile_data",
      "Profile data",
      `Uses ${profileDetail}.`,
      profileDetail.trim().length > 0 && profileDetail !== "none" ? "ready" : "needs_attention",
    ),
    readinessGate(
      "confirmation",
      "Final confirmation",
      workflow.confirmationRule,
    ),
    readinessGate(
      "receipt",
      "Receipt moment",
      receiptMomentForWorkflow(workflow),
    ),
    readinessGate(
      "resume",
      "Resume behavior",
      resumeBehaviorForWorkflow(workflow),
    ),
  ];

  if (actionLevel === "external_action") {
    gates.splice(1, 0, readinessGate(
      "tool_readiness",
      "Tool readiness",
      toolDetail,
      flow && flow.tools.length > 0 ? "ready" : "needs_attention",
    ));
  }

  return {
    reference: workflow.reference,
    domain: workflow.domain,
    title: workflow.title,
    actionLevel,
    gates,
    needsAttention: gates.filter((gate) => gate.state === "needs_attention").map((gate) => gate.kind),
  };
}

export function workflowReadinessChecklistRows(): WorkflowReadinessChecklistRow[] {
  return WORKFLOW_DEFINITIONS.map((workflow) => workflowReadinessChecklist(workflow.reference));
}

function emptyCoverageCounts(): WorkflowCoverageCounts {
  return {
    total: 0,
    complete: 0,
    partial: 0,
    missing: 0,
  };
}

function addCoverageCount(counts: WorkflowCoverageCounts, state: WorkflowCoverageState): void {
  counts.total += 1;
  counts[state] += 1;
}

function emptyDomainCoverage(): Record<WorkflowDomain, WorkflowCoverageCounts> {
  return Object.fromEntries(
    WORKFLOW_DOMAINS.map((domain) => [domain, emptyCoverageCounts()]),
  ) as Record<WorkflowDomain, WorkflowCoverageCounts>;
}

function emptySurfaceCoverage(): Record<WorkflowEntrySurface, WorkflowCoverageCounts> {
  return Object.fromEntries(
    WORKFLOW_ENTRY_SURFACES.map((surface) => [surface, emptyCoverageCounts()]),
  ) as Record<WorkflowEntrySurface, WorkflowCoverageCounts>;
}

function emptyStatusCounts(): Record<WorkflowStatus, number> {
  return Object.fromEntries(WORKFLOW_STATUSES.map((status) => [status, 0])) as Record<WorkflowStatus, number>;
}

function emptyActionLevelCounts(): Record<WorkflowActionLevel, number> {
  return Object.fromEntries(WORKFLOW_ACTION_LEVELS.map((level) => [level, 0])) as Record<WorkflowActionLevel, number>;
}

export function workflowActionLevelForDefinition(workflow: WorkflowDefinition): WorkflowActionLevel {
  if (workflow.actionLevel) return workflow.actionLevel;
  if (workflow.domain === "concierge") return "external_action";
  if (workflow.domain === "profile" || SETUP_WORKFLOW_REFERENCES.has(workflow.reference)) return "setup";
  if (EXTERNAL_ACTION_WORKFLOW_REFERENCES.has(workflow.reference) || workflow.relatedConciergeFlow) return "external_action";
  if (LIGHT_WORKFLOW_REFERENCES.has(workflow.reference) || workflow.domain === "game") return "light";
  return "guided";
}

export function workflowActionLevelForReference(reference: WorkflowReference): WorkflowActionLevel {
  return workflowActionLevelForDefinition(getWorkflowDefinition(reference));
}

function toWorkflowActionLookup(entry: WorkflowEntryPoint): WorkflowActionLookup {
  const workflow = getWorkflowDefinition(entry.workflow);
  const actionLevel = workflowActionLevelForDefinition(workflow);
  return {
    entryPointId: entry.id,
    workflowReference: workflow.reference,
    label: entry.label,
    source: entry.source,
    surface: entry.surface,
    route: entry.route,
    suggestedFlow: entry.suggestedFlow,
    workflowTitle: workflow.title,
    domain: workflow.domain,
    status: workflow.status,
    coverageState: workflowCoverageState(workflow.status),
    nextStep: workflow.nextStep ?? entry.suggestedFlow,
    completionState: workflow.completionState,
    confirmationRule: workflow.confirmationRule,
    fallbackIfMissing: workflow.fallbackIfMissing,
    relatedConciergeFlow: workflow.relatedConciergeFlow,
    actionLevel,
    actionLevelLabel: WORKFLOW_ACTION_LEVEL_LABELS[actionLevel],
    actionLevelRule: WORKFLOW_ACTION_LEVEL_RULES[actionLevel],
  };
}

export function workflowActionForEntryPoint(entryPointId: string): WorkflowActionLookup {
  return toWorkflowActionLookup(getWorkflowEntryPoint(entryPointId));
}

export function workflowActionsForTarget(target: WorkflowActionTarget): WorkflowActionLookup[] {
  return WORKFLOW_ENTRY_POINTS
    .filter((entry) => {
      if (target.entryPointId && entry.id !== target.entryPointId) return false;
      if (target.workflow && entry.workflow !== target.workflow) return false;
      if (target.source && entry.source !== target.source) return false;
      if (target.surface && entry.surface !== target.surface) return false;
      if (target.route && entry.route !== target.route) return false;
      if (target.label && entry.label !== target.label) return false;
      return true;
    })
    .map(toWorkflowActionLookup);
}

export function resolveWorkflowAction(target: WorkflowActionTarget): WorkflowActionLookup | null {
  const matches = workflowActionsForTarget(target);
  return matches.length === 1 ? matches[0] : null;
}

export function getWorkflowCoverageSummary(): WorkflowCoverageSummary {
  const workflows = emptyCoverageCounts();
  const entryPoints = emptyCoverageCounts();
  const byDomain = emptyDomainCoverage();
  const bySurface = emptySurfaceCoverage();
  const byStatus = emptyStatusCounts();
  const byActionLevel = emptyActionLevelCounts();
  const partialWorkflows: WorkflowReference[] = [];
  const missingWorkflows: WorkflowReference[] = [];

  WORKFLOW_DEFINITIONS.forEach((workflow) => {
    const state = workflowCoverageState(workflow.status);
    const actionLevel = workflowActionLevelForDefinition(workflow);
    addCoverageCount(workflows, state);
    addCoverageCount(byDomain[workflow.domain], state);
    byStatus[workflow.status] += 1;
    byActionLevel[actionLevel] += 1;
    if (state === "partial") partialWorkflows.push(workflow.reference);
    if (state === "missing") missingWorkflows.push(workflow.reference);
  });

  WORKFLOW_ENTRY_POINTS.forEach((entry) => {
    const workflow = getWorkflowDefinition(entry.workflow);
    const state = workflowCoverageState(workflow.status);
    addCoverageCount(entryPoints, state);
    addCoverageCount(bySurface[entry.surface], state);
  });

  return {
    workflows,
    entryPoints,
    byDomain,
    bySurface,
    byStatus,
    byActionLevel,
    partialWorkflows,
    missingWorkflows,
  };
}

function emptyParityStatusCounts(): Record<WorkflowParityStatus, number> {
  return Object.fromEntries(WORKFLOW_PARITY_STATUSES.map((status) => [status, 0])) as Record<WorkflowParityStatus, number>;
}

function emptyParityDomainCounts(): Record<WorkflowDomain, Record<WorkflowParityStatus, number>> {
  return Object.fromEntries(
    WORKFLOW_DOMAINS.map((domain) => [domain, emptyParityStatusCounts()]),
  ) as Record<WorkflowDomain, Record<WorkflowParityStatus, number>>;
}

function conciergeFlowFor(reference: WorkflowReference) {
  return CONCIERGE_FLOW_REGISTRY.find((flow) => flow.reference === reference);
}

function workflowHasConfirmationRule(workflow: WorkflowDefinition): boolean {
  return /ask|confirm|before|never|no confirmation/i.test(workflow.confirmationRule);
}

function workflowHasSetupPath(workflow: WorkflowDefinition): boolean {
  const conciergeFlow = conciergeFlowFor(workflow.reference);
  if (!conciergeFlow?.setupFocus && !workflow.requiredInfo.includes("trusted_provider")) return true;
  return workflow.fallbackIfMissing.includes("open_setup") || workflow.primaryRoute === "/onboarding/profile/providers";
}

function workflowHasResumeEvidence(workflow: WorkflowDefinition): boolean {
  const actionLevel = workflowActionLevelForDefinition(workflow);
  if (actionLevel !== "external_action") return true;
  return /history|receipt|resume|resumed|captured|saved|prepared|handoff|handed off/i.test(
    `${workflow.completionState} ${workflow.nextStep ?? ""}`,
  );
}

function workflowNeedsRealToolService(workflow: WorkflowDefinition): boolean {
  return [
    CONCIERGE_FLOW_REFERENCES.shoppingSupport,
    CONCIERGE_FLOW_REFERENCES.scamCheck,
    CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
    CONCIERGE_FLOW_REFERENCES.toolGatedTask,
  ].includes(workflow.reference as ConciergeFlowReference);
}

function workflowParityStatusFor(workflow: WorkflowDefinition): WorkflowParityStatus {
  const coverageState = workflowCoverageState(workflow.status);
  if (coverageState === "missing") return "partial";
  if (coverageState === "partial") return "partial";
  if (!workflowHasSetupPath(workflow)) return "missing_setup_path";
  if (!workflowHasConfirmationRule(workflow)) return "missing_confirmation";
  if (!workflowHasResumeEvidence(workflow)) return "missing_resume";
  if (workflowNeedsRealToolService(workflow)) return "needs_tool_service";
  return "ready";
}

function reusablePatternsFor(workflow: WorkflowDefinition): WorkflowReusablePattern[] {
  const actionLevel = workflowActionLevelForDefinition(workflow);
  const patterns = new Set<WorkflowReusablePattern>();
  if (workflow.fallbackIfMissing.includes("open_setup") || workflow.domain === "profile") patterns.add("setup_choice_panel");
  if (actionLevel === "external_action") {
    patterns.add("return_resume_state");
    patterns.add("confirmation_receipt");
    patterns.add("action_readiness");
    patterns.add("manual_fallback");
  }
  if (workflow.relatedConciergeFlow) {
    patterns.add("confirmation_receipt");
    patterns.add("manual_fallback");
  }
  return [...patterns];
}

function backlogPriorityFor(status: WorkflowParityStatus, workflow: WorkflowDefinition): 1 | 2 | 3 | 4 {
  if (status === "missing_confirmation" || status === "missing_setup_path") return 1;
  if (status === "missing_resume") return 2;
  if (status === "needs_tool_service") return 3;
  if (status === "partial") return 3;
  if (workflowActionLevelForDefinition(workflow) === "external_action") return 4;
  return 4;
}

function parityEvidenceFor(status: WorkflowParityStatus, workflow: WorkflowDefinition): string {
  if (status === "ready") return "Mapped entry points have a suggested flow, confirmation rule, completion state, and safe fallback.";
  if (status === "needs_tool_service") return "The user journey is mapped, but real external execution still depends on configured call, email, upload, search, booking, or operator tools.";
  if (status === "missing_setup_path") return "The workflow depends on saved provider or setup data, but the registry does not yet expose the setup choice path.";
  if (status === "missing_confirmation") return "The workflow needs an explicit final confirmation rule before contact, booking, sharing, upload, payment, or submission.";
  if (status === "missing_resume") return "The workflow needs a durable return point so users can continue after setup, provider choice, review, or a reply.";
  return "The workflow opens, but the registry still marks implementation as incomplete.";
}

function parityNextStepFor(status: WorkflowParityStatus, workflow: WorkflowDefinition): string {
  if (status === "ready") return workflow.nextStep ?? "Keep monitoring real usage and support outcomes.";
  if (status === "needs_tool_service") return workflow.nextStep ?? "Connect the required service/tool behind the confirmation layer.";
  if (status === "missing_setup_path") return "Add the provider/setup choice panel and return users to the original task after setup.";
  if (status === "missing_confirmation") return "Add a final confirmation moment before the action can leave VYVA.";
  if (status === "missing_resume") return "Store enough pending-task state to resume the original task after interruption.";
  return workflow.nextStep ?? "Finish the incomplete mapped flow.";
}

export function getWorkflowParityAudit(): WorkflowParityAuditItem[] {
  return WORKFLOW_DEFINITIONS.map((workflow) => {
    const status = workflowParityStatusFor(workflow);
    return {
      workflowReference: workflow.reference,
      domain: workflow.domain,
      title: workflow.title,
      status,
      affectedEntryPointIds: workflowEntryPointsFor(workflow.reference).map((entry) => entry.id),
      reusablePatterns: reusablePatternsFor(workflow),
      backlogPriority: backlogPriorityFor(status, workflow),
      evidence: parityEvidenceFor(status, workflow),
      nextStep: parityNextStepFor(status, workflow),
    };
  });
}

export function workflowParityAuditForEntryPoint(entryPointId: string): WorkflowParityAuditItem {
  const entry = getWorkflowEntryPoint(entryPointId);
  const item = getWorkflowParityAudit().find((audit) => audit.workflowReference === entry.workflow);
  if (!item) throw new Error(`No parity audit item for entry point: ${entryPointId}`);
  return item;
}

export function getWorkflowParityBacklog(limit = 8): WorkflowParityAuditItem[] {
  return getWorkflowParityAudit()
    .filter((item) => item.status !== "ready")
    .sort((left, right) => {
      if (left.backlogPriority !== right.backlogPriority) return left.backlogPriority - right.backlogPriority;
      if (left.domain !== right.domain) return left.domain.localeCompare(right.domain);
      return left.title.localeCompare(right.title);
    })
    .slice(0, limit);
}

export function getWorkflowParityAuditSummary(): WorkflowParityAuditSummary {
  const byStatus = emptyParityStatusCounts();
  const byDomain = emptyParityDomainCounts();
  getWorkflowParityAudit().forEach((item) => {
    byStatus[item.status] += 1;
    byDomain[item.domain][item.status] += 1;
  });
  return {
    total: WORKFLOW_DEFINITIONS.length,
    byStatus,
    byDomain,
    ready: byStatus.ready,
    blocked: byStatus.missing_confirmation + byStatus.missing_resume + byStatus.missing_setup_path + byStatus.needs_tool_service,
  };
}

export function nextWorkflowImplementationCandidates(limit = 5): WorkflowActionLookup[] {
  return WORKFLOW_ENTRY_POINTS
    .map(toWorkflowActionLookup)
    .filter((action) => action.coverageState !== "complete")
    .sort((left, right) => {
      if (left.coverageState !== right.coverageState) {
        return left.coverageState === "partial" ? -1 : 1;
      }
      return left.entryPointId.localeCompare(right.entryPointId);
    })
    .slice(0, limit);
}
