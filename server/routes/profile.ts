import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq, count, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import {
  profiles,
  profileMemberships,
  users,
  sessionState,
  sessionExchanges,
  agentDifficulty,
  caregiverAlerts,
  medicationAdherence,
  scheduledEventLogs,
  scheduledEvents,
  activityLogs,
  dailyStepLogs,
  onboardingState,
  consentLog,
  teamInvitations,
  userChannelIdentity,
  userChannelPreferences,
  billingEvents,
  scamChecks,
  homeScans,
  woundScans,
  companionProfiles,
  companionConnections,
  socialRoomVisits,
  socialUserInterests,
  socialConnections,
  triageReports,
  vitalsReadings,
  userIntakes,
  accessLinks,
  lifecycleEvents,
  consentAttempts,
  communicationsLog,
  userProviders,
  conciergePending,
  conciergeSessions,
  conciergeReminders,
  utilityReviewRuns,
  conciergeRecommendationFeedback,
  userMedications,
  scheduledInteractions,
  interactionLogs,
  consentAuditLogs,
} from "../../shared/schema.js";
import { getDoctorMedicalProfileVariables } from "../lib/doctorMedicalProfile.js";
import { signMedicalProfileToolToken } from "../lib/jwt.js";
import { syncProfileEntitlement } from "../lib/entitlementSync.js";
import { entitlementForTier } from "../lib/plans.js";
import { mergeIdentityGender, readProfileGender } from "../lib/userPersonalization.js";
import { getActiveProfileContext, getProfileChoices, isMissingAccountProfileLinkColumnError } from "../lib/profileAccess.js";
import { isLocalDevelopmentRequest } from "../lib/requestEnvironment.js";
import {
  selectProfileIdByEmailFromDatabaseColumns,
  selectProfileIdByPhoneDigitsFromDatabaseColumns,
  selectProfileRowsByDatabaseColumns,
  type ProfileReadColumn,
} from "../lib/profileReadCompatibility.js";
import { upsertProfileToleratingMissingColumns } from "../lib/profileWriteCompatibility.js";
import {
  savedProviderContactReadiness,
  savedProviderIsTrusted,
} from "../../shared/conciergeSavedProviders.js";

const DEMO_USER_ID = "demo-user";
const SUPPORTED_PROFILE_LANGUAGES = ["es", "en", "fr", "de", "it", "pt"] as const;
type ProfileLanguage = (typeof SUPPORTED_PROFILE_LANGUAGES)[number];

const router = Router();

function normalizeProfileLanguage(value: unknown): ProfileLanguage {
  if (typeof value !== "string") return "es";
  const language = value.trim().toLowerCase().split("-")[0];
  return SUPPORTED_PROFILE_LANGUAGES.includes(language as ProfileLanguage)
    ? language as ProfileLanguage
    : "es";
}

function resolvedProfileLanguage(profile: { language?: string | null; language_preference?: string | null }): ProfileLanguage {
  return normalizeProfileLanguage(profile.language_preference ?? profile.language);
}

function trimToNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProfilePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/[^\d+]/g, "");
  const normalized = compact.startsWith("00")
    ? `+${compact.slice(2).replace(/\D/g, "")}`
    : trimmed.startsWith("+")
      ? `+${compact.slice(1).replace(/\D/g, "")}`
      : compact.replace(/\D/g, "");
  const digits = normalized.replace(/\D/g, "");
  if (!digits) return null;
  return normalized.startsWith("+") ? `+${digits}` : digits;
}

function phoneDigits(value: string | null | undefined): string | null {
  const normalized = normalizeProfilePhone(value);
  const digits = normalized?.replace(/\D/g, "") ?? "";
  return digits || null;
}

function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

function knownEmails(...values: unknown[]): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const value of values) {
    const email = trimToNull(value);
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }
  return emails;
}

function includesEmail(emails: string[], value: string | null | undefined): boolean {
  return emails.some((email) => sameEmail(email, value));
}

function profileEmailForAccount(accountEmails: string[], value: string | null | undefined): string | null {
  const email = trimToNull(value);
  return includesEmail(accountEmails, email) ? null : email;
}

function firstNameFromProfileName(value: string | null | undefined): string {
  return trimToNull(value)?.split(/\s+/)[0] ?? "";
}

function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = phoneDigits(a);
  const right = phoneDigits(b);
  return Boolean(left && right && left === right);
}

function isMissingColumnError(err: unknown, column: string): boolean {
  const error = err as { code?: unknown; message?: unknown };
  const message = typeof error.message === "string" ? error.message : String(err);
  return (
    message.includes(`column "${column}" does not exist`) ||
    message.includes(`column profiles.${column} does not exist`) ||
    message.includes(`column "profiles"."${column}" does not exist`)
  );
}

function withoutLanguagePreference<T extends Record<string, unknown>>(values: T): Omit<T, "language_preference"> {
  const { language_preference: _languagePreference, ...rest } = values;
  return rest;
}

function isUniqueViolation(err: unknown, hints: string[]): boolean {
  const error = err as { code?: unknown; constraint?: unknown; detail?: unknown; message?: unknown };
  if (error.code !== "23505") return false;
  const text = `${error.constraint ?? ""} ${error.detail ?? ""} ${error.message ?? ""}`.toLowerCase();
  return hints.some((hint) => text.includes(hint.toLowerCase()));
}

/**
 * Returns the authenticated user's ID if a valid JWT was present (set by
 * authMiddleware), or the demo-user fallback in non-production environments.
 * In production, unauthenticated callers receive null (→ 401) to prevent
 * unintended reads/writes on shared demo-profile data.
 */
async function resolveUserId(req: Request): Promise<string | null> {
  if (req.user?.id) {
    const context = await getActiveProfileContext(req.user.id);
    if (context.profileId) return context.profileId;
    if (isLocalDevelopmentRequest(req)) return req.user.id;
    return null;
  }
  if (isLocalDevelopmentRequest(req)) return DEMO_USER_ID;
  return null;
}

const profileBodySchema = z.object({
  firstName:       z.string().min(1).max(100),
  lastName:        z.string().max(100).optional().default(""),
  preferredName:   z.string().max(100).optional().default(""),
  dateOfBirth:     z.string().max(50).optional().or(z.literal("")).optional(),
  gender:          z.string().max(40).optional().default("prefer_not"),
  email:           z.string().email().optional().or(z.literal("")).optional(),
  phone:           z.string().trim().min(1, "Phone is required").max(50),
  whatsapp:        z.string().max(50).optional().default(""),
  country:         z.string().max(100).optional().default(""),
  timezone:        z.string().max(100).optional().default(""),
  language:        z.string().max(50).optional(),
  street:          z.string().max(200).optional().default(""),
  cityState:       z.string().max(200).optional().default(""),
  postalCode:      z.string().max(30).optional().default(""),
  caregiverName:   z.string().max(150).optional().default(""),
  caregiverContact: z.string().max(50).optional().default(""),
  gpName:          z.string().max(150).optional(),
  gpPhone:         z.string().max(50).optional(),
  gpEmail:         z.string().email().optional().or(z.literal("")).optional(),
});

const scheduledEventBodySchema = z.object({
  event_type: z.string().min(1).default("custom"),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  channel: z.string().min(1).default("app"),
  agent_id: z.string().optional().nullable(),
  agent_slug: z.string().optional().nullable(),
  room_slug: z.string().optional().nullable(),
  scheduled_for: z.string().min(1),
  timezone: z.string().min(1).default("Europe/Madrid"),
  recurrence: z.string().min(1).default("none"),
  status: z.string().min(1).default("upcoming"),
  source: z.string().min(1).default("app"),
  metadata: z.record(z.unknown()).optional().default({}),
});

const contactChannelSchema = z.enum(["voice_outbound", "whatsapp_outbound", "voice_app"]);
type ContactChannel = z.infer<typeof contactChannelSchema>;

const contactChannelValues: ContactChannel[] = ["voice_outbound", "whatsapp_outbound", "voice_app"];
const contactSupportModeSchema = z.enum(["ai_powered", "human_supported"]);
type ContactSupportMode = z.infer<typeof contactSupportModeSchema>;

const channelPreferenceTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format");
const channelPreferenceLimitSchema = z.number().int().min(0).nullable();

const channelPreferencesPatchSchema = z.object({
  preferred_checkin_channel: contactChannelSchema.optional(),
  preferred_reminder_channel: contactChannelSchema.optional(),
  support_mode: contactSupportModeSchema.optional(),
  voice_available_from: channelPreferenceTimeSchema.optional(),
  voice_available_until: channelPreferenceTimeSchema.optional(),
  whatsapp_available_from: channelPreferenceTimeSchema.optional(),
  whatsapp_available_until: channelPreferenceTimeSchema.optional(),
  max_outbound_calls_per_day: channelPreferenceLimitSchema.optional(),
  max_whatsapp_messages_per_day: channelPreferenceLimitSchema.optional(),
  concierge_task_notifications_enabled: z.boolean().optional(),
  medication_refill_push_enabled: z.boolean().optional(),
  preventive_web_push_enabled: z.boolean().optional(),
});

const coveragePatchSchema = z.object({
  coverageType: z.enum(["public", "private", "mixed", "self_pay", "unknown"]).default("public"),
  provider: z.string().max(160).optional().default(""),
  memberId: z.string().max(160).optional().default(""),
  plan: z.string().max(160).optional().default(""),
  notes: z.string().max(500).optional().default(""),
});

type ChannelPreferencesRow = typeof userChannelPreferences.$inferSelect;

const channelPreferencesDefaults = {
  preferred_checkin_channel: "voice_outbound" as ContactChannel,
  preferred_reminder_channel: "whatsapp_outbound" as ContactChannel,
  support_mode: "ai_powered" as ContactSupportMode,
  voice_available_from: "08:00",
  voice_available_until: "21:00",
  whatsapp_available_from: "07:00",
  whatsapp_available_until: "22:00",
  max_outbound_calls_per_day: 1,
  max_whatsapp_messages_per_day: 5,
  concierge_task_notifications_enabled: true,
  medication_refill_push_enabled: false,
  preventive_web_push_enabled: false,
};

function normalizeContactChannel(value: unknown, fallback: ContactChannel): ContactChannel {
  return contactChannelValues.includes(value as ContactChannel) ? value as ContactChannel : fallback;
}

function normalizeContactSupportMode(value: unknown, fallback: ContactSupportMode): ContactSupportMode {
  return value === "human_supported" || value === "ai_powered" ? value : fallback;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readContactSupportMode(consent: unknown): ContactSupportMode {
  const communication = objectRecord(objectRecord(consent).communication_preferences);
  return normalizeContactSupportMode(communication.contact_support_mode, channelPreferencesDefaults.support_mode);
}

function mergeContactSupportMode(consent: unknown, supportMode: ContactSupportMode): Record<string, unknown> {
  const current = objectRecord(consent);
  const communication = objectRecord(current.communication_preferences);

  return {
    ...current,
    communication_preferences: {
      ...communication,
      contact_support_mode: supportMode,
    },
  };
}

function serializeChannelPreferences(row?: ChannelPreferencesRow | null, consent?: unknown) {
  return {
    preferred_checkin_channel: normalizeContactChannel(
      row?.preferred_checkin_channel,
      channelPreferencesDefaults.preferred_checkin_channel,
    ),
    preferred_reminder_channel: normalizeContactChannel(
      row?.preferred_reminder_channel,
      channelPreferencesDefaults.preferred_reminder_channel,
    ),
    support_mode: readContactSupportMode(consent),
    voice_available_from: row?.voice_available_from ?? channelPreferencesDefaults.voice_available_from,
    voice_available_until: row?.voice_available_until ?? channelPreferencesDefaults.voice_available_until,
    whatsapp_available_from: row?.whatsapp_available_from ?? channelPreferencesDefaults.whatsapp_available_from,
    whatsapp_available_until: row?.whatsapp_available_until ?? channelPreferencesDefaults.whatsapp_available_until,
    max_outbound_calls_per_day:
      row && row.max_outbound_calls_per_day !== undefined
        ? row.max_outbound_calls_per_day
        : channelPreferencesDefaults.max_outbound_calls_per_day,
    max_whatsapp_messages_per_day:
      row && row.max_whatsapp_messages_per_day !== undefined
        ? row.max_whatsapp_messages_per_day
        : channelPreferencesDefaults.max_whatsapp_messages_per_day,
    concierge_task_notifications_enabled:
      row?.concierge_task_notifications_enabled
      ?? channelPreferencesDefaults.concierge_task_notifications_enabled,
    medication_refill_push_enabled:
      row?.medication_refill_push_enabled
      ?? channelPreferencesDefaults.medication_refill_push_enabled,
    preventive_web_push_enabled:
      row?.preventive_web_push_enabled
      ?? channelPreferencesDefaults.preventive_web_push_enabled,
  };
}

function medicationEventsFromRows(rows: Array<typeof userMedications.$inferSelect>) {
  return rows.flatMap((med) => {
    const times = med.scheduled_times?.length ? med.scheduled_times : [];
    return times.map((time, index) => ({
      id: `medication:${med.id}:${index}`,
      user_id: med.user_id,
      event_type: "medication_reminder",
      title: med.medication_name,
      description: med.dosage ? `${med.dosage}${med.frequency ? ` - ${med.frequency}` : ""}` : med.frequency ?? "",
      channel: "app",
      agent_id: null,
      agent_slug: null,
      room_slug: null,
      scheduled_for: null,
      display_time: time,
      timezone: "profile",
      recurrence: med.frequency ?? "daily",
      status: med.active ? "recurring" : "paused",
      source: "medication_schedule",
      source_session_id: null,
      metadata: { medication_id: med.id, read_only: true },
      created_at: med.created_at,
      updated_at: med.created_at,
      read_only: true,
    }));
  });
}

type MissingSetupStep = {
  section: string;
  path: string;
  reason: string;
};

type ServiceGate = {
  ready: boolean;
  missing: MissingSetupStep[];
  recommended?: MissingSetupStep[];
};

type SavedProviderSummary = {
  name: string;
  role: string;
  category: string;
  phone: string;
  email: string;
  whatsapp: string;
  bookingUrl: string;
  preferredChannel: string;
  canContactAfterConfirmation: boolean;
  address: string;
  websiteUrl: string;
  notes: string;
  isTrusted: boolean;
  isDefault: boolean;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function consentSection(consent: unknown, section: string): Record<string, unknown> {
  if (!consent || typeof consent !== "object") return {};
  const value = (consent as Record<string, unknown>)[section];
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readCoverageSummary(consent: unknown) {
  const coverage = {
    ...consentSection(consent, "insurance"),
    ...consentSection(consent, "coverage"),
  };
  const coverageType = trimToNull(coverage.coverage_type) ?? trimToNull(coverage.type) ?? "";
  const provider = trimToNull(coverage.provider) ?? trimToNull(coverage.insurer) ?? trimToNull(coverage.company) ?? "";
  const memberId = trimToNull(coverage.member_id) ?? trimToNull(coverage.policy_number) ?? "";
  return {
    coverageType,
    provider,
    memberId,
    plan: trimToNull(coverage.plan) ?? "",
    notes: trimToNull(coverage.notes) ?? "",
  };
}

function setupStep(section: string, reason: string): MissingSetupStep {
  return {
    section,
    path: `/onboarding/profile/${section}`,
    reason,
  };
}

function subscriptionStep(feature: string): MissingSetupStep {
  return {
    section: "subscription",
    path: "/settings/subscription",
    reason: `Your current plan does not include ${feature}.`,
  };
}

function accountAccessStep(): MissingSetupStep {
  return {
    section: "account",
    path: "/settings/subscription",
    reason: "Account access is disabled. Ask an admin to enable app access for this profile.",
  };
}

function gate(ready: boolean, missing: MissingSetupStep[], recommended?: MissingSetupStep[]): ServiceGate {
  return {
    ready,
    missing: ready ? [] : missing,
    ...(recommended?.length ? { recommended } : {}),
  };
}

function entitlementGate(enabled: boolean, feature: string, nextGate: ServiceGate = gate(true, [])): ServiceGate {
  if (!enabled) return gate(false, [subscriptionStep(feature)]);
  return nextGate;
}

function accountGate(enabled: boolean, nextGate: ServiceGate): ServiceGate {
  if (!enabled) return gate(false, [accountAccessStep()]);
  return nextGate;
}

function savedProvidersFromConsent(consent: unknown): SavedProviderSummary[] {
  const providersSection = consentSection(consent, "providers");
  const providers = Array.isArray(providersSection.providers)
    ? providersSection.providers
    : [];

  return providers.flatMap((value) => {
    const provider = objectRecord(value);
    const name = trimToNull(provider.name);
    const role = trimToNull(provider.role) ?? "";
    const category = trimToNull(provider.category) ?? role;
    const phone = trimToNull(provider.phone) ?? "";
    const email = trimToNull(provider.email) ?? "";
    const whatsapp = trimToNull(provider.whatsapp) ?? "";
    const bookingUrl = trimToNull(provider.booking_url) ?? trimToNull(provider.online_order_url) ?? "";
    const preferredChannel = trimToNull(provider.preferred_channel) ?? "";
    const canContactAfterConfirmation = provider.can_contact_after_confirmation === true;
    const address = trimToNull(provider.address) ?? "";
    const websiteUrl = trimToNull(provider.website_uri) ?? "";
    const notes = trimToNull(provider.notes) ?? "";
    const isTrusted = provider.is_trusted !== false;
    const isDefault = provider.is_default === true;
    if (!name && !role && !category) return [];
    return [{
      name: name ?? category,
      role,
      category,
      phone,
      email,
      whatsapp,
      bookingUrl,
      preferredChannel,
      canContactAfterConfirmation,
      address,
      websiteUrl,
      notes,
      isTrusted,
      isDefault,
    }];
  });
}

function providerMatches(provider: SavedProviderSummary, terms: string[]): boolean {
  if (!savedProviderIsTrusted(provider) || !savedProviderContactReadiness(provider).conciergeUsable) return false;
  const searchable = [provider.role, provider.category, provider.name]
    .join(" ")
    .toLowerCase();
  return terms.some((term) => searchable.includes(term));
}

function hasCoverageInfo(consent: unknown): boolean {
  const coverage = {
    ...consentSection(consent, "insurance"),
    ...consentSection(consent, "coverage"),
  };
  const coverageType = trimToNull(coverage.coverage_type) ?? trimToNull(coverage.type);
  const hasMeaningfulType = Boolean(
    coverageType && !["unknown", "not_sure", "not sure"].includes(coverageType.toLowerCase()),
  );
  return [
    coverage.provider,
    coverage.insurer,
    coverage.company,
    coverage.policy_number,
    coverage.member_id,
    coverage.plan,
  ].some(hasText) || hasMeaningfulType;
}

function buildProfileServiceSignals(profile?: {
  data_sharing_consent?: unknown;
  email?: unknown;
  phone_number?: unknown;
  whatsapp_number?: unknown;
  gp_name?: unknown;
  gp_phone?: unknown;
  gp_email?: unknown;
} | null) {
  const consent = profile?.data_sharing_consent;
  const providers = savedProvidersFromConsent(consent);
  const conditions = consentSection(consent, "conditions");
  const hasSavedPharmacy = providers.some((provider) =>
    providerMatches(provider, ["pharmacy", "drugstore", "chemist", "farmacia"]),
  );
  const hasSavedDoctor =
    hasText(profile?.gp_name) ||
    hasText(profile?.gp_phone) ||
    hasText(profile?.gp_email) ||
    providers.some((provider) =>
      providerMatches(provider, ["doctor", "medical_clinic", "clinic", "hospital", "gp"]),
    );
  const hasSavedTransportProvider = providers.some((provider) =>
    providerMatches(provider, ["taxi", "transport", "car_service", "ride", "driver"]),
  );
  const hasPreferredContactMethod =
    hasText(profile?.phone_number) ||
    hasText(profile?.whatsapp_number) ||
    hasText(profile?.email);

  return {
    hasSavedPharmacy,
    hasSavedDoctor,
    hasSavedTransportProvider,
    hasMobilityInfo: hasText(conditions.mobility_level),
    hasCoverageInfo: hasCoverageInfo(consent),
    hasPreferredContactMethod,
    savedProviders: providers,
  };
}

function hasUsableMedication(med: typeof userMedications.$inferSelect): boolean {
  return (
    hasText(med.medication_name) &&
    (
      hasText(med.dosage) ||
      hasText(med.frequency) ||
      (Array.isArray(med.scheduled_times) && med.scheduled_times.some(hasText))
    )
  );
}

const activeProfileSchema = z.object({
  profileId: z.string().min(1),
});

router.get("/linked-profiles", async (req: Request, res: Response) => {
  const accountUserId = req.user?.id;
  if (!accountUserId) return res.status(401).json({ error: "Not authenticated" });

  const context = await getActiveProfileContext(accountUserId);
  const choices = await getProfileChoices(accountUserId);

  return res.json({
    activeProfileId: context.profileId,
    activeProfileRole: context.role,
    profileCount: context.profileCount,
    needsProfileSetup: context.needsProfileSetup,
    needsProfileSelection: context.needsProfileSelection,
    profiles: choices,
  });
});

router.post("/active-profile", async (req: Request, res: Response) => {
  const accountUserId = req.user?.id;
  if (!accountUserId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = activeProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Profile selection is required" });
  }

  const choices = await getProfileChoices(accountUserId);
  const selected = choices.find((choice) => choice.profileId === parsed.data.profileId);
  if (!selected) {
    return res.status(403).json({ error: "This profile is not linked to your account." });
  }

  const now = new Date();
  await db
    .update(profileMemberships)
    .set({ is_primary: false, updated_at: now })
    .where(eq(profileMemberships.user_id, accountUserId));

  await db
    .update(profileMemberships)
    .set({ is_primary: true, updated_at: now })
    .where(and(
      eq(profileMemberships.user_id, accountUserId),
      eq(profileMemberships.profile_id, selected.profileId),
      eq(profileMemberships.status, "active"),
    ));

  try {
    await db
      .update(users)
      .set({ active_profile_id: selected.profileId })
      .where(eq(users.id, accountUserId));
  } catch (err) {
    if (!isMissingAccountProfileLinkColumnError(err)) throw err;
    console.warn("[profile] users.active_profile_id is missing; selected profile is stored via profile_memberships only.");
  }

  return res.json({
    ok: true,
    activeProfileId: selected.profileId,
    activeProfileRole: selected.role,
  });
});

router.get("/readiness", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const accountUserId = req.user?.id ?? null;

  try {
    const [profileRows, medications] = await Promise.all([
      db.select()
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1),
      db.select()
        .from(userMedications)
        .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
    ]);

    const profile = profileRows[0] ?? null;
    const emergency = consentSection(profile?.data_sharing_consent, "emergency");
    const conditions = consentSection(profile?.data_sharing_consent, "conditions");
    const healthConditions = Array.isArray(conditions.health_conditions)
      ? conditions.health_conditions.filter(hasText)
      : [];

    const hasBasics = hasText(profile?.full_name);
    const hasContact = hasText(profile?.phone_number) || hasText(profile?.whatsapp_number) || hasText(profile?.email);
    const hasDetailedAddress = (
      hasText(profile?.address_line_1) &&
      hasText(profile?.city) &&
      hasText(profile?.postcode) &&
      hasText(profile?.country_code)
    );
    const hasLocalAddress = hasText(profile?.city) && (hasText(profile?.country_code) || hasText(profile?.postcode));
    const hasEmergencyContact = hasText(emergency.emergency_name) && hasText(emergency.emergency_phone);
    const hasMedicationForServices = medications.some(hasUsableMedication);
    const hasAnyMedication = medications.some((med) => hasText(med.medication_name));
    const hasHealthContext = healthConditions.length > 0;
    const hasAllergies = Array.isArray(profile?.known_allergies) && profile.known_allergies.some(hasText);
    const hasGp = hasText(profile?.gp_name) || hasText(profile?.gp_phone) || hasText(profile?.gp_email);
    const profileSignals = buildProfileServiceSignals(profile);
    const subscriptionSync = await syncProfileEntitlement({
      profile,
      profileId: profile?.id ?? userId,
      accountUserId,
      repairProfile: true,
      repairChannel: "system",
      repairTrigger: "profile_readiness",
    });
    const effectiveTier = subscriptionSync.effectiveTier;
    const effectiveStatus = subscriptionSync.effectiveStatus;
    const entitlements = await entitlementForTier(effectiveTier);
    const accountEnabled = profile?.account_status !== "disabled";

    const medicationMissing = [
      setupStep("medications", "To make medication reminders and reports work, add at least one medication first."),
    ];
    const addressMissing = [
      setupStep("address", "To use this safely, add your home address first."),
    ];
    const sosMissing = [
      ...(!hasDetailedAddress ? addressMissing : []),
      ...(!hasEmergencyContact ? [setupStep("emergency", "To use SOS safely, add an emergency contact first.")] : []),
    ];
    const doctorMissing = [
      ...(!hasBasics ? [setupStep("basics", "To start a doctor call, add the user's basic profile details first.")] : []),
      ...(!hasContact ? [setupStep("basics", "To start a doctor call, add a phone number or contact method first.")] : []),
    ];
    const doctorRecommended = [
      ...(!hasHealthContext ? [setupStep("health", "Add health conditions so the doctor agent has better context.")] : []),
      ...(!hasMedicationForServices ? [setupStep("medications", "Add medications so the doctor agent can consider them.")] : []),
      ...(!hasAllergies ? [setupStep("allergies", "Add allergies so recommendations stay safer.")] : []),
      ...(!hasGp ? [setupStep("gp", "Add GP details in case follow-up is needed.")] : []),
    ];
    const pharmacyMissing = [
      setupStep("providers", "Add a saved pharmacy before VYVA helps with pharmacy items."),
    ];
    const appointmentMissing = [
      ...(!hasBasics ? [setupStep("basics", "Add the user's basic details before VYVA handles appointment booking.")] : []),
      ...(!hasContact ? [setupStep("basics", "Add a phone number, email, or WhatsApp before VYVA handles appointment booking.")] : []),
    ];
    const appointmentRecommended = [
      ...(!hasHealthContext ? [setupStep("health", "Add health conditions so VYVA can prepare better appointment context.")] : []),
      ...(!hasMedicationForServices ? [setupStep("medications", "Add medications so VYVA can mention them when relevant.")] : []),
      ...(!hasAllergies ? [setupStep("allergies", "Add allergies so appointment notes stay safer.")] : []),
      ...(!hasGp ? [setupStep("gp", "Add GP details if this should use a regular doctor.")] : []),
      ...(!profileSignals.hasCoverageInfo ? [setupStep("insurance", "Add insurance or coverage details if appointments may depend on them.")] : []),
    ];
    const medicationGate = gate(hasMedicationForServices, medicationMissing);
    const voiceEnabled = true;
    const medicationEnabled = Boolean(entitlements?.is_active && entitlements.medication_tracking);
    const symptomCheckEnabled = true;
    const conciergeEnabled = Boolean(entitlements?.is_active && entitlements.concierge);
    const caregiverDashboardEnabled = Boolean(entitlements?.is_active && entitlements.caregiver_dashboard);

    return res.json({
      profile: {
        accountUserId,
        id: profile?.id ?? null,
        exists: !!profile,
        subscriptionTier: effectiveTier,
        subscriptionStatus: effectiveStatus ?? null,
        storedSubscriptionTier: subscriptionSync.storedProfileTier,
        lifecycleSubscriptionTier: subscriptionSync.lifecycleSubscriptionTier,
        lifecycleSubscriptionStatus: subscriptionSync.lifecycleSubscriptionStatus,
        billingSubscriptionTier: subscriptionSync.billingSubscriptionTier,
        billingSubscriptionStatus: subscriptionSync.billingSubscriptionStatus,
        subscriptionTierMismatch: subscriptionSync.profileTierMismatch,
        entitlementRepaired: subscriptionSync.repaired,
        accountStatus: profile?.account_status ?? null,
        accountEnabled,
        hasBasics,
        hasContact,
        hasDetailedAddress,
        hasLocalAddress,
        hasEmergencyContact,
        hasMedicationForServices,
        hasAnyMedication,
        hasHealthContext,
        hasAllergies,
        hasGp,
        hasSavedPharmacy: profileSignals.hasSavedPharmacy,
        hasSavedDoctor: profileSignals.hasSavedDoctor,
        hasSavedTransportProvider: profileSignals.hasSavedTransportProvider,
        hasMobilityInfo: profileSignals.hasMobilityInfo,
        hasCoverageInfo: profileSignals.hasCoverageInfo,
        hasPreferredContactMethod: profileSignals.hasPreferredContactMethod,
        savedProviders: profileSignals.savedProviders,
      },
      services: {
        medications: accountGate(accountEnabled, entitlementGate(medicationEnabled, "medication tracking", medicationGate)),
        adherenceReport: accountGate(accountEnabled, entitlementGate(medicationEnabled, "medication tracking", medicationGate)),
        medicationReminders: accountGate(accountEnabled, entitlementGate(medicationEnabled, "medication tracking", medicationGate)),
        medicationInteractions: accountGate(accountEnabled, entitlementGate(medicationEnabled, "medication tracking", medicationGate)),
        sos: accountGate(accountEnabled, gate(hasDetailedAddress && hasEmergencyContact, sosMissing)),
        doctor: accountGate(accountEnabled, gate(hasBasics && hasContact, doctorMissing, doctorRecommended)),
        localServices: accountGate(accountEnabled, gate(hasLocalAddress, addressMissing)),
        specialistFinder: accountGate(accountEnabled, gate(hasLocalAddress, addressMissing)),
        pharmacyOtc: accountGate(accountEnabled, entitlementGate(conciergeEnabled, "concierge", gate(profileSignals.hasSavedPharmacy, pharmacyMissing))),
        transport: accountGate(accountEnabled, entitlementGate(conciergeEnabled, "concierge", gate(hasLocalAddress, addressMissing))),
        medicalAppointments: accountGate(accountEnabled, entitlementGate(conciergeEnabled, "concierge", gate(hasBasics && hasContact, appointmentMissing, appointmentRecommended))),
        reports: accountGate(accountEnabled, gate(true, [])),
        concierge: accountGate(accountEnabled, entitlementGate(conciergeEnabled, "concierge")),
        socialRooms: accountGate(accountEnabled, gate(true, [])),
        activities: accountGate(accountEnabled, gate(true, [])),
        brainTraining: accountGate(accountEnabled, gate(true, [])),
        chat: accountGate(accountEnabled, entitlementGate(voiceEnabled, "the voice assistant")),
        symptomCheck: accountGate(accountEnabled, entitlementGate(symptomCheckEnabled, "symptom checks")),
        caregiverDashboard: accountGate(accountEnabled, entitlementGate(caregiverDashboardEnabled, "the caregiver dashboard")),
      },
    });
  } catch (err) {
    console.error("[profile GET /readiness]", err);
    return res.status(500).json({ error: "Failed to fetch profile readiness" });
  }
});

router.get("/export", async (req: Request, res: Response) => {
  const profileId = await resolveUserId(req);
  if (!profileId) return res.status(401).json({ error: "Not authenticated" });

  const accountUserId = req.user?.id ?? null;
  const userIds = Array.from(new Set([profileId, accountUserId].filter(Boolean))) as string[];
  const sectionErrors: Array<{ section: string; message: string }> = [];

  try {
    const sendExportPayload = (exportedAt: string, exportPayload: unknown) => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="vyva-data-export-${exportedAt.slice(0, 10)}.json"`);
      res.setHeader("Cache-Control", "no-store");
      return res.send(JSON.stringify(exportPayload, null, 2));
    };

    const emptyExportData = () => ({
      account: [],
      profile: [],
      profile_memberships: [],
      onboarding: [],
      consent: {
        consent_log: [],
        care_team_invitations: [],
      },
      communication_preferences: {
        channel_identities: [],
        channel_preferences: [],
      },
      conversations: {
        session_state: [],
        session_exchanges: [],
        agent_difficulty: [],
        caregiver_alerts: [],
      },
      health: {
        medications: [],
        medication_adherence: [],
        triage_reports: [],
        vitals_readings: [],
        wound_scans: [],
      },
      activity: {
        activity_logs: [],
        daily_step_logs: [],
      },
      safety_and_reviews: {
        scam_checks: [],
        home_scans: [],
        utility_review_runs: [],
      },
      social: {
        companion_profiles: [],
        companion_connections: [],
        social_room_visits: [],
        social_user_interests: [],
        social_connections: [],
      },
      concierge: {
        user_providers: [],
        pending_actions: [],
        sessions: [],
        reminders: [],
        recommendation_feedback: [],
      },
      scheduling: {
        scheduled_events: [],
        scheduled_event_logs: [],
        scheduled_interactions: [],
        interaction_logs: [],
        consent_audit_logs: [],
      },
      lifecycle: {
        intakes: [],
        access_links: [],
        lifecycle_events: [],
        consent_attempts: [],
        communications_log: [],
      },
      billing: {
        billing_events: [],
      },
    });

    const safeRows = async <T>(section: string, query: PromiseLike<T[]>): Promise<T[]> => {
      try {
        return await query;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Export section failed";
        sectionErrors.push({ section, message });
        console.error(`[profile GET /export] ${section}`, err);
        return [];
      }
    };

    const exportedAt = new Date().toISOString();
    let preflightError: string | null = null;
    const preflight = db.select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1)
      .then(() => true)
      .catch((err) => {
        preflightError = err instanceof Error ? err.message : "Database connection failed";
        return false;
      });
    const databaseAvailable = await Promise.race([
      preflight,
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 2500)),
    ]);

    if (!databaseAvailable) {
      const databaseMessage = preflightError ?? "Database did not respond in time";
      if (IS_PROD) {
        return res.status(503).json({
          error: "Profile database is temporarily unavailable. Please try again shortly.",
        });
      }

      sectionErrors.push({
        section: "database",
        message: databaseMessage,
      });

      return sendExportPayload(exportedAt, {
        exported_at: exportedAt,
        export_version: 1,
        profile_id: profileId,
        account_user_id: accountUserId,
        partial: true,
        section_errors: sectionErrors,
        note: "VYVA could not reach the profile database while creating this export. Password hashes, reset tokens, internal secrets, and third-party service keys are intentionally excluded from exports.",
        data: emptyExportData(),
      });
    }

    const [
      accountRows,
      profileRows,
      membershipRows,
      sessionRows,
      exchangeRows,
      difficultyRows,
      alertRows,
      medicationRows,
      adherenceRows,
      activityRows,
      stepRows,
      onboardingRows,
      consentRows,
      invitationRows,
      channelIdentityRows,
      channelPreferenceRows,
      billingRows,
      scamRows,
      homeScanRows,
      woundRows,
      companionProfileRows,
      companionConnectionRows,
      socialVisitRows,
      socialInterestRows,
      socialConnectionRows,
      triageRows,
      vitalRows,
      intakeRows,
      accessLinkRows,
      lifecycleRows,
      consentAttemptRows,
      communicationRows,
      providerRows,
      conciergePendingRows,
      conciergeSessionRows,
      conciergeReminderRows,
      utilityReviewRows,
      recommendationFeedbackRows,
      scheduledRows,
      scheduledLogRows,
      scheduledInteractionRows,
      interactionLogRows,
      consentAuditRows,
    ] = await Promise.all([
      accountUserId
        ? safeRows("account", db.select({
            id: users.id,
            email: users.email,
            phone_number: users.phone_number,
            active_profile_id: users.active_profile_id,
            onboarding_intent: users.onboarding_intent,
            last_seen_at: users.last_seen_at,
            created_at: users.created_at,
          }).from(users).where(eq(users.id, accountUserId)))
        : Promise.resolve([]),
      safeRows("profile", db.select().from(profiles).where(eq(profiles.id, profileId))),
      safeRows("profile_memberships", db.select().from(profileMemberships).where(or(
        inArray(profileMemberships.user_id, userIds),
        eq(profileMemberships.profile_id, profileId),
      ))),
      safeRows("session_state", db.select().from(sessionState).where(inArray(sessionState.user_id, userIds))),
      safeRows("session_exchanges", db.select().from(sessionExchanges).where(inArray(sessionExchanges.user_id, userIds))),
      safeRows("agent_difficulty", db.select().from(agentDifficulty).where(inArray(agentDifficulty.user_id, userIds))),
      safeRows("caregiver_alerts", db.select().from(caregiverAlerts).where(inArray(caregiverAlerts.user_id, userIds))),
      safeRows("medications", db.select().from(userMedications).where(inArray(userMedications.user_id, userIds))),
      safeRows("medication_adherence", db.select().from(medicationAdherence).where(inArray(medicationAdherence.user_id, userIds))),
      safeRows("activity_logs", db.select().from(activityLogs).where(inArray(activityLogs.user_id, userIds))),
      safeRows("daily_step_logs", db.select().from(dailyStepLogs).where(inArray(dailyStepLogs.user_id, userIds))),
      safeRows("onboarding_state", db.select().from(onboardingState).where(inArray(onboardingState.user_id, userIds))),
      safeRows("consent_log", db.select().from(consentLog).where(inArray(consentLog.user_id, userIds))),
      safeRows("team_invitations", db.select().from(teamInvitations).where(or(
        inArray(teamInvitations.senior_id, userIds),
        inArray(teamInvitations.accepted_user_id, userIds),
      ))),
      safeRows("channel_identities", db.select().from(userChannelIdentity).where(inArray(userChannelIdentity.user_id, userIds))),
      safeRows("channel_preferences", db.select().from(userChannelPreferences).where(inArray(userChannelPreferences.user_id, userIds))),
      safeRows("billing_events", db.select().from(billingEvents).where(inArray(billingEvents.user_id, userIds))),
      safeRows("scam_checks", db.select().from(scamChecks).where(inArray(scamChecks.user_id, userIds))),
      safeRows("home_scans", db.select().from(homeScans).where(inArray(homeScans.user_id, userIds))),
      safeRows("wound_scans", db.select().from(woundScans).where(inArray(woundScans.user_id, userIds))),
      safeRows("companion_profiles", db.select().from(companionProfiles).where(inArray(companionProfiles.user_id, userIds))),
      safeRows("companion_connections", db.select().from(companionConnections).where(or(
        inArray(companionConnections.requester_id, userIds),
        inArray(companionConnections.recipient_id, userIds),
      ))),
      safeRows("social_room_visits", db.select().from(socialRoomVisits).where(inArray(socialRoomVisits.user_id, userIds))),
      safeRows("social_user_interests", db.select().from(socialUserInterests).where(inArray(socialUserInterests.user_id, userIds))),
      safeRows("social_connections", db.select().from(socialConnections).where(or(
        inArray(socialConnections.user_id_a, userIds),
        inArray(socialConnections.user_id_b, userIds),
      ))),
      safeRows("triage_reports", db.select().from(triageReports).where(inArray(triageReports.user_id, userIds))),
      safeRows("vitals_readings", db.select().from(vitalsReadings).where(inArray(vitalsReadings.user_id, userIds))),
      safeRows("user_intakes", db.select().from(userIntakes).where(or(
        inArray(userIntakes.user_id, userIds),
        inArray(userIntakes.elder_user_id, userIds),
        inArray(userIntakes.family_user_id, userIds),
      ))),
      safeRows("access_links", db.select().from(accessLinks).where(inArray(accessLinks.user_id, userIds))),
      safeRows("lifecycle_events", db.select().from(lifecycleEvents).where(inArray(lifecycleEvents.user_id, userIds))),
      safeRows("consent_attempts", db.select().from(consentAttempts).where(or(
        inArray(consentAttempts.elder_user_id, userIds),
        inArray(consentAttempts.family_user_id, userIds),
      ))),
      safeRows("communications_log", db.select().from(communicationsLog).where(inArray(communicationsLog.user_id, userIds))),
      safeRows("user_providers", db.select().from(userProviders).where(inArray(userProviders.user_id, userIds))),
      safeRows("concierge_pending", db.select().from(conciergePending).where(inArray(conciergePending.user_id, userIds))),
      safeRows("concierge_sessions", db.select().from(conciergeSessions).where(inArray(conciergeSessions.user_id, userIds))),
      safeRows("concierge_reminders", db.select().from(conciergeReminders).where(inArray(conciergeReminders.user_id, userIds))),
      safeRows("utility_review_runs", db.select().from(utilityReviewRuns).where(inArray(utilityReviewRuns.user_id, userIds))),
      safeRows("recommendation_feedback", db.select().from(conciergeRecommendationFeedback).where(inArray(conciergeRecommendationFeedback.user_id, userIds))),
      safeRows("scheduled_events", db.select().from(scheduledEvents).where(inArray(scheduledEvents.user_id, userIds))),
      safeRows("scheduled_event_logs", db.select().from(scheduledEventLogs).where(inArray(scheduledEventLogs.user_id, userIds))),
      safeRows("scheduled_interactions", db.select().from(scheduledInteractions).where(inArray(scheduledInteractions.user_id, userIds))),
      safeRows("interaction_logs", db.select().from(interactionLogs).where(inArray(interactionLogs.user_id, userIds))),
      safeRows("consent_audit_logs", db.select().from(consentAuditLogs).where(inArray(consentAuditLogs.user_id, userIds))),
    ]);

    const exportPayload = {
      exported_at: exportedAt,
      export_version: 1,
      profile_id: profileId,
      account_user_id: accountUserId,
      partial: sectionErrors.length > 0,
      section_errors: sectionErrors,
      note: "Password hashes, reset tokens, internal secrets, and third-party service keys are intentionally excluded from this export.",
      data: {
        account: accountRows,
        profile: profileRows,
        profile_memberships: membershipRows,
        onboarding: onboardingRows,
        consent: {
          consent_log: consentRows,
          care_team_invitations: invitationRows,
        },
        communication_preferences: {
          channel_identities: channelIdentityRows,
          channel_preferences: channelPreferenceRows,
        },
        conversations: {
          session_state: sessionRows,
          session_exchanges: exchangeRows,
          agent_difficulty: difficultyRows,
          caregiver_alerts: alertRows,
        },
        health: {
          medications: medicationRows,
          medication_adherence: adherenceRows,
          triage_reports: triageRows,
          vitals_readings: vitalRows,
          wound_scans: woundRows,
        },
        activity: {
          activity_logs: activityRows,
          daily_step_logs: stepRows,
        },
        safety_and_reviews: {
          scam_checks: scamRows,
          home_scans: homeScanRows,
          utility_review_runs: utilityReviewRows,
        },
        social: {
          companion_profiles: companionProfileRows,
          companion_connections: companionConnectionRows,
          social_room_visits: socialVisitRows,
          social_user_interests: socialInterestRows,
          social_connections: socialConnectionRows,
        },
        concierge: {
          user_providers: providerRows,
          pending_actions: conciergePendingRows,
          sessions: conciergeSessionRows,
          reminders: conciergeReminderRows,
          recommendation_feedback: recommendationFeedbackRows,
        },
        scheduling: {
          scheduled_events: scheduledRows,
          scheduled_event_logs: scheduledLogRows,
          scheduled_interactions: scheduledInteractionRows,
          interaction_logs: interactionLogRows,
          consent_audit_logs: consentAuditRows,
        },
        lifecycle: {
          intakes: intakeRows,
          access_links: accessLinkRows,
          lifecycle_events: lifecycleRows,
          consent_attempts: consentAttemptRows,
          communications_log: communicationRows,
        },
        billing: {
          billing_events: billingRows,
        },
      },
    };

    return sendExportPayload(exportedAt, exportPayload);
  } catch (err) {
    console.error("[profile GET /export]", err);
    return res.status(500).json({ error: "Failed to export profile data" });
  }
});

router.get("/channel-preferences", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [channelRows, profileRows] = await Promise.all([
      db
        .select()
        .from(userChannelPreferences)
        .where(eq(userChannelPreferences.user_id, userId))
        .limit(1),
      db
        .select({ data_sharing_consent: profiles.data_sharing_consent })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1),
    ]);

    return res.json(serializeChannelPreferences(channelRows[0], profileRows[0]?.data_sharing_consent));
  } catch (error) {
    console.error("[profile] failed to load channel preferences", error);
    return res.status(500).json({ error: "Unable to load channel preferences" });
  }
});

router.patch("/channel-preferences", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = channelPreferencesPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const {
    support_mode,
    preventive_web_push_enabled: _preventiveWebPushEnabled,
    medication_refill_push_enabled: _medicationRefillPushEnabled,
    ...channelData
  } = parsed.data;
  const channelUpdates = Object.fromEntries(
    Object.entries(channelData).filter(([, value]) => value !== undefined),
  );
  const hasChannelUpdates = Object.keys(channelUpdates).length > 0;
  const hasSupportModeUpdate = support_mode !== undefined;

  try {
    if (!hasChannelUpdates && !hasSupportModeUpdate) {
      const [channelRows, profileRows] = await Promise.all([
        db
          .select()
          .from(userChannelPreferences)
          .where(eq(userChannelPreferences.user_id, userId))
          .limit(1),
        db
          .select({ data_sharing_consent: profiles.data_sharing_consent })
          .from(profiles)
          .where(eq(profiles.id, userId))
          .limit(1),
      ]);
      return res.json(serializeChannelPreferences(channelRows[0], profileRows[0]?.data_sharing_consent));
    }

    let row: ChannelPreferencesRow | undefined;
    let dataSharingConsent: unknown;

    if (hasChannelUpdates) {
      [row] = await db
        .insert(userChannelPreferences)
        .values({ user_id: userId, ...channelUpdates })
        .onConflictDoUpdate({
          target: userChannelPreferences.user_id,
          set: { ...channelUpdates, updated_at: new Date() },
        })
        .returning();
    } else {
      const rows = await db
        .select()
        .from(userChannelPreferences)
        .where(eq(userChannelPreferences.user_id, userId))
        .limit(1);
      row = rows[0];
    }

    if (hasSupportModeUpdate) {
      const [existingProfile] = await db
        .select({ data_sharing_consent: profiles.data_sharing_consent })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      dataSharingConsent = mergeContactSupportMode(existingProfile?.data_sharing_consent, support_mode);

      await db
        .insert(profiles)
        .values({ id: userId, data_sharing_consent: dataSharingConsent })
        .onConflictDoUpdate({
          target: profiles.id,
          set: { data_sharing_consent: dataSharingConsent, updated_at: new Date() },
        });
    } else {
      const [profileRow] = await db
        .select({ data_sharing_consent: profiles.data_sharing_consent })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      dataSharingConsent = profileRow?.data_sharing_consent;
    }

    return res.json(serializeChannelPreferences(row, dataSharingConsent));
  } catch (error) {
    console.error("[profile] failed to save channel preferences", error);
    return res.status(500).json({ error: "Unable to save channel preferences" });
  }
});

router.patch("/coverage", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = coveragePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  try {
    const [profileRow] = await db
      .select({ data_sharing_consent: profiles.data_sharing_consent })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    const currentConsent = objectRecord(profileRow?.data_sharing_consent);
    const existingCoverage = objectRecord(currentConsent.coverage);
    const now = new Date();
    const provider = trimToNull(parsed.data.provider) ?? "";
    const nextConsent = {
      ...currentConsent,
      coverage: {
        ...existingCoverage,
        coverage_type: parsed.data.coverageType,
        provider,
        insurer: provider,
        member_id: trimToNull(parsed.data.memberId) ?? "",
        plan: trimToNull(parsed.data.plan) ?? "",
        notes: trimToNull(parsed.data.notes) ?? "",
        source: "concierge_medical_booking",
        updated_at: now.toISOString(),
      },
    };

    await db
      .insert(profiles)
      .values({
        id: userId,
        data_sharing_consent: nextConsent,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          data_sharing_consent: nextConsent,
          updated_at: now,
        },
      });

    const profileSignals = buildProfileServiceSignals({ data_sharing_consent: nextConsent });
    return res.json({
      ok: true,
      coverage: readCoverageSummary(nextConsent),
      serviceReadiness: {
        hasCoverageInfo: profileSignals.hasCoverageInfo,
      },
    });
  } catch (error) {
    console.error("[profile] failed to save coverage readiness", error);
    return res.status(500).json({ error: "Unable to save coverage readiness" });
  }
});

const profileSettingsSelection = {
  id: profiles.id,
  full_name: profiles.full_name,
  preferred_name: profiles.preferred_name,
  date_of_birth: profiles.date_of_birth,
  data_sharing_consent: profiles.data_sharing_consent,
  email: profiles.email,
  phone_number: profiles.phone_number,
  whatsapp_number: profiles.whatsapp_number,
  country_code: profiles.country_code,
  timezone: profiles.timezone,
  language: profiles.language,
  language_preference: profiles.language_preference,
  address_line_1: profiles.address_line_1,
  city: profiles.city,
  region: profiles.region,
  postcode: profiles.postcode,
  caregiver_name: profiles.caregiver_name,
  caregiver_contact: profiles.caregiver_contact,
  gp_name: profiles.gp_name,
  gp_phone: profiles.gp_phone,
  gp_email: profiles.gp_email,
  avatar_url: profiles.avatar_url,
};

const profileSettingsColumns = Object.keys(profileSettingsSelection) as ProfileReadColumn[];

async function selectProfileSettingsRows(userId: string) {
  return selectProfileRowsByDatabaseColumns(userId, profileSettingsColumns);
}

router.get("/", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const accountUserId = req.user?.id ?? null;

  try {
    const [rows, accountRows, accountProfileRows] = await Promise.all([
      selectProfileSettingsRows(userId),
      accountUserId
        ? db
            .select({ email: users.email, phone_number: users.phone_number })
            .from(users)
            .where(eq(users.id, accountUserId))
            .limit(1)
            .catch((err) => {
              const message = err instanceof Error ? err.message : String(err);
              if (message.includes("does not exist")) return [];
              throw err;
            })
        : Promise.resolve([]),
      accountUserId && accountUserId !== userId
        ? selectProfileRowsByDatabaseColumns(accountUserId, ["email", "phone_number"])
        : Promise.resolve([]),
    ]);

    if (!rows[0]) {
      return res.json(null);
    }

    const p = rows[0];
    const accountEmails = knownEmails(req.user?.email, accountRows[0]?.email, accountProfileRows[0]?.email);
    const accountEmail = accountEmails[0] ?? null;
    const nameParts = (p.full_name ?? "").trim().split(/\s+/);
    const firstName = firstNameFromProfileName(p.preferred_name) || nameParts[0] || "";
    const lastName  = nameParts.slice(1).join(" ");
    const language = resolvedProfileLanguage(p);
    const profileSignals = buildProfileServiceSignals(p);

    return res.json({
      firstName,
      lastName,
      preferredName:    p.preferred_name ?? "",
      dateOfBirth:      p.date_of_birth ?? "",
      gender:           readProfileGender(p.data_sharing_consent),
      email:            profileEmailForAccount(accountEmails, p.email) ?? "",
      accountEmail:     accountEmail ?? "",
      accountUserId,
      profileId:        p.id,
      phone:            p.phone_number ?? "",
      whatsapp:         p.whatsapp_number ?? "",
      country:          p.country_code ?? "",
      timezone:         p.timezone ?? "",
      language,
      languagePreference: p.language_preference ?? null,
      street:           p.address_line_1 ?? "",
      cityState:        p.city ?? "",
      region:           p.region ?? "",
      postalCode:       p.postcode ?? "",
      caregiverName:    p.caregiver_name ?? "",
      caregiverContact: p.caregiver_contact ?? "",
      gpName:           p.gp_name ?? "",
      gpPhone:          p.gp_phone ?? "",
      gpEmail:          p.gp_email ?? "",
      avatarUrl:        p.avatar_url ?? null,
      savedProviders:   profileSignals.savedProviders,
      coverage:         readCoverageSummary(p.data_sharing_consent),
      serviceReadiness: {
        hasSavedPharmacy: profileSignals.hasSavedPharmacy,
        hasSavedDoctor: profileSignals.hasSavedDoctor,
        hasSavedTransportProvider: profileSignals.hasSavedTransportProvider,
        hasMobilityInfo: profileSignals.hasMobilityInfo,
        hasCoverageInfo: profileSignals.hasCoverageInfo,
        hasPreferredContactMethod: profileSignals.hasPreferredContactMethod,
      },
    });
  } catch (err) {
    console.error("[profile GET]", err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.get("/doctor-context", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const conversationId = typeof req.query.conversation_id === "string"
      ? req.query.conversation_id.trim()
      : "";
    const medicalProfileToken = conversationId
      ? await signMedicalProfileToolToken(userId, conversationId)
      : "";

    return res.json({
      dynamicVariables: {
        ...(await getDoctorMedicalProfileVariables(userId)),
        ...(medicalProfileToken
          ? {
              context_token: medicalProfileToken,
              medical_profile_token: medicalProfileToken,
            }
          : {}),
      },
    });
  } catch (err) {
    console.error("[profile GET /doctor-context]", err);
    return res.status(500).json({ error: "Failed to fetch doctor context" });
  }
});

const languagePreferenceBodySchema = z.object({
  language: z.string().max(50),
});

router.patch("/language", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = languagePreferenceBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const language = normalizeProfileLanguage(parsed.data.language);

  try {
    const insertValues = {
      id: userId,
      language,
      language_preference: language,
    };
    const updateValues = {
      language,
      language_preference: language,
      updated_at: new Date(),
    };

    try {
      await db
        .insert(profiles)
        .values(insertValues)
        .onConflictDoUpdate({
          target: profiles.id,
          set: updateValues,
        });
    } catch (err) {
      if (!isMissingColumnError(err, "language_preference")) throw err;
      await db
        .insert(profiles)
        .values(withoutLanguagePreference(insertValues))
        .onConflictDoUpdate({
          target: profiles.id,
          set: withoutLanguagePreference(updateValues),
        });
    }

    return res.json({ ok: true, language, languagePreference: language });
  } catch (err) {
    console.error("[profile PATCH /language]", err);
    return res.status(500).json({ error: "Failed to save language preference" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const accountUserId = req.user?.id ?? null;

  const parsed = profileBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const d = parsed.data;
  const language = normalizeProfileLanguage(d.language ?? req.language);
  const full_name = [d.firstName, d.lastName].filter(Boolean).join(" ").trim();
  const hasGpNameInput = Object.prototype.hasOwnProperty.call(req.body, "gpName");
  const hasGpPhoneInput = Object.prototype.hasOwnProperty.call(req.body, "gpPhone");
  const hasGpEmailInput = Object.prototype.hasOwnProperty.call(req.body, "gpEmail");

  try {
    const [existingRows, accountRows, accountProfileRows] = await Promise.all([
      selectProfileRowsByDatabaseColumns(userId, ["data_sharing_consent", "email", "phone_number"]),
      accountUserId
        ? db
            .select({ email: users.email, phone_number: users.phone_number })
            .from(users)
            .where(eq(users.id, accountUserId))
            .limit(1)
            .catch((err) => {
              const message = err instanceof Error ? err.message : String(err);
              if (message.includes("does not exist")) return [];
              throw err;
            })
        : Promise.resolve([]),
      accountUserId && accountUserId !== userId
        ? selectProfileRowsByDatabaseColumns(accountUserId, ["email", "phone_number"])
        : Promise.resolve([]),
    ]);
    const existingProfile = existingRows[0];
    const account = accountRows[0];
    const accountProfile = accountProfileRows[0];
    const accountEmails = knownEmails(req.user?.email, account?.email, accountProfile?.email);
    const accountPhone = normalizeProfilePhone(account?.phone_number ?? accountProfile?.phone_number ?? null);
    const dataSharingConsent = mergeIdentityGender(existingRows[0]?.data_sharing_consent, d.gender);
    const inputEmail = trimToNull(d.email);
    const inputPhone = normalizeProfilePhone(d.phone);
    const inputWhatsapp = normalizeProfilePhone(d.whatsapp) ?? trimToNull(d.whatsapp);
    const isEditingActiveCareProfile = Boolean(accountUserId && accountUserId !== userId);
    let profileEmail = profileEmailForAccount(accountEmails, inputEmail);
    let profilePhone = isEditingActiveCareProfile && samePhone(inputPhone, accountPhone)
      ? normalizeProfilePhone(existingProfile?.phone_number) ?? null
      : inputPhone;

    if (profileEmail && !sameEmail(profileEmail, existingProfile?.email)) {
      const emailOwner = await selectProfileIdByEmailFromDatabaseColumns(profileEmail, userId);

      if (emailOwner) {
        if (isEditingActiveCareProfile && emailOwner.id === accountUserId) {
          profileEmail = existingProfile?.email ?? null;
        } else {
          return res.status(409).json({
            error: "That email is already used on another profile. Use the account email only for your sign-in account, or choose a different profile email.",
          });
        }
      }
    }

    const profilePhoneDigits = phoneDigits(profilePhone);
    if (profilePhone && profilePhoneDigits && !samePhone(profilePhone, existingProfile?.phone_number)) {
      const phoneOwner = await selectProfileIdByPhoneDigitsFromDatabaseColumns(profilePhoneDigits, userId);

      if (phoneOwner) {
        if (isEditingActiveCareProfile && phoneOwner.id === accountUserId) {
          profilePhone = normalizeProfilePhone(existingProfile?.phone_number) ?? null;
        } else {
          return res.status(409).json({
            error: "That phone number is already used on another profile. Choose a different profile phone number.",
          });
        }
      }
    }

    const now = new Date();
    const insertValues = {
      id:               userId,
      full_name,
      preferred_name:   d.preferredName || null,
      date_of_birth:    d.dateOfBirth || null,
      email:            profileEmail,
      phone_number:     profilePhone,
      whatsapp_number:  inputWhatsapp,
      country_code:     d.country || null,
      timezone:         d.timezone || "Europe/Madrid",
      language,
      language_preference: language,
      address_line_1:   d.street || null,
      city:             d.cityState || null,
      postcode:         d.postalCode || null,
      caregiver_name:   d.caregiverName || null,
      caregiver_contact: d.caregiverContact || null,
      gp_name:          d.gpName || null,
      gp_phone:         d.gpPhone || null,
      gp_email:         d.gpEmail || null,
      data_sharing_consent: dataSharingConsent,
      deployment:       "standard",
      subscription_status: "trial",
      subscription_tier: "free",
      account_status:   "enabled",
      role:             "user",
      onboarding_complete: false,
      created_at:       now,
      updated_at:       now,
    };
    const updateValues = {
      full_name,
      preferred_name:   d.preferredName || null,
      date_of_birth:    d.dateOfBirth || null,
      email:            profileEmail,
      phone_number:     profilePhone,
      whatsapp_number:  inputWhatsapp,
      country_code:     d.country || null,
      timezone:         d.timezone || "Europe/Madrid",
      language,
      language_preference: language,
      address_line_1:   d.street || null,
      city:             d.cityState || null,
      postcode:         d.postalCode || null,
      caregiver_name:   d.caregiverName || null,
      caregiver_contact: d.caregiverContact || null,
      ...(hasGpNameInput ? { gp_name: d.gpName || null } : {}),
      ...(hasGpPhoneInput ? { gp_phone: d.gpPhone || null } : {}),
      ...(hasGpEmailInput ? { gp_email: d.gpEmail || null } : {}),
      data_sharing_consent: dataSharingConsent,
      updated_at:       now,
    };

    await upsertProfileToleratingMissingColumns(insertValues, updateValues, "[profile POST]");

    return res.json({ ok: true });
  } catch (err) {
    if (isUniqueViolation(err, ["phone_number", "profiles_phone_number"])) {
      return res.status(409).json({
        error: "That phone number is already used on another profile. Choose a different profile phone number.",
      });
    }
    if (isUniqueViolation(err, ["email", "profiles_email"])) {
      return res.status(409).json({
        error: "That email is already used on another profile. Use the account email only for your sign-in account, or choose a different profile email.",
      });
    }
    console.error("[profile POST]", err);
    return res.status(500).json({ error: "Failed to save profile" });
  }
});

// PATCH /avatar — update the current user's profile photo (data URL or null)
const avatarBodySchema = z.object({
  avatarUrl: z.string().max(2_000_000).nullable(),
});

router.patch("/avatar", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = avatarBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    await db
      .insert(profiles)
      .values({ id: userId, avatar_url: parsed.data.avatarUrl })
      .onConflictDoUpdate({
        target: profiles.id,
        set: { avatar_url: parsed.data.avatarUrl, updated_at: new Date() },
      });
    return res.json({ ok: true, avatarUrl: parsed.data.avatarUrl });
  } catch (err) {
    console.error("[profile PATCH /avatar]", err);
    return res.status(500).json({ error: "Failed to update avatar" });
  }
});

router.get("/personalisation", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [profileRows, medCountRows] = await Promise.all([
      db.select({ data_sharing_consent: profiles.data_sharing_consent })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1),
      db.select({ count: count() })
        .from(userMedications)
        .where(eq(userMedications.user_id, userId)),
    ]);

    const consent = (profileRows[0]?.data_sharing_consent ?? {}) as Record<string, unknown>;
    const conditionsSection = consent["conditions"] as { health_conditions?: string[] } | undefined;
    const hobbiesSection = consent["hobbies"] as { hobbies?: string[] } | undefined;

    return res.json({
      conditions: conditionsSection?.health_conditions ?? [],
      hobbies: hobbiesSection?.hobbies ?? [],
      hasMedications: (medCountRows[0]?.count ?? 0) > 0,
    });
  } catch (err) {
    console.error("[profile GET /personalisation]", err);
    return res.status(500).json({ error: "Failed to fetch personalisation data" });
  }
});

router.get("/scheduled-events", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [events, medications] = await Promise.all([
      db.select().from(scheduledEvents).where(eq(scheduledEvents.user_id, userId)).orderBy(desc(scheduledEvents.scheduled_for)).limit(100),
      db.select().from(userMedications).where(eq(userMedications.user_id, userId)).limit(100),
    ]);

    return res.json({ events: [...events, ...medicationEventsFromRows(medications)] });
  } catch (err) {
    console.error("[profile GET /scheduled-events]", err);
    return res.status(500).json({ error: "Failed to fetch scheduled events" });
  }
});

router.post("/scheduled-events", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = scheduledEventBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid scheduled event" });

  try {
    const data = parsed.data;
    const [event] = await db.insert(scheduledEvents).values({
      user_id: userId,
      event_type: data.event_type,
      title: data.title,
      description: data.description ?? null,
      channel: data.channel,
      agent_id: data.agent_id ?? null,
      agent_slug: data.agent_slug ?? null,
      room_slug: data.room_slug ?? null,
      scheduled_for: new Date(data.scheduled_for),
      timezone: data.timezone,
      recurrence: data.recurrence,
      status: data.status,
      source: data.source,
      metadata: data.metadata,
      created_by: userId,
    }).returning();
    await db.insert(scheduledEventLogs).values({ scheduled_event_id: event.id, user_id: userId, action: "created", status: event.status, created_by: userId });
    return res.status(201).json({ event });
  } catch (err) {
    console.error("[profile POST /scheduled-events]", err);
    return res.status(500).json({ error: "Failed to create scheduled event" });
  }
});

router.patch("/scheduled-events/:id", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = scheduledEventBodySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid scheduled event update" });
  if (req.params.id.startsWith("medication:")) return res.status(400).json({ error: "Medication reminders are edited from Medications" });

  const data = parsed.data;
  const patch: Partial<typeof scheduledEvents.$inferInsert> = { updated_at: new Date(), updated_by: userId };
  if (data.event_type !== undefined) patch.event_type = data.event_type;
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description ?? null;
  if (data.channel !== undefined) patch.channel = data.channel;
  if (data.agent_id !== undefined) patch.agent_id = data.agent_id ?? null;
  if (data.agent_slug !== undefined) patch.agent_slug = data.agent_slug ?? null;
  if (data.room_slug !== undefined) patch.room_slug = data.room_slug ?? null;
  if (data.scheduled_for !== undefined) patch.scheduled_for = new Date(data.scheduled_for);
  if (data.timezone !== undefined) patch.timezone = data.timezone;
  if (data.recurrence !== undefined) patch.recurrence = data.recurrence;
  if (data.status !== undefined) patch.status = data.status;
  if (data.source !== undefined) patch.source = data.source;
  if (data.metadata !== undefined) patch.metadata = data.metadata;

  try {
    const [event] = await db.update(scheduledEvents).set(patch).where(eq(scheduledEvents.id, req.params.id)).returning();
    if (!event || event.user_id !== userId) return res.status(404).json({ error: "Scheduled event not found" });
    await db.insert(scheduledEventLogs).values({ scheduled_event_id: event.id, user_id: userId, action: "updated", status: event.status, created_by: userId });
    return res.json({ event });
  } catch (err) {
    console.error("[profile PATCH /scheduled-events]", err);
    return res.status(500).json({ error: "Failed to update scheduled event" });
  }
});

for (const [action, status] of [["pause", "paused"], ["resume", "upcoming"], ["cancel", "cancelled"]] as const) {
  router.post(`/scheduled-events/:id/${action}`, async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    if (req.params.id.startsWith("medication:")) return res.status(400).json({ error: "Medication reminders are edited from Medications" });
    const [event] = await db.update(scheduledEvents).set({ status, updated_at: new Date(), updated_by: userId }).where(eq(scheduledEvents.id, req.params.id)).returning();
    if (!event || event.user_id !== userId) return res.status(404).json({ error: "Scheduled event not found" });
    await db.insert(scheduledEventLogs).values({ scheduled_event_id: event.id, user_id: userId, action, status, created_by: userId });
    return res.json({ event });
  });
}

export default router;
