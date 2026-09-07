import { Router, raw } from "express";
import type { Request, Response } from "express";
import OpenAI from "openai";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { profiles, userHealthConditions } from "../../shared/schema.js";
import { genderInstruction, inferProfileGender, type GrammaticalGender } from "../lib/userPersonalization.js";
import { getMediSearchTriageContext, type MediSearchTriageContext } from "../services/medisearch.js";
import { getDoctorMedicalProfileVariables } from "../lib/doctorMedicalProfile.js";
import {
  isTriageScanConcernLevel,
  isTriageScanType,
  triageScanLabel,
  type TriageScanResult,
  type TriageScanType,
} from "../../shared/triageScans.js";
import {
  buildGuidancePlan,
  buildFallbackTriageReportWithTelemetry,
  buildPersonalizedTriageSuggestions,
  evaluateTriageSafetyFloor,
  nextAdaptiveStage,
  primaryEscalationSource,
  profileRiskFlags,
  selectedAnswers,
  selectedSafetyAnswer,
  selectedSymptomId,
  trackTriageEvent,
  type ProfileRiskFlags,
  type TriageGuidancePlan,
  type TriageHealthMemory,
  type TriageOutcomeTelemetry,
  type TriageSummary,
  type TriageWizardContext,
  type WizardStage,
} from "../../src/triage/index.js";
import {
  emergencyContactForCountry,
  triageWizardMatrixPromptText,
  triageWizardNodeFor,
  type EmergencyContact,
  type TriageWizardMatrixReply,
  type TriageWizardMatrixStage,
} from "../lib/triageWizardMatrix.js";
import { languageName, normalizeAppLanguage } from "../../shared/language.js";
import {
  localizeTriageAnswerLabel,
  localizeTriageQuestion,
} from "../../shared/triageDisplayLocalization.js";

const router = Router();
const transcribeAudioBody = raw({ type: ["audio/*", "application/octet-stream"], limit: "8mb" });
const FINAL_MEDISEARCH_TIMEOUT_MS = 2_500;
const FINAL_OPENAI_TIMEOUT_MS = 7_000;

const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mpga": "mpga",
  "audio/m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

function audioMimeType(req: Request) {
  const rawType = String(req.headers["content-type"] ?? "audio/webm").split(";")[0]?.trim().toLowerCase();
  return rawType && rawType !== "application/octet-stream" ? rawType : "audio/webm";
}

function audioFileNameFor(mimeType: string) {
  const ext = AUDIO_EXTENSION_BY_MIME[mimeType] ?? "webm";
  return `symptom-voice.${ext}`;
}

function transcriptionLanguageFor(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = normalizeAppLanguage(value, "en");
  return normalized || undefined;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function activeHealthConditionsFor(userId: string): Promise<string[]> {
  if (!looksLikeUuid(userId)) return [];

  const rows = await db
    .select({ condition: userHealthConditions.condition })
    .from(userHealthConditions)
    .where(and(
      eq(userHealthConditions.user_id, userId),
      eq(userHealthConditions.is_active, true),
    ));

  return rows
    .map((row) => row.condition.trim())
    .filter(Boolean);
}

export async function transcribeTriageAudioHandler(req: Request, res: Response) {
  const audio = Buffer.isBuffer(req.body) ? req.body : null;
  if (!audio || audio.length < 32) {
    return res.status(400).json({ error: "audio is required" });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    return res.status(503).json({ error: "Voice transcription is not configured." });
  }

  try {
    const mimeType = audioMimeType(req);
    const client = new OpenAI({ apiKey });
    const file = await OpenAI.toFile(audio, audioFileNameFor(mimeType), { type: mimeType });
    const language = transcriptionLanguageFor(req.query.language ?? req.language ?? req.header("X-VYVA-Language"));

    const transcription = await client.audio.transcriptions.create({
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
      file,
      ...(language ? { language } : {}),
      prompt: "Short symptom description for a health triage app. Transcribe the user's words plainly.",
    });

    const transcript = transcription.text.trim();
    if (!transcript) return res.status(422).json({ error: "No speech detected." });
    return res.json({ transcript });
  } catch (err) {
    console.error("[triage/transcribe]", err);
    return res.status(500).json({ error: "Failed to transcribe voice input." });
  }
}

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  it: "Italian",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type TriageQuickReply = {
  id: string;
  label: string;
  value: string;
  icon: "heart" | "wind" | "thermometer" | "activity" | "alert" | "help";
  tone: "purple" | "red" | "blue" | "amber" | "green";
  kind: "symptom" | "location" | "red_flag" | "duration" | "severity" | "trend" | "support" | "free_text";
};

type TriageVitalsPromptAction = {
  id: "pulse" | "oxygen" | "blood_pressure" | "temperature" | "glucose";
  label: string;
  value: string;
  icon: TriageQuickReply["icon"];
  tone: TriageQuickReply["tone"];
};

type TriageVitalsPrompt = {
  title: string;
  body: string;
  actions: TriageVitalsPromptAction[];
} | null;

type TriageGuidancePlanResponse = TriageGuidancePlan;

interface TriageRequestBody {
  messages?: ChatMessage[];
  vitals?: {
    bpm?: number | null;
    respiratoryRate?: number | null;
    oxygenSaturation?: number | null;
    temperatureC?: number | null;
    systolicBp?: number | null;
    diastolicBp?: number | null;
    glucoseMgdl?: number | null;
    painScore?: number | null;
    energyLevel?: number | null;
  };
  locale?: string;
  wizard?: TriageWizardContext;
  healthMemory?: TriageHealthMemory;
  medisearchConversationId?: string;
}

export class TriageStepRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "TriageStepRequestError";
    this.statusCode = statusCode;
  }
}

export type TriageStepResponse = {
  role: "assistant";
  content: string;
  done?: boolean;
  urgent?: boolean;
  safetyAlert?: {
    id: string;
    label: string;
    recommendation: string;
    emergencyContact?: EmergencyContact;
  };
  emergencyContact?: EmergencyContact;
  summary?: TriageSummary & {
    evidenceSummary?: string;
    evidenceSources?: Array<{ title?: string; url?: string; year?: string; journal?: string }>;
  };
  quickReplies?: TriageQuickReply[];
  wizardStage?: WizardStage | "support";
  wizardStageLabel?: string;
  wizardSymptomId?: string;
  questionReason?: string | null;
  profileContextUsed?: boolean;
  vitalsPrompt?: TriageVitalsPrompt;
  guidancePlan?: TriageGuidancePlanResponse;
  evidenceSources?: Array<{ title?: string; url?: string; year?: string; journal?: string }>;
  medisearchConversationId?: string;
  medicalFollowups?: string[];
};

async function getRequestGender(req: Request): Promise<GrammaticalGender> {
  const userId = req.user?.id;
  if (!userId) return "neutral";
  const rows = await db
    .select({ full_name: profiles.full_name, data_sharing_consent: profiles.data_sharing_consent })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  const profile = rows[0];
  return inferProfileGender(profile?.data_sharing_consent, profile?.full_name ?? "");
}

function wizardContextText(wizard?: TriageWizardContext, healthMemory?: TriageHealthMemory): string {
  if (!wizard) return "";
  const stage = nextAdaptiveStage(wizard, healthMemory);

  const lines = [
    wizard.mode === "with_vitals"
      ? "The user chose to begin with a vitals scan."
      : wizard.mode === "without_vitals"
        ? "The user chose to skip the vitals scan and answer questions directly."
        : "",
    wizard.vitalsScanCompleted ? "The vitals scan step has been completed." : "",
    typeof wizard.vitals?.bpm === "number" ? `Estimated pulse: ${wizard.vitals.bpm} bpm.` : "",
    typeof wizard.vitals?.respiratoryRate === "number" ? `Estimated respiratory rate: ${wizard.vitals.respiratoryRate} breaths per minute.` : "",
    typeof wizard.vitals?.oxygenSaturation === "number" ? `Oxygen saturation: ${wizard.vitals.oxygenSaturation}%.` : "",
    typeof wizard.vitals?.temperatureC === "number" ? `Temperature: ${wizard.vitals.temperatureC} C.` : "",
    typeof wizard.vitals?.systolicBp === "number" && typeof wizard.vitals?.diastolicBp === "number" ? `Blood pressure: ${wizard.vitals.systolicBp}/${wizard.vitals.diastolicBp}.` : "",
    typeof wizard.vitals?.glucoseMgdl === "number" ? `Glucose: ${wizard.vitals.glucoseMgdl} mg/dL.` : "",
    typeof wizard.vitals?.painScore === "number" ? `Pain score: ${wizard.vitals.painScore}/10.` : "",
    typeof wizard.vitals?.energyLevel === "number" ? `Energy level: ${wizard.vitals.energyLevel}/10.` : "",
    wizard.scanResults?.length
      ? `Optional scan results completed: ${wizard.scanResults.map((scan) => `${scan.label}: ${scan.summary}${scan.findings.length ? ` (${scan.findings.join("; ")})` : ""}`).join(" | ")}.`
      : "",
    wizard.declinedScanTypes?.length
      ? `Optional scans skipped for now: ${wizard.declinedScanTypes.map((type) => triageScanLabel(type)).join(", ")}.`
      : "",
    wizard.quickAnswers?.length
      ? `Structured quick answers tapped so far: ${wizard.quickAnswers.map((answer) => `${answer.label} (${answer.value})`).join("; ")}.`
      : "",
    wizard.refineRequested ? "A new post-report vital was added. Re-run the summary now and explain whether the next step changed or stayed the same." : "",
    wizard.previousSummary?.nextStepLabel ? `Previous next step: ${wizard.previousSummary.nextStepLabel}.` : "",
    wizard.previousSummary?.triageReasons?.length ? `Previous reasons: ${wizard.previousSummary.triageReasons.join("; ")}.` : "",
    `Current adaptive wizard stage: ${stage}.`,
    stage === "complete" ? "The app has enough structured answers. Produce the final TRIAGE_JSON summary now." : `Ask the ${stage} question only.`,
  ].filter(Boolean);

  return lines.length ? `\n\nWIZARD CONTEXT:\n${lines.join("\n")}` : "";
}

function healthMemoryText(memory?: TriageHealthMemory): string {
  if (!memory) return "";
  const risks = profileRiskFlags(memory);
  const riskLabels = [
    risks.diabetes ? "diabetes or glucose medication" : "",
    risks.copd ? "COPD/asthma/oxygen support" : "",
    risks.heartFailure ? "heart failure/fluid risk" : "",
    risks.heartDisease ? "heart disease" : "",
    risks.afib ? "atrial fibrillation/irregular heartbeat" : "",
    risks.hypertension ? "high blood pressure/stroke risk" : "",
    risks.bloodThinner ? "blood thinner/bleeding risk" : "",
    risks.immunosuppressed ? "low immunity" : "",
    risks.cognitiveConcern ? "cognitive or confusion vulnerability" : "",
    risks.kidneyDisease ? "kidney disease/dehydration medication risk" : "",
    risks.strokeHistory ? "stroke/TIA history" : "",
    risks.fallsFrailty ? "falls or frailty risk" : "",
    risks.parkinsonMobility ? "Parkinson's/mobility/swallowing risk" : "",
    risks.osteoporosis ? "osteoporosis/fracture risk" : "",
    risks.cancerActive ? "active cancer or chemotherapy" : "",
    risks.recentSurgery ? "recent surgery or hospital stay" : "",
    risks.utiHistory ? "UTI/recurrent infection risk" : "",
    risks.liverDisease ? "liver disease/bleeding or confusion risk" : "",
    risks.depressionAnxiety ? "mood or anxiety vulnerability" : "",
    risks.sedatingMedication ? "sedating medication/fall risk" : "",
    risks.opioidMedication ? "opioid/breathing or oversedation risk" : "",
    risks.diureticMedication ? "diuretic/dehydration risk" : "",
    risks.steroidMedication ? "steroid/low immunity risk" : "",
  ].filter(Boolean);
  const lines = [
    memory.healthContext ? `Health profile summary: ${memory.healthContext}` : "",
    memory.careContext ? `Care and living context: ${memory.careContext}` : "",
    memory.checkinContext ? `Check-in context: ${memory.checkinContext}` : "",
    memory.conditions ? `Known conditions: ${memory.conditions}` : "",
    memory.allergies ? `Known allergies: ${memory.allergies}` : "",
    memory.medications ? `Current medications: ${memory.medications}` : "",
    memory.devices ? `Health devices: ${memory.devices}` : "",
    memory.latestVitals ? `Latest vitals: ${memory.latestVitals}` : "",
    memory.vitalsTrend ? `Vitals trend: ${memory.vitalsTrend}` : "",
    memory.latestSymptomReport ? `Latest symptom report: ${memory.latestSymptomReport}` : "",
    memory.recentSymptomReports ? `Recent symptom history: ${memory.recentSymptomReports}` : "",
    memory.medicationAdherence ? `Medication adherence: ${memory.medicationAdherence}` : "",
    memory.medicationInteraction ? `Medication interaction context: ${memory.medicationInteraction}` : "",
    memory.recentHealthEvents ? `Recent health events: ${memory.recentHealthEvents}` : "",
    memory.latestMedicalVisit ? `Latest medical visit: ${memory.latestMedicalVisit}` : "",
    memory.upcomingMedicalAppointment ? `Upcoming medical appointment: ${memory.upcomingMedicalAppointment}` : "",
    riskLabels.length ? `Deterministic profile flags: ${riskLabels.join(", ")}` : "",
  ].filter(Boolean);

  return lines.length
    ? `\n\nHEALTH MEMORY:\n${lines.join("\n")}\nUse this only to avoid repeated questions and ask more relevant follow-ups. Do not assume it is complete or current.`
    : "";
}

function isSpanishLocale(locale: string) {
  return locale.split("-")[0].toLowerCase() === "es";
}

function isFrenchLocale(locale: string) {
  return locale.split("-")[0].toLowerCase() === "fr";
}

const FRENCH_SERVER_TEXT: Record<string, string> = {
  "Choose symptom": "Choix du symptôme",
  "Pain location": "Localisation de la douleur",
  "Safety check": "Vérification de sécurité",
  "When it started": "Début du symptôme",
  "More details": "Plus de détails",
  "What changed": "Évolution",
  "Review answers": "Vérification des réponses",
  "Summary": "Résumé",
  "I am checking safety first because your support or check-in context may matter if this gets worse.": "Je vérifie d’abord la sécurité, car votre accompagnement ou vos suivis peuvent être importants si la situation s’aggrave.",
  "I am checking urgent warning signs first because a similar symptom was recorded recently.": "Je vérifie d’abord les signes d’alerte urgents, car un symptôme similaire a été enregistré récemment.",
  "I am asking this because medication timing or missed doses can sometimes change how symptoms feel.": "Je pose cette question, car l’horaire d’un médicament ou une dose oubliée peut modifier les symptômes.",
  "I am asking this because your recent readings or health devices may help decide whether to monitor or get support.": "Je pose cette question, car vos mesures récentes ou appareils de santé peuvent aider à décider s’il faut surveiller ou demander de l’aide.",
  "I am checking timing because VYVA has a recent report that may be related.": "Je vérifie le moment d’apparition, car VYVA dispose d’un rapport récent qui pourrait être lié.",
  "I am asking about support so this can fit with the care or appointment already recorded.": "Je vérifie votre accompagnement afin de tenir compte des soins ou rendez-vous déjà enregistrés.",
  "I am checking this because your health profile can make this symptom more important.": "Je vérifie ce point, car votre profil de santé peut rendre ce symptôme plus important.",
  "If you can, one reading may help": "Si vous le pouvez, une mesure peut aider",
  "Only do this if it is easy and safe. You can keep answering without it.": "Ne le faites que si c’est simple et sans danger. Vous pouvez continuer sans cette mesure.",
  "Oxygen": "Oxygène",
  "Pulse": "Pouls",
  "Blood pressure": "Tension artérielle",
  "Temperature": "Température",
  "Blood sugar": "Glycémie",
  "This assessment is for information only and is not medical advice. Always consult your doctor or call emergency services if you feel it is serious.": "Cette évaluation est fournie à titre informatif et ne constitue pas un avis médical. Consultez toujours votre médecin ou appelez les urgences si la situation vous paraît grave.",
};

function text(locale: string, english: string, spanish: string) {
  if (isFrenchLocale(locale)) return FRENCH_SERVER_TEXT[english] ?? english;
  return isSpanishLocale(locale) ? spanish : english;
}

function reply(
  locale: string,
  id: string,
  kind: TriageQuickReply["kind"],
  labelEn: string,
  labelEs: string,
  valueEn: string,
  valueEs: string,
  icon: TriageQuickReply["icon"],
  tone: TriageQuickReply["tone"],
): TriageQuickReply {
  const label = text(locale, labelEn, labelEs);
  return {
    id,
    kind,
    label: localizeTriageAnswerLabel(locale, label),
    value: text(locale, valueEn, valueEs),
    icon,
    tone,
  };
}

function normalizeClue(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ");
}

function firstUserClue(messages: ChatMessage[]) {
  return messages.find((message) => message.role === "user")?.content?.trim() ?? "";
}

function inferSymptomFromClue(rawClue: string, locale: string): TriageQuickReply | null {
  const clue = normalizeClue(rawClue);
  if (!clue) return null;

  if (/\b(chest|pressure in chest|tight chest|heart pain|dolor.*pecho|presion.*pecho|opresion.*pecho)\b/.test(clue)) {
    return reply(locale, "chest", "symptom", "Chest discomfort", "Molestia de pecho", "I have chest discomfort.", "Tengo molestia de pecho.", "heart", "red");
  }
  if (/\b(breath|breathing|short of breath|air|wheeze|oxygen|spo2|blue lip|labios azul|respirar|aire|oxigeno|sibil)\b/.test(clue)) {
    return reply(locale, "breathing", "symptom", "Breathing", "Respirar", "I feel short of breath.", "Me falta el aire.", "wind", "blue");
  }
  if (/\b(confus|memory|not myself|disorient|delir|forget|confund|memoria|desorient)\b/.test(clue)) {
    return reply(locale, "confusion", "symptom", "Confusion", "Confusion", "I feel confused or not like myself.", "Tengo confusion o no me siento como siempre.", "alert", "red");
  }
  if (/\b(fall|fell|injur|hit|bump|bruise|caida|cai|golpe|herid|lesion)\b/.test(clue)) {
    return reply(locale, "fall", "symptom", "Fall or injury", "Caida o golpe", "I fell or hurt myself.", "Me cai o me hice dano.", "alert", "red");
  }
  if (/\b(urine|pee|peeing|bladder|burning when|uti|orina|orinar|pip[iy]|vejiga|ardor)\b/.test(clue)) {
    return reply(locale, "urinary", "symptom", "Urine problem", "Problema de orina", "I have a urine problem.", "Tengo problema de orina.", "help", "blue");
  }
  if (/\b(skin|rash|wound|cut|redness|swelling|pus|itch|piel|erupcion|roncha|herida|rojez|hinch|picor)\b/.test(clue)) {
    return reply(locale, "skin", "symptom", "Skin or wound", "Piel o herida", "I have a skin or wound problem.", "Tengo problema de piel o herida.", "help", "amber");
  }
  if (/\b(stomach|belly|abdomen|bowel|diarrhea|vomit|nausea|constipat|barriga|estomago|vientre|diarrea|vomit|nausea|estren)\b/.test(clue)) {
    return reply(locale, "stomach", "symptom", "Stomach or bowel", "Estomago o intestino", "I have stomach or bowel trouble.", "Tengo problema de estomago o intestino.", "activity", "amber");
  }
  if (/\b(fever|temperature|chills|hot|fiebre|temperatura|escalofrio|caliente)\b/.test(clue)) {
    return reply(locale, "fever", "symptom", "Fever", "Fiebre", "I have a fever.", "Tengo fiebre.", "thermometer", "amber");
  }
  if (/\b(dizzy|dizziness|dizzier|vertigo|lightheaded|light headed|faint|fainting|mareo|maread|desmay)\b/.test(clue)) {
    return reply(locale, "dizzy", "symptom", "Dizzy", "Mareo", "I feel dizzy.", "Me siento mareada o mareado.", "activity", "amber");
  }
  if (/\b(tired|weak|fatigue|exhaust|sleepy|cansad|debil|fatiga|agotad|sueno)\b/.test(clue)) {
    return reply(locale, "tired", "symptom", "Very tired", "Muy cansancio", "I feel very tired.", "Me siento muy cansada o cansado.", "activity", "purple");
  }
  if (/\b(pain|ache|headache|migraine|chest|back|joint|dolor|cabeza|migrana|pecho|espalda|articul)\b/.test(clue)) {
    return reply(locale, "pain", "symptom", "Pain", "Dolor", "I have pain.", "Tengo dolor.", "heart", "red");
  }

  return reply(locale, "other", "symptom", "Something else", "Otra cosa", "Something else is bothering me.", "Me pasa otra cosa.", "help", "purple");
}

function inferContextFromClue(rawClue: string, locale: string): TriageQuickReply | null {
  const clue = normalizeClue(rawClue);
  if (/\b(anxiety|anxious|panic|panicky|nervous|ansiedad|ansiedade|ansia|anxiete|angst|angstgefuhl|panico|panique|panik|nervios|nervioso|nerviosa|nervoso|nervosa)\b/.test(clue)) {
    return reply(locale, "anxiety_context", "free_text", "Anxiety or panic", "Ansiedad o panico", "This feels like anxiety or panic.", "Esto se siente como ansiedad o panico.", "help", "purple");
  }
  if (/\b(medicine|medication|tablet|pill|dose|new med|missed dose|took extra|side effect|medicina|medicacion|pastilla|dosis|efecto)\b/.test(clue)) {
    return reply(locale, "medication_context", "free_text", "Medicine change", "Cambio de medicina", "This may be related to a medicine or dose.", "Puede estar relacionado con una medicina o dosis.", "help", "purple");
  }

  return null;
}

function inferRedFlagFromClue(rawClue: string, symptomId: string | undefined, locale: string): TriageQuickReply | null {
  const clue = normalizeClue(rawClue);
  if (!clue) return null;

  if (/\b(blue lip|blue lips|labios azul|cyanotic|confused and.*breath|breath.*confus)\b/.test(clue)) {
    return reply(locale, "blue_confused", "red_flag", "Confused or blue lips", "Confusion o labios azules", "I feel blue-lipped, confused, or very unwell.", "Tengo labios azulados, confusion o me siento muy mal.", "alert", "red");
  }
  if (symptomId !== "chest" && /\b(chest pain|pressure in chest|dolor.*pecho|presion.*pecho)\b/.test(clue)) {
    return reply(locale, "chest_pain", "red_flag", "Chest pain", "Dolor en pecho", "I have chest pain.", "Tengo dolor en el pecho.", "alert", "red");
  }
  if (/\b(worst headache|worst pain|sudden severe|thunderclap|dolor.*repentino|dolor.*muy fuerte|peor dolor)\b/.test(clue)) {
    return reply(locale, "sudden_severe", "red_flag", "Sudden or severe", "Repentino o fuerte", "The pain is sudden or severe.", "El dolor es repentino o fuerte.", "alert", "red");
  }
  if (/\b(faint|fainted|passed out|desmaye|desmayo|perdi.*conocimiento)\b/.test(clue)) {
    return reply(locale, "fainted", "red_flag", "Fainted", "Desmayo", "I fainted or nearly fainted.", "Me desmaye o casi me desmayo.", "alert", "red");
  }
  if (/\b(one side|face droop|slurred|speech trouble|weakness.*side|un lado|cara caida|habla|dificultad.*hablar)\b/.test(clue)) {
    return reply(locale, "stroke_sign", "red_flag", "Weak on one side", "Debilidad en un lado", "I have weakness on one side, face droop, or trouble speaking.", "Tengo debilidad en un lado, cara caida o dificultad para hablar.", "alert", "red");
  }
  if (/\b(cannot stand|cant stand|cannot walk|cant walk|no puedo levantar|no puedo caminar)\b/.test(clue)) {
    return reply(locale, symptomId === "fall" ? "fall_cannot_stand" : "cannot_stand", "red_flag", "Cannot stand", "No puedo estar de pie", "I feel too weak to stand or walk safely.", "Me siento demasiado debil para estar de pie o caminar.", "alert", "red");
  }
  if (/\b(face.*swelling|throat.*swelling|tongue.*swelling|lip.*swelling|hinch.*cara|hinch.*garganta|hinch.*lengua|hinch.*labio)\b/.test(clue)) {
    return reply(locale, "allergic_swelling", "red_flag", "Face or throat swelling", "Cara o garganta hinchada", "My face, lips, tongue, or throat is swelling.", "Se hincha mi cara, labios, lengua o garganta.", "alert", "red");
  }

  return null;
}

function wizardWithInferredClue(
  wizard: TriageWizardContext | undefined,
  messages: ChatMessage[],
  locale: string,
): TriageWizardContext | undefined {
  const answers = wizard?.quickAnswers ?? [];
  if (answers.some((answer) => answer.kind === "symptom")) return wizard;

  const clue = firstUserClue(messages);
  const symptom = inferSymptomFromClue(clue, locale);
  if (!symptom) return wizard;

  const context = symptom.id === "other" ? inferContextFromClue(clue, locale) : null;
  const redFlag = inferRedFlagFromClue(clue, symptom.id, locale);
  const inferredAnswers = [
    { id: symptom.id, label: symptom.label, value: symptom.value, kind: symptom.kind },
    context ? { id: context.id, label: context.label, value: context.value, kind: context.kind } : null,
    redFlag ? { id: redFlag.id, label: redFlag.label, value: redFlag.value, kind: redFlag.kind } : null,
  ].filter(Boolean) as NonNullable<TriageWizardContext["quickAnswers"]>;

  return {
    ...wizard,
    quickAnswers: [...inferredAnswers, ...answers],
  };
}

function numberOrNull(value: unknown): number | null | undefined {
  if (value == null) return value as null | undefined;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sanitizeScanResults(raw: unknown): TriageScanResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index): TriageScanResult | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      if (!isTriageScanType(record.type)) return null;
      const label = typeof record.label === "string" && record.label.trim()
        ? record.label.trim().slice(0, 80)
        : triageScanLabel(record.type);
      const summary = typeof record.summary === "string" && record.summary.trim()
        ? record.summary.trim().slice(0, 240)
        : "";
      if (!summary) return null;
      const findings = Array.isArray(record.findings)
        ? record.findings
            .filter((finding): finding is string => typeof finding === "string" && finding.trim().length > 0)
            .map((finding) => finding.trim().slice(0, 160))
            .slice(0, 4)
        : [];
      const values = record.values && typeof record.values === "object"
        ? {
            pulseBpm: numberOrNull((record.values as Record<string, unknown>).pulseBpm),
            respiratoryRate: numberOrNull((record.values as Record<string, unknown>).respiratoryRate),
          }
        : undefined;

      return {
        id: typeof record.id === "string" && record.id.trim() ? record.id.trim().slice(0, 80) : `scan-${index}`,
        type: record.type,
        label,
        concernLevel: isTriageScanConcernLevel(record.concernLevel) ? record.concernLevel : "watch",
        summary,
        findings,
        capturedAt: typeof record.capturedAt === "string" && record.capturedAt.trim() ? record.capturedAt.trim().slice(0, 80) : new Date().toISOString(),
        values,
      };
    })
    .filter((item): item is TriageScanResult => Boolean(item))
    .slice(0, 4);
}

function sanitizeDeclinedScanTypes(raw: unknown): TriageScanType[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isTriageScanType))].slice(0, 4);
}

function sanitizeWizard(wizard: TriageWizardContext | undefined): TriageWizardContext | undefined {
  if (!wizard || typeof wizard !== "object") return wizard;
  return {
    ...wizard,
    scanResults: sanitizeScanResults(wizard.scanResults),
    declinedScanTypes: sanitizeDeclinedScanTypes(wizard.declinedScanTypes),
  };
}

function wizardStageLabel(stage: WizardStage, locale: string) {
  const labels: Record<WizardStage, { en: string; es: string }> = {
    symptom: { en: "Choose symptom", es: "Elige sintoma" },
    location: { en: "Pain location", es: "Zona del dolor" },
    red_flag: { en: "Safety check", es: "Chequeo de seguridad" },
    duration: { en: "When it started", es: "Cuando empezo" },
    severity: { en: "More details", es: "Mas detalles" },
    trend: { en: "What changed", es: "Que cambio" },
    support: { en: "Review answers", es: "Revisar respuestas" },
    complete: { en: "Summary", es: "Resumen" },
  };
  return text(locale, labels[stage].en, labels[stage].es);
}

function wizardQuestionText(
  stage: WizardStage,
  wizard: TriageWizardContext | undefined,
  locale: string,
): string {
  const symptomId = selectedSymptomId(wizard);
  if (stage === "support") {
    return localizeTriageQuestion(locale, text(locale, "Does this look right?", "Esto parece correcto?"));
  }
  if (stage === "severity") {
    return localizeTriageQuestion(locale, text(locale, "How strong is it?", "Que intensidad tiene?"));
  }
  if (!["symptom", "location", "red_flag", "duration", "severity", "trend"].includes(stage)) {
    return localizeTriageQuestion(locale, text(locale, "Here is what to do next.", "Esto es lo siguiente que puedes hacer."));
  }
  const answerIds = new Set(selectedAnswers(wizard).map((answer) => answer.id));
  const node = triageWizardNodeFor(stage as TriageWizardMatrixStage, symptomId, answerIds);
  return localizeTriageQuestion(locale, text(locale, node.question.en, node.question.es));
}

function uniqueReplies(replies: TriageQuickReply[]) {
  return [...new Map(replies.map((reply) => [reply.id, reply])).values()];
}

function withProfileReplies(
  baseReplies: TriageQuickReply[],
  profileReplies: TriageQuickReply[],
  maxCount = 6,
) {
  return uniqueReplies([...profileReplies, ...baseReplies]).slice(0, maxCount);
}

function profileRedFlagReplies(
  locale: string,
  symptomId: string | undefined,
  risks: ProfileRiskFlags,
): TriageQuickReply[] {
  const replies: TriageQuickReply[] = [];

  if (risks.diabetes && ["dizzy", "tired", "fever", "urinary", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "low_sugar", "red_flag", "Low sugar signs", "Senales de azucar baja", "I feel shaky, sweaty, confused, or very weak.", "Tengo temblor, sudor, confusion o mucha debilidad.", "alert", "red"),
      reply(locale, "high_sugar_sick", "red_flag", "High sugar and sick", "Azucar alta y malestar", "My sugar is high and I feel sick, thirsty, or drowsy.", "Tengo azucar alta y malestar, mucha sed o sueno.", "alert", "red"),
    );
  }

  if (risks.copd && symptomId === "breathing") {
    replies.push(
      reply(locale, "low_oxygen", "red_flag", "Low oxygen", "Oxigeno bajo", "My oxygen is low or I need more oxygen than usual.", "Tengo oxigeno bajo o necesito mas oxigeno de lo normal.", "wind", "red"),
    );
  }

  if (risks.heartFailure && ["breathing", "tired", "fall", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "swelling_weight_gain", "red_flag", "Swelling or weight gain", "Hinchazon o peso subio", "My legs are more swollen or my weight went up quickly.", "Mis piernas estan mas hinchadas o subi de peso rapido.", "heart", "amber"),
    );
  }

  if ((risks.heartDisease || risks.afib) && ["chest", "pain", "breathing", "dizzy", "tired", "fall", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "irregular_heartbeat", "red_flag", "Irregular heartbeat", "Latido irregular", "I have chest pressure, palpitations, fainting, or breathlessness.", "Tengo presion en el pecho, palpitaciones, desmayo o falta de aire.", "heart", "red"),
    );
  }

  if (risks.hypertension && ["chest", "pain", "dizzy", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "very_high_bp", "red_flag", "Very high blood pressure", "Presion muy alta", "My blood pressure is very high or I have weakness or speech trouble.", "Tengo la presion muy alta o debilidad o dificultad para hablar.", "alert", "red"),
    );
  }

  if (risks.strokeHistory && ["chest", "pain", "dizzy", "tired", "fall", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "one_sided_weakness", "red_flag", "Weakness or speech trouble", "Debilidad o habla rara", "I have face droop, one-sided weakness, vision change, or speech trouble.", "Tengo cara caida, debilidad en un lado, cambio de vision o dificultad para hablar.", "alert", "red"),
    );
  }

  if (risks.bloodThinner && ["pain", "dizzy", "fall", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "head_hit_blood_thinner", "red_flag", "Hit my head", "Golpe en la cabeza", "I hit my head or fell while taking a blood thinner.", "Me golpee la cabeza o cai tomando anticoagulante.", "alert", "red"),
      reply(locale, "unusual_bleeding", "red_flag", "Unusual bleeding", "Sangrado raro", "I have unusual bleeding, black stool, or a large bruise.", "Tengo sangrado raro, heces negras o moreton grande.", "alert", "red"),
    );
  }

  if ((risks.immunosuppressed || risks.cancerActive || risks.steroidMedication) && symptomId === "fever") {
    replies.push(
      reply(locale, "immuno_fever", "red_flag", "Fever with low immunity", "Fiebre con defensas bajas", "I have fever and low immunity or cancer treatment.", "Tengo fiebre y defensas bajas o tratamiento contra cancer.", "alert", "red"),
    );
  }

  if (risks.cognitiveConcern && ["fever", "dizzy", "tired", "urinary", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "new_confusion", "red_flag", "New confusion", "Confusion nueva", "I feel newly confused or not like myself.", "Tengo confusion nueva o no me siento como siempre.", "alert", "red"),
    );
  }

  if (risks.kidneyDisease && ["fever", "dizzy", "tired", "urinary", "stomach", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "low_urine_swelling", "red_flag", "Low urine or swelling", "Poca orina o hinchazon", "I am passing much less urine, very swollen, or very dehydrated.", "Orino mucho menos, estoy muy hinchado o muy deshidratado.", "alert", "red"),
    );
  }

  if ((risks.fallsFrailty || risks.osteoporosis) && ["pain", "dizzy", "fall", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "hip_back_after_fall", "red_flag", "Fall with hip or back pain", "Caida con dolor cadera", "I fell and now have hip or back pain, or trouble standing.", "Me cai y ahora tengo dolor de cadera o espalda, o me cuesta estar de pie.", "alert", "red"),
    );
  }

  if (risks.parkinsonMobility && ["breathing", "tired", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "cannot_swallow", "red_flag", "Trouble swallowing", "Dificultad al tragar", "I am choking, coughing with food, or cannot swallow safely.", "Me atraganto, toso al comer o no puedo tragar con seguridad.", "alert", "red"),
    );
  }

  if (risks.recentSurgery && ["fever", "breathing", "pain", "skin", "fall", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "fever_after_surgery", "red_flag", "Fever after surgery", "Fiebre tras cirugia", "I have fever, redness, swelling, or drainage near a wound.", "Tengo fiebre, enrojecimiento, hinchazon o secrecion cerca de una herida.", "alert", "red"),
      reply(locale, "calf_swelling_surgery", "red_flag", "Calf swelling", "Pantorrilla hinchada", "One calf is swollen or painful, or I am newly short of breath.", "Una pantorrilla esta hinchada o duele, o tengo nueva falta de aire.", "alert", "red"),
    );
  }

  if (risks.utiHistory && ["fever", "dizzy", "tired", "urinary", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "urine_confusion", "red_flag", "Urine change or confusion", "Orina o confusion", "I have burning urine, fever, new confusion, or new weakness.", "Tengo ardor al orinar, fiebre, confusion nueva o debilidad nueva.", "alert", "red"),
    );
  }

  if (risks.liverDisease && ["dizzy", "tired", "pain", "stomach", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "liver_confusion_bleeding", "red_flag", "Confusion or bleeding", "Confusion o sangrado", "I have new confusion, black stool, vomiting blood, or yellow skin.", "Tengo confusion nueva, heces negras, vomito sangre o piel amarilla.", "alert", "red"),
    );
  }

  if (risks.sedatingMedication && ["dizzy", "tired", "fall", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "over_sedated", "red_flag", "Very sleepy or unsteady", "Mucho sueno o inestable", "I am very sleepy, confused, or more unsteady than usual.", "Tengo mucho sueno, confusion o estoy mas inestable de lo normal.", "alert", "amber"),
    );
  }

  if (risks.opioidMedication && ["breathing", "tired", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "opioid_breathing", "red_flag", "Slow breathing", "Respiracion lenta", "I am very sleepy or breathing slower than usual.", "Tengo mucho sueno o respiro mas lento de lo normal.", "alert", "red"),
    );
  }

  if ((risks.diureticMedication || risks.kidneyDisease) && ["dizzy", "tired", "urinary", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "dehydration_diuretic", "red_flag", "Dehydration signs", "Senales de deshidratacion", "I am dizzy standing, very thirsty, or passing little urine.", "Me mareo al estar de pie, tengo mucha sed o orino poco.", "alert", "amber"),
    );
  }

  return replies;
}

function profileContextUsedForQuestion(stage: WizardStage, symptomId: string | undefined, healthMemory?: TriageHealthMemory) {
  if (stage !== "red_flag") return false;
  return profileRedFlagReplies("en", symptomId, profileRiskFlags(healthMemory)).length > 0;
}

const SYMPTOM_MEMORY_PATTERNS: Record<string, RegExp> = {
  breathing: /\b(breath|oxygen|spo2|wheeze|air|respir|falta de aire|oxigeno)\b/,
  chest: /\b(chest|pressure|tight|heart|pecho|presion)\b/,
  confusion: /\b(confus|memory|disorient|not like myself|confusion|memoria|desorient)\b/,
  dizzy: /\b(dizz|faint|lightheaded|vertigo|mareo|desmay)\b/,
  fall: /\b(fall|fell|injur|hit|unsteady|caida|golpe|lesion)\b/,
  fever: /\b(fever|temperature|chills|infection|fiebre|temperatura)\b/,
  pain: /\b(pain|ache|headache|dolor|cabeza)\b/,
  skin: /\b(skin|wound|rash|swelling|piel|herida|hinch)\b/,
  stomach: /\b(stomach|bowel|vomit|nausea|diarrhea|belly|estomago|diarrea|vomit|nausea)\b/,
  tired: /\b(tired|weak|fatigue|sleepy|cansad|debil|fatiga)\b/,
  urinary: /\b(urine|bladder|pee|uti|orina|vejiga)\b/,
};

function memoryBlob(memory: TriageHealthMemory | undefined, fields: Array<keyof TriageHealthMemory>) {
  return normalizeClue(fields.map((field) => memory?.[field] ?? "").join(" "));
}

function hasRecentSymptomMemory(symptomId: string | undefined, healthMemory?: TriageHealthMemory) {
  if (!symptomId) return false;
  const pattern = SYMPTOM_MEMORY_PATTERNS[symptomId];
  if (!pattern) return false;
  const recentText = memoryBlob(healthMemory, ["latestSymptomReport", "recentSymptomReports", "recentHealthEvents"]);
  return pattern.test(recentText);
}

function hasMedicationMemory(healthMemory?: TriageHealthMemory) {
  const medicationText = memoryBlob(healthMemory, ["medicationAdherence", "medicationInteraction", "medications"]);
  return /\b(missed|skipped|late|dose|tablet|pill|medicine|medication|side effect|missed\/skipped|pastilla|dosis|medicina)\b/.test(medicationText);
}

function hasCareSafetyMemory(healthMemory?: TriageHealthMemory) {
  const careText = memoryBlob(healthMemory, ["careContext", "checkinContext"]);
  return /\b(living alone|alone|no care|caregiver|emergency contact|missed check|possible missed|overdue|support mode|vive sol|cuidador)\b/.test(careText);
}

function hasVitalsOrDeviceMemory(healthMemory?: TriageHealthMemory) {
  const signalText = memoryBlob(healthMemory, ["devices", "latestVitals", "vitalsTrend", "recentHealthEvents"]);
  return /\b(oxygen|spo2|pulse|heart rate|blood pressure|temperature|glucose|walker|walking aid|sensor|device|vital|presion|pulso|oxigeno)\b/.test(signalText);
}

function memoryReasonForQuestion(
  stage: WizardStage,
  symptomId: string | undefined,
  locale: string,
  healthMemory?: TriageHealthMemory,
) {
  if (!healthMemory) return "";
  if (stage === "red_flag" && hasCareSafetyMemory(healthMemory) && ["dizzy", "fall", "confusion", "breathing", "tired", "other"].includes(symptomId ?? "")) {
    return text(
      locale,
      "I am checking safety first because your support or check-in context may matter if this gets worse.",
      "Primero compruebo seguridad porque tu apoyo o contexto de check-in puede importar si esto empeora.",
    );
  }
  if (stage === "red_flag" && hasRecentSymptomMemory(symptomId, healthMemory)) {
    return text(
      locale,
      "I am checking urgent warning signs first because a similar symptom was recorded recently.",
      "Primero compruebo senales urgentes porque se registro un sintoma parecido recientemente.",
    );
  }
  if (["red_flag", "severity", "trend"].includes(stage) && hasMedicationMemory(healthMemory) && ["dizzy", "tired", "confusion", "stomach", "breathing", "other"].includes(symptomId ?? "")) {
    return text(
      locale,
      "I am asking this because medication timing or missed doses can sometimes change how symptoms feel.",
      "Pregunto esto porque los horarios de medicacion o dosis omitidas a veces pueden cambiar como se sienten los sintomas.",
    );
  }
  if (["severity", "trend"].includes(stage) && hasVitalsOrDeviceMemory(healthMemory)) {
    return text(
      locale,
      "I am asking this because your recent readings or health devices may help decide whether to monitor or get support.",
      "Pregunto esto porque tus mediciones recientes o dispositivos de salud pueden ayudar a decidir si vigilar o pedir apoyo.",
    );
  }
  if (stage === "duration" && hasRecentSymptomMemory(symptomId, healthMemory)) {
    return text(
      locale,
      "I am checking timing because VYVA has a recent report that may be related.",
      "Compruebo el tiempo porque VYVA tiene un informe reciente que puede estar relacionado.",
    );
  }
  if (stage === "support" && healthMemory.upcomingMedicalAppointment) {
    return text(
      locale,
      "I am asking about support so this can fit with the care or appointment already recorded.",
      "Pregunto sobre apoyo para que encaje con la atencion o cita ya registrada.",
    );
  }
  return "";
}

function memoryContextUsedForQuestion(stage: WizardStage, symptomId: string | undefined, healthMemory?: TriageHealthMemory) {
  return Boolean(memoryReasonForQuestion(stage, symptomId, "en", healthMemory));
}

function questionReasonFor(
  stage: WizardStage,
  wizard: TriageWizardContext | undefined,
  locale: string,
  healthMemory?: TriageHealthMemory,
) {
  const symptomId = selectedSymptomId(wizard);
  const profileUsed = profileContextUsedForQuestion(stage, symptomId, healthMemory);
  if (profileUsed) {
    return text(
      locale,
      "I am checking this because your health profile can make this symptom more important.",
      "Lo estoy comprobando porque tu perfil de salud puede hacer que este sintoma sea mas importante.",
    );
  }
  const memoryReason = memoryReasonForQuestion(stage, symptomId, locale, healthMemory);
  if (memoryReason) return memoryReason;

  const reasons: Record<WizardStage, { en: string; es: string }> = {
    symptom: {
      en: "I first need to understand what feels different so I can choose the safest next question.",
      es: "Primero necesito entender que se siente diferente para elegir la siguiente pregunta mas segura.",
    },
    location: {
      en: "Where the pain is helps VYVA ask only the warning signs that fit.",
      es: "La zona del dolor ayuda a VYVA a preguntar solo las senales de alerta relevantes.",
    },
    red_flag: {
      en: "I am checking urgent warning signs first, before asking about smaller details.",
      es: "Primero compruebo senales urgentes de alerta, antes de preguntar detalles menores.",
    },
    duration: {
      en: "When it started helps decide whether to monitor, call support, or seek care.",
      es: "Cuando empezo ayuda a decidir si vigilar, llamar a apoyo o buscar atencion.",
    },
    severity: {
      en: "How strong it feels helps choose the safest next step.",
      es: "La intensidad ayuda a elegir el siguiente paso mas seguro.",
    },
    trend: {
      en: "Whether it is getting better or worse helps decide what to do next.",
      es: "Saber si mejora o empeora ayuda a decidir que hacer despues.",
    },
    support: {
      en: "I am helping you choose the safest way to get support.",
      es: "Te ayudo a elegir la forma mas segura de recibir apoyo.",
    },
    complete: {
      en: "Your answers are enough to prepare the next step.",
      es: "Tus respuestas son suficientes para preparar el siguiente paso.",
    },
  };
  const reason = reasons[stage] ?? reasons.symptom;
  return text(locale, reason.en, reason.es);
}

function hasPromptVital(wizard: TriageWizardContext | undefined, actionId: TriageVitalsPromptAction["id"]) {
  const vitals = wizard?.vitals;
  if (!vitals) return false;
  if (actionId === "pulse") return typeof vitals.bpm === "number";
  if (actionId === "oxygen") return typeof vitals.oxygenSaturation === "number";
  if (actionId === "blood_pressure") return typeof vitals.systolicBp === "number" && typeof vitals.diastolicBp === "number";
  if (actionId === "temperature") return typeof vitals.temperatureC === "number";
  if (actionId === "glucose") return typeof vitals.glucoseMgdl === "number";
  return false;
}

function vitalsAction(
  locale: string,
  id: TriageVitalsPromptAction["id"],
  labelEn: string,
  labelEs: string,
  valueEn: string,
  valueEs: string,
  icon: TriageVitalsPromptAction["icon"],
  tone: TriageVitalsPromptAction["tone"],
): TriageVitalsPromptAction {
  return { id, label: text(locale, labelEn, labelEs), value: text(locale, valueEn, valueEs), icon, tone };
}

function vitalsPromptFor(stage: WizardStage, wizard: TriageWizardContext | undefined, locale: string, healthMemory?: TriageHealthMemory): TriageVitalsPrompt {
  if (stage === "symptom" || stage === "red_flag" || stage === "support" || stage === "complete") return null;
  if (!selectedAnswers(wizard).some((answer) => answer.kind === "red_flag") || selectedSafetyAnswer(wizard)) return null;
  if (wizard?.declinedScanTypes?.includes("vitals")) return null;
  const symptomId = selectedSymptomId(wizard);
  const risks = profileRiskFlags(healthMemory);
  const answerIds = new Set(selectedAnswers(wizard).map((answer) => answer.id));
  const locationId = selectedAnswers(wizard).find((answer) => answer.kind === "location")?.id;
  const requested = new Map<TriageVitalsPromptAction["id"], { action: TriageVitalsPromptAction; score: number }>();
  const add = (action: TriageVitalsPromptAction, score: number) => {
    if (hasPromptVital(wizard, action.id)) return;
    const current = requested.get(action.id);
    if (!current || score > current.score) requested.set(action.id, { action, score });
  };

  const oxygen = () => vitalsAction(locale, "oxygen", "Oxygen", "Oxigeno", "I can check my oxygen level if that would help.", "Puedo comprobar mi oxigeno si ayuda.", "wind", "blue");
  const pulse = () => vitalsAction(locale, "pulse", "Pulse", "Pulso", "I can check my pulse if that would help.", "Puedo comprobar mi pulso si ayuda.", "heart", "purple");
  const bloodPressure = () => vitalsAction(locale, "blood_pressure", "Blood pressure", "Presion arterial", "I can check my blood pressure if that would help.", "Puedo comprobar mi presion arterial si ayuda.", "activity", "blue");
  const temperature = () => vitalsAction(locale, "temperature", "Temperature", "Temperatura", "I can check my temperature if that would help.", "Puedo comprobar mi temperatura si ayuda.", "thermometer", "amber");
  const glucose = () => vitalsAction(locale, "glucose", "Blood sugar", "Azucar", "I can check my blood sugar if that would help.", "Puedo comprobar mi azucar si ayuda.", "activity", "amber");

  if (symptomId === "breathing") {
    add(oxygen(), 110);
    if (risks.afib || risks.heartDisease || risks.heartFailure) add(pulse(), 100);
  }
  if (symptomId === "chest") {
    add(pulse(), 100);
    if (risks.hypertension) add(bloodPressure(), 95);
    if (risks.copd || risks.heartFailure) add(oxygen(), 95);
  }
  if (symptomId === "dizzy") {
    if (risks.diabetes) add(glucose(), 115);
    add(bloodPressure(), risks.hypertension || risks.diureticMedication ? 105 : 90);
    if (risks.afib || risks.heartDisease || answerIds.has("fainted_with_chest")) add(pulse(), 100);
  }
  if (symptomId === "fever") add(temperature(), 115);
  if (symptomId === "urinary" && answerIds.has("no_red_flag")) add(temperature(), 105);
  if (symptomId === "stomach" && answerIds.has("no_red_flag")) add(temperature(), 95);
  if (symptomId === "skin" && (answerIds.has("wound_spreading") || risks.immunosuppressed)) add(temperature(), 100);
  if (symptomId === "confusion" && risks.diabetes) add(glucose(), 115);
  if (symptomId === "tired") {
    if (risks.diabetes) add(glucose(), 110);
    if (risks.afib || risks.heartFailure) add(pulse(), 95);
  }
  if (symptomId === "pain" && locationId === "head_neck_pain" && risks.hypertension) {
    add(bloodPressure(), 105);
  }

  const ranked = [...requested.values()].sort((left, right) => right.score - left.score);
  const actions = ranked
    .filter((item, index) => index === 0 || item.score >= 95)
    .slice(0, 2)
    .map((item) => item.action);
  if (!actions.length) return null;
  return {
    title: text(locale, "A quick vital-sign check could help", "Una comprobacion rapida de constantes puede ayudar"),
    body: text(locale, "Use your phone camera to estimate heart and breathing rate, enter a device reading, or skip this. Only do it if it is easy and safe.", "Usa la camara del telefono para estimar el pulso y la respiracion, introduce una medicion o salta este paso. Hazlo solo si es facil y seguro."),
    actions,
  };
}

function guidancePlanFor(
  stage: WizardStage,
  wizard: TriageWizardContext | undefined,
  locale: string,
  healthMemory: TriageHealthMemory | undefined,
  messages: ChatMessage[],
): TriageGuidancePlanResponse {
  return buildGuidancePlan({
    locale,
    stage,
    wizard,
    healthMemory,
    messages,
  });
}

function matrixReplyToQuickReply(locale: string, item: TriageWizardMatrixReply): TriageQuickReply {
  return reply(
    locale,
    item.id,
    item.kind as TriageQuickReply["kind"],
    item.label.en,
    item.label.es,
    item.value.en,
    item.value.es,
    item.icon,
    item.tone,
  );
}

function quickRepliesFor(wizard: TriageWizardContext | undefined, locale: string, healthMemory?: TriageHealthMemory): TriageQuickReply[] {
  const stage = nextAdaptiveStage(wizard, healthMemory);
  if (stage === "complete") return [];
  if (stage === "support") {
    return [
      reply(
        locale,
        "edit_answers",
        "support",
        "Edit",
        "Editar",
        "I want to edit my answers.",
        "Quiero editar mis respuestas.",
        "activity",
        "purple",
      ),
      reply(
        locale,
        "confirm_review",
        "support",
        "Yes, show my guidance",
        "Si, muestra mi orientacion",
        "These answers are correct. Show my guidance.",
        "Estas respuestas son correctas. Muestra mi orientacion.",
        "help",
        "purple",
      ),
    ];
  }
  if (stage === "severity") {
    return Array.from({ length: 11 }, (_, score) => reply(
      locale,
      `severity_${score}`,
      "severity",
      String(score),
      String(score),
      `The symptom feels ${score} out of 10.`,
      `El sintoma se siente ${score} de 10.`,
      "activity",
      score >= 7 ? "red" : score >= 4 ? "amber" : "green",
    ));
  }
  if (!["symptom", "location", "red_flag", "duration", "severity", "trend"].includes(stage)) return [];

  const symptomId = selectedSymptomId(wizard);
  if (stage === "red_flag" && !symptomId) return quickRepliesFor(undefined, locale, healthMemory);

  const answerIds = new Set(selectedAnswers(wizard).map((answer) => answer.id));
  const baseReplies = triageWizardNodeFor(stage as TriageWizardMatrixStage, symptomId, answerIds)
    .replies
    .map((item) => matrixReplyToQuickReply(locale, item));

  if (stage === "red_flag") {
    return withProfileReplies(baseReplies, profileRedFlagReplies(locale, symptomId, profileRiskFlags(healthMemory)));
  }

  return baseReplies;
}

function emergencyPhrase(locale: string, emergencyContact: EmergencyContact) {
  if (!emergencyContact.telHref) {
    if (isFrenchLocale(locale)) return "les services d’urgence locaux";
    return text(locale, "local emergency services", "emergencias locales");
  }
  if (isFrenchLocale(locale)) return `les services d’urgence (${emergencyContact.label})`;
  return text(locale, `emergency services (${emergencyContact.label})`, `emergencias (${emergencyContact.label})`);
}

function safetyMessage(locale: string, warningLabel: string, emergencyContact: EmergencyContact) {
  const emergency = emergencyPhrase(locale, emergencyContact);
  if (isFrenchLocale(locale)) {
    return `${warningLabel} peut être un signe d’urgence. Si cela se produit maintenant, appelez ${emergency} immédiatement ou demandez de l’aide à une personne proche. Ne conduisez pas vous-même.`;
  }
  return text(
    locale,
    `${warningLabel} can be an emergency warning sign. If this is happening now, call ${emergency} now or ask someone nearby to help you. Do not drive yourself.`,
    `${warningLabel} puede ser una senal de emergencia. Si esto esta pasando ahora, llama a ${emergency} ahora o pide ayuda a alguien cercano. No conduzcas.`,
  );
}

function safetyRecommendation(locale: string, emergencyContact: EmergencyContact) {
  const emergency = emergencyPhrase(locale, emergencyContact);
  if (isFrenchLocale(locale)) {
    return `Appelez ${emergency} immédiatement si cela se produit maintenant. Demandez à une personne proche de rester avec vous et ne conduisez pas vous-même.`;
  }
  return text(
    locale,
    `Call ${emergency} now if this is happening now. Ask someone nearby to stay with you and do not drive yourself.`,
    `Llama a ${emergency} ahora si esto esta pasando ahora. Pide a alguien cercano que se quede contigo y no conduzcas.`,
  );
}

function safetyQuickReplies(locale: string, emergencyContact: EmergencyContact): TriageQuickReply[] {
  const callLabelEn = isFrenchLocale(locale)
    ? emergencyContact.telHref
      ? `Appeler le ${emergencyContact.label}`
      : "Appeler les urgences"
    : emergencyContact.telHref
      ? `Call ${emergencyContact.label}`
      : "Call emergency";
  const callLabelEs = emergencyContact.telHref ? `Llamar ${emergencyContact.label}` : "Llamar emergencias";
  const callValueEn = emergencyContact.telHref ? `I will call ${emergencyContact.label} now.` : "I will call local emergency services now.";
  const callValueEs = emergencyContact.telHref ? `Llamare al ${emergencyContact.label} ahora.` : "Llamare a emergencias locales ahora.";
  return [
    reply(locale, "call_emergency", "support", callLabelEn, callLabelEs, callValueEn, callValueEs, "alert", "red"),
    reply(locale, "contact_doctor", "support", "Call doctor", "Llamar medico", "I want to contact my doctor or clinic today.", "Quiero contactar hoy con mi medico o clinica.", "heart", "amber"),
    reply(locale, "make_report", "support", "Make report", "Crear informe", "Please make a clear report I can share.", "Por favor crea un informe claro para compartir.", "help", "purple"),
    reply(locale, "continue_questions", "support", "Keep asking", "Seguir preguntas", "I understand. Please keep asking simple questions.", "Entiendo. Sigue haciendo preguntas simples.", "activity", "blue"),
  ];
}

function medisearchContextText(context?: MediSearchTriageContext | null): string {
  if (!context) return "";
  const sourceLines = context.articles
    .slice(0, 3)
    .map((article, index) => `${index + 1}. ${article.title ?? "Medical source"}${article.year ? ` (${article.year})` : ""}${article.tldr ? `: ${article.tldr}` : ""}`);
  return `\n\nMEDISEARCH EVIDENCE CONTEXT:
${context.answer ? `Summary: ${context.answer.slice(0, 1200)}` : ""}
${context.followups.length ? `Suggested follow-up topics: ${context.followups.slice(0, 3).join("; ")}` : ""}
${sourceLines.length ? `Sources:\n${sourceLines.join("\n")}` : ""}

Use this evidence actively:
- Let it shape the next safety question when it names red flags relevant to this symptom.
- Reflect its concrete red flags in watchSigns when a final summary is produced.
- Do not cite it as a diagnosis. Do not mention article titles to the senior unless the app surfaces them separately.
Ask one simple question at a time.`;
}

function cleanEvidenceSummary(answer: string) {
  return answer
    .replace(/\s+/g, " ")
    .replace(/[*#`]/g, "")
    .trim()
    .slice(0, 260);
}

function evidenceSummaryFor(context?: MediSearchTriageContext | null) {
  if (!context?.answer) return "";
  return cleanEvidenceSummary(context.answer);
}

function evidenceSourcesFor(context?: MediSearchTriageContext | null) {
  return context?.articles.slice(0, 3).map((article) => ({
    title: article.title,
    url: article.url,
    year: article.year,
    journal: article.journal,
  })) ?? [];
}

function triageQuestionMatrixText() {
  return triageWizardMatrixPromptText();
}

function buildSystemPrompt(
  language: string,
  locale: string,
  bpm: number | null,
  gender: GrammaticalGender,
  wizard?: TriageWizardContext,
  medisearchContext?: MediSearchTriageContext | null,
  healthMemory?: TriageHealthMemory,
): string {
  const vitalsContext = bpm != null
    ? `\n\nThe user has just completed a vitals scan. Their estimated heart rate is ${bpm} bpm. Reference this gently if relevant.`
    : "";
  const disclaimerExample = text(
    locale,
    "This assessment is for information only and is not medical advice. Always consult your doctor or call emergency services if you feel it is serious.",
    "Esta valoracion es solo informativa y no es consejo medico. Consulta siempre a tu medico o llama a emergencias si sientes que es grave.",
  );

  return `You are VYVA, a warm and caring medical triage assistant helping an elderly person understand their symptoms. Your role is to ask clear, simple questions and provide helpful wording.

The app has a deterministic senior triage protocol engine. That protocol is the safety authority. You may enrich wording from MEDISEARCH EVIDENCE CONTEXT, HEALTH MEMORY, and the conversation, but do not downgrade urgency, soften red flags, or override protocol-driven next steps.

IMPORTANT: Respond entirely in ${language}.
Every user-facing string inside TRIAGE_JSON summary must also be in ${language}, including chiefComplaint, symptoms, nextStepLabel, triageReasons, recommendations, watchSigns, profileConsiderations, vitalsNotes, scanNotes, interpretation, possiblePatterns, uncertainty, reassessmentWindow, changePlanTriggers, clinicalHandoff, and disclaimer.
${genderInstruction(gender)}${vitalsContext}${wizardContextText(wizard, healthMemory)}${healthMemoryText(healthMemory)}${medisearchContextText(medisearchContext)}${triageQuestionMatrixText()}

CONVERSATION FLOW:
1. The app is a senior-friendly wizard. Match the current wizard stage and ask only one very simple question.
2. If there is no symptom category yet, ask what feels wrong today.
3. After a symptom category, ask the most relevant red-flag question first using the SYMPTOM AND PROFILE QUESTION MATRIX. For broad pain, ask its location first, then show only the warning signs relevant to that location. If the reply buttons cover several warning signs, ask a broad matching question like "Do any of these warning signs apply?" instead of naming only one option.
4. Adapt concern level to HEALTH MEMORY. Be more cautious for diabetes, kidney disease, COPD/oxygen use, heart failure, heart disease/AFib, high blood pressure, stroke/TIA history, blood thinners, low immunity/cancer treatment, liver disease, recent surgery, falls/frailty, Parkinson's, osteoporosis, high-risk medications, and new confusion.
5. After the safety check, follow every wizard stage supplied by the app: severity, onset, change over time, and review. Ask the single next question that matches the quick reply choices.
6. Avoid repeating questions already answered in WIZARD CONTEXT.
7. Only wrap up after the user confirms the review stage. Emergency warning signs may still escalate immediately.
8. On your FINAL turn, you MUST end your message with this exact JSON block (replace values appropriately):

TRIAGE_JSON_START
{"done":true,"summary":{"chiefComplaint":"<one-line description>","symptoms":["<symptom 1>","<symptom 2>"],"urgency":"<urgent|routine|monitor>","nextStepLabel":"<plain next step>","nextStepLevel":"<emergency|doctor_today|doctor_24_48|monitor>","triageReasons":["<plain reason 1>","<plain reason 2>"],"interpretation":"<what the answers mean without diagnosing>","possiblePatterns":[{"id":"<stable pattern id>","label":"<possible situation>","explanation":"<why it can fit>","supportingAnswers":["<answer that supports it>"],"clarifyingSigns":["<detail that would help distinguish it>"]}],"uncertainty":["<what cannot be determined>"],"recommendations":["<step 1>","<step 2>","<step 3>","<step 4>"],"reassessmentWindow":"<when to reassess>","changePlanTriggers":["<specific trigger>"],"watchSigns":["<specific sign 1>","<specific sign 2>","<specific sign 3>"],"profileConsiderations":["<profile factor considered, if any>"],"vitalsNotes":["<vitals note, if any>"],"scanNotes":["<optional scan note, if any>"],"clinicalHandoff":{"summary":"<outcome for clinician>","keyPoints":["<important answer>"],"questions":["<question for clinician>"]},"disclaimer":"${disclaimerExample}"}}
TRIAGE_JSON_END

Urgency definitions:
- "urgent": symptoms that warrant same-day or next-day GP attention (e.g. chest pain, difficulty breathing, high fever)
- "routine": symptoms that should be discussed at the next GP appointment (e.g. mild ongoing pain, fatigue)
- "monitor": symptoms that are likely self-limiting and can be monitored at home (e.g. mild cold, minor ache)

Outcome rules:
- Always include nextStepLabel and nextStepLevel.
- Always include triageReasons: 1-3 plain reasons why this next step was chosen.
- Always include 2-3 symptom-specific watchSigns.
- If MEDISEARCH EVIDENCE CONTEXT is present, use its red flags and follow-up topics to make watchSigns and recommendations more specific.
- The deterministic protocol may raise or replace your urgency after you respond. Write recommendations that remain safe if the protocol escalates the next step.
- Include profileConsiderations only when HEALTH MEMORY changed what you considered.
- Include vitalsNotes when a vitals scan exists.
- Include scanNotes when optional triage scans exist. Urine and stool photos can describe visible appearance only; they cannot diagnose UTI, bleeding, or bowel disease.
- Optional scan findings may clarify or increase urgency, but must never reduce red flags or delay emergency guidance.
- Explain what the answers mean, what remains uncertain, when to reassess, and exactly what would change the plan.
- Possible patterns are possibilities, never diagnoses. The deterministic protocol replaces them with its clinician-reviewable catalogue before display; do not invent a definitive cause.
- For an emergency outcome, do not discuss possible causes. Focus only on the warning sign and immediate action.
- Make clinicalHandoff concise and useful for sharing: outcome, key answers, measured vitals, relevant profile factors, and questions a clinician may need to resolve.

STYLE RULES:
- Write like a calm health form, not a chat conversation
- Use simple, kind, non-alarming language suitable for older adults
- Ask one direct question, ideally under 14 words
- Do not start with apologies like "I'm sorry to hear that"
- Do not explain the wizard or mention the buttons
- Never use medical jargon
- Prefer plain words: "sudden", "strong", "today", "getting worse"
- Do NOT produce the JSON block until the app stage is complete, unless an emergency safety alert is present`;
}

function extractTriageJson(text: string): { content: string; summary: TriageSummary | null } {
  const startMarker = "TRIAGE_JSON_START";
  const endMarker = "TRIAGE_JSON_END";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { content: text.trim(), summary: null };
  }

  const beforeJson = text.slice(0, startIdx).trim();
  const jsonStr = text.slice(startIdx + startMarker.length, endIdx).trim();

  try {
    const parsed = JSON.parse(jsonStr) as { done: boolean; summary: TriageSummary };
    if (parsed.done && parsed.summary) {
      return { content: beforeJson, summary: parsed.summary };
    }
  } catch {
    console.warn("[triage] Failed to parse JSON block:", jsonStr.slice(0, 200));
  }

  return { content: text.trim(), summary: null };
}

function trackStartedTriage(wizard: TriageWizardContext | undefined) {
  trackTriageEvent("triage_started", {
    symptom_path: selectedSymptomId(wizard) ?? "unknown",
    triage_completion_status: "started",
  });
}

function trackSafetyAlertTriage(wizard: TriageWizardContext | undefined, ruleId: string) {
  const symptomPath = selectedSymptomId(wizard) ?? "unknown";
  const payload = {
    symptom_path: symptomPath,
    urgency: "urgent" as const,
    rule_ids_fired: [ruleId],
    triage_completion_status: "safety_alert" as const,
    escalation_source: "symptom" as const,
    caregiver_escalation_triggered: false,
  };
  trackTriageEvent("triage_completed", payload);
  trackTriageEvent("triage_escalated", payload);
}

function trackCompletedTriage(telemetry: TriageOutcomeTelemetry) {
  const payload = {
    symptom_path: telemetry.symptomPath,
    urgency: telemetry.urgency,
    rule_ids_fired: telemetry.ruleIdsFired,
    profile_modifiers_applied: telemetry.profileModifiersApplied,
    vitals_overlays_applied: telemetry.vitalsOverlaysApplied,
    caregiver_escalation_triggered: telemetry.caregiverEscalationTriggered,
    triage_completion_status: "completed" as const,
  };
  trackTriageEvent("triage_completed", payload);

  if (telemetry.urgency !== "monitor") {
    trackTriageEvent("triage_escalated", {
      ...payload,
      escalation_source: primaryEscalationSource(telemetry) ?? "symptom",
    });
  }
}

router.post("/transcribe", transcribeAudioBody, transcribeTriageAudioHandler);

router.get("/context", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const variables = await getDoctorMedicalProfileVariables(userId);
    const memory: TriageHealthMemory = {
      healthContext: String(variables.health_profile_summary || variables.health_context || ""),
      careContext: String(variables.care_context || variables.care_team || ""),
      checkinContext: String(variables.checkin_context || ""),
      conditions: String(variables.health_conditions || ""),
      allergies: String(variables.allergies || ""),
      medications: String(variables.medications || ""),
      devices: String(variables.devices || ""),
      latestVitals: String(variables.latest_vitals_scan || ""),
      vitalsTrend: String(variables.vitals_trend || ""),
      latestSymptomReport: String(variables.latest_symptom_report || ""),
      recentSymptomReports: String(variables.recent_symptom_reports || ""),
      medicationAdherence: String(variables.medication_adherence_summary || ""),
      medicationInteraction: String(variables.medication_interaction_context || ""),
      recentHealthEvents: String(variables.recent_health_events || ""),
      latestMedicalVisit: String(variables.latest_medical_visit || ""),
      upcomingMedicalAppointment: String(variables.upcoming_medical_appointment || ""),
      countryCode: String(variables.country_code || ""),
    };
    const usedItems = [
      memory.latestVitals ? "Latest vitals" : "",
      memory.vitalsTrend ? "Vitals trend" : "",
      memory.medications ? "Medications" : "",
      memory.devices ? "Health devices" : "",
      memory.careContext ? "Care coverage" : "",
      memory.checkinContext ? "Check-ins" : "",
      memory.medicationAdherence || memory.medicationInteraction ? "Medication context" : "",
      memory.allergies ? "Allergies" : "",
      memory.conditions ? "Conditions" : "",
      memory.latestSymptomReport || memory.recentSymptomReports ? "Recent symptoms" : "",
      memory.recentHealthEvents ? "Recent health events" : "",
    ].filter(Boolean);
    const language = normalizeAppLanguage(req.language ?? req.header("X-VYVA-Language"), "en");
    const activeConditions = await activeHealthConditionsFor(userId);

    return res.json({
      memory,
      usedItems,
      countryCode: memory.countryCode || undefined,
      emergencyContact: emergencyContactForCountry(memory.countryCode),
      personalizedSuggestions: buildPersonalizedTriageSuggestions(memory, language),
      activeConditions,
    });
  } catch (err) {
    console.error("[triage/context]", err);
    return res.status(500).json({ error: "Failed to load triage context" });
  }
});

export async function runTriageStep(
  body: TriageRequestBody,
  options: { gender?: GrammaticalGender } = {},
): Promise<TriageStepResponse> {
  const { messages = [], vitals, locale = "en", wizard, healthMemory, medisearchConversationId } = body;

  if (!Array.isArray(messages)) {
    throw new TriageStepRequestError("messages must be an array");
  }

  const normalizedLocale = normalizeAppLanguage(locale, "en");
  const language = LOCALE_TO_LANGUAGE[normalizedLocale] ?? languageName(normalizedLocale);
  const gender = options.gender ?? "neutral";

  const validMessages: ChatMessage[] = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20);
  const sanitizedWizard = sanitizeWizard(wizard);
  const effectiveWizard = wizardWithInferredClue(sanitizedWizard, validMessages, normalizedLocale);
  trackStartedTriage(effectiveWizard);

  const safetyAnswer = effectiveWizard?.refineRequested ? null : selectedSafetyAnswer(effectiveWizard);
  if (safetyAnswer) {
    const emergencyContact = emergencyContactForCountry(healthMemory?.countryCode);
    const guidancePlan = guidancePlanFor("support", effectiveWizard, normalizedLocale, healthMemory, validMessages);
    trackSafetyAlertTriage(effectiveWizard, `triage.emergency.${safetyAnswer.id}`);
    return {
      role: "assistant",
      content: safetyMessage(normalizedLocale, safetyAnswer.label, emergencyContact),
      done: false,
      urgent: true,
      safetyAlert: {
        id: safetyAnswer.id,
        label: safetyAnswer.label,
        recommendation: safetyRecommendation(normalizedLocale, emergencyContact),
        emergencyContact,
      },
      emergencyContact,
      quickReplies: safetyQuickReplies(normalizedLocale, emergencyContact),
      wizardStage: "support",
      wizardStageLabel: wizardStageLabel("support", normalizedLocale),
      wizardSymptomId: selectedSymptomId(effectiveWizard),
      questionReason: questionReasonFor("support", effectiveWizard, normalizedLocale, healthMemory),
      profileContextUsed: memoryContextUsedForQuestion("support", selectedSymptomId(effectiveWizard), healthMemory),
      vitalsPrompt: null,
      guidancePlan,
      evidenceSources: [],
      medicalFollowups: [],
    };
  }

  const stage = nextAdaptiveStage(effectiveWizard, healthMemory);
  if (stage !== "complete") {
    const protocolQuestion = wizardQuestionText(stage, effectiveWizard, normalizedLocale);
    const symptomId = selectedSymptomId(effectiveWizard);
    const guidancePlan = guidancePlanFor(stage, effectiveWizard, normalizedLocale, healthMemory, validMessages);
    const profileContextUsed =
      profileContextUsedForQuestion(stage, symptomId, healthMemory) ||
      memoryContextUsedForQuestion(stage, symptomId, healthMemory) ||
      guidancePlan.profileContextUsed;
    const vitalsPrompt = vitalsPromptFor(stage, effectiveWizard, normalizedLocale, healthMemory);
    const latestMessage = validMessages[validMessages.length - 1];
    const medisearchContext = latestMessage?.role === "user"
      ? await getMediSearchTriageContext({
          conversation: validMessages,
          conversationId: medisearchConversationId,
          locale: normalizedLocale,
          wizard: effectiveWizard,
        })
      : null;
    return {
      role: "assistant",
      content: protocolQuestion,
      done: false,
      quickReplies: quickRepliesFor(effectiveWizard, normalizedLocale, healthMemory),
      wizardStage: stage,
      wizardStageLabel: wizardStageLabel(stage, normalizedLocale),
      wizardSymptomId: symptomId,
      questionReason: questionReasonFor(stage, effectiveWizard, normalizedLocale, healthMemory),
      profileContextUsed,
      vitalsPrompt,
      guidancePlan,
      evidenceSources: [],
      medisearchConversationId: medisearchContext?.conversationId,
      medicalFollowups: medisearchContext?.followups ?? [],
    };
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    const fallbackReport = buildFallbackTriageReportWithTelemetry(normalizedLocale, effectiveWizard, validMessages, healthMemory);
    const guidancePlan = guidancePlanFor(stage, effectiveWizard, normalizedLocale, healthMemory, validMessages);
    trackCompletedTriage(fallbackReport.telemetry);
    return {
      role: "assistant",
      content: fallbackReport.content,
      done: true,
      summary: fallbackReport.summary,
      quickReplies: [],
      wizardStage: stage,
      wizardStageLabel: wizardStageLabel(stage, normalizedLocale),
      wizardSymptomId: selectedSymptomId(effectiveWizard),
      questionReason: null,
      profileContextUsed: guidancePlan.profileContextUsed,
      vitalsPrompt: null,
      guidancePlan,
      evidenceSources: [],
      medicalFollowups: [],
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const latestMessage = validMessages[validMessages.length - 1];
    const medisearchContext = latestMessage?.role === "user"
      ? await getMediSearchTriageContext({
          conversation: validMessages,
          conversationId: medisearchConversationId,
          locale: normalizedLocale,
          wizard: effectiveWizard,
          timeoutMs: FINAL_MEDISEARCH_TIMEOUT_MS,
        })
      : null;

    const systemContent = buildSystemPrompt(language, normalizedLocale, vitals?.bpm ?? null, gender, effectiveWizard, medisearchContext, healthMemory);

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...validMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const completion = await client.chat.completions.create(
      {
        model: "gpt-4o",
        messages: openaiMessages,
        temperature: 0.65,
        max_tokens: 600,
      },
      { timeout: FINAL_OPENAI_TIMEOUT_MS },
    );

    const rawContent = completion.choices[0]?.message?.content?.trim() ?? "";
    const { content, summary } = extractTriageJson(rawContent);
    const safeOutcome = summary ? evaluateTriageSafetyFloor(summary, effectiveWizard, normalizedLocale, healthMemory) : null;
    const safeSummary = safeOutcome?.summary ?? null;
    const evidenceSources = evidenceSourcesFor(medisearchContext);
    const evidenceSummary = evidenceSummaryFor(medisearchContext);
    const fallbackReport = buildFallbackTriageReportWithTelemetry(normalizedLocale, effectiveWizard, validMessages, healthMemory);
    const summaryWithEvidence = safeSummary
      ? {
          ...safeSummary,
          evidenceSummary: evidenceSummary || undefined,
          evidenceSources: evidenceSources.length ? evidenceSources : undefined,
        }
      : null;
    const finalSummary = summaryWithEvidence ?? {
      ...fallbackReport.summary,
      evidenceSummary: evidenceSummary || undefined,
      evidenceSources: evidenceSources.length ? evidenceSources : undefined,
    };
    const guidancePlan = guidancePlanFor(stage, effectiveWizard, normalizedLocale, healthMemory, validMessages);
    trackCompletedTriage(safeOutcome?.telemetry ?? fallbackReport.telemetry);

    return {
      role: "assistant",
      content: summaryWithEvidence ? content || fallbackReport.content : fallbackReport.content,
      done: true,
      summary: finalSummary,
      quickReplies: [],
      wizardStage: stage,
      wizardStageLabel: wizardStageLabel(stage, normalizedLocale),
      wizardSymptomId: selectedSymptomId(effectiveWizard),
      questionReason: null,
      profileContextUsed: guidancePlan.profileContextUsed,
      vitalsPrompt: null,
      guidancePlan,
      evidenceSources,
      medisearchConversationId: medisearchContext?.conversationId,
      medicalFollowups: [],
    };
  } catch (err) {
    console.error("[triage] OpenAI error:", err);
    const fallbackReport = buildFallbackTriageReportWithTelemetry(normalizedLocale, effectiveWizard, validMessages, healthMemory);
    const guidancePlan = guidancePlanFor(stage, effectiveWizard, normalizedLocale, healthMemory, validMessages);
    trackCompletedTriage(fallbackReport.telemetry);
    return {
      role: "assistant",
      content: fallbackReport.content,
      done: true,
      summary: fallbackReport.summary,
      quickReplies: [],
      wizardStage: stage,
      wizardStageLabel: wizardStageLabel(stage, normalizedLocale),
      wizardSymptomId: selectedSymptomId(effectiveWizard),
      questionReason: null,
      profileContextUsed: guidancePlan.profileContextUsed,
      vitalsPrompt: null,
      guidancePlan,
      evidenceSources: [],
      medicalFollowups: [],
    };
  }
}

router.post("/message", async (req: Request, res: Response) => {
  try {
    const gender = await getRequestGender(req).catch(() => "neutral" as const);
    return res.json(await runTriageStep(req.body as TriageRequestBody, { gender }));
  } catch (err) {
    if (err instanceof TriageStepRequestError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: "Failed to process triage request" });
  }
});

export default router;
