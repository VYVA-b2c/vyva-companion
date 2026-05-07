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
} from "../../shared/schema.js";
import { getDoctorMedicalProfileVariables } from "../lib/doctorMedicalProfile.js";
import { signMedicalProfileToolToken } from "../lib/jwt.js";
import { entitlementForTier, normalizeSubscriptionTier } from "../lib/plans.js";
import { mergeIdentityGender, readProfileGender } from "../lib/userPersonalization.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";

const DEMO_USER_ID = "demo-user";
const IS_PROD = process.env.NODE_ENV === "production";

const router = Router();

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
    if (!IS_PROD) return req.user.id;
    return null;
  }
  if (!IS_PROD) return DEMO_USER_ID;
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
  country:         z.string().max(100).optional().default(""),
  timezone:        z.string().max(100).optional().default(""),
  language:        z.string().max(50).optional().default("en"),
  street:          z.string().max(200).optional().default(""),
  cityState:       z.string().max(200).optional().default(""),
  postalCode:      z.string().max(30).optional().default(""),
  caregiverName:   z.string().max(150).optional().default(""),
  caregiverContact: z.string().max(50).optional().default(""),
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

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function consentSection(consent: unknown, section: string): Record<string, unknown> {
  if (!consent || typeof consent !== "object") return {};
  const value = (consent as Record<string, unknown>)[section];
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
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

router.get("/readiness", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

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
    const hasGp = hasText(profile?.gp_name) || hasText(profile?.gp_phone);
    const entitlements = await entitlementForTier(normalizeSubscriptionTier(profile?.subscription_tier));

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
    const medicationGate = gate(hasMedicationForServices, medicationMissing);
    const voiceEnabled = Boolean(entitlements?.is_active && entitlements.voice_assistant);
    const medicationEnabled = Boolean(entitlements?.is_active && entitlements.medication_tracking);
    const symptomCheckEnabled = Boolean(entitlements?.is_active && entitlements.symptom_check);
    const conciergeEnabled = Boolean(entitlements?.is_active && entitlements.concierge);
    const caregiverDashboardEnabled = Boolean(entitlements?.is_active && entitlements.caregiver_dashboard);

    return res.json({
      profile: {
        exists: !!profile,
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
      },
      services: {
        medications: entitlementGate(medicationEnabled, "medication tracking", medicationGate),
        adherenceReport: entitlementGate(medicationEnabled, "medication tracking", medicationGate),
        medicationReminders: entitlementGate(medicationEnabled, "medication tracking", medicationGate),
        medicationInteractions: entitlementGate(medicationEnabled, "medication tracking", medicationGate),
        sos: gate(hasDetailedAddress && hasEmergencyContact, sosMissing),
        doctor: gate(hasBasics && hasContact, doctorMissing, doctorRecommended),
        localServices: gate(hasLocalAddress, addressMissing),
        specialistFinder: gate(hasLocalAddress, addressMissing),
        reports: gate(true, []),
        concierge: entitlementGate(conciergeEnabled, "concierge"),
        socialRooms: gate(true, []),
        activities: gate(true, []),
        brainTraining: gate(true, []),
        chat: entitlementGate(voiceEnabled, "the voice assistant"),
        symptomCheck: entitlementGate(symptomCheckEnabled, "symptom checks"),
        caregiverDashboard: entitlementGate(caregiverDashboardEnabled, "the caregiver dashboard"),
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

router.get("/", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!rows[0]) {
      return res.json(null);
    }

    const p = rows[0];
    const nameParts = (p.full_name ?? "").trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName  = nameParts.slice(1).join(" ");

    return res.json({
      firstName,
      lastName,
      preferredName:    p.preferred_name ?? "",
      dateOfBirth:      p.date_of_birth ?? "",
      gender:           readProfileGender(p.data_sharing_consent),
      email:            p.email ?? "",
      phone:            p.phone_number ?? "",
      country:          p.country_code ?? "",
      timezone:         p.timezone ?? "",
      language:         p.language ?? "en",
      street:           p.address_line_1 ?? "",
      cityState:        p.city ?? "",
      postalCode:       p.postcode ?? "",
      caregiverName:    p.caregiver_name ?? "",
      caregiverContact: p.caregiver_contact ?? "",
      avatarUrl:        p.avatar_url ?? null,
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

router.post("/", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = profileBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const d = parsed.data;
  const full_name = [d.firstName, d.lastName].filter(Boolean).join(" ").trim();

  try {
    const existingRows = await db
      .select({ data_sharing_consent: profiles.data_sharing_consent })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    const dataSharingConsent = mergeIdentityGender(existingRows[0]?.data_sharing_consent, d.gender);

    await db
      .insert(profiles)
      .values({
        id:               userId,
        full_name,
        preferred_name:   d.preferredName || null,
        date_of_birth:    d.dateOfBirth || null,
        email:            d.email || null,
        phone_number:     d.phone || null,
        country_code:     d.country || null,
        timezone:         d.timezone || "Europe/Madrid",
        language:         d.language || "en",
        address_line_1:   d.street || null,
        city:             d.cityState || null,
        postcode:         d.postalCode || null,
        caregiver_name:   d.caregiverName || null,
        caregiver_contact: d.caregiverContact || null,
        data_sharing_consent: dataSharingConsent,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          full_name,
          preferred_name:   d.preferredName || null,
          date_of_birth:    d.dateOfBirth || null,
          email:            d.email || null,
          phone_number:     d.phone || null,
          country_code:     d.country || null,
          timezone:         d.timezone || "Europe/Madrid",
          language:         d.language || "en",
          address_line_1:   d.street || null,
          city:             d.cityState || null,
          postcode:         d.postalCode || null,
          caregiver_name:   d.caregiverName || null,
          caregiver_contact: d.caregiverContact || null,
          data_sharing_consent: dataSharingConsent,
          updated_at:       new Date(),
        },
      });

    return res.json({ ok: true });
  } catch (err) {
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
