import { randomUUID } from "crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import { and, eq, inArray, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import {
  companionProfiles,
  profiles,
  socialConnections,
  socialRoomSessions,
  socialRoomVisits,
  socialRooms,
  socialUserInterests,
} from "../../shared/schema.js";
import {
  buildDailyRoomSession,
  getSocialRoomBySlug,
  getTimeSlotFromDate,
  localizeRoom,
  resolveSocialRoomSlug,
  socialRoomSeeds,
} from "../lib/socialRoomsSeed.js";

type SocialLanguage = "es" | "de" | "en";

type InterestSnapshot = {
  interestTags: string[];
  preferredTimes: string[];
  activityLevel: "low" | "moderate" | "active";
  roomVisitCounts: Record<string, number>;
  lastRooms: string[];
};

const router = Router();
const IS_PROD = process.env.NODE_ENV === "production";
const DEMO_USER_ID = "demo-user";
const visitSessionMemory = new Map<string, { userId: string; roomSlug: string; enteredAt: number }>();
const memoryInterests = new Map<string, InterestSnapshot>();
const memoryConnections = new Map<string, { matchedUserId: string; matchedViaRoom: string; matchedAt: string }>();
const memoryRoomOccupancy = new Map<string, number>();
const memberCatalog = [
  { id: "member-ana", name: "Ana", topics: ["plantas", "cocina", "paseos"] },
  { id: "member-jose", name: "José", topics: ["ajedrez", "noticias", "lectura"] },
  { id: "member-elena", name: "Elena", topics: ["recetas", "flores", "rutinas"] },
  { id: "member-carmen", name: "Carmen", topics: ["arte", "historias", "memorias"] },
  { id: "member-luis", name: "Luis", topics: ["caminar", "jardín", "cultura"] },
  { id: "member-maria", name: "María", topics: ["libros", "meditación", "plantas"] },
];

const messageSchema = z.object({
  message: z.string().trim().min(1).max(320),
  lang: z.string().optional(),
  visitId: z.string().optional(),
});

const roomActionSchema = z.object({
  lang: z.string().optional(),
  visitId: z.string().optional(),
  completed: z.boolean().optional(),
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60).optional(),
});

function resolveUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  if (!IS_PROD) return DEMO_USER_ID;
  return null;
}

function resolvePublicUserId(req: Request): string {
  return req.user?.id ?? DEMO_USER_ID;
}

function normalizeLanguage(raw?: string | null): SocialLanguage {
  if (!raw) return "es";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("en")) return "en";
  return "es";
}

function buildConnectionKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

function getDeterministicParticipantCount(slug: string) {
  const seed = slug.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (seed % 5) + 3;
}

function getRoomParticipantCount(slug: string) {
  return getDeterministicParticipantCount(slug) + (memoryRoomOccupancy.get(slug) ?? 0);
}

async function safeDb<T>(label: string, action: () => Promise<T>, fallback: () => Promise<T> | T): Promise<T> {
  try {
    return await action();
  } catch (error) {
    console.warn(`[social] ${label} fallback`, error);
    return await fallback();
  }
}

async function loadProfileSummary(userId: string) {
  return safeDb(
    "profile summary",
    async () => {
      const [row] = await db
        .select({
          language: profiles.language,
          preferred_name: profiles.preferred_name,
          full_name: profiles.full_name,
          discoverable: profiles.discoverable,
        })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      const firstName =
        row?.preferred_name?.trim() ||
        row?.full_name?.trim().split(/\s+/).filter(Boolean)[0] ||
        "amiga";

      return {
        firstName,
        language: normalizeLanguage(row?.language ?? "es"),
        discoverable: row?.discoverable ?? false,
      };
    },
    () => ({
      firstName: "amiga",
      language: "es" as SocialLanguage,
      discoverable: false,
    }),
  );
}

async function loadUserInterestSnapshot(userId: string): Promise<InterestSnapshot> {
  const fallback = memoryInterests.get(userId);
  if (fallback) return fallback;

  return safeDb(
    "interest snapshot",
    async () => {
      const [socialRow] = await db
        .select()
        .from(socialUserInterests)
        .where(eq(socialUserInterests.user_id, userId))
        .limit(1);

      if (socialRow) {
        return {
          interestTags: socialRow.interest_tags,
          preferredTimes: socialRow.preferred_times,
          activityLevel: (socialRow.activity_level as InterestSnapshot["activityLevel"]) ?? "moderate",
          roomVisitCounts: (socialRow.room_visit_counts as Record<string, number>) ?? {},
          lastRooms: socialRow.last_rooms ?? [],
        };
      }

      const [companionRow] = await db
        .select({
          interests: companionProfiles.interests,
          preferredActivities: companionProfiles.preferred_activities,
        })
        .from(companionProfiles)
        .where(eq(companionProfiles.user_id, userId))
        .limit(1);

      return {
        interestTags: companionRow?.interests ?? [],
        preferredTimes: [],
        activityLevel:
          (companionRow?.preferredActivities?.includes("walk_together") ? "active" : "moderate") as InterestSnapshot["activityLevel"],
        roomVisitCounts: {},
        lastRooms: [],
      };
    },
    () => ({
      interestTags: [],
      preferredTimes: [],
      activityLevel: "moderate",
      roomVisitCounts: {},
      lastRooms: [],
    }),
  );
}

async function persistInterestSnapshot(userId: string, snapshot: InterestSnapshot) {
  memoryInterests.set(userId, snapshot);

  await safeDb(
    "persist interests",
    async () => {
      await db
        .insert(socialUserInterests)
        .values({
          user_id: userId,
          interest_tags: snapshot.interestTags,
          preferred_times: snapshot.preferredTimes,
          activity_level: snapshot.activityLevel,
          room_visit_counts: snapshot.roomVisitCounts,
          last_rooms: snapshot.lastRooms,
        })
        .onConflictDoUpdate({
          target: socialUserInterests.user_id,
          set: {
            interest_tags: snapshot.interestTags,
            preferred_times: snapshot.preferredTimes,
            activity_level: snapshot.activityLevel,
            room_visit_counts: snapshot.roomVisitCounts,
            last_rooms: snapshot.lastRooms,
            updated_at: new Date(),
          },
        });
    },
    async () => undefined,
  );
}

async function ensureRoomRecords(slug: string) {
  const roomSeed = getSocialRoomBySlug(slug);
  if (!roomSeed) return null;

  return safeDb(
    "ensure room/session",
    async () => {
      const [roomRow] = await db
        .insert(socialRooms)
        .values({
          slug: roomSeed.slug,
          name_es: roomSeed.names.es,
          name_de: roomSeed.names.de,
          name_en: roomSeed.names.en,
          category: roomSeed.category,
          agent_slug: roomSeed.agentSlug,
          agent_full_name: roomSeed.agentFullName,
          agent_colour: roomSeed.agentColour,
          agent_cred_es: roomSeed.agentCredential.es,
          agent_cred_de: roomSeed.agentCredential.de,
          agent_cred_en: roomSeed.agentCredential.en,
          cta_label_es: roomSeed.ctaLabel.es,
          cta_label_de: roomSeed.ctaLabel.de,
          cta_label_en: roomSeed.ctaLabel.en,
          topic_tags: roomSeed.topicTags,
          time_slots: roomSeed.timeSlots,
          is_active: true,
        })
        .onConflictDoUpdate({
          target: socialRooms.slug,
          set: {
            name_es: roomSeed.names.es,
            name_de: roomSeed.names.de,
            name_en: roomSeed.names.en,
            category: roomSeed.category,
            agent_slug: roomSeed.agentSlug,
            agent_full_name: roomSeed.agentFullName,
            agent_colour: roomSeed.agentColour,
            agent_cred_es: roomSeed.agentCredential.es,
            agent_cred_de: roomSeed.agentCredential.de,
            agent_cred_en: roomSeed.agentCredential.en,
            cta_label_es: roomSeed.ctaLabel.es,
            cta_label_de: roomSeed.ctaLabel.de,
            cta_label_en: roomSeed.ctaLabel.en,
            topic_tags: roomSeed.topicTags,
            time_slots: roomSeed.timeSlots,
            is_active: true,
          },
        })
        .returning();

      const today = new Date();
      const sessionDate = today.toISOString().slice(0, 10);
      const daily = {
        es: buildDailyRoomSession(roomSeed, "es", today),
        de: buildDailyRoomSession(roomSeed, "de", today),
        en: buildDailyRoomSession(roomSeed, "en", today),
      };

      const [sessionRow] = await db
        .insert(socialRoomSessions)
        .values({
          room_id: roomRow.id,
          session_date: sessionDate,
          topic_es: daily.es.topic,
          topic_de: daily.de.topic,
          topic_en: daily.en.topic,
          opener_es: daily.es.opener,
          opener_de: daily.de.opener,
          opener_en: daily.en.opener,
          activity_type: daily.es.activityType,
          participant_count: getRoomParticipantCount(slug),
          is_live: true,
        })
        .onConflictDoUpdate({
          target: [socialRoomSessions.room_id, socialRoomSessions.session_date],
          set: {
            topic_es: daily.es.topic,
            topic_de: daily.de.topic,
            topic_en: daily.en.topic,
            opener_es: daily.es.opener,
            opener_de: daily.de.opener,
            opener_en: daily.en.opener,
            activity_type: daily.es.activityType,
            participant_count: getRoomParticipantCount(slug),
            is_live: true,
          },
        })
        .returning();

      return { roomId: roomRow.id, sessionId: sessionRow.id };
    },
    () => null,
  );
}

function buildRoomPayload(slug: string, language: SocialLanguage) {
  const seed = getSocialRoomBySlug(slug);
  if (!seed) return null;

  const room = localizeRoom(seed, language);
  const session = buildDailyRoomSession(seed, language);
  const participantCount = getRoomParticipantCount(slug);

  return {
    ...room,
    participantCount,
    sessionDate: session.sessionDate,
    topic: session.topic,
    opener: session.opener,
    quote: session.quote,
    activityType: session.activityType,
    contentTag: session.contentTag,
    contentTitle: session.contentTitle,
    contentBody: session.contentBody,
    options: session.options,
  };
}

function scoreRoom(
  slug: string,
  userInterests: InterestSnapshot,
  participantCount: number,
  timeSlot: string,
) {
  const seed = getSocialRoomBySlug(slug);
  if (!seed) return 0;

  let score = 0;
  if (seed.timeSlots.includes(timeSlot)) score += 30;

  const overlap = seed.topicTags.filter((tag) => userInterests.interestTags.includes(tag));
  score += overlap.length * 20;
  score += Math.min(participantCount * 5, 25);

  if (!userInterests.lastRooms.includes(slug)) score += 15;
  if (seed.featured) score += 10;

  return score;
}

function toLiveBadge(language: SocialLanguage, participantCount: number) {
  if (participantCount <= 0) {
    return language === "de"
      ? "Sala preparada"
      : language === "en"
        ? "Room ready"
        : "Sala preparada";
  }

  if (language === "de") return `${participantCount} im Raum`;
  if (language === "en") return `${participantCount} in the room`;
  return `${participantCount} en la sala`;
}

function buildAgentReply(slug: string, language: SocialLanguage, userMessage: string) {
  const canonicalSlug = resolveSocialRoomSlug(slug);
  const lowered = userMessage.toLowerCase();
  const quotedPrompt = language === "de"
    ? "Magst du mir noch ein kleines Detail dazu erzählen?"
    : language === "en"
      ? "Would you tell me one small detail about that?"
      : "¿Me cuentas un pequeño detalle más?";

  if (canonicalSlug === "garden-corner") {
    return language === "de"
      ? `Das klingt liebevoll gepflegt. ${quotedPrompt}`
      : language === "en"
        ? `That sounds lovingly cared for. ${quotedPrompt}`
        : `Suena muy bien cuidado. ${quotedPrompt}`;
  }

  if (canonicalSlug === "games-room") {
    return language === "de"
      ? `Sehr guter Blick. Im Schach zählt Ruhe oft mehr als Eile. Was war dein erster Gedanke?`
      : language === "en"
        ? `That is a thoughtful idea. In chess, calm often beats speed. What was your first instinct?`
        : `Es una idea muy pensada. En ajedrez, la calma suele valer más que la prisa. ¿Cuál fue tu primera intuición?`;
  }

  if (canonicalSlug === "kitchen-table") {
    return language === "de"
      ? `Das klingt köstlich. Ein guter Duft macht jede Küche freundlicher. Welches Gewürz erinnert dich an Zuhause?`
      : language === "en"
        ? `That sounds delicious. A good aroma makes every kitchen feel warmer. Which spice reminds you of home?`
        : `Suena delicioso. Un buen aroma vuelve más cálida cualquier cocina. ¿Qué especia te recuerda a casa?`;
  }

  if (canonicalSlug === "walking-companion") {
    return language === "de"
      ? `Jede Bewegung zählt. Schon ein kurzer Spaziergang kann den Tag öffnen. Wann fühlst du dich am liebsten in Bewegung?`
      : language === "en"
        ? `Every bit of movement counts. Even a short walk can open the day. When do you enjoy moving most?`
        : `Todo movimiento cuenta. Incluso un paseo breve puede abrir el día. ¿Cuándo disfrutas más moverte?`;
  }

  if (canonicalSlug === "music-room") {
    return language === "de"
      ? `Musik trägt oft eine Erinnerung mit sich. Magst du eher etwas Ruhiges, Fröhliches oder Klassisches hören?`
      : language === "en"
        ? `Music often carries a memory with it. Would you prefer something calm, joyful, or classical today?`
        : `La música suele traer un recuerdo consigo. ¿Prefieres algo tranquilo, alegre o clásico hoy?`;
  }

  if (canonicalSlug === "reading-room" || canonicalSlug === "memory-lane") {
    return language === "de"
      ? `Das ist ein schöner Gesprächsbeginn. Freundliche Neugier verbindet Menschen. Möchtest du eine passende Verbindung suchen?`
      : language === "en"
        ? `That is a lovely conversation opener. Kind curiosity brings people together. Shall I look for a suitable match?`
        : `Es un comienzo de conversación muy bonito. La curiosidad amable une a las personas. ¿Quieres que busque una conexión adecuada?`;
  }

  if (lowered.includes("?")) {
    return language === "de"
      ? `Gute Frage. Lass uns sie mit Ruhe anschauen. Was spricht dein Gefühl dazu?`
      : language === "en"
        ? `That is a good question. Let’s look at it gently. What does your instinct say?`
        : `Es una buena pregunta. Vamos a mirarla con calma. ¿Qué te dice la intuición?`;
  }

  return language === "de"
    ? `Danke, dass du das teilst. ${quotedPrompt}`
    : language === "en"
      ? `Thank you for sharing that. ${quotedPrompt}`
      : `Gracias por compartirlo. ${quotedPrompt}`;
}

function buildPromptChips(slug: string, language: SocialLanguage) {
  const canonicalSlug = resolveSocialRoomSlug(slug);
  const chips: Record<string, Record<SocialLanguage, string[]>> = {
    "garden-chat": {
      es: ["¿Qué planta me recomiendas?", "Tengo hojas amarillas", "¿Cada cuánto riego?"],
      de: ["Welche Pflanze empfiehlst du?", "Meine Blätter sind gelb", "Wie oft gieße ich?"],
      en: ["Which plant do you recommend?", "My leaves are turning yellow", "How often should I water it?"],
    },
    "chess-corner": {
      es: ["No veo la mejor jugada", "¿Qué pieza muevo primero?", "Explícamelo paso a paso"],
      de: ["Ich sehe den besten Zug nicht", "Welche Figur zuerst?", "Erklär es Schritt für Schritt"],
      en: ["I can't see the best move", "Which piece should I move first?", "Explain it step by step"],
    },
    "creative-studio": {
      es: ["Dame una idea sencilla", "¿Qué colores combinan bien?", "Quiero empezar despacio"],
      de: ["Gib mir eine einfache Idee", "Welche Farben passen gut?", "Ich möchte sanft beginnen"],
      en: ["Give me a simple idea", "Which colours work well together?", "I want to start gently"],
    },
    "music-salon": {
      es: ["Recomiéndame una pieza", "Cuéntame la historia", "Quiero algo tranquilo"],
      de: ["Empfiehl mir ein Stück", "Erzähl mir die Geschichte", "Ich möchte etwas Ruhiges"],
      en: ["Recommend a piece", "Tell me the story", "I want something calm"],
    },
  };

  const fallback: Record<SocialLanguage, string[]> = {
    es: ["Explícamelo fácil", "Dame un ejemplo", "Quiero preguntar algo"],
    de: ["Erklär es einfach", "Gib mir ein Beispiel", "Ich möchte etwas fragen"],
    en: ["Explain it simply", "Give me an example", "I want to ask something"],
  };

  return chips[canonicalSlug]?.[language] ?? chips[slug]?.[language] ?? fallback[language];
}

function buildRoomMembers(slug: string, language: SocialLanguage, count: number) {
  const canonicalSlug = resolveSocialRoomSlug(slug);
  const offset = slug.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % memberCatalog.length;
  const visibleCount = Math.min(Math.max(count - 1, 2), 4);
  const members = Array.from({ length: visibleCount }, (_, index) => memberCatalog[(offset + index) % memberCatalog.length]);

  const statuses: Record<string, Record<SocialLanguage, string[]>> = {
    "garden-chat": {
      es: ["Está viendo el ejemplo", "Pidió ayuda con el riego", "Quiere una planta para interior", "Va a probar en el balcón"],
      de: ["Schaut sich das Beispiel an", "Hat um Hilfe beim Gießen gebeten", "Sucht eine Pflanze für drinnen", "Probiert es auf dem Balkon aus"],
      en: ["Is viewing the example", "Asked for help with watering", "Wants a plant for indoors", "Is going to try it on the balcony"],
    },
    "chess-corner": {
      es: ["Está resolviendo el reto", "Pidió ayuda con la reina", "Está viendo el ejemplo", "Quiere intentarlo otra vez"],
      de: ["Löst die Aufgabe", "Hat um Hilfe mit der Dame gebeten", "Schaut sich das Beispiel an", "Möchte es noch einmal versuchen"],
      en: ["Is solving the challenge", "Asked for help with the queen", "Is viewing the example", "Wants to try again"],
    },
    "creative-studio": {
      es: ["Está eligiendo colores suaves", "Pidió una idea sencilla", "Está viendo el ejemplo", "Empezó con una forma redonda"],
      de: ["Wählt sanfte Farben", "Bat um eine einfache Idee", "Schaut sich das Beispiel an", "Hat mit einer runden Form begonnen"],
      en: ["Is choosing soft colours", "Asked for a simple idea", "Is viewing the example", "Started with a round shape"],
    },
    "music-salon": {
      es: ["Está escuchando una pieza breve", "Pidió una historia musical", "Quiere algo tranquilo", "Está recordando una canción"],
      de: ["Hört ein kurzes Stück", "Bat um eine Musikgeschichte", "Möchte etwas Ruhiges", "Erinnert sich an ein Lied"],
      en: ["Is listening to a short piece", "Asked for a music story", "Wants something calm", "Is remembering a song"],
    },
  };

  const fallbackStatuses: Record<SocialLanguage, string[]> = {
    es: ["Está participando ahora", "Pidió ayuda", "Está viendo el ejemplo", "Compartió una idea"],
    de: ["Ist gerade dabei", "Hat um Hilfe gebeten", "Schaut sich das Beispiel an", "Hat eine Idee geteilt"],
    en: ["Is taking part now", "Asked for help", "Is viewing the example", "Shared an idea"],
  };

  const pool = statuses[canonicalSlug]?.[language] ?? statuses[slug]?.[language] ?? fallbackStatuses[language];

  return members.map((member, index) => ({
    id: member.id,
    name: member.name,
    sharedTopic:
      language === "de"
        ? `Mag ${member.topics[index % member.topics.length]}`
        : language === "en"
          ? `Likes ${member.topics[index % member.topics.length]}`
          : `Le gusta ${member.topics[index % member.topics.length]}`,
    statusLabel: pool[index % pool.length],
  }));
}

function buildRoomChat(slug: string, language: SocialLanguage, members: Array<{ id: string; name: string }>) {
  const canonicalSlug = resolveSocialRoomSlug(slug);
  const messages: Record<string, Record<SocialLanguage, string[]>> = {
    "garden-chat": {
      es: ["Yo también tengo geranios en la ventana.", "A mí me ayuda tocar la tierra antes de regar."],
      de: ["Ich habe auch Geranien am Fenster.", "Mir hilft es, die Erde vor dem Gießen zu berühren."],
      en: ["I also keep geraniums by the window.", "It helps me to touch the soil before watering."],
    },
    "creative-studio": {
      es: ["Yo empiezo siempre con formas redondas.", "Los colores suaves me relajan mucho."],
      de: ["Ich beginne immer mit runden Formen.", "Sanfte Farben entspannen mich sehr."],
      en: ["I always start with round shapes.", "Soft colours relax me a lot."],
    },
    "music-salon": {
      es: ["A mí me gusta saber la historia antes de escuchar.", "Las piezas cortas me ayudan a concentrarme."],
      de: ["Ich mag es, die Geschichte vor dem Hören zu kennen.", "Kurze Stücke helfen mir, aufmerksam zu bleiben."],
      en: ["I like knowing the story before listening.", "Short pieces help me stay focused."],
    },
  };

  const fallback: Record<SocialLanguage, string[]> = {
    es: ["Me gusta cómo lo explica.", "Yo también quería preguntar eso."],
    de: ["Mir gefällt, wie es erklärt wird.", "Das wollte ich auch fragen."],
    en: ["I like how it's being explained.", "I wanted to ask that too."],
  };

  const pool = messages[canonicalSlug]?.[language] ?? messages[slug]?.[language] ?? fallback[language];
  return pool.slice(0, Math.min(pool.length, members.length)).map((text, index) => ({
    id: `${slug}-chat-${index}`,
    authorId: members[index]?.id ?? `member-${index}`,
    authorName: members[index]?.name ?? (language === "en" ? "Member" : language === "de" ? "Mitglied" : "Miembro"),
    text,
    createdAt: new Date(Date.now() - (index + 1) * 60000).toISOString(),
    connectable: true,
  }));
}

async function updateVisitInterests(userId: string, roomSlug: string) {
  const canonicalSlug = resolveSocialRoomSlug(roomSlug);
  const seed = getSocialRoomBySlug(canonicalSlug);
  if (!seed) return;

  const existing = await loadUserInterestSnapshot(userId);
  const nextTags = Array.from(new Set([...existing.interestTags, ...seed.topicTags]));
  const nextTimes = Array.from(new Set([...existing.preferredTimes, ...seed.timeSlots]));
  const nextCounts = {
    ...existing.roomVisitCounts,
    [canonicalSlug]: (existing.roomVisitCounts[canonicalSlug] ?? 0) + 1,
  };
  const nextLastRooms = [canonicalSlug, ...existing.lastRooms.filter((value) => value !== canonicalSlug)].slice(0, 3);

  await persistInterestSnapshot(userId, {
    ...existing,
    interestTags: nextTags,
    preferredTimes: nextTimes,
    roomVisitCounts: nextCounts,
    lastRooms: nextLastRooms,
  });
}

router.get("/hub", async (req: Request, res: Response) => {
  const userId = resolvePublicUserId(req);

  const profile = await loadProfileSummary(userId);
  const language = normalizeLanguage((req.query.lang as string | undefined) ?? profile.language);
  const interests = await loadUserInterestSnapshot(userId);
  const timeSlot = getTimeSlotFromDate();

  const activeRooms = socialRoomSeeds
    .map((seed) => {
      const payload = buildRoomPayload(seed.slug, language);
      if (!payload) return null;
      return {
        ...payload,
        liveBadge: toLiveBadge(language, payload.participantCount),
        heroScore: scoreRoom(seed.slug, interests, payload.participantCount, timeSlot),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b?.heroScore ?? 0) - (a?.heroScore ?? 0));

  const heroRooms = activeRooms;
  const alsoForYou: typeof activeRooms = [];

  return res.json({
    user: {
      id: userId,
      firstName: profile.firstName,
      language,
    },
    timeSlot,
    activeCount: activeRooms.length,
    interestTags: interests.interestTags,
    lastRooms: interests.lastRooms,
    heroRooms,
    alsoForYou,
    listRooms: activeRooms,
  });
});

router.get("/rooms/:slug", async (req: Request, res: Response) => {
  const language = normalizeLanguage(req.query.lang as string | undefined);
  const room = buildRoomPayload(req.params.slug, language);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const members = buildRoomMembers(room.slug, language, room.participantCount);
  const memberChat = buildRoomChat(room.slug, language, members);

  return res.json({
    room: {
      ...room,
      liveBadge: toLiveBadge(language, room.participantCount),
    },
    transcript: [
      {
        id: `${room.slug}-welcome`,
        speaker: "agent",
        text: room.opener,
        createdAt: new Date().toISOString(),
      },
    ],
    promptChips: room.options?.length ? room.options : buildPromptChips(room.slug, language),
    members,
    memberChat,
  });
});

router.post("/rooms/:slug/enter", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = roomActionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const slug = resolveSocialRoomSlug(req.params.slug);
  const room = buildRoomPayload(slug, normalizeLanguage(parsed.data.lang));
  if (!room) return res.status(404).json({ error: "Room not found" });

  const visitId = randomUUID();
  visitSessionMemory.set(visitId, {
    userId,
    roomSlug: slug,
    enteredAt: Date.now(),
  });
  memoryRoomOccupancy.set(slug, (memoryRoomOccupancy.get(slug) ?? 0) + 1);

  await updateVisitInterests(userId, slug);

  const ensured = await ensureRoomRecords(slug);
  if (ensured) {
    await safeDb(
      "insert visit",
      async () => {
        await db.insert(socialRoomVisits).values({
          user_id: userId,
          room_id: ensured.roomId,
          session_id: ensured.sessionId,
        });
      },
      async () => undefined,
    );
  }

  return res.json({
    visitId,
    participantCount: getRoomParticipantCount(slug),
    liveBadge: toLiveBadge(normalizeLanguage(parsed.data.lang), getRoomParticipantCount(slug)),
  });
});

router.post("/rooms/:slug/leave", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = roomActionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const memoryVisit = parsed.data.visitId ? visitSessionMemory.get(parsed.data.visitId) : null;
  if (memoryVisit?.roomSlug) {
    const current = memoryRoomOccupancy.get(memoryVisit.roomSlug) ?? 0;
    memoryRoomOccupancy.set(memoryVisit.roomSlug, Math.max(0, current - 1));
    visitSessionMemory.delete(parsed.data.visitId!);
  }

  return res.json({ ok: true });
});

router.post("/rooms/:slug/message", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = messageSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const room = getSocialRoomBySlug(req.params.slug);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const language = normalizeLanguage(parsed.data.lang);
  const reply = buildAgentReply(room.slug, language, parsed.data.message);

  return res.json({
    reply,
    createdAt: new Date().toISOString(),
  });
});

router.post("/rooms/:slug/match", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const language = normalizeLanguage((req.body as { lang?: string } | undefined)?.lang);
  const slug = req.params.slug;
  if (!["pen-pals", "heritage-exchange"].includes(slug)) {
    return res.status(400).json({ error: "This room does not support matching" });
  }

  const userInterests = await loadUserInterestSnapshot(userId);

  const candidates = await safeDb(
    "load match candidates",
    async () => {
      const interestRows = await db
        .select({
          userId: socialUserInterests.user_id,
          interestTags: socialUserInterests.interest_tags,
        })
        .from(socialUserInterests)
        .where(ne(socialUserInterests.user_id, userId));

      const discoverableProfiles = await db
        .select({
          id: profiles.id,
          preferred_name: profiles.preferred_name,
          full_name: profiles.full_name,
          discoverable: profiles.discoverable,
        })
        .from(profiles)
        .where(and(ne(profiles.id, userId), eq(profiles.discoverable, true)));

      const allowedIds = new Set(discoverableProfiles.map((row) => row.id));
      const profileMap = new Map(discoverableProfiles.map((row) => [row.id, row]));

      return interestRows
        .filter((row) => allowedIds.has(row.userId))
        .map((row) => ({
          userId: row.userId,
          interestTags: row.interestTags ?? [],
          displayName:
            profileMap.get(row.userId)?.preferred_name ||
            profileMap.get(row.userId)?.full_name?.split(/\s+/).filter(Boolean)[0] ||
            "Amiga",
        }));
    },
    async () => {
      return Array.from(memoryInterests.entries())
        .filter(([candidateId]) => candidateId !== userId)
        .map(([candidateId, snapshot]) => ({
          userId: candidateId,
          interestTags: snapshot.interestTags,
          displayName: "Amiga",
        }));
    },
  );

  const best = candidates
    .map((candidate) => {
      const shared = userInterests.interestTags.filter((tag) => candidate.interestTags.includes(tag));
      const union = Array.from(new Set([...userInterests.interestTags, ...candidate.interestTags]));
      const score = union.length === 0 ? 0 : shared.length / union.length;
      return {
        ...candidate,
        shared,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score <= 0) {
    const agentMessage = language === "de"
      ? "Heute ist noch niemand passend verfügbar. Schau später noch einmal vorbei."
      : language === "en"
        ? "Nobody suitable is available just yet today. Please come back a little later."
        : "Todavía no hay nadie adecuado disponible hoy. Vuelve un poco más tarde.";
    return res.json({ noMatch: true, agentMessage });
  }

  const connectionKey = buildConnectionKey(userId, best.userId);
  memoryConnections.set(connectionKey, {
    matchedUserId: best.userId,
    matchedViaRoom: slug,
    matchedAt: new Date().toISOString(),
  });

  await safeDb(
    "persist social connection",
    async () => {
      await db
        .insert(socialConnections)
        .values({
          user_id_a: [userId, best.userId].sort()[0],
          user_id_b: [userId, best.userId].sort()[1],
          matched_via_room: slug,
          status: "pending",
        })
        .onConflictDoNothing();
    },
    async () => undefined,
  );

  const sharedTopic = best.shared[0] ?? (language === "de" ? "Lieblingsthemen" : language === "en" ? "favourite hobbies" : "aficiones favoritas");
  const agentMessage = language === "de"
    ? `Ich habe jemanden mit ähnlichen Interessen gefunden. Ihr könnt mit ${sharedTopic} beginnen.`
    : language === "en"
      ? `I found someone with similar interests. You could begin with ${sharedTopic}.`
      : `He encontrado a alguien con intereses parecidos. Podéis empezar por ${sharedTopic}.`;

  return res.json({
    noMatch: false,
    matchedUser: {
      userId: best.userId,
      name: best.displayName,
    },
    sharedTopics: best.shared,
    agentMessage,
  });
});

router.post("/rooms/:slug/connect", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const memberId = typeof req.body?.memberId === "string" ? req.body.memberId : "";
  const language = normalizeLanguage((req.body as { lang?: string } | undefined)?.lang);
  const member = memberCatalog.find((entry) => entry.id === memberId);
  if (!member) return res.status(404).json({ error: "Member not found" });

  const reply =
    language === "de"
      ? `${member.name} weiß, dass du offen für ein Gespräch bist. Ich kann euch über gemeinsame Interessen zusammenbringen.`
      : language === "en"
        ? `${member.name} now knows you're open to a chat. I can bring you together around a shared interest.`
        : `${member.name} ya sabe que te apetece conversar. Puedo acercaros a través de un interés compartido.`;

  return res.json({ ok: true, reply });
});

export default router;
