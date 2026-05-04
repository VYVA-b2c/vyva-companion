export type HeroLanguage = "es" | "en" | "de" | "fr" | "it" | "pt";

export type HeroSurface =
  | "home"
  | "health"
  | "concierge"
  | "meds"
  | "brain"
  | "activity"
  | "vitals"
  | "doctor"
  | "companions"
  | "social";

export type HeroReason =
  | "safety"
  | "scheduled_event"
  | "continuation"
  | "time_of_day"
  | "evergreen";

export type HeroPeriod = "morning" | "afternoon" | "evening" | "night";

export type HeroSafetyLevel = "normal" | "medical" | "urgent";

export interface HeroMessageResult {
  headline: string;
  subtitle?: string;
  sourceText?: string;
  ctaLabel?: string;
  contextHint?: string;
  messageId: string;
  reason: HeroReason;
}

export interface HeroMessageContext {
  language?: string | null;
  firstName?: string | null;
  date?: Date;
  safetyLevel?: HeroSafetyLevel;
  fallbackHeadline?: string;
  fallbackSubtitle?: string;
  fallbackSourceText?: string;
  fallbackCtaLabel?: string;
  fallbackContextHint?: string;
  upcomingEventType?: "appointment" | "medication" | "social" | "concierge" | null;
  recentActivity?: "health_check" | "meds" | "social" | "concierge" | null;
}

export type HeroCopy = {
  sourceText?: string;
  headline: string;
  headlineWithName?: string;
  subtitle?: string;
  ctaLabel?: string;
  contextHint?: string;
};

export type HeroMessageDefinition = {
  id: string;
  surface: HeroSurface;
  reason: HeroReason;
  priority: number;
  cooldownHours: number;
  periods?: HeroPeriod[];
  safetyLevels?: HeroSafetyLevel[];
  eventTypes?: Array<NonNullable<HeroMessageContext["upcomingEventType"]>>;
  activityTypes?: Array<NonNullable<HeroMessageContext["recentActivity"]>>;
  copy: Record<HeroLanguage, HeroCopy>;
};

export const HERO_LIMITS = {
  headlineWords: 5,
  headlineChars: 30,
  sourceWords: 3,
  sourceChars: 18,
  ctaWords: 3,
  ctaChars: 20,
  subtitleWords: 8,
  subtitleChars: 48,
};

const STORAGE_KEY = "vyva.hero.impressions.v1";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isWithinLimit(text: string | undefined, wordLimit: number, charLimit: number): boolean {
  if (!text) return true;
  const normalized = text.trim();
  return wordCount(normalized) <= wordLimit && normalized.length <= charLimit;
}

function applyName(template: string, name: string): string {
  return template.replace(/\{name\}/g, name.trim());
}

function readImpressions(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function isCoolingDown(message: HeroMessageDefinition, now: number, impressions: Record<string, number>): boolean {
  const lastSeen = impressions[message.id];
  if (!lastSeen || message.cooldownHours <= 0) return false;
  return now - lastSeen < message.cooldownHours * 60 * 60 * 1000;
}

function matchesContext(message: HeroMessageDefinition, context: HeroMessageContext, period: HeroPeriod): boolean {
  if (message.periods?.length && !message.periods.includes(period)) return false;
  if (message.safetyLevels?.length && !message.safetyLevels.includes(context.safetyLevel ?? "normal")) return false;
  if (message.eventTypes?.length && (!context.upcomingEventType || !message.eventTypes.includes(context.upcomingEventType))) return false;
  if (message.activityTypes?.length && (!context.recentActivity || !message.activityTypes.includes(context.recentActivity))) return false;
  return true;
}

export function normalizeHeroLanguage(language?: string | null): HeroLanguage {
  const base = (language || "es").trim().toLowerCase().split("-")[0];
  if (["es", "en", "de", "fr", "it", "pt"].includes(base)) return base as HeroLanguage;
  return "es";
}

export function getHeroPeriod(date = new Date()): HeroPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 16) return "afternoon";
  if (hour >= 17 && hour <= 20) return "evening";
  return "night";
}

export const HERO_MESSAGES: HeroMessageDefinition[] = [
  {
    id: "home-morning",
    surface: "home",
    reason: "time_of_day",
    priority: 20,
    cooldownHours: 6,
    periods: ["morning"],
    copy: {
      es: { headline: "Buenos dias", headlineWithName: "Buenos dias, {name}", ctaLabel: "Hablar" },
      en: { headline: "Good morning", headlineWithName: "Good morning, {name}", ctaLabel: "Talk" },
      de: { headline: "Guten Morgen", headlineWithName: "Guten Morgen, {name}", ctaLabel: "Sprechen" },
      fr: { headline: "Bonjour", headlineWithName: "Bonjour, {name}", ctaLabel: "Parler" },
      it: { headline: "Buongiorno", headlineWithName: "Buongiorno, {name}", ctaLabel: "Parla" },
      pt: { headline: "Bom dia", headlineWithName: "Bom dia, {name}", ctaLabel: "Falar" },
    },
  },
  {
    id: "home-afternoon",
    surface: "home",
    reason: "time_of_day",
    priority: 20,
    cooldownHours: 6,
    periods: ["afternoon"],
    copy: {
      es: { headline: "Buenas tardes", headlineWithName: "Buenas tardes, {name}", ctaLabel: "Hablar" },
      en: { headline: "Good afternoon", headlineWithName: "Good afternoon, {name}", ctaLabel: "Talk" },
      de: { headline: "Guten Tag", headlineWithName: "Guten Tag, {name}", ctaLabel: "Sprechen" },
      fr: { headline: "Bon apres-midi", ctaLabel: "Parler" },
      it: { headline: "Buon pomeriggio", ctaLabel: "Parla" },
      pt: { headline: "Boa tarde", headlineWithName: "Boa tarde, {name}", ctaLabel: "Falar" },
    },
  },
  {
    id: "home-evening",
    surface: "home",
    reason: "time_of_day",
    priority: 20,
    cooldownHours: 6,
    periods: ["evening", "night"],
    copy: {
      es: { headline: "Buenas noches", headlineWithName: "Buenas noches, {name}", ctaLabel: "Hablar" },
      en: { headline: "Good evening", headlineWithName: "Good evening, {name}", ctaLabel: "Talk" },
      de: { headline: "Guten Abend", headlineWithName: "Guten Abend, {name}", ctaLabel: "Sprechen" },
      fr: { headline: "Bonsoir", headlineWithName: "Bonsoir, {name}", ctaLabel: "Parler" },
      it: { headline: "Buona sera", headlineWithName: "Buona sera, {name}", ctaLabel: "Parla" },
      pt: { headline: "Boa noite", headlineWithName: "Boa noite, {name}", ctaLabel: "Falar" },
    },
  },
  {
    id: "health-safe-default",
    surface: "health",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Salud", headline: "Todo en orden", subtitle: "Revisa tu salud hoy", ctaLabel: "Hablar con medico", contextHint: "health doctor" },
      en: { sourceText: "Health", headline: "All good", subtitle: "Check your health today", ctaLabel: "Talk to Doctor", contextHint: "health doctor" },
      de: { sourceText: "Gesundheit", headline: "Alles ruhig", subtitle: "Gesundheit heute pruefen", ctaLabel: "Arzt sprechen", contextHint: "health doctor" },
      fr: { sourceText: "Sante", headline: "Tout va bien", subtitle: "Verifier votre sante", ctaLabel: "Parler medecin", contextHint: "health doctor" },
      it: { sourceText: "Salute", headline: "Tutto bene", subtitle: "Controlla la salute", ctaLabel: "Parla medico", contextHint: "health doctor" },
      pt: { sourceText: "Saude", headline: "Tudo bem", subtitle: "Verificar saude hoje", ctaLabel: "Falar medico", contextHint: "health doctor" },
    },
  },
  {
    id: "health-urgent",
    surface: "health",
    reason: "safety",
    priority: 100,
    cooldownHours: 0,
    safetyLevels: ["urgent"],
    copy: {
      es: { sourceText: "Cuidado", headline: "Busca ayuda", subtitle: "Si es urgente, llama emergencias", ctaLabel: "Pedir ayuda", contextHint: "urgent health" },
      en: { sourceText: "Care", headline: "Get help", subtitle: "If urgent, call emergency services", ctaLabel: "Get help", contextHint: "urgent health" },
      de: { sourceText: "Achtung", headline: "Hilfe holen", subtitle: "Bei Notfall Notruf waehlen", ctaLabel: "Hilfe holen", contextHint: "urgent health" },
      fr: { sourceText: "Attention", headline: "Cherchez aide", subtitle: "Si urgent, appelez secours", ctaLabel: "Aide", contextHint: "urgent health" },
      it: { sourceText: "Attenzione", headline: "Chiedi aiuto", subtitle: "Se urgente chiama emergenza", ctaLabel: "Aiuto", contextHint: "urgent health" },
      pt: { sourceText: "Cuidado", headline: "Peça ajuda", subtitle: "Se urgente, ligue emergencia", ctaLabel: "Ajuda", contextHint: "urgent health" },
    },
  },
  {
    id: "concierge-default",
    surface: "concierge",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Tu ayudante", headline: "Que necesitas", subtitle: "Pido y organizo", ctaLabel: "Hablar", contextHint: "concierge" },
      en: { sourceText: "Your helper", headline: "Need help", subtitle: "Book and arrange", ctaLabel: "Talk", contextHint: "concierge" },
      de: { sourceText: "Hilfe", headline: "Was brauchst du", subtitle: "Buchen und regeln", ctaLabel: "Sprechen", contextHint: "concierge" },
      fr: { sourceText: "Aide", headline: "Besoin aide", subtitle: "Reserver et organiser", ctaLabel: "Parler", contextHint: "concierge" },
      it: { sourceText: "Aiuto", headline: "Serve aiuto", subtitle: "Prenoto e organizzo", ctaLabel: "Parla", contextHint: "concierge" },
      pt: { sourceText: "Ajuda", headline: "Precisa ajuda", subtitle: "Reservo e organizo", ctaLabel: "Falar", contextHint: "concierge" },
    },
  },
  {
    id: "meds-default",
    surface: "meds",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Medicacion", headline: "Tus medicinas", subtitle: "Seguimos el plan", ctaLabel: "Hablar", contextHint: "medication reminder" },
      en: { sourceText: "Medication", headline: "Your medicine", subtitle: "Follow the plan", ctaLabel: "Talk", contextHint: "medication reminder" },
      de: { sourceText: "Medizin", headline: "Deine Medizin", subtitle: "Plan einhalten", ctaLabel: "Sprechen", contextHint: "medication reminder" },
      fr: { sourceText: "Medicaments", headline: "Vos medicaments", subtitle: "Suivre le plan", ctaLabel: "Parler", contextHint: "medication reminder" },
      it: { sourceText: "Farmaci", headline: "I tuoi farmaci", subtitle: "Seguiamo il piano", ctaLabel: "Parla", contextHint: "medication reminder" },
      pt: { sourceText: "Medicacao", headline: "Seus remedios", subtitle: "Seguir o plano", ctaLabel: "Falar", contextHint: "medication reminder" },
    },
  },
  {
    id: "vitals-default",
    surface: "vitals",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Signos", headline: "Signos activos", subtitle: "Escanea tus signos", ctaLabel: "Escanear signos", contextHint: "vitals scan" },
      en: { sourceText: "Vitals", headline: "Vitals active", subtitle: "Scan your vitals", ctaLabel: "Scan vitals", contextHint: "vitals scan" },
      de: { sourceText: "Werte", headline: "Werte aktiv", subtitle: "Vitalwerte scannen", ctaLabel: "Werte scannen", contextHint: "vitals scan" },
      fr: { sourceText: "Signes", headline: "Signes actifs", subtitle: "Scanner vos signes", ctaLabel: "Scanner", contextHint: "vitals scan" },
      it: { sourceText: "Parametri", headline: "Parametri attivi", subtitle: "Scansiona i segni", ctaLabel: "Scansiona", contextHint: "vitals scan" },
      pt: { sourceText: "Sinais", headline: "Sinais ativos", subtitle: "Escanear sinais", ctaLabel: "Escanear", contextHint: "vitals scan" },
    },
  },
  {
    id: "doctor-default",
    surface: "doctor",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Ayuda medica", headline: "Elige opcion", subtitle: "Toca una opcion", ctaLabel: "Hablar ahora", contextHint: "doctor choice" },
      en: { sourceText: "Medical help", headline: "Choose option", subtitle: "Tap one option", ctaLabel: "Talk now", contextHint: "doctor choice" },
      de: { sourceText: "Medizin", headline: "Option waehlen", subtitle: "Eine Option tippen", ctaLabel: "Jetzt sprechen", contextHint: "doctor choice" },
      fr: { sourceText: "Aide medicale", headline: "Choisir option", subtitle: "Touchez une option", ctaLabel: "Parler", contextHint: "doctor choice" },
      it: { sourceText: "Aiuto medico", headline: "Scegli opzione", subtitle: "Tocca una opzione", ctaLabel: "Parla ora", contextHint: "doctor choice" },
      pt: { sourceText: "Ajuda medica", headline: "Escolha opcao", subtitle: "Toque uma opcao", ctaLabel: "Falar agora", contextHint: "doctor choice" },
    },
  },
  {
    id: "brain-default",
    surface: "brain",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Mente", headline: "Mente activa", subtitle: "Juegos para pensar", ctaLabel: "Empezar", contextHint: "brain training" },
      en: { sourceText: "Mind", headline: "Mind active", subtitle: "Games for thinking", ctaLabel: "Start", contextHint: "brain training" },
      de: { sourceText: "Geist", headline: "Geist aktiv", subtitle: "Spiele zum Denken", ctaLabel: "Starten", contextHint: "brain training" },
      fr: { sourceText: "Esprit", headline: "Esprit actif", subtitle: "Jeux pour penser", ctaLabel: "Demarrer", contextHint: "brain training" },
      it: { sourceText: "Mente", headline: "Mente attiva", subtitle: "Giochi per pensare", ctaLabel: "Inizia", contextHint: "brain training" },
      pt: { sourceText: "Mente", headline: "Mente ativa", subtitle: "Jogos para pensar", ctaLabel: "Comecar", contextHint: "brain training" },
    },
  },
  {
    id: "activity-default",
    surface: "activity",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Movimiento", headline: "Moverse suave", subtitle: "Actividad segura", ctaLabel: "Empezar", contextHint: "daily movement" },
      en: { sourceText: "Movement", headline: "Move gently", subtitle: "Safe activity", ctaLabel: "Start", contextHint: "daily movement" },
      de: { sourceText: "Bewegung", headline: "Sanft bewegen", subtitle: "Sichere Aktivitaet", ctaLabel: "Starten", contextHint: "daily movement" },
      fr: { sourceText: "Mouvement", headline: "Bouger doucement", subtitle: "Activite sure", ctaLabel: "Demarrer", contextHint: "daily movement" },
      it: { sourceText: "Movimento", headline: "Muoversi piano", subtitle: "Attivita sicura", ctaLabel: "Inizia", contextHint: "daily movement" },
      pt: { sourceText: "Movimento", headline: "Mover suave", subtitle: "Atividade segura", ctaLabel: "Comecar", contextHint: "daily movement" },
    },
  },
  {
    id: "companions-default",
    surface: "companions",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Comunidad", headline: "Conecta hoy", subtitle: "Salas y charla", ctaLabel: "Explorar", contextHint: "community" },
      en: { sourceText: "Community", headline: "Connect today", subtitle: "Rooms and chats", ctaLabel: "Explore", contextHint: "community" },
      de: { sourceText: "Gemeinschaft", headline: "Heute verbinden", subtitle: "Raeume und Gesprache", ctaLabel: "Entdecken", contextHint: "community" },
      fr: { sourceText: "Communaute", headline: "Connecter aujourd'hui", subtitle: "Salons et discussions", ctaLabel: "Explorer", contextHint: "community" },
      it: { sourceText: "Comunita", headline: "Connetti oggi", subtitle: "Stanze e chat", ctaLabel: "Esplora", contextHint: "community" },
      pt: { sourceText: "Comunidade", headline: "Conectar hoje", subtitle: "Salas e conversas", ctaLabel: "Explorar", contextHint: "community" },
    },
  },
  {
    id: "social-default",
    surface: "social",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Social", headline: "Elige sala", subtitle: "Entra cuando quieras", ctaLabel: "Entrar", contextHint: "social rooms" },
      en: { sourceText: "Social", headline: "Choose room", subtitle: "Join when ready", ctaLabel: "Enter", contextHint: "social rooms" },
      de: { sourceText: "Sozial", headline: "Raum waehlen", subtitle: "Eintreten wenn bereit", ctaLabel: "Eintreten", contextHint: "social rooms" },
      fr: { sourceText: "Social", headline: "Choisir salon", subtitle: "Entrer quand pret", ctaLabel: "Entrer", contextHint: "social rooms" },
      it: { sourceText: "Sociale", headline: "Scegli stanza", subtitle: "Entra quando vuoi", ctaLabel: "Entra", contextHint: "social rooms" },
      pt: { sourceText: "Social", headline: "Escolha sala", subtitle: "Entre quando quiser", ctaLabel: "Entrar", contextHint: "social rooms" },
    },
  },
];

let runtimeHeroMessages: HeroMessageDefinition[] | null = null;

export function setRuntimeHeroMessages(messages: HeroMessageDefinition[] | null): void {
  runtimeHeroMessages = messages?.length ? mergeHeroMessages(messages) : null;
}

export function getRuntimeHeroMessages(): HeroMessageDefinition[] {
  return runtimeHeroMessages ?? HERO_MESSAGES;
}

export function mergeHeroMessages(messages: HeroMessageDefinition[]): HeroMessageDefinition[] {
  const merged = new Map<string, HeroMessageDefinition>();
  for (const message of HERO_MESSAGES) merged.set(message.id, message);
  for (const message of messages) {
    const existing = merged.get(message.id);
    merged.set(message.id, existing ? { ...existing, ...message, copy: message.copy } : message);
  }
  return Array.from(merged.values());
}

function validCopy(copy: HeroCopy): boolean {
  return (
    isWithinLimit(copy.sourceText, HERO_LIMITS.sourceWords, HERO_LIMITS.sourceChars) &&
    isWithinLimit(copy.headline, HERO_LIMITS.headlineWords, HERO_LIMITS.headlineChars) &&
    isWithinLimit(copy.subtitle, HERO_LIMITS.subtitleWords, HERO_LIMITS.subtitleChars) &&
    isWithinLimit(copy.ctaLabel, HERO_LIMITS.ctaWords, HERO_LIMITS.ctaChars)
  );
}

function buildResult(message: HeroMessageDefinition, language: HeroLanguage, context: HeroMessageContext): HeroMessageResult {
  const copy = message.copy[language] ?? message.copy.es;
  const name = context.firstName?.trim();
  let headline = copy.headline;
  if (name && copy.headlineWithName) {
    const personalized = applyName(copy.headlineWithName, name);
    if (isWithinLimit(personalized, HERO_LIMITS.headlineWords, HERO_LIMITS.headlineChars)) {
      headline = personalized;
    }
  }

  return {
    headline,
    subtitle: copy.subtitle ?? context.fallbackSubtitle,
    sourceText: copy.sourceText ?? context.fallbackSourceText,
    ctaLabel: copy.ctaLabel ?? context.fallbackCtaLabel,
    contextHint: copy.contextHint ?? context.fallbackContextHint,
    messageId: message.id,
    reason: message.reason,
  };
}

function fallbackResult(surface: HeroSurface, context: HeroMessageContext): HeroMessageResult {
  return {
    headline: context.fallbackHeadline || "VYVA",
    subtitle: context.fallbackSubtitle,
    sourceText: context.fallbackSourceText,
    ctaLabel: context.fallbackCtaLabel,
    contextHint: context.fallbackContextHint,
    messageId: `${surface}-fallback`,
    reason: "evergreen",
  };
}

export function selectHeroMessage(surface: HeroSurface, context: HeroMessageContext = {}): HeroMessageResult {
  const language = normalizeHeroLanguage(context.language);
  const period = getHeroPeriod(context.date);
  const now = (context.date ?? new Date()).getTime();
  const impressions = readImpressions();
  const eligible = getRuntimeHeroMessages()
    .filter((message) => message.surface === surface)
    .filter((message) => matchesContext(message, context, period))
    .sort((a, b) => b.priority - a.priority);

  const notCoolingDown = eligible.find((message) => !isCoolingDown(message, now, impressions));
  const selected = notCoolingDown ?? eligible[0];
  if (!selected) return fallbackResult(surface, context);

  const result = buildResult(selected, language, context);
  return validateHeroMessageResult(result) ? result : fallbackResult(surface, context);
}

export function recordHeroImpression(messageId: string): void {
  if (typeof window === "undefined" || messageId.endsWith("-fallback")) return;
  try {
    const impressions = readImpressions();
    impressions[messageId] = Date.now();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(impressions));
  } catch {
    // Non-critical: repetition control should never break the UI.
  }
}

export function validateHeroMessageResult(message: Pick<HeroMessageResult, "headline" | "subtitle" | "sourceText" | "ctaLabel">): boolean {
  return (
    isWithinLimit(message.sourceText, HERO_LIMITS.sourceWords, HERO_LIMITS.sourceChars) &&
    isWithinLimit(message.headline, HERO_LIMITS.headlineWords, HERO_LIMITS.headlineChars) &&
    isWithinLimit(message.subtitle, HERO_LIMITS.subtitleWords, HERO_LIMITS.subtitleChars) &&
    isWithinLimit(message.ctaLabel, HERO_LIMITS.ctaWords, HERO_LIMITS.ctaChars)
  );
}

export function validateHeroMessageCatalog(messages: HeroMessageDefinition[] = getRuntimeHeroMessages()): string[] {
  const errors: string[] = [];
  for (const message of messages) {
    for (const language of Object.keys(message.copy) as HeroLanguage[]) {
      const copy = message.copy[language];
      if (!validCopy(copy)) errors.push(`${message.id}:${language}`);
    }
  }
  return errors;
}
