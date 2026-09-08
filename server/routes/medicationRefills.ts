import { Router } from "express";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";
import { db } from "../db.js";
import { medicationInventoryEvents, myMedicines, profiles } from "../../shared/schema.js";
import { requireActiveProfileId } from "../lib/profileAccess.js";
import { resolveDomainAccess, type CaregiverDomainAccessContext } from "../lib/caregiverDomainAccess.js";
import { getRefillSummaries, reconcileRefillAlerts, serializeRefillAlert } from "../medication/refillAlerts.js";
import { ensureRefillPersistence } from "../medication/refillPersistence.js";
import {
  medicationInventoryPhotoJsonSchema,
  normalizeMedicationInventoryPhoto,
} from "../medication/refillPhotoExtraction.js";

const router = Router();

const settingsSchema = z.object({
  doseUnit: z.string().trim().min(1).max(40),
  unitsPerDose: z.coerce.number().positive().max(10_000),
  inventoryUnit: z.string().trim().min(1).max(40).optional(),
  inventoryUnitsPerDose: z.coerce.number().positive().max(10_000).optional(),
  dailyFrequency: z.coerce.number().positive().max(24),
  refillAlertDays: z.coerce.number().int().min(1).max(90).default(7),
});

const inventoryEventSchema = settingsSchema.extend({
  quantity: z.coerce.number().nonnegative().max(1_000_000),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(["manual", "photo", "caregiver"]).default("manual"),
});

const photoSchema = z.object({
  image: z.string().min(32).max(14_000_000),
  language: z.string().trim().max(20).default("en"),
  medicineId: z.string().uuid().optional(),
});

async function resolveProfileId(req: Request, res: Response) {
  return req.params.profileId === "me" ? requireActiveProfileId(req.user!.id, res) : req.params.profileId;
}

async function requireInventoryAccess(req: Request, res: Response): Promise<{ profileId: string; access: CaregiverDomainAccessContext } | null> {
  const profileId = await resolveProfileId(req, res);
  if (!profileId) return null;
  const access = await resolveDomainAccess({
    actorUserId: req.user!.id,
    targetUserId: profileId,
    domain: "meds",
    requiredPermission: "manage_inventory",
    actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
    actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
  });
  if (!access) {
    res.status(403).json({ error: "Medication inventory access is not enabled." });
    return null;
  }
  return { profileId, access };
}

async function requireRefillReadAccess(req: Request, res: Response): Promise<{ profileId: string; access: CaregiverDomainAccessContext } | null> {
  const profileId = await resolveProfileId(req, res);
  if (!profileId) return null;
  const access = await resolveDomainAccess({
    actorUserId: req.user!.id,
    targetUserId: profileId,
    domain: "meds",
    actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
    actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
  });
  const canRead = Boolean(
    access && (
      access.isOwnProfile
      || access.isAdmin
      || access.permissions.view_adherence
      || access.permissions.receive_refill_alerts
      || access.permissions.manage_inventory
    )
  );
  if (!access || !canRead) {
    res.status(403).json({ error: "Medication refill alert access is not enabled." });
    return null;
  }
  return { profileId, access };
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function actorName(actorUserId: string) {
  const [actor] = await db.select({
    preferredName: profiles.preferred_name,
    fullName: profiles.full_name,
    email: profiles.email,
  }).from(profiles).where(eq(profiles.id, actorUserId)).limit(1);
  return actor?.preferredName?.trim() || actor?.fullName?.trim() || actor?.email?.trim() || "VYVA user";
}

async function saveInventoryEvent(req: Request, res: Response, eventType: "purchase" | "stock_count") {
  const context = await requireInventoryAccess(req, res);
  if (!context) return;
  const parsed = inventoryEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid inventory details", details: parsed.error.issues });
  if (parsed.data.occurredOn > new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: "The inventory date cannot be in the future." });
  }
  await ensureRefillPersistence();
  const [medicine] = await db.select().from(myMedicines).where(and(
    eq(myMedicines.id, req.params.medicineId),
    eq(myMedicines.user_id, context.profileId),
    eq(myMedicines.status, "active"),
  )).limit(1);
  if (!medicine) return res.status(404).json({ error: "Medicine not found" });

  const name = await actorName(req.user!.id);
  const source = context.access.isOwnProfile ? parsed.data.source : "caregiver";
  await db.transaction(async (tx) => {
    await tx.update(myMedicines).set({
      dose_unit: parsed.data.doseUnit,
      units_per_dose: String(parsed.data.unitsPerDose),
      inventory_unit: parsed.data.inventoryUnit ?? parsed.data.doseUnit,
      inventory_units_per_dose: String(parsed.data.inventoryUnitsPerDose ?? parsed.data.unitsPerDose),
      daily_frequency: String(parsed.data.dailyFrequency),
      refill_alert_days: parsed.data.refillAlertDays,
      inventory_tracking_enabled: true,
      updated_at: new Date(),
    }).where(and(eq(myMedicines.id, medicine.id), eq(myMedicines.user_id, context.profileId)));
    await tx.insert(medicationInventoryEvents).values({
      user_id: context.profileId,
      medicine_id: medicine.id,
      event_type: eventType,
      quantity: String(parsed.data.quantity),
      unit: parsed.data.inventoryUnit ?? parsed.data.doseUnit,
      occurred_on: parsed.data.occurredOn,
      source,
      actor_user_id: req.user!.id,
      actor_role: context.access.actorRole,
      actor_name: name,
      metadata: { confirmed: true },
    });
  });

  const summaries = await getRefillSummaries(context.profileId);
  const summary = summaries.find((item) => item.medicineId === medicine.id) ?? null;
  await db.update(myMedicines).set({ refill_due_date: summary?.projectedRunOutDate ?? null }).where(eq(myMedicines.id, medicine.id));
  const alerts = await reconcileRefillAlerts(context.profileId, summaries);
  return res.status(201).json({ summary, alerts: alerts.map(serializeRefillAlert) });
}

router.get("/:profileId", async (req: Request, res: Response) => {
  try {
    const context = await requireRefillReadAccess(req, res);
    if (!context) return;
    const medicines = await getRefillSummaries(context.profileId);
    const alerts = await reconcileRefillAlerts(context.profileId, medicines);
    return res.json({
      profileId: context.profileId,
      permissions: context.access.permissions,
      actorRole: context.access.actorRole,
      medicines,
      alerts: alerts.map(serializeRefillAlert),
    });
  } catch (error) {
    console.error("[meds/refills GET]", error);
    return res.status(500).json({ error: "Failed to load refill tracking" });
  }
});

router.post("/:profileId/medicines/:medicineId/purchases", async (req, res) => {
  try { return await saveInventoryEvent(req, res, "purchase"); }
  catch (error) { console.error("[meds/refills purchase]", error); return res.status(500).json({ error: "Failed to save the purchase" }); }
});

router.post("/:profileId/medicines/:medicineId/stock-counts", async (req, res) => {
  try { return await saveInventoryEvent(req, res, "stock_count"); }
  catch (error) { console.error("[meds/refills stock count]", error); return res.status(500).json({ error: "Failed to save the stock count" }); }
});

router.patch("/:profileId/medicines/:medicineId/settings", async (req, res) => {
  try {
    const context = await requireInventoryAccess(req, res);
    if (!context) return;
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid refill settings", details: parsed.error.issues });
    await ensureRefillPersistence();
    const [updated] = await db.update(myMedicines).set({
      dose_unit: parsed.data.doseUnit,
      units_per_dose: String(parsed.data.unitsPerDose),
      inventory_unit: parsed.data.inventoryUnit ?? parsed.data.doseUnit,
      inventory_units_per_dose: String(parsed.data.inventoryUnitsPerDose ?? parsed.data.unitsPerDose),
      daily_frequency: String(parsed.data.dailyFrequency),
      refill_alert_days: parsed.data.refillAlertDays,
      inventory_tracking_enabled: true,
      updated_at: new Date(),
    }).where(and(eq(myMedicines.id, req.params.medicineId), eq(myMedicines.user_id, context.profileId))).returning();
    if (!updated) return res.status(404).json({ error: "Medicine not found" });
    const summaries = await getRefillSummaries(context.profileId);
    const summary = summaries.find((item) => item.medicineId === updated.id) ?? null;
    await db.update(myMedicines).set({ refill_due_date: summary?.projectedRunOutDate ?? null }).where(eq(myMedicines.id, updated.id));
    const alerts = await reconcileRefillAlerts(context.profileId, summaries);
    return res.json({ summary, alerts: alerts.map(serializeRefillAlert) });
  } catch (error) {
    console.error("[meds/refills settings]", error);
    return res.status(500).json({ error: "Failed to update refill settings" });
  }
});

router.post("/:profileId/photo-extract", async (req, res) => {
  try {
    const context = await requireInventoryAccess(req, res);
    if (!context) return;
    const parsed = photoSchema.safeParse(req.body);
    if (!parsed.success || !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(parsed.data.image)) {
      return res.status(400).json({ error: "A valid medicine-label photo is required." });
    }
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return res.json({
        draft: {
          medicineName: "",
          strength: "",
          packageCount: null,
          unitsPerPackage: null,
          totalQuantity: null,
          inventoryQuantity: null,
          inventoryUnit: null,
          doseUnit: "",
          inventoryEvidenceText: null,
          contentAmountPerUnit: null,
          contentUnit: null,
          contentEvidenceText: null,
          purchasedOn: new Date().toISOString().slice(0, 10),
        },
        confidence: "low",
        fieldConfidence: {},
        needsReview: true,
        warnings: ["VYVA could not read this photo automatically. Please enter the visible details."],
        imageRetained: false,
      });
    }
    const [selectedMedicine] = parsed.data.medicineId
      ? await db.select({ doseUnit: myMedicines.dose_unit }).from(myMedicines).where(and(
        eq(myMedicines.id, parsed.data.medicineId),
        eq(myMedicines.user_id, context.profileId),
      )).limit(1)
      : [];
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o",
      temperature: 0.1,
      max_tokens: 700,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "medication_inventory_label",
          strict: true,
          schema: medicationInventoryPhotoJsonSchema,
        },
      },
      messages: [{
        role: "system",
        content: [
          "Read only literal, visible medicine-package details for an inventory draft.",
          "Inventory quantity means countable usable stock: tablets, capsules, single-dose containers, bottles, sachets, patches, or labelled doses.",
          "Keep package count separate from liquid content. Never multiply containers by ml, mg, g, or strength to create inventory quantity.",
          "For a label such as '30 envases unidosis 0,2 ml', inventoryQuantity is 30, inventoryUnit is single_dose_container, and contentAmountPerUnit is 0.2 ml.",
          "inventoryEvidenceText must quote the exact short label text supporting inventoryQuantity and inventoryUnit.",
          "contentEvidenceText must quote the exact short label text supporting content amount. Do not fabricate evidence.",
          "Do not infer a purchase date, dose, frequency, or medical instruction. Use null for unreadable or absent values.",
          `Use ${parsed.data.language}. Do not recommend or change a dose.`,
        ].join("\n"),
      }, {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: parsed.data.image, detail: "high" } },
          { type: "text", text: "Extract a draft for the user to review. The image must not be retained." },
        ],
      }],
    });
    const model = JSON.parse(response.choices[0]?.message?.content || "{}") as Record<string, unknown>;
    return res.json(normalizeMedicationInventoryPhoto(model, {
      expectedDoseUnit: selectedMedicine?.doseUnit,
      today: new Date().toISOString().slice(0, 10),
    }));
  } catch (error) {
    console.error("[meds/refills photo extract]", error);
    return res.status(500).json({ error: "VYVA could not read this photo. You can enter the details manually." });
  }
});

export default router;
