import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { z } from "zod";

const OPENAI_MODEL = "gpt-4o-mini";
const ELEVENLABS_TTS_MODEL = "eleven_multilingual_v2";
const GAME_LANGUAGES = ["es", "en", "fr", "de", "it", "pt"] as const;
type GameLanguage = (typeof GAME_LANGUAGES)[number];

type RetellScore = {
  covered: number[];
  not_covered: number[];
  covered_count: number;
  total_count: number;
  error: string | null;
};

const languageInstructions: Record<GameLanguage, string> = {
  es: "The story and retell are in Spanish.",
  en: "The story and retell are in English.",
  fr: "The story and retell are in French.",
  de: "The story and retell are in German.",
  it: "The story and retell are in Italian.",
  pt: "The story and retell are in Portuguese.",
};

const retellSchema = z.object({
  retellText: z.string().trim().max(5000),
  keyFacts: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  language: z.string().optional(),
});

const ttsSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  language: z.string().optional(),
});

function normalizeGameLanguage(language: unknown): GameLanguage {
  return GAME_LANGUAGES.includes(language as GameLanguage) ? (language as GameLanguage) : "es";
}

function fallbackRetellScore(keyFacts: string[], error: string): RetellScore {
  const half = Math.floor(keyFacts.length / 2);
  return {
    covered: Array.from({ length: half }, (_, index) => index + 1),
    not_covered: Array.from({ length: keyFacts.length - half }, (_, index) => half + index + 1),
    covered_count: half,
    total_count: keyFacts.length,
    error,
  };
}

function normalizeIndexList(value: unknown, total: number): number[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<number>();

  value.forEach((entry) => {
    const index = Number(entry);
    if (Number.isInteger(index) && index >= 1 && index <= total) {
      unique.add(index);
    }
  });

  return [...unique].sort((a, b) => a - b);
}

function normalizeRetellScore(value: unknown, total: number): RetellScore {
  const raw = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const covered = normalizeIndexList(raw.covered, total);
  const notCoveredFromModel = normalizeIndexList(raw.not_covered, total).filter((index) => !covered.includes(index));
  const not_covered = notCoveredFromModel.length > 0
    ? notCoveredFromModel
    : Array.from({ length: total }, (_, index) => index + 1).filter((index) => !covered.includes(index));

  return {
    covered,
    not_covered,
    covered_count: covered.length,
    total_count: total,
    error: null,
  };
}

function buildRetellPrompt(retellText: string, keyFacts: string[], language: GameLanguage) {
  return `You are scoring a memory recall exercise for a senior adult.
${languageInstructions[language]}
The user read a short story and is now retelling it from memory.

Key facts from the story (${keyFacts.length} total):
${keyFacts.map((fact, index) => `${index + 1}. ${fact}`).join("\n")}

User's retell:
"${retellText}"

For each key fact, determine if the user's retell covers that fact,
even if expressed differently, partially, or in different words.
Be generous: if the core idea is present, count it as covered.

Respond only with a valid JSON object:
{
  "covered": [1, 3, 4],
  "not_covered": [2, 5, 6],
  "covered_count": 3,
  "total_count": 6
}`;
}

export async function scoreRetellHandler(req: Request, res: Response) {
  const parsed = retellSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid retell scoring request." });
  }

  const { retellText, keyFacts } = parsed.data;
  const language = normalizeGameLanguage(parsed.data.language);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    return res.json(fallbackRetellScore(keyFacts, "OpenAI API key is not configured."));
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 250,
      messages: [{ role: "user", content: buildRetellPrompt(retellText, keyFacts, language) }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    return res.json(normalizeRetellScore(JSON.parse(content), keyFacts.length));
  } catch (error) {
    console.error("[games] Retell scoring failed:", error);
    const message = error instanceof Error ? error.message : "OpenAI scoring failed.";
    return res.json(fallbackRetellScore(keyFacts, message));
  }
}

export async function ttsHandler(req: Request, res: Response) {
  const parsed = ttsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid TTS request." });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  const voiceId = process.env.ELEVENLABS_BRAIN_TTS_VOICE_ID ?? process.env.ELEVENLABS_VOICE_ID ?? "";
  if (!apiKey || !voiceId) {
    return res.status(503).json({ error: "ElevenLabs TTS is not configured." });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: parsed.data.text,
          model_id: ELEVENLABS_TTS_MODEL,
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true,
          },
          language_code: normalizeGameLanguage(parsed.data.language),
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn("[games] ElevenLabs TTS failed:", detail);
      return res.status(502).json({ error: "ElevenLabs TTS request failed." });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", response.headers.get("content-type") ?? "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.send(audio);
  } catch (error) {
    console.error("[games] ElevenLabs TTS error:", error);
    return res.status(502).json({ error: "ElevenLabs TTS request failed." });
  }
}

const router = Router();
router.post("/score-retell", scoreRetellHandler);
router.post("/tts", ttsHandler);

export default router;
