import { desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  profiles,
  teamInvitations,
  triageReports,
  userMedications,
  vitalsReadings,
} from "../../shared/schema.js";

type JsonRecord = Record<string, unknown>;
export type DoctorMedicalProfileVariables = Record<string, string>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(asString).filter(Boolean)
    : [];
}

function joinList(values: string[], fallback = "Not recorded"): string {
  return values.length > 0 ? values.slice(0, 10).join(", ") : fallback;
}

function addLine(lines: string[], label: string, value: string | null | undefined) {
  const clean = value?.trim();
  if (clean) lines.push(`${label}: ${clean}`);
}

function section(consent: unknown, key: string): JsonRecord {
  return asRecord(asRecord(consent)[key]);
}

function buildDoctorHealthContext(input: {
  profile: typeof profiles.$inferSelect;
  medications: Array<typeof userMedications.$inferSelect>;
  careTeam: Array<typeof teamInvitations.$inferSelect>;
  latestReports: Array<typeof triageReports.$inferSelect>;
  latestVitals: Array<typeof vitalsReadings.$inferSelect>;
}): DoctorMedicalProfileVariables {
  const { profile, medications, careTeam, latestReports, latestVitals } = input;
  const consent = asRecord(profile.data_sharing_consent);
  const conditions = asStringArray(section(consent, "conditions").health_conditions);
  const hobbies = asStringArray(section(consent, "hobbies").hobbies);
  const devices = asStringArray(section(consent, "devices").devices);
  const dietaryNotes = asString(section(consent, "diet").dietary_notes);
  const dietaryPreferences = asStringArray(section(consent, "diet").dietary_preferences);
  const emergency = section(consent, "emergency");

  const activeMedicationLines = medications.map((med) => {
    const details = [med.dosage, med.frequency, med.scheduled_times?.join("/")].filter(Boolean);
    return details.length > 0
      ? `${med.medication_name} (${details.join(", ")})`
      : med.medication_name;
  });

  const careTeamLines = careTeam.map((member) =>
    [
      member.invitee_name,
      member.relationship,
      member.role,
      member.status ? `status ${member.status}` : "",
    ].filter(Boolean).join(" - "),
  );

  const latestReportLines = latestReports.map((report) =>
    [
      report.chief_complaint,
      report.urgency ? `urgency ${report.urgency}` : "",
      report.symptoms?.length ? `symptoms ${report.symptoms.join(", ")}` : "",
    ].filter(Boolean).join(" - "),
  );

  const latestVitalLines = latestVitals.map((vital) =>
    [
      vital.metric_type ?? "vital",
      vital.value ??
        [
          vital.bpm ? `${vital.bpm} bpm` : "",
          vital.respiratory_rate ? `${vital.respiratory_rate} breaths/min` : "",
        ].filter(Boolean).join(", "),
    ].filter(Boolean).join(": "),
  );

  const lines: string[] = [];
  addLine(lines, "Name", profile.preferred_name || profile.full_name || "Not recorded");
  addLine(lines, "Date of birth", profile.date_of_birth);
  addLine(lines, "Language", profile.language);
  addLine(lines, "Timezone", profile.timezone);
  addLine(lines, "Phone", profile.phone_number);
  addLine(lines, "Location", [profile.city, profile.region, profile.country_code].filter(Boolean).join(", "));
  addLine(lines, "Health conditions", joinList(conditions));
  addLine(lines, "Known allergies", joinList(profile.known_allergies ?? []));
  addLine(lines, "Active medications", joinList(activeMedicationLines));
  addLine(lines, "GP", [profile.gp_name, profile.gp_phone, profile.gp_address].filter(Boolean).join(" - ") || "Not recorded");
  addLine(lines, "Emergency contact", [asString(emergency.emergency_name), asString(emergency.emergency_phone), asString(emergency.emergency_role)].filter(Boolean).join(" - "));
  addLine(lines, "Care team", joinList(careTeamLines));
  addLine(lines, "Devices", joinList(devices));
  addLine(lines, "Diet", [dietaryNotes, dietaryPreferences.length ? dietaryPreferences.join(", ") : ""].filter(Boolean).join(" - "));
  addLine(lines, "Hobbies/interests", joinList(hobbies));
  addLine(lines, "Recent symptom reports", joinList(latestReportLines));
  addLine(lines, "Recent vitals", joinList(latestVitalLines));
  addLine(lines, "Context generated", new Date().toISOString());

  return {
    health_context: lines.join("\n").slice(0, 6000),
    health_conditions: joinList(conditions, ""),
    allergies: joinList(profile.known_allergies ?? [], ""),
    medications: joinList(activeMedicationLines, ""),
    gp_details: [profile.gp_name, profile.gp_phone, profile.gp_address].filter(Boolean).join(" - "),
    care_team: joinList(careTeamLines, ""),
    emergency_contact: [asString(emergency.emergency_name), asString(emergency.emergency_phone), asString(emergency.emergency_role)].filter(Boolean).join(" - "),
    recent_health_events: joinList([...latestReportLines, ...latestVitalLines], ""),
  };
}

export async function getDoctorMedicalProfileVariables(
  userId: string,
): Promise<DoctorMedicalProfileVariables> {
  const [profileRows, medications, careTeam, latestReports, latestVitals] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, userId)).limit(1),
    db
      .select()
      .from(userMedications)
      .where(eq(userMedications.user_id, userId))
      .limit(20),
    db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.senior_id, userId))
      .orderBy(desc(teamInvitations.created_at))
      .limit(10),
    db
      .select()
      .from(triageReports)
      .where(eq(triageReports.user_id, userId))
      .orderBy(desc(triageReports.created_at))
      .limit(3),
    db
      .select()
      .from(vitalsReadings)
      .where(eq(vitalsReadings.user_id, userId))
      .orderBy(desc(vitalsReadings.recorded_at))
      .limit(3),
  ]);

  const profile = profileRows[0];
  if (!profile) {
    return {
      health_context: "No health profile has been recorded for this user yet.",
      health_conditions: "",
      allergies: "",
      medications: "",
      gp_details: "",
      care_team: "",
      emergency_contact: "",
      recent_health_events: "",
    };
  }

  return buildDoctorHealthContext({
    profile,
    medications: medications.filter((med) => med.active),
    careTeam,
    latestReports,
    latestVitals,
  });
}
