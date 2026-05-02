import type { SocialLanguage, SocialRoom, SocialRoomCategory } from "./types";

type CopyShape = {
  dayLabel: string;
  greetingMorning: string;
  greetingAfternoon: string;
  greetingEvening: string;
  subline: (count: number) => string;
  filters: Record<"all" | SocialRoomCategory, string>;
  featuredNow: string;
  alsoForYou: string;
  allRooms: string;
  chooseRoom: string;
  chooseRoomSubtitle: string;
  viewRoom: string;
  enterSelectedRoom: string;
  listenWelcome: string;
  closeDetails: string;
  listenTo: (name: string) => string;
  enterRoom: (ctaLabel: string) => string;
  tapAvatarHint: (name: string) => string;
  roomReady: string;
  welcomeLabel: (name: string) => string;
  topicLabel: string;
  writePlaceholder: string;
  send: string;
  voiceInput: string;
  noRooms: string;
  back: string;
  matchTitle: string;
  findMatch: string;
  shareThought: string;
  quickQuestions: string;
  roomPeople: string;
  sharedConversation: string;
  connectWith: (name: string) => string;
  voiceHint: string;
  viewMembers: string;
  askAgent: (name: string) => string;
  roomFeed: string;
  activityPanel: string;
  activityFeed: string;
  viewChat: string;
  hideChat: string;
  solveChallenge: string;
  startActivity: string;
  viewExample: string;
  askAction: string;
  sendGreeting: string;
  notNow: string;
  connectPromptTitle: (name: string) => string;
  connectPromptBody: (name: string, roomName: string) => string;
};

const COPY: Record<SocialLanguage, CopyShape> = {
  es: {
    dayLabel: "HOY",
    greetingMorning: "Buenos días",
    greetingAfternoon: "Buenas tardes",
    greetingEvening: "Buenas noches",
    subline: (count) => `Tus expertos te esperan · ${count} salas activas`,
    filters: {
      all: "Todas",
      activity: "Actividades",
      social: "Conversación",
      useful: "Útil",
      connection: "Conexión",
    },
    featuredNow: "Destacada ahora",
    alsoForYou: "También para ti",
    allRooms: "Todas las salas",
    chooseRoom: "Elige una sala",
    chooseRoomSubtitle: "Toca una sala para ver los detalles antes de entrar.",
    viewRoom: "Ver detalles",
    enterSelectedRoom: "Entrar en la sala",
    listenWelcome: "Escuchar bienvenida",
    closeDetails: "Cerrar",
    listenTo: (name) => `Escuchar a ${name}`,
    enterRoom: (ctaLabel) => ctaLabel,
    tapAvatarHint: (name) => `Toca el avatar para escuchar a ${name}`,
    roomReady: "Sala preparada — sé la primera en entrar",
    welcomeLabel: (name) => `${name} te da la bienvenida`,
    topicLabel: "TEMA DE HOY",
    writePlaceholder: "Escribe aquí...",
    send: "Enviar",
    voiceInput: "Hablar",
    noRooms: "Ahora mismo no hay salas disponibles.",
    back: "Volver",
    matchTitle: "Conexión sugerida",
    findMatch: "Buscar una conexión amable",
    shareThought: "Comparte una idea o un recuerdo.",
    quickQuestions: "Preguntas fáciles",
    roomPeople: "Personas en la sala",
    sharedConversation: "Lo que se comenta en la sala",
    connectWith: (name) => `Conectar con ${name}`,
    voiceHint: "Pulsa el micrófono para hablar con tu experta.",
    viewMembers: "Ver miembros",
    askAgent: (name) => `Preguntar a ${name}`,
    roomFeed: "Conversación en la sala",
    activityPanel: "Actividad de hoy",
    activityFeed: "Actividad en la sala",
    viewChat: "Ver conversación",
    hideChat: "Ocultar conversación",
    solveChallenge: "Resolver reto",
    startActivity: "Empezar actividad",
    viewExample: "Ver ejemplo",
    askAction: "Preguntar",
    sendGreeting: "Enviar saludo",
    notNow: "Ahora no",
    connectPromptTitle: (name) => `¿Quieres saludar a ${name}?`,
    connectPromptBody: (name, roomName) => `Ambos estáis en ${roomName}.`,
  },
  de: {
    dayLabel: "HEUTE",
    greetingMorning: "Guten Morgen",
    greetingAfternoon: "Guten Tag",
    greetingEvening: "Guten Abend",
    subline: (count) => `Deine Expertinnen warten · ${count} aktive Räume`,
    filters: {
      all: "Alle",
      activity: "Aktivitäten",
      social: "Gespräch",
      useful: "Praktisch",
      connection: "Verbindung",
    },
    featuredNow: "Jetzt im Mittelpunkt",
    alsoForYou: "Auch für dich",
    allRooms: "Alle Räume",
    chooseRoom: "Raum wählen",
    chooseRoomSubtitle: "Tippe auf einen Raum, um die Details vor dem Betreten zu sehen.",
    viewRoom: "Details ansehen",
    enterSelectedRoom: "Raum betreten",
    listenWelcome: "Begrüßung hören",
    closeDetails: "Schließen",
    listenTo: (name) => `${name} hören`,
    enterRoom: (ctaLabel) => ctaLabel,
    tapAvatarHint: (name) => `Tippe auf den Avatar, um ${name} zu hören`,
    roomReady: "Raum bereit — sei als Erste dabei",
    welcomeLabel: (name) => `${name} heißt dich willkommen`,
    topicLabel: "HEUTIGES THEMA",
    writePlaceholder: "Hier schreiben...",
    send: "Senden",
    voiceInput: "Sprechen",
    noRooms: "Im Moment sind keine Räume verfügbar.",
    back: "Zurück",
    matchTitle: "Vorgeschlagene Verbindung",
    findMatch: "Eine freundliche Verbindung suchen",
    shareThought: "Teile einen Gedanken oder eine Erinnerung.",
    quickQuestions: "Einfache Fragen",
    roomPeople: "Menschen im Raum",
    sharedConversation: "Was im Raum besprochen wird",
    connectWith: (name) => `Mit ${name} verbinden`,
    voiceHint: "Tippe auf das Mikrofon, um mit deiner Expertin zu sprechen.",
    viewMembers: "Mitglieder ansehen",
    askAgent: (name) => `${name} fragen`,
    roomFeed: "Gespräch im Raum",
    activityPanel: "Heutige Aktivität",
    activityFeed: "Aktivität im Raum",
    viewChat: "Gespräch ansehen",
    hideChat: "Gespräch ausblenden",
    solveChallenge: "Aufgabe lösen",
    startActivity: "Aktivität starten",
    viewExample: "Beispiel ansehen",
    askAction: "Fragen",
    sendGreeting: "Gruß senden",
    notNow: "Jetzt nicht",
    connectPromptTitle: (name) => `Möchtest du ${name} grüßen?`,
    connectPromptBody: (name, roomName) => `Ihr seid beide in ${roomName}.`,
  },
  en: {
    dayLabel: "TODAY",
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    subline: (count) => `Your experts are waiting · ${count} active rooms`,
    filters: {
      all: "All",
      activity: "Activities",
      social: "Conversation",
      useful: "Useful",
      connection: "Connection",
    },
    featuredNow: "Featured now",
    alsoForYou: "Also for you",
    allRooms: "All rooms",
    chooseRoom: "Choose a room",
    chooseRoomSubtitle: "Tap a room to see the details before entering.",
    viewRoom: "View details",
    enterSelectedRoom: "Enter room",
    listenWelcome: "Listen to welcome",
    closeDetails: "Close",
    listenTo: (name) => `Listen to ${name}`,
    enterRoom: (ctaLabel) => ctaLabel,
    tapAvatarHint: (name) => `Tap the avatar to hear ${name}`,
    roomReady: "Room ready — be the first to join",
    welcomeLabel: (name) => `${name} welcomes you`,
    topicLabel: "TODAY'S TOPIC",
    writePlaceholder: "Write here...",
    send: "Send",
    voiceInput: "Speak",
    noRooms: "There are no rooms available right now.",
    back: "Back",
    matchTitle: "Suggested connection",
    findMatch: "Look for a kind connection",
    shareThought: "Share a thought or a memory.",
    quickQuestions: "Easy questions",
    roomPeople: "People in the room",
    sharedConversation: "What people are saying here",
    connectWith: (name) => `Connect with ${name}`,
    voiceHint: "Tap the microphone to speak with your expert.",
    viewMembers: "View members",
    askAgent: (name) => `Ask ${name}`,
    roomFeed: "Room conversation",
    activityPanel: "Today's activity",
    activityFeed: "Activity in the room",
    viewChat: "View conversation",
    hideChat: "Hide conversation",
    solveChallenge: "Solve challenge",
    startActivity: "Start activity",
    viewExample: "View example",
    askAction: "Ask",
    sendGreeting: "Send greeting",
    notNow: "Not now",
    connectPromptTitle: (name) => `Would you like to greet ${name}?`,
    connectPromptBody: (name, roomName) => `You are both in ${roomName}.`,
  },
};

const ROOM_BADGES: Record<string, Record<SocialLanguage, string>> = {
  "garden-corner": { es: "Jardín", de: "Garten", en: "Garden" },
  "games-room": { es: "Juegos", de: "Spiele", en: "Games" },
  "kitchen-table": { es: "Cocina", de: "Küche", en: "Kitchen" },
  "morning-movement": { es: "Movimiento", de: "Bewegung", en: "Movement" },
  "evening-wind-down": { es: "Calma", de: "Ruhe", en: "Calm" },
  "music-room": { es: "Música", de: "Musik", en: "Music" },
  "reading-room": { es: "Lectura", de: "Lesen", en: "Reading" },
  "memory-lane": { es: "Recuerdos", de: "Erinnerungen", en: "Memories" },
  "morning-circle": { es: "Diario", de: "Täglich", en: "Daily" },
  "news-world-affairs": { es: "Noticias", de: "Nachrichten", en: "News" },
  "walking-companion": { es: "Paseo", de: "Spaziergang", en: "Walk" },
  "garden-chat": { es: "Jardín", de: "Garten", en: "Garden" },
  "chess-corner": { es: "Juegos", de: "Spiele", en: "Games" },
  "music-salon": { es: "Música", de: "Musik", en: "Music" },
  "book-club": { es: "Lectura", de: "Lesen", en: "Reading" },
  "walking-club": { es: "Paseo", de: "Spaziergang", en: "Walk" },
  "news-cafe": { es: "Noticias", de: "Nachrichten", en: "News" },
};

export function getSocialLanguage(language?: string | null): SocialLanguage {
  if (!language) return "es";
  if (language.startsWith("de")) return "de";
  if (language.startsWith("en")) return "en";
  return "es";
}

export function getSocialCopy(language: SocialLanguage) {
  return COPY[language];
}

export function getGreeting(language: SocialLanguage, firstName?: string) {
  const copy = getSocialCopy(language);
  const hour = new Date().getHours();
  const base = hour < 12 ? copy.greetingMorning : hour < 18 ? copy.greetingAfternoon : copy.greetingEvening;
  return firstName ? `${base}, ${firstName}` : base;
}

export function getRoomBadge(slug: string, language: SocialLanguage) {
  return ROOM_BADGES[slug]?.[language] ?? ROOM_BADGES[slug]?.es ?? "Sala";
}

export function getAgentFirstName(fullName: string) {
  return fullName.split(/\s+/).filter(Boolean)[0] ?? fullName;
}

export function filterRoomsByCategory(rooms: SocialRoom[], category: "all" | SocialRoomCategory) {
  if (category === "all") return rooms;
  return rooms.filter((room) => room.category === category);
}

export function sortHeroRooms(rooms: SocialRoom[]) {
  return [...rooms].sort((a, b) => (b.heroScore ?? 0) - (a.heroScore ?? 0));
}

export function formatLiveText(room: SocialRoom, language: SocialLanguage) {
  if (room.participantCount <= 0) {
    return getSocialCopy(language).roomReady;
  }
  return room.liveBadge;
}

export function getSpeechLangTag(language: SocialLanguage) {
  if (language === "de") return "de-DE";
  if (language === "en") return "en-US";
  return "es-ES";
}
