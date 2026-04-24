import { Router } from "express";
import type { Request, Response } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { activityLogs, dailyStepLogs } from "../../shared/schema.js";
import { requireUser } from "../middleware/auth.js";

const router = Router();

const CALORIES_PER_MINUTE: Record<string, number> = {
  Walking:    4,
  Cycling:    8,
  Stretching: 3,
  Exercise:   7,
  Breathing:  2,
};

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfTodayUTC(): Date {
  const s = todayDateString();
  return new Date(`${s}T00:00:00.000Z`);
}

const logBodySchema = z.object({
  activity_type:    z.string().min(1),
  duration_minutes: z.number().int().min(1).max(480),
});

const stepsBodySchema = z.object({
  steps: z.number().int().min(0).max(100000),
});

router.get("/", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const dateStr = todayDateString();

  try {
    const [entries, stepRows] = await Promise.all([
      db
        .select()
        .from(activityLogs)
        .where(
          and(
            eq(activityLogs.user_id, userId),
            gte(activityLogs.logged_at, startOfTodayUTC()),
          ),
        )
        .orderBy(activityLogs.logged_at),
      db
        .select()
        .from(dailyStepLogs)
        .where(
          and(
            eq(dailyStepLogs.user_id, userId),
            eq(dailyStepLogs.log_date, dateStr),
          ),
        )
        .limit(1),
    ]);

    const total_active_minutes = entries.reduce((s, e) => s + e.duration_minutes, 0);
    const total_calories = entries.reduce((s, e) => s + e.calories, 0);
    const today_steps = stepRows[0]?.steps ?? 0;

    return res.json({ entries, total_active_minutes, total_calories, today_steps });
  } catch (err) {
    console.error("[activity GET]", err);
    return res.status(500).json({ error: "Failed to fetch activity logs" });
  }
});

router.post("/log", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const parsed = logBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { activity_type, duration_minutes } = parsed.data;
  const cpm = CALORIES_PER_MINUTE[activity_type] ?? 4;
  const calories = Math.round(cpm * duration_minutes);

  try {
    const [entry] = await db
      .insert(activityLogs)
      .values({ user_id: userId, activity_type, duration_minutes, calories })
      .returning();

    return res.status(201).json(entry);
  } catch (err) {
    console.error("[activity POST /log]", err);
    return res.status(500).json({ error: "Failed to save activity log" });
  }
});

router.post("/steps", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const parsed = stepsBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { steps } = parsed.data;
  const dateStr = todayDateString();

  try {
    const [row] = await db
      .insert(dailyStepLogs)
      .values({ user_id: userId, log_date: dateStr, steps })
      .onConflictDoUpdate({
        target: [dailyStepLogs.user_id, dailyStepLogs.log_date],
        set: { steps, updated_at: sql`NOW()` },
      })
      .returning();

    return res.json(row);
  } catch (err) {
    console.error("[activity POST /steps]", err);
    return res.status(500).json({ error: "Failed to save step count" });
  }
});

export default router;
