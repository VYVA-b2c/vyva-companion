import type { SocialActivityType, SocialLanguage, SocialRoom, SocialRoomCategory } from "../../src/social/types";

type LocalizedText = Record<SocialLanguage, string>;

type DailyTopicSeed = {
  topic: LocalizedText;
  opener: LocalizedText;
  quote?: LocalizedText;
  contentTag?: LocalizedText;
  contentTitle?: LocalizedText;
  contentBody?: LocalizedText;
  options?: LocalizedText[];
  activityType?: SocialActivityType;
};

export type SocialRoomSeed = {
  slug: string;
  names: LocalizedText;
  category: SocialRoomCategory;
  agentSlug: string;
  agentFullName: string;
  agentColour: string;
  agentCredential: LocalizedText;
  ctaLabel: LocalizedText;
  topicTags: string[];
  timeSlots: string[];
  featured: boolean;
  memberCount: number;
  sortOrder: number;
  dailyTopics: DailyTopicSeed[];
};

const t = (es: string, en: string, de: string): LocalizedText => ({ es, en, de });

const blank = t("", "", "");

const room = (seed: SocialRoomSeed) => seed;

export const socialRoomSeeds: SocialRoomSeed[] = [
  room({
    slug: "garden-corner",
    names: t("Rincón del jardín", "Garden Corner", "Gartenecke"),
    category: "activity",
    agentSlug: "elena-ruiz",
    agentFullName: "Elena Ruiz",
    agentColour: "#16A34A",
    agentCredential: t("Jardinera urbana", "Urban gardener", "Stadtgärtnerin"),
    ctaLabel: t("Entrar", "Enter", "Eintreten"),
    topicTags: ["plants", "garden", "home", "nature"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    memberCount: 7,
    sortOrder: 10,
    dailyTopics: [
      {
        topic: t(
          "Plantas alegres para una ventana luminosa.",
          "Cheerful plants for a bright window.",
          "Freundliche Pflanzen für ein helles Fenster.",
        ),
        opener: t(
          "Hola, soy Elena. ¿Qué planta te acompaña en casa?",
          "Hello, I'm Elena. Which plant keeps you company at home?",
          "Hallo, ich bin Elena. Welche Pflanze begleitet dich zu Hause?",
        ),
        contentTitle: t("Una planta fácil", "One easy plant", "Eine einfache Pflanze"),
        contentBody: t(
          "Hablemos de plantas sencillas, riego y rincones con luz.",
          "Let's talk about simple plants, watering and bright corners.",
          "Sprechen wir über einfache Pflanzen, Gießen und helle Ecken.",
        ),
        options: [
          t("¿Qué planta me recomiendas?", "Which plant do you recommend?", "Welche Pflanze empfiehlst du?"),
          t("Tengo hojas amarillas", "My leaves are yellow", "Meine Blätter sind gelb"),
        ],
        activityType: "advice",
      },
    ],
  }),
  room({
    slug: "games-room",
    names: t("Sala de juegos", "Games Room", "Spielzimmer"),
    category: "activity",
    agentSlug: "viktor-sanz",
    agentFullName: "Viktor Sanz",
    agentColour: "#F59E0B",
    agentCredential: t("Compañero de juegos", "Games companion", "Spielbegleiter"),
    ctaLabel: t("Jugar", "Play", "Spielen"),
    topicTags: ["games", "chess", "scrabble", "puzzles", "memory"],
    timeSlots: ["afternoon", "evening"],
    featured: true,
    memberCount: 8,
    sortOrder: 20,
    dailyTopics: [
      {
        topic: t(
          "Ajedrez, palabras, memoria y pequeños retos.",
          "Chess, words, memory and small challenges.",
          "Schach, Wörter, Gedächtnis und kleine Aufgaben.",
        ),
        opener: t(
          "Hola, soy Viktor. Podemos jugar ajedrez, palabras o un reto corto.",
          "Hello, I'm Viktor. We can play chess, words or a short challenge.",
          "Hallo, ich bin Viktor. Wir können Schach, Wörter oder eine kurze Aufgabe spielen.",
        ),
        contentTitle: t("Un reto corto", "A short challenge", "Eine kurze Aufgabe"),
        contentBody: t(
          "Elige ajedrez, Scrabble, memoria o un juego de palabras.",
          "Choose chess, Scrabble, memory or a word game.",
          "Wähle Schach, Scrabble, Gedächtnis oder ein Wortspiel.",
        ),
        options: [
          t("Juguemos ajedrez", "Let's play chess", "Lass uns Schach spielen"),
          t("Quiero un juego de palabras", "I want a word game", "Ich möchte ein Wortspiel"),
        ],
        activityType: "game",
      },
    ],
  }),
  room({
    slug: "kitchen-table",
    names: t("Mesa de cocina", "Kitchen Table", "Küchentisch"),
    category: "useful",
    agentSlug: "lola-martinez",
    agentFullName: "Lola Martínez",
    agentColour: "#C2410C",
    agentCredential: t("Chef mediterránea", "Mediterranean chef", "Mediterrane Köchin"),
    ctaLabel: t("Cocinar", "Cook", "Kochen"),
    topicTags: ["food", "recipes", "mediterranean", "home"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    memberCount: 7,
    sortOrder: 30,
    dailyTopics: [
      {
        topic: t(
          "Una comida sencilla con sabores de siempre.",
          "A simple meal with familiar flavours.",
          "Ein einfaches Essen mit vertrauten Aromen.",
        ),
        opener: t(
          "Hola, soy Lola. ¿Qué plato te apetece preparar hoy?",
          "Hello, I'm Lola. What would you like to cook today?",
          "Hallo, ich bin Lola. Was möchtest du heute kochen?",
        ),
        contentTitle: t("Algo fácil hoy", "Something easy today", "Heute etwas Einfaches"),
        contentBody: t(
          "Podemos pensar en una receta corta, suave y apetecible.",
          "We can think of a short, gentle and tasty recipe.",
          "Wir finden ein kurzes, sanftes und leckeres Rezept.",
        ),
        options: [
          t("¿Qué puedo cocinar?", "What can I cook?", "Was kann ich kochen?"),
          t("Quiero algo ligero", "I want something light", "Ich möchte etwas Leichtes"),
        ],
        activityType: "recipe",
      },
    ],
  }),
  room({
    slug: "morning-movement",
    names: t("Movimiento suave", "Gentle Movement", "Sanfte Bewegung"),
    category: "activity",
    agentSlug: "amara-osei",
    agentFullName: "Amara Osei",
    agentColour: "#0284C7",
    agentCredential: t("Guía de movimiento", "Movement guide", "Bewegungsbegleiterin"),
    ctaLabel: t("Moverme", "Move", "Bewegen"),
    topicTags: ["movement", "stretching", "mobility", "safe"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    memberCount: 6,
    sortOrder: 40,
    dailyTopics: [
      {
        topic: t(
          "Movimientos seguros para empezar el día.",
          "Safe movements to start the day.",
          "Sichere Bewegungen für den Tagesbeginn.",
        ),
        opener: t(
          "Hola, soy Amara. Podemos movernos suavemente y sin prisa.",
          "Hello, I'm Amara. We can move gently and without hurry.",
          "Hallo, ich bin Amara. Wir können uns sanft und ohne Eile bewegen.",
        ),
        contentTitle: t("Despertar suave", "Gentle wake-up", "Sanft aufwachen"),
        contentBody: t(
          "Empezamos con un movimiento sentado y fácil.",
          "We start with an easy seated movement.",
          "Wir beginnen mit einer einfachen Bewegung im Sitzen.",
        ),
        options: [
          t("Quiero moverme sentado", "I want seated movement", "Ich möchte mich im Sitzen bewegen"),
          t("Algo para hombros", "Something for shoulders", "Etwas für die Schultern"),
        ],
        activityType: "challenge",
      },
    ],
  }),
  room({
    slug: "evening-wind-down",
    names: t("Calma nocturna", "Evening Calm", "Abendruhe"),
    category: "activity",
    agentSlug: "marco-reyes",
    agentFullName: "Marco Reyes",
    agentColour: "#4F46E5",
    agentCredential: t("Guía de calma", "Calm guide", "Ruhebegleiter"),
    ctaLabel: t("Relajarme", "Relax", "Entspannen"),
    topicTags: ["sleep", "calm", "breathing", "evening"],
    timeSlots: ["evening"],
    featured: true,
    memberCount: 6,
    sortOrder: 50,
    dailyTopics: [
      {
        topic: t(
          "Respirar, cerrar el día y descansar.",
          "Breathe, close the day and rest.",
          "Atmen, den Tag beenden und ruhen.",
        ),
        opener: t(
          "Hola, soy Marco. Bajamos el ritmo juntos antes de dormir.",
          "Hello, I'm Marco. We slow down together before sleep.",
          "Hallo, ich bin Marco. Wir werden vor dem Schlafen gemeinsam ruhiger.",
        ),
        contentTitle: t("Cerrar el día", "Close the day", "Den Tag beenden"),
        contentBody: t(
          "Podemos hacer una pausa corta de respiración y calma.",
          "We can take a short breathing and calm pause.",
          "Wir machen eine kurze Atempause mit Ruhe.",
        ),
        options: [
          t("Quiero relajarme", "I want to relax", "Ich möchte entspannen"),
          t("Ayúdame a dormir", "Help me sleep", "Hilf mir beim Schlafen"),
        ],
        activityType: "advice",
      },
    ],
  }),
  room({
    slug: "music-room",
    names: t("Sala de música", "Music Room", "Musikzimmer"),
    category: "activity",
    agentSlug: "diego-salinas",
    agentFullName: "Diego Salinas",
    agentColour: "#7E22CE",
    agentCredential: t("Musicólogo", "Musicologist", "Musikwissenschaftler"),
    ctaLabel: t("Escuchar", "Listen", "Hören"),
    topicTags: ["music", "classical", "history", "listening"],
    timeSlots: ["afternoon", "evening"],
    featured: true,
    memberCount: 7,
    sortOrder: 60,
    dailyTopics: [
      {
        topic: t(
          "Una pieza musical con historia.",
          "A musical piece with a story.",
          "Ein Musikstück mit Geschichte.",
        ),
        opener: t(
          "Hola, soy Diego. Podemos escuchar una pieza y descubrir su historia.",
          "Hello, I'm Diego. We can listen to a piece and discover its story.",
          "Hallo, ich bin Diego. Wir können ein Stück hören und seine Geschichte entdecken.",
        ),
        contentTitle: t("Música con calma", "Music calmly", "Musik in Ruhe"),
        contentBody: t(
          "Te propongo una pieza breve y te cuento algo interesante.",
          "I suggest one short piece and share something interesting.",
          "Ich schlage ein kurzes Stück vor und erzähle etwas Interessantes.",
        ),
        options: [
          t("Recomiéndame una pieza", "Recommend a piece", "Empfiehl mir ein Stück"),
          t("Cuéntame la historia", "Tell me the story", "Erzähl mir die Geschichte"),
        ],
        activityType: "story",
      },
    ],
  }),
  room({
    slug: "reading-room",
    names: t("Sala de lectura", "Reading Room", "Lesezimmer"),
    category: "activity",
    agentSlug: "isabel-fuentes",
    agentFullName: "Isabel Fuentes",
    agentColour: "#8B5CF6",
    agentCredential: t("Guía literaria", "Literary guide", "Literaturbegleiterin"),
    ctaLabel: t("Leer", "Read", "Lesen"),
    topicTags: ["books", "literature", "poetry", "reading"],
    timeSlots: ["morning", "afternoon", "evening"],
    featured: false,
    memberCount: 6,
    sortOrder: 70,
    dailyTopics: [
      {
        topic: t(
          "Una lectura breve para comentar.",
          "A short reading to discuss.",
          "Eine kurze Lektüre zum Besprechen.",
        ),
        opener: t(
          "Hola, soy Isabel. ¿Quieres una historia corta, un poema o una recomendación?",
          "Hello, I'm Isabel. Would you like a short story, a poem or a recommendation?",
          "Hallo, ich bin Isabel. Möchtest du eine kurze Geschichte, ein Gedicht oder eine Empfehlung?",
        ),
        contentTitle: t("Leer juntos", "Read together", "Gemeinsam lesen"),
        contentBody: t(
          "Elegimos algo breve y lo comentamos paso a paso.",
          "We choose something short and discuss it step by step.",
          "Wir wählen etwas Kurzes und besprechen es Schritt für Schritt.",
        ),
        options: [
          t("Recomiéndame un libro", "Recommend a book", "Empfiehl mir ein Buch"),
          t("Quiero un poema", "I want a poem", "Ich möchte ein Gedicht"),
        ],
        activityType: "story",
      },
    ],
  }),
  room({
    slug: "memory-lane",
    names: t("Recuerdos", "Memory Lane", "Erinnerungen"),
    category: "social",
    agentSlug: "sofia-montoya",
    agentFullName: "Sofía Montoya",
    agentColour: "#DB2777",
    agentCredential: t("Narradora de vida", "Life storyteller", "Lebensgeschichten-Begleiterin"),
    ctaLabel: t("Recordar", "Remember", "Erinnern"),
    topicTags: ["memories", "life", "family", "stories"],
    timeSlots: ["afternoon", "evening"],
    featured: false,
    memberCount: 6,
    sortOrder: 80,
    dailyTopics: [
      {
        topic: t(
          "Un recuerdo pequeño que merece volver.",
          "A small memory worth revisiting.",
          "Eine kleine Erinnerung, die zurückkommen darf.",
        ),
        opener: t(
          "Hola, soy Sofía. Podemos recordar con calma y sin prisa.",
          "Hello, I'm Sofía. We can remember calmly and without hurry.",
          "Hallo, ich bin Sofía. Wir können uns ruhig und ohne Eile erinnern.",
        ),
        contentTitle: t("Un buen recuerdo", "A good memory", "Eine schöne Erinnerung"),
        contentBody: t(
          "Puedes contarme una persona, un lugar o una canción.",
          "You can tell me about a person, a place or a song.",
          "Du kannst mir von einer Person, einem Ort oder einem Lied erzählen.",
        ),
        options: [
          t("Quiero recordar mi infancia", "I want to remember childhood", "Ich möchte mich an meine Kindheit erinnern"),
          t("Hablemos de mi familia", "Let's talk about my family", "Sprechen wir über meine Familie"),
        ],
        activityType: "story",
      },
    ],
  }),
  room({
    slug: "morning-circle",
    names: t("Círculo diario", "Daily Circle", "Täglicher Kreis"),
    category: "social",
    agentSlug: "vyva-morning",
    agentFullName: "VYVA",
    agentColour: "#F97316",
    agentCredential: t("Compañera diaria", "Daily companion", "Tägliche Begleiterin"),
    ctaLabel: t("Empezar", "Start", "Starten"),
    topicTags: ["morning", "routine", "mood", "planning"],
    timeSlots: ["morning"],
    featured: false,
    memberCount: 9,
    sortOrder: 90,
    dailyTopics: [
      {
        topic: t(
          "Saludo, ánimo y plan sencillo.",
          "Greeting, mood and simple plan.",
          "Begrüßung, Stimmung und einfacher Plan.",
        ),
        opener: t(
          "Buenos días. Estoy aquí para empezar el día contigo.",
          "Good morning. I'm here to start the day with you.",
          "Guten Morgen. Ich bin hier, um den Tag mit dir zu beginnen.",
        ),
        contentTitle: t("Hoy con calma", "Today calmly", "Heute ruhig"),
        contentBody: t(
          "Empezamos con una pregunta simple y un plan pequeño.",
          "We start with a simple question and a small plan.",
          "Wir beginnen mit einer einfachen Frage und einem kleinen Plan.",
        ),
        options: [
          t("¿Qué hago hoy?", "What should I do today?", "Was mache ich heute?"),
          t("Quiero organizar mi día", "I want to plan my day", "Ich möchte meinen Tag planen"),
        ],
        activityType: "discussion",
      },
    ],
  }),
  room({
    slug: "news-world-affairs",
    names: t("Noticias", "News", "Nachrichten"),
    category: "useful",
    agentSlug: "ana-serrano",
    agentFullName: "Ana Serrano",
    agentColour: "#475569",
    agentCredential: t("Analista de actualidad", "News analyst", "Nachrichtenanalystin"),
    ctaLabel: t("Entender", "Understand", "Verstehen"),
    topicTags: ["news", "world", "local", "explain"],
    timeSlots: ["morning", "afternoon"],
    featured: false,
    memberCount: 8,
    sortOrder: 100,
    dailyTopics: [
      {
        topic: t(
          "Actualidad explicada con calma.",
          "Current events explained calmly.",
          "Aktuelles ruhig erklärt.",
        ),
        opener: t(
          "Hola, soy Ana. Miramos una noticia y la explicamos sin alarmismo.",
          "Hello, I'm Ana. We look at one story and explain it without alarm.",
          "Hallo, ich bin Ana. Wir schauen eine Nachricht an und erklären sie ohne Alarm.",
        ),
        contentTitle: t("Una noticia clara", "One clear story", "Eine klare Nachricht"),
        contentBody: t(
          "Te explico contexto, qué importa y qué no está confirmado.",
          "I explain context, what matters and what is not confirmed.",
          "Ich erkläre Kontext, was zählt und was nicht bestätigt ist.",
        ),
        options: [
          t("Explícame las noticias", "Explain the news", "Erklär mir die Nachrichten"),
          t("¿Qué es importante hoy?", "What matters today?", "Was ist heute wichtig?"),
        ],
        activityType: "discussion",
      },
    ],
  }),
  room({
    slug: "walking-companion",
    names: t("Paseo acompañado", "Walking Companion", "Spazierbegleitung"),
    category: "activity",
    agentSlug: "camino",
    agentFullName: "Camino",
    agentColour: "#0F766E",
    agentCredential: t("Compañera de paseo", "Walking companion", "Spazierbegleiterin"),
    ctaLabel: t("Pasear", "Walk", "Gehen"),
    topicTags: ["walk", "movement", "outside", "company"],
    timeSlots: ["morning", "afternoon"],
    featured: false,
    memberCount: 7,
    sortOrder: 110,
    dailyTopics: [
      {
        topic: t(
          "Paseos seguros y conversación.",
          "Safe walks and conversation.",
          "Sichere Spaziergänge und Gespräche.",
        ),
        opener: t(
          "Hola, soy Camino. Podemos preparar un paseo breve y seguro.",
          "Hello, I'm Camino. We can prepare a short, safe walk.",
          "Hallo, ich bin Camino. Wir können einen kurzen, sicheren Spaziergang planen.",
        ),
        contentTitle: t("Paseo corto", "Short walk", "Kurzer Spaziergang"),
        contentBody: t(
          "Lo adaptamos a cómo te sientas y al tiempo de hoy.",
          "We adapt it to how you feel and today's weather.",
          "Wir passen ihn an dein Gefühl und das Wetter an.",
        ),
        options: [
          t("Quiero pasear", "I want to walk", "Ich möchte spazieren"),
          t("Hazme compañía", "Keep me company", "Leiste mir Gesellschaft"),
        ],
        activityType: "challenge",
      },
    ],
  }),
];

export const socialRoomSlugAliases: Record<string, string> = {
  "garden-chat": "garden-corner",
  "chess-corner": "games-room",
  "music-salon": "music-room",
  "book-club": "reading-room",
  "walking-club": "walking-companion",
  "news-cafe": "news-world-affairs",
};

export function resolveSocialRoomSlug(slug: string): string {
  return socialRoomSlugAliases[slug] ?? slug;
}

export function getSocialRoomBySlug(slug: string): SocialRoomSeed | undefined {
  const canonicalSlug = resolveSocialRoomSlug(slug);
  return socialRoomSeeds.find((roomSeed) => roomSeed.slug === canonicalSlug);
}

export function getTimeSlotFromDate(date = new Date()): "morning" | "afternoon" | "evening" {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function pick<T>(value: Record<SocialLanguage, T>, language: SocialLanguage): T {
  return value[language] ?? value.es;
}

export function localizeRoom(seed: SocialRoomSeed, language: SocialLanguage): Omit<SocialRoom, "sessionDate" | "topic" | "opener" | "quote" | "activityType" | "contentTag" | "contentTitle" | "contentBody" | "options" | "liveBadge"> {
  return {
    slug: seed.slug,
    name: pick(seed.names, language),
    category: seed.category,
    agentSlug: seed.agentSlug,
    agentFullName: seed.agentFullName,
    agentColour: seed.agentColour,
    agentCredential: pick(seed.agentCredential, language),
    ctaLabel: pick(seed.ctaLabel, language),
    topicTags: seed.topicTags,
    timeSlots: seed.timeSlots,
    featured: seed.featured,
    participantCount: seed.memberCount,
  };
}

export function buildDailyRoomSession(
  seed: SocialRoomSeed,
  language: SocialLanguage = "es",
  date = new Date(),
) {
  const daySeed = Math.floor(date.getTime() / 86_400_000);
  const topic = seed.dailyTopics[daySeed % seed.dailyTopics.length] ?? seed.dailyTopics[0];

  return {
    sessionDate: date.toISOString().slice(0, 10),
    topic: pick(topic.topic, language),
    opener: pick(topic.opener, language),
    quote: topic.quote ? pick(topic.quote, language) : "",
    activityType: topic.activityType ?? "discussion",
    contentTag: topic.contentTag ? pick(topic.contentTag, language) : "",
    contentTitle: topic.contentTitle ? pick(topic.contentTitle, language) : "",
    contentBody: topic.contentBody ? pick(topic.contentBody, language) : "",
    options: topic.options?.map((option) => pick(option, language)) ?? [],
  };
}
