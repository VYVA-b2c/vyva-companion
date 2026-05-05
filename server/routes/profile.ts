import { Router } from "express";
import type { Request, Response } from "express";
import { desc, eq, count } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import {
  profiles,
  scheduledEventLogs,
  scheduledEvents,
  teamInvitations,
  triageReports,
  userMedications,
  vitalsReadings,
} from "../../shared/schema.js";
import { mergeIdentityGender, readProfileGender } from "../lib/userPersonalization.js";

const DEMO_USER_ID = "demo-user";
const IS_PROD = process.env.NODE_ENV === "production";

const router = Router();

/**
 * Returns the authenticated user's ID if a valid JWT was present (set by
 * authMiddleware), or the demo-user fallback in non-production environments.
 * In production, unauthenticated callers receive null (→ 401) to prevent
 * unintended reads/writes on shared demo-profile data.
 */
function resolveUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  if (!IS_PROD) return DEMO_USER_ID;
  return null;
}

const profileBodySchema = z.object({
  firstName:       z.string().min(1).max(100),
  lastName:        z.string().max(100).optional().default(""),
  preferredName:   z.string().max(100).optional().default(""),
  dateOfBirth:     z.string().max(50).optional().or(z.literal("")).optional(),
  gender:          z.string().max(40).optional().default("prefer_not"),
  email:           z.string().email().optional().or(z.literal("")).optional(),
  phone:           z.string().trim().min(1, "Phone is required").max(50),
  country:         z.string().max(100).optional().default(""),
  timezone:        z.string().max(100).optional().default(""),
  language:        z.string().max(50).optional().default("en"),
  street:          z.string().max(200).optional().default(""),
  cityState:       z.string().max(200).optional().default(""),
  postalCode:      z.string().max(30).optional().default(""),
  caregiverName:   z.string().max(150).optional().default(""),
  caregiverContact: z.string().max(50).optional().default(""),
});

const scheduledEventBodySchema = z.object({
  event_type: z.string().min(1).default("custom"),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  channel: z.string().min(1).default("app"),
  agent_id: z.string().optional().nullable(),
  agent_slug: z.string().optional().nullable(),
  room_slug: z.string().optional().nullable(),
  scheduled_for: z.string().min(1),
  timezone: z.string().min(1).default("Europe/Madrid"),
  recurrence: z.string().min(1).default("none"),
  status: z.string().min(1).default("upcoming"),
  source: z.string().min(1).default("app"),
  metadata: z.record(z.unknown()).optional().default({}),
});

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
      source_session_id: null,
      metadata: { medication_id: med.id, read_only: true },
      created_at: med.created_at,
      updated_at: med.created_at,
      read_only: true,
    }));
  });
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(asString).filter(Boolean)
    : [];
}

function joinList(values: string[], fallback = "Not recorded"): string {
  return values.length > 0 ? values.slice(0, 10).join(", ") : fallback;
}

function addLine(lines: string[], label: string, value: string | null | undefined) {
  const clean = value?.trim();
  if (clean) lines.push(`${label}: ${clean}`);
}

function section(consent: unknown, key: string): JsonRecord {
  return asRecord(asRecord(consent)[key]);
}

function buildDoctorHealthContext(input: {
  profile: typeof profiles.$inferSelect;
  medications: Array<typeof userMedications.$inferSelect>;
  careTeam: Array<typeof teamInvitations.$inferSelect>;
  latestReports: Array<typeof triageReports.$inferSelect>;
  latestVitals: Array<typeof vitalsReadings.$inferSelect>;
}) {
  const { profile, medications, careTeam, latestReports, latestVitals } = input;
  const consent = asRecord(profile.data_sharing_consent);
  const conditions = asStringArray(section(consent, "conditions").health_conditions);
  const hobbies = asStringArray(section(consent, "hobbies").hobbies);
  const devices = asStringArray(section(consent, "devices").devices);
  const dietaryNotes = asString(section(consent, "diet").dietary_notes);
  const dietaryPreferences = asStringArray(section(consent, "diet").dietary_preferences);
  const emergency = section(consent, "emergency");

  const activeMedicationLines = medications.map((med) => {
    const details = [med.dosage, med.frequency, med.scheduled_times?.join("/")].filter(Boolean);
    return details.length > 0
      ? `${med.medication_name} (${details.join(", ")})`
      : med.medication_name;
  });

  const careTeamLines = careTeam.map((member) =>
    [
      member.invitee_name,
      member.relationship,
      member.role,
      member.status ? `status ${member.status}` : "",
    ].filter(Boolean).join(" - "),
  );

  const latestReportLines = latestReports.map((report) =>
    [
      report.chief_complaint,
      report.urgency ? `urgency ${report.urgency}` : "",
      report.symptoms?.length ? `symptoms ${report.symptoms.join(", ")}` : "",
    ].filter(Boolean).join(" - "),
  );

  const latestVitalLines = latestVitals.map((vital) =>
    [
      vital.metric_type ?? "vital",
      vital.value ?? [vital.bpm ? `${vital.bpm} bpm` : "", vital.respiratory_rate ? `${vital.respiratory_rate} breaths/min` : ""].filter(Boolean).join(", "),
    ].filter(Boolean).join(": "),
  );

  const lines: string[] = [];
  addLine(lines, "Name", profile.preferred_name || profile.full_name || "Not recorded");
  addLine(lines, "Date of birth", profile.date_of_birth);
  addLine(lines, "Language", profile.language);
  addLine(lines, "Timezone", profile.timezone);
  addLine(lines, "Phone", profile.phone_number);
  addLine(lines, "Location", [profile.city, profile.region, profile.country_code].filter(Boolean).join(", "));
  addLine(lines, "Health conditions", joinList(conditions));
  addLine(lines, "Known allergies", joinList(profile.known_allergies ?? []));
  addLine(lines, "Active medications", joinList(activeMedicationLines));
  addLine(lines, "GP", [profile.gp_name, profile.gp_phone, profile.gp_address].filter(Boolean).join(" - ") || "Not recorded");
  addLine(lines, "Emergency contact", [asString(emergency.emergency_name), asString(emergency.emergency_phone), asString(emergency.emergency_role)].filter(Boolean).join(" - "));
  addLine(lines, "Care team", joinList(careTeamLines));
  addLine(lines, "Devices", joinList(devices));
  addLine(lines, "Diet", [dietaryNotes, dietaryPreferences.length ? dietaryPreferences.join(", ") : ""].filter(Boolean).join(" - "));
  addLine(lines, "Hobbies/interests", joinList(hobbies));
  addLine(lines, "Recent symptom reports", joinList(latestReportLines));
  addLine(lines, "Recent vitals", joinList(latestVitalLines));
  addLine(lines, "Context generated", new Date().toISOString());

  return {
    health_context: lines.join("\n").slice(0, 6000),
    health_conditions: joinList(conditions, ""),
    allergies: joinList(profile.known_allergies ?? [], ""),
    medications: joinList(activeMedicationLines, ""),
    gp_details: [profile.gp_name, profile.gp_phone, profile.gp_address].filter(Boolean).join(" - "),
    care_team: joinList(careTeamLines, ""),
    emergency_contact: [asString(emergency.emergency_name), asString(emergency.emergency_phone), asString(emergency.emergency_role)].filter(Boolean).join(" - "),
    recent_health_events: joinList([...latestReportLines, ...latestVitalLines], ""),
  };
}

router.get("/", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!rows[0]) {
      return res.json(null);
    }

    const p = rows[0];
    const nameParts = (p.full_name ?? "").trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName  = nameParts.slice(1).join(" ");

    return res.json({
      firstName,
      lastName,
      preferredName:    p.preferred_name ?? "",
      dateOfBirth:      p.date_of_birth ?? "",
      gender:           readProfileGender(p.data_sharing_consent),
      email:            p.email ?? "",
      phone:            p.phone_number ?? "",
      country:          p.country_code ?? "",
      timezone:         p.timezone ?? "",
      language:         p.language ?? "en",
      street:           p.address_line_1 ?? "",
      cityState:        p.city ?? "",
      postalCode:       p.postcode ?? "",
      caregiverName:    p.caregiver_name ?? "",
      caregiverContact: p.caregiver_contact ?? "",
      avatarUrl:        p.avatar_url ?? null,
    });
  } catch (err) {
    console.error("[profile GET]", err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.get("/doctor-context", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [profileRows, medications, careTeam, latestReports, latestVitals] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, userId)).limit(1),
      db
        .select()
        .from(userMedications)
        .where(eq(userMedications.user_id, userId))
        .limit(20),
      db
        .select()
        .from(teamInvitations)
        .where(eq(teamInvitations.senior_id, userId))
        .orderBy(desc(teamInvitations.created_at))
        .limit(10),
      db
        .select()
        .from(triageReports)
        .where(eq(triageReports.user_id, userId))
        .orderBy(desc(triageReports.created_at))
        .limit(3),
      db
        .select()
        .from(vitalsReadings)
        .where(eq(vitalsReadings.user_id, userId))
        .orderBy(desc(vitalsReadings.recorded_at))
        .limit(3),
    ]);

    const profile = profileRows[0];
    if (!profile) {
      return res.json({
        dynamicVariables: {
          health_context: "No health profile has been recorded for this user yet.",
        },
      });
    }

    const activeMedications = medications.filter((med) => med.active);

    return res.json({
      dynamicVariables: buildDoctorHealthContext({
        profile,
        medications: activeMedications,
        careTeam,
        latestReports,
        latestVitals,
      }),
    });
  } catch (err) {
    console.error("[profile GET /doctor-context]", err);
    return res.status(500).json({ error: "Failed to fetch doctor context" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = profileBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const d = parsed.data;
  const full_name = [d.firstName, d.lastName].filter(Boolean).join(" ").trim();

  try {
    const existingRows = await db
      .select({ data_sharing_consent: profiles.data_sharing_consent })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    const dataSharingConsent = mergeIdentityGender(existingRows[0]?.data_sharing_consent, d.gender);

    await db
      .insert(profiles)
      .values({
        id:               userId,
        full_name,
        preferred_name:   d.preferredName || null,
        date_of_birth:    d.dateOfBirth || null,
        email:            d.email || null,
        phone_number:     d.phone || null,
        country_code:     d.country || null,
        timezone:         d.timezone || "Europe/Madrid",
        language:         d.language || "en",
        address_line_1:   d.street || null,
        city:             d.cityState || null,
        postcode:         d.postalCode || null,
        caregiver_name:   d.caregiverName || null,
        caregiver_contact: d.caregiverContact || null,
        data_sharing_consent: dataSharingConsent,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          full_name,
          preferred_name:   d.preferredName || null,
          date_of_birth:    d.dateOfBirth || null,
          email:            d.email || null,
          phone_number:     d.phone || null,
          country_code:     d.country || null,
          timezone:         d.timezone || "Europe/Madrid",
          language:         d.language || "en",
          address_line_1:   d.street || null,
          city:             d.cityState || null,
          postcode:         d.postalCode || null,
          caregiver_name:   d.caregiverName || null,
          caregiver_contact: d.caregiverContact || null,
          data_sharing_consent: dataSharingConsent,
          updated_at:       new Date(),
        },
      });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[profile POST]", err);
    return res.status(500).json({ error: "Failed to save profile" });
  }
});

// PATCH /avatar — update the current user's profile photo (data URL or null)
const avatarBodySchema = z.object({
  avatarUrl: z.string().max(2_000_000).nullable(),
});

router.patch("/avatar", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = avatarBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    await db
      .insert(profiles)
      .values({ id: userId, avatar_url: parsed.data.avatarUrl })
      .onConflictDoUpdate({
        target: profiles.id,
        set: { avatar_url: parsed.data.avatarUrl, updated_at: new Date() },
      });
    return res.json({ ok: true, avatarUrl: parsed.data.avatarUrl });
  } catch (err) {
    console.error("[profile PATCH /avatar]", err);
    return res.status(500).json({ error: "Failed to update avatar" });
  }
});

router.get("/personalisation", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [profileRows, medCountRows] = await Promise.all([
      db.select({ data_sharing_consent: profiles.data_sharing_consent })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1),
      db.select({ count: count() })
        .from(userMedications)
        .where(eq(userMedications.user_id, userId)),
    ]);

    const consent = (profileRows[0]?.data_sharing_consent ?? {}) as Record<string, unknown>;
    const conditionsSection = consent["conditions"] as { health_conditions?: string[] } | undefined;
    const hobbiesSection = consent["hobbies"] as { hobbies?: string[] } | undefined;

    return res.json({
      conditions: conditionsSection?.health_conditions ?? [],
      hobbies: hobbiesSection?.hobbies ?? [],
      hasMedications: (medCountRows[0]?.count ?? 0) > 0,
    });
  } catch (err) {
    console.error("[profile GET /personalisation]", err);
    return res.status(500).json({ error: "Failed to fetch personalisation data" });
  }
});

router.get("/scheduled-events", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [events, medications] = await Promise.all([
      db.select().from(scheduledEvents).where(eq(scheduledEvents.user_id, userId)).orderBy(desc(scheduledEvents.scheduled_for)).limit(100),
      db.select().from(userMedications).where(eq(userMedications.user_id, userId)).limit(100),
    ]);

    return res.json({ events: [...events, ...medicationEventsFromRows(medications)] });
  } catch (err) {
    console.error("[profile GET /scheduled-events]", err);
    return res.status(500).json({ error: "Failed to fetch scheduled events" });
  }
});

router.post("/scheduled-events", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = scheduledEventBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid scheduled event" });

  try {
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
      created_by: userId,
    }).returning();
    await db.insert(scheduledEventLogs).values({ scheduled_event_id: event.id, user_id: userId, action: "created", status: event.status, created_by: userId });
    return res.status(201).json({ event });
  } catch (err) {
    console.error("[profile POST /scheduled-events]", err);
    return res.status(500).json({ error: "Failed to create scheduled event" });
  }
});

router.patch("/scheduled-events/:id", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = scheduledEventBodySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid scheduled event update" });
  if (req.params.id.startsWith("medication:")) return res.status(400).json({ error: "Medication reminders are edited from Medications" });

  const data = parsed.data;
  const patch: Partial<typeof scheduledEvents.$inferInsert> = { updated_at: new Date(), updated_by: userId };
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

  try {
    const [event] = await db.update(scheduledEvents).set(patch).where(eq(scheduledEvents.id, req.params.id)).returning();
    if (!event || event.user_id !== userId) return res.status(404).json({ error: "Scheduled event not found" });
    await db.insert(scheduledEventLogs).values({ scheduled_event_id: event.id, user_id: userId, action: "updated", status: event.status, created_by: userId });
    return res.json({ event });
  } catch (err) {
    console.error("[profile PATCH /scheduled-events]", err);
    return res.status(500).json({ error: "Failed to update scheduled event" });
  }
});

for (const [action, status] of [["pause", "paused"], ["resume", "upcoming"], ["cancel", "cancelled"]] as const) {
  router.post(`/scheduled-events/:id/${action}`, async (req: Request, res: Response) => {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    if (req.params.id.startsWith("medication:")) return res.status(400).json({ error: "Medication reminders are edited from Medications" });
    const [event] = await db.update(scheduledEvents).set({ status, updated_at: new Date(), updated_by: userId }).where(eq(scheduledEvents.id, req.params.id)).returning();
    if (!event || event.user_id !== userId) return res.status(404).json({ error: "Scheduled event not found" });
    await db.insert(scheduledEventLogs).values({ scheduled_event_id: event.id, user_id: userId, action, status, created_by: userId });
    return res.json({ event });
  });
}

export default router;
