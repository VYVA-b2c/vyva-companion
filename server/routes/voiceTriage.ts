import type { Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../db.js";
import { profiles, voiceTriageSessions } from "../../shared/schema.js";
import type { TriageHealthMemory, TriageSummary, TriageWizardAnswer, TriageWizardContext } from "../../src/triage/index.js";
import { getDoctorMedicalProfileVariables } from "../lib/doctorMedicalProfile.js";
import { verifyVoiceTriageToolToken } from "../lib/jwt.js";
import { recordVoiceTimelineEvents } from "../lib/voiceTimelineEvents.js";
import { runTriageStep, type TriageStepResponse } from "./triage.js";
import { recordTriageReportHandoff, saveTriageReport } from "./reports.js";
import { logSymptomOutcomeForUser } from "./symptoms.js";
import {
  buildVoiceConsultationSummary,
  persistVoiceConsultationSummary,
} from "../lib/voiceConsultationContinuity.js";

type ChatMessage = { role: "user" | "assistant"; content: string };
type VoiceTriageStatus = "active" | "emergency" | "complete" | "abandoned" | "failed";

const SAFE_FAILURE_COPY: Record<string, string> = {
  en: "I'm having trouble checking this safely. If this feels urgent, call emergency services now. Otherwise, please try again or ask someone nearby for help.",
  es: "Tengo problemas para comprobar esto de forma segura. Si parece urgente, llama ahora a emergencias. Si no, inténtalo de nuevo o pide ayuda a alguien cercano.",
  fr: "J’ai du mal à vérifier cela en toute sécurité. Si la situation semble urgente, appelez les services d’urgence maintenant. Sinon, réessayez ou demandez de l’aide à une personne proche.",
  de: "Ich kann dies gerade nicht sicher prüfen. Wenn es dringend wirkt, rufen Sie jetzt den Notdienst. Versuchen Sie es sonst erneut oder bitten Sie eine Person in Ihrer Nähe um Hilfe.",
  it: "Non riesco a verificare la situazione in modo sicuro. Se sembra urgente, chiama subito i servizi di emergenza. Altrimenti, riprova o chiedi aiuto a una persona vicina.",
  pt: "Estou com dificuldade para verificar isto com segurança. Se parecer urgente, ligue agora para os serviços de emergência. Caso contrário, tente novamente ou peça ajuda a alguém próximo.",
};

function safeFailureCopy(locale: string | undefined) {
  const language = locale?.trim().toLowerCase().split(/[-_]/)[0] || "en";
  return SAFE_FAILURE_COPY[language] ?? SAFE_FAILURE_COPY.en;
}

export function retainedMessagesForStatus(status: VoiceTriageStatus, messages: ChatMessage[]) {
  return status === "active" ? messages : [];
}

export function structuredConsultationEvidence(
  status: "complete" | "emergency",
  wizard: TriageWizardContext,
) {
  return status === "emergency"
    ? { answers: [] as TriageWizardAnswer[], vitals: {} as TriageWizardContext["vitals"] }
    : { answers: wizard.quickAnswers ?? [], vitals: wizard.vitals ?? {} };
}

export function terminalVoiceTriageResponse(session: {
  status?: unknown;
  latest_response_json?: unknown;
}) {
  if (session.status !== "complete" && session.status !== "emergency") return null;
  const latestResponse = safeObject(session.latest_response_json);
  return Object.keys(latestResponse).length ? latestResponse : null;
}

const voiceTriageToolSchema = z.object({
  user_id: z.string().min(1),
  conversation_id: z.string().min(1),
  locale: z.string().optional().default("en"),
  utterance: z.string().trim().max(2000).optional().default(""),
  choice_id: z.string().trim().max(120).optional().nullable(),
  vitals_text: z.string().trim().max(1000).optional().nullable(),
  vitals_source: z.enum(["phone_estimate", "manual_entry", "connected_device", "clinical"]).optional().nullable(),
  vitals_affects_triage: z.boolean().optional().nullable(),
  channel: z.string().trim().max(80).optional().default("voice_app"),
});

const voiceTriageAnswerSchema = z.object({
  locale: z.string().optional(),
  utterance: z.string().trim().max(2000).optional().default(""),
  choice_id: z.string().trim().max(120).optional().nullable(),
  vitals_text: z.string().trim().max(1000).optional().nullable(),
  vitals_source: z.enum(["phone_estimate", "manual_entry", "connected_device", "clinical"]).optional().nullable(),
  vitals_affects_triage: z.boolean().optional().nullable(),
});

let ensureVoiceTriageSessionsPromise: Promise<void> | null = null;
const voiceTriageTurnTails = new Map<string, Promise<void>>();

export async function serializeVoiceTriageTurn<T>(conversationId: string, task: () => Promise<T>): Promise<T> {
  const previous = voiceTriageTurnTails.get(conversationId) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  voiceTriageTurnTails.set(conversationId, tail);

  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    releaseCurrent();
    if (voiceTriageTurnTails.get(conversationId) === tail) {
      voiceTriageTurnTails.delete(conversationId);
    }
  }
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function safeMessages(value: unknown): ChatMessage[] {
  return Array.isArray(value)
    ? value
      .filter((item): item is ChatMessage => {
        const record = safeObject(item);
        return (record.role === "user" || record.role === "assistant") && typeof record.content === "string";
      })
      .slice(-20)
    : [];
}

function safeWizard(value: unknown): TriageWizardContext {
  const record = safeObject(value);
  return {
    mode: record.mode === "with_vitals" ? "with_vitals" : "without_vitals",
    vitalsScanCompleted: Boolean(record.vitalsScanCompleted),
    vitals: safeObject(record.vitals) as TriageWizardContext["vitals"],
    vitalsEvidence: safeObject(record.vitalsEvidence) as TriageWizardContext["vitalsEvidence"],
    quickAnswers: Array.isArray(record.quickAnswers)
      ? record.quickAnswers.filter((item): item is TriageWizardAnswer => {
        const answer = safeObject(item);
        return typeof answer.id === "string" && typeof answer.label === "string" && typeof answer.value === "string";
      })
      : [],
    scanResults: Array.isArray(record.scanResults) ? record.scanResults as TriageWizardContext["scanResults"] : [],
    declinedScanTypes: Array.isArray(record.declinedScanTypes) ? record.declinedScanTypes as TriageWizardContext["declinedScanTypes"] : [],
  };
}

function safeHealthMemory(value: unknown): TriageHealthMemory {
  return safeObject(value) as TriageHealthMemory;
}

function statusForResponse(response: TriageStepResponse): VoiceTriageStatus {
  if (response.safetyAlert || response.urgent) return "emergency";
  if (response.done && response.summary) return "complete";
  return "active";
}

function symptomSeverityForSummary(summary: TriageSummary): "mild" | "moderate" | "severe" {
  if (summary.nextStepLevel === "emergency" || summary.nextStepLevel === "doctor_today" || summary.urgency === "urgent") {
    return "severe";
  }
  if (summary.nextStepLevel === "doctor_24_48" || summary.urgency === "routine") {
    return "moderate";
  }
  return "mild";
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function latestChoices(response: unknown): TriageWizardAnswer[] {
  const record = safeObject(response);
  const question = safeObject(record.question);
  const questionChoices = Array.isArray(question.choices)
    ? question.choices
    : [];
  const quickReplies = Array.isArray(record.quickReplies)
    ? record.quickReplies
    : [];
  const rawChoices = [...questionChoices, ...quickReplies];

  const choices = rawChoices
    .map((item) => {
      const choice = safeObject(item);
      const id = typeof choice.id === "string" ? choice.id : "";
      const label = typeof choice.spoken_label === "string"
        ? choice.spoken_label
        : typeof choice.label === "string"
          ? choice.label
          : "";
      const value = typeof choice.value === "string" ? choice.value : label;
      const kind = typeof choice.kind === "string" ? choice.kind : id;
      return id && label ? { id, label, value, kind } : null;
    })
    .filter((item): item is TriageWizardAnswer => Boolean(item));

  return choices.filter((choice, index) => (
    choices.findIndex((candidate) => candidate.id === choice.id) === index
  ));
}

function consultationSymptomId(response: TriageStepResponse, wizard: TriageWizardContext) {
  return response.wizardSymptomId
    || [...(wizard.quickAnswers ?? [])].reverse().find((answer) => answer.kind === "symptom")?.id
    || "unknown";
}

async function recordTerminalConsultation(input: {
  userId: string;
  conversationId: string;
  channel: string;
  locale: string;
  status: "complete" | "emergency";
  response: TriageStepResponse;
  wizard: TriageWizardContext;
  reportId?: string | null;
  startedAt: Date;
}) {
  const summary = input.response.summary;
  const safety = input.response.safetyAlert;
  const concern = summary?.chiefComplaint
    || safety?.label
    || [...(input.wizard.quickAnswers ?? [])].reverse().find((answer) => answer.kind === "symptom")?.label
    || input.response.wizardSymptomId
    || "Voice symptom check";
  const urgency = summary?.urgency || (input.status === "emergency" ? "emergency" : "unknown");
  const nextStep = summary?.nextStepLabel
    || safety?.recommendation
    || summary?.recommendations?.[0]
    || null;
  const evidence = structuredConsultationEvidence(input.status, input.wizard);

  return persistVoiceConsultationSummary(buildVoiceConsultationSummary({
    userId: input.userId,
    conversationId: input.conversationId,
    triageReportId: input.reportId,
    channel: input.channel,
    locale: input.locale,
    status: input.status,
    canonicalSymptomId: consultationSymptomId(input.response, input.wizard),
    concern,
    answers: evidence.answers,
    vitals: evidence.vitals,
    urgency,
    guidanceOutcome: input.response.content,
    nextStep,
    startedAt: input.startedAt,
    completedAt: new Date(),
  }));
}

const SPOKEN_SEVERITY_SCORES = new Map<string, number>([
  ["zero", 0], ["oh", 0], ["cero", 0],
  ["one", 1], ["un", 1], ["une", 1], ["uno", 1], ["una", 1],
  ["two", 2], ["deux", 2], ["dos", 2],
  ["three", 3], ["trois", 3], ["tres", 3],
  ["four", 4], ["quatre", 4], ["cuatro", 4],
  ["five", 5], ["cinq", 5], ["cinco", 5],
  ["six", 6], ["seis", 6],
  ["seven", 7], ["sept", 7], ["siete", 7],
  ["eight", 8], ["huit", 8], ["ocho", 8],
  ["nine", 9], ["neuf", 9], ["nueve", 9],
  ["ten", 10], ["dix", 10], ["diez", 10],
]);

function spokenSeverityScore(utterance: string) {
  const digit = utterance.match(/\b(10|[0-9])\b/);
  if (digit) return Number(digit[1]);

  const outOfTen = utterance.match(/\b([a-z]+)\s+(?:sur|out\s+of|de|von)\s+(?:dix|ten|diez)\b/);
  if (outOfTen) {
    const score = SPOKEN_SEVERITY_SCORES.get(outOfTen[1]);
    if (score !== undefined) return score;
  }

  const tokens = utterance.split(" ").filter(Boolean);
  const matches = tokens
    .map((token) => ({ token, score: SPOKEN_SEVERITY_SCORES.get(token) }))
    .filter((item): item is { token: string; score: number } => item.score !== undefined);
  if (matches.length !== 1) return null;

  const match = matches[0];
  // French "un" is commonly an article. Only interpret it as a score when
  // it is the complete answer or is explicitly framed as one out of ten.
  if (match.token === "un" && utterance !== "un" && !/\bun\s+sur\s+dix\b/.test(utterance)) {
    return null;
  }
  return match.score;
}

export function selectChoiceFromVoice(input: {
  choiceId?: string | null;
  utterance: string;
  latestResponse: unknown;
}) {
  const choices = latestChoices(input.latestResponse);
  if (!choices.length) return null;
  const requestedId = input.choiceId?.trim();
  if (requestedId) {
    const direct = choices.find((choice) => choice.id === requestedId);
    if (direct) return direct;
  }

  const utterance = normalizeText(input.utterance);
  if (!utterance) return null;
  const severityChoices = choices.filter((choice) => (
    choice.kind === "severity" && /^severity_(?:10|[0-9])$/.test(choice.id)
  ));
  if (severityChoices.length) {
    const severityScore = spokenSeverityScore(utterance);
    if (severityScore !== null) {
      const severityChoice = severityChoices.find((choice) => choice.id === `severity_${severityScore}`);
      if (severityChoice) return severityChoice;
    }
  }
  const exact = choices.find((choice) => {
    const label = normalizeText(choice.label);
    const value = normalizeText(choice.value);
    return utterance === label || utterance === value || utterance === normalizeText(choice.id);
  });
  if (exact) return exact;

  if (/^(yes|yeah|yep|si|sí|ja|oui)\b/.test(utterance)) {
    return choices.find((choice) => {
      const haystack = normalizeText(`${choice.id} ${choice.label} ${choice.value}`);
      return haystack.includes("yes") || haystack.includes("cannot") || haystack.includes("too weak") || haystack.includes("worse");
    }) ?? null;
  }
  if (/^(no|nope|nah|nein|non)\b/.test(utterance)) {
    return choices.find((choice) => {
      const haystack = normalizeText(`${choice.id} ${choice.label} ${choice.value}`);
      return haystack.includes("no") || haystack.includes("none");
    }) ?? null;
  }
  if (/\b(not sure|unsure|dont know|don't know|no se|not certain)\b/.test(utterance)) {
    return choices.find((choice) => normalizeText(`${choice.id} ${choice.label}`).includes("not sure")) ?? null;
  }

  return choices.find((choice) => {
    const label = normalizeText(choice.label);
    const value = normalizeText(choice.value);
    return label.split(" ").some((token) => token.length > 3 && utterance.includes(token)) ||
      value.split(" ").some((token) => token.length > 3 && utterance.includes(token));
  }) ?? null;
}

export function parseVoiceVitalsText(vitalsText?: string | null): TriageWizardContext["vitals"] {
  const text = normalizeText(vitalsText ?? "");
  if (!text) return {};
  const vitals: NonNullable<TriageWizardContext["vitals"]> = {};
  const bp = text.match(/\b(\d{2,3})\s*(?:over|\/)\s*(\d{2,3})\b/);
  if (bp) {
    vitals.systolicBp = Number(bp[1]);
    vitals.diastolicBp = Number(bp[2]);
  }
  const oxygen = text.match(/\b(?:oxygen|spo2|saturation)\s*(?:is|at)?\s*(\d{2,3})\b/);
  if (oxygen) vitals.oxygenSaturation = Number(oxygen[1]);
  const pulse = text.match(/\b(?:pulse|heart rate|bpm)\s*(?:is|at)?\s*(\d{2,3})\b/);
  if (pulse) vitals.bpm = Number(pulse[1]);
  const breathing = text.match(/\b(?:breathing rate|respiratory rate|respirations?|breaths?(?: per minute)?)\s*(?:is|at)?\s*(\d{1,2})\b/);
  if (breathing) vitals.respiratoryRate = Number(breathing[1]);
  const temp = text.match(/\b(?:temperature|temp|fever)\s*(?:is|at)?\s*(\d{2}(?:\.\d)?)\b/);
  if (temp) vitals.temperatureC = Number(temp[1]);
  const glucose = text.match(/\b(?:glucose|sugar)\s*(?:is|at)?\s*(\d{2,3})\b/);
  if (glucose) vitals.glucoseMgdl = Number(glucose[1]);
  return vitals;
}

export function isVitalsSkip(choiceId: string | null | undefined, utterance: string) {
  if (choiceId === "skip_vitals") return true;
  return /\b(skip|not now|no thanks|continue without|later)\b/i.test(utterance);
}

export function voiceQuestionFor(response: TriageStepResponse) {
  const replies = response.quickReplies ?? [];
  const visibleReplies = response.wizardStage === "severity"
    ? replies
    : replies.slice(0, 3);
  return response.done
    ? undefined
    : {
      stage: response.wizardStage ?? "symptom",
      text: response.content,
      reason: response.questionReason ?? null,
      profile_context_used: Boolean(response.profileContextUsed),
      choices: visibleReplies.map((reply) => ({
        id: reply.id,
        spoken_label: reply.label,
        value: reply.value,
        kind: reply.kind,
      })),
    };
}

const REVIEW_ANSWER_KINDS = new Set(["symptom", "location", "severity", "duration", "trend"]);

export function voiceReviewAnswers(wizard: TriageWizardContext | undefined) {
  const answers = wizard?.quickAnswers ?? [];
  const latestByKind = new Map<string, TriageWizardAnswer>();
  answers.forEach((answer) => {
    if (answer.kind && REVIEW_ANSWER_KINDS.has(answer.kind)) {
      latestByKind.set(answer.kind, answer);
    }
  });
  return ["symptom", "location", "severity", "duration", "trend"]
    .map((kind) => latestByKind.get(kind))
    .filter((answer): answer is TriageWizardAnswer => Boolean(answer));
}

function actionOptionsFor(input: {
  response: TriageStepResponse;
  status: VoiceTriageStatus;
  reportId?: string | null;
  sentTo?: string[];
  staffReviewRequested?: boolean;
}) {
  if (input.status === "emergency") {
    const emergencyContact = input.response.emergencyContact ?? input.response.safetyAlert?.emergencyContact;
    return [{
      id: "call_emergency",
      kind: "call_emergency",
      label: emergencyContact?.label ? `Call ${emergencyContact.label} now` : "Call emergency services now",
      tel_href: emergencyContact?.telHref ?? null,
    }];
  }

  if (input.status !== "complete") return [];

  return [
    input.reportId ? {
      id: "view_report",
      kind: "view_report",
      label: "Open saved report",
      route: `/informes/${input.reportId}`,
    } : null,
    input.staffReviewRequested ? {
      id: "staff_review",
      kind: "staff_review",
      label: "Staff review requested",
      disabled: true,
    } : null,
    input.sentTo?.length ? {
      id: "care_contacts_notified",
      kind: "care_contacts_notified",
      label: `Shared with ${input.sentTo.join(", ")}`,
      disabled: true,
    } : null,
  ].filter(Boolean);
}

function toolResponseFor(input: {
  response: TriageStepResponse;
  status: VoiceTriageStatus;
  wizard?: TriageWizardContext;
  reportId?: string | null;
  sentTo?: string[];
  staffReviewRequested?: boolean;
}) {
  const question = voiceQuestionFor(input.response);
  const vitalsPrompt = input.response.vitalsPrompt ?? null;
  return {
    ok: true,
    status: input.status,
    spoken_text: input.response.content,
    ...(question ? { question } : {}),
    safety_level: input.status === "emergency" ? "emergency" : "continue",
    vitals_prompt: vitalsPrompt ? {
      ...vitalsPrompt,
      camera_action: {
        id: "use_camera",
        label: "Use camera for heart and breathing",
        route: "/health/vitals",
      },
      manual_action: {
        id: "enter_reading",
        label: "Enter a device reading",
      },
      skip_action: {
        id: "skip_vitals",
        label: "Skip for now",
      },
    } : null,
    caregiver_alert_requested: Boolean(input.sentTo?.length),
    staff_review_requested: Boolean(input.staffReviewRequested),
    action_options: actionOptionsFor(input),
    ui_state: {
      route: "/health/symptom-check",
      show_live_voice_check: true,
    },
    ...(input.response.wizardStage === "support" ? {
      review_answers: voiceReviewAnswers(input.wizard),
    } : {}),
    ...(input.response.summary ? {
      report: {
        triage_report_id: input.reportId ?? null,
        next_step_level: input.response.summary.nextStepLevel ?? null,
        chief_complaint: input.response.summary.chiefComplaint,
        watch_signs: input.response.summary.watchSigns ?? [],
      },
    } : {}),
    quickReplies: input.response.quickReplies ?? [],
    guidancePlan: input.response.guidancePlan ?? null,
    wizardStage: input.response.wizardStage ?? null,
    wizardStageLabel: input.response.wizardStageLabel ?? null,
    wizardSymptomId: input.response.wizardSymptomId ?? null,
    questionReason: input.response.questionReason ?? null,
    profileContextUsed: Boolean(input.response.profileContextUsed),
    summary: input.response.summary ?? null,
    safetyAlert: input.response.safetyAlert ?? null,
    emergencyContact: input.response.emergencyContact ?? input.response.safetyAlert?.emergencyContact ?? null,
  };
}

async function ensureVoiceTriageSessionsTable() {
  ensureVoiceTriageSessionsPromise ??= (async () => {
    await pool.query(`
      create table if not exists voice_triage_sessions (
        id uuid primary key default gen_random_uuid(),
        user_id text not null,
        conversation_id text not null unique,
        channel text not null default 'voice_app',
        status text not null default 'active',
        locale text not null default 'en',
        messages_json jsonb not null default '[]'::jsonb,
        wizard_json jsonb not null default '{}'::jsonb,
        health_memory_json jsonb not null default '{}'::jsonb,
        latest_response_json jsonb not null default '{}'::jsonb,
        triage_report_id uuid,
        started_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        completed_at timestamptz
      )
    `);
    await pool.query(`create index if not exists voice_triage_sessions_user_updated_idx on voice_triage_sessions (user_id, updated_at)`);
    await pool.query(`create index if not exists voice_triage_sessions_status_updated_idx on voice_triage_sessions (status, updated_at)`);
  })().catch((err) => {
    ensureVoiceTriageSessionsPromise = null;
    throw err;
  });

  return ensureVoiceTriageSessionsPromise;
}

async function healthMemoryForUser(userId: string): Promise<TriageHealthMemory> {
  const variables = await getDoctorMedicalProfileVariables(userId);
  return {
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
}

async function upsertStartedSession(params: {
  userId: string;
  conversationId: string;
  channel: string;
  locale: string;
  healthMemory: TriageHealthMemory;
}) {
  await ensureVoiceTriageSessionsTable();
  const existing = await db
    .select()
    .from(voiceTriageSessions)
    .where(and(
      eq(voiceTriageSessions.user_id, params.userId),
      eq(voiceTriageSessions.conversation_id, params.conversationId),
    ))
    .limit(1);

  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(voiceTriageSessions)
    .values({
      user_id: params.userId,
      conversation_id: params.conversationId,
      channel: params.channel,
      locale: params.locale,
      status: "active",
      messages_json: [],
      wizard_json: { mode: "without_vitals", vitalsScanCompleted: false, quickAnswers: [] },
      health_memory_json: params.healthMemory,
      latest_response_json: {},
    })
    .returning();

  await recordVoiceTimelineEvents({
    userId: params.userId,
    source: "elevenlabs_tool",
    events: [{
      id: `voice-triage-started-${params.conversationId}`,
      kind: "voice_triage_started",
      title: "Voice triage started",
      sessionId: params.conversationId,
      domain: "health",
      agentSlug: "dr-ai",
      route: "/health/symptom-check",
      payload: { channel: params.channel, locale: params.locale },
    }],
  }).catch((err) => console.warn("[voice-triage timeline]", err));

  return created;
}

async function saveCompletedVoiceReport(input: {
  userId: string;
  response: TriageStepResponse;
  wizard: TriageWizardContext;
}) {
  const summary = input.response.summary;
  if (!summary) return { reportId: null, sentTo: [] as string[], staffReviewRequested: false };

  const row = await saveTriageReport({
    userId: input.userId,
    chief_complaint: summary.chiefComplaint,
    symptoms: summary.symptoms,
    urgency: summary.urgency,
    recommendations: summary.recommendations,
    disclaimer: summary.disclaimer,
    ai_summary: input.response.content,
    next_step_label: summary.nextStepLabel ?? null,
    next_step_level: summary.nextStepLevel ?? null,
    triage_reasons: summary.triageReasons ?? [],
    watch_signs: summary.watchSigns ?? [],
    profile_considerations: summary.profileConsiderations ?? [],
    vitals_notes: summary.vitalsNotes ?? [],
    interpretation: summary.interpretation ?? null,
    possible_patterns: summary.possiblePatterns ?? [],
    uncertainty: summary.uncertainty ?? [],
    reassessment_window: summary.reassessmentWindow ?? null,
    change_plan_triggers: summary.changePlanTriggers ?? [],
    clinical_handoff: summary.clinicalHandoff ?? null,
    scan_results: summary.scanResults ?? [],
    scan_notes: summary.scanNotes ?? [],
    bpm: input.wizard.vitals?.bpm ?? null,
    respiratory_rate: input.wizard.vitals?.respiratoryRate ?? null,
    duration_seconds: null,
  });

  const handoff = await recordTriageReportHandoff({
    userId: input.userId,
    chief_complaint: summary.chiefComplaint,
    urgency: summary.urgency,
    recommendations: summary.recommendations,
  }).catch((err) => {
    console.error("[voice-triage handoff]", err);
    return { sentTo: [] as string[], caregiverEscalationTriggered: false, staffReviewRequested: false };
  });

  await logSymptomOutcomeForUser({
    userId: input.userId,
    triageReportId: row.id,
    symptomDescription: summary.chiefComplaint,
    severity: symptomSeverityForSummary(summary),
    checkCompleted: true,
    recommendation: summary.nextStepLabel || summary.recommendations[0] || "",
    escalatedToCaregiver: Boolean(handoff.sentTo.length),
  }).catch((err) => console.error("[voice-triage symptom log]", err));

  return { reportId: row.id, sentTo: handoff.sentTo, staffReviewRequested: handoff.staffReviewRequested };
}

async function recordEmergencyVoiceHandoff(input: {
  userId: string;
  conversationId: string;
  response: TriageStepResponse;
  priorStatus: string;
}): Promise<{ sentTo: string[]; staffReviewRequested: boolean }> {
  if (input.priorStatus === "emergency") return { sentTo: [], staffReviewRequested: false };
  const sent = await recordTriageReportHandoff({
    userId: input.userId,
    chief_complaint: input.response.safetyAlert?.label || input.response.wizardSymptomId || "Voice symptom check",
    urgency: "urgent",
    recommendations: [input.response.safetyAlert?.recommendation || input.response.content],
  }).catch((err) => {
    console.error("[voice-triage emergency handoff]", err);
    return { sentTo: [] as string[], caregiverEscalationTriggered: false, staffReviewRequested: false };
  });
  return { sentTo: sent.sentTo, staffReviewRequested: sent.staffReviewRequested };
}

type VoiceTriageSessionTurnInput = {
  userId: string;
  conversationId: string;
  channel: string;
  locale: string;
  utterance: string;
  choiceId?: string | null;
  vitalsText?: string | null;
  vitalsSource?: "phone_estimate" | "manual_entry" | "connected_device" | "clinical" | null;
  vitalsAffectsTriage?: boolean | null;
  timelineSource: string;
};

async function runVoiceTriageSessionTurnUnlocked(input: VoiceTriageSessionTurnInput) {
  const healthMemory = await healthMemoryForUser(input.userId);
  const session = await upsertStartedSession({
    userId: input.userId,
    conversationId: input.conversationId,
    channel: input.channel,
    locale: input.locale,
    healthMemory,
  });
  const terminalResponse = terminalVoiceTriageResponse(session);
  if (terminalResponse) return terminalResponse;

  const priorMessages = safeMessages(session.messages_json);
  const priorWizard = safeWizard(session.wizard_json);
  const priorResponse = safeObject(session.latest_response_json);
  const priorVitalsPrompt = safeObject(priorResponse.vitals_prompt);
  if (Object.keys(priorVitalsPrompt).length && isVitalsSkip(input.choiceId, input.utterance)) {
    const nextWizard: TriageWizardContext = {
      ...priorWizard,
      declinedScanTypes: [...new Set([...(priorWizard.declinedScanTypes ?? []), "vitals" as const])],
    };
    const toolResponse = { ...priorResponse, vitals_prompt: null };
    await db
      .update(voiceTriageSessions)
      .set({ wizard_json: nextWizard, latest_response_json: toolResponse, updated_at: sql`now()` })
      .where(eq(voiceTriageSessions.id, session.id));
    return toolResponse;
  }
  const selectedChoice = selectChoiceFromVoice({
    choiceId: input.choiceId ?? null,
    utterance: input.utterance,
    latestResponse: session.latest_response_json,
  });
  const nextQuickAnswers = selectedChoice
    ? [...(priorWizard.quickAnswers ?? []), selectedChoice]
    : (priorWizard.quickAnswers ?? []);
  const vitals = {
    ...(priorWizard.vitals ?? {}),
    ...parseVoiceVitalsText(input.vitalsText),
  };
  const parsedVitalKeys = Object.keys(parseVoiceVitalsText(input.vitalsText)) as Array<keyof NonNullable<TriageWizardContext["vitals"]>>;
  const nextVitalsEvidence = { ...(priorWizard.vitalsEvidence ?? {}) };
  for (const key of parsedVitalKeys) {
    nextVitalsEvidence[key] = {
      source: input.vitalsSource ?? "manual_entry",
      affectsTriage: input.vitalsAffectsTriage ?? input.vitalsSource !== "phone_estimate",
    };
  }
  const nextWizard: TriageWizardContext = {
    ...priorWizard,
    mode: priorWizard.mode ?? "without_vitals",
    vitalsScanCompleted: Boolean(priorWizard.vitalsScanCompleted || Object.keys(vitals).length),
    vitals,
    vitalsEvidence: nextVitalsEvidence,
    quickAnswers: nextQuickAnswers,
  };
  const userText = selectedChoice?.value || input.utterance || "I am not sure.";
  const messages: ChatMessage[] = [...priorMessages, { role: "user", content: userText }].slice(-20);

  const response = await runTriageStep({
    messages,
    locale: input.locale,
    wizard: nextWizard,
    healthMemory,
  });

  const nextMessages = [...messages, { role: "assistant", content: response.content }].slice(-20);
  const status = statusForResponse(response);
  const completion = status === "complete"
    ? await saveCompletedVoiceReport({ userId: input.userId, response, wizard: nextWizard })
    : { reportId: null, sentTo: [] as string[], staffReviewRequested: false };
  const emergencySentTo = status === "emergency"
    ? await recordEmergencyVoiceHandoff({
      userId: input.userId,
      conversationId: input.conversationId,
      response,
      priorStatus: session.status,
    })
    : { sentTo: [] as string[], staffReviewRequested: false };
  const sentTo = completion.sentTo.length ? completion.sentTo : emergencySentTo.sentTo;
  const staffReviewRequested = completion.staffReviewRequested || emergencySentTo.staffReviewRequested;
  const toolResponse = toolResponseFor({
    response,
    status,
    wizard: nextWizard,
    reportId: completion.reportId,
    sentTo,
    staffReviewRequested,
  });

  if (status === "complete" || status === "emergency") {
    await recordTerminalConsultation({
      userId: input.userId,
      conversationId: input.conversationId,
      channel: input.channel,
      locale: input.locale,
      status,
      response,
      wizard: nextWizard,
      reportId: completion.reportId,
      startedAt: session.started_at,
    }).catch((err) => {
      console.error("[voice-triage consultation continuity]", err);
    });
  }

  await db
    .update(voiceTriageSessions)
    .set({
      status,
      locale: input.locale,
      messages_json: retainedMessagesForStatus(status, nextMessages),
      wizard_json: status === "active" ? nextWizard : {},
      health_memory_json: status === "active" ? healthMemory : {},
      latest_response_json: toolResponse,
      triage_report_id: completion.reportId,
      updated_at: sql`now()`,
      completed_at: status === "complete" || status === "emergency" ? sql`now()` : null,
    })
    .where(eq(voiceTriageSessions.id, session.id));

  await recordVoiceTimelineEvents({
    userId: input.userId,
    source: input.timelineSource,
    events: [{
      id: `voice-triage-${status}-${input.conversationId}-${Date.now()}`,
      kind: status === "complete"
        ? "voice_triage_completed"
        : status === "emergency"
          ? "voice_triage_emergency"
          : "voice_triage_step",
      title: status === "complete" ? "Voice triage completed" : status === "emergency" ? "Voice triage emergency" : "Voice triage step",
      detail: response.content,
      severity: status === "emergency" ? "error" : status === "complete" ? "success" : "info",
      sessionId: input.conversationId,
      domain: "health",
      agentSlug: "dr-ai",
      route: "/health/symptom-check",
      payload: {
        status,
        stage: String(response.wizardStage ?? ""),
        profile_context_used: Boolean(response.profileContextUsed),
        report_id: completion.reportId ?? "",
        answer_source: input.timelineSource,
        staff_review_requested: staffReviewRequested,
        notified_contacts: sentTo,
      },
    }],
  }).catch((err) => console.warn("[voice-triage timeline]", err));

  return toolResponse;
}

async function runVoiceTriageSessionTurn(input: VoiceTriageSessionTurnInput) {
  return serializeVoiceTriageTurn(input.conversationId, () => runVoiceTriageSessionTurnUnlocked(input));
}

export async function elevenLabsTriageStepToolHandler(req: Request, res: Response) {
  const parsed = voiceTriageToolSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid triage tool body", details: parsed.error.issues });
  }

  const headerToken = String(req.header("X-VYVA-Voice-Triage-Token") || "");
  const bodyToken = typeof (req.body as Record<string, unknown>)?.voice_triage_tool_token === "string"
    ? String((req.body as Record<string, unknown>).voice_triage_tool_token)
    : "";
  const token = headerToken || bodyToken;
  const verified = token ? await verifyVoiceTriageToolToken(token) : null;
  if (!verified) return res.status(403).json({ ok: false, error: "Invalid or expired triage token" });
  if (verified.userId !== parsed.data.user_id || verified.conversationId !== parsed.data.conversation_id) {
    return res.status(403).json({ ok: false, error: "Triage token does not match this conversation" });
  }

  try {
    const toolResponse = await runVoiceTriageSessionTurn({
      userId: parsed.data.user_id,
      conversationId: parsed.data.conversation_id,
      channel: parsed.data.channel,
      locale: parsed.data.locale,
      utterance: parsed.data.utterance,
      choiceId: parsed.data.choice_id ?? null,
      vitalsText: parsed.data.vitals_text ?? null,
      vitalsSource: parsed.data.vitals_source ?? null,
      vitalsAffectsTriage: parsed.data.vitals_affects_triage ?? null,
      timelineSource: "elevenlabs_tool",
    });

    return res.json(toolResponse);
  } catch (err) {
    console.error("[elevenlabs tool triage-step]", err);
    const fallbackText = safeFailureCopy(parsed.data.locale);
    await ensureVoiceTriageSessionsTable().catch(() => undefined);
    await db
      .update(voiceTriageSessions)
      .set({
        status: "failed",
        messages_json: [],
        wizard_json: {},
        health_memory_json: {},
        updated_at: sql`now()`,
        latest_response_json: {
          ok: false,
          status: "failed",
          spoken_text: fallbackText,
        },
      })
      .where(and(
        eq(voiceTriageSessions.user_id, parsed.data.user_id),
        eq(voiceTriageSessions.conversation_id, parsed.data.conversation_id),
      ))
      .catch(() => undefined);

    await recordVoiceTimelineEvents({
      userId: parsed.data.user_id,
      source: "elevenlabs_tool",
      events: [{
        id: `voice-triage-failed-${parsed.data.conversation_id}-${Date.now()}`,
        kind: "voice_triage_tool_failed",
        title: "Voice triage tool failed",
        detail: err instanceof Error ? err.message : "Unknown triage tool error",
        severity: "error",
        sessionId: parsed.data.conversation_id,
        domain: "health",
        agentSlug: "dr-ai",
        route: "/health/symptom-check",
      }],
    }).catch(() => undefined);

    return res.status(200).json({
      ok: false,
      status: "failed",
      safety_level: "fallback",
      spoken_text: fallbackText,
    });
  }
}

export async function voiceTriageSessionAnswerHandler(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const conversationId = typeof req.params.conversation_id === "string"
    ? req.params.conversation_id.trim()
    : "";
  if (!conversationId) return res.status(400).json({ error: "Missing conversation id" });

  const parsed = voiceTriageAnswerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid voice triage answer", details: parsed.error.issues });
  }

  const utterance = parsed.data.utterance.trim();
  const choiceId = parsed.data.choice_id?.trim() || null;
  const vitalsText = parsed.data.vitals_text?.trim() || null;
  if (!utterance && !choiceId && !vitalsText) {
    return res.status(400).json({ error: "Provide an answer, selected choice, or vitals reading" });
  }

  try {
    await ensureVoiceTriageSessionsTable();
    const [session] = await db
      .select()
      .from(voiceTriageSessions)
      .where(and(
        eq(voiceTriageSessions.user_id, userId),
        eq(voiceTriageSessions.conversation_id, conversationId),
      ))
      .limit(1);
    if (!session) return res.status(404).json({ error: "Voice triage session not found" });
    if (session.status === "complete" || session.status === "emergency") {
      return res.json(session.latest_response_json);
    }

    const toolResponse = await runVoiceTriageSessionTurn({
      userId,
      conversationId,
      channel: session.channel || "voice_app",
      locale: parsed.data.locale || session.locale || "en",
      utterance,
      choiceId,
      vitalsText,
      vitalsSource: parsed.data.vitals_source ?? null,
      vitalsAffectsTriage: parsed.data.vitals_affects_triage ?? null,
      timelineSource: "app_touch",
    });

    return res.json(toolResponse);
  } catch (err) {
    console.error("[voice-triage/session answer]", err);
    const fallbackText = safeFailureCopy(parsed.data.locale);
    return res.status(500).json({
      ok: false,
      status: "failed",
      spoken_text: fallbackText,
    });
  }
}

export async function voiceTriageSessionEndHandler(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const conversationId = typeof req.params.conversation_id === "string"
    ? req.params.conversation_id.trim()
    : "";
  if (!conversationId) return res.status(400).json({ error: "Missing conversation id" });

  try {
    await ensureVoiceTriageSessionsTable();
    const [session] = await db
      .select()
      .from(voiceTriageSessions)
      .where(and(
        eq(voiceTriageSessions.user_id, userId),
        eq(voiceTriageSessions.conversation_id, conversationId),
      ))
      .limit(1);
    if (!session) return res.status(404).json({ error: "Voice triage session not found" });

    if (session.status === "active" || session.status === "failed") {
      await db
        .update(voiceTriageSessions)
        .set({
          status: "abandoned",
          messages_json: [],
          wizard_json: {},
          health_memory_json: {},
          updated_at: sql`now()`,
          completed_at: sql`now()`,
        })
        .where(eq(voiceTriageSessions.id, session.id));
      return res.json({ ok: true, status: "abandoned" });
    }

    return res.json({ ok: true, status: session.status });
  } catch (err) {
    console.error("[voice-triage/session end]", err);
    return res.status(500).json({ error: "Failed to end voice triage session" });
  }
}

export async function voiceTriageSessionHandler(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const conversationId = typeof req.params.conversation_id === "string"
    ? req.params.conversation_id.trim()
    : "";
  if (!conversationId) return res.status(400).json({ error: "Missing conversation id" });

  try {
    await ensureVoiceTriageSessionsTable();
    const [session] = await db
      .select()
      .from(voiceTriageSessions)
      .where(and(
        eq(voiceTriageSessions.user_id, userId),
        eq(voiceTriageSessions.conversation_id, conversationId),
      ))
      .limit(1);
    if (!session) return res.status(404).json({ error: "Voice triage session not found" });

    const [profile] = await db
      .select({ full_name: profiles.full_name, preferred_name: profiles.preferred_name })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
      .catch(() => []);

    return res.json({
      id: session.id,
      user_id: session.user_id,
      conversation_id: session.conversation_id,
      channel: session.channel,
      status: session.status,
      locale: session.locale,
      latest_response: session.latest_response_json,
      triage_report_id: session.triage_report_id,
      started_at: session.started_at,
      updated_at: session.updated_at,
      completed_at: session.completed_at,
      client_name: profile?.preferred_name || profile?.full_name || "",
    });
  } catch (err) {
    console.error("[voice-triage/session]", err);
    return res.status(500).json({ error: "Failed to load voice triage session" });
  }
}
