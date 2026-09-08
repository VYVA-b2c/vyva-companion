import {
  addMem0MemoryConfirmed,
  deleteMem0MemoryConfirmed,
} from "../lib/mem0.js";
import {
  canonicalContractProjection,
  canonicalSha256,
  descriptorSafeDeepInertClone,
} from "../orchestrator/eventStateCanonicalJson.js";
import type { PreventiveHealthResult } from "../health/preventiveHealthOrchestrator.js";
import {
  PREVENTIVE_HEALTH_FLOW_ID,
  PREVENTIVE_HEALTH_FLOW_VERSION,
} from "../health/preventiveHealthFlow.js";
import {
  consentFromProfileDataSharing,
  evaluateHealthMemoryPolicy,
  resolveHealthMemoryPolicyFlag,
  type HealthMemoryCategory,
  type HealthMemoryConsent,
  type HealthMemoryEnvironmentMap,
  type HealthMemoryPolicyDecision,
} from "./healthMemoryPolicy.js";
import { z } from "zod";

export const HEALTH_SEMANTIC_MEMORY_SCHEMA_VERSION = "1.0.0" as const;
export const HEALTH_SEMANTIC_MEMORY_PROPOSAL_DIGEST_DOMAIN =
  "vyva.task13.health-semantic-memory.proposal.semantic.v1" as const;
export const HEALTH_SEMANTIC_MEMORY_PROPOSAL_ID_DOMAIN =
  "vyva.task13.health-semantic-memory.proposal-id.v1" as const;

export const healthSemanticMemoryStatusSchema = z.enum([
  "approval_required",
  "proposal_only",
  "delivery_pending",
  "delivery_in_progress",
  "delivered",
  "delivery_failed",
  "denied",
  "corrected",
  "delete_pending",
  "delete_in_progress",
  "deleted",
  "deletion_failed",
]);

export const healthSemanticMemoryOperationSchema = z.enum([
  "write",
  "correction",
  "deletion",
]);

export const healthSemanticMemoryLocalVisibilitySchema = z.enum([
  "active",
  "suppressed",
]);

const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const healthSemanticMemoryProvenanceSchema = z.object({
  source: z.literal("health.preventive_check"),
  sourceRecordId: z.string().min(1).max(200),
  sourceDigest: digestSchema,
  observedAt: z.string().datetime({ offset: true }),
  flowInstanceId: z.string().min(1).max(200),
  correctionOf: z.string().min(1).max(200).optional(),
  deletionOf: z.string().min(1).max(200).optional(),
}).strict();

export const healthSemanticMemoryProposalSchema = z.object({
  schemaVersion: z.literal(HEALTH_SEMANTIC_MEMORY_SCHEMA_VERSION),
  proposalId: z.string().min(1).max(200),
  idempotencyKey: z.string().min(1).max(512),
  userId: z.string().min(1).max(160),
  profileId: z.string().min(1).max(160).optional(),
  mem0UserId: z.string().min(1).max(160),
  flowId: z.literal(PREVENTIVE_HEALTH_FLOW_ID),
  flowVersion: z.literal(PREVENTIVE_HEALTH_FLOW_VERSION),
  flowInstanceId: z.string().min(1).max(200),
  completionReference: z.string().min(1).max(200),
  answerDigest: digestSchema,
  category: z.enum([
    "general_preference",
    "routine_health_context",
    "restricted_health",
    "mental_health",
    "safety_emergency",
    "care_instruction",
  ]),
  target: z.literal("mem0"),
  operation: healthSemanticMemoryOperationSchema,
  status: healthSemanticMemoryStatusSchema,
  content: z.string().min(1).max(2_000).nullable(),
  contentDigest: digestSchema.nullable(),
  policyDecision: z.enum(["allow", "deny", "proposal_only", "approval_required"]),
  policyReasonCode: z.string().min(1).max(160),
  policyDecisionDigest: digestSchema,
  consentRevision: z.number().int().min(0).max(1_000_000).nullable(),
  approvalReference: z.string().min(1).max(160).nullable(),
  provenance: healthSemanticMemoryProvenanceSchema,
  provider: z.literal("mem0"),
  providerMemoryId: z.string().min(1).max(200).nullable(),
  failureReason: z.string().min(1).max(200).nullable(),
  localVisibility: healthSemanticMemoryLocalVisibilitySchema,
  suppressedAt: z.string().datetime({ offset: true }).nullable(),
  supersededBy: z.string().min(1).max(200).nullable(),
  deletedBy: z.string().min(1).max(200).nullable(),
  semanticDigest: digestSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((proposal, ctx) => {
  if ((proposal.content === null) !== (proposal.contentDigest === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contentDigest"],
      message: "content and contentDigest must be present or absent together",
    });
  }
  if (proposal.status === "delivered" && !proposal.providerMemoryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["providerMemoryId"],
      message: "delivered proposal requires providerMemoryId",
    });
  }
  if (
    proposal.status === "delivered" &&
    (
      proposal.category === "restricted_health" ||
      proposal.category === "mental_health" ||
      proposal.category === "safety_emergency" ||
      proposal.category === "care_instruction"
    )
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["category"],
      message: "sensitive categories cannot be delivered automatically",
    });
  }
  const suppressionReferences = [
    proposal.supersededBy,
    proposal.deletedBy,
  ].filter((value) => value !== null).length;
  if (proposal.localVisibility === "active") {
    if (proposal.suppressedAt !== null || proposal.supersededBy !== null || proposal.deletedBy !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["localVisibility"],
        message: "active proposal cannot carry suppression metadata",
      });
    }
    if (proposal.status === "corrected" || proposal.status === "deleted") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "corrected or deleted proposal must be locally suppressed",
      });
    }
  } else {
    if (proposal.suppressedAt === null || suppressionReferences !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suppressedAt"],
        message: "suppressed proposal requires exactly one suppression reference",
      });
    }
    if (proposal.status !== "corrected" && proposal.status !== "deleted") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "suppressed proposal must be corrected or deleted",
      });
    }
  }
});

export type HealthSemanticMemoryStatus = z.infer<typeof healthSemanticMemoryStatusSchema>;
export type HealthSemanticMemoryOperation = z.infer<typeof healthSemanticMemoryOperationSchema>;
export type HealthSemanticMemoryProposal = z.infer<typeof healthSemanticMemoryProposalSchema>;

export type HealthSemanticMemoryWriteResult =
  | { outcome: "stored"; proposal: HealthSemanticMemoryProposal }
  | { outcome: "duplicate"; proposal: HealthSemanticMemoryProposal }
  | { outcome: "rejected"; reason: "invalid_input" | "semantic_conflict" | "persistence_unavailable" };

export type HealthSemanticMemoryUpdateResult =
  | { outcome: "updated"; proposal: HealthSemanticMemoryProposal }
  | { outcome: "not_found" | "invalid_transition" | "unavailable" };

export interface HealthSemanticMemoryOutboxStore {
  recordProposal(proposal: unknown, options?: { signal?: AbortSignal }): Promise<HealthSemanticMemoryWriteResult>;
  findProposalById(proposalId: string): Promise<HealthSemanticMemoryProposal | undefined>;
  findReadableMemories(input: {
    userId: string;
    categories: readonly HealthMemoryCategory[];
    limit: number;
  }): Promise<HealthSemanticMemoryProposal[]>;
  markProviderDelivered(input: {
    proposalId: string;
    providerMemoryId: string;
    now: Date;
  }): Promise<HealthSemanticMemoryUpdateResult>;
  claimProviderDelivery(input: {
    proposalId: string;
    now: Date;
  }): Promise<HealthSemanticMemoryUpdateResult>;
  markProviderFailed(input: {
    proposalId: string;
    reason: string;
    now: Date;
  }): Promise<HealthSemanticMemoryUpdateResult>;
  requestCorrection(input: {
    originalProposalId: string;
    correctedProposal: unknown;
  }): Promise<HealthSemanticMemoryWriteResult>;
  requestDeletion(input: {
    originalProposalId: string;
    deletionProposal: unknown;
  }): Promise<HealthSemanticMemoryWriteResult>;
}

type ProposalRecord = {
  proposal: HealthSemanticMemoryProposal;
  semanticDigest: string;
};

interface HealthSemanticMemoryTransaction {
  findByIdempotencyKey(idempotencyKey: string): Promise<ProposalRecord | undefined>;
  findByProposalId(proposalId: string): Promise<ProposalRecord | undefined>;
  insertProposal(record: ProposalRecord): Promise<"inserted" | "duplicate">;
  updateStatus(input: {
    proposalId: string;
    fromStatuses: readonly HealthSemanticMemoryStatus[];
    status: HealthSemanticMemoryStatus;
    providerMemoryId?: string | null;
    failureReason?: string | null;
    updatedAt: string;
  }): Promise<ProposalRecord | undefined>;
  suppressProposal(input: {
    proposalId: string;
    status: "corrected" | "deleted";
    supersededBy?: string;
    deletedBy?: string;
    expectedOriginal: HealthSemanticMemoryProposal;
    updatedAt: string;
  }): Promise<ProposalRecord | undefined>;
}

interface HealthSemanticMemoryRepository {
  withTransaction<T>(operation: (tx: HealthSemanticMemoryTransaction) => Promise<T>): Promise<T>;
  findReadable(input: {
    userId: string;
    categories: readonly HealthMemoryCategory[];
    limit: number;
  }): Promise<HealthSemanticMemoryProposal[]>;
}

type PgClient = {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
};

function toIso(value: Date): string {
  return new Date(value.getTime()).toISOString();
}

function contentDigest(content: string | null): string | null {
  return content === null
    ? null
    : canonicalSha256(
        `${HEALTH_SEMANTIC_MEMORY_PROPOSAL_DIGEST_DOMAIN}.content`,
        canonicalContractProjection({ content }),
      );
}

export function healthSemanticMemoryProposalDigest(
  proposal: Omit<HealthSemanticMemoryProposal, "semanticDigest">,
): string {
  return canonicalSha256(
    HEALTH_SEMANTIC_MEMORY_PROPOSAL_DIGEST_DOMAIN,
    canonicalContractProjection(proposal),
  );
}

function proposalIdFor(input: {
  idempotencyKey: string;
  contentDigest: string | null;
  operation: HealthSemanticMemoryOperation;
}): string {
  const digest = canonicalSha256(
    HEALTH_SEMANTIC_MEMORY_PROPOSAL_ID_DOMAIN,
    canonicalContractProjection(input),
  );
  return `health.memory.${digest.slice("sha256:".length, "sha256:".length + 32)}`;
}

function proposalForDecision(input: {
  userId: string;
  profileId?: string;
  mem0UserId: string;
  flowInstanceId: string;
  completionReference: string;
  answerDigest: string;
  category: HealthMemoryCategory;
  content: string | null;
  operation: HealthSemanticMemoryOperation;
  policyDecision: HealthMemoryPolicyDecision;
  now: Date;
  correctionOf?: string;
  deletionOf?: string;
}): HealthSemanticMemoryProposal {
  const createdAt = toIso(input.now);
  const idempotencyKey = [
    "task13",
    input.operation,
    input.userId,
    input.flowInstanceId,
    input.completionReference,
    input.category,
    input.correctionOf ?? "",
    input.deletionOf ?? "",
  ].join(":");
  const digest = contentDigest(input.content);
  const status: HealthSemanticMemoryStatus =
    input.policyDecision.decision === "deny"
      ? "denied"
      : input.operation === "deletion"
      ? "delete_pending"
      : input.policyDecision.decision === "allow"
      ? "delivery_pending"
      : input.policyDecision.decision === "approval_required"
      ? "approval_required"
      : input.policyDecision.decision === "proposal_only"
      ? "proposal_only"
      : "denied";
  const withoutDigest = {
    schemaVersion: HEALTH_SEMANTIC_MEMORY_SCHEMA_VERSION,
    proposalId: proposalIdFor({
      idempotencyKey,
      contentDigest: digest,
      operation: input.operation,
    }),
    idempotencyKey,
    userId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    mem0UserId: input.mem0UserId,
    flowId: PREVENTIVE_HEALTH_FLOW_ID,
    flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
    flowInstanceId: input.flowInstanceId,
    completionReference: input.completionReference,
    answerDigest: input.answerDigest,
    category: input.category,
    target: "mem0" as const,
    operation: input.operation,
    status,
    content: status === "denied" ? null : input.content,
    contentDigest: status === "denied" ? null : digest,
    policyDecision: input.policyDecision.decision,
    policyReasonCode: input.policyDecision.reasonCode,
    policyDecisionDigest: input.policyDecision.decisionDigest,
    consentRevision: input.policyDecision.consentRevision,
    approvalReference: input.policyDecision.approvalReference,
    provenance: {
      source: "health.preventive_check" as const,
      sourceRecordId: input.completionReference,
      sourceDigest: input.answerDigest,
      observedAt: createdAt,
      flowInstanceId: input.flowInstanceId,
      ...(input.correctionOf !== undefined ? { correctionOf: input.correctionOf } : {}),
      ...(input.deletionOf !== undefined ? { deletionOf: input.deletionOf } : {}),
    },
    provider: "mem0" as const,
    providerMemoryId: null,
    failureReason: null,
    localVisibility: "active" as const,
    suppressedAt: null,
    supersededBy: null,
    deletedBy: null,
    createdAt,
    updatedAt: createdAt,
  };
  const semanticDigest = healthSemanticMemoryProposalDigest(withoutDigest);
  return healthSemanticMemoryProposalSchema.parse({ ...withoutDigest, semanticDigest });
}

function parseProposal(raw: unknown): HealthSemanticMemoryProposal | null {
  try {
    return healthSemanticMemoryProposalSchema.parse(descriptorSafeDeepInertClone(raw));
  } catch {
    return null;
  }
}

function parseStoredProposal(raw: unknown): HealthSemanticMemoryProposal {
  return healthSemanticMemoryProposalSchema.parse(raw);
}

function nullableIdentity(value: string | undefined): string | null {
  return value ?? null;
}

function proposalMatchesOriginalLifecycle(input: {
  original: HealthSemanticMemoryProposal;
  proposal: HealthSemanticMemoryProposal;
  originalProposalId: string;
  operation: "correction" | "deletion";
}): boolean {
  const { original, proposal, operation, originalProposalId } = input;
  if (proposal.operation !== operation) return false;
  if (proposal.userId !== original.userId) return false;
  if (nullableIdentity(proposal.profileId) !== nullableIdentity(original.profileId)) return false;
  if (proposal.mem0UserId !== original.mem0UserId) return false;
  if (proposal.flowId !== original.flowId) return false;
  if (proposal.flowVersion !== original.flowVersion) return false;
  if (proposal.flowInstanceId !== original.flowInstanceId) return false;
  if (proposal.completionReference !== original.completionReference) return false;
  if (proposal.answerDigest !== original.answerDigest) return false;
  if (proposal.category !== original.category) return false;
  if (proposal.target !== original.target) return false;
  if (proposal.provenance.source !== original.provenance.source) return false;
  if (proposal.provenance.sourceRecordId !== original.provenance.sourceRecordId) return false;
  if (proposal.provenance.sourceDigest !== original.provenance.sourceDigest) return false;
  if (proposal.provenance.flowInstanceId !== original.provenance.flowInstanceId) return false;
  if (operation === "correction") {
    return proposal.provenance.correctionOf === originalProposalId &&
      proposal.provenance.deletionOf === undefined;
  }
  return proposal.provenance.deletionOf === originalProposalId &&
    proposal.provenance.correctionOf === undefined;
}

function stripSemanticDigest(
  proposal: HealthSemanticMemoryProposal,
): Omit<HealthSemanticMemoryProposal, "semanticDigest"> {
  const withoutDigest = { ...proposal };
  delete (withoutDigest as Partial<HealthSemanticMemoryProposal>).semanticDigest;
  return withoutDigest;
}

function proposalWithUpdatedStatus(input: {
  proposal: HealthSemanticMemoryProposal;
  status: HealthSemanticMemoryStatus;
  providerMemoryId?: string | null;
  failureReason?: string | null;
  localVisibility?: "active" | "suppressed";
  suppressedAt?: string | null;
  supersededBy?: string | null;
  deletedBy?: string | null;
  updatedAt: string;
}): HealthSemanticMemoryProposal {
  const withoutDigest = {
    ...stripSemanticDigest(input.proposal),
    status: input.status,
    providerMemoryId: input.providerMemoryId !== undefined ? input.providerMemoryId : input.proposal.providerMemoryId,
    failureReason: input.failureReason !== undefined ? input.failureReason : null,
    localVisibility: input.localVisibility ?? input.proposal.localVisibility,
    suppressedAt: input.suppressedAt !== undefined ? input.suppressedAt : input.proposal.suppressedAt,
    supersededBy: input.supersededBy !== undefined ? input.supersededBy : input.proposal.supersededBy,
    deletedBy: input.deletedBy !== undefined ? input.deletedBy : input.proposal.deletedBy,
    updatedAt: input.updatedAt,
  };
  return healthSemanticMemoryProposalSchema.parse({
    ...withoutDigest,
    semanticDigest: healthSemanticMemoryProposalDigest(withoutDigest),
  });
}

class LazyPostgresHealthSemanticMemoryRepository implements HealthSemanticMemoryRepository {
  async withTransaction<T>(operation: (tx: HealthSemanticMemoryTransaction) => Promise<T>): Promise<T> {
    const { pool } = await import("../db.js");
    const client = await pool.connect();
    try {
      await client.query("begin");
      const tx = new PostgresHealthSemanticMemoryTransaction(client);
      const result = await operation(tx);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async findReadable(input: {
    userId: string;
    categories: readonly HealthMemoryCategory[];
    limit: number;
  }): Promise<HealthSemanticMemoryProposal[]> {
    if (input.categories.length === 0) return [];
    const { pool } = await import("../db.js");
    const result = await pool.query<{ normalized_proposal: HealthSemanticMemoryProposal }>(
      `select normalized_proposal
         from health_semantic_memory_outbox
        where user_id = $1
          and category = any($2::text[])
          and operation in ('write', 'correction')
          and status = 'delivered'
          and local_visibility = 'active'
        order by updated_at desc
        limit $3`,
      [input.userId, input.categories, input.limit],
    );
    return result.rows.map((row) => parseStoredProposal(row.normalized_proposal));
  }
}

class PostgresHealthSemanticMemoryTransaction implements HealthSemanticMemoryTransaction {
  constructor(private readonly client: PgClient) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<ProposalRecord | undefined> {
    const result = await this.client.query<{
      normalized_proposal: HealthSemanticMemoryProposal;
      semantic_digest: string;
    }>(
      `select normalized_proposal, semantic_digest
         from health_semantic_memory_outbox
        where idempotency_key = $1`,
      [idempotencyKey],
    );
    const row = result.rows[0];
    return row
      ? {
          proposal: parseStoredProposal(row.normalized_proposal),
          semanticDigest: row.semantic_digest,
        }
      : undefined;
  }

  async findByProposalId(proposalId: string): Promise<ProposalRecord | undefined> {
    const result = await this.client.query<{
      normalized_proposal: HealthSemanticMemoryProposal;
      semantic_digest: string;
    }>(
      `select normalized_proposal, semantic_digest
         from health_semantic_memory_outbox
        where proposal_id = $1`,
      [proposalId],
    );
    const row = result.rows[0];
    return row
      ? {
          proposal: parseStoredProposal(row.normalized_proposal),
          semanticDigest: row.semantic_digest,
        }
      : undefined;
  }

  async insertProposal(record: ProposalRecord): Promise<"inserted" | "duplicate"> {
    const proposal = record.proposal;
    const result = await this.client.query(
      `insert into health_semantic_memory_outbox (
          proposal_id, schema_version, idempotency_key, user_id, profile_id,
          mem0_user_id, flow_id, flow_version, flow_instance_id,
          completion_reference, answer_digest, category, target, operation,
          status, content, content_digest, policy_decision, policy_reason_code,
          policy_decision_digest, consent_revision, approval_reference,
          provenance, provider, provider_memory_id, failure_reason,
          local_visibility, suppressed_at, superseded_by, deleted_by,
          normalized_proposal, semantic_digest, created_at, updated_at
        ) values (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22,
          $23::jsonb, $24, $25, $26,
          $27, $28, $29, $30,
          $31::jsonb, $32, $33, $34
        ) on conflict do nothing`,
      [
        proposal.proposalId,
        proposal.schemaVersion,
        proposal.idempotencyKey,
        proposal.userId,
        proposal.profileId ?? null,
        proposal.mem0UserId,
        proposal.flowId,
        proposal.flowVersion,
        proposal.flowInstanceId,
        proposal.completionReference,
        proposal.answerDigest,
        proposal.category,
        proposal.target,
        proposal.operation,
        proposal.status,
        proposal.content,
        proposal.contentDigest,
        proposal.policyDecision,
        proposal.policyReasonCode,
        proposal.policyDecisionDigest,
        proposal.consentRevision,
        proposal.approvalReference,
        JSON.stringify(proposal.provenance),
        proposal.provider,
        proposal.providerMemoryId,
        proposal.failureReason,
        proposal.localVisibility,
        proposal.suppressedAt ? new Date(proposal.suppressedAt) : null,
        proposal.supersededBy,
        proposal.deletedBy,
        JSON.stringify(proposal),
        proposal.semanticDigest,
        new Date(proposal.createdAt),
        new Date(proposal.updatedAt),
      ],
    );
    return result.rowCount === 1 ? "inserted" : "duplicate";
  }

  async updateStatus(input: {
    proposalId: string;
    fromStatuses: readonly HealthSemanticMemoryStatus[];
    status: HealthSemanticMemoryStatus;
    providerMemoryId?: string | null;
    failureReason?: string | null;
    updatedAt: string;
  }): Promise<ProposalRecord | undefined> {
    const existing = await this.findByProposalId(input.proposalId);
    if (!existing || !input.fromStatuses.includes(existing.proposal.status)) return undefined;
    const nextProposal = proposalWithUpdatedStatus({
      proposal: existing.proposal,
      status: input.status,
      providerMemoryId: input.providerMemoryId,
      failureReason: input.failureReason,
      updatedAt: input.updatedAt,
    });
    const result = await this.client.query<{
      normalized_proposal: HealthSemanticMemoryProposal;
      semantic_digest: string;
    }>(
      `update health_semantic_memory_outbox
          set status = $2,
              provider_memory_id = $3,
              failure_reason = $4,
              local_visibility = $5,
              suppressed_at = $6,
              superseded_by = $7,
              deleted_by = $8,
              normalized_proposal = $9::jsonb,
              semantic_digest = $10,
              updated_at = $11
        where proposal_id = $1
          and status = any($12::text[])
        returning normalized_proposal, semantic_digest`,
      [
        input.proposalId,
        input.status,
        nextProposal.providerMemoryId,
        nextProposal.failureReason,
        nextProposal.localVisibility,
        nextProposal.suppressedAt ? new Date(nextProposal.suppressedAt) : null,
        nextProposal.supersededBy,
        nextProposal.deletedBy,
        JSON.stringify(nextProposal),
        nextProposal.semanticDigest,
        new Date(input.updatedAt),
        input.fromStatuses,
      ],
    );
    const row = result.rows[0];
    return row
      ? {
          proposal: parseStoredProposal(row.normalized_proposal),
          semanticDigest: row.semantic_digest,
        }
        : undefined;
  }

  async suppressProposal(input: {
    proposalId: string;
    status: "corrected" | "deleted";
    supersededBy?: string;
    deletedBy?: string;
    expectedOriginal: HealthSemanticMemoryProposal;
    updatedAt: string;
  }): Promise<ProposalRecord | undefined> {
    const existing = await this.findByProposalId(input.proposalId);
    if (!existing) return undefined;
    if (
      existing.proposal.localVisibility === "suppressed" &&
      existing.proposal.status === input.status &&
      existing.proposal.supersededBy === (input.supersededBy ?? null) &&
      existing.proposal.deletedBy === (input.deletedBy ?? null)
    ) {
      return existing;
    }
    if (existing.proposal.localVisibility !== "active") return undefined;
    const nextProposal = proposalWithUpdatedStatus({
      proposal: existing.proposal,
      status: input.status,
      localVisibility: "suppressed",
      suppressedAt: input.updatedAt,
      supersededBy: input.supersededBy ?? null,
      deletedBy: input.deletedBy ?? null,
      updatedAt: input.updatedAt,
    });
    const result = await this.client.query<{
      normalized_proposal: HealthSemanticMemoryProposal;
      semantic_digest: string;
    }>(
      `update health_semantic_memory_outbox
          set status = $2,
              local_visibility = $3,
              suppressed_at = $4,
              superseded_by = $5,
              deleted_by = $6,
              normalized_proposal = $7::jsonb,
              semantic_digest = $8,
              updated_at = $9
        where proposal_id = $1
          and local_visibility = 'active'
          and user_id = $10
          and profile_id is not distinct from $11
          and mem0_user_id = $12
          and flow_id = $13
          and flow_version = $14
          and flow_instance_id = $15
          and completion_reference = $16
          and answer_digest = $17
          and category = $18
        returning normalized_proposal, semantic_digest`,
      [
        input.proposalId,
        nextProposal.status,
        nextProposal.localVisibility,
        new Date(nextProposal.suppressedAt ?? input.updatedAt),
        nextProposal.supersededBy,
        nextProposal.deletedBy,
        JSON.stringify(nextProposal),
        nextProposal.semanticDigest,
        new Date(input.updatedAt),
        input.expectedOriginal.userId,
        input.expectedOriginal.profileId ?? null,
        input.expectedOriginal.mem0UserId,
        input.expectedOriginal.flowId,
        input.expectedOriginal.flowVersion,
        input.expectedOriginal.flowInstanceId,
        input.expectedOriginal.completionReference,
        input.expectedOriginal.answerDigest,
        input.expectedOriginal.category,
      ],
    );
    const row = result.rows[0];
    return row
      ? {
          proposal: parseStoredProposal(row.normalized_proposal),
          semanticDigest: row.semantic_digest,
        }
      : undefined;
  }
}

export class InMemoryHealthSemanticMemoryOutboxStore implements HealthSemanticMemoryOutboxStore {
  private readonly byIdempotencyKey = new Map<string, ProposalRecord>();
  private readonly byProposalId = new Map<string, ProposalRecord>();

  async recordProposal(rawProposal: unknown): Promise<HealthSemanticMemoryWriteResult> {
    const proposal = parseProposal(rawProposal);
    if (!proposal) return { outcome: "rejected", reason: "invalid_input" };
    const semanticDigest = proposal.semanticDigest;
    const existing = this.byIdempotencyKey.get(proposal.idempotencyKey);
    if (existing) {
      return existing.semanticDigest === semanticDigest
        ? { outcome: "duplicate", proposal: existing.proposal }
        : { outcome: "rejected", reason: "semantic_conflict" };
    }
    const proposalIdCollision = this.byProposalId.get(proposal.proposalId);
    if (proposalIdCollision) {
      return { outcome: "rejected", reason: "semantic_conflict" };
    }
    const record = { proposal, semanticDigest };
    this.byIdempotencyKey.set(proposal.idempotencyKey, record);
    this.byProposalId.set(proposal.proposalId, record);
    return { outcome: "stored", proposal };
  }

  async findReadableMemories(input: {
    userId: string;
    categories: readonly HealthMemoryCategory[];
    limit: number;
  }): Promise<HealthSemanticMemoryProposal[]> {
    const categories = new Set(input.categories);
    return Array.from(this.byProposalId.values())
      .map((record) => record.proposal)
      .filter((proposal) =>
        proposal.userId === input.userId &&
        categories.has(proposal.category) &&
        (proposal.operation === "write" || proposal.operation === "correction") &&
        proposal.status === "delivered" &&
        proposal.localVisibility === "active" &&
        proposal.content)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, input.limit);
  }

  async findProposalById(proposalId: string): Promise<HealthSemanticMemoryProposal | undefined> {
    return this.byProposalId.get(proposalId)?.proposal;
  }

  async markProviderDelivered(input: {
    proposalId: string;
    providerMemoryId: string;
    now: Date;
  }): Promise<HealthSemanticMemoryUpdateResult> {
    return this.updateStatus({
      proposalId: input.proposalId,
      fromStatuses: ["delivery_in_progress", "delete_in_progress"],
      status: "delivered",
      providerMemoryId: input.providerMemoryId,
      failureReason: null,
      updatedAt: toIso(input.now),
    });
  }

  async claimProviderDelivery(input: {
    proposalId: string;
    now: Date;
  }): Promise<HealthSemanticMemoryUpdateResult> {
    const existing = this.byProposalId.get(input.proposalId);
    if (!existing) return { outcome: "not_found" };
    const nextStatus: HealthSemanticMemoryStatus | null =
      existing.proposal.status === "delivery_pending" || existing.proposal.status === "delivery_failed"
        ? "delivery_in_progress"
        : existing.proposal.status === "delete_pending" || existing.proposal.status === "deletion_failed"
        ? "delete_in_progress"
        : null;
    if (!nextStatus) return { outcome: "invalid_transition" };
    return this.updateStatus({
      proposalId: input.proposalId,
      fromStatuses: [existing.proposal.status],
      status: nextStatus,
      providerMemoryId: existing.proposal.providerMemoryId,
      failureReason: null,
      updatedAt: toIso(input.now),
    });
  }

  async markProviderFailed(input: {
    proposalId: string;
    reason: string;
    now: Date;
  }): Promise<HealthSemanticMemoryUpdateResult> {
    const existing = this.byProposalId.get(input.proposalId);
    const targetStatus: HealthSemanticMemoryStatus =
      existing?.proposal.operation === "deletion" ? "deletion_failed" : "delivery_failed";
    return this.updateStatus({
      proposalId: input.proposalId,
      fromStatuses: ["delivery_pending", "delivery_in_progress", "delete_pending", "delete_in_progress"],
      status: targetStatus,
      failureReason: input.reason.slice(0, 200),
      providerMemoryId: null,
      updatedAt: toIso(input.now),
    });
  }

  async requestCorrection(input: {
    originalProposalId: string;
    correctedProposal: unknown;
  }): Promise<HealthSemanticMemoryWriteResult> {
    const proposal = parseProposal(input.correctedProposal);
    if (!proposal) return { outcome: "rejected", reason: "invalid_input" };
    const existingBeforeRecord = this.byProposalId.get(input.originalProposalId);
    if (!existingBeforeRecord) return { outcome: "rejected", reason: "invalid_input" };
    if (!proposalMatchesOriginalLifecycle({
      original: existingBeforeRecord.proposal,
      proposal,
      originalProposalId: input.originalProposalId,
      operation: "correction",
    })) {
      return { outcome: "rejected", reason: "invalid_input" };
    }
    if (
      existingBeforeRecord.proposal.localVisibility !== "active" &&
      existingBeforeRecord.proposal.supersededBy !== proposal.proposalId
    ) {
      return { outcome: "rejected", reason: "invalid_input" };
    }
    const result = await this.recordProposal(proposal);
    if (result.outcome === "stored" || result.outcome === "duplicate") {
      const existing = this.byProposalId.get(input.originalProposalId);
      if (!existing) return { outcome: "rejected", reason: "invalid_input" };
      if (
        existing.proposal.localVisibility !== "active" &&
        existing.proposal.supersededBy !== result.proposal.proposalId
      ) {
        return { outcome: "rejected", reason: "invalid_input" };
      }
      if (
        existing?.proposal.localVisibility === "active" ||
        existing?.proposal.supersededBy === result.proposal.proposalId
      ) {
        const suppressed = await this.suppressProposal({
          proposalId: input.originalProposalId,
          status: "corrected",
          supersededBy: result.proposal.proposalId,
          expectedOriginal: existingBeforeRecord.proposal,
          updatedAt: result.proposal.createdAt,
        });
        if (suppressed.outcome === "invalid_transition") {
          return { outcome: "rejected", reason: "invalid_input" };
        }
      }
    }
    return result;
  }

  async requestDeletion(input: {
    originalProposalId: string;
    deletionProposal: unknown;
  }): Promise<HealthSemanticMemoryWriteResult> {
    const proposal = parseProposal(input.deletionProposal);
    if (!proposal) return { outcome: "rejected", reason: "invalid_input" };
    const existingBeforeRecord = this.byProposalId.get(input.originalProposalId);
    if (!existingBeforeRecord) return { outcome: "rejected", reason: "invalid_input" };
    if (!proposalMatchesOriginalLifecycle({
      original: existingBeforeRecord.proposal,
      proposal,
      originalProposalId: input.originalProposalId,
      operation: "deletion",
    })) {
      return { outcome: "rejected", reason: "invalid_input" };
    }
    if (
      existingBeforeRecord.proposal.localVisibility !== "active" &&
      existingBeforeRecord.proposal.deletedBy !== proposal.proposalId
    ) {
      return { outcome: "rejected", reason: "invalid_input" };
    }
    const result = await this.recordProposal(proposal);
    if (result.outcome === "stored" || result.outcome === "duplicate") {
      const existing = this.byProposalId.get(input.originalProposalId);
      if (!existing) return { outcome: "rejected", reason: "invalid_input" };
      if (
        existing.proposal.localVisibility !== "active" &&
        existing.proposal.deletedBy !== result.proposal.proposalId
      ) {
        return { outcome: "rejected", reason: "invalid_input" };
      }
      if (
        existing?.proposal.localVisibility === "active" ||
        existing?.proposal.deletedBy === result.proposal.proposalId
      ) {
        const suppressed = await this.suppressProposal({
          proposalId: input.originalProposalId,
          status: "deleted",
          deletedBy: result.proposal.proposalId,
          expectedOriginal: existingBeforeRecord.proposal,
          updatedAt: result.proposal.createdAt,
        });
        if (suppressed.outcome === "invalid_transition") {
          return { outcome: "rejected", reason: "invalid_input" };
        }
      }
    }
    return result;
  }

  snapshot(): HealthSemanticMemoryProposal[] {
    return Array.from(this.byProposalId.values()).map((record) => record.proposal);
  }

  private async updateStatus(input: {
    proposalId: string;
    fromStatuses: readonly HealthSemanticMemoryStatus[];
    status: HealthSemanticMemoryStatus;
    providerMemoryId?: string | null;
    failureReason?: string | null;
    updatedAt: string;
  }): Promise<HealthSemanticMemoryUpdateResult> {
    const existing = this.byProposalId.get(input.proposalId);
    if (!existing) return { outcome: "not_found" };
    if (!input.fromStatuses.includes(existing.proposal.status)) {
      return { outcome: "invalid_transition" };
    }
    const proposal = proposalWithUpdatedStatus({
      proposal: existing.proposal,
      status: input.status,
      providerMemoryId: input.providerMemoryId,
      failureReason: input.failureReason,
      updatedAt: input.updatedAt,
    });
    const record = { proposal, semanticDigest: proposal.semanticDigest };
    this.byIdempotencyKey.set(proposal.idempotencyKey, record);
    this.byProposalId.set(proposal.proposalId, record);
    return { outcome: "updated", proposal };
  }

  private async suppressProposal(input: {
    proposalId: string;
    status: "corrected" | "deleted";
    supersededBy?: string;
    deletedBy?: string;
    expectedOriginal: HealthSemanticMemoryProposal;
    updatedAt: string;
  }): Promise<HealthSemanticMemoryUpdateResult> {
    const existing = this.byProposalId.get(input.proposalId);
    if (!existing) return { outcome: "not_found" };
    if (
      existing.proposal.localVisibility === "suppressed" &&
      existing.proposal.status === input.status &&
      existing.proposal.supersededBy === (input.supersededBy ?? null) &&
      existing.proposal.deletedBy === (input.deletedBy ?? null)
    ) {
      return { outcome: "updated", proposal: existing.proposal };
    }
    if (existing.proposal.localVisibility !== "active") return { outcome: "invalid_transition" };
    const proposal = proposalWithUpdatedStatus({
      proposal: existing.proposal,
      status: input.status,
      localVisibility: "suppressed",
      suppressedAt: input.updatedAt,
      supersededBy: input.supersededBy ?? null,
      deletedBy: input.deletedBy ?? null,
      updatedAt: input.updatedAt,
    });
    const record = { proposal, semanticDigest: proposal.semanticDigest };
    this.byIdempotencyKey.set(proposal.idempotencyKey, record);
    this.byProposalId.set(proposal.proposalId, record);
    return { outcome: "updated", proposal };
  }
}

export class PostgresHealthSemanticMemoryOutboxStore implements HealthSemanticMemoryOutboxStore {
  constructor(private readonly repository: HealthSemanticMemoryRepository = new LazyPostgresHealthSemanticMemoryRepository()) {}

  private async recordParsedProposal(
    tx: HealthSemanticMemoryTransaction,
    proposal: HealthSemanticMemoryProposal,
  ): Promise<HealthSemanticMemoryWriteResult> {
    const existing = await tx.findByIdempotencyKey(proposal.idempotencyKey);
    if (existing) {
      return existing.semanticDigest === proposal.semanticDigest
        ? { outcome: "duplicate", proposal: existing.proposal }
        : { outcome: "rejected", reason: "semantic_conflict" };
    }
    const inserted = await tx.insertProposal({ proposal, semanticDigest: proposal.semanticDigest });
    if (inserted === "inserted") return { outcome: "stored", proposal };
    const raced = await tx.findByIdempotencyKey(proposal.idempotencyKey);
    if (raced?.semanticDigest === proposal.semanticDigest) {
      return { outcome: "duplicate", proposal: raced.proposal };
    }
    return { outcome: "rejected", reason: "semantic_conflict" };
  }

  async recordProposal(rawProposal: unknown, options: { signal?: AbortSignal } = {}): Promise<HealthSemanticMemoryWriteResult> {
    if (options.signal?.aborted) return { outcome: "rejected", reason: "persistence_unavailable" };
    const proposal = parseProposal(rawProposal);
    if (!proposal) return { outcome: "rejected", reason: "invalid_input" };
    try {
      return await this.repository.withTransaction(async (tx) => {
        if (options.signal?.aborted) return { outcome: "rejected", reason: "persistence_unavailable" } as const;
        return this.recordParsedProposal(tx, proposal);
      });
    } catch {
      return { outcome: "rejected", reason: "persistence_unavailable" };
    }
  }

  async findReadableMemories(input: {
    userId: string;
    categories: readonly HealthMemoryCategory[];
    limit: number;
  }): Promise<HealthSemanticMemoryProposal[]> {
    try {
      return await this.repository.findReadable(input);
    } catch {
      return [];
    }
  }

  async findProposalById(proposalId: string): Promise<HealthSemanticMemoryProposal | undefined> {
    try {
      return await this.repository.withTransaction(async (tx) =>
        (await tx.findByProposalId(proposalId))?.proposal);
    } catch {
      return undefined;
    }
  }

  async markProviderDelivered(input: {
    proposalId: string;
    providerMemoryId: string;
    now: Date;
  }): Promise<HealthSemanticMemoryUpdateResult> {
    try {
      return await this.repository.withTransaction(async (tx) => {
        const existing = await tx.findByProposalId(input.proposalId);
        if (!existing) return { outcome: "not_found" as const };
        const updated = await tx.updateStatus({
          proposalId: input.proposalId,
          fromStatuses: ["delivery_in_progress", "delete_in_progress"],
          status: "delivered",
          providerMemoryId: input.providerMemoryId,
          failureReason: null,
          updatedAt: toIso(input.now),
        });
        return updated ? { outcome: "updated" as const, proposal: updated.proposal } : { outcome: "invalid_transition" as const };
      });
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async claimProviderDelivery(input: {
    proposalId: string;
    now: Date;
  }): Promise<HealthSemanticMemoryUpdateResult> {
    try {
      return await this.repository.withTransaction(async (tx) => {
        const existing = await tx.findByProposalId(input.proposalId);
        if (!existing) return { outcome: "not_found" as const };
        const nextStatus: HealthSemanticMemoryStatus | null =
          existing.proposal.status === "delivery_pending" || existing.proposal.status === "delivery_failed"
            ? "delivery_in_progress"
            : existing.proposal.status === "delete_pending" || existing.proposal.status === "deletion_failed"
            ? "delete_in_progress"
            : null;
        if (!nextStatus) return { outcome: "invalid_transition" as const };
        const updated = await tx.updateStatus({
          proposalId: input.proposalId,
          fromStatuses: [existing.proposal.status],
          status: nextStatus,
          providerMemoryId: existing.proposal.providerMemoryId,
          failureReason: null,
          updatedAt: toIso(input.now),
        });
        return updated ? { outcome: "updated" as const, proposal: updated.proposal } : { outcome: "invalid_transition" as const };
      });
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async markProviderFailed(input: {
    proposalId: string;
    reason: string;
    now: Date;
  }): Promise<HealthSemanticMemoryUpdateResult> {
    try {
      return await this.repository.withTransaction(async (tx) => {
        const existing = await tx.findByProposalId(input.proposalId);
        if (!existing) return { outcome: "not_found" as const };
        const status: HealthSemanticMemoryStatus = existing.proposal.operation === "deletion"
          ? "deletion_failed"
          : "delivery_failed";
        const updated = await tx.updateStatus({
          proposalId: input.proposalId,
          fromStatuses: ["delivery_pending", "delivery_in_progress", "delete_pending", "delete_in_progress"],
          status,
          providerMemoryId: null,
          failureReason: input.reason.slice(0, 200),
          updatedAt: toIso(input.now),
        });
        return updated ? { outcome: "updated" as const, proposal: updated.proposal } : { outcome: "invalid_transition" as const };
      });
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async requestCorrection(input: {
    originalProposalId: string;
    correctedProposal: unknown;
  }): Promise<HealthSemanticMemoryWriteResult> {
    const proposal = parseProposal(input.correctedProposal);
    if (!proposal) return { outcome: "rejected", reason: "invalid_input" };
    try {
      return await this.repository.withTransaction(async (tx) => {
        const existing = await tx.findByProposalId(input.originalProposalId);
        if (!existing) return { outcome: "rejected" as const, reason: "invalid_input" as const };
        if (!proposalMatchesOriginalLifecycle({
          original: existing.proposal,
          proposal,
          originalProposalId: input.originalProposalId,
          operation: "correction",
        })) {
          return { outcome: "rejected" as const, reason: "invalid_input" as const };
        }
        if (
          existing.proposal.localVisibility !== "active" &&
          existing.proposal.supersededBy !== proposal.proposalId
        ) {
          return { outcome: "rejected" as const, reason: "invalid_input" as const };
        }
        const result = await this.recordParsedProposal(tx, proposal);
        if (result.outcome === "stored" || result.outcome === "duplicate") {
          const suppressed = await tx.suppressProposal({
            proposalId: input.originalProposalId,
            status: "corrected",
            supersededBy: result.proposal.proposalId,
            expectedOriginal: existing.proposal,
            updatedAt: result.proposal.createdAt,
          });
          if (!suppressed) return { outcome: "rejected" as const, reason: "invalid_input" as const };
        }
        return result;
      });
    } catch {
      return { outcome: "rejected", reason: "persistence_unavailable" };
    }
  }

  async requestDeletion(input: {
    originalProposalId: string;
    deletionProposal: unknown;
  }): Promise<HealthSemanticMemoryWriteResult> {
    const proposal = parseProposal(input.deletionProposal);
    if (!proposal) return { outcome: "rejected", reason: "invalid_input" };
    try {
      return await this.repository.withTransaction(async (tx) => {
        const existing = await tx.findByProposalId(input.originalProposalId);
        if (!existing) return { outcome: "rejected" as const, reason: "invalid_input" as const };
        if (!proposalMatchesOriginalLifecycle({
          original: existing.proposal,
          proposal,
          originalProposalId: input.originalProposalId,
          operation: "deletion",
        })) {
          return { outcome: "rejected" as const, reason: "invalid_input" as const };
        }
        if (
          existing.proposal.localVisibility !== "active" &&
          existing.proposal.deletedBy !== proposal.proposalId
        ) {
          return { outcome: "rejected" as const, reason: "invalid_input" as const };
        }
        const result = await this.recordParsedProposal(tx, proposal);
        if (result.outcome === "stored" || result.outcome === "duplicate") {
          const suppressed = await tx.suppressProposal({
            proposalId: input.originalProposalId,
            status: "deleted",
            deletedBy: result.proposal.proposalId,
            expectedOriginal: existing.proposal,
            updatedAt: result.proposal.createdAt,
          });
          if (!suppressed) return { outcome: "rejected" as const, reason: "invalid_input" as const };
        }
        return result;
      });
    } catch {
      return { outcome: "rejected", reason: "persistence_unavailable" };
    }
  }
}

export type HealthSemanticMemoryProvider = (input: {
  mem0UserId: string;
  content: string;
  proposal: HealthSemanticMemoryProposal;
  idempotencyKey: string;
}) => Promise<{ providerMemoryId: string }>;

const defaultMem0Provider: HealthSemanticMemoryProvider = async (input) => {
  return addMem0MemoryConfirmed({
    mem0UserId: input.mem0UserId,
    messages: [
      { role: "assistant", content: input.content },
    ],
    idempotencyKey: input.idempotencyKey,
  });
};

export type HealthSemanticMemoryDeletionProvider = (input: {
  mem0UserId: string;
  providerMemoryId: string;
  proposal: HealthSemanticMemoryProposal;
  idempotencyKey: string;
}) => Promise<void>;

const defaultMem0DeletionProvider: HealthSemanticMemoryDeletionProvider = async (input) => {
  await deleteMem0MemoryConfirmed({
    providerMemoryId: input.providerMemoryId,
  });
};

export type HealthSemanticMemoryDeletionOutcome =
  | { outcome: "deleted" | "duplicate"; proposal: HealthSemanticMemoryProposal }
  | { outcome: "failed"; proposal: HealthSemanticMemoryProposal }
  | { outcome: "rejected"; reason: "invalid_input" | "provider_memory_id_missing" | "persistence_unavailable" };

export async function deleteHealthSemanticMemory(input: {
  original: HealthSemanticMemoryProposal;
  deletionProposal: HealthSemanticMemoryProposal;
  now: Date;
  store?: HealthSemanticMemoryOutboxStore;
  provider?: HealthSemanticMemoryDeletionProvider;
}): Promise<HealthSemanticMemoryDeletionOutcome> {
  const original = parseProposal(input.original);
  const deletionProposal = parseProposal(input.deletionProposal);
  if (
    !original ||
    !deletionProposal ||
    deletionProposal.operation !== "deletion" ||
    deletionProposal.provenance.deletionOf !== original.proposalId ||
    deletionProposal.userId !== original.userId ||
    deletionProposal.mem0UserId !== original.mem0UserId
  ) {
    return { outcome: "rejected", reason: "invalid_input" };
  }
  if (!original.providerMemoryId) {
    return { outcome: "rejected", reason: "provider_memory_id_missing" };
  }

  const store = input.store ?? defaultHealthSemanticMemoryOutboxStore;
  const existingDeletion = await store.findProposalById(deletionProposal.proposalId);
  let requestedProposal: HealthSemanticMemoryProposal;
  if (existingDeletion) {
    if (
      existingDeletion.operation !== "deletion" ||
      existingDeletion.provenance.deletionOf !== original.proposalId ||
      existingDeletion.userId !== original.userId ||
      existingDeletion.mem0UserId !== original.mem0UserId
    ) {
      return { outcome: "rejected", reason: "invalid_input" };
    }
    if (existingDeletion.status === "delivered") {
      return { outcome: "duplicate", proposal: existingDeletion };
    }
    requestedProposal = existingDeletion;
  } else {
    const requested = await store.requestDeletion({
      originalProposalId: original.proposalId,
      deletionProposal,
    });
    if (requested.outcome === "rejected") {
      return {
        outcome: "rejected",
        reason: requested.reason === "persistence_unavailable"
          ? "persistence_unavailable"
          : "invalid_input",
      };
    }
    requestedProposal = requested.proposal;
  }

  const claim = await store.claimProviderDelivery({
    proposalId: requestedProposal.proposalId,
    now: input.now,
  });
  if (claim.outcome !== "updated") {
    return { outcome: "rejected", reason: "persistence_unavailable" };
  }

  try {
    await (input.provider ?? defaultMem0DeletionProvider)({
      mem0UserId: original.mem0UserId,
      providerMemoryId: original.providerMemoryId,
      proposal: claim.proposal,
      idempotencyKey: claim.proposal.idempotencyKey,
    });
    const delivered = await store.markProviderDelivered({
      proposalId: claim.proposal.proposalId,
      providerMemoryId: original.providerMemoryId,
      now: input.now,
    });
    if (delivered.outcome !== "updated") {
      throw new Error("mem0_deletion_status_not_recorded");
    }
    return { outcome: "deleted", proposal: delivered.proposal };
  } catch (error) {
    const failed = await store.markProviderFailed({
      proposalId: claim.proposal.proposalId,
      reason: error instanceof Error ? error.message : "provider_delete_failed",
      now: input.now,
    });
    return {
      outcome: "failed",
      proposal: failed.outcome === "updated" ? failed.proposal : claim.proposal,
    };
  }
}

export const defaultHealthSemanticMemoryOutboxStore =
  new PostgresHealthSemanticMemoryOutboxStore();

function safeHealthSummary(result: PreventiveHealthResult): string {
  const state = result.overall_state;
  const action = result.suggested_app_action ?? "none";
  return `Preventive health check-in completed with overall state ${state}; suggested app area ${action}.`;
}

export type PreventiveHealthMemoryProposalInput = {
  userId: string;
  profileId?: string;
  mem0UserId?: string | null;
  flowInstanceId: string;
  completionReference: string;
  answerDigest: string;
  result: PreventiveHealthResult;
  completedAt: Date;
  profileConsent?: unknown;
  env?: HealthMemoryEnvironmentMap;
  store?: HealthSemanticMemoryOutboxStore;
  provider?: HealthSemanticMemoryProvider;
  loadCurrentConsentForDelivery?: () => Promise<unknown>;
  deliverApprovedWrites?: boolean;
};

export type PreventiveHealthMemoryProposalOutcome =
  | { outcome: "disabled"; flagReasonCode: string }
  | { outcome: "stored" | "duplicate"; proposal: HealthSemanticMemoryProposal; providerDelivery: "not_attempted" | "delivered" | "failed" }
  | { outcome: "rejected"; reason: "invalid_input" | "semantic_conflict" | "persistence_unavailable" };

export async function recordPreventiveHealthMemoryProposal(
  input: PreventiveHealthMemoryProposalInput,
): Promise<PreventiveHealthMemoryProposalOutcome> {
  const env = input.env ?? process.env;
  const flag = resolveHealthMemoryPolicyFlag({
    env,
    userRef: input.userId,
    cohortKey: input.userId,
  });
  if (flag.effectiveMode !== "pilot") {
    return { outcome: "disabled", flagReasonCode: flag.reasonCode };
  }

  const consent = consentFromProfileDataSharing(input.profileConsent ?? {});
  const requestedAt = toIso(input.completedAt);
  const policy = evaluateHealthMemoryPolicy({
    userId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    flowId: PREVENTIVE_HEALTH_FLOW_ID,
    flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
    purpose: "health.preventive_check",
    category: "routine_health_context",
    operation: "propose_write",
    target: "mem0",
    consent,
    requestedAt,
  });
  if (!policy.ok) return { outcome: "rejected", reason: "invalid_input" };

  const proposal = proposalForDecision({
    userId: input.userId,
    profileId: input.profileId,
    mem0UserId: input.mem0UserId?.trim() || input.userId,
    flowInstanceId: input.flowInstanceId,
    completionReference: input.completionReference,
    answerDigest: input.answerDigest,
    category: "routine_health_context",
    content: safeHealthSummary(input.result),
    operation: "write",
    policyDecision: policy.decision,
    now: input.completedAt,
  });
  const store = input.store ?? defaultHealthSemanticMemoryOutboxStore;
  const result = await store.recordProposal(proposal);
  if (result.outcome === "rejected") return result;
  if (
    result.outcome === "stored" &&
    input.deliverApprovedWrites === true &&
    result.proposal.status === "delivery_pending" &&
    result.proposal.content
  ) {
    if (!input.loadCurrentConsentForDelivery) {
      const failed = await store.markProviderFailed({
        proposalId: result.proposal.proposalId,
        reason: "health_memory_policy_current_consent_unavailable",
        now: input.completedAt,
      });
      return {
        outcome: "stored",
        proposal: failed.outcome === "updated" ? failed.proposal : result.proposal,
        providerDelivery: "failed",
      };
    }
    const currentConsent = await input.loadCurrentConsentForDelivery().catch(() => null);
    if (currentConsent === null) {
      const failed = await store.markProviderFailed({
        proposalId: result.proposal.proposalId,
        reason: "health_memory_policy_current_consent_unavailable",
        now: input.completedAt,
      });
      return {
        outcome: "stored",
        proposal: failed.outcome === "updated" ? failed.proposal : result.proposal,
        providerDelivery: "failed",
      };
    }
    const deliveryConsent = consentFromProfileDataSharing(currentConsent);
    const deliveryPolicy = evaluateHealthMemoryPolicy({
      userId: input.userId,
      ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
      flowId: PREVENTIVE_HEALTH_FLOW_ID,
      flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
      purpose: "health.preventive_check",
      category: result.proposal.category,
      operation: "deliver_write",
      target: "mem0",
      consent: deliveryConsent,
      requestedAt,
    });
    if (
      !deliveryPolicy.ok ||
      deliveryPolicy.decision.decision !== "allow" ||
      deliveryPolicy.decision.providerDeliveryAllowed !== true
    ) {
      const failed = await store.markProviderFailed({
        proposalId: result.proposal.proposalId,
        reason: deliveryPolicy.ok ? deliveryPolicy.decision.reasonCode : "health_memory_policy_invalid_input",
        now: input.completedAt,
      });
      return {
        outcome: "stored",
        proposal: failed.outcome === "updated" ? failed.proposal : result.proposal,
        providerDelivery: "failed",
      };
    }
    const claim = await store.claimProviderDelivery({
      proposalId: result.proposal.proposalId,
      now: input.completedAt,
    });
    if (claim.outcome !== "updated" || !claim.proposal.content) {
      return {
        outcome: "stored",
        proposal: result.proposal,
        providerDelivery: "not_attempted",
      };
    }
    try {
      const providerResult = await (input.provider ?? defaultMem0Provider)({
        mem0UserId: claim.proposal.mem0UserId,
        content: claim.proposal.content,
        proposal: claim.proposal,
        idempotencyKey: claim.proposal.idempotencyKey,
      });
      if (!providerResult.providerMemoryId.trim()) {
        throw new Error("mem0_provider_memory_id_missing");
      }
      const delivered = await store.markProviderDelivered({
        proposalId: claim.proposal.proposalId,
        providerMemoryId: providerResult.providerMemoryId.trim(),
        now: input.completedAt,
      });
      if (delivered.outcome !== "updated") {
        throw new Error("mem0_delivery_status_not_recorded");
      }
      return {
        outcome: "stored",
        proposal: delivered.proposal,
        providerDelivery: "delivered",
      };
    } catch (error) {
      const failed = await store.markProviderFailed({
        proposalId: claim.proposal.proposalId,
        reason: error instanceof Error ? error.message : "provider_failed",
        now: input.completedAt,
      });
      return {
        outcome: "stored",
        proposal: failed.outcome === "updated" ? failed.proposal : claim.proposal,
        providerDelivery: "failed",
      };
    }
  }
  return {
    outcome: result.outcome,
    proposal: result.proposal,
    providerDelivery: "not_attempted",
  };
}

export function buildCorrectionProposal(input: {
  original: HealthSemanticMemoryProposal;
  correctedContent: string;
  now: Date;
  consent: HealthMemoryConsent;
}): HealthSemanticMemoryProposal | null {
  const policy = evaluateHealthMemoryPolicy({
    userId: input.original.userId,
    ...(input.original.profileId !== undefined ? { profileId: input.original.profileId } : {}),
    flowId: input.original.flowId,
    flowVersion: input.original.flowVersion,
    purpose: "health.preventive_check",
    category: input.original.category,
    operation: "correct",
    target: "mem0",
    consent: input.consent,
    requestedAt: toIso(input.now),
  });
  if (!policy.ok) return null;
  return proposalForDecision({
    userId: input.original.userId,
    profileId: input.original.profileId,
    mem0UserId: input.original.mem0UserId,
    flowInstanceId: input.original.flowInstanceId,
    completionReference: input.original.completionReference,
    answerDigest: input.original.answerDigest,
    category: input.original.category,
    content: input.correctedContent,
    operation: "correction",
    policyDecision: policy.decision,
    now: input.now,
    correctionOf: input.original.proposalId,
  });
}

export function buildDeletionProposal(input: {
  original: HealthSemanticMemoryProposal;
  now: Date;
  consent: HealthMemoryConsent;
}): HealthSemanticMemoryProposal | null {
  const policy = evaluateHealthMemoryPolicy({
    userId: input.original.userId,
    ...(input.original.profileId !== undefined ? { profileId: input.original.profileId } : {}),
    flowId: input.original.flowId,
    flowVersion: input.original.flowVersion,
    purpose: "health.preventive_check",
    category: input.original.category,
    operation: "delete",
    target: "mem0",
    consent: input.consent,
    requestedAt: toIso(input.now),
  });
  if (!policy.ok) return null;
  return proposalForDecision({
    userId: input.original.userId,
    profileId: input.original.profileId,
    mem0UserId: input.original.mem0UserId,
    flowInstanceId: input.original.flowInstanceId,
    completionReference: input.original.completionReference,
    answerDigest: input.original.answerDigest,
    category: input.original.category,
    content: `Delete semantic memory proposal ${input.original.proposalId}.`,
    operation: "deletion",
    policyDecision: policy.decision,
    now: input.now,
    deletionOf: input.original.proposalId,
  });
}

export type HealthVoiceMemoryBlockResult = Readonly<{
  memoryBlock: string;
  reasonCodes: string[];
  allowedCategories: HealthMemoryCategory[];
  flagReasonCode: string;
}>;

function formatPolicyMemoryBlock(memories: readonly HealthSemanticMemoryProposal[]): string {
  const top = memories
    .map((memory) => memory.content?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 3);
  if (!top.length) return "";
  const labels = ["Memory", "Preference", "Useful context"];
  return top.map((text, index) => `${labels[index] ?? "Memory"}: ${text}.`).join(" ");
}

export async function buildHealthPolicyFilteredMemoryBlock(input: {
  userId: string;
  profileId?: string;
  flowInstanceId?: string;
  profileConsent?: unknown;
  env?: HealthMemoryEnvironmentMap;
  store?: HealthSemanticMemoryOutboxStore;
  now?: Date;
  categories?: readonly HealthMemoryCategory[];
  limit?: number;
}): Promise<HealthVoiceMemoryBlockResult> {
  const env = input.env ?? process.env;
  const flag = resolveHealthMemoryPolicyFlag({
    env,
    userRef: input.userId,
    cohortKey: input.userId,
  });
  if (flag.effectiveMode !== "pilot") {
    return {
      memoryBlock: "",
      reasonCodes: ["health_memory_policy_disabled"],
      allowedCategories: [],
      flagReasonCode: flag.reasonCode,
    };
  }
  const consent = consentFromProfileDataSharing(input.profileConsent ?? {});
  const now = toIso(input.now ?? new Date());
  const allowedCategories: HealthMemoryCategory[] = [];
  const reasonCodes: string[] = [];
  for (const category of input.categories ?? ["general_preference", "routine_health_context"]) {
    const decision = evaluateHealthMemoryPolicy({
      userId: input.userId,
      ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
      flowId: PREVENTIVE_HEALTH_FLOW_ID,
      flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
      purpose: "health.preventive_check",
      category,
      operation: "read",
      target: "mem0",
      consent,
      requestedAt: now,
    });
    if (!decision.ok) {
      reasonCodes.push("health_memory_policy_invalid_input");
      continue;
    }
    reasonCodes.push(decision.decision.reasonCode);
    if (decision.decision.decision === "allow") allowedCategories.push(category);
  }
  const memories = allowedCategories.length
    ? await (input.store ?? defaultHealthSemanticMemoryOutboxStore).findReadableMemories({
        userId: input.userId,
        categories: allowedCategories,
        limit: input.limit ?? 3,
      })
    : [];
  return {
    memoryBlock: formatPolicyMemoryBlock(memories),
    reasonCodes,
    allowedCategories,
    flagReasonCode: flag.reasonCode,
  };
}
