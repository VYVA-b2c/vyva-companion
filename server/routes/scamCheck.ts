import type { Request, Response } from "express";
import OpenAI from "openai";
import { eq, desc } from "drizzle-orm";
import { db } from "../db.js";
import { scamChecks } from "../../shared/schema.js";

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
    ? `\n- Translate ONLY the "resultTitle", "explanation", and "steps" array items into ${language}. The "riskLevel" field must always remain in English as exactly one of: Safe, Suspicious, Scam.`
    : "";
  return `You are a compassionate fraud and scam detection expert helping older adults identify potentially dangerous communications, letters, emails, or documents.
Analyse the image provided — it may be a photograph of a letter, printed email, text message screenshot, or any other document — and assess whether it is a scam or fraudulent attempt.

Respond in JSON with this exact structure:
{
  "riskLevel": "<one of: Safe | Suspicious | Scam>",
  "resultTitle": "<short title, e.g. 'Looks Legitimate' or 'Suspicious Payment Request' or 'Confirmed Scam Attempt'>",
  "explanation": "<2-3 plain-language sentences explaining your assessment, warm and clear>",
  "steps": ["<step 1>", "<step 2>", "<step 3>"]
}

Guidelines:
- riskLevel must be exactly one of: Safe, Suspicious, Scam (case-sensitive, no other values).
- Safe: genuine communications from known organisations, personal letters, official government correspondence with no suspicious elements.
- Suspicious: requests for personal information, unusual urgency, too-good-to-be-true offers, unusual payment methods, or unclear sender identity.
- Scam: clear fraud indicators — fake prizes, impersonation of banks/HMRC/police, requests for gift cards or wire transfers, phishing links, threatening language.
- Look for: requests for bank details, NI/SSN/Medicare numbers, passwords or PINs; urgency or threats; unsolicited offers; suspicious sender names or addresses; misspellings that mimic legitimate brands; QR codes or short URLs; requests for unusual payment methods.
- If the image is not a document, letter, or message, set riskLevel to "Safe" and explain that you could not identify the content.
- Be compassionate and empowering — never alarming. Frame advice as practical next steps.
- Keep each step short (max 12 words).
- Provide exactly 3 numbered steps appropriate to the risk level.
- Always respond ONLY with valid JSON, no extra text.${translationInstruction}`;
}

function fallbackResult() {
  return {
    riskLevel: "Safe",
    resultTitle: "Analysis Unavailable",
    explanation:
      "We were unable to analyse this document right now. If you are concerned about whether something is a scam, please contact the UK's national scam helpline on 0808 250 5050.",
    steps: [
      "Do not share any personal or financial information.",
      "Contact your bank or a trusted person for advice.",
      "Call the free scam helpline: 0808 250 5050.",
    ],
    isFallback: true,
  };
}

export async function scamCheckHandler(req: Request, res: Response) {
  const { image, language, fileType } = req.body as { image?: string; language?: string; fileType?: string };

  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "image (base64 data URL) is required" });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    console.warn("[scam-check] OPENAI_API_KEY not set — returning fallback");
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
                detail: "high",
              },
            },
            {
              type: "text",
              text: "Please analyse this document or image for scam indicators and provide a JSON assessment.",
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let parsed: { riskLevel?: string; resultTitle?: string; explanation?: string; steps?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[scam-check] Failed to parse OpenAI JSON:", raw);
      return res.json(fallbackResult());
    }

    const VALID_RISK_LEVELS = new Set(["Safe", "Suspicious", "Scam"]);
    const rawRisk = typeof parsed.riskLevel === "string" ? parsed.riskLevel : "";
    const riskLevel = VALID_RISK_LEVELS.has(rawRisk) ? rawRisk : "Safe";
    const resultTitle =
      typeof parsed.resultTitle === "string" && parsed.resultTitle.trim()
        ? parsed.resultTitle.trim()
        : "Analysis Result";
    const explanation =
      typeof parsed.explanation === "string" && parsed.explanation.trim()
        ? parsed.explanation.trim()
        : fallbackResult().explanation;
    const steps: string[] = Array.isArray(parsed.steps)
      ? (parsed.steps as unknown[]).filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 5)
      : fallbackResult().steps;

    try {
      const resolvedFileType = fileType === "pdf" ? "pdf" : "image";
      await db.insert(scamChecks).values({
        user_id: userId,
        file_type: resolvedFileType,
        risk_level: riskLevel,
        result_title: resultTitle,
        explanation,
        steps,
        image_data: image,
      });
    } catch (dbErr) {
      console.error("[scam-check] Failed to persist result:", dbErr);
    }

    return res.json({ riskLevel, resultTitle, explanation, steps });
  } catch (err) {
    console.error("[scam-check] OpenAI error:", err);
    return res.json(fallbackResult());
  }
}

export async function scamCheckHistoryHandler(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? DEMO_USER_ID;
  try {
    const rows = await db
      .select()
      .from(scamChecks)
      .where(eq(scamChecks.user_id, userId))
      .orderBy(desc(scamChecks.checked_at))
      .limit(50);
    return res.json(rows);
  } catch (err) {
    console.error("[scam-check] history fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch scam check history" });
  }
}

export async function scamCheckDeleteHandler(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id: string } }).user?.id ?? DEMO_USER_ID;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }
  try {
    const rows = await db
      .select({ user_id: scamChecks.user_id })
      .from(scamChecks)
      .where(eq(scamChecks.id, id))
      .limit(1);
    if (!rows[0]) {
      return res.status(404).json({ error: "Not found" });
    }
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.delete(scamChecks).where(eq(scamChecks.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("[scam-check] delete error:", err);
    return res.status(500).json({ error: "Failed to delete scam check" });
  }
}
