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

/** How many doses/day a medication expects (defaults to 1 if no schedule stored). */
function dosesPerDay(scheduledTimes: string[] | null | undefined): number {
  return scheduledTimes && scheduledTimes.length > 0 ? scheduledTimes.length : 1;
}

// ─── GET /today ─────────────────────────────────────────────────────────────
// Returns the user's active medications plus whether each was taken today.
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

    const takenNames = new Set(
      todayLogs.filter((l) => l.status === "taken").map((l) => l.medication_name)
    );

    const medications = meds.map((m) => ({
      id: m.id,
      medication_name: m.medication_name,
      dosage: m.dosage ?? null,
      frequency: m.frequency ?? null,
      scheduled_times: m.scheduled_times ?? [],
      takenToday: takenNames.has(m.medication_name),
    }));

    return res.json({ medications });
  } catch (err) {
    console.error("[meds/adherence-report GET /today]", err);
    return res.status(500).json({ error: "Failed to fetch today's medications" });
  }
});

// ─── GET / ──────────────────────────────────────────────────────────────────
// Adherence report (7-day / 30-day summary + per-medication breakdown).
router.get("/", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const sevenDayStart = daysAgo(6);
    const thirtyDayStart = daysAgo(29);

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

    // Show data as long as the user has active medications OR any adherence logs.
    const hasLogs = medRows.length > 0 || adherenceRows.length > 0;

    const rowsLast30 = adherenceRows;
    const rowsLast7 = adherenceRows.filter(
      (r) => new Date(r.created_at) >= sevenDayStart
    );

    const taken30 = rowsLast30.filter((r) => r.status === "taken").length;
    const taken7 = rowsLast7.filter((r) => r.status === "taken").length;

    // Derive schedule-based expected dose counts from user_medications.
    const totalDosesPerDay = medRows.reduce(
      (sum, m) => sum + dosesPerDay(m.scheduled_times),
      0
    );
    // Fall back to raw log counts when there are no active medications in the table.
    const scheduled7 =
      medRows.length > 0 ? totalDosesPerDay * 7 : rowsLast7.length;
    const scheduled30 =
      medRows.length > 0 ? totalDosesPerDay * 30 : rowsLast30.length;

    const weekPct = adherencePct(taken7, scheduled7);
    const monthPct = adherencePct(taken30, scheduled30);

    const medNamesFromDb = medRows.map((m) => m.medication_name);
    // Only include currently-active medications in the report.
    // Historical adherence rows for deleted meds are kept in the DB for data
    // integrity, but must not appear in the per-medication report breakdown.
    const allMedNames = Array.from(new Set(medNamesFromDb));

    const sevenDayDates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      sevenDayDates.push(daysAgo(i).toISOString().slice(0, 10));
    }

    const today = todayDateString();

    const perMedication = allMedNames.map((name) => {
      const medRow = medRows.find((m) => m.medication_name === name);
      const dosage = medRow?.dosage ?? "";
      const dpd = dosesPerDay(medRow?.scheduled_times);

      const medRows7 = rowsLast7.filter((r) => r.medication_name === name);
      const takenCount = medRows7.filter((r) => r.status === "taken").length;
      // Use schedule-based scheduled count (doses/day × 7 days).
      const scheduledCount = medRow ? dpd * 7 : medRows7.length;

      const allMedRows30 = rowsLast30.filter((r) => r.medication_name === name);

      const byDate = new Map<string, string[]>();
      for (const row of allMedRows30) {
        const dateKey = new Date(row.created_at).toISOString().slice(0, 10);
        if (!byDate.has(dateKey)) byDate.set(dateKey, []);
        byDate.get(dateKey)!.push(row.status);
      }

      const dailyStatus = sevenDayDates.map((dateStr) => {
        const statuses = byDate.get(dateStr);
        if (!statuses || statuses.length === 0) return "none";
        if (statuses.some((s) => s === "taken")) return "taken";
        return "missed";
      });

      let streak = 0;
      let checkDate = today;
      for (;;) {
        const statuses = byDate.get(checkDate);
        if (statuses && statuses.some((s) => s === "taken")) {
          streak++;
          const prev = new Date(`${checkDate}T00:00:00.000Z`);
          prev.setUTCDate(prev.getUTCDate() - 1);
          checkDate = prev.toISOString().slice(0, 10);
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

// ─── PATCH /:id ─────────────────────────────────────────────────────────────
// Update dosage and/or frequency of a medication belonging to the current user.
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

// ─── DELETE /:id ─────────────────────────────────────────────────────────────
// Soft-delete: sets active=false for the medication belonging to the current user.
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

// ─── POST /confirm ───────────────────────────────────────────────────────────
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
    const [row] = await db
      .insert(medicationAdherence)
      .values({
        user_id: userId,
        medication_name: medication_name.trim(),
        scheduled_time: scheduledTime,
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
