import { Router } from "express";

type HomePlanRequest = {
  refreshIndex?: number;
  conditions?: string[];
  hobbies?: string[];
  hasMedications?: boolean;
  chatNavigationCount?: number;
};

type HomePlanCard = {
  id: string;
  emoji: string;
  bg: string;
  badgeBg: string;
  badgeText: string;
  route: string;
  basePriority: number;
  conditionKeywords?: string[];
  hobbyKeywords?: string[];
  avoidConditionKeywords?: string[];
};

const PAGE_SIZE = 3;

const CARD_CATALOG: HomePlanCard[] = [
  {
    id: "symptomCheck",
    emoji: "🩺",
    bg: "#FFF7ED",
    badgeBg: "#FFEDD5",
    badgeText: "#C2410C",
    route: "/health/symptom-check",
    basePriority: 92,
    conditionKeywords: ["pain", "dolor", "mareo", "dizzy", "fever", "fiebre", "breath", "respirar", "shortness", "chest", "pecho"],
  },
  {
    id: "meds",
    emoji: "💊",
    bg: "#FDF4FF",
    badgeBg: "#FAE8FF",
    badgeText: "#86198F",
    route: "/meds",
    basePriority: 86,
    conditionKeywords: ["diabetes", "hypertension", "presion", "presión", "heart", "corazon", "corazón"],
  },
  {
    id: "specialistFinder",
    emoji: "👩‍⚕️",
    bg: "#F4F0FF",
    badgeBg: "#EDE9FE",
    badgeText: "#6D28D9",
    route: "/health",
    basePriority: 80,
    conditionKeywords: ["knee", "rodilla", "skin", "piel", "memory", "memoria", "thyroid", "tiroides", "diabetes", "wound", "herida"],
  },
  {
    id: "gamesRoom",
    emoji: "♟️",
    bg: "#F0FDF4",
    badgeBg: "#DCFCE7",
    badgeText: "#15803D",
    route: "/social-rooms/games-room",
    basePriority: 74,
    hobbyKeywords: ["chess", "ajedrez", "scrabble", "game", "juego", "puzzle", "sudoku", "cards", "cartas"],
  },
  {
    id: "musicSalon",
    emoji: "🎼",
    bg: "#EEF4FF",
    badgeBg: "#DBEAFE",
    badgeText: "#1D4ED8",
    route: "/social-rooms/music-salon",
    basePriority: 70,
    hobbyKeywords: ["music", "musica", "música", "opera", "ópera", "song", "cancion", "canción", "singing"],
  },
  {
    id: "movement",
    emoji: "🤸",
    bg: "#ECFDF5",
    badgeBg: "#D1FAE5",
    badgeText: "#065F46",
    route: "/health",
    basePriority: 68,
    hobbyKeywords: ["walking", "caminar", "yoga", "stretch", "estirar", "gardening", "jardin", "jardín"],
    avoidConditionKeywords: ["fall", "caida", "caída", "wheelchair", "silla de ruedas", "mobility", "movilidad"],
  },
  {
    id: "wordGame",
    emoji: "📝",
    bg: "#F0FDF4",
    badgeBg: "#DCFCE7",
    badgeText: "#15803D",
    route: "/activities",
    basePriority: 64,
    hobbyKeywords: ["reading", "leer", "book", "libro", "writing", "escribir", "poetry", "poesia", "poesía"],
  },
  {
    id: "billReview",
    emoji: "⚡",
    bg: "#F0FDFA",
    badgeBg: "#CCFBF1",
    badgeText: "#0F766E",
    route: "/concierge",
    basePriority: 58,
    hobbyKeywords: ["saving", "ahorro", "bills", "facturas"],
  },
  {
    id: "social",
    emoji: "🤝",
    bg: "#FFFBEB",
    badgeBg: "#FEF3C7",
    badgeText: "#B45309",
    route: "/social-rooms",
    basePriority: 54,
    conditionKeywords: ["lonely", "solo", "sola", "sad", "triste", "low mood", "animo", "ánimo"],
    hobbyKeywords: ["friends", "amigos", "conversation", "conversacion", "conversación", "club"],
  },
  {
    id: "breathing",
    emoji: "🫁",
    bg: "#EEF4FF",
    badgeBg: "#DBEAFE",
    badgeText: "#1D4ED8",
    route: "/health",
    basePriority: 50,
    conditionKeywords: ["stress", "estres", "estrés", "anxiety", "ansiedad", "sleep", "sueño"],
  },
  {
    id: "concierge",
    emoji: "🛎️",
    bg: "#F0FDFA",
    badgeBg: "#CCFBF1",
    badgeText: "#0F766E",
    route: "/concierge",
    basePriority: 44,
  },
  {
    id: "chatPrompt",
    emoji: "💬",
    bg: "#F4F0FF",
    badgeBg: "#EDE9FE",
    badgeText: "#6D28D9",
    route: "/chat",
    basePriority: 40,
  },
];

function normaliseSignals(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function hasKeyword(values: string[], keywords: string[] = []): boolean {
  return keywords.some((keyword) => values.some((value) => value.includes(keyword)));
}

function scoreCard(card: HomePlanCard, request: Required<HomePlanRequest>): number {
  const conditions = normaliseSignals(request.conditions);
  const hobbies = normaliseSignals(request.hobbies);
  let score = card.basePriority;

  if (hasKeyword(conditions, card.conditionKeywords)) score += 30;
  if (hasKeyword(hobbies, card.hobbyKeywords)) score += 22;
  if (card.id === "meds" && request.hasMedications) score += 32;
  if (card.id === "chatPrompt" && request.chatNavigationCount >= 5) score -= 20;
  if (hasKeyword(conditions, card.avoidConditionKeywords)) score -= 36;

  return score;
}

function rotate<T>(items: T[], refreshIndex: number, pageSize: number): T[] {
  if (items.length <= pageSize) return items;
  const safeIndex = Number.isFinite(refreshIndex) ? Math.max(0, Math.floor(refreshIndex)) : 0;
  const start = (safeIndex * pageSize) % items.length;
  return Array.from({ length: pageSize }, (_, offset) => items[(start + offset) % items.length]);
}

const homePlanRouter = Router();

homePlanRouter.post("/personal-plan", (req, res) => {
  const body = (req.body ?? {}) as HomePlanRequest;
  const request: Required<HomePlanRequest> = {
    refreshIndex: Number(body.refreshIndex ?? 0),
    conditions: normaliseSignals(body.conditions),
    hobbies: normaliseSignals(body.hobbies),
    hasMedications: Boolean(body.hasMedications),
    chatNavigationCount: Number(body.chatNavigationCount ?? 0),
  };

  const ranked = [...CARD_CATALOG]
    .map((card) => ({ card, score: scoreCard(card, request) }))
    .sort((a, b) => b.score - a.score)
    .map(({ card }) => {
      const { basePriority, conditionKeywords, hobbyKeywords, avoidConditionKeywords, ...publicCard } = card;
      return publicCard;
    });

  res.json({
    source: "curated_profile_rules",
    generatedAt: new Date().toISOString(),
    cards: rotate(ranked, request.refreshIndex, PAGE_SIZE),
  });
});

export default homePlanRouter;
