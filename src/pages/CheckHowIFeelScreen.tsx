import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  Battery,
  BedDouble,
  BookOpen,
  ChefHat,
  Check,
  ClipboardList,
  Compass,
  Copy,
  Dumbbell,
  Gamepad2,
  Heart,
  Headphones,
  Loader2,
  MessageCircle,
  Music,
  Palette,
  Send,
  ShieldCheck,
  Share2,
  Sparkles,
  Stethoscope,
  Sun,
  Users,
  UserRound,
  UserPlus,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/contexts/ProfileContext";
import { apiFetch } from "@/lib/queryClient";
import { ListenButton } from "@/components/ListenButton";

type StepId = "welcome" | "energy" | "mood" | "body" | "sleep" | "symptoms" | "details" | "safety" | "social" | "analyzing" | "result";

type Answers = {
  energy_level: number | null;
  mood: string | null;
  body_areas: string[];
  sleep_quality: string | null;
  symptoms: string[];
  symptom_details: string[];
  safety_flags: string[];
  social_contact: string | null;
};

type CheckinResult = {
  feeling_label: string;
  overall_state: "excellent" | "good" | "moderate" | "tired" | "low";
  vyva_reading: string;
  why_today?: string | null;
  trend_note?: string | null;
  personal_plan?: string | null;
  app_suggestion?: string | null;
  suggested_app_action?: AppAction["key"] | null;
  right_now: string[];
  today_actions: string[];
  highlight: string;
  flag_caregiver: boolean;
  watch_for: string | null;
};

type AppAction = {
  key: "concierge" | "symptom" | "vitals" | "care" | "meditation" | "social" | "music" | "exercise" | "chess" | "cooking" | "art" | "literature";
  title: string;
  description: string;
  to: string;
  primary?: boolean;
};

type CareTeamMember = {
  id: string;
  invitee_name: string;
  invitee_phone: string | null;
  invitee_email: string | null;
  role: string;
  relationship: string | null;
  status: string;
};

type GpContact = {
  gp_name?: string | null;
  gp_phone?: string | null;
};

type ShareTarget = {
  id: string;
  kind: "caregiver" | "doctor" | "new";
  title: string;
  detail: string;
  value?: string;
  channel: "sms" | "email" | "native";
};

type SingleOption = {
  id: string;
  label: string;
  helper?: string;
  value?: number;
  icon?: string;
};

type GrammaticalGender = "female" | "male" | "neutral";
type WizardLocale = "es" | "en" | "de" | "fr" | "it" | "pt";

const STEPS: StepId[] = ["welcome", "energy", "mood", "body", "sleep", "symptoms", "details", "safety", "social", "analyzing", "result"];
const QUESTION_STEPS: StepId[] = ["energy", "mood", "body", "sleep", "symptoms", "details", "safety", "social"];

const initialAnswers: Answers = {
  energy_level: null,
  mood: null,
  body_areas: [],
  sleep_quality: null,
  symptoms: [],
  symptom_details: [],
  safety_flags: [],
  social_contact: null,
};

const moodOptions: SingleOption[] = [
  { id: "alegre", icon: "😊", label: "Alegre", helper: "Con buen ánimo" },
  { id: "tranquila", icon: "🌿", label: "Tranquila", helper: "Serena y estable" },
  { id: "triste", icon: "💧", label: "Triste", helper: "Un poco apagada" },
  { id: "ansiosa", icon: "🌀", label: "Inquieta", helper: "Con preocupación o nervios" },
  { id: "irritable", icon: "⚡", label: "Irritable", helper: "Con poca paciencia" },
];

const bodyOptions: SingleOption[] = [
  { id: "cabeza", icon: "🧠", label: "Cabeza" },
  { id: "pecho", icon: "💛", label: "Pecho" },
  { id: "estomago", icon: "🍵", label: "Estómago" },
  { id: "espalda", icon: "🪑", label: "Espalda" },
  { id: "articulaciones", icon: "🦴", label: "Articulaciones" },
  { id: "piernas", icon: "🦵", label: "Piernas" },
  { id: "ninguno", icon: "👌", label: "Nada especial" },
];

const sleepOptions: SingleOption[] = [
  { id: "muy_bien", icon: "🌅", label: "Muy bien", helper: "Dormí seguido y descansé" },
  { id: "bien", icon: "🌙", label: "Bien", helper: "Dormí lo suficiente" },
  { id: "regular", icon: "☕", label: "Regular", helper: "Me desperté varias veces" },
  { id: "mal", icon: "🌧️", label: "Mal", helper: "Dormí poco" },
  { id: "muy_mal", icon: "🛌", label: "Muy mal", helper: "Casi no descansé" },
];

const symptomOptionsBase: SingleOption[] = [
  { id: "dolor_cabeza", icon: "🤕", label: "Dolor de cabeza" },
  { id: "mareo", icon: "🌀", label: "Mareo" },
  { id: "nauseas", icon: "🍵", label: "Náuseas" },
  { id: "fiebre", icon: "🌡️", label: "Sensación de fiebre" },
  { id: "falta_aire", icon: "🫁", label: "Me falta el aire" },
  { id: "ninguno", icon: "👌", label: "Ninguno de estos" },
];

const socialOptionsBase: SingleOption[] = [
  { id: "mucho", icon: "🤝", label: "Sí, bastante", helper: "He hablado o estaré con gente" },
  { id: "algo", icon: "💬", label: "Un poco", helper: "Algún mensaje o llamada" },
];

const CHECKIN_TEXT = {
  es: {
    back: "Atrás",
    stepHint: "Vamos paso a paso",
    stepOf: "de",
    next: "Siguiente",
    hello: "Hola",
    welcomeTitle: "Revisemos cómo te sientes hoy.",
    welcomeIntro: "Seis preguntas sencillas. VYVA las convierte en una lectura útil para tu día.",
    cards: [
      { title: "Privado", text: "Tus respuestas se tratan con cuidado." },
      { title: "Personal", text: "Usa tu perfil para adaptar las ideas." },
      { title: "Suave", text: "No es un diagnóstico, es una guía de bienestar." },
    ],
    start: "Empezar ahora",
    skip: "Ahora no",
    qEnergy: ["¿Cuánta energía tienes hoy?", "Elige la frase que más se parece a tu mañana."],
    qMood: ["¿Cómo está tu ánimo?", "No hay respuesta buena o mala. Solo queremos escucharte."],
    qBody: ["¿Notas algo en el cuerpo?", "Puedes marcar más de una opción."],
    qSleep: ["¿Cómo dormiste?", "El descanso cambia mucho cómo se siente el día."],
    qSymptoms: ["¿Hay algo que quieras mencionar?", "Marca lo que notes hoy, aunque sea suave."],
    qSocial: ["¿Has tenido contacto con alguien hoy?", "La compañía también cuenta para el bienestar."],
    energy: {
      none: ["Sin energía", "Me cuesta empezar el día"],
      tired: ["Algo cansada", "Algo cansado", "Algo de cansancio", "Voy más lenta de lo normal", "Voy más lento de lo normal", "Voy más despacio de lo normal"],
      normal: ["Normal", "Como un día corriente"],
      well: ["Bastante bien", "Tengo ganas de hacer cosas"],
      high: ["Con mucha energía", "Me siento activa y despierta", "Me siento activo y despierto", "Me siento con energía y claridad"],
    },
    mood: [["Alegre", "Con buen ánimo"], ["Tranquila", "Serena y estable"], ["Triste", "Un poco apagada"], ["Inquieta", "Con preocupación o nervios"], ["Irritable", "Con poca paciencia"]],
    body: ["Cabeza", "Pecho", "Estómago", "Espalda", "Articulaciones", "Piernas", "Nada especial"],
    sleep: [["Muy bien", "Dormí seguido y descansé"], ["Bien", "Dormí lo suficiente"], ["Regular", "Me desperté varias veces"], ["Mal", "Dormí poco"], ["Muy mal", "Casi no descansé"]],
    symptoms: ["Dolor de cabeza", "Mareo", "Náuseas", "Sensación de fiebre", "Me falta el aire", ["Me siento confundida", "Me siento confundido", "Siento confusión"], "Ninguno de estos"],
    social: [["Sí, bastante", "He hablado o estaré con gente"], ["Un poco", "Algún mensaje o llamada"], ["No mucho", "Hoy estoy más sola", "Hoy estoy más solo", "Hoy tengo poca compañía"]],
    analyzingTitle: "Un momento",
    loading: ["Leyendo tus respuestas con calma...", "Revisando tu contexto personal...", "Preparando ideas útiles para hoy..."],
    resultKicker: "Tu lectura de hoy",
    important: "Lo importante",
    whyTitle: "Por qué hoy",
    trendTitle: "Tendencia",
    planTitle: "Plan adaptado",
    suggestionTitle: "Siguiente paso",
    rightNow: "Ahora mismo",
    today: "Para hoy",
    appHelpTitle: "VYVA puede ayudarte ahora",
    appHelpText: "Elige el siguiente paso dentro de la app, sin tener que buscarlo tú.",
    readResult: "Ver mi lectura",
    thanks: "Gracias por hacerlo. Este pequeño hábito ayuda a VYVA a cuidarte mejor cada día.",
    share: "Compartir resultado",
    done: "Gracias, VYVA",
    repeat: "Repetir check-in",
    shareTitle: "Mi lectura VYVA de hoy",
    copied: "Resultado copiado para compartir.",
    shareFailed: "No he podido compartir el resultado ahora mismo.",
    fallbackToast: "He preparado una lectura local porque la conexión no respondió a tiempo.",
    shareFor: "Lectura VYVA de hoy para",
    me: "mí",
    note: "Ten en cuenta",
    appActions: {
      care: ["Buscar atención médica", "Si empeora, hay dolor en el pecho, falta de aire o confusión, no esperes."],
      symptom: ["Hacer chequeo de síntomas", "VYVA te guía con preguntas claras y te ayuda a decidir el siguiente paso."],
      vitals: ["Tomar signos vitales", "Haz un escaneo rápido para registrar pulso y respiración antes de decidir."],
      concierge: ["Ver Para ti hoy", "Encuentra una salida o idea cercana, adaptada a tu energía y movilidad."],
    },
  },
  en: {
    back: "Back",
    stepHint: "One step at a time",
    stepOf: "of",
    next: "Next",
    hello: "Hello",
    welcomeTitle: "Let’s check how you feel today.",
    welcomeIntro: "Six simple questions. VYVA turns them into a useful reading for your day.",
    cards: [
      { title: "Private", text: "Your answers are handled with care." },
      { title: "Personal", text: "Uses your profile to adapt suggestions." },
      { title: "Gentle", text: "Not a diagnosis, just wellbeing guidance." },
    ],
    start: "Start now",
    skip: "Not now",
    qEnergy: ["How much energy do you have today?", "Choose the phrase that feels closest to your morning."],
    qMood: ["How is your mood?", "There is no right or wrong answer. VYVA is just listening."],
    qBody: ["Do you notice anything in your body?", "You can choose more than one option."],
    qSleep: ["How did you sleep?", "Sleep changes how the day feels."],
    qSymptoms: ["Anything else you want to mention?", "Choose anything you notice today, even if it feels mild."],
    qSocial: ["Have you had contact with anyone today?", "Company also matters for wellbeing."],
    energy: {
      none: ["No energy", "Hard to get started"],
      tired: ["A bit tired", "A bit tired", "Some tiredness", "I’m slower than usual", "I’m slower than usual", "I’m moving more slowly than usual"],
      normal: ["Normal", "Like an ordinary day"],
      well: ["Quite well", "I feel like doing things"],
      high: ["Lots of energy", "I feel active and alert", "I feel active and alert", "I feel energetic and clear"],
    },
    mood: [["Happy", "In good spirits"], ["Calm", "Steady and peaceful"], ["Sad", "A little low"], ["Uneasy", "Worried or nervous"], ["Irritable", "Less patient than usual"]],
    body: ["Head", "Chest", "Stomach", "Back", "Joints", "Legs", "Nothing special"],
    sleep: [["Very well", "I slept through and rested"], ["Well", "I slept enough"], ["So-so", "I woke up several times"], ["Badly", "I slept little"], ["Very badly", "I hardly rested"]],
    symptoms: ["Headache", "Dizziness", "Nausea", "Feeling feverish", "Short of breath", ["I feel confused", "I feel confused", "I feel confused"], "None of these"],
    social: [["Yes, quite a bit", "I have spoken or will be with people"], ["A little", "A message or call"], ["Not much", "I feel more alone today", "I feel more alone today", "I have little company today"]],
    analyzingTitle: "One moment",
    loading: ["Reading your answers calmly...", "Checking your personal context...", "Preparing useful ideas for today..."],
    resultKicker: "Today’s reading",
    important: "Important",
    whyTitle: "Why today",
    trendTitle: "Trend",
    planTitle: "Personal plan",
    suggestionTitle: "Next step",
    rightNow: "Right now",
    today: "For today",
    appHelpTitle: "VYVA can help now",
    appHelpText: "Choose the next step in the app without having to search for it.",
    readResult: "See my reading",
    thanks: "Thank you for doing this. This small habit helps VYVA care for you better each day.",
    share: "Share result",
    done: "Thanks, VYVA",
    repeat: "Repeat check-in",
    shareTitle: "My VYVA reading today",
    copied: "Result copied to share.",
    shareFailed: "I couldn’t share the result right now.",
    fallbackToast: "I prepared a local reading because the connection did not respond in time.",
    shareFor: "Today’s VYVA reading for",
    me: "me",
    note: "Keep in mind",
    appActions: {
      care: ["Seek medical attention", "If things worsen, or there is chest pain, breathlessness, or confusion, do not wait."],
      symptom: ["Do a symptom check", "VYVA guides you with clear questions and helps decide the next step."],
      vitals: ["Take vital signs", "Do a quick scan to record pulse and breathing before deciding."],
      concierge: ["See For you today", "Find a nearby idea adapted to your energy and mobility."],
    },
  },
} as const;

const CHECKIN_LAUNCH_TEXT = {
  ...CHECKIN_TEXT,
  de: {
    ...CHECKIN_TEXT.en,
    back: "Zurück",
    stepHint: "Schritt für Schritt",
    stepOf: "von",
    next: "Weiter",
    hello: "Hallo",
    welcomeTitle: "Schauen wir, wie es dir heute geht.",
    welcomeIntro: "Sechs einfache Fragen. VYVA macht daraus eine hilfreiche Einschätzung für deinen Tag.",
    cards: [
      { title: "Privat", text: "Deine Antworten werden sorgsam behandelt." },
      { title: "Persönlich", text: "Dein Profil hilft, die Hinweise anzupassen." },
      { title: "Sanft", text: "Keine Diagnose, sondern eine Wohlbefindenshilfe." },
    ],
    start: "Jetzt starten",
    skip: "Jetzt nicht",
    qEnergy: ["Wie viel Energie hast du heute?", "Wähle den Satz, der am besten zu deinem Morgen passt."],
    qMood: ["Wie ist deine Stimmung?", "Es gibt keine richtige oder falsche Antwort. VYVA hört einfach zu."],
    qBody: ["Spürst du etwas im Körper?", "Du kannst mehr als eine Option wählen."],
    qSleep: ["Wie hast du geschlafen?", "Schlaf verändert, wie sich der Tag anfühlt."],
    qSymptoms: ["Möchtest du noch etwas erwähnen?", "Wähle alles aus, was du heute bemerkst, auch wenn es mild ist."],
    qSocial: ["Hattest du heute Kontakt mit jemandem?", "Gesellschaft zählt auch zum Wohlbefinden."],
    energy: {
      none: ["Keine Energie", "Ich komme schwer in den Tag"],
      tired: ["Etwas müde", "Etwas müde", "Etwas Erschöpfung", "Ich bin langsamer als sonst", "Ich bin langsamer als sonst", "Ich bin heute langsamer unterwegs"],
      normal: ["Normal", "Wie ein gewöhnlicher Tag"],
      well: ["Ziemlich gut", "Ich habe Lust, etwas zu tun"],
      high: ["Viel Energie", "Ich fühle mich aktiv und wach", "Ich fühle mich aktiv und wach", "Ich fühle mich klar und energiegeladen"],
    },
    mood: [["Fröhlich", "Gute Stimmung"], ["Ruhig", "Gelassen und stabil"], ["Traurig", "Etwas niedergeschlagen"], ["Unruhig", "Besorgt oder nervös"], ["Reizbar", "Weniger Geduld als sonst"]],
    body: ["Kopf", "Brust", "Magen", "Rücken", "Gelenke", "Beine", "Nichts Besonderes"],
    sleep: [["Sehr gut", "Ich habe durchgeschlafen und mich erholt"], ["Gut", "Ich habe genug geschlafen"], ["Mittel", "Ich bin mehrmals aufgewacht"], ["Schlecht", "Ich habe wenig geschlafen"], ["Sehr schlecht", "Ich habe kaum geruht"]],
    symptoms: ["Kopfschmerzen", "Schwindel", "Übelkeit", "Fiebriges Gefühl", "Atemnot", ["Ich fühle mich verwirrt", "Ich fühle mich verwirrt", "Ich fühle mich verwirrt"], "Nichts davon"],
    social: [["Ja, ziemlich", "Ich habe gesprochen oder werde Menschen sehen"], ["Ein wenig", "Eine Nachricht oder ein Anruf"], ["Nicht viel", "Ich fühle mich heute einsamer", "Ich fühle mich heute einsamer", "Ich habe heute wenig Gesellschaft"]],
    analyzingTitle: "Einen Moment",
    loading: ["Ich lese deine Antworten in Ruhe...", "Ich prüfe deinen persönlichen Kontext...", "Ich bereite nützliche Ideen für heute vor..."],
    resultKicker: "Deine heutige Einschätzung",
    important: "Wichtig",
    whyTitle: "Warum heute",
    trendTitle: "Tendenz",
    planTitle: "Persönlicher Plan",
    suggestionTitle: "Nächster Schritt",
    rightNow: "Jetzt gerade",
    today: "Für heute",
    appHelpTitle: "VYVA kann jetzt helfen",
    appHelpText: "Wähle den nächsten Schritt in der App, ohne selbst suchen zu müssen.",
    readResult: "Meine Einschätzung ansehen",
    thanks: "Danke, dass du das gemacht hast. Diese kleine Gewohnheit hilft VYVA, dich jeden Tag besser zu begleiten.",
    share: "Ergebnis teilen",
    done: "Danke, VYVA",
    repeat: "Check-in wiederholen",
    shareTitle: "Meine heutige VYVA-Einschätzung",
    copied: "Ergebnis zum Teilen kopiert.",
    shareFailed: "Ich konnte das Ergebnis gerade nicht teilen.",
    fallbackToast: "Ich habe eine lokale Einschätzung vorbereitet, weil die Verbindung nicht rechtzeitig geantwortet hat.",
    shareFor: "Heutige VYVA-Einschätzung für",
    me: "mich",
    note: "Bitte beachten",
    appActions: {
      care: ["Medizinische Hilfe suchen", "Wenn es schlimmer wird oder Brustschmerz, Atemnot oder Verwirrung dazukommen, warte nicht."],
      symptom: ["Symptom-Check machen", "VYVA führt dich mit klaren Fragen und hilft beim nächsten Schritt."],
      vitals: ["Vitalwerte messen", "Mach einen kurzen Scan, um Puls und Atmung zu erfassen."],
      concierge: ["Für dich heute ansehen", "Finde eine nahe Idee, passend zu Energie und Mobilität."],
    },
  },
  fr: {
    ...CHECKIN_TEXT.en,
    back: "Retour",
    stepHint: "Une étape à la fois",
    stepOf: "sur",
    next: "Suivant",
    hello: "Bonjour",
    welcomeTitle: "Voyons comment tu te sens aujourd’hui.",
    welcomeIntro: "Six questions simples. VYVA les transforme en lecture utile pour ta journée.",
    cards: [
      { title: "Privé", text: "Tes réponses sont traitées avec soin." },
      { title: "Personnel", text: "Ton profil aide à adapter les idées." },
      { title: "Doux", text: "Ce n’est pas un diagnostic, mais un guide de bien-être." },
    ],
    start: "Commencer",
    skip: "Pas maintenant",
    qEnergy: ["Combien d’énergie as-tu aujourd’hui ?", "Choisis la phrase qui ressemble le plus à ta matinée."],
    qMood: ["Comment est ton moral ?", "Il n’y a pas de bonne ou mauvaise réponse. VYVA t’écoute."],
    qBody: ["Remarques-tu quelque chose dans ton corps ?", "Tu peux choisir plusieurs options."],
    qSleep: ["Comment as-tu dormi ?", "Le sommeil change beaucoup la façon dont la journée se ressent."],
    qSymptoms: ["Y a-t-il autre chose à mentionner ?", "Sélectionne ce que tu remarques aujourd’hui, même si c’est léger."],
    qSocial: ["As-tu eu un contact avec quelqu’un aujourd’hui ?", "La compagnie compte aussi pour le bien-être."],
    energy: {
      none: ["Pas d’énergie", "J’ai du mal à commencer la journée"],
      tired: ["Un peu fatiguée", "Un peu fatigué", "Un peu de fatigue", "Je vais plus lentement que d’habitude", "Je vais plus lentement que d’habitude", "J’avance plus doucement que d’habitude"],
      normal: ["Normal", "Comme une journée ordinaire"],
      well: ["Plutôt bien", "J’ai envie de faire des choses"],
      high: ["Beaucoup d’énergie", "Je me sens active et éveillée", "Je me sens actif et éveillé", "Je me sens avec de l’énergie et les idées claires"],
    },
    mood: [["Joyeux", "De bonne humeur"], ["Calme", "Stable et serein"], ["Triste", "Un peu bas"], ["Inquiet", "Avec des soucis ou de la nervosité"], ["Irritable", "Moins de patience que d’habitude"]],
    body: ["Tête", "Poitrine", "Estomac", "Dos", "Articulations", "Jambes", "Rien de spécial"],
    sleep: [["Très bien", "J’ai dormi d’une traite et je me suis reposé"], ["Bien", "J’ai dormi assez"], ["Moyen", "Je me suis réveillé plusieurs fois"], ["Mal", "J’ai peu dormi"], ["Très mal", "J’ai à peine reposé"]],
    symptoms: ["Mal de tête", "Vertige", "Nausée", "Sensation de fièvre", "Essoufflement", ["Je me sens confuse", "Je me sens confus", "Je me sens confus/confuse"], "Aucun de ceux-ci"],
    social: [["Oui, assez", "J’ai parlé ou je verrai des gens"], ["Un peu", "Un message ou un appel"], ["Pas beaucoup", "Je me sens plus seule aujourd’hui", "Je me sens plus seul aujourd’hui", "J’ai peu de compagnie aujourd’hui"]],
    analyzingTitle: "Un instant",
    loading: ["Lecture calme de tes réponses...", "Vérification de ton contexte personnel...", "Préparation d’idées utiles pour aujourd’hui..."],
    resultKicker: "Ta lecture du jour",
    important: "Important",
    whyTitle: "Pourquoi aujourd’hui",
    trendTitle: "Tendance",
    planTitle: "Plan adapté",
    suggestionTitle: "Prochaine étape",
    rightNow: "Maintenant",
    today: "Pour aujourd’hui",
    appHelpTitle: "VYVA peut aider maintenant",
    appHelpText: "Choisis la prochaine étape dans l’app, sans avoir à chercher.",
    readResult: "Voir ma lecture",
    thanks: "Merci de l’avoir fait. Cette petite habitude aide VYVA à mieux prendre soin de toi chaque jour.",
    share: "Partager le résultat",
    done: "Merci, VYVA",
    repeat: "Refaire le check-in",
    shareTitle: "Ma lecture VYVA du jour",
    copied: "Résultat copié pour le partage.",
    shareFailed: "Je n’ai pas pu partager le résultat maintenant.",
    fallbackToast: "J’ai préparé une lecture locale car la connexion n’a pas répondu à temps.",
    shareFor: "Lecture VYVA du jour pour",
    me: "moi",
    note: "À noter",
    appActions: {
      care: ["Chercher une aide médicale", "Si cela s’aggrave, ou s’il y a douleur thoracique, essoufflement ou confusion, n’attends pas."],
      symptom: ["Faire un contrôle des symptômes", "VYVA te guide avec des questions claires et aide à décider la suite."],
      vitals: ["Prendre les signes vitaux", "Fais un scan rapide pour noter le pouls et la respiration."],
      concierge: ["Voir Pour toi aujourd’hui", "Trouve une idée proche, adaptée à ton énergie et ta mobilité."],
    },
  },
  it: {
    ...CHECKIN_TEXT.en,
    back: "Indietro",
    stepHint: "Un passo alla volta",
    stepOf: "di",
    next: "Avanti",
    hello: "Ciao",
    welcomeTitle: "Vediamo come ti senti oggi.",
    welcomeIntro: "Sei domande semplici. VYVA le trasforma in una lettura utile per la giornata.",
    cards: [
      { title: "Privato", text: "Le tue risposte vengono trattate con cura." },
      { title: "Personale", text: "Il tuo profilo aiuta ad adattare i suggerimenti." },
      { title: "Delicato", text: "Non è una diagnosi, ma una guida al benessere." },
    ],
    start: "Inizia ora",
    skip: "Non ora",
    qEnergy: ["Quanta energia hai oggi?", "Scegli la frase più vicina alla tua mattina."],
    qMood: ["Com’è il tuo umore?", "Non c’è una risposta giusta o sbagliata. VYVA ti ascolta."],
    qBody: ["Noti qualcosa nel corpo?", "Puoi scegliere più di un’opzione."],
    qSleep: ["Come hai dormito?", "Il sonno cambia molto il modo in cui si sente la giornata."],
    qSymptoms: ["C’è altro che vuoi menzionare?", "Segna ciò che noti oggi, anche se è lieve."],
    qSocial: ["Hai avuto contatto con qualcuno oggi?", "Anche la compagnia conta per il benessere."],
    energy: {
      none: ["Senza energia", "Faccio fatica a iniziare la giornata"],
      tired: ["Un po’ stanca", "Un po’ stanco", "Un po’ di stanchezza", "Vado più lenta del solito", "Vado più lento del solito", "Mi muovo più lentamente del solito"],
      normal: ["Normale", "Come una giornata qualunque"],
      well: ["Abbastanza bene", "Ho voglia di fare cose"],
      high: ["Molta energia", "Mi sento attiva e sveglia", "Mi sento attivo e sveglio", "Mi sento con energia e lucidità"],
    },
    mood: [["Allegra", "Di buon umore"], ["Tranquilla", "Serena e stabile"], ["Triste", "Un po’ giù"], ["Inquieta", "Con preoccupazione o nervosismo"], ["Irritabile", "Con poca pazienza"]],
    body: ["Testa", "Petto", "Stomaco", "Schiena", "Articolazioni", "Gambe", "Niente di particolare"],
    sleep: [["Molto bene", "Ho dormito di seguito e riposato"], ["Bene", "Ho dormito abbastanza"], ["Così così", "Mi sono svegliata più volte"], ["Male", "Ho dormito poco"], ["Molto male", "Ho riposato pochissimo"]],
    symptoms: ["Mal di testa", "Capogiri", "Nausea", "Sensazione di febbre", "Mi manca il respiro", ["Mi sento confusa", "Mi sento confuso", "Sento confusione"], "Nessuno di questi"],
    social: [["Sì, abbastanza", "Ho parlato o starò con persone"], ["Un po’", "Un messaggio o una chiamata"], ["Non molto", "Oggi mi sento più sola", "Oggi mi sento più solo", "Oggi ho poca compagnia"]],
    analyzingTitle: "Un momento",
    loading: ["Leggo le tue risposte con calma...", "Controllo il tuo contesto personale...", "Preparo idee utili per oggi..."],
    resultKicker: "La lettura di oggi",
    important: "Importante",
    whyTitle: "Perché oggi",
    trendTitle: "Tendenza",
    planTitle: "Piano personale",
    suggestionTitle: "Prossimo passo",
    rightNow: "Adesso",
    today: "Per oggi",
    appHelpTitle: "VYVA può aiutarti ora",
    appHelpText: "Scegli il prossimo passo nell’app, senza dover cercare.",
    readResult: "Vedi la mia lettura",
    thanks: "Grazie per averlo fatto. Questa piccola abitudine aiuta VYVA a prendersi cura di te ogni giorno.",
    share: "Condividi risultato",
    done: "Grazie, VYVA",
    repeat: "Ripeti check-in",
    shareTitle: "La mia lettura VYVA di oggi",
    copied: "Risultato copiato per la condivisione.",
    shareFailed: "Non sono riuscita a condividere il risultato ora.",
    fallbackToast: "Ho preparato una lettura locale perché la connessione non ha risposto in tempo.",
    shareFor: "Lettura VYVA di oggi per",
    me: "me",
    note: "Da tenere a mente",
    appActions: {
      care: ["Cercare assistenza medica", "Se peggiora, o ci sono dolore al petto, mancanza di respiro o confusione, non aspettare."],
      symptom: ["Fare controllo sintomi", "VYVA ti guida con domande chiare e aiuta a decidere il prossimo passo."],
      vitals: ["Misurare segni vitali", "Fai una scansione rapida per registrare polso e respirazione."],
      concierge: ["Vedi Per te oggi", "Trova un’idea vicina, adatta alla tua energia e mobilità."],
    },
  },
  pt: {
    ...CHECKIN_TEXT.en,
    back: "Voltar",
    stepHint: "Um passo de cada vez",
    stepOf: "de",
    next: "Seguinte",
    hello: "Olá",
    welcomeTitle: "Vamos ver como te sentes hoje.",
    welcomeIntro: "Seis perguntas simples. A VYVA transforma-as numa leitura útil para o teu dia.",
    cards: [
      { title: "Privado", text: "As tuas respostas são tratadas com cuidado." },
      { title: "Pessoal", text: "O teu perfil ajuda a adaptar as ideias." },
      { title: "Suave", text: "Não é um diagnóstico, é uma orientação de bem-estar." },
    ],
    start: "Começar agora",
    skip: "Agora não",
    qEnergy: ["Quanta energia tens hoje?", "Escolhe a frase que mais se parece com a tua manhã."],
    qMood: ["Como está o teu ânimo?", "Não há resposta certa ou errada. A VYVA só quer ouvir-te."],
    qBody: ["Notas algo no corpo?", "Podes marcar mais do que uma opção."],
    qSleep: ["Como dormiste?", "O descanso muda muito a forma como o dia se sente."],
    qSymptoms: ["Há algo mais que queiras mencionar?", "Marca o que notares hoje, mesmo que seja ligeiro."],
    qSocial: ["Tiveste contacto com alguém hoje?", "A companhia também conta para o bem-estar."],
    energy: {
      none: ["Sem energia", "Custa-me começar o dia"],
      tired: ["Um pouco cansada", "Um pouco cansado", "Algum cansaço", "Estou mais lenta do que o normal", "Estou mais lento do que o normal", "Estou a mover-me mais devagar do que o normal"],
      normal: ["Normal", "Como um dia comum"],
      well: ["Bastante bem", "Tenho vontade de fazer coisas"],
      high: ["Com muita energia", "Sinto-me ativa e desperta", "Sinto-me ativo e desperto", "Sinto-me com energia e clareza"],
    },
    mood: [["Alegre", "Com bom ânimo"], ["Tranquila", "Serena e estável"], ["Triste", "Um pouco em baixo"], ["Inquieta", "Com preocupação ou nervos"], ["Irritável", "Com pouca paciência"]],
    body: ["Cabeça", "Peito", "Estômago", "Costas", "Articulações", "Pernas", "Nada especial"],
    sleep: [["Muito bem", "Dormi seguido e descansei"], ["Bem", "Dormi o suficiente"], ["Regular", "Acordei várias vezes"], ["Mal", "Dormi pouco"], ["Muito mal", "Quase não descansei"]],
    symptoms: ["Dor de cabeça", "Tonturas", "Náuseas", "Sensação de febre", "Falta de ar", ["Sinto-me confusa", "Sinto-me confuso", "Sinto confusão"], "Nenhum destes"],
    social: [["Sim, bastante", "Falei ou vou estar com pessoas"], ["Um pouco", "Uma mensagem ou chamada"], ["Não muito", "Hoje sinto-me mais sozinha", "Hoje sinto-me mais sozinho", "Hoje tenho pouca companhia"]],
    analyzingTitle: "Um momento",
    loading: ["A ler as tuas respostas com calma...", "A rever o teu contexto pessoal...", "A preparar ideias úteis para hoje..."],
    resultKicker: "A leitura de hoje",
    important: "Importante",
    whyTitle: "Porque hoje",
    trendTitle: "Tendência",
    planTitle: "Plano adaptado",
    suggestionTitle: "Próximo passo",
    rightNow: "Agora mesmo",
    today: "Para hoje",
    appHelpTitle: "A VYVA pode ajudar agora",
    appHelpText: "Escolhe o próximo passo na app, sem teres de procurar.",
    readResult: "Ver a minha leitura",
    thanks: "Obrigado por fazeres isto. Este pequeno hábito ajuda a VYVA a cuidar melhor de ti todos os dias.",
    share: "Partilhar resultado",
    done: "Obrigado, VYVA",
    repeat: "Repetir check-in",
    shareTitle: "A minha leitura VYVA de hoje",
    copied: "Resultado copiado para partilhar.",
    shareFailed: "Não consegui partilhar o resultado agora.",
    fallbackToast: "Preparei uma leitura local porque a ligação não respondeu a tempo.",
    shareFor: "Leitura VYVA de hoje para",
    me: "mim",
    note: "Tem em conta",
    appActions: {
      care: ["Procurar assistência médica", "Se piorar, ou houver dor no peito, falta de ar ou confusão, não esperes."],
      symptom: ["Fazer cheque de sintomas", "A VYVA guia-te com perguntas claras e ajuda a decidir o próximo passo."],
      vitals: ["Medir sinais vitais", "Faz uma leitura rápida para registar pulso e respiração."],
      concierge: ["Ver Para ti hoje", "Encontra uma ideia próxima, adaptada à tua energia e mobilidade."],
    },
  },
} as const;

function copyFor(language?: string) {
  const base = (language ?? "es").split("-")[0].toLowerCase() as WizardLocale;
  return CHECKIN_LAUNCH_TEXT[base] ?? CHECKIN_LAUNCH_TEXT.es;
}

function inferGender(profile: { gender?: string } | null, firstName: string): GrammaticalGender {
  const raw = profile?.gender?.toLowerCase().trim();
  if (raw && ["male", "masculino", "hombre", "m"].includes(raw)) return "male";
  if (raw && ["female", "femenino", "mujer", "f"].includes(raw)) return "female";

  const first = firstName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const maleNames = new Set(["carlos", "karim", "marco", "jose", "antonio", "manuel", "juan", "miguel", "luis", "javier", "david", "daniel", "pedro", "rafael", "francisco", "pablo", "sergio", "jorge"]);
  const femaleNames = new Set(["carmen", "maria", "ana", "lucia", "isabel", "pilar", "laura", "marta", "elena", "sofia", "paula", "teresa", "rosa", "dolores", "julia"]);
  if (maleNames.has(first)) return "male";
  if (femaleNames.has(first)) return "female";
  if (first.endsWith("a") && !["luca", "sasha", "elias"].includes(first)) return "female";
  if (first.endsWith("o") || first.endsWith("os")) return "male";
  return "neutral";
}

function gendered(gender: GrammaticalGender, female: string, male: string, neutral: string) {
  if (gender === "female") return female;
  if (gender === "male") return male;
  return neutral;
}

function energyOptionsFor(gender: GrammaticalGender): SingleOption[] {
  return [
    { id: "1", value: 1, icon: "🌙", label: "Sin energía", helper: "Me cuesta empezar el día" },
    {
      id: "2",
      value: 2,
      icon: "☁️",
      label: gendered(gender, "Algo cansada", "Algo cansado", "Algo de cansancio"),
      helper: gendered(gender, "Voy más lenta de lo normal", "Voy más lento de lo normal", "Voy más despacio de lo normal"),
    },
    { id: "3", value: 3, icon: "🌤️", label: "Normal", helper: "Como un día corriente" },
    { id: "4", value: 4, icon: "☀️", label: "Bastante bien", helper: "Tengo ganas de hacer cosas" },
    {
      id: "5",
      value: 5,
      icon: "✨",
      label: "Con mucha energía",
      helper: gendered(gender, "Me siento activa y despierta", "Me siento activo y despierto", "Me siento con energía y claridad"),
    },
  ];
}

function symptomOptionsFor(gender: GrammaticalGender): SingleOption[] {
  return [
    ...symptomOptionsBase.slice(0, 5),
    { id: "confusion", icon: "❔", label: gendered(gender, "Me siento confundida", "Me siento confundido", "Siento confusión") },
    symptomOptionsBase[5],
  ];
}

function socialOptionsFor(gender: GrammaticalGender): SingleOption[] {
  return [
    ...socialOptionsBase,
    { id: "no", icon: "🕯️", label: "No mucho", helper: gendered(gender, "Hoy estoy más sola", "Hoy estoy más solo", "Hoy tengo poca compañía") },
  ];
}

function localizedEnergyOptionsFor(gender: GrammaticalGender, copy: ReturnType<typeof copyFor>): SingleOption[] {
  const c = copy.energy;
  return [
    { id: "1", value: 1, icon: "🌙", label: c.none[0], helper: c.none[1] },
    { id: "2", value: 2, icon: "☁️", label: gendered(gender, c.tired[0], c.tired[1], c.tired[2]), helper: gendered(gender, c.tired[3], c.tired[4], c.tired[5]) },
    { id: "3", value: 3, icon: "🌤️", label: c.normal[0], helper: c.normal[1] },
    { id: "4", value: 4, icon: "☀️", label: c.well[0], helper: c.well[1] },
    { id: "5", value: 5, icon: "✨", label: c.high[0], helper: gendered(gender, c.high[1], c.high[2], c.high[3]) },
  ];
}

function localizedMoodOptionsFor(copy: ReturnType<typeof copyFor>): SingleOption[] {
  return [
    { id: "alegre", icon: "😊", label: copy.mood[0][0], helper: copy.mood[0][1] },
    { id: "tranquila", icon: "🌿", label: copy.mood[1][0], helper: copy.mood[1][1] },
    { id: "triste", icon: "💧", label: copy.mood[2][0], helper: copy.mood[2][1] },
    { id: "ansiosa", icon: "🌀", label: copy.mood[3][0], helper: copy.mood[3][1] },
    { id: "irritable", icon: "⚡", label: copy.mood[4][0], helper: copy.mood[4][1] },
  ];
}

function localizedBodyOptionsFor(copy: ReturnType<typeof copyFor>): SingleOption[] {
  return [
    { id: "cabeza", icon: "🧠", label: copy.body[0] },
    { id: "pecho", icon: "💛", label: copy.body[1] },
    { id: "estomago", icon: "🍵", label: copy.body[2] },
    { id: "espalda", icon: "🪑", label: copy.body[3] },
    { id: "articulaciones", icon: "🦴", label: copy.body[4] },
    { id: "piernas", icon: "🦵", label: copy.body[5] },
    { id: "ninguno", icon: "👌", label: copy.body[6] },
  ];
}

function localizedSleepOptionsFor(copy: ReturnType<typeof copyFor>): SingleOption[] {
  return [
    { id: "muy_bien", icon: "🌅", label: copy.sleep[0][0], helper: copy.sleep[0][1] },
    { id: "bien", icon: "🌙", label: copy.sleep[1][0], helper: copy.sleep[1][1] },
    { id: "regular", icon: "☕", label: copy.sleep[2][0], helper: copy.sleep[2][1] },
    { id: "mal", icon: "🌧️", label: copy.sleep[3][0], helper: copy.sleep[3][1] },
    { id: "muy_mal", icon: "🛌", label: copy.sleep[4][0], helper: copy.sleep[4][1] },
  ];
}

function localizedSymptomOptionsFor(gender: GrammaticalGender, copy: ReturnType<typeof copyFor>): SingleOption[] {
  const confusion = copy.symptoms[5];
  const confusionText = Array.isArray(confusion) ? confusion : ["Me siento confundida", "Me siento confundido", "Siento confusión"];
  return [
    { id: "dolor_cabeza", icon: "🤕", label: copy.symptoms[0] as string },
    { id: "mareo", icon: "🌀", label: copy.symptoms[1] as string },
    { id: "nauseas", icon: "🍵", label: copy.symptoms[2] as string },
    { id: "fiebre", icon: "🌡️", label: copy.symptoms[3] as string },
    { id: "falta_aire", icon: "🫁", label: copy.symptoms[4] as string },
    { id: "confusion", icon: "❔", label: gendered(gender, confusionText[0], confusionText[1], confusionText[2]) },
    { id: "ninguno", icon: "👌", label: copy.symptoms[6] as string },
  ];
}

function symptomDetailCopyFor(copy: ReturnType<typeof copyFor>) {
  if (copy === CHECKIN_TEXT.es) {
    return {
      title: "Afinemos un poco mas",
      subtitle: "Solo una pregunta extra para entender mejor lo que notas.",
    };
  }
  return {
    title: "Let's narrow it down",
    subtitle: "One extra check helps VYVA understand what you are noticing.",
  };
}

function symptomDetailOptionsFor(answers: Answers, copy: ReturnType<typeof copyFor>): SingleOption[] {
  const spanish = copy === CHECKIN_TEXT.es;
  const options: SingleOption[] = [];
  const add = (id: string, icon: string, labelEs: string, helperEs: string, labelEn: string, helperEn: string) => {
    options.push({
      id,
      icon,
      label: spanish ? labelEs : labelEn,
      helper: spanish ? helperEs : helperEn,
    });
  };

  if (answers.symptoms.includes("fiebre")) {
    add("fever_temp_38", "🌡️", "Tengo 38 grados o mas", "O lo he medido con termometro.", "I have 38C or higher", "Measured with a thermometer.");
    add("fever_temp_39", "🚩", "Tengo 39 grados o mas", "O fiebre alta que preocupa.", "I have 39C or higher", "High fever or concerning fever.");
    add("fever_unmeasured", "❔", "No la he medido", "Solo noto sensacion de fiebre.", "I have not measured it", "It just feels like fever.");
  }

  if (answers.symptoms.includes("falta_aire")) {
    add("breath_rest", "🚨", "Me falta el aire en reposo", "Aunque este sentado o quieto.", "Short of breath at rest", "Even sitting or staying still.");
    add("breath_speaking", "🫁", "Me cuesta hablar frases completas", "Tengo que parar para respirar.", "Hard to speak full sentences", "I need to pause for breath.");
    add("breath_exertion", "🚶", "Solo al moverme", "Aparece con esfuerzo o al caminar.", "Only when moving", "It appears with effort or walking.");
  }

  if (answers.symptoms.includes("mareo")) {
    add("dizzy_faint", "🚩", "Siento que podria desmayarme", "O he estado a punto de caer.", "I feel I might faint", "Or nearly fell.");
    add("dizzy_standing", "↕️", "Empeora al levantarme", "Sobre todo al ponerme de pie.", "Worse when standing", "Especially when getting up.");
    add("dizzy_mild", "🌿", "Es leve y estable", "Lo noto, pero no aumenta.", "Mild and stable", "I notice it, but it is not increasing.");
  }

  if (answers.symptoms.includes("nauseas")) {
    add("nausea_vomiting", "🚩", "He vomitado o no retengo liquidos", "Esto puede deshidratar.", "Vomiting or cannot keep fluids down", "This can dehydrate.");
    add("nausea_can_drink", "💧", "Puedo beber pequenos sorbos", "Aunque tenga nauseas.", "I can sip fluids", "Even with nausea.");
  }

  if (answers.symptoms.includes("dolor_cabeza") || answers.body_areas.includes("cabeza")) {
    add("headache_sudden", "🚩", "Dolor de cabeza muy fuerte o repentino", "Diferente a lo habitual.", "Sudden or very severe headache", "Different from usual.");
    add("headache_vision", "👁️", "Viene con vision rara o debilidad", "O dificultad para hablar.", "With vision changes or weakness", "Or trouble speaking.");
    add("headache_mild", "🌿", "Es parecido a otros dolores", "Molesto, pero reconocible.", "Similar to previous headaches", "Uncomfortable but familiar.");
  }

  if (answers.body_areas.includes("pecho")) {
    add("chest_pressure_detail", "🚨", "Presion, opresion o dolor en el pecho", "Aunque vaya y venga.", "Chest pressure, tightness, or pain", "Even if it comes and goes.");
    add("chest_mild_detail", "🌿", "Molestia leve y localizada", "No va a mas ahora mismo.", "Mild localized discomfort", "Not getting worse right now.");
  }

  if (answers.symptoms.includes("confusion")) {
    add("confusion_now_detail", "🚨", "Me siento confuso ahora", "Me cuesta pensar, hablar o orientarme.", "I feel confused now", "It is hard to think, speak, or orient myself.");
    add("confusion_passed_detail", "🌿", "Fue un momento y ya paso", "Lo marco para que conste.", "It passed", "I am noting it so VYVA knows.");
  }

  return options;
}

function needsSymptomDetails(answers: Answers) {
  return symptomDetailOptionsFor(answers, CHECKIN_TEXT.es).length > 0;
}

function localizedSocialOptionsFor(gender: GrammaticalGender, copy: ReturnType<typeof copyFor>): SingleOption[] {
  return [
    { id: "mucho", icon: "🤝", label: copy.social[0][0], helper: copy.social[0][1] },
    { id: "algo", icon: "💬", label: copy.social[1][0], helper: copy.social[1][1] },
    { id: "no", icon: "🕯️", label: copy.social[2][0], helper: gendered(gender, copy.social[2][1], copy.social[2][2], copy.social[2][3]) },
  ];
}

function progressFor(step: StepId) {
  const index = QUESTION_STEPS.indexOf(step);
  return index === -1 ? 0 : ((index + 1) / QUESTION_STEPS.length) * 100;
}

function needsSafetyFollowup(answers: Answers) {
  return (
    answers.symptoms.includes("falta_aire") ||
    answers.symptoms.includes("confusion") ||
    answers.symptoms.includes("mareo") ||
    answers.body_areas.includes("pecho")
  );
}

function hasUrgentSafetyFlag(answers: Answers) {
  const urgentSafety = answers.safety_flags.some((flag) =>
    ["severe_now", "chest_pressure", "confusion_now", "sudden_weakness"].includes(flag)
  );
  const urgentDetails = answers.symptom_details.some((detail) =>
    [
      "fever_temp_39",
      "breath_rest",
      "breath_speaking",
      "dizzy_faint",
      "nausea_vomiting",
      "headache_sudden",
      "headache_vision",
      "chest_pressure_detail",
      "confusion_now_detail",
    ].includes(detail)
  );
  return urgentSafety || urgentDetails;
}

function hasHealthPrioritySignal(answers: Answers) {
  return (
    hasUrgentSafetyFlag(answers) ||
    answers.symptoms.includes("falta_aire") ||
    answers.symptoms.includes("confusion") ||
    answers.body_areas.includes("pecho")
  );
}

function forceHealthPriorityResult(
  result: CheckinResult,
  answers: Answers,
  name: string,
  gender: GrammaticalGender,
  copy: ReturnType<typeof copyFor>,
): CheckinResult {
  if (!hasHealthPrioritySignal(answers)) return result;

  const urgent = hasUrgentSafetyFlag(answers);
  const isSpanish = copy === CHECKIN_TEXT.es;
  const addressedName = name || (isSpanish ? "cariño" : "dear");

  if (isSpanish) {
    return {
      ...result,
      feeling_label: urgent ? "Prioridad de salud" : "Señal para revisar",
      overall_state: urgent ? "low" : "moderate",
      vyva_reading: `${addressedName}, gracias por contarmelo. La falta de aire, el pecho o la confusion merecen atencion y calma.`,
      highlight: urgent
        ? "Busca ayuda medica si sigue, empeora o aparece dolor, confusion o debilidad."
        : "Primero conviene revisar la señal; despues pensamos en planes agradables.",
      why_today: "Has marcado una señal que puede ser importante. Lo mas prudente es revisar como evoluciona y actuar si continua o empeora.",
      trend_note: result.trend_note ?? null,
      personal_plan: urgent
        ? "Quedate acompañado, evita esfuerzo y busca atencion medica si la sensacion continua o aumenta."
        : "Haz primero el chequeo de sintomas y, si puedes, toma signos vitales. Si mejora y no te preocupa, despues puedes elegir un plan tranquilo.",
      app_suggestion: urgent
        ? "El siguiente paso es buscar atencion medica si la falta de aire continua, empeora o viene con dolor, confusion o debilidad."
        : "El siguiente paso es abrir el chequeo de sintomas y tomar signos vitales antes de decidir que hacer.",
      suggested_app_action: urgent ? "care" : "symptom",
      right_now: [
        gendered(gender, "Sientate y evita caminar sola ahora.", "Sientate y evita caminar solo ahora.", "Sientate y evita caminar sin compañia ahora."),
        "Avisa a alguien cercano para que este pendiente.",
        urgent ? "Si cuesta respirar o hay dolor en el pecho, busca ayuda urgente." : "Abre el chequeo de sintomas o toma signos vitales.",
      ],
      today_actions: [
        "No hagas planes de ocio hasta revisar esta señal.",
        "Anota cuando empezo y si mejora o empeora.",
        "Si vuelve, aumenta o te asusta, busca atencion medica.",
      ],
      flag_caregiver: true,
      watch_for: "Si hay falta de aire que no cede, dolor o presion en el pecho, confusion, debilidad repentina o empeoramiento rapido, busca ayuda urgente.",
    };
  }

  return {
    ...result,
    feeling_label: urgent ? "Health priority" : "Signal to check",
    overall_state: urgent ? "low" : "moderate",
      vyva_reading: `${addressedName}, thank you for telling me. Breathlessness, chest symptoms, or confusion deserve attention and calm.`,
    highlight: urgent
      ? "Seek medical help if it continues, worsens, or comes with pain, confusion, or weakness."
      : "First check the signal; pleasant plans can wait until it feels safe.",
    why_today: "You selected a signal that can matter. The sensible next step is to check how it develops and act if it continues or worsens.",
    trend_note: result.trend_note ?? null,
    personal_plan: urgent
      ? "Stay with someone, avoid effort, and seek medical attention if the sensation continues or grows."
      : "Do the symptom check first and, if you can, take vital signs. If it improves and does not worry you, choose a quiet plan later.",
    app_suggestion: urgent
      ? "The next step is medical attention if breathlessness continues, worsens, or comes with pain, confusion, or weakness."
      : "The next step is the symptom check and vital signs before deciding what to do.",
    suggested_app_action: urgent ? "care" : "symptom",
    right_now: [
      "Sit down and avoid walking alone for now.",
      "Tell someone nearby so they can keep an eye on you.",
      urgent ? "If breathing is difficult or there is chest pain, seek urgent help." : "Open the symptom check or take vital signs.",
    ],
    today_actions: [
      "Do not make leisure plans until this signal is checked.",
      "Note when it started and whether it improves or worsens.",
      "If it returns, increases, or worries you, seek medical attention.",
    ],
    flag_caregiver: true,
    watch_for: "If breathlessness does not settle, or there is chest pressure, confusion, sudden weakness, or rapid worsening, seek urgent help.",
  };
}

function activeQuestionSteps(includeSafety: boolean, includeDetails: boolean) {
  return QUESTION_STEPS.filter((item) => {
    if (item === "safety" && !includeSafety) return false;
    if (item === "details" && !includeDetails) return false;
    return true;
  });
}

function progressForActive(step: StepId, includeSafety: boolean, includeDetails: boolean) {
  const steps = activeQuestionSteps(includeSafety, includeDetails);
  const index = steps.indexOf(step);
  return index === -1 ? 0 : ((index + 1) / steps.length) * 100;
}

function safetyCopyFor(copy: ReturnType<typeof copyFor>) {
  if (copy === CHECKIN_TEXT.es) {
    return {
      title: "Antes de seguir, ¿cómo es esa señal?",
      subtitle: "Solo para valorar si conviene actuar ya o si podemos leerlo con calma.",
      options: [
        { id: "severe_now", icon: "🚨", label: "Es fuerte o está empeorando", helper: "Me cuesta respirar, hablar o moverme con normalidad" },
        { id: "chest_pressure", icon: "❤️", label: "Hay presión o dolor en el pecho", helper: "Aunque sea intermitente o incómodo" },
        { id: "confusion_now", icon: "❔", label: "Me noto confuso o desorientado", helper: "Me cuesta pensar claro o expresarme" },
        { id: "sudden_weakness", icon: "⚠️", label: "Hay debilidad repentina", helper: "En cara, brazo, pierna o al hablar" },
        { id: "mild_stable", icon: "🌿", label: "Es leve y estable", helper: "Lo noto, pero no va a más ahora mismo" },
        { id: "resolved", icon: "👌", label: "Ya se ha pasado", helper: "Lo marco para que VYVA lo tenga en cuenta" },
      ],
    };
  }

  return {
    title: "Before we continue, what is it like?",
    subtitle: "This helps VYVA tell whether to act now or read it calmly.",
    options: [
      { id: "severe_now", icon: "🚨", label: "It is strong or getting worse", helper: "Breathing, speaking, or moving feels difficult" },
      { id: "chest_pressure", icon: "❤️", label: "There is chest pressure or pain", helper: "Even if it comes and goes" },
      { id: "confusion_now", icon: "❔", label: "I feel confused or disoriented", helper: "It is hard to think clearly or speak" },
      { id: "sudden_weakness", icon: "⚠️", label: "There is sudden weakness", helper: "Face, arm, leg, or speech feels affected" },
      { id: "mild_stable", icon: "🌿", label: "It is mild and stable", helper: "I notice it, but it is not getting worse now" },
      { id: "resolved", icon: "👌", label: "It has passed", helper: "VYVA should still take it into account" },
    ],
  };
}

function localResult(name: string, answers: Answers, gender: GrammaticalGender): CheckinResult {
  const energy = answers.energy_level ?? 3;
  const lowEnergy = energy <= 2;
  const strongEnergy = energy >= 4;
  const lowMood = answers.mood === "triste" || answers.mood === "ansiosa";
  const unsettledMood = answers.mood === "ansiosa" || answers.mood === "irritable";
  const poorSleep = answers.sleep_quality === "mal" || answers.sleep_quality === "muy_mal";
  const lightSleep = answers.sleep_quality === "regular";
  const goodSleep = answers.sleep_quality === "bien" || answers.sleep_quality === "muy_bien";
  const noBodyNotes = answers.body_areas.includes("ninguno") || answers.body_areas.length === 0;
  const noSymptoms = answers.symptoms.includes("ninguno") || answers.symptoms.length === 0;
  const has = (id: string) => answers.symptoms.includes(id) || answers.body_areas.includes(id);
  const urgentSafetyFlag = answers.safety_flags.some((flag) =>
    ["severe_now", "chest_pressure", "confusion_now", "sudden_weakness"].includes(flag)
  );
  const mildSafetySignal = answers.safety_flags.includes("mild_stable") || answers.safety_flags.includes("resolved");
  const seriousSymptom = has("falta_aire") || has("pecho") || has("confusion");
  const safetySignal = urgentSafetyFlag || (seriousSymptom && !mildSafetySignal);
  const dizzy = has("mareo");
  const feverish = has("fiebre");
  const stomach = has("estomago") || has("nauseas");
  const headache = has("cabeza") || has("dolor_cabeza");
  const joints = has("espalda") || has("articulaciones") || has("piernas");
  const alone = answers.social_contact === "no";

  if (safetySignal) {
    return {
      feeling_label: gendered(gender, "Un día para estar acompañada", "Un día para estar acompañado", "Un día para tener compañía"),
      overall_state: "low",
      vyva_reading: `${name || "Cariño"}, gracias por decírmelo. Algunas respuestas merecen atención y hoy no conviene esperar en silencio.`,
      right_now: [
        gendered(gender, "Siéntate en una postura cómoda y evita caminar sola ahora.", "Siéntate en una postura cómoda y evita caminar solo ahora.", "Siéntate en una postura cómoda y evita caminar sin compañía ahora."),
        "Avisa a alguien cercano para que esté pendiente de ti.",
        "Si la molestia en el pecho, la confusión o la falta de aire continúa, pide ayuda urgente.",
      ],
      today_actions: [
        "Mantente cerca del teléfono y no hagas esfuerzos.",
        "Anota a qué hora empezó lo que notas.",
        "Si empeora o te asusta, usa el chequeo de síntomas o busca atención médica.",
      ],
      highlight: "Lo importante hoy es seguridad, compañía y observar si mejora pronto.",
      suggested_app_action: "care",
      flag_caregiver: true,
      watch_for: "Si notas falta de aire, dolor en el pecho, confusión intensa o empeoramiento rápido, busca ayuda urgente. VYVA también puede abrir el chequeo de síntomas.",
    };
  }

  if (strongEnergy && !lowMood && goodSleep && noBodyNotes && noSymptoms) {
    return {
      feeling_label: "Un día con buen impulso",
      overall_state: "excellent",
      vyva_reading: `${name || "Cariño"}, hoy tus respuestas suenan estables y con buena energía. Es un buen día para hacer algo agradable sin llenarlo demasiado.`,
      right_now: [
        "Elige una actividad sencilla que te apetezca de verdad.",
        "Toma agua antes de salir o empezar.",
        "Reserva un momento tranquilo para después.",
      ],
      today_actions: [
        "Mira Para ti hoy en Concierge para elegir un plan cercano y adaptado.",
        "Pide a VYVA que prepare transporte si decides salir.",
        "Para antes de cansarte, aunque te sientas bien.",
      ],
      highlight: "Tienes margen para disfrutar, manteniendo un ritmo amable.",
      flag_caregiver: false,
      watch_for: null,
    };
  }

  if (poorSleep) {
    return {
      feeling_label: "Un día de recuperar descanso",
      overall_state: lowEnergy ? "tired" : "moderate",
      vyva_reading: `${name || "Cariño"}, dormir poco cambia mucho el cuerpo y el ánimo. Hoy conviene bajar el ritmo y cuidar lo básico.`,
      right_now: [
        "Bebe agua y toma algo ligero si no has desayunado.",
        gendered(gender, "Haz una pausa sentada durante unos minutos.", "Haz una pausa sentado durante unos minutos.", "Haz una pausa con calma durante unos minutos."),
        "Deja para mas tarde cualquier tarea que no sea urgente.",
      ],
      today_actions: [
        "Busca luz natural suave durante un rato.",
        "Evita una siesta larga; mejor un descanso corto.",
        alone ? "Haz una llamada breve a alguien de confianza." : "Elige una idea tranquila en Para ti hoy si te apetece algo suave.",
      ],
      highlight: "Tu cuerpo está pidiendo recuperar energía, no demostrar fuerza.",
      suggested_app_action: dizzy ? "vitals" : "meditation",
      flag_caregiver: lowEnergy && lowMood,
      watch_for: dizzy ? "Si el mareo se repite, aumenta o viene con debilidad fuerte, avisa a alguien y consulta." : null,
    };
  }

  if (stomach) {
    return {
      feeling_label: "Un día para cuidar el estómago",
      overall_state: "moderate",
      vyva_reading: `${name || "Cariño"}, hoy tu cuerpo parece pedir calma digestiva y un plan sencillo, sin prisas ni comidas pesadas.`,
      right_now: [
        "Toma pequeños sorbos de agua.",
        "Elige comida suave si tienes hambre.",
        gendered(gender, "Descansa sentada y evita moverte rápido.", "Descansa sentado y evita moverte rápido.", "Descansa en una postura cómoda y evita moverte rápido."),
      ],
      today_actions: [
        "Observa si las náuseas mejoran después de hidratarte.",
        "Evita comidas muy grasas o abundantes hoy.",
        "Si no mejora, usa el chequeo de síntomas para decidir el siguiente paso.",
      ],
      highlight: "Hoy ayuda más la suavidad que intentar seguir como siempre.",
      flag_caregiver: lowEnergy && alone,
      watch_for: feverish ? "Si hay fiebre, vómitos persistentes o dolor fuerte, usa el chequeo de síntomas y considera atención médica." : null,
    };
  }

  if (headache || dizzy) {
    return {
      feeling_label: dizzy ? "Un día para ir con cuidado" : "Un día de bajar estímulos",
      overall_state: "moderate",
      vyva_reading: `${name || "Cariño"}, tus respuestas apuntan a que hoy conviene reducir ruido, pantallas y movimientos bruscos.`,
      right_now: [
        "Bebe agua y sientate un momento.",
        "Evita levantarte deprisa.",
        "Busca un sitio tranquilo con poca luz si puedes.",
      ],
      today_actions: [
        gendered(gender, "Haz solo desplazamientos necesarios y evita salir sola si te notas inestable.", "Haz solo desplazamientos necesarios y evita salir solo si te notas inestable.", "Haz solo desplazamientos necesarios y evita salir sin compañía si te notas inestable."),
        "Pide ayuda con tareas que requieran esfuerzo.",
        "Si no mejora, revisa tus signos vitales o inicia el chequeo de síntomas.",
      ],
      highlight: "Ir despacio hoy es una decisión inteligente.",
      flag_caregiver: dizzy && lowEnergy,
      watch_for: dizzy ? "Si el mareo continúa, aparece debilidad o te cuesta hablar, busca ayuda enseguida y usa el chequeo de síntomas si puedes hacerlo con calma." : null,
    };
  }

  if (joints) {
    return {
      feeling_label: "Un día de movimiento suave",
      overall_state: lowEnergy ? "tired" : "moderate",
      vyva_reading: `${name || "Cariño"}, hoy parece mejor proteger el cuerpo y elegir movimientos pequeños, seguros y sin prisa.`,
      right_now: [
        "Cambia de postura despacio.",
        "Evita cargar peso o subir muchas escaleras.",
        "Prepara lo que necesites cerca para moverte menos.",
      ],
      today_actions: [
        "Busca en Para ti hoy una actividad sentada o con descansos frecuentes.",
        "Usa calzado cómodo si sales.",
        "Pide a Concierge que organice transporte si el plan merece la pena.",
      ],
      highlight: "Cuidar articulaciones y espalda hoy te ayuda a llegar mejor a la tarde.",
      flag_caregiver: false,
      watch_for: null,
    };
  }

  if (lowMood || unsettledMood || alone) {
    return {
      feeling_label: alone ? gendered(gender, "Un día para sentirte acompañada", "Un día para sentirte acompañado", "Un día para buscar compañía") : "Un día emocionalmente sensible",
      overall_state: lowEnergy ? "low" : "moderate",
      vyva_reading: `${name || "Cariño"}, hoy no todo pasa por el cuerpo. También cuenta cómo está el ánimo, y merece cuidado sencillo.`,
      right_now: [
        "Respira despacio durante un minuto.",
        "Haz una cosa pequeña que te dé sensación de orden.",
        "Si puedes, manda un mensaje corto a alguien de confianza.",
      ],
      today_actions: [
        gendered(gender, "Evita quedarte con preocupaciones dando vueltas sola.", "Evita quedarte con preocupaciones dando vueltas solo.", "Evita quedarte con preocupaciones dando vueltas sin apoyo."),
        gendered(gender, "Mira Para ti hoy para encontrar algo cercano, tranquilo y acompañado.", "Mira Para ti hoy para encontrar algo cercano, tranquilo y acompañado.", "Mira Para ti hoy para encontrar algo cercano, tranquilo y con compañía."),
        "Si te apetece, pide a VYVA que te ayude a llamar a alguien.",
      ],
      highlight: "Hoy la compañía y la calma pueden ayudar más que hacer muchas cosas.",
      suggested_app_action: alone ? "social" : "meditation",
      flag_caregiver: lowEnergy && alone,
      watch_for: answers.mood === "triste" && alone ? "Si esta tristeza se mantiene varios días o se vuelve muy pesada, conviene contárselo a alguien de confianza." : null,
    };
  }

  return {
    feeling_label: lightSleep || lowEnergy ? "Un día estable, con calma" : "Un día estable",
    overall_state: lowEnergy ? "tired" : "good",
    vyva_reading: `${name || "Cariño"}, gracias por contármelo. Tus respuestas no señalan nada fuerte, pero hoy conviene escucharte y mantener un ritmo claro.`,
    right_now: [
      "Bebe un vaso de agua despacio.",
      "Elige una tarea pequeña y fácil para empezar.",
      "Haz una pausa breve antes de pasar a lo siguiente.",
    ],
    today_actions: [
      "Mira Para ti hoy en Concierge para una idea local y adaptada.",
      "Mantén planes sencillos y deja margen para descansar.",
      "Habla con alguien cercano si te apetece compañía.",
    ],
    highlight: lightSleep ? "Dormiste regular, así que te irá mejor un día sin prisas." : "Tu cuerpo agradece un ritmo amable y bien elegido.",
    flag_caregiver: lowEnergy && lowMood,
    watch_for: null,
  };
}

function enrichLocalResult(result: CheckinResult, answers: Answers, copy: ReturnType<typeof copyFor>): CheckinResult {
  const hasSymptoms = answers.symptoms.some((item) => item !== "ninguno") || answers.body_areas.some((item) => item !== "ninguno");
  const lowEnergy = (answers.energy_level ?? 3) <= 2;
  const poorSleep = ["mal", "muy_mal"].includes(answers.sleep_quality ?? "");
  const lowMood = answers.mood === "triste" || answers.mood === "ansiosa";
  const alone = answers.social_contact === "no";
  const safetySignal =
    answers.safety_flags.some((flag) => ["severe_now", "chest_pressure", "confusion_now", "sudden_weakness"].includes(flag)) ||
    answers.symptoms.includes("falta_aire") ||
    answers.symptoms.includes("confusion") ||
    answers.body_areas.includes("pecho");

  return {
    ...result,
    why_today: result.why_today ?? (
      copy === CHECKIN_TEXT.es
        ? [
            lowEnergy ? "La energía baja cambia qué planes convienen hoy." : null,
            poorSleep ? "El descanso flojo puede hacer que el cuerpo necesite un ritmo más amable." : null,
            hasSymptoms ? "También he tenido en cuenta las señales físicas que has marcado." : null,
          ].filter(Boolean).join(" ") || "La lectura combina tus respuestas con tu estado general de hoy."
        : [
            lowEnergy ? "Lower energy changes which plans make sense today." : null,
            poorSleep ? "Poor sleep can make the body need a kinder pace." : null,
            hasSymptoms ? "I also considered the body signals you selected." : null,
          ].filter(Boolean).join(" ") || "This reading combines your answers with how today appears overall."
    ),
    personal_plan: result.personal_plan ?? (
      copy === CHECKIN_TEXT.es
        ? "Elige una acción pequeña ahora y, si te apetece salir, usa Para ti hoy para encontrar algo cercano, real y adaptado."
        : "Choose one small action now, and if you feel like going out, use For you today to find something nearby, real, and adapted."
    ),
    app_suggestion: result.app_suggestion ?? (
      safetySignal
        ? (copy === CHECKIN_TEXT.es
            ? "El siguiente paso más útil es buscar ayuda médica si esto continúa o empeora."
            : "The most useful next step is to seek medical help if this continues or worsens.")
        : hasSymptoms
        ? (copy === CHECKIN_TEXT.es
            ? "El siguiente paso más útil es abrir el chequeo de síntomas o tomar signos vitales en VYVA."
            : "The most useful next step is to open the symptom check or take vital signs in VYVA.")
        : (copy === CHECKIN_TEXT.es
            ? "El siguiente paso más útil es mirar Para ti hoy en Concierge."
            : "The most useful next step is to look at For you today in Concierge.")
    ),
    suggested_app_action: result.suggested_app_action ?? (
      safetySignal ? "care" : hasSymptoms ? "symptom" : alone ? "social" : lowMood ? "meditation" : lowEnergy || poorSleep ? "vitals" : "concierge"
    ),
  };
}

function localizedLocalResult(name: string, answers: Answers, gender: GrammaticalGender, copy: ReturnType<typeof copyFor>): CheckinResult {
  if (copy === CHECKIN_TEXT.es) return enrichLocalResult(localResult(name, answers, gender), answers, copy);

  const has = (id: string) => answers.symptoms.includes(id) || answers.body_areas.includes(id);
  const safetySignal = has("falta_aire") || has("pecho") || has("confusion");
  const lowEnergy = (answers.energy_level ?? 3) <= 2;
  const lowMood = answers.mood === "triste" || answers.mood === "ansiosa";
  const poorSleep = answers.sleep_quality === "mal" || answers.sleep_quality === "muy_mal";
  const hasSymptoms = answers.symptoms.some((item) => item !== "ninguno") || answers.body_areas.some((item) => item !== "ninguno");

  if (safetySignal) {
    return enrichLocalResult({
      feeling_label: "A day to stay supported",
      overall_state: "low",
      vyva_reading: `${name || "Dear"}, thank you for telling me. Some of your answers deserve attention, so today it is better not to wait in silence.`,
      right_now: [
        "Sit somewhere comfortable and avoid walking without company for now.",
        "Tell someone nearby so they can keep an eye on you.",
        "If chest discomfort, confusion, or breathlessness continues, seek urgent help.",
      ],
      today_actions: [
        "Stay near your phone and avoid effort.",
        "Note when the symptom started.",
        "Use the symptom check or seek medical attention if it worsens.",
      ],
      highlight: "The priority today is safety, company, and watching whether this improves soon.",
      flag_caregiver: true,
      watch_for: "If breathlessness, chest pain, strong confusion, or rapid worsening appears, seek urgent help. VYVA can also open the symptom check.",
    }, answers, copy);
  }

  return enrichLocalResult({
    feeling_label: lowEnergy || poorSleep ? "A gentler day" : "A steady day",
    overall_state: lowEnergy || poorSleep || lowMood || hasSymptoms ? "moderate" : "good",
    vyva_reading: `${name || "Dear"}, thank you for sharing this. Today looks like a day to listen to your body and choose a clear, gentle pace.`,
    right_now: [
      "Drink a glass of water slowly.",
      "Choose one small and easy thing to begin with.",
      "Pause briefly before moving to the next thing.",
    ],
    today_actions: [
      "Look at For you today in Concierge for a nearby adapted idea.",
      "Keep plans simple and leave room to rest.",
      "Speak to someone close if you would like company.",
    ],
    highlight: "Your body will appreciate a kind, well-chosen rhythm today.",
    flag_caregiver: lowEnergy && lowMood,
    watch_for: hasSymptoms ? "If something worsens or worries you, use the symptom check, take vital signs if you can, and seek medical attention if it feels urgent." : null,
  }, answers, copy);
}

function appActionsFor(answers: Answers, result: CheckinResult): AppAction[] {
  const hasSymptom = (id: string) => answers.symptoms.includes(id) || answers.body_areas.includes(id);
  const urgentSafetyFlag = answers.safety_flags.some((flag) =>
    ["severe_now", "chest_pressure", "confusion_now", "sudden_weakness"].includes(flag)
  );
  const mildSafetySignal = answers.safety_flags.includes("mild_stable") || answers.safety_flags.includes("resolved");
  const safetySignal = urgentSafetyFlag || ((hasSymptom("falta_aire") || hasSymptom("pecho") || hasSymptom("confusion")) && !mildSafetySignal);
  const symptomSignal =
    safetySignal ||
    ["mareo", "nauseas", "fiebre", "dolor_cabeza"].some(hasSymptom) ||
    answers.symptoms.some((item) => item !== "ninguno");
  const outingFriendly =
    !safetySignal &&
    (answers.energy_level ?? 3) >= 3 &&
    !["mal", "muy_mal"].includes(answers.sleep_quality ?? "") &&
    !["pecho", "falta_aire", "mareo", "confusion"].some(hasSymptom);

  const actions: AppAction[] = [];
  const defaultAction = (key: AppAction["key"], primary = false): AppAction => {
    switch (key) {
      case "care":
        return {
          key,
          title: "Buscar atención médica",
          description: "Si empeora, hay dolor en el pecho, falta de aire o confusión, no esperes.",
          to: "/health",
          primary,
        };
      case "symptom":
        return {
          key,
          title: "Hacer chequeo de síntomas",
          description: "VYVA te guía con preguntas claras y te ayuda a decidir el siguiente paso.",
          to: "/health/symptom-check",
          primary,
        };
      case "vitals":
        return {
          key,
          title: "Tomar signos vitales",
          description: "Haz un escaneo rápido para registrar pulso y respiración antes de decidir.",
          to: "/health/vitals",
          primary,
        };
      case "meditation":
        return {
          key,
          title: "Hacer una pausa guiada",
          description: "Abre respiración o meditación para bajar estímulos sin quedarte solo con la idea.",
          to: "/activities",
          primary,
        };
      case "social":
        return {
          key,
          title: "Entrar en Social Spaces",
          description: "Encuentra una sala o una conexión tranquila para sentir compañía real.",
          to: "/social-rooms",
          primary,
        };
      case "music":
        return {
          key,
          title: "Explorar música con VYVA",
          description: "VYVA puede recomendar artistas, historias y piezas adaptadas a tu ánimo.",
          to: "/chat?q=Recomiendame%20musica%20clasica%20suave%20para%20hoy%20y%20cuentame%20algo%20interesante%20sobre%20los%20compositores",
          primary,
        };
      case "exercise":
        return {
          key,
          title: "Ejercicios suaves",
          description: "Abre actividades para respiracion, movilidad tranquila o una sesion guiada segura.",
          to: "/activities",
          primary,
        };
      case "chess":
        return {
          key,
          title: "Jugar una partida tranquila",
          description: "Prueba ajedrez o juegos de memoria para activar la mente sin cansarte.",
          to: "/memory-games",
          primary,
        };
      case "cooking":
        return {
          key,
          title: "Idea de cocina sencilla",
          description: "Pide a VYVA una receta adaptada a tus gustos, energia y restricciones.",
          to: "/chat?q=Dame%20una%20idea%20de%20cocina%20sencilla%20adaptada%20a%20mi%20energia%20de%20hoy",
          primary,
        };
      case "art":
        return {
          key,
          title: "Explorar arte",
          description: "Abre una mini-guia visual con historias, obras y curiosidades para disfrutar hoy.",
          to: "/chat?q=Cuentame%20una%20historia%20de%20arte%20interesante%20y%20facil%20de%20disfrutar%20hoy",
          primary,
        };
      case "literature":
        return {
          key,
          title: "Club de lectura",
          description: "Entra en Social Spaces para descubrir literatura, poesia o una charla cultural.",
          to: "/social-rooms?topic=literature",
          primary,
        };
      default:
        return {
          key: "concierge",
          title: "Ver Para ti hoy",
          description: "Encuentra una salida o idea cercana, adaptada a tu energía y movilidad.",
          to: "/concierge",
          primary,
        };
    }
  };

  if (hasHealthPrioritySignal(answers)) {
    return [
      defaultAction(hasUrgentSafetyFlag(answers) ? "care" : "symptom", true),
      defaultAction("vitals"),
    ];
  }

  if (safetySignal) {
    actions.push(defaultAction("care", true));
  }

  if (symptomSignal || result.watch_for) {
    actions.push(defaultAction("symptom", !safetySignal));
  }

  if (hasSymptom("mareo") || hasSymptom("falta_aire") || hasSymptom("pecho") || (answers.energy_level ?? 3) <= 2) {
    actions.push(defaultAction("vitals"));
  }

  if (!safetySignal && (answers.mood === "ansiosa" || answers.sleep_quality === "mal" || answers.sleep_quality === "muy_mal")) {
    actions.push(defaultAction("meditation", actions.length === 0));
  }

  if (!safetySignal && (answers.social_contact === "no" || answers.mood === "triste")) {
    actions.push(defaultAction("social", actions.length === 0));
  }

  if (!safetySignal && (hasSymptom("espalda") || hasSymptom("articulaciones") || hasSymptom("piernas"))) {
    actions.push(defaultAction("exercise", actions.length === 0));
  }

  if (!safetySignal && !symptomSignal) {
    const creativeKeys: AppAction["key"][] =
      answers.social_contact === "no" || answers.mood === "triste"
        ? ["social", "literature", "art"]
        : answers.mood === "ansiosa" || answers.sleep_quality === "regular"
          ? ["meditation", "art", "literature"]
          : (answers.energy_level ?? 3) >= 4
            ? ["concierge", "chess", "cooking"]
            : ["art", "literature", "chess"];
    creativeKeys.forEach((key) => actions.push(defaultAction(key, actions.length === 0)));
  }

  if (outingFriendly || actions.length === 0) {
    actions.push(defaultAction("concierge", actions.length === 0));
  }

  const uniqueActions = (items: AppAction[]) => {
    const seen = new Set<AppAction["key"]>();
    return items.filter((action) => {
      if (seen.has(action.key)) return false;
      seen.add(action.key);
      return true;
    });
  };

  const preferred = result.suggested_app_action;
  if (preferred && !actions.some((action) => action.key === preferred)) {
    actions.unshift(defaultAction(preferred, true));
  }

  if (preferred) {
    return uniqueActions(actions)
      .map((action) => ({ ...action, primary: action.key === preferred }))
      .sort((a, b) => Number(b.key === preferred) - Number(a.key === preferred))
      .slice(0, 3);
  }

  return uniqueActions(actions).slice(0, 3);
}

function localizeAppActions(actions: AppAction[], copy: ReturnType<typeof copyFor>): AppAction[] {
  return actions.map((action) => {
    const localized = (copy.appActions as Record<string, readonly string[]>)[action.key];
    return {
      ...action,
      title: localized?.[0] ?? action.title,
      description: localized?.[1] ?? action.description,
    };
  });
}

function resultVisualFor(state: CheckinResult["overall_state"]) {
  switch (state) {
    case "excellent":
      return { icon: "✨", labelBg: "#FFFBEB", labelText: "#78350F" };
    case "good":
      return { icon: "🌤️", labelBg: "#ECFDF5", labelText: "#0A7C4E" };
    case "tired":
      return { icon: "🌙", labelBg: "#F5F3FF", labelText: "#6B21A8" };
    case "low":
      return { icon: "💙", labelBg: "#EFF6FF", labelText: "#1D4ED8" };
    default:
      return { icon: "💜", labelBg: "#F5F3FF", labelText: "#6B21A8" };
  }
}

function shareTextFor(name: string, result: CheckinResult, copy: ReturnType<typeof copyFor>) {
  const rightNow = result.right_now.slice(0, 3).map((item) => `- ${item}`).join("\n");
  const today = result.today_actions.slice(0, 3).map((item) => `- ${item}`).join("\n");
  return [
    `${copy.shareFor} ${name || copy.me}`,
    "",
    result.feeling_label,
    result.vyva_reading,
    "",
    `${copy.important}: ${result.highlight}`,
    result.why_today ? `${copy.whyTitle}: ${result.why_today}` : "",
    result.trend_note ? `${copy.trendTitle}: ${result.trend_note}` : "",
    result.personal_plan ? `${copy.planTitle}: ${result.personal_plan}` : "",
    result.app_suggestion ? `${copy.suggestionTitle}: ${result.app_suggestion}` : "",
    "",
    `${copy.rightNow}:`,
    rightNow,
    "",
    `${copy.today}:`,
    today,
    result.watch_for ? `\n${copy.note}: ${result.watch_for}` : "",
  ].filter(Boolean).join("\n");
}

function shareLinkMessageFor(name: string, result: CheckinResult, shareUrl: string, labels: ReturnType<typeof shareLabelsFor>) {
  return [
    labels.linkMessageIntro.replace("{name}", name || labels.person),
    result.feeling_label,
    result.highlight ? `${labels.keyPoint}: ${result.highlight}` : "",
    "",
    shareUrl,
    "",
    labels.medicalNote,
  ].filter(Boolean).join("\n");
}

function shareLabelsFor(copy: ReturnType<typeof copyFor>) {
  const isSpanish = copy === CHECKIN_TEXT.es;
  return isSpanish
    ? {
        title: "Compartir informe VYVA",
        subtitle: "Envia un enlace claro y privado al informe, no un bloque de texto.",
        caregiver: "Enviar al cuidador",
        doctor: "Enviar al médico",
        newContact: "Enviar a otro contacto",
        copy: "Copiar texto completo",
        copyLink: "Copiar enlace",
        openLink: "Ver informe",
        linkReady: "Enlace seguro preparado",
        linkLoading: "Preparando enlace seguro...",
        linkMessageIntro: "Te comparto la lectura VYVA de hoy para {name}.",
        person: "esta persona",
        keyPoint: "Punto clave",
        preview: "Vista previa",
        noSaved: "No hay contacto guardado",
        addContact: "AÃ±adir contacto",
        sms: "Mensaje",
        email: "Email",
        native: "Elegir app",
        copied: "Informe copiado para compartir.",
        failed: "No he podido preparar el envío ahora mismo.",
        medicalNote: "Orientativo. No sustituye una valoración médica.",
        close: "Cerrar",
      }
    : {
        title: "Share VYVA report",
        subtitle: "Send a clear private report link, not a wall of text.",
        caregiver: "Send to caregiver",
        doctor: "Send to doctor",
        newContact: "Send to another contact",
        copy: "Copy full text",
        copyLink: "Copy link",
        openLink: "View report",
        linkReady: "Secure link ready",
        linkLoading: "Preparing secure link...",
        linkMessageIntro: "I am sharing today's VYVA reading for {name}.",
        person: "this person",
        keyPoint: "Key point",
        preview: "Preview",
        noSaved: "No saved contact",
        addContact: "Add contact",
        sms: "Message",
        email: "Email",
        native: "Choose app",
        copied: "Report copied to share.",
        failed: "I could not prepare sharing right now.",
        medicalNote: "For guidance only. Not a medical assessment.",
        close: "Close",
      };
}

function contactChannel(value: string): ShareTarget["channel"] {
  return value.includes("@") ? "email" : "sms";
}

function contactDetail(value: string, labels: ReturnType<typeof shareLabelsFor>) {
  return `${contactChannel(value) === "email" ? labels.email : labels.sms} · ${value}`;
}

function buildShareTargets(
  profile: { caregiverName?: string; caregiverContact?: string } | null,
  members: CareTeamMember[],
  gpContact: GpContact | null | undefined,
  labels: ReturnType<typeof shareLabelsFor>,
): ShareTarget[] {
  const targets: ShareTarget[] = [];
  const seen = new Set<string>();
  const addTarget = (target: ShareTarget) => {
    const key = `${target.kind}:${target.value ?? target.title}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(target);
  };

  if (profile?.caregiverContact?.trim()) {
    const value = profile.caregiverContact.trim();
    addTarget({
      id: "profile-caregiver",
      kind: "caregiver",
      title: profile.caregiverName?.trim() || labels.caregiver,
      detail: contactDetail(value, labels),
      value,
      channel: contactChannel(value),
    });
  }

  if (gpContact?.gp_phone?.trim()) {
    const value = gpContact.gp_phone.trim();
    addTarget({
      id: "profile-gp",
      kind: "doctor",
      title: gpContact.gp_name?.trim() || labels.doctor,
      detail: contactDetail(value, labels),
      value,
      channel: contactChannel(value),
    });
  }

  members
    .filter((member) => !["revoked", "declined", "expired"].includes(member.status))
    .forEach((member) => {
      const value = member.invitee_email || member.invitee_phone || "";
      if (!value) return;
      const isDoctor = member.role === "doctor" || member.relationship === "gp" || member.relationship === "specialist_doctor";
      const isCaregiver = member.role === "caregiver" || member.role === "carer" || member.relationship === "professional_carer";
      if (!isDoctor && !isCaregiver) return;
      addTarget({
        id: member.id,
        kind: isDoctor ? "doctor" : "caregiver",
        title: member.invitee_name || (isDoctor ? labels.doctor : labels.caregiver),
        detail: contactDetail(value, labels),
        value,
        channel: contactChannel(value),
      });
    });

  return targets;
}

async function copyReport(text: string, toast: ReturnType<typeof useToast>["toast"], labels: ReturnType<typeof shareLabelsFor>) {
  await navigator.clipboard.writeText(text);
  toast({ description: labels.copied });
}

async function shareViaNative(title: string, text: string, toast: ReturnType<typeof useToast>["toast"], labels: ReturnType<typeof shareLabelsFor>) {
  if (navigator.share) {
    await navigator.share({ title, text });
    return;
  }
  await copyReport(text, toast, labels);
}

async function createSharedReportLink(name: string, language: string, result: CheckinResult, text: string) {
  const res = await apiFetch("/api/checkins/share", {
    method: "POST",
    body: JSON.stringify({ name, language, result, text }),
  });
  if (!res.ok) throw new Error("share_failed");
  const data = await res.json() as { token: string };
  return `${window.location.origin}/shared/check-in/${data.token}`;
}

function sendReportToTarget(target: ShareTarget, subject: string, text: string) {
  if (target.channel === "email" && target.value) {
    window.location.href = `mailto:${encodeURIComponent(target.value)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    return;
  }

  if (target.channel === "sms" && target.value) {
    const separator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?";
    window.location.href = `sms:${target.value}${separator}body=${encodeURIComponent(text)}`;
  }
}

const CheckHowIFeelScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { firstName, profile } = useProfile();
  const startedAtRef = useRef(Date.now());
  const [step, setStep] = useState<StepId>("welcome");
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareUrlLoading, setShareUrlLoading] = useState(false);
  const { data: careTeamData } = useQuery<{ members: CareTeamMember[] }>({
    queryKey: ["/api/onboarding/careteam"],
    enabled: step === "result",
    staleTime: 5 * 60 * 1000,
  });
  const { data: onboardingState } = useQuery<{ profile: GpContact | null }>({
    queryKey: ["/api/onboarding/state"],
    enabled: step === "result",
    staleTime: 5 * 60 * 1000,
  });

  const name = firstName || "Carlos";
  const copy = copyFor(profile?.language);
  const shareLabels = shareLabelsFor(copy);
  const stepIndex = STEPS.indexOf(step);
  const includeSafety = needsSafetyFollowup(answers);
  const includeDetails = needsSymptomDetails(answers);
  const questionSteps = activeQuestionSteps(includeSafety, includeDetails);
  const safetyCopy = safetyCopyFor(copy);
  const detailCopy = symptomDetailCopyFor(copy);
  const canGoBack = stepIndex > 0 && step !== "analyzing" && step !== "result";
  const appActions = result ? localizeAppActions(appActionsFor(answers, result), copy) : [];
  const suggestedAction = result
    ? appActions.find((action) => action.key === result.suggested_app_action) ?? appActions[0]
    : undefined;
  const planAction = appActions.find((action) => !["care", "symptom", "vitals"].includes(action.key)) ?? suggestedAction;
  const nowAction = appActions[0];
  const todayAction = appActions[1] ?? planAction ?? suggestedAction;
  const resultVisual = result ? resultVisualFor(result.overall_state) : null;
  const healthPriority = hasHealthPrioritySignal(answers);
  const urgentHealthPriority = hasUrgentSafetyFlag(answers);
  const gender = inferGender(profile, name);
  const readoutLanguage = profile?.language ?? "es";
  const resultReadoutText = result
    ? [
        result.feeling_label,
        result.vyva_reading,
        healthPriority ? result.watch_for ?? result.highlight : result.highlight,
        result.why_today,
        result.trend_note,
        result.personal_plan,
        result.app_suggestion,
        result.right_now?.length ? `${copy.rightNow}. ${uniqueByIntent(result.right_now).slice(0, 3).join(". ")}` : "",
        result.today_actions?.length ? `${copy.today}. ${uniqueByIntent(result.today_actions).slice(0, 3).join(". ")}` : "",
        result.watch_for && !healthPriority ? result.watch_for : "",
      ].filter(Boolean).join(". ")
    : "";
  const energyOptions = localizedEnergyOptionsFor(gender, copy);
  const moodOptionsLocalized = localizedMoodOptionsFor(copy);
  const bodyOptionsLocalized = localizedBodyOptionsFor(copy);
  const sleepOptionsLocalized = localizedSleepOptionsFor(copy);
  const symptomOptions = localizedSymptomOptionsFor(gender, copy);
  const symptomDetailOptions = symptomDetailOptionsFor(answers, copy);
  const socialOptions = localizedSocialOptionsFor(gender, copy);
  const shareTargets = buildShareTargets(profile, careTeamData?.members ?? [], onboardingState?.profile, shareLabels);

  const loadingMessage = useMemo(() => {
    const messages = copy.loading;
    return messages[Math.min(Math.floor((Date.now() - startedAtRef.current) / 1800), messages.length - 1)];
  }, [copy.loading, step]);

  const goBack = () => {
    if (canGoBack) {
      if (step === "social" && !includeSafety) {
        setStep(includeDetails ? "details" : "symptoms");
        return;
      }
      if (step === "safety" && !includeDetails) {
        setStep("symptoms");
        return;
      }
      setStep(STEPS[stepIndex - 1]);
      return;
    }
    navigate("/health");
  };

  const abandonAndExit = async () => {
    try {
      await apiFetch("/api/checkins/abandon", {
        method: "POST",
        body: JSON.stringify({
          language: profile?.language ?? "es",
          duration_seconds: Math.round((Date.now() - startedAtRef.current) / 1000),
        }),
      });
    } catch {
      // Exiting should stay gentle even if persistence is unavailable.
    }
    navigate("/health");
  };

  const setSingle = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const toggleMulti = (key: "body_areas" | "symptoms" | "symptom_details" | "safety_flags", id: string) => {
    setAnswers((current) => {
      const currentValues = current[key];
      if (id === "ninguno") {
        return { ...current, [key]: currentValues.includes("ninguno") ? [] : ["ninguno"] };
      }
      const withoutNone = currentValues.filter((value) => value !== "ninguno");
      return {
        ...current,
        [key]: withoutNone.includes(id)
          ? withoutNone.filter((value) => value !== id)
          : [...withoutNone, id],
      };
    });
  };

  const continueAfterSymptoms = () => {
    if (needsSymptomDetails(answers)) {
      setAnswers((current) => ({
        ...current,
        symptom_details: current.symptom_details.filter((detail) =>
          symptomDetailOptionsFor(current, copy).some((option) => option.id === detail)
        ),
      }));
      setStep("details");
      return;
    }
    setStep(needsSafetyFollowup(answers) ? "safety" : "social");
  };

  const continueAfterDetails = () => {
    setStep(needsSafetyFollowup(answers) ? "safety" : "social");
  };

  const analyze = async () => {
    if (!answers.energy_level || !answers.mood || !answers.sleep_quality || !answers.social_contact) return;
    if (needsSymptomDetails(answers) && answers.symptom_details.length === 0) return;
    if (needsSafetyFollowup(answers) && answers.safety_flags.length === 0) return;

    setStep("analyzing");
    setShareUrl(null);
    try {
      const res = await apiFetch("/api/checkins/analyze", {
        method: "POST",
        body: JSON.stringify({
          language: profile?.language ?? "es",
          duration_seconds: Math.round((Date.now() - startedAtRef.current) / 1000),
          answers,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`${res.status}${detail ? ` ${detail.slice(0, 180)}` : ""}`);
      }
      const data = await res.json() as { result: CheckinResult };
      setResult(forceHealthPriorityResult(data.result, answers, name, gender, copy));
    } catch (err) {
      console.warn("[check-in] falling back locally", err);
      setResult(forceHealthPriorityResult(localizedLocalResult(name, answers, gender, copy), answers, name, gender, copy));
      toast({ description: copy.fallbackToast });
    } finally {
      setStep("result");
    }
  };

  const reset = () => {
    startedAtRef.current = Date.now();
    setAnswers(initialAnswers);
    setResult(null);
    setShareSheetOpen(false);
    setShareUrl(null);
    setStep("welcome");
  };

  const shareReportText = result
    ? `${shareTextFor(name, result, copy)}\n\n${shareLabels.medicalNote}`
    : "";
  const shareReportMessage = result && shareUrl
    ? shareLinkMessageFor(name, result, shareUrl, shareLabels)
    : shareReportText;

  const prepareShareUrl = async () => {
    if (!result || shareUrl || shareUrlLoading) return shareUrl;
    setShareUrlLoading(true);
    try {
      const url = await createSharedReportLink(name, profile?.language ?? "es", result, shareReportText);
      setShareUrl(url);
      return url;
    } catch {
      toast({ description: shareLabels.failed });
      return null;
    } finally {
      setShareUrlLoading(false);
    }
  };

  const openShareSheet = () => {
    setShareSheetOpen(true);
    void prepareShareUrl();
  };

  return (
    <div className="vyva-page bg-[radial-gradient(circle_at_top_left,#FFF7ED_0%,transparent_34%),linear-gradient(180deg,#FAF7F2_0%,#F6EFE7_100%)]">
      {questionSteps.includes(step) && (
        <div className="mb-4 rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-[0_10px_30px_rgba(63,45,35,0.06)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={goBack}
              className="vyva-tap flex min-h-[50px] items-center gap-2 rounded-full bg-[#F5EFE7] px-4 font-body text-[16px] font-semibold text-vyva-text-1"
            >
              <ArrowLeft size={19} />
              {copy.back}
            </button>
            <span className="rounded-full bg-vyva-purple-light px-4 py-2 font-body text-[14px] font-bold text-vyva-purple shadow-sm">
              {questionSteps.indexOf(step) + 1} {copy.stepOf} {questionSteps.length}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#EDE4DA]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-vyva-purple to-[#8B5CF6] transition-all duration-300"
              style={{ width: `${progressForActive(step, includeSafety, includeDetails)}%` }}
            />
          </div>
          <p className="mt-2 text-right font-body text-[13px] font-semibold text-vyva-text-2">
            {copy.stepHint}
          </p>
        </div>
      )}

      {step === "welcome" && (
        <section className="overflow-hidden rounded-[36px] border border-white/80 bg-white shadow-[0_16px_44px_rgba(63,45,35,0.10)]">
          <div className="relative bg-gradient-to-br from-[#FFF7ED] via-[#F5F3FF] to-white p-7 pb-6">
            <div className="absolute right-[-28px] top-[-34px] h-32 w-32 rounded-full bg-vyva-purple/10" />
            <div className="absolute bottom-[-46px] right-10 h-24 w-24 rounded-full bg-[#F59E0B]/12" />
            <div className="relative mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[28px] bg-white text-[36px] shadow-[0_12px_30px_rgba(107,33,168,0.14)]">
              💜
            </div>
            <p className="relative mb-2 font-body text-[18px] font-semibold text-vyva-text-2">{copy.hello}, {name}</p>
            <h1 className="relative mb-4 font-display text-[38px] leading-tight text-vyva-text-1">
              {copy.welcomeTitle}
            </h1>
            <p className="relative font-body text-[21px] leading-relaxed text-vyva-text-2">
              {copy.welcomeIntro}
            </p>
          </div>
          <div className="grid gap-3 p-6">
            {[
              { Icon: ShieldCheck, ...copy.cards[0] },
              { Icon: Sparkles, ...copy.cards[1] },
              { Icon: Sun, ...copy.cards[2] },
            ].map(({ Icon, title, text }) => (
              <div key={text} className="flex min-h-[82px] items-center gap-4 rounded-[24px] bg-[#FAF9F6] px-4">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-vyva-purple-light">
                  <Icon size={25} className="text-vyva-purple" />
                </span>
                <span>
                  <span className="block font-body text-[18px] font-bold text-vyva-text-1">{title}</span>
                  <span className="block font-body text-[17px] leading-snug text-vyva-text-2">{text}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="px-6 pb-6">
            <button
              onClick={() => setStep("energy")}
              className="vyva-primary-action min-h-[74px] w-full text-[21px]"
              data-testid="button-checkin-start"
            >
              {copy.start}
            </button>
            <button
              onClick={abandonAndExit}
              className="vyva-tap mt-3 min-h-[60px] w-full rounded-full font-body text-[18px] font-semibold text-vyva-text-2"
            >
              {copy.skip}
            </button>
          </div>
        </section>
      )}

      {step === "energy" && (
        <QuestionCard icon={<Battery />} title={copy.qEnergy[0]} subtitle={copy.qEnergy[1]}>
          <OptionList
            options={energyOptions}
            selected={answers.energy_level?.toString()}
            onSelect={(option) => setSingle("energy_level", option.value ?? 3)}
          />
          <NextButton disabled={!answers.energy_level} onClick={() => setStep("mood")} label={copy.next} />
        </QuestionCard>
      )}

      {step === "mood" && (
        <QuestionCard icon={<Heart />} title={copy.qMood[0]} subtitle={copy.qMood[1]}>
          <OptionList
            options={moodOptionsLocalized}
            selected={answers.mood ?? undefined}
            onSelect={(option) => setSingle("mood", option.id)}
          />
          <NextButton disabled={!answers.mood} onClick={() => setStep("body")} label={copy.next} />
        </QuestionCard>
      )}

      {step === "body" && (
        <QuestionCard icon={<UserRound />} title={copy.qBody[0]} subtitle={copy.qBody[1]}>
          <OptionList
            options={bodyOptionsLocalized}
            selectedValues={answers.body_areas}
            onSelect={(option) => toggleMulti("body_areas", option.id)}
            multi
          />
          <NextButton disabled={answers.body_areas.length === 0} onClick={() => setStep("sleep")} label={copy.next} />
        </QuestionCard>
      )}

      {step === "sleep" && (
        <QuestionCard icon={<BedDouble />} title={copy.qSleep[0]} subtitle={copy.qSleep[1]}>
          <OptionList
            options={sleepOptionsLocalized}
            selected={answers.sleep_quality ?? undefined}
            onSelect={(option) => setSingle("sleep_quality", option.id)}
          />
          <NextButton disabled={!answers.sleep_quality} onClick={() => setStep("symptoms")} label={copy.next} />
        </QuestionCard>
      )}

      {step === "symptoms" && (
        <QuestionCard icon={<Sparkles />} title={copy.qSymptoms[0]} subtitle={copy.qSymptoms[1]}>
          <OptionList
            options={symptomOptions}
            selectedValues={answers.symptoms}
            onSelect={(option) => toggleMulti("symptoms", option.id)}
            multi
          />
          <NextButton disabled={answers.symptoms.length === 0} onClick={continueAfterSymptoms} label={copy.next} />
        </QuestionCard>
      )}

      {step === "details" && (
        <QuestionCard icon={<Stethoscope />} title={detailCopy.title} subtitle={detailCopy.subtitle}>
          <OptionList
            options={symptomDetailOptions}
            selectedValues={answers.symptom_details}
            onSelect={(option) => toggleMulti("symptom_details", option.id)}
            multi
          />
          <NextButton disabled={answers.symptom_details.length === 0} onClick={continueAfterDetails} label={copy.next} />
        </QuestionCard>
      )}

      {step === "safety" && (
        <QuestionCard icon={<ShieldCheck />} title={safetyCopy.title} subtitle={safetyCopy.subtitle}>
          <OptionList
            options={safetyCopy.options}
            selectedValues={answers.safety_flags}
            onSelect={(option) => toggleMulti("safety_flags", option.id)}
            multi
          />
          <NextButton disabled={answers.safety_flags.length === 0} onClick={() => setStep("social")} label={copy.next} />
        </QuestionCard>
      )}

      {step === "social" && (
        <QuestionCard icon={<MessageCircle />} title={copy.qSocial[0]} subtitle={copy.qSocial[1]}>
          <OptionList
            options={socialOptions}
            selected={answers.social_contact ?? undefined}
            onSelect={(option) => setSingle("social_contact", option.id)}
          />
          <button
            onClick={analyze}
            disabled={!answers.social_contact}
            className="vyva-primary-action mt-4 min-h-[74px] w-full text-[21px] disabled:bg-vyva-text-3"
          >
            {copy.readResult}
          </button>
        </QuestionCard>
      )}

      {step === "analyzing" && (
        <section className="flex min-h-[520px] flex-col items-center justify-center overflow-hidden rounded-[36px] border border-white/80 bg-gradient-to-br from-white via-[#F5F3FF] to-[#FFF7ED] p-8 text-center shadow-[0_16px_44px_rgba(63,45,35,0.10)]">
          <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[34px] bg-white shadow-[0_12px_30px_rgba(107,33,168,0.14)]">
            <Loader2 size={54} className="animate-spin text-vyva-purple" />
          </div>
          <h1 className="mb-3 font-display text-[32px] text-vyva-text-1">{copy.analyzingTitle}, {name}</h1>
          <p className="font-body text-[21px] leading-relaxed text-vyva-text-2">{loadingMessage}</p>
        </section>
      )}

      {step === "result" && result && resultVisual && (
        <section className="overflow-hidden rounded-[36px] border border-white/80 bg-white shadow-[0_16px_44px_rgba(63,45,35,0.10)]">
          <div className="relative bg-gradient-to-br from-[#FFF7ED] via-[#F5F3FF] to-white p-7 pb-6">
            <div className="absolute right-[-30px] top-[-42px] h-36 w-36 rounded-full bg-vyva-purple/10" />
            <div className="absolute bottom-[-48px] left-10 h-24 w-24 rounded-full bg-[#F59E0B]/12" />
            <div className="relative mb-5 flex h-[78px] w-[78px] items-center justify-center rounded-[28px] bg-white text-[38px] shadow-[0_12px_30px_rgba(107,33,168,0.14)]">
              {resultVisual.icon}
            </div>
            <p className="relative mb-3 inline-flex rounded-full px-4 py-2 font-body text-[14px] font-bold uppercase tracking-[0.14em]" style={{ background: resultVisual.labelBg, color: resultVisual.labelText }}>
              {copy.resultKicker}
            </p>
            <h1 className="relative mb-4 font-display text-[38px] leading-tight text-vyva-text-1">{result.feeling_label}</h1>
            <p className="relative font-body text-[21px] leading-relaxed text-vyva-text-2">{result.vyva_reading}</p>
            <div className="relative mt-5">
              <ListenButton
                text={resultReadoutText}
                language={readoutLanguage}
              />
            </div>
          </div>
          <div className="p-6">
          {healthPriority && (
            <div className="mb-5 flex gap-4 rounded-[26px] border-2 border-[#DC2626] bg-[#FEF2F2] p-5 shadow-[0_14px_34px_rgba(220,38,38,0.14)]">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-white text-[24px] font-bold text-[#B91C1C]">!</span>
              <span>
                <span className="mb-1 block font-body text-[15px] font-bold uppercase tracking-[0.14em] text-[#B91C1C]">
                  {urgentHealthPriority ? "Prioridad medica" : "Revisar primero"}
                </span>
                <span className="block font-body text-[20px] font-semibold leading-relaxed text-[#7F1D1D]">
                  {result.watch_for ?? result.highlight}
                </span>
              </span>
            </div>
          )}
          <div className={`mb-5 flex gap-4 rounded-[26px] p-5 ${healthPriority ? "bg-[#FFF7ED]" : "bg-vyva-purple-light"}`}>
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-white text-[24px]">💡</span>
            <span>
              <span className="mb-1 block font-body text-[15px] font-bold uppercase tracking-[0.14em] text-vyva-purple">{copy.important}</span>
              <span className="block font-body text-[20px] font-semibold leading-relaxed text-vyva-text-1">{result.highlight}</span>
            </span>
          </div>
          {(result.why_today || result.trend_note || result.personal_plan || result.app_suggestion) && (
            <div className="mb-5 grid gap-3">
              {result.why_today && (
                <InsightCard
                  title={copy.whyTitle}
                  icon="🔍"
                  text={result.why_today}
                  tone="lavender"
                  actionLabel={nowAction?.title}
                  onAction={nowAction ? () => navigate(nowAction.to) : undefined}
                />
              )}
              {result.trend_note && (
                <InsightCard
                  title={copy.trendTitle}
                  icon="📈"
                  text={result.trend_note}
                  tone="sky"
                  actionLabel={copy === CHECKIN_TEXT.es ? "Ver historial" : "See history"}
                  onAction={() => navigate("/health/check-ins")}
                />
              )}
              {result.personal_plan && (
                <InsightCard
                  title={copy.planTitle}
                  icon="🧭"
                  text={result.personal_plan}
                  tone="mint"
                  actionLabel={planAction?.title}
                  onAction={planAction ? () => navigate(planAction.to) : undefined}
                />
              )}
              {result.app_suggestion && (
                <InsightCard
                  title={copy.suggestionTitle}
                  icon="✨"
                  text={result.app_suggestion}
                  tone="cream"
                  actionLabel={suggestedAction?.title}
                  onAction={suggestedAction ? () => navigate(suggestedAction.to) : undefined}
                />
              )}
            </div>
          )}
          <ResultList
            title={copy.rightNow}
            icon="⚡"
            items={result.right_now}
            actionLabel={nowAction?.title}
            onAction={nowAction ? () => navigate(nowAction.to) : undefined}
          />
          <ResultList
            title={copy.today}
            icon="☀️"
            items={result.today_actions}
            actionLabel={todayAction?.title}
            onAction={todayAction ? () => navigate(todayAction.to) : undefined}
          />
          {result.watch_for && (
            <div className="mt-4 flex gap-3 rounded-[24px] border border-[#F59E0B]/30 bg-[#FFFBEB] p-5">
              <span className="text-[24px]">🔎</span>
              <span>
                <p className="font-body text-[18px] leading-relaxed text-[#78350F]">{result.watch_for}</p>
              </span>
            </div>
          )}
          {appActions.length > 0 && (
            <div className="mt-5 rounded-[26px] border border-vyva-border bg-white p-5 shadow-[0_8px_24px_rgba(107,33,168,0.08)]">
              <p className="mb-2 font-body text-[15px] font-bold uppercase tracking-[0.14em] text-vyva-purple">
                {copy.appHelpTitle}
              </p>
              <p className="mb-4 font-body text-[18px] leading-relaxed text-vyva-text-2">
                {copy.appHelpText}
              </p>
              <div className="grid gap-3">
                {appActions.map((action) => (
                  <AppActionButton key={action.key} action={action} onClick={() => navigate(action.to)} />
                ))}
              </div>
            </div>
          )}
          <p className="mt-6 font-body text-[21px] leading-relaxed text-vyva-text-1">
            {copy.thanks}
          </p>
          <div className="mt-6 grid gap-3">
            <button onClick={openShareSheet} className="vyva-secondary-action min-h-[68px] w-full text-[19px]">
              <Share2 size={19} className="mr-2" />
              {copy.share}
            </button>
            <button onClick={() => navigate(suggestedAction?.to ?? "/health")} className="vyva-primary-action min-h-[72px] w-full text-[20px]">
              {suggestedAction?.title ?? (copy === CHECKIN_TEXT.es ? "Elegir siguiente paso" : "Choose next step")}
            </button>
            <button onClick={reset} className="vyva-secondary-action min-h-[68px] w-full text-[19px]">
              {copy.repeat}
            </button>
          </div>
          </div>
        </section>
      )}
      {shareSheetOpen && result && (
        <ReportShareSheet
          title={copy.shareTitle}
          text={shareReportText}
          linkText={shareReportMessage}
          shareUrl={shareUrl}
          shareUrlLoading={shareUrlLoading}
          labels={shareLabels}
          targets={shareTargets}
          onClose={() => setShareSheetOpen(false)}
          onAddContact={() => {
            setShareSheetOpen(false);
            navigate("/settings/account");
          }}
          onCopy={async () => {
            try {
              await copyReport(shareReportText, toast, shareLabels);
            } catch {
              toast({ description: shareLabels.failed });
            }
          }}
          onCopyLink={async () => {
            const url = shareUrl ?? await prepareShareUrl();
            if (!url) return;
            try {
              await navigator.clipboard.writeText(url);
              toast({ description: shareLabels.copied });
            } catch {
              toast({ description: shareLabels.failed });
            }
          }}
          onNativeShare={async () => {
            try {
              const url = shareUrl ?? await prepareShareUrl();
              await shareViaNative(copy.shareTitle, url ? shareLinkMessageFor(name, result, url, shareLabels) : shareReportText, toast, shareLabels);
            } catch {
              try {
                await copyReport(shareReportText, toast, shareLabels);
              } catch {
                toast({ description: shareLabels.failed });
              }
            }
          }}
          onSend={async (target) => {
            try {
              const url = shareUrl ?? await prepareShareUrl();
              const message = url ? shareLinkMessageFor(name, result, url, shareLabels) : shareReportText;
              if (target.channel === "native") {
                await shareViaNative(copy.shareTitle, message, toast, shareLabels);
              } else {
                sendReportToTarget(target, copy.shareTitle, message);
              }
              setShareSheetOpen(false);
            } catch {
              toast({ description: shareLabels.failed });
            }
          }}
        />
      )}
    </div>
  );
};

function ReportShareSheet({
  title,
  text,
  linkText,
  shareUrl,
  shareUrlLoading,
  labels,
  targets,
  onClose,
  onAddContact,
  onCopy,
  onCopyLink,
  onNativeShare,
  onSend,
}: {
  title: string;
  text: string;
  linkText: string;
  shareUrl: string | null;
  shareUrlLoading: boolean;
  labels: ReturnType<typeof shareLabelsFor>;
  targets: ShareTarget[];
  onClose: () => void;
  onAddContact: () => void;
  onCopy: () => void;
  onCopyLink: () => void;
  onNativeShare: () => void;
  onSend: (target: ShareTarget) => void | Promise<void>;
}) {
  const caregiverTargets = targets.filter((target) => target.kind === "caregiver");
  const doctorTargets = targets.filter((target) => target.kind === "doctor");
  const newContactTarget: ShareTarget = {
    id: "new-contact",
    kind: "new",
    title: labels.newContact,
    detail: labels.native,
    channel: "native",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <div className="max-h-[88vh] w-full max-w-[620px] overflow-hidden rounded-t-[34px] bg-white shadow-[0_-16px_50px_rgba(63,45,35,0.22)] sm:rounded-[34px]">
        <div className="flex items-start justify-between gap-4 border-b border-vyva-border bg-gradient-to-br from-[#F5F3FF] to-white p-5">
          <div>
            <p className="font-body text-[14px] font-bold uppercase tracking-[0.16em] text-vyva-purple">
              {labels.preview}
            </p>
            <h2 className="mt-1 font-display text-[31px] leading-tight text-vyva-text-1">{labels.title}</h2>
            <p className="mt-2 font-body text-[17px] leading-relaxed text-vyva-text-2">{labels.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="vyva-tap flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#F5EFE7] text-vyva-text-2"
          >
            <X size={22} />
          </button>
        </div>

        <div className="max-h-[64vh] overflow-y-auto p-5 pb-6">
          <div className="mb-4 rounded-[26px] border border-vyva-border bg-[#FAF9F6] p-4">
            <p className="mb-2 font-body text-[15px] font-bold uppercase tracking-[0.12em] text-vyva-purple">
              {shareUrlLoading ? labels.linkLoading : labels.linkReady}
            </p>
            <div className="rounded-[20px] bg-white p-4 shadow-[0_8px_18px_rgba(63,45,35,0.05)]">
              <p className="font-body text-[18px] font-bold text-vyva-text-1">{title}</p>
              <p className="mt-2 line-clamp-4 font-body text-[16px] leading-relaxed text-vyva-text-2">
                {linkText.split("\n").filter(Boolean).slice(0, 3).join(" ")}
              </p>
              {shareUrl && (
                <p className="mt-3 truncate rounded-full bg-vyva-purple-light px-4 py-2 font-body text-[14px] font-semibold text-vyva-purple">
                  {shareUrl}
                </p>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onCopyLink}
                disabled={!shareUrl && shareUrlLoading}
                className="vyva-tap min-h-[52px] rounded-full bg-vyva-purple px-4 font-body text-[15px] font-bold text-white disabled:bg-vyva-text-3"
              >
                {labels.copyLink}
              </button>
              <button
                type="button"
                onClick={() => shareUrl && window.open(shareUrl, "_blank", "noopener,noreferrer")}
                disabled={!shareUrl}
                className="vyva-tap min-h-[52px] rounded-full border border-vyva-border bg-white px-4 font-body text-[15px] font-bold text-vyva-text-1 disabled:text-vyva-text-3"
              >
                {labels.openLink}
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            {caregiverTargets.length > 0 ? (
              caregiverTargets.map((target) => (
                <ShareTargetButton key={target.id} target={target} label={labels.caregiver} onClick={() => onSend(target)} />
              ))
            ) : (
              <DisabledShareTarget
                icon={<Users size={24} />}
                title={labels.caregiver}
                detail={labels.noSaved}
                actionLabel={labels.addContact}
                onAction={onAddContact}
              />
            )}

            {doctorTargets.length > 0 ? (
              doctorTargets.map((target) => (
                <ShareTargetButton key={target.id} target={target} label={labels.doctor} onClick={() => onSend(target)} />
              ))
            ) : (
              <DisabledShareTarget
                icon={<Stethoscope size={24} />}
                title={labels.doctor}
                detail={labels.noSaved}
                actionLabel={labels.addContact}
                onAction={onAddContact}
              />
            )}

            <ShareTargetButton target={newContactTarget} label={labels.newContact} onClick={onNativeShare} />

            <button
              type="button"
              onClick={onCopy}
              className="vyva-tap flex min-h-[74px] items-center gap-4 rounded-[22px] border border-vyva-border bg-white p-4 text-left shadow-[0_8px_20px_rgba(63,45,35,0.06)]"
            >
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-vyva-purple-light text-vyva-purple">
                <Copy size={24} />
              </span>
              <span>
                <span className="block font-body text-[18px] font-bold text-vyva-text-1">{labels.copy}</span>
                <span className="block font-body text-[15px] text-vyva-text-2">{labels.native}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareTargetButton({
  target,
  label,
  onClick,
}: {
  target: ShareTarget;
  label: string;
  onClick: () => void;
}) {
  const Icon = target.kind === "doctor" ? Stethoscope : target.kind === "caregiver" ? Users : UserPlus;
  return (
    <button
      type="button"
      onClick={onClick}
      className="vyva-tap flex min-h-[78px] items-center gap-4 rounded-[22px] border border-vyva-border bg-white p-4 text-left shadow-[0_8px_20px_rgba(63,45,35,0.06)]"
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-vyva-purple-light text-vyva-purple">
        <Icon size={24} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[14px] font-bold uppercase tracking-[0.12em] text-vyva-purple">{label}</span>
        <span className="block truncate font-body text-[18px] font-bold text-vyva-text-1">{target.title}</span>
        <span className="block truncate font-body text-[15px] text-vyva-text-2">{target.detail}</span>
      </span>
      <Send size={22} className="flex-shrink-0 text-vyva-purple" />
    </button>
  );
}

function DisabledShareTarget({
  icon,
  title,
  detail,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[74px] items-center gap-4 rounded-[22px] border border-dashed border-vyva-border bg-[#FAF9F6] p-4">
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-white text-vyva-text-3">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[18px] font-bold text-vyva-text-1">{title}</span>
        <span className="block font-body text-[15px] text-vyva-text-2">{detail}</span>
      </span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="vyva-tap flex-shrink-0 rounded-full bg-vyva-purple px-4 py-2 font-body text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(107,33,168,0.16)]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function QuestionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[36px] border border-white/80 bg-white shadow-[0_16px_44px_rgba(63,45,35,0.10)]">
      <div className="relative bg-gradient-to-br from-[#F5F3FF] via-white to-[#FFF7ED] p-6 pb-5">
        <div className="absolute right-[-36px] top-[-42px] h-32 w-32 rounded-full bg-vyva-purple/10" />
        <div className="relative mb-4 flex h-[68px] w-[68px] items-center justify-center rounded-[24px] bg-white text-vyva-purple shadow-[0_10px_26px_rgba(107,33,168,0.14)]">
          {icon}
        </div>
        <h1 className="relative mb-2 font-display text-[34px] leading-tight text-vyva-text-1">{title}</h1>
        <p className="relative font-body text-[20px] leading-relaxed text-vyva-text-2">{subtitle}</p>
      </div>
      <div className="p-5 pt-4">{children}</div>
    </section>
  );
}

function OptionList({
  options,
  selected,
  selectedValues,
  onSelect,
  multi = false,
}: {
  options: SingleOption[];
  selected?: string;
  selectedValues?: string[];
  onSelect: (option: SingleOption) => void;
  multi?: boolean;
}) {
  return (
    <div className="grid gap-3">
      {options.map((option) => {
        const isSelected = multi ? selectedValues?.includes(option.id) : selected === option.id;
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option)}
            className={`vyva-tap flex min-h-[86px] items-center justify-between gap-4 rounded-[24px] border px-4 py-3 text-left transition-all ${
              isSelected
                ? "border-vyva-purple bg-gradient-to-r from-vyva-purple to-[#8B5CF6] text-white shadow-[0_10px_26px_rgba(107,33,168,0.22)]"
                : "border-vyva-border bg-[#FAF9F6] text-vyva-text-1 shadow-[0_4px_14px_rgba(63,45,35,0.04)]"
            }`}
          >
            <span className="flex min-w-0 flex-1 items-center gap-4">
              <span
                className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[19px] text-[27px] ${
                  isSelected ? "bg-white/18" : "bg-white"
                }`}
              >
                {option.icon ?? "•"}
              </span>
              <span className="min-w-0">
              <span className="block font-body text-[21px] font-bold leading-tight">{option.label}</span>
              {option.helper && (
                <span className={`mt-1 block font-body text-[16px] leading-snug ${isSelected ? "text-white/85" : "text-vyva-text-2"}`}>
                  {option.helper}
                </span>
              )}
              </span>
            </span>
            <span
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                isSelected ? "bg-[#F59E0B] shadow-sm" : "border-2 border-vyva-border bg-white"
              }`}
            >
              {isSelected && <Check size={19} className="text-white" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NextButton({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="vyva-primary-action mt-4 min-h-[72px] w-full text-[20px] disabled:bg-vyva-text-3"
    >
      {label}
    </button>
  );
}

function ResultList({
  title,
  icon,
  items,
  actionLabel,
  onAction,
}: {
  title: string;
  icon: string;
  items: string[];
  actionLabel?: string;
  onAction?: () => void;
}) {
  const uniqueItems = uniqueByIntent(items).slice(0, 3);
  return (
    <div className="mt-4 rounded-[26px] border border-vyva-border bg-[#FAF9F6] p-5 shadow-[0_4px_16px_rgba(63,45,35,0.04)]">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-[22px]">{icon}</span>
        <p className="font-body text-[15px] font-bold uppercase tracking-[0.14em] text-vyva-text-2">{title}</p>
      </div>
      <div className="grid gap-3">
        {uniqueItems.map((item) => (
          <div key={item} className="flex gap-3 rounded-[18px] bg-white p-3">
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple text-[14px] font-bold text-white">
              <Check size={16} />
            </span>
            <p className="font-body text-[19px] leading-relaxed text-vyva-text-1">{item}</p>
          </div>
        ))}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="vyva-tap mt-4 inline-flex min-h-[52px] items-center justify-center rounded-full bg-vyva-purple px-5 font-body text-[16px] font-bold text-white shadow-[0_10px_22px_rgba(107,33,168,0.18)]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function InsightCard({
  title,
  icon,
  text,
  tone,
  actionLabel,
  onAction,
}: {
  title: string;
  icon: string;
  text: string;
  tone: "lavender" | "mint" | "cream" | "sky";
  actionLabel?: string;
  onAction?: () => void;
}) {
  const toneClass =
    tone === "mint"
      ? "border-[#BBF7D0] bg-[#ECFDF5]"
      : tone === "sky"
        ? "border-[#BAE6FD] bg-[#F0F9FF]"
      : tone === "cream"
        ? "border-[#FED7AA] bg-[#FFF7ED]"
        : "border-[#DDD6FE] bg-[#F5F3FF]";

  return (
    <div className={`flex gap-4 rounded-[24px] border p-4 ${toneClass}`}>
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-white text-[24px] shadow-sm">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="mb-1 block font-body text-[14px] font-bold uppercase tracking-[0.14em] text-vyva-purple">
          {title}
        </span>
        <span className="block font-body text-[18px] leading-relaxed text-vyva-text-1">
          {text}
        </span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="vyva-tap mt-4 inline-flex min-h-[52px] items-center justify-center rounded-full bg-vyva-purple px-5 font-body text-[16px] font-bold text-white shadow-[0_10px_22px_rgba(107,33,168,0.18)]"
          >
            {actionLabel}
          </button>
        )}
      </span>
    </div>
  );
}

function uniqueByIntent(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const key =
      normalized.includes("respir") || normalized.includes("medita") ? "calm" :
      normalized.includes("musica") || normalized.includes("cancion") ? "music" :
      normalized.includes("agua") || normalized.includes("hidrata") ? "hydrate" :
      normalized.includes("social") || normalized.includes("llamada") || normalized.includes("alguien") || normalized.includes("compania") ? "social" :
      normalized.includes("sintoma") || normalized.includes("signos") || normalized.includes("medica") ? "health" :
      normalized.includes("concierge") || normalized.includes("para ti hoy") || normalized.includes("salir") ? "plan" :
      normalized.slice(0, 28);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function AppActionButton({ action, onClick }: { action: AppAction; onClick: () => void }) {
  const Icon =
    action.key === "concierge" ? Compass :
    action.key === "symptom" ? ClipboardList :
    action.key === "vitals" ? Activity :
    action.key === "meditation" ? Headphones :
    action.key === "social" ? Users :
    action.key === "music" ? Music :
    action.key === "exercise" ? Dumbbell :
    action.key === "chess" ? Gamepad2 :
    action.key === "cooking" ? ChefHat :
    action.key === "art" ? Palette :
    action.key === "literature" ? BookOpen :
    ShieldCheck;
  return (
    <button
      onClick={onClick}
      className={`vyva-tap flex min-h-[86px] items-center gap-4 rounded-[22px] border p-4 text-left ${
        action.primary
          ? "border-vyva-purple bg-vyva-purple text-white"
          : "border-vyva-border bg-[#FAF9F6] text-vyva-text-1"
      }`}
      data-testid={`button-checkin-app-action-${action.key}`}
    >
      <span
        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] ${
          action.primary ? "bg-white/18" : "bg-vyva-purple-light"
        }`}
      >
        <Icon size={24} className={action.primary ? "text-white" : "text-vyva-purple"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[18px] font-bold leading-tight">{action.title}</span>
        <span className={`mt-1 block font-body text-[15px] leading-snug ${action.primary ? "text-white/85" : "text-vyva-text-2"}`}>
          {action.description}
        </span>
      </span>
    </button>
  );
}

export default CheckHowIFeelScreen;
