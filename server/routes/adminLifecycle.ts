import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes } from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import {
  accessLinks,
  communicationsLog,
  consentAttempts,
  homePlanCards,
  lifecycleEvents,
  organizations,
  profiles,
  scheduledEventLogs,
  scheduledEvents,
  tierEntitlements,
  userIntakes,
  userMedications,
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

const bulkRowSchema = z.object({
  first_name: z.string().optional().default(""),
  last_name: z.string().optional().default(""),
  name: z.string().optional().default(""),
  preferred_name: z.string().optional().default(""),
  date_of_birth: z.string().optional().default(""),
  gender: z.string().optional().default("prefer_not_to_say"),
  phone: z.string().optional().default(""),
  whatsapp: z.string().optional().default(""),
  email: z.string().optional().default(""),
  language: z.string().optional().default("es"),
  timezone: z.string().optional().default("Europe/Madrid"),
  user_type: userTypeSchema.optional().default("elder"),
  tier: z.string().optional().default(""),
});

const bulkPreviewSchema = z.object({
  rows: z.array(bulkRowSchema).min(1).max(500),
});

const bulkImportSchema = bulkPreviewSchema.extend({
  send_links: z.boolean().optional().default(false),
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

const profileUpdateSchema = z.object({
  full_name: z.string().min(1).optional(),
  preferred_name: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone_number: z.string().optional().nullable(),
  whatsapp_number: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  caregiver_name: z.string().optional().nullable(),
  caregiver_contact: z.string().optional().nullable(),
  subscription_tier: z.string().optional(),
  organization_id: z.string().uuid().optional().nullable(),
  tier: z.string().optional(),
});

const scheduledEventAdminSchema = z.object({
  event_type: z.string().min(1).default("custom"),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  channel: z.string().min(1).default("app"),
  agent_id: z.string().optional().nullable(),
  agent_slug: z.string().optional().nullable(),
  room_slug: z.string().optional().nullable(),
  scheduled_for: z.string().min(1),
  timezone: z.string().min(1).default("Europe/Madrid"),
  recurrence: z.string().min(1).default("none"),
  status: z.string().min(1).default("upcoming"),
  source: z.string().min(1).default("admin"),
  metadata: z.record(z.unknown()).optional().default({}),
});

const homePlanCardUpdateSchema = z.object({
  is_enabled: z.boolean().optional(),
  emoji: z.string().min(1).optional(),
  bg: z.string().min(1).optional(),
  badge_bg: z.string().min(1).optional(),
  badge_text: z.string().min(1).optional(),
  route: z.string().min(1).optional(),
  base_priority: z.coerce.number().int().min(0).max(200).optional(),
  condition_keywords: z.array(z.string()).optional(),
  hobby_keywords: z.array(z.string()).optional(),
  avoid_condition_keywords: z.array(z.string()).optional(),
  admin_notes: z.string().optional().nullable(),
});

function targetUserIdForIntake(intake: typeof userIntakes.$inferSelect): string | null {
  return intake.elder_user_id ?? intake.user_id ?? intake.family_user_id ?? null;
}

function medicationEventsFromRows(rows: Array<typeof userMedications.$inferSelect>) {
  return rows.flatMap((med) => {
    const times = med.scheduled_times?.length ? med.scheduled_times : [];
    return times.map((time, index) => ({
      id: `medication:${med.id}:${index}`,
      user_id: med.user_id,
      event_type: "medication_reminder",
      title: med.medication_name,
      description: med.dosage ? `${med.dosage}${med.frequency ? ` - ${med.frequency}` : ""}` : med.frequency ?? "",
      channel: "app",
      agent_id: null,
      agent_slug: null,
      room_slug: null,
      scheduled_for: null,
      display_time: time,
      timezone: "profile",
      recurrence: med.frequency ?? "daily",
      status: med.active ? "recurring" : "paused",
      source: "medication_schedule",
      metadata: { medication_id: med.id, read_only: true },
      created_at: med.created_at,
      updated_at: med.created_at,
      read_only: true,
    }));
  });
}

async function scheduledItemsForUser(userId: string | null) {
  if (!userId) return [];
  const [events, medications] = await Promise.all([
    db.select().from(scheduledEvents).where(eq(scheduledEvents.user_id, userId)).orderBy(desc(scheduledEvents.scheduled_for)).limit(100),
    db.select().from(userMedications).where(eq(userMedications.user_id, userId)).limit(100),
  ]);
  return [...events, ...medicationEventsFromRows(medications)];
}

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

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizeBulkRow(row: z.infer<typeof bulkRowSchema>, defaultTier: string) {
  const fromName = splitName(row.name);
  const firstName = row.first_name.trim() || fromName.firstName;
  const lastName = row.last_name.trim() || fromName.lastName;
  const fullName = `${firstName} ${lastName}`.trim() || row.name.trim();
  const phone = normalizePhone(row.phone);
  const whatsapp = row.whatsapp.trim() ? normalizePhone(row.whatsapp) : phone;
  const language = row.language.trim() || "es";
  const timezone = row.timezone.trim() || "Europe/Madrid";
  const tier = row.tier.trim() || defaultTier || "trial";

  return {
    first_name: firstName,
    last_name: lastName,
    name: fullName,
    preferred_name: row.preferred_name.trim(),
    date_of_birth: row.date_of_birth.trim(),
    gender: row.gender.trim() || "prefer_not_to_say",
    phone,
    whatsapp,
    email: row.email.trim(),
    language,
    timezone,
    user_type: row.user_type,
    tier,
  };
}

async function buildBulkPreview(organizationId: string, rows: z.infer<typeof bulkRowSchema>[]) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) return { error: "Organization not found" as const };

  const normalized = rows.map((row, index) => ({
    index,
    values: normalizeBulkRow(row, org.default_tier),
    errors: [] as string[],
  }));
  const seenPhones = new Map<string, number>();

  for (const row of normalized) {
    if (!row.values.first_name) row.errors.push("First name is required");
    if (!row.values.last_name) row.errors.push("Last name is required");
    if (!row.values.phone) row.errors.push("Phone is required");
    if (row.values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.values.email)) row.errors.push("Email is invalid");
    if (!["elder", "family", "admin"].includes(row.values.user_type)) row.errors.push("User type must be elder, family, or admin");

    if (row.values.phone) {
      const firstSeen = seenPhones.get(row.values.phone);
      if (firstSeen !== undefined) {
        row.errors.push(`Duplicate phone in file, first seen on row ${firstSeen + 1}`);
      } else {
        seenPhones.set(row.values.phone, row.index);
      }

      const [existing] = await db
        .select({ id: userIntakes.id })
        .from(userIntakes)
        .where(eq(userIntakes.phone, row.values.phone))
        .limit(1);
      if (existing) row.errors.push("Phone already exists in lifecycle intakes");
    }
  }

  return {
    organization: org,
    rows: normalized.map((row) => ({
      index: row.index,
      row_number: row.index + 1,
      valid: row.errors.length === 0,
      errors: row.errors,
      values: row.values,
    })),
  };
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
  profile?: Record<string, unknown>;
}) {
  const email = (input.email || syntheticEmailForPhone(input.phone)).toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = existing ?? (await db.insert(users).values({
    email,
    password_hash: placeholderPasswordHash(),
  }).returning())[0];

  const preferredName = typeof input.profile?.preferred_name === "string" && input.profile.preferred_name.trim()
    ? input.profile.preferred_name.trim()
    : input.name.split(" ")[0] ?? input.name;
  const dateOfBirth = typeof input.profile?.date_of_birth === "string" ? input.profile.date_of_birth : null;
  const language = typeof input.profile?.language === "string" && input.profile.language ? input.profile.language : "es";
  const timezone = typeof input.profile?.timezone === "string" && input.profile.timezone ? input.profile.timezone : "Europe/Madrid";
  const countryCode = typeof input.profile?.country_code === "string" && input.profile.country_code ? input.profile.country_code : "ES";
  const whatsappNumber = typeof input.profile?.whatsapp_number === "string" && input.profile.whatsapp_number.trim()
    ? input.profile.whatsapp_number.trim()
    : normalizePhone(input.phone);

  await db.insert(profiles).values({
    id: user.id,
    full_name: input.name,
    preferred_name: preferredName,
    date_of_birth: dateOfBirth,
    language,
    phone_number: normalizePhone(input.phone),
    whatsapp_number: whatsappNumber,
    email: input.email || null,
    country_code: countryCode,
    timezone,
    subscription_tier: input.tier,
    subscription_status: "active",
  } as typeof profiles.$inferInsert).onConflictDoUpdate({
    target: profiles.id,
    set: {
      full_name: input.name,
      preferred_name: preferredName,
      date_of_birth: dateOfBirth,
      language,
      phone_number: normalizePhone(input.phone),
      whatsapp_number: whatsappNumber,
      email: input.email || null,
      country_code: countryCode,
      timezone,
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

adminLifecycleRouter.get("/home-plan-cards", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const rows = await db.select().from(homePlanCards).orderBy(desc(homePlanCards.base_priority));
    return res.json({ cards: rows });
  } catch (error) {
    return res.status(503).json({
      error: "Home cards are not migrated yet. Run schema/home_plan_cards.sql.",
    });
  }
});

adminLifecycleRouter.patch("/home-plan-cards/:cardId", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const parsed = homePlanCardUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const [card] = await db
    .update(homePlanCards)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(homePlanCards.card_id, req.params.cardId))
    .returning();

  if (!card) {
    return res.status(404).json({ error: "Home card not found" });
  }

  return res.json({ card });
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

  const profileIds = Array.from(new Set(rows.map((row) => targetUserIdForIntake(row.intake)).filter(Boolean))) as string[];
  const profileRows = profileIds.length
    ? await db
      .select({
        id: profiles.id,
        account_status: profiles.account_status,
        disabled_at: profiles.disabled_at,
      })
      .from(profiles)
      .where(inArray(profiles.id, profileIds))
    : [];
  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));

  return res.json({
    users: rows.map((row) => {
      const profile = profileById.get(targetUserIdForIntake(row.intake) ?? "");
      return {
        ...row.intake,
        organization_name: row.organization_name,
        account_status: profile?.account_status ?? "enabled",
        disabled_at: profile?.disabled_at ?? null,
      };
    }),
  });
});

adminLifecycleRouter.get("/users/:id/details", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });

  const userId = targetUserIdForIntake(intake);
  const [profile] = userId
    ? await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1)
    : [];
  const [communicationRows, lifecycleRows, consentRows, scheduledRows] = await Promise.all([
    db.select().from(communicationsLog).where(eq(communicationsLog.intake_id, intake.id)).orderBy(desc(communicationsLog.created_at)).limit(100),
    db.select().from(lifecycleEvents).where(eq(lifecycleEvents.intake_id, intake.id)).orderBy(desc(lifecycleEvents.created_at)).limit(100),
    db.select().from(consentAttempts).where(eq(consentAttempts.intake_id, intake.id)).orderBy(desc(consentAttempts.created_at)).limit(50),
    scheduledItemsForUser(userId),
  ]);

  return res.json({
    intake,
    profile: profile ?? null,
    communications: communicationRows,
    lifecycle_events: lifecycleRows,
    consent_attempts: consentRows,
    scheduled_events: scheduledRows,
  });
});

adminLifecycleRouter.patch("/users/:id/profile", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid profile update" });

  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });
  const userId = targetUserIdForIntake(intake);
  if (!userId) return res.status(400).json({ error: "This intake is not linked to a profile yet" });

  const data = parsed.data;
  const profilePatch: Partial<typeof profiles.$inferInsert> = { updated_at: new Date() };
  if (data.full_name !== undefined) profilePatch.full_name = data.full_name;
  if (data.preferred_name !== undefined) profilePatch.preferred_name = data.preferred_name || null;
  if (data.date_of_birth !== undefined) profilePatch.date_of_birth = data.date_of_birth || null;
  if (data.email !== undefined) profilePatch.email = data.email || null;
  if (data.phone_number !== undefined) profilePatch.phone_number = data.phone_number || null;
  if (data.whatsapp_number !== undefined) profilePatch.whatsapp_number = data.whatsapp_number || null;
  if (data.language !== undefined) profilePatch.language = data.language || "es";
  if (data.timezone !== undefined) profilePatch.timezone = data.timezone || "Europe/Madrid";
  if (data.caregiver_name !== undefined) profilePatch.caregiver_name = data.caregiver_name || null;
  if (data.caregiver_contact !== undefined) profilePatch.caregiver_contact = data.caregiver_contact || null;
  if (data.subscription_tier !== undefined || data.tier !== undefined) profilePatch.subscription_tier = data.subscription_tier ?? data.tier;

  const [profile] = await db
    .update(profiles)
    .set(profilePatch)
    .where(eq(profiles.id, userId))
    .returning();

  const intakePatch: Partial<typeof userIntakes.$inferInsert> = { updated_at: new Date(), last_activity_at: new Date() };
  if (data.full_name !== undefined) intakePatch.name = data.full_name;
  if (data.phone_number !== undefined) intakePatch.phone = normalizePhone(data.phone_number ?? intake.phone);
  if (data.email !== undefined) intakePatch.email = data.email || null;
  if (data.tier !== undefined || data.subscription_tier !== undefined) intakePatch.tier = data.tier ?? data.subscription_tier;
  if (data.organization_id !== undefined) intakePatch.organization_id = data.organization_id ?? null;

  const [updatedIntake] = await db.update(userIntakes).set(intakePatch).where(eq(userIntakes.id, intake.id)).returning();
  await recordEvent({ intakeId: intake.id, userId, eventType: "admin_profile_updated", channel: "admin" });

  return res.json({ intake: updatedIntake, profile });
});

adminLifecycleRouter.post("/users/:id/disable", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const reason = z.object({ reason: z.string().optional().default("") }).parse(req.body ?? {}).reason;
  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });
  const userId = targetUserIdForIntake(intake);
  if (!userId) return res.status(400).json({ error: "This intake is not linked to a profile yet" });

  const [profile] = await db.update(profiles).set({
    account_status: "disabled",
    disabled_at: new Date(),
    disabled_reason: reason || "Disabled by admin",
    disabled_by: "admin",
    updated_at: new Date(),
  }).where(eq(profiles.id, userId)).returning();

  await recordEvent({ intakeId: intake.id, userId, eventType: "user_disabled", channel: "admin", metadata: { reason } });
  return res.json({ profile });
});

adminLifecycleRouter.post("/users/:id/enable", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });
  const userId = targetUserIdForIntake(intake);
  if (!userId) return res.status(400).json({ error: "This intake is not linked to a profile yet" });

  const [profile] = await db.update(profiles).set({
    account_status: "enabled",
    disabled_at: null,
    disabled_reason: null,
    disabled_by: null,
    updated_at: new Date(),
  }).where(eq(profiles.id, userId)).returning();

  await recordEvent({ intakeId: intake.id, userId, eventType: "user_enabled", channel: "admin" });
  return res.json({ profile });
});

adminLifecycleRouter.post("/users/:id/scheduled-events", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = scheduledEventAdminSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid scheduled event" });
  const [intake] = await db.select().from(userIntakes).where(eq(userIntakes.id, req.params.id)).limit(1);
  if (!intake) return res.status(404).json({ error: "User intake not found" });
  const userId = targetUserIdForIntake(intake);
  if (!userId) return res.status(400).json({ error: "This intake is not linked to a profile yet" });
  const data = parsed.data;
  const [event] = await db.insert(scheduledEvents).values({
    user_id: userId,
    event_type: data.event_type,
    title: data.title,
    description: data.description ?? null,
    channel: data.channel,
    agent_id: data.agent_id ?? null,
    agent_slug: data.agent_slug ?? null,
    room_slug: data.room_slug ?? null,
    scheduled_for: new Date(data.scheduled_for),
    timezone: data.timezone,
    recurrence: data.recurrence,
    status: data.status,
    source: data.source,
    metadata: data.metadata,
    created_by: "admin",
  }).returning();
  await db.insert(scheduledEventLogs).values({ scheduled_event_id: event.id, user_id: userId, action: "created", status: event.status, created_by: "admin" });
  await recordEvent({ intakeId: intake.id, userId, eventType: "scheduled_event_created", channel: "admin", metadata: { event_id: event.id } });
  return res.status(201).json({ event });
});

adminLifecycleRouter.patch("/scheduled-events/:eventId", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = scheduledEventAdminSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid scheduled event update" });
  const data = parsed.data;
  const patch: Partial<typeof scheduledEvents.$inferInsert> = { updated_at: new Date(), updated_by: "admin" };
  if (data.event_type !== undefined) patch.event_type = data.event_type;
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description ?? null;
  if (data.channel !== undefined) patch.channel = data.channel;
  if (data.agent_id !== undefined) patch.agent_id = data.agent_id ?? null;
  if (data.agent_slug !== undefined) patch.agent_slug = data.agent_slug ?? null;
  if (data.room_slug !== undefined) patch.room_slug = data.room_slug ?? null;
  if (data.scheduled_for !== undefined) patch.scheduled_for = new Date(data.scheduled_for);
  if (data.timezone !== undefined) patch.timezone = data.timezone;
  if (data.recurrence !== undefined) patch.recurrence = data.recurrence;
  if (data.status !== undefined) patch.status = data.status;
  if (data.source !== undefined) patch.source = data.source;
  if (data.metadata !== undefined) patch.metadata = data.metadata;
  const [event] = await db.update(scheduledEvents).set(patch).where(eq(scheduledEvents.id, req.params.eventId)).returning();
  if (!event) return res.status(404).json({ error: "Scheduled event not found" });
  await db.insert(scheduledEventLogs).values({ scheduled_event_id: event.id, user_id: event.user_id, action: "updated", status: event.status, created_by: "admin" });
  return res.json({ event });
});

for (const [action, status] of [["pause", "paused"], ["resume", "upcoming"], ["cancel", "cancelled"]] as const) {
  adminLifecycleRouter.post(`/scheduled-events/:eventId/${action}`, async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const [event] = await db.update(scheduledEvents).set({ status, updated_at: new Date(), updated_by: "admin" }).where(eq(scheduledEvents.id, req.params.eventId)).returning();
    if (!event) return res.status(404).json({ error: "Scheduled event not found" });
    await db.insert(scheduledEventLogs).values({ scheduled_event_id: event.id, user_id: event.user_id, action, status, created_by: "admin" });
    return res.json({ event });
  });
}

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
    profile: data.user_type === "family" ? (data.metadata?.elder_profile as Record<string, unknown> | undefined) : data.metadata,
  });

  let familyUserId: string | null = null;
  if (data.user_type === "family") {
    const familyUser = await ensurePasswordlessUser({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      tier: data.tier,
      organizationId: data.organization_id ?? null,
      profile: data.metadata,
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

adminLifecycleRouter.delete("/organizations/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const [org] = await db
    .update(organizations)
    .set({ is_active: false, updated_at: new Date() })
    .where(eq(organizations.id, req.params.id))
    .returning();

  if (!org) return res.status(404).json({ error: "Organization not found" });

  await recordEvent({
    eventType: "organization_archived",
    metadata: { organization_id: org.id, organization_name: org.name },
  });

  return res.json({ organization: org });
});

adminLifecycleRouter.post("/organizations/:id/restore", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const [org] = await db
    .update(organizations)
    .set({ is_active: true, updated_at: new Date() })
    .where(eq(organizations.id, req.params.id))
    .returning();

  if (!org) return res.status(404).json({ error: "Organization not found" });

  await recordEvent({
    eventType: "organization_restored",
    metadata: { organization_id: org.id, organization_name: org.name },
  });

  return res.json({ organization: org });
});

adminLifecycleRouter.post("/organizations/:id/bulk-intakes/preview", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = bulkPreviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid bulk rows" });

  const preview = await buildBulkPreview(req.params.id, parsed.data.rows);
  if ("error" in preview) return res.status(404).json({ error: preview.error });

  return res.json({
    organization: preview.organization,
    rows: preview.rows,
    summary: {
      total: preview.rows.length,
      valid: preview.rows.filter((row) => row.valid).length,
      invalid: preview.rows.filter((row) => !row.valid).length,
    },
  });
});

adminLifecycleRouter.post("/organizations/:id/bulk-intakes/import", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = bulkImportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid bulk rows" });

  const preview = await buildBulkPreview(req.params.id, parsed.data.rows);
  if ("error" in preview) return res.status(404).json({ error: preview.error });

  const imported = [];
  const links = [];
  const skipped = preview.rows.filter((row) => !row.valid);

  for (const row of preview.rows.filter((item) => item.valid)) {
    const values = row.values;
    const requiresConsent = values.user_type === "family";
    const shouldSendLink = parsed.data.send_links && !requiresConsent;
    const user = await ensurePasswordlessUser({
      name: values.name,
      phone: values.phone,
      email: values.email || null,
      tier: values.tier,
      organizationId: preview.organization.id,
      profile: {
        first_name: values.first_name,
        last_name: values.last_name,
        preferred_name: values.preferred_name,
        date_of_birth: values.date_of_birth,
        gender: values.gender,
        phone_number: values.phone,
        whatsapp_number: values.whatsapp,
        email: values.email,
        language: values.language,
        timezone: values.timezone,
      },
    });

    const [intake] = await db.insert(userIntakes).values({
      user_id: user.id,
      elder_user_id: values.user_type === "elder" ? user.id : null,
      family_user_id: values.user_type === "family" ? user.id : null,
      name: values.name,
      phone: values.phone,
      email: values.email || null,
      user_type: values.user_type,
      entry_point: "admin",
      organization_id: preview.organization.id,
      tier: values.tier,
      status: requiresConsent ? "consent_pending" : shouldSendLink ? "link_sent" : "created",
      journey_step: requiresConsent ? "bulk_import_consent_required" : shouldSendLink ? "bulk_import_link_sent" : "bulk_import_created",
      consent_status: requiresConsent ? "pending" : "not_required",
      source_payload: { bulk_import: true, row_number: row.row_number },
      metadata: {
        first_name: values.first_name,
        last_name: values.last_name,
        preferred_name: values.preferred_name,
        date_of_birth: values.date_of_birth,
        gender: values.gender,
        whatsapp_number: values.whatsapp,
        language: values.language,
        timezone: values.timezone,
        import_source: "organization_csv",
      },
      link_sent_at: shouldSendLink ? new Date() : null,
      last_activity_at: new Date(),
    }).returning();

    await recordEvent({
      intakeId: intake.id,
      userId: user.id,
      eventType: "bulk_intake_imported",
      toStatus: intake.status,
      channel: "admin",
      metadata: { organization_id: preview.organization.id, row_number: row.row_number },
    });

    imported.push(intake);

    if (shouldSendLink) {
      const token = randomBytes(32).toString("base64url");
      const destination = values.user_type === "family" ? "/caregiver" : "/onboarding";
      const [link] = await db.insert(accessLinks).values({
        token,
        user_id: user.id,
        intake_id: intake.id,
        organization_id: preview.organization.id,
        link_type: values.tier === "unlimited" ? "unlimited" : "trial",
        tier: values.tier,
        destination,
        target_role: values.user_type,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      }).returning();
      const url = `${publicBaseUrl(req)}/access/${token}`;

      await db.insert(communicationsLog).values({
        intake_id: intake.id,
        user_id: user.id,
        channel: "sms",
        recipient: values.phone,
        purpose: "bulk_send_app_link",
        status: "queued",
        body: `VYVA: here is your secure link to continue: ${url}`,
        metadata: { url, organization_id: preview.organization.id },
      });

      links.push({ intake_id: intake.id, link_id: link.id, url });
    }
  }

  return res.status(201).json({
    imported,
    links,
    skipped,
    summary: {
      imported: imported.length,
      skipped: skipped.length,
      links_queued: links.length,
    },
  });
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
