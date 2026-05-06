import { desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  companionProfiles,
  profiles,
  socialUserInterests,
  teamInvitations,
  triageReports,
  userChannelPreferences,
  userMedications,
  vitalsReadings,
} from "../../shared/schema.js";
import { formatMemoryBlock, searchMemories } from "./mem0.js";

export type VoiceContextDomain =
  | "safety"
  | "meds"
  | "health"
  | "concierge"
  | "brain_coach"
  | "companion"
  | "doctor"
  | "social";

export type VoiceDynamicVariables = Record<string, string | number | boolean>;
export type ConversationTurn = { role: "user" | "assistant"; content: string };

type JsonRecord = Record<string, unknown>;

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

export async function buildVoiceContext(
  userId: string,
  domain: VoiceContextDomain,
  memoryQuery = "",
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
  ] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, userId)).limit(1),
    db.select().from(userMedications).where(eq(userMedications.user_id, userId)).limit(20),
    db.select().from(teamInvitations).where(eq(teamInvitations.senior_id, userId)).orderBy(desc(teamInvitations.created_at)).limit(10),
    db.select().from(userChannelPreferences).where(eq(userChannelPreferences.user_id, userId)).limit(1),
    db.select().from(companionProfiles).where(eq(companionProfiles.user_id, userId)).limit(1),
    db.select().from(socialUserInterests).where(eq(socialUserInterests.user_id, userId)).limit(1),
    db.select().from(triageReports).where(eq(triageReports.user_id, userId)).orderBy(desc(triageReports.created_at)).limit(3),
    db.select().from(vitalsReadings).where(eq(vitalsReadings.user_id, userId)).orderBy(desc(vitalsReadings.recorded_at)).limit(3),
  ]);

  const profile = profileRows[0] ?? null;
  const consent = profile?.data_sharing_consent ?? {};
  const conditionsSection = section(consent, "conditions");
  const dietSection = section(consent, "diet");
  const devicesSection = section(consent, "devices");
  const hobbiesSection = section(consent, "hobbies");
  const providersSection = section(consent, "providers");
  const emergencySection = section(consent, "emergency");
  const cognitiveSection = section(consent, "cognitive");

  const conditions = asStringArray(conditionsSection.health_conditions);
  const mobilityLevel = asString(conditionsSection.mobility_level);
  const livingSituation = asString(conditionsSection.living_situation);
  const allergies = profile?.known_allergies?.filter(Boolean) ?? [];
  const activeMeds = medicationRows.filter((med) => med.active).map(formatMedication);
  const careTeam = careTeamRows.map(formatCareMember).filter(Boolean);
  const providers = formatProviders(providersSection);
  const devices = asStringArray(devicesSection.devices);
  const dietaryPreferences = asStringArray(dietSection.dietary_preferences);
  const dietaryNotes = asString(dietSection.dietary_notes);
  const { hobbies, detail: hobbyDetails } = formatHobbyDetails(hobbiesSection);
  const companion = companionRows[0];
  const socialInterests = socialInterestRows[0];
  const channelPrefs = channelPreferenceRows[0];
  const mem0UserId = profile?.mem0_user_id?.trim() || userId;
  const memories = memoryQuery
    ? await searchMemories(memoryQuery, mem0UserId).catch(() => [])
    : [];
  const memoryBlock = formatMemoryBlock(memories);
  const recentHealthEvents = [
    ...latestReports.map(formatTriageReport),
    ...latestVitals.map(formatVital),
  ].filter(Boolean);
  const emergencyContact = valueList([
    asString(emergencySection.emergency_name),
    asString(emergencySection.emergency_phone),
    asString(emergencySection.emergency_role),
  ]);

  const variables: VoiceDynamicVariables = {
    user_id: userId,
    agent_domain: domain,
    first_name: firstName(profile),
    preferred_name: profile?.preferred_name ?? "",
    full_name: profile?.full_name ?? "",
    preferred_language: profile?.language ?? "en",
    timezone: profile?.timezone ?? "Europe/Madrid",
    city: profile?.city ?? "",
    country_code: profile?.country_code ?? "",
    onboarding_complete: Boolean(profile?.onboarding_complete),
    profile_summary: compactLines([
      `Name: ${profile?.preferred_name || profile?.full_name || "Not recorded"}`,
      `Language: ${profile?.language ?? "en"}`,
      profile?.timezone ? `Timezone: ${profile.timezone}` : "",
      profile?.city || profile?.country_code ? `Location: ${valueList([profile.city, profile.country_code])}` : "",
    ], 900),
    memory_block: memoryBlock || "(no memory retrieved)",
  };

  if (domainAllows(domain, "social")) {
    variables.hobbies = joinList([...new Set([
      ...hobbies,
      ...(companion?.hobbies ?? []),
    ])]);
    variables.interests = joinList([...new Set([
      ...(companion?.interests ?? []),
      ...(socialInterests?.interest_tags ?? []),
    ])]);
    variables.values = joinList(companion?.values ?? []);
    variables.preferred_activities = joinList(companion?.preferred_activities ?? []);
    variables.social_context = compactLines([
      hobbyDetails,
      companion?.interests?.length ? `Interests: ${joinList(companion.interests)}` : "",
      companion?.values?.length ? `Values: ${joinList(companion.values)}` : "",
      companion?.preferred_activities?.length ? `Preferred activities: ${joinList(companion.preferred_activities)}` : "",
      socialInterests?.interest_tags?.length ? `Social room interests: ${joinList(socialInterests.interest_tags)}` : "",
      socialInterests?.preferred_times?.length ? `Preferred social times: ${joinList(socialInterests.preferred_times)}` : "",
      socialInterests?.activity_level ? `Activity level: ${socialInterests.activity_level}` : "",
    ], 1800);
  }

  if (domainAllows(domain, "logistics")) {
    variables.location_context = profileLocation(profile);
    variables.communication_preferences = compactLines([
      channelPrefs?.preferred_conversation_channel ? `Conversation: ${channelPrefs.preferred_conversation_channel}` : "",
      channelPrefs?.preferred_reminder_channel ? `Reminders: ${channelPrefs.preferred_reminder_channel}` : "",
      channelPrefs?.voice_available_from || channelPrefs?.voice_available_until
        ? `Voice availability: ${channelPrefs?.voice_available_from ?? ""}-${channelPrefs?.voice_available_until ?? ""}`
        : "",
    ], 600);
    variables.providers = joinList(providers);
    variables.gp_details = valueList([profile?.gp_name, profile?.gp_phone, profile?.gp_address]);
    variables.diet_context = valueList([dietaryNotes, dietaryPreferences.length ? dietaryPreferences.join(", ") : ""]);
    variables.mobility_context = valueList([mobilityLevel, livingSituation]);
  }

  if (domainAllows(domain, "medical")) {
    variables.health_conditions = joinList(conditions);
    variables.allergies = joinList(allergies);
    variables.medications = joinList(activeMeds);
    variables.devices = joinList(devices);
    variables.recent_health_events = joinList(recentHealthEvents);
    variables.health_context = compactLines([
      conditions.length ? `Health conditions: ${joinList(conditions)}` : "",
      allergies.length ? `Known allergies: ${joinList(allergies)}` : "",
      activeMeds.length ? `Active medications: ${joinList(activeMeds)}` : "",
      valueList([profile?.gp_name, profile?.gp_phone, profile?.gp_address]) ? `GP: ${valueList([profile?.gp_name, profile?.gp_phone, profile?.gp_address])}` : "",
      providers.length ? `Providers: ${joinList(providers)}` : "",
      careTeam.length ? `Care team: ${joinList(careTeam)}` : "",
      devices.length ? `Devices: ${joinList(devices)}` : "",
      recentHealthEvents.length ? `Recent health events: ${joinList(recentHealthEvents)}` : "",
      dietaryNotes || dietaryPreferences.length ? `Diet: ${valueList([dietaryNotes, dietaryPreferences.join(", ")])}` : "",
    ], 4000);
  }

  if (domain === "brain_coach") {
    variables.cognitive_notes = asString(cognitiveSection.cognitive_notes);
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
