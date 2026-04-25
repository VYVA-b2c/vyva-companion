import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/queryClient";
import { useProfile } from "@/contexts/ProfileContext";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import SocialStyles from "./SocialStyles";
import { getSocialCopy, getSocialLanguage } from "./roomUtils";
import { getSocialAgentId, getSocialAgentPersona } from "./agentPersonas";
import type { SocialLanguage, SocialRoomMember, SocialRoomResponse } from "./types";

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
  const {
    startVoice,
    stopVoice,
    sendText: sendAgentText,
    sendContextUpdate,
    status: agentSessionStatus,
    isSpeaking: agentIsSpeaking,
    isConnecting: agentIsConnecting,
    transcript: agentTranscript,
  } = useVyvaVoice();

  const leaveVisitIdRef = useRef<string | null>(null);
  const thinkingTimerRef = useRef<number | null>(null);
  const speakingTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptCursorRef = useRef(0);
  const liveGreetingKeyRef = useRef<string | null>(null);
  const pendingQuestionRef = useRef<string | null>(null);
  const welcomeReplyPendingRef = useRef(false);
  const liveReplyTimeoutRef = useRef<number | null>(null);

  const { data, isLoading, isError } = useQuery<SocialRoomResponse>({
    queryKey: [`/api/social/rooms/${slug}?lang=${language}`],
    enabled: Boolean(slug),
    staleTime: 30 * 1000,
  });

  const room = data?.room;

  const roomMembers = useMemo(() => {
    if (!room) return [];
    return data?.members?.length ? data.members : buildFallbackMembers(room, language);
  }, [data?.members, language, room]);

  const agentName = useMemo(() => {
    if (!room) return "";
    return room.agentFullName.split(" ")[0] ?? room.agentFullName;
  }, [room]);

  const socialAgent = useMemo(() => {
    if (!room) return null;
    return getSocialAgentPersona(room.agentSlug);
  }, [room]);

  const roomAgentId = useMemo(() => {
    if (!room) return undefined;
    return getSocialAgentId(room.agentSlug);
  }, [room]);

  const liveAgentPrompt = useMemo(() => {
    if (!room || !socialAgent) return undefined;
    return buildAgentPrompt(language, room.name, room.topic, socialAgent.systemPrompt);
  }, [language, room, socialAgent]);

  const quickQuestions = useMemo(
    () => getQuickQuestions(slug, language, data?.promptChips ?? []),
    [data?.promptChips, language, slug],
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

  const submitFallbackQuestion = useCallback(
    async (trimmed: string) => {
      const response = await apiFetch(`/api/social/rooms/${slug}/message`, {
        method: "POST",
        body: JSON.stringify({ message: trimmed, lang: language, visitId: visitId ?? undefined }),
      });
      if (!response.ok) return;

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
    },
    [clearPresenceTimers, language, slug, visitId],
  );

  useEffect(() => {
    return () => {
      clearPresenceTimers();
      clearLiveReplyTimeout();
      stopVoice();
    };
  }, [clearLiveReplyTimeout, clearPresenceTimers, stopVoice]);

  useEffect(() => {
    if (!room?.slug || !roomAgentId || !liveAgentPrompt) return;

    liveGreetingKeyRef.current = null;
    transcriptCursorRef.current = 0;
    pendingQuestionRef.current = null;
    welcomeReplyPendingRef.current = false;
    setAgentPresence("thinking");
    void startVoice(undefined, liveAgentPrompt, {
      agentId: roomAgentId,
      skipMicrophone: true,
    });
  }, [liveAgentPrompt, room?.slug, roomAgentId, startVoice]);

  useEffect(() => {
    if (!room || !socialAgent || agentSessionStatus !== "connected") return;

    const userDisplayName = firstName || profile?.firstName;
    const greetingKey = `${room.slug}:${language}:${userDisplayName ?? ""}`;
    if (liveGreetingKeyRef.current === greetingKey) return;

    sendContextUpdate(buildAgentContext(language, room.name, room.topic, quickQuestions));
    setAgentPresence("thinking");
    welcomeReplyPendingRef.current = true;
    sendAgentText(buildWelcomeBootstrap(language, socialAgent.fullName, userDisplayName), {
      invisibleInTranscript: true,
    });
    liveGreetingKeyRef.current = greetingKey;
  }, [
    agentSessionStatus,
    firstName,
    language,
    profile?.firstName,
    quickQuestions,
    room,
    sendAgentText,
    sendContextUpdate,
    socialAgent,
  ]);

  useEffect(() => {
    if (agentSessionStatus === "connecting" || agentIsConnecting) {
      clearPresenceTimers();
      setAgentPresence("thinking");
    }
  }, [agentIsConnecting, agentSessionStatus, clearPresenceTimers]);

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

      if (welcomeReplyPendingRef.current && !pendingQuestionRef.current) {
        welcomeReplyPendingRef.current = false;
        return;
      }

      if (welcomeReplyPendingRef.current && pendingQuestionRef.current && looksLikeGreeting(entry.text)) {
        welcomeReplyPendingRef.current = false;
        return;
      }

      welcomeReplyPendingRef.current = false;

      if (pendingQuestionRef.current) {
        setLatestQuestion(pendingQuestionRef.current);
        setLatestAnswer(entry.text);
        pendingQuestionRef.current = null;
        setIsSending(false);
      }
    });
  }, [agentIsSpeaking, agentTranscript, clearPresenceTimers]);

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
      clearLiveReplyTimeout();
      liveReplyTimeoutRef.current = window.setTimeout(() => {
        if (pendingQuestionRef.current !== trimmed) return;
        pendingQuestionRef.current = null;
        welcomeReplyPendingRef.current = false;
        setIsSending(false);
        void submitFallbackQuestion(trimmed);
      }, 9000);
      return;
    }

    setIsSending(true);
    try {
      await submitFallbackQuestion(trimmed);
    } finally {
      setIsSending(false);
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

  if (isError || !room) {
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
