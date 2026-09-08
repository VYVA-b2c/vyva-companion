import type { NavigateOptions } from "react-router-dom";
import type {
  CrossPillarCompletionActionId,
  CrossPillarSubflowResult,
} from "@/components/voice-canvas/CrossPillarSubflowCanvas";
import { buildWorkflowReceiptMoment, type WorkflowReceiptMoment } from "../../shared/workflowReceiptMoments";
import {
  APP_WORKFLOW_REFERENCES,
  type WorkflowReference,
} from "../../shared/workflowRegistry";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";
import { conciergeTaskPath } from "@/lib/conciergeTaskNavigation";
import { apiFetch } from "@/lib/queryClient";
import {
  canClaimCrossPillarExternalSuccess,
  evaluateCrossPillarActionToolReadiness,
  type CrossPillarActionToolReadiness,
  type CrossPillarToolEvidence,
  type CrossPillarToolFamily,
} from "../../shared/crossPillarToolReadiness";
import {
  buildCrossPillarExecutionReceipt,
  type CrossPillarExecutionAttemptInput,
  type CrossPillarExecutionOutcome,
} from "../../shared/crossPillarExecutionObservability";

export const CROSS_PILLAR_HANDOFF_STORAGE_KEY = "vyva.cross-pillar-handoffs.v1";
export const CROSS_PILLAR_ACTIVE_HANDOFF_KEY = "vyva.cross-pillar-handoff.active.v1";
export const CROSS_PILLAR_HANDOFF_EVENT = "vyva:cross-pillar-handoff-updated";

type HandoffKind = "route" | "preparation" | "provider_setup";
type Pillar = "health" | "mind" | "community" | "concierge";
type ProviderFocus = "doctor_clinic" | "home_service" | "personal_care";

export type CrossPillarRecoveryAction =
  | "retry"
  | "choose_alternative"
  | "prepare_for_later"
  | "trusted_contact"
  | "ask_vyva";

export type CrossPillarRecoveryPlan = {
  reasonCode: string;
  explanation: string;
  preservedSummary: string;
  whatSucceeded: string;
  whatFailed: string;
  whatRemains: string;
  availableActions: CrossPillarRecoveryAction[];
  failedAt: string;
  selectedAction?: CrossPillarRecoveryAction;
};

export type CrossPillarHandoffReadiness = {
  hasSavedDoctor?: boolean;
  hasSavedHomeServiceProvider?: boolean;
  hasSavedPersonalCareProvider?: boolean;
  toolEvidence?: Partial<Record<CrossPillarToolFamily, CrossPillarToolEvidence>>;
};

export type CrossPillarHandoffRecord = {
  id: string;
  version: 1;
  actionId: CrossPillarCompletionActionId;
  optionId: string;
  optionLabel: string;
  pillar: Pillar;
  workflowReference: WorkflowReference;
  kind: HandoffKind;
  destinationPath: string;
  destinationState: Record<string, unknown>;
  returnPath: string;
  status:
    | "opened"
    | "prepared"
    | "setup_required"
    | "acknowledged"
    | "confirmed"
    | "completed"
    | "failed"
    | "cancelled";
  receipt: WorkflowReceiptMoment;
  createdAt: string;
  updatedAt: string;
  attemptStartedAt?: string;
  attemptCount: number;
  acknowledgedAt?: string;
  completedAt?: string;
  failureReason?: string;
  recovery?: CrossPillarRecoveryPlan;
  toolReadiness: CrossPillarActionToolReadiness;
  externalConfirmationId?: string;
};

export type CrossPillarHandoffInput = {
  result: CrossPillarSubflowResult;
  locale?: string;
  readiness?: CrossPillarHandoffReadiness;
  doctorContext?: unknown;
  now?: string;
  resumeHandoffId?: string;
};

type ActionDefinition = {
  pillar: Pillar;
  workflowReference: WorkflowReference;
  route: string;
  kind?: HandoffKind;
  providerFocus?: ProviderFocus;
  providerReadinessKey?: keyof CrossPillarHandoffReadiness;
  stateKey?: string;
};

const ACTIONS: Record<CrossPillarCompletionActionId, ActionDefinition> = {
  "health-symptoms": {
    pillar: "health",
    workflowReference: APP_WORKFLOW_REFERENCES.symptomCheck,
    route: "/health/symptom-check",
    stateKey: "detailPreference",
  },
  "health-vitals": {
    pillar: "health",
    workflowReference: APP_WORKFLOW_REFERENCES.vitalsTracking,
    route: "/health/vitals",
    stateKey: "detailPreference",
  },
  "health-meds": {
    pillar: "health",
    workflowReference: APP_WORKFLOW_REFERENCES.medicationPlan,
    route: "/meds",
    stateKey: "detailPreference",
  },
  "health-doctor": {
    pillar: "health",
    workflowReference: APP_WORKFLOW_REFERENCES.doctorNextStep,
    route: "/concierge",
    kind: "preparation",
    providerFocus: "doctor_clinic",
    providerReadinessKey: "hasSavedDoctor",
  },
  "health-prevention": {
    pillar: "health",
    workflowReference: APP_WORKFLOW_REFERENCES.healthPrevention,
    route: "/health/prevention",
    stateKey: "activityPreference",
  },
  "health-visual-scan": {
    pillar: "health",
    workflowReference: APP_WORKFLOW_REFERENCES.visualScan,
    route: "/health",
    stateKey: "detailPreference",
  },
  "mind-memory": {
    pillar: "mind",
    workflowReference: APP_WORKFLOW_REFERENCES.memoryGames,
    route: "/brain-coach/remember",
    stateKey: "cognitiveActivityPreference",
  },
  "mind-reflexes": {
    pillar: "mind",
    workflowReference: APP_WORKFLOW_REFERENCES.attentionTraining,
    route: "/brain-coach/focus",
    stateKey: "cognitiveActivityPreference",
  },
  "mind-focus": {
    pillar: "mind",
    workflowReference: APP_WORKFLOW_REFERENCES.executiveFunction,
    route: "/brain-coach/think",
    stateKey: "cognitiveActivityPreference",
  },
  "mind-senses": {
    pillar: "mind",
    workflowReference: APP_WORKFLOW_REFERENCES.sharpenSenses,
    route: "/brain-coach/calm",
    stateKey: "cognitiveActivityPreference",
  },
  "community-friends": {
    pillar: "community",
    workflowReference: APP_WORKFLOW_REFERENCES.socialMatch,
    route: "/social-rooms/kitchen-table",
    stateKey: "communityPreference",
  },
  "community-experts": {
    pillar: "community",
    workflowReference: APP_WORKFLOW_REFERENCES.socialAdvisor,
    route: "/social-rooms/experts",
    stateKey: "communityPreference",
  },
  "community-share": {
    pillar: "community",
    workflowReference: APP_WORKFLOW_REFERENCES.shareStory,
    route: "/social-rooms/share",
    stateKey: "communityPreference",
  },
  "community-activities": {
    pillar: "community",
    workflowReference: APP_WORKFLOW_REFERENCES.communityActivities,
    route: "/social-rooms/activities",
    stateKey: "communityPreference",
  },
  "concierge-home": {
    pillar: "concierge",
    workflowReference: CONCIERGE_FLOW_REFERENCES.homeService,
    route: "/concierge/task/new",
    kind: "preparation",
    providerFocus: "home_service",
    providerReadinessKey: "hasSavedHomeServiceProvider",
  },
  "concierge-care": {
    pillar: "concierge",
    workflowReference: CONCIERGE_FLOW_REFERENCES.careNavigation,
    route: "/concierge/task/new",
    kind: "preparation",
    providerFocus: "personal_care",
    providerReadinessKey: "hasSavedPersonalCareProvider",
  },
  "concierge-order": {
    pillar: "concierge",
    workflowReference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
    route: "/concierge/shopping",
    kind: "preparation",
  },
  "concierge-book": {
    pillar: "concierge",
    workflowReference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
    route: "/concierge",
    kind: "preparation",
    providerFocus: "doctor_clinic",
    providerReadinessKey: "hasSavedDoctor",
  },
};

function recordId(actionId: CrossPillarCompletionActionId, now: string): string {
  return `${actionId}:${now}`;
}

function isSpanish(locale: string | undefined): boolean {
  return locale?.toLowerCase().startsWith("es") ?? false;
}

function requiresMissingProviderSetup(
  definition: ActionDefinition,
  optionId: string,
  readiness: CrossPillarHandoffReadiness,
): boolean {
  return optionId === "saved-provider" || optionId === "usual-provider"
    ? Boolean(definition.providerReadinessKey && readiness[definition.providerReadinessKey] === false)
    : false;
}

function providerSetupPath(focus: ProviderFocus): string {
  return `/onboarding/profile/providers?focus=${encodeURIComponent(focus)}`;
}

function destinationState(
  input: CrossPillarHandoffInput,
  definition: ActionDefinition,
  handoffId: string,
): Record<string, unknown> {
  const shared = {
    source: "home_completion_canvas",
    workflowReference: definition.workflowReference,
    originalActionId: input.result.actionId,
    originalOptionId: input.result.optionId,
    returnTo: "/",
    resumeAfterSetup: true,
  };

  if (definition.providerFocus) {
    Object.assign(shared, {
      setupFocus: definition.providerFocus,
      returnState: {
        source: "home_completion_canvas",
        workflowReference: definition.workflowReference,
        originalActionId: input.result.actionId,
        originalOptionId: input.result.optionId,
        resumeAfterSetup: true,
        crossPillarHandoffId: handoffId,
        crossPillarIdempotencyKey: handoffId,
      },
    });
  }

  if (input.result.actionId === "health-doctor" || input.result.actionId === "concierge-book") {
    return {
      ...shared,
      conciergePrefill: {
        kind: "appointment",
        message: input.result.actionId === "health-doctor"
          ? "Help me prepare a doctor appointment. Ask for the reason and timing, and do not contact anyone without my confirmation."
          : "Help me prepare an appointment. Ask for the reason, provider, and timing, and do not contact or book anyone without my confirmation.",
        flowReference: input.result.actionId === "health-doctor"
          ? CONCIERGE_FLOW_REFERENCES.medicalAppointment
          : definition.workflowReference,
        source: "voice_action",
      },
      voiceActionPayload: {
        provider_preference: input.result.optionId,
        ...(input.result.actionId === "health-doctor" ? { latest_symptom_report: input.doctorContext } : {}),
      },
    };
  }

  if (input.result.actionId === "health-visual-scan") {
    return { ...shared, openVisualScan: true, detailPreference: input.result.optionId };
  }

  if (input.result.actionId === "concierge-home" || input.result.actionId === "concierge-care") {
    return {
      ...shared,
      conciergeTaskEntry: {
        kind: input.result.actionId === "concierge-home" ? "home_service" : "provider_contact",
        providerSearchMode: input.result.actionId === "concierge-care" ? "personal-care" : undefined,
        provider_preference: input.result.optionId,
        flowReference: definition.workflowReference,
        source: "home_completion_canvas",
      },
    };
  }

  if (input.result.actionId === "concierge-order") {
    return { ...shared, providerPreference: input.result.optionId };
  }

  return {
    ...shared,
    ...(definition.stateKey ? { [definition.stateKey]: input.result.optionId } : {}),
  };
}

export function buildCrossPillarHandoff(input: CrossPillarHandoffInput): CrossPillarHandoffRecord {
  const definition = ACTIONS[input.result.actionId];
  const toolReadiness = evaluateCrossPillarActionToolReadiness({
    actionId: input.result.actionId,
    evidence: input.readiness?.toolEvidence,
  });
  const now = input.now ?? new Date().toISOString();
  const missingProvider = requiresMissingProviderSetup(
    definition,
    input.result.optionId,
    input.readiness ?? {},
  );
  const blockedExternalExecution = toolReadiness.externalConfirmationRequired
    && toolReadiness.status !== "ready";
  const kind: HandoffKind = missingProvider ? "provider_setup" : definition.kind ?? "route";
  const intendedPath = definition.route === "/concierge/task/new"
    ? conciergeTaskPath()
    : definition.route;
  const path = missingProvider && definition.providerFocus
    ? providerSetupPath(definition.providerFocus)
    : blockedExternalExecution
      ? toolReadiness.fallbackPath
      : intendedPath;
  const id = input.resumeHandoffId ?? recordId(input.result.actionId, now);
  const state = destinationState(input, definition, id);
  const spanish = isSpanish(input.locale);
  const status = missingProvider || blockedExternalExecution
    ? "setup_required"
    : blockedExternalExecution
      ? (spanish
        ? "Configura la ayuda necesaria o pide ayuda manual. Tu tarea seguira guardada."
        : "Set up the required help or request manual support. Your task will stay saved.")
    : kind === "route"
      ? "opened"
      : "prepared";
  const nextStep = missingProvider
    ? (spanish
      ? "Añade tu proveedor habitual o busca opciones. Después volverás a esta tarea."
      : "Add your usual provider or find options. You will then return to this task.")
    : kind === "route"
      ? (spanish ? "Continúa en la pantalla que se ha abierto." : "Continue on the screen that opened.")
      : (spanish
        ? "Revisa los detalles. Nada se enviará ni reservará sin tu confirmación."
        : "Review the details. Nothing will be sent or booked without your confirmation.");
  const receipt = buildWorkflowReceiptMoment({
    workflowReference: definition.workflowReference,
    status: missingProvider || blockedExternalExecution
      ? "needs_review"
      : kind === "route"
        ? "done"
        : "prepared",
    actionLabel: input.result.optionLabel,
    capturedSummary: missingProvider
      ? (spanish ? "Falta un proveedor guardado. Tu elección sigue guardada." : "A saved provider is missing. Your choice is still saved.")
      : blockedExternalExecution
        ? (spanish
          ? "La herramienta necesaria no esta lista. Tu eleccion sigue guardada."
          : "The required tool is not ready. Your choice is still saved.")
      : kind === "route"
        ? (spanish ? "VYVA abrió el siguiente paso." : "VYVA opened the next step.")
        : (spanish ? "VYVA preparó el siguiente paso." : "VYVA prepared the next step."),
    nextStep,
    details: [
      {
        key: "choice",
        label: spanish ? "Tu elección" : "Your choice",
        value: input.result.optionLabel,
      },
    ],
    locale: spanish ? "es" : "en",
  });

  return {
    id,
    version: 1,
    actionId: input.result.actionId,
    optionId: input.result.optionId,
    optionLabel: input.result.optionLabel,
    pillar: definition.pillar,
    workflowReference: definition.workflowReference,
    kind,
    destinationPath: path,
    destinationState: {
      ...state,
      crossPillarHandoffId: id,
      crossPillarIdempotencyKey: id,
      crossPillarReceipt: receipt,
      ...(blockedExternalExecution
        ? {
            crossPillarOriginalDestinationPath: intendedPath,
            crossPillarToolReadiness: toolReadiness,
            returnTo: "/",
            returnState: {
              ...state,
              crossPillarHandoffId: id,
              crossPillarIdempotencyKey: id,
              crossPillarOriginalDestinationPath: intendedPath,
            },
          }
        : {}),
    },
    returnPath: "/",
    status,
    receipt,
    createdAt: now,
    updatedAt: now,
    attemptStartedAt: now,
    attemptCount: 1,
    toolReadiness,
  };
}

function storageOrNull(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function recordExecutionAttempt(
  handoff: CrossPillarHandoffRecord,
  outcome: CrossPillarExecutionOutcome,
  options: {
    now?: string;
    attemptNumber?: number;
    confirmationId?: string;
    executedToolFamilies?: CrossPillarToolFamily[];
    fallbackReason?: string;
    errorCode?: string;
  } = {},
): void {
  if (typeof window === "undefined") return;
  const finishedAt = options.now ?? new Date().toISOString();
  const receipt = buildCrossPillarExecutionReceipt({
    outcome,
    actionLabel: handoff.optionLabel,
    confirmationId: options.confirmationId,
    fallbackReason: options.fallbackReason,
  });
  const attempt: CrossPillarExecutionAttemptInput = {
    handoffId: handoff.id,
    attemptNumber: options.attemptNumber ?? handoff.attemptCount,
    actionId: handoff.actionId,
    pillar: handoff.pillar,
    workflowReference: handoff.workflowReference,
    // Readiness lists every tool that might be needed. Certification must only
    // receive the adapters that the completed execution actually exercised.
    toolFamilies: options.executedToolFamilies ?? (
      outcome === "succeeded" ? [] : handoff.toolReadiness.required
    ),
    confirmationId: options.confirmationId,
    outcome,
    startedAt: handoff.attemptStartedAt || handoff.createdAt,
    finishedAt: outcome === "started" || outcome === "resumed" ? undefined : finishedAt,
    durationMs: outcome === "started" || outcome === "resumed"
      ? undefined
      : Math.max(0, new Date(finishedAt).getTime() - new Date(handoff.attemptStartedAt || handoff.createdAt).getTime()),
    fallbackPath: handoff.toolReadiness.fallbackPath,
    fallbackReason: options.fallbackReason,
    idempotencyKey: handoff.id,
    whatHappened: receipt.whatHappened,
    whatRemains: receipt.whatRemains,
    errorCode: options.errorCode,
  };
  void apiFetch("/api/cross-pillar/executions/attempts", {
    method: "POST",
    body: JSON.stringify(attempt),
  }).catch(() => {
    // Execution reporting must never block the user's task.
  });
}

export function persistCrossPillarHandoff(
  handoff: CrossPillarHandoffRecord,
  storage: Storage | null = storageOrNull(),
): void {
  if (!storage) return;
  let history: CrossPillarHandoffRecord[] = [];
  try {
    const parsed = JSON.parse(storage.getItem(CROSS_PILLAR_HANDOFF_STORAGE_KEY) ?? "[]");
    history = Array.isArray(parsed) ? parsed : [];
  } catch {
    history = [];
  }
  storage.setItem(
    CROSS_PILLAR_HANDOFF_STORAGE_KEY,
    JSON.stringify([handoff, ...history.filter((item) => item?.id !== handoff.id)].slice(0, 30)),
  );
  storage.setItem(CROSS_PILLAR_ACTIVE_HANDOFF_KEY, JSON.stringify(handoff));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CROSS_PILLAR_HANDOFF_EVENT, { detail: handoff }));
  }
}

export function readCrossPillarHandoff(
  id?: string | null,
  storage: Storage | null = storageOrNull(),
): CrossPillarHandoffRecord | null {
  if (!storage) return null;
  try {
    if (!id) {
      return JSON.parse(storage.getItem(CROSS_PILLAR_ACTIVE_HANDOFF_KEY) ?? "null");
    }
    const history = JSON.parse(storage.getItem(CROSS_PILLAR_HANDOFF_STORAGE_KEY) ?? "[]");
    return Array.isArray(history)
      ? history.find((item) => item?.id === id) ?? null
      : null;
  } catch {
    return null;
  }
}

type HandoffUpdate = Partial<Pick<
  CrossPillarHandoffRecord,
  "status" | "acknowledgedAt" | "completedAt" | "failureReason" | "attemptStartedAt" | "attemptCount" | "externalConfirmationId" | "recovery" | "receipt"
>>;

export function updateCrossPillarHandoff(
  id: string,
  update: HandoffUpdate,
  storage: Storage | null = storageOrNull(),
  now = new Date().toISOString(),
): CrossPillarHandoffRecord | null {
  const current = readCrossPillarHandoff(id, storage);
  if (!current) return null;
  const nextStatus = update.status ?? current.status;
  const receiptStatus = nextStatus === "completed"
    ? "done"
    : nextStatus === "failed"
      ? "failed"
      : nextStatus === "cancelled"
        ? "cancelled"
        : nextStatus === "setup_required"
          ? "needs_review"
          : nextStatus === "acknowledged"
            ? "waiting"
            : "prepared";
  const next: CrossPillarHandoffRecord = {
    ...current,
    ...update,
    receipt: update.receipt ?? {
      ...current.receipt,
      status: receiptStatus,
    },
    updatedAt: now,
  };
  persistCrossPillarHandoff(next, storage);
  if (["completed", "cancelled"].includes(next.status)) {
    storage?.removeItem(CROSS_PILLAR_ACTIVE_HANDOFF_KEY);
  }
  return next;
}

export function acknowledgeCrossPillarHandoff(
  id: string,
  destinationPath?: string,
  storage: Storage | null = storageOrNull(),
  now = new Date().toISOString(),
): CrossPillarHandoffRecord | null {
  const current = readCrossPillarHandoff(id, storage);
  if (!current || ["completed", "cancelled"].includes(current.status)) return current;
  if (destinationPath) {
    const expected = current.destinationPath.split("?")[0];
    const received = destinationPath.split("?")[0];
    if (expected !== received) return current;
  }
  return updateCrossPillarHandoff(id, {
    status: "acknowledged",
    acknowledgedAt: current.acknowledgedAt ?? now,
  }, storage, now);
}

export function completeCrossPillarHandoff(
  id: string,
  storage: Storage | null = storageOrNull(),
  now = new Date().toISOString(),
  externalConfirmationId?: string,
  executedToolFamilies: CrossPillarToolFamily[] = [],
): CrossPillarHandoffRecord | null {
  const current = readCrossPillarHandoff(id, storage);
  if (!current) return null;
  if (current.status === "completed") {
    recordExecutionAttempt(current, "duplicate", {
      now,
      attemptNumber: current.attemptCount + 1,
      confirmationId: current.externalConfirmationId,
    });
    return current;
  }
  if (
    current.toolReadiness.externalConfirmationRequired
    && !canClaimCrossPillarExternalSuccess({
      readiness: current.toolReadiness,
      externalConfirmationId,
    })
  ) {
    const blocked = updateCrossPillarHandoff(id, {
      status: "acknowledged",
      failureReason: externalConfirmationId
        ? "tool_readiness_not_confirmed"
        : "external_confirmation_missing",
    }, storage, now);
    if (blocked) {
      recordExecutionAttempt(blocked, "blocked", {
        now,
        fallbackReason: blocked.failureReason,
        errorCode: blocked.failureReason,
      });
    }
    return blocked;
  }
  const completed = updateCrossPillarHandoff(id, {
    status: "completed",
    completedAt: now,
    failureReason: undefined,
    externalConfirmationId,
  }, storage, now);
  if (completed) {
    recordExecutionAttempt(completed, "succeeded", {
      now,
      confirmationId: externalConfirmationId,
      executedToolFamilies,
    });
  }
  return completed;
}

function recoveryExplanation(reason: string): string {
  if (reason.includes("timeout")) return "That service took too long to respond.";
  if (reason.includes("unavailable") || reason.includes("readiness")) {
    return "That service is not available right now.";
  }
  if (reason.includes("confirmation")) return "We could not confirm that the action finished.";
  return "That step could not be completed.";
}

function recoveryActionsFor(handoff: CrossPillarHandoffRecord): CrossPillarRecoveryAction[] {
  const actions: CrossPillarRecoveryAction[] = ["retry", "choose_alternative", "prepare_for_later"];
  if (
    handoff.kind === "provider_setup"
    || handoff.toolReadiness.externalConfirmationRequired
    || handoff.pillar === "health"
    || handoff.pillar === "concierge"
  ) {
    actions.push("trusted_contact");
  }
  actions.push("ask_vyva");
  return actions;
}

function buildRecoveryPlan(
  handoff: CrossPillarHandoffRecord,
  reason: string,
  failedAt: string,
): CrossPillarRecoveryPlan {
  return {
    reasonCode: reason,
    explanation: recoveryExplanation(reason),
    preservedSummary: `Your details for ${handoff.optionLabel} are saved.`,
    whatSucceeded: "Your information and choices were saved.",
    whatFailed: `${handoff.optionLabel} did not finish.`,
    whatRemains: "Choose how you would like to continue.",
    availableActions: recoveryActionsFor(handoff),
    failedAt,
  };
}

function failedReceipt(
  handoff: CrossPillarHandoffRecord,
  recovery: CrossPillarRecoveryPlan,
): WorkflowReceiptMoment {
  return {
    ...handoff.receipt,
    status: "failed",
    statusLabel: "Needs attention",
    title: "That step did not finish",
    message: recovery.preservedSummary,
    nextStep: recovery.whatRemains,
    primaryActionLabel: "Choose how to continue",
  };
}

export function failCrossPillarHandoff(
  id: string,
  reason: string,
  storage: Storage | null = storageOrNull(),
  now = new Date().toISOString(),
): CrossPillarHandoffRecord | null {
  const current = readCrossPillarHandoff(id, storage);
  if (!current) return null;
  const recovery = buildRecoveryPlan(current, reason, now);
  const failed = updateCrossPillarHandoff(id, {
    status: "failed",
    failureReason: reason,
    recovery,
    receipt: failedReceipt(current, recovery),
  }, storage, now);
  if (failed) recordExecutionAttempt(failed, "failed", { now, fallbackReason: reason, errorCode: reason });
  return failed;
}

export function timeoutCrossPillarHandoff(
  id: string,
  reason = "execution_timeout",
  storage: Storage | null = storageOrNull(),
  now = new Date().toISOString(),
): CrossPillarHandoffRecord | null {
  const current = readCrossPillarHandoff(id, storage);
  if (!current) return null;
  const recovery = buildRecoveryPlan(current, reason, now);
  const timedOut = updateCrossPillarHandoff(id, {
    status: "failed",
    failureReason: reason,
    recovery,
    receipt: failedReceipt(current, recovery),
  }, storage, now);
  if (timedOut) recordExecutionAttempt(timedOut, "timed_out", { now, fallbackReason: reason, errorCode: reason });
  return timedOut;
}

export function cancelCrossPillarHandoff(
  id: string,
  storage: Storage | null = storageOrNull(),
  now = new Date().toISOString(),
): CrossPillarHandoffRecord | null {
  const cancelled = updateCrossPillarHandoff(id, {
    status: "cancelled",
  }, storage, now);
  if (cancelled) recordExecutionAttempt(cancelled, "cancelled", { now });
  return cancelled;
}

export function retryCrossPillarHandoff(
  id: string,
  navigate: (path: string, options?: NavigateOptions) => boolean | void,
  storage: Storage | null = storageOrNull(),
): CrossPillarHandoffRecord | null {
  const current = readCrossPillarHandoff(id, storage);
  if (!current) return null;
  if (current.status === "completed") {
    recordExecutionAttempt(current, "duplicate", {
      attemptNumber: current.attemptCount + 1,
      confirmationId: current.externalConfirmationId,
    });
    return current;
  }
  const next = updateCrossPillarHandoff(id, {
    status: current.kind === "provider_setup" ? "setup_required" : "prepared",
    failureReason: undefined,
    attemptStartedAt: new Date().toISOString(),
    attemptCount: (current.attemptCount ?? 1) + 1,
  }, storage);
  if (!next) return null;
  recordExecutionAttempt(next, "resumed");
  navigate(next.destinationPath, {
    state: {
      ...next.destinationState,
      crossPillarHandoffId: next.id,
      crossPillarIdempotencyKey: next.id,
      crossPillarRetry: true,
    },
  });
  return next;
}

export function recoverCrossPillarHandoff(
  id: string,
  action: CrossPillarRecoveryAction,
  navigate: (path: string, options?: NavigateOptions) => boolean | void,
  storage: Storage | null = storageOrNull(),
  now = new Date().toISOString(),
): CrossPillarHandoffRecord | null {
  const current = readCrossPillarHandoff(id, storage);
  if (!current) return null;
  if (action === "retry") return retryCrossPillarHandoff(id, navigate, storage);
  if (current.status === "completed") {
    recordExecutionAttempt(current, "duplicate", {
      now,
      attemptNumber: current.attemptCount + 1,
      confirmationId: current.externalConfirmationId,
    });
    return current;
  }

  const recovery = current.recovery ?? buildRecoveryPlan(
    current,
    current.failureReason || "execution_failed",
    now,
  );
  const next = updateCrossPillarHandoff(id, {
    status: action === "prepare_for_later" ? "prepared" : "failed",
    recovery: { ...recovery, selectedAction: action },
    receipt: {
      ...current.receipt,
      status: action === "prepare_for_later" ? "saved" : "needs_review",
      statusLabel: action === "prepare_for_later" ? "Saved" : "Needs review",
      title: action === "prepare_for_later" ? "Saved for later" : "Choose another way",
      message: recovery.preservedSummary,
      nextStep: action === "prepare_for_later"
        ? "You can continue this task when you are ready."
        : recovery.whatRemains,
    },
  }, storage, now);
  if (!next) return null;

  const commonState = {
    ...next.destinationState,
    crossPillarRecovery: action,
    crossPillarHandoffId: next.id,
    crossPillarIdempotencyKey: next.id,
    originalActionId: next.actionId,
    originalOptionId: next.optionId,
    resumeAfterRecovery: true,
  };
  let path = next.returnPath;
  if (action === "trusted_contact") path = "/onboarding/profile/care-team";
  if (action === "choose_alternative" && next.kind === "provider_setup") {
    path = next.destinationPath;
  }
  recordExecutionAttempt(next, "fallback", {
    now,
    fallbackReason: action,
  });
  navigate(path, { state: commonState });
  return next;
}

export function executeCrossPillarHandoff(
  input: CrossPillarHandoffInput,
  navigate: (path: string, options?: NavigateOptions) => boolean | void,
): CrossPillarHandoffRecord {
  const handoff = buildCrossPillarHandoff(input);
  persistCrossPillarHandoff(handoff);
  recordExecutionAttempt(
    handoff,
    handoff.toolReadiness.status === "ready"
      ? "started"
      : handoff.toolReadiness.status === "temporarily_unavailable"
        ? "fallback"
        : "blocked",
    {
      fallbackReason: handoff.toolReadiness.blockers[0]?.reason,
      errorCode: handoff.toolReadiness.blockers[0]?.family,
    },
  );
  navigate(handoff.destinationPath, { state: handoff.destinationState });
  return handoff;
}
