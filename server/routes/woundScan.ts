import type { Request, Response } from "express";
import OpenAI from "openai";
import { eq, desc } from "drizzle-orm";
import { db } from "../db.js";
import { woundScans } from "../../shared/schema.js";

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
    ? `\n- Translate ONLY the "resultTitle" and "advice" fields into ${language}. The "severity" field must always remain in English as one of: Minor, Moderate, Serious.`
    : "";
  return `You are a compassionate medical image assistant helping older adults assess minor wounds. 
Analyse the wound image provided and give a clear, concise assessment suitable for a senior citizen.

Respond in JSON with this exact structure:
{
  "severity": "<one of: Minor | Moderate | Serious>",
  "resultTitle": "<short title, e.g. 'Minor Abrasion' or 'Moderate Laceration'>",
  "advice": "<2-3 sentences of practical first-aid advice, warm and clear>"
}

Guidelines:
- If the image is not a wound or is unclear, return severity "Minor" and advice asking the user to retake the photo.
- Be conservative: when uncertain, lean toward recommending professional care.
- Keep advice practical and actionable.
- Do not include a disclaimer in the JSON — it is added separately by the application.
- Always respond ONLY with valid JSON, no extra text.${translationInstruction}`;
}

function fallbackResult() {
  return {
    severity: "Minor",
    resultTitle: "Analysis Unavailable",
    advice:
      "We were unable to analyse the image right now. Please try again, or if you are concerned, contact a healthcare professional.",
    isFallback: true,
  };
}

export async function woundScanHandler(req: Request, res: Response) {
  const { image, language } = req.body as { image?: string; language?: string };

  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "image (base64 data URL) is required" });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    console.warn("[wound-scan] OPENAI_API_KEY not set — returning fallback");
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
              text: "Please analyse this wound image and provide a JSON assessment.",
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let parsed: { severity?: string; resultTitle?: string; advice?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[wound-scan] Failed to parse OpenAI JSON:", raw);
      return res.json(fallbackResult());
    }

    const VALID_SEVERITIES = new Set(["Minor", "Moderate", "Serious"]);
    const rawSeverity = typeof parsed.severity === "string" ? parsed.severity : "";
    const severity = VALID_SEVERITIES.has(rawSeverity) ? rawSeverity : "Minor";
    const resultTitle =
      typeof parsed.resultTitle === "string" && parsed.resultTitle.trim()
        ? parsed.resultTitle.trim()
        : "Analysis Result";
    const advice =
      typeof parsed.advice === "string" && parsed.advice.trim()
        ? parsed.advice.trim()
        : fallbackResult().advice;

    try {
      await db.insert(woundScans).values({
        user_id: userId,
        severity,
        result_title: resultTitle,
        advice,
        image_data: image,
      });
    } catch (dbErr) {
      console.error("[wound-scan] Failed to persist scan result:", dbErr);
    }

    return res.json({ severity, resultTitle, advice });
  } catch (err) {
    console.error("[wound-scan] OpenAI error:", err);
    return res.json(fallbackResult());
  }
}

export async function woundScanHistoryHandler(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? DEMO_USER_ID;
  try {
    const rows = await db
      .select()
      .from(woundScans)
      .where(eq(woundScans.user_id, userId))
      .orderBy(desc(woundScans.scanned_at))
      .limit(50);
    return res.json(rows);
  } catch (err) {
    console.error("[wound-scan] history fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch scan history" });
  }
}

export async function woundScanDeleteHandler(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? DEMO_USER_ID;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }
  try {
    const rows = await db
      .select({ user_id: woundScans.user_id })
      .from(woundScans)
      .where(eq(woundScans.id, id))
      .limit(1);
    if (!rows[0]) {
      return res.status(404).json({ error: "Not found" });
    }
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.delete(woundScans).where(eq(woundScans.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("[wound-scan] delete error:", err);
    return res.status(500).json({ error: "Failed to delete scan" });
  }
}
