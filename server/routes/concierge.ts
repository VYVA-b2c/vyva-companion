import type { Request, Response } from "express";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { profiles, companionProfiles } from "../../shared/schema.js";

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

async function getUserProfile(userId: string): Promise<{ name: string; city: string; interests: string[] }> {
  try {
    const rows = await db
      .select({ full_name: profiles.full_name, preferred_name: profiles.preferred_name, city: profiles.city })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    const companionRows = await db
      .select({ interests: companionProfiles.interests, hobbies: companionProfiles.hobbies, preferred_activities: companionProfiles.preferred_activities })
      .from(companionProfiles)
      .where(eq(companionProfiles.user_id, userId))
      .limit(1);
    const p = rows[0];
    const companion = companionRows[0];
    if (!p) {
      const fallbackInterests = Array.from(
        new Set([...(companion?.interests ?? []), ...(companion?.hobbies ?? []), ...(companion?.preferred_activities ?? [])].filter((v) => typeof v === "string" && v.trim()))
      );
      return { name: "", city: "", interests: fallbackInterests };
    }
    const name =
      p.preferred_name?.trim() ||
      (p.full_name ?? "").trim().split(/\s+/)[0] ||
      "";
    const city = p.city?.trim() || "";
    const interests = Array.from(
      new Set([...(companion?.interests ?? []), ...(companion?.hobbies ?? []), ...(companion?.preferred_activities ?? [])].filter((v) => typeof v === "string" && v.trim()))
    );
    return { name, city, interests };
  } catch {
    return { name: "", city: "", interests: [] };
  }
}

function buildChatSystemPrompt(name: string, city: string, locale: string): string {
  const language = LOCALE_TO_LANGUAGE[locale] ?? "English";
  const nameClause = name ? `The user's name is ${name}.` : "";
  const cityClause = city ? `They live in or near ${city}.` : "";

  return `You are VYVA Concierge — a warm, practical, and friendly personal lifestyle assistant for older adults. You help with everyday tasks: booking rides, scheduling appointments, finding local deals and events, researching topics, and giving practical advice.

${nameClause} ${cityClause}

Guidelines:
- Respond conversationally and warmly. Use the user's name occasionally.
- Keep responses concise and easy to read (prefer short paragraphs or bullet points).
- For ride booking: suggest how to use a local taxi service or app, provide practical steps.
- For appointment scheduling: give a clear step-by-step guide.
- For deal finding: suggest where to look (local newspapers, supermarket websites, senior discount schemes).
- For research topics: give clear, plain-language explanations.
- IMPORTANT: If asked for medical diagnosis, treatment recommendations, or specific clinical advice about symptoms or conditions, politely decline and redirect the user to VYVA's Health section or their GP. Say something like: "That sounds like something your GP would be best placed to help with — I'm focused on everyday lifestyle tasks. VYVA's Health section is great for health questions!" Administrative or informational health topics are fine — e.g. explaining what an insurance plan covers, helping schedule a medical appointment, or researching general health services.
- Always suggest a practical next step at the end of your response.
- IMPORTANT: You MUST respond entirely in ${language}. All your answers, suggestions and practical steps must be in ${language}.`.trim();
}

function buildRecommendationsPrompt(name: string, city: string, interests: string[], dayOfWeek: string, locale: string): string {
  const nameClause = name ? `The user's name is ${name}.` : "";
  const cityClause = city ? `They live in or near ${city}.` : "";
  const language = LOCALE_TO_LANGUAGE[locale] ?? "English";
  const interestClause =
    interests.length > 0
      ? `Their saved interests and hobbies include: ${interests.slice(0, 8).join(", ")}. At least one recommendation should clearly reflect these interests.`
      : "";

  return `You are a helpful personal concierge assistant for an older adult. ${nameClause} ${cityClause} ${interestClause} Today is ${dayOfWeek}.

Generate exactly 4 short, friendly recommendation cards for the user's day. These should be a mix of: local event ideas, practical tips, seasonal deals or savings ideas, activity suggestions, or helpful life tips for seniors.

Respond ONLY with a valid JSON array of exactly 4 objects. Each object must have:
- "title": a short catchy title (4–7 words)
- "description": one friendly sentence (max 20 words)
- "category": one of "deal", "event", "tip", "activity"
- "emoji": one relevant emoji

IMPORTANT: You MUST write every "title" and "description" value entirely in ${language}. All card content must be in ${language} — do not use English unless ${language} is English. Return only the JSON array, no other text.

Example format:
[
  { "title": "Free Museum Entry Today", "description": "Many local museums offer free entry on weekdays — a lovely outing.", "category": "event", "emoji": "🎨" },
  { "title": "Supermarket Senior Discount", "description": "Check if your local supermarket runs a senior discount day this week.", "category": "deal", "emoji": "🛒" }
]`;
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


function fallbackChatResponse(name: string): string {
  const greeting = name ? `Hi ${name}!` : "Hi there!";
  return `${greeting} I'm here to help with everyday tasks — booking rides, finding deals, scheduling appointments, and more. What can I help you with today?`;
}

export async function conciergeHandler(req: Request, res: Response) {
  const { prompt, history = [], locale = "en" } = req.body as ChatRequestBody;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  // Normalise e.g. "es-419" → "es" and reject unknown locales gracefully
  const baseLocale = typeof locale === "string" ? locale.split("-")[0].toLowerCase() : "en";
  const normalizedLocale = baseLocale in LOCALE_TO_LANGUAGE ? baseLocale : "en";

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const userId = (req as any).user?.id ?? DEMO_USER_ID;
  const { name, city, interests } = await getUserProfile(userId);

  if (!apiKey) {
    console.warn("[concierge] OPENAI_API_KEY not set — returning fallback response");
    return res.json({ response: fallbackChatResponse(name) });
  }

  const validHistory: HistoryTurn[] = Array.isArray(history)
    ? history
        .filter(
          (t) =>
            (t.role === "user" || t.role === "assistant") &&
            typeof t.content === "string"
        )
        .slice(-12)
    : [];

  try {
    const client = new OpenAI({ apiKey });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: buildChatSystemPrompt(name, city, normalizedLocale) },
      ...validHistory.map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: prompt.trim() },
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 512,
    });

    const responseText =
      completion.choices[0]?.message?.content?.trim() ?? fallbackChatResponse(name);
    return res.json({ response: responseText });
  } catch (err) {
    console.error("[concierge] OpenAI error:", err);
    return res.json({ response: fallbackChatResponse(name) });
  }
}

export interface RecommendationCard {
  title: string;
  description: string;
  category: "deal" | "event" | "tip" | "activity";
  emoji: string;
}

const FALLBACK_RECOMMENDATIONS: RecommendationCard[] = [
  {
    title: "Morning Walk Boost",
    description: "A 15-minute walk this morning can energise your whole day.",
    category: "activity",
    emoji: "🚶",
  },
  {
    title: "Senior Supermarket Savings",
    description: "Check your local store for a senior discount day this week.",
    category: "deal",
    emoji: "🛒",
  },
  {
    title: "Try a New Recipe",
    description: "Ask VYVA for a simple, nutritious recipe made for one person.",
    category: "tip",
    emoji: "🍲",
  },
  {
    title: "Local Library Events",
    description: "Many libraries host free talks and social groups — worth a look!",
    category: "event",
    emoji: "📚",
  },
];

export async function conciergeRecommendationsHandler(req: Request, res: Response) {
  const { locale = "en" } = req.body as RecommendationsRequestBody;
  // Normalise e.g. "es-419" → "es" and reject unknown locales gracefully
  const baseLocale = typeof locale === "string" ? locale.split("-")[0].toLowerCase() : "en";
  const normalizedLocale = baseLocale in LOCALE_TO_LANGUAGE ? baseLocale : "en";
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const userId = (req as any).user?.id ?? DEMO_USER_ID;
  const { name, city, interests } = await getUserProfile(userId);
  const dayOfWeek = DAYS_OF_WEEK[new Date().getDay()];

  if (!apiKey) {
    console.warn("[concierge/recs] OPENAI_API_KEY not set — returning fallback");
    return res.json({ recommendations: FALLBACK_RECOMMENDATIONS });
  }

  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: buildRecommendationsPrompt(name, city, interests, dayOfWeek, normalizedLocale),
        },
      ],
      temperature: 0.85,
      max_tokens: 512,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    let recommendations: RecommendationCard[] = FALLBACK_RECOMMENDATIONS;
    try {
      const parsed = JSON.parse(raw) as unknown[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        recommendations = parsed
          .filter(
            (item) =>
              item &&
              typeof item === "object" &&
              "title" in item &&
              "description" in item &&
              "category" in item &&
              "emoji" in item
          )
          .map((item) => item as RecommendationCard)
          .slice(0, 5);
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
