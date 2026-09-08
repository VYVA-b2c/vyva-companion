import { describe, expect, it, vi } from "vitest";
import {
  buildCorrectionProposal,
  buildDeletionProposal,
  buildHealthPolicyFilteredMemoryBlock,
  deleteHealthSemanticMemory,
  type HealthSemanticMemoryProposal,
  healthSemanticMemoryProposalDigest,
  InMemoryHealthSemanticMemoryOutboxStore,
  recordPreventiveHealthMemoryProposal,
} from "./healthSemanticMemory.js";
import {
  computeHealthMemoryPolicyCohortBucket,
  consentFromProfileDataSharing,
} from "./healthMemoryPolicy.js";
import {
  TASK13_ANSWER_DIGEST,
  TASK13_COMPLETION_REFERENCE,
  TASK13_FLOW_INSTANCE_ID,
  TASK13_NOW,
  TASK13_PROFILE_ID,
  TASK13_USER_ID,
  task13DisabledEnv,
  task13NoSemanticMemoryConsent,
  task13PilotEnv,
  task13PreventiveHealthResult,
  task13RevokedSemanticMemoryConsent,
  task13SemanticMemoryConsent,
} from "./healthMemoryFixtures.js";

function proposalInput(store: InMemoryHealthSemanticMemoryOutboxStore, overrides: Record<string, unknown> = {}) {
  return {
    userId: TASK13_USER_ID,
    profileId: TASK13_PROFILE_ID,
    mem0UserId: "mem0.task13",
    flowInstanceId: TASK13_FLOW_INSTANCE_ID,
    completionReference: TASK13_COMPLETION_REFERENCE,
    answerDigest: TASK13_ANSWER_DIGEST,
    result: task13PreventiveHealthResult,
    completedAt: TASK13_NOW,
    profileConsent: task13SemanticMemoryConsent,
    loadCurrentConsentForDelivery: async () => task13SemanticMemoryConsent,
    env: task13PilotEnv,
    store,
    ...overrides,
  };
}

function recomputeSemanticDigest(proposal: HealthSemanticMemoryProposal): HealthSemanticMemoryProposal {
  const { semanticDigest: _semanticDigest, ...withoutDigest } = proposal;
  return {
    ...withoutDigest,
    semanticDigest: healthSemanticMemoryProposalDigest(withoutDigest),
  };
}

function selectedUserAndUnselectedFlowFixture(): {
  userId: string;
  flowInstanceId: string;
  env: Record<string, string | undefined>;
} {
  for (let userIndex = 0; userIndex < 200; userIndex += 1) {
    const userId = `rollout-user-${userIndex}`;
    const userBucket = computeHealthMemoryPolicyCohortBucket(userId);
    if (userBucket >= 9_000) continue;
    const rolloutBasisPoints = userBucket + 1;
    for (let flowIndex = 0; flowIndex < 200; flowIndex += 1) {
      const flowInstanceId = `caller-flow-${flowIndex}`;
      if (computeHealthMemoryPolicyCohortBucket(flowInstanceId) >= rolloutBasisPoints) {
        return {
          userId,
          flowInstanceId,
          env: {
            VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_MODE: "pilot",
            VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_ALLOW_USERS: undefined,
            VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_DENY_USERS: undefined,
            VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_ROLLOUT_BPS: String(rolloutBasisPoints),
            VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_ALLOW_PRODUCTION: "false",
            NODE_ENV: "staging",
          },
        };
      }
    }
  }
  throw new Error("Could not construct Task 13 rollout fixture");
}

describe("Task 13 Health semantic memory outbox", () => {
  it("preserves rollback: disabled flag writes nothing and calls no provider", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const provider = vi.fn();
    await expect(recordPreventiveHealthMemoryProposal(proposalInput(store, {
      env: task13DisabledEnv,
      provider,
      deliverApprovedWrites: true,
    }))).resolves.toMatchObject({
      outcome: "disabled",
      flagReasonCode: "health_memory_policy_disabled_requested",
    });
    expect(store.snapshot()).toHaveLength(0);
    expect(provider).not.toHaveBeenCalled();
  });

  it("stores routine Health semantic writes as approval-required without explicit consent", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const provider = vi.fn();
    const outcome = await recordPreventiveHealthMemoryProposal(proposalInput(store, {
      profileConsent: task13NoSemanticMemoryConsent,
      provider,
      deliverApprovedWrites: true,
    }));
    expect(outcome.outcome).toBe("stored");
    if (outcome.outcome !== "stored") return;
    expect(outcome.providerDelivery).toBe("not_attempted");
    expect(outcome.proposal).toMatchObject({
      category: "routine_health_context",
      status: "approval_required",
      policyDecision: "approval_required",
      policyReasonCode: "health_memory_policy_approval_required",
      providerMemoryId: null,
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it("records provenance and minimized semantic content without raw answer leakage", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const outcome = await recordPreventiveHealthMemoryProposal(proposalInput(store));
    expect(outcome.outcome).toBe("stored");
    if (outcome.outcome !== "stored") return;
    expect(outcome.proposal).toMatchObject({
      userId: TASK13_USER_ID,
      profileId: TASK13_PROFILE_ID,
      mem0UserId: "mem0.task13",
      flowId: "health.preventive_check",
      flowVersion: "1.0.0",
      flowInstanceId: TASK13_FLOW_INSTANCE_ID,
      completionReference: TASK13_COMPLETION_REFERENCE,
      answerDigest: TASK13_ANSWER_DIGEST,
      status: "delivery_pending",
      content: "Preventive health check-in completed with overall state good; suggested app area concierge.",
      provenance: {
        source: "health.preventive_check",
        sourceRecordId: TASK13_COMPLETION_REFERENCE,
        sourceDigest: TASK13_ANSWER_DIGEST,
      },
    });
    const serialized = JSON.stringify(outcome.proposal);
    expect(serialized).not.toContain("Drink water");
    expect(serialized).not.toContain("A preventive reading is ready.");
    expect(serialized).not.toContain("The structured answers are stable.");
  });

  it("is idempotent across concurrent duplicate proposals", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const outcomes = await Promise.all(Array.from({ length: 10 }, () =>
      recordPreventiveHealthMemoryProposal(proposalInput(store))
    ));
    expect(outcomes.filter((item) => item.outcome === "stored")).toHaveLength(1);
    expect(outcomes.filter((item) => item.outcome === "duplicate")).toHaveLength(9);
    expect(store.snapshot()).toHaveLength(1);
  });

  it("rejects semantic conflicts and proposal ID collisions without altering the stored proposal", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const outcome = await recordPreventiveHealthMemoryProposal(proposalInput(store));
    expect(outcome.outcome).toBe("stored");
    if (outcome.outcome !== "stored") return;

    const idempotencyConflict = recomputeSemanticDigest({
      ...outcome.proposal,
      content: "Preventive health check-in completed with conflicting routine context.",
      contentDigest: `sha256:${"b".repeat(64)}`,
    });
    await expect(store.recordProposal(idempotencyConflict)).resolves.toMatchObject({
      outcome: "rejected",
      reason: "semantic_conflict",
    });

    const proposalIdCollision = recomputeSemanticDigest({
      ...outcome.proposal,
      idempotencyKey: `${outcome.proposal.idempotencyKey}:collision`,
      flowInstanceId: `${TASK13_FLOW_INSTANCE_ID}.proposal-id-collision`,
      completionReference: `${TASK13_COMPLETION_REFERENCE}.proposal-id-collision`,
      provenance: {
        ...outcome.proposal.provenance,
        sourceRecordId: `${TASK13_COMPLETION_REFERENCE}.proposal-id-collision`,
        flowInstanceId: `${TASK13_FLOW_INSTANCE_ID}.proposal-id-collision`,
      },
    });
    await expect(store.recordProposal(proposalIdCollision)).resolves.toMatchObject({
      outcome: "rejected",
      reason: "semantic_conflict",
    });

    expect(store.snapshot()).toHaveLength(1);
    expect(store.snapshot()[0]).toEqual(outcome.proposal);
  });

  it("uses stable user identity rather than caller-controlled Flow identity for rollout", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const rollout = selectedUserAndUnselectedFlowFixture();
    const outcome = await recordPreventiveHealthMemoryProposal(proposalInput(store, {
      userId: rollout.userId,
      flowInstanceId: rollout.flowInstanceId,
      env: rollout.env,
    }));
    expect(outcome.outcome).toBe("stored");
    expect(store.snapshot()).toHaveLength(1);
  });

  it("records provider failure without losing the durable proposal", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const provider = vi.fn(async () => {
      throw new Error("mem0 unavailable");
    });
    const outcome = await recordPreventiveHealthMemoryProposal(proposalInput(store, {
      provider,
      deliverApprovedWrites: true,
    }));
    expect(outcome).toMatchObject({
      outcome: "stored",
      providerDelivery: "failed",
    });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(store.snapshot()[0]).toMatchObject({
      status: "delivery_failed",
      failureReason: "mem0 unavailable",
    });
  });

  it("does not mark provider delivery from missing provider IDs or fire-and-forget placeholders", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const provider = vi.fn(async () => ({ providerMemoryId: "" }));
    const outcome = await recordPreventiveHealthMemoryProposal(proposalInput(store, {
      provider,
      deliverApprovedWrites: true,
    }));
    expect(outcome).toMatchObject({
      outcome: "stored",
      providerDelivery: "failed",
    });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(store.snapshot()[0]).toMatchObject({
      status: "delivery_failed",
      providerMemoryId: null,
      failureReason: "mem0_provider_memory_id_missing",
    });
    expect(JSON.stringify(store.snapshot())).not.toContain("mem0.pending");
  });

  it("rechecks consent before delivery and blocks provider writes after revocation", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const provider = vi.fn(async () => ({ providerMemoryId: "mem0.memory.should-not-write" }));
    const outcome = await recordPreventiveHealthMemoryProposal(proposalInput(store, {
      provider,
      deliverApprovedWrites: true,
      loadCurrentConsentForDelivery: async () => task13RevokedSemanticMemoryConsent,
    }));
    expect(outcome).toMatchObject({
      outcome: "stored",
      providerDelivery: "failed",
    });
    expect(provider).not.toHaveBeenCalled();
    expect(store.snapshot()[0]).toMatchObject({
      status: "delivery_failed",
      failureReason: "health_memory_policy_consent_revoked",
    });
  });

  it("fails closed when current delivery consent is missing, unavailable or unrelated", async () => {
    const missingLoaderStore = new InMemoryHealthSemanticMemoryOutboxStore();
    const missingLoaderProvider = vi.fn(async () => ({ providerMemoryId: "mem0.memory.missing-loader" }));
    const missingLoader = await recordPreventiveHealthMemoryProposal(proposalInput(missingLoaderStore, {
      provider: missingLoaderProvider,
      deliverApprovedWrites: true,
      loadCurrentConsentForDelivery: undefined,
    }));
    expect(missingLoader).toMatchObject({
      outcome: "stored",
      providerDelivery: "failed",
      proposal: {
        status: "delivery_failed",
        failureReason: "health_memory_policy_current_consent_unavailable",
      },
    });
    expect(missingLoaderProvider).not.toHaveBeenCalled();

    const unavailableStore = new InMemoryHealthSemanticMemoryOutboxStore();
    const unavailableProvider = vi.fn(async () => ({ providerMemoryId: "mem0.memory.unavailable-loader" }));
    const unavailable = await recordPreventiveHealthMemoryProposal(proposalInput(unavailableStore, {
      flowInstanceId: `${TASK13_FLOW_INSTANCE_ID}.unavailable-consent`,
      completionReference: `${TASK13_COMPLETION_REFERENCE}.unavailable-consent`,
      provider: unavailableProvider,
      deliverApprovedWrites: true,
      loadCurrentConsentForDelivery: async () => {
        throw new Error("profile unavailable");
      },
    }));
    expect(unavailable).toMatchObject({
      outcome: "stored",
      providerDelivery: "failed",
      proposal: {
        status: "delivery_failed",
        failureReason: "health_memory_policy_current_consent_unavailable",
      },
    });
    expect(unavailableProvider).not.toHaveBeenCalled();

    const unrelatedConsentStore = new InMemoryHealthSemanticMemoryOutboxStore();
    const unrelatedConsentProvider = vi.fn(async () => ({ providerMemoryId: "mem0.memory.unrelated-consent" }));
    const unrelatedConsent = await recordPreventiveHealthMemoryProposal(proposalInput(unrelatedConsentStore, {
      flowInstanceId: `${TASK13_FLOW_INSTANCE_ID}.unrelated-consent`,
      completionReference: `${TASK13_COMPLETION_REFERENCE}.unrelated-consent`,
      provider: unrelatedConsentProvider,
      deliverApprovedWrites: true,
      loadCurrentConsentForDelivery: async () => ({
        push: { enabled: true },
        call: { preventiveHealthEnabled: true },
        memory: { write_allowed: true },
      }),
    }));
    expect(unrelatedConsent).toMatchObject({
      outcome: "stored",
      providerDelivery: "failed",
      proposal: {
        status: "delivery_failed",
        failureReason: "health_memory_policy_missing_write_consent",
      },
    });
    expect(unrelatedConsentProvider).not.toHaveBeenCalled();
  });

  it("claims provider delivery atomically so duplicate callers cannot deliver twice", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const provider = vi.fn(async () => ({ providerMemoryId: "mem0.memory.concurrent" }));
    const outcomes = await Promise.all(Array.from({ length: 10 }, () =>
      recordPreventiveHealthMemoryProposal(proposalInput(store, {
        provider,
        deliverApprovedWrites: true,
      }))
    ));
    expect(outcomes.filter((item) => item.outcome === "stored")).toHaveLength(1);
    expect(outcomes.filter((item) => item.outcome === "duplicate")).toHaveLength(9);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(store.snapshot()).toHaveLength(1);
    expect(store.snapshot()[0]).toMatchObject({
      status: "delivered",
      providerMemoryId: "mem0.memory.concurrent",
    });
  });

  it("records provider delivery only when the caller explicitly requests delivery", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const provider = vi.fn(async () => ({ providerMemoryId: "mem0.memory.task13" }));
    const outcome = await recordPreventiveHealthMemoryProposal(proposalInput(store, {
      provider,
      deliverApprovedWrites: true,
    }));
    expect(outcome).toMatchObject({
      outcome: "stored",
      providerDelivery: "delivered",
    });
    if (outcome.outcome !== "stored") return;
    expect(outcome.proposal).toMatchObject({
      status: "delivered",
      providerMemoryId: "mem0.memory.task13",
    });
    expect(store.snapshot()[0]).toMatchObject({
      status: "delivered",
      providerMemoryId: "mem0.memory.task13",
    });
    expect(store.snapshot()[0]?.semanticDigest).toBe(outcome.proposal.semanticDigest);
    const { semanticDigest, ...withoutDigest } = outcome.proposal;
    expect(semanticDigest).toBe(healthSemanticMemoryProposalDigest(withoutDigest));
  });

  it("supports correction and deletion proposals with linked provenance", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const originalOutcome = await recordPreventiveHealthMemoryProposal(proposalInput(store, {
      deliverApprovedWrites: true,
      provider: vi.fn(async () => ({ providerMemoryId: "mem0.memory.original" })),
    }));
    expect(originalOutcome.outcome).toBe("stored");
    if (originalOutcome.outcome !== "stored") return;
    expect(originalOutcome.proposal.status).toBe("delivered");

    const consent = consentFromProfileDataSharing(task13SemanticMemoryConsent);
    const correction = buildCorrectionProposal({
      original: originalOutcome.proposal,
      correctedContent: "Preventive health check-in completed with corrected routine context.",
      now: new Date(TASK13_NOW.getTime() + 1_000),
      consent,
    });
    expect(correction).toBeTruthy();
    if (!correction) return;
    await expect(store.requestCorrection({
      originalProposalId: originalOutcome.proposal.proposalId,
      correctedProposal: correction,
    })).resolves.toMatchObject({ outcome: "stored" });
    expect(store.snapshot().find((item) => item.operation === "correction")).toMatchObject({
      status: "delivery_pending",
      provenance: { correctionOf: originalOutcome.proposal.proposalId },
    });
    expect(store.snapshot().find((item) => item.proposalId === originalOutcome.proposal.proposalId)).toMatchObject({
      status: "corrected",
      localVisibility: "suppressed",
      supersededBy: correction.proposalId,
    });
    await expect(store.requestCorrection({
      originalProposalId: originalOutcome.proposal.proposalId,
      correctedProposal: correction,
    })).resolves.toMatchObject({ outcome: "duplicate" });
    const hiddenAfterCorrection = await buildHealthPolicyFilteredMemoryBlock({
      userId: TASK13_USER_ID,
      profileId: TASK13_PROFILE_ID,
      flowInstanceId: TASK13_FLOW_INSTANCE_ID,
      profileConsent: task13SemanticMemoryConsent,
      env: task13PilotEnv,
      store,
      now: TASK13_NOW,
    });
    expect(hiddenAfterCorrection.memoryBlock).toBe("");

    const secondOriginalOutcome = await recordPreventiveHealthMemoryProposal(proposalInput(store, {
      flowInstanceId: `${TASK13_FLOW_INSTANCE_ID}.delete`,
      completionReference: `${TASK13_COMPLETION_REFERENCE}.delete`,
      deliverApprovedWrites: true,
      provider: vi.fn(async () => ({ providerMemoryId: "mem0.memory.delete-original" })),
    }));
    expect(secondOriginalOutcome.outcome).toBe("stored");
    if (secondOriginalOutcome.outcome !== "stored") return;

    const deletion = buildDeletionProposal({
      original: secondOriginalOutcome.proposal,
      now: new Date(TASK13_NOW.getTime() + 2_000),
      consent,
    });
    expect(deletion).toBeTruthy();
    if (!deletion) return;
    await expect(store.requestDeletion({
      originalProposalId: secondOriginalOutcome.proposal.proposalId,
      deletionProposal: deletion,
    })).resolves.toMatchObject({ outcome: "stored" });
    expect(store.snapshot().find((item) => item.operation === "deletion")).toMatchObject({
      status: "delete_pending",
      provenance: { deletionOf: secondOriginalOutcome.proposal.proposalId },
    });
    expect(store.snapshot().find((item) => item.proposalId === secondOriginalOutcome.proposal.proposalId)).toMatchObject({
      status: "deleted",
      localVisibility: "suppressed",
      deletedBy: deletion.proposalId,
    });

    const providerDelete = vi.fn(async () => undefined);
    await expect(deleteHealthSemanticMemory({
      original: secondOriginalOutcome.proposal,
      deletionProposal: deletion,
      now: new Date(TASK13_NOW.getTime() + 3_000),
      store,
      provider: providerDelete,
    })).resolves.toMatchObject({
      outcome: "deleted",
      proposal: {
        operation: "deletion",
        status: "delivered",
        providerMemoryId: "mem0.memory.delete-original",
      },
    });
    expect(providerDelete).toHaveBeenCalledTimes(1);
    expect(providerDelete).toHaveBeenCalledWith(expect.objectContaining({
      providerMemoryId: "mem0.memory.delete-original",
      mem0UserId: secondOriginalOutcome.proposal.mem0UserId,
    }));

    await expect(deleteHealthSemanticMemory({
      original: secondOriginalOutcome.proposal,
      deletionProposal: deletion,
      now: new Date(TASK13_NOW.getTime() + 4_000),
      store,
      provider: providerDelete,
    })).resolves.toMatchObject({ outcome: "duplicate" });
    expect(providerDelete).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-user and mismatched lifecycle proposals without suppressing the original", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const originalOutcome = await recordPreventiveHealthMemoryProposal(proposalInput(store, {
      flowInstanceId: `${TASK13_FLOW_INSTANCE_ID}.identity`,
      completionReference: `${TASK13_COMPLETION_REFERENCE}.identity`,
      deliverApprovedWrites: true,
      provider: vi.fn(async () => ({ providerMemoryId: "mem0.memory.identity-original" })),
    }));
    expect(originalOutcome.outcome).toBe("stored");
    if (originalOutcome.outcome !== "stored") return;

    const consent = consentFromProfileDataSharing(task13SemanticMemoryConsent);
    const correction = buildCorrectionProposal({
      original: originalOutcome.proposal,
      correctedContent: "Preventive health check-in completed with identity-safe correction.",
      now: new Date(TASK13_NOW.getTime() + 1_000),
      consent,
    });
    const deletion = buildDeletionProposal({
      original: originalOutcome.proposal,
      now: new Date(TASK13_NOW.getTime() + 2_000),
      consent,
    });
    expect(correction).toBeTruthy();
    expect(deletion).toBeTruthy();
    if (!correction || !deletion) return;

    await expect(store.requestCorrection({
      originalProposalId: originalOutcome.proposal.proposalId,
      correctedProposal: {
        ...correction,
        userId: "other-user-task13",
        profileId: "other-profile-task13",
        mem0UserId: "mem0.other-user-task13",
      },
    })).resolves.toMatchObject({ outcome: "rejected", reason: "invalid_input" });

    await expect(store.requestDeletion({
      originalProposalId: originalOutcome.proposal.proposalId,
      deletionProposal: {
        ...deletion,
        userId: "other-user-task13",
        profileId: "other-profile-task13",
        mem0UserId: "mem0.other-user-task13",
      },
    })).resolves.toMatchObject({ outcome: "rejected", reason: "invalid_input" });

    await expect(store.requestCorrection({
      originalProposalId: originalOutcome.proposal.proposalId,
      correctedProposal: {
        ...correction,
        provenance: {
          ...correction.provenance,
          correctionOf: "health.memory.wrong-original",
        },
      },
    })).resolves.toMatchObject({ outcome: "rejected", reason: "invalid_input" });

    await expect(store.requestDeletion({
      originalProposalId: originalOutcome.proposal.proposalId,
      deletionProposal: {
        ...deletion,
        provenance: {
          ...deletion.provenance,
          deletionOf: "health.memory.wrong-original",
        },
      },
    })).resolves.toMatchObject({ outcome: "rejected", reason: "invalid_input" });

    await expect(store.requestCorrection({
      originalProposalId: originalOutcome.proposal.proposalId,
      correctedProposal: {
        ...correction,
        operation: "deletion",
      },
    })).resolves.toMatchObject({ outcome: "rejected", reason: "invalid_input" });

    await expect(store.requestDeletion({
      originalProposalId: originalOutcome.proposal.proposalId,
      deletionProposal: {
        ...deletion,
        operation: "correction",
      },
    })).resolves.toMatchObject({ outcome: "rejected", reason: "invalid_input" });

    expect(store.snapshot().find((item) => item.proposalId === originalOutcome.proposal.proposalId)).toMatchObject({
      status: "delivered",
      localVisibility: "active",
      supersededBy: null,
      deletedBy: null,
    });
    const stillReadable = await buildHealthPolicyFilteredMemoryBlock({
      userId: TASK13_USER_ID,
      profileId: TASK13_PROFILE_ID,
      flowInstanceId: TASK13_FLOW_INSTANCE_ID,
      profileConsent: task13SemanticMemoryConsent,
      env: task13PilotEnv,
      store,
      now: TASK13_NOW,
    });
    expect(stillReadable.memoryBlock).toContain("Preventive health check-in completed");
  });

  it("builds Health voice context memory blocks from policy-filtered delivered proposals only", async () => {
    const store = new InMemoryHealthSemanticMemoryOutboxStore();
    const delivered = await recordPreventiveHealthMemoryProposal(proposalInput(store, {
      deliverApprovedWrites: true,
      provider: vi.fn(async () => ({ providerMemoryId: "mem0.memory.readable" })),
    }));
    expect(delivered.outcome).toBe("stored");

    const allowed = await buildHealthPolicyFilteredMemoryBlock({
      userId: TASK13_USER_ID,
      profileId: TASK13_PROFILE_ID,
      flowInstanceId: TASK13_FLOW_INSTANCE_ID,
      profileConsent: task13SemanticMemoryConsent,
      env: task13PilotEnv,
      store,
      now: TASK13_NOW,
    });
    expect(allowed).toMatchObject({
      allowedCategories: ["general_preference", "routine_health_context"],
      reasonCodes: ["health_memory_policy_read_allowed", "health_memory_policy_read_allowed"],
      flagReasonCode: "health_memory_policy_allowed_user",
    });
    expect(allowed.memoryBlock).toContain("Preventive health check-in completed");

    const denied = await buildHealthPolicyFilteredMemoryBlock({
      userId: TASK13_USER_ID,
      profileId: TASK13_PROFILE_ID,
      flowInstanceId: TASK13_FLOW_INSTANCE_ID,
      profileConsent: task13NoSemanticMemoryConsent,
      env: task13PilotEnv,
      store,
      now: TASK13_NOW,
    });
    expect(denied.memoryBlock).toBe("");
    expect(denied.allowedCategories).toEqual([]);
    expect(denied.reasonCodes).toEqual([
      "health_memory_policy_missing_read_consent",
      "health_memory_policy_missing_read_consent",
    ]);
  });
});
