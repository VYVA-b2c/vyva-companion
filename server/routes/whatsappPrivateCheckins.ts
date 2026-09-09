import { Router, type NextFunction, type Request, type Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { communicationsLog, whatsappPrivateCheckins } from "../../shared/schema.js";
import { dispatchCommunicationsByIds } from "../services/communicationDispatcher.js";
import {
  createPrivateCheckinToken,
  decryptPrivateCheckinResponse,
  encryptPrivateCheckinResponse,
  hashPrivateCheckinToken,
  privateCheckinTemplateSid,
  privateCheckinUrl,
  safeSecretMatches,
  validatePrivateCheckinAnswers,
  WHATSAPP_CHECKIN_LANGUAGES,
} from "../lib/whatsappPrivateCheckin.js";

const questionSchema = z.object({
  id: z.string().trim().min(1).max(100),
  prompt: z.string().trim().min(1).max(500),
  type: z.enum(["yes_no", "single_choice", "scale", "short_text"]),
  required: z.boolean().optional().default(false),
  choices: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
});

const createSchema = z.object({
  recipient: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Use an E.164 WhatsApp number"),
  language: z.enum(WHATSAPP_CHECKIN_LANGUAGES),
  workflowId: z.string().trim().min(1).max(160),
  workflowName: z.string().trim().min(1).max(240),
  stepId: z.string().trim().min(1).max(160),
  stepName: z.string().trim().min(1).max(240),
  questions: z.array(questionSchema).min(1).max(30),
  whatsappOptInConfirmed: z.literal(true),
  whatsappOptInConfirmedAt: z.coerce.date(),
  whatsappOptInSource: z.string().trim().min(1).max(240),
  expiresInHours: z.number().int().min(1).max(168).optional().default(48),
});

const answerValueSchema = z.union([
  z.string().max(2_000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(500)).max(20),
]);
const responseSchema = z.object({
  answers: z.record(answerValueSchema),
  submittedLanguage: z.enum(WHATSAPP_CHECKIN_LANGUAGES).optional(),
});

function noStore(res: Response) {
  res.set("Cache-Control", "no-store, private");
  res.set("Pragma", "no-cache");
}

function requireCareOperationsKey(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.CARE_OPERATIONS_INTEGRATION_KEY?.trim();
  if (!configured) {
    return res.status(503).json({ error: "Care Operations integration is not configured" });
  }
  const supplied = req.header("x-vyva-care-operations-key")?.trim();
  if (!safeSecretMatches(supplied, configured)) {
    return res.status(401).json({ error: "Invalid Care Operations integration key" });
  }
  next();
}

function publicCheckin(row: typeof whatsappPrivateCheckins.$inferSelect) {
  return {
    id: row.id,
    language: row.language,
    workflowName: row.workflow_name,
    stepName: row.step_name,
    questions: row.questions,
    status: row.status,
    expiresAt: row.expires_at.toISOString(),
  };
}

export const careOperationsWhatsappRouter = Router();
careOperationsWhatsappRouter.use(requireCareOperationsKey);

careOperationsWhatsappRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid private check-in request", details: parsed.error.flatten() });
  }

  const input = parsed.data;
  const requestKey = req.header("idempotency-key")?.trim();
  if (!requestKey || requestKey.length > 200) {
    return res.status(400).json({ error: "A valid idempotency key is required" });
  }
  const requestKeyHash = hashPrivateCheckinToken(`care-operations:${requestKey}`);
  const [previous] = await db.select({
    id: whatsappPrivateCheckins.id,
    status: whatsappPrivateCheckins.status,
    communication_id: whatsappPrivateCheckins.communication_id,
    expires_at: whatsappPrivateCheckins.expires_at,
  }).from(whatsappPrivateCheckins)
    .where(eq(whatsappPrivateCheckins.request_key_hash, requestKeyHash)).limit(1);
  if (previous) {
    noStore(res);
    return res.json({
      id: previous.id,
      status: previous.status,
      communicationId: previous.communication_id,
      expiresAt: previous.expires_at.toISOString(),
      idempotent: true,
    });
  }
  const token = createPrivateCheckinToken();
  const tokenHash = hashPrivateCheckinToken(token);
  const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1_000);

  const created = await db.transaction(async (tx) => {
    const [checkin] = await tx.insert(whatsappPrivateCheckins).values({
      token_hash: tokenHash,
      request_key_hash: requestKeyHash,
      recipient: input.recipient,
      language: input.language,
      workflow_id: input.workflowId,
      workflow_name: input.workflowName,
      step_id: input.stepId,
      step_name: input.stepName,
      questions: input.questions,
      status: "queued",
      whatsapp_opt_in_confirmed_at: input.whatsappOptInConfirmedAt,
      whatsapp_opt_in_source: input.whatsappOptInSource,
      expires_at: expiresAt,
      created_by: "care-operations-integration",
    }).returning();

    const [communication] = await tx.insert(communicationsLog).values({
      channel: "whatsapp",
      recipient: input.recipient,
      purpose: "private_health_checkin_notice",
      status: "queued",
      body: "VYVA private check-in notice. Open the secure link; do not send medical information in WhatsApp.",
      metadata: {
        content_sid: privateCheckinTemplateSid(input.language),
        content_variables: { "1": token },
        private_checkin_id: checkin.id,
        workflow_id: input.workflowId,
        step_id: input.stepId,
        language: input.language,
        health_data_in_message: false,
        whatsapp_opt_in_confirmed_at: input.whatsappOptInConfirmedAt.toISOString(),
        whatsapp_opt_in_source: input.whatsappOptInSource,
      },
    }).returning();

    await tx.update(whatsappPrivateCheckins)
      .set({ communication_id: communication.id, updated_at: new Date() })
      .where(eq(whatsappPrivateCheckins.id, checkin.id));

    return { checkin, communication };
  });

  const dispatch = await dispatchCommunicationsByIds([created.communication.id]);
  const result = dispatch.results[0];
  const status = result?.status === "sent" ? "sent" : "failed";
  await db.update(whatsappPrivateCheckins)
    .set({ status, updated_at: new Date() })
    .where(eq(whatsappPrivateCheckins.id, created.checkin.id));

  noStore(res);
  return res.status(status === "sent" ? 201 : 502).json({
    id: created.checkin.id,
    status,
    communicationId: created.communication.id,
    providerMessageId: result?.provider_message_id ?? null,
    secureUrl: privateCheckinUrl(token),
    expiresAt: expiresAt.toISOString(),
    ...(result?.error ? { error: result.error } : {}),
  });
});

careOperationsWhatsappRouter.get("/:id", async (req, res) => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) return res.status(400).json({ error: "Invalid check-in id" });
  const [row] = await db.select().from(whatsappPrivateCheckins)
    .where(eq(whatsappPrivateCheckins.id, parsedId.data)).limit(1);
  if (!row) return res.status(404).json({ error: "Check-in not found" });
  noStore(res);
  let responsePayload: unknown = null;
  if (row.response_payload) {
    try {
      responsePayload = decryptPrivateCheckinResponse(row.response_payload);
    } catch (error) {
      console.error("[whatsapp-private-checkin] response decryption failed", error);
      return res.status(503).json({ error: "Encrypted response is temporarily unavailable" });
    }
  }
  return res.json({
    ...publicCheckin(row),
    workflowId: row.workflow_id,
    stepId: row.step_id,
    communicationId: row.communication_id,
    response: responsePayload,
    consumedAt: row.consumed_at?.toISOString() ?? null,
  });
});

export const publicWhatsappCheckinRouter = Router();

publicWhatsappCheckinRouter.get("/:token", async (req, res) => {
  const token = z.string().min(40).max(100).safeParse(req.params.token);
  if (!token.success) return res.status(404).json({ error: "Check-in not found" });
  const [row] = await db.select().from(whatsappPrivateCheckins)
    .where(eq(whatsappPrivateCheckins.token_hash, hashPrivateCheckinToken(token.data))).limit(1);
  noStore(res);
  if (!row) return res.status(404).json({ error: "Check-in not found" });
  if (row.consumed_at || row.status === "completed") return res.status(410).json({ error: "Check-in already completed" });
  if (row.expires_at <= new Date()) return res.status(410).json({ error: "Check-in expired" });
  return res.json(publicCheckin(row));
});

publicWhatsappCheckinRouter.post("/:token/responses", async (req, res) => {
  const token = z.string().min(40).max(100).safeParse(req.params.token);
  const parsed = responseSchema.safeParse(req.body);
  if (!token.success || !parsed.success || JSON.stringify(req.body).length > 25_000) {
    return res.status(400).json({ error: "Invalid check-in response" });
  }

  const tokenHash = hashPrivateCheckinToken(token.data);
  const [existing] = await db.select().from(whatsappPrivateCheckins)
    .where(eq(whatsappPrivateCheckins.token_hash, tokenHash)).limit(1);
  noStore(res);
  if (!existing) return res.status(404).json({ error: "Check-in not found" });
  if (existing.consumed_at || existing.status === "completed") return res.status(410).json({ error: "Check-in already completed" });
  if (existing.expires_at <= new Date()) return res.status(410).json({ error: "Check-in expired" });

  if (!validatePrivateCheckinAnswers(
    existing.questions as Array<{
      id: string;
      type: "yes_no" | "single_choice" | "scale" | "short_text";
      required?: boolean;
      choices?: string[];
    }>,
    parsed.data.answers,
  )) {
    return res.status(400).json({ error: "Response does not match the check-in questions" });
  }

  const now = new Date();
  let encryptedResponse: ReturnType<typeof encryptPrivateCheckinResponse>;
  try {
    encryptedResponse = encryptPrivateCheckinResponse({
      answers: parsed.data.answers,
      submitted_language: parsed.data.submittedLanguage ?? existing.language,
      submitted_at: now.toISOString(),
    });
  } catch (error) {
    console.error("[whatsapp-private-checkin] response encryption unavailable", error);
    return res.status(503).json({ error: "Secure response storage is not configured" });
  }

  const [updated] = await db.update(whatsappPrivateCheckins).set({
    response_payload: encryptedResponse,
    status: "completed",
    consumed_at: now,
    updated_at: now,
  }).where(and(
    eq(whatsappPrivateCheckins.token_hash, tokenHash),
    isNull(whatsappPrivateCheckins.consumed_at),
    gt(whatsappPrivateCheckins.expires_at, now),
  )).returning({ id: whatsappPrivateCheckins.id });

  if (!updated) return res.status(410).json({ error: "Check-in is no longer available" });
  return res.status(201).json({ id: updated.id, status: "completed" });
});
