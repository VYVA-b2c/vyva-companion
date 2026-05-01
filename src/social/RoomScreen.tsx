import { ArrowLeft, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/queryClient";
import { useProfile } from "@/contexts/ProfileContext";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import SocialStyles from "./SocialStyles";
import { getSocialCopy, getSocialLanguage } from "./roomUtils";
import type { SocialLanguage, SocialRoom, SocialRoomMember, SocialRoomResponse } from "./types";

const FALLBACK_MEMBER_NAMES = ["Carmen", "Josefa", "Manuel", "Ana"];
const MEMBER_COLOURS = ["#F59E0B", "#0EA5A4", "#EC4899", "#3B82F6"];

type AgentPresence = "idle" | "thinking" | "speaking";

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
  if (language === "en") return "You can type, tap a suggestion, or press Speak now to talk with the room agent.";
  if (language === "de") return "Du kannst schreiben, eine Frage antippen oder Jetzt sprechen drücken.";
  return "Puedes escribir, tocar una sugerencia o pulsar Hablar ahora para responder por voz.";
}

function getRoomVoiceUnavailableLabel(language: SocialLanguage) {
  if (language === "en") return "Live voice is not available in this room right now. You can keep writing here.";
  if (language === "de") return "Die Live-Stimme ist in diesem Raum gerade nicht verfügbar. Du kannst hier weiter schreiben.";
  return "La voz en directo no está disponible ahora mismo. Puedes seguir escribiendo aquí.";
}

function getVoiceButtonLabel(language: SocialLanguage, isUserSpeaking: boolean, isConnecting: boolean) {
  if (isUserSpeaking) {
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

function buildFallbackMembers(room: SocialRoomResponse["room"], language: SocialLanguage) {
  const visibleCount = Math.min(Math.max(room.participantCount - 1, 2), 4);

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

function buildAgentContext(language: SocialLanguage, roomName: string, topic: string, quickQuestions: string[]) {
  const intro =
    language === "en"
      ? `Room: ${roomName}. Topic: ${topic}.`
      : language === "de"
        ? `Raum: ${roomName}. Thema: ${topic}.`
        : `Sala: ${roomName}. Tema: ${topic}.`;

  const chipHint =
    quickQuestions.length > 0
      ? language === "en"
        ? `Suggested questions: ${quickQuestions.join(" | ")}.`
        : language === "de"
          ? `Vorgeschlagene Fragen: ${quickQuestions.join(" | ")}.`
          : `Preguntas sugeridas: ${quickQuestions.join(" | ")}.`
      : "";

  return `${intro} ${chipHint}`.trim();
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
      ctaLabel: language === "en" ? "Listen with Clara" : language === "de" ? "Mit Clara hören" : "Escuchar con Clara",
      topicTags: ["music", "classical"],
      timeSlots: ["afternoon", "evening"],
      featured: true,
      participantCount: 5,
      sessionDate: today,
      topic:
        language === "en"
          ? "A classical piece with a story"
          : language === "de"
            ? "Ein klassisches Stück mit Geschichte"
            : "Una pieza clásica con historia",
      opener:
        language === "en"
          ? "Hello, I’m Clara. Shall we discover one beautiful piece and the story behind it?"
          : language === "de"
            ? "Hallo, ich bin Clara. Entdecken wir ein schönes Stück und seine Geschichte?"
            : "Hola, soy Clara. ¿Descubrimos una pieza bonita y la historia que guarda?",
      quote: "",
      activityType: "story",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "Music to listen to slowly"
          : language === "de"
            ? "Musik zum ruhigen Hören"
            : "Música para escuchar con calma",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "5 in the room" : language === "de" ? "5 im Raum" : "5 en la sala",
    },
    "book-club": {
      slug: "book-club",
      name: language === "en" ? "Book Club" : language === "de" ? "Der Buchclub" : "El Club del Libro",
      category: "activity",
      agentSlug: "isabel",
      agentFullName: "Isabel Ferrer",
      agentColour: "#7C2D12",
      agentCredential:
        language === "en"
          ? "Philologist · Spanish literature"
          : language === "de"
            ? "Philologin · Spanische Literatur"
            : "Filóloga · Literatura española",
      ctaLabel: language === "en" ? "Read with Isabel" : language === "de" ? "Mit Isabel lesen" : "Leer con Isabel",
      topicTags: ["books", "reading"],
      timeSlots: ["afternoon", "evening"],
      featured: false,
      participantCount: 4,
      sessionDate: today,
      topic:
        language === "en"
          ? "A page that stays with you"
          : language === "de"
            ? "Eine Seite, die bei dir bleibt"
            : "Una página que se queda contigo",
      opener:
        language === "en"
          ? "Hello, I’m Isabel. Which line from a book has stayed with you?"
          : language === "de"
            ? "Hallo, ich bin Isabel. Welche Zeile aus einem Buch ist dir geblieben?"
            : "Hola, soy Isabel. ¿Qué frase de un libro se te ha quedado dentro?",
      quote: "",
      activityType: "discussion",
      contentTag: "",
      contentTitle:
        language === "en"
          ? "A gentle literary question"
          : language === "de"
            ? "Eine sanfte literarische Frage"
            : "Una pregunta literaria suave",
      contentBody: "",
      options: [],
      liveBadge: language === "en" ? "4 in the room" : language === "de" ? "4 im Raum" : "4 en la sala",
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

  const room = roomMap[slug];
  if (!room) return null;

  return {
    room,
    transcript: [
      {
        id: `${slug}-fallback-welcome`,
        speaker: "agent",
        text: room.opener,
        createdAt: new Date().toISOString(),
      },
    ],
    promptChips: getQuickQuestions(slug, language, []),
    members: buildFallbackMembers(room, language),
    memberChat: [],
  };
}

const RoomScreen = () => {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const { profile, firstName } = useProfile();
  const language = getSocialLanguage(profile?.language);
  const copy = getSocialCopy(language);

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
  const liveReplyTimeoutRef = useRef<number | null>(null);
  const reconnectFallbackTimeoutRef = useRef<number | null>(null);

  const { data, isLoading, isError } = useQuery<SocialRoomResponse>({
    queryKey: [`/api/social/rooms/${slug}?lang=${language}`],
    enabled: Boolean(slug),
    staleTime: 30 * 1000,
  });

  const roomResponse = useMemo(() => data ?? buildFallbackRoomResponse(slug, language), [data, language, slug]);
  const room = roomResponse?.room;

  const roomMembers = useMemo(() => {
    if (!room) return [];
    return roomResponse?.members?.length ? roomResponse.members : buildFallbackMembers(room, language);
  }, [language, room, roomResponse]);

  const agentName = useMemo(() => {
    if (!room) return "";
    return room.agentFullName.split(" ")[0] ?? room.agentFullName;
  }, [room]);

  const quickQuestions = useMemo(
    () => getQuickQuestions(slug, language, roomResponse?.promptChips ?? []),
    [language, roomResponse?.promptChips, slug],
  );

  const baseKnowledgeFeed = useMemo(
    () => buildKnowledgeFeed(slug, language, roomMembers),
    [language, roomMembers, slug],
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
      if (!room?.slug || !room.agentSlug) return;
      void startVoice(undefined, undefined, {
        agentSlug: room.agentSlug,
        roomSlug: room.slug,
        skipMicrophone,
      });
    },
    [room?.agentSlug, room?.slug, startVoice],
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

  useEffect(() => {
    return () => {
      clearPresenceTimers();
      clearLiveReplyTimeout();
      clearReconnectFallbackTimeout();
      stopVoice();
    };
  }, [clearLiveReplyTimeout, clearPresenceTimers, clearReconnectFallbackTimeout, stopVoice]);

  useEffect(() => {
    if (!room?.slug || !room.agentSlug) return;

    liveGreetingKeyRef.current = null;
    transcriptCursorRef.current = 0;
    pendingQuestionRef.current = null;
    queuedQuestionRef.current = null;
    startListeningWhenReadyRef.current = false;
    setVoiceAttempted(false);
    setAgentPresence("idle");
  }, [room?.agentSlug, room?.slug]);

  useEffect(() => {
    if (!room || agentSessionStatus !== "connected") return;

    const userDisplayName = firstName || profile?.firstName;
    const contextKey = `${room.slug}:${language}:${userDisplayName ?? ""}`;
    if (liveGreetingKeyRef.current === contextKey) return;

    sendContextUpdate(buildAgentContext(language, room.name, room.topic, quickQuestions));
    liveGreetingKeyRef.current = contextKey;
  }, [
    agentSessionStatus,
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
  }, [agentIsSpeaking, agentTranscript, armLiveReplyTimeout, clearPresenceTimers]);

  useEffect(() => {
    let cancelled = false;

    async function enterRoom() {
      if (!room || visitId) return;

      const response = await apiFetch(`/api/social/rooms/${slug}/enter`, {
        method: "POST",
        body: JSON.stringify({ lang: language }),
      });
      if (!response.ok) return;

      const result = (await response.json()) as { visitId: string };
      if (!cancelled) {
        leaveVisitIdRef.current = result.visitId;
        setVisitId(result.visitId);
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

    if (isUserSpeaking) {
      endUserTurn();
      setAgentPresence("thinking");
      return;
    }

    if (agentSessionStatus === "connected" && hasMicrophone) {
      const started = await beginUserTurn();
      if (started) setAgentPresence("idle");
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
      body: JSON.stringify({ memberId: member.id, lang: language }),
    });
    if (!response.ok) return;

    setPendingConnections((current) => ({ ...current, [member.id]: true }));
  };

  if (isLoading) {
    return (
      <div className="px-6 py-8">
        <div className="rounded-[30px] bg-[#FFFDFC] p-6 font-body text-[22px] text-[#7C6D8D]">Cargando...</div>
      </div>
    );
  }

  if ((isError && !roomResponse) || !room) {
    return (
      <div className="px-6 py-8">
        <button
          type="button"
          onClick={() => navigate("/social-rooms")}
          className="min-h-[64px] rounded-full border border-[#E0D4F0] bg-[#FFFDFC] px-6 font-body text-[22px] font-semibold text-[#6B3CC7]"
        >
          {copy.back}
        </button>
      </div>
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
        onClick={() => navigate("/social-rooms")}
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
        <section className="rounded-[34px] border border-[#E8DDCF] bg-[#FFFDFC] p-6 shadow-[0_16px_34px_rgba(91,33,182,0.05)]">
          <p className="font-body text-[18px] font-medium text-[#8B7D9A]">{getTopicHint(slug, language, room.topic)}</p>
          <p className="mt-3 rounded-[20px] bg-[#F8F3FF] px-4 py-3 font-body text-[18px] leading-[1.35] text-[#6B5D78]">
            {getRoomInteractionHint(language)}
          </p>

          {voiceAttempted && agentVoiceError && agentSessionStatus === "idle" && (
            <p className="mt-3 rounded-[20px] border border-[#F4D6BF] bg-[#FFF7ED] px-4 py-3 font-body text-[18px] leading-[1.35] text-[#9A3412]">
              {getRoomVoiceUnavailableLabel(language)}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitQuestion(draft);
                  }
                }}
                disabled={isSending}
                placeholder={getAskPlaceholder(language)}
                className="h-[72px] flex-1 rounded-[22px] border border-[#E5D9F0] bg-[#FFFCF7] px-5 font-body text-[22px] text-[#5B4A68] outline-none placeholder:text-[#9A8EA8]"
              />
              <button
                type="button"
                onClick={() => void submitQuestion(draft)}
                disabled={isSending || !draft.trim()}
                className="min-h-[72px] rounded-[22px] px-6 font-body text-[22px] font-semibold text-white disabled:opacity-50"
                style={{ background: room.agentColour }}
              >
                {getAskButtonLabel(language)}
              </button>
            </div>

            {quickQuestions.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {quickQuestions.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => void submitQuestion(chip)}
                    disabled={isSending}
                    className="min-h-[56px] rounded-full border border-[#DECBEF] bg-[#F8F3FF] px-5 font-body text-[19px] font-semibold text-[#6B3CC7] disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleVoiceToggle()}
              disabled={agentIsConnecting && !isUserSpeaking}
              className="inline-flex min-h-[64px] items-center justify-center gap-3 rounded-[22px] px-5 font-body text-[21px] font-semibold text-white disabled:opacity-60"
              style={{
                background: isUserSpeaking ? "#C81E1E" : room.agentColour,
                boxShadow: "0 12px 24px rgba(91,33,182,0.12)",
              }}
            >
              {isUserSpeaking ? <Square size={21} /> : <Mic size={22} />}
              {getVoiceButtonLabel(language, isUserSpeaking, agentIsConnecting)}
            </button>
          </div>

          {latestQuestion && latestAnswer && (
            <div className="mt-6 rounded-[26px] border border-[#E5D9F0] bg-[#FCF9FF] px-5 py-5">
              <p className="font-body text-[18px] font-semibold text-[#6B3CC7]">{latestQuestion}</p>
              <div className="mt-4 rounded-[20px] bg-white px-4 py-4 shadow-[0_10px_20px_rgba(91,33,182,0.04)]">
                <p className="font-body text-[17px] font-semibold text-[#7D66A0]">{getAnswerLabel(language, agentName)}</p>
                <p className="mt-2 font-body text-[24px] leading-[1.38] text-[#5B4A68]">{latestAnswer}</p>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[30px] border border-[#E8DDCF] bg-[#FFFDFC] px-5 py-5 shadow-[0_12px_28px_rgba(91,33,182,0.04)]">
          <p className="font-body text-[18px] font-semibold text-[#8B7D9A]">{getRecentQuestionsLabel(language)}</p>

          <div className="mt-4 space-y-4">
            {knowledgeFeed.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-[#EFE6DA] bg-[#FFFDFC] px-4 py-4">
                <p className="font-body text-[18px] font-semibold text-[#6B3CC7]">{item.asker}</p>
                <p className="mt-2 font-body text-[22px] leading-[1.34] text-[#45325B]">{item.question}</p>

                <div className="mt-4 rounded-[18px] bg-[#FCF9FF] px-4 py-4">
                  <p className="font-body text-[16px] font-semibold text-[#7D66A0]">{getAnswerLabel(language, agentName)}</p>
                  <p className="mt-2 font-body text-[21px] leading-[1.38] text-[#5B4A68]">{item.answer}</p>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setCommentComposerFor((current) => (current === item.id ? null : item.id))}
                    className="min-h-[48px] rounded-full border border-[#DECBEF] bg-[#F8F3FF] px-4 font-body text-[18px] font-semibold text-[#6B3CC7]"
                  >
                    {getCommentLabel(language)}
                  </button>
                </div>

                {item.comments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {item.comments.slice(0, 2).map((comment) => (
                      <div key={comment.id} className="rounded-[16px] bg-[#FBF7F0] px-4 py-3">
                        <p className="font-body text-[16px] font-semibold text-[#7D66A0]">{comment.author}</p>
                        <p className="mt-1 font-body text-[18px] leading-[1.36] text-[#6E627D]">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {commentComposerFor === item.id && (
                  <div className="mt-4 flex gap-3">
                    <input
                      value={commentDrafts[item.id] ?? ""}
                      onChange={(event) =>
                        setCommentDrafts((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addComment(item.id);
                        }
                      }}
                      placeholder={getCommentPlaceholder(language)}
                      className="h-[60px] flex-1 rounded-[18px] border border-[#E5D9F0] bg-[#FFFCF7] px-4 font-body text-[20px] text-[#5B4A68] outline-none placeholder:text-[#9A8EA8]"
                    />
                    <button
                      type="button"
                      onClick={() => addComment(item.id)}
                      className="min-h-[60px] rounded-[18px] px-5 font-body text-[20px] font-semibold text-white"
                      style={{ background: room.agentColour }}
                    >
                      {copy.send}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {membersOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-[rgba(43,27,65,0.26)] p-4">
          <div className="w-full rounded-[30px] border border-[#E8DDCF] bg-[#FFFDFC] p-5 shadow-[0_20px_48px_rgba(91,33,182,0.12)]">
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
        <div className="fixed inset-0 z-50 flex items-end bg-[rgba(43,27,65,0.32)] p-4">
          <div className="w-full rounded-[30px] border border-[#E8DDCF] bg-[#FFFDFC] p-5 shadow-[0_20px_48px_rgba(91,33,182,0.12)]">
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
