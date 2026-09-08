import { Router, raw } from "express";
import type { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import { resolveDomainAccess } from "../lib/caregiverDomainAccess.js";
import {
  buildDailySafetyCheck,
  DAILY_SAFETY_RULE_VERSION,
  mergeAiSafetySuggestion,
  statusShouldEscalate,
  type AiSafetySuggestion,
  type DailySafetyCheck,
  type MedicationSafetyContext,
  type SignalSummary,
  type TriageSafetyContext,
} from "../lib/dailySafetyCheck.js";
import {
  caregiverAlerts,
  medicationAdherence,
  profiles,
  teamInvitations,
  triageReports,
  userHealthConditions,
  userDeviceConnections,
  userMedications,
} from "../../shared/schema.js";
import {
  VITALS_READING_SOURCES,
  normalizeVitalsSource,
  vitalsEvidenceFor,
  type VitalsReadingSource,
} from "../../shared/vitalsEvidence.js";
import {
  VITALS_CAPTURE_METHODS,
  defaultContextForSignal,
  isVitalsCaptureMethod,
  isVitalsSignalKey,
  unitForSignal,
  validateVitalsSignalValue,
  type VitalsCaptureMethod,
  type VitalsSignalKey,
} from "../../shared/vitalsSignalCatalog.js";
import { triggerPreventionPlanRefresh } from "./healthInsightsReport.js";
import {
  buildProposedVitalsReading,
  normalizeParsedReading,
  parseVitalsText,
  type ProposedVitalsReading,
  type VitalsParsingResult,
} from "../../shared/vitalsParsing.js";
import {
  TRIAGE_VITAL_SIGNAL_MAP,
  compatibleCaptureMethods,
  measurementEnvelope,
  newestReadingBySignal,
} from "../../shared/vitalsAcquisition.js";

const router = Router();
router.use(requireUser);

const ANALYSIS_MODEL = "claude-sonnet-4-20250514";
const FALLBACK_MODEL_VERSION = "deterministic-fallback-v1";
const ALERT_TYPE = "vitals_safety_check";
const SAFETY_CONTEXT_FRESHNESS_HOURS = 48;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const parseAudioBody = raw({ type: ["audio/*", "application/octet-stream"], limit: "8mb" });

const signalReadingSchema = z.object({
  signal_type: z.string().min(1).max(80),
  value: z.coerce.number(),
  source: z.enum(VITALS_READING_SOURCES).default("manual_entry"),
  capture_method: z.enum(VITALS_CAPTURE_METHODS).default("manual"),
  context_tag: z.string().min(1).max(80).default("general"),
  unit: z.string().min(1).max(24).optional(),
  source_ref: z.record(z.unknown()).optional(),
  recorded_at: z.string().datetime().optional(),
  condition_tags: z.array(z.string()).optional().default([]),
  assessment_session_id: z.string().max(160).optional(),
});

const readingSchema = signalReadingSchema.extend({
  user_id: z.string().optional(),
});

const bulkReadingsSchema = z.object({
  user_id: z.string().optional(),
  readings: z.array(signalReadingSchema).min(1).max(24),
});

const parseTextSchema = z.object({
  text: z.string().min(1).max(500),
  source: z.enum(VITALS_READING_SOURCES).default("manual_entry"),
  capture_method: z.enum(VITALS_CAPTURE_METHODS).default("manual"),
});

const scanDevicePhotoSchema = z.object({
  image: z.string().min(1),
  language: z.string().optional(),
});

const faceScanSchema = z.object({
  video: z.string().min(1),
  fps: z.coerce.number().min(1).max(120),
  duration_seconds: z.coerce.number().min(0.1).max(180).optional(),
});

const analyseSchema = z.object({
  user_id: z.string().optional(),
}).optional();

const acknowledgeSchema = z.object({
  analysis_id: z.string().uuid().optional(),
  action: z.enum(["recheck", "dismissed", "shared", "contacted_doctor", "urgent_guidance_followed"]),
});

type RiskTier = "none" | "watch" | "notify" | "urgent";

function preventionRiskTierRank(value: unknown): number {
  const tier = String(value ?? "").toLowerCase();
  if (tier === "urgent") return 5;
  if (tier === "notify") return 4;
  if (tier === "watch") return 3;
  return 1;
}

type SignalReadingRow = {
  id?: string;
  signal_type: string;
  context_tag: string | null;
  value: string | number;
  recorded_at: Date | string;
  source: string;
  deviation_pct: string | number | null;
  capture_method?: string | null;
  unit?: string | null;
  source_ref?: Record<string, unknown> | null;
  quality_flag?: string | null;
  assessment_session_id?: string | null;
};

type SignalReadingResponse = SignalReadingRow & {
  source_confidence: "low" | "medium" | "high";
  source_confidence_reason: string;
  source_display_label: string;
  source_context_label: string;
};

type PatternWindowRow = {
  id?: string | null;
  analysed_at?: Date | string | null;
  safety_status?: string | null;
  risk_score?: number | null;
  risk_tier?: string | null;
  contributing_signals?: unknown;
  pattern_labels?: string[] | null;
  senior_message?: string | null;
  caregiver_note?: string | null;
  recommended_action?: string | null;
  alert_fired?: boolean | null;
  alert_channel?: string | null;
  model_version?: string | null;
  rule_version?: string | null;
  acknowledged_action?: string | null;
  acknowledged_at?: Date | string | null;
  resolved_at?: Date | string | null;
};

function queryRows<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return Array.isArray(result) ? result as T[] : [];
}

function daysAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function dosesPerDay(scheduledTimes: string[] | null | undefined): number {
  return scheduledTimes && scheduledTimes.length > 0 ? scheduledTimes.length : 1;
}

function todayStartUTC(): Date {
  return new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
}

function targetMatchesRequest(req: Request, profileId: string, requestedUserId?: string): boolean {
  if (!requestedUserId) return true;
  return requestedUserId === profileId || requestedUserId === req.user!.id;
}

function normalizedSource(value: string): VitalsReadingSource {
  return normalizeVitalsSource(value);
}

function normalizedCaptureMethod(value?: string | null): VitalsCaptureMethod {
  return isVitalsCaptureMethod(value) ? value : "manual";
}

function validateSignalReading(signalType: string, value: number): { signalType: VitalsSignalKey; error?: string } {
  if (!isVitalsSignalKey(signalType)) {
    return { signalType: "resting_hr_bpm", error: "Unsupported vital sign." };
  }
  const validation = validateVitalsSignalValue(signalType, value);
  if (!validation.ok) return { signalType, error: validation.reason };
  return { signalType };
}

const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mpga": "mpga",
  "audio/m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

function audioMimeType(req: Request) {
  const rawType = String(req.headers["content-type"] ?? "audio/webm").split(";")[0]?.trim().toLowerCase();
  return rawType && rawType !== "application/octet-stream" ? rawType : "audio/webm";
}

function audioFileNameFor(mimeType: string) {
  return `vitals-reading.${AUDIO_EXTENSION_BY_MIME[mimeType] ?? "webm"}`;
}

function parsingResponseFromReadings(readings: ProposedVitalsReading[], transcript: string, clarification?: string): VitalsParsingResult {
  return {
    proposed_readings: readings,
    needs_confirmation: true,
    transcript,
    ...(clarification ? { clarification_prompt: clarification } : {}),
  };
}

function vitalLensMetric(body: unknown, keys: string[]): Record<string, unknown> | null {
  const root = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const candidates = [
    root.vitals,
    (root.result as Record<string, unknown> | undefined)?.vitals,
    (root.results as Record<string, unknown> | undefined)?.vitals,
    root,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "number") return { value };
      if (value && typeof value === "object") return value as Record<string, unknown>;
    }
  }
  return null;
}

function metricNumber(metric: Record<string, unknown> | null): number | null {
  if (!metric) return null;
  const value = Number(metric.value ?? metric.estimate ?? metric.mean);
  return Number.isFinite(value) ? value : null;
}

function metricConfidence(metric: Record<string, unknown> | null): "low" | "medium" {
  const value = Number(metric?.confidence);
  if (!Number.isFinite(value)) return "low";
  return value >= 0.85 ? "medium" : "low";
}

function buildVitalLensReadings(body: unknown, durationSeconds?: number): ProposedVitalsReading[] {
  const now = new Date();
  const root = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const sourceRef = {
    provider: "rouast_vitallens",
    model: root.model ?? root.model_name ?? root.version ?? "vitallens",
    duration_seconds: durationSeconds ?? null,
    parser_version: "vyva-vitallens-face-scan-v1",
  };
  const readings: ProposedVitalsReading[] = [];
  const add = (
    metric: Record<string, unknown> | null,
    signalType: VitalsSignalKey,
    explanation: string,
    contextTag: string,
  ) => {
    const value = metricNumber(metric);
    if (value == null) return;
    const reading = buildProposedVitalsReading(
      signalType,
      Math.round(value * 10) / 10,
      explanation,
      {
        source: "phone_estimate",
        captureMethod: "phone_camera",
        confidence: metricConfidence(metric),
        now,
        contextTag,
        sourceRef,
      },
    );
    if (reading) readings.push(reading);
  };

  add(vitalLensMetric(body, ["heart_rate", "hr", "pulse"]), "resting_hr_bpm", "VitalLens face-scan heart-rate estimate.", "resting");
  add(vitalLensMetric(body, ["respiratory_rate", "breathing_rate", "rr"]), "respiratory_rate", "VitalLens face-scan breathing estimate.", "resting");
  add(vitalLensMetric(body, ["hrv_sdnn", "hrv_ms", "hrv_rmssd"]), "hrv_ms", "VitalLens face-scan HRV estimate.", "general");
  return readings;
}

async function resolveProfileId(req: Request): Promise<string> {
  try {
    const context = await getActiveProfileContext(req.user!.id);
    return context.profileId ?? req.user!.id;
  } catch (err) {
    console.warn("[vitals-engine] active profile lookup failed; using account id", err);
    return req.user!.id;
  }
}

async function getRecentReadings(userId: string, hours = 72): Promise<SignalReadingRow[]> {
  const result = await db.execute(sql`
    SELECT id, signal_type, value, recorded_at, source, deviation_pct, context_tag,
           capture_method, unit, source_ref, quality_flag, assessment_session_id
    FROM vyva_signal_readings
    WHERE user_id = ${userId}
      AND recorded_at >= ${daysAgo(hours)}
      AND quality_flag = 'clean'
    ORDER BY recorded_at DESC
  `);
  return queryRows<SignalReadingRow>(result);
}

function signalReadingResponse(reading: SignalReadingRow): SignalReadingResponse {
  const evidence = vitalsEvidenceFor(reading.source, reading.signal_type);
  return {
    ...reading,
    source_confidence: evidence.confidence,
    source_confidence_reason: evidence.reason,
    source_display_label: evidence.displayLabel,
    source_context_label: evidence.contextLabel,
  };
}

async function getLatestAnalysis(userId: string): Promise<PatternWindowRow | null> {
  const result = await db.execute(sql`
    SELECT *
    FROM vyva_pattern_windows
    WHERE user_id = ${userId}
      AND analysed_at >= ${daysAgo(SAFETY_CONTEXT_FRESHNESS_HOURS)}
    ORDER BY analysed_at DESC
    LIMIT 1
  `);
  return queryRows<PatternWindowRow>(result)[0] ?? null;
}

async function getAnalysisHistory(userId: string): Promise<PatternWindowRow[]> {
  const result = await db.execute(sql`
    SELECT *
    FROM vyva_pattern_windows
    WHERE user_id = ${userId}
    ORDER BY analysed_at DESC
    LIMIT 10
  `);
  return queryRows<PatternWindowRow>(result);
}

async function getBaselines(userId: string) {
  const result = await db.execute(sql`
    SELECT signal_type, context_tag, baseline_mean, baseline_stddev, sample_count, is_established, computed_at
    FROM vyva_user_baselines
    WHERE user_id = ${userId}
    ORDER BY signal_type, context_tag
  `);
  return queryRows<Record<string, unknown>>(result);
}

async function getLatestAlerts(userId: string, limit = 3) {
  return db
    .select({
      id: caregiverAlerts.id,
      alert_type: caregiverAlerts.alert_type,
      severity: caregiverAlerts.severity,
      message: caregiverAlerts.message,
      sent_to: caregiverAlerts.sent_to,
      resolved_at: caregiverAlerts.resolved_at,
      created_at: caregiverAlerts.created_at,
    })
    .from(caregiverAlerts)
    .where(and(
      eq(caregiverAlerts.user_id, userId),
      eq(caregiverAlerts.alert_type, ALERT_TYPE),
      isNull(caregiverAlerts.resolved_at),
      gte(caregiverAlerts.created_at, daysAgo(SAFETY_CONTEXT_FRESHNESS_HOURS)),
    ))
    .orderBy(desc(caregiverAlerts.created_at))
    .limit(limit);
}

function buildSignalSummary(readings: SignalReadingRow[]): SignalSummary[] {
  const signalMap = new Map<string, SignalReadingRow[]>();
  for (const reading of readings) {
    const key = `${reading.signal_type}|${reading.context_tag ?? "general"}`;
    signalMap.set(key, [...(signalMap.get(key) ?? []), reading]);
  }

  return [...signalMap.entries()]
    .map(([key, rows]) => {
      const [signalType, contextTag] = key.split("|");
      const values = rows.map((row) => numberOrNull(row.value)).filter((value): value is number => value !== null);
      const deviations = rows.map((row) => numberOrNull(row.deviation_pct)).filter((value): value is number => value !== null);
      const maxDeviation = deviations.length ? Math.max(...deviations.map(Math.abs)) : null;
      const latestSource = rows[0]?.source ?? null;
      const confidence = vitalsEvidenceFor(latestSource, signalType);

      let trend = "stable";
      if (values.length >= 3) {
        const first = values[values.length - 1];
        const last = values[0];
        const change = ((last - first) / Math.abs(first || 1)) * 100;
        if (change > 15) trend = "rising";
        else if (change < -15) trend = "falling";
      }

      return {
        signal: signalType,
        context: contextTag,
        recent_values: values.slice(0, 5),
        deviations_pct: deviations.slice(0, 5),
        trend,
        max_deviation: maxDeviation,
        reading_count: rows.length,
        latest_source: latestSource,
        source_confidence: confidence.confidence,
        source_confidence_reason: confidence.reason,
      };
    })
    .sort((a, b) => (b.max_deviation ?? 0) - (a.max_deviation ?? 0));
}

async function getMedicationContext(userId: string): Promise<MedicationSafetyContext> {
  const todayStart = todayStartUTC();
  const thirtyDayStart = daysAgo(30 * 24);
  const [activeMeds, adherenceRows] = await Promise.all([
    db
      .select()
      .from(userMedications)
      .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
    db
      .select()
      .from(medicationAdherence)
      .where(and(eq(medicationAdherence.user_id, userId), gte(medicationAdherence.created_at, thirtyDayStart))),
  ]);

  const scheduledToday = activeMeds.reduce((sum, med) => sum + dosesPerDay(med.scheduled_times), 0);
  const takenToday = adherenceRows.filter((row) => row.status === "taken" && row.created_at >= todayStart).length;
  const missedOrLate30 = adherenceRows.filter((row) => ["missed", "skipped", "late"].includes(row.status)).length;

  return {
    activeMedicationCount: activeMeds.length,
    scheduledToday,
    takenToday,
    missedOrLate30,
  };
}

async function getLatestTriage(userId: string): Promise<TriageSafetyContext | null> {
  const [row] = await db
    .select()
    .from(triageReports)
    .where(and(
      eq(triageReports.user_id, userId),
      gte(triageReports.created_at, daysAgo(SAFETY_CONTEXT_FRESHNESS_HOURS)),
    ))
    .orderBy(desc(triageReports.created_at))
    .limit(1);
  return row ?? null;
}

async function loadAnalysisContext(userId: string) {
  const [profile, conditionsRows, medsRows, readings, latestTriage, medication] = await Promise.all([
    db
      .select({
        full_name: profiles.full_name,
        language: profiles.language,
        language_preference: profiles.language_preference,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .orderBy(desc(profiles.created_at))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ condition: userHealthConditions.condition })
      .from(userHealthConditions)
      .where(and(eq(userHealthConditions.user_id, userId), eq(userHealthConditions.is_active, true))),
    db
      .select({
        medication_name: userMedications.medication_name,
        dosage: userMedications.dosage,
      })
      .from(userMedications)
      .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
    getRecentReadings(userId, 72),
    getLatestTriage(userId),
    getMedicationContext(userId),
  ]);

  const medications = medsRows.map((med) => med.dosage ? `${med.medication_name} ${med.dosage}` : med.medication_name);
  const signalSummary = buildSignalSummary(readings);
  const language = profile?.language_preference || profile?.language || "es";

  return {
    profile,
    language,
    conditions: conditionsRows.map((row) => row.condition),
    medications,
    readings,
    signalSummary,
    latestTriage,
    medication,
  };
}

function analysisResponse(row: PatternWindowRow | null, fallback?: DailySafetyCheck | null) {
  if (!row) return fallback ?? null;
  return {
    id: row.id ?? null,
    analysed_at: row.analysed_at ?? null,
    safety_status: row.safety_status ?? row.recommended_action ?? fallback?.safety_status ?? "steady",
    recommended_action: row.recommended_action ?? row.safety_status ?? fallback?.recommended_action ?? "steady",
    risk_score: row.risk_score ?? fallback?.risk_score ?? 0,
    risk_tier: row.risk_tier ?? fallback?.risk_tier ?? "none",
    contributing_signals: row.contributing_signals ?? fallback?.contributing_signals ?? {},
    pattern_labels: row.pattern_labels ?? fallback?.pattern_labels ?? [],
    senior_message: row.senior_message ?? fallback?.senior_message ?? null,
    caregiver_note: row.caregiver_note ?? fallback?.caregiver_note ?? null,
    alert_fired: row.alert_fired ?? false,
    alert_channel: row.alert_channel ?? null,
    model_version: row.model_version ?? FALLBACK_MODEL_VERSION,
    rule_version: row.rule_version ?? fallback?.rule_version ?? DAILY_SAFETY_RULE_VERSION,
    acknowledged_action: row.acknowledged_action ?? null,
    acknowledged_at: row.acknowledged_at ?? null,
    resolved_at: row.resolved_at ?? null,
  };
}

async function insertPatternWindow(userId: string, analysis: DailySafetyCheck, modelVersion: string) {
  const result = await db.execute(sql`
    INSERT INTO vyva_pattern_windows (
      user_id,
      safety_status,
      risk_score,
      risk_tier,
      contributing_signals,
      pattern_labels,
      senior_message,
      caregiver_note,
      recommended_action,
      alert_fired,
      model_version,
      rule_version
    )
    VALUES (
      ${userId},
      ${analysis.safety_status},
      ${analysis.risk_score},
      ${analysis.risk_tier},
      ${JSON.stringify(analysis.contributing_signals)}::jsonb,
      ${analysis.pattern_labels}::text[],
      ${analysis.senior_message},
      ${analysis.caregiver_note},
      ${analysis.recommended_action},
      false,
      ${modelVersion},
      ${analysis.rule_version}
    )
    RETURNING *
  `);
  return queryRows<PatternWindowRow>(result)[0] ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function nestedFlag(consent: Record<string, unknown>, section: string, key: string): unknown {
  const value = consent[section];
  return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

function caregiverConsentAllows(consentValue: unknown): boolean {
  const consent = asRecord(consentValue);
  const candidates = [
    consent.caregiver_health_alerts,
    consent.caregiver_full_access,
    nestedFlag(consent, "caregiver", "health_alerts"),
    nestedFlag(consent, "caregiver", "full_access"),
    nestedFlag(consent, "careteam", "caregiver_health_alerts"),
    nestedFlag(consent, "communication_preferences", "caregiver_alerts"),
  ];
  if (candidates.some((value) => value === true)) return true;
  if (candidates.some((value) => value === false)) return false;
  return true;
}

function severityFor(status: DailySafetyCheck["safety_status"]) {
  if (status === "urgent_help") return "urgent";
  if (status === "contact_doctor") return "warning";
  return "info";
}

async function maybeRecordCaregiverAlert(userId: string, analysis: DailySafetyCheck) {
  if (!statusShouldEscalate(analysis.safety_status)) return null;

  const [profile, teamRows, recentOpenAlerts] = await Promise.all([
    db
      .select({
        caregiver_name: profiles.caregiver_name,
        caregiver_contact: profiles.caregiver_contact,
        data_sharing_consent: profiles.data_sharing_consent,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        name: teamInvitations.invitee_name,
        phone: teamInvitations.invitee_phone,
        email: teamInvitations.invitee_email,
        whatsapp: teamInvitations.invitee_whatsapp,
      })
      .from(teamInvitations)
      .where(and(
        eq(teamInvitations.senior_id, userId),
        eq(teamInvitations.status, "accepted"),
        eq(teamInvitations.can_receive_health_alerts, true),
      ))
      .limit(5),
    db
      .select()
      .from(caregiverAlerts)
      .where(and(
        eq(caregiverAlerts.user_id, userId),
        eq(caregiverAlerts.alert_type, ALERT_TYPE),
        isNull(caregiverAlerts.resolved_at),
        gte(caregiverAlerts.created_at, daysAgo(12)),
      ))
      .orderBy(desc(caregiverAlerts.created_at))
      .limit(1),
  ]);

  if (recentOpenAlerts[0]) return recentOpenAlerts[0];
  if (!caregiverConsentAllows(profile?.data_sharing_consent)) return null;

  const recipients = [
    profile?.caregiver_contact || profile?.caregiver_name || "",
    ...teamRows.map((row) => row.whatsapp || row.phone || row.email || row.name || ""),
  ].filter((value, index, values) => value && values.indexOf(value) === index);

  if (recipients.length === 0) return null;

  const [alert] = await db.insert(caregiverAlerts).values({
    user_id: userId,
    alert_type: ALERT_TYPE,
    severity: severityFor(analysis.safety_status),
    message: [
      analysis.caregiver_note ?? analysis.senior_message,
      `Recommended action: ${analysis.recommended_action.replace(/_/g, " ")}.`,
    ].filter(Boolean).join("\n"),
    sent_to: recipients,
  }).returning();

  return alert;
}

async function saveSignalReading(params: {
  userId: string;
  signalType: VitalsSignalKey;
  value: number;
  source: VitalsReadingSource;
  captureMethod: VitalsCaptureMethod;
  contextTag: string;
  unit?: string;
  sourceRef?: Record<string, unknown>;
  recordedAt?: string;
  conditionTags: string[];
  assessmentSessionId?: string;
}) {
  const baselineResult = await db.execute(sql`
    SELECT baseline_mean
    FROM vyva_user_baselines
    WHERE user_id = ${params.userId}
      AND signal_type = ${params.signalType}
      AND context_tag = ${params.contextTag}
      AND is_established = true
    LIMIT 1
  `);
  const baseline = queryRows<{ baseline_mean: string | number }>(baselineResult)[0];
  const baselineMean = numberOrNull(baseline?.baseline_mean);
  const deviationPct = baselineMean ? roundOne(((params.value - baselineMean) / baselineMean) * 100) : null;

  const readingResult = await db.execute(sql`
    INSERT INTO vyva_signal_readings (
      user_id,
      signal_type,
      value,
      recorded_at,
      source,
      capture_method,
      unit,
      source_ref,
      assessment_session_id,
      context_tag,
      baseline_ref,
      deviation_pct,
      condition_tags
    )
    VALUES (
      ${params.userId},
      ${params.signalType},
      ${params.value},
      ${params.recordedAt ? new Date(params.recordedAt) : new Date()},
      ${params.source},
      ${params.captureMethod},
      ${params.unit ?? unitForSignal(params.signalType)},
      ${params.sourceRef ? JSON.stringify(params.sourceRef) : null}::jsonb,
      ${params.assessmentSessionId ?? null},
      ${params.contextTag},
      ${baselineMean},
      ${deviationPct},
      ${params.conditionTags}::text[]
    )
    RETURNING *
  `);
  return {
    reading: queryRows<Record<string, unknown>>(readingResult)[0],
    deviation_pct: deviationPct,
  };
}

type BaselineRefreshResult = {
  updated: number;
  meansBySignalContext: Map<string, number>;
};

async function refreshVitalsBaselines(profileId: string): Promise<BaselineRefreshResult> {
  const combosResult = await db.execute(sql`
    SELECT DISTINCT signal_type, context_tag
    FROM vyva_signal_readings
    WHERE user_id = ${profileId}
      AND quality_flag = 'clean'
      AND source <> 'phone_estimate'
      AND recorded_at >= ${daysAgo(14 * 24)}
  `);
  const combos = queryRows<{ signal_type: string; context_tag: string | null }>(combosResult);
  let updated = 0;
  const meansBySignalContext = new Map<string, number>();

  for (const combo of combos) {
    const contextTag = combo.context_tag ?? "general";
    const readingsResult = await db.execute(sql`
      SELECT value
      FROM vyva_signal_readings
      WHERE user_id = ${profileId}
        AND signal_type = ${combo.signal_type}
        AND COALESCE(context_tag, 'general') = ${contextTag}
        AND quality_flag = 'clean'
        AND source <> 'phone_estimate'
        AND recorded_at >= ${daysAgo(14 * 24)}
    `);

    const values = queryRows<{ value: string | number }>(readingsResult)
      .map((reading) => numberOrNull(reading.value))
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);

    if (values.length < 3) continue;

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    const stddev = Math.sqrt(variance);
    const p25 = values[Math.floor((values.length - 1) * 0.25)];
    const p75 = values[Math.floor((values.length - 1) * 0.75)];
    const roundedMean = roundOne(mean);
    const isEstablished = values.length >= 10;
    if (isEstablished) {
      meansBySignalContext.set(`${combo.signal_type}|${contextTag}`, roundedMean);
    }

    await db.execute(sql`
      INSERT INTO vyva_user_baselines (
        user_id,
        signal_type,
        context_tag,
        baseline_mean,
        baseline_stddev,
        baseline_p25,
        baseline_p75,
        sample_count,
        is_established,
        computed_at
      )
      VALUES (
        ${profileId},
        ${combo.signal_type},
        ${contextTag},
        ${roundedMean},
        ${roundOne(stddev)},
        ${roundOne(p25)},
        ${roundOne(p75)},
        ${values.length},
        ${isEstablished},
        NOW()
      )
      ON CONFLICT (user_id, signal_type, context_tag)
      DO UPDATE SET
        baseline_mean = EXCLUDED.baseline_mean,
        baseline_stddev = EXCLUDED.baseline_stddev,
        baseline_p25 = EXCLUDED.baseline_p25,
        baseline_p75 = EXCLUDED.baseline_p75,
        sample_count = EXCLUDED.sample_count,
        is_established = EXCLUDED.is_established,
        computed_at = NOW()
    `);

    if (isEstablished) {
      await db.execute(sql`
        UPDATE vyva_signal_readings
        SET baseline_ref = ${roundedMean},
            deviation_pct = CASE
              WHEN ${roundedMean} = 0 THEN NULL
              ELSE ROUND((((value - ${roundedMean}) / ABS(${roundedMean})) * 100)::numeric, 1)
            END
        WHERE user_id = ${profileId}
          AND signal_type = ${combo.signal_type}
          AND COALESCE(context_tag, 'general') = ${contextTag}
          AND baseline_ref IS NULL
          AND quality_flag = 'clean'
          AND source <> 'phone_estimate'
          AND recorded_at >= ${daysAgo(14 * 24)}
      `);
    }
    updated += 1;
  }

  return { updated, meansBySignalContext };
}

async function saveValidatedReadings(
  profileId: string,
  readings: z.infer<typeof signalReadingSchema>[],
) {
  const saved: Array<{ reading: Record<string, unknown>; deviation_pct: number | null }> = [];
  const savedSignalContexts: Array<{
    signalType: VitalsSignalKey;
    contextTag: string;
    source: VitalsReadingSource;
    value: number;
  }> = [];
  let shouldAnalyse = false;

  for (const reading of readings) {
    const { signalType, error } = validateSignalReading(reading.signal_type, reading.value);
    if (error) {
      const err = new Error(error) as Error & { status?: number };
      err.status = 400;
      throw err;
    }

    const source = normalizedSource(reading.source);
    const contextTag = reading.context_tag || defaultContextForSignal(signalType);
    const result = await saveSignalReading({
      userId: profileId,
      signalType,
      value: reading.value,
      source,
      captureMethod: normalizedCaptureMethod(reading.capture_method),
      contextTag,
      unit: reading.unit ?? unitForSignal(signalType),
      sourceRef: reading.source_ref,
      recordedAt: reading.recorded_at,
      conditionTags: reading.condition_tags,
      assessmentSessionId: reading.assessment_session_id,
    });
    saved.push(result);
    savedSignalContexts.push({ signalType, contextTag, source, value: reading.value });
    if (source !== "phone_estimate" && result.deviation_pct !== null && Math.abs(result.deviation_pct) > 25) {
      shouldAnalyse = true;
    }
  }

  const baselineRefresh = await refreshVitalsBaselines(profileId).catch((err) => {
    console.error("[vitals-engine baseline refresh after save]", err);
    return { updated: 0, meansBySignalContext: new Map<string, number>() };
  });
  if (!shouldAnalyse) {
    shouldAnalyse = savedSignalContexts.some(({ signalType, contextTag, source, value }) => {
      if (source === "phone_estimate") return false;
      const mean = baselineRefresh.meansBySignalContext.get(`${signalType}|${contextTag}`);
      return mean !== undefined && mean !== 0 && Math.abs(((value - mean) / Math.abs(mean)) * 100) > 25;
    });
  }

  if (shouldAnalyse) {
    runAnalysis(profileId, { refreshBaselines: false }).catch((err) => console.error("[vitals-engine analysis trigger]", err));
  }

  return saved;
}

router.post("/reading", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!targetMatchesRequest(req, profileId, parsed.data.user_id)) {
    return res.status(403).json({ error: "Cannot save readings for another user" });
  }

  try {
    const [result] = await saveValidatedReadings(profileId, [parsed.data]);
    return res.json({ ...result, saved_count: 1 });
  } catch (err) {
    const status = typeof (err as { status?: unknown }).status === "number" ? (err as { status: number }).status : 500;
    if (status === 500) console.error("[vitals-engine reading]", err);
    return res.status(status).json({ error: status === 500 ? "Failed to save vitals reading" : String((err as Error).message) });
  }
});

router.post("/readings", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  const parsed = bulkReadingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!targetMatchesRequest(req, profileId, parsed.data.user_id)) {
    return res.status(403).json({ error: "Cannot save readings for another user" });
  }

  try {
    const results = await saveValidatedReadings(profileId, parsed.data.readings);
    return res.status(201).json({
      readings: results.map((result) => result.reading),
      saved_count: results.length,
    });
  } catch (err) {
    const status = typeof (err as { status?: unknown }).status === "number" ? (err as { status: number }).status : 500;
    if (status === 500) console.error("[vitals-engine readings]", err);
    return res.status(status).json({ error: status === 500 ? "Failed to save vitals readings" : String((err as Error).message) });
  }
});

router.post("/parse-text", async (req: Request, res: Response) => {
  const parsed = parseTextSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = parseVitalsText(parsed.data.text, {
    source: parsed.data.source,
    captureMethod: parsed.data.capture_method,
    confidence: "medium",
  });
  return res.json(result);
});

router.post("/parse-audio", parseAudioBody, async (req: Request, res: Response) => {
  const audio = Buffer.isBuffer(req.body) ? req.body : null;
  if (!audio || audio.length < 32) return res.status(400).json({ error: "audio is required" });

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) return res.status(503).json({ error: "Voice reading is not configured." });

  try {
    const mimeType = audioMimeType(req);
    const client = new OpenAI({ apiKey });
    const file = await OpenAI.toFile(audio, audioFileNameFor(mimeType), { type: mimeType });
    const transcription = await client.audio.transcriptions.create({
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
      file,
      prompt: "Transcribe a short home vital-sign reading. Examples: blood pressure, oxygen, glucose, temperature, pulse, weight, pain, mood, sleep, energy, medication taken.",
    });
    const transcript = transcription.text.trim();
    if (!transcript) return res.status(422).json({ error: "No speech detected." });
    return res.json(parseVitalsText(transcript, { source: "manual_entry", captureMethod: "voice", confidence: "medium" }));
  } catch (err) {
    console.error("[vitals-engine parse-audio]", err);
    return res.status(500).json({ error: "Failed to read voice vital." });
  }
});

router.post("/scan-device-photo", async (req: Request, res: Response) => {
  const parsed = scanDevicePhotoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    return res.json(parsingResponseFromReadings([], "", "Photo reading is not configured. You can type the number instead."));
  }

  const match = parsed.data.image.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: "image must be a base64 data URL" });

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content: [
            "You read numbers from home health device screens for an older-adult app.",
            "Return JSON only with proposed_readings: signal_type, value, context_tag, explanation.",
            "Allowed signal_type values: resting_hr_bpm, respiratory_rate, bp_systolic, bp_diastolic, oxygen_saturation, temperature_c, glucose_mgdl, weight_kg, pain_score, mood_score, energy_level, sleep_quality_score, medication_confirmed.",
            "If blood pressure appears, return systolic and diastolic separately. Do not diagnose.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: parsed.data.image, detail: "low" },
            },
            {
              type: "text",
              text: "Read the visible health measurement from this device screen. Return only JSON.",
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const parsedJson = JSON.parse(raw) as { proposed_readings?: unknown[]; clarification_prompt?: string };
    const readings = (Array.isArray(parsedJson.proposed_readings) ? parsedJson.proposed_readings : [])
      .map((row) => normalizeParsedReading(row, { source: "manual_entry", captureMethod: "device_photo", confidence: "medium" }))
      .filter((row): row is ProposedVitalsReading => Boolean(row));

    return res.json(parsingResponseFromReadings(readings, "", parsedJson.clarification_prompt));
  } catch (err) {
    console.error("[vitals-engine scan-device-photo]", err);
    return res.status(500).json({ error: "Failed to read device photo." });
  }
});

router.post("/face-scan", async (req: Request, res: Response) => {
  const parsed = faceScanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const apiKey = process.env.VITALLENS_API_KEY ?? "";
  if (!apiKey) {
    return res.json(parsingResponseFromReadings(
      [],
      "",
      "Face scan is not configured yet. You can use phone estimate, Bluetooth, voice, scan, or type instead.",
    ));
  }

  try {
    const apiBase = (process.env.VITALLENS_API_BASE || "https://api.rouast.com/vitallens-v3").replace(/\/+$/, "");
    const upstream = await fetch(`${apiBase}/file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        video: parsed.data.video,
        fps: parsed.data.fps,
        process_signals: "1",
      }),
    });

    const body = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("[vitals-engine face-scan upstream]", upstream.status, body);
      return res.status(502).json({ error: "Face scan service did not return a reading." });
    }

    const readings = buildVitalLensReadings(body, parsed.data.duration_seconds);
    return res.json(parsingResponseFromReadings(
      readings,
      "",
      readings.length
        ? "Confirm these face-scan estimates before VYVA saves them."
        : "Face scan completed, but no usable heart or breathing reading was found. Try better light and hold still.",
    ));
  } catch (err) {
    console.error("[vitals-engine face-scan]", err);
    return res.status(500).json({ error: "Failed to process face scan." });
  }
});

router.post("/analyse", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  const parsed = analyseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!targetMatchesRequest(req, profileId, parsed.data?.user_id)) {
    return res.status(403).json({ error: "Cannot analyse readings for another user" });
  }

  try {
    const analysis = await runAnalysis(profileId);
    return res.json(analysis);
  } catch (err) {
    console.error("[vitals-engine analyse]", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to analyse vitals" });
  }
});

router.post("/acknowledge", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  const parsed = acknowledgeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = parsed.data.analysis_id
      ? await db.execute(sql`
          UPDATE vyva_pattern_windows
          SET acknowledged_action = ${parsed.data.action},
              acknowledged_at = NOW(),
              resolved_at = CASE WHEN ${parsed.data.action} = 'dismissed' THEN NOW() ELSE resolved_at END
          WHERE id = ${parsed.data.analysis_id}
            AND user_id = ${profileId}
          RETURNING *
        `)
      : await db.execute(sql`
          UPDATE vyva_pattern_windows
          SET acknowledged_action = ${parsed.data.action},
              acknowledged_at = NOW(),
              resolved_at = CASE WHEN ${parsed.data.action} = 'dismissed' THEN NOW() ELSE resolved_at END
          WHERE id = (
            SELECT id
            FROM vyva_pattern_windows
            WHERE user_id = ${profileId}
            ORDER BY analysed_at DESC
            LIMIT 1
          )
          RETURNING *
        `);

    const row = queryRows<PatternWindowRow>(result)[0];
    if (!row) return res.status(404).json({ error: "Analysis not found" });

    await db
      .update(caregiverAlerts)
      .set({
        resolved_at: new Date(),
        resolved_by: profileId,
      })
      .where(and(
        eq(caregiverAlerts.user_id, profileId),
        eq(caregiverAlerts.alert_type, ALERT_TYPE),
        isNull(caregiverAlerts.resolved_at),
      ));

    return res.json(analysisResponse(row));
  } catch (err) {
    console.error("[vitals-engine acknowledge]", err);
    return res.status(500).json({ error: "Failed to acknowledge safety check" });
  }
});

async function sendLatestVitalsIntelligence(profileId: string, res: Response) {
  try {
    const context = await loadAnalysisContext(profileId);
    const fallback = buildDailySafetyCheck({
      signalSummary: context.signalSummary,
      latestTriage: context.latestTriage,
      medication: context.medication,
      language: context.language,
    });
    const [analysis, baselines, alerts] = await Promise.all([
      getLatestAnalysis(profileId),
      getBaselines(profileId),
      getLatestAlerts(profileId, 3),
    ]);

    return res.json({
      analysis: analysisResponse(analysis, fallback),
      recent_readings: context.readings.map(signalReadingResponse),
      baselines,
      latest_alert: alerts[0] ?? null,
      recent_alerts: alerts,
    });
  } catch (err) {
    console.error("[vitals-engine latest]", err);
    return res.status(500).json({ error: "Failed to load vitals intelligence" });
  }
}

router.get("/latest", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  return sendLatestVitalsIntelligence(profileId, res);
});

router.get("/latest/:requestedUserId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  if (!targetMatchesRequest(req, profileId, req.params.requestedUserId)) {
    return res.status(403).json({ error: "Cannot read readings for another user" });
  }
  return sendLatestVitalsIntelligence(profileId, res);
});

router.get("/acquisition-context", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  const requestedSignals = String(req.query.signals ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(isVitalsSignalKey);
  const signalTypes: VitalsSignalKey[] = requestedSignals.length
    ? requestedSignals
    : [...new Set(Object.values(TRIAGE_VITAL_SIGNAL_MAP).flat())];

  try {
    const [readingRows, deviceRows] = await Promise.all([
      getRecentReadings(profileId, 24),
      db.select().from(userDeviceConnections).where(and(
        eq(userDeviceConnections.user_id, profileId),
        eq(userDeviceConnections.is_active, true),
      )),
    ]);
    const readings = readingRows
      .filter((reading) => isVitalsSignalKey(reading.signal_type) && signalTypes.includes(reading.signal_type))
      .map((reading) => measurementEnvelope({
        id: reading.id,
        signalType: reading.signal_type as VitalsSignalKey,
        value: reading.value,
        unit: reading.unit,
        recordedAt: reading.recorded_at,
        source: reading.source,
        captureMethod: reading.capture_method,
        qualityFlag: reading.quality_flag,
        sourceRef: reading.source_ref,
        assessmentSessionId: reading.assessment_session_id,
      }));
    const latestBySignal = newestReadingBySignal(readings);

    return res.json({
      signals: signalTypes.map((signalType) => {
        const latestReading = latestBySignal.get(signalType) ?? null;
        return {
          signal_type: signalType,
          current_reading: latestReading?.freshness === "current" ? latestReading : null,
          latest_reading: latestReading,
          compatible_methods: compatibleCaptureMethods(signalType),
        };
      }),
      readings,
      devices: deviceRows.map((row) => ({
        id: row.device_kind,
        provider: row.provider,
        deviceName: row.device_label,
        status: row.status,
        capabilities: row.capabilities ?? [],
        connectedAt: row.connected_at,
        lastSyncedAt: row.last_synced_at,
        metadata: row.metadata ?? {},
      })),
      policy: { current_minutes: 30, context_hours: 24, hrv_triage_enabled: false },
    });
  } catch (err) {
    console.error("[vitals-engine acquisition-context]", err);
    return res.status(500).json({ error: "Failed to load vitals acquisition context" });
  }
});

router.get("/history", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  try {
    const rows = await getAnalysisHistory(profileId);
    return res.json({ analyses: rows.map((row) => analysisResponse(row)) });
  } catch (err) {
    console.error("[vitals-engine history]", err);
    return res.status(500).json({ error: "Failed to load vitals safety history" });
  }
});

router.get("/caregiver/latest-alerts", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);
  try {
    const access = await resolveDomainAccess({
      actorUserId: req.user!.id,
      targetUserId: profileId,
      domain: "safety",
      requiredPermission: "view_alerts",
      actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
      actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
    });
    if (!access) return res.status(403).json({ error: "Caregiver safety alert access is not enabled." });

    const [alerts, analysis] = await Promise.all([
      getLatestAlerts(profileId, 5),
      getLatestAnalysis(profileId),
    ]);
    return res.json({
      alerts,
      latest_analysis: analysisResponse(analysis),
    });
  } catch (err) {
    console.error("[vitals-engine caregiver alerts]", err);
    return res.status(500).json({ error: "Failed to load caregiver safety alerts" });
  }
});

router.post("/baseline/update", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req);

  try {
    const result = await refreshVitalsBaselines(profileId);
    return res.json({ updated: result.updated });
  } catch (err) {
    console.error("[vitals-engine baseline]", err);
    return res.status(500).json({ error: "Failed to update vitals baselines" });
  }
});

export async function runAnalysis(userId: string, options: { refreshBaselines?: boolean } = {}) {
  if (options.refreshBaselines !== false) {
    await refreshVitalsBaselines(userId).catch((err) => {
      console.error("[vitals-engine baseline refresh before analysis]", err);
    });
  }
  const context = await loadAnalysisContext(userId);
  const deterministic = buildDailySafetyCheck({
    signalSummary: context.signalSummary,
    latestTriage: context.latestTriage,
    medication: context.medication,
    language: context.language,
  });

  const aiSuggestion = await callClaude({
    name: context.profile?.full_name || "usted",
    conditions: context.conditions,
    medications: context.medications,
    language: context.language,
    signalSummary: context.signalSummary,
    deterministic,
  });

  const analysis = mergeAiSafetySuggestion(deterministic, aiSuggestion);
  const modelVersion = aiSuggestion ? ANALYSIS_MODEL : FALLBACK_MODEL_VERSION;
  const stored = await insertPatternWindow(userId, analysis, modelVersion);
  const alert = await maybeRecordCaregiverAlert(userId, analysis).catch((err) => {
    console.error("[vitals-engine caregiver alert]", err);
    return null;
  });

  if (alert && stored?.id) {
    await db.execute(sql`
      UPDATE vyva_pattern_windows
      SET alert_fired = true,
          alert_channel = 'caregiver_alerts'
      WHERE id = ${stored.id}
        AND user_id = ${userId}
    `);
  }

  if (preventionRiskTierRank(analysis.risk_tier) >= 3) {
    void triggerPreventionPlanRefresh({
      userId,
      triggerType: "vitals_deviation",
      triggerData: {
        risk_tier: analysis.risk_tier,
        pattern_labels: analysis.pattern_labels,
        pattern_window_id: stored?.id ?? null,
      },
    }).catch((err) => console.error("[vitals-engine prevention refresh]", err));
  }

  return {
    ...analysis,
    id: stored?.id ?? null,
    analysed_at: stored?.analysed_at ?? null,
    alert_fired: Boolean(alert),
    alert_channel: alert ? "caregiver_alerts" : null,
    model_version: modelVersion,
  };
}

async function callClaude(input: {
  name: string;
  conditions: string[];
  medications: string[];
  language: string;
  signalSummary: SignalSummary[];
  deterministic: DailySafetyCheck;
}): Promise<AiSafetySuggestion | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (input.signalSummary.length < 2 && input.deterministic.safety_status === "recheck") return null;

  const system = `You are VYVA's wellness-first health intelligence analyst for older adults.

Return only valid JSON with these keys:
risk_score, risk_tier, contributing_signals, pattern_labels, senior_message, caregiver_note, recommended_action.

Allowed recommended_action values:
steady, recheck, share_with_caregiver, contact_doctor, urgent_help.

Rules:
- This is not diagnosis. Do not name a disease prediction.
- The deterministic safety layer is the minimum safety level. Do not downgrade it.
- A trend across related signals matters more than one mild reading.
- senior_message must be warm, practical, in the user's language, max 35 words.
- caregiver_note may be concise and slightly more clinical.
- If data is insufficient, keep the deterministic recommendation.`;

  const payload = {
    user: {
      name: input.name,
      conditions: input.conditions,
      medications: input.medications,
      language: input.language,
    },
    signal_window_hours: 72,
    deterministic_minimum: input.deterministic,
    signals: input.signalSummary,
  };

  try {
    const response = await anthropic.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: JSON.stringify(payload, null, 2) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    if (!text) return null;

    return JSON.parse(text) as AiSafetySuggestion;
  } catch (err) {
    console.warn("[vitals-engine claude fallback]", err);
    return null;
  }
}

export default router;
