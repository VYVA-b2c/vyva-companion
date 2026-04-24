import { Router } from "express";
import type { Request, Response } from "express";
import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "../db.js";
import { triageReports, vitalsReadings, medicationAdherence, userMedications } from "../../shared/schema.js";
import { z } from "zod";

const DEMO_USER_ID = "demo-user";
const IS_PROD = process.env.NODE_ENV === "production";

function resolveUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  if (!IS_PROD) return DEMO_USER_ID;
  return null;
}

const router = Router();

// ─── Storage helpers ───────────────────────────────────────────────────────────

async function saveTriageReport(params: {
  userId: string;
  chief_complaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  ai_summary?: string | null;
  bpm?: number | null;
  respiratory_rate?: number | null;
  duration_seconds?: number | null;
}) {
  const [row] = await db.insert(triageReports).values({
    user_id: params.userId,
    chief_complaint: params.chief_complaint,
    symptoms: params.symptoms,
    urgency: params.urgency,
    recommendations: params.recommendations,
    disclaimer: params.disclaimer,
    ai_summary: params.ai_summary ?? null,
    bpm: params.bpm ?? null,
    respiratory_rate: params.respiratory_rate ?? null,
    duration_seconds: params.duration_seconds ?? null,
  }).returning();
  return row;
}

async function saveVitalsReading(params: {
  userId: string;
  bpm: number;
  respiratory_rate?: number | null;
}) {
  const [row] = await db.insert(vitalsReadings).values({
    user_id: params.userId,
    bpm: params.bpm,
    respiratory_rate: params.respiratory_rate ?? null,
  }).returning();
  return row;
}

async function getLatestTriageReport(userId: string) {
  const rows = await db.select().from(triageReports)
    .where(eq(triageReports.user_id, userId))
    .orderBy(desc(triageReports.created_at))
    .limit(1);
  return rows[0] ?? null;
}

async function getLatestVitalsReading(userId: string) {
  const rows = await db.select().from(vitalsReadings)
    .where(eq(vitalsReadings.user_id, userId))
    .orderBy(desc(vitalsReadings.recorded_at))
    .limit(1);
  return rows[0] ?? null;
}

async function getVitalsHistory(userId: string, days = 30) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return db.select().from(vitalsReadings)
    .where(and(
      eq(vitalsReadings.user_id, userId),
      gte(vitalsReadings.recorded_at, cutoff),
    ))
    .orderBy(vitalsReadings.recorded_at)
    .limit(50);
}

async function getTodayMedSummary(userId: string) {
  const todayStart = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const [todayLogs, activeMeds] = await Promise.all([
    db.select().from(medicationAdherence)
      .where(and(
        eq(medicationAdherence.user_id, userId),
        gte(medicationAdherence.created_at, todayStart),
      )),
    db.select().from(userMedications)
      .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
  ]);
  const taken = todayLogs.filter(l => l.status === "taken").length;
  const total = activeMeds.length;
  const adherencePct = total > 0 ? Math.round((taken / total) * 100) : null;
  return { taken, total, adherencePct };
}

// ─── POST /triage ─────────────────────────────────────────────────────────────
const triageSchema = z.object({
  chief_complaint:   z.string(),
  symptoms:          z.array(z.string()).default([]),
  urgency:           z.enum(["urgent", "routine", "monitor"]),
  recommendations:   z.array(z.string()).default([]),
  disclaimer:        z.string().default(""),
  ai_summary:        z.string().nullable().optional(),
  bpm:               z.number().int().nullable().optional(),
  respiratory_rate:  z.number().int().nullable().optional(),
  duration_seconds:  z.number().int().nonnegative().nullable().optional(),
});

router.post("/triage", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = triageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }
  try {
    const row = await saveTriageReport({ userId, ...parsed.data });
    return res.status(201).json(row);
  } catch (err) {
    console.error("[reports/triage POST]", err);
    return res.status(500).json({ error: "Failed to save triage report" });
  }
});

// ─── POST /vitals ─────────────────────────────────────────────────────────────
const vitalsSchema = z.object({
  bpm:              z.number().int().min(30).max(250),
  respiratory_rate: z.number().int().min(6).max(60).nullable().optional(),
});

router.post("/vitals", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = vitalsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }
  try {
    const row = await saveVitalsReading({ userId, ...parsed.data });
    return res.status(201).json(row);
  } catch (err) {
    console.error("[reports/vitals POST]", err);
    return res.status(500).json({ error: "Failed to save vitals reading" });
  }
});

// ─── GET /summary ─────────────────────────────────────────────────────────────
router.get("/summary", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  try {
    const [latestTriage, latestVitals, todayMeds] = await Promise.all([
      getLatestTriageReport(userId),
      getLatestVitalsReading(userId),
      getTodayMedSummary(userId),
    ]);
    return res.json({ latestTriage, latestVitals, todayMeds });
  } catch (err) {
    console.error("[reports/summary GET]", err);
    return res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// ─── GET /vitals/history ─────────────────────────────────────────────────────
router.get("/vitals/history", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  try {
    const readings = await getVitalsHistory(userId, 30);
    return res.json({ readings });
  } catch (err) {
    console.error("[reports/vitals/history GET]", err);
    return res.status(500).json({ error: "Failed to fetch vitals history" });
  }
});

// ─── GET /triage/:id ─────────────────────────────────────────────────────────
router.get("/triage/:id", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const { id } = req.params;
  try {
    const [row] = await db.select().from(triageReports)
      .where(and(eq(triageReports.id, id), eq(triageReports.user_id, userId)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    console.error("[reports/triage/:id GET]", err);
    return res.status(500).json({ error: "Failed to fetch report" });
  }
});

export default router;
