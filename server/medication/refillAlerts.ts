import { and, asc, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "../db.js";
import {
  medicationAdherence,
  medicationInventoryEvents,
  medicationRefillAlerts,
  myMedicines,
  profiles,
} from "../../shared/schema.js";
import { calculateRefillInventory } from "./refillInventory.js";
import { ensureRefillPersistence } from "./refillPersistence.js";

function safeTimeZone(value: string | null | undefined) {
  const candidate = value?.trim() || "Europe/Madrid";
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "Europe/Madrid";
  }
}

export function localDateKey(value: Date | string, timeZone = "Europe/Madrid") {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getRefillSummaries(profileId: string, now = new Date()) {
  await ensureRefillPersistence();
  const [profile] = await db
    .select({ timezone: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  const timezone = safeTimeZone(profile?.timezone);
  const today = localDateKey(now, timezone);
  const historyStart = new Date(now);
  historyStart.setUTCDate(historyStart.getUTCDate() - 366);
  historyStart.setUTCHours(0, 0, 0, 0);

  const [medicines, events, adherenceRows] = await Promise.all([
    db.select().from(myMedicines).where(and(eq(myMedicines.user_id, profileId), eq(myMedicines.status, "active"))).orderBy(asc(myMedicines.created_at)),
    db.select().from(medicationInventoryEvents).where(eq(medicationInventoryEvents.user_id, profileId)).orderBy(asc(medicationInventoryEvents.occurred_on), asc(medicationInventoryEvents.created_at)),
    db.select().from(medicationAdherence).where(and(eq(medicationAdherence.user_id, profileId), gte(medicationAdherence.created_at, historyStart))),
  ]);

  return medicines.map((medicine) => {
    const medicineEvents = events.filter((event) => event.medicine_id === medicine.id);
    const missedDosesByDate: Record<string, number> = {};
    for (const row of adherenceRows) {
      if (row.medication_name !== medicine.display_name || row.status !== "missed") continue;
      const key = localDateKey(row.created_at, timezone);
      missedDosesByDate[key] = (missedDosesByDate[key] ?? 0) + 1;
    }
    const estimate = calculateRefillInventory({
      today,
      unitsPerDose: numberValue(medicine.inventory_units_per_dose) ?? numberValue(medicine.units_per_dose),
      dailyFrequency: numberValue(medicine.daily_frequency),
      refillAlertDays: medicine.refill_alert_days ?? 7,
      events: medicineEvents.map((event) => ({
        eventType: event.event_type as "purchase" | "stock_count" | "correction",
        quantity: Number(event.quantity),
        occurredOn: String(event.occurred_on),
        createdAt: event.created_at.toISOString(),
      })),
      missedDosesByDate,
    });
    const latestEvent = medicineEvents.at(-1) ?? null;
    return {
      medicineId: medicine.id,
      medicineName: medicine.display_name,
      strength: medicine.dose_text,
      doseUnit: medicine.dose_unit,
      unitsPerDose: numberValue(medicine.units_per_dose),
      inventoryUnit: medicine.inventory_unit ?? medicine.dose_unit,
      inventoryUnitsPerDose: numberValue(medicine.inventory_units_per_dose) ?? numberValue(medicine.units_per_dose),
      dailyFrequency: numberValue(medicine.daily_frequency),
      refillAlertDays: medicine.refill_alert_days ?? 7,
      inventoryTrackingEnabled: medicine.inventory_tracking_enabled,
      cycleKey: latestEvent?.id ?? `medicine-${medicine.id}`,
      timezone,
      ...estimate,
      updatedAt: latestEvent?.created_at.toISOString() ?? medicine.updated_at.toISOString(),
      updatedBy: latestEvent ? {
        name: latestEvent.actor_name ?? "VYVA user",
        role: latestEvent.actor_role,
      } : null,
      history: medicineEvents.toReversed().slice(0, 8).map((event) => ({
        id: event.id,
        type: event.event_type,
        quantity: Number(event.quantity),
        unit: event.unit,
        occurredOn: String(event.occurred_on),
        source: event.source,
        updatedBy: event.actor_name ?? "VYVA user",
        actorRole: event.actor_role,
      })),
    };
  });
}

export type RefillSummary = Awaited<ReturnType<typeof getRefillSummaries>>[number];

function refillAlertCopy(summary: RefillSummary) {
  if (summary.status === "refill_now") {
    return {
      title: `${summary.medicineName} may have run out`,
      message: "Update the confirmed supply now. VYVA will not order medicine or contact anyone.",
    };
  }
  if (summary.status === "uncertain") {
    return {
      title: `Check ${summary.medicineName}'s supply`,
      message: "The estimate needs a fresh stock count before VYVA can forecast reliably.",
    };
  }
  return {
    title: `${summary.medicineName} needs a refill this week`,
    message: `${summary.daysRemaining ?? 0} days of supply are estimated to remain. Update supply after the next purchase.`,
  };
}

export async function reconcileRefillAlerts(profileId: string, summaries: RefillSummary[], now = new Date()) {
  const alertableStatuses = new Set(["refill_soon", "refill_now", "uncertain"]);
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(medicationRefillAlerts).where(eq(medicationRefillAlerts.user_id, profileId));
    const activeMedicineIds = new Set(summaries.map((summary) => summary.medicineId));
    const inactiveAlertIds = existing
      .filter((alert) => !alert.resolved_at && !activeMedicineIds.has(alert.medicine_id))
      .map((alert) => alert.id);
    if (inactiveAlertIds.length) {
      await tx.update(medicationRefillAlerts).set({
        resolved_at: now,
        resolved_reason: "medicine_inactive",
      }).where(inArray(medicationRefillAlerts.id, inactiveAlertIds));
    }
    for (const summary of summaries) {
      const currentOpen = existing.filter((alert) => alert.medicine_id === summary.medicineId && !alert.resolved_at);
      const shouldAlert = alertableStatuses.has(summary.status);
      const matching = existing.find((alert) => (
        alert.medicine_id === summary.medicineId
        && alert.cycle_key === summary.cycleKey
        && alert.status === summary.status
      ));
      const staleIds = currentOpen
        .filter((alert) => !shouldAlert || alert.cycle_key !== summary.cycleKey || alert.status !== summary.status)
        .map((alert) => alert.id);
      if (staleIds.length) {
        await tx.update(medicationRefillAlerts).set({
          resolved_at: now,
          resolved_reason: shouldAlert ? "status_changed" : "supply_updated",
        }).where(inArray(medicationRefillAlerts.id, staleIds));
      }
      if (shouldAlert && !matching) {
        const copy = refillAlertCopy(summary);
        await tx.insert(medicationRefillAlerts).values({
          user_id: profileId,
          medicine_id: summary.medicineId,
          status: summary.status,
          cycle_key: summary.cycleKey,
          title: copy.title,
          message: copy.message,
          days_remaining: summary.daysRemaining,
          projected_run_out_date: summary.projectedRunOutDate,
        }).onConflictDoNothing();
      }
    }
  });
  return db.select().from(medicationRefillAlerts)
    .where(and(eq(medicationRefillAlerts.user_id, profileId), isNull(medicationRefillAlerts.resolved_at)))
    .orderBy(desc(medicationRefillAlerts.created_at));
}

export function serializeRefillAlert(alert: typeof medicationRefillAlerts.$inferSelect) {
  return {
    id: alert.id,
    medicineId: alert.medicine_id,
    status: alert.status,
    title: alert.title,
    message: alert.message,
    daysRemaining: alert.days_remaining,
    projectedRunOutDate: alert.projected_run_out_date,
    createdAt: alert.created_at.toISOString(),
  };
}
