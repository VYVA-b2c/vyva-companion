import type { Request, Response } from "express";
import { getSocialRoomBySlug, resolveSocialRoomSlug } from "../lib/socialRoomsSeed.js";
import { isDrAiAgentSlug, resolveDrAiVoiceAccess } from "../lib/drAiVoiceFeature.js";

const ROOM_AGENT_ENV_KEYS: Record<string, string[]> = {
  "garden-corner": [
    "ELEVENLABS_SOCIAL_GARDEN_CORNER_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_GARDEN_CORNER_AGENT_ID",
    "ELEVENLABS_SOCIAL_GARDEN_CHAT_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_GARDEN_CHAT_AGENT_ID",
    "ELEVENLABS_GARDEN_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_ELENA_RUIZ",
    "ELEVENLABS_SOCIAL_AGENT_ELENA_RUIZ",
    "ELEVENLABS_AGENT_ROSA",
    "ELEVENLABS_SOCIAL_AGENT_ROSA",
  ],
  "games-room": [
    "ELEVENLABS_SOCIAL_GAMES_ROOM_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_GAMES_ROOM_AGENT_ID",
    "ELEVENLABS_SOCIAL_CHESS_CORNER_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_CHESS_CORNER_AGENT_ID",
    "ELEVENLABS_CHESS_SOCIAL_AGENT_ID",
    "ELEVENLABS_GAMES_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_VIKTOR_SANZ",
    "ELEVENLABS_SOCIAL_AGENT_VIKTOR_SANZ",
    "ELEVENLABS_AGENT_LORENZO",
    "ELEVENLABS_SOCIAL_AGENT_LORENZO",
  ],
  "music-room": [
    "ELEVENLABS_SOCIAL_MUSIC_ROOM_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_MUSIC_ROOM_AGENT_ID",
    "ELEVENLABS_SOCIAL_MUSIC_SALON_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_MUSIC_SALON_AGENT_ID",
    "ELEVENLABS_MUSIC_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_DIEGO_SALINAS",
    "ELEVENLABS_SOCIAL_AGENT_DIEGO_SALINAS",
    "ELEVENLABS_AGENT_CLARA",
    "ELEVENLABS_SOCIAL_AGENT_CLARA",
  ],
  "reading-room": [
    "ELEVENLABS_SOCIAL_READING_ROOM_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_READING_ROOM_AGENT_ID",
    "ELEVENLABS_SOCIAL_BOOK_CLUB_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_BOOK_CLUB_AGENT_ID",
    "ELEVENLABS_BOOK_SOCIAL_AGENT_ID",
    "ELEVENLABS_LITERATURE_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_ISABEL_FUENTES",
    "ELEVENLABS_SOCIAL_AGENT_ISABEL_FUENTES",
    "ELEVENLABS_AGENT_ISABEL",
    "ELEVENLABS_SOCIAL_AGENT_ISABEL",
  ],
  "morning-circle": [
    "ELEVENLABS_SOCIAL_MORNING_CIRCLE_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_MORNING_CIRCLE_AGENT_ID",
    "ELEVENLABS_MORNING_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_VYVA_MORNING",
    "ELEVENLABS_SOCIAL_AGENT_VYVA_MORNING",
  ],
  "memory-lane": [
    "ELEVENLABS_SOCIAL_MEMORY_LANE_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_MEMORY_LANE_AGENT_ID",
    "ELEVENLABS_MEMORY_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_SOFIA_MONTOYA",
    "ELEVENLABS_SOCIAL_AGENT_SOFIA_MONTOYA",
    "ELEVENLABS_AGENT_SOFIA",
    "ELEVENLABS_SOCIAL_AGENT_SOFIA",
  ],
  "evening-wind-down": [
    "ELEVENLABS_SOCIAL_EVENING_WIND_DOWN_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_EVENING_WIND_DOWN_AGENT_ID",
    "ELEVENLABS_BREATH_SOCIAL_AGENT_ID",
    "ELEVENLABS_MEDITATION_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_MARCO_REYES",
    "ELEVENLABS_SOCIAL_AGENT_MARCO_REYES",
    "ELEVENLABS_AGENT_MARCO",
    "ELEVENLABS_SOCIAL_AGENT_MARCO",
  ],
  "kitchen-table": [
    "ELEVENLABS_SOCIAL_KITCHEN_TABLE_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_KITCHEN_TABLE_AGENT_ID",
    "ELEVENLABS_KITCHEN_SOCIAL_AGENT_ID",
    "ELEVENLABS_COOKING_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_LOLA_MARTINEZ",
    "ELEVENLABS_SOCIAL_AGENT_LOLA_MARTINEZ",
    "ELEVENLABS_AGENT_LOLA",
    "ELEVENLABS_SOCIAL_AGENT_LOLA",
  ],
  "morning-movement": [
    "ELEVENLABS_SOCIAL_MORNING_MOVEMENT_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_MORNING_MOVEMENT_AGENT_ID",
    "ELEVENLABS_MOVEMENT_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_AMARA_OSEI",
    "ELEVENLABS_SOCIAL_AGENT_AMARA_OSEI",
  ],
  "walking-companion": [
    "ELEVENLABS_SOCIAL_WALKING_COMPANION_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_WALKING_COMPANION_AGENT_ID",
    "ELEVENLABS_SOCIAL_WALKING_CLUB_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_WALKING_CLUB_AGENT_ID",
    "ELEVENLABS_WALK_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_CAMINO",
    "ELEVENLABS_SOCIAL_AGENT_CAMINO",
    "ELEVENLABS_AGENT_PEDRO",
    "ELEVENLABS_SOCIAL_AGENT_PEDRO",
  ],
  "news-world-affairs": [
    "ELEVENLABS_SOCIAL_NEWS_WORLD_AFFAIRS_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_NEWS_WORLD_AFFAIRS_AGENT_ID",
    "ELEVENLABS_SOCIAL_NEWS_CAFE_AGENT_ID",
    "VITE_ELEVENLABS_SOCIAL_NEWS_CAFE_AGENT_ID",
    "ELEVENLABS_NEWS_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_ANA_SERRANO",
    "ELEVENLABS_SOCIAL_AGENT_ANA_SERRANO",
    "ELEVENLABS_AGENT_ELENA",
    "ELEVENLABS_SOCIAL_AGENT_ELENA",
  ],
};

const SOCIAL_AGENT_ENV_KEYS: Record<string, string[]> = {
  "elena-ruiz": ["ELEVENLABS_AGENT_ELENA_RUIZ", "ELEVENLABS_SOCIAL_AGENT_ELENA_RUIZ", "ELEVENLABS_SOCIAL_GARDEN_CORNER_AGENT_ID", "ELEVENLABS_SOCIAL_GARDEN_CHAT_AGENT_ID", "ELEVENLABS_GARDEN_SOCIAL_AGENT_ID"],
  "viktor-sanz": ["ELEVENLABS_AGENT_VIKTOR_SANZ", "ELEVENLABS_SOCIAL_AGENT_VIKTOR_SANZ", "ELEVENLABS_SOCIAL_GAMES_ROOM_AGENT_ID", "ELEVENLABS_SOCIAL_CHESS_CORNER_AGENT_ID", "ELEVENLABS_CHESS_SOCIAL_AGENT_ID"],
  "lola-martinez": ["ELEVENLABS_AGENT_LOLA_MARTINEZ", "ELEVENLABS_SOCIAL_AGENT_LOLA_MARTINEZ", "ELEVENLABS_SOCIAL_KITCHEN_TABLE_AGENT_ID", "ELEVENLABS_AGENT_LOLA", "ELEVENLABS_SOCIAL_AGENT_LOLA"],
  "amara-osei": ["ELEVENLABS_AGENT_AMARA_OSEI", "ELEVENLABS_SOCIAL_AGENT_AMARA_OSEI", "ELEVENLABS_SOCIAL_MORNING_MOVEMENT_AGENT_ID", "ELEVENLABS_MOVEMENT_SOCIAL_AGENT_ID"],
  amara: ["ELEVENLABS_AGENT_AMARA_OSEI", "ELEVENLABS_SOCIAL_AGENT_AMARA_OSEI", "ELEVENLABS_SOCIAL_MORNING_MOVEMENT_AGENT_ID", "ELEVENLABS_MOVEMENT_SOCIAL_AGENT_ID"],
  "marco-reyes": ["ELEVENLABS_AGENT_MARCO_REYES", "ELEVENLABS_SOCIAL_AGENT_MARCO_REYES", "ELEVENLABS_SOCIAL_EVENING_WIND_DOWN_AGENT_ID", "ELEVENLABS_AGENT_MARCO", "ELEVENLABS_SOCIAL_AGENT_MARCO"],
  "diego-salinas": ["ELEVENLABS_AGENT_DIEGO_SALINAS", "ELEVENLABS_SOCIAL_AGENT_DIEGO_SALINAS", "ELEVENLABS_SOCIAL_MUSIC_ROOM_AGENT_ID", "ELEVENLABS_SOCIAL_MUSIC_SALON_AGENT_ID", "ELEVENLABS_MUSIC_SOCIAL_AGENT_ID"],
  "isabel-fuentes": ["ELEVENLABS_AGENT_ISABEL_FUENTES", "ELEVENLABS_SOCIAL_AGENT_ISABEL_FUENTES", "ELEVENLABS_SOCIAL_READING_ROOM_AGENT_ID", "ELEVENLABS_SOCIAL_BOOK_CLUB_AGENT_ID", "ELEVENLABS_AGENT_ISABEL", "ELEVENLABS_SOCIAL_AGENT_ISABEL"],
  "sofia-montoya": ["ELEVENLABS_AGENT_SOFIA_MONTOYA", "ELEVENLABS_SOCIAL_AGENT_SOFIA_MONTOYA", "ELEVENLABS_SOCIAL_MEMORY_LANE_AGENT_ID", "ELEVENLABS_AGENT_SOFIA", "ELEVENLABS_SOCIAL_AGENT_SOFIA"],
  "vyva-morning": ["ELEVENLABS_AGENT_VYVA_MORNING", "ELEVENLABS_SOCIAL_AGENT_VYVA_MORNING", "ELEVENLABS_SOCIAL_MORNING_CIRCLE_AGENT_ID", "ELEVENLABS_MAIN_VYVA_AGENT_ID", "ELEVENLABS_AGENT_VYVA"],
  "ana-serrano": ["ELEVENLABS_AGENT_ANA_SERRANO", "ELEVENLABS_SOCIAL_AGENT_ANA_SERRANO", "ELEVENLABS_SOCIAL_NEWS_WORLD_AFFAIRS_AGENT_ID", "ELEVENLABS_SOCIAL_NEWS_CAFE_AGENT_ID", "ELEVENLABS_NEWS_SOCIAL_AGENT_ID"],
  camino: ["ELEVENLABS_AGENT_CAMINO", "ELEVENLABS_SOCIAL_AGENT_CAMINO", "ELEVENLABS_SOCIAL_WALKING_COMPANION_AGENT_ID", "ELEVENLABS_SOCIAL_WALKING_CLUB_AGENT_ID", "ELEVENLABS_WALK_SOCIAL_AGENT_ID"],
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
  vyva: [
    "ELEVENLABS_MAIN_VYVA_AGENT_ID",
    "ELEVENLABS_COMPANION_AGENT_ID",
    "ELEVENLABS_AGENT_VYVA",
    "ELEVENLABS_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_ID",
  ],
  "main-vyva": [
    "ELEVENLABS_MAIN_VYVA_AGENT_ID",
    "ELEVENLABS_COMPANION_AGENT_ID",
    "ELEVENLABS_AGENT_VYVA",
    "ELEVENLABS_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_ID",
  ],
  main_vyva: [
    "ELEVENLABS_MAIN_VYVA_AGENT_ID",
    "ELEVENLABS_COMPANION_AGENT_ID",
    "ELEVENLABS_AGENT_VYVA",
    "ELEVENLABS_SOCIAL_AGENT_ID",
    "ELEVENLABS_AGENT_ID",
  ],
  health: ["ELEVENLABS_HEALTH_ASSISTANT_AGENT_ID", "ELEVENLABS_HEALTH_AGENT_ID"],
  "health-assistant": ["ELEVENLABS_HEALTH_ASSISTANT_AGENT_ID", "ELEVENLABS_HEALTH_AGENT_ID"],
  "dr-ai": ["ELEVENLABS_DR_AI_AGENT_ID"],
  "ask-dr-ai": ["ELEVENLABS_DR_AI_AGENT_ID"],
  doctor: ["ELEVENLABS_DOCTOR_AGENT_ID", "ELEVENLABS_MEDICAL_DOCTOR_AGENT_ID", "ELEVENLABS_HEALTH_DOCTOR_AGENT_ID"],
  "medical-doctor": ["ELEVENLABS_DOCTOR_AGENT_ID", "ELEVENLABS_MEDICAL_DOCTOR_AGENT_ID", "ELEVENLABS_HEALTH_DOCTOR_AGENT_ID"],
  meds: ["ELEVENLABS_MEDS_AGENT_ID", "ELEVENLABS_MEDICATION_AGENT_ID", "ELEVENLABS_MEDICATIONS_AGENT_ID"],
  medication: ["ELEVENLABS_MEDICATION_AGENT_ID", "ELEVENLABS_MEDS_AGENT_ID", "ELEVENLABS_MEDICATIONS_AGENT_ID"],
  medications: ["ELEVENLABS_MEDICATIONS_AGENT_ID", "ELEVENLABS_MEDS_AGENT_ID", "ELEVENLABS_MEDICATION_AGENT_ID"],
  safety: ["ELEVENLABS_SAFETY_AGENT_ID", "ELEVENLABS_SAFE_HOME_AGENT_ID", "ELEVENLABS_SOS_AGENT_ID"],
  concierge: ["ELEVENLABS_CONCIERGE_AGENT_ID"],
  "brain-coach": ["ELEVENLABS_BRAIN_COACH_AGENT_ID", "ELEVENLABS_BRAIN_AGENT_ID", "ELEVENLABS_ACTIVITIES_AGENT_ID"],
  brain_coach: ["ELEVENLABS_BRAIN_COACH_AGENT_ID", "ELEVENLABS_BRAIN_AGENT_ID", "ELEVENLABS_ACTIVITIES_AGENT_ID"],
  "breathing-meditation": ["ELEVENLABS_MEDITATION_AGENT_ID", "ELEVENLABS_BREATHING_MEDITATION_AGENT_ID", "ELEVENLABS_BREATHING_AGENT_ID"],
  meditation: ["ELEVENLABS_MEDITATION_AGENT_ID", "ELEVENLABS_BREATHING_MEDITATION_AGENT_ID", "ELEVENLABS_BREATHING_AGENT_ID"],
  breathing: ["ELEVENLABS_MEDITATION_AGENT_ID", "ELEVENLABS_BREATHING_MEDITATION_AGENT_ID", "ELEVENLABS_BREATHING_AGENT_ID"],
  companion: ["ELEVENLABS_COMPANION_AGENT_ID", "ELEVENLABS_SOCIAL_AGENT_ID", "ELEVENLABS_AGENT_VYVA"],
  ines: ["ELEVENLABS_AGENT_INES", "ELEVENLABS_BENEFITS_AGENT_ID"],
  "onboarding-profile": [
    "ELEVENLABS_ONBOARDING_PROFILE_AGENT_ID",
    "ELEVENLABS_PROFILE_ONBOARDING_AGENT_ID",
    "ELEVENLABS_ONBOARDING_AGENT_ID",
    "VITE_ELEVENLABS_ONBOARDING_PROFILE_AGENT_ID",
  ],
  "login-guide": [
    "ELEVENLABS_LOGIN_GUIDE_AGENT_ID",
    "VITE_ELEVENLABS_LOGIN_GUIDE_AGENT_ID",
    "ELEVENLABS_ONBOARDING_GUIDE_AGENT_ID",
    "ELEVENLABS_MAIN_VYVA_AGENT_ID",
    "ELEVENLABS_AGENT_VYVA",
    "ELEVENLABS_AGENT_ID",
  ],
};

const FIXED_AGENT_IDS: Record<string, string> = {
  doctor: "agent_9201knfm6ep0fpp958kdyt0hev1b",
  "medical-doctor": "agent_9201knfm6ep0fpp958kdyt0hev1b",
};

const DEFAULT_AGENT_ENV_KEYS = [
  "ELEVENLABS_COMPANION_AGENT_ID",
  "ELEVENLABS_SOCIAL_AGENT_ID",
  "ELEVENLABS_AGENT_ID",
  "VITE_ELEVENLABS_COMPANION_AGENT_ID",
  "VITE_ELEVENLABS_SOCIAL_AGENT_ID",
  "VITE_ELEVENLABS_AGENT_ID",
];

const DEDICATED_AGENT_SLUGS = new Set(["dr-ai", "ask-dr-ai", "breathing-meditation", "meditation", "breathing"]);

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

function readElevenLabsApiKey() {
  return process.env.ELEVENLABS_API_KEY ||
    process.env.VITE_ELEVENLABS_API_KEY ||
    process.env.ELEVENLABS_CONVAI_API_KEY;
}

function buildRoomAgentKeys(roomSlug: string, agentSlug?: string) {
  const canonicalRoomSlug = resolveSocialRoomSlug(roomSlug);
  const slugKey = envSlug(canonicalRoomSlug);
  const keys = [
    ...(ROOM_AGENT_ENV_KEYS[canonicalRoomSlug] ?? []),
    `ELEVENLABS_SOCIAL_${slugKey}_AGENT_ID`,
    `VITE_ELEVENLABS_SOCIAL_${slugKey}_AGENT_ID`,
  ];

  const roomHasExplicitLegacyKeys = (ROOM_AGENT_ENV_KEYS[canonicalRoomSlug]?.length ?? 0) > 2;
  if (agentSlug && !roomHasExplicitLegacyKeys) {
    keys.push(...(SOCIAL_AGENT_ENV_KEYS[agentSlug] ?? []));
  }

  return [...new Set(keys)];
}

export function resolveSocialAgentId(agentSlug?: string, roomSlug?: string) {
  const normalizedAgentSlug = normalizeSlug(agentSlug);
  const normalizedRoomSlug = normalizeSlug(roomSlug);
  const canonicalRoomSlug = normalizedRoomSlug ? resolveSocialRoomSlug(normalizedRoomSlug) : undefined;
  const room = normalizedRoomSlug ? getSocialRoomBySlug(normalizedRoomSlug) : undefined;
  const roomAgentSlug = normalizeSlug(room?.agentSlug);

  if (canonicalRoomSlug) {
    const keys = buildRoomAgentKeys(canonicalRoomSlug, roomAgentSlug);
    return {
      agentId: readFirstEnv(keys),
      resolvedSlug: canonicalRoomSlug,
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

  const fixedAgentId = FIXED_AGENT_IDS[resolvedSlug];
  const slugKey = envSlug(resolvedSlug);
  const explicitSlugKeys = [
    ...(TOP_LEVEL_AGENT_ENV_KEYS[resolvedSlug] ?? []),
    ...(SOCIAL_AGENT_ENV_KEYS[resolvedSlug] ?? []),
    `ELEVENLABS_AGENT_${slugKey}`,
    `ELEVENLABS_SOCIAL_AGENT_${slugKey}`,
    `VITE_ELEVENLABS_AGENT_${slugKey}`,
    `VITE_ELEVENLABS_SOCIAL_AGENT_${slugKey}`,
  ];
  const keys = fixedAgentId || DEDICATED_AGENT_SLUGS.has(resolvedSlug)
    ? explicitSlugKeys
    : [...explicitSlugKeys, ...DEFAULT_AGENT_ENV_KEYS];

  return {
    agentId: fixedAgentId ?? readFirstEnv(keys),
    resolvedSlug,
    source: fixedAgentId ? "fixed-slug" : "slug",
    expectedKeys: keys,
  };
}

function sendDrAiDisabledResponse(req: Request, res: Response, resolvedSlug?: string) {
  if (!isDrAiAgentSlug(resolvedSlug)) return false;
  const access = resolveDrAiVoiceAccess({ userId: req.user?.id, env: process.env });
  if (access.enabled) return false;
  res.status(403).json({
    error: "Dr. AI voice is not enabled for this account.",
    code: "DR_AI_VOICE_NOT_ENABLED",
    mode: access.mode,
  });
  return true;
}

function resolveConversationAgent(body: {
  agent_id?: string;
  agent_slug?: string;
  room_slug?: string;
}) {
  const { agent_id, agent_slug, room_slug } = body;
  const normalizedRoomSlug = normalizeSlug(room_slug);
  const explicitAgentId = agent_id?.trim();
  const resolved = normalizedRoomSlug
    ? resolveSocialAgentId(agent_slug, normalizedRoomSlug)
    : explicitAgentId
    ? { agentId: explicitAgentId, resolvedSlug: normalizeSlug(agent_slug), source: "explicit" }
    : resolveSocialAgentId(agent_slug, room_slug);

  return {
    agentSlug: agent_slug,
    roomSlug: room_slug,
    normalizedRoomSlug,
    resolved,
  };
}

function sendMissingAgentResponse(
  res: Response,
  input: {
    agentSlug?: string;
    roomSlug?: string;
    resolved: ReturnType<typeof resolveSocialAgentId> | { agentId?: string; resolvedSlug?: string; source: string; expectedKeys?: string[] };
  },
) {
  console.warn("[conversationToken] No ElevenLabs agent configured", {
    agent_slug: input.agentSlug,
    room_slug: input.roomSlug,
    resolved_slug: input.resolved.resolvedSlug,
    source: input.resolved.source,
    expected_keys: input.resolved.expectedKeys?.slice(0, 6),
  });
  return res.status(400).json({
    error: "No ElevenLabs agent configured for this room yet.",
    code: "ELEVENLABS_AGENT_MISSING",
    room_slug: input.roomSlug,
    agent_slug: input.agentSlug,
    source: input.resolved.source,
    agent_id_present: false,
    expected_keys: input.resolved.expectedKeys?.slice(0, 6),
  });
}

export async function conversationReadinessHandler(req: Request, res: Response) {
  const { agentSlug, roomSlug, normalizedRoomSlug, resolved } = resolveConversationAgent(req.body as {
    agent_id?: string;
    agent_slug?: string;
    room_slug?: string;
  });

  if (sendDrAiDisabledResponse(req, res, resolved.resolvedSlug)) return;

  if (!resolved.agentId) {
    return sendMissingAgentResponse(res, { agentSlug, roomSlug, resolved });
  }

  if (!readElevenLabsApiKey()) {
    return res.status(500).json({
      error: "Missing ElevenLabs API key",
      code: "ELEVENLABS_API_KEY_MISSING",
      agent_slug: resolved.resolvedSlug,
      room_slug: normalizedRoomSlug,
      source: resolved.source,
      agent_id_present: true,
    });
  }

  return res.json({
    ready: true,
    agent_slug: resolved.resolvedSlug,
    room_slug: normalizedRoomSlug,
    source: resolved.source,
    agent_id_present: true,
  });
}

export async function conversationTokenHandler(req: Request, res: Response) {
  const { agent_id, agent_slug, room_slug } = req.body as {
    agent_id?: string;
    agent_slug?: string;
    room_slug?: string;
  };

  const { normalizedRoomSlug, resolved } = resolveConversationAgent({ agent_id, agent_slug, room_slug });

  if (sendDrAiDisabledResponse(req, res, resolved.resolvedSlug)) return;

  if (!resolved.agentId) {
    return sendMissingAgentResponse(res, { agentSlug: agent_slug, roomSlug: room_slug, resolved });
  }

  const ELEVENLABS_API_KEY = readElevenLabsApiKey();
  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({
      error: "Missing ElevenLabs API key",
      code: "ELEVENLABS_API_KEY_MISSING",
    });
  }

  try {
    return await signedUrlNoOverride(resolved.agentId, ELEVENLABS_API_KEY, res, {
      agent_slug: resolved.resolvedSlug,
      room_slug: normalizedRoomSlug,
      source: resolved.source,
    });
  } catch (e) {
    return res.status(500).json({
      error: (e as Error).message,
      code: "ELEVENLABS_TOKEN_ERROR",
    });
  }
}

async function signedUrlNoOverride(
  agent_id: string,
  apiKey: string,
  res: Response,
  metadata: Record<string, unknown> = {},
) {
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agent_id)}`,
    { headers: { "xi-api-key": apiKey } }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    console.warn("[conversationToken] get_signed_url failed:", errText);
    return res.status(resp.status).json({
      error: "ElevenLabs signed URL error",
      code: "ELEVENLABS_SIGNED_URL_ERROR",
      detail: errText,
    });
  }

  const data = (await resp.json()) as { signed_url?: string };
  if (!data.signed_url) {
    console.warn("[conversationToken] get_signed_url response missing signed_url", metadata);
    return res.status(502).json({
      error: "ElevenLabs signed URL response was empty",
      code: "ELEVENLABS_TOKEN_ERROR",
    });
  }

  return res.json({ signed_url: data.signed_url, ...metadata });
}
