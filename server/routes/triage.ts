import { Router } from "express";
import type { Request, Response } from "express";
import OpenAI from "openai";

const router = Router();

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  it: "Italian",
  cy: "Welsh",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface TriageSummary {
  chiefComplaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
}

interface TriageRequestBody {
  messages?: ChatMessage[];
  vitals?: { bpm: number | null };
  locale?: string;
}

function buildSystemPrompt(language: string, bpm: number | null): string {
  const vitalsContext = bpm != null
    ? `\n\nThe user has just completed a vitals scan. Their estimated heart rate is ${bpm} bpm. Reference this gently if relevant.`
    : "";

  return `You are VYVA, a warm and caring medical triage assistant helping an elderly person understand their symptoms. Your role is to ask clear, simple questions and provide a helpful triage summary.

IMPORTANT: Respond entirely in ${language}.${vitalsContext}

CONVERSATION FLOW:
1. Begin with a warm, reassuring greeting. Ask what's bothering them today.
2. Ask clarifying questions one at a time about: how long they've had the symptom, severity on a scale of 1-10, any other symptoms.
3. After gathering sufficient information (typically 4-6 exchanges), gently wrap up.
4. On your FINAL turn, you MUST end your message with this exact JSON block (replace values appropriately):

TRIAGE_JSON_START
{"done":true,"summary":{"chiefComplaint":"<one-line description>","symptoms":["<symptom 1>","<symptom 2>"],"urgency":"<urgent|routine|monitor>","recommendations":["<step 1>","<step 2>","<step 3>","<step 4>"],"disclaimer":"This assessment is for information only and is not medical advice. Always consult your doctor or call emergency services if you feel it is serious."}}
TRIAGE_JSON_END

Urgency definitions:
- "urgent": symptoms that warrant same-day or next-day GP attention (e.g. chest pain, difficulty breathing, high fever)
- "routine": symptoms that should be discussed at the next GP appointment (e.g. mild ongoing pain, fatigue)
- "monitor": symptoms that are likely self-limiting and can be monitored at home (e.g. mild cold, minor ache)

STYLE RULES:
- Use simple, kind, non-alarming language suitable for elderly users
- Keep each message to 2-3 sentences maximum
- Never use medical jargon
- Be warm and reassuring throughout
- Do NOT produce the JSON block before the 4th user message`;
}

function extractTriageJson(text: string): { content: string; summary: TriageSummary | null } {
  const startMarker = "TRIAGE_JSON_START";
  const endMarker = "TRIAGE_JSON_END";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { content: text.trim(), summary: null };
  }

  const beforeJson = text.slice(0, startIdx).trim();
  const jsonStr = text.slice(startIdx + startMarker.length, endIdx).trim();

  try {
    const parsed = JSON.parse(jsonStr) as { done: boolean; summary: TriageSummary };
    if (parsed.done && parsed.summary) {
      return { content: beforeJson, summary: parsed.summary };
    }
  } catch {
    console.warn("[triage] Failed to parse JSON block:", jsonStr.slice(0, 200));
  }

  return { content: text.trim(), summary: null };
}

router.post("/message", async (req: Request, res: Response) => {
  const { messages = [], vitals, locale = "en" } = req.body as TriageRequestBody;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages must be an array" });
  }

  const normalizedLocale = typeof locale === "string"
    ? locale.split("-")[0].toLowerCase()
    : "en";
  const language = LOCALE_TO_LANGUAGE[normalizedLocale] ?? "English";

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    return res.status(503).json({ error: "AI service not configured" });
  }

  const validMessages: ChatMessage[] = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20);

  try {
    const client = new OpenAI({ apiKey });

    const systemContent = buildSystemPrompt(language, vitals?.bpm ?? null);

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...validMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
      temperature: 0.65,
      max_tokens: 600,
    });

    const rawContent = completion.choices[0]?.message?.content?.trim() ?? "";
    const { content, summary } = extractTriageJson(rawContent);

    return res.json({
      role: "assistant",
      content,
      done: summary != null,
      summary: summary ?? undefined,
    });
  } catch (err) {
    console.error("[triage] OpenAI error:", err);
    return res.status(500).json({ error: "Failed to process triage request" });
  }
});

export default router;
