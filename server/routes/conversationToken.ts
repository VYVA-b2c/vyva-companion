import type { Request, Response } from "express";
import { getSocialRoomBySlug } from "../lib/socialRoomsSeed.js";

const SOCIAL_AGENT_ENV_KEYS: Record<string, string[]> = {
  rosa: ["ELEVENLABS_AGENT_ROSA", "ELEVENLABS_SOCIAL_AGENT_ROSA", "ELEVENLABS_GARDEN_SOCIAL_AGENT_ID", "VITE_ELEVENLABS_AGENT_ROSA", "VITE_ELEVENLABS_SOCIAL_AGENT_ROSA"],
  lorenzo: ["ELEVENLABS_AGENT_LORENZO", "ELEVENLABS_SOCIAL_AGENT_LORENZO", "ELEVENLABS_CHESS_SOCIAL_AGENT_ID", "VITE_ELEVENLABS_AGENT_LORENZO", "VITE_ELEVENLABS_SOCIAL_AGENT_LORENZO"],
  lola: ["ELEVENLABS_AGENT_LOLA", "ELEVENLABS_SOCIAL_AGENT_LOLA", "VITE_ELEVENLABS_AGENT_LOLA", "VITE_ELEVENLABS_SOCIAL_AGENT_LOLA"],
  sofia: ["ELEVENLABS_AGENT_SOFIA", "ELEVENLABS_SOCIAL_AGENT_SOFIA", "VITE_ELEVENLABS_AGENT_SOFIA", "VITE_ELEVENLABS_SOCIAL_AGENT_SOFIA"],
  pedro: ["ELEVENLABS_AGENT_PEDRO", "ELEVENLABS_SOCIAL_AGENT_PEDRO", "ELEVENLABS_WALK_SOCIAL_AGENT_ID", "ELEVENLABS_MOVEMENT_SOCIAL_AGENT_ID", "VITE_ELEVENLABS_AGENT_PEDRO", "VITE_ELEVENLABS_SOCIAL_AGENT_PEDRO"],
  marco: ["ELEVENLABS_AGENT_MARCO", "ELEVENLABS_SOCIAL_AGENT_MARCO", "ELEVENLABS_BREATH_SOCIAL_AGENT_ID", "ELEVENLABS_MEDITATION_SOCIAL_AGENT_ID", "VITE_ELEVENLABS_AGENT_MARCO", "VITE_ELEVENLABS_SOCIAL_AGENT_MARCO"],
  isabel: ["ELEVENLABS_AGENT_ISABEL", "ELEVENLABS_SOCIAL_AGENT_ISABEL", "ELEVENLABS_BOOK_SOCIAL_AGENT_ID", "ELEVENLABS_LITERATURE_SOCIAL_AGENT_ID", "VITE_ELEVENLABS_AGENT_ISABEL", "VITE_ELEVENLABS_SOCIAL_AGENT_ISABEL"],
  vyva: ["ELEVENLABS_AGENT_VYVA", "ELEVENLABS_SOCIAL_AGENT_VYVA", "ELEVENLABS_CONNECTION_SOCIAL_AGENT_ID", "ELEVENLABS_PENPALS_SOCIAL_AGENT_ID", "ELEVENLABS_HERITAGE_SOCIAL_AGENT_ID", "VITE_ELEVENLABS_AGENT_VYVA", "VITE_ELEVENLABS_SOCIAL_AGENT_VYVA", "ELEVENLABS_AGENT_ID", "VITE_ELEVENLABS_AGENT_ID"],
  carmen: ["ELEVENLABS_AGENT_CARMEN", "ELEVENLABS_SOCIAL_AGENT_CARMEN", "ELEVENLABS_ART_SOCIAL_AGENT_ID", "ELEVENLABS_CREATIVE_SOCIAL_AGENT_ID", "VITE_ELEVENLABS_AGENT_CARMEN", "VITE_ELEVENLABS_SOCIAL_AGENT_CARMEN"],
  elena: ["ELEVENLABS_AGENT_ELENA", "ELEVENLABS_SOCIAL_AGENT_ELENA", "ELEVENLABS_NEWS_SOCIAL_AGENT_ID", "VITE_ELEVENLABS_AGENT_ELENA", "VITE_ELEVENLABS_SOCIAL_AGENT_ELENA"],
  clara: ["ELEVENLABS_AGENT_CLARA", "ELEVENLABS_SOCIAL_AGENT_CLARA", "ELEVENLABS_MUSIC_SOCIAL_AGENT_ID", "VITE_ELEVENLABS_AGENT_CLARA", "VITE_ELEVENLABS_SOCIAL_AGENT_CLARA", "VITE_ELEVENLABS_MUSIC_SOCIAL_AGENT_ID"],
};

const DEFAULT_AGENT_ENV_KEYS = [
  "ELEVENLABS_SOCIAL_AGENT_ID",
  "ELEVENLABS_AGENT_ID",
  "VITE_ELEVENLABS_SOCIAL_AGENT_ID",
  "VITE_ELEVENLABS_AGENT_ID",
];

function readFirstEnv(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function normalizeSlug(value?: string) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || undefined;
}

function resolveSocialAgentId(agentSlug?: string, roomSlug?: string) {
  const normalizedAgentSlug = normalizeSlug(agentSlug);
  const normalizedRoomSlug = normalizeSlug(roomSlug);
  const roomAgentSlug = normalizedRoomSlug ? getSocialRoomBySlug(normalizedRoomSlug)?.agentSlug : undefined;
  const resolvedSlug = normalizedAgentSlug ?? normalizeSlug(roomAgentSlug);

  if (!resolvedSlug) {
    return {
      agentId: readFirstEnv(DEFAULT_AGENT_ENV_KEYS),
      resolvedSlug,
      source: "default",
    };
  }

  const keys = [
    ...(SOCIAL_AGENT_ENV_KEYS[resolvedSlug] ?? []),
    `ELEVENLABS_AGENT_${resolvedSlug.toUpperCase()}`,
    `ELEVENLABS_SOCIAL_AGENT_${resolvedSlug.toUpperCase()}`,
    `VITE_ELEVENLABS_AGENT_${resolvedSlug.toUpperCase()}`,
    `VITE_ELEVENLABS_SOCIAL_AGENT_${resolvedSlug.toUpperCase()}`,
    ...DEFAULT_AGENT_ENV_KEYS,
  ];

  return {
    agentId: readFirstEnv(keys),
    resolvedSlug,
    source: "slug",
  };
}

export async function conversationTokenHandler(req: Request, res: Response) {
  const { agent_id, agent_slug, room_slug, prompt_override } = req.body as {
    agent_id?: string;
    agent_slug?: string;
    room_slug?: string;
    prompt_override?: string;
  };

  const resolved = agent_id?.trim()
    ? { agentId: agent_id.trim(), resolvedSlug: normalizeSlug(agent_slug), source: "explicit" }
    : resolveSocialAgentId(agent_slug, room_slug);

  if (!resolved.agentId) {
    console.warn("[conversationToken] No ElevenLabs agent configured", {
      agent_slug,
      room_slug,
      resolved_slug: resolved.resolvedSlug,
    });
    return res.status(400).json({ error: "agent_id or configured agent_slug required" });
  }

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: "Missing ElevenLabs API key" });
  }

  try {
    if (prompt_override) {
      const resp = await fetch(
        "https://api.elevenlabs.io/v1/convai/conversation/get_signed_url",
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: resolved.agentId,
            overrides: { agent: { prompt: { prompt: prompt_override } } },
          }),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        console.warn("[conversationToken] signed URL with override failed:", errText);
        return signedUrlNoOverride(resolved.agentId, ELEVENLABS_API_KEY, res);
      }

      const data = (await resp.json()) as { signed_url?: string };
      return res.json({ signed_url: data.signed_url, agent_slug: resolved.resolvedSlug, source: resolved.source });
    }

    return signedUrlNoOverride(resolved.agentId, ELEVENLABS_API_KEY, res);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}

async function signedUrlNoOverride(agent_id: string, apiKey: string, res: Response) {
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agent_id)}`,
    { headers: { "xi-api-key": apiKey } }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    console.warn("[conversationToken] get_signed_url failed:", errText);
    return res.status(resp.status).json({ error: "ElevenLabs signed URL error", detail: errText });
  }

  const data = (await resp.json()) as { signed_url?: string };
  return res.json({ signed_url: data.signed_url });
}
