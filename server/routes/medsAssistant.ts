import type { Request, Response } from "express";
import OpenAI from "openai";

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  it: "Italian",
  cy: "Welsh",
};

const DISCLAIMER =
  "This is information only, not medical advice — always check with your doctor or pharmacist.";

function buildSystemPrompt(locale: string): string {
  const language = LOCALE_TO_LANGUAGE[locale];
  const languageInstruction = language
    ? `\n\nIMPORTANT: You MUST respond entirely in ${language}. All your advice, explanations and questions must be in ${language}. Only the disclaimer at the end must remain exactly in English as specified — never translate it.`
    : "";
  return `You are VYVA, a warm and knowledgeable medication assistant for older adults. You answer questions about medications clearly and accessibly. Keep responses concise (2-4 sentences where possible). You are not a doctor — always be supportive and encouraging.

After EVERY response you give, append this disclaimer on a new line:
"${DISCLAIMER}"

The disclaimer MUST always be written in English exactly as shown above, regardless of which language you respond in.
Never skip the disclaimer, even for short replies.${languageInstruction}`;
}

interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  prompt?: string;
  history?: HistoryTurn[];
  locale?: string;
}

function fallbackResponse(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("interaction")) {
    return `I'm not able to check interactions right now, but it's always a good idea to ask your pharmacist — they can check all your medications together. They'll be happy to help!\n\n${DISCLAIMER}`;
  }
  if (lower.includes("advice") || lower.includes("guidance")) {
    return `That's a great question about your medications. I'd recommend speaking with your GP or pharmacist — they know your full medical history and can give you the most helpful guidance.\n\n${DISCLAIMER}`;
  }
  if (lower.includes("advance") || lower.includes("research") || lower.includes("news")) {
    return `There's always new research coming out about medications. Your GP will have the latest guidance on any changes relevant to your prescriptions. They love hearing that you're staying informed!\n\n${DISCLAIMER}`;
  }
  return `I'm here to help with any medication questions. For the most accurate advice, please speak with your GP or pharmacist who knows your full health picture.\n\n${DISCLAIMER}`;
}

export async function medsAssistantHandler(req: Request, res: Response) {
  const { prompt, history = [], locale = "en" } = req.body as RequestBody;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    console.warn("[meds-assistant] OPENAI_API_KEY not set — returning fallback response");
    return res.json({ response: fallbackResponse(prompt) });
  }

  const normalizedLocale = typeof locale === "string" ? locale.split("-")[0].toLowerCase() : "en";

  const validHistory: HistoryTurn[] = Array.isArray(history)
    ? history
        .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
        .slice(-10)
    : [];

  try {
    const client = new OpenAI({ apiKey });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt(normalizedLocale) },
      ...validHistory.map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: prompt.trim() },
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.6,
      max_tokens: 512,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() ?? "";
    const hasDisclaimer = responseText.includes(DISCLAIMER);
    const finalResponse = hasDisclaimer
      ? responseText
      : `${responseText}\n\n${DISCLAIMER}`;

    return res.json({ response: finalResponse });
  } catch (err) {
    console.error("[meds-assistant] OpenAI error:", err);
    return res.json({ response: fallbackResponse(prompt) });
  }
}
