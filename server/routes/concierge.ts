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
  socialActivityLevel: string;
  preferredTimes: string[];
  recommendationFeedback: RecommendationFeedbackSummary;
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
}

interface RecommendationFeedbackRequestBody {
  recommendation_id?: string;
  action?: "opened" | "liked" | "dismissed" | "completed";
  category?: string;
  title?: string;
  reasons?: string[];
}

interface RecommendationFeedbackSummary {
  likedIds: string[];
  dismissedIds: string[];
  completedIds: string[];
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
  tags: string[];
  physicalDemand: "none" | "low" | "moderate";
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
    socialActivityLevel: "moderate",
    preferredTimes: [],
    recommendationFeedback: {
      likedIds: [],
      dismissedIds: [],
      completedIds: [],
    },
  };
}

async function getRecommendationFeedbackSummary(userId: string): Promise<RecommendationFeedbackSummary> {
  const empty: RecommendationFeedbackSummary = { likedIds: [], dismissedIds: [], completedIds: [] };

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

    for (const row of result.rows as Array<{ recommendation_id?: string; action?: string }>) {
      if (!row.recommendation_id) continue;
      if (row.action === "liked") liked.add(row.recommendation_id);
      if (row.action === "dismissed") dismissed.add(row.recommendation_id);
      if (row.action === "completed") completed.add(row.recommendation_id);
    }

    return {
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

async function getUserProfile(userId: string): Promise<UserProfileContext> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [profileRows, companionRows, socialRows, medicationRows, activityRows, conciergeRows, feedbackSummary] = await Promise.all([
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
- Keep responses concise and easy to read.
- For ride booking: suggest how to use a local taxi service or app, provide practical steps.
- For appointment scheduling: give a clear step-by-step guide.
- For deal finding: suggest where to look.
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
    preferredWhen: (context) => context.recentConciergeUseCases.length > 0,
  },
  {
    id: "local_savings_check",
    category: "deal",
    emoji: "🛒",
    title: { en: "Useful local savings", es: "Ahorros utiles cerca" },
    description: {
      en: "VYVA can look for practical nearby discounts before your next errand.",
      es: "VYVA puede buscar descuentos cercanos utiles antes de tu proximo recado.",
    },
    why: {
      en: "It is useful only if the shop or service is nearby and practical.",
      es: "Solo sirve si la tienda o servicio queda cerca y es practico.",
    },
    details: {
      en: "Focus on pharmacies, supermarkets, transport, or community offers. VYVA can filter out anything awkward to reach.",
      es: "Conviene mirar farmacias, supermercados, transporte u ofertas comunitarias. VYVA puede descartar lo dificil de aprovechar.",
    },
    steps: {
      en: ["Choose a category", "Check nearby offers", "Save the useful ones"],
      es: ["Elegir categoria", "Buscar ofertas cerca", "Guardar las utiles"],
    },
    actionLabel: { en: "Find offers", es: "Buscar" },
    actionPrompt: {
      en: "Find practical local offers near me today.",
      es: "Busca ofertas practicas cerca de mi para hoy.",
    },
    safetyNote: { en: "", es: "" },
    tags: ["deal", "discount", "shopping", "pharmacy", "supermarket", "ahorro", "oferta", "farmacia"],
    physicalDemand: "low",
    requiresLocation: true,
  },
  {
    id: "home_based_hobby",
    category: "activity",
    emoji: "☕",
    title: { en: "A hobby at home", es: "Un plan en casa" },
    description: {
      en: "VYVA can shape one saved interest into an easy activity at home.",
      es: "VYVA puede convertir un interes guardado en una actividad sencilla en casa.",
    },
    why: {
      en: "It uses saved interests without needing travel or effort.",
      es: "Usa tus intereses guardados sin exigir desplazamiento ni esfuerzo.",
    },
    details: {
      en: "This works well for reading, music, cooking ideas, family calls, puzzles, or learning something new.",
      es: "Puede servir para lectura, musica, cocina sencilla, llamadas familiares, pasatiempos o aprender algo nuevo.",
    },
    steps: {
      en: ["Pick one interest", "Choose a short version", "Let VYVA guide it"],
      es: ["Elegir un interes", "Hacer una version corta", "Dejar que VYVA guie"],
    },
    actionLabel: { en: "Guide me", es: "Guiame" },
    actionPrompt: {
      en: "Suggest an easy home activity based on my interests.",
      es: "Sugiere una actividad sencilla en casa basada en mis intereses.",
    },
    safetyNote: { en: "", es: "" },
    tags: ["home", "hobby", "music", "reading", "cooking", "family", "casa", "lectura", "musica"],
    physicalDemand: "none",
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
    requiresHealthContext: true,
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
  },
];

function scoreCandidate(candidate: RecommendationCandidate, context: UserProfileContext): RankedRecommendationCandidate | null {
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
  if (hasMobilityLimit(context) && candidate.physicalDemand === "none") {
    score += 10;
    reasons.push("mobility_safe");
  }
  if (context.socialActivityLevel === "low" && candidate.id === "home_based_hobby") {
    score += 10;
    reasons.push("low_social_pressure");
  }
  if (context.recommendationFeedback.likedIds.includes(candidate.id)) {
    score += 18;
    reasons.push("previously_liked");
  }
  if (context.recommendationFeedback.completedIds.includes(candidate.id)) {
    score += 10;
    reasons.push("previously_completed");
  }
  if (context.recommendationFeedback.dismissedIds.includes(candidate.id)) {
    score -= 30;
    reasons.push("previously_dismissed");
  }
  if (score < 20) return null;

  return { candidate, score, reasons };
}

function rankRecommendationCandidates(context: UserProfileContext): RankedRecommendationCandidate[] {
  return RECOMMENDATION_CANDIDATES
    .map((candidate) => scoreCandidate(candidate, context))
    .filter((item): item is RankedRecommendationCandidate => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function candidateToCard(ranked: RankedRecommendationCandidate, locale: string): RecommendationCard {
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
    score: ranked.score,
    reason_codes: ranked.reasons,
  };
}

function cardsFromRankedCandidates(ranked: RankedRecommendationCandidate[], locale: string): RecommendationCard[] {
  const cards = ranked.map((item) => candidateToCard(item, locale)).slice(0, 4);
  return cards.length > 0 ? cards : FALLBACK_RECOMMENDATIONS;
}

function buildRecommendationsPrompt(
  context: UserProfileContext,
  dayOfWeek: string,
  locale: string,
  rankedCandidates: RankedRecommendationCandidate[],
): string {
  const language = LOCALE_TO_LANGUAGE[locale] ?? "English";
  const location = [context.city, context.region, context.countryCode].filter(Boolean).join(", ");
  const candidateSummary = rankedCandidates.map((item) => ({
    id: item.candidate.id,
    score: item.score,
    reasons: item.reasons,
    category: item.candidate.category,
    baseline: candidateToCard(item, locale),
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
- Social activity level: ${context.socialActivityLevel}
- Preferred times: ${context.preferredTimes.join(", ") || "unknown"}

VYVA has already scored and safety-filtered candidate opportunities. You MUST choose from these candidates only. You may improve wording, make the local framing warmer, and tailor the details, but do not invent unrelated card types:
${JSON.stringify(candidateSummary, null, 2)}

Generate exactly 4 useful, safe, personalised recommendation cards for today from the ranked candidates. They must be actionable, not generic. Prefer higher scores unless a lower-scored candidate gives better variety.

Respond ONLY with a valid JSON array of exactly 4 objects. Each object must have:
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

Rules:
- Choose only from the candidate list above.
- Keep the core intent of each selected candidate.
- Never recommend something that conflicts with mobility limitations or known health context.
- Do not diagnose, treat, or give clinical advice.
- If mentioning a local place or event, phrase it as something VYVA can check, not as guaranteed.
- Make the cards feel specific to ${location || "the user's area"}.
- IMPORTANT: Write every text value entirely in ${language}. Do not use English unless ${language} is English.`;
}

function fallbackChatResponse(name: string): string {
  const greeting = name ? `Hi ${name}!` : "Hi there!";
  return `${greeting} I'm here to help with everyday tasks: booking rides, finding deals, scheduling appointments, and more. What can I help you with today?`;
}

const FALLBACK_RECOMMENDATIONS: RecommendationCard[] = [
  {
    title: "Plan a gentle outing",
    description: "VYVA can suggest a nearby, low-effort activity that fits your day.",
    category: "activity",
    emoji: "✨",
    why: "It can be adapted to your mobility, location, and preferences.",
    details: "Choose something short, nearby, and easy to pause. VYVA can help check access, timing, and transport before you go.",
    steps: ["Choose a type of outing", "Check access and timing", "Arrange transport if needed"],
    action_label: "Plan it",
    action_prompt: "Help me plan a gentle nearby activity for today.",
    safety_note: "Keep it low effort and stop if you feel unwell.",
  },
  {
    title: "Check local savings",
    description: "VYVA can look for useful local discounts before your next errand.",
    category: "deal",
    emoji: "🛒",
    why: "Small savings are most useful when they match shops nearby.",
    details: "Ask VYVA to check supermarkets, pharmacies, or community offers in your area. Keep only the offers that are practical to reach.",
    steps: ["Pick a shop type", "Check nearby offers", "Save the useful ones"],
    action_label: "Find offers",
    action_prompt: "Find practical local offers near me today.",
    safety_note: "",
  },
  {
    title: "Make today easier",
    description: "VYVA can turn one small chore into a simple step-by-step plan.",
    category: "tip",
    emoji: "📝",
    why: "Practical help is often better than generic advice.",
    details: "Pick one thing that feels mildly annoying today. VYVA can break it into steps or make a call if needed.",
    steps: ["Name the task", "Break it down", "Ask VYVA to help"],
    action_label: "Guide me",
    action_prompt: "Help me turn one task today into simple steps.",
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
  if (!action || !["opened", "liked", "dismissed", "completed"].includes(action)) {
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

export async function conciergeRecommendationsHandler(req: Request, res: Response) {
  const { locale = "en" } = req.body as RecommendationsRequestBody;
  const normalizedLocale = normaliseLocale(locale);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const userId = (req as any).user?.id ?? DEMO_USER_ID;
  const context = await getUserProfile(userId);
  const dayOfWeek = DAYS_OF_WEEK[new Date().getDay()];
  const rankedCandidates = rankRecommendationCandidates(context);
  const deterministicCards = cardsFromRankedCandidates(rankedCandidates, normalizedLocale);

  if (!apiKey) {
    console.warn("[concierge/recs] OPENAI_API_KEY not set, returning ranked deterministic cards");
    return res.json({ recommendations: deterministicCards });
  }

  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: buildRecommendationsPrompt(context, dayOfWeek, normalizedLocale, rankedCandidates),
        },
      ],
      temperature: 0.7,
      max_tokens: 900,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let recommendations = deterministicCards;

    try {
      const parsed = JSON.parse(raw) as unknown[];
      if (Array.isArray(parsed)) {
        const cleaned = parsed.map(sanitiseRecommendation).filter(Boolean) as RecommendationCard[];
        if (cleaned.length > 0) recommendations = cleaned.slice(0, 4);
      }
    } catch {
      console.warn("[concierge/recs] Failed to parse JSON response, using fallback");
    }

    return res.json({ recommendations });
  } catch (err) {
    console.error("[concierge/recs] OpenAI error:", err);
    return res.json({ recommendations: deterministicCards });
  }
}
