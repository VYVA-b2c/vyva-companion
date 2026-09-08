import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CROSS_PILLAR_ACTIVE_HANDOFF_KEY,
  CROSS_PILLAR_HANDOFF_STORAGE_KEY,
  acknowledgeCrossPillarHandoff,
  buildCrossPillarHandoff,
  completeCrossPillarHandoff,
  chooseAnotherCrossPillarProvider,
  executeCrossPillarHandoff,
  failCrossPillarHandoff,
  readCrossPillarHandoff,
  recoverCrossPillarHandoff,
  retryCrossPillarHandoff,
  timeoutCrossPillarHandoff,
} from "./crossPillarHandoffExecution";
import {
  CROSS_PILLAR_COMPLETION_ACTIONS,
  type CrossPillarCompletionActionId,
} from "@/components/voice-canvas/CrossPillarSubflowCanvas";
import {
  CROSS_PILLAR_TOOL_FAMILIES,
  type CrossPillarToolFamily,
} from "../../shared/crossPillarToolReadiness";

function result(actionId: CrossPillarCompletionActionId, optionId = "recommended") {
  return { actionId, optionId, optionLabel: "Chosen option" };
}

function readyToolEvidence() {
  return Object.fromEntries(CROSS_PILLAR_TOOL_FAMILIES.map((family) => [
    family,
    { family, status: "ready" as const, adapter: `sandbox:${family}` },
  ])) as Record<CrossPillarToolFamily, {
    family: CrossPillarToolFamily;
    status: "ready";
    adapter: string;
  }>;
}

describe("cross-pillar real handoff execution", () => {
  beforeEach(() => window.localStorage.clear());

  it("maps every primary action to a real destination and receipt", () => {
    for (const actionId of CROSS_PILLAR_COMPLETION_ACTIONS) {
      const handoff = buildCrossPillarHandoff({
        result: result(actionId),
        now: "2026-07-27T12:00:00.000Z",
      });
      expect(handoff.destinationPath).toMatch(/^\//);
      expect(handoff.workflowReference).toBeTruthy();
      expect(handoff.receipt.title).toBeTruthy();
      expect(handoff.destinationState.crossPillarReceipt).toEqual(handoff.receipt);
    }
  });

  it("opens and records a Health destination", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("health-symptoms", "guide-me"),
      now: "2026-07-27T12:01:00.000Z",
    }, navigate);
    expect(handoff.destinationPath).toBe("/health/symptom-check");
    expect(navigate).toHaveBeenCalledWith(
      "/health/symptom-check",
      expect.objectContaining({
        state: expect.objectContaining({ detailPreference: "guide-me" }),
      }),
    );
    expect(JSON.parse(window.localStorage.getItem(CROSS_PILLAR_ACTIVE_HANDOFF_KEY) ?? "{}").id)
      .toBe(handoff.id);
  });

  it("opens a Mind activity with its selected preference", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("mind-memory", "gentle"),
    }, navigate);
    expect(handoff.destinationPath).toBe("/brain-coach/remember");
    expect(handoff.destinationState.cognitiveActivityPreference).toBe("gentle");
    expect(navigate).toHaveBeenCalledWith(
      "/brain-coach/remember",
      expect.objectContaining({
        state: expect.objectContaining({
          cognitiveActivityPreference: "gentle",
          crossPillarReceipt: handoff.receipt,
        }),
      }),
    );
  });

  it("opens the Community destination without losing the choice", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("community-activities", "nearby"),
    }, navigate);
    expect(handoff.destinationPath).toBe("/social-rooms/activities");
    expect(handoff.destinationState.communityPreference).toBe("nearby");
    expect(navigate).toHaveBeenCalledWith(
      "/social-rooms/activities",
      expect.objectContaining({
        state: expect.objectContaining({
          communityPreference: "nearby",
          crossPillarReceipt: handoff.receipt,
        }),
      }),
    );
  });

  it("uses focused provider setup and preserves Concierge resume context", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("concierge-book", "saved-provider"),
      readiness: { hasSavedDoctor: false },
      locale: "es",
    }, navigate);
    expect(handoff.status).toBe("setup_required");
    expect(handoff.destinationPath).toBe(
      "/onboarding/profile/providers?focus=doctor_clinic",
    );
    expect(handoff.destinationState).toEqual(expect.objectContaining({
      returnTo: "/",
      resumeAfterSetup: true,
      setupFocus: "doctor_clinic",
      returnState: expect.objectContaining({
        originalActionId: "concierge-book",
        originalOptionId: "saved-provider",
        crossPillarHandoffId: handoff.id,
        crossPillarIdempotencyKey: handoff.id,
      }),
    }));
    expect(navigate).toHaveBeenCalledWith(
      "/onboarding/profile/providers?focus=doctor_clinic",
      expect.objectContaining({
        state: expect.objectContaining({
          resumeAfterSetup: true,
          crossPillarReceipt: handoff.receipt,
        }),
      }),
    );
  });

  it("completes a Health journey only after the destination acknowledges it", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("health-symptoms", "guide-me"),
      now: "2026-07-27T13:00:00.000Z",
    }, navigate);

    expect(acknowledgeCrossPillarHandoff(handoff.id, "/health/symptom-check")?.status)
      .toBe("acknowledged");
    const completed = completeCrossPillarHandoff(handoff.id);
    expect(completed?.status).toBe("completed");
    expect(completed?.receipt.status).toBe("done");
    expect(window.localStorage.getItem(CROSS_PILLAR_ACTIVE_HANDOFF_KEY)).toBeNull();
  });

  it("restores a Mind journey after a refresh", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("mind-memory", "gentle"),
      now: "2026-07-27T13:01:00.000Z",
    }, navigate);

    expect(readCrossPillarHandoff(handoff.id)?.destinationPath).toBe("/brain-coach/remember");
    expect(acknowledgeCrossPillarHandoff(handoff.id, "/brain-coach/remember")?.status).toBe("acknowledged");
    expect(completeCrossPillarHandoff(handoff.id)?.status).toBe("completed");
  });

  it("retries a failed Community journey without creating a duplicate handoff", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("community-activities", "nearby"),
      now: "2026-07-27T13:02:00.000Z",
    }, navigate);

    expect(failCrossPillarHandoff(handoff.id, "Destination unavailable")?.status).toBe("failed");
    const retried = retryCrossPillarHandoff(handoff.id, navigate);
    expect(retried?.id).toBe(handoff.id);
    expect(retried?.attemptCount).toBe(2);
    expect(acknowledgeCrossPillarHandoff(handoff.id, "/social-rooms/activities")?.status)
      .toBe("acknowledged");
    expect(completeCrossPillarHandoff(handoff.id)?.status).toBe("completed");

    const history = JSON.parse(
      window.localStorage.getItem(CROSS_PILLAR_HANDOFF_STORAGE_KEY) ?? "[]",
    );
    expect(history.filter((item: { id: string }) => item.id === handoff.id)).toHaveLength(1);
  });

  it("recovers a failed Health action with the same handoff and saved choices", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("health-symptoms", "guide-me"),
      now: "2026-07-27T14:00:00.000Z",
    }, navigate);
    failCrossPillarHandoff(
      handoff.id,
      "service_unavailable",
      window.localStorage,
      "2026-07-27T14:01:00.000Z",
    );
    navigate.mockClear();

    const recovered = recoverCrossPillarHandoff(
      handoff.id,
      "retry",
      navigate,
      window.localStorage,
      "2026-07-27T14:02:00.000Z",
    );

    expect(recovered).toMatchObject({ id: handoff.id, attemptCount: 2 });
    expect(navigate).toHaveBeenCalledWith(
      "/health/symptom-check",
      expect.objectContaining({
        state: expect.objectContaining({
          detailPreference: "guide-me",
          crossPillarHandoffId: handoff.id,
          crossPillarIdempotencyKey: handoff.id,
          crossPillarRetry: true,
        }),
      }),
    );
  });

  it("saves a failed Mind action for later without losing its original task", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("mind-memory", "gentle"),
      now: "2026-07-27T14:03:00.000Z",
    }, navigate);
    failCrossPillarHandoff(handoff.id, "execution_timeout", window.localStorage);
    navigate.mockClear();

    const recovered = recoverCrossPillarHandoff(
      handoff.id,
      "prepare_for_later",
      navigate,
      window.localStorage,
    );

    expect(recovered).toMatchObject({
      id: handoff.id,
      status: "prepared",
      recovery: expect.objectContaining({ selectedAction: "prepare_for_later" }),
    });
    expect(recovered?.receipt.title).toBe("Saved for later");
    expect(navigate).toHaveBeenCalledWith(
      "/",
      expect.objectContaining({
        state: expect.objectContaining({
          originalActionId: "mind-memory",
          originalOptionId: "gentle",
          crossPillarHandoffId: handoff.id,
          resumeAfterRecovery: true,
        }),
      }),
    );
  });

  it("offers another Community option while preserving the failed selection", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("community-activities", "nearby"),
      now: "2026-07-27T14:04:00.000Z",
    }, navigate);
    failCrossPillarHandoff(handoff.id, "destination_unavailable", window.localStorage);
    navigate.mockClear();

    const recovered = recoverCrossPillarHandoff(
      handoff.id,
      "choose_alternative",
      navigate,
      window.localStorage,
    );

    expect(recovered?.id).toBe(handoff.id);
    expect(recovered?.status).toBe("failed");
    expect(navigate).toHaveBeenCalledWith(
      "/",
      expect.objectContaining({
        state: expect.objectContaining({
          crossPillarRecovery: "choose_alternative",
          originalActionId: "community-activities",
          originalOptionId: "nearby",
          crossPillarIdempotencyKey: handoff.id,
        }),
      }),
    );
  });

  it("routes failed Concierge work to trusted-contact setup and can resume it", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("concierge-book", "saved-provider"),
      readiness: { hasSavedDoctor: true, toolEvidence: readyToolEvidence() },
      now: "2026-07-27T14:05:00.000Z",
    }, navigate);
    failCrossPillarHandoff(handoff.id, "provider_unavailable", window.localStorage);
    navigate.mockClear();

    const recovered = recoverCrossPillarHandoff(
      handoff.id,
      "trusted_contact",
      navigate,
      window.localStorage,
    );

    expect(recovered?.id).toBe(handoff.id);
    expect(navigate).toHaveBeenCalledWith(
      "/onboarding/profile/care-team",
      expect.objectContaining({
        state: expect.objectContaining({
          crossPillarRecovery: "trusted_contact",
          originalActionId: "concierge-book",
          originalOptionId: "saved-provider",
          crossPillarHandoffId: handoff.id,
          resumeAfterRecovery: true,
        }),
      }),
    );
  });

  it("records a timeout locally as a failed handoff ready for retry", () => {
    const handoff = executeCrossPillarHandoff({
      result: result("mind-memory", "gentle"),
      now: "2026-07-27T13:02:00.000Z",
    }, vi.fn());

    const timedOut = timeoutCrossPillarHandoff(
      handoff.id,
      "destination_timeout",
      window.localStorage,
      "2026-07-27T13:03:00.000Z",
    );
    expect(timedOut).toMatchObject({
      status: "failed",
      failureReason: "destination_timeout",
    });
  });

  it("does not navigate or repeat work when retrying an already completed handoff", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("health-symptoms", "guide-me"),
    }, navigate);
    acknowledgeCrossPillarHandoff(handoff.id, "/health/symptom-check");
    completeCrossPillarHandoff(handoff.id);
    navigate.mockClear();

    expect(retryCrossPillarHandoff(handoff.id, navigate)?.status).toBe("completed");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("resumes Concierge after provider setup with the same handoff identity", () => {
    const navigate = vi.fn();
    const setup = executeCrossPillarHandoff({
      result: result("concierge-book", "saved-provider"),
      readiness: { hasSavedDoctor: false },
      now: "2026-07-27T13:03:00.000Z",
    }, navigate);

    const returnState = setup.destinationState.returnState as Record<string, unknown>;
    expect(returnState.crossPillarHandoffId).toBe(setup.id);

    const resumed = executeCrossPillarHandoff({
      result: result("concierge-book", "saved-provider"),
      readiness: { hasSavedDoctor: true, toolEvidence: readyToolEvidence() },
      resumeHandoffId: String(returnState.crossPillarHandoffId),
      now: "2026-07-27T13:04:00.000Z",
    }, navigate);
    expect(resumed.id).toBe(setup.id);
    expect(resumed.destinationState.crossPillarIdempotencyKey).toBe(setup.id);
    expect(acknowledgeCrossPillarHandoff(resumed.id, "/concierge")?.status).toBe("acknowledged");
    expect(completeCrossPillarHandoff(
      resumed.id,
      window.localStorage,
      "2026-07-27T13:05:00.000Z",
      "provider-confirmation-123",
    )?.status).toBe("completed");

    const history = JSON.parse(
      window.localStorage.getItem(CROSS_PILLAR_HANDOFF_STORAGE_KEY) ?? "[]",
    );
    expect(history.filter((item: { id: string }) => item.id === setup.id)).toHaveLength(1);
  });

  it("prepares contact without claiming it was sent", () => {
    const handoff = buildCrossPillarHandoff({
      result: result("health-doctor", "usual-provider"),
      readiness: { hasSavedDoctor: true, toolEvidence: readyToolEvidence() },
    });
    expect(handoff.destinationPath).toBe("/concierge");
    expect(handoff.status).toBe("prepared");
    expect(handoff.receipt.status).toBe("prepared");
    expect(handoff.receipt.nextStep).toContain("Nothing will be sent or booked");
  });

  it("falls back safely when a confirmed external action has no ready adapter", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("health-doctor", "usual-provider"),
      readiness: { hasSavedDoctor: true },
    }, navigate);

    expect(handoff.status).toBe("setup_required");
    expect(handoff.destinationPath).toBe(
      "/onboarding/profile/providers?focus=doctor_clinic",
    );
    expect(handoff.destinationState.crossPillarOriginalDestinationPath).toBe(
      "/concierge",
    );
    expect(handoff.receipt.status).toBe("needs_review");
    expect(handoff.receipt.message).toContain("choice is still saved");
    expect(navigate).toHaveBeenCalledWith(
      handoff.destinationPath,
      expect.objectContaining({
        state: expect.objectContaining({
          crossPillarHandoffId: handoff.id,
          crossPillarOriginalDestinationPath: "/concierge",
        }),
      }),
    );
  });

  it("does not complete an external handoff without adapter confirmation", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("concierge-book", "saved-provider"),
      readiness: { hasSavedDoctor: true, toolEvidence: readyToolEvidence() },
    }, navigate);
    expect(completeCrossPillarHandoff(handoff.id)?.status).toBe("acknowledged");
    expect(readCrossPillarHandoff(handoff.id)?.failureReason).toBe("external_confirmation_missing");
  });

  it("keeps a bounded handoff history", () => {
    const navigate = vi.fn();
    for (let index = 0; index < 35; index += 1) {
      executeCrossPillarHandoff({
        result: result("mind-focus", "short"),
        now: `2026-07-27T12:${String(index).padStart(2, "0")}:00.000Z`,
      }, navigate);
    }
    const history = JSON.parse(
      window.localStorage.getItem(CROSS_PILLAR_HANDOFF_STORAGE_KEY) ?? "[]",
    );
    expect(history).toHaveLength(30);
  });

});
