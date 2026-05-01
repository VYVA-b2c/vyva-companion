import type { Request, Response } from "express";
import { getSocialRoomBySlug } from "../lib/socialRoomsSeed.js";

const ROOM_AGENT_ENV_KEYS: Record<string, string[]> = {
  "garden-chat": [
    "ELEVENLABS_SOCIAL_GARDEN_CHAT_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_GARDEN_CHAT_AGENT_ID",
    "ELEVENLABS_GARDEN_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_ROSA",
    "ELEVENLABS_SOCIAL_AGENT_ROSA",
    "VITE_ELEVENLABS_AGENT_ROSA",
    "VITE_ELEVENLABS_SOCIAL_AGENT_ROSA",
  ],
  "chess-corner": [
    "ELEVENLABS_SOCIAL_CHESS_CORNER_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_CHESS_CORNER_AGENT_ID",
    "ELEVENLABS_CHESS_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_LORENZO",
    "ELEVENLABS_SOCIAL_AGENT_LORENZO",
    "VITE_ELEVENLABS_AGENT_LORENZO",
    "VITE_ELEVENLABS_SOCIAL_AGENT_LORENZO",
  ],
  "creative-studio": [
    "ELEVENLABS_SOCIAL_CREATIVE_STUDIO_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_CREATIVE_STUDIO_AGENT_ID",
    "ELEVENLABS_CREATIVE_SOCIAL_AGENT_ID",
    "ELEVENLABS_ART_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_CARMEN",
    "ELEVENLABS_SOCIAL_AGENT_CARMEN",
    "VITE_ELEVENLABS_AGENT_CARMEN",
    "VITE_ELEVENLABS_SOCIAL_AGENT_CARMEN",
  ],
  "music-salon": [
    "ELEVENLABS_SOCIAL_MUSIC_SALON_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_MUSIC_SALON_AGENT_ID",
    "ELEVENLABS_MUSIC_SOCIAL_AGENT_ID",
    "VITE_ELEVENLABS_MUSIC_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_CLARA",
    "ELEVENLABS_SOCIAL_AGENT_CLARA",
    "VITE_ELEVENLABS_AGENT_CLARA",
    "VITE_ELEVENLABS_SOCIAL_AGENT_CLARA",
  ],
  "book-club": [
    "ELEVENLABS_SOCIAL_BOOK_CLUB_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_BOOK_CLUB_AGENT_ID",
    "ELEVENLABS_BOOK_SOCIAL_AGENT_ID",
    "ELEVENLABS_LITERATURE_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_ISABEL",
    "ELEVENLABS_SOCIAL_AGENT_ISABEL",
    "VITE_ELEVENLABS_AGENT_ISABEL",
    "VITE_ELEVENLABS_SOCIAL_AGENT_ISABEL",
  ],
  "morning-circle": [
    "ELEVENLABS_SOCIAL_MORNING_CIRCLE_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_MORNING_CIRCLE_AGENT_ID",
    "ELEVENLABS_MORNING_SOCIAL_AGENT_ID",
  ],
  "memory-lane": [
    "ELEVENLABS_SOCIAL_MEMORY_LANE_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_MEMORY_LANE_AGENT_ID",
    "ELEVENLABS_MEMORY_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_SOFIA",
    "ELEVENLABS_SOCIAL_AGENT_SOFIA",
    "VITE_ELEVENLABS_AGENT_SOFIA",
    "VITE_ELEVENLABS_SOCIAL_AGENT_SOFIA",
  ],
  "evening-wind-down": [
    "ELEVENLABS_SOCIAL_EVENING_WIND_DOWN_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_EVENING_WIND_DOWN_AGENT_ID",
    "ELEVENLABS_BREATH_SOCIAL_AGENT_ID",
    "ELEVENLABS_MEDITATION_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_MARCO",
    "ELEVENLABS_SOCIAL_AGENT_MARCO",
    "VITE_ELEVENLABS_AGENT_MARCO",
    "VITE_ELEVENLABS_SOCIAL_AGENT_MARCO",
  ],
  "kitchen-table": [
    "ELEVENLABS_SOCIAL_KITCHEN_TABLE_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_KITCHEN_TABLE_AGENT_ID",
    "ELEVENLABS_KITCHEN_SOCIAL_AGENT_ID",
    "ELEVENLABS_COOKING_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_LOLA",
    "ELEVENLABS_SOCIAL_AGENT_LOLA",
    "VITE_ELEVENLABS_AGENT_LOLA",
    "VITE_ELEVENLABS_SOCIAL_AGENT_LOLA",
  ],
  "walking-club": [
    "ELEVENLABS_SOCIAL_WALKING_CLUB_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_WALKING_CLUB_AGENT_ID",
    "ELEVENLABS_WALK_SOCIAL_AGENT_ID",
    "ELEVENLABS_MOVEMENT_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_PEDRO",
    "ELEVENLABS_SOCIAL_AGENT_PEDRO",
    "VITE_ELEVENLABS_AGENT_PEDRO",
    "VITE_ELEVENLABS_SOCIAL_AGENT_PEDRO",
  ],
  "news-cafe": [
    "ELEVENLABS_SOCIAL_NEWS_CAFE_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_NEWS_CAFE_AGENT_ID",
    "ELEVENLABS_NEWS_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_ELENA",
    "ELEVENLABS_SOCIAL_AGENT_ELENA",
    "VITE_ELEVENLABS_AGENT_ELENA",
    "VITE_ELEVENLABS_SOCIAL_AGENT_ELENA",
  ],
  "pen-pals": [
    "ELEVENLABS_SOCIAL_PEN_PALS_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_PEN_PALS_AGENT_ID",
    "ELEVENLABS_PENPALS_SOCIAL_AGENT_ID",
    "ELEVENLABS_PEN_PALS_SOCIAL_AGENT_ID",
  ],
  "heritage-exchange": [
    "ELEVENLABS_SOCIAL_HERITAGE_EXCHANGE_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_HERITAGE_EXCHANGE_AGENT_ID",
    "ELEVENLABS_HERITAGE_SOCIAL_AGENT_ID",
  ],
};

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

const TOP_LEVEL_AGENT_ENV_KEYS: Record<string, string[]> = {
  vyva: ["ELEVENLABS_MAIN_VYVA_AGENT_ID", "ELEVENLABS_AGENT_VYVA", "ELEVENLABS_AGENT_ID"],
  "main-vyva": ["ELEVENLABS_MAIN_VYVA_AGENT_ID", "ELEVENLABS_AGENT_VYVA", "ELEVENLABS_AGENT_ID"],
  health: ["ELEVENLABS_HEALTH_ASSISTANT_AGENT_ID"],
  "health-assistant": ["ELEVENLABS_HEALTH_ASSISTANT_AGENT_ID"],
  concierge: ["ELEVENLABS_CONCIERGE_AGENT_ID"],
};

const DEFAULT_AGENT_ENV_KEYS = [
  "ELEVENLABS_SOCIAL_AGENT_ID",
  "ELEVENLABS_AGENT_ID",
  "VITE_ELEVENLABS_SOCIAL_AGENT_ID",
  "VITE_ELEVENLABS_AGENT_ID",
];

function readFirstEnv(keys: string[]) {
  for (const key of [...new Set(keys)]) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function normalizeSlug(value?: string) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || undefined;
}

function envSlug(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function buildRoomAgentKeys(roomSlug: string, agentSlug?: string) {
  const slugKey = envSlug(roomSlug);
  const keys = [
    ...(ROOM_AGENT_ENV_KEYS[roomSlug] ?? []),
    `ELEVENLABS_SOCIAL_${slugKey}_AGENT_ID`,
    `VITE_ELEVENLABS_SOCIAL_${slugKey}_AGENT_ID`,
  ];

  const roomHasExplicitLegacyKeys = (ROOM_AGENT_ENV_KEYS[roomSlug]?.length ?? 0) > 2;
  if (agentSlug && !roomHasExplicitLegacyKeys) {
    keys.push(...(SOCIAL_AGENT_ENV_KEYS[agentSlug] ?? []));
  }

  return [...new Set(keys)];
}

function resolveSocialAgentId(agentSlug?: string, roomSlug?: string) {
  const normalizedAgentSlug = normalizeSlug(agentSlug);
  const normalizedRoomSlug = normalizeSlug(roomSlug);
  const room = normalizedRoomSlug ? getSocialRoomBySlug(normalizedRoomSlug) : undefined;
  const roomAgentSlug = normalizeSlug(room?.agentSlug);

  if (normalizedRoomSlug) {
    const keys = buildRoomAgentKeys(normalizedRoomSlug, roomAgentSlug);
    return {
      agentId: readFirstEnv(keys),
      resolvedSlug: normalizedRoomSlug,
      source: "room",
      expectedKeys: keys,
      roomAgentSlug,
    };
  }

  const resolvedSlug = normalizedAgentSlug ?? roomAgentSlug;

  if (!resolvedSlug) {
    return {
      agentId: readFirstEnv(DEFAULT_AGENT_ENV_KEYS),
      resolvedSlug,
      source: "default",
      expectedKeys: DEFAULT_AGENT_ENV_KEYS,
    };
  }

  const keys = [
    ...(TOP_LEVEL_AGENT_ENV_KEYS[resolvedSlug] ?? []),
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
    expectedKeys: keys,
  };
}

export async function conversationTokenHandler(req: Request, res: Response) {
  const { agent_id, agent_slug, room_slug } = req.body as {
    agent_id?: string;
    agent_slug?: string;
    room_slug?: string;
  };

  const normalizedRoomSlug = normalizeSlug(room_slug);
  const explicitAgentId = agent_id?.trim();
  const resolved = normalizedRoomSlug
    ? resolveSocialAgentId(agent_slug, normalizedRoomSlug)
    : explicitAgentId
    ? { agentId: explicitAgentId, resolvedSlug: normalizeSlug(agent_slug), source: "explicit" }
    : resolveSocialAgentId(agent_slug, room_slug);

  if (!resolved.agentId) {
    console.warn("[conversationToken] No ElevenLabs agent configured", {
      agent_slug,
      room_slug,
      resolved_slug: resolved.resolvedSlug,
      source: resolved.source,
      expected_keys: resolved.expectedKeys?.slice(0, 6),
    });
    return res.status(400).json({
      error: "No ElevenLabs agent configured for this room yet.",
      room_slug,
      agent_slug,
      source: resolved.source,
      expected_keys: resolved.expectedKeys?.slice(0, 6),
    });
  }

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: "Missing ElevenLabs API key" });
  }

  try {
    return signedUrlNoOverride(resolved.agentId, ELEVENLABS_API_KEY, res, {
      agent_slug: resolved.resolvedSlug,
      room_slug: normalizedRoomSlug,
      source: resolved.source,
    });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}

async function signedUrlNoOverride(
  agent_id: string,
  apiKey: string,
  res: Response,
  metadata: Record<string, unknown> = {},
) {
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
  return res.json({ signed_url: data.signed_url, ...metadata });
}
