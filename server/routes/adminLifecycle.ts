import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import {
  accessLinks,
  communicationsLog,
  consentAttempts,
  lifecycleEvents,
  organizations,
  profiles,
  tierEntitlements,
  userIntakes,
  users,
} from "../../shared/schema.js";

export const adminLifecycleRouter = Router();

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ADMIN_KEY = process.env.ADMIN_API_KEY;

function requireAdmin(req: Request, res: Response): boolean {
  if (IS_PRODUCTION && !ADMIN_KEY) {
    res.status(503).json({ error: "Admin dashboard is not configured on this server" });
    return false;
  }

  const effectiveKey = ADMIN_KEY ?? "dev-admin-key";
  const provided = req.headers["x-admin-key"] as string | undefined;
  if (!provided || provided !== effectiveKey) {
    res.status(403).json({ error: "Forbidden - invalid or missing admin key" });
    return false;
  }
  return true;
}

const entryPointSchema = z.enum(["form", "phone", "whatsapp", "admin"]);
const userTypeSchema = z.enum(["elder", "family", "admin"]);
const statusSchema = z.enum(["created", "link_sent", "consent_pending", "active", "dropped"]);
const consentStatusSchema = z.enum(["pending", "approved", "rejected", "no_answer", "failed"]);

const intakeSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(4),
  email: z.string().email().optional().or(z.literal("")),
  user_type: userTypeSchema.default("elder"),
  entry_point: entryPointSchema.default("form"),
  organization_id: z.string().uuid().optional().nullable(),
  tier: z.string().min(1).default("trial"),
  source_payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  elder: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
  }).optional(),
});

const linkSchema = z.object({
  intake_id: z.string().uuid().optional().nullable(),
  user_id: z.string().optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  link_type: z.enum(["trial", "unlimited", "organization", "custom", "caregiver"]).default("trial"),
  tier: z.string().min(1).default("trial"),
  destination: z.string().min(1).default("/onboarding"),
  target_role: z.string().min(1).default("elder"),
  expires_in_days: z.coerce.number().int().min(1).max(365).default(14),
  max_uses: z.coerce.number().int().min(1).max(100).default(1),
});

const orgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email().optional().nullable().or(z.literal("")),
  contact_phone: z.string().optional().nullable(),
  default_tier: z.string().min(1).default("trial"),
});

const tierSchema = z.object({
  tier: z.string().min(1),
  display_name: z.string().min(1),
  description: z.string().optional().nullable(),
  voice_assistant: z.boolean().default(false),
  medication_tracking: z.boolean().default(false),
  symptom_check: z.boolean().default(false),
  concierge: z.boolean().default(false),
  caregiver_dashboard: z.boolean().default(false),
  custom_features: z.record(z.unknown()).optional(),
});

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  return trimmed.replace(/\D/g, "");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64) || `org-${randomBytes(3).toString("hex")}`;
}

function syntheticEmailForPhone(phone: string): string {
  const normalized = normalizePhone(phone) || randomBytes(6).toString("hex");
  return `phone+${normalized.replace(/^\+/, "")}@vyva.local`;
}

function placeholderPasswordHash(): string {
  return `passwordless:${randomBytes(32).toString("hex")}`;
}

function publicBaseUrl(req: Request): string {
  return process.env.APP_URL
    ?? `${req.protocol}://${req.get("host")}`;
}

async function recordEvent(input: {
  intakeId?: string | null;
  userId?: string | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  channel?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(lifecycleEvents).values({
    intake_id: input.intakeId ?? null,
    user_id: input.userId ?? null,
    event_type: input.eventType,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    channel: input.channel ?? null,
    metadata: input.metadata ?? {},
  });
}

async function ensurePasswordlessUser(input: {
  name: string;
  phone: string;
  email?: string | null;
  tier: string;
  organizationId?: string | null;
}) {
  const email = (input.email || syntheticEmailForPhone(input.phone)).toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = existing ?? (await db.insert(users).values({
    email,
    password_hash: placeholderPasswordHash(),
  }).returning())[0];

  await db.insert(profiles).values({
    id: user.id,
    full_name: input.name,
    preferred_name: input.name.split(" ")[0] ?? input.name,
    phone_number: normalizePhone(input.phone),
    email: input.email || null,
    subscription_tier: input.tier,
    subscription_status: "active",
  } as typeof profiles.$inferInsert).onConflictDoUpdate({
    target: profiles.id,
    set: {
      full_name: input.name,
      phone_number: normalizePhone(input.phone),
      email: input.email || null,
      subscription_tier: input.tier,
      updated_at: new Date(),
    },
  });

  return user;
}

adminLifecycleRouter.get("/summary", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const rows = await db.select().from(userIntakes).orderBy(desc(userIntakes.created_at));
  const by = (key: "entry_point" | "user_type" | "status" | "tier" | "consent_status") =>
    rows.reduce<Record<string, number>>((acc, row) => {
      const value = String(row[key] ?? "unknown");
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});

  return res.json({
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    pendingConsent: rows.filter((r) => r.status === "consent_pending").length,
    dropped: rows.filter((r) => r.status === "dropped").length,
    byEntryPoint: by("entry_point"),
    byUserType: by("user_type"),
    byStatus: by("status"),
    byTier: by("tier"),
    byConsent: by("consent_status"),
  });
});

adminLifecycleRouter.get("/users", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const filters = [
    req.query.entry_point ? eq(userIntakes.entry_point, req.query.entry_point as "form" | "phone" | "whatsapp" | "admin") : undefined,
    req.query.user_type ? eq(userIntakes.user_type, req.query.user_type as "elder" | "family" | "admin") : undefined,
    req.query.status ? eq(userIntakes.status, req.query.status as "created" | "link_sent" | "consent_pending" | "active" | "dropped") : undefined,
    req.query.tier ? eq(userIntakes.tier, String(req.query.tier)) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      intake: userIntakes,
      organization_name: organizations.name,
    })
    .from(userIntakes)
    .leftJoin(organizations, eq(userIntakes.organization_id, organizations.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(userIntakes.created_at))
    .limit(200);

  return res.json({ users: rows.map((row) => ({ ...row.intake, organization_name: row.organization_name })) });
});

adminLifecycleRouter.post("/intakes", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = intakeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid intake" });
  }

  const data = parsed.data;
  const elderName = data.user_type === "family" ? (data.elder?.name || data.name) : data.name;
  const elderPhone = data.user_type === "family" ? (data.elder?.phone || data.phone) : data.phone;
  const elderEmail = data.user_type === "family" ? (data.elder?.email || undefined) : data.email || undefined;
  const elderUser = await ensurePasswordlessUser({
    name: elderName,
    phone: elderPhone,
    email: elderEmail || null,
    tier: data.tier,
    organizationId: data.organization_id ?? null,
  });

  let familyUserId: string | null = null;
  if (data.user_type === "family") {
    const familyUser = await ensurePasswordlessUser({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      tier: data.tier,
      organizationId: data.organization_id ?? null,
    });
    familyUserId = familyUser.id;
  }

  const initialStatus = data.user_type === "family" ? "consent_pending" : "created";
  const [intake] = await db.insert(userIntakes).values({
    user_id: data.user_type === "family" ? familyUserId : elderUser.id,
    elder_user_id: elderUser.id,
    family_user_id: familyUserId,
    name: data.name,
    phone: normalizePhone(data.phone),
    email: data.email || null,
    user_type: data.user_type,
    entry_point: data.entry_point,
    organization_id: data.organization_id ?? null,
    tier: data.tier,
    status: initialStatus,
    journey_step: data.user_type === "family" ? "elder_consent_required" : "intake_created",
    consent_status: data.user_type === "family" ? "pending" : "not_required",
    source_payload: data.source_payload ?? {},
    metadata: { ...(data.metadata ?? {}), elder: data.elder ?? null },
    last_activity_at: new Date(),
  }).returning();

  await recordEvent({
    intakeId: intake.id,
    userId: intake.user_id,
    eventType: "intake_created",
    toStatus: initialStatus,
    channel: data.entry_point,
  });

  return res.status(201).json({ intake });
});

adminLifecycleRouter.patch("/intakes/:id/status", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = z.object({
    status: statusSchema,
    journey_step: z.string().optional(),
    consent_status: z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status update" });

  const [existing] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Intake not found" });

  const now = new Date();
  const [updated] = await db.update(userIntakes).set({
    status: parsed.data.status,
    journey_step: parsed.data.journey_step ?? existing.journey_step,
    consent_status: parsed.data.consent_status ?? existing.consent_status,
    activated_at: parsed.data.status === "active" ? now : existing.activated_at,
    dropped_at: parsed.data.status === "dropped" ? now : existing.dropped_at,
    last_activity_at: now,
    updated_at: now,
  }).where(eq(userIntakes.id, req.params.id)).returning();

  await recordEvent({
    intakeId: updated.id,
    userId: updated.user_id,
    eventType: "status_updated",
    fromStatus: existing.status,
    toStatus: updated.status,
  });

  return res.json({ intake: updated });
});

adminLifecycleRouter.post("/access-links", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid link" });

  const data = parsed.data;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000);
  const [link] = await db.insert(accessLinks).values({
    token,
    user_id: data.user_id ?? null,
    intake_id: data.intake_id ?? null,
    organization_id: data.organization_id ?? null,
    link_type: data.link_type,
    tier: data.tier,
    destination: data.destination,
    target_role: data.target_role,
    max_uses: data.max_uses,
    expires_at: expiresAt,
  }).returning();

  if (data.intake_id) {
    await db.update(userIntakes).set({
      status: "link_sent",
      journey_step: "access_link_created",
      link_sent_at: new Date(),
      updated_at: new Date(),
    }).where(eq(userIntakes.id, data.intake_id));
    await recordEvent({ intakeId: data.intake_id, userId: data.user_id, eventType: "access_link_created", toStatus: "link_sent" });
  }

  return res.status(201).json({ link, url: `${publicBaseUrl(req)}/access/${token}` });
});

adminLifecycleRouter.post("/intakes/:id/send-link", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "Intake not found" });

  const targetUserId = intake.user_type === "family" ? intake.family_user_id : intake.elder_user_id;
  const token = randomBytes(32).toString("base64url");
  const destination = intake.user_type === "family" ? "/caregiver" : "/onboarding";
  const [link] = await db.insert(accessLinks).values({
    token,
    user_id: targetUserId ?? intake.user_id,
    intake_id: intake.id,
    organization_id: intake.organization_id,
    link_type: intake.tier === "unlimited" ? "unlimited" : "trial",
    tier: intake.tier,
    destination,
    target_role: intake.user_type,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  }).returning();
  const url = `${publicBaseUrl(req)}/access/${token}`;
  const channel = intake.entry_point === "whatsapp" ? "whatsapp" : "sms";

  const [communication] = await db.insert(communicationsLog).values({
    intake_id: intake.id,
    user_id: targetUserId ?? intake.user_id,
    channel,
    recipient: intake.phone,
    purpose: "send_app_link",
    status: "queued",
    body: `VYVA: aquí tiene su enlace seguro para continuar: ${url}`,
    metadata: { url },
  }).returning();

  await db.update(userIntakes).set({
    status: "link_sent",
    journey_step: "link_sent",
    link_sent_at: new Date(),
    last_activity_at: new Date(),
    updated_at: new Date(),
  }).where(eq(userIntakes.id, intake.id));
  await recordEvent({ intakeId: intake.id, userId: targetUserId, eventType: "link_sent", fromStatus: intake.status, toStatus: "link_sent", channel });

  return res.json({ link, url, communication });
});

adminLifecycleRouter.get("/consent", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const rows = await db
    .select({ attempt: consentAttempts, intake: userIntakes })
    .from(consentAttempts)
    .leftJoin(userIntakes, eq(consentAttempts.intake_id, userIntakes.id))
    .orderBy(desc(consentAttempts.created_at))
    .limit(100);
  return res.json({ attempts: rows.map((row) => ({ ...row.attempt, intake: row.intake })) });
});

adminLifecycleRouter.post("/consent/:intakeId/trigger", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.intakeId)).limit(1);
  if (!intake) return res.status(404).json({ error: "Intake not found" });

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(consentAttempts)
    .where(eq(consentAttempts.intake_id, intake.id));

  const [attempt] = await db.insert(consentAttempts).values({
    intake_id: intake.id,
    elder_user_id: intake.elder_user_id,
    family_user_id: intake.family_user_id,
    attempt_number: (count ?? 0) + 1,
    status: "pending",
    channel: "voice",
    scheduled_at: new Date(),
  }).returning();

  await db.update(userIntakes).set({
    status: "consent_pending",
    consent_status: "pending",
    journey_step: "consent_call_queued",
    updated_at: new Date(),
  }).where(eq(userIntakes.id, intake.id));

  await db.insert(communicationsLog).values({
    intake_id: intake.id,
    user_id: intake.elder_user_id,
    channel: "voice",
    recipient: intake.phone,
    purpose: "elder_consent_call",
    status: "queued",
    body: "Consent call queued for elder approval.",
  });
  await recordEvent({ intakeId: intake.id, userId: intake.elder_user_id, eventType: "consent_triggered", toStatus: "consent_pending", channel: "voice" });

  return res.status(201).json({ attempt });
});

adminLifecycleRouter.post("/consent/:attemptId/result", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = z.object({
    status: consentStatusSchema,
    source_session_id: z.string().optional(),
    result_payload: z.record(z.unknown()).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid consent result" });

  const [attempt] = await db.select().from(consentAttempts).where(eq(consentAttempts.id, req.params.attemptId)).limit(1);
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });

  const [updatedAttempt] = await db.update(consentAttempts).set({
    status: parsed.data.status,
    completed_at: new Date(),
    source_session_id: parsed.data.source_session_id ?? attempt.source_session_id,
    result_payload: parsed.data.result_payload ?? {},
  }).where(eq(consentAttempts.id, attempt.id)).returning();

  if (attempt.intake_id) {
    const nextStatus = parsed.data.status === "approved" ? "created" : parsed.data.status === "rejected" ? "dropped" : "consent_pending";
    await db.update(userIntakes).set({
      status: nextStatus,
      consent_status: parsed.data.status,
      journey_step: parsed.data.status === "approved" ? "consent_approved_send_links" : `consent_${parsed.data.status}`,
      updated_at: new Date(),
      dropped_at: parsed.data.status === "rejected" ? new Date() : null,
    }).where(eq(userIntakes.id, attempt.intake_id));
    await recordEvent({ intakeId: attempt.intake_id, userId: attempt.elder_user_id, eventType: "consent_result", toStatus: nextStatus, metadata: { consent_status: parsed.data.status } });
  }

  return res.json({ attempt: updatedAttempt });
});

adminLifecycleRouter.get("/organizations", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const rows = await db.select().from(organizations).orderBy(desc(organizations.created_at));
  return res.json({ organizations: rows });
});

adminLifecycleRouter.post("/organizations", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = orgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid organization" });
  const data = parsed.data;
  const [org] = await db.insert(organizations).values({
    name: data.name,
    slug: data.slug ? slugify(data.slug) : slugify(data.name),
    contact_name: data.contact_name ?? null,
    contact_email: data.contact_email || null,
    contact_phone: data.contact_phone ?? null,
    default_tier: data.default_tier,
  }).returning();
  return res.status(201).json({ organization: org });
});

adminLifecycleRouter.get("/tiers", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const existing = await db.select().from(tierEntitlements).orderBy(tierEntitlements.tier);
  if (existing.length) return res.json({ tiers: existing });

  return res.json({
    tiers: [
      { tier: "trial", display_name: "Trial", voice_assistant: true, medication_tracking: true, symptom_check: true, concierge: true, caregiver_dashboard: false },
      { tier: "unlimited", display_name: "Unlimited", voice_assistant: true, medication_tracking: true, symptom_check: true, concierge: true, caregiver_dashboard: true },
      { tier: "custom", display_name: "Custom", voice_assistant: false, medication_tracking: false, symptom_check: false, concierge: false, caregiver_dashboard: false },
    ],
  });
});

adminLifecycleRouter.post("/tiers", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = tierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid tier" });
  const data = parsed.data;
  const [tier] = await db.insert(tierEntitlements).values({
    ...data,
    description: data.description ?? null,
    custom_features: data.custom_features ?? {},
  }).onConflictDoUpdate({
    target: tierEntitlements.tier,
    set: {
      display_name: data.display_name,
      description: data.description ?? null,
      voice_assistant: data.voice_assistant,
      medication_tracking: data.medication_tracking,
      symptom_check: data.symptom_check,
      concierge: data.concierge,
      caregiver_dashboard: data.caregiver_dashboard,
      custom_features: data.custom_features ?? {},
      updated_at: new Date(),
    },
  }).returning();
  return res.json({ tier });
});

adminLifecycleRouter.get("/communications", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const rows = await db.select().from(communicationsLog).orderBy(desc(communicationsLog.created_at)).limit(150);
  return res.json({ communications: rows });
});
