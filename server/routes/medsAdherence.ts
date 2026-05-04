import { Router } from "express";
import type { Request, Response } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db } from "../db.js";
import { medicationAdherence, userMedications } from "../../shared/schema.js";
import { requireUser } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function adherencePct(taken: number, scheduled: number): number {
  if (scheduled === 0) return 0;
  return Math.round((taken / scheduled) * 100);
}

function dosesPerDay(scheduledTimes: string[] | null | undefined): number {
  return scheduledTimes && scheduledTimes.length > 0 ? scheduledTimes.length : 1;
}

function takenDoseCount(rows: Array<{ status: string }>): number {
  return rows.filter((row) => row.status === "taken").length;
}

function dateKeyFor(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function previousDate(dateStr: string): string {
  const prev = new Date(`${dateStr}T00:00:00.000Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  return prev.toISOString().slice(0, 10);
}

function maxDateKey(a: string, b: string): string {
  return a >= b ? a : b;
}

function activeDaysInWindow(
  medicationCreatedAt: Date | string | undefined,
  windowStart: string,
  windowEnd: string
): number {
  const medicationStart = medicationCreatedAt
    ? dateKeyFor(medicationCreatedAt)
    : windowStart;
  const effectiveStart = maxDateKey(windowStart, medicationStart);
  if (effectiveStart > windowEnd) return 0;

  const start = new Date(`${effectiveStart}T00:00:00.000Z`);
  const end = new Date(`${windowEnd}T00:00:00.000Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

router.get("/today", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const todayStart = new Date(todayDateString() + "T00:00:00.000Z");

  try {
    const [meds, todayLogs] = await Promise.all([
      db
        .select()
        .from(userMedications)
        .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
      db
        .select()
        .from(medicationAdherence)
        .where(
          and(
            eq(medicationAdherence.user_id, userId),
            gte(medicationAdherence.created_at, todayStart)
          )
        ),
    ]);

    const takenCountsByName = new Map<string, number>();
    for (const log of todayLogs) {
      if (log.status !== "taken") continue;
      takenCountsByName.set(
        log.medication_name,
        (takenCountsByName.get(log.medication_name) ?? 0) + 1
      );
    }

    const medications = meds.map((m) => {
      const scheduledCountToday = dosesPerDay(m.scheduled_times);
      const takenCountToday = takenCountsByName.get(m.medication_name) ?? 0;

      return {
        id: m.id,
        medication_name: m.medication_name,
        dosage: m.dosage ?? null,
        frequency: m.frequency ?? null,
        scheduled_times: m.scheduled_times ?? [],
        takenCountToday,
        scheduledCountToday,
        takenToday: takenCountToday >= scheduledCountToday,
      };
    });

    return res.json({ medications });
  } catch (err) {
    console.error("[meds/adherence-report GET /today]", err);
    return res.status(500).json({ error: "Failed to fetch today's medications" });
  }
});

router.get("/", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const sevenDayStart = daysAgo(6);
    const thirtyDayStart = daysAgo(29);
    const today = todayDateString();
    const sevenDayStartDate = dateKeyFor(sevenDayStart);
    const thirtyDayStartDate = dateKeyFor(thirtyDayStart);

    const [adherenceRows, medRows] = await Promise.all([
      db
        .select()
        .from(medicationAdherence)
        .where(
          and(
            eq(medicationAdherence.user_id, userId),
            gte(medicationAdherence.created_at, thirtyDayStart)
          )
        ),
      db
        .select()
        .from(userMedications)
        .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
    ]);

    const hasLogs = medRows.length > 0 || adherenceRows.length > 0;
    const rowsLast30 = adherenceRows;
    const rowsLast7 = adherenceRows.filter((r) => new Date(r.created_at) >= sevenDayStart);

    const taken30 = rowsLast30.filter((r) => r.status === "taken").length;
    const taken7 = rowsLast7.filter((r) => r.status === "taken").length;

    const scheduled7FromMedRows = medRows.reduce(
      (sum, m) =>
        sum +
        dosesPerDay(m.scheduled_times) *
          activeDaysInWindow(m.created_at, sevenDayStartDate, today),
      0
    );
    const scheduled30FromMedRows = medRows.reduce(
      (sum, m) =>
        sum +
        dosesPerDay(m.scheduled_times) *
          activeDaysInWindow(m.created_at, thirtyDayStartDate, today),
      0
    );

    const scheduled7 = medRows.length > 0 ? scheduled7FromMedRows : rowsLast7.length;
    const scheduled30 = medRows.length > 0 ? scheduled30FromMedRows : rowsLast30.length;

    const weekPct = adherencePct(taken7, scheduled7);
    const monthPct = adherencePct(taken30, scheduled30);

    const medNamesFromDb = medRows.map((m) => m.medication_name);
    const allMedNames = Array.from(new Set(medNamesFromDb));

    const sevenDayDates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      sevenDayDates.push(daysAgo(i).toISOString().slice(0, 10));
    }

    const perMedication = allMedNames.map((name) => {
      const medRow = medRows.find((m) => m.medication_name === name);
      const dosage = medRow?.dosage ?? "";
      const dpd = dosesPerDay(medRow?.scheduled_times);
      const medStartDate = medRow?.created_at ? dateKeyFor(medRow.created_at) : null;
      const activeDaysInWeek = activeDaysInWindow(medRow?.created_at, sevenDayStartDate, today);

      const medRows7 = rowsLast7.filter((r) => r.medication_name === name);
      const takenCount = medRows7.filter((r) => r.status === "taken").length;
      const scheduledCount = medRow ? dpd * activeDaysInWeek : medRows7.length;

      const allMedRows30 = rowsLast30.filter((r) => r.medication_name === name);
      const takenCountsByDate = new Map<string, number>();
      for (const row of allMedRows30) {
        if (row.status !== "taken") continue;
        const dateKey = dateKeyFor(row.created_at);
        takenCountsByDate.set(dateKey, (takenCountsByDate.get(dateKey) ?? 0) + 1);
      }

      const dailyStatus = sevenDayDates.map((dateStr) => {
        if (medStartDate && dateStr < medStartDate) return "none";

        const takenOnDate = takenCountsByDate.get(dateStr) ?? 0;
        if (takenOnDate >= dpd) return "taken";
        if (dateStr === today && takenOnDate === 0) return "none";
        return "missed";
      });

      let streak = 0;
      let checkDate = today;
      for (;;) {
        if (medStartDate && checkDate < medStartDate) break;

        const takenOnDate = takenCountsByDate.get(checkDate) ?? 0;
        if (takenOnDate >= dpd) {
          streak++;
          checkDate = previousDate(checkDate);
        } else {
          break;
        }
      }

      return {
        name,
        dosage,
        taken: takenCount,
        scheduled: scheduledCount,
        streak,
        dailyStatus,
      };
    });

    return res.json({
      hasLogs,
      weekPct,
      monthPct,
      perMedication,
      sevenDayDates,
    });
  } catch (err) {
    console.error("[meds/adherence-report GET]", err);
    return res.status(500).json({ error: "Failed to fetch adherence report" });
  }
});

const patchMedSchema = z.object({
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  medication_name: z.string().optional(),
});

router.patch("/:id", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const parsed = patchMedSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
  }

  const updates: Record<string, string> = {};
  if (parsed.data.dosage !== undefined) updates.dosage = parsed.data.dosage;
  if (parsed.data.frequency !== undefined) updates.frequency = parsed.data.frequency;
  if (parsed.data.medication_name !== undefined) updates.medication_name = parsed.data.medication_name;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    const [updated] = await db
      .update(userMedications)
      .set(updates)
      .where(and(eq(userMedications.id, id), eq(userMedications.user_id, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Medication not found" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("[meds/adherence-report PATCH /:id]", err);
    return res.status(500).json({ error: "Failed to update medication" });
  }
});

router.delete("/:id", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const [updated] = await db
      .update(userMedications)
      .set({ active: false })
      .where(and(eq(userMedications.id, id), eq(userMedications.user_id, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Medication not found" });
    }

    return res.json({ success: true, id: updated.id });
  } catch (err) {
    console.error("[meds/adherence-report DELETE /:id]", err);
    return res.status(500).json({ error: "Failed to remove medication" });
  }
});

router.post("/confirm", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { medication_name, scheduled_time } = req.body as {
    medication_name?: string;
    scheduled_time?: string;
  };

  if (!medication_name || typeof medication_name !== "string" || !medication_name.trim()) {
    return res.status(400).json({ error: "medication_name is required" });
  }

  const scheduledTime =
    typeof scheduled_time === "string" && scheduled_time.trim()
      ? scheduled_time.trim()
      : "anytime";

  try {
    const medName = medication_name.trim();
    const todayStart = new Date(todayDateString() + "T00:00:00.000Z");

    const [medRow, todayRows] = await Promise.all([
      db
        .select()
        .from(userMedications)
        .where(
          and(
            eq(userMedications.user_id, userId),
            eq(userMedications.medication_name, medName),
            eq(userMedications.active, true)
          )
        )
        .then((rows) => rows[0]),
      db
        .select()
        .from(medicationAdherence)
        .where(
          and(
            eq(medicationAdherence.user_id, userId),
            eq(medicationAdherence.medication_name, medName),
            gte(medicationAdherence.created_at, todayStart)
          )
        ),
    ]);

    const scheduledCountToday = dosesPerDay(medRow?.scheduled_times);
    const takenCountToday = takenDoseCount(todayRows);

    if (medRow && takenCountToday >= scheduledCountToday) {
      return res.status(409).json({ error: "Dose already fully confirmed for today" });
    }

    const nextScheduledTime =
      medRow?.scheduled_times?.[takenCountToday] ??
      medRow?.scheduled_times?.[0] ??
      scheduledTime;

    const [row] = await db
      .insert(medicationAdherence)
      .values({
        user_id: userId,
        medication_name: medName,
        scheduled_time: nextScheduledTime,
        status: "taken",
        confirmed_by: "user",
        confirmed_taken_at: new Date(),
      })
      .returning();

    return res.status(201).json(row);
  } catch (err) {
    console.error("[meds/adherence-report POST confirm]", err);
    return res.status(500).json({ error: "Failed to record dose confirmation" });
  }
});

export default router;
