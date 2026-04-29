import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { profiles, utilityReviewRuns } from "../../shared/schema.js";
import { compareWithCnmc, type NormalizedUtilityInput, type UtilityComparisonResult, type UtilityType } from "../services/cnmcComparator.js";

const router = Router();
const DEMO_USER_ID = "demo-user";
const AVERAGE_EUR_PER_KWH = Number(process.env.UTILITY_AVERAGE_EUR_PER_KWH ?? "0.22");

type InputMethod = "upload" | "photo" | "voice" | "manual";

interface UtilityNormalizeBody {
  input_method?: InputMethod;
  locale?: string;
  extracted_data?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  voice_answers?: Record<string, unknown>;
}

interface UtilityCompareBody {
  input_method?: InputMethod;
  locale?: string;
  normalized_input?: NormalizedUtilityInput;
  extracted_data?: Record<string, unknown>;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 180) : "";
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function safeBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (/^(si|sí|yes|true)$/i.test(value.trim())) return true;
    if (/^(no|false)$/i.test(value.trim())) return false;
  }
  return null;
}

function normalizeUtilityType(value: unknown, extracted?: Record<string, unknown>): UtilityType {
  const text = `${safeString(value)} ${safeString(extracted?.document_type)} ${safeString(extracted?.category)}`.toLowerCase();
  if (/dual|ambas|luz\s*\+\s*gas|electricity\s*\+\s*gas/.test(text)) return "dual";
  if (/gas/.test(text) && !/electric|luz/.test(text)) return "gas";
  return "electricity";
}

function valueFrom(...values: unknown[]): unknown {
  return values.find((value) => {
    if (typeof value === "string") return value.trim().length > 0;
    return value !== undefined && value !== null;
  });
}

function extractKwh(extracted?: Record<string, unknown>): number | null {
  const usage = extracted?.usage && typeof extracted.usage === "object"
    ? extracted.usage as Record<string, unknown>
    : {};
  return safeNumber(valueFrom(usage.kwh, usage.gas_kwh, extracted?.consumption_kwh));
}

async function getProfileHints(userId: string) {
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
  if (!uuidLike) {
    return { postcode: "", address: "" };
  }

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1).catch((err) => {
    console.warn("[utilities] Profile hints unavailable:", err instanceof Error ? err.message : err);
    return [];
  });
  const address = safeString((profile as Record<string, unknown> | undefined)?.address);
  const postcodeMatch = address.match(/\b(0[1-9]|[1-4]\d|5[0-2])\d{3}\b/);
  return {
    postcode: postcodeMatch?.[0] ?? "",
    address,
  };
}

function estimatePowerKw(profileAddress: string, explicitHomeSize?: unknown): number {
  const text = `${safeString(explicitHomeSize)} ${profileAddress}`.toLowerCase();
  if (/piso|apartamento|small|peque/.test(text)) return 3.45;
  if (/casa grande|large|villa|chalet|adosado/.test(text)) return 5.75;
  return 4.6;
}

function confidenceToNumber(input: NormalizedUtilityInput, estimatedFields: string[]): number {
  let score = 0.35;
  if (input.postcode) score += 0.2;
  if (input.total_cost != null) score += 0.15;
  if (input.consumption_kwh != null) score += 0.15;
  if (input.power_kw != null) score += 0.1;
  if (input.provider) score += 0.05;
  score -= estimatedFields.length * 0.05;
  return Math.max(0.2, Math.min(0.95, Number(score.toFixed(2))));
}

async function normalizeUtilitiesInput(body: UtilityNormalizeBody, userId: string): Promise<NormalizedUtilityInput> {
  const extracted = body.extracted_data ?? {};
  const fields = body.fields ?? {};
  const voice = body.voice_answers ?? {};
  const profileHints = await getProfileHints(userId);
  const estimatedFields: string[] = [];

  const utilityType = normalizeUtilityType(valueFrom(fields.utility_type, voice.utility_type), extracted);
  const postcode = safeString(valueFrom(fields.postcode, voice.postcode, extracted.postcode, profileHints.postcode));
  const cups = safeString(valueFrom(fields.cups, voice.cups, extracted.cups));
  const provider = safeString(valueFrom(fields.provider, voice.provider, extracted.provider, extracted.provider_name));
  const tariffName = safeString(valueFrom(fields.tariff_name, voice.tariff_name, extracted.tariff_name, extracted.tariff_or_plan));
  const billingPeriodDays = safeNumber(valueFrom(fields.billing_period_days, voice.billing_period_days, extracted.billing_period_days));
  const totalCost = safeNumber(valueFrom(fields.total_cost, fields.monthly_cost, voice.total_cost, voice.monthly_cost, extracted.total_cost, extracted.total_amount));
  let consumptionKwh = safeNumber(valueFrom(fields.consumption_kwh, voice.consumption_kwh, extractKwh(extracted)));
  let powerKw = safeNumber(valueFrom(fields.power_kw, voice.power_kw, extracted.power_kw));

  if (powerKw == null && utilityType !== "gas") {
    powerKw = estimatePowerKw(profileHints.address, fields.home_size ?? voice.home_size);
    estimatedFields.push("power_kw");
  }

  if (consumptionKwh == null && totalCost != null) {
    consumptionKwh = Number((totalCost / AVERAGE_EUR_PER_KWH).toFixed(0));
    estimatedFields.push("consumption_kwh");
  }

  const hasSocialBonus = safeBool(valueFrom(fields.has_social_bonus, voice.has_social_bonus, extracted.has_social_bonus));
  const missingFields: string[] = [];
  if (!postcode) missingFields.push("postcode");
  if (totalCost == null && consumptionKwh == null) missingFields.push("estimated monthly cost or consumption_kwh");
  if (utilityType !== "gas" && powerKw == null) missingFields.push("power_kw");

  const normalized: NormalizedUtilityInput = {
    country: "ES",
    utility_type: utilityType,
    postcode,
    cups,
    provider,
    tariff_name: tariffName,
    power_kw: powerKw,
    consumption_kwh: consumptionKwh,
    billing_period_days: billingPeriodDays,
    total_cost: totalCost,
    has_social_bonus: hasSocialBonus,
    confidence: 0,
    missing_fields: [...missingFields, ...estimatedFields.map((field) => `estimated:${field}`)],
  };
  normalized.confidence = confidenceToNumber(normalized, estimatedFields);
  return normalized;
}

function validateComparisonInput(input: NormalizedUtilityInput): string | null {
  if (input.country !== "ES") return "country must be ES";
  if (!input.postcode) return "postcode";
  if (input.total_cost == null && input.consumption_kwh == null) return "estimated monthly cost or consumption";
  if (input.utility_type !== "gas" && input.power_kw == null) return "power_kw";
  return null;
}

function currentMonthlyCost(input: NormalizedUtilityInput): number | null {
  if (input.total_cost != null && input.billing_period_days && input.billing_period_days > 0) {
    return Number(((input.total_cost / input.billing_period_days) * 30.4).toFixed(2));
  }
  if (input.total_cost != null) return Number(input.total_cost.toFixed(2));
  if (input.consumption_kwh != null) return Number((input.consumption_kwh * AVERAGE_EUR_PER_KWH).toFixed(2));
  return null;
}

function confidenceLabel(score: number): "high" | "medium" | "low" {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function resultSummary(input: NormalizedUtilityInput, results: UtilityComparisonResult[]) {
  const current = currentMonthlyCost(input);
  const best = results[0]?.estimated_monthly_cost ?? null;
  const saving = current != null && best != null ? Number(Math.max(0, current - best).toFixed(2)) : null;
  return {
    headline: saving != null && saving > 2 ? "Puede haber margen de ahorro." : "La factura queda revisada.",
    current_monthly_cost: current,
    best_estimated_monthly_cost: best,
    estimated_monthly_savings: saving,
  };
}

async function logUtilityRun(userId: string, body: {
  input_method: InputMethod;
  normalized: NormalizedUtilityInput;
  extracted: Record<string, unknown>;
  source_used: string;
  source_status: string;
  results: UtilityComparisonResult[];
}) {
  try {
    await db.insert(utilityReviewRuns).values({
      user_id: userId,
      country: body.normalized.country,
      utility_type: body.normalized.utility_type,
      input_method: body.input_method,
      extracted_data_json: body.extracted,
      normalized_input_json: body.normalized,
      source_used: body.source_used,
      source_status: body.source_status,
      results_json: body.results,
      confidence: confidenceLabel(body.normalized.confidence),
    });
  } catch (err) {
    console.warn("[utilities] Could not log utility review run:", err instanceof Error ? err.message : err);
  }
}

router.post("/normalize", async (req: Request, res: Response) => {
  const body = req.body as UtilityNormalizeBody;
  const userId = (req as any).user?.id ?? DEMO_USER_ID;
  try {
    const normalized = await normalizeUtilitiesInput(body, userId);
    const missing = validateComparisonInput(normalized);
    return res.json({
      normalized_input: normalized,
      can_compare: !missing,
      next_missing_field: missing,
    });
  } catch (err) {
    console.error("[utilities/normalize]", err);
    return res.status(500).json({ error: "No he podido preparar los datos de la factura." });
  }
});

router.post("/compare", async (req: Request, res: Response) => {
  const body = req.body as UtilityCompareBody;
  const userId = (req as any).user?.id ?? DEMO_USER_ID;
  try {
    const normalized = body.normalized_input ?? await normalizeUtilitiesInput(body, userId);
    const missing = validateComparisonInput(normalized);
    if (missing) {
      return res.status(400).json({
        error: `Para comparar mejor, necesito un dato mas: ${missing}.`,
        next_missing_field: missing,
      });
    }

    const comparison = await compareWithCnmc(normalized);
    await logUtilityRun(userId, {
      input_method: body.input_method ?? "manual",
      normalized,
      extracted: body.extracted_data ?? {},
      source_used: comparison.source_used,
      source_status: comparison.source_status,
      results: comparison.results,
    });

    const estimated = normalized.missing_fields.some((field) => field.startsWith("estimated:"));
    return res.json({
      normalized_input: normalized,
      source_used: comparison.source_used,
      source_status: comparison.source_status,
      summary: resultSummary(normalized, comparison.results),
      results: comparison.results,
      calculation_note: "He usado los datos de su factura o los datos que me ha facilitado, especialmente codigo postal, consumo, potencia e importe actual. Despues he comparado opciones usando el comparador oficial de la CNMC.",
      estimated_note: estimated ? "Algunos datos fueron estimados, por lo que el resultado es orientativo." : "",
      neutrality_note: "VYVA no recibe comisiones ni promociona servicios. Estas opciones se muestran de forma neutral para ayudarle a elegir lo mejor para usted.",
      source_note: comparison.explanation,
    });
  } catch (err) {
    console.error("[utilities/compare]", err);
    return res.status(500).json({
      error: "No he podido completar la comparacion oficial ahora. Puedo guardar los datos y volver a intentarlo, o darle una estimacion orientativa.",
    });
  }
});

export default router;
