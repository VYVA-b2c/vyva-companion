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

export interface RecommendationCard {
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
  };
}

async function getUserProfile(userId: string): Promise<UserProfileContext> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [profileRows, companionRows, socialRows, medicationRows, activityRows, conciergeRows] = await Promise.all([
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

function buildRecommendationsPrompt(context: UserProfileContext, dayOfWeek: string, locale: string): string {
  const language = LOCALE_TO_LANGUAGE[locale] ?? "English";
  const location = [context.city, context.region, context.countryCode].filter(Boolean).join(", ");
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

Generate exactly 4 useful, safe, personalised recommendation cards for today. They must be actionable, not generic. Prefer ideas based on location, interests, health-safe routines, local services, hobbies, family/social connection, errands, or practical support.

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

export async function conciergeRecommendationsHandler(req: Request, res: Response) {
  const { locale = "en" } = req.body as RecommendationsRequestBody;
  const normalizedLocale = normaliseLocale(locale);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const userId = (req as any).user?.id ?? DEMO_USER_ID;
  const context = await getUserProfile(userId);
  const dayOfWeek = DAYS_OF_WEEK[new Date().getDay()];

  if (!apiKey) {
    console.warn("[concierge/recs] OPENAI_API_KEY not set, returning fallback");
    return res.json({ recommendations: FALLBACK_RECOMMENDATIONS });
  }

  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: buildRecommendationsPrompt(context, dayOfWeek, normalizedLocale),
        },
      ],
      temperature: 0.7,
      max_tokens: 900,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let recommendations = FALLBACK_RECOMMENDATIONS;

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
    return res.json({ recommendations: FALLBACK_RECOMMENDATIONS });
  }
}
