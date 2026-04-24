export function deriveCompletedSections(
  profile: Record<string, unknown> | null,
  state: Record<string, unknown> | null
): Set<string> {
  const completed = new Set<string>();

  if (!profile && !state) return completed;

  if (profile?.full_name) {
    completed.add("basics");
  }

  if (profile?.address_line_1 || profile?.city) {
    completed.add("contact");
  }

  if (state?.has_health_conditions) {
    completed.add("health");
  }

  if (state?.has_medications) {
    completed.add("medications");
  }

  const allergies = profile?.known_allergies;
  if (Array.isArray(allergies) && allergies.length > 0) {
    completed.add("allergies");
  }

  if (state?.has_gp_details) {
    completed.add("gp");
  }

  const consent = profile?.data_sharing_consent as Record<string, unknown> | null | undefined;
  const providers = consent?.providers;
  if (Array.isArray(providers) && providers.length > 0) {
    completed.add("providers");
  }

  if (state?.has_caregiver || state?.has_family_member || state?.has_doctor) {
    completed.add("care-team");
  }

  const consentHobbies = (profile?.data_sharing_consent as Record<string, unknown> | null | undefined)?.hobbies as Record<string, unknown> | null | undefined;
  const hobbies = consentHobbies?.hobbies;
  if (Array.isArray(hobbies) && hobbies.length > 0) {
    completed.add("hobbies");
  }

  if (state?.has_emergency_address) {
    completed.add("emergency");
  }

  return completed;
}

const CORE_SECTIONS = [
  "basics",
  "contact",
  "health",
  "medications",
  "allergies",
  "gp",
  "providers",
  "care-team",
  "emergency",
];

export function isProfileComplete(
  profile: Record<string, unknown> | null,
  state: Record<string, unknown> | null
): boolean {
  const completed = deriveCompletedSections(profile, state);
  return CORE_SECTIONS.every((s) => completed.has(s));
}
