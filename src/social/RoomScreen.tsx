import {
  ArrowRight,
  ArrowLeft,
  BookMarked,
  BookOpen,
  BookmarkCheck,
  CalendarPlus,
  CalendarDays,
  Check,
  Clock,
  Dumbbell,
  Library,
  MessageCircle,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/queryClient";
import { useProfile } from "@/contexts/ProfileContext";
import { useLanguage } from "@/i18n";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import SocialStyles from "./SocialStyles";
import GamesRoomScreen from "./GamesRoomScreen";
import MusicRoomScreen from "./MusicRoomScreen";
import TogetherRoomScreen from "./TogetherRoomScreen";
import StoryRoomHandoffCard, {
  StoryRoomReplyLoopCard,
  getStoryRoomHandoffNote,
  type StoryRoomHandoffNote,
} from "./StoryRoomHandoffCard";
import { getSocialCopy, getSocialGameLanguage, getSocialLanguage } from "./roomUtils";
import {
  TogetherProximityIcon,
  TogetherSafetyIcon,
  getTogetherPlans,
  getTogetherRoomCopy,
  isTogetherRoom,
} from "./togetherRoom";
import {
  MOVEMENT_EXERCISE_VISUALS,
  MOVEMENT_FEATURED_EXERCISE_IDS,
  getMovementExerciseLanguage,
  getMovementExerciseLibraryCopy,
  getMovementSessionUiCopy,
  getMovementSwapExerciseId,
  getMovementWeekDays,
  getRecommendedMovementExerciseId,
  isMovementExerciseCardId,
  loadLastMovementExerciseId,
  loadMovementComfortLevel,
  loadMovementWeekLogDates,
  saveMovementComfortLevel,
  type MovementComfortLevelId,
  type MovementExerciseCardId,
  type MovementExerciseGroupId,
  type MovementSwapIntent,
} from "./movementExercises";
import {
  addReadingClubJournalEntry,
  addReadingClubShelfItem,
  buildReadingClubBridgePrompt,
  getReadingClubMilestones,
  getReadingClubNextStepId,
  getReadingClubPreferenceTags,
  incrementReadingClubProgress,
  joinReadingClubCircle,
  leaveReadingClubCircle,
  loadReadingClubDeskState,
  markReadingClubLetterSent,
  markReadingClubConversationCardUsed,
  markReadingClubPassport,
  recordReadingClubVisit,
  removeReadingClubExchangeRequest,
  removeReadingClubHostedTable,
  removeReadingClubJournalEntry,
  removeReadingClubLetter,
  removeReadingClubProgramSession,
  removeReadingClubRecommendationCard,
  removeReadingClubShelfItem,
  saveReadingClubExchangeRequest,
  saveReadingClubHostedTable,
  saveReadingClubLetterDraft,
  saveReadingClubProgramSession,
  saveReadingClubRecommendationCard,
  saveReadingClubDeskState,
  updateReadingClubDeskState,
  type ReadingClubDeskState,
  type ReadingClubExchangeKindId,
  type ReadingClubIntentId,
  type ReadingClubMilestoneId,
  type ReadingClubNextStepId,
  type ReadingClubPaceId,
  type ReadingClubProgressMetricId,
  type ReadingClubRecommendationMoodId,
  type ReadingClubShelfId,
  type ReadingClubTableComfortId,
  type ReadingClubTableTimeId,
} from "./readingClubDesk";
import type {
  SocialLanguage,
  SocialConversationContext,
  SocialRoom,
  SocialRoomChatItem,
  SocialMatchResponse,
  SocialReadingClubDestination,
  SocialRoomMember,
  SocialRoomPlan,
  SocialRoomPlanResponseValue,
  SocialRoomPulse,
  SocialRoomResponse,
  SocialRoomVisitState,
} from "./types";

const FALLBACK_MEMBER_NAMES = ["Carmen", "Josefa", "Manuel", "Ana"];
const MEMBER_COLOURS = ["#F59E0B", "#0EA5A4", "#EC4899", "#3B82F6"];

type AgentPresence = "idle" | "thinking" | "speaking";
type RoomMode = "welcome" | "chat";
type ReadingClubFocusedPath = "share" | "meet" | "recommend";

type FeedComment = {
  id: string;
  author: string;
  text: string;
};

type KnowledgeItem = {
  id: string;
  asker: string;
  question: string;
  answer: string;
  comments: FeedComment[];
};

const ROOM_TOPIC_HINTS: Record<string, Record<SocialLanguage, string>> = {
  "garden-chat": {
    es: "Hoy hablamos de plantas alegres para una ventana luminosa.",
    de: "Heute sprechen wir über Pflanzen für ein helles Fenster.",
    en: "Today we are talking about happy plants for a bright window.",
  },
  "chess-corner": {
    es: "Hoy buscamos una solución clara y tranquila.",
    de: "Heute suchen wir eine klare und ruhige Lösung.",
    en: "Today we are looking for a clear and calm solution.",
  },
  "creative-studio": {
    es: "Hoy buscamos una idea sencilla para empezar.",
    de: "Heute suchen wir eine einfache Idee zum Beginnen.",
    en: "Today we are looking for a simple idea to begin.",
  },
  "reading-room": {
    es: "Hoy el club comparte libros, recuerdos y recomendaciones.",
    de: "Heute teilt der Club Buecher, Erinnerungen und Empfehlungen.",
    en: "Today the club is sharing books, memories and recommendations.",
  },
  "together-room": {
    es: "Hoy puedes elegir un plan y encontrar compania.",
    de: "Heute kannst du einen Plan waehlen und Begleitung finden.",
    en: "Today you can pick a plan and find company.",
  },
};

const ROOM_QUICK_QUESTIONS: Record<string, Record<SocialLanguage, string[]>> = {
  "garden-chat": {
    es: ["¿Qué planta me recomiendas?", "Tengo poca luz", "¿Cada cuánto la riego?"],
    de: ["Welche Pflanze empfiehlst du?", "Ich habe wenig Licht", "Wie oft gieße ich sie?"],
    en: ["Which plant do you recommend?", "I do not get much light", "How often should I water it?"],
  },
  "chess-corner": {
    es: ["No veo la mejor jugada", "¿Me das una pista?", "¿Qué pieza miro primero?"],
    de: ["Ich sehe den besten Zug nicht", "Gib mir einen Hinweis", "Welche Figur schaue ich zuerst an?"],
    en: ["I cannot see the best move", "Can you give me a clue?", "Which piece should I look at first?"],
  },
  "creative-studio": {
    es: ["Dame una idea sencilla", "¿Qué colores van bien?", "Quiero empezar despacio"],
    de: ["Gib mir eine einfache Idee", "Welche Farben passen gut?", "Ich möchte langsam anfangen"],
    en: ["Give me a simple idea", "Which colours work well?", "I want to begin gently"],
  },
  "reading-room": {
    es: ["Compartir un libro querido", "Buscar companero de lectura", "Preguntar que estan leyendo"],
    de: ["Ein liebes Buch teilen", "Lesegefaehrtin finden", "Fragen, was andere lesen"],
    en: ["Share a loved book", "Find a reading companion", "Ask what others are reading"],
  },
  "together-room": {
    es: ["Quiero un plan cerca", "Buscame una cita de pelicula", "Ayudame con un trato"],
    de: ["Ich moechte einen Plan in der Naehe", "Finde ein Film-Date", "Hilf mir mit einem Deal"],
    en: ["I want a nearby plan", "Find a movie date", "Help me with a deal"],
  },
};

const ROOM_KNOWLEDGE_FEED: Record<string, Record<SocialLanguage, Array<Omit<KnowledgeItem, "id">>>> = {
  "garden-chat": {
    es: [
      {
        asker: "Carmen",
        question: "¿Qué planta aguanta bien en interior?",
        answer: "Un poto o un espatifilo suelen adaptarse muy bien si empiezas con una luz suave.",
        comments: [{ id: "c1", author: "Josefa", text: "A mí también me funcionó muy bien el poto." }],
      },
      {
        asker: "Manuel",
        question: "¿Cómo sé si estoy regando demasiado?",
        answer: "Si la tierra sigue húmeda al tocarla, es mejor esperar un poco antes de volver a regar.",
        comments: [{ id: "c2", author: "Ana", text: "Yo empecé a tocar la tierra antes de regar y me ayudó mucho." }],
      },
    ],
    de: [
      {
        asker: "Carmen",
        question: "Welche Pflanze hält drinnen gut durch?",
        answer: "Eine Efeutute oder ein Einblatt passen sich meist sehr gut an weiches Licht an.",
        comments: [{ id: "c1", author: "Josefa", text: "Mit der Efeutute habe ich auch gute Erfahrungen gemacht." }],
      },
      {
        asker: "Manuel",
        question: "Woher weiß ich, ob ich zu viel gieße?",
        answer: "Wenn die Erde beim Berühren noch feucht ist, darfst du ruhig noch etwas warten.",
        comments: [{ id: "c2", author: "Ana", text: "Mir hilft es sehr, die Erde vorher zu prüfen." }],
      },
    ],
    en: [
      {
        asker: "Carmen",
        question: "Which plant does well indoors?",
        answer: "A pothos or a peace lily usually adapts very well when you start with gentle light.",
        comments: [{ id: "c1", author: "Josefa", text: "The pothos worked very well for me too." }],
      },
      {
        asker: "Manuel",
        question: "How do I know if I am watering too much?",
        answer: "If the soil still feels damp when you touch it, it is usually better to wait a little longer.",
        comments: [{ id: "c2", author: "Ana", text: "Touching the soil first helped me a lot." }],
      },
    ],
  },
  "chess-corner": {
    es: [
      {
        asker: "Carmen",
        question: "¿Qué miro primero cuando no veo la jugada?",
        answer: "Empieza por las piezas que tienen más actividad y revisa las amenazas más simples primero.",
        comments: [{ id: "c1", author: "Josefa", text: "A mí me ayuda mirar primero las casillas seguras." }],
      },
      {
        asker: "Manuel",
        question: "¿La reina debe moverse enseguida?",
        answer: "No siempre. Antes conviene mirar si otra pieza te da una solución más tranquila.",
        comments: [{ id: "c2", author: "Ana", text: "Eso me evita precipitarme con la reina." }],
      },
    ],
    de: [
      {
        asker: "Carmen",
        question: "Worauf schaue ich zuerst, wenn ich den Zug nicht sehe?",
        answer: "Beginne mit den aktivsten Figuren und prüfe zuerst die einfachsten Drohungen.",
        comments: [{ id: "c1", author: "Josefa", text: "Mir hilft es, zuerst sichere Felder anzuschauen." }],
      },
      {
        asker: "Manuel",
        question: "Soll ich die Dame sofort ziehen?",
        answer: "Nicht immer. Es lohnt sich zuerst zu schauen, ob eine andere Figur ruhiger löst.",
        comments: [{ id: "c2", author: "Ana", text: "So eile ich mit der Dame nicht so schnell." }],
      },
    ],
    en: [
      {
        asker: "Carmen",
        question: "What should I look at first if I cannot see the move?",
        answer: "Start with the most active pieces and check the simplest threats first.",
        comments: [{ id: "c1", author: "Josefa", text: "Looking at the safe squares first really helps me." }],
      },
      {
        asker: "Manuel",
        question: "Should the queen move right away?",
        answer: "Not always. It often helps to see whether another piece solves it more calmly.",
        comments: [{ id: "c2", author: "Ana", text: "That keeps me from rushing the queen." }],
      },
    ],
  },
  "reading-room": {
    es: [
      {
        asker: "Maria",
        question: "Que libro te gustaria comentar con alguien nuevo?",
        answer: "Empieza por un libro que te dejo una escena clara. La escena abre una conversacion sin tener que resumirlo todo.",
        comments: [{ id: "c1", author: "Carmen", text: "A mi me ayuda contar primero el lugar de la escena." }],
      },
      {
        asker: "Jose",
        question: "Como saludo a otra persona del club?",
        answer: "Puedes empezar con una pregunta sencilla: que personaje te hizo compania mas tiempo?",
        comments: [{ id: "c2", author: "Ana", text: "Esa pregunta se siente amable y facil." }],
      },
    ],
    de: [
      {
        asker: "Maria",
        question: "Welches Buch wuerdest du gern mit jemand Neuem besprechen?",
        answer: "Beginne mit einem Buch, das eine klare Szene hinterlassen hat. Eine Szene oeffnet das Gespraech ohne lange Zusammenfassung.",
        comments: [{ id: "c1", author: "Carmen", text: "Mir hilft es, zuerst den Ort der Szene zu nennen." }],
      },
      {
        asker: "Jose",
        question: "Wie gruesse ich eine andere Person im Club?",
        answer: "Du kannst mit einer einfachen Frage beginnen: Welche Figur hat dir am laengsten Gesellschaft geleistet?",
        comments: [{ id: "c2", author: "Ana", text: "Diese Frage wirkt freundlich und leicht." }],
      },
    ],
    en: [
      {
        asker: "Maria",
        question: "Which book would you like to discuss with someone new?",
        answer: "Start with a book that left you one clear scene. A scene opens conversation without needing a full summary.",
        comments: [{ id: "c1", author: "Carmen", text: "It helps me to name the place in the scene first." }],
      },
      {
        asker: "Jose",
        question: "How do I greet someone else in the club?",
        answer: "You can begin with a simple question: which character kept you company the longest?",
        comments: [{ id: "c2", author: "Ana", text: "That question feels kind and easy." }],
      },
    ],
  },
};

function getParticipantColour(index: number) {
  return MEMBER_COLOURS[index % MEMBER_COLOURS.length];
}

function getPeopleLabel(language: SocialLanguage, count: number) {
  if (language === "en") return `${count} in the room`;
  if (language === "de") return `${count} im Raum`;
  return `${count} en la sala`;
}

function getAskPlaceholder(language: SocialLanguage) {
  if (language === "en") return "What would you like to ask?";
  if (language === "de") return "Was möchtest du fragen?";
  return "¿Qué quieres preguntar?";
}

function getAskButtonLabel(language: SocialLanguage) {
  if (language === "en") return "Ask";
  if (language === "de") return "Fragen";
  return "Preguntar";
}

function getAnswerLabel(language: SocialLanguage, name: string) {
  if (language === "en") return `${name} answers`;
  if (language === "de") return `${name} antwortet`;
  return `${name} responde`;
}

function getCommentLabel(language: SocialLanguage) {
  if (language === "en") return "Comment";
  if (language === "de") return "Kommentieren";
  return "Comentar";
}

function getCommentPlaceholder(language: SocialLanguage) {
  if (language === "en") return "Write a comment…";
  if (language === "de") return "Schreibe einen Kommentar…";
  return "Escribe un comentario…";
}

function getRecentQuestionsLabel(language: SocialLanguage) {
  if (language === "en") return "Recent questions";
  if (language === "de") return "Letzte Fragen";
  return "Preguntas recientes";
}

function getSentRequestLabel(language: SocialLanguage) {
  if (language === "en") return "Request sent";
  if (language === "de") return "Anfrage gesendet";
  return "Solicitud enviada";
}

function getMutualConsentNote(language: SocialLanguage) {
  if (language === "en") return "If you both accept, contact details will appear later in a safe way.";
  if (language === "de") return "Wenn ihr beide zustimmt, erscheinen die Kontaktdaten später auf sichere Weise.";
  return "Si ambos aceptáis, compartiremos los datos de contacto más adelante de forma segura.";
}

function getCloseLabel(language: SocialLanguage) {
  if (language === "en") return "Close";
  if (language === "de") return "Schließen";
  return "Cerrar";
}

function getSendRequestLabel(language: SocialLanguage) {
  if (language === "en") return "Send request";
  if (language === "de") return "Anfrage senden";
  return "Enviar solicitud";
}

function getInterestLine(language: SocialLanguage, member?: SocialRoomMember | null) {
  if (member?.sharedTopic) return member.sharedTopic;
  if (language === "en") return "Enjoys gentle expert conversations";
  if (language === "de") return "Mag ruhige Gespräche mit Expertinnen";
  return "Disfruta conversaciones tranquilas con expertas";
}

function getTopicHint(slug: string, language: SocialLanguage, fallbackTopic: string) {
  return ROOM_TOPIC_HINTS[slug]?.[language] ?? fallbackTopic;
}

function getQuickQuestions(slug: string, language: SocialLanguage, promptChips: string[]) {
  if (promptChips.length > 0) return promptChips.slice(0, 3);
  return ROOM_QUICK_QUESTIONS[slug]?.[language]?.slice(0, 3) ?? [];
}

function getAgentSpeakingLabel(language: SocialLanguage, name: string) {
  if (language === "en") return `${name} is speaking`;
  if (language === "de") return `${name} spricht`;
  return `${name} está hablando`;
}

function getAgentThinkingLabel(language: SocialLanguage, name: string) {
  if (language === "en") return `${name} is thinking…`;
  if (language === "de") return `${name} denkt nach…`;
  return `${name} está pensando…`;
}

function getRoomInteractionHint(language: SocialLanguage) {
  if (language === "en") return "The room agent starts automatically. You can speak, type, or tap a suggestion.";
  if (language === "de") return "Der Raum-Agent startet automatisch. Du kannst sprechen, schreiben oder eine Frage antippen.";
  return "El agente de la sala empieza automáticamente. Puedes hablar, escribir o tocar una sugerencia.";
}

function isReadingRoomSlug(slug?: string | null) {
  return slug === "reading-room" || slug === "book-club";
}

function getReadingClubCopy(language: SocialLanguage) {
  if (language === "en") {
    return {
      title: "Today's literary club",
      body: "Share a book, scene or memory, then meet another reader through a gentle, consent-based greeting.",
      chips: ["Books", "Stories", "Recommendations"],
      findLabel: "Find a reading companion",
      findingLabel: "Looking for a companion...",
      resultLabel: "Reading companion",
      safeLine: "Contact stays protected until both people are ready.",
      deskTitle: "My club desk",
      deskBody: "Your small place in the club remembers today's intention and what you have already done.",
      visitsLabel: "Club visits",
      streakLabel: "Day streak",
      preferredModeLabel: "Preferred greeting",
      favoriteShelfLabel: "Favourite shelf",
      preferredPaceLabel: "Club pace",
      intentionLabel: "Today I want to",
      lastReflectionLabel: "Last reflection",
      noLastReflectionLabel: "No reflection saved yet.",
      intentions: [
        { id: "share-memory" as ReadingClubIntentId, label: "Share a memory", body: "Bring a scene, character or moment." },
        { id: "recommend-book" as ReadingClubIntentId, label: "Recommend gently", body: "Leave a book or story for someone else." },
        { id: "meet-reader" as ReadingClubIntentId, label: "Meet a reader", body: "Start with a protected hello." },
        { id: "quiet-reading" as ReadingClubIntentId, label: "Read quietly", body: "Follow the club without pressure." },
      ],
      profileTitle: "Reader profile",
      profileBody: "Tune your match around the shelf and conversation pace that feel right today.",
      shelfTitle: "Favourite shelf",
      shelfOptions: [
        { id: "memoir" as ReadingClubShelfId, label: "Memoirs", body: "Life stories, family memories and turning points." },
        { id: "short-stories" as ReadingClubShelfId, label: "Short stories", body: "Small scenes that open easy conversation." },
        { id: "poetry" as ReadingClubShelfId, label: "Poetry", body: "Lines, images and feelings remembered." },
        { id: "classics" as ReadingClubShelfId, label: "Classics", body: "Old favourites and rereads." },
      ],
      paceTitle: "Conversation pace",
      paceOptions: [
        { id: "quiet" as ReadingClubPaceId, label: "Quiet", body: "A calm one-to-one exchange." },
        { id: "chatty" as ReadingClubPaceId, label: "Chatty", body: "More back-and-forth at the table." },
        { id: "letters" as ReadingClubPaceId, label: "Letters", body: "Begin with a written note." },
      ],
      matchedTopicsLabel: "Shared shelves",
      protectedGreetingLabel: "Protected greeting",
      greetingPreviewLabel: "Isabel will suggest starting with",
      greetingCta: "Send protected greeting",
      greetingSendingLabel: "Sending greeting...",
      greetingSentLabel: "Greeting sent safely.",
      greetingFailedLabel: "I could not send the greeting just now.",
      milestonesTitle: "Club milestones",
      milestonesBody: "Your club history grows as you share, greet, vote and return.",
      milestonesCompleteLabel: "Complete",
      nextStepTitle: "Next gentle step",
      lifetimeStatsLabel: "Club history",
      statsLabels: {
        reflectionsShared: "reflections",
        greetingsSent: "greetings",
        tablesJoined: "tables",
        shelfVotes: "votes",
      },
      startHereTitle: "Start here",
      startHereBody: "Choose one simple club action. Everything else can wait.",
      startShareLabel: "Share a thought",
      startShareBody: "Add one book, scene or memory.",
      startMeetLabel: "Meet a reader",
      startMeetBody: "Find someone with similar taste.",
      startRecommendLabel: "Recommend",
      startRecommendBody: "Leave one gentle suggestion.",
      deepToolsShowLabel: "More in the club",
      deepToolsHideLabel: "Hide club tools",
      deepToolsBody: "Open the program, reader lounge, shelves, letters and journal when you want them.",
      savedShelfTitle: "My saved shelf",
      savedShelfBody: "Keep reflections, prompts and recommendations you may want to return to.",
      savedShelfEmptyLabel: "Your saved shelf is ready for a first note.",
      savedShelfReflectionLabel: "Reflection",
      savedShelfRecommendationLabel: "Recommendation",
      savedShelfPromptLabel: "Prompt",
      savedShelfRemoveLabel: "Remove from shelf",
      savedShelfSavedLabel: "Saved to your shelf.",
      recommendationShelfTitle: "Share a recommendation",
      recommendationShelfBody: "Write one book, story or kind of read you might offer another reader. A short note is enough.",
      recommendationTitleLabel: "What would you recommend?",
      recommendationTitlePlaceholder: "A gentle garden story for calm afternoons...",
      recommendationNoteLabel: "Small note",
      recommendationNotePlaceholder: "Add one line if you want...",
      recommendationShelfLabel: "Shelf",
      recommendationMoodLabel: "Mood",
      recommendationShareLabel: "Save recommendation",
      recommendationEmptyLabel: "No recommendations yet.",
      recommendationRemoveLabel: "Remove recommendation",
      recommendationUseLabel: "Use as reflection",
      recommendationSavedStatusLabel: "Recommendation left on the club shelf.",
      recommendationRemovedStatusLabel: "Recommendation removed.",
      recommendationReadyStatusLabel: "Recommendation ready in the reflection box.",
      recommendationMyShelfTitle: "My recommendations",
      recommendationCreatedLabel: "Left",
      recommendationMoodOptions: [
        { id: "comfort" as ReadingClubRecommendationMoodId, label: "Comfort", body: "Soft stories for company." },
        { id: "memory" as ReadingClubRecommendationMoodId, label: "Memory", body: "Books that open remembered places." },
        { id: "conversation" as ReadingClubRecommendationMoodId, label: "Conversation", body: "Easy picks for a table." },
      ],
      exchangeBoardTitle: "Reading exchange board",
      exchangeBoardBody: "Ask the club for a book, story, memory or gentle discussion. Requests stay short and original.",
      exchangeKindLabel: "I am looking for",
      exchangeShelfLabel: "Shelf",
      exchangeTopicLabel: "Exchange topic",
      exchangeTopicPlaceholder: "Example: a kind story about gardens",
      exchangeNoteLabel: "Small note",
      exchangeNotePlaceholder: "Add what would make this feel comfortable...",
      exchangePostLabel: "Ask the club",
      exchangeEmptyLabel: "No exchange requests yet.",
      exchangeRemoveLabel: "Remove request",
      exchangeUseLabel: "Use at table",
      exchangeSavedStatusLabel: "Exchange request saved.",
      exchangeRemovedStatusLabel: "Exchange request removed.",
      exchangeReadyStatusLabel: "Exchange request moved into the reflection box.",
      exchangeMyRequestsTitle: "My exchange requests",
      exchangeCreatedLabel: "Asked",
      exchangeKindOptions: [
        { id: "recommendation" as ReadingClubExchangeKindId, label: "A recommendation", body: "Ask for a book or story by mood." },
        { id: "memory" as ReadingClubExchangeKindId, label: "A memory", body: "Invite life stories around a theme." },
        { id: "discussion" as ReadingClubExchangeKindId, label: "A discussion", body: "Open a gentle question for the table." },
      ],
      hostTableTitle: "Host a small table",
      hostTableBody: "Open a quiet club table around a theme. A few readers can notice it and join when it feels comfortable.",
      hostTableTopicLabel: "Table theme",
      hostTableTopicPlaceholder: "Example: stories about kitchens",
      hostTableNoteLabel: "Warm note",
      hostTableNotePlaceholder: "Add a short welcome or comfort note...",
      hostTableCircleLabel: "Table corner",
      hostTableTimeLabel: "When",
      hostTableComfortLabel: "Comfort",
      hostTablePublishLabel: "Open table",
      hostTableEmptyLabel: "No hosted tables yet.",
      hostTableRemoveLabel: "Cancel table",
      hostTableSavedStatusLabel: "Your table is open in the club.",
      hostTableRemovedStatusLabel: "Hosted table cancelled.",
      hostTableOpenClubLabel: "Open club",
      hostTableOpenClubBody: "Anyone in the reading room can notice it.",
      hostTableMyTablesTitle: "My hosted tables",
      hostTableCreatedLabel: "Opened",
      hostTableTimeOptions: [
        { id: "today" as ReadingClubTableTimeId, label: "Today", body: "For readers nearby now" },
        { id: "tomorrow" as ReadingClubTableTimeId, label: "Tomorrow", body: "A gentle return plan" },
        { id: "weekend" as ReadingClubTableTimeId, label: "Weekend", body: "For slower visits" },
      ],
      hostTableComfortOptions: [
        { id: "listening" as ReadingClubTableComfortId, label: "Listening", body: "Quiet readers welcome" },
        { id: "small" as ReadingClubTableComfortId, label: "Small", body: "Only a few voices" },
        { id: "sharing" as ReadingClubTableComfortId, label: "Sharing", body: "Everyone may bring one note" },
      ],
      memberLoungeTitle: "Readers in the lounge",
      memberLoungeBody: "A few voices are nearby with books, memories and gentle recommendations to exchange.",
      memberLoungeSharedLabel: "Reading thread",
      memberLoungeDefaultStatus: "Open to a gentle hello",
      memberLoungeLetterLabel: "Write note",
      memberLoungeTableLabel: "Invite to table",
      memberLoungeLetterSubject: "A gentle club hello",
      memberLoungeLetterDraft: "Hello {name}, I noticed your reading thread and would enjoy exchanging one small book memory when it feels comfortable.",
      memberLoungeLetterReadyStatus: "A protected note is ready in the letterbox.",
      memberLoungeTableTopic: "A small table with {name}",
      memberLoungeTableNote: "{name} might enjoy this quiet table. Bring one memory or recommendation in your own words.",
      memberLoungeTableReadyStatus: "A table invitation is ready to open.",
      programTitle: "This week's club program",
      programBody: "Save a seat for gentle sessions you may want to return to. Nothing is public until you choose to join.",
      programMyWeekTitle: "My club program",
      programEmptyLabel: "No seats saved yet.",
      programSaveLabel: "Save seat",
      programSavedLabel: "Seat saved",
      programRemoveLabel: "Remove seat",
      programSavedStatusLabel: "Saved in your club program.",
      programRemovedStatusLabel: "Removed from your club program.",
      programSessions: [
        { id: "monday-memory", dayLabel: "Monday", timeLabel: "Morning", title: "Memory pages", body: "Bring one scene from a book or from life.", hostLine: "Good for first visits" },
        { id: "wednesday-recommendations", dayLabel: "Wednesday", timeLabel: "Afternoon", title: "Gentle recommendations", body: "Exchange books by mood, not homework.", hostLine: "Easy conversation" },
        { id: "friday-poetry", dayLabel: "Friday", timeLabel: "Evening", title: "Short poem salon", body: "Share a feeling, image or line in your own words.", hostLine: "Quiet pace" },
      ],
      readerCirclesTitle: "Reader circles",
      readerCirclesBody: "Choose a smaller corner of the club so familiar voices can gather around the same kind of reading.",
      myCirclesTitle: "My circles",
      circleEmptyLabel: "No reader circles joined yet.",
      circleJoinLabel: "Join circle",
      circleJoinedLabel: "Joined",
      circleLeaveLabel: "Leave circle",
      circleJoinedStatusLabel: "You joined a reader circle.",
      circleLeftStatusLabel: "Removed from your reader circles.",
      readerCircles: [
        { id: "memory-keepers", badge: "Memoir", title: "Memory keepers", body: "Share scenes from life, family and remembered places.", memberLine: "4 readers this week" },
        { id: "poetry-corner", badge: "Poetry", title: "Poetry corner", body: "Talk about images, feelings and short lines in your own words.", memberLine: "3 readers this week" },
        { id: "gentle-recommendations", badge: "Exchange", title: "Gentle recommendations", body: "Trade books by mood and comfort, not homework.", memberLine: "5 readers this week" },
      ],
      conversationKitTitle: "Conversation kit",
      conversationKitBody: "Choose a card when you want an easy way into the table. Each starter is short, original and safe to share.",
      conversationUseLabel: "Use card",
      conversationUsedLabel: "Used",
      conversationReadyStatusLabel: "Conversation card ready in the reflection box.",
      conversationCards: [
        { id: "memory-scene", badge: "For sharing", title: "Memory scene", body: "Name one place, character or feeling. No full summary needed.", prompt: "A scene I still carry is..." },
        { id: "gentle-question", badge: "For greeting", title: "Gentle question", body: "A soft opener for another reader or small circle.", prompt: "What kind of story has kept you company lately?" },
        { id: "recommendation-bridge", badge: "For recommending", title: "Recommendation bridge", body: "Offer a book by mood so it feels like a gift, not homework.", prompt: "I would recommend something gentle if you enjoy..." },
      ],
      journalTitle: "Club journal",
      journalBody: "Keep private pages from today's table so the club has a thread to return to.",
      journalPromptLabel: "Journal starters",
      journalUsePromptLabel: "Use starter",
      journalSaveLabel: "Save page",
      journalSavedLabel: "Saved in your club journal.",
      journalRemovedLabel: "Removed from your club journal.",
      journalPromptReadyLabel: "Journal starter ready in the reflection box.",
      journalEmptyLabel: "Your journal is ready for today's first page.",
      journalRemoveLabel: "Remove journal page",
      journalDefaultTitle: "Today's club page",
      journalCircleLabel: "Circle",
      journalPrompts: [
        { id: "line", title: "One line", body: "Save the sentence you want to remember.", draft: "One line I want to carry from today is..." },
        { id: "voice", title: "One voice", body: "Notice a person or character who stayed with you.", draft: "A voice that stayed with me today was..." },
        { id: "next-visit", title: "Next visit", body: "Leave a small thread for your next club visit.", draft: "Next time I come back, I want to ask about..." },
      ],
      letterboxTitle: "Club letterbox",
      letterboxBody: "Write a short protected note for a companion or circle. Nothing leaves the room until you choose to send it.",
      letterPromptLabel: "Letter starters",
      letterUsePromptLabel: "Use starter",
      letterRecipientLabel: "To",
      letterRecipientPlaceholder: "Reading companion or circle",
      letterSubjectLabel: "Subject",
      letterSubjectPlaceholder: "A kind note about...",
      letterBodyLabel: "Letter",
      letterBodyPlaceholder: "Write a short note in your own words...",
      letterSaveLabel: "Save draft",
      letterSendLabel: "Mark sent",
      letterDraftLabel: "Draft",
      letterSentLabel: "Sent",
      letterSavedStatusLabel: "Letter saved in your club letterbox.",
      letterSentStatusLabel: "Letter marked as sent.",
      letterRemovedStatusLabel: "Letter removed.",
      letterEmptyLabel: "Your letterbox is ready for a first note.",
      letterRemoveLabel: "Remove letter",
      letterDefaultRecipient: "A reading companion",
      letterDefaultSubject: "A gentle club note",
      letterPrompts: [
        { id: "thanks", title: "Thank you note", subject: "Thank you for the memory", body: "Thank you for the memory you shared. It made me think of..." },
        { id: "question", title: "Gentle question", subject: "A question for next time", body: "Next time we meet at the club, I would enjoy hearing more about..." },
        { id: "recommend", title: "Recommendation note", subject: "A quiet recommendation", body: "I thought you might enjoy this kind of story because..." },
      ],
      milestones: [
        { id: "first-reflection" as ReadingClubMilestoneId, label: "First reflection", body: "Add one book, scene or memory to the table." },
        { id: "warm-greeting" as ReadingClubMilestoneId, label: "Warm greeting", body: "Send one protected hello to another reader." },
        { id: "shelf-voice" as ReadingClubMilestoneId, label: "Shelf voice", body: "Vote twice on what the club reads next." },
        { id: "table-regular" as ReadingClubMilestoneId, label: "Table regular", body: "Join three live club tables." },
        { id: "three-visits" as ReadingClubMilestoneId, label: "Three visits", body: "Come back to the club three times." },
        { id: "three-day-streak" as ReadingClubMilestoneId, label: "Three-day streak", body: "Visit three days in a row." },
      ],
      nextSteps: {
        share: { id: "share" as ReadingClubNextStepId, label: "Share a reflection", body: "Add one book, scene or memory so the table knows your voice." },
        greet: { id: "greet" as ReadingClubNextStepId, label: "Greet a reader", body: "Find a reading companion and send a protected hello." },
        vote: { id: "vote" as ReadingClubNextStepId, label: "Vote on a shelf", body: "Help choose what the club should open next." },
        join: { id: "join" as ReadingClubNextStepId, label: "Join a live table", body: "Pick join on one club table that feels comfortable." },
        recommend: { id: "recommend" as ReadingClubNextStepId, label: "Leave a recommendation", body: "Write one gentle suggestion for another reader." },
        return: { id: "return" as ReadingClubNextStepId, label: "Return tomorrow", body: "Today is full. Come back to keep your club streak alive." },
      },
      liveTablesLabel: "Live club tables",
      joinLabel: "Join",
      maybeLabel: "Maybe",
      joinedLabel: "You joined the table.",
      maybeSavedLabel: "Saved for later.",
      shelfPollLabel: "Next shelf vote",
      votedLabel: "Your vote is in.",
      sharedTableLabel: "Shared at the table",
      noPostsLabel: "The table is ready for the first reflection.",
      clubHelpLabel: "Ask Isabel for club help",
      helpSentLabel: "Isabel has been alerted.",
      postFailedLabel: "I could not update the club just now.",
      updatesLabel: "Club updates",
    };
  }

  if (language === "de") {
    return {
      title: "Heutiger Literaturclub",
      body: "Teile ein Buch, eine Szene oder eine Erinnerung und lerne eine andere Leserin ueber einen geschuetzten Gruss kennen.",
      chips: ["Buecher", "Geschichten", "Empfehlungen"],
      findLabel: "Lesegefaehrtin finden",
      findingLabel: "Suche eine Begleitung...",
      resultLabel: "Leseverbindung",
      safeLine: "Kontakt bleibt geschuetzt, bis beide bereit sind.",
      deskTitle: "Mein Clubtisch",
      deskBody: "Dein kleiner Platz im Club merkt sich die heutige Absicht und was schon erledigt ist.",
      visitsLabel: "Clubbesuche",
      streakLabel: "Tage in Folge",
      preferredModeLabel: "Lieblingsgruss",
      favoriteShelfLabel: "Lieblingsregal",
      preferredPaceLabel: "Clubtempo",
      intentionLabel: "Heute moechte ich",
      lastReflectionLabel: "Letzte Reflexion",
      noLastReflectionLabel: "Noch keine Reflexion gespeichert.",
      intentions: [
        { id: "share-memory" as ReadingClubIntentId, label: "Erinnerung teilen", body: "Bringe eine Szene, Figur oder einen Moment mit." },
        { id: "recommend-book" as ReadingClubIntentId, label: "Sanft empfehlen", body: "Hinterlasse ein Buch oder eine Geschichte." },
        { id: "meet-reader" as ReadingClubIntentId, label: "Leserin treffen", body: "Beginne mit einem geschuetzten Gruss." },
        { id: "quiet-reading" as ReadingClubIntentId, label: "Leise mitlesen", body: "Folge dem Club ohne Druck." },
      ],
      profileTitle: "Leseprofil",
      profileBody: "Stimme deine Verbindung auf Regal und Gespraechstempo ab, die heute passen.",
      shelfTitle: "Lieblingsregal",
      shelfOptions: [
        { id: "memoir" as ReadingClubShelfId, label: "Memoiren", body: "Lebensgeschichten, Familie und Wendepunkte." },
        { id: "short-stories" as ReadingClubShelfId, label: "Kurzgeschichten", body: "Kleine Szenen fuer leichte Gespraeche." },
        { id: "poetry" as ReadingClubShelfId, label: "Poesie", body: "Zeilen, Bilder und erinnerte Gefuehle." },
        { id: "classics" as ReadingClubShelfId, label: "Klassiker", body: "Alte Lieblingsbuecher und Wiederlesen." },
      ],
      paceTitle: "Gespraechstempo",
      paceOptions: [
        { id: "quiet" as ReadingClubPaceId, label: "Ruhig", body: "Ein stiller Austausch zu zweit." },
        { id: "chatty" as ReadingClubPaceId, label: "Gespraechig", body: "Mehr Hin und Her am Tisch." },
        { id: "letters" as ReadingClubPaceId, label: "Notizen", body: "Mit einer geschriebenen Notiz beginnen." },
      ],
      matchedTopicsLabel: "Gemeinsame Regale",
      protectedGreetingLabel: "Geschuetzter Gruss",
      greetingPreviewLabel: "Isabel schlaegt als Anfang vor",
      greetingCta: "Geschuetzten Gruss senden",
      greetingSendingLabel: "Sende Gruss...",
      greetingSentLabel: "Gruss sicher gesendet.",
      greetingFailedLabel: "Ich konnte den Gruss gerade nicht senden.",
      milestonesTitle: "Club-Meilensteine",
      milestonesBody: "Deine Clubgeschichte waechst, wenn du teilst, gruesst, abstimmst und wiederkommst.",
      milestonesCompleteLabel: "Fertig",
      nextStepTitle: "Naechster ruhiger Schritt",
      lifetimeStatsLabel: "Clubgeschichte",
      statsLabels: {
        reflectionsShared: "Beitraege",
        greetingsSent: "Gruesse",
        tablesJoined: "Tische",
        shelfVotes: "Stimmen",
      },
      startHereTitle: "Hier anfangen",
      startHereBody: "Waehle eine einfache Clubaktion. Alles andere kann warten.",
      startShareLabel: "Gedanken teilen",
      startShareBody: "Fuege ein Buch, eine Szene oder Erinnerung hinzu.",
      startMeetLabel: "Leserin treffen",
      startMeetBody: "Finde jemanden mit aehnlichem Geschmack.",
      startRecommendLabel: "Empfehlen",
      startRecommendBody: "Hinterlasse einen ruhigen Vorschlag.",
      deepToolsShowLabel: "Mehr im Club",
      deepToolsHideLabel: "Clubwerkzeuge ausblenden",
      deepToolsBody: "Oeffne Programm, Lounge, Regale, Briefe und Journal, wenn du sie brauchst.",
      savedShelfTitle: "Mein gespeichertes Regal",
      savedShelfBody: "Bewahre Beitraege, Impulse und Empfehlungen auf, zu denen du zurueckkehren moechtest.",
      savedShelfEmptyLabel: "Dein gespeichertes Regal wartet auf die erste Notiz.",
      savedShelfReflectionLabel: "Beitrag",
      savedShelfRecommendationLabel: "Empfehlung",
      savedShelfPromptLabel: "Impuls",
      savedShelfRemoveLabel: "Aus Regal entfernen",
      savedShelfSavedLabel: "In deinem Regal gespeichert.",
      recommendationShelfTitle: "Empfehlung teilen",
      recommendationShelfBody: "Schreibe ein Buch, eine Geschichte oder eine Leseidee fuer eine andere Leserin. Eine kurze Notiz reicht.",
      recommendationTitleLabel: "Was wuerdest du empfehlen?",
      recommendationTitlePlaceholder: "Eine ruhige Gartengeschichte fuer stille Nachmittage...",
      recommendationNoteLabel: "Kleine Notiz",
      recommendationNotePlaceholder: "Fuege eine Zeile hinzu, wenn du moechtest...",
      recommendationShelfLabel: "Regal",
      recommendationMoodLabel: "Stimmung",
      recommendationShareLabel: "Empfehlung speichern",
      recommendationEmptyLabel: "Noch keine Empfehlungen.",
      recommendationRemoveLabel: "Empfehlung entfernen",
      recommendationUseLabel: "Als Beitrag nutzen",
      recommendationSavedStatusLabel: "Empfehlung steht im Clubregal.",
      recommendationRemovedStatusLabel: "Empfehlung entfernt.",
      recommendationReadyStatusLabel: "Empfehlung steht im Reflexionsfeld bereit.",
      recommendationMyShelfTitle: "Meine Empfehlungen",
      recommendationCreatedLabel: "Hinterlassen",
      recommendationMoodOptions: [
        { id: "comfort" as ReadingClubRecommendationMoodId, label: "Trost", body: "Sanfte Geschichten fuer Gesellschaft." },
        { id: "memory" as ReadingClubRecommendationMoodId, label: "Erinnerung", body: "Buecher, die Orte oeffnen." },
        { id: "conversation" as ReadingClubRecommendationMoodId, label: "Gespraech", body: "Leichte Wahl fuer den Tisch." },
      ],
      exchangeBoardTitle: "Lese-Tauschtafel",
      exchangeBoardBody: "Bitte den Club um ein Buch, eine Geschichte, eine Erinnerung oder ein ruhiges Gespraech. Anfragen bleiben kurz und in eigenen Worten.",
      exchangeKindLabel: "Ich suche",
      exchangeShelfLabel: "Regal",
      exchangeTopicLabel: "Tauschthema",
      exchangeTopicPlaceholder: "Beispiel: eine freundliche Gartengeschichte",
      exchangeNoteLabel: "Kleine Notiz",
      exchangeNotePlaceholder: "Fuege hinzu, was sich angenehm anfuehlen wuerde...",
      exchangePostLabel: "Club fragen",
      exchangeEmptyLabel: "Noch keine Tauschanfragen.",
      exchangeRemoveLabel: "Anfrage entfernen",
      exchangeUseLabel: "Am Tisch nutzen",
      exchangeSavedStatusLabel: "Tauschanfrage gespeichert.",
      exchangeRemovedStatusLabel: "Tauschanfrage entfernt.",
      exchangeReadyStatusLabel: "Tauschanfrage steht im Reflexionsfeld.",
      exchangeMyRequestsTitle: "Meine Tauschanfragen",
      exchangeCreatedLabel: "Gefragt",
      exchangeKindOptions: [
        { id: "recommendation" as ReadingClubExchangeKindId, label: "Empfehlung", body: "Bitte um ein Buch oder eine Geschichte nach Stimmung." },
        { id: "memory" as ReadingClubExchangeKindId, label: "Erinnerung", body: "Lade Lebensgeschichten rund um ein Thema ein." },
        { id: "discussion" as ReadingClubExchangeKindId, label: "Gespraech", body: "Oeffne eine ruhige Frage fuer den Tisch." },
      ],
      hostTableTitle: "Kleinen Tisch anbieten",
      hostTableBody: "Oeffne einen ruhigen Clubtisch rund um ein Thema. Einige Leserinnen koennen ihn bemerken und dazukommen, wenn es passt.",
      hostTableTopicLabel: "Tischthema",
      hostTableTopicPlaceholder: "Beispiel: Geschichten ueber Kuechen",
      hostTableNoteLabel: "Warme Notiz",
      hostTableNotePlaceholder: "Fuege eine kurze Willkommens- oder Trostnotiz hinzu...",
      hostTableCircleLabel: "Tischecke",
      hostTableTimeLabel: "Wann",
      hostTableComfortLabel: "Komfort",
      hostTablePublishLabel: "Tisch oeffnen",
      hostTableEmptyLabel: "Noch keine angebotenen Tische.",
      hostTableRemoveLabel: "Tisch absagen",
      hostTableSavedStatusLabel: "Dein Tisch ist im Club offen.",
      hostTableRemovedStatusLabel: "Angebotener Tisch abgesagt.",
      hostTableOpenClubLabel: "Offener Club",
      hostTableOpenClubBody: "Alle im Leseraum koennen ihn bemerken.",
      hostTableMyTablesTitle: "Meine angebotenen Tische",
      hostTableCreatedLabel: "Geoeffnet",
      hostTableTimeOptions: [
        { id: "today" as ReadingClubTableTimeId, label: "Heute", body: "Fuer Leserinnen, die jetzt nahe sind" },
        { id: "tomorrow" as ReadingClubTableTimeId, label: "Morgen", body: "Ein ruhiger Rueckkehrplan" },
        { id: "weekend" as ReadingClubTableTimeId, label: "Wochenende", body: "Fuer langsamere Besuche" },
      ],
      hostTableComfortOptions: [
        { id: "listening" as ReadingClubTableComfortId, label: "Zuhoeren", body: "Stille Leserinnen willkommen" },
        { id: "small" as ReadingClubTableComfortId, label: "Klein", body: "Nur wenige Stimmen" },
        { id: "sharing" as ReadingClubTableComfortId, label: "Teilen", body: "Alle duerfen eine Notiz mitbringen" },
      ],
      memberLoungeTitle: "Leserinnen in der Lounge",
      memberLoungeBody: "Einige Stimmen sind mit Buechern, Erinnerungen und sanften Empfehlungen in der Naehe.",
      memberLoungeSharedLabel: "Lesefaden",
      memberLoungeDefaultStatus: "Offen fuer einen ruhigen Gruss",
      memberLoungeLetterLabel: "Notiz schreiben",
      memberLoungeTableLabel: "Zum Tisch einladen",
      memberLoungeLetterSubject: "Ein ruhiger Clubgruss",
      memberLoungeLetterDraft: "Hallo {name}, ich habe deinen Lesefaden gesehen und wuerde gern eine kleine Bucherinnerung austauschen, wenn es sich angenehm anfuehlt.",
      memberLoungeLetterReadyStatus: "Eine geschuetzte Notiz ist im Briefkasten bereit.",
      memberLoungeTableTopic: "Ein kleiner Tisch mit {name}",
      memberLoungeTableNote: "{name} koennte diesen ruhigen Tisch moegen. Bringe eine Erinnerung oder Empfehlung in eigenen Worten mit.",
      memberLoungeTableReadyStatus: "Eine Tischeinladung ist bereit zum Oeffnen.",
      programTitle: "Clubprogramm der Woche",
      programBody: "Merke dir ruhige Treffen, zu denen du zurueckkehren moechtest. Oeffentlich wird nichts, bis du dich dazusetzt.",
      programMyWeekTitle: "Meine Clubwoche",
      programEmptyLabel: "Noch kein Platz gemerkt.",
      programSaveLabel: "Platz merken",
      programSavedLabel: "Platz gemerkt",
      programRemoveLabel: "Platz entfernen",
      programSavedStatusLabel: "In deinem Clubprogramm gespeichert.",
      programRemovedStatusLabel: "Aus deinem Clubprogramm entfernt.",
      programSessions: [
        { id: "monday-memory", dayLabel: "Montag", timeLabel: "Morgen", title: "Erinnerungsseiten", body: "Bring eine Szene aus einem Buch oder aus dem Leben mit.", hostLine: "Gut fuer erste Besuche" },
        { id: "wednesday-recommendations", dayLabel: "Mittwoch", timeLabel: "Nachmittag", title: "Sanfte Empfehlungen", body: "Tauscht Buecher nach Stimmung, nicht als Hausaufgabe.", hostLine: "Leichtes Gespraech" },
        { id: "friday-poetry", dayLabel: "Freitag", timeLabel: "Abend", title: "Kurzer Poesiesalon", body: "Teile ein Gefuehl, ein Bild oder eine Zeile in eigenen Worten.", hostLine: "Ruhiges Tempo" },
      ],
      readerCirclesTitle: "Lesekreise",
      readerCirclesBody: "Waehle eine kleinere Ecke des Clubs, damit vertraute Stimmen rund um dieselbe Leseart zusammenfinden.",
      myCirclesTitle: "Meine Kreise",
      circleEmptyLabel: "Noch kein Lesekreis gewaehlt.",
      circleJoinLabel: "Kreis beitreten",
      circleJoinedLabel: "Dabei",
      circleLeaveLabel: "Kreis verlassen",
      circleJoinedStatusLabel: "Du bist im Lesekreis dabei.",
      circleLeftStatusLabel: "Aus deinen Lesekreisen entfernt.",
      readerCircles: [
        { id: "memory-keepers", badge: "Memoiren", title: "Erinnerungshueter", body: "Teile Szenen aus Leben, Familie und erinnerten Orten.", memberLine: "4 Leserinnen diese Woche" },
        { id: "poetry-corner", badge: "Poesie", title: "Poesieecke", body: "Sprich ueber Bilder, Gefuehle und kurze Zeilen in eigenen Worten.", memberLine: "3 Leserinnen diese Woche" },
        { id: "gentle-recommendations", badge: "Tausch", title: "Sanfte Empfehlungen", body: "Tauscht Buecher nach Stimmung und Trost, nicht als Pflicht.", memberLine: "5 Leserinnen diese Woche" },
      ],
      conversationKitTitle: "Gespraechskarten",
      conversationKitBody: "Waehle eine Karte, wenn du leicht an den Tisch kommen moechtest. Jeder Anfang ist kurz, original und sicher.",
      conversationUseLabel: "Karte nutzen",
      conversationUsedLabel: "Genutzt",
      conversationReadyStatusLabel: "Gespraechskarte steht im Reflexionsfeld bereit.",
      conversationCards: [
        { id: "memory-scene", badge: "Zum Teilen", title: "Erinnerungsszene", body: "Nenne einen Ort, eine Figur oder ein Gefuehl. Keine Zusammenfassung noetig.", prompt: "Eine Szene, die ich noch bei mir trage, ist..." },
        { id: "gentle-question", badge: "Zum Gruessen", title: "Sanfte Frage", body: "Ein ruhiger Anfang fuer eine andere Leserin oder einen kleinen Kreis.", prompt: "Welche Art Geschichte hat dir zuletzt Gesellschaft geleistet?" },
        { id: "recommendation-bridge", badge: "Zum Empfehlen", title: "Empfehlungsbruecke", body: "Empfiehl nach Stimmung, damit es wie ein Geschenk wirkt.", prompt: "Ich wuerde etwas Ruhiges empfehlen, wenn du magst..." },
      ],
      journalTitle: "Clubjournal",
      journalBody: "Bewahre private Seiten vom heutigen Tisch auf, damit der Club einen Faden zum Wiederkommen hat.",
      journalPromptLabel: "Journalstarter",
      journalUsePromptLabel: "Starter nutzen",
      journalSaveLabel: "Seite speichern",
      journalSavedLabel: "In deinem Clubjournal gespeichert.",
      journalRemovedLabel: "Aus deinem Clubjournal entfernt.",
      journalPromptReadyLabel: "Journalstarter steht im Reflexionsfeld bereit.",
      journalEmptyLabel: "Dein Journal wartet auf die erste Seite von heute.",
      journalRemoveLabel: "Journal-Seite entfernen",
      journalDefaultTitle: "Heutige Clubseite",
      journalCircleLabel: "Kreis",
      journalPrompts: [
        { id: "line", title: "Eine Zeile", body: "Bewahre den Satz, an den du dich erinnern moechtest.", draft: "Eine Zeile, die ich von heute mitnehmen moechte, ist..." },
        { id: "voice", title: "Eine Stimme", body: "Merke dir eine Person oder Figur, die geblieben ist.", draft: "Eine Stimme, die heute bei mir geblieben ist, war..." },
        { id: "next-visit", title: "Naechster Besuch", body: "Lass einen kleinen Faden fuer deinen naechsten Clubbesuch.", draft: "Wenn ich wiederkomme, moechte ich fragen..." },
      ],
      letterboxTitle: "Clubbriefkasten",
      letterboxBody: "Schreibe eine kurze geschuetzte Notiz fuer eine Begleitung oder einen Kreis. Nichts verlaesst den Raum, bis du es sendest.",
      letterPromptLabel: "Briefstarter",
      letterUsePromptLabel: "Starter nutzen",
      letterRecipientLabel: "An",
      letterRecipientPlaceholder: "Lesebegleitung oder Kreis",
      letterSubjectLabel: "Betreff",
      letterSubjectPlaceholder: "Eine freundliche Notiz ueber...",
      letterBodyLabel: "Brief",
      letterBodyPlaceholder: "Schreibe eine kurze Notiz in eigenen Worten...",
      letterSaveLabel: "Entwurf speichern",
      letterSendLabel: "Als gesendet markieren",
      letterDraftLabel: "Entwurf",
      letterSentLabel: "Gesendet",
      letterSavedStatusLabel: "Brief im Clubbriefkasten gespeichert.",
      letterSentStatusLabel: "Brief als gesendet markiert.",
      letterRemovedStatusLabel: "Brief entfernt.",
      letterEmptyLabel: "Dein Briefkasten wartet auf die erste Notiz.",
      letterRemoveLabel: "Brief entfernen",
      letterDefaultRecipient: "Eine Lesebegleitung",
      letterDefaultSubject: "Eine freundliche Clubnotiz",
      letterPrompts: [
        { id: "thanks", title: "Dankesnotiz", subject: "Danke fuer die Erinnerung", body: "Danke fuer die Erinnerung, die du geteilt hast. Sie hat mich denken lassen an..." },
        { id: "question", title: "Sanfte Frage", subject: "Eine Frage fuer naechstes Mal", body: "Wenn wir uns wieder im Club treffen, wuerde ich gern mehr hoeren ueber..." },
        { id: "recommend", title: "Empfehlungsnotiz", subject: "Eine ruhige Empfehlung", body: "Ich dachte, diese Art Geschichte koennte dir gefallen, weil..." },
      ],
      milestones: [
        { id: "first-reflection" as ReadingClubMilestoneId, label: "Erster Beitrag", body: "Fuege ein Buch, eine Szene oder Erinnerung hinzu." },
        { id: "warm-greeting" as ReadingClubMilestoneId, label: "Warmer Gruss", body: "Sende einen geschuetzten Gruss an eine andere Leserin." },
        { id: "shelf-voice" as ReadingClubMilestoneId, label: "Regalstimme", body: "Stimme zweimal ab, was der Club als Naechstes oeffnet." },
        { id: "table-regular" as ReadingClubMilestoneId, label: "Stammgast am Tisch", body: "Komm zu drei Live-Clubtischen dazu." },
        { id: "three-visits" as ReadingClubMilestoneId, label: "Drei Besuche", body: "Komm dreimal in den Club zurueck." },
        { id: "three-day-streak" as ReadingClubMilestoneId, label: "Drei Tage", body: "Besuche den Club drei Tage hintereinander." },
      ],
      nextSteps: {
        share: { id: "share" as ReadingClubNextStepId, label: "Beitrag teilen", body: "Fuege ein Buch, eine Szene oder Erinnerung hinzu." },
        greet: { id: "greet" as ReadingClubNextStepId, label: "Leserin gruessen", body: "Finde eine Leseverbindung und sende einen geschuetzten Gruss." },
        vote: { id: "vote" as ReadingClubNextStepId, label: "Regal waehlen", body: "Hilf mit, was der Club als Naechstes oeffnet." },
        join: { id: "join" as ReadingClubNextStepId, label: "Live-Tisch besuchen", body: "Waehle Dazukommen bei einem Tisch, der angenehm wirkt." },
        recommend: { id: "recommend" as ReadingClubNextStepId, label: "Empfehlung geben", body: "Schreibe einen ruhigen Vorschlag fuer eine andere Leserin." },
        return: { id: "return" as ReadingClubNextStepId, label: "Morgen wiederkommen", body: "Heute ist rund. Komm wieder, damit deine Serie weitergeht." },
      },
      liveTablesLabel: "Live-Clubtische",
      joinLabel: "Dazukommen",
      maybeLabel: "Vielleicht",
      joinedLabel: "Du bist am Tisch dabei.",
      maybeSavedLabel: "Fuer spaeter gemerkt.",
      shelfPollLabel: "Naechstes Regal",
      votedLabel: "Deine Stimme ist gespeichert.",
      sharedTableLabel: "Auf dem Clubtisch",
      noPostsLabel: "Der Tisch wartet auf die erste Reflexion.",
      clubHelpLabel: "Isabel um Clubhilfe bitten",
      helpSentLabel: "Isabel ist benachrichtigt.",
      postFailedLabel: "Ich konnte den Club gerade nicht aktualisieren.",
      updatesLabel: "Club-Neuigkeiten",
    };
  }

  return {
    title: "Club literario de hoy",
    body: "Comparte un libro, una escena o un recuerdo y conoce a otra persona con un saludo protegido y amable.",
    chips: ["Libros", "Historias", "Recomendaciones"],
    findLabel: "Buscar compania de lectura",
    findingLabel: "Buscando compania...",
    resultLabel: "Compania de lectura",
    safeLine: "El contacto queda protegido hasta que ambas personas esten listas.",
    deskTitle: "Mi mesa del club",
    deskBody: "Tu pequeno lugar en el club recuerda la intencion de hoy y lo que ya has hecho.",
    visitsLabel: "Visitas al club",
    streakLabel: "Dias seguidos",
    preferredModeLabel: "Saludo preferido",
    favoriteShelfLabel: "Estante favorito",
    preferredPaceLabel: "Ritmo del club",
    intentionLabel: "Hoy quiero",
    lastReflectionLabel: "Ultima reflexion",
    noLastReflectionLabel: "Aun no hay reflexion guardada.",
    intentions: [
      { id: "share-memory" as ReadingClubIntentId, label: "Compartir recuerdo", body: "Trae una escena, personaje o momento." },
      { id: "recommend-book" as ReadingClubIntentId, label: "Recomendar con calma", body: "Deja un libro o historia para otra persona." },
      { id: "meet-reader" as ReadingClubIntentId, label: "Conocer lector", body: "Empieza con un saludo protegido." },
      { id: "quiet-reading" as ReadingClubIntentId, label: "Leer tranquila", body: "Sigue el club sin presion." },
    ],
    profileTitle: "Perfil lector",
    profileBody: "Ajusta tu encuentro al estante y ritmo de conversacion que hoy te sienten bien.",
    shelfTitle: "Estante favorito",
    shelfOptions: [
      { id: "memoir" as ReadingClubShelfId, label: "Memorias", body: "Historias de vida, familia y cambios." },
      { id: "short-stories" as ReadingClubShelfId, label: "Cuentos", body: "Escenas pequenas para conversar facil." },
      { id: "poetry" as ReadingClubShelfId, label: "Poesia", body: "Lineas, imagenes y sentimientos recordados." },
      { id: "classics" as ReadingClubShelfId, label: "Clasicos", body: "Viejos favoritos y relecturas." },
    ],
    paceTitle: "Ritmo de conversacion",
    paceOptions: [
      { id: "quiet" as ReadingClubPaceId, label: "Tranquilo", body: "Un intercambio calmado de uno a uno." },
      { id: "chatty" as ReadingClubPaceId, label: "Conversador", body: "Mas ida y vuelta en la mesa." },
      { id: "letters" as ReadingClubPaceId, label: "Notas", body: "Empezar con una nota escrita." },
    ],
    matchedTopicsLabel: "Estantes compartidos",
    protectedGreetingLabel: "Saludo protegido",
    greetingPreviewLabel: "Isabel sugerira empezar con",
    greetingCta: "Enviar saludo protegido",
    greetingSendingLabel: "Enviando saludo...",
    greetingSentLabel: "Saludo enviado con seguridad.",
    greetingFailedLabel: "No he podido enviar el saludo ahora.",
    milestonesTitle: "Logros del club",
    milestonesBody: "Tu historia en el club crece cuando compartes, saludas, votas y vuelves.",
    milestonesCompleteLabel: "Completo",
    nextStepTitle: "Siguiente paso tranquilo",
    lifetimeStatsLabel: "Historia del club",
    statsLabels: {
      reflectionsShared: "reflexiones",
      greetingsSent: "saludos",
      tablesJoined: "mesas",
      shelfVotes: "votos",
    },
    startHereTitle: "Empieza aqui",
    startHereBody: "Elige una accion sencilla del club. Lo demas puede esperar.",
    startShareLabel: "Compartir idea",
    startShareBody: "Anade un libro, escena o recuerdo.",
    startMeetLabel: "Conocer lector",
    startMeetBody: "Encuentra alguien con gustos parecidos.",
    startRecommendLabel: "Recomendar",
    startRecommendBody: "Deja una sugerencia amable.",
    deepToolsShowLabel: "Mas en el club",
    deepToolsHideLabel: "Ocultar herramientas",
    deepToolsBody: "Abre el programa, la sala, los estantes, cartas y diario cuando los necesites.",
    savedShelfTitle: "Mi estante guardado",
    savedShelfBody: "Guarda reflexiones, preguntas y recomendaciones para volver a ellas.",
    savedShelfEmptyLabel: "Tu estante guardado espera la primera nota.",
    savedShelfReflectionLabel: "Reflexion",
    savedShelfRecommendationLabel: "Recomendacion",
    savedShelfPromptLabel: "Pregunta",
    savedShelfRemoveLabel: "Quitar del estante",
    savedShelfSavedLabel: "Guardado en tu estante.",
    recommendationShelfTitle: "Compartir recomendacion",
    recommendationShelfBody: "Escribe un libro, historia o tipo de lectura para otra persona. Una nota breve basta.",
    recommendationTitleLabel: "Que recomendarias?",
    recommendationTitlePlaceholder: "Una historia tranquila de jardin para la tarde...",
    recommendationNoteLabel: "Nota breve",
    recommendationNotePlaceholder: "Anade una linea si quieres...",
    recommendationShelfLabel: "Estante",
    recommendationMoodLabel: "Animo",
    recommendationShareLabel: "Guardar recomendacion",
    recommendationEmptyLabel: "Aun no hay recomendaciones.",
    recommendationRemoveLabel: "Quitar recomendacion",
    recommendationUseLabel: "Usar como reflexion",
    recommendationSavedStatusLabel: "Recomendacion dejada en el estante del club.",
    recommendationRemovedStatusLabel: "Recomendacion quitada.",
    recommendationReadyStatusLabel: "Recomendacion lista en el cuadro de reflexion.",
    recommendationMyShelfTitle: "Mis recomendaciones",
    recommendationCreatedLabel: "Dejada",
    recommendationMoodOptions: [
      { id: "comfort" as ReadingClubRecommendationMoodId, label: "Compania", body: "Historias suaves para acompanar." },
      { id: "memory" as ReadingClubRecommendationMoodId, label: "Recuerdo", body: "Libros que abren lugares recordados." },
      { id: "conversation" as ReadingClubRecommendationMoodId, label: "Conversacion", body: "Elecciones faciles para la mesa." },
    ],
    exchangeBoardTitle: "Tablon de intercambio",
    exchangeBoardBody: "Pide al club un libro, historia, recuerdo o conversacion tranquila. Las peticiones quedan breves y con tus palabras.",
    exchangeKindLabel: "Busco",
    exchangeShelfLabel: "Estante",
    exchangeTopicLabel: "Tema de intercambio",
    exchangeTopicPlaceholder: "Ejemplo: una historia amable sobre jardines",
    exchangeNoteLabel: "Nota breve",
    exchangeNotePlaceholder: "Anade que lo haria comodo...",
    exchangePostLabel: "Preguntar al club",
    exchangeEmptyLabel: "Aun no hay peticiones de intercambio.",
    exchangeRemoveLabel: "Quitar peticion",
    exchangeUseLabel: "Usar en la mesa",
    exchangeSavedStatusLabel: "Peticion de intercambio guardada.",
    exchangeRemovedStatusLabel: "Peticion de intercambio quitada.",
    exchangeReadyStatusLabel: "Peticion lista en el cuadro de reflexion.",
    exchangeMyRequestsTitle: "Mis peticiones de intercambio",
    exchangeCreatedLabel: "Pedida",
    exchangeKindOptions: [
      { id: "recommendation" as ReadingClubExchangeKindId, label: "Recomendacion", body: "Pide un libro o historia por animo." },
      { id: "memory" as ReadingClubExchangeKindId, label: "Recuerdo", body: "Invita historias de vida sobre un tema." },
      { id: "discussion" as ReadingClubExchangeKindId, label: "Conversacion", body: "Abre una pregunta tranquila para la mesa." },
    ],
    hostTableTitle: "Abrir una mesa pequena",
    hostTableBody: "Abre una mesa tranquila del club sobre un tema. Algunas personas lectoras pueden verla y unirse cuando se sienta comodo.",
    hostTableTopicLabel: "Tema de la mesa",
    hostTableTopicPlaceholder: "Ejemplo: historias de cocina",
    hostTableNoteLabel: "Nota calida",
    hostTableNotePlaceholder: "Anade una bienvenida breve o una nota de comodidad...",
    hostTableCircleLabel: "Rincon de mesa",
    hostTableTimeLabel: "Cuando",
    hostTableComfortLabel: "Comodidad",
    hostTablePublishLabel: "Abrir mesa",
    hostTableEmptyLabel: "Aun no hay mesas abiertas.",
    hostTableRemoveLabel: "Cancelar mesa",
    hostTableSavedStatusLabel: "Tu mesa esta abierta en el club.",
    hostTableRemovedStatusLabel: "Mesa abierta cancelada.",
    hostTableOpenClubLabel: "Club abierto",
    hostTableOpenClubBody: "Cualquier persona del salon puede verla.",
    hostTableMyTablesTitle: "Mis mesas abiertas",
    hostTableCreatedLabel: "Abierta",
    hostTableTimeOptions: [
      { id: "today" as ReadingClubTableTimeId, label: "Hoy", body: "Para lectores cerca ahora" },
      { id: "tomorrow" as ReadingClubTableTimeId, label: "Manana", body: "Un plan suave para volver" },
      { id: "weekend" as ReadingClubTableTimeId, label: "Fin de semana", body: "Para visitas mas lentas" },
    ],
    hostTableComfortOptions: [
      { id: "listening" as ReadingClubTableComfortId, label: "Escucha", body: "Lectores tranquilos bienvenidos" },
      { id: "small" as ReadingClubTableComfortId, label: "Pequena", body: "Solo unas pocas voces" },
      { id: "sharing" as ReadingClubTableComfortId, label: "Compartir", body: "Cada persona puede traer una nota" },
    ],
    memberLoungeTitle: "Lectores en la sala",
    memberLoungeBody: "Algunas voces estan cerca con libros, recuerdos y recomendaciones tranquilas para intercambiar.",
    memberLoungeSharedLabel: "Hilo de lectura",
    memberLoungeDefaultStatus: "Abierta a un saludo tranquilo",
    memberLoungeLetterLabel: "Escribir nota",
    memberLoungeTableLabel: "Invitar a mesa",
    memberLoungeLetterSubject: "Un saludo tranquilo del club",
    memberLoungeLetterDraft: "Hola {name}, vi tu hilo de lectura y me gustaria intercambiar un pequeno recuerdo de libro cuando se sienta comodo.",
    memberLoungeLetterReadyStatus: "Una nota protegida esta lista en el buzon.",
    memberLoungeTableTopic: "Una mesa pequena con {name}",
    memberLoungeTableNote: "A {name} podria gustarle esta mesa tranquila. Trae un recuerdo o recomendacion con tus propias palabras.",
    memberLoungeTableReadyStatus: "Una invitacion de mesa esta lista para abrir.",
    programTitle: "Programa del club esta semana",
    programBody: "Guarda un lugar para encuentros tranquilos a los que quieras volver. Nada es publico hasta que decidas unirte.",
    programMyWeekTitle: "Mi semana del club",
    programEmptyLabel: "Aun no hay lugares guardados.",
    programSaveLabel: "Guardar lugar",
    programSavedLabel: "Lugar guardado",
    programRemoveLabel: "Quitar lugar",
    programSavedStatusLabel: "Guardado en tu programa del club.",
    programRemovedStatusLabel: "Quitado de tu programa del club.",
    programSessions: [
      { id: "monday-memory", dayLabel: "Lunes", timeLabel: "Manana", title: "Paginas de memoria", body: "Trae una escena de un libro o de la vida.", hostLine: "Bueno para primera visita" },
      { id: "wednesday-recommendations", dayLabel: "Miercoles", timeLabel: "Tarde", title: "Recomendaciones tranquilas", body: "Intercambia libros por animo, no como tarea.", hostLine: "Conversacion facil" },
      { id: "friday-poetry", dayLabel: "Viernes", timeLabel: "Noche", title: "Salon breve de poesia", body: "Comparte una sensacion, imagen o linea con tus palabras.", hostLine: "Ritmo tranquilo" },
    ],
    readerCirclesTitle: "Circulos de lectura",
    readerCirclesBody: "Elige un rincon pequeno del club para que voces conocidas se reunan alrededor del mismo tipo de lectura.",
    myCirclesTitle: "Mis circulos",
    circleEmptyLabel: "Aun no te has unido a ningun circulo.",
    circleJoinLabel: "Unirme al circulo",
    circleJoinedLabel: "Dentro",
    circleLeaveLabel: "Salir del circulo",
    circleJoinedStatusLabel: "Estas en el circulo de lectura.",
    circleLeftStatusLabel: "Quitado de tus circulos.",
    readerCircles: [
      { id: "memory-keepers", badge: "Memorias", title: "Guardianes de memoria", body: "Comparte escenas de la vida, familia y lugares recordados.", memberLine: "4 personas lectoras esta semana" },
      { id: "poetry-corner", badge: "Poesia", title: "Rincon de poesia", body: "Habla de imagenes, sentimientos y lineas breves con tus palabras.", memberLine: "3 personas lectoras esta semana" },
      { id: "gentle-recommendations", badge: "Intercambio", title: "Recomendaciones tranquilas", body: "Intercambia libros por animo y compania, no como tarea.", memberLine: "5 personas lectoras esta semana" },
    ],
    conversationKitTitle: "Kit de conversacion",
    conversationKitBody: "Elige una tarjeta cuando quieras entrar en la mesa con calma. Cada inicio es breve, original y seguro.",
    conversationUseLabel: "Usar tarjeta",
    conversationUsedLabel: "Usada",
    conversationReadyStatusLabel: "Tarjeta lista en el cuadro de reflexion.",
    conversationCards: [
      { id: "memory-scene", badge: "Para compartir", title: "Escena de memoria", body: "Nombra un lugar, personaje o sentimiento. No hace falta resumir.", prompt: "Una escena que todavia llevo conmigo es..." },
      { id: "gentle-question", badge: "Para saludar", title: "Pregunta amable", body: "Un inicio suave para otra persona lectora o un circulo pequeno.", prompt: "Que tipo de historia te ha hecho compania ultimamente?" },
      { id: "recommendation-bridge", badge: "Para recomendar", title: "Puente de recomendacion", body: "Recomienda por animo para que se sienta como un regalo.", prompt: "Recomendaria algo tranquilo si disfrutas..." },
    ],
    journalTitle: "Diario del club",
    journalBody: "Guarda paginas privadas de la mesa de hoy para que el club tenga un hilo al que volver.",
    journalPromptLabel: "Inicios del diario",
    journalUsePromptLabel: "Usar inicio",
    journalSaveLabel: "Guardar pagina",
    journalSavedLabel: "Guardado en tu diario del club.",
    journalRemovedLabel: "Quitado de tu diario del club.",
    journalPromptReadyLabel: "Inicio listo en el cuadro de reflexion.",
    journalEmptyLabel: "Tu diario espera la primera pagina de hoy.",
    journalRemoveLabel: "Quitar pagina del diario",
    journalDefaultTitle: "Pagina del club de hoy",
    journalCircleLabel: "Circulo",
    journalPrompts: [
      { id: "line", title: "Una linea", body: "Guarda la frase que quieres recordar.", draft: "Una linea que quiero llevarme de hoy es..." },
      { id: "voice", title: "Una voz", body: "Nota una persona o personaje que se quedo contigo.", draft: "Una voz que se quedo conmigo hoy fue..." },
      { id: "next-visit", title: "Proxima visita", body: "Deja un hilo pequeno para tu proxima visita.", draft: "La proxima vez que vuelva, quiero preguntar..." },
    ],
    letterboxTitle: "Buzon del club",
    letterboxBody: "Escribe una nota protegida para una compania o circulo. Nada sale de la sala hasta que decidas enviarla.",
    letterPromptLabel: "Inicios de carta",
    letterUsePromptLabel: "Usar inicio",
    letterRecipientLabel: "Para",
    letterRecipientPlaceholder: "Compania de lectura o circulo",
    letterSubjectLabel: "Asunto",
    letterSubjectPlaceholder: "Una nota amable sobre...",
    letterBodyLabel: "Carta",
    letterBodyPlaceholder: "Escribe una nota breve con tus palabras...",
    letterSaveLabel: "Guardar borrador",
    letterSendLabel: "Marcar enviada",
    letterDraftLabel: "Borrador",
    letterSentLabel: "Enviada",
    letterSavedStatusLabel: "Carta guardada en tu buzon del club.",
    letterSentStatusLabel: "Carta marcada como enviada.",
    letterRemovedStatusLabel: "Carta quitada.",
    letterEmptyLabel: "Tu buzon espera la primera nota.",
    letterRemoveLabel: "Quitar carta",
    letterDefaultRecipient: "Una compania de lectura",
    letterDefaultSubject: "Una nota amable del club",
    letterPrompts: [
      { id: "thanks", title: "Nota de gracias", subject: "Gracias por el recuerdo", body: "Gracias por el recuerdo que compartiste. Me hizo pensar en..." },
      { id: "question", title: "Pregunta tranquila", subject: "Una pregunta para la proxima vez", body: "La proxima vez que nos encontremos en el club, me gustaria escuchar mas sobre..." },
      { id: "recommend", title: "Nota de recomendacion", subject: "Una recomendacion tranquila", body: "Pense que podrias disfrutar este tipo de historia porque..." },
    ],
    milestones: [
      { id: "first-reflection" as ReadingClubMilestoneId, label: "Primera reflexion", body: "Anade un libro, una escena o un recuerdo a la mesa." },
      { id: "warm-greeting" as ReadingClubMilestoneId, label: "Saludo amable", body: "Envia un saludo protegido a otra persona lectora." },
      { id: "shelf-voice" as ReadingClubMilestoneId, label: "Voz de estante", body: "Vota dos veces que abre el club despues." },
      { id: "table-regular" as ReadingClubMilestoneId, label: "Habitual de mesa", body: "Unete a tres mesas del club en vivo." },
      { id: "three-visits" as ReadingClubMilestoneId, label: "Tres visitas", body: "Vuelve al club tres veces." },
      { id: "three-day-streak" as ReadingClubMilestoneId, label: "Tres dias seguidos", body: "Visita el club tres dias seguidos." },
    ],
    nextSteps: {
      share: { id: "share" as ReadingClubNextStepId, label: "Compartir reflexion", body: "Anade un libro, escena o recuerdo para que la mesa conozca tu voz." },
      greet: { id: "greet" as ReadingClubNextStepId, label: "Saludar lector", body: "Busca compania de lectura y envia un saludo protegido." },
      vote: { id: "vote" as ReadingClubNextStepId, label: "Votar estante", body: "Ayuda a elegir que abre el club despues." },
      join: { id: "join" as ReadingClubNextStepId, label: "Unirme a una mesa", body: "Toca unirme en una mesa que te parezca comoda." },
      recommend: { id: "recommend" as ReadingClubNextStepId, label: "Dejar recomendacion", body: "Escribe una sugerencia amable para otra persona." },
      return: { id: "return" as ReadingClubNextStepId, label: "Volver manana", body: "Hoy esta completo. Vuelve para mantener tu racha del club." },
    },
    liveTablesLabel: "Mesas del club en vivo",
    joinLabel: "Unirme",
    maybeLabel: "Quizas",
    joinedLabel: "Te has unido a la mesa.",
    maybeSavedLabel: "Guardado para mas tarde.",
    shelfPollLabel: "Votar proximo estante",
    votedLabel: "Tu voto esta guardado.",
    sharedTableLabel: "Compartido en la mesa",
    noPostsLabel: "La mesa espera la primera reflexion.",
    clubHelpLabel: "Pedir ayuda a Isabel",
    helpSentLabel: "Isabel ha sido avisada.",
    postFailedLabel: "No he podido actualizar el club ahora.",
    updatesLabel: "Novedades del club",
  };
}

function getReadingMatchError(language: SocialLanguage) {
  if (language === "en") return "I could not look for a reading companion right now. Try again a little later.";
  if (language === "de") return "Ich konnte gerade keine Lesegefaehrtin suchen. Versuch es spaeter noch einmal.";
  return "No he podido buscar una compania de lectura ahora. Intentalo un poco mas tarde.";
}

function getReadingBridgePrompt(language: SocialLanguage) {
  if (language === "en") return "a book, character or memory you would like to share.";
  if (language === "de") return "ein Buch, eine Figur oder eine Erinnerung, die ihr teilen moechtet.";
  return "un libro, un personaje o un recuerdo que querais compartir.";
}

function getReadingTopicLabel(tag: string, language: SocialLanguage) {
  const labels: Record<string, Record<SocialLanguage, string>> = {
    books: { es: "libros", de: "Buecher", en: "books" },
    literature: { es: "literatura", de: "Literatur", en: "literature" },
    poetry: { es: "poesia", de: "Poesie", en: "poetry" },
    reading: { es: "lectura", de: "Lesen", en: "reading" },
    stories: { es: "historias", de: "Geschichten", en: "stories" },
    memoir: { es: "memorias", de: "Memoiren", en: "memoirs" },
    library: { es: "biblioteca", de: "Bibliothek", en: "library" },
    short_stories: { es: "cuentos", de: "Kurzgeschichten", en: "short stories" },
    classics: { es: "clasicos", de: "Klassiker", en: "classics" },
    book_memories: { es: "recuerdos", de: "Bucherinnerungen", en: "book memories" },
    reading_companion: { es: "compania lectora", de: "Lesebegleitung", en: "reading companionship" },
    book_recommendations: { es: "recomendaciones", de: "Empfehlungen", en: "recommendations" },
  };

  return labels[tag]?.[language] ?? tag.replace(/^game:/, "").replace(/_/g, " ");
}

function getSavedShelfKindLabel(
  kind: "reflection" | "recommendation" | "prompt",
  copy: ReturnType<typeof getReadingClubCopy>,
) {
  if (kind === "recommendation") return copy.savedShelfRecommendationLabel;
  if (kind === "prompt") return copy.savedShelfPromptLabel;
  return copy.savedShelfReflectionLabel;
}

function getReadingPassportDoneLabel(language: SocialLanguage) {
  if (language === "en") return "Done";
  if (language === "de") return "Fertig";
  return "Hecho";
}

function buildFallbackReadingClubDestination(
  language: SocialLanguage,
  members: SocialRoomMember[],
  participantCount: number,
): SocialReadingClubDestination {
  const copy = getReadingClubCopy(language);
  const memberName = (index: number, fallback: string) => members[index]?.name ?? fallback;

  if (language === "en") {
    return {
      title: "The Reading Room Literary Club",
      subtitle: "A daily table for books, memories, recommendations and gentle new friendships.",
      hostNote: "Isabel keeps the room moving with short prompts and protected greetings.",
      todayQuestion: "Which book, character or remembered scene would you enjoy sharing?",
      metrics: [
        { id: "readers", label: "Readers today", value: String(Math.max(participantCount, 7)), detail: "drop-in members" },
        { id: "tables", label: "Club tables", value: "3", detail: "morning, afternoon, evening" },
        { id: "shelves", label: "Shelves open", value: "4", detail: "books and memories" },
      ],
      agendaTitle: "Today's club program",
      agenda: [
        { id: "welcome", timeLabel: "Morning", title: "Welcome table", body: "Share one book, scene or memory.", statusLabel: "Open now" },
        { id: "exchange", timeLabel: "Afternoon", title: "Recommendation exchange", body: "Trade gentle suggestions by mood.", statusLabel: "Next table" },
        { id: "salon", timeLabel: "Evening", title: "Small salon", body: "Meet around memoirs, stories and characters.", statusLabel: "Later today" },
      ],
      shelvesTitle: "Club shelves",
      shelves: [
        {
          id: "current",
          title: "Currently reading",
          body: "What members are reading or rereading now.",
          items: [
            { id: "family", title: "A gentle family novel", authorLabel: "Member pick", tag: "Family", body: "A place for home and family stories.", discussionStarter: "Which family scene felt true?" },
            { id: "history", title: "Pages from history", authorLabel: "Shared shelf", tag: "History", body: "For biographies and remembered places.", discussionStarter: "What period still feels close?" },
          ],
        },
      ],
      spotlightsTitle: "Members at the table",
      memberSpotlights: [
        { memberId: members[0]?.id ?? "member-maria", name: memberName(0, "Maria"), roleLine: "Memoir and family stories", body: "Looking for someone who enjoys ordinary days and big turning points.", starter: "Ask about a family story." },
        { memberId: members[1]?.id ?? "member-jose", name: memberName(1, "Jose"), roleLine: "History and biographies", body: "Brought a question about memory and history.", starter: "Ask which biography felt alive." },
      ],
      companionTitle: copy.title,
      companionBody: copy.body,
      companionModes: [
        { id: "one-to-one", title: "One reader", body: "A private, consent-based greeting.", ctaLabel: "Find one reader", bridgePrompt: getReadingBridgePrompt(language) },
        { id: "small-circle", title: "Small circle", body: "A quiet table with a shared theme.", ctaLabel: "Find a small circle", bridgePrompt: "a theme for a small reading circle." },
        { id: "pen-note", title: "Pen note", body: "Start with a written greeting.", ctaLabel: "Start with a note", bridgePrompt: "a short note about a book or scene." },
      ],
      passportTitle: "Reading passport",
      passportBody: "Make today's visit feel complete.",
      passportItems: [
        { id: "share", label: "Share", body: "Add one book, scene or memory." },
        { id: "recommend", label: "Recommend", body: "Leave one gentle suggestion." },
        { id: "greet", label: "Greet", body: "Send one protected greeting." },
      ],
      reflectionTitle: "Add to the club table",
      reflectionPlaceholder: "Write a book, scene, character or memory...",
      reflectionSubmitLabel: "Post reflection",
      reflectionPrompts: ["A book that kept me company was...", "A character I still remember is...", "A story I would recommend gently is..."],
      guidelinesTitle: "Club care",
      guidelines: ["Share in your own words.", "Use short excerpts only when needed.", "Every greeting stays protected."],
    };
  }

  if (language === "de") {
    return {
      title: "Der Reading Room Literaturclub",
      subtitle: "Ein taeglicher Tisch fuer Buecher, Erinnerungen, Empfehlungen und ruhige Kontakte.",
      hostNote: "Isabel haelt den Raum mit kurzen Fragen und geschuetzten Gruessen in Bewegung.",
      todayQuestion: "Welches Buch, welche Figur oder Szene wuerdest du gern teilen?",
      metrics: [
        { id: "readers", label: "Lesende heute", value: String(Math.max(participantCount, 7)), detail: "offene Mitglieder" },
        { id: "tables", label: "Clubtische", value: "3", detail: "Morgen, Nachmittag, Abend" },
        { id: "shelves", label: "Offene Regale", value: "4", detail: "Buecher und Erinnerungen" },
      ],
      agendaTitle: "Heutiges Clubprogramm",
      agenda: [
        { id: "welcome", timeLabel: "Morgen", title: "Willkommenstisch", body: "Teile ein Buch, eine Szene oder Erinnerung.", statusLabel: "Jetzt offen" },
        { id: "exchange", timeLabel: "Nachmittag", title: "Empfehlungsaustausch", body: "Tausche sanfte Vorschlaege nach Stimmung.", statusLabel: "Naechster Tisch" },
        { id: "salon", timeLabel: "Abend", title: "Kleiner Salon", body: "Triff andere rund um Memoiren, Geschichten und Figuren.", statusLabel: "Spaeter heute" },
      ],
      shelvesTitle: "Clubregale",
      shelves: [
        {
          id: "current",
          title: "Gerade gelesen",
          body: "Was Mitglieder jetzt lesen oder wiederlesen.",
          items: [
            { id: "family", title: "Ein ruhiger Familienroman", authorLabel: "Clubauswahl", tag: "Familie", body: "Ein Ort fuer Zuhause und Familiengeschichten.", discussionStarter: "Welche Familienszene fuehlte sich wahr an?" },
            { id: "history", title: "Seiten aus der Geschichte", authorLabel: "Geteiltes Regal", tag: "Geschichte", body: "Fuer Biografien und erinnerte Orte.", discussionStarter: "Welche Zeit fuehlt sich noch nah an?" },
          ],
        },
      ],
      spotlightsTitle: "Menschen am Tisch",
      memberSpotlights: [
        { memberId: members[0]?.id ?? "member-maria", name: memberName(0, "Maria"), roleLine: "Memoiren und Familiengeschichten", body: "Sucht jemanden fuer gewoehnliche Tage und grosse Wendepunkte.", starter: "Frage nach einer Familiengeschichte." },
        { memberId: members[1]?.id ?? "member-jose", name: memberName(1, "Jose"), roleLine: "Geschichte und Biografien", body: "Hat eine Frage ueber Erinnerung und Geschichte.", starter: "Frage, welche Biografie lebendig war." },
      ],
      companionTitle: copy.title,
      companionBody: copy.body,
      companionModes: [
        { id: "one-to-one", title: "Eine Leserin", body: "Ein privater, geschuetzter Gruss.", ctaLabel: "Eine Leserin finden", bridgePrompt: getReadingBridgePrompt(language) },
        { id: "small-circle", title: "Kleiner Kreis", body: "Ein ruhiger Tisch mit gemeinsamem Thema.", ctaLabel: "Kleinen Kreis finden", bridgePrompt: "ein Thema fuer einen kleinen Lesekreis." },
        { id: "pen-note", title: "Schreibnotiz", body: "Beginne mit einem geschriebenen Gruss.", ctaLabel: "Mit Notiz beginnen", bridgePrompt: "eine kurze Notiz ueber ein Buch oder eine Szene." },
      ],
      passportTitle: "Lesepass",
      passportBody: "Mache den heutigen Besuch rund.",
      passportItems: [
        { id: "share", label: "Teilen", body: "Fuege ein Buch, eine Szene oder Erinnerung hinzu." },
        { id: "recommend", label: "Empfehlen", body: "Hinterlasse eine freundliche Empfehlung." },
        { id: "greet", label: "Gruessen", body: "Sende einen geschuetzten Gruss." },
      ],
      reflectionTitle: "Zum Clubtisch hinzufuegen",
      reflectionPlaceholder: "Schreibe ein Buch, eine Szene, Figur oder Erinnerung...",
      reflectionSubmitLabel: "Beitrag posten",
      reflectionPrompts: ["Ein Buch, das mir Gesellschaft geleistet hat, war...", "Eine Figur, die ich noch erinnere, ist...", "Eine Geschichte, die ich sanft empfehlen wuerde, ist..."],
      guidelinesTitle: "Clubachtsamkeit",
      guidelines: ["Teile in eigenen Worten.", "Nutze kurze Auszuege nur bei Bedarf.", "Jeder Gruss bleibt geschuetzt."],
    };
  }

  return {
    title: "El Club Literario de Reading Room",
    subtitle: "Una mesa diaria para libros, recuerdos, recomendaciones y amistades tranquilas.",
    hostNote: "Isabel mantiene el ritmo con preguntas breves y saludos protegidos.",
    todayQuestion: "Que libro, personaje o escena recordada te gustaria compartir?",
    metrics: [
      { id: "readers", label: "Lectores hoy", value: String(Math.max(participantCount, 7)), detail: "miembros que entran" },
      { id: "tables", label: "Mesas del club", value: "3", detail: "manana, tarde, noche" },
      { id: "shelves", label: "Estantes abiertos", value: "4", detail: "libros y recuerdos" },
    ],
    agendaTitle: "Programa de hoy",
    agenda: [
      { id: "welcome", timeLabel: "Manana", title: "Mesa de bienvenida", body: "Comparte un libro, una escena o un recuerdo.", statusLabel: "Abierta ahora" },
      { id: "exchange", timeLabel: "Tarde", title: "Intercambio de recomendaciones", body: "Cambia sugerencias amables por estado de animo.", statusLabel: "Siguiente mesa" },
      { id: "salon", timeLabel: "Noche", title: "Salon pequeno", body: "Encuentro sobre memorias, relatos y personajes.", statusLabel: "Mas tarde" },
    ],
    shelvesTitle: "Estantes del club",
    shelves: [
      {
        id: "current",
        title: "Leyendo ahora",
        body: "Lo que se lee o relee hoy.",
        items: [
          { id: "family", title: "Una novela familiar tranquila", authorLabel: "Eleccion del club", tag: "Familia", body: "Un lugar para casa e historias familiares.", discussionStarter: "Que escena familiar te parecio verdadera?" },
          { id: "history", title: "Paginas de historia", authorLabel: "Estante compartido", tag: "Historia", body: "Para biografias y lugares recordados.", discussionStarter: "Que epoca todavia sientes cercana?" },
        ],
      },
    ],
    spotlightsTitle: "Personas en la mesa",
    memberSpotlights: [
      { memberId: members[0]?.id ?? "member-maria", name: memberName(0, "Maria"), roleLine: "Memorias e historias familiares", body: "Busca alguien para dias corrientes y grandes cambios.", starter: "Pregunta por una historia familiar." },
      { memberId: members[1]?.id ?? "member-jose", name: memberName(1, "Jose"), roleLine: "Historia y biografias", body: "Trajo una pregunta sobre memoria e historia.", starter: "Pregunta que biografia le parecio viva." },
    ],
    companionTitle: copy.title,
    companionBody: copy.body,
    companionModes: [
      { id: "one-to-one", title: "Un lector", body: "Un saludo privado y protegido.", ctaLabel: "Buscar un lector", bridgePrompt: getReadingBridgePrompt(language) },
      { id: "small-circle", title: "Circulo pequeno", body: "Una mesa tranquila con tema compartido.", ctaLabel: "Buscar circulo", bridgePrompt: "un tema para un pequeno circulo de lectura." },
      { id: "pen-note", title: "Nota escrita", body: "Empieza con un saludo escrito.", ctaLabel: "Empezar con nota", bridgePrompt: "una nota breve sobre un libro o escena." },
    ],
    passportTitle: "Pasaporte lector",
    passportBody: "Cierra la visita de hoy.",
    passportItems: [
      { id: "share", label: "Compartir", body: "Anade un libro, escena o recuerdo." },
      { id: "recommend", label: "Recomendar", body: "Deja una sugerencia amable." },
      { id: "greet", label: "Saludar", body: "Envia un saludo protegido." },
    ],
    reflectionTitle: "Anadir a la mesa",
    reflectionPlaceholder: "Escribe un libro, escena, personaje o recuerdo...",
    reflectionSubmitLabel: "Publicar reflexion",
    reflectionPrompts: ["Un libro que me hizo compania fue...", "Un personaje que todavia recuerdo es...", "Una historia que recomendaria con calma es..."],
    guidelinesTitle: "Cuidado del club",
    guidelines: ["Comparte con tus propias palabras.", "Usa citas cortas solo si hacen falta.", "Cada saludo queda protegido."],
  };
}

function updateReadingPlanResponse(
  pulse: SocialRoomPulse,
  planKey: string,
  response: SocialRoomPlanResponseValue,
): SocialRoomPulse {
  const updatePlan = (plan: SocialRoomPlan): SocialRoomPlan => {
    if (plan.key !== planKey) return plan;
    const previous = plan.myResponse;
    const responseCounts = { ...plan.responseCounts };
    if (previous) responseCounts[previous] = Math.max(0, responseCounts[previous] - 1);
    responseCounts[response] = (responseCounts[response] ?? 0) + 1;
    return { ...plan, myResponse: response, responseCounts };
  };

  return {
    ...pulse,
    featuredPlan: updatePlan(pulse.featuredPlan),
    secondaryPlans: pulse.secondaryPlans.map(updatePlan),
    postedExperiences: pulse.postedExperiences.map(updatePlan),
  };
}

function updateReadingShelfVote(pulse: SocialRoomPulse, optionId: string): SocialRoomPulse {
  const previousVote = pulse.activePoll.myVote;
  const options = pulse.activePoll.options.map((option) => {
    let votes = option.votes;
    if (previousVote === option.id) votes = Math.max(0, votes - 1);
    if (optionId === option.id) votes += 1;
    return { ...option, votes };
  });

  return {
    ...pulse,
    activePoll: {
      ...pulse.activePoll,
      myVote: optionId,
      options,
      totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    },
  };
}

function summarizeReadingPostTitle(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 88) return normalized;
  return `${normalized.slice(0, 85).trim()}...`;
}

function getRoomVoiceUnavailableLabel(language: SocialLanguage, error?: string | null) {
  const missingAgentMatch = error?.match(/(ELEVENLABS_[A-Z0-9_]+_AGENT_ID|ELEVENLABS_AGENT_[A-Z0-9_]+)/);
  if (missingAgentMatch) {
    const key = missingAgentMatch[1];
    if (language === "en") return `This room needs its ElevenLabs agent ID configured: ${key}.`;
    if (language === "de") return `Für diesen Raum fehlt die ElevenLabs-Agent-ID: ${key}.`;
    return `Falta configurar el agente de voz de esta sala: ${key}.`;
  }
  if (language === "en") return "Live voice is not available in this room right now. You can keep writing here.";
  if (language === "de") return "Die Live-Stimme ist in diesem Raum gerade nicht verfügbar. Du kannst hier weiter schreiben.";
  return "La voz en directo no está disponible ahora mismo. Puedes seguir escribiendo aquí.";
}

function shouldSkipRoomVoiceAutoStart(roomSlug?: string | null) {
  return (
    roomSlug === "games-room" ||
    roomSlug === "music-room" ||
    roomSlug === "music-salon" ||
    roomSlug === "together-room"
  );
}

function getVoiceButtonLabel(language: SocialLanguage, isVoiceActive: boolean, isConnecting: boolean) {
  if (isVoiceActive) {
    if (language === "en") return "Finish speaking";
    if (language === "de") return "Fertig gesprochen";
    return "Terminar";
  }
  if (isConnecting) {
    if (language === "en") return "Opening voice...";
    if (language === "de") return "Stimme öffnet...";
    return "Abriendo voz...";
  }
  if (language === "en") return "Speak now";
  if (language === "de") return "Jetzt sprechen";
  return "Hablar ahora";
}

function formatChatTime(createdAt: string, language: SocialLanguage) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString(language, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatReadingJournalDay(dayKey: string, language: SocialLanguage) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return dayKey;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return dayKey;

  return date.toLocaleDateString(language, {
    day: "numeric",
    month: "short",
  });
}

function formatReadingLetterDate(createdAt: string, language: SocialLanguage) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(language, {
    day: "numeric",
    month: "short",
  });
}

function buildFallbackMembers(room: SocialRoomResponse["room"], language: SocialLanguage) {
  const visibleCount = Math.min(Math.max(room.participantCount - 1, 2), 4);

  if (isReadingRoomSlug(room.slug)) {
    const members = {
      es: [
        { id: "member-maria", name: "Maria", sharedTopic: "Comparte novelas familiares y poesia breve", statusLabel: "Lista para una nota" },
        { id: "member-jose", name: "Jose", sharedTopic: "Le gustan historia, periodicos y biografias", statusLabel: "Busca conversacion tranquila" },
        { id: "member-carmen", name: "Carmen", sharedTopic: "Recuerda escenas de teatro y cuentos", statusLabel: "En la mesa de memorias" },
        { id: "member-ana", name: "Ana", sharedTopic: "Disfruta historias tranquilas", statusLabel: "Abierta a recomendacion" },
      ],
      de: [
        { id: "member-maria", name: "Maria", sharedTopic: "Teilt Familienromane und kurze Gedichte", statusLabel: "Bereit fuer eine Notiz" },
        { id: "member-jose", name: "Jose", sharedTopic: "Mag Geschichte, Zeitungen und Biografien", statusLabel: "Sucht ruhiges Gespraech" },
        { id: "member-carmen", name: "Carmen", sharedTopic: "Erinnert Theaterszenen und Erzaehlungen", statusLabel: "Am Erinnerungstisch" },
        { id: "member-ana", name: "Ana", sharedTopic: "Mag ruhige Geschichten", statusLabel: "Offen fuer Empfehlung" },
      ],
      en: [
        { id: "member-maria", name: "Maria", sharedTopic: "Shares family novels and short poems", statusLabel: "Ready for a note" },
        { id: "member-jose", name: "Jose", sharedTopic: "Enjoys history, newspapers and biographies", statusLabel: "Looking for calm conversation" },
        { id: "member-carmen", name: "Carmen", sharedTopic: "Remembers theatre scenes and short stories", statusLabel: "At the memory table" },
        { id: "member-ana", name: "Ana", sharedTopic: "Likes gentle stories", statusLabel: "Open to a recommendation" },
      ],
    };

    return members[language].slice(0, visibleCount);
  }

  return Array.from({ length: visibleCount }, (_, index) => ({
    id: `${room.slug}-member-${index}`,
    name: FALLBACK_MEMBER_NAMES[index % FALLBACK_MEMBER_NAMES.length],
    sharedTopic:
      language === "en"
        ? "Enjoys calm expert questions"
        : language === "de"
          ? "Mag ruhige Expertenfragen"
          : "Disfruta preguntas tranquilas a la experta",
  }));
}

function buildKnowledgeFeed(slug: string, language: SocialLanguage, members: SocialRoomMember[]): KnowledgeItem[] {
  const seeded = ROOM_KNOWLEDGE_FEED[slug]?.[language];
  if (seeded?.length) {
    return seeded.map((item, index) => ({
      id: `${slug}-seed-${index}`,
      asker: item.asker,
      question: item.question,
      answer: item.answer,
      comments: item.comments,
    }));
  }

  return members.slice(0, 2).map((member, index) => ({
    id: `${slug}-fallback-${index}`,
    asker: member.name,
    question:
      language === "en"
        ? "Can you explain it simply?"
        : language === "de"
          ? "Kannst du es einfach erklären?"
          : "¿Puedes explicarlo de forma sencilla?",
    answer:
      language === "en"
        ? "Of course. Let us take one small step at a time."
        : language === "de"
          ? "Natürlich. Wir gehen einen kleinen Schritt nach dem anderen."
          : "Claro. Vamos paso a paso y con calma.",
    comments: [],
  }));
}

function buildWelcomeGreeting(language: SocialLanguage, agentName: string, userName?: string) {
  const name = userName?.trim();

  if (language === "en") {
    return name
      ? `Hello ${name}, I'm ${agentName}. How can I help you today?`
      : `Hello, I'm ${agentName}. How can I help you today?`;
  }

  if (language === "de") {
    return name
      ? `Hallo ${name}, ich bin ${agentName}. Wie kann ich dir heute helfen?`
      : `Hallo, ich bin ${agentName}. Wie kann ich dir heute helfen?`;
  }

  return name
    ? `Hola ${name}, soy ${agentName}. ¿Cómo puedo ayudarte hoy?`
    : `Hola, soy ${agentName}. ¿Cómo puedo ayudarte hoy?`;
}

function getLanguageLabel(language: SocialLanguage) {
  if (language === "en") return "English";
  if (language === "de") return "German";
  return "Spanish";
}

function buildAgentPrompt(
  language: SocialLanguage,
  roomName: string,
  topic: string,
  basePrompt: string,
) {
  return [
    basePrompt,
    `You are leading the VYVA social room "${roomName}".`,
    `Reply in ${getLanguageLabel(language)}.`,
    `Today's topic is "${topic}".`,
    "Keep every reply under 30 words.",
    "Sound warm, expert, calm, and practical.",
  ].join(" ");
}

function buildAgentContext(
  language: SocialLanguage,
  roomName: string,
  topic: string,
  quickQuestions: string[],
  visitState?: SocialRoomVisitState | null,
  conversationContext?: SocialConversationContext | null,
) {
  const intro =
    language === "en"
      ? `Room: ${roomName}. Topic: ${topic}.`
      : language === "de"
        ? `Raum: ${roomName}. Thema: ${topic}.`
        : `Sala: ${roomName}. Tema: ${topic}.`;

  const visitHint = visitState
    ? visitState.isFirstVisit
      ? language === "en"
        ? "This is the user's first visit to this room."
        : language === "de"
          ? "Dies ist der erste Besuch der Nutzerin in diesem Raum."
          : "Esta es la primera visita de la usuaria a esta sala."
      : language === "en"
        ? `This user has visited this room before. Previous visits: ${visitState.previousVisitCount ?? visitState.visitCount}.`
        : language === "de"
          ? `Diese Nutzerin war schon einmal in diesem Raum. Fruehere Besuche: ${visitState.previousVisitCount ?? visitState.visitCount}.`
          : `Esta usuaria ya ha visitado esta sala. Visitas anteriores: ${visitState.previousVisitCount ?? visitState.visitCount}.`
    : "";

  const chipHint =
    quickQuestions.length > 0
      ? language === "en"
        ? `Suggested questions: ${quickQuestions.join(" | ")}.`
        : language === "de"
          ? `Vorgeschlagene Fragen: ${quickQuestions.join(" | ")}.`
          : `Preguntas sugeridas: ${quickQuestions.join(" | ")}.`
      : "";

  const reportHint = conversationContext?.lines?.length
    ? [
        language === "en"
          ? "Recent summarized context:"
          : language === "de"
            ? "Aktuelle Zusammenfassung:"
            : "Contexto resumido reciente:",
        ...conversationContext.lines.map((line) => `- ${line}`),
        language === "en"
          ? "Use this quietly. Do not recite private details unless the user asks."
          : language === "de"
            ? "Nutze dies leise im Hintergrund. Nenne private Details nur, wenn die Nutzerin fragt."
            : "Usa esto como contexto silencioso. No recites detalles privados salvo que la usuaria pregunte.",
      ].join(" ")
    : "";

  return `${intro} ${visitHint} ${chipHint} ${reportHint}`.trim();
}

function buildWelcomeBootstrap(language: SocialLanguage, agentName: string, userName?: string) {
  const name = userName?.trim() || (language === "en" ? "friend" : language === "de" ? "Freundin" : "amiga");

  if (language === "en") {
    return `The user ${name} has just entered the room. Greet them as ${agentName} in one sentence and ask how you can help today.`;
  }

  if (language === "de") {
    return `Die Nutzerin ${name} hat gerade den Raum betreten. Begrüße sie als ${agentName} in einem Satz und frage, wie du heute helfen kannst.`;
  }

  return `La usuaria ${name} acaba de entrar en la sala. Salúdala como ${agentName} en una sola frase y pregúntale cómo puedes ayudar hoy.`;
}

function looksLikeGreeting(text: string) {
  const normalized = text.trim().toLowerCase();
  return (
    normalized.startsWith("hola") ||
    normalized.startsWith("hello") ||
    normalized.startsWith("hallo") ||
    normalized.includes("how can i help") ||
    normalized.includes("wie kann ich helfen") ||
    normalized.includes("cómo puedo ayudarte")
  );
}

function buildFallbackRoomResponse(slug: string, language: SocialLanguage): SocialRoomResponse | null {
  const today = new Date().toISOString().slice(0, 10);
  const canonicalSlug = isReadingRoomSlug(slug) ? "reading-room" : slug;

  const roomMap: Record<string, SocialRoom> = {
    "garden-chat": {
      slug: "garden-chat",
      name: language === "en" ? "Garden Corner" : language === "de" ? "Der Gartenchat" : "El Rincón del Jardín",
      category: "activity",
      agentSlug: "rosa",
      agentFullName: "Rosa Villanueva",
      agentColour: "#059669",
      agentCredential:
        language === "en"
          ? "Botanist · 40 years gardening"
          : language === "de"
            ? "Botanikerin · 40 Jahre Gärtnern"
            : "Botánica · 40 años cultivando",
      ctaLabel: language === "en" ? "Ask Rosa" : language === "de" ? "Rosa fragen" : "Preguntar a Rosa",
      topicTags: ["gardening", "plants"],
      timeSlots: ["morning", "afternoon"],
      featured: true,
      participantCount: 5,
      sessionDate: today,
      topic:
        language === "en"
          ? "Happy plants for a bright window"
          : language === "de"
            ? "Fröhliche Pflanzen für ein helles Fenster"
            : "Plantas alegres para una ventana luminosa",
      opener:
        language === "en"
          ? "Hello, I’m Rosa. Which plant keeps you company at home?"
          : language === "de"
            ? "Hallo, ich bin Rosa. Welche Pflanze begleitet dich zu Hause?"
            : "Hola, soy Rosa. ¿Qué planta te acompaña en casa?",
      quote: "",
      activityType: "advice",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "Three signs your plant feels happy"
          : language === "de"
            ? "Drei Zeichen, dass deine Pflanze zufrieden ist"
            : "Tres señales de que tu planta está contenta",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "5 in the room" : language === "de" ? "5 im Raum" : "5 en la sala",
    },
    "chess-corner": {
      slug: "chess-corner",
      name: language === "en" ? "Chess Corner" : language === "de" ? "Die Schachecke" : "El Club de Ajedrez",
      category: "activity",
      agentSlug: "lorenzo",
      agentFullName: "Lorenzo García",
      agentColour: "#1E1B4B",
      agentCredential:
        language === "en"
          ? "FIDE Master · National referee"
          : language === "de"
            ? "FIDE-Meister · Nationaler Schiedsrichter"
            : "Maestro FIDE · Árbitro nacional",
      ctaLabel:
        language === "en" ? "Analyse with Lorenzo" : language === "de" ? "Mit Lorenzo analysieren" : "Analizar con Lorenzo",
      topicTags: ["chess", "strategy"],
      timeSlots: ["afternoon", "evening"],
      featured: true,
      participantCount: 4,
      sessionDate: today,
      topic: language === "en" ? "Mate in one move" : language === "de" ? "Matt in einem Zug" : "Mate en una jugada",
      opener:
        language === "en"
          ? "Hello, I’m Lorenzo. Shall we look for one calm winning move?"
          : language === "de"
            ? "Hallo, ich bin Lorenzo. Suchen wir einen ruhigen Gewinnzug?"
            : "Hola, soy Lorenzo. ¿Buscamos una jugada ganadora con calma?",
      quote: "",
      activityType: "quiz",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "Look for the calmest move"
          : language === "de"
            ? "Suche den ruhigsten Zug"
            : "Busca la jugada más tranquila",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "4 in the room" : language === "de" ? "4 im Raum" : "4 en la sala",
    },
    "creative-studio": {
      slug: "creative-studio",
      name: language === "en" ? "Creative Studio" : language === "de" ? "Das Kreativstudio" : "El Estudio Creativo",
      category: "activity",
      agentSlug: "carmen",
      agentFullName: "Carmen Ruiz",
      agentColour: "#9D174D",
      agentCredential:
        language === "en"
          ? "Visual artist · Creative therapy"
          : language === "de"
            ? "Bildende Künstlerin · Kreativtherapie"
            : "Artista plástica · Terapia creativa",
      ctaLabel: language === "en" ? "Create with Carmen" : language === "de" ? "Mit Carmen gestalten" : "Explorar con Carmen",
      topicTags: ["art", "drawing"],
      timeSlots: ["morning", "afternoon"],
      featured: false,
      participantCount: 4,
      sessionDate: today,
      topic:
        language === "en"
          ? "Drawing with gentle shapes"
          : language === "de"
            ? "Mit sanften Formen zeichnen"
            : "Dibujar con formas suaves",
      opener:
        language === "en"
          ? "Hello, I’m Carmen. Shall we begin with one simple shape?"
          : language === "de"
            ? "Hallo, ich bin Carmen. Beginnen wir mit einer einfachen Form?"
            : "Hola, soy Carmen. ¿Empezamos con una forma sencilla?",
      quote: "",
      activityType: "challenge",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "A cup, a flower, a shadow"
          : language === "de"
            ? "Eine Tasse, eine Blume, ein Schatten"
            : "Una taza, una flor, una sombra",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "4 in the room" : language === "de" ? "4 im Raum" : "4 en la sala",
    },
    "music-salon": {
      slug: "music-salon",
      name: language === "en" ? "Music Salon" : language === "de" ? "Der Musiksalon" : "El Salón de Música",
      category: "activity",
      agentSlug: "clara",
      agentFullName: "Clara Vidal",
      agentColour: "#7E22CE",
      agentCredential:
        language === "en"
          ? "Musicologist · guided listening"
          : language === "de"
            ? "Musikwissenschaftlerin · geführtes Hören"
            : "Musicóloga · escucha guiada",
      ctaLabel: language === "en" ? "Join the circle" : language === "de" ? "Dem Kreis beitreten" : "Unirme al circulo",
      topicTags: ["music", "classical"],
      timeSlots: ["afternoon", "evening"],
      featured: true,
      participantCount: 5,
      sessionDate: today,
      topic:
        language === "en"
          ? "Songs from every life"
          : language === "de"
            ? "Ein Lied, das unterschiedliche Lebensgeschichten verbindet"
            : "Una canción que une historias de vida diferentes",
      opener:
        language === "en"
          ? "Hello, I'm Clara. Bring a song."
          : language === "de"
            ? "Hallo, ich bin Clara. Bring ein Lied aus deinem Leben mit oder entdecke eines mit Menschen aus anderen Lebenswegen."
            : "Hola, soy Clara. Trae una canción de tu vida o descubre una con personas de otros caminos.",
      quote: "",
      activityType: "discussion",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "Music connects us"
          : language === "de"
            ? "Musik ist unser gemeinsamer Anlass"
            : "La música es nuestra causa común",
      contentBody:
        language === "en"
          ? "Songs connect us."
          : language === "de"
            ? "Teile ein Lied, eine Erinnerung oder einen Rhythmus und triff ältere Menschen mit unterschiedlichen Hintergründen."
            : "Comparte una canción, un recuerdo o un ritmo y conoce a mayores de distintos orígenes.",
      options:
        language === "en"
          ? ["Share a song from my life", "Meet someone through music", "Find a joyful anthem"]
          : language === "de"
            ? ["Ein Lied aus meinem Leben teilen", "Jemanden über Musik kennenlernen", "Ein froehliches Lied finden"]
            : ["Compartir una canción de mi vida", "Conocer a alguien con música", "Buscar un himno alegre"],
      liveBadge: language === "en" ? "5 in the room" : language === "de" ? "5 im Raum" : "5 en la sala",
    },
    "reading-room": {
      slug: "reading-room",
      name: language === "en" ? "Literary Club" : language === "de" ? "Literarischer Club" : "Club literario",
      category: "social",
      agentSlug: "isabel-fuentes",
      agentFullName: "Isabel Fuentes",
      agentColour: "#7C2D12",
      agentCredential:
        language === "en"
          ? "Literary host"
          : language === "de"
            ? "Literarische Gastgeberin"
            : "Anfitriona literaria",
      ctaLabel: language === "en" ? "Join the club" : language === "de" ? "Dem Club beitreten" : "Unirme al club",
      topicTags: ["books", "literature", "poetry", "reading", "stories", "book_club", "conversation"],
      timeSlots: ["morning", "afternoon", "evening"],
      featured: true,
      participantCount: 7,
      sessionDate: today,
      topic:
        language === "en"
          ? "One line, one memory and one conversation"
          : language === "de"
            ? "Eine Zeile, eine Erinnerung und ein Gespraech"
            : "Una frase, un recuerdo y una conversacion",
      opener:
        language === "en"
          ? "Hello, I'm Isabel. Today we share books, stories and small memories so we can know one another better."
          : language === "de"
            ? "Hallo, ich bin Isabel. Heute teilen wir Buecher, Geschichten und kleine Erinnerungen, um einander besser kennenzulernen."
            : "Hola, soy Isabel. Hoy compartimos libros, historias y pequenos recuerdos para conocernos mejor.",
      quote: "",
      activityType: "discussion",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "The club table"
          : language === "de"
            ? "Der Clubtisch"
            : "La mesa del club",
      contentBody:
        language === "en"
          ? "Bring a loved book, a remembered line or a short story. The conversation matters more than finishing a text."
          : language === "de"
            ? "Bring ein liebes Buch, eine erinnerte Zeile oder eine kurze Geschichte mit. Das Gespraech ist wichtiger als ein Textende."
            : "Trae un libro querido, una frase recordada o una historia breve. La conversacion importa mas que terminar una lectura.",
      options:
        language === "en"
          ? ["Share a book I remember", "Find someone with similar taste", "Start with a literary question"]
          : language === "de"
            ? ["Ein Buch teilen, an das ich mich erinnere", "Jemanden mit aehnlichem Geschmack finden", "Mit einer literarischen Frage beginnen"]
            : ["Compartir un libro que recuerdo", "Buscar alguien con gustos parecidos", "Empezar con una pregunta literaria"],
      liveBadge: language === "en" ? "7 in the room" : language === "de" ? "7 im Raum" : "7 en la sala",
    },
    "morning-circle": {
      slug: "morning-circle",
      name: language === "en" ? "Morning Circle" : language === "de" ? "Der Morgenkreis" : "Círculo de la Mañana",
      category: "social",
      agentSlug: "vyva",
      agentFullName: "VYVA",
      agentColour: "#5B21B6",
      agentCredential:
        language === "en"
          ? "Your daily companion"
          : language === "de"
            ? "Deine tägliche Begleiterin"
            : "Tu compañera de cada día",
      ctaLabel: language === "en" ? "Share with VYVA" : language === "de" ? "Mit VYVA teilen" : "Compartir con VYVA",
      topicTags: ["check-in", "wellbeing"],
      timeSlots: ["morning"],
      featured: false,
      participantCount: 5,
      sessionDate: today,
      topic:
        language === "en"
          ? "How are you arriving today?"
          : language === "de"
            ? "Wie kommst du heute an?"
            : "¿Cómo llegas hoy a este momento?",
      opener:
        language === "en"
          ? "Hello, I’m VYVA. What kind of morning are you having today?"
          : language === "de"
            ? "Hallo, ich bin VYVA. Wie fühlt sich dein Morgen heute an?"
            : "Hola, soy VYVA. ¿Qué tipo de mañana estás teniendo hoy?",
      quote: "",
      activityType: "discussion",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "A simple morning check-in"
          : language === "de"
            ? "Ein einfacher Morgen-Check-in"
            : "Un chequeo sencillo para empezar el día",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "5 in the room" : language === "de" ? "5 im Raum" : "5 en la sala",
    },
    "memory-lane": {
      slug: "memory-lane",
      name: language === "en" ? "Memory Lane" : language === "de" ? "Die Erinnerungsstraße" : "Camino de Recuerdos",
      category: "social",
      agentSlug: "sofia",
      agentFullName: "Sofía Montoya",
      agentColour: "#6D6352",
      agentCredential:
        language === "en"
          ? "Historian · Oral memory"
          : language === "de"
            ? "Historikerin · Mündliche Erinnerung"
            : "Historiadora · Memoria oral",
      ctaLabel: language === "en" ? "Remember with Sofía" : language === "de" ? "Mit Sofía erinnern" : "Recordar con Sofía",
      topicTags: ["memories", "stories"],
      timeSlots: ["afternoon", "evening"],
      featured: false,
      participantCount: 3,
      sessionDate: today,
      topic:
        language === "en"
          ? "Which memory comes first today?"
          : language === "de"
            ? "Welche Erinnerung kommt heute zuerst?"
            : "¿Qué recuerdo aparece primero hoy?",
      opener:
        language === "en"
          ? "Hello, I’m Sofía. Which memory arrives first when you pause for a moment?"
          : language === "de"
            ? "Hallo, ich bin Sofía. Welche Erinnerung kommt zuerst, wenn du kurz innehältst?"
            : "Hola, soy Sofía. ¿Qué recuerdo llega primero cuando haces una pausa?",
      quote: "",
      activityType: "story",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "A gentle memory prompt"
          : language === "de"
            ? "Ein sanfter Erinnerungsimpuls"
            : "Una invitación suave a recordar",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "3 in the room" : language === "de" ? "3 im Raum" : "3 en la sala",
    },
    "evening-wind-down": {
      slug: "evening-wind-down",
      name: language === "en" ? "Evening Wind-Down" : language === "de" ? "Die Ruhestunde" : "La Hora de la Calma",
      category: "social",
      agentSlug: "marco",
      agentFullName: "Marco Reyes",
      agentColour: "#1D4ED8",
      agentCredential:
        language === "en"
          ? "Psychologist · Clinical mindfulness"
          : language === "de"
            ? "Psychologe · Klinische Achtsamkeit"
            : "Psicólogo · Mindfulness clínico",
      ctaLabel: language === "en" ? "Breathe with Marco" : language === "de" ? "Mit Marco atmen" : "Respirar con Marco",
      topicTags: ["calm", "breathing"],
      timeSlots: ["evening"],
      featured: false,
      participantCount: 4,
      sessionDate: today,
      topic:
        language === "en"
          ? "One quiet breath for the evening"
          : language === "de"
            ? "Ein ruhiger Atemzug für den Abend"
            : "Una respiración tranquila para la tarde",
      opener:
        language === "en"
          ? "Hello, I’m Marco. Shall we slow the evening down together?"
          : language === "de"
            ? "Hallo, ich bin Marco. Wollen wir den Abend gemeinsam beruhigen?"
            : "Hola, soy Marco. ¿Bajamos juntos el ritmo de la tarde?",
      quote: "",
      activityType: "advice",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "A short calming pause"
          : language === "de"
            ? "Eine kurze ruhige Pause"
            : "Una pausa breve para bajar el ritmo",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "4 in the room" : language === "de" ? "4 im Raum" : "4 en la sala",
    },
    "kitchen-table": {
      slug: "kitchen-table",
      name: language === "en" ? "Kitchen Table" : language === "de" ? "Der Küchentisch" : "La Mesa de la Cocina",
      category: "useful",
      agentSlug: "lola",
      agentFullName: "Lola Martínez",
      agentColour: "#C2410C",
      agentCredential:
        language === "en"
          ? "Chef · Mediterranean cuisine"
          : language === "de"
            ? "Köchin · Mediterrane Küche"
            : "Chef · Cocina mediterránea",
      ctaLabel: language === "en" ? "Cook with Lola" : language === "de" ? "Mit Lola kochen" : "Cocinar con Lola",
      topicTags: ["cooking", "recipes"],
      timeSlots: ["morning", "afternoon"],
      featured: false,
      participantCount: 6,
      sessionDate: today,
      topic:
        language === "en"
          ? "A simple dish with familiar flavours"
          : language === "de"
            ? "Ein einfaches Gericht mit vertrauten Aromen"
            : "Un plato sencillo con sabores de siempre",
      opener:
        language === "en"
          ? "Hello, I’m Lola. What dish makes your kitchen feel like home?"
          : language === "de"
            ? "Hallo, ich bin Lola. Welches Gericht lässt deine Küche wie Zuhause fühlen?"
            : "Hola, soy Lola. ¿Qué plato hace que tu cocina se sienta como casa?",
      quote: "",
      activityType: "recipe",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "One warm idea for today"
          : language === "de"
            ? "Eine warme Idee für heute"
            : "Una idea cálida para hoy",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "6 in the room" : language === "de" ? "6 im Raum" : "6 en la sala",
    },
    "walking-club": {
      slug: "walking-club",
      name: language === "en" ? "Walking Club" : language === "de" ? "Der Wanderclub" : "El Club de los Pasos",
      category: "useful",
      agentSlug: "pedro",
      agentFullName: "Pedro Navarro",
      agentColour: "#0F766E",
      agentCredential:
        language === "en"
          ? "Physiotherapist · Gentle movement"
          : language === "de"
            ? "Physiotherapeut · Sanfte Bewegung"
            : "Fisioterapeuta · Movimiento suave",
      ctaLabel: language === "en" ? "Move with Pedro" : language === "de" ? "Mit Pedro bewegen" : "Moverte con Pedro",
      topicTags: ["walking", "movement"],
      timeSlots: ["morning", "afternoon"],
      featured: false,
      participantCount: 5,
      sessionDate: today,
      topic:
        language === "en"
          ? "Five minutes still count"
          : language === "de"
            ? "Fünf Minuten zählen auch"
            : "Cinco minutos también cuentan",
      opener:
        language === "en"
          ? "Hello, I’m Pedro. When does your body enjoy moving most?"
          : language === "de"
            ? "Hallo, ich bin Pedro. Wann bewegt sich dein Körper am liebsten?"
            : "Hola, soy Pedro. ¿Cuándo disfruta más tu cuerpo moverse?",
      quote: "",
      activityType: "advice",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "A gentle movement question"
          : language === "de"
            ? "Eine sanfte Bewegungsfrage"
            : "Una pregunta suave sobre movimiento",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "5 in the room" : language === "de" ? "5 im Raum" : "5 en la sala",
    },
    "news-cafe": {
      slug: "news-cafe",
      name: language === "en" ? "News Café" : language === "de" ? "Das Nachrichtencafé" : "El Café de las Noticias",
      category: "useful",
      agentSlug: "elena",
      agentFullName: "Elena Castillo",
      agentColour: "#92400E",
      agentCredential:
        language === "en"
          ? "Journalist · Positive news"
          : language === "de"
            ? "Journalistin · Positive Nachrichten"
            : "Periodista · Noticias positivas",
      ctaLabel: language === "en" ? "Understand with Elena" : language === "de" ? "Mit Elena verstehen" : "Entender con Elena",
      topicTags: ["news", "culture"],
      timeSlots: ["morning", "afternoon"],
      featured: false,
      participantCount: 4,
      sessionDate: today,
      topic:
        language === "en"
          ? "One hopeful story for today"
          : language === "de"
            ? "Eine hoffnungsvolle Geschichte für heute"
            : "Una noticia esperanzadora para hoy",
      opener:
        language === "en"
          ? "Hello, I’m Elena. Shall we look at one piece of good news together?"
          : language === "de"
            ? "Hallo, ich bin Elena. Wollen wir gemeinsam eine gute Nachricht anschauen?"
            : "Hola, soy Elena. ¿Vemos juntas una buena noticia de hoy?",
      quote: "",
      activityType: "discussion",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "A calm news conversation"
          : language === "de"
            ? "Ein ruhiges Nachrichtengespräch"
            : "Una conversación tranquila sobre noticias",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "4 in the room" : language === "de" ? "4 im Raum" : "4 en la sala",
    },
    "pen-pals": {
      slug: "pen-pals",
      name: language === "en" ? "Pen Pals" : language === "de" ? "Die Brieffreunde" : "Amigos por Correspondencia",
      category: "connection",
      agentSlug: "vyva",
      agentFullName: "VYVA Conecta",
      agentColour: "#5B21B6",
      agentCredential:
        language === "en"
          ? "Matching by interests"
          : language === "de"
            ? "Matching nach Interessen"
            : "Matching por intereses",
      ctaLabel: language === "en" ? "Meet someone" : language === "de" ? "Jemanden kennenlernen" : "Conocer a alguien",
      topicTags: ["friendship", "connection"],
      timeSlots: ["morning", "afternoon", "evening"],
      featured: false,
      participantCount: 3,
      sessionDate: today,
      topic:
        language === "en"
          ? "Who would you enjoy writing to?"
          : language === "de"
            ? "Wem würdest du gern schreiben?"
            : "¿A quién te gustaría escribir?",
      opener:
        language === "en"
          ? "Hello, I’m VYVA. What kind of person would you enjoy meeting here?"
          : language === "de"
            ? "Hallo, ich bin VYVA. Welche Art von Person würdest du hier gern kennenlernen?"
            : "Hola, soy VYVA. ¿Qué tipo de persona te gustaría conocer aquí?",
      quote: "",
      activityType: "discussion",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "A gentle way to connect"
          : language === "de"
            ? "Ein sanfter Weg zur Verbindung"
            : "Una forma amable de conectar",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "3 in the room" : language === "de" ? "3 im Raum" : "3 en la sala",
    },
    "heritage-exchange": {
      slug: "heritage-exchange",
      name: language === "en" ? "Heritage Exchange" : language === "de" ? "Der Kulturaustausch" : "El Intercambio Cultural",
      category: "connection",
      agentSlug: "vyva",
      agentFullName: "VYVA Conecta",
      agentColour: "#5B21B6",
      agentCredential:
        language === "en"
          ? "Matching by interests"
          : language === "de"
            ? "Matching nach Interessen"
            : "Matching por intereses",
      ctaLabel: language === "en" ? "Share culture" : language === "de" ? "Kultur teilen" : "Compartir cultura",
      topicTags: ["culture", "heritage"],
      timeSlots: ["afternoon", "evening"],
      featured: false,
      participantCount: 4,
      sessionDate: today,
      topic:
        language === "en"
          ? "What tradition would you share first?"
          : language === "de"
            ? "Welche Tradition würdest du zuerst teilen?"
            : "¿Qué tradición compartirías primero?",
      opener:
        language === "en"
          ? "Hello, I’m VYVA. Which tradition from your life would you love to share today?"
          : language === "de"
            ? "Hallo, ich bin VYVA. Welche Tradition aus deinem Leben würdest du heute gern teilen?"
            : "Hola, soy VYVA. ¿Qué tradición de tu vida te gustaría compartir hoy?",
      quote: "",
      activityType: "story",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "A cultural memory prompt"
          : language === "de"
            ? "Ein kultureller Erinnerungsimpuls"
            : "Una invitación a compartir cultura",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "4 in the room" : language === "de" ? "4 im Raum" : "4 en la sala",
    },
  };

  const room = roomMap[canonicalSlug];
  if (!room) return null;

  return {
    room,
    transcript: [
      {
        id: `${canonicalSlug}-fallback-welcome`,
        speaker: "agent",
        text: room.opener,
        createdAt: new Date().toISOString(),
      },
    ],
    promptChips: getQuickQuestions(canonicalSlug, language, []),
    members: buildFallbackMembers(room, language),
    memberChat: [],
    visitState: {
      isFirstVisit: true,
      previousVisitCount: 0,
      visitCount: 0,
    },
    conversationContext: {
      generatedAt: new Date().toISOString(),
      lines: [],
      text: "No recent report context available.",
      facts: {},
    },
  };
}

const RoomScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug = "" } = useParams();
  const { profile, firstName } = useProfile();
  const { language: appLanguage } = useLanguage();
  const language = getSocialLanguage(appLanguage);
  const movementExerciseLanguage = getMovementExerciseLanguage(appLanguage);
  const gameLanguage = getSocialGameLanguage(appLanguage);
  const requestLanguage = slug === "games-room" || slug === "together-room" ? gameLanguage : language;
  const copy = getSocialCopy(language);
  const storyHandoffNote = useMemo(() => getStoryRoomHandoffNote(location.state), [location.state]);

  const [visitId, setVisitId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [latestQuestion, setLatestQuestion] = useState("");
  const [latestAnswer, setLatestAnswer] = useState("");
  const [agentPresence, setAgentPresence] = useState<AgentPresence>("idle");
  const [membersOpen, setMembersOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<SocialRoomMember | null>(null);
  const [pendingConnections, setPendingConnections] = useState<Record<string, boolean>>({});
  const [commentComposerFor, setCommentComposerFor] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [extraComments, setExtraComments] = useState<Record<string, FeedComment[]>>({});
  const [voiceAttempted, setVoiceAttempted] = useState(false);
  const [roomMode, setRoomMode] = useState<RoomMode>("welcome");
  const [selectedTogetherPlanId, setSelectedTogetherPlanId] = useState("restaurant");
  const [chatDraft, setChatDraft] = useState("");
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const [isChatSending, setIsChatSending] = useState(false);
  const [localChatMessages, setLocalChatMessages] = useState<SocialRoomChatItem[]>([]);
  const [roomEntryVisitState, setRoomEntryVisitState] = useState<SocialRoomVisitState | null>(null);
  const [roomEntryConversationContext, setRoomEntryConversationContext] = useState<SocialConversationContext | null>(null);
  const [readingMatchResponse, setReadingMatchResponse] = useState<SocialMatchResponse | null>(null);
  const [isReadingMatching, setIsReadingMatching] = useState(false);
  const [isReadingGreetingSending, setIsReadingGreetingSending] = useState(false);
  const [readingGreetingStatus, setReadingGreetingStatus] = useState("");
  const [selectedReadingModeId, setSelectedReadingModeId] = useState("one-to-one");
  const [readingReflectionDraft, setReadingReflectionDraft] = useState("");
  const [readingLetterRecipientDraft, setReadingLetterRecipientDraft] = useState("");
  const [readingLetterSubjectDraft, setReadingLetterSubjectDraft] = useState("");
  const [readingLetterBodyDraft, setReadingLetterBodyDraft] = useState("");
  const [selectedReadingExchangeKindId, setSelectedReadingExchangeKindId] = useState<ReadingClubExchangeKindId>("recommendation");
  const [selectedReadingExchangeShelfId, setSelectedReadingExchangeShelfId] = useState<ReadingClubShelfId>("memoir");
  const [readingExchangeTopicDraft, setReadingExchangeTopicDraft] = useState("");
  const [readingExchangeNoteDraft, setReadingExchangeNoteDraft] = useState("");
  const [readingRecommendationDraft, setReadingRecommendationDraft] = useState("");
  const [readingTableTopicDraft, setReadingTableTopicDraft] = useState("");
  const [readingTableNoteDraft, setReadingTableNoteDraft] = useState("");
  const [selectedReadingTableCircleId, setSelectedReadingTableCircleId] = useState("open-club");
  const [selectedReadingTableTimeId, setSelectedReadingTableTimeId] = useState<ReadingClubTableTimeId>("today");
  const [selectedReadingTableComfortId, setSelectedReadingTableComfortId] = useState<ReadingClubTableComfortId>("listening");
  const [readingPassportCompletions, setReadingPassportCompletions] = useState<Record<string, boolean>>({});
  const [readingPulse, setReadingPulse] = useState<SocialRoomPulse | null>(null);
  const [readingClubStatus, setReadingClubStatus] = useState("");
  const [isReadingPulseSending, setIsReadingPulseSending] = useState(false);
  const [readingClubShowDeepTools, setReadingClubShowDeepTools] = useState(false);
  const [readingClubFocusedPath, setReadingClubFocusedPath] = useState<ReadingClubFocusedPath | null>(null);
  const [readingClubDesk, setReadingClubDesk] = useState<ReadingClubDeskState>(() => loadReadingClubDeskState());
  const [completedMovementExerciseId, setCompletedMovementExerciseId] = useState<MovementExerciseCardId | null>(null);
  const [lastMovementExerciseId, setLastMovementExerciseId] = useState<MovementExerciseCardId | null>(() => loadLastMovementExerciseId());
  const [movementComfortLevel, setMovementComfortLevel] = useState<MovementComfortLevelId>(() => loadMovementComfortLevel());
  const [movementWeekLogDates, setMovementWeekLogDates] = useState<string[]>(() => loadMovementWeekLogDates());
  const [isMovementExerciseLibraryExpanded, setMovementExerciseLibraryExpanded] = useState(false);
  const [selectedMovementExerciseGroup, setSelectedMovementExerciseGroup] = useState<MovementExerciseGroupId>("mobility");
  const [prefilledStoryHandoffId, setPrefilledStoryHandoffId] = useState<string | null>(null);
  const [dismissedStoryHandoffId, setDismissedStoryHandoffId] = useState<string | null>(null);
  const [placedStoryHandoff, setPlacedStoryHandoff] = useState<StoryRoomHandoffNote | null>(null);
  const {
    startVoice,
    stopVoice,
    sendText: sendAgentText,
    sendContextUpdate,
    status: agentSessionStatus,
    isSpeaking: agentIsSpeaking,
    isUserSpeaking,
    isConnecting: agentIsConnecting,
    hasMicrophone,
    lastError: agentVoiceError,
    transcript: agentTranscript,
    beginUserTurn,
    endUserTurn,
  } = useVyvaVoice();

  const leaveVisitIdRef = useRef<string | null>(null);
  const thinkingTimerRef = useRef<number | null>(null);
  const speakingTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptCursorRef = useRef(0);
  const liveGreetingKeyRef = useRef<string | null>(null);
  const pendingQuestionRef = useRef<string | null>(null);
  const queuedQuestionRef = useRef<string | null>(null);
  const startListeningWhenReadyRef = useRef(false);
  const autoStartedRoomRef = useRef<string | null>(null);
  const liveReplyTimeoutRef = useRef<number | null>(null);
  const reconnectFallbackTimeoutRef = useRef<number | null>(null);

  const { data, isLoading, isError } = useQuery<SocialRoomResponse>({
    queryKey: [`/api/social/rooms/${slug}?lang=${requestLanguage}`],
    enabled: Boolean(slug),
    staleTime: 30 * 1000,
  });

  const roomResponse = useMemo(() => data ?? buildFallbackRoomResponse(slug, language), [data, language, slug]);
  const room = roomResponse?.room;
  const canonicalRoomSlug = room?.slug ?? (isReadingRoomSlug(slug) ? "reading-room" : slug);
  const activeStoryHandoff = storyHandoffNote && dismissedStoryHandoffId !== storyHandoffNote.id ? storyHandoffNote : null;
  const replyLoopStoryHandoff = placedStoryHandoff && dismissedStoryHandoffId === placedStoryHandoff.id
    ? placedStoryHandoff
    : null;

  const roomMembers = useMemo(() => {
    if (!room) return [];
    return roomResponse?.members?.length ? roomResponse.members : buildFallbackMembers(room, language);
  }, [language, room, roomResponse]);

  const togetherRoomActive = isTogetherRoom(room?.slug ?? slug);
  const togetherCopy = togetherRoomActive ? getTogetherRoomCopy(gameLanguage) : null;
  const readingRoomActive = isReadingRoomSlug(room?.slug ?? slug);
  const movementRoomActive = canonicalRoomSlug === "morning-movement";
  const movementExerciseCopy = useMemo(() => getMovementExerciseLibraryCopy(movementExerciseLanguage), [movementExerciseLanguage]);
  const movementSessionUiCopy = useMemo(() => getMovementSessionUiCopy(movementExerciseLanguage), [movementExerciseLanguage]);
  const movementWeekDays = useMemo(() => getMovementWeekDays(movementExerciseLanguage), [movementExerciseLanguage]);
  const movementWeekCompletedCount = useMemo(
    () => movementWeekDays.filter((day) => movementWeekLogDates.includes(day.dateKey)).length,
    [movementWeekDays, movementWeekLogDates],
  );
  const recommendedMovementExerciseId = useMemo(() => getRecommendedMovementExerciseId(new Date(), movementComfortLevel), [movementComfortLevel]);
  const movementFeaturedExerciseCards = useMemo(() => {
    const featuredIds = new Set(MOVEMENT_FEATURED_EXERCISE_IDS);
    return movementExerciseCopy.cards.filter((card) => featuredIds.has(card.id));
  }, [movementExerciseCopy.cards]);
  const recommendedMovementExercise = useMemo(
    () => movementExerciseCopy.cards.find((card) => card.id === recommendedMovementExerciseId) ?? null,
    [movementExerciseCopy.cards, recommendedMovementExerciseId],
  );
  const recommendedMovementExerciseVisual = recommendedMovementExercise ? MOVEMENT_EXERCISE_VISUALS[recommendedMovementExercise.id] : null;
  const lastMovementExercise = lastMovementExerciseId
    ? movementExerciseCopy.cards.find((card) => card.id === lastMovementExerciseId) ?? null
    : null;
  const repeatMovementExerciseId = lastMovementExerciseId ?? recommendedMovementExerciseId;
  const selectedMovementExerciseGroupCopy =
    movementExerciseCopy.groups.find((group) => group.id === selectedMovementExerciseGroup) ?? movementExerciseCopy.groups[0];
  const selectedMovementExerciseGroupCards = useMemo(() => {
    const featuredIds = new Set(MOVEMENT_FEATURED_EXERCISE_IDS);
    return movementExerciseCopy.cards.filter((card) => card.group === selectedMovementExerciseGroup && !featuredIds.has(card.id));
  }, [movementExerciseCopy.cards, selectedMovementExerciseGroup]);
  const completedMovementExercise = completedMovementExerciseId
    ? movementExerciseCopy.cards.find((card) => card.id === completedMovementExerciseId) ?? null
    : null;
  const readingClubCopy = useMemo(() => getReadingClubCopy(language), [language]);
  const readingClub = useMemo(
    () => (
      roomResponse?.readingClub ??
      buildFallbackReadingClubDestination(language, roomMembers, room?.participantCount ?? 7)
    ),
    [language, room?.participantCount, roomResponse?.readingClub, roomMembers],
  );
  const selectedReadingMode = useMemo(
    () => readingClub.companionModes.find((mode) => mode.id === selectedReadingModeId) ?? readingClub.companionModes[0],
    [readingClub.companionModes, selectedReadingModeId],
  );
  const selectedReadingIntent = useMemo(
    () => readingClubCopy.intentions.find((intent) => intent.id === readingClubDesk.selectedIntentId) ?? readingClubCopy.intentions[0],
    [readingClubCopy.intentions, readingClubDesk.selectedIntentId],
  );
  const selectedReadingShelf = useMemo(
    () => readingClubCopy.shelfOptions.find((shelf) => shelf.id === readingClubDesk.favoriteShelfId) ?? readingClubCopy.shelfOptions[0],
    [readingClubCopy.shelfOptions, readingClubDesk.favoriteShelfId],
  );
  const selectedReadingPace = useMemo(
    () => readingClubCopy.paceOptions.find((pace) => pace.id === readingClubDesk.preferredPaceId) ?? readingClubCopy.paceOptions[0],
    [readingClubCopy.paceOptions, readingClubDesk.preferredPaceId],
  );
  const readingBridgePrompt = useMemo(
    () => buildReadingClubBridgePrompt(readingClubDesk, language),
    [language, readingClubDesk],
  );
  const readingPreferenceTags = useMemo(
    () => getReadingClubPreferenceTags(readingClubDesk),
    [readingClubDesk],
  );
  const readingClubMilestones = useMemo(
    () => getReadingClubMilestones(readingClubDesk),
    [readingClubDesk],
  );
  const readingClubNextStepId = useMemo(
    () => getReadingClubNextStepId(readingClubDesk),
    [readingClubDesk],
  );
  const readingClubNextStep = readingClubCopy.nextSteps[readingClubNextStepId];
  const readingPassportDoneCount = useMemo(
    () => readingClub.passportItems.filter((item) => readingPassportCompletions[item.id]).length,
    [readingClub.passportItems, readingPassportCompletions],
  );
  const activeReadingPulse = useMemo(
    () => (readingRoomActive ? readingPulse ?? roomResponse?.pulse ?? null : null),
    [readingPulse, readingRoomActive, roomResponse?.pulse],
  );
  const activeReadingPosts = useMemo(
    () => activeReadingPulse?.postedExperiences.filter((plan) => plan.status === "active").slice(0, 4) ?? [],
    [activeReadingPulse?.postedExperiences],
  );
  const readingClubUpdates = useMemo(
    () => activeReadingPulse?.notifications.slice(0, 2) ?? [],
    [activeReadingPulse?.notifications],
  );
  const savedReadingProgramSessions = useMemo(() => {
    const plannedIds = new Set(readingClubDesk.plannedProgramSessionIds);
    return readingClubCopy.programSessions.filter((session) => plannedIds.has(session.id));
  }, [readingClubCopy.programSessions, readingClubDesk.plannedProgramSessionIds]);
  const joinedReadingCircles = useMemo(() => {
    const circleIds = new Set(readingClubDesk.joinedReaderCircleIds);
    return readingClubCopy.readerCircles.filter((circle) => circleIds.has(circle.id));
  }, [readingClubCopy.readerCircles, readingClubDesk.joinedReaderCircleIds]);
  const readingHostCircleOptions = useMemo(() => [
    {
      id: "open-club",
      title: readingClubCopy.hostTableOpenClubLabel,
      body: readingClubCopy.hostTableOpenClubBody,
    },
    ...readingClubCopy.readerCircles.map((circle) => ({
      id: circle.id,
      title: circle.title,
      body: circle.body,
    })),
  ], [readingClubCopy.hostTableOpenClubBody, readingClubCopy.hostTableOpenClubLabel, readingClubCopy.readerCircles]);
  const latestReadingJournalEntries = useMemo(
    () => readingClubDesk.journalEntries.slice(0, 3),
    [readingClubDesk.journalEntries],
  );
  const selectedReadingCircleForJournal = joinedReadingCircles[0] ?? null;
  const canSaveReadingJournalPage = Boolean(readingReflectionDraft.trim() || readingClubDesk.lastReflection.trim());
  const latestReadingLetters = useMemo(
    () => readingClubDesk.letters.slice(0, 3),
    [readingClubDesk.letters],
  );
  const latestReadingExchangeRequests = useMemo(
    () => readingClubDesk.exchangeRequests.slice(0, 3),
    [readingClubDesk.exchangeRequests],
  );
  const latestReadingRecommendationCards = useMemo(
    () => readingClubDesk.recommendationCards.slice(0, 3),
    [readingClubDesk.recommendationCards],
  );
  const latestHostedReadingTables = useMemo(
    () => readingClubDesk.hostedTables.slice(0, 3),
    [readingClubDesk.hostedTables],
  );
  const readingLetterRecipientSuggestion =
    readingMatchResponse?.matchedUser?.name ??
    selectedReadingCircleForJournal?.title ??
    readingClubCopy.letterDefaultRecipient;
  const canSaveReadingLetter = Boolean(readingLetterBodyDraft.trim());
  const readingPollClosed = activeReadingPulse?.activePoll.status !== "active";
  const togetherPlans = useMemo(() => getTogetherPlans(language), [language]);
  const selectedTogetherPlan = useMemo(
    () => togetherPlans.find((plan) => plan.id === selectedTogetherPlanId) ?? togetherPlans[0],
    [selectedTogetherPlanId, togetherPlans],
  );
  const selectedTogetherMember = roomMembers.length
    ? roomMembers[selectedTogetherPlan.memberIndex % roomMembers.length]
    : null;

  const openMovementExerciseLibrary = useCallback(() => {
    setMovementExerciseLibraryExpanded((current) => !current);
  }, []);

  const openMovementExerciseCard = useCallback((exerciseId: MovementExerciseCardId) => {
    navigate(`/social-rooms/morning-movement/exercises/${exerciseId}`);
  }, [navigate]);

  const selectMovementComfortLevel = useCallback((comfortLevel: MovementComfortLevelId) => {
    setMovementComfortLevel(comfortLevel);
    saveMovementComfortLevel(comfortLevel);
  }, []);

  const openMovementRepeatExercise = useCallback(() => {
    openMovementExerciseCard(repeatMovementExerciseId);
  }, [openMovementExerciseCard, repeatMovementExerciseId]);

  const openMovementSwapExercise = useCallback((intent: MovementSwapIntent) => {
    openMovementExerciseCard(getMovementSwapExerciseId(intent, movementComfortLevel, lastMovementExerciseId));
  }, [lastMovementExerciseId, movementComfortLevel, openMovementExerciseCard]);

  useEffect(() => {
    const loggedExerciseId = (location.state as { movementExerciseLoggedId?: unknown } | null)?.movementExerciseLoggedId;
    if (typeof loggedExerciseId !== "string" || !isMovementExerciseCardId(loggedExerciseId)) return;

    setCompletedMovementExerciseId(loggedExerciseId);
    setLastMovementExerciseId(loggedExerciseId);
    setMovementWeekLogDates(loadMovementWeekLogDates());
  }, [location.state]);

  const agentName = useMemo(() => {
    if (!room) return "";
    return room.agentFullName.split(" ")[0] ?? room.agentFullName;
  }, [room]);

  const quickQuestions = useMemo(
    () => getQuickQuestions(canonicalRoomSlug, language, roomResponse?.promptChips ?? []),
    [canonicalRoomSlug, language, roomResponse?.promptChips],
  );

  const roomChat = useMemo<SocialRoomChatItem[]>(
    () => roomResponse?.memberChat ?? [],
    [roomResponse?.memberChat],
  );

  const currentVisitState = roomEntryVisitState ?? roomResponse?.visitState ?? null;
  const currentConversationContext = roomEntryConversationContext ?? roomResponse?.conversationContext ?? null;

  const updateReadingDesk = useCallback((updater: (current: ReadingClubDeskState) => ReadingClubDeskState) => {
    setReadingClubDesk((current) => {
      const next = updater(current);
      saveReadingClubDeskState(next);
      return next;
    });
  }, []);

  const completeReadingPassportItem = useCallback((itemId: string, completed = true) => {
    setReadingPassportCompletions((current) => ({ ...current, [itemId]: completed }));
    updateReadingDesk((current) => markReadingClubPassport(current, itemId, completed));
  }, [updateReadingDesk]);

  const incrementReadingProgressMetric = useCallback((metricId: ReadingClubProgressMetricId) => {
    updateReadingDesk((current) => incrementReadingClubProgress(current, metricId));
  }, [updateReadingDesk]);

  const saveReadingShelfItem = useCallback((
    item: Parameters<typeof addReadingClubShelfItem>[1],
    showStatus = true,
  ) => {
    updateReadingDesk((current) => addReadingClubShelfItem(current, item));
    if (showStatus) {
      setReadingClubStatus(readingClubCopy.savedShelfSavedLabel);
    }
  }, [readingClubCopy.savedShelfSavedLabel, updateReadingDesk]);

  const removeReadingShelfItem = useCallback((itemId: string) => {
    updateReadingDesk((current) => removeReadingClubShelfItem(current, itemId));
  }, [updateReadingDesk]);

  const saveReadingRecommendationCard = useCallback(() => {
    const recommendation = readingRecommendationDraft.trim();
    if (!recommendation) return;

    updateReadingDesk((current) => markReadingClubPassport(
      incrementReadingClubProgress(
        saveReadingClubRecommendationCard(current, {
          shelfId: current.favoriteShelfId,
          moodId: "comfort",
          title: recommendation,
          note: "",
        }),
        "recommendationsMade",
      ),
      "recommend",
      true,
    ));
    setReadingPassportCompletions((current) => ({ ...current, recommend: true }));
    setReadingRecommendationDraft("");
    setReadingClubStatus(readingClubCopy.recommendationSavedStatusLabel);
  }, [
    readingClubCopy.recommendationSavedStatusLabel,
    readingRecommendationDraft,
    updateReadingDesk,
  ]);

  const removeReadingRecommendationCard = useCallback((cardId: string) => {
    updateReadingDesk((current) => removeReadingClubRecommendationCard(current, cardId));
    setReadingClubStatus(readingClubCopy.recommendationRemovedStatusLabel);
  }, [readingClubCopy.recommendationRemovedStatusLabel, updateReadingDesk]);

  const applyReadingRecommendationCard = useCallback((card: ReadingClubDeskState["recommendationCards"][number]) => {
    setReadingReflectionDraft(card.note ? `${card.title} - ${card.note}` : card.title);
    setReadingClubStatus(readingClubCopy.recommendationReadyStatusLabel);
  }, [readingClubCopy.recommendationReadyStatusLabel]);

  const saveReadingProgramSeat = useCallback((sessionId: string) => {
    updateReadingDesk((current) => saveReadingClubProgramSession(current, sessionId));
    setReadingClubStatus(readingClubCopy.programSavedStatusLabel);
  }, [readingClubCopy.programSavedStatusLabel, updateReadingDesk]);

  const removeReadingProgramSeat = useCallback((sessionId: string) => {
    updateReadingDesk((current) => removeReadingClubProgramSession(current, sessionId));
    setReadingClubStatus(readingClubCopy.programRemovedStatusLabel);
  }, [readingClubCopy.programRemovedStatusLabel, updateReadingDesk]);

  const joinReadingCircle = useCallback((circleId: string) => {
    updateReadingDesk((current) => joinReadingClubCircle(current, circleId));
    setReadingClubStatus(readingClubCopy.circleJoinedStatusLabel);
  }, [readingClubCopy.circleJoinedStatusLabel, updateReadingDesk]);

  const leaveReadingCircle = useCallback((circleId: string) => {
    updateReadingDesk((current) => leaveReadingClubCircle(current, circleId));
    setReadingClubStatus(readingClubCopy.circleLeftStatusLabel);
  }, [readingClubCopy.circleLeftStatusLabel, updateReadingDesk]);

  const markReadingConversationCardUsed = useCallback((card: ReturnType<typeof getReadingClubCopy>["conversationCards"][number]) => {
    setReadingReflectionDraft(card.prompt);
    updateReadingDesk((current) => markReadingClubConversationCardUsed(current, card.id));
    setReadingClubStatus(readingClubCopy.conversationReadyStatusLabel);
  }, [readingClubCopy.conversationReadyStatusLabel, updateReadingDesk]);

  const applyReadingJournalPrompt = useCallback((prompt: ReturnType<typeof getReadingClubCopy>["journalPrompts"][number]) => {
    setReadingReflectionDraft(prompt.draft);
    setReadingClubStatus(readingClubCopy.journalPromptReadyLabel);
  }, [readingClubCopy.journalPromptReadyLabel]);

  const saveReadingJournalPage = useCallback(() => {
    const body = readingReflectionDraft.trim() || readingClubDesk.lastReflection.trim();
    if (!body) return;

    updateReadingDesk((current) => addReadingClubJournalEntry(current, {
      title: summarizeReadingPostTitle(body) || readingClubCopy.journalDefaultTitle,
      body,
      circleId: selectedReadingCircleForJournal?.id ?? null,
    }));
    setReadingClubStatus(readingClubCopy.journalSavedLabel);
  }, [
    readingClubCopy.journalDefaultTitle,
    readingClubCopy.journalSavedLabel,
    readingClubDesk.lastReflection,
    readingReflectionDraft,
    selectedReadingCircleForJournal?.id,
    updateReadingDesk,
  ]);

  const removeReadingJournalPage = useCallback((entryId: string) => {
    updateReadingDesk((current) => removeReadingClubJournalEntry(current, entryId));
    setReadingClubStatus(readingClubCopy.journalRemovedLabel);
  }, [readingClubCopy.journalRemovedLabel, updateReadingDesk]);

  const applyReadingLetterPrompt = useCallback((prompt: ReturnType<typeof getReadingClubCopy>["letterPrompts"][number]) => {
    if (!readingLetterRecipientDraft.trim()) {
      setReadingLetterRecipientDraft(readingLetterRecipientSuggestion);
    }
    setReadingLetterSubjectDraft(prompt.subject);
    setReadingLetterBodyDraft(prompt.body);
    setSelectedReadingModeId("pen-note");
    updateReadingDesk((current) => updateReadingClubDeskState(current, {
      selectedModeId: "pen-note",
      preferredPaceId: "letters",
    }));
  }, [readingLetterRecipientDraft, readingLetterRecipientSuggestion, updateReadingDesk]);

  const prepareReadingLoungeLetter = useCallback((member: SocialRoomMember) => {
    setReadingLetterRecipientDraft(member.name);
    setReadingLetterSubjectDraft(readingClubCopy.memberLoungeLetterSubject);
    setReadingLetterBodyDraft(readingClubCopy.memberLoungeLetterDraft.replace("{name}", member.name));
    setSelectedReadingModeId("pen-note");
    updateReadingDesk((current) => updateReadingClubDeskState(current, {
      selectedModeId: "pen-note",
      preferredPaceId: "letters",
    }));
    setReadingClubStatus(readingClubCopy.memberLoungeLetterReadyStatus);
  }, [
    readingClubCopy.memberLoungeLetterDraft,
    readingClubCopy.memberLoungeLetterReadyStatus,
    readingClubCopy.memberLoungeLetterSubject,
    updateReadingDesk,
  ]);

  const prepareReadingLoungeTable = useCallback((member: SocialRoomMember) => {
    setReadingTableTopicDraft(readingClubCopy.memberLoungeTableTopic.replace("{name}", member.name));
    setReadingTableNoteDraft(readingClubCopy.memberLoungeTableNote.replace("{name}", member.name));
    setSelectedReadingTableCircleId(selectedReadingCircleForJournal?.id ?? "open-club");
    setSelectedReadingTableTimeId("today");
    setSelectedReadingTableComfortId("listening");
    setReadingClubStatus(readingClubCopy.memberLoungeTableReadyStatus);
  }, [
    readingClubCopy.memberLoungeTableNote,
    readingClubCopy.memberLoungeTableReadyStatus,
    readingClubCopy.memberLoungeTableTopic,
    selectedReadingCircleForJournal?.id,
  ]);

  const saveReadingLetterDraft = useCallback(() => {
    const body = readingLetterBodyDraft.trim();
    if (!body) return;

    updateReadingDesk((current) => saveReadingClubLetterDraft(current, {
      recipientName: readingLetterRecipientDraft.trim() || readingLetterRecipientSuggestion,
      subject: readingLetterSubjectDraft.trim() || readingClubCopy.letterDefaultSubject,
      body,
    }));
    setReadingClubStatus(readingClubCopy.letterSavedStatusLabel);
  }, [
    readingClubCopy.letterDefaultSubject,
    readingClubCopy.letterSavedStatusLabel,
    readingLetterBodyDraft,
    readingLetterRecipientDraft,
    readingLetterRecipientSuggestion,
    readingLetterSubjectDraft,
    updateReadingDesk,
  ]);

  const markReadingLetterSent = useCallback((letterId: string) => {
    updateReadingDesk((current) => markReadingClubPassport(
      incrementReadingClubProgress(markReadingClubLetterSent(current, letterId), "greetingsSent"),
      "greet",
      true,
    ));
    setReadingPassportCompletions((current) => ({ ...current, greet: true }));
    setReadingClubStatus(readingClubCopy.letterSentStatusLabel);
  }, [readingClubCopy.letterSentStatusLabel, updateReadingDesk]);

  const removeReadingLetterDraft = useCallback((letterId: string) => {
    updateReadingDesk((current) => removeReadingClubLetter(current, letterId));
    setReadingClubStatus(readingClubCopy.letterRemovedStatusLabel);
  }, [readingClubCopy.letterRemovedStatusLabel, updateReadingDesk]);

  const saveReadingExchangeRequest = useCallback(() => {
    const topic = readingExchangeTopicDraft.trim();
    if (!topic) return;

    updateReadingDesk((current) => markReadingClubPassport(
      incrementReadingClubProgress(
        saveReadingClubExchangeRequest(current, {
          kindId: selectedReadingExchangeKindId,
          shelfId: selectedReadingExchangeShelfId,
          topic,
          note: readingExchangeNoteDraft,
        }),
        "reflectionsShared",
      ),
      "share",
      true,
    ));
    setReadingPassportCompletions((current) => ({ ...current, share: true }));
    setReadingExchangeTopicDraft("");
    setReadingExchangeNoteDraft("");
    setReadingClubStatus(readingClubCopy.exchangeSavedStatusLabel);
  }, [
    readingClubCopy.exchangeSavedStatusLabel,
    readingExchangeNoteDraft,
    readingExchangeTopicDraft,
    selectedReadingExchangeKindId,
    selectedReadingExchangeShelfId,
    updateReadingDesk,
  ]);

  const removeReadingExchangeRequest = useCallback((requestId: string) => {
    updateReadingDesk((current) => removeReadingClubExchangeRequest(current, requestId));
    setReadingClubStatus(readingClubCopy.exchangeRemovedStatusLabel);
  }, [readingClubCopy.exchangeRemovedStatusLabel, updateReadingDesk]);

  const applyReadingExchangeRequest = useCallback((request: ReadingClubDeskState["exchangeRequests"][number]) => {
    setReadingReflectionDraft(request.note ? `${request.topic} - ${request.note}` : request.topic);
    setReadingClubStatus(readingClubCopy.exchangeReadyStatusLabel);
  }, [readingClubCopy.exchangeReadyStatusLabel]);

  const publishReadingHostedTable = useCallback(() => {
    const topic = readingTableTopicDraft.trim();
    if (!topic) return;

    updateReadingDesk((current) => markReadingClubPassport(
      incrementReadingClubProgress(
        saveReadingClubHostedTable(current, {
          topic,
          circleId: selectedReadingTableCircleId,
          timeSlotId: selectedReadingTableTimeId,
          comfortId: selectedReadingTableComfortId,
          note: readingTableNoteDraft,
        }),
        "tablesJoined",
      ),
      "join",
      true,
    ));
    setReadingPassportCompletions((current) => ({ ...current, join: true }));
    setReadingTableTopicDraft("");
    setReadingTableNoteDraft("");
    setReadingClubStatus(readingClubCopy.hostTableSavedStatusLabel);
  }, [
    readingClubCopy.hostTableSavedStatusLabel,
    readingTableNoteDraft,
    readingTableTopicDraft,
    selectedReadingTableCircleId,
    selectedReadingTableComfortId,
    selectedReadingTableTimeId,
    updateReadingDesk,
  ]);

  const removeReadingHostedTable = useCallback((tableId: string) => {
    updateReadingDesk((current) => removeReadingClubHostedTable(current, tableId));
    setReadingClubStatus(readingClubCopy.hostTableRemovedStatusLabel);
  }, [readingClubCopy.hostTableRemovedStatusLabel, updateReadingDesk]);

  const toggleReadingPassportItem = useCallback((itemId: string) => {
    const completed = !readingPassportCompletions[itemId];
    completeReadingPassportItem(itemId, completed);
  }, [completeReadingPassportItem, readingPassportCompletions]);

  const selectReadingMode = useCallback((modeId: string) => {
    setSelectedReadingModeId(modeId);
    updateReadingDesk((current) => updateReadingClubDeskState(current, { selectedModeId: modeId }));
  }, [updateReadingDesk]);

  const selectReadingShelf = useCallback((shelfId: ReadingClubShelfId) => {
    updateReadingDesk((current) => updateReadingClubDeskState(current, { favoriteShelfId: shelfId }));
  }, [updateReadingDesk]);

  const selectReadingPace = useCallback((paceId: ReadingClubPaceId) => {
    if (paceId === "letters") {
      setSelectedReadingModeId("pen-note");
    }
    updateReadingDesk((current) => updateReadingClubDeskState(current, {
      preferredPaceId: paceId,
      ...(paceId === "letters" ? { selectedModeId: "pen-note" } : {}),
    }));
  }, [updateReadingDesk]);

  const selectReadingIntent = useCallback((intentId: ReadingClubIntentId) => {
    updateReadingDesk((current) => updateReadingClubDeskState(current, { selectedIntentId: intentId }));
    if (intentId === "meet-reader") {
      selectReadingMode("one-to-one");
    }
    if (intentId === "recommend-book") {
      completeReadingPassportItem("recommend", true);
    }
  }, [completeReadingPassportItem, selectReadingMode, updateReadingDesk]);

  const scrollToReadingTool = useCallback((testId: string) => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector(`[data-testid="${testId}"]`);
      if (target instanceof HTMLElement) {
        target.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }
    });
  }, []);

  const revealReadingTool = useCallback((testId: string, path: ReadingClubFocusedPath) => {
    setReadingClubFocusedPath(path);
    setReadingClubShowDeepTools(false);
    window.setTimeout(() => scrollToReadingTool(testId), 0);
  }, [scrollToReadingTool]);

  const startReadingSharePath = useCallback(() => {
    selectReadingIntent("share-memory");
    if (!readingReflectionDraft.trim()) {
      setReadingReflectionDraft(readingClub.reflectionPrompts[0] ?? "");
    }
    revealReadingTool("reading-reflection-card", "share");
  }, [readingClub.reflectionPrompts, readingReflectionDraft, revealReadingTool, selectReadingIntent]);

  const startReadingMeetPath = useCallback(() => {
    selectReadingIntent("meet-reader");
    revealReadingTool("reading-companion-card", "meet");
  }, [revealReadingTool, selectReadingIntent]);

  const startReadingRecommendPath = useCallback(() => {
    selectReadingIntent("recommend-book");
    revealReadingTool("reading-recommendation-shelf", "recommend");
  }, [revealReadingTool, selectReadingIntent]);

  useEffect(() => {
    if (readingRoomActive && roomResponse?.pulse) {
      setReadingPulse(roomResponse.pulse);
      return;
    }

    if (!readingRoomActive) {
      setReadingPulse(null);
      setReadingClubStatus("");
      setReadingMatchResponse(null);
      setReadingGreetingStatus("");
    }
  }, [readingRoomActive, roomResponse?.pulse]);

  useEffect(() => {
    const matchedName = readingMatchResponse?.matchedUser?.name;
    if (!matchedName || readingLetterRecipientDraft.trim()) return;
    setReadingLetterRecipientDraft(matchedName);
  }, [readingLetterRecipientDraft, readingMatchResponse?.matchedUser?.name]);

  const visibleRoomChat = useMemo<SocialRoomChatItem[]>(
    () => [...roomChat, ...localChatMessages],
    [localChatMessages, roomChat],
  );

  const welcomeText = useMemo(() => {
    const liveWelcome = [...agentTranscript]
      .reverse()
      .find((entry) => entry.from === "vyva" && looksLikeGreeting(entry.text))?.text;
    const roomWelcome = roomResponse?.transcript?.find((entry) => entry.speaker === "agent")?.text;

    return (
      liveWelcome ||
      roomWelcome ||
      room?.opener ||
      buildWelcomeGreeting(language, agentName, firstName || profile?.firstName)
    );
  }, [agentName, agentTranscript, firstName, language, profile?.firstName, room?.opener, roomResponse?.transcript]);

  const baseKnowledgeFeed = useMemo(
    () => buildKnowledgeFeed(canonicalRoomSlug, language, roomMembers),
    [canonicalRoomSlug, language, roomMembers],
  );

  const knowledgeFeed = useMemo(() => {
    const enriched = baseKnowledgeFeed.map((item) => ({
      ...item,
      comments: [...item.comments, ...(extraComments[item.id] ?? [])],
    }));

    if (!latestQuestion || !latestAnswer) return enriched;

    return [
      {
        id: "latest-user-question",
        asker: profile?.firstName?.trim() || (language === "en" ? "You" : language === "de" ? "Du" : "Tú"),
        question: latestQuestion,
        answer: latestAnswer,
        comments: extraComments["latest-user-question"] ?? [],
      },
      ...enriched,
    ];
  }, [baseKnowledgeFeed, extraComments, latestAnswer, latestQuestion, language, profile?.firstName]);

  const clearPresenceTimers = useCallback(() => {
    if (thinkingTimerRef.current) {
      window.clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    if (speakingTimerRef.current) {
      window.clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
  }, []);

  const clearLiveReplyTimeout = useCallback(() => {
    if (liveReplyTimeoutRef.current) {
      window.clearTimeout(liveReplyTimeoutRef.current);
      liveReplyTimeoutRef.current = null;
    }
  }, []);

  const clearReconnectFallbackTimeout = useCallback(() => {
    if (reconnectFallbackTimeoutRef.current) {
      window.clearTimeout(reconnectFallbackTimeoutRef.current);
      reconnectFallbackTimeoutRef.current = null;
    }
  }, []);

  const submitFallbackQuestion = useCallback(
    async (trimmed: string) => {
      try {
        const response = await apiFetch(`/api/social/rooms/${slug}/message`, {
          method: "POST",
          body: JSON.stringify({ message: trimmed, lang: language, visitId: visitId ?? undefined }),
        });
        if (!response.ok) {
          setAgentPresence("idle");
          return;
        }

        const result = (await response.json()) as { reply?: string };
        setLatestQuestion(trimmed);
        setLatestAnswer(result.reply ?? "");
        setDraft("");
        clearPresenceTimers();
        setAgentPresence("speaking");
        speakingTimerRef.current = window.setTimeout(() => {
          setAgentPresence("idle");
          speakingTimerRef.current = null;
        }, 2200);
      } finally {
        setIsSending(false);
      }
    },
    [clearPresenceTimers, language, slug, visitId],
  );

  const startRoomAgentSession = useCallback(
    (skipMicrophone = true) => {
      if (!room?.slug || !room.agentSlug || shouldSkipRoomVoiceAutoStart(room.slug)) return;
      void startVoice(undefined, undefined, {
        agentSlug: room.agentSlug,
        roomSlug: room.slug,
        skipMicrophone,
        dynamicVariables: currentVisitState || currentConversationContext
          ? {
              is_first_room_visit: currentVisitState?.isFirstVisit ?? false,
              room_visit_count: currentVisitState?.visitCount ?? 0,
              previous_room_visit_count: currentVisitState?.previousVisitCount ?? currentVisitState?.visitCount ?? 0,
              conversation_context_summary: currentConversationContext?.text ?? "",
            }
          : undefined,
      });
    },
    [currentConversationContext, currentVisitState, room?.agentSlug, room?.slug, startVoice],
  );

  const armLiveReplyTimeout = useCallback(
    (trimmed: string) => {
      clearLiveReplyTimeout();
      liveReplyTimeoutRef.current = window.setTimeout(() => {
        if (pendingQuestionRef.current !== trimmed) return;
        pendingQuestionRef.current = null;
        setIsSending(false);
        void submitFallbackQuestion(trimmed);
      }, 9000);
    },
    [clearLiveReplyTimeout, submitFallbackQuestion],
  );

  const sendLiveQuestion = useCallback(
    async (trimmed: string) => {
      pendingQuestionRef.current = trimmed;
      setLatestQuestion(trimmed);
      setLatestAnswer("");
      setDraft("");
      setIsSending(true);
      setAgentPresence("thinking");

      const sent = sendAgentText(trimmed);
      if (!sent) {
        pendingQuestionRef.current = null;
        setIsSending(false);
        await submitFallbackQuestion(trimmed);
        return;
      }

      armLiveReplyTimeout(trimmed);
    },
    [armLiveReplyTimeout, sendAgentText, submitFallbackQuestion],
  );

  const quietRoomAgent = useCallback(() => {
    clearPresenceTimers();
    clearLiveReplyTimeout();
    clearReconnectFallbackTimeout();
    endUserTurn();
    stopVoice();
    startListeningWhenReadyRef.current = false;
    queuedQuestionRef.current = null;
    pendingQuestionRef.current = null;
    setIsSending(false);
    setAgentPresence("idle");
  }, [clearLiveReplyTimeout, clearPresenceTimers, clearReconnectFallbackTimeout, endUserTurn, stopVoice]);

  useEffect(() => {
    return () => {
      quietRoomAgent();
    };
  }, [quietRoomAgent]);

  useEffect(() => {
    if (shouldSkipRoomVoiceAutoStart(room?.slug)) {
      autoStartedRoomRef.current = null;
      quietRoomAgent();
    }
  }, [quietRoomAgent, room?.slug]);

  useEffect(() => {
    setRoomMode("welcome");
    setChatDraft("");
    setLocalChatMessages([]);
    setIsChatSending(false);
    setRoomEntryVisitState(null);
    setRoomEntryConversationContext(null);
    setReadingMatchResponse(null);
    setIsReadingMatching(false);
    setSelectedReadingModeId("one-to-one");
    setReadingReflectionDraft("");
    setReadingLetterRecipientDraft("");
    setReadingLetterSubjectDraft("");
    setReadingLetterBodyDraft("");
    setSelectedReadingExchangeKindId("recommendation");
    setSelectedReadingExchangeShelfId("memoir");
    setReadingExchangeTopicDraft("");
    setReadingExchangeNoteDraft("");
    setReadingRecommendationDraft("");
    setReadingTableTopicDraft("");
    setReadingTableNoteDraft("");
    setSelectedReadingTableCircleId("open-club");
    setSelectedReadingTableTimeId("today");
    setSelectedReadingTableComfortId("listening");
    setReadingPassportCompletions({});
    setReadingClubShowDeepTools(false);
    setSelectedTogetherPlanId("restaurant");
  }, [slug]);

  useEffect(() => {
    setPlacedStoryHandoff(null);
  }, [storyHandoffNote?.id]);

  useEffect(() => {
    if (!storyHandoffNote || !room?.slug || prefilledStoryHandoffId === storyHandoffNote.id) return;

    const text = storyHandoffNote.text.trim();
    if (!text) return;

    if (room.slug === "together-room") {
      setPrefilledStoryHandoffId(storyHandoffNote.id);
      return;
    }

    if (readingRoomActive) {
      selectReadingIntent("share-memory");
      setReadingReflectionDraft(text);
      revealReadingTool("reading-reflection-card", "share");
    } else {
      setRoomMode("chat");
      setChatDraft(text);
      window.requestAnimationFrame(() => chatInputRef.current?.focus({ preventScroll: true }));
    }

    setPrefilledStoryHandoffId(storyHandoffNote.id);
  }, [
    prefilledStoryHandoffId,
    readingRoomActive,
    revealReadingTool,
    room?.slug,
    selectReadingIntent,
    storyHandoffNote,
  ]);

  useEffect(() => {
    if (!readingRoomActive) return;

    const nextDesk = recordReadingClubVisit(loadReadingClubDeskState());
    saveReadingClubDeskState(nextDesk);
    setReadingClubDesk(nextDesk);
    setSelectedReadingModeId(nextDesk.selectedModeId);
    setSelectedReadingExchangeShelfId(nextDesk.favoriteShelfId);
    setReadingPassportCompletions(Object.fromEntries(nextDesk.completedPassportIds.map((itemId) => [itemId, true])));
  }, [readingRoomActive, slug]);

  useEffect(() => {
    if (!room?.slug || !room.agentSlug) return;

    liveGreetingKeyRef.current = null;
    transcriptCursorRef.current = 0;
    pendingQuestionRef.current = null;
    queuedQuestionRef.current = null;
    startListeningWhenReadyRef.current = false;
    autoStartedRoomRef.current = null;
    setVoiceAttempted(false);
    setAgentPresence("idle");
  }, [room?.agentSlug, room?.slug]);

  useEffect(() => {
    if (!room?.slug || !room.agentSlug || shouldSkipRoomVoiceAutoStart(room.slug)) return;
    if (roomMode === "chat") return;
    if (agentSessionStatus !== "idle" || agentIsConnecting) return;

    const autoStartKey = `${room.slug}:${room.agentSlug}`;
    if (autoStartedRoomRef.current === autoStartKey) return;

    autoStartedRoomRef.current = autoStartKey;
    setVoiceAttempted(true);
    startListeningWhenReadyRef.current = false;
    queuedQuestionRef.current = null;
    pendingQuestionRef.current = null;
    transcriptCursorRef.current = agentTranscript.length;
    setIsSending(false);
    setAgentPresence("thinking");
    startRoomAgentSession(false);
  }, [
    agentIsConnecting,
    agentSessionStatus,
    agentTranscript.length,
    room?.agentSlug,
    room?.slug,
    roomMode,
    startRoomAgentSession,
  ]);

  useEffect(() => {
    if (!room || agentSessionStatus !== "connected") return;

    const userDisplayName = firstName || profile?.firstName;
    const visitKey = currentVisitState
      ? `${currentVisitState.isFirstVisit}:${currentVisitState.previousVisitCount ?? ""}:${currentVisitState.visitCount}`
      : "unknown";
    const reportKey = currentConversationContext?.generatedAt ?? "none";
    const contextKey = `${room.slug}:${language}:${userDisplayName ?? ""}:${visitKey}:${reportKey}`;
    if (liveGreetingKeyRef.current === contextKey) return;

    sendContextUpdate(
      buildAgentContext(language, room.name, room.topic, quickQuestions, currentVisitState, currentConversationContext),
    );
    liveGreetingKeyRef.current = contextKey;
  }, [
    agentSessionStatus,
    currentConversationContext,
    currentVisitState,
    firstName,
    language,
    profile?.firstName,
    quickQuestions,
    room,
    sendContextUpdate,
  ]);

  useEffect(() => {
    if (agentSessionStatus === "connecting" || agentIsConnecting) {
      clearPresenceTimers();
      setAgentPresence("thinking");
    }
  }, [agentIsConnecting, agentSessionStatus, clearPresenceTimers]);

  useEffect(() => {
    if (agentSessionStatus !== "connected") return;

    if (startListeningWhenReadyRef.current && hasMicrophone) {
      startListeningWhenReadyRef.current = false;
      void beginUserTurn();
    }

    const queuedQuestion = queuedQuestionRef.current;
    if (queuedQuestion) {
      queuedQuestionRef.current = null;
      clearReconnectFallbackTimeout();
      void sendLiveQuestion(queuedQuestion);
    }
  }, [
    agentSessionStatus,
    beginUserTurn,
    clearReconnectFallbackTimeout,
    hasMicrophone,
    sendLiveQuestion,
  ]);

  useEffect(() => {
    if (agentIsSpeaking) {
      clearPresenceTimers();
      setAgentPresence("speaking");
      return;
    }

    if (agentSessionStatus === "connected") {
      clearPresenceTimers();
      speakingTimerRef.current = window.setTimeout(() => {
        setAgentPresence("idle");
        speakingTimerRef.current = null;
      }, 2200);
    }
  }, [agentIsSpeaking, agentSessionStatus, clearPresenceTimers]);

  useEffect(() => {
    const nextEntries = agentTranscript.slice(transcriptCursorRef.current);
    transcriptCursorRef.current = agentTranscript.length;
    if (nextEntries.length === 0) return;

    nextEntries.forEach((entry) => {
      if (entry.from === "user") {
        const text = entry.text.trim();
        if (text) {
          pendingQuestionRef.current = text;
          setLatestQuestion(text);
          setLatestAnswer("");
          setIsSending(true);
          setAgentPresence("thinking");
          armLiveReplyTimeout(text);
        }
        return;
      }

      if (entry.from !== "vyva") return;

      clearPresenceTimers();
      clearLiveReplyTimeout();
      setAgentPresence("speaking");
      speakingTimerRef.current = window.setTimeout(() => {
        if (!agentIsSpeaking) {
          setAgentPresence("idle");
        }
        speakingTimerRef.current = null;
      }, 2600);

      if (pendingQuestionRef.current) {
        setLatestQuestion(pendingQuestionRef.current);
        setLatestAnswer(entry.text);
        pendingQuestionRef.current = null;
        setIsSending(false);
      }
    });
  }, [agentIsSpeaking, agentTranscript, armLiveReplyTimeout, clearLiveReplyTimeout, clearPresenceTimers]);

  useEffect(() => {
    let cancelled = false;

    async function enterRoom() {
      if (!room || visitId) return;

      const response = await apiFetch(`/api/social/rooms/${slug}/enter`, {
        method: "POST",
        body: JSON.stringify({ lang: language }),
      });
      if (!response.ok) return;

      const result = (await response.json()) as {
        visitId: string;
        visitState?: SocialRoomVisitState;
        isFirstVisit?: boolean;
        previousVisitCount?: number;
        visitCount?: number;
        conversationContext?: SocialConversationContext;
      };
      if (!cancelled) {
        const nextVisitState =
          result.visitState ??
          (typeof result.isFirstVisit === "boolean"
            ? {
                isFirstVisit: result.isFirstVisit,
                previousVisitCount: result.previousVisitCount ?? 0,
                visitCount: result.visitCount ?? 0,
              }
            : null);

        leaveVisitIdRef.current = result.visitId;
        setVisitId(result.visitId);
        setRoomEntryVisitState(nextVisitState);
        setRoomEntryConversationContext(result.conversationContext ?? null);
      }
    }

    void enterRoom();

    return () => {
      cancelled = true;
    };
  }, [language, room, slug, visitId]);

  useEffect(() => {
    leaveVisitIdRef.current = visitId;
  }, [visitId]);

  useEffect(() => {
    return () => {
      const currentVisitId = leaveVisitIdRef.current;
      if (currentVisitId) {
        void apiFetch(`/api/social/rooms/${slug}/leave`, {
          method: "POST",
          body: JSON.stringify({
            lang: language,
            visitId: currentVisitId,
            completed: false,
          }),
        });
      }
    };
  }, [language, slug]);

  const submitQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    if (agentSessionStatus === "connected") {
      await sendLiveQuestion(trimmed);
      return;
    }

    setLatestQuestion(trimmed);
    setLatestAnswer("");
    setDraft("");
    setIsSending(true);
    setAgentPresence("thinking");
    pendingQuestionRef.current = null;
    queuedQuestionRef.current = null;
    clearReconnectFallbackTimeout();
    await submitFallbackQuestion(trimmed);
  };

  const handleVoiceToggle = async () => {
    if (!room?.slug || !room.agentSlug) return;

    const voiceSessionActive =
      isUserSpeaking ||
      agentIsSpeaking ||
      agentIsConnecting ||
      agentSessionStatus === "connected" ||
      agentSessionStatus === "connecting";

    if (voiceSessionActive) {
      endUserTurn();
      stopVoice();
      startListeningWhenReadyRef.current = false;
      queuedQuestionRef.current = null;
      pendingQuestionRef.current = null;
      setIsSending(false);
      setAgentPresence("idle");
      return;
    }

    setVoiceAttempted(true);
    startListeningWhenReadyRef.current = true;
    queuedQuestionRef.current = null;
    pendingQuestionRef.current = null;
    transcriptCursorRef.current = agentTranscript.length;
    setIsSending(false);
    setAgentPresence("thinking");
    stopVoice();
    void window.setTimeout(() => startRoomAgentSession(false), 0);
  };

  const handleSwitchToChat = () => {
    quietRoomAgent();
    setRoomMode("chat");
  };

  const handleBackToRooms = () => {
    quietRoomAgent();
    navigate("/social-rooms");
  };

  const postChatMessage = async (trimmed: string) => {
    if (!trimmed || isChatSending) return false;

    const userName = firstName || profile?.firstName?.trim() || (language === "en" ? "You" : language === "de" ? "Du" : "Tú");
    const now = new Date().toISOString();
    setLocalChatMessages((current) => [
      ...current,
      {
        id: `${slug}-chat-user-${Date.now()}`,
        authorId: "current-user",
        authorName: userName,
        text: trimmed,
        createdAt: now,
        connectable: false,
      },
    ]);
    setIsChatSending(true);
    setAgentPresence("thinking");

    try {
      const response = await apiFetch(`/api/social/rooms/${slug}/message`, {
        method: "POST",
        body: JSON.stringify({ message: trimmed, lang: language, visitId: visitId ?? undefined }),
      });
      if (!response.ok) {
        setAgentPresence("idle");
        return false;
      }

      const result = (await response.json()) as {
        reply?: string;
        createdAt?: string;
        conversationContext?: SocialConversationContext;
      };
      if (result.conversationContext) {
        setRoomEntryConversationContext(result.conversationContext);
      }
      const reply = result.reply?.trim();
      if (!reply) {
        setAgentPresence("idle");
        return true;
      }

      setLocalChatMessages((current) => [
        ...current,
        {
          id: `${slug}-chat-agent-${Date.now()}`,
          authorId: "agent",
          authorName: agentName || room?.agentFullName || "VYVA",
          text: reply,
          createdAt: result.createdAt ?? new Date().toISOString(),
          connectable: false,
        },
      ]);
      clearPresenceTimers();
      setAgentPresence("speaking");
      speakingTimerRef.current = window.setTimeout(() => {
        setAgentPresence("idle");
        speakingTimerRef.current = null;
      }, 2200);
    } finally {
      setIsChatSending(false);
    }

    return true;
  };

  const postReadingPulseJson = async (url: string, body: Record<string, unknown>) => {
    const response = await apiFetch(url, {
      method: "POST",
      body: JSON.stringify({ lang: language, visitId: visitId ?? undefined, ...body }),
    });
    if (!response.ok) return null;
    return response.json() as Promise<{ pulse?: SocialRoomPulse }>;
  };

  const respondToReadingPlan = async (
    planKey: string,
    response: SocialRoomPlanResponseValue,
  ) => {
    if (!activeReadingPulse || isReadingPulseSending) return;

    const previous = activeReadingPulse;
    setReadingPulse(updateReadingPlanResponse(previous, planKey, response));
    setReadingClubStatus(response === "join" ? readingClubCopy.joinedLabel : readingClubCopy.maybeSavedLabel);
    setIsReadingPulseSending(true);

    try {
      const result = await postReadingPulseJson(`/api/social/rooms/${slug}/plans/${planKey}/respond`, { response });
      if (result?.pulse) {
        setReadingPulse(result.pulse);
        if (response === "join") {
          incrementReadingProgressMetric("tablesJoined");
        }
      } else {
        setReadingPulse(previous);
        setReadingClubStatus(readingClubCopy.postFailedLabel);
      }
    } catch {
      setReadingPulse(previous);
      setReadingClubStatus(readingClubCopy.postFailedLabel);
    } finally {
      setIsReadingPulseSending(false);
    }
  };

  const voteReadingShelf = async (optionId: string) => {
    if (!activeReadingPulse || readingPollClosed || isReadingPulseSending) return;

    const previous = activeReadingPulse;
    setReadingPulse(updateReadingShelfVote(previous, optionId));
    setReadingClubStatus(readingClubCopy.votedLabel);
    setIsReadingPulseSending(true);

    try {
      const result = await postReadingPulseJson(`/api/social/rooms/${slug}/polls/${activeReadingPulse.activePoll.key}/vote`, { optionId });
      if (result?.pulse) {
        setReadingPulse(result.pulse);
        incrementReadingProgressMetric("shelfVotes");
      } else {
        setReadingPulse(previous);
        setReadingClubStatus(readingClubCopy.postFailedLabel);
      }
    } catch {
      setReadingPulse(previous);
      setReadingClubStatus(readingClubCopy.postFailedLabel);
    } finally {
      setIsReadingPulseSending(false);
    }
  };

  const sendReadingClubHelp = async () => {
    if (!readingRoomActive || isReadingPulseSending) return;

    setIsReadingPulseSending(true);
    try {
      const result = await postReadingPulseJson(`/api/social/rooms/${slug}/safety-reports`, {
        reason: "club_help",
        details: activeReadingPulse?.safety.body ?? readingClub.hostNote,
        targetType: "room",
      });
      if (result?.pulse) {
        setReadingPulse(result.pulse);
        setReadingClubStatus(readingClubCopy.helpSentLabel);
      } else {
        setReadingClubStatus(readingClubCopy.postFailedLabel);
      }
    } catch {
      setReadingClubStatus(readingClubCopy.postFailedLabel);
    } finally {
      setIsReadingPulseSending(false);
    }
  };

  const submitChatMessage = async () => {
    const trimmed = chatDraft.trim();
    if (!trimmed || isChatSending) return;

    setChatDraft("");
    return postChatMessage(trimmed);
  };

  const submitReadingReflection = async () => {
    const trimmed = readingReflectionDraft.trim();
    if (!trimmed || isChatSending) return;

    setReadingReflectionDraft("");
    completeReadingPassportItem("share", true);
    if (readingClubDesk.selectedIntentId === "recommend-book") {
      completeReadingPassportItem("recommend", true);
      incrementReadingProgressMetric("recommendationsMade");
    }
    updateReadingDesk((current) => (
      addReadingClubShelfItem(
        incrementReadingClubProgress(
          updateReadingClubDeskState(current, { lastReflection: trimmed }),
          "reflectionsShared",
        ),
        {
          kind: readingClubDesk.selectedIntentId === "recommend-book" ? "recommendation" : "reflection",
          title: summarizeReadingPostTitle(trimmed),
          body: trimmed,
        },
      )
    ));
    setReadingClubStatus(readingClubCopy.savedShelfSavedLabel);
    setRoomMode("chat");

    try {
      const result = await postReadingPulseJson(`/api/social/rooms/${slug}/proposals`, {
        title: summarizeReadingPostTitle(trimmed),
        details: trimmed,
        locationLabel: "online",
        kind: "message",
      });
      if (result?.pulse) {
        setReadingPulse(result.pulse);
      }
    } catch {
      setReadingClubStatus(readingClubCopy.postFailedLabel);
    }

    await postChatMessage(trimmed);
  };

  const editStoryHandoffInRoom = () => {
    if (!activeStoryHandoff) return;

    if (readingRoomActive) {
      revealReadingTool("reading-reflection-card", "share");
      return;
    }

    setRoomMode("chat");
    window.requestAnimationFrame(() => chatInputRef.current?.focus({ preventScroll: true }));
  };

  const shareStoryHandoffInRoom = async () => {
    if (!activeStoryHandoff) return;

    if (readingRoomActive) {
      if (!readingReflectionDraft.trim()) return;
      await submitReadingReflection();
      setPlacedStoryHandoff(activeStoryHandoff);
      setDismissedStoryHandoffId(activeStoryHandoff.id);
      return;
    }

    setRoomMode("chat");
    if (!chatDraft.trim()) return;
    const sent = await submitChatMessage();
    if (sent !== false) {
      setPlacedStoryHandoff(activeStoryHandoff);
      setDismissedStoryHandoffId(activeStoryHandoff.id);
    }
  };

  const prepareStoryReplyDraft = (draft: string) => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setRoomMode("chat");
    setChatDraft(trimmed);
    window.requestAnimationFrame(() => chatInputRef.current?.focus({ preventScroll: true }));
  };

  const findReadingCompanion = async () => {
    if (!readingRoomActive || isReadingMatching) return;

    setIsReadingMatching(true);
    setReadingMatchResponse(null);
    setReadingGreetingStatus("");

    try {
      const response = await apiFetch(`/api/social/rooms/${slug}/match`, {
        method: "POST",
        body: JSON.stringify({
          lang: language,
          readingMode: selectedReadingMode?.id,
          readingIntent: readingClubDesk.selectedIntentId,
          favoriteShelf: readingClubDesk.favoriteShelfId,
          preferredPace: readingClubDesk.preferredPaceId,
          readingPreferenceTags,
          bridgePrompt: readingBridgePrompt || selectedReadingMode?.bridgePrompt || getReadingBridgePrompt(language),
        }),
      });
      if (!response.ok) throw new Error(`reading match ${response.status}`);

      const result = (await response.json()) as SocialMatchResponse;
      setReadingMatchResponse(result);
    } catch {
      setReadingMatchResponse({
        noMatch: true,
        agentMessage: getReadingMatchError(language),
      });
    } finally {
      setIsReadingMatching(false);
    }
  };

  const sendMatchedReadingGreeting = async () => {
    const matchedUser = readingMatchResponse?.matchedUser;
    if (!readingRoomActive || !matchedUser || isReadingGreetingSending) return;

    setIsReadingGreetingSending(true);
    setReadingGreetingStatus("");

    try {
      const response = await apiFetch(`/api/social/rooms/${slug}/connect`, {
        method: "POST",
        body: JSON.stringify({
          memberId: matchedUser.userId,
          lang: language,
          bridgePrompt: readingBridgePrompt || selectedReadingMode?.bridgePrompt || getReadingBridgePrompt(language),
        }),
      });
      if (!response.ok) throw new Error(`reading greeting ${response.status}`);

      const result = (await response.json()) as { reply?: string };
      setPendingConnections((current) => ({ ...current, [matchedUser.userId]: true }));
      completeReadingPassportItem("greet", true);
      incrementReadingProgressMetric("greetingsSent");
      setReadingGreetingStatus(result.reply || readingClubCopy.greetingSentLabel);
      setReadingClubStatus(readingClubCopy.greetingSentLabel);
    } catch {
      setReadingGreetingStatus(readingClubCopy.greetingFailedLabel);
    } finally {
      setIsReadingGreetingSending(false);
    }
  };

  const addComment = (itemId: string) => {
    const text = commentDrafts[itemId]?.trim();
    if (!text) return;

    setExtraComments((current) => ({
      ...current,
      [itemId]: [
        ...(current[itemId] ?? []),
        {
          id: `${itemId}-${Date.now()}`,
          author: profile?.firstName?.trim() || (language === "en" ? "You" : language === "de" ? "Du" : "Tú"),
          text,
        },
      ],
    }));
    setCommentDrafts((current) => ({ ...current, [itemId]: "" }));
    setCommentComposerFor(null);
  };

  const sendConnectionRequest = async (member: SocialRoomMember) => {
    if (!member) return;

    const response = await apiFetch(`/api/social/rooms/${slug}/connect`, {
      method: "POST",
      body: JSON.stringify({
        memberId: member.id,
        lang: language,
        ...(readingRoomActive
          ? { bridgePrompt: readingBridgePrompt || selectedReadingMode?.bridgePrompt || getReadingBridgePrompt(language) }
          : {}),
      }),
    });
    if (!response.ok) return;

    setPendingConnections((current) => ({ ...current, [member.id]: true }));
    if (readingRoomActive) {
      completeReadingPassportItem("greet", true);
      incrementReadingProgressMetric("greetingsSent");
    }
  };

  const loadingRoomName = room?.name || (language === "en" ? "this room" : language === "de" ? "diesen Raum" : "esta sala");
  const loadingRoomHint = room
    ? getTopicHint(canonicalRoomSlug, language, room.topic)
    : language === "en"
      ? "VYVA is preparing the room, members, and safe conversation tools."
      : language === "de"
        ? "VYVA bereitet Raum, Mitglieder und sichere Gespraechswerkzeuge vor."
        : "VYVA esta preparando la sala, los miembros y las herramientas seguras.";
  const loadingRoomLabel = language === "en"
    ? `Opening ${loadingRoomName}`
    : language === "de"
      ? `Oeffne ${loadingRoomName}`
      : `Abriendo ${loadingRoomName}`;

  if (isLoading) {
    return (
      <div className="px-6 py-8">
        <div className="rounded-[30px] bg-[#FFFDFC] p-6 font-body text-[#7C6D8D]" role="status" aria-live="polite">
          <p className="text-[22px] font-semibold text-[#45325B]">{loadingRoomLabel}</p>
          <p className="mt-2 text-[18px] leading-[1.35]">{loadingRoomHint}</p>
        </div>
      </div>
    );
  }

  if ((isError && !roomResponse) || !room) {
    return (
      <div className="px-6 py-8">
        <button
          type="button"
          onClick={handleBackToRooms}
          className="min-h-[64px] rounded-full border border-[#E0D4F0] bg-[#FFFDFC] px-6 font-body text-[22px] font-semibold text-[#6B3CC7]"
        >
          {copy.back}
        </button>
      </div>
    );
  }

  if (room.slug === "together-room") {
    return (
      <TogetherRoomScreen
        roomResponse={roomResponse}
        language={language}
        visitId={visitId}
        onBack={handleBackToRooms}
        onOpenActivities={() => navigate("/social-rooms/activities")}
        onOpenShareStories={() => navigate("/social-rooms/share")}
        shareStoryHandoff={storyHandoffNote}
      />
    );
  }

  if (room.slug === "games-room") {
    return (
      <GamesRoomScreen
        roomResponse={roomResponse}
        language={gameLanguage}
        visitId={visitId}
        onBack={handleBackToRooms}
      />
    );
  }

  if (room.slug === "music-room" || room.slug === "music-salon") {
    return (
      <MusicRoomScreen
        roomResponse={roomResponse}
        language={language}
        visitId={visitId}
        onBack={handleBackToRooms}
      />
    );
  }

  return (
    <div
      className="min-h-screen px-6 py-6"
      style={{ background: "linear-gradient(180deg, #FBF7F0 0%, #F8F7F5 34%, #F8F7F5 100%)" }}
    >
      <SocialStyles />

      <button
        type="button"
        onClick={handleBackToRooms}
        className="inline-flex min-h-[56px] items-center gap-3 rounded-full border border-[#E0D4F0] bg-[#FFFDFC] px-5 font-body text-[20px] font-semibold text-[#6B3CC7]"
      >
        <ArrowLeft size={22} />
        {copy.back}
      </button>

      <header className="mt-5 rounded-[30px] border border-[#E8DDCF] bg-[#FFFDFC] px-5 py-5 shadow-[0_16px_34px_rgba(91,33,182,0.05)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-[34px] leading-[1.08] text-[#45325B]">{room.agentFullName}</p>
            <p className="mt-2 font-body text-[20px] text-[#6E627D]">{room.agentCredential}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="font-body text-[20px] font-semibold text-[#6B3CC7]">
                {getPeopleLabel(language, room.participantCount)}
              </span>
              <button
                type="button"
                onClick={() => setMembersOpen(true)}
                className="min-h-[42px] rounded-full border border-[#DECBEF] bg-[#F8F3FF] px-4 font-body text-[18px] font-semibold text-[#6B3CC7]"
              >
                {copy.viewMembers}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[#5A456D]">
              {agentPresence === "speaking" ? (
                <>
                  <span className="font-body text-[20px] font-semibold text-[#6B3CC7]">
                    {getAgentSpeakingLabel(language, room.agentFullName.split(" ")[0] ?? room.agentFullName)}
                  </span>
                  <span className="social-mini-wave text-[#6B3CC7]" aria-hidden="true">
                    <b></b>
                    <b></b>
                    <b></b>
                  </span>
                </>
              ) : agentPresence === "thinking" ? (
                <>
                  <span className="font-body text-[20px] font-semibold text-[#7D66A0]">
                    {getAgentThinkingLabel(language, room.agentFullName.split(" ")[0] ?? room.agentFullName)}
                  </span>
                  <span className="social-thinking-dot text-[#7D66A0]" aria-hidden="true"></span>
                </>
              ) : (
                <>
                  <span className="font-body text-[20px] font-semibold text-[#786A86]">
                    {room.agentFullName.split(" ")[0] ?? room.agentFullName}
                  </span>
                  <span className="social-presence-dot text-[#786A86]" aria-hidden="true"></span>
                </>
              )}
            </div>
          </div>

          <div className="flex -space-x-2">
            {roomMembers.slice(0, 3).map((member, index) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedMember(member)}
                className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-2 border-[#FFFDFC] text-[15px] font-semibold text-white shadow-[0_6px_12px_rgba(91,33,182,0.08)]"
                style={{ background: getParticipantColour(index) }}
              >
                {member.name.slice(0, 1).toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mt-5 space-y-4">
        {activeStoryHandoff ? (
          <StoryRoomHandoffCard
            note={activeStoryHandoff}
            roomName={room.name}
            language={language}
            isBusy={isChatSending}
            onPrimary={() => void shareStoryHandoffInRoom()}
            onEdit={editStoryHandoffInRoom}
            onShareAnother={() => navigate("/social-rooms/share")}
          />
        ) : null}

        {!activeStoryHandoff && replyLoopStoryHandoff ? (
          <StoryRoomReplyLoopCard
            note={replyLoopStoryHandoff}
            roomName={room.name}
            language={language}
            responderName={roomMembers[0]?.name}
            responderNames={roomMembers.slice(0, 2).map((member) => member.name)}
            onReply={prepareStoryReplyDraft}
            onShareAnother={() => navigate("/social-rooms/share")}
          />
        ) : null}

        {togetherRoomActive && togetherCopy && (
          <section className="rounded-[34px] border border-[#D9C7F8] bg-[linear-gradient(135deg,#FFFDFC_0%,#F7F2FF_46%,#ECFDF5_100%)] p-5 shadow-[0_16px_34px_rgba(91,33,182,0.08)]">
            <div className="flex items-start gap-3">
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] bg-[#6D28D9] text-white shadow-[0_12px_26px_rgba(109,40,217,0.18)]">
                <TogetherSafetyIcon size={25} strokeWidth={2.4} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-[31px] leading-[1.08] text-[#45325B]">{togetherCopy.previewTitle}</p>
                <p className="mt-2 font-body text-[18px] leading-[1.35] text-[#6E627D]">{togetherCopy.previewSubtitle}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {togetherPlans.map((plan) => {
                const Icon = plan.icon;
                const active = plan.id === selectedTogetherPlan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedTogetherPlanId(plan.id)}
                    aria-pressed={active}
                    className={`min-h-[108px] rounded-[22px] border px-3 py-3 text-left transition-transform active:scale-[0.98] ${
                      active
                        ? "border-[#6D28D9] bg-white text-[#24172F] shadow-[0_12px_24px_rgba(109,40,217,0.12)]"
                        : "border-[#E8DDCF] bg-white/78 text-[#5D4777]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon
                        size={21}
                        strokeWidth={2.4}
                        className={`mt-0.5 shrink-0 ${active ? "text-[#6D28D9]" : "text-[#0F766E]"}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 break-words font-body text-[15px] font-bold leading-[1.18] sm:text-[16px]">
                        {plan.label}
                      </span>
                    </div>
                    <p className="mt-2 font-body text-[14px] leading-[1.25] text-[#7A677F]">{plan.detail}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 border-t border-[#E4D8F7] pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1.5 font-body text-[14px] font-bold uppercase tracking-[0.08em] text-[#6D28D9]">
                  {togetherCopy.selectedPlanLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[14px] font-bold ${
                    selectedTogetherPlan.proximityMatters
                      ? "bg-[#ECFDF5] text-[#0F766E]"
                      : "bg-[#F7F2FF] text-[#6D28D9]"
                  }`}
                >
                  <TogetherProximityIcon size={15} strokeWidth={2.4} aria-hidden="true" />
                  {selectedTogetherPlan.proximity}
                </span>
              </div>
              <p className="mt-3 font-body text-[20px] leading-[1.34] text-[#45325B]">{selectedTogetherPlan.matchLine}</p>

              <button
                type="button"
                disabled={!selectedTogetherMember}
                onClick={() => selectedTogetherMember && setSelectedMember(selectedTogetherMember)}
                className="mt-4 min-h-[58px] w-full rounded-[20px] bg-[#6D28D9] px-5 font-body text-[20px] font-semibold text-white shadow-[0_14px_28px_rgba(109,40,217,0.18)] disabled:opacity-50"
              >
                {selectedTogetherMember ? togetherCopy.sayHello(selectedTogetherMember.name) : copy.viewMembers}
              </button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {togetherCopy.rules.map((rule, index) => (
                <div key={rule} className="flex items-center gap-2 rounded-[18px] bg-white/82 px-3 py-3 font-body text-[15px] font-semibold leading-[1.28] text-[#5D4777]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F2EBFF] text-[14px] font-bold text-[#6D28D9]">
                    {index + 1}
                  </span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {movementRoomActive && (
          <section
            className="rounded-[34px] border border-[#C9E8F1] bg-[linear-gradient(135deg,#F7FEFF_0%,#FFFDFC_52%,#F3FBF7_100%)] p-5 shadow-[0_16px_34px_rgba(2,132,199,0.08)]"
            data-testid="movement-room-exercise-library"
          >
            <div className="flex items-start gap-4">
              <div
                className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-[18px] bg-[#0284C7] text-white shadow-[0_12px_26px_rgba(2,132,199,0.18)]"
                aria-hidden="true"
              >
                <Dumbbell size={27} strokeWidth={2.4} />
              </div>
              <div className="min-w-0">
                <p className="font-body text-[15px] font-bold uppercase tracking-[0.12em] text-[#0369A1]">
                  {movementExerciseCopy.eyebrow}
                </p>
                <h2 className="mt-1 break-words font-display text-[32px] leading-[1.04] text-[#123047]">
                  {movementExerciseCopy.title}
                </h2>
              </div>
            </div>

            <p className="mt-4 max-w-[720px] break-words font-body text-[18px] leading-[1.35] text-[#51606C] sm:ml-[72px]">
              {movementExerciseCopy.body}
            </p>

            {recommendedMovementExercise && recommendedMovementExerciseVisual ? (
              <button
                type="button"
                onClick={() => openMovementExerciseCard(recommendedMovementExercise.id)}
                aria-label={`${movementExerciseCopy.recommendedTitle}: ${recommendedMovementExercise.title}. ${movementExerciseCopy.recommendedAction}.`}
                className="mt-3 flex min-w-0 items-center gap-3 rounded-[22px] border bg-white/90 p-3 text-left shadow-[0_10px_22px_rgba(2,132,199,0.07)] transition-transform active:scale-[0.99] sm:ml-[72px]"
                style={{ borderColor: recommendedMovementExerciseVisual.border }}
                data-testid="button-movement-room-recommended-exercise"
              >
                <img
                  src={recommendedMovementExerciseVisual.image}
                  alt=""
                  className="h-[68px] w-[68px] shrink-0 rounded-[16px] object-cover"
                  loading="lazy"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-[11px] font-black uppercase leading-tight"
                    style={{
                      background: recommendedMovementExerciseVisual.softBg,
                      color: recommendedMovementExerciseVisual.accent,
                    }}
                  >
                    <Star size={13} strokeWidth={2.6} aria-hidden="true" />
                    <span className="truncate">{movementExerciseCopy.recommendedTitle}</span>
                  </span>
                  <span className="mt-1 block font-body text-[18px] font-black leading-tight text-[#123047] [overflow-wrap:anywhere]">
                    {recommendedMovementExercise.title}
                  </span>
                  <span className="sr-only">
                    {recommendedMovementExercise.benefit}. {movementExerciseCopy.recommendedBody}
                  </span>
                </span>
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white sm:w-auto sm:gap-2 sm:px-4"
                  style={{ background: recommendedMovementExerciseVisual.accent }}
                >
                  <span className="hidden font-body text-[15px] font-black sm:inline">
                    {movementExerciseCopy.recommendedAction}
                  </span>
                  <ArrowRight size={20} strokeWidth={2.6} aria-hidden="true" />
                </span>
              </button>
            ) : null}

            {completedMovementExercise ? (
              <div
                className="mt-3 flex items-center gap-2 rounded-[18px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-3 font-body text-[16px] font-extrabold leading-snug text-[#047857] sm:ml-[72px]"
                data-testid="movement-room-exercise-logged-status"
              >
                <Check size={19} strokeWidth={2.6} aria-hidden="true" />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {movementSessionUiCopy.logged(completedMovementExercise.title)}
                </span>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3 sm:ml-[72px] sm:grid-cols-4" data-testid="movement-room-exercise-cards">
              {movementFeaturedExerciseCards.map((card) => {
                const visual = MOVEMENT_EXERCISE_VISUALS[card.id];
                const exerciseCompleted = completedMovementExerciseId === card.id;
                const exerciseLastUsed = lastMovementExerciseId === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => openMovementExerciseCard(card.id)}
                    aria-label={`${card.title}. ${card.benefit}. 10 min.`}
                    className="group min-w-0 overflow-hidden rounded-[22px] border bg-white text-left shadow-[0_12px_24px_rgba(2,132,199,0.08)] transition-transform active:scale-[0.98]"
                    style={{
                      borderColor: exerciseCompleted ? visual.accent : visual.border,
                      boxShadow: exerciseCompleted
                        ? `0 12px 24px ${visual.accent}20, 0 0 0 2px ${visual.accent} inset`
                        : "0 12px 24px rgba(2,132,199,0.08)",
                    }}
                    data-testid={`movement-room-exercise-card-${card.id}`}
                  >
                    <div className="aspect-[16/11] overflow-hidden bg-[#EEF7F9]">
                      <img
                        src={visual.image}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                    <div className="px-3 pb-3 pt-2.5">
                      <span
                        className="mb-1 inline-flex max-w-full rounded-full px-2.5 py-1 font-body text-[11px] font-black leading-tight"
                        style={{ background: visual.softBg, color: visual.accent }}
                      >
                        {card.focus}
                      </span>
                      <p className="font-body text-[17px] font-black leading-[1.12] text-[#123047] [overflow-wrap:anywhere]">
                        {card.title}
                      </p>
                      <p className="sr-only">
                        {card.benefit}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-body text-[13px] font-black" style={{ color: visual.accent }}>
                          <Clock size={15} strokeWidth={2.4} aria-hidden="true" />
                          10 min
                        </span>
                        {exerciseCompleted || exerciseLastUsed ? (
                          <span
                            className="rounded-full px-2.5 py-1 font-body text-[11px] font-black"
                            style={{ background: visual.softBg, color: visual.accent }}
                          >
                            {exerciseCompleted ? movementSessionUiCopy.loggedBadge : movementExerciseCopy.lastUsedBadge}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              className="mt-3 rounded-[18px] border border-[#CFEAF2] bg-white/82 px-3 py-2.5 shadow-[0_8px_18px_rgba(2,132,199,0.05)] sm:ml-[72px]"
              data-testid="movement-room-gentle-week"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex min-w-0 items-center gap-1.5 font-body text-[15px] font-black leading-tight text-[#123047]">
                  <CalendarDays size={17} strokeWidth={2.4} className="text-[#0369A1]" aria-hidden="true" />
                  <span>{movementExerciseCopy.weekTitle}</span>
                </p>
                <span className="inline-flex shrink-0 rounded-full bg-[#F0F9FF] px-2.5 py-1 font-body text-[12px] font-black text-[#0369A1]">
                  {movementExerciseCopy.weekProgress(movementWeekCompletedCount)}
                </span>
                <div className="ml-auto flex min-w-0 flex-wrap justify-end gap-1" data-testid="movement-room-week-days">
                  {movementWeekDays.map((day) => {
                    const dayComplete = movementWeekLogDates.includes(day.dateKey);
                    return (
                      <span
                        key={day.dateKey}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-body text-[11px] font-black"
                        style={{
                          background: dayComplete ? "#ECFDF5" : day.isToday ? "#F0F9FF" : "#FFFFFF",
                          borderColor: dayComplete ? "#A7F3D0" : day.isToday ? "#7DD3FC" : "#E3F3F7",
                          color: dayComplete ? "#047857" : day.isToday ? "#0369A1" : "#66717B",
                        }}
                        aria-label={`${day.label} ${dayComplete ? movementExerciseCopy.doneDayLabel : movementExerciseCopy.openDayLabel}`}
                      >
                        {dayComplete ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : day.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {lastMovementExercise ? (
                  <button
                    type="button"
                    onClick={openMovementRepeatExercise}
                    className="inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-[#0369A1] px-3 font-body text-[13px] font-black text-white shadow-[0_8px_16px_rgba(3,105,161,0.12)]"
                    data-testid="button-movement-room-repeat-exercise"
                  >
                    <Clock size={15} strokeWidth={2.4} aria-hidden="true" />
                    <span className="truncate">{movementExerciseCopy.lastUsedLine(lastMovementExercise.title)}</span>
                  </button>
                ) : (
                  <span className="font-body text-[13px] font-bold leading-snug text-[#66717B]">
                    {movementExerciseCopy.weekBody}
                  </span>
                )}
                <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="movement-room-comfort-levels">
                  <span className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#66717B]">
                    {movementExerciseCopy.comfortTitle}
                  </span>
                  {movementExerciseCopy.comfortLevels.map((level) => {
                    const selected = movementComfortLevel === level.id;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => selectMovementComfortLevel(level.id)}
                        className="min-h-[32px] rounded-full border px-2.5 font-body text-[12px] font-black leading-tight transition-colors"
                        style={{
                          background: selected ? "#0369A1" : "#FFFFFF",
                          borderColor: selected ? "#0369A1" : "#CFEAF2",
                          color: selected ? "#FFFFFF" : "#0369A1",
                        }}
                        data-testid={`button-movement-room-comfort-${level.id}`}
                      >
                        {level.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#66717B]">
                  {movementExerciseCopy.swapPrompt}
                </span>
                <div className="flex min-w-0 flex-wrap gap-1.5" data-testid="movement-room-swap-actions">
                  {[
                    { intent: "easier" as MovementSwapIntent, label: movementExerciseCopy.swapEasier },
                    { intent: "calm" as MovementSwapIntent, label: movementExerciseCopy.swapCalm },
                    { intent: "legs" as MovementSwapIntent, label: movementExerciseCopy.swapLegs },
                  ].map((action) => (
                    <button
                      key={action.intent}
                      type="button"
                      onClick={() => openMovementSwapExercise(action.intent)}
                      className="inline-flex min-h-[32px] shrink-0 items-center justify-center rounded-full border border-[#CFEAF2] bg-white px-2.5 font-body text-[12px] font-black text-[#0369A1]"
                      data-testid={`button-movement-room-swap-${action.intent}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:ml-[72px] sm:flex-row sm:items-center sm:justify-between">
              <p className="rounded-[18px] bg-white/72 px-3 py-3 font-body text-[17px] font-semibold leading-[1.35] text-[#66717B]">
                {movementExerciseCopy.detail}
              </p>
              <button
                type="button"
                onClick={openMovementExerciseLibrary}
                aria-expanded={isMovementExerciseLibraryExpanded}
                className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[18px] border border-[#BFE3EC] bg-white px-4 font-body text-[17px] font-black text-[#0369A1] shadow-[0_10px_22px_rgba(2,132,199,0.08)] sm:w-auto"
                data-testid="button-movement-room-browse-exercises"
              >
                <Sparkles size={20} strokeWidth={2.4} aria-hidden="true" />
                <span>{isMovementExerciseLibraryExpanded ? movementExerciseCopy.collapseCta : movementExerciseCopy.cta}</span>
                <ArrowRight
                  size={19}
                  strokeWidth={2.5}
                  aria-hidden="true"
                  className={isMovementExerciseLibraryExpanded ? "-rotate-90 transition-transform" : "transition-transform"}
                />
              </button>
            </div>

            {isMovementExerciseLibraryExpanded ? (
              <div
                className="mt-4 rounded-[26px] border border-[#D7EEF5] bg-white/78 p-3 sm:ml-[72px] sm:p-4"
                data-testid="movement-room-expanded-exercise-library"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-body text-[17px] font-black leading-tight text-[#123047]">
                      {movementExerciseCopy.moreTitle}
                    </p>
                    <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-[#66717B]">
                      {movementExerciseCopy.groupPrompt}
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-[#F0F9FF] px-3 py-1.5 font-body text-[13px] font-black text-[#0369A1]">
                    {movementExerciseCopy.groupCount(movementExerciseCopy.cards.length)}
                  </span>
                </div>

                <div
                  className="mt-3 flex gap-2 overflow-x-auto pb-1"
                  role="tablist"
                  aria-label={movementExerciseCopy.groupPrompt}
                  data-testid="movement-room-exercise-filters"
                >
                  {movementExerciseCopy.groups.map((group) => {
                    const selected = group.id === selectedMovementExerciseGroup;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setSelectedMovementExerciseGroup(group.id)}
                        className="min-h-[46px] shrink-0 rounded-full border px-4 font-body text-[15px] font-black transition-colors"
                        style={{
                          background: selected ? "#0369A1" : "#FFFFFF",
                          borderColor: selected ? "#0369A1" : "#CFEAF2",
                          color: selected ? "#FFFFFF" : "#0369A1",
                        }}
                        data-testid={`movement-room-exercise-filter-${group.id}`}
                      >
                        {group.title}
                      </button>
                    );
                  })}
                </div>

                <div
                  className="mt-3 rounded-[22px] border border-[#E3F3F7] bg-[#FBFEFF] p-3"
                  data-testid={`movement-room-exercise-group-${selectedMovementExerciseGroup}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-body text-[16px] font-black leading-tight text-[#123047]">
                        {selectedMovementExerciseGroupCopy.title}
                      </p>
                      <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-[#66717B]">
                        {selectedMovementExerciseGroupCopy.subtitle}
                      </p>
                    </div>
                    <span className="inline-flex w-fit shrink-0 rounded-full bg-white px-3 py-1.5 font-body text-[13px] font-black text-[#66717B]">
                      {movementExerciseCopy.groupCount(
                        movementExerciseCopy.cards.filter((card) => card.group === selectedMovementExerciseGroup).length,
                      )}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="movement-room-extra-exercise-cards">
                    {selectedMovementExerciseGroupCards.map((card) => {
                      const visual = MOVEMENT_EXERCISE_VISUALS[card.id];
                      const exerciseCompleted = completedMovementExerciseId === card.id;
                      const exerciseLastUsed = lastMovementExerciseId === card.id;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => openMovementExerciseCard(card.id)}
                          aria-label={`${card.title}. ${card.benefit}. 10 min.`}
                          className="group min-w-0 overflow-hidden rounded-[20px] border bg-white text-left shadow-[0_10px_20px_rgba(2,132,199,0.07)] transition-transform active:scale-[0.98]"
                          style={{
                            borderColor: exerciseCompleted ? visual.accent : visual.border,
                            boxShadow: exerciseCompleted
                              ? `0 10px 20px ${visual.accent}20, 0 0 0 2px ${visual.accent} inset`
                              : "0 10px 20px rgba(2,132,199,0.07)",
                          }}
                          data-testid={`movement-room-exercise-card-${card.id}`}
                        >
                          <div className="aspect-[16/10] overflow-hidden bg-[#EEF7F9]">
                            <img
                              src={visual.image}
                              alt=""
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              loading="lazy"
                            />
                          </div>
                          <div className="px-3 pb-3 pt-2.5">
                            <span
                              className="mb-1 inline-flex max-w-full rounded-full px-2.5 py-1 font-body text-[11px] font-black leading-tight"
                              style={{ background: visual.softBg, color: visual.accent }}
                            >
                              {card.focus}
                            </span>
                            <p className="font-body text-[15px] font-black leading-[1.12] text-[#123047] [overflow-wrap:anywhere]">
                              {card.title}
                            </p>
                            <p className="sr-only">
                              {card.benefit}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 font-body text-[12px] font-black" style={{ color: visual.accent }}>
                                <Clock size={14} strokeWidth={2.4} aria-hidden="true" />
                                10 min
                              </span>
                              {exerciseCompleted || exerciseLastUsed ? (
                                <span
                                  className="rounded-full px-2.5 py-1 font-body text-[11px] font-black"
                                  style={{ background: visual.softBg, color: visual.accent }}
                                >
                                  {exerciseCompleted ? movementSessionUiCopy.loggedBadge : movementExerciseCopy.lastUsedBadge}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        )}

        {readingRoomActive && (
          <section
            className="overflow-hidden rounded-[34px] border border-[#E8DDCF] bg-[#FFFDFC] shadow-[0_18px_42px_rgba(124,45,18,0.1)]"
            data-testid="reading-club-panel"
          >
            <div className="bg-[linear-gradient(135deg,#FFF8ED_0%,#FFFDFC_48%,#EEFDF8_100%)] px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-[18px] bg-[#7C2D12] text-white shadow-[0_12px_26px_rgba(124,45,18,0.16)]">
                  <BookOpen size={26} strokeWidth={2.4} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-[34px] leading-[1.04] text-[#3F2447]">{readingClub.title}</p>
                  <p className="mt-2 max-w-[720px] font-body text-[18px] leading-[1.35] text-[#5F5370]">{readingClub.subtitle}</p>
                </div>
              </div>

              <div className="mt-5 rounded-[26px] border border-[#E8DDCF] bg-white/90 px-4 py-4" data-testid="reading-club-start-here">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-[27px] leading-[1.06] text-[#3F2447]">{readingClubCopy.startHereTitle}</p>
                    <p className="mt-1 font-body text-[16px] leading-[1.32] text-[#6E627D]">{readingClubCopy.startHereBody}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={startReadingSharePath}
                    className="min-h-[92px] rounded-[20px] border border-[#D9C7F8] bg-[#FCF9FF] px-3 py-3 text-left"
                    data-testid="button-reading-start-share"
                  >
                    <span className="flex items-center gap-2 font-body text-[17px] font-bold leading-[1.18] text-[#45325B]">
                      <PenLine size={18} strokeWidth={2.4} aria-hidden="true" />
                      {readingClubCopy.startShareLabel}
                    </span>
                    <span className="sr-only">{readingClubCopy.startShareBody}</span>
                  </button>
                  <button
                    type="button"
                    onClick={startReadingMeetPath}
                    className="min-h-[92px] rounded-[20px] border border-[#BDE8D7] bg-[#F7FFFB] px-3 py-3 text-left"
                    data-testid="button-reading-start-meet"
                  >
                    <span className="flex items-center gap-2 font-body text-[17px] font-bold leading-[1.18] text-[#244D47]">
                      <Users size={18} strokeWidth={2.4} aria-hidden="true" />
                      {readingClubCopy.startMeetLabel}
                    </span>
                    <span className="sr-only">{readingClubCopy.startMeetBody}</span>
                  </button>
                  <button
                    type="button"
                    onClick={startReadingRecommendPath}
                    className="min-h-[92px] rounded-[20px] border border-[#E8DDCF] bg-[#FFFCF7] px-3 py-3 text-left"
                    data-testid="button-reading-start-recommend"
                  >
                    <span className="flex items-center gap-2 font-body text-[17px] font-bold leading-[1.18] text-[#7C2D12]">
                      <BookMarked size={18} strokeWidth={2.4} aria-hidden="true" />
                      {readingClubCopy.startRecommendLabel}
                    </span>
                    <span className="sr-only">{readingClubCopy.startRecommendBody}</span>
                  </button>
                </div>
              </div>

              {readingClubShowDeepTools && (
                <>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    {readingClub.metrics.map((metric) => (
                      <div key={metric.id} className="min-h-[92px] rounded-[22px] border border-[#E8DDCF] bg-white/88 px-4 py-3">
                        <p className="font-body text-[15px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]">{metric.label}</p>
                        <div className="mt-1 flex items-end gap-2">
                          <p className="font-display text-[34px] leading-none text-[#3F2447]">{metric.value}</p>
                          <p className="pb-1 font-body text-[15px] leading-[1.2] text-[#6E627D]">{metric.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-3 rounded-[26px] border border-[#E8DDCF] bg-white/88 px-4 py-4 lg:grid-cols-[0.92fr_1.08fr]" data-testid="reading-club-desk">
                    <div className="min-w-0">
                      <p className="font-display text-[27px] leading-[1.06] text-[#3F2447]">{readingClubCopy.deskTitle}</p>
                      <p className="mt-2 font-body text-[16px] leading-[1.32] text-[#6E627D]">{readingClubCopy.deskBody}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-[18px] bg-[#F0FDF8] px-3 py-3">
                          <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.visitsLabel}</p>
                          <p className="mt-1 font-display text-[28px] leading-none text-[#244D47]">{readingClubDesk.visitCount}</p>
                        </div>
                        <div className="rounded-[18px] bg-[#FCF9FF] px-3 py-3">
                          <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#6B3CC7]">{readingClubCopy.streakLabel}</p>
                          <p className="mt-1 font-display text-[28px] leading-none text-[#45325B]">{readingClubDesk.streakDays}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-[18px] bg-[#FFFCF7] px-3 py-3">
                        <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]">{readingClubCopy.preferredModeLabel}</p>
                        <p className="mt-1 font-body text-[17px] font-bold leading-[1.22] text-[#3F2447]">{selectedReadingMode?.title ?? selectedReadingIntent?.label}</p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-[18px] bg-[#F7FFFB] px-3 py-3">
                          <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.favoriteShelfLabel}</p>
                          <p className="mt-1 font-body text-[16px] font-bold leading-[1.22] text-[#244D47]">{selectedReadingShelf?.label}</p>
                        </div>
                        <div className="rounded-[18px] bg-[#FFF7ED] px-3 py-3">
                          <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]">{readingClubCopy.preferredPaceLabel}</p>
                          <p className="mt-1 font-body text-[16px] font-bold leading-[1.22] text-[#3F2447]">{selectedReadingPace?.label}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-[18px] bg-[#F8F3FF] px-3 py-3">
                        <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#6B3CC7]">{readingClubCopy.lastReflectionLabel}</p>
                        <p className="mt-1 font-body text-[15px] leading-[1.3] text-[#5B4A68]">
                          {readingClubDesk.lastReflection || readingClubCopy.noLastReflectionLabel}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="font-body text-[14px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]">{readingClubCopy.intentionLabel}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {readingClubCopy.intentions.map((intent) => {
                          const active = intent.id === readingClubDesk.selectedIntentId;
                          return (
                            <button
                              key={intent.id}
                              type="button"
                              onClick={() => selectReadingIntent(intent.id)}
                              aria-pressed={active}
                              className={`min-h-[94px] rounded-[20px] border px-3 py-3 text-left ${
                                active ? "border-[#7C2D12] bg-[#FBF7F0]" : "border-[#E8DDCF] bg-white"
                              }`}
                            >
                              <span className="block font-body text-[17px] font-bold leading-[1.18] text-[#3F2447]">{intent.label}</span>
                              <span className="sr-only">{intent.body}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="mt-5 rounded-[24px] border border-[#E8DDCF] bg-white/86 px-4 py-4" data-testid="reading-club-deep-tools-toggle">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-[620px] font-body text-[16px] leading-[1.32] text-[#6E627D]">{readingClubCopy.deepToolsBody}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setReadingClubFocusedPath(null);
                      setReadingClubShowDeepTools((current) => !current);
                    }}
                    aria-expanded={readingClubShowDeepTools}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-full border border-[#E8DDCF] bg-[#FFFCF7] px-4 font-body text-[16px] font-bold text-[#7C2D12]"
                    data-testid="button-reading-toggle-deep-tools"
                  >
                    <Library size={18} strokeWidth={2.4} aria-hidden="true" />
                    {readingClubShowDeepTools ? readingClubCopy.deepToolsHideLabel : readingClubCopy.deepToolsShowLabel}
                  </button>
                </div>
              </div>
            </div>

            {readingClubFocusedPath && (
              <div className="border-t border-[#F0E4D4] px-5 py-5" data-testid="reading-club-focused-path">
                {readingClubStatus && (
                  <p
                    className="mb-4 rounded-full bg-[#ECFDF5] px-3 py-1.5 font-body text-[14px] font-bold text-[#0F766E]"
                    data-testid="reading-club-status"
                    role="status"
                  >
                    {readingClubStatus}
                  </p>
                )}

                {readingClubFocusedPath === "share" && (
                  <div className="rounded-[24px] border border-[#E8DDCF] bg-[#FFFDFC] px-4 py-4" data-testid="reading-reflection-card">
                    <div className="flex items-center gap-2">
                      <PenLine size={22} strokeWidth={2.4} className="text-[#6B3CC7]" aria-hidden="true" />
                      <p className="font-display text-[27px] leading-[1.06] text-[#45325B]">{readingClub.reflectionTitle}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {readingClub.reflectionPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setReadingReflectionDraft(prompt)}
                          className="min-h-[38px] rounded-full border border-[#D9C7F8] bg-[#FCF9FF] px-3 font-body text-[14px] font-bold text-[#6B3CC7]"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <form
                      className="mt-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitReadingReflection();
                      }}
                    >
                      <textarea
                        value={readingReflectionDraft}
                        onChange={(event) => setReadingReflectionDraft(event.target.value)}
                        placeholder={readingClub.reflectionPlaceholder}
                        aria-label={readingClub.reflectionPlaceholder}
                        rows={5}
                        className="min-h-[138px] w-full resize-none rounded-[22px] border border-[#E5D9F0] bg-[#FFFCF7] px-4 py-3 font-body text-[19px] leading-[1.35] text-[#5B4A68] outline-none placeholder:text-[#9A8EA8] focus:border-[#D8C8FB]"
                      />
                      <button
                        type="submit"
                        disabled={isChatSending || !readingReflectionDraft.trim()}
                        className="mt-3 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#6B3CC7] px-5 font-body text-[19px] font-semibold text-white disabled:opacity-50"
                      >
                        <PenLine size={21} strokeWidth={2.4} aria-hidden="true" />
                        {readingClub.reflectionSubmitLabel}
                      </button>
                    </form>
                  </div>
                )}

                {readingClubFocusedPath === "recommend" && (
                  <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[24px] border border-[#E5D9F0] bg-[#FCF9FF] px-4 py-4" data-testid="reading-recommendation-shelf">
                      <div className="flex items-start gap-3">
                        <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[18px] bg-[#7C2D12] text-white">
                          <BookMarked size={23} strokeWidth={2.4} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-[28px] leading-[1.08] text-[#45325B]">{readingClubCopy.recommendationShelfTitle}</p>
                          <p className="mt-1 font-body text-[16px] leading-[1.32] text-[#6E627D]">{readingClubCopy.recommendationShelfBody}</p>
                        </div>
                      </div>
                      <textarea
                        id="reading-recommendation-title-focused"
                        value={readingRecommendationDraft}
                        onChange={(event) => setReadingRecommendationDraft(event.target.value)}
                        placeholder={readingClubCopy.recommendationTitlePlaceholder}
                        aria-label={readingClubCopy.recommendationTitleLabel}
                        rows={5}
                        className="mt-4 min-h-[150px] w-full resize-none rounded-[18px] border border-[#E8DDCF] bg-white px-3 py-3 font-body text-[18px] leading-[1.35] text-[#45325B] outline-none placeholder:text-[#A78B7B] focus:border-[#7C2D12]"
                        data-testid="input-reading-recommendation-title"
                      />
                      <button
                        type="button"
                        onClick={saveReadingRecommendationCard}
                        disabled={!readingRecommendationDraft.trim()}
                        className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#7C2D12] px-4 font-body text-[17px] font-bold text-white disabled:opacity-50"
                        data-testid="button-reading-save-recommendation"
                      >
                        <BookMarked size={18} strokeWidth={2.4} aria-hidden="true" />
                        {readingClubCopy.recommendationShareLabel}
                      </button>
                      <div className="mt-4 rounded-[22px] border border-[#D7F2E8] bg-[#F7FFFB] px-4 py-4" data-testid="reading-recommendation-cards">
                        <p className="font-body text-[20px] font-bold leading-[1.15] text-[#244D47]">{readingClubCopy.recommendationMyShelfTitle}</p>
                        {latestReadingRecommendationCards.length > 0 ? (
                          <div className="mt-3 grid gap-3">
                            {latestReadingRecommendationCards.map((card) => (
                              <div key={card.id} className="rounded-[18px] border border-[#BDE8D7] bg-white px-3 py-3">
                                <p className="font-body text-[17px] font-bold leading-[1.22] text-[#244D47]">{card.title}</p>
                                <button
                                  type="button"
                                  onClick={() => applyReadingRecommendationCard(card)}
                                  className="mt-3 inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[#BDE8D7] bg-[#F7FFFB] px-3 font-body text-[14px] font-bold text-[#0F766E]"
                                  data-testid="button-reading-use-recommendation"
                                >
                                  <PenLine size={15} strokeWidth={2.4} aria-hidden="true" />
                                  {readingClubCopy.recommendationUseLabel}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 rounded-[18px] border border-dashed border-[#BDE8D7] bg-white px-3 py-3 font-body text-[15px] font-bold leading-[1.28] text-[#0F766E]">
                            {readingClubCopy.recommendationEmptyLabel}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#E8DDCF] bg-[#FFFDFC] px-4 py-4" data-testid="reading-reflection-card">
                      <div className="flex items-center gap-2">
                        <PenLine size={22} strokeWidth={2.4} className="text-[#6B3CC7]" aria-hidden="true" />
                        <p className="font-display text-[27px] leading-[1.06] text-[#45325B]">{readingClub.reflectionTitle}</p>
                      </div>
                      <textarea
                        value={readingReflectionDraft}
                        onChange={(event) => setReadingReflectionDraft(event.target.value)}
                        placeholder={readingClub.reflectionPlaceholder}
                        aria-label={readingClub.reflectionPlaceholder}
                        rows={5}
                        className="mt-4 min-h-[138px] w-full resize-none rounded-[22px] border border-[#E5D9F0] bg-[#FFFCF7] px-4 py-3 font-body text-[19px] leading-[1.35] text-[#5B4A68] outline-none placeholder:text-[#9A8EA8] focus:border-[#D8C8FB]"
                      />
                    </div>
                  </div>
                )}

                {readingClubFocusedPath === "meet" && (
                  <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[24px] border border-[#E8DDCF] bg-[#FFFCF7] px-4 py-4" data-testid="reading-member-lounge">
                      <div className="flex items-start gap-3">
                        <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[18px] bg-[#7C2D12] text-white">
                          <MessageCircle size={23} strokeWidth={2.4} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-[28px] leading-[1.08] text-[#45325B]">{readingClubCopy.memberLoungeTitle}</p>
                          <p className="mt-1 font-body text-[16px] leading-[1.32] text-[#6E627D]">{readingClubCopy.memberLoungeBody}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {roomMembers.slice(0, 4).map((member, index) => (
                          <div key={member.id} className="rounded-[20px] border border-[#E8DDCF] bg-white px-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex min-w-0 gap-3">
                                <div
                                  className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full text-[17px] font-bold text-white"
                                  style={{ background: getParticipantColour(index) }}
                                >
                                  {member.name.slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-body text-[19px] font-bold leading-[1.12] text-[#45325B]">{member.name}</p>
                                    <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 font-body text-[13px] font-bold text-[#0F766E]">
                                      {member.statusLabel ?? readingClubCopy.memberLoungeDefaultStatus}
                                    </span>
                                  </div>
                                  <p className="mt-1 font-body text-[16px] leading-[1.3] text-[#6E627D]">{getInterestLine(language, member)}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => prepareReadingLoungeLetter(member)}
                                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#BDE8D7] bg-[#F7FFFB] px-3 font-body text-[14px] font-bold text-[#0F766E]"
                                  data-testid={`button-reading-lounge-letter-${member.id}`}
                                >
                                  <PenLine size={16} strokeWidth={2.4} aria-hidden="true" />
                                  {readingClubCopy.memberLoungeLetterLabel}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => prepareReadingLoungeTable(member)}
                                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#E8DDCF] bg-[#FBF7F0] px-3 font-body text-[14px] font-bold text-[#7C2D12]"
                                  data-testid={`button-reading-lounge-table-${member.id}`}
                                >
                                  <CalendarPlus size={16} strokeWidth={2.4} aria-hidden="true" />
                                  {readingClubCopy.memberLoungeTableLabel}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-[#E8DDCF] bg-[#FFFCF7] px-4 py-4" data-testid="reading-companion-card">
                        <div className="flex items-center gap-2">
                          <Search size={22} strokeWidth={2.4} className="text-[#7C2D12]" aria-hidden="true" />
                          <p className="font-display text-[27px] leading-[1.06] text-[#45325B]">{readingClub.companionTitle}</p>
                        </div>
                        <p className="mt-2 font-body text-[17px] leading-[1.34] text-[#6E627D]">{readingClub.companionBody}</p>
                        <button
                          type="button"
                          onClick={() => void findReadingCompanion()}
                          disabled={isReadingMatching}
                          className="mt-4 inline-flex min-h-[54px] w-full items-center justify-center gap-3 rounded-[20px] bg-[#7C2D12] px-5 font-body text-[19px] font-semibold text-white disabled:opacity-60"
                          data-testid="button-reading-find-companion"
                        >
                          <Search size={22} strokeWidth={2.4} aria-hidden="true" />
                          {isReadingMatching ? readingClubCopy.findingLabel : selectedReadingMode?.ctaLabel ?? readingClubCopy.findLabel}
                        </button>
                        {readingMatchResponse && (
                          <div className="mt-4 rounded-[22px] border border-[#E8DDCF] bg-white px-4 py-4" data-testid="reading-match-result">
                            {!readingMatchResponse.noMatch && readingMatchResponse.matchedUser && (
                              <p className="font-body text-[18px] font-bold text-[#45325B]">
                                {readingClubCopy.resultLabel}: {readingMatchResponse.matchedUser.name}
                              </p>
                            )}
                            <p className="mt-2 font-body text-[18px] leading-[1.35] text-[#5B4A68]">{readingMatchResponse.agentMessage}</p>
                          </div>
                        )}
                      </div>

                      <div className="rounded-[24px] border border-[#D7F2E8] bg-[#F7FFFB] px-4 py-4" data-testid="reading-club-letterbox">
                        <p className="font-body text-[19px] font-bold leading-[1.18] text-[#244D47]">{readingClubCopy.letterboxTitle}</p>
                        <div className="mt-4 grid gap-3">
                          <input
                            value={readingLetterRecipientDraft}
                            onChange={(event) => setReadingLetterRecipientDraft(event.target.value)}
                            placeholder={readingClubCopy.letterRecipientPlaceholder}
                            className="min-h-[46px] w-full rounded-[16px] border border-[#BDE8D7] bg-white px-3 font-body text-[16px] font-semibold text-[#244D47] outline-none placeholder:text-[#7A9B96] focus:border-[#0F766E]"
                            data-testid="input-reading-letter-recipient"
                          />
                          <input
                            value={readingLetterSubjectDraft}
                            onChange={(event) => setReadingLetterSubjectDraft(event.target.value)}
                            placeholder={readingClubCopy.letterSubjectPlaceholder}
                            className="min-h-[46px] w-full rounded-[16px] border border-[#BDE8D7] bg-white px-3 font-body text-[16px] font-semibold text-[#244D47] outline-none placeholder:text-[#7A9B96] focus:border-[#0F766E]"
                            data-testid="input-reading-letter-subject"
                          />
                          <textarea
                            value={readingLetterBodyDraft}
                            onChange={(event) => setReadingLetterBodyDraft(event.target.value)}
                            placeholder={readingClubCopy.letterBodyPlaceholder}
                            rows={4}
                            className="min-h-[112px] w-full resize-none rounded-[16px] border border-[#BDE8D7] bg-white px-3 py-3 font-body text-[16px] leading-[1.34] text-[#244D47] outline-none placeholder:text-[#7A9B96] focus:border-[#0F766E]"
                            data-testid="textarea-reading-letter-body"
                          />
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-[#E8DDCF] bg-[#FFFDFC] px-4 py-4" data-testid="reading-host-table-board">
                        <p className="font-body text-[19px] font-bold leading-[1.18] text-[#45325B]">{readingClubCopy.hostTableTitle}</p>
                        <input
                          id="reading-host-table-topic-focused"
                          value={readingTableTopicDraft}
                          onChange={(event) => setReadingTableTopicDraft(event.target.value)}
                          placeholder={readingClubCopy.hostTableTopicPlaceholder}
                          className="mt-3 min-h-[48px] w-full rounded-[18px] border border-[#E8DDCF] bg-white px-3 font-body text-[16px] text-[#45325B] outline-none placeholder:text-[#9A839F] focus:border-[#7C2D12]"
                          data-testid="input-reading-host-table-topic"
                        />
                        <textarea
                          id="reading-host-table-note-focused"
                          value={readingTableNoteDraft}
                          onChange={(event) => setReadingTableNoteDraft(event.target.value)}
                          placeholder={readingClubCopy.hostTableNotePlaceholder}
                          rows={3}
                          className="mt-3 min-h-[92px] w-full resize-none rounded-[18px] border border-[#E8DDCF] bg-white px-3 py-3 font-body text-[15px] leading-[1.34] text-[#45325B] outline-none placeholder:text-[#9A839F] focus:border-[#7C2D12]"
                          data-testid="textarea-reading-host-table-note"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {readingClubShowDeepTools && (
              <>
            <div
              className="grid gap-4 border-t border-[#F0E4D4] px-5 py-5 lg:grid-cols-[1.05fr_0.95fr]"
              data-testid="reading-club-deep-tools"
              aria-hidden={false}
            >
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays size={22} strokeWidth={2.4} className="text-[#0F766E]" aria-hidden="true" />
                  <p className="font-display text-[28px] leading-[1.08] text-[#45325B]">{readingClub.agendaTitle}</p>
                </div>
                <div className="mt-3 space-y-3">
                  {readingClub.agenda.map((item) => (
                    <div key={item.id} className="grid gap-3 rounded-[22px] border border-[#E8DDCF] bg-[#FFFCF7] px-4 py-4 sm:grid-cols-[112px_1fr]">
                      <div>
                        <span className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 font-body text-[14px] font-bold text-[#0F766E]">
                          <Clock size={15} strokeWidth={2.4} aria-hidden="true" />
                          {item.timeLabel}
                        </span>
                        <p className="mt-2 font-body text-[14px] font-bold text-[#7C2D12]">{item.statusLabel}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="font-body text-[20px] font-bold leading-[1.2] text-[#3F2447]">{item.title}</p>
                        <p className="mt-1 font-body text-[17px] leading-[1.34] text-[#6E627D]">{item.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-[24px] border border-[#D9C7F8] bg-[#FCF9FF] px-4 py-4" data-testid="reading-club-program">
                  <div className="flex items-center gap-2">
                    <CalendarPlus size={22} strokeWidth={2.4} className="text-[#6B3CC7]" aria-hidden="true" />
                    <p className="font-display text-[27px] leading-[1.06] text-[#45325B]">{readingClubCopy.programTitle}</p>
                  </div>
                  <p className="mt-2 font-body text-[16px] leading-[1.32] text-[#6E627D]">{readingClubCopy.programBody}</p>

                  <div className="mt-4 grid gap-3">
                    {readingClubCopy.programSessions.map((session) => {
                      const saved = readingClubDesk.plannedProgramSessionIds.includes(session.id);
                      return (
                        <div key={session.id} className="rounded-[20px] border border-[#E5D9F0] bg-white px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-[#F0FDF8] px-3 py-1 font-body text-[13px] font-bold text-[#0F766E]">{session.dayLabel}</span>
                                <span className="rounded-full bg-[#FBF7F0] px-3 py-1 font-body text-[13px] font-bold text-[#7C2D12]">{session.timeLabel}</span>
                              </div>
                              <p className="mt-2 font-body text-[20px] font-bold leading-[1.18] text-[#45325B]">{session.title}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (saved) {
                                  removeReadingProgramSeat(session.id);
                                  return;
                                }
                                saveReadingProgramSeat(session.id);
                              }}
                              aria-pressed={saved}
                              className={`inline-flex min-h-[42px] items-center gap-2 rounded-full px-4 font-body text-[15px] font-bold ${
                                saved
                                  ? "bg-[#6B3CC7] text-white"
                                  : "border border-[#D9C7F8] bg-[#FCF9FF] text-[#6B3CC7]"
                              }`}
                            >
                              {saved ? <Check size={17} strokeWidth={2.4} aria-hidden="true" /> : <CalendarPlus size={17} strokeWidth={2.4} aria-hidden="true" />}
                              {saved ? readingClubCopy.programSavedLabel : readingClubCopy.programSaveLabel}
                            </button>
                          </div>
                          <p className="mt-2 font-body text-[16px] leading-[1.32] text-[#6E627D]">{session.body}</p>
                          <p className="mt-2 font-body text-[14px] font-bold text-[#7C2D12]">{session.hostLine}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-[20px] border border-[#E5D9F0] bg-[#FFFDFC] px-4 py-4" data-testid="reading-club-my-program">
                    <p className="font-body text-[17px] font-bold text-[#45325B]">{readingClubCopy.programMyWeekTitle}</p>
                    {savedReadingProgramSessions.length > 0 ? (
                      <div className="mt-3 grid gap-2">
                        {savedReadingProgramSessions.map((session) => (
                          <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#D9C7F8] bg-white px-3 py-3">
                            <div>
                              <p className="font-body text-[16px] font-bold leading-[1.18] text-[#45325B]">{session.title}</p>
                              <p className="mt-1 font-body text-[14px] leading-[1.24] text-[#6E627D]">{session.dayLabel} / {session.timeLabel}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeReadingProgramSeat(session.id)}
                              aria-label={readingClubCopy.programRemoveLabel}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5D9F0] bg-[#FCF9FF] text-[#6B3CC7]"
                            >
                              <Trash2 size={16} strokeWidth={2.4} aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-[18px] border border-dashed border-[#D9C7F8] bg-white px-3 py-3 font-body text-[15px] font-bold text-[#6B3CC7]">
                        {readingClubCopy.programEmptyLabel}
                      </p>
                    )}
                  </div>
                </div>
                {activeReadingPulse && (
                  <div className="mt-4 rounded-[24px] border border-[#D7F2E8] bg-[#F7FFFB] px-4 py-4" data-testid="reading-club-live-tables">
                    <p className="font-body text-[14px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.liveTablesLabel}</p>
                    <p className="mt-2 font-body text-[22px] font-bold leading-[1.18] text-[#244D47]">{activeReadingPulse.featuredPlan.title}</p>
                    <p className="mt-1 font-body text-[17px] leading-[1.34] text-[#41655F]">{activeReadingPulse.featuredPlan.body}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void respondToReadingPlan(activeReadingPulse.featuredPlan.key, "join")}
                        disabled={isReadingPulseSending}
                        aria-pressed={activeReadingPulse.featuredPlan.myResponse === "join"}
                        className={`min-h-[46px] rounded-full px-4 font-body text-[16px] font-bold ${
                          activeReadingPulse.featuredPlan.myResponse === "join"
                            ? "bg-[#0F766E] text-white"
                            : "border border-[#BDE8D7] bg-white text-[#0F766E]"
                        } disabled:opacity-60`}
                      >
                        {readingClubCopy.joinLabel} ({activeReadingPulse.featuredPlan.responseCounts.join})
                      </button>
                      <button
                        type="button"
                        onClick={() => void respondToReadingPlan(activeReadingPulse.featuredPlan.key, "maybe")}
                        disabled={isReadingPulseSending}
                        aria-pressed={activeReadingPulse.featuredPlan.myResponse === "maybe"}
                        className={`min-h-[46px] rounded-full px-4 font-body text-[16px] font-bold ${
                          activeReadingPulse.featuredPlan.myResponse === "maybe"
                            ? "bg-[#7C2D12] text-white"
                            : "border border-[#E8DDCF] bg-white text-[#7C2D12]"
                        } disabled:opacity-60`}
                      >
                        {readingClubCopy.maybeLabel} ({activeReadingPulse.featuredPlan.responseCounts.maybe})
                      </button>
                    </div>
                    {activeReadingPulse.secondaryPlans.length > 0 && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {activeReadingPulse.secondaryPlans.slice(0, 2).map((plan) => (
                          <button
                            key={plan.key}
                            type="button"
                            onClick={() => void respondToReadingPlan(plan.key, "join")}
                            disabled={isReadingPulseSending}
                            className="min-h-[86px] rounded-[20px] border border-[#D7F2E8] bg-white px-3 py-3 text-left font-body"
                          >
                            <span className="block text-[17px] font-bold leading-[1.2] text-[#244D47]">{plan.title}</span>
                            <span className="mt-1 block text-[14px] leading-[1.28] text-[#41655F]">
                              {readingClubCopy.joinLabel}: {plan.responseCounts.join} / {readingClubCopy.maybeLabel}: {plan.responseCounts.maybe}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="rounded-[24px] border border-[#D7F2E8] bg-[#F0FDF8] px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={21} strokeWidth={2.4} className="text-[#0F766E]" aria-hidden="true" />
                    <p className="font-body text-[18px] font-bold text-[#0F766E]">{readingClub.todayQuestion}</p>
                  </div>
                  <p className="mt-3 font-body text-[18px] leading-[1.34] text-[#4D5D5A]">{readingClub.hostNote}</p>
                </div>

                <div className="rounded-[24px] border border-[#E8DDCF] bg-[#FBF7F0] px-4 py-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={21} strokeWidth={2.4} className="text-[#7C2D12]" aria-hidden="true" />
                    <p className="font-body text-[18px] font-bold text-[#7C2D12]">{readingClub.guidelinesTitle}</p>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {readingClub.guidelines.map((guideline) => (
                      <div key={guideline} className="flex gap-2 font-body text-[16px] leading-[1.32] text-[#5B4A68]">
                        <Check size={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                        <span>{guideline}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void sendReadingClubHelp()}
                    disabled={isReadingPulseSending}
                    className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[18px] border border-[#E8DDCF] bg-white px-4 font-body text-[16px] font-bold text-[#7C2D12] disabled:opacity-60"
                  >
                    <ShieldCheck size={18} strokeWidth={2.4} aria-hidden="true" />
                    {readingClubCopy.clubHelpLabel}
                  </button>
                </div>

                {activeReadingPulse && (
                  <div className="rounded-[24px] border border-[#D9C7F8] bg-[#FCF9FF] px-4 py-4" data-testid="reading-club-shelf-vote">
                    <p className="font-body text-[14px] font-bold uppercase tracking-[0.08em] text-[#6B3CC7]">{readingClubCopy.shelfPollLabel}</p>
                    <p className="mt-2 font-body text-[21px] font-bold leading-[1.18] text-[#45325B]">{activeReadingPulse.activePoll.question}</p>
                    <div className="mt-3 grid gap-2">
                      {activeReadingPulse.activePoll.options.map((option) => {
                        const selected = activeReadingPulse.activePoll.myVote === option.id;
                        const percent = activeReadingPulse.activePoll.totalVotes > 0
                          ? Math.round((option.votes / activeReadingPulse.activePoll.totalVotes) * 100)
                          : 0;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => void voteReadingShelf(option.id)}
                            disabled={readingPollClosed || isReadingPulseSending}
                            aria-pressed={selected}
                            className={`min-h-[54px] rounded-[18px] border px-3 py-2 text-left ${
                              selected ? "border-[#6B3CC7] bg-white" : "border-[#E5D9F0] bg-[#FFFDFC]"
                            } disabled:opacity-60`}
                          >
                            <span className="flex items-center justify-between gap-3 font-body text-[16px] font-bold text-[#45325B]">
                              <span>{option.label}</span>
                              <span>{percent}%</span>
                            </span>
                            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-[#EDE4FB]">
                              <span className="block h-full rounded-full bg-[#6B3CC7]" style={{ width: `${percent}%` }} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#F0E4D4] px-5 py-5">
              <div className="flex items-center gap-2">
                <Library size={22} strokeWidth={2.4} className="text-[#7C2D12]" aria-hidden="true" />
                <p className="font-display text-[28px] leading-[1.08] text-[#45325B]">{readingClub.shelvesTitle}</p>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {readingClub.shelves.map((shelf) => (
                  <div key={shelf.id} className="rounded-[24px] border border-[#E8DDCF] bg-[#FFFDFC] px-4 py-4">
                    <p className="font-body text-[21px] font-bold text-[#3F2447]">{shelf.title}</p>
                    <p className="mt-1 font-body text-[16px] leading-[1.32] text-[#6E627D]">{shelf.body}</p>
                    <div className="mt-3 grid gap-3">
                      {shelf.items.map((item) => (
                        <div key={item.id} className="rounded-[20px] bg-[#FBF7F0] px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-3 py-1 font-body text-[13px] font-bold text-[#7C2D12]">{item.tag}</span>
                            <span className="font-body text-[14px] font-semibold text-[#7A677F]">{item.authorLabel}</span>
                          </div>
                          <p className="mt-2 font-body text-[19px] font-bold leading-[1.22] text-[#45325B]">{item.title}</p>
                          <p className="mt-1 font-body text-[16px] leading-[1.32] text-[#6E627D]">{item.body}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setReadingReflectionDraft(item.discussionStarter);
                              completeReadingPassportItem("recommend", true);
                              incrementReadingProgressMetric("recommendationsMade");
                              saveReadingShelfItem({
                                kind: "prompt",
                                title: item.title,
                                body: item.discussionStarter,
                              });
                            }}
                            className="mt-3 inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#E8DDCF] bg-white px-4 font-body text-[15px] font-bold text-[#7C2D12]"
                          >
                            <BookMarked size={17} strokeWidth={2.4} aria-hidden="true" />
                            {item.discussionStarter}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[24px] border border-[#D7F2E8] bg-[#F7FFFB] px-4 py-4" data-testid="reading-saved-shelf">
                <div className="flex items-center gap-2">
                  <BookmarkCheck size={22} strokeWidth={2.4} className="text-[#0F766E]" aria-hidden="true" />
                  <p className="font-display text-[27px] leading-[1.06] text-[#244D47]">{readingClubCopy.savedShelfTitle}</p>
                </div>
                <p className="mt-2 font-body text-[16px] leading-[1.32] text-[#41655F]">{readingClubCopy.savedShelfBody}</p>

                {readingClubDesk.savedShelfItems.length > 0 ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {readingClubDesk.savedShelfItems.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-[20px] border border-[#BDE8D7] bg-white px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
                            {getSavedShelfKindLabel(item.kind, readingClubCopy)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeReadingShelfItem(item.id)}
                            aria-label={readingClubCopy.savedShelfRemoveLabel}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D7F2E8] bg-[#F7FFFB] text-[#0F766E]"
                          >
                            <Trash2 size={16} strokeWidth={2.4} aria-hidden="true" />
                          </button>
                        </div>
                        <p className="mt-2 font-body text-[18px] font-bold leading-[1.18] text-[#244D47]">{item.title}</p>
                        {item.body && <p className="mt-2 font-body text-[15px] leading-[1.32] text-[#41655F]">{item.body}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[20px] border border-dashed border-[#BDE8D7] bg-white px-4 py-5 font-body text-[16px] font-bold text-[#0F766E]">
                    {readingClubCopy.savedShelfEmptyLabel}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-[24px] border border-[#E5D9F0] bg-[#FCF9FF] px-4 py-4" data-testid="reading-recommendation-shelf">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[18px] bg-[#7C2D12] text-white">
                      <BookMarked size={23} strokeWidth={2.4} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-[28px] leading-[1.08] text-[#45325B]">{readingClubCopy.recommendationShelfTitle}</p>
                      <p className="mt-1 font-body text-[16px] leading-[1.32] text-[#6E627D]">{readingClubCopy.recommendationShelfBody}</p>
                    </div>
                  </div>
                  {readingClubStatus && (
                    <p className="rounded-full bg-[#ECFDF5] px-3 py-1.5 font-body text-[14px] font-bold text-[#0F766E]">
                      {readingClubStatus}
                    </p>
                  )}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-[24px] border border-[#D9C7F8] bg-white px-4 py-4">
                    <label className="block font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]" htmlFor="reading-recommendation-title">
                      {readingClubCopy.recommendationTitleLabel}
                    </label>
                    <textarea
                      id="reading-recommendation-title"
                      value={readingRecommendationDraft}
                      onChange={(event) => setReadingRecommendationDraft(event.target.value)}
                      placeholder={readingClubCopy.recommendationTitlePlaceholder}
                      rows={6}
                      className="mt-2 min-h-[170px] w-full resize-none rounded-[18px] border border-[#E8DDCF] bg-[#FFFCF7] px-3 py-3 font-body text-[18px] leading-[1.35] text-[#45325B] outline-none placeholder:text-[#A78B7B] focus:border-[#7C2D12]"
                      data-testid="input-reading-recommendation-title"
                    />
                    <button
                      type="button"
                      onClick={saveReadingRecommendationCard}
                      disabled={!readingRecommendationDraft.trim()}
                      className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#7C2D12] px-4 font-body text-[17px] font-bold text-white disabled:opacity-50"
                      data-testid="button-reading-save-recommendation"
                    >
                      <BookMarked size={18} strokeWidth={2.4} aria-hidden="true" />
                      {readingClubCopy.recommendationShareLabel}
                    </button>
                  </div>

                  <div className="rounded-[24px] border border-[#D7F2E8] bg-[#F7FFFB] px-4 py-4" data-testid="reading-recommendation-cards">
                    <div className="flex items-center gap-2">
                      <BookmarkCheck size={21} strokeWidth={2.4} className="text-[#0F766E]" aria-hidden="true" />
                      <p className="font-body text-[20px] font-bold leading-[1.15] text-[#244D47]">{readingClubCopy.recommendationMyShelfTitle}</p>
                    </div>
                    {latestReadingRecommendationCards.length > 0 ? (
                      <div className="mt-3 grid gap-3">
                        {latestReadingRecommendationCards.map((card) => (
                            <div key={card.id} className="rounded-[18px] border border-[#BDE8D7] bg-white px-3 py-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-body text-[17px] font-bold leading-[1.22] text-[#244D47]">{card.title}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeReadingRecommendationCard(card.id)}
                                  aria-label={readingClubCopy.recommendationRemoveLabel}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#BDE8D7] bg-[#F7FFFB] text-[#0F766E]"
                                  data-testid="button-reading-remove-recommendation"
                                >
                                  <Trash2 size={16} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                              </div>
                              {card.note && <p className="mt-2 font-body text-[15px] leading-[1.32] text-[#41655F]">{card.note}</p>}
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <p className="font-body text-[13px] font-bold text-[#0F766E]">
                                  {readingClubCopy.recommendationCreatedLabel} {formatReadingLetterDate(card.createdAt, language)}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => applyReadingRecommendationCard(card)}
                                  className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[#BDE8D7] bg-[#F7FFFB] px-3 font-body text-[14px] font-bold text-[#0F766E]"
                                  data-testid="button-reading-use-recommendation"
                                >
                                  <PenLine size={15} strokeWidth={2.4} aria-hidden="true" />
                                  {readingClubCopy.recommendationUseLabel}
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="mt-4 rounded-[18px] border border-dashed border-[#BDE8D7] bg-white px-3 py-3 font-body text-[15px] font-bold leading-[1.28] text-[#0F766E]">
                        {readingClubCopy.recommendationEmptyLabel}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[24px] border border-[#E8DDCF] bg-[#FFFCF7] px-4 py-4" data-testid="reading-exchange-board">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[18px] bg-[#6B3CC7] text-white">
                      <Search size={23} strokeWidth={2.4} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-[28px] leading-[1.08] text-[#45325B]">{readingClubCopy.exchangeBoardTitle}</p>
                      <p className="mt-1 font-body text-[16px] leading-[1.32] text-[#6E627D]">{readingClubCopy.exchangeBoardBody}</p>
                    </div>
                  </div>
                  {readingClubStatus && (
                    <p className="rounded-full bg-[#ECFDF5] px-3 py-1.5 font-body text-[14px] font-bold text-[#0F766E]">
                      {readingClubStatus}
                    </p>
                  )}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-[24px] border border-[#E5D9F0] bg-white px-4 py-4">
                    <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#6B3CC7]">{readingClubCopy.exchangeKindLabel}</p>
                    <div className="mt-2 grid gap-2">
                      {readingClubCopy.exchangeKindOptions.map((option) => {
                        const active = selectedReadingExchangeKindId === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setSelectedReadingExchangeKindId(option.id)}
                            aria-pressed={active}
                            className={`min-h-[84px] rounded-[18px] border px-3 py-3 text-left ${
                              active ? "border-[#6B3CC7] bg-[#FCF9FF]" : "border-[#E5D9F0] bg-white"
                            }`}
                          >
                            <span className="block font-body text-[15px] font-bold leading-[1.2] text-[#45325B]">{option.label}</span>
                            <span className="sr-only">{option.body}</span>
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-4 font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.exchangeShelfLabel}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {readingClubCopy.shelfOptions.map((shelf) => {
                        const active = selectedReadingExchangeShelfId === shelf.id;
                        return (
                          <button
                            key={shelf.id}
                            type="button"
                            onClick={() => setSelectedReadingExchangeShelfId(shelf.id)}
                            aria-pressed={active}
                            className={`min-h-[70px] rounded-[18px] border px-3 py-3 text-left ${
                              active ? "border-[#0F766E] bg-[#F0FDF8]" : "border-[#D7F2E8] bg-[#F7FFFB]"
                            }`}
                          >
                            <span className="block font-body text-[15px] font-bold leading-[1.2] text-[#244D47]">{shelf.label}</span>
                            <span className="sr-only">{shelf.body}</span>
                          </button>
                        );
                      })}
                    </div>

                    <label className="mt-4 block font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]" htmlFor="reading-exchange-topic">
                      {readingClubCopy.exchangeTopicLabel}
                    </label>
                    <input
                      id="reading-exchange-topic"
                      value={readingExchangeTopicDraft}
                      onChange={(event) => setReadingExchangeTopicDraft(event.target.value)}
                      placeholder={readingClubCopy.exchangeTopicPlaceholder}
                      className="mt-2 min-h-[48px] w-full rounded-[18px] border border-[#E8DDCF] bg-[#FFFDFC] px-3 font-body text-[16px] text-[#45325B] outline-none placeholder:text-[#9A839F] focus:border-[#7C2D12]"
                      data-testid="input-reading-exchange-topic"
                    />

                    <label className="mt-4 block font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]" htmlFor="reading-exchange-note">
                      {readingClubCopy.exchangeNoteLabel}
                    </label>
                    <textarea
                      id="reading-exchange-note"
                      value={readingExchangeNoteDraft}
                      onChange={(event) => setReadingExchangeNoteDraft(event.target.value)}
                      placeholder={readingClubCopy.exchangeNotePlaceholder}
                      rows={3}
                      className="mt-2 min-h-[92px] w-full resize-none rounded-[18px] border border-[#E8DDCF] bg-[#FFFDFC] px-3 py-3 font-body text-[15px] leading-[1.34] text-[#45325B] outline-none placeholder:text-[#9A839F] focus:border-[#7C2D12]"
                      data-testid="textarea-reading-exchange-note"
                    />

                    <button
                      type="button"
                      onClick={saveReadingExchangeRequest}
                      disabled={!readingExchangeTopicDraft.trim()}
                      className="mt-3 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#6B3CC7] px-4 font-body text-[16px] font-bold text-white disabled:opacity-50"
                      data-testid="button-reading-save-exchange"
                    >
                      <BookMarked size={18} strokeWidth={2.4} aria-hidden="true" />
                      {readingClubCopy.exchangePostLabel}
                    </button>
                  </div>

                  <div className="rounded-[24px] border border-[#D7F2E8] bg-[#F7FFFB] px-4 py-4" data-testid="reading-exchange-requests">
                    <div className="flex items-center gap-2">
                      <MessageCircle size={21} strokeWidth={2.4} className="text-[#0F766E]" aria-hidden="true" />
                      <p className="font-body text-[20px] font-bold leading-[1.15] text-[#244D47]">{readingClubCopy.exchangeMyRequestsTitle}</p>
                    </div>
                    {latestReadingExchangeRequests.length > 0 ? (
                      <div className="mt-3 grid gap-3">
                        {latestReadingExchangeRequests.map((request) => {
                          const kind = readingClubCopy.exchangeKindOptions.find((option) => option.id === request.kindId);
                          const shelf = readingClubCopy.shelfOptions.find((option) => option.id === request.shelfId);
                          return (
                            <div key={request.id} className="rounded-[20px] border border-[#BDE8D7] bg-white px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
                                      {kind?.label ?? request.kindId}
                                    </span>
                                    <span className="rounded-full bg-[#FCF9FF] px-3 py-1 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-[#6B3CC7]">
                                      {shelf?.label ?? request.shelfId}
                                    </span>
                                  </div>
                                  <p className="mt-2 font-body text-[19px] font-bold leading-[1.18] text-[#244D47]">{request.topic}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeReadingExchangeRequest(request.id)}
                                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-[#BDE8D7] bg-[#F7FFFB] px-3 font-body text-[12px] font-bold text-[#0F766E]"
                                  data-testid="button-reading-remove-exchange"
                                >
                                  <Trash2 size={13} strokeWidth={2.4} aria-hidden="true" />
                                  {readingClubCopy.exchangeRemoveLabel}
                                </button>
                              </div>
                              <p className="mt-2 font-body text-[14px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]">
                                {readingClubCopy.exchangeCreatedLabel} {formatReadingLetterDate(request.createdAt, language)}
                              </p>
                              {request.note && <p className="mt-2 font-body text-[15px] leading-[1.32] text-[#41655F]">{request.note}</p>}
                              <button
                                type="button"
                                onClick={() => applyReadingExchangeRequest(request)}
                                className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#D9C7F8] bg-[#FCF9FF] px-4 font-body text-[14px] font-bold text-[#6B3CC7]"
                                data-testid="button-reading-use-exchange"
                              >
                                <PenLine size={15} strokeWidth={2.4} aria-hidden="true" />
                                {readingClubCopy.exchangeUseLabel}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-[20px] border border-dashed border-[#BDE8D7] bg-white px-4 py-5 font-body text-[16px] font-bold text-[#0F766E]">
                        {readingClubCopy.exchangeEmptyLabel}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[24px] border border-[#E8DDCF] bg-[#FFFDFC] px-4 py-4" data-testid="reading-host-table-board">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[18px] bg-[#7C2D12] text-white">
                      <CalendarPlus size={23} strokeWidth={2.4} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-[28px] leading-[1.08] text-[#45325B]">{readingClubCopy.hostTableTitle}</p>
                      <p className="mt-1 font-body text-[16px] leading-[1.32] text-[#6E627D]">{readingClubCopy.hostTableBody}</p>
                    </div>
                  </div>
                  {readingClubStatus && (
                    <p className="rounded-full bg-[#ECFDF5] px-3 py-1.5 font-body text-[14px] font-bold text-[#0F766E]">
                      {readingClubStatus}
                    </p>
                  )}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-[24px] border border-[#E8DDCF] bg-[#FFFCF7] px-4 py-4">
                    <label className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]" htmlFor="reading-host-table-topic">
                      {readingClubCopy.hostTableTopicLabel}
                    </label>
                    <input
                      id="reading-host-table-topic"
                      value={readingTableTopicDraft}
                      onChange={(event) => setReadingTableTopicDraft(event.target.value)}
                      placeholder={readingClubCopy.hostTableTopicPlaceholder}
                      className="mt-2 min-h-[48px] w-full rounded-[18px] border border-[#E8DDCF] bg-white px-3 font-body text-[16px] text-[#45325B] outline-none placeholder:text-[#9A839F] focus:border-[#7C2D12]"
                      data-testid="input-reading-host-table-topic"
                    />

                    <div className="mt-4">
                      <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.hostTableCircleLabel}</p>
                      <div className="mt-2 grid gap-2">
                        {readingHostCircleOptions.map((circle) => {
                          const active = selectedReadingTableCircleId === circle.id;
                          return (
                            <button
                              key={circle.id}
                              type="button"
                              onClick={() => setSelectedReadingTableCircleId(circle.id)}
                              aria-pressed={active}
                              className={`rounded-[18px] border px-3 py-3 text-left ${
                                active ? "border-[#0F766E] bg-[#ECFDF5]" : "border-[#E8DDCF] bg-white"
                              }`}
                            >
                              <span className="block font-body text-[16px] font-bold leading-[1.2] text-[#244D47]">{circle.title}</span>
                              <span className="sr-only">{circle.body}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]">{readingClubCopy.hostTableTimeLabel}</p>
                        <div className="mt-2 grid gap-2">
                          {readingClubCopy.hostTableTimeOptions.map((option) => {
                            const active = selectedReadingTableTimeId === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => setSelectedReadingTableTimeId(option.id)}
                                aria-pressed={active}
                                className={`min-h-[58px] rounded-[16px] border px-3 py-2 text-left ${
                                  active ? "border-[#7C2D12] bg-white text-[#7C2D12]" : "border-[#E8DDCF] bg-[#FFFDFC] text-[#6E627D]"
                                }`}
                              >
                                <span className="block font-body text-[15px] font-bold">{option.label}</span>
                                <span className="sr-only">{option.body}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#6B3CC7]">{readingClubCopy.hostTableComfortLabel}</p>
                        <div className="mt-2 grid gap-2">
                          {readingClubCopy.hostTableComfortOptions.map((option) => {
                            const active = selectedReadingTableComfortId === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => setSelectedReadingTableComfortId(option.id)}
                                aria-pressed={active}
                                className={`min-h-[58px] rounded-[16px] border px-3 py-2 text-left ${
                                  active ? "border-[#6B3CC7] bg-[#FCF9FF] text-[#45325B]" : "border-[#E5D9F0] bg-white text-[#6E627D]"
                                }`}
                              >
                                <span className="block font-body text-[15px] font-bold">{option.label}</span>
                                <span className="sr-only">{option.body}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <label className="mt-4 block font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]" htmlFor="reading-host-table-note">
                      {readingClubCopy.hostTableNoteLabel}
                    </label>
                    <textarea
                      id="reading-host-table-note"
                      value={readingTableNoteDraft}
                      onChange={(event) => setReadingTableNoteDraft(event.target.value)}
                      placeholder={readingClubCopy.hostTableNotePlaceholder}
                      rows={3}
                      className="mt-2 min-h-[92px] w-full resize-none rounded-[18px] border border-[#E8DDCF] bg-white px-3 py-3 font-body text-[15px] leading-[1.34] text-[#45325B] outline-none placeholder:text-[#9A839F] focus:border-[#7C2D12]"
                      data-testid="textarea-reading-host-table-note"
                    />
                    <button
                      type="button"
                      onClick={publishReadingHostedTable}
                      disabled={!readingTableTopicDraft.trim()}
                      className="mt-3 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#7C2D12] px-4 font-body text-[16px] font-bold text-white disabled:opacity-50"
                      data-testid="button-reading-publish-host-table"
                    >
                      <CalendarPlus size={18} strokeWidth={2.4} aria-hidden="true" />
                      {readingClubCopy.hostTablePublishLabel}
                    </button>
                  </div>

                  <div className="rounded-[24px] border border-[#D7F2E8] bg-[#F7FFFB] px-4 py-4" data-testid="reading-hosted-tables">
                    <div className="flex items-center gap-2">
                      <Clock size={21} strokeWidth={2.4} className="text-[#0F766E]" aria-hidden="true" />
                      <p className="font-body text-[20px] font-bold leading-[1.15] text-[#244D47]">{readingClubCopy.hostTableMyTablesTitle}</p>
                    </div>
                    {latestHostedReadingTables.length > 0 ? (
                      <div className="mt-3 grid gap-3">
                        {latestHostedReadingTables.map((table) => {
                          const circle = readingHostCircleOptions.find((item) => item.id === table.circleId);
                          const time = readingClubCopy.hostTableTimeOptions.find((item) => item.id === table.timeSlotId);
                          const comfort = readingClubCopy.hostTableComfortOptions.find((item) => item.id === table.comfortId);
                          return (
                            <div key={table.id} className="rounded-[20px] border border-[#BDE8D7] bg-white px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
                                      {time?.label ?? table.timeSlotId}
                                    </span>
                                    <span className="rounded-full bg-[#FCF9FF] px-3 py-1 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-[#6B3CC7]">
                                      {comfort?.label ?? table.comfortId}
                                    </span>
                                  </div>
                                  <p className="mt-2 font-body text-[19px] font-bold leading-[1.18] text-[#244D47]">{table.topic}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeReadingHostedTable(table.id)}
                                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-[#BDE8D7] bg-[#F7FFFB] px-3 font-body text-[12px] font-bold text-[#0F766E]"
                                  data-testid="button-reading-remove-host-table"
                                >
                                  <Trash2 size={13} strokeWidth={2.4} aria-hidden="true" />
                                  {readingClubCopy.hostTableRemoveLabel}
                                </button>
                              </div>
                              <p className="mt-2 font-body text-[14px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]">
                                {circle?.title ?? table.circleId} - {readingClubCopy.hostTableCreatedLabel} {formatReadingLetterDate(table.createdAt, language)}
                              </p>
                              {table.note && <p className="mt-2 font-body text-[15px] leading-[1.32] text-[#41655F]">{table.note}</p>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-[20px] border border-dashed border-[#BDE8D7] bg-white px-4 py-5 font-body text-[16px] font-bold text-[#0F766E]">
                        {readingClubCopy.hostTableEmptyLabel}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
              </>
            )}

            {readingClubShowDeepTools && (
              <>
            {activeReadingPulse && (
              <div className="border-t border-[#F0E4D4] px-5 py-5" data-testid="reading-club-shared-table">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle size={22} strokeWidth={2.4} className="text-[#6B3CC7]" aria-hidden="true" />
                    <p className="font-display text-[28px] leading-[1.08] text-[#45325B]">{readingClubCopy.sharedTableLabel}</p>
                  </div>
                  {readingClubStatus && (
                    <p className="rounded-full bg-[#ECFDF5] px-3 py-1.5 font-body text-[14px] font-bold text-[#0F766E]">
                      {readingClubStatus}
                    </p>
                  )}
                </div>

                {readingClubUpdates.length > 0 && (
                  <div className="mt-3 rounded-[22px] border border-[#D7F2E8] bg-[#F7FFFB] px-4 py-3">
                    <p className="font-body text-[14px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.updatesLabel}</p>
                    <div className="mt-2 grid gap-2">
                      {readingClubUpdates.map((update) => (
                        <p key={update.id} className="font-body text-[16px] leading-[1.3] text-[#41655F]">
                          <span className="font-bold">{update.title}</span> {update.body}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {activeReadingPosts.length > 0 ? activeReadingPosts.map((post) => (
                    <div key={post.key} className="rounded-[24px] border border-[#E8DDCF] bg-[#FFFCF7] px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]">
                          {post.kind ?? "message"}
                        </span>
                        <span className="font-body text-[13px] font-bold text-[#6E627D]">{post.locationLabel}</span>
                      </div>
                      <p className="mt-2 font-body text-[20px] font-bold leading-[1.18] text-[#3F2447]">{post.title}</p>
                      {post.body && <p className="mt-2 font-body text-[16px] leading-[1.34] text-[#6E627D]">{post.body}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void respondToReadingPlan(post.key, "join")}
                          disabled={isReadingPulseSending}
                          aria-pressed={post.myResponse === "join"}
                          className={`min-h-[42px] rounded-full px-3 font-body text-[14px] font-bold ${
                            post.myResponse === "join"
                              ? "bg-[#0F766E] text-white"
                              : "border border-[#BDE8D7] bg-white text-[#0F766E]"
                          } disabled:opacity-60`}
                        >
                          {readingClubCopy.joinLabel} ({post.responseCounts.join})
                        </button>
                        <button
                          type="button"
                          onClick={() => void respondToReadingPlan(post.key, "maybe")}
                          disabled={isReadingPulseSending}
                          aria-pressed={post.myResponse === "maybe"}
                          className={`min-h-[42px] rounded-full px-3 font-body text-[14px] font-bold ${
                            post.myResponse === "maybe"
                              ? "bg-[#7C2D12] text-white"
                              : "border border-[#E8DDCF] bg-white text-[#7C2D12]"
                          } disabled:opacity-60`}
                        >
                          {readingClubCopy.maybeLabel} ({post.responseCounts.maybe})
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-[24px] border border-dashed border-[#D9C7F8] bg-[#FCF9FF] px-4 py-5 font-body text-[17px] font-semibold text-[#6B3CC7]">
                      {readingClubCopy.noPostsLabel}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-4 border-t border-[#F0E4D4] px-5 py-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="rounded-[24px] border border-[#D7F2E8] bg-[#F7FFFB] px-4 py-4" data-testid="reading-reader-circles">
                  <div className="flex items-start gap-3">
                    <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[18px] bg-[#0F766E] text-white">
                      <Users size={23} strokeWidth={2.4} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-[28px] leading-[1.08] text-[#244D47]">{readingClubCopy.readerCirclesTitle}</p>
                      <p className="mt-1 font-body text-[16px] leading-[1.32] text-[#41655F]">{readingClubCopy.readerCirclesBody}</p>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[20px] border border-[#BDE8D7] bg-white">
                    {readingClubCopy.readerCircles.map((circle) => {
                      const joined = readingClubDesk.joinedReaderCircleIds.includes(circle.id);
                      return (
                        <div key={circle.id} className="border-b border-[#D7F2E8] px-3 py-3 last:border-b-0">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
                                  {circle.badge}
                                </span>
                                <span className="font-body text-[14px] font-bold text-[#7C2D12]">{circle.memberLine}</span>
                              </div>
                              <p className="mt-2 font-body text-[19px] font-bold leading-[1.18] text-[#244D47]">{circle.title}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (joined) {
                                  leaveReadingCircle(circle.id);
                                  return;
                                }
                                joinReadingCircle(circle.id);
                              }}
                              aria-pressed={joined}
                              className={`inline-flex min-h-[42px] items-center gap-2 rounded-full px-4 font-body text-[15px] font-bold ${
                                joined
                                  ? "bg-[#0F766E] text-white"
                                  : "border border-[#BDE8D7] bg-[#F7FFFB] text-[#0F766E]"
                              }`}
                            >
                              {joined ? <Check size={17} strokeWidth={2.5} aria-hidden="true" /> : <Users size={17} strokeWidth={2.4} aria-hidden="true" />}
                              {joined ? readingClubCopy.circleJoinedLabel : readingClubCopy.circleJoinLabel}
                            </button>
                          </div>
                          <p className="mt-2 font-body text-[15px] leading-[1.3] text-[#41655F]">{circle.body}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-[20px] border border-dashed border-[#BDE8D7] bg-white px-3 py-3" data-testid="reading-my-circles">
                    <p className="font-body text-[16px] font-bold text-[#244D47]">{readingClubCopy.myCirclesTitle}</p>
                    {joinedReadingCircles.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {joinedReadingCircles.map((circle) => (
                          <span key={circle.id} className="inline-flex min-h-[38px] items-center gap-2 rounded-full bg-[#ECFDF5] px-3 font-body text-[14px] font-bold text-[#0F766E]">
                            {circle.title}
                            <button
                              type="button"
                              onClick={() => leaveReadingCircle(circle.id)}
                              aria-label={`${readingClubCopy.circleLeaveLabel}: ${circle.title}`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#0F766E]"
                            >
                              <Trash2 size={14} strokeWidth={2.4} aria-hidden="true" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 font-body text-[15px] font-bold text-[#0F766E]">{readingClubCopy.circleEmptyLabel}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#E8DDCF] bg-[#FFFCF7] px-4 py-4" data-testid="reading-member-lounge">
                  <div className="flex items-start gap-3">
                    <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[18px] bg-[#7C2D12] text-white">
                      <MessageCircle size={23} strokeWidth={2.4} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-[28px] leading-[1.08] text-[#45325B]">{readingClubCopy.memberLoungeTitle}</p>
                      <p className="mt-1 font-body text-[16px] leading-[1.32] text-[#6E627D]">{readingClubCopy.memberLoungeBody}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {roomMembers.slice(0, 4).map((member, index) => (
                      <div key={member.id} className="rounded-[20px] border border-[#E8DDCF] bg-white px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 gap-3">
                            <div
                              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full text-[17px] font-bold text-white"
                              style={{ background: getParticipantColour(index) }}
                            >
                              {member.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-body text-[19px] font-bold leading-[1.12] text-[#45325B]">{member.name}</p>
                                <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 font-body text-[13px] font-bold text-[#0F766E]">
                                  {member.statusLabel ?? readingClubCopy.memberLoungeDefaultStatus}
                                </span>
                              </div>
                              <p className="mt-2 font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]">
                                {readingClubCopy.memberLoungeSharedLabel}
                              </p>
                              <p className="mt-1 font-body text-[16px] leading-[1.3] text-[#6E627D]">{getInterestLine(language, member)}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => prepareReadingLoungeLetter(member)}
                              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#BDE8D7] bg-[#F7FFFB] px-3 font-body text-[14px] font-bold text-[#0F766E]"
                              data-testid={`button-reading-lounge-letter-${member.id}`}
                            >
                              <PenLine size={16} strokeWidth={2.4} aria-hidden="true" />
                              {readingClubCopy.memberLoungeLetterLabel}
                            </button>
                            <button
                              type="button"
                              onClick={() => prepareReadingLoungeTable(member)}
                              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#E8DDCF] bg-[#FBF7F0] px-3 font-body text-[14px] font-bold text-[#7C2D12]"
                              data-testid={`button-reading-lounge-table-${member.id}`}
                            >
                              <CalendarPlus size={16} strokeWidth={2.4} aria-hidden="true" />
                              {readingClubCopy.memberLoungeTableLabel}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Users size={22} strokeWidth={2.4} className="text-[#0F766E]" aria-hidden="true" />
                    <p className="font-display text-[28px] leading-[1.08] text-[#45325B]">{readingClub.spotlightsTitle}</p>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {readingClub.memberSpotlights.map((spotlight, index) => {
                      const member = roomMembers.find((item) => item.id === spotlight.memberId);
                      return (
                        <button
                          key={spotlight.memberId}
                          type="button"
                          onClick={() => {
                            selectReadingMode("one-to-one");
                            setSelectedMember(member ?? {
                              id: spotlight.memberId,
                              name: spotlight.name,
                              sharedTopic: spotlight.body,
                              statusLabel: spotlight.roleLine,
                            });
                          }}
                          className="flex w-full gap-3 rounded-[24px] border border-[#E8DDCF] bg-[#FFFCF7] px-4 py-4 text-left transition-transform active:scale-[0.99]"
                        >
                          <div
                            className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full text-[18px] font-bold text-white"
                            style={{ background: getParticipantColour(index) }}
                          >
                            {spotlight.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="font-body text-[20px] font-bold text-[#45325B]">{spotlight.name}</p>
                              <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 font-body text-[13px] font-bold text-[#0F766E]">{spotlight.roleLine}</span>
                            </div>
                            <p className="mt-2 font-body text-[16px] leading-[1.32] text-[#6E627D]">{spotlight.body}</p>
                            <p className="mt-2 font-body text-[15px] font-semibold text-[#7C2D12]">{spotlight.starter}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-[24px] border border-[#D9C7F8] bg-[#FCF9FF] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-[27px] leading-[1.06] text-[#45325B]">{readingClub.passportTitle}</p>
                      <p className="mt-1 font-body text-[16px] leading-[1.32] text-[#6E627D]">{readingClub.passportBody}</p>
                    </div>
                    <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[20px] bg-[#6B3CC7] font-display text-[25px] text-white">
                      {readingPassportDoneCount}/{readingClub.passportItems.length}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {readingClub.passportItems.map((item) => {
                      const completed = Boolean(readingPassportCompletions[item.id]);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleReadingPassportItem(item.id)}
                          aria-pressed={completed}
                          className={`flex min-h-[70px] items-center gap-3 rounded-[20px] border px-3 py-3 text-left ${
                            completed ? "border-[#0F766E] bg-[#ECFDF5]" : "border-[#E8DDCF] bg-white"
                          }`}
                        >
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${completed ? "bg-[#0F766E] text-white" : "bg-[#FBF7F0] text-[#7C2D12]"}`}>
                            {completed ? <Check size={20} strokeWidth={2.6} aria-hidden="true" /> : <BookmarkCheck size={20} strokeWidth={2.4} aria-hidden="true" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-body text-[17px] font-bold text-[#45325B]">{item.label}</p>
                            <p className="mt-1 font-body text-[14px] leading-[1.28] text-[#6E627D]">{completed ? getReadingPassportDoneLabel(language) : item.body}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#D7F2E8] bg-[#F7FFFB] px-4 py-4" data-testid="reading-club-milestones">
                  <div className="flex items-center gap-2">
                    <Star size={21} strokeWidth={2.4} className="text-[#0F766E]" aria-hidden="true" />
                    <p className="font-display text-[26px] leading-[1.08] text-[#244D47]">{readingClubCopy.milestonesTitle}</p>
                  </div>
                  <p className="mt-2 font-body text-[16px] leading-[1.32] text-[#41655F]">{readingClubCopy.milestonesBody}</p>

                  <div className="mt-3 rounded-[20px] border border-[#BDE8D7] bg-white px-3 py-3">
                    <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.nextStepTitle}</p>
                    <p className="mt-1 font-body text-[18px] font-bold leading-[1.18] text-[#244D47]">{readingClubNextStep.label}</p>
                    <p className="mt-1 font-body text-[15px] leading-[1.32] text-[#41655F]">{readingClubNextStep.body}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-[18px] bg-white px-3 py-3">
                      <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.statsLabels.reflectionsShared}</p>
                      <p className="mt-1 font-display text-[27px] leading-none text-[#244D47]">{readingClubDesk.reflectionsShared}</p>
                    </div>
                    <div className="rounded-[18px] bg-white px-3 py-3">
                      <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]">{readingClubCopy.statsLabels.greetingsSent}</p>
                      <p className="mt-1 font-display text-[27px] leading-none text-[#3F2447]">{readingClubDesk.greetingsSent}</p>
                    </div>
                    <div className="rounded-[18px] bg-white px-3 py-3">
                      <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#6B3CC7]">{readingClubCopy.statsLabels.tablesJoined}</p>
                      <p className="mt-1 font-display text-[27px] leading-none text-[#45325B]">{readingClubDesk.tablesJoined}</p>
                    </div>
                    <div className="rounded-[18px] bg-white px-3 py-3">
                      <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.statsLabels.shelfVotes}</p>
                      <p className="mt-1 font-display text-[27px] leading-none text-[#244D47]">{readingClubDesk.shelfVotes}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {readingClubMilestones.map((milestone) => {
                      const milestoneCopy = readingClubCopy.milestones.find((item) => item.id === milestone.id);
                      if (!milestoneCopy) return null;
                      const progressPercent = Math.round((milestone.progress / milestone.target) * 100);
                      return (
                        <div key={milestone.id} className="rounded-[18px] border border-[#D7F2E8] bg-white px-3 py-3">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${milestone.completed ? "bg-[#0F766E] text-white" : "bg-[#ECFDF5] text-[#0F766E]"}`}>
                              {milestone.completed ? <Check size={19} strokeWidth={2.6} aria-hidden="true" /> : <Star size={18} strokeWidth={2.4} aria-hidden="true" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-body text-[16px] font-bold leading-[1.18] text-[#244D47]">{milestoneCopy.label}</p>
                                <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 font-body text-[13px] font-bold text-[#0F766E]">
                                  {milestone.completed ? readingClubCopy.milestonesCompleteLabel : `${milestone.progress}/${milestone.target}`}
                                </span>
                              </div>
                              <p className="mt-1 font-body text-[14px] leading-[1.28] text-[#41655F]">{milestoneCopy.body}</p>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#D7F2E8]">
                                <div className="h-full rounded-full bg-[#0F766E]" style={{ width: `${progressPercent}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#F0E4D4] px-5 py-5">
              <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[24px] border border-[#E8DDCF] bg-[#FFFCF7] px-4 py-4" data-testid="reading-companion-card">
                  <div className="flex items-center gap-2">
                    <Search size={22} strokeWidth={2.4} className="text-[#7C2D12]" aria-hidden="true" />
                    <p className="font-display text-[27px] leading-[1.06] text-[#45325B]">{readingClub.companionTitle}</p>
                  </div>
                  <p className="mt-2 font-body text-[17px] leading-[1.34] text-[#6E627D]">{readingClub.companionBody}</p>

                  <div className="mt-4 rounded-[22px] border border-[#E8DDCF] bg-white px-4 py-4" data-testid="reading-reader-profile">
                    <p className="font-body text-[18px] font-bold text-[#45325B]">{readingClubCopy.profileTitle}</p>
                    <p className="mt-1 font-body text-[15px] leading-[1.32] text-[#6E627D]">{readingClubCopy.profileBody}</p>

                    <div className="mt-4">
                      <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.shelfTitle}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {readingClubCopy.shelfOptions.map((shelf) => {
                          const active = shelf.id === readingClubDesk.favoriteShelfId;
                          return (
                            <button
                              key={shelf.id}
                              type="button"
                              onClick={() => selectReadingShelf(shelf.id)}
                              aria-pressed={active}
                              className={`min-h-[82px] rounded-[18px] border px-3 py-3 text-left ${
                                active ? "border-[#0F766E] bg-[#F0FDF8]" : "border-[#E8DDCF] bg-[#FFFDFC]"
                              }`}
                            >
                              <span className="block font-body text-[16px] font-bold leading-[1.2] text-[#244D47]">{shelf.label}</span>
                              <span className="sr-only">{shelf.body}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]">{readingClubCopy.paceTitle}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {readingClubCopy.paceOptions.map((pace) => {
                          const active = pace.id === readingClubDesk.preferredPaceId;
                          return (
                            <button
                              key={pace.id}
                              type="button"
                              onClick={() => selectReadingPace(pace.id)}
                              aria-pressed={active}
                              className={`min-h-[78px] rounded-[18px] border px-3 py-3 text-left ${
                                active ? "border-[#7C2D12] bg-[#FFF7ED]" : "border-[#E8DDCF] bg-[#FFFDFC]"
                              }`}
                            >
                              <span className="block font-body text-[16px] font-bold leading-[1.2] text-[#3F2447]">{pace.label}</span>
                              <span className="sr-only">{pace.body}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {readingClub.companionModes.map((mode) => {
                      const active = mode.id === selectedReadingMode?.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => selectReadingMode(mode.id)}
                          aria-pressed={active}
                          className={`rounded-[20px] border px-4 py-3 text-left ${
                            active ? "border-[#7C2D12] bg-[#FBF7F0]" : "border-[#E8DDCF] bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-body text-[18px] font-bold text-[#45325B]">{mode.title}</p>
                            {active && <Star size={18} fill="#7C2D12" strokeWidth={2.2} className="text-[#7C2D12]" aria-hidden="true" />}
                          </div>
                          <p className="mt-1 font-body text-[15px] leading-[1.3] text-[#6E627D]">{mode.body}</p>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => void findReadingCompanion()}
                    disabled={isReadingMatching}
                    className="mt-4 inline-flex min-h-[58px] w-full items-center justify-center gap-3 rounded-[20px] bg-[#7C2D12] px-5 font-body text-[20px] font-semibold text-white shadow-[0_14px_28px_rgba(124,45,18,0.16)] disabled:opacity-60"
                    data-testid="button-reading-find-companion"
                  >
                    <Search size={22} strokeWidth={2.4} aria-hidden="true" />
                    {isReadingMatching ? readingClubCopy.findingLabel : selectedReadingMode?.ctaLabel ?? readingClubCopy.findLabel}
                  </button>

                  {readingMatchResponse && (
                    <div className="mt-4 rounded-[22px] border border-[#E8DDCF] bg-white px-4 py-4" data-testid="reading-match-result">
                      {!readingMatchResponse.noMatch && readingMatchResponse.matchedUser && (
                        <p className="font-body text-[18px] font-bold text-[#45325B]">
                          {readingClubCopy.resultLabel}: {readingMatchResponse.matchedUser.name}
                        </p>
                      )}
                      <p className="mt-2 font-body text-[18px] leading-[1.35] text-[#5B4A68]">{readingMatchResponse.agentMessage}</p>
                      {!readingMatchResponse.noMatch && readingMatchResponse.matchedUser && (
                        <>
                          {readingMatchResponse.sharedTopics && readingMatchResponse.sharedTopics.length > 0 && (
                            <div className="mt-3">
                              <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.matchedTopicsLabel}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {readingMatchResponse.sharedTopics.slice(0, 5).map((topic) => (
                                  <span key={topic} className="rounded-full bg-[#F0FDF8] px-3 py-1.5 font-body text-[14px] font-bold text-[#0F766E]">
                                    {getReadingTopicLabel(topic, language)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="mt-3 rounded-[18px] bg-[#FFFCF7] px-3 py-3">
                            <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#7C2D12]">{readingClubCopy.protectedGreetingLabel}</p>
                            <p className="mt-1 font-body text-[15px] leading-[1.32] text-[#5B4A68]">
                              {readingClubCopy.greetingPreviewLabel}: {readingBridgePrompt}
                            </p>
                            <p className="mt-2 font-body text-[15px] font-semibold text-[#7C2D12]">{readingClubCopy.safeLine}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void sendMatchedReadingGreeting()}
                            disabled={isReadingGreetingSending || Boolean(pendingConnections[readingMatchResponse.matchedUser.userId])}
                            className="mt-3 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#0F766E] px-4 font-body text-[17px] font-bold text-white disabled:opacity-60"
                            data-testid="button-reading-send-greeting"
                          >
                            <ShieldCheck size={19} strokeWidth={2.4} aria-hidden="true" />
                            {isReadingGreetingSending
                              ? readingClubCopy.greetingSendingLabel
                              : pendingConnections[readingMatchResponse.matchedUser.userId]
                                ? readingClubCopy.greetingSentLabel
                                : readingClubCopy.greetingCta}
                          </button>
                          {readingGreetingStatus && (
                            <p className="mt-3 rounded-[16px] bg-[#ECFDF5] px-3 py-2 font-body text-[15px] font-bold leading-[1.28] text-[#0F766E]" role="status">
                              {readingGreetingStatus}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <div className="mt-4 rounded-[22px] border border-[#D7F2E8] bg-[#F7FFFB] px-4 py-4" data-testid="reading-club-letterbox">
                    <div className="flex items-start gap-2">
                      <PenLine size={22} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-body text-[19px] font-bold leading-[1.18] text-[#244D47]">{readingClubCopy.letterboxTitle}</p>
                        <p className="mt-1 font-body text-[15px] leading-[1.32] text-[#41655F]">{readingClubCopy.letterboxBody}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
                        {readingClubCopy.letterPromptLabel}
                      </p>
                      <div className="mt-2 grid gap-2">
                        {readingClubCopy.letterPrompts.map((prompt) => (
                          <button
                            key={prompt.id}
                            type="button"
                            onClick={() => applyReadingLetterPrompt(prompt)}
                            className="min-h-[62px] rounded-[18px] border border-[#BDE8D7] bg-white px-3 py-3 text-left"
                            data-testid={`button-reading-letter-prompt-${prompt.id}`}
                          >
                            <span className="block font-body text-[16px] font-bold leading-[1.18] text-[#244D47]">{prompt.title}</span>
                            <span className="mt-1 inline-flex items-center gap-1.5 font-body text-[14px] font-bold text-[#0F766E]">
                              <PenLine size={15} strokeWidth={2.4} aria-hidden="true" />
                              {readingClubCopy.letterUsePromptLabel}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <label className="block">
                        <span className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.letterRecipientLabel}</span>
                        <input
                          value={readingLetterRecipientDraft}
                          onChange={(event) => setReadingLetterRecipientDraft(event.target.value)}
                          placeholder={readingClubCopy.letterRecipientPlaceholder}
                          className="mt-1 min-h-[46px] w-full rounded-[16px] border border-[#BDE8D7] bg-white px-3 font-body text-[16px] font-semibold text-[#244D47] outline-none placeholder:text-[#7A9B96] focus:border-[#0F766E]"
                          data-testid="input-reading-letter-recipient"
                        />
                      </label>
                      <label className="block">
                        <span className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.letterSubjectLabel}</span>
                        <input
                          value={readingLetterSubjectDraft}
                          onChange={(event) => setReadingLetterSubjectDraft(event.target.value)}
                          placeholder={readingClubCopy.letterSubjectPlaceholder}
                          className="mt-1 min-h-[46px] w-full rounded-[16px] border border-[#BDE8D7] bg-white px-3 font-body text-[16px] font-semibold text-[#244D47] outline-none placeholder:text-[#7A9B96] focus:border-[#0F766E]"
                          data-testid="input-reading-letter-subject"
                        />
                      </label>
                      <label className="block">
                        <span className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{readingClubCopy.letterBodyLabel}</span>
                        <textarea
                          value={readingLetterBodyDraft}
                          onChange={(event) => setReadingLetterBodyDraft(event.target.value)}
                          placeholder={readingClubCopy.letterBodyPlaceholder}
                          rows={4}
                          className="mt-1 min-h-[112px] w-full resize-none rounded-[16px] border border-[#BDE8D7] bg-white px-3 py-3 font-body text-[16px] leading-[1.34] text-[#244D47] outline-none placeholder:text-[#7A9B96] focus:border-[#0F766E]"
                          data-testid="textarea-reading-letter-body"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={saveReadingLetterDraft}
                        disabled={!canSaveReadingLetter}
                        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#0F766E] px-4 font-body text-[17px] font-bold text-white disabled:opacity-50"
                        data-testid="button-reading-save-letter"
                      >
                        <BookMarked size={18} strokeWidth={2.4} aria-hidden="true" />
                        {readingClubCopy.letterSaveLabel}
                      </button>
                    </div>

                    {latestReadingLetters.length > 0 ? (
                      <div className="mt-4 grid gap-2">
                        {latestReadingLetters.map((letter) => (
                          <div key={letter.id} className="rounded-[18px] border border-[#BDE8D7] bg-white px-3 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[13px] font-bold text-[#0F766E]">
                                    {letter.status === "sent" ? readingClubCopy.letterSentLabel : readingClubCopy.letterDraftLabel}
                                  </span>
                                  <span className="rounded-full bg-[#FCF9FF] px-3 py-1 font-body text-[13px] font-bold text-[#6B3CC7]">
                                    {formatReadingLetterDate(letter.createdAt, language)}
                                  </span>
                                </div>
                                <p className="mt-2 font-body text-[17px] font-bold leading-[1.18] text-[#244D47]">{letter.subject}</p>
                                <p className="mt-1 font-body text-[14px] font-bold leading-[1.2] text-[#0F766E]">
                                  {readingClubCopy.letterRecipientLabel}: {letter.recipientName || readingClubCopy.letterDefaultRecipient}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeReadingLetterDraft(letter.id)}
                                aria-label={readingClubCopy.letterRemoveLabel}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#BDE8D7] bg-[#F7FFFB] text-[#0F766E]"
                                data-testid="button-reading-remove-letter"
                              >
                                <Trash2 size={16} strokeWidth={2.4} aria-hidden="true" />
                              </button>
                            </div>
                            <p className="mt-2 font-body text-[15px] leading-[1.32] text-[#41655F]">{letter.body}</p>
                            {letter.status !== "sent" && (
                              <button
                                type="button"
                                onClick={() => markReadingLetterSent(letter.id)}
                                className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#BDE8D7] bg-[#F7FFFB] px-3 font-body text-[14px] font-bold text-[#0F766E]"
                                data-testid="button-reading-send-letter"
                              >
                                <ShieldCheck size={16} strokeWidth={2.4} aria-hidden="true" />
                                {readingClubCopy.letterSendLabel}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 rounded-[18px] border border-dashed border-[#BDE8D7] bg-white px-3 py-3 font-body text-[15px] font-bold leading-[1.28] text-[#0F766E]">
                        {readingClubCopy.letterEmptyLabel}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#E8DDCF] bg-[#FFFDFC] px-4 py-4" data-testid="reading-reflection-card">
                  <div className="flex items-center gap-2">
                    <PenLine size={22} strokeWidth={2.4} className="text-[#6B3CC7]" aria-hidden="true" />
                    <p className="font-display text-[27px] leading-[1.06] text-[#45325B]">{readingClub.reflectionTitle}</p>
                  </div>
                  {readingClubStatus && (
                    <p
                      className="mt-3 rounded-full bg-[#ECFDF5] px-3 py-1.5 font-body text-[14px] font-bold text-[#0F766E]"
                      data-testid="reading-club-status"
                      role="status"
                    >
                      {readingClubStatus}
                    </p>
                  )}
                  <div className="mt-4 border-y border-[#E5D9F0] py-4" data-testid="reading-conversation-kit">
                    <div className="flex items-center gap-2">
                      <MessageCircle size={21} strokeWidth={2.4} className="text-[#6B3CC7]" aria-hidden="true" />
                      <p className="font-body text-[18px] font-bold text-[#45325B]">{readingClubCopy.conversationKitTitle}</p>
                    </div>
                    <p className="mt-1 font-body text-[15px] leading-[1.32] text-[#6E627D]">{readingClubCopy.conversationKitBody}</p>
                    <div className="mt-3 grid gap-3">
                      {readingClubCopy.conversationCards.map((card) => {
                        const used = readingClubDesk.usedConversationCardIds.includes(card.id);
                        return (
                          <div key={card.id} className="rounded-[20px] border border-[#E5D9F0] bg-[#FCF9FF] px-3 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="rounded-full bg-white px-3 py-1 font-body text-[13px] font-bold text-[#6B3CC7]">{card.badge}</span>
                                <p className="mt-2 font-body text-[18px] font-bold leading-[1.18] text-[#45325B]">{card.title}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => markReadingConversationCardUsed(card)}
                                aria-pressed={used}
                                className={`inline-flex min-h-[40px] items-center gap-2 rounded-full px-3 font-body text-[14px] font-bold ${
                                  used ? "bg-[#6B3CC7] text-white" : "border border-[#D9C7F8] bg-white text-[#6B3CC7]"
                                }`}
                              >
                                {used ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : <PenLine size={16} strokeWidth={2.4} aria-hidden="true" />}
                                {used ? readingClubCopy.conversationUsedLabel : readingClubCopy.conversationUseLabel}
                              </button>
                            </div>
                            <p className="mt-2 font-body text-[15px] leading-[1.3] text-[#6E627D]">{card.body}</p>
                            <p className="mt-2 rounded-[16px] bg-white px-3 py-2 font-body text-[15px] font-semibold leading-[1.28] text-[#5B4A68]">{card.prompt}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {readingClub.reflectionPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setReadingReflectionDraft(prompt)}
                        className="min-h-[38px] rounded-full border border-[#D9C7F8] bg-[#FCF9FF] px-3 font-body text-[14px] font-bold text-[#6B3CC7]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <form
                    className="mt-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitReadingReflection();
                    }}
                  >
                    <textarea
                      value={readingReflectionDraft}
                      onChange={(event) => setReadingReflectionDraft(event.target.value)}
                      placeholder={readingClub.reflectionPlaceholder}
                      aria-label={readingClub.reflectionPlaceholder}
                      rows={5}
                      className="min-h-[138px] w-full resize-none rounded-[22px] border border-[#E5D9F0] bg-[#FFFCF7] px-4 py-3 font-body text-[19px] leading-[1.35] text-[#5B4A68] outline-none placeholder:text-[#9A8EA8] focus:border-[#D8C8FB]"
                    />
                    <button
                      type="submit"
                      disabled={isChatSending || !readingReflectionDraft.trim()}
                      className="mt-3 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#6B3CC7] px-5 font-body text-[19px] font-semibold text-white disabled:opacity-50"
                    >
                      <PenLine size={21} strokeWidth={2.4} aria-hidden="true" />
                      {readingClub.reflectionSubmitLabel}
                    </button>
                  </form>

                  <div
                    className="mt-4 rounded-[22px] border border-[#D7F2E8] bg-[#F7FFFB] px-4 py-4"
                    data-testid="reading-club-journal"
                  >
                    <div className="flex items-start gap-2">
                      <BookMarked size={22} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-body text-[19px] font-bold leading-[1.18] text-[#244D47]">{readingClubCopy.journalTitle}</p>
                        <p className="mt-1 font-body text-[15px] leading-[1.32] text-[#41655F]">{readingClubCopy.journalBody}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
                        {readingClubCopy.journalPromptLabel}
                      </p>
                      <div className="mt-2 grid gap-2">
                        {readingClubCopy.journalPrompts.map((prompt) => (
                          <div key={prompt.id} className="rounded-[18px] border border-[#BDE8D7] bg-white px-3 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-body text-[16px] font-bold leading-[1.18] text-[#244D47]">{prompt.title}</p>
                                <p className="mt-1 font-body text-[14px] leading-[1.28] text-[#41655F]">{prompt.body}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => applyReadingJournalPrompt(prompt)}
                                className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[#BDE8D7] bg-[#F7FFFB] px-3 font-body text-[14px] font-bold text-[#0F766E]"
                                data-testid={`button-reading-journal-prompt-${prompt.id}`}
                              >
                                <PenLine size={15} strokeWidth={2.4} aria-hidden="true" />
                                {readingClubCopy.journalUsePromptLabel}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={saveReadingJournalPage}
                      disabled={!canSaveReadingJournalPage}
                      className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#0F766E] px-4 font-body text-[17px] font-bold text-white disabled:opacity-50"
                      data-testid="button-reading-save-journal"
                    >
                      <BookMarked size={18} strokeWidth={2.4} aria-hidden="true" />
                      {readingClubCopy.journalSaveLabel}
                    </button>

                    {latestReadingJournalEntries.length > 0 ? (
                      <div className="mt-4 grid gap-2">
                        {latestReadingJournalEntries.map((entry) => {
                          const circle = entry.circleId
                            ? readingClubCopy.readerCircles.find((item) => item.id === entry.circleId)
                            : null;
                          return (
                            <div key={entry.id} className="rounded-[18px] border border-[#BDE8D7] bg-white px-3 py-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[13px] font-bold text-[#0F766E]">
                                      {formatReadingJournalDay(entry.dayKey, language)}
                                    </span>
                                    {circle && (
                                      <span className="rounded-full bg-[#FCF9FF] px-3 py-1 font-body text-[13px] font-bold text-[#6B3CC7]">
                                        {readingClubCopy.journalCircleLabel}: {circle.title}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 font-body text-[17px] font-bold leading-[1.18] text-[#244D47]">{entry.title}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeReadingJournalPage(entry.id)}
                                  aria-label={readingClubCopy.journalRemoveLabel}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#BDE8D7] bg-[#F7FFFB] text-[#0F766E]"
                                  data-testid="button-reading-remove-journal-entry"
                                >
                                  <Trash2 size={16} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                              </div>
                              <p className="mt-2 font-body text-[15px] leading-[1.32] text-[#41655F]">{entry.body}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-4 rounded-[18px] border border-dashed border-[#BDE8D7] bg-white px-3 py-3 font-body text-[15px] font-bold leading-[1.28] text-[#0F766E]">
                        {readingClubCopy.journalEmptyLabel}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
              </>
            )}
          </section>
        )}

        {roomMode === "welcome" && !movementRoomActive ? (
            <section className="rounded-[34px] border border-[#E8DDCF] bg-[#FFFDFC] p-5 shadow-[0_16px_34px_rgba(91,33,182,0.05)]">
              <div className="rounded-[28px] bg-[#F8F3FF] px-5 py-5">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[18px] text-white shadow-[0_10px_22px_rgba(91,33,182,0.12)]"
                    style={{ background: "#6B3CC7" }}
                    aria-hidden="true"
                  >
                    <MessageCircle size={25} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-body text-[18px] font-semibold text-[#6B3CC7]">
                      {agentPresence === "speaking"
                        ? getAgentSpeakingLabel(language, agentName)
                        : copy.welcomeLabel(agentName)}
                    </p>
                    <p className="mt-1 font-body text-[17px] leading-[1.35] text-[#7D66A0]">
                      {getTopicHint(canonicalRoomSlug, language, room.topic)}
                    </p>
                  </div>
                </div>

                <p className="mt-5 font-body text-[25px] leading-[1.3] text-[#45325B]">{welcomeText}</p>

                {agentPresence === "speaking" && (
                  <div className="mt-4 flex items-center gap-2 text-[#6B3CC7]">
                    <span className="social-mini-wave" aria-hidden="true">
                      <b></b>
                      <b></b>
                      <b></b>
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSwitchToChat}
                className="mt-5 inline-flex min-h-[68px] w-full items-center justify-center gap-3 rounded-[22px] bg-[#6B3CC7] px-5 font-body text-[22px] font-semibold text-white shadow-[0_14px_28px_rgba(91,33,182,0.18)]"
              >
                <MessageCircle size={24} />
                {copy.switchToChat}
              </button>
            </section>
          ) : (
            <section className="rounded-[34px] border border-[#E8DDCF] bg-[#FFFDFC] p-5 shadow-[0_16px_34px_rgba(91,33,182,0.05)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-display text-[31px] leading-[1.05] text-[#45325B]">{copy.roomChat}</p>
                  <p className="mt-2 font-body text-[18px] leading-[1.35] text-[#7D66A0]">{copy.sharedConversation}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {visibleRoomChat.length > 0 ? (
                  visibleRoomChat.map((item, index) => {
                    const memberIndex = roomMembers.findIndex((member) => member.id === item.authorId);
                    const member = memberIndex >= 0 ? roomMembers[memberIndex] : null;
                    const colourIndex = memberIndex >= 0 ? memberIndex : index;
                    const chatTime = formatChatTime(item.createdAt, language);
                    const isCurrentUser = item.authorId === "current-user";
                    const isAgentMessage = item.authorId === "agent";
                    const avatarColour = isCurrentUser
                      ? "#6B3CC7"
                      : isAgentMessage
                        ? room.agentColour
                        : getParticipantColour(colourIndex);

                    return (
                      <div
                        key={item.id}
                        className={`flex gap-3 rounded-[24px] px-4 py-4 ${
                          isCurrentUser ? "flex-row-reverse bg-[#F2EBFF] text-right" : "bg-[#FBF7F0]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => member && setSelectedMember(member)}
                          disabled={!member}
                          className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-full text-[18px] font-semibold text-white shadow-[0_6px_12px_rgba(91,33,182,0.08)] disabled:cursor-default"
                          style={{ background: avatarColour }}
                          aria-label={member ? copy.connectWith(member.name) : item.authorName}
                        >
                          {item.authorName.slice(0, 1).toUpperCase()}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="font-body text-[18px] font-semibold text-[#45325B]">{item.authorName}</p>
                            {chatTime && <p className="font-body text-[15px] text-[#9A8EA8]">{chatTime}</p>}
                          </div>
                          <p className="mt-2 font-body text-[20px] leading-[1.36] text-[#5B4A68]">{item.text}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-[24px] bg-[#FBF7F0] px-4 py-5 font-body text-[19px] leading-[1.35] text-[#7D66A0]">
                    {copy.emptyRoomChat}
                  </p>
                )}
              </div>

              <form
                className="mt-5 flex gap-3 rounded-[26px] border border-[#E5D9F0] bg-[#FFFCF7] p-3 shadow-[0_10px_22px_rgba(91,33,182,0.04)]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitChatMessage();
                }}
              >
                <input
                  ref={chatInputRef}
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  disabled={isChatSending}
                  placeholder={copy.writePlaceholder}
                  aria-label={copy.writePlaceholder}
                  className="h-[58px] min-w-0 flex-1 rounded-[18px] border border-transparent bg-white px-4 font-body text-[20px] text-[#5B4A68] outline-none placeholder:text-[#9A8EA8] focus:border-[#D8C8FB]"
                />
                <button
                  type="submit"
                  disabled={isChatSending || !chatDraft.trim()}
                  className="min-h-[58px] rounded-[18px] bg-[#6B3CC7] px-5 font-body text-[19px] font-semibold text-white disabled:opacity-50"
                >
                  {copy.send}
                </button>
              </form>
            </section>
          )}
      </main>

      {membersOpen && (
        <div className="fixed inset-0 z-[80] flex items-end bg-[rgba(43,27,65,0.26)] px-4 pb-[calc(136px+env(safe-area-inset-bottom))] pt-6 md:items-center md:justify-center md:p-6">
          <div className="max-h-[calc(100dvh-176px)] w-full overflow-y-auto overscroll-contain rounded-[30px] border border-[#E8DDCF] bg-[#FFFDFC] p-5 shadow-[0_20px_48px_rgba(91,33,182,0.12)] md:max-w-[520px]">
            <div className="flex items-center justify-between gap-4">
              <p className="font-display text-[30px] text-[#45325B]">{copy.viewMembers}</p>
              <button
                type="button"
                onClick={() => setMembersOpen(false)}
                className="min-h-[46px] rounded-full border border-[#E0D4F0] px-4 font-body text-[18px] font-semibold text-[#6B3CC7]"
              >
                {getCloseLabel(language)}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {roomMembers.map((member, index) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setSelectedMember(member);
                    setMembersOpen(false);
                  }}
                  className="flex w-full items-center gap-4 rounded-[22px] border border-[#EFE6DA] bg-[#FFFDFC] px-4 py-4 text-left"
                >
                  <div
                    className="flex h-[46px] w-[46px] items-center justify-center rounded-full text-[18px] font-semibold text-white"
                    style={{ background: getParticipantColour(index) }}
                  >
                    {member.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-body text-[20px] font-semibold text-[#45325B]">{member.name}</p>
                    <p className="mt-1 font-body text-[18px] text-[#6E627D]">{getInterestLine(language, member)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedMember && (
        <div className="fixed inset-0 z-[80] flex items-end bg-[rgba(43,27,65,0.32)] px-4 pb-[calc(136px+env(safe-area-inset-bottom))] pt-6 md:items-center md:justify-center md:p-6">
          <div className="max-h-[calc(100dvh-176px)] w-full overflow-y-auto overscroll-contain rounded-[30px] border border-[#E8DDCF] bg-[#FFFDFC] p-5 shadow-[0_20px_48px_rgba(91,33,182,0.12)] md:max-w-[520px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-[30px] text-[#45325B]">{selectedMember.name}</p>
                <p className="mt-2 font-body text-[20px] text-[#6E627D]">{getInterestLine(language, selectedMember)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="min-h-[46px] rounded-full border border-[#E0D4F0] px-4 font-body text-[18px] font-semibold text-[#6B3CC7]"
              >
                {getCloseLabel(language)}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {pendingConnections[selectedMember.id] ? (
                <div className="rounded-full border border-[#DECBEF] bg-[#F8F3FF] px-4 py-3 font-body text-[18px] font-semibold text-[#6B3CC7]">
                  {getSentRequestLabel(language)}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void sendConnectionRequest(selectedMember)}
                  className="min-h-[58px] rounded-full px-5 font-body text-[20px] font-semibold text-white"
                  style={{ background: room.agentColour }}
                >
                  {copy.connectWith(selectedMember.name)}
                </button>
              )}
            </div>

            <div className="mt-5 rounded-[22px] border border-[#E5D9F0] bg-[#FCF9FF] px-4 py-4">
              <p className="font-body text-[21px] font-semibold text-[#45325B]">
                {copy.connectPromptTitle(selectedMember.name)}
              </p>
              <p className="mt-2 font-body text-[19px] leading-[1.36] text-[#6E627D]">
                {copy.connectPromptBody(selectedMember.name, room.name)}
              </p>
              <p className="mt-2 font-body text-[17px] leading-[1.34] text-[#7D66A0]">{getMutualConsentNote(language)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomScreen;
