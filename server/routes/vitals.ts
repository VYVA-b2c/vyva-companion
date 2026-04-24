import { Router } from "express";
import type { Request, Response } from "express";
import { and, eq, gte, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { vitalsReadings } from "../../shared/schema.js";
import { requireUser } from "../middleware/auth.js";

const router = Router();

const METRIC_TYPES = ["hr", "rr", "bp"] as const;
type MetricType = typeof METRIC_TYPES[number];

const postBodySchema = z.object({
  metric_type: z.enum(METRIC_TYPES),
  value: z.string().min(1).max(20),
});

function startOfDayUTC(offsetDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d;
}

function dateStringUTC(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

function rowToMetricEntries(row: typeof vitalsReadings.$inferSelect): Array<{ metric: MetricType; value: string }> {
  if (row.metric_type && row.value) {
    const mt = row.metric_type as MetricType;
    if (METRIC_TYPES.includes(mt)) return [{ metric: mt, value: row.value }];
  }
  const entries: Array<{ metric: MetricType; value: string }> = [];
  if (row.bpm != null) entries.push({ metric: "hr", value: String(row.bpm) });
  if (row.respiratory_rate != null) entries.push({ metric: "rr", value: String(row.respiratory_rate) });
  return entries;
}

router.get("/", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const sevenDaysAgo = startOfDayUTC(6);

  try {
    const rows = await db
      .select()
      .from(vitalsReadings)
      .where(
        and(
          eq(vitalsReadings.user_id, userId),
          gte(vitalsReadings.recorded_at, sevenDaysAgo),
        ),
      )
      .orderBy(desc(vitalsReadings.recorded_at));

    const byMetric: Record<MetricType, Array<{ value: string; recorded_at: Date }>> = {
      hr: [], rr: [], bp: [],
    };

    for (const row of rows) {
      for (const { metric, value } of rowToMetricEntries(row)) {
        byMetric[metric].push({ value, recorded_at: row.recorded_at });
      }
    }

    const summary: Record<string, {
      latest_value: string | null;
      latest_recorded_at: string | null;
      trend: (string | null)[];
      has_data: boolean;
    }> = {};

    for (const metric of METRIC_TYPES) {
      const readings = byMetric[metric];
      const latest = readings[0] ?? null;

      const dayMap: Record<string, string> = {};
      for (const r of readings) {
        const dayKey = r.recorded_at.toISOString().slice(0, 10);
        if (!dayMap[dayKey]) dayMap[dayKey] = r.value;
      }

      const trend: (string | null)[] = [];
      for (let i = 6; i >= 0; i--) {
        const day = dateStringUTC(i);
        trend.push(dayMap[day] ?? null);
      }

      summary[metric] = {
        latest_value: latest?.value ?? null,
        latest_recorded_at: latest?.recorded_at.toISOString() ?? null,
        trend,
        has_data: readings.length > 0,
      };
    }

    const complianceDays: boolean[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = dateStringUTC(i);
      const hasReading = METRIC_TYPES.some(
        (m) => byMetric[m].some((r) => r.recorded_at.toISOString().slice(0, 10) === day),
      );
      complianceDays.push(hasReading);
    }

    return res.json({ summary, compliance_days: complianceDays });
  } catch (err) {
    console.error("[vitals GET]", err);
    return res.status(500).json({ error: "Failed to fetch vitals readings" });
  }
});

router.post("/", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const parsed = postBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { metric_type, value } = parsed.data;

  try {
    const [entry] = await db
      .insert(vitalsReadings)
      .values({ user_id: userId, metric_type, value })
      .returning();

    return res.status(201).json(entry);
  } catch (err) {
    console.error("[vitals POST]", err);
    return res.status(500).json({ error: "Failed to save vitals reading" });
  }
});

export default router;
