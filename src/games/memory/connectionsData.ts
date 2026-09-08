import type { LanguageCode } from "@/i18n/languages";
import { BRAIN_COACH_MAX_LEVEL, getBrainCoachLevelBand } from "../shared/brainCoachProgression";
import type { MemoryGameLevel, MemoryGameVariantContent } from "./types";

export type ConnectionField = "person" | "place" | "item" | "time";

export type ConnectionRecord = {
  id: string;
  person: string;
  place?: string;
  item?: string;
  time?: string;
  tone: "purple" | "teal" | "blue" | "amber" | "rose";
};

export type ConnectionQuestion = {
  id: string;
  prompt: string;
  cueField: ConnectionField;
  answerField: ConnectionField;
  answer: string;
  options: string[];
};

export type ConnectionsPayload = {
  roundVersion: "connections_v2";
  scenarioId: string;
  context: string;
  connections: ConnectionRecord[];
  questions: ConnectionQuestion[];
  resetNumbers: number[];
};

type TermKey =
  | "library" | "cafe" | "pharmacy" | "gallery" | "station" | "garden" | "clinic" | "market"
  | "folder" | "umbrella" | "notebook" | "tickets" | "keys" | "camera" | "scarf" | "flowers"
  | "bread" | "map" | "glasses" | "thermos" | "invitation" | "charger" | "coat" | "prescription";

type ScenarioDefinition = {
  id: string;
  people: string[];
  places: TermKey[];
  items: TermKey[];
  times: string[];
};

const LANGUAGES: LanguageCode[] = ["es", "en", "fr", "de", "it", "pt"];
const TONES: ConnectionRecord["tone"][] = ["purple", "teal", "blue", "amber", "rose"];

const TERMS: Record<LanguageCode, Record<TermKey, string>> = {
  en: { library: "library", cafe: "café", pharmacy: "pharmacy", gallery: "gallery", station: "station", garden: "garden centre", clinic: "clinic", market: "market", folder: "red folder", umbrella: "striped umbrella", notebook: "green notebook", tickets: "train tickets", keys: "spare keys", camera: "small camera", scarf: "blue scarf", flowers: "white flowers", bread: "fresh bread", map: "folded map", glasses: "reading glasses", thermos: "silver flask", invitation: "printed invitation", charger: "phone charger", coat: "navy coat", prescription: "prescription note" },
  es: { library: "biblioteca", cafe: "cafetería", pharmacy: "farmacia", gallery: "galería", station: "estación", garden: "vivero", clinic: "clínica", market: "mercado", folder: "carpeta roja", umbrella: "paraguas a rayas", notebook: "cuaderno verde", tickets: "billetes de tren", keys: "llaves de repuesto", camera: "cámara pequeña", scarf: "bufanda azul", flowers: "flores blancas", bread: "pan fresco", map: "mapa doblado", glasses: "gafas de lectura", thermos: "termo plateado", invitation: "invitación impresa", charger: "cargador del móvil", coat: "abrigo azul marino", prescription: "receta médica" },
  fr: { library: "bibliothèque", cafe: "café", pharmacy: "pharmacie", gallery: "galerie", station: "gare", garden: "jardinerie", clinic: "clinique", market: "marché", folder: "dossier rouge", umbrella: "parapluie rayé", notebook: "carnet vert", tickets: "billets de train", keys: "clés de secours", camera: "petit appareil photo", scarf: "écharpe bleue", flowers: "fleurs blanches", bread: "pain frais", map: "carte pliée", glasses: "lunettes de lecture", thermos: "thermos argenté", invitation: "invitation imprimée", charger: "chargeur de téléphone", coat: "manteau bleu marine", prescription: "ordonnance" },
  de: { library: "Bibliothek", cafe: "Café", pharmacy: "Apotheke", gallery: "Galerie", station: "Bahnhof", garden: "Gartencenter", clinic: "Klinik", market: "Markt", folder: "rote Mappe", umbrella: "gestreifter Regenschirm", notebook: "grünes Notizbuch", tickets: "Fahrkarten", keys: "Ersatzschlüssel", camera: "kleine Kamera", scarf: "blauer Schal", flowers: "weiße Blumen", bread: "frisches Brot", map: "gefaltete Karte", glasses: "Lesebrille", thermos: "silberne Thermosflasche", invitation: "gedruckte Einladung", charger: "Handyladegerät", coat: "dunkelblauer Mantel", prescription: "Rezept" },
  it: { library: "biblioteca", cafe: "caffè", pharmacy: "farmacia", gallery: "galleria", station: "stazione", garden: "vivaio", clinic: "clinica", market: "mercato", folder: "cartella rossa", umbrella: "ombrello a righe", notebook: "quaderno verde", tickets: "biglietti del treno", keys: "chiavi di riserva", camera: "piccola macchina fotografica", scarf: "sciarpa blu", flowers: "fiori bianchi", bread: "pane fresco", map: "mappa piegata", glasses: "occhiali da lettura", thermos: "thermos argentato", invitation: "invito stampato", charger: "caricatore del telefono", coat: "cappotto blu scuro", prescription: "ricetta medica" },
  pt: { library: "biblioteca", cafe: "café", pharmacy: "farmácia", gallery: "galeria", station: "estação", garden: "centro de jardinagem", clinic: "clínica", market: "mercado", folder: "pasta vermelha", umbrella: "guarda-chuva às riscas", notebook: "caderno verde", tickets: "bilhetes de comboio", keys: "chaves suplentes", camera: "máquina fotográfica pequena", scarf: "cachecol azul", flowers: "flores brancas", bread: "pão fresco", map: "mapa dobrado", glasses: "óculos de leitura", thermos: "termo prateado", invitation: "convite impresso", charger: "carregador do telemóvel", coat: "casaco azul-marinho", prescription: "receita médica" },
};

const COPY: Record<LanguageCode, { title: string; context: string; prompt: string; questions: Record<string, (cue: string) => string> }> = {
  en: { title: "Connections", context: "Everyone has a different plan. Remember who, where, and what.", prompt: "Remember the connections, then answer from memory.", questions: { person_place: (v) => `Where is ${v} going?`, place_person: (v) => `Who is going to the ${v}?`, person_item: (v) => `What is ${v} bringing?`, item_person: (v) => `Who is bringing the ${v}?`, person_time: (v) => `When is ${v} arriving?`, time_person: (v) => `Who is arriving at ${v}?` } },
  es: { title: "Conexiones", context: "Cada persona tiene un plan distinto. Recuerda quién, dónde y qué.", prompt: "Recuerda las conexiones y responde de memoria.", questions: { person_place: (v) => `¿Adónde va ${v}?`, place_person: (v) => `¿Quién va a ${v}?`, person_item: (v) => `¿Qué lleva ${v}?`, item_person: (v) => `¿Quién lleva ${v}?`, person_time: (v) => `¿A qué hora llega ${v}?`, time_person: (v) => `¿Quién llega a las ${v}?` } },
  fr: { title: "Connexions", context: "Chaque personne a un projet différent. Retenez qui, où et quoi.", prompt: "Retenez les connexions, puis répondez de mémoire.", questions: { person_place: (v) => `Où va ${v} ?`, place_person: (v) => `Qui va à ${v} ?`, person_item: (v) => `Qu'apporte ${v} ?`, item_person: (v) => `Qui apporte ${v} ?`, person_time: (v) => `À quelle heure arrive ${v} ?`, time_person: (v) => `Qui arrive à ${v} ?` } },
  de: { title: "Verbindungen", context: "Jede Person hat einen anderen Plan. Merken Sie sich wer, wo und was.", prompt: "Merken Sie sich die Verbindungen und antworten Sie aus dem Gedächtnis.", questions: { person_place: (v) => `Wohin geht ${v}?`, place_person: (v) => `Wer geht zur ${v}?`, person_item: (v) => `Was bringt ${v} mit?`, item_person: (v) => `Wer bringt ${v} mit?`, person_time: (v) => `Wann kommt ${v} an?`, time_person: (v) => `Wer kommt um ${v} an?` } },
  it: { title: "Connessioni", context: "Ogni persona ha un programma diverso. Ricorda chi, dove e cosa.", prompt: "Ricorda le connessioni, poi rispondi a memoria.", questions: { person_place: (v) => `Dove va ${v}?`, place_person: (v) => `Chi va a ${v}?`, person_item: (v) => `Che cosa porta ${v}?`, item_person: (v) => `Chi porta ${v}?`, person_time: (v) => `A che ora arriva ${v}?`, time_person: (v) => `Chi arriva alle ${v}?` } },
  pt: { title: "Ligações", context: "Cada pessoa tem um plano diferente. Recorde quem, onde e o quê.", prompt: "Recorde as ligações e responda de memória.", questions: { person_place: (v) => `Onde vai ${v}?`, place_person: (v) => `Quem vai à ${v}?`, person_item: (v) => `O que leva ${v}?`, item_person: (v) => `Quem leva ${v}?`, person_time: (v) => `A que horas chega ${v}?`, time_person: (v) => `Quem chega às ${v}?` } },
};

const SCENARIOS: ScenarioDefinition[] = [
  { id: "community-morning", people: ["Maya", "Daniel", "Rosa", "Omar", "Clara"], places: ["library", "cafe", "pharmacy", "gallery", "station"], items: ["folder", "umbrella", "notebook", "tickets", "keys"], times: ["09:15", "09:40", "10:10", "10:35", "11:00"] },
  { id: "weekend-plans", people: ["Elena", "Samir", "Nora", "Leo", "Inés"], places: ["market", "garden", "cafe", "library", "gallery"], items: ["flowers", "camera", "bread", "map", "glasses"], times: ["10:20", "10:50", "11:15", "11:45", "12:10"] },
  { id: "travel-day", people: ["Amir", "Sofia", "Martin", "Lina", "Pablo"], places: ["station", "cafe", "gallery", "market", "library"], items: ["tickets", "thermos", "camera", "scarf", "charger"], times: ["08:30", "09:05", "09:35", "10:00", "10:25"] },
  { id: "afternoon-errands", people: ["Teresa", "Hugo", "Amina", "David", "Celia"], places: ["pharmacy", "market", "clinic", "library", "garden"], items: ["prescription", "bread", "folder", "notebook", "coat"], times: ["14:10", "14:40", "15:15", "15:45", "16:20"] },
  { id: "shared-lunch", people: ["Lucía", "Jonas", "Fatima", "Marco", "Eva"], places: ["cafe", "market", "garden", "station", "gallery"], items: ["invitation", "flowers", "thermos", "map", "camera"], times: ["11:30", "12:00", "12:20", "12:45", "13:10"] },
  { id: "evening-class", people: ["Noah", "Irene", "Karim", "Anna", "Luis"], places: ["library", "gallery", "cafe", "station", "clinic"], items: ["notebook", "glasses", "charger", "umbrella", "folder"], times: ["17:15", "17:40", "18:05", "18:30", "19:00"] },
];

function levelShape(level: number) {
  if (level <= 2) return { count: 3, questionCount: 3, includeItem: false, includeTime: false, resetCount: 0 };
  if (level <= 5) return { count: 3, questionCount: 4, includeItem: true, includeTime: false, resetCount: 3 };
  if (level <= 10) return { count: 4, questionCount: 5, includeItem: true, includeTime: false, resetCount: 4 };
  if (level <= 15) return { count: 5, questionCount: 6, includeItem: true, includeTime: false, resetCount: 4 };
  return { count: 5, questionCount: 7, includeItem: true, includeTime: true, resetCount: 5 };
}

function buildQuestions(records: ConnectionRecord[], language: LanguageCode, count: number, includeItem: boolean, includeTime: boolean, offset: number) {
  const questionCopy = COPY[language].questions;
  const patterns: Array<[ConnectionField, ConnectionField]> = [
    ["person", "place"],
    ["place", "person"],
    ...(includeItem ? [["person", "item"], ["item", "person"]] as Array<[ConnectionField, ConnectionField]> : []),
    ...(includeTime ? [["person", "time"], ["time", "person"]] as Array<[ConnectionField, ConnectionField]> : []),
  ];

  return Array.from({ length: count }, (_, index) => {
    const [cueField, answerField] = patterns[index % patterns.length];
    const record = records[(index + Math.floor(index / patterns.length) + offset) % records.length];
    const cue = String(record[cueField] ?? "");
    const answer = String(record[answerField] ?? "");
    const key = `${cueField}_${answerField}`;
    const choices = records.map((entry) => String(entry[answerField] ?? "")).filter(Boolean);
    const optionOffset = (index + offset) % choices.length;
    return {
      id: `${record.id}-${key}`,
      prompt: questionCopy[key](cue),
      cueField,
      answerField,
      answer,
      options: [...choices.slice(optionOffset), ...choices.slice(0, optionOffset)],
    };
  });
}

function buildContent(scenario: ScenarioDefinition, level: number, language: LanguageCode, variantIndex: number): MemoryGameVariantContent {
  const shape = levelShape(level);
  const terms = TERMS[language];
  const records = scenario.people.slice(0, shape.count).map((person, index): ConnectionRecord => ({
    id: `${scenario.id}-${index + 1}`,
    person,
    place: terms[scenario.places[index]],
    ...(shape.includeItem ? { item: terms[scenario.items[index]] } : {}),
    ...(shape.includeTime ? { time: scenario.times[index] } : {}),
    tone: TONES[index],
  }));
  const resetPool = [18, 7, 24, 11, 31, 15, 28];
  const start = (level + variantIndex) % resetPool.length;
  const resetNumbers = Array.from({ length: shape.resetCount }, (_, index) => resetPool[(start + index * 2) % resetPool.length]);
  return {
    title: COPY[language].title,
    prompt: COPY[language].prompt,
    payload: {
      roundVersion: "connections_v2",
      scenarioId: scenario.id,
      context: COPY[language].context,
      connections: records,
      questions: buildQuestions(records, language, shape.questionCount, shape.includeItem, shape.includeTime, level + variantIndex),
      resetNumbers,
      levelBand: getBrainCoachLevelBand(level).label,
    } satisfies ConnectionsPayload & { levelBand: string },
  };
}

export function buildConnectionsLevels(): MemoryGameLevel[] {
  return Array.from({ length: BRAIN_COACH_MAX_LEVEL }, (_, levelIndex) => {
    const level = levelIndex + 1;
    return {
      level,
      variants: SCENARIOS.map((scenario, variantIndex) => ({
        id: `association_memory-l${level}-v${variantIndex + 1}`,
        level,
        content: Object.fromEntries(LANGUAGES.map((language) => [language, buildContent(scenario, level, language, variantIndex)])) as Record<LanguageCode, MemoryGameVariantContent>,
      })),
    };
  });
}
