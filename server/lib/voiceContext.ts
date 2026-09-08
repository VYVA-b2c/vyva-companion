import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  activityLogs,
  checkinSessions,
  companionProfiles,
  users,
  profiles,
  medicationAdherence,
  scheduledInteractions,
  scheduledEvents,
  socialRoomVisits,
  socialRooms,
  socialUserInterests,
  teamInvitations,
  triageReports,
  userChannelPreferences,
  userMedications,
  vitalsReadings,
  sessionExchanges,
  cognitiveSessionIndex,
  cognitiveDailyPlans,
  cognitiveDailyPlanItems,
} from "../../shared/schema.js";
import { vitalsEvidenceFor } from "../../shared/vitalsEvidence.js";
import { formatMemoryBlock, searchMemories } from "./mem0.js";
import {
  buildHealthPolicyFilteredMemoryBlock,
  type HealthSemanticMemoryOutboxStore,
} from "../memory/healthSemanticMemory.js";
import { extractBrainCoachPreferences } from "./brainCoachPlan.js";
import { buildBrainCoachVoiceContext, type BrainCoachVoiceContext } from "./brainCoachVoiceContext.js";
import { buildPersistedBrainCoachPlan } from "./brainCoachPlanLifecycle.js";
import { socialRoomSeeds } from "./socialRoomsSeed.js";
import { buildAgentOperatingRules, buildConversationPlan } from "./voiceAgentPolicy.js";
import {
  conversationPlanToVariables,
  formatConversationPlanPrompt,
  selectVoiceConversationPlan,
} from "./voiceConversationPlans.js";
import {
  buildVoiceRecommendationFeedbackSummary,
  getVoiceRecommendationFeedbackRows,
  recommendationFeedbackScoreAdjustment,
  type VoiceRecommendationFeedbackSummary,
} from "./voiceRecommendationFeedback.js";
import { normalizeAppLanguage } from "../../shared/language.js";

export type VoiceContextDomain =
  | "safety"
  | "meds"
  | "health"
  | "concierge"
  | "brain_coach"
  | "onboarding_profile"
  | "companion"
  | "doctor"
  | "social";

const VOICE_CONTEXT_DOMAINS: readonly VoiceContextDomain[] = [
  "safety",
  "meds",
  "health",
  "concierge",
  "brain_coach",
  "onboarding_profile",
  "companion",
  "doctor",
  "social",
];

export type VoiceDynamicVariables = Record<string, string | number | boolean>;
export type ConversationTurn = { role: "user" | "assistant"; content: string };

type BuildVoiceContextOptions = {
  appEntrypoint?: string;
  priorVoiceExchangeCount?: number;
  healthMemoryPolicy?: {
    enabled: boolean;
    flowInstanceId?: string;
    env?: Readonly<Record<string, string | undefined>>;
    store?: HealthSemanticMemoryOutboxStore;
    now?: Date;
  };
};

const SENSITIVE_LEGACY_MEMORY_DOMAINS = new Set<VoiceContextDomain>([
  "safety",
  "meds",
  "health",
  "doctor",
]);

export function shouldUseLegacyVoiceContextMem0(domain: VoiceContextDomain): boolean {
  return !SENSITIVE_LEGACY_MEMORY_DOMAINS.has(domain);
}

type SignalReadingRow = {
  signal_type: string;
  value: string | number;
  recorded_at: Date | string;
  source: string;
  context_tag: string | null;
};

type JsonRecord = Record<string, unknown>;

function queryRows<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return Array.isArray(result) ? result as T[] : [];
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function section(consent: unknown, key: string): JsonRecord {
  return asRecord(asRecord(consent)[key]);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(asString).filter(Boolean)
    : [];
}

function valueList(values: Array<string | null | undefined>, fallback = "") {
  return values.map((value) => value?.trim() ?? "").filter(Boolean).join(", ") || fallback;
}

function voiceContextDomainOrDefault(value: string | null | undefined): VoiceContextDomain {
  return VOICE_CONTEXT_DOMAINS.includes(value as VoiceContextDomain)
    ? value as VoiceContextDomain
    : "companion";
}

function joinList(values: string[], fallback = "") {
  return values.length > 0 ? values.slice(0, 12).join(", ") : fallback;
}

function compactLines(lines: Array<string | null | undefined>, maxLength = 1800) {
  return lines.map((line) => line?.trim() ?? "").filter(Boolean).join("\n").slice(0, maxLength);
}

function firstName(profile: typeof profiles.$inferSelect | null) {
  const preferred = profile?.preferred_name?.trim();
  if (preferred) return preferred;
  const full = profile?.full_name?.trim();
  return full ? full.split(/\s+/)[0] ?? "friend" : "friend";
}

function formatMedication(med: typeof userMedications.$inferSelect) {
  const details = [
    med.dosage,
    med.frequency,
    med.scheduled_times?.length ? med.scheduled_times.join("/") : null,
  ].filter(Boolean);
  return details.length > 0
    ? `${med.medication_name} (${details.join(", ")})`
    : med.medication_name;
}

function formatCareMember(member: typeof teamInvitations.$inferSelect) {
  return valueList([
    member.invitee_name,
    member.relationship,
    member.role,
    member.status ? `status ${member.status}` : null,
  ]);
}

function formatTriageReport(report: typeof triageReports.$inferSelect) {
  return valueList([
    report.chief_complaint,
    report.urgency ? `urgency ${report.urgency}` : null,
    report.next_step_label ? `next step ${report.next_step_label}` : null,
    report.triage_reasons?.length ? `why ${report.triage_reasons.join("; ")}` : null,
    report.symptoms?.length ? `symptoms ${report.symptoms.join(", ")}` : null,
  ], "");
}

function formatVital(vital: typeof vitalsReadings.$inferSelect) {
  const value = vital.value ??
    valueList([
      vital.bpm ? `${vital.bpm} bpm` : null,
      vital.respiratory_rate ? `${vital.respiratory_rate} breaths/min` : null,
    ]);
  return valueList([vital.metric_type ?? "vital", value], ": ");
}

function signalLabel(signal: string | null | undefined) {
  switch (signal) {
    case "resting_hr_bpm":
      return "pulse";
    case "respiratory_rate":
      return "breathing rate";
    case "oxygen_saturation":
      return "oxygen saturation";
    case "temperature_c":
      return "temperature";
    case "bp_systolic":
      return "blood pressure top number";
    case "bp_diastolic":
      return "blood pressure bottom number";
    case "glucose_mgdl":
      return "glucose";
    case "pain_score":
      return "pain score";
    case "energy_level":
      return "energy level";
    case "mood_score":
      return "mood score";
    case "sleep_quality_score":
      return "sleep quality";
    case "medication_confirmed":
      return "medication confirmed";
    default:
      return signal?.replace(/_/g, " ") || "vital";
  }
}

function signalUnit(signal: string | null | undefined) {
  switch (signal) {
    case "resting_hr_bpm":
      return "bpm";
    case "respiratory_rate":
      return "breaths/min";
    case "oxygen_saturation":
      return "%";
    case "temperature_c":
      return "C";
    case "bp_systolic":
    case "bp_diastolic":
      return "mmHg";
    case "glucose_mgdl":
      return "mg/dL";
    case "pain_score":
    case "energy_level":
    case "mood_score":
    case "sleep_quality_score":
      return "/10";
    default:
      return "";
  }
}

function signalSourceLabel(source: string | null | undefined, signalType?: string | null) {
  return vitalsEvidenceFor(source, signalType).contextLabel;
}

function formatSignalReading(reading: SignalReadingRow) {
  const unit = signalUnit(reading.signal_type);
  const value = `${reading.value}${unit ? ` ${unit}` : ""}`;
  return valueList([
    signalLabel(reading.signal_type),
    value,
    signalSourceLabel(reading.source, reading.signal_type),
    reading.recorded_at ? `recorded ${formatDateTime(reading.recorded_at)}` : null,
  ], ": ");
}

function dateKeyFor(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

async function getLatestSignalReadings(userId: string): Promise<SignalReadingRow[]> {
  if (!looksLikeUuid(userId)) return [];
  const result = await db.execute(sql`
    SELECT signal_type, value, recorded_at, source, context_tag
    FROM vyva_signal_readings
    WHERE user_id = ${userId}
      AND recorded_at >= ${daysAgo(29)}
    ORDER BY recorded_at DESC
    LIMIT 30
  `);
  return queryRows<SignalReadingRow>(result);
}

function formatDateTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : "";
}

function formatRelativeTime(value: Date | string | null | undefined, now = new Date()) {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = now.getTime() - date.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return `scheduled ${date.toISOString()}`;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function ageFromDate(value: string | null | undefined, now = new Date()) {
  if (!value) return "";
  const birth = new Date(value);
  if (!Number.isFinite(birth.getTime())) return "";
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? String(age) : "";
}

function birthdayContext(value: string | null | undefined, now = new Date()) {
  if (!value) return "";
  const birth = new Date(value);
  if (!Number.isFinite(birth.getTime())) return "";
  const next = new Date(Date.UTC(now.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()));
  if (next.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  }
  const days = Math.round((next.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000);
  if (days === 0) return "Birthday is today.";
  if (days <= 14) return `Birthday is in ${days} day${days === 1 ? "" : "s"}.`;
  return `Next birthday: ${next.toISOString().slice(0, 10)}.`;
}

function metricLabel(metric: string | null | undefined) {
  switch (metric) {
    case "hr":
      return "heart rate";
    case "rr":
      return "respiratory rate";
    case "bp":
      return "blood pressure";
    default:
      return metric || "vital";
  }
}

function vitalMetricEntries(row: typeof vitalsReadings.$inferSelect) {
  if (row.metric_type && row.value) {
    return [{ metric: row.metric_type, value: row.value, recordedAt: row.recorded_at }];
  }
  const entries: Array<{ metric: string; value: string; recordedAt: Date }> = [];
  if (row.bpm != null) entries.push({ metric: "hr", value: `${row.bpm} bpm`, recordedAt: row.recorded_at });
  if (row.respiratory_rate != null) {
    entries.push({ metric: "rr", value: `${row.respiratory_rate} breaths/min`, recordedAt: row.recorded_at });
  }
  return entries;
}

function latestVitalsScan(readings: Array<typeof vitalsReadings.$inferSelect>) {
  const entries = readings.flatMap(vitalMetricEntries);
  if (entries.length === 0) return "";
  const latestAt = entries[0]?.recordedAt;
  return valueList([
    latestAt ? `recorded ${formatDateTime(latestAt)}` : "",
    ...entries.slice(0, 4).map((entry) => `${metricLabel(entry.metric)} ${entry.value}`),
  ]);
}

function latestSignalSummary(readings: SignalReadingRow[]) {
  if (readings.length === 0) return "";
  return valueList([
    readings[0]?.recorded_at ? `recorded ${formatDateTime(readings[0].recorded_at)}` : "",
    ...readings.slice(0, 6).map((reading) => {
      const unit = signalUnit(reading.signal_type);
      return `${signalLabel(reading.signal_type)} ${reading.value}${unit ? ` ${unit}` : ""} (${signalSourceLabel(reading.source, reading.signal_type)})`;
    }),
  ]);
}

function vitalsTrendSummary(readings: Array<typeof vitalsReadings.$inferSelect>) {
  const entriesByMetric = new Map<string, Array<{ value: string; recordedAt: Date }>>();
  for (const entry of readings.flatMap(vitalMetricEntries)) {
    const bucket = entriesByMetric.get(entry.metric) ?? [];
    bucket.push({ value: entry.value, recordedAt: entry.recordedAt });
    entriesByMetric.set(entry.metric, bucket);
  }

  const lines = Array.from(entriesByMetric.entries()).map(([metric, entries]) => {
    const sorted = [...entries].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime()).slice(0, 7);
    const values = sorted.map((entry) => `${dateKeyFor(entry.recordedAt)} ${entry.value}`);
    return `${metricLabel(metric)} recent values: ${values.join(" | ")}`;
  });
  return compactLines(lines, 1200);
}

function signalTrendSummary(readings: SignalReadingRow[]) {
  const entriesBySignal = new Map<string, Array<SignalReadingRow>>();
  for (const reading of readings) {
    const bucket = entriesBySignal.get(reading.signal_type) ?? [];
    bucket.push(reading);
    entriesBySignal.set(reading.signal_type, bucket);
  }

  const lines = Array.from(entriesBySignal.entries()).map(([signal, entries]) => {
    const sorted = [...entries]
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
      .slice(0, 7);
    const values = sorted.map((entry) => {
      const unit = signalUnit(entry.signal_type);
      return `${dateKeyFor(entry.recorded_at)} ${entry.value}${unit ? ` ${unit}` : ""}`;
    });
    return `${signalLabel(signal)} recent values: ${values.join(" | ")}`;
  });
  return compactLines(lines, 1200);
}

function formatTriageReportDetailed(report: typeof triageReports.$inferSelect) {
  return valueList([
    report.created_at ? `recorded ${formatDateTime(report.created_at)}` : null,
    report.chief_complaint,
    report.urgency ? `urgency ${report.urgency}` : null,
    report.next_step_label ? `next step ${report.next_step_label}` : null,
    report.triage_reasons?.length ? `why ${report.triage_reasons.join("; ")}` : null,
    report.symptoms?.length ? `symptoms ${report.symptoms.join(", ")}` : null,
    report.watch_signs?.length ? `watch signs ${report.watch_signs.join("; ")}` : null,
    report.profile_considerations?.length ? `profile considered ${report.profile_considerations.join("; ")}` : null,
    report.vitals_notes?.length ? `vitals notes ${report.vitals_notes.join("; ")}` : null,
    report.bpm ? `heart rate ${report.bpm} bpm` : null,
    report.respiratory_rate ? `respiratory rate ${report.respiratory_rate} breaths/min` : null,
  ], "");
}

function formatCheckinSession(session: typeof checkinSessions.$inferSelect) {
  return valueList([
    session.completed_at ? `completed ${formatDateTime(session.completed_at)}` : null,
    session.feeling_label ? `feeling ${session.feeling_label}` : null,
    session.overall_state ? `state ${session.overall_state}` : null,
    session.energy_level != null ? `energy ${session.energy_level}` : null,
    session.mood ? `mood ${session.mood}` : null,
    session.symptoms?.length ? `symptoms ${session.symptoms.join(", ")}` : null,
    session.safety_flags?.length ? `safety flags ${session.safety_flags.join(", ")}` : null,
    session.flag_caregiver ? "caregiver flag requested" : null,
  ], "");
}

function formatScheduledInteraction(interaction: typeof scheduledInteractions.$inferSelect) {
  return valueList([
    interaction.friendly_label || interaction.user_description || interaction.interaction_type,
    interaction.status ? `status ${interaction.status}` : null,
    interaction.is_paused ? "paused" : null,
    interaction.times_of_day?.length ? `times ${interaction.times_of_day.join("/")}` : null,
    interaction.next_run_at ? `next due ${formatDateTime(interaction.next_run_at)}` : null,
    interaction.last_completed_at ? `last completed ${formatDateTime(interaction.last_completed_at)}` : null,
  ], "");
}

function buildCheckinContext(input: {
  sessions: Array<typeof checkinSessions.$inferSelect>;
  schedules: Array<typeof scheduledInteractions.$inferSelect>;
  now: Date;
}) {
  const latestSession = input.sessions[0];
  const activeSchedule = input.schedules.find((schedule) => schedule.status === "ACTIVE" && !schedule.is_paused);
  const overdueSchedule = input.schedules.find((schedule) => {
    if (schedule.status !== "ACTIVE" || schedule.is_paused || !schedule.next_run_at) return false;
    const nextRunAt = new Date(schedule.next_run_at);
    if (!Number.isFinite(nextRunAt.getTime()) || nextRunAt.getTime() > input.now.getTime()) return false;
    if (!schedule.last_completed_at) return true;
    return new Date(schedule.last_completed_at).getTime() < nextRunAt.getTime();
  });

  return compactLines([
    latestSession ? `Latest check-in: ${formatCheckinSession(latestSession)}` : "",
    activeSchedule ? `Check-in schedule: ${formatScheduledInteraction(activeSchedule)}` : "",
    overdueSchedule ? `Possible missed check-in: ${formatScheduledInteraction(overdueSchedule)}` : "",
  ], 1400);
}

function dosesPerDay(scheduledTimes: string[] | null | undefined) {
  return scheduledTimes && scheduledTimes.length > 0 ? scheduledTimes.length : 1;
}

function medicationAdherenceStats(
  medications: Array<typeof userMedications.$inferSelect>,
  adherenceRows: Array<typeof medicationAdherence.$inferSelect>,
  now = new Date(),
) {
  const today = now.toISOString().slice(0, 10);
  const activeDoseCount = medications.reduce((sum, med) => sum + dosesPerDay(med.scheduled_times), 0);
  const todayTaken = adherenceRows.filter((row) => row.status === "taken" && dateKeyFor(row.created_at) === today).length;
  const missed30 = adherenceRows.filter((row) => ["missed", "skipped", "late"].includes(row.status)).length;
  return { activeDoseCount, todayTaken, missed30 };
}

function buildMedicationAdherenceSummary(
  medications: Array<typeof userMedications.$inferSelect>,
  adherenceRows: Array<typeof medicationAdherence.$inferSelect>,
) {
  if (medications.length === 0 && adherenceRows.length === 0) return "";
  const { activeDoseCount, todayTaken, missed30 } = medicationAdherenceStats(medications, adherenceRows);
  const taken30 = adherenceRows.filter((row) => row.status === "taken").length;
  const latest = adherenceRows
    .slice()
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, 5)
    .map((row) => `${row.medication_name} ${row.status} ${formatDateTime(row.created_at)}`);

  return compactLines([
    activeDoseCount ? `Today: ${todayTaken}/${activeDoseCount} scheduled dose confirmations recorded.` : "",
    `Last 30 days: ${taken30} taken confirmations, ${missed30} missed/skipped/late records.`,
    latest.length ? `Latest medication records: ${latest.join(" | ")}` : "",
  ], 1400);
}

function buildMedicationInteractionContext(activeMeds: string[], allergies: string[]) {
  if (activeMeds.length === 0 && allergies.length === 0) return "";
  return compactLines([
    activeMeds.length ? `Active medicines to consider together: ${joinList(activeMeds)}` : "",
    allergies.length ? `Known allergies to consider: ${joinList(allergies)}` : "",
    "For possible interactions, side effects, dose changes, or contraindications, advise pharmacist or GP review and route to the meds specialist when medication management is the main topic.",
  ], 1200);
}

function scheduledEventMetadata(event: typeof scheduledEvents.$inferSelect) {
  return asRecord(event.metadata);
}

function isMedicalScheduledEvent(event: typeof scheduledEvents.$inferSelect) {
  const haystack = [
    event.event_type,
    event.title,
    event.description,
    event.source,
    asString(scheduledEventMetadata(event).source_use_case),
  ].join(" ").toLowerCase();
  return /\b(appointment|doctor|gp|medical|health|clinic|pharmacy|medico|cita|salud)\b/.test(haystack);
}

function formatScheduledHealthEvent(event: typeof scheduledEvents.$inferSelect | undefined) {
  if (!event) return "";
  return valueList([
    event.title,
    event.event_type ? `type ${event.event_type}` : null,
    event.status ? `status ${event.status}` : null,
    event.scheduled_for ? `scheduled ${formatDateTime(event.scheduled_for)}` : null,
    event.description,
  ], "");
}

function splitMedicalEvents(events: Array<typeof scheduledEvents.$inferSelect>) {
  const now = Date.now();
  const medicalEvents = events.filter(isMedicalScheduledEvent);
  const past = medicalEvents
    .filter((event) => event.scheduled_for && event.scheduled_for.getTime() <= now)
    .sort((a, b) => b.scheduled_for.getTime() - a.scheduled_for.getTime())[0];
  const upcoming = medicalEvents
    .filter((event) => event.scheduled_for && event.scheduled_for.getTime() > now && event.status !== "cancelled")
    .sort((a, b) => a.scheduled_for.getTime() - b.scheduled_for.getTime())[0];
  return { latestVisit: past, upcomingAppointment: upcoming };
}

function formatScheduledEvent(event: typeof scheduledEvents.$inferSelect) {
  return valueList([
    event.title,
    event.event_type ? `type ${event.event_type}` : null,
    event.status ? `status ${event.status}` : null,
    event.scheduled_for ? `scheduled ${formatDateTime(event.scheduled_for)}` : null,
    event.description,
  ], "");
}

function formatUpcomingEvents(events: Array<typeof scheduledEvents.$inferSelect>, now = new Date()) {
  return events
    .filter((event) => event.scheduled_for && event.scheduled_for.getTime() >= now.getTime() && event.status !== "cancelled")
    .sort((a, b) => a.scheduled_for.getTime() - b.scheduled_for.getTime())
    .slice(0, 5)
    .map(formatScheduledEvent);
}

function formatRecentActivity(logs: Array<typeof activityLogs.$inferSelect>) {
  if (logs.length === 0) return "";
  const latest = logs[0];
  const totalMinutes = logs.reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0);
  const counts = new Map<string, number>();
  logs.forEach((log) => counts.set(log.activity_type, (counts.get(log.activity_type) ?? 0) + 1));
  const common = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} x${count}`);

  return compactLines([
    latest ? `Latest activity: ${latest.activity_type}, ${latest.duration_minutes} minutes, ${formatDateTime(latest.logged_at)}.` : "",
    `Last 14 days: ${totalMinutes} activity minutes recorded.`,
    common.length ? `Common activities: ${common.join(", ")}.` : "",
  ], 900);
}

function formatSocialActivity(
  visits: Array<typeof socialRoomVisits.$inferSelect>,
  roomsById: Map<string, typeof socialRooms.$inferSelect>,
) {
  if (visits.length === 0) return "";
  const latest = visits[0];
  const latestRoom = roomsById.get(String(latest?.room_id));
  const totalMessages = visits.reduce((sum, visit) => sum + (visit.messages_sent ?? 0), 0);
  const completed = visits.filter((visit) => visit.completed).length;
  const roomNames = visits
    .map((visit) => roomsById.get(String(visit.room_id))?.name_en)
    .filter((value): value is string => Boolean(value));

  return compactLines([
    latest ? `Last social room: ${latestRoom?.name_en ?? "social room"} (${latestRoom?.slug ?? "unknown"}), ${formatDateTime(latest.last_active_at)}.` : "",
    `Recent social room visits: ${visits.length}; completed sessions: ${completed}; messages sent: ${totalMessages}.`,
    roomNames.length ? `Recent rooms: ${joinList([...new Set(roomNames)])}` : "",
  ], 1000);
}

function matchingSocialRoomSuggestions(interests: string[], preferredTimes: string[]) {
  if (interests.length === 0) return "";
  const normalizedInterests = interests.map((interest) => interest.toLowerCase());
  const normalizedTimes = preferredTimes.map((time) => time.toLowerCase());
  const matches = socialRoomSeeds
    .map((room) => {
      const tagHit = room.topicTags.some((tag) =>
        normalizedInterests.some((interest) => interest.includes(tag) || tag.includes(interest)),
      );
      const timeHit = normalizedTimes.length === 0 || room.timeSlots.some((slot) => normalizedTimes.includes(slot));
      return { room, score: (tagHit ? 2 : 0) + (timeHit ? 1 : 0) };
    })
    .filter((item) => item.score > 1)
    .sort((a, b) => b.score - a.score || a.room.sortOrder - b.room.sortOrder)
    .slice(0, 3)
    .map((item) => `${item.room.names.en} (${item.room.slug}) for ${item.room.topicTags.slice(0, 3).join(", ")}`);

  return joinList(matches);
}

function buildLocalInterestOpportunities(input: {
  city: string;
  region: string;
  interests: string[];
  hobbies: string[];
  mobilityContext: string;
}) {
  const interests = [...new Set([...input.interests, ...input.hobbies])].filter(Boolean);
  if (interests.length === 0) return "";
  const location = valueList([input.city, input.region], "the user's area");
  const selected = interests.slice(0, 4);
  return compactLines([
    `Saved interests to convert into useful local plans: ${joinList(selected)}.`,
    `Location for live checks: ${location}.`,
    input.mobilityContext ? `Fit plans to mobility/living context: ${input.mobilityContext}.` : "",
    "Do not invent specific event names, times, prices, or venues. Offer to ask Concierge to check real nearby options when the user is interested.",
  ], 1200);
}

type NextBestConversationPriority = "high" | "medium" | "low";

type NextBestConversationCandidate = {
  id: string;
  domain: VoiceContextDomain;
  score: number;
  priority: NextBestConversationPriority;
  title: string;
  reason: string;
  openingCue: string;
  suggestedAction: string;
  evidence: string;
};

function daysSince(value: Date | string | null | undefined, now = new Date()) {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

function hoursUntil(value: Date | string | null | undefined, now = new Date()) {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((date.getTime() - now.getTime()) / 3600000);
}

function priorityForScore(score: number): NextBestConversationPriority {
  if (score >= 78) return "high";
  if (score >= 58) return "medium";
  return "low";
}

function formatNextBestCandidate(candidate: NextBestConversationCandidate, index: number) {
  return [
    `${index + 1}. ${candidate.title}`,
    `domain ${candidate.domain}`,
    `priority ${candidate.priority}`,
    `score ${candidate.score}`,
    `reason ${candidate.reason}`,
    `cue ${candidate.openingCue}`,
    candidate.evidence ? `evidence ${candidate.evidence}` : "",
  ].filter(Boolean).join("; ");
}

function specialistDomainScoreAdjustment(activeDomain: VoiceContextDomain, candidateDomain: VoiceContextDomain) {
  if (activeDomain === "companion") return 0;
  if (activeDomain === "doctor") {
    if (candidateDomain === "health") return 26;
    if (candidateDomain === "meds" || candidateDomain === "concierge") return 6;
    return candidateDomain === "companion" ? -4 : -10;
  }
  if (activeDomain === "health") {
    if (candidateDomain === "health") return 28;
    if (candidateDomain === "meds" || candidateDomain === "concierge") return 6;
    if (candidateDomain === "safety") return 14;
    return candidateDomain === "companion" ? -4 : -12;
  }
  if (activeDomain === "meds") {
    if (candidateDomain === "meds") return 30;
    if (candidateDomain === "health" || candidateDomain === "concierge") return 6;
    return candidateDomain === "companion" ? -6 : -14;
  }
  if (activeDomain === "concierge") {
    if (candidateDomain === "concierge") return 30;
    if (candidateDomain === "social") return 4;
    return candidateDomain === "companion" ? -4 : -12;
  }
  if (activeDomain === "brain_coach") {
    if (candidateDomain === "brain_coach") return 32;
    if (candidateDomain === "companion") return 4;
    return -14;
  }
  if (activeDomain === "social") {
    if (candidateDomain === "social") return 30;
    if (candidateDomain === "companion" || candidateDomain === "concierge") return 5;
    return -14;
  }
  if (activeDomain === "safety") {
    if (candidateDomain === "safety") return 38;
    if (candidateDomain === "health") return 12;
    if (candidateDomain === "meds") return 4;
    return -18;
  }
  return activeDomain === candidateDomain ? 24 : 0;
}

function adjustedCandidateScore(
  candidate: NextBestConversationCandidate,
  activeDomain: VoiceContextDomain,
  feedbackSummary: VoiceRecommendationFeedbackSummary,
) {
  const score =
    candidate.score +
    specialistDomainScoreAdjustment(activeDomain, candidate.domain) +
    recommendationFeedbackScoreAdjustment(feedbackSummary, candidate.id, candidate.domain);
  return Math.max(0, Math.min(120, Math.round(score)));
}

function buildNextBestConversation(input: {
  domain: VoiceContextDomain;
  priorVoiceExchangeCount: number;
  profile: typeof profiles.$inferSelect | null;
  activeMedicationRows: Array<typeof userMedications.$inferSelect>;
  medicationAdherenceRows: Array<typeof medicationAdherence.$inferSelect>;
  latestReports: Array<typeof triageReports.$inferSelect>;
  latestVitals: Array<typeof vitalsReadings.$inferSelect>;
  latestVitalsScanSummary: string;
  upcomingAppointment: typeof scheduledEvents.$inferSelect | undefined;
  scheduledEventRows: Array<typeof scheduledEvents.$inferSelect>;
  appLastSeenAt: Date | string | null | undefined;
  lastVoiceSessionAt: Date | string | null | undefined;
  latestVoiceExchange: typeof sessionExchanges.$inferSelect | null;
  allHobbies: string[];
  allInterests: string[];
  allPreferredActivities: string[];
  birthday: string;
  matchingSocialRooms: string;
  localInterestOpportunities: string;
  recentActivitySummary: string;
  socialActivitySummary: string;
  brainCoachVoiceContext: BrainCoachVoiceContext | null;
  feedbackSummary: VoiceRecommendationFeedbackSummary;
  now: Date;
}) {
  const candidates: NextBestConversationCandidate[] = [];
  const add = (candidate: Omit<NextBestConversationCandidate, "priority">) => {
    candidates.push({ ...candidate, priority: priorityForScore(candidate.score) });
  };

  if (input.domain === "companion" && input.priorVoiceExchangeCount === 0) {
    add({
      id: "first_welcome_tour",
      domain: "companion",
      score: 100,
      title: "Welcome and orientation",
      reason: "No prior VYVA voice exchange is recorded.",
      openingCue: "Welcome the user by name if possible, explain VYVA briefly, and ask whether they would like a short tour.",
      suggestedAction: "Offer the app tour before suggesting specialist help.",
      evidence: input.profile?.preferred_name || input.profile?.full_name ? "Profile name is available." : "Profile is minimal.",
    });
  }

  const medicationStats = medicationAdherenceStats(
    input.activeMedicationRows,
    input.medicationAdherenceRows,
    input.now,
  );
  if (input.activeMedicationRows.length > 0) {
    if (medicationStats.activeDoseCount > 0 && medicationStats.todayTaken < medicationStats.activeDoseCount) {
      add({
        id: "medication_today_check",
        domain: "meds",
        score: input.priorVoiceExchangeCount === 0 ? 64 : 90,
        title: "Medication check-in",
        reason: `${medicationStats.todayTaken}/${medicationStats.activeDoseCount} scheduled dose confirmations are recorded today.`,
        openingCue: "Offer a gentle medication check-in without listing medicine names unless the user wants that.",
        suggestedAction: "Ask whether they want to review today's medication schedule or missed confirmations.",
        evidence: `${input.activeMedicationRows.length} active medication(s); ${medicationStats.missed30} missed/skipped/late record(s) in the last 30 days.`,
      });
    } else if (medicationStats.missed30 > 0) {
      add({
        id: "medication_recent_missed",
        domain: "meds",
        score: input.priorVoiceExchangeCount === 0 ? 58 : 82,
        title: "Medication adherence support",
        reason: `${medicationStats.missed30} missed, skipped, or late medication record(s) exist in the recent history.`,
        openingCue: "Offer practical medication support, keeping the opening calm and non-judgemental.",
        suggestedAction: "Ask if they would like help checking the medication routine.",
        evidence: `${input.activeMedicationRows.length} active medication(s) in profile.`,
      });
    } else {
      add({
        id: "medication_profile_available",
        domain: "meds",
        score: 48,
        title: "Medication routine available",
        reason: "The user has an active medication profile that can support useful reminders or checks.",
        openingCue: "Mention medication help only if no stronger topic is available or the user raises it.",
        suggestedAction: "Offer a quick medication routine review.",
        evidence: `${input.activeMedicationRows.length} active medication(s) in profile.`,
      });
    }
  }

  const latestReport = input.latestReports[0];
  if (latestReport) {
    const reportAgeDays = daysSince(latestReport.created_at, input.now);
    const urgentReport = /\b(urgent|high|emergency|red|acute)\b/i.test(latestReport.urgency ?? "");
    if (urgentReport || reportAgeDays <= 7) {
      add({
        id: "health_recent_report",
        domain: "health",
        score: urgentReport ? 92 : reportAgeDays <= 2 ? 84 : 70,
        title: "Health follow-up",
        reason: urgentReport
          ? "A recent health report has high urgency context."
          : `A health report was recorded ${formatRelativeTime(latestReport.created_at, input.now)}.`,
        openingCue: "Offer a health follow-up without revealing symptom details until the user chooses to discuss health.",
        suggestedAction: "Ask whether they would like to review how they are feeling now or prepare a GP/health note.",
        evidence: valueList([
          latestReport.urgency ? `urgency ${latestReport.urgency}` : null,
          latestReport.symptoms?.length ? `${latestReport.symptoms.length} symptom(s) recorded` : null,
        ]),
      });
    }
  }

  const latestVitalsAt = input.latestVitals[0]?.recorded_at;
  if (input.latestVitalsScanSummary) {
    const vitalsAgeDays = daysSince(latestVitalsAt, input.now);
    add({
      id: vitalsAgeDays >= 7 ? "vitals_refresh" : "vitals_available",
      domain: "health",
      score: vitalsAgeDays >= 7 ? 68 : 52,
      title: vitalsAgeDays >= 7 ? "Vitals refresh" : "Recent vitals context",
      reason: vitalsAgeDays >= 7
        ? `The latest vitals scan is ${vitalsAgeDays} days old.`
        : "Recent vitals context is available if health comes up.",
      openingCue: vitalsAgeDays >= 7
        ? "Offer a simple vitals refresh if the user wants a health check."
        : "Keep vitals quiet unless the user raises health.",
      suggestedAction: vitalsAgeDays >= 7 ? "Ask whether they want to do or review a vitals scan." : "Keep available for a health handoff.",
      evidence: input.latestVitalsScanSummary,
    });
  }

  if (input.upcomingAppointment) {
    const hours = hoursUntil(input.upcomingAppointment.scheduled_for, input.now);
    add({
      id: "upcoming_medical_appointment",
      domain: "concierge",
      score: hours <= 24 ? 88 : hours <= 72 ? 80 : hours <= 168 ? 70 : 56,
      title: "Prepare for upcoming health appointment",
      reason: hours <= 168
        ? `A health appointment is coming up in about ${Math.max(1, Math.round(hours / 24))} day(s).`
        : "A future health appointment is recorded.",
      openingCue: "Offer to help prepare questions, transport, reminders, or notes for the appointment.",
      suggestedAction: "Ask whether they want help preparing for the appointment.",
      evidence: formatScheduledHealthEvent(input.upcomingAppointment),
    });
  }

  const nextEvent = input.scheduledEventRows
    .filter((event) => event.scheduled_for && event.scheduled_for.getTime() >= input.now.getTime() && event.status !== "cancelled")
    .sort((a, b) => a.scheduled_for.getTime() - b.scheduled_for.getTime())[0];
  if (nextEvent && nextEvent.id !== input.upcomingAppointment?.id) {
    const hours = hoursUntil(nextEvent.scheduled_for, input.now);
    add({
      id: "upcoming_event_or_reminder",
      domain: "concierge",
      score: hours <= 24 ? 82 : hours <= 72 ? 72 : hours <= 168 ? 62 : 48,
      title: "Upcoming plan or reminder",
      reason: hours <= 168 ? `A scheduled item is coming up in about ${Math.max(1, Math.round(hours / 24))} day(s).` : "A future scheduled item is recorded.",
      openingCue: "Offer practical help preparing for the next plan or reminder.",
      suggestedAction: "Ask whether they want help preparing, remembering, or arranging anything.",
      evidence: formatScheduledEvent(nextEvent),
    });
  }

  if (input.birthday === "Birthday is today." || /Birthday is in \d+ day/.test(input.birthday)) {
    add({
      id: input.birthday === "Birthday is today." ? "birthday_today" : "birthday_soon",
      domain: "companion",
      score: input.birthday === "Birthday is today." ? 86 : 66,
      title: input.birthday === "Birthday is today." ? "Birthday moment" : "Birthday coming up",
      reason: input.birthday,
      openingCue: "Use birthday context warmly only if it feels natural; do not make the whole call about it unless the user responds.",
      suggestedAction: "Offer a small birthday-related idea, message, memory, or plan.",
      evidence: input.birthday,
    });
  }

  const socialGapDays = input.socialActivitySummary ? 0 : 14;
  if (input.matchingSocialRooms) {
    add({
      id: "social_room_match",
      domain: "social",
      score: socialGapDays >= 14 ? 70 : 60,
      title: "Interest-based social connection",
      reason: "Saved interests match available social rooms.",
      openingCue: "Offer one social or companion activity that fits their interests.",
      suggestedAction: "Ask whether they would like to join or hear about one matching room.",
      evidence: input.matchingSocialRooms,
    });
  }

  if (input.localInterestOpportunities) {
    add({
      id: "nearby_interest_plan",
      domain: "concierge",
      score: 58,
      title: "Nearby interest idea",
      reason: "The user's hobbies/interests and location can be turned into a local plan.",
      openingCue: "Offer Concierge verification before naming any live event, place, time, price, or venue.",
      suggestedAction: "Ask if they want VYVA to check real nearby options related to their interests.",
      evidence: input.localInterestOpportunities,
    });
  }

  const brainInterest = [...input.allInterests, ...input.allHobbies, ...input.allPreferredActivities]
    .some((value) => /\b(game|games|memory|puzzle|quiz|chess|scrabble|reading|word)\b/i.test(value));
  if (brainInterest) {
    add({
      id: "brain_coach_interest",
      domain: "brain_coach",
      score: 56,
      title: "Brain coach activity",
      reason: "Saved interests suggest games, memory, puzzles, reading, or word activities may fit.",
      openingCue: "Offer a light brain activity as a friendly option, not as a requirement.",
      suggestedAction: "Ask whether they would like a short brain game or memory activity.",
      evidence: joinList([...input.allInterests, ...input.allHobbies, ...input.allPreferredActivities]),
    });
  }

  if (input.recentActivitySummary) {
    add({
      id: "activity_routine",
      domain: "companion",
      score: 52,
      title: "Routine and activity check-in",
      reason: "Recent activity history can support a useful routine, rest, or movement suggestion.",
      openingCue: "Offer a gentle routine check-in if there is no more urgent health or medication topic.",
      suggestedAction: "Ask whether they want a simple plan for today.",
      evidence: input.recentActivitySummary,
    });
  }

  const voiceGapDays = daysSince(input.lastVoiceSessionAt, input.now);
  if (input.latestVoiceExchange?.message && voiceGapDays <= 7) {
    add({
      id: "continue_last_thread",
      domain: voiceContextDomainOrDefault(input.latestVoiceExchange.agent_used),
      score: 54,
      title: "Continue last conversation",
      reason: `The last voice exchange was ${formatRelativeTime(input.lastVoiceSessionAt, input.now)}.`,
      openingCue: "Offer to continue the last thread in one sentence, without assuming they still want it.",
      suggestedAction: "Ask whether they want to continue or switch topics.",
      evidence: input.latestVoiceExchange.message.slice(0, 180),
    });
  } else if (voiceGapDays >= 3 && Number.isFinite(voiceGapDays)) {
    add({
      id: "relationship_reconnect",
      domain: "companion",
      score: 50,
      title: "Warm reconnection",
      reason: `It has been ${voiceGapDays} day(s) since the last VYVA voice session.`,
      openingCue: "Open with a brief warm catch-up, then offer one useful next step.",
      suggestedAction: "Ask how they would like to start today.",
      evidence: input.appLastSeenAt ? `Last app visit ${formatRelativeTime(input.appLastSeenAt, input.now)}.` : "",
    });
  }

  if (input.domain === "health" || input.domain === "doctor") {
    add({
      id: "health_specialist_session_focus",
      domain: "health",
      score: 72,
      title: "Health assistant focus",
      reason: "The active agent is a health specialist and should start from the freshest profile, symptom, vitals, medication, and care context.",
      openingCue: "Start with one relevant health context point, then ask what health question or check-in would be most useful now.",
      suggestedAction: "Offer a symptom follow-up, vitals review, GP note, or safe next step.",
      evidence: valueList([
        input.latestVitalsScanSummary ? "vitals available" : null,
        input.latestReports[0]?.chief_complaint ? "symptom report available" : null,
        input.activeMedicationRows.length ? `${input.activeMedicationRows.length} active medication(s)` : null,
      ], "Health specialist session requested."),
    });
  }

  if (input.domain === "meds") {
    add({
      id: "meds_specialist_session_focus",
      domain: "meds",
      score: 74,
      title: "Medication specialist focus",
      reason: "The active agent is the medication specialist and should prioritise dose schedule, adherence, refills, side effects, and interaction questions.",
      openingCue: "Start with a calm medication check-in and avoid naming medicine details until the user chooses to discuss them.",
      suggestedAction: "Ask whether they want to review today's doses, missed confirmations, refills, or side effects.",
      evidence: input.activeMedicationRows.length
        ? `${input.activeMedicationRows.length} active medication(s); ${medicationStats.missed30} recent missed/skipped/late record(s).`
        : "No active medication profile is recorded yet.",
    });
  }

  if (input.domain === "concierge") {
    add({
      id: "concierge_specialist_session_focus",
      domain: "concierge",
      score: 72,
      title: "Concierge planning focus",
      reason: "The active agent is Concierge and should turn appointments, reminders, local interests, shopping, transport, or provider contact into one practical next step.",
      openingCue: "Offer practical planning help tied to the strongest available event, reminder, location, or preference signal.",
      suggestedAction: "Ask whether they want help planning, booking, checking, calling, or setting a reminder.",
      evidence: valueList([
        input.upcomingAppointment ? "health appointment available" : null,
        input.scheduledEventRows.length ? `${input.scheduledEventRows.length} scheduled item(s)` : null,
        input.localInterestOpportunities ? "local interest context available" : null,
      ], "Concierge specialist session requested."),
    });
  }

  if (input.domain === "brain_coach") {
    const brainCoach = input.brainCoachVoiceContext;
    add({
      id: "brain_coach_daily_plan",
      domain: "brain_coach",
      score: brainCoach?.state === "lapsed" ? 88 : brainCoach?.state === "new_user" ? 84 : 82,
      title: brainCoach?.firstRecommendedActivityTitle
        ? `Start ${brainCoach.firstRecommendedActivityTitle}`
        : "Brain coach daily plan",
      reason: brainCoach?.missedSessionAwareness
        ?? "The active agent is Brain Coach and should provide encouraging company around games, memory practice, puzzles, or cognitive activity.",
      openingCue: brainCoach?.recommendedActivityPrompt
        ?? "Offer a short, positive brain activity and keep the tone encouraging rather than clinical.",
      suggestedAction: brainCoach?.firstRecommendedActivityRoute
        ? `Open ${brainCoach.firstRecommendedActivityRoute} if the user accepts the recommended activity.`
        : "Ask whether they would like to play, continue, or choose a lighter activity.",
      evidence: brainCoach?.summary
        ?? joinList([...input.allInterests, ...input.allHobbies, ...input.allPreferredActivities], "Brain Coach specialist session requested."),
    });
  }

  if (input.domain === "social") {
    add({
      id: "social_specialist_session_focus",
      domain: "social",
      score: 72,
      title: "Social connection focus",
      reason: "The active agent is social/companion specialist and should use interests, rooms, hobbies, and recent social activity to suggest one warm connection.",
      openingCue: "Offer one social room, shared-interest conversation, or companion thread that fits the user's preferences.",
      suggestedAction: "Ask whether they want to join a matching room, chat about an interest, or hear a story.",
      evidence: valueList([
        input.matchingSocialRooms || null,
        input.socialActivitySummary || null,
        input.allHobbies.length || input.allInterests.length ? `Saved interests: ${joinList([...input.allHobbies, ...input.allInterests])}` : null,
      ], "Social specialist session requested."),
    });
  }

  if (input.domain === "safety") {
    add({
      id: "safety_specialist_session_focus",
      domain: "safety",
      score: 78,
      title: "Safety support focus",
      reason: "The active agent is Safety and should prioritise calm risk assessment, emergency contacts, care team, falls, scams, and urgent symptoms.",
      openingCue: "Start calmly, check immediate safety, and ask one clear question about what is happening now.",
      suggestedAction: "Confirm whether urgent help, a caregiver, emergency services, or scam/fall support is needed.",
      evidence: "Safety specialist session requested.",
    });
  }

  if (candidates.length === 0) {
    add({
      id: "daily_companion_checkin",
      domain: "companion",
      score: 40,
      title: "Daily companion check-in",
      reason: "No time-sensitive health, medication, social, or logistics signal is currently stronger.",
      openingCue: "Start warmly and ask what would be most helpful today.",
      suggestedAction: "Offer a simple choice: chat, health, medication, activities, social, or concierge help.",
      evidence: "Fallback recommendation.",
    });
  }

  const adjustedCandidates = candidates.map((candidate) => {
    const score = adjustedCandidateScore(candidate, input.domain, input.feedbackSummary);
    return { ...candidate, score, priority: priorityForScore(score) };
  });
  const sortedCandidates = adjustedCandidates
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 5);
  const top = sortedCandidates[0];
  const candidateList = sortedCandidates.map(formatNextBestCandidate).join("\n");
  const brief = top
    ? compactLines([
        `Top recommendation: ${top.title}.`,
        `Domain: ${top.domain}. Priority: ${top.priority}. Score: ${top.score}.`,
        `Reason: ${top.reason}`,
        `Opening cue: ${top.openingCue}`,
        `Suggested action: ${top.suggestedAction}`,
        top.evidence ? `Evidence: ${top.evidence}` : "",
        input.feedbackSummary.promptBlock ? `Feedback guidance:\n${input.feedbackSummary.promptBlock}` : "",
        candidateList ? `Ranked shortlist:\n${candidateList}` : "",
        "Use this as quiet guidance. Do not mention scores, IDs, variable names, or internal ranking to the user.",
      ], 2800)
    : "";

  return {
    top,
    candidates: sortedCandidates,
    candidateList,
    brief,
  };
}

function profileLocation(profile: typeof profiles.$inferSelect | null) {
  if (!profile) return "";
  return valueList([
    profile.address_line_1,
    profile.city,
    profile.region,
    profile.postcode,
    profile.country_code,
  ]);
}

function formatProviders(providersSection: JsonRecord) {
  const providers = Array.isArray(providersSection.providers)
    ? providersSection.providers as JsonRecord[]
    : [];
  return providers.slice(0, 8).map((provider) =>
    valueList([
      asString(provider.name),
      asString(provider.role),
      asString(provider.phone),
      asString(provider.address),
      asString(provider.notes),
    ])
  ).filter(Boolean);
}

function formatHobbyDetails(hobbiesSection: JsonRecord) {
  const hobbies = asStringArray(hobbiesSection.hobbies);
  const followUps = asRecord(hobbiesSection.followUps);
  const personality = asRecord(hobbiesSection.personality);
  const detailLines = [
    hobbies.length ? `Hobbies: ${joinList(hobbies)}` : "",
    ...Object.entries(followUps)
      .map(([key, value]) => `${key}: ${asString(value)}`)
      .filter((line) => !line.endsWith(": ")),
    ...Object.entries(personality)
      .map(([key, value]) => `${key}: ${asString(value)}`)
      .filter((line) => !line.endsWith(": ")),
  ];
  return { hobbies, detail: compactLines(detailLines, 1200) };
}

function criticalSafetyContext(input: {
  profile: typeof profiles.$inferSelect | null;
  conditions: string[];
  allergies: string[];
  emergencyContact: string;
  careTeam: string[];
}) {
  return compactLines([
    input.emergencyContact ? `Emergency contact: ${input.emergencyContact}` : "",
    profileLocation(input.profile) ? `Address/location: ${profileLocation(input.profile)}` : "",
    input.careTeam.length ? `Care team: ${joinList(input.careTeam)}` : "",
    input.conditions.length ? `Known conditions: ${joinList(input.conditions)}` : "",
    input.allergies.length ? `Known allergies: ${joinList(input.allergies)}` : "",
  ]);
}

function domainAllows(domain: VoiceContextDomain, category: "medical" | "social" | "logistics" | "safety") {
  const allowed: Record<typeof category, VoiceContextDomain[]> = {
    medical: ["health", "doctor", "meds", "safety"],
    social: ["companion", "social", "brain_coach", "concierge", "health", "doctor"],
    logistics: ["concierge", "safety", "health", "doctor", "meds"],
    safety: ["safety", "health", "doctor", "meds", "concierge"],
  };
  return allowed[category].includes(domain);
}

function isOnboardingProfileDomain(domain: VoiceContextDomain) {
  return domain === "onboarding_profile";
}

export async function buildVoiceContext(
  userId: string,
  domain: VoiceContextDomain,
  memoryQuery = "",
  options: BuildVoiceContextOptions = {},
): Promise<VoiceDynamicVariables> {
  const [
    profileRows,
    medicationRows,
    careTeamRows,
    channelPreferenceRows,
    companionRows,
    socialInterestRows,
    latestReports,
    latestVitals,
    latestSignalReadings,
    medicationAdherenceRows,
    scheduledEventRows,
    checkinSessionRows,
    checkinScheduleRows,
    userRows,
    latestVoiceExchangeRows,
    recentActivityRows,
    recentSocialVisitRows,
    voiceExchangeCountRows,
    recommendationFeedbackRows,
    brainCoachSessionRows,
  ] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, userId)).limit(1),
    db.select().from(userMedications).where(eq(userMedications.user_id, userId)).limit(20),
    db.select().from(teamInvitations).where(eq(teamInvitations.senior_id, userId)).orderBy(desc(teamInvitations.created_at)).limit(10),
    db.select().from(userChannelPreferences).where(eq(userChannelPreferences.user_id, userId)).limit(1),
    db.select().from(companionProfiles).where(eq(companionProfiles.user_id, userId)).limit(1),
    db.select().from(socialUserInterests).where(eq(socialUserInterests.user_id, userId)).limit(1),
    db.select().from(triageReports).where(eq(triageReports.user_id, userId)).orderBy(desc(triageReports.created_at)).limit(5),
    db.select().from(vitalsReadings).where(eq(vitalsReadings.user_id, userId)).orderBy(desc(vitalsReadings.recorded_at)).limit(12),
    getLatestSignalReadings(userId).catch((err) => {
      console.warn("[voiceContext] signal readings unavailable", err);
      return [];
    }),
    db
      .select()
      .from(medicationAdherence)
      .where(and(eq(medicationAdherence.user_id, userId), gte(medicationAdherence.created_at, daysAgo(29))))
      .orderBy(desc(medicationAdherence.created_at))
      .limit(80),
    db.select().from(scheduledEvents).where(eq(scheduledEvents.user_id, userId)).orderBy(desc(scheduledEvents.scheduled_for)).limit(20),
    db.select().from(checkinSessions).where(eq(checkinSessions.user_id, userId)).orderBy(desc(checkinSessions.completed_at)).limit(5).catch((err) => {
      console.warn("[voiceContext] check-in sessions unavailable", err);
      return [];
    }),
    db
      .select()
      .from(scheduledInteractions)
      .where(and(
        eq(scheduledInteractions.user_id, userId),
        inArray(scheduledInteractions.interaction_type, ["CHECK_IN", "CHECKIN", "DAILY_CHECKIN"]),
      ))
      .orderBy(desc(scheduledInteractions.updated_at))
      .limit(5)
      .catch((err) => {
        console.warn("[voiceContext] check-in schedules unavailable", err);
        return [];
      }),
    db.select({ last_seen_at: users.last_seen_at }).from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(sessionExchanges).where(eq(sessionExchanges.user_id, userId)).orderBy(desc(sessionExchanges.created_at)).limit(1),
    db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.user_id, userId), gte(activityLogs.logged_at, daysAgo(13))))
      .orderBy(desc(activityLogs.logged_at))
      .limit(20),
    db.select().from(socialRoomVisits).where(eq(socialRoomVisits.user_id, userId)).orderBy(desc(socialRoomVisits.last_active_at)).limit(8),
    options.priorVoiceExchangeCount === undefined
      ? db.select({ value: count() }).from(sessionExchanges).where(eq(sessionExchanges.user_id, userId))
      : Promise.resolve([{ value: options.priorVoiceExchangeCount }]),
    getVoiceRecommendationFeedbackRows(userId),
    domain === "brain_coach"
      ? db
          .select()
          .from(cognitiveSessionIndex)
          .where(eq(cognitiveSessionIndex.userId, userId))
          .orderBy(desc(cognitiveSessionIndex.playedAt))
          .limit(300)
      : Promise.resolve([]),
  ]);

  const profile = profileRows[0] ?? null;
  const socialRoomIds = [...new Set(recentSocialVisitRows.map((visit) => String(visit.room_id)).filter(Boolean))];
  const socialRoomRows = socialRoomIds.length
    ? await db.select().from(socialRooms).where(inArray(socialRooms.id, socialRoomIds)).catch(() => [])
    : [];
  const socialRoomsById = new Map(socialRoomRows.map((room) => [String(room.id), room]));
  const consent = profile?.data_sharing_consent ?? {};
  const conditionsSection = section(consent, "conditions");
  const dietSection = section(consent, "diet");
  const devicesSection = section(consent, "devices");
  const hobbiesSection = section(consent, "hobbies");
  const providersSection = section(consent, "providers");
  const emergencySection = section(consent, "emergency");
  const cognitiveSection = section(consent, "cognitive");
  const communicationPreferencesSection = section(consent, "communication_preferences");

  const conditions = asStringArray(conditionsSection.health_conditions);
  const mobilityLevel = asString(conditionsSection.mobility_level);
  const livingSituation = asString(conditionsSection.living_situation);
  const allergies = profile?.known_allergies?.filter(Boolean) ?? [];
  const activeMedicationRows = medicationRows.filter((med) => med.active);
  const activeMeds = activeMedicationRows.map(formatMedication);
  const careTeam = careTeamRows.map(formatCareMember).filter(Boolean);
  const providers = formatProviders(providersSection);
  const devices = asStringArray(devicesSection.devices);
  const dietaryPreferences = asStringArray(dietSection.dietary_preferences);
  const dietaryNotes = asString(dietSection.dietary_notes);
  const { hobbies, detail: hobbyDetails } = formatHobbyDetails(hobbiesSection);
  const companion = companionRows[0];
  const socialInterests = socialInterestRows[0];
  const channelPrefs = channelPreferenceRows[0];
  const contactSupportMode = asString(communicationPreferencesSection.contact_support_mode);
  const contactSupportModeLabel = contactSupportMode === "human_supported" ? "Human-supported" : "AI-powered";
  const mem0UserId = profile?.mem0_user_id?.trim() || userId;
  const policyMemoryEnabled = domain === "health" && options.healthMemoryPolicy?.enabled === true;
  const policyMemory = policyMemoryEnabled
    ? await buildHealthPolicyFilteredMemoryBlock({
        userId,
        flowInstanceId: options.healthMemoryPolicy?.flowInstanceId,
        profileConsent: consent,
        env: options.healthMemoryPolicy?.env,
        store: options.healthMemoryPolicy?.store,
        now: options.healthMemoryPolicy?.now,
      }).catch(() => ({
        memoryBlock: "",
        reasonCodes: ["health_memory_policy_read_failed"],
        allowedCategories: [],
        flagReasonCode: "health_memory_policy_resolution_failed",
      }))
    : null;
  const useLegacyMem0 = !policyMemoryEnabled && shouldUseLegacyVoiceContextMem0(domain);
  const memories = useLegacyMem0 && memoryQuery
    ? await searchMemories(memoryQuery, mem0UserId).catch(() => [])
    : [];
  const memoryBlock = policyMemoryEnabled
    ? policyMemory?.memoryBlock ?? ""
    : formatMemoryBlock(memories);
  const recentHealthEvents = [
    ...latestReports.map(formatTriageReport),
    ...latestSignalReadings.slice(0, 8).map(formatSignalReading),
    ...latestVitals.map(formatVital),
  ].filter(Boolean);
  const latestSymptomReport = latestReports[0] ? formatTriageReportDetailed(latestReports[0]) : "";
  const recentSymptomReports = latestReports.map(formatTriageReportDetailed).filter(Boolean);
  const latestVitalsScanSummary = compactLines([
    latestSignalSummary(latestSignalReadings),
    latestVitalsScan(latestVitals),
  ], 1000);
  const vitalsTrend = compactLines([
    signalTrendSummary(latestSignalReadings),
    vitalsTrendSummary(latestVitals),
  ], 1200);
  const medicationAdherenceSummary = buildMedicationAdherenceSummary(
    activeMedicationRows,
    medicationAdherenceRows,
  );
  const medicationInteractionContext = buildMedicationInteractionContext(activeMeds, allergies);
  const { latestVisit, upcomingAppointment } = splitMedicalEvents(scheduledEventRows);
  const latestMedicalVisit = formatScheduledHealthEvent(latestVisit);
  const upcomingMedicalAppointment = formatScheduledHealthEvent(upcomingAppointment);
  const now = new Date();
  const checkinContext = buildCheckinContext({
    sessions: checkinSessionRows,
    schedules: checkinScheduleRows,
    now,
  });
  const todayPlanDate = now.toISOString().slice(0, 10);
  const [brainCoachPlanRow] = domain === "brain_coach"
    ? await db
        .select()
        .from(cognitiveDailyPlans)
        .where(and(
          eq(cognitiveDailyPlans.userId, userId),
          eq(cognitiveDailyPlans.planDate, todayPlanDate),
        ))
        .limit(1)
    : [];
  const brainCoachPlanItemRows = brainCoachPlanRow
    ? await db
        .select()
        .from(cognitiveDailyPlanItems)
        .where(eq(cognitiveDailyPlanItems.planId, brainCoachPlanRow.id))
        .orderBy(asc(cognitiveDailyPlanItems.sortOrder))
    : [];
  const persistedBrainCoachPlan = brainCoachPlanRow
    ? buildPersistedBrainCoachPlan(brainCoachPlanRow, brainCoachPlanItemRows)
    : null;
  const brainCoachVoiceContext = domain === "brain_coach"
    ? buildBrainCoachVoiceContext({
        sessions: brainCoachSessionRows,
        preferences: extractBrainCoachPreferences(consent),
        plan: persistedBrainCoachPlan,
        now,
      })
    : null;
  const userRow = userRows[0] ?? null;
  const latestVoiceExchange = latestVoiceExchangeRows[0] ?? null;
  const allHobbies = [...new Set([
    ...hobbies,
    ...(companion?.hobbies ?? []),
  ])];
  const allInterests = [...new Set([
    ...(companion?.interests ?? []),
    ...(socialInterests?.interest_tags ?? []),
  ])];
  const allPreferredActivities = [...new Set(companion?.preferred_activities ?? [])];
  const appLastSeenAt = userRow?.last_seen_at ?? null;
  const lastVoiceSessionAt = latestVoiceExchange?.created_at ?? null;
  const dateOfBirth = profile?.date_of_birth ?? "";
  const ageYears = ageFromDate(dateOfBirth, now);
  const birthday = birthdayContext(dateOfBirth, now);
  const upcomingEvents = formatUpcomingEvents(scheduledEventRows, now);
  const recentActivitySummary = formatRecentActivity(recentActivityRows);
  const socialActivitySummary = formatSocialActivity(recentSocialVisitRows, socialRoomsById);
  const matchingSocialRooms = matchingSocialRoomSuggestions(
    [...allInterests, ...allHobbies],
    socialInterests?.preferred_times ?? [],
  );
  const mobilityContext = valueList([mobilityLevel, livingSituation]);
  const localInterestOpportunities = buildLocalInterestOpportunities({
    city: profile?.city ?? "",
    region: profile?.region ?? "",
    interests: allInterests,
    hobbies: allHobbies,
    mobilityContext,
  });
  const recommendationFeedbackSummary = buildVoiceRecommendationFeedbackSummary(recommendationFeedbackRows);
  const nextBestConversation = buildNextBestConversation({
    domain,
    priorVoiceExchangeCount: Number(voiceExchangeCountRows[0]?.value ?? 0),
    profile,
    activeMedicationRows,
    medicationAdherenceRows,
    latestReports,
    latestVitals,
    latestVitalsScanSummary,
    upcomingAppointment,
    scheduledEventRows,
    appLastSeenAt,
    lastVoiceSessionAt,
    latestVoiceExchange,
    allHobbies,
    allInterests,
    allPreferredActivities,
    birthday,
    matchingSocialRooms,
    localInterestOpportunities,
    recentActivitySummary,
    socialActivitySummary,
    brainCoachVoiceContext,
    feedbackSummary: recommendationFeedbackSummary,
    now,
  });
  const relationshipContinuityContext = compactLines([
    appLastSeenAt ? `Last app visit: ${formatDateTime(appLastSeenAt)} (${formatRelativeTime(appLastSeenAt, now)}).` : "",
    lastVoiceSessionAt ? `Last VYVA voice session: ${formatDateTime(lastVoiceSessionAt)} (${formatRelativeTime(lastVoiceSessionAt, now)}).` : "",
    latestVoiceExchange?.agent_used
      ? `Last voice agent/topic: ${latestVoiceExchange.agent_used}${latestVoiceExchange.intent_classified ? ` / ${latestVoiceExchange.intent_classified}` : ""}.`
      : "",
    latestVoiceExchange?.message ? `Last user voice message: ${latestVoiceExchange.message.slice(0, 220)}.` : "",
  ], 1400);
  const preferenceContext = compactLines([
    allHobbies.length ? `Hobbies: ${joinList(allHobbies)}` : "",
    allInterests.length ? `Interests: ${joinList(allInterests)}` : "",
    companion?.values?.length ? `Values: ${joinList(companion.values)}` : "",
    allPreferredActivities.length ? `Preferred activities: ${joinList(allPreferredActivities)}` : "",
    socialInterests?.preferred_times?.length ? `Preferred social times: ${joinList(socialInterests.preferred_times)}` : "",
  ], 1600);
  const appInsightContext = compactLines([
    relationshipContinuityContext,
    preferenceContext,
    upcomingEvents.length ? `Upcoming events/reminders: ${joinList(upcomingEvents)}` : "",
    recentActivitySummary ? `Activity history: ${recentActivitySummary}` : "",
    brainCoachVoiceContext?.summary ? `Brain Coach context: ${brainCoachVoiceContext.summary}` : "",
    socialActivitySummary ? `Social activity: ${socialActivitySummary}` : "",
    matchingSocialRooms ? `Suggested social rooms: ${matchingSocialRooms}` : "",
    localInterestOpportunities ? `Nearby interest opportunities: ${localInterestOpportunities}` : "",
    birthday ? `Birthday context: ${birthday}` : "",
  ], 4200);
  const personalisationOpportunities = compactLines([
    latestVitalsScanSummary ? "If health is relevant, latest vitals context is available." : "",
    medicationAdherenceSummary ? "If medication is relevant, medication adherence context is available." : "",
    upcomingEvents.length ? "Offer help preparing for the next scheduled event if useful." : "",
    matchingSocialRooms ? "Offer one social room or companion activity that matches the user's interests." : "",
    localInterestOpportunities ? "Offer Concierge to verify a nearby event or place before naming specifics." : "",
    recentActivitySummary ? "Use recent activity to suggest a balanced movement, rest, or routine step." : "",
    brainCoachVoiceContext ? "Use today's Brain Coach plan and recent cognitive history when the user wants a brain activity." : "",
    birthday ? "Use birthday context warmly only when it feels natural." : "",
  ], 1400);
  const orchestratorContext = compactLines([
    relationshipContinuityContext,
    nextBestConversation.brief ? `Next best conversation:\n${nextBestConversation.brief}` : "",
    appInsightContext,
    personalisationOpportunities,
  ], 6000);
  const emergencyContact = valueList([
    asString(emergencySection.emergency_name),
    asString(emergencySection.emergency_phone),
    asString(emergencySection.emergency_role),
  ]);
  const priorVoiceExchangeCount = Number(voiceExchangeCountRows[0]?.value ?? 0);
  const conversationPlan = selectVoiceConversationPlan({
    domain,
    appEntrypoint: options.appEntrypoint ?? memoryQuery,
    priorVoiceExchangeCount,
  });
  const preferredLanguage = normalizeAppLanguage(profile?.language_preference ?? profile?.language, "en");

  const variables: VoiceDynamicVariables = {
    user_id: isOnboardingProfileDomain(domain) ? "app-managed-profile" : userId,
    agent_domain: domain,
    agent_operating_rules: isOnboardingProfileDomain(domain)
      ? [
          "You are inside VYVA onboarding profile collection.",
          "Use only the app-provided active_section_* variables and onboarding schema.",
          "Do not ask the user for account ID, profile ID, user ID, app IDs, API keys, or setup credentials.",
          "Do not tell the user to navigate elsewhere or open another app; the current page already provides the needed context.",
          "Return onboarding drafts only through the record_onboarding_profile_output client tool for local review.",
        ].join("\n")
      : buildAgentOperatingRules(domain),
    conversation_plan: isOnboardingProfileDomain(domain)
      ? "Collect details for the active onboarding section only, then return a local review draft. Never save profile data or request internal IDs."
      : formatConversationPlanPrompt(conversationPlan) || buildConversationPlan(domain),
    ...conversationPlanToVariables(conversationPlan),
    is_first_voice_session: priorVoiceExchangeCount === 0,
    prior_voice_exchange_count: priorVoiceExchangeCount,
    app_entrypoint: options.appEntrypoint ?? "",
    first_name: firstName(profile),
    preferred_name: profile?.preferred_name ?? "",
    full_name: profile?.full_name ?? "",
    date_of_birth: dateOfBirth,
    age_years: ageYears,
    birthday_context: birthday,
    preferred_language: preferredLanguage,
    timezone: profile?.timezone ?? "Europe/Madrid",
    city: profile?.city ?? "",
    country_code: profile?.country_code ?? "",
    onboarding_complete: Boolean(profile?.onboarding_complete),
    profile_summary: compactLines([
      `Name: ${profile?.preferred_name || profile?.full_name || "Not recorded"}`,
      `Language: ${preferredLanguage}`,
      ageYears ? `Age: ${ageYears}` : "",
      profile?.timezone ? `Timezone: ${profile.timezone}` : "",
      profile?.city || profile?.country_code ? `Location: ${valueList([profile.city, profile.country_code])}` : "",
    ], 900),
    memory_block: memoryBlock || "(no memory retrieved)",
    health_memory_policy_mode: policyMemoryEnabled
      ? "policy_filtered"
      : shouldUseLegacyVoiceContextMem0(domain)
      ? "legacy"
      : "sensitive_memory_disabled",
    health_memory_policy_reason_codes: policyMemory?.reasonCodes.join(",") ?? "",
    health_memory_policy_allowed_categories: policyMemory?.allowedCategories.join(",") ?? "",
    health_memory_policy_flag_reason: policyMemory?.flagReasonCode ?? "",
    last_app_visit_at: formatDateTime(appLastSeenAt),
    time_since_last_app_visit: formatRelativeTime(appLastSeenAt, now),
    last_voice_session_at: formatDateTime(lastVoiceSessionAt),
    time_since_last_voice_session: formatRelativeTime(lastVoiceSessionAt, now),
    last_visit_activity: relationshipContinuityContext,
    preference_context: preferenceContext,
    app_insight_context: appInsightContext,
    orchestrator_context: orchestratorContext,
    personalisation_opportunities: personalisationOpportunities,
    next_best_conversation: isOnboardingProfileDomain(domain) ? "" : nextBestConversation.brief,
    next_best_conversation_id: isOnboardingProfileDomain(domain) ? "" : nextBestConversation.top?.id ?? "",
    next_best_conversation_domain: isOnboardingProfileDomain(domain) ? "" : nextBestConversation.top?.domain ?? "",
    next_best_conversation_priority: isOnboardingProfileDomain(domain) ? "" : nextBestConversation.top?.priority ?? "",
    next_best_conversation_score: isOnboardingProfileDomain(domain) ? "" : nextBestConversation.top?.score ?? "",
    next_best_conversation_title: isOnboardingProfileDomain(domain) ? "" : nextBestConversation.top?.title ?? "",
    next_best_conversation_reason: isOnboardingProfileDomain(domain) ? "" : nextBestConversation.top?.reason ?? "",
    next_best_conversation_opening_cue: isOnboardingProfileDomain(domain) ? "" : nextBestConversation.top?.openingCue ?? "",
    next_best_conversation_suggested_action: isOnboardingProfileDomain(domain) ? "" : nextBestConversation.top?.suggestedAction ?? "",
    next_best_conversation_candidates: isOnboardingProfileDomain(domain) ? "" : nextBestConversation.candidateList,
    next_best_conversation_feedback: isOnboardingProfileDomain(domain) ? "" : recommendationFeedbackSummary.promptBlock,
    voice_recommendation_feedback_tool:
      isOnboardingProfileDomain(domain)
        ? "Unavailable in onboarding profile sessions. Do not call recommendation feedback tools."
        : "When the user clearly accepts, dismisses, or completes the recommended next step, call record_voice_recommendation_feedback with action accepted, dismissed, or completed. Do not mention the tool to the user.",
    voice_app_action_tool:
      isOnboardingProfileDomain(domain)
        ? "Unavailable in onboarding profile sessions. Do not call app navigation tools or ask the user to navigate."
        : "When the app should open a relevant page or show visual context, call open_app_action with domain, route or action_type, title, summary, cue, and reason. For a broad pillar request with no specific task, call open_app_action with only the matching domain: health for Health, brain_coach for Mind, social for Community, or concierge for Concierge. Do not invent a route or action_type; the app owns the correct visual destination. Use specific actions for medication reports, vitals, symptoms, concierge tasks, safety, brain activities, social rooms, and reports. For home-service requests such as plumber or electrician, ask the relevant service-specific questions first, then call open_app_action with action_type concierge.home_service and simple fields such as service_type, urgency, problem_summary, problem_type, criteria, and intake_origin=voice. Do not mention the tool to the user.",
    voice_action_result_tool:
      isOnboardingProfileDomain(domain)
        ? "Unavailable in onboarding profile sessions. Local review and save are app-owned."
        : "When the user accepts, dismisses, or completes an app-visible step, call record_action_result with action accepted, dismissed, or completed, plus action_id or recommendation_id when available. Do not mention the tool to the user.",
    voice_specialist_transfer_tool:
      isOnboardingProfileDomain(domain)
        ? "Unavailable in onboarding profile sessions. Stay on the current onboarding section unless urgent safety language requires safe escalation guidance."
        : "When the user needs another VYVA specialist, call request_specialist_transfer with domain safety, meds, health, doctor, concierge, brain_coach, social, or companion, plus a short reason and context_hint. Only transfer after a brief spoken handoff.",
    upcoming_events: joinList(upcomingEvents),
    recent_activity_summary: recentActivitySummary,
    social_activity_summary: socialActivitySummary,
    nearby_events_of_interest: localInterestOpportunities,
    matching_social_rooms: matchingSocialRooms,
  };

  if (domainAllows(domain, "social")) {
    variables.hobbies = joinList(allHobbies);
    variables.interests = joinList(allInterests);
    variables.values = joinList(companion?.values ?? []);
    variables.preferred_activities = joinList(allPreferredActivities);
    variables.social_context = compactLines([
      hobbyDetails,
      allInterests.length ? `Interests: ${joinList(allInterests)}` : "",
      companion?.values?.length ? `Values: ${joinList(companion.values)}` : "",
      allPreferredActivities.length ? `Preferred activities: ${joinList(allPreferredActivities)}` : "",
      socialInterests?.interest_tags?.length ? `Social room interests: ${joinList(socialInterests.interest_tags)}` : "",
      socialInterests?.preferred_times?.length ? `Preferred social times: ${joinList(socialInterests.preferred_times)}` : "",
      socialInterests?.activity_level ? `Activity level: ${socialInterests.activity_level}` : "",
      socialActivitySummary ? `Recent social activity: ${socialActivitySummary}` : "",
      matchingSocialRooms ? `Good-fit social rooms: ${matchingSocialRooms}` : "",
      localInterestOpportunities ? `Local interest opportunities: ${localInterestOpportunities}` : "",
    ], 1800);
  }

  if (domainAllows(domain, "logistics")) {
    variables.location_context = profileLocation(profile);
    variables.communication_preferences = compactLines([
      channelPrefs?.preferred_conversation_channel ? `Conversation: ${channelPrefs.preferred_conversation_channel}` : "",
      channelPrefs?.preferred_reminder_channel ? `Reminders: ${channelPrefs.preferred_reminder_channel}` : "",
      `Support mode: ${contactSupportModeLabel}`,
      channelPrefs?.voice_available_from || channelPrefs?.voice_available_until
        ? `Voice availability: ${channelPrefs?.voice_available_from ?? ""}-${channelPrefs?.voice_available_until ?? ""}`
        : "",
    ], 600);
    variables.providers = joinList(providers);
    variables.gp_details = valueList([profile?.gp_name, profile?.gp_phone, profile?.gp_email, profile?.gp_address]);
    variables.diet_context = valueList([dietaryNotes, dietaryPreferences.length ? dietaryPreferences.join(", ") : ""]);
    variables.mobility_context = mobilityContext;
  }

  if (domainAllows(domain, "medical")) {
    const careContext = compactLines([
      mobilityContext ? `Living/mobility: ${mobilityContext}` : "",
      careTeam.length ? `Care team: ${joinList(careTeam)}` : "",
      emergencyContact ? `Emergency contact: ${emergencyContact}` : "",
      contactSupportModeLabel ? `Support mode: ${contactSupportModeLabel}` : "",
    ], 1200);
    const healthProfileSummary = compactLines([
      conditions.length ? `Conditions: ${joinList(conditions)}` : "",
      allergies.length ? `Allergies: ${joinList(allergies)}` : "",
      activeMeds.length ? `Active medications: ${joinList(activeMeds)}` : "",
      careContext,
      valueList([profile?.gp_name, profile?.gp_phone, profile?.gp_email, profile?.gp_address]) ? `GP: ${valueList([profile?.gp_name, profile?.gp_phone, profile?.gp_email, profile?.gp_address])}` : "",
      providers.length ? `Providers: ${joinList(providers)}` : "",
      careTeam.length ? `Care team: ${joinList(careTeam)}` : "",
      devices.length ? `Connected devices: ${joinList(devices)}` : "",
      profile?.updated_at ? `Profile updated: ${formatDateTime(profile.updated_at)}` : "",
    ], 2200);
    const healthSessionContext = compactLines([
      healthProfileSummary,
      latestVitalsScanSummary ? `Latest vitals scan: ${latestVitalsScanSummary}` : "",
      vitalsTrend ? `Vitals trend: ${vitalsTrend}` : "",
      latestSymptomReport ? `Latest symptom report: ${latestSymptomReport}` : "",
      medicationAdherenceSummary ? `Medication adherence: ${medicationAdherenceSummary}` : "",
      checkinContext ? `Check-in context: ${checkinContext}` : "",
      latestMedicalVisit ? `Latest medical visit: ${latestMedicalVisit}` : "",
      upcomingMedicalAppointment ? `Upcoming medical appointment: ${upcomingMedicalAppointment}` : "",
      medicationInteractionContext ? `Medication interaction context: ${medicationInteractionContext}` : "",
    ], 5000);

    variables.health_profile_summary = healthProfileSummary || "No structured health profile has been recorded yet.";
    variables.health_conditions = joinList(conditions);
    variables.allergies = joinList(allergies);
    variables.medications = joinList(activeMeds);
    variables.care_context = careContext;
    variables.devices = joinList(devices);
    variables.recent_health_events = joinList(recentHealthEvents);
    variables.latest_vitals_scan = latestVitalsScanSummary;
    variables.latest_vitals_scan_at = latestVitals[0]?.recorded_at ? formatDateTime(latestVitals[0].recorded_at) : "";
    variables.vitals_trend = vitalsTrend;
    variables.latest_symptom_report = latestSymptomReport;
    variables.latest_symptom_report_at = latestReports[0]?.created_at ? formatDateTime(latestReports[0].created_at) : "";
    variables.recent_symptom_reports = joinList(recentSymptomReports);
    variables.medication_adherence_summary = medicationAdherenceSummary;
    variables.medication_interaction_context = medicationInteractionContext;
    variables.checkin_context = checkinContext;
    variables.latest_medical_visit = latestMedicalVisit;
    variables.upcoming_medical_appointment = upcomingMedicalAppointment;
    variables.medical_profile_last_updated = profile?.updated_at ? formatDateTime(profile.updated_at) : "";
    variables.emergency_contact = emergencyContact;
    variables.health_session_context = healthSessionContext;
    variables.health_context = compactLines([
      healthSessionContext,
      recentHealthEvents.length ? `Recent health events: ${joinList(recentHealthEvents)}` : "",
      dietaryNotes || dietaryPreferences.length ? `Diet: ${valueList([dietaryNotes, dietaryPreferences.join(", ")])}` : "",
    ], 6000) || "No health profile has been recorded for this user yet.";
  }

  if (domain === "brain_coach") {
    variables.cognitive_notes = asString(cognitiveSection.cognitive_notes);
    variables.brain_coach_state = brainCoachVoiceContext?.state ?? "new_user";
    variables.brain_coach_plan_id = brainCoachVoiceContext?.planId ?? "";
    variables.brain_coach_plan_complete = brainCoachVoiceContext?.planComplete ?? false;
    variables.brain_coach_context = brainCoachVoiceContext?.summary ?? "No Brain Coach history is available yet.";
    variables.brain_coach_recent_history = brainCoachVoiceContext?.recentHistory ?? "No completed Brain Coach activities are recorded yet.";
    variables.brain_coach_plan = brainCoachVoiceContext?.planPrompt ?? "";
    variables.brain_coach_recommended_activity_prompt = brainCoachVoiceContext?.recommendedActivityPrompt ?? "";
    variables.brain_coach_recommended_activity_title = brainCoachVoiceContext?.firstRecommendedActivityTitle ?? "";
    variables.brain_coach_recommended_activity_route = brainCoachVoiceContext?.firstRecommendedActivityRoute ?? "";
    variables.brain_coach_recommended_plan_item_id = brainCoachVoiceContext?.firstRecommendedPlanItemId ?? "";
    variables.brain_coach_missed_session_awareness = brainCoachVoiceContext?.missedSessionAwareness ?? "";
    variables.brain_coach_streak_awareness = brainCoachVoiceContext?.streakAwareness ?? "";
    variables.brain_coach_completed_yesterday = brainCoachVoiceContext?.completedYesterday ?? "";
    variables.brain_coach_plan_estimated_minutes = brainCoachVoiceContext?.plan.estimatedDurationMinutes ?? 0;
    variables.brain_coach_plan_completion = brainCoachVoiceContext
      ? `${brainCoachVoiceContext.plan.completion.completedCount}/${brainCoachVoiceContext.plan.completion.totalCount} recommended activities completed today`
      : "";
  }

  if (domainAllows(domain, "safety")) {
    variables.emergency_contact = emergencyContact;
    variables.care_team = joinList(careTeam);
    variables.safety_context = criticalSafetyContext({
      profile,
      conditions,
      allergies,
      emergencyContact,
      careTeam,
    });
  }

  return variables;
}
