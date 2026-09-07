import { Router } from "express";
import type { Request, Response } from "express";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { db, pool } from "../db.js";
import { caregiverAlerts, profiles, triageReports, vitalsReadings, medicationAdherence, userMedications, type TriageReportVitalsSnapshot } from "../../shared/schema.js";
import { VITALS_READING_SOURCES, type VitalsReadingSource } from "../../shared/vitalsEvidence.js";
import { unitForSignal, type VitalsSignalKey } from "../../shared/vitalsSignalCatalog.js";
import type { TriageScanResult } from "../../shared/triageScans.js";
import { resolveTriageHandoffAuthorization } from "../../shared/triageHandoffConsent.js";
import { mergeTriageRecommendations, trackTriageEvent } from "../../src/triage/index.js";
import { triggerPreventionPlanRefresh } from "./healthInsightsReport.js";
import { z } from "zod";

const DEMO_USER_ID = "demo-user";
const IS_PROD = process.env.NODE_ENV === "production";
type ReadingSource = VitalsReadingSource;

type SignalReadingRow = {
  signal_type: string;
  value: string | number;
  recorded_at: Date | string;
  source: ReadingSource | string;
  context_tag: string | null;
};

function resolveUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  if (!IS_PROD) return DEMO_USER_ID;
  return null;
}

const router = Router();

function queryRows<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return Array.isArray(result) ? result as T[] : [];
}

// ─── Storage helpers ───────────────────────────────────────────────────────────

let reportsPersistencePromise: Promise<void> | null = null;

async function ensureReportsPersistenceTables() {
  if (!reportsPersistencePromise) {
    reportsPersistencePromise = (async () => {
      await pool.query(`
        create table if not exists triage_reports (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          chief_complaint text not null,
          symptoms text[] not null default '{}',
          urgency text not null,
          recommendations text[] not null default '{}',
          disclaimer text not null default '',
          ai_summary text,
          next_step_label text,
          next_step_level text,
          triage_reasons text[] not null default '{}',
          watch_signs text[] not null default '{}',
          profile_considerations text[] not null default '{}',
          vitals_notes text[] not null default '{}',
          vitals_snapshot jsonb,
          scan_results jsonb not null default '[]'::jsonb,
          scan_notes text[] not null default '{}',
          interpretation text,
          possible_patterns jsonb not null default '[]'::jsonb,
          uncertainty text[] not null default '{}',
          reassessment_window text,
          change_plan_triggers text[] not null default '{}',
          clinical_handoff jsonb,
          bpm integer,
          respiratory_rate integer,
          duration_seconds integer,
          created_at timestamptz not null default now()
        )
      `);

      await pool.query(`
        alter table triage_reports
          add column if not exists symptoms text[] not null default '{}',
          add column if not exists recommendations text[] not null default '{}',
          add column if not exists disclaimer text not null default '',
          add column if not exists ai_summary text,
          add column if not exists next_step_label text,
          add column if not exists next_step_level text,
          add column if not exists triage_reasons text[] not null default '{}',
          add column if not exists watch_signs text[] not null default '{}',
          add column if not exists profile_considerations text[] not null default '{}',
          add column if not exists vitals_notes text[] not null default '{}',
          add column if not exists vitals_snapshot jsonb,
          add column if not exists scan_results jsonb not null default '[]'::jsonb,
          add column if not exists scan_notes text[] not null default '{}',
          add column if not exists interpretation text,
          add column if not exists possible_patterns jsonb not null default '[]'::jsonb,
          add column if not exists uncertainty text[] not null default '{}',
          add column if not exists reassessment_window text,
          add column if not exists change_plan_triggers text[] not null default '{}',
          add column if not exists clinical_handoff jsonb,
          add column if not exists bpm integer,
          add column if not exists respiratory_rate integer,
          add column if not exists duration_seconds integer,
          add column if not exists created_at timestamptz not null default now()
      `);

      await pool.query(`
        create table if not exists vitals_readings (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          bpm integer,
          respiratory_rate integer,
          metric_type text,
          value text,
          recorded_at timestamptz not null default now()
        )
      `);

      await pool.query(`
        alter table vitals_readings
          add column if not exists bpm integer,
          add column if not exists respiratory_rate integer,
          add column if not exists metric_type text,
          add column if not exists value text,
          add column if not exists recorded_at timestamptz not null default now()
      `);

      await pool.query(`create index if not exists triage_reports_user_id_idx on triage_reports (user_id)`);
      await pool.query(`create index if not exists vitals_readings_user_id_idx on vitals_readings (user_id)`);
    })().catch((err) => {
      reportsPersistencePromise = null;
      throw err;
    });
  }

  return reportsPersistencePromise;
}

export async function saveTriageReport(params: {
  userId: string;
  chief_complaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  ai_summary?: string | null;
  next_step_label?: string | null;
  next_step_level?: string | null;
  triage_reasons?: string[];
  watch_signs?: string[];
  profile_considerations?: string[];
  vitals_notes?: string[];
  vitals_snapshot?: TriageReportVitalsSnapshot | null;
  scan_results?: TriageScanResult[];
  scan_notes?: string[];
  interpretation?: string | null;
  possible_patterns?: Array<{ id: string; label: string; explanation: string; supportingAnswers: string[]; clarifyingSigns: string[] }>;
  uncertainty?: string[];
  reassessment_window?: string | null;
  change_plan_triggers?: string[];
  clinical_handoff?: { summary: string; keyPoints: string[]; questions: string[] } | null;
  bpm?: number | null;
  respiratory_rate?: number | null;
  duration_seconds?: number | null;
}) {
  await ensureReportsPersistenceTables();
  const [row] = await db.insert(triageReports).values({
    user_id: params.userId,
    chief_complaint: params.chief_complaint,
    symptoms: params.symptoms,
    urgency: params.urgency,
    recommendations: params.recommendations,
    disclaimer: params.disclaimer,
    ai_summary: params.ai_summary ?? null,
    next_step_label: params.next_step_label ?? null,
    next_step_level: params.next_step_level ?? null,
    triage_reasons: params.triage_reasons ?? [],
    watch_signs: params.watch_signs ?? [],
    profile_considerations: params.profile_considerations ?? [],
    vitals_notes: params.vitals_notes ?? [],
    vitals_snapshot: params.vitals_snapshot ?? null,
    scan_results: params.scan_results ?? [],
    scan_notes: params.scan_notes ?? [],
    interpretation: params.interpretation ?? null,
    possible_patterns: params.possible_patterns ?? [],
    uncertainty: params.uncertainty ?? [],
    reassessment_window: params.reassessment_window ?? null,
    change_plan_triggers: params.change_plan_triggers ?? [],
    clinical_handoff: params.clinical_handoff ?? null,
    bpm: params.bpm ?? null,
    respiratory_rate: params.respiratory_rate ?? null,
    duration_seconds: params.duration_seconds ?? null,
  }).returning();
  if (params.urgency !== "monitor") {
    void triggerPreventionPlanRefresh({
      userId: params.userId,
      triggerType: "symptom_logged",
      triggerData: {
        urgency: params.urgency,
        symptom_description: params.chief_complaint,
        triage_report_id: row.id,
      },
    }).catch((err) => console.error("[reports prevention refresh]", err));
  }
  return row;
}

function normalizeTriageReportRecommendations<T extends { recommendations?: string[] | null }>(report: T | null): T | null {
  if (!report) return report;
  return {
    ...report,
    recommendations: mergeTriageRecommendations(report.recommendations ?? []),
  };
}

export async function recordTriageReportHandoff(params: {
  userId: string;
  chief_complaint: string;
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  shareWithSavedContacts?: boolean;
  requestStaffReview?: boolean;
}): Promise<{ sentTo: string[]; caregiverEscalationTriggered: boolean; staffReviewRequested: boolean }> {
  const { shareWithSavedContacts, staffReviewRequested } = resolveTriageHandoffAuthorization(params);

  // Saving a symptom report must remain private by default. Contact sharing and
  // staff review are separate, confirmation-gated actions.
  if (!shareWithSavedContacts && !staffReviewRequested) {
    return { sentTo: [], caregiverEscalationTriggered: false, staffReviewRequested: false };
  }

  const [profile] = await db
    .select({
      caregiver_name: profiles.caregiver_name,
      caregiver_contact: profiles.caregiver_contact,
      gp_name: profiles.gp_name,
      gp_phone: profiles.gp_phone,
      gp_email: profiles.gp_email,
    })
    .from(profiles)
    .where(eq(profiles.id, params.userId))
    .limit(1);

  const sentTo = shareWithSavedContacts
    ? [
        profile?.gp_name || profile?.gp_phone || profile?.gp_email ? profile.gp_name || "doctor" : "",
        profile?.caregiver_name || profile?.caregiver_contact ? profile.caregiver_name || "caregiver" : "",
      ].filter(Boolean)
    : [];

  if (sentTo.length > 0) {
    await db.insert(caregiverAlerts).values({
      user_id: params.userId,
      alert_type: "triage_report",
      severity: params.urgency,
      message: [
        `Symptom report: ${params.chief_complaint}`,
        params.recommendations.length ? `Next: ${params.recommendations[0]}` : "",
      ].filter(Boolean).join("\n"),
      sent_to: sentTo,
    });
  }

  if (staffReviewRequested) {
    await db.insert(caregiverAlerts).values({
      user_id: params.userId,
      alert_type: "triage_staff_review",
      severity: params.urgency,
      message: [
        `Staff review requested: ${params.chief_complaint}`,
        params.recommendations.length ? `Next: ${params.recommendations[0]}` : "",
        sentTo.length ? `Also shared with: ${sentTo.join(", ")}` : "No doctor or caregiver contact was configured.",
      ].filter(Boolean).join("\n"),
      sent_to: ["staff"],
    });
  }

  return {
    sentTo,
    caregiverEscalationTriggered: shareWithSavedContacts && Boolean(profile?.caregiver_name || profile?.caregiver_contact),
    staffReviewRequested,
  };
}

async function saveVitalsReading(params: {
  userId: string;
  bpm: number;
  respiratory_rate?: number | null;
  source?: ReadingSource;
}) {
  await ensureReportsPersistenceTables();
  const [row] = await db.insert(vitalsReadings).values({
    user_id: params.userId,
    bpm: params.bpm,
    respiratory_rate: params.respiratory_rate ?? null,
  }).returning();

  mirrorVitalsScanToEngine({
    userId: params.userId,
    bpm: params.bpm,
    respiratoryRate: params.respiratory_rate ?? null,
    source: params.source ?? "phone_estimate",
  }).catch((err) => console.error("[reports/vitals mirror]", err));

  return row;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function mirrorVitalsScanToEngine(params: {
  userId: string;
  bpm: number;
  respiratoryRate?: number | null;
  source: ReadingSource;
}) {
  if (!looksLikeUuid(params.userId)) return;

  const entries = [
    { signalType: "resting_hr_bpm" as VitalsSignalKey, value: params.bpm },
    ...(params.respiratoryRate != null ? [{ signalType: "respiratory_rate" as VitalsSignalKey, value: params.respiratoryRate }] : []),
  ];

  for (const entry of entries) {
    await db.execute(sql`
      INSERT INTO vyva_signal_readings (
        user_id,
        signal_type,
        value,
        source,
        capture_method,
        unit,
        context_tag
      )
      VALUES (
        ${params.userId},
        ${entry.signalType},
        ${entry.value},
        ${params.source},
        'phone_camera',
        ${unitForSignal(entry.signalType)},
        'camera_scan'
      )
    `);
  }
}

async function getLatestTriageReport(userId: string) {
  await ensureReportsPersistenceTables();
  const rows = await db.select().from(triageReports)
    .where(eq(triageReports.user_id, userId))
    .orderBy(desc(triageReports.created_at))
    .limit(1);
  return normalizeTriageReportRecommendations(rows[0] ?? null);
}

async function getLatestVitalsReading(userId: string) {
  await ensureReportsPersistenceTables();
  const rows = await db.select().from(vitalsReadings)
    .where(eq(vitalsReadings.user_id, userId))
    .orderBy(desc(vitalsReadings.recorded_at))
    .limit(1);
  return rows[0] ?? null;
}

async function getLatestSignalReadings(userId: string): Promise<SignalReadingRow[]> {
  if (!looksLikeUuid(userId)) return [];
  const result = await db.execute(sql`
    SELECT signal_type, value, recorded_at, source, context_tag
    FROM (
      SELECT
        signal_type,
        value,
        recorded_at,
        source,
        context_tag,
        row_number() OVER (PARTITION BY signal_type ORDER BY recorded_at DESC) AS rn
      FROM vyva_signal_readings
      WHERE user_id = ${userId}
    ) ranked
    WHERE rn = 1
    ORDER BY recorded_at DESC
    LIMIT 12
  `);
  return queryRows<SignalReadingRow>(result);
}

async function getSignalHistory(userId: string, days = 30): Promise<SignalReadingRow[]> {
  if (!looksLikeUuid(userId)) return [];
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const result = await db.execute(sql`
    SELECT signal_type, value, recorded_at, source, context_tag
    FROM vyva_signal_readings
    WHERE user_id = ${userId}
      AND recorded_at >= ${cutoff}
    ORDER BY recorded_at ASC
    LIMIT 120
  `);
  return queryRows<SignalReadingRow>(result);
}

async function getVitalsHistory(userId: string, days = 30) {
  await ensureReportsPersistenceTables();
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

type TodayMedSummary = Awaited<ReturnType<typeof getTodayMedSummary>>;

const emptyTodayMedSummary: TodayMedSummary = { taken: 0, total: 0, adherencePct: null };

type ReportsSummaryLoaders = {
  latestTriage: (userId: string) => Promise<Awaited<ReturnType<typeof getLatestTriageReport>>>;
  latestVitals: (userId: string) => Promise<Awaited<ReturnType<typeof getLatestVitalsReading>>>;
  todayMeds: (userId: string) => Promise<Awaited<ReturnType<typeof getTodayMedSummary>>>;
};

const defaultReportsSummaryLoaders: ReportsSummaryLoaders = {
  latestTriage: getLatestTriageReport,
  latestVitals: getLatestVitalsReading,
  todayMeds: getTodayMedSummary,
};

async function safeReportPart<T>(label: string, fallback: T, loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (err) {
    console.warn(`[reports] ${label} unavailable`, err);
    return fallback;
  }
}

export async function loadReportsSummary(userId: string, loaders: ReportsSummaryLoaders = defaultReportsSummaryLoaders) {
  const [latestTriage, latestVitals, todayMeds] = await Promise.all([
    safeReportPart("latest triage", null, () => loaders.latestTriage(userId)),
    safeReportPart("latest vitals", null, () => loaders.latestVitals(userId)),
    safeReportPart("today medication summary", emptyTodayMedSummary, () => loaders.todayMeds(userId)),
  ]);

  return { latestTriage: normalizeTriageReportRecommendations(latestTriage), latestVitals, todayMeds };
}

// ─── POST /triage ─────────────────────────────────────────────────────────────
const triageScanResultSchema = z.object({
  id: z.string(),
  type: z.enum(["vitals", "wound_photo", "urine_photo", "stool_photo"]),
  label: z.string(),
  concernLevel: z.enum(["normal", "watch", "urgent"]),
  summary: z.string(),
  findings: z.array(z.string()).default([]),
  capturedAt: z.string(),
  values: z.object({
    pulseBpm: z.number().nullable().optional(),
    respiratoryRate: z.number().nullable().optional(),
  }).optional(),
}).passthrough();

const triageSchema = z.object({
  chief_complaint:   z.string(),
  symptoms:          z.array(z.string()).default([]),
  urgency:           z.enum(["urgent", "routine", "monitor"]),
  recommendations:   z.array(z.string()).default([]),
  disclaimer:        z.string().default(""),
  ai_summary:        z.string().nullable().optional(),
  next_step_label:   z.string().nullable().optional(),
  next_step_level:   z.enum(["emergency", "doctor_today", "doctor_24_48", "monitor"]).nullable().optional(),
  triage_reasons:    z.array(z.string()).default([]),
  watch_signs:       z.array(z.string()).default([]),
  profile_considerations: z.array(z.string()).default([]),
  vitals_notes:      z.array(z.string()).default([]),
  vitals_snapshot: z.object({
    capturedAt: z.string(),
    readings: z.array(z.object({
      key: z.enum(["bpm", "respiratoryRate", "oxygenSaturation", "temperatureC", "systolicBp", "diastolicBp", "glucoseMgdl", "painScore", "energyLevel"]),
      value: z.number(),
      unit: z.string(),
      source: z.enum(VITALS_READING_SOURCES),
      affectsTriage: z.boolean(),
    })),
  }).nullable().optional(),
  scan_results:      z.array(triageScanResultSchema).default([]),
  scan_notes:        z.array(z.string()).default([]),
  interpretation:    z.string().nullable().optional(),
  possible_patterns: z.array(z.object({
    id: z.string(),
    label: z.string(),
    explanation: z.string(),
    supportingAnswers: z.array(z.string()).default([]),
    clarifyingSigns: z.array(z.string()).default([]),
  })).default([]),
  uncertainty:       z.array(z.string()).default([]),
  reassessment_window: z.string().nullable().optional(),
  change_plan_triggers: z.array(z.string()).default([]),
  clinical_handoff: z.object({
    summary: z.string(),
    keyPoints: z.array(z.string()).default([]),
    questions: z.array(z.string()).default([]),
  }).nullable().optional(),
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
    const recommendations = mergeTriageRecommendations(parsed.data.recommendations);
    const row = await saveTriageReport({ userId, ...parsed.data, recommendations });
    const handoff = await recordTriageReportHandoff({
      userId,
      chief_complaint: parsed.data.chief_complaint,
      urgency: parsed.data.urgency,
      recommendations,
    }).catch((err) => {
      console.error("[reports/triage handoff]", err);
      return { sentTo: [], caregiverEscalationTriggered: false, staffReviewRequested: false };
    });
    if (handoff.caregiverEscalationTriggered) {
      trackTriageEvent("caregiver_escalation_triggered", {
        urgency: parsed.data.urgency,
        trigger_source: "triage_report_handoff",
        caregiver_escalation_triggered: true,
      });
    }
    return res.status(201).json({
      ...row,
      sent_to: handoff.sentTo,
      staff_review_requested: handoff.staffReviewRequested,
    });
  } catch (err) {
    console.error("[reports/triage POST]", err);
    return res.status(500).json({ error: "Failed to save triage report" });
  }
});

// ─── POST /vitals ─────────────────────────────────────────────────────────────
const vitalsSchema = z.object({
  bpm:              z.number().int().min(30).max(250),
  respiratory_rate: z.number().int().min(6).max(60).nullable().optional(),
  source:           z.enum(VITALS_READING_SOURCES).default("phone_estimate"),
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
    const [summary, latestSignals] = await Promise.all([
      loadReportsSummary(userId),
      getLatestSignalReadings(userId).catch((err) => {
        console.warn("[reports/summary signals]", err);
        return [];
      }),
    ]);
    return res.json({ ...summary, latestSignals });
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
    const [readings, signalReadings] = await Promise.all([
      getVitalsHistory(userId, 30),
      getSignalHistory(userId, 30).catch((err) => {
        console.warn("[reports/vitals/history signals]", err);
        return [];
      }),
    ]);
    return res.json({ readings, signalReadings });
  } catch (err) {
    console.warn("[reports/vitals/history GET] unavailable", err);
    return res.json({ readings: [] });
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
    return res.json(normalizeTriageReportRecommendations(row));
  } catch (err) {
    console.error("[reports/triage/:id GET]", err);
    return res.status(500).json({ error: "Failed to fetch report" });
  }
});

export default router;
