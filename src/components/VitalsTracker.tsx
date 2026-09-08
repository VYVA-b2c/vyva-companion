import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Activity, AlertTriangle, ArrowLeft, Bell, Bluetooth, Calendar, Car, Check, ChevronDown, HeartPulse, Keyboard, Loader2, Mail, Moon, PhoneCall, Pill, Plus, RefreshCw, Scale, Share2, ShieldCheck, Smile, Stethoscope, Thermometer, UserPlus, Users, Wind, Zap } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import VitalsAddReadingFlow, { type VitalsAcquisitionContext } from "@/components/VitalsAddReadingFlow";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { VITALS_SIGNAL_CATALOG, type VitalsCaptureMethod, type VitalsDisplayGroup } from "../../shared/vitalsSignalCatalog";
import type { VitalsVoiceFlowState, VitalsVoiceReading, VitalsVoiceUiState } from "@/lib/vitalsVoiceContext";

type Language = "es" | "de" | "en" | "fr" | "it" | "pt";
type Screen = "dashboard" | "add";
type SignalKey = keyof typeof SIGNAL_CONFIG;

interface Props {
  userId: string;
  userConditions: string[];
  previewData?: VitalsTrackerPreviewData;
  language?: Language;
  country?: string | null;
  gpName?: string | null;
  gpPhone?: string | null;
  gpEmail?: string | null;
  caregiverContact?: string | null;
  onBackActionChange?: (handler: (() => void) | null) => void;
  onVoiceStateChange?: (state: VitalsVoiceUiState) => void;
}

interface LatestAnalysis {
  id?: string | null;
  analysed_at?: string | null;
  safety_status?: SafetyStatus | null;
  recommended_action?: SafetyStatus | string | null;
  risk_score?: number | null;
  risk_tier?: string | null;
  senior_message?: string | null;
  caregiver_note?: string | null;
  acknowledged_action?: string | null;
  acknowledged_at?: string | null;
  rule_version?: string | null;
  model_version?: string | null;
}

export type SafetyStatus = "steady" | "recheck" | "share_with_caregiver" | "contact_doctor" | "urgent_help";
type VitalsSafetyActionKind =
  | "call_emergency"
  | "call_gp"
  | "email_gp"
  | "doctor_help"
  | "add_doctor_contact"
  | "schedule_appointment"
  | "book_ride"
  | "share_summary"
  | "recheck";

interface LatestAlert {
  id: string;
  severity: string;
  message: string;
  created_at?: string | null;
  resolved_at?: string | null;
}

interface RecentReading {
  signal_type: string;
  value: string | number;
  recorded_at: string;
  source: string;
  source_confidence?: "low" | "medium" | "high";
  source_confidence_reason?: string;
  source_display_label?: string;
  source_context_label?: string;
  deviation_pct: string | number | null;
  context_tag: string | null;
  capture_method?: string | null;
  unit?: string | null;
  source_ref?: Record<string, unknown> | null;
}

export interface VitalsTrackerPreviewData {
  analysis: LatestAnalysis | null;
  recent_readings: RecentReading[];
  latest_alert?: LatestAlert | null;
}

const COPY = {
  es: {
    logo: "VYVA",
    add: "Añadir dato",
    analyse: "Actualizar evaluación",
    analysing: "Analizando...",
    loading: "Preparando tus signos...",
    back: "Volver",
    save: "Guardar dato",
    saving: "Guardando...",
    lastAnalysis: "Último análisis",
    noAnalysis: "Sin análisis todavía",
    now: "Ahora",
    normal: "Normal",
    today: "Hoy",
    yes: "Sí, tomada",
    no: "No todavía",
    valuePlaceholder: "142",
    messageFallback: "Buenos días. VYVA está lista para revisar tus señales contigo.",
    safetyTitle: "Chequeo diario",
    safetyAck: "Guardado",
    recheck: "Repetir",
    share: "Compartir",
    doctor: "Medico",
    urgent: "Urgente",
    call: "Llamar",
    callGp: "Llamar medico",
    emailGp: "Email medico",
    doctorHelp: "Ayuda medica",
    addDoctor: "Anadir medico",
    appointment: "Cita medica",
    ride: "Transporte",
    shareSummary: "Compartir resumen",
    sourceEstimated: "Estimado",
    sourceManual: "Manual",
    sourceDevice: "Dispositivo",
    confidenceLow: "Baja",
    confidenceMedium: "Media",
    confidenceHigh: "Alta",
    evidenceTitle: "Cómo conecta VYVA tus datos",
    evidenceBody: "VYVA reúne tus constantes y las compara con tu referencia personal: lo que es habitual para ti. Analiza cómo cambian con el tiempo y qué señales se mueven juntas para detectar tendencias, patrones y posibles riesgos antes de que resulten evidentes.",
    evidencePhone: "Aprende tu referencia: reconoce lo que es habitual para ti",
    evidenceManual: "Conecta las señales: constantes, síntomas, sueño, ánimo y medicación",
    evidenceDevice: "Se anticipa: usa patrones emergentes para prever posibles resultados y señalar riesgos",
    addEvidenceNote: "Introduce el numero tal como aparece en tu dispositivo, o registra como te sientes. Esto ayuda a VYVA a refinar la evaluacion.",
    sourceClinical: "ClÃ­nico",
  },
  de: {
    logo: "VYVA",
    add: "Wert hinzufügen",
    analyse: "Bewertung aktualisieren",
    analysing: "Analysiere...",
    loading: "Werte werden vorbereitet...",
    back: "Zurück",
    save: "Wert speichern",
    saving: "Speichern...",
    lastAnalysis: "Letzte Analyse",
    noAnalysis: "Noch keine Analyse",
    now: "Jetzt",
    normal: "Normal",
    today: "Heute",
    yes: "Ja, genommen",
    no: "Noch nicht",
    valuePlaceholder: "142",
    messageFallback: "Guten Morgen. VYVA ist bereit, deine Werte mit dir anzusehen.",
    safetyTitle: "Taglicher Check",
    safetyAck: "Gespeichert",
    recheck: "Erneut prufen",
    share: "Teilen",
    doctor: "Arzt",
    urgent: "Dringend",
    call: "Anrufen",
    callGp: "Arzt anrufen",
    emailGp: "Arzt mailen",
    doctorHelp: "Arzthilfe",
    addDoctor: "Arzt hinzufugen",
    appointment: "Termin buchen",
    ride: "Transport finden",
    shareSummary: "Zusammenfassung teilen",
    sourceEstimated: "Geschatzt",
    sourceManual: "Manuell",
    sourceDevice: "Gerat",
    confidenceLow: "Niedrig",
    confidenceMedium: "Mittel",
    confidenceHigh: "Hoch",
    evidenceTitle: "Wie VYVA Ihre Daten verbindet",
    evidenceBody: "VYVA führt Ihre Vitalwerte zusammen und vergleicht sie mit Ihrem persönlichen Ausgangswert – also mit dem, was für Sie üblich ist. Es analysiert Veränderungen im Zeitverlauf und gemeinsam auftretende Signale, um Trends, Muster und mögliche Risiken frühzeitig zu erkennen.",
    evidencePhone: "Lernt Ihren Ausgangswert: erkennt, was für Sie üblich ist",
    evidenceManual: "Verbindet die Signale: Vitalwerte, Symptome, Schlaf, Stimmung und Medikamente",
    evidenceDevice: "Blickt voraus: nutzt neue Muster, um mögliche Entwicklungen vorherzusehen und Risiken zu melden",
    addEvidenceNote: "Geben Sie den Wert so ein, wie er auf dem Gerat steht, oder erfassen Sie, wie Sie sich fuhlen. Das hilft VYVA, die Einschatzung zu verfeinern.",
    sourceClinical: "Klinisch",
  },
  en: {
    logo: "VYVA",
    add: "Add reading",
    analyse: "Refresh assessment",
    analysing: "Analysing...",
    loading: "Preparing your vitals...",
    back: "Back",
    save: "Save reading",
    saving: "Saving...",
    lastAnalysis: "Last analysis",
    noAnalysis: "No analysis yet",
    now: "Now",
    normal: "Normal",
    today: "Today",
    yes: "Yes, taken",
    no: "Not yet",
    valuePlaceholder: "142",
    messageFallback: "Good morning. VYVA is ready to review your signals with you.",
    safetyTitle: "Daily safety check",
    safetyAck: "Recorded",
    recheck: "Recheck",
    share: "Share",
    doctor: "Doctor",
    urgent: "Urgent",
    call: "Call",
    callGp: "Call GP",
    emailGp: "Email GP",
    doctorHelp: "Doctor help",
    addDoctor: "Add doctor",
    appointment: "Book appointment",
    ride: "Find specialised transport",
    shareSummary: "Share summary",
    sourceEstimated: "Estimated",
    sourceManual: "Manual",
    sourceDevice: "Device",
    confidenceLow: "Low",
    confidenceMedium: "Medium",
    confidenceHigh: "High",
    evidenceTitle: "How VYVA connects your health signals",
    evidenceBody: "VYVA brings your readings together and compares them with your personal baseline—what is usual for you. It analyses changes over time and signals that move together to identify trends, patterns and possible risks before they become obvious.",
    evidencePhone: "Learns your baseline: understands what is usual for you",
    evidenceManual: "Connects the signals: vitals, symptoms, sleep, mood and medication",
    evidenceDevice: "Looks ahead: uses emerging patterns to anticipate possible outcomes and flag risks",
    addEvidenceNote: "Enter the number exactly as it appears on your device, or record how you feel. This helps VYVA refine the assessment.",
    sourceClinical: "Clinical",
  },
};

type LocalizedText = Partial<Record<Language, string>>;

interface ExtraTrackerCopy {
  loadError: string;
  saveError: string;
  analysisError: string;
  actionError: string;
  checkConnectedSensor: string;
  manualGlucoseEntry: string;
  connectedGlucoseHelp: string;
  manualGlucoseHelp: string;
  whenReading: string;
  moreOptions: string;
  ok: string;
}

const COPY_BASE: Partial<Record<Language, typeof COPY.en>> = COPY;

const COPY_OVERRIDES: Record<Language, Partial<typeof COPY.en> & ExtraTrackerCopy> = {
  es: {
    loadError: "No pude cargar tus signos ahora.",
    saveError: "No pude guardar este dato.",
    analysisError: "El analisis no se pudo completar.",
    actionError: "No pude guardar esta accion.",
    checkConnectedSensor: "Buscar sensor conectado",
    manualGlucoseEntry: "Entrada manual de glucosa",
    connectedGlucoseHelp: "Si no hay lectura automatica disponible, introduce el numero del glucometro aqui.",
    manualGlucoseHelp: "Escribe el numero del glucometro para guardarlo con tus signos.",
    whenReading: "Cuando fue esta medicion?",
    moreOptions: "Mas opciones",
    ok: "OK",
  },
  de: {
    loadError: "Vitalwerte konnten gerade nicht geladen werden.",
    saveError: "Dieser Wert konnte nicht gespeichert werden.",
    analysisError: "Die Analyse konnte nicht abgeschlossen werden.",
    actionError: "Diese Aktion konnte nicht gespeichert werden.",
    checkConnectedSensor: "Verbundenen Sensor prufen",
    manualGlucoseEntry: "Manuelle Glukoseeingabe",
    connectedGlucoseHelp: "Wenn kein automatischer Wert verfugbar ist, geben Sie den Wert vom Glukosemessgerat hier ein.",
    manualGlucoseHelp: "Geben Sie den Wert vom Glukosemessgerat ein, um ihn mit Ihren Vitalwerten zu speichern.",
    whenReading: "Wann war diese Messung?",
    moreOptions: "Weitere Optionen",
    ok: "OK",
  },
  en: {
    loadError: "Could not load vitals right now.",
    saveError: "Could not save this reading.",
    analysisError: "The analysis could not finish.",
    actionError: "Could not record this action.",
    checkConnectedSensor: "Check connected sensor",
    manualGlucoseEntry: "Manual glucose entry",
    connectedGlucoseHelp: "If no automatic reading is available, enter the number from the glucose meter here.",
    manualGlucoseHelp: "Type the number from the glucose meter to save it with your vitals.",
    whenReading: "When was this reading?",
    moreOptions: "More options",
    ok: "OK",
  },
  fr: {
    add: "Ajouter une mesure",
    analyse: "Actualiser l’évaluation",
    analysing: "Analyse en cours…",
    loading: "Préparation de vos constantes…",
    back: "Retour",
    save: "Enregistrer la mesure",
    saving: "Enregistrement…",
    lastAnalysis: "Dernière analyse",
    noAnalysis: "Aucune analyse encore",
    now: "Maintenant",
    normal: "Normal",
    today: "Aujourd'hui",
    yes: "Oui, pris",
    no: "Pas encore",
    messageFallback: "Bonjour. VYVA est prête à revoir vos constantes avec vous.",
    safetyTitle: "Contrôle quotidien",
    safetyAck: "Enregistré",
    recheck: "Vérifier à nouveau",
    share: "Partager",
    doctor: "Médecin",
    urgent: "Urgent",
    call: "Appeler",
    callGp: "Appeler le médecin",
    emailGp: "Envoyer un e-mail au médecin",
    doctorHelp: "Aide médicale",
    addDoctor: "Ajouter un médecin",
    appointment: "Prendre rendez-vous",
    ride: "Trouver un transport",
    shareSummary: "Partager le résumé",
    sourceEstimated: "Estimé",
    sourceManual: "Manuel",
    sourceDevice: "Appareil",
    confidenceLow: "Faible",
    confidenceMedium: "Moyenne",
    confidenceHigh: "Élevée",
    evidenceTitle: "Comment VYVA relie vos données de santé",
    evidenceBody: "VYVA rassemble vos mesures et les compare à votre référence personnelle : ce qui est habituel pour vous. Elle analyse leur évolution et les signaux qui changent ensemble afin de repérer les tendances, les schémas et les risques possibles avant qu’ils ne deviennent évidents.",
    evidencePhone: "Apprend votre référence : comprend ce qui est habituel pour vous",
    evidenceManual: "Relie les signaux : constantes, symptômes, sommeil, humeur et médicaments",
    evidenceDevice: "Anticipe : utilise les schémas émergents pour prévoir les évolutions possibles et signaler les risques",
    addEvidenceNote: "Saisissez le nombre tel qu'il apparait sur votre appareil, ou notez comment vous vous sentez. Cela aide VYVA a affiner l'evaluation.",
    sourceClinical: "Clinique",
    loadError: "Impossible de charger vos constantes maintenant.",
    saveError: "Impossible d'enregistrer cette mesure.",
    analysisError: "L'analyse n'a pas pu se terminer.",
    actionError: "Impossible d'enregistrer cette action.",
    checkConnectedSensor: "Vérifier le capteur connecté",
    manualGlucoseEntry: "Saisie manuelle de glycémie",
    connectedGlucoseHelp: "Si aucune mesure automatique n'est disponible, saisissez ici le nombre du lecteur de glycémie.",
    manualGlucoseHelp: "Saisissez le nombre du lecteur de glycémie pour l'enregistrer avec vos constantes.",
    whenReading: "Quand cette mesure a-t-elle été prise ?",
    moreOptions: "Autres options",
    ok: "OK",
  },
  it: {
    add: "Aggiungi lettura",
    analyse: "Aggiorna valutazione",
    analysing: "Analisi...",
    loading: "Preparazione dei parametri...",
    back: "Indietro",
    save: "Salva lettura",
    saving: "Salvataggio...",
    lastAnalysis: "Ultima analisi",
    noAnalysis: "Nessuna analisi ancora",
    now: "Ora",
    normal: "Normale",
    today: "Oggi",
    yes: "Si, presa",
    no: "Non ancora",
    messageFallback: "Buongiorno. VYVA e pronta a rivedere i tuoi segnali con te.",
    safetyTitle: "Controllo quotidiano",
    safetyAck: "Registrato",
    recheck: "Ricontrolla",
    share: "Condividi",
    doctor: "Medico",
    urgent: "Urgente",
    sourceEstimated: "Stimato",
    sourceManual: "Manuale",
    sourceDevice: "Dispositivo",
    confidenceLow: "Bassa",
    confidenceMedium: "Media",
    confidenceHigh: "Alta",
    evidenceTitle: "Come VYVA collega i tuoi dati di salute",
    evidenceBody: "VYVA riunisce le tue misurazioni e le confronta con il tuo riferimento personale: ciò che è abituale per te. Analizza i cambiamenti nel tempo e i segnali che variano insieme per individuare tendenze, schemi e possibili rischi prima che diventino evidenti.",
    evidencePhone: "Impara il tuo riferimento: comprende ciò che è abituale per te",
    evidenceManual: "Collega i segnali: parametri vitali, sintomi, sonno, umore e farmaci",
    evidenceDevice: "Guarda avanti: usa gli schemi emergenti per anticipare possibili esiti e segnalare i rischi",
    addEvidenceNote: "Inserisci il numero esattamente come appare sul dispositivo, o registra come ti senti. Questo aiuta VYVA a perfezionare la valutazione.",
    sourceClinical: "Clinico",
    loadError: "Impossibile caricare i parametri ora.",
    saveError: "Impossibile salvare questa lettura.",
    analysisError: "L'analisi non e stata completata.",
    actionError: "Impossibile registrare questa azione.",
    checkConnectedSensor: "Controlla sensore connesso",
    manualGlucoseEntry: "Inserimento manuale glucosio",
    connectedGlucoseHelp: "Se non e disponibile una lettura automatica, inserisci qui il numero del glucometro.",
    manualGlucoseHelp: "Digita il numero del glucometro per salvarlo con i tuoi parametri.",
    whenReading: "Quando e stata presa questa misura?",
    moreOptions: "Altre opzioni",
    ok: "OK",
  },
  pt: {
    add: "Adicionar leitura",
    analyse: "Atualizar avaliação",
    analysing: "A analisar...",
    loading: "A preparar os seus sinais...",
    back: "Voltar",
    save: "Guardar leitura",
    saving: "A guardar...",
    lastAnalysis: "Ultima analise",
    noAnalysis: "Sem analise ainda",
    now: "Agora",
    normal: "Normal",
    today: "Hoje",
    yes: "Sim, tomado",
    no: "Ainda nao",
    messageFallback: "Bom dia. A VYVA esta pronta para rever os seus sinais consigo.",
    safetyTitle: "Verificacao diaria",
    safetyAck: "Registado",
    recheck: "Rever",
    share: "Partilhar",
    doctor: "Medico",
    urgent: "Urgente",
    sourceEstimated: "Estimado",
    sourceManual: "Manual",
    sourceDevice: "Dispositivo",
    confidenceLow: "Baixa",
    confidenceMedium: "Media",
    confidenceHigh: "Alta",
    evidenceTitle: "Como a VYVA liga os seus dados de saúde",
    evidenceBody: "A VYVA reúne as suas medições e compara-as com a sua referência pessoal: aquilo que é habitual para si. Analisa alterações ao longo do tempo e sinais que mudam em conjunto para identificar tendências, padrões e possíveis riscos antes de se tornarem evidentes.",
    evidencePhone: "Aprende a sua referência: compreende o que é habitual para si",
    evidenceManual: "Liga os sinais: sinais vitais, sintomas, sono, humor e medicação",
    evidenceDevice: "Antecipa: usa padrões emergentes para prever possíveis resultados e sinalizar riscos",
    addEvidenceNote: "Introduza o numero exatamente como aparece no dispositivo, ou registe como se sente. Isto ajuda a VYVA a refinar a avaliacao.",
    sourceClinical: "Clinico",
    loadError: "Nao foi possivel carregar os seus sinais agora.",
    saveError: "Nao foi possivel guardar esta leitura.",
    analysisError: "A analise nao conseguiu terminar.",
    actionError: "Nao foi possivel registar esta acao.",
    checkConnectedSensor: "Verificar sensor ligado",
    manualGlucoseEntry: "Entrada manual de glicose",
    connectedGlucoseHelp: "Se nao houver leitura automatica disponivel, introduza aqui o numero do medidor de glicose.",
    manualGlucoseHelp: "Digite o numero do medidor de glicose para guardar com os seus sinais.",
    whenReading: "Quando foi esta medicao?",
    moreOptions: "Mais opções",
    ok: "OK",
  },
};

function copyFor(language: Language) {
  return { ...COPY.en, ...(COPY_BASE[language] ?? {}), ...COPY_OVERRIDES[language] };
}

function textFor(values: LocalizedText, language: Language): string {
  return values[language] ?? values.en ?? values.es ?? "";
}

const SIGNAL_CONFIG = {
  glucose_mgdl: {
    label: { es: "Glucosa", de: "Blutzucker", en: "Glucose" },
    unit: "mg/dL",
    icon: "drop",
    placeholder: "142",
    question: { es: "¿Cuánto marca tu glucómetro?", de: "Was zeigt dein Blutzuckermessgerät?", en: "What does your glucose meter show?" },
    contexts: [
      { key: "fasting", label: { es: "Ayunas", de: "Nüchtern", en: "Fasting" } },
      { key: "post_meal_2h", label: { es: "Tras comer", de: "Nach dem Essen", en: "After meal" } },
      { key: "nocturnal", label: { es: "Noche", de: "Nachts", en: "Night" } },
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
    ],
    conditions: [],
  },
  resting_hr_bpm: {
    label: { es: "Pulso", de: "Puls", en: "Heart rate" },
    unit: "bpm",
    icon: "heart",
    placeholder: "72",
    question: { es: "¿Cuántas pulsaciones por minuto?", de: "Wie viele Herzschläge pro Minute?", en: "How many beats per minute?" },
    contexts: [
      { key: "morning", label: { es: "Por la mañana", de: "Morgens", en: "Morning" } },
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
    ],
    conditions: [],
  },
  respiratory_rate: {
    label: { es: "Respiracion", de: "Atemfrequenz", en: "Breathing rate" },
    unit: "/min",
    icon: "wind",
    placeholder: "16",
    question: { es: "Cuantas respiraciones por minuto?", de: "Wie viele Atemzuge pro Minute?", en: "How many breaths per minute?" },
    contexts: [
      { key: "resting", label: { es: "En reposo", de: "In Ruhe", en: "Resting" } },
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
    ],
    conditions: [],
  },
  oxygen_saturation: {
    label: { es: "Oxigeno", de: "Sauerstoff", en: "Oxygen" },
    unit: "%",
    icon: "oxygen",
    placeholder: "97",
    question: { es: "Cuanto marca el oximetro?", de: "Was zeigt das Pulsoximeter?", en: "What does the pulse oximeter show?" },
    contexts: [
      { key: "resting", label: { es: "En reposo", de: "In Ruhe", en: "Resting" } },
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
    ],
    conditions: [],
  },
  temperature_c: {
    label: { es: "Temperatura", de: "Temperatur", en: "Temperature" },
    unit: "C",
    icon: "thermometer",
    placeholder: "37.2",
    question: { es: "Cuanto marca el termometro?", de: "Was zeigt das Thermometer?", en: "What does the thermometer show?" },
    contexts: [
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
      { key: "evening", label: { es: "Tarde", de: "Abends", en: "Evening" } },
    ],
    conditions: [],
  },
  bp_systolic: {
    label: { es: "Tensión", de: "Blutdruck", en: "Blood pressure" },
    unit: "mmHg",
    icon: "stethoscope",
    placeholder: "128",
    question: { es: "¿Cuánto marca el tensiómetro? (número alto)", de: "Was zeigt das Blutdruckmessgerät? (obere Zahl)", en: "What does the BP monitor show? (top number)" },
    contexts: [
      { key: "morning", label: { es: "Mañana", de: "Morgens", en: "Morning" } },
      { key: "evening", label: { es: "Tarde", de: "Abends", en: "Evening" } },
    ],
    conditions: [],
  },
  weight_kg: {
    label: { es: "Peso", de: "Gewicht", en: "Weight" },
    unit: "kg",
    icon: "scale",
    placeholder: "70",
    question: { es: "Cuanto marca la bascula?", de: "Was zeigt die Waage?", en: "What does the scale show?" },
    contexts: [
      { key: "morning", label: { es: "Manana", de: "Morgens", en: "Morning" } },
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
    ],
    conditions: [],
  },
  pain_score: {
    label: { es: "Dolor", de: "Schmerz", en: "Pain" },
    unit: "/10",
    icon: "pain",
    placeholder: "4",
    question: { es: "Cuanto dolor tienes? (0 = nada, 10 = mucho)", de: "Wie stark sind die Schmerzen? (0 = keine, 10 = stark)", en: "How much pain do you have? (0 = none, 10 = severe)" },
    contexts: [{ key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } }],
    conditions: [],
  },
  sleep_quality_score: {
    label: { es: "Sueño", de: "Schlaf", en: "Sleep" },
    unit: "/10",
    icon: "moon",
    placeholder: "7",
    question: { es: "¿Cómo dormiste anoche? (1 = muy mal, 10 = muy bien)", de: "Wie haben Sie letzte Nacht geschlafen? (1 = sehr schlecht, 10 = sehr gut)", en: "How did you sleep last night? (1 = very badly, 10 = very well)" },
    contexts: [{ key: "general", label: { es: "Anoche", de: "Letzte Nacht", en: "Last night" } }],
    conditions: [],
  },
  energy_level: {
    label: { es: "Energia", de: "Energie", en: "Energy" },
    unit: "/10",
    icon: "energy",
    placeholder: "6",
    question: { es: "Cuanta energia tienes hoy? (1 = muy baja, 10 = alta)", de: "Wie viel Energie haben Sie heute? (1 = sehr niedrig, 10 = hoch)", en: "How much energy do you have today? (1 = very low, 10 = high)" },
    contexts: [{ key: "general", label: { es: "Hoy", de: "Heute", en: "Today" } }],
    conditions: [],
  },
  medication_confirmed: {
    label: { es: "Medicación", de: "Medikamente", en: "Medication" },
    unit: "",
    icon: "pill",
    placeholder: "1",
    question: { es: "¿Has tomado tu medicación hoy?", de: "Haben Sie heute Ihre Medikamente genommen?", en: "Have you taken your medication today?" },
    contexts: [
      { key: "morning", label: { es: "Mañana", de: "Morgens", en: "Morning" } },
      { key: "evening", label: { es: "Noche", de: "Abends", en: "Evening" } },
    ],
    conditions: [],
    isBinary: true,
  },
  mood_score: {
    label: { es: "Ánimo", de: "Stimmung", en: "Mood" },
    unit: "/10",
    icon: "smile",
    placeholder: "7",
    question: { es: "¿Cómo te sientes hoy? (1 = muy mal, 10 = excelente)", de: "Wie fühlen Sie sich heute? (1 = sehr schlecht, 10 = ausgezeichnet)", en: "How are you feeling today? (1 = very bad, 10 = excellent)" },
    contexts: [{ key: "general", label: { es: "Hoy", de: "Heute", en: "Today" } }],
    conditions: [],
  },
} as const;

interface SignalTranslation {
  label?: string;
  question?: string;
  contexts?: Record<string, string>;
}

const SIGNAL_TRANSLATIONS: Partial<Record<Language, Partial<Record<SignalKey, SignalTranslation>>>> = {
  fr: {
    glucose_mgdl: {
      label: "Glycemie",
      question: "Que montre votre lecteur de glycemie?",
      contexts: { fasting: "A jeun", post_meal_2h: "Apres repas", nocturnal: "Nuit", general: "Maintenant" },
    },
    resting_hr_bpm: {
      label: "Pouls",
      question: "Combien de battements par minute?",
      contexts: { morning: "Matin", general: "Maintenant" },
    },
    respiratory_rate: {
      label: "Respiration",
      question: "Combien de respirations par minute?",
      contexts: { resting: "Au repos", general: "Maintenant" },
    },
    oxygen_saturation: {
      label: "Oxygene",
      question: "Que montre l'oxymetre?",
      contexts: { resting: "Au repos", general: "Maintenant" },
    },
    temperature_c: {
      label: "Temperature",
      question: "Que montre le thermometre?",
      contexts: { general: "Maintenant", evening: "Soir" },
    },
    bp_systolic: {
      label: "Tension",
      question: "Que montre le tensiometre? (nombre du haut)",
      contexts: { morning: "Matin", evening: "Soir" },
    },
    weight_kg: {
      label: "Poids",
      question: "Que montre la balance?",
      contexts: { morning: "Matin", general: "Maintenant" },
    },
    pain_score: {
      label: "Douleur",
      question: "Quel niveau de douleur avez-vous? (0 = aucune, 10 = forte)",
      contexts: { general: "Maintenant" },
    },
    sleep_quality_score: {
      label: "Sommeil",
      question: "Comment avez-vous dormi cette nuit? (1 = tres mal, 10 = tres bien)",
      contexts: { general: "Cette nuit" },
    },
    energy_level: {
      label: "Energie",
      question: "Quel est votre niveau d'energie aujourd'hui? (1 = tres bas, 10 = eleve)",
      contexts: { general: "Aujourd'hui" },
    },
    medication_confirmed: {
      label: "Medicament",
      question: "Avez-vous pris votre medicament aujourd'hui?",
      contexts: { morning: "Matin", evening: "Soir" },
    },
    mood_score: {
      label: "Humeur",
      question: "Comment vous sentez-vous aujourd'hui? (1 = tres mal, 10 = excellent)",
      contexts: { general: "Aujourd'hui" },
    },
  },
  it: {
    glucose_mgdl: {
      label: "Glucosio",
      question: "Cosa mostra il glucometro?",
      contexts: { fasting: "A digiuno", post_meal_2h: "Dopo pasto", nocturnal: "Notte", general: "Ora" },
    },
    resting_hr_bpm: {
      label: "Polso",
      question: "Quanti battiti al minuto?",
      contexts: { morning: "Mattina", general: "Ora" },
    },
    respiratory_rate: {
      label: "Respirazione",
      question: "Quanti respiri al minuto?",
      contexts: { resting: "A riposo", general: "Ora" },
    },
    oxygen_saturation: {
      label: "Ossigeno",
      question: "Cosa mostra il pulsossimetro?",
      contexts: { resting: "A riposo", general: "Ora" },
    },
    temperature_c: {
      label: "Temperatura",
      question: "Cosa mostra il termometro?",
      contexts: { general: "Ora", evening: "Sera" },
    },
    bp_systolic: {
      label: "Pressione",
      question: "Cosa mostra il misuratore di pressione? (numero alto)",
      contexts: { morning: "Mattina", evening: "Sera" },
    },
    weight_kg: {
      label: "Peso",
      question: "Cosa mostra la bilancia?",
      contexts: { morning: "Mattina", general: "Ora" },
    },
    pain_score: {
      label: "Dolore",
      question: "Quanto dolore hai? (0 = niente, 10 = forte)",
      contexts: { general: "Ora" },
    },
    sleep_quality_score: {
      label: "Sonno",
      question: "Come hai dormito questa notte? (1 = molto male, 10 = molto bene)",
      contexts: { general: "Questa notte" },
    },
    energy_level: {
      label: "Energia",
      question: "Quanta energia hai oggi? (1 = molto bassa, 10 = alta)",
      contexts: { general: "Oggi" },
    },
    medication_confirmed: {
      label: "Farmaci",
      question: "Hai preso i farmaci oggi?",
      contexts: { morning: "Mattina", evening: "Sera" },
    },
    mood_score: {
      label: "Umore",
      question: "Come ti senti oggi? (1 = molto male, 10 = eccellente)",
      contexts: { general: "Oggi" },
    },
  },
  pt: {
    glucose_mgdl: {
      label: "Glicose",
      question: "O que mostra o medidor de glicose?",
      contexts: { fasting: "Em jejum", post_meal_2h: "Depois da refeicao", nocturnal: "Noite", general: "Agora" },
    },
    resting_hr_bpm: {
      label: "Pulso",
      question: "Quantas batidas por minuto?",
      contexts: { morning: "Manha", general: "Agora" },
    },
    respiratory_rate: {
      label: "Respiracao",
      question: "Quantas respiracoes por minuto?",
      contexts: { resting: "Em repouso", general: "Agora" },
    },
    oxygen_saturation: {
      label: "Oxigenio",
      question: "O que mostra o oximetro?",
      contexts: { resting: "Em repouso", general: "Agora" },
    },
    temperature_c: {
      label: "Temperatura",
      question: "O que mostra o termometro?",
      contexts: { general: "Agora", evening: "Noite" },
    },
    bp_systolic: {
      label: "Tensao",
      question: "O que mostra o medidor de tensao? (numero alto)",
      contexts: { morning: "Manha", evening: "Noite" },
    },
    weight_kg: {
      label: "Peso",
      question: "O que mostra a balanca?",
      contexts: { morning: "Manha", general: "Agora" },
    },
    pain_score: {
      label: "Dor",
      question: "Quanta dor sente? (0 = nenhuma, 10 = forte)",
      contexts: { general: "Agora" },
    },
    sleep_quality_score: {
      label: "Sono",
      question: "Como dormiu esta noite? (1 = muito mal, 10 = muito bem)",
      contexts: { general: "Esta noite" },
    },
    energy_level: {
      label: "Energia",
      question: "Quanta energia tem hoje? (1 = muito baixa, 10 = alta)",
      contexts: { general: "Hoje" },
    },
    medication_confirmed: {
      label: "Medicacao",
      question: "Tomou a sua medicacao hoje?",
      contexts: { morning: "Manha", evening: "Noite" },
    },
    mood_score: {
      label: "Humor",
      question: "Como se sente hoje? (1 = muito mal, 10 = excelente)",
      contexts: { general: "Hoje" },
    },
  },
};

function signalLabel(signalKey: SignalKey, cfg: typeof SIGNAL_CONFIG[SignalKey], language: Language): string {
  return SIGNAL_TRANSLATIONS[language]?.[signalKey]?.label ?? textFor(cfg.label, language);
}

function signalQuestion(signalKey: SignalKey, cfg: typeof SIGNAL_CONFIG[SignalKey], language: Language): string {
  return SIGNAL_TRANSLATIONS[language]?.[signalKey]?.question ?? textFor(cfg.question, language);
}

function signalContextLabel(signalKey: SignalKey, context: { key: string; label: LocalizedText }, language: Language): string {
  return SIGNAL_TRANSLATIONS[language]?.[signalKey]?.contexts?.[context.key] ?? textFor(context.label, language);
}

const DISPLAY_GROUP_ORDER: VitalsDisplayGroup[] = ["heart", "breathing", "blood", "body", "wellbeing", "activity", "labs"];

const DISPLAY_GROUP_LABELS: Record<VitalsDisplayGroup, Record<Language, string>> = {
  heart: { en: "Heart", es: "Corazon", de: "Herz", fr: "Coeur", it: "Cuore", pt: "Coracao" },
  breathing: { en: "Breathing", es: "Respiracion", de: "Atmung", fr: "Respiration", it: "Respirazione", pt: "Respiracao" },
  blood: { en: "Blood", es: "Sangre", de: "Blut", fr: "Sang", it: "Sangue", pt: "Sangue" },
  body: { en: "Body", es: "Cuerpo", de: "Korper", fr: "Corps", it: "Corpo", pt: "Corpo" },
  wellbeing: { en: "Wellbeing", es: "Bienestar", de: "Wohlbefinden", fr: "Bien-etre", it: "Benessere", pt: "Bem-estar" },
  activity: { en: "Activity", es: "Actividad", de: "Aktivitat", fr: "Activite", it: "Attivita", pt: "Atividade" },
  labs: { en: "Labs", es: "Analisis", de: "Labor", fr: "Analyses", it: "Esami", pt: "Analises" },
};

const DASHBOARD_LABELS: Record<Language, {
  latest: string;
  latestSingle: string;
  more: string;
  risk: string;
  lower: string;
  nearBaseline: string;
  aboveBaseline: string;
  belowBaseline: string;
}> = {
  en: { latest: "Latest readings", latestSingle: "Latest reading", more: "More vitals", risk: "Risk score", lower: "Lower is better", nearBaseline: "Near your baseline", aboveBaseline: "above your baseline", belowBaseline: "below your baseline" },
  es: { latest: "Últimas mediciones", latestSingle: "Última medición", more: "Más signos", risk: "Nivel de riesgo", lower: "Cuanto más bajo, mejor", nearBaseline: "Cerca de tu referencia", aboveBaseline: "por encima de tu referencia", belowBaseline: "por debajo de tu referencia" },
  de: { latest: "Letzte Messwerte", latestSingle: "Letzter Messwert", more: "Weitere Vitalwerte", risk: "Risikowert", lower: "Niedriger ist besser", nearBaseline: "Nahe deinem Basiswert", aboveBaseline: "über deinem Basiswert", belowBaseline: "unter deinem Basiswert" },
  fr: { latest: "Dernières mesures", latestSingle: "Dernière mesure", more: "Autres constantes", risk: "Score de risque", lower: "Plus bas, c'est mieux", nearBaseline: "Proche de votre référence", aboveBaseline: "au-dessus de votre référence", belowBaseline: "en dessous de votre référence" },
  it: { latest: "Ultime letture", latestSingle: "Ultima lettura", more: "Altri parametri", risk: "Punteggio di rischio", lower: "Più basso è meglio", nearBaseline: "Vicino al tuo valore base", aboveBaseline: "sopra il tuo valore base", belowBaseline: "sotto il tuo valore base" },
  pt: { latest: "Leituras recentes", latestSingle: "Leitura mais recente", more: "Mais sinais", risk: "Pontuação de risco", lower: "Quanto mais baixo, melhor", nearBaseline: "Perto da sua referência", aboveBaseline: "acima da sua referência", belowBaseline: "abaixo da sua referência" },
};

function heroMarkerMessage(deviation: number | null, language: Language) {
  const labels = DASHBOARD_LABELS[language];
  if (deviation == null) return labels.latestSingle;
  if (deviation === 0) return labels.nearBaseline;
  return `${Math.abs(deviation)}% ${deviation > 0 ? labels.aboveBaseline : labels.belowBaseline}`;
}

function SignalIcon({ type, className = "" }: { type: string; className?: string }) {
  if (type === "heart") return <VyvaIcon icon={HeartPulse} accent="pulse" size={28} className={className} />;
  if (type === "wind") return <VyvaIcon icon={Wind} accent="signal" size={28} className={className} />;
  if (type === "oxygen") return <VyvaIcon icon={Activity} accent="pulse" size={28} className={className} />;
  if (type === "thermometer") return <VyvaIcon icon={Thermometer} accent="dot" size={28} className={className} />;
  if (type === "scale") return <VyvaIcon icon={Scale} accent="divider" size={28} className={className} />;
  if (type === "energy") return <VyvaIcon icon={Zap} accent="spark" size={28} className={className} />;
  if (type === "stethoscope") return <VyvaIcon icon={Stethoscope} accent="scope" size={28} className={className} />;
  if (type === "moon") return <VyvaIcon icon={Moon} accent="spark" size={28} className={className} />;
  if (type === "pill") return <VyvaIcon icon={Pill} accent="divider" size={28} className={className} />;
  if (type === "smile") return <VyvaIcon icon={Smile} accent="smile" size={28} className={className} />;
  return <VyvaIcon icon={Activity} accent="pulse" size={28} className={className} />;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readingValueDisplay(signalKey: SignalKey, reading: RecentReading): string {
  const value = numberValue(reading.value);
  if (signalKey === "medication_confirmed") {
    return value === 1 ? "✓" : value === 0 ? "—" : "--";
  }
  if (value == null) return "--";
  const unit = reading.unit || VITALS_SIGNAL_CATALOG[signalKey].unit;
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function getRiskColor(score: number) {
  if (score < 30) return "#22C55E";
  if (score < 50) return "#F59E0B";
  if (score < 75) return "rgba(239,68,68,0.7)";
  return "#EF4444";
}

function getRiskLabel(score: number, language: Language) {
  const labels: Record<Language, string[]> = {
    es: ["Todo bien", "Atención leve", "Requiere atención", "Urgente"],
    de: ["Alles gut", "Leichte Aufmerksamkeit", "Aufmerksamkeit erforderlich", "Dringend"],
    en: ["All good", "Mild attention", "Needs attention", "Urgent"],
    fr: ["Tout va bien", "Attention legere", "Attention necessaire", "Urgent"],
    it: ["Tutto bene", "Lieve attenzione", "Richiede attenzione", "Urgente"],
    pt: ["Tudo bem", "Atencao ligeira", "Requer atencao", "Urgente"],
  };
  const lang = labels[language];
  if (score < 30) return lang[0];
  if (score < 50) return lang[1];
  if (score < 75) return lang[2];
  return lang[3];
}

function normalizeSafetyStatus(value: unknown): SafetyStatus {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "urgent_help" || raw === "urgent") return "urgent_help";
  if (raw === "contact_doctor" || raw === "doctor_today") return "contact_doctor";
  if (raw === "share_with_caregiver" || raw === "notify") return "share_with_caregiver";
  if (raw === "recheck" || raw === "watch") return "recheck";
  return "steady";
}

function safetyTone(status: SafetyStatus) {
  if (status === "urgent_help") return { color: "#DC2626", bg: "#FEF2F2", Icon: AlertTriangle };
  if (status === "contact_doctor") return { color: "#B45309", bg: "#FFF7ED", Icon: PhoneCall };
  if (status === "share_with_caregiver") return { color: "#6B21A8", bg: "#F5F3FF", Icon: Bell };
  if (status === "recheck") return { color: "#0369A1", bg: "#EFF6FF", Icon: RefreshCw };
  return { color: "#047857", bg: "#ECFDF5", Icon: ShieldCheck };
}

function safetyLabel(status: SafetyStatus, language: Language) {
  const labels: Record<Language, Record<SafetyStatus, string>> = {
    es: {
      steady: "Estable",
      recheck: "Repetir medicion",
      share_with_caregiver: "Compartir con cuidador",
      contact_doctor: "Consultar medico",
      urgent_help: "Ayuda urgente",
    },
    de: {
      steady: "Stabil",
      recheck: "Erneut prufen",
      share_with_caregiver: "Mit Betreuung teilen",
      contact_doctor: "Arzt kontaktieren",
      urgent_help: "Dringende Hilfe",
    },
    en: {
      steady: "Steady",
      recheck: "Recheck",
      share_with_caregiver: "Share with caregiver",
      contact_doctor: "Contact doctor",
      urgent_help: "Urgent help",
    },
    fr: {
      steady: "Stable",
      recheck: "Vérifier à nouveau",
      share_with_caregiver: "Partager avec l'aidant",
      contact_doctor: "Contacter le médecin",
      urgent_help: "Aide urgente",
    },
    it: {
      steady: "Stabile",
      recheck: "Ricontrolla",
      share_with_caregiver: "Condividi con caregiver",
      contact_doctor: "Contatta medico",
      urgent_help: "Aiuto urgente",
    },
    pt: {
      steady: "Estavel",
      recheck: "Rever",
      share_with_caregiver: "Partilhar com cuidador",
      contact_doctor: "Contactar medico",
      urgent_help: "Ajuda urgente",
    },
  };
  return labels[language][status];
}

const FRENCH_SAFETY_MESSAGES: Record<SafetyStatus, string> = {
  steady: "Vos mesures récentes semblent stables. Gardez vos habitudes et vérifiez à nouveau si quelque chose change.",
  recheck: "VYVA vous recommande de reprendre cette mesure afin de confirmer le changement.",
  share_with_caregiver: "VYVA a détecté un changement. Il serait prudent d’en parler à votre aidant et de reprendre la mesure.",
  contact_doctor: "VYVA a détecté un changement qui mérite un avis médical aujourd’hui. Partagez ce résumé si vous le pouvez.",
  urgent_help: "VYVA a détecté un signal de sécurité important. Si cela se produit maintenant, demandez une aide urgente ou appelez les secours.",
};

function isKnownEnglishSafetyMessage(message: string) {
  return /^(VYVA noticed|VYVA recommends|Complete today's check|Your recent check|Your latest readings|Please speak with your doctor|Your readings need urgent support)/i.test(message.trim());
}

function seniorMessageForDisplay(message: string | null | undefined, status: SafetyStatus, language: Language) {
  if (!message?.trim()) return copyFor(language).messageFallback;
  if (language === "fr" && isKnownEnglishSafetyMessage(message)) return FRENCH_SAFETY_MESSAGES[status];
  return message.trim();
}

function alertMessageForDisplay(alert: LatestAlert, status: SafetyStatus, language: Language) {
  if (language !== "fr") return alert.message;

  const symptomMatch = alert.message.match(/(?:Symptom report|Rapport de symptômes)\s*:\s*([^\n]+)/i);
  if (symptomMatch?.[1]?.trim()) return `Rapport de symptômes : ${symptomMatch[1].trim()}`;

  if (status === "urgent_help") return "Un signal récent nécessite une aide urgente. Consultez immédiatement les recommandations enregistrées.";
  if (status === "contact_doctor") return "Un signal récent mérite un avis médical aujourd’hui. Consultez le rapport enregistré.";
  return "Un signal récent est disponible dans vos rapports.";
}

function sanitizePhoneHref(phone?: string | null): string {
  const raw = phone?.trim();
  if (!raw) return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  return `tel:${normalized || raw}`;
}

function emailHref(email?: string | null, subject = "", body = ""): string {
  const raw = email?.trim();
  if (!raw) return "";
  return `mailto:${raw}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function emergencyContactForCountry(country?: string | null) {
  const code = (country ?? "ES").trim().toUpperCase() || "ES";
  const numberByCountry: Record<string, string> = {
    ES: "112",
    FR: "112",
    DE: "112",
    IT: "112",
    PT: "112",
    IE: "112",
    GB: "999",
    UK: "999",
    US: "911",
    CA: "911",
    AU: "000",
  };
  const number = numberByCountry[code];
  return number ? { label: number, telHref: `tel:${number}` } : null;
}

function isEmailContact(value?: string | null) {
  return Boolean(value?.includes("@"));
}

function contactHref(value?: string | null, subject = "", body = "") {
  if (!value?.trim()) return "";
  return isEmailContact(value) ? emailHref(value, subject, body) : sanitizePhoneHref(value);
}

export function vitalsSafetyActionKindsFor(
  status: SafetyStatus,
  availability: { hasEmergencyContact?: boolean; hasGpPhone?: boolean; hasGpEmail?: boolean; hasCaregiverContact?: boolean } = {},
): VitalsSafetyActionKind[] {
  if (status === "urgent_help") {
    return availability.hasEmergencyContact ? ["call_emergency", "doctor_help", "book_ride"] : ["doctor_help", "book_ride"];
  }

  if (status === "contact_doctor") {
    const actions: VitalsSafetyActionKind[] = [];
    if (availability.hasGpPhone) actions.push("call_gp");
    if (availability.hasGpEmail) actions.push("email_gp");
    actions.push("doctor_help");
    actions.push("schedule_appointment", "book_ride");
    if (!availability.hasGpPhone && !availability.hasGpEmail) actions.push("add_doctor_contact");
    return actions;
  }

  if (status === "share_with_caregiver") return ["share_summary"];

  if (status === "recheck") return ["recheck"];
  return [];
}

function buildVitalsContext({
  analysis,
  recentReadings,
  language,
}: {
  analysis: LatestAnalysis | null;
  recentReadings: RecentReading[];
  language: Language;
}) {
  const status = normalizeSafetyStatus(analysis?.recommended_action ?? analysis?.safety_status);
  const localizedMessage = seniorMessageForDisplay(analysis?.senior_message, status, language);
  const contextLabels: Record<Language, { title: string; note: string; risk: string }> = {
    en: { title: "VYVA vitals summary", note: "VYVA note", risk: "Risk score" },
    es: { title: "Resumen de signos VYVA", note: "Nota VYVA", risk: "Nivel" },
    de: { title: "VYVA Vitalwerte", note: "VYVA Hinweis", risk: "Risikowert" },
    fr: { title: "Résumé des constantes VYVA", note: "Note VYVA", risk: "Score de risque" },
    it: { title: "Riepilogo dei parametri VYVA", note: "Nota VYVA", risk: "Punteggio di rischio" },
    pt: { title: "Resumo dos sinais VYVA", note: "Nota VYVA", risk: "Pontuação de risco" },
  };
  const labels = contextLabels[language];
  const lines = [
    labels.title,
    analysis?.senior_message ? `${labels.note}: ${localizedMessage}` : "",
    analysis?.risk_score != null ? `${labels.risk}: ${analysis.risk_score}/100` : "",
    ...recentReadings.slice(0, 5).map((reading) => `${reading.signal_type}: ${reading.value}${reading.context_tag ? ` (${reading.context_tag})` : ""}`),
  ];
  return lines.filter(Boolean).join("\n");
}

function readingSourceBadge(reading: RecentReading | undefined, language: Language) {
  if (!reading) return null;
  const copy = copyFor(language);
  const source = reading.source;
  const confidence = reading.source_confidence ?? (source === "phone_estimate" ? "low" : source === "connected_device" || source === "clinical" ? "high" : "medium");
  const confidenceLabel =
    confidence === "high"
      ? copy.confidenceHigh
      : confidence === "low"
        ? copy.confidenceLow
        : copy.confidenceMedium;
  if (source === "phone_estimate") return { shortLabel: copy.sourceEstimated, fullLabel: `${copy.sourceEstimated} - ${confidenceLabel}`, bg: "#F5F3FF", color: "#6B21A8" };
  if (source === "connected_device") return { shortLabel: copy.sourceDevice, fullLabel: `${copy.sourceDevice} - ${confidenceLabel}`, bg: "#D1FAE5", color: "#047857" };
  if (source === "clinical") return { shortLabel: copy.sourceClinical, fullLabel: `${copy.sourceClinical} - ${confidenceLabel}`, bg: "#E0F2FE", color: "#0369A1" };
  return { shortLabel: copy.sourceManual, fullLabel: `${copy.sourceManual} - ${confidenceLabel}`, bg: "#FEF3C7", color: "#92400E" };
}

function relativeTime(iso: string | null | undefined, language: Language) {
  if (!iso) return copyFor(language).noAnalysis;
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (language === "fr") {
    if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
    const hours = Math.round(diffMinutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    return `il y a ${Math.round(hours / 24)} jours`;
  }
  if (language === "it") {
    if (diffMinutes < 60) return `${diffMinutes} min fa`;
    const hours = Math.round(diffMinutes / 60);
    if (hours < 24) return `${hours} ore fa`;
    return `${Math.round(hours / 24)} giorni fa`;
  }
  if (language === "pt") {
    if (diffMinutes < 60) return `ha ${diffMinutes} min`;
    const hours = Math.round(diffMinutes / 60);
    if (hours < 24) return `ha ${hours} horas`;
    return `ha ${Math.round(hours / 24)} dias`;
  }
  if (diffMinutes < 60) return language === "es" ? `hace ${diffMinutes} min` : language === "de" ? `vor ${diffMinutes} Min.` : `${diffMinutes} min ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return language === "es" ? `hace ${hours} horas` : language === "de" ? `vor ${hours} Std.` : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return language === "es" ? `hace ${days} días` : language === "de" ? `vor ${days} Tagen` : `${days} days ago`;
}

export default function VitalsTracker({
  userId,
  userConditions,
  previewData,
  language = "es",
  country,
  gpName,
  gpPhone,
  gpEmail,
  caregiverContact,
  onBackActionChange,
  onVoiceStateChange,
}: Props) {
  const navigate = useNavigate();
  const { isDark } = useHomeMasterTheme();
  const [searchParams] = useSearchParams();
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [analysis, setAnalysis] = useState<LatestAnalysis | null>(previewData?.analysis ?? null);
  const [recentReadings, setRecentReadings] = useState<RecentReading[]>(previewData?.recent_readings ?? []);
  const [latestAlert, setLatestAlert] = useState<LatestAlert | null>(previewData?.latest_alert ?? null);
  const [loading, setLoading] = useState(!previewData);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heroMarkerIndex, setHeroMarkerIndex] = useState(0);

  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const showDashboard = useCallback(() => setScreen("dashboard"), []);
  const showAddReading = useCallback(() => setScreen("add"), []);

  const copy = useMemo(() => copyFor(language), [language]);
  const gpCallLabel = gpName?.trim() ? `${copy.call} ${gpName.trim()}` : copy.callGp;
  const visibleSignals = useMemo(() => getVisibleSignals(userConditions), [userConditions]);
  const heroMarkers = useMemo(() => {
    const seen = new Set<SignalKey>();
    return recentReadings.filter((reading) => {
      if (!(reading.signal_type in SIGNAL_CONFIG)) return false;
      const signalKey = reading.signal_type as SignalKey;
      if (seen.has(signalKey)) return false;
      seen.add(signalKey);
      return true;
    }).slice(0, 4);
  }, [recentReadings]);
  const heroMetricCount = heroMarkers.length + 1;
  const riskScore = analysis?.risk_score ?? 0;
  const riskColor = getRiskColor(riskScore);
  const safetyStatus = normalizeSafetyStatus(analysis?.recommended_action ?? analysis?.safety_status);
  const addSource = searchParams.get("source");
  const requestedAddSignal = searchParams.get("add");
  const initialAddSignal = requestedAddSignal === "glucose"
    ? "glucose_mgdl"
    : requestedAddSignal && requestedAddSignal in SIGNAL_CONFIG
      ? requestedAddSignal as SignalKey
      : null;
  const safety = safetyTone(safetyStatus);
  const SafetyIcon = safety.Icon;
  const safetyAcknowledged = Boolean(analysis?.acknowledged_at);
  const hasOpenSafetyNotice = !safetyAcknowledged && (
    safetyStatus !== "steady" || Boolean(latestAlert && !latestAlert.resolved_at)
  );
  const emergencyContact = emergencyContactForCountry(country);
  const gpPhoneHref = sanitizePhoneHref(gpPhone);
  const gpEmailHref = emailHref(
    gpEmail,
    language === "en" ? "VYVA vitals summary" : language === "de" ? "VYVA Vitalwerte" : "Resumen de signos VYVA",
    buildVitalsContext({ analysis, recentReadings, language }),
  );
  const caregiverHref = contactHref(
    caregiverContact,
    language === "en" ? "VYVA vitals summary" : language === "de" ? "VYVA Vitalwerte" : "Resumen de signos VYVA",
    buildVitalsContext({ analysis, recentReadings, language }),
  );
  const safetyActionKinds = vitalsSafetyActionKindsFor(safetyStatus, {
    hasEmergencyContact: Boolean(emergencyContact?.telHref),
    hasGpPhone: Boolean(gpPhoneHref),
    hasGpEmail: Boolean(gpEmailHref),
    hasCaregiverContact: Boolean(caregiverHref),
  });
  const primarySafetyAction = safetyActionKinds[0];
  const secondarySafetyActions = safetyActionKinds.slice(1);
  const recentVoiceReadings = useMemo<VitalsVoiceReading[]>(() => recentReadings.slice(0, 4).map((reading) => ({
    signal: reading.signal_type,
    value: reading.value,
    unit: reading.unit ?? null,
    source: reading.source ?? null,
    confidence: reading.source_confidence ?? null,
  })), [recentReadings]);
  const voiceRiskScore = analysis?.risk_score ?? null;

  const reportAddVoiceState = useCallback((flowState: VitalsVoiceFlowState) => {
    onVoiceStateChange?.({
      view: "add_reading",
      ...flowState,
      safetyStatus,
      riskScore: voiceRiskScore,
      recentReadings: recentVoiceReadings,
    });
  }, [onVoiceStateChange, recentVoiceReadings, safetyStatus, voiceRiskScore]);

  useEffect(() => {
    if (initialAddSignal) setScreen("add");
  }, [initialAddSignal]);

  useEffect(() => {
    if (screen === "dashboard") onBackActionChange?.(null);
  }, [onBackActionChange, screen]);

  useEffect(() => {
    if (screen !== "dashboard") return;
    onVoiceStateChange?.({
      view: "dashboard",
      stage: null,
      selectedSignal: null,
      selectedSignalLabel: null,
      captureMethod: null,
      scanStatus: null,
      pendingReadings: [],
      safetyStatus,
      riskScore: voiceRiskScore,
      recentReadings: recentVoiceReadings,
      busy: analysing || acknowledging !== null,
      listening: false,
    });
  }, [acknowledging, analysing, onVoiceStateChange, recentVoiceReadings, safetyStatus, screen, voiceRiskScore]);

  useEffect(() => {
    setHeroMarkerIndex(0);
    if (screen !== "dashboard" || heroMetricCount < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setHeroMarkerIndex((current) => (current + 1) % heroMetricCount);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [heroMetricCount, screen]);

  const loadDashboard = useCallback(async () => {
    if (previewData) {
      setAnalysis(previewData.analysis ?? null);
      setRecentReadings(previewData.recent_readings ?? []);
      setLatestAlert(previewData.latest_alert ?? null);
      setLoading(false);
      setError(null);
      return;
    }
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/vitals-engine/latest");
      if (!response.ok) throw new Error("Dashboard load failed");
      const data = await response.json() as VitalsTrackerPreviewData;
      setAnalysis(data.analysis ?? null);
      setRecentReadings(data.recent_readings ?? []);
      setLatestAlert(data.latest_alert ?? null);
    } catch {
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, previewData, userId]);

  async function triggerAnalysis() {
    if (previewData) return;
    setAnalysing(true);
    setError(null);
    try {
      const response = await apiFetch("/api/vitals-engine/analyse", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("Analysis failed");
      await loadDashboard();
    } catch {
      setError(copy.analysisError);
    } finally {
      setAnalysing(false);
    }
  }

  async function acknowledgeSafety(action: "recheck" | "dismissed" | "shared" | "contacted_doctor" | "urgent_guidance_followed") {
    setAcknowledging(action);
    setError(null);
    try {
      const response = await apiFetch("/api/vitals-engine/acknowledge", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          analysis_id: analysis?.id ?? undefined,
          action,
        }),
      });
      if (!response.ok) throw new Error("Acknowledge failed");
      const updated = await response.json() as LatestAnalysis;
      setAnalysis((current) => ({ ...(current ?? {}), ...updated }));
      await loadDashboard();
    } catch {
      setError(copy.actionError);
    } finally {
      setAcknowledging(null);
    }
  }

  function openDoctorHelp() {
    void acknowledgeSafety(safetyStatus === "urgent_help" ? "urgent_guidance_followed" : "contacted_doctor");
    navigate("/health/doctor", {
      state: {
        autoStartVoice: true,
        latestSymptomReport: buildVitalsContext({ analysis, recentReadings, language }),
        source: "vitals_safety",
      },
    });
  }

  function openDoctorContactSetup() {
    navigate("/onboarding/profile/gp");
  }

  function openConciergeService(kind: "appointment" | "ride") {
    const context = buildVitalsContext({ analysis, recentReadings, language });
    const request = kind === "ride"
      ? language === "de"
        ? "Bitte hilf mir, eine sichere Fahrt wegen meiner VYVA Vitalwerte zu organisieren. Vor der Buchung bitte bestaetigen lassen."
        : language === "en"
          ? "Please help me find safe transport options based on my VYVA vitals. Ask me to confirm before contacting anyone."
          : language === "fr"
            ? "Aidez-moi à trouver un transport sûr en fonction de mes constantes VYVA. Demandez ma confirmation avant de contacter qui que ce soit."
            : "Ayudame a organizar transporte seguro segun mis signos de VYVA. Pideme confirmacion antes de reservar."
      : language === "de"
        ? "Bitte hilf mir, einen Arzttermin wegen meiner VYVA Vitalwerte zu vereinbaren. Vor der Buchung bitte bestaetigen lassen."
        : language === "en"
          ? "Please help me schedule a doctor appointment based on my VYVA vitals. Ask me to confirm before booking."
          : language === "fr"
            ? "Aidez-moi à prendre rendez-vous avec un médecin en fonction de mes constantes VYVA. Demandez ma confirmation avant de réserver."
            : "Ayudame a programar una cita medica segun mis signos de VYVA. Pideme confirmacion antes de reservar.";

    void acknowledgeSafety(safetyStatus === "urgent_help" ? "urgent_guidance_followed" : "contacted_doctor");
    navigate("/concierge", {
      state: {
        conciergePrefill: {
          kind,
          message: `${request}\n\nContext:\n${context}`,
          source: "vitals_safety",
        },
      },
    });
  }

  async function shareVitalsSummary() {
    const text = buildVitalsContext({ analysis, recentReadings, language });
    try {
      if (navigator.share) {
        await navigator.share({ title: COPY[language].safetyTitle, text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      await acknowledgeSafety("shared");
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === "AbortError") return;
      await acknowledgeSafety("shared");
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    window.addEventListener("vyva:vitals-updated", loadDashboard);
    return () => window.removeEventListener("vyva:vitals-updated", loadDashboard);
  }, [loadDashboard]);

  const safetyActionBaseClass = "flex min-h-[54px] items-center justify-center gap-2 rounded-[17px] px-3 text-center font-body text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-60 sm:min-h-[58px] sm:px-4 sm:text-[16px]";
  const safetySecondaryActionClass = isDark
    ? "border border-white/[0.16] bg-white/[0.07] text-[#E9D7FF]"
    : "border border-[#DDD6FE] bg-white text-[#6B21A8]";

  function renderSafetyAction(kind: VitalsSafetyActionKind) {
    if (kind === "call_emergency" && emergencyContact?.telHref) {
      return (
        <a
          key={kind}
          href={emergencyContact.telHref}
          onClick={() => void acknowledgeSafety("urgent_guidance_followed")}
          className={`${safetyActionBaseClass} bg-[#DC2626] text-white`}
          data-testid="button-safety-call-emergency"
        >
          <PhoneCall className="h-5 w-5" />
          {copy.call} {emergencyContact.label}
        </a>
      );
    }

    if (kind === "call_gp" && gpPhoneHref) {
      return (
        <a
          key={kind}
          href={gpPhoneHref}
          onClick={() => void acknowledgeSafety("contacted_doctor")}
          className={`${safetyActionBaseClass} bg-[#B45309] text-white`}
          data-testid="button-safety-call-gp"
        >
          <PhoneCall className="h-5 w-5" />
          {gpCallLabel}
        </a>
      );
    }

    if (kind === "email_gp" && gpEmailHref) {
      return (
        <a
          key={kind}
          href={gpEmailHref}
          onClick={() => void acknowledgeSafety("contacted_doctor")}
          className={`${safetyActionBaseClass} border border-[#F6C177] bg-[#FFF7ED] text-[#92400E]`}
          data-testid="button-safety-email-gp"
        >
          <Mail className="h-5 w-5" />
          {copy.emailGp}
        </a>
      );
    }

    if (kind === "doctor_help") {
      const doctorHelpAckAction = safetyStatus === "urgent_help" ? "urgent_guidance_followed" : "contacted_doctor";
      return (
        <button
          key={kind}
          type="button"
          onClick={openDoctorHelp}
          disabled={acknowledging !== null}
          className={`${safetyActionBaseClass} bg-[#6B21A8] text-white`}
          data-testid="button-safety-doctor-help"
        >
          {acknowledging === doctorHelpAckAction ? <Loader2 className="h-5 w-5 animate-spin" /> : <Stethoscope className="h-5 w-5" />}
          {copy.doctorHelp}
        </button>
      );
    }

    if (kind === "add_doctor_contact") {
      return (
        <button
          key={kind}
          type="button"
          onClick={openDoctorContactSetup}
          className={`${safetyActionBaseClass} ${safetySecondaryActionClass}`}
          data-testid="button-safety-add-doctor"
        >
          <UserPlus className="h-5 w-5" />
          {copy.addDoctor}
        </button>
      );
    }

    if (kind === "schedule_appointment") {
      return (
        <button
          key={kind}
          type="button"
          onClick={() => openConciergeService("appointment")}
          disabled={acknowledging !== null}
          className={`${safetyActionBaseClass} ${safetySecondaryActionClass}`}
          data-testid="button-safety-schedule-appointment"
        >
          <Calendar className="h-5 w-5" />
          {copy.appointment}
        </button>
      );
    }

    if (kind === "book_ride") {
      return (
        <button
          key={kind}
          type="button"
          onClick={() => openConciergeService("ride")}
          disabled={acknowledging !== null}
          className={`${safetyActionBaseClass} border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]`}
          data-testid="button-safety-book-ride"
        >
          <Car className="h-5 w-5" />
          {copy.ride}
        </button>
      );
    }

    if (kind === "share_summary") {
      if (caregiverHref) {
        const ContactIcon = isEmailContact(caregiverContact) ? Mail : Users;
        return (
          <a
            key={kind}
            href={caregiverHref}
            onClick={() => void acknowledgeSafety("shared")}
            className={`${safetyActionBaseClass} bg-[#6B21A8] text-white`}
            data-testid="button-safety-contact-caregiver"
          >
            <ContactIcon className="h-5 w-5" />
            {copy.share}
          </a>
        );
      }

      return (
        <button
          key={kind}
          type="button"
          onClick={() => void shareVitalsSummary()}
          disabled={acknowledging !== null}
          className={`${safetyActionBaseClass} bg-[#6B21A8] text-white`}
          data-testid="button-safety-share-summary"
        >
          {acknowledging === "shared" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
          {copy.shareSummary}
        </button>
      );
    }

    if (kind === "recheck") {
      return (
        <button
          key={kind}
          type="button"
          onClick={() => {
            void acknowledgeSafety("recheck");
            showAddReading();
          }}
          disabled={acknowledging !== null}
          className={`${safetyActionBaseClass} bg-[#0369A1] text-white`}
          data-testid="button-safety-recheck"
        >
          {acknowledging === "recheck" ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          {copy.recheck}
        </button>
      );
    }

    return null;
  }

  // TODO: Device connection settings screen for Apple Health / LibreView / Withings.
  // TODO: Caregiver dashboard can read vyva_pattern_windows.caregiver_note.
  // TODO: VYVA voice can read senior_message aloud after analysis.
  // TODO: Optional 40Hz gamma audio layer under daily check-in audio.

  if (screen === "add") {
    return (
      <VitalsAddReadingFlow
        previewMode={Boolean(previewData)}
        previewContext={previewData ? previewAcquisitionContext(previewData.recent_readings) : undefined}
        initialSignal={initialAddSignal}
        language={language}
        onBack={showDashboard}
        onBackActionChange={onBackActionChange}
        onVoiceStateChange={reportAddVoiceState}
        onSaved={async () => {
          showDashboard();
          await loadDashboard();
        }}
      />
    );

  }

  const latestBySignal = latestReadingMap(recentReadings);
  const activeHeroMetricIndex = heroMarkerIndex % heroMetricCount;
  const activeHeroMarker = activeHeroMetricIndex === 0 ? undefined : heroMarkers[activeHeroMetricIndex - 1];
  const activeHeroSignal = activeHeroMarker?.signal_type as SignalKey | undefined;
  const activeHeroConfig = activeHeroSignal ? SIGNAL_CONFIG[activeHeroSignal] : null;
  const activeHeroDeviation = numberValue(activeHeroMarker?.deviation_pct);
  const visibleSignalEntries = visibleSignals.filter(([key]) => !VITALS_SIGNAL_CATALOG[key].futureReady);
  const readingGroups = DISPLAY_GROUP_ORDER.flatMap((group) => {
    const signals = visibleSignalEntries.filter(([key]) => VITALS_SIGNAL_CATALOG[key].displayGroup === group);
    return signals.length ? [{ group, signals }] : [];
  });
  const trackedReadingGroups = readingGroups.flatMap(({ group, signals }) => {
    const trackedSignals = signals.filter(([key]) => Boolean(latestBySignal[key]));
    return trackedSignals.length ? [{ group, signals: trackedSignals }] : [];
  });
  const untrackedReadingGroups = readingGroups.flatMap(({ group, signals }) => {
    const untrackedSignals = signals.filter(([key]) => !latestBySignal[key]);
    return untrackedSignals.length ? [{ group, signals: untrackedSignals }] : [];
  });
  const dashboardLabels = DASHBOARD_LABELS[language];
  const seniorMessage = previewData && language !== "en" && language !== "fr"
    ? copy.messageFallback
    : seniorMessageForDisplay(analysis?.senior_message, safetyStatus, language);
  const safetyHeroAccent =
    safetyStatus === "steady"
      ? "border-l-[#047857]"
      : safetyStatus === "recheck" || safetyStatus === "share_with_caregiver"
        ? "border-l-[#D97706]"
        : "border-l-[#B91C1C]";
  const dashboardPanel = isDark
    ? "border-white/[0.14] bg-[#2B2035] text-[#FFF8FF] shadow-[0_18px_38px_rgba(0,0,0,0.2)]"
    : "border-[#E6DCEB] bg-white text-[#241238] shadow-[0_16px_40px_rgba(63,45,75,0.08)]";
  const dashboardDisclosure = isDark
    ? "border-white/[0.14] bg-[#2B2035] text-[#FFF8FF] shadow-[0_14px_30px_rgba(0,0,0,0.18)]"
    : "border-[#E8DED4] bg-white text-[#3B2C25] shadow-[0_8px_20px_rgba(63,45,35,0.05)]";
  const safetyPanel = isDark
    ? "border-white/[0.14] bg-[#2B2035] text-[#FFF8FF] shadow-[0_16px_34px_rgba(0,0,0,0.2)]"
    : "border-[#E8DED4] bg-white text-[#2F241F] shadow-[0_10px_28px_rgba(63,45,35,0.07)]";
  const safetyMutedText = isDark ? "text-[#CFC2D8]" : "text-[#7A6A60]";
  const safetyBodyText = isDark ? "text-[#FFF8FF]" : "text-[#2F241F]";
  const safetyAlertPanel = isDark
    ? "border border-[#F8AE1B]/25 bg-[#F8AE1B]/10 text-[#FFD99A]"
    : "bg-[#FFF7ED] text-[#92400E]";
  const safetyDismissButton = isDark
    ? "border-white/[0.16] bg-white/[0.06] text-[#D8CDE4]"
    : "border-[#E8DED4] bg-[#FAF9F6] text-[#6B5B52]";
  const groupDivider = isDark ? "border-white/[0.12]" : "border-[#E1D6E7]";
  const rowDivider = isDark ? "divide-white/[0.1]" : "divide-[#EFE7F3]";

  return (
    <section className="-mx-2 w-[calc(100%+1rem)] max-w-[760px] space-y-3 sm:mx-auto sm:w-full sm:space-y-4" data-testid="vitals-engine-dashboard">
      {loading ? (
        <div className={`flex min-h-[260px] items-center justify-center rounded-[30px] border ${dashboardPanel}`}>
          <div className={`text-center font-body text-[20px] font-bold ${isDark ? "text-[#D8CDE4]" : "text-[#6B5B52]"}`}>
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#6B21A8]" />
            {copy.loading}
          </div>
        </div>
      ) : (
        <>
          <div className="-mx-2 sm:-mx-4 lg:-mx-14" data-testid="vitals-hero">
            <section
              aria-label={safetyLabel(safetyStatus, language)}
              className={`relative overflow-hidden rounded-[26px] border border-l-[5px] px-4 py-4 pr-[76px] sm:rounded-[30px] sm:border-l-[6px] sm:px-[22px] sm:py-5 sm:pr-[88px] ${dashboardPanel} ${safetyHeroAccent}`}
            >
              <div data-testid="vitals-hero-metric">
                {activeHeroMetricIndex === 0 ? (
                  <div
                    className="min-h-[68px] max-w-[520px]"
                    data-testid="vitals-risk-score"
                    aria-label={`${dashboardLabels.risk}: ${riskScore}/100. ${dashboardLabels.lower}.`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`font-body text-[13px] font-black uppercase tracking-[0.08em] sm:text-[14px] ${isDark ? "text-[#C4A7FF]" : "text-[#7024C4]"}`}>{dashboardLabels.risk}</p>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2.5">
                        <span className="flex shrink-0 items-baseline gap-1">
                          <span className="font-body text-[42px] font-extrabold leading-none tracking-[-0.05em] sm:text-[46px]" style={{ color: riskColor }}>{riskScore}</span>
                          <span className={`font-body text-[13px] font-black sm:text-[15px] ${isDark ? "text-[#C9BDD6]" : "text-[#746A72]"}`}>/100</span>
                        </span>
                        <span className={`min-w-0 border-l pl-2.5 font-body text-[17px] font-bold leading-[1.25] sm:text-[18px] ${isDark ? "border-white/[0.14] text-[#D8CDE4]" : "border-[#E1D6E7] text-[#6B5B72]"}`} data-testid="vitals-hero-message">
                          {getRiskLabel(riskScore, language)} · {dashboardLabels.lower}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : activeHeroMarker && activeHeroSignal && activeHeroConfig ? (
                  <div className="min-h-[68px] min-w-0 max-w-[520px]" data-testid="vitals-hero-marker">
                    <div className="min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className={`truncate font-body text-[13px] font-black uppercase tracking-[0.08em] sm:text-[14px] ${isDark ? "text-[#C4A7FF]" : "text-[#7024C4]"}`}>
                          {signalLabel(activeHeroSignal, activeHeroConfig, language)}
                        </p>
                        <div className="mt-0.5 flex min-w-0 items-center gap-2.5">
                          <span
                            className={`shrink-0 whitespace-nowrap font-body text-[34px] font-extrabold leading-none tracking-[-0.03em] sm:text-[38px] ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"}`}
                            data-testid="vitals-hero-value"
                          >
                            {readingValueDisplay(activeHeroSignal, activeHeroMarker)}
                          </span>
                          <span className={`min-w-0 border-l pl-2.5 font-body text-[17px] font-bold leading-[1.25] sm:text-[18px] ${isDark ? "border-white/[0.14] text-[#D8CDE4]" : "border-[#E1D6E7] text-[#6B5B72]"}`} data-testid="vitals-hero-message">
                            {heroMarkerMessage(activeHeroDeviation, language)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                {heroMetricCount > 1 ? (
                  <div className="mt-2 flex items-center gap-1" aria-label={dashboardLabels.latest}>
                    {["risk", ...heroMarkers.map((marker) => marker.signal_type)].map((metricKey, index) => (
                      <button
                        key={metricKey}
                        type="button"
                        aria-label={index === 0 ? dashboardLabels.risk : `${dashboardLabels.latest} ${index}`}
                        aria-current={index === activeHeroMetricIndex ? "true" : undefined}
                        onClick={() => setHeroMarkerIndex(index)}
                        className="vyva-tap grid h-5 !min-h-5 w-5 place-items-center rounded-full"
                      >
                        <span className={`h-1.5 rounded-full transition-all ${index === activeHeroMetricIndex ? "w-4 bg-[#F8AE1B]" : isDark ? "w-1.5 bg-white/30" : "w-1.5 bg-[#C9BDD6]"}`} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                aria-label={copy.add}
                onClick={showAddReading}
                className="vyva-tap absolute right-6 top-[26px] grid h-[52px] !min-h-[52px] w-[52px] place-items-center rounded-full bg-[#7024C4] text-white shadow-[0_8px_20px_rgba(112,36,196,0.28)] transition hover:bg-[#5E1DA8] active:scale-[0.96] sm:right-8"
                data-testid="button-vitals-hero-add"
              >
                <Plus className="h-7 w-7 text-[#F8AE1B]" strokeWidth={2.7} aria-hidden="true" />
              </button>
            </section>
          </div>

          {hasOpenSafetyNotice ? (
          <div className={`mt-3 rounded-[24px] border p-4 sm:mt-4 sm:rounded-[28px] sm:p-5 ${safetyPanel}`} data-testid="daily-safety-check">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] sm:h-14 sm:w-14 sm:rounded-[20px]" style={{ background: safety.bg, color: safety.color }}>
                <SafetyIcon className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`font-body text-[11px] font-bold uppercase tracking-[0.11em] sm:text-[13px] sm:tracking-[0.12em] ${safetyMutedText}`}>{copy.safetyTitle}</p>
                  <span className="rounded-full px-2.5 py-1 font-body text-[11px] font-bold sm:px-3 sm:text-[12px]" style={{ background: safety.bg, color: safety.color }}>
                    {safetyLabel(safetyStatus, language)}
                  </span>
                  {safetyAcknowledged && (
                    <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[12px] font-bold text-[#047857]">
                      {copy.safetyAck}
                    </span>
                  )}
                </div>
                <p className={`mt-2 font-body text-[17px] font-bold leading-[1.45] sm:mt-3 sm:text-[20px] sm:leading-relaxed ${safetyBodyText}`}>
                  {seniorMessage}
                </p>
                {latestAlert && !latestAlert.resolved_at && (
                  <p className={`mt-3 rounded-[16px] p-3 font-body text-[14px] font-bold leading-relaxed sm:rounded-[18px] sm:text-[15px] ${safetyAlertPanel}`}>
                    {alertMessageForDisplay(latestAlert, safetyStatus, language)}
                  </p>
                )}
              </div>
            </div>

            {!safetyAcknowledged && (
              <div className="mt-4 grid gap-2.5 sm:mt-5">
                {primarySafetyAction ? renderSafetyAction(primarySafetyAction) : null}
                <details className={`group overflow-hidden rounded-[17px] border ${isDark ? "border-white/[0.14] bg-white/[0.04]" : "border-[#E8DED4] bg-[#FAF9F6]"}`}>
                  <summary className={`vyva-tap flex min-h-[48px] cursor-pointer list-none items-center justify-center gap-2 px-3 font-body text-[14px] font-bold [&::-webkit-details-marker]:hidden ${isDark ? "text-[#D8CDE4]" : "text-[#6B5B72]"}`}>
                    {copy.moreOptions}
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className={`grid gap-2.5 border-t p-2.5 sm:grid-cols-2 ${isDark ? "border-white/[0.12]" : "border-[#E8DED4]"}`}>
                    {secondarySafetyActions.map(renderSafetyAction)}
                    <button
                      type="button"
                      onClick={() => acknowledgeSafety("dismissed")}
                      disabled={acknowledging !== null}
                      className={`min-h-[54px] rounded-[17px] border px-3 font-body text-[15px] font-bold disabled:opacity-60 sm:min-h-[58px] sm:rounded-[18px] sm:px-4 sm:text-[17px] ${safetyDismissButton}`}
                      data-testid="button-safety-dismiss"
                    >
                      {acknowledging === "dismissed" ? copy.safetyAck : copy.ok}
                    </button>
                  </div>
                </details>
              </div>
            )}
          </div>
          ) : null}

          {trackedReadingGroups.length ? (
            <section className="mt-5 sm:mt-7" data-testid="vitals-reading-groups" aria-labelledby="vitals-latest-readings">
              <h2 id="vitals-latest-readings" className={`mb-3 font-body text-[13px] font-black uppercase tracking-[0.14em] ${isDark ? "text-[#C9BDD6]" : "text-[#6B5B72]"}`}>
                {dashboardLabels.latest}
              </h2>
              <div className={`overflow-hidden rounded-[24px] border sm:rounded-[30px] ${dashboardPanel}`}>
                {trackedReadingGroups.map(({ group, signals }, groupIndex) => (
                  <section key={group} aria-labelledby={`vitals-group-${group}`} className={groupIndex ? `border-t ${groupDivider}` : ""}>
                    <h3 id={`vitals-group-${group}`} className={`px-4 pb-0 pt-2 font-body text-[9px] font-black uppercase tracking-[0.14em] sm:px-5 sm:pb-1 sm:pt-3 sm:text-[11px] ${isDark ? "text-[#C9BDD6]" : "text-[#6B5B72]"}`}>
                      {DISPLAY_GROUP_LABELS[group][language]}
                    </h3>
                    <div className={`divide-y ${rowDivider}`}>
                      {signals.map(([key]) => (
                        <SignalCard
                          key={key}
                          signalKey={key}
                          reading={latestBySignal[key]}
                          language={language}
                          normalLabel={copy.normal}
                          todayLabel={copy.today}
                          isDark={isDark}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ) : null}

          {untrackedReadingGroups.length ? (
            <details className={`group rounded-[20px] border sm:rounded-[24px] ${dashboardDisclosure}`} data-testid="vitals-more-readings">
              <summary className="vyva-tap flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-3 font-body text-[15px] font-black sm:min-h-[64px] sm:px-4 sm:text-[16px] [&::-webkit-details-marker]:hidden">
                <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] sm:h-10 sm:w-10 sm:rounded-[14px] ${isDark ? "bg-[#3A2D4A]" : "bg-[#F5F3FF]"}`}>
                  <VyvaIcon icon={Activity} accent="signal" size={21} />
                </span>
                <span className="min-w-0 flex-1">{dashboardLabels.more}</span>
                <ChevronDown className="h-5 w-5 text-[#6B21A8] transition-transform group-open:rotate-180" />
              </summary>
              <div className={`border-t ${groupDivider}`}>
                {untrackedReadingGroups.map(({ group, signals }, groupIndex) => (
                  <section key={group} aria-labelledby={`vitals-more-group-${group}`} className={groupIndex ? `border-t ${groupDivider}` : ""}>
                    <h3 id={`vitals-more-group-${group}`} className={`px-5 pb-1 pt-3 font-body text-[11px] font-black uppercase tracking-[0.14em] ${isDark ? "text-[#C9BDD6]" : "text-[#6B5B72]"}`}>
                      {DISPLAY_GROUP_LABELS[group][language]}
                    </h3>
                    <div className={`divide-y ${rowDivider}`}>
                      {signals.map(([key]) => (
                        <SignalCard
                          key={key}
                          signalKey={key}
                          language={language}
                          normalLabel={copy.normal}
                          todayLabel={copy.today}
                          isDark={isDark}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </details>
          ) : null}

          <details className={`group rounded-[20px] border sm:rounded-[24px] ${dashboardDisclosure}`} data-testid="vitals-evidence-guide">
            <summary className="vyva-tap flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-3 font-body text-[15px] font-black sm:min-h-[64px] sm:px-4 sm:text-[16px] [&::-webkit-details-marker]:hidden">
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] sm:h-10 sm:w-10 sm:rounded-[14px] ${isDark ? "bg-[#3A2D4A]" : "bg-[#F5F3FF]"}`}>
                <VyvaIcon icon={ShieldCheck} accent="check" size={21} />
              </span>
              <span className="min-w-0 flex-1">{copy.evidenceTitle}</span>
              <ChevronDown className="h-5 w-5 text-[#6B21A8] transition-transform group-open:rotate-180" />
            </summary>
            <div className={`border-t px-4 pb-4 pt-3 ${groupDivider}`}>
              <p className={`font-body text-[16px] font-bold leading-relaxed ${isDark ? "text-[#D8CDE4]" : "text-[#5D4D64]"}`}>{copy.evidenceBody}</p>
              <div className="mt-3 grid gap-2">
                {[copy.evidencePhone, copy.evidenceManual, copy.evidenceDevice].map((item) => (
                  <div key={item} className={`flex min-h-[48px] items-center gap-3 border-b px-1 py-2 last:border-b-0 font-body text-[14px] font-bold ${isDark ? "border-white/[0.1] text-[#D8CDE4]" : "border-[#F0E7F4] text-[#6B5B52]"}`}>
                    <Check className="h-4 w-4 flex-shrink-0 text-[#047857]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </details>

          {!analysis?.senior_message && recentReadings.length === 0 && (
            <div className={`mt-5 rounded-[26px] border p-5 ${dashboardPanel}`}>
              <p className={`font-body text-[20px] font-bold leading-relaxed ${isDark ? "text-[#D8CDE4]" : "text-[#6B5B52]"}`}>{copy.messageFallback}</p>
            </div>
          )}

          {error && <p className="mt-4 rounded-[18px] bg-[#FEF2F2] p-4 font-body text-[18px] font-bold text-[#B91C1C]">{error}</p>}

          <div className={`mt-2 flex flex-col items-stretch justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center ${isDark ? "border-white/[0.12]" : "border-[#E7DDF0]"}`}>
            <p className={`font-body text-[15px] font-bold ${isDark ? "text-[#C9BDD6]" : "text-[#7A6A60]"}`}>
              {copy.lastAnalysis}: {relativeTime(analysis?.analysed_at, language)}
            </p>
            <button
              type="button"
              onClick={triggerAnalysis}
              disabled={analysing}
              className={`vyva-tap flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] border px-5 font-body text-[15px] font-black disabled:opacity-60 sm:w-auto ${isDark ? "border-white/[0.14] bg-white/[0.07] text-[#C4A7FF]" : "border-[#DDD6FE] bg-white text-[#6B21A8]"}`}
            >
              {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {analysing ? copy.analysing : copy.analyse}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function getVisibleSignals(userConditions: string[]): Array<[SignalKey, typeof SIGNAL_CONFIG[SignalKey]]> {
  return (Object.entries(SIGNAL_CONFIG) as Array<[SignalKey, typeof SIGNAL_CONFIG[SignalKey]]>).filter(([, cfg]) =>
    cfg.conditions.length === 0 ||
    cfg.conditions.some((condition) => userConditions.includes(condition)),
  );
}

function latestReadingMap(readings: RecentReading[]): Partial<Record<SignalKey, RecentReading>> {
  const map: Partial<Record<SignalKey, RecentReading>> = {};
  for (const reading of readings) {
    if (reading.signal_type in SIGNAL_CONFIG && !map[reading.signal_type as SignalKey]) {
      map[reading.signal_type as SignalKey] = reading;
    }
  }
  return map;
}

function previewAcquisitionContext(readings: RecentReading[]): VitalsAcquisitionContext {
  const currentReadings = readings.flatMap((reading) => {
    if (!(reading.signal_type in VITALS_SIGNAL_CATALOG)) return [];
    if (reading.source !== "connected_device" && reading.source !== "clinical") return [];
    const signalType = reading.signal_type as SignalKey;
    return [{
      signalType,
      value: Number(reading.value),
      unit: reading.unit || VITALS_SIGNAL_CATALOG[signalType].unit,
      recordedAt: reading.recorded_at,
      source: reading.source,
      captureMethod: (reading.capture_method || (reading.source === "clinical" ? "clinical_import" : "web_bluetooth")) as VitalsCaptureMethod,
      confidence: "high" as const,
      qualityFlag: "clean",
      sourceRef: reading.source_ref,
      freshness: "current" as const,
    }];
  });
  return {
    readings: currentReadings,
    signals: currentReadings.map((reading) => ({
      signal_type: reading.signalType,
      current_reading: reading,
      compatible_methods: [],
    })),
    devices: currentReadings.map((reading) => ({
      deviceName: typeof reading.sourceRef?.device_name === "string" ? reading.sourceRef.device_name : null,
      capabilities: [reading.signalType],
    })),
  };
}

function SignalCard({
  signalKey,
  reading,
  language,
  normalLabel,
  todayLabel,
  isDark,
}: {
  signalKey: SignalKey;
  reading?: RecentReading;
  language: Language;
  normalLabel: string;
  todayLabel: string;
  isDark: boolean;
}) {
  const cfg = SIGNAL_CONFIG[signalKey];
  const meta = VITALS_SIGNAL_CATALOG[signalKey];
  const value = numberValue(reading?.value);
  const deviation = numberValue(reading?.deviation_pct);
  const display =
    signalKey === "medication_confirmed"
      ? value === 1
        ? "✓"
        : value === 0
          ? "—"
          : "--"
      : value == null
        ? "--"
        : `${value}${meta.unit ? ` ${meta.unit}` : ""}`;
  const subLabel =
    signalKey === "medication_confirmed"
      ? value === 1
        ? todayLabel
        : normalLabel
      : deviation == null
        ? normalLabel
        : `${deviation > 0 ? "+" : ""}${deviation}% ${deviation > 0 ? "↑" : "↓"}`;

  const sourceBadge = readingSourceBadge(reading, language);
  const SourceIcon = reading?.source === "connected_device"
    ? Bluetooth
    : reading?.source === "clinical"
      ? Stethoscope
      : reading?.source === "phone_estimate"
        ? Activity
        : Keyboard;

  const rowContent = (
    <>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] sm:h-12 sm:w-12 sm:rounded-[16px] ${isDark ? "bg-[#3A2D4A]" : "bg-[#F5F3FF]"}`}>
          <SignalIcon type={cfg.icon} className="h-[21px] w-[21px] sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`font-body text-[14px] font-bold leading-tight sm:text-[16px] ${isDark ? "text-[#D8CDE4]" : "text-[#6B5B52]"}`}>{signalLabel(signalKey, cfg, language)}</p>
          <p className={`mt-0.5 font-body text-[20px] font-black leading-tight sm:mt-1 sm:text-[22px] ${isDark ? "text-[#FFF8FF]" : "text-[#2F241F]"}`}>{display}</p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5 text-right sm:gap-2">
          {sourceBadge ? (
            <span className="flex h-7 min-w-7 items-center justify-center gap-1 rounded-full px-1.5 font-body text-[10px] font-black sm:h-auto sm:min-w-0 sm:px-2 sm:py-1" style={{ background: sourceBadge.bg, color: sourceBadge.color }} title={sourceBadge.fullLabel} aria-label={sourceBadge.fullLabel}>
              <SourceIcon className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
              <span className="hidden sm:inline">{sourceBadge.shortLabel}</span>
            </span>
          ) : null}
          <p className={`font-body text-[12px] font-bold sm:text-[14px] ${isDark ? "text-[#C9BDD6]" : "text-[#7A6A60]"}`}>{subLabel}</p>
        </div>
    </>
  );

  if (!sourceBadge) {
    return (
      <article className="flex min-h-[76px] items-center gap-3 px-3 py-2.5 sm:min-h-[88px] sm:px-5 sm:py-3">
        {rowContent}
      </article>
    );
  }

  return (
    <article className="px-3 sm:px-5">
      <details className="group">
        <summary className="vyva-tap flex min-h-[76px] cursor-pointer list-none items-center gap-3 py-2.5 sm:min-h-[88px] sm:py-3 [&::-webkit-details-marker]:hidden">
          {rowContent}
          <ChevronDown className="h-[18px] w-[18px] flex-shrink-0 text-[#7C3AED] transition-transform group-open:rotate-180 sm:h-5 sm:w-5" aria-hidden="true" />
          <span className="sr-only">Reading details</span>
        </summary>
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-t pb-3 pt-2 font-body text-[12px] ${isDark ? "border-white/[0.1] text-[#C9BDD6]" : "border-[#F0E7F4] text-[#6B5B72]"}`}>
          <span className="font-bold">Source: {sourceBadge.fullLabel}</span>
          {reading?.recorded_at ? <span>{relativeTime(reading.recorded_at, language)}</span> : null}
        </div>
      </details>
    </article>
  );
}
