import type { Request, Response } from "express";
import OpenAI from "openai";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, pool } from "../db.js";
import {
  profiles,
  companionProfiles,
  socialUserInterests,
  userMedications,
  activityLogs,
} from "../../shared/schema.js";
import { genderInstruction, inferProfileGender, type GrammaticalGender } from "../lib/userPersonalization.js";

const DEMO_USER_ID = "demo-user";

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  it: "Italian",
  cy: "Welsh",
};

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface UserProfileContext {
  name: string;
  grammaticalGender: GrammaticalGender;
  city: string;
  region: string;
  countryCode: string;
  address: string;
  interests: string[];
  healthConditions: string[];
  mobilityLevel: string;
  knownAllergies: string[];
  activeMedications: string[];
  recentActivityTypes: string[];
  recentConciergeUseCases: string[];
  pendingConciergeUseCases: string[];
  upcomingReminders: Array<{
    reminder_type?: string;
    title?: string;
    reminder_date?: string;
    source_use_case?: string;
  }>;
  socialActivityLevel: string;
  preferredTimes: string[];
  recommendationFeedback: RecommendationFeedbackSummary;
  weather: WeatherContext | null;
}

interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  prompt?: string;
  history?: HistoryTurn[];
  locale?: string;
}

interface RecommendationsRequestBody {
  locale?: string;
  refresh?: boolean;
}

interface RecommendationFeedbackRequestBody {
  recommendation_id?: string;
  action?: "shown" | "opened" | "liked" | "dismissed" | "completed";
  category?: string;
  title?: string;
  reasons?: string[];
}

interface RecommendationPlanRequestBody {
  card?: RecommendationCard;
  locale?: string;
}

export interface RecommendationActionPlan {
  title: string;
  summary: string;
  place_name?: string;
  address?: string;
  phone?: string;
  website?: string;
  maps_url?: string;
  opening_hours?: string[];
  price_info: string;
  travel_info: string;
  accessibility_note: string;
  next_steps: string[];
  caveat: string;
  share_text: string;
}

interface RecommendationResolvedPlace {
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  openingHours?: string[];
  priceInfo?: string;
  sourceName?: string;
  sourceUrl?: string;
  dateText?: string;
  timeInfo?: string;
  matchReason?: string;
  priceLevel?: number;
  rating?: number;
  reviewCount?: number;
}

interface RecommendationFeedbackSummary {
  shownIds: string[];
  openedIds: string[];
  likedIds: string[];
  dismissedIds: string[];
  completedIds: string[];
}

interface WeatherContext {
  city: string;
  temperatureC: number;
  condition: string;
  outdoorSuitability: "good" | "caution" | "poor";
}

interface RecommendationCandidate {
  id: string;
  category: RecommendationCard["category"];
  emoji: string;
  title: Record<"en" | "es", string>;
  description: Record<"en" | "es", string>;
  why: Record<"en" | "es", string>;
  details: Record<"en" | "es", string>;
  steps: Record<"en" | "es", string[]>;
  actionLabel: Record<"en" | "es", string>;
  actionPrompt: Record<"en" | "es", string>;
  safetyNote: Record<"en" | "es", string>;
  actionPayload?: {
    flow: string;
    needs: string[];
    searchTerms?: string[];
  };
  tags: string[];
  physicalDemand: "none" | "low" | "moderate";
  outdoorExposure?: "none" | "some" | "mostly";
  requiresLocation?: boolean;
  requiresMedicationContext?: boolean;
  requiresHealthContext?: boolean;
  requiresInterests?: boolean;
  preferredWhen?: (context: UserProfileContext) => boolean;
}

interface RankedRecommendationCandidate {
  candidate: RecommendationCandidate;
  score: number;
  reasons: string[];
}

export interface RecommendationCard {
  id?: string;
  title: string;
  description: string;
  category: "deal" | "event" | "tip" | "activity";
  emoji: string;
  why?: string;
  details?: string;
  steps?: string[];
  action_label?: string;
  action_prompt?: string;
  safety_note?: string;
  best_time?: string;
  effort?: "none" | "low" | "medium";
  freshness?: string;
  personal_signals?: string[];
  action_kind?: "chat" | "call" | "booking" | "check" | "plan";
  action_payload?: {
    flow: string;
    needs: string[];
    search_terms?: string[];
    title?: string;
    category?: RecommendationCard["category"];
    personal_signals?: string[];
    location_hint?: string;
    safety_note?: string;
    resolved_place?: RecommendationResolvedPlace;
  };
  location_hint?: string;
  score?: number;
  reason_codes?: string[];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normaliseLocale(locale: unknown): string {
  const baseLocale = typeof locale === "string" ? locale.split("-")[0].toLowerCase() : "en";
  return baseLocale in LOCALE_TO_LANGUAGE ? baseLocale : "en";
}

function emptyProfileContext(): UserProfileContext {
  return {
    name: "",
    grammaticalGender: "neutral",
    city: "",
    region: "",
    countryCode: "ES",
    address: "",
    interests: [],
    healthConditions: [],
    mobilityLevel: "",
    knownAllergies: [],
    activeMedications: [],
    recentActivityTypes: [],
    recentConciergeUseCases: [],
    pendingConciergeUseCases: [],
    upcomingReminders: [],
    socialActivityLevel: "moderate",
    preferredTimes: [],
    recommendationFeedback: {
      shownIds: [],
      openedIds: [],
      likedIds: [],
      dismissedIds: [],
      completedIds: [],
    },
    weather: null,
  };
}

async function getRecommendationFeedbackSummary(userId: string): Promise<RecommendationFeedbackSummary> {
  const empty: RecommendationFeedbackSummary = { shownIds: [], openedIds: [], likedIds: [], dismissedIds: [], completedIds: [] };

  try {
    const result = await pool.query(
      `
        select recommendation_id, action
        from concierge_recommendation_feedback
        where user_id = $1
          and created_at >= now() - interval '90 days'
        order by created_at desc
        limit 200
      `,
      [userId],
    );

    const liked = new Set<string>();
    const dismissed = new Set<string>();
    const completed = new Set<string>();
    const shown = new Set<string>();
    const opened = new Set<string>();

    for (const row of result.rows as Array<{ recommendation_id?: string; action?: string }>) {
      if (!row.recommendation_id) continue;
      if (row.action === "shown") shown.add(row.recommendation_id);
      if (row.action === "opened") opened.add(row.recommendation_id);
      if (row.action === "liked") liked.add(row.recommendation_id);
      if (row.action === "dismissed") dismissed.add(row.recommendation_id);
      if (row.action === "completed") completed.add(row.recommendation_id);
    }

    return {
      shownIds: Array.from(shown),
      openedIds: Array.from(opened),
      likedIds: Array.from(liked),
      dismissedIds: Array.from(dismissed),
      completedIds: Array.from(completed),
    };
  } catch {
    return empty;
  }
}

async function ensureRecommendationFeedbackTable(): Promise<void> {
  await pool.query(`
    create table if not exists concierge_recommendation_feedback (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      recommendation_id text not null,
      action text not null,
      category text,
      title text,
      reasons jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    create index if not exists concierge_recommendation_feedback_user_created_idx
    on concierge_recommendation_feedback (user_id, created_at desc)
  `);
}

function wmoCodeToWeatherCondition(code: number): string {
  if (code === 0) return "clear";
  if (code <= 2) return "partly_cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 55) return "drizzle";
  if (code >= 61 && code <= 65) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code >= 95) return "thunderstorm";
  return "cloudy";
}

function outdoorSuitability(temperatureC: number, condition: string): WeatherContext["outdoorSuitability"] {
  if (temperatureC >= 34 || temperatureC <= 4) return "poor";
  if (["rain", "showers", "snow", "thunderstorm", "fog"].includes(condition)) return "poor";
  if (temperatureC >= 29 || temperatureC <= 8 || ["drizzle", "overcast"].includes(condition)) return "caution";
  return "good";
}

async function getWeatherContext(context: UserProfileContext): Promise<WeatherContext | null> {
  if (!context.city) return null;

  try {
    const geoParams = new URLSearchParams({
      name: context.city,
      count: "1",
      language: "en",
      format: "json",
    });
    if (context.countryCode) geoParams.set("country_code", context.countryCode);

    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${geoParams}`, {
      signal: AbortSignal.timeout(4500),
    });
    if (!geoRes.ok) return null;
    const geoData = await geoRes.json() as {
      results?: Array<{ latitude: number; longitude: number; name?: string }>;
    };
    const geo = geoData.results?.[0];
    if (!geo) return null;

    const weatherParams = new URLSearchParams({
      latitude: String(geo.latitude),
      longitude: String(geo.longitude),
      current: "temperature_2m,weather_code",
      temperature_unit: "celsius",
      timezone: "auto",
    });
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?${weatherParams}`, {
      signal: AbortSignal.timeout(4500),
    });
    if (!weatherRes.ok) return null;
    const weatherData = await weatherRes.json() as {
      current?: { temperature_2m?: number; weather_code?: number };
    };

    const temperatureC = Math.round(weatherData.current?.temperature_2m ?? 0);
    const condition = wmoCodeToWeatherCondition(weatherData.current?.weather_code ?? 0);

    return {
      city: geo.name || context.city,
      temperatureC,
      condition,
      outdoorSuitability: outdoorSuitability(temperatureC, condition),
    };
  } catch {
    return null;
  }
}

async function getUserProfile(userId: string): Promise<UserProfileContext> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      profileRows,
      companionRows,
      socialRows,
      medicationRows,
      activityRows,
      conciergeRows,
      pendingRows,
      reminderRows,
      feedbackSummary,
    ] = await Promise.all([
      db
        .select({
          full_name: profiles.full_name,
          preferred_name: profiles.preferred_name,
          city: profiles.city,
          region: profiles.region,
          country_code: profiles.country_code,
          address_line_1: profiles.address_line_1,
          known_allergies: profiles.known_allergies,
          data_sharing_consent: profiles.data_sharing_consent,
        })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1),
      db
        .select({
          interests: companionProfiles.interests,
          hobbies: companionProfiles.hobbies,
          preferred_activities: companionProfiles.preferred_activities,
        })
        .from(companionProfiles)
        .where(eq(companionProfiles.user_id, userId))
        .limit(1),
      db
        .select({
          interest_tags: socialUserInterests.interest_tags,
          preferred_times: socialUserInterests.preferred_times,
          activity_level: socialUserInterests.activity_level,
        })
        .from(socialUserInterests)
        .where(eq(socialUserInterests.user_id, userId))
        .limit(1),
      db
        .select({ medication_name: userMedications.medication_name })
        .from(userMedications)
        .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true)))
        .limit(12),
      db
        .select({ activity_type: activityLogs.activity_type })
        .from(activityLogs)
        .where(and(eq(activityLogs.user_id, userId), gte(activityLogs.logged_at, thirtyDaysAgo)))
        .orderBy(desc(activityLogs.logged_at))
        .limit(12),
      pool
        .query(
          `
            select use_case
            from concierge_sessions
            where user_id = $1
            order by completed_at desc nulls last
            limit 12
          `,
          [userId],
        )
        .then((result) => result.rows as Array<{ use_case?: string }>)
        .catch(() => []),
      pool
        .query(
          `
            select use_case
            from concierge_pending
            where user_id = $1
              and status in ('pending', 'calling')
            order by confirmed_at desc nulls last
            limit 10
          `,
          [userId],
        )
        .then((result) => result.rows as Array<{ use_case?: string }>)
        .catch(() => []),
      pool
        .query(
          `
            select reminder_type, title, reminder_date::text, source_use_case
            from concierge_reminders
            where user_id = $1
              and is_active = true
              and reminder_date between current_date and current_date + interval '7 days'
            order by reminder_date asc
            limit 8
          `,
          [userId],
        )
        .then((result) => result.rows as Array<{
          reminder_type?: string;
          title?: string;
          reminder_date?: string;
          source_use_case?: string;
        }>)
        .catch(() => []),
      getRecommendationFeedbackSummary(userId),
    ]);

    const profile = profileRows[0];
    const companion = companionRows[0];
    const social = socialRows[0];
    const consent = (profile?.data_sharing_consent ?? {}) as Record<string, unknown>;
    const conditions = consent.conditions as Record<string, unknown> | undefined;
    const hobbiesConsent = consent.hobbies as Record<string, unknown> | undefined;

    const context = emptyProfileContext();
    context.healthConditions = asStringArray(conditions?.health_conditions);
    context.mobilityLevel = typeof conditions?.mobility_level === "string" ? conditions.mobility_level : "";
    context.activeMedications = medicationRows.map((m) => m.medication_name);
    context.recentActivityTypes = activityRows.map((a) => a.activity_type);
    context.recentConciergeUseCases = conciergeRows.map((r) => r.use_case ?? "").filter(Boolean);
    context.pendingConciergeUseCases = pendingRows.map((r) => r.use_case ?? "").filter(Boolean);
    context.upcomingReminders = reminderRows;
    context.socialActivityLevel = social?.activity_level ?? "moderate";
    context.preferredTimes = social?.preferred_times ?? [];
    context.recommendationFeedback = feedbackSummary;
    context.interests = uniqueStrings([
      ...(companion?.interests ?? []),
      ...(companion?.hobbies ?? []),
      ...(companion?.preferred_activities ?? []),
      ...(social?.interest_tags ?? []),
      ...asStringArray(hobbiesConsent?.hobbies),
    ]);

    if (!profile) return context;

    context.name =
      profile.preferred_name?.trim() ||
      (profile.full_name ?? "").trim().split(/\s+/)[0] ||
      "";
    context.city = profile.city?.trim() || "";
    context.region = profile.region?.trim() || "";
    context.countryCode = profile.country_code?.trim() || "ES";
    context.address = profile.address_line_1?.trim() || "";
    context.knownAllergies = profile.known_allergies ?? [];
    context.grammaticalGender = inferProfileGender(consent, context.name);
    context.weather = await getWeatherContext(context);
    return context;
  } catch (err) {
    console.warn("[concierge/profile-context] Falling back to empty context", err);
    return emptyProfileContext();
  }
}

function buildChatSystemPrompt(context: UserProfileContext, locale: string): string {
  const language = LOCALE_TO_LANGUAGE[locale] ?? "English";
  const nameClause = context.name ? `The user's name is ${context.name}.` : "";
  const cityClause = context.city ? `They live in or near ${context.city}.` : "";

  return `You are VYVA Concierge, a warm, practical, and friendly personal lifestyle assistant for older adults. You help with everyday tasks: booking rides, scheduling appointments, finding local deals and events, researching topics, and giving practical advice.

${nameClause} ${cityClause}

Guidelines:
- Respond conversationally and warmly. Use the user's name occasionally.
- ${genderInstruction(context.grammaticalGender)}
- Keep responses concise and easy to read.
- Never use markdown headings, tables, code blocks, or raw checklist formatting.
- For mobile chat, use short natural paragraphs. If steps are needed, keep them as plain short sentences.
- For ride booking: suggest how to use a local taxi service or app, provide practical steps.
- For appointment scheduling: give a clear step-by-step guide.
- For deal finding: suggest where to look.
- Never invent specific shop names, brands, prices, opening times, routes, or events.
- Do not give generic seasonal ideas like "autumn offers" unless the user asked for that specifically.
- If live/local information is needed, ask for the exact category or permission to look it up instead of guessing.
- If the user starts from a recommendation card, behave like a guided mini-flow: explain what you can do, mention the most useful next detail, and ask one simple confirmation question.
- Do not expose internal words such as flow, needs, action_kind, payload, or search_terms.
- For research topics: give clear, plain-language explanations.
- IMPORTANT: If asked for medical diagnosis, treatment recommendations, or specific clinical advice, politely redirect to VYVA's Health section or their GP.
- Administrative or informational health topics are fine, such as scheduling a medical appointment.
- Always suggest a practical next step at the end.
- IMPORTANT: You MUST respond entirely in ${language}.`.trim();
}

function hasMobilityLimit(context: UserProfileContext): boolean {
  const text = [
    context.mobilityLevel,
    ...context.healthConditions,
    ...context.recentActivityTypes,
  ].join(" ");
  return /(limited|low|baja|reducida|mobility|walker|wheelchair|cane|fall|falls|arthritis|knee|hip|rodilla|cadera|artrosis|dolor)/i.test(text);
}

function textMatchesAny(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function contextText(context: UserProfileContext): string {
  return [
    ...context.interests,
    ...context.healthConditions,
    ...context.activeMedications,
    ...context.recentActivityTypes,
    ...context.recentConciergeUseCases,
    context.mobilityLevel,
    context.socialActivityLevel,
  ].join(" ");
}

const RECOMMENDATION_CANDIDATES: RecommendationCandidate[] = [
  {
    id: "accessible_local_culture",
    category: "event",
    emoji: "🎭",
    title: { en: "A calm local outing", es: "Una salida tranquila" },
    description: {
      en: "VYVA can check an accessible nearby museum, talk, or cultural visit.",
      es: "VYVA puede buscar un museo, charla o visita cultural accesible cerca.",
    },
    why: {
      en: "It keeps the day social and stimulating without needing a demanding plan.",
      es: "Mantiene el dia activo y agradable sin exigir demasiado esfuerzo.",
    },
    details: {
      en: "Choose somewhere close, seated, and easy to leave if tired. VYVA can check opening hours, access, and transport.",
      es: "Conviene elegir un sitio cercano, con asientos y facil de abandonar si hay cansancio. VYVA puede revisar horarios, acceso y transporte.",
    },
    steps: {
      en: ["Pick a nearby venue", "Check access and timing", "Arrange transport if needed"],
      es: ["Elegir un sitio cercano", "Revisar acceso y horarios", "Pedir transporte si hace falta"],
    },
    actionLabel: { en: "Plan it", es: "Planearlo" },
    actionPrompt: {
      en: "Help me plan a calm accessible local outing today.",
      es: "Ayudame a planear una salida tranquila y accesible cerca de mi.",
    },
    safetyNote: {
      en: "Prefer daytime options with seating and step-free access.",
      es: "Mejor de dia, con asientos y acceso sin escaleras.",
    },
    tags: ["culture", "museum", "events", "social", "local", "art", "music", "historia", "arte", "musica"],
    physicalDemand: "low",
    outdoorExposure: "some",
    requiresLocation: true,
    preferredWhen: (context) => context.socialActivityLevel !== "low" || context.interests.length > 0,
  },
  {
    id: "medication_admin_check",
    category: "tip",
    emoji: "💊",
    title: { en: "Medication admin check", es: "Revision de medicacion" },
    description: {
      en: "VYVA can help check whether anything needs ordering or organising.",
      es: "VYVA puede ayudarte a revisar si hay algo que pedir u organizar.",
    },
    why: {
      en: "It fits because there are active medication records.",
      es: "Encaja porque hay medicacion registrada.",
    },
    details: {
      en: "This is not medical advice. It is practical support: checking supplies, timings, or whether to call the pharmacy.",
      es: "No es consejo medico. Es ayuda practica: revisar existencias, horarios o si conviene llamar a la farmacia.",
    },
    steps: {
      en: ["Check what is running low", "Confirm pharmacy details", "Ask VYVA to call if needed"],
      es: ["Revisar que queda poco", "Confirmar farmacia", "Pedir a VYVA que llame si hace falta"],
    },
    actionLabel: { en: "Check meds", es: "Revisar" },
    actionPrompt: {
      en: "Help me check whether any medication needs ordering.",
      es: "Ayudame a revisar si hay medicacion que pedir.",
    },
    safetyNote: {
      en: "For clinical questions, speak with the GP or pharmacist.",
      es: "Para dudas clinicas, consulta con el medico o farmaceutico.",
    },
    tags: ["medication", "pharmacy", "medicine", "prescription", "medicacion", "farmacia"],
    physicalDemand: "none",
    outdoorExposure: "none",
    requiresMedicationContext: true,
  },
  {
    id: "trusted_provider_followup",
    category: "tip",
    emoji: "☎️",
    title: { en: "Follow up a routine task", es: "Retomar una gestion" },
    description: {
      en: "VYVA can help repeat or follow up a task you often need.",
      es: "VYVA puede repetir o seguir una gestion que sueles necesitar.",
    },
    why: {
      en: "It is based on recent concierge activity.",
      es: "Se basa en actividad reciente de Concierge.",
    },
    details: {
      en: "If you often book rides, appointments, or pharmacy calls, VYVA can prepare the next one for confirmation.",
      es: "Si sueles pedir taxis, citas o llamadas a farmacia, VYVA puede preparar la siguiente para confirmarla.",
    },
    steps: {
      en: ["Review the recent task", "Confirm the details", "Let VYVA prepare it"],
      es: ["Revisar la gestion reciente", "Confirmar detalles", "Dejar que VYVA la prepare"],
    },
    actionLabel: { en: "Prepare it", es: "Preparar" },
    actionPrompt: {
      en: "Help me prepare a repeat concierge task based on what I usually do.",
      es: "Ayudame a preparar una gestion habitual de Concierge.",
    },
    safetyNote: { en: "", es: "" },
    tags: ["book_ride", "book_appointment", "order_medicine", "routine", "taxi", "appointment"],
    physicalDemand: "none",
    outdoorExposure: "none",
    preferredWhen: (context) => context.recentConciergeUseCases.length > 0,
  },
  {
    id: "local_savings_check",
    category: "deal",
    emoji: "🛒",
    title: { en: "Compare one useful errand", es: "Comparar un recado util" },
    description: {
      en: "VYVA can help compare one practical nearby errand before you go.",
      es: "VYVA puede ayudarte a comparar un recado cercano antes de salir.",
    },
    why: {
      en: "It only helps when it is tied to a real errand you actually need.",
      es: "Solo ayuda si se conecta con un recado real que necesitas.",
    },
    details: {
      en: "Pick one category, such as pharmacy, groceries, transport, or a local activity. VYVA should not invent shops or offers; it should check only what is practical.",
      es: "Elige una categoria, como farmacia, compra, transporte o actividad local. VYVA no debe inventar tiendas ni ofertas; solo debe revisar lo practico.",
    },
    steps: {
      en: ["Choose the errand", "Compare nearby options", "Keep the practical one"],
      es: ["Elegir el recado", "Comparar opciones cercanas", "Quedarse con lo practico"],
    },
    actionLabel: { en: "Compare", es: "Comparar" },
    actionPrompt: {
      en: "Help me compare one practical local errand.",
      es: "Ayudame a comparar un recado practico cerca de mi.",
    },
    safetyNote: { en: "", es: "" },
    tags: ["deal", "discount", "shopping", "pharmacy", "supermarket", "ahorro", "oferta", "farmacia"],
    physicalDemand: "low",
    outdoorExposure: "some",
    requiresLocation: true,
  },
  {
    id: "interest_based_local_plan",
    category: "event",
    emoji: "🎟️",
    title: { en: "A real plan from your interests", es: "Un plan real segun tus gustos" },
    description: {
      en: "VYVA can turn one saved interest into a nearby place or event to check.",
      es: "VYVA puede convertir un gusto guardado en un sitio o evento cercano para revisar.",
    },
    why: {
      en: "It starts from the user's interests, but must become a real option with practical details.",
      es: "Parte de tus gustos, pero debe terminar en una opcion real con datos utiles.",
    },
    details: {
      en: "The plan should include where it is, how to get there, likely cost, timings, accessibility, and whether VYVA should call or book.",
      es: "El plan debe incluir donde es, como llegar, coste aproximado, horarios, accesibilidad y si VYVA debe llamar o reservar.",
    },
    steps: {
      en: ["Pick the interest", "Find a nearby real option", "Check timing, cost, and access"],
      es: ["Elegir el gusto", "Encontrar una opcion cercana", "Revisar horario, coste y acceso"],
    },
    actionLabel: { en: "Build plan", es: "Crear plan" },
    actionPrompt: {
      en: "Build a practical local plan based on one of my saved interests.",
      es: "Crea un plan local practico basado en uno de mis gustos guardados.",
    },
    safetyNote: {
      en: "Avoid generic home activities. Use a real place, route, time, or booking next step.",
      es: "Evita actividades genericas en casa. Usa un sitio, ruta, horario o siguiente paso real.",
    },
    tags: ["museum", "music", "reading", "culture", "class", "club", "event", "arte", "musica", "lectura", "cultura"],
    physicalDemand: "low",
    outdoorExposure: "some",
    requiresLocation: true,
    requiresInterests: true,
  },
  {
    id: "health_admin_next_step",
    category: "tip",
    emoji: "🩺",
    title: { en: "Health admin next step", es: "Siguiente paso de salud" },
    description: {
      en: "VYVA can help organise a practical health task, like booking or preparing questions.",
      es: "VYVA puede organizar una gestion de salud, como pedir cita o preparar preguntas.",
    },
    why: {
      en: "It fits because health context is saved, but avoids clinical advice.",
      es: "Encaja porque hay contexto de salud guardado, sin dar consejo clinico.",
    },
    details: {
      en: "VYVA can help prepare a GP appointment, collect questions, or organise transport. It will not diagnose or recommend treatment.",
      es: "VYVA puede preparar una cita medica, reunir preguntas u organizar transporte. No diagnostica ni recomienda tratamientos.",
    },
    steps: {
      en: ["Choose the admin task", "Prepare key details", "Confirm before VYVA acts"],
      es: ["Elegir la gestion", "Preparar detalles clave", "Confirmar antes de actuar"],
    },
    actionLabel: { en: "Prepare", es: "Preparar" },
    actionPrompt: {
      en: "Help me prepare a practical health admin task.",
      es: "Ayudame a preparar una gestion practica de salud.",
    },
    safetyNote: {
      en: "For symptoms or treatment, contact your GP or emergency services if urgent.",
      es: "Para sintomas o tratamiento, consulta al medico o emergencias si es urgente.",
    },
    tags: ["health", "appointment", "doctor", "gp", "medico", "cita", "salud"],
    physicalDemand: "none",
    outdoorExposure: "none",
    requiresHealthContext: true,
  },
  {
    id: "appointment_transport_prep",
    category: "tip",
    emoji: "🚕",
    title: { en: "Prepare appointment transport", es: "Preparar transporte para cita" },
    description: {
      en: "VYVA can check whether an upcoming appointment needs a taxi or timing plan.",
      es: "VYVA puede revisar si una cita proxima necesita taxi o plan de horarios.",
    },
    why: {
      en: "It uses upcoming reminders and recent concierge patterns to remove last-minute stress.",
      es: "Usa recordatorios proximos y patrones recientes para evitar prisas de ultimo momento.",
    },
    details: {
      en: "VYVA can check the appointment time, travel buffer, mobility needs, and whether a trusted taxi provider is saved.",
      es: "VYVA puede revisar la hora de la cita, margen de viaje, movilidad y si hay un taxi de confianza guardado.",
    },
    steps: {
      en: ["Review the appointment", "Estimate travel time", "Prepare taxi confirmation"],
      es: ["Revisar la cita", "Calcular margen de viaje", "Preparar confirmacion del taxi"],
    },
    actionLabel: { en: "Prepare ride", es: "Preparar taxi" },
    actionPrompt: {
      en: "Help me prepare transport for my next appointment.",
      es: "Ayudame a preparar transporte para mi proxima cita.",
    },
    safetyNote: {
      en: "Leave extra time if mobility, weather, or parking could slow the journey.",
      es: "Deja margen extra si la movilidad, el clima o el aparcamiento pueden retrasar el trayecto.",
    },
    tags: ["appointment", "taxi", "transport", "doctor", "cita", "transporte", "medico"],
    physicalDemand: "none",
    outdoorExposure: "some",
    requiresLocation: true,
    preferredWhen: (context) =>
      context.upcomingReminders.length > 0 ||
      context.recentConciergeUseCases.includes("book_appointment") ||
      context.pendingConciergeUseCases.includes("book_appointment"),
  },
  {
    id: "weather_comfort_plan",
    category: "activity",
    emoji: "🏠",
    title: { en: "A weather-smart plan", es: "Un plan segun el tiempo" },
    description: {
      en: "VYVA can shape a comfortable plan around today's weather and your energy.",
      es: "VYVA puede adaptar un plan comodo al tiempo de hoy y a tu energia.",
    },
    why: {
      en: "It avoids pushing the wrong kind of activity when the weather or mobility context suggests caution.",
      es: "Evita proponer el plan equivocado cuando el tiempo o la movilidad piden prudencia.",
    },
    details: {
      en: "If outdoors is not ideal, VYVA can find a specific indoor place, nearby errand, or transport-friendly option.",
      es: "Si salir no conviene, VYVA puede encontrar un sitio interior concreto, un recado cercano o una opcion facil con transporte.",
    },
    steps: {
      en: ["Check today's weather", "Find a specific nearby option", "Review route, hours, and access"],
      es: ["Mirar el tiempo", "Encontrar una opcion cercana", "Revisar ruta, horario y acceso"],
    },
    actionLabel: { en: "Make a plan", es: "Crear plan" },
    actionPrompt: {
      en: "Suggest a comfortable plan for today based on the weather and my profile.",
      es: "Sugiere un plan comodo para hoy segun el tiempo y mi perfil.",
    },
    safetyNote: {
      en: "Avoid heat, rain, stairs, or long standing if they make the day harder.",
      es: "Evita calor, lluvia, escaleras o estar mucho tiempo de pie si complica el dia.",
    },
    tags: ["weather", "home", "comfort", "mobility", "tiempo", "casa", "comodidad"],
    physicalDemand: "none",
    outdoorExposure: "none",
    preferredWhen: (context) => Boolean(context.weather) || hasMobilityLimit(context),
  },
  {
    id: "family_check_in",
    category: "activity",
    emoji: "📞",
    title: { en: "A gentle check-in", es: "Un contacto tranquilo" },
    description: {
      en: "VYVA can help plan a short call or message with someone important.",
      es: "VYVA puede preparar una llamada o mensaje corto con alguien importante.",
    },
    why: {
      en: "It is low effort, social, and easy to do from home.",
      es: "Es social, sencillo y se puede hacer desde casa.",
    },
    details: {
      en: "This can be as simple as a two-minute call, a voice note, or asking VYVA to draft a warm message.",
      es: "Puede ser una llamada de dos minutos, una nota de voz o pedir a VYVA un mensaje carinoso.",
    },
    steps: {
      en: ["Pick one person", "Choose call or message", "Keep it short and warm"],
      es: ["Elegir una persona", "Llamada o mensaje", "Hacerlo corto y cercano"],
    },
    actionLabel: { en: "Draft message", es: "Preparar mensaje" },
    actionPrompt: {
      en: "Help me prepare a short warm message or call idea.",
      es: "Ayudame a preparar un mensaje breve o una llamada sencilla.",
    },
    safetyNote: { en: "", es: "" },
    tags: ["family", "social", "call", "message", "familia", "llamada", "mensaje"],
    physicalDemand: "none",
    outdoorExposure: "none",
    preferredWhen: (context) => context.socialActivityLevel === "low" || context.interests.length > 0,
  },
  {
    id: "scam_guard_check",
    category: "tip",
    emoji: "🛡️",
    title: { en: "Check a suspicious message", es: "Revisar un mensaje raro" },
    description: {
      en: "VYVA can help review a letter, SMS, or email before you respond.",
      es: "VYVA puede revisar una carta, SMS o email antes de responder.",
    },
    why: {
      en: "It is a safe, practical task that can prevent stress or mistakes.",
      es: "Es una ayuda practica y segura para evitar sustos o errores.",
    },
    details: {
      en: "Read or paste the message. VYVA will look for pressure, strange links, payment requests, or personal data requests.",
      es: "Lee o pega el mensaje. VYVA buscara prisas, enlaces raros, pagos o peticiones de datos.",
    },
    steps: {
      en: ["Show the message", "Check for red flags", "Decide what not to do"],
      es: ["Mostrar el mensaje", "Buscar senales de alerta", "Decidir que no hacer"],
    },
    actionLabel: { en: "Check it", es: "Revisar" },
    actionPrompt: {
      en: "Help me check whether a message or letter is suspicious.",
      es: "Ayudame a revisar si un mensaje o carta es sospechoso.",
    },
    safetyNote: {
      en: "Never share banking details or passwords while checking.",
      es: "No compartas datos bancarios ni contrasenas al revisarlo.",
    },
    tags: ["scam", "safety", "paperwork", "sms", "email", "estafa", "seguridad"],
    physicalDemand: "none",
    outdoorExposure: "none",
  },
];

function scoreCandidate(
  candidate: RecommendationCandidate,
  context: UserProfileContext,
  options: { refresh?: boolean } = {},
): RankedRecommendationCandidate | null {
  if (candidate.id === "local_savings_check") return null;
  if (hasMobilityLimit(context) && candidate.physicalDemand === "moderate") return null;
  if (candidate.requiresLocation && !context.city && !context.region) return null;
  if (candidate.requiresMedicationContext && context.activeMedications.length === 0) return null;
  if (candidate.requiresHealthContext && context.healthConditions.length === 0) return null;
  if (candidate.requiresInterests && context.interests.length === 0) return null;
  if (candidate.preferredWhen && !candidate.preferredWhen(context)) return null;

  const allContext = contextText(context);
  const reasons: string[] = [];
  let score = 40;

  if (candidate.requiresLocation && (context.city || context.region)) {
    score += 15;
    reasons.push("location_match");
  }
  if (candidate.requiresMedicationContext && context.activeMedications.length > 0) {
    score += 25;
    reasons.push("medication_context");
  }
  if (candidate.requiresHealthContext && context.healthConditions.length > 0) {
    score += 20;
    reasons.push("health_context");
  }
  if (candidate.requiresInterests && context.interests.length > 0) {
    score += 18;
    reasons.push("interest_context");
  }
  if (textMatchesAny(allContext, candidate.tags)) {
    score += 18;
    reasons.push("profile_tags");
  }
  if (candidate.id === "trusted_provider_followup" && context.recentConciergeUseCases.length > 0) {
    score += 20;
    reasons.push("recent_pattern");
  }
  if (candidate.id === "appointment_transport_prep" && context.upcomingReminders.length > 0) {
    score += 24;
    reasons.push("upcoming_reminder");
  }
  if (candidate.id === "appointment_transport_prep" && context.pendingConciergeUseCases.length > 0) {
    score += 12;
    reasons.push("pending_action");
  }
  if (candidate.id === "family_check_in" && context.socialActivityLevel === "low") {
    score += 14;
    reasons.push("social_nudge");
  }
  if (hasMobilityLimit(context) && candidate.physicalDemand === "none") {
    score += 10;
    reasons.push("mobility_safe");
  }
  if (candidate.id === "interest_based_local_plan" && context.interests.length > 0 && (context.city || context.region)) {
    score += 16;
    reasons.push("real_world_plan");
  }
  if (context.recommendationFeedback.likedIds.includes(candidate.id)) {
    score += 18;
    reasons.push("previously_liked");
  }
  if (context.recommendationFeedback.completedIds.includes(candidate.id)) {
    score += 10;
    reasons.push("previously_completed");
  }
  if (context.recommendationFeedback.openedIds.includes(candidate.id)) {
    score += 6;
    reasons.push("previously_opened");
  }
  if (context.recommendationFeedback.shownIds.includes(candidate.id)) {
    score -= options.refresh ? 45 : 12;
    reasons.push("recently_shown");
  }
  if (context.recommendationFeedback.dismissedIds.includes(candidate.id)) {
    score -= 30;
    reasons.push("previously_dismissed");
  }
  if (context.weather?.outdoorSuitability === "poor") {
    if (candidate.outdoorExposure === "none") {
      score += 14;
      reasons.push("weather_safe");
    }
    if (candidate.outdoorExposure === "some" || candidate.outdoorExposure === "mostly") {
      score -= 14;
      reasons.push("weather_caution");
    }
  }
  if (context.weather?.outdoorSuitability === "caution" && candidate.outdoorExposure === "none") {
    score += 6;
    reasons.push("weather_comfort");
  }
  if (score < 20) return null;

  return { candidate, score, reasons };
}

function rankRecommendationCandidates(
  context: UserProfileContext,
  options: { refresh?: boolean } = {},
): RankedRecommendationCandidate[] {
  const ranked = RECOMMENDATION_CANDIDATES
    .map((candidate) => scoreCandidate(candidate, context, options))
    .filter((item): item is RankedRecommendationCandidate => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (ranked.length >= 4 || !options.refresh) return ranked;

  const existingIds = new Set(ranked.map((item) => item.candidate.id));
  const filler = RECOMMENDATION_CANDIDATES
    .filter((candidate) => !existingIds.has(candidate.id))
    .map((candidate): RankedRecommendationCandidate => ({
      candidate,
      score: 25,
      reasons: ["variety_fallback"],
    }))
    .slice(0, 4 - ranked.length);

  return [...ranked, ...filler];
}

function effortFor(candidate: RecommendationCandidate): RecommendationCard["effort"] {
  if (candidate.physicalDemand === "none") return "none";
  if (candidate.physicalDemand === "low") return "low";
  return "medium";
}

function actionKindFor(candidate: RecommendationCandidate): RecommendationCard["action_kind"] {
  if (candidate.id.includes("provider") || candidate.id.includes("transport")) return "call";
  if (candidate.id.includes("admin") || candidate.id.includes("medication") || candidate.id.includes("scam")) return "check";
  if (candidate.id.includes("outing") || candidate.id.includes("weather")) return "plan";
  if (candidate.id.includes("savings")) return "booking";
  return "chat";
}

function bestTimeFor(ranked: RankedRecommendationCandidate, context: UserProfileContext, locale: string): string {
  const es = locale === "es";
  const preferred = context.preferredTimes[0];
  if (preferred) return es ? `Mejor: ${preferred}` : `Best: ${preferred}`;
  if (ranked.reasons.includes("upcoming_reminder")) {
    return es ? "Antes de la cita" : "Before the appointment";
  }
  if (ranked.candidate.outdoorExposure === "some" || ranked.candidate.outdoorExposure === "mostly") {
    return es ? "Mejor de dia" : "Best in daylight";
  }
  if (ranked.candidate.id === "medication_admin_check") return es ? "Hoy, cuando estes tranquilo" : "Today, when calm";
  return es ? "Cuando te venga bien" : "Whenever suits you";
}

function freshnessFor(ranked: RankedRecommendationCandidate, context: UserProfileContext, locale: string): string {
  const es = locale === "es";
  if (ranked.reasons.includes("weather_safe") || ranked.reasons.includes("weather_comfort")) {
    return context.weather
      ? es
        ? `Actualizado con el tiempo de ${context.weather.city}`
        : `Updated with ${context.weather.city} weather`
      : es
        ? "Actualizado segun el tiempo"
        : "Weather-aware today";
  }
  if (ranked.reasons.includes("recently_shown")) {
    return es ? "Repetido porque encaja bien" : "Repeated because it fits";
  }
  if (ranked.reasons.includes("variety_fallback")) {
    return es ? "Idea nueva para variar" : "Fresh idea for variety";
  }
  return es ? "Elegido para hoy" : "Picked for today";
}

function signalLabelsFor(ranked: RankedRecommendationCandidate, context: UserProfileContext, locale: string): string[] {
  const es = locale === "es";
  const labels: Record<string, string> = {
    location_match: es ? "cerca de tu zona" : "near your area",
    medication_context: es ? "medicacion guardada" : "saved medication",
    health_context: es ? "contexto de salud" : "health context",
    interest_context: es ? "tus intereses" : "your interests",
    profile_tags: es ? "tu perfil" : "your profile",
    recent_pattern: es ? "patrones recientes" : "recent patterns",
    upcoming_reminder: es ? "recordatorio proximo" : "upcoming reminder",
    pending_action: es ? "accion pendiente" : "pending action",
    mobility_safe: es ? "bajo esfuerzo" : "low effort",
    low_social_pressure: es ? "sin presion social" : "low social pressure",
    social_nudge: es ? "contacto social" : "social connection",
    real_world_plan: es ? "plan ejecutable" : "executable plan",
    weather_safe: es ? "tiempo poco favorable" : "weather-safe",
    weather_comfort: es ? "comodidad segun clima" : "weather comfort",
    previously_liked: es ? "te intereso antes" : "liked before",
    previously_completed: es ? "te funciono antes" : "worked before",
    previously_opened: es ? "lo abriste antes" : "opened before",
    variety_fallback: es ? "variedad" : "variety",
  };

  const signals = ranked.reasons.map((reason) => labels[reason]).filter(Boolean);
  if (context.city && ranked.candidate.requiresLocation) {
    signals.unshift(es ? context.city : context.city);
  }
  if (context.activeMedications.length && ranked.candidate.requiresMedicationContext) {
    signals.unshift(context.activeMedications[0]);
  }
  if (context.interests.length && ranked.candidate.requiresInterests) {
    signals.unshift(context.interests[0]);
  }
  return uniqueStrings(signals).slice(0, 4);
}

function locationHintFor(ranked: RankedRecommendationCandidate, context: UserProfileContext, locale: string): string {
  if (!context.city && !context.region) return "";
  const es = locale === "es";
  const place = [context.city, context.region].filter(Boolean).join(", ");
  if (!ranked.candidate.requiresLocation && ranked.candidate.outdoorExposure === "none") {
    return es ? `Pensado para hacerlo desde casa o cerca de ${place}.` : `Designed for home or near ${place}.`;
  }
  return es ? `Pensado para ${place}.` : `Designed around ${place}.`;
}

function actionPayloadFor(
  ranked: RankedRecommendationCandidate,
  context: UserProfileContext,
  locale: string,
): NonNullable<RecommendationCard["action_payload"]> {
  const candidate = ranked.candidate;
  const signals = signalLabelsFor(ranked, context, locale);
  const location = [context.city, context.region, context.countryCode].filter(Boolean).join(", ");
  const defaults: Record<string, { flow: string; needs: string[]; search_terms?: string[] }> = {
    accessible_local_culture: {
      flow: "local_accessible_outing",
      needs: ["nearby_options", "opening_hours", "ticket_price", "accessibility", "transport_options", "booking_or_call_next_step"],
      search_terms: ["accessible museum", "cultural centre", "senior friendly activity", context.city].filter(Boolean),
    },
    local_savings_check: {
      flow: "local_savings_research",
      needs: ["nearby_shops", "current_offers", "distance", "validity", "practicality_for_user"],
      search_terms: ["senior discounts", "pharmacy offers", "supermarket offers", context.city].filter(Boolean),
    },
    medication_admin_check: {
      flow: "medication_admin",
      needs: ["active_medications", "supply_check", "pharmacy_details", "refill_or_delivery_next_step"],
      search_terms: ["pharmacy", context.city].filter(Boolean),
    },
    trusted_provider_followup: {
      flow: "repeat_concierge_task",
      needs: ["recent_task", "saved_provider", "missing_details", "confirmation_summary"],
    },
    interest_based_local_plan: {
      flow: "interest_based_local_plan",
      needs: ["nearby_place_or_event", "opening_hours", "price_or_entry_cost", "route_or_transport", "accessibility", "booking_or_call_next_step"],
      search_terms: [context.interests[0], "accessible activity", "event", context.city].filter(Boolean),
    },
    health_admin_next_step: {
      flow: "health_admin_planning",
      needs: ["non_clinical_goal", "questions_to_prepare", "provider_or_gp_details", "appointment_or_transport_next_step"],
    },
    appointment_transport_prep: {
      flow: "appointment_transport_prep",
      needs: ["upcoming_appointment", "pickup_location", "destination", "travel_buffer", "taxi_provider", "confirmation_summary"],
      search_terms: ["taxi", context.city].filter(Boolean),
    },
    weather_comfort_plan: {
      flow: "weather_comfort_plan",
      needs: ["weather", "mobility_fit", "specific_place_or_errand", "opening_hours_if_relevant", "route_or_transport", "accessibility"],
      search_terms: ["accessible indoor activity", "community centre", context.city].filter(Boolean),
    },
    family_check_in: {
      flow: "social_check_in",
      needs: ["recipient_choice", "message_draft", "call_or_message_option", "warm_closing"],
    },
    scam_guard_check: {
      flow: "scam_or_paperwork_review",
      needs: ["content_to_review", "red_flags", "safe_next_steps", "what_not_to_do"],
    },
  };

  const base = candidate.actionPayload ?? defaults[candidate.id] ?? {
    flow: actionKindFor(candidate) ?? "chat",
    needs: ["context", "practical_steps", "safe_next_step"],
  };

  return {
    flow: base.flow,
    needs: base.needs,
    search_terms: base.search_terms,
    title: candidate.title[locale === "es" ? "es" : "en"],
    category: candidate.category,
    personal_signals: signals,
    location_hint: location ? locationHintFor(ranked, context, locale) : "",
    safety_note: candidate.safetyNote[locale === "es" ? "es" : "en"],
  };
}

function candidateToCard(
  ranked: RankedRecommendationCandidate,
  locale: string,
  context: UserProfileContext,
): RecommendationCard {
  const lang: "en" | "es" = locale === "es" ? "es" : "en";
  const candidate = ranked.candidate;
  return {
    id: candidate.id,
    title: candidate.title[lang],
    description: candidate.description[lang],
    category: candidate.category,
    emoji: candidate.emoji,
    why: candidate.why[lang],
    details: candidate.details[lang],
    steps: candidate.steps[lang],
    action_label: candidate.actionLabel[lang],
    action_prompt: candidate.actionPrompt[lang],
    safety_note: candidate.safetyNote[lang],
    best_time: bestTimeFor(ranked, context, locale),
    effort: effortFor(candidate),
    freshness: freshnessFor(ranked, context, locale),
    personal_signals: signalLabelsFor(ranked, context, locale),
    action_kind: actionKindFor(candidate),
    action_payload: actionPayloadFor(ranked, context, locale),
    location_hint: locationHintFor(ranked, context, locale),
    score: ranked.score,
    reason_codes: ranked.reasons,
  };
}

function isLocalRecommendationCard(card: RecommendationCard): boolean {
  return [
    "local_accessible_outing",
    "interest_based_local_plan",
    "weather_comfort_plan",
  ].includes(card.action_payload?.flow ?? "");
}

function placeRatingText(place: RecommendationResolvedPlace, locale: string): string {
  if (!place.rating) return "";
  const es = locale === "es";
  return es
    ? `${place.rating}/5${place.reviewCount ? ` (${place.reviewCount} resenas)` : ""}`
    : `${place.rating}/5${place.reviewCount ? ` (${place.reviewCount} reviews)` : ""}`;
}

function firstOpeningLine(place: RecommendationResolvedPlace, locale: string): string {
  const es = locale === "es";
  const firstLine = place.openingHours?.[0];
  if (firstLine) return es ? `Horario publicado: ${firstLine}.` : `Published hours: ${firstLine}.`;
  return es ? "Horario no publicado; conviene confirmarlo antes de salir." : "Hours are not published; confirm before going.";
}

async function enrichLocalCardWithResolvedPlace(
  card: RecommendationCard,
  context: UserProfileContext,
  locale: string,
): Promise<RecommendationCard> {
  if (!isLocalRecommendationCard(card)) return card;

  const es = locale === "es";
  const place =
    await findLocalEventForCard(card, context).catch(() => null) ??
    await searchActionPlace(card, context, locale).catch(() => null);
  if (!place?.name) {
    return {
      ...card,
      freshness: es ? "Pendiente de verificar cerca de ti" : "Needs a nearby live check",
      details: es
        ? "No he podido verificar un lugar cercano en vivo ahora mismo. Actualiza la tarjeta o pide a VYVA que busque otra opcion concreta."
        : "I could not verify a nearby place live right now. Refresh the card or ask VYVA to find another concrete option.",
      steps: es
        ? ["Actualizar recomendaciones", "Buscar una opcion cercana", "Confirmar horario antes de salir"]
        : ["Refresh recommendations", "Find a nearby option", "Confirm hours before leaving"],
      action_payload: {
        ...card.action_payload,
        location_hint: card.location_hint,
      },
    };
  }

  const rating = placeRatingText(place, locale);
  const area = [context.city, context.region].filter(Boolean).join(", ");
  const price = place.priceInfo
    ? es ? `Precio publicado: ${place.priceInfo}. Confirmar antes de ir.` : `Published price: ${place.priceInfo}. Confirm before going.`
    : priceLevelLabel(place.priceLevel, locale);
  const opening = firstOpeningLine(place, locale);
  const titlePrefix = card.category === "event" || card.category === "activity" ? "" : card.title;
  const nextSteps = es
    ? ["Revisar horario de hoy", "Abrir mapa o pedir taxi", "Confirmar precio si hace falta"]
    : ["Check today's hours", "Open the map or ask for a taxi", "Confirm price if needed"];

  return {
    ...card,
    title: titlePrefix ? `${titlePrefix}: ${place.name}` : place.name,
    description: es
      ? `${place.dateText ? `${place.dateText}. ` : ""}${place.address ?? area}${rating ? `. Valoracion ${rating}` : ""}.`
      : `${place.address ?? area}${rating ? `. Rated ${rating}` : ""}.`,
    why: es
      ? `${place.sourceName ? `Encontrado en ${place.sourceName}. ` : ""}Encaja con tu perfil y esta cerca de ${area || "tu zona"}.`
      : `${place.sourceName ? `Found via ${place.sourceName}. ` : ""}It fits your profile and is near ${area || "your area"}.`,
    details: [opening, price, place.matchReason ? `${place.matchReason}.` : "", place.phone ? (es ? `Telefono: ${place.phone}.` : `Phone: ${place.phone}.`) : ""]
      .filter(Boolean)
      .join(" "),
    steps: nextSteps,
    action_label: es ? "Ver guia" : "View guide",
    freshness: es ? "Lugar cercano verificado" : "Nearby place found",
    personal_signals: uniqueStrings([
      ...(card.personal_signals ?? []),
      area ? (es ? `cerca de ${area}` : `near ${area}`) : "",
      es ? "datos de mapa" : "map data",
    ]).slice(0, 4),
    action_payload: {
      ...card.action_payload,
      resolved_place: place,
      location_hint: place.address ?? card.location_hint,
    },
    location_hint: place.address ?? card.location_hint,
  };
}

async function cardsFromRankedCandidates(
  ranked: RankedRecommendationCandidate[],
  locale: string,
  context: UserProfileContext,
): Promise<RecommendationCard[]> {
  const cards = ranked.map((item) => candidateToCard(item, locale, context)).slice(0, 4);
  if (!cards.length) return FALLBACK_RECOMMENDATIONS;
  return Promise.all(cards.map((card) => enrichLocalCardWithResolvedPlace(card, context, locale)));
}

function buildRecommendationsPrompt(
  context: UserProfileContext,
  dayOfWeek: string,
  locale: string,
  rankedCandidates: RankedRecommendationCandidate[],
  options: { refresh?: boolean } = {},
): string {
  const language = LOCALE_TO_LANGUAGE[locale] ?? "English";
  const location = [context.city, context.region, context.countryCode].filter(Boolean).join(", ");
  const candidateSummary = rankedCandidates.map((item) => ({
    id: item.candidate.id,
    score: item.score,
    reasons: item.reasons,
    category: item.candidate.category,
    baseline: candidateToCard(item, locale, context),
  }));
  const interestClause = context.interests.length
    ? `Interests and hobbies: ${context.interests.slice(0, 10).join(", ")}.`
    : "Interests and hobbies: unknown.";
  const mobilityClause = hasMobilityLimit(context)
    ? "Mobility: may be limited. Do NOT recommend walks, long standing, strenuous outings, stairs, or physically demanding activity. Prefer seated, accessible, short-distance, home-based, taxi-friendly, or low-effort ideas."
    : "Mobility: no explicit limitation known. Still keep movement suggestions gentle and optional.";

  return `You are VYVA's personal concierge for an older adult. Today is ${dayOfWeek}.

User context:
- Name: ${context.name || "unknown"}
- Location: ${location || "unknown"}
- Address area: ${context.address || "unknown"}
- ${interestClause}
- Health conditions: ${context.healthConditions.join(", ") || "unknown"}
- ${mobilityClause}
- Allergies: ${context.knownAllergies.join(", ") || "unknown"}
- Active medication records: ${context.activeMedications.join(", ") || "none known"}
- Recent activity patterns: ${context.recentActivityTypes.join(", ") || "none known"}
- Recent concierge patterns: ${context.recentConciergeUseCases.join(", ") || "none known"}
- Pending concierge actions: ${context.pendingConciergeUseCases.join(", ") || "none"}
- Upcoming reminders: ${context.upcomingReminders.map((r) => `${r.title || r.reminder_type || "reminder"} on ${r.reminder_date || "soon"}`).join("; ") || "none"}
- Social activity level: ${context.socialActivityLevel}
- Preferred times: ${context.preferredTimes.join(", ") || "unknown"}
- Weather today: ${context.weather ? `${context.weather.temperatureC}C, ${context.weather.condition}, outdoor suitability ${context.weather.outdoorSuitability}` : "unknown"}

VYVA has already scored and safety-filtered candidate opportunities. You MUST choose from these candidates only. You may improve wording, make the local framing warmer, and tailor the details, but do not invent unrelated card types:
${JSON.stringify(candidateSummary, null, 2)}

Generate exactly 4 useful, safe, personalised recommendation cards for today from the ranked candidates. They must be actionable, not generic. Prefer higher scores unless a lower-scored candidate gives better variety.
${options.refresh ? "This is an explicit refresh request. Prioritise variety and avoid repeating the same titles, angles, or first-card idea from earlier today." : ""}

Respond ONLY with a valid JSON array of exactly 4 objects. Each object must have:
- "id": the exact candidate id selected
- "title": a short catchy title, 4-7 words
- "description": one friendly sentence, max 22 words
- "category": one of "deal", "event", "tip", "activity"
- "emoji": one relevant emoji
- "why": one short sentence explaining why this fits the user
- "details": 2-3 sentences with practical guidance
- "steps": an array of exactly 3 short steps
- "action_label": a 2-4 word button label
- "action_prompt": a sentence the app can send to VYVA if the user wants help doing it
- "safety_note": one brief note if relevant, otherwise an empty string
- "best_time": a short timing cue
- "effort": one of "none", "low", "medium"
- "freshness": a short phrase explaining why it feels timely today
- "personal_signals": an array of 2-4 short labels showing what context this used
- "action_kind": one of "chat", "call", "booking", "check", "plan"
- "action_payload": keep the baseline object's structured action_payload unless you only add clearer wording inside it
- "location_hint": a short local or home-based hint

Rules:
- Choose only from the candidate list above.
- Keep the core intent of each selected candidate.
- Never recommend something that conflicts with mobility limitations or known health context.
- If weather suitability is poor, prefer indoor/home/admin ideas unless the candidate is explicitly safe and accessible.
- Do not diagnose, treat, or give clinical advice.
- If mentioning a local place or event, phrase it as something VYVA can check, not as guaranteed.
- Make the cards feel specific to ${location || "the user's area"}.
- IMPORTANT: Write every text value entirely in ${language}. Do not use English unless ${language} is English.`;
}

function fallbackChatResponse(name: string): string {
  const greeting = name ? `Hi ${name}!` : "Hi there!";
  return `${greeting} I'm here to help with everyday tasks: booking rides, finding deals, scheduling appointments, and more. What can I help you with today?`;
}

function priceLevelLabel(level: number | undefined, locale: string): string {
  const es = locale === "es";
  if (typeof level !== "number") return es ? "Precio no publicado. VYVA puede revisar la web o llamar para confirmarlo." : "Price not published. VYVA can check the website or call to confirm.";
  const symbols = "€".repeat(Math.min(Math.max(level, 1), 4));
  return es ? `Nivel de precio aproximado: ${symbols}. Confirmar antes de ir.` : `Approximate price level: ${symbols}. Confirm before going.`;
}

interface LocalEventItem {
  title: string;
  dateText: string;
  summary: string;
  location: string;
  sourceUrl: string;
  priceInfo?: string;
  timeInfo?: string;
}

interface LocalEventSource {
  id: string;
  name: string;
  countryCodes: string[];
  cityMatcher?: RegExp;
  regionMatcher?: RegExp;
  url: string;
  sourceType: "official_tourism" | "municipal_culture" | "regional_culture" | "curated_directory";
  parser: "tarifa_wordpress" | "json_ld" | "generic_cards";
  defaultLocation: string;
}

const LOCAL_EVENT_SOURCES: LocalEventSource[] = [
  {
    id: "tarifa-tourism-agenda",
    name: "Agenda de eventos - Turismo de Tarifa",
    countryCodes: ["ES"],
    cityMatcher: /tarifa/i,
    url: "https://turismodetarifa.com/agenda-eventos/",
    sourceType: "official_tourism",
    parser: "tarifa_wordpress",
    defaultLocation: "Tarifa, Cadiz",
  },
  {
    id: "andalucia-cadiz-cultural-agenda",
    name: "Agenda Cultural de Andalucia - Cadiz",
    countryCodes: ["ES"],
    regionMatcher: /(cadiz|cádiz|andalucia|andalucía)/i,
    url: "https://www.juntadeandalucia.es/cultura/agendaculturaldeandalucia/cadiz",
    sourceType: "regional_culture",
    parser: "generic_cards",
    defaultLocation: "Provincia de Cadiz",
  },
  {
    id: "agenda-cultural-cadiz-directory",
    name: "AgendaCultural.es - Cadiz",
    countryCodes: ["ES"],
    regionMatcher: /(cadiz|cádiz|andalucia|andalucía)/i,
    url: "https://agendacultural.es/lugar/andalucia/cadiz/",
    sourceType: "curated_directory",
    parser: "generic_cards",
    defaultLocation: "Provincia de Cadiz",
  },
];

const COUNTRY_SOURCE_GUIDANCE: Record<string, string[]> = {
  ES: [
    "official tourism agenda",
    "municipal culture agenda",
    "regional culture agenda",
    "curated cultural directory",
    "library and civic-centre programmes",
  ],
  GB: [
    "council events calendar",
    "NHS or Age UK local wellbeing activities",
    "library events",
    "community centre programmes",
    "curated ticketing/event directories",
  ],
  DE: [
    "Stadt/Kommune Veranstaltungskalender",
    "Volkshochschule courses",
    "library and museum calendars",
    "senior-friendly community programmes",
  ],
  FR: [
    "agenda municipal",
    "office de tourisme",
    "mediatheque and museum calendars",
    "local association programmes",
  ],
  PT: [
    "agenda municipal",
    "turismo local",
    "biblioteca and centro cultural calendars",
    "local association programmes",
  ],
};

function localEventSourcesFor(context: UserProfileContext): LocalEventSource[] {
  const countryCode = (context.countryCode || "").toUpperCase();
  const city = context.city || "";
  const region = context.region || "";
  return LOCAL_EVENT_SOURCES.filter((source) => {
    const countryMatches = source.countryCodes.length === 0 || source.countryCodes.includes(countryCode);
    const cityMatches = source.cityMatcher ? source.cityMatcher.test(city) : false;
    const regionMatches = source.regionMatcher ? source.regionMatcher.test(region) : false;
    return countryMatches && (cityMatches || regionMatches);
  });
}

const SPANISH_MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "-")
    .replace(/&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseSpanishDate(dateText: string): Date | null {
  const numeric = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    const year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
    if (day && month >= 0 && year) return new Date(year, month, day);
  }
  const iso = dateText.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const match = dateText.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = SPANISH_MONTHS[match[2]];
  const year = Number(match[3]);
  if (!day || month === undefined || !year) return null;
  return new Date(year, month, day);
}

function eventMapUrl(event: LocalEventItem, source: LocalEventSource): string {
  const query = encodeURIComponent(`${event.location || event.title} ${source.defaultLocation}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function absoluteUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function extractJsonLdEvents(html: string, source: LocalEventSource): LocalEventItem[] {
  const events: LocalEventItem[] = [];
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];

  function collect(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    const item = value as Record<string, any>;
    if (Array.isArray(item["@graph"])) item["@graph"].forEach(collect);
    const type = Array.isArray(item["@type"]) ? item["@type"].join(" ") : item["@type"];
    if (typeof type !== "string" || !/event/i.test(type)) return;
    const location = typeof item.location === "object"
      ? [item.location.name, item.location.address?.streetAddress, item.location.address?.addressLocality].filter(Boolean).join(", ")
      : typeof item.location === "string" ? item.location : source.defaultLocation;
    const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
    events.push({
      title: stripHtml(String(item.name ?? "")),
      dateText: stripHtml(String(item.startDate ?? "")),
      summary: stripHtml(String(item.description ?? "")),
      location: location || source.defaultLocation,
      sourceUrl: absoluteUrl(String(item.url ?? source.url), source.url),
      priceInfo: offer?.price ? `${offer.price}${offer.priceCurrency ? ` ${offer.priceCurrency}` : ""}` : undefined,
      timeInfo: typeof item.startDate === "string" ? item.startDate : undefined,
    });
  }

  for (const script of scripts) {
    const json = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      collect(JSON.parse(json));
    } catch {
      continue;
    }
  }

  return events.filter((event) => event.title && event.summary);
}

function extractGenericCardEvents(html: string, source: LocalEventSource): LocalEventItem[] {
  const events: LocalEventItem[] = [];
  const anchorRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]{12,220}?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) && events.length < 24) {
    const href = match[1];
    const title = stripHtml(match[2]);
    if (!title || title.length < 8 || /cookie|privacidad|contacto|leer mas|read more|inicio|agenda/i.test(title)) continue;
    const lower = title.toLowerCase();
    if (!/(teatro|cine|concierto|exposicion|exposición|festival|flamenco|visita|charla|taller|cultura|musica|música|club|lectura|presentacion|presentación)/i.test(lower)) continue;
    const surrounding = stripHtml(html.slice(Math.max(0, match.index - 500), Math.min(html.length, match.index + 900))).slice(0, 700);
    const dateMatch = surrounding.match(/(\d{1,2}\s+[a-zA-ZáéíóúÁÉÍÓÚñÑ]+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/);
    const priceMatch = surrounding.match(/(Gratuito|\d+\s*€|entrada libre|libre hasta completar aforo)/i);
    const timeMatch = surrounding.match(/(\d{1,2}:\d{2}\s*h|\d{1,2}h\d{0,2})/i);
    events.push({
      title,
      dateText: dateMatch?.[1] ?? "",
      summary: surrounding,
      location: source.defaultLocation,
      sourceUrl: absoluteUrl(href, source.url),
      priceInfo: priceMatch?.[1],
      timeInfo: timeMatch?.[1],
    });
  }

  return events;
}

function extractEventsFromSource(html: string, source: LocalEventSource): LocalEventItem[] {
  const jsonLdEvents = extractJsonLdEvents(html, source);
  if (jsonLdEvents.length) return jsonLdEvents;
  if (source.parser === "tarifa_wordpress") return extractTarifaEvents(html, source);
  return extractGenericCardEvents(html, source);
}

function extractTarifaEvents(html: string, source: LocalEventSource): LocalEventItem[] {
  const events: LocalEventItem[] = [];
  const eventRegex = /(\d{1,2}\s+[a-zA-ZáéíóúÁÉÍÓÚñÑ]+\s+\d{4})[\s\S]{0,1200}?<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>([\s\S]*?)(?=\d{1,2}\s+[a-zA-ZáéíóúÁÉÍÓÚñÑ]+\s+\d{4}|Copyright|Gestionar consentimiento)/gi;
  let match: RegExpExecArray | null;

  while ((match = eventRegex.exec(html)) && events.length < 30) {
    const dateText = stripHtml(match[1]);
    const sourceUrl = match[2];
    const title = stripHtml(match[3]);
    const body = stripHtml(match[4]).slice(0, 900);
    if (!title || !dateText || !body) continue;

    const priceMatch = body.match(/(Gratuito|\d+\s*€|entrada libre|libre hasta completar aforo)/i);
    const timeMatch = body.match(/(\d{1,2}:\d{2}\s*h|\d{1,2}\s*a\s*\d{1,2}\s*h|\d{1,2}h\d{0,2})/i);
    const locationMatch = body.match(/(Teatro Municipal Alameda[^.]*|Castillo de Guzm[aá]n[^.]*|C\/Batalla del Salado[^.]*|Oficina de Turismo[^.]*|Iglesia Santa Mar[ií]a[^.]*)/i);

    events.push({
      title,
      dateText,
      summary: body,
      location: locationMatch?.[1] ?? source.defaultLocation,
      sourceUrl: absoluteUrl(sourceUrl, source.url),
      priceInfo: priceMatch?.[1],
      timeInfo: timeMatch?.[1],
    });
  }

  return events;
}

function scoreLocalEvent(event: LocalEventItem, card: RecommendationCard, context: UserProfileContext): number {
  const text = [
    event.title,
    event.summary,
    event.location,
    card.title,
    card.description,
    ...(card.action_payload?.search_terms ?? []),
    ...context.interests,
  ].join(" ").toLowerCase();
  let score = 20;

  for (const term of ["teatro", "exposicion", "exhibition", "cine", "concierto", "guitarra", "cultura", "musica", "film", "visita cultural"]) {
    if (text.includes(term)) score += 12;
  }
  for (const interest of context.interests) {
    if (interest && text.includes(interest.toLowerCase())) score += 15;
  }
  if (hasMobilityLimit(context)) {
    for (const good of ["teatro", "exposicion", "cine", "concierto", "sala"]) {
      if (text.includes(good)) score += 10;
    }
    for (const bad of ["trail", "bici", "cicloturista", "ruta", "romeria", "yoga", "playa"]) {
      if (text.includes(bad)) score -= 25;
    }
  }
  if (/gratuito|entrada libre|libre hasta completar aforo/i.test(event.priceInfo ?? event.summary)) score += 8;
  return score;
}

async function findLocalEventForCard(
  card: RecommendationCard,
  context: UserProfileContext,
): Promise<RecommendationResolvedPlace | null> {
  if (!isLocalRecommendationCard(card)) return null;
  const sources = localEventSourcesFor(context);
  if (!sources.length) {
    const guidance = COUNTRY_SOURCE_GUIDANCE[(context.countryCode || "").toUpperCase()] ?? [
      "official city event calendar",
      "local tourism agenda",
      "library or community-centre programme",
      "curated event directory",
    ];
    console.warn(
      `[concierge/recs] no local event sources configured for ${context.city || "unknown city"}, ${context.region || "unknown region"}, ${context.countryCode || "unknown country"}. Suggested source classes: ${guidance.join("; ")}`,
    );
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sourceEvents: Array<{ event: LocalEventItem; score: number; source: LocalEventSource }> = [];

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(7000) });
      if (!response.ok) continue;
      const html = await response.text();
      sourceEvents.push(
        ...extractEventsFromSource(html, source)
          .filter((event) => {
            const date = parseSpanishDate(event.dateText);
            return !date || date >= today;
          })
          .map((event) => ({ event, score: scoreLocalEvent(event, card, context), source })),
      );
    } catch {
      continue;
    }
  }

  const selected = sourceEvents.sort((a, b) => b.score - a.score)[0];
  if (!selected) return null;
  const { event, source } = selected;

  return {
    name: event.title,
    address: event.location,
    website: event.sourceUrl,
    mapsUrl: eventMapUrl(event, source),
    openingHours: [event.timeInfo ? `${event.dateText}, ${event.timeInfo}` : event.dateText],
    priceInfo: event.priceInfo,
    sourceName: source.name,
    sourceUrl: event.sourceUrl,
    dateText: event.dateText,
    timeInfo: event.timeInfo,
    matchReason: event.summary.slice(0, 240),
  };
}

async function searchActionPlace(
  card: RecommendationCard,
  context: UserProfileContext,
  locale: string,
): Promise<RecommendationResolvedPlace | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const terms = card.action_payload?.search_terms?.filter(Boolean) ?? [];
  const place = [context.city, context.region, context.countryCode].filter(Boolean).join(", ");
  if (!key || !terms.length || !place) return null;

  const query = `${terms.filter((term) => term !== context.city).join(" ")} ${place}`.trim();
  const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("language", locale || "es");
  searchUrl.searchParams.set("key", key);

  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6500) });
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json() as {
    status?: string;
    results?: Array<{ place_id?: string; name?: string; formatted_address?: string; rating?: number; user_ratings_total?: number; price_level?: number }>;
  };
  const first = searchData.results?.[0];
  if (!first) return null;

  if (!first.place_id) {
    return {
      name: first.name,
      address: first.formatted_address,
      rating: first.rating,
      reviewCount: first.user_ratings_total,
      priceLevel: first.price_level,
    };
  }

  const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  detailsUrl.searchParams.set("place_id", first.place_id);
  detailsUrl.searchParams.set("language", locale || "es");
  detailsUrl.searchParams.set("fields", "name,formatted_address,formatted_phone_number,website,url,opening_hours,price_level,rating,user_ratings_total");
  detailsUrl.searchParams.set("key", key);

  const detailsRes = await fetch(detailsUrl, { signal: AbortSignal.timeout(6500) });
  if (!detailsRes.ok) return null;
  const detailsData = await detailsRes.json() as {
    result?: {
      name?: string;
      formatted_address?: string;
      formatted_phone_number?: string;
      website?: string;
      url?: string;
      opening_hours?: { weekday_text?: string[] };
      price_level?: number;
      rating?: number;
      user_ratings_total?: number;
    };
  };
  const result = detailsData.result;
  if (!result) return null;

  return {
    name: result.name ?? first.name,
    address: result.formatted_address ?? first.formatted_address,
    phone: result.formatted_phone_number,
    website: result.website,
    mapsUrl: result.url,
    openingHours: result.opening_hours?.weekday_text,
    priceLevel: result.price_level ?? first.price_level,
    rating: result.rating ?? first.rating,
    reviewCount: result.user_ratings_total ?? first.user_ratings_total,
  };
}

function buildShareText(plan: Omit<RecommendationActionPlan, "share_text">): string {
  return [
    plan.title,
    plan.summary,
    plan.place_name ? `Lugar: ${plan.place_name}` : "",
    plan.address ? `Direccion: ${plan.address}` : "",
    plan.phone ? `Telefono: ${plan.phone}` : "",
    plan.website ? `Web: ${plan.website}` : "",
    plan.maps_url ? `Mapa: ${plan.maps_url}` : "",
    `Precio: ${plan.price_info}`,
    `Como llegar: ${plan.travel_info}`,
    `Nota: ${plan.caveat}`,
  ].filter(Boolean).join("\n");
}

async function buildRecommendationActionPlan(
  card: RecommendationCard,
  context: UserProfileContext,
  locale: string,
): Promise<RecommendationActionPlan> {
  const es = locale === "es";
  const place = card.action_payload?.resolved_place ?? await searchActionPlace(card, context, locale).catch(() => null);
  const placeName = place?.name;
  const hasPlace = Boolean(placeName);
  const ratingText = place?.rating
    ? es
      ? ` Valoracion: ${place.rating}/5${place.reviewCount ? ` con ${place.reviewCount} resenas` : ""}.`
      : ` Rating: ${place.rating}/5${place.reviewCount ? ` from ${place.reviewCount} reviews` : ""}.`
    : "";
  const title = es ? `Plan para: ${card.title}` : `Plan for: ${card.title}`;
  const summary = hasPlace
    ? es
      ? `He encontrado una opcion concreta cerca de ti: ${placeName}.${place?.sourceName ? ` Fuente: ${place.sourceName}.` : ""}${ratingText}`
      : `I found a concrete nearby option: ${placeName}.${place?.sourceName ? ` Source: ${place.sourceName}.` : ""}${ratingText}`
    : es
      ? `No he podido verificar una opcion cercana en vivo para esta tarjeta. Actualiza recomendaciones o pide a VYVA que busque de nuevo.`
      : `I could not verify a nearby live option for this card. Refresh recommendations or ask VYVA to search again.`;
  const travelInfo = hasPlace
    ? es
      ? "Usa el mapa para ver ruta y tiempo real. Si hace falta, VYVA puede preparar un taxi antes de confirmar."
      : "Use the map for live route and travel time. If needed, VYVA can prepare a taxi before confirming."
    : es
      ? "Sin un lugar verificado no conviene planificar ruta. Actualiza la recomendacion para buscar una opcion cercana concreta."
      : "Without a verified place, it is not useful to plan a route. Refresh the recommendation to find a concrete nearby option.";
  const accessibilityNote = card.effort === "none" || card.effort === "low"
    ? es
      ? "Mantenerlo corto, con asiento disponible y evitando escaleras si es posible."
      : "Keep it short, with seating available and avoiding stairs where possible."
    : es
      ? "Confirmar accesibilidad, descansos y distancia antes de ir."
      : "Confirm accessibility, breaks, and distance before going.";
  const nextSteps = hasPlace
    ? es
      ? ["Revisar horario de hoy", "Confirmar precio o entrada", "Elegir transporte o pedir a VYVA que llame"]
      : ["Check today's hours", "Confirm price or entry", "Choose transport or ask VYVA to call"]
    : es
      ? ["Actualizar recomendaciones", "Buscar una opcion cercana verificada", "Confirmar horario, precio y acceso"]
      : ["Refresh recommendations", "Find a verified nearby option", "Confirm hours, price, and access"];
  const caveat = es
    ? "Los horarios, precios y disponibilidad pueden cambiar. Conviene confirmar antes de salir."
    : "Hours, prices, and availability can change. Confirm before leaving.";

  const planWithoutShare: Omit<RecommendationActionPlan, "share_text"> = {
    title,
    summary,
    place_name: place?.name,
    address: place?.address,
    phone: place?.phone,
    website: place?.website,
    maps_url: place?.mapsUrl,
    opening_hours: place?.openingHours?.slice(0, 7),
    price_info: place?.priceInfo
      ? es ? `Precio publicado: ${place.priceInfo}. Confirmar antes de ir.` : `Published price: ${place.priceInfo}. Confirm before going.`
      : priceLevelLabel(place?.priceLevel, locale),
    travel_info: travelInfo,
    accessibility_note: accessibilityNote,
    next_steps: nextSteps,
    caveat,
  };

  return {
    ...planWithoutShare,
    share_text: buildShareText(planWithoutShare),
  };
}

const FALLBACK_RECOMMENDATIONS: RecommendationCard[] = [
  {
    title: "Check a nearby visit",
    description: "VYVA can find one concrete nearby place and check hours, access, route, and cost.",
    category: "activity",
    emoji: "✨",
    why: "A useful suggestion needs practical details before it is worth doing.",
    details: "VYVA should turn this into a real place with address, opening hours, price information, transport, and accessibility notes.",
    steps: ["Choose the place type", "Check real details", "Confirm transport or booking"],
    action_label: "Build plan",
    action_prompt: "Find one nearby place and build a practical plan with hours, price, route, and accessibility.",
    safety_note: "Confirm times and access before leaving.",
  },
  {
    title: "Compare a real errand",
    description: "VYVA can compare one useful local errand before you go.",
    category: "deal",
    emoji: "🛒",
    why: "The value is in real opening times, distance, price, and whether it is worth the trip.",
    details: "No generic promotions. VYVA should check a concrete local option and present only useful facts.",
    steps: ["Pick the errand", "Check nearby options", "Choose the practical one"],
    action_label: "Compare",
    action_prompt: "Compare one practical local errand with route, opening hours, and price guidance.",
    safety_note: "",
  },
  {
    title: "Prepare one useful call",
    description: "VYVA can prepare a practical call, booking, or confirmation you may need.",
    category: "tip",
    emoji: "📝",
    why: "A call or booking is more useful than a vague suggestion.",
    details: "VYVA can gather the phone number, what to ask, what to confirm, and the exact summary before calling.",
    steps: ["Choose the task", "Prepare details", "Confirm before calling"],
    action_label: "Prepare",
    action_prompt: "Prepare one useful call or booking with the details needed before confirmation.",
    safety_note: "",
  },
  {
    title: "Find a calm social option",
    description: "VYVA can check nearby talks, clubs, or community activities that suit your interests.",
    category: "event",
    emoji: "📚",
    why: "A low-pressure local activity can be a pleasant way to stay connected.",
    details: "Look for something close, seated, and easy to leave if you get tired. VYVA can help compare options.",
    steps: ["Choose an interest", "Check nearby options", "Pick a comfortable time"],
    action_label: "Explore",
    action_prompt: "Find a calm local activity based on my interests.",
    safety_note: "Prefer accessible venues and daytime options.",
  },
];

function sanitiseRecommendation(item: unknown): RecommendationCard | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;
  if (
    typeof raw.title !== "string" ||
    typeof raw.description !== "string" ||
    typeof raw.category !== "string" ||
    typeof raw.emoji !== "string"
  ) {
    return null;
  }

  const category = ["deal", "event", "tip", "activity"].includes(raw.category)
    ? (raw.category as RecommendationCard["category"])
    : "tip";

  return {
    id: typeof raw.id === "string" ? raw.id : undefined,
    title: raw.title,
    description: raw.description,
    category,
    emoji: raw.emoji,
    why: typeof raw.why === "string" ? raw.why : "",
    details: typeof raw.details === "string" ? raw.details : "",
    steps: asStringArray(raw.steps).slice(0, 3),
    action_label: typeof raw.action_label === "string" ? raw.action_label : "",
    action_prompt: typeof raw.action_prompt === "string" ? raw.action_prompt : "",
    safety_note: typeof raw.safety_note === "string" ? raw.safety_note : "",
    best_time: typeof raw.best_time === "string" ? raw.best_time : "",
    effort: ["none", "low", "medium"].includes(String(raw.effort))
      ? raw.effort as RecommendationCard["effort"]
      : undefined,
    freshness: typeof raw.freshness === "string" ? raw.freshness : "",
    personal_signals: asStringArray(raw.personal_signals).slice(0, 4),
    action_kind: ["chat", "call", "booking", "check", "plan"].includes(String(raw.action_kind))
      ? raw.action_kind as RecommendationCard["action_kind"]
      : undefined,
    action_payload: raw.action_payload && typeof raw.action_payload === "object"
      ? raw.action_payload as RecommendationCard["action_payload"]
      : undefined,
    location_hint: typeof raw.location_hint === "string" ? raw.location_hint : "",
    score: typeof raw.score === "number" ? raw.score : undefined,
    reason_codes: asStringArray(raw.reason_codes),
  };
}

export async function conciergeHandler(req: Request, res: Response) {
  const { prompt, history = [], locale = "en" } = req.body as ChatRequestBody;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const normalizedLocale = normaliseLocale(locale);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const userId = (req as any).user?.id ?? DEMO_USER_ID;
  const context = await getUserProfile(userId);

  if (!apiKey) {
    console.warn("[concierge] OPENAI_API_KEY not set, returning fallback response");
    return res.json({ response: fallbackChatResponse(context.name) });
  }

  const validHistory: HistoryTurn[] = Array.isArray(history)
    ? history
        .filter(
          (t) =>
            (t.role === "user" || t.role === "assistant") &&
            typeof t.content === "string",
        )
        .slice(-12)
    : [];

  try {
    const client = new OpenAI({ apiKey });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: buildChatSystemPrompt(context, normalizedLocale) },
      ...validHistory.map((t) => ({ role: t.role, content: t.content }) as OpenAI.Chat.ChatCompletionMessageParam),
      { role: "user", content: prompt.trim() },
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 512,
    });

    const responseText =
      completion.choices[0]?.message?.content?.trim() ?? fallbackChatResponse(context.name);
    return res.json({ response: responseText });
  } catch (err) {
    console.error("[concierge] OpenAI error:", err);
    return res.json({ response: fallbackChatResponse(context.name) });
  }
}

export async function conciergeRecommendationFeedbackHandler(req: Request, res: Response) {
  const userId = (req as any).user?.id ?? DEMO_USER_ID;
  const { recommendation_id, action, category, title, reasons = [] } = req.body as RecommendationFeedbackRequestBody;

  if (!recommendation_id || typeof recommendation_id !== "string") {
    return res.status(400).json({ error: "recommendation_id is required" });
  }
  if (!action || !["shown", "opened", "liked", "dismissed", "completed"].includes(action)) {
    return res.status(400).json({ error: "valid action is required" });
  }

  try {
    await ensureRecommendationFeedbackTable();
    await pool.query(
      `
        insert into concierge_recommendation_feedback
          (user_id, recommendation_id, action, category, title, reasons)
        values ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        userId,
        recommendation_id,
        action,
        typeof category === "string" ? category : null,
        typeof title === "string" ? title : null,
        JSON.stringify(asStringArray(reasons)),
      ],
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("[concierge/recs/feedback]", err);
    return res.status(500).json({ error: "Failed to save feedback" });
  }
}

export async function conciergeRecommendationPlanHandler(req: Request, res: Response) {
  const { card, locale = "en" } = req.body as RecommendationPlanRequestBody;
  if (!card || typeof card !== "object" || typeof card.title !== "string") {
    return res.status(400).json({ error: "card is required" });
  }

  const normalizedLocale = normaliseLocale(locale);
  const userId = (req as any).user?.id ?? DEMO_USER_ID;
  const context = await getUserProfile(userId);

  try {
    const plan = await buildRecommendationActionPlan(card, context, normalizedLocale);
    return res.json({ plan });
  } catch (err) {
    console.error("[concierge/recs/plan]", err);
    return res.status(500).json({ error: "Failed to build recommendation plan" });
  }
}

export async function conciergeRecommendationsHandler(req: Request, res: Response) {
  const { locale = "en", refresh = false } = req.body as RecommendationsRequestBody;
  const normalizedLocale = normaliseLocale(locale);
  const userId = (req as any).user?.id ?? DEMO_USER_ID;
  const context = await getUserProfile(userId);
  const rankedCandidates = rankRecommendationCandidates(context, { refresh });
  const deterministicCards = await cardsFromRankedCandidates(rankedCandidates, normalizedLocale, context);

  return res.json({ recommendations: deterministicCards });
}
