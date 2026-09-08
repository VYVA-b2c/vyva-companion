import { Router } from "express";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../db.js";
import { insightOutcomes, triageReports } from "../../shared/schema.js";
import { triggerPreventionPlanRefresh } from "./healthInsightsReport.js";

const router = Router();

const symptomLogSchema = z.object({
  userId: z.string().optional(),
  triage_report_id: z.string().uuid().nullable().optional(),
  symptom_description: z.string().trim().min(1).max(1000),
  severity: z.enum(["mild", "moderate", "severe"]),
  check_completed: z.boolean().default(true),
  vyva_recommendation: z.string().trim().max(1500).optional().default(""),
  escalated_to_caregiver: z.boolean().default(false),
});

let insightOutcomesTablePromise: Promise<void> | null = null;

async function ensureInsightOutcomesTable() {
  if (!insightOutcomesTablePromise) {
    insightOutcomesTablePromise = (async () => {
      await pool.query(`
        create table if not exists insight_outcomes (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          triage_report_id uuid,
          delivered_surface text not null,
          action_taken text not null default 'none',
          tier_at_generation integer not null default 4,
          outcome_payload jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        )
      `);
      await pool.query(`create index if not exists insight_outcomes_user_time_idx on insight_outcomes (user_id, created_at desc)`);
      await pool.query(`create index if not exists insight_outcomes_triage_report_idx on insight_outcomes (triage_report_id)`);
    })().catch((err) => {
      insightOutcomesTablePromise = null;
      throw err;
    });
  }

  return insightOutcomesTablePromise;
}

function urgencyForSeverity(severity: z.infer<typeof symptomLogSchema>["severity"]) {
  if (severity === "severe") return "urgent" as const;
  if (severity === "moderate") return "routine" as const;
  return "monitor" as const;
}

function nextStepLevelForSeverity(severity: z.infer<typeof symptomLogSchema>["severity"]) {
  if (severity === "severe") return "doctor_today" as const;
  if (severity === "moderate") return "doctor_24_48" as const;
  return "monitor" as const;
}

async function resolveTriageReportId(params: {
  reportId?: string | null;
  userId: string;
  symptomDescription: string;
  severity: "mild" | "moderate" | "severe";
  recommendation: string;
}) {
  if (params.reportId) {
    const [existing] = await db
      .select({ id: triageReports.id })
      .from(triageReports)
      .where(and(
        eq(triageReports.id, params.reportId),
        eq(triageReports.user_id, params.userId),
      ))
      .limit(1);
    if (existing?.id) return existing.id;
  }

  const urgency = urgencyForSeverity(params.severity);
  const [created] = await db.insert(triageReports).values({
    user_id: params.userId,
    chief_complaint: params.symptomDescription,
    symptoms: [params.symptomDescription],
    urgency,
    recommendations: params.recommendation ? [params.recommendation] : [],
    disclaimer: "",
    next_step_label: params.recommendation || null,
    next_step_level: nextStepLevelForSeverity(params.severity),
    triage_reasons: [],
    watch_signs: [],
    profile_considerations: [],
    vitals_notes: [],
    scan_results: [],
    scan_notes: [],
  }).returning({ id: triageReports.id });

  return created?.id ?? null;
}

export async function logSymptomOutcomeForUser(params: {
  userId: string;
  triageReportId?: string | null;
  symptomDescription: string;
  severity: "mild" | "moderate" | "severe";
  checkCompleted?: boolean;
  recommendation?: string;
  escalatedToCaregiver?: boolean;
}) {
  await ensureInsightOutcomesTable();
  const reportId = await resolveTriageReportId({
    reportId: params.triageReportId ?? null,
    userId: params.userId,
    symptomDescription: params.symptomDescription,
    severity: params.severity,
    recommendation: params.recommendation ?? "",
  });

  if (params.severity === "severe") {
    const existingOutcome = reportId
      ? await db
        .select({ id: insightOutcomes.id })
        .from(insightOutcomes)
        .where(and(
          eq(insightOutcomes.user_id, params.userId),
          eq(insightOutcomes.triage_report_id, reportId),
          eq(insightOutcomes.delivered_surface, "senior_card"),
        ))
        .limit(1)
      : [];

    if (!existingOutcome[0]) {
      await db.insert(insightOutcomes).values({
        user_id: params.userId,
        triage_report_id: reportId,
        delivered_surface: "senior_card",
        action_taken: "none",
        tier_at_generation: 4,
        outcome_payload: {
          symptom_description: params.symptomDescription,
          check_completed: params.checkCompleted ?? true,
          vyva_recommendation: params.recommendation ?? "",
          escalated_to_caregiver: params.escalatedToCaregiver ?? false,
        },
      });
    }
  }

  if (params.severity === "moderate" || params.severity === "severe") {
    void triggerPreventionPlanRefresh({
      userId: params.userId,
      triggerType: "symptom_logged",
      triggerData: {
        severity: params.severity,
        symptom_description: params.symptomDescription,
        triage_report_id: reportId,
      },
    }).catch((err) => console.error("[symptoms prevention refresh]", err));
  }

  return {
    ok: true,
    triage_report_id: reportId,
    refreshTargets: ["/api/health/prevention", "/api/reports/summary"],
  };
}

router.post("/log", async (req: Request, res: Response) => {
  const currentUserId = req.user?.id;
  if (!currentUserId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = symptomLogSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }

  if (parsed.data.userId && parsed.data.userId !== currentUserId) {
    return res.status(403).json({ error: "Cannot log symptoms for another user" });
  }

  try {
    const result = await logSymptomOutcomeForUser({
      userId: currentUserId,
      triageReportId: parsed.data.triage_report_id ?? null,
      symptomDescription: parsed.data.symptom_description,
      severity: parsed.data.severity,
      checkCompleted: parsed.data.check_completed,
      recommendation: parsed.data.vyva_recommendation,
      escalatedToCaregiver: parsed.data.escalated_to_caregiver,
    });

    return res.status(201).json(result);
  } catch (err) {
    console.error("[symptoms/log]", err);
    return res.status(500).json({ error: "Failed to log symptom result" });
  }
});

export default router;
