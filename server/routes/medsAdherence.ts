import { Router } from "express";
import type { Request, Response } from "express";
import { eq, and, desc, gte, inArray, isNull } from "drizzle-orm";
import { db, pool } from "../db.js";
import {
  caregiverAlerts,
  interactionFlagDismissals,
  interactionFlagRules,
  medicationAdherence,
  medicationInventoryEvents,
  medicationSafetyCaseEvents,
  medicationSafetyCases,
  medicationSafetySignals,
  myMedicines,
  myMedicinesChangeLog,
  profiles,
  teamInvitations,
  triageReports,
  userMedications,
  vyvaPatternWindows,
} from "../../shared/schema.js";
import { requireUser } from "../middleware/auth.js";
import { requireActiveProfileId } from "../lib/profileAccess.js";
import { resolveDomainAccess } from "../lib/caregiverDomainAccess.js";
import { z } from "zod";
import {
  MEDICATION_SAFETY_CASE_STATUSES,
  MEDICATION_SAFETY_SEVERITIES,
  MEDICATION_SAFETY_SIGNAL_TYPES,
  buildMedicationSafetyCaseExport,
  buildMedicationSafetySignals,
  medicationSafetyCaseMissingFields,
  type MedicationSafetyCaseLike,
  type MedicationSafetyCaseStatus,
  type MedicationSafetySeverity,
  type MedicationSafetySignalCandidate,
  type MedicationSafetySignalType,
} from "../lib/medicationSafety.js";
import {
  MEDICINE_CLASS_TAGS,
  computeMedicationInteractionFlags,
  isMedicineClassTag,
  normalizedMedicinePair,
} from "../lib/medicationInteractions.js";
import { buildMedicationUpdates } from "../lib/medicationUpdates.js";
import { triggerPreventionPlanRefresh } from "./healthInsightsReport.js";

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

function scheduledTimesForDay(scheduledTimes: string[] | null | undefined): string[] {
  return scheduledTimes && scheduledTimes.length > 0 ? scheduledTimes : ["anytime"];
}

function scheduledTimeSortKey(value: string): number {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

function takenDoseCount(rows: Array<{ status: string }>): number {
  return rows.filter((row) => row.status === "taken").length;
}

function adherenceTimestamp(row: typeof medicationAdherence.$inferSelect): Date {
  const value = row.confirmed_taken_at ?? row.created_at;
  return value instanceof Date ? value : new Date(value);
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

const OPEN_MEDICATION_SAFETY_CASE_STATUSES: MedicationSafetyCaseStatus[] = ["draft", "needs_review"];

const medicationSafetyCasePatchSchema = z.object({
  status: z.enum(MEDICATION_SAFETY_CASE_STATUSES).optional(),
  severity: z.enum(MEDICATION_SAFETY_SEVERITIES).optional(),
  signal_type: z.enum(MEDICATION_SAFETY_SIGNAL_TYPES).optional(),
  suspected_medication: z.string().nullable().optional(),
  reaction: z.string().nullable().optional(),
  reaction_started_at: z.string().nullable().optional(),
  seriousness_flags: z.array(z.string()).optional(),
  outcome: z.string().nullable().optional(),
  action_taken: z.string().nullable().optional(),
  reporter_name: z.string().nullable().optional(),
  reporter_contact: z.string().nullable().optional(),
  reporter_role: z.string().nullable().optional(),
  narrative: z.string().nullable().optional(),
});

const medicationSafetyCaseCreateSchema = medicationSafetyCasePatchSchema.extend({
  signal_type: z.enum(MEDICATION_SAFETY_SIGNAL_TYPES).default("possible_side_effect"),
  severity: z.enum(MEDICATION_SAFETY_SEVERITIES).default("attention"),
}).refine((value) => {
  return Boolean(value.suspected_medication?.trim() || value.reaction?.trim() || value.narrative?.trim());
}, {
  message: "Add a suspected medication, reaction, or narrative before creating a safety case.",
});

const medicineClassTagSchema = z.enum([...MEDICINE_CLASS_TAGS] as [typeof MEDICINE_CLASS_TAGS[number], ...typeof MEDICINE_CLASS_TAGS[number][]]);

const myMedicineFieldsSchema = z.object({
  display_name: z.string().trim().min(1).max(160),
  common_name: z.string().trim().max(160).optional().nullable(),
  dose_text: z.string().trim().max(180).optional().nullable(),
  purpose_text: z.string().trim().max(220).optional().nullable(),
  item_type: z.enum(["prescription", "otc", "supplement"]).default("prescription"),
  drug_class_tag: medicineClassTagSchema.optional().nullable(),
  photo_url: z.string().trim().max(500).optional().nullable(),
  prescriber_name: z.string().trim().max(160).optional().nullable(),
  refill_due_date: z.string().trim().max(20).optional().nullable(),
  schedule_times: z.array(z.string().trim().max(20)).max(8).optional().nullable(),
  dose_unit: z.string().trim().min(1).max(40).optional().nullable(),
  units_per_dose: z.coerce.number().positive().max(1000).optional().nullable(),
  inventory_unit: z.string().trim().min(1).max(40).optional().nullable(),
  inventory_units_per_dose: z.coerce.number().positive().max(1000).optional().nullable(),
  daily_frequency: z.coerce.number().positive().max(24).optional().nullable(),
  inventory_tracking_enabled: z.boolean().default(false),
  refill_alert_days: z.coerce.number().int().min(1).max(90).default(7),
  initial_quantity: z.coerce.number().nonnegative().max(1_000_000).optional().nullable(),
  purchased_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  added_via: z.enum(["voice", "manual", "photo", "discharge_flow"]).default("manual"),
});

const myMedicineCreateSchema = myMedicineFieldsSchema.superRefine((value, context) => {
  if (!value.inventory_tracking_enabled) return;
  const required: Array<[keyof typeof value, unknown]> = [
    ["inventory_unit", value.inventory_unit ?? value.dose_unit],
    ["inventory_units_per_dose", value.inventory_units_per_dose ?? value.units_per_dose],
    ["daily_frequency", value.daily_frequency],
    ["initial_quantity", value.initial_quantity],
    ["purchased_on", value.purchased_on],
  ];
  for (const [path, entry] of required) {
    if (entry === undefined || entry === null || entry === "") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: "Required when refill tracking is enabled" });
    }
  }
  if (value.purchased_on && value.purchased_on > todayDateString()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["purchased_on"], message: "Purchase date cannot be in the future" });
  }
});

const myMedicinePatchSchema = myMedicineFieldsSchema.partial().extend({
  status: z.enum(["active", "paused", "discontinued"]).optional(),
  status_changed_by: z.enum(["user", "caregiver"]).optional(),
});

const interactionDismissSchema = z.object({
  medicine_pair: z.array(z.string()).length(2),
  reason: z.enum(["asked_pharmacist", "not_now", "already_knew"]).default("not_now"),
});

let medicationSafetyPersistencePromise: Promise<void> | null = null;
let myMedicinesPersistencePromise: Promise<void> | null = null;

async function ensureMedicationSafetyTables() {
  if (!medicationSafetyPersistencePromise) {
    medicationSafetyPersistencePromise = (async () => {
      await pool.query(`
        create table if not exists medication_safety_signals (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          signal_type text not null,
          severity text not null default 'watch',
          title text not null,
          summary text not null,
          medication_name text,
          source text not null default 'meds',
          evidence jsonb not null default '[]'::jsonb,
          status text not null default 'open',
          related_case_id uuid,
          detected_at timestamptz not null default now(),
          created_at timestamptz not null default now()
        )
      `);
      await pool.query(`
        create table if not exists medication_safety_cases (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          status text not null default 'draft',
          severity text not null default 'watch',
          signal_type text not null default 'possible_side_effect',
          suspected_medication text,
          reaction text,
          reaction_started_at timestamptz,
          seriousness_flags text[] not null default '{}',
          outcome text,
          action_taken text,
          reporter_name text,
          reporter_contact text,
          reporter_role text not null default 'patient_or_caregiver',
          narrative text,
          evidence jsonb not null default '[]'::jsonb,
          missing_fields text[] not null default '{}',
          export_ready boolean not null default false,
          latest_export_json jsonb,
          shared_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      await pool.query(`
        create table if not exists medication_safety_case_events (
          id uuid primary key default gen_random_uuid(),
          case_id uuid not null references medication_safety_cases(id) on delete cascade,
          user_id text not null,
          event_type text not null,
          actor_id text,
          payload jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        )
      `);
      await pool.query(`create index if not exists medication_safety_signals_user_time_idx on medication_safety_signals (user_id, detected_at desc)`);
      await pool.query(`create index if not exists medication_safety_signals_user_status_idx on medication_safety_signals (user_id, status)`);
      await pool.query(`create index if not exists medication_safety_cases_user_status_idx on medication_safety_cases (user_id, status)`);
      await pool.query(`create index if not exists medication_safety_cases_user_type_idx on medication_safety_cases (user_id, signal_type, created_at desc)`);
      await pool.query(`create index if not exists medication_safety_case_events_case_time_idx on medication_safety_case_events (case_id, created_at desc)`);
      await pool.query(`create index if not exists medication_safety_case_events_user_time_idx on medication_safety_case_events (user_id, created_at desc)`);
    })().catch((err) => {
      medicationSafetyPersistencePromise = null;
      throw err;
    });
  }

  return medicationSafetyPersistencePromise;
}

async function ensureMyMedicinesTables() {
  if (!myMedicinesPersistencePromise) {
    myMedicinesPersistencePromise = (async () => {
      await pool.query(`
        create table if not exists my_medicines (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          display_name text not null,
          common_name text,
          dose_text text,
          purpose_text text,
          item_type text not null default 'prescription',
          drug_class_tag text,
          photo_url text,
          prescriber_name text,
          refill_due_date date,
          schedule_times text[],
          status text not null default 'active',
          status_changed_at timestamptz,
          status_changed_by text,
          added_via text not null default 'voice',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      await pool.query(`alter table if exists my_medicines add column if not exists purpose_text text`);
      await pool.query(`alter table if exists my_medicines add column if not exists drug_class_tag text`);
      await pool.query(`alter table if exists my_medicines add column if not exists photo_url text`);
      await pool.query(`alter table if exists my_medicines add column if not exists prescriber_name text`);
      await pool.query(`alter table if exists my_medicines add column if not exists refill_due_date date`);
      await pool.query(`alter table if exists my_medicines add column if not exists dose_unit text`);
      await pool.query(`alter table if exists my_medicines add column if not exists units_per_dose numeric(10,2)`);
      await pool.query(`alter table if exists my_medicines add column if not exists inventory_unit text`);
      await pool.query(`alter table if exists my_medicines add column if not exists inventory_units_per_dose numeric(10,2)`);
      await pool.query(`alter table if exists my_medicines add column if not exists daily_frequency numeric(6,2)`);
      await pool.query(`alter table if exists my_medicines add column if not exists inventory_tracking_enabled boolean not null default false`);
      await pool.query(`alter table if exists my_medicines add column if not exists refill_alert_days integer not null default 7`);
      await pool.query(`alter table if exists my_medicines add column if not exists schedule_times text[]`);
      await pool.query(`alter table if exists my_medicines add column if not exists status_changed_at timestamptz`);
      await pool.query(`alter table if exists my_medicines add column if not exists status_changed_by text`);
      await pool.query(`alter table if exists my_medicines add column if not exists updated_at timestamptz not null default now()`);
      await pool.query(`
        create table if not exists medication_inventory_events (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          medicine_id uuid not null references my_medicines(id) on delete cascade,
          event_type text not null,
          quantity numeric(12,2) not null,
          unit text not null,
          occurred_on date not null,
          source text not null default 'manual',
          actor_user_id text not null,
          actor_role text not null default 'user',
          actor_name text,
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        )
      `);
      await pool.query(`create index if not exists medication_inventory_events_user_medicine_date_idx on medication_inventory_events (user_id, medicine_id, occurred_on desc)`);
      await pool.query(`
        create table if not exists my_medicines_change_log (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          medicine_id uuid references my_medicines(id) on delete set null,
          change_type text not null,
          previous_value jsonb,
          new_value jsonb,
          source text not null default 'voice_update',
          changed_at timestamptz not null default now()
        )
      `);
      await pool.query(`
        create table if not exists interaction_flag_rules (
          id uuid primary key default gen_random_uuid(),
          class_a text not null,
          class_b text not null,
          flag_message_es text not null,
          flag_message_de text not null,
          flag_message_en text not null,
          severity_tier text not null default 'worth_asking',
          is_active boolean not null default false,
          reviewed_by text,
          reviewed_at timestamptz,
          created_at timestamptz not null default now()
        )
      `);
      await pool.query(`
        create table if not exists interaction_flag_dismissals (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          rule_id uuid not null references interaction_flag_rules(id) on delete cascade,
          medicine_pair jsonb not null,
          dismissed_at timestamptz not null default now(),
          reason text
        )
      `);
      await pool.query(`create index if not exists idx_mm_user_status on my_medicines (user_id, status)`);
      await pool.query(`create index if not exists idx_mm_refill_due on my_medicines (user_id, refill_due_date) where status = 'active'`);
      await pool.query(`create index if not exists idx_mcl_user_time on my_medicines_change_log (user_id, changed_at desc)`);
      await pool.query(`create index if not exists idx_ifr_classes on interaction_flag_rules (class_a, class_b) where is_active = true`);
      await pool.query(`create unique index if not exists interaction_flag_rules_class_pair_unique on interaction_flag_rules (class_a, class_b)`);
      await pool.query(`create index if not exists interaction_flag_dismissals_user_rule_idx on interaction_flag_dismissals (user_id, rule_id)`);
      await pool.query(`
        insert into interaction_flag_rules
          (class_a, class_b, flag_message_es, flag_message_de, flag_message_en, is_active)
        values
          ('blood_pressure_lowering', 'nsaid_pain_reliever',
           'Tienes un medicamento para la tension y un antiinflamatorio en tu lista; vale la pena preguntarle a tu farmaceutico si van bien juntos.',
           'Du hast ein Blutdruckmedikament und ein Schmerzmittel auf deiner Liste; es lohnt sich, deinen Apotheker zu fragen, ob das zusammenpasst.',
           'You have a blood pressure medicine and a pain reliever on your list; worth asking your pharmacist if they go well together.',
           false),
          ('blood_thinner', 'nsaid_pain_reliever',
           'Tienes un anticoagulante y un antiinflamatorio en tu lista; vale la pena comentarlo con tu farmaceutico.',
           'Du hast ein Blutverduennungsmittel und ein Schmerzmittel auf deiner Liste; sprich am besten mit deinem Apotheker darueber.',
           'You have a blood thinner and a pain reliever on your list; worth mentioning to your pharmacist.',
           false),
          ('sedative_sleep_aid', 'opioid_pain_reliever',
           'Tienes una pastilla para dormir y un analgesico fuerte en tu lista; tu farmaceutico puede confirmarte si esta bien combinarlos.',
           'Du hast ein Schlafmittel und ein starkes Schmerzmittel auf deiner Liste; dein Apotheker kann dir sagen, ob das zusammenpasst.',
           'You have a sleep aid and a strong pain reliever on your list; your pharmacist can confirm if that combination is fine.',
           false),
          ('diuretic_water_pill', 'blood_pressure_lowering',
           'Tienes una pastilla de agua y un medicamento para la tension; es buena idea que tu farmaceutico revise como trabajan juntos.',
           'Du hast eine Wassertablette und ein Blutdruckmedikament; es ist gut, wenn dein Apotheker sich das gemeinsam ansieht.',
           'You have a water pill and a blood pressure medicine; good idea to have your pharmacist review how they work together.',
           false),
          ('antidepressant', 'sedative_sleep_aid',
           'Tienes un medicamento para el animo y una pastilla para dormir; vale la pena preguntarle a tu medico o farmaceutico si van bien juntos.',
           'Du hast ein Medikament fuer die Stimmung und ein Schlafmittel; frag am besten deinen Arzt oder Apotheker, ob das zusammenpasst.',
           'You have a mood medicine and a sleep aid; worth asking your doctor or pharmacist if they go well together.',
           false),
          ('statin_cholesterol', 'supplement_herbal',
           'Tienes un medicamento para el colesterol y un suplemento en tu lista; comentalo a tu farmaceutico para estar tranquilo.',
           'Du hast ein Cholesterinmedikament und ein Nahrungsergaenzungsmittel auf deiner Liste; sprich das bei deinem Apotheker an.',
           'You have a cholesterol medicine and a supplement on your list; mention it to your pharmacist just to be safe.',
           false)
        on conflict (class_a, class_b) do nothing
      `);
    })().catch((err) => {
      myMedicinesPersistencePromise = null;
      throw err;
    });
  }

  return myMedicinesPersistencePromise;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function severityRank(severity: string | null | undefined): number {
  if (severity === "urgent") return 3;
  if (severity === "attention") return 2;
  return 1;
}

function strongestSeverity(values: Array<string | null | undefined>): MedicationSafetySeverity {
  return values.reduce<MedicationSafetySeverity>((best, value) => {
    if (severityRank(value) > severityRank(best)) return value as MedicationSafetySeverity;
    return best;
  }, "watch");
}

function evidenceArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

function dateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateStringOrNull(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? trimmed.slice(0, 10) : null;
}

function scheduleTimesFromText(value: string | null | undefined): string[] {
  const textValue = (value ?? "").toLowerCase();
  const explicitTimes = Array.from(textValue.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g))
    .map((match) => `${match[1].padStart(2, "0")}:${match[2]}`);
  if (explicitTimes.length) return Array.from(new Set(explicitTimes));
  if (/\b(twice|two times|2 times|morning and night|morning and evening|twice daily)\b/.test(textValue)) {
    return ["08:00", "20:00"];
  }
  if (/\b(three times|3 times|three daily)\b/.test(textValue)) {
    return ["08:00", "14:00", "20:00"];
  }
  if (/\b(bed|bedtime|night|evening)\b/.test(textValue)) return ["20:00"];
  if (/\b(noon|lunch|afternoon)\b/.test(textValue)) return ["14:00"];
  if (/\b(morning|breakfast)\b/.test(textValue)) return ["08:00"];
  return ["anytime"];
}

function cleanScheduleTimes(values: string[] | null | undefined, fallbackText?: string | null): string[] {
  const cleaned = (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 8);
  return cleaned.length ? cleaned : scheduleTimesFromText(fallbackText);
}

function myMedicineName(row: typeof myMedicines.$inferSelect) {
  return row.common_name?.trim() || row.display_name;
}

function scheduleRowFromMyMedicine(row: typeof myMedicines.$inferSelect) {
  return {
    id: row.id,
    medication_name: myMedicineName(row),
    dosage: row.dose_text ?? null,
    frequency: null as string | null,
    scheduled_times: cleanScheduleTimes(row.schedule_times, row.dose_text),
    active: row.status === "active",
    created_at: row.created_at,
  };
}

function serializeMyMedicine(row: typeof myMedicines.$inferSelect) {
  return {
    id: row.id,
    user_id: row.user_id,
    display_name: row.display_name,
    common_name: row.common_name,
    dose_text: row.dose_text,
    purpose_text: row.purpose_text,
    item_type: row.item_type,
    drug_class_tag: row.drug_class_tag,
    photo_url: row.photo_url,
    prescriber_name: row.prescriber_name,
    refill_due_date: row.refill_due_date,
    dose_unit: row.dose_unit,
    units_per_dose: row.units_per_dose === null ? null : Number(row.units_per_dose),
    inventory_unit: row.inventory_unit ?? row.dose_unit,
    inventory_units_per_dose: row.inventory_units_per_dose === null
      ? row.units_per_dose === null ? null : Number(row.units_per_dose)
      : Number(row.inventory_units_per_dose),
    daily_frequency: row.daily_frequency === null ? null : Number(row.daily_frequency),
    inventory_tracking_enabled: row.inventory_tracking_enabled,
    refill_alert_days: row.refill_alert_days,
    schedule_times: row.schedule_times ?? [],
    status: row.status,
    added_via: row.added_via,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function projectedRunOutDate(purchasedOn: string, quantity: number, unitsPerDose: number, dailyFrequency: number) {
  const dailyUse = unitsPerDose * dailyFrequency;
  if (dailyUse <= 0) return null;
  const date = new Date(`${purchasedOn}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Math.floor(quantity / dailyUse));
  return date.toISOString().slice(0, 10);
}

async function backfillMyMedicinesFromLegacy(userId: string) {
  await pool.query(`
    insert into my_medicines (
      user_id,
      display_name,
      common_name,
      dose_text,
      item_type,
      schedule_times,
      status,
      added_via,
      created_at,
      updated_at
    )
    select
      user_id,
      medication_name,
      medication_name,
      trim(both ' ' from concat_ws(' ', dosage, replace(coalesce(frequency, ''), '_', ' '))),
      'prescription',
      scheduled_times,
      case when active = true then 'active' else 'discontinued' end,
      'manual',
      created_at,
      now()
    from user_medications um
    where um.user_id = $1
      and not exists (
        select 1
        from my_medicines mm
        where mm.user_id = um.user_id
          and lower(mm.display_name) = lower(um.medication_name)
      )
  `, [userId]);
}

async function loadMyMedicinesForUser(userId: string) {
  await ensureMyMedicinesTables();
  await backfillMyMedicinesFromLegacy(userId);
  return db
    .select()
    .from(myMedicines)
    .where(eq(myMedicines.user_id, userId))
    .orderBy(myMedicines.status, myMedicines.display_name);
}

async function loadActiveMedicineScheduleRows(userId: string) {
  const rows = await loadMyMedicinesForUser(userId);
  return rows
    .filter((row) => row.status === "active")
    .map(scheduleRowFromMyMedicine);
}

async function syncLegacyMedicationFromMyMedicine(row: typeof myMedicines.$inferSelect) {
  const medicationName = myMedicineName(row);
  const scheduleTimes = cleanScheduleTimes(row.schedule_times, row.dose_text);
  const active = row.status === "active";
  const [existing] = await db
    .select()
    .from(userMedications)
    .where(and(
      eq(userMedications.user_id, row.user_id),
      eq(userMedications.medication_name, medicationName),
    ))
    .limit(1);

  if (existing) {
    await db.update(userMedications).set({
      dosage: row.dose_text ?? null,
      frequency: row.dose_text ?? null,
      scheduled_times: scheduleTimes,
      active,
    }).where(eq(userMedications.id, existing.id));
    return;
  }

  await db.insert(userMedications).values({
    user_id: row.user_id,
    medication_name: medicationName,
    dosage: row.dose_text ?? null,
    frequency: row.dose_text ?? null,
    scheduled_times: scheduleTimes,
    active,
    added_by: row.added_via ?? "user",
  });
}

function buildMedicinePatchValues(data: z.infer<typeof myMedicinePatchSchema>) {
  const patch: Partial<typeof myMedicines.$inferInsert> = {
    updated_at: new Date(),
  };
  if (data.display_name !== undefined) patch.display_name = data.display_name;
  if (data.common_name !== undefined) patch.common_name = emptyToNull(data.common_name);
  if (data.dose_text !== undefined) patch.dose_text = emptyToNull(data.dose_text);
  if (data.purpose_text !== undefined) patch.purpose_text = emptyToNull(data.purpose_text);
  if (data.item_type !== undefined) patch.item_type = data.item_type;
  if (data.drug_class_tag !== undefined) patch.drug_class_tag = data.drug_class_tag && isMedicineClassTag(data.drug_class_tag) ? data.drug_class_tag : null;
  if (data.photo_url !== undefined) patch.photo_url = emptyToNull(data.photo_url);
  if (data.prescriber_name !== undefined) patch.prescriber_name = emptyToNull(data.prescriber_name);
  if (data.refill_due_date !== undefined) patch.refill_due_date = dateStringOrNull(data.refill_due_date);
  if (data.schedule_times !== undefined) patch.schedule_times = cleanScheduleTimes(data.schedule_times, data.dose_text);
  if (data.status !== undefined) {
    patch.status = data.status;
    patch.status_changed_at = new Date();
    patch.status_changed_by = data.status_changed_by ?? "user";
  }
  return patch;
}

function caseResponse(row: typeof medicationSafetyCases.$inferSelect) {
  const missingFields = row.missing_fields?.length
    ? row.missing_fields
    : medicationSafetyCaseMissingFields(row);
  return {
    ...row,
    missing_fields: missingFields,
    export_ready: missingFields.length === 0,
  };
}

async function latestDailySafetyContext(userId: string) {
  if (!looksLikeUuid(userId)) return null;
  const [row] = await db
    .select()
    .from(vyvaPatternWindows)
    .where(eq(vyvaPatternWindows.user_id, userId))
    .orderBy(desc(vyvaPatternWindows.analysed_at))
    .limit(1);
  return row ?? null;
}

async function latestTriageContext(userId: string) {
  const [row] = await db
    .select()
    .from(triageReports)
    .where(eq(triageReports.user_id, userId))
    .orderBy(desc(triageReports.created_at))
    .limit(1);
  return row ?? null;
}

async function insertCaseEvent(params: {
  caseId: string;
  userId: string;
  eventType: string;
  actorId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const [event] = await db.insert(medicationSafetyCaseEvents).values({
    case_id: params.caseId,
    user_id: params.userId,
    event_type: params.eventType,
    actor_id: params.actorId ?? params.userId,
    payload: params.payload ?? {},
  }).returning();
  return event;
}

function matchingMedicationClause(medicationName: string | null) {
  return medicationName
    ? eq(medicationSafetyCases.suspected_medication, medicationName)
    : isNull(medicationSafetyCases.suspected_medication);
}

async function findOpenSafetyCase(params: {
  userId: string;
  signalType: MedicationSafetySignalType;
  suspectedMedication: string | null;
}) {
  const [row] = await db
    .select()
    .from(medicationSafetyCases)
    .where(and(
      eq(medicationSafetyCases.user_id, params.userId),
      eq(medicationSafetyCases.signal_type, params.signalType),
      inArray(medicationSafetyCases.status, OPEN_MEDICATION_SAFETY_CASE_STATUSES),
      matchingMedicationClause(params.suspectedMedication),
      gte(medicationSafetyCases.created_at, daysAgo(29)),
    ))
    .orderBy(desc(medicationSafetyCases.created_at))
    .limit(1);
  return row ?? null;
}

async function upsertSignalCandidate(userId: string, candidate: MedicationSafetySignalCandidate) {
  const medicationClause = candidate.medication_name
    ? eq(medicationSafetySignals.medication_name, candidate.medication_name)
    : isNull(medicationSafetySignals.medication_name);

  const [existing] = await db
    .select()
    .from(medicationSafetySignals)
    .where(and(
      eq(medicationSafetySignals.user_id, userId),
      eq(medicationSafetySignals.signal_type, candidate.signal_type),
      inArray(medicationSafetySignals.status, ["open", "linked"]),
      medicationClause,
      gte(medicationSafetySignals.detected_at, daysAgo(1)),
    ))
    .orderBy(desc(medicationSafetySignals.detected_at))
    .limit(1);

  if (existing) {
    const [updated] = await db.update(medicationSafetySignals).set({
      severity: strongestSeverity([existing.severity, candidate.severity]),
      title: candidate.title,
      summary: candidate.summary,
      source: candidate.source,
      evidence: [...evidenceArray(existing.evidence), ...candidate.evidence],
      detected_at: new Date(),
    }).where(eq(medicationSafetySignals.id, existing.id)).returning();
    return updated;
  }

  const [inserted] = await db.insert(medicationSafetySignals).values({
    user_id: userId,
    signal_type: candidate.signal_type,
    severity: candidate.severity,
    title: candidate.title,
    summary: candidate.summary,
    medication_name: candidate.medication_name,
    source: candidate.source,
    evidence: candidate.evidence,
    status: "open",
  }).returning();
  return inserted;
}

async function createOrUpdateCaseFromSeed(userId: string, candidate: MedicationSafetySignalCandidate, signalId?: string | null) {
  if (!candidate.caseSeed) return null;
  const seed = candidate.caseSeed;
  const suspectedMedication = emptyToNull(seed.suspected_medication);
  const existing = await findOpenSafetyCase({
    userId,
    signalType: seed.signal_type,
    suspectedMedication,
  });

  if (existing) {
    const nextEvidence = [...evidenceArray(existing.evidence), ...seed.evidence];
    const missingFields = medicationSafetyCaseMissingFields({ ...existing, evidence: nextEvidence });
    const [updated] = await db.update(medicationSafetyCases).set({
      severity: strongestSeverity([existing.severity, seed.severity]),
      evidence: nextEvidence,
      missing_fields: missingFields,
      export_ready: missingFields.length === 0,
      updated_at: new Date(),
    }).where(eq(medicationSafetyCases.id, existing.id)).returning();

    await insertCaseEvent({
      caseId: updated.id,
      userId,
      eventType: "signal_linked",
      payload: { signal_id: signalId ?? null, signal_type: candidate.signal_type },
    });
    return updated;
  }

  const missingFields = medicationSafetyCaseMissingFields({
    suspected_medication: suspectedMedication,
    reaction: seed.reaction ?? null,
    seriousness_flags: [],
  });

  const [created] = await db.insert(medicationSafetyCases).values({
    user_id: userId,
    status: "draft",
    severity: seed.severity,
    signal_type: seed.signal_type,
    suspected_medication: suspectedMedication,
    reaction: emptyToNull(seed.reaction),
    evidence: seed.evidence,
    missing_fields: missingFields,
    export_ready: missingFields.length === 0,
  }).returning();

  await insertCaseEvent({
    caseId: created.id,
    userId,
    eventType: "created_from_signal",
    payload: { signal_id: signalId ?? null, signal_type: candidate.signal_type },
  });
  return created;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function nestedFlag(consent: Record<string, unknown>, section: string, key: string): unknown {
  const value = consent[section];
  return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

function medicationAlertConsentAllows(consentValue: unknown): boolean {
  const consent = asRecord(consentValue);
  const candidates = [
    consent.caregiver_medication_alerts,
    consent.caregiver_health_alerts,
    consent.caregiver_full_access,
    nestedFlag(consent, "caregiver", "medication_alerts"),
    nestedFlag(consent, "caregiver", "health_alerts"),
    nestedFlag(consent, "careteam", "caregiver_medication_alerts"),
    nestedFlag(consent, "communication_preferences", "caregiver_alerts"),
  ];
  if (candidates.some((value) => value === true)) return true;
  if (candidates.some((value) => value === false)) return false;
  return true;
}

async function recordMedicationCaseShareAlert(userId: string, safetyCase: typeof medicationSafetyCases.$inferSelect) {
  const [profile, teamRows] = await Promise.all([
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
        eq(teamInvitations.can_receive_medication_alerts, true),
      ))
      .limit(5),
  ]);

  if (!medicationAlertConsentAllows(profile?.data_sharing_consent)) return [];

  const recipients = [
    profile?.caregiver_contact || profile?.caregiver_name || "",
    ...teamRows.map((row) => row.whatsapp || row.phone || row.email || row.name || ""),
  ].filter((value, index, values) => value && values.indexOf(value) === index);

  if (!recipients.length) return [];

  await db.insert(caregiverAlerts).values({
    user_id: userId,
    alert_type: "medication_safety_case",
    severity: safetyCase.severity,
    message: [
      `Medication safety case shared: ${safetyCase.suspected_medication ?? "medication review"}`,
      safetyCase.reaction ? `Reported symptom: ${safetyCase.reaction}` : "",
      "This is a review packet, not a regulatory submission.",
    ].filter(Boolean).join("\n"),
    sent_to: recipients,
  });

  return recipients;
}

async function loadSafetySourceContext(userId: string) {
  const thirtyDayStart = daysAgo(29);
  const [medications, adherenceRows, dailySafety, latestTriage] = await Promise.all([
    loadActiveMedicineScheduleRows(userId),
    db
      .select()
      .from(medicationAdherence)
      .where(and(eq(medicationAdherence.user_id, userId), gte(medicationAdherence.created_at, thirtyDayStart))),
    latestDailySafetyContext(userId).catch(() => null),
    latestTriageContext(userId).catch(() => null),
  ]);

  const candidates = buildMedicationSafetySignals({
    medications,
    adherenceRows,
    dailySafety,
    latestTriage,
  });

  return { medications, adherenceRows, dailySafety, latestTriage, candidates };
}

async function loadMedicationSafetyPayload(userId: string) {
  await ensureMedicationSafetyTables();
  const [{ dailySafety, latestTriage, candidates }, storedSignals, openCases] = await Promise.all([
    loadSafetySourceContext(userId),
    db
      .select()
      .from(medicationSafetySignals)
      .where(and(
        eq(medicationSafetySignals.user_id, userId),
        inArray(medicationSafetySignals.status, ["open", "linked"]),
      ))
      .orderBy(desc(medicationSafetySignals.detected_at))
      .limit(12),
    db
      .select()
      .from(medicationSafetyCases)
      .where(and(
        eq(medicationSafetyCases.user_id, userId),
        inArray(medicationSafetyCases.status, OPEN_MEDICATION_SAFETY_CASE_STATUSES),
      ))
      .orderBy(desc(medicationSafetyCases.updated_at))
      .limit(8),
  ]);

  const cases = openCases.map(caseResponse);
  const severities = [
    ...candidates.map((candidate) => candidate.severity),
    ...storedSignals.map((signal) => signal.severity),
    ...cases.map((safetyCase) => safetyCase.severity),
  ];
  const severity = strongestSeverity(severities);
  const signalCount = candidates.length + storedSignals.length;
  const status = cases.length > 0 ? "needs_review" : signalCount > 0 ? "watch" : "steady";
  const title = cases.length > 0
    ? `${cases.length} medication safety case${cases.length === 1 ? "" : "s"} to review`
    : signalCount > 0
      ? "Medication signals are being watched"
      : "No medication safety signals found";
  const message = cases.length > 0
    ? "Review the case details, fill missing fields, and export an audit-ready packet when ready."
    : signalCount > 0
      ? "VYVA found context worth watching. A draft case is only created when the signal is explicit or repeated."
      : "Today looks steady from the medication data VYVA can see.";

  return {
    summary: {
      status,
      severity,
      title,
      message,
      signalCount,
      openCaseCount: cases.length,
      lastAnalysedAt: dailySafety?.analysed_at ?? null,
    },
    signalCandidates: candidates,
    signals: storedSignals,
    openCases: cases,
    latestDailySafety: dailySafety,
    latestTriage,
    exportAvailability: {
      canExport: cases.length > 0,
      readyCount: cases.filter((safetyCase) => safetyCase.export_ready).length,
      needsReviewCount: cases.filter((safetyCase) => !safetyCase.export_ready).length,
    },
  };
}

function buildCasePatchValues(data: z.infer<typeof medicationSafetyCasePatchSchema>) {
  const patch: Partial<typeof medicationSafetyCases.$inferInsert> = {};
  if (data.status !== undefined) patch.status = data.status;
  if (data.severity !== undefined) patch.severity = data.severity;
  if (data.signal_type !== undefined) patch.signal_type = data.signal_type;
  if (data.suspected_medication !== undefined) patch.suspected_medication = emptyToNull(data.suspected_medication);
  if (data.reaction !== undefined) patch.reaction = emptyToNull(data.reaction);
  if (data.reaction_started_at !== undefined) patch.reaction_started_at = dateOrNull(data.reaction_started_at);
  if (data.seriousness_flags !== undefined) {
    patch.seriousness_flags = data.seriousness_flags.map((flag) => flag.trim()).filter(Boolean);
  }
  if (data.outcome !== undefined) patch.outcome = emptyToNull(data.outcome);
  if (data.action_taken !== undefined) patch.action_taken = emptyToNull(data.action_taken);
  if (data.reporter_name !== undefined) patch.reporter_name = emptyToNull(data.reporter_name);
  if (data.reporter_contact !== undefined) patch.reporter_contact = emptyToNull(data.reporter_contact);
  if (data.reporter_role !== undefined) patch.reporter_role = emptyToNull(data.reporter_role) ?? "patient_or_caregiver";
  if (data.narrative !== undefined) patch.narrative = emptyToNull(data.narrative);
  return patch;
}

async function resolveProfileParam(req: Request, res: Response, value: string): Promise<string | null> {
  if (value === "me") return requireActiveProfileId(req.user!.id, res);
  return value;
}

async function loadTodayMedications(userId: string) {
  const todayStart = new Date(todayDateString() + "T00:00:00.000Z");

  const [meds, todayLogs] = await Promise.all([
    loadActiveMedicineScheduleRows(userId),
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

  return meds.map((m) => {
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
}

async function loadSevenDayAdherence(userId: string) {
  const sevenDayStart = daysAgo(6);
  const today = todayDateString();
  const sevenDayStartDate = dateKeyFor(sevenDayStart);
  const [medRows, adherenceRows] = await Promise.all([
    loadActiveMedicineScheduleRows(userId),
    db
      .select()
      .from(medicationAdherence)
      .where(and(
        eq(medicationAdherence.user_id, userId),
        gte(medicationAdherence.created_at, sevenDayStart),
      )),
  ]);

  const totalScheduled = medRows.length > 0
    ? medRows.reduce((sum, med) => (
        sum + dosesPerDay(med.scheduled_times) * activeDaysInWindow(med.created_at, sevenDayStartDate, today)
      ), 0)
    : adherenceRows.filter((row) => row.status === "taken" || row.status === "missed").length;
  const totalTaken = adherenceRows.filter((row) => row.status === "taken").length;
  const missedDoses = adherenceRows
    .filter((row) => row.status === "missed")
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .map((row) => ({
      medication_name: row.medication_name,
      scheduled_time: row.scheduled_time,
      date: dateKeyFor(row.created_at),
    }));

  return { totalScheduled, totalTaken, missedDoses };
}

async function loadMissedDosesSince(userId: string, since: Date) {
  const rows = await db
    .select()
    .from(medicationAdherence)
    .where(and(
      eq(medicationAdherence.user_id, userId),
      eq(medicationAdherence.status, "missed"),
      gte(medicationAdherence.created_at, since),
    ))
    .orderBy(desc(medicationAdherence.created_at));

  return rows.map((row) => ({
    medication_name: row.medication_name,
    scheduled_time: row.scheduled_time,
    date: dateKeyFor(row.created_at),
  }));
}

export async function caregiverMedsSummaryHandler(req: Request, res: Response) {
  try {
    const profileId = await resolveProfileParam(req, res, req.params.profileId);
    if (!profileId) return;

    const fullAccess = await resolveDomainAccess({
      actorUserId: req.user!.id,
      targetUserId: profileId,
      domain: "meds",
      requiredPermission: "view_adherence",
      actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
      actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
    });

    if (fullAccess) {
      const [medications, sevenDayAdherence] = await Promise.all([
        loadTodayMedications(profileId),
        loadSevenDayAdherence(profileId),
      ]);

      return res.json({
        today: { medications },
        sevenDayAdherence,
        permissions: fullAccess.permissions,
      });
    }

    const alertOnlyAccess = await resolveDomainAccess({
      actorUserId: req.user!.id,
      targetUserId: profileId,
      domain: "meds",
      requiredPermission: "receive_missed_dose_alerts",
      actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
      actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
    });
    if (!alertOnlyAccess) return res.status(403).json({ error: "Caregiver medication access is not enabled." });

    const missedDoses = await loadMissedDosesSince(profileId, new Date(Date.now() - 24 * 60 * 60 * 1000));
    return res.json({
      sevenDayAdherence: { missedDoses },
      permissions: alertOnlyAccess.permissions,
    });
  } catch (err) {
    console.error("[meds/caregiver summary GET]", err);
    return res.status(500).json({ error: "Failed to load caregiver medication summary" });
  }
}

router.get("/caregiver/:profileId/summary", requireUser, caregiverMedsSummaryHandler);

router.get("/today", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const todayStart = new Date(todayDateString() + "T00:00:00.000Z");

  try {
    const [meds, todayLogs] = await Promise.all([
      loadActiveMedicineScheduleRows(userId),
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

router.get("/my-medicines", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    const rows = await loadMyMedicinesForUser(userId);
    return res.json({
      medicines: rows.map(serializeMyMedicine),
      classTags: MEDICINE_CLASS_TAGS,
    });
  } catch (err) {
    console.error("[meds/my-medicines GET]", err);
    return res.status(500).json({ error: "Failed to load medicines" });
  }
});

router.get("/updates", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const language = String(req.headers["x-vyva-language"] ?? "en");
  try {
    const [rows, profile] = await Promise.all([
      loadMyMedicinesForUser(userId),
      db
        .select({ countryCode: profiles.country_code })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1)
        .then((items) => items[0] ?? null),
    ]);
    const medicationRequests = rows
      .filter((row) => row.status === "active")
      .map((row) => ({
        medicationName: row.display_name.trim(),
        activeIngredient: row.common_name?.trim() || null,
        doseText: row.dose_text,
        countryCode: profile?.countryCode || null,
      }))
      .filter((medication) => Boolean(medication.medicationName));
    const updates = await buildMedicationUpdates(medicationRequests, language);
    res.setHeader("Cache-Control", "private, no-store");
    return res.json(updates);
  } catch (err) {
    console.error("[meds/updates GET]", err);
    return res.status(500).json({ error: "Failed to check official medication sources" });
  }
});

router.post("/my-medicines", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const parsed = myMedicineCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
  }

  try {
    await ensureMyMedicinesTables();
    const trackingEnabled = parsed.data.inventory_tracking_enabled;
    const inventoryUnit = parsed.data.inventory_unit ?? parsed.data.dose_unit;
    const inventoryUnitsPerDose = parsed.data.inventory_units_per_dose ?? parsed.data.units_per_dose;
    const refillDueDate = trackingEnabled
      ? projectedRunOutDate(
        parsed.data.purchased_on!,
        parsed.data.initial_quantity!,
        inventoryUnitsPerDose!,
        parsed.data.daily_frequency!,
      )
      : dateStringOrNull(parsed.data.refill_due_date);
    const [profile] = await db
      .select({ preferredName: profiles.preferred_name, fullName: profiles.full_name })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    const created = await db.transaction(async (tx) => {
      const [medicine] = await tx.insert(myMedicines).values({
        user_id: userId,
        display_name: parsed.data.display_name,
        common_name: emptyToNull(parsed.data.common_name),
        dose_text: emptyToNull(parsed.data.dose_text),
        purpose_text: emptyToNull(parsed.data.purpose_text),
        item_type: parsed.data.item_type,
        drug_class_tag: parsed.data.drug_class_tag && isMedicineClassTag(parsed.data.drug_class_tag) ? parsed.data.drug_class_tag : null,
        photo_url: null,
        prescriber_name: emptyToNull(parsed.data.prescriber_name),
        refill_due_date: refillDueDate,
        dose_unit: trackingEnabled ? parsed.data.dose_unit ?? inventoryUnit : null,
        units_per_dose: trackingEnabled ? String(parsed.data.units_per_dose ?? inventoryUnitsPerDose) : null,
        inventory_unit: trackingEnabled ? inventoryUnit : null,
        inventory_units_per_dose: trackingEnabled ? String(inventoryUnitsPerDose) : null,
        daily_frequency: trackingEnabled ? String(parsed.data.daily_frequency) : null,
        inventory_tracking_enabled: trackingEnabled,
        refill_alert_days: parsed.data.refill_alert_days,
        schedule_times: cleanScheduleTimes(parsed.data.schedule_times, parsed.data.dose_text),
        added_via: parsed.data.added_via,
      }).returning();
      if (trackingEnabled) {
        await tx.insert(medicationInventoryEvents).values({
          user_id: userId,
          medicine_id: medicine.id,
          event_type: "purchase",
          quantity: String(parsed.data.initial_quantity),
          unit: inventoryUnit!,
          occurred_on: parsed.data.purchased_on!,
          source: parsed.data.added_via === "photo" ? "photo" : "manual",
          actor_user_id: userId,
          actor_role: "elder",
          actor_name: profile?.preferredName || profile?.fullName || null,
          metadata: { createdWithMedicine: true, imageRetained: false },
        });
      }
      await tx.insert(myMedicinesChangeLog).values({
        user_id: userId,
        medicine_id: medicine.id,
        change_type: "added",
        previous_value: null,
        new_value: serializeMyMedicine(medicine),
        source: parsed.data.added_via === "voice" ? "voice_update" : "manual_edit",
      });
      return medicine;
    });
    await syncLegacyMedicationFromMyMedicine(created);

    return res.status(201).json({ medicine: serializeMyMedicine(created) });
  } catch (err) {
    console.error("[meds/my-medicines POST]", err);
    return res.status(500).json({ error: "Failed to add medicine" });
  }
});

router.patch("/my-medicines/:id", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const parsed = myMedicinePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
  }

  try {
    await ensureMyMedicinesTables();
    const [existing] = await db
      .select()
      .from(myMedicines)
      .where(and(eq(myMedicines.id, req.params.id), eq(myMedicines.user_id, userId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Medicine not found" });

    const patch = buildMedicinePatchValues(parsed.data);
    const [updated] = await db
      .update(myMedicines)
      .set(patch)
      .where(and(eq(myMedicines.id, req.params.id), eq(myMedicines.user_id, userId)))
      .returning();

    await db.insert(myMedicinesChangeLog).values({
      user_id: userId,
      medicine_id: updated.id,
      change_type: parsed.data.status === "paused"
        ? "paused"
        : parsed.data.status === "active" && existing.status === "paused"
          ? "resumed"
          : parsed.data.status === "discontinued"
            ? "discontinued"
            : "dose_changed",
      previous_value: serializeMyMedicine(existing),
      new_value: serializeMyMedicine(updated),
      source: "manual_edit",
    });
    await syncLegacyMedicationFromMyMedicine(updated);

    return res.json({ medicine: serializeMyMedicine(updated) });
  } catch (err) {
    console.error("[meds/my-medicines PATCH]", err);
    return res.status(500).json({ error: "Failed to update medicine" });
  }
});

router.post("/my-medicines/:id/discontinue", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    await ensureMyMedicinesTables();
    const [existing] = await db
      .select()
      .from(myMedicines)
      .where(and(eq(myMedicines.id, req.params.id), eq(myMedicines.user_id, userId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Medicine not found" });

    const [updated] = await db.update(myMedicines).set({
      status: "discontinued",
      status_changed_at: new Date(),
      status_changed_by: "user",
      updated_at: new Date(),
    }).where(and(eq(myMedicines.id, req.params.id), eq(myMedicines.user_id, userId))).returning();

    await db.insert(myMedicinesChangeLog).values({
      user_id: userId,
      medicine_id: updated.id,
      change_type: "discontinued",
      previous_value: serializeMyMedicine(existing),
      new_value: serializeMyMedicine(updated),
      source: "manual_edit",
    });
    await syncLegacyMedicationFromMyMedicine(updated);

    return res.json({ medicine: serializeMyMedicine(updated) });
  } catch (err) {
    console.error("[meds/my-medicines discontinue POST]", err);
    return res.status(500).json({ error: "Failed to discontinue medicine" });
  }
});

router.get("/interactions", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const language = String(req.headers["x-vyva-language"] ?? "en");
  try {
    await ensureMyMedicinesTables();
    const [medicines, rules, dismissals] = await Promise.all([
      db
        .select()
        .from(myMedicines)
        .where(and(eq(myMedicines.user_id, userId), eq(myMedicines.status, "active")))
        .orderBy(myMedicines.display_name),
      db
        .select()
        .from(interactionFlagRules)
        .where(eq(interactionFlagRules.is_active, true))
        .orderBy(interactionFlagRules.created_at),
      db
        .select()
        .from(interactionFlagDismissals)
        .where(eq(interactionFlagDismissals.user_id, userId)),
    ]);

    const flags = computeMedicationInteractionFlags({
      medicines,
      rules,
      dismissals,
      language,
      maxFlags: 2,
    });

    if (process.env.NODE_ENV !== "production" && flags.length) {
      console.info("[meds/interactions flags]", flags.map((flag) => ({
        flag_id: flag.id,
        kind: flag.kind,
        medicine_ids: flag.medicineIds,
        medicines: flag.medicines,
        class_tags: flag.classTags,
      })));
    }

    return res.json({
      flags,
      hasMore: false,
      reviewedRuleCount: rules.length,
      activeMedicineCount: medicines.filter((medicine) => medicine.status === "active").length,
      message: flags.length
        ? "Worth asking your pharmacist about these combinations."
        : "Everything looks okay from the reviewed rules available today. Keep adding medicines so VYVA can keep checking.",
    });
  } catch (err) {
    console.error("[meds/interactions GET]", err);
    return res.status(500).json({ error: "Failed to check medicine interactions" });
  }
});

router.post("/interactions/:ruleId/dismiss", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const parsed = interactionDismissSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
  }

  try {
    await ensureMyMedicinesTables();
    const [rule] = await db
      .select({ id: interactionFlagRules.id })
      .from(interactionFlagRules)
      .where(eq(interactionFlagRules.id, req.params.ruleId))
      .limit(1);
    if (!rule) return res.status(404).json({ error: "Interaction rule not found" });

    const pair = normalizedMedicinePair(parsed.data.medicine_pair);
    const [dismissal] = await db.insert(interactionFlagDismissals).values({
      user_id: userId,
      rule_id: rule.id,
      medicine_pair: pair,
      reason: parsed.data.reason,
    }).returning();

    return res.status(201).json({ dismissal });
  } catch (err) {
    console.error("[meds/interactions dismiss POST]", err);
    return res.status(500).json({ error: "Failed to dismiss interaction flag" });
  }
});

router.get("/safety", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    const payload = await loadMedicationSafetyPayload(userId);
    return res.json(payload);
  } catch (err) {
    console.error("[meds/safety GET]", err);
    return res.status(500).json({ error: "Failed to load medication safety signals" });
  }
});

router.post("/safety/analyse", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    await ensureMedicationSafetyTables();
    const { candidates } = await loadSafetySourceContext(userId);
    const storedSignals = [];
    const touchedCases = [];

    for (const candidate of candidates) {
      const signal = await upsertSignalCandidate(userId, candidate);
      storedSignals.push(signal);
      if (!candidate.shouldCreateCase) continue;
      const safetyCase = await createOrUpdateCaseFromSeed(userId, candidate, signal?.id ?? null);
      if (safetyCase) {
        touchedCases.push(safetyCase);
        await db.update(medicationSafetySignals).set({
          status: "linked",
          related_case_id: safetyCase.id,
        }).where(eq(medicationSafetySignals.id, signal.id));
      }
    }

    const payload = await loadMedicationSafetyPayload(userId);
    return res.json({
      ...payload,
      analysed: {
        candidateCount: candidates.length,
        storedSignalCount: storedSignals.length,
        touchedCaseCount: touchedCases.length,
      },
    });
  } catch (err) {
    console.error("[meds/safety analyse]", err);
    return res.status(500).json({ error: "Failed to analyse medication safety signals" });
  }
});

router.post("/safety/cases", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const parsed = medicationSafetyCaseCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
  }

  try {
    await ensureMedicationSafetyTables();
    const signalType = parsed.data.signal_type;
    const severity = parsed.data.severity;
    const suspectedMedication = emptyToNull(parsed.data.suspected_medication);
    const evidence = [{
      type: "manual_report",
      source: "meds_page",
      created_at: new Date().toISOString(),
      suspected_medication: suspectedMedication,
      reaction: emptyToNull(parsed.data.reaction),
    }];
    const existing = await findOpenSafetyCase({
      userId,
      signalType,
      suspectedMedication,
    });

    const patch = buildCasePatchValues(parsed.data);
    let safetyCase: typeof medicationSafetyCases.$inferSelect;
    let deduped = false;

    if (existing) {
      const nextEvidence = [...evidenceArray(existing.evidence), ...evidence];
      const missingFields = medicationSafetyCaseMissingFields({ ...existing, ...patch, evidence: nextEvidence });
      const [updated] = await db.update(medicationSafetyCases).set({
        ...patch,
        severity: strongestSeverity([existing.severity, severity]),
        evidence: nextEvidence,
        missing_fields: missingFields,
        export_ready: missingFields.length === 0,
        updated_at: new Date(),
      }).where(eq(medicationSafetyCases.id, existing.id)).returning();
      safetyCase = updated;
      deduped = true;
    } else {
      const missingFields = medicationSafetyCaseMissingFields({
        ...patch,
        severity,
        signal_type: signalType,
        evidence,
      });
      const [created] = await db.insert(medicationSafetyCases).values({
        user_id: userId,
        status: parsed.data.status ?? "draft",
        severity,
        signal_type: signalType,
        suspected_medication: suspectedMedication,
        reaction: emptyToNull(parsed.data.reaction),
        reaction_started_at: dateOrNull(parsed.data.reaction_started_at),
        seriousness_flags: parsed.data.seriousness_flags ?? [],
        outcome: emptyToNull(parsed.data.outcome),
        action_taken: emptyToNull(parsed.data.action_taken),
        reporter_name: emptyToNull(parsed.data.reporter_name),
        reporter_contact: emptyToNull(parsed.data.reporter_contact),
        reporter_role: emptyToNull(parsed.data.reporter_role) ?? "patient_or_caregiver",
        narrative: emptyToNull(parsed.data.narrative),
        evidence,
        missing_fields: missingFields,
        export_ready: missingFields.length === 0,
      }).returning();
      safetyCase = created;
    }

    const [signal] = await db.insert(medicationSafetySignals).values({
      user_id: userId,
      signal_type: signalType,
      severity,
      title: signalType === "possible_side_effect" ? "Possible side effect report" : "Medication safety case started",
      summary: emptyToNull(parsed.data.reaction) ?? emptyToNull(parsed.data.narrative) ?? "A medication safety case was started for review.",
      medication_name: suspectedMedication,
      source: "manual_case",
      evidence,
      status: "linked",
      related_case_id: safetyCase.id,
    }).returning();

    await insertCaseEvent({
      caseId: safetyCase.id,
      userId,
      eventType: deduped ? "updated_manual" : "created_manual",
      payload: { signal_id: signal.id, signal_type: signalType },
    });

    return res.status(deduped ? 200 : 201).json({
      case: caseResponse(safetyCase),
      signal,
      deduped,
    });
  } catch (err) {
    console.error("[meds/safety cases POST]", err);
    return res.status(500).json({ error: "Failed to create medication safety case" });
  }
});

router.patch("/safety/cases/:id", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const parsed = medicationSafetyCasePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
  }

  try {
    await ensureMedicationSafetyTables();
    const [existing] = await db
      .select()
      .from(medicationSafetyCases)
      .where(and(eq(medicationSafetyCases.id, id), eq(medicationSafetyCases.user_id, userId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Medication safety case not found" });

    const patch = buildCasePatchValues(parsed.data);
    const next = { ...existing, ...patch } as MedicationSafetyCaseLike;
    const missingFields = medicationSafetyCaseMissingFields(next);
    const sharingNow = parsed.data.status === "shared" && existing.status !== "shared";
    const [updated] = await db.update(medicationSafetyCases).set({
      ...patch,
      missing_fields: missingFields,
      export_ready: missingFields.length === 0,
      shared_at: sharingNow ? new Date() : existing.shared_at,
      updated_at: new Date(),
    }).where(and(eq(medicationSafetyCases.id, id), eq(medicationSafetyCases.user_id, userId))).returning();

    const sentTo = sharingNow
      ? await recordMedicationCaseShareAlert(userId, updated).catch((err) => {
          console.error("[meds/safety share alert]", err);
          return [] as string[];
        })
      : [];

    await insertCaseEvent({
      caseId: updated.id,
      userId,
      eventType: sharingNow ? "shared" : "updated",
      payload: {
        changed_fields: Object.keys(patch),
        sent_to: sentTo,
      },
    });

    return res.json({ case: caseResponse(updated), sent_to: sentTo });
  } catch (err) {
    console.error("[meds/safety cases PATCH]", err);
    return res.status(500).json({ error: "Failed to update medication safety case" });
  }
});

router.post("/safety/cases/:id/export", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    await ensureMedicationSafetyTables();
    const [safetyCase] = await db
      .select()
      .from(medicationSafetyCases)
      .where(and(eq(medicationSafetyCases.id, id), eq(medicationSafetyCases.user_id, userId)))
      .limit(1);
    if (!safetyCase) return res.status(404).json({ error: "Medication safety case not found" });

    const preview = buildMedicationSafetyCaseExport({ safetyCase });
    await insertCaseEvent({
      caseId: safetyCase.id,
      userId,
      eventType: "exported",
      payload: {
        export_ready: preview.export_ready,
        missing_fields: preview.missing_fields,
        standard: "ICH E2B(R3)-ready internal packet",
      },
    });

    const events = await db
      .select()
      .from(medicationSafetyCaseEvents)
      .where(and(eq(medicationSafetyCaseEvents.case_id, safetyCase.id), eq(medicationSafetyCaseEvents.user_id, userId)))
      .orderBy(medicationSafetyCaseEvents.created_at);
    const packet = buildMedicationSafetyCaseExport({ safetyCase, events });

    const [updated] = await db.update(medicationSafetyCases).set({
      latest_export_json: packet.e2b_ready_json,
      missing_fields: packet.missing_fields,
      export_ready: packet.export_ready,
      updated_at: new Date(),
    }).where(and(eq(medicationSafetyCases.id, id), eq(medicationSafetyCases.user_id, userId))).returning();

    return res.json({
      case: caseResponse(updated),
      export: packet,
    });
  } catch (err) {
    console.error("[meds/safety cases export]", err);
    return res.status(500).json({ error: "Failed to export medication safety case" });
  }
});

router.get("/", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const periodQuery = z.object({
      period: z.enum(["weekly", "monthly", "quarterly", "custom"]).default("weekly"),
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).safeParse(req.query);
    if (!periodQuery.success) {
      return res.status(400).json({ error: "Invalid progress period" });
    }

    const sevenDayStart = daysAgo(6);
    const thirtyDayStart = daysAgo(29);
    const threeDayStart = daysAgo(2);
    const today = todayDateString();
    const sevenDayStartDate = dateKeyFor(sevenDayStart);
    const thirtyDayStartDate = dateKeyFor(thirtyDayStart);
    const threeDayStartDate = dateKeyFor(threeDayStart);
    const { period } = periodQuery.data;
    let rangeEndDate = today;
    let rangeStartDate = sevenDayStartDate;
    if (period === "monthly") rangeStartDate = thirtyDayStartDate;
    if (period === "quarterly") rangeStartDate = dateKeyFor(daysAgo(89));
    if (period === "custom") {
      if (!periodQuery.data.start || !periodQuery.data.end) {
        return res.status(400).json({ error: "Custom progress requires a start and end date" });
      }
      rangeStartDate = periodQuery.data.start;
      rangeEndDate = periodQuery.data.end;
      const startTime = new Date(`${rangeStartDate}T00:00:00.000Z`).getTime();
      const endTime = new Date(`${rangeEndDate}T00:00:00.000Z`).getTime();
      const rangeDays = Math.floor((endTime - startTime) / 86400000) + 1;
      if (!Number.isFinite(rangeDays) || rangeDays < 1 || rangeDays > 366 || rangeEndDate > today) {
        return res.status(400).json({ error: "Custom progress range must be between 1 and 366 days and cannot end in the future" });
      }
    }
    const rangeStart = new Date(`${rangeStartDate}T00:00:00.000Z`);
    const fetchStart = rangeStart < thirtyDayStart ? rangeStart : thirtyDayStart;

    const [adherenceRows, medRows] = await Promise.all([
      db
        .select()
        .from(medicationAdherence)
        .where(
          and(
            eq(medicationAdherence.user_id, userId),
            gte(medicationAdherence.created_at, fetchStart)
          )
        ),
      loadActiveMedicineScheduleRows(userId),
    ]);

    const hasLogs = medRows.length > 0 || adherenceRows.length > 0;
    const rowsLast30 = adherenceRows.filter((r) => dateKeyFor(r.created_at) >= thirtyDayStartDate);
    const rowsLast7 = adherenceRows.filter((r) => new Date(r.created_at) >= sevenDayStart);
    const rowsLast3 = adherenceRows.filter((r) => new Date(r.created_at) >= threeDayStart);
    const rangeRows = adherenceRows.filter((r) => {
      const dateKey = dateKeyFor(r.created_at);
      return dateKey >= rangeStartDate && dateKey <= rangeEndDate;
    });

    const taken30 = rowsLast30.filter((r) => r.status === "taken").length;
    const taken7 = rowsLast7.filter((r) => r.status === "taken").length;
    const taken3 = rowsLast3.filter((r) => r.status === "taken").length;

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
    const scheduled3FromMedRows = medRows.reduce(
      (sum, m) =>
        sum +
        dosesPerDay(m.scheduled_times) *
          activeDaysInWindow(m.created_at, threeDayStartDate, today),
      0
    );

    const scheduled7 = medRows.length > 0 ? scheduled7FromMedRows : rowsLast7.length;
    const scheduled30 = medRows.length > 0 ? scheduled30FromMedRows : rowsLast30.length;
    const scheduled3 = medRows.length > 0 ? scheduled3FromMedRows : rowsLast3.length;

    const weekPct = adherencePct(taken7, scheduled7);
    const monthPct = adherencePct(taken30, scheduled30);
    const threeDayPct = adherencePct(taken3, scheduled3);
    const rangeTaken = rangeRows.filter((r) => r.status === "taken").length;
    const scheduledRangeFromMedRows = medRows.reduce(
      (sum, m) =>
        sum +
        dosesPerDay(m.scheduled_times) *
          activeDaysInWindow(m.created_at, rangeStartDate, rangeEndDate),
      0
    );
    const scheduledRange = medRows.length > 0 ? scheduledRangeFromMedRows : rangeRows.length;
    const periodPct = adherencePct(rangeTaken, scheduledRange);

    const medNamesFromDb = medRows.map((m) => m.medication_name);
    const allMedNames = Array.from(new Set(medNamesFromDb));

    const sevenDayDates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      sevenDayDates.push(daysAgo(i).toISOString().slice(0, 10));
    }
    const rangeDates: string[] = [];
    for (let date = rangeStartDate; date <= rangeEndDate; ) {
      rangeDates.push(date);
      const next = new Date(`${date}T00:00:00.000Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      date = next.toISOString().slice(0, 10);
    }

    const perMedication = allMedNames.map((name) => {
      const medRow = medRows.find((m) => m.medication_name === name);
      const dosage = medRow?.dosage ?? "";
      const dpd = dosesPerDay(medRow?.scheduled_times);
      const medStartDate = medRow?.created_at ? dateKeyFor(medRow.created_at) : null;
      const activeDaysInRange = activeDaysInWindow(medRow?.created_at, rangeStartDate, rangeEndDate);

      const medRowsInRange = rangeRows.filter((r) => r.medication_name === name);
      const takenCount = medRowsInRange.filter((r) => r.status === "taken").length;
      const scheduledCount = medRow ? dpd * activeDaysInRange : medRowsInRange.length;

      const allFetchedMedRows = adherenceRows.filter((r) => r.medication_name === name);
      const takenCountsByDate = new Map<string, number>();
      for (const row of allFetchedMedRows) {
        if (row.status !== "taken") continue;
        const dateKey = dateKeyFor(row.created_at);
        takenCountsByDate.set(dateKey, (takenCountsByDate.get(dateKey) ?? 0) + 1);
      }

      const dailyStatus = rangeDates.map((dateStr) => {
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

    const latestTakenRow = rowsLast30
      .filter((r) => r.status === "taken")
      .sort((a, b) => adherenceTimestamp(b).getTime() - adherenceTimestamp(a).getTime())[0];
    const latestTaken = latestTakenRow
      ? {
          medication_name: latestTakenRow.medication_name,
          scheduled_time: latestTakenRow.scheduled_time,
          confirmed_taken_at: adherenceTimestamp(latestTakenRow).toISOString(),
        }
      : null;
    const todayTakenByName = new Map<string, number>();
    for (const row of rowsLast30) {
      if (row.status !== "taken" || dateKeyFor(row.created_at) !== today) continue;
      todayTakenByName.set(row.medication_name, (todayTakenByName.get(row.medication_name) ?? 0) + 1);
    }
    const pendingDoses: Array<{ medication_name: string; scheduled_time: string; sortKey: number }> = [];
    const todayMedicationStatuses = medRows.map((med) => {
      const scheduledTimes = scheduledTimesForDay(med.scheduled_times);
      const scheduled = scheduledTimes.length;
      const taken = todayTakenByName.get(med.medication_name) ?? 0;
      const remaining = Math.max(0, scheduled - taken);
      for (let index = taken; index < scheduled; index++) {
        pendingDoses.push({
          medication_name: med.medication_name,
          scheduled_time: scheduledTimes[index] ?? scheduledTimes[0] ?? "anytime",
          sortKey: scheduledTimeSortKey(scheduledTimes[index] ?? scheduledTimes[0] ?? "anytime"),
        });
      }
      return { scheduled, taken, remaining };
    });
    const todayScheduled = todayMedicationStatuses.reduce((sum, med) => sum + med.scheduled, 0);
    const todayTaken = todayMedicationStatuses.reduce((sum, med) => sum + Math.min(med.taken, med.scheduled), 0);
    const todayRemaining = todayMedicationStatuses.reduce((sum, med) => sum + med.remaining, 0);
    const nextDueDose = pendingDoses.sort((a, b) => a.sortKey - b.sortKey)[0] ?? null;

    if (scheduled3 > 0 && threeDayPct < 70) {
      void triggerPreventionPlanRefresh({
        userId,
        triggerType: "adherence_drop",
        triggerData: {
          adherence_pct: threeDayPct,
          window_days: 3,
          scheduled_doses: scheduled3,
          taken_doses: taken3,
          remaining_today: todayRemaining,
        },
      }).catch((err) => console.error("[meds prevention refresh]", err));
    }

    return res.json({
      hasLogs,
      weekPct,
      monthPct,
      period: {
        key: period,
        startDate: rangeStartDate,
        endDate: rangeEndDate,
        days: rangeDates.length,
      },
      periodPct,
      perMedication,
      sevenDayDates,
      rangeDates,
      latestTaken,
      nextDue: nextDueDose
        ? {
            medication_name: nextDueDose.medication_name,
            scheduled_time: nextDueDose.scheduled_time,
          }
        : null,
      todaySummary: {
        taken: todayTaken,
        scheduled: todayScheduled,
        remaining: todayRemaining,
        medicationCount: medRows.length,
        completedMedicationCount: todayMedicationStatuses.filter((med) => med.remaining === 0).length,
        pendingMedicationCount: todayMedicationStatuses.filter((med) => med.remaining > 0).length,
      },
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
    await ensureMyMedicinesTables();
    await backfillMyMedicinesFromLegacy(userId);
    const [existingMedicine] = looksLikeUuid(id)
      ? await db
        .select()
        .from(myMedicines)
        .where(and(eq(myMedicines.id, id), eq(myMedicines.user_id, userId)))
        .limit(1)
      : [null];

    if (existingMedicine) {
      const [updated] = await db.update(myMedicines).set({
        display_name: updates.medication_name ?? existingMedicine.display_name,
        common_name: updates.medication_name ?? existingMedicine.common_name,
        dose_text: [updates.dosage, updates.frequency].filter(Boolean).join(" ") || existingMedicine.dose_text,
        schedule_times: cleanScheduleTimes(existingMedicine.schedule_times, [updates.dosage, updates.frequency].filter(Boolean).join(" ") || existingMedicine.dose_text),
        updated_at: new Date(),
      }).where(and(eq(myMedicines.id, id), eq(myMedicines.user_id, userId))).returning();

      await db.insert(myMedicinesChangeLog).values({
        user_id: userId,
        medicine_id: updated.id,
        change_type: "dose_changed",
        previous_value: serializeMyMedicine(existingMedicine),
        new_value: serializeMyMedicine(updated),
        source: "manual_edit",
      });
      await syncLegacyMedicationFromMyMedicine(updated);
      return res.json(updated);
    }

    const [updatedLegacy] = await db
      .update(userMedications)
      .set(updates)
      .where(and(eq(userMedications.id, id), eq(userMedications.user_id, userId)))
      .returning();

    if (!updatedLegacy) {
      return res.status(404).json({ error: "Medication not found" });
    }

    await backfillMyMedicinesFromLegacy(userId);
    return res.json(updatedLegacy);
  } catch (err) {
    console.error("[meds/adherence-report PATCH /:id]", err);
    return res.status(500).json({ error: "Failed to update medication" });
  }
});

router.delete("/:id", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    await ensureMyMedicinesTables();
    await backfillMyMedicinesFromLegacy(userId);
    const [existingMedicine] = looksLikeUuid(id)
      ? await db
        .select()
        .from(myMedicines)
        .where(and(eq(myMedicines.id, id), eq(myMedicines.user_id, userId)))
        .limit(1)
      : [null];

    if (existingMedicine) {
      const [updated] = await db.update(myMedicines).set({
        status: "discontinued",
        status_changed_at: new Date(),
        status_changed_by: "user",
        updated_at: new Date(),
      }).where(and(eq(myMedicines.id, id), eq(myMedicines.user_id, userId))).returning();

      await db.insert(myMedicinesChangeLog).values({
        user_id: userId,
        medicine_id: updated.id,
        change_type: "discontinued",
        previous_value: serializeMyMedicine(existingMedicine),
        new_value: serializeMyMedicine(updated),
        source: "manual_edit",
      });
      await syncLegacyMedicationFromMyMedicine(updated);
      return res.json({ success: true, id: updated.id });
    }

    const [updatedLegacy] = await db
      .update(userMedications)
      .set({ active: false })
      .where(and(eq(userMedications.id, id), eq(userMedications.user_id, userId)))
      .returning();

    if (!updatedLegacy) {
      return res.status(404).json({ error: "Medication not found" });
    }

    await backfillMyMedicinesFromLegacy(userId);
    return res.json({ success: true, id: updatedLegacy.id });
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

    const [medRows, todayRows] = await Promise.all([
      loadActiveMedicineScheduleRows(userId),
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
    const medRow = medRows.find((row) => row.medication_name === medName);

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
