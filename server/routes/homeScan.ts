import type { Request, Response } from "express";
import OpenAI from "openai";
import { eq, desc } from "drizzle-orm";
import { db } from "../db.js";
import { homeScans } from "../../shared/schema.js";

const DEMO_USER_ID = "demo-user";

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  it: "Italian",
  cy: "Welsh",
};

function buildSystemPrompt(locale: string): string {
  const language = LOCALE_TO_LANGUAGE[locale];
  const translationInstruction = language
    ? `\n- Translate ONLY the "resultTitle", "hazards" array items, and "advice" fields into ${language}. The "riskLevel" field must always remain in English as exactly one of: Safe, Low Risk, High Risk.`
    : "";
  return `You are a compassionate home safety expert helping older adults identify potential hazards in their living environment.
Analyse the room image provided and identify safety risks relevant to an older adult living independently.

Respond in JSON with this exact structure:
{
  "riskLevel": "<one of: Safe | Low Risk | High Risk>",
  "resultTitle": "<short title, e.g. 'Well-Maintained Living Area' or 'Several Trip Hazards Spotted'>",
  "hazards": ["<hazard 1>", "<hazard 2>"],
  "advice": "<2-3 sentences of practical, actionable safety advice, warm and clear>"
}

Guidelines:
- riskLevel must be exactly one of: Safe, Low Risk, High Risk (case-sensitive, no other values).
- Look for: loose rugs or mats, trailing cables or cords, clutter on floors, poor or dim lighting, slippery surfaces, lack of handrails, low furniture difficult to rise from, unsecured items that could fall, blocked pathways.
- If no clear hazards are visible, set riskLevel to "Safe", use an empty hazards array, and give encouraging positive advice.
- If the image is unclear or not a room, return riskLevel "Safe" and ask the user to retake the photo.
- Be constructive and encouraging — frame hazards as easy-to-fix improvements.
- Keep hazard descriptions short (max 8 words each).
- Always respond ONLY with valid JSON, no extra text.${translationInstruction}`;
}

function fallbackResult() {
  return {
    riskLevel: "Safe",
    resultTitle: "Analysis Unavailable",
    hazards: [] as string[],
    advice:
      "We were unable to analyse the image right now. Please try again with a clear, well-lit photo of the room.",
    isFallback: true,
  };
}

export async function homeScanHandler(req: Request, res: Response) {
  const { image, language } = req.body as { image?: string; language?: string };

  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "image (base64 data URL) is required" });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    console.warn("[home-scan] OPENAI_API_KEY not set — returning fallback");
    return res.json(fallbackResult());
  }

  const match = image.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: "image must be a base64 data URL" });
  }
  const mimeType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const base64Data = match[2];

  const locale = typeof language === "string" ? language.split("-")[0].toLowerCase() : "en";
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? DEMO_USER_ID;

  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildSystemPrompt(locale) },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
                detail: "low",
              },
            },
            {
              type: "text",
              text: "Please analyse this room image for home safety hazards and provide a JSON assessment.",
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let parsed: { riskLevel?: string; resultTitle?: string; hazards?: unknown; advice?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[home-scan] Failed to parse OpenAI JSON:", raw);
      return res.json(fallbackResult());
    }

    const VALID_RISK_LEVELS = new Set(["Safe", "Low Risk", "High Risk"]);
    const rawRisk = typeof parsed.riskLevel === "string" ? parsed.riskLevel : "";
    const riskLevel = VALID_RISK_LEVELS.has(rawRisk) ? rawRisk : "Safe";
    const resultTitle =
      typeof parsed.resultTitle === "string" && parsed.resultTitle.trim()
        ? parsed.resultTitle.trim()
        : "Safety Scan Result";
    const hazards = Array.isArray(parsed.hazards)
      ? (parsed.hazards as unknown[])
          .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
          .slice(0, 8)
      : [];
    const advice =
      typeof parsed.advice === "string" && parsed.advice.trim()
        ? parsed.advice.trim()
        : fallbackResult().advice;

    try {
      await db.insert(homeScans).values({
        user_id: userId,
        risk_level: riskLevel,
        result_title: resultTitle,
        hazards,
        advice,
        image_data: image,
      });
    } catch (dbErr) {
      console.error("[home-scan] Failed to persist scan result:", dbErr);
    }

    return res.json({ riskLevel, resultTitle, hazards, advice });
  } catch (err) {
    console.error("[home-scan] OpenAI error:", err);
    return res.json(fallbackResult());
  }
}

export async function homeScanHistoryHandler(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? DEMO_USER_ID;
  try {
    const rows = await db
      .select()
      .from(homeScans)
      .where(eq(homeScans.user_id, userId))
      .orderBy(desc(homeScans.scanned_at))
      .limit(50);
    return res.json(rows);
  } catch (err) {
    console.error("[home-scan] history fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch scan history" });
  }
}

export async function homeScanDeleteHandler(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? DEMO_USER_ID;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }
  try {
    const rows = await db
      .select({ user_id: homeScans.user_id })
      .from(homeScans)
      .where(eq(homeScans.id, id))
      .limit(1);
    if (!rows[0]) {
      return res.status(404).json({ error: "Not found" });
    }
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.delete(homeScans).where(eq(homeScans.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("[home-scan] delete error:", err);
    return res.status(500).json({ error: "Failed to delete scan" });
  }
}
