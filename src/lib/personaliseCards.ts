export type HoyCard = {
  id: string;
  emoji: string;
  bg: string;
  badgeBg: string;
  badgeText: string;
  route: string;
};

export type PersonalisationData = {
  conditions: string[];
  hobbies: string[];
  hasMedications: boolean;
  chatNavigationCount: number;
};

const BREATHING_KEYWORDS = [
  "asthma", "copd", "breathing", "lung", "emphysema", "bronchitis",
  "respiratory", "breathless", "pulmonary", "shortness of breath",
  "heart", "hypertension", "cardiac", "angina", "blood pressure",
  "arrhythmia", "atrial fibrillation", "chest",
];

const MOVEMENT_KEYWORDS = [
  "walking", "yoga", "gardening", "dancing", "swimming", "cycling",
  "fitness", "gym", "exercise", "pilates", "running", "hiking", "stretching",
];

const BRAIN_KEYWORDS = [
  "chess", "crossword", "puzzles", "sudoku", "reading", "brain",
  "games", "quiz", "word games", "scrabble", "strategy", "board games",
  "trivia", "mental",
];

const WORD_KEYWORDS = [
  "reading", "writing", "crossword", "scrabble", "poetry", "journaling",
  "books", "literature", "stories", "word",
];

const SOCIAL_KEYWORDS = [
  "choir", "singing", "dancing", "social", "club", "friends", "group",
  "community", "volunteering", "church", "meeting", "coffee", "conversation",
  "family",
];

function containsKeyword(list: string[], keywords: string[]): boolean {
  const lower = list.map((s) => s.toLowerCase());
  return keywords.some((kw) => lower.some((item) => item.includes(kw)));
}

function scoreCard(cardId: string, data: PersonalisationData): number {
  let score = 0;
  const { conditions, hobbies, hasMedications, chatNavigationCount } = data;

  switch (cardId) {
    case "breathing":
      if (containsKeyword(conditions, BREATHING_KEYWORDS)) score += 3;
      break;
    case "meds":
      if (hasMedications) score += 3;
      break;
    case "healthTip":
      if (conditions.length > 0) score += 2;
      break;
    case "movement":
      if (containsKeyword(hobbies, MOVEMENT_KEYWORDS)) score += 2;
      break;
    case "brainGame":
      if (containsKeyword(hobbies, BRAIN_KEYWORDS)) score += 2;
      break;
    case "wordGame":
      if (containsKeyword(hobbies, WORD_KEYWORDS)) score += 2;
      break;
    case "social":
      if (containsKeyword(hobbies, SOCIAL_KEYWORDS)) score += 2;
      break;
    case "chatPrompt":
      if (chatNavigationCount >= 5) score -= 2;
      break;
    default:
      break;
  }

  return score;
}

const CARD_PRIORITY: Record<string, number> = {
  breathing:  10,
  meds:        9,
  healthTip:   8,
  movement:    7,
  brainGame:   6,
  wordGame:    5,
  social:      4,
  concierge:   3,
  chatPrompt:  2,
};

export function personaliseCardOrder(
  cards: HoyCard[],
  data: PersonalisationData,
): HoyCard[] {
  const scored = cards.map((card) => ({
    card,
    score: scoreCard(card.id, data),
    priority: CARD_PRIORITY[card.id] ?? 0,
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.priority - a.priority;
  });

  return scored.map((s) => s.card);
}

export const CHAT_NAV_COUNT_KEY = "vyva_chat_nav_count";

export function getChatNavigationCount(): number {
  try {
    return parseInt(localStorage.getItem(CHAT_NAV_COUNT_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function incrementChatNavigationCount(): void {
  try {
    const current = getChatNavigationCount();
    localStorage.setItem(CHAT_NAV_COUNT_KEY, String(current + 1));
  } catch {
    return;
  }
}
