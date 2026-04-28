import { Router } from "express";
import type { Request, Response } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { pool } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import {
  genderInstruction,
  gendered,
  inferProfileGender,
  type GrammaticalGender,
} from "../lib/userPersonalization.js";

const router = Router();

const checkinBodySchema = z.object({
  language: z.string().max(12).optional().default("es"),
  duration_seconds: z.number().int().min(0).max(3600).optional(),
  answers: z.object({
    energy_level: z.number().int().min(1).max(5),
    mood: z.string().min(1).max(40),
    body_areas: z.array(z.string().max(60)).max(7).default([]),
    sleep_quality: z.string().min(1).max(40),
    symptoms: z.array(z.string().max(80)).max(7).default([]),
    social_contact: z.string().min(1).max(40),
  }),
});

const abandonBodySchema = z.object({
  language: z.string().max(12).optional().default("es"),
  duration_seconds: z.number().int().min(0).max(3600).optional(),
});

type CheckinAnswers = z.infer<typeof checkinBodySchema>["answers"];

type AiCheckinResult = {
  feeling_label: string;
  overall_state: "excellent" | "good" | "moderate" | "tired" | "low";
  vyva_reading: string;
  why_today?: string | null;
  trend_note?: string | null;
  personal_plan?: string | null;
  app_suggestion?: string | null;
  suggested_app_action?: "concierge" | "symptom" | "vitals" | "care" | null;
  right_now: string[];
  today_actions: string[];
  highlight: string;
  flag_caregiver: boolean;
  watch_for: string | null;
};

type ProfileContext = {
  name: string;
  grammatical_gender: GrammaticalGender;
  age: number | null;
  language: string;
  location: {
    city: string | null;
    region: string | null;
    country_code: string | null;
    address_available: boolean;
  };
  city: string | null;
  mobility_level: string | null;
  living_situation: string | null;
  gp: {
    name: string | null;
    phone_available: boolean;
    address_available: boolean;
  };
  caregiver: {
    name: string | null;
    contact_available: boolean;
  };
  conditions: string[];
  medications: string[];
  allergies: string[];
  diet: {
    preferences: string[];
    notes: string | null;
  };
  interests: {
    hobbies: string[];
    preferred_activities: string[];
    personality: Record<string, string>;
  };
  recent_vitals: Array<{ metric: string; value: string; recorded_at: string }>;
  recent_activity: {
    last_7_days_minutes: number;
    common_activities: string[];
  };
  recent_triage: Array<{ chief_complaint: string; urgency: string; created_at: string }>;
  recent_checkins: Array<{
    energy_level: number | null;
    mood: string | null;
    sleep_quality: string | null;
    symptoms: string[];
    social_contact: string | null;
    completed_at: string;
  }>;
  trend_summary: {
    total_recent: number;
    avg_energy: number | null;
    energy_direction: "up" | "down" | "steady" | "unknown";
    repeated_low_energy: number;
    repeated_poor_sleep: number;
    repeated_low_mood: number;
    repeated_no_social: number;
    recurring_symptoms: string[];
  };
  medication_adherence: {
    taken_14d: number;
    missed_14d: number;
  };
};

const MOOD_SCORE: Record<string, number> = {
  alegre: 5,
  tranquila: 4,
  irritable: 3,
  ansiosa: 2,
  triste: 2,
};

function parseConsentArray(consent: unknown, section: string, key: string): string[] {
  if (!consent || typeof consent !== "object") return [];
  const record = consent as Record<string, unknown>;
  const sectionData = record[section];
  if (!sectionData || typeof sectionData !== "object") return [];
  const value = (sectionData as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseConditionList(consent: unknown): string[] {
  const direct = parseConsentArray(consent, "conditions", "health_conditions");
  if (direct.length) return direct;

  if (!consent || typeof consent !== "object") return [];
  const conditions = (consent as Record<string, unknown>)["conditions"];
  if (!conditions || typeof conditions !== "object") return [];
  const value = (conditions as Record<string, unknown>)["conditions"];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const name = (item as Record<string, unknown>)["name"];
        return typeof name === "string" ? name : null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function parseConsentString(consent: unknown, section: string, key: string): string | null {
  if (!consent || typeof consent !== "object") return null;
  const sectionData = (consent as Record<string, unknown>)[section];
  if (!sectionData || typeof sectionData !== "object") return null;
  const value = (sectionData as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseConsentRecord(consent: unknown, section: string, key: string): Record<string, string> {
  if (!consent || typeof consent !== "object") return {};
  const sectionData = (consent as Record<string, unknown>)[section];
  if (!sectionData || typeof sectionData !== "object") return {};
  const value = (sectionData as Record<string, unknown>)[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0),
  );
}

function buildTrendSummary(checkins: ProfileContext["recent_checkins"]): ProfileContext["trend_summary"] {
  const energyValues = checkins
    .map((row) => row.energy_level)
    .filter((value): value is number => typeof value === "number");
  const avgEnergy = energyValues.length
    ? Math.round((energyValues.reduce((sum, value) => sum + value, 0) / energyValues.length) * 10) / 10
    : null;
  const latestEnergy = energyValues[0];
  const olderEnergy = energyValues.slice(1);
  const olderAvg = olderEnergy.length
    ? olderEnergy.reduce((sum, value) => sum + value, 0) / olderEnergy.length
    : null;

  let energyDirection: ProfileContext["trend_summary"]["energy_direction"] = "unknown";
  if (typeof latestEnergy === "number" && typeof olderAvg === "number") {
    if (latestEnergy <= olderAvg - 0.6) energyDirection = "down";
    else if (latestEnergy >= olderAvg + 0.6) energyDirection = "up";
    else energyDirection = "steady";
  }

  const symptomCounts = new Map<string, number>();
  for (const row of checkins) {
    for (const symptom of row.symptoms ?? []) {
      if (symptom === "ninguno") continue;
      symptomCounts.set(symptom, (symptomCounts.get(symptom) ?? 0) + 1);
    }
  }

  return {
    total_recent: checkins.length,
    avg_energy: avgEnergy,
    energy_direction: energyDirection,
    repeated_low_energy: checkins.filter((row) => (row.energy_level ?? 5) <= 2).length,
    repeated_poor_sleep: checkins.filter((row) => ["mal", "muy_mal"].includes(row.sleep_quality ?? "")).length,
    repeated_low_mood: checkins.filter((row) => ["triste", "ansiosa"].includes(row.mood ?? "")).length,
    repeated_no_social: checkins.filter((row) => row.social_contact === "no").length,
    recurring_symptoms: Array.from(symptomCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([symptom]) => symptom)
      .slice(0, 3),
  };
}

async function optionalRows<T = Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<T[]> {
  try {
    const result = await pool.query(sql, values);
    return result.rows as T[];
  } catch (err) {
    console.warn("[checkins] optional context unavailable:", err);
    return [];
  }
}

function ageFromDate(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const hadBirthday =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());
  if (!hadBirthday) age -= 1;
  return age > 0 && age < 130 ? age : null;
}

async function fetchProfileContext(userId: string): Promise<ProfileContext> {
  const profileResult = await pool.query(
    `select
       full_name, preferred_name, date_of_birth, language,
       address_line_1, city, region, postcode, country_code,
       gp_name, gp_phone, gp_address,
       caregiver_name, caregiver_contact,
       known_allergies, data_sharing_consent
     from profiles
     where id = $1
     limit 1`,
    [userId],
  );
  const profile = profileResult.rows[0] as
    | {
        full_name: string | null;
        preferred_name: string | null;
        date_of_birth: string | null;
        language: string | null;
        address_line_1: string | null;
        city: string | null;
        region: string | null;
        postcode: string | null;
        country_code: string | null;
        gp_name: string | null;
        gp_phone: string | null;
        gp_address: string | null;
        caregiver_name: string | null;
        caregiver_contact: string | null;
        known_allergies: string[] | null;
        data_sharing_consent: unknown;
      }
    | undefined;

  const medsResult = await pool.query(
    `select medication_name, dosage, frequency
     from user_medications
     where user_id = $1 and active = true
     order by created_at desc
     limit 12`,
    [userId],
  );

  const companionRows = await optionalRows<{
    hobbies: string[] | null;
    interests: string[] | null;
    preferred_activities: string[] | null;
  }>(
    `select hobbies, interests, preferred_activities
     from companion_profiles
     where user_id = $1
     limit 1`,
    [userId],
  );

  const vitalsRows = await optionalRows<{
    metric_type: string | null;
    value: string | null;
    bpm: number | null;
    respiratory_rate: number | null;
    recorded_at: Date;
  }>(
    `select metric_type, value, bpm, respiratory_rate, recorded_at
     from vitals_readings
     where user_id = $1
     order by recorded_at desc
     limit 6`,
    [userId],
  );

  const activityRows = await optionalRows<{ activity_type: string; duration_minutes: number }>(
    `select activity_type, duration_minutes
     from activity_logs
     where user_id = $1 and logged_at >= now() - interval '7 days'
     order by logged_at desc
     limit 20`,
    [userId],
  );

  const triageRows = await optionalRows<{ chief_complaint: string; urgency: string; created_at: Date }>(
    `select chief_complaint, urgency, created_at
     from triage_reports
     where user_id = $1
     order by created_at desc
     limit 3`,
    [userId],
  );

  const adherenceRows = await optionalRows<{ status: string; count: string }>(
    `select status, count(*)::text as count
     from medication_adherence
     where user_id = $1 and created_at >= now() - interval '14 days'
     group by status`,
    [userId],
  );

  const checkinRows = await optionalRows<{
    energy_level: number | null;
    mood: string | null;
    sleep_quality: string | null;
    symptoms: string[] | null;
    social_contact: string | null;
    completed_at: Date;
  }>(
    `select energy_level, mood, sleep_quality, symptoms, social_contact, completed_at
     from checkin_sessions
     where user_id = $1 and completed = true
     order by completed_at desc
     limit 7`,
    [userId],
  );

  const name =
    profile?.preferred_name ||
    profile?.full_name?.split(/\s+/).filter(Boolean)[0] ||
    "amiga";

  const consent = profile?.data_sharing_consent;
  const companion = companionRows[0];
  const hobbies = [
    ...(companion?.hobbies ?? []),
    ...parseConsentArray(consent, "hobbies", "hobbies"),
  ];
  const preferredActivities = companion?.preferred_activities ?? [];

  const activityCounts = new Map<string, number>();
  for (const row of activityRows) {
    activityCounts.set(row.activity_type, (activityCounts.get(row.activity_type) ?? 0) + 1);
  }

  const adherenceCounts = adherenceRows.reduce(
    (acc, row) => {
      const count = Number(row.count) || 0;
      if (["taken", "confirmed", "done"].includes(row.status)) acc.taken_14d += count;
      if (["missed", "skipped", "late"].includes(row.status)) acc.missed_14d += count;
      return acc;
    },
    { taken_14d: 0, missed_14d: 0 },
  );

  const recentCheckins = checkinRows.map((row) => ({
    energy_level: row.energy_level,
    mood: row.mood,
    sleep_quality: row.sleep_quality,
    symptoms: row.symptoms ?? [],
    social_contact: row.social_contact,
    completed_at: row.completed_at.toISOString(),
  }));

  return {
    name,
    grammatical_gender: inferProfileGender(consent, name),
    age: ageFromDate(profile?.date_of_birth ?? null),
    language: profile?.language ?? "es",
    location: {
      city: profile?.city ?? null,
      region: profile?.region ?? null,
      country_code: profile?.country_code ?? null,
      address_available: Boolean(profile?.address_line_1 || profile?.postcode),
    },
    city: profile?.city ?? null,
    mobility_level: parseConsentString(consent, "conditions", "mobility_level"),
    living_situation: parseConsentString(consent, "conditions", "living_situation"),
    gp: {
      name: profile?.gp_name ?? null,
      phone_available: Boolean(profile?.gp_phone),
      address_available: Boolean(profile?.gp_address),
    },
    caregiver: {
      name: profile?.caregiver_name ?? null,
      contact_available: Boolean(profile?.caregiver_contact),
    },
    conditions: parseConditionList(consent),
    medications: medsResult.rows.map((row) =>
      [row.medication_name, row.dosage, row.frequency].filter(Boolean).join(" "),
    ),
    allergies: profile?.known_allergies ?? [],
    diet: {
      preferences: [
        ...parseConsentArray(consent, "diet", "dietary_preferences"),
        ...parseConsentArray(consent, "diet", "preferences"),
      ],
      notes: parseConsentString(consent, "diet", "dietary_notes") ?? parseConsentString(consent, "diet", "notes"),
    },
    interests: {
      hobbies: Array.from(new Set(hobbies)),
      preferred_activities: preferredActivities,
      personality: parseConsentRecord(consent, "hobbies", "personality"),
    },
    recent_vitals: vitalsRows.map((row) => ({
      metric: row.metric_type ?? (row.bpm != null ? "hr" : row.respiratory_rate != null ? "rr" : "unknown"),
      value: row.value ?? String(row.bpm ?? row.respiratory_rate ?? ""),
      recorded_at: row.recorded_at.toISOString(),
    })).filter((row) => row.value),
    recent_activity: {
      last_7_days_minutes: activityRows.reduce((sum, row) => sum + (row.duration_minutes ?? 0), 0),
      common_activities: Array.from(activityCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name),
    },
    recent_triage: triageRows.map((row) => ({
      chief_complaint: row.chief_complaint,
      urgency: row.urgency,
      created_at: row.created_at.toISOString(),
    })),
    recent_checkins: recentCheckins,
    trend_summary: buildTrendSummary(recentCheckins),
    medication_adherence: adherenceCounts,
  };
}

function fallbackResult(profile: ProfileContext, answers: CheckinAnswers): AiCheckinResult {
  const lowEnergy = answers.energy_level <= 2;
  const poorSleep = ["mal", "muy_mal"].includes(answers.sleep_quality);
  const lowMood = ["triste", "ansiosa"].includes(answers.mood);
  const hasSymptoms = answers.symptoms.some((s) => s !== "ninguno");
  const safetySignal =
    answers.symptoms.includes("falta_aire") ||
    answers.symptoms.includes("confusion") ||
    answers.body_areas.includes("pecho");
  const limitedMobility = ["stick_or_frame", "wheelchair_part_time", "wheelchair_full_time", "housebound"]
    .includes(profile.mobility_level ?? "");
  const favouriteQuietActivity =
    profile.interests.hobbies.find((hobby) => !["Walking", "Cycling", "Golf", "Tennis", "Dancing"].includes(hobby)) ??
    "algo tranquilo que te guste";
  const overall_state: AiCheckinResult["overall_state"] =
    lowEnergy || poorSleep || lowMood || hasSymptoms ? "moderate" : answers.energy_level >= 4 ? "good" : "tired";
  const gender = profile.grammatical_gender;

  const feeling_label =
    overall_state === "good" ? "Un día bastante estable" :
    overall_state === "tired" ? gendered(gender, "Algo cansada hoy", "Algo cansado hoy", "Algo de cansancio hoy") :
    "Un día para cuidarte con calma";
  const trendSignals = [
    profile.trend_summary.repeated_low_energy >= 2
      ? `Has marcado energía baja en ${profile.trend_summary.repeated_low_energy} check-ins recientes.`
      : null,
    profile.trend_summary.repeated_poor_sleep >= 2
      ? `El descanso flojo aparece en ${profile.trend_summary.repeated_poor_sleep} check-ins recientes.`
      : null,
    profile.trend_summary.repeated_no_social >= 2
      ? "También se repite poca compañía, así que conviene añadir un contacto humano sencillo."
      : null,
    profile.trend_summary.energy_direction === "down"
      ? "La energía parece ir algo más baja que en tus últimas lecturas."
      : profile.trend_summary.energy_direction === "up"
        ? "La energía parece algo mejor que en tus últimas lecturas."
        : null,
  ].filter(Boolean);
  const suggestedAppAction: AiCheckinResult["suggested_app_action"] =
    safetySignal ? "care" :
    hasSymptoms ? "symptom" :
    lowEnergy || poorSleep ? "vitals" :
    "concierge";

  return {
    feeling_label,
    overall_state,
    vyva_reading: `${profile.name}, hoy conviene ir con calma y escucharte un poco. No hace falta hacer mucho: con dos o tres gestos sencillos puedes sentirte ${gendered(gender, "más acompañada", "más acompañado", "con más apoyo")} y estable.`,
    why_today: [
      lowEnergy ? "Tu nivel de energía está bajo, así que hoy pesa más proteger el ritmo." : null,
      poorSleep ? "Dormiste peor de lo habitual, y eso puede hacer que todo cueste un poco más." : null,
      lowMood ? "El ánimo también pide compañía suave y planes sencillos." : null,
      profile.trend_summary.total_recent ? "También he tenido en cuenta tus últimos check-ins." : null,
    ].filter(Boolean).join(" ") || "La lectura combina tus respuestas de hoy con tu perfil personal.",
    trend_note: trendSignals.join(" ") || null,
    personal_plan: limitedMobility
      ? `Hoy te conviene algo cómodo, sentado o de baja movilidad; si te apetece, dedica un rato a ${favouriteQuietActivity}.`
      : "Si te apetece salir, mira Para ti hoy en Concierge para elegir una idea cercana, concreta y fácil de adaptar.",
    app_suggestion: safetySignal
      ? "El mejor siguiente paso es buscar atención médica si esto continúa o empeora, y avisar a alguien cercano."
      : hasSymptoms
      ? "El mejor siguiente paso es usar el chequeo de síntomas o tomar signos vitales antes de decidir qué hacer."
      : lowEnergy || poorSleep
        ? "El mejor siguiente paso es tomar signos vitales si tienes dudas, y después elegir un plan muy suave."
        : "El mejor siguiente paso es mirar Para ti hoy para convertir esta lectura en un plan concreto.",
    suggested_app_action: suggestedAppAction,
    right_now: [
      "Bebe un vaso de agua despacio.",
      gendered(gender, "Siéntate cómoda y respira profundo durante un minuto.", "Siéntate cómodo y respira profundo durante un minuto.", "Siéntate en una postura cómoda y respira profundo durante un minuto."),
      "Elige una cosa pequeña que te apetezca hacer ahora.",
    ],
    today_actions: [
      poorSleep
        ? "Haz una pausa tranquila después de comer y evita planes largos."
        : limitedMobility
          ? `Mira Para ti hoy en Concierge para elegir un plan sentado o dedica un rato a ${favouriteQuietActivity}.`
          : "Mira Para ti hoy en Concierge para escoger una salida cercana y adaptada.",
      lowMood ? "Habla con alguien cercano aunque sea unos minutos." : "Busca un momento agradable fuera de pantallas.",
      hasSymptoms ? "Si algo no mejora, abre el chequeo de síntomas o toma signos vitales en VYVA." : "Guarda energía para una cosa que te haga ilusión.",
    ],
    highlight: lowEnergy ? "Tu energía pide un ritmo más suave hoy." : "Hoy tienes margen para cuidarte sin prisa.",
    flag_caregiver: answers.energy_level <= 1 || (lowMood && answers.social_contact === "no"),
    watch_for: hasSymptoms ? "Si notas que algo empeora o te preocupa, usa el chequeo de síntomas de VYVA, toma signos vitales si puedes y busca atención médica si es urgente." : null,
  };
}

function buildPrompt(profile: ProfileContext, answers: CheckinAnswers, language: string): string {
  return `You are VYVA, a warm AI companion for older adults. Respond in ${language}.

Create a gentle daily wellness check-in result. Do not diagnose. Do not prescribe. Avoid clinical framing. Keep language simple, warm, and actionable.

Use all available context below. Personalize recommendations using:
- age, language, location, living situation, and mobility level;
- known conditions, medications, allergies, and dietary preferences;
- GP/caregiver availability, but only mention contacting them if today's answers suggest support is useful;
- recent vitals, medication adherence, previous check-ins, activity patterns, and recent triage concerns;
- hobbies and preferred activities, so suggestions feel familiar and enjoyable.

Safety and personalization rules:
- ${genderInstruction(profile.grammatical_gender)}
- Do not suggest walking, outings, exercise, food, or social plans that conflict with mobility, symptoms, diet, allergies, or low energy.
- If symptoms include chest discomfort, breathlessness, confusion, severe dizziness, or a worrying pattern, include a calm watch_for note.
- If the user has low mood, low social contact, or repeated low energy, suggest one small connection step.
- Keep every action concrete and doable today.
- Make recommendations creative, specific, and useful. Avoid generic advice like "try a hobby" unless it connects to a known hobby, location, routine, or profile signal.
- Whenever an outing, cultural plan, social idea, or gentle activity would help, mention VYVA Concierge / "Para ti hoy" as the place to find a nearby adapted plan.
- Whenever symptoms, dizziness, breathlessness, chest discomfort, fever, nausea, or worrying changes appear, route the user to app actions: symptom check, vitals scan, and medical attention when appropriate.
- Do not only say "see a doctor". Prefer: "haz el chequeo de síntomas", "toma signos vitales", and "busca atención médica si empeora o parece urgente".
- Make the result feel like a small personalized report, not a generic wellness paragraph.
- Explain why this reading fits today, using the user's answers and relevant profile signals.
- Use trend_summary to mention repeated patterns when they matter. Do not exaggerate one-off signals.
- Include one concrete plan that fits the user's health profile, location, mobility, interests, and app capabilities.
- Set suggested_app_action to the single best primary next action: care for urgent warning signs, symptom for symptoms, vitals for dizziness/low energy/breathlessness, concierge for outings/social/helpful plans.

User profile:
${JSON.stringify(profile, null, 2)}

Today's answers:
${JSON.stringify(answers, null, 2)}

Return ONLY valid JSON with this shape:
{
  "feeling_label": "short warm label, max 5 words",
  "overall_state": "excellent|good|moderate|tired|low",
  "vyva_reading": "2 short warm sentences",
  "why_today": "why this reading fits today's answers and profile, max 2 sentences",
  "trend_note": "brief pattern from recent check-ins, or null if there is no useful trend",
  "personal_plan": "a concrete mini-plan adapted to profile, location, mobility and interests, max 2 sentences",
  "app_suggestion": "the best next step inside VYVA, such as Concierge Para ti hoy, symptom check, vitals scan, or medical attention, max 1 sentence",
  "suggested_app_action": "concierge|symptom|vitals|care",
  "right_now": ["one simple action", "one simple action", "one simple action"],
  "today_actions": ["one useful action for today", "one useful action for today", "one useful action for today"],
  "highlight": "one insight, max 20 words",
  "flag_caregiver": false,
  "watch_for": "gentle safety note or null"
}`;
}

function normalizeAiResult(value: unknown, fallback: AiCheckinResult): AiCheckinResult {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<AiCheckinResult>;
  const states = ["excellent", "good", "moderate", "tired", "low"];
  return {
    feeling_label: typeof raw.feeling_label === "string" ? raw.feeling_label.slice(0, 80) : fallback.feeling_label,
    overall_state: states.includes(raw.overall_state ?? "") ? raw.overall_state! : fallback.overall_state,
    vyva_reading: typeof raw.vyva_reading === "string" ? raw.vyva_reading.slice(0, 700) : fallback.vyva_reading,
    why_today: typeof raw.why_today === "string" ? raw.why_today.slice(0, 360) : fallback.why_today ?? null,
    trend_note: typeof raw.trend_note === "string" ? raw.trend_note.slice(0, 320) : fallback.trend_note ?? null,
    personal_plan: typeof raw.personal_plan === "string" ? raw.personal_plan.slice(0, 420) : fallback.personal_plan ?? null,
    app_suggestion: typeof raw.app_suggestion === "string" ? raw.app_suggestion.slice(0, 320) : fallback.app_suggestion ?? null,
    suggested_app_action: ["concierge", "symptom", "vitals", "care"].includes(raw.suggested_app_action ?? "")
      ? raw.suggested_app_action!
      : fallback.suggested_app_action ?? null,
    right_now: Array.isArray(raw.right_now) ? raw.right_now.filter((x): x is string => typeof x === "string").slice(0, 3) : fallback.right_now,
    today_actions: Array.isArray(raw.today_actions) ? raw.today_actions.filter((x): x is string => typeof x === "string").slice(0, 3) : fallback.today_actions,
    highlight: typeof raw.highlight === "string" ? raw.highlight.slice(0, 160) : fallback.highlight,
    flag_caregiver: typeof raw.flag_caregiver === "boolean" ? raw.flag_caregiver : fallback.flag_caregiver,
    watch_for: typeof raw.watch_for === "string" ? raw.watch_for.slice(0, 240) : null,
  };
}

async function generateResult(profile: ProfileContext, answers: CheckinAnswers, language: string): Promise<AiCheckinResult> {
  const fallback = fallbackResult(profile, answers);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) return fallback;

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.55,
      max_tokens: 700,
      messages: [
        { role: "system", content: "Return only JSON. You are a kind senior wellness companion, not a clinician." },
        { role: "user", content: buildPrompt(profile, answers, language) },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    return normalizeAiResult(JSON.parse(content), fallback);
  } catch (err) {
    console.error("[checkins] AI generation failed:", err);
    return fallback;
  }
}

async function saveSession(userId: string, language: string, answers: CheckinAnswers, result: AiCheckinResult, durationSeconds: number | null) {
  try {
    const inserted = await pool.query(
      `insert into checkin_sessions (
        user_id, energy_level, mood, body_areas, sleep_quality, symptoms, social_contact,
        feeling_label, overall_state, vyva_reading, right_now, today_actions, highlight,
        flag_caregiver, watch_for, language, completed, duration_seconds
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,true,$17
      )
      returning id`,
      [
        userId,
        answers.energy_level,
        answers.mood,
        answers.body_areas,
        answers.sleep_quality,
        answers.symptoms,
        answers.social_contact,
        result.feeling_label,
        result.overall_state,
        result.vyva_reading,
        JSON.stringify(result.right_now),
        JSON.stringify(result.today_actions),
        result.highlight,
        result.flag_caregiver,
        result.watch_for,
        language,
        durationSeconds,
      ],
    );
    return inserted.rows[0]?.id as string | undefined;
  } catch (err) {
    console.warn("[checkins] session not saved; has the checkin schema been applied?", err);
    return undefined;
  }
}

async function updateTrend(userId: string, answers: CheckinAnswers, result: AiCheckinResult) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const lowEnergy = answers.energy_level <= 2;
    const poorSleep = ["mal", "muy_mal"].includes(answers.sleep_quality);
    const noSocial = answers.social_contact === "no";
    const lowMood = ["triste", "ansiosa"].includes(answers.mood);
    const moodScore = MOOD_SCORE[answers.mood] ?? 3;
    const flagReason =
      lowEnergy ? "Energía baja en el check-in de hoy" :
      poorSleep ? "Descanso bajo en el check-in de hoy" :
      lowMood ? "Ánimo bajo en el check-in de hoy" :
      null;

    await pool.query(
      `insert into checkin_trend_state (
        user_id, streak_days, best_streak, last_checkin_date, total_checkins,
        avg_energy_7d, avg_mood_score_7d, consecutive_low_energy,
        consecutive_poor_sleep, consecutive_no_social, consecutive_low_mood,
        caregiver_flag_active, flag_reason, flag_triggered_at, updated_at
      ) values (
        $1,1,1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,case when $9 then now() else null end,now()
      )
      on conflict (user_id) do update set
        streak_days = case
          when checkin_trend_state.last_checkin_date = $2::date then checkin_trend_state.streak_days
          when checkin_trend_state.last_checkin_date = ($2::date - interval '1 day') then checkin_trend_state.streak_days + 1
          else 1
        end,
        best_streak = greatest(checkin_trend_state.best_streak, checkin_trend_state.streak_days),
        last_checkin_date = $2,
        total_checkins = checkin_trend_state.total_checkins + 1,
        avg_energy_7d = ((coalesce(checkin_trend_state.avg_energy_7d, $3) * least(checkin_trend_state.total_checkins, 6)) + $3) / (least(checkin_trend_state.total_checkins, 6) + 1),
        avg_mood_score_7d = ((coalesce(checkin_trend_state.avg_mood_score_7d, $4) * least(checkin_trend_state.total_checkins, 6)) + $4) / (least(checkin_trend_state.total_checkins, 6) + 1),
        consecutive_low_energy = case when $5 then checkin_trend_state.consecutive_low_energy + 1 else 0 end,
        consecutive_poor_sleep = case when $6 then checkin_trend_state.consecutive_poor_sleep + 1 else 0 end,
        consecutive_no_social = case when $7 then checkin_trend_state.consecutive_no_social + 1 else 0 end,
        consecutive_low_mood = case when $8 then checkin_trend_state.consecutive_low_mood + 1 else 0 end,
        caregiver_flag_active = $9 or checkin_trend_state.caregiver_flag_active,
        flag_reason = case when $9 then $10 else checkin_trend_state.flag_reason end,
        flag_triggered_at = case when $9 and checkin_trend_state.flag_triggered_at is null then now() else checkin_trend_state.flag_triggered_at end,
        updated_at = now()`,
      [
        userId,
        today,
        answers.energy_level,
        moodScore,
        lowEnergy,
        poorSleep,
        noSocial,
        lowMood,
        result.flag_caregiver,
        flagReason,
      ],
    );
  } catch (err) {
    console.warn("[checkins] trend not updated; has the checkin schema been applied?", err);
  }
}

router.post("/analyze", requireUser, async (req: Request, res: Response) => {
  const parsed = checkinBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const userId = req.user!.id;
  const { answers, language, duration_seconds } = parsed.data;

  try {
    const profile = await fetchProfileContext(userId);
    const result = await generateResult(profile, answers, language || profile.language);
    const sessionId = await saveSession(userId, language || profile.language, answers, result, duration_seconds ?? null);
    await updateTrend(userId, answers, result);

    return res.json({ result, session_id: sessionId ?? null });
  } catch (err) {
    console.error("[checkins] analyze failed:", err);
    return res.status(500).json({ error: "Failed to analyze check-in" });
  }
});

router.post("/abandon", requireUser, async (req: Request, res: Response) => {
  const parsed = abandonBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    await pool.query(
      `insert into checkin_sessions (user_id, language, completed, abandoned, duration_seconds)
       values ($1, $2, false, true, $3)`,
      [req.user!.id, parsed.data.language, parsed.data.duration_seconds ?? null],
    );
  } catch (err) {
    console.warn("[checkins] abandoned session not saved; has the checkin schema been applied?", err);
  }

  return res.json({ ok: true });
});

export default router;
